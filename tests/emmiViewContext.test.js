import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import {
  CONFIRMATION_REQUIRED_KINDS, EMMI_VIEW_CONTEXT_VERSION, VIEW_ACTION_KINDS,
  describeEmmiViewFromDom, emmiViewForModel, emmiViewSignature, findViewAction, findViewOption,
  inferViewActionKind, normalizeEmmiView, viewControlSelector, withLiveControls
} from "../src/emmi/viewContext.js";
import { describeAppointmentView, describeResolutionView } from "../src/appointmentViewContext.js";
import { BARRIER_TYPES, RESOLUTION_STEPS, advanceResolution, appointmentReadiness, createResolution } from "../src/barrierResolution.js";

const dom = html => {
  const window = new JSDOM(`<body><div id="screen-content">${html}</div></body>`).window;
  // viewControlSelector uses CSS.escape, which jsdom provides on its own window rather than
  // globally. The shell runs in a browser where it is a global; the tests hand it the same shape.
  globalThis.CSS = window.CSS;
  return window.document.querySelector("#screen-content");
};

const appointment = (overrides = {}) => ({
  id: "appt-1",
  status: "CONFIRMED",
  scheduledAt: "2026-09-02T18:45:00.000Z",
  scheduledEndAt: "2026-09-02T19:15:00.000Z",
  timezone: "UTC",
  providerDisplayName: "Dr. Fresner Lee",
  locationName: "Fresner Medical Group",
  prep: { topics: [], medications: [] },
  ...overrides
});

const rideOption = (overrides = {}) => ({
  optionId: "STANDARD_1", rideType: "STANDARD", serviceName: "UberX", description: "Standard car",
  seats: 3, accessible: false, pickupAt: "2026-09-02T18:00:00.000Z",
  estimatedArrivalAt: "2026-09-02T18:25:00.000Z", estimatedCost: "$18.40", estimatedCostValue: 18.4,
  ...overrides
});

const resolutionOn = (barrierType, step, data = {}) =>
  advanceResolution(createResolution({ appointmentId: "appt-1", barrierType }), step, data);

const transportView = (step, data = {}, extras = {}) => describeResolutionView({
  resolution: resolutionOn(BARRIER_TYPES.TRANSPORTATION, step, data),
  appointment: appointment(),
  locale: "en",
  extras
});

describe("the view contract", () => {
  it("caps and cleans everything a describer hands it", () => {
    const view = normalizeEmmiView({
      viewId: "X".repeat(200),
      title: "  spaced   out  ",
      task: "T".repeat(500),
      options: Array.from({ length: 40 }, (_, index) => ({ id: `o${index}`, label: `option ${index}` })),
      facts: Array.from({ length: 40 }, (_, index) => ({ label: `f${index}`, value: "v" })),
      actions: Array.from({ length: 40 }, (_, index) => ({ id: `a${index}`, label: "act" }))
    });
    expect(view.viewId.length).toBeLessThanOrEqual(80);
    expect(view.title).toBe("spaced out");
    expect(view.task.length).toBeLessThanOrEqual(320);
    expect(view.options.length).toBeLessThanOrEqual(10);
    expect(view.facts.length).toBeLessThanOrEqual(12);
    // Raised from 12 with the goal-detail controls: the cap has to sit above the busiest screen
    // the product really has, or the description stops being the whole of what is on it.
    expect(view.actions.length).toBeLessThanOrEqual(16);
    expect(view.version).toBe(EMMI_VIEW_CONTEXT_VERSION);
  });

  it("numbers the choices so 'the first one' is addressable", () => {
    const view = normalizeEmmiView({ options: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }] });
    expect(view.options.map(option => option.ordinal)).toEqual([1, 2, 3]);
    expect(findViewOption(view, "2").id).toBe("b");
    expect(findViewOption(view, "c").id).toBe("c");
    expect(findViewOption(view, "9")).toBeNull();
    expect(findViewOption(view, "")).toBeNull();
  });

  it("never lets a selection become a completed action", () => {
    const view = normalizeEmmiView({ options: [{ id: "a", label: "A", selected: true }], completed: [] });
    expect(view.selection.id).toBe("a");
    expect(view.completed).toHaveLength(0);
    expect(emmiViewForModel(view).alreadyDone).toEqual([]);
  });

  it("defaults an unrecognised action to the kind that can do the least", () => {
    expect(normalizeEmmiView({ actions: [{ id: "x", label: "x", kind: "SUDO" }] }).actions[0].kind).toBe(VIEW_ACTION_KINDS.NAVIGATE);
    expect(CONFIRMATION_REQUIRED_KINDS).toEqual([VIEW_ACTION_KINDS.CONFIRM, VIEW_ACTION_KINDS.DESTRUCTIVE]);
  });

  it("changes signature on meaning, and not on a repaint", () => {
    const build = (extra = {}) => normalizeEmmiView({ viewId: "V", options: [{ id: "a", label: "A" }], ...extra });
    expect(emmiViewSignature(build())).toBe(emmiViewSignature(build()));
    expect(emmiViewSignature(build({ options: [{ id: "a", label: "A", selected: true }] }))).not.toBe(emmiViewSignature(build()));
    expect(emmiViewSignature(build({ completed: [{ id: "done", label: "Done" }] }))).not.toBe(emmiViewSignature(build()));
    expect(emmiViewSignature(build({ facts: [{ label: "Cost", value: "$18.40" }] }))).not.toBe(emmiViewSignature(build()));
    expect(emmiViewSignature(null)).toBe("");
  });

  it("keeps the selectors out of what the model reads", () => {
    const view = normalizeEmmiView({ options: [{ id: "a", label: "A", selector: "[data-x]" }], actions: [{ id: "go", label: "Go", selector: "[data-y]" }] });
    expect(JSON.stringify(emmiViewForModel(view))).not.toContain("data-x");
    expect(JSON.stringify(emmiViewForModel(view))).not.toContain("data-y");
  });

  it("tells the model which questions each field answers", () => {
    const shape = emmiViewForModel(normalizeEmmiView({ task: "Pick a ride.", options: [{ id: "a", label: "A" }], completed: [{ id: "c", label: "Booked" }], pending: [{ id: "p", label: "Confirm it" }] }));
    expect(shape.whatThePatientMustDoHere).toBe("Pick a ride.");
    expect(shape.choices[0].n).toBe(1);
    expect(shape.alreadyDone).toEqual(["Booked"]);
    expect(shape.stillPending).toEqual(["Confirm it"]);
  });
});

describe("the floor — a screen with no describer", () => {
  it("still gives EMMI the heading, the task and the controls that were rendered", () => {
    const root = dom(`
      <h1>Choose a ride</h1>
      <p class="appointment-lead">Pick one of the rides below.</p>
      <button type="button" data-action="barrier-option-select" data-option-id="STANDARD_1">UberX</button>
      <button type="button" data-action="barrier-reserve-confirm" data-resolution-id="r1">Book this ride</button>
    `);
    const view = describeEmmiViewFromDom(root, { screenId: "APPOINTMENT_DETAIL" });
    expect(view.title).toBe("Choose a ride");
    expect(view.task).toBe("Pick one of the rides below.");
    expect(view.actions.map(action => action.id)).toEqual(["barrier-option-select", "barrier-reserve-confirm"]);
    expect(describeEmmiViewFromDom(null)).toBeNull();
  });

  // The ACCESS welcome lays its copy out one span per visual line, so textContent ran the lines
  // together and EMMI was told the screen said "el modeloACCESS de Medicare". The aria-label is
  // the same words with the spaces a screen reader announces.
  it("reads a heading laid out in lines the way a screen reader would", () => {
    const root = dom(`
      <h1 aria-label="Su médico recomienda cuidado ACCESS"><span>Su médico</span><span>recomienda</span><span>cuidado ACCESS</span></h1>
      <p class="screen-lead" aria-label="Cuidado mediante el modelo ACCESS de Medicare"><span>Cuidado mediante el modelo</span><span>ACCESS de Medicare</span></p>
    `);
    const view = describeEmmiViewFromDom(root, { screenId: "INVITATION" });
    expect(view.title).toBe("Su médico recomienda cuidado ACCESS");
    expect(view.task).toBe("Cuidado mediante el modelo ACCESS de Medicare");
  });

  it("guesses the kind of an unknown control conservatively", () => {
    expect(inferViewActionKind("appointment-confirm-cancel")).toBe(VIEW_ACTION_KINDS.DESTRUCTIVE);
    expect(inferViewActionKind("barrier-reserve-confirm")).toBe(VIEW_ACTION_KINDS.CONFIRM);
    expect(inferViewActionKind("barrier-option-select")).toBe(VIEW_ACTION_KINDS.SELECT);
    expect(inferViewActionKind("appointment-add-prep-topic")).toBe(VIEW_ACTION_KINDS.INPUT);
    expect(inferViewActionKind("something-nobody-has-written-yet")).toBe(VIEW_ACTION_KINDS.NAVIGATE);
  });

  it("builds a selector that finds the same control again", () => {
    const root = dom(`<button data-action="barrier-option-select" data-option-id="EXTRA_ROOM_9">UberXL</button>`);
    const selector = viewControlSelector(root.querySelector("button"));
    expect(root.querySelector(selector)).not.toBeNull();
  });
});

describe("EMMI cannot offer what is not on screen", () => {
  it("drops every option and action whose control is missing", () => {
    const root = dom(`<button data-action="barrier-option-select" data-option-id="STANDARD_1">UberX</button>`);
    const view = normalizeEmmiView({
      options: [
        { id: "STANDARD_1", label: "UberX", selector: `[data-action="barrier-option-select"][data-option-id="STANDARD_1"]` },
        { id: "GONE", label: "A ride that is not there", selector: `[data-action="barrier-option-select"][data-option-id="GONE"]` }
      ],
      actions: [
        { id: "barrier-option-select", label: "Choose", kind: "SELECT", selector: `[data-action="barrier-option-select"]` },
        { id: "barrier-reserve-confirm", label: "Book", kind: "CONFIRM", selector: `[data-action="barrier-reserve-confirm"]` }
      ]
    });
    const live = withLiveControls(view, root);
    expect(live.options.map(option => option.id)).toEqual(["STANDARD_1"]);
    expect(live.actions.map(action => action.id)).toEqual(["barrier-option-select"]);
  });

  it("survives a selector that is not valid CSS rather than throwing", () => {
    const root = dom(`<button data-action="x">x</button>`);
    expect(() => withLiveControls(normalizeEmmiView({ actions: [{ id: "x", label: "x", selector: "[[[" }] }), root)).not.toThrow();
  });

  it("renumbers the choices after a drop, so the ordinals still match the screen", () => {
    const root = dom(`<button data-action="s" data-option-id="B">B</button>`);
    const live = withLiveControls(normalizeEmmiView({
      options: [
        { id: "A", label: "A", selector: `[data-option-id="A"]` },
        { id: "B", label: "B", selector: `[data-option-id="B"]` }
      ]
    }), root);
    expect(live.options).toHaveLength(1);
    expect(live.options[0].ordinal).toBe(1);
  });
});

describe("the transportation flow, as EMMI reads it", () => {
  it("has a distinct view and a real instruction for every step", () => {
    const seen = new Set();
    for (const step of RESOLUTION_STEPS[BARRIER_TYPES.TRANSPORTATION]) {
      const view = normalizeEmmiView(transportView(step));
      expect(view.viewId, step).toContain(step);
      expect(seen.has(view.viewId), `${step} shares a viewId`).toBe(false);
      seen.add(view.viewId);
      // Every step a patient can stand on tells them what to do there. That sentence is what
      // "what do I do here?" is answered with, so a blank one is the original defect returning.
      if (!["NEEDS_UNSUPPORTED"].includes(step)) expect(view.task.length, step).toBeGreaterThan(10);
    }
  });

  it("says which step of the flow the patient is on", () => {
    const view = normalizeEmmiView(transportView("OPTIONS", { options: [rideOption()] }));
    expect(view.flow.id).toBe("TRANSPORTATION");
    expect(view.flow.step).toBe("OPTIONS");
    expect(view.flow.stepNumber).toBe(6);
    expect(view.flow.totalSteps).toBe(9);
  });

  it("carries what a patient actually compares rides on", () => {
    const view = normalizeEmmiView(transportView("OPTIONS", {
      options: [rideOption(), rideOption({ optionId: "XL", serviceName: "UberXL", seats: 5, estimatedCost: "$26.20", estimatedCostValue: 26.2 })]
    }));
    const [first, second] = view.options;
    expect(first.attributes.seats).toBe(3);
    expect(second.attributes.seats).toBe(5);
    expect(first.attributes.estimatedCostValue).toBe(18.4);
    expect(second.attributes.estimatedCostValue).toBe(26.2);
    // "which has more room" and "which is cheapest" are answerable from the descriptor alone.
    expect([...view.options].sort((a, b) => b.attributes.seats - a.attributes.seats)[0].label).toBe("UberXL");
    expect([...view.options].sort((a, b) => a.attributes.estimatedCostValue - b.attributes.estimatedCostValue)[0].label).toBe("UberX");
  });

  it("says a selected ride is NOT booked, in the pending list and in a note", () => {
    const view = normalizeEmmiView(transportView("REVIEW", { options: [rideOption()], selectedOptionId: "STANDARD_1" }));
    expect(view.selection).toBeTruthy();
    expect(view.completed.some(entry => entry.id === "RIDE_BOOKED")).toBe(false);
    expect(view.pending.some(entry => entry.id === "CONFIRM_BOOKING")).toBe(true);
    // The review screen has a "Change" control; a spoken "me equivoqué" must be able to use it.
    expect(view.actions.some(action => action.id === "barrier-back" && action.kind === "NAVIGATE")).toBe(true);
    expect(view.notes.join(" ")).toMatch(/NOT booked/i);
  });

  it("says a booked ride IS booked, with the reservation the record actually holds", () => {
    const view = normalizeEmmiView(transportView("BOOKED", {
      options: [rideOption()], selectedOptionId: "STANDARD_1",
      reservation: { reservationId: "UB-48291", serviceName: "UberX", pickupAt: "2026-09-02T18:00:00.000Z" }
    }));
    const booked = view.completed.find(entry => entry.id === "RIDE_BOOKED");
    expect(booked).toBeTruthy();
    expect(booked.detail).toContain("UB-48291");
    expect(view.pending.some(entry => entry.id === "CONFIRM_BOOKING")).toBe(false);
  });

  it("reports a failed booking as pending, never as done", () => {
    const view = normalizeEmmiView(transportView("BOOKING_FAILED", { options: [rideOption()], selectedOptionId: "STANDARD_1" }));
    expect(view.completed.some(entry => entry.id === "RIDE_BOOKED")).toBe(false);
    expect(view.pending.some(entry => entry.id === "BOOKING_FAILED")).toBe(true);
    // The patient did confirm; what failed is the provider. Saying "needs your confirmation" here
    // sent EMMI back to ask for a confirmation that had already been given.
    expect(view.pending.some(entry => entry.id === "CONFIRM_BOOKING")).toBe(false);
    expect(view.actions.map(action => action.id)).toEqual(expect.arrayContaining(["barrier-retry", "barrier-back"]));
  });

  it("marks the booking control as needing confirmation and the choosing control as not", () => {
    const review = normalizeEmmiView(transportView("REVIEW", { options: [rideOption()], selectedOptionId: "STANDARD_1" }));
    expect(review.actions.find(action => action.id === "barrier-reserve-confirm").kind).toBe(VIEW_ACTION_KINDS.CONFIRM);
    const booked = normalizeEmmiView(transportView("BOOKED", { reservation: { reservationId: "UB-1", serviceName: "UberX" } }));
    expect(booked.actions.find(action => action.id === "barrier-ride-cancel").kind).toBe(VIEW_ACTION_KINDS.DESTRUCTIVE);
  });

  it("knows a ride booked against an appointment that moved is out of date", () => {
    const view = normalizeEmmiView(transportView("BOOKED", { reservation: { reservationId: "UB-1", serviceName: "UberX" }, reservationOutdated: true }));
    expect(view.pending.some(entry => entry.id === "RIDE_OUTDATED")).toBe(true);
  });
});

describe("the other three flows", () => {
  it("names the exact video check that failed, not video visits in general", () => {
    const view = normalizeEmmiView(describeResolutionView({
      resolution: resolutionOn(BARRIER_TYPES.VIDEO_VISIT, "ISSUES", {
        results: [
          { id: "MICROPHONE", passed: false, label: "Microphone", detail: "I couldn’t detect your microphone." },
          { id: "CAMERA", passed: true, label: "Camera", detail: "Working" },
          { id: "CONNECTION", passed: true, label: "Internet connection", detail: "Good connection" }
        ]
      }),
      appointment: appointment(), locale: "en"
    }));
    expect(view.pending.map(entry => entry.label).join(" ")).toMatch(/Microphone/);
    expect(view.completed.map(entry => entry.label).join(" ")).toMatch(/Camera/);
    expect(view.pending.map(entry => entry.label).join(" ")).not.toMatch(/Camera/);
  });

  it("says an invitation is chosen but not sent, and then that it was sent but not answered", () => {
    const review = normalizeEmmiView(describeResolutionView({ resolution: resolutionOn(BARRIER_TYPES.COMPANION, "REVIEW", { contactName: "Maria", contactId: "demo-maria" }), appointment: appointment(), locale: "en" }));
    expect(review.pending.map(entry => entry.label).join(" ")).toMatch(/NOT been sent/i);
    const sent = normalizeEmmiView(describeResolutionView({ resolution: resolutionOn(BARRIER_TYPES.COMPANION, "SENT", { contactName: "Maria", invitation: { invitationId: "INV-1" } }), appointment: appointment(), locale: "en" }));
    expect(sent.completed.map(entry => entry.label).join(" ")).toMatch(/Invitation sent/i);
    expect(sent.pending.map(entry => entry.label).join(" ")).toMatch(/not answered/i);
    const confirmed = normalizeEmmiView(describeResolutionView({ resolution: resolutionOn(BARRIER_TYPES.COMPANION, "CONFIRMED", { contactName: "Maria" }), appointment: appointment(), locale: "en" }));
    expect(confirmed.completed.map(entry => entry.label).join(" ")).toMatch(/Maria said yes/i);
  });

  it("lists the caregivers on screen as numbered choices", () => {
    const view = normalizeEmmiView(describeResolutionView({
      resolution: resolutionOn(BARRIER_TYPES.COMPANION, "CONTACTS"),
      appointment: appointment(), locale: "en",
      extras: { contacts: [{ contactId: "demo-maria", firstName: "Maria", relationship: "Daughter" }, { contactId: "demo-carlos", firstName: "Carlos", relationship: "Son" }] }
    }));
    expect(view.options.map(option => option.label)).toEqual(["Maria", "Carlos"]);
    expect(view.options[0].detail).toBe("Daughter");
    expect(findViewOption(view, "1").id).toBe("demo-maria");
  });

  it("says a chosen time has NOT changed the appointment, and then that it has", () => {
    const slot = { slotId: "s1", startAt: "2026-09-04T17:30:00.000Z", endAt: "2026-09-04T18:00:00.000Z" };
    const review = normalizeEmmiView(describeResolutionView({ resolution: resolutionOn(BARRIER_TYPES.RESCHEDULE, "REVIEW", { slots: [slot], selectedSlotId: "s1" }), appointment: appointment(), locale: "en" }));
    expect(review.pending.map(entry => entry.label).join(" ")).toMatch(/NOT changed/i);
    expect(review.notes.join(" ")).toMatch(/POKO|NOT changed|NO ha cambiado/i);
    const changed = normalizeEmmiView(describeResolutionView({ resolution: resolutionOn(BARRIER_TYPES.RESCHEDULE, "CHANGED", {}), appointment: appointment({ scheduledAt: "2026-09-04T17:30:00.000Z" }), locale: "en" }));
    expect(changed.completed.map(entry => entry.label).join(" ")).toMatch(/moved/i);
  });

  it("offers the available times as numbered choices with their own day", () => {
    const view = normalizeEmmiView(describeResolutionView({
      resolution: resolutionOn(BARRIER_TYPES.RESCHEDULE, "SLOTS", {
        slots: [
          { slotId: "s1", startAt: "2026-09-03T13:30:00.000Z" },
          { slotId: "s2", startAt: "2026-09-03T15:45:00.000Z" },
          { slotId: "s3", startAt: "2026-09-04T14:00:00.000Z" }
        ]
      }),
      appointment: appointment(), locale: "en"
    }));
    expect(view.options).toHaveLength(3);
    // "what times are there on Thursday" is answerable because each choice carries its own date.
    const thursday = view.options.filter(option => option.attributes.date === view.options[0].attributes.date);
    expect(thursday).toHaveLength(2);
    expect(findViewOption(view, "1").id).toBe("s1");
  });

  it("gives the free-text step a box EMMI may fill with the patient's own words", () => {
    const view = normalizeEmmiView(describeResolutionView({ resolution: resolutionOn(BARRIER_TYPES.OTHER, "DESCRIBE"), appointment: appointment(), locale: "en" }));
    const submit = view.actions.find(item => item.id === "barrier-other-submit");
    expect(submit.kind).toBe(VIEW_ACTION_KINDS.INPUT);
    expect(submit.inputSelector).toBe("#barrier-describe");
    expect(emmiViewForModel(view).availableActions.find(item => item.id === "barrier-other-submit").acceptsText).toBe(true);
  });
});

describe("the appointment views", () => {
  it("distinguishes a confirmed appointment from a request that is not one", () => {
    const confirmed = normalizeEmmiView(describeAppointmentView({ screen: "APPOINTMENT_DETAIL", appointment: appointment(), locale: "en" }));
    expect(confirmed.completed.some(entry => entry.id === "CONFIRMED")).toBe(true);
    const request = normalizeEmmiView(describeAppointmentView({ screen: "APPOINTMENT_DETAIL", appointment: appointment({ status: "REQUEST_SENT", scheduledAt: "" }), locale: "en" }));
    expect(request.completed.some(entry => entry.id === "CONFIRMED")).toBe(false);
    expect(request.pending.some(entry => entry.id === "NOT_CONFIRMED")).toBe(true);
  });

  it("puts what is still unresolved for the visit in pending", () => {
    const ride = advanceResolution(createResolution({ appointmentId: "appt-1", barrierType: BARRIER_TYPES.TRANSPORTATION }), "OPTIONS");
    const readiness = appointmentReadiness({ appointment: appointment(), resolutions: [ride], locale: "en" });
    const view = normalizeEmmiView(describeAppointmentView({ screen: "APPOINTMENT_DETAIL", appointment: appointment(), readiness, locale: "en" }));
    expect(view.pending.map(entry => entry.label).join(" ")).toMatch(/transportation/i);
  });

  it("lets EMMI add a topic with the patient's own words", () => {
    const view = normalizeEmmiView(describeAppointmentView({ screen: "APPOINTMENT_DETAIL", view: "PREP", appointment: appointment({ prep: { topics: ["My blood pressure"], medications: [] } }), locale: "en" }));
    expect(view.completed.map(entry => entry.label)).toContain("My blood pressure");
    const add = view.actions.find(item => item.id === "appointment-add-prep-topic");
    expect(add.kind).toBe(VIEW_ACTION_KINDS.INPUT);
    expect(add.inputSelector).toBe("#appointment-prep-topic");
  });

  it("shows the pre-visit options with whatever is already under way on each one", () => {
    const view = normalizeEmmiView(describeAppointmentView({
      screen: "APPOINTMENT_DETAIL", view: "BARRIER", appointment: appointment(), locale: "en",
      preVisitCheck: { question: "Anything making this hard?", options: [{ reasonKey: "ALL_SET", label: "I’m all set" }, { reasonKey: "TRANSPORTATION", label: "Transportation" }] },
      barrierStates: { TRANSPORTATION: { tone: "CONFIRMED", icon: "check", label: "Arranged" } }
    }));
    expect(view.options.map(option => option.id)).toEqual(["ALL_SET", "TRANSPORTATION"]);
    expect(view.options[1].detail).toBe("Arranged");
  });

  it("gives every appointment view the appointment itself, so nobody has to be told which visit", () => {
    for (const view of ["", "PREP", "BRIEF", "BARRIER", "SHARE", "REMINDER", "CANCEL_CONFIRM", "FOLLOW_UP", "ALL_SET"]) {
      const described = describeAppointmentView({ screen: "APPOINTMENT_DETAIL", view, appointment: appointment(), locale: "en" });
      expect(described, view).toBeTruthy();
      const facts = normalizeEmmiView(described).facts.map(fact => fact.value).join(" ");
      expect(facts, view).toContain("Dr. Fresner Lee");
    }
  });

  it("marks cancelling as destructive and describes what the button does", () => {
    const view = normalizeEmmiView(describeAppointmentView({ screen: "APPOINTMENT_DETAIL", view: "CANCEL_CONFIRM", appointment: appointment(), locale: "en" }));
    expect(view.actions.find(item => item.id === "appointment-confirm-cancel").kind).toBe(VIEW_ACTION_KINDS.DESTRUCTIVE);
    expect(view.pending.map(entry => entry.label).join(" ")).toMatch(/NOT been cancelled/i);
  });

  it("has nothing to say about a screen it does not describe", () => {
    expect(describeAppointmentView({ screen: "MY_CARE", locale: "en" })).toBeNull();
    expect(describeResolutionView({ resolution: null })).toBeNull();
  });
});

describe("every describer speaks the patient's language", () => {
  it("never falls back to an enum in Spanish or Kreyòl", () => {
    for (const locale of ["es", "ht"]) {
      for (const barrierType of Object.values(BARRIER_TYPES)) {
        for (const step of RESOLUTION_STEPS[barrierType]) {
          const view = normalizeEmmiView(describeResolutionView({ resolution: resolutionOn(barrierType, step), appointment: appointment(), locale }));
          expect(view.title, `${locale}:${barrierType}`).not.toMatch(/^[A-Z_]+$/);
          for (const item of view.actions) expect(item.label, `${locale}:${barrierType}:${step}:${item.id}`).not.toMatch(/^[a-z-]+$/);
        }
      }
    }
  });
});
