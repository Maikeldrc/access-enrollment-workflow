// One place decides what the patient does next after enrollment. The Enrollment Welcome CTA
// and EMMI both read from here, so the screen and the assistant can never disagree about the
// next step. Labels are prototype defaults and stay configurable per program.

const T = (en, es, ht) => Object.freeze({ en, es, ht });

const LABELS = Object.freeze({
  startCareJourney: T("Start your care journey", "Comience su recorrido de cuidado", "Kòmanse pwosesis swen ou"),
  continue: T("Continue", "Continuar", "Kontinye"),
  startHealthCheck: T("Start my health check", "Iniciar mi evaluación de salud", "Kòmanse chèk sante mwen"),
  setUpMyCare: T("Set up my care", "Configurar mi cuidado", "Mete swen mwen an plas"),
  continueGettingStarted: T("Continue getting started", "Continuar los primeros pasos", "Kontinye premye etap yo"),
  setUpMyMonitor: T("Set up my monitor", "Configurar mi monitor", "Mete monitè mwen an plas"),
  getMyMonitor: T("Get my monitor", "Obtener mi monitor", "Jwenn monitè mwen"),
  takeFirstReading: T("Take my first reading", "Tomar mi primera medición", "Pran premye mezi mwen")
});
const SCREEN_ACTIONS = Object.freeze({ INVITATION: { label: LABELS.startCareJourney, actionType: "LEARN_MORE" }, ENROLLMENT_CONFIRMED: { label: LABELS.startHealthCheck, actionType: "HEALTH_CHECK" } });

// A device is only "already with the patient" when ITERA assigned one or the patient told us
// they own one. Anything else means the monitor still has to be arranged.
const deviceIsAvailable = context => context.devicePath === "owned"
  || context.rpmDeviceFixture === "owned"
  || context.deviceSource === "ITERA_ASSIGNED"
  || Boolean(context.assignedDeviceId);

const deviceIsRequired = context => context.devicePath === "ship" || context.rpmDeviceFixture === "ship";

function monitoringAction(context) {
  if (context.firstTransmissionVerified === true || context.deviceSetupStatus === "COMPLETED") {
    return { label: LABELS.takeFirstReading, route: "RPM_FIRST_READING", actionType: "FIRST_READING" };
  }
  if (deviceIsRequired(context)) return { label: LABELS.getMyMonitor, route: "RPM_DEVICE_PATH", actionType: "DEVICE_FULFILLMENT" };
  if (deviceIsAvailable(context)) return { label: LABELS.setUpMyMonitor, route: "RPM_DEVICE_PATH", actionType: "DEVICE_SETUP" };
  return { label: LABELS.setUpMyMonitor, route: "RPM_DEVICE_PATH", actionType: "DEVICE_PATH" };
}

const PROGRAM_ACTIONS = Object.freeze({
  ACCESS: () => ({ label: LABELS.startHealthCheck, route: "ACCESS_BASELINE", actionType: "HEALTH_CHECK" }),
  CCM: () => ({ label: LABELS.setUpMyCare, route: "ONBOARDING", actionType: "CARE_SETUP" }),
  PCM: () => ({ label: LABELS.continueGettingStarted, route: "ONBOARDING", actionType: "CARE_SETUP" }),
  APCM: () => ({ label: LABELS.continueGettingStarted, route: "ONBOARDING", actionType: "CARE_SETUP" }),
  ASM: () => ({ label: LABELS.continueGettingStarted, route: "ONBOARDING", actionType: "CARE_SETUP" }),
  RPM: monitoringAction,
  // Combined programs run one journey, so they get one CTA that lets the orchestration decide
  // which setup step actually comes first.
  CCM_RPM: () => ({ label: LABELS.continueGettingStarted, route: "RPM_DEVICE_PATH", actionType: "COMBINED_SETUP" }),
  PCM_RPM: () => ({ label: LABELS.continueGettingStarted, route: "RPM_DEVICE_PATH", actionType: "COMBINED_SETUP" })
});

export function resolveNextBestAction(context = {}) {
  if (context.currentScreen && SCREEN_ACTIONS[context.currentScreen]) return { ...SCREEN_ACTIONS[context.currentScreen], route: context.nextRoute || context.currentScreen };
  if (context.currentScreen && context.nextRoute) return { label: LABELS.continue, route: context.nextRoute, actionType: "CONTINUE_CURRENT_JOURNEY" };
  const resolve = PROGRAM_ACTIONS[context.pathway] || PROGRAM_ACTIONS.CCM;
  return resolve(context);
}

export { LABELS as NEXT_BEST_ACTION_LABELS };
