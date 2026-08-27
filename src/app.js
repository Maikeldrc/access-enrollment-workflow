import { BP_FULFILLMENT_DEVICE_MODELS, DEFAULT_PROTOTYPE_CONFIG, PROTOTYPE_OPTIONS, SCENARIOS, isProviderReferralSource, normalizePrototypeConfig, scenarioRequiresPhysician, scenarioUsesBloodPressureMonitoring } from "./config.js";
import { commonMessagesFor, htmlLanguage, localeCode, localize, localizeOfferText } from "./i18n.js";
import { AUTHORITY_VERIFICATION_METHODS, MockEnrollmentService, DraftStore, audit } from "./services.js";
import { journeyFor, nextScreen, previousScreen, progressFor } from "./machine.js";
import {
  Activity, ArrowLeft, ArrowRight, BadgeCheck, Bell, BookOpen, CalendarDays, ClipboardCheck, ChartNoAxesColumnIncreasing,
  Check, ChevronRight, CircleHelp, Clock3, ExternalLink, FileText, Globe2,
  HeartPulse, House, Info, LockKeyhole, Mic, MicOff, Package, Phone, Pill, ShieldCheck,
  Share2, SlidersHorizontal, Stethoscope, TabletSmartphone, Target, TrendingUp, UserPlus, UserRound, UsersRound, Utensils, Wifi,
  AudioLines, MessageCircle, Pause, Play, RotateCcw,
  Droplets, Footprints, Scale, Smile, Wind
} from "lucide";
import { EMMI_CONFIG, emmiPrototypeIsSafe } from "./emmi/config.js";
import { EmmiLiveClient } from "./emmi/liveClient.js";
import { EmmiAuditLog, EmmiToolOrchestrator, selectDemoPatientId } from "./emmi/tools.js";
import { emmiVoiceIsSupported, resolveEmmiLanguage } from "./emmi/messages.js";
import { buildHomeNarration, buildNarration, buildTransitionNarration } from "./emmi/narrative.js";
import { EmmiTransitionManager, semanticSpeechSegments } from "./emmi/transitionManager.js";
import { EmmiConversationManager } from "./emmi/conversationManager.js";
import { EmmiTextOrchestrator } from "./emmi/textOrchestrator.js";
import { emmiVoiceMetadata } from "./emmi/voiceIdentity.js";
import { getEmmiQuickQuestions } from "./emmi/quickQuestions.js";
import { EMMI_DEMO_PATIENTS } from "./mock/emmiFixtures.js";
import { IMPORTANT_INFORMATION_COPY, programDisclosureConfig } from "./programDisclosures.js";
import { enrollmentWelcomeFor } from "./enrollmentWelcome.js";
import { resolveNextBestAction } from "./nextBestAction.js";
import { FLOW_STATUS, emptyFlowProgress, resolveEnrollmentTransition } from "./flowTransitions.js";
import { CARE_CIRCLE_COPY, GROWTH_MOMENTS, SHARE_ACCESS_COPY, shareAccessEligibility } from "./growthMoments.js";
import { GrowthStore, growthPromptAvailable, maskPhone } from "./growth.js";
import { GOAL_CONFIG, LEGACY_GOAL_TYPES, createPatientGoal, goalActionIcon, goalCategoryOf, goalDisplayName, goalIsReadyToPersonalize, goalNextBestAction, goalProgressSummary, localGoalText, resolveGoalIcon, sortGoalsForPatient, suggestedActionsFor } from "./goals.js";
import { DEMO_BP_MONITORING_RULES, buildBloodPressureGoalRuntime, nextBestGoalEducation, resolveGoalActionVerification } from "./goalHealth.js";

const app = document.querySelector("#app");
const params = new URLSearchParams(location.search);
const prototypeMode = params.get("prototype") === "1";
const patientShareSource = params.get("source") === "patient-share";
const scenarioId = prototypeMode ? "prototype" : params.get("scenario") || "access-happy";
const DEMO_IDENTITY = { dob: "05/12/1954", dobIso: "1954-05-12", zip: "33176" };
const draftStore = new DraftStore();
const growthStore = new GrowthStore();
const EMMI_PREFERENCES_KEY = "itera.emmi.preferences.v1";
const savedEmmiPreferences = (() => {
  try { return JSON.parse(localStorage.getItem(EMMI_PREFERENCES_KEY) || "null") || {}; }
  catch { return {}; }
})();
let eligibilityRequest = null;
const savedPrototypeConfig = (() => { try { return JSON.parse(localStorage.getItem("itera.prototype.config.v1") || "null"); } catch { return null; } })();
let prototypeConfig = normalizePrototypeConfig(patientShareSource ? DEFAULT_PROTOTYPE_CONFIG : (savedPrototypeConfig || DEFAULT_PROTOTYPE_CONFIG));
let service = new MockEnrollmentService(scenarioId, prototypeMode ? prototypeConfig : null);
let conditionMenuOpen = false;
let state = {
  scenarioId, screen: params.has("scenario") || prototypeMode ? "OFFER_LOADING" : "PROTOTYPE_SETUP", offer: null, language: "en", role: "patient", completionRole: "patient",
  representativeFullName: "", representativeRelationship: "", representativeAuthorityType: "", representativePhone: "", representativeOtpDeliveryId: "", representativeOtpResendAvailableAt: 0,
  phoneVerified: false, phoneVerificationMethod: "", phoneVerifiedAt: "", representativeAuthorityAttested: false, authorityAttestation: false, authorityAttestedAt: "", authorityVerificationMethod: AUTHORITY_VERIFICATION_METHODS[0], authorityAdditionalVerificationRequired: false,
  accessNoticeAcknowledgedAt: "", disclosureAcknowledgedAt: "", disclosureVersion: "", accessDisclosureView: null, consentRole: "", consentVersion: "", consentTimestamp: "", sessionId: globalThis.crypto?.randomUUID?.() || `session_${Date.now().toString(36)}`, sessionMetadata: { platform: navigator.userAgentData?.platform || navigator.platform || "unknown" }, ipMetadata: null, identityVerified: false,
  identityAttempts: 0, consentSaved: false, enrollmentConfirmed: false, accessEligible: false, accessOutcome: null,
  alignmentConfirmed: false, devicePath: null, addressConfirmed: false, setupComplete: false, readingReceived: false,
  enrollmentStatus: "NOT_STARTED", enrollmentCompletedAt: "", activationStatus: "NOT_STARTED", activationStartedAt: "", deviceSetupStatus: "NOT_STARTED", deviceSetupStartedAt: "", baselineStatus: "NOT_STARTED", baselineStartedAt: "", baselineCompletedAt: "", baselineDeferredAt: "", baselineResumeScreen: "", baselineReminderStatus: "NOT_SCHEDULED",
  flowProgress: { GETTING_STARTED: emptyFlowProgress() }, flowTransitionNotice: "",
  bpBaselineStatus: "NOT_STARTED", bpBaselineRequiredReadings: 3, bpBaselineReadingCount: 0, bpBaselineRemainingReadings: 3, bpDevicePath: "", bpDeviceIdentificationMethod: "", bpDeviceVerificationStatus: "NOT_STARTED", bpDeviceVerificationResult: "", patientHasBloodPressureMonitor: false, deviceSource: "UNKNOWN", deviceVerificationStatus: "NOT_STARTED", integrationProvider: "UNKNOWN", assignedDeviceId: "", deviceVendor: "", deviceModel: "", deviceStatus: "", integrationStatus: "", lastTransmissionAt: "", last4DeviceId: "", patientDeviceConfirmationChoice: "", patientDeviceConfirmed: null, patientDeviceConfirmedAt: "", confirmedDeviceId: "", firstTransmissionVerified: null, firstTransmissionDeviceId: "", firstTransmissionAt: "", firstTransmissionSystolic: null, firstTransmissionDiastolic: null, deviceUncertaintyStep: false, bpDevice: null, armCircumferenceValue: "", armCircumferenceUnit: "cm", armMeasurementStatus: "", armMeasurementHelpReason: "", armRestrictionReported: "", restrictedArm: "NONE", measurementArm: "PENDING", armHelpOpen: false, exactArmMeasurementOpen: false, cuffSelectionMethod: "", selectedCuffOption: "", cuffSelectionStatus: "", cuffSizeSelected: null, deviceModelSelected: null, shippingAddress: null, shippingAddressConfirmed: false, shippingAddressMode: "existing", deviceFulfillmentId: "", deviceFulfillmentStatus: "NOT_REQUESTED", careTeamTasks: [], bpDeviceFulfillmentStatus: "NOT_STARTED", bpDeviceFulfillmentRequestedAt: "", bpBaselineSourceType: "", bpReadings: [], bpReadingCount: 0, bpReadingReceipts: [], bpMeasurementPhase: "WAITING", bpBaseline: null, bpEscalationState: null, clinicalReportedBloodPressure: null, accessBaselineBloodPressure: null,
  reading: null, callbackRequested: false, onboarding: {},
  healthInformationStepStatus: "NOT_STARTED", healthInformationReviewStatus: "UNREVIEWED", healthInformationReviewResult: "", healthInformationReviewedAt: "", healthInformationReviewedBy: "", healthInformationReviewSource: "", healthInformationFlowStep: "CHOICE", healthInformationUpdateDraft: { id: "", updateType: "", relatedConditionIds: [], patientReportedText: "" }, patientReportedHealthUpdates: [], healthInformationHelpNote: "",
  medicationsReviewStatus: "NOT_STARTED", careMedications: [
    { id: "med-lisinopril", name: "Lisinopril", details: "10 mg · Once daily", active: true },
    { id: "med-atorvastatin", name: "Atorvastatin", details: "20 mg · Once daily", active: true }
  ],
  medicationReviews: {}, additionalMedications: [], additionalMedicationsStatus: "UNREVIEWED", medicationChangeId: "", medicationChangeType: "", medicationAddOpen: false, medicationEditId: "",
  carePreferencesStatus: "NOT_STARTED", preferredContactMethod: "", preferredCareLanguage: "", preferredContactTime: "none",
  goalsStatus: "NOT_STARTED", careGoals: [], careGoalsNote: "", goalFlowStep: "DISCOVERY", goalFlowOrigin: "ONBOARDING", patientGoals: [], goalPrimaryId: "", goalSecondaryId: "", goalPlanningGoalId: "", goalPlanStatus: "NOT_STARTED", goalPlanDraft: { actionIds: [], customAction: "", frequency: "few-days", remindersEnabled: false, whyItMatters: "" }, activeGoalId: "", goalDetailView: "SUMMARY", goalBarrierDraft: { barrierType: "", notes: "" }, goalSupportDraft: "", goalNotice: "", goalHistory: [],
  supportRole: "NONE", careCircleStatus: "NONE", careCircleContext: "ENROLLMENT", supportPersonName: "", supportPersonPhone: "", supportPersonRelationship: "", supportPersonRelationshipOther: "", supportInviteId: "", supportInviteToken: "", supportInviteStatus: "NONE", supportInviteSentAt: "", supportInviteAcceptedAt: "", careCircleContactNumbers: [], careCircleContactPickerStatus: "IDLE", careCircleContactSource: "MANUAL", careCircleManualEntryTracked: false, careCircleManageInviteId: "", careCircleRemovePendingId: "", careCircleNotice: "", careCirclePermissions: { receiveReminders: false, helpWithDeviceSetup: false, helpWithAppointments: false, receiveCareTasks: false, viewLimitedCareProgress: false }, careCirclePromptDismissedAt: "",
  accessShares: [], activeAccessShare: null, shareAccessPromptDismissedAt: "", growthReturnScreen: "", growthContext: "", growthNotice: "",
  audit: [], busy: false, error: "", devOpen: false,
  eligibilityPhase: "checkingEnrollment", eligibilityError: false, eligibilityRequestKey: "",
  assistantOpen: false, assistantOriginScreen: null, assistantScrollY: 0, assistantMessages: [], assistantFaqOpen: false, assistantLanguageChanged: false, assistantPendingAction: "", assistantBusy: false, assistantDemoPatientId: "", assistantPatientContextKey: "", assistantVoiceState: "DISCONNECTED", assistantVoiceDetail: "", assistantVoiceError: "", assistantVoiceMuted: false, assistantVoiceOptionsOpen: false, assistantError: "", assistantRetryQuestion: "",
  emmiVoiceGuidance: typeof savedEmmiPreferences.emmiVoiceGuidance === "boolean" ? savedEmmiPreferences.emmiVoiceGuidance : false,
  emmiVoiceGuidancePaused: false, emmiWelcomeAcknowledged: Boolean(savedEmmiPreferences.emmiWelcomeAcknowledged), emmiLastGuidanceScreen: "", emmiGuidanceTranscript: "", emmiTranscriptOpen: false, emmiVoiceOptionsOpen: false, emmiIntroSeen: false, emmiContextualNudgeVisible: false, emmiTransitionStatus: "IDLE"
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
let emmiHesitationTimer = null;
let emmiHesitationCleanup = null;

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
  wind: Wind
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
const cta = (label, action = "next", secondary = false, disabled = false) => `<button class="button ${secondary ? "secondary" : "primary"}" data-action="${action}" ${disabled ? "disabled" : ""}>${label}${secondary ? "" : icon("arrowRight", "button-icon")}</button>`;
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
  NO_COMMITMENT_YET: () => ({ icon: "shield", message: L("You’ll review the details before you enroll", "Revisará los detalles antes de inscribirse", "W ap revize detay yo anvan ou enskri") }),
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
  ACCESS_BASELINE: "HEALTH_DATA_SECURITY",
  ACCESS_MEASURE: "HEALTH_DATA_SECURITY",
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
const contextualAssuranceFooter = (screen, typeOverride = "") => {
  const type = typeOverride || ASSURANCE_BY_SCREEN[screen];
  const assurance = ASSURANCE_VARIANTS[type]?.();
  return assurance ? `<p class="contextual-assurance" data-assurance-type="${type}">${icon(assurance.icon)}<span>${assurance.message}</span></p>` : "";
};
// The floating pill is EMMI scrolled out of reach, not a second assistant: it says her name,
// shows what she is doing, and opens the expanded panel in place. One tap, one destination, on
// every screen — the patient never lands on an intermediate menu about EMMI instead of EMMI.
const emmiAssistant = () => {
  const status = state.screen === "INVITATION" ? "" : emmiFloatingStatus();
  const guideState = emmiGuideState();
  return `${state.emmiContextualNudgeVisible ? `<button class="emmi-contextual-nudge" data-action="help">${L("Need help with this step?", "¿Necesita ayuda con este paso?", "Bezwen èd ak etap sa a?")}</button>` : ""}<button class="emmi-assistant" data-guide-state="${guideState}" data-action="help" data-emmi-source="floating" aria-haspopup="dialog" aria-label="${L("Ask Emmi, Care Assistant", "Preguntar a Emmi, asistente de cuidado", "Mande Emmi, asistan swen")}" title="${L("Drag Emmi to move it", "Arrastre a Emmi para moverla", "Trennen Emmi pou deplase li")}"><span class="emmi-avatar"><img src="/assets/emmi-assistant.png" alt=""></span><span class="emmi-assistant-label"><b>EMMI</b>${status ? `<i>${status}</i>` : ""}</span>${guideState === "SPEAKING" ? `<i class="emmi-audio-activity" aria-hidden="true"><b></b><b></b><b></b></i>` : ""}</button>`;
};

function header() {
  if (state.screen === "OFFER_LOADING") return "";
  if (state.screen === "INVITATION") return "";
  const progress = progressFor(state);
  const stageLabel = progressStageLabel(progress.stage);
  const progressLabel = L("Journey progress", "Progreso del proceso", "Pwogrè nan pwosesis la");
  return `<header class="app-header">
    <div class="brand-row"><button class="icon-button back-button" data-action="back" aria-label="${t().back}" ${["INVITATION", "MY_CARE"].includes(state.screen) ? "hidden" : ""}>${icon("arrowLeft")}</button><a class="brand" href="#" data-action="restart" aria-label="${L("ITERA HEALTH home", "Inicio de ITERA HEALTH", "Akèy ITERA HEALTH")}"><b>ITERA.</b>HEALTH</a><button class="language" data-action="language" aria-label="${languageActionLabel()}">${icon("language")} ${languageCode()}</button></div>
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
  const physicianAttribution = hero.headlineLines?.length
    ? `<div class="trust-hero-text-overlay"><h2 class="trust-hero-headline" aria-label="${hero.headlineLines.join(" ")}">${hero.headlineLines.map((line, index) => `<span class="${index === 2 ? "accent" : ""}">${line}</span>`).join("")}</h2><p class="trust-hero-supporting-copy" aria-label="${hero.supportingLines.join(" ")}">${hero.supportingLines.map(line => `<span>${line}</span>`).join("")}</p>${overlayText ? `<p class="physician-attribution ${overlayText.length > 34 ? "long" : ""}"><span>${hero.overlayLabel}</span> <strong>${hero.physicianName}</strong></p>` : ""}</div>`
    : overlayText ? `<p class="trust-hero-overlay ${overlayText.length > 34 ? "long" : ""}"><span>${hero.overlayLabel}</span> <strong>${hero.physicianName}</strong></p>` : "";
  const customPhysicianPhoto = hero.physicianPhotoUrl && hero.physicianPhotoUrl !== DEFAULT_PROTOTYPE_CONFIG.physicianPhotoUrl;
  const media = hero.src
    ? `<img class="trust-hero-image" src="${hero.src}" alt="${hero.alt}" ${hero.alt ? "" : "aria-hidden=\"true\""}>${customPhysicianPhoto ? `<span class="trust-hero-physician-photo custom"><img src="${escapeHtml(hero.physicianPhotoUrl)}" alt=""></span><img class="trust-hero-badge-layer" src="${hero.src}" alt="" aria-hidden="true">` : ""}${physicianAttribution}`
    : `<div class="generic-trust-hero">${icon("shield")}<strong>${L("Connected care with ITERA HEALTH", "Cuidado conectado con ITERA HEALTH", "Swen konekte avèk ITERA HEALTH")}</strong><small>${L("Support designed around your health needs", "Apoyo diseñado según sus necesidades de salud", "Sipò ki fèt selon bezwen sante ou")}</small></div>`;
  return `<section class="invitation-stage trust-hero-card" data-trust-source="${state.offer.enrollmentSource}" data-hero-variant="${hero.variant}">
    <div class="stage-brand-row"><button class="language stage-language" data-action="language" aria-label="${languageActionLabel()}">${icon("language")} ${languageCode()}</button></div>
    <div class="trust-hero-media">${media}</div>
  </section>`;
}

function invitation() {
  const source = state.offer.enrollmentSource || "Physician Referral";
  const physicianReferral = isProviderReferralSource(source);
  const accessPhysicianReferral = state.offer.pathway === "ACCESS" && physicianReferral;
  const accessDirectOutreach = state.offer.pathway === "ACCESS" && source === "ITERA Direct Outreach";
  const practiceOutreach = source === "Practice Outreach";
  const physicianName = state.offer.physician?.displayName || state.offer.referringProvider?.name || L("your physician", "su médico", "doktè ou");
  const intro = accessPhysicianReferral ? L("Get extra support between your doctor visits.", "Reciba apoyo adicional entre sus visitas al médico.", "Jwenn sipò anplis ant vizit kay doktè ou.") : accessDirectOutreach ? L("ITERA HEALTH is a Medicare ACCESS Participant providing extra support between your doctor visits.", "ITERA HEALTH es un participante de Medicare ACCESS que brinda apoyo adicional entre sus visitas al médico.", "ITERA HEALTH se yon patisipan Medicare ACCESS ki bay sipò anplis ant vizit kay doktè ou.") : physicianReferral ? L(`${physicianName}’s care team invited you to learn about additional support available through Medicare.`, `El equipo de ${physicianName} le invita a conocer apoyo adicional disponible a través de Medicare.`, `Ekip swen ${physicianName} envite w aprann sou sipò anplis ki disponib atravè Medicare.`) : practiceOutreach ? L("Fresner Medical Group and ITERA HEALTH invite you to learn about additional support available through Medicare.", "Fresner Medical Group e ITERA HEALTH le invitan a conocer apoyo adicional disponible a través de Medicare.", "Fresner Medical Group ak ITERA HEALTH envite w aprann sou sipò anplis ki disponib atravè Medicare.") : L("ITERA HEALTH invites you to learn about additional support available through Medicare.", "ITERA HEALTH le invita a conocer apoyo adicional disponible a través de Medicare.", "ITERA HEALTH envite w aprann sou sipò anplis ki disponib atravè Medicare.");
  return `${TrustHeroCard()}
    <div class="invitation-copy">${titleBlock(L("A new care option for your health", "Una nueva opción de cuidado para su salud", "Yon nouvo opsyon swen pou sante ou"), intro)}</div>
    ${emmiWelcome(physicianReferral, physicianName)}
    <section class="invitation-benefits" aria-label="${L("What this means for you", "Qué significa esto para usted", "Sa sa vle di pou ou")}">${[
      ["physician", L("Keep your doctors", "Mantenga sus médicos", "Kenbe doktè ou yo"), L("Continue seeing the doctors you know", "Continúe viendo a los médicos que conoce", "Kontinye wè doktè ou konnen yo")],
      ["home", L("Get support from home", "Reciba apoyo desde casa", "Jwenn sipò lakay ou"), L("Ongoing support between office visits", "Apoyo continuo entre sus consultas", "Sipò kontinyèl ant vizit nan klinik")],
      ["shield", L("Participation is voluntary", "La participación es voluntaria", "Patisipasyon an volontè"), L("You’ll review the details before you enroll", "Revisará los detalles antes de inscribirse", "W ap revize detay yo anvan ou enskri")]
    ].map(([i,label,detail]) => `<div class="invitation-benefit">${icon(i)}<span><strong>${label}</strong><small>${detail}</small></span></div>`).join("")}</section>
    ${actions(L("See how it works", "Vea cómo funciona", "Gade kijan sa fonksyone"), false)}
    <p class="contact-line"><span class="contact-label">${icon("phone", "contact-phone")}<span>${L("Need help? Call", "¿Necesita ayuda? Llame al", "Bezwen èd? Rele")}</span></span> <a href="tel:+13053948070">${state.offer.participantProvider.supportPhone}</a></p>`;
}

function persistEmmiPreferences() {
  try { localStorage.setItem(EMMI_PREFERENCES_KEY, JSON.stringify({ emmiVoiceGuidance: state.emmiVoiceGuidance, emmiWelcomeAcknowledged: state.emmiWelcomeAcknowledged })); }
  catch { /* Guidance preferences are best-effort and never block enrollment. */ }
  if (state.identityVerified) draftStore.save(state);
}

const emmiGuidanceIsBusy = () => ["CONNECTING", "INTERRUPTING", "USER_SPEAKING", "EMMI_THINKING", "EMMI_SPEAKING", "TOOL_RUNNING"].includes(state.assistantVoiceState);

function emmiHomeVoiceStatus() {
  if (["INTERRUPTING", "USER_SPEAKING"].includes(state.assistantVoiceState)) return L("Listening…", "Escuchando…", "N ap koute…");
  if (state.assistantVoiceState === "EMMI_SPEAKING") return state.assistantVoiceDetail === "patient_response"
    ? L("EMMI is responding…", "EMMI está respondiendo…", "EMMI ap reponn…")
    : L("EMMI is explaining…", "EMMI está explicando…", "EMMI ap eksplike…");
  if (["CONNECTING", "EMMI_THINKING", "TOOL_RUNNING"].includes(state.assistantVoiceState)) return L("Connecting EMMI…", "Conectando con EMMI…", "N ap konekte EMMI…");
  // A failed connect leaves the client DISCONNECTED, so the error has to be checked too —
  // otherwise the card claims "Voice guidance is on" while nothing is playing.
  if (state.assistantVoiceState === "ERROR" || (state.assistantVoiceState === "DISCONNECTED" && state.assistantVoiceError)) return L("Voice guidance is unavailable", "La guía por voz no está disponible", "Gid vwa pa disponib");
  return L("Voice guidance is on", "La guía por voz está activa", "Gid vwa a limen");
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
    <div class="emmi-welcome-copy"><p>${L("I can guide you through each step and answer questions along the way.", "Puedo guiarle en cada paso y responder sus preguntas durante el proceso.", "Mwen ka gide w nan chak etap epi reponn kesyon ou pandan pwosesis la.")}</p></div>
    ${emmiWelcomeVoiceControls()}
  </section>`;
}

function decisionMaker() {
  return `${titleBlock(L("Who is completing this?", "¿Quién está completando esto?", "Ki moun ki ap ranpli sa a?"), L("Choose the option that best describes you.", "Elija la opción que mejor lo describa.", "Chwazi opsyon ki pi byen dekri ou."))}
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

function optionalSupportPrompt() {
  const hidden = completionRoleAcceptsCareCircle() ? "" : "hidden";
  const label = `<span class="optional-support-label">${L("Optional support", "Apoyo opcional", "Sipò opsyonèl")}</span>`;
  // An invitation that was already sent is never re-sent or silently discarded.
  if (["INVITED", "ACTIVE"].includes(state.careCircleStatus)) {
    const name = state.supportPersonName || L("someone you trust", "alguien de confianza", "yon moun ou fè konfyans");
    return `<section class="optional-support" data-optional-support ${hidden}>${label}<div class="optional-support-card optional-support-status">${icon("check")}<span><strong>${L("Invitation sent", "Invitación enviada", "Envitasyon voye")}</strong><span class="optional-support-copy">${L(`${name} can help you through this process. You still make the decisions about your care.`, `${name} puede ayudarle en este proceso. Usted sigue tomando las decisiones sobre su cuidado.`, `${name} ka ede w nan pwosesis sa a. Se ou menm k ap toujou pran desizyon sou swen ou.`)}</span></span></div></section>`;
  }
  if (!careCirclePromptAllowed()) return "";
  return `<section class="optional-support" data-optional-support ${hidden}>${label}<button type="button" class="optional-support-card" data-action="open-care-circle" data-growth-context="early">${icon("userPlus")}<span><strong>${L("Want someone to help you?", "¿Quiere que alguien le ayude?", "Ou vle yon moun ede w?")}</strong><span class="optional-support-copy">${L("Invite someone you trust to help you through this process.", "Invite a alguien de confianza para que le ayude durante este proceso.", "Envite yon moun ou fè konfyans pou ede w pandan pwosesis sa a.")}</span><span class="optional-support-action">${L("Invite someone", "Invitar a alguien", "Envite yon moun")} ${icon("arrowRight")}</span></span></button></section>`;
}

const patientFirstName = () => String(state.offer?.patient?.displayName || L("The patient", "El paciente", "Pasyan an")).split(/\s+/)[0].replace(/[^\p{L}'’-]/gu, "") || L("The patient", "El paciente", "Pasyan an");
const careCirclePromptAllowed = () => !isPersonalRepresentative() && state.careCircleStatus === "NONE" && growthPromptAvailable(state.careCirclePromptDismissedAt);

function careCircleEarlyPrompt(compact = false) {
  if (!careCirclePromptAllowed()) return "";
  return `<button type="button" class="growth-card care-circle-early ${compact ? "compact" : ""}" data-action="open-care-circle" data-growth-context="early">${icon("userPlus")}<span><strong>${L("Want someone to help you?", "¿Quiere que alguien le ayude?", "Ou vle yon moun ede w?")}</strong><span class="care-circle-support-copy">${L("Invite someone you trust to help you through this process.", "Invite a alguien de confianza para que le ayude durante este proceso.", "Envite yon moun ou fè konfyans pou ede w pandan pwosesis sa a.")}</span><span class="care-circle-support-action">${L("Invite someone", "Invitar a alguien", "Envite yon moun")} ${icon("arrowRight")}</span></span></button>`;
}

function careCircleInvite() {
  const relationships = [["spouse", L("Spouse", "Cónyuge", "Konjwen")], ["child", L("Child", "Hijo o hija", "Pitit")], ["family", L("Family member", "Familiar", "Manm fanmi")], ["caregiver", L("Caregiver", "Cuidador", "Moun k ap bay swen")], ["friend", L("Friend", "Amigo o amiga", "Zanmi")], ["other", L("Other", "Otro", "Lòt")]];
  const ongoing = state.careCircleContext === "ONGOING_CARE";
  const title = ongoing ? L("Invite someone you trust to support your care", "Invite a alguien de confianza para apoyar su cuidado", "Envite yon moun ou fè konfyans pou sipòte swen ou") : L("Invite someone you trust", "Invite a alguien de confianza", "Envite yon moun ou fè konfyans");
  const supporting = ongoing
    ? (state.offer?.pathway === "RPM" || String(state.offer?.pathway || "").includes("RPM") ? L("They can help with reminders and monitor setup. You stay in control of your care.", "Puede ayudar con recordatorios y la configuración del monitor. Usted mantiene el control de su cuidado.", "Moun nan ka ede ak rapèl ak konfigirasyon monitè a. Se ou ki kontwole swen ou.") : L("They can help with reminders and everyday care tasks. You stay in control of your care.", "Puede ayudar con recordatorios y tareas cotidianas de cuidado. Usted mantiene el control de su cuidado.", "Moun nan ka ede ak rapèl ak travay swen chak jou. Se ou ki kontwole swen ou."))
    : L("They can help you through enrollment, but you’ll still make the decisions about your care.", "Puede ayudarle durante la inscripción, pero usted seguirá tomando las decisiones sobre su cuidado.", "Moun nan ka ede w pandan enskripsyon an, men se ou menm k ap toujou pran desizyon sou swen ou.");
  const pickerSupported = Boolean(globalThis.navigator?.contacts?.select);
  const ready = state.supportPersonName.trim() && phoneDigits(state.supportPersonPhone).length === 10 && state.supportPersonRelationship && (state.supportPersonRelationship !== "other" || state.supportPersonRelationshipOther.trim());
  const numberChoices = state.careCircleContactNumbers?.length > 1 ? `<fieldset class="contact-number-choices"><legend>${L("Which mobile number should we use?", "¿Qué número celular debemos usar?", "Ki nimewo mobil nou dwe itilize?")}</legend>${state.careCircleContactNumbers.map((item, index) => `<label><input type="radio" name="careCircleContactPhone" value="${escapeHtml(item.value)}" ${phoneDigits(state.supportPersonPhone) === phoneDigits(item.value) ? "checked" : ""}><span><strong>${escapeHtml(item.label || L("Mobile", "Celular", "Mobil"))}</strong><small>${maskPhone(item.value)}</small></span></label>`).join("")}</fieldset>` : "";
  return `${titleBlock(title, supporting, L("Care Circle", "Círculo de cuidado", "Sèk swen"))}
    ${pickerSupported ? `<button type="button" class="contact-picker-button" data-action="choose-care-circle-contact">${icon("people")}<span><strong>${L("Choose from my contacts", "Elegir de mis contactos", "Chwazi nan kontak mwen yo")}</strong><small>${L("You choose which contact to share.", "Usted elige qué contacto compartir.", "Se ou ki chwazi ki kontak pou pataje.")}</small></span></button><div class="growth-divider"><span>${L("or enter their information", "o ingrese sus datos", "oswa antre enfòmasyon yo")}</span></div>` : ""}
    ${numberChoices}<form id="care-circle-invite-form" class="growth-form" novalidate><label class="field">${L("Their name", "Su nombre", "Non moun nan")}<input name="supportPersonName" autocomplete="name" value="${escapeHtml(state.supportPersonName)}" required></label><label class="field">${L("Mobile number", "Número de celular", "Nimewo telefòn mobil")}<input name="supportPersonPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="14" value="${escapeHtml(state.supportPersonPhone)}" placeholder="(305) 555-0199" required></label><label class="field">${L("Relationship to you", "Relación con usted", "Relasyon li avèk ou")}<select name="supportPersonRelationship" required><option value="">${L("Select relationship", "Seleccione la relación", "Chwazi relasyon an")}</option>${relationships.map(([value, label]) => `<option value="${value}" ${state.supportPersonRelationship === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>${state.supportPersonRelationship === "other" ? `<label class="field">${L("Relationship", "Relación", "Relasyon")}<input name="supportPersonRelationshipOther" value="${escapeHtml(state.supportPersonRelationshipOther)}" required></label>` : ""}</form>
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
  return `<h1 tabindex="-1">${representative ? L("Let’s confirm the patient’s identity", "Confirmemos la identidad del paciente", "Ann konfime idantite pasyan an") : L("Let’s confirm it’s you", "Confirmemos su identidad", "Ann konfime se ou")}</h1>
    <p class="identity-support">${representative ? L("Please enter the patient’s date of birth and ZIP code.", "Ingrese la fecha de nacimiento y el código postal del paciente.", "Tanpri antre dat nesans ak kòd postal pasyan an.") : L("Please confirm your date of birth and ZIP code.", "Confirme su fecha de nacimiento y código postal.", "Tanpri konfime dat nesans ou ak kòd postal ou.")}</p>
    <p class="identity-helper" id="identity-helper">${representative ? L("We use this information to securely verify the patient’s identity.", "Usamos esta información para verificar de forma segura la identidad del paciente.", "Nou itilize enfòmasyon sa yo pou verifye idantite pasyan an an sekirite.") : L("We use this information to securely verify your identity.", "Usamos esta información para verificar su identidad de forma segura.", "Nou itilize enfòmasyon sa yo pou verifye idantite ou an sekirite.")}</p>
    <form id="identity-form" novalidate>
      <div class="field"><label for="dob">${L("Date of birth", "Fecha de nacimiento", "Dat nesans")}</label><div class="date-control"><input id="dob" class="date-text" name="dob" type="text" inputmode="numeric" autocomplete="bday" maxlength="14" value="${displayDate(DEMO_IDENTITY.dobIso)}" placeholder="MM / DD / YYYY" aria-describedby="identity-helper identity-error"><input class="date-picker-native" type="date" min="1900-01-01" max="${localToday()}" value="${DEMO_IDENTITY.dobIso}" aria-label="${L("Choose date of birth from calendar", "Elegir fecha de nacimiento del calendario", "Chwazi dat nesans nan kalandriye a")}">${icon("calendar", "date-picker-icon")}</div><small class="field-helper">${L("Use MM / DD / YYYY.", "Use MM / DD / AAAA.", "Itilize MM / JJ / AAAA.")}</small></div>
      <div class="field"><label for="zip">${L("ZIP code", "Código postal", "Kòd postal")}</label><input id="zip" class="zip-input" name="zip" type="text" inputmode="numeric" pattern="[0-9]{5}" autocomplete="postal-code" maxlength="5" value="${DEMO_IDENTITY.zip}" placeholder="${L("5-digit ZIP code", "Código postal de 5 dígitos", "Kòd postal 5 chif")}" aria-describedby="identity-helper identity-error"><small class="field-helper">${L("Enter your home ZIP code.", "Ingrese el código postal de su domicilio.", "Antre kòd postal lakay ou.")}</small></div>
      <p class="form-error" id="identity-error" role="alert">${state.error}</p>
    </form>${actions(state.busy ? L("Checking…", "Verificando…", "Tcheke") : t().continue)}`;
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

function accessConditionCareCard(offer) {
  const primaryCondition = offer.clinicalProfile?.primaryCondition || offer.qualifyingConditions?.[0] || offer.qualifyingCondition || {};
  const condition = `${primaryCondition.name || ""} ${primaryCondition.patientFriendlyName || ""}`.toLowerCase();
  const variants = [
    {
      matches: ["hypertension", "blood pressure"],
      icon: "heart",
      title: L("Blood pressure support", "Apoyo para la presión arterial", "Sipò pou tansyon"),
      description: L("Help monitoring and managing your blood pressure at home.", "Ayuda para monitorear y controlar su presión arterial en casa.", "Èd pou kontwole ak jere tansyon ou lakay ou.")
    },
    {
      matches: ["diabetes"],
      icon: "heart",
      title: L("Diabetes support", "Apoyo para la diabetes", "Sipò pou dyabèt"),
      description: L("Help monitoring and managing your diabetes at home.", "Ayuda para monitorear y controlar su diabetes en casa.", "Èd pou kontwole ak jere dyabèt ou lakay ou.")
    },
    {
      matches: ["heart failure"],
      icon: "heart",
      title: L("Heart health support", "Apoyo para la salud del corazón", "Sipò pou sante kè"),
      description: L("Help monitoring symptoms and supporting your heart health at home.", "Ayuda para monitorear síntomas y apoyar la salud de su corazón en casa.", "Èd pou kontwole sentòm epi sipòte sante kè ou lakay ou.")
    },
    {
      matches: ["kidney"],
      icon: "heart",
      title: L("Kidney health support", "Apoyo para la salud renal", "Sipò pou sante ren"),
      description: L("Help monitoring and supporting your kidney health at home.", "Ayuda para monitorear y apoyar su salud renal en casa.", "Èd pou kontwole ak sipòte sante ren ou lakay ou.")
    }
  ];
  return variants.find(variant => variant.matches.some(match => condition.includes(match))) || {
    icon: "heart",
    title: L("Health support", "Apoyo para su salud", "Sipò pou sante ou"),
    description: L("Help managing your health needs at home.", "Ayuda para atender sus necesidades de salud en casa.", "Èd pou jere bezwen sante ou lakay ou.")
  };
}

function accessCareCapabilities(offer) {
  const conditionCard = accessConditionCareCard(offer);
  const physicianName = offer.physician?.displayName;
  const coordinationCopy = isProviderReferralSource(offer.enrollmentSource) && physicianName
    ? L(`ITERA works with ${physicianName} to help keep your care coordinated.`, `ITERA trabaja con ${physicianName} para ayudar a mantener su cuidado coordinado.`, `ITERA travay avèk ${physicianName} pou ede kenbe swen ou kowòdone.`)
    : L("ITERA helps keep your care coordinated with the doctors you already see.", "ITERA ayuda a mantener su cuidado coordinado con los médicos que ya consulta.", "ITERA ede kenbe swen ou kowòdone avèk doktè ou deja wè yo.");
  return [
    { icon: "calendar", title: L("Regular check-ins", "Seguimiento regular", "Tcheke regilyèman"), description: L("Your care team checks in, answers questions, and helps you stay on track.", "Su equipo de cuidado se mantiene en contacto, responde preguntas y le ayuda a seguir su plan.", "Ekip swen ou tcheke sou ou, reponn kesyon, epi li ede w rete sou bon chemen an.") },
    conditionCard,
    { icon: "goals", title: L("A care plan built around you", "Un plan de cuidado pensado para usted", "Yon plan swen ki fèt pou ou"), description: L("Goals and next steps based on your health needs.", "Metas y próximos pasos basados en sus necesidades de salud.", "Objektif ak pwochen etap ki baze sou bezwen sante ou.") },
    { icon: "people", title: L("Connected with your doctors", "Conectado con sus médicos", "Konekte avèk doktè ou yo"), description: coordinationCopy }
  ];
}

function recommendation() {
  if (state.offer.pathway === "ACCESS") {
    const capabilities = accessCareCapabilities(state.offer);
    return `${titleBlock(L("What your care includes", "Qué incluye su cuidado", "Sa swen ou gen ladan"), L("Your ACCESS care is designed to support you at home and between doctor visits.", "Su cuidado ACCESS está diseñado para apoyarle en casa y entre visitas al médico.", "Swen ACCESS ou fèt pou sipòte w lakay ou ak ant vizit kay doktè."))}
      ${rows(capabilities.map(x => [x.icon, x.title, x.description]))}
      <aside class="note">${icon("info")}<span>${L("Your care continues between visits, while your doctors remain part of your care.", "Su cuidado continúa entre visitas, mientras sus médicos siguen siendo parte de su cuidado.", "Swen ou kontinye ant vizit yo, pandan doktè ou yo rete yon pati nan swen ou.")}</span></aside>
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
    enrollmentSource: state.offer?.enrollmentSource || null,
    physicianDisplayName: state.offer?.physician?.displayName || null,
    currentStage: progress.stage,
    currentScreen: emmiCurrentScreen,
    routeScreen: currentScreen,
    currentConditions,
    eligibilityStatus: state.accessOutcome === "notEligible" ? "NOT_ELIGIBLE" : fixture.eligibilityStatus,
    enrollmentStatus: state.enrollmentStatus === "COMPLETED" ? "COMPLETED" : fixture.enrollmentStatus,
    bpBaselineStatus: state.bpBaselineStatus || fixture.bpBaselineStatus,
    bpBaselineRequiredReadings: state.bpBaselineRequiredReadings || 3,
    bpBaselineReadingCount: state.bpBaselineReadingCount || 0,
    bpBaselineRemainingReadings: state.bpBaselineRemainingReadings ?? 3,
    deviceVerificationStatus: state.deviceVerificationStatus,
    firstTransmissionVerified: state.firstTransmissionVerified,
    careCircleStatus: state.careCircleStatus,
    supportRole: state.supportRole,
    supportPersonName: state.supportPersonName || null,
    supportInviteStatus: state.supportInviteStatus,
    deviceScenario,
    goalFlowStep: state.goalFlowStep,
    patientGoals: activePatientGoals().map(goal => ({ id: goal.id, title: goalDisplayName(goal, state.language), status: goal.status, priority: goal.priority, planStatus: goal.planStatus })),
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
      nextBestEducation: nextBestGoalEducation({ goalType: activeGoalRecord.goalType, completedTopicIds: (activeGoalRecord.educationHistory || []).filter(item => item.status === "COMPLETED").map(item => item.topicId) })
    } : null,
    medications: (state.careMedications || []).map(({ id, name, details, active }) => ({ id, name, details, active: Boolean(active) })),
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
  createCareTeamTask: L("Talking with your care team…", "Comunicándonos con su equipo…", "N ap kontakte ekip swen ou…")
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
    onProgress: () => draftStore.save(state)
  });
  emmiTextOrchestrator ||= new EmmiTextOrchestrator({
    getContext: assistantContext,
    getConversation: () => emmiConversationManager?.contextForModel() || {},
    executeTool: (name, args) => emmiTools.execute(name, args),
    screenExplanation: assistantScreenExplanation,
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
    onTranscript: (role, text) => {
      const cleaned = String(text || "").trim(); if (!cleaned) return;
      const last = state.assistantMessages.at(-1);
      if (last?.role === role && last.voice && !last.interrupted) last.text = `${last.text} ${cleaned}`.trim();
      else state.assistantMessages.push({ role, text: cleaned, voice: true });
      emmiConversationManager?.recordTurn(role, cleaned, { screen: state.screen });
      if (role === "assistant" && emmiConversationManager?.greetingAllowed()) emmiConversationManager.markGreeted();
      emmiAuditLog.transcript(role, cleaned); if (state.assistantOpen) refreshAssistantLayer();
    },
    onTurnComplete: metadata => emmiTransitionManager?.onTurnComplete(metadata),
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
  const sideFlows = ["CARE_CIRCLE_INVITE", "CARE_CIRCLE_INVITE_SENT", "CARE_CIRCLE_PERMISSIONS", "MY_CARE_CIRCLE", "CARE_CIRCLE_REMOVE_CONFIRMATION", "SHARE_ACCESS", "PERSONAL_REPRESENTATIVE_DETAILS", "REPRESENTATIVE_MOBILE_VERIFICATION", "REPRESENTATIVE_AUTHORITY_ATTESTATION", "REPRESENTATIVE_AUTHORITY_ESCALATION"];
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

function assistantScreenExplanation(screen) {
  const explanations = {
    INVITATION: L("This screen introduces the care support available to you and lets you choose whether to learn more.", "Esta pantalla presenta el apoyo de cuidado disponible y le permite decidir si desea conocer más.", "Ekran sa a entwodui sipò swen ki disponib pou ou epi li pèmèt ou chwazi si pou w aprann plis."),
    DECISION_MAKER: L("This screen asks who is completing the enrollment so we can show the right information.", "Esta pantalla pregunta quién completa la inscripción para mostrar la información correcta.", "Ekran sa a mande ki moun ki ranpli enskripsyon an pou nou ka montre bon enfòmasyon an."),
    IDENTITY_VERIFICATION: L("This screen securely confirms your identity using your date of birth and home ZIP code.", "Esta pantalla confirma su identidad de forma segura usando su fecha de nacimiento y código postal.", "Ekran sa a konfime idantite w san danje lè l sèvi avèk dat nesans ou ak kòd postal lakay ou."),
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
    MY_GOALS: L("My Goals keeps the goals you chose, your plan, progress, and support requests in one place. These personal goals do not change clinical targets or medical orders.", "Mis metas reúne las metas que eligió, su plan, progreso y solicitudes de apoyo. Estas metas personales no cambian objetivos clínicos ni indicaciones médicas.", "Objektif mwen mete objektif ou chwazi yo, plan ou, pwogrè ou ak demann sipò yo nan yon sèl kote. Objektif pèsonèl sa yo pa chanje sib klinik ni lòd medikal.")
  };
  return explanations[screen] || L("This screen shows your current enrollment task and what you need to do next.", "Esta pantalla muestra su tarea actual y lo que debe hacer después.", "Ekran sa a montre travay enskripsyon aktyèl ou ak sa ou bezwen fè pwochen.");
}

async function legacyAssistantActionAnswer(question, context) {
  const normalized = question.toLowerCase();
  const runtime = ensureEmmiRuntime();
  const bpMatch = normalized.match(/(\d{2,3})\s*(?:over|\/|sobre)\s*(\d{2,3})/i);
  const concerningSymptoms = /(chest pain|can'?t breathe|cannot breathe|difficulty breathing|stroke|severe bleeding|feel very bad|pass(?:ed)? out|faint(?:ed|ing)?|suicid|emergency|dolor de pecho|no puedo respirar|derrame|sangrado grave|me siento muy mal|me desmay|desmayo|emergencia|doulè nan pwatrin|pa ka respire|konjesyon serebral|senyen anpil|mwen santi m mal anpil|endispoze|pèdi konesans|ijans|swisid)/i.test(question);
  if (bpMatch || concerningSymptoms) {
    const result = await runtime.tools.execute("evaluateClinicalEscalation", { systolic: Number(bpMatch?.[1] || 0), diastolic: Number(bpMatch?.[2] || 0), symptoms: question });
    if (result.instruction === "CALL_911") return { emergency: true, text: L("This may require urgent medical attention. Please call 911 or seek emergency care now.", "Esto puede requerir atención médica urgente. Llame al 911 o busque atención de emergencia ahora.", "Sa ka mande swen medikal ijan. Tanpri rele 911 oswa chèche swen ijans kounye a.") };
    if (result.instruction === "CREATE_HIGH_PRIORITY_TASK") return { text: L("This reading needs care-team review. Would you like me to create a high-priority task for your care team?", "Esta medición necesita revisión del equipo de atención. ¿Desea que cree una tarea de alta prioridad para su equipo?", "Mezi sa a bezwen ekip swen an revize li. Èske ou vle m kreye yon travay priyorite wo pou ekip ou a?"), pendingAction: "clinical-task" };
  }
  if (["GOALS", "MY_GOALS"].includes(context.currentScreen) && /(why.*goal|por qué.*meta|poukisa.*objektif)/i.test(normalized)) return { text: L("Your goals help your care team understand what matters to you and how you would like support. They are your personal goals, not medical orders or clinical targets.", "Sus metas ayudan a su equipo a comprender qué le importa y cómo desea recibir apoyo. Son metas personales, no indicaciones médicas ni objetivos clínicos.", "Objektif ou ede ekip swen ou konprann sa ki enpòtan pou ou ak fason ou ta renmen jwenn sipò. Se objektif pèsonèl ou, yo pa lòd medikal ni sib klinik.") };
  if (["GOALS", "MY_GOALS"].includes(context.currentScreen) && /(change.*goal|cambiar.*meta|chanje.*objektif)/i.test(normalized)) return { text: L("Yes. You can adjust, pause, restart, or mark a personal goal achieved later from My Goals.", "Sí. Puede ajustar, pausar, reanudar o marcar una meta personal como lograda más adelante desde Mis metas.", "Wi. Ou ka ajiste, mete an poz, rekòmanse, oswa make yon objektif pèsonèl kòm reyalize pita nan Objektif mwen.") };
  if (["GOALS", "MY_GOALS"].includes(context.currentScreen) && /(make.*plan|personalize.*plan|crear.*plan|personalizar.*plan|fè.*plan|pèsonalize.*plan)/i.test(normalized)) return { text: L("I can help you personalize small optional steps, but you choose what feels realistic. These steps are not medical orders, and your care team remains responsible for clinical decisions.", "Puedo ayudarle a personalizar pasos pequeños y opcionales, pero usted elige lo que le parezca realista. Estos pasos no son indicaciones médicas y su equipo de atención sigue siendo responsable de las decisiones clínicas.", "Mwen ka ede w pèsonalize ti etap opsyonèl, men se ou ki chwazi sa ki reyalis. Etap sa yo pa lòd medikal, epi ekip swen ou rete responsab desizyon klinik yo.") };
  if (["GOALS", "MY_GOALS"].includes(context.currentScreen) && /(trouble|difficult|problema|dificultad|pwoblèm|difisil)/i.test(normalized)) return { text: L("That’s okay. Open the goal check-in and choose that you’re having difficulty. We’ll help you name the barrier and, if you choose, send a support request to your care team.", "Está bien. Abra el seguimiento de la meta e indique que tiene dificultades. Le ayudaremos a identificar la barrera y, si lo desea, enviar una solicitud de apoyo a su equipo.", "Sa pa yon pwoblèm. Louvri tcheke objektif la epi chwazi ou gen difikilte. N ap ede w idantifye baryè a epi, si ou vle, voye yon demann sipò bay ekip swen ou.") };
  const affirmative = /^(yes|yes please|please do|sí|si|wi|dakò)$/i.test(normalized.trim());
  if (affirmative && state.assistantPendingAction === "callback") {
    const result = await runtime.tools.execute("requestCallback", { patientId: context.patientId, reason: "Patient requested help in EMMI", preferredLanguage: context.locale, confirmed: true });
    state.assistantPendingAction = "";
    return { text: result.success ? L("Done. I sent a callback request to the care team.", "Listo. Envié una solicitud para que el equipo de atención le llame.", "Fini. Mwen voye yon demann pou ekip swen an rele ou.") : L("I couldn’t request the call right now. You can call the care team directly.", "No pude solicitar la llamada en este momento. Puede llamar directamente al equipo.", "Mwen pa t kapab mande apèl la kounye a. Ou ka rele ekip swen an dirèkteman.") };
  }
  if (affirmative && state.assistantPendingAction === "clinical-task") {
    const result = await runtime.tools.execute("createCareTeamTask", { patientId: context.patientId, category: "clinical_review", reason: "Fictional elevated blood pressure reported in prototype", priority: "HIGH", confirmed: true });
    state.assistantPendingAction = "";
    return { text: result.success ? L("Done. I created a high-priority care-team task.", "Listo. Creé una tarea de alta prioridad para el equipo de atención.", "Fini. Mwen kreye yon travay priyorite wo pou ekip swen an.") : L("I couldn’t create the task right now. Please call the care team.", "No pude crear la tarea. Llame al equipo de atención.", "Mwen pa t kapab kreye travay la. Tanpri rele ekip swen an.") };
  }
  if (context.currentScreen === "HEALTH_INFORMATION_REVIEW" && /(high blood pressure|hypertension|presión arterial alta|hipertensión|tansyon wo)/i.test(normalized)) return { text: L("High blood pressure means the force of blood against your blood vessels is often higher than recommended. I can explain the term, but I can’t diagnose you or confirm that the clinical record is correct.", "La presión arterial alta significa que la fuerza de la sangre contra los vasos sanguíneos suele ser mayor de lo recomendado. Puedo explicar el término, pero no diagnosticarle ni confirmar que el registro clínico sea correcto.", "Tansyon wo vle di fòs san an sou veso sangen yo souvan pi wo pase sa yo rekòmande. Mwen ka eksplike tèm nan, men mwen pa ka fè dyagnostik ni konfime dosye klinik la kòrèk.") };
  if (context.currentScreen === "HEALTH_INFORMATION_REVIEW" && /(confirm|correct|diagnos|confirmar|correct|diagnóst|konfime|kòrèk|dyagnost)/i.test(normalized)) return { text: L("I can help explain what the information means, but I can’t confirm a diagnosis or change your clinical record. If you’re unsure, choose ‘I need help reviewing this’ so your care team can review it with you.", "Puedo ayudarle a entender la información, pero no confirmar un diagnóstico ni cambiar su registro clínico. Si tiene dudas, elija “Necesito ayuda para revisarlo” para que su equipo lo revise con usted.", "Mwen ka ede eksplike enfòmasyon an, men mwen pa ka konfime yon dyagnostik ni chanje dosye klinik ou. Si ou pa sèten, chwazi “Mwen bezwen èd revize sa a” pou ekip swen ou ka revize li avèk ou.") };
  if (context.currentScreen === "HEALTH_INFORMATION_REVIEW" && /(not sure|care team|no estoy seguro|equipo|pa sèten|ekip swen)/i.test(normalized)) return { text: L("That’s okay. Your care team can review the information with you. EMMI will not mark it as confirmed or change it automatically.", "Está bien. Su equipo de atención puede revisar la información con usted. EMMI no la marcará como confirmada ni la cambiará automáticamente.", "Sa pa yon pwoblèm. Ekip swen ou ka revize enfòmasyon an avèk ou. EMMI p ap make li kòm konfime ni chanje li otomatikman.") };
  if (/(someone help|invite someone|someone i trust|daughter help|son help|family.*help|caregiver|care circle|alguien.*ayud|invitar a alguien|alguien de confianza|hija.*ayud|hijo.*ayud|familiar.*ayud|cuidador|círculo de cuidado|yon moun.*ede|envite yon moun|moun mwen fè konfyans|pitit.*ede|fanmi.*ede|moun k ap bay swen|sèk swen)/i.test(normalized)) {
    return { text: L("Yes. You can choose her from your contacts when that option is available, or enter her name and mobile number yourself. Nothing is sent until you review the details and tap Send invitation. She can provide basic support, but cannot consent, sign, or make healthcare decisions for you.", "Sí. Puede elegirla de sus contactos cuando esa opción esté disponible o ingresar su nombre y número celular. No se envía nada hasta que revise los datos y toque Enviar invitación. Puede brindar apoyo básico, pero no dar consentimiento, firmar ni tomar decisiones médicas por usted.", "Wi. Ou ka chwazi li nan kontak ou lè opsyon sa a disponib, oswa antre non li ak nimewo mobil li. Anyen p ap voye jiskaske ou revize detay yo epi peze Voye envitasyon. Li ka bay sipò debaz, men li pa ka bay konsantman, siyen, oswa pran desizyon swen sante pou ou."), quickAction: "care-circle" };
  }
  if (["CARE_CIRCLE_INVITE", "MY_CARE_CIRCLE", "CARE_CIRCLE_PERMISSIONS"].includes(context.currentScreen) && /(consent|sign|make decisions|decision for me|consentimiento|firmar|decisiones por mí|konsantman|siyen|desizyon pou mwen)/i.test(normalized)) return { text: L("No. A Care Circle member can provide only the basic support you choose. They cannot consent, sign, or make healthcare decisions for you, and they are not a Personal Representative.", "No. Un miembro del Círculo de cuidado solo puede brindar el apoyo básico que usted elija. No puede dar consentimiento, firmar ni tomar decisiones médicas por usted y no es un Representante personal.", "Non. Yon manm Sèk swen ka bay sèlman sipò debaz ou chwazi. Li pa ka bay konsantman, siyen, oswa pran desizyon swen sante pou ou, epi li pa yon Reprezantan pèsonèl.") };
  if (context.currentScreen === "MEDICATIONS_REVIEW" && /(what is|what does).*(lisinopril)|qué es.*lisinopril|kisa.*lisinopril/i.test(normalized)) return { text: L("Lisinopril is commonly used to help manage blood pressure and certain heart conditions. I can provide general information, but I can’t tell you to start, stop, or change it.", "Lisinopril se usa comúnmente para ayudar a controlar la presión arterial y ciertas afecciones del corazón. Puedo ofrecer información general, pero no indicarle que lo inicie, suspenda o cambie.", "Yo itilize Lisinopril souvan pou ede kontwole tansyon ak kèk pwoblèm kè. Mwen ka bay enfòmasyon jeneral, men mwen pa ka di w kòmanse, sispann, oswa chanje li.") };
  if (context.currentScreen === "MEDICATIONS_REVIEW" && /(don'?t know.*dose|not sure.*dose|no sé.*dosis|no estoy seguro.*dosis|pa konnen.*dòz|pa sèten.*dòz)/i.test(normalized)) return { text: L("That’s okay. You can leave the dose blank when adding a medication, or mark an on-file medication as not sure. Your care team can review it with you.", "Está bien. Puede dejar la dosis en blanco al agregar un medicamento o marcar que no está seguro sobre uno registrado. Su equipo de atención puede revisarlo con usted.", "Sa pa yon pwoblèm. Ou ka kite dòz la vid lè w ap ajoute yon medikaman, oswa make ou pa sèten sou yon medikaman nan dosye a. Ekip swen ou ka revize li avèk ou.") };
  if (context.currentScreen === "MEDICATIONS_REVIEW" && /(should i|can i).*(stop|change|take)|debo.*(dejar|suspender|cambiar|tomar)|èske mwen dwe.*(sispann|chanje|pran)/i.test(normalized)) return { text: L("I can’t recommend starting, stopping, or changing a medication or dose. Record what you are taking today, and contact your clinician or care team for treatment advice.", "No puedo recomendar iniciar, suspender ni cambiar un medicamento o una dosis. Registre lo que toma actualmente y consulte a su profesional clínico o equipo de atención.", "Mwen pa ka rekòmande pou kòmanse, sispann, oswa chanje yon medikaman oswa dòz. Ekri sa w ap pran jodi a, epi kontakte klinisyen oswa ekip swen ou pou konsèy tretman.") };
  if (context.currentScreen === "MEDICATIONS_REVIEW" && /(not sure.*take|don'?t know.*take|no estoy seguro.*tom|no sé si.*tom|pa sèten.*pran|pa konnen si.*pran)/i.test(normalized)) return { text: L("That’s okay. Choose ‘Something changed,’ then ‘I’m not sure about this medication.’ Your care team can review it with you.", "Está bien. Elija “Algo cambió” y luego “No estoy seguro de este medicamento”. Su equipo de atención puede revisarlo con usted.", "Sa pa yon pwoblèm. Chwazi “Gen yon bagay ki chanje,” epi “Mwen pa sèten sou medikaman sa a.” Ekip swen ou ka revize li avèk ou.") };
  if (/(share access|send this|send.*brother|send.*sister|share.*brother|share.*family|compartir access|enviar.*hermano|compartir.*famil|pataje access|voye.*frè|pataje.*fanmi)/i.test(normalized)) {
    return state.enrollmentStatus === "COMPLETED"
      ? { text: L("Yes. I can help you share public information about ACCESS. They will still need to check whether ACCESS is available to them.", "Sí. Puedo ayudarle a compartir información pública sobre ACCESS. La otra persona deberá verificar si ACCESS está disponible para ella.", "Wi. Mwen ka ede w pataje enfòmasyon piblik sou ACCESS. Lòt moun nan ap toujou bezwen verifye si ACCESS disponib pou li."), quickAction: "share-access" }
      : { text: L("After your enrollment is complete, I can help you share public information about ACCESS without sharing your enrollment information.", "Cuando complete su inscripción, puedo ayudarle a compartir información pública sobre ACCESS sin compartir los datos de su inscripción.", "Apre enskripsyon ou fini, mwen ka ede w pataje enfòmasyon piblik sou ACCESS san pataje enfòmasyon enskripsyon ou.") };
  }
  if (/(cost|pay|how much|costo|pagar|cuánto|pri|peye|koute)/i.test(normalized)) {
    // The engine decides the amount and the reason; this only puts the reason into words.
    const cost = await runtime.tools.execute("getExpectedAccessCost", { patientId: context.patientId, accessTrack: context.accessTrack });
    return { text: emmiAccessCostAnswer(cost, state.language) };
  }
  const asksIfAnotherBpReadingIsNeeded = ((normalized.includes("blood pressure") || normalized.includes("pressure")) && (normalized.includes("again") || normalized.includes("now")))
    || (normalized.includes("presión") && (normalized.includes("otra vez") || normalized.includes("ahora")))
    || (normalized.includes("tansyon") && (normalized.includes("ankò") || normalized.includes("kounye a")));
  if (asksIfAnotherBpReadingIsNeeded) {
    const enrollmentContext = await runtime.tools.execute("getEnrollmentContext", { patientId: context.patientId });
    const sourceIsVerified = enrollmentContext.deviceVerificationStatus === "SOURCE_VERIFIED" || enrollmentContext.firstTransmissionVerified === true;
    if (sourceIsVerified && enrollmentContext.bpBaselineReadingCount > 0 && enrollmentContext.bpBaselineRemainingReadings > 0) return { text: L("No. Your monitor is connected and we received your first reading. You can take your next readings later, and ITERA will receive them automatically.", "No. Su monitor está conectado y recibimos su primera medición. Puede realizar las próximas más adelante e ITERA las recibirá automáticamente.", "Non. Aparèy ou konekte epi nou resevwa premye mezi ou a. Ou ka pran lòt mezi yo pita, epi ITERA ap resevwa yo otomatikman.") };
  }
  if (/(monitor|device|aparato|aparèy)/i.test(normalized)) {
    const device = await runtime.tools.execute("getAssignedDevice", { patientId: context.patientId });
    if (device.found && device.integrationStatus === "CONNECTED") return { text: L("I found the monitor assigned to your care, and it is connected to ITERA. You can continue with your blood pressure setup.", "Encontré el monitor asignado a su cuidado y está conectado a ITERA. Puede continuar configurando su presión arterial.", "Mwen jwenn aparèy ki asiyen pou swen ou a, epi li konekte ak ITERA. Ou ka kontinye ak konfigirasyon tansyon ou.") };
    if (device.patientOwnsMonitor) return { text: L("You have your own blood pressure monitor, but it isn’t connected to ITERA. We can help arrange a connected monitor for your ACCESS readings.", "Tiene su propio monitor de presión arterial, pero no está conectado a ITERA. Podemos ayudarle a obtener un monitor conectado para sus mediciones de ACCESS.", "Ou gen pwòp aparèy tansyon pa ou, men li pa konekte ak ITERA. Nou ka ede fè aranjman pou yon aparèy konekte pou mezi ACCESS ou yo.") };
    return { text: L("I don’t see a monitor assigned to your care yet. ITERA can help arrange a connected monitor for you.", "Todavía no veo un monitor asignado a su cuidado. ITERA puede ayudarle a obtener uno conectado.", "Mwen poko wè yon aparèy ki asiyen pou swen ou. ITERA ka ede fè aranjman pou yon aparèy konekte.") };
  }
  if (/(call me|someone call|talk with someone|hablar con alguien|que me llamen|pale ak yon moun|rele m)/i.test(normalized)) return { text: L("Would you like me to ask the ITERA care team to call you?", "¿Desea que solicite al equipo de atención de ITERA que le llame?", "Èske ou vle m mande ekip swen ITERA a rele ou?"), pendingAction: "callback" };
  if (/(can you enroll|enroll me|inscríbeme|inscribirme|enskri m)/i.test(normalized)) return { text: L("I can explain the information and guide you, but you need to review and agree to enrollment yourself. I cannot consent for you.", "Puedo explicarle la información y orientarle, pero usted debe revisar y aceptar la inscripción. No puedo dar consentimiento por usted.", "Mwen ka esplike enfòmasyon an epi gide ou, men se ou menm ki dwe revize epi dakò ak enskripsyon an. Mwen pa ka bay konsantman pou ou.") };
  if (/(check|select|mark).*(authorized|authority)|marcar.*autoriz|seleccionar.*autoriz|tcheke.*otorize/i.test(normalized)) return { text: L("I can explain the statement, but I can’t confirm your authority for you. Select the checkbox yourself only if it is true.", "Puedo explicarle la declaración, pero no puedo confirmar su autoridad. Marque la casilla usted mismo solo si es verdadera.", "Mwen ka esplike deklarasyon an, men mwen pa ka konfime otorite ou pou ou. Chwazi kaz la poukont ou sèlman si li vre.") };
  if (/(why.*phone|verify.*phone|por qué.*teléfono|verificar.*teléfono|poukisa.*telefòn|verifye.*telefòn)/i.test(normalized)) return { text: L("We verify the representative’s phone to confirm how to reach the person completing enrollment for the patient. The verification does not confirm legal authority.", "Verificamos el teléfono del representante para confirmar cómo contactar a quien completa la inscripción. La verificación no confirma autoridad legal.", "Nou verifye telefòn reprezantan an pou konnen kijan pou kontakte moun k ap ranpli enskripsyon an. Verifikasyon an pa konfime otorite legal.") };
  if (context.eligibilityStatus === "NOT_ELIGIBLE" && /(why|continue|enroll|por qué|continuar|inscribir|poukisa|kontinye|enskri)/i.test(normalized)) return { text: L("ACCESS enrollment cannot continue in this demo because Medicare placed the patient in a comparison group. Medicare benefits, coverage, and regular care remain unchanged.", "La inscripción en ACCESS no puede continuar en esta demostración porque Medicare asignó al paciente a un grupo de comparación. Sus beneficios, cobertura y cuidado habitual no cambian.", "Enskripsyon ACCESS pa ka kontinye nan demonstrasyon sa a paske Medicare mete pasyan an nan yon gwoup konparezon. Benefis, kouvèti ak swen nòmal Medicare pa chanje.") };
  if (/(monitor|device|aparato|aparèy)/i.test(normalized) && context.deviceScenario?.patientOwnsMonitor && context.deviceScenario.integrationStatus === "UNSUPPORTED") return { text: L("You have your own blood pressure monitor, but it isn’t connected to ITERA. We can help arrange a connected monitor for your ACCESS readings.", "Tiene su propio monitor de presión arterial, pero no está conectado a ITERA. Podemos ayudarle a obtener un monitor conectado para sus mediciones de ACCESS.", "Ou gen pwòp aparèy tansyon pa ou, men li pa konekte ak ITERA. Nou ka ede fè aranjman pou yon aparèy konekte pou mezi ACCESS ou yo.") };
  if (/(what am i agreeing|qué estoy aceptando|kisa mwen.*dakò)/i.test(normalized)) return { text: isPersonalRepresentative() ? L("You are agreeing, on behalf of the patient, to enroll the patient in ACCESS with ITERA HEALTH. CMS Alignment still must be completed before enrollment is confirmed.", "Está aceptando, en nombre del paciente, inscribir al paciente en ACCESS con ITERA HEALTH. La alineación de CMS aún debe completarse antes de confirmar la inscripción.", "Ou dakò, nan non pasyan an, pou enskri pasyan an nan ACCESS avèk ITERA HEALTH. Aliyman CMS dwe fini toujou anvan enskripsyon an konfime.") : L("You are agreeing to enroll in ACCESS with ITERA HEALTH. CMS Alignment still must be completed before enrollment is confirmed.", "Está aceptando inscribirse en ACCESS con ITERA HEALTH. La alineación de CMS aún debe completarse antes de confirmar la inscripción.", "Ou dakò pou enskri nan ACCESS avèk ITERA HEALTH. Aliyman CMS dwe fini toujou anvan enskripsyon an konfime.") };
  if (/(personal representative|representante personal|reprezantan pèsonèl)/i.test(normalized)) return { text: L("A personal representative is someone authorized to make healthcare decisions for the patient. The representative signs on the patient’s behalf, not as the patient.", "Un representante personal es una persona autorizada para tomar decisiones médicas por el paciente. Firma en nombre del paciente, no como si fuera el paciente.", "Yon reprezantan pèsonèl se yon moun ki otorize pou pran desizyon swen sante pou pasyan an. Reprezantan an siyen nan non pasyan an, li pa siyen kòm pasyan an.") };
  if (/(don'?t understand|do not understand|explain this|this screen|no entiendo|explique esto|mwen pa konprann|eksplike sa|ekran sa)/i.test(normalized)) return { text: assistantScreenExplanation(context.currentScreen) };
  if (/(talk to someone|call me|need help|hablar con alguien|llámenme|necesito ayuda|pale ak yon moun|rele m|bezwen èd)/i.test(normalized)) return { text: L("You can call our care team now or request a callback below. You do not need to ask Emmi first.", "Puede llamar a nuestro equipo ahora o solicitar una llamada abajo. No necesita consultar primero con Emmi.", "Ou ka rele ekip swen nou an kounye a oswa mande pou nou rele ou anba a. Ou pa bezwen mande Emmi an premye.") };
  if (/(what is access|qué es access|kisa access)/i.test(normalized)) return { text: L("ACCESS is a Medicare care option that can add coordinated support between doctor visits. Your regular Medicare benefits and doctors remain in place.", "ACCESS es una opción de cuidado de Medicare que puede añadir apoyo coordinado entre visitas. Sus beneficios y médicos habituales permanecen igual.", "ACCESS se yon opsyon swen Medicare ki ka ajoute sipò kowòdone ant vizit kay doktè. Benefis Medicare ou nòmalman genyen yo ak doktè ou yo pa chanje.") };
  if (/(keep|seeing).*(doctor)|doctor.*(keep|seeing)|conservar.*médico|seguir.*médico|kenbe.*doktè|kontinye.*doktè/i.test(normalized)) {
    const doctor = context.physicianDisplayName || L("your doctor", "su médico", "doktè ou");
    return { text: L(`Yes. You can continue seeing ${doctor}. ITERA provides additional support and does not replace your doctor.`, `Sí. Puede continuar viendo a ${doctor}. ITERA brinda apoyo adicional y no reemplaza a su médico.`, `Wi. Ou ka kontinye wè ${doctor}. ITERA bay sipò anplis epi li pa ranplase doktè ou.`) };
  }
  if (/(cost|pay|anything|costo|pagar|pri|peye|koute)/i.test(normalized)) {
    if (context.program === "ACCESS" && context.accessCost) {
      const cost = accessCostSummary(context.accessCost);
      return { text: `${cost.amountLabel}. ${cost.supportingCopy}` };
    }
    return { text: L("Coverage and possible cost-sharing depend on the care services involved. You can review the details and talk with our care team before deciding.", "La cobertura y posibles costos dependen de los servicios. Puede revisar los detalles y hablar con nuestro equipo antes de decidir.", "Kouvèti ak posib depans pataje depann de sèvis swen ki enplike yo. Ou ka revize detay yo epi pale ak ekip swen nou an anvan ou deside.") };
  }
  if (/(change|switch).*(access )?provider|(access )?provider.*(change|switch)|cambiar.*proveedor|chanje.*founisè/i.test(normalized)) return { text: L("Beginning 90 days after enrollment, you may end your ACCESS participation or switch to another participating provider.", "A partir de 90 días después de la inscripción, puede terminar su participación en ACCESS o cambiar a otro proveedor participante.", "Apati 90 jou apre enskripsyon an, ou ka mete fen nan patisipasyon ACCESS ou oswa chanje pou yon lòt founisè ki patisipe.") };
  if (/(voluntary|change my mind|stop|voluntaria|cambiar de opinión|volontè|chanje lide|sispann)/i.test(normalized)) return { text: context.program === "ACCESS" ? L("Participation is voluntary. You can choose not to continue before enrollment. Beginning 90 days after enrollment, you may end ACCESS participation or switch to another participating provider.", "La participación es voluntaria. Puede decidir no continuar antes de inscribirse. A partir de 90 días después de la inscripción, puede finalizar ACCESS o cambiar a otro proveedor participante.", "Patisipasyon an volontè. Ou ka chwazi pa kontinye anvan enskripsyon an. Apati 90 jou apre enskripsyon an, ou ka mete fen nan patisipasyon ACCESS ou oswa chanje pou yon lòt founisè ki patisipe.") : L("Participation is voluntary. You can ask questions before enrolling and can change your mind.", "La participación es voluntaria. Puede preguntar antes de inscribirse y cambiar de opinión.", "Patisipasyon an volontè. Ou ka poze kesyon anvan ou enskri epi ou ka chanje lide ou.") };
  if (/(medicare|benefit|beneficio)/i.test(normalized)) return { text: L("The enrollment review and eligibility check do not change your Medicare benefits. Your regular care remains available.", "La revisión y la verificación de elegibilidad no cambian sus beneficios de Medicare. Su cuidado habitual sigue disponible.", "Revizyon enskripsyon an ak chèk kalifikasyon an pa chanje benefis Medicare ou yo. Swen regilye ou rete disponib.") };
  if (/(information|why do you need|información|por qué necesitan|enfòmasyon|poukisa)/i.test(normalized)) return { text: L("We use the requested information to securely verify your identity and determine which care options are available. Your information is protected.", "Usamos la información solicitada para verificar su identidad y determinar qué opciones están disponibles. Su información está protegida.", "Nou itilize enfòmasyon yo mande yo pou verifye idantite ou an sekirite epi detèmine ki opsyon swen ki disponib. Enfòmasyon ou pwoteje.") };
  if (/(next|después|sigue|apre|pwochen)/i.test(normalized)) return { text: assistantScreenExplanation(context.currentScreen) };
  return { text: L("I can explain this screen, your care options, Medicare eligibility, or what happens next. You can also talk with our care team at any time.", "Puedo explicar esta pantalla, sus opciones de cuidado, la elegibilidad de Medicare o qué sigue. También puede hablar con nuestro equipo en cualquier momento.", "Mwen ka eksplike ekran sa a, opsyon swen ou yo, kalifikasyon Medicare, oswa sa k ap pase apre. Ou ka pale tou ak ekip swen nou an nenpòt ki lè.") };
}

async function assistantAnswer(question, context) {
  const affirmative = /^(yes|yes please|please do|sí|si|wi|dakò)$/i.test(question.trim());
  if (affirmative && state.assistantPendingAction) return legacyAssistantActionAnswer(question, context);
  return ensureEmmiRuntime().orchestrator.answer(question);
}

const assistantVoiceCopy = () => {
  const stateCopy = {
    CONNECTING: L("Connecting…", "Conectando…", "N ap konekte…"),
    INTERRUPTING: L("Listening…", "Escuchando…", "N ap koute…"),
    LISTENING: L("Listening…", "Escuchando…", "N ap koute…"),
    USER_SPEAKING: L("Listening…", "Escuchando…", "N ap koute…"),
    EMMI_THINKING: L("EMMI is thinking…", "EMMI está pensando…", "EMMI ap reflechi…"),
    EMMI_SPEAKING: state.assistantVoiceDetail === "patient_response"
      ? L("EMMI is responding…", "EMMI está respondiendo…", "EMMI ap reponn…")
      : L("EMMI is explaining…", "EMMI está explicando…", "EMMI ap eksplike…"),
    TOOL_RUNNING: typeof state.assistantVoiceDetail === "string" && state.assistantVoiceDetail.includes("…") ? state.assistantVoiceDetail : L("Checking your information…", "Revisando su información…", "N ap verifye enfòmasyon ou…"),
    ERROR: L("Voice is unavailable", "La voz no está disponible", "Vwa pa disponib"),
    DISCONNECTED: L("Voice conversation ended", "La conversación por voz terminó", "Konvèsasyon vwa a fini")
  };
  return stateCopy[state.assistantVoiceState] || stateCopy.DISCONNECTED;
};
// One cost sentence per engine explanation code. The assistant never picks the wording from an
// amount it read: an unknown amount is answered as unknown rather than rounded to $0.
const emmiAccessCostAnswer = (result, language) => {
  const gross = `$${result.grossBeneficiaryResponsibility}`;
  const copy = {
    SUPPLEMENTAL_COVERS_COST_SHARE: L(
      "Based on the coverage we verified, your expected payment for ACCESS is $0. Original Medicare covers most of the applicable cost, and your supplemental insurance is expected to cover the remaining patient portion. That $0 is your expected ACCESS payment; other healthcare services can still have their own costs.",
      "Según la cobertura que verificamos, su pago esperado por ACCESS es $0. Medicare Original cubre la mayor parte del costo aplicable y se espera que su seguro suplementario cubra la parte que le corresponde. Ese $0 es su pago esperado por ACCESS; otros servicios de salud pueden tener sus propios costos.",
      "Dapre kouvèti nou verifye a, peman ou prevwa pou ACCESS se $0. Medicare Orijinal kouvri pifò nan depans ki aplikab la, epi nou prevwa asirans siplemantè ou ap kouvri rès pati pa ou a. $0 sa a se peman ACCESS ou prevwa a; lòt sèvis sante ka gen pwòp depans pa yo."),
    NO_SUPPLEMENTAL_COVERAGE: L(
      `Based on the coverage we verified, your expected payment for ACCESS is ${gross} per month for your current track. Medicare covers most of the applicable cost and this is the remaining patient portion.`,
      `Según la cobertura que verificamos, su pago esperado por ACCESS es de ${gross} al mes para su vía actual. Medicare cubre la mayor parte del costo aplicable y esta es la parte que le corresponde.`,
      `Dapre kouvèti nou verifye a, peman ou prevwa pou ACCESS se ${gross} pa mwa pou wout ou kounye a. Medicare kouvri pifò nan depans ki aplikab la epi sa a se rès pati pa ou a.`),
    SUPPLEMENTAL_COVERAGE_UNKNOWN: L(
      `I could not confirm whether your supplemental coverage pays the ACCESS patient portion, so I do not have a final expected payment for you yet. Before that is confirmed, the patient portion for your current track is ${gross} per month. Your care team can check your coverage.`,
      `No pude confirmar si su cobertura suplementaria paga la parte del paciente de ACCESS, así que todavía no tengo un pago esperado definitivo. Antes de confirmarlo, la parte del paciente para su vía actual es de ${gross} al mes. Su equipo de atención puede verificar su cobertura.`,
      `Mwen pa t ka konfime si kouvèti siplemantè ou peye pati pasyan an pou ACCESS, kidonk mwen poko gen yon peman final. Anvan sa konfime, pati pasyan an pou wout ou kounye a se ${gross} pa mwa. Ekip swen ou ka verifye kouvèti ou.`),
    COVERAGE_VERIFICATION_STALE: L(
      "Your coverage was last verified a while ago, so I do not want to give you an amount that may be out of date. Your care team can re-check your coverage and then I can tell you your expected payment.",
      "Su cobertura se verificó hace tiempo, así que prefiero no darle una cantidad que podría estar desactualizada. Su equipo de atención puede verificarla de nuevo y luego podré decirle su pago esperado.",
      "Se gen yon bon tan depi nou te verifye kouvèti ou, kidonk mwen pa vle ba w yon montan ki ka pa ajou. Ekip swen ou ka reverifye kouvèti a epi apre sa mwen ka di w peman ou prevwa a."),
    COVERAGE_NOT_VERIFIED: L(
      "I could not verify your coverage from the information currently available, so I do not have an expected payment to give you yet. Your care team can check this with you.",
      "No pude verificar su cobertura con la información disponible, así que todavía no tengo un pago esperado para darle. Su equipo de atención puede revisarlo con usted.",
      "Mwen pa t ka verifye kouvèti ou ak enfòmasyon ki disponib kounye a, kidonk mwen poko gen yon peman pou m ba w. Ekip swen ou ka tcheke sa avèk ou."),
    QMB_COST_SHARE_RULES: L(
      "Your coverage includes a Qualified Medicare Beneficiary designation, which has its own cost-sharing rules. I do not want to state an amount for you without your care team confirming how those rules apply.",
      "Su cobertura incluye la designación de Beneficiario Calificado de Medicare, que tiene sus propias reglas de costos. Prefiero no indicarle una cantidad sin que su equipo confirme cómo se aplican esas reglas.",
      "Kouvèti ou gen yon deziyasyon Benefisyè Medicare Kalifye, ki gen pwòp règ pa l sou depans. Mwen pa vle bay yon montan san ekip swen ou konfime kijan règ sa yo aplike."),
    MEDICARE_ADVANTAGE_NOT_ELIGIBLE: L(
      "Your coverage shows a Medicare Advantage plan rather than Original Medicare. That affects whether ACCESS is available to you, not just the amount, so your care team needs to review your eligibility before I can talk about a payment.",
      "Su cobertura muestra un plan Medicare Advantage en lugar de Medicare Original. Eso afecta si ACCESS está disponible para usted, no solo la cantidad, así que su equipo debe revisar su elegibilidad antes de que pueda hablar de un pago.",
      "Kouvèti ou montre yon plan Medicare Advantage olye Medicare Orijinal. Sa afekte si ACCESS disponib pou ou, se pa sèlman montan an, kidonk ekip swen ou dwe revize kalifikasyon ou anvan mwen ka pale sou yon peman.")
  }[result.explanationCode];
  return copy || L(
    "I do not have a confirmed expected payment for you right now. Your care team can check your coverage.",
    "Ahora mismo no tengo un pago esperado confirmado. Su equipo de atención puede verificar su cobertura.",
    "Mwen pa gen yon peman konfime kounye a. Ekip swen ou ka verifye kouvèti ou.");
};

const assistantVoiceErrorCopyFor = code => ({
  microphone_denied: L("Microphone access was not allowed. You can continue by typing.", "No se permitió el acceso al micrófono. Puede continuar escribiendo.", "Yo pa t bay aksè ak mikwofòn nan. Ou ka kontinye ekri."),
  rate_limited: L("EMMI voice is temporarily busy. You can continue by typing.", "La voz de EMMI está ocupada temporalmente. Puede continuar escribiendo.", "Vwa EMMI okipe pou kounye a. Ou ka kontinye ekri."),
  gemini_not_configured: L("Voice is not configured for this prototype. You can continue by typing.", "La voz no está configurada para este prototipo. Puede continuar escribiendo.", "Vwa pa konfigire pou pwototip sa a. Ou ka kontinye ekri."),
  VOICE_UNAVAILABLE_ON_DEVICE: L("Voice isn’t available on this device right now. You can continue by typing.", "La voz no está disponible en este dispositivo por ahora. Puede continuar escribiendo.", "Vwa a pa disponib sou aparèy sa a kounye a. Ou ka kontinye ekri."),
  voice_disabled: L("Voice assistance is turned off. You can continue by typing.", "La asistencia por voz está desactivada. Puede continuar escribiendo.", "Asistans vwa etenn. Ou ka kontinye ekri."),
  voice_locale_fallback: L("Voice guidance isn’t available in this language yet. You can still chat with EMMI in Kreyòl.", "La guía por voz aún no está disponible en este idioma. Puede seguir conversando con EMMI en criollo haitiano.", "Gid vwa poko disponib nan lang sa a. Ou ka toujou pale ak EMMI alekri an Kreyòl."),
  VOICE_UNAVAILABLE_FOR_LOCALE: L("Voice guidance isn’t available in this language yet. You can still chat with EMMI in Kreyòl.", "La guía por voz aún no está disponible en este idioma. Puede seguir conversando con EMMI en criollo haitiano.", "Gid vwa a pa disponib nan lang sa a kounye a. Ou ka kontinye itilize EMMI pa mesaj."),
  VOICE_SESSION_FAILED: L("The voice session could not start. You can continue by typing.", "No se pudo iniciar la sesión de voz. Puede continuar escribiendo.", "Sesyon vwa a pa t kapab kòmanse. Ou ka kontinye ekri."),
  VOICE_PROVIDER_ERROR: L("EMMI voice is temporarily unavailable. You can continue by typing.", "La voz de EMMI no está disponible temporalmente. Puede continuar escribiendo.", "Vwa EMMI pa disponib pou kounye a. Ou ka kontinye ekri."),
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
    : `This is conversation mode ${continuity?.conversationMode || "CONTINUATION"}. Do not greet, reintroduce yourself, or restart. Continue naturally from ${continuity?.previousScreen || "the prior context"} to ${continuity?.currentScreen || state.screen}.`;
  return L(
    `${rule} Say the following in a calm, warm, unhurried voice, as the patient's continuing care guide. Keep the meaning and reassurance intact, use natural spoken English, and add no facts: ${guarded}`,
    `${rule} Diga lo siguiente con una voz tranquila, cálida y sin prisa, como la guía de cuidado que continúa acompañando al paciente. No salude ni se presente otra vez salvo que la regla anterior lo permita. Conserve el significado y no agregue datos: ${guarded}`,
    `${rule} Di sa ki annapre a avèk yon vwa kalm, cho e san prese, tankou gid swen ki kontinye ak pasyan an. Pa salye ni prezante tèt ou ankò sof si règ anlè a pèmèt sa. Kenbe sans lan epi pa ajoute enfòmasyon: ${guarded}`
  );
};

// EMMI is introduced on the Home screen. Everywhere after it, this is a compact contextual
// control that must not compete with the screen's own question.
// After Home, EMMI is a contextual guide rather than an introduction card: identity and live
// status stay visible, one contextual action remains direct, and secondary controls expand
// only on request. The task stays the visual priority.
function emmiGuideState() {
  if (!state.emmiVoiceGuidance) return "OFF";
  if (!emmiVoiceIsSupported(languageCode())) return "UNSUPPORTED";
  if (state.assistantVoiceState === "ERROR" || (state.assistantVoiceState === "DISCONNECTED" && state.assistantVoiceError)) return "ERROR";
  if (state.emmiVoiceGuidancePaused) return "PAUSED";
  if (state.emmiTransitionStatus === "UPDATING") return "UPDATING";
  if (state.assistantVoiceState === "EMMI_SPEAKING") return "SPEAKING";
  if (["INTERRUPTING", "USER_SPEAKING"].includes(state.assistantVoiceState)) return "LISTENING";
  if (["CONNECTING", "EMMI_THINKING", "TOOL_RUNNING"].includes(state.assistantVoiceState)) return "THINKING";
  return "ACTIVE_IDLE";
}

const emmiGuideStatusLabel = guideState => ({
  OFF: L("Need help?", "¿Necesita ayuda?", "Bezwen èd?"),
  UNSUPPORTED: L("Voice guidance is unavailable in this language", "La guía por voz no está disponible en este idioma", "Gid vwa a pa disponib nan lang sa a"),
  SPEAKING: state.assistantVoiceDetail === "patient_response"
    ? L("EMMI is responding…", "EMMI está respondiendo…", "EMMI ap reponn…")
    : L("EMMI is speaking…", "EMMI está hablando…", "EMMI ap pale…"),
  LISTENING: L("Listening…", "Escuchando…", "M ap koute…"),
  THINKING: L("Thinking…", "Pensando…", "M ap reflechi…"),
  UPDATING: L("Thinking…", "Pensando…", "M ap reflechi…"),
  PAUSED: L("Voice guidance is paused", "La guía por voz está en pausa", "Gid vwa a an poz"),
  ERROR: L("Voice guidance is temporarily unavailable", "La guía por voz no está disponible por ahora", "Gid vwa a pa disponib pou kounye a")
})[guideState] || L("Voice guidance is on", "La guía por voz está activa", "Gid vwa a limen");

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
const emmiFloatingStatus = () => ({
  LISTENING: L("Listening…", "Escuchando…", "M ap koute…"),
  SPEAKING: L("Speaking…", "Hablando…", "L ap pale…"),
  THINKING: L("Thinking…", "Pensando…", "M ap reflechi…"),
  UPDATING: L("Thinking…", "Pensando…", "M ap reflechi…")
})[emmiGuideState()] || "";

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
  manager.speak({ narrationText: message, segments: semanticSpeechSegments(message) }, { connect, kind: "SCREEN_GUIDANCE", screenId: screen, contextVersion: manager.contextVersion });
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

function scheduleEmmiHesitationSupport() {
  clearTimeout(emmiHesitationTimer);
  emmiHesitationCleanup?.();
  emmiHesitationCleanup = null;
  state.emmiContextualNudgeVisible = false;
  const important = ["PERSONAL_REPRESENTATIVE_DETAILS", "REPRESENTATIVE_MOBILE_VERIFICATION", "REPRESENTATIVE_AUTHORITY_ATTESTATION", "ACCESS_PRE_ELIGIBILITY_NOTICE", "ACCESS_MEDICARE_IDENTIFIER", "ACCESS_ELIGIBILITY_RESULT", "CONSENT_REVIEW", "ACCESS_BP_DEVICE_VERIFICATION", "ACCESS_BP_DEVICE_RESULT", "ACCESS_BP_DEVICE_INFO", "ACCESS_BP_GUIDED_SETUP", "ACCESS_BP_MEASUREMENT"];
  if (!important.includes(state.screen) || state.assistantOpen) return;
  const showNudge = () => {
    if (state.assistantOpen) return;
    state.emmiContextualNudgeVisible = true;
    const bot = document.querySelector(".emmi-assistant");
    if (bot && !document.querySelector(".emmi-contextual-nudge")) bot.insertAdjacentHTML("beforebegin", emmiAssistant().split('<button class="emmi-assistant"')[0]);
    document.querySelector(".emmi-contextual-nudge")?.addEventListener("click", showHelp);
    emmiHesitationCleanup?.();
    emmiHesitationCleanup = null;
  };
  const armTimer = () => { clearTimeout(emmiHesitationTimer); emmiHesitationTimer = setTimeout(showNudge, 25000); };
  const activityEvents = ["pointerdown", "keydown", "input"];
  activityEvents.forEach(type => app.addEventListener(type, armTimer));
  emmiHesitationCleanup = () => activityEvents.forEach(type => app.removeEventListener(type, armTimer));
  armTimer();
}

// The expanded panel is EMMI in full, opened over the screen the patient is already on. It is a
// presentation of the same assistant — same session, same voice, same conversation — never a
// place the patient travelled to, so it greets nobody and closing it changes nothing.
const assistantHeroCopy = screen => ({
  MY_GOALS: L("Ask me about your goals, your readings, or what to do next.", "Pregúnteme sobre sus metas, sus lecturas o el siguiente paso.", "Mande m sou objektif ou, lekti ou yo, oswa pwochen etap la."),
  GOALS: L("Ask me about your goals, your readings, or what to do next.", "Pregúnteme sobre sus metas, sus lecturas o el siguiente paso.", "Mande m sou objektif ou, lekti ou yo, oswa pwochen etap la."),
  MEDICATIONS_REVIEW: L("Ask me about your medications or this review.", "Pregúnteme sobre sus medicamentos o esta revisión.", "Mande m sou medikaman ou yo oswa revizyon sa a."),
  HEALTH_INFORMATION_REVIEW: L("Ask me about your health information or this review.", "Pregúnteme sobre su información de salud o esta revisión.", "Mande m sou enfòmasyon sante ou oswa revizyon sa a."),
  MY_CARE: L("Ask me anything about your care.", "Pregúnteme lo que quiera sobre su cuidado.", "Mande m nenpòt bagay sou swen ou."),
  ENROLLMENT_CONFIRMED: L("Ask me anything about your care and what happens next.", "Pregúnteme sobre su cuidado y lo que sigue.", "Mande m sou swen ou ak sa k ap vini apre.")
})[screen] || L("Ask me anything about your enrollment or care.", "Pregúnteme sobre su inscripción o cuidado.", "Mande m nenpòt bagay sou enskripsyon oswa swen ou.");

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
  const detail = state.assistantVoiceDetail === "session_ending_soon"
    ? L("This voice session will end soon, but your enrollment progress is saved.", "Esta sesión terminará pronto, pero su progreso está guardado.", "Sesyon vwa sa a pral fini byento, men pwogrè ou anrejistre.")
    : L("Speak naturally. You can interrupt EMMI.", "Hable con naturalidad. Puede interrumpir a EMMI.", "Pale nòmalman. Ou ka entèwonp EMMI.");
  return `<section class="assistant-voice-state" data-voice-state="${state.assistantVoiceState}">
      <div class="assistant-voice-state-row"><span class="assistant-voice-orb">${icon(state.assistantVoiceMuted ? "micOff" : "mic")}</span><div><strong role="status" aria-live="polite">${live ? assistantVoiceCopy() : emmiGuideStatusLabel(guideState)}</strong><small>${detail}</small></div></div>
      <button type="button" class="assistant-voice-options-toggle" data-assistant-action="voice-options" aria-expanded="${state.assistantVoiceOptionsOpen}" aria-controls="assistant-voice-options">${icon("audioLines")}<span>${labels.voiceOptions}</span></button>
      ${state.assistantVoiceOptionsOpen ? `<div class="assistant-voice-options" id="assistant-voice-options">${emmiVoiceOptionRows(guideState, { includeMute: live })}</div>` : ""}
    </section>`;
}

function assistantLayer() {
  const context = assistantContext();
  const quickQuestions = assistantQuickQuestions(context);
  const labels = emmiLabels();
  const guideState = emmiGuideState();
  const messages = state.assistantMessages.map(message => `<div class="assistant-message ${message.role}"><strong>${message.role === "user" ? L("You", "Usted", "Ou") : "EMMI"}</strong><p>${escapeHtml(message.text)}</p>${message.emergency ? `<a class="assistant-emergency-action" href="tel:911">${icon("phone")}<span>${L("Call 911", "Llamar al 911", "Rele 911")}</span></a>` : ""}${message.quickAction ? `<button type="button" class="assistant-message-action" data-assistant-growth="${message.quickAction}">${message.quickAction === "care-circle" ? L("Invite someone to help", "Invitar a alguien para ayudar", "Envite yon moun pou ede") : L("Share ACCESS", "Compartir ACCESS", "Pataje ACCESS")}</button>` : ""}</div>`).join("")
    + (state.assistantBusy ? `<div class="assistant-message assistant assistant-thinking" role="status"><strong>EMMI</strong><p>${L("EMMI is thinking…", "EMMI está pensando…", "EMMI ap reflechi…")}</p></div>` : "");
  const commonQuestions = context.currentScreen === "ACCESS_ELIGIBILITY_RESULT" && state.accessOutcome === "notEligible"
    ? [L("Why can’t I continue?", "¿Por qué no puedo continuar?", "Poukisa mwen pa ka kontinye?"), L("Does this affect my Medicare?", "¿Esto afecta mi Medicare?", "Èske sa afekte Medicare mwen an?"), L("Can I still see my doctors?", "¿Puedo seguir viendo a mis médicos?", "Èske mwen ka toujou wè doktè mwen yo?"), L("Are there other care options?", "¿Hay otras opciones de cuidado?", "Èske gen lòt opsyon swen?")]
    : [L("Is participation voluntary?", "¿La participación es voluntaria?", "Èske patisipasyon volontè?"), L("Will I keep my doctor?", "¿Conservaré a mi médico?", "Èske mwen pral kenbe doktè mwen an?"), L("Will this affect my Medicare?", "¿Esto afectará mi Medicare?", "Èske sa ap afekte Medicare mwen an?")];
  // EMMI has already introduced herself on Home. Reopening her later continues that conversation,
  // so the hero asks what the patient needs instead of saying hello a second time.
  const assistantTitle = emmiConversationManager?.contextForModel().hasGreeted || state.emmiWelcomeAcknowledged || state.emmiIntroSeen
    ? L("How can I help?", "¿Cómo puedo ayudarle?", "Kijan mwen ka ede w?")
    : L("Hi, I’m EMMI. How can I help?", "Hola, soy EMMI. ¿Cómo puedo ayudar?", "Bonjou, mwen se EMMI. Kijan mwen ka ede?");
  return `<aside class="assistant-layer" role="dialog" aria-modal="true" aria-label="${L("EMMI – Your ITERA Care Assistant", "EMMI – Su Asistente de cuidado de ITERA", "EMMI – Asistan swen ITERA ou")}">
    <header class="assistant-header"><div class="assistant-identity"><strong>EMMI</strong><small>${L("Your ITERA Care Assistant", "Su Asistente de cuidado de ITERA", "Asistan swen ITERA ou")}</small></div><button class="language" data-assistant-action="language" aria-label="${languageActionLabel()}">${icon("language")} ${languageCode()}</button><button class="assistant-close" data-assistant-action="close" aria-label="${labels.closeEmmi}">×</button></header>
    <div class="assistant-content"><div class="assistant-intro"><img src="/assets/emmi-assistant.png" alt=""><div><h1 id="assistant-title" tabindex="-1">${assistantTitle}</h1><p>${assistantHeroCopy(context.currentScreen)}</p></div></div>
      ${assistantVoiceEntry(guideState)}
      ${state.assistantVoiceError && emmiVoiceIsSupported(languageCode()) ? `<div class="assistant-voice-error" role="status">${icon("info")}<span>${assistantVoiceErrorCopy()}</span></div>` : ""}
      ${EMMI_CONFIG.enableText ? `<form class="assistant-question-form"><label class="sr-only" for="assistant-question">${L("Ask a question", "Haga una pregunta", "Poze yon kesyon")}</label><input id="assistant-question" name="question" type="text" autocomplete="off" placeholder="${L("Ask a question…", "Haga una pregunta…", "Poze yon kesyon…")}" ${state.assistantBusy ? "disabled" : ""}><button type="submit" aria-label="${L("Send question", "Enviar pregunta", "Voye kesyon")}" ${state.assistantBusy ? "disabled" : ""}>${icon("arrowRight")}</button></form>` : ""}
      ${messages ? `<section class="assistant-conversation" aria-live="polite">${messages}</section>` : ""}
      ${state.assistantError ? `<section class="assistant-error" role="alert"><p>${L("I’m having trouble connecting right now.", "Estoy teniendo problemas de conexión en este momento.", "Mwen gen pwoblèm pou m konekte kounye a.")}</p><div class="assistant-error-actions"><button type="button" data-assistant-action="retry">${icon("rotate")}<span>${labels.retry}</span></button><a href="tel:+13053948070" data-assistant-action="human-support">${icon("phone")}<span>${L("Talk to our care team", "Hable con nuestro equipo", "Pale ak ekip swen nou an")}</span></a></div></section>` : ""}
      ${EMMI_CONFIG.enableText ? `<section class="assistant-quick"><h2>${L("Quick questions", "Preguntas rápidas", "Kesyon rapid")}</h2><div>${quickQuestions.map(question => `<button type="button" data-assistant-question="${escapeHtml(question.label)}" data-question-id="${question.id}" data-question-intent="${question.intent}">${escapeHtml(question.label)}</button>`).join("")}</div></section>
      <button class="assistant-faq-toggle" type="button" data-assistant-action="faq" aria-expanded="${state.assistantFaqOpen}">${L("Browse common questions", "Ver preguntas comunes", "Gade kesyon komen")} ${icon("chevronRight")}</button>
      ${state.assistantFaqOpen ? `<section class="assistant-common-questions">${commonQuestions.map(question => `<button type="button" data-assistant-question="${escapeHtml(question)}" data-question-id="common-question">${question}</button>`).join("")}</section>` : ""}` : ""}
      <section class="assistant-human-support"><h2>${L("Prefer to talk with someone?", "¿Prefiere hablar con alguien?", "Ou prefere pale ak yon moun?")}</h2><a class="assistant-support-action" href="tel:+13053948070" data-assistant-action="human-support">${icon("phone")}<span><strong>${L("Talk to our care team", "Hable con nuestro equipo", "Pale ak ekip swen nou an")}</strong><small>${L("Call", "Llame al", "Rele")} ${state.offer.participantProvider.supportPhone}</small></span></a><button class="assistant-support-action" type="button" data-assistant-action="callback">${icon("phone")}<span><strong>${L("Have someone call me", "Quiero que alguien me llame", "Mande yon moun rele m")}</strong><small>${L("EMMI will confirm before sending the request", "EMMI confirmará antes de enviar la solicitud", "EMMI ap konfime anvan li voye demann lan")}</small></span></button></section>
      <p class="emmi-disclaimer">${icon("info")}<span>${L("EMMI is an AI assistant, not a clinician. For medical emergencies, call 911.", "EMMI es una asistente de IA, no una profesional clínica. Para emergencias médicas, llame al 911.", "EMMI se yon asistan IA, li pa yon pwofesyonèl klinik. Pou ijans medikal, rele 911.")}</span></p>
      <button class="button secondary assistant-back" type="button" data-assistant-action="close">${icon("arrowLeft", "button-icon")} ${labels.closeEmmi}</button>
    </div></aside>`;
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

function accessCostSummary(accessCost = {}) {
  const amount = Number.isFinite(Number(accessCost.expectedMonthlyAmount)) ? Number(accessCost.expectedMonthlyAmount) : 6;
  const monthlyShare = `$${amount}`;
  const status = accessCost.secondaryCoverageStatus || "SECONDARY_NOT_VERIFIED";
  if (status === "SECONDARY_COVERAGE_VERIFIED") return {
    amountLabel: L("Estimated out-of-pocket cost: $0", "Costo de bolsillo estimado: $0", "Depans estime nan pòch ou: $0"),
    supportingCopy: L("Expected beneficiary payment amount: $0 per month. Your Medicare and verified supplemental coverage are expected to cover this ACCESS cost.", "Monto de pago esperado del beneficiario: $0 al mes. Se espera que Medicare y su cobertura suplementaria verificada cubran este costo de ACCESS.", "Montan peman benefisyè a prevwa: $0 pa mwa. Yo prevwa Medicare ak kouvèti siplemantè verifye ou ap kouvri depans ACCESS sa a."),
    fullDetails: L("Your supplemental coverage was verified for this estimate. Coverage can change, and you can review updated information before future charges.", "Su cobertura suplementaria fue verificada para este cálculo. La cobertura puede cambiar y puede revisar información actualizada antes de cargos futuros.", "Yo verifye kouvèti siplemantè ou pou estimasyon sa a. Kouvèti ka chanje, epi ou ka revize enfòmasyon ajou anvan depans alavni.")
  };
  if (status === "SECONDARY_PRESENT_NOT_CONFIRMED") return {
    amountLabel: L(`Up to ${monthlyShare} per month`, `Hasta ${monthlyShare} al mes`, `Jiska ${monthlyShare} pa mwa`),
    supportingCopy: L(`Expected beneficiary payment amount: up to ${monthlyShare} per month. Medicare covers most of the cost of this care. Your supplemental coverage may reduce this amount.`, `Monto de pago esperado del beneficiario: hasta ${monthlyShare} al mes. Medicare cubre la mayor parte del costo de este cuidado. Su cobertura suplementaria puede reducir este monto.`, `Montan peman benefisyè a prevwa: jiska ${monthlyShare} pa mwa. Medicare kouvri pifò nan depans swen sa a. Kouvèti siplemantè ou ka diminye montan sa a.`),
    fullDetails: L("We have not yet confirmed what your supplemental insurance will pay. Your expected monthly share will not be more than the amount shown here.", "Aún no hemos confirmado cuánto pagará su seguro suplementario. No se espera que su parte mensual supere el monto mostrado aquí.", "Nou poko konfime konbyen asirans siplemantè ou ap peye. Yo pa prevwa pati pa mwa ou ap depase montan ki montre isit la.")
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
  if (state.offer.pathway === "ACCESS") {
    const representative = representativeRole;
    const intro = L("Review the information below before choosing whether to enroll.", "Revise la información a continuación antes de decidir si desea inscribirse.", "Revize enfòmasyon ki anba yo anvan ou chwazi si w ap enskri.");
    const config = state.offer.disclosures?.accessConfig || {};
    const cost = accessCostSummary(state.offer.accessCost || config.accessCost);
    const summaryRows = [
      ["people", L("Participation is voluntary", "La participación es voluntaria", "Patisipasyon an volontè."), L("You choose whether to enroll in ACCESS.", "Usted decide si desea inscribirse en ACCESS.", "Se ou ki chwazi si w ap enskri nan ACCESS.")],
      ["shield", L("Your Medicare benefits stay the same", "Sus beneficios de Medicare permanecen iguales", "Benefis Medicare ou yo rete menm jan an"), L("Your Medicare benefits, coverage, and rights do not change.", "Sus beneficios, cobertura y derechos de Medicare no cambian.", "Avantaj, pwoteksyon, ak dwa Medicare ou yo pa chanje.")],
      ["info", L("Your ACCESS cost", "Su costo de ACCESS", "Depans ACCESS ou"), cost.supportingCopy, "cost"],
      ["doctor", L("One ACCESS provider for this type of care", "Un proveedor ACCESS para este tipo de cuidado", "Yon founisè ACCESS pou kalite swen sa a"), L("You can have one ACCESS provider for this type of care at a time.", "Puede tener un proveedor ACCESS para este tipo de cuidado a la vez.", "Ou ka gen yon sèl founisè ACCESS pou kalite swen sa a alafwa.")],
      ["clock", L("Changing or ending ACCESS care", "Cambiar o finalizar el cuidado ACCESS", "Chanje oswa mete fen nan swen ACCESS"), L("Starting 90 days after enrollment, you may leave ACCESS or switch to another participating provider.", "A partir de 90 días después de la inscripción, puede dejar ACCESS o cambiar a otro proveedor participante.", "Apati 90 jou apre enskripsyon an, ou ka kite ACCESS oswa chanje pou yon lòt founisè ki patisipe.")]
    ];
    if (config.showClaimsSharing) summaryRows.push(["document", L("Medicare claims information", "Información de reclamaciones de Medicare", "Enfòmasyon sou reklamasyon Medicare"), L("Medicare may share claims information with ITERA HEALTH to help coordinate your ACCESS care.", "Medicare puede compartir información de reclamaciones con ITERA HEALTH para ayudar a coordinar su cuidado ACCESS.", "Medicare ka pataje enfòmasyon sou reklamasyon avèk ITERA HEALTH pou ede kowòdone swen ACCESS ou.")]);
    if (config.showTempoDisclosure) summaryRows.push(["device", L("Connected device information", "Información del dispositivo conectado", "Enfòmasyon sou aparèy ki konekte"), config.tempoDisclosureText ? offerText(config.tempoDisclosureText) : L("A connected device may be used to support your ACCESS care. Your care team will explain what is required.", "Puede utilizarse un dispositivo conectado para apoyar su cuidado ACCESS. Su equipo le explicará lo necesario.", "Yo ka itilize yon aparèy konekte pou sipòte swen ACCESS ou. Ekip swen ou pral eksplike sa ki nesesè.")]);
    const authorityAttestation = representative ? check("authority", L("I confirm that I’m authorized to make healthcare decisions for the patient.", "Confirmo que estoy autorizado para tomar decisiones médicas por el paciente.", "Mwen konfime ke mwen otorize pou pran desizyon swen sante pou pasyan an.")) : "";
    const agreement = representative
      ? L("I agree, on behalf of the patient, to enroll the patient in ACCESS with ITERA HEALTH.", "Acepto, en nombre del paciente, inscribir al paciente en ACCESS con ITERA HEALTH.", "Mwen dakò, nan non pasyan an, pou enskri pasyan an nan ACCESS avèk ITERA HEALTH.")
      : L("I agree to enroll in ACCESS with ITERA HEALTH.", "Acepto inscribirme en ACCESS con ITERA HEALTH.", "Mwen dakò pou enskri nan ACCESS avèk ITERA HEALTH.");
    return `${titleBlock(L("Review and agree", "Revise y acepte", "Revize epi dakò"), intro)}
      <section class="consent-summary access-consent-summary">${summaryRows.map(([rowIcon, headline, copy, rowType]) => `<div class="consent-disclosure-row ${rowType === "cost" ? "access-cost-row" : ""}">${icon(rowIcon)}<div><strong>${headline}</strong><p>${copy}</p></div></div>`).join("")}</section>
      <details class="full-terms access-consent-terms"><summary>${L("View full ACCESS information", "Ver información completa de ACCESS", "Gade tout enfòmasyon ACCESS yo")} ${icon("externalLink")}</summary><div class="access-full-content">${accessFullDisclosure(cost, config)}</div></details>
      <p class="signer-role"><strong>${L("Signing as", "Firmando como", "Siyen kòm")}:</strong> ${role}</p>
      <form id="consent-form">${authorityAttestation}${check("consent", L("I have reviewed this important information.", "He revisado esta información importante.", "Mwen te revize enfòmasyon enpòtan sa a."))}${check("enroll", agreement)}</form>
      <p class="form-error" role="alert">${state.error}</p>${actions(state.busy ? L("Saving…", "Guardando…", "Ekonomize...") : L("Agree and continue", "Aceptar y continuar", "Dakò epi kontinye"), true, "", true)}`;
  }
  const traditionalRepresentative = representativeRole;
  const traditionalIntro = traditionalRepresentative
    ? L(`I agree, on behalf of the patient, to enroll the patient in this recommended care with ITERA HEALTH, in coordination with ${physicianDisplayName()}.`, `Acepto, en nombre del paciente, inscribir al paciente en este cuidado recomendado con ITERA HEALTH, en coordinación con ${physicianDisplayName()}.`, `Mwen dakò, nan non pasyan an, pou enskri pasyan an nan swen rekòmande sa a avèk ITERA HEALTH, an kowòdinasyon avèk ${physicianDisplayName()}.`)
    : L(`I want to receive this recommended care from ITERA HEALTH, in coordination with ${physicianDisplayName()}.`, `Deseo recibir este cuidado recomendado de ITERA HEALTH, en coordinación con ${physicianDisplayName()}.`, `Mwen vle resevwa swen rekòmande sa a nan ITERA HEALTH, an kowòdinasyon avèk ${physicianDisplayName()}.`);
  const traditionalAuthority = traditionalRepresentative ? check("authority", L("I confirm that I’m authorized to make healthcare decisions for the patient.", "Confirmo que estoy autorizado para tomar decisiones médicas por el paciente.", "Mwen konfime ke mwen otorize pou pran desizyon swen sante pou pasyan an.")) : "";
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
    <form id="consent-form">${traditionalAuthority}${check("consent", localized(IMPORTANT_INFORMATION_COPY.acknowledgement))}${check("enroll", traditionalAgreement)}</form>
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
      title: { en: "Connected with your doctor", es: "Conectado con su médico", ht: "Konekte ak doktè ou" },
      description: {
        en: `ITERA HEALTH works with ${confirmedPhysicianName} to help keep your care coordinated.`,
        es: `ITERA HEALTH trabaja con ${confirmedPhysicianName} para ayudar a mantener su cuidado coordinado.`,
        ht: `ITERA HEALTH travay avèk ${confirmedPhysicianName} pou ede kenbe swen ou kowòdone.`
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
  const nextSteps = welcome.nextSteps.map((step, index) => [stepIcons[index], localized(step).replace("{careTeamContactWindow}", contactWindow).trim(), ""]);
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

function myCareScreen() {
  const transition = currentFlowTransition();
  const progress = gettingStartedProgress();
  const started = progress.status === FLOW_STATUS.IN_PROGRESS;
  const actionLabel = started ? L("Continue where you left off", "Continuar donde lo dejó", "Kontinye kote ou te rete a") : L("Continue setting up your care", "Continuar configurando su cuidado", "Kontinye mete swen ou an plas");
  return `<div class="my-care-screen">${titleBlock(L("My Care", "Mi cuidado", "Swen mwen"), L("Your enrollment is complete. Continue when you’re ready.", "Su inscripción está completa. Continúe cuando esté listo.", "Enskripsyon ou fini. Kontinye lè ou pare."))}
    <section class="my-care-resume-card"><div>${icon("check")}<span><strong>${L("Getting Started", "Primeros pasos", "Premye etap yo")}</strong><small>${started ? L("In progress", "En curso", "An pwogrè") : L("Not finished yet", "Aún no terminado", "Poko fini")}</small></span></div>${transition.estimatedDuration ? `<p>${icon("clock")} ${localized(transition.estimatedDuration)}</p>` : ""}${cta(actionLabel, "resume-next-flow")}</section>
    <button type="button" class="link-card my-goals-link" data-action="open-my-goals">${icon("goals")}<span><strong>${L("My Goals", "Mis metas", "Objektif mwen")}</strong><small>${activePatientGoals().length ? L("View the goals you’re working toward", "Vea las metas en las que está trabajando", "Gade objektif w ap travay sou yo") : L("Choose what matters to you", "Elija lo que le importa", "Chwazi sa ki enpòtan pou ou")}</small></span><b aria-hidden="true">›</b></button>
    <button type="button" class="link-card my-care-circle-link" data-action="open-my-care-circle">${icon("people")}<span><strong>${L("My Care Circle", "Mi Círculo de cuidado", "Sèk swen mwen")}</strong><small>${L("Invite or manage someone you trust", "Invite o administre a alguien de confianza", "Envite oswa jere yon moun ou fè konfyans")}</small></span><b aria-hidden="true">›</b></button>
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

function accessNotice() {
  const noticeRows = [
    ["lock", L("ACCESS evaluation and data sharing", "Evaluación de ACCESS e intercambio de datos", "Evalyasyon ACCESS ak pataj enfòmasyon"), L("CMS is evaluating ACCESS. ITERA may securely share health information with CMS, and CMS may request information for this evaluation.", "CMS está evaluando ACCESS. ITERA puede compartir información médica de forma segura con CMS, y CMS puede solicitar información para esta evaluación.", "CMS ap evalye ACCESS. ITERA ka pataje enfòmasyon sante avèk CMS an sekirite, epi CMS ka mande enfòmasyon pou evalyasyon sa a.")],
    ["document", L("How CMS evaluates ACCESS", "Cómo evalúa CMS a ACCESS", "Kijan CMS evalye ACCESS"), L("As part of CMS’s evaluation of ACCESS, a small number of people may be randomly assigned to a comparison group. If selected, you would not be able to enroll in ACCESS for 12 months.", "Como parte de la evaluación de ACCESS por parte de CMS, una pequeña cantidad de personas puede ser asignada aleatoriamente a un grupo de comparación. Si le seleccionan, no podrá inscribirse en ACCESS durante 12 meses.", "Nan kad evalyasyon CMS ap fè sou ACCESS, yo ka chwazi yon ti kantite moun o aza pou mete yo nan yon gwoup konparezon. Si yo chwazi ou, ou pa ta kapab enskri nan ACCESS pandan 12 mwa.")],
    ["shield", L("Your Medicare stays the same", "Su Medicare permanece igual", "Medicare ou rete menm jan an"), L("This eligibility check and any comparison group assignment do not change your Medicare benefits, coverage, or rights.", "Esta verificación de elegibilidad y cualquier asignación a un grupo de comparación no cambian sus beneficios, cobertura ni derechos de Medicare.", "Verifikasyon kalifikasyon sa a ak nenpòt plasman nan yon gwoup konparezon pa chanje benefis, kouvèti oswa dwa Medicare ou.")]
  ];
  return `${titleBlock(L("Before Medicare checks your eligibility", "Antes de que Medicare verifique su elegibilidad", "Anvan Medicare verifye kalifikasyon ou"), L("Please review these important details about the ACCESS evaluation.", "Revise estos detalles importantes sobre la evaluación de ACCESS.", "Tanpri revize detay enpòtan sa yo sou evalyasyon ACCESS la."))}
    <section class="access-precheck-list">${noticeRows.map(([rowIcon, headline, copy]) => `<div class="access-precheck-row">${icon(rowIcon)}<div><strong>${headline}</strong><p>${copy}</p></div></div>`).join("")}</section>
    ${check("accessNotice", L("I understand and want Medicare to check my eligibility", "Entiendo y deseo que Medicare verifique mi elegibilidad", "Mwen konprann epi mwen vle Medicare verifye kalifikasyon mwen"))}<p class="form-error" role="alert">${state.error}</p>${actions(L("Check my eligibility", "Verificar mi elegibilidad", "Tcheke kalifikasyon mwen"), true, "", true)}`;
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
    <form id="mbi-form"><label class="field"><span>${L("Medicare number", "Número de Medicare", "Nimewo Medicare")}</span><input name="mbi" type="text" autocomplete="off" maxlength="11" placeholder="${L("From your Medicare card", "De su tarjeta de Medicare", "Sou kat Medicare ou")}" aria-describedby="mbi-note"></label><p id="mbi-note" class="security">${icon("lock")} ${L("For this demo, the full number is validated in memory and is never saved locally.", "En esta demostración, el número se valida en memoria y nunca se guarda localmente.", "Pou demonstrasyon sa a, yo verifye nimewo konplè a nan memwa epi yo pa janm anrejistre li sou aparèy la.")}</p></form>
    <button class="link-card" data-action="help">${icon("question")}<span><strong>${L("I don’t have my card", "No tengo mi tarjeta", "Mwen pa gen kat mwen an")}</strong><small>${L("Get help another way", "Obtenga ayuda de otra forma", "Jwenn èd yon lòt fason")}</small></span><b>›</b></button><p class="form-error" role="alert">${state.error}</p>${actions(t().continue)}`;
}

function eligibilityResult() {
  const outcome = state.accessOutcome;
  if (outcome === "notEligible") return `<div class="access-not-eligible-screen">${art("info")}${titleBlock(L("This ACCESS care option isn’t available to you right now", "Esta opción de cuidado ACCESS no está disponible para usted en este momento", "Opsyon swen ACCESS sa a pa disponib pou ou kounye a"), L("Based on the Medicare eligibility check, you can’t continue with ACCESS enrollment at this time.", "Según la verificación de elegibilidad de Medicare, no puede continuar con la inscripción en ACCESS en este momento.", "Dapre verifikasyon kalifikasyon Medicare la, ou pa ka kontinye ak enskripsyon ACCESS kounye a."))}<section class="next-card"><h2>${L("What can I do?", "¿Qué puedo hacer?", "Kisa mwen ka fè?")}</h2>${rows([["phone", L("Talk with our care team", "Hable con nuestro equipo de cuidado", "Pale ak ekip swen nou an"), L("We can answer questions and review other care support that may be available.", "Podemos responder sus preguntas y revisar otro apoyo de cuidado que pudiera estar disponible.", "Nou ka reponn kesyon epi revize lòt sipò swen ki ka disponib.")], ["clock", L("Request a callback", "Solicite una llamada", "Mande pou yo rele w"), L("A care team member can contact you to discuss your questions.", "Un miembro del equipo puede contactarle para hablar sobre sus preguntas.", "Yon manm ekip swen an ka kontakte w pou pale sou kesyon ou yo.")]])}</section><div class="actions">${cta(L("Return to start", "Volver al inicio", "Retounen nan kòmansman"), "restart", true)}${cta(L("Talk with our care team", "Hable con nuestro equipo", "Pale ak ekip swen nou an"), "help")}</div></div>`;
  const results = {
    eligible: ["check", L("You’re eligible to continue", "Puede continuar", "Ou kalifye pou kontinye"), L("You’re eligible to continue with this ACCESS care option. Your enrollment is not complete yet.", "Puede continuar con esta opción de cuidado ACCESS. Su inscripción aún no está completa.", "Ou kalifye pou kontinye ak opsyon swen ACCESS sa a. Enskripsyon ou poko fini."), L("Continue", "Continuar", "Kontinye")],
    control: ["info", L("Medicare placed you in a comparison group", "Medicare le asignó a un grupo de comparación", "Medicare mete w nan yon gwoup konparezon"), L("You will keep all Medicare benefits and may continue care with your usual doctors. ITERA cannot provide this ACCESS service during the configured comparison period.", "Conservará todos sus beneficios y puede continuar con sus médicos habituales. ITERA no puede brindar este servicio ACCESS durante el período configurado.", "W ap kenbe tout benefis Medicare ou yo epi ou ka kontinye resevwa swen nan men doktè ou abitye yo. ITERA pa ka bay sèvis ACCESS sa a pandan peryòd konparezon ki fikse a."), L("Finish", "Finalizar", "Fini")],
    alreadyAligned: ["info", L("An existing ACCESS relationship was found", "Encontramos una relación ACCESS existente", "Nou jwenn yon relasyon ACCESS ki deja egziste"), L("We need a care team member to review it before anything changes.", "Un miembro del equipo debe revisarla antes de realizar cambios.", "Yon manm ekip swen an dwe revize li anvan anyen chanje."), L("Request review", "Solicitar revisión", "Mande yon revizyon")],
    unavailable: ["clock", L("Medicare is temporarily unavailable", "Medicare no está disponible temporalmente", "Medicare pa disponib pou yon ti tan"), L("We saved your progress. This does not mean you are ineligible. Please try again later or ask us to call you.", "Guardamos su progreso. Esto no significa que no sea elegible. Inténtelo después o solicite una llamada.", "Nou anrejistre pwogrè ou. Sa pa vle di ou pa kalifye. Tanpri eseye ankò pita oswa mande nou rele ou."), L("Try again", "Intentar de nuevo", "Eseye ankò")]
  }[outcome] || ["info", L("Review needed", "Se necesita una revisión", "Nou bezwen revize sa"), L("A care team member will review your information.", "Un miembro del equipo revisará su información.", "Yon manm ekip swen an pral revize enfòmasyon ou yo."), L("Request a call", "Solicitar una llamada", "Mande yon apèl")];
  return `<div class="access-eligibility-result-screen">${art(results[0], outcome === "eligible")}${titleBlock(results[1], results[2])}${outcome === "eligible" ? `<section class="next-card"><h2>${L("What happens next?", "¿Qué sigue?", "Kisa k ap pase apre?")}</h2>${rows([["document", L("Review important ACCESS information", "Revise información importante de ACCESS", "Revize enfòmasyon enpòtan sou ACCESS"), ""], ["person", L("Agree to enroll with ITERA HEALTH", "Acepte inscribirse con ITERA HEALTH", "Dakò pou enskri avèk ITERA HEALTH"), ""], ["clock", L("We’ll complete your ACCESS enrollment with Medicare", "Completaremos su inscripción en ACCESS con Medicare", "N ap konplete enskripsyon ACCESS ou avèk Medicare"), ""]])}</section>` : ""}${actions(results[3], false, outcome === "unavailable" ? L("Request a callback", "Solicitar llamada", "Mande yon retou") : "")}</div>`;
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
    { section: "health", itemIcon: "shield", title: L("Confirm your health information", "Confirme su información médica", "Konfime enfòmasyon sante ou"), description: L("Review what we already have on file", "Revise lo que ya tenemos", "Revize sa nou deja genyen nan dosye a"), status: state.healthInformationStepStatus },
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
  const knownData = `<section class="known-data health-information-card" aria-label="${L("Health information on file", "Información médica registrada", "Enfòmasyon sante nan dosye")}">${conditions.map(condition => `<article>${icon("check")}<span><strong>${escapeHtml(condition.name)}</strong>${formattedDate(condition.lastUpdatedAt) ? `<small>${L("Last updated", "Última actualización", "Dènye mizajou")}: ${escapeHtml(formattedDate(condition.lastUpdatedAt))}</small>` : ""}</span></article>`).join("")}</section>`;
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
  const heading = `${art("shield")}${titleBlock(L("Confirm your health information", "Confirme su información médica", "Konfime enfòmasyon sou sante w"), L("We already have this information on file.", "Ya tenemos esta información.", "Nou deja gen enfòmasyon sa a nan dosye nou."), L("Care setup", "Configuración", "Konfigirasyon swen"))}${knownData}`;

  if (state.healthInformationFlowStep === "CHANGE_TYPE") return `${heading}<section class="health-review-panel"><h2>${L("What has changed?", "¿Qué cambió?", "Kisa ki chanje?")}</h2><div class="health-update-options">${Object.entries(updateLabels).map(([value, label]) => `<button type="button" data-action="select-health-update-type" data-update-type="${value}">${label}</button>`).join("")}</div></section><p class="form-error" role="alert">${state.error || ""}</p><div class="actions">${cta(t().back, "health-flow-back", true)}</div>`;

  if (state.healthInformationFlowStep === "CHANGE_DETAILS") {
    const conditionSpecific = ["CONDITION_QUESTIONED", "INFORMATION_INCORRECT"].includes(draft.updateType);
    const prompt = draft.updateType === "NEW_INFORMATION" ? L("What would you like us to know?", "¿Qué desea informarnos?", "Kisa ou ta renmen fè nou konnen?") : L("Tell us what changed.", "Cuéntenos qué cambió.", "Di nou sa ki chanje.");
    const conditionsField = conditionSpecific && conditions.length ? `<fieldset class="health-condition-picker"><legend>${L("Which information changed?", "¿Qué información cambió?", "Ki enfòmasyon ki chanje?")}</legend>${conditions.map(condition => check("healthCondition", condition.name, draft.relatedConditionIds?.includes(condition.id), condition.id)).join("")}</fieldset>` : "";
    return `${heading}<form id="health-update-form" class="health-update-form"><h2>${escapeHtml(updateLabels[draft.updateType] || L("What changed?", "¿Qué cambió?", "Kisa ki chanje?"))}</h2>${conditionsField}<label class="field">${prompt}<textarea name="patientReportedText" rows="4" maxlength="500" placeholder="${draft.updateType === "NEW_INFORMATION" ? L("Example: I was recently told I have diabetes.", "Ejemplo: Recientemente me dijeron que tengo diabetes.", "Egzanp: Yo fèk di mwen mwen gen dyabèt.") : L("Add a short note (optional)", "Agregue una nota breve (opcional)", "Ajoute yon ti nòt (opsyonèl)")}">${escapeHtml(draft.patientReportedText || "")}</textarea></label></form><p class="form-error" role="alert">${state.error || ""}</p><div class="actions">${cta(t().back, "health-flow-back", true)}${cta(L("Review update", "Revisar actualización", "Revize mizajou"), "review-health-update")}</div>`;
  }

  if (state.healthInformationFlowStep === "CHANGE_REVIEW") return `${heading}<section class="health-update-review"><h2>${L("Here’s what you told us", "Esto es lo que nos informó", "Men sa ou te di nou")}</h2>${selectedConditions.length ? `<strong>${selectedConditions.map(condition => escapeHtml(condition.name)).join(", ")}</strong>` : ""}<span>${escapeHtml(updateLabels[draft.updateType] || "")}</span>${draft.patientReportedText ? `<blockquote>${escapeHtml(draft.patientReportedText)}</blockquote>` : ""}<p>${L("Your care team can review this information.", "Su equipo de atención puede revisar esta información.", "Ekip swen ou ka revize enfòmasyon sa a.")}</p></section><p class="form-error" role="alert">${state.error || ""}</p><div class="actions">${cta(L("Change my answer", "Cambiar mi respuesta", "Chanje repons mwen"), "edit-health-update", true)}${cta(L("Save update", "Guardar actualización", "Sove mizajou"), "save-health-update")}</div>`;

  if (state.healthInformationFlowStep === "CHANGE_SAVED" && latestUpdate) return `${heading}<section class="health-review-result changes-reported">${icon("info")}<div><h2>${L("Thanks — we’ll review this update.", "Gracias. Revisaremos esta actualización.", "Mèsi — n ap revize mizajou sa a.")}</h2><p>${L("Your current health information won’t be changed automatically. Your care team can review what you reported.", "Su información médica actual no cambiará automáticamente. Su equipo de atención puede revisar lo que informó.", "Enfòmasyon sante ou genyen kounye a p ap chanje otomatikman. Ekip swen ou ka revize sa ou rapòte a.")}</p><strong>${L("Update provided", "Actualización enviada", "Mizajou bay")}</strong></div></section><div class="health-saved-actions"><button type="button" data-action="view-health-update">${L("View update", "Ver actualización", "Gade mizajou")}</button><button type="button" data-action="edit-saved-health-update">${L("Edit update", "Editar actualización", "Modifye mizajou")}</button><button type="button" data-action="change-health-review-answer">${L("Change my answer", "Cambiar mi respuesta", "Chanje repons mwen")}</button></div><div class="actions single">${cta(L("Return to care setup", "Volver a configuración", "Retounen nan konfigirasyon swen"), "return-health-setup")}</div>`;

  if (state.healthInformationFlowStep === "HELP_OPTIONS") return `${heading}<section class="health-review-panel help-panel"><h2>${L("Need help reviewing this?", "¿Necesita ayuda para revisarlo?", "Bezwen èd pou revize sa?")}</h2><p>${L("That’s okay. Your care team can help you review this information.", "Está bien. Su equipo de atención puede ayudarle a revisar esta información.", "Sa pa yon pwoblèm. Ekip swen ou ka ede w revize enfòmasyon sa a.")}</p><div class="health-help-actions"><button type="button" data-action="health-ask-emmi">${icon("question")}<span><strong>${L("Ask EMMI", "Preguntar a EMMI", "Mande EMMI")}</strong><small>${L("Get a simple explanation", "Reciba una explicación sencilla", "Jwenn yon eksplikasyon senp")}</small></span></button><button type="button" data-action="health-ask-care-team">${icon("people")}<span><strong>${L("Ask my care team", "Preguntar a mi equipo de atención", "Mande ekip swen mwen")}</strong><small>${L("Request help reviewing this", "Solicite ayuda para revisarlo", "Mande èd pou revize sa")}</small></span></button></div></section><div class="actions">${cta(t().back, "health-flow-back", true)}${cta(L("I’ll review this later", "Lo revisaré después", "M ap revize sa pita"), "defer-health-review")}</div>`;

  if (state.healthInformationFlowStep === "HELP_CONFIRMED") return `${heading}<section class="health-review-result needs-help">${icon("people")}<div><h2>${L("We’ll help you review this", "Le ayudaremos a revisarlo", "N ap ede w revize sa")}</h2><p>${L("Your care team will review this information with you.", "Su equipo de atención revisará esta información con usted.", "Ekip swen ou pral revize enfòmasyon sa a avèk ou.")}</p><strong>${L("Help requested", "Ayuda solicitada", "Èd mande")}</strong></div></section><div class="health-saved-actions"><button type="button" data-action="change-health-review-answer">${L("Change my answer", "Cambiar mi respuesta", "Chanje repons mwen")}</button></div><div class="actions single">${cta(L("Return to care setup", "Volver a configuración", "Retounen nan konfigirasyon swen"), "return-health-setup")}</div>`;

  const savedConfirmed = state.healthInformationReviewStatus === "CONFIRMED";
  const choiceDescription = savedConfirmed ? L("Thanks — we’ll keep this information as it is.", "Gracias. Mantendremos esta información como está.", "Mèsi — n ap kenbe enfòmasyon sa a jan li ye a.") : "";
  return `${heading}<div class="health-review-choices">${choiceCard("correct", "check", L("Everything looks right", "Todo está correcto", "Tout bagay sanble kòrèk"), state.healthInformationReviewResult === "correct" ? choiceDescription : "", savedConfirmed && state.healthInformationReviewResult === "correct" ? L("Confirmed", "Confirmado", "Konfime") : "")}${choiceCard("changed", "document", L("Something has changed", "Algo cambió", "Yon bagay chanje"), "")}${choiceCard("help", "question", L("I need help reviewing this", "Necesito ayuda para revisarlo", "Mwen bezwen èd revize sa a"), "")}</div><p class="form-error" role="alert">${state.error || ""}</p><div class="actions">${cta(t().back, "back", true)}${cta(L("Confirm and continue", "Confirmar y continuar", "Konfime epi kontinye"), "confirm-health-information", false, state.healthInformationReviewResult !== "correct")}</div>`;
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
    return `<article class="medication-card medication-review-card ${reviewed ? "reviewed" : "unreviewed"}" data-medication-id="${medication.id}"><div class="medication-card-heading">${icon("pill")}<span><strong>${escapeHtml(medication.name)}</strong><small>${escapeHtml(medication.details || L("Dose not listed", "Dosis no indicada", "Dòz la pa nan lis la"))}</small><em>${L("On file", "Registrado", "Nan dosye")}</em></span></div>${reviewed ? `<div class="medication-reviewed-state">${icon(review.reviewStatus === "CONFIRMED_CURRENT" ? "check" : "info")}<span><strong>${statusCopy(review)}</strong>${review.reviewStatus === "CONFIRMED_CURRENT" ? "" : `<small>${review.reviewStatus === "NEEDS_REVIEW" ? L("That’s okay. Your care team can review this with you.", "Está bien. Su equipo de atención puede revisarlo con usted.", "Sa pa yon pwoblèm. Ekip swen ou ka revize sa avèk ou.") : L("Thanks — we’ll let your care team know.", "Gracias. Informaremos a su equipo de atención.", "Mèsi — n ap fè ekip swen ou konnen.")}</small>`}</span></div><button type="button" class="medication-change-answer" data-action="change-medication-answer" data-medication-id="${medication.id}">${L("Change answer", "Cambiar respuesta", "Chanje repons")}</button>` : `<p class="medication-question">${L("Do you still take this medication?", "¿Todavía toma este medicamento?", "Èske ou toujou pran medikaman sa a?")}</p><div class="medication-review-actions"><button type="button" class="medication-confirm-button" data-action="confirm-medication-current" data-medication-id="${medication.id}">${icon("check")} ${L("Yes, I still take it", "Sí, todavía lo tomo", "Wi, mwen toujou pran li")}</button><button type="button" class="medication-changed-button" data-action="open-medication-change" data-medication-id="${medication.id}">${L("Something changed", "Algo cambió", "Gen yon bagay ki chanje")}</button></div>${changePanel(medication)}`}</article>`;
  }).join("");
  const added = (state.additionalMedications || []).map(item => `<article class="medication-added-card"><div>${icon("pill")}<span><strong>${escapeHtml(item.medicationName)}</strong><small>${escapeHtml([item.dose, item.frequencyLabel].filter(Boolean).join(" · ") || L("Details not provided", "Detalles no proporcionados", "Pa gen detay"))}</small><em>${L("Added by you", "Agregado por usted", "Ou ajoute li")}</em></span></div><div><button type="button" data-action="edit-added-medication" data-medication-id="${item.id}">${L("Edit", "Editar", "Modifye")}</button><button type="button" data-action="remove-added-medication" data-medication-id="${item.id}">${L("Remove", "Eliminar", "Retire")}</button></div></article>`).join("");
  const additionalAnswered = ["NONE", "ADDED", "UNSURE"].includes(state.additionalMedicationsStatus);
  const complete = reviewedCount === medications.length && additionalAnswered;
  const changeCount = Object.values(reviews).filter(review => ["NOT_TAKING", "DOSE_CHANGED", "FREQUENCY_CHANGED", "NEEDS_REVIEW"].includes(review.reviewStatus)).length;
  const addForm = state.medicationAddOpen ? `<form id="add-medication-form" class="medication-add-form"><h3>${state.medicationEditId ? L("Edit medication", "Editar medicamento", "Modifye medikaman") : L("Add a medication", "Agregar un medicamento", "Ajoute yon medikaman")}</h3><label class="field">${L("Medication name", "Nombre del medicamento", "Non medikaman an")}<input name="medicationName" autocomplete="off" value="${escapeHtml(state.additionalMedications.find(item => item.id === state.medicationEditId)?.medicationName || "")}" placeholder="${L("Example: Metformin", "Ejemplo: Metformina", "Egzanp: Metformin")}" required></label><label class="field">${L("Dose or instructions", "Dosis o instrucciones", "Dòz oswa enstriksyon")}<input name="medicationDetails" autocomplete="off" value="${escapeHtml(state.additionalMedications.find(item => item.id === state.medicationEditId)?.dose || "")}" placeholder="${L("Optional", "Opcional", "Opsyonèl")}"></label><label class="field">${L("How often do you take it?", "¿Con qué frecuencia lo toma?", "Konbyen fwa ou pran li?")}<select name="medicationFrequency"><option value="">${L("Optional", "Opcional", "Opsyonèl")}</option>${[["Once daily", L("Once daily", "Una vez al día", "Yon fwa pa jou")], ["Twice daily", L("Twice daily", "Dos veces al día", "De fwa pa jou")], ["Three times daily", L("Three times daily", "Tres veces al día", "Twa fwa pa jou")], ["As needed", L("As needed", "Según sea necesario", "Lè sa nesesè")], ["Other", L("Other", "Otra", "Lòt")]].map(([value, label]) => `<option value="${value}" ${state.additionalMedications.find(item => item.id === state.medicationEditId)?.frequency === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><div class="inline-actions"><button type="button" class="button secondary" data-action="cancel-add-medication">${L("Cancel", "Cancelar", "Anile")}</button><button type="button" class="button primary" data-action="add-medication">${state.medicationEditId ? L("Save medication", "Guardar medicamento", "Sove medikaman") : L("Add medication", "Agregar medicamento", "Ajoute medikaman")}</button></div></form>` : "";
  return `${titleBlock(L("Confirm your medications", "Confirme sus medicamentos", "Konfime medikaman ou yo"), intro, L("Care setup", "Configuración", "Konfigirasyon swen"))}<div class="medication-review-progress" role="status" aria-live="polite"><strong>${reviewedCount === medications.length && medications.length ? "✓ " : ""}${L(`${reviewedCount} of ${medications.length} reviewed`, `${reviewedCount} de ${medications.length} revisados`, `${reviewedCount} sou ${medications.length} revize`)}</strong><span><i style="width:${medications.length ? reviewedCount / medications.length * 100 : 100}%"></i></span></div><section class="medication-review-section"><h2>${L("Review your medications", "Revise sus medicamentos", "Revize medikaman ou yo")}</h2><div class="medication-list">${medicationCards || `<p class="empty-state">${L("No medications are listed on file.", "No hay medicamentos registrados.", "Pa gen medikaman nan dosye a.")}</p>`}</div></section><section class="medication-additional-section"><h2>${L("Taking anything else?", "¿Toma algún otro medicamento?", "Èske ou pran nenpòt lòt medikaman?")}</h2><p>${L("Add any prescription medicine that isn’t listed above.", "Agregue cualquier medicamento recetado que no aparezca arriba.", "Ajoute nenpòt medikaman sou preskripsyon ki pa nan lis anwo a.")}</p>${added ? `<div class="medications-added-list"><h3>${L("Medications you added", "Medicamentos que agregó", "Medikaman ou ajoute")}</h3>${added}</div>` : ""}${addForm || `<div class="additional-medication-actions"><button type="button" data-action="open-add-medication">${icon("pill")} ${L("Add another medication", "Agregar otro medicamento", "Ajoute yon lòt medikaman")}</button><button type="button" class="${state.additionalMedicationsStatus === "NONE" ? "selected" : ""}" data-action="no-additional-medications">${icon("check")} ${L("No, that’s all", "No, eso es todo", "Non, se tout")}</button><button type="button" class="${state.additionalMedicationsStatus === "UNSURE" ? "selected" : ""}" data-action="unsure-additional-medications">${L("I’m not sure if anything is missing", "No estoy seguro de que falte algo", "Mwen pa sèten si gen yon bagay ki manke")}</button></div>`}${state.additionalMedicationsStatus === "UNSURE" ? `<p class="medication-reassurance">${L("That’s okay. Your care team can review your medication list with you.", "Está bien. Su equipo de atención puede revisar la lista con usted.", "Sa pa yon pwoblèm. Ekip swen ou ka revize lis la avèk ou.")}</p>` : ""}</section>${complete && (changeCount || state.additionalMedications.length) ? `<aside class="medication-review-summary"><strong>${L("Medication review", "Revisión de medicamentos", "Revizyon medikaman")}</strong><span>✓ ${L(`${reviewedCount} medications reviewed`, `${reviewedCount} medicamentos revisados`, `${reviewedCount} medikaman revize`)}</span>${changeCount ? `<span>${L(`${changeCount} change to review with your care team`, `${changeCount} cambio para revisar con su equipo`, `${changeCount} chanjman pou revize ak ekip swen ou`)}</span>` : ""}${state.additionalMedications.length ? `<span>${L(`${state.additionalMedications.length} medication added`, `${state.additionalMedications.length} medicamento agregado`, `${state.additionalMedications.length} medikaman ajoute`)}</span>` : ""}</aside>` : ""}<p class="form-error" role="alert">${state.error || ""}</p>${actions(L("Continue", "Continuar", "Kontinye"), true, "", !complete)}`;
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
const goalCheck = (value, label, checked, goalType) => `<label class="check-row goal-check-row"><input type="checkbox" name="careGoal" value="${value}" ${checked ? "checked" : ""}><span class="check-box">✓</span>${goalIcon({ goalType })}<span>${label}</span></label>`;
// Every goal surface renders its icon through this, so the same goal looks the same in Goal
// Discovery, Priorities, the Care Plan, My Goals and Goal Detail. The icon is decorative: the
// goal's name already carries the meaning, so it is hidden from screen readers.
const goalIcon = (goal, extra = "") =>
  `<span class="goal-icon ${extra}" data-goal-category="${goalCategoryOf(goal)}">${icon(resolveGoalIcon(goal, name => name in iconMap), "goal-icon-glyph")}</span>`;

const activePatientGoals = () => (state.patientGoals || []).filter(goal => goal.status !== "REMOVED");
const patientGoalById = id => activePatientGoals().find(goal => goal.id === id);
const currentGoal = () => patientGoalById(state.activeGoalId || state.goalPlanningGoalId) || activePatientGoals()[0];
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
const frequencyLabel = value => ({
  daily: L("Every day", "Todos los días", "Chak jou"),
  "few-days": L("A few days each week", "Algunos días por semana", "Kèk jou chak semèn"),
  "choose-days": L("Choose days", "Elegir días", "Chwazi jou"),
  "care-team-plan": L("Follow my care team’s plan", "Seguir el plan de mi equipo", "Swiv plan ekip swen mwen")
})[value] || L("As needed", "Según sea necesario", "Lè sa nesesè");

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

function goals() {
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

const goalNextStep = goal => {
  const next = goalNextBestAction(goal, { runtime: goalRuntimeFor(goal), educationPending: goalEducationPending(goal) });
  return next.key === "COMPLETE_ACTION" ? next.title || "" : goalNextStepCopy(next.key);
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

// The primary goal gets the fuller treatment: progress, the next step and a lead action. Other
// goals stay deliberately lighter, so the patient's own priority is the thing that stands out.
function primaryGoalCard(goal) {
  const nextStep = goalNextStep(goal);
  const ctaAction = goalCardCta(goal);
  return `<article class="goal-card goal-card-primary" data-goal-status="${goal.status}" data-goal-id="${goal.id}" aria-labelledby="goal-title-${goal.id}">
    <div class="goal-card-head">${goalIcon(goal, "goal-card-icon")}<h3 class="goal-card-title" id="goal-title-${goal.id}">${escapeHtml(goalDisplayName(goal, state.language))}</h3></div>
    ${goalProgressMarkup(goal)}
    ${nextStep ? `<div class="goal-summary-block"><span class="goal-summary-label">${L("Next step", "Próximo paso", "Pwochen etap")}</span><p class="goal-summary-value">${escapeHtml(nextStep)}</p></div>` : ""}
    <button type="button" class="goal-card-cta" data-action="${ctaAction.action}" data-goal-id="${goal.id}"><span>${ctaAction.label}</span>${icon("arrowRight")}</button>
  </article>`;
}

function secondaryGoalCard(goal) {
  const ctaAction = goalCardCta(goal);
  const ready = goalIsReadyToPersonalize(goal);
  return `<article class="goal-card" data-goal-status="${goal.status}" data-goal-id="${goal.id}" aria-labelledby="goal-title-${goal.id}">
    <div class="goal-card-head">${goalIcon(goal, "goal-card-icon")}<h3 class="goal-card-title" id="goal-title-${goal.id}">${escapeHtml(goalDisplayName(goal, state.language))}</h3></div>
    <p class="goal-card-status">${icon(goalStatusIcon(goal))}<span>${goalStatusCopy(goal)}</span></p>
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
  return buildBloodPressureGoalRuntime({ readings, demoMode: goal.goalType === "BLOOD_PRESSURE_CONTROL" && readings.length === 0, monitoringRules: state.bpMonitoringRules || DEMO_BP_MONITORING_RULES, clinicalTarget: state.bpClinicalTarget || null });
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
  const today = new Date().toISOString().slice(0, 10);
  const verificationMethod = resolveGoalActionVerification(action);
  const doneToday = (action.completionHistory || []).some(item => item.date === today) || action.status === "COMPLETED";
  const frequency = action.frequency ? frequencyLabel(action.frequency) : "";
  const actionTemplate = action.templateId ? suggestedActionsFor(goal.goalType).find(item => item.id === action.templateId) : null;
  const actionTitle = actionTemplate ? localGoalText(actionTemplate.title, state.language) : action.title;
  if (verificationMethod === "DEVICE") {
    const receivedToday = health.latest && new Date(health.latest.timestamp).toISOString().slice(0, 10) === today;
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

function goalDetail() {
  const goal = currentGoal();
  if (!goal) return myGoalsDashboard();
  const title = escapeHtml(goalDisplayName(goal, state.language));
  const health = goal.goalType === "BLOOD_PRESSURE_CONTROL" ? bloodPressureGoalRuntime(goal) : null;
  if (state.goalDetailView === "READINGS" && health) return goalReadingHistory(goal, health);
  if (state.goalDetailView === "WHY_EDIT") return `${titleBlock(L("Why this matters to me", "Por qué esto es importante para mí", "Poukisa sa enpòtan pou mwen"), title, L("My goal", "Mi meta", "Objektif mwen"))}<form id="goal-why-form"><label class="field"><textarea name="whyItMatters" rows="5" maxlength="300" placeholder="${L("Share what you want this goal to help you keep doing.", "Cuente qué desea que esta meta le ayude a seguir haciendo.", "Pataje sa ou vle objektif sa a ede w kontinye fè.")}">${escapeHtml(goal.whyItMatters || "")}</textarea></label></form><div class="actions">${cta(t().back, "goal-detail-back", true)}${cta(L("Save", "Guardar", "Sove"), "save-goal-why")}</div>`;
  if (state.goalDetailView === "CHECK_IN") return `${titleBlock(L("How do you feel this goal is going?", "¿Cómo siente que va esta meta?", "Kijan ou santi objektif sa a ap mache?"), title, L("Goal check-in", "Seguimiento de meta", "Tcheke objektif"))}<div class="choice-list goal-checkin-options">${[["GOING_WELL", L("I’m making progress", "Estoy avanzando", "M ap fè pwogrè")], ["ABOUT_THE_SAME", L("About the same", "Más o menos igual", "Prèske menm jan")], ["DIFFICULTY", L("I’m having a hard time", "Me está costando", "Sa difisil pou mwen")], ["NOT_STARTED", L("I haven’t started yet", "Todavía no he empezado", "Mwen poko kòmanse")]].map(([value,label]) => `<button type="button" class="goal-response-button" data-action="goal-checkin-response" data-response="${value}">${label}</button>`).join("")}</div><div class="actions">${cta(t().back, "goal-detail-back", true)}</div>`;
  if (state.goalDetailView === "BARRIERS") return `${titleBlock(L("What’s getting in the way?", "¿Qué se lo está dificultando?", "Kisa k ap anpeche w?"), L("Choose the answer that fits best.", "Elija la respuesta que mejor corresponda.", "Chwazi repons ki pi byen mache."), L("Barriers", "Dificultades", "Difikilte"))}<form id="goal-barrier-form"><div class="goal-barrier-options">${[["NOT_WELL",L("I don’t feel well", "No me siento bien", "Mwen pa santi m byen")],["FORGET",L("I forget", "Se me olvida", "Mwen bliye")],["NO_TIME",L("I don’t have time", "No tengo tiempo", "Mwen pa gen tan")],["MEDICATION_TROUBLE",L("I have questions about my medications", "Tengo dudas sobre mis medicamentos", "Mwen gen kesyon sou medikaman mwen")],["MONITOR_HELP",L("I don’t know how to use my monitor", "No sé usar el monitor", "Mwen pa konnen kijan pou m sèvi ak monitè a")],["SAFETY_WORRY",L("I’m worried about doing it safely", "Me preocupa hacerlo de forma segura", "Mwen enkyete pou m fè sa an sekirite")],["OTHER",L("Something else", "Algo más", "Yon lòt bagay")]].map(([value,label]) => `<label class="check-row"><input type="radio" name="barrierType" value="${value}"><span class="check-box">✓</span><span>${label}</span></label>`).join("")}</div><label class="field">${L("Tell us more (optional)", "Cuéntenos más (opcional)", "Di nou plis (opsyonèl)")}<textarea name="barrierNotes" rows="3" maxlength="300"></textarea></label></form><p class="form-error" role="alert">${state.error || ""}</p><div class="actions">${cta(t().back, "goal-detail-back", true)}${cta(L("Continue", "Continuar", "Kontinye"), "save-goal-barrier")}</div>`;
  if (state.goalDetailView === "SUPPORT") return `${titleBlock(L("How can we help?", "¿Cómo podemos ayudarle?", "Kijan nou ka ede w?"), title, L("Support I need", "Apoyo que necesito", "Sipò mwen bezwen"))}<div class="choice-list goal-support-options">${[["REMINDER",L("Remind me", "Recordármelo", "Fè m sonje")],["EXPLAIN",L("Explain it to me", "Explicármelo", "Eksplike m sa")],["MONITOR_HELP",L("Help me with my monitor", "Ayudarme con el monitor", "Ede m ak monitè mwen")],["ADJUST_PLAN",L("Help me adjust my plan", "Ayudarme a ajustar mi plan", "Ede m ajiste plan mwen")],["CARE_TEAM",L("Talk to my care team", "Hablar con mi equipo de atención", "Pale ak ekip swen mwen")],["UNSURE",L("I’m not sure", "No estoy seguro", "Mwen pa sèten")]].map(([value,label]) => `<button type="button" class="goal-response-button" data-action="goal-support-request" data-support="${value}">${label}</button>`).join("")}</div><div class="actions">${cta(t().back, "goal-detail-back", true)}</div>`;
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
  const latest = health?.latest;
  const metric = health ? `<section class="goal-health-card" aria-label="${latest ? escapeHtml(L(`Blood pressure, ${latest.systolic} over ${latest.diastolic} millimeters of mercury. ${bpClassificationCopy(latest.classification)}.`, `Presión arterial, ${latest.systolic} sobre ${latest.diastolic} milímetros de mercurio. ${bpClassificationCopy(latest.classification)}.`, `Tansyon, ${latest.systolic} sou ${latest.diastolic} milimèt mèki. ${bpClassificationCopy(latest.classification)}.`)) : ""}"><div class="goal-health-eyebrow">${icon("heart")}<span>${L("My blood pressure today", "Mi presión hoy", "Tansyon mwen jodi a")}</span></div>${latest ? `<p class="goal-health-value"><strong>${latest.systolic} <i>/</i> ${latest.diastolic}</strong><span>mmHg</span></p><p class="goal-health-status ${latest.classification.toLowerCase()}">${icon(latest.classification === "WITHIN_EXPECTED_RANGE" ? "check" : "info")}${bpClassificationCopy(latest.classification)}</p><p class="goal-health-time">${L("Today", "Hoy", "Jodi a")} · ${new Intl.DateTimeFormat(goalHealthLocale(), { hour: "numeric", minute: "2-digit" }).format(new Date(latest.timestamp))}</p><p class="goal-health-source">${latest.source === "CONNECTED_DEVICE" && latest.sourceVerified ? L("Received automatically from your monitor", "Recibida automáticamente desde su monitor", "Resevwa otomatikman nan monitè ou") : L("Reported health reading", "Lectura de salud registrada", "Lekti sante rapòte")}</p><button type="button" class="goal-card-action" data-action="view-goal-readings">${L("View my readings", "Ver mis lecturas", "Gade lekti mwen")} ${icon("arrowRight")}</button><button type="button" class="goal-card-action secondary" data-action="explain-goal-reading">${L("What does this reading mean?", "¿Qué significa esta lectura?", "Kisa lekti sa a vle di?")} ${icon("arrowRight")}</button>` : `<div class="goal-health-empty">${icon("info")}<strong>${L("We have not received a reading today.", "Aún no hemos recibido una lectura hoy.", "Nou poko resevwa yon lekti jodi a.")}</strong><p>${L("When you use your connected monitor, the reading will appear here automatically.", "Cuando use su monitor conectado, la lectura aparecerá aquí automáticamente.", "Lè ou sèvi ak monitè konekte ou, lekti a ap parèt isit otomatikman.")}</p></div>`}</section>` : "";
  const trend = health ? `<section class="goal-section goal-trend"><div class="goal-section-heading"><div><h2>${L("How my blood pressure has been", "Cómo ha estado mi presión", "Kijan tansyon mwen te ye")}</h2><p>${L("Last 7 days", "Últimos 7 días", "7 dènye jou yo")}</p></div></div>${goalTrendChart(health.trend)}${health.trend.averageSystolic ? `<div class="goal-trend-summary"><span>${L("Average", "Promedio", "Mwayèn")}</span><strong>${health.trend.averageSystolic} / ${health.trend.averageDiastolic}</strong><small>${icon(health.trend.direction === "STABLE" ? "check" : "trending")}${bpTrendCopy(health.trend.direction)}</small></div>` : ""}<button type="button" class="goal-secondary-button" data-action="explain-goal-trend">${icon("trending")}<span>${L("Ask EMMI to explain this trend", "Pedir a EMMI que explique esta tendencia", "Mande EMMI eksplike tandans sa a")}</span></button></section>` : "";
  return `<span class="eyebrow">${L("My goal", "Mi meta", "Objektif mwen")}</span>
    <div class="goal-detail-hero">${goalIcon(goal, "goal-detail-hero-icon")}<h1 tabindex="-1">${title}</h1></div>
    ${statusLead ? `<p class="lead">${statusLead}</p>` : ""}
    ${metric}${trend}
    <section class="goal-section">
      <h2>${L("My actions", "Mis acciones", "Aksyon mwen")}</h2>
      ${actionRows ? `<p class="goal-section-support">${L("Some steps are recorded automatically. You only confirm the ones you do yourself.", "Algunos pasos se registran automáticamente. Usted solo confirma los que realiza personalmente.", "Gen kèk etap ki anrejistre otomatikman. Ou konfime sèlman sa ou fè tèt ou.")}</p><ul class="goal-action-list">${actionRows}</ul>` : `<p class="goal-progress-empty">${L("You have not added any actions yet.", "Todavía no ha agregado acciones.", "Ou poko ajoute okenn aksyon.")}</p>`}
      <button type="button" class="goal-secondary-button" data-action="plan-active-goal">${icon("sliders")}<span>${actionRows ? L("Adjust my plan", "Ajustar mi plan", "Ajiste plan mwen") : goal.planPersonalizationStatus === "DEFERRED" || goal.planStatus === "DEFERRED" ? L("Continue personalizing my plan", "Continuar personalizando mi plan", "Kontinye pèsonalize plan mwen") : L("Personalize my plan", "Personalizar mi plan", "Pèsonalize plan mwen")}</span></button>
    </section>
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

function accessBaseline() {
  return `${art("shield")}${titleBlock(L("Your first health check", "Su primera evaluación de salud", "Premye tchekòp sante ou"), L("This helps your ACCESS care team understand your starting point and personalize your care.", "Esto ayuda a su equipo de cuidado ACCESS a conocer su punto de partida y personalizar su cuidado.", "Sa ede ekip swen ACCESS ou konprann pwen depa ou epi pèsonalize swen ou."), L("ACCESS health check", "Evaluación de salud ACCESS", "Tchekòp sante ACCESS"))}${rows([["chart", L("Your health measures", "Sus mediciones de salud", "Mezi sante ou yo"), ""], ["question", L("Questions about your health", "Preguntas sobre su salud", "Kesyon sou sante ou"), ""], ["pill", L("Your medications", "Sus medicamentos", "Medikaman ou yo"), ""], ["goals", L("Your health goals", "Sus objetivos de salud", "Objektif sante ou"), ""]])}<div class="meta-list"><span>${icon("clock")} ${L("Usually takes about 10 minutes", "Generalmente toma unos 10 minutos", "Anjeneral li pran anviwon 10 minit")}</span><span>${icon("shield")} ${L("Your progress is saved if you finish later.", "Su progreso queda guardado si termina más tarde.", "Pwogrè ou anrejistre si ou fini pita.")}</span></div>${actions(L("Start health check", "Iniciar evaluación", "Kòmanse tchekòp sante a"), false, L("I’ll do this later", "Lo haré después", "M ap fè sa pita"))}`;
}

function accessPrimaryCondition() {
  const primary = state.offer.qualifyingConditions?.[0] || state.offer.qualifyingCondition || {};
  return `${primary.name || ""} ${primary.patientFriendlyName || ""}`.toLowerCase();
}

function isBloodPressureAccessBaseline() {
  const condition = accessPrimaryCondition();
  return !condition.includes("diabetes") && !condition.includes("heart failure") && !condition.includes("kidney");
}

function accessMeasure() {
  const condition = accessPrimaryCondition();
  const measure = condition.includes("diabetes")
    ? [L("Your blood sugar starting point", "Su punto de partida de glucosa", "Mezi sik nan san ou kòm pwen depa"), L("This measure is part of your ACCESS care for diabetes.", "Esta medición es parte de su cuidado ACCESS para la diabetes.", "Mezi sa a fè pati swen ACCESS ou pou dyabèt.")]
    : condition.includes("heart failure")
      ? [L("Your heart health starting point", "Su punto de partida de salud cardíaca", "Sante kè ou kòm pwen depa"), L("This measure is part of your ACCESS care for heart failure.", "Esta medición es parte de su cuidado ACCESS para la insuficiencia cardíaca.", "Mezi sa a fè pati swen ACCESS ou pou ensifizans kadyak.")]
      : condition.includes("kidney")
        ? [L("Your kidney health starting point", "Su punto de partida de salud renal", "Sante ren ou kòm pwen depa"), L("This measure is part of your ACCESS care for kidney health.", "Esta medición es parte de su cuidado ACCESS para la salud renal.", "Mezi sa a fè pati swen ACCESS ou pou sante ren.")]
        : [L("Your blood pressure starting point", "Su presión arterial inicial", "Pwen depa tansyon ou"), L("This helps your care team understand your blood pressure today and personalize your care.", "Esto ayuda a su equipo de atención a conocer su presión arterial actual y personalizar su cuidado.", "Sa ede ekip swen ou konprann tansyon ou jodi a epi pèsonalize swen ou.")];
  const bloodPressureMeasure = isBloodPressureAccessBaseline();
  const options = bloodPressureMeasure
    ? [
        ["owned", "device", L("I already have a blood pressure monitor", "Ya tengo un monitor de presión arterial", "Mwen deja gen yon aparèy pou mezire tansyon"), L("We’ll check whether your monitor can be used for your ACCESS care.", "Verificaremos si su monitor puede utilizarse para sus mediciones de ACCESS.", "N ap verifye si aparèy ou a ka itilize pou swen ACCESS ou.")],
        ["help", "question", L("I have a monitor but need help", "Tengo un monitor, pero necesito ayuda", "Mwen gen yon aparèy, men mwen bezwen èd"), L("We’ll help you set it up and take your readings correctly.", "Le ayudaremos a configurarlo y a tomar sus mediciones correctamente.", "N ap ede w mete l anplas epi pran mezi ou yo kòrèkteman.")],
        ["needed", "device", L("I need a blood pressure monitor", "Necesito un monitor de presión arterial", "Mwen bezwen yon aparèy pou mezire tansyon"), L("ITERA can help arrange one for you.", "ITERA puede ayudarle a obtener uno.", "ITERA ka ede fè aranjman pou ou jwenn youn.")]
      ]
    : [
        ["recent", "heart", L("I have a recent health measure", "Tengo una medición de salud reciente", "Mwen gen yon mezi sante resan"), L("Enter the date and result", "Ingrese la fecha y el resultado", "Antre dat ak rezilta a")],
        ["help", "question", L("I need help reviewing my information", "Necesito ayuda para revisar mi información", "Mwen bezwen èd revize enfòmasyon mwen yo"), L("We can guide you", "Podemos guiarle", "Nou ka gide ou")],
        ["support", "people", L("I need support from ITERA", "Necesito apoyo de ITERA", "Mwen bezwen sipò ITERA"), L("We’ll help with the next step", "Le ayudaremos con el próximo paso", "Nou pral ede ak pwochen etap la")]
      ];
  const eyebrow = bloodPressureMeasure ? (state.language === "es" ? "" : L("Blood pressure health check", "", "Tchekòp tansyon")) : `${state.offer.accessTrack || "ACCESS"} ${L("health check", "evaluación de salud", "tchekòp sante")}`;
  return `${art(bloodPressureMeasure ? "device" : "shield")}${titleBlock(measure[0], measure[1], eyebrow)}
    <form class="choice-list">${options.map(([value, itemIcon, title, body]) => choice(value, itemIcon, title, body)).join("")}</form>${actions(t().continue)}`;
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
  const restrictionYes = state.armRestrictionReported === "YES";
  const specialReview = state.armRestrictionReported === "UNSURE" || state.restrictedArm === "BOTH";
  const canChooseCuff = state.armRestrictionReported === "NO" || (restrictionYes && ["LEFT", "RIGHT"].includes(state.restrictedArm));
  const deviceConfiguration = bpFulfillmentDeviceConfiguration();
  const cuffOptions = (deviceConfiguration?.cuffOptions || []).filter(option => option.inventoryStatus === "AVAILABLE" && option.compatibleDeviceModels.includes(deviceConfiguration.id));
  const cuffQuestion = canChooseCuff ? `<section class="cuff-selection-section" aria-labelledby="cuff-selection-title"><div class="cuff-placement-card"><img src="/assets/bp-upper-arm-cuff.png" alt="${L("Blood pressure cuff placed on the upper arm", "Brazalete de presión arterial colocado en la parte superior del brazo", "Manchèt tansyon plase sou pati anwo bra a")}"><div><strong>${L("The cuff goes on your upper arm", "El brazalete se coloca en la parte superior del brazo", "Manchèt la ale sou pati anwo bra ou")}</strong><p>${L("Choose the size that seems closest. We’ll verify it before shipping.", "Elija el tamaño que le parezca más adecuado. Lo verificaremos antes del envío.", "Chwazi gwosè ki sanble pi pre a. N ap verifye li anvan nou voye l.")}</p></div></div><fieldset class="cuff-choice-group"><legend id="cuff-selection-title">${L("Which cuff size do you think fits best?", "¿Qué tamaño de brazalete cree que le queda mejor?", "Ki gwosè manchèt ou panse ki pi bon pou ou?")}</legend><p class="fieldset-support">${L("Choose the option that best fits your upper arm. If you’re not sure, we can help.", "Elija la opción que mejor se ajuste a la parte superior de su brazo. Si no está seguro, podemos ayudarle.", "Chwazi opsyon ki pi byen adapte ak pati anwo bra ou. Si ou pa sèten, nou ka ede w.")}</p><div class="choice-list cuff-choice-list">${cuffOptions.map(option => choice(option.id, "device", cuffOptionLabel(option), `${cuffOptionDescription(option)}<span class="cuff-manufacturer-range">${cuffRangeLabel(option)}</span>`, state.selectedCuffOption === option.id)).join("")}${choice("UNSURE", "question", L("I’m not sure", "No estoy seguro", "Mwen pa sèten"), L("Your care team can help choose the right cuff.", "Su equipo de cuidado puede ayudarle a elegir el brazalete adecuado.", "Ekip swen ou ka ede chwazi bon manchèt la."), state.selectedCuffOption === "UNSURE")}</div></fieldset>${state.selectedCuffOption === "UNSURE" ? `<aside class="note cuff-assistance-note">${icon("people")}<p>${L("We can help confirm the right size before sending your monitor.", "Podemos ayudarle a confirmar el tamaño adecuado antes de enviar su monitor.", "Nou ka ede konfime bon gwosè a anvan nou voye aparèy ou a.")}</p></aside>` : ""}<button type="button" class="text-button exact-measurement-toggle" data-action="toggle-exact-arm-measurement" aria-expanded="${state.exactArmMeasurementOpen}">${L("I know my arm measurement", "Sé la medida de mi brazo", "Mwen konnen mezi bra mwen")}</button>${state.exactArmMeasurementOpen ? `<div class="exact-measurement-panel"><div class="field"><label for="arm-circumference">${L("Arm circumference", "Circunferencia del brazo", "Sikonferans bra")}</label><div class="measurement-input"><input id="arm-circumference" name="armCircumferenceValue" type="number" inputmode="decimal" step="0.1" min="0" value="${escapeHtml(state.armCircumferenceValue)}"><select name="armCircumferenceUnit" aria-label="${L("Measurement unit", "Unidad de medida", "Inite mezi")}"><option value="cm" ${state.armCircumferenceUnit === "cm" ? "selected" : ""}>cm</option><option value="in" ${state.armCircumferenceUnit === "in" ? "selected" : ""}>in</option></select></div><small>${L("We’ll use this measurement to recommend a compatible cuff.", "Usaremos esta medida para recomendar un brazalete compatible.", "N ap itilize mezi sa a pou rekòmande yon manchèt ki mache ak aparèy la.")}</small></div></div>` : ""}</section>` : "";
  const specialSection = specialReview ? `<aside class="note arm-clinical-review">${icon("people")}<div><strong>${L("We’ll help confirm the best way to take your blood pressure.", "Le ayudaremos a confirmar la mejor forma de tomarse la presión arterial.", "N ap ede konfime pi bon fason pou pran tansyon ou.")}</strong><p>${L("You don’t need to choose an arm or cuff size on your own.", "No necesita elegir un brazo ni el tamaño del brazalete por su cuenta.", "Ou pa bezwen chwazi yon bra oswa gwosè manchèt poukont ou.")}</p></div></aside><div class="actions">${cta(t().back, "back", true)}${cta(L("Continue with the rest of my health check", "Continuar con el resto de mi evaluación", "Kontinye ak rès tchekòp sante mwen"), "arm-review-continue")}</div><div class="measurement-help-actions centered-help-action">${cta(L("Talk with my care team", "Hablar con mi equipo", "Pale ak ekip swen mwen an"), "arm-help-care-team", true)}</div>` : "";
  const armRestrictionOptions = [
    ["NO", L("No", "No", "Non"), ""],
    ["YES", L("Yes", "Sí", "Wi"), ""],
    ["UNSURE", L("Not sure", "No sé", "Pa sèten"), L("I’m not sure", "No estoy seguro", "Mwen pa sèten")]
  ];
  const hasCuffDecision = Boolean(state.selectedCuffOption) || state.exactArmMeasurementOpen;
  return `${art("device")}${titleBlock(L("Let’s find the right monitor for you", "Encontremos el monitor adecuado para usted", "Ann jwenn aparèy ki bon pou ou"), L("We need a few details to help choose a monitor with the right cuff.", "Necesitamos algunos datos para ayudar a elegir un monitor con el brazalete adecuado.", "Nou bezwen kèk enfòmasyon pou ede chwazi yon aparèy ak manchèt ki apwopriye a."))}<form id="bp-device-info-form"><fieldset class="inline-question"><legend>${L("Has a healthcare professional told you not to use one of your arms for blood pressure readings?", "¿Le ha indicado un profesional de salud que no debe usar uno de sus brazos para medirse la presión arterial?", "Èske yon pwofesyonèl sante te di w pou pa itilize youn nan bra ou pou mezire tansyon?")}</legend><div class="segmented-options keep-one-row">${armRestrictionOptions.map(([value, label, accessibleLabel]) => `<label><input type="radio" name="armRestrictionReported" value="${value}" ${accessibleLabel ? `aria-label="${accessibleLabel}"` : ""} ${state.armRestrictionReported === value ? "checked" : ""}><span>${label}</span></label>`).join("")}</div></fieldset><fieldset class="inline-question restricted-arm-question" ${restrictionYes ? "" : "hidden"}><legend>${L("Which arm should not be used?", "¿Cuál brazo no debe usarse?", "Ki bra yo pa dwe itilize?")}</legend><div class="segmented-options">${[["LEFT", L("Left arm", "Brazo izquierdo", "Bra goch")], ["RIGHT", L("Right arm", "Brazo derecho", "Bra dwat")], ["BOTH", L("Both arms", "Ambos brazos", "Toude bra yo")]].map(([value, label]) => `<label><input type="radio" name="restrictedArm" value="${value}" ${state.restrictedArm === value ? "checked" : ""}><span>${label}</span></label>`).join("")}</div></fieldset>${cuffQuestion}${specialSection}<p class="form-error" role="alert">${state.error || ""}</p>${specialReview ? "" : actions(t().continue, true, "", !canChooseCuff || !hasCuffDecision)}</form>`;
}

function accessBpShippingAddress() {
  const existing = state.offer.patient.shippingAddress;
  const selected = state.shippingAddressMode || "existing";
  const current = state.shippingAddress || existing || {};
  return `${art("box")}${titleBlock(L("Where would you like your monitor delivered?", "¿Dónde desea recibir su monitor?", "Ki kote ou vle resevwa aparèy ou a?"))}<form id="bp-shipping-form"><div class="choice-list">${choice("existing", "home", L("This address is correct", "Esta dirección es correcta", "Adrès sa a kòrèk"), L("Use the address we already have", "Use la dirección que ya tenemos", "Itilize adrès nou deja genyen an"), selected === "existing")}${choice("other", "document", L("Use a different address", "Usar otra dirección", "Itilize yon lòt adrès"), L("Enter another delivery address", "Ingrese otra dirección de envío", "Antre yon lòt adrès livrezon"), selected === "other")}</div>${selected === "existing" ? `<address class="address-card">${icon("home")}<span><strong>${L("Send to:", "Enviar a:", "Voye nan:")}</strong><br>${escapeHtml(existing.line1)}${existing.unit ? `<br>${escapeHtml(existing.unit)}` : ""}<br>${escapeHtml(existing.city)}, ${escapeHtml(existing.state)} ${escapeHtml(existing.zip)}</span></address>` : `<div class="shipping-fields"><div class="field"><label for="shipping-line1">${L("Street address", "Dirección", "Adrès lari")}</label><input id="shipping-line1" name="line1" autocomplete="shipping street-address" value="${escapeHtml(current.line1 || "")}"></div><div class="field"><label for="shipping-unit">${L("Apartment / Unit", "Apartamento / Unidad", "Apatman / Inite")}</label><input id="shipping-unit" name="unit" autocomplete="shipping address-line2" value="${escapeHtml(current.unit || "")}"></div><div class="field"><label for="shipping-city">${L("City", "Ciudad", "Vil")}</label><input id="shipping-city" name="city" autocomplete="shipping address-level2" value="${escapeHtml(current.city || "")}"></div><div class="shipping-short-fields"><div class="field"><label for="shipping-state">${L("State", "Estado", "Eta")}</label><input id="shipping-state" name="state" maxlength="2" autocomplete="shipping address-level1" value="${escapeHtml(current.state || "")}"></div><div class="field"><label for="shipping-zip">${L("ZIP code", "Código postal", "Kòd postal")}</label><input id="shipping-zip" name="zip" inputmode="numeric" maxlength="5" autocomplete="shipping postal-code" value="${escapeHtml(current.zip || "")}"></div></div></div>`}<p class="form-error" role="alert">${state.error || ""}</p>${actions(state.busy ? L("Requesting…", "Solicitando…", "N ap mande…") : L("Request my monitor", "Solicitar mi monitor", "Mande aparèy mwen an"), true, "", state.busy)}</form>`;
}

function accessBpFulfillmentConfirmed() {
  const cuffPending = state.cuffSelectionStatus === "NEEDS_ASSISTANCE";
  return `${art("check", true)}${titleBlock(L("Your monitor is being prepared", "Su monitor está siendo preparado", "Y ap prepare aparèy ou a"), L("ITERA will prepare your monitor and send it to the address you confirmed.", "ITERA preparará su monitor y lo enviará a la dirección que confirmó.", "ITERA ap prepare aparèy ou a epi voye li nan adrès ou konfime a."))}${rows([["check", L("Request received", "Solicitud recibida", "Nou resevwa demann lan"), ""], [cuffPending ? "clock" : "check", cuffPending ? L("We’ll confirm the cuff size with you", "Confirmaremos el tamaño del brazalete con usted", "N ap konfime gwosè manchèt la avèk ou") : L("Cuff information recorded", "Información del brazalete registrada", "Enfòmasyon manchèt la anrejistre"), ""], ["check", L("Address confirmed", "Dirección confirmada", "Adrès konfime"), ""]])}<aside class="note">${icon("check")}<p>${L("You can continue the other parts of your health check while you wait for the monitor.", "Puede continuar con las demás partes de su evaluación mientras recibe el monitor.", "Ou ka kontinye lòt pati tchekòp sante ou pandan w ap tann aparèy la.")}</p></aside><div class="actions stacked-actions">${cta(L("Continue my health check", "Continuar mi evaluación", "Kontinye tchekòp sante mwen"))}${cta(L("I’ll do this later", "Lo haré más tarde", "M ap fè sa pita"), "bp-defer-health-check", true)}</div>`;
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

function onboardingComplete() {
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
    <section class="scenario-footer">
      <div class="scenario-summary" aria-live="polite"><span>Patient scenario</span><strong title="${escapeHtml(prototypeScenarioSummary())}">${prototypeScenarioSummary()}</strong></div>
      <button class="launch-button" type="button" data-action="launch-prototype">Launch Patient Experience ${icon("arrowRight", "button-icon")}</button>
    </section>
  </main>`;
}

const renderers = { INVITATION: invitation, DECISION_MAKER: decisionMaker, CARE_CIRCLE_INVITE: careCircleInvite, CARE_CIRCLE_INVITE_SENT: careCircleInviteSent, CARE_CIRCLE_PERMISSIONS: careCirclePermissions, SHARE_ACCESS: shareAccess, PERSONAL_REPRESENTATIVE_DETAILS: personalRepresentativeDetails, REPRESENTATIVE_MOBILE_VERIFICATION: representativeMobileVerification, REPRESENTATIVE_AUTHORITY_ATTESTATION: representativeAuthorityAttestation, REPRESENTATIVE_AUTHORITY_ESCALATION: representativeAuthorityEscalation, IDENTITY_VERIFICATION: identity, CARE_RECOMMENDATION: recommendation, HOW_CARE_WORKS: howCareWorks, DISCLOSURE: disclosure, CONSENT_REVIEW: consent, ENROLLMENT_PROCESSING: () => processing(), ACCESS_ALIGNMENT_PROCESSING: () => processing("alignment"), ENROLLMENT_CONFIRMED: success, ACCESS_PRE_ELIGIBILITY_NOTICE: accessNotice, ACCESS_MEDICARE_IDENTIFIER: medicareIdentifier, ACCESS_ELIGIBILITY_PROCESSING: eligibilityProcessing, ACCESS_ELIGIBILITY_RESULT: eligibilityResult, ONBOARDING: onboarding, CLINICAL_VERIFICATION: clinical, MEDICATIONS_REVIEW: medicationsReview, CARE_PREFERENCES: carePreferences, GOALS: goals, ACCESS_BASELINE: accessBaseline, ACCESS_MEASURE: accessMeasure, ACCESS_BP_DEVICE_VERIFICATION: accessBpDeviceVerification, ACCESS_BP_DEVICE_RESULT: accessBpDeviceResult, ACCESS_BP_DEVICE_INFO: accessBpDeviceInfo, ACCESS_BP_SHIPPING_ADDRESS: accessBpShippingAddress, ACCESS_BP_FULFILLMENT_CONFIRMED: accessBpFulfillmentConfirmed, ACCESS_BP_GUIDED_SETUP: accessBpGuidedSetup, ACCESS_BP_MEASUREMENT: accessBpMeasurement, ACCESS_BP_BASELINE_RESULT: accessBpBaselineResult, ACCESS_BP_ESCALATION: accessBpEscalation, RPM_DEVICE_PATH: rpmDevice, RPM_ADDRESS_CONFIRMATION: shipping, RPM_DEVICE_SETUP: deviceSetup, RPM_FIRST_READING: firstReading, RPM_MONITORING_READY: monitoringReady, ONBOARDING_COMPLETE: onboardingComplete, CALLBACK_CONFIRMED: callbackConfirmed, OUTCOME_STOPPED: stoppedOutcome, OFFER_INVALID: offerError, OFFER_EXPIRED: offerError };
renderers.FLOW_DEFERRED = deferredFlowConfirmation;
renderers.MY_CARE = myCareScreen;
renderers.MY_GOALS = myGoals;
renderers.MY_CARE_CIRCLE = myCareCircleScreen;
renderers.CARE_CIRCLE_REMOVE_CONFIRMATION = careCircleRemoveConfirmation;

function devPanel() {
  if (import.meta.env.PROD) return "";
  const voice = emmiLive?.voiceIdentitySnapshot() || emmiVoiceMetadata(languageCode(), { sessionId: state.sessionId, screenId: state.screen });
  return `<aside class="dev-panel ${state.devOpen ? "open" : ""}"><button class="dev-toggle" data-action="dev">Demo</button><div><label>Scenario<select id="scenario-select">${Object.entries(SCENARIOS).map(([id, x]) => `<option value="${id}" ${id === state.scenarioId ? "selected" : ""}>${x.label}</option>`).join("")}</select></label><label>Jump to<select id="screen-select">${journeyFor(state).map(x => `<option value="${x}" ${x === state.screen ? "selected" : ""}>${x}</option>`).join("")}</select></label><section class="emmi-voice-debug" aria-label="EMMI Voice Debug"><strong>EMMI Voice Debug</strong><span>Internal locale: ${voice.locale}</span><span>Resolved language: ${voice.resolvedLanguage}</span><span>Speech locale: ${voice.resolvedSpeechLocale}</span><span>Voice: ${voice.voiceId || "TEXT_ONLY"}</span><span>Voice version: ${voice.voiceVersion}</span><span>Provider: ${voice.provider}</span><span>Model: ${EMMI_CONFIG.model}</span><span>Status: ${state.assistantVoiceState}</span><span>Capability: ${voice.capability}</span><span>Error: ${state.assistantVoiceError || "NONE"}</span><span>Session: ${voice.sessionId || state.sessionId}</span></section><button class="small-action" data-action="clear">Clear saved demo</button></div></aside>`;
}

function render() {
  clearTimeout(emmiGuidanceTimer);
  clearTimeout(emmiHesitationTimer);
  emmiHesitationCleanup?.();
  emmiHesitationCleanup = null;
  state.emmiContextualNudgeVisible = false;
  state.emmiVoiceOptionsOpen = false;
  document.body.classList.remove("emmi-sheet-open");
  state.assistantOpen = false;
  document.body.classList.remove("assistant-open");
  if (state.screen === "PROTOTYPE_SETUP") { app.innerHTML = prototypeSetup(); bindPrototypeSetup(); return; }
  if (state.screen === "OFFER_LOADING") { app.innerHTML = `<main class="shell patient-app-shell loading-screen" aria-live="polite">${art("shield")}<h1>${L("Opening your secure invitation…", "Abriendo su invitación segura…", "Ouvèti envitasyon sekirite w la...")}</h1></main>`; return; }
  if (["OFFER_INVALID", "OFFER_EXPIRED"].includes(state.screen)) { app.innerHTML = `<main class="shell patient-app-shell"><section class="screen centered-error">${offerError()}</section></main>`; return; }
  const renderer = renderers[state.screen] || (() => `${titleBlock(L("We need a moment", "Necesitamos un momento", "Nou bezwen yon ti moman"), L("Please call our care team for help.", "Llame a nuestro equipo de cuidado para obtener ayuda.", "Tanpri rele ekip swen nou an pou jwenn èd."))}`);
  const screenClass = state.screen === "DECISION_MAKER" ? "decision-maker-screen" : ["CARE_CIRCLE_INVITE", "CARE_CIRCLE_INVITE_SENT", "CARE_CIRCLE_PERMISSIONS", "MY_CARE_CIRCLE", "CARE_CIRCLE_REMOVE_CONFIRMATION", "SHARE_ACCESS"].includes(state.screen) ? `growth-screen${state.screen === "CARE_CIRCLE_INVITE" ? " care-circle-invite-screen" : ""}` : ["PERSONAL_REPRESENTATIVE_DETAILS", "REPRESENTATIVE_MOBILE_VERIFICATION", "REPRESENTATIVE_AUTHORITY_ATTESTATION", "REPRESENTATIVE_AUTHORITY_ESCALATION"].includes(state.screen) ? "representative-details-screen" : state.screen === "IDENTITY_VERIFICATION" ? "identity-screen" : state.screen === "CARE_RECOMMENDATION" ? "recommendation-screen" : state.screen === "HOW_CARE_WORKS" ? "care-works-screen" : state.screen === "DISCLOSURE" ? `important-information-screen${state.offer?.pathway === "ACCESS" ? " access-disclosure-screen" : ""}` :state.screen === "CONSENT_REVIEW" ? `consent-screen${state.offer?.pathway === "ACCESS" ? " access-consent-screen" : ""}` : state.screen === "ACCESS_PRE_ELIGIBILITY_NOTICE" ? "access-notice-screen" : state.screen === "ACCESS_ELIGIBILITY_PROCESSING" ? `eligibility-processing-screen${state.eligibilityError ? " eligibility-error-screen" : ""}` : state.screen === "CLINICAL_VERIFICATION" ? "health-information-review-screen" : state.screen === "MEDICATIONS_REVIEW" ? "medication-review-screen" : ["GOALS", "MY_GOALS"].includes(state.screen) ? "goals-screen" : "";
  const assuranceOverride = state.screen === "ACCESS_ELIGIBILITY_RESULT" && state.accessOutcome === "eligible" ? "NO_COMMITMENT_YET" : state.screen === "ACCESS_ELIGIBILITY_RESULT" && state.accessOutcome === "notEligible" ? "NOT_ELIGIBLE_REASSURANCE" : state.screen === "CONSENT_REVIEW" && state.offer?.pathway === "ACCESS" ? "ENROLLMENT_CHOICE" : state.screen === "ACCESS_MEASURE" && isBloodPressureAccessBaseline() ? "BP_HEALTH_DATA_SECURITY" : "";
  app.innerHTML = `<main class="shell patient-app-shell">${header()}<section class="screen ${screenClass}" id="screen-content">${voiceGuidancePanel()}${renderer()}${state.screen === "INVITATION" ? "" : contextualAssuranceFooter(state.screen, assuranceOverride)}</section>${emmiAssistant()}<div class="save-status" role="status" aria-live="polite"></div></main>${devPanel()}`;
  bind();
  const emmiTransitioned = syncEmmiNavigationContext();
  if (!emmiTransitioned) scheduleEmmiGuidance();
  scheduleEmmiHesitationSupport();
  requestAnimationFrame(() => document.querySelector("h1")?.focus({ preventScroll: true }));
  window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
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
    render();
  });
  document.querySelector('[data-action="launch-prototype"]')?.addEventListener("click", launchPrototype);
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
    state = { ...state, scenarioId: "prototype", screen: "OFFER_LOADING", offer: null, language: prototypeConfig.language, role: "patient", completionRole: "patient", representativeFullName: "", representativeRelationship: "", representativeAuthorityType: "", representativePhone: "", representativeOtpDeliveryId: "", representativeOtpResendAvailableAt: 0, phoneVerified: false, phoneVerificationMethod: "", phoneVerifiedAt: "", representativeAuthorityAttested: false, authorityAttestation: false, authorityAttestedAt: "", authorityVerificationMethod: AUTHORITY_VERIFICATION_METHODS[0], authorityAdditionalVerificationRequired: false, accessNoticeAcknowledgedAt: "", disclosureAcknowledgedAt: "", disclosureVersion: "", accessDisclosureView: null, consentRole: "", consentVersion: "", consentTimestamp: "", sessionId: globalThis.crypto?.randomUUID?.() || `session_${Date.now().toString(36)}`, identityVerified: false, accessEligible: false, accessOutcome: null, eligibilityPhase: "checkingEnrollment", eligibilityError: false, eligibilityRequestKey: "", devicePath: null, enrollmentStatus: "NOT_STARTED", enrollmentCompletedAt: "", baselineStatus: "NOT_STARTED", baselineStartedAt: "", baselineCompletedAt: "", baselineDeferredAt: "", baselineResumeScreen: "", baselineReminderStatus: "NOT_SCHEDULED", bpBaselineStatus: "NOT_STARTED", bpDevicePath: "", bpDeviceIdentificationMethod: "", bpDeviceVerificationStatus: "NOT_STARTED", bpDeviceVerificationResult: "", deviceSource: "UNKNOWN", deviceVerificationStatus: "NOT_STARTED", integrationProvider: "UNKNOWN", assignedDeviceId: "", deviceVendor: "", deviceModel: "", deviceStatus: "", integrationStatus: "", lastTransmissionAt: "", deviceUncertaintyStep: false, bpDevice: null, armCircumferenceValue: "", armCircumferenceUnit: "cm", armMeasurementStatus: "", armMeasurementHelpReason: "", armRestrictionReported: "", restrictedArm: "NONE", measurementArm: "PENDING", armHelpOpen: false, exactArmMeasurementOpen: false, cuffSelectionMethod: "", selectedCuffOption: "", cuffSelectionStatus: "", cuffSizeSelected: null, deviceModelSelected: null, shippingAddress: null, shippingAddressConfirmed: false, shippingAddressMode: "existing", deviceFulfillmentId: "", deviceFulfillmentStatus: "NOT_REQUESTED", careTeamTasks: [], bpDeviceFulfillmentStatus: "NOT_STARTED", bpDeviceFulfillmentRequestedAt: "", bpBaselineSourceType: "", bpReadings: [], bpReadingCount: 0, bpReadingReceipts: [], bpMeasurementPhase: "WAITING", bpBaseline: null, bpEscalationState: null, clinicalReportedBloodPressure: null, accessBaselineBloodPressure: null, audit: [], error: "" };
  Object.assign(state, { assistantDemoPatientId: "", assistantPatientContextKey: "" });
  Object.assign(state, { healthInformationStepStatus: "NOT_STARTED", healthInformationReviewStatus: "UNREVIEWED", healthInformationReviewResult: "", healthInformationReviewedAt: "", healthInformationReviewedBy: "", healthInformationReviewSource: "", healthInformationFlowStep: "CHOICE", healthInformationUpdateDraft: { id: "", updateType: "", relatedConditionIds: [], patientReportedText: "" }, patientReportedHealthUpdates: [], healthInformationHelpNote: "" });
  Object.assign(state, { goalsStatus: "NOT_STARTED", careGoals: [], careGoalsNote: "", goalFlowStep: "DISCOVERY", goalFlowOrigin: "ONBOARDING", patientGoals: [], goalPrimaryId: "", goalSecondaryId: "", goalPlanningGoalId: "", goalPlanStatus: "NOT_STARTED", goalPlanDraft: { actionIds: [], customAction: "", frequency: "few-days", remindersEnabled: false, whyItMatters: "" }, activeGoalId: "", goalDetailView: "SUMMARY", goalBarrierDraft: { barrierType: "", notes: "" }, goalSupportDraft: "", goalNotice: "", goalHistory: [] });
  const prototypeDeviceContext = service.getScenarioDeviceContext?.();
  Object.assign(state, { bpBaselineRequiredReadings: 3, bpBaselineReadingCount: 0, bpBaselineRemainingReadings: 3, firstTransmissionSystolic: null, firstTransmissionDiastolic: null });
  Object.assign(state, { activationStatus: "NOT_STARTED", activationStartedAt: "", deviceSetupStatus: "NOT_STARTED", deviceSetupStartedAt: "" });
  state.flowProgress = { GETTING_STARTED: emptyFlowProgress() };
  state.flowTransitionNotice = "";
  if (prototypeDeviceContext) Object.assign(state, {
    patientHasBloodPressureMonitor: Boolean(prototypeDeviceContext.patientOwnsMonitor),
    deviceSource: prototypeDeviceContext.deviceSource || "UNKNOWN",
    assignedDeviceId: prototypeDeviceContext.assignedDeviceId || "",
    last4DeviceId: (prototypeDeviceContext.assignedDeviceId || "").slice(-4),
    patientDeviceConfirmationChoice: "",
    patientDeviceConfirmed: null,
    patientDeviceConfirmedAt: "",
    confirmedDeviceId: "",
    firstTransmissionVerified: null,
    firstTransmissionDeviceId: "",
    firstTransmissionAt: "",
    deviceVendor: prototypeDeviceContext.deviceVendor || "",
    deviceStatus: prototypeDeviceContext.deviceStatus || "",
    integrationProvider: prototypeDeviceContext.integrationProvider || "UNKNOWN",
    integrationStatus: prototypeDeviceContext.integrationStatus || "UNKNOWN"
  });
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
    if (authorityMissing || !f.consent.checked || !f.enroll.checked) { state.error = L("Please complete each required confirmation to continue.", "Complete cada confirmación requerida para continuar.", "Tanpri ranpli tout konfimasyon ki nesesè pou kontinye."); render(); return; }
    state.busy = true; render();
    if (state.offer.pathway === "ACCESS" && !state.disclosureAcknowledgedAt) {
      await service.saveAcknowledgement();
      state.disclosureAcknowledgedAt = new Date().toISOString();
      state.disclosureVersion = state.offer.disclosures.version;
      audit(state, "disclosure_acknowledged", "success", { disclosureVersion: state.disclosureVersion, acknowledgedOn: "CONSENT_REVIEW" });
    }
    await service.saveConsent(); state.busy = false; state.consentSaved = true;
    state.consentRole = isPersonalRepresentative() ? "PERSONAL_REPRESENTATIVE" : "PATIENT";
    state.consentVersion = state.offer.consent.version;
    state.consentTimestamp = new Date().toISOString();
    audit(state, "consent_saved", "success", { consentRole: state.consentRole, consentVersion: state.consentVersion });
  }
  if (state.screen === "ENROLLMENT_CONFIRMED") {
    state.enrollmentConfirmed = true;
    state.enrollmentStatus = "COMPLETED";
    state.enrollmentCompletedAt ||= new Date().toISOString();
    state.activationStatus = "NOT_STARTED";
    if (state.offer.pathway === "ACCESS") {
      state.baselineStatus ||= "NOT_STARTED";
      state.baselineResumeScreen = "ACCESS_BASELINE";
    }
    if (["RPM", "CCM_RPM", "PCM_RPM"].includes(state.offer.pathway)) state.deviceSetupStatus ||= "NOT_STARTED";
    setGettingStartedProgress(FLOW_STATUS.NOT_STARTED, { resumeRoute: currentNextBestAction().route });
    audit(state, "next_flow_presented", "success", { enrollmentStatus: state.enrollmentStatus, nextFlowType: "GETTING_STARTED", pathway: state.offer.pathway });
  }
  if (state.screen === "ACCESS_BASELINE") {
    state.enrollmentStatus = "COMPLETED";
    state.enrollmentCompletedAt ||= state.consentTimestamp || new Date().toISOString();
    if (state.baselineStatus === "NOT_STARTED") {
      state.baselineStatus = "IN_PROGRESS";
      state.baselineStartedAt = new Date().toISOString();
      audit(state, "baseline_started", "success", { baselineStatus: state.baselineStatus });
    }
    state.baselineResumeScreen = "ACCESS_MEASURE";
    state.baselineReminderStatus = "NOT_SCHEDULED";
  }
  if (state.screen === "ACCESS_MEASURE") {
    state.enrollmentStatus = "COMPLETED";
    if (isBloodPressureAccessBaseline()) {
      const path = new FormData(document.querySelector("form")).get("choice");
      if (!path) { state.error = L("Choose the option that best describes your monitor.", "Elija la opción que mejor describa su monitor.", "Chwazi opsyon ki pi byen dekri aparèy ou a."); render(); return; }
      state.bpDevicePath = path;
      state.baselineStatus = "IN_PROGRESS";
      state.bpReadings = [];
      state.bpReadingCount = 0;
      state.bpBaselineRequiredReadings = 3;
      state.bpBaselineReadingCount = 0;
      state.bpBaselineRemainingReadings = 3;
      state.bpReadingReceipts = [];
      state.bpMeasurementPhase = "WAITING";
      state.bpBaseline = null;
      state.bpEscalationState = null;
      state.firstTransmissionVerified = null;
      state.firstTransmissionDeviceId = "";
      state.firstTransmissionAt = "";
      state.firstTransmissionSystolic = null;
      state.firstTransmissionDiastolic = null;
      if (path === "needed") {
        state.bpBaselineStatus = "DEVICE_VERIFICATION";
        state.bpDeviceVerificationStatus = "NOT_STARTED";
        state.deviceSource = "UNKNOWN";
        state.deviceVerificationStatus = "PENDING_DEVICE";
        state.deviceFulfillmentStatus = "NOT_REQUESTED";
        state.bpDeviceFulfillmentStatus = "NOT_STARTED";
        state.baselineResumeScreen = "ACCESS_BP_DEVICE_INFO";
        state.baselineReminderStatus = "NOT_SCHEDULED";
        audit(state, "bp_device_information_started", "success", { bpBaselineStatus: state.bpBaselineStatus });
      } else {
        state.bpBaselineStatus = "DEVICE_VERIFICATION";
        state.bpDeviceVerificationStatus = path === "owned" ? "PENDING" : "ASSISTED_SETUP_REQUIRED";
        state.deviceSource = path === "owned" ? "UNKNOWN" : "PATIENT_OWNED";
        state.deviceVerificationStatus = path === "owned" ? "CHECKING" : "PATIENT_CONFIRMED";
        state.deviceUncertaintyStep = false;
        state.baselineResumeScreen = path === "owned" ? "ACCESS_BP_DEVICE_VERIFICATION" : "ACCESS_BP_GUIDED_SETUP";
        state.baselineReminderStatus = "NOT_SCHEDULED";
        audit(state, "bp_device_path_selected", "success", { path, bpBaselineStatus: state.bpBaselineStatus });
      }
    } else if (state.baselineStatus !== "COMPLETED") {
      state.baselineStatus = "COMPLETED";
      state.baselineCompletedAt = new Date().toISOString();
      state.baselineResumeScreen = "";
      state.baselineReminderStatus = "NOT_NEEDED";
      audit(state, "baseline_completed", "success", { baselineStatus: state.baselineStatus });
    }
  }
  if (state.screen === "ACCESS_BP_DEVICE_INFO") {
    const form = document.querySelector("#bp-device-info-form");
    const data = Object.fromEntries(new FormData(form));
    const restriction = data.armRestrictionReported || state.armRestrictionReported;
    if (!["NO", "YES", "UNSURE"].includes(restriction)) { state.error = L("Choose an answer about arm restrictions.", "Seleccione una respuesta sobre las restricciones del brazo.", "Chwazi yon repons sou restriksyon bra."); render(); return; }
    const restrictedArm = restriction === "YES" ? data.restrictedArm : "NONE";
    if (restriction === "YES" && !["LEFT", "RIGHT", "BOTH"].includes(restrictedArm)) { state.error = L("Choose which arm has the restriction.", "Seleccione qué brazo tiene la restricción.", "Chwazi ki bra ki gen restriksyon an."); render(); return; }
    state.armRestrictionReported = restriction;
    state.restrictedArm = restrictedArm;
    state.measurementArm = restriction === "YES" && restrictedArm === "LEFT" ? "RIGHT" : restriction === "YES" && restrictedArm === "RIGHT" ? "LEFT" : "PENDING";
    const specialReview = restriction === "UNSURE" || restrictedArm === "BOTH";
    const deviceConfiguration = bpFulfillmentDeviceConfiguration();
    const availableCuffs = (deviceConfiguration?.cuffOptions || []).filter(option => option.inventoryStatus === "AVAILABLE" && option.compatibleDeviceModels.includes(deviceConfiguration.id));
    state.deviceModelSelected = deviceConfiguration?.id || null;
    if (specialReview) {
      state.cuffSelectionMethod = "CARE_TEAM_ASSISTANCE";
      state.selectedCuffOption = "";
      state.cuffSizeSelected = null;
      state.cuffSelectionStatus = "NEEDS_ASSISTANCE";
      state.armMeasurementStatus = "NEEDS_ASSISTANCE";
    } else if (state.exactArmMeasurementOpen) {
      const value = Number(data.armCircumferenceValue);
      const unit = data.armCircumferenceUnit === "in" ? "in" : "cm";
      const valid = Number.isFinite(value) && (unit === "cm" ? value >= 10 && value <= 80 : value >= 4 && value <= 32);
      if (!valid) { state.error = L("Enter a reasonable arm measurement.", "Ingrese una medida razonable del brazo.", "Antre yon mezi bra ki rezonab."); render(); return; }
      const valueCm = unit === "in" ? value * 2.54 : value;
      const matches = availableCuffs.filter(option => valueCm >= option.minArmCircumference && valueCm <= option.maxArmCircumference).sort((a, b) => Math.abs(valueCm - ((a.minArmCircumference + a.maxArmCircumference) / 2)) - Math.abs(valueCm - ((b.minArmCircumference + b.maxArmCircumference) / 2)));
      state.armCircumferenceValue = String(value);
      state.armCircumferenceUnit = unit;
      state.armMeasurementStatus = "COMPLETED";
      state.cuffSelectionMethod = "ARM_MEASUREMENT";
      state.selectedCuffOption = matches[0]?.id || "";
      state.cuffSizeSelected = matches[0]?.labelKey || null;
      state.cuffSelectionStatus = matches.length ? "AUTO_MATCHED" : "NEEDS_ASSISTANCE";
    } else {
      const selectedId = data.choice || state.selectedCuffOption;
      if (!selectedId) { state.error = L("Choose a cuff size or select that you’re not sure.", "Elija un tamaño de brazalete o indique que no está seguro.", "Chwazi yon gwosè manchèt oswa di ou pa sèten."); render(); return; }
      if (selectedId === "UNSURE") {
        state.cuffSelectionMethod = "CARE_TEAM_ASSISTANCE";
        state.selectedCuffOption = "";
        state.cuffSizeSelected = null;
        state.cuffSelectionStatus = "NEEDS_ASSISTANCE";
        state.armMeasurementStatus = "NEEDS_ASSISTANCE";
      } else {
        const selectedOption = availableCuffs.find(option => option.id === selectedId);
        if (!selectedOption) { state.error = L("That cuff is not currently available for this monitor. Choose another option.", "Ese brazalete no está disponible actualmente para este monitor. Elija otra opción.", "Manchèt sa a pa disponib kounye a pou aparèy sa a. Chwazi yon lòt opsyon."); render(); return; }
        state.cuffSelectionMethod = "PATIENT_SELECTED";
        state.selectedCuffOption = selectedOption.id;
        state.cuffSizeSelected = selectedOption.labelKey;
        state.cuffSelectionStatus = "SELECTED";
        state.armMeasurementStatus = "NOT_REQUIRED";
        state.armCircumferenceValue = "";
      }
    }
    const tasks = [...(state.careTeamTasks || [])];
    const addTask = (type, reason) => { if (!tasks.some(task => task.type === type && task.status === "OPEN")) tasks.push({ id: `${type.toLowerCase()}_${Date.now().toString(36)}`, type, reason, status: "OPEN", createdAt: new Date().toISOString() }); };
    if (state.cuffSelectionStatus === "NEEDS_ASSISTANCE") addTask("CUFF_SELECTION_ASSISTANCE", state.cuffSelectionMethod);
    if (["YES", "UNSURE"].includes(restriction)) addTask("ARM_RESTRICTION_REVIEW", restriction);
    state.careTeamTasks = tasks;
    state.baselineResumeScreen = "ACCESS_BP_SHIPPING_ADDRESS";
    audit(state, "bp_device_information_saved", "success", { armMeasurementStatus: state.armMeasurementStatus, armRestrictionReported: restriction, restrictedArm, measurementArm: state.measurementArm, cuffSelectionMethod: state.cuffSelectionMethod, cuffSelectionStatus: state.cuffSelectionStatus, selectedCuffOption: state.selectedCuffOption, deviceModelSelected: state.deviceModelSelected });
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
    const result = await service.createBpDeviceFulfillment({ shippingAddress: address, armMeasurementStatus: state.armMeasurementStatus, armRestrictionReported: state.armRestrictionReported, cuffSelectionMethod: state.cuffSelectionMethod, selectedCuffOption: state.selectedCuffOption, cuffSelectionStatus: state.cuffSelectionStatus, deviceModelSelected: state.deviceModelSelected });
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
      healthInformationStepStatus: state.healthInformationStepStatus,
      healthInformationReviewStatus: state.healthInformationReviewStatus,
      medicationsReviewStatus: state.medicationsReviewStatus,
      carePreferencesStatus: state.carePreferencesStatus,
      goalsStatus: state.goalsStatus,
      savedAt: new Date().toISOString()
    };
    audit(state, "care_setup_saved", "success", { completedSections: [state.healthInformationStepStatus, state.medicationsReviewStatus, state.carePreferencesStatus, state.goalsStatus].filter(status => status === "COMPLETED").length, healthInformationReviewStatus: state.healthInformationReviewStatus });
    state.screen = "ONBOARDING_COMPLETE";
    draftStore.save(state); render(); return;
  }
  if (state.screen === "CLINICAL_VERIFICATION") {
    state.error = L("Choose how you would like to review this information.", "Elija cómo desea revisar esta información.", "Chwazi kijan ou ta renmen revize enfòmasyon sa a.");
    render(); return;
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
  // GOALS uses its own multi-step actions so discovery, priority and planning remain auditable.
  if (state.screen === "GOALS") return;
  if (state.screen === "RPM_DEVICE_PATH") { state.devicePath = new FormData(document.querySelector("form")).get("choice"); if (state.devicePath === "help" || !state.devicePath) { showHelp(); return; } }
  if (state.screen === "RPM_ADDRESS_CONFIRMATION") state.addressConfirmed = true;
  if (state.screen === "RPM_DEVICE_SETUP") state.setupComplete = true;
  if (state.screen === "RPM_FIRST_READING") {
    state.busy = true; render(); const result = await service.submitFirstReading(); state.busy = false;
    if (result.status !== "received") { state.error = "reading"; audit(state, "first_reading", "not_received"); render(); return; }
    state.readingReceived = true; state.reading = result; audit(state, "first_reading", "received");
  }
  state.screen = nextScreen(state); draftStore.save(state); render();
  if (state.screen === "ACCESS_ELIGIBILITY_PROCESSING") runEligibility();
  if (state.screen === "ENROLLMENT_PROCESSING") runEnrollment();
  if (state.screen === "ACCESS_ALIGNMENT_PROCESSING") runAlignment();
  if (state.screen === "ACCESS_BP_DEVICE_VERIFICATION" && state.deviceVerificationStatus === "CHECKING") runAssignedDeviceLookup();
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
function refreshAssistantLayer({ focusInput = false } = {}) {
  const current = document.querySelector(".assistant-layer");
  if (!current) return;
  const draft = current.querySelector("#assistant-question")?.value || "";
  const activeSelection = document.activeElement?.id === "assistant-question";
  current.outerHTML = assistantLayer();
  bindAssistantLayer();
  const layer = document.querySelector(".assistant-layer");
  const input = layer?.querySelector("#assistant-question");
  if (input && draft) input.value = draft;
  if (focusInput || activeSelection) input?.focus();
  else layer?.querySelector(".assistant-conversation")?.lastElementChild?.scrollIntoView({ block: "nearest" });
}

async function askEmmi(question, { questionId = "", source = "input" } = {}) {
  const cleaned = question.trim();
  if (!cleaned || state.assistantBusy) return;
  const runtime = ensureEmmiRuntime();
  state.assistantError = "";
  state.assistantRetryQuestion = "";
  state.assistantMessages.push({ role: "user", text: cleaned });
  emmiConversationManager?.recordTurn("user", cleaned, { screen: state.screen });
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
    const response = await assistantAnswer(cleaned, assistantContext());
    state.assistantPendingAction = response.pendingAction || state.assistantPendingAction;
    state.assistantMessages.push({ role: "assistant", text: response.text, emergency: response.emergency, quickAction: response.quickAction || "" });
    emmiConversationManager?.recordTurn("assistant", response.text, { screen: state.screen });
    if (emmiConversationManager?.greetingAllowed()) emmiConversationManager.markGreeted();
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
  if (languageChanged) { render(); return; }
  refreshVoiceGuidanceControls();
  requestAnimationFrame(() => {
    window.scrollTo({ top: scrollY, behavior: "auto" });
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
    askEmmi(new FormData(event.currentTarget).get("question")?.toString() || "");
  });
  layer.querySelectorAll("[data-assistant-question]").forEach(button => button.addEventListener("click", () => askEmmi(button.dataset.assistantQuestion || "", { questionId: button.dataset.questionId || "", source: "quick-question" })));
  layer.querySelectorAll("[data-assistant-growth]").forEach(button => button.addEventListener("click", () => {
    const growthAction = button.dataset.assistantGrowth;
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
    render();
  }));
  layer.querySelectorAll("[data-assistant-action]").forEach(control => control.addEventListener("click", event => {
    const action = control.dataset.assistantAction;
    // The care team number is a real phone call, so the link is left to do its job.
    if (action === "human-support") { audit(state, "emmi_human_support_selected", "success", { screen: state.screen, channel: "phone" }); return; }
    event.preventDefault();
    if (action === "close") closeAssistant();
    if (action === "faq") { state.assistantFaqOpen = !state.assistantFaqOpen; refreshAssistantLayer(); }
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
  if (state.assistantOriginScreen !== state.screen) state.assistantFaqOpen = false;
  emmiExpandedReturnFocus = trigger instanceof HTMLElement ? trigger : null;
  emmiExpandedSource = emmiExpandedReturnFocus?.dataset.emmiSource || "screen-action";
  state.assistantOpen = true;
  state.assistantOriginScreen = state.screen;
  state.assistantScrollY = window.scrollY;
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
    const preserveArmForm = () => {
      const form = document.querySelector("#bp-device-info-form");
      if (!form) return;
      const data = Object.fromEntries(new FormData(form));
      state.armCircumferenceValue = String(data.armCircumferenceValue || state.armCircumferenceValue || "");
      state.armCircumferenceUnit = data.armCircumferenceUnit || state.armCircumferenceUnit || "cm";
      state.armRestrictionReported = data.armRestrictionReported || state.armRestrictionReported;
      state.restrictedArm = state.armRestrictionReported === "YES" ? (data.restrictedArm || state.restrictedArm) : "NONE";
      state.selectedCuffOption = data.choice || state.selectedCuffOption || "";
    };
    const addArmCareTask = (type, reason) => {
      const tasks = [...(state.careTeamTasks || [])];
      if (!tasks.some(task => task.type === type && task.status === "OPEN")) tasks.push({ id: `${type.toLowerCase()}_${Date.now().toString(36)}`, type, reason, status: "OPEN", createdAt: new Date().toISOString() });
      state.careTeamTasks = tasks;
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
      try {
        const contacts = await navigator.contacts.select(["name", "tel"], { multiple: false });
        const contact = contacts?.[0];
        if (!contact) { state.careCircleNotice = L("No contact was selected. You can enter their information below.", "No se seleccionó ningún contacto. Puede ingresar sus datos abajo.", "Ou pa chwazi okenn kontak. Ou ka antre enfòmasyon yo anba a."); render(); return; }
        const rawNumbers = (contact.tel || []).map(item => typeof item === "string" ? { value: item, label: L("Mobile", "Celular", "Mobil") } : { value: item.value || "", label: item.type?.[0] || item.type || L("Mobile", "Celular", "Mobil") }).filter(item => phoneDigits(item.value).length === 10);
        state.supportPersonName = String(contact.name?.[0] || contact.name || "").trim();
        state.careCircleContactNumbers = rawNumbers;
        state.careCircleContactSource = "CONTACT_PICKER";
        state.supportPersonPhone = rawNumbers.length === 1 ? formatPhone(rawNumbers[0].value) : "";
        state.careCircleNotice = rawNumbers.length ? "" : L("This contact has no mobile number. Please enter one below.", "Este contacto no tiene un número celular. Ingrese uno abajo.", "Kontak sa a pa gen nimewo mobil. Tanpri antre youn anba a.");
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
      const today = new Date().toISOString().slice(0,10); item.completionHistory ||= [];
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
    if (action === "save-goal-barrier") {
      const goal = currentGoal(); const data = new FormData(document.querySelector("#goal-barrier-form")); const barrierType = String(data.get("barrierType") || ""); const notes = String(data.get("barrierNotes") || "").trim().slice(0,300);
      if (!barrierType) { state.error = L("Choose what is getting in the way.", "Elija qué se lo está dificultando.", "Chwazi sa k ap anpeche w."); render(); return; }
      const createdAt = new Date().toISOString(); const barrier = { id: `goal_barrier_${Date.now().toString(36)}`, goalId: goal.id, barrierType, notes, status: "OPEN", createdAt };
      goal.barriers = [...(goal.barriers || []), barrier]; goalHistoryEvent(goal.id, "BARRIER_REPORTED", { barrierType });
      const urgent = /(severe chest pain|chest pain|can'?t breathe|cannot breathe|dolor fuerte en el pecho|dolor en el pecho|no puedo respirar|gwo doulè nan pwatrin|pa ka respire)/i.test(notes);
      if (urgent) {
        ensureGoalCareTeamTask("CLINICAL_SAFETY_ESCALATION", goal, { barrierId: barrier.id, priority: "URGENT_REVIEW", reason: "POTENTIAL_URGENT_SYMPTOM" });
        state.goalNotice = L("Your message may describe an urgent symptom. Call 911 now if you have severe chest pain or trouble breathing. Your care team was also notified.", "Su mensaje puede describir un síntoma urgente. Llame al 911 ahora si tiene dolor intenso en el pecho o dificultad para respirar. También avisamos a su equipo.", "Mesaj ou ka dekri yon sentòm ijan. Rele 911 kounye a si ou gen gwo doulè nan pwatrin oswa pwoblèm pou respire. Nou avèti ekip swen ou tou.");
        state.goalDetailView = "SUMMARY";
      } else state.goalDetailView = "SUPPORT";
      state.error = ""; draftStore.save(state); render(); return;
    }
    if (action === "goal-support-request") {
      const goal = currentGoal(); if (!goal) return;
      const supportType = el.dataset.support; const createdAt = new Date().toISOString();
      const taskType = supportType === "ADJUST_PLAN" ? "GOAL_PLAN_REVIEW" : supportType === "CARE_TEAM" || supportType === "UNSURE" ? "GOAL_SUPPORT" : supportType === "EXPLAIN" ? "PATIENT_BARRIER_REVIEW" : "";
      const task = taskType ? ensureGoalCareTeamTask(taskType, goal, { supportType, priority: "ROUTINE" }) : null;
      goal.supportRequests = [...(goal.supportRequests || []), { id: `goal_support_${Date.now().toString(36)}`, goalId: goal.id, supportType, careTeamTaskId: task?.id || null, status: task ? "REQUESTED" : "ACTIVE", createdAt }];
      goalHistoryEvent(goal.id, "SUPPORT_REQUESTED", { supportType, careTeamTaskId: task?.id || null });
      state.goalNotice = supportType === "REMINDER" ? L("We’ll use your reminder preference for this goal.", "Usaremos su preferencia de recordatorios para esta meta.", "N ap itilize preferans rapèl ou pou objektif sa a.") : L("Your request was shared with your care team.", "Su solicitud fue compartida con su equipo de atención.", "Nou pataje demann ou ak ekip swen ou.");
      state.goalDetailView = "SUMMARY"; draftStore.save(state); render(); return;
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
      const resumeRoute = progress.resumeRoute || transition.nextRoute;
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
      return;
    }
    if (action === "defer-next-flow") {
      const transition = currentFlowTransition();
      const now = new Date().toISOString();
      state.enrollmentConfirmed = true;
      state.enrollmentStatus = "COMPLETED";
      state.enrollmentCompletedAt ||= state.consentTimestamp || now;
      setGettingStartedProgress(FLOW_STATUS.DEFERRED, { deferredAt: now, resumeRoute: transition.nextRoute });
      state.activationStatus = "NOT_STARTED";
      state.baselineDeferredAt = now;
      state.baselineResumeScreen = transition.nextRoute;
      audit(state, "next_flow_deferred", "success", { completedFlow: transition.completedFlow, nextFlowType: transition.nextFlow, resumeRoute: transition.nextRoute });
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
      } else if (state.screen === "MY_CARE_CIRCLE") {
        state.screen = "MY_CARE"; render();
      } else if (state.screen === "CARE_CIRCLE_REMOVE_CONFIRMATION") {
        state.screen = "MY_CARE_CIRCLE"; render();
      } else if (["CLINICAL_VERIFICATION", "MEDICATIONS_REVIEW", "CARE_PREFERENCES", "GOALS"].includes(state.screen) && state.returnScreen === "ONBOARDING") {
        state.screen = "ONBOARDING";
        state.baselineResumeScreen = "ONBOARDING";
        draftStore.save(state); render();
      } else { state.screen = previousScreen(state); render(); }
    }
    if (action === "care-setup-section") {
      const destination = { health: "CLINICAL_VERIFICATION", medications: "MEDICATIONS_REVIEW", preferences: "CARE_PREFERENCES", goals: "GOALS" }[el.dataset.section];
      if (!destination) return;
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
    if (action === "open-add-medication") { state.medicationAddOpen = true; state.medicationEditId = ""; state.error = ""; render(); }
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
    if (action === "arm-help-toggle") {
      preserveArmForm();
      state.armHelpOpen = !state.armHelpOpen;
      state.error = ""; render();
    }
    if (action === "toggle-exact-arm-measurement") {
      preserveArmForm();
      state.exactArmMeasurementOpen = !state.exactArmMeasurementOpen;
      if (state.exactArmMeasurementOpen) state.selectedCuffOption = "";
      state.cuffSelectionMethod = state.exactArmMeasurementOpen ? "ARM_MEASUREMENT" : "";
      state.cuffSelectionStatus = "";
      state.error = "";
      render();
    }
    if (["arm-help-no-tape", "arm-help-unsure", "arm-help-care-team"].includes(action)) {
      preserveArmForm();
      const clinicalReview = state.armRestrictionReported === "UNSURE" || state.restrictedArm === "BOTH";
      state.armMeasurementStatus = clinicalReview ? "PENDING_CLINICAL_REVIEW" : "NEEDS_ASSISTANCE";
      state.measurementArm = clinicalReview ? "PENDING" : state.restrictedArm === "LEFT" ? "RIGHT" : state.restrictedArm === "RIGHT" ? "LEFT" : "PENDING";
      state.armMeasurementHelpReason = action === "arm-help-no-tape" ? "NO_MEASURING_TAPE" : action === "arm-help-unsure" ? "MEASUREMENT_INSTRUCTIONS" : "CARE_TEAM_REQUEST";
      addArmCareTask(clinicalReview ? "ARM_CLINICAL_REVIEW" : "ARM_MEASUREMENT_ASSISTANCE", state.armMeasurementHelpReason);
      state.baselineReminderStatus = "CARE_TEAM_ASSISTANCE";
      state.armHelpOpen = false;
      state.error = "";
      draftStore.save(state);
      render();
      if (action === "arm-help-care-team") showHelp();
    }
    if (action === "arm-review-continue") {
      preserveArmForm();
      state.armMeasurementStatus = "PENDING_CLINICAL_REVIEW";
      state.measurementArm = "PENDING";
      state.cuffSelectionMethod = "CARE_TEAM_ASSISTANCE";
      state.selectedCuffOption = "";
      state.cuffSelectionStatus = "NEEDS_ASSISTANCE";
      state.deviceModelSelected = bpFulfillmentDeviceConfiguration()?.id || null;
      state.enrollmentStatus = "COMPLETED";
      state.baselineStatus = "IN_PROGRESS";
      state.bpBaselineStatus = "DEVICE_VERIFICATION";
      state.baselineResumeScreen = "ACCESS_BP_DEVICE_INFO";
      state.baselineReminderStatus = "CARE_TEAM_ASSISTANCE";
      addArmCareTask("ARM_CLINICAL_REVIEW", state.armRestrictionReported === "UNSURE" ? "RESTRICTION_UNSURE" : "BOTH_ARMS_RESTRICTED");
      addArmCareTask("CUFF_SELECTION_ASSISTANCE", "ARM_RESTRICTION_REVIEW");
      audit(state, "bp_arm_clinical_review_requested", "success", { armRestrictionReported: state.armRestrictionReported, restrictedArm: state.restrictedArm, measurementArm: state.measurementArm });
      state.screen = "ONBOARDING";
      draftStore.save(state); render();
    }
    if (action === "bp-defer-health-check") {
      state.enrollmentStatus = "COMPLETED";
      state.baselineStatus = "IN_PROGRESS";
      state.bpBaselineStatus = "PENDING_DEVICE";
      state.baselineDeferredAt = new Date().toISOString();
      state.baselineResumeScreen = "ONBOARDING";
      state.baselineReminderStatus = "PENDING_DEVICE";
      audit(state, "baseline_deferred", "success", { reason: "PENDING_DEVICE", fulfillmentId: state.deviceFulfillmentId });
      draftStore.save(state);
      document.querySelector(".save-status").textContent = L("Your remaining health check is saved for later.", "El resto de su evaluación quedó guardado para después.", "Rès tchekòp sante ou anrejistre pou pita.");
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
    if (action === "restart") { state.screen = "INVITATION"; render(); }
    if (action === "secondary") {
      if (state.screen === "ACCESS_BASELINE") {
        state.enrollmentStatus = "COMPLETED";
        state.enrollmentCompletedAt ||= state.consentTimestamp || new Date().toISOString();
        state.baselineStatus = state.baselineStatus === "IN_PROGRESS" ? "IN_PROGRESS" : "NOT_STARTED";
        state.baselineDeferredAt = new Date().toISOString();
        state.baselineResumeScreen = state.screen;
        state.baselineReminderStatus = "PENDING";
        setGettingStartedProgress(FLOW_STATUS.DEFERRED, { deferredAt: state.baselineDeferredAt, resumeRoute: state.screen });
        audit(state, "baseline_deferred", "success", { baselineStatus: state.baselineStatus, reminderStatus: state.baselineReminderStatus });
        draftStore.save(state);
        document.querySelector(".save-status").textContent = L("Your health check is saved for later.", "Su evaluación de salud quedó guardada para después.", "Tchekòp sante ou anrejistre pou pita.");
      } else if (state.screen === "ONBOARDING") {
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
    if (action === "clear") { draftStore.clear(); location.reload(); }
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
    const value = Number(data.get("armCircumferenceValue"));
    const unit = data.get("armCircumferenceUnit") === "in" ? "in" : "cm";
    const measurementReady = state.exactArmMeasurementOpen && Number.isFinite(value) && (unit === "cm" ? value >= 10 && value <= 80 : value >= 4 && value <= 32);
    const cuffReady = !state.exactArmMeasurementOpen && Boolean(data.get("choice") || state.selectedCuffOption);
    const restriction = data.get("armRestrictionReported");
    bpDeviceInfoCta.disabled = !((measurementReady || cuffReady) && ["NO", "YES"].includes(restriction) && (restriction !== "YES" || ["LEFT", "RIGHT"].includes(data.get("restrictedArm"))));
  };
  bpDeviceInfoForm?.addEventListener("input", updateBpDeviceInfoCta);
  bpDeviceInfoForm?.addEventListener("change", event => {
    if (["armRestrictionReported", "restrictedArm"].includes(event.target.name)) {
      const data = Object.fromEntries(new FormData(bpDeviceInfoForm));
      state.armCircumferenceValue = String(data.armCircumferenceValue || state.armCircumferenceValue || "");
      state.armCircumferenceUnit = data.armCircumferenceUnit || state.armCircumferenceUnit || "cm";
      state.armRestrictionReported = data.armRestrictionReported || "";
      state.restrictedArm = state.armRestrictionReported === "YES" ? (data.restrictedArm || "NONE") : "NONE";
      state.measurementArm = state.restrictedArm === "LEFT" ? "RIGHT" : state.restrictedArm === "RIGHT" ? "LEFT" : "PENDING";
      state.armMeasurementStatus = "";
      state.armMeasurementHelpReason = "";
      state.armHelpOpen = false;
      state.error = "";
      draftStore.save(state);
      render();
      return;
    }
    if (event.target.name === "choice") {
      state.selectedCuffOption = event.target.value;
      state.exactArmMeasurementOpen = false;
      state.cuffSelectionMethod = event.target.value === "UNSURE" ? "CARE_TEAM_ASSISTANCE" : "PATIENT_SELECTED";
      state.cuffSelectionStatus = event.target.value === "UNSURE" ? "NEEDS_ASSISTANCE" : "";
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
  const accepted = activeInvite?.status === "ACCEPTED";
  const patient = activeInvite?.patientFirstName || L("The patient", "El paciente", "Pasyan an");
  app.innerHTML = `<main class="public-growth-page">${publicBrandHeader()}<section class="public-growth-content">${art(available ? "people" : "lock", accepted)}${available ? titleBlock(accepted ? L("You’re ready to help", "Ya puede ayudar", "Ou pare pou ede") : L("You’ve been invited to join a Care Circle", "Le han invitado a un Círculo de cuidado", "Yo envite w antre nan yon Sèk swen"), accepted ? L("You can now provide basic support through ITERA HEALTH.", "Ahora puede brindar apoyo básico mediante ITERA HEALTH.", "Kounye a ou ka bay sipò debaz atravè ITERA HEALTH.") : L("Someone you know invited you to provide basic support with their care experience.", "Alguien que conoce le invitó a brindar apoyo básico con su experiencia de cuidado.", "Yon moun ou konnen envite w bay sipò debaz ak eksperyans swen li.")) : titleBlock(L("This invitation is no longer available", "Esta invitación ya no está disponible", "Envitasyon sa a pa disponib ankò"), L("Ask the patient to send a new secure invitation.", "Pida al paciente que envíe una nueva invitación segura.", "Mande pasyan an voye yon nouvo envitasyon an sekirite."))}${available ? `<section class="care-circle-boundaries"><h2>${L("What Care Circle support means", "Qué significa el apoyo del Círculo de cuidado", "Sa sipò Sèk swen vle di")}</h2><p>${icon("check")} ${L("You may help with reminders and basic care tasks the patient chooses.", "Puede ayudar con recordatorios y tareas básicas que el paciente elija.", "Ou ka ede ak rapèl ak travay swen debaz pasyan an chwazi.")}</p><p>${icon("shield")} ${L("You cannot consent, sign, or make healthcare decisions for the patient. This does not make you a Personal Representative.", "No puede dar consentimiento, firmar ni tomar decisiones médicas por el paciente. Esto no le convierte en Representante personal.", "Ou pa ka bay konsantman, siyen, oswa pran desizyon swen sante pou pasyan an. Sa pa fè w yon Reprezantan pèsonèl.")}</p></section>${accepted ? `<p class="growth-success-note">${icon("check")} ${L("Care Circle invitation accepted", "Invitación al Círculo de cuidado aceptada", "Envitasyon Sèk swen aksepte")}</p>` : `<button type="button" class="button primary" data-public-action="accept-support">${L("Accept invitation", "Aceptar invitación", "Aksepte envitasyon")} ${icon("arrowRight")}</button>`}` : ""}</section></main>`;
  app.querySelector('[data-public-action="language"]')?.addEventListener("click", () => { setLanguage(state.language === "en" ? "es" : state.language === "es" ? "ht" : "en"); renderSupportAcceptance(); });
  app.querySelector('[data-public-action="accept-support"]')?.addEventListener("click", () => { growthStore.acceptSupportInvite(token); renderSupportAcceptance(); });
}

async function boot() {
  const savedLanguage = (() => { try { return localStorage.getItem("itera.enrollment.language.v1"); } catch { return null; } })();
  if (["en", "es", "ht"].includes(savedLanguage)) state.language = savedLanguage;
  Object.assign(state, growthStore.readPromptPreferences());
  if (location.pathname === "/access/learn") { renderPublicAccessLanding(); return; }
  if (location.pathname === "/support/accept" || location.pathname.startsWith("/care-circle/invite/")) { renderSupportAcceptance(); return; }
  try {
    state.offer = await service.getOffer();
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
        barriers: Array.isArray(goal.barriers) ? goal.barriers : [],
        supportRequests: Array.isArray(goal.supportRequests) ? goal.supportRequests : [],
        reviews: Array.isArray(goal.reviews) ? goal.reviews : []
      }));
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
      if (!saved.measurementArm) state.measurementArm = saved.preferredMeasurementArm === "LEFT" || saved.preferredMeasurementArm === "RIGHT" ? saved.preferredMeasurementArm : "PENDING";
      if (!Number.isInteger(saved.bpReadingCount)) state.bpReadingCount = state.bpReadingReceipts.length;
      if (!saved.bpMeasurementPhase) state.bpMeasurementPhase = "WAITING";
      if (!saved.flowProgress?.GETTING_STARTED) state.flowProgress = { GETTING_STARTED: emptyFlowProgress() };
      if (saved.baselineResumeScreen && state.baselineStatus !== "COMPLETED" && state.flowProgress.GETTING_STARTED.status === FLOW_STATUS.IN_PROGRESS && !["MY_CARE", "FLOW_DEFERRED"].includes(saved.screen)) state.screen = saved.baselineResumeScreen;
      if (state.screen === "REPRESENTATIVE_MOBILE_VERIFICATION" && !state.phoneVerified) state.screen = "PERSONAL_REPRESENTATIVE_DETAILS";
    }
    else {
      state.screen = "INVITATION";
      const preferredLanguage = state.offer.selectedLanguage || (() => { try { return localStorage.getItem("itera.enrollment.language.v1"); } catch { return null; } })();
      if (["en", "es", "ht"].includes(preferredLanguage)) state.language = preferredLanguage;
      if (state.offer.fixture.representative) { state.role = "representative"; state.completionRole = "personalRepresentative"; }
    }
    const storedInvite = patientShareSource ? null : growthStore.allSupportInvites().filter(invite => invite.inviterPatientId === state.offer.patient.id).at(-1);
    if (storedInvite && !state.supportInviteId) Object.assign(state, { supportRole: "CARE_CIRCLE_MEMBER", careCircleStatus: storedInvite.careCircleStatus || (storedInvite.status === "ACCEPTED" ? "ACTIVE" : "INVITED"), supportPersonName: storedInvite.supportPerson.name, supportPersonPhone: formatPhone(storedInvite.supportPerson.phone), supportPersonRelationship: storedInvite.supportPerson.relationship, supportInviteId: storedInvite.inviteId, supportInviteToken: storedInvite.token, supportInviteStatus: storedInvite.status, supportInviteSentAt: storedInvite.sentAt, supportInviteAcceptedAt: storedInvite.acceptedAt || "", careCirclePermissions: storedInvite.careCirclePermissions || state.careCirclePermissions });
    if (!patientShareSource && !storedInvite && state.careCircleStatus === "NONE") {
      const demoPatient = EMMI_DEMO_PATIENTS[selectDemoPatientId({ language: state.language, completionRole: state.completionRole, eligibilityStatus: state.accessOutcome, deviceScenario: service.getScenarioDeviceContext?.() || null })];
      const demoCircle = demoPatient?.careCircle;
      if (demoCircle && demoCircle.status !== "NONE") Object.assign(state, { supportRole: "CARE_CIRCLE_MEMBER", careCircleStatus: demoCircle.status, supportPersonName: demoCircle.supportPerson?.name || "", supportPersonPhone: formatPhone(demoCircle.supportPerson?.phone || ""), supportPersonRelationship: demoCircle.supportPerson?.relationship || "", supportInviteStatus: demoCircle.status === "ACTIVE" ? "ACCEPTED" : "PENDING" });
    }
    state.accessShares = patientShareSource ? [] : growthStore.allShares();
    document.documentElement.lang = htmlLanguage(state.language); render();
    if (state.screen === "ACCESS_ELIGIBILITY_PROCESSING" && !state.eligibilityError) runEligibility();
    if (state.screen === "ACCESS_BP_DEVICE_VERIFICATION" && ["NOT_STARTED", "CHECKING"].includes(state.deviceVerificationStatus)) runAssignedDeviceLookup();
  } catch (error) { state.screen = error.message === "expired" ? "OFFER_EXPIRED" : "OFFER_INVALID"; render(); }
}

if (["/access/learn", "/support/accept"].includes(location.pathname) || location.pathname.startsWith("/care-circle/invite/")) boot();
else {
  render();
  if (params.has("scenario") || prototypeMode) boot();
}
