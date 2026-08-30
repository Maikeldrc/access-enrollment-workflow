import { describe, expect, it } from "vitest";
import { CANONICAL_PATIENT_SCENARIO, PROTOTYPE_OPTIONS, createPrototypeOffer, isProviderReferralSource, normalizePrototypeConfig, prescriberFor, scenarioRequiresPhysician, scenarioUsesBloodPressureMonitoring } from "../src/config.js";

// The public link no longer asks anyone to configure a scenario, which means nothing checks these
// values at runtime any more. They are the invitation, so they are asserted here instead: a change
// to the canonical patient is a deliberate edit to one object, never an accident downstream.
describe("the canonical patient invitation", () => {
  it("describes one ACCESS hypertension patient referred by Dr. Fresner", () => {
    expect(CANONICAL_PATIENT_SCENARIO.program).toBe("ACCESS");
    expect(CANONICAL_PATIENT_SCENARIO.conditions).toEqual(["Hypertension"]);
    expect(CANONICAL_PATIENT_SCENARIO.accessTrack).toBe("eCKM");
    expect(CANONICAL_PATIENT_SCENARIO.coverage).toBe("Original Medicare");
    expect(CANONICAL_PATIENT_SCENARIO.accessEligibilityResult).toBe("eligible");
    expect(CANONICAL_PATIENT_SCENARIO.physicianDisplayName).toBe("Dr. Fresner");
    expect(isProviderReferralSource(CANONICAL_PATIENT_SCENARIO.source)).toBe(true);
    expect(CANONICAL_PATIENT_SCENARIO.referralOrigin).toBe("physician");
  });

  it("survives normalization unchanged, so the entry point cannot be handed a different patient", () => {
    expect(normalizePrototypeConfig(CANONICAL_PATIENT_SCENARIO)).toEqual({ ...CANONICAL_PATIENT_SCENARIO });
  });

  it("is a scenario that requires and resolves a named referring physician", () => {
    expect(scenarioRequiresPhysician(CANONICAL_PATIENT_SCENARIO.program, CANONICAL_PATIENT_SCENARIO.source)).toBe(true);
    const offer = createPrototypeOffer(CANONICAL_PATIENT_SCENARIO);
    expect(offer.physician).toEqual({ displayName: "Dr. Fresner", id: "dr-fresner" });
    expect(offer.referringProvider.name).toBe("Dr. Fresner");
    expect(offer.enrollmentSource).toBe("Provider / Practice Referral");
    expect(offer.referralOrigin).toBe("physician");
  });

  it("builds an ACCESS offer with hypertension as the only condition and no other program", () => {
    const offer = createPrototypeOffer(CANONICAL_PATIENT_SCENARIO);
    expect(offer.pathway).toBe("ACCESS");
    expect(offer.program).toBe("ACCESS");
    expect(offer.accessTrack).toBe("eCKM");
    expect(offer.qualifyingConditions.map(condition => condition.name)).toEqual(["Hypertension"]);
    expect(offer.clinicalProfile.primaryCondition.name).toBe("Hypertension");
    expect(offer.payer.type).toBe("OriginalMedicare");
    expect(offer.fixture.accessOutcome).toBe("eligible");
    // No other clinical condition and no other program reaches the patient through the offer.
    const patientFacingCopy = JSON.stringify([offer.content, offer.consent, offer.disclosures, offer.careCapabilities, offer.qualifyingConditions]);
    for (const condition of PROTOTYPE_OPTIONS.conditions.filter(name => name !== "Hypertension")) expect(patientFacingCopy).not.toContain(condition);
    for (const program of ["CCM", "RPM", "PCM", "APCM", "ASM", "BHI", "CoCM", "RTM"]) expect(patientFacingCopy).not.toContain(program);
  });

  // Blood pressure monitoring is part of this patient's care; the monitor itself is not theirs yet.
  // Those are different facts, and care activation depends on the second one: arranging the monitor
  // is the first tangible thing ACCESS does, so the invitation must not start out already owning one.
  it("keeps blood pressure monitoring in the pathway while the patient still has no monitor", () => {
    expect(scenarioUsesBloodPressureMonitoring(CANONICAL_PATIENT_SCENARIO)).toBe(true);
    const offer = createPrototypeOffer(CANONICAL_PATIENT_SCENARIO);
    expect(offer.onboardingModules).toContain("blood-pressure");
    expect(offer.fixture.deviceSource).toBe("NONE");
    expect(offer.fixture.integrationStatus).not.toBe("CONNECTED");
  });

  // The demo medications live in runtime state, not in the offer, so agreeing with the offer's
  // physician today is not the same as being unable to disagree tomorrow. These two hold them
  // together: the first fails if the prescriber drifts, the second fails if a literal comes back.
  it("writes the demo prescriptions under the physician the invitation names", () => {
    const offer = createPrototypeOffer(CANONICAL_PATIENT_SCENARIO);
    expect(prescriberFor(CANONICAL_PATIENT_SCENARIO)).toEqual({ id: offer.physician.id, name: offer.physician.displayName });
    expect(prescriberFor(CANONICAL_PATIENT_SCENARIO).name).toBe("Dr. Fresner");
  });

  it("moves the prescriber with the invited physician instead of pinning one name", () => {
    const invited = { ...CANONICAL_PATIENT_SCENARIO, physicianDisplayName: "Dr. Okonkwo" };
    const offer = createPrototypeOffer(invited);
    expect(prescriberFor(invited)).toEqual({ id: offer.physician.id, name: "Dr. Okonkwo" });
    expect(prescriberFor(invited).id).toBe("dr-okonkwo");
  });

  it("still requires the enrollment steps the patient has not completed yet", () => {
    const offer = createPrototypeOffer(CANONICAL_PATIENT_SCENARIO);
    expect(offer.consent.required).toBe(true);
    expect(offer.consent.version).toBeTruthy();
    expect(offer.disclosures.version).toBeTruthy();
    expect(offer.disclosures.accessConfig.careTrack).toBe("eCKM");
    expect(offer.disclosures.accessConfig.physicianDisplayName).toBe("Dr. Fresner");
  });
});
