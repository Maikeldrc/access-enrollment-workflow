import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import {
  ENROLLMENT_DESCRIBED_SCREENS, describeCareCircleView, describeDeviceView,
  describeEnrollmentView, describeGoalView, describeMedicationView
} from "../src/careViewContext.js";
import {
  VIEW_ACTION_KINDS, describeEmmiViewFromDom, emmiViewForModel, inferViewActionKind, normalizeEmmiView
} from "../src/emmi/viewContext.js";
import { NARRATIVE_OBJECTIVES } from "../src/emmi/narrative.js";

const dom = html => {
  const window = new JSDOM(`<body><div id="screen-content">${html}</div></body>`).window;
  globalThis.CSS = window.CSS;
  return window.document.querySelector("#screen-content");
};

const goal = (overrides = {}) => ({
  id: "goal-bp",
  title: "Lower my blood pressure",
  status: "ACTIVE",
  priority: "PRIMARY",
  whyItMatters: "",
  actions: [
    { id: "a1", title: "Check my blood pressure", status: "ACTIVE", frequency: "daily", verificationMethod: "DEVICE" },
    { id: "a2", title: "Take my medication", status: "COMPLETED", frequency: "daily", verificationMethod: "PATIENT" }
  ],
  barriers: [],
  latestReading: null,
  clinicalTarget: null,
  ...overrides
});

/* ==========================================================================================
   The safety line: a screen nobody described may be explained, never acted on
   ========================================================================================== */

describe("the floor can explain a screen but never authorise acting on one", () => {
  it("marks a DOM-derived descriptor as such, and a written one as written", () => {
    const floor = describeEmmiViewFromDom(dom(`<h1>My goals</h1><button data-action="pause-goal">Pause</button>`), { screenId: "MY_GOALS" });
    expect(floor.source).toBe("DOM");
    expect(emmiViewForModel(floor).youMayPressTheseYourself).toBe(false);

    const written = normalizeEmmiView(describeGoalView({ screen: "MY_GOALS", goal: goal(), locale: "en" }));
    expect(written.source).toBe("DESCRIBER");
    expect(emmiViewForModel(written).youMayPressTheseYourself).toBe(true);
  });

  it("still shows the patient which controls exist on an undescribed screen", () => {
    // The point is not to hide the screen from EMMI. It is that naming a button and pressing it
    // are different rights, and only one of them can be earned by guessing at a verb.
    const floor = emmiViewForModel(describeEmmiViewFromDom(dom(`<h1>Somewhere new</h1><p>Do the thing.</p><button data-action="brand-new-action">Do it</button>`), { screenId: "SOMETHING_NEW" }));
    expect(floor.title).toBe("Somewhere new");
    expect(floor.whatThePatientMustDoHere).toBe("Do the thing.");
    expect(floor.availableActions.map(item => item.id)).toContain("brand-new-action");
    expect(floor.youMayPressTheseYourself).toBe(false);
  });

  it("no longer reads changing the patient's plan as navigation", () => {
    // Every one of these was NAVIGATE, which is the kind EMMI may press without asking.
    expect(inferViewActionKind("pause-goal")).toBe(VIEW_ACTION_KINDS.DESTRUCTIVE);
    expect(inferViewActionKind("goal-mark-achieved")).toBe(VIEW_ACTION_KINDS.CONFIRM);
    expect(inferViewActionKind("change-goal-priority")).toBe(VIEW_ACTION_KINDS.CONFIRM);
    expect(inferViewActionKind("request-callback")).toBe(VIEW_ACTION_KINDS.CONFIRM);
    expect(inferViewActionKind("reactivate-goal")).toBe(VIEW_ACTION_KINDS.CONFIRM);
    // And the ones that really are navigation still are.
    expect(inferViewActionKind("open-goal-checkin")).toBe(VIEW_ACTION_KINDS.NAVIGATE);
    expect(inferViewActionKind("back")).toBe(VIEW_ACTION_KINDS.NAVIGATE);
  });
});

/* ==========================================================================================
   Goals
   ========================================================================================== */

describe("goals", () => {
  it("splits the plan into what is done and what is still owed", () => {
    const view = normalizeEmmiView(describeGoalView({ screen: "MY_GOALS", goal: goal(), locale: "en" }));
    expect(view.completed.map(item => item.label)).toContain("Take my medication");
    expect(view.pending.map(item => item.label)).toContain("Check my blood pressure");
  });

  it("numbers the plan steps so 'mark that one done' can be resolved", () => {
    const view = normalizeEmmiView(describeGoalView({ screen: "MY_GOALS", goal: goal(), locale: "en" }));
    expect(view.options.map(item => item.ordinal)).toEqual([1, 2]);
    expect(view.options[0].label).toBe("Check my blood pressure");
  });

  it("gives a device-verified step no control, because a reading completes it and nobody else", () => {
    const view = normalizeEmmiView(describeGoalView({ screen: "MY_GOALS", goal: goal(), locale: "en" }));
    const device = view.options.find(item => item.attributes.verifiedBy === "DEVICE");
    expect(device.selector).toBe("");
  });

  it("marks pausing as destructive and marking achieved as needing confirmation", () => {
    const view = normalizeEmmiView(describeGoalView({ screen: "MY_GOALS", goal: goal(), locale: "en" }));
    expect(view.actions.find(item => item.id === "pause-goal").kind).toBe(VIEW_ACTION_KINDS.DESTRUCTIVE);
    expect(view.actions.find(item => item.id === "goal-mark-achieved").kind).toBe(VIEW_ACTION_KINDS.CONFIRM);
    expect(view.actions.find(item => item.id === "open-goal-checkin").kind).toBe(VIEW_ACTION_KINDS.NAVIGATE);
  });

  it("carries an open difficulty as pending rather than hiding it", () => {
    const view = normalizeEmmiView(describeGoalView({
      screen: "MY_GOALS",
      goal: goal({ barriers: [{ id: "b1", category: "TRANSPORTATION", status: "ACTIVE" }] }),
      locale: "en"
    }));
    expect(view.pending.map(item => item.id)).toContain("BARRIER_b1");
  });

  it("says out loud that a personal goal changes nothing clinical", () => {
    const view = normalizeEmmiView(describeGoalView({ screen: "MY_GOALS", goal: goal(), locale: "en" }));
    expect(view.notes.join(" ")).toMatch(/never changes a clinical target/i);
  });

  it("describes the list of goals when none is open, and the flow while choosing", () => {
    const list = normalizeEmmiView(describeGoalView({ screen: "MY_GOALS", goals: [{ id: "g1", title: "Walk more" }], locale: "en" }));
    expect(list.viewId).toBe("GOAL_LIST");
    expect(list.options[0].label).toBe("Walk more");
    const flow = normalizeEmmiView(describeGoalView({ screen: "GOALS", flowStep: "PRIORITY", locale: "en" }));
    expect(flow.flow.step).toBe("PRIORITY");
    expect(flow.task).toMatch(/matters most/i);
  });

  it("has nothing to say about a screen that is not its own", () => {
    expect(describeGoalView({ screen: "MY_CARE" })).toBeNull();
  });
});

/* ==========================================================================================
   Medications
   ========================================================================================== */

describe("medications and refills", () => {
  const medications = [
    { id: "m1", name: "Lisinopril", strength: "10 mg", details: "Once daily", active: true, pharmacy: { name: "CVS Pharmacy" } },
    { id: "m2", name: "Atorvastatin", strength: "20 mg", details: "Once daily", active: true }
  ];

  it("says which medications are still unreviewed", () => {
    const view = normalizeEmmiView(describeMedicationView({
      screen: "MEDICATIONS_REVIEW", medications, reviews: { m1: { medicationId: "m1", reviewStatus: "CONFIRMED" } }, locale: "en"
    }));
    expect(view.completed.map(item => item.detail)).toContain("m1");
    expect(view.pending.map(item => item.label).join(" ")).toMatch(/Atorvastatin/);
    expect(view.pending.map(item => item.label).join(" ")).not.toMatch(/Lisinopril/);
  });

  it("owns the screen while a refill is in progress, and says nothing was requested yet", () => {
    const view = normalizeEmmiView(describeMedicationView({
      screen: "MY_MEDICATIONS", refillStep: "SUPPLY", medications, activeMedication: medications[0], locale: "en"
    }));
    expect(view.viewId).toBe("REFILL_SUPPLY");
    expect(view.flow.step).toBe("SUPPLY");
    expect(view.pending.map(item => item.id)).toContain("NOT_REQUESTED");
    expect(view.facts.map(fact => fact.value).join(" ")).toContain("Lisinopril");
  });

  it("marks sending the request as needing confirmation, and says what it does not do", () => {
    const view = normalizeEmmiView(describeMedicationView({ screen: "MY_MEDICATIONS", refillStep: "CONFIRM", medications, activeMedication: medications[0], locale: "en" }));
    const send = view.actions.find(item => item.id === "confirm-refill-request");
    expect(send.kind).toBe(VIEW_ACTION_KINDS.CONFIRM);
    expect(send.effect).toMatch(/does not approve or renew/i);
  });

  it("keeps requested, approved and ready apart in the note EMMI reads", () => {
    const view = normalizeEmmiView(describeMedicationView({ screen: "MY_MEDICATIONS", refillStep: "STATUS", medications, locale: "en" }));
    expect(view.notes.join(" ")).toMatch(/Requested is not approved/i);
  });

  it("never offers to renew or change a dose", () => {
    for (const step of ["", "REVIEW", "CHANGE", "SUPPLY", "CONFIRM", "STATUS"]) {
      const view = normalizeEmmiView(describeMedicationView({ screen: "MY_MEDICATIONS", refillStep: step, medications, activeMedication: medications[0], locale: "en" }));
      for (const item of view.actions) expect(item.label, `${step}:${item.id}`).not.toMatch(/renew|change the dose|increase|decrease/i);
    }
  });
});

/* ==========================================================================================
   Care Circle
   ========================================================================================== */

describe("care circle", () => {
  it("separates who accepted from who has not", () => {
    const view = normalizeEmmiView(describeCareCircleView({
      screen: "MY_CARE_CIRCLE",
      members: [
        { inviteId: "i1", firstName: "Ana", relationship: "daughter", status: "ACCEPTED" },
        { inviteId: "i2", firstName: "Luis", relationship: "son", status: "SENT" }
      ],
      locale: "en"
    }));
    expect(view.completed.map(item => item.label).join(" ")).toMatch(/Ana accepted/);
    expect(view.pending.map(item => item.label).join(" ")).toMatch(/Luis has not accepted/);
  });

  it("names only the permissions the patient actually granted", () => {
    const view = normalizeEmmiView(describeCareCircleView({
      screen: "MY_CARE_CIRCLE", members: [], permissions: { helpWithAppointments: true, receiveReminders: false }, locale: "en"
    }));
    expect(view.facts[0].value).toContain("helpWithAppointments");
    expect(view.facts[0].value).not.toContain("receiveReminders");
  });

  it("marks inviting as confirming and removing as destructive", () => {
    const view = normalizeEmmiView(describeCareCircleView({ screen: "CARE_CIRCLE_INVITE", locale: "en" }));
    expect(view.actions.find(item => item.id === "save-care-circle").kind).toBe(VIEW_ACTION_KINDS.CONFIRM);
    expect(view.actions.find(item => item.id === "care-circle-remove").kind).toBe(VIEW_ACTION_KINDS.DESTRUCTIVE);
  });

  it("states the line a Care Circle member may never cross", () => {
    const view = normalizeEmmiView(describeCareCircleView({ screen: "MY_CARE_CIRCLE", locale: "en" }));
    expect(view.notes.join(" ")).toMatch(/never a Personal Representative/i);
    expect(view.notes.join(" ")).toMatch(/never consent, sign/i);
  });
});

/* ==========================================================================================
   The monitor
   ========================================================================================== */

describe("the blood pressure monitor", () => {
  it("counts the readings received against the readings still needed", () => {
    const view = normalizeEmmiView(describeDeviceView({
      screen: "ACCESS_BP_MEASUREMENT", deviceVerificationStatus: "ASSIGNED",
      device: { vendor: "Tenovi", model: "BPM" }, baselineTaken: 1, baselineRemaining: 2, baselineRequired: 3, locale: "en"
    }));
    expect(view.facts.map(fact => fact.value)).toContain("1 / 3");
    expect(view.completed.map(item => item.label).join(" ")).toMatch(/1 reading received/);
    expect(view.pending.map(item => item.label).join(" ")).toMatch(/2 more readings still needed/);
  });

  it("says nothing is pending once the baseline is complete", () => {
    const view = normalizeEmmiView(describeDeviceView({ screen: "ACCESS_BP_MEASUREMENT", baselineTaken: 3, baselineRemaining: 0, baselineRequired: 3, locale: "en" }));
    expect(view.pending).toHaveLength(0);
  });

  it("says a reading comes from the monitor and never from a spoken number", () => {
    const view = normalizeEmmiView(describeDeviceView({ screen: "ACCESS_BP_MEASUREMENT", locale: "en" }));
    expect(view.notes.join(" ")).toMatch(/never from anyone saying a number/i);
  });

  it("has nothing to say about a screen outside the monitor flow", () => {
    expect(describeDeviceView({ screen: "MY_CARE" })).toBeNull();
  });
});

/* ==========================================================================================
   Enrollment
   ========================================================================================== */

describe("enrollment", () => {
  it("takes its instruction from the narration rather than inventing a second one", () => {
    const screen = "DECISION_MAKER";
    const view = normalizeEmmiView(describeEnrollmentView({ screen, locale: "en" }));
    // The exact sentence EMMI speaks on this screen, so the guide and the answer agree.
    expect(view.task).toBe(NARRATIVE_OBJECTIVES[screen].action.en);
    expect(view.title).toBe(NARRATIVE_OBJECTIVES[screen].summary.en);
  });

  it("covers every narrated screen, in every language", () => {
    expect(ENROLLMENT_DESCRIBED_SCREENS.length).toBeGreaterThan(20);
    for (const screen of ENROLLMENT_DESCRIBED_SCREENS) {
      for (const locale of ["en", "es", "ht"]) {
        const view = normalizeEmmiView(describeEnrollmentView({ screen, locale }));
        expect(view.task.length, `${screen}:${locale}`).toBeGreaterThan(10);
        expect(view.title.length, `${screen}:${locale}`).toBeGreaterThan(5);
      }
    }
  });

  it("never lets cleared-to-continue read as enrolled", () => {
    const cleared = normalizeEmmiView(describeEnrollmentView({
      screen: "ACCESS_ELIGIBILITY_RESULT", enrollment: { canContinue: true, enrollmentComplete: false }, locale: "en"
    }));
    expect(cleared.completed.map(item => item.id)).toContain("CLEARED");
    expect(cleared.completed.map(item => item.id)).not.toContain("ENROLLED");
    expect(cleared.pending.map(item => item.label).join(" ")).toMatch(/NOT enrolled/);

    const enrolled = normalizeEmmiView(describeEnrollmentView({
      screen: "ENROLLMENT_CONFIRMED", enrollment: { canContinue: true, enrollmentComplete: true }, locale: "en"
    }));
    expect(enrolled.completed.map(item => item.id)).toContain("ENROLLED");
    expect(enrolled.pending.map(item => item.id)).not.toContain("NOT_ENROLLED");
  });

  it("states that EMMI may explain consent and never give it", () => {
    const view = normalizeEmmiView(describeEnrollmentView({ screen: "CONSENT_REVIEW", locale: "en" }));
    expect(view.notes.join(" ")).toMatch(/never mark a checkbox, consent, sign/i);
  });

  it("has nothing to say about a screen the narration does not cover", () => {
    expect(describeEnrollmentView({ screen: "MY_APPOINTMENTS" })).toBeNull();
  });
});

/* ==========================================================================================
   Everything, in every language
   ========================================================================================== */

describe("every describer speaks the patient's language", () => {
  const everyView = locale => [
    describeGoalView({ screen: "MY_GOALS", goal: goal(), locale }),
    describeGoalView({ screen: "MY_GOALS", goals: [{ id: "g", title: "x" }], locale }),
    describeGoalView({ screen: "GOALS", flowStep: "DISCOVERY", locale }),
    describeMedicationView({ screen: "MY_MEDICATIONS", medications: [{ id: "m", name: "X", active: true }], locale }),
    describeMedicationView({ screen: "MY_MEDICATIONS", refillStep: "REVIEW", medications: [], locale }),
    describeCareCircleView({ screen: "MY_CARE_CIRCLE", locale }),
    describeCareCircleView({ screen: "CARE_CIRCLE_PERMISSIONS", locale }),
    describeDeviceView({ screen: "ACCESS_BP_DEVICE_INFO", locale }),
    describeEnrollmentView({ screen: "CONSENT_REVIEW", locale })
  ].filter(Boolean).map(normalizeEmmiView);

  it("never falls back to an enum or an English string in Spanish or Kreyòl", () => {
    for (const locale of ["es", "ht"]) {
      const english = everyView("en");
      const translated = everyView(locale);
      expect(translated.length).toBe(english.length);
      translated.forEach((view, index) => {
        expect(view.task.length, `${locale}:${view.viewId}`).toBeGreaterThan(10);
        expect(view.task, `${locale}:${view.viewId}`).not.toBe(english[index].task);
        for (const item of view.actions) expect(item.label, `${locale}:${view.viewId}:${item.id}`).not.toMatch(/^[a-z-]+$/);
      });
    }
  });

  it("gives every described view a task, and marks every one as written rather than inferred", () => {
    for (const view of everyView("en")) {
      expect(view.source, view.viewId).toBe("DESCRIBER");
      expect(view.task.length, view.viewId).toBeGreaterThan(10);
      expect(emmiViewForModel(view).youMayPressTheseYourself, view.viewId).toBe(true);
    }
  });
});
