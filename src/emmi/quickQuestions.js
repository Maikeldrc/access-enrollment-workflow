// Quick questions are the two-to-four things a patient is most likely to be wondering about the
// screen they are looking at right now. They live here rather than inside the expanded panel so
// every EMMI surface resolves the same list from the same context, and so covering a new screen
// is a row of data instead of another branch inside the UI.
//
// A question is never an answer: the label is sent through the normal EMMI conversation, and the
// id is what analytics records, so question text never leaves the device as an event payload.

// The app carries two spellings of the same language — the UI key ("es", "ht") and the internal
// code ("ES", "KR", where KR is ITERA's identifier for Haitian Creole and never Korean). Both
// resolve here so a caller can hand over whichever one it has.
const normalizeLocale = locale => {
  const value = String(locale || "").toLowerCase();
  if (value === "es") return "es";
  if (["ht", "kr", "ht-ht", "kreyol"].includes(value)) return "ht";
  return "en";
};

const pick = (locale, copy) => ({ es: copy[1], ht: copy[2] }[normalizeLocale(locale)] || copy[0]);

const CATALOG = {
  "access-what-is": { intent: "PROGRAM_EXPLANATION", copy: ["What is ACCESS?", "¿Qué es ACCESS?", "Kisa ACCESS ye?"] },
  "access-someone-help": { intent: "SUPPORT_OPTIONS", copy: ["Can someone help me with this?", "¿Puede alguien ayudarme con esto?", "Èske yon moun ka ede m ak sa?"] },
  "access-must-enroll": { intent: "VOLUNTARY_PARTICIPATION", copy: ["Do I have to enroll?", "¿Tengo que inscribirme?", "Èske mwen oblije enskri?"] },
  "access-keep-doctor": { intent: "PROGRAM_EXPLANATION", copy: ["Will I keep my doctor?", "¿Conservaré a mi médico?", "Èske mwen pral kenbe doktè mwen an?"] },
  "access-affects-medicare": { intent: "MEDICARE_IMPACT", copy: ["Will this affect my Medicare?", "¿Esto afectará mi Medicare?", "Èske sa ap afekte Medicare mwen an?"] },
  "access-what-next": { intent: "NEXT_STEP", copy: ["What happens next?", "¿Qué sucede después?", "Kisa ki rive apre sa?"] },
  "care-how-helps": { intent: "PROGRAM_EXPLANATION", copy: ["How does this care help me?", "¿Cómo me ayuda este cuidado?", "Ki jan swen sa a ede m?"] },
  "care-what-included": { intent: "PROGRAM_EXPLANATION", copy: ["What does ACCESS care include?", "¿Qué incluye el cuidado ACCESS?", "Kisa swen ACCESS gen ladan?"] },
  "care-recommended-meaning": { intent: "PROGRAM_EXPLANATION", copy: ["What does recommended care mean?", "¿Qué significa cuidado recomendado?", "Kisa swen rekòmande vle di?"] },
  "care-keep-seeing-doctor": { intent: "PROGRAM_EXPLANATION", copy: ["Will I keep seeing my doctor?", "¿Seguiré viendo a mi médico?", "Èske mwen pral kontinye wè doktè mwen an?"] },
  "human-talk-to-someone": { intent: "HUMAN_SUPPORT", copy: ["Talk with someone", "Hablar con alguien", "Pale ak yon moun"] },
  "human-talk-care-team": { intent: "HUMAN_SUPPORT", copy: ["Talk with my care team", "Hablar con mi equipo", "Pale ak ekip swen mwen an"] },
  "human-care-team-help": { intent: "HUMAN_SUPPORT", copy: ["How can my care team help?", "¿Cómo puede ayudar mi equipo?", "Kijan ekip swen mwen ka ede?"] },
  "decision-daughter-help": { intent: "SUPPORT_OPTIONS", copy: ["Can my daughter help me?", "¿Puede ayudarme mi hija?", "Èske pitit fi mwen ka ede m?"] },
  "decision-what-is-representative": { intent: "REPRESENTATIVE_ROLE", copy: ["What is a Personal Representative?", "¿Qué es un Representante personal?", "Kisa yon Reprezantan pèsonèl ye?"] },
  "decision-who-completes": { intent: "SUPPORT_OPTIONS", copy: ["Who should complete this?", "¿Quién debe completar esto?", "Ki moun ki dwe ranpli sa a?"] },
  "rep-why-phone": { intent: "REPRESENTATIVE_ROLE", copy: ["Why do you need my phone?", "¿Por qué necesitan mi teléfono?", "Poukisa nou bezwen telefòn mwen?"] },
  "rep-why-verify": { intent: "REPRESENTATIVE_ROLE", copy: ["Why do I need to verify it?", "¿Por qué debo verificarlo?", "Poukisa mwen bezwen verifye li?"] },
  "rep-what-means": { intent: "REPRESENTATIVE_ROLE", copy: ["What does Personal Representative mean?", "¿Qué significa Representante personal?", "Kisa Reprezantan pèsonèl vle di?"] },
  "eligibility-what-checking": { intent: "ELIGIBILITY", copy: ["What is Medicare checking?", "¿Qué está verificando Medicare?", "Kisa chèk Medicare ye?"] },
  "eligibility-affects-benefits": { intent: "MEDICARE_IMPACT", copy: ["Will this affect my benefits?", "¿Esto afectará mis beneficios?", "Èske sa ap afekte benefis mwen yo?"] },
  "eligibility-why-information": { intent: "ELIGIBILITY", copy: ["Why do you need my information?", "¿Por qué necesitan mi información?", "Poukisa ou bezwen enfòmasyon mwen?"] },
  "eligibility-why-blocked": { intent: "ELIGIBILITY", copy: ["Why can’t I continue?", "¿Por qué no puedo continuar?", "Poukisa mwen pa ka kontinye?"] },
  "eligibility-still-see-doctors": { intent: "PROGRAM_EXPLANATION", copy: ["Can I still see my doctors?", "¿Puedo seguir viendo a mis médicos?", "Èske mwen ka toujou wè doktè mwen yo?"] },
  "disclosure-voluntary-meaning": { intent: "VOLUNTARY_PARTICIPATION", copy: ["What does voluntary mean?", "¿Qué significa voluntario?", "Kisa volontè vle di?"] },
  "disclosure-benefits-change": { intent: "MEDICARE_IMPACT", copy: ["Will my Medicare benefits change?", "¿Cambiarán mis beneficios de Medicare?", "Èske benefis Medicare mwen yo ap chanje?"] },
  "disclosure-cost": { intent: "COST", copy: ["Will this cost me anything?", "¿Esto tendrá algún costo?", "Èske sa ap koute m anyen?"] },
  "disclosure-change-provider": { intent: "PROGRAM_EXPLANATION", copy: ["Can I change ACCESS providers?", "¿Puedo cambiar de proveedor ACCESS?", "Èske mwen ka chanje founisè ACCESS?"] },
  "consent-what-agreeing": { intent: "CONSENT", copy: ["What am I agreeing to?", "¿Qué estoy aceptando?", "Kisa mwen dakò ak?"] },
  "consent-change-mind": { intent: "VOLUNTARY_PARTICIPATION", copy: ["Can I change my mind?", "¿Puedo cambiar de opinión?", "Èske mwen ka chanje lide mwen?"] },
  "consent-cost": { intent: "COST", copy: ["What will this cost?", "¿Cuánto costará?", "Ki sa ki pral pri sa a?"] },
  "consent-medicare-change": { intent: "MEDICARE_IMPACT", copy: ["Does this change my Medicare?", "¿Esto cambia mi Medicare?", "Èske sa chanje Medicare mwen an?"] },
  "consent-representative-signature": { intent: "REPRESENTATIVE_ROLE", copy: ["What does signing as a personal representative mean?", "¿Qué significa firmar como representante personal?", "Ki sa siyati vle di antanke reprezantan pèsonèl?"] },
  "health-high-bp-meaning": { intent: "CLINICAL_EDUCATION", copy: ["What does high blood pressure mean?", "¿Qué significa presión arterial alta?", "Kisa tansyon wo vle di?"] },
  "health-emmi-confirm": { intent: "SCOPE_LIMIT", copy: ["Can EMMI confirm this information?", "¿Puede EMMI confirmar esta información?", "Èske EMMI ka konfime enfòmasyon sa a?"] },
  "health-not-correct": { intent: "DATA_CORRECTION", copy: ["I’m not sure this is correct", "No estoy seguro de que esto sea correcto", "Mwen pa sèten sa kòrèk"] },
  "medication-why-review": { intent: "SCREEN_PURPOSE", copy: ["Why am I reviewing my medications?", "¿Por qué reviso mis medicamentos?", "Poukisa m ap revize medikaman mwen yo?"] },
  "medication-something-changed": { intent: "DATA_CORRECTION", copy: ["What if something changed?", "¿Y si algo cambió?", "E si yon bagay chanje?"] },
  "medication-unknown-dose": { intent: "DATA_CORRECTION", copy: ["I don’t know my dose", "No sé cuál es mi dosis", "Mwen pa konnen dòz mwen"] },
  "medication-not-sure-taking": { intent: "DATA_CORRECTION", copy: ["I’m not sure if I take this", "No estoy seguro de tomar esto", "Mwen pa sèten si mwen pran sa"] },
  "goals-why-asking": { intent: "SCREEN_PURPOSE", copy: ["Why are you asking about my goals?", "¿Por qué preguntan por mis metas?", "Poukisa nou mande m sou objektif mwen?"] },
  "goals-change-later": { intent: "GOAL_SUPPORT", copy: ["Can I change a goal later?", "¿Puedo cambiar una meta después?", "Èske mwen ka chanje yon objektif pita?"] },
  "goals-personalize": { intent: "GOAL_SUPPORT", copy: ["Can you help me personalize my plan?", "¿Puede ayudarme a personalizar mi plan?", "Èske ou ka ede m pèsonalize plan mwen?"] },
  "goals-trouble": { intent: "GOAL_SUPPORT", copy: ["I’m having trouble with my goal", "Tengo dificultades con mi meta", "Mwen gen pwoblèm ak objektif mwen"] },
  "goal-reading-meaning": { intent: "CLINICAL_EDUCATION", copy: ["What does my latest blood pressure reading mean?", "¿Qué significa mi lectura más reciente de presión arterial?", "Kisa dènye lekti tansyon mwen vle di?"] },
  "goal-week-trend": { intent: "CLINICAL_EDUCATION", copy: ["How has my blood pressure been this week?", "¿Cómo ha estado mi presión esta semana?", "Kijan tansyon mwen te ye semèn sa a?"] },
  "goal-trend-importance": { intent: "CLINICAL_EDUCATION", copy: ["Why are trends important?", "¿Por qué son importantes las tendencias?", "Poukisa tandans yo enpòtan?"] },
  "goal-monitor-help": { intent: "DEVICE_SUPPORT", copy: ["How do I use my monitor?", "¿Cómo uso mi monitor?", "Kijan pou m itilize aparèy mwen an?"] },
  "device-no-tape": { intent: "DEVICE_SUPPORT", copy: ["I don’t have a measuring tape", "No tengo una cinta métrica", "Mwen pa gen yon riban mezi"] },
  "device-measure-arm": { intent: "DEVICE_SUPPORT", copy: ["How do I measure my arm?", "¿Cómo mido mi brazo?", "Kijan pou m mezire bra mwen?"] },
  "device-which-arm": { intent: "DEVICE_SUPPORT", copy: ["I’m not sure which arm to use", "No sé qué brazo usar", "Mwen pa sèten ki bra pou m itilize"] },
  "device-take-again": { intent: "DEVICE_SUPPORT", copy: ["Do I need to take my blood pressure again now?", "¿Necesito tomarme la presión otra vez ahora?", "Èske mwen bezwen pran tansyon mwen ankò kounye a?"] },
  "device-connected": { intent: "DEVICE_SUPPORT", copy: ["Is my monitor connected?", "¿Mi monitor está conectado?", "Èske aparèy mwen konekte?"] },
  "device-need-monitor": { intent: "DEVICE_SUPPORT", copy: ["I need a monitor", "Necesito un monitor", "Mwen bezwen yon aparèy"] },
  "circle-how-invitation-works": { intent: "CARE_CIRCLE", copy: ["How does the invitation work?", "¿Cómo funciona la invitación?", "Kijan envitasyon an mache?"] },
  "circle-decisions-for-me": { intent: "CARE_CIRCLE", copy: ["Can they make decisions for me?", "¿Puede tomar decisiones por mí?", "Èske moun nan ka pran desizyon pou mwen?"] },
  "circle-remove-later": { intent: "CARE_CIRCLE", copy: ["Can I remove them later?", "¿Puedo eliminarlo después?", "Èske mwen ka retire moun nan apre?"] },
  "confirmed-invite-someone": { intent: "CARE_CIRCLE", copy: ["Invite someone I trust", "Invitar a alguien de confianza", "Envite yon moun mwen fè konfyans"] },
  "confirmed-share-access": { intent: "SHARE", copy: ["Share ACCESS", "Compartir ACCESS", "Pataje ACCESS"] },
  "access-how-helps-me": { intent: "PROGRAM_EXPLANATION", copy: ["How can this help me?", "¿Cómo puede ayudarme esto?", "Kijan sa ka ede m?"] },
  "identity-why-information": { intent: "SCREEN_PURPOSE", copy: ["Why do you need this information?", "¿Por qué necesitan esta información?", "Poukisa ou bezwen enfòmasyon sa a?"] },
  "identity-secure": { intent: "SECURITY", copy: ["Is my information secure?", "¿Mi información está segura?", "Èske enfòmasyon mwen an sekirite?"] },
  "invitation-who-invited": { intent: "INVITATION_SOURCE", copy: ["Who invited me?", "¿Quién me invitó?", "Ki moun ki envite m?"] },
  "care-monitor-help": { intent: "DEVICE_SUPPORT", copy: ["How will the blood pressure monitor help me?", "¿Cómo me ayudará el monitor de presión arterial?", "Kijan aparèy tansyon an pral ede m?"] },
  "care-my-plan": { intent: "CARE_PLAN", copy: ["What is my care plan?", "¿Qué es mi plan de cuidado?", "Kisa plan swen mwen ye?"] },
  "eligibility-why-verify": { intent: "ELIGIBILITY", copy: ["Why does Medicare need to verify me?", "¿Por qué Medicare necesita verificarme?", "Poukisa Medicare bezwen verifye m?"] },
  "eligibility-change-medicare": { intent: "MEDICARE_IMPACT", copy: ["Will this change my Medicare?", "¿Esto cambiará mi Medicare?", "Èske sa ap chanje Medicare mwen an?"] },
  "eligibility-comparison-group": { intent: "ELIGIBILITY", copy: ["What is the comparison group?", "¿Qué es el grupo de comparación?", "Kisa gwoup konparezon an ye?"] },
  "eligibility-enrolled-yet": { intent: "ENROLLMENT_STATUS", copy: ["Am I enrolled yet?", "¿Ya estoy inscrito?", "Èske mwen deja enskri?"] },
  "eligibility-review-next": { intent: "NEXT_STEP", copy: ["What will I review next?", "¿Qué revisaré después?", "Kisa m ap revize apre?"] },
  "consent-why-zero-payment": { intent: "COST", copy: ["Why is my expected payment $0?", "¿Por qué mi pago esperado es $0?", "Poukisa peman mwen prevwa a se $0?"] },
  "consent-change-mind-later": { intent: "VOLUNTARY_PARTICIPATION", copy: ["Can I change my mind later?", "¿Puedo cambiar de opinión después?", "Èske mwen ka chanje lide mwen pita?"] },
  "device-how-get-monitor": { intent: "DEVICE_SUPPORT", copy: ["How do I get my blood pressure monitor?", "¿Cómo obtengo mi monitor de presión arterial?", "Kijan pou m jwenn aparèy tansyon mwen an?"] },
  "plan-what-will-include": { intent: "CARE_PLAN", copy: ["What will my care plan include?", "¿Qué incluirá mi plan de cuidado?", "Kisa plan swen mwen an ap gen ladan?"] },
  "goals-what-work-on": { intent: "GOAL_SUPPORT", copy: ["What goals will I work on?", "¿En qué metas trabajaré?", "Ki objektif m ap travay sou yo?"] },
  "bp-how-am-i-doing": { intent: "CLINICAL_EDUCATION", copy: ["How is my blood pressure doing?", "¿Cómo va mi presión arterial?", "Kijan tansyon mwen ye?"] },
  "care-what-should-i-do": { intent: "NEXT_STEP", copy: ["What should I do next?", "¿Qué debo hacer ahora?", "Kisa mwen ta dwe fè apre?"] },
  "appointment-need-one": { intent: "APPOINTMENT_NEED", copy: ["I need an appointment", "Necesito una cita", "Mwen bezwen yon randevou"] },
  "care-team-how-contact": { intent: "HUMAN_SUPPORT", copy: ["How can I contact my care team?", "¿Cómo puedo contactar a mi equipo de cuidado?", "Kijan mwen ka kontakte ekip swen mwen an?"] },
  "monitor-how-often": { intent: "DEVICE_SUPPORT", copy: ["How often should I use it?", "¿Con qué frecuencia debo usarlo?", "Konbyen fwa mwen dwe itilize l?"] },
  "monitor-readings-where": { intent: "DEVICE_SUPPORT", copy: ["What happens to my readings?", "¿Qué pasa con mis lecturas?", "Kisa k ap pase ak lekti mwen yo?"] },
  "cost-other-services": { intent: "COST", copy: ["What about other healthcare costs?", "¿Y los otros costos de salud?", "E lòt depans swen sante yo?"] },
  "coverage-supplemental": { intent: "COVERAGE", copy: ["Do I have supplemental insurance?", "¿Tengo seguro suplementario?", "Èske mwen gen asirans siplemantè?"] }
};

// A medication question that names the patient's own medication is worth more than a generic one,
// so this single entry is built from the runtime list instead of the catalog.
const medicationNameQuestion = (locale, medications = []) => {
  const medication = medications.find(item => item.active) || medications[0];
  if (!medication?.name) return null;
  return {
    id: "medication-what-is",
    intent: "MEDICATION_EDUCATION",
    label: pick(locale, [`What is ${medication.name}?`, `¿Qué es ${medication.name}?`, `Kisa ${medication.name} ye?`])
  };
};

// The doctor who referred this patient is the most natural thing to ask about, and their name is
// runtime data. Built here rather than sitting in the catalog so no screen can name a physician the
// invitation did not have.
const physicianQuestion = (locale, physicianDisplayName) => {
  if (!physicianDisplayName) return null;
  return {
    id: "physician-still-involved",
    intent: "CARE_TEAM_QUESTION",
    label: pick(locale, [
      `Will ${physicianDisplayName} still be involved?`,
      `¿${physicianDisplayName} seguirá involucrado?`,
      `Èske ${physicianDisplayName} ap toujou patisipe?`
    ])
  };
};

const SCREEN_SETS = {
  INVITATION: ["access-what-is", "access-how-helps-me", "@physician", "access-must-enroll"],
  DECISION_MAKER: ["decision-daughter-help", "decision-what-is-representative", "decision-who-completes"],
  IDENTITY_VERIFICATION: ["identity-why-information", "identity-secure", "invitation-who-invited"],
  PERSONAL_REPRESENTATIVE_DETAILS: ["rep-why-phone", "rep-why-verify", "rep-what-means", "human-talk-to-someone"],
  REPRESENTATIVE_MOBILE_VERIFICATION: ["rep-why-phone", "rep-why-verify", "rep-what-means", "human-talk-to-someone"],
  REPRESENTATIVE_AUTHORITY_ATTESTATION: ["rep-why-phone", "rep-why-verify", "rep-what-means", "human-talk-to-someone"],
  REPRESENTATIVE_AUTHORITY_ESCALATION: ["rep-why-phone", "rep-why-verify", "rep-what-means", "human-talk-to-someone"],
  DISCLOSURE: ["disclosure-voluntary-meaning", "disclosure-benefits-change", "disclosure-cost", "disclosure-change-provider"],
  CONSENT_REVIEW: ["access-must-enroll", "eligibility-change-medicare", "consent-why-zero-payment", "consent-change-mind-later"],
  ENROLLMENT_CONFIRMED: ["access-what-next", "device-how-get-monitor", "plan-what-will-include", "goals-what-work-on"],
  MY_CARE: ["bp-how-am-i-doing", "care-what-should-i-do", "appointment-need-one", "care-team-how-contact"],
  HEALTH_INFORMATION_REVIEW: ["health-high-bp-meaning", "health-emmi-confirm", "health-not-correct", "human-care-team-help"],
  ACCESS_BP_DEVICE_INFO: ["device-no-tape", "device-measure-arm", "device-which-arm", "human-talk-care-team"],
  ACCESS_MEASURE: ["device-take-again", "device-connected", "device-need-monitor", "human-talk-care-team"],
  ACCESS_BP_DEVICE_VERIFICATION: ["device-take-again", "device-connected", "device-need-monitor", "human-talk-care-team"],
  ACCESS_BP_DEVICE_RESULT: ["device-take-again", "device-connected", "device-need-monitor", "human-talk-care-team"],
  ACCESS_BP_GUIDED_SETUP: ["device-take-again", "device-connected", "device-need-monitor", "human-talk-care-team"],
  ACCESS_BP_MEASUREMENT: ["device-take-again", "device-connected", "device-need-monitor", "human-talk-care-team"],
  CARE_CIRCLE_INVITE: ["circle-how-invitation-works", "circle-decisions-for-me", "circle-remove-later"],
  MY_CARE_CIRCLE: ["circle-how-invitation-works", "circle-decisions-for-me", "circle-remove-later"],
  CARE_CIRCLE_PERMISSIONS: ["circle-how-invitation-works", "circle-decisions-for-me", "circle-remove-later"]
};

const MAX_SUGGESTIONS = 4;
const ELIGIBILITY_SCREENS = ["ACCESS_PRE_ELIGIBILITY_NOTICE", "ACCESS_MEDICARE_IDENTIFIER", "ACCESS_ELIGIBILITY_PROCESSING", "ACCESS_ELIGIBILITY_RESULT"];

// Screen first, then what the patient's own record says about that screen. The order matters:
// a goal screen with a live reading behind it can ask about the reading, the same screen without
// one cannot.
function resolveIds({ currentScreen, program, context }) {
  if (currentScreen === "MY_GOALS" && context.activeGoal?.latestReading) return ["goal-reading-meaning", "goal-week-trend", "goal-monitor-help", "human-talk-care-team"];
  if (currentScreen === "MY_GOALS" && context.activeGoal) return ["goals-trouble", "goal-trend-importance", "goals-change-later", "human-talk-care-team"];
  if (["GOALS", "MY_GOALS"].includes(currentScreen)) return ["goals-why-asking", "goals-change-later", "goals-personalize", "goals-trouble"];
  if (currentScreen === "ACCESS_ELIGIBILITY_RESULT") return context.eligibilityStatus === "NOT_ELIGIBLE"
    ? ["eligibility-why-blocked", "access-affects-medicare", "eligibility-still-see-doctors"]
    : ["access-what-next", "eligibility-enrolled-yet", "eligibility-review-next"];
  if (ELIGIBILITY_SCREENS.includes(currentScreen)) return context.eligibilityStatus === "NOT_ELIGIBLE"
    ? ["eligibility-why-blocked", "access-affects-medicare", "eligibility-still-see-doctors"]
    : ["eligibility-why-verify", "eligibility-change-medicare", "eligibility-comparison-group"];
  if (currentScreen === "CARE_RECOMMENDATION") return program === "ACCESS"
    ? ["care-monitor-help", "care-my-plan", "@physician", "care-what-included"]
    : ["care-recommended-meaning", "care-keep-seeing-doctor", "access-what-next"];
  if (SCREEN_SETS[currentScreen]) return SCREEN_SETS[currentScreen];
  return program === "ACCESS"
    ? ["access-what-is", "access-keep-doctor", "access-what-next", "access-affects-medicare"]
    : ["care-how-helps", "access-keep-doctor", "access-what-next"];
}

export function getEmmiQuickQuestions({ currentScreen = "", program = "", locale = "en", context = {} } = {}) {
  if (currentScreen === "MEDICATIONS_REVIEW") {
    const named = medicationNameQuestion(locale, context.medications);
    const rest = [named ? "medication-why-review" : "medication-not-sure-taking", "medication-something-changed", "human-talk-care-team"];
    return [named, ...rest.map(id => toQuestion(id, locale))].filter(Boolean).slice(0, MAX_SUGGESTIONS);
  }
  // "@physician" resolves against the runtime referral, and drops out entirely when the invitation
  // did not name a doctor rather than falling back to a generic stand-in.
  return resolveIds({ currentScreen, program, context })
    .map(id => id === "@physician" ? physicianQuestion(locale, context.physicianDisplayName) : toQuestion(id, locale))
    .filter(Boolean)
    .slice(0, MAX_SUGGESTIONS);
}

// After an answer, one to three places the patient plausibly goes next. Keyed on what EMMI actually
// answered, so a screen never shows the same chips twice in a row regardless of the conversation.
const FOLLOW_UPS = {
  DEVICE_QUESTION: ["device-how-get-monitor", "monitor-how-often", "monitor-readings-where"],
  DEVICE_SUPPORT: ["device-how-get-monitor", "monitor-how-often", "monitor-readings-where"],
  COST_QUESTION: ["cost-other-services", "coverage-supplemental", "consent-change-mind-later"],
  ELIGIBILITY_QUESTION: ["eligibility-enrolled-yet", "eligibility-review-next", "eligibility-change-medicare"],
  INVITATION_SOURCE: ["access-what-is", "access-how-helps-me", "access-must-enroll"],
  CARE_TEAM_QUESTION: ["care-team-how-contact", "appointment-need-one", "care-my-plan"],
  PROGRAM_EXPLANATION: ["access-how-helps-me", "care-my-plan", "access-must-enroll"],
  NEXT_STEP: ["care-what-should-i-do", "device-how-get-monitor", "goals-what-work-on"],
  GOAL_QUESTION: ["goals-what-work-on", "goals-change-later", "goals-personalize"]
};

export function getEmmiFollowUps({ intent = "", locale = "en", asked = [] } = {}) {
  const ids = FOLLOW_UPS[intent];
  if (!ids) return [];
  // Never suggest something the patient has already asked in this conversation.
  return ids.filter(id => !asked.includes(id)).map(id => toQuestion(id, locale)).filter(Boolean).slice(0, 3);
}

function toQuestion(id, locale) {
  const entry = CATALOG[id];
  return entry ? { id, intent: entry.intent, label: pick(locale, entry.copy) } : null;
}

export const emmiQuickQuestionCatalog = CATALOG;
