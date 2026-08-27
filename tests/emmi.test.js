import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMMI_TOOL_DECLARATIONS, EmmiAuditLog, EmmiToolOrchestrator, selectDemoPatientId } from "../src/emmi/tools.js";

const memory = new Map();
const makeRuntime = (patientId = "DEMO-P001") => {
  const audit = new EmmiAuditLog({ sessionId: "TEST-SESSION", demoPatientId: patientId, locale: "EN", currentScreen: "INVITATION" });
  return { audit, tools: new EmmiToolOrchestrator({ getContext: () => ({ patientId, accessTrack: "eCKM", currentScreen: "INVITATION", locale: "EN" }), auditLog: audit }) };
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
    expect(await tools.execute("getExpectedAccessCost", { patientId: "DEMO-P001", accessTrack: "eCKM" })).toMatchObject({ expectedMonthlyCost: 6, currency: "USD" });
    expect(await tools.execute("getAssignedDevice", { patientId: "DEMO-P001" })).toMatchObject({ found: true, vendor: "TENOVI", integrationStatus: "CONNECTED" });
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

  it("exposes no tool that can consent, attest authority, enroll, or change eligibility", () => {
    const names = EMMI_TOOL_DECLARATIONS[0].functionDeclarations.map(item => item.name).join(" ");
    expect(names).not.toMatch(/consent|enrollPatient|attest|changeEligibility/i);
  });

  it("audit logs transcripts and tool results but never audio, tokens, or API keys", async () => {
    const { tools, audit } = makeRuntime();
    audit.transcript("user", "What will ACCESS cost?");
    await tools.execute("getExpectedAccessCost", { patientId: "DEMO-P001", accessTrack: "eCKM" });
    const serialized = JSON.stringify(EmmiAuditLog.all());
    expect(serialized).toContain("getExpectedAccessCost");
    expect(serialized).not.toMatch(/audioData|apiKey|ephemeralToken|GEMINI_API_KEY/i);
  });
});
