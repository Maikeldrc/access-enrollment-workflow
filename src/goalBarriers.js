// A barrier is not a note about why a patient did not do something. It is a care signal with an
// owner, a plan, and a follow-up: something is making this goal hard, here is what we tried, here
// is whether it helped, here is what happens next.
//
// The taxonomy stays small on purpose. Categories exist to decide who can help and what may
// safely be offered — never to become a second clinical vocabulary. Anything specific about one
// patient's difficulty lives in patientDescription, not in a new category.

const T = (en, es, ht) => Object.freeze({ en, es, ht });

export const localBarrierText = (value, locale = "en") =>
  (typeof value === "string" ? value : value?.[locale] || value?.en || "");

// What EMMI is allowed to do about a barrier. Every one of these orchestrates a capability the
// product already has: approved education, the goal plan, Care Circle, device support, care-team
// tasks and the safety engine.
export const INTERVENTION_TYPES = Object.freeze({
  EDUCATION: "EDUCATION",
  REMINDER: "REMINDER",
  ROUTINE_ADJUSTMENT: "ROUTINE_ADJUSTMENT",
  DEVICE_GUIDANCE: "DEVICE_GUIDANCE",
  DEVICE_SUPPORT_TASK: "DEVICE_SUPPORT_TASK",
  CARE_CIRCLE: "CARE_CIRCLE",
  PLAN_ADJUSTMENT: "PLAN_ADJUSTMENT",
  CARE_TEAM_TASK: "CARE_TEAM_TASK",
  RESOURCE_SUPPORT: "RESOURCE_SUPPORT",
  LANGUAGE_SUPPORT: "LANGUAGE_SUPPORT",
  SAFETY_ESCALATION: "SAFETY_ESCALATION",
  APPOINTMENT_COORDINATION: "APPOINTMENT_COORDINATION"
});

export const RESOLUTION_PATHS = Object.freeze({
  EMMI_SELF_SERVICE: "EMMI_SELF_SERVICE",
  EMMI_ASSISTED: "EMMI_ASSISTED",
  CARE_TEAM: "CARE_TEAM",
  CLINICAL_SAFETY: "CLINICAL_SAFETY",
  EXTERNAL_SUPPORT: "EXTERNAL_SUPPORT",
  APPOINTMENT_COORDINATION: "APPOINTMENT_COORDINATION"
});

export const BARRIER_STATUS = Object.freeze({
  SUSPECTED: "SUSPECTED",
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  WAITING_FOR_PATIENT: "WAITING_FOR_PATIENT",
  WAITING_FOR_CARE_TEAM: "WAITING_FOR_CARE_TEAM",
  RESOLVED: "RESOLVED",
  DECLINED: "DECLINED",
  CLOSED: "CLOSED"
});

export const BARRIER_SOURCES = Object.freeze({ PATIENT: "PATIENT", EMMI: "EMMI", CARE_TEAM: "CARE_TEAM", SYSTEM_SIGNAL: "SYSTEM_SIGNAL" });
export const BARRIER_OWNERS = Object.freeze({ EMMI: "EMMI", PATIENT: "PATIENT", CARE_TEAM: "CARE_TEAM", DEVICE_SUPPORT: "DEVICE_SUPPORT", CARE_COORDINATION: "CARE_COORDINATION" });
export const BARRIER_SCOPES = Object.freeze({ GOAL: "GOAL", ACTION: "ACTION", GLOBAL_CARE: "GLOBAL_CARE" });

export const RESOLUTION_OUTCOMES = Object.freeze({
  RESOLVED: "RESOLVED",
  PARTIALLY_HELPED: "PARTIALLY_HELPED",
  NOT_HELPED: "NOT_HELPED",
  NEEDS_ESCALATION: "NEEDS_ESCALATION",
  PATIENT_DECLINED: "PATIENT_DECLINED",
  NO_LONGER_RELEVANT: "NO_LONGER_RELEVANT"
});

const ACTIVE_STATUSES = [BARRIER_STATUS.SUSPECTED, BARRIER_STATUS.OPEN, BARRIER_STATUS.IN_PROGRESS, BARRIER_STATUS.WAITING_FOR_PATIENT, BARRIER_STATUS.WAITING_FOR_CARE_TEAM];

// One row per category: who owns it, what EMMI may offer in order of preference, what EMMI may
// never do about it, and whether the safety engine has to look at it before any coaching happens.
// `label` is what the patient reads when choosing; it is a difficulty in their words, never the
// category name.
export const BARRIER_CATEGORIES = Object.freeze({
  UNDERSTANDING: {
    icon: "book",
    scope: BARRIER_SCOPES.GOAL,
    owner: BARRIER_OWNERS.EMMI,
    interventions: [INTERVENTION_TYPES.EDUCATION, INTERVENTION_TYPES.CARE_TEAM_TASK],
    label: T("I don’t understand my numbers", "No entiendo mis números", "Mwen pa konprann chif mwen yo"),
    summary: T("Understanding my readings", "Entender mis lecturas", "Konprann lekti mwen yo")
  },
  FORGETFULNESS_ROUTINE: {
    icon: "bell",
    scope: BARRIER_SCOPES.ACTION,
    owner: BARRIER_OWNERS.EMMI,
    interventions: [INTERVENTION_TYPES.REMINDER, INTERVENTION_TYPES.ROUTINE_ADJUSTMENT, INTERVENTION_TYPES.CARE_CIRCLE, INTERVENTION_TYPES.CARE_TEAM_TASK],
    label: T("I forget to do it", "Se me olvida hacerlo", "Mwen bliye fè l"),
    summary: T("Remembering this step", "Recordar este paso", "Sonje etap sa a")
  },
  DEVICE_TECHNOLOGY: {
    icon: "activity",
    scope: BARRIER_SCOPES.ACTION,
    owner: BARRIER_OWNERS.EMMI,
    // Guidance first, then a person who can actually fix it. Repeated failed attempts are not a
    // reason to keep coaching.
    interventions: [INTERVENTION_TYPES.DEVICE_GUIDANCE, INTERVENTION_TYPES.DEVICE_SUPPORT_TASK, INTERVENTION_TYPES.CARE_CIRCLE],
    label: T("I have trouble with my monitor", "Tengo problemas con mi monitor", "Mwen gen pwoblèm ak monitè mwen"),
    summary: T("Using my monitor", "Usar mi monitor", "Sèvi ak monitè mwen")
  },
  MEDICATION_UNDERSTANDING: {
    icon: "pill",
    scope: BARRIER_SCOPES.GOAL,
    owner: BARRIER_OWNERS.EMMI,
    interventions: [INTERVENTION_TYPES.EDUCATION, INTERVENTION_TYPES.CARE_TEAM_TASK],
    prohibited: ["MEDICATION_CHANGE_BY_EMMI"],
    label: T("I have questions about my medications", "Tengo dudas sobre mis medicamentos", "Mwen gen kesyon sou medikaman mwen"),
    summary: T("Questions about my medications", "Dudas sobre mis medicamentos", "Kesyon sou medikaman mwen")
  },
  // A concern about how a medicine makes the patient feel is never an education problem. It goes
  // to people who can act on it, and EMMI may not touch the medicine itself.
  MEDICATION_CONCERN: {
    icon: "pill",
    scope: BARRIER_SCOPES.GOAL,
    owner: BARRIER_OWNERS.CARE_TEAM,
    requiresSafetyEvaluation: true,
    interventions: [INTERVENTION_TYPES.CARE_TEAM_TASK],
    prohibited: ["MEDICATION_CHANGE_BY_EMMI", INTERVENTION_TYPES.REMINDER],
    label: T("A medicine is making me feel unwell", "Un medicamento me hace sentir mal", "Yon medikaman fè m santi m mal"),
    summary: T("How a medicine makes me feel", "Cómo me hace sentir un medicamento", "Kijan yon medikaman fè m santi")
  },
  MOTIVATION: {
    icon: "smile",
    scope: BARRIER_SCOPES.GOAL,
    owner: BARRIER_OWNERS.EMMI,
    interventions: [INTERVENTION_TYPES.PLAN_ADJUSTMENT, INTERVENTION_TYPES.CARE_CIRCLE, INTERVENTION_TYPES.CARE_TEAM_TASK],
    label: T("It’s hard to stay with it", "Me cuesta mantenerlo", "Li difisil pou m kontinye"),
    summary: T("Staying with my plan", "Mantener mi plan", "Kontinye ak plan mwen")
  },
  TIME_ROUTINE: {
    icon: "clock",
    scope: BARRIER_SCOPES.ACTION,
    owner: BARRIER_OWNERS.EMMI,
    interventions: [INTERVENTION_TYPES.ROUTINE_ADJUSTMENT, INTERVENTION_TYPES.PLAN_ADJUSTMENT, INTERVENTION_TYPES.CARE_TEAM_TASK],
    label: T("Some steps don’t fit my day", "Algunos pasos no encajan en mi día", "Kèk etap pa antre nan jounen mwen"),
    summary: T("Fitting this into my day", "Encajarlo en mi día", "Fè sa antre nan jounen mwen")
  },
  PHYSICAL_LIMITATION: {
    icon: "person",
    scope: BARRIER_SCOPES.GOAL,
    owner: BARRIER_OWNERS.CARE_TEAM,
    requiresSafetyEvaluation: true,
    interventions: [INTERVENTION_TYPES.PLAN_ADJUSTMENT, INTERVENTION_TYPES.CARE_TEAM_TASK],
    label: T("It’s physically hard for me", "Me resulta difícil físicamente", "Li difisil fizikman pou mwen"),
    summary: T("Doing this comfortably", "Hacerlo con comodidad", "Fè sa alèz")
  },
  NUTRITION: {
    icon: "nutrition",
    scope: BARRIER_SCOPES.GOAL,
    owner: BARRIER_OWNERS.EMMI,
    interventions: [INTERVENTION_TYPES.EDUCATION, INTERVENTION_TYPES.CARE_TEAM_TASK],
    label: T("I’m not sure about food choices", "No sé bien qué comer", "Mwen pa sèten sou chwa manje"),
    summary: T("Food and salt", "Comidas y sal", "Manje ak sèl")
  },
  EQUIPMENT_ACCESS: {
    icon: "box",
    scope: BARRIER_SCOPES.ACTION,
    owner: BARRIER_OWNERS.DEVICE_SUPPORT,
    interventions: [INTERVENTION_TYPES.DEVICE_SUPPORT_TASK, INTERVENTION_TYPES.CARE_TEAM_TASK],
    label: T("I don’t have what I need", "No tengo lo que necesito", "Mwen pa gen sa m bezwen"),
    summary: T("Getting what I need", "Conseguir lo que necesito", "Jwenn sa m bezwen")
  },
  FINANCIAL: {
    icon: "info",
    scope: BARRIER_SCOPES.GLOBAL_CARE,
    owner: BARRIER_OWNERS.CARE_TEAM,
    interventions: [INTERVENTION_TYPES.RESOURCE_SUPPORT, INTERVENTION_TYPES.CARE_TEAM_TASK],
    label: T("Cost is a worry for me", "El costo me preocupa", "Pri a enkyete m"),
    summary: T("Cost of my care", "El costo de mi cuidado", "Pri swen mwen")
  },
  TRANSPORTATION: {
    icon: "car",
    scope: BARRIER_SCOPES.GLOBAL_CARE,
    owner: BARRIER_OWNERS.CARE_COORDINATION,
    interventions: [INTERVENTION_TYPES.RESOURCE_SUPPORT, INTERVENTION_TYPES.CARE_CIRCLE, INTERVENTION_TYPES.CARE_TEAM_TASK],
    label: T("Getting there is hard", "Me cuesta llegar", "Li difisil pou m rive"),
    summary: T("Getting to my care", "Llegar a mi cuidado", "Rive nan swen mwen")
  },
  SOCIAL_SUPPORT: {
    icon: "people",
    scope: BARRIER_SCOPES.GOAL,
    owner: BARRIER_OWNERS.EMMI,
    interventions: [INTERVENTION_TYPES.CARE_CIRCLE, INTERVENTION_TYPES.CARE_TEAM_TASK],
    label: T("I need someone to help me", "Necesito que alguien me ayude", "Mwen bezwen yon moun ede m"),
    summary: T("Having someone to help", "Contar con ayuda", "Gen yon moun pou ede m")
  },
  LANGUAGE_COMMUNICATION: {
    icon: "language",
    scope: BARRIER_SCOPES.GLOBAL_CARE,
    owner: BARRIER_OWNERS.EMMI,
    interventions: [INTERVENTION_TYPES.LANGUAGE_SUPPORT, INTERVENTION_TYPES.CARE_TEAM_TASK],
    label: T("I’d rather use another language", "Prefiero usar otro idioma", "Mwen ta pito sèvi ak yon lòt lang"),
    summary: T("Reading this in my language", "Leerlo en mi idioma", "Li sa nan lang mwen")
  },
  ACCESS_TO_CARE: {
    icon: "doctor",
    scope: BARRIER_SCOPES.GLOBAL_CARE,
    owner: BARRIER_OWNERS.CARE_COORDINATION,
    interventions: [INTERVENTION_TYPES.CARE_TEAM_TASK],
    label: T("I can’t reach my doctor", "No consigo comunicarme con mi médico", "Mwen pa ka jwenn doktè mwen"),
    summary: T("Reaching my care", "Comunicarme con mi cuidado", "Jwenn swen mwen")
  },
  // Recognised, captured and handed to the care team today. The scheduling module that will own
  // it later reads the same record — see APPOINTMENT_REQUEST_FIELDS.
  APPOINTMENT_NEED: {
    icon: "calendar",
    scope: BARRIER_SCOPES.GLOBAL_CARE,
    owner: BARRIER_OWNERS.CARE_COORDINATION,
    interventions: [INTERVENTION_TYPES.APPOINTMENT_COORDINATION, INTERVENTION_TYPES.CARE_TEAM_TASK],
    label: T("I need an appointment", "Necesito una cita", "Mwen bezwen yon randevou"),
    summary: T("Seeing my care team", "Ver a mi equipo", "Wè ekip swen mwen")
  },
  CLINICAL_SYMPTOM: {
    icon: "heart",
    scope: BARRIER_SCOPES.GOAL,
    owner: BARRIER_OWNERS.CARE_TEAM,
    requiresSafetyEvaluation: true,
    interventions: [INTERVENTION_TYPES.SAFETY_ESCALATION],
    prohibited: [INTERVENTION_TYPES.REMINDER, INTERVENTION_TYPES.EDUCATION, INTERVENTION_TYPES.ROUTINE_ADJUSTMENT],
    label: T("I’m not feeling well", "No me siento bien", "Mwen pa santi m byen"),
    summary: T("How I’m feeling", "Cómo me siento", "Kijan m santi m")
  },
  OTHER: {
    icon: "question",
    scope: BARRIER_SCOPES.GOAL,
    owner: BARRIER_OWNERS.EMMI,
    interventions: [INTERVENTION_TYPES.CARE_TEAM_TASK],
    label: T("Something else", "Otra cosa", "Yon lòt bagay"),
    summary: T("Something else", "Otra cosa", "Yon lòt bagay")
  }
});

export const BARRIER_CATEGORY_KEYS = Object.freeze(Object.keys(BARRIER_CATEGORIES));

// The fields a scheduling module will need on day one. They are captured now and left null when
// the patient did not volunteer them; nothing here schedules anything.
export const APPOINTMENT_REQUEST_FIELDS = Object.freeze(["requestedProfessionalType", "requestedProfessionalId", "reasonSummary", "patientPreferredTime", "urgencyClassification", "appointmentStatus"]);

export const barrierCategoryConfig = category => BARRIER_CATEGORIES[category] || BARRIER_CATEGORIES.OTHER;
export const normalizeBarrierCategory = category => (BARRIER_CATEGORIES[category] ? category : "OTHER");
export const barrierIcon = barrier => barrierCategoryConfig(barrier?.category).icon;
export const barrierIsActive = barrier => ACTIVE_STATUSES.includes(barrier?.status);
export const activeBarriers = (barriers = []) => barriers.filter(barrierIsActive);
export const confirmedActiveBarriers = (barriers = []) => activeBarriers(barriers).filter(item => item.status !== BARRIER_STATUS.SUSPECTED);

// Legacy records used a flat barrierType with a different vocabulary. They are read, not migrated,
// so a draft saved before this model still renders instead of disappearing.
const LEGACY_CATEGORY = Object.freeze({
  NOT_WELL: "CLINICAL_SYMPTOM",
  FORGET: "FORGETFULNESS_ROUTINE",
  NO_TIME: "TIME_ROUTINE",
  MEDICATION_TROUBLE: "MEDICATION_UNDERSTANDING",
  MONITOR_HELP: "DEVICE_TECHNOLOGY",
  SAFETY_WORRY: "CLINICAL_SYMPTOM",
  OTHER: "OTHER"
});

export function normalizeBarrierRecord(barrier) {
  if (!barrier) return null;
  const category = barrier.category || LEGACY_CATEGORY[barrier.barrierType] || "OTHER";
  return {
    ...barrier,
    category: normalizeBarrierCategory(category),
    status: barrier.status || BARRIER_STATUS.OPEN,
    source: barrier.source || BARRIER_SOURCES.PATIENT,
    scope: barrier.scope || barrierCategoryConfig(category).scope,
    interventions: Array.isArray(barrier.interventions) ? barrier.interventions : [],
    patientDescription: barrier.patientDescription ?? barrier.notes ?? ""
  };
}

export function createGoalBarrier({
  id = `goal_barrier_${Date.now().toString(36)}`,
  patientId = "",
  goalId = "",
  goalActionId = null,
  category = "OTHER",
  subtype = "",
  patientDescription = "",
  source = BARRIER_SOURCES.PATIENT,
  status = "",
  detectedAt = new Date().toISOString(),
  createdBy = "",
  appointmentRequest = null
} = {}) {
  const normalized = normalizeBarrierCategory(category);
  const config = barrierCategoryConfig(normalized);
  // A signal is a question, not a finding: something the system noticed opens as SUSPECTED and
  // stays that way until the patient says what is actually going on.
  const initialStatus = status || (source === BARRIER_SOURCES.SYSTEM_SIGNAL ? BARRIER_STATUS.SUSPECTED : BARRIER_STATUS.OPEN);
  return {
    id,
    patientId,
    goalId,
    goalActionId,
    category: normalized,
    subtype,
    scope: config.scope,
    patientDescription: String(patientDescription || "").slice(0, 400),
    source,
    status: initialStatus,
    owner: config.owner,
    resolutionPath: null,
    resolutionPlan: "",
    interventions: [],
    followUpAt: null,
    detectedAt,
    confirmedAt: initialStatus === BARRIER_STATUS.SUSPECTED ? null : detectedAt,
    resolvedAt: null,
    resolutionOutcome: null,
    recurrenceCount: 0,
    appointmentRequest: normalized === "APPOINTMENT_NEED" ? { requestedProfessionalType: "", requestedProfessionalId: null, reasonSummary: "", patientPreferredTime: "", urgencyClassification: "ROUTINE", appointmentStatus: "NOT_SCHEDULED", ...(appointmentRequest || {}) } : null,
    createdBy: createdBy || source,
    createdAt: detectedAt,
    updatedAt: detectedAt
  };
}

// Free text — typed or spoken — lands here, so a patient who says "I keep forgetting" and a
// patient who taps "I forget to do it" produce the same record and the same help.
const CLASSIFIERS = [
  ["CLINICAL_SYMPTOM", /chest pain|can'?t breathe|cannot breathe|short(ness)? of breath|passed out|faint|bleeding|stroke|dolor (en el |fuerte en el )?pecho|no puedo respirar|falta de aire|desmay|sangrado|derrame|doulè nan pwatrin|pa ka respire|endispoze|san ap koule/i],
  ["MEDICATION_CONCERN", /(medicine|medication|pill).*(makes? me|feel|side effect|bad|sick|dizzy|tired)|side effects?|(no estoy tomando|dej[eé] de tomar).*(medicina|medicamento)|(medicina|medicamento).*(me hace|me siento|efecto secundario|mal|mareo)|(medikaman).*(fè m|santi|efè|mal)/i],
  ["CLINICAL_SYMPTOM", /dizzy|dizziness|swelling|feel (very )?(bad|unwell|sick)|not feeling well|mareo|mareada|hinchaz[oó]n|me siento (muy )?mal|no me siento bien|tèt vire|anfle|mwen pa santi m byen/i],
  ["APPOINTMENT_NEED", /appointment|see my (doctor|cardiologist|specialist|nurse)|need to see|schedule.*(visit|doctor)|cita|ver a mi (m[eé]dico|cardi[oó]logo|especialista)|necesito ver|randevou|wè doktè|bezwen wè/i],
  ["ACCESS_TO_CARE", /can'?t reach (my )?doctor|no one answers|nobody answers|can'?t get (through|an appointment)|no consigo (hablar|comunicarme)|no me contestan|mwen pa ka jwenn doktè|pèsonn pa reponn/i],
  ["TRANSPORTATION", /\bride\b|drive me|get there|transportation|\bbus\b|no car|no tengo (quien me lleve|carro|transporte)|c[oó]mo llegar|transporte|mwen pa gen mou?n pou mennen m|\btransp[oò]\b|\bmachin\b/i],
  ["DEVICE_TECHNOLOGY", /monitor|cuff|device|machine|blood pressure (machine|monitor)|doesn'?t work|won'?t turn on|can'?t get it to work|monitor|aparato|tensi[oó]metro|brazalete|no funciona|no sirve|no s[eé] usar|monitè|aparèy|manchèt|pa mache|pa konn sèvi/i],
  ["EQUIPMENT_ACCESS", /don'?t have a (monitor|machine|cuff|scale)|need a (monitor|machine|cuff)|no tengo (monitor|aparato|tensi[oó]metro)|necesito un (monitor|aparato)|mwen pa gen (monitè|aparèy)|bezwen yon monitè/i],
  ["FORGETFULNESS_ROUTINE", /forget|forgot|remember|slips my mind|olvid|se me pasa|recordar|bliye|sonje/i],
  ["UNDERSTANDING", /don'?t understand|do not understand|what does .* mean|confus|not sure what.*means|no entiendo|qu[eé] significa|no s[eé] qu[eé] quiere decir|mwen pa konprann|kisa .* vle di/i],
  ["MEDICATION_UNDERSTANDING", /what is (this|my) (medicine|medication|pill) for|why (do i|am i) tak(e|ing)|para qu[eé] es (esta|mi) (medicina|medicamento)|por qu[eé] tomo|pou kisa medikaman/i],
  ["NUTRITION", /salt|sodium|eat|diet|food|meal|sal|sodio|comer|dieta|comida|manje|sèl|rejim/i],
  ["SOCIAL_SUPPORT", /someone to help|need help from|my (daughter|son|wife|husband|family)|live alone|alguien que me ayude|necesito ayuda de|mi (hija|hijo|esposa|esposo|familia)|vivo solo|yon moun pou ede m|pitit (fi|gason) mwen|fanmi mwen|mwen rete pou kont mwen/i],
  ["FINANCIAL", /afford|too expensive|cost too much|no money|pay for|no puedo pagar|muy caro|cuesta mucho|no tengo dinero|mwen pa ka peye|twò chè|lajan/i],
  ["LANGUAGE_COMMUNICATION", /in (spanish|creole|english)|don'?t (speak|read) english|prefer (spanish|creole)|en espa[ñn]ol|no hablo ingl[eé]s|prefiero espa[ñn]ol|an kreyòl|mwen pa pale angle/i],
  ["PHYSICAL_LIMITATION", /can'?t walk|hard to (walk|stand|bend|reach)|too weak|pain in my|arthritis|no puedo caminar|me cuesta (caminar|pararme)|debilidad|artritis|dolor en (mi|el)|mwen pa ka mache|difisil pou m mache|feblès|doulè nan/i],
  ["TIME_ROUTINE", /no time|too busy|doesn'?t fit|schedule|no tengo tiempo|muy ocupad|no me da tiempo|horario|mwen pa gen tan|twò okipe|orè/i],
  ["MOTIVATION", /give up|gave up|discouraged|hard to keep|don'?t feel like|no motivation|me rindo|desanimad|me cuesta seguir|no tengo ganas|mwen dekouraje|difisil pou m kontinye|mwen pa anvi/i]
];

// Order matters: safety and medication concerns are matched before the everyday difficulties they
// can hide behind, so "the pill makes me dizzy" never lands on UNDERSTANDING.
// Patients type curly apostrophes and speech transcription produces them, so the text is folded
// once here rather than every pattern carrying two spellings of "don't".
const foldApostrophes = value => String(value || "").replace(/[‘’ʼ]/g, "'");

export function classifyBarrierText(text = "") {
  const value = foldApostrophes(text).trim();
  if (!value) return { category: "", confidence: "NONE", matched: false };
  const hit = CLASSIFIERS.find(([, pattern]) => pattern.test(value));
  if (!hit) return { category: "OTHER", confidence: "LOW", matched: false };
  return { category: hit[0], confidence: "MEDIUM", matched: true };
}

// The list a patient chooses from is built from their own goal, plan and equipment. A goal with no
// monitor never offers a monitor problem; a goal with no medication step never asks about pills.
export function barrierOptionsFor({ goal = null, hasDevice = false, hasMedications = false, locale = "en" } = {}) {
  const actions = goal?.actions || [];
  const hasTemplate = templateId => actions.some(action => action.templateId === templateId);
  const measures = hasTemplate("check-bp") || goal?.goalType === "BLOOD_PRESSURE_CONTROL";
  const keys = [
    measures ? "FORGETFULNESS_ROUTINE" : null,
    measures && (hasDevice || goal?.goalType === "BLOOD_PRESSURE_CONTROL") ? "DEVICE_TECHNOLOGY" : null,
    measures ? "UNDERSTANDING" : null,
    hasTemplate("medications-as-directed") || hasMedications ? "MEDICATION_UNDERSTANDING" : null,
    hasTemplate("reduce-salt") ? "NUTRITION" : null,
    hasTemplate("be-active") || goal?.goalType === "STAY_ACTIVE" ? "PHYSICAL_LIMITATION" : null,
    !measures ? "FORGETFULNESS_ROUTINE" : null,
    "TIME_ROUTINE",
    "SOCIAL_SUPPORT",
    "CLINICAL_SYMPTOM",
    "OTHER"
  ].filter(Boolean);
  // Deduplicate while preserving order, then cap the list: a patient reading nine options on a
  // 384px screen is a questionnaire, not a question.
  const unique = [...new Set(keys)];
  const ordered = [...unique.filter(key => !["CLINICAL_SYMPTOM", "OTHER"].includes(key)).slice(0, 6), "CLINICAL_SYMPTOM", "OTHER"];
  return ordered.map(key => ({
    category: key,
    icon: barrierCategoryConfig(key).icon,
    label: localBarrierText(barrierCategoryConfig(key).label, locale)
  }));
}

const interventionOf = (barrier, type) => (barrier.interventions || []).filter(item => item.type === type);

// An intervention that has already been tried and did not help is not offered again. That is the
// whole difference between coaching and nagging.
const interventionExhausted = (barrier, type) =>
  interventionOf(barrier, type).some(item => [RESOLUTION_OUTCOMES.NOT_HELPED, RESOLUTION_OUTCOMES.PATIENT_DECLINED, RESOLUTION_OUTCOMES.NEEDS_ESCALATION].includes(item.outcome));

const PATH_BY_INTERVENTION = Object.freeze({
  [INTERVENTION_TYPES.EDUCATION]: RESOLUTION_PATHS.EMMI_SELF_SERVICE,
  [INTERVENTION_TYPES.REMINDER]: RESOLUTION_PATHS.EMMI_SELF_SERVICE,
  [INTERVENTION_TYPES.ROUTINE_ADJUSTMENT]: RESOLUTION_PATHS.EMMI_SELF_SERVICE,
  [INTERVENTION_TYPES.DEVICE_GUIDANCE]: RESOLUTION_PATHS.EMMI_SELF_SERVICE,
  [INTERVENTION_TYPES.LANGUAGE_SUPPORT]: RESOLUTION_PATHS.EMMI_SELF_SERVICE,
  [INTERVENTION_TYPES.CARE_CIRCLE]: RESOLUTION_PATHS.EMMI_ASSISTED,
  [INTERVENTION_TYPES.PLAN_ADJUSTMENT]: RESOLUTION_PATHS.EMMI_ASSISTED,
  [INTERVENTION_TYPES.DEVICE_SUPPORT_TASK]: RESOLUTION_PATHS.CARE_TEAM,
  [INTERVENTION_TYPES.CARE_TEAM_TASK]: RESOLUTION_PATHS.CARE_TEAM,
  [INTERVENTION_TYPES.RESOURCE_SUPPORT]: RESOLUTION_PATHS.EXTERNAL_SUPPORT,
  [INTERVENTION_TYPES.SAFETY_ESCALATION]: RESOLUTION_PATHS.CLINICAL_SAFETY,
  [INTERVENTION_TYPES.APPOINTMENT_COORDINATION]: RESOLUTION_PATHS.APPOINTMENT_COORDINATION
});

// How long before EMMI asks whether it helped. Education answers itself immediately; a reminder
// needs a few days of real life before the question means anything.
const FOLLOW_UP_DAYS = Object.freeze({
  [INTERVENTION_TYPES.EDUCATION]: 0,
  [INTERVENTION_TYPES.DEVICE_GUIDANCE]: 0,
  [INTERVENTION_TYPES.LANGUAGE_SUPPORT]: 0,
  [INTERVENTION_TYPES.REMINDER]: 3,
  [INTERVENTION_TYPES.ROUTINE_ADJUSTMENT]: 3,
  [INTERVENTION_TYPES.PLAN_ADJUSTMENT]: 7,
  [INTERVENTION_TYPES.CARE_CIRCLE]: 3,
  [INTERVENTION_TYPES.DEVICE_SUPPORT_TASK]: 2,
  [INTERVENTION_TYPES.CARE_TEAM_TASK]: 2,
  [INTERVENTION_TYPES.RESOURCE_SUPPORT]: 5,
  [INTERVENTION_TYPES.APPOINTMENT_COORDINATION]: 2,
  [INTERVENTION_TYPES.SAFETY_ESCALATION]: 0
});

// The engine: given a barrier and what has already been tried, what may EMMI do next, who owns it,
// and does the safety engine have to look first. Nothing here is decided by a model.
export function resolveBarrier({ barrier, capabilities = {}, safetyResult = null } = {}) {
  if (!barrier) return null;
  const config = barrierCategoryConfig(barrier.category);
  const prohibited = config.prohibited || [];
  const requiresSafety = Boolean(config.requiresSafetyEvaluation);
  // Safety outranks every kind of help. A patient describing a symptom is not offered a reminder.
  if (requiresSafety && !safetyResult) {
    return { path: RESOLUTION_PATHS.CLINICAL_SAFETY, owner: BARRIER_OWNERS.CARE_TEAM, intervention: null, requiresSafetyEvaluation: true, prohibited, followUpDays: 0 };
  }
  if (safetyResult && ["EMERGENCY", "CARE_TEAM_REVIEW"].includes(safetyResult.severity)) {
    return {
      path: RESOLUTION_PATHS.CLINICAL_SAFETY,
      owner: BARRIER_OWNERS.CARE_TEAM,
      intervention: INTERVENTION_TYPES.SAFETY_ESCALATION,
      severity: safetyResult.severity,
      requiresSafetyEvaluation: false,
      prohibited,
      followUpDays: 0
    };
  }
  const available = (config.interventions || []).filter(type => {
    if (prohibited.includes(type)) return false;
    if (type === INTERVENTION_TYPES.DEVICE_GUIDANCE && capabilities.hasDevice === false) return false;
    if (type === INTERVENTION_TYPES.CARE_CIRCLE && capabilities.careCircleAvailable === false) return false;
    if (type === INTERVENTION_TYPES.LANGUAGE_SUPPORT && capabilities.additionalLanguages === false) return false;
    return !interventionExhausted(barrier, type);
  });
  const intervention = available[0] || INTERVENTION_TYPES.CARE_TEAM_TASK;
  return {
    path: PATH_BY_INTERVENTION[intervention] || RESOLUTION_PATHS.CARE_TEAM,
    owner: intervention === INTERVENTION_TYPES.CARE_TEAM_TASK ? BARRIER_OWNERS.CARE_TEAM : config.owner,
    intervention,
    requiresSafetyEvaluation: false,
    prohibited,
    exhausted: (config.interventions || []).filter(type => interventionExhausted(barrier, type)),
    followUpDays: FOLLOW_UP_DAYS[intervention] ?? 3
  };
}

const addDays = (iso, days) => {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

// Interventions accumulate; they are never overwritten. The history is what lets EMMI say "that
// did not help, let's try something else" instead of repeating itself.
export function applyIntervention(barrier, { type, detail = {}, now = new Date().toISOString(), followUpDays = null } = {}) {
  if (!barrier || !type) return barrier;
  const config = barrierCategoryConfig(barrier.category);
  if ((config.prohibited || []).includes(type)) return barrier;
  const days = followUpDays ?? FOLLOW_UP_DAYS[type] ?? 3;
  const intervention = {
    id: `barrier_intervention_${Date.now().toString(36)}_${(barrier.interventions || []).length}`,
    type,
    detail,
    startedAt: now,
    outcome: null,
    outcomeAt: null,
    followUpAt: days > 0 ? addDays(now, days) : now
  };
  const waitsForCareTeam = [INTERVENTION_TYPES.CARE_TEAM_TASK, INTERVENTION_TYPES.DEVICE_SUPPORT_TASK, INTERVENTION_TYPES.RESOURCE_SUPPORT, INTERVENTION_TYPES.APPOINTMENT_COORDINATION, INTERVENTION_TYPES.SAFETY_ESCALATION].includes(type);
  return {
    ...barrier,
    status: waitsForCareTeam ? BARRIER_STATUS.WAITING_FOR_CARE_TEAM : BARRIER_STATUS.IN_PROGRESS,
    owner: waitsForCareTeam ? (type === INTERVENTION_TYPES.DEVICE_SUPPORT_TASK ? BARRIER_OWNERS.DEVICE_SUPPORT : BARRIER_OWNERS.CARE_TEAM) : barrier.owner,
    resolutionPath: PATH_BY_INTERVENTION[type] || barrier.resolutionPath,
    confirmedAt: barrier.confirmedAt || now,
    interventions: [...(barrier.interventions || []), intervention],
    followUpAt: intervention.followUpAt,
    updatedAt: now
  };
}

// An outcome closes an intervention, not necessarily the barrier: help that did not help leaves
// the barrier open so the engine can offer the next thing.
export function recordInterventionOutcome(barrier, { interventionId = "", outcome, now = new Date().toISOString() } = {}) {
  if (!barrier || !outcome) return barrier;
  const interventions = (barrier.interventions || []).map((item, index, list) => {
    const target = interventionId ? item.id === interventionId : index === list.length - 1;
    return target && !item.outcome ? { ...item, outcome, outcomeAt: now } : item;
  });
  const resolved = outcome === RESOLUTION_OUTCOMES.RESOLVED;
  const declined = outcome === RESOLUTION_OUTCOMES.PATIENT_DECLINED;
  const closed = outcome === RESOLUTION_OUTCOMES.NO_LONGER_RELEVANT;
  return {
    ...barrier,
    interventions,
    status: resolved ? BARRIER_STATUS.RESOLVED : declined ? BARRIER_STATUS.OPEN : closed ? BARRIER_STATUS.CLOSED : BARRIER_STATUS.OPEN,
    resolutionOutcome: resolved || closed ? outcome : null,
    resolvedAt: resolved || closed ? now : null,
    followUpAt: resolved || closed ? null : barrier.followUpAt,
    updatedAt: now
  };
}

// The patient said yes: a suspicion becomes a confirmed difficulty, in their words.
export function confirmBarrier(barrier, { patientDescription = "", category = "", now = new Date().toISOString() } = {}) {
  if (!barrier) return barrier;
  const nextCategory = category ? normalizeBarrierCategory(category) : barrier.category;
  return {
    ...barrier,
    category: nextCategory,
    scope: barrierCategoryConfig(nextCategory).scope,
    status: barrier.status === BARRIER_STATUS.SUSPECTED ? BARRIER_STATUS.OPEN : barrier.status,
    source: barrier.status === BARRIER_STATUS.SUSPECTED ? BARRIER_SOURCES.PATIENT : barrier.source,
    patientDescription: patientDescription ? String(patientDescription).slice(0, 400) : barrier.patientDescription,
    confirmedAt: barrier.confirmedAt || now,
    updatedAt: now
  };
}

// Mentioning the same difficulty twice is one barrier with more context, not two barriers. A
// difficulty that comes back after being resolved reopens with its history intact.
export function findReusableBarrier(barriers = [], { category, goalId = "", goalActionId = null } = {}) {
  const matches = barriers.filter(item =>
    item.category === category &&
    (item.scope === BARRIER_SCOPES.GLOBAL_CARE || item.goalId === goalId) &&
    (!goalActionId || !item.goalActionId || item.goalActionId === goalActionId));
  return matches.find(barrierIsActive) || matches.find(item => item.status === BARRIER_STATUS.RESOLVED) || null;
}

export function reopenBarrier(barrier, { patientDescription = "", now = new Date().toISOString() } = {}) {
  if (!barrier) return barrier;
  return {
    ...barrier,
    status: BARRIER_STATUS.OPEN,
    resolutionOutcome: null,
    resolvedAt: null,
    recurrenceCount: (barrier.recurrenceCount || 0) + 1,
    patientDescription: patientDescription ? String(patientDescription).slice(0, 400) : barrier.patientDescription,
    updatedAt: now
  };
}

// What the patient reads about state. Never OPEN, never WAITING_FOR_CARE_TEAM, never a status the
// product invented for its own bookkeeping.
export const BARRIER_PATIENT_STATUS = Object.freeze({
  SUSPECTED: T("EMMI has a question about this", "EMMI tiene una pregunta sobre esto", "EMMI gen yon kesyon sou sa"),
  OPEN: T("Needs your attention", "Necesita su atención", "Bezwen atansyon ou"),
  IN_PROGRESS: T("We’re working on this", "Estamos trabajando en esto", "N ap travay sou sa"),
  WAITING_FOR_PATIENT: T("EMMI is waiting for your answer", "EMMI espera su respuesta", "EMMI ap tann repons ou"),
  WAITING_FOR_CARE_TEAM: T("Waiting for your care team", "Esperando a su equipo de atención", "N ap tann ekip swen ou"),
  RESOLVED: T("Resolved", "Resuelto", "Rezoud"),
  DECLINED: T("Not now", "Ahora no", "Pa kounye a"),
  CLOSED: T("Closed", "Cerrado", "Fèmen")
});

export const barrierPatientStatus = (barrier, locale = "en") =>
  localBarrierText(BARRIER_PATIENT_STATUS[barrier?.status] || BARRIER_PATIENT_STATUS.OPEN, locale);

export const barrierPatientSummary = (barrier, locale = "en") =>
  localBarrierText(barrierCategoryConfig(barrier?.category).summary, locale);

// Analytics never carry what the patient wrote or said. Category, source and timing are enough to
// answer every KPI this module exists to support.
export function barrierAnalytics(barrier) {
  if (!barrier) return {};
  const resolvedIn = barrier.resolvedAt && barrier.detectedAt
    ? Math.round((new Date(barrier.resolvedAt) - new Date(barrier.detectedAt)) / 3600000)
    : null;
  return {
    barrierId: barrier.id,
    category: barrier.category,
    source: barrier.source,
    status: barrier.status,
    owner: barrier.owner,
    resolutionPath: barrier.resolutionPath,
    interventionCount: (barrier.interventions || []).length,
    lastIntervention: (barrier.interventions || []).at(-1)?.type || null,
    outcome: barrier.resolutionOutcome,
    recurrenceCount: barrier.recurrenceCount || 0,
    hoursToResolution: resolvedIn
  };
}

// The structured handoff a care team receives instead of a chat transcript: the goal, the
// difficulty, what the patient said, what EMMI already tried and what is being asked for.
export function careTeamEscalationSummary({ barrier, goalTitle = "", attempts = [], request = "" } = {}) {
  if (!barrier) return null;
  return {
    goal: goalTitle,
    barrierCategory: barrier.category,
    barrierSummary: localBarrierText(barrierCategoryConfig(barrier.category).summary, "en"),
    patientDescription: barrier.patientDescription || "",
    emmiAttempts: attempts.length ? attempts : (barrier.interventions || []).map(item => ({ type: item.type, outcome: item.outcome })),
    request: request || "REVIEW",
    detectedAt: barrier.detectedAt,
    recurrenceCount: barrier.recurrenceCount || 0,
    appointmentRequest: barrier.appointmentRequest || null
  };
}
