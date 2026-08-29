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
  let text = extractText(value).replace(/\[TRUSTED LIVE CONTEXT UPDATE[^\]]*\]/gi, " ");
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

