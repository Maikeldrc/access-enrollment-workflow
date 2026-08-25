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
