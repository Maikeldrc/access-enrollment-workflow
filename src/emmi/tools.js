import { EMMI_CONFIG, EMMI_SYSTEM_PROMPT_VERSION, emmiPrototypeIsSafe } from "./config.js";
import { getEmmiVoiceIdentity } from "./voiceIdentity.js";
import { EMMI_ACCESS_DISCLOSURES, EMMI_DEMO_DEVICES, EMMI_DEMO_PATIENTS, emmiDemoCoverage } from "../mock/emmiFixtures.js";
import { normalizeCoverage } from "../coverage.js";
import { resolveExpectedPatientResponsibility } from "../financialResponsibility.js";

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
    const voice = getEmmiVoiceIdentity(locale);
    this.entry = { conversationId: id("EMMI"), sessionId, demoPatientId, locale, currentScreen, startedAt: new Date().toISOString(), endedAt: null, userTranscript: [], assistantTranscript: [], answerTurns: [], toolsCalled: [], toolResults: [], callbackRequested: false, careTeamTaskCreated: false, clinicalEscalationTriggered: false, model, systemPromptVersion: EMMI_SYSTEM_PROMPT_VERSION, voiceId: voice.voiceId, voiceVersion: voice.voiceVersion, voiceProvider: voice.provider, voiceEvents: [] };
    this.persist();
  }
  updateContext({ locale, currentScreen }) { const voice = getEmmiVoiceIdentity(locale); this.entry.locale = locale; this.entry.currentScreen = currentScreen; this.entry.voiceId = voice.voiceId; this.entry.voiceVersion = voice.voiceVersion; this.entry.voiceProvider = voice.provider; this.persist(); }
  voiceEvent(type, details = {}) { this.entry.voiceEvents.push({ timestamp: new Date().toISOString(), type, ...clone(details) }); this.persist(); }
  transcript(role, text) { this.entry[role === "user" ? "userTranscript" : "assistantTranscript"].push({ timestamp: new Date().toISOString(), text }); this.persist(); }
  answerTurn(metadata = {}) { this.entry.answerTurns ||= []; this.entry.answerTurns.push({ timestamp: new Date().toISOString(), ...clone(metadata) }); this.entry.answerTurns = this.entry.answerTurns.slice(-50); this.persist(); }
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
  { name: "getExpectedAccessCost", description: "Get the deterministic expected ACCESS patient payment for this patient from the financial responsibility engine. Always use for any question about what the patient pays, why it is that amount, or what it would be without supplemental coverage. Never calculate a patient's cost yourself and never treat having supplemental insurance as meaning the patient pays nothing: expectedPatientPayment of null means the amount is not known and must not be stated.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, accessTrack: { type: "STRING" } }, required: ["patientId", "accessTrack"] } },
  { name: "getPatientCoverage", description: "Get this patient's verified coverage: whether they have Original Medicare or Medicare Advantage, Part A and Part B status, and any secondary payers including Medicare Supplement, Medicaid or QMB. Always use for 'do I have Medicare', 'do I have supplemental insurance', 'what is my secondary coverage' and similar patient-specific coverage questions. Only a payer typed MEDICARE_SUPPLEMENT may be described to the patient as supplemental or Medigap coverage.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "getAssignedDevice", description: "Get the monitor assigned to the fictional demo patient.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "getMedicationList", description: "Get the fictional medications currently on file for this patient. Use for patient-specific medication-list questions.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "getPatientGoals", description: "Get the fictional personal goals currently saved for this patient.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "getLatestReading", description: "Get the latest authoritative health reading already available to the patient UI. Never infer or invent a reading.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, metricType: { type: "STRING" } }, required: ["patientId", "metricType"] } },
  { name: "getReadingTrend", description: "Get the deterministic trend already calculated by the patient runtime. The model must explain it, not recalculate it.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, metricType: { type: "STRING" }, periodDays: { type: "NUMBER" } }, required: ["patientId", "metricType"] } },
  { name: "getClinicalTarget", description: "Get a care-team-defined clinical target when one is present. Never create or modify a target.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, metricType: { type: "STRING" } }, required: ["patientId", "metricType"] } },
  { name: "getGoalProgress", description: "Get factual goal progress derived from readings, patient reports, and completed education.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, goalId: { type: "STRING" } }, required: ["patientId", "goalId"] } },
  { name: "getEducationRecommendation", description: "Get the next approved contextual education topic selected by deterministic product rules.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, goalId: { type: "STRING" } }, required: ["patientId", "goalId"] } },
  { name: "getCareTeam", description: "Get the trusted physician/care-team context currently available for this patient.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "getNextBestAction", description: "Get the authoritative next action from the same journey resolver used by the patient UI.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "checkDeviceConnection", description: "Check authoritative device connection status.", parameters: { type: "OBJECT", properties: { deviceId: { type: "STRING" } }, required: ["deviceId"] } },
  { name: "getAccessDisclosure", description: "Get approved patient-facing ACCESS disclosure text.", parameters: { type: "OBJECT", properties: { accessTrack: { type: "STRING" }, locale: { type: "STRING" } }, required: ["accessTrack", "locale"] } },
  { name: "requestCallback", description: "Request a fictional care-team callback only after explicit patient confirmation.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, reason: { type: "STRING" }, preferredLanguage: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["patientId", "reason", "preferredLanguage", "confirmed"] } },
  { name: "createCareTeamTask", description: "Create a fictional care-team task only after explicit patient confirmation.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, category: { type: "STRING" }, reason: { type: "STRING" }, priority: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["patientId", "category", "reason", "priority", "confirmed"] } },
  { name: "saveEnrollmentProgress", description: "Save current navigation only. Cannot consent, enroll, or change eligibility.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, currentScreen: { type: "STRING" } }, required: ["patientId", "currentScreen"] } },
  { name: "evaluateClinicalEscalation", description: "Apply deterministic MOCK safety rules to a fictional reading and symptoms. The model must not decide severity.", parameters: { type: "OBJECT", properties: { systolic: { type: "NUMBER" }, diastolic: { type: "NUMBER" }, symptoms: { type: "STRING" } }, required: ["systolic", "diastolic", "symptoms"] } },
  { name: "searchKnowledge", description: "Look up ITERA's approved explanations of programs, Medicare, enrollment, devices, care and safety topics. Use for conceptual questions such as 'What is CCM?' or 'What is a Care Circle?'. This returns general education only and is never a source for what is true for this patient: for eligibility, cost, devices, medications, enrollment status or next step, call the matching patient tool instead.", parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } }
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
      // The engine decides the amount; the model only explains the result it is handed. Note the
      // gross amount comes from the track configuration, never from a copy on the patient record.
      const patient = EMMI_DEMO_PATIENTS[patientId];
      result = resolveExpectedPatientResponsibility({ track: patient.accessTrack, coverage: emmiDemoCoverage(patientId) || {} });
    } else if (name === "getPatientCoverage") {
      // Whether this patient has Medicare, and of which kind, is a runtime fact. It is never
      // inferred from the fact that they are looking at an ACCESS screen.
      const coverage = emmiDemoCoverage(patientId);
      result = coverage
        ? { found: true, ...normalizeCoverage(coverage) }
        : { found: false, medicare: null, secondaryPayers: [], supplemental: null, verificationStatus: "UNKNOWN", note: "Coverage could not be verified from the information currently available." };
    } else if (name === "getAssignedDevice") {
      const patient = EMMI_DEMO_PATIENTS[patientId];
      const device = EMMI_DEMO_DEVICES.find(item => item.deviceId === patient.assignedDeviceId);
      result = device ? { found: true, ...clone(device) } : patient.deviceSource === "PATIENT_OWNED" ? { found: false, patientOwnsMonitor: true, deviceSource: "PATIENT_OWNED", deviceId: null, vendor: "OTHER", status: "ACTIVE", integrationStatus: "UNSUPPORTED" } : { found: false, patientOwnsMonitor: false, deviceId: null, status: "NOT_ASSIGNED", integrationStatus: "NOT_CONNECTED" };
    } else if (name === "getMedicationList") result = { medications: clone(context.medications || []) };
    else if (name === "getPatientGoals") result = { goals: clone(context.patientGoals || []), activeGoal: clone(context.activeGoal || null) };
    else if (name === "getLatestReading") result = { metricType: args.metricType, reading: clone(context.activeGoal?.latestReading || null), source: context.activeGoal?.latestReading ? "PATIENT_RUNTIME" : "UNAVAILABLE" };
    else if (name === "getReadingTrend") result = { metricType: args.metricType, trend: clone(context.activeGoal?.readingTrend || null), source: context.activeGoal?.readingTrend ? "DETERMINISTIC_ANALYTICS" : "UNAVAILABLE" };
    else if (name === "getClinicalTarget") result = { metricType: args.metricType, target: clone(context.activeGoal?.clinicalTarget || null), source: context.activeGoal?.clinicalTarget ? "CARE_TEAM_CONFIGURATION" : "UNAVAILABLE" };
    else if (name === "getGoalProgress") result = { goalId: args.goalId, progress: clone(context.activeGoal?.progress || null), actions: clone(context.activeGoal?.actions || []), source: "PATIENT_RUNTIME" };
    else if (name === "getEducationRecommendation") result = { goalId: args.goalId, topic: clone(context.activeGoal?.nextBestEducation || null), source: context.activeGoal?.nextBestEducation ? "APPROVED_TOPIC_CATALOG" : "UNAVAILABLE" };
    else if (name === "getCareTeam") result = { physicianDisplayName: context.physicianDisplayName || null, enrollmentSource: context.enrollmentSource || null };
    else if (name === "getNextBestAction") result = clone(context.nextBestAction || { label: "", route: context.currentScreen, actionType: "NONE" });
    else if (name === "checkDeviceConnection") {
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
    } else if (name === "searchKnowledge") {
      // Retrieval runs on the server so the Knowledge Base is never shipped to the browser.
      // Only the journey context needed to pick a document is sent; no patient identifiers.
      const response = await fetch("/api/emmi/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: String(args.query || ""), program: context.program || null, currentScreen: context.currentScreen || null })
      });
      if (!response.ok) throw new Error("knowledge_unavailable");
      const retrieved = await response.json();
      result = {
        sourceType: "ITERA_KNOWLEDGE_BASE",
        // Ranked below every runtime source, so the model prefers tool results on conflict.
        sourcePriority: retrieved.sourcePriority,
        authority: "GENERAL_EDUCATION_ONLY",
        intent: retrieved.intent,
        riskLevel: retrieved.riskLevel,
        requiredTool: retrieved.requiredTool,
        mustNotAnswerAlone: retrieved.mustNotAnswerAlone,
        note: retrieved.mustNotAnswerAlone
          ? "Safety topic. Never advise starting, stopping or changing a medication or judge severity yourself. Follow the deterministic safety rules and offer the care team."
          : retrieved.requiredTool
            ? `This is general information only. The patient asked something personal, so call ${retrieved.requiredTool} and answer from that result.`
            : "General education. Do not state anything patient-specific from this content.",
        passages: retrieved.chunks
      };
    } else throw new Error("unknown_tool");
    this.auditLog?.tool(name, args, result);
    return result;
  }
}
