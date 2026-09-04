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
    expect(isFollowUpQuestion("When?")).toBe(true);
    expect(isFollowUpQuestion("Why that number?")).toBe(true);
  });

  // A determiner is not a referent: in "who created this program?" the "this" names the thing right
  // there in the sentence, and reading it as a referent made a self-contained question inherit an
  // unrelated topic.
  it("leaves a self-contained question alone", () => {
    for (const question of ["Is this HIPAA compliant?", "Who created this program for Medicare patients?", "What does this program cover for me?"]) {
      expect(isFollowUpQuestion(question), question).toBe(false);
    }
  });

  // Four-word follow-ups that have genuinely stopped saying what they are about. Tightening the
  // word count to three stopped these from inheriting a subject and they went back to answering
  // "I don't have enough approved information" - eleven of them in the regression.
  it("keeps carrying into a short follow-up that names nothing", () => {
    for (const question of ["Should I keep trying?", "Who do I tell?", "Can he call you?", "Next week if possible."]) {
      expect(isFollowUpQuestion(question), question).toBe(true);
    }
  });

  // "It" is a pronoun standing for something already named; "this" points at the situation. So a
  // question about whether "it" is free still inherits the monitor, and one about whether "this" is
  // compliant does not.
  it("keeps carrying the subject through \"it\"", () => {
    expect(isFollowUpQuestion("Is it free?")).toBe(true);
    expect(isFollowUpQuestion("Is this required?")).toBe(false);
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

// "Is this a scam?" points at the whole situation, not at the last thing discussed. Treating that
// "this" as a referent made a patient asking whether they were being defrauded inherit "weight"
// into their query, and they got no answer at all.
describe("questions about the situation itself", () => {
  const conversation = { recentTurns: [{ role: "user", text: "How much weight should I lose?" }] };

  it("carries nothing into a question about whether this is genuine", () => {
    for (const question of ["Is this a scam?", "Is this real?", "Is this legit?", "¿Esto es una estafa?", "¿Es esto real?"]) {
      expect(isFollowUpQuestion(question), question).toBe(false);
    }
  });

  it("still carries the subject into an ordinary follow-up", () => {
    expect(isFollowUpQuestion("is that covered?")).toBe(true);
    expect(resolveConversationSubject(conversation)).toBe("weight");
  });
});

describe("merging halves that overlap", () => {
  it("drops a sentence the second half repeats from the first", () => {
    const merged = mergeCompoundAnswers([
      "Your monitor connects on its own, so you do not need Wi-Fi. Place the cuff on your bare arm.",
      "Your monitor connects on its own, so you do not need Wi-Fi. It sends readings automatically."
    ]);
    expect(merged.match(/do not need Wi-Fi/g)).toHaveLength(1);
    expect(merged).toMatch(/Place the cuff/);
    expect(merged).toMatch(/sends readings automatically/);
  });

  it("drops a half that repeats everything and adds nothing", () => {
    expect(mergeCompoundAnswers(["The monitor is free. Your care team reviews it.", "The monitor is free."]))
      .toBe("The monitor is free. Your care team reviews it.");
  });
});

// Three shapes the connector split could not see, each found by reading the compound cases that
// still answered one half in the 534-turn regression.
describe("compounds without a question word in the second half", () => {
  it("splits an adversative followed by a stated need", () => {
    expect(decomposeCompoundQuestion("My daughter wants to come with me but I also need to change the time."))
      .toEqual(["My daughter wants to come with me", "I also need to change the time."]);
  });

  it("splits a statement followed by a request for a person", () => {
    expect(decomposeCompoundQuestion("Nobody has called me and I want to speak to a supervisor."))
      .toEqual(["Nobody has called me", "I want to speak to a supervisor."]);
  });

  // "Can I keep the monitor and stay in the program?" is two questions sharing one modal. The
  // second half starts with a bare verb, so it has no question word of its own to split in front of.
  it("lends the modal to a half that shares it", () => {
    expect(decomposeCompoundQuestion("I am moving to a nursing home, can I keep the monitor and stay in the program?"))
      .toEqual(["I am moving to a nursing home, can I keep the monitor", "can I stay in the program?"]);
    expect(decomposeCompoundQuestion("¿Puedo quedarme el monitor y seguir en el programa?"))
      .toHaveLength(2);
  });

  // The reason the modal rule is narrow: without a modal to lend, these are one question each.
  it("leaves coordination alone when there is no modal to lend", () => {
    expect(decomposeCompoundQuestion("I keep my doctor and my nurse")).toHaveLength(1);
    expect(decomposeCompoundQuestion("My daughter can help me and my son can too")).toHaveLength(1);
    expect(decomposeCompoundQuestion("What if the monitor breaks and I miss my readings?")).toHaveLength(1);
    expect(decomposeCompoundQuestion("If I leave the program will I owe anything?")).toHaveLength(1);
  });
});
