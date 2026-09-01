// What the patient is actually looking at, in a shape EMMI can reason over.
//
// THE PROBLEM THIS FILE EXISTS FOR
//
// Until now EMMI's idea of "where the patient is" was `state.screen` — a route name. That was
// enough while every route was one screen with one question on it. It stopped being enough the
// moment a route grew a flow inside it: appointment coordination, and then barrier resolution,
// put fifteen distinct steps behind the single string "APPOINTMENT_DETAIL". A patient standing in
// front of three ride options and a patient confirming a booking looked identical to EMMI, and
// neither of them had their options, their prices or their selection anywhere in the context. So
// "which one has more room?" had nothing to resolve against and "is it booked yet?" had no way to
// be right.
//
// THE CONTRACT
//
// A view descriptor answers six questions, and nothing else:
//
//   WHERE      viewId, title, flow.step        which of the many views behind this route
//   WHAT FOR   task                            the one thing the patient is here to do
//   WHAT IS ON SCREEN   facts                  the values they can see
//   WHAT CAN BE CHOSEN  options                addressable by id AND by ordinal ("the first one")
//   WHAT IS CHOSEN      selection              chosen is not the same as done
//   WHAT HAPPENED       completed / pending    what is really finished and what is still owed
//   WHAT CAN BE DONE    actions                the controls that exist right now
//
// Two rules make this safe rather than merely useful:
//
//   1. `completed` is the ONLY place an action may be reported as done. A selection lives in
//      `selection`, never in `completed`, which is what stops EMMI answering "yes" to "is it
//      booked?" while the patient is still on the review screen.
//   2. every `option` and `action` carries the CSS selector of the real control on screen, and the
//      shell drops any whose control is not currently in the document. EMMI therefore cannot offer,
//      or take, an action the patient could not take themselves at that exact moment.
//
// EXTENSIBILITY
//
// A screen with no describer still gets a descriptor, built from what it rendered — its heading,
// its lead paragraph and its controls. That is the floor, and it means a feature added tomorrow is
// never invisible to EMMI. A feature that wants EMMI to reason about its data registers a
// describer and gets the rest of the contract.
//
// Pure module: no DOM globals of its own (a document is passed in), no app state, no storage.

export const EMMI_VIEW_CONTEXT_VERSION = "emmi-view-context-v1";

// What pressing a control does to the world. The model is told these mean different things, and
// performViewAction refuses the last two without an explicit confirmation in the same turn.
export const VIEW_ACTION_KINDS = Object.freeze({
  // Changes what is highlighted. Reversible, costs nothing, needs no confirmation.
  SELECT: "SELECT",
  // Moves between screens or steps. Reversible.
  NAVIGATE: "NAVIGATE",
  // Opens a field the patient has to type into. EMMI cannot type for them.
  INPUT: "INPUT",
  // Changes something outside the app: books, sends, reschedules, saves. Explicit confirmation.
  CONFIRM: "CONFIRM",
  // Removes or cancels something that exists. Explicit confirmation, and never inferred.
  DESTRUCTIVE: "DESTRUCTIVE"
});

// The kinds EMMI may never take without the patient saying so in that turn.
export const CONFIRMATION_REQUIRED_KINDS = Object.freeze([VIEW_ACTION_KINDS.CONFIRM, VIEW_ACTION_KINDS.DESTRUCTIVE]);

// The descriptor is sent to a model on every change, so it is capped rather than complete. These
// are generous for every real screen in the product and small enough that a step change costs a
// sentence rather than a page.
const LIMITS = Object.freeze({ options: 10, facts: 12, actions: 12, completed: 8, pending: 8, label: 120, task: 320, detail: 160 });

const text = (value, max = LIMITS.label) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const list = (value, max) => (Array.isArray(value) ? value : []).filter(Boolean).slice(0, max);

/* ------------------------------------------------------------------------ normalisation --- */

const normalizeOption = (option, index) => ({
  id: text(option.id, 80),
  // Ordinals are part of the contract, not a convenience: "the first one" and "the second time"
  // are how a patient speaks about a list, and a model cannot count a JSON array reliably enough
  // to be trusted with a booking.
  ordinal: index + 1,
  label: text(option.label),
  detail: text(option.detail, LIMITS.detail),
  selected: option.selected === true,
  selector: text(option.selector, 200),
  // Free-form, describer-owned. Whatever a patient might compare on: price, seats, time.
  attributes: option.attributes && typeof option.attributes === "object"
    ? Object.fromEntries(Object.entries(option.attributes).slice(0, 8).map(([key, value]) => [text(key, 40), typeof value === "number" ? value : text(value, 80)]))
    : {}
});

const normalizeAction = action => ({
  id: text(action.id, 80),
  label: text(action.label),
  kind: VIEW_ACTION_KINDS[action.kind] || VIEW_ACTION_KINDS.NAVIGATE,
  selector: text(action.selector, 200),
  // What the patient ends up with if they press it. Lets EMMI explain a button rather than read it.
  effect: text(action.effect, LIMITS.detail),
  // An INPUT action reads one box before it acts. Naming that box is what lets EMMI supply the
  // words a patient spoke — "add that I want to ask about my dizziness" — rather than only being
  // able to describe a button it cannot use. A form with several fields deliberately has no
  // inputSelector: EMMI asks the patient to fill it in instead of guessing five values.
  inputSelector: text(action.inputSelector, 200),
  inputHint: text(action.inputHint, LIMITS.detail)
});

const normalizeEntry = entry => ({ id: text(entry.id, 80), label: text(entry.label), detail: text(entry.detail, LIMITS.detail) });

// The one constructor. Everything that reaches a model goes through it, so a describer cannot
// leak an unbounded string, an unexpected shape or a field nobody accounted for.
export function normalizeEmmiView(raw = {}) {
  const options = list(raw.options, LIMITS.options).map(normalizeOption);
  const selected = options.find(option => option.selected) || null;
  const explicit = raw.selection ? normalizeEntry(raw.selection) : null;
  return Object.freeze({
    version: EMMI_VIEW_CONTEXT_VERSION,
    // DESCRIBER means a person wrote down what this screen is and what each control does. DOM
    // means this module read the markup and inferred the rest from the verbs in the action names.
    // The second is enough to explain a screen and never enough to authorise acting on it: a
    // guess that reads "pause my goal" as navigation is a guess that must not be able to press it.
    source: raw.source === "DOM" ? "DOM" : "DESCRIBER",
    viewId: text(raw.viewId, 80) || "UNKNOWN_VIEW",
    screenId: text(raw.screenId, 80),
    title: text(raw.title),
    task: text(raw.task, LIMITS.task),
    flow: raw.flow
      ? Object.freeze({
        id: text(raw.flow.id, 60),
        name: text(raw.flow.name, 80),
        step: text(raw.flow.step, 60),
        stepNumber: Number.isFinite(raw.flow.stepNumber) ? raw.flow.stepNumber : null,
        totalSteps: Number.isFinite(raw.flow.totalSteps) ? raw.flow.totalSteps : null
      })
      : null,
    facts: Object.freeze(list(raw.facts, LIMITS.facts).map(fact => Object.freeze({ label: text(fact.label, 80), value: text(fact.value, LIMITS.detail) }))),
    options: Object.freeze(options.map(Object.freeze)),
    // A describer may name the selection explicitly; otherwise it is whichever option says it is.
    // Never inferred from `completed`: those are two different facts and collapsing them is the
    // bug this whole contract exists to prevent.
    selection: explicit || (selected ? Object.freeze({ id: selected.id, label: selected.label, detail: selected.detail }) : null),
    completed: Object.freeze(list(raw.completed, LIMITS.completed).map(entry => Object.freeze(normalizeEntry(entry)))),
    pending: Object.freeze(list(raw.pending, LIMITS.pending).map(entry => Object.freeze(normalizeEntry(entry)))),
    actions: Object.freeze(list(raw.actions, LIMITS.actions).map(action => Object.freeze(normalizeAction(action)))),
    // Anything the describer wants EMMI to know that is not one of the above — kept small and
    // deliberately last, so it never becomes the place features dump state instead of modelling it.
    notes: Object.freeze(list(raw.notes, 4).map(note => text(note, LIMITS.detail)))
  });
}

/* --------------------------------------------------------------------------- signature ---- */

// What "the view changed" means. Deliberately semantic rather than a hash of the whole object:
// a re-render that produces identical meaning must not cost a context push, and a changed price,
// a changed selection or a completed action must.
export function emmiViewSignature(view) {
  if (!view) return "";
  return [
    view.viewId,
    view.flow?.step || "",
    view.title,
    view.options.map(option => `${option.id}:${option.selected ? 1 : 0}`).join(","),
    view.selection?.id || "",
    view.completed.map(entry => entry.id).join(","),
    view.pending.map(entry => entry.id).join(","),
    view.facts.map(fact => `${fact.label}=${fact.value}`).join("|"),
    view.actions.map(action => action.id).join(",")
  ].join("§");
}

/* ------------------------------------------------------- the floor: any screen at all ----- */

const CONTROL_SELECTOR = "button[data-action], a[data-action], button[data-assistant-action]";

// Which of the five kinds a control is, read off the verb in its own action name. This is the one
// place in the system that guesses, and it guesses CONSERVATIVELY: anything that reads like it
// removes or commits something is treated as needing confirmation, and a name nobody recognises is
// NAVIGATE, which is the kind that can do the least.
const KIND_BY_PATTERN = Object.freeze([
  [/cancel|remove|delete|decline|revoke|clear|stop|pause/i, VIEW_ACTION_KINDS.DESTRUCTIVE],
  // Everything that changes the patient's record, their plan, or somebody else's day. The four
  // that were missing — pausing a goal, marking one achieved, changing its priority, asking for a
  // callback — were being read as navigation, which is the permissive direction to be wrong in.
  [/confirm|submit|book|reserve|send|save|share|apply|accept|invite|complete|create|achiev|priority|request|callback|reactivate|mark/i, VIEW_ACTION_KINDS.CONFIRM],
  [/select|choose|answer|toggle|option|slot|need|pick/i, VIEW_ACTION_KINDS.SELECT],
  [/add|edit|write/i, VIEW_ACTION_KINDS.INPUT]
]);

export const inferViewActionKind = actionName => {
  const value = String(actionName || "");
  for (const [pattern, kind] of KIND_BY_PATTERN) if (pattern.test(value)) return kind;
  return VIEW_ACTION_KINDS.NAVIGATE;
};

// CSS.escape is in every browser this product runs in, and is absent from some DOM
// implementations. Falling back rather than throwing matters because this function is on the path
// that builds EMMI's whole picture of the screen: an exception here would leave her blind rather
// than merely leave one selector unescaped.
const escapeAttribute = value => {
  const raw = String(value ?? "");
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(raw);
  return raw.replace(/["\\]/g, "\\$&");
};

// A selector that finds this exact control again. Built from the attributes the control already
// carries rather than from an index, so it survives a re-render that reorders the list.
export const viewControlSelector = element => {
  const action = element.getAttribute("data-action") || element.getAttribute("data-assistant-action");
  if (!action) return "";
  const attribute = element.getAttribute("data-action") ? "data-action" : "data-assistant-action";
  const qualifiers = ["data-option-id", "data-slot-id", "data-contact-id", "data-barrier-reason", "data-need", "data-return-choice", "data-answer", "data-step", "data-appointment-id", "data-resolution-id", "data-field", "data-value", "data-tab", "data-invite-id", "data-slot", "data-barrier-type", "data-topic-index", "data-medication-id", "data-reason", "data-pickup-at"]
    .map(name => (element.hasAttribute(name) ? `[${name}="${escapeAttribute(element.getAttribute(name))}"]` : ""))
    .join("");
  return `[${attribute}="${escapeAttribute(action)}"]${qualifiers}`;
};

const controlLabel = element => String(element.textContent || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();

// Every screen gets a descriptor even with no describer written for it: its heading, its lead, and
// the controls it actually rendered. Criterion 19 in the brief — the solution has to keep working
// for features nobody has thought of yet — is this function.
export function describeEmmiViewFromDom(root, { screenId = "", viewId = "", locale = "en" } = {}) {
  if (!root) return null;
  const heading = root.querySelector("h1");
  const lead = root.querySelector(".appointment-lead, .subtitle, .screen-lead, p");
  const controls = [...root.querySelectorAll(CONTROL_SELECTOR)]
    .filter(element => !element.disabled && !element.closest("[aria-hidden='true']"))
    .filter(element => controlLabel(element));
  return normalizeEmmiView({
    source: "DOM",
    viewId: viewId || `SCREEN_${screenId}`,
    screenId,
    title: heading?.textContent || "",
    task: lead?.textContent || "",
    actions: controls.map(element => ({
      id: element.getAttribute("data-action") || element.getAttribute("data-assistant-action") || "",
      label: controlLabel(element),
      kind: inferViewActionKind(element.getAttribute("data-action") || element.getAttribute("data-assistant-action")),
      selector: viewControlSelector(element)
    })),
    notes: [locale ? "" : ""].filter(Boolean)
  });
}

/* ------------------------------------------------------------------- reality checking ----- */

// A describer names the controls it expects. This drops any that are not on screen right now, so
// EMMI can never offer or press something the patient could not. The describers stay declarative
// and the document stays the authority.
export function withLiveControls(view, root) {
  if (!view || !root) return view;
  const alive = selector => {
    if (!selector) return false;
    try { return Boolean(root.querySelector(selector)); } catch { return false; }
  };
  return normalizeEmmiView({
    ...view,
    options: view.options.filter(option => !option.selector || alive(option.selector)),
    actions: view.actions.filter(action => alive(action.selector))
  });
}

// The two controls EMMI is asked to press most often, resolved the way a patient would resolve
// them. Ordinals and ids only: matching on a label would make a translated screen behave
// differently from an English one.
export function findViewOption(view, reference) {
  if (!view) return null;
  const value = String(reference ?? "").trim();
  if (!value) return null;
  const byId = view.options.find(option => option.id === value);
  if (byId) return byId;
  const ordinal = Number(value);
  return Number.isInteger(ordinal) ? view.options.find(option => option.ordinal === ordinal) || null : null;
}

export function findViewAction(view, actionId) {
  if (!view) return null;
  const value = String(actionId ?? "").trim();
  return view.actions.find(action => action.id === value) || null;
}

/* ----------------------------------------------------------------- what the model reads --- */

// The descriptor as it is handed to a model. Selectors are stripped: they are how the shell finds
// a control, and a model that saw them would start inventing them.
export function emmiViewForModel(view) {
  if (!view) return null;
  return {
    viewId: view.viewId,
    screen: view.screenId,
    title: view.title,
    whatThePatientMustDoHere: view.task,
    ...(view.flow ? { flow: view.flow } : {}),
    ...(view.facts.length ? { onScreen: view.facts.map(fact => ({ [fact.label]: fact.value })) } : {}),
    ...(view.options.length ? { choices: view.options.map(option => ({ n: option.ordinal, id: option.id, label: option.label, detail: option.detail, selected: option.selected, ...option.attributes })) } : {}),
    selected: view.selection,
    // Named the way the rule reads, so the distinction survives being summarised into a context
    // window: what is actually done, and what is still owed.
    alreadyDone: view.completed.map(entry => entry.label),
    stillPending: view.pending.map(entry => entry.label),
    // False on a screen nobody has described. EMMI can still name the button the patient should
    // press — which is most of what "guide by voice" means — but may not press it herself.
    youMayPressTheseYourself: view.source !== "DOM",
    ...(view.actions.length ? { availableActions: view.actions.map(action => ({ id: action.id, label: action.label, kind: action.kind, ...(action.effect ? { effect: action.effect } : {}), ...(action.inputSelector ? { acceptsText: true, textIsFor: action.inputHint } : {}) })) } : {}),
    ...(view.notes.length ? { notes: view.notes } : {})
  };
}
