// Patient Experience scroll policy.
//
// The app re-renders the whole screen into #app on every state change, which throws away the DOM
// the browser was anchoring scroll to. Left alone that lands the patient at the top of the page
// after every tap — confirm a medication and you are back at "Confirm your medications", hunting
// for where you were. This module makes that one decision, in one place, once per render:
// did the patient arrive somewhere new, stay where they were, or come back?
//
// The behaviours are semantic, not mechanical. Screens declare intent; nothing here guesses from
// pathnames or button labels.

export const SCROLL = Object.freeze({
  NEW_SCREEN: "NEW_SCREEN",         // a genuinely different screen — start at its beginning
  PRESERVE: "PRESERVE",             // same screen, content changed — hold the patient's place
  RESTORE: "RESTORE",               // back, or an overlay closing — return them where they were
  REVEAL_TARGET: "REVEAL_TARGET",   // move the least amount needed to expose one element
  REVEAL_ERROR: "REVEAL_ERROR",     // same, for the first thing that needs attention
  SAFETY_PRIORITY: "SAFETY_PRIORITY" // clinical urgency outranks continuity
});

export const NAVIGATION = Object.freeze({
  IN_PLACE: "IN_PLACE",
  FORWARD: "FORWARD",
  BACK: "BACK",
  OVERLAY_CLOSE: "OVERLAY_CLOSE"
});

const ANCHOR_ATTR = "data-scroll-anchor";
// Enough history for the deepest branch a patient can walk back out of, bounded so a long session
// cannot grow this without limit.
const MAX_REMEMBERED_SCREENS = 40;

// ---------------------------------------------------------------------------------------------
// Scroll container
//
// Today .shell is min-height:100dvh with overflow-y:visible, so the document scrolls and there is
// no inner scroller — verified rather than assumed. registerScrollContainer keeps that a decision
// instead of a hard-coded fact, so making the shell its own scroll area stays a one-line change.
// ---------------------------------------------------------------------------------------------

let container = null;

export function registerScrollContainer(element) {
  container = element instanceof HTMLElement ? element : null;
}

export function scrollContainer() {
  return container || document.scrollingElement || document.documentElement;
}

function viewportHeight() {
  return container ? container.clientHeight : window.innerHeight;
}

function currentTop() {
  return container ? container.scrollTop : (document.scrollingElement || document.documentElement).scrollTop;
}

function scrollTo(top, smooth = false) {
  const value = Math.max(0, Math.round(top));
  const behavior = smooth && !prefersReducedMotion() ? "smooth" : "auto";
  if (container) container.scrollTo({ top: value, behavior });
  else window.scrollTo({ top: value, behavior });
}

function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---------------------------------------------------------------------------------------------
// The resolver — a pure function, so the policy can be tested without a DOM
// ---------------------------------------------------------------------------------------------

export function resolveScrollBehavior({
  navigationType = NAVIGATION.IN_PLACE,
  sourceScreen = "",
  destinationScreen = "",
  errorAppeared = false,
  safetyInterruption = false,
  explicit = ""
} = {}) {
  // Clinical urgency is the one thing allowed to move a patient who did not ask to be moved.
  if (safetyInterruption) return SCROLL.SAFETY_PRIORITY;
  if (explicit) return explicit;
  if (navigationType === NAVIGATION.BACK || navigationType === NAVIGATION.OVERLAY_CLOSE) return SCROLL.RESTORE;
  // A changed screen is the definition of a new screen here: overlays, sheets and EMMI all leave
  // state.screen alone, so they never reach this branch.
  if (destinationScreen && destinationScreen !== sourceScreen) return SCROLL.NEW_SCREEN;
  // An error that was not on screen a moment ago is the one thing the patient now needs to see.
  if (errorAppeared) return SCROLL.REVEAL_ERROR;
  return SCROLL.PRESERVE;
}

// ---------------------------------------------------------------------------------------------
// Remembered positions, keyed by screen id
//
// Screen ids are opaque enum values from the state machine. No patient data goes into these keys.
// ---------------------------------------------------------------------------------------------

const remembered = new Map();

function remember(screenId, top) {
  if (!screenId) return;
  remembered.delete(screenId);
  remembered.set(screenId, top);
  while (remembered.size > MAX_REMEMBERED_SCREENS) remembered.delete(remembered.keys().next().value);
}

function recall(screenId) {
  return remembered.get(screenId) ?? 0;
}

export function forgetRememberedPositions() {
  remembered.clear();
}

// ---------------------------------------------------------------------------------------------
// Visual anchors
//
// Restoring scrollTop alone is not enough when the content itself changes height. Confirming a
// medication collapses its card; keeping the same number of pixels from the top would slide two
// hundred pixels of unrelated content under the patient's eyes. So we note where a real element
// sat before the render and put that element back where it was.
// ---------------------------------------------------------------------------------------------

function anchorNodes() {
  return Array.from(document.querySelectorAll(`[${ANCHOR_ATTR}]`));
}

// The anchor is the first anchored element the patient can actually see. Its key travels across
// the render; its position is what we restore.
export function captureAnchor() {
  const nodes = anchorNodes();
  if (!nodes.length) return null;
  const keys = nodes.map(node => node.getAttribute(ANCHOR_ATTR));
  const height = viewportHeight();
  for (let index = 0; index < nodes.length; index += 1) {
    const rect = nodes[index].getBoundingClientRect();
    if (rect.bottom <= 0) continue;
    if (rect.top >= height) break;
    return { key: keys[index], top: rect.top, index, keys };
  }
  return null;
}

// If the anchored item is gone — the patient removed it — hold on to its nearest surviving
// neighbour instead, so the list does not lurch.
function findAnchor(snapshot) {
  if (!snapshot) return null;
  const direct = document.querySelector(`[${ANCHOR_ATTR}="${CSS.escape(snapshot.key)}"]`);
  if (direct) return direct;
  const surviving = new Map(anchorNodes().map(node => [node.getAttribute(ANCHOR_ATTR), node]));
  if (!surviving.size) return null;
  const order = snapshot.keys || [];
  for (let step = 1; step < order.length; step += 1) {
    const after = order[snapshot.index + step];
    if (after && surviving.has(after)) return surviving.get(after);
    const before = order[snapshot.index - step];
    if (before && surviving.has(before)) return surviving.get(before);
  }
  return null;
}

function restoreWithAnchor(top, snapshot) {
  scrollTo(top);
  const node = findAnchor(snapshot);
  if (!node) return;
  const drift = node.getBoundingClientRect().top - snapshot.top;
  if (Math.abs(drift) < 1) return;
  scrollTo(top + drift);
}

// ---------------------------------------------------------------------------------------------
// Revealing a target
//
// "Reveal" means the smallest movement that exposes something, never a jump to the top. The sticky
// Continue bar and the floating EMMI pill sit over the bottom of the viewport, so targets carry
// scroll-margin in CSS and block:"nearest" respects it.
// ---------------------------------------------------------------------------------------------

export function revealElement(node, { smooth = true } = {}) {
  if (!node?.isConnected) return false;
  node.scrollIntoView({ block: "nearest", inline: "nearest", behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto" });
  return true;
}

// The screens carry one error message per form rather than per-field errors, so the first invalid
// control is the better target when there is one and the message is the fallback.
export function revealFirstError() {
  const invalid = document.querySelector('[aria-invalid="true"], .field.invalid');
  if (revealElement(invalid)) {
    invalid.focus?.({ preventScroll: true });
    return true;
  }
  const message = Array.from(document.querySelectorAll(".form-error, [role='alert']"))
    .find(node => node.textContent.trim());
  return revealElement(message);
}

// ---------------------------------------------------------------------------------------------
// Render lifecycle
//
// beforeRender runs while the old DOM is still up, so it can measure. afterRender runs once the
// new DOM is in place but before paint, so corrections are invisible.
// ---------------------------------------------------------------------------------------------

let pendingIntent = null;
let overlayTop = null;

// Screens ask for something other than the default by calling this before they trigger a render.
export function requestScroll(intent = {}) {
  pendingIntent = { ...pendingIntent, ...intent };
}

export function beforeRender(currentScreen) {
  const top = currentTop();
  remember(currentScreen, top);
  const snapshot = {
    sourceScreen: currentScreen,
    top,
    anchor: captureAnchor(),
    intent: pendingIntent || {}
  };
  pendingIntent = null;
  return snapshot;
}

export function afterRender(snapshot, destinationScreen, { errorAppeared = false } = {}) {
  const intent = snapshot?.intent || {};
  const behavior = resolveScrollBehavior({
    navigationType: intent.navigationType || NAVIGATION.IN_PLACE,
    sourceScreen: snapshot?.sourceScreen || "",
    destinationScreen,
    errorAppeared,
    safetyInterruption: Boolean(intent.safetyInterruption),
    explicit: intent.explicit || ""
  });

  switch (behavior) {
    case SCROLL.NEW_SCREEN:
    case SCROLL.SAFETY_PRIORITY:
      scrollTo(0);
      break;
    case SCROLL.RESTORE:
      scrollTo(intent.restoreTop ?? recall(destinationScreen));
      break;
    case SCROLL.REVEAL_ERROR:
      scrollTo(snapshot?.top ?? 0);
      revealFirstError();
      break;
    case SCROLL.REVEAL_TARGET:
      restoreWithAnchor(snapshot?.top ?? 0, snapshot?.anchor);
      if (intent.targetSelector) revealElement(document.querySelector(intent.targetSelector));
      break;
    default:
      restoreWithAnchor(snapshot?.top ?? 0, snapshot?.anchor);
  }
  remember(destinationScreen, currentTop());
  return behavior;
}

// ---------------------------------------------------------------------------------------------
// Overlays — EMMI, bottom sheets, dialogs
//
// The background is locked while an overlay is up, and the exact offset it was locked at is what
// comes back. This is the classic modal bug: lock with position:fixed or forget to record the
// offset, and closing drops the patient at the top.
// ---------------------------------------------------------------------------------------------

export function captureOverlayPosition() {
  overlayTop = currentTop();
  return overlayTop;
}

export function restoreOverlayPosition() {
  if (overlayTop == null) return;
  scrollTo(overlayTop);
  overlayTop = null;
}

export function overlayPosition() {
  return overlayTop;
}

// The app owns restoration, so the browser must not also try. One source of truth.
export function claimHistoryScrollRestoration() {
  try {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  } catch {
    /* Safari private mode and similar can refuse; native restoration is then the fallback. */
  }
}
