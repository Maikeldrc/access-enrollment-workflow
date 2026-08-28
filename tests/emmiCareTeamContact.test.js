import { describe, expect, it, vi } from "vitest";
import { EmmiTextOrchestrator } from "../src/emmi/textOrchestrator.js";
import { CARE_TEAM_CONTACT_INTENT, detectCareTeamContact } from "../src/emmi/careTeamContact.js";
import { PROFESSIONAL_TYPES } from "../src/careTeamDirectory.js";

// Tapping "Talk with my care team" already reaches the support options. These tests are about the
// same request arriving as words: typed, or spoken through the live session, where it used to reach
// no intent at all and came back as an explanation of what a care team is.
const CARE_TEAM = [
  { id: "dr-rivera", displayName: "Dr. Alejandro Rivera", professionalType: PROFESSIONAL_TYPES.PRIMARY_CARE, specialty: "Primary Care", source: "REFERRING_PROVIDER" }
];

function harness({ locale = "EN", careTeam = CARE_TEAM, careTeamFails = false } = {}) {
  const executeTool = vi.fn(async name => {
    if (name === "getCareTeam") {
      if (careTeamFails) throw new Error("care_team_unavailable");
      return { physicianDisplayName: careTeam[0]?.displayName || null, enrollmentSource: "PROVIDER_PRACTICE_REFERRAL", members: careTeam };
    }
    if (name === "searchKnowledge") return { intent: "PROGRAM_EXPLANATION", passages: [{ sourceId: "program-access", sourcePath: "programs/access.md", heading: "ACCESS", text: "Approved" }] };
    if (name === "evaluateClinicalEscalation") return { instruction: "CALL_911", severity: "EMERGENCY" };
    throw new Error(`unexpected ${name}`);
  });
  const orchestrator = new EmmiTextOrchestrator({
    getContext: () => ({ locale, currentScreen: "CARE_RECOMMENDATION", program: "ACCESS", patientId: "DEMO-P002" }),
    getConversation: () => ({ conversationSessionId: "conv-1" }),
    executeTool,
    screenExplanation: () => "This screen explains the available care.",
    fetchImpl: vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    onEvent: () => {}
  });
  return { orchestrator, executeTool };
}

describe("reaching the care team is an action, not a question", () => {
  it.each([
    ["Talk with my care team", PROFESSIONAL_TYPES.UNKNOWN],
    ["I need to speak with my care team", PROFESSIONAL_TYPES.UNKNOWN],
    ["I want to talk to my doctor.", PROFESSIONAL_TYPES.PRIMARY_CARE],
    ["Can I contact my doctor?", PROFESSIONAL_TYPES.PRIMARY_CARE],
    ["Can my care manager call me?", PROFESSIONAL_TYPES.CARE_MANAGER],
    ["I want to ask my nurse something.", PROFESSIONAL_TYPES.NURSE],
    ["Can someone from my care team call me?", PROFESSIONAL_TYPES.UNKNOWN],
    ["Quiero hablar con mi médico", PROFESSIONAL_TYPES.PRIMARY_CARE],
    ["Hablar con mi equipo", PROFESSIONAL_TYPES.UNKNOWN],
    ["Pale ak ekip swen mwen an", PROFESSIONAL_TYPES.UNKNOWN]
  ])("recognises %s", (question, professionalType) => {
    expect(detectCareTeamContact({ question })).toMatchObject({ intent: CARE_TEAM_CONTACT_INTENT, professionalType });
  });

  // The boundary the router has to hold: asking to reach them is an action; asking about them,
  // about a doctor, or about a monitor is still a question.
  it.each([
    ["Talk with someone"],
    ["How can my care team help?"],
    ["Will I keep my doctor?"],
    ["Can I still see my doctors?"],
    ["Is my monitor connected?"],
    ["¿Conservaré a mi médico?"]
  ])("leaves %s alone", question => {
    expect(detectCareTeamContact({ question })).toBeNull();
  });

  it("maps the quick question id even when the label is translated", () => {
    expect(detectCareTeamContact({ question: "Pale ak ekip swen mwen an", questionId: "human-talk-care-team" })).toMatchObject({ intent: CARE_TEAM_CONTACT_INTENT });
  });

  it("answers from the care team record instead of retrieval", async () => {
    const { orchestrator, executeTool } = harness();
    const answer = await orchestrator.answer("I want to talk to my doctor.");
    expect(answer.trace.intent).toBe(CARE_TEAM_CONTACT_INTENT);
    expect(answer.trace.responseMode).toBe("OPERATIONAL_CARE_TEAM_CONTACT");
    expect(executeTool).toHaveBeenCalledWith("getCareTeam", { patientId: "DEMO-P002" });
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
    expect(answer.text).toContain("Dr. Alejandro Rivera");
    expect(answer.pendingAction).toBe("callback");
  });

  it("claims the request before human support can take it", async () => {
    const { orchestrator } = harness();
    const careTeam = await orchestrator.answer("Can someone from my care team call me?");
    const support = await orchestrator.answer("Talk with someone");
    expect(careTeam.trace.intent).toBe(CARE_TEAM_CONTACT_INTENT);
    expect(support.trace.intent).toBe("HUMAN_SUPPORT");
  });

  // EMMI can ask the ITERA care team to call. She cannot promise the named clinician will be the
  // one who does, so she never says so.
  it("offers the callback she can make without promising the clinician makes it", async () => {
    const { orchestrator } = harness();
    const answer = await orchestrator.answer("I want to talk to my doctor.");
    expect(answer.text).toMatch(/ask the ITERA care team to contact you/i);
    expect(answer.text).not.toMatch(/Dr\. Alejandro Rivera will (call|contact)/i);
  });

  it("says so when the person asked for is not on the record", async () => {
    const { orchestrator } = harness();
    const answer = await orchestrator.answer("Can my care manager call me?");
    expect(answer.text).toMatch(/don’t see that person listed/i);
    expect(answer.text).not.toContain("Dr. Alejandro Rivera");
  });

  it("stays in the patient's language", async () => {
    const { orchestrator } = harness({ locale: "KR" });
    const answer = await orchestrator.answer("Pale ak ekip swen mwen an", { questionId: "human-talk-care-team" });
    expect(answer.text).toMatch(/mande ekip swen ITERA a kontakte w/i);
  });

  it("fails operationally rather than falling back to retrieval", async () => {
    const { orchestrator, executeTool } = harness({ careTeamFails: true });
    const answer = await orchestrator.answer("Talk with my care team", { questionId: "human-talk-care-team" });
    expect(answer.trace.responseMode).toBe("OPERATIONAL_CARE_TEAM_CONTACT");
    expect(answer.pendingAction).toBe("callback");
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
  });

  // A request to reach a person never outranks the reason they may urgently need one.
  it("keeps clinical safety ahead of the request", async () => {
    const { orchestrator, executeTool } = harness();
    const answer = await orchestrator.answer("I have chest pain and want to talk to my doctor.");
    expect(answer.trace.responseMode).toBe("SAFETY_ENGINE");
    expect(executeTool).not.toHaveBeenCalledWith("getCareTeam", expect.anything());
  });
});
