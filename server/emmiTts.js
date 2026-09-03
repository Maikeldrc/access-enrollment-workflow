import { GoogleGenAI } from "@google/genai";
import { getEmmiSpeechConfig, getEmmiVoiceIdentity } from "../src/emmi/voiceIdentity.js";

const DEFAULT_MODEL = "gemini-3.1-flash-tts-preview";
const buckets = new Map(), LIMIT = 60, WINDOW = 60000, MAX_TEXT_LENGTH = 6000;
const header = (req, name) => req.headers?.[name] || req.headers?.[name.toLowerCase()] || "";
const originAllowed = (req, env) => !(env.VERCEL_URL || env.EMMI_ALLOWED_ORIGINS) || new Set([
  ...String(env.EMMI_ALLOWED_ORIGINS || "").split(",").filter(Boolean),
  ...(env.VERCEL_URL ? [`https://${env.VERCEL_URL}`] : []),
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]).has(String(header(req, "origin")));
const rateAllowed = req => {
  const key = String(header(req, "x-forwarded-for") || req.socket?.remoteAddress || "unknown").split(",")[0];
  const now = Date.now();
  const items = (buckets.get(key) || []).filter(time => now - time < WINDOW);
  if (items.length >= LIMIT) return false;
  items.push(now);
  buckets.set(key, items);
  return true;
};
const asBoolean = (value, fallback) => value == null ? fallback : String(value).toLowerCase() === "true";
const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(JSON.stringify(body));
};
const beginAudio = res => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "audio/pcm;rate=24000");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
};
const readBody = async req => {
  if (typeof req.body === "object" && req.body) return req.body;
  return new Promise(resolve => {
    let raw = "";
    req.on?.("data", chunk => { raw += chunk; });
    req.on?.("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    if (!req.on) resolve({});
  });
};

export const resetEmmiTtsRateLimits = () => buckets.clear();

export const buildEmmiTtsRequest = ({ text, locale, model = DEFAULT_MODEL }) => {
  const identity = getEmmiVoiceIdentity(locale);
  const languageDirection = identity.locale === "ES" ? "Speak in natural US Spanish." : "Speak in natural US English.";
  return {
    model,
    contents: [{
      role: "user",
      parts: [{ text: `${languageDirection} Use a warm, calm, professional pace for an older adult. Read only the patient-facing text between <script> tags, exactly as written. Do not add, remove, paraphrase, announce, or describe anything.\n<script>${text}</script>` }]
    }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: getEmmiSpeechConfig(identity.locale)
    }
  };
};

export const extractEmmiTtsAudio = response => {
  const part = response?.candidates?.[0]?.content?.parts?.find(candidate => candidate.inlineData?.data);
  const mimeType = String(part?.inlineData?.mimeType || "");
  if (!part?.inlineData?.data || !(/audio\/(?:pcm|l16)/i.test(mimeType) || /codec=pcm/i.test(mimeType))) return null;
  return { data: part.inlineData.data, mimeType: "audio/pcm;rate=24000" };
};

export async function handleEmmiTts(req, res, env = process.env, generate = null) {
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
  if (!originAllowed(req, env)) return json(res, 403, { error: "origin_not_allowed" });
  if (!rateAllowed(req)) return json(res, 429, { error: "rate_limited" });
  if (!asBoolean(env.EMMI_PROTOTYPE_MODE, true) || asBoolean(env.EMMI_ALLOW_REAL_PATIENT_DATA, false)) {
    return json(res, 403, { error: "unsafe_prototype_configuration" });
  }
  if (!asBoolean(env.EMMI_ENABLE_VOICE, true)) return json(res, 503, { error: "voice_disabled" });
  if (!env.GEMINI_API_KEY && !generate) return json(res, 503, { error: "gemini_not_configured" });

  const body = await readBody(req);
  const text = String(body.text || "").trim();
  const locale = String(body.locale || "EN").toUpperCase();
  const identity = getEmmiVoiceIdentity(locale);
  if (!identity.supported) return json(res, 503, { error: "VOICE_UNAVAILABLE_FOR_LOCALE", locale: identity.locale });
  if (!text || text.length > MAX_TEXT_LENGTH || /[<>]/.test(text)) return json(res, 400, { error: "invalid_narration" });

  try {
    const request = buildEmmiTtsRequest({ text, locale: identity.locale, model: env.GEMINI_TTS_MODEL || DEFAULT_MODEL });
    const generated = generate
      ? await generate(request)
      : await new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }).models.generateContentStream(request);
    const stream = generated?.[Symbol.asyncIterator] ? generated : (async function* () { yield generated; })();
    let wroteAudio = false;
    for await (const chunk of stream) {
      const audio = extractEmmiTtsAudio(chunk);
      if (!audio) continue;
      if (!wroteAudio) beginAudio(res);
      wroteAudio = true;
      res.write(Buffer.from(audio.data, "base64"));
    }
    if (!wroteAudio) return json(res, 502, { error: "tts_returned_no_audio" });
    return res.end();
  } catch (error) {
    if (res.headersSent) return res.end();
    const status = error?.status === 429 || error?.code === 429 ? 429 : 502;
    return json(res, status, { error: status === 429 ? "rate_limited" : "tts_generation_failed" });
  }
}
