// "Talk with my care team" is a request, not a question. Tapping the quick question already takes
// the patient to the support options, but the same words typed or spoken reached no intent and
// were answered from the knowledge base — an explanation of what a care team is, to a patient
// asking to reach one. This is that intent.
//
// Who is on the care team is not decided here: careTeamDirectory.js already builds it from the
// patient's own record and resolves who they asked for. This module only recognises the request
// and puts the runtime's answer into words.

import { PROFESSIONAL_TYPES } from "../careTeamDirectory.js";

const pick = (locale, values) => values[String(locale || "EN").toUpperCase()] || values.EN;

export const CARE_TEAM_CONTACT_INTENT = "CARE_TEAM_CONTACT";

// The quick question id is the canonical key, so a Spanish or Kreyol label reaches the intent
// without a translated regex having to spell its wording.
export const CARE_TEAM_CONTACT_QUESTION_IDS = Object.freeze(["human-talk-care-team"]);

// A contact verb plus someone on the care team. Topic alone is deliberately not enough: "Will I
// keep my doctor?" is a program question and "Is my monitor connected?" is a device one. Both
// would be wrong to turn into a request to reach a person.
const CONTACT_REQUEST = [
  /\b(talk|speak|contact|reach|call|ask|message)\b[^?.!]{0,40}\b(my |our )?(care ?team|care manager|care coordinator|nurse|doctor|physician|specialist|clinician|pharmacist)\b/i,
  /\b(care ?team|care manager|care coordinator|nurse|doctor|physician|specialist|clinician|pharmacist)\b[^?.!]{0,40}\b(call|contact|reach|get in touch)\b/i,
  /\b(question|questions)\b[^?.!]{0,30}\bfor my\b[^?.!]{0,20}\b(care ?team|care manager|nurse|doctor|physician|specialist)\b/i,
  /\b(hablar|contactar|comunicar|comunicarme|llamar|preguntar)\b[^?.!]{0,40}\b(mi |con mi )?(equipo|equipo de atenci[oó]n|equipo de cuidado|gestor de cuidado|coordinador|enfermer[ao]|m[eé]dico|doctor|especialista|farmac[eé]utic[ao])\b/i,
  /\b(equipo de atenci[oó]n|equipo de cuidado|gestor de cuidado|enfermer[ao]|m[eé]dico|especialista)\b[^?.!]{0,40}\b(llame|llamen|llamarme|contacte|contacten)\b/i,
  /\b(pale|kontakte|rele|mande)\b[^?.!]{0,40}\b(ak )?(ekip swen|jesyon[eè] swen|enfimy[eè]|dokt[eè]|espesyalis)\b/i,
  /\b(ekip swen|jesyon[eè] swen|enfimy[eè]|dokt[eè]|espesyalis)\b[^?.!]{0,40}\brele m\b/i
];

// Which of them the patient named, in the vocabulary the directory already uses.
const REQUESTED_TYPE = [
  [PROFESSIONAL_TYPES.CARE_MANAGER, /care manager|care coordinator|gestor de cuidado|coordinador|jesyon[eè] swen/i],
  [PROFESSIONAL_TYPES.NURSE, /\bnurse\b|enfermer[ao]|enfimy[eè]/i],
  [PROFESSIONAL_TYPES.PHARMACIST, /pharmacist|farmac[eé]utic[ao]|famasyen/i],
  [PROFESSIONAL_TYPES.SPECIALIST, /specialist|cardiologist|especialista|cardi[oó]logo|espesyalis/i],
  [PROFESSIONAL_TYPES.PRIMARY_CARE, /\bdoctor\b|physician|clinician|m[eé]dico|dokt[eè]/i]
];

export function detectCareTeamContact({ question = "", questionId = "" } = {}) {
  const text = String(question || "");
  if (!CARE_TEAM_CONTACT_QUESTION_IDS.includes(questionId) && !CONTACT_REQUEST.some(pattern => pattern.test(text))) return null;
  return {
    intent: CARE_TEAM_CONTACT_INTENT,
    professionalType: (REQUESTED_TYPE.find(([, pattern]) => pattern.test(text)) || [PROFESSIONAL_TYPES.UNKNOWN])[0]
  };
}

// EMMI asks before creating anything, so a patient who mentioned their doctor in passing is never
// told a request was sent. What she offers is the callback she can actually make: the ITERA care
// team reaching out. She never promises the named clinician will be the one to call.
export function careTeamContactPrompt({ resolution, locale, careTeamSize = 0 }) {
  if (resolution?.status === "RESOLVED" && resolution.match?.displayName) return pick(locale, {
    EN: `${resolution.match.displayName} is on your care team. I can ask the ITERA care team to contact you about this. Would you like me to?`,
    ES: `${resolution.match.displayName} forma parte de su equipo de atención. Puedo pedir al equipo de ITERA que se comunique con usted sobre esto. ¿Desea que lo haga?`,
    KR: `${resolution.match.displayName} fè pati ekip swen ou. Mwen ka mande ekip swen ITERA a kontakte w sou sa. Èske ou vle m fè sa?`
  });
  if (resolution?.status === "AMBIGUOUS" && resolution.candidates?.length) {
    const names = resolution.candidates.map(item => item.displayName).join(" · ");
    return pick(locale, {
      EN: `Your care team includes ${names}. I can ask the ITERA care team to contact you about this. Would you like me to?`,
      ES: `Su equipo de atención incluye a ${names}. Puedo pedir al equipo de ITERA que se comunique con usted sobre esto. ¿Desea que lo haga?`,
      KR: `Ekip swen ou gen ladan ${names}. Mwen ka mande ekip swen ITERA a kontakte w sou sa. Èske ou vle m fè sa?`
    });
  }
  // A named role the record does not contain is said out loud rather than quietly answered by
  // somebody else.
  if (careTeamSize) return pick(locale, {
    EN: "I don’t see that person listed in your care information, but I can ask the ITERA care team to contact you about this. Would you like me to?",
    ES: "No veo a esa persona en su información de cuidado, pero puedo pedir al equipo de ITERA que se comunique con usted sobre esto. ¿Desea que lo haga?",
    KR: "Mwen pa wè moun sa a nan enfòmasyon swen ou, men mwen ka mande ekip swen ITERA a kontakte w sou sa. Èske ou vle m fè sa?"
  });
  return pick(locale, {
    EN: "I can ask the ITERA care team to contact you about this. Would you like me to?",
    ES: "Puedo pedir al equipo de atención de ITERA que se comunique con usted sobre esto. ¿Desea que lo haga?",
    KR: "Mwen ka mande ekip swen ITERA a kontakte w sou sa. Èske ou vle m fè sa?"
  });
}
