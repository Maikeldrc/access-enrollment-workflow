const CARE_CIRCLE_KEY = "itera.care-circle.prototype.v1";
const ACCESS_SHARE_KEY = "itera.access-share.prototype.v1";
const GROWTH_PREFERENCES_KEY = "itera.growth.preferences.v1";
export const GROWTH_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const clone = value => JSON.parse(JSON.stringify(value));
const safeParse = (value, fallback) => { try { return JSON.parse(value || "") || fallback; } catch { return fallback; } };
const randomId = prefix => `${prefix}-${(globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).replaceAll("-", "").slice(0, 12).toUpperCase()}`;
const digits = value => String(value || "").replace(/\D/g, "").slice(0, 10);

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

  createSupportInvite({ inviterPatientId, patientFirstName, supportPersonName, phone, relationship = "", sessionId, origin }) {
    const inviteId = randomId("CARE");
    const token = randomId("SUPPORT");
    const createdAt = new Date().toISOString();
    const invite = {
      inviteId, token, inviterPatientId, patientFirstName: String(patientFirstName || "Patient").slice(0, 40),
      supportPerson: { name: String(supportPersonName || "").trim().slice(0, 80), relationship: String(relationship || "").slice(0, 40), phone: digits(phone) },
      supportRole: "CARE_CIRCLE_MEMBER", completionRole: "PATIENT", status: "SENT", createdAt, sentAt: createdAt, openedAt: null, acceptedAt: null, expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), revokedAt: null, sessionId,
      temporarySupportLink: `${origin}/support/accept?token=${encodeURIComponent(token)}`
    };
    const data = this.readCareCircle();
    data.invites = [...data.invites.filter(item => item.inviteId !== inviteId), invite].slice(-20);
    this.writeCareCircle(data);
    return clone(invite);
  }

  findSupportInvite(token) { return clone(this.readCareCircle().invites.find(invite => invite.token === token) || null); }
  acceptSupportInvite(token) {
    const data = this.readCareCircle();
    const invite = data.invites.find(item => item.token === token);
    if (!invite) return { status: "NOT_FOUND" };
    if (invite.revokedAt) return { status: "REVOKED" };
    if (new Date(invite.expiresAt).getTime() < Date.now()) { invite.status = "EXPIRED"; this.writeCareCircle(data); return clone(invite); }
    invite.status = "ACCEPTED"; invite.openedAt ||= new Date().toISOString(); invite.acceptedAt = new Date().toISOString();
    this.writeCareCircle(data); return clone(invite);
  }

  updateSupportInvite(inviteId, updates) {
    const data = this.readCareCircle();
    const invite = data.invites.find(item => item.inviteId === inviteId);
    if (!invite) return null;
    Object.assign(invite, updates); this.writeCareCircle(data); return clone(invite);
  }
  revokeSupportInvite(inviteId) {
    const revokedAt = new Date().toISOString();
    return this.updateSupportInvite(inviteId, { status: "REVOKED", revokedAt });
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

  allSupportInvites() { return clone(this.readCareCircle().invites); }
  allShares() { return clone(this.readShares().shares); }
}

export const growthPromptAvailable = (dismissedAt, now = Date.now()) => !dismissedAt || now - new Date(dismissedAt).getTime() >= GROWTH_PROMPT_COOLDOWN_MS;
export const maskPhone = phone => { const value = digits(phone); return value.length === 10 ? `(***) ***-${value.slice(-4)}` : ""; };
