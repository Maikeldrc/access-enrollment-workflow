export const SCENARIOS = {
  "ccm-happy": { label: "CCM · happy path", pathway: "CCM" },
  "rpm-shipping": { label: "RPM · device shipping", pathway: "RPM", rpmDevice: "ship" },
  "rpm-owned": { label: "RPM · patient-owned device", pathway: "RPM", rpmDevice: "owned" },
  "rpm-transmission-fail": { label: "RPM · transmission support", pathway: "RPM", rpmDevice: "owned", firstReading: "failed" },
  "access-happy": { label: "ACCESS · eligible", pathway: "ACCESS", accessOutcome: "eligible" },
  "access-bp-incompatible": { label: "ACCESS · incompatible BP monitor", pathway: "ACCESS", accessOutcome: "eligible", bpDeviceCompatibility: "incompatible" },
  "access-bp-reading-failure": { label: "ACCESS · BP transmission retry", pathway: "ACCESS", accessOutcome: "eligible", bpReadingFailureAt: 2 },
  "access-bp-escalation": { label: "ACCESS · BP clinical escalation", pathway: "ACCESS", accessOutcome: "eligible", bpClinicalReview: "escalation" },
  "access-disclosure-configured": { label: "ACCESS · configured disclosures", pathway: "ACCESS", accessOutcome: "eligible", accessCostSharingType: "COST_SHARING_APPLIES", accessCostSharingAmount: "$35", showAccessClaimsSharing: true, showAccessTempoDisclosure: true, accessTempoDisclosureText: "A connected device may be used to support your ACCESS care. Your care team will explain what is required." },
  "access-control": { label: "ACCESS · control group", pathway: "ACCESS", accessOutcome: "control" },
  "access-not-eligible": { label: "ACCESS · not eligible", pathway: "ACCESS", accessOutcome: "notEligible" },
  "access-already-aligned": { label: "ACCESS · already aligned", pathway: "ACCESS", accessOutcome: "alreadyAligned" },
  "access-api-unavailable": { label: "ACCESS · Medicare unavailable", pathway: "ACCESS", accessOutcome: "unavailable" },
  "access-check-failure": { label: "ACCESS · temporary check error", pathway: "ACCESS", accessOutcome: "eligible", eligibilityFailure: true },
  "access-missing-mbi": { label: "ACCESS · missing Medicare ID", pathway: "ACCESS", accessOutcome: "eligible", missingMbi: true },
  "access-representative": { label: "ACCESS · personal representative", pathway: "ACCESS", accessOutcome: "eligible", representative: true },
  "identity-failure": { label: "Identity · mismatch", pathway: "CCM", identityFailure: true },
  "representative": { label: "Personal representative", pathway: "CCM", representative: true },
  "link-expired": { label: "Link · expired", pathway: "CCM", tokenState: "expired" },
  "link-invalid": { label: "Link · invalid", pathway: "CCM", tokenState: "invalid" }
};

const shared = {
  id: "offer_demo_2026",
  patient: { id: "patient_demo", displayName: "John S.", zipCodeMasked: "••176", phoneMasked: "(***) ***-4567", language: "en", shippingAddress: { line1: "123 Oak Avenue", unit: "Apt 4B", city: "Miami", state: "FL", zip: "33176" } },
  referringProvider: { id: "dr-fresner", name: "Dr. Fresner", specialty: "Primary Care", practiceName: "Fresner Medical Group", verifiedPhotoUrl: "/assets/doctor-portrait-v2.png" },
  participantProvider: { id: "itera", legalName: "ITERA HEALTH LLC", displayName: "ITERA HEALTH", supportPhone: "(305) 394-8070" },
  qualifyingCondition: { patientFriendlyName: "high blood pressure" },
  payer: { type: "OriginalMedicare", mbiAvailable: true, mbiConfidence: "trusted" },
  disclosures: { bundleId: "itera-disclosure-2026-08", version: "2.1" },
  consent: { bundleId: "itera-consent-2026-08", version: "2.1", required: true }
};

const pathways = {
  CCM: {
    invitation: "recommended ongoing support",
    support: "ITERA HEALTH provides this care in coordination with {physicianDisplayName}.",
    capabilities: [["calendar", "Ongoing support between visits", "Regular support based on your health needs."], ["heart", "A personalized care plan", "Goals and next steps for your health."], ["pill", "Medication support", "Help keeping treatment on track."], ["people", "Care coordination", "ITERA works with your care team to coordinate your care."]],
    services: ["Ongoing care support (CCM)"],
    cost: "Medicare cost-sharing may apply. Your care team can help you understand your coverage.",
    stopRules: ["Participation is voluntary", "You may stop this service at any time", "Only one practitioner can provide and bill for CCM in the same month"],
    modules: ["health", "medications", "goals"]
  },
  RPM: {
    invitation: "recommended monitoring from home",
    support: "ITERA HEALTH provides connected home monitoring in coordination with {physicianDisplayName}.",
    capabilities: [["heart", "Home health monitoring", "A connected monitor securely shares your readings."], ["chart", "Reading review", "Your care team checks for important changes."], ["phone", "Support when readings need attention", "Get help when a reading needs follow-up."], ["doctor", "Connected care team", "ITERA works with your care team to coordinate your care."]],
    services: ["Home monitoring (RPM)"],
    cost: "Medicare cost-sharing may apply for home monitoring services.",
    stopRules: ["Participation is voluntary", "You may stop monitoring at any time", "This service is not for emergencies"],
    modules: ["device", "setup", "reading"]
  },
  ASM: {
    invitation: "recommended advanced specialty support",
    support: "ITERA HEALTH coordinates ongoing specialty support with your physician and care team.",
    capabilities: [["doctor", "Specialty care coordination", "Support aligned with your specialist’s treatment plan"], ["calendar", "Support between visits", "Regular follow-up based on your care needs"], ["pill", "Treatment plan support", "Help staying on track with medications and next steps"], ["people", "Connected care team", "Important updates are shared with your doctors"]],
    services: ["Advanced specialty management (ASM)"],
    cost: "Medicare cost-sharing may apply. Your care team can help you understand your coverage.",
    stopRules: ["Participation is voluntary", "You may stop this service at any time", "Your regular Medicare benefits do not change"],
    modules: ["health", "medications", "goals"]
  },
  APCM: {
    invitation: "recommended advanced primary care support",
    support: "ITERA HEALTH coordinates comprehensive primary care support with your physician and care team.",
    capabilities: [["people", "Comprehensive care coordination", "Your care team helps connect your health needs"], ["calendar", "Ongoing support", "Regular check-ins between office visits"], ["pill", "Treatment plan support", "Help staying on track with medications and goals"], ["doctor", "Your doctor stays involved", "Important updates are coordinated with your physician"]],
    services: ["Advanced primary care management (APCM)"],
    cost: "Medicare cost-sharing may apply. Your care team can help you understand your coverage.",
    stopRules: ["Participation is voluntary", "You may stop this service at any time", "Your regular Medicare benefits do not change"],
    modules: ["health", "medications", "goals"]
  },
  ACCESS: {
    invitation: "recommended added support",
    support: "ITERA HEALTH provides this care in coordination with {physicianDisplayName}.",
    capabilities: [["calendar", "Regular health check-ins", "Regular support based on your health needs."], ["heart", "A personalized care plan", "Goals and next steps for your health."], ["pill", "Medication support", "Help keeping treatment on track."], ["people", "Connected care team", "ITERA works with your care team to coordinate your care."]],
    services: ["ACCESS care for high blood pressure"],
    cost: "Your regular Medicare benefits and cost-sharing continue to apply to covered care.",
    stopRules: ["Joining is voluntary", "Your Medicare benefits do not change", "You may stop participating at any time"],
    modules: ["baseline", "measure", "goals"]
  },
  PCM: {
    invitation: "recommended condition-focused support",
    support: "ITERA HEALTH provides focused support for the condition that matters most right now.",
    capabilities: [["heart", "Focused support for your main condition", "Regular support based on your health needs."], ["calendar", "A personalized care plan", "Goals and next steps for your health."], ["pill", "Medication support", "Help keeping treatment on track."], ["doctor", "Care coordination", "ITERA works with your care team to coordinate your care."]],
    services: ["Condition-focused care (PCM)"],
    cost: "Medicare cost-sharing may apply. Your care team can help you understand your coverage.",
    stopRules: ["Participation is voluntary", "You may stop this service at any time", "Your regular Medicare benefits do not change"],
    modules: ["health", "medications", "goals"]
  },
  CCM_RPM: {
    invitation: "recommended ongoing care and home monitoring",
    support: "One coordinated experience combines ongoing care support with monitoring from home.",
    capabilities: [["calendar", "Ongoing support between visits", "Regular support based on your health needs."], ["heart", "Home health monitoring", "Connected readings help your care team follow changes."], ["pill", "Medication support", "Help keeping treatment on track."], ["doctor", "Connected care team", "ITERA works with your care team to coordinate your care."]],
    services: ["Ongoing care support (CCM)", "Home monitoring (RPM)"],
    cost: "Medicare cost-sharing may apply for ongoing care and home monitoring services.",
    stopRules: ["Participation is voluntary", "You may stop these services at any time", "Home monitoring is not for emergencies"],
    modules: ["health", "device", "reading", "goals"]
  },
  PCM_RPM: {
    invitation: "recommended focused care and home monitoring",
    support: "One coordinated experience combines condition-focused care with monitoring from home.",
    capabilities: [["heart", "Focused support for your main condition", "Regular support based on your health needs."], ["chart", "Home health monitoring", "Connected readings help your care team follow changes."], ["pill", "Medication support", "Help keeping treatment on track."], ["doctor", "Connected care team", "ITERA works with your care team to coordinate your care."]],
    services: ["Condition-focused care (PCM)", "Home monitoring (RPM)"],
    cost: "Medicare cost-sharing may apply for condition-focused care and home monitoring services.",
    stopRules: ["Participation is voluntary", "You may stop these services at any time", "Home monitoring is not for emergencies"],
    modules: ["health", "device", "reading", "goals"]
  }
};

export const PROTOTYPE_OPTIONS = {
  programs: ["ACCESS", "CCM", "RPM", "CCM + RPM", "PCM", "PCM + RPM", "ASM", "APCM"],
  sources: ["ITERA Direct Outreach", "Physician Referral", "Practice Outreach"],
  accessSources: ["ITERA Direct Outreach", "Provider / Practice Referral"],
  referralOrigins: ["physician", "practiceStaff", "careTeam"],
  conditions: ["Hypertension", "Diabetes", "Heart Failure", "Chronic Kidney Disease"],
  coverage: ["Original Medicare", "Medicare Advantage"],
  languages: [{ value: "en", label: "English" }, { value: "es", label: "Spanish" }, { value: "ht", label: "Creole" }],
  accessTracks: ["eCKM", "CKM", "BH", "MSK"],
  accessEligibilityResults: [{ value: "eligible", label: "Eligible" }, { value: "notEligible", label: "Not eligible" }]
};

export const ACCESS_COST_BY_TRACK = Object.freeze({ eCKM: 6, CKM: 7, BH: 3, MSK: 3 });
export const SECONDARY_COVERAGE_STATUSES = Object.freeze({
  NOT_VERIFIED: "SECONDARY_NOT_VERIFIED",
  PRESENT_NOT_CONFIRMED: "SECONDARY_PRESENT_NOT_CONFIRMED",
  VERIFIED: "SECONDARY_COVERAGE_VERIFIED"
});

export function resolveAccessCost(track = "eCKM", secondaryCoverageStatus = SECONDARY_COVERAGE_STATUSES.NOT_VERIFIED) {
  const resolvedTrack = Object.prototype.hasOwnProperty.call(ACCESS_COST_BY_TRACK, track) ? track : "eCKM";
  const expectedMonthlyAmount = ACCESS_COST_BY_TRACK[resolvedTrack];
  const status = Object.values(SECONDARY_COVERAGE_STATUSES).includes(secondaryCoverageStatus) ? secondaryCoverageStatus : SECONDARY_COVERAGE_STATUSES.NOT_VERIFIED;
  const displayValue = status === SECONDARY_COVERAGE_STATUSES.VERIFIED
    ? "$0"
    : `${status === SECONDARY_COVERAGE_STATUSES.PRESENT_NOT_CONFIRMED ? "up to " : ""}$${expectedMonthlyAmount} per month`;
  return { track: resolvedTrack, expectedMonthlyAmount, displayValue, secondaryCoverageStatus: status };
}

export const DEFAULT_PROTOTYPE_CONFIG = {
  program: "ACCESS", source: "ITERA Direct Outreach", conditions: ["Hypertension"],
  referralOrigin: null,
  coverage: "Original Medicare", language: "en", accessTrack: "eCKM", accessEligibilityResult: "eligible", physicianDisplayName: "Dr. Fresner",
  physicianPhotoUrl: "/assets/doctor-portrait-v2.png", secondaryCoverageStatus: SECONDARY_COVERAGE_STATUSES.NOT_VERIFIED, accessCostSharingType: "COST_SHARING_APPLIES", accessCostSharingAmount: null,
  showAccessClaimsSharing: false, showAccessTempoDisclosure: false, accessTempoDisclosureText: ""
};

const pathwayKey = program => program.replaceAll(" + ", "_");
const conditionNames = {
  Hypertension: "high blood pressure", Diabetes: "diabetes", "Heart Failure": "heart failure",
  "Chronic Kidney Disease": "chronic kidney disease"
};

const conditionRules = {
  Hypertension: { module: "blood-pressure", baseline: "Blood pressure baseline", monitoring: "Blood pressure readings", assessment: "Blood pressure control" },
  Diabetes: { module: "diabetes", baseline: "Diabetes and A1C history", monitoring: "Blood sugar trends", assessment: "Diabetes management" },
  "Heart Failure": { module: "heart-failure", baseline: "Heart failure symptom baseline", monitoring: "Weight, symptoms, and blood pressure", assessment: "Heart failure symptoms" },
  "Chronic Kidney Disease": { module: "kidney-health", baseline: "Kidney health and medication baseline", monitoring: "Kidney-related labs and blood pressure", assessment: "Kidney health" }
};

const unique = values => [...new Set(values.filter(Boolean))];
export const ACCESS_PROVIDER_REFERRAL = "Provider / Practice Referral";
export const isProviderReferralSource = source => source === "Physician Referral" || source === ACCESS_PROVIDER_REFERRAL;
export const scenarioRequiresPhysician = (program, source) => isProviderReferralSource(source) || program !== "ACCESS";
export function normalizePrototypeConfig(input = {}) {
  const merged = { ...DEFAULT_PROTOTYPE_CONFIG, ...input };
  const requestedSource = String(merged.source || "");
  let source = requestedSource;
  let referralOrigin = PROTOTYPE_OPTIONS.referralOrigins.includes(merged.referralOrigin) ? merged.referralOrigin : null;
  if (merged.program === "ACCESS") {
    if (requestedSource === "Physician Referral") { source = ACCESS_PROVIDER_REFERRAL; referralOrigin ||= "physician"; }
    else if (requestedSource === "Practice Outreach") { source = ACCESS_PROVIDER_REFERRAL; referralOrigin ||= "practiceStaff"; }
    else if (!PROTOTYPE_OPTIONS.accessSources.includes(requestedSource)) source = DEFAULT_PROTOTYPE_CONFIG.source;
    if (source === "ITERA Direct Outreach") referralOrigin = null;
  } else {
    if (requestedSource === ACCESS_PROVIDER_REFERRAL) source = referralOrigin === "practiceStaff" ? "Practice Outreach" : "Physician Referral";
    if (!PROTOTYPE_OPTIONS.sources.includes(source)) source = DEFAULT_PROTOTYPE_CONFIG.source;
  }
  const physicianDisplayName = Object.prototype.hasOwnProperty.call(input, "physicianDisplayName")
    ? String(input.physicianDisplayName ?? "").trim()
    : Object.prototype.hasOwnProperty.call(input, "physician")
      ? String(input.physician ?? "").trim()
      : merged.physicianDisplayName;
  const requestedConditions = Array.isArray(input.conditions) ? input.conditions : input.condition ? [input.condition] : merged.conditions;
  const conditions = unique(requestedConditions.filter(condition => PROTOTYPE_OPTIONS.conditions.includes(condition)));
  return {
    ...merged,
    source,
    referralOrigin,
    coverage: merged.program === "ACCESS" ? "Original Medicare" : merged.coverage,
    conditions,
    physicianDisplayName
  };
}
const accessDisclosureConfig = (config, physicianDisplayName, careTrack) => ({
  accessCost: resolveAccessCost(careTrack, config.secondaryCoverageStatus),
  costSharingType: config.accessCostSharingType || "COST_SHARING_NONE",
  costSharingAmount: config.accessCostSharingAmount || null,
  verifiedPatientCost: config.verifiedPatientCost || null,
  showClaimsSharing: Boolean(config.showAccessClaimsSharing),
  showTempoDisclosure: Boolean(config.showAccessTempoDisclosure),
  tempoDisclosureText: config.accessTempoDisclosureText || "",
  physicianDisplayName: physicianDisplayName || null,
  careTrack: careTrack || "eCKM"
});

export function createPrototypeOffer(input = {}) {
  const config = normalizePrototypeConfig(input);
  const selectedConditions = config.conditions;
  const clinicalConditions = selectedConditions.map(name => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    patientFriendlyName: conditionNames[name] || name.toLowerCase()
  }));
  const rules = selectedConditions.map(name => conditionRules[name]).filter(Boolean);
  const pathway = pathwayKey(config.program);
  const program = pathways[pathway] || pathways.ACCESS;
  const isAccess = pathway === "ACCESS";
  const physicianRequired = scenarioRequiresPhysician(config.program, config.source);
  const physician = physicianRequired && config.physicianDisplayName ? { displayName: config.physicianDisplayName, id: config.physicianDisplayName.toLowerCase().replace(/[^a-z0-9]+/g, "-") } : null;
  const dynamicContent = { ...program, supportTemplate: physician ? program.support : isAccess ? "ITERA HEALTH coordinates this care with your existing doctors." : program.support, support: physician ? program.support.replaceAll("{physicianDisplayName}", physician.displayName) : isAccess ? "ITERA HEALTH coordinates this care with your existing doctors." : program.support };
  const accessCost = isAccess ? resolveAccessCost(config.accessTrack, config.secondaryCoverageStatus) : undefined;
  return {
    ...shared,
    id: `offer_prototype_${Date.now()}`,
    pathway,
    program: config.program,
    enrollmentSource: config.source,
    referralOrigin: config.referralOrigin,
    physician,
    accessTrack: isAccess ? config.accessTrack : undefined,
    accessCost,
    selectedLanguage: config.language,
    qualifyingConditions: clinicalConditions,
    qualifyingCondition: clinicalConditions[0] || { patientFriendlyName: "your health needs" },
    clinicalProfile: {
      conditions: clinicalConditions,
      primaryCondition: clinicalConditions[0] || null,
      assessmentFocus: unique(rules.map(rule => rule.assessment)),
      baselineRequirements: unique(rules.map(rule => rule.baseline)),
      monitoringNeeds: unique(rules.map(rule => rule.monitoring))
    },
    payer: { type: config.coverage === "Original Medicare" ? "OriginalMedicare" : "MedicareAdvantage", mbiAvailable: true, mbiConfidence: "trusted" },
    referringProvider: physician ? { ...shared.referringProvider, name: physician.displayName, verifiedPhotoUrl: config.physicianPhotoUrl || shared.referringProvider.verifiedPhotoUrl } : null,
    careCapabilities: program.capabilities.map(([icon, title, description], i) => ({ id: `cap-${i}`, icon, title, description })),
    consent: { ...shared.consent, services: program.services, costSharingText: program.cost, stopRules: program.stopRules },
    disclosures: { ...shared.disclosures, blocks: program.stopRules, accessConfig: isAccess ? accessDisclosureConfig(config, physician?.displayName || "", config.accessTrack) : undefined },
    onboardingModules: unique([...program.modules, ...rules.map(rule => rule.module)]),
    content: dynamicContent,
    prototypeConfig: { ...config, conditions: selectedConditions },
    fixture: { pathway, accessOutcome: isAccess ? config.accessEligibilityResult : undefined }
  };
}

export function createOffer(scenarioId = "access-happy") {
  const fixture = SCENARIOS[scenarioId] || SCENARIOS["access-happy"];
  const program = pathways[fixture.pathway];
  const isAccess = fixture.pathway === "ACCESS";
  const accessTrack = isAccess ? "eCKM" : undefined;
  const accessCost = isAccess ? resolveAccessCost(accessTrack, fixture.secondaryCoverageStatus) : undefined;
  return { ...shared, pathway: fixture.pathway, program: fixture.pathway, enrollmentSource: "Physician Referral", physician: { id: shared.referringProvider.id, displayName: shared.referringProvider.name }, accessTrack, accessCost, payer: fixture.missingMbi ? { type: "OriginalMedicare", mbiAvailable: false, mbiConfidence: "missing" } : shared.payer, careCapabilities: program.capabilities.map(([icon, title, description], i) => ({ id: `cap-${i}`, icon, title, description })), consent: { ...shared.consent, services: program.services, costSharingText: program.cost, stopRules: program.stopRules }, disclosures: { ...shared.disclosures, blocks: program.stopRules, accessConfig: isAccess ? accessDisclosureConfig(fixture, shared.referringProvider.name, accessTrack) : undefined }, onboardingModules: program.modules, content: { ...program, supportTemplate: program.support, support: program.support.replaceAll("{physicianDisplayName}", shared.referringProvider.name) }, fixture };
}
