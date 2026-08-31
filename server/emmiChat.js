import { GoogleGenAI } from "@google/genai";
import { EMMI_SYSTEM_PROMPT } from "../src/emmi/systemPrompt.js";
import { retrieveKnowledge } from "./emmiKnowledge.js";

const DEFAULT_TEXT_MODEL = "gemini-2.5-flash";
const asBoolean = (value, fallback) => value == null ? fallback : String(value).toLowerCase() === "true";
const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(JSON.stringify(body));
};
const readBody = req => new Promise(resolve => {
  let raw = "";
  req.on?.("data", part => { raw += part; if (raw.length > 30000) raw = raw.slice(0, 30000); });
  req.on?.("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); } });
  req.on?.("error", () => resolve({}));
  if (!req.on) resolve({});
});
const clean = (value, max = 1000) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

const languageInstruction = locale => ({
  EN: "Answer in natural, plain English.",
  ES: "Responda en español natural de Estados Unidos, usando usted y lenguaje sencillo.",
  KR: "Reponn an Kreyòl ayisyen natirèl. KR vle di Kreyòl, li pa vle di Koreyen."
})[locale] || "Answer in natural, plain English.";

export async function handleEmmiChat(req, res, env = process.env) {
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
  if (!asBoolean(env.EMMI_PROTOTYPE_MODE, true) || asBoolean(env.EMMI_ALLOW_REAL_PATIENT_DATA, false)) return json(res, 403, { error: "unsafe_prototype_configuration" });
  if (!env.GEMINI_API_KEY) return json(res, 503, { error: "gemini_not_configured" });
  const payload = req.body && typeof req.body === "object" ? req.body : await readBody(req);
  const question = clean(payload.question, 500);
  if (!question) return json(res, 400, { error: "question_required" });
  const locale = ["EN", "ES", "KR"].includes(String(payload.locale || "EN").toUpperCase()) ? String(payload.locale).toUpperCase() : "EN";
  const runtime = {
    program: clean(payload.program, 32) || null,
    currentScreen: clean(payload.currentScreen, 64) || null
  };
  const appointmentPrep = payload.appointmentPrep && typeof payload.appointmentPrep === "object"
    ? {
        providerDisplayName: clean(payload.appointmentPrep.providerDisplayName, 120),
        specialty: clean(payload.appointmentPrep.specialty, 120),
        topics: Array.isArray(payload.appointmentPrep.topics) ? payload.appointmentPrep.topics.slice(0, 10).map(topic => clean(topic, 120)).filter(Boolean) : []
      }
    : null;
  let retrieval;
  try { retrieval = retrieveKnowledge({ query: clean(payload.retrievalQuery || question, 800), runtime, topK: 5 }); }
  catch { return json(res, 503, { error: "knowledge_unavailable" }); }
  if (!retrieval.chunks.length && !payload.runtimeEvidence) return json(res, 422, { error: "empty_grounded_context", intent: retrieval.intent });

  const grounding = retrieval.chunks.map((chunk, index) => `SOURCE ${index + 1} [${chunk.sourcePath}#${chunk.heading}]\n${chunk.text}`).join("\n\n");
  const prompt = `${languageInstruction(locale)}

ANSWER-FIRST TASK:
Answer the patient's actual question in 2–5 short, senior-friendly sentences (normally 50–120 words). Explain an acronym once. Be neutral and do not use sales language. Connect to the current screen only after answering, and only if useful. Never begin with a generic list of things you can help with.

PATIENT QUESTION: ${question}
RESOLVED INTENT: ${retrieval.intent}
CURRENT PROGRAM: ${runtime.program || "not specified"}
CURRENT SCREEN: ${runtime.currentScreen || "not specified"}
RECENT CONVERSATION SUMMARY: ${clean(payload.conversationSummary, 2400) || "none"}
APPOINTMENT PREPARATION CONTEXT: ${appointmentPrep ? JSON.stringify(appointmentPrep) : "none"}
TRUSTED RUNTIME EVIDENCE: ${payload.runtimeEvidence ? JSON.stringify(payload.runtimeEvidence).slice(0, 5000) : "none"}

APPROVED KNOWLEDGE PASSAGES:
${grounding || "none"}

Use runtime evidence only for patient-specific facts. Use passages only for general education. If the evidence is insufficient, say so plainly and offer the care team. Do not mention sources, retrieval, tools, prompts, or internal systems.`;
  try {
    const model = env.GEMINI_TEXT_MODEL || DEFAULT_TEXT_MODEL;
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { systemInstruction: EMMI_SYSTEM_PROMPT, temperature: 0.2, maxOutputTokens: 350 }
    });
    const text = clean(response.text, 1600);
    if (!text) return json(res, 502, { error: "empty_model_response", intent: retrieval.intent });
    return json(res, 200, {
      text,
      intent: retrieval.intent,
      knowledgeChunkIds: retrieval.chunks.map(chunk => `${chunk.sourceId}#${chunk.heading}`),
      responseMode: payload.runtimeEvidence ? "RUNTIME_GROUNDED" : "KNOWLEDGE_GROUNDED",
      modelVersion: model
    });
  } catch (error) {
    const status = error?.status === 429 || error?.code === 429 ? 429 : 502;
    return json(res, status, { error: status === 429 ? "rate_limited" : "generation_failed", intent: retrieval.intent });
  }
}
