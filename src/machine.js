const START = ["INVITATION", "DECISION_MAKER", "IDENTITY_VERIFICATION", "CARE_RECOMMENDATION", "HOW_CARE_WORKS"];
export function journeyFor(s) {
  const p = s.offer?.pathway;
  if (!p) return ["OFFER_LOADING"];
  if (p === "ACCESS") return [...START, "ACCESS_PRE_ELIGIBILITY_NOTICE", ...(s.offer.payer.mbiAvailable ? [] : ["ACCESS_MEDICARE_IDENTIFIER"]), "ACCESS_ELIGIBILITY_PROCESSING", "ACCESS_ELIGIBILITY_RESULT", "DISCLOSURE", "CONSENT_REVIEW", "ACCESS_ALIGNMENT_PROCESSING", "ENROLLMENT_CONFIRMED", "ACCESS_BASELINE", "ACCESS_MEASURE", "ONBOARDING_COMPLETE"];
  if (["RPM", "CCM_RPM", "PCM_RPM"].includes(p)) return [...START, "DISCLOSURE", "CONSENT_REVIEW", "ENROLLMENT_PROCESSING", "ENROLLMENT_CONFIRMED", "RPM_DEVICE_PATH", ...(s.devicePath === "ship" ? ["RPM_ADDRESS_CONFIRMATION"] : []), "RPM_DEVICE_SETUP", "RPM_FIRST_READING", "RPM_MONITORING_READY"];
  return [...START, "DISCLOSURE", "CONSENT_REVIEW", "ENROLLMENT_PROCESSING", "ENROLLMENT_CONFIRMED", "ONBOARDING", "CLINICAL_VERIFICATION", "GOALS", "ONBOARDING_COMPLETE"];
}
export function progressFor(s) {
  const j = journeyFor(s), index = Math.max(0, j.indexOf(s.screen));
  const setupStart = j.findIndex(x => ["ONBOARDING", "ACCESS_BASELINE", "RPM_DEVICE_PATH"].includes(x));
  const isSetup = setupStart > -1 && index >= setupStart;
  return isSetup ? { label: s.offer.pathway.includes("RPM") ? "Home monitoring setup" : "Care setup", current: index - setupStart + 1, total: j.length - setupStart } : { label: "Enrollment", current: index + 1, total: setupStart > -1 ? setupStart : j.length };
}
export const nextScreen = s => { const j = journeyFor(s); return j[Math.min(j.indexOf(s.screen) + 1, j.length - 1)]; };
export const previousScreen = s => { const j = journeyFor(s); return j[Math.max(0, j.indexOf(s.screen) - 1)]; };
