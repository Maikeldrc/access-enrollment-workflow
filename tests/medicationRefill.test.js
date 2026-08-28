import { describe, expect, it } from "vitest";
import {
  REFILL_TRIGGER_POLICY,
  SIGNAL_STATUS,
  SUPPLY_CONFIDENCE,
  SUPPLY_MONITORING,
  answerSupplySignal,
  createSupplySignal,
  detectLowSupply,
  estimateMedicationSupply,
  openSignalFor,
  supersedeSignalsForDispense,
  supplyPhrase,
  supplySignalAnalytics
} from "../src/medicationSupply.js";
import {
  REFILL_BLOCKERS,
  REFILL_PATHS,
  REFILL_STATUS,
  advanceRefill,
  createRefillEpisode,
  findDuplicateRefill,
  refillAnalytics,
  refillCareTeamSummary,
  refillIdempotencyKey,
  refillNextStep,
  refillPatientStatus,
  resolveRefillPath,
  statusForPath
} from "../src/medicationRefill.js";

const NOW = new Date("2026-08-27T12:00:00.000Z");
const daysAgo = days => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const pharmacy = { id: "pharm-cvs", name: "CVS Pharmacy", address: "123 Main Street", statusIntegration: false };
const prescriber = { id: "dr-fresner", name: "Dr. Fresner" };

const lisinopril = {
  id: "med-lisinopril",
  name: "Lisinopril",
  strength: "10 mg",
  sig: "Take once daily",
  details: "10 mg · Once daily",
  active: true,
  prescriber,
  pharmacy,
  refillsRemaining: 0,
  prescriptionExpiresOn: "2027-01-01",
  lastDispense: { date: daysAgo(25), daysSupply: 30, quantity: 30, source: "PHARMACY_DISPENSE" },
  refillWorkflow: {}
};

const atorvastatin = { ...lisinopril, id: "med-atorvastatin", name: "Atorvastatin", strength: "20 mg", refillsRemaining: 3, lastDispense: { date: daysAgo(2), daysSupply: 90, quantity: 90, source: "PHARMACY_DISPENSE" } };

describe("supply estimation", () => {
  it("estimates days remaining from the last fill and says how much it trusts itself", () => {
    const estimate = estimateMedicationSupply(lisinopril, { now: NOW });
    expect(estimate).toMatchObject({
      eligible: true,
      monitoring: SUPPLY_MONITORING.ELIGIBLE,
      estimatedDaysRemaining: 5,
      confidence: SUPPLY_CONFIDENCE.HIGH,
      ruleId: REFILL_TRIGGER_POLICY.id,
      ruleVersion: REFILL_TRIGGER_POLICY.version
    });
    // The inputs travel with the estimate so a care team can see what it was built from.
    expect(estimate.inputs).toMatchObject({ daysSupply: 30, quantity: 30, dispenseSource: "PHARMACY_DISPENSE", refillsRemaining: 0 });
  });

  it("downgrades confidence when the inputs are weaker, and names why", () => {
    const patientReported = estimateMedicationSupply({ ...lisinopril, lastDispense: { date: daysAgo(25), daysSupply: 30, source: "PATIENT_REPORTED" } }, { now: NOW });
    expect(patientReported.confidence).toBe(SUPPLY_CONFIDENCE.MEDIUM);
    expect(patientReported.confidenceReasons).toEqual(expect.arrayContaining(["DISPENSE_NOT_VERIFIED", "QUANTITY_UNKNOWN"]));

    const afterHospital = estimateMedicationSupply({ ...lisinopril, recentCareTransition: true }, { now: NOW });
    expect(afterHospital.confidence).toBe(SUPPLY_CONFIDENCE.LOW);
    expect(afterHospital.confidenceReasons).toContain("RECENT_CARE_TRANSITION");
  });

  // An "as needed" medication has no daily arithmetic that means anything.
  it("refuses to estimate PRN and variable dosing at all", () => {
    expect(estimateMedicationSupply({ ...lisinopril, prn: true }, { now: NOW })).toMatchObject({ eligible: false, monitoring: SUPPLY_MONITORING.PRN_EXCLUDED, estimatedDaysRemaining: null });
    expect(estimateMedicationSupply({ ...lisinopril, variableDosing: true }, { now: NOW })).toMatchObject({ eligible: false, monitoring: SUPPLY_MONITORING.VARIABLE_DOSING_EXCLUDED });
  });

  it("stops estimating once the patient has told us the record is out of date", () => {
    expect(estimateMedicationSupply(lisinopril, { now: NOW, reviewStatus: "DOSE_CHANGED" })).toMatchObject({ eligible: false, monitoring: SUPPLY_MONITORING.RECONCILIATION_PENDING });
    expect(estimateMedicationSupply({ ...lisinopril, active: false }, { now: NOW })).toMatchObject({ eligible: false, monitoring: SUPPLY_MONITORING.NOT_ACTIVE });
    expect(estimateMedicationSupply({ ...lisinopril, lastDispense: null }, { now: NOW })).toMatchObject({ eligible: false, monitoring: SUPPLY_MONITORING.INSUFFICIENT_DATA });
  });

  // False precision is the failure mode that matters here: the product may never imply a pill count.
  it("says roughly how long only when confident, and asks otherwise", () => {
    expect(supplyPhrase(estimateMedicationSupply(lisinopril, { now: NOW }))).toBe("Based on your last refill, you may have about a week left.");
    expect(supplyPhrase(estimateMedicationSupply({ ...lisinopril, lastDispense: { date: daysAgo(28), daysSupply: 30, quantity: 30, source: "PHARMACY_DISPENSE" } }, { now: NOW }))).toBe("Based on your last refill, this may run out in the next few days.");
    expect(supplyPhrase(estimateMedicationSupply({ ...lisinopril, recentCareTransition: true }, { now: NOW }))).toBe("I’d like to check whether you need a refill.");
    expect(supplyPhrase(estimateMedicationSupply({ ...lisinopril, prn: true }, { now: NOW }), "es")).toBe("Quisiera confirmar si necesita una nueva surtida.");
    expect(JSON.stringify(SUPPLY_PHRASE_TEXT)).not.toMatch(/\d+ pills?|exactly/i);
  });
});

const SUPPLY_PHRASE_TEXT = [
  supplyPhrase(estimateMedicationSupply(lisinopril, { now: NOW })),
  supplyPhrase(estimateMedicationSupply({ ...lisinopril, prn: true }, { now: NOW }))
];

describe("low-supply detection", () => {
  it("raises a signal for a medication running low and leaves a well-stocked one alone", () => {
    const signals = detectLowSupply({ medications: [lisinopril, atorvastatin], now: NOW });
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      medicationId: "med-lisinopril",
      signalType: "LOW_SUPPLY",
      status: SIGNAL_STATUS.PATIENT_CONFIRMATION_NEEDED,
      supplyConfidence: SUPPLY_CONFIDENCE.HIGH,
      triggerRuleId: "med-supply-trigger-v1"
    });
    // Detection stops at a question. It never produces a refill.
    expect(signals[0]).not.toHaveProperty("refillRequested");
    expect(signals[0].patientConfirmedAt).toBeNull();
  });

  it("does not ask twice: an open signal, an open refill or a recent one all stop it", () => {
    const open = createSupplySignal({ medication: lisinopril, estimate: estimateMedicationSupply(lisinopril, { now: NOW }) });
    expect(detectLowSupply({ medications: [lisinopril], signals: [open], now: NOW })).toHaveLength(0);
    expect(detectLowSupply({ medications: [lisinopril], refills: [{ medicationId: "med-lisinopril", status: REFILL_STATUS.PENDING_PRESCRIBER }], now: NOW })).toHaveLength(0);
    expect(detectLowSupply({ medications: [lisinopril], refills: [{ medicationId: "med-lisinopril", status: REFILL_STATUS.COMPLETED, completedAt: daysAgo(3) }], now: NOW })).toHaveLength(0);
  });

  it("respects a patient who said they have enough", () => {
    const declined = answerSupplySignal(createSupplySignal({ medication: lisinopril, estimate: estimateMedicationSupply(lisinopril, { now: NOW }) }), { status: SIGNAL_STATUS.NOT_NEEDED, now: daysAgo(2) });
    expect(detectLowSupply({ medications: [lisinopril], signals: [declined], now: NOW })).toHaveLength(0);
  });

  it("closes a pending question when a fill arrives from somewhere else", () => {
    const signals = [createSupplySignal({ id: "sig-1", medication: lisinopril, estimate: estimateMedicationSupply(lisinopril, { now: NOW }) })];
    const superseded = supersedeSignalsForDispense(signals, { medicationId: "med-lisinopril" });
    expect(superseded[0].status).toBe(SIGNAL_STATUS.SUPERSEDED);
    expect(openSignalFor(superseded, "med-lisinopril")).toBeNull();
  });

  it("carries the identifier and the rule, never the label or the instructions", () => {
    const signal = createSupplySignal({ medication: lisinopril, estimate: estimateMedicationSupply(lisinopril, { now: NOW }) });
    const payload = supplySignalAnalytics(signal);
    expect(payload).toMatchObject({ medicationId: "med-lisinopril", triggerRuleVersion: "1.0.0", supplyConfidence: "HIGH" });
    expect(payload).not.toHaveProperty("medicationName");
    expect(JSON.stringify(payload)).not.toMatch(/Take once daily|CVS|Dr. Fresner/i);
  });
});

describe("refill path resolution", () => {
  it("uses the pharmacy directly when the prescription still authorises a fill", () => {
    expect(resolveRefillPath({ medication: atorvastatin, now: NOW })).toMatchObject({ path: REFILL_PATHS.DIRECT_PHARMACY_FULFILLMENT, requiresPrescriber: false });
    expect(statusForPath(REFILL_PATHS.DIRECT_PHARMACY_FULFILLMENT)).toBe(REFILL_STATUS.SENT_TO_PHARMACY);
  });

  it("asks the prescriber when there are no refills left or the prescription expired", () => {
    expect(resolveRefillPath({ medication: lisinopril, now: NOW })).toMatchObject({ path: REFILL_PATHS.PRESCRIBER_REFILL_REQUEST, reason: "NO_REFILLS_REMAINING", requiresPrescriber: true });
    expect(resolveRefillPath({ medication: { ...atorvastatin, prescriptionExpiresOn: "2026-01-01" }, now: NOW })).toMatchObject({ path: REFILL_PATHS.PRESCRIBER_REFILL_REQUEST, reason: "PRESCRIPTION_EXPIRED" });
  });

  // Safety outranks the refill, always.
  it("sends anything the safety engine flags to clinical review instead of a pharmacy", () => {
    expect(resolveRefillPath({ medication: atorvastatin, safetyResult: { severity: "EMERGENCY" }, now: NOW }))
      .toMatchObject({ path: REFILL_PATHS.CLINICAL_REVIEW_REQUIRED, requiresClinicalReview: true });
    expect(resolveRefillPath({ medication: atorvastatin, blocker: REFILL_BLOCKERS.MEDICATION_CONCERN, now: NOW }))
      .toMatchObject({ path: REFILL_PATHS.CLINICAL_REVIEW_REQUIRED, reason: "MEDICATION_CONCERN" });
  });

  it("stops on a discrepancy rather than refilling against a dose nobody confirmed", () => {
    expect(resolveRefillPath({ medication: atorvastatin, blocker: REFILL_BLOCKERS.MEDICATION_DISCREPANCY, now: NOW }))
      .toMatchObject({ path: REFILL_PATHS.CLINICAL_REVIEW_REQUIRED, reason: "MEDICATION_DISCREPANCY" });
    expect(resolveRefillPath({ medication: atorvastatin, blocker: REFILL_BLOCKERS.PATIENT_STOPPED, now: NOW }))
      .toMatchObject({ path: REFILL_PATHS.CARE_TEAM_REVIEW, reason: "PATIENT_REPORTED_STOPPED" });
  });

  // A visit or a test is required because the medication's workflow says so — never because EMMI
  // decided it would be sensible.
  it("only requires an appointment or a lab when the medication's own workflow does", () => {
    expect(resolveRefillPath({ medication: { ...lisinopril, refillWorkflow: { requiresAppointmentBeforeRenewal: true, requirementReason: "ANNUAL_REVIEW_DUE" } }, now: NOW }))
      .toMatchObject({ path: REFILL_PATHS.APPOINTMENT_REQUIRED, requiresAppointment: true, reason: "ANNUAL_REVIEW_DUE" });
    expect(resolveRefillPath({ medication: { ...lisinopril, refillWorkflow: { requiresMonitoringResult: true } }, now: NOW }))
      .toMatchObject({ path: REFILL_PATHS.LAB_OR_OTHER_REQUIREMENT });
    expect(resolveRefillPath({ medication: atorvastatin, now: NOW }).requiresAppointment).toBe(false);
  });

  it("never fulfils a restricted medication straight from the pharmacy", () => {
    expect(resolveRefillPath({ medication: { ...atorvastatin, refillWorkflow: { controlled: true } }, now: NOW }))
      .toMatchObject({ path: REFILL_PATHS.PRESCRIBER_REFILL_REQUEST, reason: "RESTRICTED_WORKFLOW", requiresPrescriber: true });
  });

  it("routes to a person when the record cannot say who prescribed it", () => {
    expect(resolveRefillPath({ medication: { ...lisinopril, prescriber: null }, now: NOW })).toMatchObject({ path: REFILL_PATHS.CARE_TEAM_REVIEW, reason: "PRESCRIBER_UNKNOWN" });
    expect(resolveRefillPath({ medication: { ...lisinopril, active: false }, now: NOW })).toMatchObject({ path: REFILL_PATHS.CARE_TEAM_REVIEW, reason: "MEDICATION_NOT_ACTIVE" });
  });
});

describe("refill episode", () => {
  const episode = () => createRefillEpisode({ patientId: "p1", medication: lisinopril, supplySignalId: "sig-1", now: NOW.toISOString() });

  it("keeps requested, approved and ready as three separate facts with their own sources", () => {
    let refill = advanceRefill(episode(), { status: REFILL_STATUS.PENDING_PRESCRIBER, source: "ITERA" });
    expect(refillPatientStatus(refill)).toBe("Waiting for your doctor");
    expect(refill.approvedAt).toBeNull();

    refill = advanceRefill(refill, { status: REFILL_STATUS.APPROVED, source: "PRESCRIBER" });
    expect(refill.approvedAt).toBeTruthy();
    expect(refill.readyAt).toBeNull();
    expect(refillPatientStatus(refill)).not.toMatch(/ready/i);

    refill = advanceRefill(refill, { status: REFILL_STATUS.READY_FOR_PICKUP, source: "PHARMACY" });
    expect(refillPatientStatus(refill)).toBe("Ready for pickup");
    expect(refill.events.map(event => event.source)).toEqual(["ITERA", "ITERA", "PRESCRIBER", "PHARMACY"]);
  });

  // A pharmacy ITERA cannot hear from is described honestly rather than optimistically.
  it("tells the patient to call the pharmacy when no status can reach us", () => {
    const sent = advanceRefill(episode(), { status: REFILL_STATUS.SENT_TO_PHARMACY, source: "ITERA" });
    expect(refillNextStep(sent, { pharmacyStatusAvailable: false })).toBe("Contact the pharmacy to confirm when it is ready.");
    expect(refillNextStep(sent, { pharmacyStatusAvailable: true })).toBe("EMMI will let you know when the pharmacy has it ready.");
  });

  it("treats a second attempt on the same day as the same request", () => {
    const key = refillIdempotencyKey({ patientId: "p1", medicationId: "med-lisinopril", supplySignalId: "sig-1", day: "2026-08-27" });
    const existing = { ...episode(), idempotencyKey: key, status: REFILL_STATUS.PENDING_PRESCRIBER };
    expect(findDuplicateRefill([existing], { patientId: "p1", medicationId: "med-lisinopril", supplySignalId: "sig-1", now: NOW })).toBe(existing);
    expect(findDuplicateRefill([existing], { patientId: "p1", medicationId: "med-atorvastatin", supplySignalId: "sig-2", now: NOW })).toBeNull();
  });

  it("hands the care team a structured summary rather than a transcript", () => {
    const refill = { ...episode(), blocker: REFILL_BLOCKERS.MEDICATION_CONCERN, patientConfirmedTaking: "YES", patientConfirmedLowSupply: "RUNNING_LOW", refillPath: REFILL_PATHS.CLINICAL_REVIEW_REQUIRED, status: REFILL_STATUS.NEEDS_CLINICAL_REVIEW };
    const summary = refillCareTeamSummary({ episode: refill, medication: lisinopril, supplyEstimate: estimateMedicationSupply(lisinopril, { now: NOW }), request: "CLINICAL_REVIEW" });
    expect(summary).toMatchObject({
      medication: "Lisinopril 10 mg",
      documentedSig: "Take once daily",
      patientConfirmedTaking: "YES",
      issue: REFILL_BLOCKERS.MEDICATION_CONCERN,
      estimatedDaysRemaining: 5,
      prescriber: "Dr. Fresner",
      request: "CLINICAL_REVIEW"
    });
  });

  it("carries the identifier and the path, never the label, the prescriber or the pharmacy", () => {
    const refill = { ...episode(), refillPath: REFILL_PATHS.PRESCRIBER_REFILL_REQUEST, status: REFILL_STATUS.PENDING_PRESCRIBER };
    const payload = refillAnalytics(refill);
    expect(payload).toMatchObject({ medicationId: "med-lisinopril", refillPath: REFILL_PATHS.PRESCRIBER_REFILL_REQUEST });
    expect(JSON.stringify(payload)).not.toMatch(/Take once daily|CVS|Dr. Fresner/i);
  });

  it("speaks Spanish and Kreyòl without falling back to English", () => {
    const refill = advanceRefill(episode(), { status: REFILL_STATUS.PENDING_PRESCRIBER });
    expect(refillPatientStatus(refill, "es")).toBe("Esperando a su médico");
    expect(refillPatientStatus(refill, "ht")).toBe("N ap tann doktè ou");
  });
});
