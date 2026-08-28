import { describe, expect, it } from "vitest";
import {
  BARRIER_CATEGORIES,
  BARRIER_SOURCES,
  BARRIER_STATUS,
  INTERVENTION_TYPES,
  RESOLUTION_OUTCOMES,
  RESOLUTION_PATHS,
  applyIntervention,
  barrierAnalytics,
  barrierOptionsFor,
  barrierPatientStatus,
  careTeamEscalationSummary,
  classifyBarrierText,
  confirmBarrier,
  createGoalBarrier,
  findReusableBarrier,
  normalizeBarrierRecord,
  recordInterventionOutcome,
  reopenBarrier,
  resolveBarrier
} from "../src/goalBarriers.js";

const bpGoal = {
  id: "goal-bp",
  goalType: "BLOOD_PRESSURE_CONTROL",
  actions: [
    { id: "a1", templateId: "check-bp" },
    { id: "a2", templateId: "medications-as-directed" },
    { id: "a3", templateId: "reduce-salt" }
  ]
};

describe("barrier record", () => {
  it("opens a patient-reported difficulty and carries the category's owner and scope", () => {
    const barrier = createGoalBarrier({ goalId: "goal-bp", category: "FORGETFULNESS_ROUTINE", patientDescription: "I keep forgetting", id: "b1", detectedAt: "2026-08-27T10:00:00.000Z" });
    expect(barrier).toMatchObject({
      id: "b1",
      goalId: "goal-bp",
      category: "FORGETFULNESS_ROUTINE",
      status: BARRIER_STATUS.OPEN,
      source: BARRIER_SOURCES.PATIENT,
      owner: "EMMI",
      scope: "ACTION",
      confirmedAt: "2026-08-27T10:00:00.000Z",
      interventions: [],
      resolutionOutcome: null
    });
  });

  // The rule the whole system rests on: something the platform noticed is a question, not a cause.
  it("keeps a system signal suspected until the patient confirms it", () => {
    const suspected = createGoalBarrier({ goalId: "goal-bp", category: "FORGETFULNESS_ROUTINE", source: BARRIER_SOURCES.SYSTEM_SIGNAL });
    expect(suspected.status).toBe(BARRIER_STATUS.SUSPECTED);
    expect(suspected.confirmedAt).toBeNull();

    const confirmed = confirmBarrier(suspected, { category: "DEVICE_TECHNOLOGY", patientDescription: "The cuff won’t inflate", now: "2026-08-28T09:00:00.000Z" });
    expect(confirmed).toMatchObject({ status: BARRIER_STATUS.OPEN, source: BARRIER_SOURCES.PATIENT, category: "DEVICE_TECHNOLOGY", confirmedAt: "2026-08-28T09:00:00.000Z" });
  });

  it("captures appointment fields a scheduler will need without scheduling anything", () => {
    const barrier = createGoalBarrier({ category: "APPOINTMENT_NEED", appointmentRequest: { requestedProfessionalType: "CARDIOLOGIST", reasonSummary: "Wants to discuss readings" } });
    expect(barrier.appointmentRequest).toMatchObject({
      requestedProfessionalType: "CARDIOLOGIST",
      reasonSummary: "Wants to discuss readings",
      urgencyClassification: "ROUTINE",
      appointmentStatus: "NOT_SCHEDULED"
    });
    expect(barrier.appointmentRequest).not.toHaveProperty("scheduledAt");
  });

  it("reads a barrier saved before this model instead of dropping it", () => {
    const legacy = normalizeBarrierRecord({ id: "old", goalId: "goal-bp", barrierType: "MONITOR_HELP", notes: "cannot use it", status: "OPEN" });
    expect(legacy).toMatchObject({ category: "DEVICE_TECHNOLOGY", patientDescription: "cannot use it", interventions: [] });
  });
});

describe("barrier classification", () => {
  it.each([
    ["I don’t understand what 150 over 90 means", "UNDERSTANDING"],
    ["I always forget", "FORGETFULNESS_ROUTINE"],
    ["I don’t know how to use this machine", "DEVICE_TECHNOLOGY"],
    ["This medicine makes me feel bad", "MEDICATION_CONCERN"],
    ["I have nobody to drive me to the doctor", "TRANSPORTATION"],
    ["I need to see my cardiologist", "APPOINTMENT_NEED"],
    ["Se me olvida tomarme la presión", "FORGETFULNESS_ROUTINE"],
    ["Mwen pa konprann chif yo", "UNDERSTANDING"],
    ["No tengo quien me lleve", "TRANSPORTATION"]
  ])("classifies %s", (text, category) => {
    expect(classifyBarrierText(text).category).toBe(category);
  });

  // A symptom hiding inside an everyday sentence must not be filed as an everyday difficulty.
  it("puts a symptom ahead of the difficulty it hides behind", () => {
    expect(classifyBarrierText("I can’t walk because I’m extremely short of breath").category).toBe("CLINICAL_SYMPTOM");
    // A medicine that makes the patient feel unwell is named for what it is. Both categories reach
    // the safety engine first, but only this one forbids EMMI from touching the medicine.
    const medication = classifyBarrierText("I stopped the medicine because it makes me dizzy");
    expect(medication.category).toBe("MEDICATION_CONCERN");
    expect(BARRIER_CATEGORIES[medication.category].requiresSafetyEvaluation).toBe(true);
  });

  it("falls back to OTHER rather than guessing", () => {
    expect(classifyBarrierText("mmm").category).toBe("OTHER");
    expect(classifyBarrierText("").category).toBe("");
  });
});

describe("contextual options", () => {
  it("builds the list from the patient's own plan", () => {
    const options = barrierOptionsFor({ goal: bpGoal, hasDevice: true }).map(item => item.category);
    expect(options).toContain("DEVICE_TECHNOLOGY");
    expect(options).toContain("NUTRITION");
    expect(options).toContain("MEDICATION_UNDERSTANDING");
    expect(options.at(-1)).toBe("OTHER");
  });

  it("does not offer a monitor problem to a goal with no monitor", () => {
    const options = barrierOptionsFor({ goal: { id: "g2", goalType: "STAY_INDEPENDENT", actions: [{ id: "x", templateId: "safe-routine" }] } }).map(item => item.category);
    expect(options).not.toContain("DEVICE_TECHNOLOGY");
    expect(options).not.toContain("NUTRITION");
    expect(options).toContain("FORGETFULNESS_ROUTINE");
  });

  it("stays short enough to read on one screen and localizes the labels", () => {
    const options = barrierOptionsFor({ goal: bpGoal, hasDevice: true, locale: "es" });
    expect(options.length).toBeLessThanOrEqual(8);
    expect(options.find(item => item.category === "FORGETFULNESS_ROUTINE").label).toBe("Se me olvida hacerlo");
  });
});

describe("resolution engine", () => {
  it("offers EMMI's own help first for a low-risk difficulty", () => {
    const barrier = createGoalBarrier({ category: "UNDERSTANDING", goalId: "goal-bp" });
    expect(resolveBarrier({ barrier })).toMatchObject({ path: RESOLUTION_PATHS.EMMI_SELF_SERVICE, intervention: INTERVENTION_TYPES.EDUCATION, owner: "EMMI" });
  });

  // Safety outranks coaching: nobody is offered a reminder while reporting a symptom.
  it("sends anything needing safety review to the safety engine before any coaching", () => {
    const barrier = createGoalBarrier({ category: "CLINICAL_SYMPTOM", patientDescription: "chest pain" });
    const gate = resolveBarrier({ barrier });
    expect(gate).toMatchObject({ path: RESOLUTION_PATHS.CLINICAL_SAFETY, requiresSafetyEvaluation: true, intervention: null });

    const escalated = resolveBarrier({ barrier, safetyResult: { severity: "EMERGENCY", instruction: "CALL_911" } });
    expect(escalated).toMatchObject({ path: RESOLUTION_PATHS.CLINICAL_SAFETY, intervention: INTERVENTION_TYPES.SAFETY_ESCALATION, severity: "EMERGENCY" });
  });

  it("never lets EMMI touch a medication concern herself", () => {
    const barrier = createGoalBarrier({ category: "MEDICATION_CONCERN" });
    const resolution = resolveBarrier({ barrier, safetyResult: { severity: "NORMAL" } });
    expect(resolution.intervention).toBe(INTERVENTION_TYPES.CARE_TEAM_TASK);
    expect(resolution.prohibited).toContain("MEDICATION_CHANGE_BY_EMMI");
    expect(BARRIER_CATEGORIES.MEDICATION_CONCERN.interventions).not.toContain(INTERVENTION_TYPES.REMINDER);
  });

  it("moves to the next intervention instead of repeating one that did not help", () => {
    let barrier = createGoalBarrier({ category: "FORGETFULNESS_ROUTINE" });
    expect(resolveBarrier({ barrier }).intervention).toBe(INTERVENTION_TYPES.REMINDER);

    barrier = applyIntervention(barrier, { type: INTERVENTION_TYPES.REMINDER, detail: { time: "08:00" } });
    barrier = recordInterventionOutcome(barrier, { outcome: RESOLUTION_OUTCOMES.NOT_HELPED });
    expect(resolveBarrier({ barrier }).intervention).toBe(INTERVENTION_TYPES.ROUTINE_ADJUSTMENT);

    barrier = applyIntervention(barrier, { type: INTERVENTION_TYPES.ROUTINE_ADJUSTMENT });
    barrier = recordInterventionOutcome(barrier, { outcome: RESOLUTION_OUTCOMES.NOT_HELPED });
    barrier = applyIntervention(barrier, { type: INTERVENTION_TYPES.CARE_CIRCLE });
    barrier = recordInterventionOutcome(barrier, { outcome: RESOLUTION_OUTCOMES.PATIENT_DECLINED });
    expect(resolveBarrier({ barrier }).intervention).toBe(INTERVENTION_TYPES.CARE_TEAM_TASK);
  });

  it("skips help the patient has no way to use", () => {
    const barrier = createGoalBarrier({ category: "DEVICE_TECHNOLOGY" });
    expect(resolveBarrier({ barrier, capabilities: { hasDevice: false, careCircleAvailable: false } }).intervention).toBe(INTERVENTION_TYPES.DEVICE_SUPPORT_TASK);
  });
});

describe("interventions and follow-up", () => {
  it("does not resolve a barrier just because a reminder was created", () => {
    const barrier = applyIntervention(createGoalBarrier({ category: "FORGETFULNESS_ROUTINE" }), { type: INTERVENTION_TYPES.REMINDER, detail: { time: "08:00" }, now: "2026-08-27T10:00:00.000Z" });
    expect(barrier.status).toBe(BARRIER_STATUS.IN_PROGRESS);
    expect(barrier.resolvedAt).toBeNull();
    expect(barrier.followUpAt).toBe("2026-08-30T10:00:00.000Z");
  });

  it("keeps every intervention in history rather than overwriting the last one", () => {
    let barrier = applyIntervention(createGoalBarrier({ category: "DEVICE_TECHNOLOGY" }), { type: INTERVENTION_TYPES.DEVICE_GUIDANCE });
    barrier = recordInterventionOutcome(barrier, { outcome: RESOLUTION_OUTCOMES.NOT_HELPED });
    barrier = applyIntervention(barrier, { type: INTERVENTION_TYPES.DEVICE_SUPPORT_TASK });
    expect(barrier.interventions).toHaveLength(2);
    expect(barrier.interventions[0]).toMatchObject({ type: INTERVENTION_TYPES.DEVICE_GUIDANCE, outcome: RESOLUTION_OUTCOMES.NOT_HELPED });
    expect(barrier.status).toBe(BARRIER_STATUS.WAITING_FOR_CARE_TEAM);
    expect(barrier.owner).toBe("DEVICE_SUPPORT");
  });

  it("resolves only when the outcome says so, and reopens on a decline", () => {
    const started = applyIntervention(createGoalBarrier({ category: "UNDERSTANDING" }), { type: INTERVENTION_TYPES.EDUCATION });
    expect(recordInterventionOutcome(started, { outcome: RESOLUTION_OUTCOMES.RESOLVED }).status).toBe(BARRIER_STATUS.RESOLVED);
    expect(recordInterventionOutcome(started, { outcome: RESOLUTION_OUTCOMES.PARTIALLY_HELPED }).status).toBe(BARRIER_STATUS.OPEN);
    // Declining help is a patient choice, never a failure state.
    expect(recordInterventionOutcome(started, { outcome: RESOLUTION_OUTCOMES.PATIENT_DECLINED }).resolutionOutcome).toBeNull();
  });

  it("refuses an intervention its category prohibits", () => {
    const barrier = createGoalBarrier({ category: "MEDICATION_CONCERN" });
    expect(applyIntervention(barrier, { type: INTERVENTION_TYPES.REMINDER })).toBe(barrier);
  });
});

describe("duplicates, recurrence and reporting", () => {
  it("reuses an active barrier instead of creating a second one for the same difficulty", () => {
    const active = createGoalBarrier({ id: "b-active", goalId: "goal-bp", category: "FORGETFULNESS_ROUTINE" });
    expect(findReusableBarrier([active], { category: "FORGETFULNESS_ROUTINE", goalId: "goal-bp" })).toBe(active);
    expect(findReusableBarrier([active], { category: "UNDERSTANDING", goalId: "goal-bp" })).toBeNull();
  });

  it("reopens a resolved barrier with its history and a recurrence count", () => {
    const resolved = recordInterventionOutcome(applyIntervention(createGoalBarrier({ id: "b", goalId: "goal-bp", category: "UNDERSTANDING" }), { type: INTERVENTION_TYPES.EDUCATION }), { outcome: RESOLUTION_OUTCOMES.RESOLVED });
    const again = reopenBarrier(resolved, { patientDescription: "still confusing" });
    expect(again).toMatchObject({ status: BARRIER_STATUS.OPEN, recurrenceCount: 1, resolvedAt: null });
    expect(again.interventions).toHaveLength(1);
  });

  it("finds a global barrier from any goal, because transportation is not one goal's problem", () => {
    const transport = createGoalBarrier({ id: "b-global", goalId: "goal-bp", category: "TRANSPORTATION" });
    expect(transport.scope).toBe("GLOBAL_CARE");
    expect(findReusableBarrier([transport], { category: "TRANSPORTATION", goalId: "goal-diabetes" })).toBe(transport);
  });

  it("speaks to the patient in plain language, never in status enums", () => {
    expect(barrierPatientStatus({ status: BARRIER_STATUS.IN_PROGRESS })).toBe("We’re working on this");
    expect(barrierPatientStatus({ status: BARRIER_STATUS.WAITING_FOR_CARE_TEAM }, "es")).toBe("Esperando a su equipo de atención");
    expect(barrierPatientStatus({ status: BARRIER_STATUS.SUSPECTED }, "ht")).toBe("EMMI gen yon kesyon sou sa");
  });

  it("keeps what the patient wrote out of analytics", () => {
    const barrier = applyIntervention(createGoalBarrier({ category: "FORGETFULNESS_ROUTINE", patientDescription: "I forget after my grandson leaves" }), { type: INTERVENTION_TYPES.REMINDER });
    const payload = barrierAnalytics(barrier);
    expect(JSON.stringify(payload)).not.toContain("grandson");
    expect(payload).toMatchObject({ category: "FORGETFULNESS_ROUTINE", interventionCount: 1, lastIntervention: INTERVENTION_TYPES.REMINDER });
  });

  it("hands the care team a structured summary rather than a transcript", () => {
    let barrier = applyIntervention(createGoalBarrier({ category: "DEVICE_TECHNOLOGY", patientDescription: "I can’t get it to work" }), { type: INTERVENTION_TYPES.DEVICE_GUIDANCE });
    barrier = recordInterventionOutcome(barrier, { outcome: RESOLUTION_OUTCOMES.NOT_HELPED });
    const summary = careTeamEscalationSummary({ barrier, goalTitle: "Keep my blood pressure under control", request: "DEVICE_SUPPORT_CALL" });
    expect(summary).toMatchObject({
      goal: "Keep my blood pressure under control",
      barrierCategory: "DEVICE_TECHNOLOGY",
      patientDescription: "I can’t get it to work",
      request: "DEVICE_SUPPORT_CALL"
    });
    expect(summary.emmiAttempts).toEqual([{ type: INTERVENTION_TYPES.DEVICE_GUIDANCE, outcome: RESOLUTION_OUTCOMES.NOT_HELPED }]);
  });
});
