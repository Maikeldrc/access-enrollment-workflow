import { personalGoalTemplate } from "./personalGoals.js";

const T = (en, es, ht) => Object.freeze({ en, es, ht });

// Goal iconography is category-based, never per-goal and never inferred from the goal's text:
// display names are translated and editable, so any string matching would break the moment a
// patient switches language or the copy is reworded. A goal carries a structured category, the
// category carries an icon, and anything unrecognized lands on the generic target.
//
// Keep this taxonomy small. It exists to give the patient a handful of recognizable visual
// families, not to become a second clinical vocabulary they have to learn. Categories are
// internal metadata and are never shown to the patient.
export const GOAL_ICON_REGISTRY = Object.freeze({
  CARDIOVASCULAR: "heart",
  MEDICATIONS: "pill",
  PREVENTION: "shield",
  ACTIVITY_MOBILITY: "footprints",
  INDEPENDENCE: "home",
  NUTRITION: "nutrition",
  EDUCATION: "book",
  WELLBEING: "smile",
  DIABETES_GLUCOSE: "droplets",
  WEIGHT: "scale",
  RESPIRATORY: "wind",
  GENERIC: "goals"
});

export const GOAL_CATEGORIES = Object.freeze(Object.keys(GOAL_ICON_REGISTRY));
export const GENERIC_GOAL_ICON = GOAL_ICON_REGISTRY.GENERIC;

// An unknown category renders the generic icon rather than nothing at all: goal definitions can
// come from configuration, and a typo there must never leave a blank space or throw.
export const normalizeGoalCategory = category =>
  (typeof category === "string" && GOAL_ICON_REGISTRY[category] ? category : "GENERIC");

export const GOAL_CONFIG = Object.freeze({
  BLOOD_PRESSURE_CONTROL: {
    category: "CARDIOVASCULAR",
    displayName: T("Keep my blood pressure under control", "Mantener mi presión arterial bajo control", "Kenbe tansyon mwen anba kontwòl"),
    progressType: "MEASUREMENT_ADHERENCE",
    suggestedActions: [
      { id: "check-bp", title: T("Check my blood pressure regularly", "Revisar mi presión arterial regularmente", "Tcheke tansyon mwen regilyèman"), frequency: true, defaultTarget: 5 },
      { id: "medications-as-directed", title: T("Take my medications as directed", "Tomar mis medicamentos según las indicaciones", "Pran medikaman mwen jan yo mande a"), frequency: true, defaultTarget: 7 },
      { id: "learn-bp-numbers", title: T("Learn what my blood pressure numbers mean", "Aprender qué significan mis números de presión", "Aprann sa chif tansyon mwen vle di"), frequency: false },
      { id: "reduce-salt", title: T("Reduce salt when possible", "Reducir la sal cuando sea posible", "Diminye sèl lè sa posib"), frequency: true, defaultTarget: 4 },
      { id: "be-active", title: T("Be more active", "Mantenerme más activo", "Pi aktif"), frequency: true, defaultTarget: 3 }
    ]
  },
  // Assigned by the ACCESS track, not chosen. The actions below are what the patient does; how the
  // program decides the goal was met lives in ACCESS_OUTCOME_TARGETS, deliberately somewhere else,
  // so a CMS threshold can never be mistaken for a task or for this patient's clinical target.
  WEIGHT_MANAGEMENT: {
    category: "WEIGHT",
    displayName: T("Reach or maintain a healthy weight", "Alcanzar o mantener un peso saludable", "Rive oswa kenbe yon pwa ki an sante"),
    progressType: "MEASUREMENT_ADHERENCE",
    // "Weigh myself", not "Track my weight". A connected scale transmits on its own, so tracking is
    // the platform's job and naming it as the patient's task tells them to log numbers nobody is
    // asking them to log. The blood pressure goal already says "check", not "track", for the same
    // reason. What the patient actually does is step on the scale.
    suggestedActions: [
      { id: "weigh-in", title: T("Weigh myself regularly", "Pesarme con regularidad", "Peze tèt mwen regilyèman"), frequency: true, defaultTarget: 3 },
      { id: "follow-nutrition-plan", title: T("Follow my nutrition plan", "Seguir mi plan de nutrición", "Swiv plan nitrisyon mwen"), frequency: true, defaultTarget: 5 },
      { id: "stay-active-as-able", title: T("Stay active in ways that are right for me", "Mantenerme activo de la forma adecuada para mí", "Rete aktif nan fason ki bon pou mwen"), frequency: true, defaultTarget: 3 },
      { id: "nutrition-support", title: T("Ask for nutrition or weight support when I need it", "Pedir apoyo de nutrición o peso cuando lo necesite", "Mande sipò nitrisyon oswa pwa lè mwen bezwen l"), frequency: false }
    ]
  },
  STAY_INDEPENDENT: {
    category: "INDEPENDENCE",
    displayName: T("Stay independent", "Mantener mi independencia", "Rete endepandan"),
    progressType: "PATIENT_REPORTED",
    suggestedActions: [
      { id: "safe-routine", title: T("Keep a safe daily routine", "Mantener una rutina diaria segura", "Kenbe yon woutin chak jou ki an sekirite"), frequency: true, defaultTarget: 5 },
      { id: "ask-for-support", title: T("Ask for help when I need it", "Pedir ayuda cuando la necesite", "Mande èd lè mwen bezwen li"), frequency: false },
      { id: "prepare-appointments", title: T("Prepare questions for my appointments", "Preparar preguntas para mis citas", "Prepare kesyon pou randevou mwen"), frequency: false }
    ]
  },
  AVOID_HOSPITAL_VISITS: {
    category: "PREVENTION",
    iconKey: "hospital",
    displayName: T("Avoid hospital visits", "Evitar visitas al hospital", "Evite vizit lopital"),
    progressType: "PATIENT_REPORTED",
    suggestedActions: [
      { id: "notice-changes", title: T("Notice changes in how I feel", "Notar cambios en cómo me siento", "Remake chanjman nan jan mwen santi m"), frequency: true, defaultTarget: 7 },
      { id: "call-care-team", title: T("Contact my care team when I have questions", "Contactar a mi equipo cuando tenga preguntas", "Kontakte ekip swen mwen lè mwen gen kesyon"), frequency: false },
      { id: "follow-care-plan", title: T("Follow the plan I made with my care team", "Seguir el plan que preparé con mi equipo", "Swiv plan mwen te fè ak ekip swen mwen"), frequency: true, defaultTarget: 7 }
    ]
  },
  MEDICATION_UNDERSTANDING: {
    category: "MEDICATIONS",
    displayName: T("Better understand my medications", "Comprender mejor mis medicamentos", "Konprann medikaman mwen yo pi byen"),
    progressType: "MILESTONE",
    suggestedActions: [
      { id: "learn-purpose", title: T("Learn what each medication is for", "Aprender para qué sirve cada medicamento", "Aprann pou kisa chak medikaman sèvi"), frequency: false },
      { id: "make-question-list", title: T("Write down my medication questions", "Anotar mis preguntas sobre medicamentos", "Ekri kesyon mwen sou medikaman"), frequency: false },
      { id: "review-with-team", title: T("Review my list with my care team", "Revisar mi lista con mi equipo", "Revize lis mwen ak ekip swen mwen"), frequency: false }
    ]
  },
  FEEL_BETTER: {
    category: "WELLBEING",
    displayName: T("Feel better day to day", "Sentirme mejor cada día", "Santi m pi byen chak jou"),
    progressType: "PATIENT_REPORTED",
    suggestedActions: [
      { id: "daily-check-in", title: T("Notice how I feel each day", "Observar cómo me siento cada día", "Remake kijan mwen santi m chak jou"), frequency: true, defaultTarget: 7 },
      { id: "share-changes", title: T("Share important changes with my care team", "Compartir cambios importantes con mi equipo", "Pataje chanjman enpòtan ak ekip swen mwen"), frequency: false }
    ]
  },
  STAY_ACTIVE: {
    category: "ACTIVITY_MOBILITY",
    displayName: T("Stay active", "Mantenerme activo", "Rete aktif"),
    progressType: "ACTION_COUNT",
    suggestedActions: [
      { id: "short-walk", title: T("Take a short walk", "Dar una caminata corta", "Fè yon ti mache"), frequency: true, defaultTarget: 3 },
      { id: "gentle-movement", title: T("Do gentle movement that feels safe", "Hacer movimientos suaves que se sientan seguros", "Fè mouvman dous ki santi yo an sekirite"), frequency: true, defaultTarget: 3 },
      { id: "plan-active-time", title: T("Choose a time that works for being active", "Elegir un horario que me funcione para estar activo", "Chwazi yon lè ki bon pou mwen rete aktif"), frequency: false }
    ]
  },
  CUSTOM: {
    category: "GENERIC",
    displayName: T("My personal goal", "Mi objetivo personal", "Objektif pèsonèl mwen"),
    progressType: "PATIENT_REPORTED",
    suggestedActions: []
  }
});

export const LEGACY_GOAL_TYPES = Object.freeze({
  "blood-pressure": "BLOOD_PRESSURE_CONTROL",
  independent: "STAY_INDEPENDENT",
  "avoid-hospital": "AVOID_HOSPITAL_VISITS",
  "understand-medications": "MEDICATION_UNDERSTANDING",
  "feel-better": "FEEL_BETTER",
  "stay-active": "STAY_ACTIVE",
  other: "CUSTOM"
});

export const localGoalText = (entry, locale = "en") => entry?.[locale] || entry?.en || "";

export function createPatientGoal({ type, customTitle = "", patientId = "", now = new Date().toISOString(), id = "", goalSource = type === "CUSTOM" ? "PATIENT" : "PATHWAY", personalTemplateId = "" }) {
  const config = GOAL_CONFIG[type] || GOAL_CONFIG.CUSTOM;
  // A personal goal proposed from a template borrows that template's category, so it draws the
  // icon that matches what it is about instead of the generic target every personal goal used to
  // get. A goal the patient wrote from scratch keeps the generic one, which is honest: nobody has
  // classified it.
  const template = type === "CUSTOM" ? personalGoalTemplate(personalTemplateId) : null;
  return {
    id: id || `goal_${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    patientId,
    goalType: type,
    goalCategory: normalizeGoalCategory(template?.category || config.category),
    iconKey: config.iconKey || null,
    personalTemplateId: template ? personalTemplateId : "",
    title: config.displayName.en,
    customTitle: type === "CUSTOM" ? String(customTitle).trim() : "",
    status: "ACTIVE",
    priority: "NONE",
    whyItMatters: "",
    planStatus: "NOT_STARTED",
    planPersonalizationStatus: "NOT_STARTED",
    goalSource,
    selectedBy: "PATIENT",
    clinicalTargetId: null,
    patientCanEditClinicalTarget: false,
    // Which care plan goal the patient SAID this one helps with. Empty unless they said so: a link
    // inferred from a shared category would be the app asserting a clinical relationship nobody
    // confirmed, on a record the care team reads.
    contributesToGoalId: "",
    careTeamReviewStatus: type === "CUSTOM" ? "PENDING" : "NOT_REQUIRED",
    actions: [],
    progress: [],
    educationHistory: [],
    barriers: [],
    supportRequests: [],
    reviews: [],
    createdBy: goalSource,
    createdAt: now,
    updatedAt: now
  };
}

// A personal goal's name resolves in one order and only one: the patient's own words if they wrote
// or edited any, then the template sentence they accepted — which is translated, so accepting the
// offer in English still reads correctly after switching to Spanish — then the catalogue.
export function goalDisplayName(goal, locale = "en") {
  if (!goal) return "";
  if (goal.goalType === "CUSTOM") {
    if (goal.customTitle) return goal.customTitle;
    const template = personalGoalTemplate(goal.personalTemplateId);
    if (template) return localGoalText(template.displayName, locale);
  }
  return localGoalText((GOAL_CONFIG[goal.goalType] || GOAL_CONFIG.CUSTOM).displayName, locale);
}

// Resolution order: an explicit per-goal override, then the goal's category, then the category
// on its definition (which covers goals persisted before categories existed), then the generic
// target. isKnownIcon lets the caller reject an override naming an icon it cannot draw, so a bad
// override degrades to the category icon instead of rendering a placeholder.
export function goalCategoryOf(goal) {
  if (!goal) return "GENERIC";
  if (typeof goal.goalCategory === "string" && GOAL_ICON_REGISTRY[goal.goalCategory]) return goal.goalCategory;
  return normalizeGoalCategory(GOAL_CONFIG[goal.goalType]?.category);
}

export function resolveGoalIcon(goal, isKnownIcon = name => Object.values(GOAL_ICON_REGISTRY).includes(name)) {
  const override = goal?.iconKey || GOAL_CONFIG[goal?.goalType]?.iconKey;
  if (typeof override === "string" && override && isKnownIcon(override)) return override;
  return GOAL_ICON_REGISTRY[goalCategoryOf(goal)] || GENERIC_GOAL_ICON;
}

export function suggestedActionsFor(goalType) {
  return (GOAL_CONFIG[goalType] || GOAL_CONFIG.CUSTOM).suggestedActions || [];
}

// Each suggested action maps to an icon that carries its meaning, so a patient can scan the
// plan visually instead of reading every line. Unmapped actions fall back to the goal target.
const ACTION_ICONS = Object.freeze({
  "check-bp": "chart",
  "medications-as-directed": "pill",
  "learn-bp-numbers": "book",
  "reduce-salt": "nutrition",
  "be-active": "activity",
  "safe-routine": "home",
  "ask-for-support": "people",
  "prepare-appointments": "document",
  "notice-changes": "heart",
  "call-care-team": "phone",
  "follow-care-plan": "plan",
  "learn-purpose": "book",
  "make-question-list": "document",
  "review-with-team": "people",
  "weigh-in": "scale",
  "follow-nutrition-plan": "nutrition",
  "stay-active-as-able": "activity",
  "nutrition-support": "people",
  // Steps suggested for personal goals. Same rule as above: the icon comes from what the step is,
  // never from words in its title, so it survives translation and rewording.
  "walk-what-i-can": "activity",
  "walk-a-bit-longer": "activity",
  "note-how-i-felt": "heart",
  "move-most-days": "activity",
  "plan-active-time-personal": "clock",
  "less-salt-personal": "nutrition",
  "more-vegetables": "nutrition",
  "nutrition-questions": "people",
  "eat-in-a-way-that-helps": "nutrition",
  "keep-moving": "activity",
  "wind-down": "clock",
  "note-how-i-slept": "heart",
  "pace-my-day": "clock",
  "note-energy": "heart",
  "plan-family-time": "people",
  "build-up-slowly": "activity",
  "take-as-directed-personal": "pill",
  "keep-them-where-i-see-them": "home",
  "write-down-my-questions": "document",
  "raise-it-with-my-doctor": "people",
  "check-when-asked": "chart",
  "learn-my-numbers": "book",
  "follow-my-plan": "plan",
  "gentle-movement-personal": "activity",
  "do-one-thing-myself": "home",
  "ask-for-support-personal": "people",
  "learn-one-thing": "book",
  "prepare-my-questions": "document"
});

export const goalActionIcon = actionId => ACTION_ICONS[actionId] || "goals";

// A goal only has progress once the patient has personalized a plan for it. Before that My Goals
// says so plainly rather than showing "0 of 7", which reads as failure for something never started.
export const goalIsReadyToPersonalize = goal => !goal || goal.planStatus !== "COMPLETED";

// A calendar day is the patient's day, not UTC's. After 8pm in Miami an ISO date has already
// rolled over to tomorrow, which made today's readings and check-ins look like another day's.
export const localDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const startOfWeek = (now = new Date()) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));

const weeklyCompletions = (goal, templateId, weekStart) =>
  (goal.actions || [])
    .filter(action => action.templateId === templateId)
    .flatMap(action => action.completionHistory || [])
    .filter(entry => new Date(`${entry.date}T00:00:00`) >= weekStart).length;

// Different goals measure progress differently: readings arrive from a monitor, activity is a
// count of days, education is topics learned. Forcing all of them into "X of Y completed" makes
// the number meaningless, so each goal reports only the metrics it actually has.
export function goalProgressMetrics(goal, { runtime = null, now = new Date() } = {}) {
  if (!goal) return [];
  const weekStart = startOfWeek(now);
  const actions = goal.actions || [];
  const hasTemplate = templateId => actions.some(action => action.templateId === templateId);
  return [
    runtime?.trend?.count ? { id: "readings", count: runtime.trend.count } : null,
    hasTemplate("medications-as-directed") ? { id: "medicationCheckIns", count: weeklyCompletions(goal, "medications-as-directed", weekStart) } : null,
    hasTemplate("be-active") ? { id: "activeDays", count: weeklyCompletions(goal, "be-active", weekStart) } : null,
    (goal.educationHistory || []).some(item => item.status === "COMPLETED")
      ? { id: "topicsLearned", count: (goal.educationHistory || []).filter(item => item.status === "COMPLETED" && new Date(item.completedAt) >= weekStart).length }
      : null
  ].filter(Boolean);
}

// Structured, not copy: the caller localizes. Returning a shape rather than a sentence is what
// lets My Goals and Goal Detail describe the same state without drifting apart.
export function goalProgressSummary(goal, { runtime = null, now = new Date() } = {}) {
  if (goalIsReadyToPersonalize(goal)) return { kind: "READY" };
  const metrics = goalProgressMetrics(goal, { runtime, now });
  if (metrics.length) return { kind: "METRICS", metrics, trendDirection: runtime?.trend?.direction || null };
  const latest = (goal.progress || []).at(-1);
  if (latest?.patientReportedStatus) return { kind: "PATIENT_REPORTED", status: latest.patientReportedStatus };
  return { kind: "NONE" };
}

// One resolver for "what should I do next", so a goal card, Goal Detail and EMMI cannot each
// invent their own answer. Blood pressure knows more about itself than a generic goal does, so it
// walks its own ladder; everything else falls back to the plan's own next incomplete step.
//
// Priority: safety, then a difficulty that is waiting on the patient, then the care plan, then
// education, then general progress. Telling a patient to review a trend while their monitor is
// broken is advice they cannot take.
export function goalNextBestAction(goal, { runtime = null, educationPending = false, barriers = [], now = new Date() } = {}) {
  if (!goal) return { key: "CHECK_IN" };
  const waitingBarrier = (barriers || []).find(barrier => ["SUSPECTED", "OPEN"].includes(barrier?.status));
  if (waitingBarrier) return { key: waitingBarrier.status === "SUSPECTED" ? "CONFIRM_BARRIER" : "RESOLVE_BARRIER", barrierId: waitingBarrier.id, barrierCategory: waitingBarrier.category };
  if (goalIsReadyToPersonalize(goal)) return { key: "FINISH_PLAN" };
  if (goal.goalType === "BLOOD_PRESSURE_CONTROL" && runtime) {
    const readings = runtime.readings || [];
    if (!readings.length) return { key: "TAKE_READING" };
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const latest = runtime.latest || readings.at(-1);
    if (latest && new Date(latest.timestamp) >= today) return { key: "UNDERSTAND_READING" };
    if (educationPending) return { key: "LEARN_NUMBERS" };
    if (runtime.trend?.direction && runtime.trend.direction !== "INSUFFICIENT_DATA") return { key: "REVIEW_TREND" };
    return { key: "TAKE_READING" };
  }
  const today = localDateKey(now);
  const pending = (goal.actions || []).find(action =>
    action.status === "ACTIVE" && !(action.completionHistory || []).some(entry => entry.date === today));
  if (pending) return { key: "COMPLETE_ACTION", actionId: pending.id, title: pending.title };
  if (educationPending) return { key: "LEARN_NUMBERS" };
  return { key: "CHECK_IN" };
}

// My Goals leads with what matters most and keeps everything else below it, so the order has to
// come from the patient's own priorities rather than from insertion order.
const GOAL_SORT_RANK = goal => {
  if (goal.priority === "PRIMARY") return 0;
  if (goal.priority === "SECONDARY") return 1;
  if (goal.status === "ACHIEVED") return 5;
  if (goal.status === "PAUSED") return 4;
  if (!goalIsReadyToPersonalize(goal)) return 2;
  return 3;
};

export const sortGoalsForPatient = goals =>
  [...(goals || [])].sort((a, b) => GOAL_SORT_RANK(a) - GOAL_SORT_RANK(b));

/* ===============================================================================================
   PERSONAL GOALS vs CARE PLAN GOALS

   One split, derived from the record rather than stored twice, because a goal that claimed to be
   personal on the card and clinical in the tool result would be exactly the confusion this feature
   exists to remove. Everything downstream reads these: which heading a card sits under, whether
   the wording can be edited, whether the goal can be deleted, and what EMMI is allowed to change.
   =============================================================================================== */

export const isPersonalGoal = goal => goal?.goalSource === "PATIENT";
export const isCarePlanGoal = goal => Boolean(goal) && !isPersonalGoal(goal);

// The clinical elements of a goal, named once so a screen and a tool can both say "this is not
// yours to change" about the same list instead of each remembering their own.
export const PROTECTED_CLINICAL_FIELDS = Object.freeze([
  "baseline",
  "clinicalTarget",
  "accessOutcomeDefinition",
  "qualifyingCondition",
  "clinicalMeasure",
  "monitoringRule",
  "medication"
]);

// A patient may rename and delete what they wrote. They may never rename a goal their care plan
// assigned, and they may never edit a clinical target on anything — which is not a permission the
// product grants at all, so it is a constant rather than a check.
// A personal goal may say it helps with one of the care plan's goals. Three rules, all of them
// about not overclaiming: only the patient declares it, only a care plan goal can be the target,
// and a target that has since been removed resolves to nothing rather than to a stale name.
export const goalContributionTarget = (goal, goals = []) => {
  if (!goal?.contributesToGoalId || !isPersonalGoal(goal)) return null;
  return goals.find(item => item.id === goal.contributesToGoalId && isCarePlanGoal(item) && item.status !== "REMOVED") || null;
};

export const goalMayDeclareContribution = goal => isPersonalGoal(goal);

export const patientMayEditGoalWording = goal => isPersonalGoal(goal);
export const patientMayDeleteGoal = goal => isPersonalGoal(goal);
export const patientMayEditClinicalTarget = () => false;

// Suggested steps for a goal, wherever it came from. A pathway goal reads its catalogue entry; a
// personal goal reads the template it was proposed from; a personal goal the patient wrote from
// scratch has no suggestions at all, which is correct rather than a gap — nobody has anything to
// suggest about an outcome nobody has seen before.
export function suggestedActionsForGoal(goal) {
  if (!goal) return [];
  if (goal.goalType === "CUSTOM") return personalGoalTemplate(goal.personalTemplateId)?.suggestedActions || [];
  return suggestedActionsFor(goal.goalType);
}

/* ===============================================================================================
   ACTIONS

   One factory and three mutators, so the plan builder, Goal Detail and EMMI all write the same
   record. Before this existed the shape was assembled inline in one place and EMMI had nowhere to
   write it at all — which is how a second, slightly different action record gets born.
   =============================================================================================== */

// A patient-written step is always PATIENT_REPORT. A step that claimed DEVICE verification would
// sit on the plan forever waiting for a reading nobody is going to send, so the verification method
// is decided by where the step came from and is never taken from the caller's words.
export function createGoalAction({
  goalId = "",
  templateId = "",
  title = "",
  frequency = "",
  targetCount = null,
  actionType = "",
  source = "PATIENT",
  verificationMethod = "PATIENT_REPORT",
  remindersEnabled = false,
  now = new Date().toISOString(),
  id = ""
} = {}) {
  const text = String(title ?? "").trim().slice(0, 160);
  return {
    id: id || `goal_action_${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    goalId,
    templateId: templateId || "",
    title: text,
    actionType: actionType || (frequency ? "RECURRING" : "ONE_TIME"),
    source,
    verificationMethod,
    frequency: frequency || "",
    targetCount,
    schedule: null,
    remindersEnabled: Boolean(remindersEnabled),
    status: "ACTIVE",
    completionHistory: [],
    createdAt: now,
    updatedAt: now
  };
}

// Steps recorded by a monitor or by a lesson are not the patient's to reword or remove: the plan
// would still expect them and the completion would still arrive. Only what the patient reports
// themselves can be edited by them.
export const goalActionIsPatientEditable = action =>
  Boolean(action) && (action.verificationMethod || "PATIENT_REPORT") === "PATIENT_REPORT";

// A removed step stays on the record as REMOVED rather than disappearing: its completion history is
// evidence of what the patient actually did, and deleting the row would delete that too.
export const activeGoalActions = goal => (goal?.actions || []).filter(action => action.status !== "REMOVED");
export const goalActionCount = goal => activeGoalActions(goal).filter(action => action.status === "ACTIVE").length;

export function addGoalAction(goal, options = {}) {
  if (!goal) return null;
  const action = createGoalAction({ ...options, goalId: goal.id });
  if (!action.title) return null;
  goal.actions = [...(goal.actions || []), action];
  goal.updatedAt = action.createdAt;
  return action;
}

export function updateGoalAction(goal, actionId, { title, frequency, targetCount, now = new Date().toISOString() } = {}) {
  const action = (goal?.actions || []).find(item => item.id === actionId);
  if (!action || !goalActionIsPatientEditable(action)) return null;
  if (typeof title === "string") {
    const text = title.trim().slice(0, 160);
    if (!text) return null;
    action.title = text;
    // The patient's own wording replaces the template's, so the step stops being described by a
    // catalogue entry that no longer says what it says.
    action.templateId = "";
    action.source = "PATIENT";
  }
  if (typeof frequency === "string") {
    action.frequency = frequency;
    action.actionType = frequency ? "RECURRING" : "ONE_TIME";
  }
  if (targetCount !== undefined) action.targetCount = targetCount;
  action.updatedAt = now;
  goal.updatedAt = now;
  return action;
}

export function removeGoalAction(goal, actionId, { now = new Date().toISOString() } = {}) {
  const action = (goal?.actions || []).find(item => item.id === actionId);
  if (!action || !goalActionIsPatientEditable(action)) return null;
  action.status = "REMOVED";
  action.updatedAt = now;
  goal.updatedAt = now;
  return action;
}
