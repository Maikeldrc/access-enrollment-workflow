// Appointment coordination — patient-facing views (Phase 3, Agent 3).
//
// Pure functions returning HTML strings. No imports, no DOM access, no module-level mutable
// state. Every export takes ONE props object which always carries { locale, icon, escapeHtml }:
// `icon` is app.js's `icon(name, extra)`, `escapeHtml` is app.js's escaper. Both have safe
// internal fallbacks so a missing prop can never leak an unescaped value into the document.
//
// Locale is lowercase "en" | "es" | "ht". "ht" is Haitian Creole (Kreyòl).
//
// Dates are formatted from local month/weekday tables rather than Intl display names, because
// Kreyòl display names are not reliably present in every runtime. Wall-clock extraction still
// uses Intl when the record carries a `timezone`, falling back to local time.
//
// -----------------------------------------------------------------------------------------
// DATA-ACTION CONTRACT — the lead builds delegated handlers from this list. Every button and
// link this module emits carries exactly one of these `data-action` values.
//
//   appointment-ask-emmi                data-appointment-id?   Open EMMI about appointments.
//   appointment-open                    data-appointment-id    Open the appointment/request detail.
//   appointment-open-list               —                      Open the appointments list screen.
//   appointment-list-tab                data-tab="UPCOMING|PAST|REQUESTS"
//   appointment-back                    —                      Leave the screen (route to the
//                                                              existing "back-to-my-care").
//   appointment-select-slot             data-appointment-id, data-slot-id
//   appointment-more-times              data-appointment-id    "See more times" (§32).
//   appointment-change-preferences      data-appointment-id    "Choose another day" (§32).
//   appointment-preference-answer       data-need-id, data-field, data-value
//                                       field ∈ requestedProfessionalId | reasonCategory |
//                                               preferredModality | preferredTimeOfDay
//   appointment-preference-other-time   data-need-id           "Choose another time" (§29).
//   appointment-preference-back         data-need-id, data-step
//   appointment-submit-request          data-need-id           Submit the draft (§80/§127).
//   appointment-get-directions          data-appointment-id    Only when locationAddress exists (§59).
//   appointment-join-visit              data-appointment-id    Anchor; only when a https joinUrl exists (§58).
//   appointment-request-reschedule      data-appointment-id
//   appointment-request-cancel          data-appointment-id
//   appointment-open-reminder           data-appointment-id    In-app reminder only (§48-50).
//   appointment-open-prep               data-appointment-id
//   appointment-add-prep-topic          data-appointment-id    Submits form #appointment-prep-form,
//                                                              input name="prepTopic".
//   appointment-remove-prep-topic       data-appointment-id, data-topic-index
//   appointment-remove-prep-medication  data-appointment-id, data-medication-id
//   appointment-open-brief              data-appointment-id
//   appointment-share-brief             data-appointment-id    Share the brief with the provider (§47).
//   appointment-open-share              data-appointment-id    Open Care Circle sharing (§114).
//   appointment-share-with-member       data-appointment-id, data-invite-id
//   appointment-barrier-answer          data-appointment-id, data-barrier-reason
//                                       reason keys come from src/appointmentSupport.js's
//                                       APPOINTMENT_BARRIER_REASONS. The built-in fallback list
//                                       emits ALL_SET | TRANSPORTATION | CAREGIVER_AVAILABILITY |
//                                       TIME_CONFLICT | LOCATION_UNCLEAR | TECHNOLOGY_TELEHEALTH |
//                                       OTHER; pass `preVisitCheck` to override it.
//   appointment-followup-attendance     data-appointment-id, data-outcome="ATTENDED|MISSED|RESCHEDULED"
//   appointment-followup-need           data-appointment-id, data-need="NEXT_STEPS|MEDICATION|
//                                                FOLLOW_UP|GOAL|NOTHING"
//   appointment-followup-reschedule     data-appointment-id, data-answer="YES|NOT_NOW"
//
// Never emitted, deliberately: any "add to calendar" control. §60 guards it with "when
// technically supported" and no ICS support exists.
//
// OPTIONAL PROPS — each view works without these, and each one lets a domain module override a
// local fallback. The domain module always wins.
//
//   patientStatus / nextStep / tone   src/appointments.js's appointmentPatientStatus,
//                                     appointmentNextStep, appointmentStatusTone.
//   capability                        a resolveSchedulingCapability() result, or its bare
//                                     capability string. Its supportedModalities drives §30.
//   supportedModalities               an array. The APPOINTMENT_MODALITY enum object is NOT a
//                                     capability and is deliberately ignored.
//   error       (slotPickerView)      a booking/availability error code, rendered as plain
//                                     language. An unrecognised code never reaches the screen.
//   expanded    (slotPickerView)      true after "See more times".
//   preVisitCheck (barrier check)     preVisitCheckOptions() → { question, options }.
//   sharing / scope (share view)      careCircleSharingOptions() and appointmentShareScope().
//   step        (follow-up)           "ATTENDANCE" (default) | "ATTENDED" | "MISSED".
//   limit       (upcoming care)       how many cards My Care shows before "See all". Default 2.
// -----------------------------------------------------------------------------------------

const T = (en, es, ht) => Object.freeze({ en, es, ht });
export const localAppointmentViewText = (value, locale = "en") =>
  (typeof value === "string" ? value : value?.[locale] || value?.en || "");

// The ordered preference steps. §26: exactly one question per step.
export const APPOINTMENT_PREFERENCE_STEPS = Object.freeze(["PROVIDER", "REASON", "MODALITY", "TIME_OF_DAY", "REVIEW"]);

// Every data-action this module can emit, for the lead's handler switch.
export const APPOINTMENT_VIEW_ACTIONS = Object.freeze([
  "appointment-ask-emmi", "appointment-open", "appointment-open-list", "appointment-list-tab",
  "appointment-back", "appointment-select-slot", "appointment-more-times",
  "appointment-change-preferences", "appointment-preference-answer",
  "appointment-preference-other-time", "appointment-preference-back", "appointment-submit-request",
  "appointment-get-directions", "appointment-join-visit", "appointment-request-reschedule",
  "appointment-request-cancel", "appointment-open-reminder", "appointment-open-prep",
  "appointment-add-prep-topic", "appointment-remove-prep-topic", "appointment-remove-prep-medication", "appointment-open-brief",
  "appointment-share-brief", "appointment-open-share",
  "appointment-open-barrier", "appointment-share-with-member",
  "appointment-barrier-answer", "appointment-followup-attendance", "appointment-followup-need",
  "appointment-followup-reschedule"
]);

/* ------------------------------------------------------------------ props plumbing ------ */

// app.js's escaper does not escape "'", so every attribute in this file is double-quoted.
const FALLBACK_ESCAPE = value => String(value ?? "").replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const escaper = props => (typeof props?.escapeHtml === "function" ? props.escapeHtml : FALLBACK_ESCAPE);
const iconOf = props => (typeof props?.icon === "function" ? props.icon : () => "");
const localeOf = props => (props?.locale === "es" || props?.locale === "ht" ? props.locale : "en");
// One question, three languages. Mirrors app.js's L() without reaching into app.js's state.
const say = locale => (en, es, ht) => localAppointmentViewText(T(en, es, ht), locale);

// Opening appointment preparation is a navigation event, not a clinical question the patient
// typed. Give EMMI a grounded opening from the appointment record so an unrelated earlier topic
// can never be replayed as the answer to the Prepare with EMMI button.
export function appointmentPrepConversationOpening({ locale = "en", appointment = {} } = {}) {
  const language = locale === "es" || locale === "ht" ? locale : "en";
  const provider = String(appointment.providerDisplayName || "").trim();
  const topics = Array.isArray(appointment.prep?.topics)
    ? appointment.prep.topics.map(topic => String(topic || "").trim()).filter(Boolean)
    : [];
  const providerText = provider
    ? localAppointmentViewText(T(` with ${provider}`, ` con ${provider}`, ` ak ${provider}`), language)
    : "";
  if (!topics.length) return localAppointmentViewText(T(
    `Let’s prepare for your appointment${providerText}. What would you like help getting ready to discuss?`,
    `Preparémonos para su cita${providerText}. ¿Sobre qué le gustaría prepararse para conversar?`,
    `Ann prepare pou randevou ou${providerText}. Sou kisa ou ta renmen prepare pou pale?`
  ), language);
  if (topics.length === 1) return localAppointmentViewText(T(
    `Let’s prepare for your appointment${providerText}. You wanted to discuss “${topics[0]}”, so we’ll start there.`,
    `Preparémonos para su cita${providerText}. Quería conversar sobre “${topics[0]}”, así que empezaremos por ese tema.`,
    `Ann prepare pou randevou ou${providerText}. Ou te vle pale sou “${topics[0]}”, kidonk n ap kòmanse ak sijè sa a.`
  ), language);
  const topicList = topics.map(topic => `“${topic}”`).join(", ");
  return localAppointmentViewText(T(
    `Let’s prepare for your appointment${providerText}. You wanted to discuss ${topicList}. Which topic would you like to start with?`,
    `Preparémonos para su cita${providerText}. Quería conversar sobre ${topicList}. ¿Con cuál tema le gustaría empezar?`,
    `Ann prepare pou randevou ou${providerText}. Ou te vle pale sou ${topicList}. Ak ki sijè ou ta renmen kòmanse?`
  ), language);
}

/* ---------------------------------------------------------------------- date + time ------ */

const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  ht: ["janvye", "fevriye", "mas", "avril", "me", "jen", "jiyè", "out", "septanm", "oktòb", "novanm", "desanm"]
};
const MONTHS_SHORT = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  ht: ["jan", "fev", "mas", "avr", "me", "jen", "jiy", "out", "sep", "okt", "nov", "des"]
};
const WEEKDAYS = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  es: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
  ht: ["dimanch", "lendi", "madi", "mèkredi", "jedi", "vandredi", "samdi"]
};
const WEEKDAYS_SHORT = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  es: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
  ht: ["dim", "len", "mad", "mèk", "jed", "van", "sam"]
};

const toDate = value => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Wall-clock parts in the appointment's own timezone. A record without a timezone, or a runtime
// without that zone, falls back to local time rather than dropping the date entirely.
const wallClock = (value, timezone) => {
  const date = toDate(value);
  if (!date) return null;
  if (timezone) {
    try {
      const bag = {};
      for (const part of new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", hour12: false }).formatToParts(date)) {
        if (part.type !== "literal") bag[part.type] = part.value;
      }
      const year = Number(bag.year);
      const month = Number(bag.month) - 1;
      const day = Number(bag.day);
      if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
        return { year, month, day, hour: Number(bag.hour) % 24, minute: Number(bag.minute), weekday: new Date(Date.UTC(year, month, day)).getUTCDay() };
      }
    } catch { /* An unknown zone falls through to local time rather than losing the appointment. */ }
  }
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate(), hour: date.getHours(), minute: date.getMinutes(), weekday: date.getDay() };
};

const formatTime = (parts, locale) => {
  if (!parts) return "";
  const suffix = parts.hour >= 12 ? { en: "PM", es: "p. m.", ht: "PM" }[locale] : { en: "AM", es: "a. m.", ht: "AM" }[locale];
  const hour = parts.hour % 12 === 0 ? 12 : parts.hour % 12;
  return `${hour}:${String(parts.minute).padStart(2, "0")} ${suffix}`;
};
const formatLongDate = (parts, locale) => {
  if (!parts) return "";
  const weekday = WEEKDAYS[locale][parts.weekday];
  const month = MONTHS[locale][parts.month];
  if (locale === "es") return `${weekday}, ${parts.day} de ${month}`;
  if (locale === "ht") return `${weekday}, ${parts.day} ${month}`;
  return `${weekday}, ${month} ${parts.day}`;
};
const formatShortDate = (parts, locale) => {
  if (!parts) return "";
  const weekday = WEEKDAYS_SHORT[locale][parts.weekday];
  const month = MONTHS_SHORT[locale][parts.month];
  return locale === "en" ? `${weekday}, ${month} ${parts.day}` : `${weekday}, ${parts.day} ${month}`;
};
// "Tue, Sep 8 · 10:30 AM" — the §38 card line.
const formatWhen = (value, timezone, locale) => {
  const parts = wallClock(value, timezone);
  if (!parts) return "";
  return `${formatShortDate(parts, locale)} · ${formatTime(parts, locale)}`;
};

const dayNumber = parts => (parts ? parts.year * 10000 + parts.month * 100 + parts.day : null);
// "today" / "tomorrow" / the date itself. Compared in the appointment's own zone.
const relativeDay = (value, timezone, now, locale) => {
  const t = say(locale);
  const target = dayNumber(wallClock(value, timezone));
  const today = dayNumber(wallClock(now || new Date(), timezone));
  if (target === null || today === null) return "";
  if (target === today) return t("today", "hoy", "jodi a");
  const tomorrow = wallClock(new Date((toDate(now) || new Date()).getTime() + 86400000), timezone);
  if (target === dayNumber(tomorrow)) return t("tomorrow", "mañana", "demen");
  return formatLongDate(wallClock(value, timezone), locale);
};

/* ------------------------------------------------------------- status, tone, vocabulary -- */

const CLOSED_STATUSES = ["CANCELED", "COMPLETED", "NO_SHOW", "DECLINED", "UNABLE_TO_SCHEDULE"];
const REQUEST_STATUSES = ["NEED_IDENTIFIED", "DRAFT", "COLLECTING_PREFERENCES", "SEARCHING_AVAILABILITY", "SLOTS_AVAILABLE", "PENDING_PATIENT_SELECTION", "BOOKING", "REQUEST_SENT", "WAITING_FOR_OFFICE", "PROPOSED_TIME"];

// §7/§18/§35: only a CONFIRMED record with a real time may be rendered as an appointment.
// Everything else is a request, and requests never borrow confirmed formatting.
const isConfirmedAppointment = appointment => appointment?.status === "CONFIRMED" && Boolean(toDate(appointment?.scheduledAt));
const isClosed = appointment => CLOSED_STATUSES.includes(appointment?.status);
const isOpenRequest = appointment => REQUEST_STATUSES.includes(appointment?.status);

// Mirrors src/appointments.js's STATUS_TONE exactly, so the fallback and the domain module's
// appointmentStatusTone() can never disagree on screen. The domain module stays the authority:
// whenever the lead passes `tone`, that wins.
const TONE_BY_STATUS = {
  CONFIRMED: "CONFIRMED",
  SEARCHING_AVAILABILITY: "WAITING", BOOKING: "WAITING", REQUEST_SENT: "WAITING",
  WAITING_FOR_OFFICE: "WAITING", RESCHEDULE_REQUESTED: "WAITING", CANCEL_REQUESTED: "WAITING",
  NEED_IDENTIFIED: "ACTION_NEEDED", DRAFT: "ACTION_NEEDED", COLLECTING_PREFERENCES: "ACTION_NEEDED",
  SLOTS_AVAILABLE: "ACTION_NEEDED", PENDING_PATIENT_SELECTION: "ACTION_NEEDED", PROPOSED_TIME: "ACTION_NEEDED",
  CANCELED: "CLOSED", COMPLETED: "CLOSED", DECLINED: "CLOSED",
  NO_SHOW: "PROBLEM", UNABLE_TO_SCHEDULE: "PROBLEM"
};
// §107: the icon carries the same meaning as the colour, so colour is never alone.
const TONE_ICON = { CONFIRMED: "check", WAITING: "clock", ACTION_NEEDED: "calendarClock", CLOSED: "info", PROBLEM: "alert" };

// Fallback patient-facing status. The lead may pass `patientStatus` / `nextStep` / `tone` from
// src/appointments.js (appointmentPatientStatus / appointmentNextStep / appointmentStatusTone)
// and those always win. Internal status strings are never rendered (§20, §36).
const fallbackStatusText = (status, locale) => {
  const t = say(locale);
  return {
    NEED_IDENTIFIED: t("Not scheduled yet", "Todavía sin programar", "Poko pwograme"),
    DRAFT: t("Not sent yet", "Todavía sin enviar", "Poko voye"),
    COLLECTING_PREFERENCES: t("A few questions left", "Faltan algunas preguntas", "Gen kèk kesyon ki rete"),
    SEARCHING_AVAILABILITY: t("Looking for times", "Buscando horarios", "N ap chèche lè"),
    SLOTS_AVAILABLE: t("Times are ready for you", "Hay horarios listos para usted", "Gen lè ki pare pou ou"),
    PENDING_PATIENT_SELECTION: t("Choose a time", "Elija una hora", "Chwazi yon lè"),
    BOOKING: t("Reserving your time", "Reservando su hora", "N ap rezève lè ou a"),
    REQUEST_SENT: t("Request sent", "Solicitud enviada", "Demann voye"),
    WAITING_FOR_OFFICE: t("Waiting for confirmation", "Esperando confirmación", "N ap tann konfimasyon"),
    PROPOSED_TIME: t("The office suggested a time", "La oficina sugirió una hora", "Biwo a pwopoze yon lè"),
    CONFIRMED: t("Appointment confirmed", "Cita confirmada", "Randevou konfime"),
    RESCHEDULE_REQUESTED: t("Change requested", "Cambio solicitado", "Chanjman mande"),
    CANCEL_REQUESTED: t("Cancellation requested", "Cancelación solicitada", "Anilasyon mande"),
    CANCELED: t("Canceled", "Cancelada", "Anile"),
    COMPLETED: t("Completed", "Completada", "Fini"),
    NO_SHOW: t("This visit did not happen", "Esta visita no ocurrió", "Vizit sa a pa t fèt"),
    UNABLE_TO_SCHEDULE: t("We could not schedule this", "No pudimos programarla", "Nou pa t ka pwograme sa"),
    DECLINED: t("Not scheduled", "No programada", "Pa pwograme")
  }[status] || t("In progress", "En curso", "An kou");
};
const fallbackNextStep = (status, locale) => {
  const t = say(locale);
  return {
    DRAFT: t("Finish a few questions and we’ll send it.", "Termine algunas preguntas y la enviaremos.", "Fini kèk kesyon epi n ap voye l."),
    COLLECTING_PREFERENCES: t("Finish a few questions and we’ll send it.", "Termine algunas preguntas y la enviaremos.", "Fini kèk kesyon epi n ap voye l."),
    SLOTS_AVAILABLE: t("Choose a time that works for you.", "Elija una hora que le convenga.", "Chwazi yon lè ki bon pou ou."),
    PENDING_PATIENT_SELECTION: t("Choose a time that works for you.", "Elija una hora que le convenga.", "Chwazi yon lè ki bon pou ou."),
    PROPOSED_TIME: t("Review the time the office suggested.", "Revise la hora que sugirió la oficina.", "Gade lè biwo a pwopoze a."),
    UNABLE_TO_SCHEDULE: t("Your care team will reach out to help.", "Su equipo de cuidado se comunicará para ayudarle.", "Ekip swen ou ap kontakte w pou ede w."),
    DECLINED: t("Your care team will help you find another option.", "Su equipo de cuidado le ayudará a encontrar otra opción.", "Ekip swen ou ap ede w jwenn yon lòt opsyon.")
  }[status] || "";
};

const statusTextFor = (appointment, props) => props?.patientStatus || fallbackStatusText(appointment?.status, localeOf(props));
const nextStepFor = (appointment, props) => (props?.nextStep === undefined ? fallbackNextStep(appointment?.status, localeOf(props)) : props.nextStep);
const toneFor = (appointment, props) => props?.tone || TONE_BY_STATUS[appointment?.status] || "WAITING";

const modalityLabel = (modality, locale) => {
  const t = say(locale);
  return {
    IN_PERSON: t("Office visit", "Visita en el consultorio", "Vizit nan biwo a"),
    TELEHEALTH: t("Video visit", "Visita por video", "Vizit pa videyo"),
    PHONE: t("Phone call", "Llamada telefónica", "Apèl telefòn"),
    NO_PREFERENCE: t("No preference", "Sin preferencia", "Pa gen preferans")
  }[modality] || "";
};
const timeOfDayLabel = (value, locale) => {
  const t = say(locale);
  return {
    MORNING: t("Morning", "Por la mañana", "Nan maten"),
    AFTERNOON: t("Afternoon", "Por la tarde", "Nan aprèmidi"),
    EVENING: t("Evening", "Por la noche", "Nan aswè"),
    NO_PREFERENCE: t("No preference", "Sin preferencia", "Pa gen preferans")
  }[value] || "";
};
const reasonLabel = (value, locale) => {
  const t = say(locale);
  return {
    MEDICATION_RENEWAL: t("Renew a medication", "Renovar un medicamento", "Renouvle yon medikaman"),
    MEDICATION_CONCERN: t("A concern about a medication", "Una preocupación sobre un medicamento", "Yon enkyetid sou yon medikaman"),
    BLOOD_PRESSURE_FOLLOW_UP: t("Blood pressure follow-up", "Seguimiento de la presión arterial", "Swivi pou tansyon"),
    SYMPTOM_REVIEW: t("Something I’ve been feeling", "Algo que he estado sintiendo", "Yon bagay mwen santi"),
    DEVICE_SUPPORT: t("Help with my device", "Ayuda con mi dispositivo", "Èd ak aparèy mwen"),
    LAB_OR_TEST: t("A lab or a test", "Un laboratorio o una prueba", "Yon tès laboratwa"),
    ROUTINE_FOLLOW_UP: t("A routine follow-up", "Un seguimiento de rutina", "Yon swivi abityèl"),
    NEW_CONCERN: t("Something new", "Algo nuevo", "Yon bagay nouvo"),
    CARE_PLAN_REVIEW: t("Review my care plan", "Revisar mi plan de cuidado", "Revize plan swen mwen"),
    OTHER: t("Something else", "Otra cosa", "Yon lòt bagay")
  }[value] || "";
};

/* ------------------------------------------------------------------- shared fragments ---- */

// §102/§103: provider and practice are identity. They wrap; they are never truncated.
const identityBlock = (appointment, props) => {
  const esc = escaper(props);
  const provider = appointment?.providerDisplayName ? `<p class="appointment-provider">${esc(appointment.providerDisplayName)}</p>` : "";
  const specialty = appointment?.requestedSpecialty ? `<p class="appointment-specialty">${esc(appointment.requestedSpecialty)}</p>` : "";
  const practice = appointment?.practiceName ? `<p class="appointment-practice">${esc(appointment.practiceName)}</p>` : "";
  return `${provider}${specialty}${practice}`;
};

// §107: text + icon + tone. `data-tone` styles it; the text and icon carry the meaning.
const statusLine = (appointment, props) => {
  const esc = escaper(props);
  const glyph = iconOf(props);
  const tone = toneFor(appointment, props);
  return `<p class="appointment-status" data-tone="${esc(tone)}">${glyph(TONE_ICON[tone] || "info")}<span>${esc(statusTextFor(appointment, props))}</span></p>`;
};

const nextStepLine = (appointment, props) => {
  const step = nextStepFor(appointment, props);
  return step ? `<p class="appointment-next-step">${escaper(props)(step)}</p>` : "";
};

const preferenceLine = (appointment, props) => {
  const locale = localeOf(props);
  const esc = escaper(props);
  const t = say(locale);
  const values = [timeOfDayLabel(appointment?.preferredTimeOfDay, locale), modalityLabel(appointment?.preferredModality, locale)].filter(Boolean);
  if (!values.length) return "";
  return `<p class="appointment-preference"><span class="appointment-preference-label">${t("Your preference", "Su preferencia", "Preferans ou")}</span><span class="appointment-preference-value">${esc(values.join(" · "))}</span></p>`;
};

const askEmmiButton = (props, appointmentId = "") => {
  const t = say(localeOf(props));
  const esc = escaper(props);
  return `<button type="button" class="appointment-inline-link" data-action="appointment-ask-emmi" data-appointment-id="${esc(appointmentId)}">${t("Ask EMMI about this", "Preguntar a EMMI sobre esto", "Mande EMMI sou sa")} ${iconOf(props)("arrowRight")}</button>`;
};

const backButton = props => {
  const t = say(localeOf(props));
  return `<button type="button" class="appointment-back" data-action="appointment-back">${iconOf(props)("arrowLeft")}<span>${t("Back to My Care", "Volver a Mi cuidado", "Retounen nan Swen mwen")}</span></button>`;
};

const screenTitle = (props, title, lead = "", eyebrow = "") => {
  const esc = escaper(props);
  return `<header class="appointment-screen-head">${eyebrow ? `<p class="appointment-eyebrow">${esc(eyebrow)}</p>` : ""}<h1 class="appointment-screen-title">${esc(title)}</h1>${lead ? `<p class="appointment-lead">${esc(lead)}</p>` : ""}</header>`;
};

/* ----------------------------------------------------------------------- §38 / §108 ------ */

// One card. `kind` decides whether it reads as a confirmed appointment or an open request —
// §105: a pending request is never visually identical to a confirmed appointment.
const appointmentCard = (appointment, props, kind) => {
  const locale = localeOf(props);
  const esc = escaper(props);
  const glyph = iconOf(props);
  const t = say(locale);
  const when = formatWhen(appointment?.scheduledAt, appointment?.timezone, locale);
  // A request has no time to show. Showing one would be the §35 mistake in miniature.
  const whenLine = kind !== "request" && when
    ? `<p class="appointment-card-when">${glyph("calendar")}<span>${esc(when)}</span></p>`
    : "";
  const label = kind === "request"
    ? t("View request", "Ver la solicitud", "Gade demann nan")
    : t("View appointment", "Ver la cita", "Gade randevou a");
  return `<article class="appointment-card" data-kind="${kind}" data-tone="${esc(toneFor(appointment, props))}">
    ${whenLine}
    <div class="appointment-identity">${identityBlock(appointment, props)}</div>
    ${statusLine(appointment, props)}
    ${kind === "request" ? preferenceLine(appointment, props) : ""}
    ${nextStepLine(appointment, props)}
    <button type="button" class="appointment-card-action" data-action="appointment-open" data-appointment-id="${esc(appointment?.id)}"><span>${label}</span>${glyph("arrowRight")}</button>
  </article>`;
};

const partitionAppointments = (appointments, now) => {
  const list = Array.isArray(appointments) ? appointments.filter(Boolean) : [];
  const nowDate = toDate(now) || new Date();
  const startOf = appointment => toDate(appointment?.scheduledAt);
  const upcoming = list
    .filter(appointment => !isClosed(appointment) && startOf(appointment) && startOf(appointment).getTime() >= nowDate.getTime())
    .sort((a, b) => startOf(a) - startOf(b));
  const requests = list.filter(appointment => !isClosed(appointment) && isOpenRequest(appointment) && !upcoming.includes(appointment));
  const past = list
    .filter(appointment => isClosed(appointment) || (startOf(appointment) && startOf(appointment).getTime() < nowDate.getTime() && !isOpenRequest(appointment)))
    .sort((a, b) => (startOf(b) || 0) - (startOf(a) || 0));
  return { upcoming, requests, past };
};

// §38/§108. Lives inside My Care. Confirmed visits first, then anything still being arranged.
export function upcomingCareSection(props = {}) {
  const locale = localeOf(props);
  const t = say(locale);
  const { upcoming, requests } = partitionAppointments(props.appointments, props.now);
  const limit = Number.isFinite(props.limit) ? props.limit : 2;
  const shownUpcoming = upcoming.slice(0, limit);
  const shownRequests = requests.slice(0, limit);
  const total = upcoming.length + requests.length;
  const body = shownUpcoming.length || shownRequests.length
    ? `${shownUpcoming.map(appointment => appointmentCard(appointment, props, "appointment")).join("")}
       ${shownRequests.length ? `<h3 class="appointment-subsection-title">${t("Being arranged", "En gestión", "N ap òganize")}</h3>${shownRequests.map(appointment => appointmentCard(appointment, props, "request")).join("")}` : ""}`
    : `<p class="appointment-empty">${t("Nothing is scheduled right now.", "No hay nada programado por ahora.", "Pa gen anyen ki pwograme kounye a.")}</p>`;
  // A patient whose only visit already happened still has to be able to reach it — which is exactly
  // the state the after-visit follow-up needs. Offer the list whenever there is anything at all.
  const seeAll = (props.appointments || []).length > 0
    ? `<button type="button" class="appointment-inline-link" data-action="appointment-open-list">${t("See all appointments", "Ver todas las citas", "Wè tout randevou yo")} ${iconOf(props)("arrowRight")}</button>`
    : "";
  return `<section class="appointment-upcoming-care">
    <h2 class="appointment-section-title">${t("Upcoming care", "Próximas citas", "Pwochen randevou")}</h2>
    ${body}
    ${seeAll}
  </section>`;
}

// §39. An invitation, not a scheduling module.
export function needAnAppointmentCard(props = {}) {
  const t = say(localeOf(props));
  const glyph = iconOf(props);
  return `<section class="appointment-need-card">
    <div class="appointment-need-heading">
      <div class="appointment-need-icon">${glyph("calendarClock")}</div>
      <h2 class="appointment-need-title">${t("Need an appointment?", "¿Necesita una cita?", "Ou bezwen yon randevou?")}</h2>
    </div>
    <p class="appointment-need-copy">${t("EMMI can help you coordinate with your care team.", "EMMI puede ayudarle a coordinar con su equipo de cuidado.", "EMMI ka ede w òganize sa ak ekip swen ou.")}</p>
    <button type="button" class="appointment-action secondary" data-action="appointment-ask-emmi"><span>${t("Ask EMMI", "Preguntar a EMMI", "Mande EMMI")}</span>${glyph("arrowRight")}</button>
  </section>`;
}

/* ---------------------------------------------------------------------------- §40 -------- */

// Three plain tabs. §154: no calendar, no grid, no month view.
export function appointmentsListScreen(props = {}) {
  const locale = localeOf(props);
  const esc = escaper(props);
  const t = say(locale);
  const { upcoming, requests, past } = partitionAppointments(props.appointments, props.now);
  const tab = ["UPCOMING", "PAST", "REQUESTS"].includes(props.tab) ? props.tab : "UPCOMING";
  const tabs = [
    ["UPCOMING", t("Upcoming", "Próximas", "K ap vini")],
    ["REQUESTS", t("Requests", "Solicitudes", "Demann")],
    ["PAST", t("Past", "Anteriores", "Sa ki pase")]
  ];
  const active = tab === "REQUESTS" ? requests : tab === "PAST" ? past : upcoming;
  const kind = tab === "REQUESTS" ? "request" : tab === "PAST" ? "past" : "appointment";
  const emptyCopy = tab === "REQUESTS"
    ? t("You have no open requests.", "No tiene solicitudes abiertas.", "Ou pa gen demann ki ouvè.")
    : tab === "PAST"
      ? t("Nothing here yet.", "Todavía no hay nada aquí.", "Poko gen anyen isit la.")
      : t("Nothing is scheduled right now.", "No hay nada programado por ahora.", "Pa gen anyen ki pwograme kounye a.");
  return `<div class="appointment-screen appointment-list-screen">
    ${screenTitle(props, t("My appointments", "Mis citas", "Randevou mwen yo"), t("Your visits and anything still being arranged.", "Sus visitas y lo que todavía se está gestionando.", "Vizit ou yo ak sa k ap òganize toujou."))}
    <div class="appointment-tabs" role="group">${tabs.map(([value, label]) => `<button type="button" class="appointment-tab" data-action="appointment-list-tab" data-tab="${value}" aria-pressed="${tab === value ? "true" : "false"}">${esc(label)}</button>`).join("")}</div>
    <div class="appointment-list">${active.length ? active.map(appointment => appointmentCard(appointment, props, kind)).join("") : `<p class="appointment-empty">${esc(emptyCopy)}</p>`}</div>
    ${needAnAppointmentCard(props)}
    ${backButton(props)}
  </div>`;
}

/* ------------------------------------------------------------------------ §110 / §111 ---- */

// §58: only a real https join link earns a Join visit control. A non-https value is dropped
// rather than rendered, so no scheme can ride in on the href.
const joinUrlOf = appointment => {
  const value = typeof appointment?.joinUrl === "string" ? appointment.joinUrl.trim() : "";
  return /^https:\/\//i.test(value) ? value : "";
};

const confirmedActions = (appointment, props) => {
  const locale = localeOf(props);
  const esc = escaper(props);
  const glyph = iconOf(props);
  const t = say(locale);
  const id = esc(appointment?.id);
  const join = joinUrlOf(appointment);
  // §58 join, §59 directions. §60 add-to-calendar is not offered: no ICS support exists.
  return `${join ? `<a class="appointment-action primary" href="${esc(join)}" target="_blank" rel="noopener" data-action="appointment-join-visit" data-appointment-id="${id}">${glyph("video")}<span>${t("Join visit", "Unirse a la visita", "Antre nan vizit la")}</span></a>` : ""}
    ${appointment?.locationAddress ? `<button type="button" class="appointment-action secondary" data-action="appointment-get-directions" data-appointment-id="${id}">${glyph("mapPin")}<span>${t("Get directions", "Cómo llegar", "Jwenn direksyon")}</span></button>` : ""}
    <button type="button" class="appointment-action secondary" data-action="appointment-open-prep" data-appointment-id="${id}">${glyph("plan")}<span>${t("Prepare with EMMI", "Prepararse con EMMI", "Prepare w ak EMMI")}</span></button>
    <button type="button" class="appointment-action secondary" data-action="appointment-open-reminder" data-appointment-id="${id}">${glyph("bell")}<span>${t("Remind me in the app", "Recordármelo en la aplicación", "Fè m sonje nan aplikasyon an")}</span></button>
    <button type="button" class="appointment-action secondary" data-action="appointment-open-share" data-appointment-id="${id}">${glyph("people")}<span>${t("Share with my Care Circle", "Compartir con mi Círculo de cuidado", "Pataje ak Sèk swen mwen")}</span></button>
    <button type="button" class="appointment-action secondary" data-action="appointment-open-barrier" data-appointment-id="${id}">${glyph("car")}<span>${t("Anything making this hard?", "¿Algo se lo dificulta?", "Gen anyen k ap fè sa difisil?")}</span></button>
    <div class="appointment-change-actions">
      <button type="button" class="appointment-inline-link" data-action="appointment-request-reschedule" data-appointment-id="${id}">${t("Change the time", "Cambiar la hora", "Chanje lè a")}</button>
      <button type="button" class="appointment-inline-link appointment-danger" data-action="appointment-request-cancel" data-appointment-id="${id}">${t("Cancel appointment", "Cancelar la cita", "Anile randevou a")}</button>
    </div>`;
};

const whereBlock = (appointment, props) => {
  const locale = localeOf(props);
  const esc = escaper(props);
  const glyph = iconOf(props);
  const rows = [];
  const modality = modalityLabel(appointment?.modality, locale);
  if (modality) rows.push([appointment?.modality === "TELEHEALTH" ? "video" : appointment?.modality === "PHONE" ? "phone" : "hospital", modality]);
  if (appointment?.locationName) rows.push(["mapPin", appointment.locationName]);
  if (appointment?.locationAddress) rows.push(["mapPin", appointment.locationAddress]);
  if (!rows.length) return "";
  return `<ul class="appointment-where">${rows.map(([name, value]) => `<li>${glyph(name)}<span>${esc(value)}</span></li>`).join("")}</ul>`;
};

// §110 confirmed, §111 pending. The branch is the whole point: a request never borrows the
// confirmed layout, the check icon, or the word "confirmed".
export function appointmentDetailView(props = {}) {
  const appointment = props.appointment || {};
  const locale = localeOf(props);
  const esc = escaper(props);
  const glyph = iconOf(props);
  const t = say(locale);
  const confirmed = isConfirmedAppointment(appointment);
  const parts = wallClock(appointment.scheduledAt, appointment.timezone);
  const capabilityNote = props.capability === "NO_AVAILABLE_CHANNEL" || props.capability === "HUMAN_COORDINATION"
    ? `<p class="appointment-note">${glyph("info")}<span>${t("Your care team handles any change to this visit for you.", "Su equipo de cuidado se encarga de cualquier cambio en esta visita.", "Ekip swen ou okipe nenpòt chanjman nan vizit sa a pou ou.")}</span></p>`
    : "";
  if (confirmed) {
    return `<div class="appointment-screen appointment-detail-screen" data-kind="appointment">
      ${screenTitle(props, t("Appointment confirmed", "Cita confirmada", "Randevou konfime"), "", t("Your care", "Su cuidado", "Swen ou"))}
      <section class="appointment-hero" data-tone="CONFIRMED">
        <p class="appointment-status" data-tone="CONFIRMED">${glyph("check")}<span>${esc(statusTextFor(appointment, props))}</span></p>
        <div class="appointment-identity">${identityBlock(appointment, props)}</div>
        <p class="appointment-hero-date">${esc(formatLongDate(parts, locale))}</p>
        <p class="appointment-hero-time">${esc(formatTime(parts, locale))}</p>
        ${whereBlock(appointment, props)}
        ${appointment.confirmationNumber ? `<p class="appointment-meta">${t("Confirmation number", "Número de confirmación", "Nimewo konfimasyon")}: ${esc(appointment.confirmationNumber)}</p>` : ""}
      </section>
      ${capabilityNote}
      <div class="appointment-actions">${confirmedActions(appointment, props)}</div>
      ${askEmmiButton(props, appointment.id)}
      ${backButton(props)}
    </div>`;
  }
  return `<div class="appointment-screen appointment-detail-screen" data-kind="request">
    ${screenTitle(props, t("Your request", "Su solicitud", "Demann ou"), "", t("Your care", "Su cuidado", "Swen ou"))}
    <section class="appointment-request-panel" data-tone="${esc(toneFor(appointment, props))}">
      ${statusLine(appointment, props)}
      <div class="appointment-identity">${identityBlock(appointment, props)}</div>
      ${preferenceLine(appointment, props)}
      ${appointment.reasonCategory ? `<p class="appointment-meta">${t("Reason", "Motivo", "Rezon")}: ${esc(reasonLabel(appointment.reasonCategory, locale))}</p>` : ""}
      ${nextStepLine(appointment, props)}
      <p class="appointment-note">${glyph("info")}<span>${t("This is a request, not a scheduled visit. We’ll let you know when the office confirms a time.", "Esta es una solicitud, no una visita programada. Le avisaremos cuando la oficina confirme una hora.", "Sa a se yon demann, se pa yon vizit ki pwograme. N ap fè w konnen lè biwo a konfime yon lè.")}</span></p>
    </section>
    ${capabilityNote}
    ${appointment.status === "COLLECTING_PREFERENCES" || appointment.status === "DRAFT" || appointment.status === "NEED_IDENTIFIED"
      ? `<button type="button" class="appointment-action primary" data-action="appointment-change-preferences" data-appointment-id="${esc(appointment.id)}">${glyph("arrowRight")}<span>${t("Finish this request", "Terminar esta solicitud", "Fini demann sa a")}</span></button>`
      : ""}
    ${askEmmiButton(props, appointment.id)}
    ${backButton(props)}
  </div>`;
}

/* --------------------------------------------------------------- §31-33 / §100 / §101 ---- */

const slotCard = (slot, appointment, props) => {
  const locale = localeOf(props);
  const esc = escaper(props);
  const glyph = iconOf(props);
  const parts = wallClock(slot?.startAt, slot?.timezone || appointment?.timezone);
  const modality = modalityLabel(slot?.modality, locale);
  const where = [modality, slot?.locationName].filter(Boolean).join(" · ");
  return `<button type="button" class="appointment-slot" data-action="appointment-select-slot" data-appointment-id="${esc(appointment?.id)}" data-slot-id="${esc(slot?.slotId)}">
    <span class="appointment-slot-when">${esc(formatLongDate(parts, locale))}</span>
    <span class="appointment-slot-time">${esc(formatTime(parts, locale))}</span>
    ${where ? `<span class="appointment-slot-meta">${esc(where)}</span>` : ""}
    <span class="appointment-slot-go" aria-hidden="true">${glyph("chevronRight")}</span>
  </button>`;
};

// §123/§124: a booking that failed says so in the patient's language. An internal error code is
// never rendered — anything unrecognised becomes the honest generic sentence.
const bookingProblemLine = (props, glyph) => {
  const error = typeof props.error === "string" ? props.error.trim() : "";
  if (!error) return "";
  const t = say(localeOf(props));
  const known = {
    SLOT_UNAVAILABLE: t("That time was just taken. Here are the times still open.", "Esa hora acaba de ocuparse. Estas son las horas que siguen libres.", "Yo fèk pran lè sa a. Men lè ki toujou lib yo."),
    SLOT_GONE: t("That time was just taken. Here are the times still open.", "Esa hora acaba de ocuparse. Estas son las horas que siguen libres.", "Yo fèk pran lè sa a. Men lè ki toujou lib yo."),
    AVAILABILITY_UNAVAILABLE: t("We could not load times just now. Nothing was booked.", "No pudimos cargar los horarios ahora. No se reservó nada.", "Nou pa t ka chaje lè yo kounye a. Anyen pa t rezève.")
  }[error];
  const message = known || t("We could not finish that just now. Nothing was booked.", "No pudimos completarlo ahora. No se reservó nada.", "Nou pa t ka fini sa kounye a. Anyen pa t rezève.");
  return `<p class="appointment-note" data-tone="ACTION_NEEDED" role="status">${glyph("alert")}<span>${escaper(props)(message)}</span></p>`;
};

// §32/§100/§154: three recommended times and a way to widen the search. There is no month
// grid, no time grid, and no calendar anywhere in this view.
export function slotPickerView(props = {}) {
  const appointment = props.appointment || {};
  const locale = localeOf(props);
  const esc = escaper(props);
  const t = say(locale);
  const slots = (Array.isArray(props.slots) ? props.slots : []).filter(Boolean);
  const initial = 3;
  const expanded = props.expanded === true;
  const shown = expanded ? slots.slice(0, 8) : slots.slice(0, initial);
  const body = shown.length
    ? `<div class="appointment-slots">${shown.map(slot => slotCard(slot, appointment, props)).join("")}</div>
       ${!expanded && slots.length > initial ? `<button type="button" class="appointment-action secondary" data-action="appointment-more-times" data-appointment-id="${esc(appointment.id)}"><span>${t("See more times", "Ver más horarios", "Wè plis lè")}</span></button>` : ""}`
    : `<p class="appointment-empty">${t("No times are available to show right now. Your care team can help you find one.", "No hay horarios disponibles ahora mismo. Su equipo de cuidado puede ayudarle a encontrar uno.", "Pa gen lè ki disponib pou montre kounye a. Ekip swen ou ka ede w jwenn youn.")}</p>`;
  return `<div class="appointment-screen appointment-slot-screen">
    ${screenTitle(props, t("Choose a time", "Elija una hora", "Chwazi yon lè"), "", t("Appointment", "Cita", "Randevou"))}
    ${bookingProblemLine(props, iconOf(props))}
    <section class="appointment-slot-context">
      <div class="appointment-identity">${identityBlock(appointment, props)}</div>
      ${preferenceLine(appointment, props)}
    </section>
    ${body}
    <button type="button" class="appointment-inline-link" data-action="appointment-change-preferences" data-appointment-id="${esc(appointment.id)}">${t("Choose another day", "Elegir otro día", "Chwazi yon lòt jou")}</button>
    ${askEmmiButton(props, appointment.id)}
    ${backButton(props)}
  </div>`;
}

/* --------------------------------------------------------------------------- §34 --------- */

// §34. Only a genuinely confirmed record gets confirmed formatting — anything else falls
// through to the request screen rather than claiming a booking that did not happen (§18, §123).
export function bookingConfirmationView(props = {}) {
  const appointment = props.appointment || {};
  if (!isConfirmedAppointment(appointment)) return requestConfirmationView(props);
  const locale = localeOf(props);
  const esc = escaper(props);
  const glyph = iconOf(props);
  const t = say(locale);
  const parts = wallClock(appointment.scheduledAt, appointment.timezone);
  return `<div class="appointment-screen appointment-confirmation-screen" data-kind="appointment">
    ${screenTitle(props, t("Appointment confirmed", "Cita confirmada", "Randevou konfime"), "", t("Your care", "Su cuidado", "Swen ou"))}
    <section class="appointment-hero" data-tone="CONFIRMED">
      <p class="appointment-status" data-tone="CONFIRMED">${glyph("check")}<span>${t("Confirmed", "Confirmada", "Konfime")}</span></p>
      <div class="appointment-identity">${identityBlock(appointment, props)}</div>
      <p class="appointment-hero-date">${esc(formatLongDate(parts, locale))}</p>
      <p class="appointment-hero-time">${esc(formatTime(parts, locale))}</p>
      ${whereBlock(appointment, props)}
      ${appointment.confirmationNumber ? `<p class="appointment-meta">${t("Confirmation number", "Número de confirmación", "Nimewo konfimasyon")}: ${esc(appointment.confirmationNumber)}</p>` : ""}
    </section>
    <div class="appointment-actions">${confirmedActions(appointment, props)}</div>
    ${askEmmiButton(props, appointment.id)}
    ${backButton(props)}
  </div>`;
}

/* --------------------------------------------------------------------------- §35 --------- */

// §35/§111. No check mark, no "confirmed", no date headline. A sent request is a sent request.
export function requestConfirmationView(props = {}) {
  const appointment = props.appointment || {};
  const locale = localeOf(props);
  const esc = escaper(props);
  const glyph = iconOf(props);
  const t = say(locale);
  return `<div class="appointment-screen appointment-request-screen" data-kind="request">
    ${screenTitle(props, t("Request sent", "Solicitud enviada", "Demann voye"), "", t("Your care", "Su cuidado", "Swen ou"))}
    <section class="appointment-request-panel" data-tone="WAITING">
      <p class="appointment-status" data-tone="WAITING">${glyph("clock")}<span>${t("Waiting for the office", "Esperando a la oficina", "N ap tann biwo a")}</span></p>
      <div class="appointment-identity">${identityBlock(appointment, props)}</div>
      ${preferenceLine(appointment, props)}
      ${appointment.reasonCategory ? `<p class="appointment-meta">${t("Reason", "Motivo", "Rezon")}: ${esc(reasonLabel(appointment.reasonCategory, locale))}</p>` : ""}
      <p class="appointment-note">${glyph("info")}<span>${t("Your request was sent. We’ll let you know when the office confirms a time. Nothing is scheduled yet.", "Su solicitud fue enviada. Le avisaremos cuando la oficina confirme una hora. Todavía no hay nada programado.", "Demann ou an voye. N ap fè w konnen lè biwo a konfime yon lè. Poko gen anyen ki pwograme.")}</span></p>
    </section>
    <button type="button" class="appointment-action secondary" data-action="appointment-open" data-appointment-id="${esc(appointment.id)}"><span>${t("View request", "Ver la solicitud", "Gade demann nan")}</span>${glyph("arrowRight")}</button>
    ${askEmmiButton(props, appointment.id)}
    ${backButton(props)}
  </div>`;
}

/* ------------------------------------------------------------------ §43 / §44 / §112 ----- */

export function appointmentPrepView(props = {}) {
  const appointment = props.appointment || {};
  const locale = localeOf(props);
  const esc = escaper(props);
  const glyph = iconOf(props);
  const t = say(locale);
  const parts = wallClock(appointment.scheduledAt, appointment.timezone);
  const when = relativeDay(appointment.scheduledAt, appointment.timezone, props.now, locale);
  const topics = Array.isArray(appointment.prep?.topics) ? appointment.prep.topics.filter(Boolean) : [];
  const prepMedications = Array.isArray(appointment.prep?.medications) ? appointment.prep.medications.filter(item => item?.medicationId && item?.name) : [];
  return `<div class="appointment-screen appointment-prep-screen">
    ${screenTitle(props, t("Get ready", "Prepárese", "Prepare w"), t("EMMI can help you remember what you want to discuss.", "EMMI puede ayudarle a recordar lo que quiere conversar.", "EMMI ka ede w sonje sa ou vle pale sou li."), t("Appointment", "Cita", "Randevou"))}
    <section class="appointment-prep-context">
      ${when ? `<p class="appointment-card-when">${glyph("calendarClock")}<span>${esc(t(`Your appointment is ${when}`, `Su cita es ${when}`, `Randevou ou se ${when}`))}</span></p>` : ""}
      <div class="appointment-identity">${identityBlock(appointment, props)}</div>
      ${parts ? `<p class="appointment-meta">${esc(formatTime(parts, locale))}</p>` : ""}
    </section>
    <h2 class="appointment-question">${t("Things you wanted to discuss", "Lo que quería conversar", "Bagay ou te vle pale sou yo")}</h2>
    ${topics.length
      ? `<ul class="appointment-topics">${topics.map((topic, index) => `<li><span class="appointment-topic-text">${esc(topic)}</span><button type="button" class="appointment-topic-remove" data-action="appointment-remove-prep-topic" data-appointment-id="${esc(appointment.id)}" data-topic-index="${index}"><span class="appointment-visually-hidden">${t("Remove", "Eliminar", "Retire")}</span>${glyph("rotate")}</button></li>`).join("")}</ul>`
      : `<p class="appointment-empty">${t("Nothing added yet.", "Todavía no hay nada.", "Poko gen anyen.")}</p>`}
    ${prepMedications.length ? `<section class="appointment-prep-medications">
      <h2 class="appointment-question">${t("Medications to review", "Medicamentos para revisar", "Medikaman pou revize")}</h2>
      <ul class="appointment-topics appointment-medication-agenda">${prepMedications.map(item => `<li><span class="appointment-topic-text"><strong>${esc(item.name)}</strong>${item.details ? `<small>${esc(item.details)}</small>` : ""}</span><button type="button" class="appointment-topic-remove" data-action="appointment-remove-prep-medication" data-appointment-id="${esc(appointment.id)}" data-medication-id="${esc(item.medicationId)}"><span class="appointment-visually-hidden">${t("Remove", "Eliminar", "Retire")}</span>${glyph("rotate")}</button></li>`).join("")}</ul>
    </section>` : ""}
    <form id="appointment-prep-form" class="appointment-prep-form" novalidate>
      <label class="appointment-field" for="appointment-prep-topic">${t("Add something to discuss", "Agregar algo para conversar", "Ajoute yon bagay pou pale sou li")}
        <input id="appointment-prep-topic" name="prepTopic" maxlength="120" autocomplete="off" placeholder="${esc(t("Example: my blood pressure readings", "Ejemplo: mis lecturas de presión arterial", "Egzanp: mezi tansyon mwen yo"))}">
      </label>
      <button type="button" class="appointment-action secondary" data-action="appointment-add-prep-topic" data-appointment-id="${esc(appointment.id)}">${glyph("check")}<span>${t("Add", "Agregar", "Ajoute")}</span></button>
    </form>
    <button type="button" class="appointment-action primary" data-action="appointment-ask-emmi" data-appointment-id="${esc(appointment.id)}"><span>${t("Prepare with EMMI", "Prepararse con EMMI", "Prepare w ak EMMI")}</span>${glyph("arrowRight")}</button>
    <button type="button" class="appointment-inline-link" data-action="appointment-open-brief" data-appointment-id="${esc(appointment.id)}">${t("See my list", "Ver mi lista", "Gade lis mwen")} ${glyph("arrowRight")}</button>
    ${backButton(props)}
  </div>`;
}

/* ------------------------------------------------------------------ §45 / §46 / §47 ------ */

export function appointmentBriefView(props = {}) {
  const appointment = props.appointment || {};
  const locale = localeOf(props);
  const esc = escaper(props);
  const glyph = iconOf(props);
  const t = say(locale);
  const topics = Array.isArray(appointment.prep?.topics) ? appointment.prep.topics.filter(Boolean) : [];
  const prepMedications = Array.isArray(appointment.prep?.medications) ? appointment.prep.medications.filter(item => item?.medicationId && item?.name) : [];
  const shared = appointment.prep?.sharedWithProvider === true;
  // §46: only fields the record actually carries. Nothing is invented, nothing is a transcript.
  const contextRows = [
    appointment.reasonCategory ? [t("Reason", "Motivo", "Rezon"), reasonLabel(appointment.reasonCategory, locale)] : null,
    appointment.reasonSummary ? [t("In your words", "En sus palabras", "Nan mo pa ou"), appointment.reasonSummary] : null,
    props.relatedGoalLabel ? [t("Related goal", "Meta relacionada", "Objektif ki lye"), props.relatedGoalLabel] : null,
    props.activeBarrierLabel ? [t("Something making care harder", "Algo que dificulta el cuidado", "Yon bagay ki fè swen an pi difisil"), props.activeBarrierLabel] : null
  ].filter(Boolean);
  return `<div class="appointment-screen appointment-brief-screen">
    ${screenTitle(props, t("Things I want to discuss", "Lo que quiero conversar", "Bagay mwen vle pale sou yo"), "", t("Appointment", "Cita", "Randevou"))}
    <div class="appointment-identity">${identityBlock(appointment, props)}</div>
    ${topics.length || prepMedications.length
      ? `<ol class="appointment-brief-list">${topics.map(topic => `<li class="appointment-brief-item">${esc(topic)}</li>`).join("")}${prepMedications.map(item => `<li class="appointment-brief-item appointment-brief-medication"><strong>${t("Medication", "Medicamento", "Medikaman")}: ${esc(item.name)}</strong>${item.details ? `<small>${esc(item.details)}</small>` : ""}</li>`).join("")}</ol>`
      : `<p class="appointment-empty">${t("You haven’t added anything yet.", "Todavía no ha agregado nada.", "Ou poko ajoute anyen.")}</p>`}
    <button type="button" class="appointment-inline-link" data-action="appointment-open-prep" data-appointment-id="${esc(appointment.id)}">${t("Edit", "Editar", "Modifye")} ${glyph("arrowRight")}</button>
    ${contextRows.length ? `<section class="appointment-brief-context">
      <h2 class="appointment-section-title">${t("What your care team would see", "Lo que vería su equipo de cuidado", "Sa ekip swen ou ta wè")}</h2>
      <dl class="appointment-facts">${contextRows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>
    </section>` : ""}
    <section class="appointment-share-state">
      <p class="appointment-status" data-tone="${shared ? "CONFIRMED" : "WAITING"}">${glyph(shared ? "check" : "clock")}<span>${shared ? t("Shared with your care team", "Compartido con su equipo de cuidado", "Pataje ak ekip swen ou") : t("Not shared yet", "Todavía sin compartir", "Poko pataje")}</span></p>
      <p class="appointment-note">${glyph("lock")}<span>${t("Nothing is sent to your care team until you choose to share it.", "No se envía nada a su equipo de cuidado hasta que usted decida compartirlo.", "Anyen pa ale bay ekip swen ou jiskaske ou chwazi pataje l.")}</span></p>
      ${shared ? "" : `<button type="button" class="appointment-action secondary" data-action="appointment-share-brief" data-appointment-id="${esc(appointment.id)}">${glyph("share")}<span>${t("Share this with my care team", "Compartir esto con mi equipo de cuidado", "Pataje sa ak ekip swen mwen")}</span></button>`}
    </section>
    ${backButton(props)}
  </div>`;
}

/* ------------------------------------------------------------------------ §51 / §113 ----- */

export function appointmentBarrierCheckView(props = {}) {
  const appointment = props.appointment || {};
  const locale = localeOf(props);
  const esc = escaper(props);
  const glyph = iconOf(props);
  const t = say(locale);
  const parts = wallClock(appointment.scheduledAt, appointment.timezone);
  const when = relativeDay(appointment.scheduledAt, appointment.timezone, props.now, locale);
  const time = formatTime(parts, locale);
  const provider = appointment.providerDisplayName || t("your care team", "su equipo de cuidado", "ekip swen ou");
  const lead = when && time
    ? t(`Your appointment with ${provider} is ${when} at ${time}.`, `Su cita con ${provider} es ${when} a las ${time}.`, `Randevou ou ak ${provider} se ${when} a ${time}.`)
    : "";
  // Icons for the reason keys src/appointmentSupport.js owns. When the lead passes
  // `preVisitCheck` (preVisitCheckOptions), its question and labels win — this list is the
  // fallback so the screen still works before that wiring lands.
  const reasonGlyph = { ALL_SET: "check", TRANSPORTATION: "car", CAREGIVER_AVAILABILITY: "people", TIME_CONFLICT: "clock", LOCATION_UNCLEAR: "mapPin", TECHNOLOGY_TELEHEALTH: "video", MOBILITY: "person", LANGUAGE: "language", FINANCIAL: "info", CANNOT_REACH_OFFICE: "phone", OTHER: "question" };
  const supplied = Array.isArray(props.preVisitCheck?.options) ? props.preVisitCheck.options.filter(option => option?.reasonKey) : [];
  const options = supplied.length
    ? supplied.map(option => [option.reasonKey, reasonGlyph[option.reasonKey] || "question", option.label || ""])
    : [
      ["ALL_SET", "check", t("I’m all set", "Todo está listo", "Tout bagay pare")],
      ["TRANSPORTATION", "car", t("I don’t have a way to get there", "No tengo cómo llegar", "Mwen pa gen mwayen pou rive")],
      ["CAREGIVER_AVAILABILITY", "people", t("I need someone to come with me", "Necesito que alguien me acompañe", "Mwen bezwen yon moun vin ak mwen")],
      ["TIME_CONFLICT", "clock", t("I need to change the time", "Necesito cambiar la hora", "Mwen bezwen chanje lè a")],
      ...(appointment.modality === "TELEHEALTH"
        ? [["TECHNOLOGY_TELEHEALTH", "video", t("I’m not sure how to start the video visit", "No sé cómo comenzar la visita por video", "Mwen pa konnen kijan pou kòmanse vizit videyo a")]]
        : [["LOCATION_UNCLEAR", "mapPin", t("I’m not sure where to go", "No sé a dónde ir", "Mwen pa konnen ki kote pou m ale")]]),
      ["OTHER", "question", t("Something else", "Otra cosa", "Yon lòt bagay")]
    ];
  const question = props.preVisitCheck?.question || t("Anything making it difficult to attend?", "¿Algo que dificulte asistir?", "Èske gen yon bagay ki fè l difisil pou w ale?");
  return `<div class="appointment-screen appointment-barrier-screen">
    ${screenTitle(props, question, lead, t("Appointment", "Cita", "Randevou"))}
    <div class="appointment-choices">${options.map(([reason, name, label]) => `<button type="button" class="appointment-choice" data-action="appointment-barrier-answer" data-appointment-id="${esc(appointment.id)}" data-barrier-reason="${reason}">${glyph(name)}<span>${esc(label)}</span></button>`).join("")}</div>
    ${askEmmiButton(props, appointment.id)}
    ${backButton(props)}
  </div>`;
}

/* ---------------------------------------------------------------------------- §114 ------- */

export function appointmentShareView(props = {}) {
  const appointment = props.appointment || {};
  const locale = localeOf(props);
  const esc = escaper(props);
  const glyph = iconOf(props);
  const t = say(locale);
  const members = (Array.isArray(props.members) ? props.members : []).filter(Boolean);
  // §54/§56: the gate is careCircleSharingOptions(). This view only reflects its answer.
  const gate = props.allowed === undefined ? props.sharing?.allowed : props.allowed;
  const allowed = gate === undefined ? members.length > 0 : gate === true;
  const when = formatWhen(appointment.scheduledAt, appointment.timezone, locale);
  if (!allowed || !members.length) {
    return `<div class="appointment-screen appointment-share-screen">
      ${screenTitle(props, t("Share this appointment", "Compartir esta cita", "Pataje randevou sa a"), "", t("Care Circle", "Círculo de cuidado", "Sèk swen"))}
      <p class="appointment-empty">${t("Sharing is available once someone in your Care Circle has accepted their invitation and you’ve allowed help with appointments.", "Podrá compartir cuando alguien de su Círculo de cuidado acepte la invitación y usted permita ayuda con las citas.", "W ap ka pataje lè yon moun nan Sèk swen ou aksepte envitasyon an epi ou bay pèmisyon pou èd ak randevou.")}</p>
      ${backButton(props)}
    </div>`;
  }
  return `<div class="appointment-screen appointment-share-screen">
    ${screenTitle(props, t("Share this appointment", "Compartir esta cita", "Pataje randevou sa a"), "", t("Care Circle", "Círculo de cuidado", "Sèk swen"))}
    <section class="appointment-share-summary">
      ${when ? `<p class="appointment-card-when">${glyph("calendar")}<span>${esc(when)}</span></p>` : ""}
      <div class="appointment-identity">${identityBlock(appointment, props)}</div>
    </section>
    ${members.map(member => `<article class="appointment-share-member">
      <div class="appointment-share-identity">${glyph("person")}<div><strong>${esc(member.firstName || member.name || "")}</strong><small>${esc([member.relationship, t("Care Circle", "Círculo de cuidado", "Sèk swen")].filter(Boolean).join(" · "))}</small></div></div>
      <p class="appointment-share-heading">${t("They will receive", "Recibirá", "Moun nan ap resevwa")}</p>
      <ul class="appointment-share-list">
        <li>${glyph("check")}<span>${t("The date and time", "La fecha y la hora", "Dat la ak lè a")}</span></li>
        <li>${glyph("check")}<span>${t("Where the visit happens", "Dónde es la visita", "Kote vizit la ap fèt")}</span></li>
      </ul>
      <p class="appointment-note">${t("You will need to tell them yourself — ITERA has no way to message a Care Circle member.", "Tendrá que avisarle usted — ITERA no puede enviar mensajes a un miembro del Círculo de cuidado.", "Se ou menm k ap gen pou di l — ITERA pa gen mwayen pou voye mesaj bay yon manm Sèk swen an.")}</p>
      <p class="appointment-share-heading">${t("They will not receive", "No recibirá", "Moun nan p ap resevwa")}</p>
      <ul class="appointment-share-list appointment-share-list-negative">
        <li>${glyph("lock")}<span>${t("Your medical records", "Su historial médico", "Dosye medikal ou")}</span></li>
        <li>${glyph("lock")}<span>${t("Any authority over your care decisions", "Ninguna autoridad sobre sus decisiones de cuidado", "Okenn otorite sou desizyon swen ou")}</span></li>
      </ul>
      <button type="button" class="appointment-action secondary" data-action="appointment-share-with-member" data-appointment-id="${esc(appointment.id)}" data-invite-id="${esc(member.inviteId)}">${glyph("share")}<span>${t("Share appointment", "Compartir la cita", "Pataje randevou a")}</span></button>
    </article>`).join("")}
    ${props.scope?.limits ? `<p class="appointment-legal">${esc(props.scope.limits)}</p>` : ""}
    <p class="appointment-legal">${t("You can stop sharing at any time in My Care Circle.", "Puede dejar de compartir en cualquier momento en Mi Círculo de cuidado.", "Ou ka sispann pataje nenpòt lè nan Sèk swen mwen.")}</p>
    ${backButton(props)}
  </div>`;
}

/* ------------------------------------------------------------------------ §65-§68 -------- */

// §68: never accusatory. The question is always "were you able to attend", never "you missed".
export function appointmentFollowUpView(props = {}) {
  const appointment = props.appointment || {};
  const locale = localeOf(props);
  const esc = escaper(props);
  const glyph = iconOf(props);
  const t = say(locale);
  const id = esc(appointment.id);
  const provider = appointment.providerDisplayName || t("your care team", "su equipo de cuidado", "ekip swen ou");
  const step = ["ATTENDANCE", "ATTENDED", "MISSED"].includes(props.step) ? props.step : "ATTENDANCE";
  const choices = step === "ATTENDED"
    ? [
      ["appointment-followup-need", "need", "NEXT_STEPS", "plan", t("Help me understand the next steps", "Ayúdeme a entender los próximos pasos", "Ede m konprann pwochen etap yo")],
      ["appointment-followup-need", "need", "MEDICATION", "pill", t("I have a medication question", "Tengo una pregunta sobre un medicamento", "Mwen gen yon kesyon sou yon medikaman")],
      ["appointment-followup-need", "need", "FOLLOW_UP", "calendarClock", t("I need a follow-up visit", "Necesito una visita de seguimiento", "Mwen bezwen yon vizit swivi")],
      ["appointment-followup-need", "need", "GOAL", "goals", t("I want to update my goal", "Quiero actualizar mi meta", "Mwen vle mete objektif mwen ajou")],
      ["appointment-followup-need", "need", "NOTHING", "check", t("Nothing right now", "Nada por ahora", "Anyen pou kounye a")]
    ]
    : step === "MISSED"
      ? [
        ["appointment-followup-reschedule", "answer", "YES", "calendarClock", t("Yes, help me find another time", "Sí, ayúdeme a buscar otra hora", "Wi, ede m jwenn yon lòt lè")],
        ["appointment-followup-reschedule", "answer", "NOT_NOW", "clock", t("Not now", "Ahora no", "Pa kounye a")]
      ]
      : [
        ["appointment-followup-attendance", "outcome", "ATTENDED", "check", t("Yes", "Sí", "Wi")],
        ["appointment-followup-attendance", "outcome", "MISSED", "info", t("No", "No", "Non")],
        ["appointment-followup-attendance", "outcome", "RESCHEDULED", "calendarClock", t("It was moved to another day", "Se cambió a otro día", "Yo te chanje l pou yon lòt jou")]
      ];
  const question = step === "ATTENDED"
    ? t("Is there anything from the visit you need help with?", "¿Hay algo de la visita con lo que necesite ayuda?", "Èske gen yon bagay nan vizit la ou bezwen èd avè l?")
    : step === "MISSED"
      ? t("Would you like help finding another time?", "¿Quiere ayuda para buscar otra hora?", "Èske ou vle èd pou jwenn yon lòt lè?")
      : t(`Were you able to attend your appointment with ${provider}?`, `¿Pudo asistir a su cita con ${provider}?`, `Èske ou te ka ale nan randevou ou ak ${provider}?`);
  return `<div class="appointment-screen appointment-followup-screen">
    ${screenTitle(props, question, "", t("Appointment", "Cita", "Randevou"))}
    <div class="appointment-choices">${choices.map(([action, key, value, name, label]) => `<button type="button" class="appointment-choice" data-action="${action}" data-appointment-id="${id}" data-${key}="${value}">${glyph(name)}<span>${esc(label)}</span></button>`).join("")}</div>
    ${askEmmiButton(props, appointment.id)}
  </div>`;
}

/* ------------------------------------------------------------------------ §26-§30 -------- */

const preferenceChoice = (props, { field, value, glyphName, label, needId }) => {
  const esc = escaper(props);
  return `<button type="button" class="appointment-choice" data-action="appointment-preference-answer" data-need-id="${esc(needId)}" data-field="${esc(field)}" data-value="${esc(value)}">${glyphName ? iconOf(props)(glyphName) : ""}<span>${esc(label)}</span></button>`;
};

// §25/§26: never a form with ten fields. Exactly one question is rendered per step.
export function appointmentPreferenceView(props = {}) {
  const draft = props.draft || {};
  const locale = localeOf(props);
  const esc = escaper(props);
  const glyph = iconOf(props);
  const t = say(locale);
  const needId = props.appointment?.id || draft.needId || "";
  const step = APPOINTMENT_PREFERENCE_STEPS.includes(props.step) ? props.step : "REASON";
  const provider = draft.providerDisplayName || "";
  const back = `<button type="button" class="appointment-inline-link" data-action="appointment-preference-back" data-need-id="${esc(needId)}" data-step="${esc(step)}">${glyph("arrowLeft")}<span>${t("Go back", "Volver", "Retounen")}</span></button>`;

  if (step === "PROVIDER") {
    const question = provider
      ? t(`Is this for ${provider}?`, `¿Es para ${provider}?`, `Èske sa a se pou ${provider}?`)
      : t("Who would you like to see?", "¿A quién le gustaría ver?", "Ki moun ou ta renmen wè?");
    // A name on its own does not say who someone is. Doctors carry a specialty; the care manager
    // and the nurse carry none, so they were offered as a bare name next to two labelled doctors.
    const options = (Array.isArray(props.careTeam) ? props.careTeam : []).filter(Boolean);
    return `<div class="appointment-screen appointment-preference-screen" data-step="PROVIDER">
      ${screenTitle(props, question, "", t("Appointment", "Cita", "Randevou"))}
      <div class="appointment-choices">
        ${provider ? preferenceChoice(props, { field: "requestedProfessionalId", value: draft.requestedProfessionalId || "", glyphName: "check", label: t("Yes, that’s right", "Sí, así es", "Wi, se sa"), needId }) : ""}
        ${options.map(member => preferenceChoice(props, { field: "requestedProfessionalId", value: member.id, glyphName: "doctor", label: [member.displayName, member.specialty || member.roleLabel].filter(Boolean).join(" · "), needId })).join("")}
        ${preferenceChoice(props, { field: "requestedProfessionalId", value: "", glyphName: "question", label: t("Someone else", "Otra persona", "Yon lòt moun"), needId })}
      </div>
      ${back}
    </div>`;
  }

  if (step === "REASON") {
    // Every reason an office can actually be booked for has to be reachable by tapping, or the
    // capability resolver refuses a visit the patient had no way to ask for.
    const reasons = ["ROUTINE_FOLLOW_UP", "MEDICATION_RENEWAL", "BLOOD_PRESSURE_FOLLOW_UP", "LAB_OR_TEST", "CARE_PLAN_REVIEW", "SYMPTOM_REVIEW", "DEVICE_SUPPORT", "OTHER"];
    return `<div class="appointment-screen appointment-preference-screen" data-step="REASON">
      ${screenTitle(props, t("What would you like to be seen for?", "¿Para qué le gustaría que la vieran?", "Pou kisa ou ta renmen yo wè w?"), "", t("Appointment", "Cita", "Randevou"))}
      <div class="appointment-choices">${reasons.map(value => preferenceChoice(props, { field: "reasonCategory", value, glyphName: "question", label: reasonLabel(value, locale), needId })).join("")}</div>
      ${back}
    </div>`;
  }

  if (step === "MODALITY") {
    // §30: unavailable modalities are never shown. The source must be a resolved capability's
    // supportedModalities array — the APPOINTMENT_MODALITY enum object is deliberately ignored,
    // because an enum is a vocabulary, not a statement about what this provider supports.
    const candidates = [props.supportedModalities, props.capability?.supportedModalities, draft.supportedModalities, props.modalities].find(Array.isArray) || [];
    const supported = candidates.filter(value => ["IN_PERSON", "TELEHEALTH", "PHONE"].includes(value));
    const glyphFor = { IN_PERSON: "hospital", TELEHEALTH: "video", PHONE: "phone" };
    return `<div class="appointment-screen appointment-preference-screen" data-step="MODALITY">
      ${screenTitle(props, t("How would you like this visit to happen?", "¿Cómo le gustaría que fuera esta visita?", "Kijan ou ta renmen vizit sa a fèt?"), "", t("Appointment", "Cita", "Randevou"))}
      <div class="appointment-choices">
        ${supported.map(value => preferenceChoice(props, { field: "preferredModality", value, glyphName: glyphFor[value], label: modalityLabel(value, locale), needId })).join("")}
        ${preferenceChoice(props, { field: "preferredModality", value: "NO_PREFERENCE", glyphName: "question", label: t("No preference", "Sin preferencia", "Pa gen preferans"), needId })}
      </div>
      ${supported.length ? "" : `<p class="appointment-note">${glyph("info")}<span>${t("Your care team will confirm how this visit can happen.", "Su equipo de cuidado confirmará cómo puede ser esta visita.", "Ekip swen ou ap konfime kijan vizit sa a ka fèt.")}</span></p>`}
      ${back}
    </div>`;
  }

  if (step === "TIME_OF_DAY") {
    // §29: morning, afternoon, no preference, and a way out. No time-range picker.
    return `<div class="appointment-screen appointment-preference-screen" data-step="TIME_OF_DAY">
      ${screenTitle(props, t("Do mornings or afternoons usually work better?", "¿Le funcionan mejor las mañanas o las tardes?", "Èske maten oswa aprèmidi pi bon pou ou?"), "", t("Appointment", "Cita", "Randevou"))}
      <div class="appointment-choices">
        ${["MORNING", "AFTERNOON", "NO_PREFERENCE"].map(value => preferenceChoice(props, { field: "preferredTimeOfDay", value, glyphName: "clock", label: timeOfDayLabel(value, locale), needId })).join("")}
      </div>
      <button type="button" class="appointment-inline-link" data-action="appointment-preference-other-time" data-need-id="${esc(needId)}">${t("Choose another time", "Elegir otro horario", "Chwazi yon lòt lè")} ${glyph("arrowRight")}</button>
      ${back}
    </div>`;
  }

  // REVIEW. §80/§127: a draft is never auto-submitted, and the button is gated, not the submit.
  const submittable = props.submittable || draft.submittable || {};
  const ready = submittable.ok !== false;
  const missing = Array.isArray(submittable.missing) ? submittable.missing : [];
  const missingLabel = {
    reasonCategory: t("what you want to be seen for", "para qué quiere que la vean", "pou kisa ou vle yo wè w"),
    requestedProfessionalId: t("who you want to see", "a quién quiere ver", "ki moun ou vle wè"),
    preferredModality: t("how the visit should happen", "cómo debe ser la visita", "kijan vizit la dwe fèt"),
    preferredTimeOfDay: t("what time of day works", "qué momento del día le sirve", "ki lè nan jounen an ki bon")
  };
  const rows = [
    draft.providerDisplayName ? [t("Who", "Con quién", "Ak ki moun"), draft.providerDisplayName] : null,
    draft.requestedSpecialty ? [t("Specialty", "Especialidad", "Espesyalite"), draft.requestedSpecialty] : null,
    draft.reasonCategory ? [t("Reason", "Motivo", "Rezon"), reasonLabel(draft.reasonCategory, locale)] : null,
    draft.preferredModality ? [t("Visit type", "Tipo de visita", "Kalite vizit"), modalityLabel(draft.preferredModality, locale)] : null,
    draft.preferredTimeOfDay ? [t("Preferred time", "Horario preferido", "Lè ou pito"), timeOfDayLabel(draft.preferredTimeOfDay, locale)] : null
  ].filter(Boolean);
  return `<div class="appointment-screen appointment-preference-screen" data-step="REVIEW">
    ${screenTitle(props, t("Ready to send", "Listo para enviar", "Pare pou voye"), t("This is what your care team will see. Nothing is scheduled yet.", "Esto es lo que verá su equipo de cuidado. Todavía no hay nada programado.", "Se sa ekip swen ou ap wè. Poko gen anyen ki pwograme."), t("Appointment", "Cita", "Randevou"))}
    <dl class="appointment-facts">${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>
    ${ready ? "" : `<p class="appointment-note" data-tone="ACTION_NEEDED">${glyph("alert")}<span>${esc(`${t("We still need", "Todavía necesitamos", "Nou bezwen toujou")}: ${missing.map(key => missingLabel[key] || key).join(", ")}`)}</span></p>`}
    <button type="button" class="appointment-action primary" data-action="appointment-submit-request" data-need-id="${esc(needId)}" ${ready ? "" : "disabled"}>${glyph("arrowRight")}<span>${t("Send this to my care team", "Enviar esto a mi equipo de cuidado", "Voye sa bay ekip swen mwen")}</span></button>
    ${back}
  </div>`;
}
