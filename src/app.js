import { BP_FULFILLMENT_DEVICE_MODELS, CANONICAL_PATIENT_SCENARIO, DEFAULT_PROTOTYPE_CONFIG, PROTOTYPE_OPTIONS, SCENARIOS, SECONDARY_COVERAGE_STATUSES, isProviderReferralSource, normalizePrototypeConfig, prescriberFor, scenarioRequiresPhysician, scenarioUsesBloodPressureMonitoring } from "./config.js";
import { commonMessagesFor, htmlLanguage, localeCode, localize, localizeOfferText } from "./i18n.js";
import { AUTHORITY_VERIFICATION_METHODS, MockEnrollmentService, DraftStore, audit } from "./services.js";
import { resetEnrollmentSession } from "./enrollmentSession.js";
import { journeyFor, nextScreen, previousScreen, progressFor } from "./machine.js";
import { ACCESS_OUTCOME_TARGETS, accessProgressMeasure, assignedAccessGoals, isAssignedAccessGoal, patientStartingPoint } from "./accessCareActivation.js";
import {
  Activity, ArrowLeft, ArrowRight, BadgeCheck, Bell, BookOpen, CalendarDays, ClipboardCheck, ChartNoAxesColumnIncreasing,
  Check, ChevronRight, CircleHelp, Clock3, ExternalLink, FileText, Globe2,
  HeartPulse, House, Info, LockKeyhole, Mic, MicOff, Package, Phone, Pill, ShieldCheck,
  Share2, SlidersHorizontal, Stethoscope, TabletSmartphone, Target, TrendingUp, UserPlus, UserRound, UsersRound, Utensils, Wifi,
  AudioLines, MessageCircle, Pause, Play, RotateCcw,
  Droplets, Footprints, Hospital, Scale, Smile, Wind,
  // Barrier iconography: a small, restrained set — one glyph per family of difficulty.
  Car,
  // Appointment iconography: where the visit happens, how it happens, when, and when something
  // needs the patient's attention.
  MapPin, Video, TriangleAlert, CalendarClock
} from "lucide";
import { APPOINTMENT_ACTORS, APPOINTMENT_AUDIT_EVENTS, APPOINTMENT_DRAFT_FIELDS, APPOINTMENT_MODALITY, APPOINTMENT_REASON_CATEGORIES, APPOINTMENT_SOURCES, APPOINTMENT_STATUS, APPOINTMENT_URGENCY, TIME_OF_DAY, advanceAppointment, applyBookingConfirmation, appointmentAnalytics, appointmentCareTeamSummary, appointmentIdempotencyKey, appointmentNextStep, appointmentPatientStatus, appointmentPreferenceResumeStep, appointmentStatusTone, beginAppointmentPreferences, canActOnAppointment, createAppointmentDraft, createAppointmentNeed, draftIsSubmittable, findByIdempotencyKey, findDuplicateAppointmentNeed, findUpcomingAppointmentWithProvider, pastAppointments, pendingRequests, resolveAppointmentActor, updateAppointmentDraft, upcomingAppointments } from "./appointments.js";
import { SCHEDULING_CAPABILITY, bookSlot, getProviderAvailability, reservableAvailabilitySlots, resolveSchedulingCapability, submitAppointmentRequest } from "./schedulingCapability.js";
import { CARE_TEAM_SOURCES, PROFESSIONAL_TYPES, buildCareTeam, professionalNotFoundPlan, resolveRequestedProfessional } from "./careTeamDirectory.js";
import { APPOINTMENT_BARRIER_REASONS, APPOINTMENT_REMINDER_SLOTS, ATTENDANCE_OUTCOMES, appointmentBarrierPlan, appointmentFollowUpDue, appointmentReminderCapability, appointmentReminderSlotOptions, appointmentShareScope, attendanceFollowUpPlan, careCircleSharingOptions, createAppointmentReminder, preVisitCheckOptions, sharedAppointmentPayload } from "./appointmentSupport.js";
import { APPOINTMENT_PREFERENCE_STEPS, appointmentBarrierCheckView, appointmentBriefView, appointmentDetailView, appointmentFollowUpView, appointmentPrepConversationOpening, appointmentPrepView, appointmentPreferenceView, appointmentShareView, appointmentSlotReviewView, appointmentsListScreen, bookingConfirmationView, formatAppointmentTime, formatAppointmentWhen, needAnAppointmentCard, requestConfirmationView, slotPickerView, upcomingCareSection } from "./appointmentViews.js";
import { CONFIRMATION_REQUIRED_KINDS, VIEW_ACTION_KINDS, describeEmmiViewFromDom, emmiViewForModel, emmiViewSignature, findViewAction, findViewOption, normalizeEmmiView, withLiveControls } from "./emmi/viewContext.js";
import { describeAppointmentView, describeResolutionView } from "./appointmentViewContext.js";
import { describeCareCircleView, describeDeviceView, describeEnrollmentView, describeGoalView, describeMedicationView } from "./careViewContext.js";
import { SIMULATED_APPOINTMENT_RESPONSE_DELAY_MS, simulateAppointmentServiceResponse, simulatedAppointmentResponseDueAt, simulatedAppointmentResponseIsDue } from "./appointmentResponseSimulator.js";
// The barrier resolution engine: the domain machine, the simulated outside world, and the views.
// The shell owns none of the three — it connects them to this patient's record, the care-team
// queue and the appointment the resolution is about.
import { BARRIER_TYPES, RESOLUTION_EVENTS, RESOLUTION_STATUS, addressErrorText, advanceResolution, pickupTimeChoices, returnTripChoices, transportNeedOptions, appointmentReadiness, barrierListState, careTeamAssistanceRequest, classifyResolutionIntent, createResolution, homeAddressFrom, isWorkingStep, recommendedPickupTime, resolutionEvent, resolutionPlaybookFor, resolutionSpeech, toggleTransportNeed, transportationSuitability, validateAddress } from "./barrierResolution.js";
import { barrierDemoMode, barrierPause, careTeamService, companionService, schedulingAssistService, setBarrierLatencyScale, transportationService, videoReadinessService } from "./barrierProviders.js";
import { allSetConfirmation, appointmentReadinessPanel, barrierResolutionScreen } from "./barrierResolutionViews.js";
import { EMMI_CONFIG, emmiPrototypeIsSafe } from "./emmi/config.js";
import { EmmiLiveClient } from "./emmi/liveClient.js";
import { EmmiAuditLog, EmmiToolOrchestrator, clearEmmiAuditLog, selectDemoPatientId } from "./emmi/tools.js";
import { emmiVoiceIsSupported, resolveEmmiLanguage } from "./emmi/messages.js";
import { buildHomeNarration, buildNarration, buildTransitionNarration } from "./emmi/narrative.js";
import { EmmiTransitionManager, semanticSpeechSegments } from "./emmi/transitionManager.js";
import { EmmiConversationManager, clearEmmiConversation } from "./emmi/conversationManager.js";
import { EMMI_PREFERENCES_KEY, clearEmmiEnrollmentContinuity, readEmmiPreferences } from "./emmi/preferences.js";
import { EmmiTextOrchestrator } from "./emmi/textOrchestrator.js";
import { detectEmergencyLanguage, safetyResolutionCopy } from "./emmi/safetyPolicy.js";
import { emmiVoiceMetadata } from "./emmi/voiceIdentity.js";
import { getEmmiFollowUps, getEmmiQuickQuestions } from "./emmi/quickQuestions.js";
import { isLanguageOfferAccepted, isLanguageOfferDeclined, resolveLanguageIntent } from "./emmi/languageDetection.js";
import { EMMI_VISIBLE_STATE, emmiVisibleStateLabel, resolveEmmiVisibleState } from "./emmi/presentationState.js";
import { sanitizeEmmiTranscript } from "./emmi/transcript.js";
import { EMMI_DEMO_PATIENTS, emmiDemoCoverage } from "./mock/emmiFixtures.js";
import { IMPORTANT_INFORMATION_COPY, programDisclosureConfig } from "./programDisclosures.js";
import { enrollmentWelcomeFor } from "./enrollmentWelcome.js";
import { resolveNextBestAction } from "./nextBestAction.js";
import { FLOW_STATUS, emptyFlowProgress, resolveCareSetupResumeRoute, resolveEnrollmentTransition, resolveGettingStartedEntryRoute } from "./flowTransitions.js";
import { CARE_CIRCLE_COPY, GROWTH_MOMENTS, SHARE_ACCESS_COPY, shareAccessEligibility } from "./growthMoments.js";
import { GrowthStore, growthPromptAvailable, maskPhone } from "./growth.js";
import { parseContactCard } from "./contactCard.js";
import { NAVIGATION, SCROLL, afterRender as afterRenderScroll, beforeRender as beforeRenderScroll, captureOverlayPosition, claimHistoryScrollRestoration, requestScroll, restoreOverlayPosition } from "./scroll.js";
import { EXPLANATION_CODES, accessTrackCost, resolveExpectedPatientResponsibility } from "./financialResponsibility.js";
import { GOAL_CONFIG, LEGACY_GOAL_TYPES, localDateKey, createPatientGoal, goalActionIcon, goalCategoryOf, goalDisplayName, goalIsReadyToPersonalize, goalNextBestAction, goalProgressSummary, localGoalText, resolveGoalIcon, sortGoalsForPatient, suggestedActionsFor } from "./goals.js";
import { ingestBloodPressureObservation } from "./clinicalMonitoring.js";
import { DEMO_BP_CLINICAL_TARGET, DEMO_BP_MONITORING_RULES, buildBloodPressureGoalRuntime, classifyBloodPressure, nextBestGoalEducation, resolveGoalActionVerification } from "./goalHealth.js";
import { BloodPressureSimulator, SIMULATION_STATUS, SIMULATION_TARGET, simulationAllowed } from "./bpSimulator.js";
import { REFILL_TRIGGER_POLICY, SIGNAL_STATUS, answerSupplySignal, detectLowSupply, estimateMedicationSupply, openSignalFor, supersedeSignalsForDispense, supplyPhrase, supplySignalAnalytics } from "./medicationSupply.js";
import { REFILL_BLOCKERS, REFILL_PATHS, REFILL_STATUS, SUPPLY_ANSWERS, TAKING_ANSWERS, advanceRefill, createRefillEpisode, openRefillFor, refillAnalytics, refillCareTeamSummary, refillIdempotencyKey, refillIsOpen, refillNextStep, refillPatientStatus, resolveRefillPath, statusForPath } from "./medicationRefill.js";
import { BARRIER_CATEGORIES, BARRIER_SOURCES, BARRIER_STATUS, INTERVENTION_TYPES, RESOLUTION_OUTCOMES, applyIntervention, barrierAnalytics, barrierCategoryConfig, barrierIcon, barrierIsActive, barrierOptionsFor, barrierPatientStatus, barrierPatientSummary, careTeamEscalationSummary, classifyBarrierText, confirmBarrier, createGoalBarrier, findReusableBarrier, localBarrierText, normalizeBarrierRecord, recordInterventionOutcome, reopenBarrier, resolveBarrier } from "./goalBarriers.js";

const app = document.querySelector("#app");
// What the patient is actually looking at right now. render() runs after the handlers have
// already moved state.screen forward, so the scroll policy needs the screen it is leaving and
// the error it was already showing to tell a new screen from an in-place update.
let paintedScreen = null;
let paintedError = "";
claimHistoryScrollRestoration();
const params = new URLSearchParams(location.search);
const simulatedAppointmentServiceEnabled = params.get("appointmentService") !== "manual";
const prototypeMode = params.get("prototype") === "1";
const patientShareSource = params.get("source") === "patient-share";
// The simulated provider delays are the point of the demo, so they are on by default. A test
// harness asks for them to be skipped rather than waiting a second per step of every flow.
if (params.get("barrierLatency") === "0") setBarrierLatencyScale(0);
// §15. Running the same demo twice needs a way to put the barriers back — and only the barriers.
// "/new" throws the whole enrollment away, which is far too much when all somebody wants is to
// show the transportation flow again to the next person in the room. Carried out at module scope,
// before boot() reads the draft, and the parameter is rewritten out of the URL in the same breath
// so a refresh does not silently wipe a resolution the patient has since started.
const resettingBarrierDemo = params.get("resetBarriers") === "1";
if (resettingBarrierDemo) {
  try {
    const key = "itera.enrollment.safe-draft.v2";
    const stored = JSON.parse(localStorage.getItem(key) || "null");
    if (stored) {
      localStorage.setItem(key, JSON.stringify({
        ...stored,
        barrierResolutions: [],
        barrierActivity: [],
        barrierReadinessAck: {},
        // The tasks EMMI escalated belong to those resolutions and would otherwise outlive them.
        careTeamTasks: (stored.careTeamTasks || []).filter(task => task.type !== "APPOINTMENT_BARRIER")
      }));
    }
  } catch { /* storage can be unavailable; the demo simply starts with whatever is there */ }
  params.delete("resetBarriers");
  const query = params.toString();
  history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
}
// ---------------------------------------------------------------------------------------------
// How the app was opened
//
// A patient opens a bare link. Everything else — the scenario console, a named fixture, a
// relaunched QA scenario — is a tester deliberately asking for it through the URL. So the plain
// link means one thing and one thing only: this patient's ACCESS invitation, already configured.
// There is nothing to choose, so there is no screen on which to choose it.
// ---------------------------------------------------------------------------------------------
const adminMode = params.get("admin") === "1" || location.pathname === "/admin";
const canonicalInvitation = !adminMode && !prototypeMode && !params.has("scenario");
// The invitation gets its own draft and conversation scope. A QA scenario left half-finished in
// this browser must never resume inside a patient's invitation, and the reverse is just as wrong.
const scenarioId = canonicalInvitation ? "access-invitation" : prototypeMode ? "prototype" : params.get("scenario") || "access-happy";
// The invitation carries the verification material. The prototype prefills the form from it so a
// tester can walk the journey; a real deployment would leave both fields empty.
const invitationIdentity = () => state.offer?.patient?.identityMatch || { dobIso: "", zip: "" };
const draftStore = new DraftStore();
const growthStore = new GrowthStore();

// ---------------------------------------------------------------------------------------------
// "/new" is a command, not a screen
//
// The bare link resumes whatever enrollment this browser is holding — that is what makes it a
// patient's own link and why it must not start over on every visit. "/new" is the other verb:
// forget that enrollment and begin another one.
//
// It is carried out HERE, at module scope, for one reason. Everything below runs after it: the
// first render, and boot(), which reads the draft. Resetting any later would paint the previous
// patient and then blank them, and in a clinical prototype that flash is not a cosmetic flicker —
// it is showing patient A's name, readings and care plan to whoever is holding the phone to start
// patient B. There is no render between the reset and the clean state because there is no render
// before this line at all.
//
// The URL is rewritten to "/" in the same breath, and that is not tidying. A command that stays in
// the address bar is a command that runs again: refresh would discard the enrollment the patient
// had just begun, forever, one keystroke at a time. Rewriting it means refresh resumes B, which is
// what a patient reloading a page expects and what §7 asks for.
//
// Nothing about the invitation itself changes. "/new" carries no scenario parameter, so the
// canonical ACCESS patient resolves exactly as it does at "/", and the journey opens on its first
// real screen because a cleared draft is a draft boot() finds nothing in.
const startingNewEnrollment = location.pathname === "/new";
if (startingNewEnrollment) {
  resetEnrollmentSession({
    draftStore,
    growthStore,
    clearConversation: clearEmmiConversation,
    clearAuditLog: clearEmmiAuditLog,
    clearAssistantContinuity: clearEmmiEnrollmentContinuity
  });
  history.replaceState(null, "", `/${location.search}${location.hash}`);
}
// The demo pharmacy fill dates are relative to today so the prototype always shows one medication
// approaching a refill and one comfortably stocked, whenever it is opened.
const daysBeforeToday = days => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
const PROTOTYPE_DISPENSE_DATES = Object.freeze({ lisinopril: daysBeforeToday(25), atorvastatin: daysBeforeToday(6) });
const savedEmmiPreferences = readEmmiPreferences();
let eligibilityRequest = null;
const savedPrototypeConfig = (() => { try { return JSON.parse(localStorage.getItem("itera.prototype.config.v1") || "null"); } catch { return null; } })();
// A saved console configuration belongs to the console. It never reaches the invitation: the
// patient's scenario is the canonical one on every visit, including after a refresh.
let prototypeConfig = normalizePrototypeConfig(canonicalInvitation ? CANONICAL_PATIENT_SCENARIO : patientShareSource ? DEFAULT_PROTOTYPE_CONFIG : (savedPrototypeConfig || DEFAULT_PROTOTYPE_CONFIG));
const prototypePrescriber = prescriberFor(prototypeConfig);
let service = new MockEnrollmentService(scenarioId, prototypeMode || canonicalInvitation ? prototypeConfig : null);
let conditionMenuOpen = false;
let state = {
  scenarioId, screen: adminMode ? "PROTOTYPE_SETUP" : "OFFER_LOADING", offer: null, language: "en", role: "patient", completionRole: "patient",
  representativeFullName: "", representativeRelationship: "", representativeAuthorityType: "", representativePhone: "", representativeOtpDeliveryId: "", representativeOtpResendAvailableAt: 0,
  phoneVerified: false, phoneVerificationMethod: "", phoneVerifiedAt: "", representativeAuthorityAttested: false, authorityAttestation: false, authorityAttestedAt: "", authorityVerificationMethod: AUTHORITY_VERIFICATION_METHODS[0], authorityAdditionalVerificationRequired: false,
  accessNoticeAcknowledgedAt: "", disclosureAcknowledgedAt: "", disclosureVersion: "", accessDisclosureView: null, consentRole: "", consentVersion: "", consentTimestamp: "", consentAcknowledgement: null, sessionId: globalThis.crypto?.randomUUID?.() || `session_${Date.now().toString(36)}`, sessionMetadata: { platform: navigator.userAgentData?.platform || navigator.platform || "unknown" }, ipMetadata: null, identityVerified: false,
  identityAttempts: 0, consentSaved: false, consentSubmissionSelections: null, enrollmentConfirmed: false, accessEligible: false, accessOutcome: null,
  alignmentConfirmed: false, devicePath: null, addressConfirmed: false, setupComplete: false, readingReceived: false,
  enrollmentStatus: "NOT_STARTED", enrollmentCompletedAt: "", activationStatus: "NOT_STARTED", activationStartedAt: "", deviceSetupStatus: "NOT_STARTED", deviceSetupStartedAt: "", baselineStatus: "NOT_STARTED", baselineStartedAt: "", baselineCompletedAt: "", baselineDeferredAt: "", baselineResumeScreen: "", baselineReminderStatus: "NOT_SCHEDULED",
  flowProgress: { GETTING_STARTED: emptyFlowProgress() }, flowTransitionNotice: "",
  bpBaselineStatus: "NOT_STARTED", bpBaselineRequiredReadings: 3, bpBaselineReadingCount: 0, bpBaselineRemainingReadings: 3, bpDevicePath: "", bpDeviceIdentificationMethod: "", bpDeviceVerificationStatus: "NOT_STARTED", bpDeviceVerificationResult: "", patientHasBloodPressureMonitor: false, deviceSource: "UNKNOWN", deviceVerificationStatus: "NOT_STARTED", integrationProvider: "UNKNOWN", assignedDeviceId: "", deviceVendor: "", deviceModel: "", deviceStatus: "", integrationStatus: "", lastTransmissionAt: "", last4DeviceId: "", patientDeviceConfirmationChoice: "", patientDeviceConfirmed: null, patientDeviceConfirmedAt: "", confirmedDeviceId: "", firstTransmissionVerified: null, firstTransmissionDeviceId: "", firstTransmissionAt: "", firstTransmissionSystolic: null, firstTransmissionDiastolic: null, deviceUncertaintyStep: false, bpDevice: null, armCircumferenceValue: "", armCircumferenceUnit: "cm", armMeasurementStatus: "", cuffSelectionMethod: "", selectedCuffOption: "", cuffSelectionStatus: "", cuffSizeSelected: null, deviceModelSelected: null, shippingAddress: null, shippingAddressConfirmed: false, shippingAddressMode: "existing", deviceFulfillmentId: "", deviceFulfillmentStatus: "NOT_REQUESTED", careTeamTasks: [], appointments: [], appointmentDraft: null, appointmentFlow: null, activeAppointmentId: "", appointmentNotice: "",
  // Barrier resolution. `barrierResolutions` is the record of every difficulty EMMI has been
  // asked to solve for an appointment and how far it got; `barrierActivity` is the internal
  // activity log (§23) that is never shown to the patient; `barrierReadinessAck` remembers the
  // patients who answered "I’m all set", which no resolution record can carry.
  barrierResolutions: [], activeResolutionId: "", barrierActivity: [], barrierError: "", barrierReadinessAck: {}, bpDeviceFulfillmentStatus: "NOT_STARTED", bpDeviceFulfillmentRequestedAt: "", bpBaselineSourceType: "", bpReadings: [], bpReadingCount: 0, bpReadingReceipts: [], bpMeasurementPhase: "WAITING", bpBaseline: null, bpEscalationState: null, bpMonitoringEpisode: null, clinicalReportedBloodPressure: null, accessBaselineBloodPressure: null,
  reading: null, callbackRequested: false, onboarding: {},
  healthInformationStepStatus: "NOT_STARTED", healthInformationReviewStatus: "UNREVIEWED", healthInformationReviewResult: "", healthInformationReviewedAt: "", healthInformationReviewedBy: "", healthInformationReviewSource: "", healthInformationFlowStep: "CHOICE", healthInformationUpdateDraft: { id: "", updateType: "", relatedConditionIds: [], patientReportedText: "" }, patientReportedHealthUpdates: [], healthInformationHelpNote: "",
  // Prototype medication fixture. The supply, pharmacy and dispense fields are shaped the way a
  // real pharmacy feed would arrive, so the supply engine does not change when one exists. Nothing
  // here is clinical data: it is demo content, and every estimate built from it is treated as an
  // estimate.
  medicationsReviewStatus: "NOT_STARTED", careMedications: [
    {
      id: "med-lisinopril", name: "Lisinopril", strength: "10 mg", details: "10 mg · Once daily", sig: "Take once daily", active: true,
      detailsDisplay: { en: "10 mg · Once daily", es: "10 mg · Una vez al día", ht: "10 mg · Yon fwa pa jou" },
      sigDisplay: { en: "Take once daily", es: "Tome una vez al día", ht: "Pran yon fwa pa jou" },
      medicationRequestId: "rx-lisinopril-2026", prescriber: prototypePrescriber,
      pharmacy: { id: "pharm-cvs", name: "CVS Pharmacy", address: "123 Main Street", phone: "+13055550188", statusIntegration: false },
      refillsRemaining: 0, prescriptionExpiresOn: "2027-02-01",
      lastDispense: { date: PROTOTYPE_DISPENSE_DATES.lisinopril, daysSupply: 30, quantity: 30, source: "PHARMACY_DISPENSE" },
      refillWorkflow: {}
    },
    {
      id: "med-atorvastatin", name: "Atorvastatin", strength: "20 mg", details: "20 mg · Once daily", sig: "Take once daily at bedtime", active: true,
      detailsDisplay: { en: "20 mg · Once daily", es: "20 mg · Una vez al día", ht: "20 mg · Yon fwa pa jou" },
      sigDisplay: { en: "Take once daily at bedtime", es: "Tome una vez al día al acostarse", ht: "Pran yon fwa pa jou anvan ou dòmi" },
      medicationRequestId: "rx-atorvastatin-2026", prescriber: prototypePrescriber,
      pharmacy: { id: "pharm-cvs", name: "CVS Pharmacy", address: "123 Main Street", phone: "+13055550188", statusIntegration: false },
      refillsRemaining: 3, prescriptionExpiresOn: "2027-02-01",
      lastDispense: { date: PROTOTYPE_DISPENSE_DATES.atorvastatin, daysSupply: 90, quantity: 90, source: "PHARMACY_DISPENSE" },
      refillWorkflow: {}
    }
  ],
  medicationSupplySignals: [], medicationRefills: [], refillFlow: { medicationId: "", step: "", answer: "" }, activeRefillId: "", medicationNotice: "",
  medicationReviews: {}, additionalMedications: [], additionalMedicationsStatus: "UNREVIEWED", medicationChangeId: "", medicationChangeType: "", medicationAddOpen: false, medicationEditId: "",
  carePreferencesStatus: "NOT_STARTED", preferredContactMethod: "", preferredCareLanguage: "", preferredContactTime: "none",
  goalsStatus: "NOT_STARTED", careGoals: [], careGoalsNote: "", goalFlowStep: "DISCOVERY", goalFlowOrigin: "ONBOARDING", patientGoals: [], goalPrimaryId: "", goalSecondaryId: "", goalPlanningGoalId: "", goalPlanStatus: "NOT_STARTED", goalPlanDraft: { actionIds: [], customAction: "", frequency: "few-days", remindersEnabled: false, whyItMatters: "" }, activeGoalId: "", goalDetailView: "SUMMARY", goalBarrierDraft: { category: "", patientDescription: "" }, activeBarrierId: "", goalSupportDraft: "", goalNotice: "", goalHistory: [],
  // "Nothing right now" leaves no barrier behind, so without recording the answer itself the care
  // team cannot tell a patient who said their care is going fine from one who never got the
  // question. Keyed by goal: RAISED, NONE, or absent for a goal left untouched.
  supportNeedsStatus: "NOT_STARTED", supportNeedsAnswers: {}, supportNeedsOther: "",
  patientAddedCareTeamMembers: [], careTeamAddOpen: false, careTeamMemberDraft: { displayName: "", role: "", specialty: "", practiceName: "" }, careTeamNotice: "",
  supportRole: "NONE", careCircleStatus: "NONE", careCircleInvitePending: false, careCircleJustSent: false, careCircleContext: "ENROLLMENT", supportPersonName: "", supportPersonPhone: "", supportPersonRelationship: "", supportPersonRelationshipOther: "", supportInviteId: "", supportInviteToken: "", supportInviteStatus: "NONE", supportInviteSentAt: "", supportInviteAcceptedAt: "", careCircleContactNumbers: [], careCircleContactPickerStatus: "IDLE", careCircleContactSource: "MANUAL", careCircleManualEntryTracked: false, careCircleManageInviteId: "", careCircleRemovePendingId: "", careCircleNotice: "", careCirclePermissions: { receiveReminders: false, helpWithDeviceSetup: false, helpWithAppointments: false, receiveCareTasks: false, viewLimitedCareProgress: false }, careCirclePromptDismissedAt: "",
  accessShares: [], activeAccessShare: null, shareAccessPromptDismissedAt: "", growthReturnScreen: "", growthContext: "", growthNotice: "",
  audit: [], busy: false, error: "", devOpen: false,
  eligibilityPhase: "checkingEnrollment", eligibilityError: false, eligibilityRequestKey: "",
  assistantOpen: false, assistantOriginScreen: null, assistantScrollY: 0, assistantMessages: [], assistantFaqOpen: false, assistantSupportOpen: false, emmiOfferedLocale: "", emmiPendingLanguageQuestion: "", emmiLanguageStreak: 0, emmiDeclinedLocales: [], assistantLanguageChanged: false, assistantPendingAction: "", assistantPendingAppointmentId: "", assistantBusy: false, assistantDemoPatientId: "", assistantPatientContextKey: "", assistantVoiceState: "DISCONNECTED", assistantVoiceDetail: "", assistantVoiceError: "", assistantVoiceMuted: false, assistantVoiceOptionsOpen: false, assistantError: "", assistantRetryQuestion: "",
  emmiVoiceGuidance: typeof savedEmmiPreferences.emmiVoiceGuidance === "boolean" ? savedEmmiPreferences.emmiVoiceGuidance : false,
  emmiVoiceGuidancePaused: false, emmiWelcomeAcknowledged: Boolean(savedEmmiPreferences.emmiWelcomeAcknowledged), emmiLastGuidanceScreen: "", emmiGuidanceTranscript: "", emmiTranscriptOpen: false, emmiVoiceOptionsOpen: false, emmiIntroSeen: false, emmiTransitionStatus: "IDLE"
};
let emmiAuditLog = null;
let emmiTools = null;
let emmiLive = null;
let emmiTransitionManager = null;
let emmiConversationManager = null;
let emmiTextOrchestrator = null;
let emmiNavigationIntent = null;
let emmiGuidanceTimer = null;
let emmiSheetReturnAction = "open-emmi-voice-options";
// Which control opened the expanded panel: focus goes back to it on close, and analytics record
// the surface without ever needing a second event model per surface.
let emmiExpandedReturnFocus = null;
let emmiExpandedSource = "screen-action";
let emmiOverlayHistoryEntry = false;

const iconMap = {
  lock: LockKeyhole,
  shield: ShieldCheck,
  person: UserRound,
  people: UsersRound,
  calendar: CalendarDays,
  heart: HeartPulse,
  pill: Pill,
  chart: ChartNoAxesColumnIncreasing,
  phone: Phone,
  mic: Mic,
  micOff: MicOff,
  doctor: Stethoscope,
  physician: Stethoscope,
  question: CircleHelp,
  document: FileText,
  medicare: BadgeCheck,
  device: TabletSmartphone,
  home: House,
  language: Globe2,
  wifi: Wifi,
  goals: Target,
  // Goal action iconography: each icon carries meaning, so it reads as comprehension aid
  // rather than decoration.
  bell: Bell,
  sliders: SlidersHorizontal,
  activity: Activity,
  book: BookOpen,
  nutrition: Utensils,
  plan: ClipboardCheck,
  trending: TrendingUp,
  share: Share2,
  userPlus: UserPlus,
  check: Check,
  clock: Clock3,
  box: Package,
  info: Info,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  externalLink: ExternalLink,
  chevronRight: ChevronRight,
  // EMMI voice presentation: a voice-shaped icon rather than a generic gear, so "Voice
  // options" never reads as system settings.
  audioLines: AudioLines,
  chat: MessageCircle,
  pause: Pause,
  play: Play,
  rotate: RotateCcw,
  // Goal category iconography (see GOAL_ICON_REGISTRY): a small set of visual families a
  // patient can start to recognize, rather than one target icon on every goal.
  footprints: Footprints,
  smile: Smile,
  droplets: Droplets,
  scale: Scale,
  wind: Wind,
  car: Car,
  hospital: Hospital,
  // Appointment iconography.
  mapPin: MapPin,
  video: Video,
  alert: TriangleAlert,
  calendarClock: CalendarClock
};
const svgNodes = nodes => nodes.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([key]) => key !== "key").map(([key, value]) => `${key}="${value}"`).join(" ")}></${tag}>`).join("");
const icon = (name, extra = "") => `<span class="icon ${extra}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgNodes(iconMap[name] || iconMap.info)}</svg></span>`;
const L = (en, es, ht) => localize(state.language, { en, es, ht }, en);
// Resolves a { en, es, ht } entry from the shared program disclosure configuration.
const localized = entry => (entry ? localize(state.language, entry, entry.en) : "");
const offerText = (source, variables = {}) => localizeOfferText(state.language, source, variables);
const t = () => commonMessagesFor(state.language);
const languageCode = () => localeCode(state.language);
const languageActionLabel = () => L("Change language to Spanish", "Cambiar idioma a criollo", "Chanje lang pou anglè");
const setLanguage = language => {
  const changed = state.language !== language;
  state.language = language;
  document.documentElement.lang = htmlLanguage(language);
  try { localStorage.setItem("itera.enrollment.language.v1", language); } catch { /* Language persistence is best effort. */ }
  if (state.identityVerified) draftStore.save(state);
  // Applying the same language again (on boot, for example) must not tear down a live session.
  if (changed) syncEmmiLanguage();
};

// The patient's language is the single source of truth for EMMI. A live session carries its
// locale in the system instruction, so a language change has to stop the old-language audio
// and rebuild the session rather than let EMMI finish the sentence it started.
function syncEmmiLanguage() {
  state.emmiLastGuidanceScreen = "";
  state.emmiGuidanceTranscript = "";
  emmiConversationManager?.transition({ ...assistantContext(), locale: languageCode() }, { localeChanged: true });
  if (!emmiVoiceIsSupported(languageCode())) {
    emmiTransitionManager?.cancel("locale_voice_unavailable", { immediate: true });
    if (emmiLive?.isActive()) emmiLive.disconnect("locale_changed");
    state.emmiVoiceGuidance = false;
    state.emmiVoiceGuidancePaused = false;
    state.assistantVoiceError = "VOICE_UNAVAILABLE_FOR_LOCALE";
    persistEmmiPreferences();
    refreshVoiceGuidanceControls();
    if (state.assistantOpen) refreshAssistantLayer();
    return;
  }
  if (!emmiLive?.isActive()) { state.assistantVoiceError = ""; refreshVoiceGuidanceControls(); return; }
  if (!state.emmiVoiceGuidance || !emmiTransitionManager) {
    emmiLive.restartForLocale("").catch(() => { /* The live client publishes a localized safe fallback. */ });
    audit(state, "emmi_language_changed", "success", { locale: languageCode() });
    return;
  }
  // A locale change is a context transition. The transition manager lets the nearest safe
  // clause finish, discards the rest, and reconnects only after that boundary so languages
  // are never mixed inside one explanation.
  syncEmmiNavigationContext({ localeChanged: true, navigationDirection: "LOCALE" });
  audit(state, "emmi_language_changed", "success", { locale: languageCode() });
};
const progressStageLabel = stage => ({
  WHOS_COMPLETING: L("Who’s completing", "Quién completa", "Ki moun k ap ranpli"),
  YOUR_ROLE: L("Your role", "Su rol", "Wòl ou"),
  CONFIRM_IDENTITY: L("Confirm identity", "Confirmar identidad", "Konfime idantite"),
  MEDICARE_INFORMATION: L("Medicare information", "Información de Medicare", "Enfòmasyon Medicare"),
  ELIGIBILITY: L("Eligibility", "Elegibilidad", "Elijibilite"),
  YOUR_CARE: L("Your care", "Su cuidado", "Swen ou"),
  IMPORTANT_INFORMATION: L("Important information", "Información importante", "Enfòmasyon enpòtan"),
  CONSENT: L("Consent", "Consentimiento", "Konsantman"),
  ENROLLING: L("Enrolling", "Inscribiendo", "Enskripsyon"),
  ENROLLMENT_COMPLETE: L("Enrollment complete", "Inscripción completa", "Enskripsyon fini"),
  GETTING_STARTED: L("Getting started", "Primeros pasos", "Kòmanse")
})[stage] || L("Your care", "Su cuidado", "Swen ou");
const cta = (label, action = "next", secondary = false, disabled = false) => `<button type="button" class="button ${secondary ? "secondary" : "primary"}" data-action="${action}" ${disabled ? "disabled" : ""}>${label}${secondary ? "" : icon("arrowRight", "button-icon")}</button>`;
const rows = items => `<div class="card-list">${items.map(([i, title, body]) => `<article class="info-row">${icon(i)}<div><strong>${title}</strong>${body ? `<p>${body}</p>` : ""}</div></article>`).join("")}</div>`;
const choice = (value, i, title, body, checked = false) => `<label class="choice-card"><input type="radio" name="choice" value="${value}" ${checked ? "checked" : ""}><span class="choice-dot"></span>${icon(i)}<span><strong>${title}</strong><small>${body}</small></span></label>`;
const check = (name, label, checked = false, value = "on") => `<label class="check-row"><input type="checkbox" name="${name}" value="${value}" ${checked ? "checked" : ""}><span class="check-box">✓</span><span>${label}</span></label>`;
const titleBlock = (title, subtitle = "", eyebrow = "") => `${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ""}<h1 tabindex="-1">${title}</h1>${subtitle ? `<p class="lead">${subtitle}</p>` : ""}`;
const displayDate = isoDate => {
  const [year, month, day] = isoDate.split("-");
  return year && month && day ? `${month} / ${day} / ${year}` : "";
};
const typedDate = value => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
  return `${digits.slice(0, 2)} / ${digits.slice(2, 4)} / ${digits.slice(4)}`;
};
const localToday = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
};
const phoneDigits = value => String(value || "").replace(/\D/g, "").slice(0, 10);
const formatPhone = value => {
  const digits = phoneDigits(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};
const maskedPhone = value => {
  const digits = phoneDigits(value);
  return digits.length === 10 ? `(***) ***-${digits.slice(-4)}` : "(***) ***-••••";
};
const isValidBirthDate = value => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;
  const [, monthText, dayText, yearText] = match;
  const month = Number(monthText), day = Number(dayText), year = Number(yearText);
  const candidate = new Date(year, month - 1, day);
  const today = new Date();
  return year >= 1900
    && candidate.getFullYear() === year
    && candidate.getMonth() === month - 1
    && candidate.getDate() === day
    && candidate <= today;
};
const art = (kind = "shield", success = false) => {
  const deviceScene = ["device", "wifi"].includes(kind) ? `<div class="device-scene"><span class="cuff"><i></i></span><span class="monitor"><b>120</b><em>80</em><i></i></span>${kind === "wifi" ? '<span class="signal"><i></i><i></i><i></i></span>' : ""}</div>` : "";
  return `<div class="art art-${kind} ${success ? "success" : ""}" aria-hidden="true"><span class="sparkle s1">✦</span><span class="sparkle s2">✦</span><span class="sparkle s3">•</span><div class="art-orbit"></div>${deviceScene || `<div class="art-card"><span class="art-line one"></span><span class="art-line two"></span>${icon(kind, "art-icon")}</div>`}<span class="art-leaf left"></span><span class="art-leaf right"></span></div>`;
};
const physicianDisplayName = () => state.offer?.physician?.displayName || L("your doctor", "su médico", "doktè ou");
const isPersonalRepresentative = () => state.completionRole === "personalRepresentative" || state.role === "representative";
const providerCard = (relationship = L("Referring physician", "Médico remitente", "Doktè ki refere w")) => state.offer?.physician && state.offer?.referringProvider ? `<article class="provider-card"><img src="${state.offer.referringProvider.verifiedPhotoUrl}" alt=""><div><strong>${physicianDisplayName()} <span aria-label="${L("Verified provider", "Proveedor verificado", "Founisè verifye")}">✓</span></strong><small>${relationship}</small></div></article>` : "";
const actions = (primary, back = true, secondary = "", primaryDisabled = false) => `<div class="actions">${secondary ? cta(secondary, "secondary", true) : back ? cta(t().back, "back", true) : ""}${cta(primary, "next", false, primaryDisabled)}</div>`;
const ASSURANCE_VARIANTS = {
  SECURITY: () => ({ icon: "lock", message: L("Your information is secure", "Su información está segura", "Enfòmasyon ou an sekirite") }),
  HEALTH_DATA_SECURITY: () => ({ icon: "lock", message: L("Your health information is secure", "Su información médica está segura", "Enfòmasyon sante ou an sekirite") }),
  BP_HEALTH_DATA_SECURITY: () => ({ icon: "lock", message: L("Your health information is protected", "Su información de salud está protegida", "Enfòmasyon sante ou pwoteje") }),
  MEDICARE_INFORMATION: () => ({ icon: "shield", message: L("Your Medicare information is securely protected", "Su información de Medicare está protegida de forma segura", "Enfòmasyon Medicare ou pwoteje an sekirite") }),
  MEDICARE_PROTECTION: () => ({ icon: "shield", message: L("This check won’t affect your Medicare benefits", "Esta verificación no afectará sus beneficios de Medicare", "Verifikasyon sa a p ap afekte avantaj Medicare ou yo") }),
  NOT_ELIGIBLE_REASSURANCE: () => ({ icon: "shield", message: L("This does not change your Medicare benefits", "Esto no cambia sus beneficios de Medicare", "Sa pa chanje avantaj Medicare ou yo") }),
  VOLUNTARY: () => ({ icon: "shield", message: L("Participation is voluntary", "La participación es voluntaria", "Patisipasyon an volontè") }),
  VOLUNTARY_DECISION: () => ({ icon: "shield", message: L("You can change your mind before enrollment is completed", "Puede cambiar de opinión antes de completar la inscripción", "Ou ka chanje lide anvan enskripsyon an fini") }),
  ENROLLMENT_CHOICE: () => ({ icon: "shield", message: L("You choose whether to enroll", "Usted decide si desea inscribirse", "Se ou menm ki chwazi si w ap enskri") }),
  PHYSICIAN_CONTINUITY: () => ({ icon: "people", message: L("Your doctor remains part of your care", "Su médico sigue siendo parte de su cuidado", "Doktè ou rete yon pati nan swen ou") }),
  ENROLLMENT_SECURITY: () => ({ icon: "lock", message: L("Your enrollment is being completed securely", "Su inscripción se está completando de forma segura", "Enskripsyon ou ap fèt an sekirite") }),
  NO_COMMITMENT_YET: () => ({ icon: "shield", message: L("You’ll review all the details before completing your enrollment", "Revisará todos los detalles antes de completar su inscripción", "W ap revize tout detay yo anvan ou konplete enskripsyon ou") }),
  ROLE_GUIDANCE: () => ({ icon: "shield", message: L("We’ll guide you through the right steps", "Le guiaremos por los pasos adecuados", "N ap gide w nan etap ki bon pou ou yo") }),
  CARE_COORDINATION: () => ({ icon: "check", message: L("Your care team is ready to support you", "Su equipo de cuidado está listo para apoyarle", "Ekip swen ou pare pou sipòte ou") }),
  SUPPORT: () => ({ icon: "question", message: L("Help is available whenever you need it", "Hay ayuda disponible cuando la necesite", "Èd disponib nenpòt lè ou bezwen li") }),
  DEVICE_SUPPORT: () => ({ icon: "device", message: L("Your care team can help with setup", "Su equipo de cuidado puede ayudarle con la configuración", "Ekip swen ou ka ede w ak konfigirasyon an") })
};
const ASSURANCE_BY_SCREEN = {
  INVITATION: "PHYSICIAN_CONTINUITY",
  DECISION_MAKER: "ROLE_GUIDANCE",
  PERSONAL_REPRESENTATIVE_DETAILS: "ROLE_GUIDANCE",
  REPRESENTATIVE_MOBILE_VERIFICATION: "SECURITY",
  REPRESENTATIVE_AUTHORITY_ATTESTATION: "ROLE_GUIDANCE",
  REPRESENTATIVE_AUTHORITY_ESCALATION: "SUPPORT",
  IDENTITY_VERIFICATION: "SECURITY",
  CARE_RECOMMENDATION: "NO_COMMITMENT_YET",
  HOW_CARE_WORKS: "PHYSICIAN_CONTINUITY",
  DISCLOSURE: "ENROLLMENT_CHOICE",
  CONSENT_REVIEW: "VOLUNTARY_DECISION",
  ENROLLMENT_PROCESSING: "ENROLLMENT_SECURITY",
  ACCESS_ALIGNMENT_PROCESSING: "ENROLLMENT_SECURITY",
  ENROLLMENT_CONFIRMED: "CARE_COORDINATION",
  ACCESS_PRE_ELIGIBILITY_NOTICE: "MEDICARE_PROTECTION",
  ACCESS_MEDICARE_IDENTIFIER: "MEDICARE_INFORMATION",
  ACCESS_ELIGIBILITY_PROCESSING: "MEDICARE_PROTECTION",
  ACCESS_ELIGIBILITY_RESULT: "MEDICARE_PROTECTION",
  ONBOARDING: "HEALTH_DATA_SECURITY",
  CLINICAL_VERIFICATION: "HEALTH_DATA_SECURITY",
  MEDICATIONS_REVIEW: "HEALTH_DATA_SECURITY",
  CARE_PREFERENCES: "HEALTH_DATA_SECURITY",
  GOALS: "HEALTH_DATA_SECURITY",
  MY_GOALS: "HEALTH_DATA_SECURITY",
  ACCESS_BP_DEVICE_VERIFICATION: "DEVICE_SUPPORT",
  ACCESS_BP_DEVICE_RESULT: "DEVICE_SUPPORT",
  ACCESS_BP_DEVICE_INFO: "BP_HEALTH_DATA_SECURITY",
  ACCESS_BP_SHIPPING_ADDRESS: "BP_HEALTH_DATA_SECURITY",
  ACCESS_BP_FULFILLMENT_CONFIRMED: "DEVICE_SUPPORT",
  ACCESS_BP_GUIDED_SETUP: "DEVICE_SUPPORT",
  ACCESS_BP_MEASUREMENT: "BP_HEALTH_DATA_SECURITY",
  ACCESS_BP_BASELINE_RESULT: "HEALTH_DATA_SECURITY",
  ACCESS_BP_ESCALATION: "SUPPORT",
  RPM_DEVICE_PATH: "DEVICE_SUPPORT",
  RPM_ADDRESS_CONFIRMATION: "DEVICE_SUPPORT",
  RPM_DEVICE_SETUP: "DEVICE_SUPPORT",
  RPM_FIRST_READING: "HEALTH_DATA_SECURITY",
  RPM_MONITORING_READY: "CARE_COORDINATION",
  ONBOARDING_COMPLETE: "CARE_COORDINATION",
  CALLBACK_CONFIRMED: "SUPPORT",
  OUTCOME_STOPPED: "MEDICARE_PROTECTION"
};

// Where Back goes from the screens a patient reaches after they have enrolled. None of these sit on
// the enrollment journey, so there is no previous screen to walk to and each one has to say where
// it belongs. Without this, Back from the medication list dropped the patient on the public
// invitation to a programme they had already joined.
const POST_ENROLLMENT_PARENT = {
  MY_MEDICATIONS: "MY_CARE",
  MY_APPOINTMENTS: "MY_CARE",
  APPOINTMENT_DETAIL: "MY_APPOINTMENTS",
  APPOINTMENT_SCHEDULING: "MY_APPOINTMENTS"
};
const contextualAssuranceFooter = (screen, typeOverride = "") => {
  const type = typeOverride || ASSURANCE_BY_SCREEN[screen];
  const assurance = ASSURANCE_VARIANTS[type]?.();
  return assurance ? `<p class="contextual-assurance" data-assurance-type="${type}">${icon(assurance.icon)}<span>${assurance.message}</span></p>` : "";
};
// The floating pill is EMMI scrolled out of reach, not a second assistant: it says her name,
// shows what she is doing, and opens the expanded panel in place. One tap, one destination, on
// every screen — the patient never lands on an intermediate menu about EMMI instead of EMMI.
// The nudge is its own markup rather than a slice of the pill's, because slicing the assistant's
// HTML on a literal tag put a second floating EMMI on screen the moment an attribute order changed.

const emmiAssistant = () => {
  const guideState = emmiGuideState();
  return `<button type="button" class="emmi-assistant" data-guide-state="${guideState}" data-action="help" data-emmi-source="floating" aria-haspopup="dialog" aria-label="${L("Open EMMI", "Abrir EMMI", "Louvri EMMI")}" title="${L("Drag Emmi to move it", "Arrastre a Emmi para moverla", "Trennen Emmi pou deplase li")}"><span class="emmi-avatar"><img src="/assets/emmi-assistant.png" alt=""></span></button>`;
};

function header() {
  if (state.screen === "OFFER_LOADING") return "";
  if (state.screen === "INVITATION") return "";
  const progress = progressFor(state);
  const stageLabel = progressStageLabel(progress.stage);
  const progressLabel = L("Journey progress", "Progreso del proceso", "Pwogrè nan pwosesis la");
  return `<header class="app-header">
    <div class="brand-row"><button type="button" class="icon-button back-button" data-action="back" aria-label="${t().back}" ${["INVITATION", "MY_CARE"].includes(state.screen) ? "hidden" : ""}>${icon("arrowLeft")}</button><a class="brand" href="#" data-action="restart" aria-label="${L("ITERA HEALTH home", "Inicio de ITERA HEALTH", "Akèy ITERA HEALTH")}"><b>ITERA.</b>HEALTH</a><button type="button" class="language" data-action="language" aria-label="${languageActionLabel()}">${icon("language")} ${languageCode()}</button></div>
    <div class="progress-meta"><span title="${stageLabel}">${stageLabel}</span></div>
    <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress.percent)}" aria-valuetext="${stageLabel}" aria-label="${progressLabel}"><span style="width:${Math.min(100, progress.percent)}%"></span></div>
  </header>`;
}

function resolveTrustHero(offer) {
  const source = offer.enrollmentSource;
  const access = offer.pathway === "ACCESS";
  const physicianName = offer.physician?.displayName || offer.referringProvider?.name || "";
  if (access && source === "ITERA Direct Outreach") return { variant: "ACCESS_PARTICIPANT", src: "/images/enrollment/card-access-participant-hero.png", alt: L("ITERA HEALTH connected Medicare ACCESS care", "Cuidado ACCESS de Medicare conectado con ITERA HEALTH", "Swen ACCESS Medicare ki konekte ak ITERA HEALTH") };
  if (access && isProviderReferralSource(source)) return { variant: "DOCTOR_RECOMMENDS_ACCESS", src: "/images/enrollment/card-doctor-recommends-hero.png", alt: "", headlineLines: [L("Your doctor", "Su médico", "Doktè ou"), L("recommends", "recomienda", "rekòmande"), L("ACCESS care", "cuidado ACCESS", "swen ACCESS")], supportingLines: [L("Care through Medicare’s", "Cuidado mediante el modelo", "Swen atravè Modèl ACCESS"), L("ACCESS Model", "ACCESS de Medicare", "Medicare")], overlayLabel: L("Recommended by", "Recomendado por", "Rekòmande pa"), physicianName, physicianPhotoUrl: offer.referringProvider?.verifiedPhotoUrl };
  if (!access) return { variant: "PHYSICIAN_SUPERVISING", src: "/images/enrollment/card-physician-supervising-hero.png", alt: "", headlineLines: [L("Your care,", "Su cuidado,", "Swen ou,"), L("connected with", "conectado con", "konekte ak"), L("your doctor", "su médico", "doktè ou")], supportingLines: [L("Ongoing support from", "Apoyo continuo de", "Sipò kontinyèl nan"), L("ITERA HEALTH between", "ITERA HEALTH entre", "ITERA HEALTH ant"), L("doctor visits.", "visitas al médico.", "vizit kay doktè.")], overlayLabel: L("Coordinated with", "Coordinado con", "Kowòdone avèk"), physicianName, physicianPhotoUrl: offer.referringProvider?.verifiedPhotoUrl };
  return { variant: "GENERIC_ITERA_CARE", alt: L("ITERA HEALTH connected care support", "Apoyo de cuidado conectado de ITERA HEALTH", "Sipò swen konekte ITERA HEALTH") };
}

function TrustHeroCard() {
  const hero = resolveTrustHero(state.offer);
  const overlayText = hero.overlayLabel && hero.physicianName ? `${hero.overlayLabel} ${hero.physicianName}` : "";
  // The composed headline sits beside the artwork rather than inside it: it is a grid sibling of
  // the media, so when a patient scales text up the card grows to hold it instead of cropping the
  // attribution the whole invitation rests on.
  const textOverlay = hero.headlineLines?.length
    ? `<div class="trust-hero-text-overlay"><h2 class="trust-hero-headline" aria-label="${hero.headlineLines.join(" ")}">${hero.headlineLines.map((line, index) => `<span class="${index === 2 ? "accent" : ""}">${line}</span>`).join("")}</h2><p class="trust-hero-supporting-copy" aria-label="${hero.supportingLines.join(" ")}">${hero.supportingLines.map(line => `<span>${line}</span>`).join("")}</p>${overlayText ? `<p class="physician-attribution ${overlayText.length > 34 ? "long" : ""}"><span>${hero.overlayLabel}</span> <strong>${hero.physicianName}</strong></p>` : ""}</div>`
    : "";
  const pillOverlay = hero.headlineLines?.length || !overlayText
    ? ""
    : `<p class="trust-hero-overlay ${overlayText.length > 34 ? "long" : ""}"><span>${hero.overlayLabel}</span> <strong>${hero.physicianName}</strong></p>`;
  const customPhysicianPhoto = hero.physicianPhotoUrl && hero.physicianPhotoUrl !== DEFAULT_PROTOTYPE_CONFIG.physicianPhotoUrl;
  const media = hero.src
    ? `<img class="trust-hero-image" src="${hero.src}" alt="${hero.alt}" ${hero.alt ? "" : "aria-hidden=\"true\""}>${customPhysicianPhoto ? `<span class="trust-hero-physician-photo custom"><img src="${escapeHtml(hero.physicianPhotoUrl)}" alt=""></span><img class="trust-hero-badge-layer" src="${hero.src}" alt="" aria-hidden="true">` : ""}${pillOverlay}`
    : `<div class="generic-trust-hero">${icon("shield")}<strong>${L("Connected care with ITERA HEALTH", "Cuidado conectado con ITERA HEALTH", "Swen konekte avèk ITERA HEALTH")}</strong><small>${L("Support designed around your health needs", "Apoyo diseñado según sus necesidades de salud", "Sipò ki fèt selon bezwen sante ou")}</small></div>`;
  return `<section class="invitation-stage trust-hero-card" data-trust-source="${state.offer.enrollmentSource}" data-hero-variant="${hero.variant}">
    <div class="stage-brand-row"><button class="language stage-language" data-action="language" aria-label="${languageActionLabel()}">${icon("language")} ${languageCode()}</button></div>
    <div class="trust-hero-media">${media}</div>${textOverlay}
  </section>`;
}

function invitation() {
  const source = state.offer.enrollmentSource || "Physician Referral";
  const physicianReferral = isProviderReferralSource(source);
  const accessPhysicianReferral = state.offer.pathway === "ACCESS" && physicianReferral;
  const accessDirectOutreach = state.offer.pathway === "ACCESS" && source === "ITERA Direct Outreach";
  const practiceOutreach = source === "Practice Outreach";
  const physicianName = state.offer.physician?.displayName || state.offer.referringProvider?.name || L("your physician", "su médico", "doktè ou");
  const intro = accessPhysicianReferral ? L("Stay connected with your care team, keep track of your health, and get support when you need it.", "Manténgase conectado con su equipo de cuidado, lleve el control de su salud y reciba apoyo cuando lo necesite.", "Rete konekte ak ekip swen ou, swiv sante ou, epi jwenn sipò lè ou bezwen l.") : accessDirectOutreach ? L("ITERA HEALTH is a Medicare ACCESS Participant providing extra support between your doctor visits.", "ITERA HEALTH es un participante de Medicare ACCESS que brinda apoyo adicional entre sus visitas al médico.", "ITERA HEALTH se yon patisipan Medicare ACCESS ki bay sipò anplis ant vizit kay doktè ou.") : physicianReferral ? L(`${physicianName}’s care team invited you to learn about additional support available through Medicare.`, `El equipo de ${physicianName} le invita a conocer apoyo adicional disponible a través de Medicare.`, `Ekip swen ${physicianName} envite w aprann sou sipò anplis ki disponib atravè Medicare.`) : practiceOutreach ? L("Fresner Medical Group and ITERA HEALTH invite you to learn about additional support available through Medicare.", "Fresner Medical Group e ITERA HEALTH le invitan a conocer apoyo adicional disponible a través de Medicare.", "Fresner Medical Group ak ITERA HEALTH envite w aprann sou sipò anplis ki disponib atravè Medicare.") : L("ITERA HEALTH invites you to learn about additional support available through Medicare.", "ITERA HEALTH le invita a conocer apoyo adicional disponible a través de Medicare.", "ITERA HEALTH envite w aprann sou sipò anplis ki disponib atravè Medicare.");
  return `${TrustHeroCard()}
    <div class="invitation-copy">${titleBlock(L("A smarter way to manage your health", "Una forma más inteligente de cuidar su salud", "Yon fason pi entelijan pou jere sante ou"), intro)}</div>
    ${emmiWelcome(physicianReferral, physicianName)}
    <section class="invitation-benefits" aria-label="${L("What this means for you", "Qué significa esto para usted", "Sa sa vle di pou ou")}">${[
      ["people", L("Stay connected with your care team", "Manténgase conectado con su equipo de cuidado", "Rete konekte ak ekip swen ou"), L("Stay connected with the doctors and care team you already know.", "Siga conectado con los médicos y el equipo de cuidado que ya conoce.", "Rete konekte ak doktè ak ekip swen ou deja konnen yo.")],
      ["home", L("Get support from home", "Reciba apoyo desde casa", "Jwenn sipò lakay ou"), L("Track your health and get ongoing support between office visits.", "Lleve el control de su salud y reciba apoyo continuo entre sus consultas.", "Swiv sante ou epi jwenn sipò kontinyèl ant vizit nan klinik.")],
      ["chart", L("Understand your health better", "Entienda mejor su salud", "Konprann sante ou pi byen"), L("Use your health information and connected tools to see how you’re doing.", "Use su información de salud y sus herramientas conectadas para ver cómo va.", "Sèvi ak enfòmasyon sante ou ak zouti konekte yo pou wè kijan w ap fè.")]
    ].map(([i,label,detail]) => `<div class="invitation-benefit">${icon(i)}<span><strong>${label}</strong><small>${detail}</small></span></div>`).join("")}</section>
    <p class="invitation-voluntary">${icon("shield", "voluntary-mark")}<span>${L("Participation is voluntary. You’ll review all the details before you decide.", "La participación es voluntaria. Revisará todos los detalles antes de decidir.", "Patisipasyon an volontè. W ap revize tout detay yo anvan ou deside.")}</span></p>
    ${actions(L("Start your care journey", "Comience su recorrido de cuidado", "Kòmanse pwosesis swen ou"), false)}
    <p class="contact-line"><span class="contact-label">${icon("phone", "contact-phone")}<span>${L("Need help? Call", "¿Necesita ayuda? Llame al", "Bezwen èd? Rele")}</span></span> <a href="tel:+13053948070">${state.offer.participantProvider.supportPhone}</a></p>`;
}

function persistEmmiPreferences() {
  try { localStorage.setItem(EMMI_PREFERENCES_KEY, JSON.stringify({ emmiVoiceGuidance: state.emmiVoiceGuidance, emmiWelcomeAcknowledged: state.emmiWelcomeAcknowledged })); }
  catch { /* Guidance preferences are best-effort and never block enrollment. */ }
  if (state.identityVerified) draftStore.save(state);
}

const emmiGuidanceIsBusy = () => ["CONNECTING", "INTERRUPTING", "USER_SPEAKING", "EMMI_THINKING", "EMMI_SPEAKING", "TOOL_RUNNING"].includes(state.assistantVoiceState);

function emmiHomeVoiceStatus() {
  return emmiVisibleStateLabel(emmiGuideState(), languageCode());
}

// The introduction card is the only EMMI on Home, so it carries both ways in: the voice EMMI is
// introducing, and the conversation itself. Kreyòl has no voice yet and would otherwise be left
// with an explanation and no way to reach EMMI at all.
const emmiWelcomeAskButton = () => `<button type="button" class="button secondary emmi-welcome-ask" data-action="help" data-emmi-source="home-intro" aria-haspopup="dialog">${icon("chat")} ${emmiLabels().ask}</button>`;

function emmiWelcomeVoiceControls() {
  if (!emmiVoiceIsSupported(languageCode())) return `<div class="emmi-welcome-choice emmi-voice-text-only" data-voice-state="UNSUPPORTED"><p role="status"><strong>${L("EMMI text is available", "El chat de EMMI está disponible", "EMMI disponib pa mesaj")}</strong><small class="emmi-welcome-error">${assistantVoiceErrorCopyFor("VOICE_UNAVAILABLE_FOR_LOCALE")}</small></p><div class="emmi-welcome-actions">${emmiWelcomeAskButton()}</div></div>`;
  if (!state.emmiVoiceGuidance) return `<div class="emmi-welcome-actions"><button type="button" class="button secondary emmi-welcome-voice" data-action="enable-emmi-guidance">${icon("mic")} ${emmiLabels().guideMe}</button>${emmiWelcomeAskButton()}</div>`;
  const busy = emmiGuidanceIsBusy();
  const unavailable = state.assistantVoiceState === "ERROR" || (state.assistantVoiceState === "DISCONNECTED" && state.assistantVoiceError);
  return `<div class="emmi-welcome-choice" data-voice-state="${state.assistantVoiceState}"><p role="status" aria-live="polite"><strong>${emmiHomeVoiceStatus()}</strong>${unavailable ? `<small class="emmi-welcome-error">${assistantVoiceErrorCopy()}</small>` : ""}</p><div class="emmi-welcome-active-actions"><button type="button" data-action="help" data-emmi-source="home-intro" aria-haspopup="dialog">${icon("chat")} ${emmiLabels().ask}</button><button type="button" data-action="repeat-emmi-guidance" ${busy ? "disabled aria-disabled=\"true\"" : ""}>${icon("rotate")} ${emmiLabels().repeat}</button><button type="button" data-action="disable-emmi-guidance">${emmiLabels().turnOff}</button></div></div>`;
}

function emmiWelcome(providerReferral, physicianName) {
  const welcomeTitle = state.emmiWelcomeAcknowledged
    ? L("I’m here to guide you.", "Estoy aquí para guiarle.", "Mwen la pou gide w.")
    : L("Hi, I’m EMMI.", "Hola, soy EMMI.", "Bonjou, mwen se EMMI.");
  return `<section class="emmi-welcome" aria-labelledby="emmi-welcome-title">
    <div class="emmi-welcome-identity"><img src="/assets/emmi-assistant.png" alt=""><div><h2 id="emmi-welcome-title">${welcomeTitle}</h2><strong>${L("Your ITERA Care Assistant", "Su Asistente de cuidado de ITERA", "Asistan swen ITERA ou")}</strong></div></div>
    <div class="emmi-welcome-copy"><p>${L("I can help you understand your health information, guide you through each step, and connect you with your care team when you need help.", "Puedo ayudarle a entender su información de salud, guiarle en cada paso y comunicarle con su equipo de cuidado cuando necesite ayuda.", "Mwen ka ede w konprann enfòmasyon sante ou, gide w nan chak etap, epi konekte w ak ekip swen ou lè ou bezwen èd.")}</p></div>
    ${emmiWelcomeVoiceControls()}
  </section>`;
}

function decisionMaker() {
  return `${titleBlock(L("Who is completing this?", "¿Quién está completando esto?", "Ki moun ki ap ranpli sa a?"), L("Choose what best describes you. You can get help at any time.", "Elija lo que mejor le describa. Puede recibir ayuda en cualquier momento.", "Chwazi sa ki pi byen dekri ou. Ou ka jwenn èd nenpòt lè."))}
    <form id="choice-form" class="choice-list">
      ${choice("patient", "person", L("For myself", "Para mí", "Pou tèt mwen"), L("I am the patient.", "Soy el paciente.", "Mwen se pasyan an."), state.completionRole === "patient")}
      ${choice("helper", "people", L("Helping the patient", "Ayudando al paciente", "Ede pasyan an"), L("The patient is present and will make the decisions.", "El paciente está presente y tomará las decisiones.", "Pasyan an prezan epi l ap pran desizyon yo."), state.completionRole === "helper")}
      ${choice("personalRepresentative", "shield", L("Personal representative", "Representante personal", "Reprezantan pèsonèl"), L("I’m authorized to make healthcare decisions for the patient.", "Estoy autorizado para tomar decisiones de atención médica por el paciente.", "Mwen otorize pou pran desizyon swen sante pou pasyan an."), isPersonalRepresentative())}
    </form>${optionalSupportPrompt()}${actions(t().continue)}`;
}

// Care Circle is optional support, never a fourth answer to "Who is completing this?".
// It only makes sense when the patient is completing the enrollment themselves: a helper or a
// personal representative is already a second person in the room.
const completionRoleAcceptsCareCircle = () => state.completionRole === "patient" && state.role !== "representative";

// An invitation the patient asked for before we knew who they were. It is held rather than sent,
// and goes out the moment identity is confirmed — so nothing is sent in the name of an unverified
// person, and the patient does not have to type their friend's details a second time.
function sendPendingCareCircleInvite() {
  if (!state.careCircleInvitePending || !state.identityVerified) return;
  state.careCircleInvitePending = false;
  const supportPersonPhone = phoneDigits(state.supportPersonPhone);
  try {
    const invite = growthStore.createSupportInvite({ inviterPatientId: state.offer.patient.id, patientFirstName: patientFirstName(), supportPersonName: state.supportPersonName, phone: supportPersonPhone, relationship: state.supportPersonRelationship, relationshipOther: state.supportPersonRelationshipOther, context: state.careCircleContext, sessionId: state.sessionId, origin: location.origin });
    Object.assign(state, { supportRole: "CARE_CIRCLE_MEMBER", careCircleStatus: "INVITED", supportInviteId: invite.inviteId, supportInviteToken: invite.token, supportInviteStatus: invite.status, supportInviteSentAt: invite.sentAt, careCircleNotice: "", error: "", careCircleJustSent: true });
    audit(state, "invite_sent", "success", { inviteId: invite.inviteId, context: state.careCircleContext, source: state.careCircleContactSource, deferredUntilIdentity: true });
    draftStore.save(state);
  } catch {
    // The patient has just verified who they are; losing their invitation silently here would be
    // the worst moment for it. It stays pending so the Care Circle screen can offer it again.
    state.careCircleInvitePending = true;
    audit(state, "invite_failed", "storage_or_delivery", { context: state.careCircleContext, deferredUntilIdentity: true });
  }
}

function optionalSupportPrompt() {
  const hidden = completionRoleAcceptsCareCircle() ? "" : "hidden";
  const label = `<span class="optional-support-label">${L("Optional support", "Apoyo opcional", "Sipò opsyonèl")}</span>`;
  // An invitation that was already sent is never re-sent or silently discarded.
  if (["INVITED", "ACTIVE"].includes(state.careCircleStatus)) {
    const name = state.supportPersonName || L("someone you trust", "alguien de confianza", "yon moun ou fè konfyans");
    return `<section class="optional-support" data-optional-support ${hidden}>${label}<div class="optional-support-card optional-support-status">${icon("check")}<span><strong>${L("Invitation sent", "Invitación enviada", "Envitasyon voye")}</strong><span class="optional-support-copy">${L(`${name} can help you through this process. You still make the decisions about your care.`, `${name} puede ayudarle en este proceso. Usted sigue tomando las decisiones sobre su cuidado.`, `${name} ka ede w nan pwosesis sa a. Se ou menm k ap toujou pran desizyon sou swen ou.`)}</span></span></div></section>`;
  }
  if (!careCirclePromptAllowed()) return "";
  return `<section class="optional-support" data-optional-support ${hidden}>${label}<button type="button" class="optional-support-card" data-action="open-care-circle" data-growth-context="early">${icon("userPlus")}<span><strong>${L("Want support along the way?", "¿Quiere apoyo durante el proceso?", "Ou vle sipò pandan wout la?")}</strong><span class="optional-support-copy">${L("Invite someone you trust to support you during your care journey.", "Invite a alguien de confianza para que le apoye durante su recorrido de cuidado.", "Envite yon moun ou fè konfyans pou sipòte w pandan pwosesis swen ou.")}</span><span class="optional-support-action">${L("Invite someone", "Invitar a alguien", "Envite yon moun")} ${icon("arrowRight")}</span></span></button></section>`;
}

const patientFirstName = () => String(state.offer?.patient?.displayName || L("The patient", "El paciente", "Pasyan an")).split(/\s+/)[0].replace(/[^\p{L}'’-]/gu, "") || L("The patient", "El paciente", "Pasyan an");
const careCirclePromptAllowed = () => !isPersonalRepresentative() && state.careCircleStatus === "NONE" && growthPromptAvailable(state.careCirclePromptDismissedAt);

function careCircleEarlyPrompt(compact = false) {
  if (!careCirclePromptAllowed()) return "";
  return `<button type="button" class="growth-card care-circle-early ${compact ? "compact" : ""}" data-action="open-care-circle" data-growth-context="early">${icon("userPlus")}<span><strong>${L("Want support along the way?", "¿Quiere apoyo durante el proceso?", "Ou vle sipò pandan wout la?")}</strong><span class="care-circle-support-copy">${L("Invite someone you trust to support you during your care journey.", "Invite a alguien de confianza para que le apoye durante su recorrido de cuidado.", "Envite yon moun ou fè konfyans pou sipòte w pandan pwosesis swen ou.")}</span><span class="care-circle-support-action">${L("Invite someone", "Invitar a alguien", "Envite yon moun")} ${icon("arrowRight")}</span></span></button>`;
}

const careCirclePhoneTypeLabel = type => ({
  mobile: L("Mobile", "Celular", "Mobil"), cell: L("Mobile", "Celular", "Mobil"),
  home: L("Home", "Casa", "Lakay"), work: L("Work", "Trabajo", "Travay"), other: L("Other", "Otro", "Lòt")
})[String(type || "").toLowerCase()] || (type ? String(type).charAt(0).toUpperCase() + String(type).slice(1) : L("Mobile", "Celular", "Mobil"));

const applyCareCircleContact = (contact, source) => {
  const rawNumbers = (contact?.tel || []).map(item => {
    const original = typeof item === "string" ? item : item.value || "";
    const digits = String(original).replace(/\D/g, "");
    const value = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : original;
    return { value, label: careCirclePhoneTypeLabel(typeof item === "string" ? "mobile" : item.type?.[0] || item.type) };
  }).filter(item => phoneDigits(item.value).length === 10);
  const contactName = Array.isArray(contact?.name) ? contact.name[0] : contact?.name;
  state.supportPersonName = String(contactName || "").trim();
  state.careCircleContactNumbers = rawNumbers;
  state.careCircleContactSource = source;
  state.supportPersonPhone = rawNumbers.length === 1 ? formatPhone(rawNumbers[0].value) : "";
  state.careCircleNotice = rawNumbers.length
    ? ""
    : L("This contact has no mobile number. Please enter one below.", "Este contacto no tiene un número celular. Ingrese uno abajo.", "Kontak sa a pa gen nimewo mobil. Tanpri antre youn anba a.");
  return rawNumbers;
};

function careCircleInvite() {
  const relationships = [["spouse", L("Spouse", "Cónyuge", "Konjwen")], ["child", L("Child", "Hijo o hija", "Pitit")], ["family", L("Family member", "Familiar", "Manm fanmi")], ["caregiver", L("Caregiver", "Cuidador", "Moun k ap bay swen")], ["friend", L("Friend", "Amigo o amiga", "Zanmi")], ["other", L("Other", "Otro", "Lòt")]];
  const ongoing = state.careCircleContext === "ONGOING_CARE";
  const title = ongoing ? L("Invite someone you trust to support your care", "Invite a alguien de confianza para apoyar su cuidado", "Envite yon moun ou fè konfyans pou sipòte swen ou") : L("Invite someone you trust", "Invite a alguien de confianza", "Envite yon moun ou fè konfyans");
  const supporting = ongoing
    ? (state.offer?.pathway === "RPM" || String(state.offer?.pathway || "").includes("RPM") ? L("They can help with reminders and monitor setup. You stay in control of your care.", "Puede ayudar con recordatorios y la configuración del monitor. Usted mantiene el control de su cuidado.", "Moun nan ka ede ak rapèl ak konfigirasyon monitè a. Se ou ki kontwole swen ou.") : L("They can help with reminders and everyday care tasks. You stay in control of your care.", "Puede ayudar con recordatorios y tareas cotidianas de cuidado. Usted mantiene el control de su cuidado.", "Moun nan ka ede ak rapèl ak travay swen chak jou. Se ou ki kontwole swen ou."))
    : L("They can help you through enrollment, but you’ll still make the decisions about your care.", "Puede ayudarle durante la inscripción, pero usted seguirá tomando las decisiones sobre su cuidado.", "Moun nan ka ede w pandan enskripsyon an, men se ou menm k ap toujou pran desizyon sou swen ou.");
  // These two fields hold another person's details. They used to declare autocomplete="name" and
  // "tel", which mean the details of whoever is filling the form in — so the browser offered the
  // patient their own name and number on a form for inviting somebody else, and accepting that
  // offer invites yourself. The contact picker below is the deliberate way in where it exists.
  const pickerSupported = Boolean(globalThis.navigator?.contacts?.select);
  const ready = state.supportPersonName.trim() && phoneDigits(state.supportPersonPhone).length === 10 && state.supportPersonRelationship && (state.supportPersonRelationship !== "other" || state.supportPersonRelationshipOther.trim());
  const numberChoices = state.careCircleContactNumbers?.length > 1 ? `<fieldset class="contact-number-choices"><legend>${L("Which mobile number should we use?", "¿Qué número celular debemos usar?", "Ki nimewo mobil nou dwe itilize?")}</legend>${state.careCircleContactNumbers.map((item, index) => `<label><input type="radio" name="careCircleContactPhone" value="${escapeHtml(item.value)}" ${phoneDigits(state.supportPersonPhone) === phoneDigits(item.value) ? "checked" : ""}><span><strong>${escapeHtml(item.label || L("Mobile", "Celular", "Mobil"))}</strong><small>${formatPhone(item.value)}</small></span></label>`).join("")}</fieldset>` : "";
  return `${titleBlock(title, supporting, L("Care Circle", "Círculo de cuidado", "Sèk swen"))}
    <button type="button" class="contact-picker-button" data-action="choose-care-circle-contact">${icon("people")}<span><strong>${L("Add from contacts", "Agregar desde contactos", "Ajoute nan kontak yo")}</strong><small>${pickerSupported ? L("You choose which contact to share.", "Usted elige qué contacto compartir.", "Se ou ki chwazi ki kontak pou pataje.") : L("Choose a contact card exported from your address book.", "Elija una tarjeta de contacto exportada de su libreta.", "Chwazi yon kat kontak ou ekspòte nan lis kontak ou.")}</small></span></button>
    ${pickerSupported ? "" : `<input id="care-circle-contact-file" class="sr-only" type="file" accept=".vcf,text/vcard,text/x-vcard" aria-label="${L("Choose contact card", "Elegir tarjeta de contacto", "Chwazi kat kontak")}">`}
    <div class="growth-divider"><span>${L("or enter manually", "o ingrese manualmente", "oswa antre manyèlman")}</span></div>
    ${numberChoices}<form id="care-circle-invite-form" class="growth-form" novalidate><label class="field">${L("Their name", "Su nombre", "Non moun nan")}<input name="supportPersonName" autocomplete="off" value="${escapeHtml(state.supportPersonName)}" required></label><label class="field">${L("Mobile number", "Número de celular", "Nimewo telefòn mobil")}<input name="supportPersonPhone" type="tel" inputmode="tel" autocomplete="off" maxlength="14" value="${escapeHtml(state.supportPersonPhone)}" placeholder="(305) 555-0199" required></label><label class="field">${L("Relationship to you", "Relación con usted", "Relasyon li avèk ou")}<select name="supportPersonRelationship" required><option value="">${L("Select relationship", "Seleccione la relación", "Chwazi relasyon an")}</option>${relationships.map(([value, label]) => `<option value="${value}" ${state.supportPersonRelationship === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>${state.supportPersonRelationship === "other" ? `<label class="field">${L("Relationship", "Relación", "Relasyon")}<input name="supportPersonRelationshipOther" value="${escapeHtml(state.supportPersonRelationshipOther)}" required></label>` : ""}</form>
    <aside class="growth-boundary-note">${icon("shield")}<p><strong>${L("You remain in control", "Usted mantiene el control", "Se ou ki gen kontwòl")}</strong><span>${L("Care Circle support does not allow this person to consent, sign, or make healthcare decisions for you. It does not make them a Personal Representative.", "El apoyo del Círculo de cuidado no permite que esta persona dé consentimiento, firme ni tome decisiones médicas por usted. No la convierte en Representante personal.", "Sipò Sèk swen pa pèmèt moun sa a bay konsantman, siyen, oswa pran desizyon swen sante pou ou. Sa pa fè moun nan yon Reprezantan pèsonèl.")}</span></p></aside><p class="growth-notice" role="status" aria-live="polite">${state.careCircleNotice || ""}</p><p class="form-error" role="alert">${state.error || ""}</p><div class="actions care-circle-sticky-actions">${cta(L("Back", "Atrás", "Retounen"), "growth-return", true)}${cta(L("Send invitation", "Enviar invitación", "Voye envitasyon"), "send-care-circle-invite", false, !ready)}</div>`;
}

function careCircleInviteSent() {
  const link = growthStore.findSupportInvite(state.supportInviteToken)?.temporarySupportLink || "";
  return `${art("check", true)}${titleBlock(L("Invitation sent", "Invitación enviada", "Envitasyon voye"), L(`We sent an invitation to ${state.supportPersonName} at ${maskPhone(state.supportPersonPhone)}.`, `Enviamos una invitación a ${state.supportPersonName} al ${maskPhone(state.supportPersonPhone)}.`, `Nou voye yon envitasyon bay ${state.supportPersonName} nan ${maskPhone(state.supportPersonPhone)}.`), L("Care Circle", "Círculo de cuidado", "Sèk swen"))}<section class="growth-confirmation-card">${icon("clock")}<div><strong>${L("Invitation pending", "Invitación pendiente", "Envitasyon an annatant")}</strong><p>${L("They’ll appear in your Care Circle after accepting the secure invitation.", "Aparecerá en su Círculo de cuidado después de aceptar la invitación segura.", "Moun nan ap parèt nan Sèk swen ou apre li aksepte envitasyon an sekirite.")}</p><small>${L("No diagnosis, Medicare number, or clinical information was included.", "No se incluyó ningún diagnóstico, número de Medicare ni información clínica.", "Pa gen dyagnostik, nimewo Medicare, oswa enfòmasyon klinik ki te ladan l.")}</small></div></section><details class="full-terms growth-message-preview"><summary>${L("View message preview", "Ver vista previa del mensaje", "Gade mesaj la")}</summary><p>${L("ITERA HEALTH: You’ve been invited to help someone you know with their care experience. Use this secure invitation:", "ITERA HEALTH: Le han invitado a ayudar a alguien que conoce con su experiencia de cuidado. Use esta invitación segura:", "ITERA HEALTH: Yo envite w ede yon moun ou konnen ak eksperyans swen li. Sèvi ak envitasyon sekirize sa a:")}<br><span class="growth-safe-link">${escapeHtml(link)}</span></p></details>${link ? `<a class="button secondary growth-preview-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">${L("Preview support invitation", "Vista previa de la invitación", "Gade envitasyon sipò a")} ${icon("externalLink")}</a>` : ""}<div class="actions single">${cta(L("Done", "Listo", "Fini"), "growth-return")}</div>`;
}

function careCirclePermissions() {
  const name = state.supportPersonName || L("your support person", "su persona de apoyo", "moun k ap ede w la");
  const options = [["receiveReminders", L("Receive reminders", "Recibir recordatorios", "Resevwa rapèl")], ["helpWithDeviceSetup", L("Help with device setup", "Ayudar con dispositivos", "Ede mete aparèy anplas")], ["helpWithAppointments", L("Help with appointments", "Ayudar con citas", "Ede ak randevou")], ["receiveCareTasks", L("Receive care tasks", "Recibir tareas de cuidado", "Resevwa travay swen")], ["viewLimitedCareProgress", L("View limited care progress", "Ver progreso limitado del cuidado", "Wè yon pati limite nan pwogrè swen")]];
  return `${titleBlock(L("Add to my Care Circle", "Agregar a mi Círculo de cuidado", "Ajoute nan Sèk swen mwen"), L(`${name} can help with the items you choose. This does not give full access to your health information.`, `${name} puede ayudar con lo que usted elija. Esto no da acceso completo a su información de salud.`, `${name} ka ede ak sa ou chwazi yo. Sa pa bay aksè konplè ak enfòmasyon sante ou.`), L("Your care", "Su cuidado", "Swen ou"))}<form id="care-circle-permissions-form" class="growth-permissions">${options.map(([value, label]) => check("careCirclePermission", label, Boolean(state.careCirclePermissions?.[value]), value)).join("")}</form><aside class="growth-boundary-note">${icon("shield")}<p><strong>${L("Your healthcare decisions remain yours", "Sus decisiones médicas siguen siendo suyas", "Desizyon swen sante ou rete pou ou")}</strong><span>${L("Care Circle is separate from Helping the patient and Personal Representative roles.", "El Círculo de cuidado es diferente de los roles Ayudar al paciente y Representante personal.", "Sèk swen diferan ak wòl Ede pasyan an ak Reprezantan pèsonèl.")}</span></p></aside><div class="actions">${cta(L("Not now", "Ahora no", "Pa kounye a"), "dismiss-care-circle-post", true)}${cta(L("Add to my Care Circle", "Agregar a mi Círculo", "Ajoute nan Sèk swen mwen"), "save-care-circle")}</div>`;
}

function shareAccess() {
  return `${titleBlock(L("Share information about ACCESS", "Comparta información sobre ACCESS", "Pataje enfòmasyon sou ACCESS"), L("Share a public information page. The other person will still need to check whether ACCESS is available to them.", "Comparta una página pública informativa. La otra persona deberá verificar si ACCESS está disponible para ella.", "Pataje yon paj enfòmasyon piblik. Lòt moun nan ap toujou bezwen verifye si ACCESS disponib pou li."), L("Share ACCESS", "Compartir ACCESS", "Pataje ACCESS"))}<section class="share-message-preview"><p>${L("I’m getting extra support for my health through Medicare’s ACCESS Model with ITERA HEALTH.", "Estoy recibiendo apoyo adicional para mi salud mediante el Modelo ACCESS de Medicare con ITERA HEALTH.", "Mwen resevwa plis sipò pou sante mwen atravè Modèl ACCESS Medicare avèk ITERA HEALTH.")}</p><p>${L("If you have Original Medicare and manage a chronic health condition, you can learn more here:", "Si tiene Medicare Original y maneja una condición crónica, puede obtener más información aquí:", "Si ou gen Medicare Orijinal epi w ap jere yon pwoblèm sante kwonik, ou ka aprann plis isit la:")}</p></section><div class="share-options"><button type="button" data-action="share-access" data-share-channel="SMS">${icon("phone")}<span><strong>${L("Text message", "Mensaje de texto", "Mesaj tèks")}</strong></span></button><button type="button" data-action="share-access" data-share-channel="COPY_LINK">${icon("document")}<span><strong>${L("Copy link", "Copiar enlace", "Kopye lyen")}</strong></span></button><button type="button" data-action="share-access" data-share-channel="WEB_SHARE">${icon("share")}<span><strong>${L("Share", "Compartir", "Pataje")}</strong></span></button></div><p class="growth-notice" role="status" aria-live="polite">${state.growthNotice || ""}</p><button type="button" class="button secondary" data-action="growth-return">${L("Back", "Atrás", "Retounen")}</button>`;
}

function personalRepresentativeDetails() {
  const relationships = [
    ["spouse", L("Spouse", "Cónyuge", "Konjwen")],
    ["child", L("Child", "Hijo o hija", "Pitit")],
    ["familyMember", L("Family member", "Familiar", "Manm fanmi")],
    ["caregiver", L("Caregiver", "Cuidador", "Moun k ap bay swen")],
    ["other", L("Other", "Otro", "Lòt")]
  ];
  const authorityTypes = [
    ["healthCareSurrogate", L("Health care surrogate / health care proxy", "Representante o apoderado para decisiones médicas", "Reprezantan oswa manda pou swen sante")],
    ["healthcarePowerOfAttorney", L("Health care power of attorney", "Poder legal para atención médica", "Pwokirasyon pou swen sante")],
    ["legalGuardian", L("Legal guardian", "Tutor legal", "Gadyen legal")],
    ["otherLegalAuthority", L("Other legal authority", "Otra autoridad legal", "Lòt otorite legal")]
  ];
  const ready = state.representativeFullName.trim() && state.representativeRelationship && state.representativeAuthorityType && phoneDigits(state.representativePhone).length === 10;
  return `${titleBlock(L("About you", "Acerca de usted", "Konsènan ou"), L("You’re completing this enrollment for the patient.", "Está completando esta inscripción en nombre del paciente.", "W ap ranpli enskripsyon sa a pou pasyan an."))}
    <form id="representative-form" novalidate>
      <div class="field"><label for="representative-name">${L("Your full name", "Su nombre completo", "Non konplè ou")}</label><input id="representative-name" name="representativeFullName" type="text" autocomplete="name" value="${escapeHtml(state.representativeFullName)}" required></div>
      <div class="field"><label for="representative-relationship">${L("Your relationship to the patient", "Su relación con el paciente", "Relasyon ou ak pasyan an")}</label><select id="representative-relationship" name="representativeRelationship" required><option value="">${L("Select relationship", "Seleccione la relación", "Chwazi relasyon an")}</option>${relationships.map(([value, label]) => `<option value="${value}" ${state.representativeRelationship === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>
      <div class="field"><label for="representative-authority">${L("How are you authorized to make healthcare decisions?", "¿Cómo está autorizado para tomar decisiones médicas?", "Ki jan ou otorize pou pran desizyon sou swen sante?")}</label><select id="representative-authority" name="representativeAuthorityType" required><option value="">${L("Select authority", "Seleccione la autoridad", "Chwazi otorite a")}</option>${authorityTypes.map(([value, label]) => `<option value="${value}" ${state.representativeAuthorityType === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>
      <div class="field"><label for="representative-phone">${L("Your mobile number", "Su número móvil", "Nimewo telefòn mobil ou")}</label><input id="representative-phone" name="representativePhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="14" value="${escapeHtml(formatPhone(state.representativePhone))}" placeholder="(305) 555-0123" aria-describedby="representative-phone-helper" required><small class="field-helper" id="representative-phone-helper">${L("We’ll send you a code to verify this number.", "Le enviaremos un código para verificar este número.", "N ap voye yon kòd pou verifye nimewo sa a.")}</small></div>
      <p class="form-error" role="alert">${state.error}</p>
    </form>${actions(state.busy ? L("Sending…", "Enviando…", "N ap voye…") : L("Send verification code", "Enviar código de verificación", "Voye kòd verifikasyon"), true, "", !ready || state.busy)}`;
}

function representativeMobileVerification() {
  if (state.phoneVerified) return `${titleBlock(L("Verify your phone", "Verifique su teléfono", "Verifye telefòn ou"), L("Your mobile number has been verified.", "Su número móvil ha sido verificado.", "Nimewo mobil ou verifye."))}<div class="verified-phone-status">${icon("check")}<span><strong>${L("Phone verified", "Teléfono verificado", "Telefòn verifye")}</strong><small>${maskedPhone(state.representativePhone)}</small></span></div>${actions(t().continue)}<div class="representative-otp-links"><button class="text-button" data-action="change-representative-phone">${L("Use a different number", "Usar otro número", "Itilize yon lòt nimewo")}</button></div>`;
  const resendSeconds = Math.max(0, Math.ceil((state.representativeOtpResendAvailableAt - Date.now()) / 1000));
  const resendLabel = resendSeconds
    ? L(`Resend code in ${resendSeconds}s`, `Reenviar código en ${resendSeconds} s`, `Voye kòd la ankò nan ${resendSeconds}s`)
    : L("Resend code", "Reenviar código", "Voye kòd la ankò");
  return `${titleBlock(L("Verify your phone", "Verifique su teléfono", "Verifye telefòn ou"), L(`We sent a 6-digit code to ${maskedPhone(state.representativePhone)}.`, `Enviamos un código de 6 dígitos al ${maskedPhone(state.representativePhone)}.`, `Nou voye yon kòd 6 chif nan ${maskedPhone(state.representativePhone)}.`))}
    <form id="representative-otp-form" novalidate>
      <div class="field otp-field"><label for="representative-otp">${L("Verification code", "Código de verificación", "Kòd verifikasyon")}</label><input id="representative-otp" name="representativeOtp" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="••••••" aria-describedby="representative-otp-helper" required><small class="field-helper" id="representative-otp-helper">${L("Enter the 6-digit code from the text message.", "Ingrese el código de 6 dígitos del mensaje de texto.", "Antre kòd 6 chif ki nan mesaj tèks la.")}</small></div>
      <p class="form-error" role="alert">${state.error}</p>
    </form>${actions(state.busy ? L("Verifying…", "Verificando…", "N ap verifye…") : L("Verify and continue", "Verificar y continuar", "Verifye epi kontinye"), true, "", state.busy)}
    <div class="representative-otp-links"><button class="text-button" data-action="resend-otp" ${resendSeconds ? "disabled" : ""}>${resendLabel}</button><button class="text-button" data-action="change-representative-phone">${L("Use a different number", "Usar otro número", "Itilize yon lòt nimewo")}</button></div>`;
}

function representativeAuthorityAttestation() {
  return `${titleBlock(L("Confirm your authority", "Confirme su autoridad", "Konfime otorite ou"), L("Phone verified", "Teléfono verificado", "Telefòn verifye"))}
    <div class="verified-phone-status">${icon("check")}<span><strong>${L("Phone verified", "Teléfono verificado", "Telefòn verifye")}</strong><small>${maskedPhone(state.representativePhone)}</small></span></div>
    <form id="representative-authority-form">${check("representativeAuthorityAttested", L("I confirm that I’m authorized to make healthcare decisions for the patient.", "Confirmo que estoy autorizado para tomar decisiones médicas por el paciente.", "Mwen konfime mwen otorize pou pran desizyon swen sante pou pasyan an."), state.representativeAuthorityAttested)}<p class="form-error" role="alert">${state.error}</p></form>
    ${actions(t().continue, true, "", !state.representativeAuthorityAttested)}`;
}

function representativeAuthorityEscalation() {
  return `${titleBlock(L("We need a little more information to confirm your authority.", "Necesitamos un poco más de información para confirmar su autoridad.", "Nou bezwen yon ti kras plis enfòmasyon pou konfime otorite ou."), L("Choose the option that works best for you.", "Elija la opción que le resulte más conveniente.", "Chwazi opsyon ki pi bon pou ou."))}
    <div class="link-list"><button class="link-card" data-action="authority-document">${icon("document")}<span><strong>${L("Upload authorization document", "Subir documento de autorización", "Telechaje dokiman otorizasyon")}</strong><small>${L("Share a document securely", "Comparta un documento de forma segura", "Pataje yon dokiman an sekirite")}</small></span><b>›</b></button><button class="link-card" data-action="help">${icon("people")}<span><strong>${L("Talk with our care team", "Hablar con nuestro equipo de cuidado", "Pale ak ekip swen nou an")}</strong><small>${L("Get help reviewing your authority", "Obtenga ayuda para revisar su autoridad", "Jwenn èd pou revize otorite ou")}</small></span><b>›</b></button><button class="link-card" data-action="callback">${icon("phone")}<span><strong>${L("Request a callback", "Solicitar una llamada", "Mande pou yo rele ou")}</strong><small>${L("We’ll contact you within one business day", "Le contactaremos dentro de un día hábil", "N ap kontakte ou nan yon jou ouvrab")}</small></span><b>›</b></button></div>`;
}

function identity() {
  const representative = isPersonalRepresentative();
  // A patient who arrived here by pressing "Send invitation" needs to know why the screen changed
  // and that their invitation is waiting rather than lost. Without this the form appears out of
  // nowhere and the invitation looks like it failed.
  const held = state.careCircleInvitePending && state.careCircleNotice
    ? `<aside class="growth-boundary-note identity-pending-invite">${icon("shield")}<p><span>${escapeHtml(state.careCircleNotice)}</span></p></aside>`
    : "";
  return `<h1 tabindex="-1">${representative ? L("Let’s securely confirm the patient’s identity", "Confirmemos de forma segura la identidad del paciente", "Ann konfime idantite pasyan an an sekirite") : L("Let’s securely confirm it’s you", "Confirmemos su identidad de forma segura", "Ann konfime se ou an sekirite")}</h1>
    <p class="identity-support">${representative ? L("Confirm the patient’s date of birth and ZIP code so we can match them to their care invitation.", "Confirme la fecha de nacimiento y el código postal del paciente para poder vincularlo con su invitación de cuidado.", "Konfime dat nesans ak kòd postal pasyan an pou nou ka konekte l ak envitasyon swen li.") : L("Confirm your date of birth and ZIP code so we can match you to your care invitation.", "Confirme su fecha de nacimiento y código postal para poder vincularle con su invitación de cuidado.", "Konfime dat nesans ou ak kòd postal ou pou nou ka konekte w ak envitasyon swen ou.")}</p>
    <p class="identity-helper" id="identity-helper">${representative ? L("Their information is protected and used only to securely verify their identity.", "Su información está protegida y se usa únicamente para verificar su identidad de forma segura.", "Enfòmasyon li pwoteje epi yo sèvi avè l sèlman pou verifye idantite l an sekirite.") : L("Your information is protected and used only to securely verify your identity.", "Su información está protegida y se usa únicamente para verificar su identidad de forma segura.", "Enfòmasyon ou pwoteje epi yo sèvi avè l sèlman pou verifye idantite ou an sekirite.")}</p>
    <form id="identity-form" novalidate>
      <div class="field"><label for="dob">${L("Date of birth", "Fecha de nacimiento", "Dat nesans")}</label><div class="date-control"><input id="dob" class="date-text" name="dob" type="text" inputmode="numeric" autocomplete="bday" maxlength="14" value="${displayDate(invitationIdentity().dobIso)}" placeholder="MM / DD / YYYY" aria-describedby="identity-helper identity-error"><input class="date-picker-native" type="date" min="1900-01-01" max="${localToday()}" value="${invitationIdentity().dobIso}" aria-label="${L("Choose date of birth from calendar", "Elegir fecha de nacimiento del calendario", "Chwazi dat nesans nan kalandriye a")}">${icon("calendar", "date-picker-icon")}</div><small class="field-helper">${L("Use MM / DD / YYYY.", "Use MM / DD / AAAA.", "Itilize MM / JJ / AAAA.")}</small></div>
      <div class="field"><label for="zip">${L("ZIP code", "Código postal", "Kòd postal")}</label><input id="zip" class="zip-input" name="zip" type="text" inputmode="numeric" pattern="[0-9]{5}" autocomplete="postal-code" maxlength="5" value="${invitationIdentity().zip}" placeholder="${L("5-digit ZIP code", "Código postal de 5 dígitos", "Kòd postal 5 chif")}" aria-describedby="identity-helper identity-error"><small class="field-helper">${L("Enter your home ZIP code.", "Ingrese el código postal de su domicilio.", "Antre kòd postal lakay ou.")}</small></div>
      <p class="form-error" id="identity-error" role="alert">${state.error}</p>
    </form>${held}${actions(state.busy ? L("Checking…", "Verificando…", "Tcheke") : t().continue)}`;
}

function conditionSupportDescription(offer) {
  const conditions = offer.qualifyingConditions?.length ? offer.qualifyingConditions : offer.qualifyingCondition ? [offer.qualifyingCondition] : [];
  if (conditions.length !== 1) return L("Regular support based on your health needs.", "Apoyo regular basado en sus necesidades de salud.", "Sipò regilye selon bezwen sante ou.");
  const condition = `${conditions[0].name || ""} ${conditions[0].patientFriendlyName || ""}`.toLowerCase();
  if (condition.includes("hypertension") || condition.includes("blood pressure")) return L("Regular support to help manage your blood pressure.", "Apoyo regular para ayudar a controlar su presión arterial.", "Sipò regilye pou ede jere tansyon ou.");
  if (condition.includes("diabetes")) return L("Regular support to help manage your diabetes.", "Apoyo regular para ayudar a controlar su diabetes.", "Sipò regilye pou ede jere dyabèt ou.");
  if (condition.includes("heart failure")) return L("Regular support focused on your heart health.", "Apoyo regular enfocado en la salud de su corazón.", "Sipò regilye ki konsantre sou sante kè ou.");
  if (condition.includes("kidney")) return L("Regular support focused on your kidney health.", "Apoyo regular enfocado en la salud de sus riñones.", "Sipò regilye ki konsantre sou sante ren ou.");
  return L("Regular support based on your health needs.", "Apoyo regular basado en sus necesidades de salud.", "Sipò regilye selon bezwen sante ou.");
}

function localizedCondition(condition = "") {
  const labels = {
    Hypertension: L("Hypertension", "Hipertensión", "Tansyon wo"),
    "high blood pressure": L("high blood pressure", "presión arterial alta", "tansyon wo"),
    Diabetes: L("Diabetes", "Diabetes", "Dyabèt"),
    diabetes: L("diabetes", "diabetes", "dyabèt"),
    "Heart Failure": L("Heart Failure", "Insuficiencia cardíaca", "Ensifizans kadyak"),
    "heart failure": L("heart failure", "insuficiencia cardíaca", "ensifizans kadyak"),
    "Chronic Kidney Disease": L("Chronic Kidney Disease", "Enfermedad renal crónica", "Maladi ren kwonik"),
    "chronic kidney disease": L("chronic kidney disease", "enfermedad renal crónica", "maladi ren kwonik")
  };
  return labels[condition] || condition;
}

function careTeamDescription(offer) {
  const physicianName = offer.physician?.displayName;
  if (isProviderReferralSource(offer.enrollmentSource) && physicianName) return L(`ITERA coordinates with ${physicianName}.`, `ITERA coordina con ${physicianName}.`, `ITERA kowòdone avèk ${physicianName}.`);
  if (offer.enrollmentSource === "ITERA Direct Outreach" && !physicianName) return L("ITERA helps coordinate your care with your existing doctors.", "ITERA ayuda a coordinar su cuidado con sus médicos actuales.", "ITERA ede kowòdone swen ou avèk doktè ou deja genyen yo.");
  return L("ITERA works with your care team to coordinate your care.", "ITERA trabaja con su equipo para coordinar su cuidado.", "ITERA travay avèk ekip swen ou pou kowòdone swen ou.");
}

function recommendedCareCapabilities(offer) {
  const conditionFocused = ["ACCESS", "CCM", "CCM_RPM", "PCM", "PCM_RPM"].includes(offer.pathway);
  return offer.careCapabilities.map((capability, index, capabilities) => ({
    ...capability,
    title: offerText(capability.title),
    description: index === capabilities.length - 1 ? careTeamDescription(offer) : index === 0 && conditionFocused ? conditionSupportDescription(offer) : offerText(capability.description)
  }));
}

// The condition card is where ACCESS stops describing itself and becomes something the patient will
// actually do: track something at home so their care team can see how they are doing. Only the
// blood-pressure pathway names a connected monitor, because only it comes with one.
function accessConditionCareCard(offer) {
  const primaryCondition = offer.clinicalProfile?.primaryCondition || offer.qualifyingConditions?.[0] || offer.qualifyingCondition || {};
  const condition = `${primaryCondition.name || ""} ${primaryCondition.patientFriendlyName || ""}`.toLowerCase();
  const variants = [
    {
      matches: ["hypertension", "blood pressure"],
      icon: "heart",
      title: L("Track your blood pressure from home", "Controle su presión arterial desde casa", "Swiv tansyon ou lakay ou"),
      description: L("Use a connected blood pressure monitor to track your readings and help your care team understand how you’re doing.", "Use un monitor de presión arterial conectado para registrar sus lecturas y ayudar a su equipo de cuidado a entender cómo va.", "Sèvi ak yon aparèy tansyon konekte pou anrejistre lekti ou yo epi ede ekip swen ou konprann kijan w ap fè.")
    },
    {
      matches: ["diabetes"],
      icon: "heart",
      title: L("Track your blood sugar from home", "Controle su azúcar en sangre desde casa", "Swiv sik nan san ou lakay ou"),
      description: L("Track your readings at home so your care team can understand how you’re doing.", "Registre sus lecturas en casa para que su equipo de cuidado entienda cómo va.", "Anrejistre lekti ou yo lakay ou pou ekip swen ou ka konprann kijan w ap fè.")
    },
    {
      matches: ["heart failure"],
      icon: "heart",
      title: L("Track your symptoms from home", "Controle sus síntomas desde casa", "Swiv sentòm ou yo lakay ou"),
      description: L("Track your symptoms and weight at home so your care team can understand how you’re doing.", "Registre sus síntomas y su peso en casa para que su equipo de cuidado entienda cómo va.", "Anrejistre sentòm ou yo ak pwa ou lakay ou pou ekip swen ou ka konprann kijan w ap fè.")
    },
    {
      matches: ["kidney"],
      icon: "heart",
      title: L("Track your kidney health from home", "Controle su salud renal desde casa", "Swiv sante ren ou lakay ou"),
      description: L("Track what your care team asks for at home so they can understand how you’re doing.", "Registre en casa lo que su equipo de cuidado le indique para que entienda cómo va.", "Anrejistre lakay ou sa ekip swen ou mande a pou yo ka konprann kijan w ap fè.")
    }
  ];
  return variants.find(variant => variant.matches.some(match => condition.includes(match))) || {
    icon: "heart",
    title: L("Track your health from home", "Controle su salud desde casa", "Swiv sante ou lakay ou"),
    description: L("Track what matters for your health at home so your care team can understand how you’re doing.", "Registre en casa lo que importa para su salud para que su equipo de cuidado entienda cómo va.", "Anrejistre lakay ou sa ki enpòtan pou sante ou pou ekip swen ou ka konprann kijan w ap fè.")
  };
}

function accessCareCapabilities(offer) {
  const conditionCard = accessConditionCareCard(offer);
  const physicianName = offer.physician?.displayName;
  const referredByPhysician = isProviderReferralSource(offer.enrollmentSource) && Boolean(physicianName);
  // The doctor stays named wherever the invitation named one, and is never invented where it did not.
  const coordinationTitle = referredByPhysician
    ? L(`Stay connected with ${physicianName}`, `Siga conectado con ${physicianName}`, `Rete konekte ak ${physicianName}`)
    : L("Stay connected with your doctors", "Siga conectado con sus médicos", "Rete konekte ak doktè ou yo");
  const coordinationCopy = referredByPhysician
    ? L(`ITERA works with ${physicianName} and your care team to help keep your care connected and coordinated.`, `ITERA trabaja con ${physicianName} y su equipo de cuidado para ayudar a mantener su cuidado conectado y coordinado.`, `ITERA travay avèk ${physicianName} ak ekip swen ou pou ede kenbe swen ou konekte ak kowòdone.`)
    : L("ITERA helps keep your care coordinated with the doctors you already see.", "ITERA ayuda a mantener su cuidado coordinado con los médicos que ya consulta.", "ITERA ede kenbe swen ou kowòdone avèk doktè ou deja wè yo.");
  return [
    { icon: "people", title: L("Stay connected with your care team", "Manténgase conectado con su equipo de cuidado", "Rete konekte ak ekip swen ou"), description: L("Get ongoing support, answers to your questions, and help staying on track between visits.", "Reciba apoyo continuo, respuestas a sus preguntas y ayuda para seguir su plan entre visitas.", "Jwenn sipò kontinyèl, repons pou kesyon ou yo, ak èd pou rete sou bon chemen an ant vizit yo.") },
    conditionCard,
    { icon: "goals", title: L("A care plan built around you", "Un plan de cuidado pensado para usted", "Yon plan swen ki fèt pou ou"), description: L("Your goals, health information, and next steps come together in one personalized care plan.", "Sus metas, su información de salud y sus próximos pasos se reúnen en un plan de cuidado personalizado.", "Objektif ou, enfòmasyon sante ou, ak pwochen etap ou yo vin ansanm nan yon sèl plan swen pèsonalize.") },
    { icon: "doctor", title: coordinationTitle, description: coordinationCopy }
  ];
}

function recommendation() {
  if (state.offer.pathway === "ACCESS") {
    const capabilities = accessCareCapabilities(state.offer);
    // The condition is the patient's, not this screen's: it comes from the offer so the sentence
    // reads correctly whichever condition the invitation was issued for.
    const managedCondition = localizedCondition(state.offer.qualifyingCondition?.patientFriendlyName || "") || L("your health", "su salud", "sante ou");
    return `${titleBlock(L("What your care includes", "Qué incluye su cuidado", "Sa swen ou gen ladan"), L(`Your ACCESS care gives you new tools and ongoing support to help you manage your ${managedCondition} between doctor visits.`, `Su cuidado ACCESS le brinda nuevas herramientas y apoyo continuo para ayudarle a controlar su ${managedCondition} entre visitas al médico.`, `Swen ACCESS ou ba ou nouvo zouti ak sipò kontinyèl pou ede w jere ${managedCondition} ou ant vizit kay doktè.`))}
      ${rows(capabilities.map(x => [x.icon, x.title, x.description]))}
      <aside class="note">${icon("info")}<span>${L("Your care doesn’t stop when you leave the doctor’s office. Your care team stays connected with you along the way.", "Su cuidado no termina cuando sale del consultorio. Su equipo de cuidado permanece conectado con usted en todo el proceso.", "Swen ou pa kanpe lè ou kite biwo doktè a. Ekip swen ou rete konekte avèk ou pandan tout wout la.")}</span></aside>
      ${actions(t().continue)}`;
  }
  const capabilities = recommendedCareCapabilities(state.offer);
  return `${titleBlock(L("Your recommended care", "Su cuidado recomendado", "Swen yo rekòmande pou ou"), L("Based on your health needs, your recommended care includes:", "Según sus necesidades de salud, su cuidado recomendado incluye:", "Selon bezwen sante ou, swen yo rekòmande pou ou gen ladan:"))}
    ${rows(capabilities.map(x => [x.icon, x.title, x.description]))}
    <aside class="note">${icon("info")}<span>${L("These services work together as part of your recommended care.", "Estos servicios funcionan juntos como parte de su cuidado recomendado.", "Sèvis sa yo travay ansanm kòm yon pati nan swen yo rekòmande pou ou.")}</span></aside>
    ${actions(t().continue)}`;
}

function howCareWorks() {
  const physicianName = state.offer.physician?.displayName;
  const supportingCopy = state.offer.pathway === "ACCESS"
    ? physicianName ? L(`ITERA HEALTH works with ${physicianName} to support your ACCESS care.`, `ITERA HEALTH trabaja con ${physicianName} para apoyar su cuidado ACCESS.`, `ITERA HEALTH travay avèk ${physicianName} pou sipòte swen ACCESS ou.`) : L("ITERA HEALTH supports your ACCESS care and coordinates with your existing doctors.", "ITERA HEALTH apoya su cuidado ACCESS y coordina con sus médicos actuales.", "ITERA HEALTH sipòte swen ACCESS ou epi li kowòdone avèk doktè ou deja genyen yo.")
    : offerText(state.offer.content.supportTemplate || state.offer.content.support, { physicianDisplayName: physicianName || physicianDisplayName() });
  const physicianCard = physicianName && state.offer.referringProvider ? `<article class="provider-card care-works-physician"><img src="${state.offer.referringProvider.verifiedPhotoUrl}" alt=""><div><strong>${physicianName} <span aria-label="${L("Verified provider", "Proveedor verificado", "Founisè verifye")}">✓</span></strong><small>${L("Your doctor", "Su médico", "Doktè ou")}</small></div></article>` : "";
  return `${titleBlock(L("How your care works", "Cómo funciona su cuidado", "Ki jan swen ou travay"), supportingCopy)}${physicianCard}
    ${rows([["calendar", L("ITERA checks in regularly", "ITERA se comunica regularmente", "ITERA tcheke regilyèman"), L("We stay in touch and follow your care plan.", "Nos mantenemos en contacto y seguimos su plan de cuidado.", "Nou rete an kontak epi nou suiv plan swen ou.")], ["phone", L("Get support between visits", "Reciba apoyo entre visitas", "Jwenn sipò ant vizit yo"), L("Get help with questions and next steps.", "Reciba ayuda con sus preguntas y próximos pasos.", "Jwenn èd ak kesyon ak pwochen etap yo.")], ["people", L("Your doctor stays involved", "Su médico sigue involucrado", "Doktè ou rete enplike"), L("We share important updates with your doctor.", "Compartimos actualizaciones importantes con su médico.", "Nou pataje mizajou enpòtan avèk doktè ou.")]])}
    <aside class="trust-note">${icon("shield")}<span>${L("ITERA provides additional support between doctor visits.", "ITERA brinda apoyo adicional entre las visitas al médico.", "ITERA bay sipò anplis ant vizit kay doktè.")}</span></aside>
    ${actions(t().continue)}`;
}

// Which demo patient this session is about. The cost card and EMMI both ask here.
function currentDemoPatientId() {
  return selectDemoPatientId({ language: state.language, completionRole: state.completionRole, eligibilityStatus: state.accessOutcome, deviceScenario: service.getScenarioDeviceContext?.() || null });
}

function assistantContext() {
  const deviceScenario = service.getScenarioDeviceContext?.() || null;
  const patientContextKey = [state.completionRole, state.accessOutcome, deviceScenario?.patientOwnsMonitor, deviceScenario?.integrationStatus].join("|");
  if (!state.assistantDemoPatientId || state.assistantPatientContextKey !== patientContextKey) {
    state.assistantDemoPatientId = selectDemoPatientId({ language: state.language, completionRole: state.completionRole, eligibilityStatus: state.accessOutcome, deviceScenario });
    state.assistantPatientContextKey = patientContextKey;
  }
  const patientId = state.assistantDemoPatientId;
  const fixture = EMMI_DEMO_PATIENTS[patientId];
  const currentScreen = state.assistantOriginScreen || state.screen;
  const emmiCurrentScreen = currentScreen === "CLINICAL_VERIFICATION" ? "HEALTH_INFORMATION_REVIEW" : currentScreen;
  const currentConditions = (state.offer?.qualifyingConditions?.length ? state.offer.qualifyingConditions : [state.offer?.qualifyingCondition].filter(Boolean)).map(condition => ({ id: condition.id || "", name: localizedCondition(condition.name || condition.patientFriendlyName) }));
  const activeGoalRecord = currentGoal();
  const activeGoalHealth = activeGoalRecord?.goalType === "BLOOD_PRESSURE_CONTROL" ? bloodPressureGoalRuntime(activeGoalRecord) : null;
  const onlyUpcomingAppointment = upcomingAppointments(appointmentRecords(), new Date());
  const activeAppointmentRecord = activeAppointment() || (onlyUpcomingAppointment.length === 1 ? onlyUpcomingAppointment[0] : null);
  // Keep the explicitly selected appointment available across screens and refreshes. If none was
  // selected, one — and only one — upcoming visit is unambiguous. This is the durable task context
  // shared by the appointment UI, chat, and voice; multiple visits are never guessed between.
  const appointmentInAssistantContext = Boolean(activeAppointmentRecord);
  const appointmentPrep = appointmentInAssistantContext
    ? {
        appointmentId: activeAppointmentRecord.id,
        providerDisplayName: activeAppointmentRecord.providerDisplayName || "",
        specialty: activeAppointmentRecord.specialty || "",
        status: activeAppointmentRecord.status || "",
        reasonCategory: activeAppointmentRecord.reasonCategory || "",
        reasonSummary: String(activeAppointmentRecord.reasonSummary || "").slice(0, 400),
        topics: (activeAppointmentRecord.prep?.topics || []).filter(Boolean).map(topic => String(topic).slice(0, 120)),
        medications: (activeAppointmentRecord.prep?.medications || []).filter(item => item?.medicationId && item?.name).map(item => ({ medicationId: String(item.medicationId), name: String(item.name).slice(0, 120), details: String(item.details || "").slice(0, 160) })),
        emmiPreparation: activeAppointmentRecord.prep?.emmiPreparation && typeof activeAppointmentRecord.prep.emmiPreparation === "object" ? activeAppointmentRecord.prep.emmiPreparation : null
      }
    : onlyUpcomingAppointment.length > 1
      ? {
          appointmentId: "",
          ambiguous: true,
          appointmentCandidates: onlyUpcomingAppointment.map(record => ({ appointmentId: record.id, providerDisplayName: record.providerDisplayName || "", scheduledAt: record.scheduledAt || "" }))
        }
      : null;
  const progress = state.offer ? progressFor({ ...state, screen: currentScreen }) : { stage: "YOUR_CARE" };
  if (!emmiConversationManager) {
    emmiConversationManager = new EmmiConversationManager({
      patientId,
      scenarioId: state.scenarioId,
      locale: languageCode(),
      onEvent: (type, details) => {
        emmiAuditLog?.voiceEvent(type, details);
        audit(state, type.toLowerCase(), type === "EMMI_UNEXPECTED_GREETING" ? "blocked" : "success", privacySafeEmmiEventDetails(details));
        if (import.meta.env.DEV && type === "EMMI_UNEXPECTED_GREETING") console.warn("[EMMI continuity guard]", details);
      }
    });
  }
  return {
    ...fixture,
    sessionId: state.sessionId,
    patientId,
    locale: languageCode(),
    languageName: resolveEmmiLanguage(languageCode()).languageName,
    speechLanguage: resolveEmmiLanguage(languageCode()).speechLanguage,
    modelLanguageInstruction: resolveEmmiLanguage(languageCode()).modelLanguageInstruction,
    // EMMI reads the next step from the same resolver the CTA uses instead of inferring it.
    nextBestAction: state.offer ? (({ label, route, actionType }) => ({ label: localized(label), route, actionType }))(currentNextBestAction()) : null,
    // Who invited this patient, into what, and for which condition are runtime facts EMMI must
    // have from the first turn — not something inferred from the screen or from a demo fixture.
    program: state.offer?.program || null,
    accessTrack: state.offer?.accessTrack || null,
    enrollmentSource: state.offer?.enrollmentSource || null,
    referralOrigin: state.offer?.referralOrigin || null,
    physicianDisplayName: state.offer?.physician?.displayName || null,
    currentStage: progress.stage,
    currentScreen: emmiCurrentScreen,
    routeScreen: currentScreen,
    currentConditions,
    eligibilityStatus: state.accessOutcome === "notEligible" ? "NOT_ELIGIBLE" : fixture.eligibilityStatus,
    enrollmentStatus: state.enrollmentStatus === "COMPLETED" ? "COMPLETED" : fixture.enrollmentStatus,
    // Cleared to keep going is not the same as enrolled, and the difference is the patient's to
    // make. Stated outright so no answer has to derive one from the other.
    canContinue: state.accessOutcome === "eligible",
    enrollmentComplete: state.enrollmentStatus === "COMPLETED",
    bpBaselineStatus: state.bpBaselineStatus || fixture.bpBaselineStatus,
    bpBaselineRequiredReadings: state.bpBaselineRequiredReadings || 3,
    bpBaselineReadingCount: state.bpBaselineReadingCount || 0,
    bpBaselineRemainingReadings: state.bpBaselineRemainingReadings ?? 3,
    deviceVerificationStatus: state.deviceVerificationStatus,
    firstTransmissionVerified: state.firstTransmissionVerified,
    deviceFulfillmentStatus: state.deviceFulfillmentStatus || state.bpDeviceFulfillmentStatus || "NOT_REQUESTED",
    deviceFulfillmentRequestedAt: state.bpDeviceFulfillmentRequestedAt || null,
    deviceShipmentStatus: null,
    deviceDeliveryDate: null,
    careCircleStatus: state.careCircleStatus,
    supportRole: state.supportRole,
    // A patient and a representative are agreeing to different things on the consent screen, so the
    // guardrail that explains what is being signed needs to know which one is asking.
    completedByRepresentative: isPersonalRepresentative(),
    careTeam: patientCareTeam().map(member => ({ ...member, roleLabel: careTeamRoleLabel(member) })),
    supportPersonName: state.supportPersonName || null,
    supportInviteStatus: state.supportInviteStatus,
    deviceScenario,
    goalFlowStep: state.goalFlowStep,
    patientGoals: activePatientGoals().map(goal => ({ id: goal.id, title: goalDisplayName(goal, state.language), status: goal.status, priority: goal.priority, planStatus: goal.planStatus })),
    // Appointment preparation is structured conversation context, not prose inferred from a prior
    // bubble. It lets a short reply such as "BP readings" or "what does that mean?" stay attached
    // to the topic the patient saved even when an older clinical topic remains in chat history.
    appointmentPrep,
    appointmentSupport: activeResolution() && activeResolution().appointmentId === activeAppointmentRecord?.id
      ? {
          appointmentId: activeResolution().appointmentId,
          barrierType: activeResolution().barrierType,
          step: activeResolution().step,
          contactName: activeResolution().data?.contactName || "",
          invitationScope: activeResolution().barrierType === BARRIER_TYPES.COMPANION
            ? { appointmentDate: true, appointmentTime: true, appointmentLocation: true, healthInformation: false }
            : null
        }
      : null,
    // Where this patient started and what ACCESS will recognise as progress, resolved by the same
    // functions the goals screen and the care plan render. "What was my starting blood pressure"
    // is a question about this patient, and the knowledge base has no way to answer it: it knows
    // what a baseline IS, never what THIS one is. Handing EMMI the resolved shape is what keeps
    // the number it says identical to the number on the screen behind the conversation.
    accessGoalBaselines: assignedAccessGoals(state.offer).map(goalType => {
      const startingPoint = patientStartingPoint(goalType, careActivationRuntime());
      return { goalType, title: localGoalText(GOAL_CONFIG[goalType].displayName, state.language), startingPoint, measure: accessProgressMeasure(goalType, startingPoint) };
    }),
    activeGoal: activeGoalRecord ? {
      id: activeGoalRecord.id,
      title: goalDisplayName(activeGoalRecord, state.language),
      status: activeGoalRecord.status,
      priority: activeGoalRecord.priority,
      latestReading: activeGoalHealth?.latest || null,
      readingTrend: activeGoalHealth?.trend || null,
      clinicalTarget: activeGoalHealth?.clinicalTarget || null,
      actions: (activeGoalRecord.actions || []).map(action => ({ id: action.id, title: action.title, verificationMethod: resolveGoalActionVerification(action), status: action.status })),
      progress: activeGoalHealth ? { readingCountThisWeek: activeGoalHealth.trend.count } : null,
      nextBestEducation: nextBestGoalEducation({ goalType: activeGoalRecord.goalType, completedTopicIds: (activeGoalRecord.educationHistory || []).filter(item => item.status === "COMPLETED").map(item => item.topicId) }),
      // EMMI knows what is already being worked on, so a patient who mentions a difficulty again
      // is answered in context instead of being asked the same questions from the start.
      barriers: activeGoalBarriers(activeGoalRecord).map(barrier => ({
        id: barrier.id,
        category: barrier.category,
        status: barrier.status,
        owner: barrier.owner,
        patientDescription: barrier.patientDescription,
        lastIntervention: (barrier.interventions || []).at(-1)?.type || null,
        lastOutcome: (barrier.interventions || []).at(-1)?.outcome || null
      }))
    } : null,
    medications: (state.careMedications || []).map(({ id, name, details, active }) => ({ id, name, details, active: Boolean(active) })),
    // What the patient is looking at RIGHT NOW: the view, what they have to do on it, the values
    // and choices on screen, what is selected, what has really happened and what has not.
    //
    // This is the field the original defect was missing. `currentScreen` above is a route, and a
    // route stopped identifying a screen the moment a route grew a flow inside it — every step of
    // appointment coordination and of barrier resolution is "APPOINTMENT_DETAIL". Chat reads this
    // fresh on every turn because it calls assistantContext() per turn; Voice is sent it again
    // whenever it changes, because a live session takes its system instruction only once.
    view: emmiModelView(),
    emmiConversation: emmiConversationManager.contextForModel()
  };
}

// Free text is what a patient typed. It belongs in EMMI's own transcript, not in the analytics
// events that travel with the enrollment record.
const privacySafeEmmiEventDetails = ({ retrievalQuery, question, transcript, text, ...rest } = {}) => rest;

const emmiToolStatusLabel = name => ({
  getEnrollmentContext: L("Checking your information…", "Revisando su información…", "N ap verifye enfòmasyon ou…"),
  getExpectedAccessCost: L("Checking your ACCESS cost…", "Revisando su costo de ACCESS…", "N ap verifye pri ACCESS ou…"),
  getAssignedDevice: L("Checking your monitor…", "Revisando su monitor…", "N ap verifye aparèy ou…"),
  checkDeviceConnection: L("Checking the connection…", "Revisando la conexión…", "N ap verifye koneksyon an…"),
  getLatestReading: L("Checking your latest reading…", "Revisando su última lectura…", "N ap verifye dènye lekti ou…"),
  getReadingTrend: L("Checking your recent trend…", "Revisando su tendencia reciente…", "N ap verifye tandans ou…"),
  getClinicalTarget: L("Checking your care-team target…", "Revisando el objetivo de su equipo…", "N ap verifye sib ekip swen ou…"),
  getGoalProgress: L("Checking your goal progress…", "Revisando el progreso de su meta…", "N ap verifye pwogrè objektif ou…"),
  requestCallback: L("Talking with your care team…", "Comunicándonos con su equipo…", "N ap kontakte ekip swen ou…"),
  createCareTeamTask: L("Talking with your care team…", "Comunicándonos con su equipo…", "N ap kontakte ekip swen ou…"),
  getUpcomingAppointments: L("Checking your appointments…", "Revisando sus citas…", "N ap verifye randevou ou yo…"),
  getAppointment: L("Checking your appointment…", "Revisando su cita…", "N ap verifye randevou ou…"),
  getAppointmentTransportation: L("Checking your transportation…", "Revisando su transporte…", "N ap verifye transpò ou…"),
  getSchedulingCapability: L("Checking how this office schedules…", "Revisando cómo agenda este consultorio…", "N ap verifye kijan kabinè sa a bay randevou…"),
  getProviderAvailability: L("Looking for open times…", "Buscando horarios disponibles…", "N ap chache lè ki lib…"),
  startAppointmentRequest: L("Opening your appointment request…", "Abriendo su solicitud de cita…", "N ap louvri demann randevou ou…"),
  createAppointmentRequest: L("Sending your request…", "Enviando su solicitud…", "N ap voye demann ou…"),
  bookAppointment: L("Confirming that time…", "Confirmando ese horario…", "N ap konfime lè sa a…"),
  rescheduleAppointment: L("Asking about a new time…", "Consultando un nuevo horario…", "N ap mande pou yon lè nouvo…"),
  cancelAppointment: L("Canceling your appointment…", "Cancelando su cita…", "N ap anile randevou ou…"),
  createAppointmentReminder: L("Saving your reminder…", "Guardando su recordatorio…", "N ap anrejistre rapèl ou…"),
  getCareCircle: L("Checking your Care Circle…", "Revisando su Círculo de cuidado…", "N ap verifye Sèk swen ou…"),
  shareAppointment: L("Sharing your appointment…", "Compartiendo su cita…", "N ap pataje randevou ou…")
})[name] || L("Checking your information…", "Revisando su información…", "N ap verifye enfòmasyon ou…");

function ensureEmmiRuntime() {
  const context = assistantContext();
  if (emmiAuditLog?.entry.demoPatientId !== context.patientId) { emmiAuditLog?.end(); emmiAuditLog = null; emmiTools = null; emmiTextOrchestrator = null; emmiTransitionManager?.cancel("patient_context_changed", { immediate: true }); emmiTransitionManager = null; emmiLive?.disconnect("context_changed"); emmiLive = null; emmiConversationManager = null; }
  emmiAuditLog ||= new EmmiAuditLog({ sessionId: context.sessionId, demoPatientId: context.patientId, locale: context.locale, currentScreen: context.currentScreen });
  emmiAuditLog.updateContext(context);
  emmiTools ||= new EmmiToolOrchestrator({
    getContext: assistantContext,
    auditLog: emmiAuditLog,
    onCallback: result => { state.callbackRequested = true; audit(state, "emmi_callback_requested", "success", { requestId: result.requestId, prototype: true }); },
    onTask: result => { state.careTeamTasks = [...(state.careTeamTasks || []), result]; audit(state, "emmi_care_team_task_created", "success", { taskId: result.taskId, prototype: true }); },
    onProgress: () => draftStore.save(state),
    // A difficulty EMMI hears in conversation becomes the same record the goal screen writes, so
    // voice, text and tapping all end up in one place with one history.
    onBarrier: ({ category, patientDescription }) => {
      const goal = currentGoal();
      if (!goal) return null;
      const known = findReusableBarrier(allPatientBarriers(), { category, goalId: goal.id });
      const barrier = recordBarrier({ goal, category, patientDescription, source: BARRIER_SOURCES.EMMI });
      return barrier ? { ...barrier, alreadyKnown: Boolean(known && barrierIsActive(known)) } : null;
    },
    // Supply, refills and the review screen all come from the same functions the medication screen
    // uses, so voice, text and tapping cannot disagree about what is true.
    onMedicationSupply: () => activeMedications().map(medication => {
      const estimate = medicationSupplyEstimate(medication);
      return {
        medicationId: medication.id,
        name: medicationLabel(medication),
        sig: medication.sig || "",
        canEstimate: estimate.eligible,
        monitoring: estimate.monitoring,
        estimatedDaysRemaining: estimate.estimatedDaysRemaining,
        supplyConfidence: estimate.confidence,
        pharmacy: medication.pharmacy?.name || null,
        prescriber: medicationPrescriber(medication)?.name || null,
        refillsRemaining: medication.refillsRemaining ?? null
      };
    }),
    onActiveRefills: () => refillEpisodes().filter(refillIsOpen).map(refill => ({
      refillId: refill.id,
      medicationId: refill.medicationId,
      medication: refill.medicationSnapshot?.name || "",
      status: refill.status,
      patientStatus: refillPatientStatus(refill, "en"),
      waitingOn: refill.requiresAppointment ? "APPOINTMENT" : refill.requiresClinicalReview ? "CARE_TEAM" : refill.requiresPrescriber ? "PRESCRIBER" : "PHARMACY",
      requestedAt: refill.requestedAt
    })),
    onRefillReview: ({ medicationId }) => {
      const medication = medicationById(medicationId);
      if (!medication) return null;
      const existing = openRefillForMedication(medication.id);
      // An existing request is reported, never duplicated.
      if (existing) return { alreadyRequested: true, refillId: existing.id, status: existing.status, patientStatus: refillPatientStatus(existing, "en") };
      const episode = startRefillEpisode(medication, { source: "EMMI" });
      state.activeRefillId = episode.id;
      state.screen = "MY_MEDICATIONS";
      state.refillFlow = { medicationId: medication.id, step: "REVIEW", answer: "" };
      // EMMI moved the patient somewhere real; closing the panel lands them on it rather than on
      // the screen they were looking at before they asked.
      state.assistantPendingNavigation = true;
      draftStore.save(state);
      return { alreadyRequested: false, refillId: episode.id, opened: "REFILL_REVIEW", medication: medicationLabel(medication) };
    },
    // Appointments answer from the same records the screens read. EMMI never learns a time, a
    // status or a provider from anywhere else, and every path that changes something asks first.
    onUpcomingAppointments: () => ({
      appointments: upcomingAppointments(appointmentRecords(), new Date()).map(record => ({
        id: record.id,
        patientStatus: appointmentPatientStatus(record, state.language),
        nextStep: appointmentNextStep(record, state.language),
        providerDisplayName: record.providerDisplayName || "",
        specialty: record.requestedSpecialty || "",
        scheduledAt: record.scheduledAt || "",
        modality: record.modality || ""
      })),
      requests: pendingRequests(appointmentRecords()).map(record => ({
        id: record.id,
        patientStatus: appointmentPatientStatus(record, state.language),
        providerDisplayName: record.providerDisplayName || "",
        requestedAt: record.requestSentAt || record.createdAt
      }))
    }),
    onAppointment: ({ appointmentId }) => {
      const record = appointmentById(appointmentId);
      if (!record) return { success: false, status: "NOT_FOUND" };
      return {
        appointment: {
          id: record.id,
          status: record.status,
          patientStatus: appointmentPatientStatus(record, state.language),
          nextStep: appointmentNextStep(record, state.language),
          providerDisplayName: record.providerDisplayName || "",
          specialty: record.requestedSpecialty || "",
          scheduledAt: record.scheduledAt || "",
          scheduledLabel: record.scheduledAt ? formatAppointmentWhen(record.scheduledAt, record.timezone || "", state.language) : "",
          modality: record.modality || "",
          locationName: record.locationName || "",
          reasonCategory: record.reasonCategory,
          reminder: record.reminder ? { slot: record.reminder.slot, channel: record.reminder.channel } : null
        }
      };
    },
    onAppointmentTransportation: ({ appointmentId }) => {
      const record = appointmentById(appointmentId);
      if (!record) return { success: false, status: "APPOINTMENT_NOT_FOUND" };
      const resolution = transportationResolutionFor(record.id);
      const outbound = resolution?.data?.reservation;
      const returning = resolution?.data?.returnReservation;
      const reservations = [outbound, returning].filter(item => item?.status === "CONFIRMED").map(item => ({
        reservationId: item.reservationId || "",
        tripType: item.tripType || "OUTBOUND",
        status: item.status,
        serviceName: item.serviceName || "",
        pickupAt: item.pickupAt || "",
        pickupLabel: item.pickupAt ? formatBarrierTime(item.pickupAt, record) : "",
        estimatedArrivalAt: item.estimatedArrivalAt || "",
        estimatedArrivalLabel: item.estimatedArrivalAt ? formatBarrierTime(item.estimatedArrivalAt, record) : "",
        estimatedCost: item.estimatedCost || "",
        pickupAddress: item.pickupFormatted || "",
        destinationName: item.destinationName || "",
        destinationAddress: item.destinationFormatted || ""
      }));
      return reservations.length
        ? { success: true, status: "CONFIRMED", appointmentId: record.id, reservations }
        : { success: false, status: "TRANSPORTATION_NOT_FOUND", reservations: [] };
    },
    onAppointmentTopics: ({ appointmentId, operation, target, value, detail, index, position }) => {
      const record = appointmentById(appointmentId);
      if (!record) return { success: false, status: "NOT_FOUND" };
      const topics = (record.prep?.topics || []).map(item => String(item || "").trim()).filter(Boolean);
      const normalize = item => String(item || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
      const preparation = record.prep?.emmiPreparation || {};
      const resolveIndex = () => {
        if (index === -1) return topics.length - 1;
        if (Number.isInteger(index) && index >= 0) return index < topics.length ? index : -1;
        const key = normalize(target);
        if (/^(ese|esa|that|it)$/.test(key)) {
          const recent = normalize(preparation.lastTopic || preparation.currentTopic || "");
          return recent ? topics.findIndex(item => normalize(item) === recent || normalize(item).includes(recent) || recent.includes(normalize(item))) : -2;
        }
        if (!key) return -2;
        const words = key.replace(/^(lo de|el tema de|la pregunta de) /, "").split(" ").filter(word => word.length > 2);
        const matches = topics.map((item, topicIndex) => ({ topicIndex, score: words.filter(word => normalize(item).includes(word)).length })).filter(item => item.score > 0);
        const best = Math.max(0, ...matches.map(item => item.score));
        const winners = matches.filter(item => item.score === best);
        return winners.length === 1 ? winners[0].topicIndex : winners.length > 1 ? -2 : -1;
      };
      let nextTopics = [...topics];
      let item = "";
      let changedIndex = -1;
      if (["LIST", "OPEN"].includes(operation)) {
        if (operation === "OPEN") {
          openAppointmentDetail(record.id, "PREP");
          state.assistantPendingNavigation = true;
        }
      } else if (operation === "READ_ITEM") {
        changedIndex = resolveIndex();
        if (changedIndex < 0) return { success: false, status: changedIndex === -2 ? "TOPIC_AMBIGUOUS" : "TOPIC_NOT_FOUND" };
        item = topics[changedIndex];
      } else if (operation === "ADD") {
        const added = String(value || "").trim().slice(0, 120);
        if (!added) return { success: false, status: "TOPIC_REQUIRED" };
        const existingIndex = topics.findIndex(topic => normalize(topic) === normalize(added));
        if (existingIndex >= 0) changedIndex = existingIndex;
        else { nextTopics.push(added); changedIndex = nextTopics.length - 1; }
      } else {
        changedIndex = resolveIndex();
        if (changedIndex < 0) return { success: false, status: changedIndex === -2 ? "TOPIC_AMBIGUOUS" : "TOPIC_NOT_FOUND" };
        if (operation === "REMOVE") nextTopics.splice(changedIndex, 1);
        else if (operation === "MOVE") {
          const [moved] = nextTopics.splice(changedIndex, 1);
          const destination = Math.max(0, Math.min(Number.isInteger(position) ? position : 0, nextTopics.length));
          nextTopics.splice(destination, 0, moved);
          changedIndex = destination;
        } else if (operation === "UPDATE") {
          const replacement = String(value || "").trim().slice(0, 120);
          if (!replacement) return { success: false, status: "TOPIC_REQUIRED" };
          nextTopics[changedIndex] = replacement;
        } else if (operation === "UPDATE_DETAIL") {
          const addedDetail = String(detail || "").trim();
          if (!addedDetail) return { success: false, status: "TOPIC_REQUIRED" };
          nextTopics[changedIndex] = `${topics[changedIndex]}: ${addedDetail}`.slice(0, 120);
        } else return { success: false, status: "OPERATION_NOT_SUPPORTED" };
      }
      const now = new Date().toISOString();
      const lastTopic = changedIndex >= 0 ? (nextTopics[changedIndex] || topics[changedIndex] || "") : preparation.lastTopic || "";
      saveAppointment({
        ...record,
        prep: { ...(record.prep || {}), topics: nextTopics, emmiPreparation: { ...preparation, status: "IN_PROGRESS", contextActive: true, lastTopic, updatedAt: now }, updatedAt: now },
        updatedAt: now
      });
      const saved = appointmentById(record.id)?.prep?.topics || [];
      const verified = saved.length === nextTopics.length && saved.every((topic, topicIndex) => topic === nextTopics[topicIndex]);
      if (!verified) return { success: false, status: "TOPICS_NOT_SAVED" };
      return { success: true, status: operation === "OPEN" ? "OPENED" : "SAVED", appointmentId: record.id, topics: saved, ...(item ? { item } : {}) };
    },
    onSchedulingCapability: ({ providerId, appointmentType }) => {
      const member = patientCareTeam().find(candidate => candidate.id === providerId);
      const capability = resolveSchedulingCapability({
        patientId: state.offer?.patient?.id || "",
        providerId: providerId || "",
        practiceId: String(member?.practiceName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        appointmentType: appointmentType || ""
      });
      return { capability: capability.capability, supportedModalities: capability.supportedModalities, reason: capability.reason };
    },
    // Availability comes from the scheduling source or it does not come at all. A failure here is
    // reported as a failure; it is never filled in with a plausible-looking time.
    onProviderAvailability: ({ providerId, preferredTimeOfDay, modality }) => {
      const now = new Date();
      const member = patientCareTeam().find(candidate => candidate.id === providerId);
      const practiceId = String(member?.practiceName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const result = getProviderAvailability({ providerId: providerId || "", practiceId, preferredTimeOfDay, modality, now });
      if (!result.ok) return { ok: false, error: result.error };
      const heldSlots = reservableAvailabilitySlots(result.slots, now);
      if (!heldSlots.length) return { ok: false, error: "AVAILABILITY_UNAVAILABLE" };
      return { ok: true, slots: heldSlots.map(({ slotId, startAt, endAt, modality: slotModality, locationName, expiresAt }) => ({ slotId, startAt, endAt, modality: slotModality, locationName, expiresAt })) };
    },
    // Opening the flow requests nothing by itself, exactly like starting a refill review.
    onStartAppointmentRequest: ({ reasonCategory, providerId, reasonSummary }) => {
      const started = startAppointmentNeed({
        source: APPOINTMENT_SOURCES.EMMI_CONVERSATION,
        reasonCategory: reasonCategory || APPOINTMENT_REASON_CATEGORIES.OTHER,
        reasonSummary: reasonSummary || "",
        providerId: providerId || ""
      });
      const existing = started.record.requestedProfessionalId
        ? findUpcomingAppointmentWithProvider(appointmentRecords(), started.record.requestedProfessionalId, new Date())
        : null;
      const { record } = classifyAppointmentPath(started.record);
      openAppointmentScheduling(record, "PROVIDER");
      // EMMI moved the patient somewhere real; closing the panel lands them on it.
      state.assistantPendingNavigation = true;
      draftStore.save(state);
      return {
        success: true,
        status: "FLOW_OPENED",
        needId: record.id,
        capability: record.schedulingCapability,
        duplicate: Boolean(started.duplicate),
        existingAppointmentId: existing?.id || null,
        existingAppointmentStatus: existing ? appointmentPatientStatus(existing, state.language) : null,
        providerResolved: started.resolution.status,
        providerDisplayName: record.providerDisplayName || ""
      };
    },
    onCreateAppointmentRequest: ({ needId, confirmed }) => {
      if (confirmed !== true) return { success: false, status: "CONFIRMATION_REQUIRED" };
      const record = appointmentById(needId);
      if (!record) return { success: false, status: "NOT_FOUND" };
      const result = record.schedulingCapability === SCHEDULING_CAPABILITY.HUMAN_COORDINATION
        || record.schedulingCapability === SCHEDULING_CAPABILITY.NO_AVAILABLE_CHANNEL
        ? escalateAppointmentToCoordinator(record, { viaEmmi: true })
        : sendAppointmentRequest(record, { viaEmmi: true });
      if (!result.ok) return { success: false, status: result.error || "REQUEST_FAILED" };
      return { success: true, status: result.record.status, needId: result.record.id, patientStatus: appointmentPatientStatus(result.record, state.language) };
    },
    onBookAppointment: ({ needId, slotId, confirmed }) => {
      if (confirmed !== true) return { success: false, status: "CONFIRMATION_REQUIRED" };
      const record = appointmentById(needId);
      if (!record) return { success: false, status: "NOT_FOUND" };
      const result = confirmAppointmentSlot(record, slotId);
      if (!result.ok) return { success: false, status: result.slotGone ? "SLOT_UNAVAILABLE" : "BOOKING_FAILED" };
      return { success: true, status: result.record.status, confirmationNumber: result.record.confirmationNumber, scheduledAt: result.record.scheduledAt };
    },
    onRescheduleAppointment: ({ appointmentId, confirmed }) => {
      if (confirmed !== true) return { success: false, status: "CONFIRMATION_REQUIRED" };
      const record = appointmentById(appointmentId);
      if (!record) return { success: false, status: "NOT_FOUND" };
      const result = requestAppointmentReschedule(record, { viaEmmi: true });
      return result.ok ? { success: true, status: result.record.status } : { success: false, status: result.error || "RESCHEDULE_FAILED" };
    },
    // §64: never on chat text alone. The confirmation is the gate, and it has no bypass.
    onCancelAppointment: ({ appointmentId, confirmed }) => {
      if (confirmed !== true) return { success: false, status: "CONFIRMATION_REQUIRED" };
      const record = appointmentById(appointmentId);
      if (!record) return { success: false, status: "NOT_FOUND" };
      const result = cancelAppointmentRecord(record, { viaEmmi: true });
      return result.ok ? { success: true, status: result.record.status } : { success: false, status: result.error || "CANCEL_FAILED" };
    },
    onAppointmentReminder: ({ appointmentId, slot, confirmed }) => {
      if (confirmed !== true) return { success: false, status: "CONFIRMATION_REQUIRED" };
      const record = appointmentById(appointmentId);
      if (!record) return { success: false, status: "NOT_FOUND" };
      const result = saveAppointmentReminder(record, slot);
      if (!result.ok) return { success: false, status: result.error || result.status || "REMINDER_FAILED" };
      return { success: true, slot: result.reminder.slot, time: result.reminder.time, channel: result.reminder.channel, note: result.note };
    },
    onCareCircle: () => {
      const options = appointmentCareCircle();
      return {
        allowed: options.allowed,
        reason: options.reason,
        members: options.eligibleMembers.map(({ inviteId, firstName, relationship, status }) => ({ inviteId, firstName, relationship, status }))
      };
    },
    onDescribeView: () => emmiModelView(),
    onPerformViewAction: params => performEmmiViewAction(params),
    onShareAppointment: ({ appointmentId, inviteId, confirmed }) => {
      if (confirmed !== true) return { success: false, status: "CONFIRMATION_REQUIRED" };
      const record = appointmentById(appointmentId);
      if (!record) return { success: false, status: "NOT_FOUND" };
      const result = shareAppointmentWithMember(record, inviteId);
      if (!result.ok) return { success: false, status: result.error || "SHARE_FAILED" };
      return { success: true, status: "SHARED", shares: result.scope.shares, neverShares: result.scope.neverShares };
    },
    onReminder: ({ slot }) => {
      const goal = currentGoal();
      const preference = goal ? saveGoalReminder(goal, slot) : null;
      if (preference) draftStore.save(state);
      return preference;
    }
  });
  emmiTextOrchestrator ||= new EmmiTextOrchestrator({
    getContext: assistantContext,
    getConversation: () => emmiConversationManager?.contextForModel() || {},
    executeTool: (name, args) => emmiTools.execute(name, args),
    screenExplanation: assistantScreenExplanation,
    onSafetyEpisode: episode => emmiConversationManager?.activateSafetyEpisode(episode),
    onSafetyResolved: resolution => emmiConversationManager?.resolveSafetyEpisode(resolution),
    onEvent: (type, details) => {
      emmiAuditLog?.voiceEvent(type, details);
      if (type === "EMMI_ANSWER_ROUTED") emmiAuditLog?.answerTurn({ ...details, promptVersion: "emmi-answer-first-v1" });
      // The enrollment audit trail records that a turn happened and how it was routed, never what
      // the patient typed: the question can carry symptoms, readings or a family member's name.
      // The EMMI audit log above is the deliberate transcript sink and keeps the full detail.
      audit(state, type.toLowerCase(), /FAILED|EMPTY/.test(type) ? "failed" : "success", privacySafeEmmiEventDetails(details));
      if (import.meta.env.DEV && ["EMMI_RETRIEVAL_FAILED", "EMMI_TOOL_FAILED", "EMMI_INTENT_ROUTING_FAILED", "EMMI_EMPTY_GROUNDED_CONTEXT", "EMMI_RESPONSE_GENERATION_FAILED"].includes(type)) console.warn(`[${type}]`, details);
      if (import.meta.env.DEV && type === "EMMI_ANSWER_ROUTED") console.debug("[EMMI retrieval debug]", { intent: details.intent, retrievalQuery: details.retrievalQuery, knowledgeChunkIds: details.knowledgeChunkIds, toolCalls: details.toolCalls, runtimeFactsUsed: details.runtimeFactsUsed, responseMode: details.responseMode });
    }
  });
  emmiLive ||= new EmmiLiveClient({
    getContext: assistantContext,
    executeTool: async (name, args) => { state.assistantVoiceState = "TOOL_RUNNING"; state.assistantVoiceDetail = emmiToolStatusLabel(name); refreshAssistantLayer(); return emmiTools.execute(name, args); },
    onState: (voiceState, detail) => { state.assistantVoiceState = voiceState; state.assistantVoiceDetail = detail || ""; refreshVoiceGuidanceControls(); },
    onTranscript: (role, text, _final, metadata = {}) => {
      const cleaned = sanitizeEmmiTranscript(text); if (!cleaned) return;
      const guidance = role === "assistant" && ["SCREEN_GUIDANCE", "TRANSITION_GUIDANCE"].includes(metadata.priority);
      const last = state.assistantMessages.at(-1);
      // Screen narration is intentionally split into short provider turns so navigation can yield
      // at a safe boundary. It is still one logical message to the patient, so keep all segments
      // with the same narration id in one transcript bubble even after an individual segment has
      // drained. Patient answers continue to group strictly by generation.
      const sameNarration = guidance && metadata.narrationId && last?.guidance && !last.interrupted
        && last.narrationId === metadata.narrationId;
      const sameVoiceTurn = sameNarration || (last?.role === role && last.voice && !last.interrupted && !last.voiceComplete
        && (!metadata.generationId || !last.generationId || last.generationId === metadata.generationId));
      if (sameVoiceTurn) last.text = sanitizeEmmiTranscript(`${last.text} ${cleaned}`);
      else state.assistantMessages.push({ role, text: cleaned, voice: true, voiceComplete: false, guidance, screen: metadata.screenId || state.screen, generationId: metadata.generationId || 0, narrationId: metadata.narrationId || "" });
      // Screen narration is visible context, not a patient/assistant exchange. Keeping it out of
      // model memory prevents a medication prompt from resurfacing on goals or completion screens.
      if (!guidance) emmiConversationManager?.recordTurn(role, cleaned, { screen: state.screen });
      if (role === "assistant") emmiConversationManager?.markGreeted();
      emmiAuditLog.transcript(role, cleaned); if (state.assistantOpen) refreshAssistantLayer();
    },
    onTurnComplete: metadata => {
      const lastMessage = state.assistantMessages.at(-1);
      if (lastMessage?.role === "assistant" && lastMessage.voice) lastMessage.voiceComplete = true;
      emmiTransitionManager?.onTurnComplete(metadata);
    },
    onBargeIn: details => {
      const lastMessage = state.assistantMessages.at(-1);
      if (lastMessage?.role === "assistant" && lastMessage.voice) lastMessage.interrupted = true;
      const narration = emmiTransitionManager?.onPatientInterruption(details) || {};
      const event = { ...details, ...narration };
      emmiAuditLog?.voiceEvent("EMMI_PATIENT_INTERRUPTION", event);
      audit(state, "emmi_patient_interruption", "success", event);
    },
    onVoiceTelemetry: (type, details) => {
      emmiAuditLog?.voiceEvent(type, details);
      audit(state, type.toLowerCase(), "success", details);
    },
    onVoiceIdentity: (type, details) => {
      emmiAuditLog?.voiceEvent(type, details);
      audit(state, type.toLowerCase(), type === "EMMI_VOICE_MISMATCH" ? "blocked" : "success", details);
    },
    onSessionResumption: update => emmiConversationManager?.updateResumption(update),
    onReconnectNeeded: details => {
      emmiConversationManager?.transition(assistantContext(), { technicalReconnect: true });
      emmiAuditLog?.voiceEvent("EMMI_TECHNICAL_RECONNECT", details);
      return emmiConversationManager?.recoveryInstruction() || "Continue without greeting or reintroducing yourself.";
    },
    onError: code => {
      state.assistantVoiceError = code;
      state.assistantVoiceState = "ERROR";
      const voice = emmiLive?.voiceIdentitySnapshot?.() || emmiVoiceMetadata(languageCode(), { sessionId: state.sessionId, screenId: state.screen });
      const details = { errorCode: code, locale: languageCode(), resolvedLanguage: voice.resolvedLanguage, speechLocale: voice.resolvedSpeechLocale, voiceId: voice.voiceId, provider: voice.provider, model: EMMI_CONFIG.model, capability: voice.capability };
      emmiAuditLog?.voiceEvent("EMMI_VOICE_ERROR", details);
      audit(state, "emmi_voice_error", "failed", details);
      if (state.assistantOpen) refreshAssistantLayer();
      refreshVoiceGuidanceControls();
    }
  });
  return { context, tools: emmiTools, orchestrator: emmiTextOrchestrator, live: emmiLive, audit: emmiAuditLog };
}

function emmiScreenContext() {
  const progress = state.offer ? progressFor(state) : { stage: state.screen === "INVITATION" ? "INVITATION" : "YOUR_CARE" };
  return {
    screenId: state.screen,
    stageId: progress.stage,
    locale: languageCode(),
    screenPurpose: buildNarration({ screen: state.screen, locale: languageCode(), runtime: emmiNarrativeRuntime() })?.narrationPurpose || state.screen,
    activeGoal: currentGoal() ? { id: currentGoal().id, title: goalDisplayName(currentGoal(), state.language) } : null,
    nextBestAction: state.offer ? currentNextBestAction() : null
  };
}

function ensureEmmiTransitionManager() {
  if (emmiTransitionManager) return emmiTransitionManager;
  const live = ensureEmmiRuntime().live;
  emmiTransitionManager = new EmmiTransitionManager({
    transport: {
      setActiveContextVersion: version => live.setActiveContextVersion(version),
      currentTurnMeta: () => live.currentTurnMeta(),
      beginGracefulHandoff: options => live.beginGracefulHandoff(options),
      stopPlayback: options => live.stopPlayback(options),
      sendText: (prompt, metadata) => live.sendText(prompt, metadata),
      connect: (prompt, metadata) => {
        state.assistantVoiceError = "";
        live.connect(prompt, metadata).catch(() => { /* The live client publishes a localized safe fallback. */ });
        return true;
      },
      restartAtBoundary: () => { if (live.isActive()) live.disconnect("locale_changed"); }
    },
    getScreenNarration: context => {
      const text = context?.screenId === "INVITATION" ? emmiSpokenWelcome() : emmiGuidanceForScreen(context?.screenId);
      const structured = context?.screenId === "INVITATION"
        ? buildHomeNarration({ locale: context.locale, ...emmiNarrativeRuntime(), allowGreeting: emmiConversationManager?.greetingAllowed() ?? true })
        : buildNarration({ screen: context?.screenId, locale: context?.locale, runtime: emmiNarrativeRuntime() });
      return structured || (text ? { narrationText: text, segments: semanticSpeechSegments(text) } : null);
    },
    getTransitionNarration: ({ previous, current, navigationDirection }) => buildTransitionNarration({
      previousScreen: previous?.screenId,
      currentScreen: current?.screenId,
      locale: current?.locale,
      navigationDirection,
      runtime: { ...emmiNarrativeRuntime(), eligibilityStatus: state.accessOutcome === "eligible" ? "ELIGIBLE" : state.accessOutcome }
    }),
    formatPrompt: emmiGuidancePrompt,
    onVisualContext: (narration, context) => {
      state.emmiGuidanceTranscript = narration?.narrationText || "";
      state.emmiLastGuidanceScreen = context.screenId;
      refreshVoiceGuidanceControls();
    },
    onStatus: status => {
      state.emmiTransitionStatus = status;
      refreshVoiceGuidanceControls();
    },
    onTrace: detail => {
      if (import.meta.env.DEV) console.debug("[EMMI graceful handoff]", detail);
    }
  });
  return emmiTransitionManager;
}

function inferEmmiNavigationDirection(previousScreen, currentScreen, explicit = "") {
  if (explicit) return explicit;
  if (!state.offer) return "FORWARD";
  const journey = journeyFor(state);
  const previousIndex = journey.indexOf(previousScreen);
  const currentIndex = journey.indexOf(currentScreen);
  return previousIndex >= 0 && currentIndex >= 0 && currentIndex < previousIndex ? "BACK" : "FORWARD";
}

function syncEmmiNavigationContext(override = {}) {
  if (!state.emmiVoiceGuidance) return false;
  const manager = ensureEmmiTransitionManager();
  manager.setEnabled(true);
  manager.setPaused(state.emmiVoiceGuidancePaused);
  const previousScreen = manager.snapshot().context?.screenId || "";
  const next = emmiScreenContext();
  const previousContext = manager.snapshot().context;
  const changed = !previousContext || previousContext.screenId !== next.screenId || previousContext.stageId !== next.stageId || previousContext.locale !== next.locale;
  if (!changed) return false;
  const intent = { ...(emmiNavigationIntent || {}), ...override };
  const sideFlows = ["CARE_CIRCLE_INVITE", "CARE_CIRCLE_INVITE_SENT", "CARE_CIRCLE_PERMISSIONS", "MY_CARE_CIRCLE", "MY_CARE_TEAM", "CARE_CIRCLE_REMOVE_CONFIRMATION", "SHARE_ACCESS", "PERSONAL_REPRESENTATIVE_DETAILS", "REPRESENTATIVE_MOBILE_VERIFICATION", "REPRESENTATIVE_AUTHORITY_ATTESTATION", "REPRESENTATIVE_AUTHORITY_ESCALATION"];
  emmiNavigationIntent = null;
  const navigationDirection = inferEmmiNavigationDirection(previousScreen, next.screenId, intent.navigationDirection);
  emmiConversationManager?.transition({ ...assistantContext(), ...next }, { ...intent, navigationDirection });
  manager.updateContext(next, {
    ...intent,
    navigationDirection,
    previousOutcome: intent.previousOutcome || state.accessOutcome,
    currentRuntimeContext: assistantContext(),
    shortReorientation: sideFlows.includes(previousScreen) && !sideFlows.includes(next.screenId)
  });
  return Boolean(previousScreen);
}

// Quick questions are contextual by definition, so they are resolved from the screen and the
// patient's own record in one place rather than assembled inside whichever EMMI surface happens
// to be rendering. Every surface asks the same resolver the same question.
const assistantQuickQuestions = context => getEmmiQuickQuestions({
  currentScreen: context.currentScreen,
  program: context.program,
  locale: languageCode(),
  context
});

function assistantScreenExplanation(screen, context = null) {
  // "What do I do here?" is a question about the view, not about the route. Every step of
  // appointment coordination and barrier resolution lives on one route, so the describer's own
  // sentence — which is written as an instruction for that exact step — is what answers it. The
  // route table below stays as the fallback for the enrollment screens, which are one-to-one.
  const view = context?.view;
  if (view?.whatThePatientMustDoHere) {
    const pending = (view.stillPending || []).filter(Boolean);
    return [view.whatThePatientMustDoHere, pending.length ? `${L("Still to do", "Falta", "Rete pou fè")}: ${pending[0]}.` : ""].filter(Boolean).join(" ");
  }
  const explanations = {
    INVITATION: L("This screen introduces the care support available to you and lets you choose whether to learn more.", "Esta pantalla presenta el apoyo de cuidado disponible y le permite decidir si desea conocer más.", "Ekran sa a entwodui sipò swen ki disponib pou ou epi li pèmèt ou chwazi si pou w aprann plis."),
    DECISION_MAKER: L("This screen asks who is completing the enrollment so we can show the right information.", "Esta pantalla pregunta quién completa la inscripción para mostrar la información correcta.", "Ekran sa a mande ki moun ki ranpli enskripsyon an pou nou ka montre bon enfòmasyon an."),
    IDENTITY_VERIFICATION: state.offer?.physician?.displayName
      ? L(`This helps us securely match you to the care invitation from ${state.offer.physician.displayName}’s care team.`, `Esto nos ayuda a vincularle de forma segura con la invitación de cuidado del equipo de ${state.offer.physician.displayName}.`, `Sa ede nou konekte w an sekirite ak envitasyon swen ekip ${state.offer.physician.displayName} an.`)
      : L("This helps us securely match you to your care invitation using your date of birth and home ZIP code.", "Esto nos ayuda a vincularle de forma segura con su invitación de cuidado usando su fecha de nacimiento y código postal.", "Sa ede nou konekte w an sekirite ak envitasyon swen ou lè l sèvi ak dat nesans ou ak kòd postal lakay ou."),
    CARE_RECOMMENDATION: state.offer?.pathway === "ACCESS" ? L("This screen explains the support included in your ACCESS care at home and between doctor visits.", "Esta pantalla explica el apoyo incluido en su cuidado ACCESS en casa y entre visitas al médico.", "Ekran sa a eksplike sipò ki nan swen ACCESS ou lakay ou ak ant vizit kay doktè.") : L("This screen explains the support recommended for your health needs. You can review it before making any decision.", "Esta pantalla explica el apoyo recomendado para sus necesidades. Puede revisarlo antes de decidir.", "Ekran sa a eksplike sipò yo rekòmande pou bezwen sante w yo. Ou ka revize li anvan w pran nenpòt desizyon."),
    HOW_CARE_WORKS: L("This screen explains how ITERA and your doctor work together between visits.", "Esta pantalla explica cómo ITERA y su médico trabajan juntos entre visitas.", "Ekran sa a eksplike kijan ITERA ak doktè ou travay ansanm ant vizit yo."),
    ACCESS_PRE_ELIGIBILITY_NOTICE: L("This screen explains what Medicare needs you to know before checking whether ACCESS is available to you.", "Esta pantalla explica lo que Medicare necesita que sepa antes de verificar si ACCESS está disponible.", "Ekran sa a eksplike sa Medicare bezwen ou konnen anvan li tcheke si ACCESS disponib pou ou."),
    ACCESS_MEDICARE_IDENTIFIER: L("This screen asks for Medicare information needed to securely complete the eligibility check.", "Esta pantalla solicita la información de Medicare necesaria para completar la verificación de forma segura.", "Ekran sa a mande enfòmasyon Medicare ki nesesè pou konplete chèk kalifikasyon an san danje."),
    ACCESS_ELIGIBILITY_PROCESSING: L("Medicare is securely checking whether this ACCESS care option is available to you.", "Medicare está verificando de forma segura si esta opción ACCESS está disponible para usted.", "Medicare ap verifye an sekirite si opsyon swen ACCESS sa a disponib pou ou."),
    ACCESS_ELIGIBILITY_RESULT: state.accessOutcome === "notEligible" ? L("This result means ACCESS is not available to you right now. It does not change your Medicare benefits or regular care.", "Este resultado significa que ACCESS no está disponible ahora. No cambia sus beneficios ni su cuidado habitual.", "Rezilta sa a vle di ACCESS pa disponib pou ou kounye a. Li pa chanje benefis Medicare ou ni swen nòmal ou.") : L("This result means you may continue reviewing ACCESS. You are not enrolled yet.", "Este resultado significa que puede continuar revisando ACCESS. Aún no está inscrito.", "Rezilta sa a vle di ou ka kontinye revize ACCESS. Ou poko enskri."),
    DISCLOSURE: L("This screen explains important details you should review before deciding whether to enroll.", "Esta pantalla explica detalles importantes que debe revisar antes de decidir si se inscribe.", "Ekran sa a eksplike detay enpòtan ou ta dwe revize anvan ou deside si ou ta dwe enskri."),
    CONSENT_REVIEW: L("This screen summarizes what you are agreeing to. Participation is voluntary, and you can ask questions first.", "Esta pantalla resume lo que está aceptando. La participación es voluntaria y puede preguntar antes.", "Ekran sa a rezime sa w ap dakò a. Patisipasyon an volontè, epi ou ka poze kesyon an premye."),
    HEALTH_INFORMATION_REVIEW: L("This screen shows health information already on file. You can confirm it, report an update without changing the clinical record automatically, or ask for help reviewing it.", "Esta pantalla muestra información médica registrada. Puede confirmarla, informar una actualización sin cambiar automáticamente el registro clínico o pedir ayuda para revisarla.", "Ekran sa a montre enfòmasyon sante ki nan dosye a. Ou ka konfime li, rapòte yon mizajou san chanje dosye klinik la otomatikman, oswa mande èd pou revize li."),
    MEDICATIONS_REVIEW: L("Review each medication on file, tell us whether it is still correct or something changed, and then tell us whether anything is missing. Your answers do not change a prescription automatically.", "Revise cada medicamento registrado, indique si sigue correcto o si algo cambió y luego díganos si falta alguno. Sus respuestas no cambian automáticamente una receta.", "Revize chak medikaman nan dosye a, di nou si li toujou kòrèk oswa si gen yon chanjman, epi di nou si gen youn ki manke. Repons ou yo pa chanje yon preskripsyon otomatikman."),
    GOALS: L("This step shows goals available for your care so you can choose what matters most and personalize practical steps. Your care team remains responsible for clinical decisions.", "Este paso muestra metas disponibles para su cuidado para que elija lo que más le importa y personalice pasos prácticos. Su equipo de atención sigue siendo responsable de las decisiones clínicas.", "Etap sa a montre objektif ki disponib pou swen ou pou ou chwazi sa ki pi enpòtan epi pèsonalize etap pratik. Ekip swen ou rete responsab desizyon klinik yo."),
    MY_GOALS: L("My Goals keeps the goals you chose, your plan, progress, and support requests in one place. These personal goals do not change clinical targets or medical orders.", "Mis metas reúne las metas que eligió, su plan, progreso y solicitudes de apoyo. Estas metas personales no cambian objetivos clínicos ni indicaciones médicas.", "Objektif mwen mete objektif ou chwazi yo, plan ou, pwogrè ou ak demann sipò yo nan yon sèl kote. Objektif pèsonèl sa yo pa chanje sib klinik ni lòd medikal."),
    MY_CARE_TEAM: L("This screen shows the care professionals and organizations ITERA currently has on file as part of your care team.", "Esta pantalla muestra los profesionales y las organizaciones que ITERA tiene registrados como parte de su equipo de cuidado.", "Ekran sa a montre pwofesyonèl ak òganizasyon ITERA genyen nan dosye kòm pati ekip swen ou.")
  };
  return explanations[screen] || L("This screen shows your current enrollment task and what you need to do next.", "Esta pantalla muestra su tarea actual y lo que debe hacer después.", "Ekran sa a montre travay enskripsyon aktyèl ou ak sa ou bezwen fè pwochen.");
}

// The one turn that still needs the app's own state is a confirmation: “yes” carries no words to
// route on, so what it agrees to comes from the action EMMI is holding, not from the question.
async function assistantConfirmationAnswer(context) {
  const runtime = ensureEmmiRuntime();
  if (state.assistantPendingAction === "callback") {
    const result = await runtime.tools.execute("requestCallback", { patientId: context.patientId, reason: "Patient requested help in EMMI", preferredLanguage: context.locale, confirmed: true });
    state.assistantPendingAction = "";
    return { text: result.success ? L("Done. I sent a callback request to the care team.", "Listo. Envié una solicitud para que el equipo de atención le llame.", "Fini. Mwen voye yon demann pou ekip swen an rele ou.") : L("I couldn’t request the call right now. You can call the care team directly.", "No pude solicitar la llamada en este momento. Puede llamar directamente al equipo.", "Mwen pa t kapab mande apèl la kounye a. Ou ka rele ekip swen an dirèkteman.") };
  }
  // §64: a cancellation never follows from chat text. EMMI asks; this is the only place the
  // answer is acted on, and it goes through the same authorization and idempotency as the button.
  if (state.assistantPendingAction === "appointment-cancel") {
    const result = await runtime.tools.execute("cancelAppointment", { appointmentId: state.assistantPendingAppointmentId, confirmed: true });
    state.assistantPendingAction = "";
    const appointmentId = state.assistantPendingAppointmentId;
    state.assistantPendingAppointmentId = "";
    return result.success
      ? { text: L("Your appointment is canceled. If you need another one, I can help you request it.", "Su cita está cancelada. Si necesita otra, puedo ayudarle a solicitarla.", "Randevou ou anile. Si ou bezwen yon lòt, mwen ka ede w mande l."), quickAction: "appointment-view", appointmentId }
      : { text: L("I couldn’t cancel that appointment. Nothing was changed. Your care team can help you with it.", "No pude cancelar esa cita. No se cambió nada. Su equipo de atención puede ayudarle.", "Mwen pa t ka anile randevou sa a. Anyen pa chanje. Ekip swen ou ka ede w."), quickAction: "appointment-view", appointmentId };
  }
  const result = await runtime.tools.execute("createCareTeamTask", { patientId: context.patientId, category: "clinical_review", reason: "Fictional elevated blood pressure reported in prototype", priority: "HIGH", confirmed: true });
  state.assistantPendingAction = "";
  return { text: result.success ? L("Done. I created a high-priority care-team task.", "Listo. Creé una tarea de alta prioridad para el equipo de atención.", "Fini. Mwen kreye yon travay priyorite wo pou ekip swen an.") : L("I couldn’t create the task right now. Please call the care team.", "No pude crear la tarea. Llame al equipo de atención.", "Mwen pa t kapab kreye travay la. Tanpri rele ekip swen an.") };
}

async function assistantAnswer(question, context, { questionId = "" } = {}) {
  const affirmative = /^(yes|yes please|please do|sí|si|wi|dakò)$/i.test(question.trim());
  if (affirmative && state.assistantPendingAction) return assistantConfirmationAnswer(context);
  // The quick question's catalog id travels with the question so a guardrail is reached the same
  // way in every language, rather than through a regex written for the translated label.
  return ensureEmmiRuntime().orchestrator.answer(question, { questionId });
}

const assistantVoiceCopy = () => {
  if (state.assistantVoiceState === "ERROR") return L("Voice is unavailable", "La voz no está disponible", "Vwa pa disponib");
  if (state.assistantVoiceState === "DISCONNECTED") return L("Voice conversation ended", "La conversación por voz terminó", "Konvèsasyon vwa a fini");
  const visibleState = resolveEmmiVisibleState({ internalState: state.assistantVoiceState });
  return emmiVisibleStateLabel(visibleState, languageCode());
};
const assistantVoiceErrorCopyFor = code => ({
  microphone_denied: L("Microphone access was not allowed. You can continue by typing.", "No se permitió el acceso al micrófono. Puede continuar escribiendo.", "Yo pa t bay aksè ak mikwofòn nan. Ou ka kontinye ekri."),
  rate_limited: L("EMMI voice is temporarily busy. You can continue by typing.", "La voz de EMMI está ocupada temporalmente. Puede continuar escribiendo.", "Vwa EMMI okipe pou kounye a. Ou ka kontinye ekri."),
  gemini_not_configured: L("EMMI voice isn’t available right now. You can continue by typing.", "La voz de EMMI no está disponible en este momento. Puede continuar escribiendo.", "Vwa EMMI pa disponib kounye a. Ou ka kontinye ekri."),
  VOICE_UNAVAILABLE_ON_DEVICE: L("Voice isn’t available on this device right now. You can continue by typing.", "La voz no está disponible en este dispositivo por ahora. Puede continuar escribiendo.", "Vwa a pa disponib sou aparèy sa a kounye a. Ou ka kontinye ekri."),
  voice_disabled: L("Voice assistance is turned off. You can continue by typing.", "La asistencia por voz está desactivada. Puede continuar escribiendo.", "Asistans vwa etenn. Ou ka kontinye ekri."),
  voice_locale_fallback: L("Voice guidance isn’t available in this language yet. You can still chat with EMMI in Kreyòl.", "La guía por voz aún no está disponible en este idioma. Puede seguir conversando con EMMI en criollo haitiano.", "Gid vwa poko disponib nan lang sa a. Ou ka toujou pale ak EMMI alekri an Kreyòl."),
  VOICE_UNAVAILABLE_FOR_LOCALE: L("Voice guidance isn’t available in this language yet. You can still chat with EMMI in Kreyòl.", "La guía por voz aún no está disponible en este idioma. Puede seguir conversando con EMMI en criollo haitiano.", "Gid vwa a pa disponib nan lang sa a kounye a. Ou ka kontinye itilize EMMI pa mesaj."),
  VOICE_SESSION_FAILED: L("The voice session could not start. You can continue by typing.", "No se pudo iniciar la sesión de voz. Puede continuar escribiendo.", "Sesyon vwa a pa t kapab kòmanse. Ou ka kontinye ekri."),
  VOICE_PROVIDER_ERROR: L("EMMI voice is temporarily unavailable. You can continue by typing.", "La voz de EMMI no está disponible temporalmente. Puede continuar escribiendo.", "Vwa EMMI pa disponib pou kounye a. Ou ka kontinye ekri."),
  VOICE_RESPONSE_TIMEOUT: L("EMMI took too long to respond. Try again or continue by typing.", "EMMI tardó demasiado en responder. Inténtelo de nuevo o continúe escribiendo.", "EMMI pran twòp tan pou reponn. Eseye ankò oswa kontinye ekri."),
  VOICE_PERMISSION_DENIED: L("Microphone access was not allowed. You can continue by typing.", "No se permitió el acceso al micrófono. Puede continuar escribiendo.", "Yo pa t bay aksè ak mikwofòn nan. Ou ka kontinye ekri."),
  VOICE_RECONNECTING: L("EMMI is reconnecting in your selected language.", "EMMI se está reconectando en el idioma seleccionado.", "EMMI ap rekonekte nan lang ou chwazi a."),
  voice_identity_mismatch: L("Voice guidance is temporarily unavailable. You can continue using EMMI by text.", "La guía por voz no está disponible temporalmente. Puede continuar usando EMMI por texto.", "Gid vwa pa disponib pou yon ti tan. Ou ka kontinye itilize EMMI alekri."),
  session_timeout: L("This voice session ended. Your enrollment progress is saved, and you can start a new session.", "Esta sesión de voz terminó. Su progreso está guardado y puede iniciar otra sesión.", "Sesyon vwa sa a fini. Pwogrè ou anrejistre epi ou ka kòmanse yon lòt sesyon."),
  connection_failed: L("I’m having trouble connecting right now. You can continue by typing or use the enrollment screens.", "Tengo problemas para conectarme. Puede continuar escribiendo o usar las pantallas de inscripción.", "Mwen gen pwoblèm pou konekte. Ou ka kontinye ekri oswa itilize ekran enskripsyon yo."),
  connection_lost: L("Connection lost. You can try again or continue by typing.", "Se perdió la conexión. Puede intentarlo de nuevo o continuar escribiendo.", "Koneksyon an pèdi. Ou ka eseye ankò oswa kontinye ekri.")
})[code] || L("I’m having trouble connecting right now. You can keep using enrollment or continue by typing.", "Tengo problemas para conectarme. Puede seguir con la inscripción o continuar escribiendo.", "Mwen gen pwoblèm pou konekte. Ou ka kontinye enskripsyon an oswa ekri.");
const assistantVoiceErrorCopy = () => assistantVoiceErrorCopyFor(state.assistantVoiceError);

// Resolved from the central EMMI message config at call time, so the welcome always follows
// the language the patient has selected right now — including on "Repeat".
function emmiSpokenWelcome() {
  // Home carries the fullest narration of the journey: it introduces the actual program the
  // patient was invited to, why it exists and how it can help, not a generic greeting.
  return buildHomeNarration({ locale: languageCode(), ...emmiNarrativeRuntime(), allowGreeting: emmiConversationManager?.greetingAllowed() ?? true }).narrationText;
}

function emmiGuidanceForScreen(screen = state.screen) {
  // EMMI explains the screen's purpose, not its labels. Everything comes from the shared
  // narrative engine so voice and text say the same thing, in the patient's active language.
  if (screen === "GOALS") {
    const goal = patientGoalById(state.goalPlanningGoalId || state.goalPrimaryId);
    const goalName = goal ? goalDisplayName(goal, state.language) : "";
    if (state.goalFlowStep === "PRIORITY") return L("You chose more than one goal. Pick the one that matters most right now, and a second one only if that feels helpful. You can change these priorities later.", "Eligió más de una meta. Seleccione la que más le importa ahora y una segunda solo si le resulta útil. Puede cambiar estas prioridades después.", "Ou chwazi plis pase yon objektif. Chwazi sa ki pi enpòtan kounye a, epi yon dezyèm sèlman si sa itil. Ou ka chanje priyorite sa yo pita.");
    if (state.goalFlowStep === "PLAN_OFFER") return goal?.goalSource === "PATIENT"
      ? L(`You added ${goalName} as a personal goal. You can personalize a few realistic steps now or continue later with your care team.`, `Agregó ${goalName} como una meta personal. Puede personalizar algunos pasos realistas ahora o continuar después con su equipo de atención.`, `Ou ajoute ${goalName} kòm yon objektif pèsonèl. Ou ka pèsonalize kèk etap reyalis kounye a oswa kontinye pita ak ekip swen ou.`)
      : L(`This goal was available for your care, and you chose ${goalName} as a priority. You can personalize a few realistic steps now or continue later with your care team.`, `Esta meta estaba disponible para su cuidado y eligió ${goalName} como prioridad. Puede personalizar algunos pasos realistas ahora o continuar después con su equipo de atención.`, `Objektif sa a te disponib pou swen ou, epi ou chwazi ${goalName} kòm priyorite. Ou ka pèsonalize kèk etap reyalis kounye a oswa kontinye pita ak ekip swen ou.`);
    if (["PLAN_ACTIONS", "PLAN_REVIEW"].includes(state.goalFlowStep)) return L("Choose only the steps that feel realistic for you. These are optional ways to personalize your routine, not medical orders. Clinical decisions remain with your care team.", "Elija solo los pasos que le parezcan realistas. Son formas opcionales de personalizar su rutina, no indicaciones médicas. Las decisiones clínicas siguen a cargo de su equipo de atención.", "Chwazi sèlman etap ki reyalis pou ou. Se fason opsyonèl pou pèsonalize woutin ou, yo pa lòd medikal. Desizyon klinik yo rete ak ekip swen ou.");
  }
  const narration = buildNarration({ screen, locale: languageCode(), runtime: emmiNarrativeRuntime() });
  return narration?.narrationText || "";
}

// Only facts the runtime actually knows are handed to the narration. A missing value simply
// removes that sentence rather than inviting the model to invent one.
function emmiNarrativeRuntime() {
  const action = state.offer ? currentNextBestAction() : null;
  return {
    program: state.offer?.pathway,
    programDisplayName: localized(programDisclosureConfig(state.offer?.pathway)?.displayName) || state.offer?.program || "",
    providerReferral: isProviderReferralSource(state.offer?.enrollmentSource),
    physicianDisplayName: state.offer?.physician?.displayName || state.offer?.referringProvider?.name || "",
    medicationCount: Array.isArray(state.careMedications) ? state.careMedications.filter(item => item.active).length : null,
    deviceVendor: state.deviceVerificationStatus === "VERIFIED" || state.patientDeviceConfirmed ? state.deviceVendor || null : null,
    deviceConfirmed: Boolean(state.patientDeviceConfirmed || state.deviceVerificationStatus === "SOURCE_VERIFIED"),
    enrollmentStatus: state.enrollmentStatus,
    completionRole: state.completionRole,
    nextStepLabel: action ? localized(action.label) : null
  };
}


const emmiGuidancePrompt = message => {
  const continuity = emmiConversationManager?.contextForModel();
  const guarded = emmiConversationManager?.guardAssistantText(message, { source: "screen_guidance" }) || message;
  const rule = continuity?.greetingAllowed
    ? "This is the initial introduction; one brief greeting is allowed."
    : `This is conversation mode ${continuity?.conversationMode || "CONTINUATION"}. The current screen is ${continuity?.currentScreen || state.screen}. Do not greet, reintroduce yourself, restart, or repeat content from an earlier screen unless NARRATION_TEXT explicitly contains it.`;
  return L(
    `${rule} Read only the NARRATION_TEXT value below once, in a calm, warm, unhurried voice. Do not read field names, instructions, markup, or earlier conversation. Do not paraphrase, expand, answer, add a greeting, add a question, or repeat any sentence. NARRATION_TEXT=${JSON.stringify(guarded)}`,
    `${rule} Lea solamente el valor NARRATION_TEXT una vez, con voz tranquila, cálida y sin prisa. No lea nombres de campos, instrucciones, etiquetas ni conversaciones anteriores. No parafrasee, amplíe, responda, salude, haga preguntas ni repita frases. NARRATION_TEXT=${JSON.stringify(guarded)}`,
    `${rule} Li sèlman valè NARRATION_TEXT la yon sèl fwa, ak yon vwa kalm, cho, san prese. Pa li non chan, enstriksyon, etikèt oswa ansyen konvèsasyon. Pa chanje, elaji, reponn, salye, poze kesyon oswa repete fraz. NARRATION_TEXT=${JSON.stringify(guarded)}`
  );
};

// EMMI is introduced on the Home screen. Everywhere after it, this is a compact contextual
// control that must not compete with the screen's own question.
// After Home, EMMI is a contextual guide rather than an introduction card: identity and live
// status stay visible, one contextual action remains direct, and secondary controls expand
// only on request. The task stays the visual priority.
function emmiGuideState() {
  return resolveEmmiVisibleState({
    internalState: state.assistantVoiceState,
    transitionStatus: state.emmiTransitionStatus,
    voiceEnabled: state.emmiVoiceGuidance,
    voiceSupported: emmiVoiceIsSupported(languageCode()),
    paused: state.emmiVoiceGuidancePaused,
    hasError: state.assistantVoiceState === "ERROR" || (state.assistantVoiceState === "DISCONNECTED" && Boolean(state.assistantVoiceError))
  });
}

const emmiGuideStatusLabel = guideState => emmiVisibleStateLabel(guideState, languageCode());

// One label vocabulary for every EMMI surface. "Voice options" replaces "Controls" because the
// label itself has to tell a Medicare patient what they will find: Ask EMMI is "I want to say
// something", Voice options is "I want to change how EMMI speaks to me".
const emmiLabels = () => ({
  ask: L("Ask EMMI", "Preguntar a EMMI", "Mande EMMI"),
  talk: L("Talk to EMMI", "Hablar con EMMI", "Pale ak EMMI"),
  voiceOptions: L("Voice options", "Opciones de voz", "Opsyon vwa"),
  guideMe: L("Guide by voice", "Guía por voz", "Gide ak vwa"),
  pause: L("Pause", "Pausar", "Poze"),
  resume: L("Resume", "Reanudar", "Rekòmanse"),
  repeat: L("Repeat", "Repetir", "Repete"),
  turnOff: L("Turn voice off", "Desactivar guía por voz", "Etenn gid vwa a"),
  read: L("Read message", "Leer mensaje", "Li mesaj la"),
  hide: L("Hide message", "Ocultar mensaje", "Kache mesaj la"),
  close: L("Close", "Cerrar", "Fèmen"),
  // Closing EMMI is closing EMMI, never leaving enrollment: the patient has not gone anywhere.
  closeEmmi: L("Close EMMI", "Cerrar EMMI", "Fèmen EMMI"),
  mute: L("Mute", "Silenciar", "Etenn mikwofòn"),
  unmute: L("Unmute", "Activar micrófono", "Limen mikwofòn"),
  retry: L("Try again", "Intentar de nuevo", "Eseye ankò")
});

const emmiGuidanceTranscriptText = () => state.emmiGuidanceTranscript
  || buildNarration({ screen: state.screen, locale: languageCode(), runtime: emmiNarrativeRuntime() })?.narrationText
  || "";

// Voice options only ever controls the voice experience. It is deliberately not a settings
// menu: no account, program or knowledge options belong here.
// One set of voice controls, wherever the patient opens Voice options from. The expanded panel
// adds the microphone, because that is the only surface where a live conversation is in front of
// the patient and muting themselves is something they may need mid-sentence.
function emmiVoiceOptionRows(guideState, { includeMute = false } = {}) {
  const labels = emmiLabels();
  const transcript = emmiGuidanceTranscriptText();
  const busy = ["SPEAKING", "THINKING", "UPDATING"].includes(guideState);
  return `<div class="emmi-sheet-actions">
      <button type="button" data-action="toggle-emmi-guidance-pause">${icon(guideState === "PAUSED" ? "play" : "pause", "emmi-sheet-icon")}<span>${guideState === "PAUSED" ? labels.resume : labels.pause}</span></button>
      <button type="button" data-action="repeat-emmi-guidance" ${busy ? "disabled" : ""}>${icon("rotate", "emmi-sheet-icon")}<span>${labels.repeat}</span></button>
      ${includeMute ? `<button type="button" data-assistant-action="mute" aria-pressed="${state.assistantVoiceMuted}">${icon(state.assistantVoiceMuted ? "micOff" : "mic", "emmi-sheet-icon")}<span>${state.assistantVoiceMuted ? labels.unmute : labels.mute}</span></button>` : ""}
      ${transcript ? `<button type="button" data-action="toggle-emmi-transcript" aria-expanded="${state.emmiTranscriptOpen}" aria-controls="emmi-guide-transcript">${icon("document", "emmi-sheet-icon")}<span>${state.emmiTranscriptOpen ? labels.hide : labels.read}</span></button>` : ""}
    </div>
    ${state.emmiTranscriptOpen && transcript ? `<p class="emmi-guide-transcript" id="emmi-guide-transcript">${escapeHtml(transcript)}</p>` : ""}
    <button type="button" class="emmi-sheet-tertiary" data-action="disable-emmi-guidance">${icon("micOff", "emmi-sheet-icon")}<span>${labels.turnOff}</span></button>`;
}

// Both bottom sheets share one shell so focus handling, dismissal and sizing stay identical.
function emmiBottomSheet({ id, title, status, body }) {
  return `<div class="emmi-sheet-backdrop" data-action="close-emmi-sheet" aria-hidden="true"></div><section class="emmi-sheet" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
    <div class="emmi-sheet-handle" aria-hidden="true"></div>
    <div class="emmi-sheet-heading"><div><strong id="${id}-title">${title}</strong><span>${status}</span></div><button type="button" class="emmi-sheet-close" data-action="close-emmi-sheet" aria-label="${emmiLabels().close} ${title}">×</button></div>
    ${body}
    <button type="button" class="emmi-sheet-done" data-action="close-emmi-sheet">${emmiLabels().close}</button>
  </section>`;
}

function emmiVoiceOptionsSheet(guideState) {
  return emmiBottomSheet({
    id: "emmi-voice-options",
    title: emmiLabels().voiceOptions,
    status: emmiGuideStatusLabel(guideState),
    body: emmiVoiceOptionRows(guideState)
  });
}

// EMMI is introduced on the Home screen. Everywhere after it this is the compact card: EMMI's
// identity and live status stay visible, one conversational action stays direct, and everything
// about how EMMI speaks moves behind a single, plainly named button.
function voiceGuidancePanel() {
  if (state.screen === "INVITATION") return "";
  const labels = emmiLabels();
  const guideLabel = L("EMMI contextual guidance", "Orientación contextual de EMMI", "Gid kontèks EMMI");
  const guideState = emmiGuideState();
  const sheet = state.emmiVoiceOptionsOpen ? emmiVoiceOptionsSheet(guideState) : "";

  // Voice off, or a language EMMI cannot speak: never offer Voice options, because there is no
  // voice guidance to adjust yet. Ask EMMI stays available either way.
  if (guideState === "OFF" || guideState === "UNSUPPORTED") {
    const canEnable = guideState === "OFF" && emmiVoiceIsSupported(languageCode());
    return `<section class="emmi-guide emmi-guide-off" data-guide-state="${guideState}" aria-label="${guideLabel}">
      <div class="emmi-guide-row"><img class="emmi-guide-avatar" src="/assets/emmi-assistant.png" alt=""><div class="emmi-guide-copy"><strong>EMMI</strong><span class="emmi-guide-off-copy">${emmiGuideStatusLabel(guideState)}</span></div></div>
      <div class="emmi-guide-off-actions"><button type="button" class="emmi-guide-button" data-action="help" data-emmi-source="compact" aria-haspopup="dialog">${labels.ask}</button>${canEnable ? `<button type="button" class="emmi-guide-button emmi-guide-button-lead" data-action="enable-emmi-guidance">${icon("mic", "emmi-guide-button-icon")}<span>${labels.guideMe}</span></button>` : ""}</div>
      ${canEnable ? "" : `<p class="emmi-guide-voice-unavailable" role="status">${assistantVoiceErrorCopyFor("VOICE_UNAVAILABLE_FOR_LOCALE")}</p>`}
      ${sheet}
    </section>`;
  }

  // With voice on the pair is always Ask EMMI and Voice options, so the buttons under a 65+
  // patient's thumb never change label as EMMI speaks, listens or thinks. Pause lives inside
  // Voice options — except while paused, where Resume is the only way back and has to be in
  // reach without opening anything first.
  const primary = guideState === "PAUSED"
    ? `<button type="button" class="emmi-guide-primary" data-action="toggle-emmi-guidance-pause">${labels.resume}</button>`
    : `<button type="button" class="emmi-guide-primary" data-action="help" data-emmi-source="compact" aria-haspopup="dialog">${labels.ask}</button>`;
  const retry = guideState === "ERROR" ? `<button type="button" data-action="repeat-emmi-guidance">${labels.retry}</button>` : "";
  const voiceOptions = guideState === "ERROR" ? "" : `<button type="button" class="emmi-guide-voice-options" data-action="open-emmi-voice-options" aria-haspopup="dialog" aria-expanded="${state.emmiVoiceOptionsOpen}">${icon("audioLines", "emmi-guide-control-icon")}<span>${labels.voiceOptions}</span></button>`;
  return `<section class="emmi-guide" data-guide-state="${guideState}" aria-label="${guideLabel}">
    <div class="emmi-guide-row">
      <img class="emmi-guide-avatar" src="/assets/emmi-assistant.png" alt="">
      <div class="emmi-guide-copy"><strong>EMMI</strong><span role="status" aria-live="polite">${emmiGuideStatusLabel(guideState)}${guideState === "SPEAKING" ? `<i class="emmi-audio-activity" aria-hidden="true"><b></b><b></b><b></b></i>` : ""}</span></div>
    </div>
    <div class="emmi-guide-actions">${primary}${retry}${voiceOptions}</div>
    ${sheet}
  </section>`;
}

// One controller decides which EMMI the patient is looking at. Its inputs are the screen, whether
// EMMI's anchor — the Home introduction card or the compact card — is still in the viewport, and
// whether the expanded panel is open. Its output is exactly one presentation, so no component
// ever has to decide for itself and no two of them can appear together.
const EMMI_PRESENTATION = { HOME_INTRO: "HOME_INTRO", COMPACT: "COMPACT", FLOATING: "FLOATING", EXPANDED: "EXPANDED", NONE: "NONE" };

// Home introduces EMMI in full; every screen after it carries the compact card. Whichever one the
// screen has is the anchor the floating pill hands off with.
const emmiAnchorElement = () => document.querySelector(".emmi-welcome, .emmi-guide");

// The handoff happens only once the card has left the viewport completely: any part of it still on
// screen keeps the pill away, so the patient never sees two EMMIs at once.
function emmiAnchorIsVisible() {
  const anchor = emmiAnchorElement();
  if (!anchor) return false;
  const box = anchor.getBoundingClientRect();
  return Boolean(box.height) && box.bottom > 0 && box.top < innerHeight;
}

function emmiPresentationMode() {
  if (state.assistantOpen) return EMMI_PRESENTATION.EXPANDED;
  if (state.emmiVoiceOptionsOpen) return state.screen === "INVITATION" ? EMMI_PRESENTATION.HOME_INTRO : EMMI_PRESENTATION.COMPACT;
  if (emmiAnchorIsVisible()) return state.screen === "INVITATION" ? EMMI_PRESENTATION.HOME_INTRO : EMMI_PRESENTATION.COMPACT;
  return EMMI_PRESENTATION.FLOATING;
}

// The pill never sits on top of anything the patient acts on or reads for orientation: at 384px a
// fixed overlay and a full-width Continue button cannot share the same corner. It does not yield
// for every paragraph — on a long text screen that would hide EMMI entirely, which is worse than a
// pill resting beside a line of body copy.
const FLOATING_EMMI_BLOCKERS = "#screen-content button,#screen-content a,#screen-content input,#screen-content select,#screen-content textarea,#screen-content label,#screen-content .button,#screen-content h1,#screen-content h2,#screen-content h3,#screen-content .contextual-assurance,#screen-content .contact-line";

const floatingEmmiBlockedBy = box => [...document.querySelectorAll(FLOATING_EMMI_BLOCKERS)]
  .map(node => node.getBoundingClientRect())
  .filter(rect => rect.width && rect.height && box.right > rect.left && box.left < rect.right && box.bottom > rect.top && box.top < rect.bottom);

// The button is fixed so it does not scroll away with the content, which means the browser
// positions it against the viewport rather than the patient shell. On a desktop preview that put
// the avatar out on the page background beside the phone. Measuring the shell and handing CSS its
// real edges binds it to the patient UI at any shell width, centred or not, without assuming 384px.
function syncEmmiShellBounds() {
  const shell = document.querySelector(".patient-app-shell");
  if (!shell) return;
  const rect = shell.getBoundingClientRect();
  // Set on the document root, not the shell: a render replaces the shell element and would take
  // any inline property with it, dropping the avatar back onto the page background.
  const root = document.documentElement.style;
  root.setProperty("--emmi-shell-right-inset", `${Math.max(0, Math.round(innerWidth - rect.right))}px`);
  root.setProperty("--emmi-shell-bottom-inset", `${Math.max(0, Math.round(innerHeight - rect.bottom))}px`);
}

// Given the choice, EMMI moves rather than disappears: landing on the support phone number or the
// page's own CTA, the pill steps up above it and checks again. Only when there is nowhere left to
// stand does it hand the corner back to the screen entirely.
function placeFloatingEmmi(floating) {
  // Where the patient dragged EMMI is where EMMI stays: the automatic lift only applies to the
  // resting position the layout chose.
  if (floating.style.top) return !floatingEmmiBlockedBy(floating.getBoundingClientRect()).length;
  floating.style.transform = "";
  let box = floating.getBoundingClientRect();
  let lift = 0;
  // A step at a time, above whatever it is standing on. EMMI belongs in the lower part of the
  // screen where a thumb reaches her, so a pill that would have to climb past that is no longer
  // floating in a useful place and stands down instead.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const blocked = floatingEmmiBlockedBy(box);
    if (!blocked.length) return true;
    lift += Math.round(box.bottom - Math.min(...blocked.map(rect => rect.top)) + 12);
    floating.style.transform = `translateY(${-lift}px)`;
    box = floating.getBoundingClientRect();
    if (box.top < Math.max(12, innerHeight * 0.3)) break;
  }
  floating.style.transform = "";
  return false;
}

let emmiIntroReported = false;
let emmiFloatingReported = false;
function syncEmmiPresentation() {
  // Re-measure before placing: a resize or a re-render can have moved the shell's edges.
  syncEmmiShellBounds();
  const mode = emmiPresentationMode();
  const shell = document.querySelector(".shell");
  const floating = document.querySelector(".emmi-assistant");
  const publish = resolved => shell?.setAttribute("data-emmi-presentation", resolved);
  if (mode === EMMI_PRESENTATION.HOME_INTRO) {
    // The introduction card says "Hi, I am EMMI" on the patient's behalf. Once they have seen it,
    // the expanded panel continues that conversation instead of introducing her a second time.
    state.emmiIntroSeen = true;
    if (!emmiIntroReported) {
      emmiIntroReported = true;
      audit(state, "emmi_intro_visible", "success", { screen: state.screen });
    }
  }
  if (mode !== EMMI_PRESENTATION.FLOATING) {
    floating?.classList.add("emmi-assistant-suppressed");
    emmiFloatingReported = false;
    publish(mode);
    return;
  }
  if (!floating) { publish(EMMI_PRESENTATION.NONE); return; }
  floating.classList.remove("emmi-assistant-suppressed");
  const placed = placeFloatingEmmi(floating);
  floating.classList.toggle("emmi-assistant-suppressed", !placed);
  publish(placed ? EMMI_PRESENTATION.FLOATING : EMMI_PRESENTATION.NONE);
  if (!placed) { emmiFloatingReported = false; return; }
  if (emmiFloatingReported) return;
  emmiFloatingReported = true;
  audit(state, "emmi_floating_shown", "success", { screen: state.screen });
}

// Scrolling is what moves EMMI between presentations, so the handoff is recalculated on every
// scroll and resize rather than only when a screen renders. IntersectionObserver watches the
// anchor itself, which reports the crossing far more cheaply and precisely than scroll alone.
let emmiPresentationSyncQueued = false;
function scheduleEmmiPresentationSync() {
  if (emmiPresentationSyncQueued) return;
  emmiPresentationSyncQueued = true;
  requestAnimationFrame(() => { emmiPresentationSyncQueued = false; syncEmmiPresentation(); });
}

// A preview pane resizing, a devtools viewport switch or content reflow all move the edges the
// avatar is measured against without firing a window resize.
let emmiShellResizeObserver = null;
function observeEmmiShellBounds() {
  if (typeof ResizeObserver === "undefined") return;
  const shell = document.querySelector(".patient-app-shell");
  emmiShellResizeObserver?.disconnect();
  if (!shell) { emmiShellResizeObserver = null; return; }
  emmiShellResizeObserver = new ResizeObserver(() => scheduleEmmiPresentationSync());
  emmiShellResizeObserver.observe(shell);
}

let emmiAnchorObserver = null;
function observeEmmiAnchor() {
  if (typeof IntersectionObserver === "undefined") return;
  emmiAnchorObserver ||= new IntersectionObserver(() => scheduleEmmiPresentationSync(), { threshold: 0 });
  emmiAnchorObserver.disconnect();
  const anchor = emmiAnchorElement();
  if (anchor) emmiAnchorObserver.observe(anchor);
}

if (typeof window !== "undefined") {
  addEventListener("scroll", scheduleEmmiPresentationSync, { passive: true });
  addEventListener("resize", scheduleEmmiPresentationSync);
  addEventListener("orientationchange", scheduleEmmiPresentationSync);
  // Escape closes whichever EMMI is open, wherever focus happens to be: the patient may have
  // opened it from the pill and never moved focus inside it.
  addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (state.assistantOpen) { event.preventDefault(); closeAssistant(); return; }
    if (!state.emmiVoiceOptionsOpen) return;
    event.preventDefault();
    closeEmmiSheets();
  });
  // Opening EMMI is a state change, not a journey step, so Back closes the panel and leaves the
  // patient exactly where they were instead of walking them out of enrollment.
  addEventListener("popstate", () => {
    if (!state.assistantOpen) return;
    emmiOverlayHistoryEntry = false;
    closeAssistant({ fromHistory: true });
  });
}

// The floating pill carries EMMI's name and live state rather than a bare avatar: the patient
// has to be able to tell at a glance that this is EMMI and what she is doing right now.
const emmiFloatingStatus = () => {
  const visibleState = emmiGuideState();
  return [EMMI_VISIBLE_STATE.LISTENING, EMMI_VISIBLE_STATE.SPEAKING, EMMI_VISIBLE_STATE.THINKING].includes(visibleState)
    ? emmiVisibleStateLabel(visibleState, languageCode())
    : "";
};

// One close path for the voice options sheet, so dismissal, transcript state, body scroll lock
// and focus return can never drift apart between the surfaces that open it.
function closeEmmiSheets({ returnFocus = true } = {}) {
  const trigger = emmiSheetReturnAction;
  state.emmiVoiceOptionsOpen = false;
  state.emmiTranscriptOpen = false;
  refreshVoiceGuidanceControls();
  if (returnFocus) requestAnimationFrame(() => document.querySelector(`[data-action="${trigger}"]`)?.focus({ preventScroll: true }));
}

// A modal sheet that leaks focus back to the page behind it is unusable with a screen reader
// or a keyboard, so Tab cycles inside it. Escape is handled globally, since the patient may
// never have moved focus into the sheet at all.
function trapFocusWithin(container) {
  container.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const focusable = [...container.querySelectorAll("button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex='-1'])")];
    if (!focusable.length) return;
    const [first, last] = [focusable[0], focusable[focusable.length - 1]];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
}

function refreshVoiceGuidanceControls() {
  const current = document.querySelector(".emmi-guide");
  if (current) {
    current.outerHTML = voiceGuidancePanel();
    // The replacement nodes carry no listeners, so Pause / Repeat / Ask EMMI / Turn off would
    // silently stop working after the first voice-state update without this rebind.
    const replacement = document.querySelector(".emmi-guide");
    if (replacement) {
      bindActions(replacement);
      const sheet = replacement.querySelector(".emmi-sheet");
      if (sheet) trapFocusWithin(sheet);
    }
    document.body.classList.toggle("emmi-sheet-open", Boolean(state.emmiVoiceOptionsOpen));
    observeEmmiAnchor();
  observeEmmiShellBounds();
    scheduleEmmiPresentationSync();
  }
  const welcome = document.querySelector(".emmi-welcome-choice");
  if (welcome) {
    welcome.dataset.voiceState = state.assistantVoiceState;
    const status = welcome.querySelector("p strong");
    if (status) status.textContent = emmiHomeVoiceStatus();
    // The failure reason arrives after this card was rendered, so patch it in rather than
    // leaving the patient with a bare "unavailable" and no explanation.
    const unavailable = state.assistantVoiceState === "ERROR" || (state.assistantVoiceState === "DISCONNECTED" && state.assistantVoiceError);
    let reason = welcome.querySelector(".emmi-welcome-error");
    if (unavailable && !reason && status) {
      reason = document.createElement("small");
      reason.className = "emmi-welcome-error";
      status.after(reason);
    }
    if (reason) {
      reason.textContent = unavailable ? assistantVoiceErrorCopy() : "";
      reason.hidden = !unavailable;
    }
    const repeat = welcome.querySelector('[data-action="repeat-emmi-guidance"]');
    if (repeat) {
      repeat.disabled = emmiGuidanceIsBusy();
      repeat.setAttribute("aria-disabled", String(repeat.disabled));
    }
  }
  // The expanded panel shows the same voice state through the same controls, so it is refreshed
  // from here too rather than by every caller remembering to.
  if (state.assistantOpen) refreshAssistantLayer();
}

function deliverEmmiGuidance(message, screen = state.screen, { connect = false } = {}) {
  if (!message || !state.emmiVoiceGuidance || state.emmiVoiceGuidancePaused) return;
  state.emmiGuidanceTranscript = message;
  refreshVoiceGuidanceControls();
  const manager = ensureEmmiTransitionManager();
  manager.setEnabled(true);
  manager.setPaused(false);
  if (!manager.snapshot().context) manager.updateContext(emmiScreenContext());
  if (!connect && ["DISCONNECTED", "ERROR"].includes(state.assistantVoiceState)) return;
  // Welcomes and enrollment celebrations are each one provider turn. Splitting either into
  // separate generative prompts invites the model to reopen the greeting after every clause.
  const cohesiveGuidance = ["INVITATION", "ENROLLMENT_CONFIRMED"].includes(screen);
  const segments = cohesiveGuidance ? [message] : semanticSpeechSegments(message);
  manager.speak({ narrationText: message, segments }, { connect, kind: "SCREEN_GUIDANCE", screenId: screen, contextVersion: manager.contextVersion });
  state.emmiLastGuidanceScreen = screen;
  audit(state, "emmi_voice_guidance", screen, { locale: state.language });
}

function scheduleEmmiGuidance() {
  clearTimeout(emmiGuidanceTimer);
  if (!state.emmiVoiceGuidance || state.emmiVoiceGuidancePaused || state.screen === "INVITATION" || state.emmiLastGuidanceScreen === state.screen) return;
  const message = emmiGuidanceForScreen();
  if (!message) return;
  const attempt = retries => {
    if (state.screen === "INVITATION" || state.emmiLastGuidanceScreen === state.screen || !state.emmiVoiceGuidance || state.emmiVoiceGuidancePaused) return;
    const activeField = document.activeElement?.matches?.("input, textarea, select, [contenteditable='true']");
    if (activeField || ["INTERRUPTING", "USER_SPEAKING", "EMMI_SPEAKING", "EMMI_THINKING", "TOOL_RUNNING", "CONNECTING"].includes(state.assistantVoiceState)) {
      if (retries < 15) emmiGuidanceTimer = setTimeout(() => attempt(retries + 1), 1000);
      return;
    }
    const manager = ensureEmmiTransitionManager();
    if (["PLAYING", "TRANSITIONING", "GENERATING", "STALE", "INTERRUPTED"].includes(manager.snapshot().narration?.status)) return;
    deliverEmmiGuidance(message, state.screen);
  };
  emmiGuidanceTimer = setTimeout(() => attempt(0), 700);
}


// The expanded panel is EMMI in full, opened over the screen the patient is already on. It is a
// presentation of the same assistant — same session, same voice, same conversation — never a
// place the patient travelled to, so it greets nobody and closing it changes nothing.
const assistantHeroCopy = screen => ({
  MY_GOALS: L("Ask me about your goals, your readings, or what to do next.", "Pregúnteme sobre sus metas, sus lecturas o el siguiente paso.", "Mande m sou objektif ou, lekti ou yo, oswa pwochen etap la."),
  GOALS: L("Ask me about your goals, your readings, or what to do next.", "Pregúnteme sobre sus metas, sus lecturas o el siguiente paso.", "Mande m sou objektif ou, lekti ou yo, oswa pwochen etap la."),
  MEDICATIONS_REVIEW: L("Ask me about your medications or this review.", "Pregúnteme sobre sus medicamentos o esta revisión.", "Mande m sou medikaman ou yo oswa revizyon sa a."),
  HEALTH_INFORMATION_REVIEW: L("Ask me about your health information or this review.", "Pregúnteme sobre su información de salud o esta revisión.", "Mande m sou enfòmasyon sante ou oswa revizyon sa a."),
  MY_CARE: L("Ask me anything about your care.", "Pregúnteme lo que quiera sobre su cuidado.", "Mande m nenpòt bagay sou swen ou.")
})[screen] || L("I can help you understand your ACCESS care, manage your health, and know what to do next.", "Puedo ayudarle a entender su cuidado ACCESS, cuidar su salud y saber qué hacer después.", "Mwen ka ede w konprann swen ACCESS ou, jere sante ou, epi konnen kisa pou w fè apre.");

// One conversation entry, not two competing ones: a single voice control that reflects the voice
// state the patient already has, and a single question field. Nothing here restarts a session or
// offers to enable something that is already running.
function assistantVoiceEntry(guideState) {
  if (!EMMI_CONFIG.enableVoice) return "";
  const labels = emmiLabels();
  if (!emmiVoiceIsSupported(languageCode())) return `<div class="assistant-voice-error assistant-voice-capability" role="status">${icon("info")}<span>${assistantVoiceErrorCopyFor("VOICE_UNAVAILABLE_FOR_LOCALE")}</span></div>`;
  // A session the patient can hear counts as voice being on, whatever the guidance preference says
  // — the panel reports what is happening rather than what was configured.
  const live = !["DISCONNECTED", "ERROR"].includes(state.assistantVoiceState);
  if (!live && ["OFF", "ERROR", "UNSUPPORTED"].includes(guideState)) return `<button class="assistant-talk-button" type="button" data-assistant-action="start-voice">${icon("mic")}<strong>${labels.talk}</strong></button>`;
  // A running tool has already produced patient-facing words for what EMMI is doing. They were
  // being computed and then thrown away, so the patient read "speak naturally" while EMMI was busy
  // looking their cost up.
  const toolStatus = state.assistantVoiceState === "TOOL_RUNNING" && state.assistantVoiceDetail && state.assistantVoiceDetail !== "prototype_visual_preview"
    ? state.assistantVoiceDetail
    : "";
  const detail = state.assistantVoiceDetail === "session_ending_soon"
    ? L("This voice session will end soon, but your enrollment progress is saved.", "Esta sesión terminará pronto, pero su progreso está guardado.", "Sesyon vwa sa a pral fini byento, men pwogrè ou anrejistre.")
    : toolStatus || L("Speak naturally. You can interrupt EMMI.", "Hable con naturalidad. Puede interrumpir a EMMI.", "Pale nòmalman. Ou ka entèwonp EMMI.");
  return `<section class="assistant-voice-state" data-voice-state="${state.assistantVoiceState}">
      <div class="assistant-voice-state-row"><span class="assistant-voice-orb">${icon(state.assistantVoiceMuted ? "micOff" : "mic")}</span><div><strong role="status" aria-live="polite">${live ? assistantVoiceCopy() : emmiGuideStatusLabel(guideState)}</strong><small>${detail}</small></div></div>
      <button type="button" class="assistant-voice-options-toggle" data-assistant-action="voice-options" aria-expanded="${state.assistantVoiceOptionsOpen}" aria-controls="assistant-voice-options">${icon("audioLines")}<span>${labels.voiceOptions}</span></button>
      ${state.assistantVoiceOptionsOpen ? `<div class="assistant-voice-options" id="assistant-voice-options">${emmiVoiceOptionRows(guideState, { includeMute: live })}</div>` : ""}
    </section>`;
}

// Chat avatars. EMMI wears her brandmark, the same one the floating pill and the guide row use, so
// the patient recognises her wherever she appears. Enrollment never asks a patient for a picture, so
// the patient side shows the record photo when one exists and falls back to initials.
const patientChatInitials = () => {
  const parts = String(state.offer?.patient?.displayName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0].slice(0, 2)).toUpperCase();
};

const assistantMessageAvatar = role => {
  if (role !== "user") return `<span class="assistant-message-avatar emmi" aria-hidden="true"><img src="/assets/emmi-assistant.png" alt=""></span>`;
  const photo = state.offer?.patient?.photoUrl;
  if (photo) return `<span class="assistant-message-avatar patient" aria-hidden="true"><img src="${escapeHtml(photo)}" alt=""></span>`;
  const initials = patientChatInitials();
  return `<span class="assistant-message-avatar patient ${initials ? "initials" : "anonymous"}" aria-hidden="true">${initials ? escapeHtml(initials) : icon("person")}</span>`;
};

// Consecutive turns from the same speaker share one avatar and show the name once, so a voice
// transcript arriving in fragments reads as one person talking rather than a stack of repeated
// badges. The name stays in the DOM for screen readers, which have no avatar to go by.
const assistantMessageRow = (role, body, { startsGroup = true, extraClass = "", attrs = "" } = {}) => `<div class="assistant-message ${role}${startsGroup ? "" : " continues"}${extraClass ? ` ${extraClass}` : ""}"${attrs}>${startsGroup ? assistantMessageAvatar(role) : `<span class="assistant-message-avatar-spacer" aria-hidden="true"></span>`}<div class="assistant-message-bubble"><strong${startsGroup ? "" : ` class="sr-only"`}>${role === "user" ? L("You", "Usted", "Ou") : "EMMI"}</strong>${body}</div></div>`;

const assistantPrepMedicationChoices = message => {
  if (!Array.isArray(message.prepMedicationOptions) || !message.prepMedicationOptions.length) return "";
  const appointment = appointmentById(message.appointmentId);
  const selectedIds = new Set((appointment?.prep?.medications || []).map(item => item.medicationId));
  const label = L("Choose medications to add to your visit list", "Elija medicamentos para agregarlos a su lista para la cita", "Chwazi medikaman pou ajoute nan lis vizit ou");
  return `<div class="assistant-prep-options" role="group" aria-label="${escapeHtml(label)}">${message.prepMedicationOptions.map(option => {
    const selected = selectedIds.has(option.medicationId);
    return `<button type="button" class="assistant-prep-choice" data-assistant-prep-medication data-appointment-id="${escapeHtml(message.appointmentId)}" data-medication-id="${escapeHtml(option.medicationId)}" aria-pressed="${selected}"><strong>${escapeHtml(option.name)}</strong>${option.details ? `<small>${escapeHtml(option.details)}</small>` : ""}</button>`;
  }).join("")}</div>`;
};

function assistantLayer() {
  const context = assistantContext();
  const quickQuestions = assistantQuickQuestions(context);
  const labels = emmiLabels();
  const guideState = emmiGuideState();
  const messages = state.assistantMessages.map((message, index) => assistantMessageRow(message.role, `<p>${escapeHtml(message.text)}</p>${assistantPrepMedicationChoices(message)}${message.emergency ? `<a class="assistant-emergency-action" href="tel:911">${icon("phone")}<span>${L("Call 911", "Llamar al 911", "Rele 911")}</span></a>` : ""}${message.quickAction ? `<button type="button" class="assistant-message-action" data-assistant-growth="${message.quickAction}" data-barrier-id="${message.barrierId || ""}" data-medication-id="${message.medicationId || ""}" data-appointment-id="${message.appointmentId || ""}" data-need-id="${message.needId || ""}">${message.quickAction === "care-circle" ? L("Invite someone to help", "Invitar a alguien para ayudar", "Envite yon moun pou ede") : message.quickAction === "medication-refill" ? L("Open my medications", "Abrir mis medicamentos", "Louvri medikaman mwen yo") : message.quickAction === "goal-barrier" ? L("Get help with this", "Obtener ayuda con esto", "Jwenn èd ak sa") : message.quickAction === "appointment-view" ? L("Open my appointments", "Abrir mis citas", "Louvri randevou mwen yo") : message.quickAction === "appointment-companion" ? L("Coordinate a companion", "Coordinar acompañante", "Kowòdone yon moun pou akonpaye m") : message.quickAction === "appointment-reschedule" ? L("Change this appointment", "Cambiar esta cita", "Chanje randevou sa a") : message.quickAction === "appointment-request" ? L("Continue with this appointment", "Continuar con esta cita", "Kontinye ak randevou sa a") : message.quickAction === "safety-resolved" ? L("I’ve called for help", "Ya llamé para pedir ayuda", "Mwen rele pou èd") : L("Share ACCESS", "Compartir ACCESS", "Pataje ACCESS")}</button>` : ""}`, { startsGroup: state.assistantMessages[index - 1]?.role !== message.role })).join("")
    + (state.assistantBusy ? assistantMessageRow("assistant", `<p>${L("EMMI is thinking…", "EMMI está pensando…", "EMMI ap reflechi…")}</p>`, { startsGroup: state.assistantMessages.at(-1)?.role !== "assistant", extraClass: "assistant-thinking", attrs: ' role="status"' }) : "");
  const commonQuestions = context.currentScreen === "ACCESS_ELIGIBILITY_RESULT" && state.accessOutcome === "notEligible"
    ? [L("Why can’t I continue?", "¿Por qué no puedo continuar?", "Poukisa mwen pa ka kontinye?"), L("Does this affect my Medicare?", "¿Esto afecta mi Medicare?", "Èske sa afekte Medicare mwen an?"), L("Can I still see my doctors?", "¿Puedo seguir viendo a mis médicos?", "Èske mwen ka toujou wè doktè mwen yo?"), L("Are there other care options?", "¿Hay otras opciones de cuidado?", "Èske gen lòt opsyon swen?")]
    : [L("Is participation voluntary?", "¿La participación es voluntaria?", "Èske patisipasyon volontè?"), L("Will I keep my doctor?", "¿Conservaré a mi médico?", "Èske mwen pral kenbe doktè mwen an?"), L("Will this affect my Medicare?", "¿Esto afectará mi Medicare?", "Èske sa ap afekte Medicare mwen an?")];
  // EMMI has already introduced herself on Home. Reopening her later continues that conversation,
  // so the hero asks what the patient needs instead of saying hello a second time.
  const assistantTitle = emmiConversationManager?.contextForModel().hasGreeted || state.emmiWelcomeAcknowledged || state.emmiIntroSeen
    ? L("How can I help?", "¿Cómo puedo ayudarle?", "Kijan mwen ka ede w?")
    : L("Hi, I’m EMMI. How can I help?", "Hola, soy EMMI. ¿Cómo puedo ayudar?", "Bonjou, mwen se EMMI. Kijan mwen ka ede?");
  // Two modes, one conversation. Before the patient has said anything there is nothing to read, so
  // the panel offers ways in; the moment they do, the thread is the screen and everything that was
  // helping them start gets out of its way.
  const conversing = Boolean(messages);
  const composer = EMMI_CONFIG.enableText ? `<form class="assistant-question-form"><label class="sr-only" for="assistant-question">${L("Ask a question", "Haga una pregunta", "Poze yon kesyon")}</label><input id="assistant-question" name="question" type="text" autocomplete="off" placeholder="${L("Ask a question…", "Haga una pregunta…", "Poze yon kesyon…")}" ${state.assistantBusy ? "disabled" : ""}>${assistantComposerMic()}<button type="submit" class="assistant-send" aria-label="${L("Send question", "Enviar pregunta", "Voye kesyon")}" ${state.assistantBusy ? "disabled" : ""}>${icon("arrowRight")}</button></form>` : "";
  const voiceError = state.assistantVoiceError && emmiVoiceIsSupported(languageCode()) ? `<div class="assistant-voice-error" role="status">${icon("info")}<span>${assistantVoiceErrorCopy()}</span></div>` : "";
  const errorBlock = state.assistantError ? `<section class="assistant-error" role="alert"><p>${L("I’m having trouble connecting right now.", "Estoy teniendo problemas de conexión en este momento.", "Mwen gen pwoblèm pou m konekte kounye a.")}</p><div class="assistant-error-actions"><button type="button" data-assistant-action="retry">${icon("rotate")}<span>${labels.retry}</span></button><a href="tel:+13053948070" data-assistant-action="human-support">${icon("phone")}<span>${L("Talk to our care team", "Hable con nuestro equipo", "Pale ak ekip swen nou an")}</span></a></div></section>` : "";
  const suggestionButtons = list => list.map(question => `<button type="button" data-assistant-question="${escapeHtml(question.label)}" data-question-id="${question.id}" data-question-intent="${question.intent}">${escapeHtml(question.label)}</button>`).join("");
  const humanSupport = `<section class="assistant-human-support" id="assistant-human-support" tabindex="-1">
      <button class="assistant-support-toggle" type="button" data-assistant-action="human-support-toggle" aria-expanded="${state.assistantSupportOpen}" aria-controls="assistant-support-options">${icon("phone")}<span>${L("Need human help?", "¿Necesita ayuda de una persona?", "Bezwen èd yon moun?")}</span>${icon("chevronRight")}</button>
      ${state.assistantSupportOpen ? `<div class="assistant-support-options" id="assistant-support-options"><a class="assistant-support-action" href="tel:+13053948070" data-assistant-action="human-support">${icon("phone")}<span><strong>${L("Call our care team", "Llame a nuestro equipo", "Rele ekip swen nou an")}</strong><small>${state.offer.participantProvider.supportPhone}</small></span></a><button class="assistant-support-action" type="button" data-assistant-action="callback">${icon("phone")}<span><strong>${L("Have someone call me", "Quiero que alguien me llame", "Mande yon moun rele m")}</strong><small>${L("EMMI will confirm before sending the request", "EMMI confirmará antes de enviar la solicitud", "EMMI ap konfime anvan li voye demann lan")}</small></span></button></div>` : ""}
    </section>`;
  const safetyNote = `<p class="emmi-disclaimer">${icon("info")}<span>${L("EMMI is an AI assistant, not a clinician. For medical emergencies, call 911.", "EMMI es una asistente de IA, no una profesional clínica. Para emergencias médicas, llame al 911.", "EMMI se yon asistan IA, li pa yon pwofesyonèl klinik. Pou ijans medikal, rele 911.")}</span></p>`;
  const discovery = `<div class="assistant-intro"><img src="/assets/emmi-assistant.png" alt=""><div><h1 id="assistant-title" tabindex="-1">${assistantTitle}</h1><p>${assistantHeroCopy(context.currentScreen)}</p></div></div>
      ${assistantVoiceEntry(guideState)}
      ${voiceError}
      ${composer}
      ${errorBlock}
      ${EMMI_CONFIG.enableText ? `<section class="assistant-quick"><h2>${L("You might want to ask", "Quizá quiera preguntar", "Ou ka vle mande")}</h2><div>${suggestionButtons(quickQuestions)}</div></section>
      <button class="assistant-faq-toggle" type="button" data-assistant-action="faq" aria-expanded="${state.assistantFaqOpen}">${L("Browse common questions", "Ver preguntas comunes", "Gade kesyon komen")} ${icon("chevronRight")}</button>
      ${state.assistantFaqOpen ? `<section class="assistant-common-questions">${commonQuestions.map(question => `<button type="button" data-assistant-question="${escapeHtml(question)}" data-question-id="common-question">${question}</button>`).join("")}</section>` : ""}` : ""}
      ${humanSupport}
      ${safetyNote}`;
  const followUps = conversing && !state.assistantBusy ? assistantFollowUpSuggestions() : [];
  const active = `<h1 id="assistant-title" class="sr-only" tabindex="-1">${assistantTitle}</h1>
      ${voiceError}
      <section class="assistant-conversation" aria-live="polite">${messages}</section>
      ${errorBlock}
      ${followUps.length ? `<section class="assistant-followups"><h2 class="sr-only">${L("You might want to ask", "Quizá quiera preguntar", "Ou ka vle mande")}</h2><div>${suggestionButtons(followUps)}</div></section>` : ""}
      ${humanSupport}
      ${safetyNote}`;
  return `<aside class="assistant-layer" role="dialog" aria-modal="true" data-assistant-mode="${conversing ? "conversation" : "discovery"}" aria-label="${L("EMMI – Your ITERA Care Assistant", "EMMI – Su Asistente de cuidado de ITERA", "EMMI – Asistan swen ITERA ou")}">
    <header class="assistant-header"><div class="assistant-identity"><strong>EMMI</strong><small>${L("Your ITERA Care Assistant", "Su Asistente de cuidado de ITERA", "Asistan swen ITERA ou")}</small></div><button class="language" data-assistant-action="language" aria-label="${languageActionLabel()}">${icon("language")} ${languageCode()}</button><button class="assistant-close" data-assistant-action="close" aria-label="${labels.closeEmmi}">×</button></header>
    <div class="assistant-content">${conversing ? active : discovery}</div>
    ${conversing ? `<div class="assistant-composer-dock">${composer}</div>` : ""}
  </aside>`;
}

// The microphone is the same voice conversation the Talk to EMMI button starts, reachable without
// leaving the composer. It is absent when voice cannot run at all, rather than offered and broken.
function assistantComposerMic() {
  if (!EMMI_CONFIG.enableVoice || !emmiVoiceIsSupported(languageCode())) return "";
  const live = !["DISCONNECTED", "ERROR"].includes(state.assistantVoiceState);
  return `<button type="button" class="assistant-composer-mic" data-assistant-action="${live ? "voice-options" : "start-voice"}" aria-label="${live ? emmiLabels().voiceOptions : L("Ask by voice", "Preguntar por voz", "Mande pa vwa")}" aria-pressed="${live}">${icon(live && state.assistantVoiceMuted ? "micOff" : "mic")}</button>`;
}

// Where the patient plausibly goes after the answer they just read, chosen from what EMMI actually
// answered rather than from the screen, so the same chips never follow two different answers.
function assistantFollowUpSuggestions() {
  const lastAssistant = [...state.assistantMessages].reverse().find(message => message.role === "assistant");
  if (!lastAssistant?.intent) return [];
  return getEmmiFollowUps({
    intent: lastAssistant.intent,
    locale: languageCode(),
    asked: state.assistantMessages.map(message => message.questionId).filter(Boolean)
  });
}

function disclosure() {
  const label = "ACCESS";
  if (state.offer.pathway === "ACCESS") {
    const config = state.offer.disclosures.accessConfig || {};
    const costCopy = config.costSharingType === "COST_SHARING_APPLIES"
      ? config.costSharingAmount
        ? L(`Your cost may be up to ${config.costSharingAmount} per month.`, `Su costo puede ser de hasta ${config.costSharingAmount} al mes.`, `Pri w ka jiska ${config.costSharingAmount} pa mwa.`)
        : L("Your care team will review any applicable monthly cost with you before enrollment.", "Su equipo de cuidado revisará con usted cualquier costo mensual aplicable antes de la inscripción.", "Ekip swen w lan pral revize nenpòt depans chak mwa ki aplikab avèk ou anvan enskripsyon an.")
      : L("$0 ACCESS cost-sharing from ITERA HEALTH.", "$0 de costo compartido de ACCESS por parte de ITERA HEALTH.", "$0 pataj depans ACCESS nan ITERA HEALTH.");
    const disclosureRows = [
      ["people", L("Participation is voluntary", "La participación es voluntaria", "Patisipasyon an volontè."), L("You choose whether to enroll in ACCESS with ITERA HEALTH.", "Usted decide si desea inscribirse en ACCESS con ITERA HEALTH.", "Se ou ki chwazi si w ap enskri nan ACCESS avèk ITERA HEALTH.")],
      ["shield", L("Your Medicare benefits stay the same", "Sus beneficios de Medicare permanecen iguales", "Benefis Medicare ou yo rete menm jan an"), L("Your decision to enroll or not enroll does not affect your Medicare benefits.", "Su decisión de inscribirse o no inscribirse no afecta sus beneficios de Medicare.", "Desizyon w pou w enskri oswa pou w pa enskri pa afekte benefis Medicare ou yo.")],
      ["info", L("Your cost", "Su costo", "Pri w"), costCopy],
      ["doctor", L("One ACCESS provider per care track", "Un proveedor ACCESS por cada área de cuidado", "Yon founisè ACCESS pou chak domèn swen"), L("You can be enrolled with one ACCESS provider for this care track at a time.", "Puede estar inscrito con un proveedor ACCESS para esta área de cuidado a la vez.", "Ou ka enskri ak yon sèl founisè ACCESS pou domèn swen sa a alafwa.")],
      ["clock", L("Changing or ending ACCESS care", "Cambiar o finalizar el cuidado ACCESS", "Chanje oswa mete fen nan swen ACCESS"), L("Beginning 90 days after enrollment, you may end your ACCESS participation or switch to another participating provider.", "A partir de 90 días después de la inscripción, puede terminar su participación en ACCESS o cambiar a otro proveedor participante.", "Apati 90 jou apre enskripsyon an, ou ka mete fen nan patisipasyon ACCESS ou oswa chanje pou yon lòt founisè ki patisipe.")]
    ];
    if (config.showClaimsSharing) disclosureRows.push(["document", L("Medicare claims information", "Información de reclamaciones de Medicare", "Enfòmasyon sou reklamasyon Medicare"), L("Medicare may share claims information with ITERA HEALTH to help coordinate your ACCESS care.", "Medicare puede compartir información de reclamaciones con ITERA HEALTH para ayudar a coordinar su cuidado ACCESS.", "Medicare ka pataje enfòmasyon sou reklamasyon avèk ITERA HEALTH pou ede kowòdone swen ACCESS ou.")]);
    if (config.showTempoDisclosure) disclosureRows.push(["device", L("Connected device information", "Información del dispositivo conectado", "Enfòmasyon sou aparèy ki konekte"), config.tempoDisclosureText ? offerText(config.tempoDisclosureText) : L("A connected device may be used to support your ACCESS care. Your care team will explain what is required.", "Puede utilizarse un dispositivo conectado para apoyar su cuidado ACCESS. Su equipo le explicará lo necesario.", "Yo ka itilize yon aparèy konekte pou sipòte swen ACCESS ou. Ekip swen ou pral eksplike sa ki nesesè.")]);
    return `${titleBlock(L("About your recommended care", "Acerca de su cuidado recomendado", "Konsènan swen ou rekòmande a"), "", L("Important information", "Información importante", "Enfòmasyon enpòtan"))}
      <section class="disclosure-card access-disclosure-card"><h2>${label}</h2>${disclosureRows.map(([rowIcon, headline, copy]) => `<div class="disclosure-row access-disclosure-row">${icon(rowIcon)}<div><strong>${headline}</strong><p>${copy}</p></div></div>`).join("")}</section>
      <details class="full-terms"><summary>${L("View full information", "Ver información completa", "Gade tout enfòmasyon yo")} ${icon("externalLink")}</summary><p>${L("Review the complete ACCESS information, including participation, Medicare benefits, costs, provider choice, timing rules, privacy, and any disclosures that apply to your care before you decide.", "Revise la información completa de ACCESS, incluida la participación, los beneficios de Medicare, los costos, la elección de proveedor, las reglas de tiempo, la privacidad y cualquier divulgación aplicable antes de decidir.", "Revize tout enfòmasyon ACCESS yo, tankou patisipasyon, benefis Medicare, depans, chwa founisè, règ sou delè, vi prive ak nenpòt lòt enfòmasyon ki aplike pou swen ou anvan ou deside.")}</p></details>
      ${check("acknowledge", L("I have reviewed this information", "He revisado esta información", "Mwen te revize enfòmasyon sa a"))}<p class="form-error" role="alert">${state.error}</p>${actions(L("Continue", "Continuar", "Kontinye"), true, "", true)}`;
  }
  return importantInformationScreen();
}

// Shared "Important information" screen for every non-ACCESS program. Content comes
// entirely from programDisclosureConfig so the same rules feed "Review and agree".
function importantInformationScreen() {
  const config = programDisclosureConfig(state.offer.pathway);
  if (!config) return "";
  const copy = IMPORTANT_INFORMATION_COPY;
  return `${titleBlock(localized(copy.title), localized(copy.lead))}
    <section class="disclosure-card important-information-card"><h2>${localized(config.displayName)}</h2>${disclosureRowsMarkup(config.disclosures, "disclosure-row important-information-row")}</section>
    ${programFullInformation(config)}
    <p class="disclosure-privacy-note">${icon("lock")}<span>${localized(copy.privacyNote)}</span></p>
    ${check("acknowledge", localized(copy.acknowledgement))}<p class="form-error" role="alert">${state.error}</p>${actions(localized(copy.continue), true, "", true)}`;
}

const disclosureRowsMarkup = (disclosures, rowClass) => disclosures
  .map(row => `<div class="${rowClass}" data-disclosure-id="${row.id}">${icon(row.icon)}<div><strong>${localized(row.title)}</strong><p>${localized(row.body)}</p></div></div>`)
  .join("");

const programFullInformation = (config, extraClass = "") => `<details class="full-terms program-full-terms ${extraClass}"><summary>${localized(config.fullInformationLabel) || localized(IMPORTANT_INFORMATION_COPY.fullInformationFallback)} ${icon("externalLink")}</summary><div class="program-full-content">${config.fullInformation.map(part => `<section class="access-full-section"><h2>${localized(part.title)}</h2><p>${localized(part.body)}</p></section>`).join("")}<p class="access-disclosure-version"><strong>${L("Disclosure version", "Versión de divulgación", "Vèsyon enfòmasyon")}: ${state.offer.disclosures.version}</strong></p></div></details>`;

// What a patient pays has one answer, and the financial responsibility engine gives it. The card
// used to read a three-state summary from the prototype configuration, which defaults to "no
// supplemental coverage verified" — so the primary demo patient, whose supplement is verified to
// cover this cost share, was shown $6 a month while EMMI told them $0. The prototype's coverage
// control is still honoured, but as a deliberate override rather than a second opinion.
const OVERRIDE_EXPLANATION = {
  [SECONDARY_COVERAGE_STATUSES.VERIFIED]: EXPLANATION_CODES.SUPPLEMENTAL_COVERS_COST_SHARE,
  [SECONDARY_COVERAGE_STATUSES.PRESENT_NOT_CONFIRMED]: EXPLANATION_CODES.SUPPLEMENTAL_COVERAGE_UNKNOWN,
  [SECONDARY_COVERAGE_STATUSES.NOT_VERIFIED]: EXPLANATION_CODES.NO_SUPPLEMENTAL_COVERAGE
};
function currentAccessCost() {
  // A traditional program has no ACCESS cost on the offer, and this runs for them too when the
  // consent evidence is recorded, so the fallback is the disclosure configuration rather than a
  // `config` that only exists inside the ACCESS consent view.
  const accessCost = state.offer?.accessCost || state.offer?.disclosures?.accessConfig?.accessCost || {};
  const override = accessCost.configuredSecondaryCoverageStatus;
  if (override) return { ...accessCost, explanationCode: OVERRIDE_EXPLANATION[override] || EXPLANATION_CODES.NO_SUPPLEMENTAL_COVERAGE };
  const coverage = emmiDemoCoverage(currentDemoPatientId());
  if (!coverage) return { ...accessCost, explanationCode: EXPLANATION_CODES.NO_SUPPLEMENTAL_COVERAGE };
  const resolved = resolveExpectedPatientResponsibility({ track: state.offer?.accessTrack || accessCost.track || "eCKM", coverage });
  return { ...accessCost, expectedMonthlyAmount: resolved.grossBeneficiaryResponsibility, explanationCode: resolved.explanationCode };
}

function accessCostSummary(accessCost = {}) {
  // Falls back to the canonical track configuration rather than a literal. A hardcoded 6 here
  // would quote the eCKM amount to a CKM patient who owes 7, or double the 3 that BH and MSK owe.
  const amount = Number.isFinite(Number(accessCost.expectedMonthlyAmount))
    ? Number(accessCost.expectedMonthlyAmount)
    : accessTrackCost(accessCost.track);
  const monthlyShare = `$${amount}`;
  // The engine decides which of these the patient is in; this only puts its verdict into words.
  const code = accessCost.explanationCode || EXPLANATION_CODES.NO_SUPPLEMENTAL_COVERAGE;
  if (code === EXPLANATION_CODES.SUPPLEMENTAL_COVERS_COST_SHARE) return {
    amountLabel: L("Estimated out-of-pocket cost: $0", "Costo de bolsillo estimado: $0", "Depans estime nan pòch ou: $0"),
    // The $0 is named as the ACCESS payment specifically. A patient agreeing on this screen should
    // not read it as "care is free" — the reading EMMI is also held to avoiding.
    supportingCopy: L("Expected beneficiary payment amount: $0 per month. Your Medicare and verified supplemental coverage are expected to cover this ACCESS cost. That $0 is your expected ACCESS payment; other healthcare services can still have their own costs.", "Monto de pago esperado del beneficiario: $0 al mes. Se espera que Medicare y su cobertura suplementaria verificada cubran este costo de ACCESS. Ese $0 es su pago esperado por ACCESS; otros servicios de salud pueden tener sus propios costos.", "Montan peman benefisyè a prevwa: $0 pa mwa. Yo prevwa Medicare ak kouvèti siplementè verifye ou ap kouvri depans ACCESS sa a. $0 sa a se peman ACCESS ou prevwa a; lòt sèvis sante ka gen pwòp depans pa yo."),
    fullDetails: L("Your supplemental coverage was verified for this estimate. Coverage can change, and you can review updated information before future charges.", "Su cobertura suplementaria fue verificada para este cálculo. La cobertura puede cambiar y puede revisar información actualizada antes de cargos futuros.", "Yo verifye kouvèti siplemantè ou pou estimasyon sa a. Kouvèti ka chanje, epi ou ka revize enfòmasyon ajou anvan depans alavni.")
  };
  if (code === EXPLANATION_CODES.SUPPLEMENTAL_COVERAGE_UNKNOWN) return {
    amountLabel: L(`Up to ${monthlyShare} per month`, `Hasta ${monthlyShare} al mes`, `Jiska ${monthlyShare} pa mwa`),
    supportingCopy: L(`Expected beneficiary payment amount: up to ${monthlyShare} per month. Medicare covers most of the cost of this care. Your supplemental coverage may reduce this amount.`, `Monto de pago esperado del beneficiario: hasta ${monthlyShare} al mes. Medicare cubre la mayor parte del costo de este cuidado. Su cobertura suplementaria puede reducir este monto.`, `Montan peman benefisyè a prevwa: jiska ${monthlyShare} pa mwa. Medicare kouvri pifò nan depans swen sa a. Kouvèti siplemantè ou ka diminye montan sa a.`),
    fullDetails: L("We have not yet confirmed what your supplemental insurance will pay. Your expected monthly share will not be more than the amount shown here.", "Aún no hemos confirmado cuánto pagará su seguro suplementario. No se espera que su parte mensual supere el monto mostrado aquí.", "Nou poko konfime konbyen asirans siplemantè ou ap peye. Yo pa prevwa pati pa mwa ou ap depase montan ki montre isit la.")
  };
  // A verification old enough to be out of date cannot support an amount, so the card says that
  // rather than quoting one the record no longer stands behind.
  if (code === EXPLANATION_CODES.COVERAGE_VERIFICATION_STALE) return {
    amountLabel: L("We need to re-check your coverage", "Necesitamos verificar su cobertura de nuevo", "Nou bezwen reverifye kouvèti ou"),
    supportingCopy: L("Your coverage was last verified a while ago, so we do not want to show you an amount that may be out of date. Your care team can re-check it before you decide.", "Su cobertura se verificó hace tiempo, así que preferimos no mostrarle un monto que podría estar desactualizado. Su equipo de atención puede verificarla de nuevo antes de que decida.", "Se gen yon bon tan depi nou te verifye kouvèti ou, kidonk nou pa vle montre w yon montan ki ka pa ajou. Ekip swen ou ka reverifye l anvan ou deside."),
    fullDetails: L("Medicare covers most of the cost of this care. We will confirm your expected monthly share once your coverage is verified again.", "Medicare cubre la mayor parte del costo de este cuidado. Confirmaremos su parte mensual esperada cuando se verifique su cobertura de nuevo.", "Medicare kouvri pifò nan depans swen sa a. N ap konfime pati pa mwa ou prevwa a lè kouvèti ou verifye ankò.")
  };
  if (code === EXPLANATION_CODES.COVERAGE_NOT_VERIFIED) return {
    amountLabel: L("We could not verify your coverage", "No pudimos verificar su cobertura", "Nou pa t ka verifye kouvèti ou"),
    supportingCopy: L("We could not verify your coverage from the information we have, so we do not have an expected monthly amount for you yet. Your care team can check this with you.", "No pudimos verificar su cobertura con la información disponible, así que todavía no tenemos un monto mensual esperado. Su equipo de atención puede revisarlo con usted.", "Nou pa t ka verifye kouvèti ou ak enfòmasyon nou genyen, kidonk nou poko gen yon montan pa mwa ou prevwa. Ekip swen ou ka tcheke sa avèk ou."),
    fullDetails: L("Medicare covers most of the cost of this care. Your expected monthly share will be confirmed once your coverage is verified.", "Medicare cubre la mayor parte del costo de este cuidado. Su parte mensual esperada se confirmará cuando se verifique su cobertura.", "Medicare kouvri pifò nan depans swen sa a. Pati pa mwa ou prevwa a ap konfime lè kouvèti ou verifye.")
  };
  // A Qualified Medicare Beneficiary designation has its own cost-sharing rules. Quoting a share
  // against it, or inviting the patient to imagine supplemental insurance, are both wrong: QMB is
  // not a Medigap policy, which is why the coverage model keeps them apart.
  if (code === EXPLANATION_CODES.QMB_COST_SHARE_RULES) return {
    amountLabel: L("Your care team will confirm your cost", "Su equipo confirmará su costo", "Ekip swen ou ap konfime depans ou"),
    supportingCopy: L("Your coverage includes a Qualified Medicare Beneficiary designation, which has its own cost-sharing rules. We do not want to show an amount before your care team confirms how those rules apply to you.", "Su cobertura incluye la designación de Beneficiario Calificado de Medicare, que tiene sus propias reglas de costos. Preferimos no mostrar un monto antes de que su equipo confirme cómo se aplican esas reglas.", "Kouvèti ou gen yon deziyasyon Benefisyè Medicare Kalifye, ki gen pwòp règ pa l sou depans. Nou pa vle montre yon montan anvan ekip swen ou konfime kijan règ sa yo aplike pou ou."),
    fullDetails: L("Qualified Medicare Beneficiary rules are not the same as supplemental insurance. Your care team will explain what applies to you before any charge.", "Las reglas del Beneficiario Calificado de Medicare no son lo mismo que un seguro suplementario. Su equipo le explicará qué aplica en su caso antes de cualquier cargo.", "Règ Benefisyè Medicare Kalifye yo pa menm bagay ak asirans siplemantè. Ekip swen ou ap esplike sa ki aplike pou ou anvan nenpòt depans.")
  };
  // Medicare Advantage is an eligibility question, not a pricing one. A monthly share here would
  // answer a question the patient has not reached yet.
  if (code === EXPLANATION_CODES.MEDICARE_ADVANTAGE_NOT_ELIGIBLE) return {
    amountLabel: L("Your care team will review your coverage", "Su equipo revisará su cobertura", "Ekip swen ou ap revize kouvèti ou"),
    supportingCopy: L("Your coverage shows a Medicare Advantage plan rather than Original Medicare. That affects whether ACCESS is available to you, not only what you would pay, so your care team needs to review it first.", "Su cobertura muestra un plan Medicare Advantage en lugar de Medicare Original. Eso afecta si ACCESS está disponible para usted, no solo lo que pagaría, así que su equipo debe revisarlo primero.", "Kouvèti ou montre yon plan Medicare Advantage olye Medicare Orijinal. Sa afekte si ACCESS disponib pou ou, se pa sèlman sa ou ta peye, kidonk ekip swen ou dwe revize l anvan."),
    fullDetails: L("ACCESS is built on Original Medicare. Your care team will review your eligibility with you before any cost applies.", "ACCESS se basa en Medicare Original. Su equipo revisará su elegibilidad con usted antes de que aplique cualquier costo.", "ACCESS bati sou Medicare Orijinal. Ekip swen ou ap revize kalifikasyon ou avèk ou anvan nenpòt depans aplike.")
  };
  return {
    amountLabel: L(`${monthlyShare} per month`, `${monthlyShare} al mes`, `${monthlyShare} pa mwa`),
    supportingCopy: L(
      `Expected beneficiary payment amount: ${monthlyShare} per month. Medicare covers most of the cost of this care. If you have supplemental insurance, it may cover some or all of your ${monthlyShare} monthly share, which could reduce your out-of-pocket cost to $0.`,
      `Monto de pago esperado del beneficiario: ${monthlyShare} al mes. Medicare cubre la mayor parte del costo de este cuidado. Si tiene un seguro suplementario, puede cubrir parte o la totalidad de su parte mensual de ${monthlyShare}, lo que podría reducir su costo de bolsillo a $0.`,
      `Montan peman benefisyè a prevwa: ${monthlyShare} pa mwa. Medicare kouvri pifò nan depans swen sa a. Si ou gen asirans siplemantè, li ka kouvri yon pati oswa tout pati ${monthlyShare} ou peye chak mwa a, sa ki ka diminye depans ou peye nan pòch ou rive $0.`
    ),
    fullDetails: L(
      `Your expected beneficiary share for this ACCESS care is ${monthlyShare} per month. Medicare covers most of the cost. Supplemental insurance may pay part or all of your share, but a $0 out-of-pocket cost is not guaranteed unless that coverage is verified.`,
      `La parte mensual esperada del beneficiario para este cuidado ACCESS es de ${monthlyShare}. Medicare cubre la mayor parte del costo. El seguro suplementario puede pagar parte o la totalidad de su parte, pero no se garantiza un costo de bolsillo de $0 salvo que se verifique esa cobertura.`,
      `Pati benefisyè a prevwa pou swen ACCESS sa a se ${monthlyShare} pa mwa. Medicare kouvri pifò nan depans lan. Asirans siplemantè ka peye yon pati oswa tout pati ou a, men yo pa garanti depans $0 nan pòch ou sof si yo verifye kouvèti sa a.`
    )
  };
}

function accessFullDisclosure(cost, config = {}) {
  const physicianReferral = isProviderReferralSource(state.offer.enrollmentSource) && state.offer.physician?.displayName;
  const doctorCopy = physicianReferral
    ? L(`ACCESS adds support to your existing care. ITERA works with ${physicianDisplayName()}, and you can continue seeing your regular doctors.`, `ACCESS agrega apoyo a su cuidado actual. ITERA trabaja con ${physicianDisplayName()}, y puede continuar viendo a sus médicos habituales.`, `ACCESS ajoute sipò nan swen ou deja resevwa. ITERA travay avèk ${physicianDisplayName()}, epi ou ka kontinye wè doktè ou konn wè yo.`)
    : L("ACCESS adds support to your existing care. You can continue seeing your regular doctors.", "ACCESS agrega apoyo a su cuidado actual. Puede continuar viendo a sus médicos habituales.", "ACCESS ajoute sipò nan swen ou deja resevwa. Ou ka kontinye wè doktè ou konn wè yo.");
  const sections = [
    [L("About your ACCESS care", "Acerca de su cuidado ACCESS", "Konsènan swen ACCESS ou"), L("ITERA HEALTH is your ACCESS care provider for this type of care.", "ITERA HEALTH es su proveedor de cuidado ACCESS para este tipo de cuidado.", "ITERA HEALTH se founisè swen ACCESS ou pou kalite swen sa a.")],
    [L("Participation is voluntary", "La participación es voluntaria", "Patisipasyon an volontè"), L("You choose whether to enroll in ACCESS. Your decision to enroll or not enroll does not change your Medicare benefits, coverage, or rights.", "Usted decide si desea inscribirse en ACCESS. Su decisión de inscribirse o no inscribirse no cambia sus beneficios, cobertura ni derechos de Medicare.", "Se ou ki chwazi si w ap enskri nan ACCESS. Desizyon ou pran pou enskri oswa pa enskri pa chanje benefis, kouvèti oswa dwa Medicare ou.")],
    [L("Your expected cost", "Su costo esperado", "Depans ou prevwa"), cost.fullDetails],
    [L("One ACCESS provider for this type of care", "Un proveedor ACCESS para este tipo de cuidado", "Yon founisè ACCESS pou kalite swen sa a"), L("You can have one ACCESS provider for this type of care at a time.", "Puede tener un proveedor ACCESS para este tipo de cuidado a la vez.", "Ou ka gen yon sèl founisè ACCESS pou kalite swen sa a alafwa.")],
    [L("Changing or ending ACCESS care", "Cambiar o finalizar el cuidado ACCESS", "Chanje oswa mete fen nan swen ACCESS"), L("Starting 90 days after enrollment, you may leave ACCESS or switch to another participating provider.", "A partir de 90 días después de la inscripción, puede dejar ACCESS o cambiar a otro proveedor participante.", "Apati 90 jou apre enskripsyon an, ou ka kite ACCESS oswa chanje pou yon lòt founisè ki patisipe.")],
    [L("Medicare and health information", "Medicare y su información de salud", "Medicare ak enfòmasyon sante ou"), L("ITERA may share information with CMS as needed to operate and evaluate ACCESS, subject to applicable privacy and security requirements.", "ITERA puede compartir información con CMS según sea necesario para operar y evaluar ACCESS, conforme a los requisitos de privacidad y seguridad aplicables.", "ITERA ka pataje enfòmasyon avèk CMS jan sa nesesè pou opere ak evalye ACCESS, dapre kondisyon vi prive ak sekirite ki aplikab yo.")],
    [L("Your doctors and care", "Sus médicos y su cuidado", "Doktè ou ak swen ou"), doctorCopy]
  ];
  if (config.showClaimsSharing) sections.push([L("Medicare claims information", "Información de reclamaciones de Medicare", "Enfòmasyon sou reklamasyon Medicare"), L("Medicare may share claims information with ITERA HEALTH to help coordinate your ACCESS care.", "Medicare puede compartir información de reclamaciones con ITERA HEALTH para ayudar a coordinar su cuidado ACCESS.", "Medicare ka pataje enfòmasyon sou reklamasyon avèk ITERA HEALTH pou ede kowòdone swen ACCESS ou.")]);
  if (config.showTempoDisclosure) sections.push([L("Connected device information", "Información del dispositivo conectado", "Enfòmasyon sou aparèy ki konekte"), config.tempoDisclosureText ? offerText(config.tempoDisclosureText) : L("A connected device may be used to support your ACCESS care. Your care team will explain what is required.", "Puede utilizarse un dispositivo conectado para apoyar su cuidado ACCESS. Su equipo le explicará lo necesario.", "Yo ka itilize yon aparèy konekte pou sipòte swen ACCESS ou. Ekip swen ou pral eksplike sa ki nesesè.")]);
  return `${sections.map(([title, copy]) => `<section class="access-full-section"><h2>${title}</h2><p>${copy}</p></section>`).join("")}
    <section class="access-full-section access-full-support"><h2>${L("Questions before you enroll", "Preguntas antes de inscribirse", "Kesyon anvan ou enskri")}</h2><p>${L("You can contact the ITERA care team before deciding whether to enroll.", "Puede comunicarse con el equipo de cuidado de ITERA antes de decidir si desea inscribirse.", "Ou ka kontakte ekip swen ITERA a anvan ou deside si w ap enskri.")}</p><a href="tel:+13053948070">${icon("phone")} <span>(305) 394-8070</span></a></section>
    <p class="access-disclosure-version"><strong>${L("Disclosure version", "Versión de divulgación", "Vèsyon enfòmasyon")}: ${state.offer.disclosures.version}</strong></p>`;
}

function consent() {
  const representativeRole = isPersonalRepresentative();
  const role = representativeRole ? L("Personal representative", "Representante personal", "Reprezantan pèsonèl") : L("Patient", "Paciente", "Pasyan");
  const submittedSelections = state.consentSubmissionSelections || {};
  if (state.offer.pathway === "ACCESS") {
    const representative = representativeRole;
    // The screen is a decision, not a signature ceremony: it says so before the disclosures, and the
    // subject of the sentence is the patient.
    const intro = L("Review the key details below. You decide whether you want to enroll in ACCESS.", "Revise los detalles clave a continuación. Usted decide si desea inscribirse en ACCESS.", "Revize detay enpòtan ki anba yo. Se ou ki deside si ou vle enskri nan ACCESS.");
    const config = state.offer.disclosures?.accessConfig || {};
    const cost = accessCostSummary(currentAccessCost());
    const summaryRows = [
      ["people", L("Participation is voluntary", "La participación es voluntaria", "Patisipasyon an volontè."), L("You choose whether to enroll in ACCESS.", "Usted decide si desea inscribirse en ACCESS.", "Se ou ki chwazi si w ap enskri nan ACCESS.")],
      ["shield", L("Your Medicare benefits stay the same", "Sus beneficios de Medicare permanecen iguales", "Benefis Medicare ou yo rete menm jan an"), L("Your Medicare benefits, coverage, and rights do not change.", "Sus beneficios, cobertura y derechos de Medicare no cambian.", "Avantaj, pwoteksyon, ak dwa Medicare ou yo pa chanje.")],
      ["info", L("Your ACCESS cost", "Su costo de ACCESS", "Depans ACCESS ou"), cost.supportingCopy, "cost"],
      ["doctor", L("One ACCESS care provider at a time", "Un proveedor de cuidado ACCESS a la vez", "Yon sèl founisè swen ACCESS alafwa"), L("You can receive this type of ACCESS care from one participating provider at a time.", "Puede recibir este tipo de cuidado ACCESS de un proveedor participante a la vez.", "Ou ka resevwa kalite swen ACCESS sa a nan men yon sèl founisè ki patisipe alafwa.")],
      ["clock", L("You can change your ACCESS care", "Puede cambiar su cuidado ACCESS", "Ou ka chanje swen ACCESS ou"), L("Starting 90 days after enrollment, you may leave ACCESS or switch to another participating provider.", "A partir de 90 días después de la inscripción, puede dejar ACCESS o cambiar a otro proveedor participante.", "Apati 90 jou apre enskripsyon an, ou ka kite ACCESS oswa chanje pou yon lòt founisè ki patisipe.")]
    ];
    if (config.showClaimsSharing) summaryRows.push(["document", L("Medicare claims information", "Información de reclamaciones de Medicare", "Enfòmasyon sou reklamasyon Medicare"), L("Medicare may share claims information with ITERA HEALTH to help coordinate your ACCESS care.", "Medicare puede compartir información de reclamaciones con ITERA HEALTH para ayudar a coordinar su cuidado ACCESS.", "Medicare ka pataje enfòmasyon sou reklamasyon avèk ITERA HEALTH pou ede kowòdone swen ACCESS ou.")]);
    if (config.showTempoDisclosure) summaryRows.push(["device", L("Connected device information", "Información del dispositivo conectado", "Enfòmasyon sou aparèy ki konekte"), config.tempoDisclosureText ? offerText(config.tempoDisclosureText) : L("A connected device may be used to support your ACCESS care. Your care team will explain what is required.", "Puede utilizarse un dispositivo conectado para apoyar su cuidado ACCESS. Su equipo le explicará lo necesario.", "Yo ka itilize yon aparèy konekte pou sipòte swen ACCESS ou. Ekip swen ou pral eksplike sa ki nesesè.")]);
    const authorityAttestation = representative ? check("authority", L("I confirm that I’m authorized to make healthcare decisions for the patient.", "Confirmo que estoy autorizado para tomar decisiones médicas por el paciente.", "Mwen konfime ke mwen otorize pou pran desizyon swen sante pou pasyan an."), Boolean(submittedSelections.authority)) : "";
    const agreement = representative
      ? L("I have reviewed the information above and agree, on behalf of the patient, to enroll the patient in ACCESS with ITERA HEALTH.", "He revisado la información anterior y acepto, en nombre del paciente, inscribir al paciente en ACCESS con ITERA HEALTH.", "Mwen te revize enfòmasyon ki anwo a epi mwen dakò, nan non pasyan an, pou enskri pasyan an nan ACCESS avèk ITERA HEALTH.")
      : L("I have reviewed the information above and agree to enroll in ACCESS with ITERA HEALTH.", "He revisado la información anterior y acepto inscribirme en ACCESS con ITERA HEALTH.", "Mwen te revize enfòmasyon ki anwo a epi mwen dakò pou enskri nan ACCESS avèk ITERA HEALTH.");
    return `${titleBlock(L("Review and choose", "Revise y elija", "Revize epi chwazi"), intro)}
      <section class="consent-summary access-consent-summary">${summaryRows.map(([rowIcon, headline, copy, rowType]) => `<div class="consent-disclosure-row ${rowType === "cost" ? "access-cost-row" : ""}">${icon(rowIcon)}<div><strong>${headline}</strong><p>${copy}</p></div></div>`).join("")}</section>
      <details class="full-terms access-consent-terms"><summary>${L("View full ACCESS information", "Ver información completa de ACCESS", "Gade tout enfòmasyon ACCESS yo")} ${icon("externalLink")}</summary><div class="access-full-content">${accessFullDisclosure(cost, config)}</div></details>
      <p class="signer-role"><strong>${L("Signing as", "Firmando como", "Siyen kòm")}:</strong> ${role}</p>
      <form id="consent-form" data-consent-shape="single">${authorityAttestation}${check("consent", agreement, Boolean(submittedSelections.consent))}</form>
      <p class="form-error" role="alert">${state.error}</p>${actions(state.busy ? L("Saving…", "Guardando…", "Ekonomize...") : L("Confirm and continue", "Confirmar y continuar", "Konfime epi kontinye"), true, "", true)}`;
  }
  const traditionalRepresentative = representativeRole;
  const traditionalIntro = traditionalRepresentative
    ? L(`I agree, on behalf of the patient, to enroll the patient in this recommended care with ITERA HEALTH, in coordination with ${physicianDisplayName()}.`, `Acepto, en nombre del paciente, inscribir al paciente en este cuidado recomendado con ITERA HEALTH, en coordinación con ${physicianDisplayName()}.`, `Mwen dakò, nan non pasyan an, pou enskri pasyan an nan swen rekòmande sa a avèk ITERA HEALTH, an kowòdinasyon avèk ${physicianDisplayName()}.`)
    : L(`I want to receive this recommended care from ITERA HEALTH, in coordination with ${physicianDisplayName()}.`, `Deseo recibir este cuidado recomendado de ITERA HEALTH, en coordinación con ${physicianDisplayName()}.`, `Mwen vle resevwa swen rekòmande sa a nan ITERA HEALTH, an kowòdinasyon avèk ${physicianDisplayName()}.`);
  const traditionalAuthority = traditionalRepresentative ? check("authority", L("I confirm that I’m authorized to make healthcare decisions for the patient.", "Confirmo que estoy autorizado para tomar decisiones médicas por el paciente.", "Mwen konfime ke mwen otorize pou pran desizyon swen sante pou pasyan an."), Boolean(submittedSelections.authority)) : "";
  const traditionalAgreement = traditionalRepresentative
    ? L("I agree, on behalf of the patient, to enroll the patient in the services listed above", "Acepto, en nombre del paciente, inscribir al paciente en los servicios indicados", "Mwen dakò, nan non pasyan an, pou enskri pasyan an nan sèvis ki nan lis pi wo a")
    : L("I agree to enroll in the services listed above", "Acepto inscribirme en los servicios indicados", "Mwen dakò pou enskri nan sèvis ki nan lis pi wo a");
  // The same programDisclosureConfig that drives "Important information" is reused here so
  // the two screens can never diverge on voluntary participation, cost, or stopping rules.
  const programConfig = programDisclosureConfig(state.offer.pathway);
  const disclosureSummary = programConfig
    ? `<section class="consent-summary program-consent-summary"><h2>${localized(programConfig.displayName)}</h2>${disclosureRowsMarkup(programConfig.disclosures, "consent-disclosure-row")}</section>${programFullInformation(programConfig, "program-consent-terms")}`
    : `<section class="consent-summary"><p>${offerText(state.offer.consent.costSharingText)}</p>${state.offer.consent.stopRules.map(x => `<p>${icon("check")} ${offerText(x)}</p>`).join("")}</section>`;
  return `${titleBlock(L("Review and agree", "Revise y acepte", "Revize epi dakò"), traditionalIntro)}
    <section class="care-team-card">${providerCard()}<div class="provider-connector"></div><div class="itera-provider">${icon("people")}<span><strong>ITERA HEALTH</strong><small>${L("Care provider", "Proveedor de cuidado", "Founisè swen")}</small></span></div></section>
    <div class="service-chips">${state.offer.consent.services.map(x => `<span>${icon("check")} ${offerText(x)}</span>`).join("")}</div>
    ${disclosureSummary}
    <p class="signer-role"><strong>${L("Signer role", "Rol del firmante", "Wòl siyatè a")}:</strong> ${role}</p>
    <form id="consent-form">${traditionalAuthority}${check("consent", localized(IMPORTANT_INFORMATION_COPY.acknowledgement), Boolean(submittedSelections.consent))}${check("enroll", traditionalAgreement, Boolean(submittedSelections.enroll))}</form>
    <p class="form-error" role="alert">${state.error}</p>${actions(state.busy ? L("Saving…", "Guardando…", "Ekonomize...") : L("Enroll now", "Inscribirme ahora", "Enskri kounye a"), true, "", true)}`;
}

function processing(kind = "enrollment") {
  const access = kind === "alignment";
  return `${art(access ? "lock" : "document")}${titleBlock(access ? L("Completing your enrollment with Medicare", "Completando su inscripción con Medicare", "Ranpli enskripsyon ou ak Medicare") : L("We’re completing your enrollment", "Estamos completando su inscripción", "N ap konplete enskripsyon w lan"), L("Please keep this page open. We’ll save your progress if you leave.", "Mantenga esta página abierta. Guardaremos su progreso si sale.", "Tanpri kenbe paj sa a ouvè. Nou pral sove pwogrè ou si ou kite."))}
    <ol class="process-list">
      <li class="done">${icon("check")} ${access ? L("Saving your consent", "Guardando su consentimiento", "Sove konsantman ou") : L("Saving your consent", "Guardando su consentimiento", "Sove konsantman ou")}</li>
      <li class="active">${icon("clock")} ${access ? L("Sending your enrollment to Medicare", "Enviando su inscripción a Medicare", "Voye enskripsyon w lan bay Medicare") : L("Checking for an existing care service", "Buscando un servicio de cuidado existente", "Tcheke pou yon sèvis swen ki egziste deja")}</li>
      <li>${icon("clock")} ${access ? L("Waiting for Medicare confirmation", "Esperando confirmación de Medicare", "Ap tann konfimasyon Medicare") : L("Setting up your care with ITERA HEALTH", "Configurando su cuidado con ITERA HEALTH", "N ap mete swen ou an plas avèk ITERA HEALTH")}</li>
    </ol>`;
}

// Care Circle after enrollment is about ongoing care support, not help completing enrollment.
// It sits below the primary CTA and never carries a filled button or a "Not now".
function postEnrollmentCareCircle() {
  if (isPersonalRepresentative()) return "";
  if (state.careCircleStatus === "ACTIVE" || !growthPromptAvailable(state.careCirclePromptDismissedAt)) return "";
  const pathway = state.offer.pathway;
  const title = state.supportPersonName
    ? L(`Would you like ${state.supportPersonName} to keep helping with your care?`, `¿Quiere que ${state.supportPersonName} continúe ayudándole con su cuidado?`, `Èske ou vle ${state.supportPersonName} kontinye ede w ak swen ou?`)
    : localized(CARE_CIRCLE_COPY.title);
  return `<section class="optional-support post-enrollment-support" data-care-circle-support>
    <span class="optional-support-label">${localized(CARE_CIRCLE_COPY.label)}</span>
    <button type="button" class="optional-support-card" data-action="open-care-circle-post">${icon("userPlus")}<span><strong>${title}</strong><span class="optional-support-copy">${localized(CARE_CIRCLE_COPY.supportingFor(pathway))}</span><span class="optional-support-action">${localized(CARE_CIRCLE_COPY.cta)} ${icon("arrowRight")}</span></span></button>
  </section>`;
}

// Share ACCESS is shown only once the patient has reached a real value moment — never on the
// Enrollment Welcome screen, and never for a program without an approved sharing story.
function shareAccessPrompt(moment) {
  const eligibility = shareAccessEligibility({
    pathway: state.offer?.pathway,
    enrollmentStatus: state.enrollmentStatus,
    moment,
    dismissedAt: state.shareAccessPromptDismissedAt,
    promptAvailable: growthPromptAvailable
  });
  if (!eligibility.eligible) return "";
  return `<section class="optional-support share-access-support" data-share-access-moment="${moment}">
    <button type="button" class="optional-support-card" data-action="open-share-access">${icon("share")}<span><strong>${localized(SHARE_ACCESS_COPY.title)}</strong><span class="optional-support-copy">${localized(SHARE_ACCESS_COPY.supporting)}</span><span class="optional-support-action">${localized(SHARE_ACCESS_COPY.cta)} ${icon("arrowRight")}</span></span></button>
  </section>`;
}

// The single source the CTA, the routing, and EMMI all read, so the screen and the assistant
// can never name a different "next step".
function currentNextBestAction() {
  return resolveNextBestAction({
    currentScreen: state.screen,
    nextRoute: nextScreen(state),
    pathway: state.offer?.pathway,
    devicePath: state.devicePath,
    rpmDeviceFixture: state.offer?.fixture?.rpmDevice,
    deviceSource: state.deviceSource,
    assignedDeviceId: state.assignedDeviceId,
    deviceSetupStatus: state.deviceSetupStatus,
    firstTransmissionVerified: state.firstTransmissionVerified
  });
}

function currentFlowTransition() {
  return resolveEnrollmentTransition({ pathway: state.offer?.pathway, nextBestAction: currentNextBestAction() });
}

function gettingStartedProgress() {
  return { ...emptyFlowProgress(), ...(state.flowProgress?.GETTING_STARTED || {}) };
}

function setGettingStartedProgress(status, fields = {}) {
  const current = gettingStartedProgress();
  state.flowProgress = { ...(state.flowProgress || {}), GETTING_STARTED: { ...current, ...fields, flowType: "GETTING_STARTED", status } };
}

function flowCompletionTransition(transition) {
  const duration = transition.estimatedDuration ? `<p class="flow-transition-duration">${icon("clock")}<strong>${localized(transition.estimatedDuration)}</strong></p>` : "";
  return `<section class="flow-completion-transition" aria-labelledby="next-flow-title" data-transition-id="${transition.id}">
    <p class="flow-transition-label">${L("Next step", "Siguiente paso", "Pwochen etap")}</p>
    <h2 id="next-flow-title">${localized(transition.title)}</h2>
    <h3>${localized(transition.nextStepTitle)}</h3>
    <p class="flow-transition-description">${localized(transition.description)}</p>
    ${duration}
    <p class="flow-transition-reassurance">${icon("shield")}<span>${localized(transition.reassurance)}</span></p>
    <div class="flow-transition-actions">
      ${cta(localized(transition.primaryCta), "start-next-flow")}
      ${cta(localized(transition.laterLabel), "defer-next-flow", true)}
    </div>
  </section>`;
}

function EnrollmentWelcomeScreen() {
  const pathway = state.offer.pathway;
  const welcome = enrollmentWelcomeFor(pathway);
  const disclosure = programDisclosureConfig(pathway);
  const programDisplayName = pathway === "ACCESS" ? "ACCESS" : localized(disclosure?.displayName) || pathway.replaceAll("_", " + ");
  const title = welcome.useProgramDisplayName
    ? L(`Welcome to your ${programDisplayName} experience`, `Bienvenido a su experiencia de ${programDisplayName}`, `Byenveni nan eksperyans ${programDisplayName} ou`)
    : localized(welcome.title);
  const confirmedPhysicianName = state.offer?.physician?.displayName || state.offer?.referringProvider?.name || "";
  const physicianSpecific = isProviderReferralSource(state.offer.enrollmentSource) && Boolean(confirmedPhysicianName);
  const supportHighlights = (welcome.supportHighlights || []).slice(0, 2).map((highlight, index) => {
    if (index !== 1 || !physicianSpecific) return highlight;
    return {
      ...highlight,
      // The invitation named this doctor, so the card names them too rather than saying "your
      // doctor" about someone the patient could point at.
      title: { en: `Connected with ${confirmedPhysicianName}`, es: `Conectado con ${confirmedPhysicianName}`, ht: `Konekte ak ${confirmedPhysicianName}` },
      description: {
        en: `ITERA works with ${confirmedPhysicianName} and your care team to help keep your care connected.`,
        es: `ITERA trabaja con ${confirmedPhysicianName} y su equipo de cuidado para ayudar a mantener su cuidado conectado.`,
        ht: `ITERA travay avèk ${confirmedPhysicianName} ak ekip swen ou pou ede kenbe swen ou konekte.`
      }
    };
  });
  const signingRole = isPersonalRepresentative() ? L("Personal representative", "Representante personal", "Reprezantan pèsonèl") : L("Patient", "Paciente", "Pasyan");
  const consentTimestamp = state.consentTimestamp
    ? new Intl.DateTimeFormat({ en: "en-US", es: "es-US", ht: "ht-HT" }[state.language] || "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(state.consentTimestamp))
    : L("Recorded securely with this enrollment", "Registrado de forma segura con esta inscripción", "Anrejistre an sekirite avèk enskripsyon sa a");
  const stepIcons = ["ACCESS", "CCM"].includes(pathway) ? ["phone", "document", "people"]
    : ["RPM", "CCM_RPM", "PCM_RPM"].includes(pathway) ? ["box", "wifi", "people"]
      : ["document", "phone", "people"];
  const contactWindow = welcome.careTeamContactWindow ? localized(welcome.careTeamContactWindow) : "";
  // A next step is either a sentence — the shape every program has always used, with its icon
  // decided by position — or, where a program has something to explain rather than announce, a
  // titled step that carries its own icon and its own description.
  const nextSteps = welcome.nextSteps.map((step, index) => step.title
    ? [step.icon || stepIcons[index], localized(step.title), localized(step.description)]
    : [stepIcons[index], localized(step).replace("{careTeamContactWindow}", contactWindow).trim(), ""]);
  const nextBestAction = currentNextBestAction();
  const transition = currentFlowTransition();
  return `<div class="enrollment-welcome-screen" data-program="${pathway}" data-next-route="${nextBestAction.route}" data-next-action="${nextBestAction.actionType}">${art("check", true)}
    <p class="success-eyebrow">${L("Welcome", "Bienvenido", "Byenveni")}</p>
    ${titleBlock(title, localized(welcome.supportingCopy))}
    <section class="enrollment-welcome-highlights" aria-label="${L("Getting started support", "Apoyo para comenzar", "Sipò pou kòmanse")}">${supportHighlights.map(highlight => `<div class="enrollment-welcome-highlight">${icon(highlight.icon)}<div><strong>${localized(highlight.title)}</strong><p>${localized(highlight.description)}</p></div></div>`).join("")}</section>
    <div class="status-pill">${icon("shield")} ${L("Enrollment confirmed", "Inscripción confirmada", "Enskripsyon konfime")}</div>
    <section class="next-card"><h2>${L("What happens next?", "¿Qué sigue?", "Kisa ki rive apre sa?")}</h2>${rows(nextSteps)}</section>
    <details class="full-terms enrollment-consent-details"><summary>${L("View enrollment and consent details", "Ver detalles de inscripción y consentimiento", "Gade detay enskripsyon ak konsantman")} ${icon("arrowRight")}</summary><p><strong>${L("Enrollment confirmation", "Confirmación de inscripción", "Konfimasyon enskripsyon")}:</strong> ${L("Confirmed", "Confirmada", "Konfime")}<br><strong>${L("Program", "Programa", "Pwogram")}:</strong> ${programDisplayName}<br><strong>${L("Consent details", "Detalles del consentimiento", "Detay konsantman")}:</strong> ${L("Version", "Versión", "Vèsyon")} ${state.offer.consent.version}<br><strong>${L("Consent timestamp", "Fecha y hora del consentimiento", "Dat ak lè konsantman")}:</strong> ${consentTimestamp}<br><strong>${L("Signing role", "Rol del firmante", "Wòl siyatè a")}:</strong> ${signingRole}<br><strong>${L("Applicable disclosures", "Divulgaciones aplicables", "Enfòmasyon ki aplikab")}:</strong> ${L("Version", "Versión", "Vèsyon")} ${state.offer.disclosures.version}</p></details>
    ${flowCompletionTransition(transition)}
    ${postEnrollmentCareCircle()}</div>`;
}

const success = EnrollmentWelcomeScreen;

function deferredFlowConfirmation() {
  return `<div class="flow-deferred-screen">${art("check", true)}${titleBlock(L("No problem — you can continue later.", "No hay problema: puede continuar más tarde.", "Pa gen pwoblèm — ou ka kontinye pita."), L("Your enrollment is complete. Your care setup will be here when you’re ready.", "Su inscripción está completa. La configuración de su cuidado estará aquí cuando esté listo.", "Enskripsyon ou fini. Konfigirasyon swen ou ap la lè ou pare."))}${cta(L("Go to My Care", "Ir a Mi cuidado", "Ale nan Swen mwen"), "go-to-my-care")}</div>`;
}

// My Medications and the refill conversation. A medication card is quiet until something is
// actually happening to it: no permanent "request refill" on every row, and no status the product
// was not told about.

// My Care says what needs attention, not how many medications exist. A count is not a reason to
// open a screen; a refill waiting on the patient is.
function medicationAttentionLine() {
  detectMedicationSupplySignals();
  const waiting = activeMedications().find(medication => openSupplySignalFor(medication.id));
  if (waiting) return L(`${waiting.name} may be running low`, `${waiting.name} podría estarse acabando`, `${waiting.name} ka ap fini`);
  const moving = refillEpisodes().find(refillIsOpen);
  if (moving) return refillPatientStatus(moving, state.language);
  const count = activeMedications().length;
  return count ? L(`${count} medications on file`, `${count} medicamentos registrados`, `${count} medikaman nan dosye a`) : L("Nothing on file yet", "Nada registrado todavía", "Anyen nan dosye a poko");
}

const medicationIdentity = medication => `<div class="medication-identity">
  <span class="medication-icon">${icon("pill")}</span>
  <div><strong>${escapeHtml(medicationLabel(medication))}</strong>${medicationSig(medication) ? `<span>${escapeHtml(medicationSig(medication))}</span>` : ""}</div>
</div>`;

// Requested, approved and ready are three different facts. The card shows the one the product was
// told, and says what happens next in the patient's terms.
function medicationRefillCard(medication, episode) {
  const status = refillPatientStatus(episode, state.language);
  const nextStep = refillNextStep(episode, { pharmacyStatusAvailable: pharmacyStatusAvailable(medication) }, state.language);
  const destination = episode.status === REFILL_STATUS.PENDING_PRESCRIBER
    ? medicationPrescriber(medication)?.name || ""
    : [REFILL_STATUS.SENT_TO_PHARMACY, REFILL_STATUS.APPROVED, REFILL_STATUS.READY_FOR_PICKUP, REFILL_STATUS.PHARMACY_PROCESSING].includes(episode.status)
      ? medication.pharmacy?.name || ""
      : "";
  const ready = episode.status === REFILL_STATUS.READY_FOR_PICKUP;
  return `<article class="medication-card" data-refill-status="${episode.status}">
    ${medicationIdentity(medication)}
    <p class="medication-status">${ready ? icon("check") : icon("clock")}<span>${escapeHtml(status)}</span></p>
    ${destination ? `<p class="medication-destination">${escapeHtml(destination)}</p>` : ""}
    ${nextStep ? `<p class="medication-next-step">${escapeHtml(nextStep)}</p>` : ""}
    <button type="button" class="goal-card-action" data-action="view-refill-status" data-medication-id="${medication.id}">${episode.requiresAppointment ? L("View details", "Ver detalles", "Gade detay") : L("View status", "Ver estado", "Gade estati")} ${icon("arrowRight")}</button>
  </article>`;
}

function medicationSupplyCard(medication) {
  return `<article class="medication-card medication-card-low" data-refill-status="LOW_SUPPLY">
    ${medicationIdentity(medication)}
    <p class="medication-status">${icon("info")}<span>${escapeHtml(medicationSupplyLine(medication))}</span></p>
    <p class="medication-next-step">${L("EMMI can help you check whether you need a refill.", "EMMI puede ayudarle a confirmar si necesita una nueva surtida.", "EMMI ka ede w tcheke si ou bezwen yon ranplisaj.")}</p>
    <button type="button" class="goal-card-action" data-action="review-medication-refill" data-medication-id="${medication.id}">${L("Review refill", "Revisar surtida", "Revize ranplisaj")} ${icon("arrowRight")}</button>
  </article>`;
}

const medicationPlainCard = medication => `<article class="medication-card medication-card-quiet">${medicationIdentity(medication)}</article>`;

function myMedicationsScreen() {
  detectMedicationSupplySignals();
  const flow = state.refillFlow || {};
  if (flow.step && flow.medicationId) return medicationRefillFlow();
  const medications = activeMedications();
  const notice = state.medicationNotice ? `<p class="goal-notice" role="status">${escapeHtml(state.medicationNotice)}</p>` : "";
  const cards = medications.map(medication => {
    const episode = openRefillForMedication(medication.id);
    if (episode) return medicationRefillCard(medication, episode);
    if (openSupplySignalFor(medication.id)) return medicationSupplyCard(medication);
    return medicationPlainCard(medication);
  }).join("");
  return `${notice}${titleBlock(L("My medications", "Mis medicamentos", "Medikaman mwen yo"), L("Your medications on file, and anything that needs your attention.", "Sus medicamentos registrados y lo que necesita su atención.", "Medikaman ki nan dosye ou, ak sa ki bezwen atansyon ou."))}
    ${medications.length ? `<div class="medication-list">${cards}</div>` : `<p class="goal-progress-empty">${L("We don’t have any medications on file yet.", "Todavía no tenemos medicamentos registrados.", "Nou poko gen okenn medikaman nan dosye a.")}</p>`}
    <button type="button" class="goal-secondary-button" data-action="start-manual-refill">${icon("pill")}<span>${L("I need a refill", "Necesito una nueva surtida", "Mwen bezwen yon ranplisaj")}</span></button>
    <button type="button" class="goal-back-button" data-action="back-to-my-care">${icon("arrowLeft")}<span>${L("Back to My Care", "Volver a Mi cuidado", "Retounen nan Swen mwen")}</span></button>`;
}

// Which medication? Only asked when it is genuinely ambiguous, and always from the patient's own
// active list rather than a guess.
function medicationSelectionScreen() {
  const medications = activeMedications();
  return `${titleBlock(L("Which medication do you need?", "¿Qué medicamento necesita?", "Ki medikaman ou bezwen?"), L("Choose the one you’re running low on.", "Elija el que se le está acabando.", "Chwazi sa k ap fini an."), L("Refill", "Surtida", "Ranplisaj"))}
    <div class="choice-list medication-choices">${medications.map(medication => `<button type="button" class="goal-response-button" data-action="review-medication-refill" data-medication-id="${medication.id}">${icon("pill")}<span>${escapeHtml(medicationLabel(medication))}</span></button>`).join("")}</div>
    <button type="button" class="goal-inline-link" data-action="ask-emmi-about-refill">${L("It’s something else", "Es otro medicamento", "Se yon lòt bagay")} ${icon("arrowRight")}</button>
    <div class="actions">${cta(t().back, "close-refill-flow", true)}</div>`;
}

// What ITERA already knows is shown for confirmation rather than asked again.
function refillReviewScreen(medication) {
  const prescriber = medicationPrescriber(medication);
  return `${titleBlock(L("Review refill", "Revisar surtida", "Revize ranplisaj"), "", L("Refill", "Surtida", "Ranplisaj"))}
    <section class="medication-summary">
      ${medicationIdentity(medication)}
      <dl class="medication-facts">
        ${prescriber ? `<div><dt>${L("Prescriber", "Quien la receta", "Moun ki bay preskripsyon an")}</dt><dd>${escapeHtml(prescriber.name)}</dd></div>` : ""}
        ${medication.pharmacy ? `<div><dt>${L("Pharmacy", "Farmacia", "Famasi")}</dt><dd>${escapeHtml(medication.pharmacy.name)}${medication.pharmacy.address ? `<small>${escapeHtml(medication.pharmacy.address)}</small>` : ""}</dd></div>` : ""}
      </dl>
      <button type="button" class="goal-inline-link" data-action="change-refill-pharmacy">${L("Need to use another pharmacy?", "¿Necesita usar otra farmacia?", "Bezwen sèvi ak yon lòt famasi?")}</button>
    </section>
    <h2 class="medication-question">${L("Do you still take this medication as directed?", "¿Sigue tomando este medicamento según las indicaciones?", "Èske ou toujou pran medikaman sa a jan yo mande a?")}</h2>
    <div class="choice-list medication-answers">
      <button type="button" class="goal-response-button" data-action="refill-taking-answer" data-answer="YES">${L("Yes", "Sí", "Wi")}</button>
      <button type="button" class="goal-response-button" data-action="refill-taking-answer" data-answer="CHANGED">${L("Something changed", "Algo cambió", "Yon bagay chanje")}</button>
      <button type="button" class="goal-response-button" data-action="refill-taking-answer" data-answer="STOPPED">${L("I no longer take it", "Ya no lo tomo", "Mwen pa pran li ankò")}</button>
      <button type="button" class="goal-response-button" data-action="refill-taking-answer" data-answer="UNSURE">${L("I’m not sure", "No estoy seguro", "Mwen pa sèten")}</button>
    </div>
    <div class="actions">${cta(t().back, "close-refill-flow", true)}</div>`;
}

// "Something changed" never continues to a refill. It asks what changed, and each answer goes
// where it belongs: reconciliation, or the safety engine.
function refillChangeScreen(medication) {
  return `${titleBlock(L("What changed?", "¿Qué cambió?", "Kisa ki chanje?"), L("This helps your care team keep your record right.", "Esto ayuda a su equipo a mantener su información correcta.", "Sa ede ekip swen ou kenbe dosye ou kòrèk."), L("Refill", "Surtida", "Ranplisaj"))}
    ${medicationIdentity(medication)}
    <div class="choice-list medication-answers">
      <button type="button" class="goal-response-button" data-action="refill-change-answer" data-change="DOSE">${L("I take a different dose", "Tomo una dosis diferente", "Mwen pran yon dòz diferan")}</button>
      <button type="button" class="goal-response-button" data-action="refill-change-answer" data-change="FREQUENCY">${L("I take it at different times", "Lo tomo en horarios diferentes", "Mwen pran l nan lòt lè")}</button>
      <button type="button" class="goal-response-button" data-action="refill-change-answer" data-change="CONCERN">${L("It makes me feel unwell", "Me hace sentir mal", "Li fè m santi m mal")}</button>
      <button type="button" class="goal-response-button" data-action="refill-change-answer" data-change="OTHER">${L("Something else", "Otra cosa", "Yon lòt bagay")}</button>
    </div>
    <div class="actions">${cta(t().back, "close-refill-flow", true)}</div>`;
}

function refillDoseScreen(medication) {
  return `${titleBlock(L("What dose are you taking?", "¿Qué dosis está tomando?", "Ki dòz w ap pran?"), L("Your care team will review this. Nothing changes automatically.", "Su equipo lo revisará. Nada cambia automáticamente.", "Ekip swen ou ap revize sa. Anyen pa chanje otomatikman."), L("Refill", "Surtida", "Ranplisaj"))}
    ${medicationIdentity(medication)}
    <p class="medication-documented">${L("On file", "En el registro", "Nan dosye a")}: ${escapeHtml(medicationDetails(medication) || medicationSig(medication))}</p>
    <form id="refill-dose-form"><label class="field">${L("What you take", "Lo que usted toma", "Sa ou pran")}<input name="patientReportedDose" maxlength="80" placeholder="${L("Example: 10 mg twice a day", "Ejemplo: 10 mg dos veces al día", "Egzanp: 10 mg de fwa pa jou")}"></label></form>
    <p class="form-error" role="alert">${state.error || ""}</p>
    <div class="actions">${cta(t().back, "close-refill-flow", true)}${cta(L("Send to my care team", "Enviar a mi equipo", "Voye bay ekip mwen"), "submit-refill-dose")}</div>`;
}

// Asking for a rough answer, not a pill count.
function refillSupplyScreen(medication) {
  return `${titleBlock(L("Do you have about a week or less remaining?", "¿Le queda alrededor de una semana o menos?", "Èske ou gen apeprè yon semèn oswa mwens ki rete?"), "", L("Refill", "Surtida", "Ranplisaj"))}
    ${medicationIdentity(medication)}
    <div class="choice-list medication-answers">
      <button type="button" class="goal-response-button" data-action="refill-supply-answer" data-answer="RUNNING_LOW">${L("Yes, I’m running low", "Sí, se me está acabando", "Wi, l ap fini")}</button>
      <button type="button" class="goal-response-button" data-action="refill-supply-answer" data-answer="ENOUGH">${L("I have enough", "Tengo suficiente", "Mwen gen ase")}</button>
      <button type="button" class="goal-response-button" data-action="refill-supply-answer" data-answer="UNSURE">${L("I’m not sure", "No estoy seguro", "Mwen pa sèten")}</button>
    </div>
    <div class="actions">${cta(t().back, "close-refill-flow", true)}</div>`;
}

// The last screen before anything leaves ITERA: what will be sent, and where.
function refillConfirmScreen(medication, resolution) {
  const prescriber = medicationPrescriber(medication);
  const destination = resolution.path === REFILL_PATHS.DIRECT_PHARMACY_FULFILLMENT
    ? medication.pharmacy?.name || ""
    : prescriber?.name || L("your care team", "su equipo de atención", "ekip swen ou");
  return `${titleBlock(L("Ready to request", "Listo para solicitar", "Pare pou mande"), "", L("Refill", "Surtida", "Ranplisaj"))}
    <section class="medication-summary">
      ${medicationIdentity(medication)}
      <dl class="medication-facts">
        <div><dt>${L("Request goes to", "La solicitud se envía a", "Demann nan ale bay")}</dt><dd>${escapeHtml(destination)}</dd></div>
        ${medication.pharmacy && destination !== medication.pharmacy.name ? `<div><dt>${L("Pharmacy", "Farmacia", "Famasi")}</dt><dd>${escapeHtml(medication.pharmacy.name)}</dd></div>` : ""}
      </dl>
    </section>
    <p class="form-error" role="alert">${state.error || ""}</p>
    <div class="actions">${cta(L("Not now", "Ahora no", "Pa kounye a"), "close-refill-flow", true)}${cta(L("Request refill", "Solicitar surtida", "Mande ranplisaj"), "submit-refill-request")}</div>`;
}

// Where the request stands, in the patient's words, with only the actions that actually exist.
function refillStatusScreen(medication, episode) {
  const prescriber = medicationPrescriber(medication);
  const status = refillPatientStatus(episode, state.language);
  const nextStep = refillNextStep(episode, { pharmacyStatusAvailable: pharmacyStatusAvailable(medication) }, state.language);
  const heading = episode.status === REFILL_STATUS.NEEDS_APPOINTMENT
    ? L("One more step is needed", "Falta un paso más", "Gen yon etap ki manke")
    : episode.status === REFILL_STATUS.NEEDS_CLINICAL_REVIEW
      ? L("Your care team needs to review this", "Su equipo de atención debe revisar esto", "Ekip swen ou dwe revize sa")
      : status;
  const explanation = episode.status === REFILL_STATUS.NEEDS_APPOINTMENT
    ? L("Your care team requires a follow-up visit before this medication can be renewed.", "Su equipo requiere una visita de seguimiento antes de renovar este medicamento.", "Ekip swen ou mande yon vizit swivi anvan yo ka renouvle medikaman sa a.")
    : episode.status === REFILL_STATUS.NEEDS_CLINICAL_REVIEW
      ? L("You told EMMI something about this medication that your care team should look at before the refill continues.", "Le contó a EMMI algo sobre este medicamento que su equipo debe revisar antes de continuar.", "Ou di EMMI yon bagay sou medikaman sa a ekip swen ou dwe gade anvan ranplisaj la kontinye.")
      : episode.status === REFILL_STATUS.PENDING_PRESCRIBER
        ? L(`Request sent to ${prescriber?.name || "your care team"}.`, `Solicitud enviada a ${prescriber?.name || "su equipo de atención"}.`, `Demann voye bay ${prescriber?.name || "ekip swen ou"}.`)
        : episode.status === REFILL_STATUS.SENT_TO_PHARMACY
          ? L(`Your refill was sent to ${medication.pharmacy?.name || "your pharmacy"}.`, `Su surtida fue enviada a ${medication.pharmacy?.name || "su farmacia"}.`, `Ranplisaj ou voye nan ${medication.pharmacy?.name || "famasi ou"}.`)
          : "";
  return `${titleBlock(heading, "", L("Refill", "Surtida", "Ranplisaj"))}
    <section class="medication-summary">
      ${medicationIdentity(medication)}
      ${heading === status ? "" : `<p class="medication-status">${episode.status === REFILL_STATUS.READY_FOR_PICKUP ? icon("check") : icon("clock")}<span>${escapeHtml(status)}</span></p>`}
      ${explanation ? `<p class="medication-next-step">${escapeHtml(explanation)}</p>` : ""}
      ${nextStep ? `<p class="medication-next-step">${escapeHtml(nextStep)}</p>` : ""}
    </section>
    ${episode.status === REFILL_STATUS.NEEDS_APPOINTMENT ? `<button type="button" class="goal-secondary-button" data-action="coordinate-refill-appointment" data-medication-id="${medication.id}">${icon("calendar")}<span>${L("Coordinate appointment", "Coordinar la cita", "Òganize randevou a")}</span></button>` : ""}
    ${[REFILL_STATUS.SENT_TO_PHARMACY, REFILL_STATUS.READY_FOR_PICKUP, REFILL_STATUS.APPROVED].includes(episode.status) && medication.pharmacy?.phone ? `<a class="goal-secondary-button" href="tel:${escapeHtml(medication.pharmacy.phone)}">${icon("phone")}<span>${L("Call the pharmacy", "Llamar a la farmacia", "Rele famasi a")}</span></a>` : ""}
    ${[REFILL_STATUS.SENT_TO_PHARMACY, REFILL_STATUS.READY_FOR_PICKUP, REFILL_STATUS.APPROVED].includes(episode.status) ? `<button type="button" class="goal-secondary-button" data-action="refill-pickup-check" data-medication-id="${medication.id}">${icon("question")}<span>${L("Were you able to get it?", "¿Pudo recogerlo?", "Èske ou te ka jwenn li?")}</span></button>` : ""}
    <button type="button" class="goal-inline-link" data-action="ask-emmi-about-refill">${L("Ask EMMI about this", "Preguntar a EMMI sobre esto", "Mande EMMI sou sa")} ${icon("arrowRight")}</button>
    <div class="actions">${cta(t().back, "close-refill-flow", true)}</div>`;
}

// Approved is not obtained. This is the question that closes the loop, and its "not yet" hands
// straight to the barrier engine.
function refillPickupScreen(medication) {
  return `${titleBlock(L(`Were you able to get your ${medication.name}?`, `¿Pudo recoger su ${medication.name}?`, `Èske ou te ka jwenn ${medication.name} ou?`), "", L("Refill", "Surtida", "Ranplisaj"))}
    <div class="choice-list medication-answers">
      <button type="button" class="goal-response-button" data-action="refill-pickup-answer" data-answer="YES">${L("Yes", "Sí", "Wi")}</button>
      <button type="button" class="goal-response-button" data-action="refill-pickup-answer" data-answer="NOT_YET">${L("Not yet", "Todavía no", "Poko")}</button>
    </div>
    <div class="actions">${cta(t().back, "close-refill-flow", true)}</div>`;
}

// The difficulties that stop a refill from becoming medication in the patient's hand. Each one is
// a barrier category the shared engine already knows how to work on.
function refillBarrierScreen(medication) {
  const options = [
    ["PHARMACY_NOT_READY", "clock", L("The pharmacy says it isn’t ready", "La farmacia dice que no está lista", "Famasi a di li poko pare")],
    ["TRANSPORTATION", "car", L("I can’t get to the pharmacy", "No puedo llegar a la farmacia", "Mwen pa ka rive nan famasi a")],
    ["FINANCIAL", "info", L("It costs too much", "Cuesta demasiado", "Li koute twòp")],
    ["MEDICATION_UNDERSTANDING", "pill", L("I have a question about the medication", "Tengo una pregunta sobre el medicamento", "Mwen gen yon kesyon sou medikaman an")],
    ["SOCIAL_SUPPORT", "people", L("I need someone to help me", "Necesito que alguien me ayude", "Mwen bezwen yon moun ede m")],
    ["OTHER", "question", L("Something else", "Otra cosa", "Yon lòt bagay")]
  ];
  return `${titleBlock(L("What’s making it difficult?", "¿Qué se lo está dificultando?", "Kisa k ap fè sa difisil?"), L("EMMI can help with many of these.", "EMMI puede ayudar con muchas de estas.", "EMMI ka ede ak anpil nan sa yo."), L("Refill", "Surtida", "Ranplisaj"))}
    ${medicationIdentity(medication)}
    <div class="choice-list medication-answers">${options.map(([value, glyph, label]) => `<button type="button" class="goal-response-button" data-action="refill-barrier-answer" data-barrier="${value}">${icon(glyph)}<span>${label}</span></button>`).join("")}</div>
    <div class="actions">${cta(t().back, "close-refill-flow", true)}</div>`;
}

function medicationRefillFlow() {
  const flow = state.refillFlow || {};
  const medication = medicationById(flow.medicationId);
  if (!medication) return myMedicationsScreen();
  if (flow.step === "SELECT") return medicationSelectionScreen();
  if (flow.step === "REVIEW") return refillReviewScreen(medication);
  if (flow.step === "CHANGED") return refillChangeScreen(medication);
  if (flow.step === "DOSE") return refillDoseScreen(medication);
  if (flow.step === "SUPPLY") return refillSupplyScreen(medication);
  if (flow.step === "CONFIRM") return refillConfirmScreen(medication, state.refillResolution || {});
  if (flow.step === "PICKUP") return refillPickupScreen(medication);
  if (flow.step === "PICKUP_BARRIER") return refillBarrierScreen(medication);
  const episode = openRefillForMedication(medication.id) || activeRefillEpisode();
  return episode ? refillStatusScreen(medication, episode) : myMedicationsScreen();
}

function myCareScreen() {
  const transition = currentFlowTransition();
  const progress = gettingStartedProgress();
  const started = progress.status === FLOW_STATUS.IN_PROGRESS;
  const actionLabel = started ? L("Continue where you left off", "Continuar donde lo dejó", "Kontinye kote ou te rete a") : L("Continue setting up your care", "Continuar configurando su cuidado", "Kontinye mete swen ou an plas");
  return `<div class="my-care-screen">${titleBlock(L("My Care", "Mi cuidado", "Swen mwen"), L("Your enrollment is complete. Continue when you’re ready.", "Su inscripción está completa. Continúe cuando esté listo.", "Enskripsyon ou fini. Kontinye lè ou pare."))}
    <section class="my-care-resume-card"><div>${icon("check")}<span><strong>${L("Getting Started", "Primeros pasos", "Premye etap yo")}</strong><small>${started ? L("In progress", "En curso", "An pwogrè") : L("Not finished yet", "Aún no terminado", "Poko fini")}</small></span></div>${transition.estimatedDuration ? `<p>${icon("clock")} ${localized(transition.estimatedDuration)}</p>` : ""}${cta(actionLabel, "resume-next-flow")}</section>
    ${upcomingCareSection(appointmentViewProps({ appointments: appointmentRecords() }))}
    ${needAnAppointmentCard({ locale: state.language, icon })}
    <button type="button" class="link-card my-care-team-link" data-action="open-my-care-team">${icon("physician")}<span><strong>${L("My Care Team", "Mi equipo de cuidado", "Ekip swen mwen")}</strong><small>${L("See who is supporting your care", "Vea quién está apoyando su cuidado", "Gade kiyès k ap sipòte swen ou")}</small></span><b aria-hidden="true">›</b></button>
    <button type="button" class="link-card my-goals-link" data-action="open-my-goals">${icon("goals")}<span><strong>${L("My Goals", "Mis metas", "Objektif mwen")}</strong><small>${activePatientGoals().length ? L("View the goals you’re working toward", "Vea las metas en las que está trabajando", "Gade objektif w ap travay sou yo") : L("Choose what matters to you", "Elija lo que le importa", "Chwazi sa ki enpòtan pou ou")}</small></span><b aria-hidden="true">›</b></button>
    <button type="button" class="link-card my-medications-link" data-action="open-my-medications">${icon("pill")}<span><strong>${L("My Medications", "Mis medicamentos", "Medikaman mwen yo")}</strong><small>${medicationAttentionLine()}</small></span><b>›</b></button>
    <button type="button" class="link-card my-care-circle-link" data-action="open-my-care-circle">${icon("people")}<span><strong>${L("My Care Circle", "Mi Círculo de cuidado", "Sèk swen mwen")}</strong><small>${L("Invite or manage someone you trust", "Invite o administre a alguien de confianza", "Envite oswa jere yon moun ou fè konfyans")}</small></span><b aria-hidden="true">›</b></button>
  </div>`;
}

const careTeamRoleLabel = member => ({
  [PROFESSIONAL_TYPES.PRIMARY_CARE]: L("Primary care doctor", "Médico de atención primaria", "Doktè prensipal"),
  [PROFESSIONAL_TYPES.SPECIALIST]: member?.specialty === "Cardiology" ? L("Cardiologist", "Cardiólogo", "Kadyològ") : L("Specialist", "Especialista", "Espesyalis"),
  [PROFESSIONAL_TYPES.CARE_MANAGER]: L("Care Manager", "Coordinador de cuidado", "Jesyonè swen"),
  [PROFESSIONAL_TYPES.PHARMACIST]: L("Pharmacy", "Farmacia", "Famasi"),
  [PROFESSIONAL_TYPES.NURSE]: L("Nurse", "Enfermero o enfermera", "Enfimyè"),
  [PROFESSIONAL_TYPES.DEVICE_SUPPORT]: L("Device support", "Soporte de dispositivos", "Sipò aparèy"),
  [PROFESSIONAL_TYPES.UNKNOWN]: L("Care professional", "Profesional de cuidado", "Pwofesyonèl swen")
}[member?.professionalType] || L("Care professional", "Profesional de cuidado", "Pwofesyonèl swen"));

const careTeamMemberIcon = member => ({
  [PROFESSIONAL_TYPES.PHARMACIST]: "pill",
  [PROFESSIONAL_TYPES.CARE_MANAGER]: "people",
  [PROFESSIONAL_TYPES.NURSE]: "people",
  [PROFESSIONAL_TYPES.DEVICE_SUPPORT]: "device"
}[member?.professionalType] || "physician");

const visibleCareTeam = () => patientCareTeam()
  .sort((a, b) => ({ [PROFESSIONAL_TYPES.PRIMARY_CARE]: 0, [PROFESSIONAL_TYPES.SPECIALIST]: 1, [PROFESSIONAL_TYPES.CARE_MANAGER]: 2 }[a.professionalType] ?? 3)
    - ({ [PROFESSIONAL_TYPES.PRIMARY_CARE]: 0, [PROFESSIONAL_TYPES.SPECIALIST]: 1, [PROFESSIONAL_TYPES.CARE_MANAGER]: 2 }[b.professionalType] ?? 3));

const careTeamRoleOptions = () => [
  ["PRIMARY_CARE", L("Primary care doctor", "Médico de atención primaria", "Doktè prensipal")],
  ["CARDIOLOGIST", L("Cardiologist", "Cardiólogo", "Kadyològ")],
  ["SPECIALIST", L("Other specialist", "Otro especialista", "Lòt espesyalis")],
  ["CARE_MANAGER", L("Care Manager", "Coordinador de cuidado", "Jesyonè swen")],
  ["NURSE", L("Nurse", "Enfermero o enfermera", "Enfimyè")],
  ["OTHER", L("Other care professional", "Otro profesional de cuidado", "Lòt pwofesyonèl swen")]
];

function careTeamAddForm() {
  const draft = state.careTeamMemberDraft || {};
  const specialist = draft.role === "SPECIALIST";
  return `<section class="care-team-add-panel" aria-labelledby="care-team-add-title">
    <div class="care-team-add-heading"><span aria-hidden="true">${icon("userPlus")}</span><div><h2 id="care-team-add-title">${L("Add a care team member", "Agregar un miembro del equipo", "Ajoute yon manm ekip swen")}</h2><p>${L("Add a professional who is part of your care.", "Agregue un profesional que forma parte de su cuidado.", "Ajoute yon pwofesyonèl ki fè pati swen ou.")}</p></div></div>
    <form id="care-team-member-form" novalidate>
      <label><span>${L("Professional’s name", "Nombre del profesional", "Non pwofesyonèl la")}</span><input name="careTeamDisplayName" value="${escapeHtml(draft.displayName || "")}" maxlength="80" autocomplete="name" required></label>
      <label><span>${L("Role", "Función", "Wòl")}</span><select name="careTeamRole" required><option value="">${L("Select a role", "Seleccione una función", "Chwazi yon wòl")}</option>${careTeamRoleOptions().map(([value, label]) => `<option value="${value}" ${draft.role === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      ${specialist ? `<label><span>${L("Specialty", "Especialidad", "Espesyalite")}</span><input name="careTeamSpecialty" value="${escapeHtml(draft.specialty || "")}" maxlength="60" required></label>` : ""}
      <label><span>${L("Practice or clinic", "Consultorio o clínica", "Klinik oswa kabinè")}</span><small>${L("Optional", "Opcional", "Opsyonèl")}</small><input name="careTeamPracticeName" value="${escapeHtml(draft.practiceName || "")}" maxlength="80"></label>
      <p class="care-team-form-error" role="alert">${state.careTeamNotice || ""}</p>
      <div class="care-team-add-actions"><button type="button" class="button secondary" data-action="cancel-care-team-member">${L("Cancel", "Cancelar", "Anile")}</button><button type="button" class="button primary" data-action="save-care-team-member" disabled>${L("Add to my care team", "Agregar a mi equipo", "Ajoute nan ekip mwen")}</button></div>
    </form>
  </section>`;
}

// "Alicia Ramírez, RN" becomes AR; "Dr. Fresner Lee" becomes FL. Honorifics and trailing credentials are
// dropped because they are shared by half the list and initials that all read DR distinguish nobody.
const careTeamInitials = name => String(name || "")
  .split(",")[0]
  .replace(/\b(dr|dra|mr|mrs|ms|prof)\.?\s+/gi, "")
  .trim().split(/\s+/).filter(Boolean).slice(0, 2)
  .map(word => [...word][0]).join("").toUpperCase();

// A photo when the record holds one, initials when it does not, and an icon for the entries that are
// not people at all. A pharmacy given initials would read as a person who does not exist, which is
// the same invention this file spends its comments refusing to make.
function careTeamMemberAvatar(member) {
  if (member.photoUrl) return `<img class="care-team-member-photo" src="${escapeHtml(member.photoUrl)}" alt="">`;
  const initials = member.professionalType === PROFESSIONAL_TYPES.PHARMACIST ? "" : careTeamInitials(member.displayName);
  return initials
    ? `<span class="care-team-member-initials" aria-hidden="true">${escapeHtml(initials)}</span>`
    : `<span class="care-team-member-icon" aria-hidden="true">${icon(careTeamMemberIcon(member))}</span>`;
}

function myCareTeamScreen() {
  const team = visibleCareTeam();
  const verifiedLabel = L("Verified", "Verificado", "Verifye");
  const members = team.length ? team.map(member => {
    const detail = [careTeamRoleLabel(member), member.practiceName].filter(Boolean).join(" · ");
    return `<article class="care-team-member-card">
      ${careTeamMemberAvatar(member)}
      <div class="care-team-member-copy"><div class="care-team-member-name"><strong>${escapeHtml(member.displayName)}</strong>${member.verified ? `<span class="care-team-verified">${icon("check")}<span>${verifiedLabel}</span></span>` : ""}</div><p>${escapeHtml(detail)}</p></div>
    </article>`;
  }).join("") : `<div class="care-team-empty">${icon("people")}<strong>${L("Your care team details are not available yet", "Los detalles de su equipo de cuidado aún no están disponibles", "Detay ekip swen ou poko disponib")}</strong><p>${L("ITERA can help you review who supports your care.", "ITERA puede ayudarle a revisar quién apoya su cuidado.", "ITERA ka ede w revize kiyès k ap sipòte swen ou.")}</p></div>`;
  return `<div class="my-care-team-screen">${titleBlock(L("My Care Team", "Mi equipo de cuidado", "Ekip swen mwen"), L("See the healthcare professionals who support your care.", "Vea los profesionales de salud que apoyan su cuidado.", "Gade pwofesyonèl sante ki sipòte swen ou."), L("Your care", "Su cuidado", "Swen ou"))}
    <section class="care-team-members" aria-label="${L("Your care team", "Su equipo de cuidado", "Ekip swen ou")}">${members}</section>
    ${state.careTeamAddOpen ? careTeamAddForm() : `<button type="button" class="care-team-add-button" data-action="open-care-team-member">${icon("userPlus")}<span>${L("Add a care team member", "Agregar un miembro del equipo", "Ajoute yon manm ekip swen")}</span>${icon("arrowRight")}</button>`}
    <p class="care-team-success" role="status" aria-live="polite">${state.careTeamAddOpen ? "" : state.careTeamNotice}</p>
    <aside class="care-team-boundary-note">${icon("info")}<p>${L("This list can include information from your care record and professionals you add.", "Esta lista puede incluir información de su registro de cuidado y profesionales que usted agregue.", "Lis sa a ka gen enfòmasyon nan dosye swen ou ak pwofesyonèl ou ajoute.")}</p></aside>
    <div class="actions">${cta(t().back, "back", true)}</div>
  </div>`;
}

const careCircleRelationshipLabel = value => ({ spouse: L("Spouse", "Cónyuge", "Konjwen"), child: L("Child", "Hijo o hija", "Pitit"), family: L("Family member", "Familiar", "Manm fanmi"), caregiver: L("Caregiver", "Cuidador", "Moun k ap bay swen"), friend: L("Friend", "Amigo o amiga", "Zanmi"), other: L("Other", "Otro", "Lòt") }[value] || value || L("Support person", "Persona de apoyo", "Moun sipò"));
const careCircleStatusLabel = status => ({ PENDING: L("Pending", "Pendiente", "Annatant"), ACCEPTED: L("Active", "Activo", "Aktif"), EXPIRED: L("Expired", "Vencida", "Ekspire"), CANCELED: L("Canceled", "Cancelada", "Anile") }[status] || status);

function myCareCircleScreen() {
  const invites = growthStore.allSupportInvites().filter(invite => invite.inviterPatientId === state.offer?.patient?.id && !invite.removedAt);
  const cards = invites.length ? invites.map(invite => `<article class="care-circle-member-card"><div class="care-circle-member-heading">${icon(invite.status === "ACCEPTED" ? "check" : "people")}<span><strong>${escapeHtml(invite.supportPerson.name)}</strong><small>${careCircleRelationshipLabel(invite.supportPerson.relationship)} · ${maskPhone(invite.supportPerson.phone)}</small></span><em data-status="${invite.status}">${careCircleStatusLabel(invite.status)}</em></div><details><summary>${L("Manage", "Administrar", "Jere")}</summary><div class="care-circle-manage-actions">${invite.status === "PENDING" ? `<button type="button" data-action="resend-care-circle" data-invite-id="${invite.inviteId}">${L("Resend invitation", "Reenviar invitación", "Voye envitasyon ankò")}</button><button type="button" data-action="cancel-care-circle" data-invite-id="${invite.inviteId}">${L("Cancel invitation", "Cancelar invitación", "Anile envitasyon")}</button>` : invite.status === "ACCEPTED" ? `<button type="button" data-action="manage-care-circle-permissions" data-invite-id="${invite.inviteId}">${L("Manage support", "Administrar apoyo", "Jere sipò")}</button><button type="button" class="danger-text" data-action="confirm-remove-care-circle" data-invite-id="${invite.inviteId}">${L("Remove", "Eliminar", "Retire")}</button>` : `<button type="button" data-action="invite-another-care-circle">${L("Send a new invitation", "Enviar una nueva invitación", "Voye yon nouvo envitasyon")}</button>`}</div></details></article>`).join("") : `<div class="care-circle-empty">${icon("people")}<strong>${L("No one is in your Care Circle yet", "Aún no hay nadie en su Círculo de cuidado", "Poko gen moun nan Sèk swen ou")}</strong><p>${L("You can invite someone you trust whenever you’re ready.", "Puede invitar a alguien de confianza cuando esté listo.", "Ou ka envite yon moun ou fè konfyans lè ou pare.")}</p></div>`;
  return `${titleBlock(L("My Care Circle", "Mi Círculo de cuidado", "Sèk swen mwen"), L("People you invite can provide basic support. You remain in control of your healthcare decisions.", "Las personas que invite pueden brindar apoyo básico. Usted mantiene el control de sus decisiones médicas.", "Moun ou envite ka bay sipò debaz. Se ou ki kontwole desizyon swen sante ou."), L("Your care", "Su cuidado", "Swen ou"))}<div class="care-circle-members">${cards}</div><p class="growth-notice" role="status" aria-live="polite">${state.careCircleNotice || ""}</p><div class="actions">${cta(L("Back", "Atrás", "Retounen"), "back", true)}${cta(L("Invite someone", "Invitar a alguien", "Envite yon moun"), "invite-another-care-circle")}</div>`;
}

function careCircleRemoveConfirmation() {
  const invite = growthStore.allSupportInvites().find(item => item.inviteId === state.careCircleRemovePendingId);
  const name = invite?.supportPerson?.name || L("this person", "esta persona", "moun sa a");
  return `${art("people")}${titleBlock(L(`Remove ${name} from your Care Circle?`, `¿Eliminar a ${name} de su Círculo de cuidado?`, `Retire ${name} nan Sèk swen ou?`), L("They will no longer receive Care Circle support access. This does not change your care.", "Ya no tendrá acceso al apoyo del Círculo de cuidado. Esto no cambia su cuidado.", "Moun nan p ap gen aksè ak sipò Sèk swen ankò. Sa pa chanje swen ou."), L("Your care", "Su cuidado", "Swen ou"))}<div class="actions">${cta(L("Keep them", "Mantener", "Kenbe moun nan"), "keep-care-circle-member", true)}${cta(L("Remove", "Eliminar", "Retire"), "remove-care-circle-member")}</div>`;
}

// Explain, disclose, reassure, continue. The disclosures themselves are not negotiable — the CMS
// data exchange, the evaluation, the random assignment, the comparison group, the twelve months and
// the protection of the patient's Medicare all stay. What changed is that the screen now opens by
// saying what is about to happen and why, so the disclosures land as context rather than as fine
// print the patient has to get past.
function accessNotice() {
  const noticeRows = [
    ["lock", L("A secure check with Medicare", "Una verificación segura con Medicare", "Yon verifikasyon an sekirite avèk Medicare"), L("ITERA and Medicare can securely exchange the information needed to confirm your eligibility for ACCESS.", "ITERA y Medicare pueden intercambiar de forma segura la información necesaria para confirmar su elegibilidad para ACCESS.", "ITERA ak Medicare ka echanje an sekirite enfòmasyon ki nesesè pou konfime kalifikasyon ou pou ACCESS.")],
    ["document", L("How the ACCESS evaluation works", "Cómo funciona la evaluación de ACCESS", "Kijan evalyasyon ACCESS la fonksyone"), L("Medicare also evaluates how ACCESS works, and may request information for that evaluation. As part of it, some people are randomly selected for a comparison group. If that happens to you, you would not be able to take part in ACCESS for 12 months.", "Medicare también evalúa cómo funciona ACCESS y puede solicitar información para esa evaluación. Como parte de ella, algunas personas son seleccionadas al azar para un grupo de comparación. Si esto le ocurre, no podrá participar en ACCESS durante 12 meses.", "Medicare evalye tou kijan ACCESS fonksyone, epi li ka mande enfòmasyon pou evalyasyon sa a. Nan kad li, yo chwazi kèk moun o aza pou yon gwoup konparezon. Si sa rive ou, ou pa ta kapab patisipe nan ACCESS pandan 12 mwa.")],
    ["shield", L("Your Medicare stays the same", "Su Medicare permanece igual", "Medicare ou rete menm jan an"), L("This eligibility check and any comparison group assignment do not change your Medicare benefits, coverage, or rights.", "Esta verificación de elegibilidad y cualquier asignación a un grupo de comparación no cambian sus beneficios, cobertura ni derechos de Medicare.", "Verifikasyon kalifikasyon sa a ak nenpòt plasman nan yon gwoup konparezon pa chanje benefis, kouvèti oswa dwa Medicare ou.")]
  ];
  return `${titleBlock(L("Let’s confirm your eligibility with Medicare", "Confirmemos su elegibilidad con Medicare", "Ann konfime kalifikasyon ou avèk Medicare"), L("Medicare will review a few details to confirm you can take part in ACCESS. This only takes a moment and does not change your Medicare coverage.", "Medicare revisará algunos datos para confirmar que puede participar en ACCESS. Esto solo toma un momento y no cambia su cobertura de Medicare.", "Medicare ap revize kèk detay pou konfime ou ka patisipe nan ACCESS. Sa pran yon ti moman sèlman epi li pa chanje kouvèti Medicare ou."))}
    <section class="access-precheck-list">${noticeRows.map(([rowIcon, headline, copy]) => `<div class="access-precheck-row">${icon(rowIcon)}<div><strong>${headline}</strong><p>${copy}</p></div></div>`).join("")}</section>
    ${check("accessNotice", L("I understand this information and want to continue with the Medicare eligibility check", "Entiendo esta información y deseo continuar con la verificación de elegibilidad de Medicare", "Mwen konprann enfòmasyon sa a epi mwen vle kontinye ak verifikasyon kalifikasyon Medicare a"))}<p class="form-error" role="alert">${state.error}</p>${actions(L("Check my eligibility", "Verificar mi elegibilidad", "Tcheke kalifikasyon mwen"), true, "", true)}`;
}

function eligibilityProcessing() {
  if (state.eligibilityError) return `${art("medicare")}${titleBlock(L("We couldn’t complete the check right now.", "No pudimos completar la verificación en este momento.", "Nou pa t kapab fini verifikasyon an kounye a."), L("Your information is safe. Please try again or contact our care team.", "Su información está segura. Inténtelo de nuevo o comuníquese con nuestro equipo de cuidado.", "Enfòmasyon ou an sekirite. Tanpri eseye ankò oswa kontakte ekip swen nou an."))}${actions(L("Try again", "Intentar de nuevo", "Eseye ankò"), false, L("Get help", "Obtener ayuda", "Jwenn èd"))}`;
  const phases = ["verifyingCoverage", "checkingEnrollment", "confirmingOption"];
  const current = state.eligibilityPhase === "completed" ? phases.length : Math.max(0, phases.indexOf(state.eligibilityPhase));
  const steps = [
    [L("Verifying Medicare coverage", "Verificando cobertura de Medicare", "Verifye kouvèti Medicare"), "check"],
    [L("Checking for an existing ACCESS enrollment", "Buscando una inscripción ACCESS existente", "Tcheke si gen yon enskripsyon ACCESS deja"), "clock"],
    [L("Confirming your ACCESS care option", "Confirmando su opción de cuidado ACCESS", "Konfime opsyon swen ACCESS ou"), "clock"]
  ];
  return `${art("medicare")}${titleBlock(L("Checking your Medicare eligibility", "Verificando su elegibilidad de Medicare", "N ap verifye kalifikasyon Medicare ou"), L("We’re securely checking whether this ACCESS care option is available to you.", "Estamos verificando de forma segura si esta opción de cuidado ACCESS está disponible para usted.", "N ap verifye an sekirite si opsyon swen ACCESS sa a disponib pou ou."))}<ol class="process-list" aria-live="polite">${steps.map(([label, statusIcon], index) => `<li class="${index < current ? "done" : index === current ? "active" : "pending"}" data-process-state="${index < current ? "completed" : index === current ? "in-progress" : "pending"}" ${index === current ? 'aria-current="step"' : ""}>${icon(index < current ? "check" : statusIcon)}<span>${label}</span></li>`).join("")}</ol>`;
}

function medicareIdentifier() {
  return `${titleBlock(L("Confirm your Medicare information", "Confirme su información de Medicare", "Konfime enfòmasyon Medicare ou yo"), L("We couldn’t verify the Medicare number we have on file.", "No pudimos verificar el número de Medicare registrado.", "Nou pa t kapab verifye nimewo Medicare nou genyen nan dosye a."))}
    <form id="mbi-form"><label class="field"><span>${L("Medicare number", "Número de Medicare", "Nimewo Medicare")}</span><input name="mbi" type="text" autocomplete="off" maxlength="11" placeholder="${L("From your Medicare card", "De su tarjeta de Medicare", "Sou kat Medicare ou")}" aria-describedby="mbi-note"></label><p id="mbi-note" class="security">${icon("lock")} ${L("The full number is checked securely and is never saved on this device.", "El número completo se verifica de forma segura y nunca se guarda en este dispositivo.", "Yo verifye nimewo konplè a an sekirite epi yo pa janm anrejistre l sou aparèy sa a.")}</p></form>
    <button class="link-card" data-action="help">${icon("question")}<span><strong>${L("I don’t have my card", "No tengo mi tarjeta", "Mwen pa gen kat mwen an")}</strong><small>${L("Get help another way", "Obtenga ayuda de otra forma", "Jwenn èd yon lòt fason")}</small></span><b>›</b></button><p class="form-error" role="alert">${state.error}</p>${actions(t().continue)}`;
}

function eligibilityResult() {
  const outcome = state.accessOutcome;
  if (outcome === "notEligible") return `<div class="access-not-eligible-screen">${art("info")}${titleBlock(L("This ACCESS care option isn’t available to you right now", "Esta opción de cuidado ACCESS no está disponible para usted en este momento", "Opsyon swen ACCESS sa a pa disponib pou ou kounye a"), L("Based on the Medicare eligibility check, you can’t continue with ACCESS enrollment at this time.", "Según la verificación de elegibilidad de Medicare, no puede continuar con la inscripción en ACCESS en este momento.", "Dapre verifikasyon kalifikasyon Medicare la, ou pa ka kontinye ak enskripsyon ACCESS kounye a."))}<section class="next-card"><h2>${L("What can I do?", "¿Qué puedo hacer?", "Kisa mwen ka fè?")}</h2>${rows([["phone", L("Talk with our care team", "Hable con nuestro equipo de cuidado", "Pale ak ekip swen nou an"), L("We can answer questions and review other care support that may be available.", "Podemos responder sus preguntas y revisar otro apoyo de cuidado que pudiera estar disponible.", "Nou ka reponn kesyon epi revize lòt sipò swen ki ka disponib.")], ["clock", L("Request a callback", "Solicite una llamada", "Mande pou yo rele w"), L("A care team member can contact you to discuss your questions.", "Un miembro del equipo puede contactarle para hablar sobre sus preguntas.", "Yon manm ekip swen an ka kontakte w pou pale sou kesyon ou yo.")]])}</section><div class="actions">${cta(L("Return to start", "Volver al inicio", "Retounen nan kòmansman"), "restart", true)}${cta(L("Talk with our care team", "Hable con nuestro equipo", "Pale ak ekip swen nou an"), "help")}</div></div>`;
  const results = {
    // A cleared eligibility check is a milestone, and it is said as one. What it is not is an
    // enrollment: the copy carries that forward positively — the details are still ahead — instead
    // of announcing what has not happened yet.
    eligible: ["check", L("Great news — you can continue with ACCESS", "Buenas noticias: puede continuar con ACCESS", "Bon nouvèl — ou ka kontinye ak ACCESS"), L("Everything is ready for you to continue. We’ll review the details together before completing your enrollment.", "Todo está listo para que continúe. Revisaremos los detalles juntos antes de completar su inscripción.", "Tout bagay pare pou ou kontinye. N ap revize detay yo ansanm anvan nou konplete enskripsyon ou."), L("Continue", "Continuar", "Kontinye")],
    control: ["info", L("Medicare placed you in a comparison group", "Medicare le asignó a un grupo de comparación", "Medicare mete w nan yon gwoup konparezon"), L("You will keep all Medicare benefits and may continue care with your usual doctors. ITERA cannot provide this ACCESS service during the configured comparison period.", "Conservará todos sus beneficios y puede continuar con sus médicos habituales. ITERA no puede brindar este servicio ACCESS durante el período configurado.", "W ap kenbe tout benefis Medicare ou yo epi ou ka kontinye resevwa swen nan men doktè ou abitye yo. ITERA pa ka bay sèvis ACCESS sa a pandan peryòd konparezon ki fikse a."), L("Finish", "Finalizar", "Fini")],
    alreadyAligned: ["info", L("An existing ACCESS relationship was found", "Encontramos una relación ACCESS existente", "Nou jwenn yon relasyon ACCESS ki deja egziste"), L("We need a care team member to review it before anything changes.", "Un miembro del equipo debe revisarla antes de realizar cambios.", "Yon manm ekip swen an dwe revize li anvan anyen chanje."), L("Request review", "Solicitar revisión", "Mande yon revizyon")],
    unavailable: ["clock", L("Medicare is temporarily unavailable", "Medicare no está disponible temporalmente", "Medicare pa disponib pou yon ti tan"), L("We saved your progress. This does not mean you are ineligible. Please try again later or ask us to call you.", "Guardamos su progreso. Esto no significa que no sea elegible. Inténtelo después o solicite una llamada.", "Nou anrejistre pwogrè ou. Sa pa vle di ou pa kalifye. Tanpri eseye ankò pita oswa mande nou rele ou."), L("Try again", "Intentar de nuevo", "Eseye ankò")]
  }[outcome] || ["info", L("Review needed", "Se necesita una revisión", "Nou bezwen revize sa"), L("A care team member will review your information.", "Un miembro del equipo revisará su información.", "Yon manm ekip swen an pral revize enfòmasyon ou yo."), L("Request a call", "Solicitar una llamada", "Mande yon apèl")];
  return `<div class="access-eligibility-result-screen">${art(results[0], outcome === "eligible")}${titleBlock(results[1], results[2])}${outcome === "eligible" ? `<section class="next-card"><h2>${L("What happens next?", "¿Qué sigue?", "Kisa k ap pase apre?")}</h2>${rows([["document", L("Learn about your ACCESS care", "Conozca su cuidado ACCESS", "Aprann sou swen ACCESS ou"), ""], ["person", L("Confirm that you’d like to enroll with ITERA HEALTH", "Confirme que desea inscribirse con ITERA HEALTH", "Konfime ou ta renmen enskri avèk ITERA HEALTH"), ""], ["clock", L("We’ll complete your ACCESS enrollment with Medicare", "Completaremos su inscripción en ACCESS con Medicare", "N ap konplete enskripsyon ACCESS ou avèk Medicare"), ""]])}</section>` : ""}${actions(results[3], false, outcome === "unavailable" ? L("Request a callback", "Solicitar llamada", "Mande yon retou") : "")}</div>`;
}

function onboarding() {
  const bpCount = state.bpBaselineReadingCount || 0;
  const bpRequired = state.bpBaselineRequiredReadings || 3;
  const bpRemaining = Math.max(0, bpRequired - bpCount);
  const bpProgress = state.offer?.pathway === "ACCESS" && bpCount > 0 ? `<section class="reading-card baseline-progress-card"><small>${state.bpBaselineStatus === "COMPLETED" ? L("Starting blood pressure complete", "Presión arterial inicial completada", "Tansyon kòm pwen depa fini") : L("Starting blood pressure", "Presión arterial inicial", "Tansyon kòm pwen depa")}</small><strong>${L(`${bpCount} of ${bpRequired} readings received`, `${bpCount} de ${bpRequired} mediciones recibidas`, `${bpCount} sou ${bpRequired} mezi resevwa`)}</strong>${bpRemaining ? `<p>${L(`${bpRemaining} readings remaining`, `${bpRemaining} mediciones pendientes`, `${bpRemaining} mezi ki rete`)}</p>` : ""}</section>` : "";
  const careSetupCard = ({ section, itemIcon, title, description, status }) => {
    const complete = status === "COMPLETED";
    const statusCopy = complete ? L("Completed", "Completado", "Fini") : L("Not completed", "Pendiente", "Poko fini");
    return `<button type="button" class="link-card care-setup-card ${complete ? "completed" : ""}" data-action="care-setup-section" data-section="${section}" aria-label="${title}. ${statusCopy}">${icon(itemIcon)}<span><strong>${title}</strong><small>${description}</small><em>${complete ? `✓ ${statusCopy}` : statusCopy}</em></span><b aria-hidden="true">${complete ? icon("check") : "›"}</b></button>`;
  };
  const cards = [
    { section: "medications", itemIcon: "pill", title: L("Confirm your medications", "Confirme sus medicamentos", "Konfime medikaman ou yo"), description: L("Tell us if anything changed", "Indique si algo cambió", "Di nou si anyen chanje"), status: state.medicationsReviewStatus },
    { section: "preferences", itemIcon: "phone", title: L("Care preferences", "Preferencias de cuidado", "Preferans swen"), description: L("Choose how we should contact you", "Elija cómo debemos contactarle", "Chwazi kijan nou dwe kontakte ou"), status: state.carePreferencesStatus },
    { section: "goals", itemIcon: "goals", title: L("Your goals", "Sus objetivos", "Objektif ou"), description: L("Tell us what matters most", "Díganos qué es importante", "Di nou sa ki pi enpòtan"), status: state.goalsStatus }
  ];
  const careCircleSupport = state.careCircleStatus === "ACTIVE"
    ? `<aside class="growth-card care-circle-status">${icon("people")}<div><strong>${L(`${state.supportPersonName} is in your Care Circle`, `${state.supportPersonName} forma parte de su Círculo de cuidado`, `${state.supportPersonName} nan Sèk swen ou`)}</strong><p>${L("They can help with the care tasks you authorized.", "Puede ayudar con las tareas de cuidado que usted autorizó.", "Moun nan ka ede ak travay swen ou te otorize yo.")}</p></div></aside>`
    : state.careCircleStatus === "NONE" && growthPromptAvailable(state.careCirclePromptDismissedAt) ? careCircleEarlyPrompt(true) : "";
  return `${titleBlock(L("Set up your care", "Configure su cuidado", "Fikse swen w"), L("Enrollment is complete. You can finish these steps now or later.", "La inscripción está completa. Puede terminar estos pasos ahora o después.", "Enskripsyon an konplè. Ou ka fini etap sa yo kounye a oswa pita."), L("Care setup", "Configuración", "Konfigirasyon swen"))}
    ${bpProgress}<div class="link-list">${cards.map(careSetupCard).join("")}</div>${careCircleSupport}
    ${actions(L("Save and continue", "Guardar y continuar", "Sove epi kontinye"), false, L("I’ll finish later", "Terminaré después", "Mwen pral fini pita"))}`;
}

function clinical() {
  const rawConditions = state.offer.qualifyingConditions?.length
    ? state.offer.qualifyingConditions
    : [state.offer.qualifyingCondition].filter(Boolean);
  const conditions = rawConditions.map((condition, index) => ({
    id: condition.id || `condition-${index + 1}`,
    name: localizedCondition(condition.name || condition.patientFriendlyName),
    lastUpdatedAt: condition.lastUpdatedAt || condition.updatedAt || ""
  }));
  const formattedDate = value => {
    if (!value || Number.isNaN(new Date(value).getTime())) return "";
    return new Intl.DateTimeFormat(state.language === "es" ? "es-US" : state.language === "ht" ? "ht-HT" : "en-US", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
  };
  const recordedLabel = conditions.length > 1 ? L("Recorded conditions", "Condiciones registradas", "Kondisyon ki anrejistre yo") : L("Recorded condition", "Condición registrada", "Kondisyon ki anrejistre");
  const knownData = `<section class="known-data health-information-card recorded-information" aria-labelledby="recorded-information-label"><h2 class="recorded-information-label" id="recorded-information-label">${recordedLabel}</h2>${conditions.map(condition => `<article>${icon("check")}<span><strong>${escapeHtml(condition.name)}</strong>${formattedDate(condition.lastUpdatedAt) ? `<small>${L("Last updated", "Última actualización", "Dènye mizajou")}: ${escapeHtml(formattedDate(condition.lastUpdatedAt))}</small>` : ""}</span></article>`).join("")}</section>`;
  const choiceCard = (value, itemIcon, title, description, status = "") => `<button type="button" class="health-review-choice ${state.healthInformationReviewResult === value ? "selected" : ""} ${status ? `status-${status.toLowerCase()}` : ""}" data-action="select-health-review" data-review-choice="${value}">${icon(itemIcon)}<span><strong>${title}</strong>${description ? `<small>${description}</small>` : ""}${status ? `<em>${status}</em>` : ""}</span></button>`;
  const updateLabels = {
    NEW_INFORMATION: L("A new health condition should be added", "Se debe agregar una nueva condición de salud", "Yo ta dwe ajoute yon nouvo pwoblèm sante"),
    CONDITION_QUESTIONED: L("One of these conditions no longer seems correct", "Una de estas condiciones ya no parece correcta", "Youn nan pwoblèm sa yo pa sanble kòrèk ankò"),
    INFORMATION_INCORRECT: L("Some information shown here is incorrect", "Parte de la información mostrada es incorrecta", "Kèk enfòmasyon ki parèt la pa kòrèk"),
    OTHER: L("Something else", "Algo más", "Yon lòt bagay"),
    UNSURE: L("I’m not sure what changed", "No estoy seguro de qué cambió", "Mwen pa sèten sa ki chanje")
  };
  const draft = state.healthInformationUpdateDraft || { id: "", updateType: "", relatedConditionIds: [], patientReportedText: "" };
  const selectedConditions = conditions.filter(condition => draft.relatedConditionIds?.includes(condition.id));
  const latestUpdate = (state.patientReportedHealthUpdates || []).at(-1);
  const heading = `${art("shield")}${titleBlock(L("Confirm your health information", "Confirme su información de salud", "Konfime enfòmasyon sou sante w"), L("We already have this information recorded for your ACCESS care. Please confirm that it is still correct.", "Ya tenemos registrada esta información para su cuidado ACCESS. Confirme si sigue siendo correcta.", "Nou deja gen enfòmasyon sa a anrejistre pou swen ACCESS ou. Tanpri konfime si li toujou kòrèk."), L("Care setup", "Configuración", "Konfigirasyon swen"))}${knownData}`;

  if (state.healthInformationFlowStep === "CHANGE_TYPE") return `${heading}<section class="health-review-panel"><h2>${L("What has changed?", "¿Qué cambió?", "Kisa ki chanje?")}</h2><div class="health-update-options">${Object.entries(updateLabels).map(([value, label]) => `<button type="button" data-action="select-health-update-type" data-update-type="${value}">${label}</button>`).join("")}</div></section><p class="form-error" role="alert">${state.error || ""}</p><div class="actions">${cta(t().back, "health-flow-back", true)}</div>`;

  if (state.healthInformationFlowStep === "CHANGE_DETAILS") {
    const conditionSpecific = ["CONDITION_QUESTIONED", "INFORMATION_INCORRECT"].includes(draft.updateType);
    const prompt = draft.updateType === "NEW_INFORMATION" ? L("What would you like us to know?", "¿Qué desea informarnos?", "Kisa ou ta renmen fè nou konnen?") : L("Tell us what changed.", "Cuéntenos qué cambió.", "Di nou sa ki chanje.");
    const conditionsField = conditionSpecific && conditions.length ? `<fieldset class="health-condition-picker"><legend>${L("Which information changed?", "¿Qué información cambió?", "Ki enfòmasyon ki chanje?")}</legend>${conditions.map(condition => check("healthCondition", condition.name, draft.relatedConditionIds?.includes(condition.id), condition.id)).join("")}</fieldset>` : "";
    return `${heading}<form id="health-update-form" class="health-update-form"><h2>${escapeHtml(updateLabels[draft.updateType] || L("What changed?", "¿Qué cambió?", "Kisa ki chanje?"))}</h2>${conditionsField}<label class="field">${prompt}<textarea name="patientReportedText" rows="4" maxlength="500" placeholder="${draft.updateType === "NEW_INFORMATION" ? L("Example: I was recently told I have diabetes.", "Ejemplo: Recientemente me dijeron que tengo diabetes.", "Egzanp: Yo fèk di mwen mwen gen dyabèt.") : L("Add a short note (optional)", "Agregue una nota breve (opcional)", "Ajoute yon ti nòt (opsyonèl)")}">${escapeHtml(draft.patientReportedText || "")}</textarea></label></form><p class="form-error" role="alert">${state.error || ""}</p><div class="actions">${cta(t().back, "health-flow-back", true)}${cta(L("Review update", "Revisar actualización", "Revize mizajou"), "review-health-update")}</div>`;
  }

  if (state.healthInformationFlowStep === "CHANGE_REVIEW") return `${heading}<section class="health-update-review"><h2>${L("Here’s what you told us", "Esto es lo que nos informó", "Men sa ou te di nou")}</h2>${selectedConditions.length ? `<strong>${selectedConditions.map(condition => escapeHtml(condition.name)).join(", ")}</strong>` : ""}<span>${escapeHtml(updateLabels[draft.updateType] || "")}</span>${draft.patientReportedText ? `<blockquote>${escapeHtml(draft.patientReportedText)}</blockquote>` : ""}<p>${L("Your care team can review this information.", "Su equipo de atención puede revisar esta información.", "Ekip swen ou ka revize enfòmasyon sa a.")}</p></section><p class="form-error" role="alert">${state.error || ""}</p><div class="actions">${cta(L("Change my answer", "Cambiar mi respuesta", "Chanje repons mwen"), "edit-health-update", true)}${cta(L("Save update", "Guardar actualización", "Sove mizajou"), "save-health-update")}</div>`;

  if (state.healthInformationFlowStep === "CHANGE_SAVED" && latestUpdate) return `${heading}<section class="health-review-result changes-reported">${icon("info")}<div><h2>${L("Thanks — we’ll review this update.", "Gracias. Revisaremos esta actualización.", "Mèsi — n ap revize mizajou sa a.")}</h2><p>${L("Your current health information won’t be changed automatically. Your care team can review what you reported.", "Su información de salud actual no cambiará automáticamente. Su equipo de atención puede revisar lo que informó.", "Enfòmasyon sante ou genyen kounye a p ap chanje otomatikman. Ekip swen ou ka revize sa ou rapòte a.")}</p><strong>${L("Update provided", "Actualización enviada", "Mizajou bay")}</strong></div></section><div class="health-saved-actions"><button type="button" data-action="view-health-update">${L("View update", "Ver actualización", "Gade mizajou")}</button><button type="button" data-action="edit-saved-health-update">${L("Edit update", "Editar actualización", "Modifye mizajou")}</button><button type="button" data-action="change-health-review-answer">${L("Change my answer", "Cambiar mi respuesta", "Chanje repons mwen")}</button></div><div class="actions single">${cta(L("Return to care setup", "Volver a configuración", "Retounen nan konfigirasyon swen"), "return-health-setup")}</div>`;

  if (state.healthInformationFlowStep === "HELP_OPTIONS") return `${heading}<section class="health-review-panel help-panel"><h2>${L("Need help reviewing this?", "¿Necesita ayuda para revisarlo?", "Bezwen èd pou revize sa?")}</h2><p>${L("That’s okay. Your care team can help you review this information.", "Está bien. Su equipo de atención puede ayudarle a revisar esta información.", "Sa pa yon pwoblèm. Ekip swen ou ka ede w revize enfòmasyon sa a.")}</p><div class="health-help-actions"><button type="button" data-action="health-ask-emmi">${icon("question")}<span><strong>${L("Ask EMMI", "Preguntar a EMMI", "Mande EMMI")}</strong><small>${L("Get a simple explanation", "Reciba una explicación sencilla", "Jwenn yon eksplikasyon senp")}</small></span></button><button type="button" data-action="health-ask-care-team">${icon("people")}<span><strong>${L("Ask my care team", "Preguntar a mi equipo de atención", "Mande ekip swen mwen")}</strong><small>${L("Request help reviewing this", "Solicite ayuda para revisarlo", "Mande èd pou revize sa")}</small></span></button></div></section><div class="actions">${cta(t().back, "health-flow-back", true)}${cta(L("I’ll review this later", "Lo revisaré después", "M ap revize sa pita"), "defer-health-review")}</div>`;

  if (state.healthInformationFlowStep === "HELP_CONFIRMED") return `${heading}<section class="health-review-result needs-help">${icon("people")}<div><h2>${L("We’ll help you review this", "Le ayudaremos a revisarlo", "N ap ede w revize sa")}</h2><p>${L("Your care team will review this information with you.", "Su equipo de atención revisará esta información con usted.", "Ekip swen ou pral revize enfòmasyon sa a avèk ou.")}</p><strong>${L("Help requested", "Ayuda solicitada", "Èd mande")}</strong></div></section><div class="health-saved-actions"><button type="button" data-action="change-health-review-answer">${L("Change my answer", "Cambiar mi respuesta", "Chanje repons mwen")}</button></div><div class="actions single">${cta(L("Return to care setup", "Volver a configuración", "Retounen nan konfigirasyon swen"), "return-health-setup")}</div>`;

  const savedConfirmed = state.healthInformationReviewStatus === "CONFIRMED";
  const choiceDescription = savedConfirmed ? L("Thanks — we’ll keep this information as it is.", "Gracias. Mantendremos esta información como está.", "Mèsi — n ap kenbe enfòmasyon sa a jan li ye a.") : "";
  const reviewQuestion = L("Is this information still correct?", "¿Esta información sigue siendo correcta?", "Èske enfòmasyon sa a toujou kòrèk?");
  return `${heading}<section class="health-review-decision" aria-labelledby="health-review-question"><h2 class="health-review-question" id="health-review-question">${reviewQuestion}</h2><div class="health-review-choices">${choiceCard("correct", "check", L("Yes, everything is correct", "Sí, todo está correcto", "Wi, tout bagay kòrèk"), state.healthInformationReviewResult === "correct" ? choiceDescription : "", savedConfirmed && state.healthInformationReviewResult === "correct" ? L("Confirmed", "Confirmado", "Konfime") : "")}${choiceCard("changed", "document", L("No, something changed", "No, algo cambió", "Non, yon bagay chanje"), "")}${choiceCard("help", "question", L("I need help reviewing it", "Necesito ayuda para revisarla", "Mwen bezwen èd pou revize li"), "")}</div></section><p class="form-error" role="alert">${state.error || ""}</p><div class="actions">${cta(t().back, "back", true)}${cta(L("Confirm and continue", "Confirmar y continuar", "Konfime epi kontinye"), "confirm-health-information", false, state.healthInformationReviewResult !== "correct")}</div>`;
}

function completeHealthInformationReview(status) {
  const reviewedAt = new Date().toISOString();
  const representative = state.completionRole === "personalRepresentative";
  state.healthInformationReviewStatus = status;
  state.healthInformationStepStatus = "COMPLETED";
  state.healthInformationReviewedAt = reviewedAt;
  state.healthInformationReviewedBy = representative ? (state.representativeFullName || "PERSONAL_REPRESENTATIVE") : (state.offer?.patient?.id || "PATIENT");
  state.healthInformationReviewSource = representative ? "PERSONAL_REPRESENTATIVE" : "PATIENT";
  state.baselineResumeScreen = "ONBOARDING";
  return reviewedAt;
}

function ensureHealthInformationTask(type, details = {}) {
  const existing = (state.careTeamTasks || []).find(task => task.type === type && task.status === "OPEN" && (!details.healthUpdateId || task.healthUpdateId === details.healthUpdateId));
  if (existing) return existing;
  const task = { id: `health_review_${Date.now().toString(36)}`, type, patientId: state.offer?.patient?.id || "", screen: "HEALTH_INFORMATION_REVIEW", context: "CARE_SETUP", requestedAt: new Date().toISOString(), createdAt: new Date().toISOString(), status: "OPEN", ...details };
  state.careTeamTasks = [...(state.careTeamTasks || []), task];
  return task;
}

function medicationsReview() {
  const medications = Array.isArray(state.careMedications) ? state.careMedications : [];
  const reviews = state.medicationReviews || {};
  const reviewedCount = medications.filter(medication => reviews[medication.id]?.reviewStatus && reviews[medication.id].reviewStatus !== "UNREVIEWED").length;
  const intro = medications.length === 1
    ? L("We found 1 medication on file. Please review it, then add anything that’s missing.", "Encontramos 1 medicamento registrado. Revíselo y luego agregue lo que falte.", "Nou jwenn 1 medikaman nan dosye a. Tanpri revize li, epi ajoute nenpòt sa ki manke.")
    : L(`We found ${medications.length} medications on file. Please review each one, then add anything that’s missing.`, `Encontramos ${medications.length} medicamentos registrados. Revise cada uno y luego agregue lo que falte.`, `Nou jwenn ${medications.length} medikaman nan dosye a. Tanpri revize chak, epi ajoute nenpòt sa ki manke.`);
  const reportedFrequencyLabel = value => ({ ONCE_DAILY: L("Once daily", "Una vez al día", "Yon fwa pa jou"), TWICE_DAILY: L("Twice daily", "Dos veces al día", "De fwa pa jou"), THREE_TIMES_DAILY: L("Three times daily", "Tres veces al día", "Twa fwa pa jou"), AS_NEEDED: L("As needed", "Según sea necesario", "Lè sa nesesè"), OTHER: L("Other", "Otra", "Lòt") }[value] || value);
  const statusCopy = review => ({
    CONFIRMED_CURRENT: L("Confirmed", "Confirmado", "Konfime"),
    NOT_TAKING: L("Patient reported: No longer taking", "Informado por el paciente: Ya no lo toma", "Pasyan rapòte: Li pa pran li ankò"),
    DOSE_CHANGED: L(`Patient reported dose: ${review.patientReportedDose}`, `Dosis informada por el paciente: ${review.patientReportedDose}`, `Dòz pasyan an rapòte: ${review.patientReportedDose}`),
    FREQUENCY_CHANGED: L(`Patient reported frequency: ${reportedFrequencyLabel(review.patientReportedFrequency)}`, `Frecuencia informada por el paciente: ${reportedFrequencyLabel(review.patientReportedFrequency)}`, `Frekans pasyan an rapòte: ${reportedFrequencyLabel(review.patientReportedFrequency)}`),
    NEEDS_REVIEW: L("Needs care team review", "Necesita revisión del equipo de atención", "Ekip swen an bezwen revize li")
  }[review.reviewStatus] || "");
  const changePanel = medication => {
    if (state.medicationChangeId !== medication.id) return "";
    if (!state.medicationChangeType) return `<div class="medication-change-panel"><strong>${L("What changed?", "¿Qué cambió?", "Kisa ki chanje?")}</strong><div class="medication-change-options"><button type="button" data-action="select-medication-change" data-medication-id="${medication.id}" data-change-type="NOT_TAKING">${L("I no longer take this", "Ya no tomo este medicamento", "Mwen pa pran medikaman sa a ankò")}</button><button type="button" data-action="select-medication-change" data-medication-id="${medication.id}" data-change-type="DOSE_CHANGED">${L("My dose changed", "Mi dosis cambió", "Dòz mwen chanje")}</button><button type="button" data-action="select-medication-change" data-medication-id="${medication.id}" data-change-type="FREQUENCY_CHANGED">${L("How often I take it changed", "Cambió la frecuencia con que lo tomo", "Kantite fwa mwen pran li chanje")}</button><button type="button" data-action="select-medication-change" data-medication-id="${medication.id}" data-change-type="NEEDS_REVIEW">${L("I’m not sure about this medication", "No estoy seguro de este medicamento", "Mwen pa sèten sou medikaman sa a")}</button></div></div>`;
    if (state.medicationChangeType === "DOSE_CHANGED") return `<form class="medication-change-panel" id="medication-change-form"><strong>${L("What dose are you taking now?", "¿Qué dosis toma ahora?", "Ki dòz ou pran kounye a?")}</strong><small>${L("On file", "Registrado", "Nan dosye")}: ${escapeHtml(medication.details || "—")}</small><label class="field"><input name="patientReportedDose" autocomplete="off" placeholder="${L("Example: 20 mg", "Ejemplo: 20 mg", "Egzanp: 20 mg")}" required></label><div class="inline-actions"><button type="button" class="button secondary" data-action="cancel-medication-change">${L("Cancel", "Cancelar", "Anile")}</button><button type="button" class="button primary" data-action="save-medication-change" data-medication-id="${medication.id}">${L("Save change", "Guardar cambio", "Sove chanjman")}</button></div></form>`;
    if (state.medicationChangeType === "FREQUENCY_CHANGED") return `<form class="medication-change-panel" id="medication-change-form"><strong>${L("How do you take it now?", "¿Cómo lo toma ahora?", "Kijan ou pran li kounye a?")}</strong><label class="field"><select name="patientReportedFrequency" aria-label="${L("How do you take it now?", "¿Cómo lo toma ahora?", "Kijan ou pran li kounye a?")}" required><option value="">${L("Select frequency", "Seleccione la frecuencia", "Chwazi frekans")}</option><option value="ONCE_DAILY">${L("Once daily", "Una vez al día", "Yon fwa pa jou")}</option><option value="TWICE_DAILY">${L("Twice daily", "Dos veces al día", "De fwa pa jou")}</option><option value="THREE_TIMES_DAILY">${L("Three times daily", "Tres veces al día", "Twa fwa pa jou")}</option><option value="AS_NEEDED">${L("As needed", "Según sea necesario", "Lè sa nesesè")}</option><option value="OTHER">${L("Other", "Otra", "Lòt")}</option></select></label><div class="inline-actions"><button type="button" class="button secondary" data-action="cancel-medication-change">${L("Cancel", "Cancelar", "Anile")}</button><button type="button" class="button primary" data-action="save-medication-change" data-medication-id="${medication.id}">${L("Save change", "Guardar cambio", "Sove chanjman")}</button></div></form>`;
    return "";
  };
  const medicationCards = medications.map(medication => {
    const review = reviews[medication.id] || { reviewStatus: "UNREVIEWED" };
    const reviewed = review.reviewStatus !== "UNREVIEWED";
    return `<article class="medication-card medication-review-card ${reviewed ? "reviewed" : "unreviewed"}" data-medication-id="${medication.id}" data-scroll-anchor="medication-${medication.id}"><div class="medication-card-heading">${icon("pill")}<span><strong>${escapeHtml(medication.name)}</strong><small>${escapeHtml(medicationDetails(medication) || L("Dose not listed", "Dosis no indicada", "Dòz la pa nan lis la"))}</small><em>${L("On file", "Registrado", "Nan dosye")}</em></span></div>${reviewed ? `<div class="medication-reviewed-state">${icon(review.reviewStatus === "CONFIRMED_CURRENT" ? "check" : "info")}<span><strong>${statusCopy(review)}</strong>${review.reviewStatus === "CONFIRMED_CURRENT" ? "" : `<small>${review.reviewStatus === "NEEDS_REVIEW" ? L("That’s okay. Your care team can review this with you.", "Está bien. Su equipo de atención puede revisarlo con usted.", "Sa pa yon pwoblèm. Ekip swen ou ka revize sa avèk ou.") : L("Thanks — we’ll let your care team know.", "Gracias. Informaremos a su equipo de atención.", "Mèsi — n ap fè ekip swen ou konnen.")}</small>`}</span></div><button type="button" class="medication-change-answer" data-action="change-medication-answer" data-medication-id="${medication.id}">${L("Change answer", "Cambiar respuesta", "Chanje repons")}</button>` : `<p class="medication-question">${L("Do you still take this medication?", "¿Todavía toma este medicamento?", "Èske ou toujou pran medikaman sa a?")}</p><div class="medication-review-actions"><button type="button" class="medication-confirm-button" data-action="confirm-medication-current" data-medication-id="${medication.id}">${icon("check")} ${L("Yes, I still take it", "Sí, todavía lo tomo", "Wi, mwen toujou pran li")}</button><button type="button" class="medication-changed-button" data-action="open-medication-change" data-medication-id="${medication.id}">${L("Something changed", "Algo cambió", "Gen yon bagay ki chanje")}</button></div>${changePanel(medication)}`}</article>`;
  }).join("");
  const added = (state.additionalMedications || []).map(item => `<article class="medication-added-card"><div>${icon("pill")}<span><strong>${escapeHtml(item.medicationName)}</strong><small>${escapeHtml([item.dose, item.frequencyLabel].filter(Boolean).join(" · ") || L("Details not provided", "Detalles no proporcionados", "Pa gen detay"))}</small><em>${L("Added by you", "Agregado por usted", "Ou ajoute li")}</em></span></div><div><button type="button" data-action="edit-added-medication" data-medication-id="${item.id}">${L("Edit", "Editar", "Modifye")}</button><button type="button" data-action="remove-added-medication" data-medication-id="${item.id}">${L("Remove", "Eliminar", "Retire")}</button></div></article>`).join("");
  const additionalAnswered = ["NONE", "ADDED", "UNSURE"].includes(state.additionalMedicationsStatus);
  const complete = reviewedCount === medications.length && additionalAnswered;
  const changeCount = Object.values(reviews).filter(review => ["NOT_TAKING", "DOSE_CHANGED", "FREQUENCY_CHANGED", "NEEDS_REVIEW"].includes(review.reviewStatus)).length;
  const addForm = state.medicationAddOpen ? `<form id="add-medication-form" class="medication-add-form"><h3>${state.medicationEditId ? L("Edit medication", "Editar medicamento", "Modifye medikaman") : L("Add a medication", "Agregar un medicamento", "Ajoute yon medikaman")}</h3><label class="field">${L("Medication name", "Nombre del medicamento", "Non medikaman an")}<input name="medicationName" autocomplete="off" value="${escapeHtml(state.additionalMedications.find(item => item.id === state.medicationEditId)?.medicationName || "")}" placeholder="${L("Example: Metformin", "Ejemplo: Metformina", "Egzanp: Metformin")}" required></label><label class="field">${L("Dose or instructions", "Dosis o instrucciones", "Dòz oswa enstriksyon")}<input name="medicationDetails" autocomplete="off" value="${escapeHtml(state.additionalMedications.find(item => item.id === state.medicationEditId)?.dose || "")}" placeholder="${L("Optional", "Opcional", "Opsyonèl")}"></label><label class="field">${L("How often do you take it?", "¿Con qué frecuencia lo toma?", "Konbyen fwa ou pran li?")}<select name="medicationFrequency"><option value="">${L("Optional", "Opcional", "Opsyonèl")}</option>${[["Once daily", L("Once daily", "Una vez al día", "Yon fwa pa jou")], ["Twice daily", L("Twice daily", "Dos veces al día", "De fwa pa jou")], ["Three times daily", L("Three times daily", "Tres veces al día", "Twa fwa pa jou")], ["As needed", L("As needed", "Según sea necesario", "Lè sa nesesè")], ["Other", L("Other", "Otra", "Lòt")]].map(([value, label]) => `<option value="${value}" ${state.additionalMedications.find(item => item.id === state.medicationEditId)?.frequency === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><div class="inline-actions"><button type="button" class="button secondary" data-action="cancel-add-medication">${L("Cancel", "Cancelar", "Anile")}</button><button type="button" class="button primary" data-action="add-medication">${state.medicationEditId ? L("Save medication", "Guardar medicamento", "Sove medikaman") : L("Add medication", "Agregar medicamento", "Ajoute medikaman")}</button></div></form>` : "";
  return `${titleBlock(L("Confirm your medications", "Confirme sus medicamentos", "Konfime medikaman ou yo"), intro, L("Care setup", "Configuración", "Konfigirasyon swen"))}<div class="medication-review-progress" role="status" aria-live="polite"><strong>${reviewedCount === medications.length && medications.length ? "✓ " : ""}${L(`${reviewedCount} of ${medications.length} reviewed`, `${reviewedCount} de ${medications.length} revisados`, `${reviewedCount} sou ${medications.length} revize`)}</strong><span><i style="width:${medications.length ? reviewedCount / medications.length * 100 : 100}%"></i></span></div><section class="medication-review-section"><h2>${L("Review your medications", "Revise sus medicamentos", "Revize medikaman ou yo")}</h2><div class="medication-list">${medicationCards || `<p class="empty-state">${L("No medications are listed on file.", "No hay medicamentos registrados.", "Pa gen medikaman nan dosye a.")}</p>`}</div></section><section class="medication-additional-section"><h2>${L("Taking anything else?", "¿Toma algún otro medicamento?", "Èske ou pran nenpòt lòt medikaman?")}</h2><p>${L("Add any prescription medicine that isn’t listed above.", "Agregue cualquier medicamento recetado que no aparezca arriba.", "Ajoute nenpòt medikaman sou preskripsyon ki pa nan lis anwo a.")}</p>${added ? `<div class="medications-added-list"><h3>${L("Medications you added", "Medicamentos que agregó", "Medikaman ou ajoute")}</h3>${added}</div>` : ""}${addForm || `<div class="additional-medication-actions"><button type="button" data-action="open-add-medication">${icon("pill")} ${L("Add another medication", "Agregar otro medicamento", "Ajoute yon lòt medikaman")}</button><button type="button" class="${state.additionalMedicationsStatus === "NONE" ? "selected" : ""}" data-action="no-additional-medications">${icon("check")} ${L("No, that’s all", "No, eso es todo", "Non, se tout")}</button><button type="button" class="${state.additionalMedicationsStatus === "UNSURE" ? "selected" : ""}" data-action="unsure-additional-medications">${L("I’m not sure if anything is missing", "No estoy seguro de que falte algo", "Mwen pa sèten si gen yon bagay ki manke")}</button></div>`}${state.additionalMedicationsStatus === "UNSURE" ? `<p class="medication-reassurance">${L("That’s okay. Your care team can review your medication list with you.", "Está bien. Su equipo de atención puede revisar la lista con usted.", "Sa pa yon pwoblèm. Ekip swen ou ka revize lis la avèk ou.")}</p>` : ""}</section>${complete && (changeCount || state.additionalMedications.length) ? `<aside class="medication-review-summary"><strong>${L("Medication review", "Revisión de medicamentos", "Revizyon medikaman")}</strong><span>✓ ${L(`${reviewedCount} medications reviewed`, `${reviewedCount} medicamentos revisados`, `${reviewedCount} medikaman revize`)}</span>${changeCount ? `<span>${L(`${changeCount} change to review with your care team`, `${changeCount} cambio para revisar con su equipo`, `${changeCount} chanjman pou revize ak ekip swen ou`)}</span>` : ""}${state.additionalMedications.length ? `<span>${L(`${state.additionalMedications.length} medication added`, `${state.additionalMedications.length} medicamento agregado`, `${state.additionalMedications.length} medikaman ajoute`)}</span>` : ""}</aside>` : ""}<p class="form-error" role="alert">${state.error || ""}</p>${actions(L("Continue", "Continuar", "Kontinye"), true, "", !complete)}`;
}

// ---------------------------------------------------------------------------
// Medication refill orchestration. The engines in medicationSupply.js and medicationRefill.js
// decide what is true and what is allowed; this layer connects them to the patient's record, the
// reconciliation workflow, the safety engine, the care-team queue, the barrier engine and the
// appointment stub. It never prescribes and never claims an outcome it was not told about.
// ---------------------------------------------------------------------------

const activeMedications = () => (state.careMedications || []).filter(medication => medication.active !== false);
const medicationById = id => (state.careMedications || []).find(medication => medication.id === id) || null;
const medicationReviewStatus = id => state.medicationReviews?.[id]?.reviewStatus || "";

// The prescriber on the record is the one that is shown, but a prototype configured with a
// different physician name should not contradict itself on screen.
const medicationPrescriber = medication => {
  const prescriber = medication?.prescriber;
  if (!prescriber) return null;
  const offerProvider = state.offer?.referringProvider;
  return offerProvider && offerProvider.id === prescriber.id ? { ...prescriber, name: state.offer.physician?.displayName || offerProvider.name } : prescriber;
};

const medicationLabel = medication => (medication ? `${medication.name}${medication.strength ? ` ${medication.strength}` : ""}` : "");
const isMedicationPrepTopic = topic => /\b(medication|medications|medicine|medicines|medicamento|medicamentos|pastilla|pastillas|medikaman|grenn)\b/i.test(String(topic || ""));
// The record keeps the sig exactly as the prescriber documented it, because that is what travels to
// the care team and to the refill episode. What the patient reads is a translation of it, so a
// Spanish screen stops handing out directions in English.
const medicationSig = medication => (medication?.sigDisplay ? localized(medication.sigDisplay) : medication?.sig || "");
const medicationDetails = medication => (medication?.detailsDisplay ? localized(medication.detailsDisplay) : medication?.details || "");
const medicationSupplyEstimate = medication => estimateMedicationSupply(medication, { reviewStatus: medicationReviewStatus(medication?.id) });

const supplySignals = () => state.medicationSupplySignals || [];
const refillEpisodes = () => state.medicationRefills || [];
const openRefillForMedication = id => openRefillFor(refillEpisodes(), id);
const activeRefillEpisode = () => refillEpisodes().find(refill => refill.id === state.activeRefillId) || null;
const openSupplySignalFor = id => openSignalFor(supplySignals(), id);

const saveSupplySignal = signal => {
  const existing = supplySignals().some(item => item.id === signal.id);
  state.medicationSupplySignals = existing
    ? supplySignals().map(item => (item.id === signal.id ? signal : item))
    : [...supplySignals(), signal];
  draftStore.save(state);
  return signal;
};

const saveRefillEpisode = episode => {
  const existing = refillEpisodes().some(item => item.id === episode.id);
  state.medicationRefills = existing
    ? refillEpisodes().map(item => (item.id === episode.id ? episode : item))
    : [...refillEpisodes(), episode];
  draftStore.save(state);
  return episode;
};

const auditRefill = (event, episode, extra = {}) => audit(state, event, "success", { ...refillAnalytics(episode), ...extra });

// Detection runs where medications are shown, and only ever produces a question. Everything that
// would make the question wrong — an answer already given, a refill already moving, a fill that
// already arrived — is the engine's business, not this function's.
function detectMedicationSupplySignals() {
  const raised = detectLowSupply({
    medications: activeMedications(),
    signals: supplySignals(),
    refills: refillEpisodes(),
    reviews: state.medicationReviews || {}
  });
  if (!raised.length) return;
  raised.forEach(signal => {
    saveSupplySignal({ ...signal, patientId: state.offer?.patient?.id || state.assistantDemoPatientId || "" });
    audit(state, "medication_low_supply_detected", "success", supplySignalAnalytics(signal));
  });
}

// Patient-facing supply line. Confidence decides whether this states anything at all.
const medicationSupplyLine = medication => {
  const signal = openSupplySignalFor(medication.id);
  if (!signal) return "";
  return supplyPhrase({
    eligible: true,
    confidence: signal.supplyConfidence,
    estimatedDaysRemaining: signal.estimatedDaysRemaining
  }, state.language);
};

// A refill starts as a draft the moment the patient opens it, so the conversation, the answers and
// the eventual request all belong to one episode rather than being reassembled later.
function startRefillEpisode(medication, { source = "PATIENT", signal = null } = {}) {
  const existing = openRefillForMedication(medication.id);
  if (existing) return existing;
  const episode = createRefillEpisode({
    patientId: state.offer?.patient?.id || state.assistantDemoPatientId || "",
    medication: { ...medication, prescriber: medicationPrescriber(medication) },
    supplySignalId: signal?.id || openSupplySignalFor(medication.id)?.id || null,
    source
  });
  saveRefillEpisode(episode);
  auditRefill("medication_refill_started", episode, { source });
  return episode;
}

// Safety looks first at anything the patient said about how a medicine makes them feel. It runs on
// the same deterministic rules the rest of EMMI uses.
async function evaluateRefillSafety(description) {
  if (!description) return null;
  try {
    const runtime = ensureEmmiRuntime();
    return await runtime.tools.execute("evaluateClinicalEscalation", { systolic: 0, diastolic: 0, symptoms: description });
  } catch {
    return { severity: "CARE_TEAM_REVIEW", instruction: "CREATE_HIGH_PRIORITY_TASK", policy: "SAFETY_CHECK_UNAVAILABLE" };
  }
}

// One place where a refill leaves ITERA. Each path either uses an authorisation that already
// exists or hands the decision to a person, and each records who told us what happened.
function submitRefill(episode, medication, resolution) {
  const prescriber = medicationPrescriber(medication);
  const idempotencyKey = refillIdempotencyKey({ patientId: episode.patientId, medicationId: episode.medicationId, supplySignalId: episode.supplySignalId });
  // A double tap, a voice turn and a button press are the same intent.
  const duplicate = refillEpisodes().find(item => item.idempotencyKey === idempotencyKey && item.id !== episode.id && refillIsOpen(item));
  if (duplicate) return { ok: true, episode: duplicate, duplicate: true };

  const requiresTask = [REFILL_PATHS.CARE_TEAM_REVIEW, REFILL_PATHS.CLINICAL_REVIEW_REQUIRED, REFILL_PATHS.LAB_OR_OTHER_REQUIREMENT, REFILL_PATHS.APPOINTMENT_REQUIRED].includes(resolution.path);
  const summary = refillCareTeamSummary({
    episode: { ...episode, refillPath: resolution.path, blocker: episode.blocker },
    medication: { ...medication, prescriber },
    supplyEstimate: medicationSupplyEstimate(medication),
    request: resolution.path === REFILL_PATHS.APPOINTMENT_REQUIRED ? "APPOINTMENT_COORDINATION" : resolution.path === REFILL_PATHS.PRESCRIBER_REFILL_REQUEST ? "PRESCRIBER_REFILL" : "CLINICAL_REVIEW"
  });

  let task = null;
  if (requiresTask || resolution.path === REFILL_PATHS.PRESCRIBER_REFILL_REQUEST) {
    const taskType = resolution.path === REFILL_PATHS.APPOINTMENT_REQUIRED ? "APPOINTMENT_REQUEST"
      : resolution.path === REFILL_PATHS.PRESCRIBER_REFILL_REQUEST ? "MEDICATION_REFILL_REQUEST"
        : "MEDICATION_REFILL_REVIEW";
    task = ensureMedicationCareTeamTask(taskType, {
      medicationId: medication.id,
      refillId: episode.id,
      priority: resolution.requiresClinicalReview ? "CLINICAL_REVIEW" : "ROUTINE",
      reason: resolution.reason,
      summary
    });
    // Nothing is claimed when the queue could not take it.
    if (!task) return { ok: false, episode };
  }

  const status = statusForPath(resolution.path);
  const submitted = advanceRefill({
    ...episode,
    idempotencyKey,
    refillPath: resolution.path,
    refillReason: resolution.reason,
    requiresPrescriber: resolution.requiresPrescriber,
    requiresClinicalReview: resolution.requiresClinicalReview,
    requiresAppointment: resolution.requiresAppointment,
    careTeamTaskId: task?.id || null,
    prescriberId: prescriber?.id || null,
    pharmacyId: medication.pharmacy?.id || null
  }, { status, source: "ITERA", detail: { path: resolution.path, reason: resolution.reason } });
  saveRefillEpisode(submitted);
  auditRefill("medication_refill_submitted", submitted, { path: resolution.path, taskId: task?.id || null });
  return { ok: true, episode: submitted };
}

// Medication tasks join the same care-team queue everything else uses; nothing here builds a second
// task system.
const ensureMedicationCareTeamTask = (type, details = {}) => {
  const tasks = state.careTeamTasks || [];
  const existing = tasks.find(task => task.type === type && task.refillId === details.refillId && task.status === "OPEN");
  // The same request gaining context is still one request: the open task is enriched rather than
  // duplicated or left with the thinner summary it was created with.
  if (existing) {
    const merged = { ...existing, ...details, summary: { ...(existing.summary || {}), ...(details.summary || {}) } };
    state.careTeamTasks = tasks.map(task => (task.id === existing.id ? merged : task));
    return merged;
  }
  const task = { id: `med_task_${Date.now().toString(36)}`, type, status: "OPEN", createdAt: new Date().toISOString(), ...details };
  state.careTeamTasks = [...tasks, task];
  return task;
};

// A patient report is an input to reconciliation, never an edit to the clinical order. The existing
// medication review workflow owns that, so a refill that hits a change hands over to it.
function recordRefillReconciliation(medication, { reviewStatus, patientReportedDose = "", patientNotes = "" }) {
  savePatientMedicationReview(medication.id, reviewStatus, { patientReportedDose, patientNotes });
  ensureMedicationCareTeamTask("MEDICATION_RECONCILIATION_REVIEW", {
    medicationId: medication.id,
    reason: reviewStatus,
    priority: "ROUTINE",
    summary: { medication: medicationLabel(medication), documentedSig: medication.sig || "", patientReported: patientReportedDose || patientNotes || reviewStatus }
  });
}

// Where the pharmacy cannot report back, the product says so instead of implying it will know.
const pharmacyStatusAvailable = medication => Boolean(medication?.pharmacy?.statusIntegration);

// A refill that cannot proceed does not fail quietly: the reason is recorded, the right people get
// a structured summary, and the patient is told what happens next. Nothing about the medication
// order changes here — a patient report is input to reconciliation, never an edit.
async function blockRefill(medication, blocker, { description = "", reviewStatus = "", patientReportedDose = "" } = {}) {
  const episode = activeRefillEpisode() || startRefillEpisode(medication, { source: "PATIENT" });
  if (reviewStatus) recordRefillReconciliation(medication, { reviewStatus, patientReportedDose, patientNotes: description });
  const safetyResult = blocker === REFILL_BLOCKERS.MEDICATION_CONCERN ? await evaluateRefillSafety(description) : null;
  const blocked = { ...episode, blocker, updatedAt: new Date().toISOString() };
  saveRefillEpisode(blocked);
  const resolution = resolveRefillPath({ medication: { ...medication, prescriber: medicationPrescriber(medication) }, blocker, safetyResult });
  audit(state, "medication_refill_blocked", "success", { medicationId: medication.id, blocker, path: resolution.path, severity: safetyResult?.severity || null });
  submitAndShow(medication, blocked, resolution);
}

// The single exit. If the submission did not happen, the patient is told that — never a success
// message for something that failed.
function submitAndShow(medication, episode, resolution) {
  const result = submitRefill(episode, medication, resolution);
  if (!result.ok) {
    state.error = L("I couldn’t send that request right now. You can try again, or call your care team.", "No pude enviar esa solicitud ahora. Puede intentar de nuevo o llamar a su equipo de atención.", "Mwen pa t ka voye demann sa a kounye a. Ou ka eseye ankò oswa rele ekip swen ou.");
    state.refillFlow = { ...state.refillFlow, step: state.refillFlow?.step === "CONFIRM" ? "CONFIRM" : "REVIEW" };
    // A submission that failed leaves the episode open so a retry is the same request, not a new one.
    saveRefillEpisode(advanceRefill(episode, { status: REFILL_STATUS.DRAFT, source: "ITERA", detail: { reason: "SUBMISSION_FAILED" } }));
    render();
    return;
  }
  state.activeRefillId = result.episode.id;
  state.error = "";
  state.refillFlow = { medicationId: medication.id, step: "STATUS", answer: "" };
  state.screen = "MY_MEDICATIONS";
  draftStore.save(state);
  render();
}

function savePatientMedicationReview(medicationId, reviewStatus, reported = {}) {
  const medication = state.careMedications.find(item => item.id === medicationId);
  if (!medication) return false;
  const reviewedAt = new Date().toISOString();
  const review = {
    medicationId,
    sourceMedicationSnapshot: { name: medication.name, details: medication.details || "", active: Boolean(medication.active) },
    reviewStatus,
    patientReportedDose: reported.patientReportedDose || "",
    patientReportedFrequency: reported.patientReportedFrequency || "",
    patientNotes: reported.patientNotes || "",
    reviewedAt,
    source: "PATIENT",
    actorContext: state.completionRole
  };
  state.medicationReviews = { ...(state.medicationReviews || {}), [medicationId]: review };
  state.medicationsReviewStatus = "IN_PROGRESS";
  state.baselineResumeScreen = "MEDICATIONS_REVIEW";
  if (["NOT_TAKING", "DOSE_CHANGED", "FREQUENCY_CHANGED", "NEEDS_REVIEW"].includes(reviewStatus)) {
    const tasks = [...(state.careTeamTasks || [])];
    if (!tasks.some(task => task.type === "MEDICATION_RECONCILIATION_REVIEW" && task.medicationId === medicationId && task.status === "OPEN")) tasks.push({ id: `med_review_${Date.now().toString(36)}`, type: "MEDICATION_RECONCILIATION_REVIEW", medicationId, reason: reviewStatus, status: "OPEN", createdAt: reviewedAt });
    state.careTeamTasks = tasks;
  }
  audit(state, "patient_medication_review_saved", "success", { medicationId, sourceMedicationSnapshot: review.sourceMedicationSnapshot, reviewStatus, patientReportedDose: review.patientReportedDose, patientReportedFrequency: review.patientReportedFrequency, reviewedAt });
  return true;
}

function carePreferences() {
  const preferenceChoice = (name, value, itemIcon, label, checked) => `<label class="choice-card compact-choice"><input type="radio" name="${name}" value="${value}" ${checked ? "checked" : ""}><span class="choice-dot"></span>${icon(itemIcon)}<span><strong>${label}</strong></span></label>`;
  const selectedLanguage = state.preferredCareLanguage || state.language;
  return `${titleBlock(L("Care preferences", "Preferencias de cuidado", "Preferans swen"), L("Choose how and when you prefer ITERA to contact you.", "Elija cómo y cuándo prefiere que ITERA le contacte.", "Chwazi kijan ak kilè ou prefere ITERA kontakte ou."), L("Care setup", "Configuración", "Konfigirasyon swen"))}<form id="care-preferences-form" class="care-preferences-form"><fieldset><legend>${L("Preferred contact method", "Método de contacto preferido", "Fason ou prefere nou kontakte ou")}</legend><div class="choice-list">${preferenceChoice("preferredContactMethod", "phone", "phone", L("Phone call", "Llamada telefónica", "Apèl telefòn"), state.preferredContactMethod === "phone")}${preferenceChoice("preferredContactMethod", "text", "document", L("Text message", "Mensaje de texto", "Mesaj tèks"), state.preferredContactMethod === "text")}${preferenceChoice("preferredContactMethod", "either", "check", L("Either is fine", "Cualquiera está bien", "Nenpòt ladan yo bon"), state.preferredContactMethod === "either")}</div></fieldset><label class="field">${L("Preferred language", "Idioma preferido", "Lang ou prefere")}<select name="preferredCareLanguage"><option value="en" ${selectedLanguage === "en" ? "selected" : ""}>English</option><option value="es" ${selectedLanguage === "es" ? "selected" : ""}>Español</option><option value="ht" ${selectedLanguage === "ht" ? "selected" : ""}>Kreyòl</option></select></label><fieldset><legend>${L("Preferred time of day", "Horario preferido", "Lè ou prefere nan jounen an")}</legend><div class="preference-time-grid">${[["morning", L("Morning", "Mañana", "Maten")], ["afternoon", L("Afternoon", "Tarde", "Apremidi")], ["evening", L("Evening", "Noche", "Aswè")], ["none", L("No preference", "Sin preferencia", "Pa gen preferans")]].map(([value, label]) => `<label><input type="radio" name="preferredContactTime" value="${value}" ${state.preferredContactTime === value ? "checked" : ""}><span>${label}</span></label>`).join("")}</div></fieldset></form><p class="form-error" role="alert">${state.error || ""}</p>${actions(L("Save preferences", "Guardar preferencias", "Sove preferans"))}`;
}

const goalOptions = () => Object.entries(LEGACY_GOAL_TYPES).map(([value, type]) => [value, type === "CUSTOM" ? L("Other", "Otro", "Lòt") : goalDisplayName({ goalType: type }, state.language), type]);
const goalCheck = (value, label, checked, goalType) => `<label class="check-row goal-check-row" data-scroll-anchor="goal-option-${value}"><input type="checkbox" name="careGoal" value="${value}" ${checked ? "checked" : ""}><span class="check-box">✓</span>${goalIcon({ goalType })}<span>${label}</span></label>`;
// Every goal surface renders its icon through this, so the same goal looks the same in Goal
// Discovery, Priorities, the Care Plan, My Goals and Goal Detail. The icon is decorative: the
// goal's name already carries the meaning, so it is hidden from screen readers.
const goalIcon = (goal, extra = "") =>
  `<span class="goal-icon ${extra}" data-goal-category="${goalCategoryOf(goal)}">${icon(resolveGoalIcon(goal, name => name in iconMap), "goal-icon-glyph")}</span>`;

const activePatientGoals = () => (state.patientGoals || []).filter(goal => goal.status !== "REMOVED");
const patientGoalById = id => activePatientGoals().find(goal => goal.id === id);
const currentGoal = () => patientGoalById(state.activeGoalId || state.goalPlanningGoalId) || activePatientGoals()[0];
const assignedAccessPatientGoals = () => activePatientGoals().filter(goal => assignedAccessGoals(state.offer).includes(goal.goalType));
const accessSupportAssessment = goal => {
  const assessment = goal?.supportNeedsAssessment;
  const selectedCategories = Array.isArray(assessment?.selectedCategories)
    ? [...new Set(assessment.selectedCategories.filter(category => category === "NONE" || BARRIER_CATEGORIES[category]))]
    : [];
  return {
    status: assessment?.status === "COMPLETED" ? "COMPLETED" : "NOT_STARTED",
    selectedCategories,
    reviewedAt: assessment?.reviewedAt || ""
  };
};
const accessGoalSupportIsComplete = goal => {
  const assessment = accessSupportAssessment(goal);
  return assessment.status === "COMPLETED" && Boolean(assessment.reviewedAt) && assessment.selectedCategories.length > 0;
};
const syncAccessGoalsStatus = () => {
  const goals = assignedAccessPatientGoals();
  const completed = goals.filter(accessGoalSupportIsComplete).length;
  state.goalsStatus = goals.length && completed === goals.length ? "COMPLETED" : completed ? "IN_PROGRESS" : "NOT_STARTED";
  state.supportNeedsStatus = state.goalsStatus;
  return state.goalsStatus;
};
const goalHistoryEvent = (goalId, type, details = {}) => {
  const occurredAt = new Date().toISOString();
  state.goalHistory = [...(state.goalHistory || []), { id: `goal_event_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, goalId, type, details, occurredAt, actor: "PATIENT" }];
  return occurredAt;
};
const ensureGoalCareTeamTask = (type, goal, details = {}) => {
  const tasks = [...(state.careTeamTasks || [])];
  const existing = tasks.find(task => task.type === type && task.goalId === goal.id && task.status === "OPEN");
  if (existing) return existing;
  const task = { id: `goal_task_${Date.now().toString(36)}`, type, goalId: goal.id, goalTitle: goalDisplayName(goal, state.language), status: "OPEN", createdAt: new Date().toISOString(), ...details };
  state.careTeamTasks = [...tasks, task];
  return task;
};
// ---------------------------------------------------------------------------
// Barriers: what is making a goal hard, what we are doing about it, and whether it helped.
// This layer owns none of the capabilities it uses. Education, Care Circle, device support and
// care-team tasks already exist; the barrier engine decides which of them a difficulty deserves
// and records what happened.
// ---------------------------------------------------------------------------

const barrierCapabilities = () => ({
  hasDevice: Boolean(state.bpDevice || state.assignedDeviceId || state.patientHasBloodPressureMonitor || state.deviceStatus === "ACTIVE"),
  careCircleAvailable: state.completionRole !== "personalRepresentative",
  additionalLanguages: true
});

const goalBarriers = goal => (goal?.barriers || []).map(normalizeBarrierRecord).filter(Boolean);
const activeGoalBarriers = goal => goalBarriers(goal).filter(barrierIsActive);
const resolvedGoalBarriers = goal => goalBarriers(goal).filter(item => item.status === BARRIER_STATUS.RESOLVED);
// Global-care difficulties — transport, language, cost — are raised from whichever goal the
// patient happened to be looking at, so finding one has to look across all of them.
const allPatientBarriers = () => activePatientGoals().flatMap(goal => goalBarriers(goal).map(barrier => ({ ...barrier, goalId: barrier.goalId || goal.id })));
const findBarrierById = barrierId => allPatientBarriers().find(barrier => barrier.id === barrierId) || null;
const activeBarrier = () => (state.activeBarrierId ? findBarrierById(state.activeBarrierId) : null);
const barrierGoal = barrier => (barrier ? patientGoalById(barrier.goalId) : null);

// Analytics carry the shape of the difficulty and never a word the patient wrote.
const auditBarrier = (event, barrier, extra = {}) => audit(state, event, "success", { ...barrierAnalytics(barrier), ...extra });

function persistBarrier(barrier, { historyEvent = "", historyDetails = {} } = {}) {
  const goal = barrierGoal(barrier);
  if (!goal) return barrier;
  const existing = (goal.barriers || []).some(item => item.id === barrier.id);
  goal.barriers = existing
    ? (goal.barriers || []).map(item => (item.id === barrier.id ? barrier : item))
    : [...(goal.barriers || []), barrier];
  goal.updatedAt = new Date().toISOString();
  if (historyEvent) goalHistoryEvent(goal.id, historyEvent, { barrierId: barrier.id, category: barrier.category, ...historyDetails });
  draftStore.save(state);
  return barrier;
}

// Saying the same thing twice is one difficulty with more context. Saying it again months later,
// after it was resolved, is the same difficulty coming back — with its history intact.
function recordBarrier({ goal, category, patientDescription = "", source = BARRIER_SOURCES.PATIENT, goalActionId = null, appointmentRequest = null }) {
  if (!goal) return null;
  const existing = findReusableBarrier(allPatientBarriers(), { category, goalId: goal.id, goalActionId });
  if (existing && barrierIsActive(existing)) {
    const updated = { ...existing, patientDescription: patientDescription || existing.patientDescription, updatedAt: new Date().toISOString() };
    persistBarrier(updated, { historyEvent: "BARRIER_MENTIONED_AGAIN" });
    auditBarrier("goal_barrier_updated", updated, { source });
    return updated;
  }
  if (existing) {
    const reopened = reopenBarrier(existing, { patientDescription });
    persistBarrier(reopened, { historyEvent: "BARRIER_RECURRED", historyDetails: { recurrenceCount: reopened.recurrenceCount } });
    auditBarrier("goal_barrier_recurred", reopened, { source });
    return reopened;
  }
  const barrier = createGoalBarrier({
    patientId: state.offer?.patient?.id || state.assistantDemoPatientId || "",
    goalId: goal.id,
    goalActionId,
    category,
    patientDescription,
    source,
    appointmentRequest
  });
  persistBarrier(barrier, { historyEvent: "BARRIER_IDENTIFIED", historyDetails: { source } });
  auditBarrier("goal_barrier_identified", barrier, { source });
  return barrier;
}

// The safety engine looks first at anything that could be clinical. It runs on the same
// deterministic rules the rest of EMMI uses, never on the model's judgement.
async function evaluateBarrierSafety(barrier) {
  const config = barrierCategoryConfig(barrier.category);
  if (!config.requiresSafetyEvaluation) return null;
  try {
    const runtime = ensureEmmiRuntime();
    return await runtime.tools.execute("evaluateClinicalEscalation", { systolic: 0, diastolic: 0, symptoms: barrier.patientDescription || localBarrierText(config.label, "en") });
  } catch {
    // A safety check that cannot run is treated as needing a person, never as "probably fine".
    return { severity: "CARE_TEAM_REVIEW", instruction: "CREATE_HIGH_PRIORITY_TASK", policy: "SAFETY_CHECK_UNAVAILABLE" };
  }
}

async function planBarrierHelp(barrier) {
  const safetyResult = await evaluateBarrierSafety(barrier);
  return { resolution: resolveBarrier({ barrier, capabilities: barrierCapabilities(), safetyResult }), safetyResult };
}

// What each kind of help is called in front of the patient, and what EMMI says she will do. The
// copy never claims a problem is solved and never blames the patient for having one.
const BARRIER_HELP_COPY = () => ({
  [INTERVENTION_TYPES.EDUCATION]: {
    title: L("Let me explain it", "Permítame explicárselo", "Kite m eksplike w sa"),
    body: L("I can walk you through what your numbers mean, in plain language.", "Puedo explicarle qué significan sus números, en palabras sencillas.", "Mwen ka esplike w sa chif ou yo vle di, an mo senp."),
    cta: L("Explain it to me", "Explíquemelo", "Eksplike m sa")
  },
  [INTERVENTION_TYPES.REMINDER]: {
    title: L("A reminder could help", "Un recordatorio podría ayudar", "Yon rapèl ka ede"),
    body: L("We can add a reminder to your plan for the time of day that suits you.", "Podemos agregar un recordatorio a su plan a la hora que mejor le convenga.", "Nou ka ajoute yon rapèl nan plan ou pou lè ki pi bon pou ou."),
    cta: L("Set up a reminder", "Configurar un recordatorio", "Mete yon rapèl")
  },
  [INTERVENTION_TYPES.ROUTINE_ADJUSTMENT]: {
    title: L("Let’s find a time that fits", "Busquemos un momento que le funcione", "Ann jwenn yon lè ki mache pou ou"),
    body: L("You can change how often these steps happen so they fit your day.", "Puede cambiar con qué frecuencia hace estos pasos para que encajen en su día.", "Ou ka chanje konbyen fwa ou fè etap sa yo pou yo antre nan jounen ou."),
    cta: L("Adjust my plan", "Ajustar mi plan", "Ajiste plan mwen")
  },
  [INTERVENTION_TYPES.DEVICE_GUIDANCE]: {
    title: L("I can walk you through your monitor", "Puedo guiarle con su monitor", "Mwen ka gide w ak monitè ou"),
    body: L("I’ll go step by step, and then we can check whether a reading came through.", "Iremos paso a paso y luego revisamos si llegó una lectura.", "N ap ale etap pa etap, epi n ap tcheke si yon lekti rive."),
    cta: L("Show me the steps", "Muéstreme los pasos", "Montre m etap yo")
  },
  [INTERVENTION_TYPES.CARE_CIRCLE]: {
    title: L("Someone you trust can help", "Alguien de confianza puede ayudar", "Yon moun ou fè konfyans ka ede"),
    body: L("You can invite someone to help you with this. You stay in control of your care.", "Puede invitar a alguien para que le ayude con esto. Usted mantiene el control de su cuidado.", "Ou ka envite yon moun pou ede w ak sa. Se ou ki kontwole swen ou."),
    cta: L("Add someone to my Care Circle", "Agregar a alguien a mi Círculo de cuidado", "Ajoute yon moun nan Sèk swen mwen")
  },
  [INTERVENTION_TYPES.PLAN_ADJUSTMENT]: {
    title: L("We can make the plan smaller", "Podemos hacer el plan más sencillo", "Nou ka fè plan an pi senp"),
    body: L("Choosing fewer steps, or gentler ones, is a normal part of making a plan work.", "Elegir menos pasos, o más sencillos, es parte normal de hacer que un plan funcione.", "Chwazi mwens etap, oswa pi fasil, se yon bagay nòmal pou fè yon plan mache."),
    cta: L("Adjust my plan", "Ajustar mi plan", "Ajiste plan mwen")
  },
  [INTERVENTION_TYPES.LANGUAGE_SUPPORT]: {
    title: L("We can change the language", "Podemos cambiar el idioma", "Nou ka chanje lang lan"),
    body: L("You can read and talk with EMMI in English, Spanish or Kreyòl.", "Puede leer y hablar con EMMI en inglés, español o criollo haitiano.", "Ou ka li epi pale ak EMMI an anglè, panyòl oswa kreyòl."),
    cta: L("Change my language", "Cambiar mi idioma", "Chanje lang mwen")
  },
  [INTERVENTION_TYPES.DEVICE_SUPPORT_TASK]: {
    title: L("Let’s get you real help with the monitor", "Consigamos ayuda real con el monitor", "Ann jwenn èd reyèl pou monitè a"),
    body: L("Our device support team can call you and work through it with you.", "Nuestro equipo de soporte puede llamarle y resolverlo con usted.", "Ekip sipò aparèy nou an ka rele w epi rezoud sa avèk ou."),
    cta: L("Ask for device support", "Solicitar soporte del monitor", "Mande sipò pou aparèy la")
  },
  [INTERVENTION_TYPES.CARE_TEAM_TASK]: {
    title: L("Your care team should see this", "Su equipo de atención debe ver esto", "Ekip swen ou ta dwe wè sa"),
    body: L("I’ll send them what you told me so they can follow up with you.", "Les enviaré lo que me contó para que puedan comunicarse con usted.", "M ap voye sa ou di m pou yo ka kontakte w."),
    cta: L("Tell my care team", "Avisar a mi equipo", "Di ekip swen mwen")
  },
  [INTERVENTION_TYPES.RESOURCE_SUPPORT]: {
    title: L("Let’s ask about support for this", "Consultemos qué apoyo existe", "Ann mande ki sipò ki genyen"),
    body: L("Your care team can look at what support may be available to you.", "Su equipo puede revisar qué apoyo podría estar disponible para usted.", "Ekip swen ou ka gade ki sipò ki ka disponib pou ou."),
    cta: L("Ask my care team", "Consultar a mi equipo", "Mande ekip swen mwen")
  },
  [INTERVENTION_TYPES.APPOINTMENT_COORDINATION]: {
    title: L("Let’s get you an appointment", "Consigamos una cita", "Ann jwenn yon randevou"),
    body: L("Let’s find out how this visit can be arranged. Some offices let me help you pick a time, and some need your care team to coordinate it — I’ll tell you which one this is.", "Veamos cómo se puede coordinar esta visita. En algunos consultorios puedo ayudarle a elegir una hora, y en otros su equipo debe coordinarla: le diré cuál es el caso.", "Ann gade kijan vizit sa a ka fikse. Gen kabinè kote m ka ede w chwazi yon lè, gen lòt kote ekip swen ou dwe koordone l — m ap di w kilès ki sa a."),
    cta: L("Send my request", "Enviar mi solicitud", "Voye demann mwen")
  },
  [INTERVENTION_TYPES.SAFETY_ESCALATION]: {
    title: L("This needs attention now", "Esto necesita atención ahora", "Sa bezwen atansyon kounye a"),
    body: L("If this is an emergency, call 911. I’ve let your care team know as well.", "Si es una emergencia, llame al 911. También avisé a su equipo de atención.", "Si se yon ijans, rele 911. Mwen avèti ekip swen ou tou."),
    cta: L("Talk to my care team", "Hablar con mi equipo", "Pale ak ekip swen mwen")
  }
});

const barrierHelpCopy = type => BARRIER_HELP_COPY()[type] || BARRIER_HELP_COPY()[INTERVENTION_TYPES.CARE_TEAM_TASK];

// Reminder times stay coarse on purpose: a Medicare patient does not need a recurrence editor to
// say "mornings work better for me".
const REMINDER_SLOTS = () => [
  { id: "MORNING", time: "08:00", label: L("Morning", "Por la mañana", "Nan maten") },
  { id: "AFTERNOON", time: "14:00", label: L("Afternoon", "Por la tarde", "Nan apremidi") },
  { id: "EVENING", time: "19:00", label: L("Evening", "Por la noche", "Nan aswè") }
];

const reminderSlotLabel = slotId => REMINDER_SLOTS().find(slot => slot.id === slotId)?.label || "";

// There is no notification scheduler in this product yet, so a reminder is saved with the plan and
// EMMI follows up in the app. Nothing here tells the patient a notification will arrive.
function saveGoalReminder(goal, slotId) {
  const slot = REMINDER_SLOTS().find(item => item.id === slotId);
  if (!goal || !slot) return null;
  const now = new Date().toISOString();
  goal.actions = (goal.actions || []).map(action => ({ ...action, remindersEnabled: true, reminderSlot: slot.id, reminderTime: slot.time, updatedAt: now }));
  goal.reminderPreference = { slot: slot.id, time: slot.time, channel: "IN_APP", createdAt: now };
  goalHistoryEvent(goal.id, "GOAL_REMINDER_SET", { slot: slot.id, channel: "IN_APP" });
  return goal.reminderPreference;
}

// Applying help is where the barrier engine reaches into the capabilities that already exist. Each
// branch returns whether it succeeded, because a patient must never be told something worked when
// it did not.
function applyBarrierHelp(barrier, type, detail = {}) {
  const goal = barrierGoal(barrier);
  if (!goal) return { ok: false };
  if (type === INTERVENTION_TYPES.REMINDER) {
    const preference = saveGoalReminder(goal, detail.slot);
    if (!preference) return { ok: false };
    return { ok: true, detail: { ...detail, channel: "IN_APP" } };
  }
  if (type === INTERVENTION_TYPES.CARE_TEAM_TASK || type === INTERVENTION_TYPES.RESOURCE_SUPPORT || type === INTERVENTION_TYPES.SAFETY_ESCALATION || type === INTERVENTION_TYPES.DEVICE_SUPPORT_TASK || type === INTERVENTION_TYPES.APPOINTMENT_COORDINATION) {
    const taskType = type === INTERVENTION_TYPES.DEVICE_SUPPORT_TASK ? "DEVICE_SUPPORT"
      : type === INTERVENTION_TYPES.SAFETY_ESCALATION ? "CLINICAL_SAFETY_ESCALATION"
        : type === INTERVENTION_TYPES.APPOINTMENT_COORDINATION ? "APPOINTMENT_REQUEST"
          : type === INTERVENTION_TYPES.RESOURCE_SUPPORT ? "RESOURCE_SUPPORT"
            : "PATIENT_BARRIER_REVIEW";
    // The care team receives a structured summary of the difficulty and what was already tried,
    // never a dump of the conversation.
    const task = ensureGoalCareTeamTask(taskType, goal, {
      barrierId: barrier.id,
      priority: type === INTERVENTION_TYPES.SAFETY_ESCALATION ? "URGENT_REVIEW" : "ROUTINE",
      summary: careTeamEscalationSummary({ barrier, goalTitle: goalDisplayName(goal, state.language), request: taskType })
    });
    return { ok: Boolean(task), detail: { ...detail, taskId: task?.id || null, taskType } };
  }
  return { ok: true, detail };
}


// Identify → understand → help. Recording the difficulty and choosing what to offer happen in one
// step, so the patient never sees a screen that only says "noted".
async function startBarrierHelp({ goal, category, patientDescription = "", source = BARRIER_SOURCES.PATIENT }) {
  // Answering EMMI's question turns her suspicion into the patient's own account of it, in the
  // category they chose — not the one the signal guessed.
  const suspected = activeBarrier();
  if (suspected?.status === BARRIER_STATUS.SUSPECTED) {
    const confirmed = confirmBarrier(suspected, { category, patientDescription });
    persistBarrier(confirmed, { historyEvent: "BARRIER_CONFIRMED", historyDetails: { category } });
    auditBarrier("goal_barrier_confirmed", confirmed, { source: BARRIER_SOURCES.PATIENT });
    state.activeBarrierId = confirmed.id;
    await planNextBarrierHelp(confirmed);
    return;
  }
  const barrier = recordBarrier({ goal, category, patientDescription, source });
  if (!barrier) return;
  state.activeBarrierId = barrier.id;
  await planNextBarrierHelp(barrier);
}

// Safety is not offered, it happens: a difficulty the safety engine flags is escalated before the
// patient is asked anything, and then they are told what was done.
async function planNextBarrierHelp(barrier) {
  const { resolution, safetyResult } = await planBarrierHelp(barrier);
  state.barrierHelpPlan = { intervention: resolution.intervention, path: resolution.path, severity: resolution.severity || safetyResult?.severity || null };
  if (resolution.intervention === INTERVENTION_TYPES.SAFETY_ESCALATION) {
    const applied = applyBarrierHelp(barrier, INTERVENTION_TYPES.SAFETY_ESCALATION, { severity: safetyResult?.severity || "CARE_TEAM_REVIEW" });
    const escalated = applyIntervention(barrier, { type: INTERVENTION_TYPES.SAFETY_ESCALATION, detail: applied.detail });
    persistBarrier(escalated, { historyEvent: "BARRIER_SAFETY_ESCALATED", historyDetails: { severity: safetyResult?.severity || "CARE_TEAM_REVIEW" } });
    auditBarrier("goal_barrier_safety_escalated", escalated, { severity: safetyResult?.severity || "CARE_TEAM_REVIEW" });
    state.activeBarrierId = escalated.id;
  }
  state.goalDetailView = "BARRIER_HELP";
  state.error = "";
  draftStore.save(state);
  render();
}

// Help that lives somewhere else in the product is handed over rather than reimplemented here.
async function runInterventionSideEffect(barrier, type, trigger) {
  const goal = barrierGoal(barrier);
  if (type === INTERVENTION_TYPES.EDUCATION || type === INTERVENTION_TYPES.DEVICE_GUIDANCE) {
    state.goalDetailView = "SUMMARY";
    render();
    showHelp(trigger);
    const question = type === INTERVENTION_TYPES.EDUCATION
      ? L("Please explain this to me in simple words.", "Explíquemelo con palabras sencillas, por favor.", "Tanpri eksplike m sa nan mo senp.")
      : L("Can you walk me through using my blood pressure monitor, step by step?", "¿Puede guiarme paso a paso para usar mi monitor de presión?", "Èske ou ka gide m etap pa etap pou m sèvi ak monitè tansyon mwen?");
    await askEmmi(question, { questionId: `barrier-${type.toLowerCase()}`, source: "goal-barrier" });
    return;
  }
  if (type === INTERVENTION_TYPES.CARE_CIRCLE) {
    state.growthReturnScreen = "MY_GOALS";
    state.growthContext = "goal-barrier";
    state.careCircleContext = state.enrollmentStatus === "COMPLETED" ? "ONGOING_CARE" : "ENROLLMENT";
    state.careCircleNotice = "";
    state.goalDetailView = "SUMMARY";
    state.screen = "CARE_CIRCLE_INVITE";
    draftStore.save(state); render(); return;
  }
  if (type === INTERVENTION_TYPES.PLAN_ADJUSTMENT || type === INTERVENTION_TYPES.ROUTINE_ADJUSTMENT) {
    if (goal) {
      state.goalFlowOrigin = "MY_GOALS";
      state.goalPlanningGoalId = goal.id;
      state.goalPlanDraft = { actionIds: (goal.actions || []).filter(item => item.source !== "PATIENT").map(item => item.templateId).filter(Boolean), customAction: (goal.actions || []).find(item => item.source === "PATIENT")?.title || "", frequency: (goal.actions || [])[0]?.frequency || "few-days", remindersEnabled: (goal.actions || []).some(item => item.remindersEnabled), whyItMatters: goal.whyItMatters || "" };
      state.goalFlowStep = "PLAN_ACTIONS";
      state.screen = "GOALS";
    }
    state.goalDetailView = "SUMMARY";
    draftStore.save(state); render(); return;
  }
  if (type === INTERVENTION_TYPES.LANGUAGE_SUPPORT) {
    state.goalDetailView = "SUMMARY";
    setLanguage(state.language === "en" ? "es" : state.language === "es" ? "ht" : "en");
    draftStore.save(state); render(); return;
  }
  state.goalNotice = type === INTERVENTION_TYPES.REMINDER
    ? L("Your reminder is saved with this goal. EMMI will check back to see if it helps.", "Su recordatorio quedó guardado con esta meta. EMMI volverá a preguntarle si le ayuda.", "Rapèl ou anrejistre ak objektif sa a. EMMI ap tounen tcheke si li ede.")
    : L("Your care team has what you told me. They will follow up with you.", "Su equipo de atención tiene lo que me contó. Se comunicarán con usted.", "Ekip swen ou gen sa ou di m. Y ap kontakte w.");
  state.goalDetailView = "SUMMARY";
  state.activeBarrierId = "";
  draftStore.save(state); render();
}

// A signal is not a finding. Missing readings on a goal that expects them opens a question EMMI
// asks the patient; it never records a cause, and it is raised once.
function detectGoalSignalBarriers(goal, runtime) {
  if (!goal || !runtime || goal.status !== "ACTIVE") return;
  if (goalIsReadyToPersonalize(goal)) return;
  const expectsReadings = (goal.actions || []).some(action => action.templateId === "check-bp");
  if (!expectsReadings) return;
  const days = 3;
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = (runtime.readings || []).filter(reading => new Date(reading.timestamp).getTime() >= since);
  if (recent.length) return;
  const alreadyRaised = goalBarriers(goal).some(barrier =>
    barrier.source === BARRIER_SOURCES.SYSTEM_SIGNAL && ["SUSPECTED", "CLOSED"].includes(barrier.status));
  if (alreadyRaised || activeGoalBarriers(goal).length) return;
  const barrier = createGoalBarrier({
    patientId: state.offer?.patient?.id || state.assistantDemoPatientId || "",
    goalId: goal.id,
    category: "DEVICE_TECHNOLOGY",
    source: BARRIER_SOURCES.SYSTEM_SIGNAL,
    patientDescription: ""
  });
  persistBarrier(barrier, { historyEvent: "BARRIER_SIGNAL_RAISED", historyDetails: { signal: "MISSING_READINGS", days } });
  auditBarrier("goal_barrier_signal_raised", barrier, { signal: "MISSING_READINGS" });
}

// ---------------------------------------------------------------------------
// Appointment coordination. The patient says what they need; this layer finds out who can help,
// whether that office can actually be scheduled with, and then either helps them pick a real time,
// sends a request, or hands it to a person. The engines decide; this connects them to the
// patient's record, the safety engine, the barrier engine, the care-team queue and the Care Circle.
// It never says an appointment is confirmed unless a real source said so.
// ---------------------------------------------------------------------------

const appointmentRecords = () => state.appointments || [];
const appointmentById = id => appointmentRecords().find(item => item.id === id) || null;
const activeAppointment = () => (state.activeAppointmentId ? appointmentById(state.activeAppointmentId) : null);

const saveAppointment = record => {
  const existing = appointmentRecords().some(item => item.id === record.id);
  state.appointments = existing
    ? appointmentRecords().map(item => (item.id === record.id ? record : item))
    : [...appointmentRecords(), record];
  draftStore.save(state);
  return record;
};

// §117: a slot id encodes the provider and the exact start time, so it is PHI in everything but
// name. Analytics get a short non-reversible digest; the record's events[] keep the real id.
const slotAuditRef = slotId => {
  const value = String(slotId || "");
  if (!value) return "";
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  return `slot_${(hash >>> 0).toString(36)}`;
};

// Analytics carry the shape of the appointment and never the provider, the address, the join link
// or a word the patient wrote about why they need to be seen.
const auditAppointment = (event, record, extra = {}) => {
  audit(state, event, "success", { ...appointmentAnalytics(record), ...extra });
  // A row that only reaches storage if something else happens to save is a row a patient can lose
  // by closing the tab.
  draftStore.save(state);
};

// Who this product knows can help. There is no provider directory behind this: everything comes
// from the offer and the medication list, and anything the source did not actually state about a
// professional is left blank rather than borrowed from another record.
const defaultCardiologist = () => ({
  id: "dr-martinez-cardiology",
  displayName: "Dr. Pedro Martinez-Clark",
  professionalType: PROFESSIONAL_TYPES.SPECIALIST,
  specialty: "Cardiology",
  practiceName: "Coral Gables Cardiology",
  photoUrl: "/images/Care%20Team/Martinez-Clark-Pedro.jpg",
  source: CARE_TEAM_SOURCES.CARE_RECORD,
  verified: false
});

const patientCareTeam = () => {
  // The care manager used to be relabelled "Care Manager" here, because buildCareTeam handed back
  // the organization and an org in that slot reads as an entry nobody can ask for. It now hands
  // back a person, so overwriting their name with their job title would undo exactly the fix.
  const recordedMembers = buildCareTeam({ offer: state.offer, medications: activeMedications(), locale: state.language })
    .filter(member => member.professionalType !== PROFESSIONAL_TYPES.PHARMACIST);
  const members = [
    ...recordedMembers,
    defaultCardiologist(),
    ...(state.patientAddedCareTeamMembers || [])
  ];
  const seen = new Set();
  return members.filter(member => {
    if (!member?.id || !member.displayName || seen.has(member.id)) return false;
    seen.add(member.id);
    return true;
  });
};

const appointmentActor = ({ viaEmmi = false } = {}) =>
  resolveAppointmentActor({ completionRole: state.completionRole, role: state.role, viaEmmi });

// Every mutating appointment path goes through this. In a prototype with no backend this is the
// only authorization boundary there is, which is exactly why nothing may route around it.
const guardAppointment = (action, { viaEmmi = false } = {}) =>
  canActOnAppointment({
    actor: appointmentActor({ viaEmmi }),
    action,
    identityVerified: Boolean(state.identityVerified),
    careCirclePermissions: state.careCirclePermissions || {}
  });

const appointmentCapability = record =>
  resolveSchedulingCapability({
    patientId: state.offer?.patient?.id || "",
    providerId: record?.requestedProfessionalId || "",
    practiceId: (record?.practiceName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    appointmentType: record?.reasonCategory || ""
  });

// Barriers travel with the appointment as categories, never as the patient's own words.
const knownAppointmentBarriers = () => allPatientBarriers().filter(barrierIsActive).map(barrier => barrier.category);

// Appointment requests join the same care-team queue as everything else. The three older producers
// all wrote a different summary shape under one type string; this is the shape they converge on,
// and it keeps the keys the existing records and tests already read.
const ensureAppointmentCareTeamTask = record => {
  const tasks = state.careTeamTasks || [];
  const existing = tasks.find(task => task.type === "APPOINTMENT_REQUEST" && task.needId === record.id && task.status === "OPEN");
  const summary = appointmentCareTeamSummary(record, {
    patientLabel: state.offer?.patient?.displayName || "",
    knownBarriers: knownAppointmentBarriers(),
    contactPreference: state.offer?.patient?.phoneMasked ? "PHONE" : "IN_APP",
    locale: state.language
  });
  if (existing) {
    const merged = { ...existing, summary: { ...(existing.summary || {}), ...summary } };
    state.careTeamTasks = tasks.map(task => (task.id === existing.id ? merged : task));
    draftStore.save(state);
    return merged;
  }
  const task = {
    id: `appt_task_${Date.now().toString(36)}`,
    type: "APPOINTMENT_REQUEST",
    status: "OPEN",
    createdAt: new Date().toISOString(),
    needId: record.id,
    priority: record.urgencyClassification === APPOINTMENT_URGENCY.ROUTINE ? "ROUTINE" : "PRIORITY",
    summary
  };
  state.careTeamTasks = [...tasks, task];
  auditAppointment(APPOINTMENT_AUDIT_EVENTS.CARE_TEAM_TASK_CREATED, record, { taskId: task.id });
  // A request the care team never receives is not a request. Persist here rather than relying on
  // whatever happens to save next.
  draftStore.save(state);
  return task;
};

// A need becomes a record the moment we understand it, so a patient who leaves mid-conversation
// comes back to something real rather than to nothing.
function startAppointmentNeed({
  source = APPOINTMENT_SOURCES.PATIENT_DIRECT_REQUEST,
  reasonCategory = APPOINTMENT_REASON_CATEGORIES.OTHER,
  reasonSummary = "",
  providerId = "",
  professionalType = "",
  specialty = "",
  relatedGoalId = "",
  relatedBarrierId = "",
  relatedRefillId = "",
  urgencyClassification = APPOINTMENT_URGENCY.ROUTINE
} = {}) {
  const careTeam = patientCareTeam();
  const resolved = resolveRequestedProfessional(careTeam, { text: reasonSummary, specialty, professionalType, locale: state.language });
  const match = providerId ? careTeam.find(member => member.id === providerId) || resolved.match : resolved.match;
  // Saying it twice is one need. A pending request for the same provider and the same reason is
  // surfaced rather than duplicated.
  const duplicate = findDuplicateAppointmentNeed(appointmentRecords(), {
    requestedProfessionalId: match?.id || providerId || "",
    reasonCategory
  });
  if (duplicate) return { record: duplicate, duplicate: true, careTeam, resolution: resolved };
  const record = createAppointmentNeed({
    patientId: state.offer?.patient?.id || state.assistantDemoPatientId || "",
    source,
    reasonCategory,
    reasonSummary,
    relatedGoalId,
    relatedBarrierId,
    relatedRefillId,
    requestedProfessionalId: match?.id || "",
    requestedProfessionalType: match?.professionalType || professionalType || PROFESSIONAL_TYPES.UNKNOWN,
    requestedSpecialty: match?.specialty || specialty || "",
    providerDisplayName: match?.displayName || "",
    practiceName: match?.practiceName || "",
    urgencyClassification,
    actor: appointmentActor()
  });
  saveAppointment(record);
  auditAppointment(APPOINTMENT_AUDIT_EVENTS.NEED_CREATED, record, { source });
  if (match) auditAppointment(APPOINTMENT_AUDIT_EVENTS.PROVIDER_RESOLVED, record, { resolution: resolved.status });
  // A professional this product has never heard of is a care-team question, not a dead end.
  if (resolved.status === "NOT_FOUND" && (specialty || professionalType)) {
    const plan = professionalNotFoundPlan({ requestedSpecialty: specialty, locale: state.language });
    ensureAppointmentCareTeamTask(record);
    return { record, duplicate: false, careTeam, resolution: resolved, notFoundPlan: plan };
  }
  return { record, duplicate: false, careTeam, resolution: resolved };
}

// One place decides what happens next, so text, voice and tapping cannot disagree about whether an
// office can be booked directly.
function classifyAppointmentPath(record) {
  const capability = appointmentCapability(record);
  const updated = beginAppointmentPreferences({ ...record, schedulingCapability: capability.capability }, {
    source: "ITERA",
    actor: appointmentActor(),
    detail: { capability: capability.capability }
  });
  saveAppointment(updated);
  return { record: updated, capability };
}

// Availability is only ever what the scheduling source returned. When it cannot be reached the
// patient is told that, and never shown a time that was invented to fill the screen.
function loadAppointmentAvailability(record) {
  auditAppointment(APPOINTMENT_AUDIT_EVENTS.AVAILABILITY_REQUESTED, record);
  const searching = advanceAppointment(record, { status: APPOINTMENT_STATUS.SEARCHING_AVAILABILITY, source: "ITERA", actor: appointmentActor() });
  const result = getProviderAvailability({
    providerId: record.requestedProfessionalId,
    practiceId: (record.practiceName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    preferredTimeOfDay: record.preferredTimeOfDay,
    preferredDateRange: record.preferredDateRange,
    modality: record.preferredModality,
    now: new Date()
  });
  if (!result.ok) {
    saveAppointment(searching);
    return { ok: false, error: result.error, record: searching };
  }
  const withSlots = advanceAppointment({ ...searching, proposedTimes: result.slots }, {
    status: APPOINTMENT_STATUS.SLOTS_AVAILABLE,
    source: "SCHEDULING_SOURCE",
    actor: APPOINTMENT_ACTORS.SYSTEM,
    detail: { slotCount: result.slots.length }
  });
  saveAppointment(withSlots);
  auditAppointment(APPOINTMENT_AUDIT_EVENTS.SLOTS_SHOWN, withSlots, { slotCount: result.slots.length });
  return { ok: true, slots: result.slots, record: withSlots };
}

// A slot can disappear between being shown and being taken. That is nobody's fault and it is never
// reported as a confirmed appointment.
function confirmAppointmentSlot(record, slotId) {
  const permission = guardAppointment("BOOK");
  if (!permission.allowed) return { ok: false, error: permission.reason };
  const key = appointmentIdempotencyKey({ patientId: record.patientId, providerId: record.requestedProfessionalId, slotId, action: "BOOK" });
  const already = findByIdempotencyKey(appointmentRecords(), key);
  if (already && already.status === APPOINTMENT_STATUS.CONFIRMED) return { ok: true, record: already, idempotent: true };
  auditAppointment(APPOINTMENT_AUDIT_EVENTS.SLOT_SELECTED, record, { slotRef: slotAuditRef(slotId) });
  const selecting = advanceAppointment({ ...record, idempotencyKey: key }, { status: APPOINTMENT_STATUS.PENDING_PATIENT_SELECTION, source: "PATIENT", actor: appointmentActor() });
  const booking = advanceAppointment(selecting, { status: APPOINTMENT_STATUS.BOOKING, source: "PATIENT", actor: appointmentActor(), detail: { slotId } });
  saveAppointment(booking);
  auditAppointment(APPOINTMENT_AUDIT_EVENTS.BOOKING_ATTEMPTED, booking, { slotRef: slotAuditRef(slotId) });
  const result = bookSlot({ appointment: booking, slotId, idempotencyKey: key, now: new Date() });
  if (!result.ok) {
    // Back to the times we actually have, never forward to a confirmation we were not given.
    const reverted = advanceAppointment(booking, {
      status: APPOINTMENT_STATUS.SLOTS_AVAILABLE,
      source: "SCHEDULING_SOURCE",
      actor: APPOINTMENT_ACTORS.SYSTEM,
      detail: { failure: result.slotGone ? "SLOT_GONE" : "BOOKING_FAILED" }
    });
    saveAppointment(reverted);
    return { ok: false, slotGone: Boolean(result.slotGone), record: reverted };
  }
  const confirmed = advanceAppointment({
    ...booking,
    scheduledAt: result.scheduledAt,
    scheduledEndAt: result.scheduledEndAt,
    modality: result.modality,
    locationName: result.locationName || "",
    locationAddress: result.locationAddress || "",
    joinUrl: result.joinUrl || "",
    confirmationNumber: result.confirmationNumber
  }, { status: APPOINTMENT_STATUS.CONFIRMED, source: "SCHEDULING_SOURCE", actor: APPOINTMENT_ACTORS.SYSTEM, detail: { slotId } });
  saveAppointment(confirmed);
  auditAppointment(APPOINTMENT_AUDIT_EVENTS.BOOKING_CONFIRMED, confirmed, { slotRef: slotAuditRef(slotId) });
  return { ok: true, record: confirmed };
}

// A request is a request. The confirmation screen for one says so, and the care team gets a
// structured summary rather than a transcript.
function sendAppointmentRequest(record, { viaEmmi = false } = {}) {
  const permission = guardAppointment("CREATE", { viaEmmi });
  if (!permission.allowed) return { ok: false, error: permission.reason };
  const key = appointmentIdempotencyKey({ patientId: record.patientId, providerId: record.requestedProfessionalId, slotId: "", action: "REQUEST" });
  const already = findByIdempotencyKey(appointmentRecords(), key);
  if (already && already.requestSentAt) return { ok: true, record: already, idempotent: true };
  const result = submitAppointmentRequest({ appointment: { ...record, idempotencyKey: key }, idempotencyKey: key, now: new Date() });
  if (!result.ok) return { ok: false, error: result.error, record };
  const sent = advanceAppointment({ ...record, idempotencyKey: key, requestSentAt: result.requestSentAt }, {
    status: APPOINTMENT_STATUS.REQUEST_SENT,
    source: "ITERA",
    actor: appointmentActor({ viaEmmi }),
    detail: { capability: record.schedulingCapability }
  });
  saveAppointment(sent);
  ensureAppointmentCareTeamTask(sent);
  auditAppointment(APPOINTMENT_AUDIT_EVENTS.REQUEST_SENT, sent);
  return { ok: true, record: sent };
}

// Where the platform cannot coordinate at all, a person does. This is not a failure path dressed
// up as one — it is the honest answer, and it still gives the patient a real next action.
function escalateAppointmentToCoordinator(record, { viaEmmi = false, capability = SCHEDULING_CAPABILITY.HUMAN_COORDINATION } = {}) {
  const permission = guardAppointment("CREATE", { viaEmmi });
  if (!permission.allowed) return { ok: false, error: permission.reason };
  const escalated = advanceAppointment(record, {
    status: APPOINTMENT_STATUS.REQUEST_SENT,
    source: "ITERA",
    actor: appointmentActor({ viaEmmi }),
    detail: { capability }
  });
  if (escalated === record) return { ok: false, error: "TRANSITION_NOT_ALLOWED", record };
  saveAppointment(escalated);
  ensureAppointmentCareTeamTask(escalated);
  auditAppointment(APPOINTMENT_AUDIT_EVENTS.CARE_TEAM_TASK_CREATED, escalated, { path: capability });
  return { ok: true, record: escalated };
}

function gettingStartedResumeRoute() {
  const progress = gettingStartedProgress();
  // Reaching the checklist means the monitor/device portion is already behind the patient. From
  // here onward the persisted section statuses are canonical: an old flowProgress route can still
  // name the very first device screen, while baselineResumeScreen correctly says ONBOARDING.
  const reachedCareSetup = state.baselineResumeScreen === "ONBOARDING" || Boolean(state.onboarding?.savedAt);
  if (reachedCareSetup) {
    return resolveCareSetupResumeRoute({
      medicationsReviewStatus: state.medicationsReviewStatus,
      carePreferencesStatus: state.carePreferencesStatus,
      goalsStatus: state.goalsStatus
    });
  }
  return resolveGettingStartedEntryRoute({
    pathway: state.offer.pathway,
    journey: journeyFor(state),
    savedResumeRoute: state.baselineResumeScreen || progress.resumeRoute,
    configuredRoute: currentFlowTransition().nextRoute
  });
}

let appointmentResponseTimer = null;

function applySimulatedAppointmentResponse(record, now = new Date()) {
  if (!simulatedAppointmentResponseIsDue(record, now)) return null;
  const response = simulateAppointmentServiceResponse(record, { now });
  if (!response.ok) return null;
  const { ok: _responseAccepted, ...confirmation } = response;
  const waiting = record.status === APPOINTMENT_STATUS.REQUEST_SENT
    ? advanceAppointment(record, { status: APPOINTMENT_STATUS.WAITING_FOR_OFFICE, source: "SIMULATED_SCHEDULING_SERVICE", actor: APPOINTMENT_ACTORS.SYSTEM, at: now.toISOString() })
    : record;
  const confirmed = advanceAppointment({ ...waiting, ...confirmation }, {
    status: APPOINTMENT_STATUS.CONFIRMED,
    source: "SIMULATED_SCHEDULING_SERVICE",
    actor: APPOINTMENT_ACTORS.SYSTEM,
    at: now.toISOString(),
    detail: { confirmationNumber: response.confirmationNumber }
  });
  if (confirmed === waiting) return null;
  saveAppointment(confirmed);
  auditAppointment(APPOINTMENT_AUDIT_EVENTS.BOOKING_CONFIRMED, confirmed, { simulatedService: true });
  return confirmed;
}

function scheduleSimulatedAppointmentResponses() {
  if (appointmentResponseTimer) clearTimeout(appointmentResponseTimer);
  appointmentResponseTimer = null;
  if (!simulatedAppointmentServiceEnabled) return;
  const pending = appointmentRecords().filter(record => record && [APPOINTMENT_STATUS.REQUEST_SENT, APPOINTMENT_STATUS.WAITING_FOR_OFFICE].includes(record.status));
  if (!pending.length) return;
  const now = Date.now();
  const nextDueAt = Math.min(...pending.map(record => simulatedAppointmentResponseDueAt(record, SIMULATED_APPOINTMENT_RESPONSE_DELAY_MS) ?? now));
  appointmentResponseTimer = setTimeout(() => {
    appointmentResponseTimer = null;
    const responseTime = new Date();
    const confirmed = appointmentRecords().map(record => applySimulatedAppointmentResponse(record, responseTime)).filter(Boolean);
    if (confirmed.length) {
      state.appointmentNotice = L("Your appointment has been confirmed.", "Su cita ha sido confirmada.", "Randevou ou konfime.");
      if (state.screen === "APPOINTMENT_SCHEDULING" && confirmed.some(record => record.id === state.activeAppointmentId)) {
        state.appointmentFlow = { appointmentId: state.activeAppointmentId, step: "BOOKED", error: "" };
      }
      draftStore.save(state);
      render();
    }
    scheduleSimulatedAppointmentResponses();
  }, Math.max(0, nextDueAt - now));
}

function requestAppointmentReschedule(record, { viaEmmi = false } = {}) {
  const permission = guardAppointment("RESCHEDULE", { viaEmmi });
  if (!permission.allowed) return { ok: false, error: permission.reason };
  const key = appointmentIdempotencyKey({ patientId: record.patientId, providerId: record.requestedProfessionalId, slotId: record.scheduledAt || "", action: "RESCHEDULE" });
  if (record.status === APPOINTMENT_STATUS.RESCHEDULE_REQUESTED) return { ok: true, record, idempotent: true };
  const updated = advanceAppointment({ ...record, idempotencyKey: key }, {
    status: APPOINTMENT_STATUS.RESCHEDULE_REQUESTED,
    source: "PATIENT",
    actor: appointmentActor({ viaEmmi })
  });
  if (updated === record) return { ok: false, error: "TRANSITION_NOT_ALLOWED", record };
  saveAppointment(updated);
  ensureAppointmentCareTeamTask(updated);
  auditAppointment(APPOINTMENT_AUDIT_EVENTS.RESCHEDULE_REQUESTED, updated);
  return { ok: true, record: updated };
}

// Cancelling is destructive and irreversible from the patient's side, so it never happens because
// of something someone typed. It takes an explicit confirmation, every time.
function cancelAppointmentRecord(record, { viaEmmi = false } = {}) {
  const permission = guardAppointment("CANCEL", { viaEmmi });
  if (!permission.allowed) return { ok: false, error: permission.reason };
  if ([APPOINTMENT_STATUS.CANCELED, APPOINTMENT_STATUS.CANCEL_REQUESTED].includes(record.status)) return { ok: true, record, idempotent: true };
  const key = appointmentIdempotencyKey({ patientId: record.patientId, providerId: record.requestedProfessionalId, slotId: record.scheduledAt || "", action: "CANCEL" });
  const requested = advanceAppointment({ ...record, idempotencyKey: key }, { status: APPOINTMENT_STATUS.CANCEL_REQUESTED, source: "PATIENT", actor: appointmentActor({ viaEmmi }) });
  if (requested === record) return { ok: false, error: "TRANSITION_NOT_ALLOWED", record };
  const canceled = advanceAppointment(requested, { status: APPOINTMENT_STATUS.CANCELED, source: "SCHEDULING_SOURCE", actor: APPOINTMENT_ACTORS.SYSTEM });
  saveAppointment(canceled);
  auditAppointment(APPOINTMENT_AUDIT_EVENTS.CANCELED, canceled);
  return { ok: true, record: canceled };
}

// Reminders are in-app only. The product has no scheduler and no channel, and it says so rather
// than letting a patient believe their phone will ring.
function saveAppointmentReminder(record, slotId) {
  const permission = guardAppointment("REMIND");
  if (!permission.allowed) return { ok: false, error: permission.reason };
  const result = createAppointmentReminder(record, slotId, { now: new Date(), confirmed: true });
  if (!result.ok) return result;
  const updated = { ...record, reminder: result.reminder, updatedAt: new Date().toISOString() };
  saveAppointment(updated);
  auditAppointment(APPOINTMENT_AUDIT_EVENTS.REMINDER_CREATED, updated, { slot: slotId });
  return { ok: true, record: updated, reminder: result.reminder, note: result.note };
}

// The first place in this product where a Care Circle permission actually decides anything.
const appointmentCareCircle = () => careCircleSharingOptions({
  invites: growthStore.allSupportInvites().filter(invite => invite.inviterPatientId === state.offer?.patient?.id && !invite.removedAt),
  careCirclePermissions: state.careCirclePermissions || {},
  completionRole: state.completionRole
});

function shareAppointmentWithMember(record, inviteId) {
  const permission = guardAppointment("SHARE");
  if (!permission.allowed) return { ok: false, error: permission.reason };
  const options = appointmentCareCircle();
  if (!options.allowed) return { ok: false, error: options.reason };
  const member = options.eligibleMembers.find(item => item.inviteId === inviteId);
  if (!member) return { ok: false, error: "MEMBER_NOT_ELIGIBLE" };
  if ((record.sharedWith || []).some(item => item.inviteId === inviteId)) return { ok: true, record, idempotent: true };
  const scope = appointmentShareScope(state.language);
  const payload = sharedAppointmentPayload(record, { locale: state.language });
  const updated = { ...record, sharedWith: [...(record.sharedWith || []), { inviteId, scope: scope.version, sharedAt: new Date().toISOString(), payload }], updatedAt: new Date().toISOString() };
  saveAppointment(updated);
  auditAppointment(APPOINTMENT_AUDIT_EVENTS.SHARED_WITH_CARE_CIRCLE, updated, { inviteId });
  return { ok: true, record: updated, scope, payload };
}

// Attendance is asked, never assumed, and a visit that did not happen is a difficulty to solve
// rather than something the patient failed at.
async function recordAppointmentAttendance(record, outcome) {
  const plan = attendanceFollowUpPlan(outcome, state.language);
  const status = outcome === ATTENDANCE_OUTCOMES.ATTENDED
    ? APPOINTMENT_STATUS.COMPLETED
    : outcome === ATTENDANCE_OUTCOMES.MISSED
      ? APPOINTMENT_STATUS.NO_SHOW
      : APPOINTMENT_STATUS.RESCHEDULE_REQUESTED;
  const updated = advanceAppointment({ ...record, attendanceOutcome: outcome, followUpAskedAt: new Date().toISOString() }, {
    status,
    source: "PATIENT",
    actor: appointmentActor(),
    detail: { outcome }
  });
  saveAppointment(updated);
  auditAppointment(APPOINTMENT_AUDIT_EVENTS.FOLLOW_UP_OUTCOME, updated, { outcome });
  if (outcome === ATTENDANCE_OUTCOMES.MISSED && plan?.barrierCategory) {
    const goal = currentGoal();
    if (goal) {
      const barrier = recordBarrier({ goal, category: plan.barrierCategory, source: BARRIER_SOURCES.SYSTEM_SIGNAL });
      if (barrier) {
        saveAppointment({ ...updated, relatedBarrierId: barrier.id });
        auditAppointment(APPOINTMENT_AUDIT_EVENTS.BARRIER_IDENTIFIED, updated, { category: plan.barrierCategory });
        state.activeBarrierId = barrier.id;
        await planNextBarrierHelp(barrier);
        return { ok: true, record: updated, barrier };
      }
    }
    // No goal to attach a difficulty to still means a person should look at this.
    ensureAppointmentCareTeamTask(updated);
  }
  return { ok: true, record: updated };
}

// A difficulty raised from an appointment is the same record the goal screen writes, with the same
// history. The taxonomy does not grow for appointments; it is mapped onto.
async function recordAppointmentBarrier(record, reasonKey) {
  // "I'm all set" is an answer, not a difficulty. Asking and being told nothing is wrong is the
  // point of the check; it must not create a record.
  const plan = appointmentBarrierPlan(reasonKey);
  if (!plan?.category) return { ok: true, record, routed: "NO_BARRIER" };
  const goal = currentGoal();
  if (!goal) {
    ensureAppointmentCareTeamTask(record);
    auditAppointment(APPOINTMENT_AUDIT_EVENTS.BARRIER_IDENTIFIED, record, { category: plan.category, routed: "CARE_TEAM_TASK" });
    return { ok: true, record, routed: "CARE_TEAM_TASK" };
  }
  const barrier = recordBarrier({ goal, category: plan.category, source: BARRIER_SOURCES.PATIENT });
  if (!barrier) return { ok: false, error: "BARRIER_NOT_RECORDED" };
  saveAppointment({ ...record, relatedBarrierId: barrier.id });
  auditAppointment(APPOINTMENT_AUDIT_EVENTS.BARRIER_IDENTIFIED, record, { category: plan.category, routed: "BARRIER_ENGINE" });
  state.activeBarrierId = barrier.id;
  await planNextBarrierHelp(barrier);
  return { ok: true, barrier, routed: "BARRIER_ENGINE" };
}

// ---------------------------------------------------------------------------
// Barrier resolution — the shell's half.
//
// recordAppointmentBarrier() above still does what it always did: it maps the difficulty onto the
// barrier taxonomy and puts it in front of the care team. What follows is the part that used to be
// missing — EMMI actually trying to solve it, with the patient still on the screen.
//
// Everything below is plumbing. The state machine is src/barrierResolution.js, the outside world is
// src/barrierProviders.js, and the pixels are src/barrierResolutionViews.js. This layer connects
// them to the patient's record, the appointment, the care-team queue and the audit trail, and it
// owns exactly one rule of its own: nothing that changes the world runs anywhere except in
// runBarrierResolutionWork(), which is only ever reached from a step the patient confirmed onto.
// ---------------------------------------------------------------------------

const barrierResolutions = () => state.barrierResolutions || [];
const barrierResolutionById = id => barrierResolutions().find(item => item.id === id) || null;
const activeResolution = () => (state.activeResolutionId ? barrierResolutionById(state.activeResolutionId) : null);

const saveResolution = record => {
  const exists = barrierResolutions().some(item => item.id === record.id);
  state.barrierResolutions = exists
    ? barrierResolutions().map(item => (item.id === record.id ? record : item))
    : [...barrierResolutions(), record];
  draftStore.save(state);
  return record;
};

// §23. Two writes, on purpose: the activity log is what EMMI did on this patient's behalf and a
// care team reads it; the audit row is analytics and never carries an address, a name, a phone
// number or a price. `metadata` is checked into the second one, so only ids and enums go in it.
const logResolution = (type, resolution, metadata = {}) => {
  const event = resolutionEvent(type, { resolution, patientId: state.offer?.patient?.id || "", metadata });
  state.barrierActivity = [...(state.barrierActivity || []), event].slice(-100);
  audit(state, type, "success", { ...metadata, barrierType: resolution?.barrierType || "", resolutionId: resolution?.id || "", appointmentId: resolution?.appointmentId || "" });
  draftStore.save(state);
  return event;
};

// The only writer of a resolution's step. Everything that moves a patient forward goes through it,
// which is why the step machine's validation cannot be routed around.
const advanceTo = (resolution, step, patch = {}) => saveResolution(advanceResolution(resolution, step, patch));

const openResolution = resolution => {
  state.activeResolutionId = resolution.id;
  state.activeAppointmentId = resolution.appointmentId;
  state.appointmentFlow = { appointmentId: resolution.appointmentId, view: "RESOLUTION" };
  state.screen = "APPOINTMENT_DETAIL";
  state.barrierError = "";
  draftStore.save(state);
};

// Where the car is going. Built from the appointment record rather than a directory, so an office
// with no address on file produces a destination with a name and no street — which is what the
// review screen then shows, instead of an invented one.
const resolutionDestination = record => ({
  name: record?.locationName || record?.providerDisplayName || "",
  formatted: record?.locationAddress || ""
});

const patientHomeAddress = () => homeAddressFrom(state.shippingAddress || state.offer?.patient?.shippingAddress || null);

// §24's "patient returns to a previously resolved barrier": the same appointment and the same
// difficulty is the same resolution, resumed exactly where it stopped — including when it stopped
// on a success screen. Only a resolution the patient cancelled starts over.
function startBarrierResolution(record, reasonKey) {
  const barrierType = resolutionPlaybookFor(reasonKey);
  if (!record || !barrierType) return null;
  const existing = barrierResolutions().find(item => item.appointmentId === record.id
    && item.barrierType === barrierType
    && item.status !== RESOLUTION_STATUS.CANCELLED);
  if (existing) { openResolution(existing); return existing; }
  const created = createResolution({
    appointmentId: record.id,
    patientId: state.offer?.patient?.id || "",
    barrierType,
    reasonKey
  });
  if (!created) return null;
  saveResolution(created);
  logResolution(RESOLUTION_EVENTS.BARRIER_IDENTIFIED, created, { reasonKey: String(reasonKey || "") });
  logResolution(RESOLUTION_EVENTS.ASSISTANCE_OFFERED, created);
  openResolution(created);
  return created;
}

// §11 / §28. The end of every path EMMI could not finish, and never a dead end: the task joins the
// same care-team queue an appointment request joins, so nothing downstream needs a second inbox.
async function escalateResolution(resolution, reason, { keepStep = false } = {}) {
  const task = careTeamAssistanceRequest({
    resolution,
    patientId: state.offer?.patient?.id || "",
    reason,
    // A patient who cannot physically use a standard car, or whose visit is about to be missed,
    // is not a routine ticket.
    priority: ["ACCESSIBLE_TRANSPORT_REQUIRED", "NO_TRANSPORT_AVAILABLE"].includes(reason) ? "PRIORITY" : "ROUTINE"
  });
  const created = await careTeamService.createAssistanceRequest({ task });
  if (!created.ok) return { ok: false };
  state.careTeamTasks = [...(state.careTeamTasks || []), created.task];
  // Some escalations are about a part of a resolution rather than the whole of it — the ride home
  // when the ride there is booked and confirmed. Moving those to ESCALATED would make the
  // readiness panel say the care team is arranging transportation that the patient already has,
  // so the step stays where it is and only the task is created.
  const carrying = { ...resolution, careTeamTaskId: created.task.id };
  const updated = keepStep
    ? saveResolution({ ...carrying, data: { ...(carrying.data || {}), escalationReason: reason } })
    : advanceTo(carrying, "ESCALATED", { escalationReason: reason });
  logResolution(RESOLUTION_EVENTS.CARE_TEAM_ASSISTANCE_REQUESTED, updated, { reason, taskId: created.task.id, partial: keepStep });
  return { ok: true, resolution: updated, task: created.task };
}

// The escalations that are about one leg of a resolution rather than the whole of it.
const PARTIAL_ESCALATIONS = Object.freeze(["NO_RETURN_TRANSPORT_AVAILABLE"]);

// Moving to the ride step of a transportation resolution, with the pickup time recomputed from
// whatever the appointment currently says. Called on the way in and again after a reschedule, so a
// ride is never quoted against a time the appointment no longer has.
function transportationTimeStep(resolution, record, patch = {}) {
  const pickup = recommendedPickupTime(record?.scheduledAt) || {};
  return advanceTo(resolution, "TIME", {
    ...patch,
    pickupAt: pickup.pickupAt || "",
    recommendedPickupAt: pickup.pickupAt || "",
    arriveByAt: pickup.arriveByAt || "",
    travelMinutes: pickup.travelMinutes || 0
  });
}

/* ---------------------------------------------------------------- the work driver --------- */

// Steps where something is in flight. The driver is idempotent by key: a re-render while a search
// is running does not start a second search, and a step the patient has left is never resumed.
let barrierWorkKey = "";
let barrierCompanionTimer = null;

function startBarrierResolutionWorkIfPending() {
  clearTimeout(barrierCompanionTimer);
  const resolution = activeResolution();
  if (!resolution || state.screen !== "APPOINTMENT_DETAIL" || state.appointmentFlow?.view !== "RESOLUTION") return;
  // An invitation that has gone out is not work in flight — it is a person deciding. The screen
  // waits, and asks the provider once the answer is due rather than polling it.
  if (resolution.step === "SENT") {
    const invitation = resolution.data?.invitation;
    if (!invitation) return;
    const due = new Date(invitation.answersAt || 0).getTime() - Date.now();
    barrierCompanionTimer = setTimeout(() => { readCompanionAnswer(resolution.id); }, Math.max(250, Number.isFinite(due) ? due : companionService.answerDelayMs));
    return;
  }
  if (!isWorkingStep(resolution.step)) return;
  const key = `${resolution.id}:${resolution.step}:${resolution.updatedAt}`;
  if (barrierWorkKey === key) return;
  barrierWorkKey = key;
  runBarrierResolutionWork(resolution)
    .catch(() => { /* a provider that throws is a provider that failed; the step below says so */ })
    .finally(() => { if (barrierWorkKey === key) barrierWorkKey = ""; });
}

// Every call to the outside world this feature makes. One function, so there is exactly one place
// to look when asking "what can this feature actually do to the world?" — and one place to swap
// when a demo provider becomes a real one.
async function runBarrierResolutionWork(resolution) {
  const record = appointmentById(resolution.appointmentId);
  const data = resolution.data || {};
  const locale = state.language;
  // The patient walked away mid-step. Nothing is executed on their behalf while they are gone.
  const stillHere = () => activeResolution()?.id === resolution.id && state.appointmentFlow?.view === "RESOLUTION";

  if (resolution.barrierType === BARRIER_TYPES.TRANSPORTATION && resolution.step === "SEARCHING") {
    logResolution(RESOLUTION_EVENTS.TRANSPORTATION_SEARCH_STARTED, resolution, { needCount: (data.needs || []).length });
    const suitability = transportationSuitability(data.needs || []);
    const result = await transportationService.search({
      appointmentId: resolution.appointmentId,
      pickupAt: data.pickupAt,
      pickupAddress: data.pickupAddress,
      destination: resolutionDestination(record),
      needs: { ...suitability, travelMinutes: data.travelMinutes || 24 },
      locale
    });
    if (!stillHere()) return;
    const options = result.ok ? result.options : [];
    logResolution(RESOLUTION_EVENTS.TRANSPORTATION_OPTIONS_RETURNED, resolution, { optionCount: options.length, ok: result.ok === true });
    advanceTo(resolution, options.length ? "OPTIONS" : "OPTIONS_EMPTY", { options, selectedOptionId: "" });
    render(); return;
  }

  if (resolution.barrierType === BARRIER_TYPES.TRANSPORTATION && resolution.step === "BOOKING") {
    const option = (data.options || []).find(item => item.optionId === data.selectedOptionId);
    if (!option) { advanceTo(resolution, "OPTIONS"); render(); return; }
    const result = await transportationService.reserve({
      option,
      pickupAddress: data.pickupAddress,
      destination: resolutionDestination(record),
      appointmentId: resolution.appointmentId,
      tripType: "OUTBOUND"
    });
    if (!stillHere()) return;
    if (!result.ok) {
      logResolution(RESOLUTION_EVENTS.TRANSPORTATION_RESERVATION_FAILED, resolution, { error: result.error || "UNKNOWN" });
      advanceTo(resolution, "BOOKING_FAILED", { lastError: result.error || "" });
      render(); return;
    }
    // A ride booked to replace one that a reschedule invalidated releases the old car now that a
    // real replacement exists — never before, so the patient is not left with neither.
    if (data.replacingReservationId) {
      const released = await transportationService.cancel({ reservationId: data.replacingReservationId });
      if (released.ok) logResolution(RESOLUTION_EVENTS.TRANSPORTATION_CANCELED, resolution, { replaced: true });
    }
    const booked = advanceTo(resolution, data.returnReservation ? "BOOKED" : "RETURN_OFFER", {
      reservation: { ...result.reservation, pickupLabel: formatBarrierTime(result.reservation.pickupAt, record) },
      replacingReservationId: "",
      reservationOutdated: false
    });
    logResolution(RESOLUTION_EVENTS.TRANSPORTATION_RESERVED, booked, { rideType: option.rideType, tripType: "OUTBOUND" });
    render(); return;
  }

  if (resolution.barrierType === BARRIER_TYPES.TRANSPORTATION && resolution.step === "RETURN_BOOKING") {
    const suitability = transportationSuitability(data.needs || []);
    const search = await transportationService.search({
      appointmentId: `${resolution.appointmentId}:return`,
      pickupAt: data.returnPickupAt,
      pickupAddress: resolutionDestination(record),
      destination: data.pickupAddress,
      needs: { ...suitability, travelMinutes: data.travelMinutes || 24 },
      locale
    });
    if (!stillHere()) return;
    // The return leg reuses the ride type the patient already chose when it is still offered, so
    // the wheelchair-accessible car they picked going does not become a sedan coming back.
    const option = (search.ok ? search.options : []).find(item => item.rideType === data.selectedRideType)
      || (search.ok ? search.options : [])[0];
    if (!option) { advanceTo(resolution, "BOOKED", { returnUnavailable: true }); render(); return; }
    const result = await transportationService.reserve({
      option,
      pickupAddress: resolutionDestination(record),
      destination: data.pickupAddress,
      appointmentId: resolution.appointmentId,
      tripType: "RETURN"
    });
    if (!stillHere()) return;
    if (!result.ok) { advanceTo(resolution, "BOOKED", { returnUnavailable: true }); render(); return; }
    const booked = advanceTo(resolution, "BOOKED", { returnReservation: result.reservation, returnUnavailable: false });
    logResolution(RESOLUTION_EVENTS.RETURN_TRIP_RESERVED, booked, { rideType: option.rideType });
    render(); return;
  }

  if (resolution.barrierType === BARRIER_TYPES.VIDEO_VISIT && resolution.step === "CHECKING") {
    logResolution(RESOLUTION_EVENTS.VIDEO_READINESS_STARTED, resolution);
    const result = await videoReadinessService.check({ appointment: record, locale });
    if (!stillHere()) return;
    const done = advanceTo(resolution, result.ready ? "READY" : "ISSUES", { results: result.results || [], issues: result.issues || [] });
    logResolution(RESOLUTION_EVENTS.VIDEO_READINESS_COMPLETED, done, { ready: result.ready === true, issues: (result.issues || []).join(",") });
    render(); return;
  }

  if (resolution.barrierType === BARRIER_TYPES.COMPANION && resolution.step === "SENDING") {
    const result = await companionService.invite({
      contact: { contactId: data.contactId, firstName: data.contactName, relationship: data.contactRelationship },
      appointmentId: resolution.appointmentId
    });
    if (!stillHere()) return;
    if (!result.ok) { advanceTo(resolution, "REVIEW"); render(); return; }
    const sent = advanceTo(resolution, "SENT", { invitation: result.invitation });
    logResolution(RESOLUTION_EVENTS.COMPANION_INVITED, sent, { contactSource: data.contactSource || "" });
    render(); return;
  }

  if (resolution.barrierType === BARRIER_TYPES.RESCHEDULE && resolution.step === "SEARCHING") {
    logResolution(RESOLUTION_EVENTS.APPOINTMENT_RESCHEDULE_REQUESTED, resolution);
    const result = await schedulingAssistService.getAvailableSlots({ appointment: record, now: new Date() });
    if (!stillHere()) return;
    const slots = result.ok ? result.slots : [];
    advanceTo(resolution, slots.length ? "SLOTS" : "SLOTS_EMPTY", { slots, selectedSlotId: "" });
    render(); return;
  }

  if (resolution.barrierType === BARRIER_TYPES.RESCHEDULE && resolution.step === "CHANGING") {
    const slot = (data.slots || []).find(item => item.slotId === data.selectedSlotId);
    const result = slot ? await schedulingAssistService.reschedule({ appointment: record, slot }) : { ok: false, error: "SLOT_GONE" };
    if (!stillHere()) return;
    if (!result.ok) { advanceTo(resolution, "CHANGE_FAILED", { lastError: result.error || "" }); render(); return; }
    // The appointment itself moves, and it moves through the status machine rather than around it.
    // CONFIRMED -> CONFIRMED is refused by design (that guard is what makes a double tap harmless),
    // so a reschedule is what the machine already says it is: the change is requested, the original
    // stays live, and the new time is confirmed on top of it. The record ends up carrying both
    // events, which is exactly what a care team needs to see afterwards.
    const requested = advanceAppointment(record, {
      status: APPOINTMENT_STATUS.RESCHEDULE_REQUESTED,
      source: "PATIENT",
      actor: appointmentActor(),
      detail: { via: "BARRIER_RESOLUTION" }
    });
    const moved = applyBookingConfirmation(requested, {
      confirmationNumber: result.confirmationNumber,
      scheduledAt: result.scheduledAt,
      scheduledEndAt: result.scheduledEndAt,
      modality: result.modality,
      locationName: result.locationName,
      locationAddress: record?.locationAddress || "",
      timezone: record?.timezone || "",
      source: "PATIENT_RESCHEDULE",
      actor: appointmentActor()
    });
    saveAppointment(moved);
    auditAppointment(APPOINTMENT_AUDIT_EVENTS.BOOKING_CONFIRMED, moved, { rescheduledByPatient: true });
    // §6's orchestration: a ride booked against the old time is now wrong, and the patient is told
    // so on the success screen rather than finding out on the day.
    const ride = transportationResolutionFor(record?.id);
    if (ride?.data?.reservation) saveResolution({ ...ride, data: { ...ride.data, reservationOutdated: true } });
    const changed = advanceTo(resolution, "CHANGED", { transportationNeedsUpdate: Boolean(ride?.data?.reservation), hasTransportation: Boolean(ride?.data?.reservation) });
    logResolution(RESOLUTION_EVENTS.APPOINTMENT_RESCHEDULED, changed, { transportationNeedsUpdate: Boolean(ride?.data?.reservation) });
    render(); return;
  }

  if (resolution.barrierType === BARRIER_TYPES.OTHER && resolution.step === "CLASSIFYING") {
    // The classifier is instant. The pause is the product being honest about thinking rather than
    // flashing an answer the patient cannot see arrive — and it is the seam where an LLM call goes.
    await barrierPause(600);
    if (!stillHere()) return;
    const verdict = classifyResolutionIntent(data.text || "");
    const routed = advanceTo(resolution, verdict.barrierType ? "ROUTED" : "ESCALATE_OFFER", {
      routedTo: verdict.barrierType || "",
      confidence: verdict.confidence
    });
    // The patient's own words are never in analytics — only what EMMI made of them.
    logResolution(RESOLUTION_EVENTS.BARRIER_INTENT_CLASSIFIED, routed, { routedTo: verdict.barrierType || "NONE", confidence: verdict.confidence });
    render(); return;
  }
}

// The companion answer, read once it is due. It is a read of the provider rather than a timer that
// decides the outcome, so the answer is the same whoever asks and whenever they ask.
async function readCompanionAnswer(resolutionId) {
  const resolution = barrierResolutionById(resolutionId);
  if (!resolution || resolution.step !== "SENT") return;
  const status = companionService.getStatus({ invitation: resolution.data?.invitation, now: new Date() });
  if (!status.ok || status.status === "PENDING") return;
  if (activeResolution()?.id !== resolutionId) {
    // The patient is elsewhere. The answer is still recorded — they will see it on the appointment
    // and on the barrier list — but the screen they are on is not taken away from them.
    const settled = advanceTo(resolution, status.status === "CONFIRMED" ? "CONFIRMED" : "DECLINED_BY_CONTACT", {});
    logResolution(status.status === "CONFIRMED" ? RESOLUTION_EVENTS.COMPANION_CONFIRMED : RESOLUTION_EVENTS.COMPANION_DECLINED, settled);
    return;
  }
  const settled = advanceTo(resolution, status.status === "CONFIRMED" ? "CONFIRMED" : "DECLINED_BY_CONTACT", {});
  logResolution(status.status === "CONFIRMED" ? RESOLUTION_EVENTS.COMPANION_CONFIRMED : RESOLUTION_EVENTS.COMPANION_DECLINED, settled);
  render();
}

/* -------------------------------------------------------------- reading it back out ------- */

const transportationResolutionFor = appointmentId => barrierResolutions().find(item =>
  item.appointmentId === appointmentId
  && item.barrierType === BARRIER_TYPES.TRANSPORTATION
  && item.status !== RESOLUTION_STATUS.CANCELLED) || null;

// A time in the appointment's own zone, for the one place a resolution stores a pre-formatted
// string: the readiness panel's "Uber · Pickup 2:00 p.m." line, which has no appointment to hand.
const formatBarrierTime = (value, record) => formatAppointmentTime(value, record?.timezone || "", state.language);

// §10. Which barrier options on the pre-visit list already have something under way, keyed by the
// reason the button emits so the view never has to know about resolutions.
function appointmentBarrierStates(record) {
  const states = {};
  if (!record) return states;
  const mine = barrierResolutions().filter(item => item.appointmentId === record.id);
  if (!mine.length) return states;
  Object.keys(APPOINTMENT_BARRIER_REASONS).forEach(reasonKey => {
    const barrierType = resolutionPlaybookFor(reasonKey);
    if (!barrierType) return;
    const resolution = [...mine].filter(item => item.barrierType === barrierType)
      .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt))).at(-1);
    const listState = barrierListState(resolution, state.language);
    if (listState) states[reasonKey] = listState;
  });
  return states;
}

// §9. Only shown once the patient has actually engaged with getting ready for this visit — a
// readiness panel on an appointment nobody raised anything about invents a problem.
function appointmentReadinessFor(record) {
  if (!record) return null;
  const raised = barrierResolutions().some(item => item.appointmentId === record.id);
  const acknowledged = Boolean(state.barrierReadinessAck?.[record.id]);
  if (!raised && !acknowledged) return null;
  return appointmentReadiness({ appointment: record, resolutions: barrierResolutions(), locale: state.language });
}

// §13. The badge is for whoever is running the demo, never for the patient, so it is off in a
// production build unless a tester deliberately asked for it in the URL.
const showBarrierDemoBadge = () => barrierDemoMode() && (!import.meta.env.PROD || params.get("demoBadge") === "1");

function barrierResolutionProps(resolution) {
  const record = appointmentById(resolution.appointmentId);
  const data = resolution.data || {};
  return appointmentViewProps({
    resolution,
    appointment: record,
    timezone: record?.timezone || "",
    homeAddress: patientHomeAddress(),
    destination: resolutionDestination(record),
    options: data.options || [],
    slots: data.slots || [],
    contacts: companionService.contacts({ careCircleMembers: appointmentCareCircle().eligibleMembers, locale: state.language }).contacts,
    error: state.barrierError || "",
    showDemoBadge: showBarrierDemoBadge()
  });
}

// ---------------------------------------------------------------------------
// What the patient is looking at — assembled, checked against the document, and published.
//
// Three things happen here and nothing else:
//
//   1. emmiViewContext()      builds the descriptor for whatever is on screen. A describer if the
//                             feature has one, and otherwise the screen's own heading, lead and
//                             controls — so a feature nobody has written a describer for is
//                             degraded, never invisible.
//   2. syncEmmiViewContext()  notices the descriptor changed and pushes it into the live voice
//                             session, silently. This is the fix for the original defect: a voice
//                             session takes its system instruction once, so without a push EMMI
//                             answers every question from the screen the microphone opened on.
//   3. performEmmiViewAction() presses a control EMMI asked for — by finding the real element and
//                             clicking it, which is why EMMI cannot do anything the patient could
//                             not do themselves at that exact moment.
//
// Chat needs none of this plumbing: it calls assistantContext() fresh on every turn and therefore
// reads the same descriptor by construction. That is the point — one context, two modalities.
// ---------------------------------------------------------------------------

// The descriptor last published, and its signature. Held here rather than on state because it is
// derived from the DOM and belongs to the paint, not to the patient's record.
let publishedView = null;
let publishedViewSignature = "";

const screenRoot = () => document.querySelector("#screen-content");

// The snapshot the appointment describers read. Assembled from the same functions the screens
// render from, so a value EMMI says and a value the patient reads cannot drift apart.
function appointmentViewSnapshot() {
  const record = activeAppointment();
  const flow = state.appointmentFlow || {};
  const view = state.screen === "APPOINTMENT_DETAIL"
    ? (flow.view || (record && appointmentFollowUpDue(record, new Date()) ? "FOLLOW_UP" : ""))
    : "";
  return {
    screen: state.screen,
    view,
    appointment: record,
    appointments: appointmentRecords(),
    tab: flow.tab || "",
    schedulingStep: flow.step || "",
    preVisitCheck: record ? preVisitCheckOptions({ appointment: record, locale: state.language }) : null,
    barrierStates: record ? appointmentBarrierStates(record) : null,
    readiness: record ? appointmentReadinessFor(record) : null,
    members: appointmentCareCircle().eligibleMembers || [],
    locale: state.language
  };
}

// The extras a resolution describer needs that live outside the resolution record: the contacts
// the companion step is choosing between, the pickup times, the return times, the special needs.
function resolutionViewExtras(resolution) {
  const data = resolution.data || {};
  return {
    contacts: companionService.contacts({ careCircleMembers: appointmentCareCircle().eligibleMembers, locale: state.language }).contacts,
    needOptions: transportNeedOptions(state.language),
    pickupChoices: pickupTimeChoices(data.recommendedPickupAt || data.pickupAt, state.language),
    returnChoices: returnTripChoices(state.language),
    homeAddress: patientHomeAddress()
  };
}

// The snapshots the rest of the product's describers read. Each one is assembled from the same
// functions the screens themselves render from, so a value EMMI says and a value on screen cannot
// come apart.
const goalViewSnapshot = () => {
  const goal = currentGoal();
  const health = goal?.goalType === "BLOOD_PRESSURE_CONTROL" ? bloodPressureGoalRuntime(goal) : null;
  return {
    screen: state.screen,
    detailView: state.goalDetailView || "",
    flowStep: state.goalFlowStep || "",
    goal: goal ? {
      id: goal.id,
      title: goalDisplayName(goal, state.language),
      status: goal.status,
      priority: goal.priority,
      whyItMatters: goal.whyItMatters || "",
      actions: (goal.actions || []).map(item => ({ id: item.id, title: item.title, status: item.status, frequency: item.frequency || "", verificationMethod: resolveGoalActionVerification(item) })),
      barriers: activeGoalBarriers(goal).map(item => ({ id: item.id, category: item.category, status: item.status })),
      latestReading: health?.latest || null,
      clinicalTarget: health?.clinicalTarget || null
    } : null,
    goals: activePatientGoals().map(item => ({ id: item.id, title: goalDisplayName(item, state.language), status: item.status, priority: item.priority, planStatus: item.planStatus })),
    locale: state.language
  };
};

const medicationViewSnapshot = () => ({
  screen: state.screen,
  refillStep: state.refillFlow?.step || "",
  medications: (state.careMedications || []).map(item => ({ id: item.id, name: medicationLabel(item), strength: item.strength || "", details: medicationDetails(item) || medicationSig(item) || "", active: item.active !== false, pharmacy: item.pharmacy || null })),
  reviews: state.medicationReviews || {},
  refills: state.medicationRefills || [],
  activeMedication: (state.careMedications || []).find(item => item.id === state.refillFlow?.medicationId) || null,
  locale: state.language
});

const careCircleViewSnapshot = () => ({
  screen: state.screen,
  members: appointmentCareCircle().eligibleMembers || [],
  invitePending: state.supportInviteStatus === "SENT" || state.careCircleInvitePending === true,
  permissions: state.careCirclePermissions || null,
  supportPersonName: state.supportPersonName || "",
  locale: state.language
});

const deviceViewSnapshot = () => ({
  screen: state.screen,
  deviceVerificationStatus: state.deviceVerificationStatus || "",
  device: state.assignedDeviceId || state.deviceModel ? { vendor: state.deviceVendor || "", model: state.deviceModel || "" } : null,
  baselineTaken: state.bpBaselineReadingCount || 0,
  baselineRemaining: state.bpBaselineRemainingReadings ?? 0,
  baselineRequired: state.bpBaselineRequiredReadings || 0,
  locale: state.language
});

const enrollmentViewSnapshot = () => ({
  screen: state.screen,
  enrollment: {
    identityVerified: Boolean(state.identityVerified),
    consentSaved: Boolean(state.consentSaved),
    enrollmentComplete: state.enrollmentStatus === "COMPLETED",
    canContinue: state.accessOutcome ? state.accessOutcome === "eligible" : null,
    disclosureAcknowledged: Boolean(state.disclosureAcknowledgedAt)
  },
  locale: state.language
});

// The descriptor for right now. Describer first, document second, and the document always has the
// last word on which controls exist.
function emmiViewContext() {
  const root = screenRoot();
  let described = null;
  const resolution = state.screen === "APPOINTMENT_DETAIL" && state.appointmentFlow?.view === "RESOLUTION" ? activeResolution() : null;
  if (resolution) {
    described = describeResolutionView({
      resolution,
      appointment: appointmentById(resolution.appointmentId),
      locale: state.language,
      extras: resolutionViewExtras(resolution)
    });
  } else if (["APPOINTMENT_DETAIL", "APPOINTMENT_SCHEDULING", "MY_APPOINTMENTS"].includes(state.screen)) {
    described = describeAppointmentView(appointmentViewSnapshot());
  } else {
    // The rest of the product. Each describer answers for its own screens and null for everything
    // else, so the order here is not a priority list — it is just the order they were written in.
    described = describeGoalView(goalViewSnapshot())
      || describeMedicationView(medicationViewSnapshot())
      || describeCareCircleView(careCircleViewSnapshot())
      || describeDeviceView(deviceViewSnapshot())
      || describeEnrollmentView(enrollmentViewSnapshot());
  }
  if (described) return withLiveControls(normalizeEmmiView({ ...described, screenId: described.screenId || state.screen }), root);
  // The floor. Every other screen in the product still tells EMMI its heading, the sentence under
  // it and the controls it drew, which is enough to answer "what do I do here?" and enough that a
  // feature added tomorrow is never a blank.
  return describeEmmiViewFromDom(root, { screenId: state.screen, viewId: `SCREEN_${state.screen}`, locale: state.language });
}

// Called from the paint. Compares meaning rather than markup, so a re-render that changed nothing
// costs nothing and a changed price, selection or completed action reaches EMMI immediately.
function syncEmmiViewContext() {
  const view = emmiViewContext();
  const signature = emmiViewSignature(view);
  if (signature === publishedViewSignature) return false;
  publishedView = view;
  publishedViewSignature = signature;
  // Voice only. Chat reads the same descriptor through assistantContext() on its next turn, so
  // pushing to it would be sending it something it is about to ask for.
  if (emmiLive?.isActive()) emmiLive.sendContextUpdate(emmiViewForModel(view), { label: "APP SCREEN UPDATE" });
  return true;
}

// The descriptor as the model reads it. Rebuilt rather than cached when nothing has published yet,
// so a chat turn on a screen voice never saw still gets the real thing.
const emmiModelView = () => emmiViewForModel(publishedView || emmiViewContext());

// What EMMI can see, and what EMMI can press, reachable from a test or a QA console. Development
// builds only: this is the same pair of functions the tools call, so a test asserting on them is
// asserting on the real path rather than on a copy of it — but a production build must not hand a
// page script a way to press the patient's buttons.
if (!import.meta.env.PROD) {
  globalThis.__emmiViewProbe = () => emmiModelView();
  // Any tool, through the orchestrator the model calls — so a tool that fails for EMMI fails here
  // in the same way, with the same error, rather than only inside a live session.
  globalThis.__emmiToolProbe = async (name, args = {}) => {
    try { return { ok: true, result: await ensureEmmiRuntime().tools.execute(name, args) }; }
    catch (error) { return { ok: false, error: String(error?.message || error) }; }
  };
  globalThis.__emmiActionProbe = params => performEmmiViewAction(params || {});
  // Whether a live session is open, which is what decides whether a screen change is pushed.
  globalThis.__emmiVoiceProbe = () => ({ state: state.assistantVoiceState, active: Boolean(emmiLive?.isActive()), error: state.assistantVoiceError || "", socket: Boolean(emmiLive?.session), contextVersion: emmiLive?.activeContextVersion ?? null });
  // Ask the live session a question as the patient, and read back what EMMI answered. The words go
  // in as a patient turn on the same session, against the same context a spoken question would
  // reach — which is what makes this a real test of the context rather than of the microphone.
  globalThis.__emmiVoiceAsk = async question => {
    if (!emmiLive?.isActive()) return { ok: false, reason: "NO_SESSION" };
    // A patient speaks when they want to, including over screen guidance — that is what barge-in
    // is for — so this does not wait for silence. It only retries a turn the client refuses,
    // which happens while a context handoff is in flight and clears in a few hundred milliseconds.
    const before = state.assistantMessages.length;
    let sent = false;
    for (let attempt = 0; attempt < 30 && !sent; attempt += 1) {
      sent = emmiLive.sendText(String(question || ""), { priority: "PATIENT_RESPONSE", contextIndependent: true });
      if (!sent) await new Promise(resolve => setTimeout(resolve, 300));
    }
    if (!sent) return { ok: false, reason: "TURN_REFUSED", voiceState: state.assistantVoiceState, socket: Boolean(emmiLive.session) };
    // Screen narration is not an answer, so it is filtered out by the same flag the transcript
    // uses to keep it out of model memory.
    const answerSoFar = () => state.assistantMessages.slice(before).filter(message => message.role === "assistant" && !message.guidance);
    // The answer arrives as a stream of transcript chunks, and the state can touch LISTENING
    // between two of them. So the turn is finished when the text has stopped growing, not when the
    // state says idle — otherwise the test reads the first two words and calls it an answer.
    const deadline = Date.now() + 45000;
    let text = "";
    let steadyFor = 0;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 250));
      const next = answerSoFar().map(message => message.text).join(" ");
      steadyFor = next === text && next ? steadyFor + 250 : 0;
      text = next;
      if (steadyFor >= 2500) return { ok: true, text };
    }
    const late = answerSoFar();
    return late.length
      ? { ok: true, text: late.map(message => message.text).join(" "), timedOut: true }
      : { ok: false, reason: "NO_ANSWER", voiceState: state.assistantVoiceState, voiceError: state.assistantVoiceError || "", tail: state.assistantMessages.slice(-3).map(message => `${message.role}:${message.guidance ? "guidance:" : ""}${String(message.text || "").slice(0, 80)}`) };
  };
}

/* ---------------------------------------------------------------- acting on the screen ---- */

const VIEW_ACTION_STATUS = Object.freeze({
  PERFORMED: "PERFORMED",
  NOT_AVAILABLE: "CONTROL_NOT_ON_SCREEN",
  CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
  NEEDS_TYPED_INPUT: "NEEDS_TYPED_INPUT",
  UNKNOWN_ACTION: "UNKNOWN_ACTION",
  SCREEN_NOT_DESCRIBED: "SCREEN_NOT_DESCRIBED"
});

// EMMI pressing a button. The authorization rules live here, next to the controls, rather than in
// a prompt — a prompt can be talked out of them.
async function performEmmiViewAction({ actionId = "", optionRef = "", confirmed = false, text = "" } = {}) {
  const view = publishedView || emmiViewContext();
  const root = screenRoot();
  if (!view || !root) return { success: false, status: VIEW_ACTION_STATUS.NOT_AVAILABLE };

  // A screen nobody has described reaches EMMI through the DOM floor, where the kind of every
  // control is inferred from the verb in its name. That inference is good enough to explain a
  // screen and it is not good enough to authorise acting on one: it read "pause my goal" as
  // navigation until this week. So on those screens EMMI names the button and the patient presses
  // it. Being able to act is earned by writing the describer, which is where somebody actually
  // decides what each control does.
  if (view.source === "DOM") {
    return {
      success: false,
      status: VIEW_ACTION_STATUS.SCREEN_NOT_DESCRIBED,
      note: "Nothing was pressed. On this screen, tell the patient which control to use and let them press it.",
      availableActions: view.actions.map(item => ({ id: item.id, label: item.label }))
    };
  }

  // An option reference wins when both are given: "select the first one" names a choice, and the
  // action that selects it is whatever that choice's own control is.
  const option = optionRef ? findViewOption(view, optionRef) : null;
  if (optionRef && !option) {
    // A reference to something that is not on this screen. Handing back both lists rather than
    // only the choices matters on a screen that has none: EMMI asking for "the second one" on a
    // review page should learn what that page does have, not receive an empty array.
    return {
      success: false,
      status: VIEW_ACTION_STATUS.UNKNOWN_ACTION,
      availableChoices: view.options.map(item => ({ n: item.ordinal, id: item.id, label: item.label })),
      availableActions: view.actions.map(item => ({ id: item.id, label: item.label, kind: item.kind })),
      currentView: emmiViewForModel(view)
    };
  }
  const target = option || findViewAction(view, actionId);
  if (!target) {
    return { success: false, status: VIEW_ACTION_STATUS.UNKNOWN_ACTION, availableActions: view.actions.map(item => ({ id: item.id, label: item.label, kind: item.kind })) };
  }

  // An option is a selection by definition; an action carries its own kind.
  const kind = option ? VIEW_ACTION_KINDS.SELECT : target.kind;
  const typed = String(text || "").trim().slice(0, 400);
  if (kind === VIEW_ACTION_KINDS.INPUT) {
    // A single-box action can be completed with the patient's own words — that is what makes
    // "add that I want to ask about my dizziness" something EMMI can actually do rather than
    // only describe. A control with no named box, or a call with no words, is refused: EMMI
    // asking the patient to type it is the honest outcome, and guessing five form fields is not.
    if (!target.inputSelector) return { success: false, status: VIEW_ACTION_STATUS.NEEDS_TYPED_INPUT, note: "This control reads a form the patient has to fill in themselves. Ask them to type it." };
    if (!typed) return { success: false, status: VIEW_ACTION_STATUS.NEEDS_TYPED_INPUT, note: `Call again with text: ${target.inputHint || "what the patient said"}.` };
  }
  // The line EMMI may not cross without being told to in the same turn. It is enforced here, on
  // the kind the describer assigned, so no wording in a prompt can move it.
  if (CONFIRMATION_REQUIRED_KINDS.includes(kind) && confirmed !== true) {
    return { success: false, status: VIEW_ACTION_STATUS.CONFIRMATION_REQUIRED, actionLabel: target.label, effect: target.effect || "", note: "Ask the patient to confirm in their own words, then call again with confirmed true." };
  }

  const element = target.selector ? root.querySelector(target.selector) : null;
  if (!element || element.disabled) {
    // The screen moved on between EMMI reading it and acting on it. Nothing happened, and the
    // caller is handed the current screen rather than an error it would have to guess about.
    return { success: false, status: VIEW_ACTION_STATUS.NOT_AVAILABLE, currentView: emmiViewForModel(emmiViewContext()) };
  }

  // The patient's words go into the real box, through the real input event, so the handler that
  // reads it cannot tell EMMI apart from a keyboard — and so nothing is stored that the screen
  // does not also show.
  if (kind === VIEW_ACTION_KINDS.INPUT) {
    const field = root.querySelector(target.inputSelector);
    if (!field) return { success: false, status: VIEW_ACTION_STATUS.NOT_AVAILABLE, currentView: emmiViewForModel(emmiViewContext()) };
    field.value = typed;
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }
  // The audit row records that EMMI pressed something and which kind it was. Never the words:
  // a topic can carry a symptom, and the EMMI transcript is the deliberate sink for those.
  audit(state, "emmi_view_action_performed", "success", { viewId: view.viewId, actionId: option ? "select-option" : target.id, kind, withText: Boolean(typed), viaVoice: Boolean(emmiLive?.isActive()) });
  element.click();
  // The handlers are async and re-render; wait a paint so the result describes what the patient
  // can now see rather than what they could see a moment ago.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const after = emmiViewContext();
  publishedView = after;
  publishedViewSignature = emmiViewSignature(after);
  return {
    success: true,
    status: VIEW_ACTION_STATUS.PERFORMED,
    performed: { id: option ? option.id : target.id, label: target.label, kind },
    // What the patient is now looking at. The model answers from this rather than from what it
    // expected the button to do, which is what stops it announcing a result that did not happen.
    currentView: emmiViewForModel(after)
  };
}

// §82/§83: an upcoming visit or an open request with the same office, for the same reason, is the
// thing the patient is already waiting on — not a reason to start a second one.
const existingAppointmentFor = record => {
  if (!record?.requestedProfessionalId) return null;
  const others = appointmentRecords().filter(item => item.id !== record.id);
  return findUpcomingAppointmentWithProvider(others, record.requestedProfessionalId, new Date())
    || findDuplicateAppointmentNeed(others, { requestedProfessionalId: record.requestedProfessionalId, reasonCategory: record.reasonCategory });
};

const openAppointmentDetail = (id, view = "") => {
  state.activeAppointmentId = id;
  state.appointmentFlow = view ? { appointmentId: id, view } : null;
  state.screen = "APPOINTMENT_DETAIL";
  draftStore.save(state);
};

const openAppointmentScheduling = (record, step = "REASON") => {
  state.activeAppointmentId = record.id;
  // A draft belongs to one need. Reusing the prior appointment's draft leaks its choices into this
  // request; creating only { needId } loses what EMMI already captured. Hydrate from this record on
  // first entry, then preserve the patient's in-progress answers on later entries.
  const existingDraft = state.appointmentDraft?.needId === record.id ? state.appointmentDraft : null;
  state.appointmentDraft = existingDraft || createAppointmentDraft({ ...record, needId: record.id });
  state.appointmentFlow = { appointmentId: record.id, step, view: "" };
  state.screen = "APPOINTMENT_SCHEDULING";
  draftStore.save(state);
};

const appointmentViewProps = extra => ({ locale: state.language, icon, escapeHtml, now: new Date(), ...extra });

// §21: a person coordinating is not an office deciding. The patient is told which it is.
function appointmentCoordinationConfirmation(record) {
  return `${titleBlock(L("Your care team is coordinating this", "Su equipo está coordinando esto", "Ekip swen ou ap koordone sa"), L("A care manager will work out the time with the office and come back to you.", "Un coordinador acordará la hora con el consultorio y le responderá.", "Yon koordonatè ap antann li ak kabinè a sou lè a epi l ap reponn ou."), L("Appointment", "Cita", "Randevou"))}
    ${record.providerDisplayName ? `<p class="appointment-provider">${escapeHtml(record.providerDisplayName)}</p>` : ""}
    <p class="appointment-status">${icon("clock")}<span>${escapeHtml(appointmentPatientStatus(record, state.language))}</span></p>
    <p class="appointment-note">${L("There is no time set yet. We will tell you as soon as there is one for you to review.", "Todavía no hay una hora. Le avisaremos en cuanto haya una para que la revise.", "Poko gen yon lè. N ap di w kou gen youn pou ou gade.")}</p>
    <div class="actions">
      <button type="button" class="button primary" data-action="appointment-open" data-appointment-id="${escapeHtml(record.id)}">${L("View this request", "Ver esta solicitud", "Gade demann sa a")}</button>
      <button type="button" class="button secondary" data-action="appointment-back">${L("Back to My Care", "Volver a Mi cuidado", "Retounen nan Swen mwen")}</button>
    </div>`;
}

// §23: when there is no channel at all, the honest answer is that there is no channel — followed
// by something the patient can actually do.
function appointmentNoChannelNotice(record) {
  return `${titleBlock(L("I can’t schedule this one directly", "No puedo agendar esta directamente", "Mwen pa ka fikse sa a dirèkteman"), L("This office doesn’t connect to ITERA for scheduling. I can put your care team on it so someone reaches out for you.", "Este consultorio no se conecta con ITERA para agendar. Puedo avisar a su equipo para que alguien se comunique por usted.", "Kabinè sa a pa konekte ak ITERA pou bay randevou. Mwen ka mete ekip swen ou sou li pou yon moun kontakte w."), L("Appointment", "Cita", "Randevou"))}
    ${record.providerDisplayName ? `<p class="appointment-provider">${escapeHtml(record.providerDisplayName)}</p>` : ""}
    <p class="appointment-status">${icon("alert")}<span>${L("Not scheduled", "Sin agendar", "Pa fikse")}</span></p>
    <div class="actions">
      <button type="button" class="button primary" data-action="appointment-ask-care-team" data-appointment-id="${escapeHtml(record.id)}">${L("Ask my care team to help", "Pedir ayuda a mi equipo", "Mande ekip swen mwen ede")}</button>
      <button type="button" class="button secondary" data-action="appointment-back">${L("Back to My Care", "Volver a Mi cuidado", "Retounen nan Swen mwen")}</button>
    </div>`;
}

// §82/§83: an appointment the patient already has is surfaced before a second one is created.
function appointmentDuplicateNotice(record, existing) {
  const confirmed = existing.status === APPOINTMENT_STATUS.CONFIRMED;
  return `${titleBlock(confirmed
      ? L("You already have an appointment", "Ya tiene una cita", "Ou deja gen yon randevou")
      : L("You already have a request waiting", "Ya tiene una solicitud en espera", "Ou deja gen yon demann k ap tann"),
    "", L("Appointment", "Cita", "Randevou"))}
    <p class="appointment-provider">${escapeHtml(existing.providerDisplayName || L("Your care team", "Su equipo de atención", "Ekip swen ou"))}</p>
    <p class="appointment-status">${icon(confirmed ? "check" : "clock")}<span>${escapeHtml(appointmentPatientStatus(existing, state.language))}</span></p>
    <div class="actions">
      <button type="button" class="button primary" data-action="appointment-open" data-appointment-id="${escapeHtml(existing.id)}">${confirmed ? L("View it", "Verla", "Gade l") : L("View the request", "Ver la solicitud", "Gade demann nan")}</button>
      <button type="button" class="button secondary" data-action="appointment-submit-request" data-need-id="${escapeHtml(record.id)}" data-force="1">${L("Request another one anyway", "Solicitar otra de todos modos", "Mande yon lòt kanmèm")}</button>
    </div>`;
}

// The reminder screen and the cancel confirmation live here rather than in appointmentViews.js
// because both are about what this product can actually promise: a reminder that only ever appears
// inside ITERA, and a cancellation that only ever happens after the patient says so out loud.
function appointmentReminderScreen(record) {
  const capability = appointmentReminderCapability(state.language);
  const slots = appointmentReminderSlotOptions(state.language);
  const chosen = record.reminder?.slot || "";
  return `${titleBlock(L("When should I remind you?", "¿Cuándo le recuerdo?", "Kilè pou m fè w sonje?"), "", L("Appointment", "Cita", "Randevou"))}
    <p class="appointment-note">${escapeHtml(capability.note)}</p>
    <div class="choice-list appointment-reminder-choices">
      ${slots.map(slot => `<button type="button" class="goal-response-button${chosen === slot.id ? " is-selected" : ""}" data-action="appointment-save-reminder" data-appointment-id="${escapeHtml(record.id)}" data-slot="${escapeHtml(slot.id)}">${icon("bell")}<span>${escapeHtml(slot.label)}</span></button>`).join("")}
    </div>
    <div class="actions"><button type="button" class="button secondary" data-action="appointment-open" data-appointment-id="${escapeHtml(record.id)}">${t().back}</button></div>`;
}

// §12 and §63: cancelling is destructive, so it takes a second, explicit yes on its own screen.
function appointmentCancelConfirmation(record) {
  return `${titleBlock(L("Cancel this appointment?", "¿Cancelar esta cita?", "Anile randevou sa a?"), L("We will let the office know. You can request another appointment whenever you need one.", "Avisaremos al consultorio. Puede solicitar otra cita cuando la necesite.", "N ap fè kabinè a konnen. Ou ka mande yon lòt randevou lè ou bezwen l."), L("Appointment", "Cita", "Randevou"))}
    <p class="appointment-provider">${escapeHtml(record.providerDisplayName || L("Your care team", "Su equipo de atención", "Ekip swen ou"))}</p>
    <p class="appointment-status">${escapeHtml(appointmentPatientStatus(record, state.language))}</p>
    <div class="actions">
      <button type="button" class="primary-button appointment-action" data-action="appointment-confirm-cancel" data-appointment-id="${escapeHtml(record.id)}">${L("Yes, cancel it", "Sí, cancelarla", "Wi, anile l")}</button>
      <button type="button" class="button secondary" data-action="appointment-open" data-appointment-id="${escapeHtml(record.id)}">${L("Keep my appointment", "Conservar mi cita", "Kenbe randevou mwen")}</button>
    </div>`;
}

function myAppointmentsScreen() {
  // Landing on an empty Upcoming tab when the only visit is in the past is a dead end — and a past
  // visit is exactly the one the after-visit question needs the patient to reach. Open on the first
  // tab that actually has something in it unless the patient picked one.
  const records = appointmentRecords();
  const now = new Date();
  const populated = ["UPCOMING", "REQUESTS", "PAST"].find(name => (
    name === "UPCOMING" ? upcomingAppointments(records, now).length
      : name === "REQUESTS" ? pendingRequests(records).length
      : pastAppointments(records, now).length
  ));
  const tab = state.appointmentFlow?.tab || populated || "UPCOMING";
  return appointmentsListScreen(appointmentViewProps({ appointments: records, tab }));
}

function appointmentDetailScreen() {
  const record = activeAppointment();
  if (!record) return myAppointmentsScreen();
  // §65: a visit whose time has passed and that nobody has asked about yet opens on the question,
  // not on a detail screen that pretends the visit is still ahead.
  const view = state.appointmentFlow?.view
    || (appointmentFollowUpDue(record, new Date()) ? "FOLLOW_UP" : "");
  const props = appointmentViewProps({ appointment: record });
  if (view === "PREP") return appointmentPrepView(props);
  if (view === "BRIEF") return appointmentBriefView(props);
  if (view === "BARRIER") return appointmentBarrierCheckView(appointmentViewProps({ appointment: record, preVisitCheck: preVisitCheckOptions({ appointment: record, locale: state.language }), barrierStates: appointmentBarrierStates(record) }));
  // A resolution in flight owns the screen. It is a view of the appointment, not a separate place:
  // the header, EMMI's anchor and the way back are all the ones the patient already had.
  if (view === "RESOLUTION") {
    const resolution = activeResolution();
    if (resolution && resolution.appointmentId === record.id) return barrierResolutionScreen(barrierResolutionProps(resolution));
  }
  // §8. Saying nothing is wrong is an answer, not a flow: one sentence and the way back.
  if (view === "ALL_SET") {
    return `<div class="appointment-screen barrier-screen">${titleBlock(L("Thanks for telling me", "Gracias por decírmelo", "Mèsi paske ou di m sa"), "", L("Appointment", "Cita", "Randevou"))}
      ${allSetConfirmation(appointmentViewProps({ appointment: record }))}
      ${appointmentReadinessPanel(appointmentViewProps({ readiness: appointmentReadinessFor(record) }))}</div>`;
  }
  if (view === "SHARE") {
    const sharing = appointmentCareCircle();
    return appointmentShareView(appointmentViewProps({ appointment: record, members: sharing.eligibleMembers, sharing, scope: appointmentShareScope(state.language) }));
  }
  if (view === "REMINDER") return appointmentReminderScreen(record);
  if (view === "CANCEL_CONFIRM") return appointmentCancelConfirmation(record);
  if (view === "FOLLOW_UP") return appointmentFollowUpView(appointmentViewProps({ appointment: record, step: state.appointmentFlow?.step || "ATTENDANCE" }));
  const notice = state.appointmentNotice
    ? `<p class="appointment-note" role="status">${escapeHtml(state.appointmentNotice)}</p>`
    : "";
  state.appointmentNotice = "";
  return notice + appointmentDetailView(appointmentViewProps({
    appointment: record,
    readinessPanel: appointmentReadinessPanel(appointmentViewProps({ readiness: appointmentReadinessFor(record) })),
    capability: appointmentCapability(record),
    patientStatus: appointmentPatientStatus(record, state.language),
    nextStep: appointmentNextStep(record, state.language),
    tone: appointmentStatusTone(record)
  }));
}

function appointmentSchedulingScreen() {
  const record = activeAppointment();
  if (!record) return myAppointmentsScreen();
  const flow = state.appointmentFlow || {};
  if (flow.step === "SLOTS") {
    // BUG 13: slots render in the order the source returned them, so sort by time or a later
    // slot can sit above an earlier one on the same day.
    const slots = [...(record.proposedTimes || [])].sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));
    return slotPickerView(appointmentViewProps({ appointment: record, slots, expanded: flow.expanded === true, error: flow.error || "" }));
  }
  if (flow.step === "REVIEW_SLOT") {
    const slot = (record.proposedTimes || []).find(item => item.slotId === flow.selectedSlotId);
    if (slot) return appointmentSlotReviewView(appointmentViewProps({ appointment: record, slot }));
  }
  if (flow.step === "BOOKED") return bookingConfirmationView(appointmentViewProps({ appointment: record }));
  if (flow.step === "REQUESTED") return requestConfirmationView(appointmentViewProps({ appointment: record }));
  if (flow.step === "COORDINATING") return appointmentCoordinationConfirmation(record);
  if (flow.step === "NO_CHANNEL") return appointmentNoChannelNotice(record);
  if (flow.step === "DUPLICATE") {
    const existing = appointmentById(flow.duplicateId || "");
    if (existing) return appointmentDuplicateNotice(record, existing);
  }
  // §30: what this office actually supports, never the vocabulary of everything that exists.
  const capability = appointmentCapability(record);
  return appointmentPreferenceView(appointmentViewProps({
    appointment: record,
    draft: state.appointmentDraft,
    step: flow.step || "PROVIDER",
    careTeam: patientCareTeam().map(member => ({ ...member, roleLabel: careTeamRoleLabel(member) })),
    capability,
    supportedModalities: capability.supportedModalities,
    submittable: draftIsSubmittable(state.appointmentDraft || createAppointmentDraft({ needId: record.id }))
  }));
}

const frequencyLabel = value => ({
  daily: L("Every day", "Todos los días", "Chak jou"),
  "few-days": L("A few days each week", "Algunos días por semana", "Kèk jou chak semèn"),
  "choose-days": L("Choose days", "Elegir días", "Chwazi jou"),
  "care-team-plan": L("Follow my care team’s plan", "Seguir el plan de mi equipo", "Swiv plan ekip swen mwen")
})[value] || L("As needed", "Según sea necesario", "Lè sa nesesè");

// The assigned goals become the patient's own records the moment they move past the screen that
// showed them. Without this My Goals is empty for an ACCESS patient — they were never asked to
// choose, so nothing ever created them — and the care plan would describe goals the rest of the
// product had never heard of. Idempotent: passing through twice adds nothing.
function ensureAssignedAccessGoals() {
  const now = new Date().toISOString();
  const existing = state.patientGoals || [];
  const added = assignedAccessGoals(state.offer)
    .filter(type => !existing.some(goal => goal.goalType === type && goal.status !== "REMOVED"))
    // selectedBy is PATHWAY, not PATIENT. The patient did not pick these and the record should not
    // claim they did.
    .map(type => ({ ...createPatientGoal({ type, patientId: state.offer?.patient?.id || "", now, goalSource: "PATHWAY" }), selectedBy: "PATHWAY" }));
  if (!added.length) return;
  state.patientGoals = [...existing, ...added];
  audit(state, "access_goals_assigned", "success", { goalTypes: added.map(goal => goal.goalType) });
}

function syncPatientGoalsFromDiscovery(selectedLegacy, customTitle = "") {
  const now = new Date().toISOString();
  const selectedTypes = selectedLegacy.map(value => LEGACY_GOAL_TYPES[value]).filter(Boolean);
  const existing = state.patientGoals || [];
  const next = selectedTypes.map(type => {
    const matched = existing.find(goal => goal.goalType === type && (type !== "CUSTOM" || goal.customTitle === customTitle.trim()));
    if (matched) return { ...matched, status: matched.status === "REMOVED" ? "ACTIVE" : matched.status, customTitle: type === "CUSTOM" ? customTitle.trim() : matched.customTitle, updatedAt: now };
    return createPatientGoal({ type, customTitle, patientId: state.offer?.patient?.id || "", now });
  });
  const selectedIds = new Set(next.map(goal => goal.id));
  const removed = existing.filter(goal => !selectedIds.has(goal.id)).map(goal => goal.status === "REMOVED" ? goal : ({ ...goal, status: "REMOVED", updatedAt: now }));
  state.patientGoals = [...next, ...removed];
  next.forEach(goal => {
    const previous = existing.find(item => item.id === goal.id);
    if (!previous) goalHistoryEvent(goal.id, "GOAL_SELECTED", { goalType: goal.goalType, goalSource: goal.goalSource, selectedBy: "PATIENT" });
    else if (previous.status === "REMOVED") goalHistoryEvent(goal.id, "GOAL_REACTIVATED");
  });
  removed.filter(goal => existing.find(item => item.id === goal.id)?.status !== "REMOVED").forEach(goal => goalHistoryEvent(goal.id, "GOAL_REMOVED"));
  state.careGoals = [...selectedLegacy];
  return next;
}

function goalDiscovery() {
  const selectedCount = state.careGoals.length;
  const ctaLabel = selectedCount > 1 ? L("Choose my priorities", "Elegir mis prioridades", "Chwazi priyorite mwen") : L("Continue", "Continuar", "Kontinye");
  const customGoal = activePatientGoals().find(goal => goal.goalType === "CUSTOM")?.customTitle || "";
  return `${art("goals")}${titleBlock(L("What matters most to you?", "¿Qué es lo más importante para usted?", "Ki sa ki pi enpòtan pou ou?"), L("Your care team identified goals that may support your care. Choose one or more that matter most to you.", "Su equipo de atención identificó metas que pueden apoyar su cuidado. Elija una o más que sean importantes para usted.", "Ekip swen ou idantifye objektif ki ka sipòte swen ou. Chwazi youn oswa plis ki pi enpòtan pou ou."), L("Care setup", "Configuración", "Konfigirasyon swen"))}<form id="care-goals-form"><div class="goal-list">${goalOptions().map(([value, label, type]) => goalCheck(value, label, state.careGoals.includes(value), type)).join("")}</div>${state.careGoals.includes("other") ? `<label class="field custom-goal-field">${L("What would you like to work toward?", "¿Qué le gustaría lograr?", "Ki sa ou ta renmen travay pou reyalize?")}<textarea name="customGoalTitle" rows="3" maxlength="180" placeholder="${L("Example: I want to attend my granddaughter’s graduation.", "Ejemplo: Quiero asistir a la graduación de mi nieta.", "Egzanp: Mwen vle ale nan gradyasyon pitit pitit fi mwen.")}">${escapeHtml(customGoal)}</textarea><small>${L("A goal you add will be shared with your care team for review.", "La meta que agregue se compartirá con su equipo de atención para que la revise.", "N ap pataje objektif ou ajoute a ak ekip swen ou pou yo revize li.")}</small></label>` : ""}<label class="field goals-note-field">${L("Anything else you’d like your care team to know?", "¿Hay algo más que quiera que sepa su equipo de atención?", "Èske gen lòt bagay ou ta renmen ekip swen ou konnen?")}<textarea name="careGoalsNote" rows="3" maxlength="300" placeholder="${L("Optional", "Opcional", "Opsyonèl")}">${escapeHtml(state.careGoalsNote || "")}</textarea></label></form><p class="form-error" role="alert">${state.error || ""}</p><div class="actions">${cta(t().back, "back", true)}${cta(ctaLabel, "goals-discovery-continue", false, !selectedCount)}</div>`;
}

function goalPriorities() {
  const goals = activePatientGoals();
  const primaryId = state.goalPrimaryId || goals[0]?.id || "";
  return `${titleBlock(L("Which of these matters most to you right now?", "¿Cuál de estas metas le importa más en este momento?", "Kilès nan objektif sa yo ki pi enpòtan pou ou kounye a?"), L("Choose one or two goals you’d like to focus on first.", "Elija una o dos metas en las que le gustaría enfocarse primero.", "Chwazi youn oswa de objektif ou ta renmen konsantre sou an premye."), L("My priorities", "Mis prioridades", "Priyorite mwen"))}<form id="goal-priority-form" class="goal-priority-form"><fieldset><legend>${L("Primary priority", "Prioridad principal", "Premye priyorite")}</legend><div class="choice-list">${goals.map(goal => `<label class="choice-card compact-choice"><input type="radio" name="primaryGoal" value="${goal.id}" ${goal.id === primaryId ? "checked" : ""}><span class="choice-dot"></span>${goalIcon(goal)}<span><strong>${escapeHtml(goalDisplayName(goal, state.language))}</strong></span></label>`).join("")}</div></fieldset><fieldset><legend>${L("Secondary priority (optional)", "Prioridad secundaria (opcional)", "Dezyèm priyorite (opsyonèl)")}</legend><div class="choice-list"><label class="choice-card compact-choice"><input type="radio" name="secondaryGoal" value="" ${!state.goalSecondaryId ? "checked" : ""}><span class="choice-dot"></span>${icon("check")}<span><strong>${L("No second priority", "Sin segunda prioridad", "Pa gen dezyèm priyorite")}</strong></span></label>${goals.map(goal => { const isPrimary = goal.id === primaryId; return `<label class="choice-card compact-choice ${isPrimary ? "is-unavailable" : ""}"><input type="radio" name="secondaryGoal" value="${goal.id}" ${goal.id === state.goalSecondaryId ? "checked" : ""} ${isPrimary ? "disabled" : ""}><span class="choice-dot"></span>${goalIcon(goal)}<span><strong>${escapeHtml(goalDisplayName(goal, state.language))}</strong>${isPrimary ? `<small>${L("Already selected as your primary priority", "Ya es su prioridad principal", "Ou deja chwazi l kòm premye priyorite ou")}</small>` : ""}</span></label>`; }).join("")}</div></fieldset></form><p class="form-error" role="alert">${state.error || ""}</p><div class="actions">${cta(t().back, "goals-flow-back", true)}${cta(L("Continue", "Continuar", "Kontinye"), "goals-priority-continue")}</div>`;
}

function goalPlanOffer() {
  const goal = patientGoalById(state.goalPlanningGoalId || state.goalPrimaryId);
  if (!goal) { state.goalFlowStep = "DISCOVERY"; return goalDiscovery(); }
  return `${art("goals")}${titleBlock(L("Let’s personalize your plan for this goal", "Personalicemos su plan para esta meta", "Ann pèsonalize plan ou pou objektif sa a"), L("Choose how you would like to work on this goal. Your care team can help adjust the plan whenever you need.", "Elija cómo le gustaría trabajar en esta meta. Su equipo de atención puede ayudarle a ajustar el plan cuando lo necesite.", "Chwazi kijan ou ta renmen travay sou objektif sa a. Ekip swen ou ka ede ajiste plan an lè ou bezwen."), L("My goal", "Mi meta", "Objektif mwen"))}<section class="goal-selected-card">${goalIcon(goal)}<div><small>${L("Selected goal", "Meta seleccionada", "Objektif ou chwazi")}</small><strong>${escapeHtml(goalDisplayName(goal, state.language))}</strong></div></section><aside class="note goal-plan-note">${icon("goals")}<p>${L("A few simple steps can help you work on what is important to you.", "Unos pasos sencillos pueden ayudarle a trabajar en lo que es importante para usted.", "Kèk etap senp ka ede w travay sou sa ki enpòtan pou ou.")}</p></aside><div class="stacked-actions goal-plan-choice">${cta(L("Personalize my plan", "Personalizar mi plan", "Pèsonalize plan mwen"), "goal-plan-now")}${cta(L("I’ll do this with my care team later", "Lo haré después con mi equipo de atención", "M ap fè sa pita ak ekip swen mwen"), "goal-plan-later", true)}</div>`;
}

function goalPlanBuilder() {
  const goal = patientGoalById(state.goalPlanningGoalId);
  const suggestions = suggestedActionsFor(goal?.goalType);
  const draft = state.goalPlanDraft || { actionIds: [], customAction: "", frequency: "few-days", remindersEnabled: false, whyItMatters: "" };
  return `${titleBlock(L("What steps would you like to include?", "¿Qué pasos le gustaría incluir?", "Ki etap ou ta renmen mete ladan l?"), L("Choose the ones that feel realistic. You can change this later.", "Seleccione los que le parezcan realistas. Puede cambiarlos más adelante.", "Chwazi sa ki sanble reyalis pou ou. Ou ka chanje yo pita."), L("My goal", "Mi meta", "Objektif mwen"))}<section class="goal-selected-card compact">${goalIcon(goal)}<div><small>${L("Selected goal", "Meta seleccionada", "Objektif ou chwazi")}</small><strong>${escapeHtml(goalDisplayName(goal, state.language))}</strong></div></section><form id="goal-plan-form" class="goal-plan-form"><fieldset><legend>${L("Steps that fit your routine", "Pasos que se adapten a su rutina", "Etap ki mache ak woutin ou")}</legend><div class="goal-action-options">${suggestions.map(action => check("goalAction", localGoalText(action.title, state.language), draft.actionIds.includes(action.id), action.id)).join("")}</div></fieldset><label class="field">${L("Add my own step", "Agregar mi propio paso", "Ajoute pwòp etap pa mwen")}<input name="customAction" maxlength="160" value="${escapeHtml(draft.customAction || "")}" placeholder="${L("Example: Walk with my daughter after dinner.", "Ejemplo: Caminar con mi hija después de cenar.", "Egzanp: Mache ak pitit fi mwen apre dine.")}"></label><label class="field">${L("Why this matters to me (optional)", "Por qué esto es importante para mí (opcional)", "Poukisa sa enpòtan pou mwen (opsyonèl)")}<textarea name="whyItMatters" rows="3" maxlength="300">${escapeHtml(draft.whyItMatters || goal?.whyItMatters || "")}</textarea></label><fieldset><legend>${L("How often would feel realistic?", "¿Con qué frecuencia sería realista?", "Konbyen fwa ki ta reyalis?")}</legend><div class="preference-time-grid">${["daily", "few-days", "choose-days", "care-team-plan"].map(value => `<label><input type="radio" name="goalFrequency" value="${value}" ${draft.frequency === value ? "checked" : ""}><span>${frequencyLabel(value)}</span></label>`).join("")}</div></fieldset>${check("goalReminders", L("Reminders would help me", "Los recordatorios me ayudarían", "Rapèl ta ede mwen"), draft.remindersEnabled)}<p class="goal-plan-team-note">${L("Your care team can help you adjust these steps.", "Su equipo de atención puede ayudarle a ajustar estos pasos.", "Ekip swen ou ka ede w ajiste etap sa yo.")}</p></form><p class="form-error" role="alert">${state.error || ""}</p><div class="actions">${cta(t().back, "goals-flow-back", true)}${cta(L("Review my plan", "Revisar mi plan", "Revize plan mwen"), "goal-plan-review")}</div>`;
}

function goalPlanReview() {
  const goal = patientGoalById(state.goalPlanningGoalId);
  const draft = state.goalPlanDraft;
  const suggestions = suggestedActionsFor(goal?.goalType);
  const selected = suggestions.filter(action => draft.actionIds.includes(action.id));
  // Each chosen step becomes a scannable row with its own icon rather than a bullet in a list.
  const rows = [
    ...selected.map(action => ({
      icon: goalActionIcon(action.id),
      title: localGoalText(action.title, state.language),
      meta: action.frequency ? frequencyLabel(draft.frequency) : ""
    })),
    ...(draft.customAction ? [{ icon: "goals", title: draft.customAction, meta: "" }] : [])
  ];
  return `${titleBlock(L("Review your personalized plan", "Revise su plan personalizado", "Revize plan pèsonalize ou"), L("Look it over before saving. You can change it later.", "Revíselo antes de guardarlo. Puede cambiarlo más adelante.", "Gade l anvan ou sove l. Ou ka chanje l pita."), L("My plan", "Mi plan", "Plan mwen"))}
    <section class="care-plan-card">
      <div class="care-plan-goal">${goalIcon(goal, "care-plan-goal-icon")}<div><span class="care-plan-eyebrow">${L("My goal", "Mi meta", "Objektif mwen")}</span><strong>${escapeHtml(goalDisplayName(goal, state.language))}</strong></div></div>
      ${draft.whyItMatters ? `<p class="care-plan-why">${icon("heart")}<span>${escapeHtml(draft.whyItMatters)}</span></p>` : ""}
      <h2 class="care-plan-heading">${L("What I’m going to do", "Lo que voy a hacer", "Sa m pral fè")}</h2>
      <ul class="care-plan-actions">${rows.map(row => `<li class="care-plan-action">${icon(row.icon)}<div><strong>${escapeHtml(row.title)}</strong>${row.meta ? `<small>${escapeHtml(row.meta)}</small>` : ""}</div></li>`).join("")}</ul>
      <div class="care-plan-meta">
        <p>${icon("calendar")}<span><small>${L("Frequency", "Frecuencia", "Frekans")}</small><strong>${frequencyLabel(draft.frequency)}</strong></span></p>
        <p>${icon("bell")}<span><small>${L("Reminders", "Recordatorios", "Rapèl")}</small><strong>${draft.remindersEnabled ? L("On", "Activados", "Limen") : L("Off", "Desactivados", "Etenn")}</strong></span></p>
      </div>
    </section>
    <p class="care-plan-reassurance">${L("You can change this plan later.", "Puede cambiar este plan más adelante.", "Ou ka chanje plan sa a pita.")}</p>
    <div class="goal-stacked-actions">${cta(L("Save my plan", "Guardar mi plan", "Sove plan mwen"), "goal-plan-save")}${cta(L("Edit my plan", "Editar mi plan", "Modifye plan mwen"), "goal-plan-change", true)}</div>`;
}

// What the patient's record can actually say about where they are starting.
//
// Two sources, in one order that never changes. A baseline captured in this journey supersedes the
// one the record arrived with, because three verified readings taken today are a newer measurement
// of the same thing — not a second opinion to be averaged with the first. Everything else falls
// back to the observations the care team already confirmed, and a record with neither says PENDING
// rather than borrowing a number from somewhere else.
//
// The shape is keyed by goal type because that is what the starting-point resolver reads. The
// patient record is keyed clinically, and translating between the two here is what keeps a goal
// vocabulary out of a record that is just a blood pressure and a weight.
function careActivationRuntime() {
  const observations = state.offer?.patient?.baselineObservations || {};
  const captured = state.bpBaseline;
  const capturedBloodPressure = state.bpBaselineStatus === "COMPLETED" && captured?.sourceVerified
    ? { status: "CONFIRMED", systolic: captured.averageSystolic, diastolic: captured.averageDiastolic, recordedAt: captured.completedAt, source: "VERIFIED_DEVICE" }
    : null;
  return {
    BLOOD_PRESSURE_CONTROL: capturedBloodPressure || observations.bloodPressure || { status: "PENDING" },
    WEIGHT_MANAGEMENT: observations.weight || { status: "PENDING" }
  };
}

const accessGoalSupportCopy = goalType => ({
  BLOOD_PRESSURE_CONTROL: L("Check your blood pressure, stay on top of your medications, and work toward better blood pressure control.", "Revise su presión arterial, mantenga sus medicamentos al día y avance hacia un mejor control de la presión.", "Tcheke tansyon ou, kenbe medikaman ou yo ajou, epi travay pou pi bon kontwòl tansyon."),
  WEIGHT_MANAGEMENT: L("Work toward a healthy weight through monitoring, nutrition, activity, and ongoing support.", "Avance hacia un peso saludable con seguimiento, nutrición, actividad y apoyo continuo.", "Travay pou yon pwa ki an sante ak swivi, nitrisyon, aktivite ak sipò kontinyèl.")
})[goalType] || "";

// Two named rows, never one "target". The control threshold belongs to the program and is always
// shown; the improvement milestone is arithmetic on this patient's own baseline, so before a
// baseline exists it is described in words rather than given a number it cannot have yet.
//
// Every number below is read from the resolved measure or from the outcome definition. Nothing here
// writes 130, 15, 30, 5 or a milestone of its own: a threshold typed into a view is a second source
// of truth that goes on rendering last quarter's rule after the program has changed it.
//
// A row is [label, value, note]. The note is what makes the milestone honest at a glance: "137 mmHg
// or lower" on its own reads like a clinical target, and "15 mmHg below your starting systolic blood
// pressure" underneath it is the sentence that says where the number came from.
function accessMeasureRows(goalType, measure) {
  const controlLabel = L("Control target", "Meta de control", "Objektif kontwòl");
  const milestoneLabel = L("ACCESS improvement milestone", "Hito de mejora de ACCESS", "Etap amelyorasyon ACCESS");
  const milestone = measure.improvementMilestone;
  const improvement = ACCESS_OUTCOME_TARGETS[goalType].improvement.value;
  if (goalType === "BLOOD_PRESSURE_CONTROL") {
    const belowStarting = L(`${improvement} mmHg below your starting systolic blood pressure.`, `${improvement} mmHg por debajo de su presión sistólica inicial.`, `${improvement} mmHg anba tansyon sistolik ou nan konmansman an.`);
    return [
      [controlLabel, L(`Below ${measure.control.value} mmHg systolic`, `Menos de ${measure.control.value} mmHg sistólica`, `Anba ${measure.control.value} mmHg sistolik`)],
      milestone
        ? [milestoneLabel, L(`${milestone.value} mmHg or lower`, `${milestone.value} mmHg o menos`, `${milestone.value} mmHg oswa mwens`), belowStarting]
        : [milestoneLabel, L(`At least ${improvement} mmHg below your starting systolic blood pressure`, `Al menos ${improvement} mmHg por debajo de su presión sistólica inicial`, `Omwen ${improvement} mmHg anba tansyon sistolik ou nan konmansman an`)]
    ];
  }
  const belowStartingWeight = L(`At least ${improvement}% below your starting weight.`, `Al menos ${improvement}% por debajo de su peso inicial.`, `Omwen ${improvement}% pi ba pase pwa ou nan konmansman an.`);
  return [
    [controlLabel, L(`BMI below ${measure.control.value}, without gaining significant weight`, `IMC menor de ${measure.control.value}, sin aumentar de peso de forma significativa`, `BMI anba ${measure.control.value}, san pran anpil pwa`)],
    milestone
      ? [milestoneLabel, L(`${milestone.value} lb or lower`, `${milestone.value} lb o menos`, `${milestone.value} lb oswa mwens`), belowStartingWeight]
      : [milestoneLabel, L(`At least ${improvement}% below your starting weight`, `Al menos ${improvement}% por debajo de su peso inicial`, `Omwen ${improvement}% pi ba pase pwa ou nan konmansman an`)]
  ];
}

const accessMeasureMarkup = (goalType, measure) => `<dl>${accessMeasureRows(goalType, measure)
  .map(([label, value, note]) => `<div><dt>${label}</dt><dd>${value}${note ? `<small>${note}</small>` : ""}</dd></div>`).join("")}</dl>`;

// BMI carries one decimal in every clinical record the patient will ever be shown, so a baseline of
// 31 reads as 31.0 rather than as an integer that looks like a different measurement.
const formatBmi = value => Number(value).toFixed(1);

// A confirmed baseline says so. "152 / 88 mmHg" with nothing under it leaves the patient guessing
// whether that is today's reading, a target, or something still being worked out; the line beneath
// it is the difference between a number on a screen and a fact about their care.
function accessStartingPointBody(goalType, point) {
  if (point.status === "CONFIRMED") {
    const confirmed = `<p class="access-goal-confirmed">${icon("check")}<span>${L("Baseline confirmed", "Línea base confirmada", "Pwen depa konfime")}</span></p>`;
    if (goalType === "BLOOD_PRESSURE_CONTROL") {
      // A systolic on its own is still a baseline, so it keeps the label that says which number it
      // is instead of being rendered as half of a pair the record does not hold.
      const value = point.diastolic
        ? `${point.value} / ${point.diastolic} <span>mmHg</span>`
        : `${point.value} mmHg <span>${L("starting systolic", "sistólica inicial", "sistolik nan konmansman")}</span>`;
      return `<p class="access-goal-value">${value}</p>${confirmed}`;
    }
    // Weight and BMI are two readings of the same confirmed baseline, so they sit on one row as
    // peers. Stacked, the BMI read as a footnote to the weight and cost the card a whole line for
    // one short number. Weight stays first in the source, which is the order it is read in whether
    // the row holds both or wraps them.
    const bmi = point.bmi ? `<p class="access-goal-detail"><span>${L("BMI", "IMC", "BMI")}</span> ${formatBmi(point.bmi)}</p>` : "";
    return `<div class="access-goal-metrics"><p class="access-goal-value">${point.value} <span>lb</span></p>${bmi}</div>${confirmed}`;
  }
  const pending = goalType === "BLOOD_PRESSURE_CONTROL"
    ? L("We’ll confirm your starting blood pressure as part of setting up your care.", "Confirmaremos su presión arterial inicial como parte de la configuración de su cuidado.", "N ap konfime tansyon ou nan konmansman an antan n ap mete swen ou anplas.")
    : L("We’ll confirm your starting weight to personalize this goal.", "Confirmaremos su peso inicial para personalizar esta meta.", "N ap konfime pwa ou nan konmansman an pou pèsonalize objektif sa a.");
  return `<p class="access-goal-pending">${L("To be confirmed", "Por confirmar", "Pou konfime")}</p><p class="access-goal-pending-note">${pending}</p>`;
}

// No checkboxes, no selection, no percentages. The patient is being shown the care they already
// have, so the only decision on this screen is whether to carry on to personalizing it.
function accessAssignedGoals() {
  const runtime = careActivationRuntime();
  const cards = assignedAccessGoals(state.offer).map(goalType => {
    const point = patientStartingPoint(goalType, runtime);
    const measure = accessProgressMeasure(goalType, point);
    const rows = accessMeasureMarkup(goalType, measure);
    const actionItems = suggestedActionsFor(goalType).slice(0, goalType === "BLOOD_PRESSURE_CONTROL" ? 3 : 4)
      .map(action => `<li>${icon(goalActionIcon(action.id))}<span>${escapeHtml(localGoalText(action.title, state.language))}</span></li>`).join("");
    // Summary first, detail on request. Two goals with four sections each is a wall of text at
    // 384px, and the patient's own question — what is this goal and where am I starting — gets
    // buried under the program's measurement rules. So the card answers that much and keeps the
    // thresholds and the action list one tap away. <details> because the browser already makes it
    // keyboard operable and announces its state; a div and a click handler would not.
    // The summary names both halves, so the measure block does not label itself again underneath it:
    // opening the disclosure lands the patient on the targets themselves. The plan keeps its heading,
    // because that one marks where the numbers stop and what we will do about them starts.
    return `<article class="access-goal-card">
      <header>${icon(resolveGoalIcon({ goalType }))}<h3>${escapeHtml(localGoalText(GOAL_CONFIG[goalType].displayName, state.language))}</h3></header>
      <p class="access-goal-support">${accessGoalSupportCopy(goalType)}</p>
      <section class="access-goal-baseline"><h4>${L("Your starting point", "Su punto de partida", "Pwen depa ou")}</h4>${accessStartingPointBody(goalType, point)}</section>
      <details class="access-goal-details">
        <summary>${L("How ACCESS measures progress, and how we’ll work on it", "Cómo ACCESS mide su progreso y cómo trabajaremos en esto", "Kijan ACCESS mezire pwogrè, ak kijan n ap travay sou li")}${icon("chevronRight")}</summary>
        <section class="access-goal-measure">${rows}</section>
        <section class="access-goal-plan"><h4>${L("How we’ll work on it", "Cómo trabajaremos en esto", "Kijan n ap travay sou li")}</h4><ul>${actionItems}</ul></section>
      </details>
    </article>`;
  }).join("");
  return `${titleBlock(L("Your ACCESS health goals", "Sus objetivos de salud de ACCESS", "Objektif sante ACCESS ou yo"), L("These goals are part of your ACCESS care. We’ll track your progress and personalize the support you receive along the way.", "Estos objetivos forman parte de su cuidado ACCESS. Seguiremos su progreso y personalizaremos el apoyo que recibe en el camino.", "Objektif sa yo fè pati swen ACCESS ou. N ap swiv pwogrè ou epi pèsonalize sipò ou resevwa sou wout la."), L("Your ACCESS care", "Su cuidado ACCESS", "Swen ACCESS ou"))}<div class="access-goal-list">${cards}</div>${actions(L("Tell us what could make this harder", "Cuéntenos qué podría dificultarlo", "Di nou sa ki ka fè sa pi difisil"))}`;
}

function goals() {
  // An ACCESS patient does not pick their goals: the track assigned them. The chooser below is
  // still the right screen for every other program, which does ask.
  if (state.offer?.pathway === "ACCESS") return accessAssignedGoals();
  if (state.goalFlowStep === "PRIORITY") return goalPriorities();
  if (state.goalFlowStep === "PLAN_OFFER") return goalPlanOffer();
  if (state.goalFlowStep === "PLAN_ACTIONS") return goalPlanBuilder();
  if (state.goalFlowStep === "PLAN_REVIEW") return goalPlanReview();
  return goalDiscovery();
}

const goalMetricCopy = (id, count) => ({
  readings: L(`${count} readings received`, `${count} lecturas recibidas`, `${count} lekti resevwa`),
  medicationCheckIns: L(`${count} medication check-ins`, `${count} registros de medicamentos`, `${count} tcheke medikaman`),
  activeDays: L(`${count} active days`, `${count} días activos`, `${count} jou aktif`),
  topicsLearned: L(`${count} topics learned`, `${count} temas aprendidos`, `${count} sijè aprann`)
})[id] || "";

const goalStatusCopy = goal => {
  if (goal.status === "ACHIEVED") return L("Goal reached", "Meta alcanzada", "Objektif reyalize");
  if (goal.status === "PAUSED") return L("Paused", "En pausa", "An poz");
  if (goalIsReadyToPersonalize(goal)) return L("Ready when you are", "Listo cuando usted quiera", "Pare lè ou pare");
  return L("In progress", "En curso", "Ap avanse");
};

const goalStatusIcon = goal => {
  if (goal.status === "ACHIEVED") return "check";
  if (goal.status === "PAUSED") return "clock";
  return goalIsReadyToPersonalize(goal) ? "clock" : "check";
};

const goalNextStepCopy = key => ({
  CONFIRM_BARRIER: L("Answer EMMI’s question about this goal", "Responda la pregunta de EMMI sobre esta meta", "Reponn kesyon EMMI sou objektif sa a"),
  RESOLVE_BARRIER: L("Get help with what’s making this hard", "Reciba ayuda con lo que se lo dificulta", "Jwenn èd ak sa ki fè sa difisil"),
  FINISH_PLAN: L("Finish personalizing your plan", "Termine de personalizar su plan", "Fini pèsonalize plan ou"),
  TAKE_READING: L("Take your next blood pressure reading", "Tome su próxima lectura de presión arterial", "Pran pwochen lekti tansyon ou"),
  UNDERSTAND_READING: L("Understand your latest blood pressure reading", "Entienda su lectura más reciente de presión arterial", "Konprann dènye lekti tansyon ou"),
  REVIEW_TREND: L("Review your 7-day trend", "Revise su tendencia de 7 días", "Gade tandans 7 jou ou"),
  LEARN_NUMBERS: L("Learn what your blood pressure numbers mean", "Aprenda qué significan sus números de presión", "Aprann sa chif tansyon ou vle di"),
  CHECK_IN: L("Tell us how this goal is going", "Cuéntenos cómo va esta meta", "Di nou kijan objektif sa a ap mache")
})[key] || "";

// Blood pressure is the one goal with live runtime data behind it, so it is the one goal whose
// progress and next step can be specific. Everything else answers from its own plan.
const goalRuntimeFor = goal => (goal.goalType === "BLOOD_PRESSURE_CONTROL" ? bloodPressureGoalRuntime(goal) : null);

const goalEducationPending = goal => Boolean(nextBestGoalEducation({
  goalType: goal.goalType,
  completedTopicIds: (goal.educationHistory || []).filter(item => item.status === "COMPLETED").map(item => item.topicId)
}));

// A difficulty the patient is waiting on outranks the care plan: telling someone to review a
// trend while their monitor is broken is advice they cannot take.
const goalNextStep = goal => {
  const next = goalNextBestAction(goal, { runtime: goalRuntimeFor(goal), educationPending: goalEducationPending(goal), barriers: goalBarriers(goal) });
  return next.key === "COMPLETE_ACTION" ? next.title || "" : goalNextStepCopy(next.key);
};

// One line on the card, and only when something is actually active. A goal is not covered in
// warnings, and the line names the difficulty rather than counting failures.
const goalNeedsHelpLine = goal => {
  const active = activeGoalBarriers(goal);
  if (!active.length) return "";
  const label = active.length === 1
    ? barrierPatientSummary(active[0], state.language)
    : L(`${active.length} things we’re helping with`, `${active.length} cosas en las que le ayudamos`, `${active.length} bagay n ap ede w avèk yo`);
  return `<div class="goal-summary-block goal-summary-help"><span class="goal-summary-label">${L("Needs help", "Necesita ayuda", "Bezwen èd")}</span><p class="goal-summary-value">${escapeHtml(label)}</p></div>`;
};

// Progress is only ever what the goal actually measured. A goal with no plan yet says so instead
// of reporting zero of something the patient never agreed to.
function goalProgressMarkup(goal) {
  const summary = goalProgressSummary(goal, { runtime: goalRuntimeFor(goal) });
  if (summary.kind === "READY") return "";
  if (summary.kind === "METRICS") {
    const trend = summary.trendDirection && summary.trendDirection !== "INSUFFICIENT_DATA" ? bpTrendShortCopy(summary.trendDirection) : "";
    return `<div class="goal-summary-block">
      <span class="goal-summary-label">${L("This week", "Esta semana", "Semèn sa a")}</span>
      <ul class="goal-metric-list">${summary.metrics.map(metric => `<li>${icon("check")}<span>${goalMetricCopy(metric.id, metric.count)}</span></li>`).join("")}</ul>
      ${trend ? `<p class="goal-metric-trend">${trend}</p>` : ""}
    </div>`;
  }
  const copy = summary.kind === "PATIENT_REPORTED"
    ? ({ GOING_WELL: L("Going well", "Va bien", "Sa ap mache byen"), DIFFICULTY: L("Having some difficulty", "Con algunas dificultades", "Gen kèk difikilte"), NOT_STARTED: L("Not started yet", "Aún no comenzada", "Poko kòmanse") }[summary.status] || "")
    : L("No progress recorded yet", "Aún no hay progreso registrado", "Poko gen pwogrè anrejistre");
  return `<div class="goal-summary-block"><span class="goal-summary-label">${L("This week", "Esta semana", "Semèn sa a")}</span><p class="goal-summary-value">${copy}</p></div>`;
}

const bpTrendShortCopy = direction => ({
  STABLE: L("Stable trend", "Tendencia estable", "Tandans estab"),
  TRENDING_UP: L("Trending higher", "Tendencia más alta", "Tandans monte"),
  TRENDING_DOWN: L("Trending lower", "Tendencia más baja", "Tandans desann")
})[direction] || "";

const goalCardCta = goal => (goalIsReadyToPersonalize(goal)
  ? { label: L("Personalize my plan", "Personalizar mi plan", "Pèsonalize plan mwen"), action: "view-goal" }
  : { label: L("View my goal", "Ver mi meta", "Gade objektif mwen"), action: "view-goal" });

// The number this goal is being measured from, on the screen the patient comes back to weeks later.
// One line and no more: the card says where they started, not how ACCESS measures it — the control
// target and the milestone are one tap away inside the goal, where there is room to keep them apart.
//
// A pending baseline renders nothing rather than a placeholder. "To be confirmed" belongs on the
// activation screens, which are explaining what will happen; on a card it would be a row of nothing
// sitting where a fact goes.
function goalStartingPointLine(goal) {
  if (!goal || !isAssignedAccessGoal(state.offer, goal.goalType)) return "";
  const point = patientStartingPoint(goal.goalType, careActivationRuntime());
  if (point.status !== "CONFIRMED") return "";
  const value = goal.goalType === "BLOOD_PRESSURE_CONTROL"
    ? `${point.value}${point.diastolic ? ` / ${point.diastolic}` : ""} mmHg`
    : `${point.value} lb${point.bmi ? ` · ${L("BMI", "IMC", "BMI")} ${formatBmi(point.bmi)}` : ""}`;
  return `<div class="goal-summary-block goal-summary-baseline"><span class="goal-summary-label">${L("Starting point", "Punto de partida", "Pwen depa")}</span><p class="goal-summary-value">${value}</p></div>`;
}

// The primary goal gets the fuller treatment: progress, the next step and a lead action. Other
// goals stay deliberately lighter, so the patient's own priority is the thing that stands out.
function primaryGoalCard(goal) {
  const nextStep = goalNextStep(goal);
  const ctaAction = goalCardCta(goal);
  return `<article class="goal-card goal-card-primary" data-goal-status="${goal.status}" data-goal-id="${goal.id}" data-scroll-anchor="goal-card-${goal.id}" aria-labelledby="goal-title-${goal.id}">
    <div class="goal-card-head">${goalIcon(goal, "goal-card-icon")}<h3 class="goal-card-title" id="goal-title-${goal.id}">${escapeHtml(goalDisplayName(goal, state.language))}</h3></div>
    ${goalStartingPointLine(goal)}
    ${goalProgressMarkup(goal)}
    ${goalNeedsHelpLine(goal)}
    ${nextStep ? `<div class="goal-summary-block"><span class="goal-summary-label">${L("Next step", "Próximo paso", "Pwochen etap")}</span><p class="goal-summary-value">${escapeHtml(nextStep)}</p></div>` : ""}
    <button type="button" class="goal-card-cta" data-action="${ctaAction.action}" data-goal-id="${goal.id}"><span>${ctaAction.label}</span>${icon("arrowRight")}</button>
  </article>`;
}

function secondaryGoalCard(goal) {
  const ctaAction = goalCardCta(goal);
  const ready = goalIsReadyToPersonalize(goal);
  return `<article class="goal-card" data-goal-status="${goal.status}" data-goal-id="${goal.id}" data-scroll-anchor="goal-card-${goal.id}" aria-labelledby="goal-title-${goal.id}">
    <div class="goal-card-head">${goalIcon(goal, "goal-card-icon")}<h3 class="goal-card-title" id="goal-title-${goal.id}">${escapeHtml(goalDisplayName(goal, state.language))}</h3></div>
    <p class="goal-card-status">${icon(goalStatusIcon(goal))}<span>${goalStatusCopy(goal)}</span></p>
    ${goalStartingPointLine(goal)}
    <p class="goal-card-support">${ready
      ? L("Personalize how you’d like to work on this goal.", "Personalice cómo le gustaría trabajar en esta meta.", "Pèsonalize kijan ou ta renmen travay sou objektif sa a.")
      : escapeHtml(goalNextStep(goal))}</p>
    <button type="button" class="goal-card-cta" data-action="${ctaAction.action}" data-goal-id="${goal.id}"><span>${ctaAction.label}</span>${icon("arrowRight")}</button>
  </article>`;
}

function myGoalsDashboard() {
  const goals = sortGoalsForPatient(activePatientGoals());
  if (!goals.length) {
    return `${titleBlock(L("My Goals", "Mis metas", "Objektif mwen"), L("See what you’re working toward and what comes next.", "Vea en qué está trabajando y qué sigue.", "Gade sa w ap travay pou li ak sa k ap vini."))}
      <section class="goals-empty">${icon("goals", "goals-empty-icon")}<h2>${L("Your goals will appear here", "Sus metas aparecerán aquí", "Objektif ou yo ap parèt isit la")}</h2><p>${L("Choose a goal that matters to you and we’ll help you work toward it.", "Elija una meta que le importe y le ayudaremos a trabajar en ella.", "Chwazi yon objektif ki enpòtan pou ou epi n ap ede w travay sou li.")}</p></section>
      ${addGoalCard()}
      ${backToCareAction()}`;
  }
  const primary = goals.find(goal => goal.priority === "PRIMARY") || goals[0];
  const others = goals.filter(goal => goal.id !== primary.id);
  return `${titleBlock(L("My Goals", "Mis metas", "Objektif mwen"), L("See what you’re working toward and what comes next.", "Vea en qué está trabajando y qué sigue.", "Gade sa w ap travay pou li ak sa k ap vini."))}
    ${state.goalNotice ? `<p class="goal-notice" role="status">${escapeHtml(state.goalNotice)}</p>` : ""}
    <section class="goal-group" aria-labelledby="goal-group-priority">
      <h2 class="goal-group-heading" id="goal-group-priority">${L("My priority", "Mi prioridad", "Priyorite mwen")}</h2>
      ${primaryGoalCard(primary)}
    </section>
    ${others.length ? `<section class="goal-group" aria-labelledby="goal-group-other">
      <h2 class="goal-group-heading" id="goal-group-other">${L("Other goals", "Otras metas", "Lòt objektif")}</h2>
      ${others.map(secondaryGoalCard).join("")}
    </section>` : ""}
    ${addGoalCard()}
    ${backToCareAction()}`;
}

const addGoalCard = () => `<button type="button" class="add-goal-action" data-action="add-another-goal">
  <span class="add-goal-mark" aria-hidden="true">+</span>
  <span class="add-goal-copy"><strong>${L("Add another goal", "Agregar otra meta", "Ajoute yon lòt objektif")}</strong><small>${L("Choose another goal you’d like to work toward.", "Elija otra meta en la que le gustaría trabajar.", "Chwazi yon lòt objektif ou ta renmen travay sou li.")}</small></span>
</button>`;

const backToCareAction = () => `<div class="goal-back-actions"><button type="button" class="button secondary goal-back-to-care" data-action="back">${icon("arrowLeft")}<span>${L("Back to My Care", "Volver a Mi cuidado", "Retounen nan Swen mwen")}</span></button></div>`;

const goalHealthLocale = () => ({ en: "en-US", es: "es-US", ht: "ht-HT" }[state.language] || "en-US");

// Whether this patient's record holds a monitor at all — assigned by ITERA, confirmed as their own,
// or named by the scenario they arrived on. It answers "could a reading have reached us", which is
// a different question from whether the device is connected and working today.
const patientMonitorOnRecord = () => Boolean(
  state.assignedDeviceId || state.confirmedDeviceId || state.bpDevice?.deviceId || state.patientHasBloodPressureMonitor
  || (state.offer?.fixture?.deviceSource && state.offer.fixture.deviceSource !== "NONE")
);

function bloodPressureGoalRuntime(goal) {
  const readings = (state.bpReadings || []).filter(item => Number.isFinite(Number(item.systolic)) && Number.isFinite(Number(item.diastolic))).map((item, index) => ({
    id: item.observationId || item.readingId || `runtime-reading-${index}`,
    metricType: "BLOOD_PRESSURE",
    systolic: Number(item.systolic),
    diastolic: Number(item.diastolic),
    unit: "mmHg",
    timestamp: item.timestamp || item.receivedAt,
    source: item.source || "CONNECTED_DEVICE",
    sourceVerified: Boolean(item.sourceVerified),
    deviceId: item.deviceId || item.sourceDeviceId || "",
    observationId: item.observationId || item.readingId || "",
    classification: item.classification || ""
  }));
  // The demo adapter stands in for the longitudinal feed a connected monitor would provide. A
  // patient whose record holds no monitor has no feed for it to stand in for, so inventing readings
  // there claims transmissions from a device that does not exist — and, sitting above a confirmed
  // starting point of 152/88, a fabricated 120/80 tells them they have already reached a control
  // they have not. The empty state is the honest answer and the screens already have one.
  //
  // The care-team target is not gated with it: a threshold is a configuration the patient is
  // entitled to know on day one, not a claim that anything was measured.
  const demoMode = goal.goalType === "BLOOD_PRESSURE_CONTROL" && readings.length === 0 && patientMonitorOnRecord();
  return buildBloodPressureGoalRuntime({ readings, demoMode, monitoringRules: state.bpMonitoringRules || DEMO_BP_MONITORING_RULES, clinicalTarget: state.bpClinicalTarget || DEMO_BP_CLINICAL_TARGET });
}

const bpClassificationCopy = classification => ({
  WITHIN_EXPECTED_RANGE: L("Within the expected range", "Dentro del rango esperado", "Nan limit ekip ou ap suiv la"),
  ABOVE_EXPECTED_RANGE: L("This reading is higher than expected", "Esta lectura está más alta de lo esperado", "Lekti sa a pi wo pase sa yo te espere"),
  NEEDS_REVIEW: L("Your care team is reviewing this reading", "Su equipo está revisando esta lectura", "Ekip swen ou ap revize lekti sa a"),
  ACTION_NEEDED: L("Follow the next step from your care team", "Siga el próximo paso indicado por su equipo", "Swiv pwochen etap ekip swen ou bay la")
})[classification] || L("Your care team is reviewing this reading", "Su equipo está revisando esta lectura", "Ekip swen ou ap revize lekti sa a");

const bpTrendCopy = direction => ({
  STABLE: L("Your readings have stayed fairly stable", "Sus lecturas se han mantenido bastante estables", "Lekti ou yo rete prèske estab"),
  TRENDING_UP: L("Your recent readings have been trending higher", "Sus lecturas recientes muestran una tendencia más alta", "Lekti ki pi resan yo gen tandans monte"),
  TRENDING_DOWN: L("Your recent readings have been trending lower", "Sus lecturas recientes muestran una tendencia más baja", "Lekti ki pi resan yo gen tandans desann"),
  INSUFFICIENT_DATA: L("There are not enough readings to show a trend yet", "Aún no hay suficientes lecturas para mostrar una tendencia", "Poko gen ase lekti pou montre yon tandans")
})[direction] || L("There are not enough readings to show a trend yet", "Aún no hay suficientes lecturas para mostrar una tendencia", "Poko gen ase lekti pou montre yon tandans");

function goalTrendChart(trend) {
  if (!trend?.readings?.length || trend.direction === "INSUFFICIENT_DATA") return `<div class="goal-trend-empty">${icon("trending")}<p>${L("With more readings, we can help you see how your blood pressure changes over time.", "Con más lecturas podremos ayudarle a ver cómo cambia su presión con el tiempo.", "Avèk plis lekti, n ap ka ede w wè kijan tansyon ou chanje avèk tan.")}</p></div>`;
  const readings = trend.readings;
  const x = index => readings.length === 1 ? 140 : 10 + index * (260 / (readings.length - 1));
  const y = value => 86 - ((value - 60) / 80) * 70;
  const systolic = readings.map((item, index) => `${x(index)},${y(item.systolic)}`).join(" ");
  const diastolic = readings.map((item, index) => `${x(index)},${y(item.diastolic)}`).join(" ");
  const label = L(`7-day average ${trend.averageSystolic} over ${trend.averageDiastolic}. ${bpTrendCopy(trend.direction)}.`, `Promedio de 7 días: ${trend.averageSystolic} sobre ${trend.averageDiastolic}. ${bpTrendCopy(trend.direction)}.`, `Mwayèn 7 jou: ${trend.averageSystolic} sou ${trend.averageDiastolic}. ${bpTrendCopy(trend.direction)}.`);
  return `<svg class="goal-trend-chart" viewBox="0 0 280 100" role="img" aria-label="${escapeHtml(label)}"><path d="M10 94 H270" class="goal-chart-axis"/><polyline points="${systolic}" class="goal-chart-line systolic"/><polyline points="${diastolic}" class="goal-chart-line diastolic"/>${readings.map((item, index) => `<circle cx="${x(index)}" cy="${y(item.systolic)}" r="4" class="goal-chart-dot systolic"/><circle cx="${x(index)}" cy="${y(item.diastolic)}" r="4" class="goal-chart-dot diastolic"/>`).join("")}</svg>`;
}

function goalReadingHistory(goal, health) {
  const rows = [...health.readings].reverse().map(reading => `<li class="goal-reading-history-item"><div><strong>${new Intl.DateTimeFormat(goalHealthLocale(), { month: "short", day: "numeric" }).format(new Date(reading.timestamp))}</strong><span>${new Intl.DateTimeFormat(goalHealthLocale(), { hour: "numeric", minute: "2-digit" }).format(new Date(reading.timestamp))}</span></div><p><strong>${reading.systolic} / ${reading.diastolic}</strong><span>mmHg</span></p><small>${icon(reading.classification === "WITHIN_EXPECTED_RANGE" ? "check" : "info")}${bpClassificationCopy(reading.classification)}</small></li>`).join("");
  return `${titleBlock(L("My blood pressure readings", "Mis lecturas de presión arterial", "Lekti tansyon mwen"), L("A simple history of readings received for your care.", "Un historial sencillo de las lecturas recibidas para su cuidado.", "Yon istwa senp sou lekti nou resevwa pou swen ou."), L("My goal", "Mi meta", "Objektif mwen"))}<ul class="goal-reading-history">${rows}</ul><button type="button" class="goal-back-button" data-action="goal-detail-back">${icon("arrowLeft")}<span>${L("Back to my goal", "Volver a mi meta", "Retounen nan objektif mwen")}</span></button>`;
}

function goalActionRow(action, health, goal) {
  const today = localDateKey();
  const verificationMethod = resolveGoalActionVerification(action);
  const doneToday = (action.completionHistory || []).some(item => item.date === today) || action.status === "COMPLETED";
  const frequency = action.frequency ? frequencyLabel(action.frequency) : "";
  const actionTemplate = action.templateId ? suggestedActionsFor(goal.goalType).find(item => item.id === action.templateId) : null;
  const actionTitle = actionTemplate ? localGoalText(actionTemplate.title, state.language) : action.title;
  if (verificationMethod === "DEVICE") {
    const receivedToday = health.latest && localDateKey(health.latest.timestamp) === today;
    return `<li class="goal-action goal-action-automatic ${receivedToday ? "is-done" : ""}">${icon(goalActionIcon(action.templateId || action.id), "goal-action-icon")}<div class="goal-action-copy"><strong>${escapeHtml(actionTitle)}</strong><small class="goal-action-verification">${receivedToday ? `${icon("check")}${L("Reading received today", "Lectura recibida hoy", "Lekti resevwa jodi a")}` : L("Waiting for today’s monitor reading", "Esperando la lectura de hoy del monitor", "N ap tann lekti monitè jodi a")}</small></div><span class="goal-action-source">${L("Automatic", "Automático", "Otomatik")}</span></li>`;
  }
  if (verificationMethod === "EMMI_LESSON") {
    const learned = (goal.educationHistory || []).some(item => item.topicId === "bp-numbers" && item.status === "COMPLETED");
    return `<li class="goal-action ${learned ? "is-done" : ""}">${icon("book", "goal-action-icon")}<div class="goal-action-copy"><strong>${escapeHtml(actionTitle)}</strong><small>${learned ? `${icon("check")}${L("Learned", "Aprendido", "Aprann")}` : L("Short lesson with EMMI", "Lección breve con EMMI", "Ti leson avèk EMMI")}</small></div>${learned ? "" : `<button type="button" class="goal-action-button" data-action="learn-goal-topic">${L("Learn with EMMI", "Aprender con EMMI", "Aprann avèk EMMI")} ${icon("arrowRight")}</button>`}</li>`;
  }
  const medication = action.templateId === "medications-as-directed";
  const prompt = medication ? L("Did you take them today as directed?", "¿Los tomó hoy según las indicaciones?", "Èske ou te pran yo jodi a jan yo mande a?") : L("Did you do this today?", "¿Lo hizo hoy?", "Èske ou te fè sa jodi a?");
  return `<li class="goal-action ${doneToday ? "is-done" : ""}">${icon(goalActionIcon(action.templateId || action.id), "goal-action-icon")}<div class="goal-action-copy"><strong>${escapeHtml(actionTitle)}</strong>${frequency ? `<small>${frequency}</small>` : ""}<p>${doneToday ? `${icon("check")}${L("Reported today", "Registrado hoy", "Rapòte jodi a")}` : prompt}</p></div><div class="goal-action-buttons">${doneToday ? "" : `<button type="button" class="goal-action-button" data-action="complete-goal-action" data-action-id="${action.id}">${medication ? L("Yes", "Sí", "Wi") : L("Yes, I did", "Sí, lo hice", "Wi, mwen te fè sa")}</button>`}${medication ? `<button type="button" class="goal-action-button secondary" data-action="ask-emmi-medication">${L("I have a question", "Tengo una pregunta", "Mwen gen yon kesyon")}</button>` : ""}</div></li>`;
}

// The patient never reads the word "barrier", and never reads a status enum. They read what is
// hard, what we are doing about it, and what happens next.
const barrierCardCopy = barrier => {
  const summary = barrierPatientSummary(barrier, state.language);
  const last = (barrier.interventions || []).at(-1);
  if (!last) return { summary, detail: "", followUp: "" };
  const detail = last.type === INTERVENTION_TYPES.REMINDER
    ? `${L("Reminder", "Recordatorio", "Rapèl")}: ${reminderSlotLabel(last.detail?.slot)}`
    : last.type === INTERVENTION_TYPES.CARE_TEAM_TASK || last.type === INTERVENTION_TYPES.DEVICE_SUPPORT_TASK || last.type === INTERVENTION_TYPES.RESOURCE_SUPPORT || last.type === INTERVENTION_TYPES.APPOINTMENT_COORDINATION
      ? L("Your care team has been notified.", "Su equipo de atención fue notificado.", "Nou avèti ekip swen ou.")
      : barrierHelpCopy(last.type).title;
  const followUp = barrier.status === BARRIER_STATUS.WAITING_FOR_CARE_TEAM
    ? ""
    : L("EMMI will check back to see if this helps.", "EMMI volverá a preguntarle si esto ayuda.", "EMMI ap tounen tcheke si sa ede.");
  return { summary, detail, followUp };
};

// The section heading already says we are working on this, so a card only repeats a state when it
// says something different: waiting on the care team, or waiting on an answer from the patient.
const barrierSupportCard = barrier => `<article class="goal-barrier-card" data-barrier-status="${barrier.status}">
  <span class="goal-barrier-icon">${icon(barrierIcon(barrier))}</span>
  <div>
    <strong>${escapeHtml(barrierCardCopy(barrier).summary)}</strong>
    ${barrierPatientStatus(barrier, state.language) === L("We’re working on this", "Estamos trabajando en esto", "N ap travay sou sa") ? "" : `<span class="goal-barrier-state">${escapeHtml(barrierPatientStatus(barrier, state.language))}</span>`}
    ${barrierCardCopy(barrier).detail ? `<p>${escapeHtml(barrierCardCopy(barrier).detail)}</p>` : ""}
    ${barrierCardCopy(barrier).followUp ? `<small>${escapeHtml(barrierCardCopy(barrier).followUp)}</small>` : ""}
  </div>
  <button type="button" class="goal-card-action" data-action="review-goal-barrier" data-barrier-id="${barrier.id}">${L("Review", "Revisar", "Revize")} ${icon("arrowRight")}</button>
</article>`;

// One difficulty gets its own card. Several get a count and one way in, because a list of problems
// on top of a goal is the opposite of help.
function goalSupportSection(goal) {
  const active = activeGoalBarriers(goal);
  const resolved = resolvedGoalBarriers(goal);
  const resolvedNote = resolved.length
    ? `<p class="goal-barrier-resolved">${icon("check")}<span>${resolved.length === 1
      ? L(`Recently resolved: ${barrierPatientSummary(resolved.at(-1), state.language)}`, `Resuelto recientemente: ${barrierPatientSummary(resolved.at(-1), state.language)}`, `Rezoud dènyèman: ${barrierPatientSummary(resolved.at(-1), state.language)}`)
      : L(`${resolved.length} things we resolved together`, `${resolved.length} cosas que resolvimos juntos`, `${resolved.length} bagay nou rezoud ansanm`)}</span></p>`
    : "";
  if (!active.length) {
    return `<section class="goal-section goal-support-prompt">
      <h2>${L("Need help?", "¿Necesita ayuda?", "Bezwen èd?")}</h2>
      <p>${L("Is anything making this goal difficult?", "¿Hay algo que le dificulte avanzar con esta meta?", "Èske gen yon bagay ki fè objektif sa a difisil?")}</p>
      <p class="goal-section-support">${L("EMMI can help with many common problems, or connect you with your care team when that is what you need.", "EMMI puede ayudar con muchos problemas comunes o conectarle con su equipo de atención cuando lo necesite.", "EMMI ka ede ak anpil pwoblèm komen, oswa konekte w ak ekip swen ou lè se sa ou bezwen.")}</p>
      <button type="button" class="goal-secondary-button" data-action="open-goal-barriers">${icon("question")}<span>${L("Tell EMMI what’s difficult", "Contarle a EMMI qué es difícil", "Di EMMI sa ki difisil")}</span></button>
      ${resolvedNote}
    </section>`;
  }
  return `<section class="goal-section goal-support-active">
    <h2>${L("We’re working on this", "Estamos trabajando en esto", "N ap travay sou sa")}</h2>
    ${active.length === 1 ? barrierSupportCard(active[0]) : `<p class="goal-section-support">${L(`${active.length} things we’re helping with`, `${active.length} cosas en las que le estamos ayudando`, `${active.length} bagay n ap ede w avèk yo`)}</p><div class="goal-barrier-stack">${active.map(barrierSupportCard).join("")}</div>`}
    <button type="button" class="goal-secondary-button" data-action="open-goal-barriers">${icon("question")}<span>${L("Something else is difficult", "Hay otra cosa difícil", "Gen yon lòt bagay ki difisil")}</span></button>
    ${resolvedNote}
  </section>`;
}

// One question, contextual options, and always a way to say it in your own words.
//
// When the platform noticed something rather than the patient reporting it, the same screen asks
// instead of telling: missing readings could be a broken cuff, a trip, a hospital stay or a week
// that got away from someone. EMMI does not guess which.
function goalBarrierPicker(goal) {
  const suspected = activeBarrier()?.status === BARRIER_STATUS.SUSPECTED ? activeBarrier() : null;
  const options = barrierOptionsFor({
    goal,
    hasDevice: barrierCapabilities().hasDevice,
    hasMedications: Boolean((state.careMedications || []).length),
    locale: state.language
  });
  const heading = suspected
    ? L("Is anything making it hard to take your readings?", "¿Hay algo que le dificulte tomar sus lecturas?", "Èske gen yon bagay ki fè li difisil pou pran lekti ou?")
    : L("What’s making this difficult?", "¿Qué se lo está haciendo difícil?", "Kisa k ap fè sa difisil?");
  const lead = suspected
    ? L("We haven’t received some of your recent readings. Nothing is wrong — I’d just like to know if something is getting in the way.", "No hemos recibido algunas de sus lecturas recientes. No pasa nada: solo quiero saber si algo se lo está dificultando.", "Nou pa resevwa kèk nan dènye lekti ou yo. Pa gen anyen ki mal — mwen jis vle konnen si gen yon bagay k ap anpeche w.")
    : L("Choose the one that fits best. You can tell me more after.", "Elija la que mejor corresponda. Después puede contarme más.", "Chwazi sa ki pi bon. Ou ka di m plis apre.");
  return `${titleBlock(heading, lead, L("Getting help", "Obtener ayuda", "Jwenn èd"))}
    <div class="choice-list goal-barrier-choices">${options.map(option => `<button type="button" class="goal-response-button" data-action="select-goal-barrier" data-barrier-category="${option.category}">${icon(option.icon)}<span>${escapeHtml(option.label)}</span></button>`).join("")}</div>
    ${suspected ? `<button type="button" class="goal-inline-link" data-action="dismiss-suspected-barrier" data-barrier-id="${suspected.id}">${L("Nothing is making it difficult", "Nada me lo está dificultando", "Anyen pa fè l difisil")}</button>` : ""}
    <p class="form-error" role="alert">${state.error || ""}</p>
    <div class="actions">${cta(t().back, "goal-detail-back", true)}</div>`;
}

// "Something else" is not a dead end: the patient describes it, and the same classifier that
// listens to EMMI conversations decides what kind of help it is.
function goalBarrierDescribe() {
  return `${titleBlock(L("Tell EMMI in your own words", "Cuéntele a EMMI en sus propias palabras", "Di EMMI nan pwòp mo pa ou"), L("You can type it here, or say it to EMMI.", "Puede escribirlo aquí o decírselo a EMMI.", "Ou ka ekri l isit oswa di l bay EMMI."), L("Getting help", "Obtener ayuda", "Jwenn èd"))}
    <form id="goal-barrier-describe-form"><label class="field"><span class="sr-only">${L("What is making this difficult?", "¿Qué se lo está haciendo difícil?", "Kisa k ap fè sa difisil?")}</span><textarea name="patientDescription" rows="4" maxlength="400" placeholder="${L("Example: I can’t get the cuff to stay on my arm.", "Ejemplo: No logro que el brazalete se quede en mi brazo.", "Egzanp: Mwen pa ka fè manchèt la rete sou bra mwen.")}">${escapeHtml(state.goalBarrierDraft?.patientDescription || "")}</textarea></label></form>
    <button type="button" class="goal-secondary-button" data-action="describe-barrier-with-emmi">${icon("mic")}<span>${L("Tell EMMI instead", "Decírselo a EMMI", "Di EMMI pito")}</span></button>
    <p class="form-error" role="alert">${state.error || ""}</p>
    <div class="actions">${cta(t().back, "goal-detail-back", true)}${cta(L("Continue", "Continuar", "Kontinye"), "submit-goal-barrier-description")}</div>`;
}

// What EMMI proposes, why, and the patient's right to say no. A declined offer is a choice on the
// record, never a failure.
function goalBarrierHelp() {
  const barrier = activeBarrier();
  if (!barrier) return goalBarrierPicker(currentGoal());
  const plan = state.barrierHelpPlan || {};
  const copy = barrierHelpCopy(plan.intervention);
  const safety = plan.severity === "EMERGENCY";
  const reminder = plan.intervention === INTERVENTION_TYPES.REMINDER;
  // The title names the difficulty; what EMMI proposes is said once, in the panel below it.
  return `${titleBlock(escapeHtml(barrierPatientSummary(barrier, state.language)), "", L("EMMI is helping", "EMMI está ayudando", "EMMI ap ede"))}
    ${safety ? `<section class="goal-panel goal-barrier-safety">${icon("info")}<div><strong>${L("If this is an emergency, call 911 now.", "Si es una emergencia, llame al 911 ahora.", "Si se yon ijans, rele 911 kounye a.")}</strong><a class="assistant-emergency-action" href="tel:911">${icon("phone")}<span>${L("Call 911", "Llamar al 911", "Rele 911")}</span></a></div></section>` : ""}
    <section class="goal-panel goal-barrier-help">${icon(barrierIcon(barrier))}<div><span class="goal-panel-eyebrow">${escapeHtml(copy.title)}</span><p>${escapeHtml(copy.body)}</p></div></section>
    ${reminder ? `<div class="choice-list goal-reminder-slots">${REMINDER_SLOTS().map(slot => `<button type="button" class="goal-response-button" data-action="set-barrier-reminder" data-reminder-slot="${slot.id}">${icon("bell")}<span>${slot.label}</span></button>`).join("")}</div>
    <p class="goal-section-support">${L("Reminders appear in ITERA when you open it. We will not send anything to your phone without setting that up with you first.", "Los recordatorios aparecen en ITERA cuando la abre. No enviaremos nada a su teléfono sin configurarlo antes con usted.", "Rapèl yo parèt nan ITERA lè ou louvri l. Nou p ap voye anyen sou telefòn ou san nou pa mete sa anplas avèk ou anvan.")}</p>` : ""}
    <div class="actions">${cta(L("Not now", "Ahora no", "Pa kounye a"), "decline-barrier-help", true)}${reminder ? "" : cta(copy.cta, "accept-barrier-help")}</div>
    <button type="button" class="goal-inline-link" data-action="ask-emmi-about-barrier">${L("Ask EMMI about this", "Preguntar a EMMI sobre esto", "Mande EMMI sou sa")} ${icon("arrowRight")}</button>`;
}

// The follow-up. Three honest answers, and none of them says the patient failed.
function goalBarrierFollowUp() {
  const barrier = activeBarrier();
  if (!barrier) return goalBarrierPicker(currentGoal());
  const last = (barrier.interventions || []).at(-1);
  const question = last?.type === INTERVENTION_TYPES.REMINDER
    ? L("Are the reminders helping you?", "¿Le están ayudando los recordatorios?", "Èske rapèl yo ap ede w?")
    : last?.type === INTERVENTION_TYPES.EDUCATION
      ? L("Did that explanation help?", "¿Le ayudó esa explicación?", "Èske eksplikasyon sa a te ede w?")
      : last?.type === INTERVENTION_TYPES.DEVICE_GUIDANCE
        ? L("Were you able to take a reading?", "¿Pudo tomar una lectura?", "Èske ou te ka pran yon lekti?")
        : L("Is this getting easier?", "¿Se le está haciendo más fácil?", "Èske sa vin pi fasil?");
  const options = last?.type === INTERVENTION_TYPES.DEVICE_GUIDANCE
    ? [["RESOLVED", L("Yes, it worked", "Sí, funcionó", "Wi, li mache")], ["PARTIALLY_HELPED", L("Almost", "Casi", "Prèske")], ["NOT_HELPED", L("No, it still won’t work", "No, aún no funciona", "Non, li toujou pa mache")]]
    : [["RESOLVED", L("Yes, a lot", "Sí, mucho", "Wi, anpil")], ["PARTIALLY_HELPED", L("A little", "Un poco", "Yon ti kras")], ["NOT_HELPED", L("I’m still having trouble", "Sigo teniendo dificultad", "Mwen toujou gen difikilte")]];
  return `${titleBlock(question, escapeHtml(barrierPatientSummary(barrier, state.language)), L("Checking in", "Seguimiento", "Tcheke"))}
    <div class="choice-list goal-followup-options">${options.map(([value, label]) => `<button type="button" class="goal-response-button" data-action="barrier-follow-up-response" data-outcome="${value}">${label}</button>`).join("")}</div>
    <div class="actions">${cta(t().back, "goal-detail-back", true)}</div>`;
}

function accessGoalOutcomeSection(goal) {
  if (!goal || !isAssignedAccessGoal(state.offer, goal.goalType)) return "";
  const point = patientStartingPoint(goal.goalType, careActivationRuntime());
  const measure = accessProgressMeasure(goal.goalType, point);
  return `<section class="goal-section access-goal-outcome">
    <h2>${L("How ACCESS measures this goal", "Cómo ACCESS mide esta meta", "Kijan ACCESS mezire objektif sa a")}</h2>
    <p class="goal-section-support">${L("Your care team records these. They are not something you set or change here.", "Su equipo de cuidado registra estos datos. No son algo que usted defina o cambie aquí.", "Se ekip swen ou ki anrejistre sa yo. Se pa yon bagay ou fikse oswa chanje isit la.")}</p>
    <div class="access-goal-baseline"><h4>${L("Your starting point", "Su punto de partida", "Pwen depa ou")}</h4>${accessStartingPointBody(goal.goalType, point)}</div>
    <div class="access-goal-measure"><h4>${L("How ACCESS measures progress", "Cómo ACCESS mide su progreso", "Kijan ACCESS mezire pwogrè")}</h4>${accessMeasureMarkup(goal.goalType, measure)}</div>
  </section>`;
}

function goalDetail() {
  const goal = currentGoal();
  if (!goal) return myGoalsDashboard();
  const title = escapeHtml(goalDisplayName(goal, state.language));
  const health = goal.goalType === "BLOOD_PRESSURE_CONTROL" ? bloodPressureGoalRuntime(goal) : null;
  detectGoalSignalBarriers(goal, health);
  if (state.goalDetailView === "READINGS" && health) return goalReadingHistory(goal, health);
  if (state.goalDetailView === "WHY_EDIT") return `${titleBlock(L("Why this matters to me", "Por qué esto es importante para mí", "Poukisa sa enpòtan pou mwen"), title, L("My goal", "Mi meta", "Objektif mwen"))}<form id="goal-why-form"><label class="field"><textarea name="whyItMatters" rows="5" maxlength="300" placeholder="${L("Share what you want this goal to help you keep doing.", "Cuente qué desea que esta meta le ayude a seguir haciendo.", "Pataje sa ou vle objektif sa a ede w kontinye fè.")}">${escapeHtml(goal.whyItMatters || "")}</textarea></label></form><div class="actions">${cta(t().back, "goal-detail-back", true)}${cta(L("Save", "Guardar", "Sove"), "save-goal-why")}</div>`;
  if (state.goalDetailView === "CHECK_IN") return `${titleBlock(L("How do you feel this goal is going?", "¿Cómo siente que va esta meta?", "Kijan ou santi objektif sa a ap mache?"), title, L("Goal check-in", "Seguimiento de meta", "Tcheke objektif"))}<div class="choice-list goal-checkin-options">${[["GOING_WELL", L("I’m making progress", "Estoy avanzando", "M ap fè pwogrè")], ["ABOUT_THE_SAME", L("About the same", "Más o menos igual", "Prèske menm jan")], ["DIFFICULTY", L("I’m having a hard time", "Me está costando", "Sa difisil pou mwen")], ["NOT_STARTED", L("I haven’t started yet", "Todavía no he empezado", "Mwen poko kòmanse")]].map(([value,label]) => `<button type="button" class="goal-response-button" data-action="goal-checkin-response" data-response="${value}">${label}</button>`).join("")}</div><div class="actions">${cta(t().back, "goal-detail-back", true)}</div>`;
  if (state.goalDetailView === "BARRIERS") return goalBarrierPicker(goal);
  if (state.goalDetailView === "BARRIER_DESCRIBE") return goalBarrierDescribe();
  if (state.goalDetailView === "BARRIER_HELP") return goalBarrierHelp();
  if (state.goalDetailView === "BARRIER_FOLLOW_UP") return goalBarrierFollowUp();
  if (state.goalDetailView === "ACHIEVE_CONFIRM") return `${art("check", true)}${titleBlock(L("Are you ready to mark this goal as achieved?", "¿Está listo para marcar esta meta como lograda?", "Èske ou pare pou make objektif sa a kòm reyalize?"), title)}<p class="lead">${L("This only updates your personal goal. It does not change a clinical target or your care plan.", "Esto solo actualiza su meta personal. No cambia un objetivo clínico ni su plan de cuidado.", "Sa mete ajou objektif pèsonèl ou sèlman. Li pa chanje yon sib klinik ni plan swen ou.")}</p><div class="actions">${cta(L("Not yet", "Todavía no", "Poko"), "goal-detail-back", true)}${cta(L("Mark as achieved", "Marcar como lograda", "Make kòm reyalize"), "confirm-goal-achieved")}</div>`;
  const goalActions = goal.actions || [];
  const actionRows = goalActions.map(action => goalActionRow(action, health || {}, goal)).join("");
  const education = nextBestGoalEducation({ goalType: goal.goalType, completedTopicIds: (goal.educationHistory || []).filter(item => item.status === "COMPLETED").map(item => item.topicId) });
  const localizedEducation = education ? { title: localGoalText(education.title, state.language), summary: localGoalText(education.summary, state.language) } : null;
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); weekStart.setHours(0,0,0,0);
  const weeklyCompletions = templateId => goalActions.filter(item => item.templateId === templateId).flatMap(item => item.completionHistory || []).filter(item => new Date(`${item.date}T00:00:00`) >= weekStart).length;
  const progressMetrics = [
    health?.trend?.count ? ["chart", health.trend.count, L("readings received", "lecturas recibidas", "lekti resevwa")] : null,
    goalActions.some(item => item.templateId === "medications-as-directed") ? ["pill", weeklyCompletions("medications-as-directed"), L("medication check-ins", "registros de medicamentos", "tcheke medikaman")] : null,
    goalActions.some(item => item.templateId === "be-active") ? ["activity", weeklyCompletions("be-active"), L("active days", "días activos", "jou aktif")] : null,
    goalActions.some(item => resolveGoalActionVerification(item) === "EMMI_LESSON") ? ["book", (goal.educationHistory || []).filter(item => item.status === "COMPLETED" && new Date(item.completedAt) >= weekStart).length, L("topics learned", "temas aprendidos", "sijè aprann")] : null
  ].filter(Boolean);
  const clinicalTarget = health?.clinicalTarget ? `<aside class="goal-panel clinical-target-card">${icon("shield")}<div><span class="goal-panel-eyebrow">${L("Goal set by your care team", "Objetivo definido por su equipo", "Sib ekip swen ou fikse")}</span><strong>${L("Less than", "Menos de", "Mwens pase")} ${health.clinicalTarget.systolicMaximum + 1}/${health.clinicalTarget.diastolicMaximum + 1} mmHg</strong><p>${L("Your care team sets this target. You can adjust the actions in your personal plan.", "Su equipo define este objetivo. Usted puede ajustar las acciones de su plan personal.", "Ekip swen ou fikse sib sa a. Ou ka ajiste aksyon nan plan pèsonèl ou.")}</p></div></aside>` : "";
  const statusLead = goal.status === "PAUSED"
    ? L("This goal is paused. You can return to it later.", "Esta meta está pausada. Puede retomarla después.", "Objektif sa a an poz. Ou ka retounen sou li pita.")
    : goal.status === "ACHIEVED"
      ? L("You marked this personal goal as achieved.", "Marcó esta meta personal como lograda.", "Ou make objektif pèsonèl sa a kòm reyalize.")
      : L("See how your blood pressure is doing, follow your steps, and learn what your results mean.", "Vea cómo va su presión, siga sus pasos y aprenda qué significan sus resultados.", "Gade kijan tansyon ou ye, swiv etap ou yo, epi aprann sa rezilta yo vle di.");
  // The same starting point and the same two ACCESS measures the goals screen and the care plan
  // show, read from the same resolver rather than restated here. My Goals is where the patient
  // comes back to weeks later, and a baseline that differed from the one they were shown at
  // activation would read as their number having quietly changed.
  //
  // Read-only on purpose: the baseline is an observation, the control target belongs to the
  // program and the milestone is arithmetic on the two. None of them is the patient's to edit, so
  // this section offers no control at all and says why.
  const accessOutcome = accessGoalOutcomeSection(goal);
  const latest = health?.latest;
  const metric = health ? `<section class="goal-health-card" aria-label="${latest ? escapeHtml(L(`Blood pressure, ${latest.systolic} over ${latest.diastolic} millimeters of mercury. ${bpClassificationCopy(latest.classification)}.`, `Presión arterial, ${latest.systolic} sobre ${latest.diastolic} milímetros de mercurio. ${bpClassificationCopy(latest.classification)}.`, `Tansyon, ${latest.systolic} sou ${latest.diastolic} milimèt mèki. ${bpClassificationCopy(latest.classification)}.`)) : ""}"><div class="goal-health-eyebrow">${icon("heart")}<span>${L("My blood pressure today", "Mi presión hoy", "Tansyon mwen jodi a")}</span></div>${latest ? `<p class="goal-health-value"><strong>${latest.systolic} <i>/</i> ${latest.diastolic}</strong><span>mmHg</span></p><p class="goal-health-status ${latest.classification.toLowerCase()}">${icon(latest.classification === "WITHIN_EXPECTED_RANGE" ? "check" : "info")}${bpClassificationCopy(latest.classification)}</p><p class="goal-health-time">${L("Today", "Hoy", "Jodi a")} · ${new Intl.DateTimeFormat(goalHealthLocale(), { hour: "numeric", minute: "2-digit" }).format(new Date(latest.timestamp))}</p><p class="goal-health-source">${latest.source === "CONNECTED_DEVICE" && latest.sourceVerified ? L("Received automatically from your monitor", "Recibida automáticamente desde su monitor", "Resevwa otomatikman nan monitè ou") : L("Reported health reading", "Lectura de salud registrada", "Lekti sante rapòte")}</p><button type="button" class="goal-card-action" data-action="view-goal-readings">${L("View my readings", "Ver mis lecturas", "Gade lekti mwen")} ${icon("arrowRight")}</button><button type="button" class="goal-card-action secondary" data-action="explain-goal-reading">${L("What does this reading mean?", "¿Qué significa esta lectura?", "Kisa lekti sa a vle di?")} ${icon("arrowRight")}</button>` : `<div class="goal-health-empty">${icon("info")}<strong>${L("We have not received a reading today.", "Aún no hemos recibido una lectura hoy.", "Nou poko resevwa yon lekti jodi a.")}</strong><p>${L("When you use your connected monitor, the reading will appear here automatically.", "Cuando use su monitor conectado, la lectura aparecerá aquí automáticamente.", "Lè ou sèvi ak monitè konekte ou, lekti a ap parèt isit otomatikman.")}</p></div>`}</section>` : "";
  const trend = health ? `<section class="goal-section goal-trend"><div class="goal-section-heading"><div><h2>${L("How my blood pressure has been", "Cómo ha estado mi presión", "Kijan tansyon mwen te ye")}</h2><p>${L("Last 7 days", "Últimos 7 días", "7 dènye jou yo")}</p></div></div>${goalTrendChart(health.trend)}${health.trend.averageSystolic ? `<div class="goal-trend-summary"><span>${L("Average", "Promedio", "Mwayèn")}</span><strong>${health.trend.averageSystolic} / ${health.trend.averageDiastolic}</strong><small>${icon(health.trend.direction === "STABLE" ? "check" : "trending")}${bpTrendCopy(health.trend.direction)}</small></div>` : ""}${health.trend.direction === "INSUFFICIENT_DATA" ? "" : `<button type="button" class="goal-secondary-button" data-action="explain-goal-trend">${icon("trending")}<span>${L("Ask EMMI to explain this trend", "Pedir a EMMI que explique esta tendencia", "Mande EMMI eksplike tandans sa a")}</span></button>`}</section>` : "";
  return `<span class="eyebrow">${L("My goal", "Mi meta", "Objektif mwen")}</span>
    <div class="goal-detail-hero">${goalIcon(goal, "goal-detail-hero-icon")}<h1 tabindex="-1">${title}</h1></div>
    ${statusLead ? `<p class="lead">${statusLead}</p>` : ""}
    ${metric}${trend}${accessOutcome}
    <section class="goal-section">
      <h2>${L("My actions", "Mis acciones", "Aksyon mwen")}</h2>
      ${actionRows ? `<p class="goal-section-support">${L("Some steps are recorded automatically. You only confirm the ones you do yourself.", "Algunos pasos se registran automáticamente. Usted solo confirma los que realiza personalmente.", "Gen kèk etap ki anrejistre otomatikman. Ou konfime sèlman sa ou fè tèt ou.")}</p><ul class="goal-action-list">${actionRows}</ul>` : `<p class="goal-progress-empty">${L("You have not added any actions yet.", "Todavía no ha agregado acciones.", "Ou poko ajoute okenn aksyon.")}</p>`}
      <button type="button" class="goal-secondary-button" data-action="plan-active-goal">${icon("sliders")}<span>${actionRows ? L("Adjust my plan", "Ajustar mi plan", "Ajiste plan mwen") : goal.planPersonalizationStatus === "DEFERRED" || goal.planStatus === "DEFERRED" ? L("Continue personalizing my plan", "Continuar personalizando mi plan", "Kontinye pèsonalize plan mwen") : L("Personalize my plan", "Personalizar mi plan", "Pèsonalize plan mwen")}</span></button>
    </section>
    ${goalSupportSection(goal)}
    ${localizedEducation ? `<section class="goal-education-card"><img src="/assets/emmi-assistant.png" alt=""><div><span>${L("Learn with EMMI", "Aprenda con EMMI", "Aprann avèk EMMI")}</span><h2>${escapeHtml(localizedEducation.title)}</h2><p>${escapeHtml(localizedEducation.summary)}</p><button type="button" class="goal-card-action" data-action="learn-goal-topic">${L("Explain it to me", "Explícamelo", "Eksplike m sa")} ${icon("arrowRight")}</button></div></section>` : ""}
    <section class="goal-section goal-progress">
      <h2>${L("My progress", "Mi progreso", "Pwogrè mwen")}</h2>
      <p class="goal-section-support">${L("This week", "Esta semana", "Semèn sa a")}</p>
      ${progressMetrics.length ? `<ul class="goal-progress-metrics">${progressMetrics.map(([metricIcon, count, label]) => `<li>${icon(metricIcon)}<strong>${count}</strong><span>${label}</span></li>`).join("")}</ul>` : `<p class="goal-progress-empty">${L("Your progress will appear here as readings and check-ins are recorded.", "Su progreso aparecerá aquí a medida que se registren lecturas y seguimientos.", "Pwogrè ou ap parèt isit pandan lekti ak tcheke yo anrejistre.")}</p>`}
      <button type="button" class="goal-secondary-button" data-action="open-goal-checkin">${icon("trending")}<span>${L("How is this goal going?", "¿Cómo va esta meta?", "Kijan objektif sa a ap mache?")}</span></button>
    </section>
    ${clinicalTarget}
    <section class="goal-panel goal-why">${icon("heart")}<div><span class="goal-panel-eyebrow">${L("Why this matters to me", "Por qué esto es importante para mí", "Poukisa sa enpòtan pou mwen")}</span>${goal.whyItMatters ? `<p>${escapeHtml(goal.whyItMatters)}</p><button type="button" class="goal-inline-link" data-action="edit-goal-why">${L("Edit", "Editar", "Modifye")}</button>` : `<button type="button" class="goal-inline-link" data-action="edit-goal-why">${L("Add why this matters", "Agregar por qué es importante", "Ajoute poukisa sa enpòtan")} ${icon("arrowRight")}</button>`}</div></section>
    <details class="goal-manage"><summary>${L("Review or adjust this goal", "Revisar o ajustar esta meta", "Revize oswa ajiste objektif sa a")}</summary><div>${goal.status === "PAUSED" ? `<button type="button" data-action="reactivate-goal">${L("Restart this goal", "Reanudar esta meta", "Rekòmanse objektif sa a")}</button>` : `<button type="button" data-action="pause-goal">${L("Pause this goal", "Pausar esta meta", "Mete objektif sa a an poz")}</button>`}<button type="button" data-action="change-goal-priority">${L("Change priority", "Cambiar prioridad", "Chanje priyorite")}</button><button type="button" data-action="goal-mark-achieved">${L("Mark as achieved", "Marcar como lograda", "Make kòm reyalize")}</button></div></details>
    <button type="button" class="goal-back-button" data-action="goal-detail-to-list">${icon("arrowLeft")}<span>${L("Back to My Goals", "Volver a Mis metas", "Retounen nan Objektif mwen")}</span></button>`;
}

function myGoals() {
  const notice = state.goalNotice ? `<p class="goal-notice" role="status">${escapeHtml(state.goalNotice)}</p>` : "";
  return state.activeGoalId ? `${notice}${goalDetail()}` : myGoalsDashboard();
}

function accessBpDeviceVerification() {
  const title = L("Let’s check your monitor", "Revisemos su monitor", "Ann verifye aparèy ou a");
  const support = L("We’ll check whether you already have a monitor connected to ITERA HEALTH.", "Verificaremos si ya tiene un monitor conectado a ITERA HEALTH.", "N ap verifye si ou deja gen yon aparèy ki konekte ak ITERA HEALTH.");
  if (state.deviceVerificationStatus === "CHECKING" || state.busy) return `${art("device")}${titleBlock(title, support)}<section class="device-lookup-status" role="status" aria-live="polite">${icon("wifi")}<div><strong>${L("Checking your connected monitor", "Verificando su monitor conectado", "N ap verifye aparèy konekte ou")}</strong><p>${L("This usually takes only a moment.", "Esto generalmente toma solo un momento.", "Sa konn pran sèlman yon ti moman.")}</p></div></section>`;
  if (state.deviceUncertaintyStep) {
    const options = [
      ["assignment-yes", "check", L("Yes", "Sí", "Wi"), L("Check the ITERA assignment again", "Verificar nuevamente la asignación de ITERA", "Verifye plasman ITERA a ankò")],
      ["assignment-no", "device", L("No", "No", "Non"), L("Help me get a connected monitor", "Ayúdeme a obtener un monitor conectado", "Ede m jwenn yon aparèy konekte")],
      ["assignment-unsure", "question", L("I’m not sure", "No estoy seguro", "Mwen pa sèten"), L("Talk with my care team", "Hablar con mi equipo", "Pale ak ekip swen mwen an")]
    ];
    return `${art("question")}${titleBlock(L("Was your monitor provided by ITERA HEALTH?", "¿ITERA HEALTH le proporcionó su monitor?", "Èske ITERA HEALTH te ba ou aparèy la?"), L("Choose the answer that feels right. We can help if you’re not sure.", "Elija la respuesta que le parezca correcta. Podemos ayudarle si no está seguro.", "Chwazi repons ki sanble kòrèk pou ou. Nou ka ede w si ou pa sèten."))}<form class="choice-list bp-assignment-question">${options.map(([value, itemIcon, optionTitle, body]) => choice(value, itemIcon, optionTitle, body)).join("")}</form><p class="form-error" role="alert">${state.error || ""}</p>${actions(t().continue)}`;
  }
  const situations = [
    ["patient-owned", "device", L("I’m using my own monitor", "Estoy usando mi propio monitor", "M ap itilize pwòp aparèy mwen"), L("We’ll explain how connected ACCESS readings work.", "Le explicaremos cómo funcionan las mediciones conectadas de ACCESS.", "N ap eksplike kijan mezi ACCESS konekte yo fonksyone.")],
    ["need-itera", "device", L("I need a monitor from ITERA", "Necesito un monitor de ITERA", "Mwen bezwen yon aparèy nan ITERA"), L("We’ll help arrange a connected monitor.", "Le ayudaremos a obtener un monitor conectado.", "N ap ede fè aranjman pou yon aparèy konekte.")],
    ["situation-unsure", "question", L("I’m not sure", "No estoy seguro", "Mwen pa sèten"), L("We’ll ask one simple question.", "Le haremos una pregunta sencilla.", "N ap poze yon sèl kesyon senp.")]
  ];
  return `${art("device")}${titleBlock(L("We don’t see a monitor connected to your care yet.", "Aún no vemos un monitor conectado a su cuidado.", "Nou poko wè yon aparèy ki konekte ak swen ou."), L("Which best describes your situation?", "¿Cuál opción describe mejor su situación?", "Ki opsyon ki pi byen dekri sitiyasyon ou?"))}<form class="choice-list bp-device-situations">${situations.map(([value, itemIcon, optionTitle, body]) => choice(value, itemIcon, optionTitle, body)).join("")}</form><p class="form-error" role="alert">${state.error || ""}</p>${actions(t().continue)}`;
}

function bpFulfillmentDeviceConfiguration() {
  const preferredVendor = state.offer?.fixture?.bpDeviceVendor === "PYLO" ? "PYLO" : "TENOVI";
  return BP_FULFILLMENT_DEVICE_MODELS.find(model => model.vendor === preferredVendor && model.availableForFulfillment)
    || BP_FULFILLMENT_DEVICE_MODELS.find(model => model.availableForFulfillment);
}

function cuffOptionLabel(option) {
  return ({
    extraSmall: L("Extra Small", "Extra pequeño", "Trè piti"),
    standard: L("Standard", "Estándar", "Nòmal"),
    large: L("Large", "Grande", "Gwo"),
    extraLarge: L("Extra Large", "Extra grande", "Trè gwo")
  })[option.labelKey] || option.labelKey;
}

function cuffOptionDescription(option) {
  return ({
    extraSmall: L("For smaller upper arms", "Para brazos de menor tamaño", "Pou bra anwo ki pi piti"),
    standard: L("For regular-sized upper arms", "Para brazos de tamaño regular", "Pou bra anwo gwosè nòmal"),
    large: L("For wider upper arms", "Para brazos más anchos", "Pou bra anwo ki pi laj"),
    extraLarge: L("For larger upper arms", "Para brazos de mayor tamaño", "Pou bra anwo ki pi gwo")
  })[option.labelKey] || "";
}

function cuffRangeLabel(option) {
  const inchesMin = Math.round((option.minArmCircumference / 2.54) * 10) / 10;
  const inchesMax = Math.round((option.maxArmCircumference / 2.54) * 10) / 10;
  return state.language === "en" ? `${option.minArmCircumference}–${option.maxArmCircumference} cm (${inchesMin}–${inchesMax} in)` : `${option.minArmCircumference}–${option.maxArmCircumference} cm`;
}

function accessBpDeviceInfo() {
  const deviceConfiguration = bpFulfillmentDeviceConfiguration();
  // Sizes and ranges come from the device record, never from copy. Tenovi and Pylo ship different
  // cuffs at different ranges, so a hardcoded "22-42 cm" would be a manufacturer claim about
  // whichever monitor this patient is not getting. Tenovi happens to have exactly three.
  const cuffOptions = (deviceConfiguration?.cuffOptions || []).filter(option => option.inventoryStatus === "AVAILABLE" && option.compatibleDeviceModels.includes(deviceConfiguration.id));
  const monitorCard = `<aside class="note device-intro-card">${icon("device")}<div><strong>${L("Your blood pressure monitor", "Su monitor de presión arterial", "Aparèy tansyon ou a")}</strong><p>${L("We’ll prepare your monitor for your ACCESS care and send it to the address you confirm.", "Prepararemos su monitor para el cuidado ACCESS y lo enviaremos a la dirección que confirme.", "N ap prepare aparèy ou a pou swen ACCESS ou epi voye l nan adrès ou konfime a.")}</p></div></aside>`;
  // The size is all this screen needs to send the right box. How to wear the cuff is taught during
  // device setup, in front of the actual device, which is the only moment it is useful.
  const cuffSection = `<section class="cuff-selection-section" aria-labelledby="cuff-selection-title"><fieldset class="cuff-choice-group"><legend id="cuff-selection-title">${L("Choose the right cuff size", "Elija la talla de brazalete correcta", "Chwazi bon gwosè manchèt la")}</legend><p class="fieldset-support">${L("Measure around your upper arm and select the size that matches your measurement.", "Mida alrededor de la parte superior de su brazo y elija la talla que corresponda a su medida.", "Mezire otou pati anwo bra ou epi chwazi gwosè ki koresponn ak mezi ou.")}</p><div class="choice-list cuff-choice-list">${cuffOptions.map(option => choice(option.id, "device", cuffOptionLabel(option), cuffRangeLabel(option), state.selectedCuffOption === option.id)).join("")}</div></fieldset></section>`;
  const hasCuffDecision = Boolean(state.selectedCuffOption);
  return `${art("device")}${titleBlock(L("Track your blood pressure from home", "Controle su presión arterial desde casa", "Swiv tansyon ou lakay ou"), L("Keep your ACCESS care team informed about your progress.", "Mantenga a su equipo de cuidado ACCESS informado sobre su progreso.", "Kenbe ekip swen ACCESS ou enfòme sou pwogrè ou."))}${monitorCard}<form id="bp-device-info-form">${cuffSection}<p class="form-error" role="alert">${state.error || ""}</p>${actions(L("Request my monitor", "Solicitar mi monitor", "Mande aparèy mwen an"), true, "", !hasCuffDecision)}</form>`;
}

function accessBpShippingAddress() {
  const existing = state.offer.patient.shippingAddress;
  const selected = state.shippingAddressMode || "existing";
  const current = state.shippingAddress || existing || {};
  return `${art("box")}${titleBlock(L("Where would you like your monitor delivered?", "¿Dónde desea recibir su monitor?", "Ki kote ou vle resevwa aparèy ou a?"))}<form id="bp-shipping-form"><div class="choice-list">${choice("existing", "home", L("This address is correct", "Esta dirección es correcta", "Adrès sa a kòrèk"), L("Use the address we already have", "Use la dirección que ya tenemos", "Itilize adrès nou deja genyen an"), selected === "existing")}${choice("other", "document", L("Use a different address", "Usar otra dirección", "Itilize yon lòt adrès"), L("Enter another delivery address", "Ingrese otra dirección de envío", "Antre yon lòt adrès livrezon"), selected === "other")}</div>${selected === "existing" ? `<address class="address-card">${icon("home")}<span><strong>${L("Send to:", "Enviar a:", "Voye nan:")}</strong><br>${escapeHtml(existing.line1)}${existing.unit ? `<br>${escapeHtml(existing.unit)}` : ""}<br>${escapeHtml(existing.city)}, ${escapeHtml(existing.state)} ${escapeHtml(existing.zip)}</span></address>` : `<div class="shipping-fields"><div class="field"><label for="shipping-line1">${L("Street address", "Dirección", "Adrès lari")}</label><input id="shipping-line1" name="line1" autocomplete="shipping street-address" value="${escapeHtml(current.line1 || "")}"></div><div class="field"><label for="shipping-unit">${L("Apartment / Unit", "Apartamento / Unidad", "Apatman / Inite")}</label><input id="shipping-unit" name="unit" autocomplete="shipping address-line2" value="${escapeHtml(current.unit || "")}"></div><div class="field"><label for="shipping-city">${L("City", "Ciudad", "Vil")}</label><input id="shipping-city" name="city" autocomplete="shipping address-level2" value="${escapeHtml(current.city || "")}"></div><div class="shipping-short-fields"><div class="field"><label for="shipping-state">${L("State", "Estado", "Eta")}</label><input id="shipping-state" name="state" maxlength="2" autocomplete="shipping address-level1" value="${escapeHtml(current.state || "")}"></div><div class="field"><label for="shipping-zip">${L("ZIP code", "Código postal", "Kòd postal")}</label><input id="shipping-zip" name="zip" inputmode="numeric" maxlength="5" autocomplete="shipping postal-code" value="${escapeHtml(current.zip || "")}"></div></div></div>`}<p class="form-error" role="alert">${state.error || ""}</p>${actions(state.busy ? L("Requesting…", "Solicitando…", "N ap mande…") : L("Request my monitor", "Solicitar mi monitor", "Mande aparèy mwen an"), true, "", state.busy)}</form>`;
}

function accessBpFulfillmentConfirmed() {
  const cuffPending = state.cuffSelectionStatus === "NEEDS_ASSISTANCE";
  return `${art("check", true)}${titleBlock(L("Your monitor is being prepared", "Su monitor está siendo preparado", "Y ap prepare aparèy ou a"), L("ITERA will prepare your monitor and send it to the address you confirmed.", "ITERA preparará su monitor y lo enviará a la dirección que confirmó.", "ITERA ap prepare aparèy ou a epi voye li nan adrès ou konfime a."))}${rows([["check", L("Request received", "Solicitud recibida", "Nou resevwa demann lan"), ""], [cuffPending ? "clock" : "check", cuffPending ? L("We’ll confirm the cuff size with you", "Confirmaremos el tamaño del brazalete con usted", "N ap konfime gwosè manchèt la avèk ou") : L("Cuff information recorded", "Información del brazalete registrada", "Enfòmasyon manchèt la anrejistre"), ""], ["check", L("Address confirmed", "Dirección confirmada", "Adrès konfime"), ""]])}<aside class="note">${icon("check")}<p>${L("You can keep setting up your care while you wait for the monitor.", "Puede seguir configurando su cuidado mientras espera el monitor.", "Ou ka kontinye mete swen ou anplas pandan w ap tann aparèy la.")}</p></aside><div class="actions stacked-actions">${cta(L("See my health goals", "Ver mis objetivos de salud", "Wè objektif sante mwen yo"))}${cta(L("I’ll do this later", "Lo haré más tarde", "M ap fè sa pita"), "bp-defer-health-check", true)}</div><p class="form-error" role="alert">${state.error || ""}</p>`;
}

function accessBpDeviceResult() {
  const last4 = state.last4DeviceId || state.assignedDeviceId.slice(-4);
  const assignedDeviceCard = `<section class="verified-phone-status assigned-device-status">${icon("check")}<span><strong>${state.deviceModel || L("Connected blood pressure monitor", "Monitor de presión arterial conectado", "Aparèy tansyon konekte")}</strong><small>${L(`Device ending in ${last4}`, `Dispositivo terminado en ${last4}`, `Aparèy ki fini ak ${last4}`)}</small></span></section>`;
  if (state.deviceVerificationStatus === "ASSIGNED" && state.deviceUncertaintyStep) {
    const options = [
      ["matches", "check", L("Yes, it matches", "Sí, coincide", "Wi, li koresponn")],
      ["different", "device", L("No, it doesn’t match", "No, no coincide", "Non, li pa koresponn")],
      ["help", "question", L("I need help", "Necesito ayuda", "Mwen bezwen èd")]
    ];
    return `${art("question")}${titleBlock(L("Check the label on your monitor", "Revise la etiqueta de su monitor", "Gade etikèt ki sou aparèy ou a"), L(`Look for a device number ending in ${last4}.`, `Busque un número de dispositivo terminado en ${last4}.`, `Chèche yon nimewo aparèy ki fini ak ${last4}.`))}${assignedDeviceCard}<form id="assigned-device-confirmation-form" class="choice-list device-confirmation-options">${options.map(([value, itemIcon, label]) => choice(value, itemIcon, label, "", state.patientDeviceConfirmationChoice === value)).join("")}</form><p class="form-error" role="alert">${state.error || ""}</p>${actions(t().continue, true, "", !state.patientDeviceConfirmationChoice)}`;
  }
  if (state.deviceVerificationStatus === "ASSIGNED") {
    const options = [
      ["yes", "check", L("Yes, this is my monitor", "Sí, este es mi monitor", "Wi, se aparèy mwen an")],
      ["no", "device", L("No, I have a different monitor", "No, tengo un monitor diferente", "Non, mwen gen yon lòt aparèy")],
      ["unsure", "question", L("I’m not sure", "No estoy seguro", "Mwen pa sèten")]
    ];
    return `${art("check", true)}${titleBlock(L("Your monitor is connected to ITERA", "Su monitor está conectado a ITERA", "Aparèy ou konekte ak ITERA"), L("We found the monitor assigned to your care.", "Encontramos el monitor asignado a su cuidado.", "Nou jwenn aparèy ki te asiyen pou swen ou."))}${assignedDeviceCard}<h2 class="device-confirmation-question">${L("Is this the monitor you have with you?", "¿Este es el monitor que tiene con usted?", "Èske se aparèy sa a ou genyen avèk ou?")}</h2><form id="assigned-device-confirmation-form" class="choice-list device-confirmation-options">${options.map(([value, itemIcon, label]) => choice(value, itemIcon, label, "", state.patientDeviceConfirmationChoice === value)).join("")}</form><p class="form-error" role="alert">${state.error || ""}</p>${actions(t().continue, true, "", !state.patientDeviceConfirmationChoice)}`;
  }
  if (state.deviceVerificationStatus === "DEVICE_MISMATCH") return `${art("device")}${titleBlock(L("Let’s check the monitor you have", "Revisemos el monitor que tiene", "Ann verifye aparèy ou genyen an"), L("The monitor assigned to your care does not match the one you have with you.", "El monitor asignado a su cuidado no coincide con el que tiene con usted.", "Aparèy ki asiyen pou swen ou a pa koresponn ak aparèy ou genyen an."))}<div class="actions stacked-actions">${cta(L("I’m using my own monitor", "Estoy usando mi propio monitor", "M ap itilize pwòp aparèy mwen"), "bp-device-mismatch-owned")}${cta(L("I need help", "Necesito ayuda", "Mwen bezwen èd"), "bp-device-verification-help", true)}</div>`;
  if (state.deviceVerificationStatus === "SOURCE_MISMATCH") return `${art("question")}${titleBlock(L("We need to verify your monitor", "Necesitamos verificar su monitor", "Nou bezwen verifye aparèy ou a"), L("The first reading came from a different monitor than the one confirmed for your care.", "La primera medición provino de un monitor diferente al confirmado para su cuidado.", "Premye mezi a soti nan yon lòt aparèy pase sa ki te konfime pou swen ou a."))}<aside class="note">${icon("people")}<div><strong>${L("Your care team will review this", "Su equipo de atención revisará esto", "Ekip swen ou a pral revize sa")}</strong><p>${L("Your reading was not used as your ACCESS starting point.", "Su medición no se utilizó como punto de partida de ACCESS.", "Nou pa t itilize mezi a kòm pwen depa ACCESS ou.")}</p></div></aside><div class="actions stacked-actions">${cta(L("Get help from my care team", "Obtener ayuda de mi equipo", "Jwenn èd nan men ekip swen mwen"), "bp-device-verification-help")}${cta(L("Try again later", "Intentar de nuevo más tarde", "Eseye ankò pita"), "bp-continue-with-help", true)}</div>`;
  if (["NEEDS_REVIEW", "INACTIVE"].includes(state.deviceVerificationStatus)) return `${art("question")}${titleBlock(L("We need to check your monitor", "Necesitamos verificar su monitor", "Nou bezwen verifye aparèy ou a"), L("We found a monitor assigned to your care, but we couldn’t confirm its connection right now.", "Encontramos un monitor asignado a su cuidado, pero no pudimos confirmar su conexión en este momento.", "Nou jwenn yon aparèy ki asiyen pou swen ou, men nou pa t kapab konfime koneksyon li kounye a."))}<div class="actions stacked-actions">${cta(L("Try again", "Intentar de nuevo", "Eseye ankò"), "bp-retry-assignment")}${cta(L("Talk with my care team", "Hablar con mi equipo", "Pale ak ekip swen mwen an"), "bp-care-team-help", true)}</div>`;
  if (state.deviceVerificationStatus === "UNSUPPORTED") return `${art("device")}${titleBlock(L("Let’s get you a connected monitor", "Obtengamos un monitor conectado para usted", "Ann jwenn yon aparèy konekte pou ou"), L("Your current monitor may still be useful for your personal care, but your ACCESS readings need to come from a monitor that can securely send readings to ITERA HEALTH.", "Su monitor actual puede seguir siendo útil para su cuidado personal, pero sus mediciones de ACCESS deben provenir de un monitor que pueda enviarlas de forma segura a ITERA HEALTH.", "Aparèy ou genyen an ka toujou itil pou swen pèsonèl ou, men mezi ACCESS ou yo dwe soti nan yon aparèy ki ka voye mezi yo bay ITERA HEALTH an sekirite."))}<p class="device-result-support">${L("We can help arrange a connected monitor for you.", "Podemos ayudarle a obtener un monitor conectado.", "Nou ka ede fè aranjman pou yon aparèy konekte pou ou.")}</p><div class="actions stacked-actions">${cta(L("Get a connected monitor", "Obtener un monitor conectado", "Jwenn yon aparèy konekte"), "bp-request-device")}${cta(L("Talk with my care team", "Hablar con mi equipo", "Pale ak ekip swen mwen an"), "bp-care-team-help", true)}</div>`;
  return `${art("question")}${titleBlock(L("We need to check your monitor", "Necesitamos verificar su monitor", "Nou bezwen verifye aparèy ou a"), L("Your care team can help confirm the next step.", "Su equipo puede ayudarle a confirmar el próximo paso.", "Ekip swen ou ka ede konfime pwochen etap la."))}<div class="actions stacked-actions">${cta(L("Try again", "Intentar de nuevo", "Eseye ankò"), "bp-retry-assignment")}${cta(L("Talk with my care team", "Hablar con mi equipo", "Pale ak ekip swen mwen an"), "bp-care-team-help", true)}</div>`;
}

function accessBpGuidedSetup() {
  const steps = [
    [L("Sit and rest for 5 minutes", "Siéntese y descanse durante 5 minutos", "Chita epi repoze pandan 5 minit"), L("Keep your back supported and don’t talk.", "Mantenga la espalda apoyada y no hable.", "Kenbe do ou apiye epi pa pale.")],
    [L("Place the cuff on your bare arm", "Coloque el brazalete sobre el brazo descubierto", "Mete manchèt la sou bra ou san rad"), L("Use your upper arm.", "Use la parte superior del brazo.", "Itilize pati anwo bra ou.")],
    [L("Keep both feet flat on the floor", "Mantenga ambos pies apoyados en el piso", "Kenbe toude pye ou plat atè"), L("Don’t cross your legs.", "No cruce las piernas.", "Pa kwaze janm ou.")],
    [L("Support your arm at heart level", "Apoye el brazo a la altura del corazón", "Apiye bra ou nan nivo kè ou"), L("Keep it relaxed during the reading.", "Manténgalo relajado durante la medición.", "Kenbe li rilaks pandan mezi a.")]
  ];
  return `${art("device")}${titleBlock(L("Prepare your monitor", "Prepare su monitor", "Prepare aparèy ou a"), L("Follow these steps to get an accurate reading.", "Siga estos pasos para obtener una medición precisa.", "Swiv etap sa yo pou jwenn yon mezi egzak."))}<ol class="instruction-list detailed-instructions">${steps.map(([title, body], index) => `<li><b>${index + 1}</b><span><strong>${title}</strong><small>${body}</small></span></li>`).join("")}</ol>${actions(L("I’m ready", "Estoy listo", "Mwen pare"))}`;
}

function accessBpMeasurement() {
  const readingCount = state.bpBaselineReadingCount || state.bpReadingCount || 0;
  const remaining = Math.max(0, (state.bpBaselineRequiredReadings || 3) - readingCount);
  const received = state.bpMeasurementPhase === "RECEIVED" && readingCount > 0;
  const failed = state.error === "bp-reading";
  if (received) return `${art("check", true)}${titleBlock(L("Your monitor is connected", "Su monitor está conectado", "Aparèy ou konekte"), L("We received your blood pressure reading successfully.", "Recibimos correctamente su medición de presión arterial.", "Nou resevwa mezi tansyon ou avèk siksè."))}<section class="reading-card bp-reading-status baseline-progress-card"><strong>${L(`${readingCount} of 3 readings received for your starting blood pressure`, `${readingCount} de 3 mediciones recibidas para establecer su presión arterial inicial`, `${readingCount} sou 3 mezi resevwa pou tansyon kòm pwen depa ou`)}</strong><p>${L(`${remaining} readings remaining`, `${remaining} mediciones pendientes`, `${remaining} mezi ki rete`)}</p></section><aside class="note">${icon("clock")}<div><strong>${L("You can take the remaining readings later.", "Puede realizar las otras mediciones más adelante.", "Ou ka pran lòt mezi yo pita.")}</strong><p>${L("We’ll keep track automatically.", "Las recibiremos automáticamente.", "N ap suiv yo otomatikman.")}</p></div></aside>${actions(t().continue)}`;
  const actionLabel = failed ? L("Try receiving this reading again", "Intentar recibir esta medición nuevamente", "Eseye resevwa mezi sa a ankò") : L("I took my reading", "Ya tomé mi medición", "Mwen pran mezi mwen an");
  return `${art("heart")}${titleBlock(L("Let’s test your monitor", "Probemos su monitor", "Ann teste aparèy ou a"), L("Take one blood pressure reading so we can confirm your monitor is connected and sending readings correctly.", "Tome una medición de presión arterial para confirmar que su monitor está conectado y enviando las lecturas correctamente.", "Pran yon mezi tansyon pou nou ka konfime aparèy ou konekte epi l ap voye mezi yo kòrèkteman."))}<section class="reading-card bp-reading-status"><strong>${state.busy ? L("Waiting for your reading…", "Esperando su medición…", "N ap tann mezi ou a…") : L("Waiting for your reading…", "Esperando su medición…", "N ap tann mezi ou a…")}</strong></section><aside class="note">${icon("wifi")}<div><strong>${L("Your monitor will send the reading automatically.", "Su monitor enviará la medición automáticamente.", "Aparèy ou a ap voye mezi a otomatikman.")}</strong><p>${L("You don’t need to enter the numbers.", "No necesita escribir los números.", "Ou pa bezwen antre chif yo.")}</p></div></aside>${failed ? `<aside class="error-card" role="alert">${icon("info")}<span><strong>${L("We didn’t receive your reading", "No recibimos su medición", "Nou pa t resevwa mezi ou a")}</strong><small>${L("Check your monitor and try again.", "Revise su monitor e inténtelo nuevamente.", "Verifye aparèy ou a epi eseye ankò.")}</small></span></aside>` : ""}${actions(state.busy ? L("Waiting…", "Esperando…", "N ap tann…") : actionLabel, true, "", state.busy)}`;
}

function accessBpBaselineResult() {
  const baseline = state.bpBaseline || {};
  return `${art("check", true)}${titleBlock(L("Your starting blood pressure is ready", "Su presión arterial inicial está lista", "Tansyon ou kòm pwen depa pare"), L("We received your readings, and your care team will review them to personalize your care.", "Recibimos sus mediciones y su equipo de cuidado las revisará para personalizar su cuidado.", "Nou resevwa mezi ou yo, epi ekip swen ou ap revize yo pou pèsonalize swen ou."))}${Number.isFinite(baseline.averageSystolic) ? `<section class="reading-card"><small>${L("Starting blood pressure", "Presión arterial inicial", "Tansyon kòm pwen depa")}</small><strong>${baseline.averageSystolic} / ${baseline.averageDiastolic} <em>mmHg</em></strong><p>${L("Average of 3 readings", "Promedio de 3 mediciones", "Mwayèn 3 mezi")}</p></section>` : ""}${cta(L("Go to my dashboard", "Ir a mi panel", "Ale nan tablodbò mwen an"), "finish")}`;
}

function accessBpEscalation() {
  return `${art("phone")}${titleBlock(L("Your care team is reviewing your readings", "Su equipo de cuidado está revisando sus mediciones", "Ekip swen ou ap revize mezi ou yo"), L("A reading needs clinical follow-up. We’ve notified your care team.", "Una medición necesita seguimiento clínico. Hemos avisado a su equipo de cuidado.", "Yon mezi bezwen swivi klinik. Nou avèti ekip swen ou."))}<aside class="note">${icon("phone")}<div><strong>${L("Follow your care team’s instructions", "Siga las instrucciones de su equipo de cuidado", "Swiv enstriksyon ekip swen ou")}</strong><p>${L("If you have emergency symptoms, call 911.", "Si tiene síntomas de emergencia, llame al 911.", "Si ou gen sentòm ijans, rele 911.")}</p></div></aside>${cta(L("Continue", "Continuar", "Kontinye"), "finish")}`;
}

function rpmDevice() {
  return `${art("device")}${titleBlock(L("Let’s prepare your home monitor", "Preparemos su monitor en casa", "Ann prepare monitè lakay ou"), L("Your care team recommended a connected blood pressure monitor.", "Su equipo recomendó un monitor conectado de presión arterial.", "Ekip swen w lan rekòmande yon monitè tansyon ki konekte."))}<form class="choice-list">${choice("owned", "heart", L("I already have a monitor", "Ya tengo un monitor", "Mwen deja gen yon monitè"), L("We’ll check whether it can securely send readings", "Verificaremos si puede enviar lecturas", "Nou pral tcheke si li ka voye lekti san danje"), state.devicePath === "owned")}${choice("ship", "box", L("I need a monitor from ITERA", "Necesito un monitor de ITERA", "Mwen bezwen yon monitè nan ITERA"), L("We’ll arrange one for you", "Le enviaremos uno", "Nou pral fè aranjman pou youn pou ou"), state.devicePath === "ship")}${choice("help", "question", L("I’m not sure", "No estoy seguro", "Mwen pa sèten"), L("Talk with our care team", "Hable con nuestro equipo", "Pale ak ekip swen nou an"))}</form>${actions(t().continue)}`;
}

function shipping() {
  return `${art("box")}${titleBlock(L("Where should we send your monitor?", "¿Dónde debemos enviar su monitor?", "Ki kote nou ta dwe voye monitè ou a?"), L("We have this address on file:", "Tenemos esta dirección:", "Nou gen adrès sa a nan dosye a:"))}<address class="address-card">${icon("home")}<strong>1250 Palm Avenue<br>Apartment 4B<br>Miami, FL 33130</strong></address><form class="choice-list">${choice("correct", "check", L("This address is correct", "Esta dirección es correcta", "Adrès sa a kòrèk"), "", true)}${choice("changed", "document", L("Use a different address", "Usar otra dirección", "Sèvi ak yon adrès diferan"), "")}</form><p class="security">${icon("lock")} ${L("Shipping is included", "El envío está incluido", "Shipping enkli")}</p>${actions(t().continue)}`;
}

function deviceSetup() {
  return `${art("device")}${titleBlock(L("Set up your monitor", "Configure su monitor", "Mete sou pye monitè ou"), L("We’ll help you connect it and take accurate readings.", "Le ayudaremos a conectarlo y tomar lecturas precisas.", "Nou pral ede w konekte li epi pran lekti egzat."), L("Home monitoring setup", "Configuración del monitoreo", "Konfigirasyon siveyans lakay ou"))}<ol class="instruction-list"><li><b>1</b><span>${L("Sit and rest for 5 minutes", "Siéntese y descanse 5 minutos", "Chita epi repoze pandan 5 minit")}</span></li><li><b>2</b><span>${L("Place the cuff on your bare upper arm", "Coloque el brazalete sobre el brazo descubierto", "Mete manchèt la sou bra anwo w la")}</span></li><li><b>3</b><span>${L("Keep your feet flat and arm supported", "Mantenga los pies apoyados y el brazo sostenido", "Kenbe pye ou plat ak bra sipòte")}</span></li><li><b>4</b><span>${L("Press Start and stay still", "Presione inicio y no se mueva", "Peze Kòmanse epi rete toujou")}</span></li></ol>${cta(L("My monitor is connected", "Mi monitor está conectado", "Monitè mwen konekte"))}<button class="button secondary" data-action="help">${L("I need help", "Necesito ayuda", "Mwen bezwen èd.")}</button>`;
}

function firstReading() {
  const failed = state.error === "reading";
  return `${art("wifi")}${titleBlock(L("Send your first connected reading", "Envíe su primera lectura conectada", "Voye premye lekti konekte ou"), L("Take a blood pressure reading with your connected monitor.", "Tome una lectura con su monitor conectado.", "Pran yon lekti san presyon ak monitè konekte ou."))}${failed ? `<aside class="error-card" role="alert">${icon("info")}<span><strong>${L("We haven’t received a reading", "No hemos recibido una lectura", "Nou pa te resevwa yon lekti")}</strong><small>${L("Check that the monitor is on and nearby, then try again.", "Compruebe que el monitor esté encendido y cerca, e inténtelo de nuevo.", "Tcheke si monitè a sou ak tou pre, Lè sa a, eseye ankò.")}</small></span></aside>` : `<div class="waiting"><span class="pulse-ring"></span><strong>${L("Waiting for your monitor…", "Esperando su monitor…", "Ap tann pou monitè ou...")}</strong><small>${L("Keep this page open while the reading sends securely.", "Mantenga esta página abierta mientras se envía la lectura.", "Kenbe paj sa a ouvè pandan lekti a voye san danje.")}</small></div>`}${actions(failed ? L("Try again", "Intentar de nuevo", "Eseye ankò") : L("I took my reading", "Tomé mi lectura", "Mwen te pran lekti mwen"), false, L("Troubleshoot my monitor", "Solucionar problema", "Rezoud pwoblèm monitè mwen an"))}`;
}

function monitoringReady() {
  return `${art("check", true)}${titleBlock(L("Home monitoring is ready", "El monitoreo en casa está listo", "Siveyans lakay ou pare"), L("We securely received your first connected reading.", "Recibimos de forma segura su primera lectura conectada.", "Nou te resevwa san danje premye lekti ou konekte."))}<section class="reading-card"><small>${L("Your first reading", "Su primera lectura", "Premye lekti ou")}</small><strong>${state.reading?.systolic || 120} / ${state.reading?.diastolic || 80} <em>mmHg</em></strong></section><section class="next-card"><h2>${L("What happens next?", "¿Qué sigue?", "Kisa ki rive apre sa?")}</h2>${rows([["calendar", L("Take readings as directed by your care team", "Tome lecturas según le indiquen", "Pran lekti jan ekip swen w la mande sa"), ""], ["chart", L("ITERA reviews your transmitted readings", "ITERA revisa sus lecturas transmitidas", "ITERA revize lekti transmèt ou yo"), ""], ["shield", L("This service is not for emergencies", "Este servicio no es para emergencias", "Sèvis sa a se pa pou ijans"), ""]])}</section>${cta(L("Go to my dashboard", "Ir a mi panel", "Ale nan tablodbò mwen an"), "finish")}<button class="text-button" data-action="help">${L("Talk with my care team", "Hablar con mi equipo", "Pale ak ekip swen mwen an")}</button>${shareAccessPrompt(GROWTH_MOMENTS.FIRST_READING_RECEIVED)}`;
}

// The ACCESS care plan. Not a document: the same records the patient has been building, shown
// together — the goals the track assigned, where each one starts, how ACCESS will judge it, the
// monitor being arranged and the people involved. Everything here is read from runtime, so a plan
// can only ever claim what actually happened.
// What each intervention is, said as the patient would recognize it. The model's type names are
// internal; "DEVICE_SUPPORT_TASK" is not something anybody asked for by name.
const interventionPatientLabel = type => ({
  REMINDER: L("Reminders to help you remember", "Recordatorios para ayudarle a recordar", "Rapèl pou ede w sonje"),
  ROUTINE_ADJUSTMENT: L("Help fitting this into your day", "Ayuda para ajustarlo a su día", "Èd pou fè sa antre nan jounen ou"),
  EDUCATION: L("Guidance from EMMI whenever you need it", "Orientación de EMMI cuando la necesite", "Gid EMMI lè ou bezwen l"),
  DEVICE_GUIDANCE: L("Step-by-step help with your monitor", "Ayuda paso a paso con su monitor", "Èd etap pa etap ak aparèy ou"),
  DEVICE_SUPPORT_TASK: L("Device support from your care team", "Soporte de dispositivo de su equipo", "Sipò aparèy nan men ekip swen ou"),
  CARE_CIRCLE: L("Support from someone you trust", "Apoyo de alguien de confianza", "Sipò yon moun ou fè konfyans"),
  PLAN_ADJUSTMENT: L("An adjustment to how your plan fits you", "Un ajuste para que su plan se adapte a usted", "Yon ajisteman pou plan ou anfòm ak ou"),
  RESOURCE_SUPPORT: L("Help finding the right resources", "Ayuda para encontrar recursos", "Èd pou jwenn bon resous yo"),
  LANGUAGE_SUPPORT: L("Support in your language", "Apoyo en su idioma", "Sipò nan lang ou"),
  APPOINTMENT_COORDINATION: L("Help arranging an appointment", "Ayuda para coordinar una cita", "Èd pou òganize yon randevou"),
  CARE_TEAM_TASK: L("A follow-up from your care team", "Un seguimiento de su equipo de cuidado", "Yon swivi nan men ekip swen ou"),
  SAFETY_ESCALATION: L("A review by your care team", "Una revisión de su equipo de cuidado", "Yon revizyon nan men ekip swen ou")
})[type] || "";

function accessCarePlanReady() {
  const runtime = careActivationRuntime();
  const goals = assignedAccessGoals(state.offer).map(goalType => {
    const point = patientStartingPoint(goalType, runtime);
    const measure = accessProgressMeasure(goalType, point);
    const rows = accessMeasureMarkup(goalType, measure);
    const nextSteps = suggestedActionsFor(goalType).slice(0, 3)
      .map(action => `<li>${icon(goalActionIcon(action.id))}<span>${escapeHtml(localGoalText(action.title, state.language))}</span></li>`).join("");
    return `<article class="access-plan-goal">
      <header>${icon(resolveGoalIcon({ goalType }))}<h3>${escapeHtml(localGoalText(GOAL_CONFIG[goalType].displayName, state.language))}</h3></header>
      <section class="access-goal-baseline"><h4>${L("Your starting point", "Su punto de partida", "Pwen depa ou")}</h4>${accessStartingPointBody(goalType, point)}</section>
      <section class="access-goal-measure"><h4>${L("How ACCESS measures progress", "Cómo ACCESS mide su progreso", "Kijan ACCESS mezire pwogrè")}</h4>${rows}</section>
      <section class="access-goal-plan"><h4>${L("Next steps", "Próximos pasos", "Pwochen etap yo")}</h4><ul>${nextSteps}</ul></section>
    </article>`;
  }).join("");

  // Only the two states the runtime can actually be in. Shipped, delivered and connected are real
  // milestones, and claiming one before a fulfillment response says so is the kind of promise a
  // patient plans their week around.
  const requested = state.deviceFulfillmentStatus === "REQUESTED";
  const deviceStatus = requested
    ? L("Requested — we’ll keep you updated", "Solicitado: le mantendremos informado", "Mande — n ap kenbe w enfòme")
    : L("Not requested yet", "Aún no solicitado", "Poko mande");
  // Named for what actually happened. Barriers are recorded here; applying real interventions is
  // a separate step, and until it runs nothing has been "added" for the patient at all.
  // What actually started, deduplicated: two goals can both open a reminder, and the patient wants
  // to know reminders exist, not read the word twice.
  const supportAdded = [...new Map(activePatientGoals()
    .flatMap(goal => (goal.barriers || []).filter(barrierIsActive))
    .flatMap(barrier => (barrier.interventions || []).map(item => item.type))
    .filter(type => interventionPatientLabel(type))
    .map(type => [type, type])).values()];
  const supportCard = supportAdded.length ? `<section class="access-plan-block"><h2>${L("Support we added for you", "Apoyo que agregamos para usted", "Sipò nou ajoute pou ou")}</h2><ul class="access-plan-support">${supportAdded.map(type => `<li>${icon("check")}<span>${interventionPatientLabel(type)}</span></li>`).join("")}</ul></section>` : "";
  const planCard = `<section class="access-plan-block"><h2>${L("Your care plan", "Su plan de cuidado", "Plan swen ou")}</h2><div class="access-plan-device">${icon("plan")}<div><strong>${L("Active", "Activo", "Aktif")}</strong><p>${L("Your ACCESS care plan is in place and will be updated as your care continues.", "Su plan de cuidado ACCESS está activo y se actualizará conforme avance su cuidado.", "Plan swen ACCESS ou a anplas epi l ap mete ajou pandan swen ou ap kontinye.")}</p></div></div></section>`;
  const deviceCard = `<section class="access-plan-block"><h2>${L("Your connected tool", "Su herramienta conectada", "Zouti konekte ou a")}</h2><div class="access-plan-device">${icon("device")}<div><strong>${L("Blood pressure monitor", "Monitor de presión arterial", "Aparèy tansyon")}</strong><p>${deviceStatus}</p></div></div></section>`;

  const team = patientCareTeam().slice(0, 4).map(member =>
    `<li>${careTeamMemberAvatar(member)}<span><strong>${escapeHtml(member.displayName)}</strong><small>${escapeHtml(careTeamRoleLabel(member))}</small></span></li>`).join("");
  const teamCard = team ? `<section class="access-plan-block"><h2>${L("Connected with your care team", "Conectado con su equipo de cuidado", "Konekte ak ekip swen ou")}</h2><ul class="access-plan-team">${team}</ul></section>` : "";

  return `${art("check", true)}${titleBlock(L("Your ACCESS care is ready", "Su cuidado ACCESS está listo", "Swen ACCESS ou a pare"), L("Your goals, care plan, connected tools, and support are all in place.", "Sus objetivos, su plan de cuidado, sus herramientas conectadas y su apoyo ya están listos.", "Objektif ou yo, plan swen ou, zouti konekte ou yo ak sipò ou tout anplas."))}
    <section class="access-plan-block"><h2>${L("Your health goals", "Sus objetivos de salud", "Objektif sante ou yo")}</h2><div class="access-plan-goals">${goals}</div></section>
    ${deviceCard}${planCard}${supportCard}${teamCard}
    ${shareAccessPrompt(GROWTH_MOMENTS.GETTING_STARTED_COMPLETED)}
    ${cta(L("Go to My Care", "Ir a Mi cuidado", "Ale nan Swen mwen"), "finish")}`;
}

// Support needs, not a care plan builder. The goals are assigned, the targets come from ACCESS and
// the plan is already active — the only thing still unknown is what might stop the patient
// following it. So this asks one question per goal, offers only difficulties the product can
// actually act on, and creates nothing when the answer is that nothing is in the way.
// Every barrier category in the model declares its own interventions, in order, with an owner. The
// first one is the model's own answer to that difficulty, so it is the one that starts — applying
// all four for a forgotten routine would bury the patient in help nobody asked for. Nothing is
// invented here: a category with no interventions configured would simply start none.
function applyFirstIntervention(barrier, now) {
  const [type] = barrierCategoryConfig(barrier.category).interventions || [];
  return type ? applyIntervention(barrier, { type, detail: { source: "CARE_ACTIVATION" }, now }) : barrier;
}

function accessSupportNeeds() {
  const assignedGoals = assignedAccessPatientGoals();
  const pendingGoals = assignedGoals.filter(goal => !accessGoalSupportIsComplete(goal));
  // A partial review resumes only what is still unanswered. Once every goal is complete, reopening
  // the section becomes a review: all saved answers are shown instead of an empty questionnaire.
  const goals = pendingGoals.length ? pendingGoals : assignedGoals;
  const groups = goals.map(goal => {
    // A goal that was just assigned has no actions yet — those arrive when a plan is personalized —
    // and barrierOptionsFor reads action templates to decide what to offer. Without the goal's own
    // suggested actions standing in, the weight goal offered nothing about eating, moving or
    // weighing, which is most of what makes that goal hard.
    const withActions = (goal.actions || []).length ? goal : { ...goal, actions: suggestedActionsFor(goal.goalType).map(action => ({ templateId: action.id })) };
    const options = barrierOptionsFor({ goal: withActions, hasDevice: barrierCapabilities().hasDevice, hasMedications: Boolean((state.careMedications || []).length), locale: state.language })
      .filter(option => option.category !== "OTHER");
    const name = escapeHtml(localGoalText(GOAL_CONFIG[goal.goalType].displayName, state.language));
    const selected = new Set(state.supportNeedsDraft?.[goal.id] || accessSupportAssessment(goal).selectedCategories);
    const choices = options.map(option => `<label class="support-need-option"><input type="checkbox" name="barrier:${goal.id}" value="${option.category}" ${selected.has(option.category) ? "checked" : ""}><span>${icon(option.icon)}<span>${escapeHtml(option.label)}</span></span></label>`).join("");
    return `<fieldset class="support-need-group" data-goal-id="${escapeHtml(goal.id)}"><input type="hidden" name="supportGoalId" value="${escapeHtml(goal.id)}"><legend>${name}</legend><p class="support-need-question">${L("Anything that could make this goal harder?", "¿Algo que pueda dificultar esta meta?", "Èske gen anyen ki ka fè objektif sa a pi difisil?")}</p><div class="support-need-options">${choices}<label class="support-need-option support-need-none"><input type="checkbox" name="barrier:${goal.id}" value="NONE" ${selected.has("NONE") ? "checked" : ""}><span>${icon("check")}<span>${L("Nothing right now", "Nada por ahora", "Anyen pou kounye a")}</span></span></label></div></fieldset>`;
  }).join("");
  return `${art("people")}${titleBlock(L("Is anything making your care harder?", "¿Hay algo que dificulte su cuidado?", "Èske gen yon bagay ki fè swen ou pi difisil?"), L("Tell us if there’s anything that could make it harder to follow your care plan. We can help you find the right support.", "Díganos si hay algo que pueda dificultar seguir su plan de cuidado. Podemos ayudarle a encontrar el apoyo adecuado.", "Di nou si gen yon bagay ki ka fè li pi difisil pou swiv plan swen ou. Nou ka ede w jwenn bon sipò a."), L("Your ACCESS care", "Su cuidado ACCESS", "Swen ACCESS ou"))}
    <form id="support-needs-form">${groups}
    <label class="field support-need-other">${L("Anything else? (optional)", "¿Algo más? (opcional)", "Yon lòt bagay? (opsyonèl)")}<textarea name="otherConcern" rows="2" maxlength="280">${escapeHtml(state.supportNeedsOther || "")}</textarea></label>
    </form><p class="form-error" role="alert">${state.error || ""}</p>${actions(pendingGoals.length ? t().continue : L("Save changes", "Guardar cambios", "Sove chanjman yo"))}`;
}

function onboardingComplete() {
  // ACCESS ends on a care plan; every other program still ends on this screen, which is right for
  // them because they did not just build one.
  if (state.offer?.pathway === "ACCESS") return accessCarePlanReady();
  const doctorCopy = state.offer?.physician?.displayName ? L(`You continue working with ${state.offer.physician.displayName}`, `Continúa trabajando con ${state.offer.physician.displayName}`, `Ou kontinye travay avèk ${state.offer.physician.displayName}`) : L("You continue working with your doctors", "Continúa trabajando con sus médicos", "Ou kontinye travay avèk doktè ou yo");
  return `${art("check", true)}${titleBlock(L("You’re off to a great start", "Ha comenzado muy bien", "Ou ap ale nan yon gwo kòmanse"), L("We saved your information and will use it to personalize your care.", "Guardamos su información y la usaremos para personalizar su cuidado.", "Nou sove enfòmasyon ou yo epi nou pral itilize li pou pèsonalize swen ou yo."))}<section class="next-card"><h2>${L("What happens next?", "¿Qué sigue?", "Kisa ki rive apre sa?")}</h2>${rows([["people", L("Your ITERA care team reviews your information", "Su equipo ITERA revisa su información", "Ekip swen ITERA w la revize enfòmasyon w yo"), ""], ["phone", L("We contact you with any follow-up questions", "Le contactaremos si hay preguntas", "Nou kontakte ou ak nenpòt kesyon swivi"), ""], ["doctor", doctorCopy, ""]])}</section>${cta(L("Go to my dashboard", "Ir a mi panel", "Ale nan tablodbò mwen an"), "finish")}<button class="text-button" data-action="help">${L("Talk with my care team", "Hablar con mi equipo", "Pale ak ekip swen mwen an")}</button>${shareAccessPrompt(GROWTH_MOMENTS.GETTING_STARTED_COMPLETED)}`;
}

function callbackConfirmed() { return `${art("phone", true)}${titleBlock(L("We’ll call you", "Le llamaremos", "Nou pral rele ou"), L(`A care team member will call the number ending in ${state.offer.patient.phoneMasked.slice(-4)} within one business day.`, `Un miembro del equipo llamará al número terminado en ${state.offer.patient.phoneMasked.slice(-4)} dentro de un día hábil.`, `Yon manm ekip swen an ap rele nimewo ki fini nan ${state.offer.patient.phoneMasked.slice(-4)} nan yon sèl jou ouvrab.`))}${cta(L("Return to enrollment", "Volver a la inscripción", "Retounen nan enskripsyon an"), "return")}`; }

function stoppedOutcome() { return `${art("info")}${titleBlock(L("Your Medicare check is complete", "Su consulta con Medicare está completa", "Verifikasyon Medicare ou fini"), L("Your ACCESS journey stops here, but your Medicare benefits and regular care do not change.", "Su recorrido ACCESS termina aquí, pero sus beneficios y cuidado habitual no cambian.", "Pwosesis ACCESS ou a kanpe isit la, men benefis Medicare ou ak swen nòmal ou pa chanje."))}${cta(L("Done", "Listo", "Fini"), "finish")}<button class="text-button" data-action="help">${L("Talk with our care team", "Hablar con nuestro equipo", "Pale ak ekip swen nou an")}</button>`; }

function offerError() { const expired = state.screen === "OFFER_EXPIRED"; return `${art(expired ? "clock" : "lock")}${titleBlock(expired ? L("This secure link has expired", "Este enlace seguro venció", "Lyen sekirite sa a ekspire") : L("We can’t open this secure link", "No podemos abrir este enlace seguro", "Nou pa ka louvri lyen sekirite sa a"), expired ? L("For your privacy, invitation links are available for a limited time.", "Por su privacidad, los enlaces están disponibles por tiempo limitado.", "Pou pwoteje vi prive ou, lyen envitasyon yo disponib pou yon tan limite.") : L("The link may be incomplete or already used.", "El enlace puede estar incompleto o ya haberse usado.", "Lyen an ka pa konplè oswa li ka deja itilize."))}<a class="button primary" href="tel:+13053948070">${L("Call ITERA HEALTH", "Llamar a ITERA HEALTH", "Rele ITERA HEALTH")}</a><p class="contact-line">(305) 394-8070</p>`; }

const optionTags = (items, selected) => items.map(item => {
  const value = typeof item === "string" ? item : item.value;
  const label = typeof item === "string" ? item : item.label;
  return `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`;
}).join("");
const escapeHtml = value => String(value ?? "").replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);

function conditionValue() {
  const conditions = prototypeConfig.conditions || [];
  if (!conditions.length) return `<span class="condition-placeholder">Select conditions</span>`;
  if (conditions.length === 1) return `<span class="condition-chip">${conditions[0]}</span>`;
  if (conditions.length === 2) return conditions.map(condition => `<span class="condition-chip">${condition}</span>`).join("");
  return `<span class="condition-chip">${conditions[0]}</span><span class="condition-count">+${conditions.length - 1}</span>`;
}

function prototypeScenarioSummary() {
  const languageLabel = PROTOTYPE_OPTIONS.languages.find(item => item.value === prototypeConfig.language)?.label || prototypeConfig.language;
  const eligibilityLabel = PROTOTYPE_OPTIONS.accessEligibilityResults.find(item => item.value === prototypeConfig.accessEligibilityResult)?.label;
  const physicianRequired = scenarioRequiresPhysician(prototypeConfig.program, prototypeConfig.source);
  const deviceLabel = scenarioUsesBloodPressureMonitoring(prototypeConfig)
    ? ({ none: "No monitor", "itera-tenovi": "Tenovi monitor", "itera-pylo": "Pylo monitor", "patient-owned-unsupported": "Patient-owned monitor" }[prototypeConfig.bpDeviceScenario])
    : null;
  return [prototypeConfig.program, prototypeConfig.program === "ACCESS" ? prototypeConfig.accessTrack : null, prototypeConfig.source, physicianRequired ? prototypeConfig.physicianDisplayName : null, prototypeConfig.conditions.join(" + "), prototypeConfig.coverage, prototypeConfig.program === "ACCESS" ? eligibilityLabel : null, deviceLabel, languageLabel].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------------------------
// Simulated blood pressure readings (prototype only)
//
// The simulator produces observations; everything after that is the app's real path. A simulated
// reading is classified by the same classifyBloodPressure the rest of the app uses, lands in
// state.bpReadings like a device reading, and from there the goal runtime, the trend and EMMI's
// clinical context pick it up through code that has no idea a simulator exists. That is the point:
// what a tester watches is the real reaction, not a mock of one.
// ---------------------------------------------------------------------------------------------

let bpSimulator = null;
let bpSimulationTicker = null;
const bpSimulationSettings = { intervalMinutes: 2, seed: null };

// Same gate the rest of the prototype already uses, asked through the simulator's own predicate so
// the rule lives in one place and stays testable without a bundler.
const bpSimulationAllowed = () => emmiPrototypeIsSafe() && simulationAllowed({
  prototypeMode: EMMI_CONFIG.prototypeMode,
  allowRealPatientData: EMMI_CONFIG.allowRealPatientData
});

const bpSimulationStatus = () => bpSimulator?.status || SIMULATION_STATUS.OFF;
const simulatedReadings = () => (state.bpReadings || []).filter(reading => reading.isSimulated);

// One observation, one trip through the real engine. The simulator never says what a reading means.
async function ingestSimulatedBpObservation(observation) {
  const rules = DEMO_BP_MONITORING_RULES;
  const classification = classifyBloodPressure(observation, rules);
  if ((state.bpReadings || []).some(reading => reading.observationId === observation.observationId)) return;
  audit(state, "simulated_bp_generated", "success", {
    observationId: observation.observationId, simulationSessionId: observation.simulationSessionId,
    simulationSequence: observation.simulationSequence, systolic: observation.systolic, diastolic: observation.diastolic
  });
  const history = [...(state.bpReadings || [])];
  state.bpReadings = [...history, { ...observation, classification, monitoringRuleVersion: rules.version }];
  audit(state, "simulated_bp_classified", "success", {
    observationId: observation.observationId, classification, monitoringRuleVersion: rules.version,
    // Recorded side by side so a QA run can see when the engine disagreed with what the generator
    // aimed at -- a boundary reading is allowed to, and that is worth seeing rather than hiding.
    simulationTarget: observation.simulationTarget
  });
  // The point of the simulator is to exercise the real pipeline, so the observation carries on
  // into the monitoring engine exactly as a cuff reading would. Without this the readings were
  // only classified and stored, and everything worth watching -- repeated criticals correlating
  // into one alert instead of an alert storm, a worsening reading escalating, a calmer one not
  // closing an open episode -- never ran at all.
  const ingested = ingestBloodPressureObservation({
    observation,
    history,
    episode: state.bpMonitoringEpisode || null,
    rules
  });
  state.bpMonitoringEpisode = ingested.episode;
  if (ingested.alert) {
    audit(state, "simulated_alert_created", "success", {
      alertId: ingested.alert.id, episodeId: ingested.episode?.id, clinicalState: ingested.alert.state,
      severity: ingested.alert.severity, ruleVersion: ingested.alert.ruleVersion,
      action: ingested.action, isSimulated: true
    });
  }
  draftStore.save(state);
  render();
}

function ensureBpSimulator() {
  if (bpSimulator) return bpSimulator;
  bpSimulator = new BloodPressureSimulator({
    rules: DEMO_BP_MONITORING_RULES,
    intervalMs: Math.max(1, bpSimulationSettings.intervalMinutes) * 60 * 1000,
    seed: bpSimulationSettings.seed,
    onObservation: ingestSimulatedBpObservation
  });
  return bpSimulator;
}

// The countdown is the only thing that changes every second, so it updates its own node instead of
// re-rendering a console the tester may be typing into.
function startBpSimulationTicker() {
  stopBpSimulationTicker();
  bpSimulationTicker = setInterval(() => {
    const node = document.querySelector("#bp-simulation-countdown");
    if (!node) return;
    const remaining = bpSimulator?.msUntilNextReading();
    node.textContent = remaining == null ? "--:--" : formatCountdown(remaining);
  }, 1000);
}

function stopBpSimulationTicker() {
  if (bpSimulationTicker) clearInterval(bpSimulationTicker);
  bpSimulationTicker = null;
}

const formatCountdown = ms => {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

function startBpSimulation() {
  if (!bpSimulationAllowed()) return;
  const sessionId = ensureBpSimulator().start();
  startBpSimulationTicker();
  audit(state, "simulation_started", "success", { simulationSessionId: sessionId, intervalMinutes: bpSimulationSettings.intervalMinutes });
}

function stopBpSimulation({ silent = false } = {}) {
  if (!bpSimulator) return;
  const sessionId = bpSimulator.stop();
  stopBpSimulationTicker();
  if (!silent) audit(state, "simulation_stopped", "success", { simulationSessionId: sessionId, readings: simulatedReadings().length });
}

// Reset clears the simulated readings and nothing else. Real observations, if this scenario ever
// carried any, are left exactly where they are.
function resetBpSimulation() {
  stopBpSimulation({ silent: true });
  const removed = simulatedReadings().length;
  state.bpReadings = (state.bpReadings || []).filter(reading => !reading.isSimulated);
  // The episode only ever held simulated observations, so it goes with them.
  state.bpMonitoringEpisode = null;
  bpSimulator?.dispose();
  bpSimulator = null;
  audit(state, "simulation_reset", "success", { removedSimulatedReadings: removed });
  draftStore.save(state);
}

// A changed scenario is a different patient, and the next reading must not land on them.
function stopBpSimulationForScenarioChange() {
  if (!bpSimulator || bpSimulator.status !== SIMULATION_STATUS.RUNNING) return;
  audit(state, "simulation_stopped", "success", { reason: "scenario_changed", simulationSessionId: bpSimulator.sessionId });
  bpSimulator.dispose();
  bpSimulator = null;
  stopBpSimulationTicker();
}

// The console is an internal desktop tool, so this panel is English-only like the rest of it and
// never appears in the Patient Experience.
const SIMULATION_CLASSIFICATION_LABEL = {
  ACTION_NEEDED: "CRITICAL",
  NEEDS_REVIEW: "CAUTION",
  ABOVE_EXPECTED_RANGE: "ABOVE RANGE",
  WITHIN_EXPECTED_RANGE: "IN RANGE"
};

const simulationClockLabel = value => new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });

function bpSimulationPanel() {
  // Outside the prototype there is nothing to show and nothing that could be switched on.
  if (!bpSimulationAllowed()) return "";
  const status = bpSimulationStatus();
  const running = status === SIMULATION_STATUS.RUNNING;
  const readings = simulatedReadings();
  const latest = readings.at(-1);
  const remaining = bpSimulator?.msUntilNextReading();
  const statusCopy = { OFF: "Simulation off", READY: "Simulation ready", RUNNING: "Simulation running", STOPPED: "Simulation stopped" }[status];
  const rules = DEMO_BP_MONITORING_RULES;
  return `<section class="bp-simulation" data-simulation-status="${status}">
    <header class="bp-simulation-header">
      <div><h2>Simulated BP readings</h2><small>Demo and QA only. Readings are tagged and never leave the prototype.</small></div>
      <span class="bp-simulation-status"><i></i>${statusCopy}</span>
    </header>
    <div class="bp-simulation-controls">
      <label class="prototype-field"><span><b>Pattern</b><small>Generated, then classified by the monitoring rules</small></span>
        <select name="bpSimulationPattern" disabled><option>Random Caution + Critical</option></select></label>
      <label class="prototype-field"><span><b>Interval</b><small>Applies to the next start</small></span>
        <select name="bpSimulationInterval" ${running ? "disabled" : ""}>${[1, 2, 5].map(minutes => `<option value="${minutes}" ${bpSimulationSettings.intervalMinutes === minutes ? "selected" : ""}>Every ${minutes} minute${minutes === 1 ? "" : "s"}</option>`).join("")}</select></label>
    </div>
    <p class="bp-simulation-rules">Thresholds come from <code>${rules.version}</code>: review at ${rules.reviewAt.systolic}/${rules.reviewAt.diastolic}, action at ${rules.actionAt.systolic}/${rules.actionAt.diastolic}. The simulator generates a reading; the monitoring engine decides what it means.</p>
    <div class="bp-simulation-actions">
      ${running
        ? `<button type="button" class="bp-simulation-primary" data-action="stop-bp-simulation">Stop simulation</button>`
        : `<button type="button" class="bp-simulation-primary" data-action="start-bp-simulation">Start simulation</button>`}
      <button type="button" data-action="inject-bp-caution" ${running ? "" : "disabled"}>Inject Caution</button>
      <button type="button" data-action="inject-bp-critical" ${running ? "" : "disabled"}>Inject Critical</button>
      <button type="button" data-action="reset-bp-simulation" ${readings.length || bpSimulator ? "" : "disabled"}>Reset</button>
    </div>
    ${running ? `<p class="bp-simulation-countdown">Next reading in <strong id="bp-simulation-countdown">${remaining == null ? "--:--" : formatCountdown(remaining)}</strong></p>` : ""}
    ${latest ? `<div class="bp-simulation-latest"><span>Last simulated reading</span><strong>${latest.systolic} / ${latest.diastolic} mmHg</strong><em data-classification="${latest.classification}">${SIMULATION_CLASSIFICATION_LABEL[latest.classification] || latest.classification}</em><small>${simulationClockLabel(latest.observedAt || latest.timestamp)}</small></div>` : ""}
    ${readings.length ? `<div class="bp-simulation-history"><h3>Recent simulated readings</h3><ol>${[...readings].reverse().slice(0, 8).map(reading => `<li><span>${simulationClockLabel(reading.observedAt || reading.timestamp)}</span><b>${reading.systolic}/${reading.diastolic}</b><em data-classification="${reading.classification}">${SIMULATION_CLASSIFICATION_LABEL[reading.classification] || reading.classification}</em></li>`).join("")}</ol></div>` : ""}
  </section>`;
}

function prototypeSetup() {
  const access = prototypeConfig.program === "ACCESS";
  const physicianRequired = scenarioRequiresPhysician(prototypeConfig.program, prototypeConfig.source);
  const sourceOptions = access ? PROTOTYPE_OPTIONS.accessSources : PROTOTYPE_OPTIONS.sources;
  const coverageOptions = PROTOTYPE_OPTIONS.coverage.map(coverage => `<option value="${coverage}" ${coverage === prototypeConfig.coverage ? "selected" : ""} ${access && coverage === "Medicare Advantage" ? "disabled aria-disabled=\"true\"" : ""}>${coverage}${access && coverage === "Medicare Advantage" ? " — Not available for ACCESS" : ""}</option>`).join("");
  const showBpDeviceScenario = scenarioUsesBloodPressureMonitoring(prototypeConfig);
  return `<main class="prototype-console">
    <header class="prototype-header">
      <a class="prototype-brand" href="#" aria-label="ITERA HEALTH"><b>ITERA.</b>HEALTH</a>
      <span class="prototype-badge">Internal prototype</span>
    </header>
    <section class="prototype-intro">
      <span class="prototype-eyebrow">ITERA Enrollment Prototype</span>
      <h1>Configure the patient scenario</h1>
      <p>Select the main enrollment settings below. The patient experience will be generated automatically.</p>
    </section>
    <form id="prototype-form" class="prototype-form" novalidate>
      <fieldset class="prototype-programs">
        <legend><span>1</span><strong>Program</strong><small>Required</small></legend>
        <div class="program-grid">${PROTOTYPE_OPTIONS.programs.map(program => `<label class="program-option"><input type="radio" name="program" value="${program}" ${prototypeConfig.program === program ? "checked" : ""}><span>${icon(program.includes("RPM") ? "chart" : program === "ACCESS" ? "shield" : program === "PCM" ? "heart" : "people")}<strong>${program}</strong></span></label>`).join("")}</div>
      </fieldset>
      <div class="prototype-fields">
        <label class="prototype-field"><span><b>Enrollment source</b><small>Required</small></span><select name="source">${optionTags(sourceOptions, prototypeConfig.source)}</select></label>
        <div class="prototype-field condition-field"><span><b>Condition</b><small>Required</small></span>
          <details class="condition-multiselect" ${conditionMenuOpen ? "open" : ""}>
            <summary aria-label="Condition" title="${escapeHtml(prototypeConfig.conditions.join(", "))}"><span class="condition-value">${conditionValue()}</span><span class="condition-chevron">⌄</span></summary>
            <div class="condition-options" role="group" aria-label="Clinical conditions">${PROTOTYPE_OPTIONS.conditions.map(condition => `<label class="condition-option"><input type="checkbox" name="conditions" value="${condition}" ${prototypeConfig.conditions.includes(condition) ? "checked" : ""}><span class="condition-checkbox">${icon("check")}</span><span>${condition}</span></label>`).join("")}</div>
          </details>
        </div>
        <label class="prototype-field"><span><b>Coverage</b><small>Required</small></span><select name="coverage" aria-describedby="coverage-helper">${coverageOptions}</select>${access ? `<em class="prototype-helper" id="coverage-helper">ACCESS requires Original Medicare. Medicare Advantage is not available when ACCESS is selected.</em>` : ""}</label>
        <label class="prototype-field"><span><b>Language</b><small>Required</small></span><select name="language">${optionTags(PROTOTYPE_OPTIONS.languages, prototypeConfig.language)}</select></label>
        ${access ? `<label class="prototype-field conditional"><span><b>ACCESS track</b><small>Shown for ACCESS</small></span><select name="accessTrack">${optionTags(PROTOTYPE_OPTIONS.accessTracks, prototypeConfig.accessTrack)}</select></label>` : ""}
        ${access ? `<label class="prototype-field conditional"><span><b>ACCESS Eligibility Result</b><small>Prototype only</small></span><select name="accessEligibilityResult">${optionTags(PROTOTYPE_OPTIONS.accessEligibilityResults, prototypeConfig.accessEligibilityResult)}</select></label>` : ""}
        ${showBpDeviceScenario ? `<label class="prototype-field conditional"><span><b>Blood pressure monitor</b><small>Prototype only</small></span><select name="bpDeviceScenario">${optionTags(PROTOTYPE_OPTIONS.bpDeviceScenarios, prototypeConfig.bpDeviceScenario)}</select></label>` : ""}
        ${physicianRequired ? `<fieldset class="physician-configuration conditional"><legend><b>Physician configuration</b><small>Required for this scenario</small></legend><label class="prototype-field physician-name-field"><span><b>Physician name</b><small>Required</small></span><input type="text" name="physicianDisplayName" value="${escapeHtml(prototypeConfig.physicianDisplayName)}" placeholder="Enter physician name" autocomplete="off"></label><div class="prototype-field physician-photo-field"><span><b>Physician photo</b><small>Optional</small></span><div class="physician-photo-control"><img src="${escapeHtml(prototypeConfig.physicianPhotoUrl)}" alt="Physician photo preview"><div><strong>${prototypeConfig.physicianPhotoUrl === DEFAULT_PROTOTYPE_CONFIG.physicianPhotoUrl ? "Default physician photo" : "Custom physician photo"}</strong><div class="physician-photo-actions"><small>PNG, JPG or WEBP · MAXIMUM 5 MB</small><label class="physician-photo-upload">Choose photo<input type="file" name="physicianPhoto" accept="image/png,image/jpeg,image/webp"></label></div></div></div></div></fieldset>` : ""}
      </div>
      <p class="prototype-error" id="prototype-error" role="alert"></p>
    </form>
    ${bpSimulationPanel()}
    <section class="scenario-footer">
      <div class="scenario-summary" aria-live="polite"><span>Patient scenario</span><strong title="${escapeHtml(prototypeScenarioSummary())}">${prototypeScenarioSummary()}</strong></div>
      <button class="launch-button" type="button" data-action="launch-prototype">Launch Patient Experience ${icon("arrowRight", "button-icon")}</button>
    </section>
  </main>`;
}

const renderers = { INVITATION: invitation, DECISION_MAKER: decisionMaker, CARE_CIRCLE_INVITE: careCircleInvite, CARE_CIRCLE_INVITE_SENT: careCircleInviteSent, CARE_CIRCLE_PERMISSIONS: careCirclePermissions, SHARE_ACCESS: shareAccess, PERSONAL_REPRESENTATIVE_DETAILS: personalRepresentativeDetails, REPRESENTATIVE_MOBILE_VERIFICATION: representativeMobileVerification, REPRESENTATIVE_AUTHORITY_ATTESTATION: representativeAuthorityAttestation, REPRESENTATIVE_AUTHORITY_ESCALATION: representativeAuthorityEscalation, IDENTITY_VERIFICATION: identity, CARE_RECOMMENDATION: recommendation, HOW_CARE_WORKS: howCareWorks, DISCLOSURE: disclosure, CONSENT_REVIEW: consent, ENROLLMENT_PROCESSING: () => processing(), ACCESS_ALIGNMENT_PROCESSING: () => processing("alignment"), ENROLLMENT_CONFIRMED: success, ACCESS_PRE_ELIGIBILITY_NOTICE: accessNotice, ACCESS_MEDICARE_IDENTIFIER: medicareIdentifier, ACCESS_ELIGIBILITY_PROCESSING: eligibilityProcessing, ACCESS_ELIGIBILITY_RESULT: eligibilityResult, ONBOARDING: onboarding, MEDICATIONS_REVIEW: medicationsReview, CARE_PREFERENCES: carePreferences, GOALS: goals, ACCESS_BP_DEVICE_VERIFICATION: accessBpDeviceVerification, ACCESS_BP_DEVICE_RESULT: accessBpDeviceResult, ACCESS_BP_DEVICE_INFO: accessBpDeviceInfo, ACCESS_BP_SHIPPING_ADDRESS: accessBpShippingAddress, ACCESS_BP_FULFILLMENT_CONFIRMED: accessBpFulfillmentConfirmed, ACCESS_BP_GUIDED_SETUP: accessBpGuidedSetup, ACCESS_BP_MEASUREMENT: accessBpMeasurement, ACCESS_BP_BASELINE_RESULT: accessBpBaselineResult, ACCESS_BP_ESCALATION: accessBpEscalation, RPM_DEVICE_PATH: rpmDevice, RPM_ADDRESS_CONFIRMATION: shipping, RPM_DEVICE_SETUP: deviceSetup, RPM_FIRST_READING: firstReading, RPM_MONITORING_READY: monitoringReady, ACCESS_SUPPORT_NEEDS: accessSupportNeeds, ONBOARDING_COMPLETE: onboardingComplete, CALLBACK_CONFIRMED: callbackConfirmed, OUTCOME_STOPPED: stoppedOutcome, OFFER_INVALID: offerError, OFFER_EXPIRED: offerError };
renderers.FLOW_DEFERRED = deferredFlowConfirmation;
renderers.MY_CARE = myCareScreen;
renderers.MY_CARE_TEAM = myCareTeamScreen;
renderers.MY_MEDICATIONS = myMedicationsScreen;
renderers.MY_GOALS = myGoals;
renderers.MY_CARE_CIRCLE = myCareCircleScreen;
renderers.CARE_CIRCLE_REMOVE_CONFIRMATION = careCircleRemoveConfirmation;
renderers.MY_APPOINTMENTS = myAppointmentsScreen;
renderers.APPOINTMENT_DETAIL = appointmentDetailScreen;
renderers.APPOINTMENT_SCHEDULING = appointmentSchedulingScreen;

function devPanel() {
  if (import.meta.env.PROD) return "";
  // Scenario and screen jumping are QA controls. The invitation is not a QA surface, so they are
  // absent there even in a development build — reachable only from a URL a tester chose.
  if (canonicalInvitation) return "";
  const voice = emmiLive?.voiceIdentitySnapshot() || emmiVoiceMetadata(languageCode(), { sessionId: state.sessionId, screenId: state.screen });
  return `<aside class="dev-panel ${state.devOpen ? "open" : ""}"><button class="dev-toggle" data-action="dev">Demo</button><div><label>Scenario<select id="scenario-select">${Object.entries(SCENARIOS).map(([id, x]) => `<option value="${id}" ${id === state.scenarioId ? "selected" : ""}>${x.label}</option>`).join("")}</select></label><label>Jump to<select id="screen-select">${journeyFor(state).map(x => `<option value="${x}" ${x === state.screen ? "selected" : ""}>${x}</option>`).join("")}</select></label><section class="emmi-voice-debug" aria-label="EMMI Voice Debug"><strong>EMMI Voice Debug</strong><span>Internal locale: ${voice.locale}</span><span>Resolved language: ${voice.resolvedLanguage}</span><span>Speech locale: ${voice.resolvedSpeechLocale}</span><span>Voice: ${voice.voiceId || "TEXT_ONLY"}</span><span>Voice version: ${voice.voiceVersion}</span><span>Provider: ${voice.provider}</span><span>Model: ${EMMI_CONFIG.model}</span><span>Status: ${state.assistantVoiceState}</span><span>Capability: ${voice.capability}</span><span>Error: ${state.assistantVoiceError || "NONE"}</span><span>Session: ${voice.sessionId || state.sessionId}</span></section><button class="small-action" data-action="clear">Clear saved demo</button></div></aside>`;
}

// Appointment sub-views and scheduling steps replace the whole screen without changing
// state.screen, so without them in the key the patient keeps the previous view's scroll position
// and lands halfway down the new question. Same reason MY_GOALS carries its detail suffix.
const scrollViewKey = () => {
  if (state.screen === "MY_GOALS" && state.activeGoalId) return `${state.screen}#detail`;
  if (state.screen === "APPOINTMENT_DETAIL") return `${state.screen}#${state.activeAppointmentId || ""}#${state.appointmentFlow?.view || ""}${state.appointmentFlow?.view === "RESOLUTION" ? `#${activeResolution()?.step || ""}` : ""}`;
  if (state.screen === "APPOINTMENT_SCHEDULING") return `${state.screen}#${state.appointmentFlow?.step || ""}`;
  if (state.screen === "MY_APPOINTMENTS") return `${state.screen}#${state.appointmentFlow?.tab || ""}`;
  return state.screen;
};

function finishRender(scrollSnapshot, errorAppeared) {
  afterRenderScroll(scrollSnapshot, scrollViewKey(), { errorAppeared });
  paintedScreen = scrollViewKey();
  paintedError = state.error || "";
}

function render() {
  const scrollSnapshot = beforeRenderScroll(paintedScreen);
  const newScreen = paintedScreen !== scrollViewKey();
  const errorAppeared = Boolean(state.error) && state.error !== paintedError;
  clearTimeout(emmiGuidanceTimer);
  state.emmiVoiceOptionsOpen = false;
  document.body.classList.remove("emmi-sheet-open");
  state.assistantOpen = false;
  document.body.classList.remove("assistant-open");
  if (state.screen === "PROTOTYPE_SETUP") { app.innerHTML = prototypeSetup(); bindPrototypeSetup(); finishRender(scrollSnapshot, errorAppeared); return; }
  if (state.screen === "OFFER_LOADING") { app.innerHTML = `<main class="shell patient-app-shell loading-screen" aria-live="polite">${art("shield")}<h1>${L("Opening your secure invitation…", "Abriendo su invitación segura…", "Ouvèti envitasyon sekirite w la...")}</h1></main>`; finishRender(scrollSnapshot, errorAppeared); return; }
  if (["OFFER_INVALID", "OFFER_EXPIRED"].includes(state.screen)) { app.innerHTML = `<main class="shell patient-app-shell"><section class="screen centered-error">${offerError()}</section></main>`; finishRender(scrollSnapshot, errorAppeared); return; }
  const renderer = renderers[state.screen] || (() => `${titleBlock(L("We need a moment", "Necesitamos un momento", "Nou bezwen yon ti moman"), L("Please call our care team for help.", "Llame a nuestro equipo de cuidado para obtener ayuda.", "Tanpri rele ekip swen nou an pou jwenn èd."))}`);
  const screenClass = state.screen === "DECISION_MAKER" ? "decision-maker-screen" : ["CARE_CIRCLE_INVITE", "CARE_CIRCLE_INVITE_SENT", "CARE_CIRCLE_PERMISSIONS", "MY_CARE_CIRCLE", "CARE_CIRCLE_REMOVE_CONFIRMATION", "SHARE_ACCESS"].includes(state.screen) ? `growth-screen${state.screen === "CARE_CIRCLE_INVITE" ? " care-circle-invite-screen" : ""}` : ["PERSONAL_REPRESENTATIVE_DETAILS", "REPRESENTATIVE_MOBILE_VERIFICATION", "REPRESENTATIVE_AUTHORITY_ATTESTATION", "REPRESENTATIVE_AUTHORITY_ESCALATION"].includes(state.screen) ? "representative-details-screen" : state.screen === "IDENTITY_VERIFICATION" ? "identity-screen" : state.screen === "CARE_RECOMMENDATION" ? "recommendation-screen" : state.screen === "HOW_CARE_WORKS" ? "care-works-screen" : state.screen === "DISCLOSURE" ? `important-information-screen${state.offer?.pathway === "ACCESS" ? " access-disclosure-screen" : ""}` :state.screen === "CONSENT_REVIEW" ? `consent-screen${state.offer?.pathway === "ACCESS" ? " access-consent-screen" : ""}` : state.screen === "ACCESS_PRE_ELIGIBILITY_NOTICE" ? "access-notice-screen" : state.screen === "ACCESS_ELIGIBILITY_PROCESSING" ? `eligibility-processing-screen${state.eligibilityError ? " eligibility-error-screen" : ""}` : state.screen === "CLINICAL_VERIFICATION" ? "health-information-review-screen" : state.screen === "MEDICATIONS_REVIEW" ? "medication-review-screen" : ["GOALS", "MY_GOALS"].includes(state.screen) ? "goals-screen" : "";
  const assuranceOverride = state.screen === "ACCESS_ELIGIBILITY_RESULT" && state.accessOutcome === "eligible" ? "NO_COMMITMENT_YET" : state.screen === "ACCESS_ELIGIBILITY_RESULT" && state.accessOutcome === "notEligible" ? "NOT_ELIGIBLE_REASSURANCE" : state.screen === "CONSENT_REVIEW" && state.offer?.pathway === "ACCESS" ? "ENROLLMENT_CHOICE" : "";
  app.innerHTML = `<main class="shell patient-app-shell">${header()}<section class="screen ${screenClass}" id="screen-content">${voiceGuidancePanel()}${renderer()}${state.screen === "INVITATION" ? "" : contextualAssuranceFooter(state.screen, assuranceOverride)}</section>${emmiAssistant()}<div class="save-status" role="status" aria-live="polite"></div></main>${devPanel()}`;
  bind();
  const emmiTransitioned = syncEmmiNavigationContext();
  if (!emmiTransitioned) scheduleEmmiGuidance();
  // Only a genuinely new screen hands focus to its heading. Re-focusing the h1 after an in-place
  // update drags a screen reader back to the title the patient already heard.
  if (newScreen) requestAnimationFrame(() => document.querySelector("h1")?.focus({ preventScroll: true }));
  // A resolution parked on a searching / booking / checking step is what makes the provider call.
  // Driving it from the paint rather than from the click means a patient who reloads mid-search
  // sees the search finish rather than a spinner nobody is turning.
  startBarrierResolutionWorkIfPending();
  // And this is what keeps EMMI looking at the same screen as the patient. It runs on every paint
  // because a paint is the only moment the document is guaranteed to be what the patient can see;
  // it compares meaning, so a paint that changed nothing sends nothing.
  syncEmmiViewContext();
  finishRender(scrollSnapshot, errorAppeared);
}

function bindPrototypeSetup() {
  const form = document.querySelector("#prototype-form");
  document.querySelector(".condition-multiselect")?.addEventListener("toggle", event => { conditionMenuOpen = event.target.open; });
  form?.addEventListener("input", event => {
    if (event.target.name === "physicianDisplayName") {
      prototypeConfig = { ...prototypeConfig, physicianDisplayName: event.target.value };
      const summary = document.querySelector(".scenario-summary strong");
      if (summary) { summary.textContent = prototypeScenarioSummary(); summary.title = prototypeScenarioSummary(); }
    }
  });
  form?.addEventListener("change", async event => {
    if (event.target.name === "physicianDisplayName") return;
    if (event.target.name === "physicianPhoto") {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
        document.querySelector("#prototype-error").textContent = "Choose a PNG, JPG or WebP image smaller than 5 MB.";
        return;
      }
      const physicianPhotoUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      prototypeConfig = { ...prototypeConfig, physicianPhotoUrl };
      render();
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    const conditions = new FormData(form).getAll("conditions");
    conditionMenuOpen = event.target.name === "conditions";
    prototypeConfig = normalizePrototypeConfig({
      ...prototypeConfig,
      program: data.program || prototypeConfig.program,
      source: data.source || prototypeConfig.source,
      conditions,
      coverage: data.coverage || prototypeConfig.coverage,
      language: data.language || prototypeConfig.language,
      accessTrack: data.accessTrack || prototypeConfig.accessTrack,
      accessEligibilityResult: data.accessEligibilityResult || prototypeConfig.accessEligibilityResult,
      bpDeviceScenario: data.bpDeviceScenario || prototypeConfig.bpDeviceScenario,
      physicianDisplayName: data.physicianDisplayName ?? prototypeConfig.physicianDisplayName
    });
    // A different scenario is a different patient. Whatever was queued belonged to the old one.
    stopBpSimulationForScenarioChange();
    render();
  });
  document.querySelector('[data-action="launch-prototype"]')?.addEventListener("click", launchPrototype);
  document.querySelector('[name="bpSimulationInterval"]')?.addEventListener("change", event => {
    bpSimulationSettings.intervalMinutes = Number(event.target.value) || 2;
    // The interval is read when a simulator is built, so a change takes effect on the next start.
    bpSimulator?.dispose();
    bpSimulator = null;
    render();
  });
  const simulationActions = {
    "start-bp-simulation": () => startBpSimulation(),
    "stop-bp-simulation": () => stopBpSimulation(),
    "reset-bp-simulation": () => resetBpSimulation(),
    "inject-bp-caution": () => bpSimulator?.inject(SIMULATION_TARGET.CAUTION),
    "inject-bp-critical": () => bpSimulator?.inject(SIMULATION_TARGET.CRITICAL)
  };
  Object.entries(simulationActions).forEach(([action, run]) => {
    document.querySelector(`[data-action="${action}"]`)?.addEventListener("click", async () => { await run(); render(); });
  });
}

// What the scenario already knows about this patient's monitor, written into state before the
// experience renders. The console used to do this on Launch; an invitation has no Launch button,
// so both entries call the same function and neither can start with an unknown device.
function applyScenarioDeviceContext() {
  const deviceContext = service.getScenarioDeviceContext?.();
  if (!deviceContext) return;
  Object.assign(state, {
    patientHasBloodPressureMonitor: Boolean(deviceContext.patientOwnsMonitor),
    deviceSource: deviceContext.deviceSource || "UNKNOWN",
    assignedDeviceId: deviceContext.assignedDeviceId || "",
    last4DeviceId: (deviceContext.assignedDeviceId || "").slice(-4),
    patientDeviceConfirmationChoice: "",
    patientDeviceConfirmed: null,
    patientDeviceConfirmedAt: "",
    confirmedDeviceId: "",
    firstTransmissionVerified: null,
    firstTransmissionDeviceId: "",
    firstTransmissionAt: "",
    deviceVendor: deviceContext.deviceVendor || "",
    deviceStatus: deviceContext.deviceStatus || "",
    integrationProvider: deviceContext.integrationProvider || "UNKNOWN",
    integrationStatus: deviceContext.integrationStatus || "UNKNOWN"
  });
}

async function launchPrototype() {
  prototypeConfig = normalizePrototypeConfig(prototypeConfig);
  if (!prototypeConfig.conditions.length) { document.querySelector("#prototype-error").textContent = "Select at least one condition."; return; }
  const required = [prototypeConfig.program, prototypeConfig.source, prototypeConfig.coverage, prototypeConfig.language];
  if (prototypeConfig.program === "ACCESS") required.push(prototypeConfig.accessTrack, prototypeConfig.accessEligibilityResult);
  if (prototypeConfig.program === "ACCESS" && prototypeConfig.coverage !== "Original Medicare") { document.querySelector("#prototype-error").textContent = "ACCESS requires Original Medicare."; return; }
  if (scenarioRequiresPhysician(prototypeConfig.program, prototypeConfig.source) && !prototypeConfig.physicianDisplayName.trim()) { document.querySelector("#prototype-error").textContent = "Enter the physician name."; return; }
  if (required.some(value => !value)) { document.querySelector("#prototype-error").textContent = "Complete all required fields before launching the patient experience."; return; }
  const { physicianPhotoUrl, ...persistableConfig } = prototypeConfig;
  localStorage.setItem("itera.prototype.config.v1", JSON.stringify(persistableConfig));
  history.replaceState({}, "", "?prototype=1");
  service = new MockEnrollmentService("prototype", prototypeConfig);
    state = { ...state, scenarioId: "prototype", screen: "OFFER_LOADING", offer: null, language: prototypeConfig.language, role: "patient", completionRole: "patient", representativeFullName: "", representativeRelationship: "", representativeAuthorityType: "", representativePhone: "", representativeOtpDeliveryId: "", representativeOtpResendAvailableAt: 0, phoneVerified: false, phoneVerificationMethod: "", phoneVerifiedAt: "", representativeAuthorityAttested: false, authorityAttestation: false, authorityAttestedAt: "", authorityVerificationMethod: AUTHORITY_VERIFICATION_METHODS[0], authorityAdditionalVerificationRequired: false, accessNoticeAcknowledgedAt: "", disclosureAcknowledgedAt: "", disclosureVersion: "", accessDisclosureView: null, consentRole: "", consentVersion: "", consentTimestamp: "", sessionId: globalThis.crypto?.randomUUID?.() || `session_${Date.now().toString(36)}`, identityVerified: false, accessEligible: false, accessOutcome: null, eligibilityPhase: "checkingEnrollment", eligibilityError: false, eligibilityRequestKey: "", devicePath: null, enrollmentStatus: "NOT_STARTED", enrollmentCompletedAt: "", baselineStatus: "NOT_STARTED", baselineStartedAt: "", baselineCompletedAt: "", baselineDeferredAt: "", baselineResumeScreen: "", baselineReminderStatus: "NOT_SCHEDULED", bpBaselineStatus: "NOT_STARTED", bpDevicePath: "", bpDeviceIdentificationMethod: "", bpDeviceVerificationStatus: "NOT_STARTED", bpDeviceVerificationResult: "", deviceSource: "UNKNOWN", deviceVerificationStatus: "NOT_STARTED", integrationProvider: "UNKNOWN", assignedDeviceId: "", deviceVendor: "", deviceModel: "", deviceStatus: "", integrationStatus: "", lastTransmissionAt: "", deviceUncertaintyStep: false, bpDevice: null, armCircumferenceValue: "", armCircumferenceUnit: "cm", armMeasurementStatus: "", cuffSelectionMethod: "", selectedCuffOption: "", cuffSelectionStatus: "", cuffSizeSelected: null, deviceModelSelected: null, shippingAddress: null, shippingAddressConfirmed: false, shippingAddressMode: "existing", deviceFulfillmentId: "", deviceFulfillmentStatus: "NOT_REQUESTED", careTeamTasks: [], appointments: [], appointmentDraft: null, appointmentFlow: null, activeAppointmentId: "", appointmentNotice: "", bpDeviceFulfillmentStatus: "NOT_STARTED", bpDeviceFulfillmentRequestedAt: "", bpBaselineSourceType: "", bpReadings: [], bpReadingCount: 0, bpReadingReceipts: [], bpMeasurementPhase: "WAITING", bpBaseline: null, bpEscalationState: null, bpMonitoringEpisode: null, clinicalReportedBloodPressure: null, accessBaselineBloodPressure: null, audit: [], error: "" };
  Object.assign(state, { assistantDemoPatientId: "", assistantPatientContextKey: "" });
  Object.assign(state, { healthInformationStepStatus: "NOT_STARTED", healthInformationReviewStatus: "UNREVIEWED", healthInformationReviewResult: "", healthInformationReviewedAt: "", healthInformationReviewedBy: "", healthInformationReviewSource: "", healthInformationFlowStep: "CHOICE", healthInformationUpdateDraft: { id: "", updateType: "", relatedConditionIds: [], patientReportedText: "" }, patientReportedHealthUpdates: [], healthInformationHelpNote: "" });
  Object.assign(state, { patientAddedCareTeamMembers: [], careTeamAddOpen: false, careTeamMemberDraft: { displayName: "", role: "", specialty: "", practiceName: "" }, careTeamNotice: "" });
  Object.assign(state, { goalsStatus: "NOT_STARTED", careGoals: [], careGoalsNote: "", goalFlowStep: "DISCOVERY", goalFlowOrigin: "ONBOARDING", patientGoals: [], goalPrimaryId: "", goalSecondaryId: "", goalPlanningGoalId: "", goalPlanStatus: "NOT_STARTED", goalPlanDraft: { actionIds: [], customAction: "", frequency: "few-days", remindersEnabled: false, whyItMatters: "" }, activeGoalId: "", goalDetailView: "SUMMARY", goalBarrierDraft: { category: "", patientDescription: "" }, activeBarrierId: "", goalSupportDraft: "", goalNotice: "", goalHistory: [], supportNeedsStatus: "NOT_STARTED", supportNeedsAnswers: {}, supportNeedsOther: "" });
  Object.assign(state, { bpBaselineRequiredReadings: 3, bpBaselineReadingCount: 0, bpBaselineRemainingReadings: 3, firstTransmissionSystolic: null, firstTransmissionDiastolic: null });
  Object.assign(state, { activationStatus: "NOT_STARTED", activationStartedAt: "", deviceSetupStatus: "NOT_STARTED", deviceSetupStartedAt: "" });
  Object.assign(state, { barrierResolutions: [], activeResolutionId: "", barrierActivity: [], barrierError: "", barrierReadinessAck: {} });
  state.flowProgress = { GETTING_STARTED: emptyFlowProgress() };
  state.flowTransitionNotice = "";
  applyScenarioDeviceContext();
  setLanguage(prototypeConfig.language);
  render();
  try {
    state.offer = await service.getOffer();
    state.screen = "INVITATION";
    audit(state, "prototype_launched");
    render();
  } catch { state.screen = "OFFER_INVALID"; render(); }
}

document.addEventListener("click", event => {
  if (state.screen !== "PROTOTYPE_SETUP" || event.target.closest(".condition-multiselect")) return;
  conditionMenuOpen = false;
  document.querySelector(".condition-multiselect")?.removeAttribute("open");
});

// Landing on the verification screen is what starts the lookup, however the patient got there. The
// advance path only started one that was already in flight, and the enrollment-confirmation route
// — the ordinary way in for someone whose record already holds a monitor — started none at all, so
// a patient with a connected monitor was told "we don't see a monitor connected to your care yet".
const startAssignedDeviceLookupIfPending = () => {
  if (state.screen === "ACCESS_BP_DEVICE_VERIFICATION" && ["NOT_STARTED", "CHECKING"].includes(state.deviceVerificationStatus)) runAssignedDeviceLookup();
};

async function runAssignedDeviceLookup() {
  if (state.screen !== "ACCESS_BP_DEVICE_VERIFICATION" || state.busy) return;
  state.busy = true;
  state.deviceVerificationStatus = "CHECKING";
  state.bpDeviceVerificationStatus = "CHECKING";
  state.error = "";
  render();
  const patientId = state.offer.patient.id;
  const assignment = await service.getActiveDeviceAssignment(patientId);
  if (assignment.patientOwnsMonitor && assignment.deviceSource === "PATIENT_OWNED" && assignment.integrationStatus === "UNSUPPORTED") {
    state.busy = false;
    state.patientHasBloodPressureMonitor = true;
    state.deviceSource = "PATIENT_OWNED";
    state.assignedDeviceId = "";
    state.deviceVendor = assignment.deviceVendor || "OTHER";
    state.deviceStatus = assignment.deviceStatus || "ACTIVE";
    state.integrationProvider = assignment.integrationProvider || "OTHER";
    state.integrationStatus = "UNSUPPORTED";
    state.deviceVerificationStatus = "UNSUPPORTED";
    state.bpDeviceVerificationStatus = "VERIFIED_INCOMPATIBLE";
    state.bpDeviceVerificationResult = "patient_owned_not_connected";
    state.bpBaselineStatus = "DEVICE_VERIFICATION";
    state.baselineResumeScreen = "ACCESS_BP_DEVICE_RESULT";
    audit(state, "bp_device_assignment_lookup", "unsupported", { patientId, deviceSource: "PATIENT_OWNED", integrationStatus: "UNSUPPORTED" });
    state.screen = "ACCESS_BP_DEVICE_RESULT";
    draftStore.save(state); render(); return;
  }
  if (assignment.status !== "active" || !assignment.assignment?.assignedDeviceId) {
    state.busy = false;
    state.patientHasBloodPressureMonitor = Boolean(assignment.patientOwnsMonitor);
    state.deviceSource = assignment.deviceSource || "UNKNOWN";
    state.deviceVerificationStatus = "NOT_FOUND";
    state.bpDeviceVerificationStatus = "NOT_FOUND";
    state.assignedDeviceId = "";
    state.integrationProvider = "UNKNOWN";
    // Every other outcome of this lookup records that the baseline is waiting on the device. This
    // one did not, so a patient whose record claims a monitor nobody can confirm was left looking
    // like they had never started, while sitting on the screen that is asking them about it.
    state.bpBaselineStatus = "DEVICE_VERIFICATION";
    state.baselineResumeScreen = "ACCESS_BP_DEVICE_VERIFICATION";
    audit(state, "bp_device_assignment_lookup", "not_found", { patientId });
    draftStore.save(state); render(); return;
  }
  state.deviceSource = "ITERA_ASSIGNED";
  state.assignedDeviceId = assignment.assignment.assignedDeviceId;
  try {
    const device = await service.getDeviceById(state.assignedDeviceId);
    state.busy = false;
    state.deviceVendor = device.vendor || "UNKNOWN";
    state.integrationProvider = ["TENOVI", "PYLO"].includes(device.vendor) ? device.vendor : device.vendor === "OTHER" ? "OTHER" : "UNKNOWN";
    state.deviceModel = device.model || "";
    state.deviceStatus = device.status || "NOT_FOUND";
    state.integrationStatus = device.integrationStatus || "UNKNOWN";
    state.lastTransmissionAt = device.lastTransmissionAt || "";
    const connected = device.status === "active" && ["TENOVI", "PYLO"].includes(device.vendor) && device.integrationStatus === "CONNECTED";
    if (connected) {
      state.deviceVerificationStatus = "ASSIGNED";
      state.bpDeviceVerificationStatus = "VERIFIED_COMPATIBLE";
      state.bpDeviceVerificationResult = "assigned_device_found";
      state.bpBaselineStatus = "DEVICE_VERIFICATION";
      state.bpBaselineSourceType = "VERIFIED_DEVICE";
      state.last4DeviceId = state.assignedDeviceId.slice(-4);
      state.patientDeviceConfirmationChoice = "";
      state.patientDeviceConfirmed = null;
      state.patientDeviceConfirmedAt = "";
      state.confirmedDeviceId = "";
      state.firstTransmissionVerified = null;
      state.firstTransmissionDeviceId = "";
      state.firstTransmissionAt = "";
      state.bpDevice = { deviceId: device.deviceId, deviceModel: device.model, deviceType: "UPPER_ARM", vendor: device.vendor, integrationStatus: device.integrationStatus, source: "CONNECTED_DEVICE", sourceVerified: true };
      audit(state, "bp_device_assignment_found", "success", { patientId, assignedDeviceId: state.assignedDeviceId, vendor: device.vendor, model: device.model, last4DeviceId: state.last4DeviceId, integrationStatus: device.integrationStatus });
    } else {
      state.deviceVerificationStatus = device.status === "inactive" ? "INACTIVE" : "NEEDS_REVIEW";
      state.bpDeviceVerificationStatus = "NEEDS_REVIEW";
      state.bpDeviceVerificationResult = device.status || "not_found";
      state.bpBaselineStatus = "DEVICE_VERIFICATION";
      state.baselineReminderStatus = "CARE_TEAM_ASSISTANCE";
      audit(state, "bp_assigned_device_verified", "needs_review", { patientId, assignedDeviceId: state.assignedDeviceId, vendor: device.vendor || "UNKNOWN", deviceStatus: device.status || "NOT_FOUND", integrationStatus: device.integrationStatus || "UNKNOWN" });
    }
  } catch {
    state.busy = false;
    state.deviceVerificationStatus = "NEEDS_REVIEW";
    state.bpDeviceVerificationStatus = "NEEDS_REVIEW";
    state.bpDeviceVerificationResult = "lookup_failed";
    state.deviceStatus = "UNKNOWN";
    state.integrationStatus = "UNKNOWN";
    state.baselineReminderStatus = "CARE_TEAM_ASSISTANCE";
    audit(state, "bp_assigned_device_verified", "needs_review", { patientId, assignedDeviceId: state.assignedDeviceId, reason: "lookup_failed" });
  }
  state.baselineResumeScreen = "ACCESS_BP_DEVICE_RESULT";
  state.screen = "ACCESS_BP_DEVICE_RESULT";
  draftStore.save(state); render();
}

async function recordAccessBpObservation(result, { firstTransmission = false } = {}) {
  const expectedDeviceId = state.confirmedDeviceId || state.assignedDeviceId || state.bpDevice?.deviceId;
  const sourceDeviceId = result.sourceDeviceId || result.deviceId || "";
  if (result.status !== "received" || !result.sourceVerified || !result.timestamp || !expectedDeviceId || sourceDeviceId !== expectedDeviceId) return { accepted: false, reason: sourceDeviceId !== expectedDeviceId ? "SOURCE_MISMATCH" : "INVALID_SOURCE", sourceDeviceId };
  const observationId = result.observationId || result.readingId || `${sourceDeviceId}:${result.timestamp}`;
  if ((state.bpReadingReceipts || []).some(receipt => (receipt.observationId || receipt.readingId) === observationId)) {
    audit(state, "bp_baseline_observation_ignored", "duplicate", { observationId, deviceId: sourceDeviceId, timestamp: result.timestamp });
    return { accepted: false, duplicate: true, observationId };
  }
  const stored = await service.recordAccessBpObservation(result);
  if (stored.duplicate) {
    audit(state, "bp_baseline_observation_ignored", "duplicate", { observationId: stored.observationId, deviceId: sourceDeviceId, timestamp: result.timestamp });
    return { accepted: false, duplicate: true, observationId: stored.observationId };
  }
  const required = state.bpBaselineRequiredReadings || 3;
  const nextCount = Math.min(required, (state.bpBaselineReadingCount || 0) + 1);
  state.bpReadings = [...(state.bpReadings || []), { ...result, observationId: stored.observationId }];
  state.bpReadingCount = nextCount;
  state.bpBaselineReadingCount = nextCount;
  state.bpBaselineRemainingReadings = Math.max(0, required - nextCount);
  state.bpReadingReceipts = [...(state.bpReadingReceipts || []), { readingId: stored.observationId, observationId: stored.observationId, readingNumber: nextCount, timestamp: result.timestamp, deviceId: sourceDeviceId, deviceModel: result.deviceModel, source: result.source, sourceVerified: true, receivedAt: result.receivedAt }];
  state.bpBaselineStatus = nextCount >= required ? "COMPLETED" : "IN_PROGRESS";
  if (firstTransmission) {
    state.firstTransmissionVerified = true;
    state.firstTransmissionDeviceId = sourceDeviceId;
    state.firstTransmissionAt = result.receivedAt || result.timestamp;
    state.firstTransmissionSystolic = result.systolic;
    state.firstTransmissionDiastolic = result.diastolic;
    state.deviceVerificationStatus = "SOURCE_VERIFIED";
    state.bpDeviceVerificationStatus = "SOURCE_VERIFIED";
  }
  audit(state, "bp_baseline_observation_recorded", "success", { observationId: stored.observationId, deviceId: sourceDeviceId, timestamp: result.timestamp, readingCount: nextCount, requiredReadings: required, remainingReadings: state.bpBaselineRemainingReadings, firstTransmission });
  return { accepted: true, observationId: stored.observationId, count: nextCount, complete: nextCount >= required };
}

async function syncPendingAccessBpObservations() {
  if (state.deviceVerificationStatus !== "SOURCE_VERIFIED" || state.bpBaselineStatus === "COMPLETED") return;
  const pending = await service.getPendingAccessBpObservations({ deviceId: state.confirmedDeviceId || state.assignedDeviceId, afterCount: state.bpBaselineReadingCount || 0 });
  for (const observation of pending) {
    const recorded = await recordAccessBpObservation(observation);
    if (recorded.complete) { await finalizeAccessBpBaseline({ navigate: false }); break; }
  }
  draftStore.save(state);
  if (["ONBOARDING", "CLINICAL_VERIFICATION", "GOALS", "ONBOARDING_COMPLETE"].includes(state.screen)) render();
}

async function finalizeAccessBpBaseline({ navigate = true } = {}) {
  state.bpBaselineStatus = "PROCESSING";
  state.busy = true; render();
  const review = await service.evaluateAccessBpBaseline(state.bpReadings || []);
  state.busy = false;
  const completedAt = new Date().toISOString();
  const averageSystolic = review.averageSystolic;
  const averageDiastolic = review.averageDiastolic;
  state.bpBaseline = { readings: state.bpReadings || [], averageSystolic, averageDiastolic, completedAt, deviceId: state.bpDevice?.deviceId || state.bpReadingReceipts?.[0]?.deviceId, sourceVerified: true };
  state.accessBaselineBloodPressure = { systolic: averageSystolic, diastolic: averageDiastolic, capturedAt: completedAt, sourceType: "VERIFIED_DEVICE", readingCount: 3 };
  if (review.status === "escalation") {
    state.bpEscalationState = { status: "ACTIVE", severity: review.severity, ruleId: review.ruleId, createdAt: completedAt, careTeamNotified: true };
    state.baselineStatus = "IN_PROGRESS";
    state.baselineResumeScreen = "ACCESS_BP_ESCALATION";
    audit(state, "bp_clinical_escalation", "triggered", { severity: review.severity, ruleId: review.ruleId, careTeamNotified: true });
    if (navigate) state.screen = "ACCESS_BP_ESCALATION";
  } else {
    state.bpBaselineStatus = "COMPLETED";
    state.bpBaselineReadingCount = 3;
    state.bpBaselineRemainingReadings = 0;
    audit(state, "bp_baseline_completed", "success", { readingCount: 3, averageSystolic, averageDiastolic, deviceId: state.bpBaseline.deviceId, sourceVerified: true });
    if (navigate) state.screen = "ACCESS_BP_BASELINE_RESULT";
  }
  draftStore.save(state); render();
}

async function advance() {
  state.error = "";
  // "Start your care journey" is an invitation to join. A patient who has already joined and lands
  // back here — by reload, by a shared link, by Back — was being walked into "Who is completing
  // this?", asked to enrol a second time in a programme they are already in. They resume instead:
  // their care setup where they left it, or My Care once it is done.
  if (state.screen === "INVITATION" && state.enrollmentStatus === "COMPLETED") {
    const progress = gettingStartedProgress();
    const resume = progress.status === FLOW_STATUS.COMPLETED ? "" : gettingStartedResumeRoute();
    state.screen = resume || "MY_CARE";
    draftStore.save(state);
    render();
    return;
  }
  if (state.screen === "ACCESS_ELIGIBILITY_PROCESSING" && state.eligibilityError) { await runEligibility(); return; }
  if (state.screen === "ACCESS_ELIGIBILITY_RESULT" && state.accessOutcome !== "eligible") {
    if (state.accessOutcome === "unavailable") { state.screen = "ACCESS_ELIGIBILITY_PROCESSING"; render(); runEligibility(); return; }
    if (["notEligible", "alreadyAligned"].includes(state.accessOutcome)) { state.returnScreen = state.screen; state.screen = "CALLBACK_CONFIRMED"; state.callbackRequested = true; render(); return; }
    state.screen = "OUTCOME_STOPPED"; render(); return;
  }
  if (state.screen === "DECISION_MAKER") {
    state.completionRole = new FormData(document.querySelector("#choice-form")).get("choice") || state.completionRole;
    state.role = state.completionRole === "personalRepresentative" ? "representative" : state.completionRole;
    state.sessionMetadata = { ...state.sessionMetadata, viewport: `${window.innerWidth}x${window.innerHeight}` };
    audit(state, "completion_role_selected", "success", { completionRole: state.completionRole });
  }
  if (state.screen === "PERSONAL_REPRESENTATIVE_DETAILS") {
    const form = document.querySelector("#representative-form"), data = Object.fromEntries(new FormData(form));
    const fullName = (data.representativeFullName || "").trim();
    const relationship = data.representativeRelationship || "";
    const authorityType = data.representativeAuthorityType || "";
    const phone = phoneDigits(data.representativePhone);
    if (!fullName || !relationship || !authorityType || phone.length !== 10) { state.error = L("Please complete each field and enter a valid 10-digit mobile number.", "Complete cada campo e ingrese un número móvil válido de 10 dígitos.", "Tanpri ranpli chak chan epi antre yon nimewo mobil 10 chif ki valab."); render(); return; }
    state.representativeFullName = fullName;
    state.representativeRelationship = relationship;
    state.representativeAuthorityType = authorityType;
    state.representativePhone = phone;
    state.phoneVerified = false;
    state.phoneVerifiedAt = "";
    state.representativeAuthorityAttested = false;
    state.authorityAttestation = false;
    state.authorityAttestedAt = "";
    state.busy = true; render();
    const sent = await service.sendRepresentativeOtp(phone);
    state.busy = false;
    if (!sent.sent && sent.reason !== "rate_limited") { state.error = L("We couldn’t send the code. Please try again.", "No pudimos enviar el código. Inténtelo de nuevo.", "Nou pa t kapab voye kòd la. Tanpri eseye ankò."); render(); return; }
    state.representativeOtpDeliveryId = sent.deliveryId;
    state.representativeOtpResendAvailableAt = Date.now() + (sent.retryAfterSeconds || 30) * 1000;
    audit(state, "representative_details_confirmed", "success", { relationshipToPatient: relationship, authorityType });
    audit(state, "representative_phone_otp_sent", "success", { maskedPhone: maskedPhone(phone), method: "SMS_OTP" });
    state.screen = nextScreen(state); draftStore.save(state); render(); return;
  }
  if (state.screen === "REPRESENTATIVE_MOBILE_VERIFICATION") {
    const code = phoneDigits(new FormData(document.querySelector("#representative-otp-form")).get("representativeOtp"));
    if (code.length !== 6) { state.error = L("Enter the 6-digit verification code.", "Ingrese el código de verificación de 6 dígitos.", "Antre kòd verifikasyon 6 chif la."); render(); return; }
    state.busy = true; render();
    const result = await service.verifyRepresentativeOtp({ deliveryId: state.representativeOtpDeliveryId, phone: state.representativePhone, code });
    state.busy = false;
    if (!result.verified) {
      state.error = result.reason === "expired" ? L("This code has expired. Please request a new code.", "Este código venció. Solicite uno nuevo.", "Kòd sa a ekspire. Tanpri mande yon nouvo kòd.") : result.reason === "locked" ? L("Too many attempts. Please request a new code.", "Demasiados intentos. Solicite un nuevo código.", "Twòp tantativ. Tanpri mande yon nouvo kòd.") : L("That code isn’t correct. Please try again.", "Ese código no es correcto. Inténtelo de nuevo.", "Kòd sa a pa kòrèk. Tanpri eseye ankò.");
      audit(state, "representative_phone_otp_verified", "failed", { reason: result.reason }); render(); return;
    }
    state.phoneVerified = true;
    state.phoneVerificationMethod = "SMS_OTP";
    state.phoneVerifiedAt = result.verifiedAt;
    state.representativeOtpDeliveryId = "";
    audit(state, "representative_phone_otp_verified", "success", { maskedPhone: maskedPhone(state.representativePhone), method: "SMS_OTP" });
    state.screen = nextScreen(state); draftStore.save(state); render(); return;
  }
  if (state.screen === "REPRESENTATIVE_AUTHORITY_ATTESTATION") {
    const attested = document.querySelector('[name="representativeAuthorityAttested"]')?.checked;
    if (!attested || !state.phoneVerified) { state.error = L("Please confirm your authority to continue.", "Confirme su autoridad para continuar.", "Tanpri konfime otorite ou pou kontinye."); render(); return; }
    state.representativeAuthorityAttested = true;
    state.authorityAttestation = true;
    state.authorityAttestedAt = new Date().toISOString();
    state.authorityVerificationMethod = AUTHORITY_VERIFICATION_METHODS[0];
    audit(state, "representative_authority_attested", "success", { authorityType: state.representativeAuthorityType, verificationMethod: state.authorityVerificationMethod });
  }
  if (state.screen === "IDENTITY_VERIFICATION") {
    const form = document.querySelector("#identity-form"), data = Object.fromEntries(new FormData(form));
    data.dob = (data.dob || "").replace(/\s/g, "");
    if (!isValidBirthDate(data.dob) || !/^\d{5}$/.test(data.zip || "")) { state.error = L("Enter a valid date as MM / DD / YYYY and a 5-digit ZIP code.", "Ingrese una fecha válida como MM / DD / AAAA y un código postal de 5 dígitos.", "Antre yon dat valab kòm MM / JJ / AAAA ak yon kòd postal 5 chif."); render(); return; }
    state.busy = true; render(); const result = await service.verifyIdentity(data); state.busy = false;
    if (!result.verified) { state.identityAttempts += 1; state.error = L(`We couldn’t match that information. ${result.remainingAttempts} attempts remain.`, `No pudimos verificar la información. Quedan ${result.remainingAttempts} intentos.`, `Nou pa t kapab verifye enfòmasyon sa yo. Ou gen ${result.remainingAttempts} tantativ ki rete.`); render(); return; }
    state.identityVerified = true; audit(state, "identity_verified");
    sendPendingCareCircleInvite();
  }
  if (state.screen === "ACCESS_PRE_ELIGIBILITY_NOTICE") {
    if (!document.querySelector('[name="accessNotice"]')?.checked) { state.error = L("Please acknowledge this information to continue.", "Reconozca esta información para continuar.", "Tanpri rekonèt enfòmasyon sa yo pou kontinye."); render(); return; }
    state.accessNoticeAcknowledgedAt = new Date().toISOString();
    audit(state, "access_eligibility_notice_acknowledged", "success", { disclosureVersion: state.offer.disclosures.version });
  }
  if (state.screen === "ACCESS_MEDICARE_IDENTIFIER") { const mbi = document.querySelector('[name="mbi"]')?.value.replace(/\s/g, ""); if (!/^[A-Za-z0-9]{11}$/.test(mbi || "")) { state.error = L("Enter the 11-character number from your Medicare card.", "Ingrese los 11 caracteres de su tarjeta de Medicare.", "Antre nimewo 11 karaktè ki soti nan kat Medicare ou a."); render(); return; } audit(state, "medicare_identifier_verified"); }
  if (state.screen === "DISCLOSURE") {
    if (!document.querySelector('[name="acknowledge"]')?.checked) { state.error = L("Please confirm you reviewed this information.", "Confirme que revisó esta información.", "Tanpri konfime ou revize enfòmasyon sa a."); render(); return; }
    await service.saveAcknowledgement(); audit(state, "disclosure_acknowledged");
  }
  if (state.screen === "CONSENT_REVIEW") {
    const f = document.querySelector("#consent-form");
    const authorityMissing = state.role === "representative" && !f.authority?.checked;
    const enrollMissing = Boolean(f.enroll) && !f.enroll.checked;
    if (authorityMissing || !f.consent.checked || enrollMissing) { state.error = L("Please complete each required confirmation to continue.", "Complete cada confirmación requerida para continuar.", "Tanpri ranpli tout konfimasyon ki nesesè pou kontinye."); render(); return; }
    // render() replaces the form while the consent service is saving. Preserve the confirmations
    // that were submitted so the loading state cannot visually revoke the choice the patient made.
    state.consentSubmissionSelections = {
      authority: Boolean(f.authority?.checked),
      consent: Boolean(f.consent.checked),
      enroll: Boolean(f.enroll?.checked)
    };
    state.busy = true; render();
    if (state.offer.pathway === "ACCESS" && !state.disclosureAcknowledgedAt) {
      await service.saveAcknowledgement();
      state.disclosureAcknowledgedAt = new Date().toISOString();
      state.disclosureVersion = state.offer.disclosures.version;
      audit(state, "disclosure_acknowledged", "success", { disclosureVersion: state.disclosureVersion, acknowledgedOn: "CONSENT_REVIEW" });
    }
    await service.saveConsent(); state.busy = false; state.consentSaved = true;
    state.consentSubmissionSelections = null;
    state.consentRole = isPersonalRepresentative() ? "PERSONAL_REPRESENTATIVE" : "PATIENT";
    state.consentVersion = state.offer.consent.version;
    state.consentTimestamp = new Date().toISOString();
    // The screen now asks for one tick where it used to ask for two, so the record has to carry
    // what the patient was actually shown at the moment they agreed. A single affirmative act is
    // only defensible if the evidence behind it stays complete: what was displayed, when, in which
    // language, at what expected cost and against which coverage verification.
    // Resolved the same way the card resolves it, so the evidence records the sentence the patient
    // actually read rather than a second opinion about their coverage.
    const displayedCost = accessCostSummary(currentAccessCost());
    state.consentAcknowledgement = {
      consentShape: state.offer.pathway === "ACCESS" ? "SINGLE_AFFIRMATIVE" : "SEPARATE_CONFIRMATIONS",
      disclosureVersion: state.disclosureVersion || state.offer.disclosures.version,
      consentVersion: state.consentVersion,
      signerRole: state.consentRole,
      locale: state.language,
      // When the disclosure was put in front of them, distinct from when they accepted it.
      displayedAt: state.accessDisclosureView?.viewedAt || state.disclosureAcknowledgedAt || null,
      acceptedAt: state.consentTimestamp,
      displayedExpectedPatientPayment: displayedCost?.amountLabel || null,
      coverageVerificationStatus: (state.offer.accessCost || {}).secondaryCoverageStatus || null,
      sessionId: state.sessionId,
      enrollmentId: state.enrollmentId || null
    };
    audit(state, "consent_saved", "success", { ...state.consentAcknowledgement });
  }
  if (state.screen === "ENROLLMENT_CONFIRMED") {
    state.enrollmentConfirmed = true;
    state.enrollmentStatus = "COMPLETED";
    state.enrollmentCompletedAt ||= new Date().toISOString();
    state.activationStatus = "NOT_STARTED";
    if (state.offer.pathway === "ACCESS") {
      // The health check used to open the baseline and mark it started. Care activation begins here
      // instead, so the baseline begins here too — otherwise it would sit at NOT_STARTED with
      // nothing left in the journey able to move it, and the audit trail would lose the moment.
      state.baselineStatus ||= "NOT_STARTED";
      if (state.baselineStatus === "NOT_STARTED") {
        state.baselineStatus = "IN_PROGRESS";
        state.baselineStartedAt = new Date().toISOString();
        audit(state, "baseline_started", "success", { baselineStatus: state.baselineStatus });
      }
      state.baselineResumeScreen = "ACCESS_BP_DEVICE_INFO";
      state.baselineReminderStatus = "NOT_SCHEDULED";
    }
    if (["RPM", "CCM_RPM", "PCM_RPM"].includes(state.offer.pathway)) state.deviceSetupStatus ||= "NOT_STARTED";
    setGettingStartedProgress(FLOW_STATUS.NOT_STARTED, { resumeRoute: currentNextBestAction().route });
    audit(state, "next_flow_presented", "success", { enrollmentStatus: state.enrollmentStatus, nextFlowType: "GETTING_STARTED", pathway: state.offer.pathway });
  }
  if (state.screen === "ACCESS_BP_DEVICE_INFO") {
    const form = document.querySelector("#bp-device-info-form");
    const data = Object.fromEntries(new FormData(form));
    // The arm restriction question left this screen. Which arm to avoid is clinical context for
    // taking a reading, not something needed to put the right box in the post, and it is taught
    // where it is useful: at device setup, with the cuff in the patient’s hands. Nothing below
    // reads an arm, and the cuff size is the only answer this step still needs.
    const deviceConfiguration = bpFulfillmentDeviceConfiguration();
    const availableCuffs = (deviceConfiguration?.cuffOptions || []).filter(option => option.inventoryStatus === "AVAILABLE" && option.compatibleDeviceModels.includes(deviceConfiguration.id));
    state.deviceModelSelected = deviceConfiguration?.id || null;
    // Entering centimetres left this screen together with the toggle that opened the field. The
    // size the patient picks is the answer, so there is one way to answer and nothing to match.
    const selectedId = data.choice || state.selectedCuffOption;
    if (!selectedId) { state.error = L("Choose a cuff size.", "Elija una talla de brazalete.", "Chwazi yon gwosè manchèt."); render(); return; }
    const selectedOption = availableCuffs.find(option => option.id === selectedId);
    if (!selectedOption) { state.error = L("That cuff is not currently available for this monitor. Choose another option.", "Ese brazalete no está disponible actualmente para este monitor. Elija otra opción.", "Manchèt sa a pa disponib kounye a pou aparèy sa a. Chwazi yon lòt opsyon."); render(); return; }
    state.cuffSelectionMethod = "PATIENT_SELECTED";
    state.selectedCuffOption = selectedOption.id;
    state.cuffSizeSelected = selectedOption.labelKey;
    state.cuffSelectionStatus = "SELECTED";
    state.armMeasurementStatus = "NOT_REQUIRED";
    state.armCircumferenceValue = "";
    const tasks = [...(state.careTeamTasks || [])];
    const addTask = (type, reason) => { if (!tasks.some(task => task.type === type && task.status === "OPEN")) tasks.push({ id: `${type.toLowerCase()}_${Date.now().toString(36)}`, type, reason, status: "OPEN", createdAt: new Date().toISOString() }); };
    if (state.cuffSelectionStatus === "NEEDS_ASSISTANCE") addTask("CUFF_SELECTION_ASSISTANCE", state.cuffSelectionMethod);
    state.careTeamTasks = tasks;
    state.baselineResumeScreen = "ACCESS_BP_SHIPPING_ADDRESS";
    audit(state, "bp_device_information_saved", "success", { armMeasurementStatus: state.armMeasurementStatus, cuffSelectionMethod: state.cuffSelectionMethod, cuffSelectionStatus: state.cuffSelectionStatus, selectedCuffOption: state.selectedCuffOption, deviceModelSelected: state.deviceModelSelected });
  }
  if (state.screen === "ACCESS_BP_SHIPPING_ADDRESS") {
    const form = document.querySelector("#bp-shipping-form");
    const data = Object.fromEntries(new FormData(form));
    const mode = data.choice || state.shippingAddressMode || "existing";
    let address;
    if (mode === "existing") address = state.offer.patient.shippingAddress;
    else {
      address = { line1: String(data.line1 || "").trim(), unit: String(data.unit || "").trim(), city: String(data.city || "").trim(), state: String(data.state || "").trim().toUpperCase(), zip: String(data.zip || "").replace(/\D/g, "").slice(0, 5) };
      if (!address.line1 || !address.city || !/^[A-Z]{2}$/.test(address.state) || !/^\d{5}$/.test(address.zip)) { state.error = L("Enter a complete delivery address with a 2-letter state and 5-digit ZIP code.", "Ingrese una dirección completa con un estado de 2 letras y un código postal de 5 dígitos.", "Antre yon adrès livrezon konplè ak eta 2 lèt ak kòd postal 5 chif."); render(); return; }
    }
    state.shippingAddressMode = mode;
    state.shippingAddress = address;
    state.busy = true; state.error = ""; render();
    const result = await service.createBpDeviceFulfillment({ shippingAddress: address, armMeasurementStatus: state.armMeasurementStatus, cuffSelectionMethod: state.cuffSelectionMethod, selectedCuffOption: state.selectedCuffOption, cuffSelectionStatus: state.cuffSelectionStatus, deviceModelSelected: state.deviceModelSelected });
    state.busy = false;
    if (result.status !== "requested") { state.error = L("We couldn’t complete the request yet. Please try again or talk with your care team.", "Aún no pudimos completar la solicitud. Inténtelo de nuevo o hable con su equipo.", "Nou poko kapab ranpli demann lan. Eseye ankò oswa pale ak ekip swen ou."); render(); return; }
    state.shippingAddressConfirmed = true;
    state.deviceFulfillmentId = result.fulfillmentId;
    state.deviceFulfillmentStatus = "REQUESTED";
    state.bpDeviceFulfillmentStatus = "REQUESTED";
    state.bpDeviceFulfillmentRequestedAt = result.requestedAt;
    state.bpBaselineStatus = "PENDING_DEVICE";
    state.baselineStatus = "IN_PROGRESS";
    state.baselineResumeScreen = "ACCESS_BP_FULFILLMENT_CONFIRMED";
    state.baselineReminderStatus = "PENDING_DEVICE";
    if (result.cuffSelectionStatus === "CARE_TEAM_REVIEW_REQUIRED" && !(state.careTeamTasks || []).some(task => task.type === "CUFF_CONFIGURATION_REVIEW" && task.status === "OPEN")) state.careTeamTasks.push({ id: `cuff_review_${Date.now().toString(36)}`, type: "CUFF_CONFIGURATION_REVIEW", reason: state.armMeasurementStatus, status: "OPEN", createdAt: new Date().toISOString() });
    audit(state, "bp_device_fulfillment_requested", "success", { fulfillmentId: result.fulfillmentId, shippingAddressConfirmed: true, cuffSelectionStatus: result.cuffSelectionStatus, cuffSizeSelected: state.cuffSizeSelected, selectedCuffOption: state.selectedCuffOption, deviceModelSelected: state.deviceModelSelected });
  }
  if (state.screen === "ACCESS_BP_DEVICE_VERIFICATION") {
    const choiceValue = new FormData(document.querySelector("form")).get("choice");
    if (!choiceValue) { state.error = L("Choose the option that best describes your situation.", "Elija la opción que mejor describa su situación.", "Chwazi opsyon ki pi byen dekri sitiyasyon ou."); render(); return; }
    if (choiceValue === "patient-owned") {
      state.deviceSource = "PATIENT_OWNED";
      state.deviceVerificationStatus = "UNSUPPORTED";
      state.bpDeviceVerificationStatus = "VERIFIED_INCOMPATIBLE";
      state.bpBaselineStatus = "DEVICE_VERIFICATION";
      state.baselineResumeScreen = "ACCESS_BP_DEVICE_RESULT";
      state.screen = "ACCESS_BP_DEVICE_RESULT";
      audit(state, "bp_patient_owned_device_selected", "unsupported_for_access");
      draftStore.save(state); render(); return;
    }
    if (choiceValue === "need-itera" || choiceValue === "assignment-no") {
      state.bpDevicePath = "needed";
      state.deviceSource = "UNKNOWN";
      state.deviceVerificationStatus = "PENDING_DEVICE";
      state.bpDeviceVerificationStatus = "NOT_STARTED";
      state.bpBaselineStatus = "DEVICE_VERIFICATION";
      state.baselineResumeScreen = "ACCESS_BP_DEVICE_INFO";
      state.screen = "ACCESS_BP_DEVICE_INFO";
      audit(state, "bp_connected_device_requested", "success", { reason: choiceValue });
      draftStore.save(state); render(); return;
    }
    if (choiceValue === "situation-unsure") { state.deviceSource = "UNKNOWN"; state.deviceUncertaintyStep = true; state.error = ""; render(); return; }
    if (choiceValue === "assignment-yes") { state.deviceUncertaintyStep = false; state.deviceVerificationStatus = "CHECKING"; runAssignedDeviceLookup(); return; }
    if (choiceValue === "assignment-unsure") {
      state.deviceSource = "UNKNOWN";
      state.deviceVerificationStatus = "NEEDS_REVIEW";
      state.bpDeviceVerificationStatus = "NEEDS_REVIEW";
      state.baselineReminderStatus = "CARE_TEAM_ASSISTANCE";
      audit(state, "bp_device_identification_help_requested", "success", { reason: "patient_unsure" });
      draftStore.save(state); showHelp(); return;
    }
  }
  if (state.screen === "ACCESS_BP_DEVICE_RESULT" && ["ASSIGNED", "DEVICE_MISMATCH", "SOURCE_MISMATCH"].includes(state.deviceVerificationStatus)) {
    if (state.deviceVerificationStatus !== "ASSIGNED") return;
    const choiceValue = new FormData(document.querySelector("#assigned-device-confirmation-form")).get("choice");
    if (!choiceValue) { state.error = L("Choose an answer to continue.", "Seleccione una respuesta para continuar.", "Chwazi yon repons pou kontinye."); render(); return; }
    if (choiceValue === "unsure") {
      state.deviceUncertaintyStep = true;
      state.patientDeviceConfirmationChoice = "";
      audit(state, "bp_patient_device_confirmation", "unsure", { assignedDeviceId: state.assignedDeviceId, last4DeviceId: state.last4DeviceId });
      draftStore.save(state); render(); return;
    }
    if (["yes", "matches"].includes(choiceValue)) {
      const confirmedAt = new Date().toISOString();
      state.patientDeviceConfirmed = true;
      state.patientDeviceConfirmedAt = confirmedAt;
      state.confirmedDeviceId = state.assignedDeviceId;
      state.deviceVerificationStatus = "PATIENT_CONFIRMED";
      state.bpDeviceVerificationStatus = "PATIENT_CONFIRMED";
      state.bpBaselineStatus = "NOT_STARTED";
      state.deviceUncertaintyStep = false;
      state.patientDeviceConfirmationChoice = "";
      audit(state, "bp_patient_device_confirmed", "success", { assignedDeviceId: state.assignedDeviceId, confirmedDeviceId: state.confirmedDeviceId, patientDeviceConfirmedAt: confirmedAt });
    } else if (["no", "different"].includes(choiceValue)) {
      state.patientDeviceConfirmed = false;
      state.patientDeviceConfirmedAt = new Date().toISOString();
      state.confirmedDeviceId = "";
      state.deviceVerificationStatus = "DEVICE_MISMATCH";
      state.bpDeviceVerificationStatus = "NEEDS_REVIEW";
      state.bpBaselineStatus = "DEVICE_VERIFICATION";
      state.deviceUncertaintyStep = false;
      state.patientDeviceConfirmationChoice = "";
      audit(state, "bp_patient_device_confirmed", "mismatch", { assignedDeviceId: state.assignedDeviceId, last4DeviceId: state.last4DeviceId });
      draftStore.save(state); render(); return;
    } else if (choiceValue === "help") {
      state.deviceVerificationStatus = "NEEDS_REVIEW";
      state.bpDeviceVerificationStatus = "NEEDS_REVIEW";
      state.baselineReminderStatus = "CARE_TEAM_ASSISTANCE";
      audit(state, "bp_patient_device_confirmation", "needs_review", { assignedDeviceId: state.assignedDeviceId, reason: "PATIENT_UNSURE" });
      draftStore.save(state); showHelp(); return;
    }
  }
  if (state.screen === "ACCESS_BP_GUIDED_SETUP") {
    state.bpDeviceVerificationStatus = state.bpDeviceVerificationStatus === "VERIFIED_COMPATIBLE" ? "VERIFIED_COMPATIBLE" : "ASSISTED_READY";
    if (!state.bpDevice && state.bpDevicePath === "help") state.bpDevice = { deviceId: "demo-upper-arm-01", deviceModel: "Connected upper-arm monitor", deviceType: "UPPER_ARM", source: "CONNECTED_DEVICE", sourceVerified: true };
    if (!state.confirmedDeviceId && state.bpDevice?.deviceId) state.confirmedDeviceId = state.bpDevice.deviceId;
    state.deviceVerificationStatus = "WAITING_FOR_READING";
    state.bpBaselineStatus = "NOT_STARTED";
    state.bpBaselineSourceType = "VERIFIED_DEVICE";
    state.baselineResumeScreen = "ACCESS_BP_MEASUREMENT";
    audit(state, "bp_device_ready", "success", { devicePath: state.bpDevicePath });
  }
  if (state.screen === "ACCESS_BP_MEASUREMENT") {
    if (state.bpMeasurementPhase === "RECEIVED") {
      state.baselineResumeScreen = "ONBOARDING";
      state.baselineReminderStatus = state.bpBaselineRemainingReadings > 0 ? "BP_READINGS_PENDING" : "NOT_NEEDED";
    } else {
      state.deviceVerificationStatus = "WAITING_FOR_READING";
      state.busy = true; state.error = ""; render();
      const result = await service.receiveAccessBpReading({ readingNumber: 1, deviceId: state.confirmedDeviceId || state.bpDevice?.deviceId, deviceModel: state.bpDevice?.deviceModel });
      state.busy = false;
      if (result.status !== "received" || !result.sourceVerified) {
        state.error = "bp-reading";
        state.deviceVerificationStatus = "FAILED";
        state.bpMeasurementPhase = "WAITING";
        state.baselineResumeScreen = "ACCESS_BP_MEASUREMENT";
        audit(state, "bp_device_test_reading", "not_verified", { reason: result.reason || "source_not_verified" });
        draftStore.save(state); render(); return;
      }
      const recorded = await recordAccessBpObservation(result, { firstTransmission: true });
      if (!recorded.accepted) {
        if (recorded.duplicate) { state.error = "bp-reading"; state.deviceVerificationStatus = "FAILED"; draftStore.save(state); render(); return; }
        state.firstTransmissionVerified = false;
        state.firstTransmissionDeviceId = recorded.sourceDeviceId || result.deviceId || "";
        state.firstTransmissionAt = result.receivedAt || result.timestamp || new Date().toISOString();
        state.deviceVerificationStatus = "SOURCE_MISMATCH";
        state.bpDeviceVerificationStatus = "NEEDS_REVIEW";
        state.bpBaselineStatus = "NOT_STARTED";
        state.baselineReminderStatus = "CARE_TEAM_ASSISTANCE";
        state.baselineResumeScreen = "ACCESS_BP_DEVICE_RESULT";
        if (!(state.careTeamTasks || []).some(task => task.type === "BP_DEVICE_SOURCE_REVIEW" && task.status === "OPEN")) state.careTeamTasks.push({ id: `bp_device_source_review_${Date.now().toString(36)}`, type: "BP_DEVICE_SOURCE_REVIEW", reason: "SOURCE_MISMATCH", status: "OPEN", createdAt: new Date().toISOString() });
        audit(state, "bp_first_transmission_source_verified", "source_mismatch", { assignedDeviceId: state.assignedDeviceId, confirmedDeviceId: state.confirmedDeviceId, firstTransmissionDeviceId: state.firstTransmissionDeviceId, firstTransmissionAt: state.firstTransmissionAt });
        state.screen = "ACCESS_BP_DEVICE_RESULT";
        draftStore.save(state); render(); return;
      }
      audit(state, "bp_first_transmission_source_verified", "success", { assignedDeviceId: state.assignedDeviceId, confirmedDeviceId: state.confirmedDeviceId, firstTransmissionDeviceId: state.firstTransmissionDeviceId, firstTransmissionAt: state.firstTransmissionAt });
      state.bpMeasurementPhase = "RECEIVED";
      state.baselineResumeScreen = "ACCESS_BP_MEASUREMENT";
      draftStore.save(state); render(); return;
    }
  }
  if (state.screen === "ONBOARDING") {
    state.enrollmentStatus = "COMPLETED";
    state.baselineResumeScreen = "ONBOARDING";
    state.onboarding = {
      ...state.onboarding,
      medicationsReviewStatus: state.medicationsReviewStatus,
      carePreferencesStatus: state.carePreferencesStatus,
      goalsStatus: state.goalsStatus,
      supportNeedsStatus: state.supportNeedsStatus,
      savedAt: new Date().toISOString()
    };
    // The barriers question is a section of this list now, so it counts towards it. Only ACCESS
    // asks it, and on every other programme the status stays NOT_STARTED and counts as nothing.
    audit(state, "care_setup_saved", "success", { completedSections: [state.medicationsReviewStatus, state.carePreferencesStatus, state.goalsStatus, state.supportNeedsStatus].filter(status => status === "COMPLETED").length });
    state.screen = "ONBOARDING_COMPLETE";
    draftStore.save(state); render(); return;
  }
  if (state.screen === "MEDICATIONS_REVIEW") {
    const reviewedCount = state.careMedications.filter(medication => state.medicationReviews?.[medication.id]?.reviewStatus && state.medicationReviews[medication.id].reviewStatus !== "UNREVIEWED").length;
    const additionalReviewed = ["NONE", "ADDED", "UNSURE"].includes(state.additionalMedicationsStatus);
    if (reviewedCount !== state.careMedications.length || !additionalReviewed) { state.error = L("Review each medication and tell us whether anything is missing.", "Revise cada medicamento e indique si falta alguno.", "Revize chak medikaman epi di nou si gen youn ki manke."); render(); return; }
    state.medicationsReviewStatus = "COMPLETED";
    state.baselineResumeScreen = "ONBOARDING";
    const changesReported = Object.values(state.medicationReviews || {}).filter(review => review.reviewStatus !== "CONFIRMED_CURRENT").length;
    audit(state, "medications_review_completed", "success", { medicationsShown: state.careMedications.length, medicationsReviewed: reviewedCount, changesReported, additionalMedicationsStatus: state.additionalMedicationsStatus, additionalMedicationCount: state.additionalMedications.length });
    state.screen = "ONBOARDING";
    draftStore.save(state); render(); return;
  }
  if (state.screen === "CARE_PREFERENCES") {
    const data = Object.fromEntries(new FormData(document.querySelector("#care-preferences-form")));
    if (!data.preferredContactMethod) { state.error = L("Choose how you prefer to be contacted.", "Elija cómo prefiere que le contacten.", "Chwazi kijan ou prefere nou kontakte ou."); render(); return; }
    state.preferredContactMethod = data.preferredContactMethod;
    state.preferredCareLanguage = data.preferredCareLanguage || state.language;
    state.preferredContactTime = data.preferredContactTime || "none";
    state.carePreferencesStatus = "COMPLETED";
    state.baselineResumeScreen = "ONBOARDING";
    audit(state, "care_preferences_completed", "success", { contactMethod: state.preferredContactMethod, preferredLanguage: state.preferredCareLanguage, timeOfDay: state.preferredContactTime });
    state.screen = "ONBOARDING";
    draftStore.save(state); render(); return;
  }
  if (state.screen === "ACCESS_SUPPORT_NEEDS") {
    const form = document.querySelector("#support-needs-form");
    const data = new FormData(form);
    state.supportNeedsOther = String(data.get("otherConcern") || "").trim();
    const now = new Date().toISOString();
    const created = [];
    const reviewedGoalIds = [...new Set(data.getAll("supportGoalId").map(String))];
    const reviewedGoals = reviewedGoalIds.map(patientGoalById).filter(Boolean);
    const answers = reviewedGoals.map((goal, index) => {
      // "Nothing right now" is an answer, not a barrier. Selecting it alongside a difficulty is a
      // contradiction the patient did not mean, so an explicit difficulty wins.
      const raw = data.getAll(`barrier:${goal.id}`).map(String);
      const picked = raw.filter(value => value !== "NONE");
      if (index === 0 && state.supportNeedsOther) picked.push("OTHER");
      return { goal, raw, picked: [...new Set(picked)] };
    });
    state.supportNeedsDraft = Object.fromEntries(answers.map(({ goal, raw, picked }) => [goal.id, picked.length ? picked : raw.includes("NONE") ? ["NONE"] : []]));
    const unanswered = answers.filter(({ raw, picked }) => !raw.includes("NONE") && !picked.length);
    const answered = answers.filter(({ raw, picked }) => raw.includes("NONE") || picked.length);
    if (!reviewedGoals.length || !answered.length) {
      state.error = L("Choose an answer for each goal, including ‘Nothing right now’ if nothing is making it harder.", "Elija una respuesta para cada objetivo, incluso ‘Nada por ahora’ si nada lo dificulta.", "Chwazi yon repons pou chak objektif, menm ‘Anyen pou kounye a’ si pa gen anyen ki fè li pi difisil.");
      render(); return;
    }
    answered.forEach(({ goal, raw, picked }, index) => {
      picked.forEach(category => {
        if (findReusableBarrier(goal.barriers || [], { category, goalId: goal.id })) return;
        const barrier = createGoalBarrier({ patientId: state.offer?.patient?.id || "", goalId: goal.id, category, patientDescription: category === "OTHER" && index === 0 ? state.supportNeedsOther : "", source: BARRIER_SOURCES.PATIENT, status: BARRIER_STATUS.OPEN, detectedAt: now });
        goal.barriers = [...(goal.barriers || []), applyFirstIntervention(barrier, now)];
        created.push({ goalType: goal.goalType, category });
      });
      const selectedCategories = picked.length ? picked : ["NONE"];
      goal.supportNeedsAssessment = { status: "COMPLETED", selectedCategories, reviewedAt: now };
      goal.updatedAt = now;
    });
    state.error = "";
    state.supportNeedsDraft = {};
    syncAccessGoalsStatus();
    audit(state, "access_support_needs_recorded", "success", { barrierCount: created.length, categories: created.map(item => item.category), reviewedGoalCount: answered.length, goalsStatus: state.goalsStatus });
    if (unanswered.length) {
      state.error = L("Continue with the remaining goal.", "Continúe con el objetivo pendiente.", "Kontinye ak objektif ki rete a.");
      draftStore.save(state); render(); return;
    }
    state.screen = state.returnScreen === "ONBOARDING" ? "ONBOARDING" : nextScreen(state);
    draftStore.save(state); render(); return;
  }
  // GOALS uses its own multi-step actions so discovery, priority and planning remain auditable.
  // ACCESS has no discovery: the goals are assigned, the screen has a single action, and that
  // action belongs here. Without this branch the early return below swallowed it and the primary
  // button did nothing at all.
  if (state.screen === "GOALS") {
    if (state.offer?.pathway !== "ACCESS") return;
    ensureAssignedAccessGoals();
    // Viewing assigned goals is not completion. The barriers review that follows records an answer
    // for each goal and is the only place that can complete this setup section.
    state.screen = nextScreen(state);
    draftStore.save(state); render(); return;
  }
  if (state.screen === "RPM_DEVICE_PATH") { state.devicePath = new FormData(document.querySelector("form")).get("choice"); if (state.devicePath === "help" || !state.devicePath) { showHelp(); return; } }
  if (state.screen === "RPM_ADDRESS_CONFIRMATION") state.addressConfirmed = true;
  if (state.screen === "RPM_DEVICE_SETUP") state.setupComplete = true;
  if (state.screen === "RPM_FIRST_READING") {
    state.busy = true; render(); const result = await service.submitFirstReading(); state.busy = false;
    if (result.status !== "received") { state.error = "reading"; audit(state, "first_reading", "not_received"); render(); return; }
    state.readingReceived = true; state.reading = result; audit(state, "first_reading", "received");
  }
  state.screen = nextScreen(state);
  // A patient who pressed "Send invitation" and was taken through identity first has not seen it
  // go. They see the confirmation, and Done carries them on to where the enrollment was heading.
  if (state.careCircleJustSent) {
    state.careCircleJustSent = false;
    state.growthReturnScreen = state.screen;
    state.screen = "CARE_CIRCLE_INVITE_SENT";
  }
  draftStore.save(state); render();
  if (state.screen === "ACCESS_ELIGIBILITY_PROCESSING") runEligibility();
  if (state.screen === "ENROLLMENT_PROCESSING") runEnrollment();
  if (state.screen === "ACCESS_ALIGNMENT_PROCESSING") runAlignment();
  startAssignedDeviceLookupIfPending();
  if (["ONBOARDING", "CLINICAL_VERIFICATION", "MEDICATIONS_REVIEW", "CARE_PREFERENCES", "GOALS", "ONBOARDING_COMPLETE"].includes(state.screen) && state.bpBaselineStatus === "IN_PROGRESS") syncPendingAccessBpObservations();
}

async function runEligibility() {
  if (eligibilityRequest) return eligibilityRequest;
  if (state.accessOutcome) { if (state.screen === "ACCESS_ELIGIBILITY_PROCESSING") { state.screen = "ACCESS_ELIGIBILITY_RESULT"; render(); } return; }
  state.eligibilityError = false;
  state.eligibilityPhase = "verifyingCoverage";
  state.eligibilityRequestKey ||= globalThis.crypto?.randomUUID?.() || `eligibility_${Date.now().toString(36)}`;
  draftStore.save(state);
  render();
  eligibilityRequest = service.checkAccessEligibility({
    idempotencyKey: state.eligibilityRequestKey,
    onProgress: phase => {
      state.eligibilityPhase = phase;
      if (state.screen === "ACCESS_ELIGIBILITY_PROCESSING") render();
    }
  });
  try {
    const result = await eligibilityRequest;
    state.accessOutcome = result.outcome;
    state.accessEligible = result.outcome === "eligible";
    state.eligibilityPhase = "completed";
    audit(state, "access_eligibility", result.outcome);
    if (state.screen === "ACCESS_ELIGIBILITY_PROCESSING") state.screen = "ACCESS_ELIGIBILITY_RESULT";
    draftStore.save(state);
    render();
  } catch {
    state.eligibilityError = true;
    audit(state, "access_eligibility", "temporarily_unavailable");
    draftStore.save(state);
    if (state.screen === "ACCESS_ELIGIBILITY_PROCESSING") render();
  } finally {
    eligibilityRequest = null;
  }
}
async function runEnrollment() {
  const result = await service.createTraditionalEnrollment();
  if (result.status !== "confirmed") return;
  state.enrollmentConfirmed = true;
  state.enrollmentStatus = "COMPLETED";
  state.enrollmentCompletedAt = new Date().toISOString();
  state.activationStatus = "NOT_STARTED";
  const transition = currentFlowTransition();
  setGettingStartedProgress(FLOW_STATUS.NOT_STARTED, { resumeRoute: transition.nextRoute });
  audit(state, "enrollment", "confirmed");
  audit(state, "enrollment_completed", "success", { enrollmentStatus: state.enrollmentStatus, activationStatus: state.activationStatus });
  audit(state, "flow_completed", "success", { flowType: "ENROLLMENT" });
  audit(state, "next_flow_presented", "success", { nextFlowType: transition.nextFlow, pathway: state.offer.pathway });
  state.screen = "ENROLLMENT_CONFIRMED";
  draftStore.save(state);
  render();
}
async function runAlignment() {
  const attributionShareId = new URLSearchParams(location.search).get("shareId");
  if (attributionShareId) growthStore.updateAccessShare(attributionShareId, { enrollmentStarted: true });
  const result = await service.submitAccessAlignment();
  if (result.status === "confirmed") {
    state.alignmentConfirmed = true; state.enrollmentConfirmed = true; state.enrollmentStatus = "COMPLETED"; state.enrollmentCompletedAt = new Date().toISOString(); state.activationStatus = "NOT_STARTED";
    if (attributionShareId) growthStore.updateAccessShare(attributionShareId, { enrollmentCompleted: true });
    const transition = currentFlowTransition();
    setGettingStartedProgress(FLOW_STATUS.NOT_STARTED, { resumeRoute: transition.nextRoute });
    audit(state, "alignment", "confirmed");
    audit(state, "enrollment_completed", "success", { enrollmentStatus: state.enrollmentStatus, activationStatus: state.activationStatus, pathway: "ACCESS" });
    audit(state, "flow_completed", "success", { flowType: "ENROLLMENT" });
    audit(state, "next_flow_presented", "success", { nextFlowType: transition.nextFlow, pathway: "ACCESS" });
    state.screen = "ENROLLMENT_CONFIRMED"; draftStore.save(state); render();
  }
}
// Re-rendering the panel must never cost the patient what they were typing: the field is restored
// from the live DOM, not from state, because a half-written question is not application state.
function revealAssistantHumanSupport() {
  // Support is collapsed by default now, so revealing it has to open it before it can be pointed at.
  if (!state.assistantSupportOpen) { state.assistantSupportOpen = true; refreshAssistantLayer(); }
  const section = document.querySelector(".assistant-human-support");
  if (!section) return;
  section.scrollIntoView({ behavior: "smooth", block: "center" });
  section.classList.add("is-highlighted");
  section.focus({ preventScroll: true });
  setTimeout(() => section.classList.remove("is-highlighted"), 2000);
  audit(state, "emmi_human_support_revealed", "success", { screen: state.screen });
}

// How close to the bottom still counts as "following along". A patient who has scrolled up to
// re-read an earlier answer is reading, and a new message must not yank them away from it.
const ASSISTANT_FOLLOW_THRESHOLD = 96;

function refreshAssistantLayer({ focusInput = false } = {}) {
  const current = document.querySelector(".assistant-layer");
  if (!current) return;
  const draft = current.querySelector("#assistant-question")?.value || "";
  const activeSelection = document.activeElement?.id === "assistant-question";
  const previousBody = current.querySelector(".assistant-content");
  const previousScroll = previousBody?.scrollTop || 0;
  // Was the patient at the live end of the conversation before this re-render?
  const wasFollowing = !previousBody || previousBody.scrollHeight - previousBody.scrollTop - previousBody.clientHeight <= ASSISTANT_FOLLOW_THRESHOLD;
  current.outerHTML = assistantLayer();
  bindAssistantLayer();
  const layer = document.querySelector(".assistant-layer");
  const input = layer?.querySelector("#assistant-question");
  if (input && draft) input.value = draft;
  const body = layer?.querySelector(".assistant-content");
  if (body) body.scrollTop = wasFollowing ? body.scrollHeight : previousScroll;
  if (focusInput || activeSelection) input?.focus({ preventScroll: true });
}

// The language the patient is actually using, handled inside the conversation they are already
// having. Nothing here restarts EMMI, clears the thread or re-greets: switching language changes
// which words come back, not who the patient is talking to.
const EMMI_LOCALE_KEYS = { en: "en", es: "es", ht: "ht" };
const languageOfferCopy = locale => ({
  es: "Veo que prefiere hablar en español. ¿Quiere que continuemos en español?",
  ht: "Mwen wè ou pale kreyòl. Èske ou vle nou kontinye an kreyòl?",
  en: "I noticed you’re writing in English. Would you like me to continue in English?"
})[locale];
const languageSwitchCopy = locale => ({
  es: "Perfecto, seguimos en español.",
  ht: "Dakò, n ap kontinye an kreyòl.",
  en: "Of course — I’ll continue in English."
})[locale];

// Returns whether the language flow consumed this turn and, after an accepted offer, the original
// care question that is still owed an answer. The question is kept in memory only for the open
// conversation; it is not patient data persisted into the enrollment draft.
function handlePatientLanguage(text) {
  const activeLocale = EMMI_LOCALE_KEYS[state.language] || "en";
  const offered = state.emmiOfferedLocale;

  // Which language to continue in can wait; a symptom cannot. A Spanish-preference patient typing
  // "my bp high what i do" was shown "I noticed you're writing in English. Would you like me to
  // continue in English?" and had to answer that before anyone looked at the blood pressure. The
  // health turn goes through untouched and the offer is simply skipped for it.
  if (detectEmergencyLanguage(text)) return { handled: false, replayQuestion: "" };

  // A standing offer the patient answered in words rather than by carrying on.
  if (offered && offered !== activeLocale) {
    if (isLanguageOfferAccepted(text)) {
      const replayQuestion = state.emmiPendingLanguageQuestion;
      state.emmiPendingLanguageQuestion = "";
      applyEmmiLanguage(offered);
      return { handled: true, replayQuestion };
    }
    if (isLanguageOfferDeclined(text)) {
      state.emmiDeclinedLocales = [...new Set([...state.emmiDeclinedLocales, offered])];
      state.emmiOfferedLocale = "";
      state.emmiPendingLanguageQuestion = "";
      return { handled: true, replayQuestion: "" };
    }
  }

  const { detected, action } = resolveLanguageIntent({
    text,
    activeLocale,
    offeredLocale: offered,
    consecutiveMatches: state.emmiLanguageStreak
  });
  if (!detected || detected === activeLocale) { state.emmiLanguageStreak = 0; return { handled: false, replayQuestion: "" }; }
  // Declining is remembered, so the same offer is never made twice in one session.
  if (state.emmiDeclinedLocales.includes(detected)) return { handled: false, replayQuestion: "" };

  if (action === "switch") { state.emmiPendingLanguageQuestion = ""; applyEmmiLanguage(detected); return { handled: false, replayQuestion: "" }; }
  if (action === "offer") {
    state.emmiOfferedLocale = detected;
    state.emmiPendingLanguageQuestion = text;
    state.emmiLanguageStreak = 1;
    state.assistantMessages.push({ role: "assistant", text: languageOfferCopy(detected), intent: "LANGUAGE_OFFER" });
    emmiConversationManager?.recordTurn("assistant", languageOfferCopy(detected), { screen: state.screen });
    refreshAssistantLayer();
    return { handled: true, replayQuestion: "" };
  }
  return { handled: false, replayQuestion: "" };
}

// One activeLocale for text and voice. setLanguage already rebuilds the live voice session in the
// new language, so this is the single switch both modalities follow.
function applyEmmiLanguage(locale) {
  state.emmiOfferedLocale = "";
  state.emmiLanguageStreak = 0;
  const confirmation = languageSwitchCopy(locale);
  state.assistantVoiceError = "";
  // setLanguage rebuilds the live voice session in the new language, so text and voice stay one
  // conversation. The screen behind the panel is not re-rendered here: render() tears the panel
  // down, which would close EMMI in the middle of the turn that asked for the switch.
  setLanguage(locale);
  state.assistantLanguageChanged = true;
  document.documentElement.lang = htmlLanguage(state.language);
  state.assistantMessages.push({ role: "assistant", text: confirmation, intent: "LANGUAGE_SWITCH" });
  emmiConversationManager?.recordTurn("assistant", confirmation, { screen: state.screen, localeChanged: true });
  audit(state, "emmi_language_adapted", "success", { screen: state.screen, locale });
  refreshAssistantLayer();
}

async function askEmmi(question, { questionId = "", source = "input", replay = false } = {}) {
  const cleaned = question.trim();
  if (!cleaned || state.assistantBusy) return;
  const runtime = ensureEmmiRuntime();
  state.assistantError = "";
  state.assistantRetryQuestion = "";
  if (!replay) {
    state.assistantMessages.push({ role: "user", text: cleaned, questionId });
    emmiConversationManager?.recordTurn("user", cleaned, { screen: state.screen });
  }
  // A quick question is EMMI's own words in EMMI's own language, so it is never evidence about
  // which language the patient prefers. Only what they wrote or said themselves counts.
  if (source !== "quick-question" && !replay) {
    const language = handlePatientLanguage(cleaned);
    if (language.handled) {
      if (language.replayQuestion) await askEmmi(language.replayQuestion, { questionId, source: "language-replay", replay: true });
      return;
    }
  }
  // Inside visit preparation, a medication answer is a request to organize the appointment,
  // not a request for a generic medication explainer. Keep the interaction conversational even
  // when the patient has several prep topics and types which one they want to work on.
  const prepAppointment = state.screen === "APPOINTMENT_DETAIL" && state.appointmentFlow?.view === "PREP" ? activeAppointment() : null;
  if (prepAppointment && isMedicationPrepTopic(cleaned)) {
    const medications = activeMedications();
    const provider = prepAppointment.providerDisplayName || L("your clinician", "su profesional clínico", "pwofesyonèl klinik ou");
    const response = medications.length
      ? L(
          `These are the active medications in your care record. Choose any you want to review with ${provider}, and I’ll add them to your visit list. This does not change a prescription.`,
          `Estos son los medicamentos activos en su registro. Elija los que quiera revisar con ${provider} y los agregaré a su lista para la cita. Esto no cambia ninguna receta.`,
          `Men medikaman aktif ki nan dosye swen ou. Chwazi sa ou vle revize ak ${provider}, epi m ap ajoute yo nan lis vizit ou. Sa pa chanje okenn preskripsyon.`
        )
      : L(
          "I don’t see any active medications in your care record. You can type the medication name or add a question for your clinician to your visit list.",
          "No veo medicamentos activos en su registro. Puede escribir el nombre del medicamento o agregar una pregunta para su profesional clínico a la lista de la cita.",
          "Mwen pa wè okenn medikaman aktif nan dosye swen ou. Ou ka ekri non medikaman an oswa ajoute yon kesyon pou pwofesyonèl klinik ou nan lis vizit la."
        );
    runtime.audit.transcript("user", cleaned);
    state.assistantMessages.push({
      role: "assistant",
      text: response,
      intent: "APPOINTMENT_PREP_MEDICATIONS",
      appointmentId: prepAppointment.id,
      prepMedicationOptions: medications.map(medication => ({
        medicationId: medication.id,
        name: medicationLabel(medication),
        details: medicationDetails(medication) || medicationSig(medication)
      }))
    });
    emmiConversationManager?.recordTurn("assistant", response, { screen: state.screen, appointmentId: prepAppointment.id, source: "appointment-prep" });
    emmiConversationManager?.markGreeted();
    runtime.audit.transcript("assistant", response);
    audit(state, "appointment_prep_medications_presented", "success", { appointmentId: prepAppointment.id, medicationCount: medications.length });
    draftStore.save(state);
    refreshAssistantLayer({ focusInput: true });
    return;
  }
  runtime.audit.transcript("user", cleaned);
  // Analytics record that a question was asked and where it came from, never what was asked.
  audit(state, source === "quick-question" ? "emmi_quick_question_selected" : "emmi_question_submitted", "success", { screen: state.screen, source, questionId });
  const criticalSafety = /(call 911|emergency|chest pain|can'?t breathe|cannot breathe|dolor.*pecho|no puedo respirar|rele 911|ijans|pa ka respire)/i.test(cleaned);
  const contextIndependent = !/(this|that|button|screen|here|esto|eso|botón|pantalla|aquí|sa a|bouton|ekran|isit)/i.test(cleaned);
  if (!["DISCONNECTED", "ERROR"].includes(state.assistantVoiceState) && runtime.live.sendText(cleaned, {
    id: `patient_${Date.now().toString(36)}`,
    contextVersion: emmiTransitionManager?.contextVersion || 0,
    screenId: state.screen,
    priority: criticalSafety ? "CRITICAL_SAFETY" : "PATIENT_RESPONSE",
    contextIndependent
  })) { refreshAssistantLayer(); return; }
  state.assistantBusy = true; refreshAssistantLayer();
  const thinkingStartedAt = Date.now();
  try {
    const response = await assistantAnswer(cleaned, assistantContext(), { questionId });
    state.assistantPendingAction = response.pendingAction || state.assistantPendingAction;
    if (response.pendingAction) state.assistantPendingAppointmentId = response.appointmentId || "";
    if (response.appointmentPrepUpdate && response.appointmentId) {
      const appointment = appointmentById(response.appointmentId);
      if (appointment) {
        saveAppointment({
          ...appointment,
          prep: { ...(appointment.prep || {}), emmiPreparation: response.appointmentPrepUpdate, updatedAt: new Date().toISOString() },
          updatedAt: new Date().toISOString()
        });
        state.assistantPendingNavigation = true;
        audit(state, "appointment_prep_conversation_updated", "success", { appointmentId: appointment.id, status: response.appointmentPrepUpdate.status || "IN_PROGRESS", reviewedTopicCount: response.appointmentPrepUpdate.reviewedTopics?.length || 0 });
        draftStore.save(state);
      }
    }
    state.assistantMessages.push({ role: "assistant", text: response.text, intent: response.trace?.intent || "", emergency: response.emergency, quickAction: response.quickAction || "", barrierId: response.barrierId || "", medicationId: response.medicationId || "", appointmentId: response.appointmentId || "", needId: response.needId || "" });
    emmiConversationManager?.recordTurn("assistant", response.text, { screen: state.screen });
    emmiConversationManager?.markGreeted();
    runtime.audit.transcript("assistant", response.text);
    audit(state, "emmi_question", response.emergency ? "emergency_guidance" : state.assistantOriginScreen);
  } catch {
    // A failed answer keeps the patient in EMMI with a way forward, rather than a dead end or a
    // fabricated reply: try again, or reach a person.
    state.assistantError = "CONNECTION";
    state.assistantRetryQuestion = cleaned;
    audit(state, "emmi_answer_failed", "failed", { screen: state.screen });
  } finally {
    const remainingThinkingTime = 300 - (Date.now() - thinkingStartedAt);
    if (remainingThinkingTime > 0) await new Promise(resolve => setTimeout(resolve, remainingThinkingTime));
    state.assistantBusy = false;
    refreshAssistantLayer({ focusInput: !state.assistantError });
  }
}

// Closing restores the screen exactly: same route, same scroll, same form state, same voice
// session. Nothing about enrollment or the conversation is rebuilt, because nothing was left.
function closeAssistant({ fromHistory = false } = {}) {
  if (!state.assistantOpen) return;
  const scrollY = state.assistantScrollY;
  const languageChanged = state.assistantLanguageChanged;
  const trigger = emmiExpandedReturnFocus;
  state.assistantOpen = false;
  state.assistantLanguageChanged = false;
  state.assistantVoiceOptionsOpen = false;
  state.assistantError = "";
  document.body.classList.remove("assistant-open");
  document.querySelector(".assistant-layer")?.remove();
  setPatientExperienceInert(false);
  stopAssistantKeyboardWatch();
  audit(state, "emmi_expanded_closed", "success", { screen: state.screen, source: emmiExpandedSource });
  // The audit trail is part of the enrollment record, so the EMMI session the patient just had is
  // persisted with everything else. The store ignores this until identity is verified.
  draftStore.save(state);
  // Voice guidance is global state, so an open panel is not what keeps a session alive. Only a
  // session the patient never turned on is torn down with the panel that started it.
  if (!state.emmiVoiceGuidance) {
    if (emmiLive && !["DISCONNECTED", "ERROR"].includes(state.assistantVoiceState)) emmiLive.disconnect("ended");
    emmiAuditLog?.end();
    emmiAuditLog = null;
    emmiTools = null;
    emmiLive = null;
  }
  if (!fromHistory && emmiOverlayHistoryEntry) { emmiOverlayHistoryEntry = false; history.back(); }
  if (languageChanged || state.assistantPendingNavigation) { state.assistantPendingNavigation = false; requestScroll({ navigationType: NAVIGATION.OVERLAY_CLOSE, restoreTop: scrollY }); render(); return; }
  refreshVoiceGuidanceControls();
  requestAnimationFrame(() => {
    restoreOverlayPosition();
    scheduleEmmiPresentationSync();
    // Focus goes back to what opened EMMI. If that control has since stood down — the pill hands
    // over to the compact card as the patient returns to the top — the surviving EMMI takes it.
    requestAnimationFrame(() => {
      // A fixed-position pill has no offsetParent, so visibility is measured by whether the
      // element actually paints a box.
      const candidates = [trigger, document.querySelector(".emmi-assistant"), document.querySelector('.emmi-guide [data-action="help"]'), document.querySelector('.emmi-welcome [data-action="help"]')];
      candidates.find(node => node?.isConnected && node.getClientRects().length)?.focus({ preventScroll: true });
    });
  });
}

function bindAssistantLayer() {
  const layer = document.querySelector(".assistant-layer");
  if (!layer) return;
  // Voice options inside the panel reuse the compact card's controls, so they carry data-action
  // and need the shared handlers bound onto this freshly rendered subtree.
  bindActions(layer);
  trapFocusWithin(layer);
  layer.querySelector(".assistant-question-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const question = new FormData(event.currentTarget).get("question")?.toString() || "";
    if (!question.trim() || state.assistantBusy) return;
    // refreshAssistantLayer intentionally preserves an in-progress draft across unrelated panel
    // updates. Once the patient submits, however, that text is no longer a draft: clear the live
    // form before askEmmi re-renders the layer so it cannot restore the sent message into the input.
    event.currentTarget.reset();
    askEmmi(question);
  });
  layer.querySelectorAll("[data-assistant-question]").forEach(button => button.addEventListener("click", () => {
    // A tap can take the patient somewhere; typing and speaking cannot, so they get the answer the
    // router builds from the care record instead. Different affordances for the same wish, not two
    // answers to one question.
    if (button.dataset.questionId === "human-talk-care-team") { revealAssistantHumanSupport(); return; }
    askEmmi(button.dataset.assistantQuestion || "", { questionId: button.dataset.questionId || "", source: "quick-question" });
  }));
  layer.querySelectorAll("[data-assistant-prep-medication]").forEach(button => button.addEventListener("click", () => {
    const appointment = appointmentById(button.dataset.appointmentId);
    const medication = medicationById(button.dataset.medicationId);
    if (!appointment || !medication || medication.active === false) return;
    const existing = appointment.prep?.medications || [];
    if (existing.some(item => item.medicationId === medication.id)) return;
    const now = new Date().toISOString();
    const label = medicationLabel(medication);
    saveAppointment({
      ...appointment,
      prep: {
        ...(appointment.prep || {}),
        medications: [...existing, {
          medicationId: medication.id,
          name: label,
          details: medicationDetails(medication) || medicationSig(medication),
          addedAt: now
        }],
        emmiPreparation: { ...(appointment.prep?.emmiPreparation || {}), status: "IN_PROGRESS", updatedAt: now },
        updatedAt: now
      },
      updatedAt: now
    });
    const confirmation = L(
      `I added ${label} to your visit list. Choose another medication if needed, or say “that’s all” and I’ll organize your full agenda.`,
      `Agregué ${label} a su lista para la cita. Elija otro medicamento si lo necesita o diga “eso es todo” y organizaré su agenda completa.`,
      `Mwen ajoute ${label} nan lis vizit ou. Chwazi yon lòt medikaman si sa nesesè, oswa di “se tout” epi m ap òganize tout ajanda ou.`
    );
    state.assistantMessages.push({ role: "assistant", text: confirmation, intent: "APPOINTMENT_PREP_MEDICATION_ADDED", appointmentId: appointment.id, medicationId: medication.id });
    emmiConversationManager?.recordTurn("assistant", confirmation, { screen: state.screen, appointmentId: appointment.id, medicationId: medication.id, source: "appointment-prep" });
    ensureEmmiRuntime().audit.transcript("assistant", confirmation);
    audit(state, "appointment_prep_medication_added", "success", { appointmentId: appointment.id, medicationId: medication.id });
    // The preparation screen remains mounted behind the EMMI panel. Mark it for a fresh render
    // when the panel closes so the newly saved agenda is visible immediately.
    state.assistantPendingNavigation = true;
    draftStore.save(state);
    refreshAssistantLayer();
  }));
  layer.querySelectorAll("[data-assistant-growth]").forEach(button => button.addEventListener("click", () => {
    const growthAction = button.dataset.assistantGrowth;
    // Ending the safety episode keeps the patient in the conversation. Every other quick action
    // navigates somewhere, and closing the panel on this one would answer "help is with me" by
    // taking the assistant away.
    if (growthAction === "safety-resolved") {
      emmiConversationManager?.resolveSafetyEpisode("HUMAN_HELP_CONFIRMED");
      const resolutionText = safetyResolutionCopy("HUMAN_HELP_CONFIRMED", languageCode());
      state.assistantMessages.push({ role: "assistant", text: resolutionText, intent: "CLINICAL_SAFETY_RESOLVED", emergency: false, quickAction: "" });
      emmiConversationManager?.recordTurn("assistant", resolutionText, { screen: state.screen });
      audit(state, "emmi_safety_episode_resolved", "success", { resolution: "HUMAN_HELP_CONFIRMED", screen: state.screen });
      draftStore.save(state);
      refreshAssistantLayer({ focusInput: true });
      return;
    }
    const originScreen = state.assistantOriginScreen || state.screen;
    closeAssistant();
    state.growthReturnScreen = originScreen;
    state.growthContext = "emmi";
    if (growthAction === "care-circle") {
      state.careCircleContext = state.enrollmentStatus === "COMPLETED" ? "ONGOING_CARE" : "ENROLLMENT";
      state.careCircleNotice = "";
      state.screen = "CARE_CIRCLE_INVITE";
    }
    if (growthAction === "share-access" && state.enrollmentStatus === "COMPLETED") state.screen = "SHARE_ACCESS";
    // A difficulty EMMI heard in conversation opens where it can be acted on: the goal it belongs
    // to, with the help she already proposed.
    if (growthAction === "medication-refill") {
      state.screen = "MY_MEDICATIONS";
      const medicationId = button.dataset.medicationId || "";
      state.refillFlow = medicationId ? { medicationId, step: "REVIEW", answer: "" } : { medicationId: "", step: "", answer: "" };
      draftStore.save(state);
      render();
      return;
    }
    // An appointment EMMI helped with opens where it can be acted on rather than described again.
    if (growthAction === "appointment-companion") {
      const record = appointmentById(button.dataset.appointmentId || "");
      if (record) startBarrierResolution(record, APPOINTMENT_BARRIER_REASONS.CAREGIVER_AVAILABILITY);
      else { state.screen = "MY_APPOINTMENTS"; state.appointmentFlow = { tab: "" }; draftStore.save(state); }
      render();
      return;
    }
    if (growthAction === "appointment-view") {
      const appointmentId = button.dataset.appointmentId || "";
      if (appointmentId && appointmentById(appointmentId)) openAppointmentDetail(appointmentId);
      else { state.screen = "MY_APPOINTMENTS"; state.appointmentFlow = { tab: "" }; draftStore.save(state); }
      render();
      return;
    }
    // Changing a time is an explicit workflow, never something a sentence performed on its own.
    if (growthAction === "appointment-reschedule") {
      const record = appointmentById(button.dataset.appointmentId || "");
      if (record) openAppointmentDetail(record.id);
      else { state.screen = "MY_APPOINTMENTS"; state.appointmentFlow = { tab: "" }; draftStore.save(state); }
      render();
      return;
    }
    if (growthAction === "appointment-request") {
      // startAppointmentRequest returns the id of the draft need it just created. Keep that id on
      // the EMMI message and reopen the same draft here; otherwise this CTA can only fall back to
      // the Requests list, forcing the patient to locate and open the request a second time.
      const record = appointmentById(button.dataset.needId || button.dataset.appointmentId || "");
      const requestedStep = state.appointmentFlow?.appointmentId === record?.id && state.appointmentFlow?.step
        ? state.appointmentFlow.step
        : "PROVIDER";
      const resumeStep = appointmentPreferenceResumeStep(record, requestedStep);
      if (record) openAppointmentScheduling(record, resumeStep);
      else { state.screen = "MY_APPOINTMENTS"; state.appointmentFlow = { tab: "REQUESTS" }; draftStore.save(state); }
      render();
      return;
    }
    if (growthAction === "goal-barrier") {
      const barrier = findBarrierById(button.dataset.barrierId || "");
      if (barrier) {
        state.activeGoalId = barrier.goalId;
        state.activeBarrierId = barrier.id;
        state.screen = "MY_GOALS";
        state.goalDetailView = "SUMMARY";
        planNextBarrierHelp(barrier);
        return;
      }
      state.screen = "MY_GOALS";
    }
    render();
  }));
  layer.querySelectorAll("[data-assistant-action]").forEach(control => control.addEventListener("click", event => {
    const action = control.dataset.assistantAction;
    // The care team number is a real phone call, so the link is left to do its job.
    if (action === "human-support") { audit(state, "emmi_human_support_selected", "success", { screen: state.screen, channel: "phone" }); return; }
    event.preventDefault();
    if (action === "close") closeAssistant();
    if (action === "faq") { state.assistantFaqOpen = !state.assistantFaqOpen; refreshAssistantLayer(); }
    if (action === "human-support-toggle") { state.assistantSupportOpen = !state.assistantSupportOpen; refreshAssistantLayer(); }
    if (action === "callback") askEmmi(L("Can someone call me?", "¿Puede llamarme alguien?", "Èske yon moun ka rele m?"), { questionId: "request-callback", source: "human-support" });
    if (action === "retry") {
      const question = state.assistantRetryQuestion;
      state.assistantError = "";
      state.assistantRetryQuestion = "";
      refreshAssistantLayer();
      if (question) askEmmi(question, { questionId: "retry", source: "retry" });
    }
    if (action === "voice-options") { state.assistantVoiceOptionsOpen = !state.assistantVoiceOptionsOpen; refreshAssistantLayer(); }
    if (action === "start-voice") {
      if (!emmiVoiceIsSupported(languageCode())) { state.assistantVoiceError = "VOICE_UNAVAILABLE_FOR_LOCALE"; refreshAssistantLayer(); return; }
      state.assistantVoiceError = "";
      // Starting to talk here is the same act as Guide by voice on Home: one global voice
      // state, so closing the panel afterwards does not silently end what the patient started.
      state.emmiVoiceGuidance = true;
      state.emmiVoiceGuidancePaused = false;
      state.emmiWelcomeAcknowledged = true;
      state.assistantVoiceMuted = false;
      persistEmmiPreferences();
      audit(state, "emmi_voice_started", "success", { screen: state.screen, source: "expanded" });
      refreshAssistantLayer();
      const priorConversation = emmiConversationManager?.contextForModel();
      const initialGuidance = state.emmiVoiceGuidance && state.emmiGuidanceTranscript
        ? emmiGuidancePrompt(state.emmiGuidanceTranscript)
        : priorConversation?.recentTurns?.length ? emmiConversationManager.recoveryInstruction() : "";
      ensureEmmiRuntime().live.prepareAudioPlayback();
      ensureEmmiRuntime().live.connect(initialGuidance).catch(() => { /* The live client publishes a safe, localized error state. */ });
    }
    if (action === "mute") { state.assistantVoiceMuted = !state.assistantVoiceMuted; ensureEmmiRuntime().live.setMuted(state.assistantVoiceMuted); refreshAssistantLayer(); }
    if (action === "language") {
      state.assistantVoiceError = "";
      // setLanguage rebuilds the voice session in the new language; dropping it here instead
      // would leave the patient with no voice after switching.
      setLanguage(state.language === "en" ? "es" : state.language === "es" ? "ht" : "en");
      state.assistantLanguageChanged = true;
      refreshAssistantLayer();
    }
  }));
}

// While EMMI is expanded the screen underneath is inactive, not merely covered: a screen reader
// or a stray tab must not reach a Continue button the patient cannot see.
function setPatientExperienceInert(inert) {
  document.querySelectorAll(".shell > .app-header, .shell > #screen-content, .shell > .screen").forEach(node => {
    node.toggleAttribute("inert", inert);
    if (inert) node.setAttribute("aria-hidden", "true");
    else node.removeAttribute("aria-hidden");
  });
}

// The on-screen keyboard shrinks the visual viewport without telling CSS, so the panel is told
// how tall it really is. Without this the input and Send sit under the keyboard while the patient
// types into them.
let assistantKeyboardCleanup = null;
function startAssistantKeyboardWatch() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const apply = () => {
    const layer = document.querySelector(".assistant-layer");
    if (!layer) return;
    layer.style.height = `${Math.round(viewport.height)}px`;
    layer.style.top = `${Math.round(viewport.offsetTop)}px`;
  };
  apply();
  viewport.addEventListener("resize", apply);
  viewport.addEventListener("scroll", apply);
  assistantKeyboardCleanup = () => {
    viewport.removeEventListener("resize", apply);
    viewport.removeEventListener("scroll", apply);
  };
}
function stopAssistantKeyboardWatch() {
  assistantKeyboardCleanup?.();
  assistantKeyboardCleanup = null;
}

// Opening EMMI is a presentation change, not navigation: the route, the step, the form and the
// scroll position are all left exactly as they are, and remembered so closing can restore them.
function showHelp(trigger = null) {
  if (state.assistantOpen || !state.offer) return;
  if (!emmiPrototypeIsSafe()) return;
  if (state.assistantOriginScreen !== state.screen) { state.assistantFaqOpen = false; state.assistantSupportOpen = false; }
  emmiExpandedReturnFocus = trigger instanceof HTMLElement ? trigger : null;
  emmiExpandedSource = emmiExpandedReturnFocus?.dataset.emmiSource || "screen-action";
  state.assistantOpen = true;
  state.assistantOriginScreen = state.screen;
  state.assistantScrollY = captureOverlayPosition();
  state.assistantLanguageChanged = false;
  state.assistantVoiceOptionsOpen = false;
  state.emmiVoiceOptionsOpen = false;
  ensureEmmiRuntime();
  if (import.meta.env.DEV) {
    const previewState = new URLSearchParams(location.search).get("emmiState");
    if (["LISTENING", "INTERRUPTING", "USER_SPEAKING", "EMMI_THINKING", "EMMI_SPEAKING", "TOOL_RUNNING"].includes(previewState)) {
      state.assistantVoiceState = previewState;
      state.assistantVoiceDetail = previewState === "TOOL_RUNNING" ? emmiToolStatusLabel("getExpectedAccessCost") : "prototype_visual_preview";
    }
  }
  if (emmiExpandedSource === "floating") audit(state, "emmi_floating_opened", "success", { screen: state.screen });
  audit(state, "emmi_expanded_opened", "success", { screen: state.screen, source: emmiExpandedSource });
  document.body.classList.add("assistant-open");
  document.querySelector(".shell")?.insertAdjacentHTML("beforeend", assistantLayer());
  setPatientExperienceInert(true);
  bindAssistantLayer();
  // A freshly inserted scroll container starts at the top, which is the oldest message in the
  // thread. Reopening EMMI after a long conversation put the patient back at the screen narration
  // they heard first rather than at the answer they had just been given. The second pass is for
  // after the web font settles: the measurement taken mid-render is not the final height.
  const openedThread = document.querySelector(".assistant-layer .assistant-content");
  if (openedThread) {
    const toLatest = () => { openedThread.scrollTop = openedThread.scrollHeight; };
    toLatest();
    requestAnimationFrame(toLatest);
  }
  startAssistantKeyboardWatch();
  syncEmmiPresentation();
  // Back should close EMMI rather than walk the patient out of enrollment. One entry, added only
  // when the browser supports it, and consumed again by whichever close happens first.
  try { history.pushState({ emmiOverlay: true }, ""); emmiOverlayHistoryEntry = true; }
  catch { emmiOverlayHistoryEntry = false; }
  requestAnimationFrame(() => document.querySelector("#assistant-title")?.focus({ preventScroll: true }));
}

function bindEmmiDrag() {
  const emmi = document.querySelector(".emmi-assistant");
  const shell = document.querySelector(".shell");
  if (!emmi || !shell) return;
  const positionKey = "itera.emmi.position.v1";
  const bounds = () => {
    const shellRect = shell.getBoundingClientRect();
    const minY = Math.max(0, shellRect.top) + 6;
    const visibleBottom = Math.min(window.innerHeight, shellRect.bottom);
    const protectedBottom = shell.querySelector(".care-circle-invite-screen,.medication-review-screen,.health-information-review-screen") ? 124 : 6;
    return { minX: shellRect.left + 6, maxX: shellRect.right - emmi.offsetWidth - 6, minY, maxY: Math.max(minY, visibleBottom - emmi.offsetHeight - protectedBottom) };
  };
  const place = (left, top) => {
    const limit = bounds();
    // A pill the patient has placed themselves is positioned outright, so the automatic lift that
    // keeps EMMI off the screen's actions is cleared rather than added to their coordinates.
    emmi.style.transform = "";
    emmi.style.position = "fixed";
    emmi.style.left = `${Math.min(limit.maxX, Math.max(limit.minX, left))}px`;
    emmi.style.top = `${Math.min(limit.maxY, Math.max(limit.minY, top))}px`;
    emmi.style.right = "auto";
    emmi.style.bottom = "auto";
  };
  try {
    const saved = JSON.parse(localStorage.getItem(positionKey) || "null");
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      const limit = bounds();
      place(limit.minX + saved.x * Math.max(0, limit.maxX - limit.minX), limit.minY + saved.y * Math.max(0, limit.maxY - limit.minY));
    }
  } catch { /* Keep the default CSS position if storage is unavailable. */ }
  let drag = null;
  let suppressClick = false;
  emmi.addEventListener("pointerdown", event => {
    if (event.button !== undefined && event.button !== 0) return;
    const rect = emmi.getBoundingClientRect();
    emmi.style.transform = "";
    emmi.style.position = "fixed";
    emmi.style.left = `${rect.left}px`;
    emmi.style.top = `${rect.top}px`;
    emmi.style.right = "auto";
    emmi.style.bottom = "auto";
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, moved: false };
    emmi.setPointerCapture?.(event.pointerId);
    emmi.classList.add("dragging");
  });
  emmi.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true;
    if (!drag.moved) return;
    event.preventDefault();
    place(event.clientX - drag.offsetX, event.clientY - drag.offsetY);
  });
  const finishDrag = event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    suppressClick = drag.moved;
    emmi.classList.remove("dragging");
    if (drag.moved) {
      const limit = bounds();
      const rect = emmi.getBoundingClientRect();
      const x = (rect.left - limit.minX) / Math.max(1, limit.maxX - limit.minX);
      const y = (rect.top - limit.minY) / Math.max(1, limit.maxY - limit.minY);
      try { localStorage.setItem(positionKey, JSON.stringify({ x, y })); } catch { /* Position persistence is optional. */ }
      setTimeout(() => { suppressClick = false; }, 0);
    }
    drag = null;
  };
  emmi.addEventListener("pointerup", finishDrag);
  emmi.addEventListener("pointercancel", finishDrag);
  emmi.addEventListener("click", event => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}

// Action handlers are attached per element, so anything re-rendered outside render() has to be
// rebound. bindActions is exported to refreshVoiceGuidanceControls for exactly that reason.
let bindActions = () => {};

function bind() {
  bindActions = root => root.querySelectorAll("[data-action]").forEach(el => el.addEventListener("click", async event => {
    event.preventDefault(); const action = el.dataset.action;
    const selectedChoice = document.querySelector('form input[name="choice"]:checked')?.value || el.dataset.section || el.dataset.support || "";
    emmiNavigationIntent = {
      selectedAction: selectedChoice || action,
      navigationDirection: action === "back" || /back|return|cancel/.test(action) ? "BACK" : "FORWARD",
      action
    };
    // Back owes the patient the place they left. Only the two actions that actually walk backwards
    // claim it: a "cancel" that closes an inline editor stays where it is like any in-place change.
    if (action === "back" || action === "return") requestScroll({ navigationType: NAVIGATION.BACK });
    const preserveArmForm = () => {
      const form = document.querySelector("#bp-device-info-form");
      if (!form) return;
      const data = Object.fromEntries(new FormData(form));
      state.selectedCuffOption = data.choice || state.selectedCuffOption || "";
    };
    if (action === "open-care-circle") {
      state.growthReturnScreen = state.screen;
      state.growthContext = el.dataset.growthContext || "early";
      state.careCircleContext = state.enrollmentStatus === "COMPLETED" ? "ONGOING_CARE" : "ENROLLMENT";
      state.careCircleNotice = "";
      audit(state, "care_circle_opened", "success", { context: state.careCircleContext });
      state.screen = "CARE_CIRCLE_INVITE";
      state.error = "";
      render();
      return;
    }
    if (action === "open-care-circle-post") {
      state.growthReturnScreen = state.screen;
      state.growthContext = "post-enrollment";
      state.careCircleContext = "ONGOING_CARE";
      state.careCircleNotice = "";
      state.screen = "CARE_CIRCLE_INVITE";
      state.error = "";
      render();
      return;
    }
    if (action === "choose-care-circle-contact") {
      audit(state, "care_circle_contact_picker_opened", "success", { context: state.careCircleContext });
      if (!navigator.contacts?.select) {
        document.querySelector("#care-circle-contact-file")?.click();
        return;
      }
      try {
        const contacts = await navigator.contacts.select(["name", "tel"], { multiple: false });
        const contact = contacts?.[0];
        if (!contact) { state.careCircleNotice = L("No contact was selected. You can enter their information below.", "No se seleccionó ningún contacto. Puede ingresar sus datos abajo.", "Ou pa chwazi okenn kontak. Ou ka antre enfòmasyon yo anba a."); render(); return; }
        const rawNumbers = applyCareCircleContact(contact, "CONTACT_PICKER");
        audit(state, "care_circle_contact_selected", "success", { phoneCount: rawNumbers.length, hasName: Boolean(state.supportPersonName) });
      } catch (error) {
        state.careCircleContactPickerStatus = "DENIED";
        state.careCircleNotice = L("Contacts are not available. You can still enter their information below.", "Los contactos no están disponibles. Puede ingresar sus datos abajo.", "Kontak yo pa disponib. Ou ka toujou antre enfòmasyon yo anba a.");
        audit(state, "care_circle_contact_picker_failed", "fallback", { reason: error?.name || "unavailable" });
      }
      render(); return;
    }
    if (action === "open-share-access") {
      if (state.enrollmentStatus !== "COMPLETED") return;
      state.growthReturnScreen = state.screen;
      state.growthContext = "post-enrollment";
      state.growthNotice = "";
      state.screen = "SHARE_ACCESS";
      render();
      return;
    }
    if (action === "growth-return") {
      state.screen = state.growthReturnScreen || (state.enrollmentStatus === "COMPLETED" ? "ENROLLMENT_CONFIRMED" : "INVITATION");
      state.error = "";
      render();
      return;
    }
    if (action === "dismiss-growth") {
      const preferences = growthStore.dismissPrompt(el.dataset.growthType);
      state.careCirclePromptDismissedAt = preferences.careCirclePromptDismissedAt;
      state.shareAccessPromptDismissedAt = preferences.shareAccessPromptDismissedAt;
      audit(state, "growth_prompt_dismissed", "success", { type: el.dataset.growthType, cooldownDays: 7 });
      if (state.identityVerified) draftStore.save(state);
      render();
      return;
    }
    if (action === "send-care-circle-invite") {
      const form = document.querySelector("#care-circle-invite-form");
      const data = Object.fromEntries(new FormData(form));
      const supportPersonName = String(data.supportPersonName || "").trim();
      const supportPersonPhone = phoneDigits(data.supportPersonPhone);
      const supportPersonRelationship = String(data.supportPersonRelationship || "");
      const supportPersonRelationshipOther = String(data.supportPersonRelationshipOther || "").trim();
      audit(state, "invite_started", "success", { context: state.careCircleContext, source: state.careCircleContactSource });
      if (!supportPersonName || supportPersonPhone.length !== 10 || !supportPersonRelationship || (supportPersonRelationship === "other" && !supportPersonRelationshipOther)) {
        state.supportPersonName = supportPersonName;
        state.supportPersonPhone = formatPhone(supportPersonPhone);
        state.supportPersonRelationship = supportPersonRelationship;
        state.error = L("Enter their name, a 10-digit mobile number, and their relationship to you.", "Ingrese su nombre, un número celular de 10 dígitos y su relación con usted.", "Antre non moun nan, yon nimewo mobil 10 chif, ak relasyon li avèk ou.");
        audit(state, "invite_failed", "validation", { context: state.careCircleContext }); render(); return;
      }
      // Nothing goes out in the name of somebody we have not confirmed. The details are kept and
      // the patient is taken to confirm who they are; the invitation is sent on the other side of
      // that, which is also what gives it an enrollment to belong to.
      if (!state.identityVerified) {
        Object.assign(state, { supportPersonName, supportPersonPhone: formatPhone(supportPersonPhone), supportPersonRelationship, supportPersonRelationshipOther, careCircleInvitePending: true });
        state.error = "";
        state.careCircleNotice = L(
          `We’ll confirm it’s you first, then send the invitation to ${supportPersonName}.`,
          `Primero confirmaremos que es usted y luego enviaremos la invitación a ${supportPersonName}.`,
          `N ap konfime se ou anvan, apre sa n ap voye envitasyon an bay ${supportPersonName}.`
        );
        audit(state, "invite_deferred", "identity_not_verified", { context: state.careCircleContext });
        state.screen = "IDENTITY_VERIFICATION";
        render();
        return;
      }
      try {
        const invite = growthStore.createSupportInvite({ inviterPatientId: state.offer.patient.id, patientFirstName: patientFirstName(), supportPersonName, phone: supportPersonPhone, relationship: supportPersonRelationship, relationshipOther: supportPersonRelationshipOther, context: state.careCircleContext, sessionId: state.sessionId, origin: location.origin });
        Object.assign(state, { supportRole: "CARE_CIRCLE_MEMBER", careCircleStatus: "INVITED", supportPersonName, supportPersonPhone: formatPhone(supportPersonPhone), supportPersonRelationship, supportPersonRelationshipOther, supportInviteId: invite.inviteId, supportInviteToken: invite.token, supportInviteStatus: invite.status, supportInviteSentAt: invite.sentAt, screen: "CARE_CIRCLE_INVITE_SENT", error: "" });
        audit(state, "invite_sent", "success", { inviteId: invite.inviteId, context: state.careCircleContext, source: state.careCircleContactSource });
        if (state.identityVerified) draftStore.save(state);
      } catch {
        state.error = L("We couldn’t send the invitation right now. Please try again.", "No pudimos enviar la invitación en este momento. Inténtelo de nuevo.", "Nou pa t kapab voye envitasyon an kounye a. Tanpri eseye ankò.");
        audit(state, "invite_failed", "storage_or_delivery", { context: state.careCircleContext });
      }
      render();
      return;
    }
    if (action === "open-my-goals") { state.screen = "MY_GOALS"; state.activeGoalId = ""; state.goalNotice = ""; draftStore.save(state); render(); return; }
    if (action === "add-another-goal") { state.goalFlowOrigin = "MY_GOALS"; state.goalFlowStep = "DISCOVERY"; state.screen = "GOALS"; state.error = ""; draftStore.save(state); render(); return; }
    if (action === "view-goal") {
      const goal = patientGoalById(el.dataset.goalId);
      if (!goal) return;
      state.activeGoalId = goal.id;
      state.goalNotice = "";
      if (goal.planStatus !== "COMPLETED") { state.goalFlowOrigin = "MY_GOALS"; state.goalPlanningGoalId = goal.id; state.goalFlowStep = "PLAN_OFFER"; state.screen = "GOALS"; }
      else { state.goalDetailView = "SUMMARY"; state.screen = "MY_GOALS"; }
      draftStore.save(state); render(); return;
    }
    if (action === "goals-discovery-continue") {
      const form = document.querySelector("#care-goals-form");
      const data = new FormData(form);
      const selected = [...data.getAll("careGoal")];
      const customTitle = String(data.get("customGoalTitle") || "").trim().slice(0, 180);
      if (!selected.length) { state.error = L("Choose at least one goal.", "Elija al menos una meta.", "Chwazi omwen yon objektif."); render(); return; }
      if (selected.includes("other") && !customTitle) { state.error = L("Tell us what you would like to work toward.", "Indique qué le gustaría lograr.", "Di nou sa ou ta renmen travay pou reyalize."); render(); return; }
      state.careGoalsNote = String(data.get("careGoalsNote") || "").trim().slice(0, 300);
      const goals = syncPatientGoalsFromDiscovery(selected, customTitle);
      state.error = "";
      if (goals.length > 1) state.goalFlowStep = "PRIORITY";
      else {
        const goal = goals[0];
        goal.priority = "PRIMARY";
        state.goalPrimaryId = goal.id;
        state.goalSecondaryId = "";
        state.goalPlanningGoalId = goal.id;
        state.goalFlowStep = "PLAN_OFFER";
        goalHistoryEvent(goal.id, "PRIORITY_SET", { priority: "PRIMARY" });
      }
      draftStore.save(state); render(); return;
    }
    if (action === "goals-priority-continue") {
      const data = new FormData(document.querySelector("#goal-priority-form"));
      const primaryId = String(data.get("primaryGoal") || "");
      const secondaryId = String(data.get("secondaryGoal") || "");
      if (!primaryId) { state.error = L("Choose your primary priority.", "Elija su prioridad principal.", "Chwazi premye priyorite ou."); render(); return; }
      if (secondaryId && secondaryId === primaryId) { state.error = L("Choose a different goal as your second priority.", "Elija una meta diferente como segunda prioridad.", "Chwazi yon lòt objektif kòm dezyèm priyorite."); render(); return; }
      const now = new Date().toISOString();
      state.patientGoals = activePatientGoals().map(goal => ({ ...goal, priority: goal.id === primaryId ? "PRIMARY" : goal.id === secondaryId ? "SECONDARY" : "NONE", updatedAt: now }));
      state.goalPrimaryId = primaryId;
      state.goalSecondaryId = secondaryId;
      state.goalPlanningGoalId = primaryId;
      state.goalFlowStep = "PLAN_OFFER";
      state.error = "";
      goalHistoryEvent(primaryId, "PRIORITY_SET", { priority: "PRIMARY", secondaryGoalId: secondaryId || null });
      draftStore.save(state); render(); return;
    }
    if (action === "goals-flow-back") {
      state.goalFlowStep = ({ PRIORITY: "DISCOVERY", PLAN_OFFER: activePatientGoals().length > 1 ? "PRIORITY" : "DISCOVERY", PLAN_ACTIONS: "PLAN_OFFER", PLAN_REVIEW: "PLAN_ACTIONS" })[state.goalFlowStep] || "DISCOVERY";
      state.error = ""; render(); return;
    }
    if (action === "goal-plan-now" || action === "plan-active-goal") {
      const goal = action === "plan-active-goal" ? currentGoal() : patientGoalById(state.goalPlanningGoalId);
      if (!goal) return;
      state.goalFlowOrigin = action === "plan-active-goal" ? "MY_GOALS" : state.goalFlowOrigin;
      state.goalPlanningGoalId = goal.id;
      state.goalPlanDraft = { actionIds: (goal.actions || []).filter(item => item.source !== "PATIENT").map(item => item.templateId).filter(Boolean), customAction: (goal.actions || []).find(item => item.source === "PATIENT")?.title || "", frequency: (goal.actions || [])[0]?.frequency || "few-days", remindersEnabled: (goal.actions || []).some(item => item.remindersEnabled), whyItMatters: goal.whyItMatters || "" };
      state.goalFlowStep = "PLAN_ACTIONS";
      state.screen = "GOALS";
      draftStore.save(state); render(); return;
    }
    if (action === "goal-plan-later") {
      const goal = patientGoalById(state.goalPlanningGoalId);
      if (!goal) return;
      goal.planStatus = "DEFERRED"; goal.planPersonalizationStatus = "DEFERRED"; goal.updatedAt = new Date().toISOString();
      state.goalPlanStatus = "DEFERRED"; state.goalsStatus = "COMPLETED"; state.baselineResumeScreen = "ONBOARDING";
      goalHistoryEvent(goal.id, "PLAN_DEFERRED");
      audit(state, "patient_goal_plan_deferred", "success", { goalId: goal.id, goalType: goal.goalType });
      state.goalFlowStep = "DISCOVERY";
      state.screen = state.goalFlowOrigin === "MY_GOALS" ? "MY_GOALS" : "ONBOARDING";
      state.activeGoalId = state.goalFlowOrigin === "MY_GOALS" ? goal.id : "";
      draftStore.save(state); render(); return;
    }
    if (action === "goal-plan-review") {
      const data = new FormData(document.querySelector("#goal-plan-form"));
      const actionIds = [...data.getAll("goalAction")];
      const customAction = String(data.get("customAction") || "").trim().slice(0, 160);
      if (!actionIds.length && !customAction) { state.error = L("Choose a suggested step or add your own.", "Elija un paso sugerido o agregue el suyo.", "Chwazi yon etap yo sijere oswa ajoute pa ou."); render(); return; }
      state.goalPlanDraft = { actionIds, customAction, frequency: String(data.get("goalFrequency") || "few-days"), remindersEnabled: data.get("goalReminders") === "on", whyItMatters: String(data.get("whyItMatters") || "").trim().slice(0, 300) };
      state.goalFlowStep = "PLAN_REVIEW"; state.error = ""; draftStore.save(state); render(); return;
    }
    if (action === "goal-plan-change") { state.goalFlowStep = "PLAN_ACTIONS"; render(); return; }
    if (action === "goal-plan-save") {
      const goal = patientGoalById(state.goalPlanningGoalId);
      if (!goal) return;
      const now = new Date().toISOString();
      const suggestions = suggestedActionsFor(goal.goalType);
      const targetFor = (template, frequency) => frequency === "daily" ? 7 : frequency === "few-days" || frequency === "choose-days" ? (template.defaultTarget || 3) : template.defaultTarget || null;
      const suggested = suggestions.filter(item => state.goalPlanDraft.actionIds.includes(item.id)).map(item => ({ id: `goal_action_${Math.random().toString(36).slice(2)}`, goalId: goal.id, templateId: item.id, title: localGoalText(item.title, state.language), actionType: item.frequency ? "RECURRING" : "ONE_TIME", source: "CARE_PLAN", verificationMethod: resolveGoalActionVerification({ templateId: item.id }), frequency: item.frequency ? state.goalPlanDraft.frequency : "", targetCount: item.frequency ? targetFor(item, state.goalPlanDraft.frequency) : null, schedule: null, remindersEnabled: state.goalPlanDraft.remindersEnabled, status: "ACTIVE", completionHistory: [], createdAt: now, updatedAt: now }));
      const custom = state.goalPlanDraft.customAction ? [{ id: `goal_action_${Math.random().toString(36).slice(2)}`, goalId: goal.id, templateId: "", title: state.goalPlanDraft.customAction, actionType: "RECURRING", source: "PATIENT", verificationMethod: "PATIENT_REPORT", frequency: state.goalPlanDraft.frequency, targetCount: state.goalPlanDraft.frequency === "daily" ? 7 : 3, schedule: null, remindersEnabled: state.goalPlanDraft.remindersEnabled, status: "ACTIVE", completionHistory: [], createdAt: now, updatedAt: now }] : [];
      goal.actions = [...suggested, ...custom]; goal.whyItMatters = state.goalPlanDraft.whyItMatters; goal.planStatus = "COMPLETED"; goal.planPersonalizationStatus = "COMPLETED"; goal.updatedAt = now;
      state.goalPlanStatus = "COMPLETED"; state.goalsStatus = "COMPLETED"; state.baselineResumeScreen = "ONBOARDING";
      goalHistoryEvent(goal.id, "PLAN_PERSONALIZATION_SAVED", { actionCount: goal.actions.length, remindersEnabled: state.goalPlanDraft.remindersEnabled, clinicalTargetChanged: false });
      audit(state, "patient_goal_plan_saved", "success", { goalId: goal.id, actionCount: goal.actions.length, clinicalTargetChanged: false, monitoringRuleChanged: false });
      state.goalFlowStep = "DISCOVERY";
      state.screen = state.goalFlowOrigin === "MY_GOALS" ? "MY_GOALS" : "ONBOARDING";
      state.activeGoalId = state.goalFlowOrigin === "MY_GOALS" ? goal.id : "";
      draftStore.save(state); render(); return;
    }
    if (action === "goal-detail-to-list") { state.activeGoalId = ""; state.goalDetailView = "SUMMARY"; state.goalNotice = ""; draftStore.save(state); render(); return; }
    if (action === "goal-detail-back") { state.goalDetailView = "SUMMARY"; state.error = ""; render(); return; }
    if (action === "edit-goal-why") { state.goalDetailView = "WHY_EDIT"; render(); return; }
    if (action === "save-goal-why") {
      const goal = currentGoal(); if (!goal) return;
      goal.whyItMatters = String(new FormData(document.querySelector("#goal-why-form")).get("whyItMatters") || "").trim().slice(0,300); goal.updatedAt = goalHistoryEvent(goal.id, "WHY_UPDATED", { hasWhy: Boolean(goal.whyItMatters) });
      state.goalDetailView = "SUMMARY"; draftStore.save(state); render(); return;
    }
    if (action === "complete-goal-action") {
      const goal = currentGoal(); const item = goal?.actions?.find(candidate => candidate.id === el.dataset.actionId); if (!item) return;
      if (resolveGoalActionVerification(item) !== "PATIENT_REPORT") return;
      const today = localDateKey(); item.completionHistory ||= [];
      if (!item.completionHistory.some(entry => entry.date === today)) item.completionHistory.push({ id: `completion_${Date.now().toString(36)}`, date: today, completedAt: new Date().toISOString(), source: "PATIENT_REPORTED" });
      if (item.actionType === "ONE_TIME") item.status = "COMPLETED";
      item.updatedAt = goalHistoryEvent(goal.id, "ACTION_COMPLETED", { actionId: item.id, actionSource: item.source, completionSource: "PATIENT_REPORT", verificationMethod: item.verificationMethod });
      draftStore.save(state); render(); return;
    }
    if (action === "view-goal-readings") { state.goalDetailView = "READINGS"; render(); return; }
    if (["explain-goal-reading", "explain-goal-trend", "learn-goal-topic", "ask-emmi-medication"].includes(action)) {
      const goal = currentGoal(); if (!goal) return;
      const health = goal.goalType === "BLOOD_PRESSURE_CONTROL" ? bloodPressureGoalRuntime(goal) : null;
      let question = "";
      if (action === "explain-goal-reading" && health?.latest) question = L(`What does my latest blood pressure reading of ${health.latest.systolic}/${health.latest.diastolic} mean?`, `¿Qué significa mi lectura más reciente de presión arterial de ${health.latest.systolic}/${health.latest.diastolic}?`, `Kisa dènye lekti tansyon mwen ${health.latest.systolic}/${health.latest.diastolic} vle di?`);
      if (action === "explain-goal-trend" && health?.trend) question = L("How has my blood pressure been this week?", "¿Cómo ha estado mi presión arterial esta semana?", "Kijan tansyon mwen te ye semèn sa a?");
      if (action === "ask-emmi-medication") question = L("I have a question about taking my medications as directed.", "Tengo una pregunta sobre cómo tomar mis medicamentos según las indicaciones.", "Mwen gen yon kesyon sou pran medikaman mwen jan yo mande a.");
      if (action === "learn-goal-topic") {
        const completedAt = new Date().toISOString();
        goal.educationHistory ||= [];
        if (!goal.educationHistory.some(item => item.topicId === "bp-numbers" && item.status === "COMPLETED")) goal.educationHistory.push({ id: `education_${Date.now().toString(36)}`, topicId: "bp-numbers", status: "COMPLETED", completedAt, source: "EMMI_EDUCATION", version: "1.0" });
        goalHistoryEvent(goal.id, "EDUCATION_COMPLETED", { topicId: "bp-numbers", completionSource: "EMMI_EDUCATION" });
        draftStore.save(state);
        question = health?.latest ? L(`Please explain what ${health.latest.systolic}/${health.latest.diastolic} means in simple language.`, `Explíqueme en palabras sencillas qué significa ${health.latest.systolic}/${health.latest.diastolic}.`, `Tanpri eksplike m nan mo senp sa ${health.latest.systolic}/${health.latest.diastolic} vle di.`) : L("What do blood pressure numbers mean?", "¿Qué significan los números de presión arterial?", "Kisa chif tansyon yo vle di?");
      }
      showHelp();
      if (question) await askEmmi(question);
      return;
    }
    if (action === "open-goal-checkin") { state.goalDetailView = "CHECK_IN"; render(); return; }
    if (action === "goal-checkin-response") {
      const goal = currentGoal(); if (!goal) return;
      const response = el.dataset.response; const timestamp = new Date().toISOString();
      goal.progress = [...(goal.progress || []), { id: `goal_progress_${Date.now().toString(36)}`, goalId: goal.id, progressType: GOAL_CONFIG[goal.goalType]?.progressType || "PATIENT_REPORTED", patientReportedStatus: response, timestamp }];
      goal.reviews = [...(goal.reviews || []), { id: `goal_review_${Date.now().toString(36)}`, goalId: goal.id, reviewedAt: timestamp, patientStatus: response, changesMade: false }];
      goalHistoryEvent(goal.id, "CHECK_IN_RECORDED", { response });
      if (response === "DIFFICULTY") state.goalDetailView = "BARRIERS";
      else if (response === "CHANGE_GOAL") { state.goalFlowOrigin = "MY_GOALS"; state.goalFlowStep = activePatientGoals().length > 1 ? "PRIORITY" : "DISCOVERY"; state.screen = "GOALS"; }
      else { state.goalDetailView = "SUMMARY"; state.goalNotice = L("Your check-in was saved.", "Su seguimiento fue guardado.", "Nou sove tcheke ou a."); }
      draftStore.save(state); render(); return;
    }
    // --- Barrier resolution ---------------------------------------------------------------
    //
    // §12's pattern is enforced structurally rather than by convention: no handler below calls a
    // provider. The ones that matter move the resolution onto a working step and let the render
    // driver make the call — which means the only way to reach a provider is through a step the
    // patient arrived at by pressing a button on a review screen.
    if (action.startsWith("barrier-")) {
      const resolution = barrierResolutionById(el.dataset.resolutionId || state.activeResolutionId || "");
      if (!resolution) { state.appointmentFlow = { ...state.appointmentFlow, view: "" }; render(); return; }
      const record = appointmentById(resolution.appointmentId);
      const data = resolution.data || {};
      state.barrierError = "";

      // Leaving is never destructive (§25). The resolution keeps its step, so coming back through
      // the barrier list resumes here rather than starting over.
      if (action === "barrier-close") {
        state.activeResolutionId = "";
        openAppointmentDetail(resolution.appointmentId);
        render(); return;
      }
      if (action === "barrier-back") {
        advanceTo(resolution, el.dataset.step || resolution.step);
        render(); return;
      }
      if (action === "barrier-decline") {
        const declined = advanceTo(resolution, "DECLINED");
        logResolution(RESOLUTION_EVENTS.ASSISTANCE_DECLINED, declined);
        render(); return;
      }
      if (action === "barrier-escalate") {
        const reason = el.dataset.reason || "EMMI_COULD_NOT_RESOLVE";
        await escalateResolution(resolution, reason, { keepStep: PARTIAL_ESCALATIONS.includes(reason) });
        render(); return;
      }

      // --- transportation -------------------------------------------------------------------
      if (action === "barrier-accept") {
        // Accepting help never re-asks for what the record already holds (§3): the address the
        // patient confirmed and the needs they already answered survive a second pass.
        advanceTo(resolution, "PICKUP", { pickupAddress: data.pickupAddress || null });
        render(); return;
      }
      if (action === "barrier-pickup-home") {
        const home = patientHomeAddress();
        if (!home) { advanceTo(resolution, "PICKUP_EDIT"); render(); return; }
        advanceTo(resolution, "NEEDS", { pickupAddress: home, needs: data.needs || [] });
        render(); return;
      }
      if (action === "barrier-pickup-other") { advanceTo(resolution, "PICKUP_EDIT"); render(); return; }
      if (action === "barrier-pickup-save") {
        const form = document.querySelector("#barrier-address-form");
        const draft = form ? Object.fromEntries(new FormData(form)) : {};
        const checked = validateAddress(draft);
        if (!checked.ok) {
          state.barrierError = addressErrorText(checked.errors[0], state.language);
          advanceTo(resolution, "PICKUP_EDIT", { addressDraft: draft });
          render(); return;
        }
        advanceTo(resolution, "NEEDS", { pickupAddress: checked.address, addressDraft: draft, needs: data.needs || [] });
        render(); return;
      }
      if (action === "barrier-need-toggle") {
        advanceTo(resolution, "NEEDS", { needs: toggleTransportNeed(data.needs || [], el.dataset.need || "") });
        render(); return;
      }
      if (action === "barrier-needs-continue") {
        // The one place a difficulty stops being a search and becomes a coordination job. A patient
        // who cannot get in and out of a car unaided is not offered one (§3.2).
        const suitability = transportationSuitability(data.needs || []);
        if (!suitability.standardRideAppropriate) {
          advanceTo(resolution, "NEEDS_UNSUPPORTED", { blockingNeeds: suitability.blockingNeeds });
          render(); return;
        }
        transportationTimeStep(resolution, record);
        render(); return;
      }
      if (action === "barrier-time-accept") { advanceTo(resolution, "SEARCHING"); render(); return; }
      if (action === "barrier-time-change") { advanceTo(resolution, "TIME_EDIT"); render(); return; }
      if (action === "barrier-time-select") {
        advanceTo(resolution, "TIME", { pickupAt: el.dataset.pickupAt || data.pickupAt });
        render(); return;
      }
      if (action === "barrier-option-select") {
        const optionId = el.dataset.optionId || "";
        const option = (data.options || []).find(item => item.optionId === optionId);
        const chosen = advanceTo(resolution, "REVIEW", { selectedOptionId: optionId, selectedRideType: option?.rideType || "" });
        logResolution(RESOLUTION_EVENTS.TRANSPORTATION_OPTION_SELECTED, chosen, { rideType: option?.rideType || "" });
        render(); return;
      }
      if (action === "barrier-reserve-confirm") {
        // The patient has now said it out loud on a review screen. This is the only path to a
        // reservation, and it books nothing itself — it hands the step to the driver.
        const confirmed = advanceTo(resolution, "BOOKING");
        logResolution(RESOLUTION_EVENTS.TRANSPORTATION_CONFIRMED, confirmed, { rideType: data.selectedRideType || "" });
        render(); return;
      }
      if (action === "barrier-retry") { advanceTo(resolution, "BOOKING"); render(); return; }
      if (action === "barrier-ride-cancel") { advanceTo(resolution, "CANCEL_CONFIRM"); render(); return; }
      if (action === "barrier-ride-cancel-confirm") {
        const released = await transportationService.cancel({ reservationId: data.reservation?.reservationId || "" });
        const canceled = advanceTo(resolution, "CANCELED", released.ok ? { reservation: null, returnReservation: null, reservationOutdated: false } : {});
        if (released.ok) logResolution(RESOLUTION_EVENTS.TRANSPORTATION_CANCELED, canceled, { replaced: false });
        render(); return;
      }
      if (action === "barrier-ride-change" || action === "barrier-transport-update") {
        // Changing a ride keeps the car that exists until a replacement is booked, so the patient
        // is never left with neither. The old reservation id travels forward as `replacing`.
        const ride = action === "barrier-transport-update" ? transportationResolutionFor(resolution.appointmentId) : resolution;
        if (!ride) { render(); return; }
        const rideRecord = appointmentById(ride.appointmentId);
        transportationTimeStep(ride, rideRecord, { replacingReservationId: ride.data?.reservation?.reservationId || "", reservationOutdated: false });
        openResolution(barrierResolutionById(ride.id));
        render(); return;
      }
      if (action === "barrier-return-yes") { advanceTo(resolution, "RETURN_TIME", { returnUnavailable: false }); render(); return; }
      if (action === "barrier-return-no") { advanceTo(resolution, "BOOKED"); render(); return; }
      if (action === "barrier-return-select") {
        advanceTo(resolution, "RETURN_BOOKING", {
          returnChoice: el.dataset.returnChoice || "WHEN_VISIT_ENDS",
          returnPickupAt: transportationService.returnPickup(record, el.dataset.returnChoice || "WHEN_VISIT_ENDS")
        });
        render(); return;
      }

      // --- video visit ----------------------------------------------------------------------
      if (action === "barrier-video-start" || action === "barrier-video-recheck") { advanceTo(resolution, "CHECKING"); render(); return; }
      if (action === "barrier-video-guide") { advanceTo(resolution, "GUIDE"); render(); return; }

      // --- companion ------------------------------------------------------------------------
      if (action === "barrier-companion-answer") {
        if ((el.dataset.answer || "") === "NO") { advanceTo(resolution, "NO_CONTACT"); render(); return; }
        advanceTo(resolution, "CONTACTS");
        render(); return;
      }
      if (action === "barrier-companion-select") {
        const contacts = companionService.contacts({ careCircleMembers: appointmentCareCircle().eligibleMembers, locale: state.language }).contacts;
        const contact = contacts.find(item => item.contactId === (el.dataset.contactId || ""));
        if (!contact) { render(); return; }
        advanceTo(resolution, "REVIEW", {
          contactId: contact.contactId,
          contactName: contact.firstName,
          contactRelationship: contact.relationship || "",
          contactSource: contact.source || ""
        });
        render(); return;
      }
      if (action === "barrier-companion-new") { advanceTo(resolution, "NEW_CONTACT"); render(); return; }
      if (action === "barrier-companion-save") {
        const form = document.querySelector("#barrier-contact-form");
        const draft = form ? Object.fromEntries(new FormData(form)) : {};
        const firstName = String(draft.firstName || "").trim().slice(0, 40);
        const phone = String(draft.phone || "").replace(/[^\d+]/g, "");
        // §115 minimum necessary: a first name and a way to reach them. Nothing else is asked for
        // and nothing else is stored.
        if (!firstName || phone.replace(/\D/g, "").length < 10) {
          state.barrierError = !firstName
            ? L("Add their first name.", "Agregue su nombre.", "Ajoute non li.")
            : L("Add a phone number with 10 numbers.", "Agregue un teléfono de 10 números.", "Ajoute yon nimewo telefòn ak 10 chif.");
          advanceTo(resolution, "NEW_CONTACT", { contactDraft: draft });
          render(); return;
        }
        advanceTo(resolution, "REVIEW", {
          contactId: `new-${phone.slice(-4)}`,
          contactName: firstName,
          contactRelationship: String(draft.relationship || "").trim().slice(0, 40),
          contactPhone: phone,
          contactSource: "PATIENT_ENTERED",
          contactDraft: draft
        });
        render(); return;
      }
      if (action === "barrier-companion-send") { advanceTo(resolution, "SENDING"); render(); return; }
      if (action === "barrier-companion-another") { advanceTo(resolution, "CONTACTS", { contactId: "", contactName: "", invitation: null }); render(); return; }

      // --- reschedule -----------------------------------------------------------------------
      if (action === "barrier-reschedule-start") { advanceTo(resolution, "SEARCHING"); render(); return; }
      if (action === "barrier-slot-select") {
        advanceTo(resolution, "REVIEW", {
          selectedSlotId: el.dataset.slotId || "",
          hasTransportation: Boolean(transportationResolutionFor(resolution.appointmentId)?.data?.reservation)
        });
        render(); return;
      }
      if (action === "barrier-reschedule-confirm") { advanceTo(resolution, "CHANGING"); render(); return; }

      // --- something else -------------------------------------------------------------------
      if (action === "barrier-other-submit") {
        const text = String(document.querySelector("#barrier-describe")?.value || "").trim().slice(0, 400);
        if (!text) { state.barrierError = L("Tell me a little about it.", "Cuénteme un poco.", "Di m yon ti kras sou li."); render(); return; }
        const described = advanceTo(resolution, "CLASSIFYING", { text });
        // What the patient wrote stays on the record and out of analytics: only its length goes in.
        logResolution(RESOLUTION_EVENTS.BARRIER_DESCRIBED, described, { characters: text.length });
        render(); return;
      }
      if (action === "barrier-route") {
        // The classifier said which playbook this is. Opening it is a new resolution of that type,
        // linked back to the one the patient described it in, so the activity log keeps the chain.
        const target = el.dataset.barrierType || data.routedTo || "";
        const created = createResolution({ appointmentId: resolution.appointmentId, patientId: state.offer?.patient?.id || "", barrierType: target });
        if (!created) { advanceTo(resolution, "ESCALATE_OFFER"); render(); return; }
        const existing = barrierResolutions().find(item => item.appointmentId === resolution.appointmentId && item.barrierType === target && item.status !== RESOLUTION_STATUS.CANCELLED);
        advanceTo(resolution, "ROUTED", { openedResolutionId: (existing || created).id });
        if (!existing) {
          saveResolution({ ...created, data: { fromResolutionId: resolution.id } });
          logResolution(RESOLUTION_EVENTS.BARRIER_IDENTIFIED, created, { via: "INTENT_CLASSIFIER" });
          logResolution(RESOLUTION_EVENTS.ASSISTANCE_OFFERED, created);
        }
        openResolution(existing || barrierResolutionById(created.id));
        render(); return;
      }
      render(); return;
    }

    // --- Appointment coordination -------------------------------------------------------------
    if (action.startsWith("appointment-")) {
      const appointmentId = el.dataset.appointmentId || el.dataset.needId || state.activeAppointmentId || "";
      const record = appointmentById(appointmentId);
      if (action === "appointment-open-list") { state.screen = "MY_APPOINTMENTS"; state.activeAppointmentId = ""; state.appointmentFlow = { tab: "" }; draftStore.save(state); render(); return; }
      if (action === "appointment-list-tab") { state.screen = "MY_APPOINTMENTS"; state.appointmentFlow = { tab: el.dataset.tab || "" }; draftStore.save(state); render(); return; }
      if (action === "appointment-back") { state.screen = "MY_CARE"; state.appointmentFlow = null; draftStore.save(state); render(); return; }
      if (action === "appointment-ask-emmi") {
        if (appointmentId) state.activeAppointmentId = appointmentId;
        const openedFromPrep = Boolean(el.closest(".appointment-prep-screen"));
        showHelp(el);
        if (openedFromPrep && record) {
          const topics = (record.prep?.topics || []).map(topic => String(topic || "").trim()).filter(Boolean);
          // One saved topic is already the patient's selection. Sending it through the normal EMMI
          // answer path gives a grounded response immediately; asking which topic they want would
          // only repeat the choice they made on the preparation screen. With several topics EMMI
          // still asks which one to start with instead of guessing.
          if (topics.length === 1) {
            audit(state, "appointment_prep_emmi_opened", "success", { appointmentId: record.id, topicCount: 1, topicAutoSelected: true });
            if (isMedicationPrepTopic(topics[0])) {
              const medications = activeMedications();
              const provider = record.providerDisplayName || L("your clinician", "su profesional clínico", "pwofesyonèl klinik ou");
              const response = medications.length
                ? L(
                    `These are the active medications in your care record. Choose any you want to review with ${provider}, and I’ll add them to your visit list. This does not change a prescription.`,
                    `Estos son los medicamentos activos en su registro. Elija los que quiera revisar con ${provider} y los agregaré a su lista para la cita. Esto no cambia ninguna receta.`,
                    `Men medikaman aktif ki nan dosye swen ou. Chwazi sa ou vle revize ak ${provider}, epi m ap ajoute yo nan lis vizit ou. Sa pa chanje okenn preskripsyon.`
                  )
                : L(
                    "I don’t see any active medications in your care record. You can type the medication name or add a question for your clinician to your visit list.",
                    "No veo medicamentos activos en su registro. Puede escribir el nombre del medicamento o agregar una pregunta para su profesional clínico a la lista de la cita.",
                    "Mwen pa wè okenn medikaman aktif nan dosye swen ou. Ou ka ekri non medikaman an oswa ajoute yon kesyon pou pwofesyonèl klinik ou nan lis vizit la."
                  );
              state.assistantMessages.push({ role: "user", text: topics[0], intent: "APPOINTMENT_PREP_TOPIC", appointmentId: record.id });
              state.assistantMessages.push({
                role: "assistant",
                text: response,
                intent: "APPOINTMENT_PREP_MEDICATIONS",
                appointmentId: record.id,
                prepMedicationOptions: medications.map(medication => ({
                  medicationId: medication.id,
                  name: medicationLabel(medication),
                  details: medicationDetails(medication) || medicationSig(medication)
                }))
              });
              emmiConversationManager?.recordTurn("user", topics[0], { screen: state.screen, appointmentId: record.id, source: "appointment-prep" });
              emmiConversationManager?.recordTurn("assistant", response, { screen: state.screen, appointmentId: record.id, source: "appointment-prep" });
              emmiConversationManager?.markGreeted();
              ensureEmmiRuntime().audit.transcript("user", topics[0]);
              ensureEmmiRuntime().audit.transcript("assistant", response);
              draftStore.save(state);
              refreshAssistantLayer();
              return;
            }
            await askEmmi(topics[0], { questionId: "appointment-prep-topic", source: "appointment-prep" });
            draftStore.save(state);
            return;
          }
          const text = appointmentPrepConversationOpening({ locale: state.language, appointment: record });
          state.assistantMessages.push({ role: "assistant", text, intent: "APPOINTMENT_PREP", appointmentId: record.id });
          emmiConversationManager?.recordTurn("assistant", text, { screen: state.screen, appointmentId: record.id, source: "appointment-prep" });
          emmiConversationManager?.markGreeted();
          ensureEmmiRuntime().audit.transcript("assistant", text);
          audit(state, "appointment_prep_emmi_opened", "success", { appointmentId: record.id, topicCount: topics.length, topicAutoSelected: false });
          draftStore.save(state);
          refreshAssistantLayer();
          return;
        }
        await askEmmi(record?.providerDisplayName
          ? L(`I have a question about my appointment with ${record.providerDisplayName}.`, `Tengo una pregunta sobre mi cita con ${record.providerDisplayName}.`, `Mwen gen yon kesyon sou randevou mwen ak ${record.providerDisplayName}.`)
          : L("I need help with an appointment.", "Necesito ayuda con una cita.", "Mwen bezwen èd ak yon randevou."), { questionId: "appointment-question", source: "appointment" });
        return;
      }
      if (action === "appointment-open") { if (record) openAppointmentDetail(record.id); render(); return; }
      if (!record) { state.screen = "MY_APPOINTMENTS"; state.appointmentFlow = { tab: "" }; render(); return; }

      if (action === "appointment-open-prep") { openAppointmentDetail(record.id, "PREP"); render(); return; }
      if (action === "appointment-open-brief") { openAppointmentDetail(record.id, "BRIEF"); render(); return; }
      if (action === "appointment-open-share") { openAppointmentDetail(record.id, "SHARE"); render(); return; }
      if (action === "appointment-open-reminder") { openAppointmentDetail(record.id, "REMINDER"); render(); return; }
      if (action === "appointment-open-barrier") { openAppointmentDetail(record.id, "BARRIER"); render(); return; }

      // §43-45: what the patient wants to talk about is theirs to write and theirs to remove.
      if (action === "appointment-add-prep-topic") {
        const input = document.querySelector('#appointment-prep-form [name="prepTopic"]');
        const topic = (input?.value || "").trim().slice(0, 200);
        if (!topic) return;
        const prep = record.prep || { topics: [], notes: "", sharedWithProvider: false, updatedAt: "" };
        const now = new Date().toISOString();
        saveAppointment({ ...record, prep: { ...prep, topics: [...(prep.topics || []), topic], emmiPreparation: { ...(prep.emmiPreparation || {}), status: "IN_PROGRESS", currentTopic: "", completedAt: "", updatedAt: now }, updatedAt: now }, updatedAt: now });
        openAppointmentDetail(record.id, "PREP"); render(); return;
      }
      if (action === "appointment-remove-prep-topic") {
        const index = Number(el.dataset.topicIndex);
        const prep = record.prep || { topics: [] };
        const now = new Date().toISOString();
        saveAppointment({ ...record, prep: { ...prep, topics: (prep.topics || []).filter((_, position) => position !== index), emmiPreparation: { ...(prep.emmiPreparation || {}), status: "IN_PROGRESS", currentTopic: "", completedAt: "", updatedAt: now }, updatedAt: now }, updatedAt: now });
        openAppointmentDetail(record.id, "PREP"); render(); return;
      }
      if (action === "appointment-remove-prep-medication") {
        const medicationId = el.dataset.medicationId || "";
        const prep = record.prep || { topics: [], medications: [] };
        const now = new Date().toISOString();
        saveAppointment({ ...record, prep: { ...prep, medications: (prep.medications || []).filter(item => item.medicationId !== medicationId), emmiPreparation: { ...(prep.emmiPreparation || {}), status: "IN_PROGRESS", completedAt: "", updatedAt: now }, updatedAt: now }, updatedAt: now });
        openAppointmentDetail(record.id, "PREP"); render(); return;
      }
      // §47: the brief goes to the provider only because the patient chose to send it.
      if (action === "appointment-share-brief") {
        const prep = record.prep || { topics: [], notes: "" };
        saveAppointment({ ...record, prep: { ...prep, sharedWithProvider: true, updatedAt: new Date().toISOString() }, updatedAt: new Date().toISOString() });
        ensureAppointmentCareTeamTask(record);
        openAppointmentDetail(record.id, "BRIEF"); render(); return;
      }

      if (action === "appointment-save-reminder") {
        const result = saveAppointmentReminder(record, el.dataset.slot || "");
        state.appointmentNotice = result.ok ? result.note : L("I couldn’t save that reminder.", "No pude guardar ese recordatorio.", "Mwen pa t ka anrejistre rapèl sa a.");
        openAppointmentDetail(record.id); render(); return;
      }

      // §114: sharing is offered only where a real, permitted member exists.
      if (action === "appointment-share-with-member") {
        const result = shareAppointmentWithMember(record, el.dataset.inviteId || "");
        state.appointmentNotice = result.ok
          ? L("Shared. They can see when and where the visit is, and nothing else.", "Compartido. Verán cuándo y dónde es la visita, y nada más.", "Pataje. Y ap wè kilè ak kote vizit la ye, epi anyen lòt.")
          : L("I couldn’t share this appointment.", "No pude compartir esta cita.", "Mwen pa t ka pataje randevou sa a.");
        openAppointmentDetail(record.id, "SHARE"); render(); return;
      }

      if (action === "appointment-get-directions") {
        if (!record.locationAddress) return;
        window.open(`https://maps.google.com/?q=${encodeURIComponent(record.locationAddress)}`, "_blank", "noopener");
        return;
      }

      // §61/§63: changing or cancelling is an explicit workflow, and cancelling asks twice.
      if (action === "appointment-request-reschedule") {
        const result = requestAppointmentReschedule(record);
        state.appointmentNotice = result.ok
          ? L("Your care team is working on a new time with the office.", "Su equipo está gestionando un nuevo horario con el consultorio.", "Ekip swen ou ap chèche yon lè nouvo ak kabinè a.")
          : L("I couldn’t request a change right now.", "No pude solicitar el cambio ahora.", "Mwen pa t ka mande chanjman an kounye a.");
        openAppointmentDetail(record.id); render(); return;
      }
      if (action === "appointment-request-cancel") { openAppointmentDetail(record.id, "CANCEL_CONFIRM"); render(); return; }
      if (action === "appointment-confirm-cancel") {
        const result = cancelAppointmentRecord(record);
        state.appointmentNotice = result.ok
          ? L("Your appointment is canceled.", "Su cita está cancelada.", "Randevou ou anile.")
          : L("I couldn’t cancel that appointment. Nothing was changed.", "No pude cancelar esa cita. No se cambió nada.", "Mwen pa t ka anile randevou sa a. Anyen pa chanje.");
        openAppointmentDetail(record.id); render(); return;
      }

      // §51/§113: the pre-visit check asks. The answer still records the barrier for the care team
      // exactly as it always did — and then, when EMMI has a playbook for it, opens the attempt to
      // solve it. The resolution screen is entered BEFORE the barrier is recorded because
      // recordAppointmentBarrier() paints on its way through, and a flash of the question the
      // patient just answered reads as the tap not registering.
      if (action === "appointment-barrier-answer") {
        const reasonKey = el.dataset.barrierReason || "";
        if (reasonKey === APPOINTMENT_BARRIER_REASONS.ALL_SET) {
          // §8: nothing to solve, so nothing is started. The answer is still recorded, because a
          // patient who said their visit is fine is not the same as one who was never asked.
          state.barrierReadinessAck = { ...(state.barrierReadinessAck || {}), [record.id]: new Date().toISOString() };
          audit(state, "appointment_readiness_confirmed", "success", { appointmentId: record.id });
          state.activeResolutionId = "";
          openAppointmentDetail(record.id, "ALL_SET");
          render(); return;
        }
        const started = startBarrierResolution(record, reasonKey);
        await recordAppointmentBarrier(record, reasonKey);
        if (!started && state.screen === "APPOINTMENT_DETAIL") openAppointmentDetail(record.id);
        render(); return;
      }

      // §65-69: attendance is asked once, answered without judgment, and a missed visit becomes
      // something to solve rather than something the patient failed at.
      if (action === "appointment-followup-attendance") {
        const outcome = el.dataset.outcome || ATTENDANCE_OUTCOMES.UNKNOWN;
        await recordAppointmentAttendance(record, outcome);
        if (state.screen === "APPOINTMENT_DETAIL" || state.screen === "MY_APPOINTMENTS") {
          openAppointmentDetail(record.id, "FOLLOW_UP");
          state.appointmentFlow = { ...state.appointmentFlow, step: outcome === ATTENDANCE_OUTCOMES.ATTENDED ? "ATTENDED" : "MISSED" };
        }
        render(); return;
      }
      if (action === "appointment-followup-need") {
        const need = el.dataset.need || "NOTHING";
        if (need !== "NOTHING") { ensureAppointmentCareTeamTask(record); state.appointmentNotice = L("Your care team will follow up with you.", "Su equipo se comunicará con usted.", "Ekip swen ou ap kontakte w."); }
        openAppointmentDetail(record.id); render(); return;
      }
      if (action === "appointment-followup-reschedule") {
        if ((el.dataset.answer || "") === "YES") {
          const started = startAppointmentNeed({
            source: APPOINTMENT_SOURCES.FOLLOW_UP,
            reasonCategory: record.reasonCategory,
            reasonSummary: record.reasonSummary,
            providerId: record.requestedProfessionalId,
            relatedGoalId: record.relatedGoalId
          });
          const { record: next } = classifyAppointmentPath(started.record);
          openAppointmentScheduling(next, "PROVIDER");
        } else openAppointmentDetail(record.id);
        render(); return;
      }

      // --- the scheduling flow ------------------------------------------------------------------
      if (action === "appointment-change-preferences") { openAppointmentScheduling(record, "PROVIDER"); render(); return; }
      if (action === "appointment-preference-back") {
        const steps = APPOINTMENT_PREFERENCE_STEPS;
        const at = Math.max(0, steps.indexOf(el.dataset.step || steps[0]) - 1);
        state.appointmentFlow = { ...state.appointmentFlow, appointmentId: record.id, step: steps[at] };
        render(); return;
      }
      // §26: one answer moves the patient one step. Nothing is submitted along the way.
      if (action === "appointment-preference-answer") {
        const field = el.dataset.field || "";
        const value = el.dataset.value || "";
        if (!APPOINTMENT_DRAFT_FIELDS.includes(field)) return;
        const patch = { [field]: value };
        if (field === "requestedProfessionalId") {
          const member = patientCareTeam().find(item => item.id === value);
          // Confirming a provider must never erase one. The care team is rebuilt from the offer and
          // the medication list, so a professional the need already names may not be in it; only an
          // explicit "someone else" clears the identity.
          if (member) Object.assign(patch, { providerDisplayName: member.displayName, requestedProfessionalType: member.professionalType, requestedSpecialty: member.specialty });
          else if (!value) Object.assign(patch, { providerDisplayName: "", requestedProfessionalType: "", requestedSpecialty: "" });
        }
        state.appointmentDraft = updateAppointmentDraft(state.appointmentDraft || createAppointmentDraft({ needId: record.id }), patch);
        saveAppointment({ ...record, ...patch, updatedAt: new Date().toISOString() });
        const steps = APPOINTMENT_PREFERENCE_STEPS;
        const at = Math.min(steps.length - 1, steps.indexOf(state.appointmentFlow?.step || steps[0]) + 1);
        const next = steps[at];
        const answered = appointmentById(record.id) || record;
        const duplicate = next === "REVIEW" ? existingAppointmentFor(answered) : null;
        state.appointmentFlow = duplicate
          ? { appointmentId: record.id, step: "DUPLICATE", duplicateId: duplicate.id }
          : { ...state.appointmentFlow, appointmentId: record.id, step: next };
        draftStore.save(state); render(); return;
      }
      if (action === "appointment-preference-other-time") {
        state.appointmentFlow = { ...state.appointmentFlow, appointmentId: record.id, step: "TIME_OF_DAY", showAllTimes: true };
        render(); return;
      }

      // §17/§19/§21/§23: where the patient goes next is decided by what the office actually
      // supports, and each of the four levels gets its own honest ending.
      if (action === "appointment-submit-request") {
        const ready = draftIsSubmittable(state.appointmentDraft || createAppointmentDraft({ needId: record.id }));
        if (!ready.ok) { state.appointmentFlow = { ...state.appointmentFlow, appointmentId: record.id, step: ready.missing.includes("requestedProfessionalId") ? "PROVIDER" : "REASON" }; render(); return; }
        // §82/§83: an appointment or a pending request the patient already has is shown before a
        // second one is created. "Request another one anyway" carries data-force and skips this.
        const alreadyHave = el.dataset.force === "1" ? null : existingAppointmentFor(record);
        if (alreadyHave) { state.appointmentFlow = { appointmentId: record.id, step: "DUPLICATE", duplicateId: alreadyHave.id }; render(); return; }
        // §11: the provider and the reason can both have changed since the need was created, so the
        // capability is resolved again here rather than trusting the value stamped at creation.
        const capability = appointmentCapability(record);
        if (capability.capability !== record.schedulingCapability) saveAppointment({ ...record, schedulingCapability: capability.capability, updatedAt: new Date().toISOString() });
        const current = appointmentById(record.id) || record;
        if (capability.capability === SCHEDULING_CAPABILITY.DIRECT_BOOKING) {
          const availability = loadAppointmentAvailability(current);
          state.appointmentFlow = { appointmentId: current.id, step: "SLOTS", error: availability.ok ? "" : (availability.error || "AVAILABILITY_UNAVAILABLE") };
          render(); return;
        }
        if (capability.capability === SCHEDULING_CAPABILITY.NO_AVAILABLE_CHANNEL) {
          // Nothing was sent anywhere. The screen says so, and the care team is the offered action.
          state.appointmentFlow = { appointmentId: current.id, step: "NO_CHANNEL" };
          render(); return;
        }
        const result = capability.capability === SCHEDULING_CAPABILITY.STRUCTURED_REQUEST
          ? sendAppointmentRequest(current)
          : escalateAppointmentToCoordinator(current, { capability: capability.capability });
        if (!result.ok) { state.appointmentFlow = { appointmentId: current.id, step: "REVIEW", error: result.error || "REQUEST_NOT_SENT" }; render(); return; }
        // The record that was actually sent is the one the confirmation describes. On an
        // idempotency hit that is the earlier request, not the one the patient was looking at.
        if (result.idempotent) { state.appointmentFlow = { appointmentId: current.id, step: "DUPLICATE", duplicateId: result.record.id }; render(); return; }
        state.activeAppointmentId = result.record.id;
        state.appointmentFlow = {
          appointmentId: result.record.id,
          step: capability.capability === SCHEDULING_CAPABILITY.STRUCTURED_REQUEST ? "REQUESTED" : "COORDINATING",
          error: ""
        };
        draftStore.save(state); scheduleSimulatedAppointmentResponses(); render(); return;
      }
      // §23: the only action offered when there is no scheduling channel at all.
      if (action === "appointment-ask-care-team") {
        const result = escalateAppointmentToCoordinator(record, { capability: SCHEDULING_CAPABILITY.NO_AVAILABLE_CHANNEL });
        state.appointmentFlow = result.ok
          ? { appointmentId: record.id, step: "COORDINATING" }
          : { appointmentId: record.id, step: "NO_CHANNEL", error: result.error || "" };
        draftStore.save(state); render(); return;
      }
      if (action === "appointment-more-times") {
        const availability = loadAppointmentAvailability(record);
        state.appointmentFlow = { appointmentId: record.id, step: "SLOTS", expanded: true, error: availability.ok ? "" : (availability.error || "AVAILABILITY_UNAVAILABLE") };
        render(); return;
      }
      // §123/§124: a time that could not be held sends the patient back to real times, never to a
      // confirmation screen, and never with the blame.
      if (action === "appointment-select-slot") {
        state.appointmentFlow = { appointmentId: record.id, step: "REVIEW_SLOT", selectedSlotId: el.dataset.slotId || "", error: "" };
        draftStore.save(state); render(); return;
      }
      if (action === "appointment-confirm-slot") {
        const result = confirmAppointmentSlot(record, el.dataset.slotId || "");
        if (result.ok) { state.appointmentFlow = { appointmentId: record.id, step: "BOOKED" }; state.screen = "APPOINTMENT_SCHEDULING"; draftStore.save(state); render(); return; }
        const availability = loadAppointmentAvailability(result.record || record);
        state.appointmentFlow = { appointmentId: record.id, step: "SLOTS", error: result.slotGone ? "SLOT_GONE" : (availability.ok ? "BOOKING_FAILED" : "AVAILABILITY_UNAVAILABLE") };
        render(); return;
      }
      return;
    }
    if (action === "open-my-medications") { state.screen = "MY_MEDICATIONS"; state.refillFlow = { medicationId: "", step: "", answer: "" }; state.medicationNotice = ""; draftStore.save(state); render(); return; }
    if (action === "open-my-appointments") { state.screen = "MY_APPOINTMENTS"; state.activeAppointmentId = ""; state.appointmentFlow = { tab: el.dataset.tab || "" }; draftStore.save(state); render(); return; }
    if (action === "back-to-appointments") { state.screen = "MY_APPOINTMENTS"; state.appointmentFlow = { tab: el.dataset.tab || "" }; draftStore.save(state); render(); return; }
    if (action === "back-to-my-care") { state.screen = "MY_CARE"; state.refillFlow = { medicationId: "", step: "", answer: "" }; draftStore.save(state); render(); return; }
    if (action === "close-refill-flow") { state.refillFlow = { medicationId: "", step: "", answer: "" }; state.error = ""; render(); return; }
    if (action === "start-manual-refill") {
      // The patient asked, so the medication is theirs to choose. With one active medication there
      // is nothing to disambiguate.
      const medications = activeMedications();
      state.screen = "MY_MEDICATIONS";
      state.refillFlow = medications.length === 1
        ? { medicationId: medications[0].id, step: "REVIEW", answer: "" }
        : { medicationId: medications[0]?.id || "", step: "SELECT", answer: "" };
      if (medications.length === 1) startRefillEpisode(medications[0], { source: "PATIENT" });
      audit(state, "medication_refill_requested_by_patient", "success", { medicationCount: medications.length });
      render(); return;
    }
    if (action === "review-medication-refill") {
      const medication = medicationById(el.dataset.medicationId || "");
      if (!medication) return;
      // An existing request answers the question rather than starting a second one.
      const existing = openRefillForMedication(medication.id);
      state.screen = "MY_MEDICATIONS";
      if (existing) {
        state.activeRefillId = existing.id;
        state.refillFlow = { medicationId: medication.id, step: "STATUS", answer: "" };
        render(); return;
      }
      const episode = startRefillEpisode(medication, { source: "PATIENT", signal: openSupplySignalFor(medication.id) });
      state.activeRefillId = episode.id;
      state.refillFlow = { medicationId: medication.id, step: "REVIEW", answer: "" };
      render(); return;
    }
    if (action === "view-refill-status") {
      const medication = medicationById(el.dataset.medicationId || "");
      const episode = medication ? openRefillForMedication(medication.id) : null;
      if (!medication || !episode) return;
      state.screen = "MY_MEDICATIONS";
      state.activeRefillId = episode.id;
      state.refillFlow = { medicationId: medication.id, step: "STATUS", answer: "" };
      render(); return;
    }
    if (action === "refill-taking-answer") {
      const medication = medicationById(state.refillFlow?.medicationId || "");
      const episode = activeRefillEpisode();
      if (!medication || !episode) return;
      const answer = el.dataset.answer || TAKING_ANSWERS.UNSURE;
      saveRefillEpisode({ ...episode, patientConfirmedTaking: answer, updatedAt: new Date().toISOString() });
      audit(state, "medication_refill_taking_answered", "success", { medicationId: medication.id, answer });
      // Anything other than a plain yes stops the refill: the record and the patient disagree, and
      // that is reconciliation's business, not a pharmacy's.
      if (answer === TAKING_ANSWERS.CHANGED) { state.refillFlow = { ...state.refillFlow, step: "CHANGED" }; render(); return; }
      if (answer === TAKING_ANSWERS.STOPPED) { await blockRefill(medication, REFILL_BLOCKERS.PATIENT_STOPPED, { reviewStatus: "NOT_TAKING" }); return; }
      if (answer === TAKING_ANSWERS.UNSURE) { await blockRefill(medication, REFILL_BLOCKERS.UNSURE); return; }
      state.refillFlow = { ...state.refillFlow, step: "SUPPLY" };
      render(); return;
    }
    if (action === "refill-change-answer") {
      const medication = medicationById(state.refillFlow?.medicationId || "");
      if (!medication) return;
      const change = el.dataset.change || "OTHER";
      if (change === "DOSE") { state.refillFlow = { ...state.refillFlow, step: "DOSE" }; state.error = ""; render(); return; }
      if (change === "CONCERN") { await blockRefill(medication, REFILL_BLOCKERS.MEDICATION_CONCERN, { description: L("The patient reports this medication makes them feel unwell.", "El paciente informa que este medicamento le hace sentir mal.", "Pasyan an rapòte medikaman sa a fè l santi l mal."), reviewStatus: "" }); return; }
      if (change === "FREQUENCY") { await blockRefill(medication, REFILL_BLOCKERS.MEDICATION_DISCREPANCY, { reviewStatus: "FREQUENCY_CHANGED" }); return; }
      await blockRefill(medication, REFILL_BLOCKERS.MEDICATION_DISCREPANCY);
      return;
    }
    if (action === "submit-refill-dose") {
      const medication = medicationById(state.refillFlow?.medicationId || "");
      if (!medication) return;
      const reported = String(new FormData(document.querySelector("#refill-dose-form")).get("patientReportedDose") || "").trim();
      if (!reported) { state.error = L("Tell us what you are taking so your care team can review it.", "Díganos qué está tomando para que su equipo lo revise.", "Di nou sa w ap pran pou ekip ou ka revize l."); render(); return; }
      await blockRefill(medication, REFILL_BLOCKERS.MEDICATION_DISCREPANCY, { reviewStatus: "DOSE_CHANGED", patientReportedDose: reported });
      return;
    }
    if (action === "refill-supply-answer") {
      const medication = medicationById(state.refillFlow?.medicationId || "");
      const episode = activeRefillEpisode();
      if (!medication || !episode) return;
      const answer = el.dataset.answer || SUPPLY_ANSWERS.UNSURE;
      saveRefillEpisode({ ...episode, patientConfirmedLowSupply: answer, updatedAt: new Date().toISOString() });
      audit(state, "medication_refill_supply_answered", "success", { medicationId: medication.id, answer });
      if (answer === SUPPLY_ANSWERS.ENOUGH) {
        // The estimate was wrong, and the patient's answer is the one that counts.
        const signal = openSupplySignalFor(medication.id);
        if (signal) saveSupplySignal(answerSupplySignal(signal, { status: SIGNAL_STATUS.NOT_NEEDED }));
        saveRefillEpisode(advanceRefill(episode, { status: REFILL_STATUS.CANCELED, source: "PATIENT", detail: { reason: "PATIENT_HAS_ENOUGH" } }));
        state.medicationNotice = L("Good to know. I’ll check again later.", "Bueno saberlo. Lo revisaré más adelante.", "Bon pou m konnen. M ap tcheke ankò pita.");
        state.refillFlow = { medicationId: "", step: "", answer: "" };
        draftStore.save(state); render(); return;
      }
      const signal = openSupplySignalFor(medication.id);
      if (signal) saveSupplySignal(answerSupplySignal(signal, { status: SIGNAL_STATUS.CONFIRMED_LOW_SUPPLY }));
      state.refillResolution = resolveRefillPath({ medication: { ...medication, prescriber: medicationPrescriber(medication) }, capabilities: { pharmacyFulfillment: true } });
      // A path that needs a person is not a request the patient has to confirm: it is submitted so
      // the right people see it, and the patient is told what is happening.
      if ([REFILL_PATHS.APPOINTMENT_REQUIRED, REFILL_PATHS.LAB_OR_OTHER_REQUIREMENT, REFILL_PATHS.CARE_TEAM_REVIEW].includes(state.refillResolution.path)) {
        submitAndShow(medication, activeRefillEpisode(), state.refillResolution);
        return;
      }
      state.refillFlow = { ...state.refillFlow, step: "CONFIRM" };
      render(); return;
    }
    if (action === "submit-refill-request") {
      const medication = medicationById(state.refillFlow?.medicationId || "");
      const episode = activeRefillEpisode();
      if (!medication || !episode) return;
      // Guard the moment itself: a second tap while the first is in flight is the same intent.
      if (episode.status === REFILL_STATUS.SUBMITTING || !refillIsOpen(episode)) return;
      saveRefillEpisode(advanceRefill(episode, { status: REFILL_STATUS.SUBMITTING, source: "ITERA" }));
      const resolution = state.refillResolution || resolveRefillPath({ medication: { ...medication, prescriber: medicationPrescriber(medication) }, capabilities: { pharmacyFulfillment: true } });
      submitAndShow(medication, activeRefillEpisode(), resolution);
      return;
    }
    if (action === "change-refill-pharmacy") {
      // Changing a pharmacy is a real workflow this prototype does not have, so it says so rather
      // than pretending, and hands it to the people who can do it.
      const medication = medicationById(state.refillFlow?.medicationId || "");
      if (!medication) return;
      ensureMedicationCareTeamTask("MEDICATION_PHARMACY_CHANGE", { medicationId: medication.id, refillId: activeRefillEpisode()?.id || null, priority: "ROUTINE", reason: "PATIENT_REQUESTED_PHARMACY_CHANGE", summary: { medication: medicationLabel(medication), currentPharmacy: medication.pharmacy?.name || "" } });
      audit(state, "medication_pharmacy_change_requested", "success", { medicationId: medication.id });
      state.medicationNotice = L("Your care team will help you change pharmacy for this medication.", "Su equipo le ayudará a cambiar de farmacia para este medicamento.", "Ekip swen ou ap ede w chanje famasi pou medikaman sa a.");
      state.refillFlow = { medicationId: "", step: "", answer: "" };
      draftStore.save(state); render(); return;
    }
    if (action === "coordinate-refill-appointment") {
      const medication = medicationById(el.dataset.medicationId || state.refillFlow?.medicationId || "");
      const episode = medication ? openRefillForMedication(medication.id) : null;
      if (!medication || !episode) return;
      // A renewal that needs a visit is an appointment need like any other. The medication context
      // travels with it so nobody has to ask the patient for it again, and the record exists before
      // the patient answers anything, so leaving mid-way does not lose the need.
      const prescriber = medicationPrescriber(medication);
      const started = startAppointmentNeed({
        source: APPOINTMENT_SOURCES.SYSTEM_WORKFLOW,
        reasonCategory: APPOINTMENT_REASON_CATEGORIES.MEDICATION_RENEWAL,
        reasonSummary: L(`Follow-up visit required before renewing ${medicationLabel(medication)}.`, `Se requiere una visita de seguimiento antes de renovar ${medicationLabel(medication)}.`, `Yo mande yon vizit swivi anvan yo renouvle ${medicationLabel(medication)}.`),
        providerId: prescriber?.id || "",
        professionalType: "PRESCRIBER",
        relatedRefillId: episode.id
      });
      const { record } = classifyAppointmentPath(started.record);
      saveRefillEpisode({ ...episode, relatedAppointmentNeedId: record.id, updatedAt: new Date().toISOString() });
      audit(state, "medication_refill_appointment_requested", "success", { medicationId: medication.id, refillId: episode.id, capability: record.schedulingCapability });
      state.refillFlow = { medicationId: "", step: "", answer: "" };
      openAppointmentScheduling(record, "PROVIDER");
      render(); return;
    }
    if (action === "refill-pickup-check") {
      const medication = medicationById(el.dataset.medicationId || state.refillFlow?.medicationId || "");
      if (!medication) return;
      state.refillFlow = { medicationId: medication.id, step: "PICKUP", answer: "" };
      render(); return;
    }
    if (action === "refill-pickup-answer") {
      const medication = medicationById(state.refillFlow?.medicationId || "");
      const episode = medication ? openRefillForMedication(medication.id) : null;
      if (!medication || !episode) return;
      if (el.dataset.answer === "YES") {
        // The only thing that closes a refill is the medication reaching the patient.
        const completed = advanceRefill({ ...episode, resolutionOutcome: "PATIENT_OBTAINED" }, { status: REFILL_STATUS.COMPLETED, source: "PATIENT" });
        saveRefillEpisode(completed);
        auditRefill("medication_refill_completed", completed, { confirmedBy: "PATIENT" });
        state.medicationNotice = L("Good. I’ll keep an eye on your next refill.", "Muy bien. Estaré atenta a su próxima surtida.", "Trè byen. M ap veye pwochen ranplisaj ou.");
        state.refillFlow = { medicationId: "", step: "", answer: "" };
        draftStore.save(state); render(); return;
      }
      state.refillFlow = { ...state.refillFlow, step: "PICKUP_BARRIER" };
      render(); return;
    }
    if (action === "refill-barrier-answer") {
      const medication = medicationById(state.refillFlow?.medicationId || "");
      const episode = medication ? openRefillForMedication(medication.id) : null;
      if (!medication) return;
      const category = el.dataset.barrier === "PHARMACY_NOT_READY" ? "ACCESS_TO_CARE" : el.dataset.barrier || "OTHER";
      const goal = currentGoal();
      // The barrier engine owns "I could not get it" — this hands over to it rather than building a
      // second one for medications.
      const barrier = goal
        ? recordBarrier({ goal, category, patientDescription: L(`Could not get ${medicationLabel(medication)} after the refill.`, `No pudo obtener ${medicationLabel(medication)} después de la surtida.`, `Pa t ka jwenn ${medicationLabel(medication)} apre ranplisaj la.`), source: BARRIER_SOURCES.EMMI })
        : null;
      if (episode) saveRefillEpisode({ ...episode, relatedBarrierId: barrier?.id || null, updatedAt: new Date().toISOString() });
      audit(state, "medication_refill_barrier_reported", "success", { medicationId: medication.id, category });
      if (barrier) {
        state.activeGoalId = barrier.goalId;
        state.activeBarrierId = barrier.id;
        state.screen = "MY_GOALS";
        state.goalDetailView = "SUMMARY";
        state.refillFlow = { medicationId: "", step: "", answer: "" };
        await planNextBarrierHelp(barrier);
        return;
      }
      ensureMedicationCareTeamTask("MEDICATION_ACCESS_SUPPORT", { medicationId: medication.id, refillId: episode?.id || null, priority: "ROUTINE", reason: category, summary: { medication: medicationLabel(medication), issue: category } });
      state.medicationNotice = L("Your care team will help with this.", "Su equipo le ayudará con esto.", "Ekip swen ou ap ede w ak sa.");
      state.refillFlow = { medicationId: "", step: "", answer: "" };
      draftStore.save(state); render(); return;
    }
    if (action === "ask-emmi-about-refill") {
      const medication = medicationById(state.refillFlow?.medicationId || "");
      showHelp(el);
      await askEmmi(medication
        ? L(`I have a question about my ${medication.name} refill.`, `Tengo una pregunta sobre la surtida de ${medication.name}.`, `Mwen gen yon kesyon sou ranplisaj ${medication.name} mwen.`)
        : L("I have a question about a refill.", "Tengo una pregunta sobre una surtida.", "Mwen gen yon kesyon sou yon ranplisaj."), { questionId: "refill-question", source: "medication-refill" });
      return;
    }
    if (action === "open-goal-barriers") { state.goalDetailView = "BARRIERS"; state.error = ""; state.activeBarrierId = ""; render(); return; }
    if (action === "select-goal-barrier") {
      const goal = currentGoal(); if (!goal) return;
      const category = el.dataset.barrierCategory || "OTHER";
      // "Something else" is a question, not a category: the patient describes it and the same
      // classifier EMMI uses decides what kind of help it needs.
      if (category === "OTHER") { state.goalBarrierDraft = { category, patientDescription: "" }; state.goalDetailView = "BARRIER_DESCRIBE"; state.error = ""; render(); return; }
      await startBarrierHelp({ goal, category });
      return;
    }
    if (action === "submit-goal-barrier-description") {
      const goal = currentGoal(); if (!goal) return;
      const described = String(new FormData(document.querySelector("#goal-barrier-describe-form")).get("patientDescription") || "").trim();
      if (!described) { state.error = L("Tell us a little about what is difficult.", "Cuéntenos un poco qué se le hace difícil.", "Di nou yon ti kras sou sa ki difisil."); render(); return; }
      const classified = classifyBarrierText(described);
      await startBarrierHelp({ goal, category: classified.category || "OTHER", patientDescription: described });
      return;
    }
    if (action === "describe-barrier-with-emmi") {
      const goal = currentGoal();
      state.goalDetailView = "SUMMARY";
      showHelp(el);
      await askEmmi(L("Something is making this goal difficult and I want to tell you about it.", "Algo me está dificultando esta meta y quiero contárselo.", "Gen yon bagay ki fè objektif sa a difisil e mwen vle di w sa."), { questionId: "barrier-describe", source: "goal-barrier" });
      audit(state, "goal_barrier_described_with_emmi", "success", { goalId: goal?.id || "" });
      return;
    }
    if (action === "accept-barrier-help" || action === "set-barrier-reminder") {
      const barrier = activeBarrier();
      const type = state.barrierHelpPlan?.intervention;
      if (!barrier || !type) { state.goalDetailView = "SUMMARY"; render(); return; }
      const detail = action === "set-barrier-reminder" ? { slot: el.dataset.reminderSlot } : {};
      const applied = applyBarrierHelp(barrier, type, detail);
      // Never report success for something that did not happen.
      if (!applied.ok) {
        state.error = L("I couldn’t set that up right now. You can try again, or I can ask your care team to help.", "No pude configurarlo ahora. Puede intentar de nuevo o puedo pedir ayuda a su equipo.", "Mwen pa t ka fè sa kounye a. Ou ka eseye ankò oswa mwen ka mande ekip swen ou ede.");
        render();
        return;
      }
      const updated = applyIntervention(barrier, { type, detail: applied.detail });
      persistBarrier(updated, { historyEvent: "BARRIER_INTERVENTION_STARTED", historyDetails: { intervention: type } });
      auditBarrier("goal_barrier_intervention_started", updated, { intervention: type });
      state.error = "";
      await runInterventionSideEffect(updated, type, el);
      return;
    }
    if (action === "decline-barrier-help") {
      const barrier = activeBarrier();
      const type = state.barrierHelpPlan?.intervention;
      if (!barrier || !type) { state.goalDetailView = "SUMMARY"; render(); return; }
      // Declining is a choice on the record. It is never adherence language, and it stops EMMI
      // from offering the same thing again.
      const offered = applyIntervention(barrier, { type, detail: { offeredOnly: true } });
      const declined = recordInterventionOutcome(offered, { outcome: RESOLUTION_OUTCOMES.PATIENT_DECLINED });
      persistBarrier(declined, { historyEvent: "BARRIER_HELP_DECLINED", historyDetails: { intervention: type } });
      auditBarrier("goal_barrier_help_declined", declined, { intervention: type });
      state.goalNotice = L("That’s okay. You can come back to this whenever you want.", "Está bien. Puede volver a esto cuando quiera.", "Sa bon. Ou ka retounen sou sa lè ou vle.");
      state.goalDetailView = "SUMMARY";
      state.activeBarrierId = "";
      draftStore.save(state); render(); return;
    }
    if (action === "review-goal-barrier") {
      const barrier = findBarrierById(el.dataset.barrierId || "");
      if (!barrier) return;
      state.activeBarrierId = barrier.id;
      const awaitingOutcome = (barrier.interventions || []).some(item => !item.outcome && item.type !== INTERVENTION_TYPES.SAFETY_ESCALATION);
      if (barrier.status === BARRIER_STATUS.SUSPECTED) { state.goalDetailView = "BARRIERS"; render(); return; }
      if (awaitingOutcome) { state.goalDetailView = "BARRIER_FOLLOW_UP"; render(); return; }
      await planNextBarrierHelp(barrier);
      return;
    }
    if (action === "barrier-follow-up-response") {
      const barrier = activeBarrier(); if (!barrier) return;
      const outcome = el.dataset.outcome || RESOLUTION_OUTCOMES.PARTIALLY_HELPED;
      const updated = recordInterventionOutcome(barrier, { outcome });
      persistBarrier(updated, { historyEvent: "BARRIER_OUTCOME_RECORDED", historyDetails: { outcome } });
      auditBarrier("goal_barrier_outcome", updated, { outcome });
      if (outcome === RESOLUTION_OUTCOMES.RESOLVED) {
        // Not "problem solved": the patient said it helped, so that is what we say back.
        state.goalNotice = L("Glad that helped.", "Me alegra que le haya ayudado.", "Mwen kontan sa te ede w.");
        state.goalDetailView = "SUMMARY";
        state.activeBarrierId = "";
        draftStore.save(state); render(); return;
      }
      state.goalNotice = L("We’ll keep working on this.", "Seguiremos trabajando en esto.", "N ap kontinye travay sou sa.");
      await planNextBarrierHelp(updated);
      return;
    }
    if (action === "ask-emmi-about-barrier") {
      const barrier = activeBarrier();
      showHelp(el);
      if (barrier) {
        await askEmmi(L(`I need help with this: ${barrierPatientSummary(barrier, "en")}.`, `Necesito ayuda con esto: ${barrierPatientSummary(barrier, "es")}.`, `Mwen bezwen èd ak sa: ${barrierPatientSummary(barrier, "ht")}.`), { questionId: `barrier-${barrier.category}`, source: "goal-barrier" });
      }
      return;
    }
    if (action === "dismiss-suspected-barrier") {
      const barrier = activeBarrier() || findBarrierById(el.dataset.barrierId || "");
      if (!barrier) return;
      const closed = { ...barrier, status: BARRIER_STATUS.CLOSED, resolutionOutcome: RESOLUTION_OUTCOMES.NO_LONGER_RELEVANT, resolvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      persistBarrier(closed, { historyEvent: "BARRIER_SIGNAL_DISMISSED" });
      auditBarrier("goal_barrier_signal_dismissed", closed);
      state.goalNotice = L("Thank you for letting me know.", "Gracias por avisarme.", "Mèsi paske ou fè m konnen.");
      state.goalDetailView = "SUMMARY";
      state.activeBarrierId = "";
      draftStore.save(state); render(); return;
    }
    if (action === "pause-goal" || action === "reactivate-goal") {
      const goal = currentGoal(); if (!goal) return;
      goal.status = action === "pause-goal" ? "PAUSED" : "ACTIVE"; goal.updatedAt = goalHistoryEvent(goal.id, action === "pause-goal" ? "GOAL_PAUSED" : "GOAL_REACTIVATED");
      state.goalNotice = action === "pause-goal" ? L("This goal is paused. You can come back to it later.", "Esta meta está pausada. Puede retomarla después.", "Objektif sa a an poz. Ou ka retounen sou li pita.") : L("This goal is active again.", "Esta meta está activa nuevamente.", "Objektif sa a aktif ankò.");
      draftStore.save(state); render(); return;
    }
    if (action === "goal-mark-achieved") { state.goalDetailView = "ACHIEVE_CONFIRM"; render(); return; }
    if (action === "confirm-goal-achieved") {
      const goal = currentGoal(); if (!goal) return;
      goal.status = "ACHIEVED"; goal.updatedAt = goalHistoryEvent(goal.id, "GOAL_ACHIEVED", { clinicalOutcomeChanged: false, cmsOutcomeChanged: false }); state.goalDetailView = "SUMMARY"; draftStore.save(state); render(); return;
    }
    if (action === "change-goal-priority") { state.goalFlowOrigin = "MY_GOALS"; state.goalFlowStep = activePatientGoals().length > 1 ? "PRIORITY" : "DISCOVERY"; state.screen = "GOALS"; render(); return; }
    if (action === "open-my-care-team") { state.screen = "MY_CARE_TEAM"; state.careTeamAddOpen = false; state.careTeamNotice = ""; draftStore.save(state); render(); return; }
    if (action === "open-care-team-member") {
      state.careTeamAddOpen = true;
      state.careTeamMemberDraft = { displayName: "", role: "", specialty: "", practiceName: "" };
      state.careTeamNotice = "";
      render(); return;
    }
    if (action === "cancel-care-team-member") {
      state.careTeamAddOpen = false;
      state.careTeamMemberDraft = { displayName: "", role: "", specialty: "", practiceName: "" };
      state.careTeamNotice = "";
      render(); return;
    }
    if (action === "save-care-team-member") {
      const form = document.querySelector("#care-team-member-form");
      if (!form) return;
      const data = new FormData(form);
      const displayName = String(data.get("careTeamDisplayName") || "").trim().slice(0, 80);
      const role = String(data.get("careTeamRole") || "");
      const specialtyInput = String(data.get("careTeamSpecialty") || "").trim().slice(0, 60);
      const practiceName = String(data.get("careTeamPracticeName") || "").trim().slice(0, 80);
      const type = role === "CARDIOLOGIST" || role === "SPECIALIST" ? PROFESSIONAL_TYPES.SPECIALIST
        : PROFESSIONAL_TYPES[role] || (role === "OTHER" ? PROFESSIONAL_TYPES.UNKNOWN : "");
      const specialty = role === "CARDIOLOGIST" ? "Cardiology" : specialtyInput;
      if (!displayName || !type || (role === "SPECIALIST" && !specialty)) {
        state.careTeamNotice = L("Please complete the required information.", "Complete la información requerida.", "Tanpri ranpli enfòmasyon obligatwa yo.");
        render(); return;
      }
      const member = {
        id: `patient-care-team-${Date.now().toString(36)}`,
        displayName,
        professionalType: type,
        specialty,
        practiceName,
        source: CARE_TEAM_SOURCES.PATIENT_REPORTED,
        verified: false,
        createdAt: new Date().toISOString()
      };
      state.patientAddedCareTeamMembers = [...(state.patientAddedCareTeamMembers || []), member];
      state.careTeamAddOpen = false;
      state.careTeamMemberDraft = { displayName: "", role: "", specialty: "", practiceName: "" };
      state.careTeamNotice = L("Care team member added.", "Miembro agregado al equipo de cuidado.", "Manm ekip swen an ajoute.");
      audit(state, "patient_care_team_member_added", "success", { memberId: member.id, professionalType: member.professionalType, source: member.source });
      draftStore.save(state); render(); return;
    }
    if (action === "open-my-care-circle") { state.screen = "MY_CARE_CIRCLE"; state.careCircleNotice = ""; render(); return; }
    if (action === "invite-another-care-circle") { Object.assign(state, { growthReturnScreen: "MY_CARE_CIRCLE", careCircleContext: "ONGOING_CARE", supportPersonName: "", supportPersonPhone: "", supportPersonRelationship: "", supportPersonRelationshipOther: "", careCircleContactNumbers: [], careCircleNotice: "", screen: "CARE_CIRCLE_INVITE" }); render(); return; }
    if (action === "resend-care-circle") { const result = growthStore.resendSupportInvite(el.dataset.inviteId); state.careCircleNotice = result.status === "COOLDOWN" ? L(`Please wait ${result.retryAfterSeconds} seconds before sending again.`, `Espere ${result.retryAfterSeconds} segundos antes de volver a enviar.`, `Tanpri tann ${result.retryAfterSeconds} segonn anvan ou voye ankò.`) : result.inviteId ? L("Invitation sent again.", "Invitación reenviada.", "Envitasyon an voye ankò.") : L("This invitation could not be resent.", "No se pudo reenviar esta invitación.", "Nou pa t kapab voye envitasyon sa a ankò."); audit(state, "invite_resent", result.inviteId ? "success" : result.status, { inviteId: el.dataset.inviteId }); render(); return; }
    if (action === "cancel-care-circle") { growthStore.revokeSupportInvite(el.dataset.inviteId); state.careCircleNotice = L("Invitation canceled.", "Invitación cancelada.", "Envitasyon an anile."); audit(state, "invite_canceled", "success", { inviteId: el.dataset.inviteId }); render(); return; }
    if (action === "manage-care-circle-permissions") { const invite = growthStore.allSupportInvites().find(item => item.inviteId === el.dataset.inviteId); if (invite) Object.assign(state, { supportInviteId: invite.inviteId, supportPersonName: invite.supportPerson.name, careCirclePermissions: invite.careCirclePermissions || state.careCirclePermissions, growthReturnScreen: "MY_CARE_CIRCLE", screen: "CARE_CIRCLE_PERMISSIONS" }); render(); return; }
    if (action === "confirm-remove-care-circle") { state.careCircleRemovePendingId = el.dataset.inviteId; state.screen = "CARE_CIRCLE_REMOVE_CONFIRMATION"; render(); return; }
    if (action === "keep-care-circle-member") { state.careCircleRemovePendingId = ""; state.screen = "MY_CARE_CIRCLE"; render(); return; }
    if (action === "remove-care-circle-member") { const inviteId = state.careCircleRemovePendingId; growthStore.removeCareCircleMember(inviteId); state.careCircleRemovePendingId = ""; state.careCircleNotice = L("Care Circle member removed.", "Miembro del Círculo de cuidado eliminado.", "Manm Sèk swen an retire."); audit(state, "member_removed", "success", { inviteId }); state.screen = "MY_CARE_CIRCLE"; render(); return; }
    if (action === "dismiss-care-circle-post") {
      const preferences = growthStore.dismissPrompt("care-circle");
      state.careCirclePromptDismissedAt = preferences.careCirclePromptDismissedAt;
      state.screen = state.growthReturnScreen || "ENROLLMENT_CONFIRMED";
      draftStore.save(state); render(); return;
    }
    if (action === "save-care-circle") {
      const selected = [...new FormData(document.querySelector("#care-circle-permissions-form")).getAll("careCirclePermission")];
      state.careCirclePermissions = Object.fromEntries(Object.keys(state.careCirclePermissions).map(permission => [permission, selected.includes(permission)]));
      state.careCircleStatus = "ACTIVE";
      state.supportInviteStatus = state.supportInviteStatus === "NONE" ? "ACCEPTED" : state.supportInviteStatus;
      if (state.supportInviteId) growthStore.updateSupportInvite(state.supportInviteId, { careCircleStatus: "ACTIVE", careCirclePermissions: state.careCirclePermissions });
      audit(state, "care_circle_activated", "success", { inviteId: state.supportInviteId || null, enabledPermissions: selected });
      state.screen = state.growthReturnScreen || "ENROLLMENT_CONFIRMED";
      draftStore.save(state); render(); return;
    }
    if (action === "share-access") {
      if (state.enrollmentStatus !== "COMPLETED") return;
      const channel = el.dataset.shareChannel;
      const share = growthStore.createAccessShare({ channel, origin: location.origin });
      const message = `${L("I’m getting extra support for my health through Medicare’s ACCESS Model with ITERA HEALTH.", "Estoy recibiendo apoyo adicional para mi salud mediante el Modelo ACCESS de Medicare con ITERA HEALTH.", "Mwen resevwa plis sipò pou sante mwen atravè Modèl ACCESS Medicare avèk ITERA HEALTH.")}\n\n${L("If you have Original Medicare and manage a chronic health condition, you can learn more here:", "Si tiene Medicare Original y maneja una condición crónica, puede obtener más información aquí:", "Si ou gen Medicare Orijinal epi w ap jere yon pwoblèm sante kwonik, ou ka aprann plis isit la:")}\n${share.publicAccessLandingUrl}`;
      let delivered = false;
      if (channel === "WEB_SHARE" && navigator.share) { try { await navigator.share({ title: "Medicare ACCESS", text: message, url: share.publicAccessLandingUrl }); delivered = true; } catch { delivered = false; } }
      else if (channel === "SMS") { window.open(`sms:?&body=${encodeURIComponent(message)}`, "_self"); delivered = true; }
      if (channel === "COPY_LINK" || (channel === "WEB_SHARE" && !delivered)) { try { await navigator.clipboard.writeText(share.publicAccessLandingUrl); delivered = true; } catch { delivered = false; } }
      state.activeAccessShare = share;
      state.accessShares = [...state.accessShares, share];
      state.growthNotice = delivered ? (channel === "COPY_LINK" || (channel === "WEB_SHARE" && !navigator.share) ? L("Public ACCESS link copied.", "Enlace público de ACCESS copiado.", "Lyen piblik ACCESS la kopye.") : L("ACCESS information is ready to share.", "La información de ACCESS está lista para compartir.", "Enfòmasyon ACCESS pare pou pataje.")) : L("We couldn’t open sharing. You can try Copy link.", "No pudimos abrir la opción para compartir. Puede intentar Copiar enlace.", "Nou pa t kapab ouvri opsyon pataj la. Ou ka eseye Kopye lyen.");
      audit(state, "access_information_shared", delivered ? "success" : "unavailable", { shareId: share.shareId, channel });
      draftStore.save(state); render();
      return;
    }
    if (action === "enable-emmi-guidance") {
      if (!emmiVoiceIsSupported(languageCode())) {
        state.emmiVoiceGuidance = false;
        state.assistantVoiceError = "VOICE_UNAVAILABLE_FOR_LOCALE";
        audit(state, "emmi_voice_capability_blocked", "unavailable", emmiVoiceMetadata(languageCode(), { sessionId: state.sessionId, screenId: state.screen }));
        persistEmmiPreferences();
        render();
        return;
      }
      state.emmiVoiceGuidance = true;
      state.emmiVoiceGuidancePaused = false;
      state.emmiWelcomeAcknowledged = true;
      state.assistantVoiceMuted = false;
      state.assistantVoiceState = "CONNECTING";
      state.assistantVoiceError = "";
      state.emmiLastGuidanceScreen = "";
      persistEmmiPreferences();
      // Resolve the welcome from the locale the patient has selected right now.
      const message = state.screen === "INVITATION" ? emmiSpokenWelcome() : (emmiGuidanceForScreen() || emmiSpokenWelcome());
      // Open the playback AudioContext while the click still counts as a user gesture. Created
      // later it starts suspended, and the welcome plays silently until some other tap resumes it.
      ensureEmmiRuntime().live.prepareAudioPlayback();
      render();
      // Connect inside the click's task too: deferring it (rAF/timeout) drops user activation and
      // Chrome then refuses the microphone prompt, so the welcome never played on the first click.
      deliverEmmiGuidance(message, state.screen, { connect: true });
      return;
    }
    if (action === "disable-emmi-guidance") {
      state.emmiVoiceGuidance = false;
      state.emmiVoiceGuidancePaused = false;
      state.emmiVoiceOptionsOpen = false;
      state.emmiTranscriptOpen = false;
      state.emmiWelcomeAcknowledged = true;
      state.emmiGuidanceTranscript = "";
      emmiTransitionManager?.setEnabled(false);
      if (emmiLive && !["DISCONNECTED", "ERROR"].includes(state.assistantVoiceState)) emmiLive.disconnect("guidance_disabled");
      persistEmmiPreferences();
      render();
      return;
    }
    if (action === "open-emmi-voice-options") {
      // Remember what opened the sheet so focus can go back exactly where the patient left it.
      emmiSheetReturnAction = "open-emmi-voice-options";
      state.emmiVoiceOptionsOpen = true;
      state.emmiTranscriptOpen = false;
      refreshVoiceGuidanceControls();
      requestAnimationFrame(() => document.querySelector(".emmi-sheet-close")?.focus({ preventScroll: true }));
      return;
    }
    if (action === "close-emmi-sheet") { closeEmmiSheets(); return; }
    if (action === "toggle-emmi-transcript") { state.emmiTranscriptOpen = !state.emmiTranscriptOpen; refreshVoiceGuidanceControls(); return; }
    if (action === "toggle-emmi-guidance-pause") {
      state.emmiVoiceGuidancePaused = !state.emmiVoiceGuidancePaused;
      emmiTransitionManager?.setPaused(state.emmiVoiceGuidancePaused);
      if (emmiLive && !["DISCONNECTED", "ERROR"].includes(state.assistantVoiceState)) {
        emmiLive.stopPlayback();
        emmiLive.setMuted(state.emmiVoiceGuidancePaused);
      }
      state.assistantVoiceMuted = state.emmiVoiceGuidancePaused;
      refreshVoiceGuidanceControls();
      if (!state.emmiVoiceGuidancePaused) deliverEmmiGuidance(emmiGuidanceForScreen() || state.emmiGuidanceTranscript, state.screen, { connect: !emmiLive || ["DISCONNECTED", "ERROR"].includes(state.assistantVoiceState) });
      return;
    }
    if (action === "repeat-emmi-guidance") {
      if (emmiGuidanceIsBusy()) return;
      const message = state.screen === "INVITATION" ? emmiSpokenWelcome() : (emmiGuidanceForScreen() || state.emmiGuidanceTranscript);
      if (!state.emmiVoiceGuidance) { state.emmiVoiceGuidance = true; state.emmiWelcomeAcknowledged = true; persistEmmiPreferences(); }
      state.emmiVoiceGuidancePaused = false;
      emmiTransitionManager?.cancel("explicit_repeat", { immediate: true });
      ensureEmmiRuntime().live.prepareAudioPlayback();
      deliverEmmiGuidance(message, state.screen, { connect: !emmiLive || ["DISCONNECTED", "ERROR"].includes(state.assistantVoiceState) });
      return;
    }
    if (action === "start-next-flow" || action === "resume-next-flow") {
      const transition = currentFlowTransition();
      const progress = gettingStartedProgress();
      const now = new Date().toISOString();
      const resumed = action === "resume-next-flow" || [FLOW_STATUS.DEFERRED, FLOW_STATUS.IN_PROGRESS].includes(progress.status);
      const resumeRoute = gettingStartedResumeRoute();
      state.enrollmentConfirmed = true;
      state.enrollmentStatus = "COMPLETED";
      state.enrollmentCompletedAt ||= state.consentTimestamp || now;
      setGettingStartedProgress(FLOW_STATUS.IN_PROGRESS, { startedAt: progress.startedAt || now, deferredAt: "", resumeRoute });
      state.activationStatus = "IN_PROGRESS";
      state.activationStartedAt ||= now;
      if (state.offer.pathway === "ACCESS") {
        state.baselineStatus = state.baselineStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
        state.baselineStartedAt ||= now;
        state.baselineResumeScreen = resumeRoute;
      }
      if (["RPM", "CCM_RPM", "PCM_RPM"].includes(state.offer.pathway)) state.deviceSetupStatus ||= "NOT_STARTED";
      audit(state, resumed ? "next_flow_resumed" : "next_flow_started_now", "success", { completedFlow: transition.completedFlow, nextFlowType: transition.nextFlow, actionType: currentNextBestAction().actionType });
      state.screen = resumeRoute;
      draftStore.save(state);
      render();
      startAssignedDeviceLookupIfPending();
      return;
    }
    if (action === "defer-next-flow") {
      const transition = currentFlowTransition();
      const now = new Date().toISOString();
      const resumeRoute = resolveGettingStartedEntryRoute({
        pathway: state.offer.pathway,
        journey: journeyFor(state),
        configuredRoute: transition.nextRoute
      });
      state.enrollmentConfirmed = true;
      state.enrollmentStatus = "COMPLETED";
      state.enrollmentCompletedAt ||= state.consentTimestamp || now;
      setGettingStartedProgress(FLOW_STATUS.DEFERRED, { deferredAt: now, resumeRoute });
      state.activationStatus = "NOT_STARTED";
      state.baselineDeferredAt = now;
      state.baselineResumeScreen = resumeRoute;
      audit(state, "next_flow_deferred", "success", { completedFlow: transition.completedFlow, nextFlowType: transition.nextFlow, resumeRoute });
      state.screen = "FLOW_DEFERRED";
      draftStore.save(state);
      render();
      return;
    }
    if (action === "go-to-my-care") {
      state.screen = "MY_CARE";
      draftStore.save(state);
      render();
      return;
    }
    if (action === "next") {
      if (el.disabled || el.dataset.pending === "true") return;
      el.dataset.pending = "true";
      el.disabled = true;
      try { await advance(); } finally { if (el.isConnected) { delete el.dataset.pending; el.disabled = false; } }
    }
    if (action === "back") {
      if (state.screen === "FLOW_DEFERRED") {
        state.screen = "ENROLLMENT_CONFIRMED";
        render();
      } else if (state.screen === "MY_GOALS") {
        if (state.activeGoalId) { state.activeGoalId = ""; state.goalDetailView = "SUMMARY"; }
        else state.screen = "MY_CARE";
        draftStore.save(state); render();
      } else if (state.screen === "GOALS" && state.goalFlowOrigin === "MY_GOALS" && state.goalFlowStep === "DISCOVERY") {
        state.screen = "MY_GOALS"; state.activeGoalId = ""; draftStore.save(state); render();
      } else if (["CARE_CIRCLE_INVITE", "CARE_CIRCLE_INVITE_SENT", "CARE_CIRCLE_PERMISSIONS", "SHARE_ACCESS"].includes(state.screen)) {
        state.screen = state.growthReturnScreen || (state.enrollmentStatus === "COMPLETED" ? "ENROLLMENT_CONFIRMED" : "INVITATION");
        render();
      } else if (state.screen === "MY_CARE_TEAM" && state.careTeamAddOpen) {
        state.careTeamAddOpen = false; state.careTeamNotice = ""; render();
      } else if (["MY_CARE_CIRCLE", "MY_CARE_TEAM"].includes(state.screen)) {
        state.screen = "MY_CARE"; render();
      } else if (state.screen === "CARE_CIRCLE_REMOVE_CONFIRMATION") {
        state.screen = "MY_CARE_CIRCLE"; render();
      } else if (["MEDICATIONS_REVIEW", "CARE_PREFERENCES", "GOALS", "ACCESS_SUPPORT_NEEDS"].includes(state.screen) && state.returnScreen === "ONBOARDING") {
        state.screen = "ONBOARDING";
        state.baselineResumeScreen = "ONBOARDING";
        draftStore.save(state); render();
      } else if (state.screen === "MY_MEDICATIONS" && state.refillFlow?.step) {
        // The refill status is a view inside the medication list, not a screen of its own. Back
        // closes it and leaves the list standing.
        state.refillFlow = { medicationId: "", step: "", answer: "" };
        state.activeRefillId = "";
        state.error = "";
        draftStore.save(state); render();
      } else if (POST_ENROLLMENT_PARENT[state.screen]) {
        state.screen = POST_ENROLLMENT_PARENT[state.screen];
        state.error = "";
        draftStore.save(state); render();
      } else {
        const previous = previousScreen(state);
        // No previous screen means this one is not on the enrollment journey. An enrolled patient
        // belongs in My Care, never back on the invitation to a programme they already joined.
        state.screen = previous || (state.enrollmentStatus === "COMPLETED" ? "MY_CARE" : "INVITATION");
        render();
      }
    }
    if (action === "care-setup-section") {
      const destination = { medications: "MEDICATIONS_REVIEW", preferences: "CARE_PREFERENCES", goals: "GOALS", support: "ACCESS_SUPPORT_NEEDS" }[el.dataset.section];
      if (!destination) return;
      // The list is the origin now, whatever opened the goals last time. A stale "MY_GOALS" left
      // over from the patient's own goal list would otherwise decide where continuing sends them.
      if (destination === "GOALS") state.goalFlowOrigin = "ONBOARDING";
      state.returnScreen = "ONBOARDING";
      state.baselineResumeScreen = destination;
      state.screen = destination;
      state.error = "";
      draftStore.save(state); render();
    }
    if (action === "select-health-review") {
      const selection = el.dataset.reviewChoice;
      state.healthInformationReviewResult = selection;
      state.error = "";
      if (selection === "correct") {
        state.healthInformationFlowStep = "CHOICE";
        if (state.healthInformationReviewStatus !== "CONFIRMED") {
          state.healthInformationReviewStatus = "UNREVIEWED";
          state.healthInformationStepStatus = "NOT_STARTED";
        }
      } else if (selection === "changed") {
        state.healthInformationReviewStatus = "UNREVIEWED";
        state.healthInformationStepStatus = "NOT_STARTED";
        state.healthInformationUpdateDraft = { id: "", updateType: "", relatedConditionIds: [], patientReportedText: "" };
        state.healthInformationFlowStep = "CHANGE_TYPE";
      } else if (selection === "help") {
        completeHealthInformationReview("NEEDS_HELP");
        state.healthInformationFlowStep = "HELP_OPTIONS";
      }
      draftStore.save(state); render(); return;
    }
    if (action === "confirm-health-information") {
      if (state.healthInformationReviewResult !== "correct") return;
      const reviewedAt = completeHealthInformationReview("CONFIRMED");
      state.healthInformationFlowStep = "CHOICE";
      audit(state, "health_information_confirmed", "success", { reviewedAt, reviewedBy: state.healthInformationReviewedBy, source: state.healthInformationReviewSource });
      state.screen = "ONBOARDING";
      draftStore.save(state); render(); return;
    }
    if (action === "health-flow-back") {
      const previous = { CHANGE_TYPE: "CHOICE", CHANGE_DETAILS: "CHANGE_TYPE", CHANGE_REVIEW: "CHANGE_DETAILS", HELP_OPTIONS: "CHOICE" }[state.healthInformationFlowStep] || "CHOICE";
      state.healthInformationFlowStep = previous;
      state.error = "";
      if (previous === "CHOICE") {
        state.healthInformationReviewResult = "";
        state.healthInformationReviewStatus = "UNREVIEWED";
        state.healthInformationStepStatus = "NOT_STARTED";
      }
      render(); return;
    }
    if (action === "select-health-update-type") {
      const updateType = el.dataset.updateType;
      const rawConditions = state.offer.qualifyingConditions?.length ? state.offer.qualifyingConditions : [state.offer.qualifyingCondition].filter(Boolean);
      const relatedConditionIds = ["CONDITION_QUESTIONED", "INFORMATION_INCORRECT"].includes(updateType) && rawConditions.length === 1 ? [rawConditions[0].id || "condition-1"] : [];
      state.healthInformationUpdateDraft = { id: state.healthInformationUpdateDraft?.id || "", updateType, relatedConditionIds, patientReportedText: state.healthInformationUpdateDraft?.updateType === updateType ? state.healthInformationUpdateDraft.patientReportedText : "" };
      state.healthInformationFlowStep = "CHANGE_DETAILS";
      state.error = "";
      render(); return;
    }
    if (action === "review-health-update") {
      const form = document.querySelector("#health-update-form");
      const data = new FormData(form);
      const updateType = state.healthInformationUpdateDraft?.updateType || "";
      const relatedConditionIds = data.getAll("healthCondition").map(String);
      const patientReportedText = String(data.get("patientReportedText") || "").trim().slice(0, 500);
      const conditionSpecific = ["CONDITION_QUESTIONED", "INFORMATION_INCORRECT"].includes(updateType);
      const requiresText = ["NEW_INFORMATION", "OTHER"].includes(updateType);
      if (conditionSpecific && !relatedConditionIds.length) { state.error = L("Choose the information that changed.", "Seleccione la información que cambió.", "Chwazi enfòmasyon ki chanje a."); render(); return; }
      if (requiresText && !patientReportedText) { state.error = L("Tell us what you would like your care team to know.", "Indique qué desea que sepa su equipo de atención.", "Di nou sa ou ta renmen ekip swen ou konnen."); render(); return; }
      state.healthInformationUpdateDraft = { ...state.healthInformationUpdateDraft, relatedConditionIds, patientReportedText };
      state.healthInformationFlowStep = "CHANGE_REVIEW";
      state.error = "";
      render(); return;
    }
    if (action === "edit-health-update") { state.healthInformationFlowStep = "CHANGE_DETAILS"; state.error = ""; render(); return; }
    if (action === "save-health-update") {
      const draft = state.healthInformationUpdateDraft || {};
      if (!draft.updateType) return;
      const now = new Date().toISOString();
      const id = draft.id || `health_update_${Date.now().toString(36)}`;
      const existing = (state.patientReportedHealthUpdates || []).find(update => update.id === id);
      const update = { id, patientId: state.offer?.patient?.id || "", relatedConditionIds: [...(draft.relatedConditionIds || [])], updateType: draft.updateType, patientReportedText: draft.patientReportedText || "", patientReportedStatus: "NEEDS_REVIEW", source: "PATIENT_REPORTED", createdAt: existing?.createdAt || now, updatedAt: now, status: "OPEN" };
      state.patientReportedHealthUpdates = existing ? state.patientReportedHealthUpdates.map(item => item.id === id ? update : item) : [...(state.patientReportedHealthUpdates || []), update];
      const task = ensureHealthInformationTask("HEALTH_INFORMATION_CHANGE_REVIEW", { healthUpdateId: id, updateType: update.updateType });
      update.careTeamTaskId = task.id;
      const reviewedAt = completeHealthInformationReview("CHANGES_REPORTED");
      state.healthInformationReviewResult = "changed";
      state.healthInformationFlowStep = "CHANGE_SAVED";
      state.healthInformationUpdateDraft = { id, updateType: update.updateType, relatedConditionIds: [...update.relatedConditionIds], patientReportedText: update.patientReportedText };
      audit(state, "patient_reported_health_update_saved", "success", { healthUpdateId: id, updateType: update.updateType, reviewedAt, clinicalRecordChanged: false, careTeamTaskId: task.id });
      draftStore.save(state); render(); return;
    }
    if (action === "view-health-update") {
      const update = (state.patientReportedHealthUpdates || []).at(-1);
      if (!update) return;
      state.healthInformationUpdateDraft = { id: update.id, updateType: update.updateType, relatedConditionIds: [...(update.relatedConditionIds || [])], patientReportedText: update.patientReportedText || "" };
      state.healthInformationFlowStep = "CHANGE_REVIEW";
      render(); return;
    }
    if (action === "edit-saved-health-update") {
      const update = (state.patientReportedHealthUpdates || []).at(-1);
      if (!update) return;
      state.healthInformationUpdateDraft = { id: update.id, updateType: update.updateType, relatedConditionIds: [...(update.relatedConditionIds || [])], patientReportedText: update.patientReportedText || "" };
      state.healthInformationFlowStep = "CHANGE_DETAILS";
      render(); return;
    }
    if (action === "change-health-review-answer") {
      state.healthInformationReviewResult = "";
      state.healthInformationReviewStatus = "UNREVIEWED";
      state.healthInformationStepStatus = "NOT_STARTED";
      state.healthInformationFlowStep = "CHOICE";
      state.error = "";
      draftStore.save(state); render(); return;
    }
    if (action === "health-ask-emmi") {
      const reviewedAt = completeHealthInformationReview("NEEDS_HELP");
      audit(state, "health_information_help_requested", "success", { channel: "EMMI", reviewedAt });
      draftStore.save(state); showHelp(); return;
    }
    if (action === "health-ask-care-team") {
      const reviewedAt = completeHealthInformationReview("NEEDS_HELP");
      const task = ensureHealthInformationTask("HEALTH_INFORMATION_HELP_REQUEST");
      state.healthInformationFlowStep = "HELP_CONFIRMED";
      audit(state, "health_information_help_requested", "success", { channel: "CARE_TEAM", reviewedAt, careTeamTaskId: task.id });
      draftStore.save(state); render(); return;
    }
    if (action === "defer-health-review") {
      const reviewedAt = completeHealthInformationReview("NEEDS_HELP");
      audit(state, "health_information_help_deferred", "success", { reviewedAt });
      state.screen = "ONBOARDING";
      draftStore.save(state); render(); return;
    }
    if (action === "return-health-setup") { state.screen = "ONBOARDING"; state.baselineResumeScreen = "ONBOARDING"; draftStore.save(state); render(); return; }
    if (action === "confirm-medication-current") { savePatientMedicationReview(el.dataset.medicationId, "CONFIRMED_CURRENT"); Object.assign(state, { medicationChangeId: "", medicationChangeType: "", error: "" }); draftStore.save(state); render(); }
    if (action === "open-medication-change") { state.medicationChangeId = el.dataset.medicationId; state.medicationChangeType = ""; state.error = ""; render(); }
    if (action === "cancel-medication-change") { state.medicationChangeId = ""; state.medicationChangeType = ""; state.error = ""; render(); }
    if (action === "select-medication-change") {
      const medicationId = el.dataset.medicationId;
      const changeType = el.dataset.changeType;
      if (["NOT_TAKING", "NEEDS_REVIEW"].includes(changeType)) { savePatientMedicationReview(medicationId, changeType); state.medicationChangeId = ""; state.medicationChangeType = ""; draftStore.save(state); render(); return; }
      state.medicationChangeId = medicationId; state.medicationChangeType = changeType; state.error = ""; render();
    }
    if (action === "save-medication-change") {
      const data = Object.fromEntries(new FormData(document.querySelector("#medication-change-form")));
      const status = state.medicationChangeType;
      const value = status === "DOSE_CHANGED" ? String(data.patientReportedDose || "").trim() : String(data.patientReportedFrequency || "");
      if (!value) { state.error = status === "DOSE_CHANGED" ? L("Enter the dose you take now.", "Ingrese la dosis que toma ahora.", "Antre dòz ou pran kounye a.") : L("Choose how often you take it now.", "Seleccione con qué frecuencia lo toma ahora.", "Chwazi konbyen fwa ou pran li kounye a."); render(); return; }
      savePatientMedicationReview(el.dataset.medicationId, status, status === "DOSE_CHANGED" ? { patientReportedDose: value.slice(0, 80) } : { patientReportedFrequency: value });
      Object.assign(state, { medicationChangeId: "", medicationChangeType: "", error: "" }); draftStore.save(state); render();
    }
    if (action === "change-medication-answer") { const reviews = { ...(state.medicationReviews || {}) }; delete reviews[el.dataset.medicationId]; state.medicationReviews = reviews; state.medicationsReviewStatus = "IN_PROGRESS"; state.medicationChangeId = ""; state.medicationChangeType = ""; audit(state, "patient_medication_review_changed", "success", { medicationId: el.dataset.medicationId }); draftStore.save(state); render(); }
    if (action === "open-add-medication") { state.medicationAddOpen = true; state.medicationEditId = ""; state.error = ""; requestScroll({ explicit: SCROLL.REVEAL_TARGET, targetSelector: "#add-medication-form" }); render(); }
    if (action === "cancel-add-medication") { state.medicationAddOpen = false; state.medicationEditId = ""; state.error = ""; render(); }
    if (action === "no-additional-medications") { state.additionalMedicationsStatus = "NONE"; state.medicationsReviewStatus = "IN_PROGRESS"; audit(state, "additional_medications_reviewed", "success", { status: "NONE" }); draftStore.save(state); render(); }
    if (action === "unsure-additional-medications") { state.additionalMedicationsStatus = "UNSURE"; state.medicationsReviewStatus = "IN_PROGRESS"; if (!(state.careTeamTasks || []).some(task => task.type === "MEDICATION_RECONCILIATION_REVIEW" && task.reason === "ADDITIONAL_MEDICATIONS_UNSURE" && task.status === "OPEN")) state.careTeamTasks.push({ id: `med_unsure_${Date.now().toString(36)}`, type: "MEDICATION_RECONCILIATION_REVIEW", reason: "ADDITIONAL_MEDICATIONS_UNSURE", status: "OPEN", createdAt: new Date().toISOString() }); audit(state, "additional_medications_reviewed", "success", { status: "UNSURE" }); draftStore.save(state); render(); }
    if (action === "add-medication") {
      const form = document.querySelector("#add-medication-form");
      const data = Object.fromEntries(new FormData(form));
      const name = String(data.medicationName || "").trim();
      if (!name) { state.error = L("Enter the medication name.", "Ingrese el nombre del medicamento.", "Antre non medikaman an."); render(); return; }
      const createdAt = new Date().toISOString();
      const item = { id: state.medicationEditId || `patient-med-${Date.now().toString(36)}`, medicationName: name.slice(0, 80), dose: String(data.medicationDetails || "").trim().slice(0, 120), frequency: String(data.medicationFrequency || ""), frequencyLabel: form.querySelector('[name="medicationFrequency"] option:checked')?.textContent || "", source: "PATIENT_REPORTED", createdAt };
      state.additionalMedications = state.medicationEditId ? state.additionalMedications.map(existing => existing.id === state.medicationEditId ? { ...item, createdAt: existing.createdAt } : existing) : [...state.additionalMedications, item];
      state.additionalMedicationsStatus = "ADDED";
      state.medicationsReviewStatus = "IN_PROGRESS";
      state.baselineResumeScreen = "MEDICATIONS_REVIEW";
      state.medicationAddOpen = false; state.medicationEditId = ""; state.error = "";
      if (!(state.careTeamTasks || []).some(task => task.type === "MEDICATION_RECONCILIATION_REVIEW" && task.additionalMedicationId === item.id && task.status === "OPEN")) state.careTeamTasks.push({ id: `new_med_${Date.now().toString(36)}`, type: "MEDICATION_RECONCILIATION_REVIEW", additionalMedicationId: item.id, reason: "NEW_MEDICATION", status: "OPEN", createdAt });
      audit(state, "patient_reported_medication_added", "success", { additionalMedicationId: item.id, source: item.source, createdAt });
      draftStore.save(state); render();
    }
    if (action === "edit-added-medication") { state.medicationEditId = el.dataset.medicationId; state.medicationAddOpen = true; state.error = ""; render(); }
    if (action === "remove-added-medication") { state.additionalMedications = state.additionalMedications.filter(item => item.id !== el.dataset.medicationId); state.additionalMedicationsStatus = state.additionalMedications.length ? "ADDED" : "UNREVIEWED"; audit(state, "patient_reported_medication_removed", "success", { additionalMedicationId: el.dataset.medicationId }); draftStore.save(state); render(); }
    if (action === "help") {
      // The conversation is the same EMMI: closing the sheet is presentation, not a new session.
      if (state.emmiVoiceOptionsOpen) closeEmmiSheets({ returnFocus: false });
      showHelp(el);
    }
    if (action === "authority-document") showHelp(el);
    if (action === "callback") { state.callbackRequested = true; state.returnScreen = state.screen; state.screen = "CALLBACK_CONFIRMED"; audit(state, "callback_requested"); render(); }
    if (action === "return") { state.screen = state.returnScreen || "INVITATION"; render(); }
    if (action === "language") {
      // setLanguage resets the guidance transcript and rebuilds the voice session in the new
      // language, so EMMI continues rather than going silent after a switch.
      setLanguage(state.language === "en" ? "es" : state.language === "es" ? "ht" : "en");
      render();
    }
    if (action === "change-representative-phone") { state.phoneVerified = false; state.representativeOtpDeliveryId = ""; state.screen = "PERSONAL_REPRESENTATIVE_DETAILS"; draftStore.save(state); render(); }
    if (action === "bp-care-team-help") {
      state.bpDeviceVerificationStatus = "NEEDS_REVIEW";
      state.deviceVerificationStatus = "NEEDS_REVIEW";
      state.baselineReminderStatus = "CARE_TEAM_ASSISTANCE";
      audit(state, "bp_device_care_team_help_requested", "success", { deviceIdentificationMethod: state.bpDeviceIdentificationMethod });
      draftStore.save(state); showHelp();
    }
    if (action === "bp-retry-assignment") {
      state.deviceUncertaintyStep = false;
      state.deviceVerificationStatus = "CHECKING";
      state.bpDeviceVerificationStatus = "CHECKING";
      state.screen = "ACCESS_BP_DEVICE_VERIFICATION";
      draftStore.save(state); render(); runAssignedDeviceLookup();
    }
    if (action === "bp-request-device") {
      state.enrollmentStatus = "COMPLETED";
      state.bpDevicePath = "needed";
      state.deviceSource = state.deviceSource === "PATIENT_OWNED" ? "PATIENT_OWNED" : "UNKNOWN";
      state.deviceVerificationStatus = "PENDING_DEVICE";
      state.bpBaselineStatus = "DEVICE_VERIFICATION";
      state.deviceFulfillmentStatus = "NOT_REQUESTED";
      state.bpDeviceFulfillmentStatus = "NOT_STARTED";
      state.baselineStatus = "IN_PROGRESS";
      state.baselineResumeScreen = "ACCESS_BP_DEVICE_INFO";
      state.baselineReminderStatus = "NOT_SCHEDULED";
      audit(state, "bp_device_information_started", "success", { reason: "INCOMPATIBLE_DEVICE" });
      state.screen = "ACCESS_BP_DEVICE_INFO"; draftStore.save(state); render();
    }
    if (action === "bp-device-mismatch-owned") {
      state.bpDevicePath = "needed";
      state.deviceSource = "PATIENT_OWNED";
      state.deviceVerificationStatus = "PENDING_DEVICE";
      state.deviceFulfillmentStatus = "NOT_REQUESTED";
      state.bpDeviceFulfillmentStatus = "NOT_STARTED";
      state.baselineResumeScreen = "ACCESS_BP_DEVICE_INFO";
      audit(state, "bp_device_mismatch_resolution_selected", "success", { resolution: "PATIENT_OWNED_FULFILLMENT", assignedDeviceId: state.assignedDeviceId });
      state.screen = "ACCESS_BP_DEVICE_INFO"; draftStore.save(state); render();
    }
    if (action === "bp-device-verification-help") {
      state.bpDeviceVerificationStatus = "NEEDS_REVIEW";
      state.baselineReminderStatus = "CARE_TEAM_ASSISTANCE";
      if (state.deviceVerificationStatus !== "SOURCE_MISMATCH") state.deviceVerificationStatus = "NEEDS_REVIEW";
      if (!(state.careTeamTasks || []).some(task => task.type === "BP_DEVICE_VERIFICATION_HELP" && task.status === "OPEN")) state.careTeamTasks.push({ id: `bp_device_verification_help_${Date.now().toString(36)}`, type: "BP_DEVICE_VERIFICATION_HELP", reason: state.firstTransmissionVerified === false ? "SOURCE_MISMATCH" : "DEVICE_CONFIRMATION", status: "OPEN", createdAt: new Date().toISOString() });
      audit(state, "bp_device_verification_help_requested", "success", { deviceVerificationStatus: state.deviceVerificationStatus, assignedDeviceId: state.assignedDeviceId });
      draftStore.save(state); showHelp();
    }
    if (action === "bp-defer-health-check") {
      if (el.disabled || el.dataset.pending === "true") return;
      el.dataset.pending = "true";
      el.disabled = true;
      const previousState = state;
      const now = new Date().toISOString();
      // Build the next state separately so a storage failure can restore the exact screen and
      // enrollment data the patient had before the tap. GETTING_STARTED is the existing source of
      // truth for optional care setup; DEFERRED keeps it resumable without calling it complete.
      state = { ...state, flowProgress: { ...(state.flowProgress || {}), GETTING_STARTED: { ...gettingStartedProgress() } }, onboarding: { ...(state.onboarding || {}) }, audit: [...(state.audit || [])], error: "" };
      try {
        state.enrollmentConfirmed = true;
        state.enrollmentStatus = "COMPLETED";
        state.enrollmentCompletedAt ||= state.consentTimestamp || now;
        state.baselineStatus = "IN_PROGRESS";
        state.bpBaselineStatus = "PENDING_DEVICE";
        state.baselineDeferredAt = now;
        state.baselineResumeScreen = "ONBOARDING";
        state.baselineReminderStatus = "PENDING_DEVICE";
        state.onboarding.savedAt ||= now;
        setGettingStartedProgress(FLOW_STATUS.DEFERRED, { deferredAt: now, resumeRoute: "ONBOARDING" });
        audit(state, "care_setup_deferred", "success", { reason: "PENDING_DEVICE", fulfillmentId: state.deviceFulfillmentId, resumeRoute: "ONBOARDING" });
        state.screen = "MY_CARE";
        draftStore.save(state);
        render();
      } catch {
        state = previousState;
        state.error = L("We couldn’t save this change. Try again.", "No pudimos guardar este cambio. Inténtalo de nuevo.", "Nou pa t ka anrejistre chanjman sa a. Eseye ankò.");
        render();
      }
      return;
    }
    if (action === "bp-continue-with-help") {
      state.enrollmentStatus = "COMPLETED";
      state.bpBaselineStatus = "DEVICE_VERIFICATION";
      state.baselineStatus = "IN_PROGRESS";
      state.baselineResumeScreen = "ACCESS_BP_DEVICE_VERIFICATION";
      state.baselineReminderStatus = "CARE_TEAM_ASSISTANCE";
      audit(state, "baseline_continued_with_bp_pending", "success", { remainingItem: "BLOOD_PRESSURE", reason: "DEVICE_IDENTIFICATION_HELP" });
      state.screen = "ONBOARDING_COMPLETE"; draftStore.save(state); render();
    }
    if (action === "resend-otp") {
      if (Date.now() < state.representativeOtpResendAvailableAt || el.disabled) return;
      el.disabled = true;
      const sent = await service.sendRepresentativeOtp(state.representativePhone);
      if (sent.sent) {
        state.representativeOtpDeliveryId = sent.deliveryId;
        state.representativeOtpResendAvailableAt = Date.now() + (sent.retryAfterSeconds || 30) * 1000;
        state.error = "";
        audit(state, "representative_phone_otp_resent", "success", { maskedPhone: maskedPhone(state.representativePhone), method: "SMS_OTP" });
      } else state.error = L("Please wait before requesting another code.", "Espere antes de solicitar otro código.", "Tanpri tann anvan ou mande yon lòt kòd.");
      draftStore.save(state); render();
    }
    // The logo is the header's home button, and home means something different once the patient is
    // in. Before enrolling it is the invitation; after enrolling, sending them back to an invitation
    // to join is how an enrolled patient ended up being asked who was completing their enrollment.
    if (action === "restart") {
      state.screen = state.enrollmentStatus === "COMPLETED" ? "MY_CARE" : "INVITATION";
      render();
    }
    if (action === "secondary") {
      if (state.screen === "ONBOARDING") {
        state.enrollmentStatus = "COMPLETED";
        state.baselineDeferredAt = new Date().toISOString();
        state.baselineResumeScreen = "ONBOARDING";
        state.baselineReminderStatus = "PENDING";
        state.onboarding = { ...state.onboarding, savedAt: new Date().toISOString() };
        setGettingStartedProgress(FLOW_STATUS.DEFERRED, { deferredAt: state.baselineDeferredAt, resumeRoute: "ONBOARDING" });
        audit(state, "care_setup_deferred", "success", { healthInformationReviewStatus: state.healthInformationReviewStatus, medicationsReviewStatus: state.medicationsReviewStatus, carePreferencesStatus: state.carePreferencesStatus, goalsStatus: state.goalsStatus });
        state.screen = "ONBOARDING_COMPLETE";
        draftStore.save(state); render();
      }
      else showHelp();
    }
    if (action === "finish") {
      // My Care is the persistent home after setup; do not erase longitudinal goals.
      state.screen = "MY_CARE";
      draftStore.save(state);
      render();
      return;
    }
    if (action === "dev") { state.devOpen = !state.devOpen; render(); }
    // The console's reset is the same reset the patient's "/new" performs. It used to drop the
    // draft alone, which left EMMI still remembering the cleared patient and their Care Circle
    // still on file — a demo that looked reset and was not.
    if (action === "clear") { resetEnrollmentSession({ draftStore, growthStore, clearConversation: clearEmmiConversation, clearAuditLog: clearEmmiAuditLog, clearAssistantContinuity: clearEmmiEnrollmentContinuity }); location.reload(); }
  }));
  const goalDiscoveryForm = document.querySelector("#care-goals-form");
  goalDiscoveryForm?.addEventListener("change", event => {
    if (event.target.name !== "careGoal") return;
    const data = new FormData(goalDiscoveryForm);
    const nextSelection = [...data.getAll("careGoal")];
    state.careGoalsNote = String(data.get("careGoalsNote") || state.careGoalsNote || "").slice(0,300);
    const otherChanged = nextSelection.includes("other") !== state.careGoals.includes("other");
    state.careGoals = nextSelection;
    if (otherChanged) render();
    else {
      const button = document.querySelector('[data-action="goals-discovery-continue"]');
      if (button) { button.disabled = !nextSelection.length; button.childNodes[0].textContent = `${nextSelection.length > 1 ? L("Choose my priorities", "Elegir mis prioridades", "Chwazi priyorite mwen") : L("Continue", "Continuar", "Kontinye")} `; }
    }
  });
  bindActions(document);
  const careTeamMemberForm = document.querySelector("#care-team-member-form");
  const readCareTeamMemberDraft = () => {
    if (!careTeamMemberForm) return state.careTeamMemberDraft;
    const data = new FormData(careTeamMemberForm);
    return {
      displayName: String(data.get("careTeamDisplayName") || ""),
      role: String(data.get("careTeamRole") || ""),
      specialty: String(data.get("careTeamSpecialty") || ""),
      practiceName: String(data.get("careTeamPracticeName") || "")
    };
  };
  const updateCareTeamMemberCta = () => {
    if (!careTeamMemberForm) return;
    const draft = readCareTeamMemberDraft();
    state.careTeamMemberDraft = draft;
    const button = careTeamMemberForm.querySelector('[data-action="save-care-team-member"]');
    if (button) button.disabled = !(draft.displayName.trim() && draft.role && (draft.role !== "SPECIALIST" || draft.specialty.trim()));
  };
  careTeamMemberForm?.addEventListener("input", updateCareTeamMemberCta);
  careTeamMemberForm?.addEventListener("change", event => {
    state.careTeamMemberDraft = readCareTeamMemberDraft();
    if (event.target.name === "careTeamRole") render();
    else updateCareTeamMemberCta();
  });
  updateCareTeamMemberCta();
  document.querySelector("#scenario-select")?.addEventListener("change", e => { location.search = `?scenario=${encodeURIComponent(e.target.value)}`; });
  document.querySelector("#screen-select")?.addEventListener("change", e => { state.screen = e.target.value; state.identityVerified = true; if (state.screen === "ACCESS_ELIGIBILITY_RESULT") state.accessOutcome = state.offer.fixture.accessOutcome || "eligible"; render(); });
  const dobInput = document.querySelector(".date-text");
  const zipInput = document.querySelector(".zip-input");
  const datePicker = document.querySelector(".date-picker-native");
  dobInput?.addEventListener("input", event => {
    event.target.value = typedDate(event.target.value);
    if (/^\d{2} \/ \d{2} \/ \d{4}$/.test(event.target.value) && datePicker) {
      const [month, day, year] = event.target.value.split(" / ");
      datePicker.value = `${year}-${month}-${day}`;
    }
  });
  zipInput?.addEventListener("input", event => { event.target.value = event.target.value.replace(/\D/g, "").slice(0, 5); });
  datePicker?.addEventListener("change", event => {
    if (dobInput && event.target.value) dobInput.value = displayDate(event.target.value);
  });
  const bpDeviceInfoForm = document.querySelector("#bp-device-info-form");
  const bpDeviceInfoCta = bpDeviceInfoForm?.querySelector('[data-action="next"]');
  const updateBpDeviceInfoCta = () => {
    if (!bpDeviceInfoForm || !bpDeviceInfoCta) return;
    const data = new FormData(bpDeviceInfoForm);
    // A cuff size is the one answer this screen asks for, so it is the one thing the CTA waits on.
    bpDeviceInfoCta.disabled = !(data.get("choice") || state.selectedCuffOption);
  };
  bpDeviceInfoForm?.addEventListener("input", updateBpDeviceInfoCta);
  bpDeviceInfoForm?.addEventListener("change", event => {
    if (event.target.name === "choice") {
      state.selectedCuffOption = event.target.value;
      // Every radio here is a cuff from the device record, so the only thing a change means is that
      // the patient picked a size. The "I'm not sure" card that used to sit among them is gone; the
      // service still guards CARE_TEAM_ASSISTANCE for drafts saved before it was removed.
      state.cuffSelectionMethod = "PATIENT_SELECTED";
      state.cuffSelectionStatus = "";
      state.armCircumferenceValue = "";
      state.error = "";
      draftStore.save(state);
      render();
      return;
    }
    updateBpDeviceInfoCta();
  });
  const bpShippingForm = document.querySelector("#bp-shipping-form");
  bpShippingForm?.querySelectorAll('input[name="choice"]').forEach(input => input.addEventListener("change", event => {
    state.shippingAddressMode = event.target.value;
    state.error = "";
    render();
  }));
  const assignedDeviceConfirmationForm = document.querySelector("#assigned-device-confirmation-form");
  const assignedDeviceConfirmationCta = assignedDeviceConfirmationForm?.closest(".screen")?.querySelector('[data-action="next"]');
  assignedDeviceConfirmationForm?.addEventListener("change", event => {
    state.patientDeviceConfirmationChoice = event.target.value;
    state.error = "";
    if (assignedDeviceConfirmationCta) assignedDeviceConfirmationCta.disabled = false;
  });
  const accessAcknowledgement = document.querySelector('[name="accessNotice"]');
  const accessEligibilityCta = document.querySelector('.access-notice-screen [data-action="next"]');
  accessAcknowledgement?.addEventListener("change", event => { if (accessEligibilityCta) accessEligibilityCta.disabled = !event.target.checked; });
  const disclosureAcknowledgement = document.querySelector('[name="acknowledge"]');
  const disclosureCta = document.querySelector('.important-information-screen [data-action="next"]');
  disclosureAcknowledgement?.addEventListener("change", event => { if (disclosureCta) disclosureCta.disabled = !event.target.checked; });
  const representativeForm = document.querySelector("#representative-form");
  const representativeCta = document.querySelector('.representative-details-screen [data-action="next"]');
  const updateRepresentativeCta = () => {
    if (!representativeForm || !representativeCta) return;
    const data = new FormData(representativeForm);
    representativeCta.disabled = !(data.get("representativeFullName")?.toString().trim() && data.get("representativeRelationship") && data.get("representativeAuthorityType") && phoneDigits(data.get("representativePhone")).length === 10);
  };
  representativeForm?.addEventListener("input", updateRepresentativeCta);
  representativeForm?.addEventListener("change", updateRepresentativeCta);
  const representativePhone = document.querySelector("#representative-phone");
  representativePhone?.addEventListener("input", event => { event.target.value = formatPhone(event.target.value); updateRepresentativeCta(); });
  const representativeOtp = document.querySelector("#representative-otp");
  representativeOtp?.addEventListener("input", event => { event.target.value = phoneDigits(event.target.value).slice(0, 6); });
  const careCirclePhone = document.querySelector('[name="supportPersonPhone"]');
  const careCircleForm = document.querySelector("#care-circle-invite-form");
  const careCircleContactFile = document.querySelector("#care-circle-contact-file");
  const careCircleCta = document.querySelector('[data-action="send-care-circle-invite"]');
  const updateCareCircleCta = () => {
    if (!careCircleForm || !careCircleCta) return;
    const data = Object.fromEntries(new FormData(careCircleForm));
    Object.assign(state, { supportPersonName: String(data.supportPersonName || ""), supportPersonPhone: String(data.supportPersonPhone || ""), supportPersonRelationship: String(data.supportPersonRelationship || ""), supportPersonRelationshipOther: String(data.supportPersonRelationshipOther || "") });
    careCircleCta.disabled = !(state.supportPersonName.trim() && phoneDigits(state.supportPersonPhone).length === 10 && state.supportPersonRelationship && (state.supportPersonRelationship !== "other" || state.supportPersonRelationshipOther.trim()));
  };
  careCircleForm?.addEventListener("input", event => { if (!state.careCircleManualEntryTracked && event.isTrusted) { state.careCircleManualEntryTracked = true; state.careCircleContactSource = "MANUAL"; audit(state, "manual_entry_used", "success", { context: state.careCircleContext }); } updateCareCircleCta(); });
  careCircleForm?.addEventListener("change", event => { updateCareCircleCta(); if (event.target.name === "supportPersonRelationship") render(); });
  careCirclePhone?.addEventListener("input", event => { event.target.value = formatPhone(event.target.value); updateCareCircleCta(); });
  careCircleContactFile?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error("ContactCardTooLarge");
      const contact = parseContactCard(await file.text());
      const rawNumbers = applyCareCircleContact(contact, "VCARD_IMPORT");
      if (!state.supportPersonName && !rawNumbers.length) state.careCircleNotice = L("We couldn’t read that contact card. You can choose another or enter the information below.", "No pudimos leer esa tarjeta de contacto. Puede elegir otra o ingresar la información abajo.", "Nou pa t ka li kat kontak sa a. Ou ka chwazi yon lòt oswa antre enfòmasyon an anba a.");
      audit(state, "care_circle_contact_imported", rawNumbers.length ? "success" : "fallback", { phoneCount: rawNumbers.length, hasName: Boolean(state.supportPersonName) });
    } catch (error) {
      state.careCircleNotice = L("We couldn’t read that contact card. You can choose another or enter the information below.", "No pudimos leer esa tarjeta de contacto. Puede elegir otra o ingresar la información abajo.", "Nou pa t ka li kat kontak sa a. Ou ka chwazi yon lòt oswa antre enfòmasyon an anba a.");
      audit(state, "care_circle_contact_import_failed", "fallback", { reason: error?.message === "ContactCardTooLarge" ? "too_large" : "invalid" });
    }
    render();
  });
  document.querySelectorAll('[name="careCircleContactPhone"]').forEach(input => input.addEventListener("change", event => { state.supportPersonPhone = formatPhone(event.target.value); state.careCircleContactSource = "CONTACT_PICKER"; render(); }));
  const authorityForm = document.querySelector("#representative-authority-form");
  const authorityCta = authorityForm?.closest(".screen")?.querySelector('[data-action="next"]');
  authorityForm?.addEventListener("change", () => { if (authorityCta) authorityCta.disabled = !authorityForm.querySelector('[name="representativeAuthorityAttested"]')?.checked; });
  const resendButton = document.querySelector('[data-action="resend-otp"][disabled]');
  if (resendButton) {
    const delay = Math.max(0, state.representativeOtpResendAvailableAt - Date.now()) + 25;
    setTimeout(() => { if (state.screen === "REPRESENTATIVE_MOBILE_VERIFICATION") render(); }, delay);
  }
  const consentForm = document.querySelector("#consent-form");
  const consentCta = consentForm?.closest(".screen")?.querySelector('[data-action="next"]');
  const updateConsentCta = () => {
    if (!consentForm || !consentCta) return;
    consentCta.disabled = ![...consentForm.querySelectorAll('input[type="checkbox"]')].every(input => input.checked);
  };
  consentForm?.addEventListener("change", updateConsentCta);
  const accessDisclosure = document.querySelector(".access-consent-terms");
  accessDisclosure?.addEventListener("toggle", () => {
    if (!accessDisclosure.open) return;
    const viewedAt = new Date().toISOString();
    state.accessDisclosureView = {
      disclosureVersion: state.offer.disclosures.version,
      viewedAt,
      locale: state.language,
      sessionId: state.sessionId,
      enrollmentId: state.enrollmentId || null
    };
    audit(state, "access_full_disclosure_viewed", "success", state.accessDisclosureView);
    draftStore.save(state);
  });
  const choiceForm = state.screen === "DECISION_MAKER" ? document.querySelector("#choice-form") : null;
  choiceForm?.addEventListener("change", event => {
    state.completionRole = event.target.value || state.completionRole;
    const optionalSupport = document.querySelector("[data-optional-support]");
    if (optionalSupport) optionalSupport.hidden = !completionRoleAcceptsCareCircle();
  });
  observeEmmiAnchor();
  observeEmmiShellBounds();
  syncEmmiPresentation();
  bindEmmiDrag();
}

function publicBrandHeader() {
  return `<header class="public-brand-header"><span class="brand"><b>ITERA.</b>HEALTH</span><button type="button" class="language" data-public-action="language">${icon("language")} ${languageCode()}</button></header>`;
}

function renderPublicAccessLanding() {
  const shareId = new URLSearchParams(location.search).get("shareId") || "";
  if (shareId) growthStore.updateAccessShare(shareId, { clicked: true, landingStarted: true });
  document.documentElement.lang = htmlLanguage(state.language);
  app.innerHTML = `<main class="public-growth-page">${publicBrandHeader()}<section class="public-growth-content">${art("people")}${titleBlock(L("Learn about Medicare’s ACCESS Model", "Conozca el Modelo ACCESS de Medicare", "Aprann sou Modèl ACCESS Medicare"), L("ITERA HEALTH is a Medicare ACCESS Participant providing extra support between doctor visits.", "ITERA HEALTH es un participante de Medicare ACCESS que brinda apoyo adicional entre visitas médicas.", "ITERA HEALTH se yon patisipan Medicare ACCESS ki bay plis sipò ant vizit kay doktè."))}<section class="public-access-facts">${rows([["home", L("Support between doctor visits", "Apoyo entre visitas médicas", "Sipò ant vizit kay doktè"), L("Get help with questions and next steps.", "Reciba ayuda con preguntas y próximos pasos.", "Jwenn èd ak kesyon ak pwochen etap yo.")], ["shield", L("Participation is voluntary", "La participación es voluntaria", "Patisipasyon an volontè"), L("You choose whether to enroll.", "Usted decide si desea inscribirse.", "Se ou ki chwazi si w ap enskri.")], ["medicare", L("Original Medicare is required", "Se requiere Medicare Original", "Medicare Orijinal obligatwa"), L("Medicare must check whether ACCESS is available to you.", "Medicare debe verificar si ACCESS está disponible para usted.", "Medicare dwe verifye si ACCESS disponib pou ou.")]])}</section><p class="public-growth-disclaimer">${L("Learning more does not mean you are eligible or enrolled.", "Obtener más información no significa que sea elegible ni que esté inscrito.", "Aprann plis pa vle di ou kalifye oswa ou enskri.")}</p><button type="button" class="button primary" data-public-action="start-access">${L("See if ACCESS may be available to you", "Vea si ACCESS podría estar disponible para usted", "Gade si ACCESS ka disponib pou ou")} ${icon("arrowRight")}</button></section></main>`;
  app.querySelector('[data-public-action="language"]')?.addEventListener("click", () => { setLanguage(state.language === "en" ? "es" : state.language === "es" ? "ht" : "en"); renderPublicAccessLanding(); });
  app.querySelector('[data-public-action="start-access"]')?.addEventListener("click", () => {
    if (shareId) growthStore.updateAccessShare(shareId, { eligibilityStarted: true });
    location.href = `/?prototype=1&source=patient-share${shareId ? `&shareId=${encodeURIComponent(shareId)}` : ""}`;
  });
}

function renderSupportAcceptance() {
  const token = location.pathname.startsWith("/care-circle/invite/") ? decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) || "") : new URLSearchParams(location.search).get("token") || "";
  const invite = growthStore.findSupportInvite(token);
  if (invite?.status === "PENDING" && !invite.openedAt) growthStore.updateSupportInvite(invite.inviteId, { openedAt: new Date().toISOString() });
  const activeInvite = growthStore.findSupportInvite(token);
  const available = activeInvite && !["EXPIRED", "CANCELED"].includes(activeInvite.status) && new Date(activeInvite.expiresAt).getTime() >= Date.now();
  // "Accepted" is no longer the same as "in". Membership waits on the code sent to the phone the
  // patient named, so this screen has three states, not two: the invitation, the code, and done.
  const membership = activeInvite?.membership || null;
  const awaitingCode = activeInvite?.status === "ACCEPTED" && membership?.status !== "ACTIVE";
  const accepted = membership?.status === "ACTIVE";
  const patient = activeInvite?.patientFirstName || L("The patient", "El paciente", "Pasyan an");
  // The invitee is a stranger to this product and often an older adult reading on a phone. Four
  // questions, in order: who invited me, what am I being asked to do, what am I not allowed to do,
  // and how do I say yes. Anything that does not answer one of those is noise on this screen.
  //
  // Only the patient's first name is used. The invite record holds nothing else by design — this
  // page is reachable by anyone holding the link, and a surname on it would be a disclosure the
  // patient never made.
  const boundaries = available ? `<section class="care-circle-boundaries">
      <h2>${L("What Care Circle support means", "Qué significa el apoyo del Círculo de cuidado", "Sa sipò Sèk swen vle di")}</h2>
      <ul>
        <li>${icon("check")}<span>${L("You may help with reminders and basic care tasks the patient chooses.", "Puede ayudar con recordatorios y tareas básicas que el paciente elija.", "Ou ka ede ak rapèl ak travay swen debaz pasyan an chwazi.")}</span></li>
        <li>${icon("shield")}<span>${L("You cannot consent, sign, or make healthcare decisions for the patient.", "No puede dar consentimiento, firmar ni tomar decisiones médicas por el paciente.", "Ou pa ka bay konsantman, siyen, oswa pran desizyon swen sante pou pasyan an.")}</span></li>
      </ul>
      <p class="care-circle-boundaries-note">${L("This does not make you a Personal Representative.", "Esto no le convierte en Representante personal.", "Sa pa fè w yon Reprezantan pèsonèl.")}</p>
    </section>` : "";
  const heading = accepted
    ? titleBlock(L("You’re ready to help", "Ya puede ayudar", "Ou pare pou ede"), L("You can now provide basic support through ITERA HEALTH.", "Ahora puede brindar apoyo básico mediante ITERA HEALTH.", "Kounye a ou ka bay sipò debaz atravè ITERA HEALTH."))
    : titleBlock(
        L(`You’ve been invited to join ${patient}’s Care Circle`, `Le han invitado al Círculo de cuidado de ${patient}`, `Yo envite w antre nan Sèk swen ${patient}`),
        L(`${patient} invited you to provide basic support during their care experience.`, `${patient} le invitó a brindar apoyo básico durante su experiencia de cuidado.`, `${patient} envite w bay sipò debaz pandan eksperyans swen li.`)
      );
  app.innerHTML = `<main class="public-growth-page">${publicBrandHeader()}<section class="public-growth-content">${art(available ? "people" : "lock", accepted)}${available ? heading : titleBlock(L("This invitation is no longer available", "Esta invitación ya no está disponible", "Envitasyon sa a pa disponib ankò"), L("Ask the patient to send a new secure invitation.", "Pida al paciente que envíe una nueva invitación segura.", "Mande pasyan an voye yon nouvo envitasyon an sekirite."))}${boundaries}${available && awaitingCode ? `<section class="care-circle-verify"><h2>${L("Confirm your phone number", "Confirme su número de teléfono", "Konfime nimewo telefòn ou")}</h2><p>${L("We sent a 6-digit code to the number the patient invited. Enter it to finish joining.", "Enviamos un código de 6 dígitos al número que el paciente invitó. Ingréselo para terminar.", "Nou voye yon kòd 6 chif nan nimewo pasyan an te envite a. Antre l pou fini.")}</p><label class="field" for="care-circle-otp">${L("Verification code", "Código de verificación", "Kòd verifikasyon")}<input id="care-circle-otp" name="careCircleOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value=""></label><p class="form-error" role="alert">${escapeHtml(state.careCircleVerifyError || "")}</p><button type="button" class="button primary" data-public-action="verify-support">${L("Verify and join", "Verificar y unirme", "Verifye epi antre")} ${icon("arrowRight")}</button><button type="button" class="text-button" data-public-action="resend-support-otp">${L("Send the code again", "Enviar el código otra vez", "Voye kòd la ankò")}</button></section>` : ""}${available && !awaitingCode ? (accepted ? `<p class="growth-success-note">${icon("check")} ${L("Care Circle invitation accepted", "Invitación al Círculo de cuidado aceptada", "Envitasyon Sèk swen aksepte")}</p>` : `<div class="care-circle-accept-actions"><button type="button" class="button primary" data-public-action="accept-support">${L("Accept invitation", "Aceptar invitación", "Aksepte envitasyon")} ${icon("arrowRight")}</button><button type="button" class="button secondary" data-public-action="decline-support">${L("Decline", "Rechazar", "Refize")}</button></div>`) : ""}</section></main>`;
  app.querySelector('[data-public-action="language"]')?.addEventListener("click", () => { setLanguage(state.language === "en" ? "es" : state.language === "es" ? "ht" : "en"); renderSupportAcceptance(); });
  app.querySelector('[data-public-action="accept-support"]')?.addEventListener("click", () => { state.careCircleVerifyError = ""; growthStore.acceptSupportInvite(token); renderSupportAcceptance(); });
  app.querySelector('[data-public-action="decline-support"]')?.addEventListener("click", () => { growthStore.declineSupportInvite(token); renderSupportAcceptance(); });
  app.querySelector('[data-public-action="resend-support-otp"]')?.addEventListener("click", () => { growthStore.resendSupportOtp(token); state.careCircleVerifyError = ""; renderSupportAcceptance(); });
  app.querySelector('[data-public-action="verify-support"]')?.addEventListener("click", () => {
    const result = growthStore.verifySupportOtp(token, app.querySelector("#care-circle-otp")?.value);
    // Each failure says which one it was: a wrong code, an expired one and a locked one need
    // different things from the person holding the phone.
    state.careCircleVerifyError = result.verified ? "" : ({
      mismatch: L("That code did not match. Check the message and try again.", "Ese código no coincide. Revise el mensaje e inténtelo de nuevo.", "Kòd sa a pa koresponn. Gade mesaj la epi eseye ankò."),
      expired: L("That code has expired. Send a new one.", "Ese código expiró. Envíe uno nuevo.", "Kòd sa a ekspire. Voye yon nouvo."),
      locked: L("Too many attempts. Send a new code to continue.", "Demasiados intentos. Envíe un código nuevo para continuar.", "Twòp tantativ. Voye yon nouvo kòd pou kontinye."),
      not_found: L("This invitation is no longer available.", "Esta invitación ya no está disponible.", "Envitasyon sa a pa disponib ankò.")
    })[result.reason] || L("We could not verify that code.", "No pudimos verificar ese código.", "Nou pa t ka verifye kòd sa a.");
    renderSupportAcceptance();
  });
}

async function boot() {
  const savedLanguage = (() => { try { return localStorage.getItem("itera.enrollment.language.v1"); } catch { return null; } })();
  if (["en", "es", "ht"].includes(savedLanguage)) state.language = savedLanguage;
  Object.assign(state, growthStore.readPromptPreferences());
  if (location.pathname === "/access/learn") { renderPublicAccessLanding(); return; }
  if (location.pathname === "/support/accept" || location.pathname.startsWith("/care-circle/invite/")) { renderSupportAcceptance(); return; }
  try {
    state.offer = await service.getOffer();
    // The invitation has no Launch step, so the device context the console used to write on Launch
    // is written here instead — before the first render, and before a saved draft is layered over
    // it, so a patient who already answered for their monitor keeps that answer.
    if (canonicalInvitation) applyScenarioDeviceContext();
    const saved = patientShareSource ? null : draftStore.load();
    if (saved?.scenarioId === scenarioId && (saved.identityVerified || saved.completionRole === "personalRepresentative")) {
      state = { ...state, ...saved, offer: state.offer, audit: saved.audit || [] };
      if (typeof savedEmmiPreferences.emmiVoiceGuidance === "boolean") state.emmiVoiceGuidance = savedEmmiPreferences.emmiVoiceGuidance;
      if (savedEmmiPreferences.emmiWelcomeAcknowledged) state.emmiWelcomeAcknowledged = true;
      state.completionRole = saved.completionRole || (state.role === "representative" ? "personalRepresentative" : state.role === "helper" ? "helper" : "patient");
      if (state.enrollmentConfirmed && !saved.enrollmentStatus) state.enrollmentStatus = "COMPLETED";
      if (!saved.baselineStatus) state.baselineStatus = "NOT_STARTED";
      if (!saved.bpBaselineStatus) state.bpBaselineStatus = "NOT_STARTED";
      if (!Array.isArray(saved.bpReadings)) state.bpReadings = [];
      if (!Array.isArray(saved.bpReadingReceipts)) state.bpReadingReceipts = [];
      if (!Number.isInteger(saved.bpBaselineRequiredReadings)) state.bpBaselineRequiredReadings = 3;
      if (!Number.isInteger(saved.bpBaselineReadingCount)) state.bpBaselineReadingCount = saved.bpReadingCount || state.bpReadingReceipts.length;
      if (!Number.isInteger(saved.bpBaselineRemainingReadings)) state.bpBaselineRemainingReadings = Math.max(0, state.bpBaselineRequiredReadings - state.bpBaselineReadingCount);
      if (!Array.isArray(saved.careTeamTasks)) state.careTeamTasks = [];
      if (saved.healthInformationReviewStatus === "COMPLETED") {
        state.healthInformationReviewStatus = saved.healthInformationReviewResult === "correct" ? "CONFIRMED" : saved.healthInformationReviewResult === "changed" ? "CHANGES_REPORTED" : saved.healthInformationReviewResult === "help" ? "NEEDS_HELP" : "UNREVIEWED";
        state.healthInformationStepStatus = state.healthInformationReviewStatus === "UNREVIEWED" ? "NOT_STARTED" : "COMPLETED";
      }
      if (!["UNREVIEWED", "CONFIRMED", "CHANGES_REPORTED", "NEEDS_HELP"].includes(state.healthInformationReviewStatus)) state.healthInformationReviewStatus = "UNREVIEWED";
      if (!["NOT_STARTED", "COMPLETED"].includes(state.healthInformationStepStatus)) state.healthInformationStepStatus = state.healthInformationReviewStatus === "UNREVIEWED" ? "NOT_STARTED" : "COMPLETED";
      if (!Array.isArray(saved.patientReportedHealthUpdates)) state.patientReportedHealthUpdates = [];
      if (!saved.healthInformationUpdateDraft || typeof saved.healthInformationUpdateDraft !== "object") state.healthInformationUpdateDraft = { id: "", updateType: "", relatedConditionIds: [], patientReportedText: "" };
      if (!Array.isArray(state.healthInformationUpdateDraft.relatedConditionIds)) state.healthInformationUpdateDraft.relatedConditionIds = [];
      if (!state.healthInformationFlowStep) state.healthInformationFlowStep = state.healthInformationReviewStatus === "CHANGES_REPORTED" && state.patientReportedHealthUpdates.length ? "CHANGE_SAVED" : state.healthInformationReviewStatus === "NEEDS_HELP" ? "HELP_CONFIRMED" : "CHOICE";
      if (!Array.isArray(saved.careMedications)) state.careMedications = state.careMedications || [];
      // A draft written before medications carried supply data restores without it; the engine
      // treats a medication with no fill information as one it cannot estimate, which is correct.
      if (!Array.isArray(saved.medicationSupplySignals)) state.medicationSupplySignals = [];
      if (!Array.isArray(saved.medicationRefills)) state.medicationRefills = [];
      // A draft written before appointments existed restores without them. appointmentFlow is
      // never persisted, so a patient who left mid-scheduling comes back to their appointments
      // rather than to a half-answered question they did not choose to resume.
      if (!Array.isArray(saved.appointments)) state.appointments = [];
      if (!saved.appointmentDraft || typeof saved.appointmentDraft !== "object") state.appointmentDraft = null;
      state.appointmentFlow = null;
      if (typeof saved.activeAppointmentId !== "string") state.activeAppointmentId = "";
      // A draft written before barrier resolution existed restores without any. activeResolutionId
      // is deliberately not restored: the resolutions are, so the patient can walk back into one
      // from their appointment, but nobody is dropped into a half-finished booking on open.
      if (!Array.isArray(saved.barrierResolutions)) state.barrierResolutions = [];
      if (!Array.isArray(saved.barrierActivity)) state.barrierActivity = [];
      if (!saved.barrierReadinessAck || typeof saved.barrierReadinessAck !== "object") state.barrierReadinessAck = {};
      state.activeResolutionId = "";
      state.barrierError = "";
      if (state.screen === "APPOINTMENT_SCHEDULING"
        && state.appointments.some(record => record.id === state.activeAppointmentId && record.status === APPOINTMENT_STATUS.CONFIRMED)) {
        state.screen = "APPOINTMENT_DETAIL";
      }
      state.refillFlow = { medicationId: "", step: "", answer: "" };
      if (!saved.medicationReviews || typeof saved.medicationReviews !== "object") state.medicationReviews = {};
      if (!Array.isArray(saved.additionalMedications)) state.additionalMedications = [];
      if (!["UNREVIEWED", "NONE", "ADDED", "UNSURE"].includes(saved.additionalMedicationsStatus)) state.additionalMedicationsStatus = "UNREVIEWED";
      if (!Array.isArray(saved.careGoals)) state.careGoals = [];
      if (!Array.isArray(saved.patientGoals)) {
        state.patientGoals = [];
        if (state.careGoals.length) syncPatientGoalsFromDiscovery(state.careGoals, "");
      }
      state.patientGoals = (state.patientGoals || []).map(goal => ({
        ...goal,
        status: goal.status || "ACTIVE",
        priority: goal.priority || "NONE",
        planStatus: goal.planStatus || "NOT_STARTED",
        planPersonalizationStatus: goal.planPersonalizationStatus || goal.planStatus || "NOT_STARTED",
        goalSource: goal.goalSource || (goal.goalType === "CUSTOM" ? "PATIENT" : "PATHWAY"),
        selectedBy: goal.selectedBy || "PATIENT",
        clinicalTargetId: goal.clinicalTargetId || null,
        patientCanEditClinicalTarget: false,
        careTeamReviewStatus: goal.careTeamReviewStatus || (goal.goalType === "CUSTOM" ? "PENDING" : "NOT_REQUIRED"),
        actions: Array.isArray(goal.actions) ? goal.actions.map(action => ({ ...action, verificationMethod: resolveGoalActionVerification(action), completionHistory: Array.isArray(action.completionHistory) ? action.completionHistory : [] })) : [],
        educationHistory: Array.isArray(goal.educationHistory) ? goal.educationHistory : [],
        progress: Array.isArray(goal.progress) ? goal.progress : [],
        // Barriers restore through the shared normalizer so a draft written before this model, or
        // by an older build, still renders with a category, a status and its intervention history.
        barriers: Array.isArray(goal.barriers) ? goal.barriers.map(normalizeBarrierRecord).filter(Boolean) : [],
        supportNeedsAssessment: goal.supportNeedsAssessment && typeof goal.supportNeedsAssessment === "object"
          ? accessSupportAssessment(goal)
          : null,
        reminderPreference: goal.reminderPreference || null,
        supportRequests: Array.isArray(goal.supportRequests) ? goal.supportRequests : [],
        reviews: Array.isArray(goal.reviews) ? goal.reviews : []
      }));
      if (state.offer?.pathway === "ACCESS") syncAccessGoalsStatus();
      state.goalFlowStep ||= "DISCOVERY";
      state.goalFlowOrigin ||= "ONBOARDING";
      state.goalPlanDraft = state.goalPlanDraft && typeof state.goalPlanDraft === "object" ? { actionIds: Array.isArray(state.goalPlanDraft.actionIds) ? state.goalPlanDraft.actionIds : [], customAction: state.goalPlanDraft.customAction || "", frequency: state.goalPlanDraft.frequency || "few-days", remindersEnabled: Boolean(state.goalPlanDraft.remindersEnabled), whyItMatters: state.goalPlanDraft.whyItMatters || "" } : { actionIds: [], customAction: "", frequency: "few-days", remindersEnabled: false, whyItMatters: "" };
      state.goalDetailView ||= "SUMMARY";
      if (!Array.isArray(saved.goalHistory)) state.goalHistory = [];
      if (!state.goalPrimaryId) state.goalPrimaryId = state.patientGoals.find(goal => goal.priority === "PRIMARY")?.id || state.patientGoals[0]?.id || "";
      if (!state.goalSecondaryId) state.goalSecondaryId = state.patientGoals.find(goal => goal.priority === "SECONDARY")?.id || "";
      state.preferredCareLanguage ||= state.language;
      state.preferredContactTime ||= "none";
      if (!saved.deviceVerificationStatus) state.deviceVerificationStatus = saved.bpDeviceVerificationStatus === "VERIFIED_COMPATIBLE" ? "ASSIGNED" : saved.bpDeviceVerificationStatus === "VERIFIED_INCOMPATIBLE" ? "UNSUPPORTED" : saved.bpDeviceVerificationStatus === "ASSISTANCE_REQUESTED" ? "NEEDS_REVIEW" : state.deviceVerificationStatus;
      if (state.deviceVerificationStatus === "CONNECTED") state.deviceVerificationStatus = state.patientDeviceConfirmed ? "PATIENT_CONFIRMED" : "ASSIGNED";
      if (!saved.deviceSource) state.deviceSource = saved.bpDevicePath === "owned" ? "UNKNOWN" : state.deviceSource;
      if (!Number.isInteger(saved.bpReadingCount)) state.bpReadingCount = state.bpReadingReceipts.length;
      if (!saved.bpMeasurementPhase) state.bpMeasurementPhase = "WAITING";
      if (!saved.flowProgress?.GETTING_STARTED) state.flowProgress = { GETTING_STARTED: emptyFlowProgress() };
      // Drafts from builds that exposed the health-information confirmation screen may still point
      // to it. Preserve every answer, but move that obsolete route to the first current setup task.
      if (state.screen === "CLINICAL_VERIFICATION") state.screen = "MEDICATIONS_REVIEW";
      if (state.baselineResumeScreen === "CLINICAL_VERIFICATION") state.baselineResumeScreen = "MEDICATIONS_REVIEW";
      if (state.flowProgress.GETTING_STARTED.resumeRoute === "CLINICAL_VERIFICATION") state.flowProgress.GETTING_STARTED.resumeRoute = "MEDICATIONS_REVIEW";
      if (state.baselineResumeScreen && state.baselineStatus !== "COMPLETED" && state.flowProgress.GETTING_STARTED.status === FLOW_STATUS.IN_PROGRESS && !["MY_CARE", "FLOW_DEFERRED"].includes(saved.screen)) state.screen = state.baselineResumeScreen;
      if (state.screen === "REPRESENTATIVE_MOBILE_VERIFICATION" && !state.phoneVerified) state.screen = "PERSONAL_REPRESENTATIVE_DETAILS";
    }
    else {
      state.screen = "INVITATION";
      // The offer carries the language the invitation was prepared in, which is a default. A
      // language the patient picked themselves is a later and stronger signal than that default,
      // so it outranks it — otherwise the language toggle cannot survive a reload.
      const chosenLanguage = (() => { try { return localStorage.getItem("itera.enrollment.language.v1"); } catch { return null; } })();
      const preferredLanguage = chosenLanguage || state.offer.selectedLanguage;
      if (["en", "es", "ht"].includes(preferredLanguage)) state.language = preferredLanguage;
      if (state.offer.fixture.representative) { state.role = "representative"; state.completionRole = "personalRepresentative"; }
    }
    // A Care Circle invitation belongs to an enrollment. The draft is deliberately not written
    // until identity is verified, so an invitation sent before that point leaves no enrollment
    // behind it — and the invite record, which lives in its own store, outlives the enrollment that
    // sent it. Every demo enrollment is the same fictional patient, so filtering by patient id
    // matches all of them: the next person to open the app was shown "Invitation sent — Angela Demo
    // can help you" for an invitation they never sent.
    //
    // With no draft to resume there is no enrollment for the invitation to belong to, so the stale
    // record is cleared rather than adopted. Started again means started again.
    const resumableEnrollment = Boolean(saved?.scenarioId === scenarioId && (saved.identityVerified || saved.completionRole === "personalRepresentative"));
    if (!patientShareSource && !resumableEnrollment) growthStore.clearEnrollmentData();
    const storedInvite = patientShareSource || !resumableEnrollment ? null : growthStore.allSupportInvites().filter(invite => invite.inviterPatientId === state.offer.patient.id).at(-1);
    if (storedInvite && !state.supportInviteId) Object.assign(state, { supportRole: "CARE_CIRCLE_MEMBER", careCircleStatus: storedInvite.careCircleStatus || (storedInvite.status === "ACCEPTED" ? "ACTIVE" : "INVITED"), supportPersonName: storedInvite.supportPerson.name, supportPersonPhone: formatPhone(storedInvite.supportPerson.phone), supportPersonRelationship: storedInvite.supportPerson.relationship, supportInviteId: storedInvite.inviteId, supportInviteToken: storedInvite.token, supportInviteStatus: storedInvite.status, supportInviteSentAt: storedInvite.sentAt, supportInviteAcceptedAt: storedInvite.acceptedAt || "", careCirclePermissions: storedInvite.careCirclePermissions || state.careCirclePermissions });
    // EMMI fixtures describe the assistant's test patients; they are not patient UI state. Using
    // one of those fixtures as a fallback here caused a clean Spanish enrollment to acquire Maria
    // Demo's "Angela Demo" invitation immediately after /new had correctly cleared storage. Care
    // Circle status now comes only from this enrollment's saved draft/invite store or an explicit
    // support-share flow — never from the assistant's language-selected fixture.
    state.accessShares = patientShareSource ? [] : growthStore.allShares();
    document.documentElement.lang = htmlLanguage(state.language); render();
    scheduleSimulatedAppointmentResponses();
    if (state.screen === "ACCESS_ELIGIBILITY_PROCESSING" && !state.eligibilityError) runEligibility();
    startAssignedDeviceLookupIfPending();
  } catch (error) { state.screen = error.message === "expired" ? "OFFER_EXPIRED" : "OFFER_INVALID"; render(); }
}

if (["/access/learn", "/support/accept"].includes(location.pathname) || location.pathname.startsWith("/care-circle/invite/")) boot();
else {
  // The first paint is either the QA console or the invitation opening. It is never a
  // configuration screen the patient then has to be moved off, so there is nothing to flash.
  render();
  if (!adminMode) boot();
}
