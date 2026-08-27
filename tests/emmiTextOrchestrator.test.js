import { describe, expect, it, vi } from "vitest";
import { EmmiTextOrchestrator, expandEmmiQuery } from "../src/emmi/textOrchestrator.js";

const passage = (program, text = "Approved patient-facing concepts") => ({ sourceId: `program-${program.toLowerCase()}`, sourcePath: `programs/${program.toLowerCase()}.md`, heading: program, text });

function harness({ locale = "ES", program = "ACCESS", conversation = {}, retrievalFailure = false, knowledgePassages = null } = {}) {
  const calls = [];
  const events = [];
  const executeTool = vi.fn(async (name, args) => {
    calls.push({ name, args });
    if (name === "searchKnowledge") {
      if (retrievalFailure) throw new Error("knowledge_unavailable");
      const programs = ["ACCESS", "CCM", "RPM", "PCM", "APCM", "ASM"].filter(item => new RegExp(item, "i").test(args.query));
      return { intent: "PROGRAM_EXPLANATION", passages: knowledgePassages || (programs.length ? programs : [program]).map(item => passage(item)) };
    }
    if (name === "getExpectedAccessCost") return { expectedMonthlyCost: 6, estimatedOutOfPocketCost: null };
    if (name === "getEnrollmentContext") return { eligibilityStatus: "ELIGIBLE" };
    if (name === "getAssignedDevice") return { found: true, displayName: "Tenovi Connected Blood Pressure Monitor", deviceId: "TEN-8842", integrationStatus: "CONNECTED" };
    if (name === "getMedicationList") return { medications: [{ name: "Lisinopril", details: "10 mg", active: true }] };
    if (name === "getPatientGoals") return { goals: [{ title: "Mantener mi presión arterial bajo control" }] };
    if (name === "getCareTeam") return { physicianDisplayName: "Dr. Fresner" };
    if (name === "getNextBestAction") return { label: "Continuar" };
    if (name === "evaluateClinicalEscalation") return { instruction: "CALL_911" };
    throw new Error(`unexpected ${name}`);
  });
  const orchestrator = new EmmiTextOrchestrator({
    getContext: () => ({ locale, program, currentScreen: "CARE_RECOMMENDATION", patientId: "DEMO-P001", accessTrack: "eCKM" }),
    getConversation: () => ({ conversationSessionId: "conv-1", conversationSummary: conversation.summary || "", recentTurns: conversation.turns || [] }),
    executeTool,
    screenExplanation: () => locale === "ES" ? "Esta pantalla explica el cuidado disponible." : "This screen explains the available care.",
    fetchImpl: vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ error: "gemini_not_configured" }) })),
    onEvent: (type, detail) => events.push({ type, detail })
  });
  return { orchestrator, calls, events, executeTool };
}

describe("Ask EMMI answer-first orchestration", () => {
  it("answers ACCESS and CCM from different relevant knowledge instead of the same generic fallback", async () => {
    const { orchestrator } = harness();
    const access = await orchestrator.answer("¿Qué es ACCESS?");
    const ccm = await orchestrator.answer("¿Qué es CCM?");
    expect(access.text).toMatch(/opción de cuidado de Medicare/i);
    expect(ccm.text).toMatch(/Chronic Care Management/i);
    expect(access.text).not.toBe(ccm.text);
    expect(access.trace.responseMode).toBe("DETERMINISTIC_GROUNDED_FALLBACK");
    expect(access.text).not.toMatch(/Puedo explicar esta pantalla/i);
  });

  it("does not answer CCM + RPM when the patient asked only about CCM", async () => {
    const { orchestrator } = harness({
      locale: "EN",
      knowledgePassages: [passage("ACCESS"), passage("ccm-rpm"), passage("CCM")]
    });
    const answer = await orchestrator.answer("What is CCM?");
    expect(answer.text).toMatch(/Chronic Care Management/i);
    expect(answer.text).not.toMatch(/CCM \+ RPM combines/i);
  });

  it("resolves a comparison follow-up from recent ACCESS and CCM context", async () => {
    const { orchestrator } = harness({ conversation: { summary: "user: qué es ACCESS | assistant: ACCESS... | user: y CCM | assistant: CCM..." } });
    const answer = await orchestrator.answer("¿Y cuál es la diferencia?");
    expect(answer.trace.retrievalQuery).toMatch(/ACCESS CCM/i);
    expect(answer.text).toMatch(/ACCESS.*CCM|CCM.*ACCESS/i);
  });

  it.each([
    ["¿Cuánto voy a pagar?", "getExpectedAccessCost", /\$6/],
    ["¿Soy elegible?", "getEnrollmentContext", /puede continuar/],
    ["¿Qué monitor tengo?", "getAssignedDevice", /Tenovi/],
    ["¿Está conectado mi monitor?", "getAssignedDevice", /conectado/],
    ["¿Qué medicamentos tienen registrados?", "getMedicationList", /Lisinopril/],
    ["¿Cuál es mi meta?", "getPatientGoals", /presión arterial/],
    ["¿Mi médico sigue siendo mi médico?", "getCareTeam", /Dr\. Fresner/],
    ["¿Qué sigue?", "getNextBestAction", /Continuar/]
  ])("routes patient-specific question %s through %s", async (question, expectedTool, relevance) => {
    const { orchestrator, executeTool } = harness();
    const answer = await orchestrator.answer(question);
    expect(executeTool).toHaveBeenCalledWith(expectedTool, expect.any(Object));
    expect(answer.text).toMatch(relevance);
    expect(answer.trace.responseMode).toBe("RUNTIME_GROUNDED");
  });

  it("uses screen context only for an actual screen-help question", async () => {
    const { orchestrator, executeTool } = harness();
    const answer = await orchestrator.answer("¿Qué tengo que hacer en esta pantalla?");
    expect(answer.text).toBe("Esta pantalla explica el cuidado disponible.");
    expect(answer.trace.intent).toBe("CURRENT_SCREEN_HELP");
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
  });

  it("routes chest pain to deterministic safety before retrieval", async () => {
    const { orchestrator, executeTool } = harness();
    const answer = await orchestrator.answer("Tengo dolor fuerte en el pecho.");
    expect(executeTool).toHaveBeenCalledWith("evaluateClinicalEscalation", expect.any(Object));
    expect(answer.emergency).toBe(true);
    expect(answer.text).toMatch(/911/);
  });

  it("reports retrieval failure transparently instead of masking it as screen help", async () => {
    const { orchestrator, events } = harness({ retrievalFailure: true });
    const answer = await orchestrator.answer("¿Qué es CCM?");
    expect(answer.text).toMatch(/no puedo consultar esa información/i);
    expect(events.some(event => event.type === "EMMI_RETRIEVAL_FAILED")).toBe(true);
    expect(answer.text).not.toMatch(/Puedo explicar esta pantalla/i);
  });

  it("keeps Kreyòl as the active output language", async () => {
    const { orchestrator } = harness({ locale: "KR" });
    const answer = await orchestrator.answer("Kisa RPM ye?");
    expect(answer.text).toMatch(/RPM vle di/);
    expect(answer.text).not.toMatch(/[가-힣]/);
  });

  it.each([
    ["Kisa ACCESS ye?", /ACCESS se yon opsyon swen Medicare/i],
    ["Kisa CCM ye?", /CCM vle di Chronic Care Management/i]
  ])("answers the Kreyòl knowledge question %s in Kreyòl", async (question, expected) => {
    const { orchestrator } = harness({ locale: "KR" });
    const answer = await orchestrator.answer(question);
    expect(answer.text).toMatch(expected);
    expect(answer.text).not.toMatch(/[가-힣]/);
  });

  it.each([
    ["que es access", /opción de cuidado de Medicare/i],
    ["¿Qué es ACCESS?", /opción de cuidado de Medicare/i],
    ["que es ccm", /Chronic Care Management/i],
    ["¿Qué es RPM?", /monitoreo remoto/i],
    ["¿Cuál es la diferencia entre ACCESS y CCM?", /ACCESS.*CCM|CCM.*ACCESS/i],
    ["¿Esto es obligatorio?", /voluntari/i],
    ["¿Puedo dejar el programa?", /voluntaria.*terminar su participación/i]
  ])("answers required knowledge QA query %s", async (question, relevance) => {
    const { orchestrator } = harness();
    const answer = await orchestrator.answer(question);
    expect(answer.text).toMatch(relevance);
    expect(answer.trace.responseMode).toBe("DETERMINISTIC_GROUNDED_FALLBACK");
  });

  it("answers why medication review is needed from approved medication knowledge", async () => {
    const { orchestrator } = harness({
      knowledgePassages: [{ sourceId: "care-medications", sourcePath: "care/medications.md", heading: "Medication review", text: "Approved medication reconciliation guidance" }]
    });
    const answer = await orchestrator.answer("¿Por qué necesitan mis medicamentos?");
    expect(answer.text).toMatch(/ayuda al equipo a entender qué toma/i);
    expect(answer.trace.responseMode).toBe("DETERMINISTIC_GROUNDED_FALLBACK");
  });
});

describe("follow-up query expansion", () => {
  it("adds the two recent programs to a pronoun-like comparison", () => {
    expect(expandEmmiQuery({ question: "y cual es la diferencia", conversation: { conversationSummary: "ACCESS then CCM" }, program: "ACCESS" })).toMatch(/ACCESS CCM/);
  });
});
