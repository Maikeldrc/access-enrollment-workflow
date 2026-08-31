import { describe, expect, it, vi } from "vitest";
import { AUTHORITY_VERIFICATION_METHODS, DraftStore, MockEnrollmentService } from "../src/services.js";

describe("safe draft persistence", () => {
  it("persists longitudinal patient goals and their history", () => {
    let serialized = "";
    vi.stubGlobal("localStorage", { setItem: vi.fn((_, value) => { serialized = value; }), getItem: vi.fn(() => serialized), removeItem: vi.fn() });
    const store = new DraftStore();
    store.save({ scenarioId: "ccm-happy", screen: "MY_GOALS", role: "patient", completionRole: "patient", language: "en", identityVerified: true, onboarding: {}, audit: [], careGoals: ["stay-active"], patientGoals: [{ id: "goal-1", patientId: "patient-1", goalType: "STAY_ACTIVE", title: "Stay active", customTitle: "", status: "ACTIVE", priority: "PRIMARY", whyItMatters: "Stay active with family", planStatus: "COMPLETED", actions: [{ id: "action-1", goalId: "goal-1", templateId: "short-walk", title: "Take a short walk", actionType: "RECURRING", source: "EMMI_SUGGESTED", frequency: "few-days", targetCount: 3, remindersEnabled: true, status: "ACTIVE", completionHistory: [{ id: "done-1", date: "2026-08-27", completedAt: "2026-08-27T10:00:00.000Z", source: "PATIENT_REPORTED" }] }], progress: [], barriers: [], supportRequests: [], reviews: [], createdBy: "PATIENT", createdAt: "2026-08-27T09:00:00.000Z", updatedAt: "2026-08-27T10:00:00.000Z" }], goalPrimaryId: "goal-1", goalSecondaryId: "", goalPlanningGoalId: "goal-1", goalPlanStatus: "COMPLETED", goalPlanDraft: { actionIds: ["short-walk"], customAction: "", frequency: "few-days", remindersEnabled: true, whyItMatters: "Stay active with family" }, activeGoalId: "goal-1", goalDetailView: "SUMMARY", goalHistory: [{ id: "event-1", goalId: "goal-1", type: "PLAN_SAVED", details: { actionCount: 1 }, occurredAt: "2026-08-27T10:00:00.000Z", actor: "PATIENT" }] });
    const saved = store.load();
    expect(saved.patientGoals[0].actions[0].completionHistory).toHaveLength(1);
    expect(saved.goalHistory[0].type).toBe("PLAN_SAVED");
    expect(saved).not.toHaveProperty("clinicalTarget");
  });

  it("does not persist identity inputs, Medicare IDs, tokens, or clinical readings", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem, getItem: vi.fn(), removeItem: vi.fn() });
    new DraftStore().save({ scenarioId: "access-happy", screen: "DISCLOSURE", role: "patient", language: "en", identityVerified: true, mbi: "1EG4TE5MK73", dob: "05/12/1952", secureToken: "secret", reading: { systolic: 120 }, onboarding: {}, audit: [] });
    const saved = setItem.mock.calls[0][1];
    expect(saved).not.toContain("1EG4TE5MK73");
    expect(saved).not.toContain("05/12/1952");
    expect(saved).not.toContain("secret");
    expect(saved).not.toContain("systolic");
  });

  it("persists representative verification evidence without persisting an OTP", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem, getItem: vi.fn(), removeItem: vi.fn() });
    new DraftStore().save({ scenarioId: "access-happy", screen: "REPRESENTATIVE_AUTHORITY_ATTESTATION", role: "representative", completionRole: "personalRepresentative", representativeFullName: "Maria Roman", representativeRelationship: "child", representativeAuthorityType: "healthCareSurrogate", representativePhone: "3055550123", phoneVerified: true, phoneVerificationMethod: "SMS_OTP", phoneVerifiedAt: "2026-08-24T10:00:00.000Z", representativeAuthorityAttested: true, authorityAttestation: true, authorityAttestedAt: "2026-08-24T10:01:00.000Z", authorityVerificationMethod: "SELF_ATTESTATION", sessionId: "session-test", identityVerified: false, representativeOtp: "123456", onboarding: {}, audit: [] });
    const saved = JSON.parse(setItem.mock.calls[0][1]);
    expect(saved).toMatchObject({ representativeFullName: "Maria Roman", representativeRelationship: "child", representativeAuthorityType: "healthCareSurrogate", representativePhone: "3055550123", phoneVerified: true, phoneVerificationMethod: "SMS_OTP", authorityVerificationMethod: "SELF_ATTESTATION", sessionId: "session-test" });
    expect(JSON.stringify(saved)).not.toContain("123456");
    expect(saved).not.toHaveProperty("representativeOtp");
  });

  it("persists separate ACCESS notice, disclosure, and consent evidence", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem, getItem: vi.fn(), removeItem: vi.fn() });
    new DraftStore().save({ scenarioId: "access-happy", screen: "ACCESS_ALIGNMENT_PROCESSING", role: "patient", completionRole: "patient", language: "en", identityVerified: true, accessNoticeAcknowledgedAt: "2026-08-25T10:00:00.000Z", disclosureAcknowledgedAt: "2026-08-25T10:05:00.000Z", disclosureVersion: "2.1", consentTimestamp: "2026-08-25T10:05:01.000Z", consentVersion: "2.1", consentRole: "PATIENT", onboarding: {}, audit: [] });
    const saved = JSON.parse(setItem.mock.calls[0][1]);
    expect(saved).toMatchObject({ accessNoticeAcknowledgedAt: "2026-08-25T10:00:00.000Z", disclosureAcknowledgedAt: "2026-08-25T10:05:00.000Z", disclosureVersion: "2.1", consentTimestamp: "2026-08-25T10:05:01.000Z", consentVersion: "2.1", consentRole: "PATIENT" });
  });

  it("persists enrollment and baseline lifecycle states independently", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem, getItem: vi.fn(), removeItem: vi.fn() });
    new DraftStore().save({ scenarioId: "access-happy", screen: "ACCESS_BASELINE", role: "patient", completionRole: "patient", language: "en", identityVerified: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED", enrollmentCompletedAt: "2026-08-25T10:00:00.000Z", baselineStatus: "NOT_STARTED", baselineDeferredAt: "2026-08-25T10:05:00.000Z", baselineResumeScreen: "ACCESS_BASELINE", baselineReminderStatus: "PENDING", onboarding: {}, audit: [] });
    const saved = JSON.parse(setItem.mock.calls[0][1]);
    expect(saved).toMatchObject({ enrollmentStatus: "COMPLETED", baselineStatus: "NOT_STARTED", baselineResumeScreen: "ACCESS_BASELINE", baselineReminderStatus: "PENDING" });
  });

  it("persists BP workflow status without persisting manual or verified clinical readings", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem, getItem: vi.fn(), removeItem: vi.fn() });
    new DraftStore().save({ scenarioId: "access-happy", screen: "ACCESS_BP_MEASUREMENT", role: "patient", completionRole: "patient", language: "en", identityVerified: true, bpBaselineStatus: "READY_FOR_MEASUREMENT", bpDevicePath: "owned", bpDeviceVerificationStatus: "SOURCE_VERIFIED", deviceSource: "ITERA_ASSIGNED", deviceVerificationStatus: "SOURCE_VERIFIED", integrationProvider: "TENOVI", assignedDeviceId: "tenovi-bp-8842", last4DeviceId: "8842", patientDeviceConfirmed: true, patientDeviceConfirmedAt: "2026-08-25T13:45:00.000Z", confirmedDeviceId: "tenovi-bp-8842", firstTransmissionVerified: true, firstTransmissionDeviceId: "tenovi-bp-8842", firstTransmissionAt: "2026-08-25T13:50:00.000Z", deviceVendor: "TENOVI", deviceModel: "Tenovi Connected Blood Pressure Monitor", deviceStatus: "active", integrationStatus: "CONNECTED", lastTransmissionAt: "2026-08-25T13:42:00.000Z", bpBaselineSourceType: "VERIFIED_DEVICE", clinicalReportedBloodPressure: { systolic: 145, diastolic: 90 }, accessBaselineBloodPressure: { systolic: 120, diastolic: 80 }, onboarding: {}, audit: [] });
    const savedText = setItem.mock.calls[0][1];
    const saved = JSON.parse(savedText);
    expect(saved).toMatchObject({ bpBaselineStatus: "READY_FOR_MEASUREMENT", bpDevicePath: "owned", bpDeviceVerificationStatus: "SOURCE_VERIFIED", deviceSource: "ITERA_ASSIGNED", deviceVerificationStatus: "SOURCE_VERIFIED", integrationProvider: "TENOVI", assignedDeviceId: "tenovi-bp-8842", last4DeviceId: "8842", patientDeviceConfirmed: true, confirmedDeviceId: "tenovi-bp-8842", firstTransmissionVerified: true, firstTransmissionDeviceId: "tenovi-bp-8842", deviceVendor: "TENOVI", deviceStatus: "active", integrationStatus: "CONNECTED", bpBaselineSourceType: "VERIFIED_DEVICE" });
    expect(savedText).not.toContain("145");
    expect(savedText).not.toContain("systolic");
    expect(saved).not.toHaveProperty("clinicalReportedBloodPressure");
    expect(saved).not.toHaveProperty("accessBaselineBloodPressure");
  });
});

describe("representative mobile verification", () => {
  it("prepares supported authority verification methods without requiring escalation by default", () => {
    expect(AUTHORITY_VERIFICATION_METHODS).toEqual(["SELF_ATTESTATION", "EHR_MATCH", "DOCUMENT", "HUMAN_REVIEW"]);
  });
  it("verifies the representative phone separately and rate-limits resends", async () => {
    const service = new MockEnrollmentService("access-representative");
    const sent = await service.sendRepresentativeOtp("3055550123");
    expect(sent.sent).toBe(true);
    const limited = await service.sendRepresentativeOtp("3055550123");
    expect(limited).toMatchObject({ sent: false, reason: "rate_limited" });
    await expect(service.verifyRepresentativeOtp({ deliveryId: sent.deliveryId, phone: "3055550123", code: "000000" })).resolves.toMatchObject({ verified: false, reason: "invalid" });
    await expect(service.verifyRepresentativeOtp({ deliveryId: sent.deliveryId, phone: "3055550123", code: "123456" })).resolves.toMatchObject({ verified: true });
  });
});

describe("ACCESS assigned device lookup", () => {
  it("resolves active Tenovi and Pylo assignments by patient and device ID", async () => {
    for (const [scenario, vendor] of [["access-happy", "TENOVI"], ["access-bp-pylo", "PYLO"]]) {
      const service = new MockEnrollmentService(scenario);
      const assignment = await service.getActiveDeviceAssignment("patient_demo");
      expect(assignment).toMatchObject({ status: "active", assignment: { patientId: "patient_demo" } });
      const device = await service.getDeviceById(assignment.assignment.assignedDeviceId);
      expect(device).toMatchObject({ status: "active", vendor, integrationStatus: "CONNECTED" });
    }
  });

  it("returns the patient-owned unsupported scenario without inventing an assignment", async () => {
    const service = new MockEnrollmentService("access-bp-incompatible");
    await expect(service.getActiveDeviceAssignment("patient_demo")).resolves.toEqual({ status: "not_found", assignment: null, patientOwnsMonitor: true, deviceSource: "PATIENT_OWNED", deviceVendor: "OTHER", deviceStatus: "ACTIVE", integrationProvider: "OTHER", integrationStatus: "UNSUPPORTED" });
    expect(service.getScenarioDeviceContext()).toMatchObject({ found: false, patientOwnsMonitor: true, deviceSource: "PATIENT_OWNED", assignedDeviceId: null, integrationStatus: "UNSUPPORTED" });
  });

  it("keeps no-monitor and patient-owned monitor states distinct", async () => {
    const noMonitor = new MockEnrollmentService("prototype", { program: "ACCESS", conditions: ["Hypertension"], accessTrack: "eCKM", bpDeviceScenario: "none" });
    const patientOwned = new MockEnrollmentService("prototype", { program: "ACCESS", conditions: ["Hypertension"], accessTrack: "eCKM", bpDeviceScenario: "patient-owned-unsupported" });
    await expect(noMonitor.getActiveDeviceAssignment("patient_demo")).resolves.toMatchObject({ status: "not_found", patientOwnsMonitor: false, deviceSource: "NONE" });
    await expect(patientOwned.getActiveDeviceAssignment("patient_demo")).resolves.toMatchObject({ status: "not_found", patientOwnsMonitor: true, deviceSource: "PATIENT_OWNED", integrationStatus: "UNSUPPORTED" });
  });

  it("stores verified BP observations idempotently by observation ID", async () => {
    const service = new MockEnrollmentService("access-happy");
    const observation = await service.receiveAccessBpReading({ readingNumber: 1, deviceId: "tenovi-bp-8842", deviceModel: "Tenovi Connected Blood Pressure Monitor" });
    await expect(service.recordAccessBpObservation(observation)).resolves.toMatchObject({ stored: true, duplicate: false, observationId: observation.observationId });
    await expect(service.recordAccessBpObservation({ ...observation, systolic: 999 })).resolves.toMatchObject({ stored: false, duplicate: true, observationId: observation.observationId });
    expect(service.getStoredAccessBpObservations({ deviceId: "tenovi-bp-8842" })).toEqual([expect.objectContaining({ observationId: observation.observationId, systolic: observation.systolic, diastolic: observation.diastolic, deviceId: "tenovi-bp-8842", sourceVerified: true })]);
  });

  it("validates cuff selection against the configured device and available inventory", async () => {
    const service = new MockEnrollmentService("access-happy");
    await expect(service.createBpDeviceFulfillment({ shippingAddress: { zip: "33176" }, armMeasurementStatus: "NOT_REQUIRED", cuffSelectionMethod: "PATIENT_SELECTED", selectedCuffOption: "TENOVI_WIDE", cuffSelectionStatus: "SELECTED", deviceModelSelected: "TENOVI_BPM_GEN3" })).resolves.toMatchObject({ status: "requested", cuffSelectionStatus: "SELECTED", selectedCuffOption: "TENOVI_WIDE", deviceModelSelected: "TENOVI_BPM_GEN3" });
    await expect(service.createBpDeviceFulfillment({ shippingAddress: { zip: "33176" }, armMeasurementStatus: "NOT_REQUIRED", cuffSelectionMethod: "PATIENT_SELECTED", selectedCuffOption: "PYLO_XL", cuffSelectionStatus: "SELECTED", deviceModelSelected: "TENOVI_BPM_GEN3" })).resolves.toMatchObject({ status: "requested", cuffSelectionStatus: "CARE_TEAM_REVIEW_REQUIRED", selectedCuffOption: null, deviceModelSelected: "TENOVI_BPM_GEN3" });
  });
});

describe("ACCESS eligibility service", () => {
  it("reports real process phases and deduplicates an in-flight idempotent request", async () => {
    const service = new MockEnrollmentService("access-happy");
    const phases = [];
    const first = service.checkAccessEligibility({ idempotencyKey: "eligibility-1", onProgress: phase => phases.push(phase) });
    const duplicate = service.checkAccessEligibility({ idempotencyKey: "eligibility-1", onProgress: () => phases.push("duplicate") });
    const [firstResult, duplicateResult] = await Promise.all([first, duplicate]);
    expect(firstResult.transactionId).toBe(duplicateResult.transactionId);
    expect(phases).toEqual(["verifyingCoverage", "checkingEnrollment", "confirmingOption"]);
  });

  it("allows a failed temporary check to be retried without exposing technical details", async () => {
    const service = new MockEnrollmentService("access-check-failure");
    await expect(service.checkAccessEligibility({ idempotencyKey: "eligibility-retry" })).rejects.toThrow();
    await expect(service.checkAccessEligibility({ idempotencyKey: "eligibility-retry" })).rejects.toThrow();
  });
});
