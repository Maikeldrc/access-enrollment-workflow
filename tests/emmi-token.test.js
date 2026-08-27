import { describe, expect, it } from "vitest";
import { buildEmmiLiveTokenConfig, handleEmmiLiveToken } from "../server/emmiLiveToken.js";

const call = async (method, env) => {
  let body = "";
  const headers = {};
  const res = { statusCode: 0, setHeader: (name, value) => { headers[name] = value; }, end: value => { body = value; } };
  await handleEmmiLiveToken({ method }, res, env);
  return { status: res.statusCode, headers, body: JSON.parse(body) };
};

describe("EMMI ephemeral token endpoint safety", () => {
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
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Sulafat" } } }
      }
    });
    expect(config.liveConnectConstraints.config).not.toHaveProperty("systemInstruction");
    expect(config.liveConnectConstraints.config).not.toHaveProperty("tools");
  });
  it("accepts POST only", async () => expect(await call("GET", {})).toMatchObject({ status: 405, body: { error: "method_not_allowed" } }));
  it("refuses any configuration that could use real patient data", async () => expect(await call("POST", { EMMI_PROTOTYPE_MODE: "true", EMMI_ALLOW_REAL_PATIENT_DATA: "true", GEMINI_API_KEY: "never-used" })).toMatchObject({ status: 403, body: { error: "unsafe_prototype_configuration" } }));
  it("returns a safe unavailable response without exposing a server API key", async () => {
    const result = await call("POST", { EMMI_PROTOTYPE_MODE: "true", EMMI_ALLOW_REAL_PATIENT_DATA: "false" });
    expect(result).toMatchObject({ status: 503, body: { error: "gemini_not_configured" } });
    expect(JSON.stringify(result)).not.toContain("GEMINI_API_KEY");
    expect(result.headers["Cache-Control"]).toContain("no-store");
  });
});
