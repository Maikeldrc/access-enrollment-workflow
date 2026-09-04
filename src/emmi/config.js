const defaults = {
  prototypeMode: true,
  allowRealPatientData: false,
  enableVoice: true,
  enableText: true,
  enableTools: true,
  sessionMaxMinutes: 12,
  // Experimental, off by default: push the newest screen context as realtime text the moment the
  // patient starts speaking, so a spoken question is answered from the screen in front of them.
  // Needs validation against the real provider before it is turned on (see the voice audit report).
  voiceContextOnSpeechStart: false,
  model: "gemini-3.1-flash-live-preview"
};

export const EMMI_CONFIG = Object.freeze({ ...defaults, ...(typeof __EMMI_PUBLIC_CONFIG__ === "object" ? __EMMI_PUBLIC_CONFIG__ : {}) });
export const EMMI_SYSTEM_PROMPT_VERSION = "emmi-prototype-2026-09-v6";
export const emmiPrototypeIsSafe = () => EMMI_CONFIG.prototypeMode && !EMMI_CONFIG.allowRealPatientData;
