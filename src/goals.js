const T = (en, es, ht) => Object.freeze({ en, es, ht });

export const GOAL_CONFIG = Object.freeze({
  BLOOD_PRESSURE_CONTROL: {
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
    displayName: T("Stay independent", "Mantener mi independencia", "Rete endepandan"),
    progressType: "PATIENT_REPORTED",
    suggestedActions: [
      { id: "safe-routine", title: T("Keep a safe daily routine", "Mantener una rutina diaria segura", "Kenbe yon woutin chak jou ki an sekirite"), frequency: true, defaultTarget: 5 },
      { id: "ask-for-support", title: T("Ask for help when I need it", "Pedir ayuda cuando la necesite", "Mande èd lè mwen bezwen li"), frequency: false },
      { id: "prepare-appointments", title: T("Prepare questions for my appointments", "Preparar preguntas para mis citas", "Prepare kesyon pou randevou mwen"), frequency: false }
    ]
  },
  AVOID_HOSPITAL_VISITS: {
    displayName: T("Avoid hospital visits", "Evitar visitas al hospital", "Evite vizit lopital"),
    progressType: "PATIENT_REPORTED",
    suggestedActions: [
      { id: "notice-changes", title: T("Notice changes in how I feel", "Notar cambios en cómo me siento", "Remake chanjman nan jan mwen santi m"), frequency: true, defaultTarget: 7 },
      { id: "call-care-team", title: T("Contact my care team when I have questions", "Contactar a mi equipo cuando tenga preguntas", "Kontakte ekip swen mwen lè mwen gen kesyon"), frequency: false },
      { id: "follow-care-plan", title: T("Follow the plan I made with my care team", "Seguir el plan que preparé con mi equipo", "Swiv plan mwen te fè ak ekip swen mwen"), frequency: true, defaultTarget: 7 }
    ]
  },
  MEDICATION_UNDERSTANDING: {
    displayName: T("Better understand my medications", "Comprender mejor mis medicamentos", "Konprann medikaman mwen yo pi byen"),
    progressType: "MILESTONE",
    suggestedActions: [
      { id: "learn-purpose", title: T("Learn what each medication is for", "Aprender para qué sirve cada medicamento", "Aprann pou kisa chak medikaman sèvi"), frequency: false },
      { id: "make-question-list", title: T("Write down my medication questions", "Anotar mis preguntas sobre medicamentos", "Ekri kesyon mwen sou medikaman"), frequency: false },
      { id: "review-with-team", title: T("Review my list with my care team", "Revisar mi lista con mi equipo", "Revize lis mwen ak ekip swen mwen"), frequency: false }
    ]
  },
  FEEL_BETTER: {
    displayName: T("Feel better day to day", "Sentirme mejor cada día", "Santi m pi byen chak jou"),
    progressType: "PATIENT_REPORTED",
    suggestedActions: [
      { id: "daily-check-in", title: T("Notice how I feel each day", "Observar cómo me siento cada día", "Remake kijan mwen santi m chak jou"), frequency: true, defaultTarget: 7 },
      { id: "share-changes", title: T("Share important changes with my care team", "Compartir cambios importantes con mi equipo", "Pataje chanjman enpòtan ak ekip swen mwen"), frequency: false }
    ]
  },
  STAY_ACTIVE: {
    displayName: T("Stay active", "Mantenerme activo", "Rete aktif"),
    progressType: "ACTION_COUNT",
    suggestedActions: [
      { id: "short-walk", title: T("Take a short walk", "Dar una caminata corta", "Fè yon ti mache"), frequency: true, defaultTarget: 3 },
      { id: "gentle-movement", title: T("Do gentle movement that feels safe", "Hacer movimientos suaves que se sientan seguros", "Fè mouvman dous ki santi yo an sekirite"), frequency: true, defaultTarget: 3 },
      { id: "plan-active-time", title: T("Choose a time that works for being active", "Elegir un horario que me funcione para estar activo", "Chwazi yon lè ki bon pou mwen rete aktif"), frequency: false }
    ]
  },
  CUSTOM: {
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
