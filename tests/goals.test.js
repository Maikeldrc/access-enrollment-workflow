import { describe, expect, it } from "vitest";
import { GOAL_CATEGORIES, GOAL_CONFIG, GOAL_ICON_REGISTRY, activeGoalActions, addGoalAction, createGoalAction, createPatientGoal, goalActionCount, goalActionIcon, goalActionIsPatientEditable, goalCategoryOf, goalContributionTarget, goalDisplayName, goalMayDeclareContribution, goalNextBestAction, isCarePlanGoal, isPersonalGoal, localDateKey, patientMayDeleteGoal, patientMayEditClinicalTarget, patientMayEditGoalWording, removeGoalAction, resolveGoalIcon, suggestedActionsFor, suggestedActionsForGoal, updateGoalAction } from "../src/goals.js";

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

  // Connected devices transmit on their own: the blood pressure monitor and the scale both send
  // their readings to the platform. So tracking is not the patient's job, and an action that tells
  // them to track asks for bookkeeping nobody wants from them. They take the measurement; the
  // platform records it. Both goals say check or weigh, never track.
  it("asks the patient to take the measurement, not to track what a device transmits", () => {
    // Narrow on purpose: following a nutrition plan is a real patient action, and "swiv" is simply
    // "follow" in Kreyòl. What is banned is tracking the measurement itself.
    const tracksAMeasurement = /track(ing)? (my |the )?(weight|blood pressure)|registrar (mi |la )?(peso|presi[oó]n)|swiv (pwa|tansyon)/i;
    for (const goalType of ["BLOOD_PRESSURE_CONTROL", "WEIGHT_MANAGEMENT"]) {
      for (const action of suggestedActionsFor(goalType)) {
        for (const locale of ["en", "es", "ht"]) {
          expect(action.title[locale]).not.toMatch(tracksAMeasurement);
        }
      }
    }
    expect(suggestedActionsFor("WEIGHT_MANAGEMENT")[0].title.en).toBe("Weigh myself regularly");
  });

  // The file writes a patient's own actions in the first person. A goal added later that slips into
  // "your" reads like an instruction from someone else, in the middle of a list that does not.
  it("keeps every configured action in the patient's own voice", () => {
    for (const goalType of Object.keys(GOAL_CONFIG)) {
      for (const action of suggestedActionsFor(goalType)) {
        expect(action.title.en).not.toMatch(/\byour\b/i);
      }
    }
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

describe("personal goals and the steps that serve them", () => {
  const personalGoal = (overrides = {}) => ({
    ...createPatientGoal({ type: "CUSTOM", personalTemplateId: "WALKING_ENDURANCE", id: "goal-personal" }),
    ...overrides
  });

  it("tells a goal the patient wrote from one the care plan assigned", () => {
    expect(isPersonalGoal(personalGoal())).toBe(true);
    expect(isCarePlanGoal(personalGoal())).toBe(false);
    const assigned = createPatientGoal({ type: "BLOOD_PRESSURE_CONTROL", id: "goal-bp" });
    expect(isPersonalGoal(assigned)).toBe(false);
    expect(isCarePlanGoal(assigned)).toBe(true);
  });

  it("lets the patient reword and remove their own goal, and neither on a care plan goal", () => {
    const own = personalGoal();
    const assigned = createPatientGoal({ type: "BLOOD_PRESSURE_CONTROL", id: "goal-bp" });
    expect(patientMayEditGoalWording(own)).toBe(true);
    expect(patientMayDeleteGoal(own)).toBe(true);
    expect(patientMayEditGoalWording(assigned)).toBe(false);
    expect(patientMayDeleteGoal(assigned)).toBe(false);
    // Not a permission the product grants to anyone, on any goal, ever.
    expect(patientMayEditClinicalTarget()).toBe(false);
    expect(own.patientCanEditClinicalTarget).toBe(false);
    expect(assigned.patientCanEditClinicalTarget).toBe(false);
  });

  it("localizes an accepted template sentence and never translates the patient's own words", () => {
    const accepted = personalGoal();
    expect(goalDisplayName(accepted, "en")).toBe("Be able to walk without getting so tired");
    expect(goalDisplayName(accepted, "es")).toBe("Mejorar mi capacidad para caminar sin cansarme tanto");
    const rewritten = personalGoal({ customTitle: "Poder caminar con mi esposa" });
    expect(goalDisplayName(rewritten, "en")).toBe("Poder caminar con mi esposa");
    expect(goalDisplayName(rewritten, "es")).toBe("Poder caminar con mi esposa");
  });

  it("draws a template-backed personal goal with its own category icon, not the generic target", () => {
    expect(goalCategoryOf(personalGoal())).toBe("ACTIVITY_MOBILITY");
    expect(resolveGoalIcon(personalGoal())).toBe("footprints");
    // A goal the patient wrote from scratch has not been classified by anyone, and says so.
    expect(resolveGoalIcon(createPatientGoal({ type: "CUSTOM", customTitle: "Something new", id: "g" }))).toBe(GOAL_ICON_REGISTRY.GENERIC);
  });

  it("suggests steps from the template a personal goal came from", () => {
    expect(suggestedActionsForGoal(personalGoal()).map(item => item.id)).toContain("walk-what-i-can");
    // Nobody has anything to suggest about a goal nobody has seen before, and that is not a gap.
    expect(suggestedActionsForGoal(createPatientGoal({ type: "CUSTOM", customTitle: "Something new", id: "g" }))).toEqual([]);
    expect(suggestedActionsForGoal(createPatientGoal({ type: "BLOOD_PRESSURE_CONTROL", id: "g" }))).toEqual(suggestedActionsFor("BLOOD_PRESSURE_CONTROL"));
    expect(suggestedActionsForGoal(null)).toEqual([]);
  });

  it("builds a patient-written step as something only the patient can report", () => {
    const step = createGoalAction({ goalId: "goal-1", title: "Walk 15 minutes", frequency: "few-days" });
    expect(step).toMatchObject({ goalId: "goal-1", title: "Walk 15 minutes", frequency: "few-days", actionType: "RECURRING", source: "PATIENT", verificationMethod: "PATIENT_REPORT", status: "ACTIVE" });
    expect(step.completionHistory).toEqual([]);
    // A step is not a goal and carries none of a goal's clinical vocabulary.
    expect(step).not.toHaveProperty("clinicalTarget");
    expect(step).not.toHaveProperty("baseline");
    expect(createGoalAction({ title: "Ask my doctor" }).actionType).toBe("ONE_TIME");
  });

  it("adds, changes and removes a step without touching the goal it belongs to", () => {
    const goal = personalGoal();
    const title = goalDisplayName(goal, "en");
    const step = addGoalAction(goal, { title: "Walk 15 minutes", frequency: "few-days" });
    expect(goalActionCount(goal)).toBe(1);

    updateGoalAction(goal, step.id, { title: "Walk 20 minutes", frequency: "daily" });
    expect(goal.actions[0].title).toBe("Walk 20 minutes");
    expect(goal.actions[0].frequency).toBe("daily");
    // The whole point: the step changed and the goal did not.
    expect(goalDisplayName(goal, "en")).toBe(title);
    expect(goal.customTitle).toBe("");

    removeGoalAction(goal, step.id);
    expect(goal.actions[0].status).toBe("REMOVED");
    // Removed, not deleted: the completion history is evidence of what the patient actually did.
    expect(goal.actions).toHaveLength(1);
    expect(activeGoalActions(goal)).toHaveLength(0);
    expect(goalActionCount(goal)).toBe(0);
  });

  // "The application may show that a personal goal contributes to the plan. But do not always
  // assume a relationship." The only thing that creates one is the patient saying so.
  it("links a personal goal to a plan goal only when the patient declared it", () => {
    const plan = createPatientGoal({ type: "BLOOD_PRESSURE_CONTROL", id: "goal-bp" });
    const own = personalGoal();
    // Same nothing, before anyone says anything — and the two share a health topic, which is
    // exactly the case where inferring a link would be tempting and wrong.
    expect(own.contributesToGoalId).toBe("");
    expect(goalContributionTarget(own, [plan, own])).toBeNull();

    own.contributesToGoalId = plan.id;
    expect(goalContributionTarget(own, [plan, own])).toBe(plan);
  });

  it("never lets a link claim more than the record supports", () => {
    const plan = createPatientGoal({ type: "BLOOD_PRESSURE_CONTROL", id: "goal-bp" });
    const other = personalGoal({ id: "goal-other" });
    const own = personalGoal({ contributesToGoalId: plan.id });

    // A plan goal the patient removed leaves no name behind.
    expect(goalContributionTarget(own, [{ ...plan, status: "REMOVED" }, own])).toBeNull();
    expect(goalContributionTarget(own, [own])).toBeNull();
    // A personal goal is never a contribution target: the plan is what a goal contributes to.
    expect(goalContributionTarget(personalGoal({ contributesToGoalId: other.id }), [other, own])).toBeNull();
    // And a care plan goal never declares one of its own.
    expect(goalMayDeclareContribution(plan)).toBe(false);
    expect(goalMayDeclareContribution(own)).toBe(true);
    expect(goalContributionTarget({ ...plan, contributesToGoalId: other.id }, [other, plan])).toBeNull();
  });

  it("refuses to add a step with no words in it", () => {
    const goal = personalGoal();
    expect(addGoalAction(goal, { title: "   " })).toBeNull();
    expect(goal.actions).toEqual([]);
    expect(addGoalAction(null, { title: "Walk" })).toBeNull();
  });

  it("will not let the patient reword or drop a step a monitor completes", () => {
    const goal = createPatientGoal({ type: "BLOOD_PRESSURE_CONTROL", id: "goal-bp" });
    const device = createGoalAction({ goalId: goal.id, templateId: "check-bp", title: "Check my blood pressure", source: "CARE_PLAN", verificationMethod: "DEVICE" });
    goal.actions = [device];
    expect(goalActionIsPatientEditable(device)).toBe(false);
    expect(updateGoalAction(goal, device.id, { title: "Something else" })).toBeNull();
    expect(removeGoalAction(goal, device.id)).toBeNull();
    expect(goal.actions[0].title).toBe("Check my blood pressure");
    expect(goal.actions[0].status).toBe("ACTIVE");
  });

  it("keeps a rewritten step as the patient's own rather than the template's", () => {
    const goal = personalGoal();
    const step = addGoalAction(goal, { templateId: "walk-what-i-can", title: "Take a walk I can manage", frequency: "few-days", source: "CARE_PLAN" });
    updateGoalAction(goal, step.id, { title: "Walk to the mailbox and back" });
    expect(goal.actions[0].templateId).toBe("");
    expect(goal.actions[0].source).toBe("PATIENT");
  });
});
