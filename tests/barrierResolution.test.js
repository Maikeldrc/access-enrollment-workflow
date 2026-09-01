import { describe, it, expect } from "vitest";
import {
  BARRIER_TYPES, RESOLUTION_STATUS, RESOLUTION_STEPS, RESOLUTION_TYPES,
  addressErrorText, advanceResolution, appointmentReadiness, barrierListState,
  careTeamAssistanceRequest, classifyResolutionIntent, createResolution, homeAddressFrom,
  isTerminalStep, isWorkingStep, pickupTimeChoices, recommendedPickupTime, resolutionEvent,
  resolutionPlaybookFor, resolutionSpeech, resolutionStatusForStep, resolutionTypeFor,
  returnPickupTime, toggleTransportNeed, transportNeedOptions, transportationSuitability,
  validateAddress
} from "../src/barrierResolution.js";
import { APPOINTMENT_BARRIER_REASONS } from "../src/appointmentSupport.js";

const at = "2026-09-02T18:45:00.000Z";
const appointment = (overrides = {}) => ({
  id: "appt-1",
  status: "CONFIRMED",
  scheduledAt: at,
  scheduledEndAt: "2026-09-02T19:15:00.000Z",
  timezone: "America/New_York",
  providerDisplayName: "Dr. Fresner Lee",
  ...overrides
});

const resolutionOn = (barrierType, step, data = {}) => {
  const base = createResolution({ appointmentId: "appt-1", patientId: "patient_demo", barrierType });
  return advanceResolution(base, step, data);
};

describe("resolution playbooks", () => {
  it("opens a playbook only for the pre-visit answers EMMI can actually finish", () => {
    expect(resolutionPlaybookFor(APPOINTMENT_BARRIER_REASONS.TRANSPORTATION)).toBe(BARRIER_TYPES.TRANSPORTATION);
    expect(resolutionPlaybookFor(APPOINTMENT_BARRIER_REASONS.TECHNOLOGY_TELEHEALTH)).toBe(BARRIER_TYPES.VIDEO_VISIT);
    expect(resolutionPlaybookFor(APPOINTMENT_BARRIER_REASONS.CAREGIVER_AVAILABILITY)).toBe(BARRIER_TYPES.COMPANION);
    expect(resolutionPlaybookFor(APPOINTMENT_BARRIER_REASONS.TIME_CONFLICT)).toBe(BARRIER_TYPES.RESCHEDULE);
    expect(resolutionPlaybookFor(APPOINTMENT_BARRIER_REASONS.OTHER)).toBe(BARRIER_TYPES.OTHER);
    // "I'm all set" is an answer, not a difficulty. A playbook here would invent a problem.
    expect(resolutionPlaybookFor(APPOINTMENT_BARRIER_REASONS.ALL_SET)).toBe("");
    // A difficulty with no playbook goes to the care team the way it always did, rather than
    // opening a flow that cannot finish.
    expect(resolutionPlaybookFor(APPOINTMENT_BARRIER_REASONS.FINANCIAL)).toBe("");
    expect(resolutionPlaybookFor("")).toBe("");
  });

  it("names what a resolved resolution produced", () => {
    expect(resolutionTypeFor(BARRIER_TYPES.TRANSPORTATION)).toBe(RESOLUTION_TYPES.TRANSPORTATION_BOOKING);
    expect(resolutionTypeFor(BARRIER_TYPES.COMPANION)).toBe(RESOLUTION_TYPES.COMPANION_INVITATION);
    expect(resolutionTypeFor("nonsense")).toBe(RESOLUTION_TYPES.CARE_TEAM_ESCALATION);
  });

  it("refuses to create a resolution for a barrier with no playbook", () => {
    expect(createResolution({ appointmentId: "appt-1", reasonKey: APPOINTMENT_BARRIER_REASONS.ALL_SET })).toBeNull();
    expect(createResolution({ appointmentId: "appt-1", barrierType: "not-a-barrier" })).toBeNull();
  });

  it("starts every playbook on its own first step, offering help rather than collecting", () => {
    for (const type of [BARRIER_TYPES.TRANSPORTATION, BARRIER_TYPES.VIDEO_VISIT, BARRIER_TYPES.COMPANION, BARRIER_TYPES.RESCHEDULE]) {
      const created = createResolution({ appointmentId: "appt-1", barrierType: type });
      expect(created.step, type).toBe("OFFER");
      expect(created.status, type).toBe(RESOLUTION_STATUS.ASSISTANCE_OFFERED);
    }
    // "Something else" has nothing to offer until it knows what the difficulty is.
    expect(createResolution({ appointmentId: "appt-1", barrierType: BARRIER_TYPES.OTHER }).step).toBe("DESCRIBE");
  });
});

describe("the step machine", () => {
  it("refuses a step that does not belong to the playbook, staying where it was", () => {
    const ride = resolutionOn(BARRIER_TYPES.TRANSPORTATION, "OPTIONS");
    // CONTACTS belongs to the companion playbook. A handler typo must not strand a patient on a
    // step no view knows how to draw.
    expect(advanceResolution(ride, "CONTACTS").step).toBe("OPTIONS");
    expect(advanceResolution(null, "OPTIONS")).toBeNull();
  });

  it("derives status from the step so the two can never disagree", () => {
    expect(resolutionStatusForStep("REVIEW")).toBe(RESOLUTION_STATUS.AWAITING_CONFIRMATION);
    expect(resolutionStatusForStep("BOOKED")).toBe(RESOLUTION_STATUS.RESOLVED);
    expect(resolutionStatusForStep("ESCALATED")).toBe(RESOLUTION_STATUS.NEEDS_CARE_TEAM);
    expect(resolutionStatusForStep("DECLINED")).toBe(RESOLUTION_STATUS.CANCELLED);
    const booked = resolutionOn(BARRIER_TYPES.TRANSPORTATION, "BOOKED");
    expect(booked.status).toBe(RESOLUTION_STATUS.RESOLVED);
    expect(booked.resolvedAt).not.toBe("");
  });

  it("keeps a review step between selecting and executing in every playbook that acts", () => {
    // §12: the pattern is Review -> Confirm -> Processing -> Success, so a working step must never
    // be reachable without a REVIEW in the same playbook ahead of it.
    for (const type of [BARRIER_TYPES.TRANSPORTATION, BARRIER_TYPES.COMPANION, BARRIER_TYPES.RESCHEDULE]) {
      const steps = RESOLUTION_STEPS[type];
      expect(steps, type).toContain("REVIEW");
      const working = steps.filter(isWorkingStep).filter(step => step !== "SEARCHING" && step !== "CHECKING");
      expect(working.length, type).toBeGreaterThan(0);
      for (const step of working) expect(steps.indexOf("REVIEW"), `${type}:${step}`).toBeLessThan(steps.indexOf(step));
    }
  });

  it("merges data rather than replacing it, so a step back keeps what was collected", () => {
    const ride = resolutionOn(BARRIER_TYPES.TRANSPORTATION, "NEEDS", { pickupAddress: { line1: "123 Oak Avenue" } });
    const later = advanceResolution(ride, "OPTIONS", { options: [{ optionId: "a" }] });
    const backToOptions = advanceResolution(later, "TIME");
    expect(backToOptions.data.pickupAddress.line1).toBe("123 Oak Avenue");
    expect(backToOptions.data.options).toHaveLength(1);
  });

  it("knows which steps are waiting on the world and which are the end of the road", () => {
    expect(isWorkingStep("SEARCHING")).toBe(true);
    expect(isWorkingStep("OPTIONS")).toBe(false);
    expect(isTerminalStep("BOOKED")).toBe(true);
    expect(isTerminalStep("REVIEW")).toBe(false);
  });
});

describe("transportation: what EMMI may offer", () => {
  it("treats a wheelchair or needing help in and out of the car as not a standard ride", () => {
    expect(transportationSuitability(["NONE"]).standardRideAppropriate).toBe(true);
    expect(transportationSuitability(["CANE_WALKER"]).standardRideAppropriate).toBe(true);
    expect(transportationSuitability(["WHEELCHAIR"]).standardRideAppropriate).toBe(false);
    const helped = transportationSuitability(["HELP_IN_OUT"]);
    expect(helped.standardRideAppropriate).toBe(false);
    expect(helped.accessibilityRequired).toBe(true);
    expect(helped.blockingNeeds).toEqual(["HELP_IN_OUT"]);
  });

  it("counts a companion as a seat rather than a refusal", () => {
    const riding = transportationSuitability(["COMPANION_RIDING"]);
    expect(riding.standardRideAppropriate).toBe(true);
    expect(riding.extraPassengers).toBe(1);
  });

  it("never records a patient as needing nothing and needing a wheelchair at once", () => {
    expect(toggleTransportNeed([], "NONE")).toEqual(["NONE"]);
    expect(toggleTransportNeed(["NONE"], "WHEELCHAIR")).toEqual(["WHEELCHAIR"]);
    expect(toggleTransportNeed(["WHEELCHAIR"], "NONE")).toEqual(["NONE"]);
    expect(toggleTransportNeed(["WHEELCHAIR"], "CANE_WALKER")).toEqual(["WHEELCHAIR", "CANE_WALKER"]);
    expect(toggleTransportNeed(["WHEELCHAIR"], "WHEELCHAIR")).toEqual([]);
    expect(toggleTransportNeed(["WHEELCHAIR"], "NOT_A_NEED")).toEqual(["WHEELCHAIR"]);
  });

  it("offers the needs in every language without leaking the enum", () => {
    for (const locale of ["en", "es", "ht"]) {
      const options = transportNeedOptions(locale);
      expect(options).toHaveLength(5);
      for (const option of options) expect(option.label, `${locale}:${option.id}`).not.toMatch(/^[A-Z_]+$/);
    }
  });
});

describe("transportation: pickup time", () => {
  it("works back from the appointment: arrive early, travel, buffer", () => {
    const pickup = recommendedPickupTime(at, { arriveEarlyMinutes: 15, travelMinutes: 24, bufferMinutes: 6 });
    // 2:45pm - 15 arrive early = 2:30pm; - 30 travel+buffer = 2:00pm.
    expect(pickup.arriveByAt).toBe("2026-09-02T18:30:00.000Z");
    expect(pickup.pickupAt).toBe("2026-09-02T18:00:00.000Z");
  });

  it("rounds down to a time a person would say out loud", () => {
    // 2:52pm - 15 - 30 = 2:07pm, which reads as a computed number rather than a plan.
    const pickup = recommendedPickupTime("2026-09-02T18:52:00.000Z");
    expect(new Date(pickup.pickupAt).getUTCMinutes()).toBe(5);
    expect(new Date(pickup.pickupAt).getUTCSeconds()).toBe(0);
  });

  it("has no pickup time for an appointment with no time", () => {
    expect(recommendedPickupTime("")).toBeNull();
    expect(recommendedPickupTime("not a date")).toBeNull();
  });

  it("offers alternatives around the recommendation rather than a spinner", () => {
    const choices = pickupTimeChoices("2026-09-02T18:00:00.000Z", "es");
    expect(choices.map(choice => choice.offsetMinutes)).toEqual([-30, -15, 0, 15]);
    expect(choices[0].pickupAt).toBe("2026-09-02T17:30:00.000Z");
    expect(choices[2].pickupAt).toBe("2026-09-02T18:00:00.000Z");
    expect(pickupTimeChoices("", "en")).toEqual([]);
  });

  it("uses the visit's own end time for 'when my visit ends', and an estimate when there is none", () => {
    expect(returnPickupTime(appointment(), "WHEN_VISIT_ENDS")).toBe("2026-09-02T19:15:00.000Z");
    expect(returnPickupTime(appointment({ scheduledEndAt: "" }), "WHEN_VISIT_ENDS")).toBe("2026-09-02T19:30:00.000Z");
    expect(returnPickupTime(appointment(), "PLUS_45")).toBe("2026-09-02T19:30:00.000Z");
    expect(returnPickupTime(appointment({ scheduledAt: "" }))).toBeNull();
  });
});

describe("addresses", () => {
  it("builds a home address only from a record that actually has a street", () => {
    const home = homeAddressFrom({ line1: "123 Oak Avenue", unit: "Apt 4B", city: "Miami", state: "FL", zip: "33176" });
    expect(home.formatted).toBe("123 Oak Avenue, Apt 4B · Miami, FL 33176");
    expect(homeAddressFrom({ city: "Miami", zip: "33176" })).toBeNull();
    expect(homeAddressFrom(null)).toBeNull();
  });

  it("checks the shape of what was typed and never claims the address exists", () => {
    const ok = validateAddress({ line1: "45 Palm Street", city: "Miami", state: "fl", zip: "33176" });
    expect(ok.ok).toBe(true);
    expect(ok.address.state).toBe("FL");
    expect(validateAddress({ line1: "45", city: "Miami", zip: "33176" }).errors).toContain("MISSING_STREET");
    expect(validateAddress({ line1: "45 Palm Street", zip: "33176" }).errors).toContain("MISSING_CITY");
    expect(validateAddress({ line1: "45 Palm Street", city: "Miami" }).errors).toContain("MISSING_ZIP");
    expect(validateAddress({ line1: "45 Palm Street", city: "Miami", zip: "331" }).errors).toContain("BAD_ZIP");
  });

  it("says what is wrong in the patient's language, never as a code", () => {
    for (const locale of ["en", "es", "ht"]) {
      expect(addressErrorText("BAD_ZIP", locale)).not.toMatch(/BAD_ZIP/);
      expect(addressErrorText("BAD_ZIP", locale).length).toBeGreaterThan(5);
    }
    expect(addressErrorText("NOT_A_CODE", "en")).toBe("");
  });
});

describe("routing what the patient typed", () => {
  it("routes the sentences a patient actually writes, in all three languages", () => {
    expect(classifyResolutionIntent("no tengo carro").barrierType).toBe(BARRIER_TYPES.TRANSPORTATION);
    expect(classifyResolutionIntent("mi hija no puede llevarme").barrierType).toBe(BARRIER_TYPES.COMPANION);
    expect(classifyResolutionIntent("no sé usar la cámara").barrierType).toBe(BARRIER_TYPES.VIDEO_VISIT);
    expect(classifyResolutionIntent("no puedo a esa hora").barrierType).toBe(BARRIER_TYPES.RESCHEDULE);
    expect(classifyResolutionIntent("I don't have a way to get there").barrierType).toBe(BARRIER_TYPES.TRANSPORTATION);
    expect(classifyResolutionIntent("mwen pa gen machin").barrierType).toBe(BARRIER_TYPES.TRANSPORTATION);
  });

  it("folds the curly apostrophes a phone keyboard and a transcript produce", () => {
    expect(classifyResolutionIntent("I can’t make that time").barrierType).toBe(BARRIER_TYPES.RESCHEDULE);
    expect(classifyResolutionIntent("I don’t have a car").barrierType).toBe(BARRIER_TYPES.TRANSPORTATION);
  });

  it("routes nothing it is not confident about, so the care team gets it instead", () => {
    expect(classifyResolutionIntent("the weather is bad").barrierType).toBe("");
    expect(classifyResolutionIntent("").barrierType).toBe("");
    expect(classifyResolutionIntent("ok").confidence).toBe(0);
  });

  it("returns the shape an LLM would have to return, so the classifier can be replaced", () => {
    const verdict = classifyResolutionIntent("no tengo carro");
    expect(Object.keys(verdict).sort()).toEqual(["barrierType", "candidate", "confidence", "matched"]);
    expect(verdict.confidence).toBeGreaterThan(0.5);
    expect(verdict.confidence).toBeLessThanOrEqual(1);
  });
});

describe("appointment readiness", () => {
  const readiness = (resolutions, appt = appointment()) => appointmentReadiness({ appointment: appt, resolutions, locale: "en" });

  it("lists nothing but the appointment itself when the patient raised nothing", () => {
    const state = readiness([]);
    expect(state.items).toHaveLength(1);
    expect(state.items[0].id).toBe("APPOINTMENT_CONFIRMED");
    expect(state.ready).toBe(true);
    expect(state.summary).toMatch(/Ready/i);
  });

  it("says a visit is not ready while a difficulty is still being worked on", () => {
    const state = readiness([resolutionOn(BARRIER_TYPES.TRANSPORTATION, "OPTIONS")]);
    expect(state.unresolvedCount).toBe(1);
    expect(state.ready).toBe(false);
    expect(state.summary).toMatch(/1 thing/);
  });

  it("counts more than one outstanding item without alarm", () => {
    const state = readiness([
      resolutionOn(BARRIER_TYPES.TRANSPORTATION, "OPTIONS"),
      resolutionOn(BARRIER_TYPES.COMPANION, "SENT")
    ]);
    expect(state.summary).toMatch(/2 things/);
    expect(state.summary).not.toMatch(/urgent|problem|warning|fail/i);
  });

  it("names the person once a companion has confirmed", () => {
    const state = readiness([resolutionOn(BARRIER_TYPES.COMPANION, "CONFIRMED", { contactName: "Maria" })]);
    const companion = state.items.find(item => item.id === "COMPANION");
    expect(companion.state).toBe("READY");
    expect(companion.label).toContain("Maria");
  });

  it("does not claim it is waiting for a companion response before the invitation is sent", () => {
    const review = readiness([resolutionOn(BARRIER_TYPES.COMPANION, "REVIEW", { contactName: "Maria" })]);
    const beforeSend = review.items.find(item => item.id === "COMPANION");
    expect(beforeSend.label).toMatch(/Coordinating/i);
    expect(beforeSend.label).not.toMatch(/Waiting/i);

    const sent = readiness([resolutionOn(BARRIER_TYPES.COMPANION, "SENT", { contactName: "Maria" })]);
    expect(sent.items.find(item => item.id === "COMPANION").label).toMatch(/Waiting/i);
  });

  it("shows the ride under the transportation row rather than as a second item", () => {
    const state = readiness([resolutionOn(BARRIER_TYPES.TRANSPORTATION, "BOOKED", {
      reservation: { serviceName: "UberX", pickupLabel: "2:00 PM" }
    })]);
    const ride = state.items.find(item => item.id === "TRANSPORTATION");
    expect(ride.state).toBe("READY");
    expect(ride.detail).toBe("UberX · 2:00 PM");
    expect(state.ready).toBe(true);
  });

  it("keeps a reschedule and a 'something else' in the count without giving each a row", () => {
    const state = readiness([resolutionOn(BARRIER_TYPES.RESCHEDULE, "SLOTS")]);
    expect(state.items).toHaveLength(1);
    expect(state.unresolvedCount).toBe(1);
    // A finished reschedule stops counting: the appointment itself now carries the answer.
    const done = readiness([resolutionOn(BARRIER_TYPES.RESCHEDULE, "CHANGED")]);
    expect(done.unresolvedCount).toBe(0);
  });

  it("does not treat an unconfirmed appointment as ready", () => {
    const state = readiness([], appointment({ status: "REQUEST_SENT" }));
    expect(state.appointmentConfirmed).toBe(false);
    expect(state.ready).toBe(false);
  });

  it("reads only the resolutions belonging to this appointment", () => {
    const other = { ...resolutionOn(BARRIER_TYPES.TRANSPORTATION, "OPTIONS"), appointmentId: "appt-2" };
    expect(readiness([other]).items).toHaveLength(1);
  });

  it("says the same things in every language", () => {
    for (const locale of ["en", "es", "ht"]) {
      const state = appointmentReadiness({ appointment: appointment(), resolutions: [resolutionOn(BARRIER_TYPES.TRANSPORTATION, "BOOKED")], locale });
      for (const item of state.items) expect(item.label, `${locale}:${item.id}`).not.toMatch(/^[A-Z_]+$/);
      expect(state.summary, locale).not.toMatch(/^[A-Z_]+$/);
    }
  });
});

describe("barrier state on the pre-visit list", () => {
  it("says what happened in a word, and says a cancelled attempt nothing at all", () => {
    expect(barrierListState(resolutionOn(BARRIER_TYPES.TRANSPORTATION, "BOOKED"), "en").label).toMatch(/Arranged/i);
    expect(barrierListState(resolutionOn(BARRIER_TYPES.VIDEO_VISIT, "READY"), "en").label).toMatch(/All set/i);
    expect(barrierListState(resolutionOn(BARRIER_TYPES.COMPANION, "CONFIRMED", { contactName: "Maria" }), "en").label).toContain("Maria");
    expect(barrierListState(resolutionOn(BARRIER_TYPES.TRANSPORTATION, "OPTIONS"), "en").label).toMatch(/progress/i);
    expect(barrierListState(resolutionOn(BARRIER_TYPES.TRANSPORTATION, "ESCALATED"), "en").label).toMatch(/Help requested/i);
    // A patient who said "not right now" is not carrying a badge about it.
    expect(barrierListState(resolutionOn(BARRIER_TYPES.TRANSPORTATION, "DECLINED"), "en")).toBeNull();
    expect(barrierListState(null, "en")).toBeNull();
  });

  it("carries an icon with every tone, so the state is never colour alone", () => {
    for (const step of ["BOOKED", "OPTIONS", "ESCALATED"]) {
      const listState = barrierListState(resolutionOn(BARRIER_TYPES.TRANSPORTATION, step), "en");
      expect(listState.icon, step).toBeTruthy();
      expect(listState.tone, step).toBeTruthy();
    }
  });
});

describe("the activity log and the care-team task", () => {
  it("records what happened without recording the patient", () => {
    const ride = resolutionOn(BARRIER_TYPES.TRANSPORTATION, "BOOKED");
    const event = resolutionEvent("transportation_reserved", { resolution: ride, patientId: "patient_demo", metadata: { rideType: "STANDARD" } });
    expect(event.type).toBe("transportation_reserved");
    expect(event.appointmentId).toBe("appt-1");
    expect(event.resolutionId).toBe(ride.id);
    expect(event.metadata.rideType).toBe("STANDARD");
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Object.isFrozen(event)).toBe(true);
  });

  it("builds an open task naming the barrier, the appointment and why EMMI stopped", () => {
    const ride = resolutionOn(BARRIER_TYPES.TRANSPORTATION, "NEEDS_UNSUPPORTED");
    const task = careTeamAssistanceRequest({ resolution: ride, patientId: "patient_demo", reason: "ACCESSIBLE_TRANSPORT_REQUIRED", priority: "PRIORITY" });
    expect(task.type).toBe("APPOINTMENT_BARRIER");
    expect(task.barrierType).toBe(BARRIER_TYPES.TRANSPORTATION);
    expect(task.appointmentId).toBe("appt-1");
    expect(task.patientId).toBe("patient_demo");
    expect(task.reason).toBe("ACCESSIBLE_TRANSPORT_REQUIRED");
    expect(task.priority).toBe("PRIORITY");
    expect(task.status).toBe("OPEN");
    expect(task.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("defaults a task to routine rather than to urgent", () => {
    expect(careTeamAssistanceRequest({ resolution: resolutionOn(BARRIER_TYPES.OTHER, "ESCALATE_OFFER") }).priority).toBe("ROUTINE");
    expect(careTeamAssistanceRequest({ priority: "SCREAMING" }).priority).toBe("ROUTINE");
  });
});

describe("what EMMI says", () => {
  it("speaks in short, calm, action-oriented sentences in all three languages", () => {
    for (const key of ["TRANSPORTATION_OFFER", "COMPANION_OFFER", "CARE_TEAM_OFFER", "ALL_SET", "VIDEO_READY"]) {
      for (const locale of ["en", "es", "ht"]) {
        const line = resolutionSpeech(key, locale);
        expect(line, `${key}:${locale}`).toBeTruthy();
        // §16: no paragraphs, and no vocabulary a patient would have to decode.
        expect(line.length, `${key}:${locale}`).toBeLessThan(180);
        expect(line, `${key}:${locale}`).not.toMatch(/barrier|resolution|processed|status|escalat|workflow/i);
      }
    }
    expect(resolutionSpeech("NOT_A_KEY", "en")).toBe("");
  });
});
