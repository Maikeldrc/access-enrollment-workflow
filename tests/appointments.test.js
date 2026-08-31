import { describe, expect, it } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  APPOINTMENT_ACTIONS,
  APPOINTMENT_ACTORS,
  APPOINTMENT_AUDIT_EVENTS,
  APPOINTMENT_DRAFT_FIELDS,
  APPOINTMENT_MODALITY,
  APPOINTMENT_REASON_CATEGORIES,
  APPOINTMENT_SOURCES,
  APPOINTMENT_STATUS,
  APPOINTMENT_URGENCY,
  TIME_OF_DAY,
  advanceAppointment,
  appointmentAnalytics,
  appointmentCareTeamSummary,
  appointmentIdempotencyKey,
  appointmentIsOpen,
  appointmentNextStep,
  appointmentPatientStatus,
  appointmentPreferenceResumeStep,
  appointmentStatusTone,
  applyBookingConfirmation,
  beginAppointmentPreferences,
  canActOnAppointment,
  canAdvanceAppointment,
  createAppointmentDraft,
  createAppointmentNeed,
  draftIsSubmittable,
  findByIdempotencyKey,
  findDuplicateAppointmentNeed,
  findUpcomingAppointmentWithProvider,
  localAppointmentText,
  pastAppointments,
  pendingRequests,
  resolveAppointmentActor,
  restoreAppointment,
  serializeAppointmentDraft,
  serializeAppointmentForDraft,
  updateAppointmentDraft,
  upcomingAppointments
} from "../src/appointments.js";

const NOW = "2026-08-27T12:00:00.000Z";
const inDays = days => new Date(new Date(NOW).getTime() + days * 24 * 60 * 60 * 1000).toISOString();

const need = (overrides = {}) => createAppointmentNeed({
  id: "appointment_1",
  patientId: "patient_demo",
  source: APPOINTMENT_SOURCES.EMMI_CONVERSATION,
  reasonCategory: APPOINTMENT_REASON_CATEGORIES.BLOOD_PRESSURE_FOLLOW_UP,
  reasonSummary: "My readings have been higher this week",
  requestedProfessionalId: "dr-fresner",
  providerDisplayName: "Dr. Fresner",
  now: NOW,
  ...overrides
});

// Walks a record forward through a list of statuses, asserting each hop was legal.
const walk = (appointment, statuses) => statuses.reduce((current, status) => {
  const next = advanceAppointment(current, { status, source: "TEST", actor: APPOINTMENT_ACTORS.PATIENT, at: NOW });
  expect(next.status).toBe(status);
  return next;
}, appointment);

describe("the appointment record", () => {
  it("starts as a need with nothing booked and nothing claimed", () => {
    const record = need();
    expect(record).toMatchObject({
      status: APPOINTMENT_STATUS.NEED_IDENTIFIED,
      scheduledAt: "",
      scheduledEndAt: "",
      confirmationNumber: "",
      joinUrl: "",
      locationAddress: "",
      modality: "",
      timezone: "",
      urgencyClassification: APPOINTMENT_URGENCY.ROUTINE,
      preferredModality: APPOINTMENT_MODALITY.NO_PREFERENCE,
      preferredTimeOfDay: TIME_OF_DAY.NO_PREFERENCE
    });
    expect(record.events).toHaveLength(1);
    expect(record.prep).toEqual({ topics: [], notes: "", sharedWithProvider: false, updatedAt: "" });
    expect(record.reminder).toBeNull();
    expect(record.sharedWith).toEqual([]);
  });

  it("is frozen, so nothing can promote a request into a confirmation by assignment", () => {
    const record = need();
    expect(Object.isFrozen(record)).toBe(true);
    expect(() => { record.status = APPOINTMENT_STATUS.CONFIRMED; }).toThrow();
    expect(record.status).toBe(APPOINTMENT_STATUS.NEED_IDENTIFIED);
  });

  it("bounds the patient's own words the way a barrier description is bounded", () => {
    expect(need({ reasonSummary: "x".repeat(600) }).reasonSummary).toHaveLength(400);
  });

  it("falls back to safe defaults when handed an enum value it does not know", () => {
    const record = need({ source: "MADE_UP", reasonCategory: "MADE_UP", urgencyClassification: "MADE_UP", status: "MADE_UP" });
    expect(record.source).toBe(APPOINTMENT_SOURCES.PATIENT_DIRECT_REQUEST);
    expect(record.reasonCategory).toBe(APPOINTMENT_REASON_CATEGORIES.OTHER);
    expect(record.urgencyClassification).toBe(APPOINTMENT_URGENCY.ROUTINE);
    expect(record.status).toBe(APPOINTMENT_STATUS.NEED_IDENTIFIED);
  });

  it("keeps every enum key equal to its value", () => {
    [APPOINTMENT_SOURCES, APPOINTMENT_STATUS, APPOINTMENT_MODALITY, APPOINTMENT_URGENCY, TIME_OF_DAY, APPOINTMENT_ACTORS, APPOINTMENT_REASON_CATEGORIES, APPOINTMENT_ACTIONS].forEach(table => {
      Object.entries(table).forEach(([key, value]) => expect(value).toBe(key));
      expect(Object.isFrozen(table)).toBe(true);
    });
  });
});

describe("the status machine", () => {
  it("names every status as a source and only ever targets a real status", () => {
    Object.values(APPOINTMENT_STATUS).forEach(status => expect(ALLOWED_TRANSITIONS[status]).toBeDefined());
    Object.values(ALLOWED_TRANSITIONS).flat().forEach(status => expect(APPOINTMENT_STATUS[status]).toBe(status));
  });

  it("walks the direct-booking path from need to confirmed", () => {
    const confirmed = walk(need(), [
      APPOINTMENT_STATUS.DRAFT,
      APPOINTMENT_STATUS.COLLECTING_PREFERENCES,
      APPOINTMENT_STATUS.SEARCHING_AVAILABILITY,
      APPOINTMENT_STATUS.SLOTS_AVAILABLE,
      APPOINTMENT_STATUS.PENDING_PATIENT_SELECTION,
      APPOINTMENT_STATUS.BOOKING,
      APPOINTMENT_STATUS.CONFIRMED
    ]);
    expect(confirmed.confirmedAt).toBe(NOW);
    expect(confirmed.events).toHaveLength(8);
  });

  it("enters preference collection through DRAFT for a newly identified need", () => {
    const collecting = beginAppointmentPreferences(need(), { actor: APPOINTMENT_ACTORS.PATIENT, at: NOW });
    expect(collecting.status).toBe(APPOINTMENT_STATUS.COLLECTING_PREFERENCES);
    expect(collecting.events.map(event => event.status)).toEqual([
      APPOINTMENT_STATUS.NEED_IDENTIFIED,
      APPOINTMENT_STATUS.DRAFT,
      APPOINTMENT_STATUS.COLLECTING_PREFERENCES
    ]);
  });

  it("walks the structured-request path from preferences to confirmed", () => {
    const confirmed = walk(need(), [
      APPOINTMENT_STATUS.DRAFT,
      APPOINTMENT_STATUS.COLLECTING_PREFERENCES,
      APPOINTMENT_STATUS.REQUEST_SENT,
      APPOINTMENT_STATUS.WAITING_FOR_OFFICE,
      APPOINTMENT_STATUS.PROPOSED_TIME,
      APPOINTMENT_STATUS.CONFIRMED
    ]);
    expect(confirmed.requestSentAt).toBe(NOW);
    expect(confirmed.confirmedAt).toBe(NOW);
  });

  it("sends a failed booking back to the times still on offer and never to confirmed", () => {
    const booking = walk(need(), [
      APPOINTMENT_STATUS.DRAFT,
      APPOINTMENT_STATUS.COLLECTING_PREFERENCES,
      APPOINTMENT_STATUS.SEARCHING_AVAILABILITY,
      APPOINTMENT_STATUS.SLOTS_AVAILABLE,
      APPOINTMENT_STATUS.PENDING_PATIENT_SELECTION,
      APPOINTMENT_STATUS.BOOKING
    ]);
    expect(ALLOWED_TRANSITIONS[APPOINTMENT_STATUS.BOOKING]).toEqual([APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.SLOTS_AVAILABLE, APPOINTMENT_STATUS.UNABLE_TO_SCHEDULE]);
    const failed = advanceAppointment(booking, { status: APPOINTMENT_STATUS.SLOTS_AVAILABLE, at: NOW });
    expect(failed.status).toBe(APPOINTMENT_STATUS.SLOTS_AVAILABLE);
    expect(failed.confirmedAt).toBe("");
    expect(failed.confirmationNumber).toBe("");
  });

  it("refuses to reach confirmed from anywhere the office has not spoken", () => {
    const reachesConfirmed = Object.entries(ALLOWED_TRANSITIONS)
      .filter(([, targets]) => targets.includes(APPOINTMENT_STATUS.CONFIRMED))
      .map(([status]) => status)
      .sort();
    expect(reachesConfirmed).toEqual([
      APPOINTMENT_STATUS.BOOKING,
      APPOINTMENT_STATUS.CANCEL_REQUESTED,
      APPOINTMENT_STATUS.PROPOSED_TIME,
      APPOINTMENT_STATUS.RESCHEDULE_REQUESTED,
      APPOINTMENT_STATUS.WAITING_FOR_OFFICE
    ].sort());
  });

  it("returns the unchanged record on an illegal transition", () => {
    const record = need();
    const illegal = advanceAppointment(record, { status: APPOINTMENT_STATUS.CONFIRMED, at: NOW });
    expect(illegal).toBe(record);
    expect(illegal.status).toBe(APPOINTMENT_STATUS.NEED_IDENTIFIED);
    expect(illegal.events).toHaveLength(1);
  });

  it("refuses every illegal hop out of every status", () => {
    Object.values(APPOINTMENT_STATUS).forEach(from => {
      const record = { ...need(), status: from };
      Object.values(APPOINTMENT_STATUS)
        .filter(to => !ALLOWED_TRANSITIONS[from].includes(to))
        .forEach(to => {
          expect(canAdvanceAppointment(record, to)).toBe(false);
          expect(advanceAppointment(record, { status: to, at: NOW })).toBe(record);
        });
    });
  });

  it("treats a rapid double-call as one transition", () => {
    const draft = advanceAppointment(need(), { status: APPOINTMENT_STATUS.DRAFT, at: NOW });
    const again = advanceAppointment(draft, { status: APPOINTMENT_STATUS.DRAFT, at: NOW });
    expect(again).toBe(draft);
    expect(again.events).toHaveLength(2);
  });

  it("holds every terminal status closed", () => {
    [APPOINTMENT_STATUS.CANCELED, APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.NO_SHOW, APPOINTMENT_STATUS.DECLINED].forEach(status => {
      expect(ALLOWED_TRANSITIONS[status]).toEqual([]);
      const record = { ...need(), status };
      expect(appointmentIsOpen(record)).toBe(false);
      Object.values(APPOINTMENT_STATUS).forEach(to => expect(canAdvanceAppointment(record, to)).toBe(false));
    });
  });

  it("keeps a reschedule request from cancelling the appointment the patient still has", () => {
    const confirmed = { ...need(), status: APPOINTMENT_STATUS.CONFIRMED, scheduledAt: inDays(3) };
    const requested = advanceAppointment(confirmed, { status: APPOINTMENT_STATUS.RESCHEDULE_REQUESTED, at: NOW });
    expect(requested.status).toBe(APPOINTMENT_STATUS.RESCHEDULE_REQUESTED);
    expect(requested.canceledAt).toBe("");
    expect(requested.scheduledAt).toBe(confirmed.scheduledAt);
  });

  it("leaves an appointment standing when a cancellation was never confirmed", () => {
    const confirmed = { ...need(), status: APPOINTMENT_STATUS.CONFIRMED };
    const requested = advanceAppointment(confirmed, { status: APPOINTMENT_STATUS.CANCEL_REQUESTED, at: NOW });
    expect(requested.canceledAt).toBe("");
    const kept = advanceAppointment(requested, { status: APPOINTMENT_STATUS.CONFIRMED, at: NOW });
    expect(kept.status).toBe(APPOINTMENT_STATUS.CONFIRMED);
    const canceled = advanceAppointment(requested, { status: APPOINTMENT_STATUS.CANCELED, at: NOW });
    expect(canceled.canceledAt).toBe(NOW);
    expect(canceled.resolvedAt).toBe(NOW);
  });

  it("stamps a timestamp once, on the first time that status is reached", () => {
    const first = advanceAppointment({ ...need(), status: APPOINTMENT_STATUS.WAITING_FOR_OFFICE }, { status: APPOINTMENT_STATUS.CONFIRMED, at: NOW });
    const moved = advanceAppointment(first, { status: APPOINTMENT_STATUS.CANCEL_REQUESTED, at: inDays(1) });
    const back = advanceAppointment(moved, { status: APPOINTMENT_STATUS.CONFIRMED, at: inDays(2) });
    expect(back.confirmedAt).toBe(NOW);
  });

  it("records who acted on every event", () => {
    const advanced = advanceAppointment(need(), { status: APPOINTMENT_STATUS.DRAFT, source: "EMMI", actor: APPOINTMENT_ACTORS.EMMI_ASSISTED_PATIENT, at: NOW, detail: { note: "kept" } });
    expect(advanced.events.at(-1)).toEqual({ status: APPOINTMENT_STATUS.DRAFT, source: "EMMI", actor: APPOINTMENT_ACTORS.EMMI_ASSISTED_PATIENT, at: NOW, detail: { note: "kept" } });
  });

  it("carries confirmation details only when the confirmation carried them", () => {
    const booking = { ...need(), status: APPOINTMENT_STATUS.BOOKING };
    const confirmed = applyBookingConfirmation(booking, { confirmationNumber: "ITERA-ABC1234", scheduledAt: inDays(4), scheduledEndAt: inDays(4), modality: APPOINTMENT_MODALITY.IN_PERSON, locationName: "Fresner Medical Group", at: NOW });
    expect(confirmed).toMatchObject({ status: APPOINTMENT_STATUS.CONFIRMED, confirmationNumber: "ITERA-ABC1234", locationName: "Fresner Medical Group" });
    // Nothing invented a link or an address the booking result did not carry.
    expect(confirmed.joinUrl).toBe("");
    expect(confirmed.locationAddress).toBe("");
  });

  it("will not apply a confirmation to a record that is not being booked", () => {
    const record = need();
    expect(applyBookingConfirmation(record, { confirmationNumber: "ITERA-NOPE", at: NOW })).toBe(record);
  });
});

describe("what the patient reads", () => {
  it("never shows an internal status and speaks all three languages", () => {
    Object.values(APPOINTMENT_STATUS).forEach(status => {
      const record = { ...need(), status };
      ["en", "es", "ht"].forEach(locale => {
        const text = appointmentPatientStatus(record, locale);
        expect(text).toBeTruthy();
        expect(text).not.toBe(status);
        expect(text).not.toMatch(/[A-Z]{4,}_/);
      });
      expect(appointmentPatientStatus(record, "es")).not.toBe(appointmentPatientStatus(record, "ht"));
    });
  });

  it("says what the patient does next only when there is something to do", () => {
    expect(appointmentNextStep({ ...need(), status: APPOINTMENT_STATUS.SLOTS_AVAILABLE }, "es")).toBe("Elija una de las horas de abajo.");
    expect(appointmentNextStep({ ...need(), status: APPOINTMENT_STATUS.WAITING_FOR_OFFICE }, "ht")).toBe("EMMI ap fè w konnen lè biwo a reponn.");
    expect(appointmentNextStep({ ...need(), status: APPOINTMENT_STATUS.CONFIRMED }, "en")).toBe("");
    expect(appointmentNextStep({ ...need(), status: APPOINTMENT_STATUS.COMPLETED }, "en")).toBe("");
  });

  it("gives every status a tone for styling, never for meaning on its own", () => {
    const tones = new Set(Object.values(APPOINTMENT_STATUS).map(status => appointmentStatusTone({ ...need(), status })));
    expect([...tones].sort()).toEqual(["ACTION_NEEDED", "CLOSED", "CONFIRMED", "PROBLEM", "WAITING"]);
    expect(appointmentStatusTone({ ...need(), status: APPOINTMENT_STATUS.CONFIRMED })).toBe("CONFIRMED");
    expect(appointmentStatusTone({ ...need(), status: APPOINTMENT_STATUS.REQUEST_SENT })).toBe("WAITING");
    expect(appointmentStatusTone({ ...need(), status: APPOINTMENT_STATUS.UNABLE_TO_SCHEDULE })).toBe("PROBLEM");
  });

  it("falls back through locale to English rather than showing nothing", () => {
    expect(localAppointmentText({ en: "Confirmed" }, "ht")).toBe("Confirmed");
    expect(localAppointmentText("already a string", "es")).toBe("already a string");
    expect(localAppointmentText(null, "es")).toBe("");
  });
});

describe("queries", () => {
  const confirmed = { ...need({ id: "a1" }), status: APPOINTMENT_STATUS.CONFIRMED, scheduledAt: inDays(3) };
  const soon = { ...need({ id: "a2", requestedProfessionalId: "dr-martinez-cardiology" }), status: APPOINTMENT_STATUS.CONFIRMED, scheduledAt: inDays(1) };
  const requested = { ...need({ id: "a3" }), status: APPOINTMENT_STATUS.WAITING_FOR_OFFICE };
  const finished = { ...need({ id: "a4" }), status: APPOINTMENT_STATUS.COMPLETED, scheduledAt: inDays(-5) };
  const canceled = { ...need({ id: "a5" }), status: APPOINTMENT_STATUS.CANCELED };
  const all = [confirmed, soon, requested, finished, canceled];

  it("sorts upcoming care by when it actually is", () => {
    expect(upcomingAppointments(all, NOW).map(item => item.id)).toEqual(["a2", "a1"]);
  });

  it("never treats a request with no time as upcoming care", () => {
    expect(upcomingAppointments([requested], NOW)).toEqual([]);
  });

  it("lists what the patient is waiting on", () => {
    expect(pendingRequests(all).map(item => item.id)).toEqual(["a3"]);
  });

  it("puts finished, missed and canceled visits in the past, most recent first", () => {
    // A cancellation with no time falls back to when it happened, which is why it sorts above a
    // visit that was completed five days ago.
    expect(pastAppointments(all, NOW).map(item => item.id)).toEqual(["a5", "a4"]);
  });

  it("finds the upcoming appointment a patient already has with a provider", () => {
    expect(findUpcomingAppointmentWithProvider(all, "dr-martinez-cardiology", NOW).id).toBe("a2");
    expect(findUpcomingAppointmentWithProvider(all, "dr-nobody", NOW)).toBeNull();
    expect(findUpcomingAppointmentWithProvider(all, "", NOW)).toBeNull();
  });
});

describe("duplicates and idempotency", () => {
  const open = need({ id: "a1", requestedProfessionalId: "dr-fresner", reasonCategory: APPOINTMENT_REASON_CATEGORIES.MEDICATION_RENEWAL });

  it("finds an open need for the same provider and reason before making a second one", () => {
    expect(findDuplicateAppointmentNeed([open], { requestedProfessionalId: "dr-fresner", reasonCategory: APPOINTMENT_REASON_CATEGORIES.MEDICATION_RENEWAL }).id).toBe("a1");
    expect(findDuplicateAppointmentNeed([open], { requestedProfessionalId: "dr-fresner" }).id).toBe("a1");
    expect(findDuplicateAppointmentNeed([open], { requestedProfessionalId: "dr-fresner", reasonCategory: APPOINTMENT_REASON_CATEGORIES.NEW_CONCERN })).toBeNull();
    expect(findDuplicateAppointmentNeed([open], { requestedProfessionalId: "dr-other" })).toBeNull();
  });

  it("does not count a closed need as a duplicate", () => {
    const closed = { ...open, status: APPOINTMENT_STATUS.CANCELED };
    expect(findDuplicateAppointmentNeed([closed], { requestedProfessionalId: "dr-fresner" })).toBeNull();
  });

  it("returns nothing when asked with nothing", () => {
    expect(findDuplicateAppointmentNeed([open], {})).toBeNull();
  });

  it("derives a stable key from what the request is about, never from when it was made", () => {
    const first = appointmentIdempotencyKey({ patientId: "p1", providerId: "dr-fresner", slotId: "slot-a", action: "BOOK" });
    const second = appointmentIdempotencyKey({ patientId: "p1", providerId: "dr-fresner", slotId: "slot-a", action: "BOOK" });
    expect(first).toBe(second);
    expect(first).not.toBe(appointmentIdempotencyKey({ patientId: "p1", providerId: "dr-fresner", slotId: "slot-b", action: "BOOK" }));
    expect(first).not.toBe(appointmentIdempotencyKey({ patientId: "p1", providerId: "dr-fresner", slotId: "slot-a", action: "CANCEL" }));
    expect(appointmentIdempotencyKey({ patientId: "p1", providerId: "dr-fresner", action: "NONSENSE" })).toContain(":REQUEST");
  });

  it("finds the record a repeated call already produced", () => {
    const key = appointmentIdempotencyKey({ patientId: "p1", providerId: "dr-fresner", action: "REQUEST" });
    const record = need({ idempotencyKey: key });
    expect(findByIdempotencyKey([record], key).id).toBe(record.id);
    expect(findByIdempotencyKey([record], "other")).toBeNull();
    expect(findByIdempotencyKey([record], "")).toBeNull();
  });
});

describe("the draft", () => {
  it("keeps only the fields a draft is allowed to hold", () => {
    const draft = createAppointmentDraft({ requestedProfessionalId: "dr-fresner", reasonCategory: "OTHER", scheduledAt: "2026-09-08T14:30:00.000Z", confirmationNumber: "ITERA-FAKE", now: NOW });
    expect(draft.requestedProfessionalId).toBe("dr-fresner");
    expect(draft).not.toHaveProperty("scheduledAt");
    expect(draft).not.toHaveProperty("confirmationNumber");
    expect(APPOINTMENT_DRAFT_FIELDS).not.toContain("scheduledAt");
  });

  it("applies a patch through the same whitelist", () => {
    const draft = createAppointmentDraft({ now: NOW });
    const patched = updateAppointmentDraft(draft, { preferredTimeOfDay: TIME_OF_DAY.MORNING, selectedSlotId: "slot-a", status: APPOINTMENT_STATUS.CONFIRMED, step: "TIME", now: NOW });
    expect(patched).toMatchObject({ preferredTimeOfDay: TIME_OF_DAY.MORNING, selectedSlotId: "slot-a", step: "TIME" });
    expect(patched).not.toHaveProperty("status");
    expect(updateAppointmentDraft(draft, { reasonSummary: "y".repeat(500) }).reasonSummary).toHaveLength(400);
  });

  it("gates the submit button and never submits anything itself", () => {
    const empty = createAppointmentDraft({ now: NOW });
    expect(draftIsSubmittable(empty)).toEqual({ ok: false, missing: ["requestedProfessionalId", "reasonCategory"] });
    const partial = updateAppointmentDraft(empty, { requestedSpecialty: "Cardiology", now: NOW });
    expect(draftIsSubmittable(partial)).toEqual({ ok: false, missing: ["reasonCategory"] });
    const ready = updateAppointmentDraft(partial, { reasonSummary: "I want to talk about my readings", now: NOW });
    expect(draftIsSubmittable(ready)).toEqual({ ok: true, missing: [] });
    expect(draftIsSubmittable(null).ok).toBe(false);
  });

  it("resumes an EMMI-created request at provider when no real professional was selected", () => {
    const emmiNeed = createAppointmentDraft({
      needId: "emmi-need",
      requestedProfessionalType: "UNKNOWN",
      reasonCategory: "OTHER"
    });

    expect(appointmentPreferenceResumeStep(emmiNeed, "REASON")).toBe("PROVIDER");
    expect(appointmentPreferenceResumeStep(emmiNeed, "REVIEW")).toBe("PROVIDER");
    expect(draftIsSubmittable(emmiNeed)).toEqual({ ok: false, missing: ["requestedProfessionalId"] });
  });

  it("keeps a genuinely partial request on its first missing required step", () => {
    const providerOnly = createAppointmentDraft({ needId: "partial", requestedProfessionalId: "dr-fresner" });
    expect(appointmentPreferenceResumeStep(providerOnly, "REVIEW")).toBe("REASON");
    expect(appointmentPreferenceResumeStep({ ...providerOnly, reasonCategory: "ROUTINE_FOLLOW_UP" }, "MODALITY")).toBe("MODALITY");
  });

  it("serialises a draft and a record to plain objects for persistence", () => {
    const draft = createAppointmentDraft({ requestedProfessionalId: "dr-fresner", now: NOW });
    const storedDraft = serializeAppointmentDraft(draft);
    expect(Object.isFrozen(storedDraft)).toBe(false);
    expect(JSON.parse(JSON.stringify(storedDraft)).requestedProfessionalId).toBe("dr-fresner");
    expect(serializeAppointmentDraft(null)).toBeNull();

    const record = advanceAppointment(need(), { status: APPOINTMENT_STATUS.DRAFT, at: NOW });
    const stored = serializeAppointmentForDraft(record);
    expect(Object.isFrozen(stored)).toBe(false);
    expect(stored.events).toHaveLength(2);
    expect(serializeAppointmentForDraft(null)).toBeNull();
  });

  it("restores a stored record to the frozen shape without losing its history", () => {
    const record = advanceAppointment(need(), { status: APPOINTMENT_STATUS.DRAFT, at: NOW });
    const restored = restoreAppointment(JSON.parse(JSON.stringify(serializeAppointmentForDraft(record))));
    expect(Object.isFrozen(restored)).toBe(true);
    expect(restored.status).toBe(APPOINTMENT_STATUS.DRAFT);
    expect(restored.events).toHaveLength(2);
    expect(restored.reasonSummary).toBe(record.reasonSummary);
    expect(restoreAppointment(null)).toBeNull();
  });
});

describe("the care-team summary", () => {
  const record = need({ requestedProfessionalType: "PRESCRIBER", requestedSpecialty: "Cardiology", preferredTimeOfDay: TIME_OF_DAY.MORNING, preferredModality: APPOINTMENT_MODALITY.IN_PERSON });

  it("carries what a scheduler needs and no transcript", () => {
    const summary = appointmentCareTeamSummary(record, { patientLabel: "John S.", knownBarriers: [{ category: "TRANSPORTATION", patientDescription: "my son drives me" }, "TIME_ROUTINE", { category: "TRANSPORTATION" }], contactPreference: "PHONE" });
    expect(summary).toMatchObject({
      patient: "John S.",
      requestedProfessional: "Dr. Fresner",
      requestedProfessionalType: "PRESCRIBER",
      specialty: "Cardiology",
      reasonCategory: APPOINTMENT_REASON_CATEGORIES.BLOOD_PRESSURE_FOLLOW_UP,
      preferredModality: APPOINTMENT_MODALITY.IN_PERSON,
      preferredTiming: "MORNING",
      knownBarriers: ["TRANSPORTATION", "TIME_ROUTINE"],
      contactPreference: "PHONE",
      needId: "appointment_1",
      urgencyClassification: APPOINTMENT_URGENCY.ROUTINE
    });
    expect(JSON.stringify(summary)).not.toContain("my son drives me");
  });

  it("preserves the back-compat keys the existing care-team tasks are read by", () => {
    const summary = appointmentCareTeamSummary(record, {});
    expect(summary.appointmentStatus).toBe("NOT_SCHEDULED");
    expect(summary.patientPreferredTime).toBe("MORNING");
    expect(appointmentCareTeamSummary({ ...record, preferredTimeOfDay: TIME_OF_DAY.NO_PREFERENCE }, {}).patientPreferredTime).toBe("");
    expect(appointmentCareTeamSummary({ ...record, status: APPOINTMENT_STATUS.CONFIRMED }, {}).appointmentStatus).toBe("SCHEDULED");
    expect(appointmentCareTeamSummary({ ...record, status: APPOINTMENT_STATUS.CANCELED }, {}).appointmentStatus).toBe("CANCELED");
    expect(appointmentCareTeamSummary({ ...record, status: APPOINTMENT_STATUS.WAITING_FOR_OFFICE }, {}).appointmentStatus).toBe("NOT_SCHEDULED");
  });

  it("returns nothing for nothing", () => {
    expect(appointmentCareTeamSummary(null, {})).toBeNull();
  });
});

describe("authorization", () => {
  it("resolves who is acting from the state the shell already keeps", () => {
    expect(resolveAppointmentActor({ completionRole: "patient" })).toBe(APPOINTMENT_ACTORS.PATIENT);
    expect(resolveAppointmentActor({ completionRole: "patient", viaEmmi: true })).toBe(APPOINTMENT_ACTORS.EMMI_ASSISTED_PATIENT);
    expect(resolveAppointmentActor({ completionRole: "representative" })).toBe(APPOINTMENT_ACTORS.PERSONAL_REPRESENTATIVE);
    expect(resolveAppointmentActor({ role: "care_team" })).toBe(APPOINTMENT_ACTORS.CARE_TEAM);
    expect(resolveAppointmentActor({ role: "system" })).toBe(APPOINTMENT_ACTORS.SYSTEM);
    expect(resolveAppointmentActor({ role: "care_circle" })).toBe("");
    expect(resolveAppointmentActor({})).toBe("");
  });

  // Five actors, seven actions. Written out rather than computed, so a change to the rules has to
  // be a change to the table someone can read.
  const MATRIX = {
    PATIENT: { VIEW: true, CREATE: true, BOOK: true, RESCHEDULE: true, CANCEL: true, SHARE: true, REMIND: true },
    EMMI_ASSISTED_PATIENT: { VIEW: true, CREATE: true, BOOK: true, RESCHEDULE: true, CANCEL: true, SHARE: true, REMIND: true },
    PERSONAL_REPRESENTATIVE: { VIEW: true, CREATE: true, BOOK: true, RESCHEDULE: true, CANCEL: true, SHARE: true, REMIND: true },
    CARE_TEAM: { VIEW: true, CREATE: true, BOOK: true, RESCHEDULE: true, CANCEL: true, SHARE: false, REMIND: true },
    SYSTEM: { VIEW: true, CREATE: true, BOOK: false, RESCHEDULE: false, CANCEL: false, SHARE: false, REMIND: true }
  };

  it("answers for every actor and every action", () => {
    Object.entries(MATRIX).forEach(([actor, actions]) => {
      Object.entries(actions).forEach(([action, allowed]) => {
        const verdict = canActOnAppointment({ actor, action, identityVerified: true });
        expect({ actor, action, allowed: verdict.allowed }).toEqual({ actor, action, allowed });
        expect(verdict.reason).toBeTruthy();
      });
    });
  });

  it("lets a personal representative act only when their identity was verified", () => {
    Object.values(APPOINTMENT_ACTIONS).forEach(action => {
      expect(canActOnAppointment({ actor: APPOINTMENT_ACTORS.PERSONAL_REPRESENTATIVE, action, identityVerified: false })).toEqual({ allowed: false, reason: "IDENTITY_VERIFICATION_REQUIRED" });
      expect(canActOnAppointment({ actor: APPOINTMENT_ACTORS.PERSONAL_REPRESENTATIVE, action, identityVerified: true }).allowed).toBe(true);
    });
  });

  it("never lets a Care Circle member cancel or reschedule, however the permission is set", () => {
    [{ actingAsCareCircle: true, helpWithAppointments: true }, { actingAsCareCircle: true, helpWithAppointments: false }].forEach(careCirclePermissions => {
      [APPOINTMENT_ACTIONS.CANCEL, APPOINTMENT_ACTIONS.RESCHEDULE].forEach(action => {
        expect(canActOnAppointment({ actor: APPOINTMENT_ACTORS.PATIENT, action, identityVerified: true, careCirclePermissions })).toEqual({ allowed: false, reason: "CARE_CIRCLE_CANNOT_ACT" });
      });
    });
  });

  it("lets a Care Circle member look and remind only when the patient granted it", () => {
    const granted = { actingAsCareCircle: true, helpWithAppointments: true };
    expect(canActOnAppointment({ actor: "", action: APPOINTMENT_ACTIONS.VIEW, careCirclePermissions: granted })).toEqual({ allowed: true, reason: "CARE_CIRCLE_PERMISSION_GRANTED" });
    expect(canActOnAppointment({ actor: "", action: APPOINTMENT_ACTIONS.REMIND, careCirclePermissions: granted }).allowed).toBe(true);
    expect(canActOnAppointment({ actor: "", action: APPOINTMENT_ACTIONS.VIEW, careCirclePermissions: { actingAsCareCircle: true } })).toEqual({ allowed: false, reason: "CARE_CIRCLE_PERMISSION_REQUIRED" });
    expect(canActOnAppointment({ actor: "", action: APPOINTMENT_ACTIONS.BOOK, careCirclePermissions: granted }).allowed).toBe(false);
    expect(canActOnAppointment({ actor: "", action: APPOINTMENT_ACTIONS.SHARE, careCirclePermissions: granted }).allowed).toBe(false);
  });

  it("denies an actor it does not recognise and an action it does not recognise", () => {
    Object.values(APPOINTMENT_ACTIONS).forEach(action => {
      expect(canActOnAppointment({ actor: "SOMEONE_ELSE", action })).toEqual({ allowed: false, reason: "UNKNOWN_ACTOR" });
      expect(canActOnAppointment({ action })).toEqual({ allowed: false, reason: "UNKNOWN_ACTOR" });
    });
    expect(canActOnAppointment({ actor: APPOINTMENT_ACTORS.PATIENT, action: "DELETE_EVERYTHING" })).toEqual({ allowed: false, reason: "UNKNOWN_ACTION" });
    expect(canActOnAppointment({})).toEqual({ allowed: false, reason: "UNKNOWN_ACTION" });
  });
});

describe("audit and analytics", () => {
  it("names every audit event the flow can emit", () => {
    expect(Object.keys(APPOINTMENT_AUDIT_EVENTS)).toHaveLength(15);
    Object.values(APPOINTMENT_AUDIT_EVENTS).forEach(value => expect(value).toMatch(/^appointment_[a-z_]+$/));
  });

  // The allow-list, asserted exactly. Adding a key here is a decision about what the product knows
  // about a patient outside their record, and it has to be made on purpose.
  it("emits exactly the allowed keys and nothing else", () => {
    const record = {
      ...need(),
      status: APPOINTMENT_STATUS.CONFIRMED,
      schedulingCapability: "DIRECT_BOOKING",
      modality: APPOINTMENT_MODALITY.IN_PERSON,
      scheduledAt: inDays(6),
      practiceName: "Fresner Medical Group",
      locationAddress: "123 Main Street",
      joinUrl: "https://example.invalid/visit",
      confirmationNumber: "ITERA-ABC1234"
    };
    const analytics = appointmentAnalytics(record, { now: NOW });
    expect(Object.keys(analytics).sort()).toEqual([
      "actor", "daysUntil", "hasProvider", "modality", "needId", "reasonCategory", "schedulingCapability", "source", "status", "urgencyClassification"
    ]);
    expect(analytics).toMatchObject({ needId: "appointment_1", hasProvider: true, daysUntil: 6, status: APPOINTMENT_STATUS.CONFIRMED, actor: APPOINTMENT_ACTORS.PATIENT });
  });

  it("never emits a name, a place, a link, a time or anything the patient typed", () => {
    const record = {
      ...need({ reasonSummary: "chest feels tight when I climb the stairs" }),
      providerDisplayName: "Dr. Fresner",
      practiceName: "Fresner Medical Group",
      locationAddress: "123 Main Street",
      joinUrl: "https://example.invalid/visit",
      scheduledAt: inDays(2)
    };
    const analytics = appointmentAnalytics(record, { now: NOW });
    ["reasonSummary", "providerDisplayName", "practiceName", "locationAddress", "joinUrl", "scheduledAt", "confirmationNumber", "patientId", "locationName", "prep", "events"].forEach(key => {
      expect(analytics).not.toHaveProperty(key);
    });
    const serialised = JSON.stringify(analytics);
    ["chest feels tight", "Fresner", "123 Main Street", "example.invalid", "2026-08-29"].forEach(fragment => expect(serialised).not.toContain(fragment));
  });

  it("says how far away a visit is, not when it is, and nothing at all when there is no time", () => {
    expect(appointmentAnalytics({ ...need(), scheduledAt: inDays(10) }, { now: NOW }).daysUntil).toBe(10);
    expect(appointmentAnalytics(need(), { now: NOW }).daysUntil).toBeNull();
    expect(appointmentAnalytics(null)).toEqual({});
  });
});
