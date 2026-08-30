// Care Circle — the support model, and the line it must never cross.
//
// A Care Circle member is someone the patient trusts, not someone the law recognizes. Three
// relationships exist in this product and collapsing any two of them is the failure this file is
// written to prevent:
//
//   CARE TEAM               verified clinicians. Not this.
//   PERSONAL REPRESENTATIVE legal authority to consent and sign. Has its own verification. Not this.
//   CARE CIRCLE             a trusted person helping with what the patient explicitly shared.
//
// Membership therefore carries `authority: NONE` and there is no code path in this module that
// changes it. Granting a supporter every permission in the catalogue still leaves them unable to
// consent, sign, or decide, because those are not permissions — they are authority, and authority
// is not something this model can grant.

export const CARE_CIRCLE_AUTHORITY = Object.freeze({ NONE: "NONE" });

// One capability per row, each naming something the product can actually do. A permission that
// does not map to a real capability is a promise to the patient that nothing keeps.
export const CARE_CIRCLE_PERMISSIONS = Object.freeze({
  APPOINTMENT_REMINDERS: "APPOINTMENT_REMINDERS",
  APPOINTMENT_DETAILS: "APPOINTMENT_DETAILS",
  CARE_TASK_REMINDERS: "CARE_TASK_REMINDERS",
  DEVICE_SETUP_SUPPORT: "DEVICE_SETUP_SUPPORT",
  TRANSPORTATION_SUPPORT: "TRANSPORTATION_SUPPORT",
  LIMITED_PROGRESS_UPDATES: "LIMITED_PROGRESS_UPDATES",
  SELECTED_HEALTH_READINGS: "SELECTED_HEALTH_READINGS",
  SELECTED_MEDICATION_INFORMATION: "SELECTED_MEDICATION_INFORMATION"
});

export const CARE_CIRCLE_PERMISSION_LIST = Object.freeze(Object.keys(CARE_CIRCLE_PERMISSIONS));

// Least privilege means the empty set. Not "the harmless ones", not "the obvious ones" — a patient
// who has chosen nothing has shared nothing, and every screen downstream reads from this rather
// than assuming a default anybody would have guessed.
export const DEFAULT_CARE_CIRCLE_PERMISSIONS = Object.freeze([]);

// Health readings and medication information are the two rows that expose clinical data. They are
// listed so a patient can deliberately share them, and separated here so a UI can present them
// apart from the logistics rows rather than in one undifferentiated list of toggles.
export const CLINICAL_CARE_CIRCLE_PERMISSIONS = Object.freeze([
  CARE_CIRCLE_PERMISSIONS.SELECTED_HEALTH_READINGS,
  CARE_CIRCLE_PERMISSIONS.SELECTED_MEDICATION_INFORMATION
]);

export const CARE_CIRCLE_MEMBERSHIP_STATUS = Object.freeze({
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  ACTIVE: "ACTIVE",
  REVOKED: "REVOKED"
});

const normalizePermissions = permissions =>
  Object.freeze([...new Set((Array.isArray(permissions) ? permissions : []).filter(name => CARE_CIRCLE_PERMISSION_LIST.includes(name)))]);

// Accepting an invitation is not joining. The supporter has proved they opened a link, which is
// only evidence that they hold the phone the patient named once the code sent to it comes back.
// A membership therefore starts PENDING_VERIFICATION and cannot be created ACTIVE.
export function createCareCircleMembership({ patientId, supporterId, relationship = "", invitedBy = "PATIENT", invitationId = "", acceptedAt = new Date().toISOString() }) {
  return {
    membershipId: `ccm_${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    patientId,
    supporterId,
    relationship,
    invitationId,
    invitedBy,
    status: CARE_CIRCLE_MEMBERSHIP_STATUS.PENDING_VERIFICATION,
    // Never derived, never widened. See the header.
    authority: CARE_CIRCLE_AUTHORITY.NONE,
    permissions: DEFAULT_CARE_CIRCLE_PERMISSIONS,
    acceptedAt,
    verifiedAt: null,
    revokedAt: null
  };
}

// Verification is the only thing that activates a membership, and it does not touch permissions:
// proving you hold a phone says nothing about what the patient wants to share with you.
export function verifyCareCircleMembership(membership, { verifiedAt = new Date().toISOString() } = {}) {
  if (!membership || membership.status === CARE_CIRCLE_MEMBERSHIP_STATUS.REVOKED) return membership;
  return { ...membership, status: CARE_CIRCLE_MEMBERSHIP_STATUS.ACTIVE, verifiedAt, authority: CARE_CIRCLE_AUTHORITY.NONE };
}

export function revokeCareCircleMembership(membership, { revokedAt = new Date().toISOString() } = {}) {
  if (!membership) return membership;
  // Permissions are dropped with the membership rather than left behind for a later re-grant to
  // silently restore. Re-adding someone should be a decision, not a recovery.
  return { ...membership, status: CARE_CIRCLE_MEMBERSHIP_STATUS.REVOKED, revokedAt, permissions: DEFAULT_CARE_CIRCLE_PERMISSIONS };
}

export function setCareCirclePermissions(membership, permissions) {
  if (!membership || membership.status === CARE_CIRCLE_MEMBERSHIP_STATUS.REVOKED) return membership;
  return { ...membership, permissions: normalizePermissions(permissions), authority: CARE_CIRCLE_AUTHORITY.NONE };
}

// The single question every supporter-facing surface must ask before showing anything, EMMI
// included. Three conditions, none of them optional: the membership is active, it belongs to this
// patient, and the permission was granted. A revoked member with a stale session fails the first.
export function supporterMayAccess(membership, permission, { patientId = null } = {}) {
  if (!membership || membership.status !== CARE_CIRCLE_MEMBERSHIP_STATUS.ACTIVE) return false;
  if (patientId && membership.patientId !== patientId) return false;
  return (membership.permissions || []).includes(permission);
}

// Asked directly and answered in one place, so no screen has to reason about it. Being in a Care
// Circle never confers consent, signature or decision authority, whatever permissions are on.
export const supporterMayActWithAuthority = () => false;

// What a supporter is allowed to be shown, derived from permissions rather than assembled by each
// screen. Anything absent from this list is not "hidden" — it was never shared.
export function supporterVisibleCapabilities(membership, { patientId = null } = {}) {
  return CARE_CIRCLE_PERMISSION_LIST.filter(permission => supporterMayAccess(membership, permission, { patientId }));
}
