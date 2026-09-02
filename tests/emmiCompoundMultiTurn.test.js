import { describe, expect, it, vi } from "vitest";
import { EmmiTextOrchestrator } from "../src/emmi/textOrchestrator.js";

// A patient asks two things in one breath, and keeps talking about the first thing without naming
// it again. Both were losing information: the second half of a compound question was dropped in
// silence, and a follow-up reached retrieval with nothing to rank on.

const passage = (id, heading, text) => ({ sourceId: id, sourcePath: `${id}.md`, heading, text });

function harness({ locale = "EN", conversation = {}, escalation = "CONTINUE", appointmentPrep = null } = {}) {
  const calls = [];
  const executeTool = vi.fn(async (name, args) => {
    calls.push({ name, args });
    if (name === "searchKnowledge") return { intent: "PROGRAM_EXPLANATION", passages: [passage("programs/access", "ACCESS", "Approved patient-facing concepts")] };
    if (name === "getExpectedAccessCost") return { grossBeneficiaryResponsibility: 6, expectedPatientPayment: 0, currency: "USD", responsibilityType: "EXPECTED", explanationCode: "SUPPLEMENTAL_COVERS_COST_SHARE" };
    if (name === "getUpcomingAppointments") return { appointments: [{ id: "APPT-1", patientStatus: "Appointment confirmed", providerDisplayName: "Dr. Martinez", specialty: "Cardiology", scheduledAt: "2026-09-08T14:00:00.000Z", modality: "IN_PERSON" }] };
    if (name === "evaluateClinicalEscalation") return { instruction: escalation };
    if (name === "getEnrollmentContext") return { eligibilityStatus: "ELIGIBLE" };
    if (name === "getCareTeam") return { physicianDisplayName: "Dr. Fresner", members: [] };
    if (name === "getAssignedDevice") return { found: true, displayName: "Tenovi Connected Blood Pressure Monitor", deviceId: "TEN-8842", integrationStatus: "CONNECTED", fulfillmentStatus: "NOT_REQUESTED", shipmentStatus: null };
    return {};
  });
  const orchestrator = new EmmiTextOrchestrator({
    getContext: () => ({ locale, program: "ACCESS", currentScreen: "CARE_RECOMMENDATION", patientId: "DEMO-P001", activeGoal: { id: "goal-bp" }, appointmentPrep }),
    getConversation: () => ({ conversationSessionId: "conv-1", conversationSummary: conversation.summary || "", recentTurns: conversation.turns || [] }),
    executeTool,
    screenExplanation: () => "This screen explains the available care.",
    fetchImpl: vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    onEvent: () => {}
  });
  const queries = () => calls.filter(item => item.name === "searchKnowledge").map(item => item.args.query);
  return { orchestrator, calls, queries };
}

describe("compound questions", () => {
  it("answers both halves instead of the first one only", async () => {
    const { orchestrator } = harness();
    const result = await orchestrator.answer("What is ACCESS and how much does it cost?");
    expect(result.trace.intent).toBe("COMPOUND_QUESTION");
    expect(result.trace.compoundParts).toHaveLength(2);
    // The programme explanation and the patient's own cost, not one at the expense of the other.
    expect(result.text).toMatch(/ACCESS/i);
    expect(result.text).toMatch(/\$0/);
  });

  it("records what each half resolved to", async () => {
    const { orchestrator } = harness();
    const result = await orchestrator.answer("Who is on my care team and when is my next appointment?");
    expect(result.trace.partIntents).toHaveLength(2);
    expect(result.trace.toolCalls.length).toBeGreaterThan(1);
  });

  // Half of "my chest hurts and when is my appointment" is not a question about an appointment.
  it("never decomposes a turn the emergency gate claims", async () => {
    const { orchestrator } = harness({ escalation: "CALL_911" });
    const result = await orchestrator.answer("my chest hurts and when is my appointment");
    expect(result.trace.intent).toBe("CLINICAL_SAFETY");
    expect(result.trace.compoundParts).toBeUndefined();
    expect(result.priority).toBe("CRITICAL_SAFETY");
  });

  it("never decomposes a turn the medication gate claims", async () => {
    const { orchestrator } = harness();
    const result = await orchestrator.answer("I forgot to take my dose and when is my next appointment?");
    expect(result.trace.intent).toBe("MEDICATION_SAFETY");
    expect(result.trace.compoundParts).toBeUndefined();
  });

  it("leaves an ordinary single question exactly as it was", async () => {
    const { orchestrator } = harness();
    const result = await orchestrator.answer("How much does ACCESS cost?");
    expect(result.trace.intent).not.toBe("COMPOUND_QUESTION");
    expect(result.text).toMatch(/\$0/);
  });

  it("does not repeat itself when both halves resolve the same way", async () => {
    const { orchestrator } = harness();
    const result = await orchestrator.answer("How much does it cost and what will I pay?");
    const paragraphs = result.text.split("\n\n").filter(Boolean);
    expect(new Set(paragraphs).size).toBe(paragraphs.length);
  });
});

describe("follow-up questions", () => {
  const aboutTheMonitor = {
    turns: [
      { role: "user", text: "Tell me about the blood pressure monitor" },
      { role: "assistant", text: "Your monitor sends readings automatically." }
    ]
  };

  it("carries the subject the patient stopped repeating into retrieval", async () => {
    const { orchestrator, queries } = harness({ conversation: aboutTheMonitor });
    await orchestrator.answer("and is that private?");
    expect(queries().at(-1)).toMatch(/monitor/i);
  });

  it("carries the subject through a bare referent", async () => {
    const { orchestrator, queries } = harness({ conversation: aboutTheMonitor });
    await orchestrator.answer("who else can see it");
    expect(queries().at(-1)).toMatch(/monitor/i);
  });

  it("leaves a question that names its own subject alone", async () => {
    const { orchestrator, queries } = harness({ conversation: aboutTheMonitor });
    await orchestrator.answer("What is Medigap?");
    expect(queries().at(-1)).not.toMatch(/monitor/i);
  });

  it("invents no subject when the conversation never named one", async () => {
    const { orchestrator, queries } = harness({ conversation: { turns: [{ role: "user", text: "hello" }] } });
    await orchestrator.answer("and what about that?");
    expect(queries().at(-1)).not.toMatch(/monitor|medication|appointment/i);
  });

  // The programme's $0 is true of the programme. Said about a monitor or a prescription it is a
  // promise this product cannot make, so a cost question about one of those is left to the route
  // that actually knows the answer — including when the subject came from an earlier turn.
  it("does not answer a cost question naming the monitor with the programme's price", async () => {
    const { orchestrator, calls } = harness({ conversation: aboutTheMonitor });
    const result = await orchestrator.answer("does the monitor cost anything?");
    expect(calls.some(call => call.name === "getExpectedAccessCost")).toBe(false);
    expect(result.trace.intent).not.toBe("COST_QUESTION");
  });

  // A subject inherited from an earlier turn ranks documents; it must not redirect a route. After a
  // question about the monitor, "am I going to get a bill for this?" is still a question this
  // patient's own record can answer, and answering it vaguely takes their $0 away from them.
  // "Will I get a bill?" is a money question, and it was reaching the model instead of the record,
  // so whether the patient was told their $0 depended on how the model felt that day.
  it("answers a question about being billed from the patient's own record", async () => {
    const { orchestrator, calls } = harness();
    const result = await orchestrator.answer("Am I going to get a bill for this?");
    expect(calls.some(call => call.name === "getExpectedAccessCost")).toBe(true);
    expect(result.text).toMatch(/\$0/);
  });

  it("still gives the patient their own cost after an unrelated turn about the monitor", async () => {
    const { orchestrator, calls } = harness({ conversation: aboutTheMonitor });
    const result = await orchestrator.answer("Will I have to pay for this?");
    expect(calls.some(call => call.name === "getExpectedAccessCost")).toBe(true);
    expect(result.text).toMatch(/\$0/);
  });

  it("still answers a cost question about the programme itself", async () => {
    const { orchestrator, calls } = harness({ conversation: aboutTheMonitor });
    await orchestrator.answer("How much does ACCESS cost?");
    expect(calls.some(call => call.name === "getExpectedAccessCost")).toBe(true);
  });

  // The half that names the subject hands it to the half that does not.
  it("passes the subject from one half of a compound to the other", async () => {
    const { orchestrator, queries } = harness();
    await orchestrator.answer("What is Medigap and is it private?");
    expect(queries().some(query => /medigap/i.test(query) && /private/i.test(query))).toBe(true);
  });
});

// The appointment coordination route answers a combined ride-and-companion request better than two
// split answers do, so decomposition yields to it - but it answers one thing. Given a turn whose
// other half is a reschedule, yielding made the reschedule disappear.
describe("yielding to the appointment coordination route", () => {
  const prep = { appointmentId: "APPT-1", emmiPreparation: { status: "NOT_STARTED" } };

  it("does not let a companion request swallow a reschedule", async () => {
    const { orchestrator } = harness({ appointmentPrep: prep });
    const result = await orchestrator.answer("My daughter wants to come with me but I also need to change the time.");
    expect(result.trace.intent).toBe("COMPOUND_QUESTION");
    expect(result.trace.compoundParts).toHaveLength(2);
  });

  it("still yields when the whole turn is coordination", async () => {
    const { orchestrator } = harness({ appointmentPrep: prep });
    const result = await orchestrator.answer("Can a family member come with me and how do we arrange it?");
    expect(result.trace.intent).not.toBe("COMPOUND_QUESTION");
  });
});
