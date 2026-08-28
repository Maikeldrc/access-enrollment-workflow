// How much medication a patient has left is an estimate, never a fact. This module produces that
// estimate, says how much it trusts itself, and raises a signal when it looks low — and nothing
// more. Turning a signal into a refill takes a patient answering a question, which is the whole
// point: the pharmacy record does not know that someone started the bottle a week late, got
// samples, went into hospital, or stopped taking it altogether.

const DAY_MS = 24 * 60 * 60 * 1000;

const T = (en, es, ht) => Object.freeze({ en, es, ht });
export const localSupplyText = (value, locale = "en") =>
  (typeof value === "string" ? value : value?.[locale] || value?.en || "");

export const SUPPLY_CONFIDENCE = Object.freeze({ HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW", NONE: "NONE" });

// Why a medication is or is not eligible for proactive supply monitoring. A medication taken "as
// needed" has no days-supply arithmetic that means anything, and neither does one being titrated.
export const SUPPLY_MONITORING = Object.freeze({
  ELIGIBLE: "ELIGIBLE",
  PRN_EXCLUDED: "PRN_EXCLUDED",
  VARIABLE_DOSING_EXCLUDED: "VARIABLE_DOSING_EXCLUDED",
  NOT_ACTIVE: "NOT_ACTIVE",
  RECONCILIATION_PENDING: "RECONCILIATION_PENDING",
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
  POLICY_EXCLUDED: "POLICY_EXCLUDED"
});

export const SIGNAL_STATUS = Object.freeze({
  DETECTED: "DETECTED",
  PATIENT_CONFIRMATION_NEEDED: "PATIENT_CONFIRMATION_NEEDED",
  CONFIRMED_LOW_SUPPLY: "CONFIRMED_LOW_SUPPLY",
  NOT_NEEDED: "NOT_NEEDED",
  UNCERTAIN: "UNCERTAIN",
  SUPERSEDED: "SUPERSEDED",
  CLOSED: "CLOSED"
});

export const SIGNAL_SOURCES = Object.freeze({ SUPPLY_ENGINE: "SUPPLY_ENGINE", PATIENT: "PATIENT", CARE_TEAM: "CARE_TEAM" });

// Versioned and configurable, because "ten days before it runs out" is a product decision that will
// change per medication, practice and payer — and because an audit has to be able to say which rule
// produced a signal.
export const REFILL_TRIGGER_POLICY = Object.freeze({
  id: "med-supply-trigger-v1",
  version: "1.0.0",
  leadTimeDays: 10,
  // Below this, the estimate is still worth a question but never worth a statement of days.
  minimumConfidence: SUPPLY_CONFIDENCE.LOW,
  // A confirmed fill or a completed refill inside this window means the patient has just been
  // through this; asking again would be nagging, not help.
  recentActivityDays: 14,
  staleDispenseDays: 180
});

export const medicationPolicyFor = (medication, policy = REFILL_TRIGGER_POLICY) => ({
  ...policy,
  ...(medication?.supplyPolicy || {})
});

const daysBetween = (from, to) => Math.round((new Date(to) - new Date(from)) / DAY_MS);
const addDays = (from, days) => new Date(new Date(from).getTime() + days * DAY_MS).toISOString();

// Eligibility is decided before any arithmetic runs, so an excluded medication never produces a
// number that something downstream could mistake for a real one.
function monitoringStateFor(medication, { reviewStatus = "", now = new Date(), policy } = {}) {
  if (!medication?.active) return SUPPLY_MONITORING.NOT_ACTIVE;
  if (medication.prn) return SUPPLY_MONITORING.PRN_EXCLUDED;
  if (medication.variableDosing) return SUPPLY_MONITORING.VARIABLE_DOSING_EXCLUDED;
  if (medication.supplyMonitoring === false) return SUPPLY_MONITORING.POLICY_EXCLUDED;
  // A patient who told us the dose changed, or that they stopped, has moved ahead of the record.
  // Proactive refills wait for reconciliation rather than acting on what is now known to be stale.
  if (["DOSE_CHANGED", "FREQUENCY_CHANGED", "NOT_TAKING"].includes(reviewStatus)) return SUPPLY_MONITORING.RECONCILIATION_PENDING;
  const dispense = medication.lastDispense;
  if (!dispense?.date || !Number.isFinite(Number(dispense.daysSupply))) return SUPPLY_MONITORING.INSUFFICIENT_DATA;
  if (daysBetween(dispense.date, now) > policy.staleDispenseDays) return SUPPLY_MONITORING.INSUFFICIENT_DATA;
  return SUPPLY_MONITORING.ELIGIBLE;
}

// Confidence is about the inputs, not the arithmetic. Every downgrade names itself so the reason
// can be audited and, where it matters, shown to a care team.
function confidenceFor(medication, { now, policy }) {
  const reasons = [];
  const dispense = medication.lastDispense || {};
  let level = SUPPLY_CONFIDENCE.HIGH;
  const downgrade = (to, reason) => {
    reasons.push(reason);
    if (level === SUPPLY_CONFIDENCE.HIGH || (level === SUPPLY_CONFIDENCE.MEDIUM && to === SUPPLY_CONFIDENCE.LOW)) level = to;
  };
  if (dispense.source !== "PHARMACY_DISPENSE") downgrade(SUPPLY_CONFIDENCE.MEDIUM, "DISPENSE_NOT_VERIFIED");
  if (!Number.isFinite(Number(dispense.quantity))) downgrade(SUPPLY_CONFIDENCE.MEDIUM, "QUANTITY_UNKNOWN");
  if (!medication.sig) downgrade(SUPPLY_CONFIDENCE.MEDIUM, "SIG_UNKNOWN");
  if (daysBetween(dispense.date, now) > 90) downgrade(SUPPLY_CONFIDENCE.LOW, "DISPENSE_OLD");
  if (medication.recentCareTransition) downgrade(SUPPLY_CONFIDENCE.LOW, "RECENT_CARE_TRANSITION");
  if (medication.reconciliationStatus === "PENDING") downgrade(SUPPLY_CONFIDENCE.LOW, "RECONCILIATION_PENDING");
  return { confidence: level, reasons };
}

export function estimateMedicationSupply(medication, { now = new Date(), reviewStatus = "", policy = REFILL_TRIGGER_POLICY } = {}) {
  const resolved = medicationPolicyFor(medication, policy);
  const monitoring = monitoringStateFor(medication, { reviewStatus, now, policy: resolved });
  const base = {
    medicationId: medication?.id || "",
    medicationRequestId: medication?.medicationRequestId || null,
    monitoring,
    eligible: monitoring === SUPPLY_MONITORING.ELIGIBLE,
    estimatedDaysRemaining: null,
    estimatedDepletionDate: null,
    confidence: SUPPLY_CONFIDENCE.NONE,
    confidenceReasons: [],
    ruleId: resolved.id,
    ruleVersion: resolved.version,
    inputs: {}
  };
  if (monitoring !== SUPPLY_MONITORING.ELIGIBLE) return base;
  const dispense = medication.lastDispense;
  const elapsed = daysBetween(dispense.date, now);
  const estimatedDaysRemaining = Number(dispense.daysSupply) - elapsed;
  const { confidence, reasons } = confidenceFor(medication, { now, policy: resolved });
  return {
    ...base,
    estimatedDaysRemaining,
    estimatedDepletionDate: addDays(dispense.date, Number(dispense.daysSupply)),
    confidence,
    confidenceReasons: reasons,
    inputs: {
      lastDispenseDate: dispense.date,
      daysSupply: Number(dispense.daysSupply),
      quantity: Number.isFinite(Number(dispense.quantity)) ? Number(dispense.quantity) : null,
      dispenseSource: dispense.source || "UNKNOWN",
      sig: medication.sig || "",
      refillsRemaining: Number.isFinite(Number(medication.refillsRemaining)) ? Number(medication.refillsRemaining) : null,
      prescriptionExpiresOn: medication.prescriptionExpiresOn || null
    }
  };
}

// Confidence decides the sentence. High confidence may say roughly how long; anything weaker asks
// rather than tells, and nothing here ever states a pill count the product cannot know.
export const SUPPLY_PHRASE = Object.freeze({
  HIGH_WEEK: T("Based on your last refill, you may have about a week left.", "Según su última surtida, es posible que le quede alrededor de una semana.", "Dapre dènye ranplisaj ou, ou ka gen apeprè yon semèn ki rete."),
  HIGH_DAYS: T("Based on your last refill, this may run out in the next few days.", "Según su última surtida, esto podría acabarse en los próximos días.", "Dapre dènye ranplisaj ou, sa ka fini nan pwochen jou yo."),
  HIGH_SOON: T("Based on your last refill, this may run out soon.", "Según su última surtida, esto podría acabarse pronto.", "Dapre dènye ranplisaj ou, sa ka fini byento."),
  UNCERTAIN: T("I’d like to check whether you need a refill.", "Quisiera confirmar si necesita una nueva surtida.", "Mwen ta renmen tcheke si ou bezwen yon ranplisaj.")
});

export function supplyPhrase(estimate, locale = "en") {
  if (!estimate?.eligible) return localSupplyText(SUPPLY_PHRASE.UNCERTAIN, locale);
  if (estimate.confidence !== SUPPLY_CONFIDENCE.HIGH) return localSupplyText(SUPPLY_PHRASE.UNCERTAIN, locale);
  const days = estimate.estimatedDaysRemaining;
  if (days <= 3) return localSupplyText(SUPPLY_PHRASE.HIGH_DAYS, locale);
  if (days <= 8) return localSupplyText(SUPPLY_PHRASE.HIGH_WEEK, locale);
  return localSupplyText(SUPPLY_PHRASE.HIGH_SOON, locale);
}

export function createSupplySignal({
  id = `med_supply_${Date.now().toString(36)}`,
  patientId = "",
  medication,
  estimate,
  source = SIGNAL_SOURCES.SUPPLY_ENGINE,
  detectedAt = new Date().toISOString()
} = {}) {
  return {
    id,
    patientId,
    medicationId: medication?.id || estimate?.medicationId || "",
    medicationRequestId: medication?.medicationRequestId || null,
    signalType: "LOW_SUPPLY",
    source,
    estimatedDaysRemaining: estimate?.estimatedDaysRemaining ?? null,
    estimatedDepletionDate: estimate?.estimatedDepletionDate ?? null,
    supplyConfidence: estimate?.confidence || SUPPLY_CONFIDENCE.NONE,
    confidenceReasons: estimate?.confidenceReasons || [],
    triggerRuleId: estimate?.ruleId || REFILL_TRIGGER_POLICY.id,
    triggerRuleVersion: estimate?.ruleVersion || REFILL_TRIGGER_POLICY.version,
    inputs: estimate?.inputs || {},
    detectedAt,
    status: SIGNAL_STATUS.PATIENT_CONFIRMATION_NEEDED,
    patientConfirmedAt: null,
    dismissedAt: null,
    updatedAt: detectedAt
  };
}

const signalIsOpen = signal => [SIGNAL_STATUS.DETECTED, SIGNAL_STATUS.PATIENT_CONFIRMATION_NEEDED, SIGNAL_STATUS.CONFIRMED_LOW_SUPPLY, SIGNAL_STATUS.UNCERTAIN].includes(signal?.status);
export const openSupplySignals = (signals = []) => signals.filter(signalIsOpen);
export const openSignalFor = (signals = [], medicationId) => openSupplySignals(signals).find(signal => signal.medicationId === medicationId) || null;

// The gate between "the arithmetic says low" and "ask the patient". Everything that would make the
// question wrong — an answer already given, a refill already running, a fill that already arrived —
// is checked here rather than in the UI.
export function detectLowSupply({
  medications = [],
  signals = [],
  refills = [],
  reviews = {},
  now = new Date(),
  policy = REFILL_TRIGGER_POLICY
} = {}) {
  return medications.reduce((raised, medication) => {
    const resolved = medicationPolicyFor(medication, policy);
    const estimate = estimateMedicationSupply(medication, { now, reviewStatus: reviews[medication.id]?.reviewStatus || "", policy: resolved });
    if (!estimate.eligible) return raised;
    if (estimate.estimatedDaysRemaining > resolved.leadTimeDays) return raised;
    if (openSignalFor(signals, medication.id)) return raised;
    // Someone already asked, and the patient said no. Their answer stands until something changes.
    const declined = signals.find(signal => signal.medicationId === medication.id && signal.status === SIGNAL_STATUS.NOT_NEEDED);
    if (declined && daysBetween(declined.dismissedAt || declined.updatedAt, now) < resolved.recentActivityDays) return raised;
    if (refills.some(refill => refill.medicationId === medication.id && !["COMPLETED", "CANCELED", "UNABLE_TO_PROCESS"].includes(refill.status))) return raised;
    const completed = refills.find(refill => refill.medicationId === medication.id && refill.status === "COMPLETED");
    if (completed && daysBetween(completed.completedAt || completed.updatedAt, now) < resolved.recentActivityDays) return raised;
    return [...raised, createSupplySignal({ medication, estimate, detectedAt: new Date(now).toISOString() })];
  }, []);
}

// A fill that arrives while the question is still on screen answers it. The signal is superseded
// rather than deleted, so the trail still shows that it was raised and why it stopped mattering.
export function supersedeSignalsForDispense(signals = [], { medicationId, now = new Date().toISOString() } = {}) {
  return signals.map(signal => (signal.medicationId === medicationId && signalIsOpen(signal)
    ? { ...signal, status: SIGNAL_STATUS.SUPERSEDED, updatedAt: now }
    : signal));
}

export const answerSupplySignal = (signal, { status, now = new Date().toISOString() } = {}) => (signal
  ? {
    ...signal,
    status,
    patientConfirmedAt: status === SIGNAL_STATUS.CONFIRMED_LOW_SUPPLY ? now : signal.patientConfirmedAt,
    dismissedAt: [SIGNAL_STATUS.NOT_NEEDED, SIGNAL_STATUS.CLOSED].includes(status) ? now : signal.dismissedAt,
    updatedAt: now
  }
  : signal);

// Analytics never carry a medication name: the id, the rule that fired and how confident it was are
// what make the trigger auditable and tunable.
export const supplySignalAnalytics = signal => (signal
  ? {
    signalId: signal.id,
    medicationId: signal.medicationId,
    status: signal.status,
    supplyConfidence: signal.supplyConfidence,
    estimatedDaysRemaining: signal.estimatedDaysRemaining,
    triggerRuleId: signal.triggerRuleId,
    triggerRuleVersion: signal.triggerRuleVersion,
    source: signal.source
  }
  : {});
