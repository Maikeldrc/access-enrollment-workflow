export const EMMI_MESSAGE_PRIORITY = Object.freeze({
  SCREEN_GUIDANCE: 1,
  TRANSITION_GUIDANCE: 2,
  PATIENT_RESPONSE: 3,
  PATIENT_INTERRUPTION: 4,
  CRITICAL_SAFETY: 5
});

export const EMMI_NARRATION_STATUS = Object.freeze({
  GENERATING: "GENERATING",
  PLAYING: "PLAYING",
  STALE: "STALE",
  TRANSITIONING: "TRANSITIONING",
  COMPLETED: "COMPLETED",
  INTERRUPTED: "INTERRUPTED",
  CANCELED: "CANCELED"
});

const sentenceParts = text => String(text || "").match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];

// Long spoken sentences are divided only at punctuation that already represents a safe pause.
// This keeps each queued unit understandable on its own and makes a navigation handoff sound
// intentional instead of cutting a word or allowing a stale paragraph to continue.
export function semanticSpeechSegments(text, { maxWords = 18 } = {}) {
  const segments = [];
  for (const sentence of sentenceParts(text)) {
    const cleaned = sentence.trim();
    if (!cleaned) continue;
    const words = cleaned.split(/\s+/);
    if (words.length <= maxWords) { segments.push(cleaned); continue; }
    const clauses = cleaned.split(/(?<=[,;:—–])\s+/).map(value => value.trim()).filter(Boolean);
    if (clauses.length === 1) { segments.push(cleaned); continue; }
    let current = "";
    for (const clause of clauses) {
      const candidate = `${current} ${clause}`.trim();
      if (current && candidate.split(/\s+/).length > maxWords) { segments.push(current); current = clause; }
      else current = candidate;
    }
    if (current) segments.push(current);
  }
  return segments;
}

const id = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const delay = (setTimer, ms) => new Promise(resolve => setTimer(resolve, ms));

export class EmmiTransitionManager {
  constructor({
    transport,
    getScreenNarration,
    getTransitionNarration,
    formatPrompt = text => text,
    onVisualContext = () => {},
    onStatus = () => {},
    onTrace = () => {},
    maxGracefulHandoffMs = 2500,
    settleMs = 180,
    setTimer = (callback, ms) => setTimeout(callback, ms),
    clearTimer = timer => clearTimeout(timer)
  }) {
    this.transport = transport;
    this.getScreenNarration = getScreenNarration;
    this.getTransitionNarration = getTransitionNarration;
    this.formatPrompt = formatPrompt;
    this.onVisualContext = onVisualContext;
    this.onStatus = onStatus;
    this.onTrace = onTrace;
    this.maxGracefulHandoffMs = maxGracefulHandoffMs;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.settleMs = settleMs;
    this.contextVersion = 0;
    this.context = null;
    this.narration = null;
    this.pendingTimer = null;
    this.pendingTransitionToken = 0;
    this.enabled = true;
    this.paused = false;
    this.connectNext = false;
  }

  snapshot() { return { contextVersion: this.contextVersion, context: this.context, narration: this.narration }; }
  setEnabled(value) { this.enabled = Boolean(value); if (!this.enabled) this.cancel("voice_disabled", { immediate: true }); }
  setPaused(value) { this.paused = Boolean(value); if (this.paused) this.cancel("paused", { immediate: true }); }
  requestConnection() { this.connectNext = true; }

  async updateContext(nextContext, transitionMeta = {}) {
    const previous = this.context;
    const changed = !previous || previous.screenId !== nextContext.screenId || previous.stageId !== nextContext.stageId || previous.locale !== nextContext.locale;
    if (!changed) return false;
    this.contextVersion += 1;
    const version = this.contextVersion;
    this.context = { ...nextContext, contextVersion: version };
    this.transport.setActiveContextVersion?.(version);
    const currentNarration = this.getScreenNarration(this.context);
    this.onVisualContext(currentNarration, this.context);
    if (!previous || !this.enabled || this.paused) return true;

    const oldNarration = this.narration;
    const futureSegmentsDiscarded = oldNarration ? Math.max(0, oldNarration.segments.length - oldNarration.currentSegment - 1) : 0;
    if (oldNarration && ![EMMI_NARRATION_STATUS.COMPLETED, EMMI_NARRATION_STATUS.CANCELED].includes(oldNarration.status)) oldNarration.status = EMMI_NARRATION_STATUS.STALE;
    this.pendingTransitionToken += 1;
    const token = this.pendingTransitionToken;
    this.clearTimer(this.pendingTimer);
    this.onStatus("UPDATING");

    const active = this.transport.currentTurnMeta?.() || null;
    const preserve = active?.priority === "CRITICAL_SAFETY" || (active?.priority === "PATIENT_RESPONSE" && active.contextIndependent);
    const handoffStartedAt = Date.now();
    const boundary = this.transport.beginGracefulHandoff?.({
      nextContextVersion: version,
      allowedTurnId: active?.id || "",
      preserve,
      maxGracefulHandoffMs: preserve ? null : this.maxGracefulHandoffMs
    }) || Promise.resolve({ reason: "idle", durationMs: 0 });

    const [handoff] = await Promise.all([boundary, delay(this.setTimer, this.settleMs)]);
    if (token !== this.pendingTransitionToken || version !== this.contextVersion || !this.enabled || this.paused) return true;
    if (handoff?.forcedReconnect) this.connectNext = true;
    if (transitionMeta.localeChanged) {
      this.transport.restartAtBoundary?.();
      this.connectNext = true;
    }
    const transition = this.getTransitionNarration({ previous, current: this.context, navigationDirection: "FORWARD", ...transitionMeta });
    const screenSegments = currentNarration?.segments?.length ? currentNarration.segments : semanticSpeechSegments(currentNarration?.narrationText || "");
    const transitionSegments = transition?.segments?.length ? transition.segments : semanticSpeechSegments(transition?.narrationText || "");
    // A bridge already orients the patient to the destination. Skip an identical opening
    // screen segment so the handoff feels conversational instead of restarting the page.
    // Completion is a natural stopping point and its transition already contains the complete
    // welcome. Keeping it in one provider turn prevents the model from reopening the celebration
    // (and repeating "You did it") when a second screen-guidance segment is queued.
    const selectedSegments = transitionSegments.length ? transitionSegments : screenSegments;
    // A screen transition is one coherent provider turn. Queuing every sentence as a separate
    // generative turn made EMMI repeat openings, revive stale screen content and remain "Speaking"
    // after the patient had already moved on.
    const combinedNarration = selectedSegments.join(" ").trim();
    const segments = combinedNarration ? [combinedNarration] : [];
    const trace = {
      previousScreen: previous.screenId,
      currentScreen: this.context.screenId,
      previousNarrationId: oldNarration?.id || "",
      currentSegmentId: active?.semanticSegmentId || "",
      currentSentenceRelevant: Boolean(preserve),
      gracefulHandoffStarted: true,
      gracefulHandoffDuration: Date.now() - handoffStartedAt,
      gracefulHandoffReason: handoff?.reason || "idle",
      futureSegmentsDiscarded,
      contextVersion: version,
      selectedAction: transitionMeta.selectedAction || "",
      navigationDirection: transitionMeta.navigationDirection || "FORWARD"
    };
    this.speak({ narrationText: segments.join(" "), segments }, { kind: "TRANSITION_GUIDANCE", screenId: this.context.screenId, contextVersion: version });
    this.onTrace({ ...trace, newNarrationId: this.narration?.id || "" });
    return true;
  }

  speak(narration, { kind = "SCREEN_GUIDANCE", screenId = this.context?.screenId, contextVersion = this.contextVersion, connect = false } = {}) {
    if (!this.enabled || this.paused || !narration) return false;
    const segments = narration.segments?.length ? narration.segments : semanticSpeechSegments(narration.narrationText || narration);
    if (!segments.length) return false;
    this.narration = {
      id: id("narration"), screenId, stageId: this.context?.stageId || "", contextVersion,
      segments: segments.map((text, index) => ({ id: id(`segment_${index + 1}`), text })),
      currentSegment: 0, status: kind === "TRANSITION_GUIDANCE" ? EMMI_NARRATION_STATUS.TRANSITIONING : EMMI_NARRATION_STATUS.GENERATING,
      kind
    };
    this.connectNext = this.connectNext || connect;
    return this.playCurrentSegment();
  }

  repeatCurrentScreen({ connect = false } = {}) {
    const narration = this.getScreenNarration(this.context);
    return this.speak(narration, { connect, kind: "SCREEN_GUIDANCE", screenId: this.context?.screenId, contextVersion: this.contextVersion });
  }

  playCurrentSegment() {
    const narration = this.narration;
    if (!narration || narration.contextVersion !== this.contextVersion || !this.enabled || this.paused) return false;
    const segment = narration.segments[narration.currentSegment];
    if (!segment) { narration.status = EMMI_NARRATION_STATUS.COMPLETED; this.onStatus("IDLE"); return false; }
    narration.status = EMMI_NARRATION_STATUS.PLAYING;
    const metadata = {
      id: `${narration.id}:${segment.id}`,
      narrationId: narration.id,
      screenId: narration.screenId,
      contextVersion: narration.contextVersion,
      semanticSegmentId: segment.id,
      semanticText: segment.text,
      priority: narration.kind,
      contextIndependent: false
    };
    const prompt = this.formatPrompt(segment.text);
    const connect = this.connectNext;
    this.connectNext = false;
    const sent = connect ? this.transport.connect(prompt, metadata) : this.transport.sendText(prompt, metadata);
    if (!sent && !connect) {
      narration.status = EMMI_NARRATION_STATUS.CANCELED;
      this.onStatus("IDLE");
      return false;
    }
    this.onStatus("SPEAKING");
    return true;
  }

  onTurnComplete(metadata = {}) {
    const narration = this.narration;
    if (!narration || metadata.narrationId !== narration.id || [EMMI_NARRATION_STATUS.STALE, EMMI_NARRATION_STATUS.INTERRUPTED, EMMI_NARRATION_STATUS.CANCELED].includes(narration.status)) return;
    const activeSegment = narration.segments[narration.currentSegment];
    // Provider/audio callbacks can occasionally be delivered more than once. A completion only
    // belongs to the segment that is active right now; otherwise it must not advance or replay the
    // narration queue.
    if (metadata.semanticSegmentId && metadata.semanticSegmentId !== activeSegment?.id) {
      this.onTrace({
        event: "duplicate_or_stale_turn_completion_ignored",
        narrationId: narration.id,
        completedSegmentId: metadata.semanticSegmentId,
        activeSegmentId: activeSegment?.id || "",
        contextVersion: this.contextVersion
      });
      return;
    }
    narration.currentSegment += 1;
    if (narration.currentSegment >= narration.segments.length) {
      narration.status = EMMI_NARRATION_STATUS.COMPLETED;
      this.onStatus("IDLE");
      return;
    }
    this.playCurrentSegment();
  }

  onPatientInterruption(details = {}) {
    this.pendingTransitionToken += 1;
    this.clearTimer(this.pendingTimer);
    const narration = this.narration;
    const futureSegmentsDiscarded = narration
      ? Math.max(0, narration.segments.length - narration.currentSegment - 1)
      : 0;
    if (narration && ![EMMI_NARRATION_STATUS.COMPLETED, EMMI_NARRATION_STATUS.CANCELED].includes(narration.status)) {
      narration.status = EMMI_NARRATION_STATUS.INTERRUPTED;
    }
    this.onStatus("LISTENING");
    this.onTrace({
      event: "patient_interrupted_narration",
      source: details.source || "unknown",
      narrationId: narration?.id || "",
      semanticSegmentId: narration?.segments?.[narration.currentSegment]?.id || "",
      futureSegmentsDiscarded,
      contextVersion: this.contextVersion
    });
    return { narrationId: narration?.id || "", futureSegmentsDiscarded };
  }

  cancel(reason = "canceled", { immediate = false } = {}) {
    this.pendingTransitionToken += 1;
    this.clearTimer(this.pendingTimer);
    if (this.narration) this.narration.status = EMMI_NARRATION_STATUS.CANCELED;
    if (immediate) this.transport.stopPlayback?.({ fadeMs: 80 });
    this.onTrace({ event: "narration_canceled", reason, contextVersion: this.contextVersion });
  }
}
