import { describe, expect, it } from "vitest";
import { FLOW_STATUS, FLOW_TRANSITION_CONFIG, FLOW_TRANSITION_TYPE, emptyFlowProgress, resolveCareSetupResumeRoute, resolveEnrollmentTransition, resolveGettingStartedEntryRoute } from "../src/flowTransitions.js";
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

describe("Getting Started entry route", () => {
  const accessJourney = ["CONSENT_REVIEW", "ENROLLMENT_CONFIRMED", "ACCESS_BASELINE", "ACCESS_MEASURE", "ONBOARDING_COMPLETE"];

  it("repairs a legacy resume route that points back to enrollment confirmation", () => {
    expect(resolveGettingStartedEntryRoute({
      pathway: "ACCESS",
      journey: accessJourney,
      savedResumeRoute: "ENROLLMENT_CONFIRMED",
      configuredRoute: "ACCESS_BASELINE"
    })).toBe("ACCESS_BASELINE");
  });

  it("preserves a valid in-progress resume route", () => {
    expect(resolveGettingStartedEntryRoute({
      pathway: "ACCESS",
      journey: accessJourney,
      savedResumeRoute: "ACCESS_MEASURE",
      configuredRoute: "ACCESS_BASELINE"
    })).toBe("ACCESS_MEASURE");
  });
});

describe("care setup resume route", () => {
  it("resumes at the first section whose required information was not saved", () => {
    expect(resolveCareSetupResumeRoute({
      medicationsReviewStatus: "NOT_STARTED",
      carePreferencesStatus: "NOT_STARTED",
      goalsStatus: "COMPLETED"
    })).toBe("MEDICATIONS_REVIEW");
  });

  it("does not treat a visited but unfinished section as completed", () => {
    expect(resolveCareSetupResumeRoute({
      medicationsReviewStatus: "IN_PROGRESS",
      carePreferencesStatus: "COMPLETED",
      goalsStatus: "COMPLETED"
    })).toBe("MEDICATIONS_REVIEW");
  });

  it("routes to the completion screen only after every required section is saved", () => {
    expect(resolveCareSetupResumeRoute({
      medicationsReviewStatus: "COMPLETED",
      carePreferencesStatus: "COMPLETED",
      goalsStatus: "COMPLETED"
    })).toBe("ONBOARDING_COMPLETE");
  });

  it("ignores the retired health-information status in legacy drafts", () => {
    expect(resolveCareSetupResumeRoute({
      healthInformationStepStatus: "NOT_STARTED",
      medicationsReviewStatus: "COMPLETED",
      carePreferencesStatus: "NOT_STARTED",
      goalsStatus: "COMPLETED"
    })).toBe("CARE_PREFERENCES");
  });
});
