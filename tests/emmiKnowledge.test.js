import { describe, expect, it } from "vitest";
import { SOURCE_PRIORITY, TOOL_FIRST_INTENTS, buildKnowledgeIndex, classifyQuestion, getKnowledgeIndex, retrieveKnowledge } from "../server/emmiKnowledge.js";
import { EMMI_TOOL_DECLARATIONS } from "../src/emmi/tools.js";
import { EMMI_SYSTEM_PROMPT, buildEmmiSystemInstruction } from "../src/emmi/systemPrompt.js";

const index = getKnowledgeIndex();
const sourcesFor = (query, runtime = {}) => retrieveKnowledge({ query, runtime, index }).chunks.map(chunk => chunk.sourcePath);

describe("knowledge loading and metadata", () => {
  it("loads every knowledge document and skips maintenance files", () => {
    expect(index.documentCount).toBeGreaterThan(30);
    const paths = index.documents.map(doc => doc.path);
    expect(paths).toContain("programs/access.md");
    expect(paths).toContain("medicare/cost-sharing.md");
    expect(paths).toContain("safety/emergencies.md");
    for (const name of ["README.md", "CHANGELOG.md", "source-registry.md"]) expect(paths).not.toContain(name);
  });

  it("parses the front matter into typed metadata", () => {
    const access = index.chunks.find(chunk => chunk.sourcePath === "programs/access.md");
    expect(access.metadata).toMatchObject({
      id: "program-access",
      title: "Medicare ACCESS Model",
      category: "program",
      program: "ACCESS",
      riskLevel: "medium",
      requiresPatientContext: true,
      requiresToolWhenPersonalized: true
    });
    expect(access.metadata.lastReviewed).toBeTruthy();
  });

  it("chunks on headings and keeps chunks small enough to inject", () => {
    expect(index.chunks.length).toBeGreaterThan(index.documentCount);
    for (const chunk of index.chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(2000);
      expect(chunk.text.trim()).not.toBe("");
    }
    // A rebuild is deterministic, so the index can be safely cached and invalidated.
    expect(buildKnowledgeIndex().chunks.length).toBe(index.chunks.length);
  });
});

describe("intent and risk routing", () => {
  it("sends personal questions to a runtime tool instead of static text", () => {
    expect(classifyQuestion("Am I eligible for ACCESS?").requiredTool).toBe(TOOL_FIRST_INTENTS.ELIGIBILITY);
    expect(classifyQuestion("How much will I pay?").requiredTool).toBe(TOOL_FIRST_INTENTS.COST);
    expect(classifyQuestion("Which monitor do I have?").requiredTool).toBe(TOOL_FIRST_INTENTS.DEVICE);
    expect(classifyQuestion("What should I do next?").requiredTool).toBe(TOOL_FIRST_INTENTS.NEXT_STEP);
  });

  it("leaves conceptual questions to the knowledge base", () => {
    for (const question of ["What is CCM?", "What is remote patient monitoring?", "What is a Care Circle?", "What does Original Medicare mean?"]) {
      expect(classifyQuestion(question).requiredTool, question).toBeNull();
    }
  });

  it("routes clinical and medication safety away from free-form knowledge", () => {
    const bp = classifyQuestion("My blood pressure is 190");
    expect(bp.intent).toBe("CLINICAL_SAFETY");
    expect(bp.riskLevel).toBe("high");
    expect(bp.requiredTool).toBe("evaluateClinicalEscalation");
    expect(classifyQuestion("I have chest pain").requiredTool).toBe("evaluateClinicalEscalation");
    expect(classifyQuestion("Should I stop taking my medication?").intent).toBe("MEDICATION_SAFETY");
    expect(classifyQuestion("Should I stop taking my medication?").riskLevel).toBe("high");
  });

  it("classifies personal phrasing in Spanish and Kreyòl too", () => {
    expect(classifyQuestion("¿Cuánto voy a pagar yo?").requiredTool).toBe(TOOL_FIRST_INTENTS.COST);
    expect(classifyQuestion("Èske mwen kalifye?").requiredTool).toBe(TOOL_FIRST_INTENTS.ELIGIBILITY);
    expect(classifyQuestion("¿Soy elegible?").requiredTool).toBe(TOOL_FIRST_INTENTS.ELIGIBILITY);
    expect(classifyQuestion("¿Qué medicamentos tienen registrados?").requiredTool).toBe("getMedicationList");
    expect(classifyQuestion("¿Qué monitor tengo?").requiredTool).toBe("getAssignedDevice");
  });
});

describe("retrieval", () => {
  it("finds the specific program document for a program question", () => {
    expect(sourcesFor("What is CCM?")).toContain("programs/ccm.md");
    expect(sourcesFor("What is remote patient monitoring?")).toContain("programs/rpm.md");
    expect(sourcesFor("What is ACCESS?")).toContain("programs/access.md");
  });

  it("retrieves both program sources for an explicit ACCESS versus CCM comparison", () => {
    const sources = sourcesFor("What is the difference between ACCESS and CCM?", { program: "ACCESS" });
    expect(sources).toContain("programs/access.md");
    expect(sources).toContain("programs/ccm.md");
  });

  it("answers company, care and enrollment questions from their own documents", () => {
    expect(sourcesFor("What is ITERA HEALTH?").some(path => /itera-health/.test(path))).toBe(true);
    expect(sourcesFor("Can my daughter help me?").some(path => /care-circle/.test(path))).toBe(true);
    expect(sourcesFor("Why do I need to review my medications?")).toContain("care/medications.md");
    expect(sourcesFor("Why are you asking me about my goals?")).toContain("care/patient-goals.md");
    expect(sourcesFor("What does QMB mean?")).toContain("medicare/qmb.md");
  });

  it("prioritises safety documents for a safety question", () => {
    const safety = retrieveKnowledge({ query: "I have chest pain", index });
    expect(safety.chunks[0].category).toBe("safety");
    expect(safety.riskLevel).toBe("high");
    expect(safety.requiredTool).toBe("evaluateClinicalEscalation");
  });

  it("keeps a program's context out of an unrelated program's answer", () => {
    const ccm = sourcesFor("What happens next?", { program: "CCM" });
    expect(ccm.some(path => /programs\/(rpm|tcm|bhi|apcm)\.md/.test(path))).toBe(false);
    // The combined program legitimately spans both halves of its care.
    const combined = retrieveKnowledge({ query: "Why do I need this?", runtime: { program: "CCM_RPM" }, index });
    expect(combined.chunks.every(chunk => !chunk.program || ["CCM", "RPM", "CCM_RPM"].includes(chunk.program))).toBe(true);
  });

  it("uses the current screen to resolve a vague question", () => {
    const onMedications = sourcesFor("Why are you asking me this?", { currentScreen: "MEDICATIONS_REVIEW" });
    expect(onMedications.some(path => path.startsWith("care/"))).toBe(true);
  });

  it("prefers the specialised document over the master file and never duplicates a source", () => {
    const result = retrieveKnowledge({ query: "What is CCM?", index });
    const master = result.chunks.findIndex(chunk => /master/.test(chunk.sourcePath));
    const specific = result.chunks.findIndex(chunk => chunk.sourcePath === "programs/ccm.md");
    expect(specific).toBeGreaterThanOrEqual(0);
    if (master >= 0) expect(specific).toBeLessThan(master);
    expect(new Set(result.chunks.map(chunk => chunk.sourceId)).size).toBe(result.chunks.length);
  });

  it("returns a small, bounded number of passages", () => {
    const result = retrieveKnowledge({ query: "What is Medicare cost sharing?", topK: 4, index });
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks.length).toBeLessThanOrEqual(4);
  });

  it("marks a personalised cost question as needing the cost tool even when knowledge matches", () => {
    const result = retrieveKnowledge({ query: "How much will ACCESS cost me?", runtime: { program: "ACCESS" }, index });
    expect(result.requiredTool).toBe("getExpectedAccessCost");
    expect(result.chunks.some(chunk => chunk.requiresToolWhenPersonalized)).toBe(true);
  });

  it("retrieves the ACCESS beneficiary overview across natural patient phrasings", () => {
    for (const question of ["What is ACCESS?", "What is this ACCESS thing?", "What program did my doctor refer me to?"]) {
      expect(sourcesFor(question, { program: "ACCESS" }), question).toContain("programs/access-beneficiary-overview.md");
    }
  });

  it("retrieves comparison-group rules across paraphrases", () => {
    for (const question of ["What is the comparison group?", "Why was I randomly selected?", "Why can’t I join for 12 months?"]) {
      expect(sourcesFor(question, { program: "ACCESS" }), question).toContain("programs/access-eligibility-tracks.md");
    }
  });

  it("retrieves eCKM blood-pressure outcome semantics and arithmetic context", () => {
    for (const question of ["What is the ACCESS blood pressure target?", "What does 15 mmHg improvement mean?", "Is 137 my target if I started at 152?"]) {
      expect(sourcesFor(question, { program: "ACCESS" }), question).toContain("programs/access-eckm-outcomes.md");
    }
  });

  it("retrieves eCKM baseline-lab applicability without inventing a diagnosis", () => {
    for (const question of ["Why do you need A1c if I’m not diabetic?", "Why do you need cholesterol if I have hypertension?"]) {
      expect(sourcesFor(question, { program: "ACCESS" }), question).toContain("programs/access-eckm-outcomes.md");
    }
  });

  it("retrieves connected-device technique and provider-coordination guidance", () => {
    expect(sourcesFor("How do I use my blood pressure monitor correctly?", { program: "ACCESS" })).toContain("devices/access-connected-bp-monitor.md");
    expect(sourcesFor("Will my doctor get care updates?", { program: "ACCESS" })).toContain("programs/access-provider-coordination.md");
  });
});

describe("source hierarchy and wiring", () => {
  it("ranks the knowledge base below every runtime source", () => {
    expect(SOURCE_PRIORITY.ITERA_KNOWLEDGE_BASE).toBeGreaterThan(SOURCE_PRIORITY.PATIENT_RUNTIME);
    expect(SOURCE_PRIORITY.ITERA_KNOWLEDGE_BASE).toBeGreaterThan(SOURCE_PRIORITY.CLINICAL_SAFETY_RULES);
    expect(SOURCE_PRIORITY.ITERA_KNOWLEDGE_BASE).toBeGreaterThan(SOURCE_PRIORITY.ITERA_CONFIGURATION);
    expect(SOURCE_PRIORITY.ITERA_KNOWLEDGE_BASE).toBeLessThan(SOURCE_PRIORITY.GENERAL_MODEL_KNOWLEDGE);
  });

  it("exposes searchKnowledge alongside the existing patient tools, without replacing them", () => {
    const names = EMMI_TOOL_DECLARATIONS[0].functionDeclarations.map(tool => tool.name);
    expect(names).toContain("searchKnowledge");
    for (const existing of ["getEnrollmentContext", "getExpectedAccessCost", "getAssignedDevice", "checkDeviceConnection", "evaluateClinicalEscalation", "requestCallback", "createCareTeamTask"]) {
      expect(names, existing).toContain(existing);
    }
  });

  it("tells the model that knowledge never establishes patient facts", () => {
    expect(EMMI_SYSTEM_PROMPT).toContain("SOURCES OF TRUTH");
    expect(EMMI_SYSTEM_PROMPT).toMatch(/never establishes what is true for this patient/i);
    expect(EMMI_SYSTEM_PROMPT).toMatch(/KR is never Korean/i);
  });

  it("injects an explicit Haitian Creole instruction for internal locale KR", () => {
    const instruction = buildEmmiSystemInstruction({ locale: "KR", currentScreen: "INVITATION" });
    expect(instruction).toMatch(/Speak naturally in Haitian Creole \(Kreyòl\)/);
    expect(instruction).toMatch(/Never speak Korean/);
    expect(instruction).not.toMatch(/Speak naturally in Korean/i);
  });

  it("keeps no patient identifiers in the knowledge corpus", () => {
    const corpus = index.chunks.map(chunk => chunk.text).join("\n");
    expect(corpus).not.toMatch(/patient_demo|1EG4TE5MK73|05\/12\/195\d/);
  });
});
