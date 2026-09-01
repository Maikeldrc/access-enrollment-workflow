import { EMMI_CONFIG, EMMI_SYSTEM_PROMPT_VERSION, emmiPrototypeIsSafe } from "./config.js";
import { getEmmiVoiceIdentity } from "./voiceIdentity.js";
import { EMMI_ACCESS_DISCLOSURES, EMMI_DEMO_DEVICES, EMMI_DEMO_PATIENTS, emmiDemoCoverage } from "../mock/emmiFixtures.js";
import { normalizeCoverage } from "../coverage.js";
import { DEMO_BP_MONITORING_RULES } from "../goalHealth.js";
import { PROTECTED_CLINICAL_FIELDS } from "../goals.js";
import { BP_CLINICAL_STATE, EMERGENCY_SYMPTOM_PATTERN, classifyObservation } from "../clinicalMonitoring.js";
import { resolveExpectedPatientResponsibility } from "../financialResponsibility.js";
import { conversationPolicyResponse } from "./conversationPolicy.js";

const LOG_KEY = "itera.emmi.prototype.audit.v1";
const id = prefix => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const clone = value => JSON.parse(JSON.stringify(value));
let memoryLogs = []; const store = () => globalThis.sessionStorage;
// The tool audit is a record of what EMMI did for one patient — which cost it quoted, which device
// it looked up. It resets with the enrollment, and the in-memory copy goes with it: clearing only
// the storage would leave this tab still holding the previous patient's calls.
export function clearEmmiAuditLog() {
  memoryLogs = [];
  try { store()?.removeItem(LOG_KEY); } catch { /* best effort */ }
}
const readLogs = () => { try { return store() ? JSON.parse(store().getItem(LOG_KEY) || "[]") : memoryLogs; } catch { return memoryLogs; } };
const writeLogs = logs => { memoryLogs = logs.slice(-25); try { store()?.setItem(LOG_KEY, JSON.stringify(memoryLogs)); } catch {} };
const sensitive = /question|query|symptoms|patientDescription|transcript|text|audio|token|apiKey/i;
const safe = value => Array.isArray(value) ? value.map(safe) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([key]) => !sensitive.test(key)).map(([key,item]) => [key,safe(item)])) : value;

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
  transcript(role, text) { this.entry[role === "user" ? "userTranscript" : "assistantTranscript"].push({ timestamp: new Date().toISOString(), characters: String(text || "").length, retained: false }); this.persist(); }
  answerTurn(metadata = {}) { this.entry.answerTurns ||= []; this.entry.answerTurns.push({ timestamp: new Date().toISOString(), ...clone(metadata) }); this.entry.answerTurns = this.entry.answerTurns.slice(-50); this.persist(); }
  tool(name, args, result) {
    const timestamp = new Date().toISOString();
    this.entry.toolsCalled.push({ timestamp, tool: name, arguments: safe(clone(args)) });
    this.entry.toolResults.push({ timestamp, tool: name, result: safe(clone(result)) });
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
  { name: "applyConversationPolicy", description: "Return approved deterministic consent or representative-authority wording. Always call before answering these topics.", parameters: { type: "OBJECT", properties: { question: { type: "STRING" }, locale: { type: "STRING" } }, required: ["question"] } },
  { name: "getEnrollmentContext", description: "Get authoritative fictional prototype enrollment context.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "getExpectedAccessCost", description: "Get the deterministic expected ACCESS patient payment for this patient from the financial responsibility engine. Always use for any question about what the patient pays, why it is that amount, or what it would be without supplemental coverage. Never calculate a patient's cost yourself and never treat having supplemental insurance as meaning the patient pays nothing: expectedPatientPayment of null means the amount is not known and must not be stated.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, accessTrack: { type: "STRING" } }, required: ["patientId", "accessTrack"] } },
  { name: "getPatientCoverage", description: "Get this patient's verified coverage: whether they have Original Medicare or Medicare Advantage, Part A and Part B status, and any secondary payers including Medicare Supplement, Medicaid or QMB. Always use for 'do I have Medicare', 'do I have supplemental insurance', 'what is my secondary coverage' and similar patient-specific coverage questions. Only a payer typed MEDICARE_SUPPLEMENT may be described to the patient as supplemental or Medigap coverage.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "getAssignedDevice", description: "Get the fictional demo patient's assigned monitor plus current fulfillment and shipment status. Use this for patient-specific questions about which monitor they have, whether it is connected, whether it was requested or shipped, or when it may arrive. Never infer a shipment or delivery date.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "getMedicationList", description: "Get the fictional medications currently on file for this patient. Use for patient-specific medication-list questions.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "getPatientGoals", description: "Get this patient's goals, each one marked CARE_PLAN (their care plan set it) or PERSONAL (they set it themselves), with the steps in its plan. Always use it for 'what are my goals', 'what am I working on' or 'what do I have to do for this goal', and answer with the two kinds kept apart. A step in a plan is never reported as a goal.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "classifyGoalStatement", description: "Decide whether something the patient said describes a GOAL (a result, change or state they want to reach) or an ACTION (something they will do), and get the outcome goal we can offer them if it is an action. ALWAYS call this before creating a goal or a step from the patient's words, and never make this judgement yourself: the answer must be the same in chat and in voice, and it comes from here. It returns kind (GOAL, ACTION, VAGUE, CLINICAL_TARGET, MEDICATION_CHANGE or EMPTY), a proposed goal, a proposed step, one short question to ask when nothing is safe to assume, and a topic for the care team when the patient asked for something clinical. Everything it returns is a PROPOSAL: it saves nothing.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, statement: { type: "STRING" } }, required: ["statement"] } },
  { name: "startPersonalGoal", description: "Open the create-a-goal screen with what the patient said already worked out: the outcome we would offer as the goal, the step we would offer for their plan, and the wording they can change. Use it when the patient says they want to set a goal, or describes something they want to improve or start doing. It writes nothing — the patient still has to accept and save — so never say a goal was created after calling it.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, statement: { type: "STRING" } }, required: ["statement"] } },
  { name: "startGoalStepEdit", description: "Open the editor for one step of a goal's plan, with the new wording filled in for the patient to confirm. Use it when the patient asks to change something they are doing — 'make the walk 20 minutes'. It changes the step and never the goal, and it saves nothing by itself.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, goalId: { type: "STRING" }, actionId: { type: "STRING" }, title: { type: "STRING" }, phrase: { type: "STRING" } }, required: [] } },
  { name: "createPersonalGoal", description: "Save a personal goal the patient confirmed, with an optional first step of their plan. The title must describe what the patient wants to REACH: a title that describes something they would do is refused and the outcome goal to offer instead is returned, so never retry with the same wording. A personal goal is the patient's own input for their care team to see; it is never a clinical target, never an order, and it changes no baseline, target, medication or treatment. Only say the goal was saved after this returns success.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, title: { type: "STRING" }, templateId: { type: "STRING" }, firstActionTitle: { type: "STRING" }, firstActionFrequency: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["title", "confirmed"] } },
  { name: "addGoalAction", description: "Add one step to the plan for a goal after the patient confirmed it. A step is what the patient will do — walk 15 minutes three times a week, use less salt. This is where anything the patient describes as a routine belongs, never in the goal's name. Adding a step never changes the goal, and never changes a clinical target, a dose or a treatment. frequency is one of daily, few-days, choose-days or care-team-plan.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, goalId: { type: "STRING" }, title: { type: "STRING" }, frequency: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["goalId", "title", "confirmed"] } },
  { name: "updateGoalAction", description: "Change one step of a goal's plan after the patient confirmed it — this is what 'change the walk to 20 minutes' means. It changes that step only: the goal's name is untouched. A step completed by a monitor or by a lesson cannot be changed this way, and the result says so.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, goalId: { type: "STRING" }, actionId: { type: "STRING" }, title: { type: "STRING" }, frequency: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["goalId", "actionId", "confirmed"] } },
  { name: "removeGoalAction", description: "Remove one step from a goal's plan after the patient explicitly confirmed removing it. The goal stays exactly as it is. Never infer a removal from the patient saying a step is hard: that is a difficulty to record and help with, not a deletion.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, goalId: { type: "STRING" }, actionId: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["goalId", "actionId", "confirmed"] } },
  { name: "updateGoalWording", description: "Reword a goal the patient set for themselves, after they confirmed the new wording. Only a PERSONAL goal can be reworded: a goal that came from the care plan is refused, and so is a new wording that describes something the patient would do rather than something they want to reach. The steps in the plan are never touched by this.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, goalId: { type: "STRING" }, title: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["goalId", "title", "confirmed"] } },
  { name: "getLatestReading", description: "Get the latest authoritative health reading already available to the patient UI. Never infer or invent a reading.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, metricType: { type: "STRING" } }, required: ["patientId", "metricType"] } },
  { name: "getReadingTrend", description: "Get the deterministic trend already calculated by the patient runtime. The model must explain it, not recalculate it.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, metricType: { type: "STRING" }, periodDays: { type: "NUMBER" } }, required: ["patientId", "metricType"] } },
  { name: "getClinicalTarget", description: "Get a care-team-defined clinical target when one is present. Never create or modify a target.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, metricType: { type: "STRING" } }, required: ["patientId", "metricType"] } },
  { name: "getGoalProgress", description: "Get factual goal progress derived from readings, patient reports, and completed education.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, goalId: { type: "STRING" } }, required: ["patientId", "goalId"] } },
  { name: "getAccessBaseline", description: "Get this patient's confirmed ACCESS starting points and the measures derived from them: the starting blood pressure or weight, the program's control target, and the improvement milestone with the amount it sits below the baseline. Always use for any question about where the patient started, what their milestone is, or what a 15 mmHg or 5% improvement means for them. These are patient-specific facts: never take them from general education and never do the arithmetic yourself. A starting point with status PENDING means no baseline is confirmed, and no milestone may be stated at all.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, goalType: { type: "STRING" } }, required: ["patientId"] } },
  { name: "getEducationRecommendation", description: "Get the next approved contextual education topic selected by deterministic product rules.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, goalId: { type: "STRING" } }, required: ["patientId", "goalId"] } },
  { name: "getCareTeam", description: "Get the trusted physician/care-team context currently available for this patient.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "getNextBestAction", description: "Get the authoritative next action from the same journey resolver used by the patient UI.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "checkDeviceConnection", description: "Check authoritative device connection status.", parameters: { type: "OBJECT", properties: { deviceId: { type: "STRING" } }, required: ["deviceId"] } },
  { name: "getAccessDisclosure", description: "Get approved patient-facing ACCESS disclosure text.", parameters: { type: "OBJECT", properties: { accessTrack: { type: "STRING" }, locale: { type: "STRING" } }, required: ["accessTrack", "locale"] } },
  { name: "requestCallback", description: "Request a fictional care-team callback only after explicit patient confirmation.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, reason: { type: "STRING" }, preferredLanguage: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["patientId", "reason", "preferredLanguage", "confirmed"] } },
  { name: "createCareTeamTask", description: "Create a fictional care-team task only after explicit patient confirmation.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, category: { type: "STRING" }, reason: { type: "STRING" }, priority: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["patientId", "category", "reason", "priority", "confirmed"] } },
  { name: "saveEnrollmentProgress", description: "Save current navigation only. Cannot consent, enroll, or change eligibility.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, currentScreen: { type: "STRING" } }, required: ["patientId", "currentScreen"] } },
  { name: "evaluateClinicalEscalation", description: "Apply deterministic MOCK safety rules to a fictional reading and symptoms. The model must not decide severity.", parameters: { type: "OBJECT", properties: { systolic: { type: "NUMBER" }, diastolic: { type: "NUMBER" }, symptoms: { type: "STRING" } }, required: ["systolic", "diastolic", "symptoms"] } },
  { name: "getGoalBarriers", description: "Get the difficulties already identified for this patient's active goal, what was tried and how it went. Use before offering help so EMMI does not repeat something that did not work or ask about something already being handled.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "recordGoalBarrier", description: "Record a difficulty the patient described in conversation, using the shared barrier taxonomy. Use when the patient says something is making a goal, an action, a routine, a device, a medication or getting care hard. Never record a clinical symptom this way: symptoms go to evaluateClinicalEscalation first.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, category: { type: "STRING" }, patientDescription: { type: "STRING" } }, required: ["patientId", "category"] } },
  { name: "createGoalReminder", description: "Save a reminder on the patient's goal plan after they explicitly chose a time. Reminders appear inside ITERA; this does not send phone notifications. Never call this without the patient choosing.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, slot: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["patientId", "slot", "confirmed"] } },
  { name: "getMedicationSupply", description: "Get this patient's medications with the deterministic supply estimate for each one: whether it can be estimated at all, roughly how many days remain, and how much the engine trusts that. Never calculate a supply yourself, never state a pill count, and never present an estimate as a fact. An estimate is a reason to ask the patient, not a reason to act.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "getActiveRefills", description: "Get refill requests already in progress for this patient and what each one is waiting on. Always use before offering to request a refill, so an existing request is reported rather than duplicated, and use it to answer any question about where a refill stands.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "startRefillReview", description: "Open the refill review for one medication so the patient can confirm they still take it and whether they are running low. Use when the patient says they are running out or asks for a refill. This starts a review; it never requests, approves or renews anything.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, medicationId: { type: "STRING" } }, required: ["patientId", "medicationId"] } },
  { name: "getUpcomingAppointments", description: "Get the appointments already on file for this patient with their patient-facing status. Always use before answering when an appointment is, whether one exists, or before offering to request another one, so an existing appointment is reported rather than duplicated. Never state a date, time, provider or status that is not in this result.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "getAppointment", description: "Get one appointment the patient already has, including its patient-facing status and next step. Use for any question about a specific visit. If it is not found, say so; never describe an appointment this tool did not return.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, appointmentId: { type: "STRING" } }, required: ["appointmentId"] } },
  { name: "getSchedulingCapability", description: "Find out how this professional's office can actually be scheduled with: direct booking, a structured request, human coordination by the care team, or no available channel. Always call this before offering to book, request or coordinate anything, because offering a booking the office cannot accept is a promise the product cannot keep.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, providerId: { type: "STRING" }, appointmentType: { type: "STRING" } }, required: ["providerId"] } },
  { name: "getProviderAvailability", description: "Get real appointment times from the trusted scheduling source. Every returned time is reservable and held through its expiresAt value; if the patient chooses and explicitly confirms one during that hold, book that exact slotId. This is the only source of availability: never invent, estimate, remember or reuse a time, and never present a time the result did not contain. If it returns ok false, tell the patient you could not check the times and offer to try again or reach the care team.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, providerId: { type: "STRING" }, preferredTimeOfDay: { type: "STRING" }, modality: { type: "STRING" } }, required: ["providerId"] } },
  { name: "startAppointmentRequest", description: "Open the appointment request so the patient can confirm who they need to see, why, and when. Use when the patient says they need a visit or need to see a professional. This starts the flow; it requests, books and sends nothing by itself.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, reasonCategory: { type: "STRING" }, providerId: { type: "STRING" }, reasonSummary: { type: "STRING" } }, required: ["reasonCategory"] } },
  { name: "createAppointmentRequest", description: "Send the completed appointment request to the office only after the patient explicitly confirms. A sent request is not a confirmed appointment: report it as a request that was sent and that the office still has to answer. If it was not sent, say so; never announce a request that did not go out.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, needId: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["needId", "confirmed"] } },
  { name: "bookAppointment", description: "Book a real time the patient chose from getProviderAvailability, only after they explicitly confirm. Never say an appointment is confirmed until this returns success. A time can disappear between being shown and being booked: if it returns SLOT_UNAVAILABLE, say that time could not be confirmed, never blame the patient, and offer updated times.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, needId: { type: "STRING" }, slotId: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["needId", "slotId", "confirmed"] } },
  { name: "rescheduleAppointment", description: "Start a reschedule of an existing appointment only after the patient explicitly confirms in this conversation. Rescheduling changes care the patient is counting on, so it is never done from chat text alone.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, appointmentId: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["appointmentId", "confirmed"] } },
  { name: "cancelAppointment", description: "Cancel an existing appointment only after the patient explicitly confirms that they want it cancelled. Cancelling is destructive and is never inferred from what the patient said in conversation: mentioning a problem getting there, a conflict or a bad day is not a cancellation.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, appointmentId: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["appointmentId", "confirmed"] } },
  { name: "createAppointmentReminder", description: "Save a reminder for an appointment after the patient explicitly chose a reminder time. Reminders appear inside ITERA; this does not send phone, text or email notifications, and must never be described as one. Only say a reminder was set after this returns success.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, appointmentId: { type: "STRING" }, slot: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["appointmentId", "slot", "confirmed"] } },
  { name: "getCareCircle", description: "Get the Care Circle members this patient has actually invited and their invitation status. Use before offering to share anything with a support person, so nobody is offered who is not really there.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } }, required: ["patientId"] } },
  { name: "shareAppointment", description: "Share limited appointment details with one Care Circle member after the patient explicitly confirms. Sharing is scoped: a Care Circle member is a support person, never a decision maker, and sharing an appointment never gives them access to the rest of the patient's information.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, appointmentId: { type: "STRING" }, inviteId: { type: "STRING" }, confirmed: { type: "BOOLEAN" } }, required: ["appointmentId", "inviteId", "confirmed"] } },
  // The two tools that make EMMI part of the screen rather than a commentary on it. describeCurrentView
  // is the pull to match the app's push, for the moment a session has been running long enough that
  // the newest context update has been summarised out of the window. performViewAction is the only
  // way EMMI may change anything on screen, and it can only press a control the patient could press.
  { name: "describeCurrentView", description: "Get what the patient is looking at right now: the view, what they have to do on it, the values on screen, the choices available with the number each one can be addressed by, what is selected, what has really been completed, what is still pending, and which controls exist. Use it whenever the patient refers to what is on screen — 'what are my options', 'what do I do here', 'the first one', 'is it booked yet' — and whenever the conversation has run long enough that the screen may have moved on. Never describe a screen this tool did not return.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" } } } },
  { name: "performViewAction", description: "Press a control that is really on the patient's screen. actionId is an id from the current view's availableActions; optionRef selects one of the view's choices by its id or by its number n. Only ever acts on what is on screen right now: if the control is gone the result says so and nothing happened. Actions of kind CONFIRM or DESTRUCTIVE change something outside the app — a booking, a message to a person, an appointment time, a cancellation — and are refused unless confirmed is true, which requires the patient to have said so in this same turn. An action marked acceptsText needs the patient's own words in text — that is how a topic the patient dictated is added to their visit list. Never report an action as done unless the result says it was.", parameters: { type: "OBJECT", properties: { patientId: { type: "STRING" }, actionId: { type: "STRING" }, optionRef: { type: "STRING" }, text: { type: "STRING" }, confirmed: { type: "BOOLEAN" } } } },
  { name: "searchKnowledge", description: "Look up ITERA's approved explanations of programs, Medicare, enrollment, devices, care and safety topics. Use for conceptual questions such as 'What is CCM?' or 'What is a Care Circle?'. This returns general education only and is never a source for what is true for this patient: for eligibility, cost, devices, medications, enrollment status or next step, call the matching patient tool instead.", parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } }
] }];

export class EmmiToolOrchestrator {
  constructor({ getContext, onCallback = () => {}, onTask = () => {}, onProgress = () => {}, onBarrier = () => null, onReminder = () => null, onClassifyStatement = () => null, onCreatePersonalGoal = () => null, onGoalActionWrite = () => null, onGoalWording = () => null, onStartPersonalGoal = () => null, onStartGoalStepEdit = () => null, onMedicationSupply = () => [], onActiveRefills = () => [], onRefillReview = () => null, onUpcomingAppointments = () => [], onAppointment = () => null, onSchedulingCapability = () => null, onProviderAvailability = () => null, onStartAppointmentRequest = () => null, onCreateAppointmentRequest = () => null, onBookAppointment = () => null, onRescheduleAppointment = () => null, onCancelAppointment = () => null, onAppointmentReminder = () => null, onCareCircle = () => [], onShareAppointment = () => null, onDescribeView = () => null, onPerformViewAction = () => null, auditLog }) {
    if (!emmiPrototypeIsSafe()) throw new Error("unsafe_emmi_configuration");
    this.getContext = getContext;
    this.onCallback = onCallback;
    this.onTask = onTask;
    this.onProgress = onProgress;
    // Barriers and reminders are patient state, so the tool hands them to the application rather
    // than keeping a second copy of the truth inside EMMI.
    this.onBarrier = onBarrier;
    this.onReminder = onReminder;
    // Goals and the steps in their plans are patient state too, and the goal-or-action decision is
    // a product rule rather than a judgement call — so both live in the application and EMMI asks.
    // That is what makes the same sentence classify the same way in chat and in voice.
    this.onClassifyStatement = onClassifyStatement;
    this.onCreatePersonalGoal = onCreatePersonalGoal;
    this.onGoalActionWrite = onGoalActionWrite;
    this.onGoalWording = onGoalWording;
    this.onStartPersonalGoal = onStartPersonalGoal;
    this.onStartGoalStepEdit = onStartGoalStepEdit;
    // Medication supply and refills are patient state too: the tool asks the application rather
    // than keeping a second copy of what is true.
    this.onMedicationSupply = onMedicationSupply;
    this.onActiveRefills = onActiveRefills;
    this.onRefillReview = onRefillReview;
    // Appointments are patient state and provider truth. EMMI holds neither: every read asks the
    // application, and every write asks the application after the patient confirmed it.
    this.onUpcomingAppointments = onUpcomingAppointments;
    this.onAppointment = onAppointment;
    this.onSchedulingCapability = onSchedulingCapability;
    this.onProviderAvailability = onProviderAvailability;
    this.onStartAppointmentRequest = onStartAppointmentRequest;
    this.onCreateAppointmentRequest = onCreateAppointmentRequest;
    this.onBookAppointment = onBookAppointment;
    this.onRescheduleAppointment = onRescheduleAppointment;
    this.onCancelAppointment = onCancelAppointment;
    this.onAppointmentReminder = onAppointmentReminder;
    this.onCareCircle = onCareCircle;
    this.onShareAppointment = onShareAppointment;
    // What the patient is looking at, and pressing something on it. Both belong to the shell: the
    // screen is the shell's, and EMMI reading or acting on a second copy of it would be the same
    // class of bug this whole change exists to fix.
    this.onDescribeView = onDescribeView;
    this.onPerformViewAction = onPerformViewAction;
    this.auditLog = auditLog;
  }
  async execute(name, args = {}) {
    if (!EMMI_CONFIG.enableTools) throw new Error("tools_disabled");
    const context = this.getContext();
    const patientId = context.patientId;
    if (args.patientId && args.patientId !== patientId) throw new Error("prototype_patient_mismatch");
    let result;
    if (name === "applyConversationPolicy") result = conversationPolicyResponse(args.question, args.locale || context.locale) || { intent: "NO_POLICY_MATCH", text: "", deterministic: true };
    else if (name === "getEnrollmentContext") result = clone(context);
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
      const fulfillment = {
        fulfillmentStatus: context.deviceFulfillmentStatus || "NOT_REQUESTED",
        fulfillmentRequestedAt: context.deviceFulfillmentRequestedAt || null,
        shipmentStatus: context.deviceShipmentStatus || null,
        deliveryDate: context.deviceDeliveryDate || null
      };
      result = device ? { found: true, ...clone(device), ...fulfillment } : patient.deviceSource === "PATIENT_OWNED" ? { found: false, patientOwnsMonitor: true, deviceSource: "PATIENT_OWNED", deviceId: null, vendor: "OTHER", status: "ACTIVE", integrationStatus: "UNSUPPORTED", ...fulfillment } : { found: false, patientOwnsMonitor: false, deviceId: null, status: "NOT_ASSIGNED", integrationStatus: "NOT_CONNECTED", ...fulfillment };
    } else if (name === "getMedicationList") result = { medications: clone(context.medications || []) };
    else if (name === "getPatientGoals") {
      const goals = clone(context.patientGoals || []);
      result = {
        goals,
        carePlanGoals: goals.filter(item => item.goalKind !== "PERSONAL"),
        personalGoals: goals.filter(item => item.goalKind === "PERSONAL"),
        activeGoal: clone(context.activeGoal || null),
        // Named rather than described. A model told "clinical things are protected" has to decide
        // what counts; a model handed the list does not.
        patientCannotChange: [...PROTECTED_CLINICAL_FIELDS],
        note: "goalKind CARE_PLAN means the care plan set it; PERSONAL means the patient did. actions are the steps in the plan, never goals. Everything in patientCannotChange belongs to the care team and cannot be changed from here, on either kind of goal."
      };
    }
    // The one place that decides goal-or-action, so chat and voice cannot disagree. It writes
    // nothing: everything it returns is something to offer the patient.
    else if (name === "classifyGoalStatement") {
      const verdict = this.onClassifyStatement({ statement: String(args.statement || "").slice(0, 400) });
      result = verdict
        ? { ...clone(verdict), savedAnything: false, note: "This is a proposal. Offer it to the patient and let them accept it, change it, or say it differently. Never save an ACTION as the name of a goal." }
        : { kind: "EMPTY", savedAnything: false };
    } else if (name === "startPersonalGoal") {
      // Opening the flow is not creating a goal, the same way opening a refill review is not
      // requesting a refill. The patient is taken to the screen holding the proposal, and the
      // proposal is what comes back so the conversation can describe what they are about to see.
      const opened = this.onStartPersonalGoal({ statement: String(args.statement || "").slice(0, 400) });
      result = opened
        ? { success: true, status: "FLOW_OPENED", savedAnything: false, ...clone(opened) }
        : { success: false, status: "GOAL_FLOW_NOT_OPENED" };
    } else if (name === "startGoalStepEdit") {
      const opened = this.onStartGoalStepEdit({ goalId: String(args.goalId || ""), actionId: String(args.actionId || ""), title: String(args.title || "").slice(0, 160), phrase: String(args.phrase || "").slice(0, 400) });
      result = opened
        ? { success: true, status: "FLOW_OPENED", savedAnything: false, goalTitleChanged: false, ...clone(opened) }
        : { success: false, status: "STEP_NOT_FOUND" };
    } else if (name === "createPersonalGoal") {
      if (args.confirmed !== true) result = { success: false, status: "CONFIRMATION_REQUIRED" };
      else {
        const created = this.onCreatePersonalGoal({
          title: String(args.title || "").slice(0, 180),
          templateId: String(args.templateId || ""),
          firstActionTitle: String(args.firstActionTitle || "").slice(0, 160),
          firstActionFrequency: String(args.firstActionFrequency || "")
        });
        // A refusal carries the outcome goal to offer instead, so the model has somewhere to go
        // that is not "try the same sentence again".
        result = created?.success
          ? { success: true, goalId: created.goalId, title: created.title, goalKind: "PERSONAL", actions: clone(created.actions || []), careTeamReviewStatus: created.careTeamReviewStatus, clinicalTargetChanged: false }
          : { success: false, status: created?.status || "GOAL_NOT_CREATED", suggestedGoal: clone(created?.suggestedGoal || null), suggestedAction: clone(created?.suggestedAction || null), clarify: created?.clarify || "", note: created?.note || "" };
      }
    } else if (["addGoalAction", "updateGoalAction", "removeGoalAction"].includes(name)) {
      if (args.confirmed !== true) result = { success: false, status: "CONFIRMATION_REQUIRED" };
      else {
        const written = this.onGoalActionWrite({
          operation: name === "addGoalAction" ? "ADD" : name === "updateGoalAction" ? "UPDATE" : "REMOVE",
          goalId: String(args.goalId || ""),
          actionId: String(args.actionId || ""),
          title: String(args.title || "").slice(0, 160),
          frequency: String(args.frequency || "")
        });
        result = written?.success
          ? { success: true, goalId: written.goalId, actionId: written.actionId, title: written.title || "", frequency: written.frequency || "", goalTitleChanged: false, clinicalTargetChanged: false }
          : { success: false, status: written?.status || "ACTION_NOT_CHANGED" };
      }
    } else if (name === "updateGoalWording") {
      if (args.confirmed !== true) result = { success: false, status: "CONFIRMATION_REQUIRED" };
      else {
        const written = this.onGoalWording({ goalId: String(args.goalId || ""), title: String(args.title || "").slice(0, 180) });
        result = written?.success
          ? { success: true, goalId: written.goalId, title: written.title, actionsChanged: false, clinicalTargetChanged: false }
          : { success: false, status: written?.status || "GOAL_NOT_UPDATED", suggestedGoal: clone(written?.suggestedGoal || null), note: written?.note || "" };
      }
    }
    else if (name === "getLatestReading") result = { metricType: args.metricType, reading: clone(context.activeGoal?.latestReading || null), source: context.activeGoal?.latestReading ? "PATIENT_RUNTIME" : "UNAVAILABLE" };
    else if (name === "getReadingTrend") result = { metricType: args.metricType, trend: clone(context.activeGoal?.readingTrend || null), source: context.activeGoal?.readingTrend ? "DETERMINISTIC_ANALYTICS" : "UNAVAILABLE" };
    else if (name === "getClinicalTarget") result = { metricType: args.metricType, target: clone(context.activeGoal?.clinicalTarget || null), source: context.activeGoal?.clinicalTarget ? "CARE_TEAM_CONFIGURATION" : "UNAVAILABLE" };
    else if (name === "getGoalProgress") result = { goalId: args.goalId, progress: clone(context.activeGoal?.progress || null), actions: clone(context.activeGoal?.actions || []), source: "PATIENT_RUNTIME" };
    // The resolved shapes, handed over exactly as the goals screen received them. EMMI does no
    // arithmetic on a baseline: whatever it says about 137 or 193.8 is the number the patient is
    // looking at, or it is nothing.
    else if (name === "getAccessBaseline") {
      const baselines = clone(context.accessGoalBaselines || []);
      const requested = args.goalType ? baselines.filter(item => item.goalType === args.goalType) : baselines;
      result = { baselines: requested, source: requested.length ? "PATIENT_RUNTIME" : "UNAVAILABLE" };
    }
    else if (name === "getEducationRecommendation") result = { goalId: args.goalId, topic: clone(context.activeGoal?.nextBestEducation || null), source: context.activeGoal?.nextBestEducation ? "APPROVED_TOPIC_CATALOG" : "UNAVAILABLE" };
    // The care team the patient actually has, built by careTeamDirectory from their own record,
    // rather than a single display name. EMMI can only name someone this list contains.
    else if (name === "getCareTeam") result = { physicianDisplayName: context.physicianDisplayName || null, enrollmentSource: context.enrollmentSource || null, members: clone(context.careTeam || []) };
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
    } else if (name === "getMedicationSupply") {
      result = { medications: clone(this.onMedicationSupply() || []) };
    } else if (name === "getActiveRefills") {
      result = { refills: clone(this.onActiveRefills() || []) };
    } else if (name === "startRefillReview") {
      const opened = this.onRefillReview({ medicationId: String(args.medicationId || "") });
      result = opened ? { success: true, ...opened } : { success: false, status: "MEDICATION_NOT_FOUND" };
    } else if (name === "getGoalBarriers") {
      result = { goalId: context.activeGoal?.id || null, barriers: clone(context.activeGoal?.barriers || []) };
    } else if (name === "recordGoalBarrier") {
      const recorded = this.onBarrier({ category: String(args.category || "OTHER"), patientDescription: String(args.patientDescription || "") });
      result = recorded
        ? { success: true, barrierId: recorded.id, category: recorded.category, status: recorded.status, owner: recorded.owner, resolutionPath: recorded.resolutionPath, alreadyKnown: Boolean(recorded.alreadyKnown) }
        : { success: false, status: "NO_ACTIVE_GOAL" };
    } else if (name === "createGoalReminder") {
      // A reminder is the patient's decision. Without it there is nothing to save, and EMMI must
      // not claim otherwise.
      if (args.confirmed !== true) result = { success: false, status: "CONFIRMATION_REQUIRED" };
      else {
        const saved = this.onReminder({ slot: String(args.slot || "").toUpperCase() });
        result = saved ? { success: true, slot: saved.slot, time: saved.time, channel: saved.channel, note: "Reminders appear inside ITERA. No phone notification is scheduled." } : { success: false, status: "REMINDER_NOT_SAVED" };
      }
    } else if (name === "getUpcomingAppointments") {
      result = clone(this.onUpcomingAppointments() || { appointments: [], requests: [] });
    } else if (name === "getAppointment") {
      // A "not found" answer is an object too, so it has to be recognised by its own shape rather
      // than by being falsy — otherwise a missing appointment is reported as a found one.
      const found = this.onAppointment({ appointmentId: String(args.appointmentId || "") });
      result = found?.appointment ? clone(found) : { success: false, status: "NOT_FOUND" };
    } else if (name === "getSchedulingCapability") {
      // Not every office can be booked, and some cannot be reached at all. An unresolved capability
      // is reported as unknown rather than assumed, because assuming it invents a channel.
      const providerId = String(args.providerId || "");
      const resolved = providerId ? this.onSchedulingCapability({ providerId, appointmentType: String(args.appointmentType || "") }) : null;
      result = !providerId
        ? { success: false, status: "PROVIDER_REQUIRED", nextStep: "ASK_PATIENT_TO_CHOOSE_PROVIDER", availabilityChecked: false }
        : resolved?.capability
        ? { capability: resolved.capability, supportedModalities: clone(resolved.supportedModalities || []) }
        : { success: false, status: "CAPABILITY_UNKNOWN" };
    } else if (name === "getProviderAvailability") {
      // Real availability only. A lookup that did not succeed is a failure, never an empty calendar
      // and never a time the model may fill in for itself.
      const providerId = String(args.providerId || "");
      const availability = providerId ? this.onProviderAvailability({ providerId, preferredTimeOfDay: String(args.preferredTimeOfDay || ""), modality: String(args.modality || "") }) : null;
      result = !providerId
        ? { ok: false, error: "PROVIDER_REQUIRED", nextStep: "ASK_PATIENT_TO_CHOOSE_PROVIDER", availabilityChecked: false }
        : availability?.ok
        ? { ok: true, slots: clone(availability.slots || []) }
        : { ok: false, error: availability?.error || "AVAILABILITY_UNAVAILABLE" };
    } else if (name === "startAppointmentRequest") {
      // Opening the flow is not requesting a visit, the same way opening a refill review is not
      // requesting a refill.
      const opened = this.onStartAppointmentRequest({ reasonCategory: String(args.reasonCategory || "OTHER"), providerId: String(args.providerId || ""), reasonSummary: String(args.reasonSummary || "").slice(0, 400) });
      result = opened ? { success: true, status: "FLOW_OPENED", needId: opened.needId || opened.id || "" } : { success: false, status: "APPOINTMENT_FLOW_NOT_OPENED" };
    } else if (name === "createAppointmentRequest") {
      if (args.confirmed !== true) result = { success: false, status: "CONFIRMATION_REQUIRED" };
      else {
        const sent = this.onCreateAppointmentRequest({ needId: String(args.needId || ""), confirmed: true });
        // A request that was sent is a request. A request that was not sent is never described as one.
        result = sent?.success
          ? { success: true, status: sent.status || "REQUEST_SENT", needId: sent.needId || String(args.needId || "") }
          : { success: false, status: sent?.status || "REQUEST_NOT_SENT", needId: String(args.needId || "") };
      }
    } else if (name === "bookAppointment") {
      if (args.confirmed !== true) result = { success: false, status: "CONFIRMATION_REQUIRED" };
      else {
        const booked = this.onBookAppointment({ needId: String(args.needId || ""), slotId: String(args.slotId || ""), confirmed: true });
        // Only the booking system's own confirmation may be called confirmed. A slot that vanished
        // between being shown and being chosen is reported as unavailable, never as booked.
        result = booked?.success
          ? { success: true, status: booked.status || "CONFIRMED", confirmationNumber: booked.confirmationNumber || "" }
          : booked?.slotGone
            ? { success: false, status: "SLOT_UNAVAILABLE" }
            : { success: false, status: booked?.status || "BOOKING_FAILED" };
      }
    } else if (name === "rescheduleAppointment") {
      if (args.confirmed !== true) result = { success: false, status: "CONFIRMATION_REQUIRED" };
      else {
        const changed = this.onRescheduleAppointment({ appointmentId: String(args.appointmentId || ""), confirmed: true });
        result = changed?.success ? { success: true, status: changed.status || "RESCHEDULE_REQUESTED" } : { success: false, status: changed?.status || "RESCHEDULE_NOT_REQUESTED" };
      }
    } else if (name === "cancelAppointment") {
      // A cancellation takes away care the patient is counting on and cannot be undone from here.
      // Chat text is never enough: the patient confirms it explicitly, every time.
      if (args.confirmed !== true) result = { success: false, status: "CONFIRMATION_REQUIRED" };
      else {
        const canceled = this.onCancelAppointment({ appointmentId: String(args.appointmentId || ""), confirmed: true });
        result = canceled?.success ? { success: true, status: canceled.status || "CANCELED" } : { success: false, status: canceled?.status || "CANCEL_NOT_COMPLETED" };
      }
    } else if (name === "createAppointmentReminder") {
      if (args.confirmed !== true) result = { success: false, status: "CONFIRMATION_REQUIRED" };
      else {
        const saved = this.onAppointmentReminder({ appointmentId: String(args.appointmentId || ""), slot: String(args.slot || "").toUpperCase(), confirmed: true });
        result = saved
          ? { success: true, slot: saved.slot, time: saved.time, channel: "IN_APP", note: "Reminders appear inside ITERA. No phone notification is scheduled." }
          : { success: false, status: "REMINDER_NOT_SAVED" };
      }
    } else if (name === "getCareCircle") {
      result = clone(this.onCareCircle() || { allowed: false, reason: "NO_CARE_CIRCLE", members: [] });
    } else if (name === "shareAppointment") {
      if (args.confirmed !== true) result = { success: false, status: "CONFIRMATION_REQUIRED" };
      else {
        const shared = this.onShareAppointment({ appointmentId: String(args.appointmentId || ""), inviteId: String(args.inviteId || ""), confirmed: true });
        // Sharing is scoped. What was shared comes back from the application, never from here.
        result = shared?.success ? { success: true, status: shared.status || "SHARED", scope: clone(shared.scope || null) } : { success: false, status: shared?.status || "NOT_SHARED" };
      }
    } else if (name === "describeCurrentView") {
      const view = this.onDescribeView();
      result = view ? clone(view) : { found: false, note: "There is no screen description available right now." };
    } else if (name === "performViewAction") {
      // Every rule about what EMMI may press lives in the shell, next to the controls themselves.
      // This branch only carries the request across and reports back exactly what happened, which
      // is what keeps "I booked it" from ever being said by a tool that did not book anything.
      const performed = await this.onPerformViewAction({
        actionId: String(args.actionId || ""),
        optionRef: args.optionRef === undefined || args.optionRef === null ? "" : String(args.optionRef),
        text: String(args.text || ""),
        confirmed: args.confirmed === true
      });
      result = clone(performed || { success: false, status: "NOT_AVAILABLE" });
    } else if (name === "saveEnrollmentProgress") { result = { success: true, patientId, currentScreen: context.currentScreen, protectedFieldsUnchanged: ["consent", "eligibility", "enrollmentStatus"] }; this.onProgress(result); }
    else if (name === "evaluateClinicalEscalation") {
      // Thresholds are read from the monitoring rules rather than written here. They used to be
      // inline copies that happened to match; changing the configuration would have left this
      // tool quietly enforcing the old numbers.
      const symptoms = String(args.symptoms || "").toLowerCase();
      const emergencySymptoms = EMERGENCY_SYMPTOM_PATTERN.test(symptoms);
      const reading = { systolic: Number(args.systolic), diastolic: Number(args.diastolic), timestamp: new Date().toISOString(), unit: "mmHg" };
      const classification = classifyObservation(reading, {
        rules: DEMO_BP_MONITORING_RULES,
        symptoms: { chestPain: emergencySymptoms }
      });
      const severity = classification.state === BP_CLINICAL_STATE.CRITICAL_WITH_CONCERNING_SYMPTOMS || classification.state === BP_CLINICAL_STATE.CRITICAL || emergencySymptoms
        ? "EMERGENCY"
        : classification.readingClassification === "NEEDS_REVIEW" ? "CARE_TEAM_REVIEW" : "NORMAL";
      result = {
        severity,
        instruction: severity === "EMERGENCY" ? "CALL_911" : severity === "CARE_TEAM_REVIEW" ? "CREATE_HIGH_PRIORITY_TASK" : "CONTINUE",
        clinicalState: classification.state,
        ruleId: classification.ruleId,
        ruleVersion: classification.ruleVersion,
        policy: "PROTOTYPE_MOCK_RULES_NOT_FOR_CLINICAL_USE"
      };
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
