import { describe, expect, it } from "vitest";
import { FLOW_STATUS, FLOW_TRANSITION_CONFIG, FLOW_TRANSITION_TYPE, emptyFlowProgress, resolveEnrollmentTransition } from "../src/flowTransitions.js";
import { resolveNextBestAction } from "../src/nextBestAction.js";

const programs = ["ACCESS", "CCM", "RPM", "CCM_RPM", "PCM", "PCM_RPM", "ASM", "APCM"];

describe("shared flow completion transitions", () => {
  it("marks only meaningful module boundaries as natural stopping points", () => {
    expect(FLOW_TRANSITION_CONFIG.ENROLLMENT_TO_GETTING_STARTED.transitionType).toBe(FLOW_TRANSITION_TYPE.NATURAL_STOP_POINT);
    expect(FLOW_TRANSITION_CONFIG.HEALTH_INFO_TO_MEDICATIONS.transitionType).toBe(FLOW_TRANSITION_TYPE.CONTINUOUS);
  });

  it("provides WHAT, WHY, optional TIME, routing and localized patient choice for every program", () => {
    for (const pathway of programs) {
      const action = resolveNextBestAction({ pathway });
      const transition = resolveEnrollmentTransition({ pathway, nextBestAction: action });
      expect(transition.nextRoute).toBe(action.route);
      expect(transition.laterRoute).toBe("MY_CARE");
      expect(transition.supportsResume).toBe(true);
      for (const entry of [transition.title, transition.nextStepTitle, transition.description, transition.primaryCta, transition.laterLabel, transition.reassurance]) {
        expect(entry.en).toBeTruthy();
        expect(entry.es).toBeTruthy();
        expect(entry.ht).toBeTruthy();
      }
    }
  });

  it("resolves RPM fulfillment separately and combines dual-program setup into one invitation", () => {
    const fulfillmentAction = resolveNextBestAction({ pathway: "RPM", devicePath: "ship" });
    const fulfillment = resolveEnrollmentTransition({ pathway: "RPM", nextBestAction: fulfillmentAction });
    expect(fulfillment.title.en).toBe("Ready to get your monitor?");
    expect(fulfillment.estimatedDuration).toBeNull();

    const combinedAction = resolveNextBestAction({ pathway: "CCM_RPM" });
    const combined = resolveEnrollmentTransition({ pathway: "CCM_RPM", nextBestAction: combinedAction });
    expect(combined.nextStepTitle.en).toBe("Continue setting up your care");
  });

  it("starts a resumable next flow in NOT_STARTED rather than enrollment state", () => {
    expect(emptyFlowProgress()).toEqual({ flowType: "GETTING_STARTED", status: FLOW_STATUS.NOT_STARTED, startedAt: "", completedAt: "", deferredAt: "", resumeRoute: "" });
  });
});
