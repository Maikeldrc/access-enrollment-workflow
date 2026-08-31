import { safetyEpisodeIsActive } from "./safetyPolicy.js";

export const EMMI_CONVERSATION_MODES = Object.freeze({
  INITIAL: "INITIAL",
  CONTINUATION: "CONTINUATION",
  RESUME: "RESUME",
  BACK_NAVIGATION: "BACK_NAVIGATION",
  TECHNICAL_RECONNECT: "TECHNICAL_RECONNECT",
  ERROR_RECOVERY: "ERROR_RECOVERY",
  LOCALE_CHANGE: "LOCALE_CHANGE"
});

const STORAGE_KEY = "itera.emmi.conversation.v1";
const VISIT_KEY = "itera.emmi.visit.v1";
const SESSION_KEY = "itera.emmi.conversation.session.v1";
const MAX_TURNS = 12;
const RESUME_AFTER_MS = 30 * 60 * 1000;
const greetingPattern = /^\s*(hi|hello|hey|good (morning|afternoon|evening)|hola|buen(os|as) (d[ií]as|tardes|noches)|bonjou|bonswa)(\b|[,!.])/i;
const uid = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const safeStorage = storage => ({
  get: key => { try { return storage?.getItem(key) || ""; } catch { return ""; } },
  set: (key, value) => { try { storage?.setItem(key, value); } catch { /* best effort */ } }
});

const parse = value => { try { return JSON.parse(value || "null"); } catch { return null; } };
const cleanText = value => String(value || "").replace(/\s+/g, " ").trim().slice(0, 900);

// Everything EMMI remembers about one enrollment: the saved conversation, the tab's copy of it,
// and the visit id that decides whether the next turn is a reconnect or a fresh greeting.
//
// All three are keyed by `scenarioId:patientId`, and both demo enrollments are the same fictional
// patient on the same scenario — so their scope strings are identical and the second enrollment
// would resume the first one's conversation word for word. That is why this clears the keys whole
// instead of deleting one scope: there is no scope that separates A from B.
export function clearEmmiConversation({ storage = globalThis.localStorage, sessionStorage = globalThis.sessionStorage } = {}) {
  const drop = (store, key) => { try { store?.removeItem(key); } catch { /* best effort */ } };
  drop(storage, STORAGE_KEY);
  drop(sessionStorage, SESSION_KEY);
  drop(sessionStorage, VISIT_KEY);
}

export class EmmiConversationManager {
  constructor({ patientId = "", scenarioId = "", locale = "EN", storage = globalThis.localStorage, sessionStorage = globalThis.sessionStorage, now = () => Date.now(), onEvent = () => {} } = {}) {
    this.storage = safeStorage(storage);
    this.sessionStorage = safeStorage(sessionStorage);
    this.now = now;
    this.onEvent = onEvent;
    this.scope = `${scenarioId || "default"}:${patientId || "anonymous"}`;
    const all = parse(this.storage.get(STORAGE_KEY)) || {};
    const sessionAll = parse(this.sessionStorage.get(SESSION_KEY)) || {};
    const saved = sessionAll[this.scope] || all[this.scope] || null;
    let visitId = this.sessionStorage.get(VISIT_KEY);
    const sameVisit = Boolean(visitId && saved?.visitId === visitId);
    if (!visitId) { visitId = uid("visit"); this.sessionStorage.set(VISIT_KEY, visitId); }
    const elapsed = saved?.lastInteractionAt ? this.now() - saved.lastInteractionAt : Infinity;
    const mode = !saved ? EMMI_CONVERSATION_MODES.INITIAL
      : sameVisit || elapsed < RESUME_AFTER_MS ? EMMI_CONVERSATION_MODES.TECHNICAL_RECONNECT
        : EMMI_CONVERSATION_MODES.RESUME;
    this.data = {
      conversationSessionId: saved?.conversationSessionId || uid("emmi_conversation"),
      visitId,
      hasGreeted: Boolean(saved?.hasGreeted),
      mode,
      locale,
      currentScreen: saved?.currentScreen || "",
      previousScreen: saved?.previousScreen || "",
      currentStage: saved?.currentStage || "",
      currentGoal: saved?.currentGoal || null,
      completedSteps: Array.isArray(saved?.completedSteps) ? saved.completedSteps.slice(-40) : [],
      lastUserIntent: saved?.lastUserIntent || "",
      lastUserTurn: saved?.lastUserTurn || "",
      lastEmmiTurn: saved?.lastEmmiTurn || "",
      pendingQuestion: saved?.pendingQuestion || "",
      nextBestAction: saved?.nextBestAction || null,
      conversationSummary: saved?.conversationSummary || "",
      recentTurns: Array.isArray(saved?.recentTurns) ? saved.recentTurns.slice(-MAX_TURNS) : [],
      contextVersion: Number(saved?.contextVersion) || 0,
      sessionResumptionHandle: saved?.sessionResumptionHandle || "",
      sessionResumable: Boolean(saved?.sessionResumable),
      // A resolved episode does not come back, and neither does one that has simply aged out: a
      // patient returning the next day must not be met with "call 911" for something that is over.
      activeSafetyEpisode: safetyEpisodeIsActive(saved?.activeSafetyEpisode, this.now()) ? saved.activeSafetyEpisode : null,
      lastInteractionAt: saved?.lastInteractionAt || this.now()
    };
    this.persist();
  }

  snapshot() { return globalThis.structuredClone ? globalThis.structuredClone(this.data) : JSON.parse(JSON.stringify(this.data)); }
  greetingAllowed() { return !this.data.hasGreeted && this.data.mode === EMMI_CONVERSATION_MODES.INITIAL; }
  // Greeting is a fact about this patient's conversation, not about the mode it resumed in. Gating
  // the record on INITIAL meant a reload before EMMI's first turn left hasGreeted false forever,
  // and she introduced herself again every time the panel opened.
  markGreeted() {
    if (this.data.hasGreeted) return;
    this.data.hasGreeted = true;
    this.data.mode = EMMI_CONVERSATION_MODES.CONTINUATION;
    this.touch("EMMI_GREETING_COMPLETED");
  }
  activateSafetyEpisode(episode) { if (!episode?.active) return null; this.data.activeSafetyEpisode = { ...episode, updatedAt: this.now() }; this.touch("EMMI_SAFETY_EPISODE_ACTIVATED", { episodeId: episode.id }); return this.data.activeSafetyEpisode; }
  resolveSafetyEpisode(resolution = "HUMAN_HELP_CONFIRMED") { if (!this.data.activeSafetyEpisode?.active) return null; this.data.activeSafetyEpisode = { ...this.data.activeSafetyEpisode, active: false, resolution, resolvedAt: this.now() }; this.touch("EMMI_SAFETY_EPISODE_RESOLVED", { resolution }); return this.data.activeSafetyEpisode; }

  transition(context = {}, meta = {}) {
    const nextScreen = context.currentScreen || context.screenId || "";
    const previousScreen = this.data.currentScreen;
    this.data.previousScreen = previousScreen;
    this.data.currentScreen = nextScreen;
    this.data.currentStage = context.currentStage || context.stageId || this.data.currentStage;
    this.data.locale = context.locale || this.data.locale;
    this.data.currentGoal = context.activeGoal || this.data.currentGoal;
    this.data.nextBestAction = context.nextBestAction || null;
    if (meta.localeChanged) this.data.mode = EMMI_CONVERSATION_MODES.LOCALE_CHANGE;
    else if (meta.errorRecovery) this.data.mode = EMMI_CONVERSATION_MODES.ERROR_RECOVERY;
    else if (meta.technicalReconnect) this.data.mode = EMMI_CONVERSATION_MODES.TECHNICAL_RECONNECT;
    else if (meta.navigationDirection === "BACK") this.data.mode = EMMI_CONVERSATION_MODES.BACK_NAVIGATION;
    else if (previousScreen && previousScreen !== nextScreen) this.data.mode = EMMI_CONVERSATION_MODES.CONTINUATION;
    if (previousScreen && previousScreen !== nextScreen && !this.data.completedSteps.includes(previousScreen)) this.data.completedSteps.push(previousScreen);
    this.data.completedSteps = this.data.completedSteps.slice(-40);
    this.data.contextVersion += 1;
    this.touch("EMMI_CONVERSATION_CONTEXT_UPDATED", { previousScreen, currentScreen: nextScreen, mode: this.data.mode });
    return this.contextForModel();
  }

  recordTurn(role, text, metadata = {}) {
    const cleaned = cleanText(text);
    if (!cleaned) return;
    const prior = this.data.recentTurns.at(-1);
    if (prior?.role === role && prior.text === cleaned && this.now() - prior.at < 2500) return;
    const entry = { role, text: cleaned, screen: metadata.screen || this.data.currentScreen, at: this.now() };
    this.data.recentTurns.push(entry);
    this.data.recentTurns = this.data.recentTurns.slice(-MAX_TURNS);
    if (role === "user") { this.data.lastUserTurn = cleaned; this.data.lastUserIntent = cleanText(metadata.intent || cleaned); this.data.pendingQuestion = cleaned; }
    else { this.data.lastEmmiTurn = cleaned; this.data.pendingQuestion = ""; }
    this.data.conversationSummary = this.data.recentTurns.slice(-6).map(turn => `${turn.role}: ${turn.text}`).join(" | ").slice(-2400);
    this.touch("EMMI_CONVERSATION_TURN_RECORDED", { role, screen: entry.screen });
  }

  updateResumption({ handle = "", resumable = true } = {}) {
    if (handle) this.data.sessionResumptionHandle = handle;
    this.data.sessionResumable = Boolean(resumable && this.data.sessionResumptionHandle);
    this.touch("EMMI_SESSION_RESUMPTION_UPDATED", { resumable: this.data.sessionResumable });
  }

  clearResumption(reason = "cleared") {
    this.data.sessionResumptionHandle = "";
    this.data.sessionResumable = false;
    this.touch("EMMI_SESSION_RESUMPTION_CLEARED", { reason });
  }

  guardAssistantText(text, { source = "generated" } = {}) {
    const value = cleanText(text);
    if (this.greetingAllowed() || !greetingPattern.test(value)) return value;
    this.onEvent("EMMI_UNEXPECTED_GREETING", { source, mode: this.data.mode, screen: this.data.currentScreen });
    return value.replace(greetingPattern, "").replace(/^\s*[,!.:-]+\s*/, "").trim();
  }

  contextForModel() {
    return {
      conversationSessionId: this.data.conversationSessionId,
      conversationMode: this.data.mode,
      greetingAllowed: this.greetingAllowed(),
      hasGreeted: this.data.hasGreeted,
      currentScreen: this.data.currentScreen,
      previousScreen: this.data.previousScreen,
      currentStage: this.data.currentStage,
      completedSteps: this.data.completedSteps,
      currentGoal: this.data.currentGoal,
      lastUserIntent: this.data.lastUserIntent,
      lastUserTurn: this.data.lastUserTurn,
      lastEmmiTurn: this.data.lastEmmiTurn,
      pendingQuestion: this.data.pendingQuestion,
      nextBestAction: this.data.nextBestAction,
      conversationSummary: this.data.conversationSummary,
      recentTurns: this.data.recentTurns,
      contextVersion: this.data.contextVersion,
      sessionResumptionHandle: this.data.sessionResumptionHandle,
      sessionResumable: this.data.sessionResumable,
      activeSafetyEpisode: this.data.activeSafetyEpisode
    };
  }

  recoveryInstruction() {
    const context = this.contextForModel();
    return `Continue the existing EMMI conversation. Do not greet or reintroduce yourself. Conversation mode: ${context.conversationMode}. Current screen: ${context.currentScreen}. Previous screen: ${context.previousScreen || "none"}. Current task: ${context.nextBestAction?.label || "continue the current screen"}. Recent context: ${context.conversationSummary || "no prior spoken turns"}.`;
  }

  touch(event, details = {}) { this.data.lastInteractionAt = this.now(); this.persist(); this.onEvent(event, details); }
  persist() {
    const all = parse(this.storage.get(STORAGE_KEY)) || {};
    const { recentTurns, conversationSummary, lastUserTurn, lastEmmiTurn, pendingQuestion, ...persistent } = this.data;
    all[this.scope] = persistent;
    this.storage.set(STORAGE_KEY, JSON.stringify(all));
    const sessionAll = parse(this.sessionStorage.get(SESSION_KEY)) || {}; sessionAll[this.scope] = this.data; this.sessionStorage.set(SESSION_KEY, JSON.stringify(sessionAll));
  }
}
