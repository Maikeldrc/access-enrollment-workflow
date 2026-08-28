import { expect } from "@playwright/test";

// Shared seeding for the appointment specs. Every appointment surface lives behind a completed
// enrollment, so each test starts from a verified patient with whatever records it needs already
// on the draft, rather than walking the whole journey again.

// The prototype scheduling capability is keyed by provider id. These are the four levels the
// spec requires and the only way a test can choose which path it is exercising.
export const DIRECT_BOOKING_PROVIDER = "dr-fresner";
export const STRUCTURED_REQUEST_PROVIDER = "dr-martinez-cardiology";
export const HUMAN_COORDINATION_PROVIDER = "itera-care-manager";
export const NO_CHANNEL_PROVIDER = "provider-no-scheduling-channel";

export const inDays = (days, hour = 10) => {
  const when = new Date();
  when.setDate(when.getDate() + days);
  when.setHours(hour, 30, 0, 0);
  return when.toISOString();
};

// A record shaped exactly like createAppointmentNeed's output, so a seeded appointment and one the
// product built are indistinguishable to the screens.
export const appointment = (overrides = {}) => ({
  id: "appt-1",
  patientId: "patient_demo",
  source: "PATIENT_DIRECT_REQUEST",
  reasonCategory: "ROUTINE_FOLLOW_UP",
  reasonSummary: "",
  relatedGoalId: "",
  relatedBarrierId: "",
  relatedRefillId: "",
  requestedProfessionalId: DIRECT_BOOKING_PROVIDER,
  requestedProfessionalType: "PRIMARY_CARE",
  requestedSpecialty: "",
  providerDisplayName: "Dr. Fresner",
  practiceName: "",
  preferredModality: "NO_PREFERENCE",
  preferredTimeOfDay: "NO_PREFERENCE",
  preferredDateRange: null,
  urgencyClassification: "ROUTINE",
  schedulingCapability: "DIRECT_BOOKING",
  status: "CONFIRMED",
  scheduledAt: inDays(7),
  scheduledEndAt: inDays(7, 11),
  timezone: "America/New_York",
  modality: "IN_PERSON",
  locationName: "Fresner Medical Group",
  locationAddress: "",
  joinUrl: "",
  confirmationNumber: "CONF-1",
  proposedTimes: [],
  idempotencyKey: "",
  events: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  requestSentAt: "",
  confirmedAt: new Date().toISOString(),
  canceledAt: "",
  completedAt: "",
  resolvedAt: "",
  attendanceOutcome: "",
  followUpAskedAt: "",
  reminder: null,
  prep: { topics: [], notes: "", sharedWithProvider: false, updatedAt: "" },
  sharedWith: [],
  ...overrides
});

export const seedAppointments = (page, {
  appointments = [],
  screen = "MY_CARE",
  language = "en",
  careCirclePermissions = null,
  patientGoals = [],
  careMedications = [],
  completionRole = "patient"
} = {}) => page.evaluate(seed => {
  localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify(seed));
}, {
  scenarioId: "access-happy", screen, role: "patient", completionRole,
  identityVerified: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED", accessOutcome: "eligible",
  language, audit: [], careTeamTasks: [], careMedications, medicationReviews: {}, additionalMedications: [],
  medicationSupplySignals: [], medicationRefills: [],
  careGoals: [], patientGoals, bpReadings: [], bpReadingReceipts: [], goalHistory: [],
  appointments, appointmentDraft: null, activeAppointmentId: "",
  careCirclePermissions: careCirclePermissions || { receiveReminders: false, helpWithDeviceSetup: false, helpWithAppointments: false, receiveCareTasks: false, viewLimitedCareProgress: false }
});

// The app writes its own draft during boot. Seeding before that settles lets the app's write land
// on top of the seed, so the reload comes back with state the test never asked for. Waiting for the
// shell first is what makes these specs safe to run in parallel with the rest of the suite.
const settleFirstBoot = async page => {
  await page.waitForSelector(".shell", { state: "attached", timeout: 30000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};

export const openAppointments = async (page, options = {}) => {
  await page.goto("/?scenario=access-happy");
  await settleFirstBoot(page);
  await seedAppointments(page, options);
  await page.reload();
  await page.waitForSelector("#screen-content", { state: "visible", timeout: 30000 });
};

export const draft = page => page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));

// Care Circle invites live in their own store, not on the enrollment draft.
export const seedCareCircle = (page, invites) => page.evaluate(list => {
  // GrowthStore reads { invites: [...] }; a bare array makes allSupportInvites() throw.
  localStorage.setItem("itera.care-circle.prototype.v1", JSON.stringify(Array.isArray(list) ? { invites: list } : list));
}, invites);

export const acceptedInvite = (overrides = {}) => ({
  inviteId: "invite-1", token: "tok-1", inviterPatientId: "patient_demo", patientFirstName: "John",
  supportPerson: { name: "Ana Ruiz", relationship: "daughter", relationshipOther: "", phone: "+13055550143" },
  supportRole: "CARE_CIRCLE_MEMBER", completionRole: "PATIENT", permissionScope: "CARE_CIRCLE_BASIC_SUPPORT",
  context: "ONGOING_CARE", status: "ACCEPTED", createdAt: new Date().toISOString(), sentAt: new Date().toISOString(),
  lastSentAt: new Date().toISOString(), sendCount: 1, openedAt: "", acceptedAt: new Date().toISOString(),
  expiresAt: inDays(3), canceledAt: "", removedAt: "", sessionId: "sess-1", temporarySupportLink: "",
  ...overrides
});

export async function expectNoConfirmedLanguage(page) {
  const screen = await page.locator("#screen-content").innerText();
  expect(screen).not.toMatch(/\bconfirmed\b|\bbooked\b|\bscheduled for\b/i);
}
