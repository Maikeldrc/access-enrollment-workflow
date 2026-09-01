// Three things a patient can say about a visit, and nothing more:
//
//   APPOINTMENT_STATUS  "when is my appointment?"      → read what is already on file
//   APPOINTMENT_CHANGE  "I need to move it" / "cancel" → reschedule or cancel, always confirmed
//   APPOINTMENT_NEED    "I need to see my doctor"      → open a request
//
// What this module deliberately does not do: decide urgency, name a provider, read a date out of a
// number, or treat a reason for missing a visit as a reason to cancel one. A sentence carrying a
// clinical signal is not an appointment intent at all, so no caller can reach a scheduling flow
// through this function while the patient is describing how they feel (spec §3, §4, §5, §139).

export const APPOINTMENT_INTENTS = Object.freeze({
  APPOINTMENT_STATUS: "APPOINTMENT_STATUS",
  APPOINTMENT_CHANGE: "APPOINTMENT_CHANGE",
  APPOINTMENT_NEED: "APPOINTMENT_NEED"
});

export const APPOINTMENT_INTENT_ACTIONS = Object.freeze({
  VIEW: "VIEW",
  RESCHEDULE: "RESCHEDULE",
  CANCEL: "CANCEL",
  REQUEST: "REQUEST"
});

// Patients type curly apostrophes and speech transcription produces them, so the text is folded
// once here rather than every pattern carrying two spellings of "don't" (goalBarriers.js precedent).
const foldApostrophes = value => String(value || "").replace(/[‘’ʼ]/g, "'");
const normalize = value => foldApostrophes(value).replace(/\s+/g, " ").trim();

// state.language is lowercase en | es | ht, while the EMMI runtime still says KR for Kreyòl. Both
// spellings resolve to the same bundle rather than silently falling back to English.
export const normalizeIntentLocale = locale => {
  const value = String(locale || "en").trim().toLowerCase();
  if (value === "kr" || value === "ht" || value.startsWith("ht-")) return "ht";
  if (value === "es" || value.startsWith("es-")) return "es";
  return "en";
};

// Safety outranks scheduling. These are the same signals the barrier classifier and the text
// orchestrator already treat as clinical, repeated here so the classifier is safe on its own.
const CLINICAL_SIGNAL = /chest pain|can'?t breathe|cannot breathe|short(ness)? of breath|difficulty breathing|stroke|severe bleeding|pass(?:ed)? out|faint(?:ed|ing)?|suicid|emergency|dizzy|dizziness|dolor (fuerte )?(en el )?pecho|no puedo respirar|falta de aire|derrame|sangrado grave|me desmay|desmayo|mareo|emergencia|doul[eè] nan pwatrin|pa ka respire|konjesyon serebral|senyen anpil|endispoze|p[eè]di konesans|ijans|swisid|t[eè]t vire/i;

// A blood-pressure reading is a reading, never a date. "10/30" is 10 over 30, and a sentence that
// carries one belongs to the safety engine, not to a calendar.
const READING_SIGNAL = /\b\d{2,3}\s*(?:over|\/|sobre|sou)\s*\d{2,3}\b/;

// A gap of at most two ordinary words, so "make an appointment" and "need a doctor's appointment"
// match while "need a ride to my appointment" does not.
const GAP = "(?:[a-zà-ÿ]+['-]?[a-zà-ÿ]*\\s+){0,2}";

const CARE_PERSON = "(?:doctors?|dr\\.?|physicians?|cardiologists?|specialists?|nurses?|providers?|clinicians?|pharmacists?|care manager|pcp|primary care|m[eé]dic[oa]s?|doctora?s?|cardi[oó]log[oa]s?|especialistas?|enfermer[oa]s?|farmac[eé]utic[oa]s?|dokt[eè]|enfimy[eè]|espesyalis|kadyol[oò]g|famasyen)";

// Getting to a visit is a barrier, not a request for one (spec §8, §135). Kreyòl "machin" is a car:
// it is word-boundaried here so it can never be read as the English "machine".
const NEED_BLOCKERS = /\b(ride|lift|transportation|transport|car|bus|taxi|cab|someone to|help getting|avent[oó]n|transporte|carro|coche|autob[uú]s|alguien que|machin|taksi|otobis|moun pou)\b/i;

// A blocker only suppresses scheduling when it is the thing the patient needs ("I need a ride to
// my appointment"). Patients commonly ask for the visit first and mention the ride in the same
// breath ("Necesito una cita ... y también un Uber"). In that case the explicit appointment need
// must win so the turn opens the structured scheduler instead of falling through to generative
// chat, where no calendar result is available.
const explicitAppointmentBeforeBlocker = value => {
  const appointment = value.search(/\b(appointments?|appts?|visits?|citas?|consultas?|randevou|vizit)\b/i);
  const blocker = value.search(NEED_BLOCKERS);
  return appointment >= 0 && blocker >= 0 && appointment < blocker;
};

const STATUS_PATTERNS = [
  // EN — a question about an appointment the patient already has. "an appointment" is a request,
  // so only a possessive or definite reference counts as a status question.
  /\b(when|what time|what day|where)\b[^?.!]{0,40}\b(my|the|our)\s+(next\s+|upcoming\s+|first\s+)?(appointments?|appts?|visits?)\b/i,
  /\b(do|did|will) i have\b[^?.!]{0,20}\b(an?|any|another)\s+(appointments?|appts?|visits?)\b/i,
  /\bmy\s+(next|upcoming|first)\s+(appointments?|appts?|visits?)\b/i,
  /\b(status|state) of my\s+(appointments?|visits?|requests?)\b/i,
  /\bmy\s+(appointments?|visits?|requests?)\b[^?.!]{0,25}\b(confirmed|scheduled|booked)\b/i,
  // ES
  /\b(cu[aá]ndo|a qu[eé] hora|qu[eé] d[ií]a|d[oó]nde)\b[^?.!]{0,40}\b(mi|la|mis|las)\s+(pr[oó]xima\s+|siguiente\s+)?(citas?|consultas?)\b/i,
  /\b(tengo|tendr[eé])\s+(alguna|una)\s+(citas?|consultas?)\b/i,
  /\bmi\s+(pr[oó]xima|siguiente)\s+(citas?|consultas?)\b/i,
  /\bestado de (mi )?(citas?|solicitud)\b/i,
  /\b(mi )?(citas?|solicitud)\b[^?.!]{0,25}\b(confirmada|confirmado)\b/i,
  // HT — the possessive follows the noun in Kreyòl, so "randevou mwen" is the definite reference.
  /(kil[eè]|ki l[eè]|ki jou|ki kote)[^?.!]{0,40}\brandevou\s+(mwen|m)\b/i,
  /\b(mwen|m) gen (yon )?randevou\b/i,
  /\bpwochen randevou\b/i,
  /\bestati randevou\b/i
];

// Rescheduling keeps the appointment and cancelling destroys it, so a sentence carrying both
// signals is read as the reschedule. Nothing here cancels anything: both actions are answered with
// an explicit confirmation question by the caller (spec §64).
const RESCHEDULE_PATTERNS = [
  /\breschedul(e|ed|ing)?\b/i,
  /\b(change|move|switch|push|shift)\b[^?.!]{0,30}\b(appointments?|appts?|visits?)\b/i,
  /\b(appointments?|appts?|visits?)\b[^?.!]{0,30}\b(to|for)\s+(another|a different|a later|an earlier)\b/i,
  /\breprogramar\b|\bcambiar de (fecha|hora)\b/i,
  /\b(cambiar|mover|adelantar|posponer|aplazar)\b[^?.!]{0,30}\b(citas?|consultas?)\b/i,
  /\b(citas?|consultas?)\b[^?.!]{0,30}\b(para|a)\s+(otro d[ií]a|otra (hora|fecha))\b/i,
  /\b(chanje|deplase|ranvwaye)\b[^?.!]{0,30}\brandevou\b/i,
  /\brandevou\b[^?.!]{0,30}\byon l[oò]t (jou|l[eè])/i
];

// Patients rarely ask to "reschedule an appointment". They say they cannot come. Every reschedule
// pattern above needs an appointment noun, so "I cannot make it that day" and "no puedo ir mañana" —
// the ordinary way to ask for a different time — reached no appointment intent at all and were
// answered from the knowledge base. These are checked after the cancel patterns, because a patient
// who says "I can't make it, I want to cancel my appointment" is cancelling, not rescheduling.
const UNABLE_TO_ATTEND = [
  /\b(can'?t|cannot|can not|unable to|won'?t be able to)\b[^?.!]{0,20}\b(make it|come in|come|attend|be there|make that|go)\b/i,
  /\bnot going to (?:be able to|make it)\b/i,
  /\bsomething came up\b/i,
  /\bno (?:puedo|podr[ée]|voy a poder)\b[^?.!]{0,20}\b(ir|asistir|venir|llegar|acudir)\b/i,
  /\bme surgi[oó] algo\b/i,
  /\bmwen pa (?:ka|pral ka)\b[^?.!]{0,20}\b(vini|ale|rive)\b/i
];
// "I can't go because I have no ride" is a barrier to solve, not a time to change. The patient has
// told us why, and moving the appointment does not address it — the barrier route does.
const ATTENDANCE_BARRIER = /\b(ride|lift|transport(ation)?|car\b|drive|driver|bus\b|taxi|uber|lyft|wheelchair|walker|way to get (?:there|to)|no one to take me|nobody to take me)\b|transporte|carro\b|quien me lleve|quién me lleve|nadie que me lleve|c[oó]mo llegar|transp[oò]|machin\b|pa gen mwayen/i;

// Every cancel pattern requires an appointment noun. "Can I cancel my enrollment?" is a question
// about the program and must never reach an appointment cancellation.
const CANCEL_PATTERNS = [
  /\bcancel(l?ed|l?ing|s)?\b[^?.!]{0,30}\b(appointments?|appts?|visits?)\b/i,
  /\b(appointments?|appts?|visits?)\b[^?.!]{0,25}\bcancel/i,
  /\b(cancelar|anular|cancelo)\b[^?.!]{0,30}\b(citas?|consultas?)\b/i,
  /\b(citas?|consultas?)\b[^?.!]{0,25}\b(cancelar|anular|cancelad|anulad)/i,
  /\b(anile|kanpe)\b[^?.!]{0,30}\brandevou\b/i,
  /\brandevou\b[^?.!]{0,25}\banile/i
];

// "Schedule" belongs to both the appointment vocabulary and the reminder vocabulary, so it only
// counts here when it is followed by an actual appointment noun. "My schedule is too busy" and
// "set a reminder for my medication schedule" are not requests for a visit.
const NEED_PATTERNS = [
  new RegExp(`\\b(need|needs|want|wants|would like|get|make|set up|schedule|book|request|arrange)\\s+${GAP}(?:an?\\s+|another\\s+|a new\\s+|the\\s+|my\\s+)?(appointments?|appts?|visits?)\\b`, "i"),
  new RegExp(`\\b(need|needs|want|wants|would like|have|got)\\s+to\\s+(?:see|visit|talk to|speak (?:to|with))\\s+(?:my|the|a|an|his|her)?\\s*${CARE_PERSON}`, "i"),
  new RegExp(`\\b(can|could|may|should)\\s+i\\s+see\\s+(?:my|the)\\s+${CARE_PERSON}`, "i"),
  new RegExp(`\\b(necesito|quiero|quisiera|me gustar[ií]a|puedo|pedir|sacar|hacer|agendar|programar|solicitar|conseguir|reservar)\\s+${GAP}(?:una\\s+|otra\\s+|la\\s+|nueva\\s+|mi\\s+)?(citas?|consultas?)\\b`, "i"),
  // Code-switching is normal in bilingual care conversations. Spanish intent still owns the turn
  // when the patient uses the familiar English noun ("necesito un appointment").
  new RegExp(`\\b(necesito|quiero|quisiera|me gustar[ií]a|puedo|pedir|sacar|hacer|agendar|programar|solicitar|conseguir|reservar)\\s+${GAP}(?:un\\s+|una\\s+|otro\\s+|otra\\s+|mi\\s+)?(appointments?|appts?|visits?)\\b`, "i"),
  new RegExp(`\\b(necesito|quiero|quisiera|tengo que|puedo)\\s+ver\\s+(?:a\\s+)?(?:mi|el|la|un|una)?\\s*${CARE_PERSON}`, "i"),
  new RegExp(`\\b(bezwen|vle|mande|pran|f[eè]|jwenn)\\s+${GAP}(?:yon l[oò]t\\s+|yon\\s+)?(randevou|vizit)\\b`, "i"),
  new RegExp(`\\b(bezwen|vle)\\s+w[eè]\\s+${CARE_PERSON}`, "i")
];

// A named professional beats a role: "Dr. Martinez" is something the care-team directory can
// resolve, "my cardiologist" is only a specialty to search by. Neither is ever treated as a fact
// about who the patient's doctor is — that stays with the directory (spec §11).
const PROVIDER_NAME = /\b(dr|dra|dokte|dokt[eè])\.?\s+([a-zà-ÿ][a-zà-ÿ'-]+)/i;
const NAME_STOPWORDS = new Set(["my", "the", "a", "an", "to", "for", "and", "about", "please", "mi", "el", "la", "un", "una", "para", "que", "mwen", "pou", "yon", "nan", "appointment", "visit", "cita", "consulta", "randevou"]);

const PROVIDER_ROLE = {
  en: /\b(?:my|the|a)\s+(cardiologist|specialist|nurse|pharmacist|care manager|primary care (?:doctor|provider)|doctor|physician|clinician|provider)\b/i,
  es: /\b(?:mi|el|la|un|una)\s+(cardi[oó]log[oa]|especialista|enfermer[oa]|farmac[eé]utic[oa]|m[eé]dic[oa]|doctora?)\b/i,
  ht: /\b(kadyol[oò]g|espesyalis|enfimy[eè]|famasyen|dokt[eè])\s+(?:mwen|m)\b/i
};

// Only named parts of the day. There is no numeric date parsing anywhere in this module, so a
// reading like "10/30" can never become a preferred date. Spanish "mañana" is left out on its own
// because it means tomorrow as often as it means morning.
const TIME_HINTS = [
  ["MORNING", /\b(?:mornings?|(?:por|en|de) la ma[ñn]ana|ma[ñn]anas|maten)\b/i],
  ["AFTERNOON", /\b(?:afternoons?|middays?|(?:por|en|de) la tarde|tardes)\b|apr[eè][ -]?midi/i],
  ["EVENING", /\b(?:evenings?|nights?|(?:por|en|de) la noche|noches)\b|asw[eè]/i]
];

const matchesAny = (patterns, value) => patterns.some(pattern => pattern.test(value));

const providerHintFor = (value, locale) => {
  const named = value.match(PROVIDER_NAME);
  if (named && !NAME_STOPWORDS.has(named[2].toLowerCase())) return named[2];
  // The patient's own language is tried first, so a sentence that could read as two languages
  // yields the role the patient actually used.
  const order = [locale, ...["en", "es", "ht"].filter(item => item !== locale)];
  for (const key of order) {
    const role = value.match(PROVIDER_ROLE[key]);
    if (role) return role[1];
  }
  return "";
};

const timeHintFor = value => {
  const hit = TIME_HINTS.find(([, pattern]) => pattern.test(value));
  return hit ? hit[0] : "";
};

const result = (intent, action, value, locale) => ({
  intent,
  action,
  providerHint: providerHintFor(value, locale),
  timeHint: timeHintFor(value)
});

/**
 * Classify one patient utterance as an appointment intent, or as nothing at all.
 * Returns { intent, action, providerHint, timeHint } or null. `providerHint` is a surname or a
 * role word for the care-team directory to resolve; it is never a provider the product knows.
 * `timeHint` is "MORNING" | "AFTERNOON" | "EVENING" | "" — a preferred part of the day, never a date.
 */

// §41: once an appointment is what the conversation is about, the patient stops naming it.
// "Can I move it?" and "Is it confirmed?" are how people actually ask, and a stateless classifier
// sends both to the knowledge base. These apply ONLY when the caller confirms an appointment is in
// context, so a bare "cancel it" can never conjure an appointment out of nowhere.
const CONTEXTUAL_STATUS = [
  /\b(is|was) it (confirmed|set|booked|scheduled)\b/i,
  /\bwhen is it\b/i,
  /\bwhere is it\b/i,
  /\bwho is it with\b/i,
  /\bwhat time is it at\b/i,
  /\b(esta|está) (confirmada|agendada)\b/i,
  /\bcu[aá]ndo es\b/i,
  /\bd[oó]nde es\b/i,
  /\bcon qui[eé]n es\b/i,
  /\bli konfime\b/i,
  /\bkilè li ye\b/i,
  /\bkote li ye\b/i
];
const CONTEXTUAL_RESCHEDULE = [
  /\b(can i |could i |i want to |i need to )?(move|change|reschedule|push|shift) it\b/i,
  /\b(another|a different) (time|day)\b/i,
  /\b(puedo )?(mover|cambiar|reprogramar)la\b/i,
  /\botra (hora|fecha)\b/i,
  /\b(ka m )?(chanje|deplase) li\b/i
];
const CONTEXTUAL_CANCEL = [
  /\b(can i |i want to |i need to )?cancel it\b/i,
  /\b(puedo )?cancelarla\b/i,
  /\banile li\b/i
];

export function classifyAppointmentIntent(text = "", locale = "en", { contextual = false } = {}) {
  const value = normalize(text);
  if (!value) return null;
  // Nothing below this line runs while the patient is describing a symptom or a reading.
  if (CLINICAL_SIGNAL.test(value) || READING_SIGNAL.test(value)) return null;
  const language = normalizeIntentLocale(locale);
  if (matchesAny(STATUS_PATTERNS, value)) return result(APPOINTMENT_INTENTS.APPOINTMENT_STATUS, APPOINTMENT_INTENT_ACTIONS.VIEW, value, language);
  if (contextual) {
    if (matchesAny(CONTEXTUAL_RESCHEDULE, value)) return result(APPOINTMENT_INTENTS.APPOINTMENT_CHANGE, APPOINTMENT_INTENT_ACTIONS.RESCHEDULE, value, language);
    if (matchesAny(CONTEXTUAL_CANCEL, value)) return result(APPOINTMENT_INTENTS.APPOINTMENT_CHANGE, APPOINTMENT_INTENT_ACTIONS.CANCEL, value, language);
    if (matchesAny(CONTEXTUAL_STATUS, value)) return result(APPOINTMENT_INTENTS.APPOINTMENT_STATUS, APPOINTMENT_INTENT_ACTIONS.VIEW, value, language);
  }
  if (matchesAny(RESCHEDULE_PATTERNS, value)) return result(APPOINTMENT_INTENTS.APPOINTMENT_CHANGE, APPOINTMENT_INTENT_ACTIONS.RESCHEDULE, value, language);
  if (matchesAny(CANCEL_PATTERNS, value)) return result(APPOINTMENT_INTENTS.APPOINTMENT_CHANGE, APPOINTMENT_INTENT_ACTIONS.CANCEL, value, language);
  if (matchesAny(UNABLE_TO_ATTEND, value) && !ATTENDANCE_BARRIER.test(value)) return result(APPOINTMENT_INTENTS.APPOINTMENT_CHANGE, APPOINTMENT_INTENT_ACTIONS.RESCHEDULE, value, language);
  if (matchesAny(NEED_PATTERNS, value) && (!NEED_BLOCKERS.test(value) || explicitAppointmentBeforeBlocker(value))) return result(APPOINTMENT_INTENTS.APPOINTMENT_NEED, APPOINTMENT_INTENT_ACTIONS.REQUEST, value, language);
  return null;
}
