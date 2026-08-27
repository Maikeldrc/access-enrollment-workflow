const startFor = s => [
  "INVITATION",
  "DECISION_MAKER",
  ...(s.completionRole === "personalRepresentative" || s.role === "representative" ? ["PERSONAL_REPRESENTATIVE_DETAILS", "REPRESENTATIVE_MOBILE_VERIFICATION", "REPRESENTATIVE_AUTHORITY_ATTESTATION", ...(s.authorityAdditionalVerificationRequired ? ["REPRESENTATIVE_AUTHORITY_ESCALATION"] : [])] : []),
  "IDENTITY_VERIFICATION",
  "CARE_RECOMMENDATION"
];
const PROGRESS_STAGE_LABELS = {
  WHOS_COMPLETING: "Who’s completing",
  YOUR_ROLE: "Your role",
  CONFIRM_IDENTITY: "Confirm identity",
  MEDICARE_INFORMATION: "Medicare information",
  ELIGIBILITY: "Eligibility",
  YOUR_CARE: "Your care",
  IMPORTANT_INFORMATION: "Important information",
  CONSENT: "Consent",
  ENROLLING: "Enrolling",
  ENROLLMENT_COMPLETE: "Enrollment complete",
  GETTING_STARTED: "Getting started"
};
const PROGRESS_STAGE_BY_SCREEN = {
  OFFER_LOADING: "YOUR_CARE",
  INVITATION: "YOUR_CARE",
  DECISION_MAKER: "WHOS_COMPLETING",
  PERSONAL_REPRESENTATIVE_DETAILS: "YOUR_ROLE",
  CARE_CIRCLE_INVITE: "YOUR_ROLE",
  CARE_CIRCLE_INVITE_SENT: "YOUR_ROLE",
  CARE_CIRCLE_PERMISSIONS: "GETTING_STARTED",
  MY_CARE_CIRCLE: "GETTING_STARTED",
  CARE_CIRCLE_REMOVE_CONFIRMATION: "GETTING_STARTED",
  SHARE_ACCESS: "GETTING_STARTED",
  REPRESENTATIVE_MOBILE_VERIFICATION: "YOUR_ROLE",
  REPRESENTATIVE_AUTHORITY_ATTESTATION: "YOUR_ROLE",
  REPRESENTATIVE_AUTHORITY_ESCALATION: "YOUR_ROLE",
  IDENTITY_VERIFICATION: "CONFIRM_IDENTITY",
  CARE_RECOMMENDATION: "YOUR_CARE",
  HOW_CARE_WORKS: "YOUR_CARE",
  ACCESS_PRE_ELIGIBILITY_NOTICE: "ELIGIBILITY",
  ACCESS_MEDICARE_IDENTIFIER: "MEDICARE_INFORMATION",
  ACCESS_ELIGIBILITY_PROCESSING: "ELIGIBILITY",
  ACCESS_ELIGIBILITY_RESULT: "ELIGIBILITY",
  DISCLOSURE: "IMPORTANT_INFORMATION",
  CONSENT_REVIEW: "CONSENT",
  ENROLLMENT_PROCESSING: "ENROLLING",
  ACCESS_ALIGNMENT_PROCESSING: "ENROLLING",
  ENROLLMENT_CONFIRMED: "ENROLLMENT_COMPLETE",
  FLOW_DEFERRED: "ENROLLMENT_COMPLETE",
  MY_CARE: "YOUR_CARE",
  MY_GOALS: "YOUR_CARE",
  ONBOARDING: "GETTING_STARTED",
  CLINICAL_VERIFICATION: "GETTING_STARTED",
  MEDICATIONS_REVIEW: "GETTING_STARTED",
  CARE_PREFERENCES: "GETTING_STARTED",
  GOALS: "GETTING_STARTED",
  ACCESS_BASELINE: "GETTING_STARTED",
  ACCESS_MEASURE: "GETTING_STARTED",
  ACCESS_BP_DEVICE_VERIFICATION: "GETTING_STARTED",
  ACCESS_BP_DEVICE_RESULT: "GETTING_STARTED",
  ACCESS_BP_DEVICE_INFO: "GETTING_STARTED",
  ACCESS_BP_SHIPPING_ADDRESS: "GETTING_STARTED",
  ACCESS_BP_FULFILLMENT_CONFIRMED: "GETTING_STARTED",
  ACCESS_BP_GUIDED_SETUP: "GETTING_STARTED",
  ACCESS_BP_MEASUREMENT: "GETTING_STARTED",
  ACCESS_BP_BASELINE_RESULT: "GETTING_STARTED",
  ACCESS_BP_ESCALATION: "GETTING_STARTED",
  RPM_DEVICE_PATH: "GETTING_STARTED",
  RPM_ADDRESS_CONFIRMATION: "GETTING_STARTED",
  RPM_DEVICE_SETUP: "GETTING_STARTED",
  RPM_FIRST_READING: "GETTING_STARTED",
  RPM_MONITORING_READY: "GETTING_STARTED",
  ONBOARDING_COMPLETE: "GETTING_STARTED",
  CALLBACK_CONFIRMED: "YOUR_CARE",
  OUTCOME_STOPPED: "ELIGIBILITY",
  OFFER_INVALID: "IMPORTANT_INFORMATION",
  OFFER_EXPIRED: "IMPORTANT_INFORMATION"
};
export function journeyFor(s) {
  const p = s.offer?.pathway;
  if (!p) return ["OFFER_LOADING"];
  const start = startFor(s);
  if (p === "ACCESS") {
    const eligibility = [...start, "ACCESS_PRE_ELIGIBILITY_NOTICE", ...(s.offer.payer.mbiAvailable ? [] : ["ACCESS_MEDICARE_IDENTIFIER"]), "ACCESS_ELIGIBILITY_PROCESSING", "ACCESS_ELIGIBILITY_RESULT"];
    if (s.accessOutcome === "notEligible") return eligibility;
    const completedBpDestination = s.bpEscalationState?.status === "ACTIVE" ? ["ACCESS_BP_ESCALATION"] : s.bpBaselineStatus === "COMPLETED" ? ["ACCESS_BP_BASELINE_RESULT"] : [];
    const deviceResultAvailable = ["ASSIGNED", "PATIENT_CONFIRMED", "WAITING_FOR_READING", "SOURCE_VERIFIED", "FAILED", "DEVICE_MISMATCH", "SOURCE_MISMATCH", "NEEDS_REVIEW", "INACTIVE", "UNSUPPORTED"].includes(s.deviceVerificationStatus);
    const remainingCareSetup = ["ONBOARDING", "CLINICAL_VERIFICATION", "MEDICATIONS_REVIEW", "CARE_PREFERENCES", "GOALS"];
    const bpPath = s.bpDevicePath === "owned"
      ? ["ACCESS_BP_DEVICE_VERIFICATION", ...(deviceResultAvailable ? ["ACCESS_BP_DEVICE_RESULT"] : []), ...(["PATIENT_CONFIRMED", "WAITING_FOR_READING", "SOURCE_VERIFIED"].includes(s.deviceVerificationStatus) ? ["ACCESS_BP_GUIDED_SETUP", "ACCESS_BP_MEASUREMENT", ...completedBpDestination, ...remainingCareSetup] : [])]
      : s.bpDevicePath === "help"
        ? ["ACCESS_BP_GUIDED_SETUP", "ACCESS_BP_MEASUREMENT", ...completedBpDestination, ...remainingCareSetup]
        : s.bpDevicePath === "needed"
          ? ["ACCESS_BP_DEVICE_INFO", "ACCESS_BP_SHIPPING_ADDRESS", "ACCESS_BP_FULFILLMENT_CONFIRMED", ...remainingCareSetup]
          : [];
    return [...eligibility, "CONSENT_REVIEW", "ACCESS_ALIGNMENT_PROCESSING", "ENROLLMENT_CONFIRMED", "ACCESS_BASELINE", "ACCESS_MEASURE", ...bpPath, "ONBOARDING_COMPLETE"];
  }
  const traditionalStart = [...start, "HOW_CARE_WORKS"];
  if (["RPM", "CCM_RPM", "PCM_RPM"].includes(p)) return [...traditionalStart, "DISCLOSURE", "CONSENT_REVIEW", "ENROLLMENT_PROCESSING", "ENROLLMENT_CONFIRMED", "RPM_DEVICE_PATH", ...(s.devicePath === "ship" ? ["RPM_ADDRESS_CONFIRMATION"] : []), "RPM_DEVICE_SETUP", "RPM_FIRST_READING", "RPM_MONITORING_READY"];
  return [...traditionalStart, "DISCLOSURE", "CONSENT_REVIEW", "ENROLLMENT_PROCESSING", "ENROLLMENT_CONFIRMED", "ONBOARDING", "CLINICAL_VERIFICATION", "MEDICATIONS_REVIEW", "CARE_PREFERENCES", "GOALS", "ONBOARDING_COMPLETE"];
}
export function progressFor(s) {
  const journey = journeyFor(s);
  if (s.screen === "ENROLLMENT_CONFIRMED") {
    const stage = PROGRESS_STAGE_BY_SCREEN[s.screen];
    return { stage, label: PROGRESS_STAGE_LABELS[stage], current: 1, total: 1, percent: 100 };
  }
  const careStartIndex = journey.indexOf("ACCESS_BASELINE");
  const accessCareSetup = careStartIndex >= 0 ? journey.slice(careStartIndex) : [];
  if (s.offer?.pathway === "ACCESS" && accessCareSetup.includes(s.screen)) {
    const current = accessCareSetup.indexOf(s.screen) + 1;
    const total = accessCareSetup.length;
    const stage = PROGRESS_STAGE_BY_SCREEN[s.screen];
    return { stage, label: PROGRESS_STAGE_LABELS[stage], current, total, percent: current / total * 100 };
  }
  const progressAnchor = { CALLBACK_CONFIRMED: "ACCESS_ELIGIBILITY_RESULT", OUTCOME_STOPPED: "ACCESS_ELIGIBILITY_RESULT" }[s.screen];
  const fallbackScreen = journey.includes(s.returnScreen) ? s.returnScreen : journey.includes(progressAnchor) ? progressAnchor : journey[0];
  const resolvedScreen = journey.includes(s.screen) ? s.screen : fallbackScreen;
  const index = Math.max(0, journey.indexOf(resolvedScreen));
  const total = Math.max(1, journey.length);
  const current = Math.min(total, index + 1);
  const stage = PROGRESS_STAGE_BY_SCREEN[s.screen] || PROGRESS_STAGE_BY_SCREEN[resolvedScreen] || "YOUR_CARE";
  return { stage, label: PROGRESS_STAGE_LABELS[stage], current, total, percent: current / total * 100 };
}
export const nextScreen = s => { const j = journeyFor(s); return j[Math.min(j.indexOf(s.screen) + 1, j.length - 1)]; };
export const previousScreen = s => { const j = journeyFor(s); return j[Math.max(0, j.indexOf(s.screen) - 1)]; };
