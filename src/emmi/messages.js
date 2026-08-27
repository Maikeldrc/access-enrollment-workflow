import { PATIENT_LOCALE_CONFIG, resolvePatientLocale } from "../localeConfig.js";

// Single source of truth for EMMI's spoken copy and for the language EMMI runs in.
//
// EMMI never has a language of its own: everything here is derived from the locale the
// patient selected in the UI. In this application KR is Haitian Creole / Kreyòl — never
// Korean — and that mapping is deliberately explicit so it cannot be guessed wrong.

export const EMMI_LANGUAGES = Object.freeze(Object.fromEntries(
  Object.entries(PATIENT_LOCALE_CONFIG).map(([locale, config]) => [locale, Object.freeze({
    locale,
    languageName: config.languageName,
    nativeName: config.nativeName,
    bcp47: config.bcp47,
    speechLanguage: config.speechLanguage,
    modelLanguageInstruction: config.modelLanguageInstruction,
    voiceSupported: config.geminiLiveVoiceSupported
  })])
));

export function resolveEmmiLanguage(locale) {
  const resolved = resolvePatientLocale(locale);
  if (resolved.internalCode === "EN" && !["EN", "en"].includes(String(locale || "")) && import.meta.env?.DEV) console.error(`[emmi] Unknown locale "${locale}" — falling back to English.`);
  return EMMI_LANGUAGES[resolved.internalCode];
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
