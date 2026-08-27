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

export function createPatientGoal({ type, customTitle = "", patientId = "", now = new Date().toISOString(), id = "", goalSource = type === "CUSTOM" ? "PATIENT" : "PATHWAY" }) {
  const config = GOAL_CONFIG[type] || GOAL_CONFIG.CUSTOM;
  return {
    id: id || `goal_${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    patientId,
    goalType: type,
    goalCategory: normalizeGoalCategory(config.category),
    iconKey: config.iconKey || null,
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

export function goalDisplayName(goal, locale = "en") {
  if (!goal) return "";
  if (goal.goalType === "CUSTOM" && goal.customTitle) return goal.customTitle;
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
  "review-with-team": "people"
});

export const goalActionIcon = actionId => ACTION_ICONS[actionId] || "goals";

// A goal only has progress once the patient has personalized a plan for it. Before that My Goals
// says so plainly rather than showing "0 of 7", which reads as failure for something never started.
export const goalIsReadyToPersonalize = goal => !goal || goal.planStatus !== "COMPLETED";

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
export function goalNextBestAction(goal, { runtime = null, educationPending = false, now = new Date() } = {}) {
  if (!goal) return { key: "CHECK_IN" };
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
  const today = now.toISOString().slice(0, 10);
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
