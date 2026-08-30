import { describe, expect, it } from "vitest";
import { GOAL_CONFIG, createPatientGoal } from "../src/goals.js";
import { ACCESS_OUTCOME_TARGETS, accessOutcomeStatus, accessProgressMeasure, assignedAccessGoals, isAssignedAccessGoal, patientNeedsConnectedMonitor, patientStartingPoint } from "../src/accessCareActivation.js";

const hypertensionOffer = { pathway: "ACCESS", accessTrack: "eCKM", qualifyingConditions: [{ name: "Hypertension" }] };

describe("assigned ACCESS health goals", () => {
  it("assigns blood pressure and weight to a hypertension patient without asking them", () => {
    expect(assignedAccessGoals(hypertensionOffer)).toEqual(["BLOOD_PRESSURE_CONTROL", "WEIGHT_MANAGEMENT"]);
  });

  // Section 20: ACCESS may still collect HbA1c and LDL-C as baseline clinical data, but presenting
  // them as this patient's health goals invents a condition they do not have.
  it("does not present HbA1c or LDL as goals for a patient without those conditions", () => {
    const goals = assignedAccessGoals(hypertensionOffer);
    expect(goals).not.toContain("HBA1C_CONTROL");
    expect(goals).not.toContain("LDL_CONTROL");
  });

  it("derives assignment from the offer, so nothing a patient selects can add or remove one", () => {
    expect(isAssignedAccessGoal(hypertensionOffer, "BLOOD_PRESSURE_CONTROL")).toBe(true);
    expect(isAssignedAccessGoal({ ...hypertensionOffer, qualifyingConditions: [] }, "BLOOD_PRESSURE_CONTROL")).toBe(false);
    expect(assignedAccessGoals({ pathway: "CCM", qualifyingConditions: [{ name: "Hypertension" }] })).toEqual([]);
  });
});

describe("a starting point is a fact or it is pending", () => {
  it("reports pending rather than inventing a baseline", () => {
    expect(patientStartingPoint("BLOOD_PRESSURE_CONTROL", {})).toEqual({ goalType: "BLOOD_PRESSURE_CONTROL", status: "PENDING" });
    expect(patientStartingPoint("BLOOD_PRESSURE_CONTROL", { BLOOD_PRESSURE_CONTROL: { status: "IN_PROGRESS", systolic: 152 } }).status).toBe("PENDING");
  });

  it("treats a confirmed record with no usable number as pending, not as zero", () => {
    expect(patientStartingPoint("BLOOD_PRESSURE_CONTROL", { BLOOD_PRESSURE_CONTROL: { status: "CONFIRMED", systolic: null } }).status).toBe("PENDING");
  });

  it("reports a confirmed weight even when height was never recorded", () => {
    const point = patientStartingPoint("WEIGHT_MANAGEMENT", { WEIGHT_MANAGEMENT: { status: "CONFIRMED", weightLb: 210 } });
    expect(point).toMatchObject({ status: "CONFIRMED", value: 210, bmi: null });
  });
});

describe("how ACCESS measures progress", () => {
  // Section 51, the exact QA case. 137 is what ACCESS will recognize as improvement. It is not the
  // clinical goal, and the shape has to make that impossible to render as "your target".
  it("derives the improvement milestone from a starting systolic of 152 without displacing the control target", () => {
    const startingPoint = patientStartingPoint("BLOOD_PRESSURE_CONTROL", { BLOOD_PRESSURE_CONTROL: { status: "CONFIRMED", systolic: 152, diastolic: 88 } });
    const measure = accessProgressMeasure("BLOOD_PRESSURE_CONTROL", startingPoint);

    expect(measure.startingValue).toBe(152);
    expect(measure.improvementMilestone.value).toBe(137);
    expect(measure.control.value).toBe(130);
    // The milestone carries where it came from, so a card cannot show 137 stripped of the fact
    // that it is 15 mmHg off this patient's own starting point.
    expect(measure.improvementMilestone.derivedFromBaseline).toBe(152);
    expect(measure.improvementMilestone.improvementRequired).toBe(15);
    // Two separately named keys, so there is no single "target" for a caller to grab blindly.
    expect(Object.keys(measure)).toEqual(expect.arrayContaining(["control", "improvementMilestone"]));
    expect(measure).not.toHaveProperty("target");
  });

  it("still states what control means before any baseline exists, and refuses to guess the milestone", () => {
    const measure = accessProgressMeasure("BLOOD_PRESSURE_CONTROL", { status: "PENDING" });
    expect(measure.status).toBe("PENDING_BASELINE");
    expect(measure.control.value).toBe(130);
    expect(measure.improvementMilestone).toBeNull();
  });

  it("computes the weight milestone as a five percent reduction from the starting weight", () => {
    const startingPoint = patientStartingPoint("WEIGHT_MANAGEMENT", { WEIGHT_MANAGEMENT: { status: "CONFIRMED", weightLb: 210, bmi: 32.4 } });
    const measure = accessProgressMeasure("WEIGHT_MANAGEMENT", startingPoint);
    expect(measure.improvementMilestone.value).toBe(199.5);
    expect(measure.control.value).toBe(30);
    expect(measure.control.maxIncreasePercentFromBaseline).toBe(5);
  });

  it("keeps control and improvement as distinct routes in the outcome definition", () => {
    expect(ACCESS_OUTCOME_TARGETS.BLOOD_PRESSURE_CONTROL.control.kind).toBe("ABSOLUTE");
    expect(ACCESS_OUTCOME_TARGETS.BLOOD_PRESSURE_CONTROL.improvement.kind).toBe("RELATIVE_TO_BASELINE");
  });
});

describe("outcome status", () => {
  const bpBaseline = patientStartingPoint("BLOOD_PRESSURE_CONTROL", { BLOOD_PRESSURE_CONTROL: { status: "CONFIRMED", systolic: 152 } });

  it("recognizes control and improvement as separate ways of meeting the outcome", () => {
    expect(accessOutcomeStatus("BLOOD_PRESSURE_CONTROL", bpBaseline, 128).status).toBe("CONTROLLED");
    expect(accessOutcomeStatus("BLOOD_PRESSURE_CONTROL", bpBaseline, 136).status).toBe("IMPROVED");
    expect(accessOutcomeStatus("BLOOD_PRESSURE_CONTROL", bpBaseline, 145).status).toBe("IN_PROGRESS");
  });

  it("cannot report improvement without a baseline to improve from", () => {
    expect(accessOutcomeStatus("BLOOD_PRESSURE_CONTROL", { status: "PENDING" }, 136).status).toBe("IN_PROGRESS");
    expect(accessOutcomeStatus("BLOOD_PRESSURE_CONTROL", { status: "PENDING" }, null).status).toBe("NO_DATA");
  });

  // A BMI under 30 does not count as controlled if the patient gained materially getting there.
  it("holds weight control to both halves of its rule", () => {
    const baseline = patientStartingPoint("WEIGHT_MANAGEMENT", { WEIGHT_MANAGEMENT: { status: "CONFIRMED", weightLb: 200, bmi: 31 } });
    expect(accessOutcomeStatus("WEIGHT_MANAGEMENT", baseline, 205, { currentBmi: 29 }).status).toBe("CONTROLLED");
    expect(accessOutcomeStatus("WEIGHT_MANAGEMENT", baseline, 215, { currentBmi: 29 }).status).toBe("IN_PROGRESS");
    expect(accessOutcomeStatus("WEIGHT_MANAGEMENT", baseline, 189, { currentBmi: 31 }).status).toBe("IMPROVED");
  });
});

describe("the connected monitor", () => {
  it("says the canonical patient needs one, and does not say so for a patient who has one", () => {
    expect(patientNeedsConnectedMonitor({ bpDeviceScenario: "none" })).toBe(true);
    expect(patientNeedsConnectedMonitor({ bpDeviceScenario: "itera-tenovi" })).toBe(false);
  });
});

describe("assigned goals become real patient records", () => {
  // My Goals, the care plan and the goal detail all read patient goal records. An assigned type
  // missing from GOAL_CONFIG does not throw — createPatientGoal quietly falls back to CUSTOM, and
  // the patient ends up with "My personal goal" where their blood pressure goal should be.
  it("every assigned type exists in the goal catalogue", () => {
    for (const goalType of assignedAccessGoals(hypertensionOffer)) {
      expect(GOAL_CONFIG[goalType], `${goalType} is assigned but missing from GOAL_CONFIG`).toBeDefined();
      const record = createPatientGoal({ type: goalType, patientId: "p1" });
      expect(record.goalType).toBe(goalType);
      expect(record.goalSource).toBe("PATHWAY");
    }
  });
});
