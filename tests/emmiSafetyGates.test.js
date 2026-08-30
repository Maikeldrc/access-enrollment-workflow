import { describe, expect, it } from "vitest";
import { detectEmergencyLanguage } from "../src/emmi/safetyPolicy.js";

// The gate decides which turns reach the clinical engine. It is not a verdict: the engine still
// returns CALL_911, a care team task, or continue. So a symptom belongs here whenever a clinician
// would want to see it, not only when it is certainly an emergency.
describe("the clinical symptom gate", () => {
  it("routes the symptoms a patient actually reports", () => {
    for (const phrase of ["I have severe chest pain", "I feel very dizzy", "I am light-headed", "me siento mareado", "mwen gen tèt vire"]) {
      expect(detectEmergencyLanguage(phrase), phrase).toBe(true);
    }
  });

  it("leaves ordinary questions alone", () => {
    for (const phrase of ["What are my goals?", "Can I remove the blood pressure goal?", "When is my appointment?"]) {
      expect(detectEmergencyLanguage(phrase), phrase).toBe(false);
    }
  });
});
