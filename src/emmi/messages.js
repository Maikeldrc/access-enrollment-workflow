// Single source of truth for EMMI's spoken copy and for the language EMMI runs in.
//
// EMMI never has a language of its own: everything here is derived from the locale the
// patient selected in the UI. In this application KR is Haitian Creole / Kreyòl — never
// Korean — and that mapping is deliberately explicit so it cannot be guessed wrong.

export const EMMI_LANGUAGES = Object.freeze({
  EN: { locale: "EN", languageName: "English", bcp47: "en-US", voiceSupported: true },
  ES: { locale: "ES", languageName: "Spanish", bcp47: "es-US", voiceSupported: true },
  // Gemini Live has no Haitian Creole voice. Rather than simulate support or silently fall
  // back to English, EMMI stays a Kreyòl text experience for this locale.
  KR: { locale: "KR", languageName: "Haitian Creole (Kreyòl)", bcp47: "ht-HT", voiceSupported: false }
});

export function resolveEmmiLanguage(locale) {
  const resolved = EMMI_LANGUAGES[String(locale || "").toUpperCase()];
  if (resolved) return resolved;
  if (import.meta.env?.DEV) console.error(`[emmi] Unknown locale "${locale}" — falling back to English.`);
  return EMMI_LANGUAGES.EN;
}

export const emmiVoiceIsSupported = locale => resolveEmmiLanguage(locale).voiceSupported;

// The Home welcome varies on exactly two dimensions: the active locale and whether a
// physician referred the patient. Both are resolved here so no component branches on language.
const HOME_WELCOME = {
  EN: {
    providerReferral: physician => `Hi, I’m EMMI. Welcome to ITERA HEALTH. I’m here to help support the care you receive from ${physician} and guide you through each step. You can ask me for help at any time.`,
    directOutreach: () => "Hi, I’m EMMI. Welcome to ITERA HEALTH. I’m here to make your care easier and guide you through each step. You can ask me for help at any time."
  },
  ES: {
    providerReferral: physician => `Hola, soy EMMI. Bienvenido a ITERA HEALTH. Estoy aquí para apoyar el cuidado que recibe con ${physician} y guiarle paso a paso. Puede pedirme ayuda en cualquier momento.`,
    directOutreach: () => "Hola, soy EMMI. Bienvenido a ITERA HEALTH. Estoy aquí para hacer que su cuidado sea más fácil y guiarle paso a paso. Puede pedirme ayuda en cualquier momento."
  },
  KR: {
    providerReferral: physician => `Bonjou, mwen se EMMI. Byenveni nan ITERA HEALTH. Mwen la pou sipòte swen ou resevwa avèk ${physician} epi gide w etap pa etap. Ou ka mande m èd nenpòt lè.`,
    directOutreach: () => "Bonjou, mwen se EMMI. Byenveni nan ITERA HEALTH. Mwen la pou rann swen ou pi fasil epi gide w etap pa etap. Ou ka mande m èd nenpòt lè."
  }
};

export function getHomeWelcome({ locale, providerReferral = false, physicianDisplayName = "" } = {}) {
  const language = resolveEmmiLanguage(locale);
  const messages = HOME_WELCOME[language.locale] || HOME_WELCOME.EN;
  return providerReferral && physicianDisplayName
    ? messages.providerReferral(physicianDisplayName)
    : messages.directOutreach();
}
