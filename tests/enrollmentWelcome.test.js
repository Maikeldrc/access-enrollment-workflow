import { describe, expect, it } from "vitest";
import { enrollmentWelcomeConfig, enrollmentWelcomeFor } from "../src/enrollmentWelcome.js";
import { resolveNextBestAction } from "../src/nextBestAction.js";
import { CARE_CIRCLE_COPY, GROWTH_MOMENTS, shareAccessEligibility } from "../src/growthMoments.js";

const programs = ["ACCESS", "CCM", "RPM", "CCM_RPM", "PCM", "PCM_RPM", "ASM", "APCM"];
const localized = entry => [entry.en, entry.es, entry.ht];
const alwaysAvailable = () => true;

describe("shared enrollment welcome configuration", () => {
  it("defines localized content for every supported program", () => {
    for (const program of programs) {
      const config = enrollmentWelcomeFor(program);
      expect(config).toBe(enrollmentWelcomeConfig[program]);
      expect(config.nextSteps).toHaveLength(program === "ACCESS" ? 2 : 3);
      expect(config.supportHighlights).toHaveLength(2);
      for (const highlight of config.supportHighlights) {
        expect(highlight.icon).toBeTruthy();
        for (const entry of [highlight.title, highlight.description]) for (const value of localized(entry)) expect(value).toBeTruthy();
      }
      const stepCopy = config.nextSteps.flatMap(step => step.title ? [step.title, step.description] : [step]);
      for (const entry of [config.supportingCopy, config.emmiWelcome, ...stepCopy]) {
        for (const value of localized(entry)) expect(value).toBeTruthy();
      }
      if (!config.useProgramDisplayName) for (const value of localized(config.title)) expect(value).toBeTruthy();
    }
  });

  it("has EMMI congratulate and welcome every enrolled patient in every language", () => {
    for (const program of programs) {
      const welcome = enrollmentWelcomeFor(program).emmiWelcome;
      expect(welcome.en, `${program}/en`).toMatch(/congratulations.*welcome/i);
      expect(welcome.es, `${program}/es`).toMatch(/felicidades.*bienvenido/i);
      expect(welcome.ht, `${program}/ht`).toMatch(/felisitasyon.*byenveni/i);
      for (const copy of localized(welcome)) expect(copy, program).toMatch(/enrollment|inscripci.n|enskripsyon/i);
    }
  });

  it("promises no call as the next step, and offers ACCESS care activation instead", () => {
    // ACCESS used to open with "your care team will call you within 2 business days". The patient
    // can continue on their own now, so neither the promise nor the window it templated remain.
    expect(enrollmentWelcomeConfig.ACCESS.careTeamContactWindow).toBeUndefined();
    expect(enrollmentWelcomeConfig.ACCESS.nextSteps.map(step => step.title.en)).toEqual([
      "Request your blood pressure monitor",
      "Reconcile your medications"
    ]);
    for (const program of programs) {
      for (const step of enrollmentWelcomeFor(program).nextSteps) {
        const text = step.title ? `${step.title.en} ${step.description.en}` : step.en;
        expect(text, `${program} next step`).not.toContain("business days");
      }
    }
  });

  it("leaves the primary action to the next-best-action resolver", () => {
    for (const program of programs) {
      expect(enrollmentWelcomeFor(program).primaryCTA).toBeUndefined();
      expect(enrollmentWelcomeFor(program).nextRoute).toBeUndefined();
    }
  });

  it("provides a future-program fallback without inventing program terminology", () => {
    const fallback = enrollmentWelcomeFor("FUTURE_PROGRAM");
    expect(fallback.useProgramDisplayName).toBe(true);
    expect(fallback.nextSteps).toHaveLength(3);
    expect(fallback.supportHighlights).toHaveLength(2);
  });

  it("keeps CCM welcome hierarchy concise and configurable", () => {
    const ccm = enrollmentWelcomeConfig.CCM;
    expect(ccm.supportingCopy.en).toBe("You now have ongoing support to help manage your health between doctor visits.");
    expect(ccm.supportHighlights.map(item => item.title.en)).toEqual(["Step-by-step support", "Connected with your doctors"]);
    expect(ccm.supportHighlights[0].description.en).toBe("We’ll guide you as you get started.");
  });
});

describe("next best action", () => {
  it("sends ACCESS to care activation and care programs to care setup", () => {
    // Phase 3 renamed this CTA and deliberately left the route alone, and this assertion existed to
    // catch an accidental re-route. The route has now moved on purpose: care activation opens with
    // the connected monitor, and the health check it used to open is gone from the journey entirely.
    expect(resolveNextBestAction({ pathway: "ACCESS" })).toMatchObject({ route: "ACCESS_BP_DEVICE_INFO", actionType: "CARE_ACTIVATION" });
    expect(resolveNextBestAction({ pathway: "ACCESS" }).label.en).toBe("Set up my care");
    expect(resolveNextBestAction({ pathway: "CCM" })).toMatchObject({ route: "ONBOARDING", actionType: "CARE_SETUP" });
    expect(resolveNextBestAction({ pathway: "CCM" }).label.en).toBe("Set up my care");
    for (const program of ["PCM", "ASM", "APCM"]) {
      expect(resolveNextBestAction({ pathway: program }).label.en).toBe("Continue getting started");
    }
  });

  it("resolves the RPM action from the device state instead of one fixed label", () => {
    expect(resolveNextBestAction({ pathway: "RPM", devicePath: "ship" }).label.en).toBe("Get my monitor");
    expect(resolveNextBestAction({ pathway: "RPM", devicePath: "owned" }).label.en).toBe("Set up my monitor");
    expect(resolveNextBestAction({ pathway: "RPM", deviceSource: "ITERA_ASSIGNED" }).label.en).toBe("Set up my monitor");
    expect(resolveNextBestAction({ pathway: "RPM", assignedDeviceId: "tenovi-bp-8842" }).label.en).toBe("Set up my monitor");
    expect(resolveNextBestAction({ pathway: "RPM", rpmDeviceFixture: "ship" }).label.en).toBe("Get my monitor");
    expect(resolveNextBestAction({ pathway: "RPM", firstTransmissionVerified: true })).toMatchObject({ route: "RPM_FIRST_READING", actionType: "FIRST_READING" });
    // No device information yet: the patient still chooses a path, so neither branch is assumed.
    expect(resolveNextBestAction({ pathway: "RPM" })).toMatchObject({ route: "RPM_DEVICE_PATH", actionType: "DEVICE_PATH" });
  });

  it("gives combined programs a single getting-started action", () => {
    for (const program of ["CCM_RPM", "PCM_RPM"]) {
      const action = resolveNextBestAction({ pathway: program });
      expect(action.label.en).toBe("Continue getting started");
      expect(action.actionType).toBe("COMBINED_SETUP");
    }
  });

  // The app never calls this without a screen, and every case above passes none, so none of them
  // takes the branch the app takes. Naming ENROLLMENT_CONFIRMED at screen level once gave every
  // programme one fixed call to action under a heading that said something else. These cases hold
  // the screen to the programme's own next step, whatever that programme decides to call it.
  it("lets the programme name the step on the confirmation screen, whatever the screen is called", () => {
    const onConfirmation = (pathway, nextRoute) => resolveNextBestAction({ pathway, currentScreen: "ENROLLMENT_CONFIRMED", nextRoute });
    expect(onConfirmation("ACCESS", "ACCESS_BASELINE").label.en).toBe("Set up my care");
    expect(onConfirmation("CCM", "ONBOARDING").label.en).toBe("Set up my care");
    expect(onConfirmation("RPM", "RPM_DEVICE_PATH").label.en).toBe("Set up my monitor");
    for (const program of ["PCM", "ASM", "APCM", "CCM_RPM", "PCM_RPM"]) {
      expect(onConfirmation(program, "ONBOARDING").label.en).toBe("Continue getting started");
    }
    // The words are the programme's; the route stays the one the journey handed in.
    expect(onConfirmation("CCM", "ONBOARDING").route).toBe("ONBOARDING");
    expect(onConfirmation("CCM_RPM", "RPM_DEVICE_PATH").route).toBe("RPM_DEVICE_PATH");
  });

  it("still lets a screen own its own call to action where that is the point", () => {
    const home = resolveNextBestAction({ pathway: "CCM", currentScreen: "INVITATION", nextRoute: "DECISION_MAKER" });
    expect(home).toMatchObject({ actionType: "LEARN_MORE", route: "DECISION_MAKER" });
    expect(home.label.en).toBe("Start your care journey");
  });

  it("localizes every action label", () => {
    for (const program of programs) {
      for (const value of localized(resolveNextBestAction({ pathway: program }).label)) expect(value).toBeTruthy();
    }
  });
});

describe("growth moments", () => {
  const base = { pathway: "ACCESS", enrollmentStatus: "COMPLETED", dismissedAt: "", promptAvailable: alwaysAvailable };

  it("never offers Share ACCESS before a positive value moment", () => {
    expect(shareAccessEligibility({ ...base, moment: null }).eligible).toBe(false);
    expect(shareAccessEligibility({ ...base, moment: "ENROLLMENT_CONFIRMED" }).eligible).toBe(false);
    expect(shareAccessEligibility({ ...base, moment: GROWTH_MOMENTS.GETTING_STARTED_COMPLETED }).eligible).toBe(true);
  });

  it("requires a completed enrollment and respects a recent dismissal", () => {
    expect(shareAccessEligibility({ ...base, enrollmentStatus: "NOT_STARTED", moment: GROWTH_MOMENTS.FIRST_READING_RECEIVED }).eligible).toBe(false);
    expect(shareAccessEligibility({ ...base, moment: GROWTH_MOMENTS.FIRST_READING_RECEIVED, promptAvailable: () => false }).eligible).toBe(false);
  });

  it("does not generalize Share ACCESS to other programs", () => {
    for (const program of programs.filter(name => name !== "ACCESS")) {
      expect(shareAccessEligibility({ ...base, pathway: program, moment: GROWTH_MOMENTS.GETTING_STARTED_COMPLETED }).eligible).toBe(false);
    }
  });

  it("only mentions device help for programs that use a device", () => {
    for (const program of ["ACCESS", "RPM", "CCM_RPM", "PCM_RPM"]) {
      expect(CARE_CIRCLE_COPY.supportingFor(program).en).toMatch(/monitor setup|device setup/);
    }
    for (const program of ["CCM", "PCM", "ASM", "APCM"]) {
      expect(CARE_CIRCLE_COPY.supportingFor(program).en).not.toMatch(/monitor|device/);
    }
  });

  it("localizes the shared Care Circle copy", () => {
    for (const entry of [CARE_CIRCLE_COPY.label, CARE_CIRCLE_COPY.title, CARE_CIRCLE_COPY.cta]) {
      for (const value of localized(entry)) expect(value).toBeTruthy();
    }
    for (const program of programs) {
      for (const value of localized(CARE_CIRCLE_COPY.supportingFor(program))) expect(value).toBeTruthy();
    }
  });
});
