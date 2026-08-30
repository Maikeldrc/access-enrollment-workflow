import { describe, expect, it } from "vitest";
import { GOAL_CATEGORIES, GOAL_CONFIG, GOAL_ICON_REGISTRY, createPatientGoal, goalActionIcon, goalCategoryOf, goalDisplayName, goalNextBestAction, localDateKey, resolveGoalIcon, suggestedActionsFor } from "../src/goals.js";

describe("patient goal model", () => {
  it("keeps a patient goal separate from clinical targets", () => {
    const goal = createPatientGoal({ type: "BLOOD_PRESSURE_CONTROL", patientId: "patient-1", now: "2026-08-27T10:00:00.000Z", id: "goal-1" });
    expect(goal).toMatchObject({ id: "goal-1", patientId: "patient-1", goalType: "BLOOD_PRESSURE_CONTROL", status: "ACTIVE", priority: "NONE", planStatus: "NOT_STARTED", planPersonalizationStatus: "NOT_STARTED", goalSource: "PATHWAY", selectedBy: "PATIENT", createdBy: "PATHWAY", patientCanEditClinicalTarget: false });
    expect(goal).not.toHaveProperty("targetSystolic");
    expect(goal).not.toHaveProperty("targetDiastolic");
    expect(goal).not.toHaveProperty("clinicalTarget");
  });

  it("keeps a patient-reported goal pending care-team review", () => {
    const goal = createPatientGoal({ type: "CUSTOM", customTitle: "Attend my granddaughter’s graduation", id: "goal-custom" });
    expect(goal).toMatchObject({ goalSource: "PATIENT", selectedBy: "PATIENT", careTeamReviewStatus: "PENDING", clinicalTargetId: null });
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

describe("goal category iconography", () => {
  // The whole point of the category layer: a patient sees six recognizable families instead of
  // the same target seven times.
  it("gives every configured goal a category icon and never repeats the generic target", () => {
    const icons = Object.keys(GOAL_CONFIG).map(goalType => resolveGoalIcon({ goalType }));
    expect(icons).toEqual(["heart", "scale", "home", "shield", "pill", "smile", "footprints", "goals"]);
    expect(new Set(icons).size).toBe(icons.length);
    expect(icons.filter(name => name === GOAL_ICON_REGISTRY.GENERIC)).toHaveLength(1);
  });

  it("resolves the icon from structured metadata, never from the goal's wording", () => {
    // Same goal, three languages, one icon.
    const goal = { goalType: "MEDICATION_UNDERSTANDING" };
    for (const locale of ["en", "es", "ht"]) {
      expect(goalDisplayName(goal, locale)).not.toBe("");
      expect(resolveGoalIcon(goal)).toBe("pill");
    }
    // A goal whose title mentions blood pressure but is categorised as medications stays a pill.
    expect(resolveGoalIcon({ goalType: "CUSTOM", customTitle: "Keep my blood pressure under control", goalCategory: "MEDICATIONS" })).toBe("pill");
  });

  it("lets a goal override its category icon without changing its category", () => {
    // Avoiding hospital visits is still prevention, but a patient recognises the place they are
    // trying to stay out of faster than the abstract shield the category draws.
    const goal = { goalType: "AVOID_HOSPITAL_VISITS" };
    expect(goalCategoryOf(goal)).toBe("PREVENTION");
    expect(resolveGoalIcon(goal, name => ["hospital", "shield"].includes(name))).toBe("hospital");
    // The override is validated, so an icon the renderer cannot draw falls back to the category.
    expect(resolveGoalIcon(goal, name => name === "shield")).toBe("shield");
  });

  it("prefers an explicit override, then the category, then the generic target", () => {
    expect(resolveGoalIcon({ goalType: "BLOOD_PRESSURE_CONTROL", iconKey: "scale" })).toBe("scale");
    expect(resolveGoalIcon({ goalType: "BLOOD_PRESSURE_CONTROL" })).toBe("heart");
    expect(resolveGoalIcon({ goalType: "CUSTOM" })).toBe("goals");
  });

  it("degrades instead of breaking on unknown goals, categories and icon keys", () => {
    expect(resolveGoalIcon(null)).toBe("goals");
    expect(resolveGoalIcon({})).toBe("goals");
    expect(resolveGoalIcon({ goalType: "NOT_A_GOAL" })).toBe("goals");
    expect(resolveGoalIcon({ goalType: "NOT_A_GOAL", goalCategory: "NOT_A_CATEGORY" })).toBe("goals");
    // An override naming an icon the renderer cannot draw falls back to the category, not a blank.
    expect(resolveGoalIcon({ goalType: "MEDICATION_UNDERSTANDING", iconKey: "definitely-not-an-icon" })).toBe("pill");
    expect(resolveGoalIcon({ goalType: "MEDICATION_UNDERSTANDING", iconKey: 42 })).toBe("pill");
    expect(goalCategoryOf({ goalCategory: "NOT_A_CATEGORY" })).toBe("GENERIC");
  });

  it("keeps goals persisted before categories existed working", () => {
    // A legacy stored goal carries no goalCategory; the definition still supplies one.
    expect(resolveGoalIcon({ id: "g1", goalType: "STAY_ACTIVE", status: "ACTIVE" })).toBe("footprints");
    expect(goalCategoryOf({ id: "g1", goalType: "AVOID_HOSPITAL_VISITS" })).toBe("PREVENTION");
  });

  it("stores the category on new goals so a saved goal is self-describing", () => {
    expect(createPatientGoal({ type: "BLOOD_PRESSURE_CONTROL" })).toMatchObject({ goalCategory: "CARDIOVASCULAR", iconKey: null });
    expect(createPatientGoal({ type: "CUSTOM", customTitle: "Walk to church" })).toMatchObject({ goalCategory: "GENERIC" });
  });

  it("keeps the taxonomy small and the action icons independent of it", () => {
    expect(GOAL_CATEGORIES.length).toBeGreaterThanOrEqual(8);
    expect(GOAL_CATEGORIES.length).toBeLessThanOrEqual(12);
    // A cardiovascular goal's actions are not all HeartPulse.
    const actionIcons = suggestedActionsFor("BLOOD_PRESSURE_CONTROL").map(action => goalActionIcon(action.id));
    expect(new Set(actionIcons).size).toBeGreaterThan(1);
    expect(actionIcons).not.toEqual(actionIcons.map(() => resolveGoalIcon({ goalType: "BLOOD_PRESSURE_CONTROL" })));
  });
});

describe("the patient's calendar day", () => {
  // Before this, an evening in Miami was already tomorrow in UTC, so a reading taken at 8:42am
  // stopped counting as today the moment the clock passed 8pm.
  it("uses local dates, so today does not roll over at 8pm Eastern", () => {
    const eveningLocal = new Date(2026, 7, 27, 21, 4, 0);
    expect(localDateKey(eveningLocal)).toBe("2026-08-27");
    const morningReading = new Date(2026, 7, 27, 8, 42, 0);
    expect(localDateKey(morningReading)).toBe(localDateKey(eveningLocal));
  });
});

describe("next best action with an active difficulty", () => {
  const plannedGoal = { id: "g1", goalType: "STAY_ACTIVE", planStatus: "COMPLETED", actions: [{ id: "a1", status: "ACTIVE", completionHistory: [] }] };

  it("puts a difficulty waiting on the patient ahead of the care plan", () => {
    expect(goalNextBestAction(plannedGoal, { barriers: [{ id: "b1", status: "OPEN", category: "DEVICE_TECHNOLOGY" }] }))
      .toMatchObject({ key: "RESOLVE_BARRIER", barrierId: "b1", barrierCategory: "DEVICE_TECHNOLOGY" });
    expect(goalNextBestAction(plannedGoal, { barriers: [{ id: "b2", status: "SUSPECTED", category: "DEVICE_TECHNOLOGY" }] }))
      .toMatchObject({ key: "CONFIRM_BARRIER", barrierId: "b2" });
  });

  it("leaves the plan in charge once the difficulty is being handled", () => {
    expect(goalNextBestAction(plannedGoal, { barriers: [{ id: "b1", status: "IN_PROGRESS" }, { id: "b2", status: "WAITING_FOR_CARE_TEAM" }] }))
      .toMatchObject({ key: "COMPLETE_ACTION" });
  });
});
