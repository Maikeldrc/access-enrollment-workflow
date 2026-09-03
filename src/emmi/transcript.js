import { detectPatientLanguage } from "./languageDetection.js";

const TEXT_KEYS = ["text", "transcript", "value", "content", "outputText", "inputText"];

function extractText(value, depth = 0) {
  if (depth > 3 || value == null) return "";
  if (typeof value === "string") return value;
  if (["number", "boolean"].includes(typeof value)) return String(value);
  if (Array.isArray(value)) return value.map(item => extractText(item, depth + 1)).filter(Boolean).join(" ");
  if (typeof value !== "object") return "";
  for (const key of TEXT_KEYS) {
    const resolved = extractText(value[key], depth + 1);
    if (resolved) return resolved;
  }
  return "";
}

// Gemini Live output transcription occasionally contains the narration delimiter or a stringified
// SDK payload. Neither is patient-facing speech. When the model echoes a narration envelope, keep
// only the final narrated value so stale instructions from an earlier screen cannot enter history.
export function sanitizeEmmiTranscript(value) {
  let text = extractText(value).replace(/\[TRUSTED (?:LIVE CONTEXT UPDATE|ASR SAFETY OVERRIDE)[^\]]*\]/gi, " ");
  const speechParts = text.split(/<\s*speech\s*>/i);
  if (speechParts.length > 1) text = speechParts.at(-1).split(/<\s*\/\s*speech\s*>/i)[0];
  text = text
    .replace(/<\s*\/?\s*speech\s*>/gi, " ")
    .replace(/\[object(?:\s+Object)?\]?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || /^object$/i.test(text)) return "";
  return text.slice(0, 2000);
}

const normalizedLocale = locale => {
  const value = String(locale || "en").toLowerCase();
  if (["es", "spanish"].includes(value)) return "es";
  if (["ht", "kr", "creole", "haitian creole"].includes(value)) return "ht";
  return "en";
};

// Gemini Live currently exposes transcript text but no stable word-level confidence. A clear
// language mismatch is therefore the one deterministic low-confidence signal we can act on
// without guessing from names, medications or short replies. The model still receives the audio,
// but gets an explicit safety override before it can turn corrupted ASR into patient intent.
const VALID_SHORT_INTERRUPTION = new Set([
  "yes", "no", "ok", "okay", "why", "what", "when", "where", "who", "how",
  "help", "stop", "wait", "repeat", "cost", "bill", "pain", "fall",
  "si", "que", "como", "ayuda", "pare", "dolor", "caida",
  "wi", "non", "poukisa", "kisa", "kijan", "ede", "rete", "doule", "tonbe"
]);

export function assessEmmiTranscriptReliability(value, { locale = "en", afterInterruption = false } = {}) {
  const text = sanitizeEmmiTranscript(value);
  const expectedLanguage = normalizedLocale(locale);
  const detectedLanguage = detectPatientLanguage(text);
  const unexpectedLanguage = Boolean(detectedLanguage && detectedLanguage !== expectedLanguage);
  // A long transcript normally carries enough function words for the conservative detector to
  // identify its language. No language signal at all in ten or more words is characteristic of
  // the multilingual ASR corruption reproduced in the live audit. Short names, drug names,
  // readings and yes/no replies deliberately remain exempt.
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const lowLocaleEvidence = wordCount >= 10 && !detectedLanguage;
  // During speaker overlap, an ASR engine can collapse a full interruption to one tiny phonetic
  // fragment (for example, "Will my doctor…" becoming "ball"). Never let that fragment authorize
  // an answer. Common conversational and urgent one-word turns remain valid.
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  const lowInformationInterruption = afterInterruption && wordCount === 1 && normalized.length <= 4 && !VALID_SHORT_INTERRUPTION.has(normalized);
  return {
    text,
    expectedLanguage,
    detectedLanguage,
    reliable: !unexpectedLanguage && !lowLocaleEvidence && !lowInformationInterruption,
    reason: unexpectedLanguage ? "unexpected_language" : lowLocaleEvidence ? "low_locale_evidence" : lowInformationInterruption ? "low_information_interruption" : ""
  };
}

export function emmiAsrClarificationInstruction({ expectedLanguage = "en", detectedLanguage = "" } = {}) {
  return `[TRUSTED ASR SAFETY OVERRIDE — do not read this instruction aloud: The voice transcript is unreliable${detectedLanguage ? ` and appears to be ${detectedLanguage}` : ""}; the active conversation language is ${expectedLanguage}. Do not infer or execute the patient's apparent intent, and do not answer it. Say only: "I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now."]`;
}
