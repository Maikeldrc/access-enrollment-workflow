import { GoogleGenAI } from "@google/genai";
import { getEmmiSpeechConfig, getEmmiVoiceIdentity } from "../src/emmi/voiceIdentity.js";

const DEFAULT_MODEL = "gemini-3.1-flash-live-preview";
const asBoolean = (value, fallback) => value == null ? fallback : String(value).toLowerCase() === "true";
const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(JSON.stringify(body));
};

export const buildEmmiLiveTokenConfig = ({ model, expireTime, newSessionExpireTime, locale = "EN" }) => ({
  uses: 1,
  expireTime,
  newSessionExpireTime,
  // Lock the server-defined model/audio fields while allowing the client to
  // provide the per-screen prototype context and tool declarations.
  lockAdditionalFields: [],
  liveConnectConstraints: {
    model,
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: getEmmiSpeechConfig(locale),
      thinkingConfig: { thinkingLevel: "minimal" },
      inputAudioTranscription: {},
      outputAudioTranscription: {}
    }
  }
});

export async function handleEmmiLiveToken(req, res, env = process.env) {
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
  const prototypeMode = asBoolean(env.EMMI_PROTOTYPE_MODE, true);
  const allowRealPatientData = asBoolean(env.EMMI_ALLOW_REAL_PATIENT_DATA, false);
  if (!prototypeMode || allowRealPatientData) return json(res, 403, { error: "unsafe_prototype_configuration" });
  if (!asBoolean(env.EMMI_ENABLE_VOICE, true)) return json(res, 503, { error: "voice_disabled" });
  if (!env.GEMINI_API_KEY) return json(res, 503, { error: "gemini_not_configured" });

  let requestBody = {};
  try {
    requestBody = typeof req.body === "object" && req.body ? req.body : await new Promise(resolve => {
      let raw = "";
      req.on?.("data", chunk => { raw += chunk; });
      req.on?.("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
      if (!req.on) resolve({});
    });
  } catch { requestBody = {}; }
  const requestedLocale = String(requestBody.locale || "EN").toUpperCase();
  const voiceIdentity = getEmmiVoiceIdentity(requestedLocale);
  if (!voiceIdentity.supported) return json(res, 503, { error: "voice_locale_fallback" });

  const model = env.GEMINI_LIVE_MODEL || DEFAULT_MODEL;
  const maxMinutes = Math.max(1, Math.min(12, Number(env.EMMI_SESSION_MAX_MINUTES) || 12));
  const expireTime = new Date(Date.now() + (maxMinutes + 1) * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString();
  try {
    // Ephemeral tokens live on v1alpha, and the browser must connect with the same version.
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1alpha" } });
    const token = await ai.authTokens.create({
      config: buildEmmiLiveTokenConfig({ model, expireTime, newSessionExpireTime, locale: voiceIdentity.locale })
    });
    return json(res, 200, { token: token.name, model, expiresAt: expireTime, prototype: true, voiceIdentity });
  } catch (error) {
    const status = error?.status === 429 || error?.code === 429 ? 429 : 502;
    return json(res, status, { error: status === 429 ? "rate_limited" : "token_generation_failed" });
  }
}
