import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// EMMI Knowledge Base retrieval — server side only.
//
// This is a COMPLEMENTARY source. It answers "what does this mean?" and never
// "what is true for this patient right now?". Patient-specific facts stay with the runtime
// tools in src/emmi/tools.js, which outrank anything here (see SOURCE_PRIORITY).
//
// The index is built once per process at first use and cached, so a request only pays for
// scoring. The Markdown never reaches the browser: callers receive at most a handful of
// scored chunks through /api/emmi/knowledge.

const KNOWLEDGE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "emmi", "Knowledge");

// Higher wins on conflict. Retrieved knowledge sits below every runtime source on purpose.
export const SOURCE_PRIORITY = Object.freeze({
  CLINICAL_SAFETY_RULES: 1,
  PATIENT_RUNTIME: 2,
  ITERA_CONFIGURATION: 3,
  CMS_APPROVED_KNOWLEDGE: 4,
  ITERA_KNOWLEDGE_BASE: 5,
  ITERA_PUBLIC_INFORMATION: 6,
  GENERAL_MODEL_KNOWLEDGE: 7
});

// Intents that must never be answered from static Markdown alone. The tool named here is
// authoritative; knowledge may only add explanation around its result.
export const TOOL_FIRST_INTENTS = Object.freeze({
  ELIGIBILITY: "getEnrollmentContext",
  COST: "getExpectedAccessCost",
  DEVICE: "getAssignedDevice",
  DEVICE_READING: "checkDeviceConnection",
  ENROLLMENT_STATUS: "getEnrollmentContext",
  MEDICATION_LIST: "getMedicationList",
  GOAL_STATUS: "getPatientGoals",
  CARE_TEAM_STATUS: "getCareTeam",
  NEXT_STEP: "getNextBestAction",
  CLINICAL_SAFETY: "evaluateClinicalEscalation",
  // "What is Medigap?" is knowledge. "Do I have Medigap?" is a fact about this patient and
  // must come from verified coverage, never from a knowledge page.
  COVERAGE: "getPatientCoverage"
});

const INTENT_RULES = [
  // Order matters: safety and personalised lookups win before topical matches.
  { intent: "CLINICAL_SAFETY", risk: "high", test: /\b(chest pain|can'?t breathe|cannot breathe|stroke|emergency|911|dizzy|faint|blood pressure is|bp is|\d{3}\s*\/\s*\d{2,3})\b|dolor de pecho|no puedo respirar|mareo|emergencia|doulè nan pwatrin|pa ka respire|tèt vire/i },
  // Past tense and accidental doses matter as much as intent: "I stopped taking my medication"
  // and "I accidentally took two doses" are what a patient actually says, and neither matched
  // here, so EMMI was free to answer them from general knowledge alone.
  { intent: "MEDICATION_SAFETY", risk: "high", test: /\b(stop|stopped|stopping|quit|skip|skipped|skipping|miss|missed|double|doubled|increase|increased|decrease|decreased|change|changed)\b[^.?]{0,40}\b(medication|medications|medicine|medicines|pill|pills|dose|doses|lisinopril|atorvastatin)\b|\b(took|take|taking|taken)\b[^.?]{0,20}\b(two|twice|double|extra|2)\b[^.?]{0,20}\b(dose|doses|pill|pills|medication|medicine)\b|\b(two|twice|double|extra|too many)\b[^.?]{0,15}\b(dose|doses)\b|dejar de tomar|dej[\u00e9e] de tomar|cambiar la dosis|doble dosis|dos dosis|tom[\u00e9e] de m[\u00e1a]s|sispann pran|pran de fwa/i },
  { intent: "COST", risk: "high", test: /\b(cost|pay|price|owe|charge|bill|copay|coinsurance|deductible|free|\$)\b|cuánto|cuanto|costo|pagar|gratis|konbyen|peye/i },
  { intent: "ELIGIBILITY", risk: "high", test: /\b(eligible|eligibility|qualify|qualified|approved)\b|elegib|califico|kalifye/i },
  { intent: "MEDICATION_LIST", risk: "high", test: /what (medications|medicines|pills).*(have|file|registered)|medications.*on file|qu[eé] medicamentos.*(tienen|registr)|medicamentos registrados|ki medikaman.*dosye/i },
  { intent: "GOAL_STATUS", risk: "medium", test: /what (is|are) my goals?|my current goal|cu[aá]l es mi meta|mis metas actuales|ki objektif mwen/i },
  { intent: "CARE_TEAM_STATUS", risk: "medium", test: /who is my doctor|is my doctor|keep seeing my doctor|qui[eé]n es mi m[eé]dico|mi m[eé]dico sigue|dokt[eè] mwen/i },
  { intent: "DEVICE", risk: "high", test: /\b(monitor|device|cuff|tenovi|pylo|reading|blood pressure machine)\b|aparato|monitor|manchèt|aparèy/i },
  { intent: "MEDICATION", risk: "high", test: /\b(medication|medicine|pill|prescription|dose)\b|medicament|medicina|medikaman/i },
  { intent: "NEXT_STEP", risk: "medium", test: /\b(next|what should i do|what happens now|after this)\b|qué sigue|que sigue|próximo paso|pwochen etap/i },
  { intent: "CARE_CIRCLE", risk: "medium", test: /\b(care circle|daughter|son|family member|caregiver|help me|someone i trust)\b|círculo de cuidado|circulo de cuidado|mi hija|mi hijo|sèk swen|pitit mwen/i },
  { intent: "PERSONAL_REPRESENTATIVE", risk: "medium", test: /\b(personal representative|power of attorney|decide for me|sign for me|legal)\b|representante personal|reprezantan pèsonèl/i },
  { intent: "CONSENT", risk: "medium", test: /\b(consent|agree|sign|signature|authorization)\b|consentimiento|firmar|konsantman/i },
  { intent: "ENROLLMENT", risk: "medium", test: /\b(enroll|enrolled|enrollment|sign up|join)\b|inscri|enskri/i },
  { intent: "MEDICARE", risk: "medium", test: /\b(medicare|qmb|advantage|supplement|medigap|part b|coverage|insurance)\b|seguro|cobertura|asirans/i },
  { intent: "GOALS", risk: "low", test: /\b(goal|goals|target|priorit)\b|objetivo|meta|objektif/i },
  { intent: "HEALTH_INFORMATION", risk: "low", test: /\b(health information|health info|my information|review this|confirm my)\b|información de salud|enfòmasyon sante/i },
  { intent: "CARE_PLAN", risk: "low", test: /\b(care plan|plan of care)\b|plan de cuidado|plan swen/i },
  // Patients name the person, not the department: "talk with my doctor" and "help from my nurse"
  // reached no intent at all and fell through to generic handling.
  { intent: "HUMAN_SUPPORT", risk: "medium", test: /\b(call|speak (?:to|with)|talk (?:to|with)|someone|human|care team|care manager|support|doctor|physician|nurse|cardiologist)\b|llamar|hablar con|mi m[\u00e9e]dico|mi enfermer|equipo de cuidado|rele|pale ak|dokt\u00e8 m|enfimy\u00e8/i },
  { intent: "PROGRAM_EXPLANATION", risk: "low", test: /\b(access|ccm|rpm|pcm|apcm|asm|bhi|cocm|tcm|rtm|chronic care|remote patient|principal care)\b/i },
  { intent: "GENERAL_KNOWLEDGE", risk: "low", test: /\b(what is|what are|what does|why|how does|explain|tell me about)\b|qué es|que es|por qué|porque|kisa|poukisa/i }
];

// A question is personalised when the patient asks about themselves rather than the concept, and
// that decides whether a runtime tool is demanded instead of a general page.
//
// Spanish carries the subject in the verb, so the pronoun a patient would have to say is usually
// absent: "¿Cuánto voy a pagar al mes?" is unmistakably about the speaker and matched none of the
// markers, which let a cost question be answered from a generic page instead of the engine. The
// first-person verb forms below close that. Over-matching here is the safe direction — it demands a
// tool that would otherwise be skipped — so ambiguous nouns like "pago" and "cambio" stay out.
const PERSONAL_MARKERS = /\b(i|i'?m|im|me|my|mine|we|our|am i|do i|did i|have i|was i|will i)\b|\b(mi|mis|m[ií]|m[ií]o|m[ií]a|conmigo|nos|nuestr[oa]|yo|soy|estoy|tengo|puedo|podr[ií]a|voy|quiero|debo|necesito|participo|estar[ée]|ser[ée]|tendr[ée]|pagar[ée]|inscribirme|dejarlo)\b|\b(mwen|pa m|m ap|m'ap)\b/i;

export const classifyQuestion = (question, runtime = {}) => {
  const text = String(question || "");
  const matched = INTENT_RULES.find(rule => rule.test.test(text));
  const intent = matched?.intent || "OTHER";
  const personalized = PERSONAL_MARKERS.test(text);
  // A Medicare question asked about oneself is a coverage lookup, not a definition.
  const resolvedIntent = intent === "MEDICARE" && personalized ? "COVERAGE" : intent;
  const requiredTool = TOOL_FIRST_INTENTS[resolvedIntent] || null;
  return {
    intent: resolvedIntent,
    // Personal phrasing raises the stakes: a generic explanation is no longer a safe answer.
    riskLevel: matched?.risk || "low",
    personalized,
    // Only demand a tool when the patient is actually asking about themselves, except for
    // safety, which is never answered from knowledge.
    requiredTool: requiredTool && (personalized || ["CLINICAL_SAFETY", "MEDICATION_LIST", "GOAL_STATUS", "CARE_TEAM_STATUS"].includes(intent)) ? requiredTool : null,
    // Some intents have no single tool but must never be answered from knowledge alone: EMMI
    // cannot change prescription instructions, only route to the care team (§22).
    mustNotAnswerAlone: intent === "MEDICATION_SAFETY" || intent === "CLINICAL_SAFETY",
    program: runtime.program || null,
    currentScreen: runtime.currentScreen || null
  };
};

const CATEGORY_FOR_INTENT = {
  // "billing" is where the authoritative expected-payment page lives, so a cost question that
  // did not reach it was answering from the surrounding programme pages instead of the page
  // written to answer it.
  COST: ["medicare", "program", "billing"],
  ELIGIBILITY: ["program", "enrollment"],
  DEVICE: ["device", "program"],
  MEDICATION: ["care", "safety"],
  MEDICATION_LIST: ["care"],
  MEDICATION_SAFETY: ["safety", "care"],
  CLINICAL_SAFETY: ["safety"],
  CARE_CIRCLE: ["enrollment"],
  PERSONAL_REPRESENTATIVE: ["enrollment"],
  CONSENT: ["enrollment"],
  ENROLLMENT: ["enrollment", "program"],
  MEDICARE: ["medicare"],
  GOALS: ["care"],
  GOAL_STATUS: ["care"],
  CARE_TEAM_STATUS: ["company", "care"],
  HEALTH_INFORMATION: ["care"],
  CARE_PLAN: ["care"],
  NEXT_STEP: ["program", "care"],
  PROGRAM_EXPLANATION: ["program"],
  HUMAN_SUPPORT: ["core", "company"]
};

// Screens carry strong topical intent; use them to disambiguate a vague question (§50).
const CATEGORY_FOR_SCREEN = {
  MEDICATIONS_REVIEW: ["care"],
  CLINICAL_VERIFICATION: ["care"],
  GOALS: ["care"],
  CARE_PREFERENCES: ["care"],
  ACCESS_BASELINE: ["care", "program"],
  ACCESS_MEASURE: ["device", "care"],
  RPM_DEVICE_PATH: ["device"],
  RPM_DEVICE_SETUP: ["device"],
  RPM_FIRST_READING: ["device"],
  CONSENT_REVIEW: ["enrollment"],
  DISCLOSURE: ["program", "medicare"],
  DECISION_MAKER: ["enrollment"],
  ACCESS_PRE_ELIGIBILITY_NOTICE: ["program", "medicare"]
};

const PROGRAM_ALIASES = {
  CCM_RPM: ["CCM", "RPM", "CCM_RPM"],
  PCM_RPM: ["PCM", "RPM", "PCM_RPM"],
  ACCESS: ["ACCESS"],
  CCM: ["CCM"],
  RPM: ["RPM"],
  PCM: ["PCM"],
  APCM: ["APCM"],
  ASM: ["ASM"]
};

const STOP_WORDS = new Set(["the", "a", "an", "is", "are", "do", "does", "did", "what", "why", "how", "for", "and", "or", "of", "to", "in", "on", "my", "i", "me", "it", "this", "that", "can", "will", "should", "be", "have", "has", "you", "your", "el", "la", "los", "las", "que", "de", "mi", "es", "un", "una", "por", "se", "yon", "nan", "ak", "mwen",
  // The accented forms are the ones patients actually type, and they were not stopwords, so a
  // keyword phrase containing "qué" matched every Spanish question ever asked.
  "qué", "cómo", "como", "cuál", "cual", "cuáles", "dónde", "donde", "quién", "quien", "sí", "más", "mas",
  "kisà", "ki", "pou", "sa", "ou", "li", "yo", "ap", "gen"]);

const tokenize = value => String(value || "").toLowerCase().split(/[^a-z0-9áéíóúñèòàçü]+/i).filter(word => word.length > 2 && !STOP_WORDS.has(word));

// Minimal YAML front-matter reader: the knowledge files use flat scalar keys only.
function parseFrontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { metadata: {}, body: text };
  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line.trim());
    if (!pair) continue;
    const raw = pair[2].trim().replace(/^["']|["']$/g, "");
    metadata[pair[1]] = raw === "true" ? true : raw === "false" ? false : raw;
  }
  return { metadata, body: text.slice(match[0].length) };
}

// Heading-aware chunking: a section stays with its heading so a safety statement is never
// separated from the rule it belongs to (§10).
function chunkDocument({ sourcePath, metadata, body, maxChars = 1600 }) {
  const lines = body.split(/\r?\n/);
  const sections = [];
  let heading = metadata.title || "";
  let buffer = [];
  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text) sections.push({ heading, text });
    buffer = [];
  };
  for (const line of lines) {
    const headingMatch = /^(#{1,4})\s+(.*)$/.exec(line);
    if (headingMatch) { flush(); heading = headingMatch[2].trim(); continue; }
    buffer.push(line);
  }
  flush();

  // A page's answer, in the patient's own language.
  //
  // The corpus is written in English and read by patients in three. When the model is reachable it
  // translates, but when it is not, the fallback had nothing specific to say to a Spanish or Creole
  // patient and fell back to a general paragraph — so they got a worse answer than an English
  // speaker for the same question. These sections are the answer itself, written once per language.
  //
  // They are lifted out rather than left as chunks: they would otherwise compete for a retrieval
  // slot against the page they belong to, and an English turn would spend its context on a
  // translation of what it already has.
  const localizedAnswers = {};
  const remaining = [];
  for (const section of sections) {
    const localized = /^Patient answer \((ES|KR)\)$/i.exec(section.heading);
    if (localized) localizedAnswers[localized[1].toUpperCase()] = section.text.trim();
    else remaining.push(section);
  }
  sections.length = 0;
  sections.push(...remaining);

  const chunks = [];
  for (const section of sections) {
    // Only oversized sections are split, and always on paragraph boundaries.
    if (section.text.length <= maxChars) { chunks.push(section); continue; }
    let current = [];
    let size = 0;
    for (const paragraph of section.text.split(/\r?\n\r?\n/)) {
      if (size + paragraph.length > maxChars && current.length) {
        chunks.push({ heading: section.heading, text: current.join("\n\n") });
        current = [];
        size = 0;
      }
      if (paragraph.length > maxChars) {
        // Still oversized: split on lines rather than emitting an unusable chunk.
        let block = [];
        let blockSize = 0;
        for (const line of paragraph.split(/\r?\n/)) {
          if (blockSize + line.length > maxChars && block.length) {
            chunks.push({ heading: section.heading, text: block.join("\n") });
            block = [];
            blockSize = 0;
          }
          block.push(line);
          blockSize += line.length + 1;
        }
        if (block.length) chunks.push({ heading: section.heading, text: block.join("\n") });
        continue;
      }
      current.push(paragraph);
      size += paragraph.length;
    }
    if (current.length) chunks.push({ heading: section.heading, text: current.join("\n\n") });
  }

  return chunks.map((chunk, index) => ({
    id: `${metadata.id || sourcePath}#${index}`,
    sourceId: metadata.id || sourcePath,
    sourcePath,
    heading: chunk.heading,
    text: chunk.text,
    tokens: tokenize(`${chunk.heading} ${chunk.text}`),
    // The corpus is written in English and the patients ask in three languages, so token overlap
    // alone cannot tell one ACCESS page from another for a Spanish or Creole question: every page
    // scores the same category and programme boost and the winner is whatever the tie-break lands
    // on. A page declares the words a patient would actually use to ask for it, in each language.
    keywordTokens: tokenize(String(metadata.keywords || "").replace(/,/g, " ")),
    metadata: {
      id: metadata.id || sourcePath,
      title: metadata.title || sourcePath,
      category: metadata.category || "general",
      program: metadata.program || null,
      riskLevel: metadata.risk_level || "low",
      requiresPatientContext: metadata.requires_patient_context === true,
      requiresToolWhenPersonalized: metadata.requires_tool_when_personalized === true,
      version: metadata.version || null,
      lastReviewed: metadata.last_reviewed || null,
      owner: metadata.owner || null
    },
    // The same answer in each language the patient may be reading in, carried on every chunk of the
    // page it belongs to so whichever one is retrieved can still be answered in their language.
    localizedAnswers
  }));
}

let cachedIndex = null;

export function buildKnowledgeIndex(root = KNOWLEDGE_ROOT) {
  const documents = [];
  const chunks = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(".md")) continue;
      // README/CHANGELOG/source-registry are maintenance docs, not patient knowledge.
      if (/^(README|CHANGELOG|source-registry)\.md$/i.test(entry.name)) continue;
      const relative = path.relative(root, full).split(path.sep).join("/");
      const { metadata, body } = parseFrontMatter(fs.readFileSync(full, "utf8"));
      documents.push({ path: relative, metadata });
      chunks.push(...chunkDocument({ sourcePath: relative, metadata, body }));
    }
  };
  walk(root);
  return { chunks, documents, builtAt: new Date().toISOString(), documentCount: documents.length };
}

export function getKnowledgeIndex() {
  cachedIndex ||= buildKnowledgeIndex();
  return cachedIndex;
}

export const resetKnowledgeIndex = () => { cachedIndex = null; };

// The master file duplicates the topic files by design; prefer the specific document and keep
// the master only as a fallback when nothing else matched (§42).
const isMasterSource = chunk => /emmi-master-knowledge/.test(chunk.sourcePath);

// The page that describes a programme as a whole, as opposed to one written about a single question
// within it. It owns the programme's name, but a page that matches its own topic should still win:
// naming the programme alone asks for the overview, naming it alongside a topic does not.
const GENERIC_PROGRAM_PAGE = /^programs\/(access|ccm|rpm|pcm|apcm|asm|bhi|cocm|tcm|rtm|ccm-rpm|pcm-rpm)\.md$/i;

export function retrieveKnowledge({ query, runtime = {}, topK = 4, index = getKnowledgeIndex() } = {}) {
  const classification = classifyQuestion(query, runtime);
  // Query rewriting: the patient's visible question is untouched, but retrieval gets the
  // context they are speaking from (§40).
  const rewritten = [query, runtime.program || "", runtime.currentScreen || "", classification.intent].join(" ");
  // Scored against what the patient actually said, not against the context added around it. The
  // rewritten string put the programme name into the token set, so the programme's own page matched
  // it many times over and won whatever was asked. English questions carried enough of their own
  // topic to outweigh that; a Spanish or Creole question against an English corpus did not, so an
  // ACCESS patient asking what CCM is, what coinsurance is, or who ITERA are was handed the ACCESS
  // page every time. Context still counts — as the category and programme boosts below, once.
  const queryTokens = new Set(tokenize(query));
  const intentCategories = new Set(CATEGORY_FOR_INTENT[classification.intent] || []);
  const screenCategories = new Set(CATEGORY_FOR_SCREEN[runtime.currentScreen] || []);
  const wantedPrograms = new Set(PROGRAM_ALIASES[runtime.program] || []);
  for (const namedProgram of ["ACCESS", "CCM", "RPM", "PCM", "APCM", "ASM"]) if (new RegExp(`\\b${namedProgram}\\b`, "i").test(query)) wantedPrograms.add(namedProgram);

  const scored = index.chunks.map(chunk => {
    let score = 0;
    // Each distinct word counts once. Counting repeats rewarded a page for saying the programme's
    // name often rather than for answering the question, which is how the general ACCESS page beat
    // the one written about leaving ACCESS.
    for (const token of new Set(chunk.tokens)) if (queryTokens.has(token)) score += 1;
    // Heading matches are the strongest signal that a section is on-topic.
    for (const token of tokenize(chunk.heading)) if (queryTokens.has(token)) score += 2;
    // A declared keyword is the page saying "this is the question I answer", and it is the only
    // signal a non-English question has to go on, so it outweighs an incidental body match.
    //
    // It counts for the lead block alone, because keywords belong to the document rather than to any
    // one section of it. Applied to every chunk they lifted the whole page equally and left the
    // choice within it to whichever section happened to repeat a word from the question — which is
    // how the comparison-group page came back as "Medicare benefits are not affected" for a question
    // containing "Medicare", instead of the lead written to answer it. Pages are authored
    // answer-first precisely because only one chunk of them is ever selected.
    let matchedKeyword = false;
    if (/#0$/.test(chunk.id)) for (const token of chunk.keywordTokens || []) if (queryTokens.has(token)) { score += 4; matchedKeyword = true; }
    // Category and programme break ties between pages that are about the question. They must not
    // manufacture relevance for one that is not: with a Spanish or Creole question matching almost
    // nothing lexically in an English corpus, every ACCESS-tagged page collected the same boost and
    // the winner was arbitrary — the A1c page answering why medications get reviewed, and the
    // general ACCESS page answering when a patient may leave. A page earns its context boost only
    // once something in the question actually pointed at it.
    const topical = score > 0;
    // The screen the patient is standing on is the signal for a question that matches nothing —
    // "why are you asking me this?" — so it is the one boost that must not require a topical match.
    if (screenCategories.has(chunk.metadata.category)) score += 3;
    if (topical && intentCategories.has(chunk.metadata.category)) score += 3;
    if (topical && chunk.metadata.program && wantedPrograms.has(chunk.metadata.program)) score += 4;
    // A program document for a program the patient is not in is noise (§45).
    if (chunk.metadata.program && wantedPrograms.size && !wantedPrograms.has(chunk.metadata.program)) score -= 3;
    if (classification.intent === "CLINICAL_SAFETY" && chunk.metadata.category === "safety") score += 6;

    return { chunk, score, keywordMatched: matchedKeyword };
  }).filter(entry => entry.score > 0).sort((a, b) => b.score - a.score);

  // The master file duplicates the topic files, so it is a fallback rather than a competitor:
  // it only fills slots the specialised documents left empty.
  // Three tiers. A page that declared the question's own words answers it; the page describing the
  // whole programme is where a question lands when nothing more specific claimed it; the master file
  // fills what is still empty. Without the middle tier the general ACCESS page won every ACCESS
  // question outright, because it carries the programme's name in its heading, its category and its
  // body — so "when can I leave ACCESS?" was answered by the page that says what ACCESS is.
  const claimed = scored.filter(entry => entry.keywordMatched && !GENERIC_PROGRAM_PAGE.test(entry.chunk.sourcePath) && !isMasterSource(entry.chunk));
  const rest = scored.filter(entry => !claimed.includes(entry) && !isMasterSource(entry.chunk));
  const specific = claimed.length
    ? [...claimed, ...rest.filter(entry => !GENERIC_PROGRAM_PAGE.test(entry.chunk.sourcePath)), ...rest.filter(entry => GENERIC_PROGRAM_PAGE.test(entry.chunk.sourcePath))]
    : rest;
  const fallback = scored.filter(entry => isMasterSource(entry.chunk));
  const ranked = [...specific, ...fallback];

  // One chunk per source document keeps the injected context varied rather than repeating
  // one file, and caps how much text reaches the model (§41).
  const seenSources = new Set();
  const selected = [];
  for (const entry of ranked) {
    if (selected.length >= topK) break;
    if (seenSources.has(entry.chunk.sourceId)) continue;
    seenSources.add(entry.chunk.sourceId);
    selected.push(entry);
  }

  // A page's response rule is how it constrains the answer — "never state an amount from this
  // page", "never say the information is unavailable". One chunk per document meant the rule
  // travelled only when its own section happened to outscore the rest of the page, so the model
  // could be handed a cost page stripped of the sentence forbidding it to quote a figure. The rule
  // is not a competitor for a slot; it belongs to whichever chunk of that document was chosen.
  const ruleFor = sourceId => index.chunks.find(chunk => chunk.sourceId === sourceId && /EMMI response rule/i.test(chunk.heading));
  const withRule = selected.map(entry => {
    const rule = ruleFor(entry.chunk.sourceId);
    if (!rule || rule.id === entry.chunk.id) return entry;
    return { ...entry, chunk: { ...entry.chunk, text: `${entry.chunk.text}\n\n## ${rule.heading}\n\n${rule.text}` } };
  });

  return {
    intent: classification.intent,
    riskLevel: classification.riskLevel,
    personalized: classification.personalized,
    requiredTool: classification.requiredTool,
    mustNotAnswerAlone: classification.mustNotAnswerAlone,
    sourcePriority: SOURCE_PRIORITY.ITERA_KNOWLEDGE_BASE,
    knowledgeVersion: index.builtAt,
    chunks: withRule.map(entry => ({
      sourceId: entry.chunk.sourceId,
      sourcePath: entry.chunk.sourcePath,
      title: entry.chunk.metadata.title,
      heading: entry.chunk.heading,
      category: entry.chunk.metadata.category,
      program: entry.chunk.metadata.program,
      riskLevel: entry.chunk.metadata.riskLevel,
      requiresToolWhenPersonalized: entry.chunk.metadata.requiresToolWhenPersonalized,
      lastReviewed: entry.chunk.metadata.lastReviewed,
      score: entry.score,
      text: entry.chunk.text,
      localizedAnswers: entry.chunk.localizedAnswers || {}
    }))
  };
}

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(JSON.stringify(body));
};

const readBody = req => new Promise(resolve => {
  let raw = "";
  req.on("data", part => { raw += part; if (raw.length > 8000) raw = raw.slice(0, 8000); });
  req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); } });
  req.on("error", () => resolve({}));
});

export async function handleEmmiKnowledge(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
  const payload = req.body && typeof req.body === "object" ? req.body : await readBody(req);
  const query = String(payload.query || "").slice(0, 500);
  if (!query.trim()) return json(res, 400, { error: "query_required" });
  try {
    // Only non-identifying journey context is accepted: no PHI is needed to pick a document.
    const runtime = {
      program: payload.program ? String(payload.program).slice(0, 32) : null,
      currentScreen: payload.currentScreen ? String(payload.currentScreen).slice(0, 64) : null
    };
    const topK = Math.max(1, Math.min(6, Number(payload.topK) || 4));
    return json(res, 200, retrieveKnowledge({ query, runtime, topK }));
  } catch {
    return json(res, 500, { error: "knowledge_unavailable" });
  }
}
