import { describe, expect, it, vi } from "vitest";
import { AUTHORITY_VERIFICATION_METHODS, DraftStore, MockEnrollmentService } from "../src/services.js";

describe("safe draft persistence", () => {
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
    new DraftStore().save({ scenarioId: "access-happy", screen: "ACCESS_BP_MEASUREMENT", role: "patient", completionRole: "patient", language: "en", identityVerified: true, bpBaselineStatus: "READY_FOR_MEASUREMENT", bpDevicePath: "owned", bpDeviceVerificationStatus: "VERIFIED_COMPATIBLE", bpBaselineSourceType: "VERIFIED_DEVICE", clinicalReportedBloodPressure: { systolic: 145, diastolic: 90 }, accessBaselineBloodPressure: { systolic: 120, diastolic: 80 }, onboarding: {}, audit: [] });
    const savedText = setItem.mock.calls[0][1];
    const saved = JSON.parse(savedText);
    expect(saved).toMatchObject({ bpBaselineStatus: "READY_FOR_MEASUREMENT", bpDevicePath: "owned", bpDeviceVerificationStatus: "VERIFIED_COMPATIBLE", bpBaselineSourceType: "VERIFIED_DEVICE" });
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
