import { classifyBarrierText } from "../goalBarriers.js";
import { APPOINTMENT_INTENTS, APPOINTMENT_INTENT_ACTIONS, classifyAppointmentIntent } from "./appointmentIntents.js";
import { createSafetyEpisode, detectEmergencyLanguage, detectSafetyResolution, safetyEpisodeIsActive, safetyResolutionCopy, safetyResponseFor } from "./safetyPolicy.js";
import { conversationPolicyResponse } from "./conversationPolicy.js";
import { emmiGuardrailAnswer } from "./guardrails.js";
import { CARE_TEAM_CONTACT_INTENT, careTeamContactPrompt, detectCareTeamContact } from "./careTeamContact.js";
import { resolveRequestedProfessional } from "../careTeamDirectory.js";
const pick = (locale, values) => values[String(locale || "EN").toUpperCase()] || values.EN;
const clean = value => String(value || "").replace(/\s+/g, " ").trim();
const lower = value => clean(value).toLowerCase();

// "Why do you need this?" is a question about the screen the patient is looking at, answered by
// that screen's own explanation. It is deliberately narrow in two directions: asking why the
// invitation *arrived* is INVITATION_SOURCE below, and asking why something on a record is held
// — "why do you need my medications" — is a question about that content, not about the screen.
// So the object has to be the screen itself or the verification it is asking for.
const SCREEN_HELP = /why (do|does) (you|we|itera|medicare) need (this|that|it|to verify|my (zip|postal|date of birth|birth ?date|identity|information|info))|why are you asking (me )?(for )?(this|that|my (zip|postal|date of birth|birth ?date))|why do i (have to|need to) (give|provide|share|enter) (this|that|my (zip|postal|date of birth|birth ?date))|por qu[eé] (necesitan|necesita|piden|pide) (esto|eso|verificar|mi (c[oó]digo postal|fecha de nacimiento|identidad|informaci[oó]n))|para qu[eé] (necesitan|necesita) (esto|eso|mi (c[oó]digo postal|fecha de nacimiento))|poukisa (ou|nou) bezwen (sa|k[oò]d postal|dat nesans|verifye)|poukisa w ap mande (sa|k[oò]d postal|dat nesans)|what (do i|should i) do|what is this screen|which (one|option) should i (choose|pick)|explain (this|the screen)|help (me )?with this|(don'?t|do not) understand|qué (debo|tengo que) hacer|qué significa esta pantalla|cuál debo escoger|qué opción debo elegir|explique (esto|esta pantalla)|no entiendo|kisa pou m fè|ki opsyon pou m chwazi|eksplike ekran|mwen pa konprann/i;
// Phones and speech transcription produce a typographic apostrophe. Every gate below is written
// with a straight one, so "I can’t breathe" used to fall past the safety gate entirely. The
// patterns are matched against a folded copy of the question; the patient's own text is
// untouched and is what still reaches the tools.
// The words that make an appointment the subject of a conversation, in all three languages.
const APPOINTMENT_MENTION = /\bappointment|\bvisit\b|\bcita\b|\bconsulta\b|\bvisita\b|randevou|vizit/i;
const foldApostrophes = value => String(value || "").replace(/[‘’ʼ]/g, "'");
const SAFETY = { test: detectEmergencyLanguage };
const BP_READING = /(\d{2,3})\s*(?:over|\/|sobre)\s*(\d{2,3})/i;
// Anchored on word boundaries. Without them "pri" matched inside "Lisinopril", "priority" and
// "private", so asking what a medication is came back as an answer about the ACCESS cost.
// A question that quotes an amount is a question about money in any language, and "why does it say
// $0" is the most likely thing a patient asks on the consent screen.
const COST = /\$\s?\d|\b(how much|cost|costs|pay|pays|paying|owe|charge|copay|coinsurance|deductible|price|cu[a\u00e1]nto|costo|costos|pagar|pago|precio|copago|coseguro|deducible|konbyen|pri|peye|koute)\b/
const ELIGIBILITY = /am i eligible|do i qualify|my eligibility|am i enrolled|did i enroll|have i enrolled|am i signed up|soy elegible|califico|mi elegibilidad|estoy inscrito|ya me inscrib|mwen kalifye|kalifikasyon mwen|mwen enskri|èske m enskri/i;
const MEDICATION_LIST = /what (medications|medicines|pills).*(have|file|registered)|medications.*(have|file)|qu[eé] medicamentos.*(tienen|registr)|medicamentos registrados|ki medikaman.*dosye|medikaman.*genyen/i;
const DEVICE_STATUS = /what (monitor|device) do i have|which (monitor|device)|is my (monitor|device).*(connected|assigned)|(?:when|has|did|will).*(monitor|device).*(ship|sent|arrive|deliver)|(?:monitor|device).*(ship|sent|arrive|deliver)|qu[eé] (monitor|aparato).*(tengo|asign)|(?:est[aá].*(monitor|aparato).*(conect)|conectad[oa]?.*(monitor|aparato))|(?:cu[aá]ndo|ya|van a|me van a).*(enviar|env[ií]o|llegar|recibir|entregar).*(monitor|aparato)|(enviar|env[ií]o|llegar|recibir|entregar).*(monitor|aparato)|ki apar[eè]y.*genyen|(?:apar[eè]y.*konekte|konekte.*apar[eè]y)|(?:kil[eè]|deja).*(voye|rive|resevwa).*(apar[eè]y|monit[eè])/i;
const DEVICE_FULFILLMENT = /ship|sent|arrive|deliver|env[ií]o|enviar|llegar|recibir|entregar|voye|rive|resevwa/i;
const GOAL_STATUS = /what is my goal|what are my goals|my current goal|cu[aá]l es mi meta|mis metas|ki objektif mwen/i;
const LATEST_HEALTH_READING = /latest (blood pressure )?reading|my (blood pressure|bp).*(reading|today)|what does my.*reading|lectura (m[aá]s reciente|de hoy)|mi presi[oó]n.*(lectura|hoy)|d[eè]nye lekti|tansyon mwen.*jodi/i;
const HEALTH_TREND = /how has my (blood pressure|bp)|pressure.*this week|reading trend|blood pressure trend|c[oó]mo ha estado mi presi[oó]n|tendencia.*presi[oó]n|kijan tansyon mwen|tandans.*tansyon/i;
const CLINICAL_TARGET = /my (blood pressure )?target|expected range|rango esperado|objetivo.*presi[oó]n|sib tansyon|limit.*tansyon/i;
const GOAL_PROGRESS = /goal progress|how am i doing.*goal|progreso.*meta|c[oó]mo voy.*meta|pwogr[eè].*objektif/i;
// Asking whether the doctor stays involved is the same question as asking who the doctor is: both
// are answered from the care team, and both deserve the reassurance that ITERA adds to that doctor
// rather than replacing them. Naming the physician in the question is the most natural way to ask it.
const DOCTOR_STATUS = /is my doctor|who is my doctor|keep (seeing )?my doctor|doctor stays|still (be |stay )?involved|stay involved|remain involved|still my doctor|still see (?:my doctor|dr\.?\s+[a-z'-]+)|mi m[eé]dico|seguir viendo a mi m[eé]dico|seguir viendo (?:al|a la)?\s*(?:dr\.?|doctor|doctora)|qui[eé]n es mi m[eé]dico|sigue (involucrado|participando)|seguir[aá] (involucrado|participando)|dokt[eè] mwen|toujou (patisipe|enplike)/i;
// The invitation itself: who sent it and why it arrived. Distinct from "who is my doctor",
// which asks whether that doctor stays involved, and from eligibility, which asks whether the
// patient qualifies. Answering it means repeating the referral facts and adding nothing.
const INVITATION_SOURCE = /who (invited|referred|sent)|who is this from|why (am i|did i) (receiving|receive|get|getting)|why was i (invited|referred)|how did you get my|qui[eé]n me (invit[oó]|refiri[oó]|envi[oó])|de qui[eé]n es esta invitaci[oó]n|por qu[eé] (recib[ií]|estoy recibiendo|me lleg[oó])|ki moun ki (envite|refere|voye) m|poukisa m (ap resevwa|resevwa|jwenn)/i;
const NEXT_STEP = /what happens next|what is next|next step|qu[eé] sigue|pr[oó]ximo paso|kisa k ap pase apre|pwochen etap/i;
const REPEAT_FOLLOW_UP = /^(can you |could you |please )?(repeat|say that again|repeat that)|^(repita|puede repetir|d[ií]galo otra vez)|^(repete|di sa ank[oò])/i;
const SIMPLIFY_FOLLOW_UP = /explain (that|it) (more )?simply|simpler|i (did not|didn'?t|don'?t) understand (that|it)|no entend[ií] (eso|esto)|expl[ií]quelo m[aá]s (f[aá]cil|sencillo)|mwen pa konprann|esplike sa pi senp/i;
const HUMAN_SUPPORT = /call me|someone call|talk (to|with) someone|human|hablar con alguien|que me llamen|ll[aá]meme|pale ak yon moun|rele m/i;
// A patient asking whether to stop a medicine names the medicine. The old pattern required the
// generic word, so "should I stop my lisinopril?" — the exact phrasing the QA spec lists — walked
// past it into the model. Drug-name suffixes catch the whole class without needing a formulary,
// and an accidental extra dose is a safety event even though no verb of change appears in it.
const DRUG_SUFFIX = "[a-z]{4,}(?:pril|statin|olol|sartan|azide|ipine|formin|prazole|oxacin|cycline)";
const MEDICATION_SAFETY = new RegExp(
  "(stop|quit|skip|double|increase|decrease|change|split|halve)[^?.]{0,40}(medication|medicine|pill|dose|tablet|" + DRUG_SUFFIX + ")"
  + "|(took|take|taken)[^?.]{0,20}(two|three|2|3|double|an extra|extra)[^?.]{0,10}(dose|pill|tablet)"
  + "|dejar de tomar|suspender[^?.]{0,30}medic|cambiar la dosis|tom[eé][^?.]{0,15}dos dosis"
  + "|sispann pran|chanje d[oò]z",
  "i"
);
// The two halves can arrive in either order, and both must be present: a patient asking whether to
// measure again is asking about the baseline counters, not about their last reading.
const asksAboutMeasuringAgain = text => (/\bpressure\b/i.test(text) && /\bagain\b|\bnow\b/i.test(text))
  || (/presi[oó]n/i.test(text) && /otra vez|ahora/i.test(text))
  || (/tansyon/i.test(text) && /ank[oò]|kounye a/i.test(text));
const LEAVE_PROGRAM = /can i (leave|stop|end|quit)|leave the program|stop participating|puedo (dejar|salir|terminar)|dejar el programa|salir del programa|mwen ka (kite|sispann)|kite pwogram/i;
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

export const expandEmmiQuery = ({ question, conversation = {}, program = "" } = {}) => {
  const raw = clean(question);
  const context = `${conversation.conversationSummary || ""} ${(conversation.recentTurns || []).map(turn => turn.text).join(" ")}`;
  const mentioned = ["ACCESS", "CCM", "RPM", "PCM", "APCM", "ASM"].filter(item => new RegExp(`\\b${item}\\b`, "i").test(context));
  if (/(difference|different|compare|diferencia|diferente|comparar|diferans)/i.test(raw) && mentioned.length >= 2) return `${raw} ${mentioned.slice(-2).join(" ")}`;
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
  if (prose.length <= 460) return prose;
  let cut = "";
  for (const sentence of prose.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || []) {
    if ((cut + sentence).length > 460 && cut) break;
    cut += sentence;
  }
  return cut.trim() || prose.slice(0, 460);
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
  if (LEAVE_PROGRAM.test(question)) return leaveProgramAnswer(locale);
  // A page written for this question beats a canned description of the programme it belongs to.
  // Without this, any question whose retrieval touched a file with a programme name in its path —
  // which is every ACCESS page — returned the general ACCESS blurb and discarded everything that
  // had just been retrieved. That is the "generic ACCESS fallback ignores focused knowledge"
  // defect, and it is why eCKM, the outcome targets and A1c all came back as the same paragraph.
  //
  // English only, and deliberately. The corpus is written in English; the canned answers are
  // trilingual. When the model is reachable it translates the passage, and this path is only for
  // when it is not, so a Spanish or Creole patient keeps the answer in their own language rather
  // than being handed English prose.
  const focused = sources[0] && !GENERIC_PROGRAM_PAGE.test(sources[0].sourcePath || "") ? sources[0] : null;
  if (focused && String(locale).toUpperCase() === "EN") {
    const answer = passageAnswer(focused);
    if (answer) return answer;
  }
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
  if (tool === "getPatientGoals") {
    const goals = result.goals || [];
    return goals.length ? pick(locale, { EN: `Your current goal${goals.length > 1 ? "s are" : " is"}: ${goals.map(item => item.title).join("; ")}. You can change personal goals later.`, ES: `Su${goals.length > 1 ? "s metas actuales son" : " meta actual es"}: ${goals.map(item => item.title).join("; ")}. Puede cambiar sus metas personales después.`, KR: `Objektif ou${goals.length > 1 ? " yo se" : " se"}: ${goals.map(item => item.title).join("; ")}. Ou ka chanje objektif pèsonèl yo pita.` }) : pick(locale, { EN: "You have not saved a personal goal yet.", ES: "Todavía no ha guardado una meta personal.", KR: "Ou poko sove yon objektif pèsonèl." });
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
  if (tool === "getCareTeam") return result.physicianDisplayName ? pick(locale, { EN: `${result.physicianDisplayName} remains part of your care. ITERA provides additional support and does not replace your doctor.`, ES: `${result.physicianDisplayName} continúa siendo parte de su cuidado. ITERA brinda apoyo adicional y no reemplaza a su médico.`, KR: `${result.physicianDisplayName} rete yon pati nan swen ou. ITERA bay sipò anplis epi li pa ranplase doktè ou.` }) : pick(locale, { EN: "Your regular doctors remain part of your care. ITERA provides additional support and does not replace them.", ES: "Sus médicos habituales continúan formando parte de su cuidado. ITERA brinda apoyo adicional y no los reemplaza.", KR: "Doktè ou deja genyen yo rete nan swen ou. ITERA bay sipò anplis epi li pa ranplase yo." });
  if (tool === "getNextBestAction") return pick(locale, { EN: `Your next step is “${result.label}.”`, ES: `Su próximo paso es “${result.label}”.`, KR: `Pwochen etap ou se “${result.label}”.` });
  return unavailable(locale);
};

export class EmmiTextOrchestrator {
  constructor({ getContext, getConversation, executeTool, screenExplanation, fetchImpl = globalThis.fetch, onEvent = () => {}, onSafetyEpisode = () => {}, onSafetyResolved = () => {} }) {
    this.getContext = getContext;
    this.getConversation = getConversation;
    this.executeTool = executeTool;
    this.screenExplanation = screenExplanation;
    this.fetch = fetchImpl;
    this.onEvent = onEvent;
    this.onSafetyEpisode = onSafetyEpisode;
    this.onSafetyResolved = onSafetyResolved;
  }

  async answer(question, { questionId = "" } = {}) {
    const context = this.getContext();
    const locale = context.locale || "EN";
    const conversation = this.getConversation?.() || {};
    const retrievalQuery = expandEmmiQuery({ question, conversation, program: context.program });
    const trace = { turnId: `emmi_turn_${Date.now().toString(36)}`, conversationSessionId: conversation.conversationSessionId || "", screenId: context.currentScreen, retrievalQuery, intent: "UNKNOWN", knowledgeChunkIds: [], toolCalls: [], runtimeFactsUsed: [], responseMode: "UNKNOWN" };
    const emit = (type, details = {}) => this.onEvent(type, { ...trace, ...details });

    const asked = foldApostrophes(question);
    const openEpisode = safetyEpisodeIsActive(conversation.activeSafetyEpisode) ? conversation.activeSafetyEpisode : null;
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
    if (MEDICATION_SAFETY.test(asked)) {
      trace.intent = "MEDICATION_SAFETY"; trace.responseMode = "DETERMINISTIC_SAFETY"; emit("EMMI_ANSWER_ROUTED");
      return { ...safetyResponseFor({ locale, medication: true }), trace };
    }
    // What EMMI cannot do about authority, prescriptions and the clinical record is answered from
    // approved copy, ahead of retrieval and generation, so a limit is never paraphrased into a
    // softer one. Clinical safety still runs first: a limit is not an answer to chest pain.
    const guardrail = emmiGuardrailAnswer({ question: asked, questionId, locale, context });
    if (guardrail) {
      trace.intent = guardrail.intent; trace.responseMode = "DETERMINISTIC_GUARDRAIL"; emit("EMMI_ANSWER_ROUTED");
      return { text: guardrail.text, ...(guardrail.quickAction ? { quickAction: guardrail.quickAction } : {}), trace };
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
      return { text: this.screenExplanation(context.currentScreen), trace };
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
      return { text: pick(locale, { EN: "Would you like me to ask the ITERA care team to call you?", ES: "¿Desea que solicite al equipo de atención de ITERA que le llame?", KR: "Èske ou vle m mande ekip swen ITERA a rele ou?" }), pendingAction: "callback", trace };
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
    // Appointments sit between the refill engine and the difficulty gate. A patient who says they
    // need to see their doctor is asking for a visit, not describing a barrier, so this runs before
    // the classifier that would file it as one; a patient describing a symptom never reaches this
    // block at all, because clinical safety above already took the turn (§3, §4, §5, §139).
    // §41: a pronoun only refers to an appointment when one is genuinely the subject of this
    // conversation. Recent turns decide that; a bare "cancel it" out of nowhere still means nothing.
    const appointmentInContext = APPOINTMENT_MENTION.test(String(conversation.conversationSummary || ""))
      || (conversation.recentTurns || []).some(turn => APPOINTMENT_MENTION.test(String(turn?.text || "")));
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
        if (opened?.success) return { text: appointmentRequestOpenedAnswer(locale, appointmentIntent.timeHint), quickAction: "appointment-request", needId: opened.needId || "", trace };
      } catch (error) { emit("EMMI_TOOL_FAILED", { tool: "startAppointmentRequest", error: error?.message || "unknown" }); }
      // Nothing was opened, so nothing is claimed and nothing is described as requested.
      return { text: appointmentRequestUnavailable(locale), trace };
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

    let tool = "";
    if (COST.test(asked)) tool = "getExpectedAccessCost";
    else if (ELIGIBILITY.test(asked)) tool = "getEnrollmentContext";
    else if (MEDICATION_LIST.test(asked)) tool = "getMedicationList";
    else if (DEVICE_STATUS.test(asked)) tool = "getAssignedDevice";
    else if (LATEST_HEALTH_READING.test(asked)) tool = "getLatestReading";
    else if (HEALTH_TREND.test(asked)) tool = "getReadingTrend";
    else if (CLINICAL_TARGET.test(asked)) tool = "getClinicalTarget";
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
        return { text: runtimeAnswer({ tool, result, locale, context, question: asked }), trace };
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
    try {
      const response = await this.fetch("/api/emmi/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, retrievalQuery, locale, program: context.program || null, currentScreen: context.currentScreen || null, conversationSummary: conversation.conversationSummary || "" })
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
