// Structured coverage model.
//
// Eligibility sources describe coverage as loose text ("Active (Part B)", "Other or Additional
// Payer"). EMMI must never be the thing that interprets that: a language model reading raw payer
// text would happily conclude a liability policy is a Medigap plan. Everything patient-specific
// about coverage is normalized here, deterministically, and only the normalized shape is allowed
// to reach the assistant or the cost engine.

export const MEDICARE_COVERAGE_TYPES = Object.freeze({
  ORIGINAL_MEDICARE: "ORIGINAL_MEDICARE",
  MEDICARE_ADVANTAGE: "MEDICARE_ADVANTAGE",
  UNKNOWN: "UNKNOWN"
});

// A secondary payer is not automatically a Medicare Supplement. Only a payer that is actually
// classified as one may be described to the patient as Medigap.
export const SECONDARY_COVERAGE_TYPES = Object.freeze({
  MEDICARE_SUPPLEMENT: "MEDICARE_SUPPLEMENT",
  MEDICAID: "MEDICAID",
  QMB: "QMB",
  EMPLOYER_RETIREE: "EMPLOYER_RETIREE",
  OTHER_PAYER: "OTHER_PAYER"
});

export const COVERAGE_VERIFICATION = Object.freeze({
  VERIFIED: "VERIFIED",
  NOT_VERIFIED: "NOT_VERIFIED",
  STALE: "STALE",
  UNKNOWN: "UNKNOWN"
});

// Whether a secondary policy pays the ACCESS beneficiary cost share is its own verified fact,
// separate from whether the policy exists at all.
export const COST_SHARE_COVERAGE = Object.freeze({
  COVERED: "COVERED",
  NOT_COVERED: "NOT_COVERED",
  UNKNOWN: "UNKNOWN"
});

// Coverage confirmed months ago is not coverage confirmed today. Anything older than this is
// reported as stale so the caller re-verifies before making a firm statement about cost.
export const COVERAGE_FRESHNESS_DAYS = 30;

const asDate = value => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

export function coverageAgeInDays(verifiedAt, now = new Date()) {
  const verified = asDate(verifiedAt);
  return verified ? Math.floor((now - verified) / 86400000) : null;
}

export function coverageIsFresh(verifiedAt, now = new Date(), maxAgeDays = COVERAGE_FRESHNESS_DAYS) {
  const age = coverageAgeInDays(verifiedAt, now);
  return age !== null && age >= 0 && age <= maxAgeDays;
}

const normalizeMedicare = (medicare = {}) => {
  const declared = medicare.type;
  const type = Object.prototype.hasOwnProperty.call(MEDICARE_COVERAGE_TYPES, declared)
    ? declared
    : MEDICARE_COVERAGE_TYPES.UNKNOWN;
  return {
    // Part A and Part B being active does not by itself mean Original Medicare: a Medicare
    // Advantage member also has both. The payer's own classification decides.
    type,
    partAActive: Boolean(medicare.partAActive),
    partBActive: Boolean(medicare.partBActive),
    isOriginalMedicare: type === MEDICARE_COVERAGE_TYPES.ORIGINAL_MEDICARE,
    isMedicareAdvantage: type === MEDICARE_COVERAGE_TYPES.MEDICARE_ADVANTAGE,
    verificationStatus: Object.prototype.hasOwnProperty.call(COVERAGE_VERIFICATION, medicare.verificationStatus)
      ? medicare.verificationStatus
      : COVERAGE_VERIFICATION.NOT_VERIFIED
  };
};

const normalizeSecondary = (payer = {}) => ({
  type: Object.prototype.hasOwnProperty.call(SECONDARY_COVERAGE_TYPES, payer.type)
    ? payer.type
    : SECONDARY_COVERAGE_TYPES.OTHER_PAYER,
  carrierName: payer.carrierName || "",
  planName: payer.planName || "",
  active: Boolean(payer.active),
  verificationStatus: Object.prototype.hasOwnProperty.call(COVERAGE_VERIFICATION, payer.verificationStatus)
    ? payer.verificationStatus
    : COVERAGE_VERIFICATION.NOT_VERIFIED,
  coversAccessCostShare: Object.prototype.hasOwnProperty.call(COST_SHARE_COVERAGE, payer.coversAccessCostShare)
    ? payer.coversAccessCostShare
    : COST_SHARE_COVERAGE.UNKNOWN
});

export function normalizeCoverage(raw = {}, now = new Date()) {
  const medicare = normalizeMedicare(raw.medicare);
  const secondaryPayers = (raw.secondaryPayers || []).map(normalizeSecondary);
  const fresh = coverageIsFresh(raw.verifiedAt, now);
  // Verification that has aged out is reported as stale rather than quietly trusted.
  const applyFreshness = status =>
    (status === COVERAGE_VERIFICATION.VERIFIED && !fresh ? COVERAGE_VERIFICATION.STALE : status);
  return {
    medicare: { ...medicare, verificationStatus: applyFreshness(medicare.verificationStatus) },
    secondaryPayers: secondaryPayers.map(payer => ({ ...payer, verificationStatus: applyFreshness(payer.verificationStatus) })),
    // Only a payer actually classified as a Medicare Supplement may be called supplemental
    // insurance to the patient.
    supplemental: secondaryPayers.find(payer => payer.type === SECONDARY_COVERAGE_TYPES.MEDICARE_SUPPLEMENT)
      ? { ...secondaryPayers.find(payer => payer.type === SECONDARY_COVERAGE_TYPES.MEDICARE_SUPPLEMENT), verificationStatus: applyFreshness(secondaryPayers.find(payer => payer.type === SECONDARY_COVERAGE_TYPES.MEDICARE_SUPPLEMENT).verificationStatus) }
      : null,
    qmb: secondaryPayers.some(payer => payer.type === SECONDARY_COVERAGE_TYPES.QMB),
    verifiedAt: raw.verifiedAt || null,
    verificationSource: raw.verificationSource || "DEMO_FIXTURE",
    coverageIsFresh: fresh,
    ageInDays: coverageAgeInDays(raw.verifiedAt, now)
  };
}
