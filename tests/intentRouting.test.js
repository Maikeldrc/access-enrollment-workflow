import { describe, expect, it } from "vitest";
import { classifyQuestion } from "../server/emmiKnowledge.js";

const intentOf = question => classifyQuestion(question, { program: "ACCESS" });

// Routing decides whether a sentence reaches a safety path, a patient-data tool, or a knowledge
// page. These cases are the ones where getting it wrong is not a worse answer but an unsafe one.

describe("medication safety routing", () => {
  // Every one of these reached MEDICATION or OTHER with mustNotAnswerAlone false, which left EMMI
  // free to answer a patient who had stopped their medication or taken a double dose from general
  // knowledge alone.
  it.each([
    "I stopped taking my medication because it made me sick",
    "I accidentally took two doses",
    "I took twice my dose",
    "I skipped my pills yesterday",
    "I missed my medication this morning",
    "Dejé de tomar mi medicamento",
    "Tomé dos dosis por error"
  ])("routes %s to medication safety and forbids answering alone", question => {
    const result = intentOf(question);
    expect(result.intent).toBe("MEDICATION_SAFETY");
    expect(result.mustNotAnswerAlone).toBe(true);
    expect(result.riskLevel).toBe("high");
  });

  it("does not treat ordinary medication talk as a safety event", () => {
    // Over-matching here would turn every medication question into an escalation and teach the
    // patient to ignore the ones that matter.
    for (const question of [
      "I take my medication every day",
      "What is my medication for?",
      "What medications am I on?",
      "When should I take my medication?"
    ]) {
      expect(intentOf(question).intent, question).not.toBe("MEDICATION_SAFETY");
    }
  });
});

describe("clinical safety takes precedence", () => {
  it("answers a symptom with safety even when the patient asks for an appointment", () => {
    const result = intentOf("I have chest pain and need an appointment");
    expect(result.intent).toBe("CLINICAL_SAFETY");
    expect(result.requiredTool).toBe("evaluateClinicalEscalation");
    expect(result.mustNotAnswerAlone).toBe(true);
  });

  it("treats a reported reading as a safety question, not a knowledge one", () => {
    for (const question of ["My blood pressure is 190 over 120", "My bp is 186/122"]) {
      expect(intentOf(question).intent, question).toBe("CLINICAL_SAFETY");
    }
  });
});

describe("reaching a person", () => {
  // Patients name the person rather than the department. "Talk with my doctor" and "help from my
  // nurse" previously matched no rule at all and fell through to generic handling.
  it.each([
    "Talk with my care team",
    "Talk with my doctor",
    "I need help from my nurse",
    "Can my care manager call me?",
    "I want to speak with my cardiologist",
    "Hablar con mi médico"
  ])("routes %s to human support rather than nothing", question => {
    expect(intentOf(question).intent).toBe("HUMAN_SUPPORT");
  });
});

describe("general knowledge versus this patient", () => {
  it("answers a definition from knowledge and a personal question from runtime", () => {
    expect(intentOf("What is Medigap?").requiredTool).toBeNull();
    expect(intentOf("What is coinsurance?").requiredTool).toBeNull();
    expect(intentOf("Do I have Medigap?").requiredTool).toBe("getPatientCoverage");
    expect(intentOf("Do I have Medicare?").requiredTool).toBe("getPatientCoverage");
    expect(intentOf("¿Tengo seguro suplementario?").requiredTool).toBe("getPatientCoverage");
    expect(intentOf("How much will I pay?").requiredTool).toBe("getExpectedAccessCost");
  });
});
