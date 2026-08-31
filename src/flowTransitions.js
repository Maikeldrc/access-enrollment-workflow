// Shared orchestration for meaningful boundaries between completed flows. UI, routing and
// EMMI consume this same object so a duration or next action cannot drift between surfaces.
const T = (en, es, ht) => Object.freeze({ en, es, ht });

export const FLOW_STATUS = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  DEFERRED: "DEFERRED",
  COMPLETED: "COMPLETED"
});

export const FLOW_TRANSITION_TYPE = Object.freeze({
  CONTINUOUS: "CONTINUOUS",
  NATURAL_STOP_POINT: "NATURAL_STOP_POINT"
});

export const FLOW_TRANSITION_CONFIG = Object.freeze({
  ENROLLMENT_TO_GETTING_STARTED: { transitionType: FLOW_TRANSITION_TYPE.NATURAL_STOP_POINT, completedFlow: "ENROLLMENT", nextFlow: "GETTING_STARTED" },
  HEALTH_INFO_TO_MEDICATIONS: { transitionType: FLOW_TRANSITION_TYPE.CONTINUOUS },
  GETTING_STARTED_TO_ACTIVE_CARE: { transitionType: FLOW_TRANSITION_TYPE.NATURAL_STOP_POINT, completedFlow: "GETTING_STARTED", nextFlow: "ACTIVE_CARE" }
});

const SHARED = Object.freeze({
  reassurance: T("You can stop anytime. Your progress will be saved.", "Puede detenerse en cualquier momento. Su progreso quedará guardado.", "Ou ka kanpe nenpòt lè. Pwogrè ou ap anrejistre."),
  laterLabel: T("I’ll do this later", "Lo haré más tarde", "M ap fè sa pita")
});

const PROGRAM_COPY = Object.freeze({
  // What follows enrollment is care activation, not another questionnaire, and the copy says what
  // will actually happen rather than asking the patient to answer questions.
  ACCESS: {
    title: T("Let’s set up your care", "Configuremos su cuidado", "Ann mete swen ou an plas"),
    nextStepTitle: T("Start your ACCESS care setup", "Comience la configuración de su cuidado ACCESS", "Kòmanse konfigirasyon swen ACCESS ou"),
    description: T("Next, we’ll confirm a few health details, arrange your blood pressure monitor, and personalize your ACCESS goals and care plan.", "A continuación, confirmaremos algunos datos de salud, prepararemos su monitor de presión arterial y personalizaremos sus metas y su plan de cuidado ACCESS.", "Apre sa, n ap konfime kèk detay sante, prepare aparèy tansyon ou, epi pèsonalize objektif ak plan swen ACCESS ou."),
    estimatedDuration: T("About 10 minutes", "Aproximadamente 10 minutos", "Apeprè 10 minit")
  },
  CCM: {
    title: T("Ready to set up your care?", "¿Listo para configurar su cuidado?", "Ou pare pou mete swen ou an plas?"),
    nextStepTitle: T("Set up your care", "Configure su cuidado", "Mete swen ou an plas"),
    description: T("Answer a few questions to help your care team understand your health and personalize your support.", "Responda algunas preguntas para ayudar a su equipo de cuidado a comprender su salud y personalizar su apoyo.", "Reponn kèk kesyon pou ede ekip swen ou konprann sante ou epi pèsonalize sipò ou."),
    estimatedDuration: T("About 5–10 minutes", "Aproximadamente 5–10 minutos", "Apeprè 5–10 minit")
  },
  RPM: {
    setup: {
      title: T("Ready to set up your monitor?", "¿Listo para configurar su monitor?", "Ou pare pou mete monitè ou an plas?"),
      nextStepTitle: T("Set up your monitor", "Configure su monitor", "Mete monitè ou an plas"),
      description: T("We’ll help confirm your monitor and make sure it can send readings to your care team.", "Le ayudaremos a confirmar su monitor y verificar que pueda enviar mediciones a su equipo de cuidado.", "N ap ede konfime monitè ou epi verifye li ka voye mezi bay ekip swen ou."),
      estimatedDuration: T("About 5 minutes", "Aproximadamente 5 minutos", "Apeprè 5 minit")
    },
    fulfillment: {
      title: T("Ready to get your monitor?", "¿Listo para obtener su monitor?", "Ou pare pou jwenn monitè ou?"),
      nextStepTitle: T("Get your monitor", "Obtenga su monitor", "Jwenn monitè ou"),
      description: T("We’ll help arrange a connected blood pressure monitor for your care.", "Le ayudaremos a coordinar un monitor de presión arterial conectado para su cuidado.", "N ap ede fè aranjman pou yon monitè tansyon konekte pou swen ou."),
      estimatedDuration: null
    }
  },
  COMBINED: {
    title: T("Ready for the next step?", "¿Listo para el siguiente paso?", "Ou pare pou pwochen etap la?"),
    nextStepTitle: T("Continue setting up your care", "Continúe configurando su cuidado", "Kontinye mete swen ou an plas"),
    description: T("We’ll help review your health needs and get your monitoring set up.", "Le ayudaremos a revisar sus necesidades de salud y configurar su monitoreo.", "N ap ede revize bezwen sante ou epi mete siveyans ou an plas."),
    estimatedDuration: T("About 5–10 minutes", "Aproximadamente 5–10 minutos", "Apeprè 5–10 minit")
  },
  GENERIC: {
    title: T("Ready to set up your care?", "¿Listo para configurar su cuidado?", "Ou pare pou mete swen ou an plas?"),
    nextStepTitle: T("Set up your care", "Configure su cuidado", "Mete swen ou an plas"),
    description: T("Answer a few questions so your care team can personalize your support.", "Responda algunas preguntas para que su equipo de cuidado pueda personalizar su apoyo.", "Reponn kèk kesyon pou ekip swen ou ka pèsonalize sipò ou."),
    estimatedDuration: T("About 5–10 minutes", "Aproximadamente 5–10 minutos", "Apeprè 5–10 minit")
  }
});

function programCopy(pathway, actionType) {
  if (pathway === "ACCESS") return PROGRAM_COPY.ACCESS;
  if (pathway === "CCM") return PROGRAM_COPY.CCM;
  if (["CCM_RPM", "PCM_RPM"].includes(pathway)) return PROGRAM_COPY.COMBINED;
  if (pathway === "RPM") return actionType === "DEVICE_FULFILLMENT" ? PROGRAM_COPY.RPM.fulfillment : PROGRAM_COPY.RPM.setup;
  return PROGRAM_COPY.GENERIC;
}

export function resolveEnrollmentTransition({ pathway, nextBestAction } = {}) {
  const copy = programCopy(pathway, nextBestAction?.actionType);
  return Object.freeze({
    id: "ENROLLMENT_TO_GETTING_STARTED",
    ...FLOW_TRANSITION_CONFIG.ENROLLMENT_TO_GETTING_STARTED,
    program: pathway,
    ...copy,
    primaryCta: nextBestAction?.label,
    nextRoute: nextBestAction?.route,
    laterRoute: "MY_CARE",
    reassurance: SHARED.reassurance,
    laterLabel: SHARED.laterLabel,
    supportsResume: true
  });
}

export function emptyFlowProgress(flowType = "GETTING_STARTED") {
  return { flowType, status: FLOW_STATUS.NOT_STARTED, startedAt: "", completedAt: "", deferredAt: "", resumeRoute: "" };
}

const GETTING_STARTED_ENTRY_ROUTE = Object.freeze({
  ACCESS: "ACCESS_BP_DEVICE_INFO",
  RPM: "RPM_DEVICE_PATH",
  CCM_RPM: "RPM_DEVICE_PATH",
  PCM_RPM: "RPM_DEVICE_PATH",
  CCM: "ONBOARDING",
  PCM: "ONBOARDING",
  ASM: "ONBOARDING",
  APCM: "ONBOARDING"
});

// A legacy draft can point back to ENROLLMENT_CONFIRMED. That makes the CTA render the same
// screen and look unresponsive, so only post-enrollment screens in the resolved journey qualify.
export function resolveGettingStartedEntryRoute({ pathway, journey = [], savedResumeRoute = "", configuredRoute = "" } = {}) {
  const enrollmentCompleteIndex = journey.indexOf("ENROLLMENT_CONFIRMED");
  const isValid = route => Boolean(route)
    && enrollmentCompleteIndex >= 0
    && journey.indexOf(route) > enrollmentCompleteIndex;
  const fallback = GETTING_STARTED_ENTRY_ROUTE[pathway] || "ONBOARDING";
  return [savedResumeRoute, configuredRoute, fallback].find(isValid)
    || journey[enrollmentCompleteIndex + 1]
    || fallback;
}

// Care setup is a resumable checklist, so its next route comes from the answers that were actually
// saved rather than from the last screen the patient happened to visit. This also keeps the My Care
// CTA from reopening an earlier activation step after the patient has already reached the checklist.
export function resolveCareSetupResumeRoute({
  medicationsReviewStatus = "NOT_STARTED",
  carePreferencesStatus = "NOT_STARTED",
  goalsStatus = "NOT_STARTED"
} = {}) {
  return [
    [medicationsReviewStatus, "MEDICATIONS_REVIEW"],
    [carePreferencesStatus, "CARE_PREFERENCES"],
    [goalsStatus, "GOALS"]
  ].find(([status]) => status !== "COMPLETED")?.[1] || "ONBOARDING_COMPLETE";
}
