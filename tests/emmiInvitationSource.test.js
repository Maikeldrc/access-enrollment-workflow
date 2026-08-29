import { describe, expect, it, vi } from "vitest";
import { EmmiTextOrchestrator } from "../src/emmi/textOrchestrator.js";

// "Who invited me?" is a question about the invitation, and the invitation is runtime data. These
// tests hold EMMI to answering from it: the referring physician when there is one, ITERA when there
// is not, and never a reason, a date or a practice the context never supplied.
function harness({ locale = "EN", enrollment = {}, enrollmentFails = false } = {}) {
  const calls = [];
  const executeTool = vi.fn(async (name, args) => {
    calls.push({ name, args });
    if (name === "getEnrollmentContext") {
      if (enrollmentFails) throw new Error("context_unavailable");
      return { program: "ACCESS", accessTrack: "eCKM", enrollmentSource: "Provider / Practice Referral", referralOrigin: "physician", physicianDisplayName: "Dr. Fresner", eligibilityStatus: "ELIGIBLE", ...enrollment };
    }
    if (name === "getCareTeam") return { physicianDisplayName: "Dr. Fresner" };
    if (name === "searchKnowledge") return { intent: "PROGRAM_EXPLANATION", passages: [] };
    throw new Error(`unexpected ${name}`);
  });
  const orchestrator = new EmmiTextOrchestrator({
    getContext: () => ({ locale, program: "ACCESS", currentScreen: "INVITATION", patientId: "DEMO-P001", accessTrack: "eCKM" }),
    getConversation: () => ({ conversationSessionId: "conv-1", conversationSummary: "", recentTurns: [] }),
    executeTool,
    screenExplanation: () => "This screen explains the available care.",
    fetchImpl: vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ error: "gemini_not_configured" }) })),
    onEvent: () => {}
  });
  return { orchestrator, calls };
}

describe("EMMI answers who invited the patient", () => {
  it("names the referring physician's care team from runtime context, not the screen", async () => {
    const { orchestrator, calls } = harness();
    const answer = await orchestrator.answer("Who invited me?");
    expect(answer.trace.intent).toBe("INVITATION_SOURCE");
    expect(answer.trace.responseMode).toBe("RUNTIME_GROUNDED");
    expect(calls.map(call => call.name)).toContain("getEnrollmentContext");
    expect(answer.text).toMatch(/Dr\. Fresner’s care team invited you to learn about ACCESS care/);
  });

  it("treats “why am I receiving this” as the same question", async () => {
    const { orchestrator } = harness();
    const answer = await orchestrator.answer("Why am I receiving this?");
    expect(answer.trace.intent).toBe("INVITATION_SOURCE");
    expect(answer.text).toMatch(/Dr\. Fresner’s care team/);
  });

  it("adds no reason, date, practice or diagnosis the context never supplied", async () => {
    const { orchestrator } = harness();
    const answer = await orchestrator.answer("Who referred me?");
    expect(answer.text).not.toMatch(/hypertension|blood pressure|Fresner Medical Group|because|last visit|\b20\d\d\b/i);
    // Being invited is not being enrolled, and the answer has to keep saying so.
    expect(answer.text).toMatch(/voluntary/i);
    expect(answer.text).toMatch(/not enrolled/i);
  });

  it("says ITERA invited them when no physician referred the patient", async () => {
    const { orchestrator } = harness({ enrollment: { enrollmentSource: "ITERA Direct Outreach", referralOrigin: null, physicianDisplayName: null } });
    const answer = await orchestrator.answer("Who invited me?");
    expect(answer.text).toMatch(/ITERA HEALTH invited you to learn about ACCESS care/);
    expect(answer.text).not.toMatch(/Dr\./);
  });

  it("answers in the patient's language", async () => {
    const spanish = await harness({ locale: "ES" }).orchestrator.answer("¿Quién me invitó?");
    expect(spanish.text).toMatch(/El equipo de Dr\. Fresner le invitó a conocer el cuidado ACCESS/);
    const creole = await harness({ locale: "KR" }).orchestrator.answer("Ki moun ki envite m?");
    expect(creole.text).toMatch(/Ekip swen Dr\. Fresner envite w aprann sou swen ACCESS/);
  });

  it("says it cannot confirm rather than guessing when the context is unavailable", async () => {
    const { orchestrator } = harness({ enrollmentFails: true });
    const answer = await orchestrator.answer("Who invited me?");
    expect(answer.text).toMatch(/don’t have enough approved information/i);
    expect(answer.text).not.toMatch(/Dr\. Fresner/);
  });

  it("does not swallow a question about whether the patient keeps their own doctor", async () => {
    const { orchestrator } = harness();
    const answer = await orchestrator.answer("Who is my doctor?");
    expect(answer.trace.intent).toBe("CARE_TEAM_QUESTION");
  });
});
