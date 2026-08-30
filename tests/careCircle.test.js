import { describe, expect, it } from "vitest";
import { CARE_CIRCLE_AUTHORITY, CARE_CIRCLE_MEMBERSHIP_STATUS, CARE_CIRCLE_PERMISSIONS, CARE_CIRCLE_PERMISSION_LIST, DEFAULT_CARE_CIRCLE_PERMISSIONS, createCareCircleMembership, revokeCareCircleMembership, setCareCirclePermissions, supporterMayAccess, supporterMayActWithAuthority, supporterVisibleCapabilities, verifyCareCircleMembership } from "../src/careCircle.js";

const newMembership = () => createCareCircleMembership({ patientId: "p1", supporterId: "s1", relationship: "child", invitationId: "inv1" });
const activeMembership = () => verifyCareCircleMembership(newMembership());

describe("a membership starts unverified and unprivileged", () => {
  it("is not active until the phone is verified", () => {
    const membership = newMembership();
    expect(membership.status).toBe(CARE_CIRCLE_MEMBERSHIP_STATUS.PENDING_VERIFICATION);
    expect(membership.verifiedAt).toBeNull();
    expect(verifyCareCircleMembership(membership).status).toBe(CARE_CIRCLE_MEMBERSHIP_STATUS.ACTIVE);
  });

  // Least privilege is the empty set, not a friendly-looking subset. A patient who chose nothing
  // shared nothing, and no screen may infer otherwise.
  it("shares nothing by default", () => {
    expect(newMembership().permissions).toEqual([]);
    expect(DEFAULT_CARE_CIRCLE_PERMISSIONS).toEqual([]);
    expect(supporterVisibleCapabilities(activeMembership())).toEqual([]);
  });

  it("gives an unverified member nothing, even with permissions set", () => {
    const granted = setCareCirclePermissions(newMembership(), [CARE_CIRCLE_PERMISSIONS.APPOINTMENT_DETAILS]);
    expect(supporterMayAccess(granted, CARE_CIRCLE_PERMISSIONS.APPOINTMENT_DETAILS)).toBe(false);
  });
});

describe("authority is not a permission", () => {
  // The whole point of the model. A supporter can hold every capability the product offers and
  // still have no standing to consent, sign or decide, because those are not on this list at all.
  it("stays NONE no matter what is granted", () => {
    const everything = setCareCirclePermissions(activeMembership(), CARE_CIRCLE_PERMISSION_LIST);
    expect(everything.authority).toBe(CARE_CIRCLE_AUTHORITY.NONE);
    expect(supporterVisibleCapabilities(everything)).toEqual(CARE_CIRCLE_PERMISSION_LIST);
    expect(supporterMayActWithAuthority()).toBe(false);
  });

  it("offers no permission that names consent, signing or decisions", () => {
    for (const permission of CARE_CIRCLE_PERMISSION_LIST) {
      expect(permission).not.toMatch(/CONSENT|SIGN|DECISION|REPRESENT/i);
    }
  });

  it("has exactly one authority value, so there is nothing to escalate to", () => {
    expect(Object.values(CARE_CIRCLE_AUTHORITY)).toEqual(["NONE"]);
  });
});

describe("access checks", () => {
  const membership = setCareCirclePermissions(activeMembership(), [CARE_CIRCLE_PERMISSIONS.DEVICE_SETUP_SUPPORT]);

  it("allows only what was granted", () => {
    expect(supporterMayAccess(membership, CARE_CIRCLE_PERMISSIONS.DEVICE_SETUP_SUPPORT)).toBe(true);
    expect(supporterMayAccess(membership, CARE_CIRCLE_PERMISSIONS.SELECTED_MEDICATION_INFORMATION)).toBe(false);
  });

  // A supporter helps one patient. A membership must never answer for a different one.
  it("refuses a membership belonging to another patient", () => {
    expect(supporterMayAccess(membership, CARE_CIRCLE_PERMISSIONS.DEVICE_SETUP_SUPPORT, { patientId: "p1" })).toBe(true);
    expect(supporterMayAccess(membership, CARE_CIRCLE_PERMISSIONS.DEVICE_SETUP_SUPPORT, { patientId: "p2" })).toBe(false);
  });

  it("ignores permissions it does not recognize", () => {
    const odd = setCareCirclePermissions(activeMembership(), ["FULL_CHART", CARE_CIRCLE_PERMISSIONS.APPOINTMENT_REMINDERS]);
    expect(odd.permissions).toEqual([CARE_CIRCLE_PERMISSIONS.APPOINTMENT_REMINDERS]);
    expect(supporterMayAccess(odd, "FULL_CHART")).toBe(false);
  });
});

describe("revoking", () => {
  it("ends access immediately and keeps nothing to restore", () => {
    const revoked = revokeCareCircleMembership(setCareCirclePermissions(activeMembership(), CARE_CIRCLE_PERMISSION_LIST));
    expect(revoked.status).toBe(CARE_CIRCLE_MEMBERSHIP_STATUS.REVOKED);
    expect(revoked.permissions).toEqual([]);
    expect(supporterVisibleCapabilities(revoked)).toEqual([]);
  });

  // Re-adding somebody should be a decision the patient makes again, not something a later grant
  // quietly reinstates from what they had before.
  it("cannot be re-permissioned or re-verified back into access", () => {
    const revoked = revokeCareCircleMembership(activeMembership());
    expect(setCareCirclePermissions(revoked, CARE_CIRCLE_PERMISSION_LIST).permissions).toEqual([]);
    expect(verifyCareCircleMembership(revoked).status).toBe(CARE_CIRCLE_MEMBERSHIP_STATUS.REVOKED);
  });
});
