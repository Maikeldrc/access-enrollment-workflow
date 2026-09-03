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
    expect(EMMI_SYSTEM_PROMPT).toMatch(/Tool names, arguments, JSON, function syntax.*never patient-facing/i);
    expect(EMMI_SYSTEM_PROMPT).toMatch(/never use raw transcript words as medicationId/i);
    expect(EMMI_SYSTEM_PROMPT).toMatch(/Never shorten this to “leave at any time”/i);
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

// The live voice re-test of 2026-08-30 found EMMI answering "that information is not in my sources"
// for the comparison group, and inventing "you can leave whenever you want" for the consent term.
// Neither fact was in a topic document: both lived only in the master file, which retrieval demotes
// to a fallback on purpose, so the specific documents filled every slot and the answer never
// travelled. Asserting which file was picked is not enough — one chunk per document is selected, so
// the assertion has to be that the retrieved TEXT carries the fact.
describe("the facts a patient is entitled to before agreeing", () => {
  const retrievedText = (query, runtime = { program: "ACCESS" }) =>
    retrieveKnowledge({ query, runtime, index }).chunks.map(chunk => chunk.text).join("\n\n");

  const COMPARISON_GROUP = [
    "En la elegibilidad de Medicare, ¿cómo se elige el grupo de comparación y qué consecuencia tiene para mí?",
    "How is the comparison group chosen and what does it mean for me?",
    "¿Qué es el grupo de comparación?"
  ];

  for (const question of COMPARISON_GROUP) {
    it(`states random selection and the twelve months for: ${question.slice(0, 46)}`, () => {
      const text = retrievedText(question);
      expect(text).toMatch(/randomly selected/i);
      expect(text).toMatch(/12 months/i);
      // The exclusion without the reassurance is a frightening half-answer.
      expect(text).toMatch(/do not change the patient's Medicare benefits, coverage, or rights/i);
    });
  }

  const LEAVING = [
    "Antes de inscribirme, ¿cuánto podría pagar al mes y desde cuándo puedo dejar ACCESS o cambiar de proveedor?",
    "¿Desde cuándo puedo dejar ACCESS o cambiar de proveedor?",
    "When can I leave ACCESS or change provider?",
    "Kilè mwen ka kite ACCESS oswa chanje founisè?"
  ];

  for (const question of LEAVING) {
    it(`carries the 90 day term for: ${question.slice(0, 46)}`, () => {
      expect(retrievedText(question)).toMatch(/90 days after enrollment/i);
    });
  }

  it("tells the model in as many words not to say the patient may leave whenever they want", () => {
    expect(retrievedText("¿Desde cuándo puedo dejar ACCESS?")).toMatch(/cuando quiera/i);
  });

  // The re-test expected the consent answer to contain "up to $6". It deliberately does not: the
  // amount depends on the patient's verified coverage, and a remembered figure is how EMMI once
  // told a patient $0 while their screen said $6. What knowledge owes the cost question is the
  // timing and the structure; the number comes from the engine, every time.
  it("still demands the cost engine for a cost question rather than answering from a page", () => {
    const asked = retrieveKnowledge({ query: "¿Cuánto voy a pagar al mes por ACCESS?", runtime: { program: "ACCESS" }, index });
    expect(asked.intent).toBe("COST");
    expect(asked.requiredTool).toBe("getExpectedAccessCost");
    expect(asked.chunks.map(chunk => chunk.text).join("\n")).toMatch(/financial responsibility engine/i);
  });

  it("hands the model each page's response rule even when another section of it won the slot", () => {
    const asked = retrieveKnowledge({ query: "¿Cuánto voy a pagar al mes por ACCESS?", runtime: { program: "ACCESS" }, index });
    const cost = asked.chunks.find(chunk => chunk.sourcePath === "programs/access-cost-sharing.md");
    // The section that outscored the rest of the page says nothing about where an amount may come
    // from; the rule forbidding EMMI to quote one is what makes the page safe to hand over.
    expect(cost.heading).not.toMatch(/EMMI response rule/i);
    expect(cost.text).toMatch(/Never state an amount from it/i);
  });

  it("carries no remembered amount that could be quoted in place of the engine's", () => {
    const priced = index.chunks.filter(chunk => /\$\d/.test(chunk.text) && !/emmi-master-knowledge/.test(chunk.sourcePath));
    // $0 is a permitted example because the pages exist to explain what $0 does and does not mean.
    expect(priced.filter(chunk => /\$(?!0\b)\d/.test(chunk.text)).map(chunk => chunk.sourcePath)).toEqual([]);
  });

  it("keeps every document in a category the router actually looks for", () => {
    // access-cost-sharing.md declared "programs" while the router only ever asks for "program",
    // so the document could never earn its category score.
    // The master file declares no front matter on purpose and is a fallback, so it is exempt: what
    // this catches is a document that declares a category nothing will ever ask for.
    const known = new Set(["program", "medicare", "enrollment", "device", "care", "safety", "company", "core", "billing", "communication"]);
    const strays = index.documents
      .filter(doc => doc.metadata.category && !known.has(doc.metadata.category))
      .map(doc => `${doc.path}:${doc.metadata.category}`);
    expect(strays).toEqual([]);
  });
});

// The 2026-08-30 production validation called this "generic ACCESS fallback ignores focused
// knowledge": five focused questions all came back with the same general ACCESS pages. Three of
// them had no page at all — eCKM and A1c existed only in the demoted master file, and the ACCESS
// outcome targets existed only in application code and nowhere in the corpus.
describe("focused questions reach focused knowledge", () => {
  const retrievedText = query =>
    retrieveKnowledge({ query, runtime: { program: "ACCESS" }, index }).chunks.map(chunk => chunk.text).join("\n\n");

  for (const [question, expected] of [
    ["What does eCKM mean?", /Early Cardio-Kidney-Metabolic/i],
    ["¿Qué es eCKM?", /Early Cardio-Kidney-Metabolic/i],
    ["What is the ACCESS blood pressure target?", /below 130 mmHg/i],
    ["¿Cuál es la meta de presión arterial de ACCESS?", /below 130 mmHg/i],
    ["Why do you need A1c if I'm not diabetic?", /Being asked for an A1c does not mean you have diabetes/i],
    ["¿Por qué necesitan A1c si no soy diabético?", /Being asked for an A1c does not mean you have diabetes/i]
  ]) {
    it(`answers from the page written for it: ${question.slice(0, 44)}`, () => {
      expect(retrievedText(question)).toMatch(expected);
    });
  }

  it("keeps the control target and the improvement milestone apart", () => {
    const text = retrievedText("What is the ACCESS blood pressure target?");
    expect(text).toMatch(/below 130 mmHg/i);
    expect(text).toMatch(/at least 15 mmHg below/i);
  });

  it("sends the patient's own target back to the runtime rather than answering it from a page", () => {
    expect(retrievedText("What is the ACCESS blood pressure target?")).toMatch(/getClinicalTarget/);
  });

  // The master file lists a monthly figure per track. The tracks page deliberately does not carry
  // it across: what a patient pays comes from the engine, for them and their track.
  it("does not let the tracks page quote an amount", () => {
    const tracks = index.chunks.filter(chunk => chunk.sourcePath === "programs/access-tracks.md");
    expect(tracks.length).toBeGreaterThan(0);
    expect(tracks.filter(chunk => /\$\d/.test(chunk.text)).map(chunk => chunk.heading)).toEqual([]);
  });
});

// A page answers in the language it is asked in.
//
// The corpus is written in English and read by patients in three. When the model is reachable it
// translates; when it is not, a Spanish or Creole patient was handed a general paragraph where an
// English speaker got the specific answer. Each page now carries its own answer per language, and
// retrieval has to put the right page in front of the question first.
describe("answering in the patient's language", () => {
  const topFor = (query, runtime = { program: "ACCESS" }) =>
    retrieveKnowledge({ query, runtime, index }).chunks[0];

  // Spanish and Creole, against an English corpus, with the words a patient would really use.
  const ROUTES = [
    ["¿Qué es ACCESS?", "programs/access.md"],
    ["¿Qué significa eCKM?", "programs/access-tracks.md"],
    ["¿Qué es el grupo de comparación?", "programs/access-evaluation.md"],
    ["¿Desde cuándo puedo dejar ACCESS?", "enrollment/leaving-access.md"],
    ["¿Cuál es la meta de presión de ACCESS?", "care/access-outcome-measures.md"],
    ["¿Por qué necesitan A1c si no soy diabético?", "care/access-a1c.md"],
    ["¿Por qué revisan mis medicamentos?", "care/medications.md"],
    ["¿Qué son mis objetivos?", "care/patient-goals.md"],
    ["¿Puede mi hija ayudarme?", "enrollment/care-circle.md"],
    ["¿Qué es Medicare Original?", "medicare/original-medicare.md"],
    ["¿Qué es QMB?", "medicare/qmb.md"],
    ["Kisa eCKM vle di?", "programs/access-tracks.md"],
    ["Kilè mwen ka kite ACCESS?", "enrollment/leaving-access.md"],
    ["Poukisa nou bezwen A1c?", "care/access-a1c.md"]
  ];

  for (const [question, expected] of ROUTES) {
    it(`reaches ${expected.split("/").pop()} for: ${question.slice(0, 38)}`, () => {
      expect(topFor(question)?.sourcePath).toBe(expected);
    });
  }

  it("carries the page's own answer in each language", () => {
    const top = topFor("¿Qué es el grupo de comparación?");
    expect(top.localizedAnswers.ES).toMatch(/seleccionadas al azar/i);
    expect(top.localizedAnswers.ES).toMatch(/12 meses/);
    expect(top.localizedAnswers.KR).toMatch(/o aza/i);
  });

  it("keeps the ninety days in the Spanish and Creole answers too", () => {
    const top = topFor("¿Desde cuándo puedo dejar ACCESS?");
    expect(top.localizedAnswers.ES).toMatch(/90 días después de la inscripción/);
    expect(top.localizedAnswers.KR).toMatch(/90 jou apre enskripsyon/);
  });

  // The translations are the answer, not a second copy of the page competing with it.
  it("never offers a localized answer as a retrievable chunk", () => {
    expect(index.chunks.filter(chunk => /^Patient answer/i.test(chunk.heading))).toEqual([]);
  });

  it("gives the general programme page the questions that name only the programme", () => {
    expect(topFor("¿Qué es ACCESS?")?.sourcePath).toBe("programs/access.md");
    // And withholds them the moment the question names something more specific.
    expect(topFor("¿Desde cuándo puedo dejar ACCESS?")?.sourcePath).not.toBe("programs/access.md");
  });

  it("does not let a programme's own page answer a question about a different programme", () => {
    expect(topFor("¿Qué es CCM?")?.sourcePath).toBe("programs/ccm.md");
  });

  it("still lets the current screen resolve a question that matches nothing", () => {
    const vague = retrieveKnowledge({ query: "¿Por qué me preguntan esto?", runtime: { currentScreen: "MEDICATIONS_REVIEW" }, index });
    expect(vague.chunks.some(chunk => chunk.sourcePath.startsWith("care/"))).toBe(true);
  });
});

// Every page a patient can land on answers in their language.
//
// The corpus is English. Coverage is what stops a Spanish or Creole patient getting the generic
// fallback where an English speaker gets the page, so it is asserted rather than sampled.
describe("translation coverage", () => {
  const NO_PATIENT_ANSWER = ["core/emmi-master-knowledge.md"];

  it("gives every page its own answer in Spanish and Creole", () => {
    const missing = index.documents
      .filter(doc => !NO_PATIENT_ANSWER.includes(doc.path))
      .filter(doc => {
        const lead = index.chunks.find(chunk => chunk.sourcePath === doc.path);
        return !lead?.localizedAnswers?.ES || !lead?.localizedAnswers?.KR;
      })
      .map(doc => doc.path);
    // The master file is the fallback for everything and answers no single question, so it has none.
    expect(missing).toEqual([]);
  });

  it("keeps a combined-programme page from claiming the single programme's question", () => {
    expect(sourcesFor("¿Qué es CCM?", { program: "ACCESS" })[0]).toBe("programs/ccm.md");
    expect(sourcesFor("¿Qué es RPM?", { program: "ACCESS" })[0]).toBe("programs/rpm.md");
  });
});
