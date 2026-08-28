import { describe, expect, it } from "vitest";
import { ACCESS_COST_BY_TRACK } from "../src/config.js";
import { COST_SHARE_COVERAGE, COVERAGE_VERIFICATION, MEDICARE_COVERAGE_TYPES, SECONDARY_COVERAGE_TYPES, normalizeCoverage } from "../src/coverage.js";
import { EXPLANATION_CODES, RESPONSIBILITY_STATUS, accessTrackCost, resolveExpectedPatientResponsibility } from "../src/financialResponsibility.js";
import { EMMI_DEMO_PATIENTS, emmiDemoCoverage } from "../src/mock/emmiFixtures.js";

const daysAgo = days => new Date(Date.now() - days * 86400000).toISOString();
const originalMedicare = () => ({ type: MEDICARE_COVERAGE_TYPES.ORIGINAL_MEDICARE, partAActive: true, partBActive: true, verificationStatus: COVERAGE_VERIFICATION.VERIFIED });
const supplement = (overrides = {}) => ({
  type: SECONDARY_COVERAGE_TYPES.MEDICARE_SUPPLEMENT,
  carrierName: "Test Carrier",
  active: true,
  verificationStatus: COVERAGE_VERIFICATION.VERIFIED,
  coversAccessCostShare: COST_SHARE_COVERAGE.COVERED,
  ...overrides
});
const coverage = (secondaryPayers = [], overrides = {}) => ({ medicare: originalMedicare(), secondaryPayers, verifiedAt: daysAgo(1), ...overrides });

describe("coverage normalization", () => {
  it("never infers Original Medicare from Part A and Part B being active", () => {
    // A Medicare Advantage member has both parts too, so the parts alone prove nothing.
    const advantage = normalizeCoverage({ medicare: { type: MEDICARE_COVERAGE_TYPES.MEDICARE_ADVANTAGE, partAActive: true, partBActive: true, verificationStatus: COVERAGE_VERIFICATION.VERIFIED }, verifiedAt: daysAgo(1) });
    expect(advantage.medicare.isOriginalMedicare).toBe(false);
    expect(advantage.medicare.isMedicareAdvantage).toBe(true);
    const unstated = normalizeCoverage({ medicare: { partAActive: true, partBActive: true }, verifiedAt: daysAgo(1) });
    expect(unstated.medicare.type).toBe(MEDICARE_COVERAGE_TYPES.UNKNOWN);
    expect(unstated.medicare.isOriginalMedicare).toBe(false);
  });

  it("only calls a payer supplemental when it is actually a Medicare Supplement", () => {
    for (const type of [SECONDARY_COVERAGE_TYPES.MEDICAID, SECONDARY_COVERAGE_TYPES.QMB, SECONDARY_COVERAGE_TYPES.EMPLOYER_RETIREE, SECONDARY_COVERAGE_TYPES.OTHER_PAYER]) {
      const normalized = normalizeCoverage(coverage([supplement({ type })]));
      expect(normalized.supplemental, `${type} must not be labelled supplemental`).toBeNull();
    }
    expect(normalizeCoverage(coverage([supplement()])).supplemental).not.toBeNull();
    // An unrecognised payer type degrades to OTHER_PAYER rather than to a supplement.
    expect(normalizeCoverage(coverage([supplement({ type: "SOMETHING_NEW" })])).supplemental).toBeNull();
  });

  it("reports verification that has aged out as stale rather than trusting it", () => {
    const fresh = normalizeCoverage(coverage([supplement()], { verifiedAt: daysAgo(2) }));
    expect(fresh.coverageIsFresh).toBe(true);
    expect(fresh.supplemental.verificationStatus).toBe(COVERAGE_VERIFICATION.VERIFIED);
    const old = normalizeCoverage(coverage([supplement()], { verifiedAt: daysAgo(240) }));
    expect(old.coverageIsFresh).toBe(false);
    expect(old.medicare.verificationStatus).toBe(COVERAGE_VERIFICATION.STALE);
    expect(old.supplemental.verificationStatus).toBe(COVERAGE_VERIFICATION.STALE);
  });
});

describe("expected patient responsibility", () => {
  it("takes the gross amount from the track configuration, never from a stored copy", () => {
    for (const [track, amount] of Object.entries(ACCESS_COST_BY_TRACK)) {
      expect(accessTrackCost(track)).toBe(amount);
      expect(resolveExpectedPatientResponsibility({ track, coverage: coverage() }).grossBeneficiaryResponsibility).toBe(amount);
    }
    // An unknown track falls back to the default rather than inventing a number.
    expect(accessTrackCost("NOT_A_TRACK")).toBe(ACCESS_COST_BY_TRACK.eCKM);
    // No patient record carries its own price any more, so a track and its amount cannot drift.
    for (const patient of Object.values(EMMI_DEMO_PATIENTS)) expect(patient).not.toHaveProperty("expectedMonthlyCost");
  });

  it("reaches $0 only when the supplement is verified to cover this cost share", () => {
    const covered = resolveExpectedPatientResponsibility({ track: "eCKM", coverage: coverage([supplement()]) });
    expect(covered.expectedPatientPayment).toBe(0);
    expect(covered.grossBeneficiaryResponsibility).toBe(6);
    expect(covered.supplementalExpectedPayment).toBe(6);
    expect(covered.explanationCode).toBe(EXPLANATION_CODES.SUPPLEMENTAL_COVERS_COST_SHARE);
    expect(covered.verificationStatus).toBe(RESPONSIBILITY_STATUS.VERIFIED);
  });

  it("does not treat having a supplement as meaning the patient pays nothing", () => {
    // The whole point: an active, verified policy whose behaviour for this cost is unknown.
    const unknown = resolveExpectedPatientResponsibility({ track: "eCKM", coverage: coverage([supplement({ coversAccessCostShare: COST_SHARE_COVERAGE.UNKNOWN })]) });
    expect(unknown.expectedPatientPayment).toBeNull();
    expect(unknown.verificationStatus).toBe(RESPONSIBILITY_STATUS.UNKNOWN);
    expect(unknown.explanationCode).toBe(EXPLANATION_CODES.SUPPLEMENTAL_COVERAGE_UNKNOWN);

    // A policy that exists but does not pay this cost leaves the full amount.
    const notCovered = resolveExpectedPatientResponsibility({ track: "eCKM", coverage: coverage([supplement({ coversAccessCostShare: COST_SHARE_COVERAGE.NOT_COVERED })]) });
    expect(notCovered.expectedPatientPayment).toBe(6);

    // An inactive policy is not coverage.
    const inactive = resolveExpectedPatientResponsibility({ track: "eCKM", coverage: coverage([supplement({ active: false })]) });
    expect(inactive.expectedPatientPayment).toBe(6);
    expect(inactive.explanationCode).toBe(EXPLANATION_CODES.NO_SUPPLEMENTAL_COVERAGE);
  });

  it("charges the track amount when there is no supplemental coverage at all", () => {
    const result = resolveExpectedPatientResponsibility({ track: "CKM", coverage: coverage([]) });
    expect(result.expectedPatientPayment).toBe(7);
    expect(result.grossBeneficiaryResponsibility).toBe(7);
    expect(result.explanationCode).toBe(EXPLANATION_CODES.NO_SUPPLEMENTAL_COVERAGE);
  });

  it("refuses to state an amount when verification is stale or missing", () => {
    const stale = resolveExpectedPatientResponsibility({ track: "eCKM", coverage: coverage([supplement()], { verifiedAt: daysAgo(240) }) });
    expect(stale.expectedPatientPayment).toBeNull();
    expect(stale.explanationCode).toBe(EXPLANATION_CODES.COVERAGE_VERIFICATION_STALE);
    expect(stale.requiresReverification).toBe(true);

    const unverified = resolveExpectedPatientResponsibility({ track: "eCKM", coverage: { medicare: { type: MEDICARE_COVERAGE_TYPES.ORIGINAL_MEDICARE }, secondaryPayers: [], verifiedAt: daysAgo(1) } });
    expect(unverified.expectedPatientPayment).toBeNull();
    expect(unverified.explanationCode).toBe(EXPLANATION_CODES.COVERAGE_NOT_VERIFIED);

    // Nothing at all must not produce a number in either direction.
    const empty = resolveExpectedPatientResponsibility({});
    expect(empty.expectedPatientPayment).toBeNull();
  });

  it("sends Medicare Advantage to eligibility rather than quoting a price", () => {
    const result = resolveExpectedPatientResponsibility({ track: "eCKM", coverage: { medicare: { type: MEDICARE_COVERAGE_TYPES.MEDICARE_ADVANTAGE, partAActive: true, partBActive: true, verificationStatus: COVERAGE_VERIFICATION.VERIFIED }, secondaryPayers: [], verifiedAt: daysAgo(1) } });
    expect(result.expectedPatientPayment).toBeNull();
    expect(result.requiresEligibilityReassessment).toBe(true);
    expect(result.explanationCode).toBe(EXPLANATION_CODES.MEDICARE_ADVANTAGE_NOT_ELIGIBLE);
  });

  it("gives QMB its own rules instead of treating it as commercial Medigap", () => {
    const result = resolveExpectedPatientResponsibility({ track: "eCKM", coverage: coverage([supplement({ type: SECONDARY_COVERAGE_TYPES.QMB })]) });
    expect(result.explanationCode).toBe(EXPLANATION_CODES.QMB_COST_SHARE_RULES);
    expect(result.expectedPatientPayment).toBeNull();
    expect(result.requiresCareTeamReview).toBe(true);
  });

  it("always answers as an expected amount, never an adjudicated one", () => {
    const result = resolveExpectedPatientResponsibility({ track: "eCKM", coverage: coverage([supplement()]) });
    expect(result.responsibilityType).toBe("EXPECTED");
    expect(result.currency).toBe("USD");
    expect(result.coverageVerifiedAt).toBeTruthy();
    expect(result.verificationSource).toBeTruthy();
  });
});

describe("demo scenarios", () => {
  // The scenarios the product team asked to be able to demonstrate, end to end through the engine.
  it.each([
    ["DEMO-P001", 6, 0, EXPLANATION_CODES.SUPPLEMENTAL_COVERS_COST_SHARE],
    ["DEMO-P002", 6, null, EXPLANATION_CODES.SUPPLEMENTAL_COVERAGE_UNKNOWN],
    ["DEMO-P003", 6, 6, EXPLANATION_CODES.NO_SUPPLEMENTAL_COVERAGE],
    ["DEMO-P004", 6, null, EXPLANATION_CODES.MEDICARE_ADVANTAGE_NOT_ELIGIBLE],
    ["DEMO-P005", 7, null, EXPLANATION_CODES.COVERAGE_VERIFICATION_STALE],
    ["DEMO-P006", 6, null, EXPLANATION_CODES.QMB_COST_SHARE_RULES]
  ])("%s resolves to the expected amount and reason", (patientId, gross, expected, explanationCode) => {
    const patient = EMMI_DEMO_PATIENTS[patientId];
    const result = resolveExpectedPatientResponsibility({ track: patient.accessTrack, coverage: emmiDemoCoverage(patientId) });
    expect(result.grossBeneficiaryResponsibility).toBe(gross);
    expect(result.expectedPatientPayment).toBe(expected);
    expect(result.explanationCode).toBe(explanationCode);
  });

  it("gives the primary demo patient verified Original Medicare and a verified supplement", () => {
    const normalized = normalizeCoverage(emmiDemoCoverage("DEMO-P001"));
    expect(normalized.medicare.isOriginalMedicare).toBe(true);
    expect(normalized.medicare.partAActive).toBe(true);
    expect(normalized.medicare.partBActive).toBe(true);
    expect(normalized.medicare.isMedicareAdvantage).toBe(false);
    expect(normalized.medicare.verificationStatus).toBe(COVERAGE_VERIFICATION.VERIFIED);
    expect(normalized.supplemental.type).toBe(SECONDARY_COVERAGE_TYPES.MEDICARE_SUPPLEMENT);
    expect(normalized.supplemental.coversAccessCostShare).toBe(COST_SHARE_COVERAGE.COVERED);
    expect(normalized.coverageIsFresh).toBe(true);
  });
});
