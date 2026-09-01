const defaults = {
  prototypeMode: true,
  allowRealPatientData: false,
  enableVoice: true,
  enableText: true,
  enableTools: true,
  sessionMaxMinutes: 12,
  model: "gemini-3.1-flash-live-preview"
};

export const EMMI_CONFIG = Object.freeze({ ...defaults, ...(typeof __EMMI_PUBLIC_CONFIG__ === "object" ? __EMMI_PUBLIC_CONFIG__ : {}) });
export const EMMI_SYSTEM_PROMPT_VERSION = "emmi-prototype-2026-09-v5";
export const emmiPrototypeIsSafe = () => EMMI_CONFIG.prototypeMode && !EMMI_CONFIG.allowRealPatientData;
