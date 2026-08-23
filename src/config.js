export const SCENARIOS = {
  "ccm-happy": { label: "CCM · happy path", pathway: "CCM" },
  "rpm-shipping": { label: "RPM · device shipping", pathway: "RPM", rpmDevice: "ship" },
  "rpm-owned": { label: "RPM · patient-owned device", pathway: "RPM", rpmDevice: "owned" },
  "rpm-transmission-fail": { label: "RPM · transmission support", pathway: "RPM", rpmDevice: "owned", firstReading: "failed" },
  "access-happy": { label: "ACCESS · eligible", pathway: "ACCESS", accessOutcome: "eligible" },
  "access-control": { label: "ACCESS · control group", pathway: "ACCESS", accessOutcome: "control" },
  "access-not-eligible": { label: "ACCESS · not eligible", pathway: "ACCESS", accessOutcome: "notEligible" },
  "access-already-aligned": { label: "ACCESS · already aligned", pathway: "ACCESS", accessOutcome: "alreadyAligned" },
  "access-api-unavailable": { label: "ACCESS · Medicare unavailable", pathway: "ACCESS", accessOutcome: "unavailable" },
  "access-missing-mbi": { label: "ACCESS · missing Medicare ID", pathway: "ACCESS", accessOutcome: "eligible", missingMbi: true },
  "identity-failure": { label: "Identity · mismatch", pathway: "CCM", identityFailure: true },
  "representative": { label: "Personal representative", pathway: "CCM", representative: true },
  "link-expired": { label: "Link · expired", pathway: "CCM", tokenState: "expired" },
  "link-invalid": { label: "Link · invalid", pathway: "CCM", tokenState: "invalid" }
};

const shared = {
  id: "offer_demo_2026",
  patient: { id: "patient_demo", displayName: "John S.", zipCodeMasked: "••176", phoneMasked: "(***) ***-4567", language: "en" },
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
    support: "ITERA HEALTH provides this care in coordination with Dr. Fresner.",
    capabilities: [["calendar", "Ongoing support between visits", "Regular check-ins with your care team"], ["heart", "Care plan support", "Help managing health goals and appointments"], ["pill", "Medication support", "Help keeping your treatment plan on track"], ["people", "Care coordination", "ITERA works with your regular doctors"]],
    services: ["Ongoing care support (CCM)"],
    cost: "Medicare cost-sharing may apply. Your care team can help you understand your coverage.",
    stopRules: ["Participation is voluntary", "You may stop this service at any time", "Only one practitioner can provide and bill for CCM in the same month"],
    modules: ["health", "medications", "goals"]
  },
  RPM: {
    invitation: "recommended monitoring from home",
    support: "ITERA HEALTH provides connected home monitoring in coordination with Dr. Fresner.",
    capabilities: [["heart", "Blood pressure monitoring at home", "A connected monitor shares your readings"], ["chart", "Readings reviewed remotely", "Your care team checks for important changes"], ["phone", "Support between visits", "Get help using your monitor"], ["doctor", "Your doctor stays involved", "Important updates are shared with Dr. Fresner"]],
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
    support: "ITERA HEALTH provides this care in coordination with Dr. Fresner.",
    capabilities: [["calendar", "Regular health check-ins", "Support based on your care needs"], ["heart", "A personalized care plan", "Goals and next steps for your health"], ["pill", "Medication support", "Help keeping treatment on track"], ["people", "Connected care team", "ITERA coordinates with Dr. Fresner"]],
    services: ["ACCESS care for high blood pressure"],
    cost: "Your regular Medicare benefits and cost-sharing continue to apply to covered care.",
    stopRules: ["Joining is voluntary", "Your Medicare benefits do not change", "You may stop participating at any time"],
    modules: ["baseline", "measure", "goals"]
  },
  PCM: {
    invitation: "recommended condition-focused support",
    support: "ITERA HEALTH provides focused support for the condition that matters most right now.",
    capabilities: [["heart", "Condition-focused support", "A care plan centered on your main health need"], ["calendar", "Support between visits", "Regular follow-up from your care team"], ["pill", "Treatment plan support", "Help staying on track with medications and goals"], ["doctor", "Your doctor stays involved", "Important updates are coordinated with your doctors"]],
    services: ["Condition-focused care (PCM)"],
    cost: "Medicare cost-sharing may apply. Your care team can help you understand your coverage.",
    stopRules: ["Participation is voluntary", "You may stop this service at any time", "Your regular Medicare benefits do not change"],
    modules: ["health", "medications", "goals"]
  },
  CCM_RPM: {
    invitation: "recommended ongoing care and home monitoring",
    support: "One coordinated experience combines ongoing care support with monitoring from home.",
    capabilities: [["people", "One coordinated care team", "Ongoing support and monitoring work together"], ["heart", "Monitoring from home", "Connected readings help your care team follow changes"], ["calendar", "Support between visits", "Regular check-ins based on your care needs"], ["doctor", "Your doctors stay involved", "Important updates are shared with your care team"]],
    services: ["Ongoing care support (CCM)", "Home monitoring (RPM)"],
    cost: "Medicare cost-sharing may apply for ongoing care and home monitoring services.",
    stopRules: ["Participation is voluntary", "You may stop these services at any time", "Home monitoring is not for emergencies"],
    modules: ["health", "device", "reading", "goals"]
  },
  PCM_RPM: {
    invitation: "recommended focused care and home monitoring",
    support: "One coordinated experience combines condition-focused care with monitoring from home.",
    capabilities: [["heart", "Focused support for your condition", "A care plan centered on your main health need"], ["chart", "Monitoring from home", "Connected readings help your care team follow changes"], ["phone", "Support between visits", "Help is available as your care plan continues"], ["doctor", "Your doctor stays involved", "Important updates are coordinated with your doctor"]],
    services: ["Condition-focused care (PCM)", "Home monitoring (RPM)"],
    cost: "Medicare cost-sharing may apply for condition-focused care and home monitoring services.",
    stopRules: ["Participation is voluntary", "You may stop these services at any time", "Home monitoring is not for emergencies"],
    modules: ["health", "device", "reading", "goals"]
  }
};

export const PROTOTYPE_OPTIONS = {
  programs: ["ACCESS", "CCM", "RPM", "CCM + RPM", "PCM", "PCM + RPM", "ASM", "APCM"],
  sources: ["ITERA Direct Outreach", "Physician Referral", "Practice Outreach"],
  conditions: ["Hypertension", "Diabetes", "Heart Failure", "Chronic Kidney Disease", "Other"],
  coverage: ["Original Medicare", "Medicare Advantage"],
  languages: [{ value: "en", label: "English" }, { value: "es", label: "Spanish" }, { value: "ht", label: "Creole" }],
  accessTracks: ["eCKM", "CKM", "BH", "MSK"],
  physicians: ["Dr. Fresner"]
};

export const DEFAULT_PROTOTYPE_CONFIG = {
  program: "ACCESS", source: "ITERA Direct Outreach", conditions: ["Hypertension"], otherCondition: "",
  coverage: "Original Medicare", language: "en", accessTrack: "eCKM", physician: "Dr. Fresner",
  physicianPhotoUrl: "/assets/doctor-portrait-v2.png"
};

const pathwayKey = program => program.replaceAll(" + ", "_");
const conditionNames = {
  Hypertension: "high blood pressure", Diabetes: "diabetes", "Heart Failure": "heart failure",
  "Chronic Kidney Disease": "chronic kidney disease", Other: "your health condition"
};

const conditionRules = {
  Hypertension: { module: "blood-pressure", baseline: "Blood pressure baseline", monitoring: "Blood pressure readings", assessment: "Blood pressure control" },
  Diabetes: { module: "diabetes", baseline: "Diabetes and A1C history", monitoring: "Blood sugar trends", assessment: "Diabetes management" },
  "Heart Failure": { module: "heart-failure", baseline: "Heart failure symptom baseline", monitoring: "Weight, symptoms, and blood pressure", assessment: "Heart failure symptoms" },
  "Chronic Kidney Disease": { module: "kidney-health", baseline: "Kidney health and medication baseline", monitoring: "Kidney-related labs and blood pressure", assessment: "Kidney health" },
  Other: { module: "other-condition", baseline: "Condition-specific baseline", monitoring: "Condition-specific monitoring needs", assessment: "Additional health condition" }
};

const unique = values => [...new Set(values.filter(Boolean))];

export function createPrototypeOffer(input = {}) {
  const config = { ...DEFAULT_PROTOTYPE_CONFIG, ...input };
  const selectedConditions = unique(Array.isArray(input.conditions) ? input.conditions : input.condition ? [input.condition] : config.conditions);
  const clinicalConditions = selectedConditions.map(name => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    patientFriendlyName: name === "Other" && config.otherCondition ? config.otherCondition : conditionNames[name] || name.toLowerCase(),
    isOther: name === "Other"
  }));
  const rules = selectedConditions.map(name => conditionRules[name] || conditionRules.Other);
  const pathway = pathwayKey(config.program);
  const program = pathways[pathway] || pathways.ACCESS;
  const isAccess = pathway === "ACCESS";
  const physician = config.source === "Physician Referral" && config.physician ? { displayName: config.physician, id: config.physician.toLowerCase().replace(/[^a-z0-9]+/g, "-") } : null;
  const conditionSummary = clinicalConditions.map(item => item.patientFriendlyName).join(", ");
  return {
    ...shared,
    id: `offer_prototype_${Date.now()}`,
    pathway,
    program: config.program,
    enrollmentSource: config.source,
    physician,
    accessTrack: isAccess ? config.accessTrack : undefined,
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
    referringProvider: { ...shared.referringProvider, name: config.physician || "Dr. Fresner", verifiedPhotoUrl: config.physicianPhotoUrl || shared.referringProvider.verifiedPhotoUrl },
    careCapabilities: program.capabilities.map(([icon, title, description], i) => ({ id: `cap-${i}`, icon, title, description: i === 0 && conditionSummary ? `${description} Focused on ${conditionSummary}.` : description })),
    consent: { ...shared.consent, services: program.services, costSharingText: program.cost, stopRules: program.stopRules },
    disclosures: { ...shared.disclosures, blocks: program.stopRules },
    onboardingModules: unique([...program.modules, ...rules.map(rule => rule.module)]),
    content: program,
    prototypeConfig: { ...config, conditions: selectedConditions },
    fixture: { pathway, accessOutcome: "eligible" }
  };
}

export function createOffer(scenarioId = "access-happy") {
  const fixture = SCENARIOS[scenarioId] || SCENARIOS["access-happy"];
  const program = pathways[fixture.pathway];
  return { ...shared, pathway: fixture.pathway, program: fixture.pathway, enrollmentSource: "Physician Referral", physician: { id: shared.referringProvider.id, displayName: shared.referringProvider.name }, accessTrack: fixture.pathway === "ACCESS" ? "eCKM" : undefined, payer: fixture.missingMbi ? { type: "OriginalMedicare", mbiAvailable: false, mbiConfidence: "missing" } : shared.payer, careCapabilities: program.capabilities.map(([icon, title, description], i) => ({ id: `cap-${i}`, icon, title, description })), consent: { ...shared.consent, services: program.services, costSharingText: program.cost, stopRules: program.stopRules }, disclosures: { ...shared.disclosures, blocks: program.stopRules }, onboardingModules: program.modules, content: program, fixture };
}

export const I18N = {
  en: { back: "Back", continue: "Continue", help: "Help", secure: "Your information is secure", saved: "Progress saved", call: "Call our care team" },
  es: { back: "Atrás", continue: "Continuar", help: "Ayuda", secure: "Su información está segura", saved: "Progreso guardado", call: "Llame a nuestro equipo de cuidado" },
  ht: { back: "Retounen", continue: "Kontinye", help: "Èd", secure: "Enfòmasyon ou an sekirite", saved: "Pwogrè anrejistre", call: "Rele ekip swen nou an" }
};
