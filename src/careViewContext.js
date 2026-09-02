// What EMMI sees on the rest of the product: goals, medications, the Care Circle, the blood
// pressure monitor, and the enrollment journey.
//
// src/appointmentViewContext.js did this for appointment coordination. This file finishes the job,
// and the reason it is a separate file is the same reason that one is: a describer belongs next to
// the thing it describes, and a single module holding every screen in the product would be a
// module nobody could keep true.
//
// The same three-way rule decides where every fact goes:
//
//   `selection`  the patient has picked it. Nothing has happened yet.
//   `pending`    it still has to happen, and EMMI must say so.
//   `completed`  a real source said it happened. ONLY here may EMMI say it is done.
//
// WHY THIS FILE EXISTS AT ALL
//
// Without a describer a screen still reaches EMMI, through the DOM floor in
// src/emmi/viewContext.js — its heading, its lead and its controls. That is enough to explain a
// screen and deliberately not enough to act on one, because the floor infers what each control
// does from the verb in its name and an inference read "pause my goal" as navigation. Writing the
// describer is how a screen earns the right to be acted on: it is the moment somebody decides,
// in writing, what each control really does.
//
// ENROLLMENT IS DIFFERENT ON PURPOSE
//
// The enrollment screens already have per-screen purpose, benefit and action text, authored and
// translated, in src/emmi/narrative.js — it is what EMMI narrates out loud. Writing a second
// version here would create two answers to "what do I do on this screen" that drift apart. So the
// enrollment describer reads that one instead, and this file adds only what narration has no
// concept of: what is already done, and what is still owed.
//
// Pure module: no DOM, no app state, no storage.

import { NARRATIVE_OBJECTIVES } from "./emmi/narrative.js";

const T = (en, es, ht) => Object.freeze({ en, es, ht });
const L = (value, locale = "en") => (typeof value === "string" ? value : value?.[locale] || value?.en || "");

const action = (id, label, kind, { selector = "", effect = "", inputSelector = "", inputHint = "" } = {}) =>
  ({ id, label, kind, selector: selector || `[data-action="${id}"]`, effect, inputSelector, inputHint });

const entry = (id, label, detail = "") => ({ id, label, detail });

/* =========================================================================================
   Goals
   ========================================================================================= */

const GOAL_TASK = Object.freeze({
  SUMMARY: T(
    "This is one of your goals: what you chose, the steps in your plan, and how it is going.",
    "Esta es una de sus metas: lo que eligió, los pasos de su plan y cómo va.",
    "Sa a se youn nan objektif ou yo: sa ou chwazi, etap plan ou an, ak kijan l ap mache."
  ),
  CHECK_IN: T(
    "Say how you feel this goal is going. Your answer is not a clinical measurement.",
    "Diga cómo siente que va esta meta. Su respuesta no es una medición clínica.",
    "Di kijan ou santi objektif sa a ap mache. Repons ou se pa yon mezi klinik."
  ),
  BARRIERS: T(
    "Choose what is making this goal hard, and I will try to help with it.",
    "Elija qué dificulta esta meta y trataré de ayudarle con eso.",
    "Chwazi sa k ap fè objektif sa a difisil, epi m ap eseye ede w."
  ),
  BARRIER_DESCRIBE: T(
    "Say in your own words what is making this hard.",
    "Diga con sus palabras qué lo dificulta.",
    "Di nan mo pa ou kisa k ap fè sa difisil."
  ),
  BARRIER_HELP: T(
    "This is the help I can offer for that difficulty. Nothing is decided until you choose.",
    "Esta es la ayuda que puedo ofrecer para esa dificultad. Nada se decide hasta que elija.",
    "Sa a se èd mwen ka ofri pou difikilte sa a. Anyen pa deside jiskaske ou chwazi."
  ),
  BARRIER_FOLLOW_UP: T(
    "Say whether the help we tried actually worked.",
    "Diga si la ayuda que probamos realmente funcionó.",
    "Di si èd nou te eseye a te mache vre."
  ),
  READINGS: T(
    "These are the readings received for your care. They come from your monitor, not from me.",
    "Estas son las lecturas recibidas para su cuidado. Vienen de su monitor, no de mí.",
    "Sa yo se lekti nou resevwa pou swen ou. Yo soti nan monitè ou, pa nan mwen."
  ),
  WHY_EDIT: T(
    "Write why this goal matters to you. It is yours, and nobody else decides it.",
    "Escriba por qué esta meta le importa. Es suya, y nadie más la decide.",
    "Ekri poukisa objektif sa a enpòtan pou ou. Se pa ou, epi pèsonn lòt pa deside l."
  ),
  ACHIEVE_CONFIRM: T(
    "Confirm whether to mark this goal achieved. This changes your personal goal only, never a clinical target.",
    "Confirme si marca esta meta como lograda. Esto solo cambia su meta personal, nunca un objetivo clínico.",
    "Konfime si w make objektif sa a kòm reyalize. Sa chanje objektif pèsonèl ou sèlman, pa yon sib klinik."
  ),
  EDIT_TITLE: T(
    "Change how this goal is written. The steps in the plan do not change.",
    "Cambie cómo está escrita esta meta. Los pasos del plan no cambian.",
    "Chanje kijan objektif sa a ekri. Etap nan plan an pa chanje."
  ),
  ADD_ACTION: T(
    "Add one step to the plan. A step is what the patient will do; the goal stays as it is.",
    "Agregue un paso al plan. Un paso es lo que el paciente hará; la meta queda como está.",
    "Ajoute yon etap nan plan an. Yon etap se sa pasyan an ap fè; objektif la rete jan li ye."
  ),
  EDIT_ACTION: T(
    "Change one step of the plan. Changing a step never changes the goal.",
    "Cambie un paso del plan. Cambiar un paso nunca cambia la meta.",
    "Chanje yon etap nan plan an. Chanje yon etap pa janm chanje objektif la."
  ),
  DELETE_CONFIRM: T(
    "Confirm whether to remove this personal goal and its steps. Nothing in the care plan changes.",
    "Confirme si elimina esta meta personal y sus pasos. Nada del plan de cuidado cambia.",
    "Konfime si w retire objektif pèsonèl sa a ak etap li yo. Anyen nan plan swen an pa chanje."
  )
});

// The plan steps, as things that can be pointed at and completed. "Mark that one done" needs a
// numbered list; "which ones do I still have?" needs the completed/pending split.
//
// A removed step stays on the record for its history and is gone from here: offering EMMI a step
// the patient deleted is offering it a control that is not on the screen.
const goalActionOptions = (goal, locale) => (goal?.actions || [])
  .filter(item => item?.id && item?.title && item.status !== "REMOVED")
  .map(item => ({
    id: item.id,
    label: item.title,
    detail: item.frequency || "",
    selected: false,
    // A DEVICE-verified step is completed by a reading arriving, never by anyone saying so, so it
    // deliberately has no control for EMMI to press.
    selector: item.verificationMethod === "DEVICE" ? "" : `[data-action="complete-goal-action"][data-action-id="${item.id}"]`,
    attributes: { verifiedBy: item.verificationMethod || "PATIENT", status: item.status || "" }
  }));

// The controls that are really on screen for THIS step of the goal, and nothing else.
//
// Listing every control a goal can ever have was already slightly untrue — "yes, mark it achieved"
// only exists on the confirmation screen — and adding the plan editors made it plainly false. The
// contract EMMI works from says availableActions is everything the patient can do from here and
// nothing else exists, so the list is built per view. It also keeps the list inside the size the
// context allows, which a growing pile of every-control-forever had quietly outgrown.
function goalDetailActions({ view, goal, personal, t }) {
  const back = action("goal-detail-back", t("Back", "Atrás", "Retounen"), "NAVIGATE");
  const stepInput = {
    inputSelector: '#goal-action-form [name="actionTitle"]',
    inputHint: "the step in the patient's own words"
  };
  if (view === "CHECK_IN") {
    return [action("goal-checkin-response", t("Answer how the goal is going", "Responder cómo va la meta", "Reponn kijan objektif la ap mache"), "SELECT"), back];
  }
  if (view === "ACHIEVE_CONFIRM") {
    return [action("confirm-goal-achieved", t("Yes, mark it achieved", "Sí, marcarla como lograda", "Wi, make l kòm reyalize"), "CONFIRM", { effect: t("Changes the patient's own goal only, never a clinical target", "Solo cambia la meta del paciente, nunca un objetivo clínico", "Chanje objektif pasyan an sèlman, pa yon sib klinik") }), back];
  }
  if (view === "WHY_EDIT") {
    return [action("save-goal-why", t("Save why this matters", "Guardar por qué importa", "Sove poukisa sa enpòtan"), "CONFIRM", { inputSelector: '#goal-why-form [name="whyItMatters"]', inputHint: "why this goal matters, in the patient's own words" }), back];
  }
  if (view === "ADD_ACTION") {
    return [action("save-goal-action", t("Add this step", "Agregar este paso", "Ajoute etap sa a"), "CONFIRM", { ...stepInput, effect: t("Adds a step to the plan. The goal does not change.", "Agrega un paso al plan. La meta no cambia.", "Ajoute yon etap nan plan an. Objektif la pa chanje.") }), back];
  }
  if (view === "EDIT_ACTION") {
    return [
      action("update-goal-action", t("Save this step", "Guardar este paso", "Sove etap sa a"), "CONFIRM", { ...stepInput, effect: t("Changes one step. The goal does not change.", "Cambia un paso. La meta no cambia.", "Chanje yon etap. Objektif la pa chanje.") }),
      action("remove-goal-action", t("Remove this step", "Quitar este paso", "Retire etap sa a"), "DESTRUCTIVE", { effect: t("Removes that step from the plan. The goal stays.", "Quita ese paso del plan. La meta se mantiene.", "Retire etap sa a nan plan an. Objektif la rete.") }),
      back
    ];
  }
  if (view === "EDIT_TITLE") {
    return [
      action("save-goal-title", t("Save the goal wording", "Guardar la redacción de la meta", "Sove mo objektif la"), "CONFIRM", {
        inputSelector: '#goal-title-form [name="goalTitle"]',
        inputHint: "the goal as an outcome, in the patient's own words",
        effect: t("Changes the goal wording only. The steps stay as they are.", "Cambia solo la redacción de la meta. Los pasos quedan igual.", "Chanje sèlman mo objektif la. Etap yo rete jan yo ye.")
      }),
      back
    ];
  }
  if (view === "DELETE_CONFIRM") {
    return [action("confirm-delete-goal", t("Yes, remove this goal", "Sí, eliminar esta meta", "Wi, retire objektif sa a"), "DESTRUCTIVE", { effect: t("Removes the patient's own goal and its steps", "Elimina la meta propia del paciente y sus pasos", "Retire pwòp objektif pasyan an ak etap li yo") }), back];
  }
  if (["BARRIERS", "BARRIER_DESCRIBE", "BARRIER_HELP", "BARRIER_FOLLOW_UP", "READINGS"].includes(view)) {
    return [action("open-goal-barriers", t("Say what is making this hard", "Decir qué lo dificulta", "Di sa k ap fè sa difisil"), "NAVIGATE"), back];
  }
  return [
    action("open-goal-checkin", t("Say how this goal is going", "Decir cómo va esta meta", "Di kijan objektif sa a ap mache"), "NAVIGATE"),
    action("open-goal-barriers", t("Say what is making this hard", "Decir qué lo dificulta", "Di sa k ap fè sa difisil"), "NAVIGATE"),
    action("complete-goal-action", t("Report a step as done", "Registrar un paso como hecho", "Rapòte yon etap kòm fèt"), "CONFIRM", { effect: t("Records that the patient did it today", "Registra que el paciente lo hizo hoy", "Anrejistre ke pasyan an fè l jodi a") }),
    // The plan, edited as a plan: one step at a time, without reopening the whole flow. Changing a
    // step and changing the goal are deliberately different controls, so "make the walk 20 minutes"
    // cannot reach the sentence the patient is working toward.
    action("open-add-goal-action", t("Add a step to the plan", "Agregar un paso al plan", "Ajoute yon etap nan plan an"), "NAVIGATE"),
    action("edit-goal-action", t("Change one step", "Cambiar un paso", "Chanje yon etap"), "NAVIGATE"),
    action("remove-goal-action", t("Remove a step", "Quitar un paso", "Retire yon etap"), "DESTRUCTIVE", { effect: t("Removes that step from the plan. The goal stays.", "Quita ese paso del plan. La meta se mantiene.", "Retire etap sa a nan plan an. Objektif la rete.") }),
    // Everything under here changes the patient's own goal, so none of it is navigation.
    goal.status === "PAUSED"
      ? action("reactivate-goal", t("Restart this goal", "Reanudar esta meta", "Rekòmanse objektif sa a"), "CONFIRM")
      : action("pause-goal", t("Pause this goal", "Pausar esta meta", "Mete objektif sa a an poz"), "DESTRUCTIVE", { effect: t("Stops this goal until you restart it", "Detiene esta meta hasta que la reanude", "Sispann objektif sa a jiskaske ou rekòmanse l") }),
    action("change-goal-priority", t("Change which goal matters most", "Cambiar qué meta importa más", "Chanje ki objektif ki pi enpòtan"), "CONFIRM"),
    action("goal-mark-achieved", t("Mark this goal achieved", "Marcar esta meta como lograda", "Make objektif sa a kòm reyalize"), "CONFIRM", { effect: t("Changes the patient's own goal only, never a clinical target", "Solo cambia la meta del paciente, nunca un objetivo clínico", "Chanje objektif pasyan an sèlman, pa yon sib klinik") }),
    // Only what the patient wrote is theirs to reword or remove. On a care plan goal these controls
    // are not hidden — they do not exist, and the screen has none either.
    ...(personal
      ? [
        action("edit-goal-title", t("Change how the goal is written", "Cambiar cómo está escrita la meta", "Chanje kijan objektif la ekri"), "NAVIGATE"),
        action("edit-goal-contribution", t("Say whether it helps with a plan goal", "Decir si ayuda con una meta del plan", "Di si li ede ak yon objektif plan"), "NAVIGATE"),
        action("delete-goal", t("Remove this goal", "Eliminar esta meta", "Retire objektif sa a"), "NAVIGATE")
      ]
      : []),
    action("goal-detail-to-list", t("Back to My Goals", "Volver a Mis metas", "Retounen nan Objektif mwen"), "NAVIGATE")
  ];
}

export function describeGoalView({ screen = "", detailView = "", flowStep = "", goal = null, goals = [], locale = "en", personalGoalDraft = null, recommendedGoals = [], starterGoals = [] } = {}) {
  const t = (en, es, ht) => L(T(en, es, ht), locale);

  // Adding a goal: pick one the care plan suggests, or say one of your own.
  if (screen === "GOALS" && flowStep === "ADD") {
    return {
      viewId: "GOAL_ADD",
      screenId: screen,
      title: t("Add another goal", "Agregar otra meta", "Ajoute yon lòt objektif"),
      task: t(
        "Choose a goal your care team suggests, or say one of your own. Nothing is added until you choose.",
        "Elija una meta que sugiere su equipo, o diga una suya. No se agrega nada hasta que elija.",
        "Chwazi yon objektif ekip ou sijere, oswa di youn pa ou. Anyen pa ajoute jiskaske ou chwazi."
      ),
      flow: { id: "GOALS", name: t("Adding a goal", "Agregar una meta", "Ajoute yon objektif"), step: "ADD" },
      options: (recommendedGoals || []).filter(item => item?.id).map(item => ({
        id: item.id,
        label: item.label || "",
        detail: t("Suggested by your care plan", "Sugerida por su plan de cuidado", "Plan swen ou sijere l"),
        selected: false,
        selector: `[data-action="add-recommended-goal"][data-goal-type="${item.id}"]`,
        attributes: { goalKind: "CARE_PLAN" }
      })),
      actions: [
        action("add-recommended-goal", t("Add a suggested goal", "Agregar una meta sugerida", "Ajoute yon objektif yo sijere"), "CONFIRM", { effect: t("Adds that goal to your list", "Agrega esa meta a su lista", "Ajoute objektif sa a nan lis ou") }),
        action("create-my-own-goal", t("Set a goal of my own", "Definir una meta propia", "Mete yon objektif pa m"), "NAVIGATE"),
        action("goals-flow-back", t("Back", "Atrás", "Retounen"), "NAVIGATE")
      ],
      notes: [t(
        "A goal is what the patient wants to reach. Anything they will do — a walk, a dose, a reading — is a step in their plan, never a goal.",
        "Una meta es lo que el paciente quiere conseguir. Algo que hará — caminar, una dosis, una medición — es un paso, nunca una meta.",
        "Yon objektif se sa pasyan an vle rive. Yon bagay l ap fè — yon mache, yon doz, yon lekti — se yon etap, pa yon objektif."
      )]
    };
  }

  // The one question. EMMI may type the patient's own words into the box, which is what makes this
  // work by voice: the patient says it, and the same field a keyboard would fill gets filled.
  if (screen === "GOALS" && flowStep === "PERSONAL_CAPTURE") {
    return {
      viewId: "GOAL_PERSONAL_CAPTURE",
      screenId: screen,
      title: t("Create my own goal", "Crear mi propia meta", "Kreye pwòp objektif mwen"),
      task: personalGoalDraft?.clarify
        || t(
          "Say what you would like to improve in your health or your daily life. One sentence is enough.",
          "Diga qué le gustaría mejorar en su salud o en su vida diaria. Con una frase basta.",
          "Di sa ou ta renmen amelyore nan sante ou oswa nan lavi chak jou ou. Yon fraz sifi."
        ),
      flow: { id: "GOALS", name: t("Setting my own goal", "Definir mi propia meta", "Mete pwòp objektif mwen"), step: "PERSONAL_CAPTURE" },
      facts: personalGoalDraft?.statement ? [{ label: t("What you said", "Lo que dijo", "Sa ou di"), value: personalGoalDraft.statement }] : [],
      options: (starterGoals || []).filter(item => item?.id).map(item => ({
        id: item.id,
        label: item.label || "",
        detail: "",
        selected: false,
        selector: `[data-action="personal-goal-starter"][data-template-id="${item.id}"]`,
        attributes: { goalKind: "PERSONAL" }
      })),
      pending: [entry("NOT_SAVED", t("Nothing has been saved yet", "Todavía no se ha guardado nada", "Anyen poko sove"))],
      actions: [
        action("personal-goal-review", t("Use what the patient said", "Usar lo que dijo el paciente", "Sèvi ak sa pasyan an di"), "INPUT", {
          inputSelector: '#personal-goal-form [name="goalStatement"]',
          inputHint: "the patient's own words about what they want to improve",
          effect: t("Shows what we understood. Saves nothing.", "Muestra lo que entendimos. No guarda nada.", "Montre sa nou konprann. Li pa sove anyen.")
        }),
        action("personal-goal-starter", t("Start from a suggested goal", "Empezar con una meta sugerida", "Kòmanse ak yon objektif yo sijere"), "SELECT"),
        action("goals-flow-back", t("Back", "Atrás", "Retounen"), "NAVIGATE")
      ],
      notes: [t(
        "If they describe something they will do, that is a step. Offer the outcome it serves; let them accept it, change it, or reword it.",
        "Si describe algo que hará, eso es un paso. Ofrezca el resultado al que sirve y deje que lo acepte, lo cambie o lo reformule.",
        "Si li dekri yon bagay l ap fè, sa se yon etap. Ofri rezilta li sèvi a epi kite l aksepte l, chanje l, oswa di l yon lòt jan."
      )]
    };
  }

  // The proposal, before anything is written. Two boxes on purpose: the goal, and the step.
  if (screen === "GOALS" && flowStep === "PERSONAL_CONFIRM") {
    const draft = personalGoalDraft || {};
    return {
      viewId: "GOAL_PERSONAL_CONFIRM",
      screenId: screen,
      title: t("Does this sound right?", "¿Le parece bien así?", "Èske sa sanble kòrèk?"),
      task: t(
        "Check the goal and the first step before saving. Both can be changed, and neither exists until you save.",
        "Revise la meta y el primer paso antes de guardar. Puede cambiar ambos, y ninguno existe hasta que guarde.",
        "Gade objektif la ak premye etap la anvan ou sove. Ou ka chanje toude, epi ni youn pa egziste jiskaske ou sove."
      ),
      flow: { id: "GOALS", name: t("Setting my own goal", "Definir mi propia meta", "Mete pwòp objektif mwen"), step: "PERSONAL_CONFIRM" },
      facts: [
        { label: t("Goal — what I want to reach", "Meta — lo que quiero conseguir", "Objektif — sa mwen vle rive"), value: draft.title || draft.statement || "" },
        draft.actionTitle ? { label: t("Step — what I will do", "Paso — lo que haré", "Etap — sa m ap fè"), value: draft.actionTitle } : null,
        draft.careTeamTopic ? { label: t("To ask my care team", "Para preguntar a mi equipo", "Pou mande ekip swen mwen"), value: draft.careTeamTopic } : null
      ].filter(Boolean),
      pending: [entry("NOT_SAVED", t("Nothing has been saved yet", "Todavía no se ha guardado nada", "Anyen poko sove"))],
      actions: [
        action("personal-goal-save", t("Save this goal", "Guardar esta meta", "Sove objektif sa a"), "CONFIRM", { effect: t("Creates the goal and its first step", "Crea la meta y su primer paso", "Kreye objektif la ak premye etap li") }),
        action("personal-goal-explain", t("Say it differently", "Decirlo de otra forma", "Di l yon lòt jan"), "NAVIGATE"),
        action("personal-goal-cancel", t("Cancel", "Cancelar", "Anile"), "NAVIGATE")
      ],
      notes: [
        draft.measure
          ? t(
            "Clinical numbers and medications belong to the care team. Saving this goal changes no target, no dose and no treatment.",
            "Los números clínicos y los medicamentos son del equipo de atención. Guardar esta meta no cambia objetivos, dosis ni tratamiento.",
            "Chif klinik ak medikaman se pou ekip swen an. Sove objektif sa a pa chanje okenn sib, okenn doz ni okenn tretman."
          )
          : t(
            "A personal goal is the patient's own. The care team can see it, and it changes nothing clinical.",
            "Una meta personal es del paciente. El equipo de atención puede verla, y no cambia nada clínico.",
            "Yon objektif pèsonèl se pou pasyan an. Ekip swen an ka wè l, epi li pa chanje anyen klinik."
          )
      ]
    };
  }

  if (screen === "GOALS") {
    return {
      viewId: `GOAL_FLOW_${flowStep || "DISCOVERY"}`,
      screenId: screen,
      title: t("Choosing your goals", "Elegir sus metas", "Chwazi objektif ou yo"),
      task: flowStep === "PRIORITY"
        ? t("Pick which goal matters most right now. You can change this later.", "Elija qué meta importa más ahora. Puede cambiarlo después.", "Chwazi ki objektif ki pi enpòtan kounye a. Ou ka chanje sa pita.")
        : flowStep === "PLAN_ACTIONS"
          ? t("Choose the practical steps you want in your plan.", "Elija los pasos prácticos que quiere en su plan.", "Chwazi etap pratik ou vle nan plan ou.")
          : t("Choose the goals that matter to you. Your care team keeps the clinical targets.", "Elija las metas que le importan. Su equipo de cuidado conserva los objetivos clínicos.", "Chwazi objektif ki enpòtan pou ou. Ekip swen ou kenbe sib klinik yo."),
      flow: { id: "GOALS", name: t("Choosing your goals", "Elegir sus metas", "Chwazi objektif ou yo"), step: flowStep || "DISCOVERY" },
      actions: [action("advance", t("Continue", "Continuar", "Kontinye"), "NAVIGATE")]
    };
  }

  if (screen !== "MY_GOALS") return null;

  // The list of goals, before one is opened.
  if (!goal) {
    return {
      viewId: "GOAL_LIST",
      screenId: screen,
      title: t("My goals", "Mis metas", "Objektif mwen yo"),
      task: t("Open a goal to see your plan, how it is going, and anything making it hard.", "Abra una meta para ver su plan, cómo va y qué la dificulta.", "Louvri yon objektif pou wè plan ou, kijan l ap mache, ak sa k ap fè l difisil."),
      options: (goals || []).filter(item => item?.id).map(item => ({
        id: item.id,
        label: item.title || "",
        detail: item.priority && item.priority !== "NONE" ? item.priority : "",
        selected: false,
        selector: `[data-action="view-goal"]`,
        // "What are my goals?" has two answers on this screen, and they are not interchangeable:
        // the plan asked for one set and the patient wrote the other.
        attributes: { status: item.status || "", planStatus: item.planStatus || "", goalKind: item.goalKind || "CARE_PLAN" }
      })),
      actions: [
        action("view-goal", t("Open a goal", "Abrir una meta", "Louvri yon objektif"), "NAVIGATE"),
        action("add-another-goal", t("Add another goal", "Agregar otra meta", "Ajoute yon lòt objektif"), "NAVIGATE"),
        action("back", t("Back", "Atrás", "Retounen"), "NAVIGATE")
      ],
      notes: [t(
        "Goals come from two places: the care plan and the patient. Say which is which, and never present a step from a plan as a goal.",
        "Las metas vienen de dos lugares: el plan de cuidado y el paciente. Diga cuál es cuál, y nunca presente un paso como una meta.",
        "Objektif soti nan de kote: plan swen an ak pasyan an. Di kilès ki kilès, epi pa janm prezante yon etap kòm yon objektif."
      )]
    };
  }

  const view = detailView || "SUMMARY";
  const steps = (goal.actions || []).filter(item => item?.status !== "REMOVED");
  const done = steps.filter(item => item.status === "COMPLETED");
  const open = steps.filter(item => item.status !== "COMPLETED");
  const barriers = (goal.barriers || []).filter(item => item?.status && item.status !== "RESOLVED");
  const personal = goal.goalKind === "PERSONAL";

  return {
    viewId: `GOAL_${view}`,
    screenId: screen,
    title: goal.title || t("My goal", "Mi meta", "Objektif mwen"),
    task: L(GOAL_TASK[view] || GOAL_TASK.SUMMARY, locale),
    facts: [
      { label: t("Goal — what I want to reach", "Meta — lo que quiero conseguir", "Objektif — sa mwen vle rive"), value: goal.title || "" },
      // Which kind of goal this is decides what may be changed here, so it is a fact on the screen
      // rather than something the model works out from the wording.
      {
        label: t("This goal comes from", "Esta meta viene de", "Objektif sa a soti nan"),
        value: personal
          ? t("The patient. They can reword it, change its steps, or remove it.", "El paciente. Puede reescribirla, cambiar sus pasos o eliminarla.", "Pasyan an. Li ka reekri l, chanje etap li yo, oswa retire l.")
          : t("Their care plan. The wording, the baseline and the targets are the care team's; the steps are the patient's.", "Su plan de cuidado. La redacción, la línea base y los objetivos son del equipo; los pasos son del paciente.", "Plan swen li. Mo yo, pwen depa a ak sib yo se pou ekip la; etap yo se pou pasyan an.")
      },
      // Reported only when the patient said it. Absent means they did not, never that we could not
      // work it out — EMMI must not fill that silence with a relationship of its own.
      goal.contributesToTitle ? { label: t("The patient said this helps with", "El paciente dijo que esto le ayuda con", "Pasyan an di sa ede ak"), value: goal.contributesToTitle } : null,
      goal.priority && goal.priority !== "NONE" ? { label: t("Priority", "Prioridad", "Priyorite"), value: goal.priority } : null,
      steps.length ? { label: t("Steps in the plan", "Pasos del plan", "Etap nan plan an"), value: String(steps.length) } : null,
      goal.latestReading ? { label: t("Latest reading", "Última lectura", "Dènye lekti"), value: String(goal.latestReading.display || goal.latestReading.value || "") } : null,
      goal.clinicalTarget ? { label: t("Care team target", "Objetivo del equipo", "Sib ekip swen"), value: String(goal.clinicalTarget.display || goal.clinicalTarget.value || "") } : null
    ].filter(Boolean),
    options: view === "SUMMARY" ? goalActionOptions(goal, locale) : [],
    completed: [
      ...done.map(item => entry(`STEP_${item.id}`, item.title)),
      goal.whyItMatters ? entry("WHY", t("You wrote why this matters to you", "Escribió por qué esto le importa", "Ou ekri poukisa sa enpòtan pou ou"), goal.whyItMatters) : null
    ].filter(Boolean),
    pending: [
      ...open.map(item => entry(`STEP_${item.id}`, item.title)),
      ...barriers.map(item => entry(`BARRIER_${item.id}`, t(`Something is making this hard: ${item.category}`, `Algo lo dificulta: ${item.category}`, `Yon bagay ap fè sa difisil: ${item.category}`)))
    ],
    actions: goalDetailActions({ view, goal, personal, t }),
    notes: [
      t(
        "A goal is what the patient wants to reach; a step is what they do about it. Changing one never changes the other.",
        "Una meta es lo que el paciente quiere conseguir; un paso es lo que hará. Cambiar uno nunca cambia el otro.",
        "Yon objektif se sa pasyan an vle rive; yon etap se sa l ap fè. Chanje youn pa janm chanje lòt la."
      ),
      personal
        ? t(
          "This goal is the patient's own. It never changes a clinical target, a medication or the care plan.",
          "Esta meta es del paciente. Nunca cambia un objetivo clínico, un medicamento ni el plan de cuidado.",
          "Objektif sa a se pou pasyan an. Li pa janm chanje yon sib klinik, yon medikaman ni plan swen an."
        )
        : t(
          "This goal is from the care plan. Its wording, baseline and targets are the care team's. The steps are the patient's to choose.",
          "Esta meta es del plan de cuidado. Su redacción, línea base y objetivos son del equipo. Los pasos los elige el paciente.",
          "Objektif sa a soti nan plan swen an. Mo li, pwen depa ak sib se pou ekip la. Se pasyan an ki chwazi etap yo."
        )
    ]
  };
}

/* =========================================================================================
   Medications and refills
   ========================================================================================= */

const REFILL_TASK = Object.freeze({
  REVIEW: T(
    "Confirm whether you still take this medication as written.",
    "Confirme si todavía toma este medicamento como está indicado.",
    "Konfime si ou toujou pran medikaman sa a jan li ekri a."
  ),
  CHANGE: T(
    "Say what changed. Telling me does not change the prescription — it goes to your care team.",
    "Diga qué cambió. Decírmelo no cambia la receta: va a su equipo de cuidado.",
    "Di sa ki chanje. Di m sa pa chanje preskripsyon an: li ale bay ekip swen ou."
  ),
  SUPPLY: T(
    "Say whether you are running low. The estimate is a reason to ask, not a fact.",
    "Diga si se le está acabando. La estimación es un motivo para preguntar, no un hecho.",
    "Di si l ap fini. Estimasyon an se yon rezon pou mande, se pa yon reyalite."
  ),
  CONFIRM: T(
    "Check the request before it is sent. Requested is not the same as approved or ready.",
    "Revise la solicitud antes de enviarla. Solicitado no es lo mismo que aprobado ni listo.",
    "Gade demann nan anvan li ale. Mande se pa menm bagay ak apwouve ni pare."
  ),
  STATUS: T(
    "This is where the request stands. Only the pharmacy can say it is ready.",
    "Aquí está la solicitud. Solo la farmacia puede decir que está lista.",
    "Men kote demann nan ye. Se sèlman famasi a ki ka di li pare."
  )
});

export function describeMedicationView({ screen = "", refillStep = "", medications = [], reviews = {}, refills = [], activeMedication = null, locale = "en" } = {}) {
  const t = (en, es, ht) => L(T(en, es, ht), locale);
  if (!["MY_MEDICATIONS", "MEDICATIONS_REVIEW"].includes(screen)) return null;
  const active = (medications || []).filter(item => item?.id && item.active !== false);

  // A refill in progress owns the screen: it is a flow with steps, and the medication list behind
  // it is not what the patient is being asked about.
  if (refillStep) {
    const open = (refills || []).filter(item => item?.status && !["COMPLETED", "CANCELED"].includes(item.status));
    return {
      viewId: `REFILL_${refillStep}`,
      screenId: screen,
      title: activeMedication?.name || t("Refill", "Resurtido", "Ranplisman"),
      task: L(REFILL_TASK[refillStep] || REFILL_TASK.REVIEW, locale),
      flow: { id: "REFILL", name: t("Asking about a refill", "Consultar un resurtido", "Mande yon ranplisman"), step: refillStep },
      facts: [
        activeMedication?.name ? { label: t("Medication", "Medicamento", "Medikaman"), value: [activeMedication.name, activeMedication.strength].filter(Boolean).join(" ") } : null,
        activeMedication?.details ? { label: t("As written", "Como está indicado", "Jan li ekri"), value: activeMedication.details } : null,
        activeMedication?.pharmacy?.name ? { label: t("Pharmacy", "Farmacia", "Famasi"), value: activeMedication.pharmacy.name } : null
      ].filter(Boolean),
      completed: open.filter(item => item.requestedAt).map(item => entry(`REQUESTED_${item.id}`, t("A refill request was sent", "Se envió una solicitud de resurtido", "Yon demann ranplisman voye"))),
      pending: [
        refillStep !== "STATUS" ? entry("NOT_REQUESTED", t("Nothing has been requested yet on this screen", "Todavía no se ha solicitado nada en esta pantalla", "Anyen poko mande nan ekran sa a")) : null,
        ...open.filter(item => item.requestedAt).map(item => entry(`WAITING_${item.id}`, t("The pharmacy has not said it is ready", "La farmacia no ha dicho que esté listo", "Famasi a poko di li pare")))
      ].filter(Boolean),
      actions: [
        action("refill-taking-answer", t("Answer whether you still take it", "Responder si todavía lo toma", "Reponn si ou toujou pran l"), "SELECT"),
        action("refill-change-answer", t("Say what changed", "Decir qué cambió", "Di sa ki chanje"), "SELECT"),
        action("refill-supply-answer", t("Say whether you are running low", "Decir si se le está acabando", "Di si l ap fini"), "SELECT"),
        action("confirm-refill-request", t("Send the refill request", "Enviar la solicitud de resurtido", "Voye demann ranplisman an"), "CONFIRM", { effect: t("Asks the pharmacy. It does not approve or renew anything", "Le pregunta a la farmacia. No aprueba ni renueva nada", "Mande famasi a. Li pa apwouve ni renouvle anyen") }),
        action("close-refill-flow", t("Close this", "Cerrar esto", "Fèmen sa"), "NAVIGATE")
      ],
      notes: [
        t(
          "A supply estimate is a reason to ask, never a fact. Requested is not approved, and approved is not ready for pickup. Never say a refill happened unless a real source said so.",
          "Una estimación de suministro es un motivo para preguntar, nunca un hecho. Solicitado no es aprobado, y aprobado no es listo para recoger. Nunca diga que hubo un resurtido si una fuente real no lo dijo.",
          "Yon estimasyon rezèv se yon rezon pou mande, pa yon reyalite. Mande se pa apwouve, epi apwouve se pa pare pou pran. Pa janm di yon ranplisman fèt si yon sous reyèl pa di sa."
        )
      ]
    };
  }

  const reviewed = Object.values(reviews || {}).filter(item => item?.reviewStatus && item.reviewStatus !== "UNREVIEWED");
  return {
    viewId: screen === "MEDICATIONS_REVIEW" ? "MEDICATION_REVIEW_LIST" : "MEDICATION_LIST",
    screenId: screen,
    title: t("My medications", "Mis medicamentos", "Medikaman mwen yo"),
    task: screen === "MEDICATIONS_REVIEW"
      ? t("Go through each medication and say whether it is still correct. Your answers do not change a prescription.", "Revise cada medicamento y diga si sigue correcto. Sus respuestas no cambian ninguna receta.", "Pase chak medikaman epi di si li toujou kòrèk. Repons ou pa chanje okenn preskripsyon.")
      : t("These are the medications on file. Open one to ask about a refill.", "Estos son los medicamentos registrados. Abra uno para consultar un resurtido.", "Sa yo se medikaman ki nan dosye a. Louvri youn pou mande yon ranplisman."),
    options: active.map(item => ({
      id: item.id,
      label: [item.name, item.strength].filter(Boolean).join(" "),
      detail: item.details || "",
      selected: false,
      selector: `[data-action="open-medication"][data-medication-id="${item.id}"]`,
      attributes: { reviewed: Boolean(reviews?.[item.id]?.reviewStatus && reviews[item.id].reviewStatus !== "UNREVIEWED") }
    })),
    completed: reviewed.map(item => entry(`REVIEWED_${item.medicationId}`, t("Reviewed", "Revisado", "Revize"), item.medicationId)),
    pending: active.filter(item => !reviews?.[item.id] || reviews[item.id].reviewStatus === "UNREVIEWED")
      .map(item => entry(`UNREVIEWED_${item.id}`, t(`Not reviewed yet: ${item.name}`, `Todavía sin revisar: ${item.name}`, `Poko revize: ${item.name}`))),
    actions: [
      action("open-my-medications", t("See my medications", "Ver mis medicamentos", "Gade medikaman mwen yo"), "NAVIGATE"),
      action("back-to-my-care", t("Back to My Care", "Volver a Mi cuidado", "Retounen nan Swen mwen"), "NAVIGATE")
    ],
    notes: [
      t(
        "You may never renew a prescription, change a dose or frequency, or tell the patient to take more or less. A patient report is information for the care team, not an edit to the medication order.",
        "Nunca puede renovar una receta, cambiar una dosis o frecuencia, ni decirle al paciente que tome más o menos. Lo que el paciente reporta es información para el equipo, no una edición de la orden.",
        "Ou pa ka janm renouvle yon preskripsyon, chanje yon dòz oswa yon frekans, ni di pasyan an pran plis oswa mwens. Sa pasyan an rapòte se enfòmasyon pou ekip la, se pa yon chanjman nan lòd la."
      )
    ]
  };
}

/* =========================================================================================
   Care Circle
   ========================================================================================= */

export function describeCareCircleView({ screen = "", members = [], invitePending = false, permissions = null, supportPersonName = "", locale = "en" } = {}) {
  const t = (en, es, ht) => L(T(en, es, ht), locale);
  const CARE_CIRCLE_SCREENS = ["CARE_CIRCLE_INVITE", "CARE_CIRCLE_INVITE_SENT", "CARE_CIRCLE_PERMISSIONS", "MY_CARE_CIRCLE", "CARE_CIRCLE_REMOVE_CONFIRMATION"];
  if (!CARE_CIRCLE_SCREENS.includes(screen)) return null;
  const granted = Object.entries(permissions || {}).filter(([, value]) => value === true).map(([key]) => key);

  const task = {
    CARE_CIRCLE_INVITE: t("Enter who you want to invite. Nothing is sent until you confirm.", "Escriba a quién quiere invitar. No se envía nada hasta que confirme.", "Ekri ki moun ou vle envite. Anyen pa ale jiskaske ou konfime."),
    CARE_CIRCLE_INVITE_SENT: t("The invitation is sent and waiting. They are not a member until they accept and verify.", "La invitación fue enviada y espera. No es miembro hasta que acepte y verifique.", "Envitasyon an voye epi l ap tann. Li pa yon manm jiskaske li aksepte epi verifye."),
    CARE_CIRCLE_PERMISSIONS: t("Choose what this person may help with. Nothing is shared that you do not choose here.", "Elija con qué puede ayudar esta persona. No se comparte nada que usted no elija aquí.", "Chwazi ak kisa moun sa a ka ede. Anyen pa pataje si ou pa chwazi l isit la."),
    MY_CARE_CIRCLE: t("These are the people helping you, and what each one may help with.", "Estas son las personas que le ayudan y con qué puede ayudar cada una.", "Sa yo se moun k ap ede w, ak ak kisa chak moun ka ede."),
    CARE_CIRCLE_REMOVE_CONFIRMATION: t("Confirm whether to remove this person from your Care Circle.", "Confirme si quita a esta persona de su Círculo de cuidado.", "Konfime si w retire moun sa a nan Sèk swen ou.")
  }[screen];

  return {
    viewId: `CARE_CIRCLE_${screen.replace("CARE_CIRCLE_", "").replace("MY_", "MY_")}`,
    screenId: screen,
    title: t("My Care Circle", "Mi Círculo de cuidado", "Sèk swen mwen"),
    task,
    options: (members || []).filter(item => item?.inviteId).map(item => ({
      id: item.inviteId,
      label: item.firstName || item.name || "",
      detail: item.relationship || "",
      selected: false,
      selector: `[data-action="manage-care-circle-member"][data-invite-id="${item.inviteId}"]`,
      attributes: { status: item.status || "" }
    })),
    facts: granted.length ? [{ label: t("They may help with", "Puede ayudar con", "Li ka ede ak"), value: granted.join(", ") }] : [],
    completed: (members || []).filter(item => item.status === "ACCEPTED").map(item => entry(`MEMBER_${item.inviteId}`, t(`${item.firstName || ""} accepted`, `${item.firstName || ""} aceptó`, `${item.firstName || ""} aksepte`))),
    pending: [
      invitePending || supportPersonName ? entry("INVITE_PENDING", t(`${supportPersonName || "They"} has not accepted yet`, `${supportPersonName || "Esa persona"} todavía no ha aceptado`, `${supportPersonName || "Moun nan"} poko aksepte`)) : null,
      ...(members || []).filter(item => item.status && item.status !== "ACCEPTED").map(item => entry(`PENDING_${item.inviteId}`, t(`${item.firstName || ""} has not accepted yet`, `${item.firstName || ""} todavía no ha aceptado`, `${item.firstName || ""} poko aksepte`)))
    ].filter(Boolean),
    actions: [
      action("save-care-circle", t("Send the invitation", "Enviar la invitación", "Voye envitasyon an"), "CONFIRM", { effect: t("Invites this person", "Invita a esta persona", "Envite moun sa a") }),
      action("care-circle-remove", t("Remove this person", "Quitar a esta persona", "Retire moun sa a"), "DESTRUCTIVE"),
      action("dismiss-care-circle-post", t("Not now", "Ahora no", "Pa kounye a"), "NAVIGATE"),
      action("back-to-my-care", t("Back to My Care", "Volver a Mi cuidado", "Retounen nan Swen mwen"), "NAVIGATE")
    ],
    notes: [
      t(
        "A Care Circle member is a support person, never a Personal Representative. They may never consent, sign, attest authority or make healthcare decisions, whatever permissions they hold.",
        "Un miembro del Círculo de cuidado es una persona de apoyo, nunca un representante personal. Nunca puede consentir, firmar, atestiguar autoridad ni tomar decisiones médicas, tenga los permisos que tenga.",
        "Yon manm Sèk swen se yon moun sipò, pa janm yon Reprezantan Pèsonèl. Li pa ka janm bay konsantman, siyen, atestè otorite ni pran desizyon swen sante, kèlkeswa pèmisyon li genyen."
      )
    ]
  };
}

/* =========================================================================================
   The blood pressure monitor
   ========================================================================================= */

const DEVICE_TASK = Object.freeze({
  ACCESS_BP_DEVICE_INFO: T(
    "Tell us about the monitor you have, or say you need one.",
    "Cuéntenos sobre el monitor que tiene, o diga que necesita uno.",
    "Di nou sou monitè ou genyen an, oswa di ou bezwen youn."
  ),
  ACCESS_BP_SHIPPING_ADDRESS: T(
    "Confirm where the monitor should be sent.",
    "Confirme a dónde debe enviarse el monitor.",
    "Konfime ki kote pou voye monitè a."
  ),
  ACCESS_BP_DEVICE_VERIFICATION: T(
    "We are checking whether a monitor is connected to your care. Nothing is needed from you.",
    "Estamos verificando si hay un monitor conectado a su cuidado. No necesita hacer nada.",
    "N ap tcheke si gen yon monitè ki konekte ak swen ou. Ou pa bezwen fè anyen."
  ),
  ACCESS_BP_DEVICE_RESULT: T(
    "This is what we found about your monitor. Say whether it is the one you have.",
    "Esto es lo que encontramos sobre su monitor. Diga si es el que tiene.",
    "Men sa nou jwenn sou monitè ou. Di si se sa ou genyen an."
  ),
  ACCESS_BP_GUIDED_SETUP: T(
    "Follow the steps to set the monitor up.",
    "Siga los pasos para configurar el monitor.",
    "Swiv etap yo pou konfigire monitè a."
  ),
  ACCESS_BP_MEASUREMENT: T(
    "Take a reading with your monitor. The reading arrives on its own — nobody types it in.",
    "Tome una lectura con su monitor. La lectura llega sola: nadie la escribe.",
    "Pran yon lekti ak monitè ou. Lekti a rive pou kont li: pèsonn pa ekri l."
  )
});

export function describeDeviceView({ screen = "", deviceVerificationStatus = "", device = null, baselineTaken = 0, baselineRemaining = 0, baselineRequired = 0, locale = "en" } = {}) {
  const t = (en, es, ht) => L(T(en, es, ht), locale);
  if (!DEVICE_TASK[screen]) return null;
  return {
    viewId: screen,
    screenId: screen,
    title: t("Your blood pressure monitor", "Su monitor de presión arterial", "Monitè tansyon ou"),
    task: L(DEVICE_TASK[screen], locale),
    facts: [
      device?.model ? { label: t("Monitor", "Monitor", "Monitè"), value: [device.vendor, device.model].filter(Boolean).join(" ") } : null,
      deviceVerificationStatus ? { label: t("Connection", "Conexión", "Koneksyon"), value: deviceVerificationStatus } : null,
      baselineRequired ? { label: t("Readings received", "Lecturas recibidas", "Lekti resevwa"), value: `${baselineTaken} / ${baselineRequired}` } : null
    ].filter(Boolean),
    completed: [
      deviceVerificationStatus === "ASSIGNED" || deviceVerificationStatus === "VERIFIED" ? entry("DEVICE_CONNECTED", t("A monitor is connected to your care", "Hay un monitor conectado a su cuidado", "Gen yon monitè ki konekte ak swen ou")) : null,
      baselineTaken > 0 ? entry("READINGS", t(`${baselineTaken} reading${baselineTaken === 1 ? "" : "s"} received`, `${baselineTaken} lectura${baselineTaken === 1 ? "" : "s"} recibida${baselineTaken === 1 ? "" : "s"}`, `${baselineTaken} lekti resevwa`)) : null
    ].filter(Boolean),
    pending: baselineRemaining > 0
      ? [entry("READINGS_LEFT", t(`${baselineRemaining} more reading${baselineRemaining === 1 ? "" : "s"} still needed`, `Faltan ${baselineRemaining} lectura${baselineRemaining === 1 ? "" : "s"}`, `Gen ${baselineRemaining} lekti ki manke`))]
      : [],
    actions: [
      action("advance", t("Continue", "Continuar", "Kontinye"), "NAVIGATE"),
      action("back", t("Back", "Atrás", "Retounen"), "NAVIGATE")
    ],
    notes: [
      t(
        "A reading comes from the monitor and never from anyone saying a number out loud. Never state a reading, a baseline or a milestone that a tool did not return.",
        "Una lectura viene del monitor y nunca de que alguien diga un número. Nunca indique una lectura, una línea base ni un hito que una herramienta no haya devuelto.",
        "Yon lekti soti nan monitè a, pa nan yon moun ki di yon chif. Pa janm bay yon lekti, yon baz ni yon etap zouti a pa retounen."
      )
    ]
  };
}

/* =========================================================================================
   Enrollment — read from the narration, never re-written
   ========================================================================================= */

export const ENROLLMENT_DESCRIBED_SCREENS = Object.freeze(Object.keys(NARRATIVE_OBJECTIVES));

// The enrollment screens are one-to-one with their route, which is why they never needed a view
// contract to be distinguishable. What they did need is the completed/pending split and a task
// sentence EMMI can answer "what do I do here?" with — and that sentence already exists, authored
// and translated, as the `action` line of the narration. Reading it here rather than writing a
// second one is what keeps the spoken guidance and the answered question saying the same thing.
export function describeEnrollmentView({ screen = "", enrollment = {}, locale = "en" } = {}) {
  const objective = NARRATIVE_OBJECTIVES[screen];
  if (!objective) return null;
  const t = (en, es, ht) => L(T(en, es, ht), locale);
  const {
    identityVerified = false, consentSaved = false, enrollmentComplete = false,
    canContinue = null, disclosureAcknowledged = false
  } = enrollment;

  return {
    viewId: `ENROLLMENT_${screen}`,
    screenId: screen,
    title: L(objective.summary, locale) || screen,
    // The instruction the patient is given out loud, so the spoken guide and the answer to
    // "what do I do here?" cannot say two different things.
    task: L(objective.action, locale) || L(objective.purpose, locale),
    completed: [
      identityVerified ? entry("IDENTITY", t("Your identity was verified", "Su identidad fue verificada", "Idantite ou verifye")) : null,
      disclosureAcknowledged ? entry("DISCLOSURE", t("You reviewed the important information", "Revisó la información importante", "Ou revize enfòmasyon enpòtan an")) : null,
      canContinue === true ? entry("CLEARED", t("You were cleared to keep going", "Puede continuar", "Ou ka kontinye")) : null,
      consentSaved ? entry("CONSENT", t("You gave consent", "Dio su consentimiento", "Ou bay konsantman")) : null,
      enrollmentComplete ? entry("ENROLLED", t("Enrollment is complete", "La inscripción está completa", "Enskripsyon an fini")) : null
    ].filter(Boolean),
    pending: [
      // The one distinction this journey must never blur, stated as a fact rather than left to
      // be inferred from which screen the patient happens to be on.
      canContinue === true && !enrollmentComplete
        ? entry("NOT_ENROLLED", t("Cleared to continue is NOT enrolled — there is still a choice to make", "Poder continuar NO es estar inscrito: todavía hay una decisión que tomar", "Ka kontinye se PA enskri: gen yon desizyon ki rete pou pran"))
        : null
    ].filter(Boolean),
    actions: [
      action("advance", t("Continue", "Continuar", "Kontinye"), "NAVIGATE"),
      action("back", t("Back", "Atrás", "Retounen"), "NAVIGATE"),
      action("help", t("Ask EMMI", "Preguntar a EMMI", "Mande EMMI"), "NAVIGATE")
    ],
    notes: [
      t(
        "You may explain consent, identity and authority, but never mark a checkbox, consent, sign, enroll or attest authority for anyone.",
        "Puede explicar el consentimiento, la identidad y la autoridad, pero nunca marcar una casilla, consentir, firmar, inscribir ni atestiguar autoridad por nadie.",
        "Ou ka eksplike konsantman, idantite ak otorite, men pa janm make yon kaz, bay konsantman, siyen, enskri ni atestè otorite pou pèsonn."
      )
    ]
  };
}
