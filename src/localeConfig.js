// Canonical locale model for the entire patient experience. `KR` is an ITERA-internal
// identifier for Haitian Creole / Kreyòl. It must never be interpreted as Korean.
const CONFIG = {
  EN: {
    internalCode: "EN",
    uiKey: "en",
    languageName: "English",
    nativeName: "English",
    htmlLang: "en",
    bcp47: "en-US",
    speechLanguage: "en",
    modelLanguageInstruction: "Speak naturally in English.",
    geminiLiveVoiceSupported: true
  },
  ES: {
    internalCode: "ES",
    uiKey: "es",
    languageName: "Spanish",
    nativeName: "Español",
    htmlLang: "es",
    bcp47: "es-US",
    speechLanguage: "es",
    modelLanguageInstruction: "Speak naturally in US Spanish.",
    geminiLiveVoiceSupported: true
  },
  KR: {
    internalCode: "KR",
    uiKey: "ht",
    languageName: "Haitian Creole (Kreyòl)",
    nativeName: "Kreyòl",
    htmlLang: "ht",
    bcp47: "ht-HT",
    speechLanguage: "ht",
    modelLanguageInstruction: "Speak naturally in Haitian Creole (Kreyòl). Never speak Korean.",
    // Gemini TTS supports `ht`, but the conversational Gemini Live language list used by
    // EMMI does not. Do not equate standalone TTS support with safe two-way Live support.
    geminiLiveVoiceSupported: false
  }
};

export const PATIENT_LOCALE_CONFIG = Object.freeze(Object.fromEntries(
  Object.entries(CONFIG).map(([key, value]) => [key, Object.freeze(value)])
));

export function resolvePatientLocale(locale) {
  const value = String(locale || "EN").trim();
  const internalCode = value.toUpperCase();
  if (PATIENT_LOCALE_CONFIG[internalCode]) return PATIENT_LOCALE_CONFIG[internalCode];
  const byUiKey = Object.values(PATIENT_LOCALE_CONFIG).find(item => item.uiKey === value.toLowerCase());
  return byUiKey || PATIENT_LOCALE_CONFIG.EN;
}

