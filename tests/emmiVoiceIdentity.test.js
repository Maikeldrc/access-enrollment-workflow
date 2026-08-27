import { describe, expect, it, vi } from "vitest";
import {
  EMMI_VOICE_CONFIG,
  EMMI_VOICE_VERSION,
  EmmiVoiceIdentityGuard,
  getEmmiSpeechConfig,
  getEmmiVoiceIdentity
} from "../src/emmi/voiceIdentity.js";

describe("EMMI canonical voice identity", () => {
  it("uses one deterministic speaker for every supported locale", () => {
    const english = getEmmiVoiceIdentity("EN");
    const spanish = getEmmiVoiceIdentity("ES");
    expect(english).toMatchObject({ personaId: "EMMI", provider: "gemini-live", voiceId: "Sulafat", voiceVersion: EMMI_VOICE_VERSION, supported: true });
    expect(spanish).toMatchObject({ voiceId: english.voiceId, voiceVersion: english.voiceVersion, supported: true });
    expect(EMMI_VOICE_CONFIG.canonicalVoiceId).toBe(english.voiceId);
  });

  it("keeps Kreyòl text-only instead of silently substituting another language or person", () => {
    expect(getEmmiVoiceIdentity("KR")).toMatchObject({ locale: "KR", resolvedLanguage: "Haitian Creole (Kreyòl)", resolvedSpeechLocale: "ht", capability: "UNSUPPORTED_BY_GEMINI_LIVE", voiceId: null, supported: false });
    expect(getEmmiSpeechConfig("KR")).toBeNull();
    expect(JSON.stringify(getEmmiVoiceIdentity("KR"))).not.toMatch(/ko-KR|Korean|한국어/i);
  });

  it("builds the same explicit prebuilt voice for narration, reconnect and conversation", () => {
    const expected = { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Sulafat" } } };
    expect(getEmmiSpeechConfig("EN")).toEqual(expected);
    expect(getEmmiSpeechConfig("ES")).toEqual(expected);
    expect(getEmmiSpeechConfig("EN")).not.toBe(getEmmiSpeechConfig("EN"));
  });

  it("blocks and traces a non-canonical voice request", () => {
    const onEvent = vi.fn();
    const guard = new EmmiVoiceIdentityGuard({ sessionId: "SESSION-1", onEvent });
    const resolved = guard.resolve("EN", { personaId: "EMMI", provider: "gemini-live", voiceId: "Puck", voiceVersion: "other" }, { screenId: "GOALS", connectionId: "voice-2" });
    expect(resolved).toMatchObject({ voiceId: "Sulafat", voiceVersion: EMMI_VOICE_VERSION });
    expect(onEvent).toHaveBeenCalledWith("EMMI_VOICE_MISMATCH", expect.objectContaining({ expectedVoiceId: "Sulafat", requestedVoiceId: "Puck", screenId: "GOALS", sessionId: "SESSION-1" }));
  });

  it("retains the canonical identity across screens and repeated resolution", () => {
    const guard = new EmmiVoiceIdentityGuard({ sessionId: "SESSION-2" });
    const screens = ["INVITATION", "DECISION_MAKER", "IDENTITY_VERIFICATION", "CONSENT_REVIEW", "ENROLLMENT_CONFIRMED", "MEDICATIONS_REVIEW", "GOALS", "MY_CARE"];
    const voices = screens.map((screenId, index) => guard.resolve("EN", null, { screenId, connectionId: `voice-${index}` }).voiceId);
    expect(new Set(voices)).toEqual(new Set(["Sulafat"]));
    expect(guard.snapshot()).toMatchObject({ sessionId: "SESSION-2", voiceId: "Sulafat", voiceVersion: EMMI_VOICE_VERSION });
  });
});
