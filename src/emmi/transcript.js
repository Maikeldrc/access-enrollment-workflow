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

const TOOL_SYNTAX_PREFIX = /^[A-Za-z][A-Za-z0-9_]*\s*\(\s*\{/;
const PATIENT_FACING_RECOVERY = /\b(?:I apologize|I['’]m sorry|Sorry|Please|Yes|No|ACCESS)\b/i;
const INLINE_TOOL_CALL = /\bcall:[A-Za-z][A-Za-z0-9_]*\s*\{\s*(?:[A-Za-z][A-Za-z0-9_]*\s*:\s*[^,\s}]+\s*,?\s*)+\}?/gi;

function removeRepeatedSentenceBlock(value) {
  const sentences = value.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(part => part.trim()).filter(Boolean) || [];
  for (let size = 1; size <= Math.floor(sentences.length / 2); size += 1) {
    const first = sentences.slice(0, size).join(" ");
    const second = sentences.slice(size, size * 2).join(" ");
    if (first === second) return sentences.slice(0, size).join(" ");
  }
  return value;
}

export function sanitizeEmmiAssistantTranscript(value) {
  let text = sanitizeEmmiTranscript(value);
  if (TOOL_SYNTAX_PREFIX.test(text)) {
    const recovery = text.match(PATIENT_FACING_RECOVERY);
    text = recovery ? text.slice(recovery.index).trim() : "";
  }
  // Live output transcription can occasionally verbalize an inline function-call envelope even
  // though the actual tool call travels on its own channel. Remove both complete and provider-
  // truncated `call:name{key:value,...` forms before they can reach the patient-visible history.
  text = text.replace(INLINE_TOOL_CALL, " ").replace(/\s+/g, " ").trim();
  return removeRepeatedSentenceBlock(text);
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
  // EMMI supports English, Spanish and Haitian Creole, which all use Latin script. During
  // speaker overlap the provider can occasionally hallucinate a short CJK, Cyrillic, Arabic,
  // Greek or Hebrew fragment from an English phrase. It is never useful patient intent and must
  // not appear in the conversation even when no explicit interruption event arrived first.
  const unsupportedScript = /[\u0370-\u052f\u0590-\u08ff\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(text);
  const unexpectedLanguage = Boolean(detectedLanguage && detectedLanguage !== expectedLanguage);
  // Three or more ordinary words normally carry enough structure for the conservative detector
  // to identify one of EMMI's supported languages. No signal at all is characteristic of the
  // phonetic fragments reproduced in live audio ("Chinese small lantern", "13 game and access
  // service"). Structured medication doses remain valid even when drug names are unfamiliar.
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const structuredClinicalPhrase = /\b(?:\d+(?:\.\d+)?\s*(?:mg|mcg|ml|units?|mmhg)|milligrams?|micrograms?|once|twice|daily|weekly)\b/i.test(text);
  const clearRequestStructure = /\b(?:what|how|when|where|why|who|can|could|would|will|do|does|is|are|please\s+(?:explain|tell|help|show|repeat|stop|wait|call)|i\s+(?:need|want|have|am|would))\b/i.test(text);
  const lowLocaleEvidence = wordCount >= 3 && !detectedLanguage && !structuredClinicalPhrase && !clearRequestStructure;
  // During speaker overlap, an ASR engine can collapse a full interruption to one tiny phonetic
  // fragment (for example, "Will my doctor…" becoming "ball"). Never let that fragment authorize
  // an answer. Common conversational and urgent one-word turns remain valid.
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  const lowInformationInterruption = afterInterruption && wordCount === 1 && normalized.length <= 4 && !VALID_SHORT_INTERRUPTION.has(normalized);
  return {
    text,
    expectedLanguage,
    detectedLanguage,
    reliable: !unsupportedScript && !unexpectedLanguage && !lowLocaleEvidence && !lowInformationInterruption,
    reason: unsupportedScript ? "unsupported_script" : unexpectedLanguage ? "unexpected_language" : lowLocaleEvidence ? "low_locale_evidence" : lowInformationInterruption ? "low_information_interruption" : ""
  };
}

export function emmiAsrClarificationInstruction({ expectedLanguage = "en", detectedLanguage = "" } = {}) {
  return `[TRUSTED ASR SAFETY OVERRIDE — do not read this instruction aloud: The voice transcript is unreliable${detectedLanguage ? ` and appears to be ${detectedLanguage}` : ""}; the active conversation language is ${expectedLanguage}. Do not infer or execute the patient's apparent intent, and do not answer it. Say only: "I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now."]`;
}
