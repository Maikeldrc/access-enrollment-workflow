// Which language the patient is actually writing or speaking in.
//
// This is deliberately conservative. Offering to switch language is a small, friendly interruption
// the first time and an irritation every time after, so the detector would rather say "I don't
// know" than guess: a short message, a message with no distinctive words, or one that scores
// evenly across two languages all return null and change nothing.
//
// The three languages are the three the product speaks. KR is ITERA's internal code for Haitian
// Creole and never means Korean; this module works in the UI codes ("en", "es", "ht") and the
// caller maps to whichever spelling it needs.

// Words that a speaker of one language uses and speakers of the others do not. Cognates and words
// that appear in more than one of the three are deliberately absent: "no" is Spanish and English,
// "pa" is Creole and nothing here, "si" is Spanish and Creole, so none of them earn a point.
const MARKERS = {
  es: [
    "qué", "que", "cómo", "como", "cuándo", "cuánto", "cuál", "por qué", "porque", "dónde",
    "necesito", "quiero", "puedo", "tengo", "quisiera", "gracias", "hola", "señor", "señora",
    "mi", "mis", "usted", "ustedes", "para", "con", "pero", "también", "muy", "está", "estoy",
    "hacer", "ver", "las", "los", "una", "uno", "este", "esta", "eso", "algo", "ahora", "entonces",
    "presión", "sangre", "médico", "medicamento", "cita", "ayuda", "entiendo", "seguro"
  ],
  ht: [
    "mwen", "ou", "nou", "yo", "ki", "kisa", "kijan", "poukisa", "èske", "eske", "kote",
    "bezwen", "vle", "genyen", "gen", "mèsi", "bonjou", "bonswa", "tanpri", "wi", "non",
    "swen", "tansyon", "doktè", "medikaman", "randevou", "èd", "konprann", "asirans",
    "avèk", "pou", "nan", "sa", "ap", "pral", "kapab", "fè", "di", "ye", "yon", "li", "m"
  ],
  en: [
    "what", "how", "when", "why", "where", "which", "who",
    "need", "want", "can", "have", "would", "thanks", "thank", "hello", "hi",
    "my", "your", "you", "the", "and", "with", "but", "also", "very", "is", "am",
    "i", "will", "do", "does", "it", "this", "that", "for", "about", "should", "get",
    "blood", "pressure", "doctor", "medication", "appointment", "help", "understand", "insurance",
    // What a patient actually writes to arrange care. The list above covers question words,
    // modals and clinical nouns, but had nothing for contacting or scheduling, so an ordinary
    // sentence like "call me tomorrow" scored English nothing at all. Deliberately excludes
    // words another language here also claims - "me" is a Spanish pronoun, "no" and "non"
    // belong to Spanish and Creole - because a marker that two languages share is not evidence.
    "call", "now", "today", "tomorrow", "time", "please", "know", "take", "tell", "see",
    "cost", "visit", "nurse", "care", "phone", "number", "office", "schedule"
  ]
};

// Characters that only one of the three writes. A single "ñ" or an inverted question mark settles
// Spanish; the Creole grave accents settle Creole.
//
// Characters only. "ap" and "nan" used to sit here too, and being words they were also in the
// Creole marker list — so each was worth three points, one as a marker and two more as orthography
// it is not, against a documented ceiling of two. English has no such class to answer with, so
// "call nan ap now" scored four to nothing and resolved as Creole outright; the margin rule cannot
// rescue a language that scored zero. They are still markers, worth one each like every other word.
// "þ" was here as well and is not a Haitian Creole letter — it made Icelandic read as Creole.
const SPANISH_CHARACTERS = /[ñ¿¡]|[áíóú]/;
const CREOLE_CHARACTERS = /[èòà]/;

// Patients commonly keep the English name of a healthcare service inside an otherwise Spanish
// sentence ("necesito un appointment", "quiero hablar con mi care manager"). Counting isolated
// words makes those turns look tied even though the grammar and the request are Spanish. This
// narrow bridge only applies when a distinctive Spanish intent phrase owns an English care noun;
// it does not guess from the borrowed noun by itself.
const SPANISH_WITH_ENGLISH_CARE_TERM = /\b(necesito|quiero|quisiera|tengo que|puedo|ay[uú]dame|ayuda)\b[^.!?]{0,80}\b(appointments?|visits?|doctors?|medications?|refills?|insurance|care manager|care team)\b/i;

const normalize = text => String(text || "")
  .toLowerCase()
  .replace(/[.,;:!?"'()]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

// Below this a message carries no evidence worth acting on: "ok", "yes", a single number, a name.
const MINIMUM_WORDS = 3;
// The winner has to be ahead, not merely first. A tie is an unanswered question, not a decision.
const MINIMUM_SCORE = 2;
const MINIMUM_MARGIN = 2;

export function detectPatientLanguage(text) {
  const normalized = normalize(text);
  if (!normalized) return null;
  const words = normalized.split(" ");
  if (words.length < MINIMUM_WORDS) return null;
  if (SPANISH_WITH_ENGLISH_CARE_TERM.test(normalized)) return "es";

  const scores = { en: 0, es: 0, ht: 0 };
  for (const [language, markers] of Object.entries(MARKERS)) {
    for (const word of words) if (markers.includes(word)) scores[language] += 1;
  }
  // Orthography is stronger evidence than any single word, because it cannot be a coincidence.
  if (SPANISH_CHARACTERS.test(normalized)) scores.es += 2;
  if (CREOLE_CHARACTERS.test(normalized)) scores.ht += 2;

  const ranked = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const [language, score] = ranked[0];
  const runnerUp = ranked[1][1];
  if (score < MINIMUM_SCORE || score - runnerUp < MINIMUM_MARGIN) return null;
  return language;
}

// What the patient is owed when their language and EMMI's disagree. Three answers, and only one of
// them interrupts them:
//
//   null      - nothing to do; they are writing in the language EMMI is already using, or the
//               message carries no clear evidence either way.
//   "offer"   - the first time a different language appears: ask once, in that language.
//   "switch"  - they answered yes, or they simply kept going in that language, which is a clearer
//               answer than any confirmation. Change and never ask about it again unless they
//               later move somewhere else.
export function resolveLanguageIntent({ text = "", activeLocale = "en", offeredLocale = "", consecutiveMatches = 0 } = {}) {
  const detected = detectPatientLanguage(text);
  if (!detected || detected === activeLocale) return { detected, action: null };
  // A standing offer the patient answered by carrying on in the same language.
  if (detected === offeredLocale) return { detected, action: "switch" };
  // No offer outstanding, but they have now used this language twice running: that is the answer.
  if (consecutiveMatches >= 1) return { detected, action: "switch" };
  return { detected, action: "offer" };
}

// "Yes" in each of the three, for a patient answering the offer rather than continuing in their
// language. Kept narrow on purpose: anything longer is a real message and goes to the orchestrator.
const confirmation = text => String(text || "")
  .toLowerCase()
  .replace(/[.,;:!?¿¡"'()]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const AFFIRMATIVE = /^(yes|yes please|sure|ok|okay|s[ií]|s[ií] por favor|claro|claro que s[ií]|por favor|wi|wi tanpri|dak[oò]|oke)$/i;
export const isLanguageOfferAccepted = text => AFFIRMATIVE.test(confirmation(text));

const DECLINE = /^(no|no thanks|no gracias|non|non mèsi|nope)$/i;
export const isLanguageOfferDeclined = text => DECLINE.test(confirmation(text));
