import { describe, expect, it } from "vitest";
import { createOffer, createPrototypeOffer } from "../src/config.js";
import { journeyFor, nextScreen, progressFor } from "../src/machine.js";

const stateFor = (scenarioId, overrides = {}) => ({ offer: createOffer(scenarioId), screen: "INVITATION", devicePath: null, ...overrides });

describe("enrollment state machine", () => {
  it("uses the official ITERA support number", () => {
    expect(createOffer("ccm-happy").participantProvider.supportPhone).toBe("(305) 394-8070");
  });

  it("never asks the patient to select a program", () => {
    for (const scenario of ["ccm-happy", "rpm-shipping", "access-happy"]) {
      expect(journeyFor(stateFor(scenario))).not.toContain("PROGRAM_SELECTION");
    }
  });

  it("places ACCESS alignment before confirmed enrollment", () => {
    const journey = journeyFor(stateFor("access-happy"));
    expect(journey.indexOf("ACCESS_ALIGNMENT_PROCESSING")).toBeLessThan(journey.indexOf("ENROLLMENT_CONFIRMED"));
  });

  it("includes shipping only for the ship-device RPM branch", () => {
    expect(journeyFor(stateFor("rpm-shipping", { devicePath: "ship" }))).toContain("RPM_ADDRESS_CONFIRMATION");
    expect(journeyFor(stateFor("rpm-owned", { devicePath: "owned" }))).not.toContain("RPM_ADDRESS_CONFIRMATION");
  });

  it("requests Medicare ID only when it is missing", () => {
    expect(journeyFor(stateFor("access-missing-mbi"))).toContain("ACCESS_MEDICARE_IDENTIFIER");
    expect(journeyFor(stateFor("access-happy"))).not.toContain("ACCESS_MEDICARE_IDENTIFIER");
  });

  it("uses a separate setup progress phase", () => {
    const state = stateFor("rpm-shipping", { screen: "RPM_DEVICE_PATH", devicePath: "ship" });
    expect(progressFor(state).label).toBe("Home monitoring setup");
    expect(nextScreen(state)).toBe("RPM_ADDRESS_CONFIRMATION");
  });

  it("generates a single combined journey for CCM + RPM", () => {
    const offer = createPrototypeOffer({ program: "CCM + RPM" });
    const journey = journeyFor({ offer, screen: "INVITATION", devicePath: null });
    expect(offer.pathway).toBe("CCM_RPM");
    expect(offer.consent.services).toEqual(["Ongoing care support (CCM)", "Home monitoring (RPM)"]);
    expect(journey.filter(screen => screen === "CONSENT_REVIEW")).toHaveLength(1);
    expect(journey).toContain("RPM_DEVICE_PATH");
  });

  it("resolves PCM and PCM + RPM according to their capabilities", () => {
    const pcm = createPrototypeOffer({ program: "PCM", condition: "Diabetes" });
    const combined = createPrototypeOffer({ program: "PCM + RPM", condition: "Heart Failure" });
    expect(pcm.qualifyingCondition.patientFriendlyName).toBe("diabetes");
    expect(journeyFor({ offer: pcm, screen: "INVITATION" })).toContain("CLINICAL_VERIFICATION");
    expect(journeyFor({ offer: combined, screen: "INVITATION", devicePath: null })).toContain("RPM_FIRST_READING");
  });

  it("resolves ASM and APCM as clinical care-management pathways", () => {
    const asm = createPrototypeOffer({ program: "ASM" });
    const apcm = createPrototypeOffer({ program: "APCM" });
    expect(asm.pathway).toBe("ASM");
    expect(asm.consent.services).toEqual(["Advanced specialty management (ASM)"]);
    expect(apcm.pathway).toBe("APCM");
    expect(apcm.consent.services).toEqual(["Advanced primary care management (APCM)"]);
    for (const offer of [asm, apcm]) {
      const journey = journeyFor({ offer, screen: "INVITATION" });
      expect(journey).toContain("CLINICAL_VERIFICATION");
      expect(journey).not.toContain("ACCESS_PRE_ELIGIBILITY_NOTICE");
      expect(journey).not.toContain("RPM_DEVICE_PATH");
    }
  });

  it("keeps every selected clinical condition in the generated offer", () => {
    const offer = createPrototypeOffer({
      program: "CCM",
      conditions: ["Hypertension", "Diabetes", "Chronic Kidney Disease", "Other"],
      otherCondition: "Aortic aneurysm"
    });
    expect(offer.qualifyingConditions.map(item => item.name)).toEqual(["Hypertension", "Diabetes", "Chronic Kidney Disease", "Other"]);
    expect(offer.qualifyingConditions.at(-1).patientFriendlyName).toBe("Aortic aneurysm");
    expect(offer.clinicalProfile.baselineRequirements).toHaveLength(4);
    expect(offer.onboardingModules).toEqual(expect.arrayContaining(["blood-pressure", "diabetes", "kidney-health", "other-condition"]));
  });

  it("only exposes an individual physician for physician referral scenarios", () => {
    expect(createPrototypeOffer({ source: "Physician Referral", physician: "Dr. Martinez-Clark" }).physician.displayName).toBe("Dr. Martinez-Clark");
    expect(createPrototypeOffer({ source: "ITERA Direct Outreach", physician: "Dr. Martinez-Clark" }).physician).toBeNull();
  });
});
