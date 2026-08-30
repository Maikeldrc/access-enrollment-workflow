import { describe, expect, it } from "vitest";
import { emmiGuardrailAnswer } from "../src/emmi/guardrails.js";

const afterEnrollment = { currentScreen: "ENROLLMENT_CONFIRMED", enrollmentComplete: true, canContinue: true, eligibilityStatus: "ELIGIBLE", physicianDisplayName: "Dr. Fresner", deviceFulfillmentStatus: "REQUESTED", nextBestAction: { label: "Set up my care" } };
const ask = (question, context, locale = "EN") => emmiGuardrailAnswer({ question, locale, context });

describe("assigned goals are not preferences", () => {
  it("says the goals were assigned, not chosen", () => {
    const answer = ask("Did I choose these goals?", afterEnrollment).text;
    expect(answer).toMatch(/^No\./);
    expect(answer).toMatch(/programme assigns them/);
  });

  it("does not treat an assigned outcome as something to switch off", () => {
    const answer = ask("Can I remove the blood pressure goal?", afterEnrollment).text;
    expect(answer).toMatch(/not something to switch off/);
    expect(answer).toMatch(/tell your care team/);
  });

  // The milestone and the control target are different things, and calling the milestone a target
  // tells a patient starting at 152 that 137 is where they are trying to land.
  it("separates the improvement milestone from the control target", () => {
    const answer = ask("What does 15 mmHg lower mean?", afterEnrollment).text;
    expect(answer).toMatch(/below 130/);
    expect(answer).toMatch(/at least 15 points/);
    expect(answer).toMatch(/not your final goal/);
  });
});

describe("barriers", () => {
  const onBarriers = { ...afterEnrollment, currentScreen: "ACCESS_SUPPORT_NEEDS" };

  it("says the care plan already exists rather than that it is being created", () => {
    const answer = ask("Why are you asking?", onBarriers).text;
    expect(answer).toMatch(/already in place/);
    expect(answer).not.toMatch(/creating|building/i);
  });

  it("offers support for a forgotten medication without touching the prescription", () => {
    const answer = ask("What happens if I say I forget my medications?", onBarriers).text;
    expect(answer).toMatch(/reminders/);
    expect(answer).toMatch(/Nothing about your medications changes/);
  });
});
