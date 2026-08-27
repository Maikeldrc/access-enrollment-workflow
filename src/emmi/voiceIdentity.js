const CANONICAL_VOICE_ID = "Sulafat";

export const EMMI_VOICE_VERSION = "emmi-voice-v1";

export const EMMI_VOICE_CONFIG = Object.freeze({
  personaId: "EMMI",
  provider: "gemini-live",
  voiceVersion: EMMI_VOICE_VERSION,
  // Sulafat is the provider's warm prebuilt voice. The same speaker is used for every
  // supported locale and every kind of EMMI turn: narration, conversation, safety and success.
  canonicalVoiceId: CANONICAL_VOICE_ID,
  characteristics: Object.freeze({
    pace: "moderate",
    style: "warm-calm-professional",
    expressiveness: "moderate",
    audience: "Medicare 65+"
  }),
  localeVoices: Object.freeze({
    EN: Object.freeze({ voiceId: CANONICAL_VOICE_ID, supported: true }),
    ES: Object.freeze({ voiceId: CANONICAL_VOICE_ID, supported: true }),
    // Gemini Live does not currently list Haitian Creole as a supported spoken language.
    // EMMI stays available by text instead of silently becoming a system/browser voice.
    KR: Object.freeze({ voiceId: null, supported: false })
  })
});

const normalizeLocale = locale => {
  const value = String(locale || "EN").toUpperCase();
  return Object.hasOwn(EMMI_VOICE_CONFIG.localeVoices, value) ? value : "EN";
};

export function getEmmiVoiceIdentity(locale) {
  const resolvedLocale = normalizeLocale(locale);
  const localeVoice = EMMI_VOICE_CONFIG.localeVoices[resolvedLocale];
  return Object.freeze({
    personaId: EMMI_VOICE_CONFIG.personaId,
    provider: EMMI_VOICE_CONFIG.provider,
    voiceId: localeVoice.voiceId,
    voiceVersion: EMMI_VOICE_CONFIG.voiceVersion,
    locale: resolvedLocale,
    supported: localeVoice.supported
  });
}

export function getEmmiSpeechConfig(locale) {
  const identity = getEmmiVoiceIdentity(locale);
  if (!identity.supported) return null;
  return Object.freeze({
    voiceConfig: Object.freeze({
      prebuiltVoiceConfig: Object.freeze({ voiceName: identity.voiceId })
    })
  });
}

const differsFromCanonical = (candidate, canonical) => Boolean(candidate) && [
  "personaId", "provider", "voiceId", "voiceVersion", "locale"
].some(key => candidate[key] != null && candidate[key] !== canonical[key]);

export class EmmiVoiceIdentityGuard {
  constructor({ sessionId = "", onEvent = () => {} } = {}) {
    this.sessionId = sessionId;
    this.onEvent = onEvent;
    this.identity = null;
  }

  resolve(locale, candidate = null, { screenId = "", connectionId = "" } = {}) {
    const canonical = getEmmiVoiceIdentity(locale);
    if (differsFromCanonical(candidate, canonical)) {
      this.onEvent("EMMI_VOICE_MISMATCH", {
        sessionId: this.sessionId,
        screenId,
        connectionId,
        locale: canonical.locale,
        expectedVoiceId: canonical.voiceId,
        requestedVoiceId: candidate?.voiceId || null,
        expectedVoiceVersion: canonical.voiceVersion,
        requestedVoiceVersion: candidate?.voiceVersion || null,
        provider: canonical.provider
      });
    }
    this.identity = canonical;
    return canonical;
  }

  snapshot() { return this.identity ? { ...this.identity, sessionId: this.sessionId } : null; }
}

export function emmiVoiceMetadata(locale, { sessionId = "", screenId = "", connectionId = "" } = {}) {
  const identity = getEmmiVoiceIdentity(locale);
  return { ...identity, sessionId, screenId, connectionId };
}
