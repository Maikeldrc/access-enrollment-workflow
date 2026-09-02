// Personal goals, and the one distinction the whole feature exists to protect:
//
//   A GOAL says what the patient wants to REACH.        "Be able to walk without getting so tired"
//   An ACTION says what they will DO to get there.      "Walk 20 minutes, 4 times a week"
//
// The moment "walk 20 minutes four times a week" is stored as a goal, the patient owns a schedule
// instead of an outcome — and a schedule cannot be achieved, only complied with. Everything below
// exists so that never happens by accident, in any language, through typing or through voice.
//
// WHY THIS IS DETERMINISTIC AND NOT A PROMPT
//
// EMMI could be asked to tell a goal from a task. It would mostly get it right, and "mostly" is the
// problem: the same sentence would become a goal in chat and an action in voice, and nothing in the
// product could explain why. So the decision is made here, by one function, and EMMI reaches it
// through a tool. The model's job is the conversation — asking the short question, offering the
// wording, accepting an edit — not the classification.
//
// WHY TEMPLATES EXIST
//
// When a patient describes a behaviour, somebody has to write the outcome sentence. If EMMI writes
// it, the app decided what the patient wants. If we offer a curated, translated sentence that the
// patient accepts, edits or replaces, the patient decided and we helped. That is the difference
// between participation and substitution, and it is why every proposal is a proposal.
//
// No template carries a number, a threshold or a measure. Personal goals never do: clinical targets
// belong to the care team and to the program's outcome definitions, and a personal goal that
// quietly grew a target would be a patient editing clinical parameters through the back door.
//
// Pure module: no DOM, no app state, no storage, no locale. Callers localize.

const T = (en, es, ht) => Object.freeze({ en, es, ht });

export const PERSONAL_GOAL_TEMPLATES = Object.freeze({
  WALKING_ENDURANCE: {
    category: "ACTIVITY_MOBILITY",
    displayName: T("Be able to walk without getting so tired", "Mejorar mi capacidad para caminar sin cansarme tanto", "Ka mache san m pa fatige konsa"),
    suggestedActions: [
      { id: "walk-what-i-can", title: T("Take a walk I can manage", "Caminar lo que pueda", "Fè yon mache mwen ka jere"), frequency: true, defaultTarget: 3 },
      { id: "walk-a-bit-longer", title: T("Walk a little longer when it feels right", "Caminar un poco más cuando me sienta bien", "Mache yon ti kras pi lontan lè m santi m byen"), frequency: false },
      { id: "note-how-i-felt", title: T("Notice how I feel after walking", "Notar cómo me siento después de caminar", "Remake kijan m santi m apre mwen mache"), frequency: true, defaultTarget: 3 }
    ]
  },
  MORE_ACTIVE: {
    category: "ACTIVITY_MOBILITY",
    displayName: T("Be more physically active", "Ser más activo físicamente", "Vin pi aktif fizikman"),
    suggestedActions: [
      { id: "move-most-days", title: T("Move my body in a way that feels safe", "Mover mi cuerpo de una forma que se sienta segura", "Deplase kò m nan yon fason ki an sekirite"), frequency: true, defaultTarget: 3 },
      { id: "plan-active-time-personal", title: T("Choose a time of day that works for me", "Elegir una hora del día que me funcione", "Chwazi yon lè nan jounen an ki bon pou mwen"), frequency: false }
    ]
  },
  EATING_HABITS: {
    category: "NUTRITION",
    displayName: T("Improve my eating habits", "Mejorar mis hábitos de alimentación", "Amelyore abitid manje mwen"),
    suggestedActions: [
      { id: "less-salt-personal", title: T("Choose foods with less salt", "Elegir alimentos con menos sal", "Chwazi manje ki gen mwens sèl"), frequency: true, defaultTarget: 4 },
      { id: "more-vegetables", title: T("Include vegetables more often", "Incluir vegetales con más frecuencia", "Mete plis legim pi souvan"), frequency: true, defaultTarget: 4 },
      { id: "nutrition-questions", title: T("Go over healthy options with my care team", "Revisar opciones saludables con mi equipo de atención", "Gade opsyon ki an sante ak ekip swen mwen"), frequency: false }
    ]
  },
  HEALTHIER_WEIGHT: {
    category: "WEIGHT",
    displayName: T("Reach a healthier weight", "Alcanzar un peso más saludable", "Rive nan yon pwa ki pi an sante"),
    suggestedActions: [
      { id: "eat-in-a-way-that-helps", title: T("Eat in a way that helps me", "Comer de una forma que me ayude", "Manje nan yon fason ki ede m"), frequency: true, defaultTarget: 5 },
      { id: "keep-moving", title: T("Keep moving in ways that are right for me", "Mantenerme en movimiento de la forma adecuada para mí", "Kontinye deplase nan fason ki bon pou mwen"), frequency: true, defaultTarget: 3 }
    ]
  },
  SLEEP_QUALITY: {
    category: "WELLBEING",
    displayName: T("Sleep better", "Mejorar la calidad de mi sueño", "Dòmi pi byen"),
    suggestedActions: [
      { id: "wind-down", title: T("Keep a calm routine before bed", "Mantener una rutina tranquila antes de dormir", "Kenbe yon woutin kalm anvan m dòmi"), frequency: true, defaultTarget: 5 },
      { id: "note-how-i-slept", title: T("Notice how I slept", "Notar cómo dormí", "Remake kijan mwen dòmi"), frequency: true, defaultTarget: 5 }
    ]
  },
  MORE_ENERGY: {
    category: "WELLBEING",
    displayName: T("Have more energy during the day", "Sentirme con más energía durante el día", "Gen plis enèji pandan jounen an"),
    suggestedActions: [
      { id: "pace-my-day", title: T("Pace my day so I do not run out of energy", "Organizar mi día para no quedarme sin energía", "Òganize jounen m pou m pa manke enèji"), frequency: true, defaultTarget: 5 },
      { id: "note-energy", title: T("Notice when I have the most energy", "Notar cuándo tengo más energía", "Remake ki lè mwen gen plis enèji"), frequency: false }
    ]
  },
  FAMILY_ACTIVITIES: {
    category: "WELLBEING",
    displayName: T("Have the stamina to do things with my family", "Mejorar mi resistencia para hacer actividades con mi familia", "Gen fòs pou m fè bagay ak fanmi mwen"),
    suggestedActions: [
      { id: "plan-family-time", title: T("Plan something to do with my family", "Planear algo para hacer con mi familia", "Planifye yon bagay pou m fè ak fanmi m"), frequency: false },
      { id: "build-up-slowly", title: T("Build up slowly so I can keep up", "Avanzar poco a poco para poder seguir el ritmo", "Monte tikras pa tikras pou m ka swiv"), frequency: true, defaultTarget: 3 }
    ]
  },
  MEDICATION_MANAGEMENT: {
    category: "MEDICATIONS",
    displayName: T("Manage my medications better", "Mejorar el manejo de mis medicamentos", "Jere medikaman mwen yo pi byen"),
    suggestedActions: [
      { id: "take-as-directed-personal", title: T("Take my medications the way they are written", "Tomar mis medicamentos como están indicados", "Pran medikaman m jan yo ekri yo"), frequency: true, defaultTarget: 7 },
      { id: "keep-them-where-i-see-them", title: T("Keep my medications where I will see them", "Guardar mis medicamentos donde pueda verlos", "Kenbe medikaman m kote m ka wè yo"), frequency: false }
    ]
  },
  TREATMENT_CONFIDENCE: {
    category: "MEDICATIONS",
    displayName: T("Feel comfortable and confident with my treatment", "Sentirme cómodo y seguro con mi tratamiento", "Santi m alèz e an konfyans ak tretman mwen"),
    suggestedActions: [
      { id: "write-down-my-questions", title: T("Write down my questions about my treatment", "Anotar mis preguntas sobre mi tratamiento", "Ekri kesyon mwen sou tretman mwen"), frequency: false },
      { id: "raise-it-with-my-doctor", title: T("Bring it up with my doctor", "Hablarlo con mi médico", "Pale sou li ak doktè mwen"), frequency: false }
    ]
  },
  BLOOD_PRESSURE_CONFIDENCE: {
    category: "CARDIOVASCULAR",
    displayName: T("Get better at managing my blood pressure", "Mejorar el control de mi presión arterial", "Vin pi bon nan jere tansyon mwen"),
    suggestedActions: [
      { id: "check-when-asked", title: T("Check my blood pressure the way my care team asked", "Revisar mi presión como me indicó mi equipo", "Tcheke tansyon m jan ekip swen mwen mande"), frequency: true, defaultTarget: 5 },
      { id: "learn-my-numbers", title: T("Learn what my numbers mean", "Aprender qué significan mis números", "Aprann sa chif mwen yo vle di"), frequency: false }
    ]
  },
  GLUCOSE_CONFIDENCE: {
    category: "DIABETES_GLUCOSE",
    displayName: T("Get better at managing my blood sugar", "Mejorar el control de mi azúcar en la sangre", "Vin pi bon nan jere sik nan san mwen"),
    suggestedActions: [
      { id: "follow-my-plan", title: T("Follow the plan I made with my care team", "Seguir el plan que hice con mi equipo", "Swiv plan mwen te fè ak ekip swen mwen"), frequency: true, defaultTarget: 5 }
    ]
  },
  MOBILITY: {
    category: "ACTIVITY_MOBILITY",
    displayName: T("Move around more easily", "Mejorar mi movilidad", "Deplase pi fasil"),
    suggestedActions: [
      { id: "gentle-movement-personal", title: T("Do gentle movement that feels safe", "Hacer movimientos suaves que se sientan seguros", "Fè mouvman dous ki santi yo an sekirite"), frequency: true, defaultTarget: 3 }
    ]
  },
  DAILY_INDEPENDENCE: {
    category: "INDEPENDENCE",
    displayName: T("Be more independent in my daily activities", "Tener más independencia en mis actividades diarias", "Vin pi endepandan nan aktivite chak jou mwen"),
    suggestedActions: [
      { id: "do-one-thing-myself", title: T("Do one everyday task myself", "Hacer yo mismo una tarea cotidiana", "Fè yon travay chak jou pou kont mwen"), frequency: true, defaultTarget: 3 },
      { id: "ask-for-support-personal", title: T("Ask for help when I need it", "Pedir ayuda cuando la necesite", "Mande èd lè m bezwen l"), frequency: false }
    ]
  },
  HEALTH_CONFIDENCE: {
    category: "EDUCATION",
    displayName: T("Feel more confident managing my health", "Sentirme más seguro manejando mi salud", "Santi m gen plis konfyans nan jere sante mwen"),
    suggestedActions: [
      { id: "learn-one-thing", title: T("Learn one thing about my health each week", "Aprender algo sobre mi salud cada semana", "Aprann yon bagay sou sante mwen chak semèn"), frequency: false },
      { id: "prepare-my-questions", title: T("Prepare my questions before an appointment", "Preparar mis preguntas antes de una cita", "Prepare kesyon m anvan yon randevou"), frequency: false }
    ]
  }
});

export const personalGoalTemplate = templateId =>
  (typeof templateId === "string" && PERSONAL_GOAL_TEMPLATES[templateId]) || null;

// The templates a patient is offered when they open "create my own goal" without saying anything
// yet. Deliberately short and deliberately ordinary: a list of fourteen outcome statements is a
// form, and the whole point was not to build a form.
export const STARTER_PERSONAL_GOAL_IDS = Object.freeze(["WALKING_ENDURANCE", "MORE_ACTIVE", "EATING_HABITS", "SLEEP_QUALITY", "MORE_ENERGY", "DAILY_INDEPENDENCE"]);

/* ===============================================================================================
   Telling a goal from an action
   =============================================================================================== */

export const GOAL_STATEMENT_KINDS = Object.freeze({
  EMPTY: "EMPTY",
  GOAL: "GOAL",
  ACTION: "ACTION",
  VAGUE: "VAGUE",
  CLINICAL_TARGET: "CLINICAL_TARGET",
  MEDICATION_CHANGE: "MEDICATION_CHANGE"
});

// Two normalisations, and the difference between them matters more than it looks.
//
// `clean` is what the patient WROTE: whitespace tidied, curly quotes straightened, accents intact.
// Everything this module hands back for storage or display goes through this one, because "Caminar
// más" is the patient's sentence and "Caminar mas" is a misspelling of it that we introduced.
//
// `lower` is what we MATCH on: accents removed, lowercased. A patient dictating in Spanish and a
// patient typing in Spanish do not produce the same bytes, and they must not produce different
// classifications.
const clean = value => String(value ?? "").replace(/[‘’ʼ´`]/g, "'").replace(/\s+/g, " ").trim();

// Deaccenting one character at a time keeps the string the same length, so an offset found in the
// matching copy still points at the same place in the patient's own words. Decomposing the whole
// string with NFD does not: it makes it longer, and slicing by that offset cuts the sentence in
// the wrong place.
const deaccent = value => [...value].map(character => character.normalize("NFD")[0]).join("");

const lower = value => deaccent(clean(value)).toLowerCase();

// "I want to", "me gustaria", "mwen vle" and friends. Stripped so the stored sentence reads as a
// goal or a step rather than as a report of the patient wanting one.
const INTENT_PREFIX = /^(yo |i |mwen )?(quiero|querria|quisiera|me gustaria|me gustara|necesito|deseo|espero|busco|pretendo|want to|wanna|would like to|would love to|d like to|i'd like to|like to|need to|hope to|wish to|am trying to|trying to|plan to|vle|ta renmen|bezwen)\s+/i;
const LEADING_THAT = /^(que|to|pou|de)\s+/i;

// "I want to walk 20 minutes" becomes "Walk 20 minutes": the wanting is what brought them here and
// does not belong in the record. The prefix is FOUND on the deaccented copy and CUT from the
// patient's own text, so "Quiero caminar más" comes back as "caminar más" rather than "caminar mas".
const stripIntent = value => {
  let text = clean(value);
  for (let pass = 0; pass < 3; pass += 1) {
    const match = deaccent(text).match(INTENT_PREFIX);
    if (!match) break;
    text = text.slice(match[0].length);
  }
  const trailing = deaccent(text).match(LEADING_THAT);
  return (trailing ? text.slice(trailing[0].length) : text).trim();
};

const sentenceCase = value => (value ? value.charAt(0).toUpperCase() + value.slice(1) : "");

// A number attached to a unit of time, distance, repetition or amount. This is the single
// strongest signal that a patient is describing a routine rather than a destination.
const QUANTITY = /\b(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|youn|de|twa|kat|senk)\s*(minutos?|minutes?|minit|horas?|hours?|ed?tan|veces|vez|times?|fwa|dias?|days?|jou|semanas?|weeks?|semen|cuadras?|blocks?|pasos?|steps?|vasos?|glasses?|litros?|liters?|libras?|pounds?|lbs?|kilos?|kg)\b/i;
const CADENCE = /\b(cada dia|todos los dias|diariamente|a diario|daily|every day|each day|chak jou|por semana|a la semana|per week|a week|each week|chak seme|por dia|per day|al dia|veces|times a|fwa nan|three times|twice|dos veces|tres veces)\b/i;

// Verbs that name something the patient DOES. A verb on its own is not enough — "walk with my wife
// without stopping" is an outcome — so these only decide the answer together with a quantity, a
// cadence, or the absence of any outcome wording at all.
const BEHAVIOUR_VERB = /\b(caminar|camino|andar|correr|trotar|ejercitarme|hacer ejercicio|entrenar|nadar|montar|tomar|tomarme|beber|comer|cocinar|reducir|bajar el consumo|medir|medirme|revisar|chequear|checar|pesarme|acostarme|levantarme|dormirme|estirar|anotar|registrar|apuntar|walk|walking|run|jog|exercise|work out|workout|swim|take|drink|eat|cook|reduce|cut back|cut down|measure|check|weigh|log|track|record|stretch|go to bed|get up|mache|kouri|fe egzesis|naje|pran|bwe|manje|diminye|mezire|tcheke|peze|ekri)\b/i;

// Wording that names a state, a capability or a feeling. These are what a goal sounds like.
const OUTCOME_WORD = /\b(mejorar|mejore|mejoria|alcanzar|lograr|conseguir|mantener|mantenerme|sentirme|sentir|poder|pueda|puedo|capacidad|resistencia|independencia|movilidad|autonomia|calidad|energia|control de mi|manejo de mis|estar mas|ser mas|volver a|seguir|disfrutar|participar|asistir|improve|improving|better at|be able|able to|reach|achieve|maintain|keep my|stay|feel|feeling|confidence|confident|stamina|endurance|independence|mobility|quality|energy|manage my|management|get back to|enjoy|take part|attend|amelyore|rive|kenbe|santi|ka |kapasite|endepandans|mobilite|kalite|eneji|jere)\b/i;

// "I want to feel better" with nothing after it. A real wish, and not yet a goal: the patient has
// to say what would be different, or the record ends up holding a sentence nobody can work on.
const VAGUE_STATEMENT = /^(sentirme mejor|estar mejor|estar bien|encontrarme mejor|mejorar|mejorarme|ponerme bien|estar mas sano|estar mas saludable|ser mas sano|ser saludable|estar en forma|cuidarme|cuidarme mas|feel better|be better|get better|be well|be healthy|get healthy|be healthier|get healthier|improve|improve myself|be in shape|get in shape|take care of myself|santi m pi byen|vin pi byen|an sante)$/i;

// Anything asking for a specific clinical number, or naming a clinical parameter as the thing to
// change. A personal goal never becomes one of these, in any wording.
const CLINICAL_MEASURE_PATTERNS = Object.freeze([
  { measure: "BLOOD_PRESSURE", templateId: "BLOOD_PRESSURE_CONFIDENCE", pattern: /\b(presion(?: arterial)?|tension arterial|blood pressure|bp|tansyon)\b/i },
  { measure: "GLUCOSE", templateId: "GLUCOSE_CONFIDENCE", pattern: /\b(azucar|glucosa|glicemia|a1c|hba1c|hemoglobina glicosilada|blood sugar|glucose|sik nan san)\b/i },
  { measure: "CHOLESTEROL", templateId: "HEALTHIER_WEIGHT", pattern: /\b(colesterol|ldl|hdl|trigliceridos|cholesterol|triglycerides)\b/i },
  { measure: "WEIGHT", templateId: "HEALTHIER_WEIGHT", pattern: /\b(peso|pesar|adelgazar|engordar|libras|lbs?|kilos|weight|weigh|lose weight|pounds|pwa)\b/i }
]);

const NUMERIC_VALUE = /\b\d{2,3}\s*\/\s*\d{2,3}\b|\b\d+([.,]\d+)?\s*(mmhg|mg\/dl|mg|kg|libras|lbs?|pounds|puntos|points|%|por ciento|percent)\b|\b\d+([.,]\d+)?\b/i;
const TARGET_WORD = /\b(objetivo|meta de|target|goal of|que (?:mi|el|la)\b[^.]{0,30}\bsea|bajar (?:a|hasta)|llegar a|get (?:it |my [a-z ]+)?(?:to|down to)|keep it (?:at|under|below)|mantener(?:la|lo)? en|en \d)\b/i;

const MEDICATION_WORD = /\b(medicament|medicamento|medicina|medicinas|pastilla|pastillas|remedio|remedios|pildora|dosis|receta|tratamiento|medication|medicine|meds?|pill|pills|dose|dosage|prescription|treatment|medikaman|grenn|doz)\b/i;
const STOP_OR_CHANGE = /\b(dejar de|dejar|quitar|suspender|parar de|abandonar|reducir la dosis|bajar la dosis|subir la dosis|cambiar (?:la|mi|de)? ?(?:dosis|medicament|medicina|tratamiento)|no tomar|no seguir tomando|stop|quit|come off|get off|discontinue|skip|cut (?:my )?dose|lower (?:my )?dose|raise (?:my )?dose|change (?:my )?(?:dose|medication|treatment)|sispann|kite)\b/i;

// Which outcome an action most plausibly serves. Order matters: the first pattern that matches
// wins, so the specific ones sit above the general ones. A behaviour that matches nothing gets no
// proposal at all, and the patient is asked instead — which is the honest outcome, not a failure.
const ACTION_TO_GOAL = Object.freeze([
  { templateId: "MEDICATION_MANAGEMENT", pattern: /\b(medicament|medicina|medicinas|pastilla|pastillas|remedio|dosis|medication|medicine|meds?|pill|pills|medikaman|grenn)\b/i },
  { templateId: "BLOOD_PRESSURE_CONFIDENCE", pattern: /\b(presion|tension arterial|blood pressure|\bbp\b|tansyon)\b/i },
  { templateId: "GLUCOSE_CONFIDENCE", pattern: /\b(azucar|glucosa|glicemia|a1c|blood sugar|glucose|sik nan san)\b/i },
  { templateId: "EATING_HABITS", pattern: /\b(sal|sodio|comer|comida|comidas|alimenta|verdura|vegetal|vegetales|fruta|dieta|azucares|grasa|salt|sodium|eat|eating|food|meal|meals|vegetable|veggies|fruit|diet|fat|sugar intake|agua|water|sel|manje|legim)\b/i },
  { templateId: "SLEEP_QUALITY", pattern: /\b(dormir|sueno|acostarme|siesta|sleep|sleeping|bed|nap|domi)\b/i },
  { templateId: "HEALTHIER_WEIGHT", pattern: /\b(pesarme|peso|adelgazar|libras|kilos|weigh|weight|pounds|pwa)\b/i },
  { templateId: "WALKING_ENDURANCE", pattern: /\b(caminar|camino|caminata|andar|pasos|cuadras|walk|walking|steps|blocks|mache)\b/i },
  { templateId: "MORE_ACTIVE", pattern: /\b(ejercicio|ejercitarme|entrenar|gimnasio|correr|trotar|nadar|bicicleta|moverme|actividad fisica|exercise|work out|workout|gym|run|jog|swim|bike|move more|activity|egzesis|aktivite)\b/i },
  { templateId: "MOBILITY", pattern: /\b(estirar|estiramiento|equilibrio|levantarme|bastón|baston|andador|stretch|balance|get up|stand up|cane|walker)\b/i },
  { templateId: "DAILY_INDEPENDENCE", pattern: /\b(bañarme|banarme|vestirme|cocinar|limpiar|compras|mandados|solo|sola|bathe|shower|dress|cook|clean|shopping|errands|by myself|alone|pou kont mwen)\b/i },
  { templateId: "HEALTH_CONFIDENCE", pattern: /\b(aprender|entender|preguntas|anotar|apuntar|learn|understand|questions|write down|aprann|konprann)\b/i }
]);

// The frequency vocabulary the plan already speaks, so a step EMMI creates and a step the plan
// builder creates carry the same value and render the same label.
const frequencyFromText = text => {
  if (/\b(cada dia|todos los dias|diariamente|a diario|daily|every day|each day|chak jou)\b/i.test(text)) return "daily";
  if (CADENCE.test(text)) return "few-days";
  return "";
};

const matchTemplate = (text, patterns) => patterns.find(entry => entry.pattern.test(text)) || null;

const proposal = templateId => {
  const template = personalGoalTemplate(templateId);
  return template ? { templateId, title: template.displayName, category: template.category } : null;
};

const CLARIFY = Object.freeze({
  VAGUE: T(
    "What would you like to be able to do, or to feel, that is different?",
    "¿Qué le gustaría poder hacer o sentir diferente?",
    "Kisa ou ta renmen ka fè, oswa santi, ki diferan?"
  ),
  ACTION_NO_MATCH: T(
    "We can use that as part of your plan. What would you like it to help you reach?",
    "Podemos usar eso como parte de su plan. ¿Qué le gustaría conseguir con eso?",
    "Nou ka sèvi ak sa nan plan ou. Kisa ou ta renmen sa ede w rive?"
  )
});

const CARE_TEAM_TOPIC = Object.freeze({
  MEDICATION: T(
    "Ask whether I should keep taking this medication",
    "Preguntar si debo continuar con este medicamento",
    "Mande si mwen ta dwe kontinye pran medikaman sa a"
  ),
  BLOOD_PRESSURE: T(
    "Ask what blood pressure numbers are right for me",
    "Preguntar qué números de presión son adecuados para mí",
    "Mande ki chif tansyon ki bon pou mwen"
  ),
  GLUCOSE: T(
    "Ask what blood sugar numbers are right for me",
    "Preguntar qué números de azúcar son adecuados para mí",
    "Mande ki chif sik ki bon pou mwen"
  ),
  CHOLESTEROL: T(
    "Ask what cholesterol numbers are right for me",
    "Preguntar qué números de colesterol son adecuados para mí",
    "Mande ki chif kolestewol ki bon pou mwen"
  ),
  WEIGHT: T(
    "Ask what weight is right for me",
    "Preguntar qué peso es adecuado para mí",
    "Mande ki pwa ki bon pou mwen"
  )
});

/**
 * What kind of thing the patient just described, and what we can safely offer them.
 *
 * Never returns a decision that has been acted on: everything here is a PROPOSAL. `goal` is what we
 * would suggest as the outcome, `action` is what we would suggest as the step, `clarify` is the one
 * short question to ask when neither is safe to assume. The caller — a screen or EMMI — is what
 * puts it in front of the patient, and only the patient's acceptance turns any of it into a record.
 */
export function classifyGoalStatement(statement) {
  const original = clean(statement);
  if (!original) return { kind: GOAL_STATEMENT_KINDS.EMPTY, text: "", goal: null, action: null, clarify: null, careTeamTopic: null, measure: "", signals: [] };

  const stripped = stripIntent(original);
  const text = lower(stripped);
  const signals = [];

  // 1. Medication changes are never a goal and never an action, in any wording. The patient's
  //    concern is real and is answered with an outcome they can safely own plus a question for the
  //    person who can actually answer it.
  if (MEDICATION_WORD.test(text) && STOP_OR_CHANGE.test(text)) {
    return {
      kind: GOAL_STATEMENT_KINDS.MEDICATION_CHANGE,
      text: sentenceCase(stripped),
      goal: proposal("TREATMENT_CONFIDENCE"),
      action: null,
      clarify: null,
      careTeamTopic: CARE_TEAM_TOPIC.MEDICATION,
      measure: "MEDICATION",
      signals: ["medication", "stop_or_change"]
    };
  }

  // 2. A clinical number the patient wants changed. The wish becomes an outcome they can work on;
  //    the number stays with the care team, and we say so rather than quietly dropping it.
  const clinical = matchTemplate(text, CLINICAL_MEASURE_PATTERNS);
  if (clinical && (NUMERIC_VALUE.test(text) || TARGET_WORD.test(text))) {
    return {
      kind: GOAL_STATEMENT_KINDS.CLINICAL_TARGET,
      text: sentenceCase(stripped),
      goal: proposal(clinical.templateId),
      action: null,
      clarify: null,
      careTeamTopic: CARE_TEAM_TOPIC[clinical.measure] || null,
      measure: clinical.measure,
      signals: ["clinical_measure", NUMERIC_VALUE.test(text) ? "numeric_value" : "target_word"]
    };
  }

  // 3. "I want to feel better." A wish, not yet something anyone can work on.
  if (VAGUE_STATEMENT.test(text)) {
    return { kind: GOAL_STATEMENT_KINDS.VAGUE, text: sentenceCase(stripped), goal: null, action: null, clarify: CLARIFY.VAGUE, careTeamTopic: null, measure: "", signals: ["vague"] };
  }

  // 4. A behaviour. A quantity or a cadence settles it on its own — "20 minutes", "four times a
  //    week" — and a bare behaviour verb settles it only when nothing in the sentence names an
  //    outcome, so "walk with my wife without getting tired" stays the goal it is.
  const quantity = QUANTITY.test(text);
  const cadence = CADENCE.test(text);
  const behaviour = BEHAVIOUR_VERB.test(text);
  const outcome = OUTCOME_WORD.test(text);
  if (quantity) signals.push("quantity");
  if (cadence) signals.push("cadence");
  if (behaviour) signals.push("behaviour_verb");
  if (outcome) signals.push("outcome_word");

  if ((quantity || cadence || (behaviour && !outcome))) {
    const matched = matchTemplate(text, ACTION_TO_GOAL);
    return {
      kind: GOAL_STATEMENT_KINDS.ACTION,
      text: sentenceCase(stripped),
      goal: matched ? proposal(matched.templateId) : null,
      action: { title: sentenceCase(stripped), frequency: frequencyFromText(text) },
      clarify: matched ? null : CLARIFY.ACTION_NO_MATCH,
      careTeamTopic: null,
      measure: "",
      signals
    };
  }

  // 5. Everything else is treated as the patient's own outcome, in their own words. A template is
  //    attached when one clearly fits, for the icon and for suggested steps — but the wording stays
  //    theirs. Replacing a perfectly good sentence with ours would be the app deciding what they
  //    meant, which is the failure this whole module exists to avoid.
  const related = matchTemplate(text, ACTION_TO_GOAL);
  return {
    kind: GOAL_STATEMENT_KINDS.GOAL,
    text: sentenceCase(stripped),
    goal: { templateId: related?.templateId || "", title: sentenceCase(stripped), category: related ? personalGoalTemplate(related.templateId)?.category || "GENERIC" : "GENERIC" },
    action: null,
    clarify: null,
    careTeamTopic: null,
    measure: "",
    signals
  };
}

// Whether a sentence may be stored as the NAME of a goal. This is the gate every write goes
// through — the screen, the edit form and the EMMI tool — so no path can save a schedule as a goal,
// however it was worded and whichever surface it arrived on.
export const statementIsUsableAsGoalTitle = statement => {
  const verdict = classifyGoalStatement(statement);
  return verdict.kind === GOAL_STATEMENT_KINDS.GOAL;
};
