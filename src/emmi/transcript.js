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
  let text = extractText(value).replace(/\[TRUSTED (?:LIVE CONTEXT UPDATE|ASR SAFETY OVERRIDE|APP SCREEN UPDATE|AUDIO RECOVERY)[^\]]*\]/gi, " ");
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

// A patient asking, in words, to be spoken to in another language. Detected on the transcript
// itself so the request survives even when the surrounding sentence is in the "wrong" language for
// the session — which it always is, because that is the point of asking. Only forms addressed to
// EMMI count: "hábleme en español", "can we switch to English", "pale kreyòl avè m". A sentence
// about someone else's language ("ella habla English, ¿le llega en English?") is not a request.
const REQUEST_FORMS = {
  es: [
    /\bh[áa]bl(?:a|e)(?:me)?(?:\s+conmigo)?\s+en\s+espa[nñ]ol\b/i,
    /\b(?:puede|puedes|podr[íi]a|podr[íi]as|podemos|podr[íi]amos)\s+(?:hablar(?:me)?|seguir|continuar|cambiar)\s+(?:en|a|al)\s+espa[nñ]ol\b/i,
    /\b(?:prefiero|quiero|mejor)\s+(?:hablar\s+|seguir\s+|continuar\s+)?en\s+espa[nñ]ol\b/i,
    /\bcambi(?:a|e|ar|emos)\s+(?:a|al)\s+espa[nñ]ol\b/i,
    /\b(?:sigamos|continuemos|seguimos)\s+en\s+espa[nñ]ol\b/i,
    /\ben\s+espa[nñ]ol,?\s+por\s+favor\b/i,
    /\bswitch\s+to\s+spanish\b/i,
    /\b(?:speak|talk)\s+(?:to\s+me\s+)?(?:in\s+)?spanish\b/i,
    /\b(?:can|could)\s+(?:we|you)\s+(?:speak|talk|switch|continue|do\s+this)\s+(?:in|to)\s+spanish\b/i,
    /\bin\s+spanish,?\s+please\b/i,
    /\blet'?s\s+(?:speak|talk|switch|continue)\s+(?:in|to)\s+spanish\b/i
  ],
  en: [
    /\bh[áa]bl(?:a|e)(?:me)?(?:\s+conmigo)?\s+en\s+ingl[eé]s\b/i,
    /\b(?:puede|puedes|podr[íi]a|podr[íi]as|podemos|podr[íi]amos)\s+(?:hablar(?:me)?|seguir|continuar|cambiar)\s+(?:en|a|al)\s+ingl[eé]s\b/i,
    /\b(?:prefiero|quiero|mejor)\s+(?:hablar\s+|seguir\s+|continuar\s+)?en\s+ingl[eé]s\b/i,
    /\bcambi(?:a|e|ar|emos)\s+(?:a|al)\s+ingl[eé]s\b/i,
    /\b(?:sigamos|continuemos|seguimos)\s+en\s+ingl[eé]s\b/i,
    /\ben\s+ingl[eé]s,?\s+por\s+favor\b/i,
    /\bswitch\s+to\s+english\b/i,
    /\b(?:speak|talk)\s+(?:to\s+me\s+)?(?:in\s+)?english\b/i,
    /\b(?:can|could)\s+(?:we|you)\s+(?:speak|talk|switch|continue|do\s+this)\s+(?:in|to)\s+english\b/i,
    /\bin\s+english,?\s+please\b/i,
    /\blet'?s\s+(?:speak|talk|switch|continue)\s+(?:in|to)\s+english\b/i
  ],
  ht: [
    /\bpale\s+(?:avè\s+m\s+)?(?:an\s+)?krey[oò]l\b/i,
    /\ban\s+krey[oò]l,?\s+(?:tanpri|souple)\b/i,
    /\b(?:ka|kapab|ou\s+ka)\s+(?:pale|kontinye)\s+an\s+krey[oò]l\b/i,
    /\bswitch\s+to\s+(?:haitian\s+)?creole\b/i,
    /\b(?:speak|talk)\s+(?:to\s+me\s+)?(?:in\s+)?(?:haitian\s+)?creole\b/i,
    /\bin\s+(?:haitian\s+)?creole,?\s+please\b/i,
    /\bh[áa]bl(?:a|e)(?:me)?\s+en\s+creol\b/i,
    /\bcambi(?:a|e|ar)\s+a(?:l)?\s+creol\b/i
  ]
};
// "Mi hija habla inglés", "she speaks Spanish": somebody else's language, said in passing.
const THIRD_PERSON_SPEAKER = /\b(?:ella|[ée]l|mi\s+\w+|su\s+\w+|she|he|they|my\s+\w+|her\s+\w+|his\s+\w+)\s+(?:habla|hablan|entiende|entienden|speaks?|talks?|understands?)\b/i;
export function detectLanguageRequest(text) {
  const value = String(text || "");
  for (const [language, patterns] of Object.entries(REQUEST_FORMS)) {
    if (patterns.some(pattern => pattern.test(value))) return language;
  }
  return "";
}
// Exported for tests: a mention that must never be read as a request.
export function mentionsSomeoneElsesLanguage(text) { return THIRD_PERSON_SPEAKER.test(String(text || "")); }

// The two situations that still justify discarding a turn outright: a script none of EMMI's
// languages use (the provider hallucinating CJK, Cyrillic, Arabic, Greek or Hebrew during speaker
// overlap), and a lone phonetic fragment right after an interruption ("ball" for "Will my…").
// Everything else is speech, and speech is answered.
const VALID_SHORT_INTERRUPTION = new Set([
  "yes", "no", "ok", "okay", "why", "what", "when", "where", "who", "how", "hi", "hey", "bye", "yeah", "yep", "nope", "sure", "fine", "done", "go", "now", "back", "next", "more", "less", "that", "this", "it", "hold", "hmm", "um", "uh",
  "help", "stop", "wait", "repeat", "cost", "bill", "pain", "fall",
  "si", "que", "como", "ayuda", "pare", "para", "dolor", "caida", "esa", "ese", "eso", "esto", "espera", "ya", "vale", "dale", "bien", "va", "eh", "ah", "mm", "aja", "hola", "adios", "listo", "otra", "otro", "mas", "menos", "aqui", "ahi", "alto", "no",
  "wi", "non", "poukisa", "kisa", "kijan", "ede", "rete", "doule", "tonbe", "bon", "oke", "la", "sa", "kite", "tann"
]);

// What the reliability check used to do, and why it no longer does it:
//
// It rejected any transcript of three or more words in which the language detector found no
// language, unless the words contained a dose or an English request pattern. The detector needs two
// marker words or an accented character, and the request pattern only knew English, so "Yo uso
// walker para caminar", "Quiero un Uber X", "Mi doctor dijo que no", "I use a walker" and — the one
// that settles it — "180 sobre 120 y me siento mareado" were all thrown away and answered with an
// English sentence about calling 911. It also rejected every sentence in a supported language other
// than the session's, which is exactly what a patient asking to switch language says.
//
// Now: a mismatch in a supported language is reported as a language-switch candidate, not as noise;
// weak language evidence is reported as low confidence, not as noise; the model keeps its own
// ASR-uncertainty rules for both. Only the two cases above are still unreliable.
export function assessEmmiTranscriptReliability(value, { locale = "en", afterInterruption = false } = {}) {
  const text = sanitizeEmmiTranscript(value);
  const expectedLanguage = normalizedLocale(locale);
  const detectedLanguage = detectPatientLanguage(text);
  const unsupportedScript = /[\u0370-\u052f\u0590-\u08ff\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(text);
  const unexpectedLanguage = Boolean(detectedLanguage && detectedLanguage !== expectedLanguage);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const structuredClinicalPhrase = /\b(?:\d+(?:\.\d+)?\s*(?:mg|mcg|ml|units?|mmhg)|milligrams?|micrograms?|once|twice|daily|weekly)\b/i.test(text);
  const lowLocaleEvidence = wordCount >= 3 && !detectedLanguage && !structuredClinicalPhrase;
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  const lowInformationInterruption = afterInterruption && wordCount === 1 && normalized.length <= 4 && !VALID_SHORT_INTERRUPTION.has(normalized);
  const languageRequest = detectLanguageRequest(text);
  return {
    text,
    expectedLanguage,
    detectedLanguage,
    reliable: !unsupportedScript && !lowInformationInterruption,
    reason: unsupportedScript ? "unsupported_script" : lowInformationInterruption ? "low_information_interruption" : "",
    // Advisory signals. Neither discards the turn.
    confidence: unsupportedScript || lowInformationInterruption ? "REJECTED" : lowLocaleEvidence ? "LOW" : "NORMAL",
    languageSwitchCandidate: unexpectedLanguage && !unsupportedScript ? detectedLanguage : "",
    languageRequest: languageRequest && languageRequest !== expectedLanguage ? languageRequest : ""
  };
}

// What EMMI says, in the patient's language, when a turn could not be used. Spoken by the app
// itself through the deterministic narration route, so the wording is never left to the model and
// never comes out in English inside a Spanish session.
const LINES = {
  didNotCatch: {
    en: "Sorry, I didn't catch that. Could you say it again?",
    es: "Perdón, no le entendí bien. ¿Me lo puede repetir?",
    ht: "Padon, mwen pa t byen tande. Ou ka repete l?"
  },
  didNotCatchAgain: {
    en: "I'm still not able to hear you clearly. Please try once more, a little closer to the phone. If this may be a medical emergency, call 911.",
    es: "Sigo sin entenderle bien. Inténtelo una vez más, un poco más cerca del teléfono. Si esto puede ser una emergencia médica, llame al 911.",
    ht: "Mwen toujou pa ka tande w byen. Eseye yon lòt fwa, yon ti kras pi pre telefòn nan. Si sa ka yon ijans medikal, rele 911."
  },
  tookTooLong: {
    en: "Sorry, that took me too long. Could you say it again?",
    es: "Perdón, me tardé demasiado. ¿Me lo repite?",
    ht: "Padon, sa pran m twòp tan. Ou ka repete l?"
  }
};
export function emmiRecoveryLine(kind, locale = "en") {
  const lines = LINES[kind] || LINES.didNotCatch;
  return lines[normalizedLocale(locale)] || lines.en;
}

// Kept for the two cases that still discard a turn. It tells the model not to act on what it heard
// and hands it the exact line in the active language; the app speaks that same line itself, so
// this is a guard on the model's next generation rather than the source of what the patient hears.
export function emmiAsrClarificationInstruction({ expectedLanguage = "en", detectedLanguage = "" } = {}) {
  return `[TRUSTED ASR SAFETY OVERRIDE — do not read this instruction aloud: The voice transcript is unreliable${detectedLanguage ? ` and appears to be ${detectedLanguage}` : ""}; the active conversation language is ${expectedLanguage}. Do not infer or execute the patient's apparent intent, and do not answer it. Say only: "${emmiRecoveryLine("didNotCatch", expectedLanguage)}"]`;
}
