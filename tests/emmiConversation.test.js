import { describe, expect, it, vi } from "vitest";
import { EmmiConversationManager, EMMI_CONVERSATION_MODES } from "../src/emmi/conversationManager.js";
import { buildHomeNarration } from "../src/emmi/narrative.js";

const memoryStorage = initial => {
  const values = new Map(Object.entries(initial || {}));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};

describe("EMMI conversation continuity", () => {
  it("allows exactly one initial greeting and suppresses it on subsequent Home narration", () => {
    const storage = memoryStorage();
    const sessionStorage = memoryStorage();
    const manager = new EmmiConversationManager({ patientId: "p1", scenarioId: "access", storage, sessionStorage, now: () => 1000 });
    expect(manager.contextForModel()).toMatchObject({ conversationMode: EMMI_CONVERSATION_MODES.INITIAL, greetingAllowed: true, hasGreeted: false });
    expect(buildHomeNarration({ locale: "EN", program: "ACCESS", allowGreeting: manager.greetingAllowed() }).narrationText).toMatch(/^Hi, I'm EMMI/);
    manager.markGreeted();
    expect(buildHomeNarration({ locale: "EN", program: "ACCESS", allowGreeting: manager.greetingAllowed() }).narrationText).not.toMatch(/^Hi|^Hello/);
  });

  it("preserves screen, goal, intent and turns while moving forward and back", () => {
    const manager = new EmmiConversationManager({ patientId: "p1", scenarioId: "access", storage: memoryStorage(), sessionStorage: memoryStorage(), now: () => 2000 });
    manager.transition({ currentScreen: "GOALS", currentStage: "GETTING_STARTED", activeGoal: { id: "bp", title: "Control my blood pressure" } });
    manager.recordTurn("user", "Can this help with that?", { intent: "relationship to blood pressure goal" });
    manager.recordTurn("assistant", "Yes. This step supports the blood pressure goal you selected.");
    manager.transition({ currentScreen: "ONBOARDING", currentStage: "GETTING_STARTED" }, { navigationDirection: "BACK" });
    expect(manager.contextForModel()).toMatchObject({ conversationMode: EMMI_CONVERSATION_MODES.BACK_NAVIGATION, previousScreen: "GOALS", currentScreen: "ONBOARDING", lastUserIntent: "relationship to blood pressure goal" });
    expect(manager.contextForModel().conversationSummary).toContain("blood pressure goal");
  });

  it("restores a short refresh as technical reconnect without greeting", () => {
    const storage = memoryStorage();
    const sessionStorage = memoryStorage();
    const first = new EmmiConversationManager({ patientId: "p1", scenarioId: "access", storage, sessionStorage, now: () => 1000 });
    first.markGreeted();
    first.transition({ currentScreen: "IDENTITY_VERIFICATION", currentStage: "CONFIRM_IDENTITY" });
    const restored = new EmmiConversationManager({ patientId: "p1", scenarioId: "access", storage, sessionStorage, now: () => 2000 });
    expect(restored.contextForModel()).toMatchObject({ conversationMode: EMMI_CONVERSATION_MODES.TECHNICAL_RECONNECT, greetingAllowed: false, currentScreen: "IDENTITY_VERIFICATION" });
    expect(restored.recoveryInstruction()).toContain("Do not greet or reintroduce yourself");
  });

  it("identifies a genuine later visit as resume and keeps greeting disabled", () => {
    const storage = memoryStorage();
    const firstSession = memoryStorage();
    const first = new EmmiConversationManager({ patientId: "p1", scenarioId: "access", storage, sessionStorage: firstSession, now: () => 1000 });
    first.markGreeted();
    first.recordTurn("user", "I will finish later");
    const later = new EmmiConversationManager({ patientId: "p1", scenarioId: "access", storage, sessionStorage: memoryStorage(), now: () => 1000 + 31 * 60 * 1000 });
    expect(later.contextForModel()).toMatchObject({ conversationMode: EMMI_CONVERSATION_MODES.RESUME, greetingAllowed: false, lastUserTurn: "I will finish later" });
  });

  it("blocks an unexpected greeting during continuation and emits telemetry", () => {
    const onEvent = vi.fn();
    const manager = new EmmiConversationManager({ patientId: "p1", scenarioId: "access", storage: memoryStorage(), sessionStorage: memoryStorage(), onEvent });
    manager.markGreeted();
    expect(manager.guardAssistantText("Hola, María. Continuemos con su presión arterial.")).toBe("María. Continuemos con su presión arterial.");
    expect(onEvent).toHaveBeenCalledWith("EMMI_UNEXPECTED_GREETING", expect.objectContaining({ mode: EMMI_CONVERSATION_MODES.CONTINUATION }));
  });

  it("keeps the latest Gemini session resumption handle", () => {
    const manager = new EmmiConversationManager({ patientId: "p1", scenarioId: "access", storage: memoryStorage(), sessionStorage: memoryStorage() });
    manager.updateResumption({ handle: "resume-123", resumable: true });
    expect(manager.contextForModel()).toMatchObject({ sessionResumptionHandle: "resume-123", sessionResumable: true });
  });

  it("preserves the same conversation when the patient changes EN to Kreyòl to ES", () => {
    const manager = new EmmiConversationManager({ patientId: "p1", scenarioId: "access", locale: "EN", storage: memoryStorage(), sessionStorage: memoryStorage(), now: () => 3000 });
    manager.markGreeted();
    manager.transition({ currentScreen: "CARE_RECOMMENDATION", currentStage: "YOUR_CARE", locale: "EN" });
    manager.recordTurn("user", "What is ACCESS?", { intent: "program explanation" });
    const sessionId = manager.contextForModel().conversationSessionId;
    manager.transition({ currentScreen: "CARE_RECOMMENDATION", currentStage: "YOUR_CARE", locale: "KR" }, { localeChanged: true });
    expect(manager.contextForModel()).toMatchObject({ conversationSessionId: sessionId, conversationMode: EMMI_CONVERSATION_MODES.LOCALE_CHANGE, greetingAllowed: false, hasGreeted: true, lastUserIntent: "program explanation" });
    expect(manager.contextForModel().conversationSummary).toContain("What is ACCESS?");
    manager.transition({ currentScreen: "CARE_RECOMMENDATION", currentStage: "YOUR_CARE", locale: "ES" }, { localeChanged: true });
    expect(manager.contextForModel()).toMatchObject({ conversationSessionId: sessionId, conversationMode: EMMI_CONVERSATION_MODES.LOCALE_CHANGE, greetingAllowed: false, hasGreeted: true });
  });
});
