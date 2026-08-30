import { describe, expect, it } from "vitest";
import { GROWTH_PROMPT_COOLDOWN_MS, RESEND_COOLDOWN_MS, GrowthStore, growthPromptAvailable } from "../src/growth.js";

const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
};

describe("Care Circle prototype storage", () => {
  it("creates a scoped temporary link without patient identifiers and preserves the patient decision role", () => {
    const store = new GrowthStore(memoryStorage());
    const invite = store.createSupportInvite({ inviterPatientId: "DEMO-P001", patientFirstName: "Robert", supportPersonName: "Angela Demo", phone: "305-555-0199", relationship: "Child", sessionId: "session-demo", origin: "https://example.test" });
    expect(invite.status).toBe("PENDING");
    expect(invite.supportRole).toBe("CARE_CIRCLE_MEMBER");
    expect(invite.completionRole).toBe("PATIENT");
    expect(invite.temporarySupportLink).not.toContain("DEMO-P001");
    expect(invite.temporarySupportLink).not.toContain("Robert");
    expect(invite.temporarySupportLink).toContain("/care-circle/invite/");
    expect(invite.permissionScope).toBe("CARE_CIRCLE_BASIC_SUPPORT");
    expect(store.acceptSupportInvite(invite.token).status).toBe("ACCEPTED");
    expect(store.revokeSupportInvite(invite.inviteId).status).toBe("CANCELED");
    expect(store.acceptSupportInvite(invite.token).status).toBe("CANCELED");
  });

  it("guards resends and supports removal without changing the invitation scope", () => {
    const store = new GrowthStore(memoryStorage());
    const invite = store.createSupportInvite({ inviterPatientId: "DEMO-P001", supportPersonName: "Angela", phone: "3055550199", context: "ONGOING_CARE", origin: "https://example.test" });
    expect(store.resendSupportInvite(invite.inviteId).status).toBe("COOLDOWN");
    const resent = store.resendSupportInvite(invite.inviteId, Date.now() + RESEND_COOLDOWN_MS + 1);
    expect(resent.status).toBe("PENDING");
    expect(resent.sendCount).toBe(2);
    expect(store.removeCareCircleMember(invite.inviteId).status).toBe("CANCELED");
  });

  it("resolves expired invitations without exposing a new state to the patient", () => {
    const store = new GrowthStore(memoryStorage());
    const invite = store.createSupportInvite({ inviterPatientId: "DEMO-P001", supportPersonName: "Angela", phone: "3055550199", origin: "https://example.test" });
    store.updateSupportInvite(invite.inviteId, { expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(store.findSupportInvite(invite.token).status).toBe("EXPIRED");
    expect(store.acceptSupportInvite(invite.token).status).toBe("EXPIRED");
  });
});

describe("Share ACCESS prototype attribution", () => {
  it("creates a public information link without patient or enrollment state", () => {
    const store = new GrowthStore(memoryStorage());
    const share = store.createAccessShare({ channel: "COPY_LINK", origin: "https://example.test" });
    expect(share.source).toBe("ENROLLED_PATIENT");
    expect(share.publicAccessLandingUrl).toContain("/access/learn?source=patient-share&shareId=");
    expect(JSON.stringify(share)).not.toContain("patientId");
    expect(JSON.stringify(share)).not.toContain("eligibilityStatus");
  });

  it("respects the seven-day dismissal cooldown", () => {
    const now = Date.now();
    expect(growthPromptAvailable(new Date(now - GROWTH_PROMPT_COOLDOWN_MS + 1).toISOString(), now)).toBe(false);
    expect(growthPromptAvailable(new Date(now - GROWTH_PROMPT_COOLDOWN_MS).toISOString(), now)).toBe(true);
  });
});

describe("Care Circle acceptance requires the phone, not just the link", () => {
  const seed = () => {
    const store = new GrowthStore(memoryStorage());
    const invite = store.createSupportInvite({ inviterPatientId: "P1", patientFirstName: "Margaret", supportPersonName: "Ana Rodriguez", phone: "305-555-0199", relationship: "child", sessionId: "s1", origin: "https://example.test" });
    return { store, invite };
  };

  // Opening a link proves somebody opened a link. Until the code sent to the patient's named number
  // comes back, nobody has joined anything.
  it("creates a membership that can do nothing until the code is entered", () => {
    const { store, invite } = seed();
    const accepted = store.acceptSupportInvite(invite.token);
    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.membership.status).toBe("PENDING_VERIFICATION");
    expect(accepted.membership.permissions).toEqual([]);
    expect(accepted.membership.authority).toBe("NONE");
    // The patient does not see "Active" while this is true.
    expect(store.careCircleMemberStatus(store.findSupportInvite(invite.token))).toBe("PENDING_VERIFICATION");
  });

  it("activates only on the right code, and counts the wrong ones", () => {
    const { store, invite } = seed();
    store.acceptSupportInvite(invite.token);
    const wrong = store.verifySupportOtp(invite.token, "000000");
    expect(wrong).toMatchObject({ verified: false, reason: "mismatch", attemptsRemaining: 4 });
    expect(store.supportMembership(invite.token).status).toBe("PENDING_VERIFICATION");

    const right = store.verifySupportOtp(invite.token, "123456");
    expect(right.verified).toBe(true);
    expect(right.membership).toMatchObject({ status: "ACTIVE", authority: "NONE", permissions: [] });
  });

  it("declines without leaving a membership behind", () => {
    const { store, invite } = seed();
    const declined = store.declineSupportInvite(invite.token);
    expect(declined.status).toBe("DECLINED");
    expect(declined.membership).toBeUndefined();
    expect(store.supportMembership(invite.token)).toBeNull();
  });

  // A removed member whose membership stayed ACTIVE is precisely the stale grant a later request
  // would be checked against.
  it("revokes the membership when the patient removes the member", () => {
    const { store, invite } = seed();
    store.acceptSupportInvite(invite.token);
    store.verifySupportOtp(invite.token, "123456");
    store.removeCareCircleMember(invite.inviteId);
    expect(store.supportMembership(invite.token)).toMatchObject({ status: "REVOKED", permissions: [] });
    expect(store.careCircleMemberStatus(store.findSupportInvite(invite.token))).toBe("REMOVED");
  });
});
