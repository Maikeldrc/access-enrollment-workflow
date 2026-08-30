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
  MY_CARE_TEAM: "YOUR_CARE",
  MY_GOALS: "YOUR_CARE",
  MY_MEDICATIONS: "YOUR_CARE",
  MY_APPOINTMENTS: "YOUR_CARE",
  APPOINTMENT_DETAIL: "YOUR_CARE",
  APPOINTMENT_SCHEDULING: "YOUR_CARE",
  ONBOARDING: "GETTING_STARTED",
  CLINICAL_VERIFICATION: "GETTING_STARTED",
  MEDICATIONS_REVIEW: "GETTING_STARTED",
  CARE_PREFERENCES: "GETTING_STARTED",
  GOALS: "GETTING_STARTED",
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
// The patient experiences care activation as four things, not as fourteen screens: the monitor
// being arranged, the goals they were assigned, the personalizing, and the plan that results.
// Every activation screen belongs to exactly one of them, in this order.
const CARE_ACTIVATION_STAGE_BY_SCREEN = {
  ACCESS_BP_DEVICE_INFO: "DEVICE", ACCESS_BP_SHIPPING_ADDRESS: "DEVICE", ACCESS_BP_FULFILLMENT_CONFIRMED: "DEVICE",
  ACCESS_BP_DEVICE_VERIFICATION: "DEVICE", ACCESS_BP_DEVICE_RESULT: "DEVICE", ACCESS_BP_GUIDED_SETUP: "DEVICE",
  ACCESS_BP_MEASUREMENT: "DEVICE", ACCESS_BP_BASELINE_RESULT: "DEVICE", ACCESS_BP_ESCALATION: "DEVICE",
  GOALS: "GOALS",
  CLINICAL_VERIFICATION: "PERSONALIZE", MEDICATIONS_REVIEW: "PERSONALIZE", CARE_PREFERENCES: "PERSONALIZE",
  ONBOARDING_COMPLETE: "CARE_PLAN"
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
    // Care activation, not a health check. The patient is first shown the care they already have —
    // the monitor being arranged, then the goals the track assigned them — and only afterwards asked
    // for what is still missing to personalize it. Goals moved ahead of the personalization screens
    // for that reason: a patient who has seen their goals understands what the questions are for.
    const remainingCareSetup = ["GOALS", "CLINICAL_VERIFICATION", "MEDICATIONS_REVIEW", "CARE_PREFERENCES"];
    // The patient is never asked whether they own a monitor. Their record already says, and the
    // default is the canonical patient's situation: no connected monitor yet.
    const devicePath = s.bpDevicePath || "needed";
    const bpPath = devicePath === "owned"
      ? ["ACCESS_BP_DEVICE_VERIFICATION", ...(deviceResultAvailable ? ["ACCESS_BP_DEVICE_RESULT"] : []), ...(["PATIENT_CONFIRMED", "WAITING_FOR_READING", "SOURCE_VERIFIED"].includes(s.deviceVerificationStatus) ? ["ACCESS_BP_GUIDED_SETUP", "ACCESS_BP_MEASUREMENT", ...completedBpDestination, ...remainingCareSetup] : [])]
      : devicePath === "help"
        ? ["ACCESS_BP_GUIDED_SETUP", "ACCESS_BP_MEASUREMENT", ...completedBpDestination, ...remainingCareSetup]
        : ["ACCESS_BP_DEVICE_INFO", "ACCESS_BP_SHIPPING_ADDRESS", "ACCESS_BP_FULFILLMENT_CONFIRMED", ...remainingCareSetup];
    return [...eligibility, "CONSENT_REVIEW", "ACCESS_ALIGNMENT_PROCESSING", "ENROLLMENT_CONFIRMED", ...bpPath, "ONBOARDING_COMPLETE"];
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
  // Care activation begins the moment enrollment is confirmed, so progress through it is counted
  // from the first activation screen rather than from a health check that no longer exists.
  const careStartIndex = journey.indexOf("ENROLLMENT_CONFIRMED") + 1;
  const accessCareSetup = careStartIndex > 0 ? journey.slice(careStartIndex) : [];
  if (s.offer?.pathway === "ACCESS" && accessCareSetup.includes(s.screen)) {
    // Counted in stages, not screens. Arranging a monitor takes three taps and personalizing takes
    // three more, but the patient is doing two things, not six: a per-screen counter would make the
    // bar crawl and turn "how much is left" into a number that means nothing to them.
    const stagesInJourney = [...new Set(accessCareSetup.map(screen => CARE_ACTIVATION_STAGE_BY_SCREEN[screen]).filter(Boolean))];
    const current = Math.max(1, stagesInJourney.indexOf(CARE_ACTIVATION_STAGE_BY_SCREEN[s.screen]) + 1);
    const total = Math.max(1, stagesInJourney.length);
    const stage = PROGRESS_STAGE_BY_SCREEN[s.screen];
    return { stage, careActivationStage: CARE_ACTIVATION_STAGE_BY_SCREEN[s.screen] || null, label: PROGRESS_STAGE_LABELS[stage], current, total, percent: current / total * 100 };
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
