import { classifyBarrierText } from "../goalBarriers.js";
import { GOAL_STATEMENT_KINDS, classifyGoalStatement } from "../personalGoals.js";
import { APPOINTMENT_INTENTS, APPOINTMENT_INTENT_ACTIONS, classifyAppointmentIntent } from "./appointmentIntents.js";
import { createSafetyEpisode, detectEmergencyLanguage, detectSafetyResolution, safetyEpisodeIsActive, safetyResolutionCopy, safetyResponseFor } from "./safetyPolicy.js";
import { conversationPolicyResponse } from "./conversationPolicy.js";
import { emmiGuardrailAnswer } from "./guardrails.js";
import { CARE_TEAM_CONTACT_INTENT, careTeamContactPrompt, detectCareTeamContact } from "./careTeamContact.js";
import { resolveRequestedProfessional } from "../careTeamDirectory.js";
import { decomposeCompoundQuestion, hasBareReferent, isFollowUpQuestion, mergeCompoundAnswers, resolveConversationSubject, resolveTurnSubject, subjectOf } from "./conversationSubject.js";
import { appointmentTopicListText, parseAppointmentTopicCommands } from "./appointmentTopics.js";
const pick = (locale, values) => values[String(locale || "EN").toUpperCase()] || values.EN;
const clean = value => String(value || "").replace(/\s+/g, " ").trim();
const lower = value => clean(value).toLowerCase();
const topicKey = value => lower(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// "Why do you need this?" is a question about the screen the patient is looking at, answered by
// that screen's own explanation. It is deliberately narrow in two directions: asking why the
// invitation *arrived* is INVITATION_SOURCE below, and asking why something on a record is held
// — "why do you need my medications" — is a question about that content, not about the screen.
// So the object has to be the screen itself or the verification it is asking for.
const SCREEN_HELP = /why (do|does) (you|we|itera|medicare) need (this|that|it|to verify|my (zip|postal|date of birth|birth ?date|identity|information|info))|why are you asking (me )?(for )?(this|that|my (zip|postal|date of birth|birth ?date))|why do i (have to|need to) (give|provide|share|enter) (this|that|my (zip|postal|date of birth|birth ?date))|por qu[eé] (necesitan|necesita|piden|pide) (esto|eso|verificar|mi (c[oó]digo postal|fecha de nacimiento|identidad|informaci[oó]n))|para qu[eé] (necesitan|necesita) (esto|eso|mi (c[oó]digo postal|fecha de nacimiento))|poukisa (ou|nou) bezwen (sa|k[oò]d postal|dat nesans|verifye)|poukisa w ap mande (sa|k[oò]d postal|dat nesans)|what is this screen|which (one|option) should i (choose|pick)|explain (this|the screen)|qué significa esta pantalla|cuál debo escoger|qué opción debo elegir|explique (esto|esta pantalla)|ki opsyon pou m chwazi|eksplike ekran|(?:what (?:do i|should i) do|help (?:me )?with this|(?:don'?t|do not) understand|qué (?:debo|tengo que) hacer|no entiendo|kisa pou m fè|mwen pa konprann)(?:\s+(?:this|it|that|any of this|the screen|this screen|this page|this step|this part|these questions|now|next|here|esto|eso|nada de esto|esta pantalla|en esta pantalla|la pantalla|aqu[ií]|ahora|este paso|sa|ekran sa a|kounye a)){0,3}\s*[?.!]*\s*$/i;
// Phones and speech transcription produce a typographic apostrophe. Every gate below is written
// with a straight one, so "I can’t breathe" used to fall past the safety gate entirely. The
// patterns are matched against a folded copy of the question; the patient's own text is
// untouched and is what still reaches the tools.
// The words that make an appointment the subject of a conversation, in all three languages.
const APPOINTMENT_MENTION = /\bappointment|\bvisit\b|\bcita\b|\bconsulta\b|\bvisita\b|randevou|vizit/i;
const APPOINTMENT_TRANSPORTATION = /\b(uber|ride|transportation|transport|pickup|reservation|trip|transporte|recogida|reserva|viaje|transp[oò]|taksi|machin|pran)\b/i;
const APPOINTMENT_COMPANION = /\b(companion|accompany|come with me|go with me|someone with me|family member|relative|acompa[ñn](?:ante|ar|e|a|ó|ado|ada|aría)|ir conmigo|familiar|pariente|akonpaye|vin av[eè] m|fanmi)\b/i;
const COMPANION_PRIVACY = /\b(see|share|information|health|private|privacy|ver[aá]|compartir|informaci[oó]n|salud|privad|datos|w[eè]|pataje|enf[oò]masyon|sante|prive)\b/i;
const foldApostrophes = value => String(value || "").replace(/[‘’ʼ]/g, "'");
const SAFETY = { test: detectEmergencyLanguage };
const BP_READING = /(\d{2,3})\s*(?:over|\/|sobre|con)\s*(\d{2,3})/i;
// Anchored on word boundaries. Without them "pri" matched inside "Lisinopril", "priority" and
// "private", so asking what a medication is came back as an answer about the ACCESS cost.
// A question that quotes an amount is a question about money in any language, and "why does it say
// $0" is the most likely thing a patient asks on the consent screen.
// What a patient is talking about when the cost question is not about ACCESS at all.
const TRANSPORT_SUBJECT = /\b(uber|lyft|taxi|cab|ride|rides|rideshare|transportation|transport|bus fare|mileage)\b|transporte|taxi|viaje|pasaje|transp[o\u00f2]|woulib/i;
const COST = /\$\s?\d|\b(how much|cost|costs|pay|pays|paying|owe|charge|charged|bill|billed|copay|coinsurance|deductible|price|cu[a\u00e1]nto|costo|costos|pagar|pago|precio|copago|coseguro|deducible|konbyen|pri|peye|koute)\b/
const ELIGIBILITY = /am i eligible|do i qualify|my eligibility|am i enrolled|did i enroll|have i enrolled|am i signed up|soy elegible|califico|mi elegibilidad|estoy inscrito|ya me inscrib|mwen kalifye|kalifikasyon mwen|mwen enskri|èske m enskri/i;
const MEDICATION_LIST = /what (medications|medicines|pills).*(have|file|registered)|medications.*(have|file)|qu[eé] medicamentos.*(tienen|registr)|medicamentos registrados|ki medikaman.*dosye|medikaman.*genyen/i;
const DEVICE_STATUS = /what (monitor|device) do i have|which (monitor|device)|is my (monitor|device).*(connected|assigned)|(?:when|has|did|will).*(monitor|device).*(ship|sent|arrive|deliver)|(?:monitor|device).*(ship|sent|arrive|deliver)|qu[eé] (monitor|aparato).*(tengo|asign)|(?:est[aá].*(monitor|aparato).*(conect)|conectad[oa]?.*(monitor|aparato))|(?:cu[aá]ndo|ya|van a|me van a).*(enviar|env[ií]o|llegar|recibir|entregar).*(monitor|aparato)|(enviar|env[ií]o|llegar|recibir|entregar).*(monitor|aparato)|ki apar[eè]y.*genyen|(?:apar[eè]y.*konekte|konekte.*apar[eè]y)|(?:kil[eè]|deja).*(voye|rive|resevwa).*(apar[eè]y|monit[eè])/i;
const DEVICE_FULFILLMENT = /ship|sent|arrive|deliver|env[ií]o|enviar|llegar|recibir|entregar|voye|rive|resevwa/i;
const GOAL_STATUS = /what is my goal|what are my goals|my current goal|my goals|cu[aá]l es mi meta|cu[aá]les son mis metas|mis metas|ki objektif mwen/i;
// "What am I doing about it" is a different question from "what is it", and answering the first
// with the second is exactly the confusion this feature exists to remove. It asks about the plan:
// the steps, not the outcome.
const GOAL_PLAN_QUESTION = /what (am i|do i have to|should i) do(ing)?\b[^?]{0,40}\b(goal|plan)|my (steps|plan) for|steps? (in|of) my (plan|goal)|what.{0,20}\b(steps|actions)\b.{0,20}\bgoal|qu[eé] (tengo que|debo|estoy) hac(er|iendo)|mis pasos|los pasos de mi (plan|meta)|plan de mi meta|kisa (pou )?m ap fè|etap mwen/i;
// The patient describing something they want. Deliberately broad on the wanting and narrow on the
// asking: it must not swallow "I want to know what this costs", which is a question, not a goal.
const GOAL_SETTING = /\b(set|add|create|make)\b[^.?!]{0,20}\b(a )?(new )?goal\b|\bmy goal (is|would be)\b|\bnueva meta\b|\b(crear|poner|agregar|a[ñn]adir|definir)\b[^.?!]{0,20}\bmeta\b|\bmi meta (es|ser[ií]a)\b|\bnouvo objektif\b|^(i (want|would like|'d like) to|quiero|me gustar[ií]a|quisiera|mwen vle)\b(?!.{0,30}\b(know|understand|ask|see|check|talk|speak|call|cancel|leave|saber|entender|preguntar|ver|revisar|hablar|llamar|cancelar|salir|konnen|konprann|mande|wè|pale|rele)\b)/i;
// Changing what the patient does, which is a step and never the goal's name.
const GOAL_STEP_CHANGE = /\b(change|make|switch|update)\b[^.?!]{0,30}\b(walk|walking|step|reminder|routine)\b[^.?!]{0,30}\b(to|into)\b|\b(cambia|cambiar|cambie|actualiza|pon|poner)\b[^.?!]{0,30}\b(caminata|paso|rutina|recordatorio)\b|\bchanje\b[^.?!]{0,30}\b(mache|etap)\b/i;
// A saved appointment-prep topic is often submitted verbatim (for example "BP Readings") after
// EMMI asks which topic to discuss. Treat that short label as a request for the patient's actual
// reading. Otherwise it falls through to knowledge retrieval, where an older conversation topic
// can outrank these two words and produce an unrelated answer.
const LATEST_HEALTH_READING = /latest (blood pressure )?reading|my (blood pressure|bp).*(reading|today)|what does my.*reading|^(my )?(blood pressure|bp) readings?$|lectura (m[aá]s reciente|de hoy)|mi presi[oó]n.*(lectura|hoy)|^(mis? )?lecturas? de (la )?presi[oó]n( arterial)?$|d[eè]nye lekti|tansyon mwen.*jodi|^(mezi|lekti) tansyon( mwen)?( yo)?$/i;
const HEALTH_TREND = /how has my (blood pressure|bp)|pressure.*this week|reading trend|blood pressure trend|c[oó]mo ha estado mi presi[oó]n|tendencia.*presi[oó]n|kijan tansyon mwen|tandans.*tansyon/i;
const CLINICAL_TARGET = /my (blood pressure )?target|expected range|rango esperado|objetivo.*presi[oó]n|sib tansyon|limit.*tansyon/i;
// A request for the number to be different, as opposed to a question about what it is.
const WANTS_A_DIFFERENT_NUMBER = /\b(i want|i'?d like|i would like|can you (change|set|lower|raise)|change|set|make|lower|raise)\b|\b(quiero|me gustar[ií]a|quisiera|cambi(a|ar|e)|pon(er|ga)?|baj(a|ar|e)|sub(a|ir|e))\b|\bmwen vle\b|\bchanje\b/i;
const GOAL_PROGRESS = /goal progress|how am i doing.*goal|progreso.*meta|c[oó]mo voy.*meta|pwogr[eè].*objektif/i;
// Where this patient started, and what ACCESS will recognise as improvement for them.
//
// Both are facts about one person. The knowledge base can explain what a baseline is and what the
// program measures; it has no way of knowing that THIS patient started at 152, so a question in
// either family must never reach retrieval. They are matched ahead of COST below, because "how
// much is 5% for me" is a question about a weight goal that the word "how much" would otherwise
// send to the cost engine.
const ACCESS_BASELINE = /(starting|baseline)\s*(blood pressure|bp|systolic|weight|point)|what (was|is) my (starting|baseline)|where did i start|(presi[oó]n|peso)\s*(arterial\s*)?inicial|l[ií]nea base|punto de partida|pwen depa|(tansyon|pwa)[^?]*konmansman/i;
const ACCESS_MILESTONE = /\d+\s*(mmhg|points?|puntos?|pwen)\s*(lower|below|less|menos|m[aá]s baj|pi ba)|(how much|cu[aá]nto|konbyen)[^?]*\d+\s*%|\d+\s*%[^?]*(for me|mean|means|para m[ií]|significa|pou mwen|vle di)|improvement milestone|hito de mejora|etap amelyorasyon/i;
// Which goal the patient meant. A percentage belongs to the weight goal and mmHg to the blood
// pressure one, because that is how each rule is written. When the question names neither, both
// baselines are reported rather than one of them being guessed at.
const WEIGHT_SUBJECT = /weight|pounds?|\blbs?\b|bmi|%|percent|peso|libras?|imc|por ?ciento|pwa|liv/i;
const BLOOD_PRESSURE_SUBJECT = /blood pressure|\bbp\b|systolic|mmhg|points?|presi[oó]n|sist[oó]lica|puntos?|tansyon|sistolik|pwen/i;
const APPOINTMENT_PREP_FOLLOW_UP = /^(what|how|why|can|could|is|are|does|do|tell me|explain|que|qué|como|cómo|por que|por qué|puede|podria|podría|es|son|diga|digame|dígame|explique|kisa|kijan|poukisa|eske|èske|esplike)\b/i;
const APPOINTMENT_PREP_TREND = /trend|this week|recently|changed|going|how (have|are|is)|tendencia|esta semana|[uú]ltimamente|cambiado|c[oó]mo (han|ha|va)|tandans|sem[eè]n|d[eè]ny[eè]man|chanje|kijan/i;
// These are interpreted as completion only while structured appointment-prep context is active.
// Include the short, natural confirmations patients actually use after EMMI asks “¿eso es todo?”;
// without “es todo”, that exact reply fell through to the unrelated knowledge fallback.
const APPOINTMENT_PREP_DONE = /^(solo eso|(?:s[ií][, ]+)?(?:(?:eso|esto) )?es todo|por ahora (?:eso )?es todo|con eso (?:es|ser[ií]a) todo|nada m[aá]s|no[, ]+(?:es todo|nada m[aá]s)|solamente eso|list[oa]|ya est[aá]|ya termin[eé]|termin[eé]|he terminado|that'?s all|that is all|just that|nothing else|i'?m done|done|all done|finished|ready|se tout|sa s[eè]lman|pa gen anyen ank[oò]|mwen fini|fini|pare)[.! ]*$/i;
const APPOINTMENT_PREP_CONTINUE = /pregunta sobre (mi|la) cita|ay[uú]dame a preparar|seguir preparando|preparar (mi|la) cita|question about my appointment|help me prepare|continue preparing|prepare for my appointment|kesyon sou randevou|ede m prepare|kontinye prepare/i;
const APPOINTMENT_PURPOSE_QUESTION = /(?:why|what).*(?:appointment|visit).*(?:for|about)|purpose of (?:my|the) (?:appointment|visit)|why (?:do i have|was).*appointment|por qu[eé].*(?:cita|consulta|visita)|para qu[eé] es (?:mi|la) cita|(?:objetivo|motivo) de (?:mi|la) cita|poukisa.*(?:randevou|vizit)|(?:objektif|rezon).*(?:randevou|vizit)/i;
const APPOINTMENT_PREP_QUESTION = /\?$|^(what|why|how|when|where|who|can|could|is|are|does|do|qu[eé]|por qu[eé]|c[oó]mo|cu[aá]ndo|d[oó]nde|qui[eé]n|puede|es|son|kisa|poukisa|kijan|kil[eè]|ki kote|eske|[eè]ske)\b/i;

// Resolve the patient's active subject from their saved prep list and their own recent turns. An
// assistant message may mention every topic at once, so it is deliberately not evidence of which
// one the patient selected. With one saved topic, a short follow-up can safely refer to that topic.
export const resolveAppointmentPrepTopic = ({ question, conversation = {}, appointmentPrep = null } = {}) => {
  const topics = Array.isArray(appointmentPrep?.topics) ? appointmentPrep.topics.map(clean).filter(Boolean) : [];
  if (!topics.length) return "";
  const questionKey = topicKey(question);
  const direct = topics.find(topic => {
    const key = topicKey(topic);
    return key && (questionKey === key || questionKey.includes(key));
  });
  if (direct) return direct;
  const shortFollowUp = questionKey.split(" ").length <= 10 && APPOINTMENT_PREP_FOLLOW_UP.test(questionKey);
  if (!shortFollowUp) return "";
  const recentUserTurns = [...(conversation.recentTurns || [])].reverse().filter(turn => turn?.role === "user");
  const prior = topics.find(topic => recentUserTurns.some(turn => topicKey(turn.text).includes(topicKey(topic))));
  return prior || (topics.length === 1 ? topics[0] : "");
};

const appointmentPrepSummary = (appointmentPrep, locale) => {
  const topics = (appointmentPrep?.topics || []).map(clean).filter(Boolean).filter(topic => !/medication|medicine|medicamento|medikaman/i.test(topic));
  const medications = (appointmentPrep?.medications || []).map(item => clean(item?.name)).filter(Boolean);
  const parts = [
    ...topics.map(topic => `“${topic}”`),
    ...(medications.length ? [pick(locale, { EN: `medications: ${medications.join(", ")}`, ES: `medicamentos: ${medications.join(", ")}`, KR: `medikaman: ${medications.join(", ")}` })] : [])
  ];
  return parts.join(", ");
};

const APPOINTMENT_PURPOSES = Object.freeze({
  MEDICATION_RENEWAL: {
    EN: "renewing a medication and reviewing any related questions with the clinician",
    ES: "renovar un medicamento y revisar con el profesional cualquier pregunta relacionada",
    KR: "renouvle yon medikaman epi revize nenpòt kesyon ki gen rapò ak pwofesyonèl klinik la"
  },
  MEDICATION_CONCERN: {
    EN: "reviewing a medication concern with the clinician",
    ES: "revisar con el profesional una preocupación sobre un medicamento",
    KR: "revize yon enkyetid sou yon medikaman ak pwofesyonèl klinik la"
  },
  BLOOD_PRESSURE_FOLLOW_UP: {
    EN: "following up on blood pressure, including the readings and concerns you want the clinician to review",
    ES: "dar seguimiento a la presión arterial, incluidas las lecturas y preocupaciones que quiere revisar con el profesional",
    KR: "fè swivi tansyon, ansanm ak mezi ak enkyetid ou vle revize ak pwofesyonèl klinik la"
  },
  SYMPTOM_REVIEW: {
    EN: "discussing something you have been feeling so the clinician can review it with you",
    ES: "conversar sobre algo que ha estado sintiendo para que el profesional pueda revisarlo con usted",
    KR: "pale sou yon bagay ou santi pou pwofesyonèl klinik la ka revize li avèk ou"
  },
  DEVICE_SUPPORT: {
    EN: "reviewing a question or difficulty with your health device",
    ES: "revisar una pregunta o dificultad con su dispositivo de salud",
    KR: "revize yon kesyon oswa difikilte ak aparèy sante ou"
  },
  LAB_OR_TEST: {
    EN: "reviewing a lab or test and the questions you want to discuss",
    ES: "revisar un laboratorio o una prueba y las preguntas que quiere conversar",
    KR: "revize yon laboratwa oswa tès ak kesyon ou vle pale sou yo"
  },
  ROUTINE_FOLLOW_UP: {
    EN: "a routine follow-up: a chance to review how things are going and the questions or concerns you want to discuss",
    ES: "un seguimiento de rutina: una oportunidad para revisar cómo van las cosas y las preguntas o preocupaciones que quiere conversar",
    KR: "yon swivi abityèl: yon okazyon pou revize kijan bagay yo ye ak kesyon oswa enkyetid ou vle pale sou yo"
  },
  NEW_CONCERN: {
    EN: "reviewing a new concern with the clinician",
    ES: "revisar una nueva preocupación con el profesional",
    KR: "revize yon nouvo enkyetid ak pwofesyonèl klinik la"
  },
  CARE_PLAN_REVIEW: {
    EN: "reviewing your care plan and the questions or changes you want to discuss",
    ES: "revisar su plan de cuidado y las preguntas o cambios que quiere conversar",
    KR: "revize plan swen ou ak kesyon oswa chanjman ou vle pale sou yo"
  }
});

const appointmentPurpose = (appointmentPrep, locale) => {
  const category = clean(appointmentPrep?.reasonCategory);
  if (APPOINTMENT_PURPOSES[category]) return pick(locale, APPOINTMENT_PURPOSES[category]);
  const patientReason = clean(appointmentPrep?.reasonSummary);
  if (patientReason) return pick(locale, {
    EN: `the reason recorded in your words: “${patientReason}”`,
    ES: `el motivo registrado con sus palabras: “${patientReason}”`,
    KR: `rezon ki anrejistre nan pwòp mo ou: “${patientReason}”`
  });
  return "";
};

const appointmentConcernOpening = (appointmentPrep, locale) => {
  const provider = clean(appointmentPrep?.providerDisplayName) || pick(locale, { EN: "your clinician", ES: "su profesional clínico", KR: "pwofesyonèl klinik ou" });
  const purpose = appointmentPurpose(appointmentPrep, locale);
  const agenda = appointmentPrepSummary(appointmentPrep, locale);
  const agendaSentence = agenda ? pick(locale, {
    EN: ` Your visit list already includes ${agenda}.`,
    ES: ` Su lista para la cita ya incluye ${agenda}.`,
    KR: ` Lis vizit ou deja gen ${agenda}.`
  }) : "";
  if (purpose) return pick(locale, {
    EN: `Of course. Your appointment with ${provider} is recorded for ${purpose}.${agendaSentence} I can help you understand that purpose and organize what you want to ask. What is your main question or concern about this visit?`,
    ES: `Claro. Su cita con ${provider} está registrada para ${purpose}.${agendaSentence} Puedo ayudarle a entender ese objetivo y a organizar lo que quiere preguntar. ¿Cuál es su principal duda o preocupación sobre esta cita?`,
    KR: `Byen antandi. Randevou ou ak ${provider} anrejistre pou ${purpose}.${agendaSentence} Mwen ka ede w konprann objektif sa a epi òganize sa ou vle mande. Ki kesyon oswa enkyetid prensipal ou genyen sou randevou sa a?`
  });
  return pick(locale, {
    EN: `Of course. I can see your appointment with ${provider}, but the record does not state a more specific purpose.${agendaSentence} Tell me what concerns you or what you want to understand, and I’ll help you prepare it for the visit.`,
    ES: `Claro. Puedo ver su cita con ${provider}, pero el registro no indica un objetivo más específico.${agendaSentence} Dígame qué le preocupa o qué quiere entender y le ayudaré a prepararlo para la consulta.`,
    KR: `Byen antandi. Mwen ka wè randevou ou ak ${provider}, men dosye a pa bay yon objektif ki pi presi.${agendaSentence} Di m sa k ap enkyete w oswa sa ou vle konprann, epi m ap ede w prepare li pou vizit la.`
  });
};

// Visit preparation is a small conversation with durable state, not a general knowledge search.
// This resolver handles only turns that clearly belong to that conversation. Safety, medication
// changes and appointment actions are still routed before it by answer().
export const appointmentPrepConversationResponse = ({ question, locale = "EN", appointmentPrep = null } = {}) => {
  if (!appointmentPrep) return null;
  const asked = clean(question);
  const topics = (appointmentPrep.topics || []).map(clean).filter(Boolean);
  const preparation = appointmentPrep.emmiPreparation && typeof appointmentPrep.emmiPreparation === "object"
    ? appointmentPrep.emmiPreparation
    : {};
  const reviewedTopics = [...new Set((preparation.reviewedTopics || []).map(clean).filter(Boolean))];
  const notesByTopic = preparation.notesByTopic && typeof preparation.notesByTopic === "object" ? { ...preparation.notesByTopic } : {};
  const provider = clean(appointmentPrep.providerDisplayName) || pick(locale, { EN: "your clinician", ES: "su profesional clínico", KR: "pwofesyonèl klinik ou" });
  const directTopic = topics.find(topic => {
    const topicId = topicKey(topic);
    const questionId = topicKey(asked);
    return topicId && (questionId === topicId || questionId.includes(topicId));
  });
  const remaining = topics.filter(topic => !reviewedTopics.some(reviewed => topicKey(reviewed) === topicKey(topic)) && !isMedicationTopic(topic));
  const summary = appointmentPrepSummary(appointmentPrep, locale) || pick(locale, { EN: "the items on your visit list", ES: "los elementos de su lista para la cita", KR: "bagay ki nan lis vizit ou" });
  const completed = APPOINTMENT_PREP_DONE.test(asked);

  if (APPOINTMENT_PREP_CONTINUE.test(asked) || APPOINTMENT_PURPOSE_QUESTION.test(asked)) return {
    text: appointmentConcernOpening(appointmentPrep, locale),
    update: { ...preparation, status: "IN_PROGRESS", currentTopic: "", reviewedTopics, notesByTopic, updatedAt: new Date().toISOString() }
  };

  if (completed) return {
    text: pick(locale, {
      EN: `Perfect — your agenda for ${provider} is ready: ${summary}. You can open “See my list” on the day of the appointment, and you can add or change anything before then.`,
      ES: `Perfecto. Su agenda para ${provider} está lista: ${summary}. El día de la cita puede abrir “Ver mi lista”, y puede agregar o cambiar cualquier punto antes de ese momento.`,
      KR: `Trè byen. Ajanda ou pou ${provider} pare: ${summary}. Jou randevou a, ou ka louvri “Gade lis mwen”, epi ou ka ajoute oswa chanje nenpòt bagay anvan sa.`
    }),
    update: { ...preparation, status: "COMPLETED", currentTopic: "", reviewedTopics: topics, notesByTopic, completedAt: new Date().toISOString() }
  };

  if (directTopic && !BLOOD_PRESSURE_SUBJECT.test(directTopic) && !isMedicationTopic(directTopic)) return {
    text: pick(locale, {
      EN: `Let’s prepare “${directTopic}.” It can help ${provider} if you note when it started, how often it happens, and what makes it better or worse. What is the main detail you want your doctor to know?`,
      ES: `Preparemos “${directTopic}”. Puede ayudarle a ${provider} saber cuándo comenzó, con qué frecuencia ocurre y qué lo mejora o empeora. ¿Cuál es el detalle principal que quiere que su médico conozca?`,
      KR: `Ann prepare “${directTopic}”. Sa ka ede ${provider} si ou note kilè li te kòmanse, konbyen fwa sa rive, ak sa ki fè l pi byen oswa pi mal. Ki detay prensipal ou vle doktè ou konnen?`
    }),
    update: { ...preparation, status: "IN_PROGRESS", currentTopic: directTopic, reviewedTopics, notesByTopic, updatedAt: new Date().toISOString() }
  };

  if (preparation.currentTopic && asked && !APPOINTMENT_PREP_CONTINUE.test(asked) && !APPOINTMENT_PREP_QUESTION.test(asked)) {
    const currentTopic = clean(preparation.currentTopic);
    const existingNotes = Array.isArray(notesByTopic[currentTopic]) ? notesByTopic[currentTopic] : [];
    notesByTopic[currentTopic] = [...existingNotes, asked].slice(-5);
    const nextReviewed = [...new Set([...reviewedTopics, currentTopic])];
    const nextTopic = topics.find(topic => !nextReviewed.some(reviewed => topicKey(reviewed) === topicKey(topic)) && !isMedicationTopic(topic));
    return {
      text: nextTopic
        ? pick(locale, { EN: `I added that under “${currentTopic}.” Next is “${nextTopic}.” What would you like ${provider} to know about it?`, ES: `Agregué eso bajo “${currentTopic}”. El siguiente punto es “${nextTopic}”. ¿Qué quiere que ${provider} sepa sobre este tema?`, KR: `Mwen ajoute sa anba “${currentTopic}”. Pwochen pwen an se “${nextTopic}”. Kisa ou vle ${provider} konnen sou li?` })
        : pick(locale, { EN: `I added that under “${currentTopic}.” We have covered every topic on your list. Is there anything else, or is that all?`, ES: `Agregué eso bajo “${currentTopic}”. Ya revisamos todos los temas de su lista. ¿Desea agregar algo más o eso es todo?`, KR: `Mwen ajoute sa anba “${currentTopic}”. Nou revize tout sijè ki nan lis ou. Èske gen yon lòt bagay, oswa se tout?` }),
      update: { ...preparation, status: "IN_PROGRESS", currentTopic: nextTopic || "", reviewedTopics: nextReviewed, notesByTopic, updatedAt: new Date().toISOString() }
    };
  }

  return null;
};

function isMedicationTopic(topic) {
  return /medication|medicine|medicamento|medikaman/i.test(String(topic || ""));
}
const accessBaselineGoalType = text => {
  if (WEIGHT_SUBJECT.test(text)) return "WEIGHT_MANAGEMENT";
  return BLOOD_PRESSURE_SUBJECT.test(text) ? "BLOOD_PRESSURE_CONTROL" : "";
};
// Asking whether the doctor stays involved is the same question as asking who the doctor is: both
// are answered from the care team, and both deserve the reassurance that ITERA adds to that doctor
// rather than replacing them. Naming the physician in the question is the most natural way to ask it.
// Patients ask for the person by role, and the roles are not only "doctor": "who is my care
// manager", "quien es mi enfermera" and "ki moun ki enfimye mwen" are the same question about
// the same record, and none of them reached the care-team lookup.
const DOCTOR_STATUS = /who is my (?:care manager|nurse|cardiologist|specialist|care team)|who is on my care team|my care team is|qui[eé]n es mi (?:enfermer[ao]|gerente de cuidado|coordinador[ao]|cardi[oó]log[ao])|qui[eé]nes est[aá]n en mi equipo|ki moun ki (?:enfimy[eè]|jere swen) mwen|is my doctor|who is my doctor|keep (seeing )?my doctor|doctor stays|still (be |stay )?involved|stay involved|remain involved|still my doctor|still see (?:my doctor|dr\.?\s+[a-z'-]+)|replace(?:s|d|ing)? (?:my )?doctor|take (?:my )?doctor'?s place|mi m[eé]dico|seguir viendo a mi m[eé]dico|seguir viendo (?:al|a la)?\s*(?:dr\.?|doctor|doctora)|qui[eé]n es mi m[eé]dico|sigue (involucrado|participando)|seguir[aá] (involucrado|participando)|reemplaz(?:a|ar|aría) (?:a )?mi m[eé]dico|sustitu(?:ye|ir|iría) (?:a )?mi m[eé]dico|dokt[eè] mwen|toujou (patisipe|enplike)|ranplase dokt[eè] mwen/i;
// The invitation itself: who sent it and why it arrived. Distinct from "who is my doctor",
// which asks whether that doctor stays involved, and from eligibility, which asks whether the
// patient qualifies. Answering it means repeating the referral facts and adding nothing.
const INVITATION_SOURCE = /who (invited|referred|sent)|who is this from|why (am i|did i) (receiving|receive|get|getting)|why was i (invited|referred)|how did you get my|qui[eé]n me (invit[oó]|refiri[oó]|envi[oó])|de qui[eé]n es esta invitaci[oó]n|por qu[eé] (recib[ií]|estoy recibiendo|me lleg[oó])|ki moun ki (envite|refere|voye) m|poukisa m (ap resevwa|resevwa|jwenn)/i;
const NEXT_STEP = /what happens next|what is next|what do i need to do next|next step|qu[eé] sigue|qu[eé] necesito hacer ahora|pr[oó]ximo paso|kisa k ap pase apre|kisa pou m f[eè] apre|pwochen etap/i;
const REPEAT_FOLLOW_UP = /^(can you |could you |please )?(repeat|say that again|repeat that)|^(repita|puede repetir|d[ií]galo otra vez)|^(repete|di sa ank[oò])/i;
const SIMPLIFY_FOLLOW_UP = /explain (that|it) (more )?simply|simpler|i (did not|didn'?t|don'?t) understand (that|it)|no entend[ií] (eso|esto)|expl[ií]quelo m[aá]s (f[aá]cil|sencillo)|mwen pa konprann|esplike sa pi senp/i;
// Asking for a person. "I want to speak with a person", "I want to speak to a supervisor" and
// "I do not want to talk to an AI" all missed this and were answered from the knowledge base —
// the one request that must always be honoured was the one most reliably dropped. Dissatisfaction
// belongs here too: a patient saying this did not help is asking for a person, not for a retry.
const HUMAN_SUPPORT = /call me|someone call|talk (to|with) someone|human|speak (to|with) (a |an |the )?(person|human|someone|representative|rep\b|supervisor|manager|agent)|talk (to|with) (a |an |the )?(person|representative|supervisor|manager)|real person|(don'?t|do not) want to (talk|speak) (to|with)|supervisor|complaint|complain|(did ?n'?t|did not) (solve|help|answer)|(you|emmi) (are|is) not understanding|not understanding me|hablar con (alguien|una persona|un supervisor|una representante)|persona real|no quiero hablar con (una|un) (ia|m[aá]quina|inteligencia artificial|robot)|queja|quejarme|supervisor|que me llamen|ll[aá]meme|no me (entiende|entiendes|est[aá] entendiendo)|esto no (resolvi[oó]|sirvi[oó]|ayud[oó])|pale ak yon moun|yon moun rey[eè]l|plent|rele m/i;
// A patient asking whether to stop a medicine names the medicine. The old pattern required the
// generic word, so "should I stop my lisinopril?" — the exact phrasing the QA spec lists — walked
// past it into the model. Drug-name suffixes catch the whole class without needing a formulary,
// and an accidental extra dose is a safety event even though no verb of change appears in it.
const DRUG_SUFFIX = "[a-z]{4,}(?:pril|statin|olol|sartan|azide|ipine|formin|prazole|oxacin|cycline)";
// What a patient says when something has gone wrong with a medicine. "Missed", "forgot" and
// "another dose" were absent, so "I forgot to take my medicine" and "Should I take another dose?"
// — the two commonest dosing questions there are — fell past this gate into the knowledge base and
// came back as programme education. Missing a dose is not a question EMMI may answer; it is a
// question it must hand to a clinician.
// Asking what a drug is for, what it does, or what it might do to you is drug education, and ITERA
// has decided it is out of scope: it belongs to a pharmacist or the care team, and if it is ever
// brought in-house it comes from a licensed monograph feed, not from this knowledge base and not
// from the model.
//
// This has to be a route rather than a knowledge page. Left to retrieval, the model answered "what
// is lisinopril for?" with a fluent, unsourced pharmacology lesson it wrote from its own weights -
// which is exactly the class of answer the audit exists to prevent, on exactly the subject where
// being confidently wrong does the most harm.
const DRUG_NAMES = `(?:${DRUG_SUFFIX}|aspirin|ibuprofen|tylenol|acetaminophen|insulin|warfarin|aspirina|ibuprofeno|insulina|ibipwofen)`;
// String.raw, because a plain "\b" in a JS string literal is a backspace character and not a word
// boundary - written the other way this pattern silently matched nothing at all.
const DRUG_EDUCATION = new RegExp([
  String.raw`\b(?:what (?:is|are|does|do)|what'?s|why (?:do|am) i|how does|tell me about|side ?effects?|used for)\b[^?.!]{0,40}\b` + DRUG_NAMES,
  DRUG_NAMES + String.raw`[^?.!]{0,40}\b(?:for|side ?effects?|do to me|make me|safe|interact)\b`,
  String.raw`\b(?:para qu[eé] (?:es|sirve)|qu[eé] hace|efectos? secundarios?)\b[^?.!]{0,40}\b` + DRUG_NAMES,
  DRUG_NAMES + String.raw`[^?.!]{0,40}\b(?:para qu[eé]|efectos? secundarios?|me hace)\b`,
  String.raw`\b(?:pou ki sa|efè segond[eè])\b[^?.!]{0,40}\b` + DRUG_NAMES
].join("|"), "i");

const drugEducationAnswer = locale => pick(locale, {
  EN: "I can’t tell you what a specific medicine does, what it is for, or what side effects it may have — that needs someone who can see your full medication list and your health history. Your pharmacist can answer it, and so can your care team. Would you like me to ask your care team to call you about it?",
  ES: "No puedo decirle qué hace un medicamento concreto, para qué sirve ni qué efectos secundarios puede tener: eso necesita a alguien que vea toda su lista de medicamentos y su historial. Su farmacéutico puede responderlo, y su equipo de atención también. ¿Desea que le pida a su equipo que le llame por esto?",
  KR: "Mwen pa ka di w kisa yon medikaman patikilye fè, pou ki sa li ye, ni ki efè segondè li ka genyen — sa mande yon moun ki ka wè tout lis medikaman ou ak istwa sante ou. Famasyen ou ka reponn sa, epi ekip swen ou tou. Èske ou vle m mande ekip swen ou pou yo rele w sou sa?"
});

const MEDICATION_SAFETY = new RegExp(
  "(stop|quit|skip|skipped|miss|missed|missing|forgot|forget|double|increase|decrease|change|split|halve)[^?.]{0,40}(medication|medicine|medicines|pill|pills|dose|doses|tablet|" + DRUG_SUFFIX + ")"
  + "|(took|take|taken|taking)[^?.]{0,20}(two|three|2|3|double|an extra|extra|another|a second)[^?.]{0,10}(dose|pill|tablet)"
  + "|(dose|pill|tablet)[^?.]{0,20}(twice|two times)"
  + "|dejar de tomar|suspender[^?.]{0,30}medic|cambiar la dosis|tom[eé][^?.]{0,15}dos dosis|se me olvid[oó][^?.]{0,25}(pastilla|medicamento|medicina|dosis)|olvid[eé][^?.]{0,25}(pastilla|medicamento|medicina|dosis|tomar)|otra (dosis|pastilla)|doble dosis"
  + "|sispann pran|chanje d[oò]z|bliye pran|yon l[oò]t d[oò]z",
  "i"
);
// The two halves can arrive in either order, and both must be present: a patient asking whether to
// measure again is asking about the baseline counters, not about their last reading.
const asksAboutMeasuringAgain = text => (/\bpressure\b/i.test(text) && /\bagain\b|\bnow\b/i.test(text))
  || (/presi[oó]n/i.test(text) && /otra vez|ahora/i.test(text))
  || (/tansyon/i.test(text) && /ank[oò]|kounye a/i.test(text));
const LEAVE_PROGRAM = /can i (leave|stop|end|quit)|leave the program|stop participating|end my participation|puedo (dejar|salir|terminar)|dejar el programa|salir del programa|mwen ka (kite|sispann)|kite pwogram/i;
const MEDICATION_REVIEW_REPORT = /what.*(choose|select|press|tap|mark|report).*(dose|medication)|dose changed|stopped taking|no longer take|qu[eé].*(elijo|selecciono|marco).*(dosis|medicamento)|cambi[oó].*dosis|dej[eé] de tomar|kisa.*(chwazi|make).*(d[oò]z|medikaman)|d[oò]z.*chanje|sispann pran/i;
// A patient asking whether enrollment is required is exercising choice, not describing legal
// authority. Keep this ahead of retrieval so phrases such as “puedo decidir que no” cannot be
// mis-ranked to the Personal Representative page merely because that page also contains “decidir”.
const VOLUNTARY_CHOICE = /(?:is (?:this|it|access) )?(?:mandatory|required|optional)|do i have to (?:enroll|join|participate)|can i (?:say|choose|decide) no|am i required|(?:esto|access|participar|inscribirme) (?:es )?obligatori[oa]|tengo que (?:inscribirme|participar|aceptar)|puedo (?:decir|elegir|decidir) que no|es opcional|(?:sa|access) obligatwa|mwen oblije|mwen ka (?:di|chwazi) non|se volont[eè]/i;
// A direct programme definition already has reviewed copy in programAnswers. Sending that simple
// question through generation can replace a relevant retrieval with an unrelated but fluent
// paragraph (the production defect returned emergency-service copy for "¿Qué es ACCESS?").
const PROGRAM_DEFINITION = /\b(what is|what's|explain|tell me about|qu[eé] es|qu[eé] significa|expl[ií](?:ca|que|came)|kisa)\b[^?.!]{0,80}\b(ACCESS|CCM|RPM|PCM|APCM|ASM)\b/i;
const leaveProgramAnswer = locale => pick(locale, {
  EN: "Participation is voluntary. You can choose whether to enroll, and you can ask to end your participation later. The current program information explains any timing or switching rules that apply, and the ITERA care team can help you review them.",
  ES: "La participación es voluntaria. Usted decide si desea inscribirse y puede solicitar terminar su participación después. La información vigente del programa explica cualquier regla de tiempo o cambio que aplique, y el equipo de ITERA puede ayudarle a revisarla.",
  KR: "Patisipasyon an volontè. Se ou ki chwazi si w vle enskri, epi ou ka mande pou fini patisipasyon ou pita. Enfòmasyon aktyèl pwogram nan esplike nenpòt règ sou delè oswa chanjman, epi ekip ITERA a ka ede w revize yo."
});
// Running out is its own intent, not a barrier and not a medication-list question. It is matched
// before the difficulty gate so "I keep running out of my pill" reaches the refill engine.
const REFILL_NEED = /refill|run(ning)? (out|low)|almost out|need more|out of my (medication|medicine|pill)|resurtir|surtir|receta|se me (acaba|acabó|está acabando)|necesito m[aá]s|me qued[eé] sin|ranplisaj|m ap fini|mwen bezwen plis|pa gen ank[oò]/i;
const REFILL_STATUS_QUESTION = /(what|where|how).*(refill|prescription)|refill.*(status|happening|going)|status of my (refill|prescription)|qu[eé] pas[oó] con (mi )?(receta|surtida)|d[oó]nde est[aá] mi (receta|surtida)|estado de mi (receta|surtida)|ki kote ranplisaj|estati ranplisaj/i;

// "Something is getting in my way" rather than "tell me about X". Without this a question about
// medications would be filed as a difficulty with medications.
const DIFFICULTY = /\b(i (can'?t|cannot|don'?t|do not|keep|always|never|forget|struggle)|it'?s (hard|difficult)|hard (to|for me)|having (a hard time|trouble)|trouble|difficult|no puedo|no entiendo|no s[eé] c[oó]mo|se me olvida|me cuesta|se me hace dif[ií]cil|dif[ií]cil|problema|mwen pa ka|mwen pa konprann|mwen bliye|difisil|pwobl[eè]m)\b/i;

// One acknowledgement per family of difficulty: what EMMI understood, and what happens next. Never
// "problem solved", never a promise the product cannot keep.
const BARRIER_ACKNOWLEDGEMENT = {
  UNDERSTANDING: { EN: "Let me explain it in plain language, and tell me if anything is still unclear.", ES: "Permítame explicárselo con palabras sencillas, y dígame si algo sigue sin quedar claro.", KR: "Kite m eksplike w sa nan mo senp, epi di m si gen yon bagay ki poko klè." },
  FORGETFULNESS_ROUTINE: { EN: "That happens to many people. We can add a reminder to your plan for a time that suits you.", ES: "Eso le pasa a muchas personas. Podemos agregar un recordatorio a su plan a la hora que le convenga.", KR: "Sa rive anpil moun. Nou ka ajoute yon rapèl nan plan ou pou yon lè ki bon pou ou." },
  DEVICE_TECHNOLOGY: { EN: "I can walk you through your monitor step by step, and if it still won’t work our device support team can call you.", ES: "Puedo guiarle paso a paso con su monitor y, si aún no funciona, nuestro equipo de soporte puede llamarle.", KR: "Mwen ka gide w etap pa etap ak monitè ou, epi si li toujou pa mache ekip sipò nou an ka rele w." },
  MEDICATION_UNDERSTANDING: { EN: "I can share general information about your medications. Your care team decides anything about how you take them.", ES: "Puedo darle información general sobre sus medicamentos. Su equipo decide cualquier cosa sobre cómo los toma.", KR: "Mwen ka pataje enfòmasyon jeneral sou medikaman ou yo. Ekip swen ou deside tout bagay sou fason ou pran yo." },
  MEDICATION_CONCERN: { EN: "Thank you for telling me. I can’t change anything about your medicine, so I’m letting your care team know so they can review it with you.", ES: "Gracias por contármelo. No puedo cambiar nada de su medicamento, así que avisaré a su equipo para que lo revise con usted.", KR: "Mèsi paske ou di m sa. Mwen pa ka chanje anyen sou medikaman ou, kidonk m ap fè ekip swen ou konnen pou yo ka revize l avèk ou." },
  MOTIVATION: { EN: "Keeping a plan going is hard, and a smaller plan is a normal thing to ask for. We can make this easier together.", ES: "Mantener un plan cuesta, y pedir un plan más sencillo es algo normal. Podemos hacerlo más fácil juntos.", KR: "Kenbe yon plan difisil, epi mande yon plan pi senp se yon bagay nòmal. Nou ka fè sa pi fasil ansanm." },
  TIME_ROUTINE: { EN: "We can change how often these steps happen so they fit your day.", ES: "Podemos cambiar con qué frecuencia hace estos pasos para que encajen en su día.", KR: "Nou ka chanje konbyen fwa ou fè etap sa yo pou yo antre nan jounen ou." },
  PHYSICAL_LIMITATION: { EN: "Thank you for telling me. I’ll let your care team know so your plan fits what feels comfortable for you.", ES: "Gracias por contármelo. Avisaré a su equipo para que su plan se ajuste a lo que le resulte cómodo.", KR: "Mèsi paske ou di m sa. M ap fè ekip swen ou konnen pou plan ou mache ak sa ki alèz pou ou." },
  NUTRITION: { EN: "I can share approved guidance on everyday food choices, like reading labels for salt.", ES: "Puedo compartir orientación aprobada sobre las comidas de todos los días, como leer las etiquetas para ver la sal.", KR: "Mwen ka pataje konsèy apwouve sou chwa manje chak jou, tankou li etikèt pou sèl." },
  EQUIPMENT_ACCESS: { EN: "Let’s make sure you have what you need. I’ll pass this to the team that handles equipment.", ES: "Asegurémonos de que tenga lo que necesita. Pasaré esto al equipo que se encarga del equipamiento.", KR: "Ann asire w ou gen sa ou bezwen. M ap voye sa bay ekip ki okipe aparèy yo." },
  FINANCIAL: { EN: "Thank you for telling me. Your care team can look at what support may be available to you.", ES: "Gracias por contármelo. Su equipo puede revisar qué apoyo podría estar disponible para usted.", KR: "Mèsi paske ou di m sa. Ekip swen ou ka gade ki sipò ki ka disponib pou ou." },
  TRANSPORTATION: { EN: "Getting there matters as much as the visit. I’ll pass this to your care team so they can help you plan it.", ES: "Llegar importa tanto como la cita. Pasaré esto a su equipo para que le ayuden a organizarlo.", KR: "Rive a enpòtan menm jan ak vizit la. M ap voye sa bay ekip swen ou pou yo ka ede w planifye l." },
  SOCIAL_SUPPORT: { EN: "You can invite someone you trust to help you with this, and you stay in control of your care.", ES: "Puede invitar a alguien de confianza para que le ayude, y usted mantiene el control de su cuidado.", KR: "Ou ka envite yon moun ou fè konfyans pou ede w, epi se ou ki kontwole swen ou." },
  LANGUAGE_COMMUNICATION: { EN: "We can use English, Spanish or Kreyòl. Tell me which you prefer and I’ll switch.", ES: "Podemos usar inglés, español o criollo haitiano. Dígame cuál prefiere y lo cambio.", KR: "Nou ka sèvi ak anglè, panyòl oswa kreyòl. Di m kilès ou pito epi m ap chanje l." },
  ACCESS_TO_CARE: { EN: "Not being able to reach your doctor is worth solving. I’ll let your care team know.", ES: "No poder comunicarse con su médico merece solución. Avisaré a su equipo de atención.", KR: "Pa ka jwenn doktè ou se yon bagay ki merite rezoud. M ap fè ekip swen ou konnen." },
  // Reached only when the patient described a difficulty about getting seen rather than asking for
  // a visit — the appointment intents above take those. It says what was recorded and what the
  // patient can do next, and promises no time, no office and no confirmation.
  APPOINTMENT_NEED: { EN: "I’ve noted that you need a visit. We can start an appointment request together, and your care team helps coordinate it with the office.", ES: "Anoté que necesita una consulta. Podemos iniciar juntos una solicitud de cita, y su equipo de atención ayuda a coordinarla con el consultorio.", KR: "Mwen note ou bezwen yon vizit. Nou ka kòmanse yon demann randevou ansanm, epi ekip swen ou ede kowòdone l ak biwo a." },
  CLINICAL_SYMPTOM: { EN: "Thank you for telling me. How you are feeling comes first, so I’m letting your care team know.", ES: "Gracias por contármelo. Cómo se siente es lo primero, así que avisaré a su equipo de atención.", KR: "Mèsi paske ou di m sa. Kijan ou santi w se premye bagay, kidonk m ap fè ekip swen ou konnen." },
  OTHER: { EN: "Thank you for telling me. I’ve noted it, and we can work on it together.", ES: "Gracias por contármelo. Lo anoté y podemos trabajarlo juntos.", KR: "Mèsi paske ou di m sa. Mwen note l epi nou ka travay sou li ansanm." }
};

// Refill answers. Each one says exactly what happened and what is waiting, and never that
// something was approved, sent or renewed unless a source said so.
const refillReviewAnswer = (locale, medication) => pick(locale, {
  EN: `I opened your ${medication} refill. Let’s check a couple of things first, then I can send the request.`,
  ES: `Abrí la surtida de ${medication}. Revisemos un par de cosas y luego puedo enviar la solicitud.`,
  KR: `Mwen louvri ranplisaj ${medication} ou. Ann tcheke de bagay anvan, epi m ka voye demann nan.`
});

const refillAlreadyRequestedAnswer = (locale, medication, status) => pick(locale, {
  EN: `You already have a refill request for ${medication}. Right now it is: ${status}.`,
  ES: `Ya tiene una solicitud de surtida para ${medication}. Ahora mismo está: ${status}.`,
  KR: `Ou deja gen yon demann ranplisaj pou ${medication}. Kounye a li: ${status}.`
});

const refillSelectionAnswer = (locale, medications) => {
  const names = medications.slice(0, 4).map(medication => medication.name).join(", ");
  return pick(locale, {
    EN: `Which medication do you need? I have ${names} on file.`,
    ES: `¿Qué medicamento necesita? Tengo ${names} registrados.`,
    KR: `Ki medikaman ou bezwen? Mwen gen ${names} nan dosye a.`
  });
};

const refillStatusAnswer = (locale, refills) => {
  if (!refills.length) return pick(locale, {
    EN: "You don’t have a refill request in progress right now.",
    ES: "Ahora mismo no tiene ninguna solicitud de surtida en curso.",
    KR: "Ou pa gen okenn demann ranplisaj ki ap mache kounye a."
  });
  return refills.map(refill => pick(locale, {
    EN: `${refill.medication}: ${refill.patientStatus}.`,
    ES: `${refill.medication}: ${refill.patientStatus}.`,
    KR: `${refill.medication}: ${refill.patientStatus}.`
  })).join(" ");
};

// Appointment answers. Every one of them is built from what a tool returned. EMMI names a provider
// only when the record carried one, never says confirmed unless the record's own patient-facing
// status says so, and never renders a date here: the appointment view owns dates so a time is
// formatted once, in the patient's language, rather than improvised into a sentence.
const appointmentWho = appointment => clean(appointment?.providerDisplayName || appointment?.specialty || "");

const appointmentLine = appointment => {
  const who = appointmentWho(appointment);
  const status = clean(appointment?.patientStatus || "");
  return who && status ? `${who} — ${status}` : who || status;
};

const appointmentListText = appointments => appointments.slice(0, 3).map(appointmentLine).filter(Boolean).join("; ");

const noAppointmentOnFile = locale => pick(locale, {
  EN: "I don’t see an appointment on file for you right now. If you need a visit, we can start a request together.",
  ES: "Ahora mismo no veo ninguna cita registrada para usted. Si necesita una consulta, podemos iniciar juntos una solicitud.",
  KR: "Kounye a mwen pa wè okenn randevou nan dosye ou. Si ou bezwen yon vizit, nou ka kòmanse yon demann ansanm."
});

const appointmentLookupUnavailable = locale => pick(locale, {
  EN: "I can’t check your appointments right now, so I don’t want to tell you something that may be wrong. You can try again, or I can help you reach your care team.",
  ES: "Ahora mismo no puedo consultar sus citas, así que prefiero no decirle algo que podría estar equivocado. Puede intentar de nuevo o puedo ayudarle a comunicarse con su equipo de atención.",
  KR: "Mwen pa ka tcheke randevou ou yo kounye a, kidonk mwen pa vle di w yon bagay ki ka pa kòrèk. Ou ka eseye ankò, oswa mwen ka ede w jwenn ekip swen ou."
});

const appointmentStatusAnswer = (locale, appointments) => {
  const list = appointmentListText(appointments);
  return pick(locale, {
    EN: `Here is what I have on file: ${list}. You can open it to see the date, the time and what happens next.`,
    ES: `Esto es lo que tengo registrado: ${list}. Puede abrirla para ver la fecha, la hora y qué sigue.`,
    KR: `Men sa mwen genyen nan dosye a: ${list}. Ou ka louvri l pou wè dat la, lè a ak sa k ap vini apre.`
  });
};

const appointmentTransportationAnswer = (locale, appointment, reservation) => {
  const provider = appointmentWho(appointment);
  const when = clean(appointment?.scheduledLabel || "");
  const location = clean(appointment?.locationName || "");
  const service = clean(reservation?.serviceName || "");
  const pickup = clean(reservation?.pickupLabel || "");
  const reservationId = clean(reservation?.reservationId || "");
  const arrival = clean(reservation?.estimatedArrivalLabel || "");
  return pick(locale, {
    EN: `Your appointment${provider ? ` with ${provider}` : ""}${when ? ` is ${when}` : ""}${location ? ` at ${location}` : ""}. Your confirmed ${service || "ride"} pickup is ${pickup || "on file"}${reservationId ? `, reservation ${reservationId}` : ""}${arrival ? `, with estimated arrival at ${arrival}` : ""}.`,
    ES: `Su cita${provider ? ` con ${provider}` : ""}${when ? ` es ${when}` : ""}${location ? ` en ${location}` : ""}. Su ${service || "transporte"} confirmado le recogerá a las ${pickup || "hora registrada"}${reservationId ? `, reserva ${reservationId}` : ""}${arrival ? `, con llegada estimada a las ${arrival}` : ""}.`,
    KR: `Randevou ou${provider ? ` ak ${provider}` : ""}${when ? ` se ${when}` : ""}${location ? ` nan ${location}` : ""}. ${service || "Transpò"} ou konfime a ap vin pran ou a ${pickup || "lè ki nan dosye a"}${reservationId ? `, rezèvasyon ${reservationId}` : ""}${arrival ? `, epi lè li prevwa rive se ${arrival}` : ""}.`
  }).replace(/\.\.$/, ".");
};

const companionOfferAnswer = locale => pick(locale, {
  EN: "I can help you ask a family member or another trusted person to accompany you. I’ll open the companion flow so you can choose the person and review exactly what they will receive before anything is sent.",
  ES: "Puedo ayudarle a pedírselo a un familiar u otra persona de confianza. Abriré el flujo de acompañante para que elija a la persona y revise exactamente qué recibirá antes de enviar nada.",
  KR: "Mwen ka ede w mande yon fanmi oswa yon lòt moun ou fè konfyans pou akonpaye w. M ap louvri etap akonpayman an pou w chwazi moun nan epi verifye egzakteman sa l ap resevwa anvan anyen voye."
});

const companionPrivacyAnswer = (locale, contactName = "") => pick(locale, {
  EN: `${contactName || "Your companion"} will see only the appointment date, time and location needed to accompany you. The invitation does not include your reason for the visit, diagnoses, medications, readings or other health information. Nothing is sent until you review and confirm it.`,
  ES: `${contactName || "Su acompañante"} verá únicamente la fecha, la hora y el lugar de la cita necesarios para acompañarle. La invitación no incluye el motivo de la visita, diagnósticos, medicamentos, lecturas ni otra información de salud. No se envía nada hasta que usted lo revise y confirme.`,
  KR: `${contactName || "Moun k ap akonpaye w la"} ap wè sèlman dat, lè ak kote randevou a pou li ka akonpaye w. Envitasyon an pa gen rezon vizit la, dyagnostik, medikaman, mezi oswa lòt enfòmasyon sante. Anyen pa voye anvan ou revize epi konfime l.`
});

const appointmentWhichOneAnswer = (locale, appointments) => {
  const list = appointmentListText(appointments);
  return pick(locale, {
    EN: `Which one do you mean? I have ${list}.`,
    ES: `¿Cuál de ellas? Tengo ${list}.`,
    KR: `Kilès ou vle di? Mwen gen ${list}.`
  });
};

const rescheduleAnswer = (locale, appointment) => {
  const who = appointmentWho(appointment);
  return pick(locale, {
    EN: `${who ? `Let’s change your appointment with ${who}.` : "Let’s change that appointment."} I’ll show you what times are actually available, and nothing changes until you pick one and confirm.`,
    ES: `${who ? `Cambiemos su cita con ${who}.` : "Cambiemos esa cita."} Le mostraré los horarios realmente disponibles, y nada cambia hasta que elija uno y lo confirme.`,
    KR: `${who ? `Ann chanje randevou ou ak ${who}.` : "Ann chanje randevou sa a."} M ap montre w ki lè ki reyèlman disponib, epi anyen pa chanje jiskaske ou chwazi youn epi konfime l.`
  });
};

const cancelConfirmationAnswer = (locale, appointment) => {
  const who = appointmentWho(appointment);
  return pick(locale, {
    EN: `I won’t cancel an appointment just because a message says so. Do you want me to cancel your appointment${who ? ` with ${who}` : ""}? Nothing is cancelled until you confirm.`,
    ES: `No cancelo una cita solo porque un mensaje lo diga. ¿Desea que cancele su cita${who ? ` con ${who}` : ""}? Nada se cancela hasta que usted lo confirme.`,
    KR: `Mwen p ap anile yon randevou sèlman paske yon mesaj di sa. Èske ou vle m anile randevou ou${who ? ` ak ${who}` : ""}? Anyen pa anile jiskaske ou konfime.`
  });
};

const nothingToChangeAnswer = locale => pick(locale, {
  EN: "I don’t see an appointment on file to change. If you need a visit, we can start a new request instead.",
  ES: "No veo ninguna cita registrada que cambiar. Si necesita una consulta, podemos iniciar una nueva solicitud.",
  KR: "Mwen pa wè okenn randevou nan dosye a pou chanje. Si ou bezwen yon vizit, nou ka kòmanse yon nouvo demann."
});

const existingAppointmentAnswer = (locale, appointment) => {
  const who = appointmentWho(appointment);
  const status = clean(appointment?.patientStatus || "");
  return pick(locale, {
    EN: `You already have an appointment${who ? ` with ${who}` : ""}${status ? ` — ${status}` : ""}. Would you like to open it, change it, or request another visit?`,
    ES: `Ya tiene una cita${who ? ` con ${who}` : ""}${status ? ` — ${status}` : ""}. ¿Desea abrirla, cambiarla o solicitar otra consulta?`,
    KR: `Ou deja gen yon randevou${who ? ` ak ${who}` : ""}${status ? ` — ${status}` : ""}. Èske ou vle louvri l, chanje l, oswa mande yon lòt vizit?`
  });
};

const TIME_HINT_ECHO = {
  MORNING: { EN: " You mentioned mornings, so we can start there when we pick a time.", ES: " Mencionó las mañanas, así que podemos empezar por ahí al elegir el horario.", KR: " Ou pale de maten, kidonk nou ka kòmanse la lè n ap chwazi yon lè." },
  AFTERNOON: { EN: " You mentioned afternoons, so we can start there when we pick a time.", ES: " Mencionó las tardes, así que podemos empezar por ahí al elegir el horario.", KR: " Ou pale de aprèmidi, kidonk nou ka kòmanse la lè n ap chwazi yon lè." },
  EVENING: { EN: " You mentioned evenings, so we can start there when we pick a time.", ES: " Mencionó las noches, así que podemos empezar por ahí al elegir el horario.", KR: " Ou pale de aswè, kidonk nou ka kòmanse la lè n ap chwazi yon lè." }
};

const appointmentRequestOpenedAnswer = (locale, timeHint) => {
  const opener = pick(locale, {
    EN: "Let’s get this visit set up. I opened an appointment request so we can go through it together — who you need to see, why, and when works for you. Nothing is sent until you confirm.",
    ES: "Vamos a organizar esta consulta. Abrí una solicitud de cita para revisarla juntos: a quién necesita ver, por qué y qué horario le conviene. No se envía nada hasta que usted lo confirme.",
    KR: "Ann prepare vizit sa a. Mwen louvri yon demann randevou pou nou pase ladan l ansanm — ki moun ou bezwen wè, poukisa, ak ki lè ki bon pou ou. Anyen pa voye jiskaske ou konfime."
  });
  const echo = TIME_HINT_ECHO[timeHint] ? pick(locale, TIME_HINT_ECHO[timeHint]) : "";
  return `${opener}${echo}`;
};

const appointmentLogisticsSequenceAnswer = (locale, { transportation = false, companion = false } = {}) => {
  if (!transportation && !companion) return "";
  if (transportation && companion) return pick(locale, {
    EN: " I also heard that you need a ride and want your daughter to accompany you. After the appointment time is confirmed, I’ll help you coordinate both against that date and place.",
    ES: " También entendí que necesita transporte y desea que su hija le acompañe. Después de confirmar el horario de la cita, le ayudaré a coordinar ambos con esa fecha y ese lugar.",
    KR: " Mwen konprann tou ou bezwen transpò epi ou vle pitit fi ou akonpaye ou. Apre lè randevou a konfime, m ap ede w kowòdone toude ak dat ak kote sa a."
  });
  return transportation ? pick(locale, {
    EN: " I also heard that you need a ride. After the appointment time is confirmed, I’ll help you coordinate it against that date and place.",
    ES: " También entendí que necesita transporte. Después de confirmar el horario de la cita, le ayudaré a coordinarlo con esa fecha y ese lugar.",
    KR: " Mwen konprann tou ou bezwen transpò. Apre lè randevou a konfime, m ap ede w kowòdone li ak dat ak kote sa a."
  }) : pick(locale, {
    EN: " I also heard that you want your daughter to accompany you. After the appointment time is confirmed, I’ll help you coordinate that support for the visit.",
    ES: " También entendí que desea que su hija le acompañe. Después de confirmar el horario de la cita, le ayudaré a coordinar ese apoyo para la consulta.",
    KR: " Mwen konprann tou ou vle pitit fi ou akonpaye ou. Apre lè randevou a konfime, m ap ede w kowòdone sipò sa a pou vizit la."
  });
};

const appointmentRequestUnavailable = locale => pick(locale, {
  EN: "I couldn’t open the appointment request just now, so nothing has been requested. You can try again, or I can help you reach your care team so they can coordinate it.",
  ES: "No pude abrir la solicitud de cita ahora mismo, así que no se ha solicitado nada. Puede intentar de nuevo o puedo ayudarle a comunicarse con su equipo para que la coordinen.",
  KR: "Mwen pa t ka louvri demann randevou a kounye a, kidonk anyen pa mande. Ou ka eseye ankò, oswa mwen ka ede w jwenn ekip swen ou pou yo kowòdone l."
});

// A hint is a starting point for the directory, never an identity. A short stem match is enough to
// notice "Dr. Martinez" against "Martinez, Cardiology"; anything shorter is treated as no hint at
// all rather than matched loosely onto the wrong professional.
const appointmentMatchesHint = (appointment, hint) => {
  const stem = lower(hint).slice(0, 6);
  if (stem.length < 4) return false;
  return `${lower(appointment?.providerDisplayName || "")} ${lower(appointment?.specialty || "")}`.includes(stem);
};

const resolveIntendedAppointment = (appointments, hint) => {
  const matched = appointments.find(appointment => appointmentMatchesHint(appointment, hint));
  if (matched) return matched;
  return !hint && appointments.length === 1 ? appointments[0] : null;
};

// Reasons stay coarse on purpose: this classifies the patient's own words into a category the care
// team already uses, and falls back to OTHER rather than guessing a clinical reason for the visit.
const APPOINTMENT_REASON_HINTS = [
  ["MEDICATION_RENEWAL", /refill|prescription|resurtir|surtir|receta|ranplisaj|preskripsyon/i],
  ["BLOOD_PRESSURE_FOLLOW_UP", /blood pressure|\bbp\b|presi[oó]n|tansyon/i],
  ["DEVICE_SUPPORT", /monitor|cuff|device|aparato|tensi[oó]metro|brazalete|monit[eè]|apar[eè]y|manch[eè]t/i],
  ["LAB_OR_TEST", /\blabs?\b|blood (work|test)|an[aá]lisis|laboratorio|examen de sangre|tès san|laboratwa/i],
  ["ROUTINE_FOLLOW_UP", /follow.?up|check.?up|seguimiento|control|chequeo|swivi|kontw[oò]l/i]
];
const appointmentReasonCategory = question => (APPOINTMENT_REASON_HINTS.find(([, pattern]) => pattern.test(question)) || ["OTHER"])[0];

const barrierAcknowledgement = (locale, category, alreadyKnown = false) => {
  const base = pick(locale, BARRIER_ACKNOWLEDGEMENT[category] || BARRIER_ACKNOWLEDGEMENT.OTHER);
  if (!alreadyKnown) return base;
  // Mentioning it again is not a new problem: EMMI says she already has it rather than starting over.
  const prefix = pick(locale, {
    EN: "I still have this one open for you.",
    ES: "Todavía tengo esto abierto para usted.",
    KR: "Mwen toujou gen sa a ouvè pou ou."
  });
  return `${prefix} ${base}`;
};

export const expandEmmiQuery = ({ question, conversation = {}, program = "", appointmentPrep = null, carriedSubject = "" } = {}) => {
  const raw = clean(question);
  const prepTopic = resolveAppointmentPrepTopic({ question: raw, conversation, appointmentPrep });
  if (prepTopic && topicKey(raw) !== topicKey(prepTopic)) return `${raw} Appointment preparation topic: ${prepTopic}`;
  const context = `${conversation.conversationSummary || ""} ${(conversation.recentTurns || []).map(turn => turn.text).join(" ")}`;
  const mentioned = ["ACCESS", "CCM", "RPM", "PCM", "APCM", "ASM"].filter(item => new RegExp(`\\b${item}\\b`, "i").test(context));
  if (/(difference|different|compare|diferencia|diferente|comparar|diferans)/i.test(raw) && mentioned.length >= 2) return `${raw} ${mentioned.slice(-2).join(" ")}`;
  // The half of a compound question that named the subject hands it to the half that did not:
  // "am I eligible and how much does it cost?" asks the second half about eligibility's subject.
  if (carriedSubject) return `${raw} ${carriedSubject}`;
  // "And does that cost anything?" carries no subject of its own. Retrieval had only those words
  // to rank on and returned whatever page mentioned cost, so a question about the monitor came
  // back as the programme's cost page. Put the subject the patient stopped repeating back in.
  if (isFollowUpQuestion(raw)) {
    const subject = resolveConversationSubject(conversation);
    if (subject) return `${raw} ${subject}`;
  }
  if (/^(and|what about|y|e)\b/i.test(raw) && mentioned.length) return `${raw} Previous topic: ${mentioned.at(-1)}`;
  if (/\b(this|that|it|esto|eso|este programa|sa a)\b/i.test(raw) && program) return `${raw} Current program: ${program}`;
  return raw;
};

const unavailable = locale => pick(locale, {
  EN: "I don’t have enough approved information to answer that safely. I can help you contact your care team.",
  ES: "No tengo suficiente información aprobada para responder eso con seguridad. Puedo ayudarle a comunicarse con su equipo de atención.",
  KR: "Mwen pa gen ase enfòmasyon apwouve pou reponn sa san danje. Mwen ka ede w kontakte ekip swen ou."
});
// Built only from the referral facts already in the runtime context. No reason, no date, no
// practice, no diagnosis: the patient is told who invited them and what they were invited to look
// at, and is reminded that looking is not enrolling.
const invitationSourceAnswer = (enrollment = {}, locale) => {
  const physician = enrollment.physicianDisplayName || "";
  const program = enrollment.program || "ACCESS";
  const referred = Boolean(physician) && /referral/i.test(String(enrollment.enrollmentSource || ""));
  if (referred) return pick(locale, {
    EN: `${physician}’s care team invited you to learn about ${program} care. Looking is voluntary, and you have not enrolled in anything yet.`,
    ES: `El equipo de ${physician} le invitó a conocer el cuidado ${program}. Informarse es voluntario y todavía no se ha inscrito en nada.`,
    KR: `Ekip swen ${physician} envite w aprann sou swen ${program}. Gade li se volontè, epi ou poko enskri nan anyen.`
  });
  return pick(locale, {
    EN: `ITERA HEALTH invited you to learn about ${program} care. Looking is voluntary, and you have not enrolled in anything yet.`,
    ES: `ITERA HEALTH le invitó a conocer el cuidado ${program}. Informarse es voluntario y todavía no se ha inscrito en nada.`,
    KR: `ITERA HEALTH envite w aprann sou swen ${program}. Gade li se volontè, epi ou poko enskri nan anyen.`
  });
};
const retrievalUnavailable = locale => pick(locale, {
  EN: "I can’t look up that information right now. You can try again, or I can help you contact your care team.",
  ES: "Ahora mismo no puedo consultar esa información. Puede intentar de nuevo o puedo ayudarle a comunicarse con su equipo de atención.",
  KR: "Mwen pa ka chèche enfòmasyon sa a kounye a. Ou ka eseye ankò, oswa mwen ka ede w kontakte ekip swen ou."
});

const programAnswers = Object.freeze({
  ACCESS: {
    EN: "ACCESS is a Medicare care option that provides extra support between doctor visits. Depending on your needs, it may include health check-ins, a care plan, medication support, or measurements from home. Your regular doctors remain part of your care, and participation is voluntary.",
    ES: "ACCESS es una opción de cuidado de Medicare que brinda apoyo adicional entre sus visitas médicas. Según sus necesidades, puede incluir seguimiento de su salud, un plan de cuidado, apoyo con sus medicamentos o mediciones desde casa. Sus médicos habituales continúan formando parte de su cuidado y participar es voluntario.",
    KR: "ACCESS se yon opsyon swen Medicare ki bay plis sipò ant vizit kay doktè. Selon bezwen ou, li ka gen ladan suivi sante, yon plan swen, sipò pou medikaman, oswa mezi lakay. Doktè ou deja wè yo rete nan swen ou, epi patisipasyon an volontè."
  },
  CCM: {
    EN: "CCM, or Chronic Care Management, is a Medicare service for people managing multiple chronic conditions who need ongoing support between visits. A care team can help coordinate care, review medications, work on goals, and stay connected with the patient’s doctors. Participation is voluntary, and Medicare cost sharing may apply.",
    ES: "CCM significa Chronic Care Management, o manejo de cuidado crónico. Es un servicio de Medicare para personas con varias condiciones crónicas que necesitan apoyo continuo entre visitas. El equipo puede coordinar el cuidado, revisar medicamentos, trabajar en metas y mantenerse en comunicación con los médicos. La participación es voluntaria y pueden aplicar costos de Medicare.",
    KR: "CCM vle di Chronic Care Management, oswa jesyon swen kwonik. Se yon sèvis Medicare pou moun k ap jere plizyè maladi kwonik epi ki bezwen sipò regilye ant vizit. Ekip swen an ka ede kowòdone swen, revize medikaman, travay sou objektif, epi rete konekte ak doktè yo."
  },
  RPM: {
    EN: "RPM, or Remote Patient Monitoring, uses a connected medical device to share health measurements, such as blood pressure, with the care team. It supports care between visits, but it is not an emergency service. A monitor is considered connected only after ITERA verifies the device and its transmissions.",
    ES: "RPM significa Remote Patient Monitoring, o monitoreo remoto del paciente. Utiliza un dispositivo médico conectado para compartir mediciones, como la presión arterial, con el equipo de atención. Apoya el cuidado entre visitas, pero no es un servicio de emergencia. ITERA debe verificar el dispositivo y sus transmisiones antes de considerarlo conectado.",
    KR: "RPM vle di Remote Patient Monitoring, oswa siveyans pasyan a distans. Li sèvi ak yon aparèy medikal konekte pou pataje mezi sante, tankou tansyon, ak ekip swen an. Li sipòte swen ant vizit, men li pa yon sèvis ijans."
  },
  PCM: {
    EN: "PCM, or Principal Care Management, provides focused ongoing support for one serious chronic condition. The care team can help coordinate the plan, medications, goals, and needs related to that condition between visits.",
    ES: "PCM significa Principal Care Management. Brinda apoyo continuo y enfocado para una condición crónica seria. El equipo puede ayudar a coordinar el plan, los medicamentos, las metas y las necesidades relacionadas con esa condición entre visitas.",
    KR: "PCM vle di Principal Care Management. Li bay sipò regilye ki konsantre sou yon maladi kwonik grav. Ekip la ka ede kowòdone plan, medikaman, objektif ak bezwen ki gen rapò ak maladi sa a."
  },
  APCM: {
    EN: "APCM, or Advanced Primary Care Management, supports ongoing coordination through a primary care team. The exact services and any patient cost depend on the approved care configuration and current coverage.",
    ES: "APCM significa Advanced Primary Care Management. Apoya la coordinación continua mediante un equipo de atención primaria. Los servicios exactos y cualquier costo dependen de la configuración aprobada y de la cobertura vigente.",
    KR: "APCM vle di Advanced Primary Care Management. Li sipòte kowòdinasyon regilye atravè yon ekip swen prensipal. Sèvis egzak yo ak nenpòt depans depann de konfigirasyon apwouve a ak kouvèti aktyèl la."
  },
  ASM: {
    EN: "ASM is an ITERA-supported care configuration whose exact services must come from the approved program setup. I can explain the specific support shown in your care information, but I won’t invent services that are not configured.",
    ES: "ASM es una configuración de cuidado apoyada por ITERA cuyos servicios exactos deben provenir de la configuración aprobada. Puedo explicar el apoyo que aparece en su información de cuidado, pero no inventaré servicios que no estén configurados.",
    KR: "ASM se yon konfigirasyon swen ITERA sipòte. Sèvis egzak yo dwe soti nan konfigirasyon apwouve a. Mwen ka esplike sipò ki parèt nan enfòmasyon swen ou, men mwen p ap envante sèvis."
  },
  "CCM + RPM": {
    EN: "CCM + RPM combines ongoing chronic care coordination with connected health monitoring when it is appropriate for the patient. The care team can support the care plan, medications, and goals while also reviewing verified measurements sent by the connected device. It is not an emergency service, and Medicare cost sharing may apply.",
    ES: "CCM + RPM combina la coordinación continua del cuidado crónico con el monitoreo de salud mediante un dispositivo conectado cuando sea apropiado. El equipo puede apoyar el plan, los medicamentos y las metas, además de revisar mediciones verificadas enviadas por el dispositivo. No es un servicio de emergencia y pueden aplicar costos de Medicare.",
    KR: "CCM + RPM konbine kowòdinasyon swen kwonik regilye ak siveyans sante atravè yon aparèy konekte lè sa apwopriye. Ekip la ka ede ak plan swen, medikaman ak objektif, epi revize mezi verifye aparèy la voye. Li pa yon sèvis ijans."
  },
  "PCM + RPM": {
    EN: "PCM + RPM combines focused support for one serious chronic condition with connected health monitoring when appropriate. The care team coordinates needs related to that condition and reviews verified measurements sent by the connected device. It is not an emergency service, and Medicare cost sharing may apply.",
    ES: "PCM + RPM combina apoyo enfocado para una condición crónica seria con monitoreo de salud mediante un dispositivo conectado cuando sea apropiado. El equipo coordina las necesidades relacionadas con esa condición y revisa las mediciones verificadas enviadas por el dispositivo. No es un servicio de emergencia y pueden aplicar costos de Medicare.",
    KR: "PCM + RPM konbine sipò ki konsantre sou yon maladi kwonik grav ak siveyans sante atravè yon aparèy konekte lè sa apwopriye. Ekip la kowòdone bezwen maladi a epi revize mezi verifye aparèy la voye. Li pa yon sèvis ijans."
  }
});

// The generic page for a programme, as opposed to a page written for one question about it.
const GENERIC_PROGRAM_PAGE = /^programs\/(access|ccm|rpm|pcm|apcm|asm|bhi|cocm|tcm|rtm|ccm-rpm|pcm-rpm)\.md$/i;

// A sentence written to whoever maintains the knowledge base, not to the patient reading it.
// These are instructions ("Never determine QMB status from a generic eligibility string alone"),
// internal vocabulary (runtime, tool, guardrail, chunk, PHI), and editorial scaffolding (source
// registries, "Answer from this page"). They belong in the model's grounding, where they steer the
// answer, and never in the answer itself — which is exactly where they were being printed.
// "keep" on its own was too broad: it stripped "Keep your feet flat on the floor" out of the
// monitor instructions, which is the patient's own guidance and not a note to whoever wrote the
// page. Only the authoring objects belong here.
const AUTHORING_VOICE = /^(never|do not|don'?t|always|avoid|prefer|preserve|keep (?:the (?:answer|response|tone|wording|list|language)|answers|responses|it short|language|wording)|use plain|treat |ensure |give them|answer |explain the|explain medicare|state |say )\b/i;
const INTERNAL_VOCABULARY = /\b(runtime|tool|guardrail|chunk|retrieval|markdown|PHI|credential|configuration|config\b|this page|the model|prompt|G-?code|_sources?:|\(READ\)|\bUso:|\bNota:)/i;
// A directive can also be phrased about the patient rather than to the reader.
const THIRD_PERSON_DIRECTIVE = /\b(must (not|never|remain|be)|should (not|be given|use)|is not answered by|it must appear|rather than assumed)\b/i;

export const patientFacingProse = text => {
  const sentences = String(text || "").match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [];
  const kept = sentences.filter(sentence => {
    const s = sentence.trim();
    if (!s) return false;
    if (AUTHORING_VOICE.test(s)) return false;
    if (INTERNAL_VOCABULARY.test(s)) return false;
    if (THIRD_PERSON_DIRECTIVE.test(s)) return false;
    return true;
  });
  const prose = kept.join(" ").replace(/\s+/g, " ").trim();
  // Half an answer is worse than none: if the page had little to say to the patient once its
  // instructions came out, the caller falls through to offering a person instead.
  return prose.length >= 60 ? prose : "";
};

// Turn a retrieved page into something that reads as an answer: no headings, no markdown, and only
// as much as a patient will read. The pages lead with their answer for exactly this reason.
const passageAnswer = passage => {
  // Everything from the response rule onward is written for the model, not the patient: retrieval
  // appends it to whichever chunk it returns, and it must never be read out as an answer.
  const body = String(passage?.text || "")
    .split(/^#{1,4}\s*EMMI response rule\s*$/mi)[0]
    // Emphasis comes off first: a line ending "things:**" does not look like it ends in a colon,
    // and the list it introduces would be started as a new sentence instead of joined to it.
    .replace(/\*\*|__|`/g, "");

  const blocks = [];
  for (const block of body.split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean).filter(line => !/^#{1,4}\s/.test(line));
    if (!lines.length) continue;
    // A list is where the facts are — the four tracks, the two halves of the target — so items are
    // kept and turned into sentences. Everything else is a paragraph that was hard-wrapped, and
    // its lines rejoin without gaining a full stop in the middle of a sentence.
    const isList = lines.every(line => /^(?:[-*]|\d+\.)\s+/.test(line));
    if (isList) blocks.push(lines.map(line => line.replace(/^(?:[-*]|\d+\.)\s+/, "")).map(item => (/[.!?]$/.test(item) ? item : `${item}.`)).join(" "));
    else blocks.push(lines.join(" "));
  }

  const prose = blocks
    .reduce((joined, block) => {
      const previous = joined.at(-1);
      // A list belongs to the sentence that introduced it.
      if (previous && /[:;,]$/.test(previous)) joined[joined.length - 1] = `${previous} ${block}`;
      else joined.push(block);
      return joined;
    }, [])
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  // Last gate before the words reach a patient. A page that turns out to be all instruction
  // returns nothing, and the caller offers the care team rather than reading the instruction out.
  const patientProse = patientFacingProse(prose);
  if (!patientProse) return "";
  if (patientProse.length <= 460) return patientProse;
  let cut = "";
  for (const sentence of patientProse.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || []) {
    if ((cut + sentence).length > 460 && cut) break;
    cut += sentence;
  }
  return cut.trim() || patientProse.slice(0, 460);
};

const fallbackKnowledgeAnswer = ({ question, retrieval, locale, program }) => {
  const sources = retrieval.passages || [];
  const sourcePaths = sources.map(item => item.sourcePath).join(" ");
  const asksForCcmRpm = /CCM\s*(?:\+|and|y|ak)\s*RPM/i.test(question) || program === "CCM + RPM";
  const asksForPcmRpm = /PCM\s*(?:\+|and|y|ak)\s*RPM/i.test(question) || program === "PCM + RPM";
  const combinedProgram = asksForCcmRpm && /programs\/ccm-rpm\.md/i.test(sourcePaths) ? "CCM + RPM"
    : asksForPcmRpm && /programs\/pcm-rpm\.md/i.test(sourcePaths) ? "PCM + RPM" : "";
  const programNames = ["ACCESS", "CCM", "RPM", "PCM", "APCM", "ASM"];
  const explicitPrograms = programNames.filter(name => new RegExp(`\\b${name}\\b`, "i").test(question));
  const programs = programNames.filter(name => new RegExp(`\\b${name}\\b`, "i").test(`${question} ${sources.map(item => item.sourcePath).join(" ")}`));
  if (/(difference|diferencia|diferans|compare)/i.test(question) && programs.includes("ACCESS") && programs.includes("CCM")) return pick(locale, {
    EN: `${programAnswers.ACCESS.EN} CCM is different: it is Medicare chronic care management for people with multiple chronic conditions and focuses on ongoing coordination between visits.`,
    ES: "ACCESS es un modelo de Medicare enfocado en apoyo adicional y resultados de salud, mientras que CCM es un servicio de manejo de cuidado crónico para personas con varias condiciones crónicas. Ambos pueden apoyar entre visitas, pero siguen reglas y configuraciones diferentes.",
    KR: "ACCESS se yon modèl Medicare ki konsantre sou plis sipò ak rezilta sante. CCM se yon sèvis jesyon swen kwonik pou moun ki gen plizyè maladi kwonik. Toude ka ede ant vizit, men yo gen règ diferan."
  });
  if (combinedProgram) return pick(locale, programAnswers[combinedProgram]);
  // A page written for this question beats every canned answer below it. Those exist for questions
  // no single page covers — comparing two programmes — and for pages that never had one. Left after
  // the leave-the-programme answer, this never ran for "when can I leave?", which is exactly the
  // question a page had just been written to answer with the ninety days in it.
  //
  // English reads the page itself; Spanish and Creole read the answer the page carries for them, so
  // they get the specific answer rather than the general paragraph an English speaker would never
  // have been given.
  const focused = sources[0] && !GENERIC_PROGRAM_PAGE.test(sources[0].sourcePath || "") ? sources[0] : null;
  if (focused) {
    const key = String(locale).toUpperCase();
    // English reads its own written answer first, exactly as Spanish and Creole already do, and only
    // falls back to the page body — now filtered — when the page has not been given one yet.
    const written = passageAnswer({ text: focused.localizedAnswers?.[key] || "" })
      || (key === "EN" ? passageAnswer(focused) : "");
    if (written) return written;
  }
  if (LEAVE_PROGRAM.test(question)) return leaveProgramAnswer(locale);
  const named = explicitPrograms.find(name => programAnswers[name]) || programs.find(name => programAnswers[name]);
  if (named) return pick(locale, programAnswers[named]);
  if (sources.some(item => /medications/.test(item.sourcePath))) return pick(locale, {
    EN: "Reviewing your medications helps the care team understand what you are taking now, what changed, and where you may need help. It does not change a prescription automatically, and EMMI will never tell you to start, stop, or change a medicine.",
    ES: "Revisar sus medicamentos ayuda al equipo a entender qué toma actualmente, qué cambió y dónde puede necesitar ayuda. Esta revisión no cambia una receta automáticamente, y EMMI nunca le indicará iniciar, suspender o cambiar un medicamento.",
    KR: "Revize medikaman ou ede ekip la konprann sa w ap pran kounye a, sa ki chanje, ak kote ou bezwen èd. Revizyon an pa chanje yon preskripsyon otomatikman, epi EMMI p ap di w kòmanse, sispann oswa chanje yon medikaman."
  });
  if (sources.some(item => /original-medicare/.test(item.sourcePath))) return pick(locale, {
    EN: "Original Medicare generally includes Part A and Part B. Whether a specific care program is available to you, and what you may pay, must be confirmed from your current coverage and program information.",
    ES: "Medicare Original generalmente incluye la Parte A y la Parte B. La disponibilidad de un programa específico y lo que podría pagar deben confirmarse con su cobertura y la información vigente del programa.",
    KR: "Medicare Orijinal anjeneral gen Pati A ak Pati B. Nou dwe verifye kouvèti aktyèl ou ak enfòmasyon pwogram nan pou konnen si yon sèvis disponib pou ou ak sa ou ka peye."
  });
  if (program && programAnswers[program] && /program|care|support|voluntar|obligat/i.test(question)) return pick(locale, programAnswers[program]);
  return unavailable(locale);
};

// Every cost sentence is chosen by the engine's explanation code, never by the assistant reading
// an amount and drawing its own conclusion. An unknown amount is answered as unknown.
const accessCostAnswer = (result, locale) => {
  const gross = `$${result.grossBeneficiaryResponsibility}`;
  const byCode = {
    SUPPLEMENTAL_COVERS_COST_SHARE: {
      EN: `Based on the coverage we verified, your expected payment for ACCESS is $0. Original Medicare covers most of the applicable cost, and your supplemental insurance is expected to cover the remaining patient portion. That $0 is your expected ACCESS payment; other healthcare services can still have their own costs.`,
      ES: `Según la cobertura que verificamos, su pago esperado por ACCESS es $0. Medicare Original cubre la mayor parte del costo aplicable y se espera que su seguro suplementario cubra la parte que le corresponde. Ese $0 es su pago esperado por ACCESS; otros servicios de salud pueden tener sus propios costos.`,
      KR: `Dapre kouvèti nou verifye a, peman ou prevwa pou ACCESS se $0. Medicare Orijinal kouvri pifò nan depans ki aplikab la, epi nou prevwa asirans siplemantè ou ap kouvri rès pati pa ou a. $0 sa a se peman ACCESS ou prevwa a; lòt sèvis sante ka gen pwòp depans pa yo.`
    },
    NO_SUPPLEMENTAL_COVERAGE: {
      EN: `Based on the coverage we verified, your expected payment for ACCESS is ${gross} per month for your current track. Medicare covers most of the applicable cost and this is the remaining patient portion.`,
      ES: `Según la cobertura que verificamos, su pago esperado por ACCESS es de ${gross} al mes para su vía actual. Medicare cubre la mayor parte del costo aplicable y esta es la parte que le corresponde.`,
      KR: `Dapre kouvèti nou verifye a, peman ou prevwa pou ACCESS se ${gross} pa mwa pou wout ou kounye a. Medicare kouvri pifò nan depans ki aplikab la epi sa a se rès pati pa ou a.`
    },
    SUPPLEMENTAL_COVERAGE_UNKNOWN: {
      EN: `I could not confirm whether your supplemental coverage pays the ACCESS patient portion, so I do not have a final expected payment for you yet. Before that is confirmed, the patient portion for your current track is ${gross} per month. Your care team can check your coverage.`,
      ES: `No pude confirmar si su cobertura suplementaria paga la parte del paciente de ACCESS, así que todavía no tengo un pago esperado definitivo. Antes de confirmarlo, la parte del paciente para su vía actual es de ${gross} al mes. Su equipo de atención puede verificar su cobertura.`,
      KR: `Mwen pa t ka konfime si kouvèti siplemantè ou peye pati pasyan an pou ACCESS, kidonk mwen poko gen yon peman final ou prevwa. Anvan sa konfime, pati pasyan an pou wout ou kounye a se ${gross} pa mwa. Ekip swen ou ka verifye kouvèti ou.`
    },
    COVERAGE_VERIFICATION_STALE: {
      EN: `Your coverage was last verified a while ago, so I do not want to give you an amount that may be out of date. Your care team can re-check your coverage and then I can tell you your expected payment.`,
      ES: `Su cobertura se verificó hace tiempo, así que prefiero no darle una cantidad que podría estar desactualizada. Su equipo de atención puede verificarla de nuevo y luego podré decirle su pago esperado.`,
      KR: `Se gen yon bon tan depi nou te verifye kouvèti ou, kidonk mwen pa vle ba w yon montan ki ka pa ajou. Ekip swen ou ka reverifye kouvèti a epi apre sa mwen ka di w peman ou prevwa a.`
    },
    COVERAGE_NOT_VERIFIED: {
      EN: `I could not verify your coverage from the information currently available, so I do not have an expected payment to give you yet. Your care team can check this with you.`,
      ES: `No pude verificar su cobertura con la información disponible, así que todavía no tengo un pago esperado para darle. Su equipo de atención puede revisarlo con usted.`,
      KR: `Mwen pa t ka verifye kouvèti ou ak enfòmasyon ki disponib kounye a, kidonk mwen poko gen yon peman ou prevwa pou m ba w. Ekip swen ou ka tcheke sa avèk ou.`
    },
    QMB_COST_SHARE_RULES: {
      EN: `Your coverage includes a Qualified Medicare Beneficiary designation, which has its own cost-sharing rules. I do not want to state an amount for you without your care team confirming how those rules apply.`,
      ES: `Su cobertura incluye la designación de Beneficiario Calificado de Medicare, que tiene sus propias reglas de costos. Prefiero no indicarle una cantidad sin que su equipo confirme cómo se aplican esas reglas.`,
      KR: `Kouvèti ou gen yon deziyasyon Benefisyè Medicare Kalifye, ki gen pwòp règ pa l sou depans. Mwen pa vle bay yon montan san ekip swen ou konfime kijan règ sa yo aplike.`
    },
    MEDICARE_ADVANTAGE_NOT_ELIGIBLE: {
      EN: `Your coverage shows a Medicare Advantage plan rather than Original Medicare. That affects whether ACCESS is available to you, not just the amount, so your care team needs to review your eligibility before I can talk about a payment.`,
      ES: `Su cobertura muestra un plan Medicare Advantage en lugar de Medicare Original. Eso afecta si ACCESS está disponible para usted, no solo la cantidad, así que su equipo debe revisar su elegibilidad antes de que pueda hablar de un pago.`,
      KR: `Kouvèti ou montre yon plan Medicare Advantage olye Medicare Orijinal. Sa afekte si ACCESS disponib pou ou, se pa sèlman montan an, kidonk ekip swen ou dwe revize kalifikasyon ou anvan mwen ka pale sou yon peman.`
    }
  }[result.explanationCode];
  return byCode ? pick(locale, byCode) : pick(locale, byCode || {
    EN: "I do not have a confirmed expected payment for you right now. Your care team can check your coverage.",
    ES: "Ahora mismo no tengo un pago esperado confirmado. Su equipo de atención puede verificar su cobertura.",
    KR: "Mwen pa gen yon peman konfime ou prevwa kounye a. Ekip swen ou ka verifye kouvèti ou."
  });
};

// The patient's own starting point, said back to them. Nothing is computed here: every number is
// read from the resolved shape, so a baseline that is pending produces a sentence saying so rather
// than a plausible-looking number.
const accessStartingPointAnswer = (locale, entry) => {
  const point = entry.startingPoint || {};
  if (point.status !== "CONFIRMED") return entry.goalType === "WEIGHT_MANAGEMENT"
    ? pick(locale, { EN: "I don’t have a confirmed starting weight for you yet. Your care team confirms it as part of setting up your care.", ES: "Todavía no tengo un peso inicial confirmado para usted. Su equipo de atención lo confirma como parte de la configuración de su cuidado.", KR: "Mwen poko gen yon pwa nan konmansman ki konfime pou ou. Ekip swen ou konfime l antan y ap mete swen ou anplas." })
    : pick(locale, { EN: "I don’t have a confirmed starting blood pressure for you yet. Your care team confirms it as part of setting up your care.", ES: "Todavía no tengo una presión arterial inicial confirmada para usted. Su equipo de atención la confirma como parte de la configuración de su cuidado.", KR: "Mwen poko gen yon tansyon nan konmansman ki konfime pou ou. Ekip swen ou konfime l antan y ap mete swen ou anplas." });
  if (entry.goalType === "WEIGHT_MANAGEMENT") {
    const weight = pick(locale, { EN: `Your starting weight is ${point.value} pounds.`, ES: `Su peso inicial es ${point.value} libras.`, KR: `Pwa ou nan konmansman an se ${point.value} liv.` });
    if (!point.bmi) return weight;
    const bmi = Number(point.bmi).toFixed(1);
    return `${weight} ${pick(locale, { EN: `Your BMI at that starting point is ${bmi}.`, ES: `Su IMC en ese punto de partida es ${bmi}.`, KR: `BMI ou nan pwen depa sa a se ${bmi}.` })}`;
  }
  // A systolic without a diastolic is still a baseline. It is named as a systolic rather than read
  // out as half of a pair the record does not hold.
  if (!point.diastolic) return pick(locale, { EN: `Your starting systolic blood pressure is ${point.value} mmHg.`, ES: `Su presión arterial sistólica inicial es ${point.value} mmHg.`, KR: `Tansyon sistolik ou nan konmansman an se ${point.value} mmHg.` });
  return pick(locale, { EN: `Your starting blood pressure is ${point.value} over ${point.diastolic}.`, ES: `Su presión arterial inicial es ${point.value} sobre ${point.diastolic}.`, KR: `Tansyon ou nan konmansman an se ${point.value} sou ${point.diastolic}.` });
};

// The milestone, always said with the baseline it came from and always distinguished from the
// control target. "137" on its own is the answer this whole module exists to avoid giving: it
// tells a patient who started at 152 that 137 is where they are trying to land, which is not what
// ACCESS means and is worse than saying nothing.
const accessMilestoneAnswer = (locale, entry) => {
  const measure = entry.measure || {};
  const milestone = measure.improvementMilestone;
  if (!milestone) return accessStartingPointAnswer(locale, entry);
  if (entry.goalType === "WEIGHT_MANAGEMENT") {
    return pick(locale, {
      EN: `Based on your starting weight of ${milestone.derivedFromBaseline} pounds, ${milestone.improvementRequired}% is about ${milestone.reductionFromBaseline} pounds, which corresponds to an ACCESS improvement milestone of about ${milestone.value} pounds or lower. The control target is separate: a BMI below ${measure.control.value}.`,
      ES: `Con base en su peso inicial de ${milestone.derivedFromBaseline} libras, ${milestone.improvementRequired}% es aproximadamente ${milestone.reductionFromBaseline} libras, lo que corresponde a un hito de mejora de ACCESS de aproximadamente ${milestone.value} libras o menos. La meta de control es distinta: un IMC menor de ${measure.control.value}.`,
      KR: `Dapre pwa ou nan konmansman an ki se ${milestone.derivedFromBaseline} liv, ${milestone.improvementRequired}% se anviwon ${milestone.reductionFromBaseline} liv, sa ki koresponn ak yon etap amelyorasyon ACCESS anviwon ${milestone.value} liv oswa mwens. Objektif kontwòl la se yon lòt bagay: yon BMI anba ${measure.control.value}.`
    });
  }
  return pick(locale, {
    EN: `Based on your starting systolic blood pressure of ${milestone.derivedFromBaseline}, your ACCESS improvement milestone is ${milestone.value} mmHg or lower. That is not the same as the control target, which is below ${measure.control.value} mmHg systolic.`,
    ES: `Con base en su presión sistólica inicial de ${milestone.derivedFromBaseline}, su hito de mejora de ACCESS es ${milestone.value} mmHg o menos. No es lo mismo que la meta de control, que es menos de ${measure.control.value} mmHg sistólica.`,
    KR: `Dapre tansyon sistolik ou nan konmansman an ki se ${milestone.derivedFromBaseline}, etap amelyorasyon ACCESS ou se ${milestone.value} mmHg oswa mwens. Sa pa menm bagay ak objektif kontwòl la, ki se anba ${measure.control.value} mmHg sistolik.`
  });
};

// A patient who asked for a different clinical number was told whose the number is. That answer is
// correct and it is not the whole of what they wanted: they were describing something they want to
// get better at, and there is a goal in that which is entirely theirs to set.
//
// It comes second, always, and it never softens the first half. "Your care team owns this target"
// followed by "and here is what I can help you with" is the honest shape; leading with the offer
// would read as talking them out of the question they actually asked.
const clinicalGoalOffer = (question, locale) => {
  // Only when they asked for the number to be different. "What is my blood pressure target?" is a
  // question about their care, and answering it with an offer would be selling them something they
  // did not ask for — the classifier alone cannot tell the two apart, because both name a target.
  if (!WANTS_A_DIFFERENT_NUMBER.test(clean(question))) return "";
  const verdict = classifyGoalStatement(question);
  if (verdict.kind !== GOAL_STATEMENT_KINDS.CLINICAL_TARGET || !verdict.goal) return "";
  const goal = typeof verdict.goal.title === "string" ? verdict.goal.title : pick(locale, { EN: verdict.goal.title.en, ES: verdict.goal.title.es, KR: verdict.goal.title.ht });
  const topic = verdict.careTeamTopic ? pick(locale, { EN: verdict.careTeamTopic.en, ES: verdict.careTeamTopic.es, KR: verdict.careTeamTopic.ht }) : "";
  return pick(locale, {
    EN: `What I can help with is a goal of your own — something like “${goal}”.${topic ? ` I can also write down “${topic}” to ask them.` : ""} Would you like to set that up?`,
    ES: `Con lo que sí puedo ayudarle es con una meta suya, algo como «${goal}».${topic ? ` También puedo anotar «${topic}» para preguntarles.` : ""} ¿Quiere que la definamos?`,
    KR: `Sa mwen ka ede w avè l se yon objektif pa ou — yon bagay tankou « ${goal} ».${topic ? ` Mwen ka ekri « ${topic} » tou pou mande yo.` : ""} Èske ou vle nou mete l?`
  });
};

// "What am I doing to reach it?" — the plan, named goal by goal. A goal with no steps says so
// rather than being left out, because "you have no plan yet" is the answer that leads somewhere.
const goalPlanAnswer = (result, locale) => {
  const goals = (result?.goals || []).filter(item => item?.title);
  if (!goals.length) return pick(locale, { EN: "You don’t have any goals saved yet, so there are no steps to show.", ES: "Todavía no tiene metas guardadas, así que no hay pasos que mostrar.", KR: "Ou poko gen objektif ki sove, kidonk pa gen etap pou montre." });
  const lines = goals.map(goal => {
    const steps = (goal.actions || []).filter(item => item?.title).map(item => item.title);
    return steps.length
      ? pick(locale, {
        EN: `For “${goal.title}”, your plan is: ${steps.join("; ")}.`,
        ES: `Para «${goal.title}», su plan es: ${steps.join("; ")}.`,
        KR: `Pou « ${goal.title} », plan ou se: ${steps.join("; ")}.`
      })
      : pick(locale, {
        EN: `“${goal.title}” has no steps in its plan yet.`,
        ES: `«${goal.title}» todavía no tiene pasos en su plan.`,
        KR: `« ${goal.title} » poko gen etap nan plan li.`
      });
  });
  const closing = pick(locale, {
    EN: "Those steps are what you do; the goal is what you are working toward. You can change a step without changing the goal.",
    ES: "Esos pasos son lo que usted hace; la meta es lo que quiere conseguir. Puede cambiar un paso sin cambiar la meta.",
    KR: "Etap sa yo se sa ou fè; objektif la se sa w ap chèche rive. Ou ka chanje yon etap san ou pa chanje objektif la."
  });
  return `${lines.join(" ")} ${closing}`;
};

// What we would write down, offered back. Nothing has been saved at this point and the wording
// says so, because a patient told "I saved that" about a proposal they never accepted has been
// lied to about their own record.
const goalProposalAnswer = (opened, locale) => {
  if (opened.clarify) return opened.clarify;
  const goal = opened.suggestedGoal?.title || "";
  const step = opened.suggestedAction?.title || "";
  const clinical = opened.clinicalMeasure === "MEDICATION"
    ? pick(locale, { EN: " Your treatment stays with your care team — I can’t change a medication or a dose.", ES: " Su tratamiento sigue a cargo de su equipo de atención: no puedo cambiar un medicamento ni una dosis.", KR: " Tretman ou rete ak ekip swen ou — mwen pa ka chanje yon medikaman ni yon doz." })
    : opened.clinicalMeasure
      ? pick(locale, { EN: " The target numbers stay with your care team.", ES: " Los números objetivo siguen a cargo de su equipo de atención.", KR: " Chif sib yo rete ak ekip swen ou." })
      : "";
  const topic = opened.careTeamTopic
    ? pick(locale, { EN: ` I’ve also put “${opened.careTeamTopic}” there as a question for them.`, ES: ` También puse «${opened.careTeamTopic}» ahí como pregunta para ellos.`, KR: ` Mwen mete « ${opened.careTeamTopic} » la tou kòm yon kesyon pou yo.` })
    : "";
  const body = goal && step
    ? pick(locale, {
      EN: `That sounds like something you’ll do, so I’d put “${step}” in your plan and set your goal as “${goal}”.`,
      ES: `Eso suena a algo que usted hará, así que pondría «${step}» en su plan y su meta sería «${goal}».`,
      KR: `Sa sanble ak yon bagay w ap fè, kidonk mwen ta mete « ${step} » nan plan ou epi objektif ou ta « ${goal} ».`
    })
    : goal
      ? pick(locale, {
        EN: `I’d write your goal as “${goal}”.`,
        ES: `Escribiría su meta como «${goal}».`,
        KR: `Mwen ta ekri objektif ou konsa: « ${goal} ».`
      })
      : pick(locale, {
        EN: "Let’s put that into words together.",
        ES: "Pongámoslo en palabras juntos.",
        KR: "Ann mete sa an mo ansanm."
      });
  const closing = pick(locale, {
    EN: " It’s on screen now — change any of it, and save it when it sounds right. Nothing is saved until you do.",
    ES: " Está en pantalla ahora: cambie lo que quiera y guárdelo cuando le parezca bien. No se guarda nada hasta que lo haga.",
    KR: " Li sou ekran an kounye a — chanje sa ou vle, epi sove l lè li sanble kòrèk. Anyen pa sove jiskaske ou fè sa."
  });
  return `${body}${clinical}${topic}${closing}`;
};

const runtimeAnswer = ({ tool, result, locale, context, question = "" }) => {
  if (tool === "getExpectedAccessCost") {
    const cost = accessCostAnswer(result, locale);
    return LEAVE_PROGRAM.test(question) ? `${cost} ${leaveProgramAnswer(locale)}` : cost;
  }
  if (tool === "getPatientCoverage") {
    if (!result.found) return pick(locale, {
      EN: "I could not verify supplemental coverage from the information currently available. Your care team can check this with you.",
      ES: "No pude verificar cobertura suplementaria con la información disponible. Su equipo de atención puede revisarlo con usted.",
      KR: "Mwen pa t ka verifye kouvèti siplemantè ak enfòmasyon ki disponib kounye a. Ekip swen ou ka tcheke sa avèk ou."
    });
    const medicare = result.medicare?.isOriginalMedicare
      ? pick(locale, { EN: "Your coverage shows active Original Medicare, including Part A and Part B.", ES: "Su cobertura muestra Medicare Original activo, con Parte A y Parte B.", KR: "Kouvèti ou montre Medicare Orijinal aktif, ak Pati A ak Pati B." })
      : result.medicare?.isMedicareAdvantage
        ? pick(locale, { EN: "Your coverage shows a Medicare Advantage plan rather than Original Medicare.", ES: "Su cobertura muestra un plan Medicare Advantage en lugar de Medicare Original.", KR: "Kouvèti ou montre yon plan Medicare Advantage olye Medicare Orijinal." })
        : pick(locale, { EN: "I could not confirm which kind of Medicare coverage you have.", ES: "No pude confirmar qué tipo de cobertura de Medicare tiene.", KR: "Mwen pa t ka konfime ki kalite kouvèti Medicare ou genyen." });
    // Only a payer actually classified as a Medicare Supplement is described as supplemental.
    const supplement = result.supplemental
      ? (result.supplemental.carrierName
        ? pick(locale, { EN: ` We also verified active supplemental coverage: ${result.supplemental.carrierName}.`, ES: ` También verificamos cobertura suplementaria activa: ${result.supplemental.carrierName}.`, KR: ` Nou verifye tou yon kouvèti siplemantè aktif: ${result.supplemental.carrierName}.` })
        : pick(locale, { EN: " We also verified active supplemental coverage, but I do not have the plan name available.", ES: " También verificamos cobertura suplementaria activa, pero no tengo el nombre del plan disponible.", KR: " Nou verifye tou yon kouvèti siplemantè aktif, men mwen pa gen non plan an." }))
      : pick(locale, { EN: " I could not verify supplemental coverage from the information currently available.", ES: " No pude verificar cobertura suplementaria con la información disponible.", KR: " Mwen pa t ka verifye kouvèti siplemantè ak enfòmasyon ki disponib kounye a." });
    return `${medicare}${supplement}`;
  }
  if (tool === "getEnrollmentContext") {
    if (result.enrollmentComplete || result.enrollmentStatus === "COMPLETED") return pick(locale, {
      EN: "Your ACCESS enrollment is complete.",
      ES: "Su inscripción en ACCESS está completa.",
      KR: "Enskripsyon ACCESS ou konplè."
    });
    const eligible = result.eligibilityStatus === "ELIGIBLE";
    return eligible ? pick(locale, { EN: "Your current ACCESS eligibility result shows that you can continue. You are not enrolled until you review the information and agree.", ES: "Su resultado actual de elegibilidad para ACCESS indica que puede continuar. No estará inscrito hasta que revise la información y acepte.", KR: "Rezilta kalifikasyon ACCESS ou montre ou ka kontinye. Ou poko enskri jiskaske ou revize enfòmasyon yo epi dakò." })
      : pick(locale, { EN: "I can’t confirm that you are eligible right now. Your Medicare benefits and regular care do not change because of this check.", ES: "Ahora mismo no puedo confirmar que sea elegible. Sus beneficios de Medicare y su cuidado habitual no cambian por esta verificación.", KR: "Mwen pa ka konfime ou kalifye kounye a. Benefis Medicare ou ak swen nòmal ou pa chanje akoz verifikasyon sa a." });
  }
  if (tool === "getAssignedDevice") {
    if (DEVICE_FULFILLMENT.test(question)) {
      const fulfillment = String(result.fulfillmentStatus || "NOT_REQUESTED").toUpperCase();
      const shipment = String(result.shipmentStatus || "").toUpperCase();
      if (shipment === "SHIPPED" || fulfillment === "SHIPPED") return pick(locale, {
        EN: "Your monitor is marked as shipped. I don’t have a confirmed delivery date unless one appears in your care record.",
        ES: "Su monitor aparece como enviado. No tengo una fecha de entrega confirmada a menos que figure en su registro de cuidado.",
        KR: "Dosye a montre yo voye aparèy ou a. Mwen pa gen yon dat livrezon konfime sof si li parèt nan dosye swen ou."
      });
      if (["REQUESTED", "PROCESSING", "READY_TO_SHIP"].includes(fulfillment)) return pick(locale, {
        EN: "Your monitor request is recorded, but I don’t see a shipped status or a confirmed delivery date yet.",
        ES: "La solicitud de su monitor está registrada, pero todavía no veo que haya sido enviado ni una fecha de entrega confirmada.",
        KR: "Demann aparèy ou a anrejistre, men mwen poko wè yo voye li ni yon dat livrezon konfime."
      });
      return pick(locale, {
        EN: "I don’t see a monitor shipment request in your care record yet, so I can’t give you a shipping or delivery date.",
        ES: "Todavía no veo una solicitud de envío del monitor en su registro de cuidado, así que no puedo darle una fecha de envío o entrega.",
        KR: "Mwen poko wè yon demann pou voye aparèy la nan dosye swen ou, kidonk mwen pa ka bay yon dat yo pral voye oswa livre li."
      });
    }
    if (result.found) return pick(locale, { EN: `The monitor assigned to your care is the ${result.displayName || result.model || result.vendor} and its device number ends in ${String(result.deviceId || "").slice(-4)}. Its current ITERA connection status is ${result.integrationStatus === "CONNECTED" ? "connected" : "not connected"}.`, ES: `El monitor asignado a su cuidado es ${result.displayName || result.model || result.vendor} y su número termina en ${String(result.deviceId || "").slice(-4)}. Su estado actual con ITERA es ${result.integrationStatus === "CONNECTED" ? "conectado" : "no conectado"}.`, KR: `Aparèy ki asiyen pou swen ou se ${result.displayName || result.model || result.vendor}, epi nimewo li fini ak ${String(result.deviceId || "").slice(-4)}. Eta koneksyon li ak ITERA se ${result.integrationStatus === "CONNECTED" ? "konekte" : "pa konekte"}.` });
    return result.patientOwnsMonitor ? pick(locale, { EN: "Your information shows that you have your own monitor, but it is not connected to ITERA.", ES: "Su información indica que tiene su propio monitor, pero no está conectado a ITERA.", KR: "Enfòmasyon ou montre ou gen pwòp aparèy ou, men li pa konekte ak ITERA." }) : pick(locale, { EN: "I don’t see a monitor assigned to your care yet.", ES: "Todavía no veo un monitor asignado a su cuidado.", KR: "Mwen poko wè yon aparèy ki asiyen pou swen ou." });
  }
  if (tool === "getMedicationList") {
    const names = (result.medications || []).filter(item => item.active).map(item => item.details ? `${item.name} (${item.details})` : item.name);
    return names.length ? pick(locale, { EN: `The medications currently on file are ${names.join(" and ")}. Please review them on the medication screen; this does not change a prescription.`, ES: `Los medicamentos registrados actualmente son ${names.join(" y ")}. Revíselos en la pantalla de medicamentos; esta revisión no cambia una receta.`, KR: `Medikaman ki nan dosye a kounye a se ${names.join(" ak ")}. Tanpri revize yo sou ekran medikaman an; sa pa chanje yon preskripsyon.` }) : pick(locale, { EN: "I don’t see any medications on file in this prototype.", ES: "No veo medicamentos registrados en este prototipo.", KR: "Mwen pa wè okenn medikaman nan dosye pwototip sa a." });
  }
  // Two kinds of goal, kept apart in the answer because they are kept apart everywhere else. A
  // patient who cannot tell which goals their care plan set from the ones they set themselves
  // cannot tell which ones are theirs to change.
  if (tool === "getPatientGoals") {
    const goals = (result.goals || []).filter(item => item?.title);
    if (!goals.length) return pick(locale, { EN: "You don’t have any goals saved yet. You can add one from My Goals.", ES: "Todavía no tiene metas guardadas. Puede agregar una desde Mis metas.", KR: "Ou poko gen okenn objektif ki sove. Ou ka ajoute youn nan Objektif mwen." });
    const fromPlan = goals.filter(item => item.goalKind !== "PERSONAL").map(item => item.title);
    const own = goals.filter(item => item.goalKind === "PERSONAL").map(item => item.title);
    const parts = [
      fromPlan.length ? pick(locale, { EN: `From your care plan: ${fromPlan.join("; ")}.`, ES: `De su plan de cuidado: ${fromPlan.join("; ")}.`, KR: `Nan plan swen ou: ${fromPlan.join("; ")}.` }) : "",
      own.length ? pick(locale, { EN: `Goals you set yourself: ${own.join("; ")}.`, ES: `Metas que usted definió: ${own.join("; ")}.`, KR: `Objektif ou menm mete: ${own.join("; ")}.` }) : ""
    ].filter(Boolean);
    const closing = own.length
      ? pick(locale, { EN: "You can reword or remove your own goals whenever you like; your care team keeps the targets on the plan ones.", ES: "Puede reescribir o eliminar sus propias metas cuando quiera; su equipo mantiene los objetivos de las del plan.", KR: "Ou ka reekri oswa retire pwòp objektif ou lè ou vle; ekip ou kenbe sib yo sou sa ki nan plan an." })
      : pick(locale, { EN: "You can also set a goal of your own from My Goals.", ES: "También puede definir una meta propia desde Mis metas.", KR: "Ou ka mete yon objektif pa ou tou nan Objektif mwen." });
    return `${parts.join(" ")} ${closing}`;
  }
  if (tool === "getLatestReading") {
    const reading = result.reading;
    if (!reading) return pick(locale, { EN: "I can’t confirm a recent blood pressure reading right now.", ES: "Ahora mismo no puedo confirmar una lectura reciente de presión arterial.", KR: "Mwen pa ka konfime yon dènye lekti tansyon kounye a." });
    const status = reading.classification === "WITHIN_EXPECTED_RANGE"
      ? pick(locale, { EN: "It is within the range your care team is following.", ES: "Está dentro del rango que sigue su equipo de atención.", KR: "Li nan limit ekip swen ou ap suiv la." })
      : pick(locale, { EN: "Use the status and next step shown by your care team in the app.", ES: "Use el estado y el próximo paso indicado por su equipo en la aplicación.", KR: "Swiv eta ak pwochen etap ekip swen ou montre nan aplikasyon an." });
    return pick(locale, { EN: `Your latest reading was ${reading.systolic}/${reading.diastolic} mmHg. ${status} The top number is the pressure when the heart pumps, and the bottom number is the pressure between beats.`, ES: `Su lectura más reciente fue ${reading.systolic}/${reading.diastolic} mmHg. ${status} El número superior es la presión cuando el corazón bombea y el inferior es la presión entre latidos.`, KR: `Dènye lekti ou te ${reading.systolic}/${reading.diastolic} mmHg. ${status} Chif anlè a se presyon lè kè a ponpe; chif anba a se presyon ant batman yo.` });
  }
  if (tool === "getReadingTrend") {
    const trend = result.trend;
    if (!trend || trend.direction === "INSUFFICIENT_DATA") return pick(locale, { EN: "There are not enough verified readings to describe a trend yet.", ES: "Aún no hay suficientes lecturas verificadas para describir una tendencia.", KR: "Poko gen ase lekti verifye pou dekri yon tandans." });
    const direction = trend.direction === "STABLE" ? pick(locale, { EN: "fairly stable", ES: "bastante estables", KR: "prèske estab" }) : trend.direction === "TRENDING_UP" ? pick(locale, { EN: "trending higher", ES: "con tendencia más alta", KR: "gen tandans monte" }) : pick(locale, { EN: "trending lower", ES: "con tendencia más baja", KR: "gen tandans desann" });
    return pick(locale, { EN: `Your ${trend.periodDays}-day average is ${trend.averageSystolic}/${trend.averageDiastolic} mmHg from ${trend.count} readings. The calculated trend is ${direction}. Readings can vary for different reasons, so I won’t guess at a cause.`, ES: `Su promedio de ${trend.periodDays} días es ${trend.averageSystolic}/${trend.averageDiastolic} mmHg, calculado con ${trend.count} lecturas. La tendencia calculada se mantiene ${direction}. Las lecturas pueden variar por distintas razones, así que no atribuiré una causa.`, KR: `Mwayèn ${trend.periodDays} jou ou se ${trend.averageSystolic}/${trend.averageDiastolic} mmHg nan ${trend.count} lekti. Tandans kalkile a ${direction}. Lekti yo ka varye pou plizyè rezon, kidonk mwen p ap devine kòz la.` });
  }
  if (tool === "getClinicalTarget") return result.target ? pick(locale, { EN: `Your care-team-defined target is less than ${result.target.systolicMaximum + 1}/${result.target.diastolicMaximum + 1} mmHg. Your care team owns this clinical target.`, ES: `El objetivo definido por su equipo es menos de ${result.target.systolicMaximum + 1}/${result.target.diastolicMaximum + 1} mmHg. Este objetivo clínico pertenece a su equipo de atención.`, KR: `Sib ekip swen ou fikse a se mwens pase ${result.target.systolicMaximum + 1}/${result.target.diastolicMaximum + 1} mmHg. Ekip swen ou responsab sib klinik sa a.` }) : unavailable(locale);
  if (tool === "getGoalProgress") return result.progress ? pick(locale, { EN: `${result.progress.readingCountThisWeek || 0} connected readings were received this week. Other steps are counted only when you report them or complete the related EMMI lesson.`, ES: `Esta semana se recibieron ${result.progress.readingCountThisWeek || 0} lecturas conectadas. Los demás pasos solo se cuentan cuando usted los registra o completa la lección correspondiente con EMMI.`, KR: `Nou resevwa ${result.progress.readingCountThisWeek || 0} lekti konekte semèn sa a. Lòt etap yo konte sèlman lè ou rapòte yo oswa fini leson EMMI ki mache avè l.` }) : unavailable(locale);
  // "Who is my care manager?", "who is my cardiologist?" and "who is on my care team?" are three
  // different questions about the same record, and all three used to be answered with the primary
  // care physician's name — so a patient asking for their nurse was confidently given their doctor.
  // The member list is already in the tool result; the answer names the person actually asked for.
  if (tool === "getCareTeam") {
    const members = (result.members || []).filter(member => member?.displayName);
    if (/who is on my care team|my care team is|whole care team|everyone on my|qui[eé]nes est[aá]n en mi equipo|mi equipo de (?:atenci[oó]n|cuidado) es|ekip swen mwen an se/i.test(question) && members.length) {
      const listed = members.map(member => (member.roleLabel || member.specialty ? `${member.displayName} (${member.roleLabel || member.specialty})` : member.displayName)).join("; ");
      return pick(locale, {
        EN: `Your care team is: ${listed}. ITERA provides additional support and does not replace them.`,
        ES: `Su equipo de atención es: ${listed}. ITERA brinda apoyo adicional y no los reemplaza.`,
        KR: `Ekip swen ou se: ${listed}. ITERA bay sipò anplis epi li pa ranplase yo.`
      });
    }
    const resolution = resolveRequestedProfessional(members, { text: question, locale: String(locale).toLowerCase() });
    if (resolution.status === "RESOLVED" && resolution.match) {
      const role = resolution.match.roleLabel || resolution.match.specialty || "";
      return pick(locale, {
        EN: `${resolution.match.displayName}${role ? `, ${role},` : ""} is part of your care team. ITERA provides additional support and does not replace them.`,
        ES: `${resolution.match.displayName}${role ? `, ${role},` : ""} forma parte de su equipo de atención. ITERA brinda apoyo adicional y no los reemplaza.`,
        KR: `${resolution.match.displayName}${role ? `, ${role},` : ""} fè pati ekip swen ou. ITERA bay sipò anplis epi li pa ranplase yo.`
      });
    }
    return result.physicianDisplayName ? pick(locale, { EN: `${result.physicianDisplayName} remains part of your care. ITERA provides additional support and does not replace your doctor.`, ES: `${result.physicianDisplayName} continúa siendo parte de su cuidado. ITERA brinda apoyo adicional y no reemplaza a su médico.`, KR: `${result.physicianDisplayName} rete yon pati nan swen ou. ITERA bay sipò anplis epi li pa ranplase doktè ou.` }) : pick(locale, { EN: "Your regular doctors remain part of your care. ITERA provides additional support and does not replace them.", ES: "Sus médicos habituales continúan formando parte de su cuidado. ITERA brinda apoyo adicional y no los reemplaza.", KR: "Doktè ou deja genyen yo rete nan swen ou. ITERA bay sipò anplis epi li pa ranplase yo." });
  }
  if (tool === "getNextBestAction") return pick(locale, { EN: `Your next step is “${result.label}.”`, ES: `Su próximo paso es “${result.label}”.`, KR: `Pwochen etap ou se “${result.label}”.` });
  return unavailable(locale);
};

export class EmmiTextOrchestrator {
  // `fetch` is a native browser method that requires `window` as its receiver. Stored bare and
  // then called as `this.fetch(...)`, every call threw "Illegal invocation" before it left the
  // page, the catch below swallowed it, and every knowledge answer fell through to the
  // deterministic fallback — in production, for every patient, since the model layer shipped.
  // The tests never saw it because they all inject their own fetchImpl. Wrap it so the default
  // keeps its receiver, and so an injected implementation is still called exactly as given.
  constructor({ getContext, getConversation, executeTool, screenExplanation, fetchImpl = (...args) => globalThis.fetch(...args), onEvent = () => {}, onSafetyEpisode = () => {}, onSafetyResolved = () => {} }) {
    this.getContext = getContext;
    this.getConversation = getConversation;
    this.executeTool = executeTool;
    this.screenExplanation = screenExplanation;
    this.fetch = fetchImpl;
    this.onEvent = onEvent;
    this.onSafetyEpisode = onSafetyEpisode;
    this.onSafetyResolved = onSafetyResolved;
  }

  // Each half of a compound turn is routed on its own and the answers are merged. The half that
  // names the subject hands it to the half that does not, so "am I eligible and how much does it
  // cost?" asks the second question about the same thing as the first.
  async #answerCompound({ parts, locale, questionId, trace, emit }) {
    const results = [];
    let carried = "";
    for (const part of parts) {
      const own = subjectOf(part);
      const inherits = !own || own.weak || hasBareReferent(part);
      results.push(await this.answer(part, { questionId, subQuestion: true, carriedSubject: inherits ? carried : "" }));
      if (own && !own.weak) carried = own.label;
    }
    const text = mergeCompoundAnswers(results.map(item => item?.text), { unavailableText: unavailable(locale) });
    Object.assign(trace, {
      intent: "COMPOUND_QUESTION",
      responseMode: "COMPOUND",
      compoundParts: parts,
      toolCalls: results.flatMap(item => item?.trace?.toolCalls || []),
      knowledgeChunkIds: results.flatMap(item => item?.trace?.knowledgeChunkIds || []),
      runtimeFactsUsed: results.flatMap(item => item?.trace?.runtimeFactsUsed || []),
      partIntents: results.map(item => item?.trace?.intent || "UNKNOWN")
    });
    emit("EMMI_ANSWER_ROUTED");
    const carriedField = field => results.find(item => item?.[field])?.[field];
    return {
      text: text || results[0]?.text || unavailable(locale),
      ...(carriedField("pendingAction") ? { pendingAction: carriedField("pendingAction") } : {}),
      ...(carriedField("quickAction") ? { quickAction: carriedField("quickAction") } : {}),
      ...(carriedField("appointmentPrepUpdate") ? { appointmentPrepUpdate: carriedField("appointmentPrepUpdate"), appointmentId: carriedField("appointmentId") || "" } : {}),
      trace
    };
  }

  async answer(question, { questionId = "", subQuestion = false, carriedSubject = "" } = {}) {
    const context = this.getContext();
    const locale = context.locale || "EN";
    const conversation = this.getConversation?.() || {};
    const appointmentPrepTopic = resolveAppointmentPrepTopic({ question, conversation, appointmentPrep: context.appointmentPrep });
    const retrievalQuery = expandEmmiQuery({ question, conversation, program: context.program, appointmentPrep: context.appointmentPrep, carriedSubject });
    const trace = { turnId: `emmi_turn_${Date.now().toString(36)}`, conversationSessionId: conversation.conversationSessionId || "", screenId: context.currentScreen, retrievalQuery, intent: "UNKNOWN", knowledgeChunkIds: [], toolCalls: [], runtimeFactsUsed: [], responseMode: "UNKNOWN" };
    const emit = (type, details = {}) => this.onEvent(type, { ...trace, ...details });

    const asked = foldApostrophes(question);
    const openEpisode = safetyEpisodeIsActive(conversation.activeSafetyEpisode) ? conversation.activeSafetyEpisode : null;

    // A patient who asks two things in one breath used to get one answer and silence for the rest,
    // because everything below is a chain of routes that returns on the first match.
    //
    // Two kinds of turn are answered whole instead. Safety, because half of "my chest hurts and
    // when is my appointment" is not a question about an appointment. And the routes that are
    // already deliberately multi-intent: appointment coordination answers a combined
    // ride-and-companion request as one action with the appointment attached, which is a better
    // answer than two smaller ones, so splitting it would be a downgrade. Appointment preparation
    // is left alone too — it owns its own turn-taking.
    if (!subQuestion) {
      const claimedBySafety = Boolean(openEpisode) || SAFETY.test(asked) || BP_READING.test(asked)
        || MEDICATION_SAFETY.test(asked) || Boolean(conversationPolicyResponse(question, locale));
      // Only when coordination is the whole turn. Their route answers a combined ride-and-companion
      // request better than two split answers, but it answers one thing: given "my daughter wants
      // to come with me but I also need to change the time" it opens the companion flow and the
      // reschedule disappears. So it takes the turn only when every part of it is coordination.
      // A trailing "¿cómo lo coordinamos?" is the same request continuing, not a second subject, so
      // it counts as coordination too. "I also need to change the time" names something else and
      // does not.
      const coordinationPart = part => APPOINTMENT_TRANSPORTATION.test(part) || APPOINTMENT_COMPANION.test(part) || isFollowUpQuestion(part);
      const coordinatingAppointment = Boolean(context.appointmentPrep?.appointmentId)
        && coordinationPart(question)
        && decomposeCompoundQuestion(question).every(coordinationPart);
      const resolvingCompanionPrivacy = context.appointmentSupport?.barrierType === "companion" && COMPANION_PRIVACY.test(question);
      // "How much does it cost and do I keep my doctor?" has a handler of its own. Both routes say
      // the same two things; that one says them in the better order, leading with the reassurance
      // and then the money, in a single paragraph. Decomposition covers the rest of the class.
      const askingCostAndDoctor = COST.test(asked) && DOCTOR_STATUS.test(asked) && !TRANSPORT_SUBJECT.test(asked);
      const preparing = context.appointmentPrep?.emmiPreparation?.status === "IN_PROGRESS";
      const claimed = claimedBySafety || coordinatingAppointment || resolvingCompanionPrivacy || askingCostAndDoctor || preparing;
      const parts = claimed ? [] : decomposeCompoundQuestion(question);
      if (parts.length > 1) return await this.#answerCompound({ parts, locale, questionId, trace, emit });
    }

    if (openEpisode) {
      // Resolution is read before the emergency gate. A patient saying "I called 911" or "the
      // emergency team is with me now" uses the words that raise an emergency, so the gate treated
      // every attempt to close the episode as a new one and re-armed it. Nothing could end it.
      const resolution = detectSafetyResolution(asked);
      if (resolution) {
        this.onSafetyResolved(resolution);
        trace.intent = "CLINICAL_SAFETY_RESOLVED"; trace.responseMode = "DETERMINISTIC_SAFETY"; emit("EMMI_ANSWER_ROUTED", { resolution });
        return { text: safetyResolutionCopy(resolution, locale), priority: "CRITICAL_SAFETY", deterministic: true, pendingAction: "clinical-task", trace };
      }
      if (!SAFETY.test(asked)) { trace.intent = "CLINICAL_SAFETY_FOLLOW_UP"; trace.responseMode = "DETERMINISTIC_SAFETY"; emit("EMMI_ANSWER_ROUTED"); return { ...safetyResponseFor({ locale, episode: openEpisode, question }), trace }; }
    }
    const policy = conversationPolicyResponse(question, locale); if (policy) { trace.intent = policy.intent; trace.responseMode = policy.responseMode; emit("EMMI_ANSWER_ROUTED"); return { text: policy.text, deterministic: true, trace }; }
    const bp = asked.match(BP_READING);
    if (SAFETY.test(asked) || bp) {
      trace.intent = "CLINICAL_SAFETY"; trace.toolCalls.push("evaluateClinicalEscalation");
      try {
        const result = await this.executeTool("evaluateClinicalEscalation", { systolic: Number(bp?.[1] || 0), diastolic: Number(bp?.[2] || 0), symptoms: question });
        trace.responseMode = "SAFETY_ENGINE"; trace.runtimeFactsUsed.push("clinicalEscalation.instruction"); emit("EMMI_ANSWER_ROUTED");
        if (result.instruction === "CALL_911") { const episode = createSafetyEpisode({ source: "text" }); this.onSafetyEpisode(episode); return { ...safetyResponseFor({ locale, episode, question }), trace }; }
        if (result.instruction === "CREATE_HIGH_PRIORITY_TASK") return { text: pick(locale, { EN: "This needs review by your care team. Would you like me to create a high-priority care-team task?", ES: "Esto necesita revisión de su equipo de atención. ¿Desea que cree una tarea de alta prioridad para el equipo?", KR: "Ekip swen ou bezwen revize sa. Èske ou vle m kreye yon travay priyorite wo pou ekip la?" }), pendingAction: "clinical-task", trace };
        // The gate matched on how the patient said they feel. Even when the engine returns
        // CONTINUE, this turn is answered as a health turn and offered a person — it must never
        // fall through to the knowledge base and come back as a program explanation.
        if (SAFETY.test(asked)) return { text: pick(locale, { EN: "Thank you for telling me. How you are feeling comes first, so I’d like your care team to look at this. Would you like me to let them know?", ES: "Gracias por contármelo. Cómo se siente es lo primero, así que quiero que su equipo de atención lo revise. ¿Desea que les avise?", KR: "Mèsi paske ou di m sa. Kijan ou santi w se premye bagay, kidonk mwen vle ekip swen ou gade sa. Èske ou vle m fè yo konnen?" }), pendingAction: "clinical-task", trace };
      } catch (error) { emit("EMMI_TOOL_FAILED", { tool: "evaluateClinicalEscalation", error: error?.message || "unknown" }); return { text: retrievalUnavailable(locale), trace }; }
    }
    if (MEDICATION_SAFETY.test(asked) && !(context.currentScreen === "MEDICATIONS_REVIEW" && MEDICATION_REVIEW_REPORT.test(asked))) {
      trace.intent = "MEDICATION_SAFETY"; trace.responseMode = "DETERMINISTIC_SAFETY"; emit("EMMI_ANSWER_ROUTED");
      return { ...safetyResponseFor({ locale, medication: true }), trace };
    }
    if (VOLUNTARY_CHOICE.test(asked)) {
      trace.intent = "VOLUNTARY_PARTICIPATION"; trace.responseMode = "DETERMINISTIC_GROUNDED_FALLBACK"; emit("EMMI_ANSWER_ROUTED");
      return { text: leaveProgramAnswer(locale), trace };
    }
    // What EMMI cannot do about authority, prescriptions and the clinical record is answered from
    // approved copy, ahead of retrieval and generation, so a limit is never paraphrased into a
    // softer one. Clinical safety still runs first: a limit is not an answer to chest pain.
    const guardrail = emmiGuardrailAnswer({ question: asked, questionId, locale, context });
    if (guardrail) {
      trace.intent = guardrail.intent; trace.responseMode = "DETERMINISTIC_GUARDRAIL"; emit("EMMI_ANSWER_ROUTED");
      return { text: guardrail.text, ...(guardrail.quickAction ? { quickAction: guardrail.quickAction } : {}), trace };
    }

    // After the guardrail on purpose. The product already carries approved, reviewed education for
    // the medications it puts on file, and that stays: a patient asking about their own lisinopril
    // gets the approved sentence. What this catches is everything the allowlist does not cover,
    // where the model was answering "what is X for?" with a fluent unsourced pharmacology lesson
    // written from its own weights - on the one subject where being confidently wrong hurts most.
    if (DRUG_EDUCATION.test(asked)) {
      trace.intent = "MEDICATION_EDUCATION_OUT_OF_SCOPE"; trace.responseMode = "DETERMINISTIC_GUARDRAIL"; emit("EMMI_ANSWER_ROUTED");
      return { text: drugEducationAnswer(locale), pendingAction: "callback", trace };
    }
    if (REPEAT_FOLLOW_UP.test(asked) || SIMPLIFY_FOLLOW_UP.test(asked)) {
      const prior = clean(conversation.lastEmmiTurn || [...(conversation.recentTurns || [])].reverse().find(turn => turn?.role === "assistant")?.text || "");
      if (prior) {
        trace.intent = REPEAT_FOLLOW_UP.test(asked) ? "REPEAT_PRIOR_ANSWER" : "SIMPLIFY_PRIOR_ANSWER";
        trace.responseMode = "DETERMINISTIC_CONVERSATION_CONTEXT";
        emit("EMMI_ANSWER_ROUTED");
        if (REPEAT_FOLLOW_UP.test(asked)) return { text: prior, trace };
        if (/next step|start your care journey|pr[oó]ximo paso|comience su recorrido|pwochen etap/i.test(prior)) return { text: pick(locale, {
          EN: "In simple terms: when you’re ready, tap “Start your care journey” to continue.",
          ES: "En palabras sencillas: cuando esté listo, pulse “Comience su recorrido de cuidado” para continuar.",
          KR: "An mo senp: lè ou pare, peze “Kòmanse pwosesis swen ou” pou kontinye."
        }), trace };
        if (/\bACCESS\b/i.test(prior)) return { text: pick(locale, {
          EN: "In simple terms: ACCESS gives you extra support between doctor visits. Your doctors still care for you, and joining is your choice.",
          ES: "En palabras sencillas: ACCESS le brinda apoyo adicional entre sus visitas médicas. Sus médicos siguen atendiéndole y participar es su decisión.",
          KR: "An mo senp: ACCESS ba ou plis sipò ant vizit doktè. Doktè ou kontinye pran swen ou, epi se ou ki chwazi patisipe."
        }), trace };
        const firstSentence = prior.match(/[^.!?]+[.!?]+|[^.!?]+/)?.[0]?.trim() || prior;
        return { text: pick(locale, { EN: `In simple terms: ${firstSentence}`, ES: `En palabras sencillas: ${firstSentence}`, KR: `An mo senp: ${firstSentence}` }), trace };
      }
    }
    if (SCREEN_HELP.test(asked)) {
      trace.intent = "CURRENT_SCREEN_HELP"; trace.responseMode = "SCREEN_CONTEXT"; emit("EMMI_ANSWER_ROUTED");
      // The screen the patient means is the VIEW, not the route: every step of appointment
      // coordination and of barrier resolution shares one route name, so passing only that made
      // "what do I do here?" answer for the wrong step. The context carries the view; the shell
      // prefers it and keeps the route as the fallback for screens with no describer.
      return { text: this.screenExplanation(context.currentScreen, context), trace };
    }
    // "Who invited me?" is a question about the invitation, and it is checked before the care-team
    // and support routes, which would otherwise read it as a request to be called back.
    if (INVITATION_SOURCE.test(asked)) {
      trace.intent = "INVITATION_SOURCE"; trace.responseMode = "RUNTIME_GROUNDED"; trace.toolCalls.push("getEnrollmentContext");
      try {
        const enrollment = await this.executeTool("getEnrollmentContext", { patientId: context.patientId });
        trace.runtimeFactsUsed.push("getEnrollmentContext"); emit("EMMI_ANSWER_ROUTED");
        return { text: invitationSourceAnswer(enrollment, locale), trace };
      } catch (error) {
        emit("EMMI_TOOL_FAILED", { tool: "getEnrollmentContext", error: error?.message || "unknown" });
        return { text: unavailable(locale), trace };
      }
    }
    // Wanting to reach the clinical team is an action, not a question. Tapping the quick question
    // already goes to the support options; this is the same request typed or spoken. It is checked
    // before human support, which would otherwise swallow "someone from my care team call me", and
    // long before retrieval, which would explain what a care team is to someone asking for one.
    const careTeamRequest = detectCareTeamContact({ question: asked, questionId });
    if (careTeamRequest) {
      trace.intent = CARE_TEAM_CONTACT_INTENT; trace.toolCalls.push("getCareTeam");
      try {
        const careTeam = await this.executeTool("getCareTeam", { patientId: context.patientId });
        const members = careTeam?.members || [];
        const resolution = resolveRequestedProfessional(members, { text: asked, professionalType: careTeamRequest.professionalType, locale: String(locale).toLowerCase() });
        trace.responseMode = "OPERATIONAL_CARE_TEAM_CONTACT"; trace.runtimeFactsUsed.push("getCareTeam"); emit("EMMI_ANSWER_ROUTED");
        return { text: careTeamContactPrompt({ resolution, locale, careTeamSize: members.length, requestedType: careTeamRequest.professionalType }), pendingAction: "callback", trace };
      } catch (error) {
        // A failed operational intent fails operationally. Sending the phrase to retrieval here is
        // the defect this route exists to prevent.
        emit("EMMI_TOOL_FAILED", { tool: "getCareTeam", error: error?.message || "unknown" });
        trace.responseMode = "OPERATIONAL_CARE_TEAM_CONTACT";
        return { text: careTeamContactPrompt({ resolution: null, locale, careTeamSize: 0 }), pendingAction: "callback", trace };
      }
    }
    if (HUMAN_SUPPORT.test(asked)) {
      trace.intent = "HUMAN_SUPPORT"; trace.responseMode = "CONFIRMATION_REQUIRED"; emit("EMMI_ANSWER_ROUTED");
      return { text: pick(locale, {
        EN: "Would you like me to ask the ITERA care team to call you? They are there Monday to Friday, 9:00 to 17:00 Eastern, and usually reach people within one business day. If something feels urgent before then, call your doctor’s office — and if it is an emergency, call 911.",
        ES: "¿Desea que solicite al equipo de atención de ITERA que le llame? Están disponibles de lunes a viernes, de 9:00 a 17:00 del Este, y por lo general se comunican en un día hábil. Si algo le urge antes, llame al consultorio de su médico; y si es una emergencia, llame al 911.",
        KR: "Èske ou vle m mande ekip swen ITERA a rele ou? Yo la lendi jiska vandredi, 9:00 a 17:00 lè Lès, epi anjeneral yo rive jwenn moun nan yon jou ouvrab. Si yon bagay sanble ijan anvan sa, rele biwo doktè ou — epi si se yon ijans, rele 911."
      }), pendingAction: "callback", trace };
    }
    // Whether to measure again is a question about the baseline counters, so it is answered only
    // when those counters actually say no; anything else falls through to normal routing.
    if (asksAboutMeasuringAgain(asked)) {
      trace.intent = "BASELINE_READING"; trace.toolCalls.push("getEnrollmentContext");
      try {
        const enrollment = await this.executeTool("getEnrollmentContext", { patientId: context.patientId });
        const sourceVerified = enrollment.deviceVerificationStatus === "SOURCE_VERIFIED" || enrollment.firstTransmissionVerified === true;
        if (sourceVerified && enrollment.bpBaselineReadingCount > 0 && enrollment.bpBaselineRemainingReadings > 0) {
          trace.responseMode = "RUNTIME_GROUNDED"; trace.runtimeFactsUsed.push("getEnrollmentContext"); emit("EMMI_ANSWER_ROUTED");
          return { text: pick(locale, { EN: "No. Your monitor is connected and we received your first reading. You can take your next readings later, and ITERA will receive them automatically.", ES: "No. Su monitor está conectado y recibimos su primera medición. Puede realizar las próximas más adelante e ITERA las recibirá automáticamente.", KR: "Non. Aparèy ou konekte epi nou resevwa premye mezi ou a. Ou ka pran lòt mezi yo pita, epi ITERA ap resevwa yo otomatikman." }), trace };
        }
      } catch (error) { emit("EMMI_TOOL_FAILED", { tool: "getEnrollmentContext", error: error?.message || "unknown" }); return { text: retrievalUnavailable(locale), trace }; }
    }
    // A starting point and a milestone are read from the patient's own record, never explained from
    // general education and never recomputed here. When this patient has no ACCESS baselines at all
    // the block claims nothing and lets normal routing take the turn.
    const milestoneAsked = ACCESS_MILESTONE.test(asked);
    if (milestoneAsked || ACCESS_BASELINE.test(asked)) {
      trace.intent = milestoneAsked ? "ACCESS_IMPROVEMENT_MILESTONE" : "ACCESS_BASELINE";
      trace.toolCalls.push("getAccessBaseline");
      try {
        const goalType = accessBaselineGoalType(asked);
        const resolved = await this.executeTool("getAccessBaseline", { patientId: context.patientId, ...(goalType ? { goalType } : {}) });
        const baselines = resolved?.baselines || [];
        if (baselines.length) {
          trace.responseMode = "RUNTIME_GROUNDED"; trace.runtimeFactsUsed.push("getAccessBaseline"); emit("EMMI_ANSWER_ROUTED");
          return { text: baselines.map(entry => milestoneAsked ? accessMilestoneAnswer(locale, entry) : accessStartingPointAnswer(locale, entry)).join(" "), trace };
        }
      } catch (error) { emit("EMMI_TOOL_FAILED", { tool: "getAccessBaseline", error: error?.message || "unknown" }); return { text: retrievalUnavailable(locale), trace }; }
    }
    // Where a refill stands is a runtime fact, never a guess: EMMI reads the episodes and says what
    // each one is actually waiting on.
    if (REFILL_STATUS_QUESTION.test(asked)) {
      trace.intent = "REFILL_STATUS"; trace.responseMode = "RUNTIME_GROUNDED"; trace.toolCalls.push("getActiveRefills");
      try {
        const active = await this.executeTool("getActiveRefills", { patientId: context.patientId });
        trace.runtimeFactsUsed.push("getActiveRefills"); emit("EMMI_ANSWER_ROUTED");
        return { text: refillStatusAnswer(locale, active?.refills || []), trace };
      } catch (error) { emit("EMMI_TOOL_FAILED", { tool: "getActiveRefills", error: error?.message || "unknown" }); return { text: retrievalUnavailable(locale), trace }; }
    }
    // Running out of a medication opens the review that confirms it, rather than an answer about
    // medications in general.
    if (REFILL_NEED.test(asked) && !MEDICATION_SAFETY.test(asked)) {
      trace.intent = "MEDICATION_REFILL"; trace.responseMode = "REFILL_ENGINE"; trace.toolCalls.push("getMedicationSupply");
      try {
        const supply = await this.executeTool("getMedicationSupply", { patientId: context.patientId });
        const medications = supply?.medications || [];
        const named = medications.filter(medication => new RegExp(medication.name.split(" ")[0], "i").test(asked));
        const lowFirst = [...medications].sort((a, b) => (a.estimatedDaysRemaining ?? 999) - (b.estimatedDaysRemaining ?? 999));
        const candidates = named.length ? named : lowFirst.filter(medication => medication.canEstimate && medication.estimatedDaysRemaining !== null && medication.estimatedDaysRemaining <= 14);
        // Ambiguity is answered with a question, never with a guess about which medication.
        if (candidates.length !== 1) {
          emit("EMMI_ANSWER_ROUTED", { medicationCandidates: candidates.length });
          return { text: refillSelectionAnswer(locale, medications), quickAction: "medication-refill", trace };
        }
        const opened = await this.executeTool("startRefillReview", { patientId: context.patientId, medicationId: candidates[0].medicationId });
        trace.toolCalls.push("startRefillReview"); emit("EMMI_ANSWER_ROUTED");
        if (opened?.alreadyRequested) return { text: refillAlreadyRequestedAnswer(locale, candidates[0].name, opened.patientStatus), quickAction: "medication-refill", medicationId: candidates[0].medicationId, trace };
        if (opened?.success) return { text: refillReviewAnswer(locale, candidates[0].name), quickAction: "medication-refill", medicationId: candidates[0].medicationId, trace };
      } catch (error) { emit("EMMI_TOOL_FAILED", { tool: "startRefillReview", error: error?.message || "unknown" }); }
      // Nothing was opened, so nothing is promised.
      return { text: pick(locale, {
        EN: "I couldn’t open your refill just now. You can open My Medications, or I can help you reach your care team.",
        ES: "No pude abrir su surtida ahora. Puede abrir Mis medicamentos o puedo ayudarle a comunicarse con su equipo.",
        KR: "Mwen pa t ka louvri ranplisaj ou kounye a. Ou ka louvri Medikaman mwen yo oswa mwen ka ede w jwenn ekip swen ou."
      }), trace };
    }
    const topicCommands = parseAppointmentTopicCommands({ question, appointmentPrep: context.appointmentPrep });
    if (topicCommands.length) {
      trace.intent = "APPOINTMENT_TOPIC_LIST";
      trace.responseMode = "APPOINTMENT_TOPIC_TOOL";
      if (!context.appointmentPrep?.appointmentId) {
        emit("EMMI_ANSWER_ROUTED", { appointmentTopicStatus: "APPOINTMENT_REQUIRED", appointmentCandidates: context.appointmentPrep?.appointmentCandidates?.length || 0 });
        return { text: pick(locale, { EN: "Which appointment would you like to prepare for?", ES: "¿Para cuál cita desea preparar la lista?", KR: "Pou ki randevou ou vle prepare lis la?" }), trace };
      }
      let lastResult = null;
      for (const command of topicCommands) {
        trace.toolCalls.push("manageAppointmentTopics");
        try {
          lastResult = await this.executeTool("manageAppointmentTopics", {
            patientId: context.patientId,
            appointmentId: context.appointmentPrep.appointmentId,
            ...command
          });
        } catch (error) {
          emit("EMMI_TOOL_FAILED", { tool: "manageAppointmentTopics", error: error?.message || "unknown" });
          return { text: pick(locale, { EN: "I couldn’t update your appointment list just now. Nothing was changed.", ES: "No pude actualizar su lista para la cita ahora. No se cambió nada.", KR: "Mwen pa t ka mete lis randevou ou ajou kounye a. Anyen pa chanje." }), trace };
        }
        if (!lastResult?.success) {
          emit("EMMI_ANSWER_ROUTED", { appointmentTopicStatus: lastResult?.status || "FAILED" });
          const ambiguous = lastResult?.status === "TOPIC_AMBIGUOUS" || lastResult?.status === "TOPIC_REQUIRED";
          return { text: ambiguous
            ? pick(locale, { EN: "Which item on your appointment list do you mean?", ES: "¿A cuál punto de su lista para la cita se refiere?", KR: "Ki pwen nan lis randevou ou vle di?" })
            : pick(locale, { EN: "I couldn’t find that item, so I didn’t change your list.", ES: "No encontré ese punto, así que no cambié su lista.", KR: "Mwen pa jwenn pwen sa a, kidonk mwen pa chanje lis ou a." }), trace };
        }
      }
      trace.runtimeFactsUsed.push("manageAppointmentTopics");
      emit("EMMI_ANSWER_ROUTED", { appointmentTopicOperations: topicCommands.map(item => item.operation), appointmentTopicCount: lastResult?.topics?.length || 0 });
      const onlyRead = topicCommands.every(item => ["LIST", "OPEN", "READ_ITEM"].includes(item.operation));
      const text = lastResult?.item
        ? pick(locale, { EN: `That item is: “${lastResult.item}”.`, ES: `Ese punto es: “${lastResult.item}”.`, KR: `Pwen sa a se: “${lastResult.item}”.` })
        : `${onlyRead ? "" : pick(locale, { EN: "Done. ", ES: "Listo. ", KR: "Fini. " })}${appointmentTopicListText(lastResult?.topics || [], locale)}`;
      return { text, appointmentId: context.appointmentPrep.appointmentId, trace };
    }
    // Appointments sit between the refill engine and the difficulty gate. A patient who says they
    // need to see their doctor is asking for a visit, not describing a barrier, so this runs before
    // the classifier that would file it as one; a patient describing a symptom never reaches this
    // block at all, because clinical safety above already took the turn (§3, §4, §5, §139).
    // §41: a pronoun only refers to an appointment when one is genuinely the subject of this
    // conversation. Recent turns decide that; a bare "cancel it" out of nowhere still means nothing.
    // A patient with an appointment open in front of them has an appointment in context, whether or
    // not anyone has said the word in the last few turns.
    const appointmentInContext = Boolean(context.appointmentPrep?.appointmentId)
      || APPOINTMENT_MENTION.test(String(conversation.conversationSummary || ""))
      || (conversation.recentTurns || []).some(turn => APPOINTMENT_MENTION.test(String(turn?.text || "")));
    if (context.appointmentSupport?.barrierType === "companion" && COMPANION_PRIVACY.test(question)) {
      trace.intent = "APPOINTMENT_COMPANION_PRIVACY";
      trace.responseMode = "DETERMINISTIC_APPOINTMENT_CONTEXT";
      emit("EMMI_ANSWER_ROUTED", { appointmentId: context.appointmentSupport.appointmentId || "", companionStep: context.appointmentSupport.step || "" });
      return { text: companionPrivacyAnswer(locale, context.appointmentSupport.contactName), appointmentId: context.appointmentSupport.appointmentId || "", trace };
    }
    // "Who pays for the Uber?" is not a status question, and answering it with "I do not see
    // confirmed transportation on file" implies there is transportation to confirm. ITERA has
    // decided there is no transportation benefit, so a question about who pays goes to the page
    // that says so rather than to a lookup that sounds like a maybe.
    if (APPOINTMENT_TRANSPORTATION.test(question) && context.appointmentPrep?.appointmentId && !COST.test(asked)) {
      trace.intent = "APPOINTMENT_TRANSPORTATION_STATUS";
      trace.responseMode = "RUNTIME_GROUNDED";
      trace.toolCalls.push("getAppointment", "getAppointmentTransportation");
      try {
        const [appointmentResult, transportationResult] = await Promise.all([
          this.executeTool("getAppointment", { patientId: context.patientId, appointmentId: context.appointmentPrep.appointmentId }),
          this.executeTool("getAppointmentTransportation", { patientId: context.patientId, appointmentId: context.appointmentPrep.appointmentId })
        ]);
        const appointment = appointmentResult?.appointment;
        const reservation = (transportationResult?.reservations || []).find(item => item.status === "CONFIRMED" && item.tripType === "OUTBOUND")
          || (transportationResult?.reservations || []).find(item => item.status === "CONFIRMED");
        trace.runtimeFactsUsed.push("getAppointment", "getAppointmentTransportation");
        emit("EMMI_ANSWER_ROUTED", { appointmentId: context.appointmentPrep.appointmentId, transportationStatus: transportationResult?.status || "NOT_FOUND" });
        if (appointment && reservation) {
          const companionRequested = APPOINTMENT_COMPANION.test(question);
          const text = `${appointmentTransportationAnswer(locale, appointment, reservation)}${companionRequested ? ` ${companionOfferAnswer(locale)}` : ""}`;
          return { text, quickAction: companionRequested ? "appointment-companion" : "appointment-view", appointmentId: appointment.id || "", trace };
        }
        return { text: pick(locale, { EN: "I do not see confirmed transportation on file for this appointment.", ES: "No veo transporte confirmado registrado para esta cita.", KR: "Mwen pa wè transpò konfime nan dosye a pou randevou sa a." }), quickAction: "appointment-view", appointmentId: appointment?.id || context.appointmentPrep.appointmentId, trace };
      } catch (error) {
        emit("EMMI_TOOL_FAILED", { tool: "getAppointmentTransportation", error: error?.message || "unknown" });
        return { text: pick(locale, { EN: "I can’t check the transportation details right now, so I don’t want to guess.", ES: "Ahora mismo no puedo consultar los detalles del transporte, así que prefiero no adivinarlos.", KR: "Mwen pa ka verifye detay transpò yo kounye a, kidonk mwen pa vle devine." }), trace };
      }
    }
    if (APPOINTMENT_COMPANION.test(question) && context.appointmentPrep?.appointmentId) {
      trace.intent = "APPOINTMENT_COMPANION";
      trace.responseMode = "APPOINTMENT_ENGINE";
      emit("EMMI_ANSWER_ROUTED", { appointmentId: context.appointmentPrep.appointmentId, companionRequested: true });
      return { text: companionOfferAnswer(locale), quickAction: "appointment-companion", appointmentId: context.appointmentPrep.appointmentId, trace };
    }
    const appointmentIntent = classifyAppointmentIntent(question, locale, { contextual: appointmentInContext });
    if (appointmentIntent?.intent === APPOINTMENT_INTENTS.APPOINTMENT_STATUS) {
      trace.intent = "APPOINTMENT_STATUS"; trace.responseMode = "RUNTIME_GROUNDED"; trace.toolCalls.push("getUpcomingAppointments");
      try {
        const upcoming = await this.executeTool("getUpcomingAppointments", { patientId: context.patientId });
        const appointments = upcoming?.appointments || [];
        trace.runtimeFactsUsed.push("getUpcomingAppointments");
        emit("EMMI_ANSWER_ROUTED", { appointmentAction: appointmentIntent.action, appointmentCount: appointments.length });
        if (!appointments.length) return { text: noAppointmentOnFile(locale), quickAction: "appointment-request", trace };
        return { text: appointmentStatusAnswer(locale, appointments), quickAction: "appointment-view", appointmentId: appointments[0].id || "", trace };
      } catch (error) {
        emit("EMMI_TOOL_FAILED", { tool: "getUpcomingAppointments", error: error?.message || "unknown" });
        return { text: appointmentLookupUnavailable(locale), trace };
      }
    }
    if (appointmentIntent?.intent === APPOINTMENT_INTENTS.APPOINTMENT_CHANGE) {
      const cancelling = appointmentIntent.action === APPOINTMENT_INTENT_ACTIONS.CANCEL;
      trace.intent = "APPOINTMENT_CHANGE"; trace.responseMode = "CONFIRMATION_REQUIRED"; trace.toolCalls.push("getUpcomingAppointments");
      let appointments = [];
      try {
        const upcoming = await this.executeTool("getUpcomingAppointments", { patientId: context.patientId });
        appointments = upcoming?.appointments || [];
        trace.runtimeFactsUsed.push("getUpcomingAppointments");
      } catch (error) {
        emit("EMMI_TOOL_FAILED", { tool: "getUpcomingAppointments", error: error?.message || "unknown" });
        return { text: appointmentLookupUnavailable(locale), trace };
      }
      emit("EMMI_ANSWER_ROUTED", { appointmentAction: appointmentIntent.action, appointmentCount: appointments.length, hasProviderHint: Boolean(appointmentIntent.providerHint) });
      if (!appointments.length) return { text: nothingToChangeAnswer(locale), quickAction: "appointment-request", trace };
      const intended = resolveIntendedAppointment(appointments, appointmentIntent.providerHint);
      // Which appointment the patient meant is a question, never a guess: acting on the wrong one is
      // the mistake this whole block exists to avoid.
      if (!intended) return { text: appointmentWhichOneAnswer(locale, appointments), quickAction: "appointment-view", trace };
      // §64: cancelling is destructive and is never done from chat text. The tool is not called
      // here at all — the patient confirms first, and the shell performs the confirmed action.
      if (cancelling) return { text: cancelConfirmationAnswer(locale, intended), pendingAction: "appointment-cancel", appointmentId: intended.id || "", trace };
      return { text: rescheduleAnswer(locale, intended), quickAction: "appointment-reschedule", appointmentId: intended.id || "", trace };
    }
    if (appointmentIntent?.intent === APPOINTMENT_INTENTS.APPOINTMENT_NEED) {
      trace.intent = "APPOINTMENT_NEED"; trace.responseMode = "APPOINTMENT_ENGINE"; trace.toolCalls.push("getUpcomingAppointments");
      // An appointment the patient already has is reported rather than duplicated (§134, §140). A
      // failed lookup must not block care, so it falls through to opening the request.
      let appointments = [];
      try {
        const upcoming = await this.executeTool("getUpcomingAppointments", { patientId: context.patientId });
        appointments = upcoming?.appointments || [];
        trace.runtimeFactsUsed.push("getUpcomingAppointments");
      } catch (error) { emit("EMMI_TOOL_FAILED", { tool: "getUpcomingAppointments", error: error?.message || "unknown" }); }
      const existing = resolveIntendedAppointment(appointments, appointmentIntent.providerHint);
      if (existing) {
        emit("EMMI_ANSWER_ROUTED", { appointmentAction: appointmentIntent.action, duplicateAvoided: true });
        return { text: existingAppointmentAnswer(locale, existing), quickAction: "appointment-view", appointmentId: existing.id || "", trace };
      }
      try {
        trace.toolCalls.push("startAppointmentRequest");
        const opened = await this.executeTool("startAppointmentRequest", { patientId: context.patientId, reasonCategory: appointmentReasonCategory(question), providerId: "", reasonSummary: clean(question).slice(0, 400) });
        emit("EMMI_ANSWER_ROUTED", { appointmentAction: appointmentIntent.action, timeHint: appointmentIntent.timeHint, hasProviderHint: Boolean(appointmentIntent.providerHint) });
        if (opened?.success) {
          const logistics = appointmentLogisticsSequenceAnswer(locale, {
            transportation: APPOINTMENT_TRANSPORTATION.test(question),
            companion: APPOINTMENT_COMPANION.test(question)
          });
          return { text: `${appointmentRequestOpenedAnswer(locale, appointmentIntent.timeHint)}${logistics}`, quickAction: "appointment-request", needId: opened.needId || "", trace };
        }
      } catch (error) { emit("EMMI_TOOL_FAILED", { tool: "startAppointmentRequest", error: error?.message || "unknown" }); }
      // Nothing was opened, so nothing is claimed and nothing is described as requested.
      return { text: appointmentRequestUnavailable(locale), trace };
    }
    const prepConversation = appointmentPrepConversationResponse({ question, locale, appointmentPrep: context.appointmentPrep });
    if (prepConversation) {
      trace.intent = "APPOINTMENT_PREPARATION";
      trace.responseMode = "DETERMINISTIC_APPOINTMENT_CONTEXT";
      emit("EMMI_ANSWER_ROUTED", { appointmentPrepStatus: prepConversation.update?.status || "IN_PROGRESS" });
      return { text: prepConversation.text, appointmentPrepUpdate: prepConversation.update, appointmentId: context.appointmentPrep?.appointmentId || "", trace };
    }
    // A patient describing something that is getting in their way is not asking a question. It is
    // told after the safety and medication checks above, so a symptom is never filed as a
    // difficulty, and it produces the same record the goal screen writes.
    if (DIFFICULTY.test(asked)) {
      const classified = classifyBarrierText(asked);
      if (classified.matched) {
        trace.intent = "GOAL_BARRIER"; trace.responseMode = "BARRIER_ENGINE"; trace.toolCalls.push("recordGoalBarrier");
        try {
          const recorded = await this.executeTool("recordGoalBarrier", { patientId: context.patientId, category: classified.category, patientDescription: clean(question) });
          emit("EMMI_ANSWER_ROUTED", { barrierCategory: classified.category });
          if (recorded?.success) return { text: barrierAcknowledgement(locale, classified.category, recorded.alreadyKnown), quickAction: "goal-barrier", barrierId: recorded.barrierId, barrierCategory: classified.category, trace };
        } catch (error) {
          emit("EMMI_TOOL_FAILED", { tool: "recordGoalBarrier", error: error?.message || "unknown" });
        }
        // Nothing was recorded, so nothing is claimed. The patient still gets a way forward.
        return { text: pick(locale, {
          EN: "Thank you for telling me. I couldn’t save that just now, but you can tell your care team, and I can help you reach them.",
          ES: "Gracias por contármelo. No pude guardarlo ahora, pero puede decírselo a su equipo de atención y puedo ayudarle a comunicarse con ellos.",
          KR: "Mèsi paske ou di m sa. Mwen pa t ka anrejistre l kounye a, men ou ka di ekip swen ou, epi mwen ka ede w jwenn yo."
        }), trace };
      }
    }

    // Cost and continuity with the patient's doctor are independent promises backed by different
    // runtime records. A natural compound question must read both instead of letting the first
    // matching intent silently discard the second half.
    if (COST.test(asked) && DOCTOR_STATUS.test(asked) && !TRANSPORT_SUBJECT.test(asked)) {
      trace.intent = "COST_AND_CARE_TEAM_QUESTION";
      trace.responseMode = "RUNTIME_GROUNDED";
      trace.toolCalls.push("getExpectedAccessCost", "getCareTeam");
      try {
        const [cost, careTeam] = await Promise.all([
          this.executeTool("getExpectedAccessCost", { patientId: context.patientId, accessTrack: context.accessTrack }),
          this.executeTool("getCareTeam", { patientId: context.patientId })
        ]);
        trace.runtimeFactsUsed.push("getExpectedAccessCost", "getCareTeam");
        emit("EMMI_ANSWER_ROUTED");
        return { text: `${runtimeAnswer({ tool: "getCareTeam", result: careTeam, locale, context, question: asked })} ${accessCostAnswer(cost, locale)}`, trace };
      } catch (error) {
        emit("EMMI_TOOL_FAILED", { tool: "getExpectedAccessCost|getCareTeam", error: error?.message || "unknown" });
        return { text: retrievalUnavailable(locale), trace };
      }
    }

    // --- Goals and the steps that serve them ----------------------------------------------------
    //
    // These run before the tool table below and before retrieval, because retrieval has no idea
    // what a goal is: "I want to swim three times a week" used to come back as a paragraph about
    // the ninety-day notice, and "change my walk to 30 minutes" as a paragraph about QMB. A patient
    // asking to change their care plan was being answered with whichever page happened to score.

    // Changing a step. Never the goal's name, whatever the patient called it.
    if (GOAL_STEP_CHANGE.test(asked)) {
      trace.intent = "GOAL_STEP_CHANGE"; trace.responseMode = "GOAL_ENGINE"; trace.toolCalls.push("startGoalStepEdit");
      try {
        // The patient's whole sentence is what identifies the step, never what replaces it: filling
        // the box with "Change my walk to 30 minutes. Yes, please do it." would put that in their
        // plan. They set the new wording on the screen, which is also where they can see the goal
        // above it is untouched.
        const opened = await this.executeTool("startGoalStepEdit", { patientId: context.patientId, phrase: clean(question) });
        emit("EMMI_ANSWER_ROUTED");
        if (opened?.success && opened.opened) {
          return { text: pick(locale, {
            EN: `That changes a step in your plan, not your goal — “${opened.goalTitle}” stays exactly as it is. I’ve opened “${opened.currentTitle}”: set the new wording there and save it.`,
            ES: `Eso cambia un paso de su plan, no su meta: «${opened.goalTitle}» queda exactamente igual. Abrí «${opened.currentTitle}»: escriba ahí el nuevo texto y guárdelo.`,
            KR: `Sa chanje yon etap nan plan ou, pa objektif ou — « ${opened.goalTitle} » rete menm jan. Mwen louvri « ${opened.currentTitle} »: ekri nouvo mo yo la epi sove l.`
          }), trace };
        }
        if (opened?.needsChoice) {
          return { text: pick(locale, {
            EN: (opened.steps || []).length
              ? `That would change a step in your plan, not your goal. Which one do you mean: ${(opened.steps || []).map(item => `“${item.title}”`).join(" or ")}?`
              : "There are no steps in your plan to change yet. You can add one from the goal itself, under My Goals.",
            ES: (opened.steps || []).length
              ? `Eso cambiaría un paso de su plan, no su meta. ¿Cuál de ellos: ${(opened.steps || []).map(item => `«${item.title}»`).join(" o ")}?`
              : "Todavía no hay pasos en su plan que cambiar. Puede agregar uno desde la meta misma, en Mis metas.",
            KR: (opened.steps || []).length
              ? `Sa ta chanje yon etap nan plan ou, pa objektif ou. Kilès ou vle di: ${(opened.steps || []).map(item => `« ${item.title} »`).join(" oswa ")}?`
              : "Poko gen etap nan plan ou pou chanje. Ou ka ajoute youn sou objektif la, nan Objektif mwen."
          }), trace };
        }
      } catch (error) {
        emit("EMMI_TOOL_FAILED", { tool: "startGoalStepEdit", error: error?.message || "unknown" });
      }
      return { text: pick(locale, {
        EN: "I couldn’t open that step just now, so nothing changed. You can change it on the goal itself, under My Goals.",
        ES: "No pude abrir ese paso ahora, así que no cambió nada. Puede cambiarlo en la meta misma, en Mis metas.",
        KR: "Mwen pa t ka louvri etap sa a kounye a, kidonk anyen pa chanje. Ou ka chanje l sou objektif la, nan Objektif mwen."
      }), trace };
    }

    // What the patient is doing about a goal: the plan, not the outcome.
    if (GOAL_PLAN_QUESTION.test(asked)) {
      trace.intent = "GOAL_PLAN"; trace.responseMode = "RUNTIME_GROUNDED"; trace.toolCalls.push("getPatientGoals");
      try {
        const result = await this.executeTool("getPatientGoals", { patientId: context.patientId });
        trace.runtimeFactsUsed.push("getPatientGoals"); emit("EMMI_ANSWER_ROUTED");
        return { text: goalPlanAnswer(result, locale), trace };
      } catch (error) {
        emit("EMMI_TOOL_FAILED", { tool: "getPatientGoals", error: error?.message || "unknown" });
        return { text: unavailable(locale), trace };
      }
    }

    // Setting one. The classifier decides goal-or-action; the screen shows the proposal; the
    // patient saves it. Chat never writes a goal on its own, and never says one was saved.
    if (GOAL_SETTING.test(asked)) {
      trace.intent = "GOAL_SETTING"; trace.responseMode = "GOAL_ENGINE"; trace.toolCalls.push("startPersonalGoal");
      try {
        const opened = await this.executeTool("startPersonalGoal", { patientId: context.patientId, statement: clean(question) });
        emit("EMMI_ANSWER_ROUTED", { statementKind: opened?.kind || "" });
        if (opened?.success) return { text: goalProposalAnswer(opened, locale), trace };
      } catch (error) {
        emit("EMMI_TOOL_FAILED", { tool: "startPersonalGoal", error: error?.message || "unknown" });
      }
      return { text: pick(locale, {
        EN: "I couldn’t open that just now, so nothing was saved. You can add a goal from My Goals whenever you like.",
        ES: "No pude abrirlo ahora, así que no se guardó nada. Puede agregar una meta desde Mis metas cuando quiera.",
        KR: "Mwen pa t ka louvri sa kounye a, kidonk anyen pa sove. Ou ka ajoute yon objektif nan Objektif mwen lè ou vle."
      }), trace };
    }

    // "Who pays for the Uber?" is a cost question, but not a question about the ACCESS cost. Sent to
    // the financial engine it came back "your expected payment for ACCESS is $0" — which a patient
    // asking about a ride reads as a promise that the ride is free. What transportation costs, and
    // who pays it, is not something this product knows; that belongs to the transportation route,
    // which says so plainly.
    // The same words carry three different answers depending on what they are asked about. The
    // programme's $0 is true of the programme only: said about a ride it reads as a promise the
    // ride is free, said about a prescription it reads as a promise the copay is nothing. The
    // monitor, the ride and the medication each have their own answer, so a cost question about
    // one of them is left to the route that knows it. The subject can come from an earlier turn:
    // "and does that cost anything?" is about whatever the patient was just asking about.
    const costSubject = resolveTurnSubject({ question: asked, conversation, carriedSubject, fromConversation: false })?.key || "";
    const asksAboutTransportCost = COST.test(asked) && (TRANSPORT_SUBJECT.test(asked) || costSubject === "TRANSPORT");
    let tool = "";
    if (COST.test(asked) && !asksAboutTransportCost && !["DEVICE", "MEDICATION"].includes(costSubject)) tool = "getExpectedAccessCost";
    else if (ELIGIBILITY.test(asked)) tool = "getEnrollmentContext";
    else if (MEDICATION_LIST.test(asked)) tool = "getMedicationList";
    else if (DEVICE_STATUS.test(asked)) tool = "getAssignedDevice";
    else if (HEALTH_TREND.test(asked) || (BLOOD_PRESSURE_SUBJECT.test(appointmentPrepTopic) && APPOINTMENT_PREP_TREND.test(asked))) tool = "getReadingTrend";
    else if (CLINICAL_TARGET.test(asked)) tool = "getClinicalTarget";
    else if (LATEST_HEALTH_READING.test(asked) || BLOOD_PRESSURE_SUBJECT.test(appointmentPrepTopic)) tool = "getLatestReading";
    else if (GOAL_PROGRESS.test(asked)) tool = "getGoalProgress";
    else if (GOAL_STATUS.test(asked)) tool = "getPatientGoals";
    else if (DOCTOR_STATUS.test(asked)) tool = "getCareTeam";
    else if (NEXT_STEP.test(asked)) tool = "getNextBestAction";
    if (tool) {
      trace.intent = ({ getExpectedAccessCost: "COST_QUESTION", getEnrollmentContext: "ELIGIBILITY_QUESTION", getMedicationList: "MEDICATION_QUESTION", getAssignedDevice: "DEVICE_QUESTION", getLatestReading: "LATEST_READING", getReadingTrend: "READING_TREND", getClinicalTarget: "CLINICAL_TARGET", getGoalProgress: "GOAL_PROGRESS", getPatientGoals: "GOAL_QUESTION", getCareTeam: "CARE_TEAM_QUESTION", getNextBestAction: "NEXT_STEP" })[tool];
      trace.toolCalls.push(tool);
      try {
        const args = tool === "getExpectedAccessCost" ? { patientId: context.patientId, accessTrack: context.accessTrack }
          : ["getLatestReading", "getReadingTrend", "getClinicalTarget"].includes(tool) ? { patientId: context.patientId, metricType: "BLOOD_PRESSURE", ...(tool === "getReadingTrend" ? { periodDays: 7 } : {}) }
            : tool === "getGoalProgress" ? { patientId: context.patientId, goalId: context.activeGoal?.id || "" }
              : ["getEnrollmentContext", "getMedicationList", "getAssignedDevice", "getPatientGoals", "getCareTeam", "getNextBestAction"].includes(tool) ? { patientId: context.patientId } : {};
        const result = await this.executeTool(tool, args);
        trace.responseMode = "RUNTIME_GROUNDED"; trace.runtimeFactsUsed.push(tool); emit("EMMI_ANSWER_ROUTED");
        let text = runtimeAnswer({ tool, result, locale, context, question: asked });
        // The patient has two blood-pressure numbers in this app and they are not the same thing:
        // their care team's threshold, and the ACCESS control target on their care plan. Answering
        // "what is my target?" with only the first left the plan's "below 130" unexplained and
        // looking like a contradiction. Both are read from the record; neither is computed here.
        if (tool === "getClinicalTarget" && result?.target) {
          try {
            const resolved = await this.executeTool("getAccessBaseline", { patientId: context.patientId, goalType: "BLOOD_PRESSURE_CONTROL" });
            const control = (resolved?.baselines || [])[0]?.measure?.control;
            if (control?.value) {
              trace.runtimeFactsUsed.push("getAccessBaseline");
              text = `${text} ${pick(locale, {
                EN: `Your ACCESS care plan also shows a control target of below ${control.value} mmHg systolic, which is the program's goal rather than your care team's threshold.`,
                ES: `Su plan de cuidado de ACCESS también muestra una meta de control de menos de ${control.value} mmHg sistólica, que es el objetivo del programa y no el umbral de su equipo de atención.`,
                KR: `Plan swen ACCESS ou an montre tou yon objektif kontwòl anba ${control.value} mmHg sistolik, ki se objektif pwogram nan olye pou sib ekip swen ou an.`
              })}`;
            }
          } catch { /* the care-team target still stands on its own */ }
          // Asking what the target IS gets the target. Asking to CHANGE it gets the target, the
          // program's control target above, and then the goal that is theirs to set. The classifier
          // tells the two questions apart, so "what is my blood pressure target?" is never answered
          // with an offer nobody asked for.
          const offer = clinicalGoalOffer(question, locale);
          if (offer) return { text: `${text} ${offer}`, trace };
        }
        if (context.appointmentPrep && ["getLatestReading", "getReadingTrend"].includes(tool) && appointmentPrepTopic) {
          const preparation = context.appointmentPrep.emmiPreparation || {};
          return {
            text: `${text} ${pick(locale, { EN: "For your appointment, you may also want to note whether the readings changed at a particular time or came with symptoms. What detail would you like your doctor to know?", ES: "Para su cita, también puede anotar si las lecturas cambiaron en algún momento o estuvieron acompañadas de síntomas. ¿Qué detalle quiere que su médico conozca?", KR: "Pou randevou ou, ou ka note tou si mezi yo te chanje nan yon moman oswa si te gen sentòm avèk yo. Ki detay ou vle doktè ou konnen?" })}`,
            appointmentPrepUpdate: { ...preparation, status: "IN_PROGRESS", currentTopic: appointmentPrepTopic, reviewedTopics: preparation.reviewedTopics || [], notesByTopic: preparation.notesByTopic || {}, updatedAt: new Date().toISOString() },
            appointmentId: context.appointmentPrep.appointmentId || "",
            trace
          };
        }
        return { text, trace };
      } catch (error) { emit("EMMI_TOOL_FAILED", { tool, error: error?.message || "unknown" }); return { text: retrievalUnavailable(locale), trace }; }
    }

    let retrieval;
    try {
      retrieval = await this.executeTool("searchKnowledge", { query: retrievalQuery });
      trace.intent = retrieval.intent || "UNKNOWN";
      trace.knowledgeChunkIds = (retrieval.passages || []).map(item => `${item.sourceId}#${item.heading}`);
    } catch (error) {
      emit("EMMI_RETRIEVAL_FAILED", { error: error?.message || "unknown" });
      return { text: retrievalUnavailable(locale), trace };
    }
    if (!(retrieval.passages || []).length) {
      emit("EMMI_EMPTY_GROUNDED_CONTEXT");
      return { text: unavailable(locale), trace };
    }
    if (PROGRAM_DEFINITION.test(retrievalQuery)) {
      trace.responseMode = "DETERMINISTIC_GROUNDED_FALLBACK";
      trace.modelVersion = "deterministic-grounded-v1";
      const programName = retrievalQuery.match(PROGRAM_DEFINITION)?.[2]?.toUpperCase();
      // The named programme is explicit in the patient's own words. Do not let a mis-ranked
      // focused passage (for example the emergency page) outrank that direct subject.
      const text = programAnswers[programName] ? pick(locale, programAnswers[programName])
        : fallbackKnowledgeAnswer({ question: retrievalQuery, retrieval, locale, program: context.program });
      emit("EMMI_ANSWER_ROUTED");
      return { text, trace };
    }
    try {
      const response = await this.fetch("/api/emmi/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The view goes to the knowledge fallback for the same reason it goes to the voice session: a
        // question asked in front of three ride options is not a general question about transport.
        body: JSON.stringify({ question, retrievalQuery, locale, program: context.program || null, currentScreen: context.currentScreen || null, view: context.view || null, conversationSummary: conversation.conversationSummary || "", appointmentPrep: context.appointmentPrep || null })
      });
      if (response.ok) {
        const generated = await response.json();
        if (clean(generated.text)) {
          Object.assign(trace, { intent: generated.intent || trace.intent, knowledgeChunkIds: generated.knowledgeChunkIds || trace.knowledgeChunkIds, responseMode: generated.responseMode || "KNOWLEDGE_GROUNDED", modelVersion: generated.modelVersion || "" });
          emit("EMMI_ANSWER_ROUTED");
          return { text: clean(generated.text), trace };
        }
      }
      emit("EMMI_RESPONSE_GENERATION_FAILED", { status: response.status });
    } catch (error) { emit("EMMI_RESPONSE_GENERATION_FAILED", { error: error?.message || "unknown" }); }
    trace.responseMode = "DETERMINISTIC_GROUNDED_FALLBACK";
    trace.modelVersion = "deterministic-grounded-v1";
    const text = fallbackKnowledgeAnswer({ question: retrievalQuery, retrieval, locale, program: context.program });
    emit("EMMI_ANSWER_ROUTED");
    return { text, trace };
  }
}
