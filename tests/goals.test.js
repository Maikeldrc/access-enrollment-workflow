import { describe, expect, it } from "vitest";
import { createPatientGoal, goalDisplayName, suggestedActionsFor } from "../src/goals.js";

describe("patient goal model", () => {
  it("keeps a patient goal separate from clinical targets", () => {
    const goal = createPatientGoal({ type: "BLOOD_PRESSURE_CONTROL", patientId: "patient-1", now: "2026-08-27T10:00:00.000Z", id: "goal-1" });
    expect(goal).toMatchObject({ id: "goal-1", patientId: "patient-1", goalType: "BLOOD_PRESSURE_CONTROL", status: "ACTIVE", priority: "NONE", planStatus: "NOT_STARTED", createdBy: "PATIENT" });
    expect(goal).not.toHaveProperty("targetSystolic");
    expect(goal).not.toHaveProperty("targetDiastolic");
    expect(goal).not.toHaveProperty("clinicalTarget");
  });

  it("localizes system goals and preserves a custom patient title", () => {
    expect(goalDisplayName({ goalType: "STAY_INDEPENDENT" }, "es")).toBe("Mantener mi independencia");
    expect(goalDisplayName({ goalType: "STAY_ACTIVE" }, "ht")).toBe("Rete aktif");
    expect(goalDisplayName({ goalType: "CUSTOM", customTitle: "Attend my granddaughter’s graduation" }, "es")).toBe("Attend my granddaughter’s graduation");
  });

  it("provides optional plan suggestions without clinical thresholds", () => {
    const suggestions = suggestedActionsFor("BLOOD_PRESSURE_CONTROL");
    expect(suggestions.length).toBeGreaterThan(2);
    expect(suggestions.every(item => !Object.hasOwn(item, "clinicalTarget"))).toBe(true);
  });
});
