import { beforeEach, describe, expect, it } from "vitest";
import { buildEmmiLiveTokenConfig, handleEmmiLiveToken, resetEmmiTokenRateLimits } from "../server/emmiLiveToken.js";

const call = async (method, env, requestBody = undefined, request = {}) => {
  let body = "";
  const headers = {};
  const res = { statusCode: 0, setHeader: (name, value) => { headers[name] = value; }, end: value => { body = value; } };
  await handleEmmiLiveToken({ method, body: requestBody, headers: request.headers || {}, socket: { remoteAddress: request.ip || "test" } }, res, env);
  return { status: res.statusCode, headers, body: JSON.parse(body) };
};

describe("EMMI ephemeral token endpoint safety", () => {
  beforeEach(() => resetEmmiTokenRateLimits());
  it("locks server audio settings without discarding screen context and tools", () => {
    const config = buildEmmiLiveTokenConfig({
      model: "gemini-live-model",
      expireTime: "2026-08-26T12:15:00.000Z",
      newSessionExpireTime: "2026-08-26T12:01:00.000Z"
    });
    expect(config.lockAdditionalFields).toEqual([]);
    expect(config.liveConnectConstraints).toMatchObject({
      model: "gemini-live-model",
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Sulafat" } } },
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
            endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
            prefixPaddingMs: 300,
            silenceDurationMs: 800
          },
          activityHandling: "START_OF_ACTIVITY_INTERRUPTS"
        }
      }
    });
    expect(config.liveConnectConstraints.config).not.toHaveProperty("systemInstruction");
    expect(config.liveConnectConstraints.config).not.toHaveProperty("tools");
    expect(config.liveConnectConstraints.config).toMatchObject({
      sessionResumption: {},
      contextWindowCompression: { slidingWindow: {} }
    });
  });
  it("accepts POST only", async () => expect(await call("GET", {})).toMatchObject({ status: 405, body: { error: "method_not_allowed" } }));
  it("refuses any configuration that could use real patient data", async () => expect(await call("POST", { EMMI_PROTOTYPE_MODE: "true", EMMI_ALLOW_REAL_PATIENT_DATA: "true", GEMINI_API_KEY: "never-used" })).toMatchObject({ status: 403, body: { error: "unsafe_prototype_configuration" } }));
  it("returns a safe unavailable response without exposing a server API key", async () => {
    const result = await call("POST", { EMMI_PROTOTYPE_MODE: "true", EMMI_ALLOW_REAL_PATIENT_DATA: "false" });
    expect(result).toMatchObject({ status: 503, body: { error: "gemini_not_configured" } });
    expect(JSON.stringify(result)).not.toContain("GEMINI_API_KEY");
    expect(result.headers["Cache-Control"]).toContain("no-store");
  });
  it("rejects unsupported Kreyòl Live voice before requesting a provider token", async () => {
    const result = await call("POST", { EMMI_PROTOTYPE_MODE: "true", EMMI_ALLOW_REAL_PATIENT_DATA: "false", GEMINI_API_KEY: "must-not-be-used" }, { locale: "KR" });
    expect(result).toMatchObject({ status: 503, body: { error: "VOICE_UNAVAILABLE_FOR_LOCALE", voiceCapability: "UNSUPPORTED_BY_GEMINI_LIVE", locale: "KR" } });
    expect(JSON.stringify(result)).not.toMatch(/ko-KR|Korean|한국어/i);
  });
  it("rejects cross-origin production requests", async () => expect(await call("POST", { VERCEL_URL: "dev-enrollment.vercel.app" }, {}, { headers: { origin: "https://attacker.example" } })).toMatchObject({ status: 403, body: { error: "origin_not_allowed" } }));
  it("rate limits repeated requests", async () => { const env = {}; for (let i = 0; i < 10; i += 1) await call("POST", env, {}, { ip: "rate-test" }); expect(await call("POST", env, {}, { ip: "rate-test" })).toMatchObject({ status: 429 }); });
});
