import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMMI_TOOL_DECLARATIONS, EmmiAuditLog, EmmiToolOrchestrator, selectDemoPatientId } from "../src/emmi/tools.js";
import { getEmmiQuickQuestions } from "../src/emmi/quickQuestions.js";
import { DEMO_BASELINE_OBSERVATIONS } from "../src/config.js";
import { accessProgressMeasure, patientStartingPoint } from "../src/accessCareActivation.js";

const memory = new Map();
// The demo patient's own baselines, resolved by the functions the goals screen uses rather than
// typed out here, so the runtime context a test hands EMMI is the one the patient would have.
const runtimeAccessBaselines = ["BLOOD_PRESSURE_CONTROL", "WEIGHT_MANAGEMENT"].map(goalType => {
  const startingPoint = patientStartingPoint(goalType, { BLOOD_PRESSURE_CONTROL: DEMO_BASELINE_OBSERVATIONS.bloodPressure, WEIGHT_MANAGEMENT: DEMO_BASELINE_OBSERVATIONS.weight });
  return { goalType, startingPoint, measure: accessProgressMeasure(goalType, startingPoint) };
});

const makeRuntime = (patientId = "DEMO-P001") => {
  const audit = new EmmiAuditLog({ sessionId: "TEST-SESSION", demoPatientId: patientId, locale: "EN", currentScreen: "INVITATION" });
  return { audit, tools: new EmmiToolOrchestrator({ getContext: () => ({ patientId, accessTrack: "eCKM", currentScreen: "MY_GOALS", locale: "EN", accessGoalBaselines: runtimeAccessBaselines, activeGoal: { id: "goal-bp", latestReading: { systolic: 120, diastolic: 80, classification: "WITHIN_EXPECTED_RANGE" }, readingTrend: { count: 5, averageSystolic: 124, averageDiastolic: 81, direction: "STABLE" }, clinicalTarget: { systolicMaximum: 139, diastolicMaximum: 89 }, progress: { readingCountThisWeek: 5 }, actions: [{ id: "action-bp", verificationMethod: "DEVICE" }], nextBestEducation: { id: "bp-numbers" } } }), auditLog: audit }) };
};

beforeEach(() => {
  memory.clear();
  vi.stubGlobal("localStorage", { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) });
});

describe("EMMI prototype tools", () => {
  it("selects only fictional demo fixtures for contextual scenarios", () => {
    expect(selectDemoPatientId({ language: "es" })).toBe("DEMO-P002");
    expect(selectDemoPatientId({ completionRole: "personalRepresentative" })).toBe("DEMO-P003");
    expect(selectDemoPatientId({ eligibilityStatus: "notEligible" })).toBe("DEMO-P004");
    expect(selectDemoPatientId({ deviceScenario: { patientOwnsMonitor: true, integrationStatus: "UNSUPPORTED" } })).toBe("DEMO-P006");
  });

  it("uses authoritative fixture data for cost and connected-device answers", async () => {
    const { tools } = makeRuntime();
    // The cost tool now returns the engine's structured result: a gross amount from the track
    // configuration, and a $0 expected payment justified by verified supplemental coverage.
    expect(await tools.execute("getExpectedAccessCost", { patientId: "DEMO-P001", accessTrack: "eCKM" })).toMatchObject({
      grossBeneficiaryResponsibility: 6, expectedPatientPayment: 0, currency: "USD",
      explanationCode: "SUPPLEMENTAL_COVERS_COST_SHARE", responsibilityType: "EXPECTED"
    });
    expect(await tools.execute("getPatientCoverage", { patientId: "DEMO-P001" })).toMatchObject({ found: true });
    expect(await tools.execute("getAssignedDevice", { patientId: "DEMO-P001" })).toMatchObject({ found: true, vendor: "TENOVI", integrationStatus: "CONNECTED" });
  });

  it("returns goal readings and trends from runtime instead of model inference", async () => {
    const { tools } = makeRuntime();
    expect(await tools.execute("getLatestReading", { patientId: "DEMO-P001", metricType: "BLOOD_PRESSURE" })).toMatchObject({ source: "PATIENT_RUNTIME", reading: { systolic: 120, diastolic: 80 } });
    expect(await tools.execute("getReadingTrend", { patientId: "DEMO-P001", metricType: "BLOOD_PRESSURE", periodDays: 7 })).toMatchObject({ source: "DETERMINISTIC_ANALYTICS", trend: { count: 5, direction: "STABLE" } });
    expect(await tools.execute("getClinicalTarget", { patientId: "DEMO-P001", metricType: "BLOOD_PRESSURE" })).toMatchObject({ source: "CARE_TEAM_CONFIGURATION", target: { systolicMaximum: 139 } });
  });

  it("distinguishes no device from a patient-owned unsupported device", async () => {
    expect(await makeRuntime("DEMO-P002").tools.execute("getAssignedDevice", { patientId: "DEMO-P002" })).toMatchObject({ found: false, patientOwnsMonitor: false });
    expect(await makeRuntime("DEMO-P006").tools.execute("getAssignedDevice", { patientId: "DEMO-P006" })).toMatchObject({ found: false, patientOwnsMonitor: true, integrationStatus: "UNSUPPORTED" });
  });

  it("requires explicit confirmation before callback or care-team task creation", async () => {
    const { tools } = makeRuntime();
    expect(await tools.execute("requestCallback", { patientId: "DEMO-P001", reason: "Help", preferredLanguage: "EN", confirmed: false })).toMatchObject({ success: false, status: "CONFIRMATION_REQUIRED" });
    expect(await tools.execute("createCareTeamTask", { patientId: "DEMO-P001", category: "support", reason: "Help", priority: "NORMAL", confirmed: false })).toMatchObject({ success: false, status: "CONFIRMATION_REQUIRED" });
    expect(await tools.execute("requestCallback", { patientId: "DEMO-P001", reason: "Help", preferredLanguage: "EN", confirmed: true })).toMatchObject({ success: true, status: "REQUESTED" });
  });

  it("applies deterministic mock clinical escalation rules", async () => {
    const { tools } = makeRuntime();
    expect((await tools.execute("evaluateClinicalEscalation", { systolic: 130, diastolic: 80, symptoms: "none" })).severity).toBe("NORMAL");
    expect((await tools.execute("evaluateClinicalEscalation", { systolic: 165, diastolic: 101, symptoms: "none" })).severity).toBe("CARE_TEAM_REVIEW");
    expect((await tools.execute("evaluateClinicalEscalation", { systolic: 181, diastolic: 121, symptoms: "none" })).severity).toBe("EMERGENCY");
    expect((await tools.execute("evaluateClinicalEscalation", { systolic: 0, diastolic: 0, symptoms: "chest pain" })).instruction).toBe("CALL_911");
    expect((await tools.execute("evaluateClinicalEscalation", { systolic: 0, diastolic: 0, symptoms: "I passed out after taking it" })).instruction).toBe("CALL_911");
  });

  // The tool hands over the resolved shapes untouched. If it ever started deriving a milestone of
  // its own, EMMI and the goals card could round the same baseline differently and both look right.
  it("returns the resolved ACCESS baselines for one goal without recomputing anything", async () => {
    const { tools } = makeRuntime();
    const all = await tools.execute("getAccessBaseline", { patientId: "DEMO-P001" });
    expect(all.baselines.map(item => item.goalType)).toEqual(["BLOOD_PRESSURE_CONTROL", "WEIGHT_MANAGEMENT"]);
    expect(all.source).toBe("PATIENT_RUNTIME");

    const weight = await tools.execute("getAccessBaseline", { patientId: "DEMO-P001", goalType: "WEIGHT_MANAGEMENT" });
    expect(weight.baselines).toHaveLength(1);
    expect(weight.baselines[0].startingPoint).toMatchObject({ status: "CONFIRMED", value: 204, bmi: 31 });
    expect(weight.baselines[0].measure.improvementMilestone).toMatchObject({ value: 193.8, reductionFromBaseline: 10.2 });
  });

  it("reports no baselines rather than an empty-looking one when the patient has none", async () => {
    const tools = new EmmiToolOrchestrator({ getContext: () => ({ patientId: "DEMO-P001" }), auditLog: new EmmiAuditLog({ sessionId: "TEST-SESSION", demoPatientId: "DEMO-P001", locale: "EN", currentScreen: "INVITATION" }) });
    expect(await tools.execute("getAccessBaseline", { patientId: "DEMO-P001" })).toEqual({ baselines: [], source: "UNAVAILABLE" });
  });

  it("exposes no tool that can consent, attest authority, enroll, or change eligibility", () => {
    const names = EMMI_TOOL_DECLARATIONS[0].functionDeclarations.map(item => item.name).join(" ");
    expect(names).not.toMatch(/consent|enrollPatient|attest|changeEligibility/i);
  });

  it("audit logs safe metadata but never transcript text, audio, tokens, or API keys", async () => {
    const { tools, audit } = makeRuntime();
    audit.transcript("user", "What will ACCESS cost?");
    await tools.execute("getExpectedAccessCost", { patientId: "DEMO-P001", accessTrack: "eCKM" });
    const serialized = JSON.stringify(EmmiAuditLog.all());
    expect(serialized).toContain("getExpectedAccessCost");
    expect(serialized).not.toContain("What will ACCESS cost?");
    expect(serialized).not.toMatch(/audioData|apiKey|ephemeralToken|GEMINI_API_KEY/i);
  });

  it("records non-PHI voice identity metadata for consistency debugging", () => {
    const { audit } = makeRuntime();
    audit.voiceEvent("EMMI_VOICE_SESSION_CONFIGURED", { voiceId: "Sulafat", voiceVersion: "emmi-voice-v1", provider: "gemini-live", locale: "EN", screenId: "INVITATION", connectionId: "voice-1" });
    const entry = EmmiAuditLog.all().at(-1);
    expect(entry).toMatchObject({ voiceId: "Sulafat", voiceVersion: "emmi-voice-v1", voiceProvider: "gemini-live" });
    expect(entry.voiceEvents.at(-1)).toMatchObject({ type: "EMMI_VOICE_SESSION_CONFIGURED", voiceId: "Sulafat", screenId: "INVITATION" });
  });
});

describe("EMMI suggestions on the ACCESS activation screens", () => {
  const ask = (currentScreen, program = "ACCESS") =>
    getEmmiQuickQuestions({ currentScreen, program, locale: "en" }).map(item => item.label || item.copy || "").join(" | ");

  // Offering "can I change a goal later?" to a patient whose goals are assigned invites them to
  // expect control they do not have, and then to feel overruled when they discover otherwise.
  it("asks what an ACCESS patient actually arrives with, and leaves the chooser alone", () => {
    expect(ask("GOALS")).toMatch(/Did I choose these goals\?/);
    expect(ask("GOALS")).toMatch(/15 mmHg lower/);
    expect(ask("GOALS")).not.toMatch(/personalize my plan/i);
    expect(ask("GOALS", "CCM")).toMatch(/personalize my plan/i);
  });

  // Before a reading exists, My Goals falls back to a generic set that offers "can I change a goal
  // later?" — the question the ACCESS goals screen deliberately does not ask. The patient's goals
  // are no more theirs to change here than they were there.
  it("keeps the assigned-goal wording on My Goals, where an ACCESS patient with no readings lands", () => {
    const askWithGoal = program => getEmmiQuickQuestions({ currentScreen: "MY_GOALS", program, locale: "en", context: { activeGoal: { id: "goal-bp" } } })
      .map(item => item.label).join(" | ");
    expect(askWithGoal("ACCESS")).toMatch(/What was my starting blood pressure\?/);
    expect(askWithGoal("ACCESS")).not.toMatch(/change a goal later/i);
    expect(askWithGoal("CCM")).toMatch(/change a goal later/i);
  });

  it("offers the barrier screen's own questions", () => {
    expect(ask("ACCESS_SUPPORT_NEEDS")).toMatch(/Why are you asking/);
    expect(ask("ACCESS_SUPPORT_NEEDS")).toMatch(/forget my medications/);
  });

  // The arm restriction question left the device screen, so suggesting it invites a question the
  // screen no longer answers.
  it("stops offering the arm question the device screen no longer asks", () => {
    expect(ask("ACCESS_BP_DEVICE_INFO")).toMatch(/cuff size/i);
    expect(ask("ACCESS_BP_DEVICE_INFO")).not.toMatch(/which arm/i);
  });
});
