import { COST_SHARE_COVERAGE, COVERAGE_VERIFICATION, MEDICARE_COVERAGE_TYPES, SECONDARY_COVERAGE_TYPES, normalizeCoverage } from "../coverage.js";
import { SECONDARY_COVERAGE_STATUSES } from "../config.js";

// Demo coverage fixtures. These describe WHAT A PATIENT HAS; the knowledge base describes HOW
// coverage works. Neither is allowed to do the other's job, which is why no patient's Medicare
// status or carrier name is written as prose into a knowledge file.
//
// Verification timestamps are relative so the fresh scenarios stay fresh and the stale one stays
// stale however long after the fixtures were written the demo is run.
const daysAgo = days => new Date(Date.now() - days * 86400000).toISOString();

const originalMedicare = (verificationStatus = COVERAGE_VERIFICATION.VERIFIED) => ({
  type: MEDICARE_COVERAGE_TYPES.ORIGINAL_MEDICARE,
  partAActive: true,
  partBActive: true,
  verificationStatus
});

export const EMMI_DEMO_COVERAGE = Object.freeze({
  // DEMO-A: the primary demo patient. Original Medicare plus a verified Medicare Supplement that
  // is separately verified to cover the ACCESS beneficiary cost share, so the expected payment
  // resolves to $0 for a stated reason rather than because ACCESS is "free".
  "DEMO-P001": {
    medicare: originalMedicare(),
    secondaryPayers: [{
      type: SECONDARY_COVERAGE_TYPES.MEDICARE_SUPPLEMENT,
      carrierName: "Demo Mutual Supplement",
      planName: "Demo Medigap Plan G",
      active: true,
      verificationStatus: COVERAGE_VERIFICATION.VERIFIED,
      coversAccessCostShare: COST_SHARE_COVERAGE.COVERED
    }],
    verifiedAt: daysAgo(2),
    verificationSource: "DEMO_ELIGIBILITY_FIXTURE"
  },
  // DEMO-C: a real secondary payer exists, but whether it pays this cost share was never
  // established. This must not resolve to $0.
  "DEMO-P002": {
    medicare: originalMedicare(),
    secondaryPayers: [{
      type: SECONDARY_COVERAGE_TYPES.MEDICARE_SUPPLEMENT,
      carrierName: "Demo Mutual Supplement",
      active: true,
      verificationStatus: COVERAGE_VERIFICATION.VERIFIED,
      coversAccessCostShare: COST_SHARE_COVERAGE.UNKNOWN
    }],
    verifiedAt: daysAgo(3),
    verificationSource: "DEMO_ELIGIBILITY_FIXTURE"
  },
  // DEMO-B: Original Medicare and nothing behind it, so the patient pays the track amount.
  "DEMO-P003": { medicare: originalMedicare(), secondaryPayers: [], verifiedAt: daysAgo(1), verificationSource: "DEMO_ELIGIBILITY_FIXTURE" },
  // DEMO-D: Medicare Advantage. A pricing answer is the wrong answer here; eligibility decides.
  "DEMO-P004": {
    medicare: { type: MEDICARE_COVERAGE_TYPES.MEDICARE_ADVANTAGE, partAActive: true, partBActive: true, verificationStatus: COVERAGE_VERIFICATION.VERIFIED },
    secondaryPayers: [],
    verifiedAt: daysAgo(1),
    verificationSource: "DEMO_ELIGIBILITY_FIXTURE"
  },
  // DEMO-E: a supplement that looked good months ago. Age alone must stop the $0.
  "DEMO-P005": {
    medicare: originalMedicare(),
    secondaryPayers: [{
      type: SECONDARY_COVERAGE_TYPES.MEDICARE_SUPPLEMENT,
      carrierName: "Demo Mutual Supplement",
      active: true,
      verificationStatus: COVERAGE_VERIFICATION.VERIFIED,
      coversAccessCostShare: COST_SHARE_COVERAGE.COVERED
    }],
    verifiedAt: daysAgo(240),
    verificationSource: "DEMO_ELIGIBILITY_FIXTURE"
  },
  // DEMO-F: Qualified Medicare Beneficiary. Its own rules, never described as commercial Medigap.
  "DEMO-P006": {
    medicare: originalMedicare(),
    secondaryPayers: [{ type: SECONDARY_COVERAGE_TYPES.QMB, carrierName: "State Medicaid Agency (demo)", active: true, verificationStatus: COVERAGE_VERIFICATION.VERIFIED, coversAccessCostShare: COST_SHARE_COVERAGE.UNKNOWN }],
    verifiedAt: daysAgo(4),
    verificationSource: "DEMO_ELIGIBILITY_FIXTURE"
  }
});

export const emmiDemoCoverage = patientId => EMMI_DEMO_COVERAGE[patientId] || null;

// The cost card and EMMI must never quote different amounts for the same patient. The card reads
// this legacy three-state flag while EMMI reads the coverage record, so the flag is derived from
// that record instead of being written out by hand beside it, where the two could drift apart —
// and did: DEMO-P001 was verified-and-covering for EMMI and NOT_VERIFIED for the card.
// Returns the canonical SECONDARY_COVERAGE_STATUSES value. The fixtures previously used short
// keys ("VERIFIED") that the cost resolver never recognised, so every patient silently fell
// through to the unverified branch and was shown the full amount whatever their coverage said.
export function emmiDemoSecondaryCoverageStatus(patientId) {
  const normalized = normalizeCoverage(emmiDemoCoverage(patientId) || {});
  const supplement = normalized.supplemental;
  if (!supplement || !supplement.active || supplement.verificationStatus !== COVERAGE_VERIFICATION.VERIFIED) return SECONDARY_COVERAGE_STATUSES.NOT_VERIFIED;
  if (supplement.coversAccessCostShare === COST_SHARE_COVERAGE.COVERED) return SECONDARY_COVERAGE_STATUSES.VERIFIED;
  // A policy that exists but whose behaviour for this cost is unproven is "present, not confirmed",
  // never "verified": that is the difference between "up to $6" and "$0".
  return SECONDARY_COVERAGE_STATUSES.PRESENT_NOT_CONFIRMED;
}

export const EMMI_DEMO_PATIENTS = ({
  "DEMO-P001": { patientId: "DEMO-P001", firstName: "Robert", lastName: "Demo", dob: "1948-04-10", zip: "33101", phone: "305-555-0101", locale: "EN", program: "ACCESS", accessTrack: "eCKM", condition: "Hypertension", enrollmentSource: "ITERA_DIRECT_OUTREACH", completionRole: "PATIENT", careCircle: { status: "NONE" }, eligibilityStatus: "ELIGIBLE", enrollmentStatus: "IN_PROGRESS", assignedDeviceId: "TEN-DEMO-10001", deviceVendor: "TENOVI", deviceStatus: "ACTIVE", integrationStatus: "CONNECTED", bpBaselineStatus: "NOT_STARTED" },
  "DEMO-P002": { patientId: "DEMO-P002", firstName: "Maria", lastName: "Demo", dob: "1953-11-22", zip: "33176", phone: "305-555-0102", locale: "ES", program: "ACCESS", accessTrack: "eCKM", condition: "Hypertension", enrollmentSource: "PROVIDER_PRACTICE_REFERRAL", physicianDisplayName: "Dr. Alejandro Rivera", completionRole: "PATIENT", careCircle: { status: "INVITED", supportPerson: { name: "Angela Demo", relationship: "Child", phone: "305-555-0199" } }, eligibilityStatus: "ELIGIBLE", enrollmentStatus: "IN_PROGRESS", assignedDeviceId: null, deviceStatus: "NOT_ASSIGNED", integrationStatus: "NOT_CONNECTED", bpBaselineStatus: "PENDING_DEVICE" },
  "DEMO-P003": { patientId: "DEMO-P003", firstName: "Helen", lastName: "Demo", dob: "1945-01-18", zip: "33010", phone: "305-555-0103", locale: "EN", program: "ACCESS", accessTrack: "eCKM", condition: "Hypertension", enrollmentSource: "PROVIDER_PRACTICE_REFERRAL", physicianDisplayName: "Dr. Sofia Martin", completionRole: "PERSONAL_REPRESENTATIVE", representative: { fullName: "Angela Sample", relationship: "Child", authorityType: "Health care power of attorney", phone: "305-555-0199", phoneVerified: true, authorityAttested: false }, careCircle: { status: "ACTIVE", supportPerson: { name: "Robert Demo", relationship: "Spouse" } }, eligibilityStatus: "ELIGIBLE", enrollmentStatus: "IN_PROGRESS", assignedDeviceId: "PYLO-DEMO-20001", deviceVendor: "PYLO", deviceStatus: "ACTIVE", integrationStatus: "CONNECTED", bpBaselineStatus: "NOT_STARTED" },
  "DEMO-P004": { patientId: "DEMO-P004", firstName: "Samuel", lastName: "Demo", locale: "EN", program: "ACCESS", accessTrack: "eCKM", condition: "Hypertension", enrollmentSource: "ITERA_DIRECT_OUTREACH", completionRole: "PATIENT", eligibilityStatus: "NOT_ELIGIBLE", eligibilityReason: "DEMO_COMPARISON_GROUP", enrollmentStatus: "STOPPED", assignedDeviceId: null, deviceStatus: "NOT_ASSIGNED", integrationStatus: "NOT_CONNECTED", bpBaselineStatus: "NOT_STARTED" },
  "DEMO-P005": { patientId: "DEMO-P005", firstName: "Jean", lastName: "Demo", locale: "KR", program: "ACCESS", accessTrack: "CKM", condition: "Chronic Kidney Disease", enrollmentSource: "ITERA_DIRECT_OUTREACH", completionRole: "PATIENT", eligibilityStatus: "ELIGIBLE", enrollmentStatus: "IN_PROGRESS", assignedDeviceId: null, deviceStatus: "NOT_ASSIGNED", integrationStatus: "NOT_CONNECTED", bpBaselineStatus: "NOT_STARTED" },
  "DEMO-P006": { patientId: "DEMO-P006", firstName: "Thomas", lastName: "Demo", locale: "EN", program: "ACCESS", accessTrack: "eCKM", condition: "Hypertension", enrollmentSource: "ITERA_DIRECT_OUTREACH", completionRole: "PATIENT", eligibilityStatus: "ELIGIBLE", enrollmentStatus: "COMPLETED", assignedDeviceId: null, deviceSource: "PATIENT_OWNED", deviceVendor: "OTHER", deviceStatus: "ACTIVE", integrationStatus: "UNSUPPORTED", bpBaselineStatus: "DEVICE_VERIFICATION" }
});

// Applied after the table is defined so each patient carries exactly one coverage truth.
for (const [patientId, patient] of Object.entries(EMMI_DEMO_PATIENTS)) {
  patient.secondaryCoverageStatus = emmiDemoSecondaryCoverageStatus(patientId);
}

export const EMMI_DEMO_ACCESS_SHARE = Object.freeze({ shareId: "ACCESS-SHARE-DEMO01", channel: "SMS", source: "ENROLLED_PATIENT", clicked: true, landingStarted: true, eligibilityStarted: false, enrollmentStarted: false, enrollmentCompleted: false });

export const EMMI_DEMO_DEVICES = Object.freeze([
  { deviceId: "TEN-DEMO-10001", vendor: "TENOVI", model: "Demo Tenovi BP", status: "ACTIVE", integrationStatus: "CONNECTED", lastTransmissionAt: "2026-08-25T14:22:00Z" },
  { deviceId: "PYLO-DEMO-20001", vendor: "PYLO", model: "Demo Pylo 802-LTE", status: "ACTIVE", integrationStatus: "CONNECTED", lastTransmissionAt: "2026-08-25T15:03:00Z" },
  { deviceId: "TEN-DEMO-10002", vendor: "TENOVI", model: "Demo Tenovi BP", status: "INACTIVE", integrationStatus: "DISCONNECTED", lastTransmissionAt: null }
]);

export const EMMI_ACCESS_DISCLOSURES = Object.freeze({
  EN: { voluntary: "Joining ACCESS is voluntary.", medicare: "Your Medicare benefits, coverage, and rights stay the same.", provider: "You may have one ACCESS provider for this type of care at a time." },
  ES: { voluntary: "Inscribirse en ACCESS es voluntario.", medicare: "Sus beneficios, cobertura y derechos de Medicare permanecen iguales.", provider: "Puede tener un proveedor ACCESS para este tipo de cuidado a la vez." },
  KR: { voluntary: "Enskri nan ACCESS se yon chwa volontè.", medicare: "Benefis, kouvèti ak dwa Medicare ou rete menm jan an.", provider: "Ou ka gen yon sèl founisè ACCESS pou kalite swen sa a alafwa." }
});
