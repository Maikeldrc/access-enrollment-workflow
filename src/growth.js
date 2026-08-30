import { CARE_CIRCLE_MEMBERSHIP_STATUS, createCareCircleMembership, revokeCareCircleMembership, verifyCareCircleMembership } from "./careCircle.js";

// PROTOTYPE BOUNDARY. Every record below lives in this browser's localStorage, which the person
// sitting in front of it can read and rewrite. Nothing here is an authorization: a real deployment
// must re-check membership, verification and every permission on a server before showing a
// supporter anything. What this file provides is the shape that server would enforce, and a
// faithful demonstration of the flow — not the enforcement itself.
const CARE_CIRCLE_KEY = "itera.care-circle.prototype.v1";
// The same fixed code the representative verification uses, for the same reason: there is no SMS
// gateway in a prototype, and a random code nobody can receive would make the flow undemonstrable.
const PROTOTYPE_OTP_CODE = "123456";
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const ACCESS_SHARE_KEY = "itera.access-share.prototype.v1";
const GROWTH_PREFERENCES_KEY = "itera.growth.preferences.v1";
export const GROWTH_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const clone = value => JSON.parse(JSON.stringify(value));
const safeParse = (value, fallback) => { try { return JSON.parse(value || "") || fallback; } catch { return fallback; } };
const randomId = prefix => `${prefix}-${(globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).replaceAll("-", "").slice(0, 12).toUpperCase()}`;
const digits = value => String(value || "").replace(/\D/g, "").slice(0, 10);
const RESEND_COOLDOWN_MS = 60 * 1000;
const currentStatus = invite => {
  if (["SENT", "OPENED"].includes(invite.status)) return "PENDING";
  if (invite.status === "REVOKED") return "CANCELED";
  if (invite.status === "PENDING" && new Date(invite.expiresAt).getTime() < Date.now()) return "EXPIRED";
  return invite.status;
};

export class GrowthStore {
  constructor(storage = globalThis.localStorage) { this.storage = storage; }
  readCareCircle() { return safeParse(this.storage?.getItem(CARE_CIRCLE_KEY), { invites: [] }); }
  writeCareCircle(value) { this.storage?.setItem(CARE_CIRCLE_KEY, JSON.stringify(value)); }
  readShares() { return safeParse(this.storage?.getItem(ACCESS_SHARE_KEY), { shares: [] }); }
  writeShares(value) { this.storage?.setItem(ACCESS_SHARE_KEY, JSON.stringify(value)); }
  readPromptPreferences() { return safeParse(this.storage?.getItem(GROWTH_PREFERENCES_KEY), { careCirclePromptDismissedAt: "", shareAccessPromptDismissedAt: "" }); }
  dismissPrompt(type) {
    const preferences = this.readPromptPreferences();
    const field = type === "share-access" ? "shareAccessPromptDismissedAt" : "careCirclePromptDismissedAt";
    preferences[field] = new Date().toISOString();
    this.storage?.setItem(GROWTH_PREFERENCES_KEY, JSON.stringify(preferences));
    return clone(preferences);
  }

  createSupportInvite({ inviterPatientId, patientFirstName, supportPersonName, phone, relationship = "", relationshipOther = "", context = "ENROLLMENT", sessionId, origin }) {
    const inviteId = randomId("CARE");
    const token = randomId("SUPPORT");
    const createdAt = new Date().toISOString();
    const invite = {
      inviteId, token, inviterPatientId, patientFirstName: String(patientFirstName || "Patient").slice(0, 40),
      supportPerson: { name: String(supportPersonName || "").trim().slice(0, 80), relationship: String(relationship || "").slice(0, 40), relationshipOther: String(relationshipOther || "").trim().slice(0, 60), phone: digits(phone) },
      supportRole: "CARE_CIRCLE_MEMBER", completionRole: "PATIENT", permissionScope: "CARE_CIRCLE_BASIC_SUPPORT", context, status: "PENDING", createdAt, sentAt: createdAt, lastSentAt: createdAt, sendCount: 1, openedAt: null, acceptedAt: null, expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), canceledAt: null, removedAt: null, sessionId,
      temporarySupportLink: `${origin}/care-circle/invite/${encodeURIComponent(token)}`
    };
    const data = this.readCareCircle();
    data.invites = [...data.invites.filter(item => item.inviteId !== inviteId), invite].slice(-20);
    this.writeCareCircle(data);
    return clone(invite);
  }

  findSupportInvite(token) {
    const invite = this.readCareCircle().invites.find(item => item.token === token) || null;
    if (!invite) return null;
    invite.status = currentStatus(invite);
    return clone(invite);
  }
  // Accepting is not joining. It records the answer and creates a membership that cannot do
  // anything yet, then sends a code to the number the patient named. Opening a link proves someone
  // opened a link; only the code is evidence they hold that phone.
  acceptSupportInvite(token) {
    const data = this.readCareCircle();
    const invite = data.invites.find(item => item.token === token);
    if (!invite) return { status: "NOT_FOUND" };
    if (invite.canceledAt || invite.revokedAt || invite.removedAt) return { status: "CANCELED" };
    if (new Date(invite.expiresAt).getTime() < Date.now()) { invite.status = "EXPIRED"; this.writeCareCircle(data); return clone(invite); }
    const now = new Date().toISOString();
    invite.status = "ACCEPTED"; invite.openedAt ||= now; invite.acceptedAt = now;
    invite.membership ||= createCareCircleMembership({
      patientId: invite.inviterPatientId, supporterId: invite.inviteId,
      relationship: invite.supportPerson?.relationship || "", invitationId: invite.inviteId, invitedBy: "PATIENT", acceptedAt: now
    });
    this.issueOtp(invite);
    this.writeCareCircle(data); return clone(invite);
  }

  declineSupportInvite(token) {
    const data = this.readCareCircle();
    const invite = data.invites.find(item => item.token === token);
    if (!invite) return { status: "NOT_FOUND" };
    invite.status = "DECLINED"; invite.declinedAt = new Date().toISOString();
    // A declined invitation has no membership to leave behind.
    delete invite.membership; delete invite.otp;
    this.writeCareCircle(data); return clone(invite);
  }

  issueOtp(invite) {
    const now = Date.now();
    if (invite.otp && now - new Date(invite.otp.sentAt).getTime() < RESEND_COOLDOWN_MS) return invite.otp;
    invite.otp = { deliveryId: randomId("OTP"), code: PROTOTYPE_OTP_CODE, sentAt: new Date(now).toISOString(), expiresAt: new Date(now + OTP_TTL_MS).toISOString(), attempts: 0 };
    return invite.otp;
  }

  resendSupportOtp(token) {
    const data = this.readCareCircle();
    const invite = data.invites.find(item => item.token === token);
    if (!invite || invite.status !== "ACCEPTED") return { sent: false, reason: "not_acceptable" };
    const before = invite.otp?.deliveryId;
    const otp = this.issueOtp(invite);
    this.writeCareCircle(data);
    return { sent: otp.deliveryId !== before, deliveryId: otp.deliveryId };
  }

  // The only thing that activates a membership. It refuses an expired code, counts attempts, and
  // never widens permissions: proving you hold a phone says nothing about what was shared with you.
  verifySupportOtp(token, code) {
    const data = this.readCareCircle();
    const invite = data.invites.find(item => item.token === token);
    if (!invite?.otp || !invite.membership) return { verified: false, reason: "not_found" };
    if (new Date(invite.otp.expiresAt).getTime() < Date.now()) return { verified: false, reason: "expired" };
    if (invite.otp.attempts >= OTP_MAX_ATTEMPTS) return { verified: false, reason: "locked" };
    if (String(code || "").trim() !== invite.otp.code) {
      invite.otp.attempts += 1; this.writeCareCircle(data);
      return { verified: false, reason: "mismatch", attemptsRemaining: Math.max(0, OTP_MAX_ATTEMPTS - invite.otp.attempts) };
    }
    invite.membership = verifyCareCircleMembership(invite.membership);
    invite.phoneVerifiedAt = invite.membership.verifiedAt;
    delete invite.otp;
    this.writeCareCircle(data);
    return { verified: true, membership: clone(invite.membership) };
  }

  supportMembership(token) {
    const invite = this.readCareCircle().invites.find(item => item.token === token);
    return invite?.membership ? clone(invite.membership) : null;
  }

  updateSupportInvite(inviteId, updates) {
    const data = this.readCareCircle();
    const invite = data.invites.find(item => item.inviteId === inviteId);
    if (!invite) return null;
    Object.assign(invite, updates); this.writeCareCircle(data); return clone(invite);
  }
  revokeSupportInvite(inviteId) {
    const canceledAt = new Date().toISOString();
    return this.updateSupportInvite(inviteId, { status: "CANCELED", canceledAt });
  }

  resendSupportInvite(inviteId, now = Date.now()) {
    const data = this.readCareCircle();
    const invite = data.invites.find(item => item.inviteId === inviteId);
    if (!invite) return { status: "NOT_FOUND" };
    const status = currentStatus(invite);
    if (status !== "PENDING") return { status: "NOT_PENDING" };
    const lastSent = new Date(invite.lastSentAt || invite.sentAt || 0).getTime();
    if (now - lastSent < RESEND_COOLDOWN_MS) return { status: "COOLDOWN", retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - (now - lastSent)) / 1000) };
    invite.status = "PENDING";
    invite.lastSentAt = new Date(now).toISOString();
    invite.sentAt = invite.lastSentAt;
    invite.sendCount = Number(invite.sendCount || 1) + 1;
    this.writeCareCircle(data);
    return clone(invite);
  }

  // Removing someone revokes the membership as well as closing the invitation. Leaving an ACTIVE
  // membership attached to a "removed" invitation is exactly the stale grant a supporter's next
  // request would be checked against.
  removeCareCircleMember(inviteId) {
    const removedAt = new Date().toISOString();
    const data = this.readCareCircle();
    const invite = data.invites.find(item => item.inviteId === inviteId);
    if (invite?.membership) { invite.membership = revokeCareCircleMembership(invite.membership, { revokedAt: removedAt }); this.writeCareCircle(data); }
    return this.updateSupportInvite(inviteId, { status: "CANCELED", removedAt });
  }

  // Patient-facing status. ACCEPTED is not ACTIVE: the supporter answered, but until the code comes
  // back the patient should see that it is still waiting rather than that somebody has access.
  careCircleMemberStatus(invite) {
    if (!invite) return "EXPIRED";
    // Derived, not stored: the record keeps its existing CANCELED contract, and the difference
    // between an invitation the patient cancelled and a member they removed is the removedAt stamp
    // the record already carried.
    if (invite.removedAt) return "REMOVED";
    const status = currentStatus(invite);
    if (status !== "ACCEPTED") return status;
    return invite.membership?.status === CARE_CIRCLE_MEMBERSHIP_STATUS.ACTIVE ? "ACTIVE" : "PENDING_VERIFICATION";
  }

  createAccessShare({ channel, origin }) {
    const shareId = randomId("ACCESS-SHARE");
    const createdAt = new Date().toISOString();
    const share = { shareId, source: "ENROLLED_PATIENT", channel, createdAt, clicked: false, landingStarted: false, eligibilityStarted: false, enrollmentStarted: false, enrollmentCompleted: false, publicAccessLandingUrl: `${origin}/access/learn?source=patient-share&shareId=${encodeURIComponent(shareId)}` };
    const data = this.readShares(); data.shares = [...data.shares, share].slice(-30); this.writeShares(data); return clone(share);
  }

  updateAccessShare(shareId, updates) {
    const data = this.readShares(); const share = data.shares.find(item => item.shareId === shareId);
    if (!share) return null;
    Object.assign(share, updates); this.writeShares(data); return clone(share);
  }

  allSupportInvites() { return clone(this.readCareCircle().invites.map(invite => ({ ...invite, status: currentStatus(invite) }))); }
  allShares() { return clone(this.readShares().shares); }
}

export const growthPromptAvailable = (dismissedAt, now = Date.now()) => !dismissedAt || now - new Date(dismissedAt).getTime() >= GROWTH_PROMPT_COOLDOWN_MS;
export const maskPhone = phone => { const value = digits(phone); return value.length === 10 ? `(***) ***-${value.slice(-4)}` : ""; };
export { RESEND_COOLDOWN_MS };
