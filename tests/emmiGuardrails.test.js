import { describe, expect, it, vi } from "vitest";
import { EmmiTextOrchestrator } from "../src/emmi/textOrchestrator.js";
import { emmiGuardrailAnswer } from "../src/emmi/guardrails.js";

// EMMI's guardrails are what she cannot do about legal authority, prescriptions and the clinical
// record. They were unreachable: everything except a "yes" went straight to the orchestrator, whose
// intents do not match these questions, so retrieval answered them with the generic ACCESS passage.
// These tests hold the route open, and check the limit itself rather than a plausible answer.
function harness({ locale = "EN", currentScreen = "CARE_RECOMMENDATION", contextExtras = {}, enrollment = { eligibilityStatus: "ELIGIBLE" } } = {}) {
  const executeTool = vi.fn(async name => {
    if (name === "searchKnowledge") return { intent: "PROGRAM_EXPLANATION", passages: [{ sourceId: "program-access", sourcePath: "programs/access.md", heading: "ACCESS", text: "Approved" }] };
    if (name === "evaluateClinicalEscalation") return { instruction: "CALL_911", severity: "EMERGENCY" };
    if (name === "getEnrollmentContext") return enrollment;
    throw new Error(`unexpected ${name}`);
  });
  const orchestrator = new EmmiTextOrchestrator({
    getContext: () => ({ locale, currentScreen, program: "ACCESS", patientId: "DEMO-P001", ...contextExtras }),
    getConversation: () => ({ conversationSessionId: "conv-1" }),
    executeTool,
    screenExplanation: () => "This screen explains the available care.",
    fetchImpl: vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    onEvent: () => {}
  });
  return { orchestrator, executeTool };
}

describe("deterministic guardrails are reachable again", () => {
  it.each([
    ["Can you enroll me?", "", "CONSENT_REVIEW", /I cannot consent for you/i],
    ["Please mark that I am authorized", "", "REPRESENTATIVE_AUTHORITY_ATTESTATION", /can’t confirm your authority/i],
    ["Why do I need to verify my phone?", "", "REPRESENTATIVE_AUTHORITY_ATTESTATION", /verification does not confirm legal authority/i],
    ["Can they make decisions for me?", "circle-decisions-for-me", "CARE_CIRCLE_INVITE", /cannot consent, sign, or make healthcare decisions for you/i],
    ["Can EMMI confirm this information?", "health-emmi-confirm", "HEALTH_INFORMATION_REVIEW", /can’t confirm a diagnosis or change your clinical record/i],
    ["What is Lisinopril?", "medication-what-is", "MEDICATIONS_REVIEW", /commonly used to help manage blood pressure/i],
    ["Should I stop taking this?", "", "MEDICATIONS_REVIEW", /can’t recommend starting, stopping, or changing/i],
    ["Why are you asking about my goals?", "goals-why-asking", "MY_GOALS", /not medical orders or clinical targets/i]
  ])("answers %s from approved copy rather than retrieval", async (question, questionId, currentScreen, expected) => {
    const { orchestrator, executeTool } = harness({ currentScreen });
    const answer = await orchestrator.answer(question, { questionId });
    expect(answer.text).toMatch(expected);
    expect(answer.trace.responseMode).toBe("DETERMINISTIC_GUARDRAIL");
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
  });

  it.each([
    ["Why do you need my date of birth and ZIP code?", "IDENTITY_VERIFICATION", /match you to the correct care invitation/i],
    ["What care will I receive through ACCESS?", "CARE_RECOMMENDATION", /connected blood pressure monitor.*personalized care plan/i],
    ["Can I use two ACCESS providers at the same time?", "CONSENT_REVIEW", /only one participating provider at a time/i],
    ["What do I need to do next?", "ENROLLMENT_CONFIRMED", /request your blood pressure monitor.*reconcile the medications/i],
    ["What happens if I choose I’ll do this later?", "ENROLLMENT_CONFIRMED", /enrollment is already complete.*remain pending/i],
    ["How do I choose the correct cuff size?", "ACCESS_BP_DEVICE_INFO", /Extra Small 15–28 cm.*Standard 22–42 cm.*Extra Large 32–52 cm/i],
    ["What should I do if the address shown is wrong?", "ACCESS_BP_SHIPPING_ADDRESS", /Use a different address/i],
    ["How long will shipping take?", "ACCESS_BP_SHIPPING_ADDRESS", /no confirmed shipping date.*tracking number/i],
    ["What do I need to do while I wait?", "ACCESS_BP_FULFILLMENT_CONFIRMED", /Review my medications/i],
    ["What happens if I choose I’ll do this later now?", "ACCESS_BP_FULFILLMENT_CONFIRMED", /only the medication reconciliation will remain pending/i],
    ["What should I choose if my dose changed?", "MEDICATIONS_REVIEW", /Something changed.*does not change the prescription automatically/i],
    ["What if I stopped taking one of these medicines?", "MEDICATIONS_REVIEW", /Something changed.*no longer taking it/i],
    ["What if a medication I take is missing?", "MEDICATIONS_REVIEW", /Add another medication/i],
    ["What should I do if I am not sure?", "MEDICATIONS_REVIEW", /I’m not sure if anything is missing/i],
    ["Are there any steps left for me?", "ONBOARDING_COMPLETE", /There are no more steps.*safely close/i],
    ["What happens with my monitor now?", "ONBOARDING_COMPLETE", /being prepared for shipment.*no confirmed shipping or delivery date/i]
  ])("answers screen-grounded patient question %s", async (question, currentScreen, expected) => {
    const { orchestrator, executeTool } = harness({ currentScreen, contextExtras: { deviceFulfillmentStatus: currentScreen === "ACCESS_BP_SHIPPING_ADDRESS" ? "NOT_REQUESTED" : "REQUESTED", enrollmentComplete: ["ENROLLMENT_CONFIRMED", "ACCESS_BP_DEVICE_INFO", "ACCESS_BP_SHIPPING_ADDRESS", "ACCESS_BP_FULFILLMENT_CONFIRMED", "MEDICATIONS_REVIEW", "ACCESS_ONBOARDING_COMPLETE", "ONBOARDING_COMPLETE"].includes(currentScreen) } });
    const answer = await orchestrator.answer(question);
    expect(answer.text).toMatch(expected);
    expect(answer.trace.responseMode).toBe("DETERMINISTIC_GUARDRAIL");
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
  });

  it("answers a typed request to stop participating without relying on retrieval", async () => {
    const { orchestrator, executeTool } = harness({ currentScreen: "INVITATION" });
    const answer = await orchestrator.answer("Can I stop participating later?");
    expect(answer.text).toMatch(/90 days after enrollment/i);
    expect(answer.trace.intent).toBe("LEAVE_ACCESS");
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
  });

  it("reaches a guardrail through the quick question id when the label is translated", async () => {
    const { orchestrator } = harness({ locale: "KR", currentScreen: "HEALTH_INFORMATION_REVIEW" });
    const answer = await orchestrator.answer("Èske EMMI ka konfime enfòmasyon sa a?", { questionId: "health-emmi-confirm" });
    expect(answer.text).toMatch(/pa ka konfime yon dyagnostik/i);
  });

  it("names who is signing when a representative asks what they are agreeing to", async () => {
    const { orchestrator } = harness({ currentScreen: "CONSENT_REVIEW", contextExtras: { completedByRepresentative: true } });
    const answer = await orchestrator.answer("What am I agreeing to?", { questionId: "consent-what-agreeing" });
    expect(answer.text).toMatch(/on behalf of the patient/i);
  });

  // A limit is not an answer to chest pain.
  it("keeps clinical safety ahead of every guardrail", async () => {
    const { orchestrator } = harness({ currentScreen: "MEDICATIONS_REVIEW" });
    const answer = await orchestrator.answer("Should I stop taking this? I have chest pain.");
    expect(answer.emergency).toBe(true);
    expect(answer.trace.responseMode).toBe("SAFETY_ENGINE");
  });

  it("explains the screen when the patient types a curly apostrophe", async () => {
    const { orchestrator } = harness();
    const answer = await orchestrator.answer("I don’t understand this screen.");
    expect(answer.text).toBe("This screen explains the available care.");
    expect(answer.trace.intent).toBe("CURRENT_SCREEN_HELP");
  });

  // Asking about the care team is still a question; only the limits are answered from copy.
  it.each([
    ["Talk with someone", "CARE_RECOMMENDATION"],
    ["What is ACCESS?", "CARE_RECOMMENDATION"],
    ["Will I keep my doctor?", "CARE_RECOMMENDATION"]
  ])("leaves %s to normal routing", (question, currentScreen) => {
    expect(emmiGuardrailAnswer({ question, locale: "EN", context: { currentScreen } })).toBeNull();
  });
});

describe("baseline reading counters", () => {
  const connectedAfterFirstReading = { deviceVerificationStatus: "SOURCE_VERIFIED", firstTransmissionVerified: true, bpBaselineReadingCount: 1, bpBaselineRemainingReadings: 2 };

  it("answers from the authoritative counters instead of guessing", async () => {
    const { orchestrator } = harness({ currentScreen: "ACCESS_BP_DEVICE_RESULT", enrollment: connectedAfterFirstReading });
    const answer = await orchestrator.answer("Do I need to take my blood pressure again now?");
    expect(answer.text).toBe("No. Your monitor is connected and we received your first reading. You can take your next readings later, and ITERA will receive them automatically.");
    expect(answer.trace.responseMode).toBe("RUNTIME_GROUNDED");
  });

  // Saying "no" before the monitor is verified would tell the patient to stop measuring on the
  // strength of a reading ITERA never confirmed came from their own device.
  it("falls through to normal routing when the counters do not say no", async () => {
    const { orchestrator } = harness({ currentScreen: "ACCESS_BP_DEVICE_RESULT", enrollment: { deviceVerificationStatus: "NOT_STARTED", bpBaselineReadingCount: 0, bpBaselineRemainingReadings: 3 } });
    const answer = await orchestrator.answer("Do I need to take my blood pressure again now?");
    expect(answer.text).not.toMatch(/we received your first reading/i);
    expect(answer.trace.responseMode).toBe("DETERMINISTIC_GROUNDED_FALLBACK");
  });
});

// The live re-test asked, on "Who is completing this?", "Mi hija me está ayudando, pero yo tomo las
// decisiones. ¿Qué opción elijo?" and was pointed at the option meaning the patient is completing
// it. The words matched the Care Circle rule — inviting a supporter, a different feature on a
// different screen — so the answer never mentioned the three options in front of the patient.
describe("which of the visible options is the right one", () => {
  const ask = (question, locale = "ES", currentScreen = "DECISION_MAKER") =>
    emmiGuardrailAnswer({ question, locale, context: { currentScreen } });

  const LABEL = { EN: "Helping the patient", ES: "Ayudando al paciente", KR: "Ede pasyan an" };

  for (const [locale, question] of [
    ["ES", "Mi hija me está ayudando, pero yo tomo las decisiones. ¿Qué opción elijo?"],
    ["EN", "My daughter is helping me but I make the decisions. Which option should I choose?"],
    ["KR", "Pitit fi mwen ap ede m, men se mwen ki pran desizyon yo. Ki opsyon?"]
  ]) {
    it(`names the option that is actually on the screen (${locale})`, () => {
      const answer = ask(question, locale);
      expect(answer?.intent).toBe("COMPLETION_ROLE");
      expect(answer.text).toContain(LABEL[locale]);
    });
  }

  it("separates helping from the authority the third option carries", () => {
    const answer = ask("¿Qué opción elijo si mi hija me ayuda?");
    expect(answer.text).toMatch(/Representante personal/);
    expect(answer.text).toMatch(/autorizado legalmente|no corresponde/);
  });

  it("answers the screen's own quick questions with the option rather than with Care Circle", () => {
    for (const questionId of ["decision-daughter-help", "decision-who-completes"]) {
      const answer = emmiGuardrailAnswer({ questionId, locale: "ES", context: { currentScreen: "DECISION_MAKER" } });
      expect(answer?.intent, questionId).toBe("COMPLETION_ROLE");
    }
  });

  it("leaves the Care Circle answer alone everywhere else", () => {
    expect(ask("¿Puede mi hija ayudarme con los recordatorios?", "ES", "CARE_CIRCLE_INVITE")?.intent).toBe("CARE_CIRCLE");
    expect(ask("¿Puede mi hija ayudarme?", "ES", "MY_CARE")?.intent).toBe("CARE_CIRCLE");
  });
});
