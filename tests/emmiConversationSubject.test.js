import { describe, expect, it } from "vitest";
import { decomposeCompoundQuestion, isFollowUpQuestion, mergeCompoundAnswers, resolveConversationSubject, subjectOf } from "../src/emmi/conversationSubject.js";

describe("compound question decomposition", () => {
  it("splits two questions joined by a conjunction", () => {
    expect(decomposeCompoundQuestion("Am I eligible and how much does it cost?")).toEqual(["Am I eligible", "how much does it cost?"]);
  });

  it("splits two questions written as two sentences", () => {
    expect(decomposeCompoundQuestion("Am I eligible? How much does it cost?")).toEqual(["Am I eligible?", "How much does it cost?"]);
  });

  it("splits Spanish and Haitian Creole compounds", () => {
    expect(decomposeCompoundQuestion("¿Soy elegible y cuánto cuesta?")).toHaveLength(2);
    expect(decomposeCompoundQuestion("¿Qué es ACCESS y tengo que pagar algo?")).toHaveLength(2);
    expect(decomposeCompoundQuestion("Èske m kalifye epi konbyen sa koute?")).toHaveLength(2);
  });

  // The conjunction has to join two questions. Joining two nouns is one question, and splitting it
  // produces two half-questions that retrieve nothing.
  it("leaves a list of nouns as one question", () => {
    expect(decomposeCompoundQuestion("Can you tell me about my medications and my appointments?")).toHaveLength(1);
    expect(decomposeCompoundQuestion("Tell me about the monitor and the readings")).toHaveLength(1);
  });

  it("leaves a comparison as one question", () => {
    expect(decomposeCompoundQuestion("What is the difference between ACCESS and CCM?")).toHaveLength(1);
  });

  it("caps a run-on at three parts", () => {
    const parts = decomposeCompoundQuestion("What is ACCESS and how much does it cost and who pays for it and when does it start?");
    expect(parts.length).toBeLessThanOrEqual(3);
  });
});

describe("conversation subject", () => {
  const conversation = {
    recentTurns: [
      { role: "user", text: "Tell me about the blood pressure monitor" },
      { role: "assistant", text: "The monitor is provided at no cost to you." }
    ]
  };

  it("treats a connector opener as a follow-up", () => {
    expect(isFollowUpQuestion("and does that cost anything?")).toBe(true);
    expect(isFollowUpQuestion("what about Medicare?")).toBe(true);
  });

  it("treats a bare referent and a very short turn as follow-ups", () => {
    expect(isFollowUpQuestion("does it cost anything")).toBe(true);
    expect(isFollowUpQuestion("how much?")).toBe(true);
  });

  it("leaves a question that names its own subject alone", () => {
    expect(isFollowUpQuestion("What is my A1c?")).toBe(false);
    expect(isFollowUpQuestion("how much does ACCESS cost?")).toBe(false);
  });

  // "How much does ACCESS cost?" is a question about ACCESS, not about cost. Carrying "cost" into
  // the next turn instead of ACCESS is what made follow-ups drift onto the billing page.
  it("ranks the thing being asked about above the word cost", () => {
    expect(subjectOf("how much does ACCESS cost?")?.key).toBe("ACCESS");
    expect(subjectOf("is the monitor free?")?.key).toBe("DEVICE");
    expect(subjectOf("does my appointment cost anything")?.key).toBe("APPOINTMENT");
    expect(subjectOf("how much does it cost?")?.key).toBe("COST");
  });

  it("recovers the subject the patient stopped repeating", () => {
    expect(resolveConversationSubject(conversation)).toBe("blood pressure monitor device");
  });

  it("prefers a real subject over a bare mention of cost", () => {
    expect(resolveConversationSubject({
      recentTurns: [
        { role: "user", text: "Tell me about the monitor" },
        { role: "user", text: "what does it cost" }
      ]
    })).toBe("blood pressure monitor device");
  });

  it("returns nothing when the conversation named no subject", () => {
    expect(resolveConversationSubject({ recentTurns: [{ role: "user", text: "hello" }] })).toBe("");
  });
});

describe("merging the halves of a compound answer", () => {
  it("drops a repeated answer", () => {
    expect(mergeCompoundAnswers(["A full answer.", "A full answer."])).toBe("A full answer.");
  });

  it("drops an answer already contained in another", () => {
    expect(mergeCompoundAnswers(["ACCESS is free to you. Your doctor stays involved.", "ACCESS is free to you."]))
      .toBe("ACCESS is free to you. Your doctor stays involved.");
  });

  it("drops the no-information line when a real answer stands beside it", () => {
    expect(mergeCompoundAnswers(["Real answer here.", "no info"], { unavailableText: "no info" })).toBe("Real answer here.");
  });

  it("keeps the no-information line when it is all there is", () => {
    expect(mergeCompoundAnswers(["no info"], { unavailableText: "no info" })).toBe("no info");
  });

  it("joins two distinct answers", () => {
    expect(mergeCompoundAnswers(["First answer.", "Second answer."])).toBe("First answer.\n\nSecond answer.");
  });
});
