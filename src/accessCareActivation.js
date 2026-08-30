// ACCESS care activation — the model behind the post-enrollment sequence.
//
// The patient has enrolled. What follows is not a questionnaire: it is the activation of the care
// they just accepted. Five things get confused the moment they share one "target" property, so they
// are five separate shapes here and nothing collapses them:
//
//   ACCESS HEALTH GOAL       the clinical area the track assigns. The patient does not pick it.
//   ACCESS OUTCOME TARGET    how CMS decides the goal was met — control OR improvement.
//   PATIENT STARTING POINT   this patient's own baseline. Absent until something real supplies it.
//   PERSONALIZED CARE TARGET what the care team may later set for this individual. Not ours to invent.
//   ACTIONS                  what the patient actually does.
//
// The dangerous conflation is the middle three. An improvement milestone derived from a baseline
// ("get to 137") is not a clinical goal ("get below 130") and is not this patient's personalized
// target either. Presenting the first as though it were the second tells a patient with a starting
// systolic of 152 that 137 is where they are trying to land, which is wrong and clinically worse
// than saying nothing. Everything below exists to keep those three apart.
//
// Structured, not copy: every function returns a shape and the caller localizes it. That is what
// lets the goals screen, the care plan, My Care and EMMI describe one patient state without four
// slightly different sentences drifting apart.

// A measure is absolute (a fixed clinical threshold) or relative (derived from this patient's
// baseline). The distinction decides what can be displayed before a baseline exists: the control
// threshold is knowable on day one, the improvement milestone is not knowable at all.
export const ACCESS_OUTCOME_TARGETS = Object.freeze({
  BLOOD_PRESSURE_CONTROL: Object.freeze({
    measure: "SYSTOLIC_BLOOD_PRESSURE",
    unit: "mmHg",
    control: Object.freeze({ kind: "ABSOLUTE", comparator: "BELOW", value: 130 }),
    improvement: Object.freeze({ kind: "RELATIVE_TO_BASELINE", comparator: "LOWER_BY_AT_LEAST", value: 15 })
  }),
  WEIGHT_MANAGEMENT: Object.freeze({
    measure: "WEIGHT_AND_BMI",
    unit: "BMI",
    // Control is a conjunction, not a single number: reaching a BMI under 30 does not count if the
    // patient got there while gaining materially from baseline. Both halves travel together so a
    // card cannot render one and imply the other.
    control: Object.freeze({ kind: "ABSOLUTE", comparator: "BMI_BELOW", value: 30, maxIncreasePercentFromBaseline: 5 }),
    improvement: Object.freeze({ kind: "RELATIVE_TO_BASELINE", comparator: "REDUCE_BY_AT_LEAST_PERCENT", value: 5 })
  })
});

// Which goals a track assigns, by condition. HbA1c and LDL-C are deliberately absent for a
// hypertension patient: ACCESS may still require them as baseline clinical data, but a data element
// the program collects is not a goal the patient is working on, and showing it as one invents a
// condition this patient does not have. Adding a track means adding a row, not editing a screen.
const ASSIGNED_GOALS_BY_CONDITION = Object.freeze({
  Hypertension: Object.freeze(["BLOOD_PRESSURE_CONTROL", "WEIGHT_MANAGEMENT"])
});

// Weight management rides along with every ACCESS medical track rather than with one condition:
// it is assigned to the patient because they are in the track, which is why it survives even when
// the condition list changes underneath it.
const TRACK_WIDE_GOALS = Object.freeze({ eCKM: Object.freeze(["WEIGHT_MANAGEMENT"]), CKM: Object.freeze(["WEIGHT_MANAGEMENT"]) });

const uniqueGoals = types => [...new Set(types.filter(Boolean))];

// Assignment is derived from the offer, never stored as a patient choice. A patient cannot add,
// remove or decline an assigned ACCESS goal, so nothing here reads a selection.
export function assignedAccessGoals(offer = {}) {
  if (offer.pathway !== "ACCESS") return [];
  const conditions = (offer.qualifyingConditions || []).map(condition => condition?.name).filter(Boolean);
  const fromConditions = conditions.flatMap(name => ASSIGNED_GOALS_BY_CONDITION[name] || []);
  const fromTrack = TRACK_WIDE_GOALS[offer.accessTrack] || [];
  return uniqueGoals([...fromConditions, ...fromTrack]);
}

export const isAssignedAccessGoal = (offer, goalType) => assignedAccessGoals(offer).includes(goalType);

// A starting point is a fact about this patient or it does not exist. There is no default, no
// placeholder value and no "typical" reading: a fabricated baseline would silently become the
// number every milestone below is derived from. PENDING is a real, displayable state.
// Number() turns null, undefined and "" into 0 or NaN inconsistently, and a 0 that reached a
// clinical comparison would read as flawless control rather than as the missing value it is. Every
// number entering this module comes through here, and a measurement must additionally be positive:
// there is no such thing as a systolic of 0, so that is absent data wearing a number's clothes.
const numeric = value => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const measured = value => {
  const parsed = numeric(value);
  return parsed !== null && parsed > 0 ? parsed : null;
};

export function patientStartingPoint(goalType, runtime = {}) {
  const record = runtime?.[goalType];
  if (!record || record.status !== "CONFIRMED") return Object.freeze({ goalType, status: "PENDING" });
  if (goalType === "BLOOD_PRESSURE_CONTROL") {
    const systolic = measured(record.systolic);
    if (systolic === null) return Object.freeze({ goalType, status: "PENDING" });
    return Object.freeze({ goalType, status: "CONFIRMED", measure: "SYSTOLIC_BLOOD_PRESSURE", unit: "mmHg", value: systolic, diastolic: measured(record.diastolic), recordedAt: record.recordedAt || null });
  }
  if (goalType === "WEIGHT_MANAGEMENT") {
    const weight = measured(record.weightLb);
    if (weight === null) return Object.freeze({ goalType, status: "PENDING" });
    // BMI is reported only when height was actually recorded. Half a baseline is still a baseline
    // for weight, so the weight shows and the BMI says pending beside it.
    return Object.freeze({ goalType, status: "CONFIRMED", measure: "WEIGHT_AND_BMI", unit: "lb", value: weight, bmi: measured(record.bmi), recordedAt: record.recordedAt || null });
  }
  return Object.freeze({ goalType, status: "PENDING" });
}

const round = value => Math.round(value * 10) / 10;

// How ACCESS measures progress, resolved for one patient.
//
// The control threshold is always returned: it is a property of the program, not of the patient,
// and a patient is entitled to know what "under control" means before their first reading. The
// improvement milestone is returned ONLY with a confirmed baseline, because it is arithmetic on
// that baseline and there is nothing honest to show without one.
//
// Both come back tagged. `control` and `improvementMilestone` are separate keys with separate
// labels precisely so that no caller can render a bare "target" and pick whichever it found first.
export function accessProgressMeasure(goalType, startingPoint = { status: "PENDING" }) {
  const outcome = ACCESS_OUTCOME_TARGETS[goalType];
  if (!outcome) return null;
  const baselineConfirmed = startingPoint?.status === "CONFIRMED" && startingPoint.goalType === goalType;
  const base = { goalType, measure: outcome.measure, unit: outcome.unit, control: outcome.control };
  if (!baselineConfirmed) return Object.freeze({ ...base, status: "PENDING_BASELINE", improvementMilestone: null });
  if (goalType === "BLOOD_PRESSURE_CONTROL") {
    return Object.freeze({
      ...base,
      status: "RESOLVED",
      startingValue: startingPoint.value,
      improvementMilestone: Object.freeze({ comparator: "AT_OR_BELOW", value: startingPoint.value - outcome.improvement.value, derivedFromBaseline: startingPoint.value, improvementRequired: outcome.improvement.value, unit: outcome.unit })
    });
  }
  return Object.freeze({
    ...base,
    status: "RESOLVED",
    startingValue: startingPoint.value,
    startingBmi: startingPoint.bmi,
    improvementMilestone: Object.freeze({ comparator: "AT_OR_BELOW", value: round(startingPoint.value * (1 - outcome.improvement.value / 100)), derivedFromBaseline: startingPoint.value, improvementRequired: outcome.improvement.value, unit: "lb", percent: true })
  });
}

// Reaching the improvement milestone is not the same as being controlled, and a patient can satisfy
// ACCESS by either route. Callers ask this rather than comparing numbers themselves, so "met" means
// one thing across the care plan, My Care and EMMI.
export function accessOutcomeStatus(goalType, startingPoint, currentValue, { currentBmi = null } = {}) {
  const measure = accessProgressMeasure(goalType, startingPoint);
  const value = measured(currentValue);
  if (!measure || value === null) return Object.freeze({ status: "NO_DATA" });
  if (goalType === "BLOOD_PRESSURE_CONTROL") {
    if (value < measure.control.value) return Object.freeze({ status: "CONTROLLED", via: "CONTROL" });
    if (measure.status === "RESOLVED" && value <= measure.improvementMilestone.value) return Object.freeze({ status: "IMPROVED", via: "IMPROVEMENT" });
    return Object.freeze({ status: "IN_PROGRESS" });
  }
  const bmi = measured(currentBmi);
  const withinIncrease = measure.status !== "RESOLVED" || value <= measure.startingValue * (1 + measure.control.maxIncreasePercentFromBaseline / 100);
  if (bmi !== null && bmi < measure.control.value && withinIncrease) return Object.freeze({ status: "CONTROLLED", via: "CONTROL" });
  if (measure.status === "RESOLVED" && value <= measure.improvementMilestone.value) return Object.freeze({ status: "IMPROVED", via: "IMPROVEMENT" });
  return Object.freeze({ status: "IN_PROGRESS" });
}

// The connected monitor's state is reported, never assumed. "Requested" is a claim about the world
// that only a real fulfillment response can justify, so an unknown device is NOT_REQUESTED rather
// than optimistically in flight.
export const DEVICE_ACTIVATION_STATES = Object.freeze(["NOT_REQUESTED", "REQUESTED", "PREPARING", "SHIPPED", "DELIVERED", "CONNECTED"]);
export const normalizeDeviceActivationState = value => DEVICE_ACTIVATION_STATES.includes(value) ? value : "NOT_REQUESTED";

// The prototype patient has no monitor, so the journey does not ask whether they own one. This
// reads the scenario rather than hardcoding the answer, so a configured patient who does have a
// connected monitor still reaches the paths that verify it.
export const patientNeedsConnectedMonitor = (config = {}) => (config.bpDeviceScenario || "none") === "none";

// Care activation stages, in order. The header carries broad stages, not one per screen, so the
// patient sees five recognizable phases instead of a counter that moves for every tap.
export const CARE_ACTIVATION_STAGES = Object.freeze(["DEVICE", "GOALS", "STARTING_POINTS", "PERSONALIZE", "CARE_PLAN"]);
