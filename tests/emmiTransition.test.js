import { describe, expect, it, vi } from "vitest";
import { EmmiTransitionManager, EMMI_NARRATION_STATUS, semanticSpeechSegments } from "../src/emmi/transitionManager.js";
import { buildTransitionNarration } from "../src/emmi/narrative.js";
import { EmmiLiveClient, normalizeEmmiVoiceError } from "../src/emmi/liveClient.js";

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

function harness() {
  const sent = [];
  const handoffs = [];
  let activeTurn = null;
  const transport = {
    setActiveContextVersion: vi.fn(),
    currentTurnMeta: () => activeTurn,
    beginGracefulHandoff: vi.fn(options => {
      const wait = deferred(); handoffs.push({ options, ...wait }); return wait.promise;
    }),
    sendText: vi.fn((text, metadata) => { sent.push({ text, metadata }); activeTurn = metadata; return true; }),
    connect: vi.fn((text, metadata) => { sent.push({ text, metadata, connect: true }); activeTurn = metadata; return true; }),
    stopPlayback: vi.fn(),
    restartAtBoundary: vi.fn()
  };
  const narration = context => ({ narrationText: `Purpose for ${context.screenId}. Benefit for ${context.screenId}. Action for ${context.screenId}.`, segments: [`Purpose for ${context.screenId}.`, `Benefit for ${context.screenId}.`, `Action for ${context.screenId}.`] });
  const manager = new EmmiTransitionManager({
    transport,
    getScreenNarration: narration,
    getTransitionNarration: ({ current, navigationDirection }) => ({ narrationText: `${navigationDirection} to ${current.screenId}.`, segments: [`${navigationDirection} to ${current.screenId}.`] }),
    settleMs: 0,
    formatPrompt: text => text
  });
  return { manager, transport, sent, handoffs, setActiveTurn: value => { activeTurn = value; } };
}

describe("EMMI semantic handoff", () => {
  it("segments at complete sentences and safe clauses, never inside a word", () => {
    expect(semanticSpeechSegments("First sentence. Second sentence? Third!"))
      .toEqual(["First sentence.", "Second sentence?", "Third!"]);
    expect(semanticSpeechSegments("This is a deliberately long orientation clause, and this is a separate safe clause that can stand alone.", { maxWords: 8 }))
      .toEqual(["This is a deliberately long orientation clause,", "and this is a separate safe clause that can stand alone."]);
  });

  it("marks the old narration stale, discards future segments, then bridges to the new screen", async () => {
    const { manager, sent, handoffs } = harness();
    await manager.updateContext({ screenId: "DECISION_MAKER", stageId: "WHO", locale: "EN" });
    manager.speak({ narrationText: "One. Two. Three.", segments: ["One.", "Two.", "Three."] });
    const old = manager.snapshot().narration;
    const transition = manager.updateContext({ screenId: "IDENTITY_VERIFICATION", stageId: "IDENTITY", locale: "EN" }, { navigationDirection: "FORWARD" });
    expect(old.status).toBe(EMMI_NARRATION_STATUS.STALE);
    handoffs[0].resolve({ reason: "semantic_boundary", durationMs: 220 });
    await transition;
    expect(sent.map(item => item.text)).toEqual(["One.", "FORWARD to IDENTITY_VERIFICATION."]);
  });

  it("collapses rapid A to B to C navigation so only the stable destination is narrated", async () => {
    const { manager, sent, handoffs } = harness();
    await manager.updateContext({ screenId: "A", stageId: "ONE", locale: "EN" });
    manager.speak({ narrationText: "About A. More A.", segments: ["About A.", "More A."] });
    const toB = manager.updateContext({ screenId: "B", stageId: "TWO", locale: "EN" });
    const toC = manager.updateContext({ screenId: "C", stageId: "THREE", locale: "EN" });
    handoffs.forEach(wait => wait.resolve({ reason: "semantic_boundary", durationMs: 100 }));
    await Promise.all([toB, toC]);
    expect(sent.map(item => item.text)).toEqual(["About A.", "FORWARD to C."]);
  });

  it("queues the destination immediately when navigation beats the opening voice turn", async () => {
    const { manager, sent, handoffs, setActiveTurn } = harness();
    await manager.updateContext({ screenId: "INVITATION", stageId: "INVITATION", locale: "EN" });
    manager.speak({ narrationText: "Welcome.", segments: ["Welcome."] }, { connect: true });
    // The transport is connecting, but no provider turn exists yet.
    setActiveTurn(null);

    const move = manager.updateContext({ screenId: "DECISION_MAKER", stageId: "WHO", locale: "EN" });

    expect(handoffs).toHaveLength(0);
    expect(sent.map(item => item.text)).toEqual(["Welcome.", "FORWARD to DECISION_MAKER."]);
    await move;
  });

  it("preserves a context-independent patient answer and all critical safety speech", async () => {
    const { manager, handoffs, setActiveTurn } = harness();
    await manager.updateContext({ screenId: "A", stageId: "ONE", locale: "EN" });
    setActiveTurn({ id: "patient-answer", priority: "PATIENT_RESPONSE", contextIndependent: true });
    const move = manager.updateContext({ screenId: "B", stageId: "TWO", locale: "EN" });
    expect(handoffs[0].options.preserve).toBe(true);
    expect(handoffs[0].options.maxGracefulHandoffMs).toBeNull();
    handoffs[0].resolve({ reason: "semantic_boundary" });
    await move;
  });

  it("cancels the remaining narration immediately when the patient interrupts", async () => {
    const { manager, sent } = harness();
    await manager.updateContext({ screenId: "A", stageId: "ONE", locale: "EN" });
    manager.speak({ narrationText: "One. Two. Three.", segments: ["One.", "Two.", "Three."] });
    const active = manager.snapshot().narration;
    const result = manager.onPatientInterruption({ source: "local_vad" });
    expect(active.status).toBe(EMMI_NARRATION_STATUS.INTERRUPTED);
    expect(result.futureSegmentsDiscarded).toBe(2);
    manager.onTurnComplete({ narrationId: active.id });
    expect(sent.map(item => item.text)).toEqual(["One."]);
  });

  it("ignores a duplicate completion from a segment that already advanced", async () => {
    const { manager, sent } = harness();
    await manager.updateContext({ screenId: "A", stageId: "ONE", locale: "EN" });
    manager.speak({ narrationText: "One. Two. Three.", segments: ["One.", "Two.", "Three."] });
    const narration = manager.snapshot().narration;
    const firstSegmentId = narration.segments[0].id;

    manager.onTurnComplete({ narrationId: narration.id, semanticSegmentId: firstSegmentId });
    manager.onTurnComplete({ narrationId: narration.id, semanticSegmentId: firstSegmentId });

    expect(narration.currentSegment).toBe(1);
    expect(sent.map(item => item.text)).toEqual(["One.", "Two."]);
  });

  it("keeps the enrollment-complete welcome in one cohesive transition turn", async () => {
    const { manager, sent } = harness();
    manager.getTransitionNarration = () => ({ narrationText: "Congratulations. You did it.", segments: ["Congratulations. You did it."] });
    await manager.updateContext({ screenId: "ENROLLMENT_PROCESSING", stageId: "ENROLLMENT", locale: "ES" });
    const transition = manager.updateContext({ screenId: "ENROLLMENT_CONFIRMED", stageId: "COMPLETE", locale: "ES" });
    await transition;

    expect(sent.map(item => item.text)).toEqual(["Congratulations. You did it."]);
    expect(manager.snapshot().narration.segments).toHaveLength(1);
  });

  it("restarts at a safe boundary when locale changes", async () => {
    const { manager, transport, handoffs } = harness();
    await manager.updateContext({ screenId: "A", stageId: "ONE", locale: "EN" });
    manager.speak({ narrationText: "English sentence.", segments: ["English sentence."] });
    const change = manager.updateContext({ screenId: "A", stageId: "ONE", locale: "ES" }, { localeChanged: true, navigationDirection: "LOCALE" });
    handoffs[0].resolve({ reason: "semantic_boundary" });
    await change;
    expect(transport.restartAtBoundary).toHaveBeenCalledOnce();
    expect(transport.connect).toHaveBeenCalled();
  });

  it("authors specific, localized forward and back bridges", () => {
    expect(buildTransitionNarration({ previousScreen: "DECISION_MAKER", currentScreen: "PERSONAL_REPRESENTATIVE_DETAILS", locale: "ES" }).narrationText)
      .toMatch(/representante personal/i);
    expect(buildTransitionNarration({ previousScreen: "IDENTITY_VERIFICATION", currentScreen: "DECISION_MAKER", locale: "KR", navigationDirection: "BACK" }).narrationText)
      .toMatch(/retounen/i);
  });
});

describe("EMMI live context guards", () => {
  it("does not replace a queued narration turn with Listening when microphone startup finishes late", () => {
    vi.useFakeTimers();
    const states = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN" }),
      onState: state => states.push(state)
    });
    client.state = "EMMI_THINKING";

    expect(client.completeAudioCaptureStartup()).toBe(true);
    expect(client.state).toBe("EMMI_THINKING");
    expect(states).not.toContain("LISTENING");

    client.disconnect("test_complete");
    vi.useRealTimers();
  });

  it("moves an idle opening session to Listening after microphone startup", () => {
    vi.useFakeTimers();
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }) });
    client.state = "CONNECTING";

    expect(client.completeAudioCaptureStartup()).toBe(true);
    expect(client.state).toBe("LISTENING");

    client.disconnect("test_complete");
    vi.useRealTimers();
  });

  it("normalizes provider and permission failures into stable patient-safe states", () => {
    expect(normalizeEmmiVoiceError("microphone_denied")).toBe("VOICE_PERMISSION_DENIED");
    expect(normalizeEmmiVoiceError("token_generation_failed")).toBe("VOICE_PROVIDER_ERROR");
    expect(normalizeEmmiVoiceError("connection_failed")).toBe("VOICE_SESSION_FAILED");
    expect(normalizeEmmiVoiceError("voice_locale_fallback")).toBe("VOICE_UNAVAILABLE_FOR_LOCALE");
  });

  it("invalidates an interrupted generation and rejects every late audio chunk", () => {
    const interruptions = [];
    const telemetry = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN", currentScreen: "INVITATION" }),
      onBargeIn: detail => interruptions.push(detail),
      onVoiceTelemetry: (type, detail) => telemetry.push({ type, detail })
    });
    client.state = "EMMI_SPEAKING";
    client.activeContextVersion = 2;
    client.activeAudioGenerationId = 7;
    client.activeTurn = { id: "guide", generationId: 7, contextVersion: 2, priority: "SCREEN_GUIDANCE" };
    client.stopPlayback = vi.fn();
    expect(client.handlePatientSpeechStart({ source: "local_vad", detectedAt: performance.now() - 180 })).toBe(true);
    expect(client.state).toBe("USER_SPEAKING");
    expect(client.activeTurn).toBeNull();
    expect(client.interruptedGenerationIds.has(7)).toBe(true);
    expect(client.playAudio("AA==", { generationId: 7, contextVersion: 2 })).toBe(false);
    expect(interruptions).toHaveLength(1);
    expect(telemetry.some(event => event.type === "EMMI_STALE_AUDIO_CHUNK_DISCARDED")).toBe(true);
  });

  it("does not let a local energy trigger truncate a critical safety instruction", () => {
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }) });
    client.state = "EMMI_SPEAKING";
    client.activeAudioGenerationId = 3;
    client.activeTurn = { id: "safety", generationId: 3, contextVersion: 1, priority: "CRITICAL_SAFETY" };
    client.stopPlayback = vi.fn();
    expect(client.handlePatientSpeechStart({ source: "local_vad", detectedAt: performance.now() })).toBe(false);
    expect(client.stopPlayback).not.toHaveBeenCalled();
    expect(client.activeTurn.id).toBe("safety");
  });

  it("preserves the interrupted semantic context for short follow-up questions", () => {
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "ES", currentScreen: "MEDICATIONS", currentStage: "YOUR_CARE" }) });
    client.state = "EMMI_SPEAKING";
    client.activeAudioGenerationId = 11;
    client.lastEmmiUtterance = "Confirmar esta lista ayuda a que su equipo tenga información actualizada.";
    client.activeTurn = { id: "medications", generationId: 11, contextVersion: 4, priority: "SCREEN_GUIDANCE", semanticSegmentId: "benefit", semanticText: "Confirmar sus medicamentos ayuda a su equipo." };
    client.stopPlayback = vi.fn();
    client.handlePatientSpeechStart({ source: "local_vad", detectedAt: performance.now() });
    expect(client.lastInterruptionContext).toMatchObject({
      lastEmmiSemanticSegment: "Confirmar sus medicamentos ayuda a su equipo.",
      interruptedAtSegment: "benefit",
      currentScreenContext: { currentScreen: "MEDICATIONS" }
    });
  });

  it("also interrupts an Ask EMMI answer without reconnecting the live session", () => {
    const session = { close: vi.fn() };
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN", currentScreen: "CONSENT_REVIEW" }) });
    client.session = session;
    client.state = "EMMI_SPEAKING";
    client.activeAudioGenerationId = 12;
    client.activeTurn = { id: "patient-answer", generationId: 12, contextVersion: 3, priority: "PATIENT_RESPONSE", contextIndependent: true };
    client.stopPlayback = vi.fn();
    expect(client.handlePatientSpeechStart({ source: "local_vad", detectedAt: performance.now() })).toBe(true);
    expect(session.close).not.toHaveBeenCalled();
    expect(client.interruptedGenerationIds.has(12)).toBe(true);
  });
  it("rejects late turns from an old context version", () => {
    const session = { sendClientContent: vi.fn() };
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }) });
    client.session = session;
    client.setActiveContextVersion(4);
    expect(client.sendText("stale", { id: "old", contextVersion: 3 })).toBe(false);
    expect(client.sendText("current", { id: "new", contextVersion: 4 })).toBe(true);
    expect(session.sendClientContent).toHaveBeenCalledTimes(1);
    expect(session.sendClientContent.mock.calls[0][0].turns).toContain("TRUSTED LIVE CONTEXT UPDATE");
  });

  it("queues the latest screen narration while the live connection is opening", () => {
    const telemetry = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN", currentScreen: "DECISION_MAKER" }),
      onVoiceTelemetry: type => telemetry.push(type)
    });
    client.state = "CONNECTING";

    expect(client.sendText("Welcome", { screenId: "INVITATION", contextVersion: 1, priority: "SCREEN_GUIDANCE" })).toBe(true);
    expect(client.sendText("Who is completing this?", { screenId: "DECISION_MAKER", contextVersion: 2, priority: "TRANSITION_GUIDANCE" })).toBe(true);

    expect(client.pendingConnectionTurn).toEqual({
      text: "Who is completing this?",
      metadata: expect.objectContaining({ screenId: "DECISION_MAKER", contextVersion: 2 })
    });
    expect(telemetry).toEqual([
      "EMMI_VOICE_TURN_QUEUED_DURING_CONNECT",
      "EMMI_VOICE_TURN_QUEUED_DURING_CONNECT"
    ]);
  });

  it("queues destination guidance after onopen reports Listening but before the session is assigned", () => {
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN", currentScreen: "DECISION_MAKER" })
    });
    client.state = "LISTENING";
    client.session = null;

    expect(client.sendText("Who is completing this?", {
      screenId: "DECISION_MAKER",
      contextVersion: 2,
      priority: "TRANSITION_GUIDANCE"
    })).toBe(true);
    expect(client.pendingConnectionTurn).toEqual({
      text: "Who is completing this?",
      metadata: expect.objectContaining({ screenId: "DECISION_MAKER", contextVersion: 2 })
    });
  });

  it("does not queue narration while voice is disconnected", () => {
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }) });
    expect(client.sendText("Do not queue", { contextVersion: 1 })).toBe(false);
    expect(client.pendingConnectionTurn).toBeNull();
  });

  it("retains the latest resumable Gemini Live handle", async () => {
    const onSessionResumption = vi.fn();
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }), onSessionResumption });
    await client.handleMessage({ sessionResumptionUpdate: { newHandle: "resume-handle", resumable: true, lastConsumedClientMessageIndex: "7" } });
    expect(client.sessionResumptionHandle).toBe("resume-handle");
    expect(onSessionResumption).toHaveBeenCalledWith(expect.objectContaining({ handle: "resume-handle", resumable: true }));
  });
  it("allows multiple bounded reconnects", () => { vi.useFakeTimers(); const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }), onReconnectNeeded: () => "continue" }); client.sessionResumptionHandle = "resume"; client.connect = vi.fn().mockResolvedValue(true); expect(client.scheduleReconnect("loss")).toBe(true); vi.advanceTimersByTime(250); expect(client.connect).toHaveBeenCalledTimes(1); expect(client.scheduleReconnect("loss")).toBe(true); vi.advanceTimersByTime(500); expect(client.connect).toHaveBeenCalledTimes(2); vi.useRealTimers(); });
  it("handles provider callback errors without throwing", () => { const onError = vi.fn(); const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }), onError }); expect(() => client.handleProviderError(new Error("failed"))).not.toThrow(); expect(onError).toHaveBeenCalledWith("VOICE_PROVIDER_ERROR"); });
  it("uses GoAway for proactive handoff", async () => { vi.useFakeTimers(); const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }), onReconnectNeeded: () => "resume" }); client.sessionResumptionHandle = "resume"; client.connect = vi.fn().mockResolvedValue(true); client.disconnect = vi.fn(); await client.handleMessage({ goAway: { timeLeft: "1s" } }); vi.advanceTimersByTime(100); expect(client.disconnect).toHaveBeenCalledWith("go_away_handoff"); expect(client.connect).toHaveBeenCalled(); vi.useRealTimers(); });

  it("resolves only after the provider turn has no audible audio left and retains metadata", async () => {
    const completed = [];
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }), onTurnComplete: metadata => completed.push(metadata) });
    client.session = { sendClientContent: vi.fn() };
    client.state = "EMMI_SPEAKING";
    client.setActiveContextVersion(1);
    client.sendText("current sentence", { id: "turn-1", narrationId: "narration-1", contextVersion: 1 });
    client.state = "EMMI_SPEAKING";
    const handoff = client.beginGracefulHandoff({ nextContextVersion: 2, allowedTurnId: "turn-1", maxGracefulHandoffMs: 100 });
    await client.handleMessage({ serverContent: { turnComplete: true } });
    await expect(handoff).resolves.toMatchObject({ reason: "audio_drained", forcedReconnect: false });
    expect(completed[0]).toMatchObject({ id: "turn-1", narrationId: "narration-1" });
  });

  it("uses a short forced handoff when no natural boundary arrives", async () => {
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }) });
    client.session = { close: vi.fn() };
    client.outputContext = { close: vi.fn(), currentTime: 0 };
    client.outputGain = { gain: { setValueAtTime: vi.fn() } };
    client.state = "EMMI_SPEAKING";
    client.activeTurn = { id: "long-turn", contextVersion: 1, priority: "SCREEN_GUIDANCE" };
    client.sessionResumptionHandle = "stalled-session";
    client.setActiveContextVersion(1);
    await expect(client.beginGracefulHandoff({ nextContextVersion: 2, allowedTurnId: "long-turn", maxGracefulHandoffMs: 5 }))
      .resolves.toMatchObject({ reason: "max_grace", forcedReconnect: true });
    expect(client.outputContext.close).not.toHaveBeenCalled();
    expect(client.outputContext).not.toBeNull();
    expect(client.outputGain).not.toBeNull();
    expect(client.sessionResumptionHandle).toBe("");
  });

  it("closes the output context when voice is intentionally ended", () => {
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }) });
    const outputContext = { close: vi.fn(), currentTime: 0 };
    client.outputContext = outputContext;
    client.outputGain = { gain: { setValueAtTime: vi.fn() } };

    client.disconnect("voice_off");

    expect(outputContext.close).toHaveBeenCalledOnce();
    expect(client.outputContext).toBeNull();
    expect(client.outputGain).toBeNull();
  });

  it("does not let the normal grace timeout cancel a critical 911 instruction", async () => {
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }) });
    client.session = { close: vi.fn() };
    client.state = "EMMI_SPEAKING";
    client.activeTurn = { id: "safety-turn", contextVersion: 1, priority: "PATIENT_RESPONSE" };
    client.setActiveContextVersion(1);
    const handoff = client.beginGracefulHandoff({ nextContextVersion: 2, allowedTurnId: "safety-turn", maxGracefulHandoffMs: 5 });
    await client.handleMessage({ serverContent: { outputTranscription: { text: "Call 911 now if you have severe chest pain." } } });
    expect(await Promise.race([handoff.then(() => "ended"), new Promise(resolve => setTimeout(() => resolve("still-speaking"), 15))])).toBe("still-speaking");
    await client.handleMessage({ serverContent: { turnComplete: true } });
    await expect(handoff).resolves.toMatchObject({ reason: "audio_drained" });
  });
});
