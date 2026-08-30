const fold = value => String(value || "").replace(/[‘’ʼ]/g, "'").replace(/\s+/g, " ").trim();
const EMERGENCY = /chest pain|dizzy|dizziness|light[- ]?headed|mareo|mareado|mareada|t[eéè]t vire|vertij|can'?t breathe|cannot breathe|difficulty breathing|stroke|severe bleeding|pass(?:ed)? out|faint(?:ed|ing)?|suicid|emergency|dolor (fuerte )?(en el )?pecho|no puedo respirar|derrame|sangrado grave|me desmay|emergencia|doulè nan pwatrin|pa ka respire|konjesyon serebral|senyen anpil|endispoze|pèdi konesans|ijans|swisid/i;
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

export const detectEmergencyLanguage = value => EMERGENCY.test(fold(value));

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

export const safetyResponseFor = ({ locale = "EN", episode, question = "", medication = false } = {}) => { const key = medication ? "MEDICATION" : FOLLOW_UP.test(fold(question)) ? "FOLLOW_UP" : "EMERGENCY"; return medication || episode?.active ? { text: COPY[key][String(locale).toUpperCase()] || COPY[key].EN, emergency: !medication, priority: "CRITICAL_SAFETY", deterministic: true } : null; };
