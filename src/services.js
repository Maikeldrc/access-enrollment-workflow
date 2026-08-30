import { BP_FULFILLMENT_DEVICE_MODELS, createOffer, createPrototypeOffer } from "./config.js";
import { serializeAppointmentDraft, serializeAppointmentForDraft } from "./appointments.js";

const wait = (ms = 650) => new Promise(resolve => setTimeout(resolve, ms));
// The identity form submits MM / DD / YYYY; the invitation stores an ISO date.
const typedIsoDate = value => {
  const match = /^(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})$/.exec(String(value || "").trim());
  return match ? `${match[3]}-${match[1]}-${match[2]}` : "";
};
const tx = prefix => `${prefix}_${Date.now().toString(36)}`;
export const AUTHORITY_VERIFICATION_METHODS = Object.freeze(["SELF_ATTESTATION", "EHR_MATCH", "DOCUMENT", "HUMAN_REVIEW"]);

export class MockEnrollmentService {
  constructor(scenarioId, prototypeConfig = null) { this.scenarioId = scenarioId; this.prototypeConfig = prototypeConfig; this.eligibilityRequests = new Map(); this.representativeOtp = null; this.lastRepresentativeOtpSentAt = 0; this.bpReadingAttempts = new Map(); this.bpObservationStore = new Map(); }
  offer() { return this.prototypeConfig ? createPrototypeOffer(this.prototypeConfig) : createOffer(this.scenarioId); }
  async getOffer() { await wait(350); const offer = this.offer(); if (offer.fixture.tokenState) throw new Error(offer.fixture.tokenState); return offer; }
  // Verification is the invitation matching the person in front of it: the offer already knows who
  // it was issued to, and the submitted date of birth and ZIP are checked against that, not against
  // a literal living in this service. A date that is merely well-formed is not a match.
  async verifyIdentity(input) {
    await wait();
    const offer = this.offer();
    const expected = offer.patient?.identityMatch || {};
    const submittedDate = typedIsoDate(input.dob);
    const matches = Boolean(expected.zip) && input.zip === expected.zip
      && Boolean(expected.dobIso) && submittedDate === expected.dobIso;
    return offer.fixture.identityFailure || !matches ? { verified: false, remainingAttempts: 2 } : { verified: true, verificationId: tx("verify") };
  }
  async sendRepresentativeOtp(phone) {
    const now = Date.now();
    const retryAfterSeconds = Math.max(0, 30 - Math.floor((now - this.lastRepresentativeOtpSentAt) / 1000));
    if (this.representativeOtp && retryAfterSeconds > 0) return { sent: false, reason: "rate_limited", retryAfterSeconds, deliveryId: this.representativeOtp.deliveryId };
    await wait(450);
    const deliveryId = tx("otp_delivery");
    this.representativeOtp = { deliveryId, phone, code: "123456", expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0 };
    this.lastRepresentativeOtpSentAt = Date.now();
    return { sent: true, deliveryId, retryAfterSeconds: 30 };
  }
  async verifyRepresentativeOtp({ deliveryId, phone, code }) {
    await wait(450);
    const active = this.representativeOtp;
    if (!active || active.deliveryId !== deliveryId || active.phone !== phone || active.expiresAt < Date.now()) return { verified: false, reason: "expired" };
    active.attempts += 1;
    if (active.attempts > 5) return { verified: false, reason: "locked" };
    if (code !== active.code) return { verified: false, reason: "invalid", remainingAttempts: Math.max(0, 5 - active.attempts) };
    this.representativeOtp = null;
    return { verified: true, verificationId: tx("phone_verify"), verifiedAt: new Date().toISOString() };
  }
  async saveAcknowledgement() { await wait(250); return { saved: true }; }
  async checkAccessEligibility({ idempotencyKey = "", onProgress = () => {} } = {}) {
    if (idempotencyKey && this.eligibilityRequests.has(idempotencyKey)) return this.eligibilityRequests.get(idempotencyKey);
    const request = (async () => {
      onProgress("verifyingCoverage");
      await wait(400);
      onProgress("checkingEnrollment");
      await wait(400);
      onProgress("confirmingOption");
      await wait(400);
      if (this.offer().fixture.eligibilityFailure) throw new Error("eligibility_temporarily_unavailable");
      return { outcome: this.offer().fixture.accessOutcome || "eligible", transactionId: tx("elig") };
    })();
    if (idempotencyKey) this.eligibilityRequests.set(idempotencyKey, request);
    try { return await request; }
    catch (error) { if (idempotencyKey) this.eligibilityRequests.delete(idempotencyKey); throw error; }
  }
  async saveConsent() { await wait(700); return { confirmed: true, consentId: tx("consent") }; }
  async createTraditionalEnrollment() { await wait(1200); return { status: "confirmed", enrollmentId: tx("enroll"), effectiveDate: "August 21, 2026" }; }
  async submitAccessAlignment() { await wait(1400); return { status: "confirmed", alignmentId: tx("align"), effectiveDate: "August 21, 2026" }; }
  async saveOnboarding() { await wait(350); return { saved: true }; }
  async submitFirstReading() { await wait(1300); return this.offer().fixture.firstReading === "failed" ? { status: "failed", reason: "not_received" } : { status: "received", systolic: 120, diastolic: 80, receivedAt: new Date().toISOString() }; }
  async getActiveDeviceAssignment(patientId) {
    await wait(450);
    const fixture = this.offer().fixture;
    if (!patientId || fixture.bpDeviceAssignment === "none") return { status: "not_found", assignment: null, patientOwnsMonitor: false, deviceSource: "NONE", integrationStatus: "NOT_CONNECTED" };
    if (fixture.bpDeviceAssignment === "patient-owned" || fixture.bpDeviceScenario === "patient-owned-unsupported") return { status: "not_found", assignment: null, patientOwnsMonitor: true, deviceSource: "PATIENT_OWNED", deviceVendor: "OTHER", deviceStatus: "ACTIVE", integrationProvider: "OTHER", integrationStatus: "UNSUPPORTED" };
    const vendor = fixture.bpDeviceVendor === "PYLO" || fixture.bpDeviceScenario === "itera-pylo" ? "PYLO" : "TENOVI";
    return { status: "active", assignment: { patientId, assignedDeviceId: fixture.assignedDeviceId || (vendor === "PYLO" ? "pylo-bp-6719" : "tenovi-bp-8842"), assignedAt: "2026-08-20T14:00:00.000Z" } };
  }
  getScenarioDeviceContext() {
    const fixture = this.offer().fixture;
    if (fixture.pathway !== "ACCESS") return null;
    if (fixture.bpDeviceAssignment === "patient-owned" || fixture.bpDeviceScenario === "patient-owned-unsupported") return { found: false, patientOwnsMonitor: true, deviceSource: "PATIENT_OWNED", assignedDeviceId: null, deviceVendor: "OTHER", deviceStatus: "ACTIVE", integrationProvider: "OTHER", integrationStatus: "UNSUPPORTED" };
    if (fixture.bpDeviceAssignment === "none" || fixture.bpDeviceScenario === "none") return { found: false, patientOwnsMonitor: false, deviceSource: "NONE", assignedDeviceId: null, integrationStatus: "NOT_CONNECTED" };
    const vendor = fixture.bpDeviceVendor === "PYLO" || fixture.bpDeviceScenario === "itera-pylo" ? "PYLO" : "TENOVI";
    return { found: true, patientOwnsMonitor: true, deviceSource: "ITERA_ASSIGNED", assignedDeviceId: fixture.assignedDeviceId || (vendor === "PYLO" ? "pylo-bp-6719" : "tenovi-bp-8842"), deviceVendor: vendor, deviceStatus: "ACTIVE", integrationProvider: vendor, integrationStatus: "CONNECTED" };
  }
  async getDeviceById(assignedDeviceId) {
    await wait(450);
    if (this.offer().fixture.bpDeviceLookupFailure) throw new Error("device_lookup_unavailable");
    if (!assignedDeviceId) return { status: "not_found" };
    const vendor = assignedDeviceId.startsWith("pylo-") ? "PYLO" : assignedDeviceId.startsWith("tenovi-") ? "TENOVI" : "OTHER";
    if (this.offer().fixture.bpDeviceInactive) return { status: "inactive", deviceId: assignedDeviceId, vendor, integrationStatus: "DISCONNECTED" };
    return { status: "active", deviceId: assignedDeviceId, vendor, model: vendor === "PYLO" ? "Pylo Connected Blood Pressure Monitor" : "Tenovi Connected Blood Pressure Monitor", integrationStatus: "CONNECTED", lastTransmissionAt: "2026-08-25T13:42:00.000Z" };
  }
  async verifyAccessBpDevice({ method = "manual" } = {}) {
    await wait(700);
    if (method === "unsure") return { status: "needs_assistance" };
    if (this.offer().fixture.bpDeviceCompatibility === "incompatible") return { status: "incompatible", deviceId: "demo-wrist-01", deviceModel: "Demo wrist monitor" };
    return { status: "compatible", deviceId: "demo-upper-arm-01", deviceModel: "Demo upper-arm monitor", deviceType: "UPPER_ARM", source: "CONNECTED_DEVICE", sourceVerified: true };
  }
  async receiveAccessBpReading({ readingNumber = 1, deviceId = "demo-upper-arm-01", deviceModel = "Demo upper-arm monitor" } = {}) {
    const attempts = (this.bpReadingAttempts.get(readingNumber) || 0) + 1;
    this.bpReadingAttempts.set(readingNumber, attempts);
    await wait(700);
    if (this.offer().fixture.bpReadingFailureAt === readingNumber && attempts === 1) return { status: "failed", reason: "transmission_not_received" };
    const normalReadings = [[124, 78], [121, 76], [123, 77]];
    const escalationReadings = [[184, 122], [181, 120], [183, 121]];
    const [systolic, diastolic] = (this.offer().fixture.bpClinicalReview === "escalation" ? escalationReadings : normalReadings)[readingNumber - 1] || normalReadings[0];
    const timestamp = new Date().toISOString();
    const transmissionDeviceId = this.offer().fixture.bpSourceMismatch && readingNumber === 1 ? "tenovi-bp-9999" : deviceId;
    return { status: "received", observationId: `bp-observation-${transmissionDeviceId}-${readingNumber}`, readingId: `bp-observation-${transmissionDeviceId}-${readingNumber}`, readingValue: `${systolic}/${diastolic}`, systolic, diastolic, timestamp, deviceId: transmissionDeviceId, sourceDeviceId: transmissionDeviceId, deviceModel, source: "CONNECTED_DEVICE", sourceVerified: true, receivedAt: timestamp };
  }
  async recordAccessBpObservation(observation = {}) {
    const observationId = observation.observationId || observation.readingId || `${observation.deviceId || "unknown"}:${observation.timestamp || "unknown"}`;
    if (this.bpObservationStore.has(observationId)) return { stored: false, duplicate: true, observationId };
    this.bpObservationStore.set(observationId, { ...observation, observationId });
    return { stored: true, duplicate: false, observationId };
  }
  getStoredAccessBpObservations({ deviceId } = {}) {
    return [...this.bpObservationStore.values()].filter(observation => !deviceId || observation.deviceId === deviceId).map(observation => ({ ...observation }));
  }
  async getPendingAccessBpObservations({ deviceId, afterCount = 0 } = {}) {
    const configured = Number(this.offer().fixture.bpBackgroundReadings || 0);
    const observations = [];
    for (let index = afterCount + 1; index <= Math.min(3, afterCount + configured); index += 1) observations.push(await this.receiveAccessBpReading({ readingNumber: index, deviceId, deviceModel: this.offer().fixture.bpDeviceVendor === "PYLO" ? "Pylo Connected Blood Pressure Monitor" : "Tenovi Connected Blood Pressure Monitor" }));
    return observations;
  }
  async evaluateAccessBpBaseline(readings = []) {
    await wait(300);
    if (this.offer().fixture.bpClinicalReview === "escalation") return { status: "escalation", severity: "urgent", ruleId: "configured-bp-clinical-rule", averageSystolic: 183, averageDiastolic: 121 };
    if (readings.length < 3) return { status: "complete", averageSystolic: 123, averageDiastolic: 77 };
    return { status: "complete", averageSystolic: Math.round(readings.reduce((sum, reading) => sum + reading.systolic, 0) / readings.length), averageDiastolic: Math.round(readings.reduce((sum, reading) => sum + reading.diastolic, 0) / readings.length) };
  }
  async createBpDeviceFulfillment({ shippingAddress, armMeasurementStatus, armRestrictionReported, cuffSelectionMethod, selectedCuffOption, cuffSelectionStatus, deviceModelSelected } = {}) {
    await wait(700);
    const device = BP_FULFILLMENT_DEVICE_MODELS.find(model => model.id === deviceModelSelected && model.availableForFulfillment);
    const cuff = device?.cuffOptions.find(option => option.id === selectedCuffOption && option.inventoryStatus === "AVAILABLE" && option.compatibleDeviceModels.includes(device.id));
    const requiresReview = cuffSelectionStatus === "NEEDS_ASSISTANCE" || cuffSelectionMethod === "CARE_TEAM_ASSISTANCE" || ["UNSURE"].includes(armRestrictionReported) || !device || !cuff;
    return { status: "requested", fulfillmentId: tx("bp_device"), requestedAt: new Date().toISOString(), shippingAddressConfirmed: Boolean(shippingAddress), cuffSelectionStatus: requiresReview ? "CARE_TEAM_REVIEW_REQUIRED" : cuffSelectionStatus, selectedCuffOption: cuff?.id || null, deviceModelSelected: device?.id || null, armMeasurementStatus };
  }
}

export class DraftStore {
  constructor(key = "itera.enrollment.safe-draft.v2") { this.key = key; }
  load() { try { return JSON.parse(localStorage.getItem(this.key) || "null"); } catch { return null; } }
  save(state) {
    const representativeInProgress = state.completionRole === "personalRepresentative" && Boolean(state.representativeFullName);
    if (!state.identityVerified && !representativeInProgress) return;
    const safeReadingReceipts = (state.bpReadingReceipts || []).map(({ readingId, observationId, readingNumber, timestamp, deviceId, deviceModel, source, sourceVerified, receivedAt }) => ({ readingId, observationId, readingNumber, timestamp, deviceId, deviceModel, source, sourceVerified, receivedAt }));
const safe = { scenarioId: state.scenarioId, screen: state.screen, role: state.role, completionRole: state.completionRole, representativeFullName: state.representativeFullName, representativeRelationship: state.representativeRelationship, representativeAuthorityType: state.representativeAuthorityType, representativePhone: state.representativePhone, phoneVerified: state.phoneVerified, phoneVerificationMethod: state.phoneVerificationMethod, phoneVerifiedAt: state.phoneVerifiedAt, representativeAuthorityAttested: state.representativeAuthorityAttested, authorityAttestation: state.authorityAttestation, authorityAttestedAt: state.authorityAttestedAt, authorityVerificationMethod: state.authorityVerificationMethod, authorityAdditionalVerificationRequired: Boolean(state.authorityAdditionalVerificationRequired), accessNoticeAcknowledgedAt: state.accessNoticeAcknowledgedAt, disclosureAcknowledgedAt: state.disclosureAcknowledgedAt, disclosureVersion: state.disclosureVersion, accessDisclosureView: state.accessDisclosureView ?? null, consentRole: state.consentRole, consentVersion: state.consentVersion, consentTimestamp: state.consentTimestamp, consentAcknowledgement: state.consentAcknowledgement ?? null, sessionId: state.sessionId, sessionMetadata: state.sessionMetadata, ipMetadata: state.ipMetadata ?? null, audit: state.audit, language: state.language, identityVerified: Boolean(state.identityVerified), consentSaved: state.consentSaved, enrollmentConfirmed: state.enrollmentConfirmed, enrollmentStatus: state.enrollmentStatus, enrollmentCompletedAt: state.enrollmentCompletedAt, baselineStatus: state.baselineStatus, baselineStartedAt: state.baselineStartedAt, baselineCompletedAt: state.baselineCompletedAt, baselineDeferredAt: state.baselineDeferredAt, baselineResumeScreen: state.baselineResumeScreen, baselineReminderStatus: state.baselineReminderStatus, bpBaselineStatus: state.bpBaselineStatus, bpBaselineRequiredReadings: state.bpBaselineRequiredReadings, bpBaselineReadingCount: state.bpBaselineReadingCount, bpBaselineRemainingReadings: state.bpBaselineRemainingReadings, bpDevicePath: state.bpDevicePath, bpDeviceIdentificationMethod: state.bpDeviceIdentificationMethod, bpDeviceVerificationStatus: state.bpDeviceVerificationStatus, bpDeviceVerificationResult: state.bpDeviceVerificationResult, bpDevice: state.bpDevice, armCircumferenceValue: state.armCircumferenceValue, armCircumferenceUnit: state.armCircumferenceUnit, armMeasurementStatus: state.armMeasurementStatus, armMeasurementHelpReason: state.armMeasurementHelpReason, armRestrictionReported: state.armRestrictionReported, restrictedArm: state.restrictedArm, measurementArm: state.measurementArm, exactArmMeasurementOpen: Boolean(state.exactArmMeasurementOpen), cuffSelectionMethod: state.cuffSelectionMethod, selectedCuffOption: state.selectedCuffOption, cuffSelectionStatus: state.cuffSelectionStatus, cuffSizeSelected: state.cuffSizeSelected, deviceModelSelected: state.deviceModelSelected, shippingAddress: state.shippingAddress, shippingAddressConfirmed: state.shippingAddressConfirmed, shippingAddressMode: state.shippingAddressMode, deviceFulfillmentId: state.deviceFulfillmentId, deviceFulfillmentStatus: state.deviceFulfillmentStatus, bpDeviceFulfillmentStatus: state.bpDeviceFulfillmentStatus, bpDeviceFulfillmentRequestedAt: state.bpDeviceFulfillmentRequestedAt, careTeamTasks: state.careTeamTasks, bpBaselineSourceType: state.bpBaselineSourceType, bpReadingCount: state.bpReadingCount, bpReadingReceipts: safeReadingReceipts, bpMeasurementPhase: state.bpMeasurementPhase, bpEscalationState: state.bpEscalationState, accessEligible: state.accessEligible, accessOutcome: state.accessOutcome, eligibilityPhase: state.eligibilityPhase, eligibilityError: state.eligibilityError, eligibilityRequestKey: state.eligibilityRequestKey, alignmentConfirmed: state.alignmentConfirmed, devicePath: state.devicePath, addressConfirmed: state.addressConfirmed, setupComplete: state.setupComplete, readingReceived: state.readingReceived, onboarding: state.onboarding, updatedAt: new Date().toISOString() };
    Object.assign(safe, {
      activationStatus: state.activationStatus,
      activationStartedAt: state.activationStartedAt,
      flowProgress: state.flowProgress,
      flowTransitionNotice: state.flowTransitionNotice,
      deviceSetupStatus: state.deviceSetupStatus,
      deviceSetupStartedAt: state.deviceSetupStartedAt,
      patientHasBloodPressureMonitor: Boolean(state.patientHasBloodPressureMonitor),
      deviceSource: state.deviceSource,
      deviceVerificationStatus: state.deviceVerificationStatus,
      integrationProvider: state.integrationProvider,
      assignedDeviceId: state.assignedDeviceId,
      deviceVendor: state.deviceVendor,
      deviceModel: state.deviceModel,
      deviceStatus: state.deviceStatus,
      integrationStatus: state.integrationStatus,
      lastTransmissionAt: state.lastTransmissionAt,
      last4DeviceId: state.last4DeviceId,
      patientDeviceConfirmationChoice: state.patientDeviceConfirmationChoice,
      patientDeviceConfirmed: state.patientDeviceConfirmed,
      patientDeviceConfirmedAt: state.patientDeviceConfirmedAt,
      confirmedDeviceId: state.confirmedDeviceId,
      firstTransmissionVerified: state.firstTransmissionVerified,
      firstTransmissionDeviceId: state.firstTransmissionDeviceId,
      firstTransmissionAt: state.firstTransmissionAt,
      deviceUncertaintyStep: Boolean(state.deviceUncertaintyStep)
    });
    Object.assign(safe, {
      healthInformationStepStatus: state.healthInformationStepStatus,
      healthInformationReviewStatus: state.healthInformationReviewStatus,
      healthInformationReviewResult: state.healthInformationReviewResult,
      healthInformationReviewedAt: state.healthInformationReviewedAt,
      healthInformationReviewedBy: state.healthInformationReviewedBy,
      healthInformationReviewSource: state.healthInformationReviewSource,
      healthInformationFlowStep: state.healthInformationFlowStep,
      healthInformationUpdateDraft: state.healthInformationUpdateDraft ? { id: state.healthInformationUpdateDraft.id || "", updateType: state.healthInformationUpdateDraft.updateType || "", relatedConditionIds: [...(state.healthInformationUpdateDraft.relatedConditionIds || [])], patientReportedText: state.healthInformationUpdateDraft.patientReportedText || "" } : null,
      patientReportedHealthUpdates: (state.patientReportedHealthUpdates || []).map(({ id, patientId, relatedConditionIds, updateType, patientReportedText, patientReportedStatus, source, createdAt, updatedAt, status, careTeamTaskId }) => ({ id, patientId, relatedConditionIds: [...(relatedConditionIds || [])], updateType, patientReportedText, patientReportedStatus, source, createdAt, updatedAt, status, careTeamTaskId })),
      medicationsReviewStatus: state.medicationsReviewStatus,
      // Medications persist with the supply, prescriber and pharmacy facts the refill engine reads,
      // and with the provenance of the last fill. Dropping them would make a restored session
      // estimate supply from nothing and ask the patient questions it already had answers to.
      careMedications: (state.careMedications || []).map(medication => ({
        id: medication.id, name: medication.name, strength: medication.strength || "", details: medication.details, sig: medication.sig || "", active: Boolean(medication.active),
        medicationRequestId: medication.medicationRequestId || null, prn: Boolean(medication.prn), variableDosing: Boolean(medication.variableDosing),
        prescriber: medication.prescriber || null, pharmacy: medication.pharmacy || null,
        refillsRemaining: medication.refillsRemaining ?? null, prescriptionExpiresOn: medication.prescriptionExpiresOn || null,
        lastDispense: medication.lastDispense || null, refillWorkflow: medication.refillWorkflow || {},
        recentCareTransition: Boolean(medication.recentCareTransition), reconciliationStatus: medication.reconciliationStatus || ""
      })),
      medicationSupplySignals: (state.medicationSupplySignals || []).map(signal => ({ ...signal })),
      medicationRefills: (state.medicationRefills || []).map(refill => ({ ...refill, events: (refill.events || []).map(event => ({ ...event })) })),
      medicationReviews: Object.fromEntries(Object.entries(state.medicationReviews || {}).map(([id, review]) => [id, { medicationId: review.medicationId, sourceMedicationSnapshot: review.sourceMedicationSnapshot, reviewStatus: review.reviewStatus, patientReportedDose: review.patientReportedDose || "", patientReportedFrequency: review.patientReportedFrequency || "", patientNotes: review.patientNotes || "", reviewedAt: review.reviewedAt, source: review.source, actorContext: review.actorContext }])),
      additionalMedications: (state.additionalMedications || []).map(({ id, medicationName, dose, frequency, frequencyLabel, source, createdAt }) => ({ id, medicationName, dose, frequency, frequencyLabel, source, createdAt })),
      additionalMedicationsStatus: state.additionalMedicationsStatus,
      carePreferencesStatus: state.carePreferencesStatus,
      preferredContactMethod: state.preferredContactMethod,
      preferredCareLanguage: state.preferredCareLanguage,
      preferredContactTime: state.preferredContactTime,
      goalsStatus: state.goalsStatus,
      careGoals: [...(state.careGoals || [])],
      careGoalsNote: state.careGoalsNote,
      goalFlowStep: state.goalFlowStep,
      goalFlowOrigin: state.goalFlowOrigin,
      patientGoals: (state.patientGoals || []).map(goal => ({
        id: goal.id, patientId: goal.patientId, goalType: goal.goalType, title: goal.title, goalSource: goal.goalSource || "", selectedBy: goal.selectedBy || "", customTitle: goal.customTitle || "", status: goal.status, priority: goal.priority, whyItMatters: goal.whyItMatters || "", planStatus: goal.planStatus,
        actions: (goal.actions || []).map(action => ({ id: action.id, goalId: action.goalId, templateId: action.templateId || "", title: action.title, actionType: action.actionType, source: action.source, frequency: action.frequency || "", targetCount: action.targetCount ?? null, schedule: action.schedule ?? null, remindersEnabled: Boolean(action.remindersEnabled), reminderSlot: action.reminderSlot || "", reminderTime: action.reminderTime || "", status: action.status, completionHistory: (action.completionHistory || []).map(entry => ({ id: entry.id, date: entry.date, completedAt: entry.completedAt, source: entry.source })), createdAt: action.createdAt, updatedAt: action.updatedAt })),
        progress: (goal.progress || []).map(item => ({ id: item.id, goalId: item.goalId, actionId: item.actionId || null, progressType: item.progressType, value: item.value ?? null, patientReportedStatus: item.patientReportedStatus || "", timestamp: item.timestamp })),
        // A barrier persists as the care signal it is: what was tried, how it went, who owns it
        // now, and when EMMI should ask again. Dropping the intervention history would leave a
        // restored session offering help the patient already told us did not work.
        barriers: (goal.barriers || []).map(item => ({
          id: item.id, goalId: item.goalId, goalActionId: item.goalActionId ?? null, category: item.category || item.barrierType || "OTHER", subtype: item.subtype || "", scope: item.scope || "GOAL",
          patientDescription: item.patientDescription ?? item.notes ?? "", source: item.source || "PATIENT", status: item.status, owner: item.owner || "EMMI",
          resolutionPath: item.resolutionPath ?? null, resolutionPlan: item.resolutionPlan || "",
          interventions: (item.interventions || []).map(entry => ({ id: entry.id, type: entry.type, detail: entry.detail || {}, startedAt: entry.startedAt, outcome: entry.outcome ?? null, outcomeAt: entry.outcomeAt ?? null, followUpAt: entry.followUpAt ?? null })),
          followUpAt: item.followUpAt ?? null, detectedAt: item.detectedAt || item.createdAt, confirmedAt: item.confirmedAt ?? null, resolvedAt: item.resolvedAt ?? null,
          resolutionOutcome: item.resolutionOutcome ?? null, recurrenceCount: item.recurrenceCount || 0, appointmentRequest: item.appointmentRequest ?? null,
          createdBy: item.createdBy || item.source || "PATIENT", createdAt: item.createdAt, updatedAt: item.updatedAt || item.createdAt
        })),
        supportRequests: (goal.supportRequests || []).map(item => ({ id: item.id, goalId: item.goalId, supportType: item.supportType, careTeamTaskId: item.careTeamTaskId || null, status: item.status, createdAt: item.createdAt })),
        reviews: (goal.reviews || []).map(item => ({ id: item.id, goalId: item.goalId, reviewedAt: item.reviewedAt, patientStatus: item.patientStatus, changesMade: Boolean(item.changesMade) })),
        reminderPreference: goal.reminderPreference ?? null,
        createdBy: goal.createdBy, createdAt: goal.createdAt, updatedAt: goal.updatedAt
      })),
      goalPrimaryId: state.goalPrimaryId,
      goalSecondaryId: state.goalSecondaryId,
      goalPlanningGoalId: state.goalPlanningGoalId,
      goalPlanStatus: state.goalPlanStatus,
      goalPlanDraft: state.goalPlanDraft ? { actionIds: [...(state.goalPlanDraft.actionIds || [])], customAction: state.goalPlanDraft.customAction || "", frequency: state.goalPlanDraft.frequency || "few-days", remindersEnabled: Boolean(state.goalPlanDraft.remindersEnabled), whyItMatters: state.goalPlanDraft.whyItMatters || "" } : null,
      activeGoalId: state.activeGoalId,
      goalDetailView: state.goalDetailView,
      goalBarrierDraft: state.goalBarrierDraft,
      goalSupportDraft: state.goalSupportDraft,
      goalNotice: state.goalNotice,
      goalHistory: (state.goalHistory || []).map(item => ({ id: item.id, goalId: item.goalId, type: item.type, details: item.details || {}, occurredAt: item.occurredAt, actor: item.actor }))
    });
    // Appointments persist through the same explicit whitelist as everything else: the two
    // serializers are the field list, kept next to the record they describe. appointmentFlow is
    // deliberately absent — it is transient view routing, and restoring it would drop a patient
    // back into a half-finished scheduling step they did not ask to resume.
    Object.assign(safe, {
      appointments: (state.appointments || []).map(serializeAppointmentForDraft),
      appointmentDraft: state.appointmentDraft ? serializeAppointmentDraft(state.appointmentDraft) : null,
      activeAppointmentId: state.activeAppointmentId || ""
    });
    Object.assign(safe, {
      patientAddedCareTeamMembers: (state.patientAddedCareTeamMembers || []).map(member => ({
        id: member.id,
        displayName: member.displayName,
        professionalType: member.professionalType,
        specialty: member.specialty || "",
        practiceName: member.practiceName || "",
        source: member.source,
        verified: false,
        createdAt: member.createdAt
      }))
    });
    Object.assign(safe, {
      supportRole: state.supportRole,
      careCircleStatus: state.careCircleStatus,
      careCircleContext: state.careCircleContext,
      supportPersonName: state.supportPersonName,
      supportPersonPhone: state.supportPersonPhone,
      supportPersonRelationship: state.supportPersonRelationship,
      supportPersonRelationshipOther: state.supportPersonRelationshipOther,
      supportInviteId: state.supportInviteId,
      supportInviteToken: state.supportInviteToken,
      supportInviteStatus: state.supportInviteStatus,
      supportInviteSentAt: state.supportInviteSentAt,
      supportInviteAcceptedAt: state.supportInviteAcceptedAt,
      careCirclePermissions: state.careCirclePermissions,
      careCirclePromptDismissedAt: state.careCirclePromptDismissedAt,
      accessShares: (state.accessShares || []).map(({ shareId, source, channel, createdAt, clicked, landingStarted, eligibilityStarted, enrollmentStarted, enrollmentCompleted, publicAccessLandingUrl }) => ({ shareId, source, channel, createdAt, clicked, landingStarted, eligibilityStarted, enrollmentStarted, enrollmentCompleted, publicAccessLandingUrl })),
      shareAccessPromptDismissedAt: state.shareAccessPromptDismissedAt
    });
    localStorage.setItem(this.key, JSON.stringify(safe));
  }
  clear() { localStorage.removeItem(this.key); }
}

export function audit(state, type, outcome = "success", details = {}) { state.audit.push({ id: tx("event"), offerId: state.offer?.id, sessionId: state.sessionId, eventType: type, occurredAt: new Date().toISOString(), actorType: state.completionRole === "personalRepresentative" || state.role === "representative" ? "representative" : state.completionRole === "helper" || state.role === "helper" ? "helper" : "patient", language: state.language, outcome, details }); }
