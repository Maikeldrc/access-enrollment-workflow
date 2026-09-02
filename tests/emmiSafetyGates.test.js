import { describe, expect, it } from "vitest";
import { detectEmergencyLanguage, detectSafetyResolution, safetyResponseFor } from "../src/emmi/safetyPolicy.js";
import { EMERGENCY_SYMPTOM_PATTERN } from "../src/clinicalMonitoring.js";

// The gate decides which turns reach the clinical engine. It is not a verdict: the engine still
// returns CALL_911, a care team task, or continue. So a symptom belongs here whenever a clinician
// would want to see it, not only when it is certainly an emergency.
describe("the clinical symptom gate", () => {
  it("routes the symptoms a patient actually reports", () => {
    for (const phrase of ["I have severe chest pain", "I feel very dizzy", "I am light-headed", "me siento mareado", "mwen gen tèt vire"]) {
      expect(detectEmergencyLanguage(phrase), phrase).toBe(true);
    }
  });

  // Both gates were built on the noun and missed the verb. "Chest pain" was recognised and "my
  // chest hurts" was not, and in Spanish the gate held "dolor de pecho" while the ordinary way to
  // say it — "me duele el pecho" — went to the knowledge base as if it were a question.
  it("recognises pain reported with a verb, in every language", () => {
    for (const phrase of ["my chest hurts", "my chest is hurting", "my arm aches", "me duele el pecho", "el pecho me duele", "pwatrin mwen fè m mal"]) {
      expect(detectEmergencyLanguage(phrase), phrase).toBe(true);
    }
  });

  it("sends chest and arm pain to the engine that can call 911", () => {
    for (const phrase of ["my chest hurts", "my chest is hurting and my arm hurts", "me duele el pecho", "pwatrin mwen fè m mal"]) {
      expect(EMERGENCY_SYMPTOM_PATTERN.test(phrase), phrase).toBe(true);
    }
  });

  // Widening the gate to catch the verb must not swallow questions about the device. "Does the
  // cuff hurt my arm?" is a question a patient deserves an answer to, not a symptom report.
  it("does not read a question about the cuff as a symptom", () => {
    for (const phrase of ["Does the cuff hurt my arm?", "Will the monitor hurt?", "Is it painful to wear?", "¿El brazalete duele?"]) {
      expect(detectEmergencyLanguage(phrase), phrase).toBe(false);
    }
  });

  it("leaves ordinary questions alone", () => {
    for (const phrase of ["What are my goals?", "Can I remove the blood pressure goal?", "When is my appointment?", "How much does the monitor cost?", "Who is my care manager?"]) {
      expect(detectEmergencyLanguage(phrase), phrase).toBe(false);
    }
  });
});

// A patient who mentioned chest pain once had every later question answered with "call 911" for
// four hours. Resolution existed, but only for someone who happened to type the words the
// resolution patterns match, and nothing on screen suggested the state could end.
describe("ending a safety episode", () => {
  const episode = { id: "safety_1", active: true, startedAt: Date.now() };

  it("offers a visible way out of an open episode", () => {
    expect(safetyResponseFor({ locale: "EN", episode }).quickAction).toBe("safety-resolved");
  });

  it("offers it in the follow-up turns too, not only the first", () => {
    expect(safetyResponseFor({ locale: "ES", episode, question: "¿y mi cita?" }).quickAction).toBe("safety-resolved");
  });

  // The medication limit is not an episode and has nothing to resolve.
  it("does not offer it on the medication limit", () => {
    expect(safetyResponseFor({ locale: "EN", medication: true }).quickAction).toBeUndefined();
  });

  // The button reports the handoff. Recovering is still something the patient says in their own
  // words, so that it never becomes a one-tap dismissal of an emergency instruction.
  it("keeps both spoken resolutions working", () => {
    expect(detectSafetyResolution("I called 911")).toBe("HUMAN_HELP_CONFIRMED");
    expect(detectSafetyResolution("I feel better now")).toBe("PATIENT_REPORTED_RECOVERED");
  });
});
