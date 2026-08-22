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
  ACCESS: {
    invitation: "recommended added support",
    support: "ITERA HEALTH provides this care in coordination with Dr. Fresner.",
    capabilities: [["calendar", "Regular health check-ins", "Support based on your care needs"], ["heart", "A personalized care plan", "Goals and next steps for your health"], ["pill", "Medication support", "Help keeping treatment on track"], ["people", "Connected care team", "ITERA coordinates with Dr. Fresner"]],
    services: ["ACCESS care for high blood pressure"],
    cost: "Your regular Medicare benefits and cost-sharing continue to apply to covered care.",
    stopRules: ["Joining is voluntary", "Your Medicare benefits do not change", "You may stop participating at any time"],
    modules: ["baseline", "measure", "goals"]
  }
};

export function createOffer(scenarioId = "access-happy") {
  const fixture = SCENARIOS[scenarioId] || SCENARIOS["access-happy"];
  const program = pathways[fixture.pathway];
  return { ...shared, pathway: fixture.pathway, accessTrack: fixture.pathway === "ACCESS" ? "eCKM" : undefined, payer: fixture.missingMbi ? { type: "OriginalMedicare", mbiAvailable: false, mbiConfidence: "missing" } : shared.payer, careCapabilities: program.capabilities.map(([icon, title, description], i) => ({ id: `cap-${i}`, icon, title, description })), consent: { ...shared.consent, services: program.services, costSharingText: program.cost, stopRules: program.stopRules }, disclosures: { ...shared.disclosures, blocks: program.stopRules }, onboardingModules: program.modules, content: program, fixture };
}

export const I18N = {
  en: { back: "Back", continue: "Continue", help: "Help", secure: "Your information is secure", saved: "Progress saved", call: "Call our care team" },
  es: { back: "Atrás", continue: "Continuar", help: "Ayuda", secure: "Su información está segura", saved: "Progreso guardado", call: "Llame a nuestro equipo de cuidado" }
};
