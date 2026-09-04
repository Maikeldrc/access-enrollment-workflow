const fold = value => String(value || "").replace(/[‘’ʼ]/g, "'").replace(/\s+/g, " ").trim();
// Patients commonly clarify that a reported issue is *not* an emergency. Remove only that
// negated label before applying the symptom rules; real symptoms elsewhere in the same sentence
// (for example, "not an emergency, but I have chest pain") still trigger the safety route.
const NEGATED_EMERGENCY = /\b(?:this|it)\s+(?:is\s+not|'s\s+not|isn't)\s+(?:an?\s+)?(?:medical\s+)?emergency\b|\bnot\s+(?:having|experiencing|in)\s+(?:an?\s+)?(?:medical\s+)?emergency\b|\bno\s+(?:medical\s+)?emergency\b|\bno\s+es\s+una\s+emergencia\b|\bno\s+(?:tengo|estoy teniendo)\s+una\s+emergencia\b|\bse\s+pa\s+yon\s+ijans\b|\bmwen\s+pa\s+gen\s+yon\s+ijans\b/gi;

export const emergencyLanguageForEvaluation = value => fold(value).replace(NEGATED_EMERGENCY, " ").replace(/\s+/g, " ").trim();
// The gate that decides whether a turn is a health turn at all. It is deliberately wider than the
// severity engine it feeds: matching here only means the escalation engine is asked and the care
// team is offered, so a false match costs a careful sentence, while a miss costs the whole route.
//
// The word "stroke" was here, but none of the ways a person actually describes one were: a patient
// typing "I have weakness on one side of my body" or "I cannot speak properly" — two thirds of the
// FAST test — reached no safety route at all and was answered from the knowledge base.
const STROKE_SIGNS = /weak(?:ness)?\s+(?:on|in|down)\s+(?:one|the left|the right|my left|my right|left|right)\s+side|numb(?:ness)?\s+(?:on|in)\s+(?:one|the left|the right|my left|my right|left|right)\s+side|(?:one|left|right) side of (?:my |the )?(?:body|face)|(?:face|mouth)\s+(?:is\s+)?droop|facial droop|slurred|slurring|trouble (?:speaking|talking|getting my words)|difficulty speaking|can(?:'?t| ?not) speak (?:properly|clearly|right)|words (?:are )?not coming|(?:one|left|right) side[^.?!]{0,25}\b(?:weak|numb|paralys|droop|gone dead)|worst headache|sudden(?:ly)? (?:severe )?(?:weakness|numbness|headache)|debilidad (?:en|de) un lado|entumecimiento (?:en|de) un lado|un lado (?:del|de mi) cuerpo|se me (?:cae|torci[oó]) la cara|no puedo hablar|habla arrastrada|se me traba la lengua|peor dolor de cabeza|febl[eè]s yon b[oò]|yon b[oò] k[oò]|figi (?:l|mwen) tonbe|pa ka pale|lang mwen mare/i;
const ACUTE_SIGNS = /seizure|convulsion|unconscious|unresponsive|won'?t wake up|not waking up|crushing (?:chest )?pain|pressure in my chest|tight(?:ness)? in my chest|short(?:ness)? of breath|can'?t catch my breath|convulsi[oó]n|no responde|no despierta|presi[oó]n en el pecho|opresi[oó]n en el pecho|falta de aire|me falta el aire|kriz|pa reveye|presyon nan pwatrin|souf kout/i;
// A patient telling us their blood pressure is high, without giving a number. It is not an
// emergency by itself — the escalation engine still decides that — but it is unmistakably a health
// turn, and "my bp high what i do" was being handled as neither: not safety, not a reading, just
// text for the knowledge base to answer with programme education.
const REPORTED_HIGH_BP = /\b(bp|blood pressure)\b[^?.]{0,25}\b(high|elevated|too high|way up|through the roof)\b|\b(high|elevated)\b[^?.]{0,15}\b(bp|blood pressure)\b|presi[oó]n[^?.]{0,25}(alta|elevada|muy alta|por las nubes)|tansyon[^?.]{0,25}(wo|monte|twò wo)/i;
// A patient telling us how they feel. None of these is an emergency on its own — the escalation
// engine returns CONTINUE for them and the answer becomes "how you are feeling comes first, shall I
// tell your care team?" — but every one of them is a health turn. Without this they matched nothing
// anywhere: "I have a headache", "I feel weak" and "I do not feel well" reached the knowledge base,
// which had nothing to say, so a patient reporting a symptom was told the information was not
// available. Reporting a symptom must always reach a person, never a dead end.
const SYMPTOM_REPORT = /\b(headache|migraine|nause(?:a|ous)|vomit|throwing up|feel (?:weak|sick|unwell|awful|terrible|off|bad|worse)|feeling (?:weak|sick|unwell|awful|terrible|off|bad|worse)|(?:do ?n'?t|not) feel(?:ing)? (?:well|good|right)|no energy|swelling|swollen|blurry vision|blurred vision|palpitations|heart racing|racing heart)\b|\b(?:bp|blood pressure)\b[^?.]{0,25}\b(?:low|too low|dropped|very low)\b|dolor de cabeza|jaqueca|n[aá]useas|v[oó]mito|me siento (?:mal|d[eé]bil|peor)|no me siento bien|sin energ[ií]a|hinchaz[oó]n|visi[oó]n borrosa|palpitaciones|presi[oó]n[^?.]{0,25}(?:baja|muy baja)|t[eè]t fè mal|kè plen|mwen santi m (?:mal|feb)|mwen pa santi m byen|tansyon[^?.]{0,25}ba/i;
// Patients report pain with a verb far more often than with the noun the gate was built on: every
// pattern here recognised "chest pain" and none recognised "my chest hurts", and in Spanish the
// gate held "dolor de pecho" while the ordinary way to say it — "me duele el pecho" — fell through
// to a knowledge lookup.
//
// First person only, and the patient's own body part. "My chest hurts" is a report; "does the cuff
// hurt my arm?" is a question about the device, and routing that to the clinical engine would take
// a device question away from the patient rather than answer it.
const PAIN_REPORT = /\bmy (?:chest|heart|arm|arms|jaw|head|stomach|belly|abdomen|back|leg|legs|neck)\b[^?.!]{0,15}\b(?:hurts?|hurting|aches?|aching|killing me)\b|\bpain in my\b|\bi have (?:a lot of |bad |severe |terrible )?pain\b|\bi(?:'|’)?m in (?:a lot of |bad |severe )?pain\b|\bme duele\b|\bme duelen\b|\btengo (?:un )?(?:fuerte |mucho )?dolor\b|\bsiento (?:un )?dolor\b|\b(?:pwatrin|k[oè]|bra|t[eè]t|vant|do|janm|kou) (?:mwen |m )?f[eè] (?:m |mwen )?mal\b|\bmwen gen doul[eè]\b/i;

const EMERGENCY = new RegExp([
  /chest pain|dizzy|dizziness|light[- ]?headed|mareo|mareado|mareada|t[eéè]t vire|vertij|can'?t breathe|cannot breathe|difficulty breathing|stroke|severe bleeding|pass(?:ed)? out|faint(?:ed|ing)?|suicid|emergency|dolor (fuerte )?(?:(?:en el|de) )?pecho|no puedo respirar|derrame|sangrado grave|me desmay|emergencia|doulè nan pwatrin|pa ka respire|konjesyon serebral|senyen anpil|endispoze|pèdi konesans|ijans|swisid/.source,
  STROKE_SIGNS.source,
  ACUTE_SIGNS.source,
  REPORTED_HIGH_BP.source,
  SYMPTOM_REPORT.source,
  PAIN_REPORT.source
].join("|"), "i");
const FOLLOW_UP = /^(and |but |so )?(why|what (now|next|should i do)|what is my next step|is that serious|can you help|por qu[eé]|qu[eé] (hago|sigue)|y ahora|kisa pou m fè|poukisa|e apre)/i;

// An episode ends when the patient says help was reached, or that the symptoms have passed. Until
// this existed, nothing anywhere called resolveSafetyEpisode: every turn after an escalation came
// back as the emergency copy, through reloads, for the rest of the patient's life with the app.
//
// These are tested BEFORE the emergency gate on purpose. The words a patient uses to say help
// arrived — "I called 911", "the emergency team is with me now" — contain the same words that raise
// an emergency, so the gate read each attempt to resolve as a fresh emergency and re-armed the
// episode. That is why the QA transcript could never get out.
// "help is here" needs its verb. Without it, "can you help me here?" would read as a resolution.
const HELP_CONFIRMED = /\bhelp\s+(is|has|'s)\s+(here|arrived|come|on the way)\b|\b(called|calling|phoned|rang)\b[^.?!]{0,20}\b(9-?1-?1|ambulance|emergency|paramedics?)\b|\b(9-?1-?1|ambulance|paramedics?|emts?|medics?|emergency (team|crew|services|help|responders?))\b[^.?!]{0,20}\b(is|are|'s|was|were|has|have)?\s*(here|with me|arrived|coming|on (the|their) way|been called)\b|\b(i'?m|i am|we'?re|we are)\b[^.?!]{0,15}\b(at|in|with)\b[^.?!]{0,15}\b(hospital|er|emergency room|urgent care|doctor|nurse|paramedic)\b|\b(went|got|taken|going)\b[^.?!]{0,15}\bto\b[^.?!]{0,10}\b(hospital|er|emergency room)\b|llam[eé]\b[^.?!]{0,20}\b(9-?1-?1|ambulancia|emergencias)|ya llam[eé]|\b(la ayuda|los param[eé]dicos|la ambulancia|el 9-?1-?1)\b[^.?!]{0,20}\b(ya |est[aá]n?|lleg[oó]|viene|vienen|en camino|aqu[ií]|conmigo)|estoy (en (el |la )?(hospital|emergencias|urgencias)|con (el|un|la|una) (m[eé]dico|doctor|enfermer|param[eé]dico))|fui a (emergencias|urgencias|el hospital)|mwen (te )?rele\b[^.?!]{0,20}\b(9-?1-?1|anbilans)|\b(sekou|anbilans|paramedik)\b[^.?!]{0,20}\b(la|rive|ap vini|avè m)|mwen nan lopital|mwen ak yon dokt[eè]/i;

// The patient saying the symptoms have gone. Treated as a resolution because the alternative — an
// app that will answer nothing else, ever — is not the safer option, and the acknowledgement below
// restates the emergency instruction rather than dropping it.
const RECOVERED = /\b(i'?m|i am|it'?s|im)\b[^.?!]{0,15}\b(ok|okay|fine|better|safe|alright|all right)\b|\b(feel|feeling)\b[^.?!]{0,15}\b(better|fine|ok|okay|normal)\b|\b(pain|symptoms?|it|dizziness)\b[^.?!]{0,15}\b(stopped|passed|gone|went away|resolved|over)\b|ya (estoy|me siento|me encuentro) (bien|mejor)|estoy bien ahora|ya se me pas[oó]|\b(el dolor|los s[ií]ntomas|el mareo)\b[^.?!]{0,15}\b(pas[oó]|par[oó]|se fue|se quit[oó]|ya no)|mwen santi m (pi byen|byen)|mwen byen kounye a|\b(doul[eè] a|sentòm yo)\b[^.?!]{0,15}\b(pase|rete|ale)/i;

// An episode is about the here and now. A patient who comes back the next day must not be met with
// "call 911" for something that is over; four hours is long enough to cover a real episode and the
// wait that follows it, and short enough that a later visit starts clean.
export const SAFETY_EPISODE_MAX_AGE_MS = 4 * 60 * 60 * 1000;

const COPY = {
  EMERGENCY: { EN: "This may require urgent medical attention. Please call 911 or seek emergency care now.", ES: "Esto puede requerir atención médica urgente. Llame al 911 o busque atención de emergencia ahora.", KR: "Sa ka mande swen medikal ijan. Tanpri rele 911 oswa chèche swen ijans kounye a." },
  FOLLOW_UP: { EN: "Your urgent symptoms still come first. Please call 911 or seek emergency care now. Do not continue this app instead of getting emergency help.", ES: "Sus síntomas urgentes siguen siendo lo primero. Llame al 911 o busque atención de emergencia ahora.", KR: "Sentòm ijan ou yo toujou vini an premye. Tanpri rele 911 oswa chèche swen ijans kounye a." },
  MEDICATION: { EN: "I can’t recommend starting, stopping, or changing a medication or dose. Please contact your clinician or care team for treatment advice.", ES: "No puedo recomendar iniciar, suspender ni cambiar un medicamento o una dosis. Consulte a su profesional clínico o equipo de atención.", KR: "Mwen pa ka rekòmande kòmanse, sispann oswa chanje yon medikaman oswa dòz. Tanpri kontakte klinisyen oswa ekip swen ou." },
  HUMAN_HELP_CONFIRMED: {
    EN: "Thank you for telling me — I’m glad help is with you. Please stay with the people caring for you and follow what they tell you. I’ll let your care team know. When you’re ready, I’m here for anything else.",
    ES: "Gracias por decírmelo, me alegra que ya tenga ayuda. Quédese con quienes lo están atendiendo y siga lo que le indiquen. Avisaré a su equipo de atención. Cuando esté listo, aquí estoy para lo que necesite.",
    KR: "Mèsi paske ou di m sa — mwen kontan sekou a avèk ou. Tanpri rete ak moun k ap pran swen ou epi swiv sa yo di w. M ap fè ekip swen ou konnen. Lè ou pare, mwen la pou nenpòt lòt bagay."
  },
  PATIENT_REPORTED_RECOVERED: {
    EN: "Thank you for letting me know you’re feeling better. If those symptoms come back or get worse, call 911 right away. I’ll let your care team know what happened. What else can I help you with?",
    ES: "Gracias por avisarme que se siente mejor. Si esos síntomas vuelven o empeoran, llame al 911 de inmediato. Avisaré a su equipo de atención sobre lo ocurrido. ¿En qué más puedo ayudarle?",
    KR: "Mèsi paske ou fè m konnen ou santi w pi byen. Si sentòm sa yo tounen oswa vin pi mal, rele 911 touswit. M ap fè ekip swen ou konnen sa ki te pase. Kisa lòt mwen ka fè pou ou?"
  }
};

export const detectEmergencyLanguage = value => EMERGENCY.test(emergencyLanguageForEvaluation(value));

// Which kind of resolution the patient just reported, or null if they reported neither. Help
// reaching them wins over feeling better: "the paramedics are here and I feel fine now" is a
// handoff, and should be recorded as one.
export const detectSafetyResolution = value => {
  const text = fold(value);
  if (HELP_CONFIRMED.test(text)) return "HUMAN_HELP_CONFIRMED";
  if (RECOVERED.test(text)) return "PATIENT_REPORTED_RECOVERED";
  return null;
};

export const safetyResolutionCopy = (resolution, locale = "EN") =>
  (COPY[resolution] || COPY.HUMAN_HELP_CONFIRMED)[String(locale).toUpperCase()] || (COPY[resolution] || COPY.HUMAN_HELP_CONFIRMED).EN;

export const createSafetyEpisode = ({ source = "conversation", now = Date.now() } = {}) => ({ id: `safety_${now.toString(36)}`, level: "EMERGENCY", source, active: true, startedAt: now, updatedAt: now, resolution: null });

// Active means active now. An episode nobody resolved but that is hours old has expired, and the
// record of it stays either way — what ends is the response mode, not the audit trail.
export const safetyEpisodeIsActive = (episode, now = Date.now()) =>
  Boolean(episode?.active) && now - Number(episode.startedAt || 0) < SAFETY_EPISODE_MAX_AGE_MS;

// The episode carries a visible way out. Resolution has always existed, but only for a patient who
// happened to type the words the resolution patterns match — so someone who mentioned chest pain
// once and then went quiet about it had every later question answered with "call 911" until the
// four hours ran out, with nothing on screen suggesting that could end.
//
// The button reports the handoff — help is with them — rather than "I feel better". A patient who
// has recovered can still say so in their own words, and that path is unchanged. Making it a
// one-tap dismissal of an emergency instruction is the one thing this must not become.
export const safetyResponseFor = ({ locale = "EN", episode, question = "", medication = false } = {}) => { const key = medication ? "MEDICATION" : FOLLOW_UP.test(fold(question)) ? "FOLLOW_UP" : "EMERGENCY"; return medication || episode?.active ? { text: COPY[key][String(locale).toUpperCase()] || COPY[key].EN, emergency: !medication, priority: "CRITICAL_SAFETY", deterministic: true, ...(medication ? {} : { quickAction: "safety-resolved" }) } : null; };
