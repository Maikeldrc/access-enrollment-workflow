import { DEFAULT_PROTOTYPE_CONFIG, I18N, PROTOTYPE_OPTIONS, SCENARIOS } from "./config.js";
import { MockEnrollmentService, DraftStore, audit } from "./services.js";
import { journeyFor, nextScreen, previousScreen, progressFor } from "./machine.js";
import {
  ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, ChartNoAxesColumnIncreasing,
  Check, ChevronRight, CircleHelp, Clock3, ExternalLink, FileText, Globe2,
  HeartPulse, House, Info, LockKeyhole, Package, Phone, Pill, ShieldCheck,
  Stethoscope, TabletSmartphone, Target, UserRound, UsersRound, Wifi
} from "lucide";

const app = document.querySelector("#app");
const params = new URLSearchParams(location.search);
const scenarioId = params.get("scenario") || "access-happy";
const DEMO_IDENTITY = { dob: "05/12/1954", dobIso: "1954-05-12", zip: "33176" };
const draftStore = new DraftStore();
let service = new MockEnrollmentService(scenarioId);
let prototypeConfig = { ...DEFAULT_PROTOTYPE_CONFIG };
let conditionMenuOpen = false;
let state = {
  scenarioId, screen: params.has("scenario") ? "OFFER_LOADING" : "PROTOTYPE_SETUP", offer: null, language: "en", role: "patient", identityVerified: false,
  identityAttempts: 0, consentSaved: false, enrollmentConfirmed: false, accessEligible: false, accessOutcome: null,
  alignmentConfirmed: false, devicePath: null, addressConfirmed: false, setupComplete: false, readingReceived: false,
  reading: null, callbackRequested: false, onboarding: {}, audit: [], busy: false, error: "", devOpen: false
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
const L = (en, es, ht = en) => state.language === "es" ? es : state.language === "ht" ? ht : en;
const t = () => I18N[state.language];
const languageCode = () => ({ en: "EN", es: "ES", ht: "KR" })[state.language] || "EN";
const languageActionLabel = () => L("Change language to Spanish", "Cambiar idioma a criollo", "Chanje lang pou anglè");
const cta = (label, action = "next", secondary = false) => `<button class="button ${secondary ? "secondary" : "primary"}" data-action="${action}">${label}${secondary ? "" : icon("arrowRight", "button-icon")}</button>`;
const rows = items => `<div class="card-list">${items.map(([i, title, body]) => `<article class="info-row">${icon(i)}<div><strong>${title}</strong>${body ? `<p>${body}</p>` : ""}</div></article>`).join("")}</div>`;
const choice = (value, i, title, body, checked = false) => `<label class="choice-card"><input type="radio" name="choice" value="${value}" ${checked ? "checked" : ""}><span class="choice-dot"></span>${icon(i)}<span><strong>${title}</strong><small>${body}</small></span></label>`;
const check = (name, label, checked = false) => `<label class="check-row"><input type="checkbox" name="${name}" ${checked ? "checked" : ""}><span class="check-box">✓</span><span>${label}</span></label>`;
const titleBlock = (title, subtitle = "", eyebrow = "") => `${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ""}<h1 tabindex="-1">${title}</h1>${subtitle ? `<p class="lead">${subtitle}</p>` : ""}`;
const displayDate = isoDate => {
  const [year, month, day] = isoDate.split("-");
  return year && month && day ? `${month}/${day}/${year}` : "";
};
const typedDate = value => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};
const localToday = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
};
const art = (kind = "shield", success = false) => {
  const deviceScene = ["device", "wifi"].includes(kind) ? `<div class="device-scene"><span class="cuff"><i></i></span><span class="monitor"><b>120</b><em>80</em><i></i></span>${kind === "wifi" ? '<span class="signal"><i></i><i></i><i></i></span>' : ""}</div>` : "";
  return `<div class="art art-${kind} ${success ? "success" : ""}" aria-hidden="true"><span class="sparkle s1">✦</span><span class="sparkle s2">✦</span><span class="sparkle s3">•</span><div class="art-orbit"></div>${deviceScene || `<div class="art-card"><span class="art-line one"></span><span class="art-line two"></span>${icon(kind, "art-icon")}</div>`}<span class="art-leaf left"></span><span class="art-leaf right"></span></div>`;
};
const providerCard = () => `<article class="provider-card"><img src="${state.offer.referringProvider.verifiedPhotoUrl}" alt=""><div><strong>Dr. Fresner <span aria-label="Verified provider">✓</span></strong><small>${L("Referring physician", "Médico remitente")}</small></div></article>`;
const security = () => `<p class="security">${icon("lock")} ${t().secure}</p>`;
const actions = (primary, back = true, secondary = "") => `<div class="actions">${secondary ? cta(secondary, "secondary", true) : back ? cta(t().back, "back", true) : ""}${cta(primary)}</div>`;
const emmiAssistant = () => `<button class="emmi-assistant ${state.screen === "HELP_REQUESTED" ? "active" : ""}" data-action="${state.screen === "HELP_REQUESTED" ? "" : "help"}" aria-label="${L("Ask Emmi, AI assistant", "Preguntar a Emmi, asistente de IA", "Mande Emmi, asistan IA")}" title="${L("Drag Emmi to move it", "Arrastre a Emmi para moverla", "Trennen Emmi pou deplase li")}"><span class="emmi-avatar"><img src="/assets/emmi-assistant.png" alt=""></span></button>`;

function header() {
  if (state.screen === "OFFER_LOADING") return "";
  if (state.screen === "INVITATION") return "";
  const progress = progressFor(state);
  return `<header class="app-header">
    <div class="brand-row"><button class="icon-button back-button" data-action="back" aria-label="${t().back}" ${state.screen === "INVITATION" ? "hidden" : ""}>${icon("arrowLeft")}</button><a class="brand" href="#" data-action="restart" aria-label="ITERA HEALTH home"><b>ITERA.</b>HEALTH</a><button class="language" data-action="language" aria-label="${languageActionLabel()}">${icon("language")} ${languageCode()}</button></div>
    <div class="progress-meta"><span>${progress.label}</span><span>${L("Step", "Paso")} ${progress.current} ${L("of", "de")} ${progress.total}</span></div>
    <div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${progress.total}" aria-valuenow="${progress.current}" aria-label="${progress.label}"><span style="width:${Math.min(100, progress.current / progress.total * 100)}%"></span></div>
  </header>`;
}

function resolveTrustHero(offer) {
  const source = offer.enrollmentSource;
  const access = offer.pathway === "ACCESS";
  const physicianName = offer.physician?.displayName || "";
  if (access && source === "ITERA Direct Outreach") return { variant: "ACCESS_PARTICIPANT", src: "/images/enrollment/card-access-participant-hero.png", alt: "ITERA HEALTH connected Medicare ACCESS care" };
  if (access && source === "Physician Referral" && physicianName) return { variant: "DOCTOR_RECOMMENDS_ACCESS", src: "/images/enrollment/card-doctor-recommends-hero.png", alt: "Your doctor recommends ACCESS care with ITERA HEALTH", overlayLabel: L("Recommended by", "Recomendado por", "Rekòmande pa"), physicianName };
  if (!access) return { variant: "PHYSICIAN_SUPERVISING", src: "/images/enrollment/card-physician-supervising-hero.png", alt: "Care coordinated with your physician and care team", overlayLabel: L("Coordinated with", "Coordinado con", "Kowòdone avèk"), physicianName };
  return { variant: "GENERIC_ITERA_CARE", alt: "ITERA HEALTH connected care support" };
}

function TrustHeroCard() {
  const hero = resolveTrustHero(state.offer);
  const overlayText = hero.overlayLabel && hero.physicianName ? `${hero.overlayLabel} ${hero.physicianName}` : "";
  const media = hero.src
    ? `<img class="trust-hero-image" src="${hero.src}" alt="${hero.alt}">${overlayText ? `<p class="trust-hero-overlay ${overlayText.length > 34 ? "long" : ""}"><span>${hero.overlayLabel}</span> <strong>${hero.physicianName}</strong></p>` : ""}`
    : `<div class="generic-trust-hero">${icon("shield")}<strong>${L("Connected care with ITERA HEALTH", "Cuidado conectado con ITERA HEALTH", "Swen konekte avèk ITERA HEALTH")}</strong><small>${L("Support designed around your health needs", "Apoyo diseñado según sus necesidades de salud", "Sipò ki fèt selon bezwen sante ou")}</small></div>`;
  return `<section class="invitation-stage trust-hero-card" data-trust-source="${state.offer.enrollmentSource}" data-hero-variant="${hero.variant}">
    <div class="stage-brand-row"><button class="language stage-language" data-action="language" aria-label="${languageActionLabel()}">${languageCode()}</button></div>
    <div class="trust-hero-media">${media}</div>
  </section>`;
}

function invitation() {
  const source = state.offer.enrollmentSource || "Physician Referral";
  const physicianReferral = source === "Physician Referral";
  const practiceOutreach = source === "Practice Outreach";
  const physicianName = state.offer.physician?.displayName || state.offer.referringProvider?.name || L("your physician", "su médico", "doktè ou");
  const intro = physicianReferral ? L(`${physicianName}’s care team invited you to learn about additional support available through Medicare.`, `El equipo de ${physicianName} le invita a conocer apoyo adicional disponible a través de Medicare.`, `Ekip swen ${physicianName} envite w aprann sou sipò anplis ki disponib atravè Medicare.`) : practiceOutreach ? L("Fresner Medical Group and ITERA HEALTH invite you to learn about additional support available through Medicare.", "Fresner Medical Group e ITERA HEALTH le invitan a conocer apoyo adicional disponible a través de Medicare.", "Fresner Medical Group ak ITERA HEALTH envite w aprann sou sipò anplis ki disponib atravè Medicare.") : L("ITERA HEALTH invites you to learn about additional support available through Medicare.", "ITERA HEALTH le invita a conocer apoyo adicional disponible a través de Medicare.", "ITERA HEALTH envite w aprann sou sipò anplis ki disponib atravè Medicare.");
  return `${TrustHeroCard()}
    <div class="invitation-copy">${titleBlock(L("A new care option for your health", "Una nueva opción de cuidado para su salud", "Yon nouvo opsyon swen pou sante ou"), intro)}</div>
    <section class="invitation-benefits" aria-label="${L("What this means for you", "Qué significa esto para usted", "Sa sa vle di pou ou")}">${[
      ["physician", L("Keep your doctors", "Mantenga sus médicos", "Kenbe doktè ou yo"), L("Continue seeing the doctors you know", "Continúe viendo a los médicos que conoce", "Kontinye wè doktè ou konnen yo")],
      ["home", L("Get support from home", "Reciba apoyo desde casa", "Jwenn sipò lakay ou"), L("Ongoing support between office visits", "Apoyo continuo entre sus consultas", "Sipò kontinyèl ant vizit nan klinik")],
      ["shield", L("Participation is voluntary", "La participación es voluntaria", "Patisipasyon an volontè"), L("You’ll review the details before you enroll", "Revisará los detalles antes de inscribirse", "W ap revize detay yo anvan ou enskri")]
    ].map(([i,label,detail]) => `<div class="invitation-benefit">${icon(i)}<span><strong>${label}</strong><small>${detail}</small></span></div>`).join("")}</section>
    ${actions(L("See how it works", "Vea cómo funciona", "Gade kijan sa fonksyone"), false)}
    <p class="contact-line"><span>${L("Need help?", "¿Necesita ayuda?", "Bezwen èd?")}</span><a href="tel:+13053948070">${icon("phone", "contact-phone")}<span>${L("Call", "Llame al", "Rele")} ${state.offer.participantProvider.supportPhone}</span></a></p>`;
}

function decisionMaker() {
  return `${titleBlock(L("Who is completing this?", "¿Quién está completando esto?"), L("Choose the option that best describes you.", "Elija la opción que mejor lo describa."))}
    <form id="choice-form" class="choice-list">
      ${choice("patient", "person", L("For myself", "Para mí"), L("I am the patient", "Soy el paciente"), state.role === "patient")}
      ${choice("helper", "people", L("Helping the patient", "Ayudando al paciente"), L("The patient is present and will make the decisions", "El paciente está presente y tomará las decisiones"), state.role === "helper")}
      ${choice("representative", "shield", L("Personal representative", "Representante personal"), L("I am the patient's legally authorized personal representative", "Soy el representante personal legalmente autorizado del paciente"), state.role === "representative")}
    </form>${actions(t().continue)}`;
}

function identity() {
  const representative = state.role === "representative";
  return `${titleBlock(representative ? L("Confirm your authority", "Confirme su autoridad") : L("Let’s confirm it’s you", "Confirmemos su identidad"), representative ? L("We need to verify your authority before you can make a decision for the patient.", "Debemos verificar su autoridad antes de que pueda decidir por el paciente.") : L("Enter the patient’s information.", "Ingrese la información del paciente."))}
    <form id="identity-form" novalidate>
      <div class="field"><label for="dob">${L("Date of birth", "Fecha de nacimiento")}</label><div class="date-control"><input id="dob" class="date-text" name="dob" type="text" inputmode="numeric" autocomplete="bday" maxlength="10" value="${DEMO_IDENTITY.dob}" placeholder="MM/DD/YYYY" aria-describedby="identity-error"><input class="date-picker-native" type="date" min="1900-01-01" max="${localToday()}" value="${DEMO_IDENTITY.dobIso}" aria-label="${L("Choose date of birth from calendar", "Elegir fecha de nacimiento del calendario")}">${icon("calendar", "date-picker-icon")}</div></div>
      <label class="field"><span>${L("ZIP code", "Código postal")}</span><input name="zip" type="text" inputmode="numeric" autocomplete="postal-code" maxlength="5" value="${DEMO_IDENTITY.zip}" placeholder="5-digit ZIP code" aria-describedby="identity-error"></label>
      ${representative ? `<label class="field"><span>${L("Relationship to patient", "Relación con el paciente")}</span><select name="relationship"><option>Health care proxy</option><option>Legal guardian</option><option>Power of attorney</option></select></label>${check("authority", L("I confirm I have current legal authority", "Confirmo que tengo autoridad legal vigente"))}` : ""}
      <p class="form-error" id="identity-error" role="alert">${state.error}</p>
    </form>${actions(state.busy ? L("Checking…", "Verificando…") : t().continue)}${security()}`;
}

function recommendation() {
  return `${titleBlock(L("Your recommended care", "Su cuidado recomendado"), L("Based on your health needs, your care team recommends:", "Según sus necesidades de salud, su equipo recomienda:"))}
    ${rows(state.offer.careCapabilities.map(x => [x.icon, x.title, x.description]))}
    <aside class="note">${icon("info")}<span>${L("These recommendations are part of your offer and are not choices you need to make.", "Estas recomendaciones son parte de su oferta y no son opciones que deba elegir.")}</span></aside>
    ${actions(t().continue)}`;
}

function howCareWorks() {
  return `${titleBlock(L("How your care works", "Cómo funciona su cuidado"), state.offer.content.support)}${providerCard()}
    ${rows([["calendar", L("ITERA checks in regularly", "ITERA se comunica regularmente"), ""], ["phone", L("Get support between visits", "Reciba apoyo entre visitas"), ""], ["people", L("Your doctor stays involved", "Su médico sigue involucrado"), ""]])}
    <aside class="trust-note">${icon("shield")}<span>${L("ITERA shares important updates with your care team and does not replace your doctor.", "ITERA comparte actualizaciones importantes con su equipo y no reemplaza a su médico.")}</span></aside>
    ${actions(t().continue)}<button class="text-button" data-action="help">${L("I have questions", "Tengo preguntas")}</button>`;
}

function helpScreen() {
  return `${art("question")}${titleBlock(L("Do you have questions?", "¿Tiene preguntas?"), L("We’re here to help you feel confident.", "Estamos aquí para ayudarle a sentirse seguro."))}
    <div class="choice-list">
      <a class="link-card" href="tel:+13053948070">${icon("phone")}<span><strong>${t().call}</strong><small>${state.offer.participantProvider.supportPhone}</small></span><b>›</b></a>
      <button class="link-card" data-action="callback">${icon("phone")}<span><strong>${L("Request a callback", "Solicitar una llamada")}</strong><small>${L(`We’ll call the number ending in ${state.offer.patient.phoneMasked.slice(-4)}`, `Llamaremos al número terminado en ${state.offer.patient.phoneMasked.slice(-4)}`)}</small></span><b>›</b></button>
      <details class="faq"><summary>${icon("question")}<span><strong>${L("See common questions", "Ver preguntas comunes")}</strong><small>${L("Quick answers about this care", "Respuestas rápidas sobre este cuidado")}</small></span></summary><p>${L("Participation is voluntary. You can ask questions or stop at any time.", "La participación es voluntaria. Puede hacer preguntas o detenerse cuando quiera.")}</p></details>
    </div><p class="emmi-disclaimer">${icon("info")}<span>${L("Emmi is an AI assistant, not a clinician. For medical emergencies, call 911.", "Emmi es una asistente de IA, no una profesional clínica. Para emergencias médicas, llame al 911.", "Emmi se yon asistan IA, li pa yon pwofesyonèl klinik. Pou ijans medikal, rele 911.")}</span></p>${actions(L("Continue enrollment", "Continuar inscripción"), true)}`;
}

function disclosure() {
  const label = state.offer.pathway === "ACCESS" ? "ACCESS" : state.offer.pathway;
  return `${titleBlock(L("About your recommended care", "Acerca de su cuidado recomendado"), "", L("Important information", "Información importante"))}
    <section class="disclosure-card"><h2>${label}</h2>${state.offer.disclosures.blocks.map((x, i) => `<div class="disclosure-row">${icon(["people", "shield", "info"][i] || "check")}<p>${x}</p></div>`).join("")}${state.offer.pathway === "RPM" ? `<div class="disclosure-row">${icon("device")}<p>${L("Readings are sent automatically from a connected device. This service does not replace emergency care.", "Las lecturas se envían automáticamente desde un dispositivo conectado. Este servicio no reemplaza la atención de emergencia.")}</p></div>` : ""}</section>
    <details class="full-terms"><summary>${L("View full information", "Ver información completa")} <span>↗</span></summary><p>${L("Your information is used to coordinate the care described here and is protected under applicable privacy rules. You may contact the care team before deciding.", "Su información se usa para coordinar el cuidado descrito y está protegida por las reglas de privacidad aplicables. Puede contactar al equipo antes de decidir.")}</p></details>
    ${check("acknowledge", L("I have reviewed this information", "He revisado esta información"))}<p class="form-error" role="alert">${state.error}</p>${actions(L("I understand", "Entiendo"))}`;
}

function consent() {
  const role = state.role === "representative" ? L("Personal representative", "Representante personal") : L("Patient", "Paciente");
  return `${titleBlock(L("Review and agree", "Revise y acepte"), L(`I want to receive this recommended care from ITERA HEALTH, in coordination with Dr. Fresner.`, `Deseo recibir este cuidado recomendado de ITERA HEALTH, en coordinación con el Dr. Fresner.`))}
    <section class="care-team-card">${providerCard()}<div class="provider-connector"></div><div class="itera-provider">${icon("people")}<span><strong>ITERA HEALTH</strong><small>${L("Care provider", "Proveedor de cuidado")}</small></span></div></section>
    <div class="service-chips">${state.offer.consent.services.map(x => `<span>${icon("check")} ${x}</span>`).join("")}</div>
    <section class="consent-summary"><p>${state.offer.consent.costSharingText}</p>${state.offer.consent.stopRules.map(x => `<p>${icon("check")} ${x}</p>`).join("")}<p><strong>${L("Signer role", "Rol del firmante")}:</strong> ${role}</p></section>
    <form id="consent-form">${check("consent", L("I received and understand this important information", "Recibí y comprendo esta información importante"))}${check("enroll", L("I agree to enroll in the services listed above", "Acepto inscribirme en los servicios indicados"))}</form>
    <p class="form-error" role="alert">${state.error}</p>${actions(state.busy ? L("Saving…", "Guardando…") : L("Enroll now", "Inscribirme ahora"))}${security()}`;
}

function processing(kind = "enrollment") {
  const access = kind === "alignment";
  return `${art(access ? "lock" : "document")}${titleBlock(access ? L("Completing your enrollment with Medicare", "Completando su inscripción con Medicare") : L("We’re completing your enrollment", "Estamos completando su inscripción"), L("Please keep this page open. We’ll save your progress if you leave.", "Mantenga esta página abierta. Guardaremos su progreso si sale."))}
    <ol class="process-list">
      <li class="done">${icon("check")} ${access ? L("Saving your consent", "Guardando su consentimiento") : L("Saving your consent", "Guardando su consentimiento")}</li>
      <li class="active">${icon("clock")} ${access ? L("Sending your enrollment to Medicare", "Enviando su inscripción a Medicare") : L("Checking for an existing care service", "Buscando un servicio de cuidado existente")}</li>
      <li>${icon("clock")} ${access ? L("Waiting for Medicare confirmation", "Esperando confirmación de Medicare") : L("Setting up your care with ITERA HEALTH", "Configurando su cuidado con ITERA HEALTH")}</li>
    </ol>${security()}`;
}

function success() {
  const access = state.offer.pathway === "ACCESS", rpm = state.offer.pathway === "RPM";
  const title = access ? L("You’re enrolled with ITERA for this care", "Está inscrito con ITERA para este cuidado") : rpm ? L("You’re enrolled—let’s prepare your monitor", "Está inscrito; preparemos su monitor") : L("You’re enrolled in ongoing care support", "Está inscrito en apoyo de cuidado continuo");
  return `${art("check", true)}${titleBlock(title, state.offer.content.support)}<div class="status-pill">${icon("shield")} ${L("Enrollment confirmed", "Inscripción confirmada")}</div>
    <section class="next-card"><h2>${L("What happens next?", "¿Qué sigue?")}</h2>${rows([["phone", L("Your care team will call within 2 business days", "Su equipo llamará en 2 días hábiles"), ""], ["document", L("We’ll confirm your personalized care plan", "Confirmaremos su plan personalizado"), ""], ["people", L("You’ll continue to see your regular doctors", "Seguirá viendo a sus médicos habituales"), ""]])}</section>
    <details class="full-terms"><summary>${L("Consent details", "Detalles del consentimiento")}</summary><p>${L("Consent version", "Versión del consentimiento")}: ${state.offer.consent.version}<br>${L("Effective date", "Fecha efectiva")}: August 21, 2026</p></details>
    ${actions(access ? L("Start health check", "Iniciar evaluación de salud") : rpm ? L("Set up my monitor", "Configurar mi monitor") : L("Continue to set up care", "Continuar configuración"), false)}`;
}

function accessNotice() {
  return `${titleBlock(L("Before Medicare checks this care option", "Antes de que Medicare revise esta opción"), L("ACCESS is a federal payment model test conducted by the Centers for Medicare & Medicaid Services (CMS).", "ACCESS es una prueba federal de modelo de pago de los Centros de Medicare y Medicaid (CMS)."))}
    <div class="accordion-list"><details open><summary>${icon("lock")}<span><strong>${L("Data sharing", "Intercambio de datos")}</strong><small>${L("ITERA may share health information with CMS under federal privacy protections.", "ITERA puede compartir información médica con CMS bajo protecciones federales.")}</small></span></summary></details><details><summary>${icon("document")}<span><strong>${L("Random assignment", "Asignación aleatoria")}</strong><small>${L("CMS may place you in a comparison group. ITERA may not provide ACCESS care for 12 months.", "CMS puede asignarle a un grupo de comparación. ITERA podría no brindar cuidado ACCESS por 12 meses.")}</small></span></summary></details><details><summary>${icon("shield")}<span><strong>${L("Your Medicare benefits and rights", "Sus beneficios y derechos de Medicare")}</strong><small>${L("Your coverage and choice of doctors do not change.", "Su cobertura y elección de médicos no cambian.")}</small></span></summary></details></div>
    ${check("accessNotice", L("I have reviewed this information", "He revisado esta información"))}<p class="form-error" role="alert">${state.error}</p>${actions(L("Check with Medicare", "Consultar con Medicare"))}`;
}

function eligibilityProcessing() {
  return `${art("medicare")}${titleBlock(L("Checking this care option with Medicare", "Consultando esta opción con Medicare"), L("We’re securely checking whether your Medicare coverage can be used for this ACCESS care.", "Estamos verificando de forma segura si su cobertura puede usarse para este cuidado ACCESS."))}<ol class="process-list"><li class="done">${icon("check")} ${L("Verifying Medicare coverage", "Verificando cobertura")}</li><li class="active">${icon("clock")} ${L("Checking for an existing ACCESS enrollment", "Buscando una inscripción ACCESS existente")}</li><li>${icon("clock")} ${L("Confirming the care track", "Confirmando el tipo de cuidado")}</li></ol>${security()}`;
}

function medicareIdentifier() {
  return `${titleBlock(L("Confirm your Medicare information", "Confirme su información de Medicare"), L("We couldn’t verify the Medicare number we have on file.", "No pudimos verificar el número de Medicare registrado."))}
    <form id="mbi-form"><label class="field"><span>${L("Medicare number", "Número de Medicare")}</span><input name="mbi" type="text" autocomplete="off" maxlength="11" placeholder="From your Medicare card" aria-describedby="mbi-note"></label><p id="mbi-note" class="security">${icon("lock")} ${L("For this demo, the full number is validated in memory and is never saved locally.", "En esta demostración, el número se valida en memoria y nunca se guarda localmente.")}</p></form>
    <button class="link-card" data-action="help">${icon("question")}<span><strong>${L("I don’t have my card", "No tengo mi tarjeta")}</strong><small>${L("Get help another way", "Obtenga ayuda de otra forma")}</small></span><b>›</b></button><p class="form-error" role="alert">${state.error}</p>${actions(t().continue)}`;
}

function eligibilityResult() {
  const outcome = state.accessOutcome;
  const results = {
    eligible: ["check", L("Medicare check complete", "Consulta con Medicare completa"), L("Your Medicare coverage appears eligible for this ACCESS care option. Enrollment is not complete yet.", "Su cobertura parece elegible para esta opción ACCESS. La inscripción aún no está completa."), L("Continue", "Continuar")],
    control: ["info", L("Medicare placed you in a comparison group", "Medicare le asignó a un grupo de comparación"), L("You will keep all Medicare benefits and may continue care with your usual doctors. ITERA cannot provide this ACCESS service during the configured comparison period.", "Conservará todos sus beneficios y puede continuar con sus médicos habituales. ITERA no puede brindar este servicio ACCESS durante el período configurado."), L("Finish", "Finalizar")],
    notEligible: ["info", L("This care option isn’t available right now", "Esta opción no está disponible ahora"), L("This does not change your Medicare benefits or regular care. Our team can discuss other support.", "Esto no cambia sus beneficios ni su cuidado habitual. Nuestro equipo puede explicarle otras opciones."), L("Request a call", "Solicitar llamada")],
    alreadyAligned: ["info", L("An existing ACCESS relationship was found", "Encontramos una relación ACCESS existente"), L("We need a care team member to review it before anything changes.", "Un miembro del equipo debe revisarla antes de realizar cambios."), L("Request review", "Solicitar revisión")],
    unavailable: ["clock", L("Medicare is temporarily unavailable", "Medicare no está disponible temporalmente"), L("We saved your progress. This does not mean you are ineligible. Please try again later or ask us to call you.", "Guardamos su progreso. Esto no significa que no sea elegible. Inténtelo después o solicite una llamada."), L("Try again", "Intentar de nuevo")]
  }[outcome] || ["info", "Review needed", "A care team member will review your information.", "Request a call"];
  return `${art(results[0], outcome === "eligible")}${titleBlock(results[1], results[2])}${outcome === "eligible" ? `<section class="next-card"><h2>${L("What happens next?", "¿Qué sigue?")}</h2>${rows([["document", L("Review important ACCESS information", "Revise información importante de ACCESS"), ""], ["person", L("Agree to receive care from ITERA HEALTH", "Acepte recibir cuidado de ITERA HEALTH"), ""], ["clock", L("Wait for final Medicare enrollment confirmation", "Espere la confirmación final de Medicare"), ""]])}</section>` : ""}${actions(results[3], false, outcome === "unavailable" ? L("Request a callback", "Solicitar llamada") : "")}`;
}

function onboarding() {
  return `${titleBlock(L("Set up your care", "Configure su cuidado"), L("Enrollment is complete. You can finish these steps now or later.", "La inscripción está completa. Puede terminar estos pasos ahora o después."), L("Care setup", "Configuración"))}
    <div class="link-list"><button class="link-card" data-action="next">${icon("shield")}<span><strong>${L("Confirm your health information", "Confirme su información médica")}</strong><small>${L("Review what we already have on file", "Revise lo que ya tenemos")}</small></span><b>›</b></button><button class="link-card">${icon("pill")}<span><strong>${L("Confirm your medications", "Confirme sus medicamentos")}</strong><small>${L("Tell us if anything changed", "Indique si algo cambió")}</small></span><b>›</b></button><button class="link-card">${icon("phone")}<span><strong>${L("Care preferences", "Preferencias de cuidado")}</strong><small>${L("Choose how we should contact you", "Elija cómo debemos contactarle")}</small></span><b>›</b></button><button class="link-card">${icon("goals")}<span><strong>${L("Your goals", "Sus objetivos")}</strong><small>${L("Tell us what matters most", "Díganos qué es importante")}</small></span><b>›</b></button></div>
    ${actions(L("Save and continue", "Guardar y continuar"), false, L("I’ll finish later", "Terminaré después"))}`;
}

function clinical() {
  return `${art("shield")}${titleBlock(L("Confirm your health information", "Confirme su información médica"), L("We already have this information on file.", "Ya tenemos esta información."), L("Care setup", "Configuración"))}
    <section class="known-data"><p>${icon("check")} ${L("High blood pressure", "Presión arterial alta")}</p><p>${icon("check")} ${L("High cholesterol", "Colesterol alto")}</p><p>${icon("calendar")} ${L("Last updated: August 18, 2026", "Actualizado: 18 de agosto de 2026")}</p></section>
    <form class="choice-list">${choice("correct", "check", L("Everything looks right", "Todo está correcto"), "", true)}${choice("changed", "document", L("Something has changed", "Algo cambió"), "")}${choice("help", "question", L("I need help reviewing this", "Necesito ayuda para revisarlo"), "")}</form>${actions(t().continue)}`;
}

function goals() {
  return `${art("goals")}${titleBlock(L("What matters most to you?", "¿Qué es lo más importante para usted?"), L("Choose one or more goals. You can change these later.", "Elija uno o más objetivos. Puede cambiarlos después."))}<form class="goal-list">${[L("Stay independent", "Mantener mi independencia"), L("Feel confident managing my health", "Sentirme seguro manejando mi salud"), L("Avoid unnecessary hospital visits", "Evitar visitas innecesarias al hospital"), L("Keep my medications organized", "Mantener mis medicamentos organizados"), L("Stay connected with my doctors", "Mantener contacto con mis médicos")].map((x, i) => check(`goal-${i}`, x, i < 2)).join("")}</form>${actions(t().continue)}`;
}

function accessBaseline() {
  return `${art("shield")}${titleBlock(L("Let’s complete your first health check", "Completemos su primera evaluación"), L("This helps your ACCESS care team understand your starting point.", "Esto ayuda al equipo ACCESS a conocer su punto de partida."), "ACCESS health check")}${rows([["chart", L("Your health measures", "Sus mediciones"), ""], ["question", L("Questions about your condition", "Preguntas sobre su condición"), ""], ["pill", L("Your medications", "Sus medicamentos"), ""], ["goals", L("Your health goals", "Sus objetivos de salud"), ""]])}<div class="meta-list"><span>${icon("clock")} ${L("Takes about 10–15 minutes", "Toma unos 10–15 minutos")}</span><span>${icon("shield")} ${L("You can save and finish later", "Puede guardar y terminar después")}</span></div>${actions(L("Start health check", "Iniciar evaluación"), false, L("I’ll do this later", "Lo haré después"))}`;
}

function accessMeasure() {
  return `${art("device")}${titleBlock(L("Your blood pressure starting point", "Su punto de partida de presión arterial"), L("This measure is part of your ACCESS care for high blood pressure.", "Esta medición es parte de su cuidado ACCESS para presión alta."), "eCKM health check")}
    <form class="choice-list">${choice("recent", "heart", L("I have a recent reading", "Tengo una lectura reciente"), L("Enter the date and blood pressure", "Ingrese la fecha y presión"))}${choice("help", "question", L("I have a monitor but need help", "Tengo monitor pero necesito ayuda"), L("We can guide you", "Podemos guiarle"))}${choice("ship", "device", L("I need a monitor from ITERA", "Necesito un monitor de ITERA"), L("We’ll help arrange one", "Le ayudaremos a obtener uno"))}</form>${actions(t().continue)}`;
}

function rpmDevice() {
  return `${art("device")}${titleBlock(L("Let’s prepare your home monitor", "Preparemos su monitor en casa"), L("Your care team recommended a connected blood pressure monitor.", "Su equipo recomendó un monitor conectado de presión arterial."))}<form class="choice-list">${choice("owned", "heart", L("I already have a monitor", "Ya tengo un monitor"), L("We’ll check whether it can securely send readings", "Verificaremos si puede enviar lecturas"), state.devicePath === "owned")}${choice("ship", "box", L("I need a monitor from ITERA", "Necesito un monitor de ITERA"), L("We’ll arrange one for you", "Le enviaremos uno"), state.devicePath === "ship")}${choice("help", "question", L("I’m not sure", "No estoy seguro"), L("Talk with our care team", "Hable con nuestro equipo"))}</form>${actions(t().continue)}`;
}

function shipping() {
  return `${art("box")}${titleBlock(L("Where should we send your monitor?", "¿Dónde debemos enviar su monitor?"), L("We have this address on file:", "Tenemos esta dirección:"))}<address class="address-card">${icon("home")}<strong>1250 Palm Avenue<br>Apartment 4B<br>Miami, FL 33130</strong></address><form class="choice-list">${choice("correct", "check", L("This address is correct", "Esta dirección es correcta"), "", true)}${choice("changed", "document", L("Use a different address", "Usar otra dirección"), "")}</form>${actions(t().continue)}<p class="security">${icon("lock")} ${L("Shipping is included", "El envío está incluido")}</p>`;
}

function deviceSetup() {
  return `${art("device")}${titleBlock(L("Set up your monitor", "Configure su monitor"), L("We’ll help you connect it and take accurate readings.", "Le ayudaremos a conectarlo y tomar lecturas precisas."), L("Home monitoring setup", "Configuración del monitoreo"))}<ol class="instruction-list"><li><b>1</b><span>${L("Sit and rest for 5 minutes", "Siéntese y descanse 5 minutos")}</span></li><li><b>2</b><span>${L("Place the cuff on your bare upper arm", "Coloque el brazalete sobre el brazo descubierto")}</span></li><li><b>3</b><span>${L("Keep your feet flat and arm supported", "Mantenga los pies apoyados y el brazo sostenido")}</span></li><li><b>4</b><span>${L("Press Start and stay still", "Presione inicio y no se mueva")}</span></li></ol>${cta(L("My monitor is connected", "Mi monitor está conectado"))}<button class="button secondary" data-action="help">${L("I need help", "Necesito ayuda")}</button>`;
}

function firstReading() {
  const failed = state.error === "reading";
  return `${art("wifi")}${titleBlock(L("Send your first connected reading", "Envíe su primera lectura conectada"), L("Take a blood pressure reading with your connected monitor.", "Tome una lectura con su monitor conectado."))}${failed ? `<aside class="error-card" role="alert">${icon("info")}<span><strong>${L("We haven’t received a reading", "No hemos recibido una lectura")}</strong><small>${L("Check that the monitor is on and nearby, then try again.", "Compruebe que el monitor esté encendido y cerca, e inténtelo de nuevo.")}</small></span></aside>` : `<div class="waiting"><span class="pulse-ring"></span><strong>${L("Waiting for your monitor…", "Esperando su monitor…")}</strong><small>${L("Keep this page open while the reading sends securely.", "Mantenga esta página abierta mientras se envía la lectura.")}</small></div>`}${actions(failed ? L("Try again", "Intentar de nuevo") : L("I took my reading", "Tomé mi lectura"), false, L("Troubleshoot my monitor", "Solucionar problema"))}`;
}

function monitoringReady() {
  return `${art("check", true)}${titleBlock(L("Home monitoring is ready", "El monitoreo en casa está listo"), L("We securely received your first connected reading.", "Recibimos de forma segura su primera lectura conectada."))}<section class="reading-card"><small>${L("Your first reading", "Su primera lectura")}</small><strong>${state.reading?.systolic || 120} / ${state.reading?.diastolic || 80} <em>mmHg</em></strong></section><section class="next-card"><h2>${L("What happens next?", "¿Qué sigue?")}</h2>${rows([["calendar", L("Take readings as directed by your care team", "Tome lecturas según le indiquen"), ""], ["chart", L("ITERA reviews your transmitted readings", "ITERA revisa sus lecturas transmitidas"), ""], ["shield", L("This service is not for emergencies", "Este servicio no es para emergencias"), ""]])}</section>${cta(L("Go to my dashboard", "Ir a mi panel"), "finish")}<button class="text-button" data-action="help">${L("Talk with my care team", "Hablar con mi equipo")}</button>`;
}

function onboardingComplete() {
  return `${art("check", true)}${titleBlock(L("You’re off to a great start", "Ha comenzado muy bien"), L("We saved your information and will use it to personalize your care.", "Guardamos su información y la usaremos para personalizar su cuidado."))}<section class="next-card"><h2>${L("What happens next?", "¿Qué sigue?")}</h2>${rows([["people", L("Your ITERA care team reviews your information", "Su equipo ITERA revisa su información"), ""], ["phone", L("We contact you with any follow-up questions", "Le contactaremos si hay preguntas"), ""], ["doctor", L("You continue working with Dr. Fresner", "Continuará trabajando con el Dr. Fresner"), ""]])}</section>${cta(L("Go to my dashboard", "Ir a mi panel"), "finish")}<button class="text-button" data-action="help">${L("Talk with my care team", "Hablar con mi equipo")}</button>`;
}

function callbackConfirmed() { return `${art("phone", true)}${titleBlock(L("We’ll call you", "Le llamaremos"), L(`A care team member will call the number ending in ${state.offer.patient.phoneMasked.slice(-4)} within one business day.`, `Un miembro del equipo llamará al número terminado en ${state.offer.patient.phoneMasked.slice(-4)} dentro de un día hábil.`))}${cta(L("Return to enrollment", "Volver a la inscripción"), "return")}`; }

function stoppedOutcome() { return `${art("info")}${titleBlock(L("Your Medicare check is complete", "Su consulta con Medicare está completa"), L("Your ACCESS journey stops here, but your Medicare benefits and regular care do not change.", "Su recorrido ACCESS termina aquí, pero sus beneficios y cuidado habitual no cambian."))}${cta(L("Done", "Listo"), "finish")}<button class="text-button" data-action="help">${L("Talk with our care team", "Hablar con nuestro equipo")}</button>`; }

function offerError() { const expired = state.screen === "OFFER_EXPIRED"; return `${art(expired ? "clock" : "lock")}${titleBlock(expired ? L("This secure link has expired", "Este enlace seguro venció") : L("We can’t open this secure link", "No podemos abrir este enlace seguro"), expired ? L("For your privacy, invitation links are available for a limited time.", "Por su privacidad, los enlaces están disponibles por tiempo limitado.") : L("The link may be incomplete or already used.", "El enlace puede estar incompleto o ya haberse usado."))}<a class="button primary" href="tel:+13053948070">${L("Call ITERA HEALTH", "Llamar a ITERA HEALTH")}</a><p class="contact-line">(305) 394-8070</p>`; }

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

function prototypeSetup() {
  const languageLabel = PROTOTYPE_OPTIONS.languages.find(item => item.value === prototypeConfig.language)?.label || "English";
  const conditionSummary = prototypeConfig.conditions.length === 1 ? prototypeConfig.conditions[0] : `${prototypeConfig.conditions.length} conditions`;
  const summary = [prototypeConfig.program, prototypeConfig.program === "ACCESS" ? prototypeConfig.accessTrack : null, prototypeConfig.source, prototypeConfig.source === "Physician Referral" ? prototypeConfig.physician : null, conditionSummary, prototypeConfig.coverage, languageLabel].filter(Boolean).join(" · ");
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
        <label class="prototype-field"><span><b>Enrollment source</b><small>Required</small></span><select name="source">${optionTags(PROTOTYPE_OPTIONS.sources, prototypeConfig.source)}</select></label>
        <div class="prototype-field condition-field"><span><b>Condition</b><small>Required</small></span>
          <details class="condition-multiselect" ${conditionMenuOpen ? "open" : ""}>
            <summary aria-label="Condition" title="${escapeHtml(prototypeConfig.conditions.join(", "))}"><span class="condition-value">${conditionValue()}</span><span class="condition-chevron">⌄</span></summary>
            <div class="condition-options" role="group" aria-label="Clinical conditions">${PROTOTYPE_OPTIONS.conditions.map(condition => `<label class="condition-option"><input type="checkbox" name="conditions" value="${condition}" ${prototypeConfig.conditions.includes(condition) ? "checked" : ""}><span class="condition-checkbox">${icon("check")}</span><span>${condition}</span></label>`).join("")}</div>
          </details>
          ${prototypeConfig.conditions.includes("Other") ? `<label class="other-condition"><span>Specify condition</span><input type="text" name="otherCondition" value="${escapeHtml(prototypeConfig.otherCondition)}" placeholder="Enter condition"></label>` : ""}
        </div>
        <label class="prototype-field"><span><b>Coverage</b><small>Required</small></span><select name="coverage">${optionTags(PROTOTYPE_OPTIONS.coverage, prototypeConfig.coverage)}</select></label>
        <label class="prototype-field"><span><b>Language</b><small>Required</small></span><select name="language">${optionTags(PROTOTYPE_OPTIONS.languages, prototypeConfig.language)}</select></label>
        ${prototypeConfig.program === "ACCESS" ? `<label class="prototype-field conditional"><span><b>ACCESS track</b><small>Shown for ACCESS</small></span><select name="accessTrack">${optionTags(PROTOTYPE_OPTIONS.accessTracks, prototypeConfig.accessTrack)}</select></label>` : ""}
        ${prototypeConfig.source === "Physician Referral" ? `<label class="prototype-field conditional"><span><b>Physician</b><small>Shown for referrals</small></span><select name="physician">${optionTags(PROTOTYPE_OPTIONS.physicians, prototypeConfig.physician)}</select></label>` : ""}
      </div>
      <p class="prototype-error" id="prototype-error" role="alert"></p>
    </form>
    <section class="scenario-footer">
      <div class="scenario-summary" aria-live="polite"><span>Patient scenario</span><strong>${summary}</strong></div>
      <button class="launch-button" type="button" data-action="launch-prototype">Launch Patient Experience ${icon("arrowRight", "button-icon")}</button>
    </section>
  </main>`;
}

const renderers = { INVITATION: invitation, DECISION_MAKER: decisionMaker, IDENTITY_VERIFICATION: identity, CARE_RECOMMENDATION: recommendation, HOW_CARE_WORKS: howCareWorks, HELP_REQUESTED: helpScreen, DISCLOSURE: disclosure, CONSENT_REVIEW: consent, ENROLLMENT_PROCESSING: () => processing(), ACCESS_ALIGNMENT_PROCESSING: () => processing("alignment"), ENROLLMENT_CONFIRMED: success, ACCESS_PRE_ELIGIBILITY_NOTICE: accessNotice, ACCESS_MEDICARE_IDENTIFIER: medicareIdentifier, ACCESS_ELIGIBILITY_PROCESSING: eligibilityProcessing, ACCESS_ELIGIBILITY_RESULT: eligibilityResult, ONBOARDING: onboarding, CLINICAL_VERIFICATION: clinical, GOALS: goals, ACCESS_BASELINE: accessBaseline, ACCESS_MEASURE: accessMeasure, RPM_DEVICE_PATH: rpmDevice, RPM_ADDRESS_CONFIRMATION: shipping, RPM_DEVICE_SETUP: deviceSetup, RPM_FIRST_READING: firstReading, RPM_MONITORING_READY: monitoringReady, ONBOARDING_COMPLETE: onboardingComplete, CALLBACK_CONFIRMED: callbackConfirmed, OUTCOME_STOPPED: stoppedOutcome, OFFER_INVALID: offerError, OFFER_EXPIRED: offerError };

function devPanel() {
  if (import.meta.env.PROD) return "";
  return `<aside class="dev-panel ${state.devOpen ? "open" : ""}"><button class="dev-toggle" data-action="dev">Demo</button><div><label>Scenario<select id="scenario-select">${Object.entries(SCENARIOS).map(([id, x]) => `<option value="${id}" ${id === state.scenarioId ? "selected" : ""}>${x.label}</option>`).join("")}</select></label><label>Jump to<select id="screen-select">${journeyFor(state).map(x => `<option value="${x}" ${x === state.screen ? "selected" : ""}>${x}</option>`).join("")}</select></label><button class="small-action" data-action="clear">Clear saved demo</button></div></aside>`;
}

function render() {
  if (state.screen === "PROTOTYPE_SETUP") { app.innerHTML = prototypeSetup(); bindPrototypeSetup(); return; }
  if (state.screen === "OFFER_LOADING") { app.innerHTML = `<main class="shell loading-screen" aria-live="polite">${art("shield")}<h1>${L("Opening your secure invitation…", "Abriendo su invitación segura…")}</h1></main>`; return; }
  if (["OFFER_INVALID", "OFFER_EXPIRED"].includes(state.screen)) { app.innerHTML = `<main class="shell"><section class="screen centered-error">${offerError()}</section></main>`; return; }
  const renderer = renderers[state.screen] || (() => `${titleBlock("We need a moment", "Please call our care team for help.")}`);
  app.innerHTML = `<main class="shell">${header()}<section class="screen" id="screen-content">${renderer()}</section>${emmiAssistant()}<div class="save-status" role="status" aria-live="polite"></div></main>${devPanel()}`;
  bind();
  requestAnimationFrame(() => document.querySelector("h1")?.focus({ preventScroll: true }));
  window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function bindPrototypeSetup() {
  const form = document.querySelector("#prototype-form");
  document.querySelector(".condition-multiselect")?.addEventListener("toggle", event => { conditionMenuOpen = event.target.open; });
  form?.addEventListener("input", event => {
    if (event.target.name === "otherCondition") prototypeConfig.otherCondition = event.target.value;
  });
  form?.addEventListener("change", event => {
    if (event.target.name === "otherCondition") { prototypeConfig.otherCondition = event.target.value; return; }
    const data = Object.fromEntries(new FormData(form));
    const conditions = new FormData(form).getAll("conditions");
    conditionMenuOpen = event.target.name === "conditions";
    prototypeConfig = {
      ...prototypeConfig,
      program: data.program || prototypeConfig.program,
      source: data.source || prototypeConfig.source,
      conditions,
      otherCondition: data.otherCondition ?? prototypeConfig.otherCondition,
      coverage: data.coverage || prototypeConfig.coverage,
      language: data.language || prototypeConfig.language,
      accessTrack: data.accessTrack || prototypeConfig.accessTrack,
      physician: data.physician || prototypeConfig.physician
    };
    render();
  });
  document.querySelector('[data-action="launch-prototype"]')?.addEventListener("click", launchPrototype);
}

async function launchPrototype() {
  if (!prototypeConfig.conditions.length) { document.querySelector("#prototype-error").textContent = "Select at least one condition."; return; }
  const required = [prototypeConfig.program, prototypeConfig.source, prototypeConfig.coverage, prototypeConfig.language];
  if (prototypeConfig.program === "ACCESS") required.push(prototypeConfig.accessTrack);
  if (prototypeConfig.source === "Physician Referral") required.push(prototypeConfig.physician);
  if (required.some(value => !value)) { document.querySelector("#prototype-error").textContent = "Complete all required fields before launching the patient experience."; return; }
  localStorage.setItem("itera.prototype.config.v1", JSON.stringify(prototypeConfig));
  service = new MockEnrollmentService("prototype", prototypeConfig);
  state = { ...state, scenarioId: "prototype", screen: "OFFER_LOADING", offer: null, language: prototypeConfig.language, identityVerified: false, devicePath: null, audit: [], error: "" };
  document.documentElement.lang = state.language;
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
  if (state.screen === "ACCESS_ELIGIBILITY_RESULT" && state.accessOutcome !== "eligible") {
    if (state.accessOutcome === "unavailable") { state.screen = "ACCESS_ELIGIBILITY_PROCESSING"; render(); runEligibility(); return; }
    if (["notEligible", "alreadyAligned"].includes(state.accessOutcome)) { state.returnScreen = state.screen; state.screen = "CALLBACK_CONFIRMED"; state.callbackRequested = true; render(); return; }
    state.screen = "OUTCOME_STOPPED"; render(); return;
  }
  if (state.screen === "DECISION_MAKER") {
    state.role = new FormData(document.querySelector("#choice-form")).get("choice") || state.role;
  }
  if (state.screen === "IDENTITY_VERIFICATION") {
    const form = document.querySelector("#identity-form"), data = Object.fromEntries(new FormData(form));
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data.dob || "") || !/^\d{5}$/.test(data.zip || "") || (state.role === "representative" && !data.authority)) { state.error = L("Enter a date as MM/DD/YYYY, a 5-digit ZIP code, and complete all confirmations.", "Ingrese fecha MM/DD/AAAA, código postal de 5 dígitos y complete las confirmaciones."); render(); return; }
    state.busy = true; render(); const result = await service.verifyIdentity(data); state.busy = false;
    if (!result.verified) { state.identityAttempts += 1; state.error = L(`We couldn’t match that information. ${result.remainingAttempts} attempts remain.`, `No pudimos verificar la información. Quedan ${result.remainingAttempts} intentos.`); render(); return; }
    state.identityVerified = true; audit(state, "identity_verified");
  }
  if (state.screen === "ACCESS_PRE_ELIGIBILITY_NOTICE" && !document.querySelector('[name="accessNotice"]')?.checked) { state.error = L("Please confirm you reviewed this information.", "Confirme que revisó esta información."); render(); return; }
  if (state.screen === "ACCESS_MEDICARE_IDENTIFIER") { const mbi = document.querySelector('[name="mbi"]')?.value.replace(/\s/g, ""); if (!/^[A-Za-z0-9]{11}$/.test(mbi || "")) { state.error = L("Enter the 11-character number from your Medicare card.", "Ingrese los 11 caracteres de su tarjeta de Medicare."); render(); return; } audit(state, "medicare_identifier_verified"); }
  if (state.screen === "DISCLOSURE") {
    if (!document.querySelector('[name="acknowledge"]')?.checked) { state.error = L("Please confirm you reviewed this information.", "Confirme que revisó esta información."); render(); return; }
    await service.saveAcknowledgement(); audit(state, "disclosure_acknowledged");
  }
  if (state.screen === "CONSENT_REVIEW") {
    const f = document.querySelector("#consent-form"); if (!f.consent.checked || !f.enroll.checked) { state.error = L("Please check both boxes to enroll.", "Marque ambas casillas para inscribirse."); render(); return; }
    state.busy = true; render(); await service.saveConsent(); state.busy = false; state.consentSaved = true; audit(state, "consent_saved");
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

async function runEligibility() { const result = await service.checkAccessEligibility(); state.accessOutcome = result.outcome; state.accessEligible = result.outcome === "eligible"; audit(state, "access_eligibility", result.outcome); state.screen = "ACCESS_ELIGIBILITY_RESULT"; draftStore.save(state); render(); }
async function runEnrollment() { const result = await service.createTraditionalEnrollment(); if (result.status === "confirmed") { state.enrollmentConfirmed = true; audit(state, "enrollment", "confirmed"); state.screen = "ENROLLMENT_CONFIRMED"; draftStore.save(state); render(); } }
async function runAlignment() { const result = await service.submitAccessAlignment(); if (result.status === "confirmed") { state.alignmentConfirmed = true; state.enrollmentConfirmed = true; audit(state, "alignment", "confirmed"); state.screen = "ENROLLMENT_CONFIRMED"; draftStore.save(state); render(); } }
function showHelp() { state.returnScreen = state.screen; state.screen = "HELP_REQUESTED"; render(); }

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
    if (action === "next") await advance();
    if (action === "back") { state.screen = state.screen === "HELP_REQUESTED" ? state.returnScreen || "HOW_CARE_WORKS" : previousScreen(state); render(); }
    if (action === "help") showHelp();
    if (action === "callback") { state.callbackRequested = true; state.returnScreen = state.screen; state.screen = "CALLBACK_CONFIRMED"; audit(state, "callback_requested"); render(); }
    if (action === "return") { state.screen = state.returnScreen || "INVITATION"; render(); }
    if (action === "language") { state.language = state.language === "en" ? "es" : state.language === "es" ? "ht" : "en"; document.documentElement.lang = state.language; render(); }
    if (action === "restart") { state.screen = "INVITATION"; render(); }
    if (action === "secondary") { if (["ONBOARDING", "ACCESS_BASELINE"].includes(state.screen)) { draftStore.save(state); document.querySelector(".save-status").textContent = t().saved; } else showHelp(); }
    if (action === "finish") { draftStore.clear(); el.textContent = L("Done", "Listo"); el.disabled = true; }
    if (action === "dev") { state.devOpen = !state.devOpen; render(); }
    if (action === "clear") { draftStore.clear(); location.reload(); }
  }));
  document.querySelector("#scenario-select")?.addEventListener("change", e => { location.search = `?scenario=${encodeURIComponent(e.target.value)}`; });
  document.querySelector("#screen-select")?.addEventListener("change", e => { state.screen = e.target.value; state.identityVerified = true; if (state.screen === "ACCESS_ELIGIBILITY_RESULT") state.accessOutcome = state.offer.fixture.accessOutcome || "eligible"; render(); });
  const dobInput = document.querySelector(".date-text");
  const datePicker = document.querySelector(".date-picker-native");
  dobInput?.addEventListener("input", event => {
    event.target.value = typedDate(event.target.value);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(event.target.value) && datePicker) {
      const [month, day, year] = event.target.value.split("/");
      datePicker.value = `${year}-${month}-${day}`;
    }
  });
  datePicker?.addEventListener("change", event => {
    if (dobInput && event.target.value) dobInput.value = displayDate(event.target.value);
  });
  bindEmmiDrag();
}

async function boot() {
  try {
    state.offer = await service.getOffer();
    const saved = draftStore.load();
    if (saved?.scenarioId === scenarioId && saved.identityVerified) state = { ...state, ...saved, offer: state.offer, audit: [] };
    else { state.screen = "INVITATION"; if (state.offer.fixture.representative) state.role = "representative"; }
    document.documentElement.lang = state.language; render();
  } catch (error) { state.screen = error.message === "expired" ? "OFFER_EXPIRED" : "OFFER_INVALID"; render(); }
}

render();
if (params.has("scenario")) boot();
