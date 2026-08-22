import { createOffer } from "./config.js";

const wait = (ms = 650) => new Promise(resolve => setTimeout(resolve, ms));
const tx = prefix => `${prefix}_${Date.now().toString(36)}`;

export class MockEnrollmentService {
  constructor(scenarioId) { this.scenarioId = scenarioId; }
  async getOffer() { await wait(350); const offer = createOffer(this.scenarioId); if (offer.fixture.tokenState) throw new Error(offer.fixture.tokenState); return offer; }
  async verifyIdentity(input) { await wait(); return createOffer(this.scenarioId).fixture.identityFailure || input.zip !== "33176" ? { verified: false, remainingAttempts: 2 } : { verified: true, verificationId: tx("verify") }; }
  async saveAcknowledgement() { await wait(250); return { saved: true }; }
  async checkAccessEligibility() { await wait(1200); return { outcome: createOffer(this.scenarioId).fixture.accessOutcome || "eligible", transactionId: tx("elig") }; }
  async saveConsent() { await wait(700); return { confirmed: true, consentId: tx("consent") }; }
  async createTraditionalEnrollment() { await wait(1200); return { status: "confirmed", enrollmentId: tx("enroll"), effectiveDate: "August 21, 2026" }; }
  async submitAccessAlignment() { await wait(1400); return { status: "confirmed", alignmentId: tx("align"), effectiveDate: "August 21, 2026" }; }
  async saveOnboarding() { await wait(350); return { saved: true }; }
  async submitFirstReading() { await wait(1300); return createOffer(this.scenarioId).fixture.firstReading === "failed" ? { status: "failed", reason: "not_received" } : { status: "received", systolic: 120, diastolic: 80, receivedAt: new Date().toISOString() }; }
}

export class DraftStore {
  constructor(key = "itera.enrollment.safe-draft.v2") { this.key = key; }
  load() { try { return JSON.parse(localStorage.getItem(this.key) || "null"); } catch { return null; } }
  save(state) {
    if (!state.identityVerified) return;
    const safe = { scenarioId: state.scenarioId, screen: state.screen, role: state.role, language: state.language, identityVerified: true, consentSaved: state.consentSaved, enrollmentConfirmed: state.enrollmentConfirmed, accessEligible: state.accessEligible, alignmentConfirmed: state.alignmentConfirmed, devicePath: state.devicePath, addressConfirmed: state.addressConfirmed, setupComplete: state.setupComplete, readingReceived: state.readingReceived, onboarding: state.onboarding, updatedAt: new Date().toISOString() };
    localStorage.setItem(this.key, JSON.stringify(safe));
  }
  clear() { localStorage.removeItem(this.key); }
}

export function audit(state, type, outcome = "success") { state.audit.push({ id: tx("event"), offerId: state.offer?.id, eventType: type, occurredAt: new Date().toISOString(), actorType: state.role === "representative" ? "representative" : state.role === "helper" ? "helper" : "patient", language: state.language, outcome }); }
