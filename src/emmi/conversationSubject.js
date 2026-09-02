// Two things a patient does constantly that the orchestrator could not follow.
//
// They ask about one thing and then keep talking about it without naming it again — "and does that
// cost anything?", "how much?", "y eso lo cubre Medicare?". Retrieval received those words alone
// and had nothing to rank on, so a question about the monitor came back as a general programme
// page. resolveConversationSubject reads the subject back out of the conversation so the query
// carries what the patient no longer bothers to repeat.
//
// And they ask two things in one breath — "am I eligible and how much does it cost?". The
// orchestrator is a chain of routes that returns on the first match, so the second half was
// dropped in silence. decomposeCompoundQuestion splits the turn so each half can be routed on its
// own merits.
//
// Both are deliberately lexical. This file must not decide what a question means; it only decides
// what the patient is talking about and where one question ends and the next begins.

const words = value => String(value || "").trim().split(/\s+/).filter(Boolean);

// Ordered by how strongly each one claims to be what the sentence is *about*. Concrete things the
// patient can hold or attend come first; "cost" comes last and is marked weak, because "how much
// does it cost?" is a question about whatever "it" is, not a question about cost. Get this order
// wrong and "how much does ACCESS cost?" carries the word "cost" into the next turn instead of
// ACCESS, which is the whole thing the patient was asking about.
//
// The label is what gets appended to the retrieval query, so each one is written as the words a
// knowledge page would actually use.
const SUBJECTS = Object.freeze([
  { key: "DEVICE", label: "blood pressure monitor device", pattern: /\b(monitor|cuff|device|tenovi|pylo)\b|tensi[oó]metro|braza(?:lete|dera)|aparato|apar[eè]y|monit[eè]/i },
  { key: "MEDICATION", label: "medication refill prescription", pattern: /\b(medication|medications|medicine|medicines|pill|pills|prescription|refill|dose)\b|medicamento|medicina|pastilla|receta|resurtir|dosis|medikaman|renmèd|ranplisaj|d[oò]z/i },
  { key: "APPOINTMENT", label: "appointment visit", pattern: /\b(appointment|appointments|visit|visits)\b|cita|citas|consulta|visita|randevou|vizit/i },
  { key: "TRANSPORT", label: "transportation ride to appointments", pattern: /\b(ride|rides|transportation|transport|uber|lyft|taxi|bus)\b|transporte|pasaje|viaje|transp[oò]|woulib/i },
  { key: "REPRESENTATIVE", label: "personal representative care circle", pattern: /\b(personal representative|care circle|caregiver|family member)\b|representante personal|c[ií]rculo de cuidado|cuidador|reprezantan|sèk swen/i },
  { key: "CARE_TEAM", label: "care team", pattern: /\b(care team|care manager|nurse|doctor|physician|cardiologist|specialist)\b|equipo de (?:atenci[oó]n|cuidado)|gerente de cuidado|enfermer[ao]|m[eé]dico|doctora?|cardi[oó]log[ao]|ekip swen|enfimy[eè]|dokt[eè]/i },
  { key: "CONSENT", label: "consent", pattern: /\bconsent\b|consentimiento|konsantman/i },
  { key: "PRIVACY", label: "privacy who can see my information", pattern: /\b(privacy|private|confidential|who can see|shared with)\b|privacidad|confidencial|qui[eé]n puede ver|konfidansyèl|ki moun ki ka w[eè]/i },
  { key: "QMB", label: "QMB Qualified Medicare Beneficiary", pattern: /\bqmb\b|qualified medicare beneficiary|beneficiario calificado/i },
  { key: "MEDIGAP", label: "Medigap supplement", pattern: /\bmedigap\b|supplement(?:al)? (?:plan|insurance)|p[oó]liza suplementaria|seguro suplementario/i },
  { key: "ADVANTAGE", label: "Medicare Advantage", pattern: /medicare advantage|\bpart c\b|parte c/i },
  { key: "A1C", label: "A1c", pattern: /\ba1c\b|hemoglobin a1c|hemoglobina/i },
  { key: "WEIGHT", label: "weight", pattern: /\b(weight|pounds?|lbs?|bmi)\b|peso|libras|imc|pwa|liv/i },
  { key: "READING", label: "blood pressure reading", pattern: /\b(reading|readings|measurement|systolic|diastolic|mmhg|blood pressure|\bbp\b)\b|lectura|medici[oó]n|presi[oó]n arterial|sist[oó]lica|diast[oó]lica|lekti|mezi|tansyon/i },
  { key: "GOALS", label: "care plan goals", pattern: /\b(goal|goals|care plan|target)\b|meta|metas|plan de cuidado|objetivo|objektif|plan swen/i },
  { key: "LEAVING", label: "leaving the program", pattern: /\b(leaving|quit|opt out|withdraw|unenroll)\b|dejar el programa|salir del programa|retirarme|kite pwogram/i },
  { key: "ENROLLMENT", label: "enrollment signing up", pattern: /\b(enroll|enrolled|enrolling|enrollment|sign(?:ing)? up)\b|inscri(?:bir|pci[oó]n|to)|enskri|enskripsyon/i },
  { key: "ACCESS", label: "ACCESS program", pattern: /\bACCESS\b/ },
  { key: "CCM", label: "CCM chronic care management", pattern: /\bCCM\b/ },
  { key: "RPM", label: "RPM remote patient monitoring", pattern: /\bRPM\b/ },
  { key: "PCM", label: "PCM principal care management", pattern: /\bPCM\b/ },
  { key: "APCM", label: "APCM advanced primary care management", pattern: /\bAPCM\b/ },
  { key: "ASM", label: "ASM", pattern: /\bASM\b/ },
  { key: "MEDICARE", label: "Medicare Part B coverage", pattern: /\bmedicare\b|\bpart [ab]\b|parte [ab]|deducible|deductible|coinsurance|coseguro/i },
  { key: "COST", label: "cost to the patient", weak: true, pattern: /\b(cost|costs|copay|charge|bill|billing|pay|payment)\b|costo|copago|factura|cobro|pago|pri|k[oò]b|peye/i }
]);

// The subject named by a single piece of text, or null. Programme acronyms are matched
// case-sensitively so the English word "access" in "how do I access the app" is not read as the
// ACCESS programme.
export const subjectOf = text => {
  const value = String(text || "");
  if (!value.trim()) return null;
  return SUBJECTS.find(subject => subject.pattern.test(value)) || null;
};

// A turn that opens with a connector, or leans on a bare "that" with no subject of its own, is
// carrying its subject over from earlier. So is a very short turn: "how much?" is a whole question
// only because something came before it.
const CONTINUATION_OPENER = /^(?:and|also|ok(?:ay)?[, ]+(?:and|but)|but|what about|how about|and what|and how|y|e|pero|tambi[eé]n|qu[eé] tal|y qu[eé]|epi|men)\b/i;
// A demonstrative only stands for an earlier subject when it is standing alone. In "who created
// this program?" the "this" is a determiner naming the thing right there in the sentence, and
// reading it as a referent made a self-contained question inherit an unrelated topic. So a
// demonstrative counts only when a verb follows it, or when the clause ends on it. Pronouns
// proper — it, them, they — always count.
const VERB_AFTER_REFERENT = "is|are|was|were|will|would|can|could|do|does|did|has|have|cost|costs|mean|means|work|works|help|helps|cover|covered|covers|include|included|includes|apply|applies|matter|matters|take|takes|change|changes|count|counts|required|needed|allowed|paid";
const BARE_REFERENT = new RegExp(
  `\\b(?:it|its|them|they|the same|lo mismo|la misma|li|yo)\\b`
  + `|\\b(?:that|this|those|these|eso|esto|esa|ese|esos|esas|sa)\\b(?:\\s*[?.!,]|$|\\s+(?:${VERB_AFTER_REFERENT})\\b)`,
  "i"
);

// "Is it private?" names privacy, but "it" is still pointing at something said earlier. Inside a
// compound question that earlier thing is the other half, so a bare referent is enough to inherit
// the subject even when the part looks self-contained.
export const hasBareReferent = question => BARE_REFERENT.test(String(question || ""));

// "Is this a scam?" and "¿Esto es real?" point at the whole situation, not at whatever was being
// discussed a turn ago. Treating that "this" as a referent made the question inherit an unrelated
// subject — a patient asking whether they were being defrauded had "weight" appended to their
// query and got no answer at all. A copula with a predicate noun or a plain adjective is the
// patient asking about where they are, and it carries nothing.
const SELF_REFERENTIAL = /^(?:so\s+)?(?:is|are|was|were)\s+(?:this|that|it|all of this)\s+(?:a|an|some kind of|for)?\s*(?:scam|fraud|fake|real|legit(?:imate)?|safe|true|trick|spam|phishing|serious)\b|^(?:¿\s*)?(?:es|ser[aá])\s+(?:esto|eso)\s+(?:una?\s+)?(?:estafa|fraude|falso|real|leg[ií]timo|seguro|verdad|enga[nñ]o)\b|^(?:¿\s*)?(?:esto|eso)\s+es\s+(?:una?\s+)?(?:estafa|fraude|falso|real|leg[ií]timo|seguro|verdad|enga[nñ]o)\b|^(?:[eè]ske\s+)?(?:sa|li)\s+se\s+(?:yon\s+)?(?:awnak|magouy|vre|serye|s[eè]|fo)\b/i;

// A short copula question about "this" or "that" with a bare predicate — "Is this HIPAA compliant?",
// "Is this required?" — asks about the situation the patient is in, the same way "Is this a scam?"
// does. "It" is left out on purpose: it is a pronoun standing for something already named, so "is
// it free?" after a turn about the monitor is genuinely asking whether the monitor is free.
// "This", not "that". "That" points back at something just said — "is that covered?" is a genuine
// follow-up and must keep inheriting its subject.
const SITUATION_COPULA = /^(?:¿\s*)?(?:is|are|was|were)\s+(?:this|all of this)\s+(?:a|an)?\s*[\w-]+(?:\s+[\w-]+)?\s*\??$/i;

export const isFollowUpQuestion = question => {
  const value = String(question || "").trim();
  if (!value) return false;
  if (CONTINUATION_OPENER.test(value)) return true;
  if (SELF_REFERENTIAL.test(value) || SITUATION_COPULA.test(value)) return false;
  const own = subjectOf(value);
  if (own && !own.weak) return false;
  if (BARE_REFERENT.test(value)) return true;
  // Four words, and this was measured rather than reasoned. Three looks tidier — it stops "Can I
  // take ibuprofen?" inheriting a topic it does not need — but the regression showed it also stops
  // "Should I keep trying?", "Who do I tell?" and "Next week if possible.", which are follow-ups
  // that have genuinely stopped saying what they are about. Those eleven turns went back to
  // answering "I don't have enough approved information".
  //
  // Word count cannot tell the two apart, and the two failures are not equal: a spurious subject
  // adds noise to a query that still answers correctly, while a missing one loses the answer
  // entirely. So this stays at four, and the cost is a little noise on short self-contained
  // questions.
  return words(value).length <= 4;
};

// Walks the conversation backwards and returns the label of the last subject anyone named. The
// patient's own turns are preferred over EMMI's: what the patient last talked about is a better
// guide to what they mean now than whatever EMMI happened to mention in a long answer.
export const resolveConversationSubject = (conversation = {}) => {
  const turns = Array.isArray(conversation.recentTurns) ? conversation.recentTurns : [];
  const ordered = [...turns].reverse();
  const isUser = turn => (turn?.role || "user") === "user";
  // Strong subjects across the whole window before weak ones anywhere: a turn that mentioned only
  // "cost" is a worse thing to carry forward than an earlier turn that named the monitor.
  for (const wantWeak of [false, true]) {
    for (const wantUser of [true, false]) {
      for (const turn of ordered) {
        if (isUser(turn) !== wantUser) continue;
        const subject = subjectOf(turn?.text);
        if (subject && Boolean(subject.weak) === wantWeak) return subject.label;
      }
    }
  }
  return subjectOf(conversation.conversationSummary)?.label || "";
};

// What this turn is about, whether the patient said it in this turn or three turns ago. Routes use
// it to tell "how much does ACCESS cost?" apart from the same words asked about a monitor, a ride
// or a prescription — three things with three different answers and one shared phrasing.
// fromConversation separates two different strengths of evidence. A subject the patient named in
// this turn, or handed over from the other half of the same question, is strong enough to decide
// which route answers them. A subject merely inherited from an earlier turn is not: it is a good
// hint for ranking documents and a bad reason to send a question somewhere else. Ignoring that
// distinction sent "am I going to get a bill for this?" to the knowledge base, because the turn
// before it had been about the monitor — and the patient stopped being told their $0.
export const resolveTurnSubject = ({ question, conversation = {}, carriedSubject = "", fromConversation = true } = {}) => {
  const own = subjectOf(question);
  if (own && !own.weak) return own;
  const inherited = fromConversation && isFollowUpQuestion(question) ? resolveConversationSubject(conversation) : "";
  const label = carriedSubject || inherited;
  return SUBJECTS.find(subject => subject.label === label) || own || null;
};

// Words that can start a second question. Splitting only in front of one of these keeps ordinary
// noun lists intact: "my medications and my appointments" stays one question, because "my" is not
// here, while "am I eligible and how much is it" becomes two, because "how" is.
const QUESTION_OPENER = [
  "what", "what's", "whats", "how", "when", "where", "who", "which", "why",
  "can", "could", "do", "does", "did", "is", "are", "will", "would", "should", "am",
  "tell me", "explain", "i (?:also )?(?:want|need|would like|have) to",
  "qu[eé]", "cu[aá]l(?:es)?", "cu[aá]nto(?:s|a|as)?", "c[oó]mo", "cu[aá]ndo", "d[oó]nde", "qui[eé]n(?:es)?", "por qu[eé]",
  "puedo", "puede", "hay", "es", "son", "tengo", "debo", "necesito", "d[ií]game", "expl[ií]queme",
  "(?:tambi[eé]n )?quiero saber",
  "kisa", "kijan", "kil[eè]", "konbyen", "ki kote", "ki moun", "poukisa", "[eè]ske", "mwen ka", "di m"
].join("|");

const COMPOUND_JOIN = new RegExp(
  `[,;]?\\s+(?:and(?:\\s+also)?|also|plus|but|y(?:\\s+tambi[eé]n)?|adem[aá]s|tambi[eé]n|pero|epi(?:\\s+tou)?|men)\\s+(?=(?:${QUESTION_OPENER})\\b)`,
  "i"
);

// "Can I keep the monitor and stay in the program?" is two questions sharing one modal. The second
// half has no question word of its own — it starts with a bare verb — so the connector split cannot
// see it, and the patient got an answer about the monitor and nothing about staying enrolled.
// Splitting here lends the modal to the half that lost it.
const SHARED_MODAL_VERB = /\s+(?:and|y|epi)\s+(?=(?:keep|stay|continue|remain|still\s+\w+|seguir|continuar|quedarme|mantener|permanecer|rete|kontinye|kenbe)\b)/i;
const MODAL_HEAD = /\b(?:can|could|will|would|may|do|am|should)\s+(?:i|we)\b|\b(?:puedo|podr[ií]a|podemos|debo)\b|\bmwen ka\b/i;

const lendModal = part => {
  const split = part.match(SHARED_MODAL_VERB);
  if (!split) return [part];
  const head = part.slice(0, split.index);
  const modal = head.match(MODAL_HEAD);
  if (!modal) return [part];
  return [head, `${modal[0]} ${part.slice(split.index + split[0].length)}`];
};

const splitOnce = (value, pattern) => {
  const match = value.match(pattern);
  if (!match) return [value];
  return [value.slice(0, match.index), value.slice(match.index + match[0].length)];
};

// Splits a turn into the separate questions it actually contains. Returns a single-element array
// when the turn is one question, which is the overwhelmingly common case and the one that must
// stay cheap.
//
// Capped at three parts: beyond that the patient is telling a story, not asking a list, and
// answering it in pieces reads worse than answering the first thing well.
export const decomposeCompoundQuestion = text => {
  const value = String(text || "").trim();
  if (!value) return [];
  const bySentence = value
    .split(/\?+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map((part, index, all) => (index < all.length - 1 || /\?\s*$/.test(value) ? `${part}?` : part));

  const parts = [];
  for (const sentence of bySentence.length ? bySentence : [value]) {
    for (const piece of splitOnce(sentence, COMPOUND_JOIN)) {
      for (const clause of lendModal(piece)) {
        const trimmed = clause.trim().replace(/^[,;\s]+/, "");
        if (trimmed) parts.push(trimmed);
      }
    }
  }

  // Two words, not three: Spanish and Haitian Creole drop the subject pronoun, so "¿Soy elegible?"
  // and "konbyen sa koute?" are whole questions that an English-sized minimum would discard,
  // silently collapsing the turn back to one part.
  const usable = parts.filter(part => words(part).length >= 2);
  if (usable.length < 2) return [value];
  return usable.slice(0, 3);
};

// Two answers to two halves of one question have to read as one reply. Anything the patient would
// notice as repetition is dropped: an identical answer, an answer already contained in an earlier
// one, and the "I don't have enough approved information" line whenever a real answer stands
// beside it.
const normalize = text => String(text || "").toLowerCase().replace(/[^a-z0-9áéíóúüñèòàç ]/gi, "").replace(/\s+/g, " ").trim();
const sentencesOf = text => (String(text || "").match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || []).map(part => part.trim()).filter(Boolean);

export const mergeCompoundAnswers = (answers, { unavailableText = "" } = {}) => {
  const kept = [];
  for (const answer of answers.map(item => String(item || "").trim()).filter(Boolean)) {
    const normalized = normalize(answer);
    const duplicate = kept.some(existing => {
      const other = normalize(existing);
      return other === normalized || other.includes(normalized) || normalized.includes(other);
    });
    if (!duplicate) kept.push(answer);
  }
  if (kept.length < 2) return kept[0] || "";
  const answered = unavailableText ? kept.filter(item => item.trim() !== unavailableText.trim()) : kept;
  const parts = answered.length ? answered : kept;

  // Two halves of one question often overlap without being identical: asked how to set up the
  // monitor and whether it needs Wi-Fi, both halves answered the Wi-Fi part in their own words, and
  // the patient read it twice. Whole-answer comparison cannot see that, so drop any sentence a
  // later half repeats from an earlier one. A half left with nothing of its own is dropped whole.
  const seen = new Set();
  const merged = [];
  for (const part of parts) {
    const fresh = sentencesOf(part).filter(sentence => {
      const key = normalize(sentence);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length) merged.push(fresh.join(" "));
  }
  return merged.join("\n\n") || parts[0];
};
