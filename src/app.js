import { DEFAULT_PROTOTYPE_CONFIG, PROTOTYPE_OPTIONS, SCENARIOS, isProviderReferralSource, normalizePrototypeConfig, scenarioRequiresPhysician } from "./config.js";
import { commonMessagesFor, htmlLanguage, localeCode, localize, localizeOfferText } from "./i18n.js";
import { AUTHORITY_VERIFICATION_METHODS, MockEnrollmentService, DraftStore, audit } from "./services.js";
import { journeyFor, nextScreen, previousScreen, progressFor } from "./machine.js";
import {
  ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, ChartNoAxesColumnIncreasing,
  Check, ChevronRight, CircleHelp, Clock3, ExternalLink, FileText, Globe2,
  HeartPulse, House, Info, LockKeyhole, Package, Phone, Pill, ShieldCheck,
  Stethoscope, TabletSmartphone, Target, UserRound, UsersRound, Wifi
} from "lucide";

const app = document.querySelector("#app");
const params = new URLSearchParams(location.search);
const prototypeMode = params.get("prototype") === "1";
const scenarioId = prototypeMode ? "prototype" : params.get("scenario") || "access-happy";
const DEMO_IDENTITY = { dob: "05/12/1954", dobIso: "1954-05-12", zip: "33176" };
const draftStore = new DraftStore();
let eligibilityRequest = null;
const savedPrototypeConfig = (() => { try { return JSON.parse(localStorage.getItem("itera.prototype.config.v1") || "null"); } catch { return null; } })();
let prototypeConfig = normalizePrototypeConfig(savedPrototypeConfig || DEFAULT_PROTOTYPE_CONFIG);
let service = new MockEnrollmentService(scenarioId, prototypeMode ? prototypeConfig : null);
let conditionMenuOpen = false;
let state = {
  scenarioId, screen: params.has("scenario") || prototypeMode ? "OFFER_LOADING" : "PROTOTYPE_SETUP", offer: null, language: "en", role: "patient", completionRole: "patient",
  representativeFullName: "", representativeRelationship: "", representativeAuthorityType: "", representativePhone: "", representativeOtpDeliveryId: "", representativeOtpResendAvailableAt: 0,
  phoneVerified: false, phoneVerificationMethod: "", phoneVerifiedAt: "", representativeAuthorityAttested: false, authorityAttestation: false, authorityAttestedAt: "", authorityVerificationMethod: AUTHORITY_VERIFICATION_METHODS[0], authorityAdditionalVerificationRequired: false,
  consentRole: "", consentVersion: "", consentTimestamp: "", sessionId: globalThis.crypto?.randomUUID?.() || `session_${Date.now().toString(36)}`, sessionMetadata: { platform: navigator.userAgentData?.platform || navigator.platform || "unknown" }, ipMetadata: null, identityVerified: false,
  identityAttempts: 0, consentSaved: false, enrollmentConfirmed: false, accessEligible: false, accessOutcome: null,
  alignmentConfirmed: false, devicePath: null, addressConfirmed: false, setupComplete: false, readingReceived: false,
  reading: null, callbackRequested: false, onboarding: {}, audit: [], busy: false, error: "", devOpen: false,
  eligibilityPhase: "checkingEnrollment", eligibilityError: false, eligibilityRequestKey: "",
  assistantOpen: false, assistantOriginScreen: null, assistantScrollY: 0, assistantMessages: [], assistantFaqOpen: false, assistantLanguageChanged: false
};

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
  check: Check,
  clock: Clock3,
  box: Package,
  info: Info,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  externalLink: ExternalLink,
  chevronRight: ChevronRight
};
const svgNodes = nodes => nodes.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([key]) => key !== "key").map(([key, value]) => `${key}="${value}"`).join(" ")}></${tag}>`).join("");
const icon = (name, extra = "") => `<span class="icon ${extra}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgNodes(iconMap[name] || iconMap.info)}</svg></span>`;
const L = (en, es, ht) => localize(state.language, { en, es, ht }, en);
const offerText = (source, variables = {}) => localizeOfferText(state.language, source, variables);
const t = () => commonMessagesFor(state.language);
const languageCode = () => localeCode(state.language);
const languageActionLabel = () => L("Change language to Spanish", "Cambiar idioma a criollo", "Chanje lang pou anglè");
const setLanguage = language => {
  state.language = language;
  document.documentElement.lang = htmlLanguage(language);
  try { localStorage.setItem("itera.enrollment.language.v1", language); } catch { /* Language persistence is best effort. */ }
  if (state.identityVerified) draftStore.save(state);
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
  GETTING_STARTED: L("Getting started", "Primeros pasos", "Kòmanse")
})[stage] || L("Your care", "Su cuidado", "Swen ou");
const cta = (label, action = "next", secondary = false, disabled = false) => `<button class="button ${secondary ? "secondary" : "primary"}" data-action="${action}" ${disabled ? "disabled" : ""}>${label}${secondary ? "" : icon("arrowRight", "button-icon")}</button>`;
const rows = items => `<div class="card-list">${items.map(([i, title, body]) => `<article class="info-row">${icon(i)}<div><strong>${title}</strong>${body ? `<p>${body}</p>` : ""}</div></article>`).join("")}</div>`;
const choice = (value, i, title, body, checked = false) => `<label class="choice-card"><input type="radio" name="choice" value="${value}" ${checked ? "checked" : ""}><span class="choice-dot"></span>${icon(i)}<span><strong>${title}</strong><small>${body}</small></span></label>`;
const check = (name, label, checked = false) => `<label class="check-row"><input type="checkbox" name="${name}" ${checked ? "checked" : ""}><span class="check-box">✓</span><span>${label}</span></label>`;
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
  GOALS: "HEALTH_DATA_SECURITY",
  ACCESS_BASELINE: "HEALTH_DATA_SECURITY",
  ACCESS_MEASURE: "HEALTH_DATA_SECURITY",
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
const emmiAssistant = () => `<button class="emmi-assistant" data-action="help" aria-label="${L("Ask Emmi, Care Assistant", "Preguntar a Emmi, asistente de cuidado", "Mande Emmi, asistan swen")}" title="${L("Drag Emmi to move it", "Arrastre a Emmi para moverla", "Trennen Emmi pou deplase li")}"><span class="emmi-avatar"><img src="/assets/emmi-assistant.png" alt=""></span></button>`;

function header() {
  if (state.screen === "OFFER_LOADING") return "";
  if (state.screen === "INVITATION") return "";
  const progress = progressFor(state);
  const stageLabel = progressStageLabel(progress.stage);
  return `<header class="app-header">
    <div class="brand-row"><button class="icon-button back-button" data-action="back" aria-label="${t().back}" ${state.screen === "INVITATION" ? "hidden" : ""}>${icon("arrowLeft")}</button><a class="brand" href="#" data-action="restart" aria-label="${L("ITERA HEALTH home", "Inicio de ITERA HEALTH", "Akèy ITERA HEALTH")}"><b>ITERA.</b>HEALTH</a><button class="language" data-action="language" aria-label="${languageActionLabel()}">${icon("language")} ${languageCode()}</button></div>
    <div class="progress-meta"><span>${L("Enrollment", "Inscripción", "Enskripsyon")}</span><span title="${stageLabel}">${stageLabel}</span></div>
    <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress.percent)}" aria-valuetext="${stageLabel}" aria-label="${L("Enrollment progress", "Progreso de inscripción", "Pwogrè enskripsyon")}"><span style="width:${Math.min(100, progress.percent)}%"></span></div>
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
  const intro = accessPhysicianReferral ? L("Get extra support between your doctor visits — at no additional cost to you.", "Reciba apoyo adicional entre sus visitas al médico, sin costo adicional para usted.", "Jwenn sipò anplis ant vizit kay doktè ou, san okenn frè anplis pou ou.") : accessDirectOutreach ? L("ITERA HEALTH is a Medicare ACCESS Participant providing extra support between your doctor visits — at no additional cost to you.", "ITERA HEALTH es un participante de Medicare ACCESS que brinda apoyo adicional entre sus visitas al médico, sin costo adicional para usted.", "ITERA HEALTH se yon patisipan Medicare ACCESS ki bay sipò anplis ant vizit kay doktè ou, san okenn frè anplis pou ou.") : physicianReferral ? L(`${physicianName}’s care team invited you to learn about additional support available through Medicare.`, `El equipo de ${physicianName} le invita a conocer apoyo adicional disponible a través de Medicare.`, `Ekip swen ${physicianName} envite w aprann sou sipò anplis ki disponib atravè Medicare.`) : practiceOutreach ? L("Fresner Medical Group and ITERA HEALTH invite you to learn about additional support available through Medicare.", "Fresner Medical Group e ITERA HEALTH le invitan a conocer apoyo adicional disponible a través de Medicare.", "Fresner Medical Group ak ITERA HEALTH envite w aprann sou sipò anplis ki disponib atravè Medicare.") : L("ITERA HEALTH invites you to learn about additional support available through Medicare.", "ITERA HEALTH le invita a conocer apoyo adicional disponible a través de Medicare.", "ITERA HEALTH envite w aprann sou sipò anplis ki disponib atravè Medicare.");
  return `${TrustHeroCard()}
    <div class="invitation-copy">${titleBlock(L("A new care option for your health", "Una nueva opción de cuidado para su salud", "Yon nouvo opsyon swen pou sante ou"), intro)}</div>
    <section class="invitation-benefits" aria-label="${L("What this means for you", "Qué significa esto para usted", "Sa sa vle di pou ou")}">${[
      ["physician", L("Keep your doctors", "Mantenga sus médicos", "Kenbe doktè ou yo"), L("Continue seeing the doctors you know", "Continúe viendo a los médicos que conoce", "Kontinye wè doktè ou konnen yo")],
      ["home", L("Get support from home", "Reciba apoyo desde casa", "Jwenn sipò lakay ou"), L("Ongoing support between office visits", "Apoyo continuo entre sus consultas", "Sipò kontinyèl ant vizit nan klinik")],
      ["shield", L("Participation is voluntary", "La participación es voluntaria", "Patisipasyon an volontè"), L("You’ll review the details before you enroll", "Revisará los detalles antes de inscribirse", "W ap revize detay yo anvan ou enskri")]
    ].map(([i,label,detail]) => `<div class="invitation-benefit">${icon(i)}<span><strong>${label}</strong><small>${detail}</small></span></div>`).join("")}</section>
    ${actions(L("See how it works", "Vea cómo funciona", "Gade kijan sa fonksyone"), false)}
    <p class="contact-line"><span class="contact-label">${icon("phone", "contact-phone")}<span>${L("Need help? Call", "¿Necesita ayuda? Llame al", "Bezwen èd? Rele")}</span></span> <a href="tel:+13053948070">${state.offer.participantProvider.supportPhone}</a></p>`;
}

function decisionMaker() {
  return `${titleBlock(L("Who is completing this?", "¿Quién está completando esto?", "Ki moun ki ap ranpli sa a?"), L("Choose the option that best describes you.", "Elija la opción que mejor lo describa.", "Chwazi opsyon ki pi byen dekri ou."))}
    <form id="choice-form" class="choice-list">
      ${choice("patient", "person", L("For myself", "Para mí", "Pou tèt mwen"), L("I am the patient.", "Soy el paciente.", "Mwen se pasyan an."), state.completionRole === "patient")}
      ${choice("helper", "people", L("Helping the patient", "Ayudando al paciente", "Ede pasyan an"), L("The patient is present and will make the decisions.", "El paciente está presente y tomará las decisiones.", "Pasyan an prezan epi l ap pran desizyon yo."), state.completionRole === "helper")}
      ${choice("personalRepresentative", "shield", L("Personal representative", "Representante personal", "Reprezantan pèsonèl"), L("I’m authorized to make healthcare decisions for the patient.", "Estoy autorizado para tomar decisiones de atención médica por el paciente.", "Mwen otorize pou pran desizyon swen sante pou pasyan an."), isPersonalRepresentative())}
    </form>${actions(t().continue)}`;
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

function recommendation() {
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
  return {
    currentScreen: state.assistantOriginScreen || state.screen,
    program: state.offer?.pathway || "",
    enrollmentSource: state.offer?.enrollmentSource || "",
    physicianDisplayName: state.offer?.physician?.displayName || L("your doctor", "su médico", "doktè ou"),
    conditions: state.offer?.clinicalConditions?.map(condition => condition.patientFriendlyName) || [],
    eligibilityStatus: state.accessOutcome,
    carePathway: state.offer?.pathway || "",
    accessDisclosureConfig: state.offer?.disclosures?.accessConfig || null,
    selectedLanguage: state.language
  };
}

function assistantQuickQuestions(context) {
  if (context.currentScreen === "DISCLOSURE" && context.program === "ACCESS") return [L("What does voluntary mean?", "¿Qué significa voluntario?", "Kisa volontè vle di?"), L("Will my Medicare benefits change?", "¿Cambiarán mis beneficios de Medicare?", "Èske benefis Medicare mwen yo ap chanje?"), L("Will this cost me anything?", "¿Esto tendrá algún costo?", "Èske sa ap koute m anyen?"), L("Can I change ACCESS providers?", "¿Puedo cambiar de proveedor ACCESS?", "Èske mwen ka chanje founisè ACCESS?")];
  if (context.currentScreen === "CONSENT_REVIEW") return [L("What am I agreeing to?", "¿Qué estoy aceptando?", "Kisa mwen dakò ak?"), L("Can I change my mind?", "¿Puedo cambiar de opinión?", "Èske mwen ka chanje lide mwen?"), L("What will this cost?", "¿Cuánto costará?", "Ki sa ki pral pri sa a?"), L("Does this change my Medicare?", "¿Esto cambia mi Medicare?", "Èske sa chanje Medicare mwen an?"), L("What does signing as a personal representative mean?", "¿Qué significa firmar como representante personal?", "Ki sa siyati vle di antanke reprezantan pèsonèl?")];
  if (["ACCESS_PRE_ELIGIBILITY_NOTICE", "ACCESS_MEDICARE_IDENTIFIER", "ACCESS_ELIGIBILITY_PROCESSING", "ACCESS_ELIGIBILITY_RESULT"].includes(context.currentScreen)) return state.accessOutcome === "notEligible"
    ? [L("Why can’t I continue?", "¿Por qué no puedo continuar?", "Poukisa mwen pa ka kontinye?"), L("Will this affect my Medicare?", "¿Esto afectará mi Medicare?", "Èske sa ap afekte Medicare mwen an?"), L("Can I still see my doctors?", "¿Puedo seguir viendo a mis médicos?", "Èske mwen ka toujou wè doktè mwen yo?")]
    : [L("What is Medicare checking?", "¿Qué está verificando Medicare?", "Kisa chèk Medicare ye?"), L("Will this affect my benefits?", "¿Esto afectará mis beneficios?", "Èske sa ap afekte benefis mwen yo?"), L("Why do you need my information?", "¿Por qué necesitan mi información?", "Poukisa ou bezwen enfòmasyon mwen?")];
  if (context.currentScreen === "CARE_RECOMMENDATION") return [L("What does recommended care mean?", "¿Qué significa cuidado recomendado?", "Kisa swen rekòmande vle di?"), L("Will I keep seeing my doctor?", "¿Seguiré viendo a mi médico?", "Èske mwen pral kontinye wè doktè mwen an?"), L("What happens next?", "¿Qué sucede después?", "Kisa ki rive apre sa?")];
  return context.program === "ACCESS"
    ? [L("What is ACCESS?", "¿Qué es ACCESS?", "Kisa ACCESS ye?"), L("Will I keep my doctor?", "¿Conservaré a mi médico?", "Èske mwen pral kenbe doktè mwen an?"), L("What happens next?", "¿Qué sucede después?", "Kisa k ap pase apre?"), L("Will this affect my Medicare?", "¿Esto afectará mi Medicare?", "Èske sa ap afekte Medicare mwen an?")]
    : [L("How does this care help me?", "¿Cómo me ayuda este cuidado?", "Ki jan swen sa a ede m?"), L("Will I keep my doctor?", "¿Conservaré a mi médico?", "Èske mwen pral kenbe doktè mwen an?"), L("What happens next?", "¿Qué sucede después?", "Kisa ki rive apre sa?")];
}

function assistantScreenExplanation(screen) {
  const explanations = {
    INVITATION: L("This screen introduces the care support available to you and lets you choose whether to learn more.", "Esta pantalla presenta el apoyo de cuidado disponible y le permite decidir si desea conocer más.", "Ekran sa a entwodui sipò swen ki disponib pou ou epi li pèmèt ou chwazi si pou w aprann plis."),
    DECISION_MAKER: L("This screen asks who is completing the enrollment so we can show the right information.", "Esta pantalla pregunta quién completa la inscripción para mostrar la información correcta.", "Ekran sa a mande ki moun ki ranpli enskripsyon an pou nou ka montre bon enfòmasyon an."),
    IDENTITY_VERIFICATION: L("This screen securely confirms your identity using your date of birth and home ZIP code.", "Esta pantalla confirma su identidad de forma segura usando su fecha de nacimiento y código postal.", "Ekran sa a konfime idantite w san danje lè l sèvi avèk dat nesans ou ak kòd postal lakay ou."),
    CARE_RECOMMENDATION: L("This screen explains the support recommended for your health needs. You can review it before making any decision.", "Esta pantalla explica el apoyo recomendado para sus necesidades. Puede revisarlo antes de decidir.", "Ekran sa a eksplike sipò yo rekòmande pou bezwen sante w yo. Ou ka revize li anvan w pran nenpòt desizyon."),
    HOW_CARE_WORKS: L("This screen explains how ITERA and your doctor work together between visits.", "Esta pantalla explica cómo ITERA y su médico trabajan juntos entre visitas.", "Ekran sa a eksplike kijan ITERA ak doktè ou travay ansanm ant vizit yo."),
    ACCESS_PRE_ELIGIBILITY_NOTICE: L("This screen explains what Medicare needs you to know before checking whether ACCESS is available to you.", "Esta pantalla explica lo que Medicare necesita que sepa antes de verificar si ACCESS está disponible.", "Ekran sa a eksplike sa Medicare bezwen ou konnen anvan li tcheke si ACCESS disponib pou ou."),
    ACCESS_MEDICARE_IDENTIFIER: L("This screen asks for Medicare information needed to securely complete the eligibility check.", "Esta pantalla solicita la información de Medicare necesaria para completar la verificación de forma segura.", "Ekran sa a mande enfòmasyon Medicare ki nesesè pou konplete chèk kalifikasyon an san danje."),
    ACCESS_ELIGIBILITY_PROCESSING: L("Medicare is securely checking whether this ACCESS care option is available to you.", "Medicare está verificando de forma segura si esta opción ACCESS está disponible para usted.", "Medicare ap verifye an sekirite si opsyon swen ACCESS sa a disponib pou ou."),
    ACCESS_ELIGIBILITY_RESULT: state.accessOutcome === "notEligible" ? L("This result means ACCESS is not available to you right now. It does not change your Medicare benefits or regular care.", "Este resultado significa que ACCESS no está disponible ahora. No cambia sus beneficios ni su cuidado habitual.", "Rezilta sa a vle di ACCESS pa disponib pou ou kounye a. Li pa chanje benefis Medicare ou ni swen nòmal ou.") : L("This result means you may continue reviewing ACCESS. You are not enrolled yet.", "Este resultado significa que puede continuar revisando ACCESS. Aún no está inscrito.", "Rezilta sa a vle di ou ka kontinye revize ACCESS. Ou poko enskri."),
    DISCLOSURE: L("This screen explains important details you should review before deciding whether to enroll.", "Esta pantalla explica detalles importantes que debe revisar antes de decidir si se inscribe.", "Ekran sa a eksplike detay enpòtan ou ta dwe revize anvan ou deside si ou ta dwe enskri."),
    CONSENT_REVIEW: L("This screen summarizes what you are agreeing to. Participation is voluntary, and you can ask questions first.", "Esta pantalla resume lo que está aceptando. La participación es voluntaria y puede preguntar antes.", "Ekran sa a rezime sa w ap dakò a. Patisipasyon an volontè, epi ou ka poze kesyon an premye.")
  };
  return explanations[screen] || L("This screen shows your current enrollment task and what you need to do next.", "Esta pantalla muestra su tarea actual y lo que debe hacer después.", "Ekran sa a montre travay enskripsyon aktyèl ou ak sa ou bezwen fè pwochen.");
}

function assistantAnswer(question, context) {
  const normalized = question.toLowerCase();
  const emergency = /(chest pain|can'?t breathe|cannot breathe|difficulty breathing|stroke|severe bleeding|suicid|emergency|dolor de pecho|no puedo respirar|derrame|sangrado grave|emergencia|doulè nan pwatrin|pa ka respire|konjesyon serebral|senyen anpil|ijans|swisid)/i.test(question);
  if (emergency) return { emergency: true, text: L("This may need urgent medical attention. Emmi cannot provide emergency care. Call 911 now or go to the nearest emergency department.", "Esto puede requerir atención médica urgente. Emmi no brinda atención de emergencia. Llame al 911 ahora o vaya a la sala de emergencias más cercana.", "Sa ka bezwen swen medikal ijan. Emmi pa ka bay swen ijan. Rele 911 kounye a oswa ale nan depatman ijans ki pi pre a.") };
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
    const disclosure = context.accessDisclosureConfig;
    if (context.program === "ACCESS" && disclosure?.costSharingType === "COST_SHARING_NONE") return { text: L("Your ACCESS cost-sharing from ITERA HEALTH is $0.", "Su costo compartido de ACCESS por parte de ITERA HEALTH es $0.", "Pataj depans ACCESS ou nan ITERA HEALTH se $0.") };
    if (context.program === "ACCESS" && disclosure?.costSharingType === "COST_SHARING_APPLIES" && disclosure.costSharingAmount) return { text: L(`Your cost may be up to ${disclosure.costSharingAmount} per month. You can review this before deciding.`, `Su costo puede ser de hasta ${disclosure.costSharingAmount} al mes. Puede revisarlo antes de decidir.`, `Pri w ka jiska ${disclosure.costSharingAmount} pa mwa. Ou ka revize sa a anvan ou deside.`) };
    return { text: L("Coverage and possible cost-sharing depend on the care services involved. You can review the details and talk with our care team before deciding.", "La cobertura y posibles costos dependen de los servicios. Puede revisar los detalles y hablar con nuestro equipo antes de decidir.", "Kouvèti ak posib depans pataje depann de sèvis swen ki enplike yo. Ou ka revize detay yo epi pale ak ekip swen nou an anvan ou deside.") };
  }
  if (/(change|switch).*(access )?provider|(access )?provider.*(change|switch)|cambiar.*proveedor|chanje.*founisè/i.test(normalized)) return { text: L("Beginning 90 days after enrollment, you may end your ACCESS participation or switch to another participating provider.", "A partir de 90 días después de la inscripción, puede terminar su participación en ACCESS o cambiar a otro proveedor participante.", "Apati 90 jou apre enskripsyon an, ou ka mete fen nan patisipasyon ACCESS ou oswa chanje pou yon lòt founisè ki patisipe.") };
  if (/(voluntary|change my mind|stop|voluntaria|cambiar de opinión|volontè|chanje lide|sispann)/i.test(normalized)) return { text: context.program === "ACCESS" ? L("Participation is voluntary. You can choose not to continue before enrollment. Beginning 90 days after enrollment, you may end ACCESS participation or switch to another participating provider.", "La participación es voluntaria. Puede decidir no continuar antes de inscribirse. A partir de 90 días después de la inscripción, puede finalizar ACCESS o cambiar a otro proveedor participante.", "Patisipasyon an volontè. Ou ka chwazi pa kontinye anvan enskripsyon an. Apati 90 jou apre enskripsyon an, ou ka mete fen nan patisipasyon ACCESS ou oswa chanje pou yon lòt founisè ki patisipe.") : L("Participation is voluntary. You can ask questions before enrolling and can change your mind.", "La participación es voluntaria. Puede preguntar antes de inscribirse y cambiar de opinión.", "Patisipasyon an volontè. Ou ka poze kesyon anvan ou enskri epi ou ka chanje lide ou.") };
  if (/(medicare|benefit|beneficio)/i.test(normalized)) return { text: L("The enrollment review and eligibility check do not change your Medicare benefits. Your regular care remains available.", "La revisión y la verificación de elegibilidad no cambian sus beneficios de Medicare. Su cuidado habitual sigue disponible.", "Revizyon enskripsyon an ak chèk kalifikasyon an pa chanje benefis Medicare ou yo. Swen regilye ou rete disponib.") };
  if (/(information|why do you need|información|por qué necesitan|enfòmasyon|poukisa)/i.test(normalized)) return { text: L("We use the requested information to securely verify your identity and determine which care options are available. Your information is protected.", "Usamos la información solicitada para verificar su identidad y determinar qué opciones están disponibles. Su información está protegida.", "Nou itilize enfòmasyon yo mande yo pou verifye idantite ou an sekirite epi detèmine ki opsyon swen ki disponib. Enfòmasyon ou pwoteje.") };
  if (/(next|después|sigue|apre|pwochen)/i.test(normalized)) return { text: assistantScreenExplanation(context.currentScreen) };
  return { text: L("I can explain this screen, your care options, Medicare eligibility, or what happens next. You can also talk with our care team at any time.", "Puedo explicar esta pantalla, sus opciones de cuidado, la elegibilidad de Medicare o qué sigue. También puede hablar con nuestro equipo en cualquier momento.", "Mwen ka eksplike ekran sa a, opsyon swen ou yo, kalifikasyon Medicare, oswa sa k ap pase apre. Ou ka pale tou ak ekip swen nou an nenpòt ki lè.") };
}

function assistantLayer() {
  const context = assistantContext();
  const quickQuestions = assistantQuickQuestions(context);
  const messages = state.assistantMessages.map(message => `<div class="assistant-message ${message.role}"><strong>${message.role === "user" ? L("You", "Usted", "Ou") : "Emmi"}</strong><p>${escapeHtml(message.text)}</p>${message.emergency ? `<a class="assistant-emergency-action" href="tel:911">${icon("phone")}<span>${L("Call 911", "Llamar al 911", "Rele 911")}</span></a>` : ""}</div>`).join("");
  const commonQuestions = context.currentScreen === "ACCESS_ELIGIBILITY_RESULT" && state.accessOutcome === "notEligible"
    ? [L("Why can’t I continue?", "¿Por qué no puedo continuar?", "Poukisa mwen pa ka kontinye?"), L("Does this affect my Medicare?", "¿Esto afecta mi Medicare?", "Èske sa afekte Medicare mwen an?"), L("Can I still see my doctors?", "¿Puedo seguir viendo a mis médicos?", "Èske mwen ka toujou wè doktè mwen yo?"), L("Are there other care options?", "¿Hay otras opciones de cuidado?", "Èske gen lòt opsyon swen?")]
    : [L("Is participation voluntary?", "¿La participación es voluntaria?", "Èske patisipasyon volontè?"), L("Will I keep my doctor?", "¿Conservaré a mi médico?", "Èske mwen pral kenbe doktè mwen an?"), L("Will this affect my Medicare?", "¿Esto afectará mi Medicare?", "Èske sa ap afekte Medicare mwen an?")];
  return `<aside class="assistant-layer" role="dialog" aria-modal="true" aria-labelledby="assistant-title">
    <header class="assistant-header"><a class="brand" href="#" data-assistant-action="close" aria-label="${L("ITERA HEALTH home", "Inicio de ITERA HEALTH", "Akèy ITERA HEALTH")}"><b>ITERA.</b>HEALTH</a><span>${L("Care Assistant", "Asistente de cuidado", "Asistan swen")}</span><button class="language" data-assistant-action="language" aria-label="${languageActionLabel()}">${icon("language")} ${languageCode()}</button><button class="assistant-close" data-assistant-action="close" aria-label="${L("Back to enrollment", "Volver a la inscripción", "Retounen nan enskripsyon")}">×</button></header>
    <div class="assistant-content"><div class="assistant-intro"><img src="/assets/emmi-assistant.png" alt=""><div><h1 id="assistant-title" tabindex="-1">${L("Hi, I’m Emmi. How can I help?", "Hola, soy Emmi. ¿Cómo puedo ayudar?", "Bonjou, mwen se Emmi. Kijan mwen ka ede?")}</h1><p>${L("Ask me anything about your enrollment or care.", "Pregúnteme sobre su inscripción o cuidado.", "Mande m nenpòt bagay sou enskripsyon oswa swen ou.")}</p></div></div>
      <form class="assistant-question-form"><label class="sr-only" for="assistant-question">${L("Ask a question", "Haga una pregunta", "Poze yon kesyon")}</label><input id="assistant-question" name="question" type="text" autocomplete="off" placeholder="${L("Ask a question…", "Haga una pregunta…", "Poze yon kesyon…")}"><button type="submit" aria-label="${L("Send question", "Enviar pregunta", "Voye kesyon")}">${icon("arrowRight")}</button></form>
      ${messages ? `<section class="assistant-conversation" aria-live="polite">${messages}</section>` : ""}
      <section class="assistant-quick"><h2>${L("Quick questions", "Preguntas rápidas", "Kesyon rapid")}</h2><div>${quickQuestions.map(question => `<button type="button" data-assistant-question="${escapeHtml(question)}">${question}</button>`).join("")}</div></section>
      <button class="assistant-faq-toggle" type="button" data-assistant-action="faq" aria-expanded="${state.assistantFaqOpen}">${L("Browse common questions", "Ver preguntas comunes", "Gade kesyon komen")} ${icon("chevronRight")}</button>
      ${state.assistantFaqOpen ? `<section class="assistant-common-questions">${commonQuestions.map(question => `<button type="button" data-assistant-question="${escapeHtml(question)}">${question}</button>`).join("")}</section>` : ""}
      <section class="assistant-human-support"><h2>${L("Prefer to talk with someone?", "¿Prefiere hablar con alguien?", "Ou prefere pale ak yon moun?")}</h2><a class="assistant-support-action" href="tel:+13053948070">${icon("phone")}<span><strong>${L("Talk to our care team", "Hable con nuestro equipo", "Pale ak ekip swen nou an")}</strong><small>${L("Call", "Llame al", "Rele")} ${state.offer.participantProvider.supportPhone}</small></span></a><button class="assistant-support-action" type="button" data-assistant-action="callback">${icon("phone")}<span><strong>${L("Have someone call me", "Quiero que alguien me llame", "Mande yon moun rele m")}</strong><small>${L(`We’ll call the number ending in ${state.offer.patient.phoneMasked.slice(-4)}`, `Llamaremos al número terminado en ${state.offer.patient.phoneMasked.slice(-4)}`, `N ap rele nimewo ki fini ak ${state.offer.patient.phoneMasked.slice(-4)}`)}</small></span></button></section>
      <p class="emmi-disclaimer">${icon("info")}<span>${L("Emmi is an AI assistant, not a clinician. For medical emergencies, call 911.", "Emmi es una asistente de IA, no una profesional clínica. Para emergencias médicas, llame al 911.", "Emmi se yon asistan IA, li pa yon pwofesyonèl klinik. Pou ijans medikal, rele 911.")}</span></p>
      <button class="button secondary assistant-back" type="button" data-assistant-action="close">${icon("arrowLeft", "button-icon")} ${L("Back to enrollment", "Volver a la inscripción", "Retounen nan enskripsyon")}</button>
    </div></aside>`;
}

function disclosure() {
  const label = state.offer.pathway === "ACCESS" ? "ACCESS" : state.offer.pathway;
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
  return `${titleBlock(L("About your recommended care", "Acerca de su cuidado recomendado", "Konsènan swen ou rekòmande a"), "", L("Important information", "Información importante", "Enfòmasyon enpòtan"))}
    <section class="disclosure-card"><h2>${label}</h2>${state.offer.disclosures.blocks.map((x, i) => `<div class="disclosure-row">${icon(["people", "shield", "info"][i] || "check")}<p>${x}</p></div>`).join("")}${state.offer.pathway === "RPM" ? `<div class="disclosure-row">${icon("device")}<p>${L("Readings are sent automatically from a connected device. This service does not replace emergency care.", "Las lecturas se envían automáticamente desde un dispositivo conectado. Este servicio no reemplaza la atención de emergencia.", "Yo voye lekti yo otomatikman nan yon aparèy ki konekte. Sèvis sa a pa ranplase swen ijan.")}</p></div>` : ""}</section>
    <details class="full-terms"><summary>${L("View full information", "Ver información completa", "Gade enfòmasyon konplè")} <span>↗</span></summary><p>${L("Your information is used to coordinate the care described here and is protected under applicable privacy rules. You may contact the care team before deciding.", "Su información se usa para coordinar el cuidado descrito y está protegida por las reglas de privacidad aplicables. Puede contactar al equipo antes de decidir.", "Enfòmasyon ou yo itilize pou kowòdone swen ki dekri isit la epi yo pwoteje dapre règleman sou vi prive ki aplikab yo. Ou ka kontakte ekip swen an anvan w deside.")}</p></details>
    ${check("acknowledge", L("I have reviewed this information", "He revisado esta información", "Mwen te revize enfòmasyon sa a"))}<p class="form-error" role="alert">${state.error}</p>${actions(L("I understand", "Entiendo", "Mwen konprann"))}`;
}

function consent() {
  const representativeRole = isPersonalRepresentative();
  const role = representativeRole ? L("Personal representative", "Representante personal", "Reprezantan pèsonèl") : L("Patient", "Paciente", "Pasyan");
  if (state.offer.pathway === "ACCESS") {
    const representative = representativeRole;
    const physician = physicianDisplayName();
    const physicianInSentence = physician.replace(/[.!?]+$/, "");
    const intro = representative
      ? L("I agree, on behalf of the patient, to enroll the patient in ACCESS with ITERA HEALTH.", "Acepto, en nombre del paciente, inscribir al paciente en ACCESS con ITERA HEALTH.", "Mwen dakò, nan non pasyan an, pou enskri pasyan an nan ACCESS avèk ITERA HEALTH.")
      : state.offer.physician ? L(`I agree to receive ACCESS care from ITERA HEALTH, with support coordinated with ${physicianInSentence}.`, `Acepto recibir cuidado ACCESS de ITERA HEALTH, con apoyo coordinado con ${physicianInSentence}.`, `Mwen dakò pou resevwa swen ACCESS nan ITERA HEALTH, avèk sipò ki kowòdone ak ${physicianInSentence}.`) : L("I agree to receive ACCESS care from ITERA HEALTH.", "Acepto recibir cuidado ACCESS de ITERA HEALTH.", "Mwen dakò pou resevwa swen ACCESS nan ITERA HEALTH.");
    const primaryCondition = state.offer.qualifyingConditions?.[0] || state.offer.qualifyingCondition;
    const conditionName = primaryCondition?.name;
    const conditionLabel = conditionName === "Chronic Kidney Disease" ? L("kidney health", "salud renal", "sante ren") : primaryCondition?.patientFriendlyName || L("your health needs", "sus necesidades de salud", "Bezwen sante");
    const careLabel = L(`ACCESS care for ${conditionLabel}`, `Cuidado ACCESS para ${conditionLabel}`, `Swen Aksè pou ${conditionLabel}`);
    const config = state.offer.disclosures?.accessConfig || {};
    const cost = config.costSharingType === "COST_SHARING_APPLIES"
      ? config.costSharingAmount ? L(`Up to ${config.costSharingAmount} per month`, `Hasta ${config.costSharingAmount} al mes`, `Jiska ${config.costSharingAmount} pa mwa`) : L("Your ACCESS cost will be reviewed with you before enrollment.", "Su costo de ACCESS se revisará con usted antes de la inscripción.", "Y ap revize pri aksè w la avèk ou anvan enskripsyon an.")
      : L("$0 per month", "$0 al mes", "$0 pa mwa");
    const summaryRows = [
      ["people", L("Participation is voluntary", "La participación es voluntaria", "Patisipasyon an volontè."), L("You choose whether to enroll in ACCESS.", "Usted decide si desea inscribirse en ACCESS.", "Se ou ki chwazi si w ap enskri nan ACCESS.")],
      ["shield", L("Your Medicare benefits stay the same", "Sus beneficios de Medicare permanecen iguales", "Benefis Medicare ou yo rete menm jan an"), L("Your Medicare benefits, coverage, and rights do not change.", "Sus beneficios, cobertura y derechos de Medicare no cambian.", "Avantaj, pwoteksyon, ak dwa Medicare ou yo pa chanje.")],
      ["info", L("Your ACCESS cost", "Su costo de ACCESS", "Depans ACCESS ou"), cost],
      ["doctor", L("One ACCESS provider per care track", "Un proveedor ACCESS por cada área de cuidado", "Yon founisè ACCESS pou chak domèn swen"), L("You can have one ACCESS provider for this care track at a time.", "Puede tener un proveedor ACCESS para esta área de cuidado a la vez.", "Ou ka gen yon sèl founisè ACCESS pou domèn swen sa a alafwa.")],
      ["clock", L("Changing or ending ACCESS care", "Cambiar o finalizar el cuidado ACCESS", "Chanje oswa mete fen nan swen ACCESS"), L("Beginning 90 days after enrollment, you may end your ACCESS participation or switch to another participating provider.", "A partir de 90 días después de la inscripción, puede finalizar su participación en ACCESS o cambiar a otro proveedor participante.", "Apati 90 jou apre enskripsyon an, ou ka mete fen nan patisipasyon ACCESS ou oswa chanje pou yon lòt founisè ki patisipe.")]
    ];
    if (config.showClaimsSharing) summaryRows.push(["document", L("Medicare claims information", "Información de reclamaciones de Medicare", "Enfòmasyon sou reklamasyon Medicare"), L("Medicare may share claims information with ITERA HEALTH to help coordinate your ACCESS care.", "Medicare puede compartir información de reclamaciones con ITERA HEALTH para ayudar a coordinar su cuidado ACCESS.", "Medicare ka pataje enfòmasyon sou reklamasyon avèk ITERA HEALTH pou ede kowòdone swen ACCESS ou.")]);
    const authorityAttestation = representative ? check("authority", L("I confirm that I’m authorized to make healthcare decisions for the patient.", "Confirmo que estoy autorizado para tomar decisiones médicas por el paciente.", "Mwen konfime ke mwen otorize pou pran desizyon swen sante pou pasyan an.")) : "";
    const agreement = representative
      ? L("I agree, on behalf of the patient, to enroll the patient in ACCESS with ITERA HEALTH.", "Acepto, en nombre del paciente, inscribir al paciente en ACCESS con ITERA HEALTH.", "Mwen dakò, nan non pasyan an, pou enskri pasyan an nan ACCESS avèk ITERA HEALTH.")
      : L("I agree to enroll in ACCESS with ITERA HEALTH.", "Acepto inscribirme en ACCESS con ITERA HEALTH.", "Mwen dakò pou enskri nan ACCESS avèk ITERA HEALTH.");
    return `${titleBlock(L("Review and agree", "Revise y acepte", "Revize epi dakò"), intro)}
      <section class="care-team-card access-consent-care-team">${state.offer.physician ? `${providerCard(L("Your doctor", "Su médico", "Doktè w"))}<div class="provider-connector"></div>` : ""}<div class="itera-provider">${icon("people")}<span><strong>ITERA HEALTH</strong><small>${L("ACCESS care provider", "Proveedor de cuidado ACCESS", "Founisè swen ACCESS")}</small></span></div></section>
      <div class="service-chips access-care-chip"><span>${icon("check")} ${careLabel}</span></div>
      <section class="consent-summary access-consent-summary">${summaryRows.map(([rowIcon, headline, copy]) => `<div class="consent-disclosure-row">${icon(rowIcon)}<div><strong>${headline}</strong><p>${copy}</p></div></div>`).join("")}</section>
      <p class="signer-role"><strong>${L("Signing as", "Firmando como", "Siyen kòm")}:</strong> ${role}</p>
      <form id="consent-form">${authorityAttestation}${check("consent", L("I have reviewed this important information", "He revisado esta información importante", "Mwen te revize enfòmasyon enpòtan sa a"))}${check("enroll", agreement)}</form>
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
  return `${titleBlock(L("Review and agree", "Revise y acepte", "Revize epi dakò"), traditionalIntro)}
    <section class="care-team-card">${providerCard()}<div class="provider-connector"></div><div class="itera-provider">${icon("people")}<span><strong>ITERA HEALTH</strong><small>${L("Care provider", "Proveedor de cuidado", "Founisè swen")}</small></span></div></section>
    <div class="service-chips">${state.offer.consent.services.map(x => `<span>${icon("check")} ${offerText(x)}</span>`).join("")}</div>
    <section class="consent-summary"><p>${offerText(state.offer.consent.costSharingText)}</p>${state.offer.consent.stopRules.map(x => `<p>${icon("check")} ${offerText(x)}</p>`).join("")}<p class="signer-role"><strong>${L("Signer role", "Rol del firmante", "Wòl siyatè a")}:</strong> ${role}</p></section>
    <form id="consent-form">${traditionalAuthority}${check("consent", L("I received and understand this important information", "Recibí y comprendo esta información importante", "Mwen te resevwa ak konprann enfòmasyon enpòtan sa a"))}${check("enroll", traditionalAgreement)}</form>
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

function success() {
  const access = state.offer.pathway === "ACCESS", rpm = ["RPM", "CCM_RPM", "PCM_RPM"].includes(state.offer.pathway);
  const title = access ? L("You’re enrolled with ITERA for this care", "Está inscrito con ITERA para este cuidado", "Ou enskri ak ITERA pou swen sa a") : rpm ? L("You’re enrolled—let’s prepare your monitor", "Está inscrito; preparemos su monitor", "Ou enskri - se pou nou prepare monitè ou") : L("You’re enrolled in ongoing care support", "Está inscrito en apoyo de cuidado continuo", "Ou enskri nan sipò swen kontinyèl");
  return `${art("check", true)}${titleBlock(title, offerText(state.offer.content.supportTemplate || state.offer.content.support, { physicianDisplayName: physicianDisplayName() }))}<div class="status-pill">${icon("shield")} ${L("Enrollment confirmed", "Inscripción confirmada", "Enskripsyon konfime")}</div>
    <section class="next-card"><h2>${L("What happens next?", "¿Qué sigue?", "Kisa ki rive apre sa?")}</h2>${rows([["phone", L("Your care team will call within 2 business days", "Su equipo llamará en 2 días hábiles", "Ekip swen w lan ap rele nan 2 jou ouvrab"), ""], ["document", L("We’ll confirm your personalized care plan", "Confirmaremos su plan personalizado", "Nou pral konfime plan swen pèsonalize w la"), ""], ["people", L("You’ll continue to see your regular doctors", "Seguirá viendo a sus médicos habituales", "Ou pral kontinye wè doktè regilye ou yo"), ""]])}</section>
    <details class="full-terms"><summary>${L("Consent details", "Detalles del consentimiento", "Detay konsantman")}</summary><p>${L("Consent version", "Versión del consentimiento", "Vèsyon konsantman")}: ${state.offer.consent.version}<br>${L("Effective date", "Fecha efectiva", "Dat li antre an vigè")}: ${L("August 21, 2026", "21 de agosto de 2026", "21 out 2026")}</p></details>
    ${actions(access ? L("Start health check", "Iniciar evaluación de salud", "Kòmanse chèk sante") : rpm ? L("Set up my monitor", "Configurar mi monitor", "Fikse monitè mwen an") : L("Continue to set up care", "Continuar configuración", "Kontinye mete kanpe swen"), false)}`;
}

function accessNotice() {
  return `${titleBlock(L("Before Medicare checks your eligibility", "Antes de que Medicare verifique su elegibilidad", "Anvan Medicare verifye kalifikasyon ou"), L("ACCESS is a Medicare care model being evaluated by the Centers for Medicare & Medicaid Services (CMS).", "ACCESS es un modelo de cuidado de Medicare que está siendo evaluado por los Centros de Servicios de Medicare y Medicaid (CMS).", "ACCESS se yon modèl swen Medicare Sant pou Sèvis Medicare ak Medicaid (CMS) ap evalye."))}
    <div class="accordion-list"><details open><summary>${icon("lock")}<span><strong>${L("Data sharing", "Intercambio de datos", "Pataj enfòmasyon")}</strong><small>${L("ITERA may share health information with CMS, and CMS may request information to evaluate ACCESS. Federal privacy and security protections apply.", "ITERA puede compartir información médica con CMS, y CMS puede solicitar información para evaluar ACCESS. Se aplican las protecciones federales de privacidad y seguridad.", "ITERA ka pataje enfòmasyon sante avèk CMS, epi CMS ka mande enfòmasyon pou evalye ACCESS. Pwoteksyon federal sou vi prive ak sekirite aplike.")}</small></span></summary></details><details><summary>${icon("document")}<span><strong>${L("Random assignment", "Asignación aleatoria", "Plasman o aza")}</strong><small>${L("CMS may randomly assign you to a comparison group. If that happens, you won’t be able to enroll in ACCESS for 12 months.", "CMS puede asignarle al azar a un grupo de comparación. Si eso sucede, no podrá inscribirse en ACCESS durante 12 meses.", "CMS ka mete ou o aza nan yon gwoup konparezon. Si sa rive, ou p ap kapab enskri nan ACCESS pandan 12 mwa.")}</small></span></summary></details><details><summary>${icon("shield")}<span><strong>${L("Your Medicare benefits and rights", "Sus beneficios y derechos de Medicare", "Benefis ak dwa Medicare ou")}</strong><small>${L("Your Medicare benefits, rights, and coverage will stay the same.", "Sus beneficios, derechos y cobertura de Medicare seguirán siendo los mismos.", "Benefis, dwa ak kouvèti Medicare ou ap rete menm jan an.")}</small></span></summary></details></div>
    ${check("accessNotice", L("I acknowledge this information and want to continue", "Reconozco esta información y deseo continuar", "Mwen rekonèt enfòmasyon sa yo epi mwen vle kontinye"))}<p class="form-error" role="alert">${state.error}</p>${actions(L("Check my eligibility", "Verificar mi elegibilidad", "Tcheke kalifikasyon mwen"), true, "", true)}`;
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
  return `${art(results[0], outcome === "eligible")}${titleBlock(results[1], results[2])}${outcome === "eligible" ? `<section class="next-card"><h2>${L("What happens next?", "¿Qué sigue?", "Kisa k ap pase apre?")}</h2>${rows([["document", L("Review important ACCESS information", "Revise información importante de ACCESS", "Revize enfòmasyon enpòtan sou ACCESS"), ""], ["person", L("Agree to enroll with ITERA HEALTH", "Acepte inscribirse con ITERA HEALTH", "Dakò pou enskri avèk ITERA HEALTH"), ""], ["clock", L("We’ll complete your ACCESS enrollment with Medicare", "Completaremos su inscripción en ACCESS con Medicare", "N ap konplete enskripsyon ACCESS ou avèk Medicare"), ""]])}</section>` : ""}${actions(results[3], false, outcome === "unavailable" ? L("Request a callback", "Solicitar llamada", "Mande yon retou") : "")}`;
}

function onboarding() {
  return `${titleBlock(L("Set up your care", "Configure su cuidado", "Fikse swen w"), L("Enrollment is complete. You can finish these steps now or later.", "La inscripción está completa. Puede terminar estos pasos ahora o después.", "Enskripsyon an konplè. Ou ka fini etap sa yo kounye a oswa pita."), L("Care setup", "Configuración", "Konfigirasyon swen"))}
    <div class="link-list"><button class="link-card" data-action="next">${icon("shield")}<span><strong>${L("Confirm your health information", "Confirme su información médica", "Konfime enfòmasyon sante ou")}</strong><small>${L("Review what we already have on file", "Revise lo que ya tenemos", "Revize sa nou deja genyen nan dosye a")}</small></span><b>›</b></button><button class="link-card">${icon("pill")}<span><strong>${L("Confirm your medications", "Confirme sus medicamentos", "Konfime medikaman ou yo")}</strong><small>${L("Tell us if anything changed", "Indique si algo cambió", "Di nou si anyen chanje")}</small></span><b>›</b></button><button class="link-card">${icon("phone")}<span><strong>${L("Care preferences", "Preferencias de cuidado", "Preferans swen")}</strong><small>${L("Choose how we should contact you", "Elija cómo debemos contactarle", "Chwazi kijan nou dwe kontakte ou")}</small></span><b>›</b></button><button class="link-card">${icon("goals")}<span><strong>${L("Your goals", "Sus objetivos", "Objektif ou")}</strong><small>${L("Tell us what matters most", "Díganos qué es importante", "Di nou sa ki pi enpòtan")}</small></span><b>›</b></button></div>
    ${actions(L("Save and continue", "Guardar y continuar", "Sove epi kontinye"), false, L("I’ll finish later", "Terminaré después", "Mwen pral fini pita"))}`;
}

function clinical() {
  const conditions = state.offer.qualifyingConditions?.length
    ? state.offer.qualifyingConditions.map(condition => localizedCondition(condition.name || condition.patientFriendlyName))
    : [state.offer.qualifyingCondition?.name || state.offer.qualifyingCondition?.patientFriendlyName].filter(Boolean).map(localizedCondition);
  return `${art("shield")}${titleBlock(L("Confirm your health information", "Confirme su información médica", "Konfime enfòmasyon sou sante w"), L("We already have this information on file.", "Ya tenemos esta información.", "Nou deja gen enfòmasyon sa a nan dosye nou."), L("Care setup", "Configuración", "Konfigirasyon swen"))}
    <section class="known-data">${conditions.map(condition => `<p>${icon("check")} ${condition}</p>`).join("")}<p>${icon("calendar")} ${L("Last updated: August 18, 2026", "Actualizado: 18 de agosto de 2026", "Dènye mizajou: 18 out 2026")}</p></section>
    <form class="choice-list">${choice("correct", "check", L("Everything looks right", "Todo está correcto", "Tout bagay sanble dwat"), "", true)}${choice("changed", "document", L("Something has changed", "Algo cambió", "Yon bagay chanje"), "")}${choice("help", "question", L("I need help reviewing this", "Necesito ayuda para revisarlo", "Mwen bezwen èd revize sa a"), "")}</form>${actions(t().continue)}`;
}

function goals() {
  return `${art("goals")}${titleBlock(L("What matters most to you?", "¿Qué es lo más importante para usted?", "Ki sa ki pi enpòtan pou ou?"), L("Choose one or more goals. You can change these later.", "Elija uno o más objetivos. Puede cambiarlos después.", "Chwazi youn oswa plis objektif. Ou ka chanje sa yo pita."))}<form class="goal-list">${[L("Stay independent", "Mantener mi independencia", "Rete endepandan"), L("Feel confident managing my health", "Sentirme seguro manejando mi salud", "Santi w gen konfyans nan jere sante mwen"), L("Avoid unnecessary hospital visits", "Evitar visitas innecesarias al hospital", "Evite vizit lopital ki pa nesesè"), L("Keep my medications organized", "Mantener mis medicamentos organizados", "Kenbe medikaman mwen yo òganize"), L("Stay connected with my doctors", "Mantener contacto con mis médicos", "Rete konekte ak doktè mwen yo")].map((x, i) => check(`goal-${i}`, x, i < 2)).join("")}</form>${actions(t().continue)}`;
}

function accessBaseline() {
  return `${art("shield")}${titleBlock(L("Let’s complete your first health check", "Completemos su primera evaluación", "Ann fè premye tchekòp sante ou"), L("This helps your ACCESS care team understand your starting point.", "Esto ayuda al equipo ACCESS a conocer su punto de partida.", "Sa ede ekip swen ACCESS ou konprann pwen depa ou."), L("ACCESS health check", "Evaluación de salud ACCESS", "Tchekòp sante ACCESS"))}${rows([["chart", L("Your health measures", "Sus mediciones", "Mezi sante ou yo"), ""], ["question", L("Questions about your condition", "Preguntas sobre su condición", "Kesyon sou pwoblèm sante ou"), ""], ["pill", L("Your medications", "Sus medicamentos", "Medikaman ou yo"), ""], ["goals", L("Your health goals", "Sus objetivos de salud", "Objektif sante ou"), ""]])}<div class="meta-list"><span>${icon("clock")} ${L("Takes about 10–15 minutes", "Toma unos 10–15 minutos", "Li pran apeprè 10–15 minit")}</span><span>${icon("shield")} ${L("You can save and finish later", "Puede guardar y terminar después", "Ou ka anrejistre epi fini pita")}</span></div>${actions(L("Start health check", "Iniciar evaluación", "Kòmanse tchekòp sante a"), false, L("I’ll do this later", "Lo haré después", "M ap fè sa pita"))}`;
}

function accessMeasure() {
  const primary = state.offer.qualifyingConditions?.[0] || state.offer.qualifyingCondition || {};
  const condition = `${primary.name || ""} ${primary.patientFriendlyName || ""}`.toLowerCase();
  const measure = condition.includes("diabetes")
    ? [L("Your blood sugar starting point", "Su punto de partida de glucosa", "Mezi sik nan san ou kòm pwen depa"), L("This measure is part of your ACCESS care for diabetes.", "Esta medición es parte de su cuidado ACCESS para la diabetes.", "Mezi sa a fè pati swen ACCESS ou pou dyabèt.")]
    : condition.includes("heart failure")
      ? [L("Your heart health starting point", "Su punto de partida de salud cardíaca", "Sante kè ou kòm pwen depa"), L("This measure is part of your ACCESS care for heart failure.", "Esta medición es parte de su cuidado ACCESS para la insuficiencia cardíaca.", "Mezi sa a fè pati swen ACCESS ou pou ensifizans kadyak.")]
      : condition.includes("kidney")
        ? [L("Your kidney health starting point", "Su punto de partida de salud renal", "Sante ren ou kòm pwen depa"), L("This measure is part of your ACCESS care for kidney health.", "Esta medición es parte de su cuidado ACCESS para la salud renal.", "Mezi sa a fè pati swen ACCESS ou pou sante ren.")]
        : [L("Your blood pressure starting point", "Su punto de partida de presión arterial", "Tansyon ou kòm pwen depa"), L("This measure is part of your ACCESS care for high blood pressure.", "Esta medición es parte de su cuidado ACCESS para presión alta.", "Mezi sa a fè pati swen ACCESS ou pou tansyon wo.")];
  const bloodPressureMeasure = !condition.includes("diabetes") && !condition.includes("heart failure") && !condition.includes("kidney");
  const options = bloodPressureMeasure
    ? [
        ["recent", "heart", L("I have a recent reading", "Tengo una lectura reciente", "Mwen gen yon lekti resan"), L("Enter the date and blood pressure", "Ingrese la fecha y presión", "Antre nan dat la ak san presyon")],
        ["help", "question", L("I have a monitor but need help", "Tengo monitor pero necesito ayuda", "Mwen gen yon monitè men mwen bezwen èd"), L("We can guide you", "Podemos guiarle", "Nou ka gide ou")],
        ["ship", "device", L("I need a monitor from ITERA", "Necesito un monitor de ITERA", "Mwen bezwen yon monitè nan ITERA"), L("We’ll help arrange one", "Le ayudaremos a obtener uno", "Nou pral ede fè aranjman pou yon sèl")]
      ]
    : [
        ["recent", "heart", L("I have a recent health measure", "Tengo una medición de salud reciente", "Mwen gen yon mezi sante resan"), L("Enter the date and result", "Ingrese la fecha y el resultado", "Antre dat ak rezilta a")],
        ["help", "question", L("I need help reviewing my information", "Necesito ayuda para revisar mi información", "Mwen bezwen èd revize enfòmasyon mwen yo"), L("We can guide you", "Podemos guiarle", "Nou ka gide ou")],
        ["support", "people", L("I need support from ITERA", "Necesito apoyo de ITERA", "Mwen bezwen sipò ITERA"), L("We’ll help with the next step", "Le ayudaremos con el próximo paso", "Nou pral ede ak pwochen etap la")]
      ];
  return `${art(bloodPressureMeasure ? "device" : "shield")}${titleBlock(measure[0], measure[1], `${state.offer.accessTrack || "ACCESS"} ${L("health check", "evaluación de salud", "tchekòp sante")}`)}
    <form class="choice-list">${options.map(([value, itemIcon, title, body]) => choice(value, itemIcon, title, body)).join("")}</form>${actions(t().continue)}`;
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
  return `${art("check", true)}${titleBlock(L("Home monitoring is ready", "El monitoreo en casa está listo", "Siveyans lakay ou pare"), L("We securely received your first connected reading.", "Recibimos de forma segura su primera lectura conectada.", "Nou te resevwa san danje premye lekti ou konekte."))}<section class="reading-card"><small>${L("Your first reading", "Su primera lectura", "Premye lekti ou")}</small><strong>${state.reading?.systolic || 120} / ${state.reading?.diastolic || 80} <em>mmHg</em></strong></section><section class="next-card"><h2>${L("What happens next?", "¿Qué sigue?", "Kisa ki rive apre sa?")}</h2>${rows([["calendar", L("Take readings as directed by your care team", "Tome lecturas según le indiquen", "Pran lekti jan ekip swen w la mande sa"), ""], ["chart", L("ITERA reviews your transmitted readings", "ITERA revisa sus lecturas transmitidas", "ITERA revize lekti transmèt ou yo"), ""], ["shield", L("This service is not for emergencies", "Este servicio no es para emergencias", "Sèvis sa a se pa pou ijans"), ""]])}</section>${cta(L("Go to my dashboard", "Ir a mi panel", "Ale nan tablodbò mwen an"), "finish")}<button class="text-button" data-action="help">${L("Talk with my care team", "Hablar con mi equipo", "Pale ak ekip swen mwen an")}</button>`;
}

function onboardingComplete() {
  const doctorCopy = state.offer?.physician?.displayName ? L(`You continue working with ${state.offer.physician.displayName}`, `Continúa trabajando con ${state.offer.physician.displayName}`, `Ou kontinye travay avèk ${state.offer.physician.displayName}`) : L("You continue working with your doctors", "Continúa trabajando con sus médicos", "Ou kontinye travay avèk doktè ou yo");
  return `${art("check", true)}${titleBlock(L("You’re off to a great start", "Ha comenzado muy bien", "Ou ap ale nan yon gwo kòmanse"), L("We saved your information and will use it to personalize your care.", "Guardamos su información y la usaremos para personalizar su cuidado.", "Nou sove enfòmasyon ou yo epi nou pral itilize li pou pèsonalize swen ou yo."))}<section class="next-card"><h2>${L("What happens next?", "¿Qué sigue?", "Kisa ki rive apre sa?")}</h2>${rows([["people", L("Your ITERA care team reviews your information", "Su equipo ITERA revisa su información", "Ekip swen ITERA w la revize enfòmasyon w yo"), ""], ["phone", L("We contact you with any follow-up questions", "Le contactaremos si hay preguntas", "Nou kontakte ou ak nenpòt kesyon swivi"), ""], ["doctor", doctorCopy, ""]])}</section>${cta(L("Go to my dashboard", "Ir a mi panel", "Ale nan tablodbò mwen an"), "finish")}<button class="text-button" data-action="help">${L("Talk with my care team", "Hablar con mi equipo", "Pale ak ekip swen mwen an")}</button>`;
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
  return [prototypeConfig.program, prototypeConfig.program === "ACCESS" ? prototypeConfig.accessTrack : null, prototypeConfig.source, physicianRequired ? prototypeConfig.physicianDisplayName : null, prototypeConfig.conditions.join(" + "), prototypeConfig.coverage, prototypeConfig.program === "ACCESS" ? eligibilityLabel : null, languageLabel].filter(Boolean).join(" · ");
}

function prototypeSetup() {
  const access = prototypeConfig.program === "ACCESS";
  const physicianRequired = scenarioRequiresPhysician(prototypeConfig.program, prototypeConfig.source);
  const sourceOptions = access ? PROTOTYPE_OPTIONS.accessSources : PROTOTYPE_OPTIONS.sources;
  const coverageOptions = PROTOTYPE_OPTIONS.coverage.map(coverage => `<option value="${coverage}" ${coverage === prototypeConfig.coverage ? "selected" : ""} ${access && coverage === "Medicare Advantage" ? "disabled aria-disabled=\"true\"" : ""}>${coverage}${access && coverage === "Medicare Advantage" ? " — Not available for ACCESS" : ""}</option>`).join("");
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

const renderers = { INVITATION: invitation, DECISION_MAKER: decisionMaker, PERSONAL_REPRESENTATIVE_DETAILS: personalRepresentativeDetails, REPRESENTATIVE_MOBILE_VERIFICATION: representativeMobileVerification, REPRESENTATIVE_AUTHORITY_ATTESTATION: representativeAuthorityAttestation, REPRESENTATIVE_AUTHORITY_ESCALATION: representativeAuthorityEscalation, IDENTITY_VERIFICATION: identity, CARE_RECOMMENDATION: recommendation, HOW_CARE_WORKS: howCareWorks, DISCLOSURE: disclosure, CONSENT_REVIEW: consent, ENROLLMENT_PROCESSING: () => processing(), ACCESS_ALIGNMENT_PROCESSING: () => processing("alignment"), ENROLLMENT_CONFIRMED: success, ACCESS_PRE_ELIGIBILITY_NOTICE: accessNotice, ACCESS_MEDICARE_IDENTIFIER: medicareIdentifier, ACCESS_ELIGIBILITY_PROCESSING: eligibilityProcessing, ACCESS_ELIGIBILITY_RESULT: eligibilityResult, ONBOARDING: onboarding, CLINICAL_VERIFICATION: clinical, GOALS: goals, ACCESS_BASELINE: accessBaseline, ACCESS_MEASURE: accessMeasure, RPM_DEVICE_PATH: rpmDevice, RPM_ADDRESS_CONFIRMATION: shipping, RPM_DEVICE_SETUP: deviceSetup, RPM_FIRST_READING: firstReading, RPM_MONITORING_READY: monitoringReady, ONBOARDING_COMPLETE: onboardingComplete, CALLBACK_CONFIRMED: callbackConfirmed, OUTCOME_STOPPED: stoppedOutcome, OFFER_INVALID: offerError, OFFER_EXPIRED: offerError };

function devPanel() {
  if (import.meta.env.PROD) return "";
  return `<aside class="dev-panel ${state.devOpen ? "open" : ""}"><button class="dev-toggle" data-action="dev">Demo</button><div><label>Scenario<select id="scenario-select">${Object.entries(SCENARIOS).map(([id, x]) => `<option value="${id}" ${id === state.scenarioId ? "selected" : ""}>${x.label}</option>`).join("")}</select></label><label>Jump to<select id="screen-select">${journeyFor(state).map(x => `<option value="${x}" ${x === state.screen ? "selected" : ""}>${x}</option>`).join("")}</select></label><button class="small-action" data-action="clear">Clear saved demo</button></div></aside>`;
}

function render() {
  state.assistantOpen = false;
  document.body.classList.remove("assistant-open");
  if (state.screen === "PROTOTYPE_SETUP") { app.innerHTML = prototypeSetup(); bindPrototypeSetup(); return; }
  if (state.screen === "OFFER_LOADING") { app.innerHTML = `<main class="shell loading-screen" aria-live="polite">${art("shield")}<h1>${L("Opening your secure invitation…", "Abriendo su invitación segura…", "Ouvèti envitasyon sekirite w la...")}</h1></main>`; return; }
  if (["OFFER_INVALID", "OFFER_EXPIRED"].includes(state.screen)) { app.innerHTML = `<main class="shell"><section class="screen centered-error">${offerError()}</section></main>`; return; }
  const renderer = renderers[state.screen] || (() => `${titleBlock(L("We need a moment", "Necesitamos un momento", "Nou bezwen yon ti moman"), L("Please call our care team for help.", "Llame a nuestro equipo de cuidado para obtener ayuda.", "Tanpri rele ekip swen nou an pou jwenn èd."))}`);
  const screenClass = state.screen === "DECISION_MAKER" ? "decision-maker-screen" : ["PERSONAL_REPRESENTATIVE_DETAILS", "REPRESENTATIVE_MOBILE_VERIFICATION", "REPRESENTATIVE_AUTHORITY_ATTESTATION", "REPRESENTATIVE_AUTHORITY_ESCALATION"].includes(state.screen) ? "representative-details-screen" : state.screen === "IDENTITY_VERIFICATION" ? "identity-screen" : state.screen === "CARE_RECOMMENDATION" ? "recommendation-screen" : state.screen === "HOW_CARE_WORKS" ? "care-works-screen" : state.screen === "DISCLOSURE" && state.offer?.pathway === "ACCESS" ? "access-disclosure-screen" : state.screen === "CONSENT_REVIEW" ? `consent-screen${state.offer?.pathway === "ACCESS" ? " access-consent-screen" : ""}` : state.screen === "ACCESS_PRE_ELIGIBILITY_NOTICE" ? "access-notice-screen" : state.screen === "ACCESS_ELIGIBILITY_PROCESSING" ? `eligibility-processing-screen${state.eligibilityError ? " eligibility-error-screen" : ""}` : "";
  const assuranceOverride = state.screen === "ACCESS_ELIGIBILITY_RESULT" && state.accessOutcome === "eligible" ? "NO_COMMITMENT_YET" : state.screen === "ACCESS_ELIGIBILITY_RESULT" && state.accessOutcome === "notEligible" ? "NOT_ELIGIBLE_REASSURANCE" : state.screen === "CONSENT_REVIEW" && state.offer?.pathway === "ACCESS" ? "ENROLLMENT_CHOICE" : "";
  app.innerHTML = `<main class="shell">${header()}<section class="screen ${screenClass}" id="screen-content">${renderer()}${state.screen === "INVITATION" ? "" : contextualAssuranceFooter(state.screen, assuranceOverride)}</section>${emmiAssistant()}<div class="save-status" role="status" aria-live="polite"></div></main>${devPanel()}`;
  bind();
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
    state = { ...state, scenarioId: "prototype", screen: "OFFER_LOADING", offer: null, language: prototypeConfig.language, role: "patient", completionRole: "patient", representativeFullName: "", representativeRelationship: "", representativeAuthorityType: "", representativePhone: "", representativeOtpDeliveryId: "", representativeOtpResendAvailableAt: 0, phoneVerified: false, phoneVerificationMethod: "", phoneVerifiedAt: "", representativeAuthorityAttested: false, authorityAttestation: false, authorityAttestedAt: "", authorityVerificationMethod: AUTHORITY_VERIFICATION_METHODS[0], authorityAdditionalVerificationRequired: false, consentRole: "", consentVersion: "", consentTimestamp: "", sessionId: globalThis.crypto?.randomUUID?.() || `session_${Date.now().toString(36)}`, identityVerified: false, accessEligible: false, accessOutcome: null, eligibilityPhase: "checkingEnrollment", eligibilityError: false, eligibilityRequestKey: "", devicePath: null, audit: [], error: "" };
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
  if (state.screen === "ACCESS_PRE_ELIGIBILITY_NOTICE" && !document.querySelector('[name="accessNotice"]')?.checked) { state.error = L("Please acknowledge this information to continue.", "Reconozca esta información para continuar.", "Tanpri rekonèt enfòmasyon sa yo pou kontinye."); render(); return; }
  if (state.screen === "ACCESS_MEDICARE_IDENTIFIER") { const mbi = document.querySelector('[name="mbi"]')?.value.replace(/\s/g, ""); if (!/^[A-Za-z0-9]{11}$/.test(mbi || "")) { state.error = L("Enter the 11-character number from your Medicare card.", "Ingrese los 11 caracteres de su tarjeta de Medicare.", "Antre nimewo 11 karaktè ki soti nan kat Medicare ou a."); render(); return; } audit(state, "medicare_identifier_verified"); }
  if (state.screen === "DISCLOSURE") {
    if (!document.querySelector('[name="acknowledge"]')?.checked) { state.error = L("Please confirm you reviewed this information.", "Confirme que revisó esta información.", "Tanpri konfime ou revize enfòmasyon sa a."); render(); return; }
    await service.saveAcknowledgement(); audit(state, "disclosure_acknowledged");
  }
  if (state.screen === "CONSENT_REVIEW") {
    const f = document.querySelector("#consent-form");
    const authorityMissing = state.role === "representative" && !f.authority?.checked;
    if (authorityMissing || !f.consent.checked || !f.enroll.checked) { state.error = L("Please complete each required confirmation to continue.", "Complete cada confirmación requerida para continuar.", "Tanpri ranpli tout konfimasyon ki nesesè pou kontinye."); render(); return; }
    state.busy = true; render(); await service.saveConsent(); state.busy = false; state.consentSaved = true;
    state.consentRole = isPersonalRepresentative() ? "PERSONAL_REPRESENTATIVE" : "PATIENT";
    state.consentVersion = state.offer.consent.version;
    state.consentTimestamp = new Date().toISOString();
    audit(state, "consent_saved", "success", { consentRole: state.consentRole, consentVersion: state.consentVersion });
  }
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
async function runEnrollment() { const result = await service.createTraditionalEnrollment(); if (result.status === "confirmed") { state.enrollmentConfirmed = true; audit(state, "enrollment", "confirmed"); state.screen = "ENROLLMENT_CONFIRMED"; draftStore.save(state); render(); } }
async function runAlignment() { const result = await service.submitAccessAlignment(); if (result.status === "confirmed") { state.alignmentConfirmed = true; state.enrollmentConfirmed = true; audit(state, "alignment", "confirmed"); state.screen = "ENROLLMENT_CONFIRMED"; draftStore.save(state); render(); } }
function refreshAssistantLayer({ focusInput = false } = {}) {
  const current = document.querySelector(".assistant-layer");
  if (!current) return;
  current.outerHTML = assistantLayer();
  bindAssistantLayer();
  const layer = document.querySelector(".assistant-layer");
  if (focusInput) layer?.querySelector("#assistant-question")?.focus();
  else layer?.querySelector(".assistant-conversation")?.lastElementChild?.scrollIntoView({ block: "nearest" });
}

function askEmmi(question) {
  const cleaned = question.trim();
  if (!cleaned) return;
  const response = assistantAnswer(cleaned, assistantContext());
  state.assistantMessages.push({ role: "user", text: cleaned }, { role: "assistant", text: response.text, emergency: response.emergency });
  audit(state, "emmi_question", response.emergency ? "emergency_guidance" : state.assistantOriginScreen);
  refreshAssistantLayer({ focusInput: true });
}

function closeAssistant() {
  const scrollY = state.assistantScrollY;
  const languageChanged = state.assistantLanguageChanged;
  state.assistantOpen = false;
  state.assistantLanguageChanged = false;
  document.body.classList.remove("assistant-open");
  document.querySelector(".assistant-layer")?.remove();
  if (languageChanged) render();
  requestAnimationFrame(() => {
    window.scrollTo({ top: scrollY, behavior: "auto" });
    document.querySelector(".emmi-assistant")?.focus({ preventScroll: true });
  });
}

function bindAssistantLayer() {
  const layer = document.querySelector(".assistant-layer");
  if (!layer) return;
  layer.querySelector(".assistant-question-form")?.addEventListener("submit", event => {
    event.preventDefault();
    askEmmi(new FormData(event.currentTarget).get("question")?.toString() || "");
  });
  layer.querySelectorAll("[data-assistant-question]").forEach(button => button.addEventListener("click", () => askEmmi(button.dataset.assistantQuestion || "")));
  layer.querySelectorAll("[data-assistant-action]").forEach(control => control.addEventListener("click", event => {
    event.preventDefault();
    const action = control.dataset.assistantAction;
    if (action === "close") closeAssistant();
    if (action === "faq") { state.assistantFaqOpen = !state.assistantFaqOpen; refreshAssistantLayer(); }
    if (action === "callback") {
      state.callbackRequested = true;
      audit(state, "callback_requested", "emmi");
      state.assistantMessages.push({ role: "assistant", text: L(`We’ll call the number ending in ${state.offer.patient.phoneMasked.slice(-4)} within one business day.`, `Llamaremos al número terminado en ${state.offer.patient.phoneMasked.slice(-4)} dentro de un día hábil.`, `N ap rele nimewo ki fini ak ${state.offer.patient.phoneMasked.slice(-4)} nan yon jou ouvrab.`) });
      refreshAssistantLayer();
    }
    if (action === "language") {
      setLanguage(state.language === "en" ? "es" : state.language === "es" ? "ht" : "en");
      state.assistantLanguageChanged = true;
      state.assistantMessages = [];
      refreshAssistantLayer();
    }
  }));
}

function showHelp() {
  if (state.assistantOpen || !state.offer) return;
  if (state.assistantOriginScreen !== state.screen) {
    state.assistantMessages = [];
    state.assistantFaqOpen = false;
  }
  state.assistantOpen = true;
  state.assistantOriginScreen = state.screen;
  state.assistantScrollY = window.scrollY;
  state.assistantLanguageChanged = false;
  document.body.classList.add("assistant-open");
  document.querySelector(".shell")?.insertAdjacentHTML("beforeend", assistantLayer());
  bindAssistantLayer();
  requestAnimationFrame(() => document.querySelector("#assistant-title")?.focus({ preventScroll: true }));
}

function bindEmmiDrag() {
  const emmi = document.querySelector(".emmi-assistant");
  const shell = document.querySelector(".shell");
  if (!emmi || !shell) return;
  const positionKey = "itera.emmi.position.v1";
  const bounds = () => {
    const shellRect = shell.getBoundingClientRect();
    return { minX: shellRect.left + 6, maxX: shellRect.right - emmi.offsetWidth - 6, minY: 6, maxY: window.innerHeight - emmi.offsetHeight - 6 };
  };
  const place = (left, top) => {
    const limit = bounds();
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

function bind() {
  document.querySelectorAll("[data-action]").forEach(el => el.addEventListener("click", async event => {
    event.preventDefault(); const action = el.dataset.action;
    if (action === "next") {
      if (el.disabled || el.dataset.pending === "true") return;
      el.dataset.pending = "true";
      el.disabled = true;
      try { await advance(); } finally { if (el.isConnected) { delete el.dataset.pending; el.disabled = false; } }
    }
    if (action === "back") { state.screen = previousScreen(state); render(); }
    if (action === "help") showHelp();
    if (action === "authority-document") showHelp();
    if (action === "callback") { state.callbackRequested = true; state.returnScreen = state.screen; state.screen = "CALLBACK_CONFIRMED"; audit(state, "callback_requested"); render(); }
    if (action === "return") { state.screen = state.returnScreen || "INVITATION"; render(); }
    if (action === "language") { setLanguage(state.language === "en" ? "es" : state.language === "es" ? "ht" : "en"); render(); }
    if (action === "change-representative-phone") { state.phoneVerified = false; state.representativeOtpDeliveryId = ""; state.screen = "PERSONAL_REPRESENTATIVE_DETAILS"; draftStore.save(state); render(); }
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
    if (action === "secondary") { if (["ONBOARDING", "ACCESS_BASELINE"].includes(state.screen)) { draftStore.save(state); document.querySelector(".save-status").textContent = t().saved; } else showHelp(); }
    if (action === "finish") { draftStore.clear(); el.textContent = L("Done", "Listo", "Fini"); el.disabled = true; }
    if (action === "dev") { state.devOpen = !state.devOpen; render(); }
    if (action === "clear") { draftStore.clear(); location.reload(); }
  }));
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
  const accessAcknowledgement = document.querySelector('[name="accessNotice"]');
  const accessEligibilityCta = document.querySelector('.access-notice-screen [data-action="next"]');
  accessAcknowledgement?.addEventListener("change", event => { if (accessEligibilityCta) accessEligibilityCta.disabled = !event.target.checked; });
  const disclosureAcknowledgement = document.querySelector('[name="acknowledge"]');
  const disclosureCta = document.querySelector('.access-disclosure-screen [data-action="next"]');
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
  bindEmmiDrag();
}

async function boot() {
  try {
    state.offer = await service.getOffer();
    const saved = draftStore.load();
    if (saved?.scenarioId === scenarioId && (saved.identityVerified || saved.completionRole === "personalRepresentative")) {
      state = { ...state, ...saved, offer: state.offer, audit: saved.audit || [] };
      state.completionRole = saved.completionRole || (state.role === "representative" ? "personalRepresentative" : state.role === "helper" ? "helper" : "patient");
      if (state.screen === "REPRESENTATIVE_MOBILE_VERIFICATION" && !state.phoneVerified) state.screen = "PERSONAL_REPRESENTATIVE_DETAILS";
    }
    else {
      state.screen = "INVITATION";
      const preferredLanguage = state.offer.selectedLanguage || (() => { try { return localStorage.getItem("itera.enrollment.language.v1"); } catch { return null; } })();
      if (["en", "es", "ht"].includes(preferredLanguage)) state.language = preferredLanguage;
      if (state.offer.fixture.representative) { state.role = "representative"; state.completionRole = "personalRepresentative"; }
    }
    document.documentElement.lang = htmlLanguage(state.language); render();
    if (state.screen === "ACCESS_ELIGIBILITY_PROCESSING" && !state.eligibilityError) runEligibility();
  } catch (error) { state.screen = error.message === "expired" ? "OFFER_EXPIRED" : "OFFER_INVALID"; render(); }
}

render();
if (params.has("scenario") || prototypeMode) boot();
