// Patient-facing EMMI state is deliberately separate from the realtime transport state.
// Connection setup, model waits and tool execution are implementation details; compact
// surfaces should describe what EMMI is doing in calm, human language.
export const EMMI_VISIBLE_STATE = Object.freeze({
  OFF: "OFF",
  UNSUPPORTED: "UNSUPPORTED",
  ACTIVE_IDLE: "ACTIVE_IDLE",
  THINKING: "THINKING",
  LISTENING: "LISTENING",
  SPEAKING: "SPEAKING",
  PAUSED: "PAUSED",
  ERROR: "ERROR"
});

const THINKING_STATES = new Set([
  "CONNECTING",
  "RECONNECTING",
  "INITIALIZING",
  "SESSION_STARTING",
  "WAITING_MODEL",
  "AWAITING_FIRST_RESPONSE",
  "EMMI_THINKING",
  "TOOL_RUNNING"
]);
const LISTENING_STATES = new Set(["INTERRUPTING", "LISTENING", "USER_SPEAKING"]);

export function resolveEmmiVisibleState({
  internalState = "IDLE",
  transitionStatus = "IDLE",
  voiceEnabled = true,
  voiceSupported = true,
  paused = false,
  hasError = false
} = {}) {
  if (!voiceEnabled) return EMMI_VISIBLE_STATE.OFF;
  if (!voiceSupported) return EMMI_VISIBLE_STATE.UNSUPPORTED;
  if (hasError || internalState === "ERROR") return EMMI_VISIBLE_STATE.ERROR;
  if (paused) return EMMI_VISIBLE_STATE.PAUSED;
  if (transitionStatus === "UPDATING" || THINKING_STATES.has(internalState)) return EMMI_VISIBLE_STATE.THINKING;
  if (internalState === "EMMI_SPEAKING") return EMMI_VISIBLE_STATE.SPEAKING;
  if (LISTENING_STATES.has(internalState)) return EMMI_VISIBLE_STATE.LISTENING;
  return EMMI_VISIBLE_STATE.ACTIVE_IDLE;
}

const LABELS = Object.freeze({
  en: Object.freeze({
    OFF: "Need help?", UNSUPPORTED: "Voice guidance is unavailable in this language",
    ACTIVE_IDLE: "Voice guidance is on", THINKING: "Thinking…", LISTENING: "Listening…",
    SPEAKING: "Speaking…", PAUSED: "Paused", ERROR: "Voice guidance is unavailable"
  }),
  es: Object.freeze({
    OFF: "¿Necesita ayuda?", UNSUPPORTED: "La guía por voz no está disponible en este idioma",
    ACTIVE_IDLE: "La guía por voz está activa", THINKING: "Pensando…", LISTENING: "Escuchando…",
    SPEAKING: "Hablando…", PAUSED: "En pausa", ERROR: "La guía por voz no está disponible"
  }),
  ht: Object.freeze({
    OFF: "Bezwen èd?", UNSUPPORTED: "Gid vwa a pa disponib nan lang sa a",
    ACTIVE_IDLE: "Gid vwa a limen", THINKING: "M ap reflechi…", LISTENING: "M ap koute…",
    SPEAKING: "M ap pale…", PAUSED: "An poz", ERROR: "Gid vwa pa disponib"
  })
});

export function emmiVisibleStateLabel(visibleState, locale = "en") {
  const normalizedLocale = String(locale || "en").toLowerCase();
  const language = normalizedLocale === "es" ? "es" : ["ht", "kr"].includes(normalizedLocale) ? "ht" : "en";
  return LABELS[language][visibleState] ?? LABELS[language].ACTIVE_IDLE;
}
