import { describe, expect, it, vi } from "vitest";
import { EmmiTransitionManager, EMMI_NARRATION_STATUS, semanticSpeechSegments } from "../src/emmi/transitionManager.js";
import { buildTransitionNarration } from "../src/emmi/narrative.js";
import { EmmiLiveClient } from "../src/emmi/liveClient.js";

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
  it("rejects late turns from an old context version", () => {
    const session = { sendClientContent: vi.fn() };
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }) });
    client.session = session;
    client.setActiveContextVersion(4);
    expect(client.sendText("stale", { id: "old", contextVersion: 3 })).toBe(false);
    expect(client.sendText("current", { id: "new", contextVersion: 4 })).toBe(true);
    expect(session.sendClientContent).toHaveBeenCalledTimes(1);
  });

  it("resolves at a semantic turn boundary and retains the turn metadata", async () => {
    const completed = [];
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }), onTurnComplete: metadata => completed.push(metadata) });
    client.session = { sendClientContent: vi.fn() };
    client.state = "EMMI_SPEAKING";
    client.setActiveContextVersion(1);
    client.sendText("current sentence", { id: "turn-1", narrationId: "narration-1", contextVersion: 1 });
    client.state = "EMMI_SPEAKING";
    const handoff = client.beginGracefulHandoff({ nextContextVersion: 2, allowedTurnId: "turn-1", maxGracefulHandoffMs: 100 });
    await client.handleMessage({ serverContent: { turnComplete: true } });
    await expect(handoff).resolves.toMatchObject({ reason: "semantic_boundary", forcedReconnect: false });
    expect(completed[0]).toMatchObject({ id: "turn-1", narrationId: "narration-1" });
  });

  it("uses a short forced handoff when no natural boundary arrives", async () => {
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }) });
    client.session = { close: vi.fn() };
    client.state = "EMMI_SPEAKING";
    client.activeTurn = { id: "long-turn", contextVersion: 1, priority: "SCREEN_GUIDANCE" };
    client.setActiveContextVersion(1);
    await expect(client.beginGracefulHandoff({ nextContextVersion: 2, allowedTurnId: "long-turn", maxGracefulHandoffMs: 5 }))
      .resolves.toMatchObject({ reason: "max_grace", forcedReconnect: true });
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
    await expect(handoff).resolves.toMatchObject({ reason: "semantic_boundary" });
  });
});
