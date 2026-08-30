import { describe, expect, it } from "vitest";
import { ACCESS_COST_BY_TRACK, SECONDARY_COVERAGE_STATUSES, createOffer, createPrototypeOffer, normalizePrototypeConfig, resolveAccessCost, scenarioRequiresPhysician } from "../src/config.js";
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

  it("consolidates ACCESS education and disclosure without merging eligibility or consent", () => {
    const journey = journeyFor(stateFor("access-happy"));
    const orderedStages = ["ACCESS_ELIGIBILITY_RESULT", "CONSENT_REVIEW", "ACCESS_ALIGNMENT_PROCESSING", "ENROLLMENT_CONFIRMED"];
    expect(orderedStages.map(screen => journey.indexOf(screen))).toEqual([...orderedStages.map(screen => journey.indexOf(screen))].sort((a, b) => a - b));
    expect(new Set(orderedStages.map(screen => journey.indexOf(screen))).size).toBe(orderedStages.length);
    expect(journey).not.toContain("HOW_CARE_WORKS");
    expect(journey).not.toContain("DISCLOSURE");
    const traditionalJourney = journeyFor(stateFor("ccm-happy"));
    expect(traditionalJourney).toContain("HOW_CARE_WORKS");
    expect(traditionalJourney).toContain("DISCLOSURE");
  });

  it("keeps prototype eligibility separate from alignment and ends the not-eligible journey at its result", () => {
    const eligibleOffer = createPrototypeOffer({ program: "ACCESS", accessEligibilityResult: "eligible" });
    const notEligibleOffer = createPrototypeOffer({ program: "ACCESS", accessEligibilityResult: "notEligible" });
    expect(eligibleOffer.fixture.accessOutcome).toBe("eligible");
    expect(notEligibleOffer.fixture.accessOutcome).toBe("notEligible");
    expect(eligibleOffer.prototypeConfig).not.toHaveProperty("accessAlignmentResult");
    const eligibleJourney = journeyFor({ offer: eligibleOffer, screen: "ACCESS_ELIGIBILITY_RESULT", accessOutcome: "eligible" });
    const notEligibleJourney = journeyFor({ offer: notEligibleOffer, screen: "ACCESS_ELIGIBILITY_RESULT", accessOutcome: "notEligible" });
    expect(eligibleJourney).toContain("ACCESS_ALIGNMENT_PROCESSING");
    expect(notEligibleJourney.at(-1)).toBe("ACCESS_ELIGIBILITY_RESULT");
    expect(notEligibleJourney).not.toContain("DISCLOSURE");
    expect(notEligibleJourney).not.toContain("CONSENT_REVIEW");
    expect(notEligibleJourney).not.toContain("ACCESS_ALIGNMENT_PROCESSING");
    expect(notEligibleJourney).not.toContain("ENROLLMENT_CONFIRMED");
  });

  it("includes shipping only for the ship-device RPM branch", () => {
    expect(journeyFor(stateFor("rpm-shipping", { devicePath: "ship" }))).toContain("RPM_ADDRESS_CONFIRMATION");
    expect(journeyFor(stateFor("rpm-owned", { devicePath: "owned" }))).not.toContain("RPM_ADDRESS_CONFIRMATION");
  });

  it("requests Medicare ID only when it is missing", () => {
    expect(journeyFor(stateFor("access-missing-mbi"))).toContain("ACCESS_MEDICARE_IDENTIFIER");
    expect(journeyFor(stateFor("access-happy"))).not.toContain("ACCESS_MEDICARE_IDENTIFIER");
  });

  it("uses contextual labels and the resolved journey for progress", () => {
    const state = stateFor("rpm-shipping", { screen: "RPM_DEVICE_PATH", devicePath: "ship" });
    const progress = progressFor(state);
    expect(progress.label).toBe("Getting started");
    expect(progress.total).toBe(journeyFor(state).length);
    expect(progress.percent).toBeGreaterThan(0);
    expect(progress.percent).toBeLessThanOrEqual(100);
    expect(nextScreen(state)).toBe("RPM_ADDRESS_CONFIRMATION");
  });

  it("labels role selection separately from identity confirmation", () => {
    expect(progressFor(stateFor("access-happy", { screen: "DECISION_MAKER" })).label).toBe("Who’s completing");
    expect(progressFor(stateFor("access-happy", { screen: "IDENTITY_VERIFICATION" })).label).toBe("Confirm identity");
  });

  // Care activation is counted in stages the patient recognizes — the monitor, the goals, the
  // personalizing, the plan — so three taps arranging a monitor stay one step of four rather than
  // three of eleven. The whole point is that the number means something to the person reading it.
  it("counts ACCESS care activation in stages rather than in screens", () => {
    const device = progressFor(stateFor("access-happy", { screen: "ACCESS_BP_DEVICE_INFO" }));
    const address = progressFor(stateFor("access-happy", { screen: "ACCESS_BP_SHIPPING_ADDRESS" }));
    const goals = progressFor(stateFor("access-happy", { screen: "GOALS" }));
    const carePlan = progressFor(stateFor("access-happy", { screen: "ONBOARDING_COMPLETE" }));

    expect(device).toMatchObject({ careActivationStage: "DEVICE", current: 1, total: 4 });
    // Still inside the device stage: the counter does not move for every screen.
    expect(address).toMatchObject({ careActivationStage: "DEVICE", current: 1, total: 4 });
    expect(goals).toMatchObject({ careActivationStage: "GOALS", current: 2, total: 4 });
    expect(carePlan).toMatchObject({ careActivationStage: "CARE_PLAN", current: 4, total: 4 });
    expect(goals.percent).toBeGreaterThan(device.percent);
  });

  it("marks ACCESS enrollment confirmation as a completed transition before care activation", () => {
    const confirmation = progressFor(stateFor("access-happy", { screen: "ENROLLMENT_CONFIRMED" }));
    expect(confirmation).toMatchObject({ label: "Enrollment complete", current: 1, total: 1, percent: 100 });
    expect(progressFor(stateFor("access-happy", { screen: "ACCESS_BP_DEVICE_INFO" })).percent).toBeLessThan(100);
  });

  // The health check is gone as a destination, not merely renamed: nothing routes to it any more.
  it("no longer routes an ACCESS patient through the generic health check screens", () => {
    const journey = journeyFor(stateFor("access-happy", {}));
    expect(journey).not.toContain("ACCESS_BASELINE");
    expect(journey).not.toContain("ACCESS_MEASURE");
    expect(journey).not.toContain("ONBOARDING");
  });

  // Device, then goals, then personalization: the patient sees the care they already have before
  // being asked for anything, and the goals screen explains what the later questions are for.
  it("puts the monitor and the assigned goals ahead of the personalization screens", () => {
    const journey = journeyFor(stateFor("access-happy", {}));
    expect(journey.indexOf("ACCESS_BP_DEVICE_INFO")).toBeGreaterThan(journey.indexOf("ENROLLMENT_CONFIRMED"));
    expect(journey.indexOf("GOALS")).toBeGreaterThan(journey.indexOf("ACCESS_BP_FULFILLMENT_CONFIRMED"));
    expect(journey.indexOf("CLINICAL_VERIFICATION")).toBeGreaterThan(journey.indexOf("GOALS"));
    expect(journey.at(-1)).toBe("ONBOARDING_COMPLETE");
  });

  // The patient is never asked whether they own a monitor, so the answer has to come from their
  // record. Hardcoding one path sent somebody who already had a device to request a second, and
  // left the verification path unreachable for everybody.
  it("takes the device path from the record rather than from a question", () => {
    expect(journeyFor(stateFor("access-bp-incompatible", {}))).toContain("ACCESS_BP_DEVICE_VERIFICATION");
    expect(journeyFor(stateFor("access-bp-none", {}))).toContain("ACCESS_BP_DEVICE_INFO");
    expect(journeyFor(stateFor("access-bp-none", {}))).not.toContain("ACCESS_BP_DEVICE_VERIFICATION");
    // An explicit path still wins, so the existing branches stay reachable.
    expect(journeyFor(stateFor("access-bp-none", { bpDevicePath: "owned" }))).toContain("ACCESS_BP_DEVICE_VERIFICATION");
  });

  it("branches the ACCESS blood-pressure baseline by device path", () => {
    const owned = journeyFor(stateFor("access-happy", { screen: "ACCESS_MEASURE", bpDevicePath: "owned", deviceVerificationStatus: "PATIENT_CONFIRMED", bpDeviceVerificationStatus: "PATIENT_CONFIRMED" }));
    const help = journeyFor(stateFor("access-happy", { screen: "ACCESS_MEASURE", bpDevicePath: "help" }));
    const needed = journeyFor(stateFor("access-happy", { screen: "ACCESS_MEASURE", bpDevicePath: "needed" }));
    expect(owned).toEqual(expect.arrayContaining(["ACCESS_BP_DEVICE_VERIFICATION", "ACCESS_BP_DEVICE_RESULT", "ACCESS_BP_GUIDED_SETUP", "ACCESS_BP_MEASUREMENT", "CLINICAL_VERIFICATION", "GOALS"]));
    expect(owned).not.toContain("ACCESS_BP_BASELINE_RESULT");
    const completed = journeyFor(stateFor("access-happy", { bpDevicePath: "owned", deviceVerificationStatus: "SOURCE_VERIFIED", bpBaselineStatus: "COMPLETED" }));
    expect(completed).toContain("ACCESS_BP_BASELINE_RESULT");
    expect(help).not.toContain("ACCESS_BP_DEVICE_VERIFICATION");
    expect(help).toEqual(expect.arrayContaining(["ACCESS_BP_GUIDED_SETUP", "ACCESS_BP_MEASUREMENT"]));
    expect(needed).not.toContain("ACCESS_BP_MEASUREMENT");
    expect(needed).toEqual(expect.arrayContaining(["ACCESS_BP_DEVICE_INFO", "ACCESS_BP_SHIPPING_ADDRESS", "ACCESS_BP_FULFILLMENT_CONFIRMED", "CLINICAL_VERIFICATION", "GOALS"]));
    expect(needed).toContain("ONBOARDING_COMPLETE");
  });

  it("inserts representative details only for the personal representative branch", () => {
    const patientJourney = journeyFor(stateFor("access-happy", { completionRole: "patient", role: "patient" }));
    const helperJourney = journeyFor(stateFor("access-happy", { completionRole: "helper", role: "helper" }));
    const representativeState = stateFor("access-happy", { completionRole: "personalRepresentative", role: "representative", screen: "PERSONAL_REPRESENTATIVE_DETAILS" });
    const representativeJourney = journeyFor(representativeState);
    expect(patientJourney).not.toContain("PERSONAL_REPRESENTATIVE_DETAILS");
    expect(helperJourney).not.toContain("PERSONAL_REPRESENTATIVE_DETAILS");
    expect(representativeJourney).toContain("PERSONAL_REPRESENTATIVE_DETAILS");
    expect(representativeJourney.indexOf("PERSONAL_REPRESENTATIVE_DETAILS")).toBe(representativeJourney.indexOf("DECISION_MAKER") + 1);
    expect(representativeJourney.slice(2, 6)).toEqual(["PERSONAL_REPRESENTATIVE_DETAILS", "REPRESENTATIVE_MOBILE_VERIFICATION", "REPRESENTATIVE_AUTHORITY_ATTESTATION", "IDENTITY_VERIFICATION"]);
    expect(progressFor(representativeState).label).toBe("Your role");
  });

  it("keeps additional authority verification conditional", () => {
    const standard = stateFor("access-happy", { completionRole: "personalRepresentative", role: "representative" });
    const escalated = { ...standard, authorityAdditionalVerificationRequired: true };
    expect(journeyFor(standard)).not.toContain("REPRESENTATIVE_AUTHORITY_ESCALATION");
    expect(journeyFor(escalated)).toContain("REPRESENTATIVE_AUTHORITY_ESCALATION");
    expect(journeyFor(escalated).indexOf("REPRESENTATIVE_AUTHORITY_ESCALATION")).toBe(journeyFor(escalated).indexOf("IDENTITY_VERIFICATION") - 1);
  });

  it("provides a short non-numeric progress label for every resolved screen", () => {
    for (const scenario of ["ccm-happy", "rpm-shipping", "access-happy", "access-missing-mbi"]) {
      const base = stateFor(scenario, { devicePath: scenario === "rpm-shipping" ? "ship" : null });
      for (const screen of journeyFor(base)) {
        const progress = progressFor({ ...base, screen });
        expect(progress.label).toMatch(/^[A-Za-z ’']+$/);
        expect(progress.label).not.toMatch(/\d|step|of/i);
      }
    }
  });

  it("keeps outcome branches anchored to eligibility progress", () => {
    const base = stateFor("access-not-eligible");
    const eligibility = progressFor({ ...base, screen: "ACCESS_ELIGIBILITY_RESULT" });
    const stopped = progressFor({ ...base, screen: "OUTCOME_STOPPED" });
    expect(stopped.label).toBe("Eligibility");
    expect(stopped.percent).toBe(eligibility.percent);
  });

  it("keeps assistant support anchored to the originating enrollment stage", () => {
    const base = stateFor("access-happy", { screen: "ASSISTANT_LAYER", returnScreen: "ACCESS_PRE_ELIGIBILITY_NOTICE" });
    expect(progressFor(base).label).toBe("Eligibility");
    expect(progressFor(base).label).not.toBe("Questions");
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

  it("builds patient-friendly care capabilities for every pathway", () => {
    const expectations = {
      ACCESS: ["Regular health check-ins", "A personalized care plan", "Medication support", "Connected care team"],
      CCM: ["Ongoing support between visits", "A personalized care plan", "Medication support", "Care coordination"],
      RPM: ["Home health monitoring", "Reading review", "Support when readings need attention", "Connected care team"],
      "CCM + RPM": ["Ongoing support between visits", "Home health monitoring", "Medication support", "Connected care team"],
      PCM: ["Focused support for your main condition", "A personalized care plan", "Medication support", "Care coordination"]
    };
    for (const [program, titles] of Object.entries(expectations)) {
      const offer = createPrototypeOffer({ program });
      expect(offer.careCapabilities.map(item => item.title)).toEqual(titles);
      expect(offer.careCapabilities.map(item => item.title).join(" ")).not.toMatch(/\b(?:CCM|RPM|PCM|CPT)\b/);
    }
  });

  it("keeps every selected clinical condition in the generated offer", () => {
    const offer = createPrototypeOffer({
      program: "CCM",
      conditions: ["Hypertension", "Diabetes", "Heart Failure", "Chronic Kidney Disease"]
    });
    expect(offer.qualifyingConditions.map(item => item.name)).toEqual(["Hypertension", "Diabetes", "Heart Failure", "Chronic Kidney Disease"]);
    expect(offer.qualifyingConditions.at(-1).patientFriendlyName).toBe("chronic kidney disease");
    expect(offer.clinicalProfile.baselineRequirements).toHaveLength(4);
    expect(offer.onboardingModules).toEqual(expect.arrayContaining(["blood-pressure", "diabetes", "heart-failure", "kidney-health"]));
  });

  it("only exposes an individual physician for physician referral scenarios", () => {
    expect(createPrototypeOffer({ source: "Physician Referral", physician: "Dr. Martinez-Clark" }).physician.displayName).toBe("Dr. Martinez-Clark");
    expect(createPrototypeOffer({ source: "ITERA Direct Outreach", physician: "Dr. Martinez-Clark" }).physician).toBeNull();
  });

  it("builds ACCESS disclosure configuration from the resolved scenario", () => {
    const defaults = createPrototypeOffer({ program: "ACCESS", source: "Physician Referral", physician: "Dr. Martinez-Clark", accessTrack: "CKM" });
    expect(defaults.disclosures.accessConfig).toEqual({
      accessCost: { track: "CKM", expectedMonthlyAmount: 7, displayValue: "$7 per month", secondaryCoverageStatus: "SECONDARY_NOT_VERIFIED", configuredSecondaryCoverageStatus: null },
      costSharingType: "COST_SHARING_APPLIES",
      costSharingAmount: null,
      verifiedPatientCost: null,
      showClaimsSharing: false,
      showTempoDisclosure: false,
      tempoDisclosureText: "",
      physicianDisplayName: "Dr. Martinez-Clark",
      careTrack: "CKM"
    });

    const configured = createPrototypeOffer({
      program: "ACCESS",
      accessCostSharingType: "COST_SHARING_APPLIES",
      accessCostSharingAmount: "$42",
      verifiedPatientCost: { status: "verified", displayText: { en: "$18 verified patient cost", es: "$18 de costo verificado", ht: "$18 depans verifye" } },
      showAccessClaimsSharing: true,
      showAccessTempoDisclosure: true,
      accessTempoDisclosureText: "Configured device disclosure."
    });
    expect(configured.disclosures.accessConfig).toMatchObject({
      costSharingType: "COST_SHARING_APPLIES",
      costSharingAmount: "$42",
      verifiedPatientCost: { status: "verified", displayText: { en: "$18 verified patient cost", es: "$18 de costo verificado", ht: "$18 depans verifye" } },
      showClaimsSharing: true,
      showTempoDisclosure: true,
      tempoDisclosureText: "Configured device disclosure."
    });
  });

  it("centralizes expected ACCESS cost by track and secondary coverage status", () => {
    expect(ACCESS_COST_BY_TRACK).toEqual({ eCKM: 6, CKM: 7, BH: 3, MSK: 3 });
    expect(resolveAccessCost("eCKM")).toEqual({ track: "eCKM", expectedMonthlyAmount: 6, displayValue: "$6 per month", secondaryCoverageStatus: "SECONDARY_NOT_VERIFIED", configuredSecondaryCoverageStatus: null });
    expect(resolveAccessCost("CKM", SECONDARY_COVERAGE_STATUSES.PRESENT_NOT_CONFIRMED)).toMatchObject({ expectedMonthlyAmount: 7, displayValue: "up to $7 per month", secondaryCoverageStatus: "SECONDARY_PRESENT_NOT_CONFIRMED" });
    expect(resolveAccessCost("BH", SECONDARY_COVERAGE_STATUSES.VERIFIED)).toMatchObject({ expectedMonthlyAmount: 3, displayValue: "$0", secondaryCoverageStatus: "SECONDARY_COVERAGE_VERIFIED" });
    expect(createOffer("access-happy").accessCost).toMatchObject({ track: "eCKM", expectedMonthlyAmount: 6 });
  });

  it("normalizes invalid ACCESS coverage and controlled conditions before building an offer", () => {
    const normalized = normalizePrototypeConfig({ program: "ACCESS", coverage: "Medicare Advantage", conditions: ["Diabetes", "Other"] });
    expect(normalized.coverage).toBe("Original Medicare");
    expect(normalized.conditions).toEqual(["Diabetes"]);
    expect(createPrototypeOffer({ program: "ACCESS", coverage: "Medicare Advantage" }).payer.type).toBe("OriginalMedicare");
  });

  it("models all prototype blood-pressure device scenarios without fake assignments", () => {
    const patientOwned = createPrototypeOffer({ program: "ACCESS", conditions: ["Hypertension"], accessTrack: "eCKM", bpDeviceScenario: "patient-owned-unsupported" });
    expect(patientOwned.fixture).toMatchObject({ bpDeviceAssignment: "patient-owned", patientHasBloodPressureMonitor: true, deviceSource: "PATIENT_OWNED", assignedDeviceId: null, deviceVendor: "OTHER", deviceStatus: "ACTIVE", integrationProvider: "OTHER", integrationStatus: "UNSUPPORTED" });
    expect(createPrototypeOffer({ bpDeviceScenario: "itera-tenovi" }).fixture).toMatchObject({ assignedDeviceId: "tenovi-bp-8842", deviceVendor: "TENOVI", integrationStatus: "CONNECTED" });
    expect(createPrototypeOffer({ bpDeviceScenario: "itera-pylo" }).fixture).toMatchObject({ assignedDeviceId: "pylo-bp-6719", deviceVendor: "PYLO", integrationStatus: "CONNECTED" });
    expect(createPrototypeOffer({ bpDeviceScenario: "none" }).fixture).toMatchObject({ bpDeviceAssignment: "none", patientHasBloodPressureMonitor: false, assignedDeviceId: null });
  });

  it("consolidates ACCESS referral sources while preserving non-ACCESS options", () => {
    expect(normalizePrototypeConfig({ program: "ACCESS", source: "Physician Referral" })).toMatchObject({ source: "Provider / Practice Referral", referralOrigin: "physician" });
    expect(normalizePrototypeConfig({ program: "ACCESS", source: "Practice Outreach" })).toMatchObject({ source: "Provider / Practice Referral", referralOrigin: "practiceStaff" });
    expect(normalizePrototypeConfig({ program: "CCM", source: "Practice Outreach" })).toMatchObject({ source: "Practice Outreach", referralOrigin: null });
    const offer = createPrototypeOffer({ program: "ACCESS", source: "Provider / Practice Referral", referralOrigin: "careTeam" });
    expect(offer.enrollmentSource).toBe("Provider / Practice Referral");
    expect(offer.referralOrigin).toBe("careTeam");
  });

  it("models physician involvement independently from the physician name and photo", () => {
    expect(scenarioRequiresPhysician("ACCESS", "ITERA Direct Outreach")).toBe(false);
    expect(scenarioRequiresPhysician("ACCESS", "Physician Referral")).toBe(true);
    expect(scenarioRequiresPhysician("CCM", "ITERA Direct Outreach")).toBe(true);
    const direct = createPrototypeOffer({ program: "ACCESS", source: "ITERA Direct Outreach", physicianDisplayName: "Dr. Hidden" });
    const referral = createPrototypeOffer({ program: "ACCESS", source: "Physician Referral", physicianDisplayName: "Dr. Rivera", physicianPhotoUrl: "/doctor-rivera.jpg" });
    expect(direct.physician).toBeNull();
    expect(direct.referringProvider).toBeNull();
    expect(referral.physician.displayName).toBe("Dr. Rivera");
    expect(referral.referringProvider.verifiedPhotoUrl).toBe("/doctor-rivera.jpg");
  });
});
