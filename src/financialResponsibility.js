import { ACCESS_COST_BY_TRACK } from "./config.js";
import { COST_SHARE_COVERAGE, COVERAGE_VERIFICATION, MEDICARE_COVERAGE_TYPES, normalizeCoverage } from "./coverage.js";

// Deterministic financial responsibility engine.
//
// The assistant never does insurance arithmetic. It receives the finished structured result from
// here and puts it into plain language. That split is the whole point: a language model asked to
// reason from raw eligibility data will eventually decide that having a supplement means paying
// nothing, and a patient will act on that.
//
// The gross amount always comes from ACCESS_COST_BY_TRACK, never from a copy stored on a patient
// record, so a track and its price can never drift apart.

export const RESPONSIBILITY_STATUS = Object.freeze({
  VERIFIED: "VERIFIED",
  UNKNOWN: "EXPECTED_COST_UNKNOWN",
  NOT_APPLICABLE: "NOT_APPLICABLE"
});

export const EXPLANATION_CODES = Object.freeze({
  SUPPLEMENTAL_COVERS_COST_SHARE: "SUPPLEMENTAL_COVERS_COST_SHARE",
  NO_SUPPLEMENTAL_COVERAGE: "NO_SUPPLEMENTAL_COVERAGE",
  SUPPLEMENTAL_COVERAGE_UNKNOWN: "SUPPLEMENTAL_COVERAGE_UNKNOWN",
  COVERAGE_VERIFICATION_STALE: "COVERAGE_VERIFICATION_STALE",
  COVERAGE_NOT_VERIFIED: "COVERAGE_NOT_VERIFIED",
  QMB_COST_SHARE_RULES: "QMB_COST_SHARE_RULES",
  MEDICARE_ADVANTAGE_NOT_ELIGIBLE: "MEDICARE_ADVANTAGE_NOT_ELIGIBLE"
});

export const accessTrackCost = (track = "eCKM") =>
  (Object.prototype.hasOwnProperty.call(ACCESS_COST_BY_TRACK, track) ? ACCESS_COST_BY_TRACK[track] : ACCESS_COST_BY_TRACK.eCKM);

const result = fields => Object.freeze({
  program: "ACCESS",
  currency: "USD",
  // Always "expected": nothing here is an adjudicated claim, and saying so keeps the promise
  // honest if the insurers process it differently.
  responsibilityType: "EXPECTED",
  ...fields
});

export function resolveExpectedPatientResponsibility({ track = "eCKM", coverage = {}, now = new Date() } = {}) {
  const normalized = normalizeCoverage(coverage, now);
  const gross = accessTrackCost(track);
  const base = {
    track: Object.prototype.hasOwnProperty.call(ACCESS_COST_BY_TRACK, track) ? track : "eCKM",
    grossBeneficiaryResponsibility: gross,
    coverageVerifiedAt: normalized.verifiedAt,
    verificationSource: normalized.verificationSource,
    medicareCoverageType: normalized.medicare.type,
    supplementalCoverageVerified: false,
    supplementalExpectedPayment: 0
  };

  // ACCESS is built on Original Medicare. A Medicare Advantage member is an eligibility question,
  // not a pricing question, so the engine refuses to quote an amount and defers.
  if (normalized.medicare.type === MEDICARE_COVERAGE_TYPES.MEDICARE_ADVANTAGE) {
    return result({
      ...base,
      expectedPatientPayment: null,
      verificationStatus: RESPONSIBILITY_STATUS.NOT_APPLICABLE,
      explanationCode: EXPLANATION_CODES.MEDICARE_ADVANTAGE_NOT_ELIGIBLE,
      requiresEligibilityReassessment: true
    });
  }

  if (normalized.medicare.verificationStatus === COVERAGE_VERIFICATION.STALE) {
    return result({ ...base, expectedPatientPayment: null, verificationStatus: RESPONSIBILITY_STATUS.UNKNOWN, explanationCode: EXPLANATION_CODES.COVERAGE_VERIFICATION_STALE, requiresReverification: true });
  }
  if (normalized.medicare.verificationStatus !== COVERAGE_VERIFICATION.VERIFIED) {
    return result({ ...base, expectedPatientPayment: null, verificationStatus: RESPONSIBILITY_STATUS.UNKNOWN, explanationCode: EXPLANATION_CODES.COVERAGE_NOT_VERIFIED, requiresReverification: true });
  }

  // A Qualified Medicare Beneficiary is not a commercial Medigap policy and does not share its
  // rules, so it gets its own path rather than being folded into "has a supplement".
  if (normalized.qmb) {
    return result({ ...base, expectedPatientPayment: null, verificationStatus: RESPONSIBILITY_STATUS.UNKNOWN, explanationCode: EXPLANATION_CODES.QMB_COST_SHARE_RULES, requiresCareTeamReview: true });
  }

  const supplement = normalized.supplemental;
  if (!supplement || !supplement.active) {
    return result({ ...base, expectedPatientPayment: gross, verificationStatus: RESPONSIBILITY_STATUS.VERIFIED, explanationCode: EXPLANATION_CODES.NO_SUPPLEMENTAL_COVERAGE });
  }
  if (supplement.verificationStatus === COVERAGE_VERIFICATION.STALE) {
    return result({ ...base, expectedPatientPayment: null, verificationStatus: RESPONSIBILITY_STATUS.UNKNOWN, explanationCode: EXPLANATION_CODES.COVERAGE_VERIFICATION_STALE, requiresReverification: true });
  }

  // The decisive fact. Holding a supplement is not the same as that supplement paying this cost
  // share, and only a verified answer to the second question produces a zero.
  const covers = supplement.verificationStatus === COVERAGE_VERIFICATION.VERIFIED
    ? supplement.coversAccessCostShare
    : COST_SHARE_COVERAGE.UNKNOWN;

  if (covers === COST_SHARE_COVERAGE.COVERED) {
    return result({
      ...base,
      supplementalCoverageVerified: true,
      supplementalExpectedPayment: gross,
      expectedPatientPayment: 0,
      verificationStatus: RESPONSIBILITY_STATUS.VERIFIED,
      explanationCode: EXPLANATION_CODES.SUPPLEMENTAL_COVERS_COST_SHARE,
      supplementalCarrierName: supplement.carrierName || null,
      supplementalPlanName: supplement.planName || null
    });
  }
  if (covers === COST_SHARE_COVERAGE.NOT_COVERED) {
    return result({ ...base, supplementalCoverageVerified: true, expectedPatientPayment: gross, verificationStatus: RESPONSIBILITY_STATUS.VERIFIED, explanationCode: EXPLANATION_CODES.NO_SUPPLEMENTAL_COVERAGE, supplementalCarrierName: supplement.carrierName || null });
  }
  // A supplement whose behaviour for this cost share is unknown never becomes a zero.
  return result({ ...base, expectedPatientPayment: null, verificationStatus: RESPONSIBILITY_STATUS.UNKNOWN, explanationCode: EXPLANATION_CODES.SUPPLEMENTAL_COVERAGE_UNKNOWN, requiresReverification: true, supplementalCarrierName: supplement.carrierName || null });
}
