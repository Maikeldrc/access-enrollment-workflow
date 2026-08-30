import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmmiTextOrchestrator } from "../src/emmi/textOrchestrator.js";
import { EmmiConversationManager } from "../src/emmi/conversationManager.js";
import { SAFETY_EPISODE_MAX_AGE_MS, createSafetyEpisode, detectSafetyResolution, safetyEpisodeIsActive } from "../src/emmi/safetyPolicy.js";

// The safety episode has to end.
//
// The 2026-08-30 production validation reported a release blocker: after one escalation, every
// later question came back as emergency instructions — eCKM, comparison groups, enrollment, cost,
// "what is ACCESS" — and stayed that way through explicit statements that 911 had been called and
// help had arrived, and through a page reload. The patient could not use EMMI again.
//
// Two causes. resolveSafetyEpisode existed on the conversation manager and nothing anywhere called
// it. And the sentences a patient uses to say help arrived contain the words that raise an
// emergency, so the gate read every attempt to close the episode as a new one and re-armed it.

const memoryStorage = () => {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) };
};

const harness = ({ storage = memoryStorage(), sessionStorage = memoryStorage(), locale = "EN", now = () => Date.now() } = {}) => {
  const conversation = new EmmiConversationManager({ patientId: "DEMO-P001", scenarioId: "access-happy", locale, storage, sessionStorage, now });
  const executeTool = vi.fn(async name => {
    if (name === "evaluateClinicalEscalation") return { instruction: "CALL_911" };
    if (name === "searchKnowledge") return { intent: "PROGRAM_EXPLANATION", passages: [{ id: "access", title: "ACCESS", text: "ACCESS is a Medicare care option." }] };
    if (name === "getEnrollmentContext") return { eligibilityStatus: "ELIGIBLE", enrollmentStatus: "COMPLETED" };
    if (name === "getExpectedAccessCost") return { expectedPatientPayment: 0, currency: "USD" };
    return {};
  });
  const orchestrator = new EmmiTextOrchestrator({
    getContext: () => ({ locale, program: "ACCESS", currentScreen: "MY_CARE", patientId: "DEMO-P001", accessTrack: "eCKM" }),
    getConversation: () => conversation.snapshot(),
    executeTool,
    screenExplanation: () => "This screen explains the available care.",
    fetchImpl: vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ error: "gemini_not_configured" }) })),
    onSafetyEpisode: episode => conversation.activateSafetyEpisode(episode),
    onSafetyResolved: resolution => conversation.resolveSafetyEpisode(resolution)
  });
  return { orchestrator, conversation, storage, sessionStorage };
};

const isEmergencyCopy = text => /call 911|llame al 911|rele 911/i.test(text);

describe("an emergency episode can be opened, and can be closed", () => {
  let kit;
  beforeEach(async () => {
    kit = harness();
    const opened = await kit.orchestrator.answer("I have chest pain and I feel dizzy");
    expect(isEmergencyCopy(opened.text)).toBe(true);
    expect(kit.conversation.snapshot().activeSafetyEpisode?.active).toBe(true);
  });

  it("holds every unrelated question while the episode is open", async () => {
    for (const question of ["What does eCKM mean?", "What is the comparison group?", "Am I enrolled now?", "What will I pay for ACCESS?"]) {
      const answer = await kit.orchestrator.answer(question);
      expect(isEmergencyCopy(answer.text), question).toBe(true);
    }
  });

  // The exact sentences from the production transcript that could not end it.
  for (const statement of [
    "I called 911 and emergency help is on the way.",
    "The emergency team is with me now.",
    "The paramedics are here",
    "I'm at the hospital"
  ]) {
    it(`closes on: ${statement}`, async () => {
      const answer = await kit.orchestrator.answer(statement);
      expect(answer.trace.intent).toBe("CLINICAL_SAFETY_RESOLVED");
      expect(isEmergencyCopy(answer.text)).toBe(false);
      const episode = kit.conversation.snapshot().activeSafetyEpisode;
      expect(episode.active).toBe(false);
      expect(episode.resolution).toBe("HUMAN_HELP_CONFIRMED");
      // The record of what happened stays; only the response mode ends.
      expect(episode.startedAt).toBeTruthy();
      expect(episode.resolvedAt).toBeTruthy();
    });
  }

  it("routes ordinary questions normally once the episode is closed", async () => {
    await kit.orchestrator.answer("I called 911, help is on the way");
    const answer = await kit.orchestrator.answer("What is ACCESS?");
    expect(isEmergencyCopy(answer.text)).toBe(false);
    expect(answer.trace.intent).not.toMatch(/CLINICAL_SAFETY/);
  });

  it("keeps the emergency instruction in the acknowledgement when the patient only says they feel better", async () => {
    const answer = await kit.orchestrator.answer("I'm feeling better now, the pain stopped");
    expect(kit.conversation.snapshot().activeSafetyEpisode.resolution).toBe("PATIENT_REPORTED_RECOVERED");
    // Believing the patient unblocks the app; it must not drop the instruction for a recurrence.
    expect(answer.text).toMatch(/call 911/i);
    expect(await kit.orchestrator.answer("What is ACCESS?").then(reply => isEmergencyCopy(reply.text))).toBe(false);
  });

  it("still escalates a genuinely new symptom reported during an open episode", async () => {
    const answer = await kit.orchestrator.answer("now I cannot breathe either");
    expect(isEmergencyCopy(answer.text)).toBe(true);
    expect(answer.trace.intent).toMatch(/CLINICAL_SAFETY/);
  });

  it("offers the care team rather than closing silently", async () => {
    const answer = await kit.orchestrator.answer("The paramedics are here");
    expect(answer.pendingAction).toBe("clinical-task");
  });
});

describe("the episode across reloads", () => {
  it("survives a reload while it is genuinely open", async () => {
    const storage = memoryStorage();
    const sessionStorage = memoryStorage();
    const first = harness({ storage, sessionStorage });
    await first.orchestrator.answer("I have chest pain");

    const reloaded = harness({ storage, sessionStorage });
    expect(reloaded.conversation.snapshot().activeSafetyEpisode?.active).toBe(true);
    expect(isEmergencyCopy((await reloaded.orchestrator.answer("What is ACCESS?")).text)).toBe(true);
  });

  it("does not come back once it has been resolved", async () => {
    const storage = memoryStorage();
    const sessionStorage = memoryStorage();
    const first = harness({ storage, sessionStorage });
    await first.orchestrator.answer("I have chest pain");
    await first.orchestrator.answer("I called 911 and help is here");

    const reloaded = harness({ storage, sessionStorage });
    expect(reloaded.conversation.snapshot().activeSafetyEpisode).toBeNull();
    expect(isEmergencyCopy((await reloaded.orchestrator.answer("What is ACCESS?")).text)).toBe(false);
  });

  it("expires on its own, so a patient returning later is not met with an emergency that is over", async () => {
    const storage = memoryStorage();
    const sessionStorage = memoryStorage();
    const first = harness({ storage, sessionStorage });
    await first.orchestrator.answer("I have chest pain");

    // Age the stored episode the way a night between two visits would.
    for (const [store, key] of [[storage, "itera.emmi.conversation.v1"], [sessionStorage, "itera.emmi.conversation.session.v1"]]) {
      const saved = JSON.parse(store.getItem(key) || "null");
      if (!saved) continue;
      for (const scope of Object.keys(saved)) {
        if (!saved[scope]?.activeSafetyEpisode) continue;
        saved[scope].activeSafetyEpisode.startedAt = Date.now() - SAFETY_EPISODE_MAX_AGE_MS - 1000;
      }
      store.setItem(key, JSON.stringify(saved));
    }

    const later = harness({ storage, sessionStorage });
    expect(later.conversation.snapshot().activeSafetyEpisode).toBeNull();
    expect(isEmergencyCopy((await later.orchestrator.answer("What is ACCESS?")).text)).toBe(false);
  });

  it("has not expired an hour in", () => {
    const started = Date.UTC(2026, 7, 30, 9, 0, 0);
    expect(safetyEpisodeIsActive(createSafetyEpisode({ now: started }), started + 60 * 60 * 1000)).toBe(true);
  });
});

describe("what counts as saying help arrived", () => {
  const helpConfirmed = [
    "I called 911 and emergency help is on the way.",
    "The emergency team is with me now.",
    "help is here",
    "The ambulance arrived",
    "I'm with a doctor",
    "Llamé al 911 y la ayuda viene en camino",
    "Los paramédicos ya están conmigo",
    "Estoy en el hospital",
    "Mwen rele 911, sekou a ap vini",
    "Mwen nan lopital"
  ];
  for (const statement of helpConfirmed) {
    it(`reads as a handoff: ${statement}`, () => expect(detectSafetyResolution(statement)).toBe("HUMAN_HELP_CONFIRMED"));
  }

  // Precision matters more than reach here: a false positive closes a real emergency.
  const mustNotClose = [
    "What is ACCESS?",
    "Am I enrolled now?",
    "What will I pay for ACCESS?",
    "I have chest pain",
    "Me duele el pecho",
    "Is that serious?",
    "can you help me here?",
    "I need help",
    "¿Puede ayudarme?"
  ];
  for (const statement of mustNotClose) {
    it(`does not close on: ${statement}`, () => expect(detectSafetyResolution(statement)).toBeNull());
  }
});
