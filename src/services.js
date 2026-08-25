import { createOffer, createPrototypeOffer } from "./config.js";

const wait = (ms = 650) => new Promise(resolve => setTimeout(resolve, ms));
const tx = prefix => `${prefix}_${Date.now().toString(36)}`;
export const AUTHORITY_VERIFICATION_METHODS = Object.freeze(["SELF_ATTESTATION", "EHR_MATCH", "DOCUMENT", "HUMAN_REVIEW"]);

export class MockEnrollmentService {
  constructor(scenarioId, prototypeConfig = null) { this.scenarioId = scenarioId; this.prototypeConfig = prototypeConfig; this.eligibilityRequests = new Map(); this.representativeOtp = null; this.lastRepresentativeOtpSentAt = 0; }
  offer() { return this.prototypeConfig ? createPrototypeOffer(this.prototypeConfig) : createOffer(this.scenarioId); }
  async getOffer() { await wait(350); const offer = this.offer(); if (offer.fixture.tokenState) throw new Error(offer.fixture.tokenState); return offer; }
  async verifyIdentity(input) { await wait(); return this.offer().fixture.identityFailure || input.zip !== "33176" ? { verified: false, remainingAttempts: 2 } : { verified: true, verificationId: tx("verify") }; }
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
}

export class DraftStore {
  constructor(key = "itera.enrollment.safe-draft.v2") { this.key = key; }
  load() { try { return JSON.parse(localStorage.getItem(this.key) || "null"); } catch { return null; } }
  save(state) {
    const representativeInProgress = state.completionRole === "personalRepresentative" && Boolean(state.representativeFullName);
    if (!state.identityVerified && !representativeInProgress) return;
    const safe = { scenarioId: state.scenarioId, screen: state.screen, role: state.role, completionRole: state.completionRole, representativeFullName: state.representativeFullName, representativeRelationship: state.representativeRelationship, representativeAuthorityType: state.representativeAuthorityType, representativePhone: state.representativePhone, phoneVerified: state.phoneVerified, phoneVerificationMethod: state.phoneVerificationMethod, phoneVerifiedAt: state.phoneVerifiedAt, representativeAuthorityAttested: state.representativeAuthorityAttested, authorityAttestation: state.authorityAttestation, authorityAttestedAt: state.authorityAttestedAt, authorityVerificationMethod: state.authorityVerificationMethod, authorityAdditionalVerificationRequired: Boolean(state.authorityAdditionalVerificationRequired), consentRole: state.consentRole, consentVersion: state.consentVersion, consentTimestamp: state.consentTimestamp, sessionId: state.sessionId, sessionMetadata: state.sessionMetadata, ipMetadata: state.ipMetadata ?? null, audit: state.audit, language: state.language, identityVerified: Boolean(state.identityVerified), consentSaved: state.consentSaved, enrollmentConfirmed: state.enrollmentConfirmed, accessEligible: state.accessEligible, accessOutcome: state.accessOutcome, eligibilityPhase: state.eligibilityPhase, eligibilityError: state.eligibilityError, eligibilityRequestKey: state.eligibilityRequestKey, alignmentConfirmed: state.alignmentConfirmed, devicePath: state.devicePath, addressConfirmed: state.addressConfirmed, setupComplete: state.setupComplete, readingReceived: state.readingReceived, onboarding: state.onboarding, updatedAt: new Date().toISOString() };
    localStorage.setItem(this.key, JSON.stringify(safe));
  }
  clear() { localStorage.removeItem(this.key); }
}

export function audit(state, type, outcome = "success", details = {}) { state.audit.push({ id: tx("event"), offerId: state.offer?.id, sessionId: state.sessionId, eventType: type, occurredAt: new Date().toISOString(), actorType: state.completionRole === "personalRepresentative" || state.role === "representative" ? "representative" : state.completionRole === "helper" || state.role === "helper" ? "helper" : "patient", language: state.language, outcome, details }); }
