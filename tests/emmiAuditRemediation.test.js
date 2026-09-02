import { describe, expect, it, vi } from "vitest";
import { EmmiTextOrchestrator, patientFacingProse } from "../src/emmi/textOrchestrator.js";
import { detectEmergencyLanguage, emergencyLanguageForEvaluation } from "../src/emmi/safetyPolicy.js";
import { EMERGENCY_SYMPTOM_PATTERN } from "../src/clinicalMonitoring.js";
import { classifyAppointmentIntent, APPOINTMENT_INTENT_ACTIONS } from "../src/emmi/appointmentIntents.js";
import { retrieveKnowledge, resetKnowledgeIndex } from "../server/emmiKnowledge.js";

// The findings of the EMMI patient-knowledge audit, one test each. Every case here is a question a
// patient actually asked during the audit and got the wrong answer to.

describe("the generation layer is actually reachable", () => {
  // The whole model layer was dead in production for one reason: `fetchImpl = globalThis.fetch`
  // stored a native method without its receiver, so `this.fetch(...)` threw "Illegal invocation"
  // before any request left the page, and the catch turned that into a knowledge-base fallback.
  // Every existing test injected its own fetchImpl, so none of them ever executed the default.
  it("calls its default fetch with a receiver the platform accepts", async () => {
    const calls = [];
    // Stands in for window.fetch: a native method is only callable with the right `this`.
    const platform = {
      fetch(...args) {
        if (this !== platform) throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
        calls.push(args[0]);
        return { ok: true, status: 200, json: async () => ({ text: "grounded answer", intent: "PROGRAM_EXPLANATION" }) };
      }
    };
    const original = globalThis.fetch;
    globalThis.fetch = (...args) => platform.fetch(...args);
    try {
      const orchestrator = new EmmiTextOrchestrator({
        getContext: () => ({ locale: "EN", patientId: "DEMO-P001", currentScreen: "MY_CARE", program: "ACCESS" }),
        getConversation: () => ({}),
        screenExplanation: () => "screen",
        executeTool: async name => {
          if (name === "searchKnowledge") return { intent: "PROGRAM_EXPLANATION", passages: [{ sourceId: "x", sourcePath: "programs/x.md", heading: "X", text: "Some approved patient wording about the programme that is long enough to survive." }] };
          throw new Error(`unexpected ${name}`);
        }
      });
      const answer = await orchestrator.answer("Tell me about the support you offer");
      expect(calls).toContain("/api/emmi/chat");
      expect(answer.text).toBe("grounded answer");
      expect(answer.trace.responseMode).not.toBe("DETERMINISTIC_GROUNDED_FALLBACK");
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("nothing written for the maintainer reaches the patient", () => {
  it("drops instruction sentences from a rendered passage", () => {
    const raw = "QMB is a Medicare Savings Program status with important protections. Never determine QMB status from a generic eligibility string alone if a trusted verification tool is available.";
    const prose = patientFacingProse(raw);
    expect(prose).not.toMatch(/never determine/i);
    expect(prose).toMatch(/Medicare Savings Program/);
  });

  it("returns nothing when a page is only instructions, so the caller offers a person instead", () => {
    const raw = "Never say a Medicare service is automatically free. Do not place secrets, credentials or PHI in this Markdown file.";
    expect(patientFacingProse(raw)).toBe("");
  });

  it("keeps an ordinary patient answer intact", () => {
    const raw = "Taking part is your choice, and you are not locked in. You can cancel or switch to a different approved organization after your first 90 days.";
    expect(patientFacingProse(raw)).toBe(raw);
  });
});

describe("the safety gate recognises how patients describe an emergency", () => {
  // Two thirds of the FAST stroke test reached no safety route at all before this.
  const strokeSigns = [
    "I have weakness on one side of my body.",
    "The left side of my body has gone weak.",
    "I cannot speak properly.",
    "My words are coming out slurred.",
    "One side of my face has dropped."
  ];
  for (const phrase of strokeSigns) {
    it(`treats as an emergency: ${phrase}`, () => {
      expect(detectEmergencyLanguage(phrase)).toBe(true);
      expect(EMERGENCY_SYMPTOM_PATTERN.test(phrase)).toBe(true);
    });
  }

  // A symptom is a health turn even when it is not an emergency: it must reach a person rather
  // than the knowledge base, which had nothing to say and answered "information not available".
  const symptomsNeedingAPerson = ["I have a headache.", "I feel weak.", "I do not feel well.", "My blood pressure is very low.", "my bp high what i do"];
  for (const phrase of symptomsNeedingAPerson) {
    it(`routes to the care team without calling it an emergency: ${phrase}`, () => {
      expect(detectEmergencyLanguage(phrase)).toBe(true);
      expect(EMERGENCY_SYMPTOM_PATTERN.test(phrase)).toBe(false);
    });
  }

  const notHealthTurns = ["What is ACCESS?", "I want to speak with a person.", "Do I have to pay?", "My internet signal is weak.", "I do not understand any of this."];
  for (const phrase of notHealthTurns) {
    it(`leaves alone: ${phrase}`, () => expect(detectEmergencyLanguage(phrase)).toBe(false));
  }

  it("understands an explicit emergency negation without hiding a real symptom", () => {
    expect(detectEmergencyLanguage("Yes, please let my care team know. I am not having an emergency.")).toBe(false);
    expect(emergencyLanguageForEvaluation("This is not an emergency, but I have chest pain.")).not.toMatch(/not an emergency/i);
    expect(detectEmergencyLanguage("This is not an emergency, but I have chest pain.")).toBe(true);
  });
});

describe("a patient who cannot attend is asking about the appointment", () => {
  it("reads an inability to attend as a reschedule", () => {
    expect(classifyAppointmentIntent("I cannot make it that day.")?.action).toBe(APPOINTMENT_INTENT_ACTIONS.RESCHEDULE);
    expect(classifyAppointmentIntent("no puedo ir manana que ago")?.action).toBe(APPOINTMENT_INTENT_ACTIONS.RESCHEDULE);
  });

  it("still cancels when the patient asks to cancel", () => {
    expect(classifyAppointmentIntent("I can’t make it, I want to cancel my appointment")?.action).toBe(APPOINTMENT_INTENT_ACTIONS.CANCEL);
  });

  it("leaves a transport barrier to the barrier route", () => {
    expect(classifyAppointmentIntent("I can't go to my appointment because I don't have a ride")).toBeNull();
  });
});

describe("retrieval answers the question that was asked", () => {
  const top = question => {
    const result = retrieveKnowledge({ query: question, runtime: { program: "ACCESS", currentScreen: "MY_CARE" }, topK: 3 });
    return result.chunks[0]?.sourcePath || null;
  };
  resetKnowledgeIndex();

  // "savings program" on the QMB page handed it the word "program", so QMB came back as the answer
  // to sixty-two unrelated questions — whether this is a government programme, whether the monitor
  // costs anything, whether the invitation is a scam.
  it("does not let a multi-word keyword lend its page a single common word", () => {
    for (const question of ["Is this a government program?", "Do I have to pay for the blood pressure monitor?", "Is this a scam?"]) {
      expect(top(question)).not.toBe("medicare/qmb.md");
    }
  });

  it("still finds QMB when QMB is the question", () => {
    expect(top("What is QMB?")).toBe("medicare/qmb.md");
  });

  // "not" was not a stopword, so "My camera does not work" scored a heading match against
  // "Leaving is not losing Medicare" and three pages tied on the word "not".
  it("returns nothing rather than the least irrelevant page", () => {
    // Before this, anything with one word in common was answered from whichever page shared it —
    // "My camera does not work" came back from the A1c page because both contain "not". Nothing in
    // this corpus speaks to any of these, and saying so is the correct answer.
    for (const question of ["What is the weather today?", "Who won the game last night?", "Can you help me fix my car engine?"]) {
      expect(top(question)).toBeNull();
    }
  });

  it("reaches the page written for the question", () => {
    expect(top("What does ACCESS stand for?")).toBe("programs/access.md");
    expect(top("Do I have to participate?")).toBe("enrollment/leaving-access.md");
    expect(top("¿Puedo salirme del programa?")).toBe("enrollment/leaving-access.md");
    expect(top("Are you a person?")).toBe("core/about-emmi.md");
    expect(top("I have no transportation.")).toBe("care/getting-to-appointments.md");
    expect(top("I am already in CCM. Can I do both?")).toBe("programs/access-with-other-programs.md");
    expect(top("I have Medicare Advantage. Can I be in ACCESS?")).toBe("medicare/medicare-advantage.md");
  });
});

describe("the care team answer names the person who was asked about", () => {
  const harness = () => new EmmiTextOrchestrator({
    getContext: () => ({ locale: "EN", patientId: "DEMO-P001", currentScreen: "MY_CARE", program: "ACCESS" }),
    getConversation: () => ({}),
    screenExplanation: () => "screen",
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    executeTool: async name => {
      if (name === "getCareTeam") return {
        physicianDisplayName: "Dr. Fresner Lee",
        members: [
          { id: "1", displayName: "Dr. Fresner Lee", roleLabel: "Primary care doctor", specialty: "Primary care" },
          { id: "2", displayName: "Alicia Ramírez, RN", roleLabel: "Care Manager", specialty: "Care management" },
          { id: "3", displayName: "Dr. Pedro Martinez-Clark", roleLabel: "Cardiologist", specialty: "Cardiology" }
        ]
      };
      throw new Error(`unexpected ${name}`);
    }
  });

  it("names the cardiologist when the cardiologist is asked for", async () => {
    const answer = await harness().answer("Who is my cardiologist?");
    expect(answer.text).toMatch(/Pedro Martinez-Clark/);
    expect(answer.text).not.toMatch(/Fresner Lee/);
  });

  it("lists the whole team when the whole team is asked for", async () => {
    const answer = await harness().answer("Who is on my care team?");
    expect(answer.text).toMatch(/Fresner Lee/);
    expect(answer.text).toMatch(/Alicia Ramírez/);
    expect(answer.text).toMatch(/Pedro Martinez-Clark/);
  });
});

describe("a cost question about a ride is not a question about the ACCESS cost", () => {
  it("never answers who pays for a ride with the ACCESS amount", async () => {
    const called = [];
    const orchestrator = new EmmiTextOrchestrator({
      getContext: () => ({ locale: "EN", patientId: "DEMO-P001", currentScreen: "MY_CARE", program: "ACCESS" }),
      getConversation: () => ({}),
      screenExplanation: () => "screen",
      fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
      executeTool: async (name, args) => {
        called.push(name);
        if (name === "searchKnowledge") return { intent: "OTHER", passages: [] };
        if (name === "getExpectedAccessCost") return { expectedPatientPayment: 0, grossBeneficiaryResponsibility: 6, explanationCode: "SUPPLEMENTAL_COVERS_COST_SHARE" };
        return {};
      }
    });
    const answer = await orchestrator.answer("Who pays for the Uber?");
    expect(called).not.toContain("getExpectedAccessCost");
    expect(answer.text).not.toMatch(/\$0/);
  });
});
