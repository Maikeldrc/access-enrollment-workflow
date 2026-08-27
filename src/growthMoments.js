// Growth prompts are deliberately kept out of the Enrollment Welcome screen. A patient who has
// just finished enrolling has not experienced the service yet, so Share ACCESS waits for a
// moment where the patient actually got value.

const T = (en, es, ht) => Object.freeze({ en, es, ht });

export const GROWTH_MOMENTS = Object.freeze({
  FIRST_HEALTH_CHECK_COMPLETED: "FIRST_HEALTH_CHECK_COMPLETED",
  GETTING_STARTED_COMPLETED: "GETTING_STARTED_COMPLETED",
  DEVICE_CONNECTED: "DEVICE_CONNECTED",
  FIRST_READING_RECEIVED: "FIRST_READING_RECEIVED",
  CARE_PLAN_REVIEWED: "CARE_PLAN_REVIEWED"
});

// Share ACCESS is ACCESS-specific on purpose: there is no approved Share CCM / Share RPM.
export function shareAccessEligibility({ pathway, enrollmentStatus, moment, dismissedAt, promptAvailable }) {
  const enrollmentCompleted = enrollmentStatus === "COMPLETED";
  const positiveValueMomentReached = Boolean(moment) && Object.values(GROWTH_MOMENTS).includes(moment);
  const dismissedRecently = !promptAvailable(dismissedAt);
  return {
    enrollmentCompleted,
    positiveValueMomentReached,
    dismissedRecently,
    eligible: pathway === "ACCESS" && enrollmentCompleted && positiveValueMomentReached && !dismissedRecently
  };
}

export const SHARE_ACCESS_COPY = Object.freeze({
  title: T(
    "Know someone who may benefit from learning about ACCESS?",
    "¿Conoce a alguien que podría beneficiarse de conocer ACCESS?",
    "Ou konnen yon moun ki ka benefisye si l aprann sou ACCESS?"
  ),
  supporting: T(
    "You can share information about Medicare’s ACCESS Model with a friend or family member.",
    "Puede compartir información sobre el Modelo ACCESS de Medicare con un amigo o familiar.",
    "Ou ka pataje enfòmasyon sou Modèl ACCESS Medicare a ak yon zanmi oswa yon fanmi."
  ),
  cta: T("Share ACCESS", "Compartir ACCESS", "Pataje ACCESS")
});

// Care Circle is a shared capability, not an ACCESS feature. Only the supporting line changes
// per program, so device wording never appears for a program without a device.
const CARE_CIRCLE_SUPPORTING = {
  withDevice: T(
    "Add a family member, caregiver, or someone you trust to help with reminders, device setup, and next steps.",
    "Agregue a un familiar, cuidador o alguien de confianza para ayudarle con recordatorios, la configuración del dispositivo y los próximos pasos.",
    "Ajoute yon fanmi, yon moun k ap bay swen, oswa yon moun ou fè konfyans pou ede w ak rapèl, mete aparèy la an plas, ak pwochen etap yo."
  ),
  withoutDevice: T(
    "Add someone you trust to help with reminders and next steps.",
    "Agregue a alguien de confianza para ayudarle con recordatorios y los próximos pasos.",
    "Ajoute yon moun ou fè konfyans pou ede w ak rapèl ak pwochen etap yo."
  ),
  monitoringOnly: T(
    "Add someone you trust to help with monitor setup, reminders, and next steps.",
    "Agregue a alguien de confianza para ayudarle con la configuración del monitor, recordatorios y próximos pasos.",
    "Ajoute yon moun ou fè konfyans pou ede w mete monitè a an plas, ak rapèl ak pwochen etap yo."
  )
};

const CARE_CIRCLE_BY_PROGRAM = Object.freeze({
  ACCESS: CARE_CIRCLE_SUPPORTING.withDevice,
  RPM: CARE_CIRCLE_SUPPORTING.monitoringOnly,
  CCM_RPM: CARE_CIRCLE_SUPPORTING.monitoringOnly,
  PCM_RPM: CARE_CIRCLE_SUPPORTING.monitoringOnly,
  CCM: CARE_CIRCLE_SUPPORTING.withoutDevice,
  PCM: CARE_CIRCLE_SUPPORTING.withoutDevice,
  ASM: CARE_CIRCLE_SUPPORTING.withoutDevice,
  APCM: CARE_CIRCLE_SUPPORTING.withoutDevice
});

export const CARE_CIRCLE_COPY = Object.freeze({
  label: T("Optional support", "Apoyo opcional", "Sipò opsyonèl"),
  title: T(
    "Want someone you trust to help with your care?",
    "¿Quiere que alguien de confianza le ayude con su cuidado?",
    "Ou vle yon moun ou fè konfyans ede w ak swen ou?"
  ),
  cta: T("Add someone to my Care Circle", "Agregar a alguien a mi Círculo de cuidado", "Ajoute yon moun nan Sèk swen mwen"),
  supportingFor: pathway => CARE_CIRCLE_BY_PROGRAM[pathway] || CARE_CIRCLE_SUPPORTING.withoutDevice
});
