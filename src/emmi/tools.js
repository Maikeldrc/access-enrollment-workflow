import { EMMI_CONFIG, EMMI_SYSTEM_PROMPT_VERSION, emmiPrototypeIsSafe } from "./config.js";
import { EMMI_ACCESS_DISCLOSURES, EMMI_DEMO_DEVICES, EMMI_DEMO_PATIENTS } from "../mock/emmiFixtures.js";

const LOG_KEY = "itera.emmi.prototype.audit.v1";
const id = prefix => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const clone = value => JSON.parse(JSON.stringify(value));
const readLogs = () => { try { return JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch { return []; } };
const writeLogs = logs => { try { localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(-25))); } catch { /* Prototype logging is best effort. */ } };

export const selectDemoPatientId = ({ language = "en", completionRole = "patient", eligibilityStatus = "", deviceScenario = null } = {}) => {
  if (deviceScenario?.patientOwnsMonitor && deviceScenario.integrationStatus === "UNSUPPORTED") return "DEMO-P006";
  if (eligibilityStatus === "notEligible" || eligibilityStatus === "NOT_ELIGIBLE") return "DEMO-P004";
  if (completionRole === "personalRepresentative" || completionRole === "PERSONAL_REPRESENTATIVE") return "DEMO-P003";
  if (language === "ht" || language === "KR") return "DEMO-P005";
  if (language === "es" || language === "ES") return "DEMO-P002";
  return "DEMO-P001";
};

export class EmmiAuditLog {
  constructor({ sessionId, demoPatientId, locale, currentScreen, model = EMMI_CONFIG.model }) {
    this.entry = { conversationId: id("EMMI"), sessionId, demoPatientId, locale, currentScreen, startedAt: new Date().toISOString(), endedAt: null, userTranscript: [], assistantTranscript: [], toolsCalled: [], toolResults: [], callbackRequested: false, careTeamTaskCreated: false, clinicalEscalationTriggered: false, model, systemPromptVersion: EMMI_SYSTEM_PROMPT_VERSION };
    this.persist();
  }
  updateContext({ locale, currentScreen }) { this.entry.locale = locale; this.entry.currentScreen = currentScreen; this.persist(); }
  transcript(role, text) { this.entry[role === "user" ? "userTranscript" : "assistantTranscript"].push({ timestamp: new Date().toISOString(), text }); this.persist(); }
  tool(name, args, result) {
    const timestamp = new Date().toISOString();
    this.entry.toolsCalled.push({ timestamp, tool: name, arguments: clone(args) });
    this.entry.toolResults.push({ timestamp, tool: name, result: clone(result) });
    if (name === "requestCallback" && result.success) this.entry.callbackRequested = true;
    if (name === "createCareTeamTask" && result.success) this.entry.careTeamTaskCreated = true;
    if (name === "evaluateClinicalEscalation" && result.severity !== "NORMAL") this.entry.clinicalEscalationTriggered = true;
    this.persist();
  }
  end() { this.entry.endedAt = new Date().toISOString(); this.persist(); }
  persist() { const logs = readLogs().filter(item => item.conversationId !== this.entry.conversationId); logs.push(this.entry); writeLogs(logs); }
  static all() { return readLogs(); }
}

export const EMMI_TOOL_DECLARATIONS = [{ functionDeclarations: [
  { name: "getEnrollmentContext", description: "Get authoritative fictional prototype enrollment context.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "getExpectedAccessCost", description: "Get authoritative expected ACCESS cost. Always use for cost questions.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, accessTrack: { type: "STRING" } }, required: ["patientId", "accessTrack"] } },
  { name: "getAssignedDevice", description: "Get the monitor assigned to the fictional demo patient.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "checkDeviceConnection", description: "Check authoritative device connection status.", parameters: { type: "OBJECT", properties: { deviceId: { type: "STRING" } }, required: ["deviceId"] } },
  { name: "getAccessDisclosure", description: "Get approved patient-facing ACCESS disclosure text.", parameters: { type: "OBJECT", properties: { accessTrack: { type: "STRING" }, locale: { type: "STRING" } }, required: ["accessTrack", "locale"] } },
  { name: "requestCallback", description: "Request a fictional care-team callback only after explicit patient confirmation.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, reason: { type: "STRING" }, preferredLanguage: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["patientId", "reason", "preferredLanguage", "confirmed"] } },
  { name: "createCareTeamTask", description: "Create a fictional care-team task only after explicit patient confirmation.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, category: { type: "STRING" }, reason: { type: "STRING" }, priority: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["patientId", "category", "reason", "priority", "confirmed"] } },
  { name: "saveEnrollmentProgress", description: "Save current navigation only. Cannot consent, enroll, or change eligibility.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, currentScreen: { type: "STRING" } }, required: ["patientId", "currentScreen"] } },
  { name: "evaluateClinicalEscalation", description: "Apply deterministic MOCK safety rules to a fictional reading and symptoms. The model must not decide severity.", parameters: { type: "OBJECT", properties: { systolic: { type: "NUMBER" }, diastolic: { type: "NUMBER" }, symptoms: { type: "STRING" } }, required: ["systolic", "diastolic", "symptoms"] } }
] }];

export class EmmiToolOrchestrator {
  constructor({ getContext, onCallback = () => {}, onTask = () => {}, onProgress = () => {}, auditLog }) {
    if (!emmiPrototypeIsSafe()) throw new Error("unsafe_emmi_configuration");
    this.getContext = getContext;
    this.onCallback = onCallback;
    this.onTask = onTask;
    this.onProgress = onProgress;
    this.auditLog = auditLog;
  }
  async execute(name, args = {}) {
    if (!EMMI_CONFIG.enableTools) throw new Error("tools_disabled");
    const context = this.getContext();
    const patientId = context.patientId;
    if (args.patientId && args.patientId !== patientId) throw new Error("prototype_patient_mismatch");
    let result;
    if (name === "getEnrollmentContext") result = clone(context);
    else if (name === "getExpectedAccessCost") {
      const patient = EMMI_DEMO_PATIENTS[patientId];
      result = { track: patient.accessTrack, expectedMonthlyCost: patient.expectedMonthlyCost, secondaryCoverageStatus: patient.secondaryCoverageStatus || "NOT_VERIFIED", estimatedOutOfPocketCost: patient.secondaryCoverageStatus === "VERIFIED" ? 0 : null, currency: "USD" };
    } else if (name === "getAssignedDevice") {
      const patient = EMMI_DEMO_PATIENTS[patientId];
      const device = EMMI_DEMO_DEVICES.find(item => item.deviceId === patient.assignedDeviceId);
      result = device ? { found: true, ...clone(device) } : patient.deviceSource === "PATIENT_OWNED" ? { found: false, patientOwnsMonitor: true, deviceSource: "PATIENT_OWNED", deviceId: null, vendor: "OTHER", status: "ACTIVE", integrationStatus: "UNSUPPORTED" } : { found: false, patientOwnsMonitor: false, deviceId: null, status: "NOT_ASSIGNED", integrationStatus: "NOT_CONNECTED" };
    } else if (name === "checkDeviceConnection") {
      const device = EMMI_DEMO_DEVICES.find(item => item.deviceId === args.deviceId);
      result = device ? { connected: device.integrationStatus === "CONNECTED", vendor: device.vendor, status: device.status } : { connected: false, vendor: null, status: "NOT_FOUND" };
    } else if (name === "getAccessDisclosure") result = clone(EMMI_ACCESS_DISCLOSURES[args.locale] || EMMI_ACCESS_DISCLOSURES.EN);
    else if (name === "requestCallback") {
      if (args.confirmed !== true) result = { success: false, status: "CONFIRMATION_REQUIRED" };
      else { result = { success: true, requestId: id("CB-DEMO"), status: "REQUESTED" }; this.onCallback(result); }
    } else if (name === "createCareTeamTask") {
      if (args.confirmed !== true) result = { success: false, status: "CONFIRMATION_REQUIRED" };
      else { result = { success: true, taskId: id("TASK-DEMO"), status: "CREATED", category: args.category, priority: args.priority }; this.onTask(result); }
    } else if (name === "saveEnrollmentProgress") { result = { success: true, patientId, currentScreen: context.currentScreen, protectedFieldsUnchanged: ["consent", "eligibility", "enrollmentStatus"] }; this.onProgress(result); }
    else if (name === "evaluateClinicalEscalation") {
      const symptoms = String(args.symptoms || "").toLowerCase();
      const emergencySymptoms = /(chest pain|can.?t breathe|difficulty breathing|stroke|severe bleeding|very bad|pass(?:ed)? out|faint(?:ed|ing)?|dolor de pecho|no puedo respirar|muy mal|me desmay|desmayo|doulè nan pwatrin|pa ka respire|endispoze|pèdi konesans)/i.test(symptoms);
      if (emergencySymptoms || Number(args.systolic) >= 180 || Number(args.diastolic) >= 120) result = { severity: "EMERGENCY", instruction: "CALL_911", policy: "PROTOTYPE_MOCK_RULES_NOT_FOR_CLINICAL_USE" };
      else if (Number(args.systolic) >= 160 || Number(args.diastolic) >= 100) result = { severity: "CARE_TEAM_REVIEW", instruction: "CREATE_HIGH_PRIORITY_TASK", policy: "PROTOTYPE_MOCK_RULES_NOT_FOR_CLINICAL_USE" };
      else result = { severity: "NORMAL", instruction: "CONTINUE", policy: "PROTOTYPE_MOCK_RULES_NOT_FOR_CLINICAL_USE" };
    } else throw new Error("unknown_tool");
    this.auditLog?.tool(name, args, result);
    return result;
  }
}
