import { describe, expect, it } from "vitest";
import { NAVIGATION, SCROLL, resolveScrollBehavior } from "../src/scroll.js";

// The resolver is the whole policy in one pure function, so the matrix in PATIENT_SCROLL_POLICY.md
// is testable without a browser. Everything below is a row of that matrix.

describe("scroll policy", () => {
  it("holds the patient's place for an in-place action", () => {
    // Confirming a medication is the case that started this: same screen, changed content.
    expect(resolveScrollBehavior({
      navigationType: NAVIGATION.IN_PLACE,
      sourceScreen: "MEDICATIONS_REVIEW",
      destinationScreen: "MEDICATIONS_REVIEW"
    })).toBe(SCROLL.PRESERVE);
  });

  it("starts a genuinely new screen at the top", () => {
    expect(resolveScrollBehavior({
      sourceScreen: "MEDICATIONS_REVIEW",
      destinationScreen: "GOALS"
    })).toBe(SCROLL.NEW_SCREEN);
  });

  it("treats a sub-view as a new screen when it has its own key", () => {
    // My Goals renders the goal detail inside MY_GOALS; the view key is what separates them.
    expect(resolveScrollBehavior({
      sourceScreen: "MY_GOALS",
      destinationScreen: "MY_GOALS#detail"
    })).toBe(SCROLL.NEW_SCREEN);
  });

  it("restores the previous position on back", () => {
    expect(resolveScrollBehavior({
      navigationType: NAVIGATION.BACK,
      sourceScreen: "MY_GOALS#detail",
      destinationScreen: "MY_GOALS"
    })).toBe(SCROLL.RESTORE);
  });

  it("restores the underlying position when an overlay closes", () => {
    // Closing EMMI is not navigation even when the screen underneath was re-rendered.
    expect(resolveScrollBehavior({
      navigationType: NAVIGATION.OVERLAY_CLOSE,
      sourceScreen: "MEDICATIONS_REVIEW",
      destinationScreen: "MEDICATIONS_REVIEW"
    })).toBe(SCROLL.RESTORE);
  });

  it("reveals a newly raised error instead of jumping to the top", () => {
    expect(resolveScrollBehavior({
      sourceScreen: "IDENTITY_VERIFICATION",
      destinationScreen: "IDENTITY_VERIFICATION",
      errorAppeared: true
    })).toBe(SCROLL.REVEAL_ERROR);
  });

  it("does not re-reveal an error that was already on screen", () => {
    // errorAppeared is false while the same message stays up, so a second edit does not yank the
    // patient back to it.
    expect(resolveScrollBehavior({
      sourceScreen: "IDENTITY_VERIFICATION",
      destinationScreen: "IDENTITY_VERIFICATION",
      errorAppeared: false
    })).toBe(SCROLL.PRESERVE);
  });

  it("prefers a new screen over an error raised during the same transition", () => {
    // Arriving somewhere new with an error already rendered still starts at the beginning; the
    // error is part of the new screen the patient is reading from the top.
    expect(resolveScrollBehavior({
      sourceScreen: "CONSENT_REVIEW",
      destinationScreen: "OUTCOME_STOPPED",
      errorAppeared: true
    })).toBe(SCROLL.NEW_SCREEN);
  });

  it("lets an explicit request override the default for the same screen", () => {
    expect(resolveScrollBehavior({
      sourceScreen: "MEDICATIONS_REVIEW",
      destinationScreen: "MEDICATIONS_REVIEW",
      explicit: SCROLL.REVEAL_TARGET
    })).toBe(SCROLL.REVEAL_TARGET);
  });

  it("gives a clinical interruption priority over every other rule", () => {
    // The one exception: a safety message the patient must see outranks continuity, even on a back
    // navigation that would otherwise restore their place.
    expect(resolveScrollBehavior({
      navigationType: NAVIGATION.BACK,
      sourceScreen: "ACCESS_BP_MEASUREMENT",
      destinationScreen: "ACCESS_BP_MEASUREMENT",
      explicit: SCROLL.PRESERVE,
      safetyInterruption: true
    })).toBe(SCROLL.SAFETY_PRIORITY);
  });

  it("preserves by default when it knows nothing", () => {
    // The fallback is the patient staying where they are, never a jump to the top.
    expect(resolveScrollBehavior()).toBe(SCROLL.PRESERVE);
  });
});
