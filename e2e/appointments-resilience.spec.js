import { expect, test } from "@playwright/test";
import {
  DIRECT_BOOKING_PROVIDER,
  STRUCTURED_REQUEST_PROVIDER,
  acceptedInvite,
  appointment,
  draft,
  inDays,
  seedAppointments
} from "./appointmentSurfaces.js";

// QA Agent 4 — security, authorization, state, persistence, failure and edge cases.
//
// Everything here is written from the patient's side of the glass: what a hostile record, a
// double tap, a reload, a Care Circle member or an unverified representative can actually make
// this product do. Nothing in this file edits src/ and nothing here trusts a claim the screens
// make — every assertion reads either the rendered DOM or the persisted draft.
//
// Spec sections covered: §95/§96 timezone and daylight saving, §115 privacy, §116 audit,
// §117 no PHI in analytics, §124-§127 race/idempotency/session persistence,
// §156-§160 provider vs patient calendar, security, role, representative, audit who acted.

const DRAFT_KEY = "itera.enrollment.safe-draft.v2";

const screen = page => page.locator("#screen-content");
const screenText = page => screen(page).innerText();

/* ------------------------------------------------------------------ seeding + plumbing --- */

// seedAppointments() writes a fixed draft shape. Several tests here need keys it does not take
// (activeAppointmentId, appointmentDraft, identityVerified), so the patch is merged on top of
// the seed and the page reloaded once, exactly like the helper does.
const openWith = async (page, options = {}, patch = {}, invites = null) => {
  await page.goto("/?scenario=access-happy&appointmentService=manual");
  // The app writes its own draft during boot; seeding before that settles lets it clobber the seed.
  await page.waitForSelector(".shell", { state: "attached", timeout: 30000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await seedAppointments(page, options);
  if (invites) await seedInvites(page, invites);
  if (Object.keys(patch).length) {
    await page.evaluate(({ key, extra }) => {
      const stored = JSON.parse(localStorage.getItem(key) || "{}");
      localStorage.setItem(key, JSON.stringify({ ...stored, ...extra }));
    }, { key: DRAFT_KEY, extra: patch });
  }
  await page.reload();
  await booted(page);
};

// The shell boots asynchronously: #screen-content only exists once the offer has resolved and a
// real screen has rendered, so every navigation waits for it rather than for the load event.
const booted = page => expect(page.locator("#screen-content")).toBeVisible();

// e2e/appointmentSurfaces.js's seedCareCircle() writes a bare array, but GrowthStore reads
// { invites: [] } from this key and throws on anything else — which takes the whole boot down.
// Written correctly here so the Care Circle tests exercise the product rather than the helper.
const seedInvites = (page, invites) => page.evaluate(
  list => localStorage.setItem("itera.care-circle.prototype.v1", JSON.stringify({ invites: list })),
  invites
);

// A seeded record with a real event trail. A record with events: [] makes appointmentAnalytics
// report a blank actor, which is a seeding artefact rather than a product behaviour.
const trailed = (overrides = {}) => appointment({
  events: [{ status: "NEED_IDENTIFIED", source: "ITERA", actor: "PATIENT", at: new Date().toISOString(), detail: null }],
  ...overrides
});

// state.audit only reaches localStorage when something calls draftStore.save(). Several handlers
// push an audit row and then render without saving, so every audit read is preceded by a click on
// whatever navigation control is on screen — all of them save.
const flush = async page => {
  await page.evaluate(() => {
    document.querySelector('[data-action="appointment-list-tab"], [data-action="appointment-open-list"], [data-action="open-my-appointments"], [data-action="appointment-back"]')?.click();
  });
  await page.waitForTimeout(120);
};

// My Care only offers "See all appointments" when there is something upcoming or pending, so a
// patient whose visits are all closed has no route to the list at all (reported separately). The
// list screen is therefore seeded directly wherever a test needs it.
const openList = async (page, tab = "UPCOMING") => {
  const link = page.locator('[data-action="appointment-open-list"], [data-action="open-my-appointments"]').first();
  if (await link.count()) await link.click();
  const tabButton = page.locator(`[data-action="appointment-list-tab"][data-tab="${tab}"]`);
  await expect(tabButton).toBeVisible();
  await tabButton.click();
};

const auditRows = async page => ((await draft(page))?.audit || []);
const appointmentAudit = async page => (await auditRows(page)).filter(row => String(row.eventType || "").startsWith("appointment_"));
const auditTypes = async page => (await appointmentAudit(page)).map(row => row.eventType);
const records = async page => ((await draft(page))?.appointments || []);
const recordById = async (page, id) => (await records(page)).find(item => item.id === id) || null;

// Repeated taps on one control, dispatched as fast as the page can process them. The app binds a
// handler per element at render, so this re-queries after every click: whatever survives the
// re-render is what a patient hammering the button would actually hit.
const hammer = (page, selector, times = 6) => page.evaluate(({ selector, times }) => {
  for (let index = 0; index < times; index += 1) document.querySelector(selector)?.click();
}, { selector, times });

const watchPageErrors = page => {
  const errors = [];
  page.on("pageerror", error => errors.push(String(error?.message || error)));
  return errors;
};

const watchDialogs = page => {
  const dialogs = [];
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  return dialogs;
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
});

/* -------------------------------------------------------- the flow the audit tests drive -- */

const SECRET_REASON = "PATIENT-SECRET-REASON-dizzy-in-the-mornings";
const SECRET_TOPIC = "PATIENT-SECRET-TOPIC-my-chest-tightness";
const SECRET_JOIN = "https://video.example.org/visit/SECRET-JOIN-1a2b";
const SECRET_ADDRESS = "8950 SW 74th Court Suite 3100, Miami FL";
const SECRET_PRACTICE = "Fresner Medical Group";
const SECRET_CONFIRMATION = "CONF-SECRET-99";

const bookingNeed = () => trailed({
  id: "appt-need",
  status: "COLLECTING_PREFERENCES",
  requestedProfessionalId: DIRECT_BOOKING_PROVIDER,
  providerDisplayName: "Dr. Fresner",
  practiceName: "",
  reasonCategory: "ROUTINE_FOLLOW_UP",
  reasonSummary: SECRET_REASON,
  schedulingCapability: "DIRECT_BOOKING",
  scheduledAt: "",
  scheduledEndAt: "",
  confirmationNumber: "",
  confirmedAt: "",
  timezone: ""
});

// A separate confirmed visit, deliberately with a different office: §82 surfaces an appointment
// the patient already has with the same provider, which would short-circuit the booking flow.
const otherProviderVisit = (overrides = {}) => confirmedVisit({
  id: "appt-confirmed",
  requestedProfessionalId: STRUCTURED_REQUEST_PROVIDER,
  providerDisplayName: "Dr. Martinez",
  ...overrides
});

const confirmedVisit = (overrides = {}) => trailed({
  id: "appt-confirmed",
  status: "CONFIRMED",
  requestedProfessionalId: DIRECT_BOOKING_PROVIDER,
  providerDisplayName: "Dr. Fresner",
  practiceName: SECRET_PRACTICE,
  locationName: SECRET_PRACTICE,
  locationAddress: SECRET_ADDRESS,
  joinUrl: SECRET_JOIN,
  confirmationNumber: SECRET_CONFIRMATION,
  reasonSummary: SECRET_REASON,
  modality: "IN_PERSON",
  scheduledAt: inDays(9),
  scheduledEndAt: inDays(9, 11),
  ...overrides
});

// The draft the scheduling screen reads. appointmentPreferenceView stamps data-need-id from the
// appointment it was handed, so the draft id is free — the last test in this file guards exactly
// that, because a draft id leaking onto those buttons drops the patient out of the flow.
const schedulingDraft = (needId, overrides = {}) => ({
  id: needId,
  step: "",
  reasonCategory: "ROUTINE_FOLLOW_UP",
  reasonSummary: SECRET_REASON,
  requestedProfessionalId: DIRECT_BOOKING_PROVIDER,
  requestedProfessionalType: "PRIMARY_CARE",
  requestedSpecialty: "",
  providerDisplayName: "Dr. Fresner",
  preferredModality: "NO_PREFERENCE",
  preferredTimeOfDay: "NO_PREFERENCE",
  preferredDateRange: null,
  selectedSlotId: "",
  relatedGoalId: null,
  relatedBarrierId: null,
  relatedRefillId: null,
  urgencyClassification: "ROUTINE",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

const answer = async (page, field, value) => {
  const button = page.locator(`[data-action="appointment-preference-answer"][data-field="${field}"][data-value="${value}"]`).first();
  await expect(button).toBeVisible();
  await button.click();
};

// Preferences → review → real availability → a real booking, entirely by tapping.
const driveBookingToConfirmed = async page => {
  await expect(page.locator('div.appointment-preference-screen[data-step="PROVIDER"]')).toBeVisible();
  await answer(page, "requestedProfessionalId", DIRECT_BOOKING_PROVIDER);
  await expect(page.locator('div.appointment-preference-screen[data-step="REASON"]')).toBeVisible();
  await answer(page, "reasonCategory", "ROUTINE_FOLLOW_UP");
  await expect(page.locator('div.appointment-preference-screen[data-step="MODALITY"]')).toBeVisible();
  await answer(page, "preferredModality", "NO_PREFERENCE");
  await expect(page.locator('div.appointment-preference-screen[data-step="TIME_OF_DAY"]')).toBeVisible();
  await answer(page, "preferredTimeOfDay", "NO_PREFERENCE");
  await expect(page.locator('div.appointment-preference-screen[data-step="REVIEW"]')).toBeVisible();
  await page.locator('[data-action="appointment-submit-request"]').click();
  await expect(page.locator(".appointment-slot").first()).toBeVisible();
  await page.locator('[data-action="appointment-select-slot"]').first().click();
  await expect(page.locator(".appointment-confirmation-screen")).toBeVisible();
};

/* ================================================================== §117 / §116 / §160 === */

test("§117 no PHI reaches the analytics trail across a whole appointment life cycle", async ({ page }) => {
  test.setTimeout(120000);
  const errors = watchPageErrors(page);

  await openWith(page, {
    appointments: [bookingNeed(), otherProviderVisit()],
    screen: "APPOINTMENT_SCHEDULING",
    careCirclePermissions: { receiveReminders: true, helpWithDeviceSetup: false, helpWithAppointments: true, receiveCareTasks: false, viewLimitedCareProgress: false }
  }, {
    activeAppointmentId: "appt-need",
    appointmentDraft: schedulingDraft("appt-need")
  }, [acceptedInvite()]);

  // 1. book a real slot through the real screens.
  await driveBookingToConfirmed(page);
  const booked = await recordById(page, "appt-need");
  expect(booked.status).toBe("CONFIRMED");

  // 2. write something in the patient's own words onto the appointment.
  await page.locator('[data-action="appointment-open-prep"]').first().click();
  await page.locator("#appointment-prep-topic").fill(SECRET_TOPIC);
  await page.locator('[data-action="appointment-add-prep-topic"]').click();
  await expect(screen(page)).toContainText(SECRET_TOPIC);

  // 3. send the brief to the care team.
  await page.locator('[data-action="appointment-open-brief"]').click();
  await page.locator('[data-action="appointment-share-brief"]').click();

  // 4. an in-app reminder.
  await page.locator('[data-action="appointment-back"]').click();
  await page.locator('.appointment-card [data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-open-reminder"]').click();
  await page.locator('[data-action="appointment-save-reminder"][data-slot="DAY_BEFORE"]').click();

  // 5. share it with a Care Circle member.
  await page.locator('[data-action="appointment-open-share"]').click();
  await page.locator('[data-action="appointment-share-with-member"]').first().click();

  // 6. ask for a different time. Sharing leaves the patient on the share screen, where §158's
  // limits are restated, so the appointment itself is one step back.
  await page.locator('[data-action="appointment-back"]').click();
  await page.locator('.appointment-card [data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-request-reschedule"]').click();

  // 7. cancel the other, separately confirmed, visit.
  await page.locator('[data-action="appointment-back"]').click();
  await page.locator('[data-appointment-id="appt-confirmed"][data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-request-cancel"]').click();
  await page.locator('[data-action="appointment-confirm-cancel"]').click();
  await flush(page);

  const rows = await appointmentAudit(page);
  expect(rows.length).toBeGreaterThan(6);

  const bookedRecord = await recordById(page, "appt-need");
  const canceled = await recordById(page, "appt-confirmed");
  const forbidden = [
    ["provider display name", "Dr. Fresner"],
    ["practice name", SECRET_PRACTICE],
    ["location address", SECRET_ADDRESS],
    ["join url", SECRET_JOIN],
    ["confirmation number", SECRET_CONFIRMATION],
    ["confirmation number (booked)", bookedRecord.confirmationNumber],
    ["patient free text", SECRET_REASON],
    ["prep topic", SECRET_TOPIC],
    ["scheduled time ISO", bookedRecord.scheduledAt],
    ["scheduled time epoch", String(new Date(bookedRecord.scheduledAt).getTime())],
    ["canceled visit time ISO", canceled.scheduledAt],
    ["canceled visit time epoch", String(new Date(canceled.scheduledAt).getTime())]
  ].filter(([, needle]) => Boolean(needle));

  // Asserted per event so a failure names the event that leaked, not just "something did".
  const leaks = [];
  rows.forEach(row => {
    const serialized = JSON.stringify(row.details ?? {});
    forbidden.forEach(([label, needle]) => {
      if (serialized.includes(needle)) leaks.push(`${row.eventType} leaks ${label}: ${needle}`);
    });
  });
  expect(leaks, `appointment analytics must carry no PHI (§117)\n${leaks.join("\n")}`).toEqual([]);

  // The whole serialized trail, as a backstop against a field none of the needles above named.
  const wholeTrail = JSON.stringify(rows.map(row => row.details ?? {}));
  expect(wholeTrail).not.toMatch(/Fresner/);
  expect(wholeTrail).not.toMatch(/SECRET/);
  expect(errors).toEqual([]);
});

test("§116 the audit trail records every coordination step the patient actually took", async ({ page }) => {
  test.setTimeout(120000);

  await openWith(page, {
    appointments: [bookingNeed(), otherProviderVisit()],
    screen: "APPOINTMENT_SCHEDULING",
    careCirclePermissions: { receiveReminders: true, helpWithDeviceSetup: false, helpWithAppointments: true, receiveCareTasks: false, viewLimitedCareProgress: false }
  }, {
    activeAppointmentId: "appt-need",
    appointmentDraft: schedulingDraft("appt-need")
  }, [acceptedInvite()]);

  await driveBookingToConfirmed(page);
  await page.locator('[data-action="appointment-open-reminder"]').click();
  await page.locator('[data-action="appointment-save-reminder"][data-slot="DAY_BEFORE"]').click();
  await page.locator('[data-action="appointment-open-share"]').click();
  await page.locator('[data-action="appointment-share-with-member"]').first().click();
  // Sharing leaves the patient on the share screen; the appointment is one step back.
  await page.locator('[data-action="appointment-back"]').click();
  await page.locator('.appointment-card [data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-request-reschedule"]').click();
  await flush(page);

  const types = await auditTypes(page);
  [
    "appointment_availability_requested",
    "appointment_slots_shown",
    "appointment_slot_selected",
    "appointment_booking_attempted",
    "appointment_booking_confirmed",
    "appointment_reminder_created",
    "appointment_shared_with_care_circle",
    "appointment_reschedule_requested",
    "appointment_care_team_task_created"
  ].forEach(expected => expect(types, `§116 requires an audit event for ${expected}`).toContain(expected));
});

test("§116 a request that is sent rather than booked is audited as a request", async ({ page }) => {
  test.setTimeout(120000);
  await openWith(page, {
    appointments: [trailed({
      id: "appt-request",
      status: "COLLECTING_PREFERENCES",
      requestedProfessionalId: STRUCTURED_REQUEST_PROVIDER,
      providerDisplayName: "Dr. Martinez",
      reasonCategory: "ROUTINE_FOLLOW_UP",
      schedulingCapability: "STRUCTURED_REQUEST",
      scheduledAt: "",
      scheduledEndAt: "",
      confirmationNumber: "",
      confirmedAt: ""
    })],
    screen: "APPOINTMENT_SCHEDULING"
  }, {
    activeAppointmentId: "appt-request",
    appointmentDraft: schedulingDraft("appt-request", { requestedProfessionalId: STRUCTURED_REQUEST_PROVIDER, providerDisplayName: "Dr. Martinez" })
  });

  await answer(page, "requestedProfessionalId", STRUCTURED_REQUEST_PROVIDER);
  await answer(page, "reasonCategory", "ROUTINE_FOLLOW_UP");
  await expect(page.locator('div.appointment-preference-screen[data-step="MODALITY"]')).toBeVisible();
  await answer(page, "preferredModality", "NO_PREFERENCE");
  await answer(page, "preferredTimeOfDay", "NO_PREFERENCE");
  await page.locator('[data-action="appointment-submit-request"]').click();
  await expect(page.locator(".appointment-request-screen")).toBeVisible();

  // §35: a request never borrows confirmed language.
  const text = await screenText(page);
  expect(text).not.toMatch(/\bconfirmed\b/i);
  await flush(page);

  const types = await auditTypes(page);
  expect(types).toContain("appointment_request_sent");
  expect(types).toContain("appointment_care_team_task_created");

  const stored = await recordById(page, "appt-request");
  expect(stored.status).toBe("REQUEST_SENT");
  expect(stored.requestSentAt).not.toBe("");
});

test("§160 every appointment audit event names who acted, and EMMI-assisted is its own actor", async ({ page }) => {
  test.setTimeout(120000);
  await openWith(page, {
    appointments: [bookingNeed()],
    screen: "APPOINTMENT_SCHEDULING"
  }, {
    activeAppointmentId: "appt-need",
    appointmentDraft: schedulingDraft("appt-need")
  });
  await driveBookingToConfirmed(page);
  await flush(page);

  const rows = await appointmentAudit(page);
  const actors = ["PATIENT", "PERSONAL_REPRESENTATIVE", "CARE_TEAM", "EMMI_ASSISTED_PATIENT", "SYSTEM"];
  rows.forEach(row => {
    expect(row.actorType, `${row.eventType} must record the acting role`).toBeTruthy();
    expect(actors, `${row.eventType} must record an APPOINTMENT_ACTORS value, got "${row.details?.actor}"`).toContain(row.details?.actor);
  });
  // A direct tap by the patient is recorded as the patient, never as the system.
  expect(rows.map(row => row.details?.actor)).toContain("PATIENT");
  expect(rows.every(row => row.actorType === "patient")).toBe(true);

  // §160 requires an EMMI-assisted patient action to be distinguishable from a direct tap. The
  // resolver is the only thing that decides that, so it is asserted directly in the running app.
  const resolved = await page.evaluate(async () => {
    const module = await import("/src/appointments.js");
    return {
      tap: module.resolveAppointmentActor({ completionRole: "patient", role: "patient", viaEmmi: false }),
      viaEmmi: module.resolveAppointmentActor({ completionRole: "patient", role: "patient", viaEmmi: true }),
      representative: module.resolveAppointmentActor({ completionRole: "personalRepresentative" }),
      unknown: module.resolveAppointmentActor({ completionRole: "neighbour" })
    };
  });
  expect(resolved.tap).toBe("PATIENT");
  expect(resolved.viaEmmi).toBe("EMMI_ASSISTED_PATIENT");
  expect(resolved.viaEmmi).not.toBe(resolved.tap);
  expect(resolved.representative).toBe("PERSONAL_REPRESENTATIVE");
  expect(resolved.unknown).toBe("");
});

/* ============================================================== §157 / §158 / §159 roles == */

test("§158 a Care Circle actor can never cancel or reschedule the patient's appointment", async ({ page }) => {
  test.setTimeout(120000);
  await openWith(page, {
    appointments: [confirmedVisit()],
    careCirclePermissions: {
      actingAsCareCircle: true,
      receiveReminders: true,
      helpWithDeviceSetup: true,
      helpWithAppointments: true,
      receiveCareTasks: true,
      viewLimitedCareProgress: true
    }
  }, {}, [acceptedInvite()]);

  await page.locator('.appointment-card [data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-request-reschedule"]').click();
  await page.waitForTimeout(150);
  expect((await recordById(page, "appt-confirmed")).status, "a Care Circle member may not move a visit (§158)").toBe("CONFIRMED");

  await page.locator('[data-action="appointment-request-cancel"]').click();
  await page.locator('[data-action="appointment-confirm-cancel"]').click();
  await page.waitForTimeout(150);
  const after = await recordById(page, "appt-confirmed");
  expect(after.status, "a Care Circle member may not cancel a visit (§158)").toBe("CONFIRMED");
  expect(after.canceledAt).toBe("");
  await flush(page);
  expect(await auditTypes(page)).not.toContain("appointment_canceled");

  // And the rule itself, at the chokepoint, for every action a Care Circle member could reach.
  const decisions = await page.evaluate(async () => {
    const module = await import("/src/appointments.js");
    const permissions = { actingAsCareCircle: true, helpWithAppointments: true };
    return ["VIEW", "REMIND", "CREATE", "BOOK", "RESCHEDULE", "CANCEL", "SHARE"].reduce((all, action) => ({
      ...all,
      [action]: module.canActOnAppointment({ actor: "PATIENT", action, identityVerified: true, careCirclePermissions: permissions })
    }), {});
  });
  expect(decisions.VIEW.allowed).toBe(true);
  expect(decisions.REMIND.allowed).toBe(true);
  ["CREATE", "BOOK", "RESCHEDULE", "CANCEL", "SHARE"].forEach(action => {
    expect(decisions[action].allowed, `Care Circle must not be allowed to ${action}`).toBe(false);
    expect(decisions[action].reason).toBe("CARE_CIRCLE_CANNOT_ACT");
  });
});

test("§159 an unverified personal representative is denied, a verified one may act", async ({ page }) => {
  test.setTimeout(120000);

  // Unverified: nothing changes and nothing claims it did.
  await openWith(page, { appointments: [confirmedVisit()], completionRole: "personalRepresentative" }, { identityVerified: false });
  await page.locator('.appointment-card [data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-request-cancel"]').click();
  await page.locator('[data-action="appointment-confirm-cancel"]').click();
  await page.waitForTimeout(150);
  const denied = await recordById(page, "appt-confirmed");
  expect(denied.status, "an unverified representative may not cancel (§159)").toBe("CONFIRMED");
  expect(denied.canceledAt).toBe("");
  expect(await screenText(page)).not.toMatch(/is canceled|está cancelada/i);

  // Verified: the same person, with verified authority, may act — and the trail says who.
  await openWith(page, { appointments: [confirmedVisit()], completionRole: "personalRepresentative" }, { identityVerified: true });
  await page.locator('.appointment-card [data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-request-cancel"]').click();
  await page.locator('[data-action="appointment-confirm-cancel"]').click();
  await page.waitForTimeout(150);
  const allowed = await recordById(page, "appt-confirmed");
  expect(allowed.status, "a verified representative may cancel (§159)").toBe("CANCELED");
  await flush(page);
  const canceledRow = (await appointmentAudit(page)).find(row => row.eventType === "appointment_canceled");
  expect(canceledRow, "§160: the cancellation must be attributed").toBeTruthy();
  expect(canceledRow.actorType).toBe("representative");
  expect(allowed.events.some(event => event.actor === "PERSONAL_REPRESENTATIVE")).toBe(true);
});

test("§157 a tampered control cannot drive an illegal transition on a closed appointment", async ({ page }) => {
  test.setTimeout(120000);
  const errors = watchPageErrors(page);
  await openWith(page, {
    appointments: [
      confirmedVisit({ id: "appt-live" }),
      trailed({ id: "appt-done", status: "COMPLETED", scheduledAt: inDays(-4), scheduledEndAt: inDays(-4, 11), completedAt: new Date().toISOString(), resolvedAt: new Date().toISOString() })
    ]
  });

  await page.locator('[data-appointment-id="appt-live"][data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-request-cancel"]').click();
  const confirm = page.locator('[data-action="appointment-confirm-cancel"]');
  await expect(confirm).toBeVisible();

  // The record id on the control is client-side state. Point it at a completed visit and press it.
  await page.evaluate(() => {
    const button = document.querySelector('[data-action="appointment-confirm-cancel"]');
    if (button) button.dataset.appointmentId = "appt-done";
  });
  await confirm.click();
  await page.waitForTimeout(150);

  const done = await recordById(page, "appt-done");
  expect(done.status, "COMPLETED is terminal — nothing may cancel it").toBe("COMPLETED");
  expect(done.canceledAt).toBe("");
  expect(done.events.some(event => event.status === "CANCELED" || event.status === "CANCEL_REQUESTED")).toBe(false);
  expect((await recordById(page, "appt-live")).status).toBe("CONFIRMED");
  expect(errors).toEqual([]);
});

/* ==================================================== §127 session persistence + storage == */

test("§127 leaving mid-draft restores the draft, submits nothing, and never restores the flow", async ({ page }) => {
  test.setTimeout(120000);
  await openWith(page, {
    appointments: [bookingNeed()],
    screen: "APPOINTMENT_SCHEDULING"
  }, {
    activeAppointmentId: "appt-need",
    appointmentDraft: schedulingDraft("appt-need")
  });

  // Answer two questions, then walk away.
  await answer(page, "requestedProfessionalId", DIRECT_BOOKING_PROVIDER);
  await answer(page, "reasonCategory", "BLOOD_PRESSURE_FOLLOW_UP");
  await expect(page.locator('div.appointment-preference-screen[data-step="MODALITY"]')).toBeVisible();

  const before = await draft(page);
  expect(before.appointmentDraft, "§127: the draft is what survives").toBeTruthy();
  expect(before.appointmentDraft.reasonCategory).toBe("BLOOD_PRESSURE_FOLLOW_UP");
  expect(before.appointmentFlow, "appointmentFlow is deliberately transient and must not persist").toBeUndefined();

  await page.reload();
  await booted(page);

  const after = await draft(page);
  expect(after.appointmentDraft.reasonCategory).toBe("BLOOD_PRESSURE_FOLLOW_UP");
  expect(after.appointmentDraft.requestedProfessionalId).toBe(DIRECT_BOOKING_PROVIDER);
  expect(after.appointmentFlow).toBeUndefined();

  // §127: nothing was submitted by leaving.
  const record = after.appointments.find(item => item.id === "appt-need");
  expect(record.status).toBe("COLLECTING_PREFERENCES");
  expect(record.requestSentAt).toBe("");
  expect(record.confirmedAt).toBe("");
  expect(record.scheduledAt).toBe("");
  expect((after.careTeamTasks || []).filter(task => task.type === "APPOINTMENT_REQUEST")).toHaveLength(0);
  expect((after.audit || []).map(row => row.eventType)).not.toContain("appointment_request_sent");

  const text = await screenText(page);
  expect(text).not.toMatch(/request sent|confirmed|solicitud enviada/i);
});

test("persistence keeps every field the appointment screens actually render", async ({ page }) => {
  test.setTimeout(120000);
  await openWith(page, {
    appointments: [bookingNeed()],
    screen: "APPOINTMENT_SCHEDULING",
    careCirclePermissions: { receiveReminders: true, helpWithDeviceSetup: false, helpWithAppointments: true, receiveCareTasks: false, viewLimitedCareProgress: false }
  }, {
    activeAppointmentId: "appt-need",
    appointmentDraft: schedulingDraft("appt-need")
  }, [acceptedInvite()]);

  await driveBookingToConfirmed(page);
  await page.locator('[data-action="appointment-open-prep"]').first().click();
  await page.locator("#appointment-prep-topic").fill("Ask about my morning dose");
  await page.locator('[data-action="appointment-add-prep-topic"]').click();
  await expect(screen(page)).toContainText("Ask about my morning dose");
  await page.locator('[data-action="appointment-back"]').click();
  await page.locator('.appointment-card [data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-open-reminder"]').click();
  await page.locator('[data-action="appointment-save-reminder"][data-slot="DAY_BEFORE"]').click();
  await page.locator('[data-action="appointment-open-share"]').click();
  await page.locator('[data-action="appointment-share-with-member"]').first().click();
  await page.locator('[data-action="appointment-back"]').click();

  const before = await recordById(page, "appt-need");
  await page.reload();
  await booted(page);
  const after = await recordById(page, "appt-need");

  expect(after, "the appointment must survive a reload").toBeTruthy();
  const rendered = [
    "status", "providerDisplayName", "practiceName", "requestedSpecialty", "scheduledAt", "scheduledEndAt",
    "timezone", "modality", "locationName", "locationAddress", "joinUrl", "confirmationNumber",
    "reasonCategory", "reasonSummary", "preferredModality", "preferredTimeOfDay", "requestSentAt",
    "confirmedAt", "attendanceOutcome", "schedulingCapability", "idempotencyKey"
  ];
  rendered.forEach(field => expect(after[field], `${field} must survive a reload`).toEqual(before[field]));
  expect(after.reminder, "the reminder the patient chose must survive").toEqual(before.reminder);
  expect(after.reminder?.slot).toBe("DAY_BEFORE");
  expect(after.prep?.topics, "prep topics are the patient's own words").toEqual(["Ask about my morning dose"]);
  expect(after.sharedWith, "who this was shared with must survive").toHaveLength(1);
  expect(after.sharedWith[0].inviteId).toBe("invite-1");
  expect(after.events.length, "the record's own trail must survive").toBe(before.events.length);
  expect(after.proposedTimes.length).toBe(before.proposedTimes.length);

  // And the restored record still renders as the confirmed visit it is.
  await expect(screen(page)).toContainText("Dr. Fresner");
  expect(await screenText(page)).not.toMatch(/undefined|NaN|\[object|Invalid Date/i);
});

/* ============================================================ §125 / §126 idempotency ===== */

test("§125 hammering the booking control produces exactly one appointment", async ({ page }) => {
  test.setTimeout(120000);
  await openWith(page, {
    appointments: [bookingNeed()],
    screen: "APPOINTMENT_SCHEDULING"
  }, {
    activeAppointmentId: "appt-need",
    appointmentDraft: schedulingDraft("appt-need")
  });
  await answer(page, "requestedProfessionalId", DIRECT_BOOKING_PROVIDER);
  await answer(page, "reasonCategory", "ROUTINE_FOLLOW_UP");
  await answer(page, "preferredModality", "NO_PREFERENCE");
  await answer(page, "preferredTimeOfDay", "NO_PREFERENCE");
  await hammer(page, '[data-action="appointment-submit-request"]', 8);
  await expect(page.locator(".appointment-slot").first()).toBeVisible();

  await hammer(page, '[data-action="appointment-select-slot"]', 8);
  await page.waitForTimeout(200);
  await expect(page.locator(".appointment-confirmation-screen")).toBeVisible();
  await flush(page);

  const all = await records(page);
  expect(all, "a double tap must never become two appointments (§125)").toHaveLength(1);
  expect(all[0].status).toBe("CONFIRMED");
  const types = await auditTypes(page);
  expect(types.filter(type => type === "appointment_booking_confirmed"), "one booking, one confirmation").toHaveLength(1);
  expect(all[0].events.filter(event => event.status === "CONFIRMED")).toHaveLength(1);
});

test("§126 hammering cancel, reschedule and share performs each destructive act once", async ({ page }) => {
  test.setTimeout(120000);
  await openWith(page, {
    appointments: [confirmedVisit({ id: "appt-share" }), confirmedVisit({ id: "appt-cancel" }), confirmedVisit({ id: "appt-move" })],
    careCirclePermissions: { receiveReminders: true, helpWithDeviceSetup: false, helpWithAppointments: true, receiveCareTasks: false, viewLimitedCareProgress: false }
  }, {}, [acceptedInvite()]);

  // Share stays on the same screen after sharing, so this really is a repeated tap on a live
  // control rather than a tap on something the re-render already removed.
  await page.locator('[data-appointment-id="appt-share"][data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-open-share"]').click();
  await hammer(page, '[data-action="appointment-share-with-member"]', 8);
  await page.waitForTimeout(200);
  const shared = await recordById(page, "appt-share");
  expect(shared.sharedWith, "one share, one entry (§126)").toHaveLength(1);

  await page.locator('[data-action="appointment-back"]').click();
  await page.locator('[data-appointment-id="appt-cancel"][data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-request-cancel"]').click();
  await hammer(page, '[data-action="appointment-confirm-cancel"]', 8);
  await page.waitForTimeout(200);
  const canceled = await recordById(page, "appt-cancel");
  expect(canceled.status).toBe("CANCELED");
  expect(canceled.events.filter(event => event.status === "CANCELED"), "one cancellation, one event").toHaveLength(1);
  expect(canceled.events.filter(event => event.status === "CANCEL_REQUESTED")).toHaveLength(1);

  await page.locator('[data-action="appointment-back"]').click();
  await page.locator('[data-appointment-id="appt-move"][data-action="appointment-open"]').first().click();
  await hammer(page, '[data-action="appointment-request-reschedule"]', 8);
  await page.waitForTimeout(200);
  const moved = await recordById(page, "appt-move");
  expect(moved.status).toBe("RESCHEDULE_REQUESTED");
  expect(moved.events.filter(event => event.status === "RESCHEDULE_REQUESTED"), "one reschedule request").toHaveLength(1);

  await flush(page);
  const types = await auditTypes(page);
  expect(types.filter(type => type === "appointment_canceled")).toHaveLength(1);
  expect(types.filter(type => type === "appointment_reschedule_requested")).toHaveLength(1);
  expect(types.filter(type => type === "appointment_shared_with_care_circle")).toHaveLength(1);
  expect(await records(page)).toHaveLength(3);
});

/* ======================================================== §115 minimum necessary sharing == */

test("§115 a shared appointment carries when, who and where — and nothing else", async ({ page }) => {
  test.setTimeout(120000);
  await openWith(page, {
    appointments: [confirmedVisit({ id: "appt-shared" })],
    careCirclePermissions: { receiveReminders: true, helpWithDeviceSetup: false, helpWithAppointments: true, receiveCareTasks: false, viewLimitedCareProgress: false }
  }, {}, [acceptedInvite()]);

  await page.locator('.appointment-card [data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-open-share"]').click();
  await page.locator('[data-action="appointment-share-with-member"]').first().click();
  await page.waitForTimeout(200);

  const record = await recordById(page, "appt-shared");
  expect(record.sharedWith).toHaveLength(1);
  const payload = record.sharedWith[0].payload || {};
  const serialized = JSON.stringify(payload);
  expect(Object.keys(payload).sort()).toEqual([
    "limits", "locationAddress", "locationName", "modality", "providerDisplayName",
    "scheduledAt", "scheduledEndAt", "scope", "timezone"
  ]);
  [SECRET_JOIN, SECRET_CONFIRMATION, SECRET_REASON].forEach(needle => {
    expect(serialized, "a share is four facts, not the record (§115)").not.toContain(needle);
  });
  expect(payload.reasonCategory).toBeUndefined();
  expect(payload.prep).toBeUndefined();
  expect(payload.patientId).toBeUndefined();
  expect(payload.events).toBeUndefined();

  // §158 restated where the patient can read it: a share grants no authority.
  await expect(screen(page)).toContainText(/does not .*change or cancel it/i);
});

/* ================================================================== §124 the vanished slot = */

test("§124 a time that disappears between showing and booking is nobody's fault", async ({ page }) => {
  test.setTimeout(120000);
  await openWith(page, {
    appointments: [bookingNeed()],
    screen: "APPOINTMENT_SCHEDULING"
  }, {
    activeAppointmentId: "appt-need",
    appointmentDraft: schedulingDraft("appt-need")
  });
  await answer(page, "requestedProfessionalId", DIRECT_BOOKING_PROVIDER);
  await answer(page, "reasonCategory", "ROUTINE_FOLLOW_UP");
  await answer(page, "preferredModality", "NO_PREFERENCE");
  await answer(page, "preferredTimeOfDay", "NO_PREFERENCE");
  await page.locator('[data-action="appointment-submit-request"]').click();
  await expect(page.locator(".appointment-slot").first()).toBeVisible();

  // The fixture slot the office will say is gone is always the last one offered.
  const more = page.locator('[data-action="appointment-more-times"]');
  if (await more.count()) await more.click();
  await expect(page.locator(".appointment-slot").first()).toBeVisible();
  await page.locator(".appointment-slot").last().click();
  await page.waitForTimeout(300);

  const text = await screenText(page);
  expect(text, "a slot that vanished must not produce a confirmation").not.toMatch(/Appointment confirmed|Confirmation number/i);
  expect(text, "and the patient is never blamed for it").toMatch(/just taken|still open/i);
  expect(await page.locator(".appointment-confirmation-screen").count()).toBe(0);

  await flush(page);
  const record = await recordById(page, "appt-need");
  expect(record.status, "a failed booking falls back to the times still on offer").toBe("SLOTS_AVAILABLE");
  expect(record.confirmationNumber).toBe("");
  expect(record.scheduledAt).toBe("");
  expect(await auditTypes(page)).not.toContain("appointment_booking_confirmed");
});

/* ========================================================= status machine + hostile state = */

test("closed appointments never offer an action that would be illegal", async ({ page }) => {
  test.setTimeout(120000);
  const errors = watchPageErrors(page);
  const closed = ["CANCELED", "COMPLETED", "NO_SHOW", "UNABLE_TO_SCHEDULE", "DECLINED"];
  const seeded = closed.map((status, index) => trailed({
    id: `appt-${status.toLowerCase()}`,
    status,
    scheduledAt: inDays(-(index + 1)),
    scheduledEndAt: inDays(-(index + 1), 11),
    canceledAt: status === "CANCELED" ? new Date().toISOString() : "",
    completedAt: status === "COMPLETED" ? new Date().toISOString() : "",
    resolvedAt: new Date().toISOString()
  }));

  await openWith(page, { appointments: seeded, screen: "MY_APPOINTMENTS" });
  await openList(page, "PAST");
  await expect(page.locator(".appointment-card").first()).toBeVisible();
  expect(await page.locator(".appointment-card").count()).toBe(closed.length);

  for (const status of closed) {
    const id = `appt-${status.toLowerCase()}`;
    // Opened by seeding the detail screen: a patient with nothing upcoming has no route back to
    // the list, which is a separate finding rather than something this test should paper over.
    await openWith(page, { appointments: seeded, screen: "APPOINTMENT_DETAIL" }, { activeAppointmentId: id });
    await expect(page.locator(".appointment-detail-screen")).toBeVisible();
    const destructive = page.locator('[data-action="appointment-request-cancel"], [data-action="appointment-confirm-cancel"], [data-action="appointment-request-reschedule"], [data-action="appointment-open-reminder"], [data-action="appointment-select-slot"], [data-action="appointment-join-visit"], [data-action="appointment-submit-request"]');
    expect(await destructive.count(), `${status} must not offer an action it cannot perform`).toBe(0);
    const text = await screenText(page);
    expect(text, `${status} must not read as a confirmed appointment`).not.toMatch(/Appointment confirmed/i);
    expect(text).not.toMatch(/undefined|NaN|\[object|Invalid Date/i);
    // The internal status string is never shown to a patient (§20/§36).
    expect(text).not.toContain(status);
  }
  expect(errors).toEqual([]);
});

// §40: "My appointments" is where past visits live, and My Care only links to it when something
// is upcoming or pending. A patient whose visits are all behind them has no way in.
test("a patient whose visits are all in the past can still reach My appointments", async ({ page }) => {
  test.setTimeout(120000);
  await openWith(page, {
    appointments: [trailed({ id: "appt-past", status: "COMPLETED", scheduledAt: inDays(-6), scheduledEndAt: inDays(-6, 11), completedAt: new Date().toISOString(), resolvedAt: new Date().toISOString() })]
  });
  await expect(screen(page)).toBeVisible();
  expect(
    await page.locator('[data-action="appointment-open-list"], [data-action="open-my-appointments"]').count(),
    "My Care must offer a way into the appointments list even when nothing is upcoming"
  ).toBeGreaterThan(0);
});

test("a corrupt or hostile appointment record never crashes a screen and never becomes a link", async ({ page }) => {
  test.setTimeout(120000);
  const errors = watchPageErrors(page);
  const dialogs = watchDialogs(page);

  await openWith(page, {
    appointments: [
      // Almost nothing on the record at all.
      { id: "appt-bare", status: "CONFIRMED" },
      // A null prep block and an empty scheduled time.
      trailed({ id: "appt-null-prep", prep: null, scheduledAt: "", scheduledEndAt: "", reminder: null, sharedWith: null, proposedTimes: null }),
      // Garbage where a timestamp belongs.
      trailed({ id: "appt-garbage-time", scheduledAt: "not-a-date-at-all", scheduledEndAt: "🙂", timezone: "Not/AZone" }),
      // A status this build has never heard of.
      trailed({ id: "appt-unknown-status", status: "TOTALLY_MADE_UP_STATUS" }),
      // A javascript: URL where a video link belongs.
      trailed({ id: "appt-js-url", joinUrl: "javascript:alert(1)", modality: "TELEHEALTH", locationName: "", locationAddress: "" }),
      // A protocol-relative URL, which is not https either.
      trailed({ id: "appt-proto-url", joinUrl: "//evil.example/visit", modality: "TELEHEALTH" })
    ],
    screen: "MY_APPOINTMENTS"
  });

  await expect(screen(page)).toBeVisible();
  let text = await screenText(page);
  expect(text).not.toMatch(/undefined|NaN|\[object|Invalid Date/i);

  for (const tab of ["UPCOMING", "REQUESTS", "PAST"]) {
    await openList(page, tab);
    text = await screenText(page);
    expect(text, `the ${tab} tab must survive a corrupt record`).not.toMatch(/undefined|NaN|\[object|Invalid Date/i);
  }

  for (const id of ["appt-bare", "appt-null-prep", "appt-garbage-time", "appt-js-url", "appt-proto-url"]) {
    const opener = page.locator(`[data-appointment-id="${id}"][data-action="appointment-open"]`).first();
    if (!(await opener.count())) continue;
    await opener.click();
    text = await screenText(page);
    expect(text, `${id} must render without placeholder junk`).not.toMatch(/undefined|NaN|\[object|Invalid Date/i);
    expect(await page.locator('a[href^="javascript:"]').count(), "a javascript: URL must never become a link").toBe(0);
    expect(await page.locator('a[href^="//"]').count(), "a non-https join link must never be offered").toBe(0);
    await page.locator('[data-action="appointment-back"]').click();
    await openList(page, "UPCOMING");
  }

  expect(await page.locator('a[href^="javascript:"]').count()).toBe(0);
  expect(dialogs).toEqual([]);
  expect(errors).toEqual([]);
});

test("an empty slot in the stored appointment list does not take the screens down with it", async ({ page }) => {
  test.setTimeout(120000);
  const errors = watchPageErrors(page);
  await openWith(page, {
    appointments: [confirmedVisit({ id: "appt-real" }), null],
    screen: "MY_APPOINTMENTS"
  });

  await expect(screen(page)).toBeVisible();
  expect(await screenText(page)).not.toMatch(/undefined|NaN|\[object/i);
  await page.locator('[data-appointment-id="appt-real"][data-action="appointment-open"]').first().click();
  await expect(page.locator(".appointment-detail-screen")).toBeVisible();
  expect(errors, "a hole in the stored list must not break every appointment control").toEqual([]);
});

test("markup in a provider name, a practice, a location or a prep topic is escaped, never executed", async ({ page }) => {
  test.setTimeout(120000);
  const errors = watchPageErrors(page);
  const dialogs = watchDialogs(page);
  const scriptPayload = "<script>alert(1)</script>";
  const attrPayload = '"><img src=x onerror=alert(1)>';

  await openWith(page, {
    appointments: [confirmedVisit({
      id: "appt-xss",
      providerDisplayName: `Dr. ${scriptPayload}`,
      practiceName: `${attrPayload} Practice`,
      locationName: `${scriptPayload} Clinic`,
      locationAddress: `${attrPayload} Street`,
      requestedSpecialty: scriptPayload,
      reasonSummary: attrPayload,
      confirmationNumber: attrPayload,
      joinUrl: "",
      prep: { topics: [scriptPayload, attrPayload], notes: attrPayload, sharedWithProvider: false, updatedAt: "" }
    })]
  });

  await expect(screen(page)).toBeVisible();
  await page.locator('.appointment-card [data-action="appointment-open"]').first().click();
  await expect(page.locator(".appointment-detail-screen")).toBeVisible();

  const injected = async () => ({
    scripts: await screen(page).locator("script").count(),
    imgs: await screen(page).locator('img[src="x"]').count(),
    onerror: await screen(page).locator("[onerror]").count()
  });
  let counts = await injected();
  expect(counts.scripts, "no script element may be created from record data").toBe(0);
  expect(counts.imgs, "no img element may be created from record data").toBe(0);
  expect(counts.onerror).toBe(0);
  // The payload is present — as text.
  expect(await screenText(page)).toContain(scriptPayload);

  await page.locator('[data-action="appointment-open-prep"]').click();
  counts = await injected();
  expect(counts.scripts).toBe(0);
  expect(counts.imgs).toBe(0);
  expect(counts.onerror).toBe(0);
  expect(await screenText(page)).toContain(attrPayload);

  await page.locator('[data-action="appointment-open-brief"]').click();
  counts = await injected();
  expect(counts.scripts).toBe(0);
  expect(counts.imgs).toBe(0);
  expect(counts.onerror).toBe(0);

  expect(dialogs, "nothing in a record may execute").toEqual([]);
  expect(errors).toEqual([]);
});

/* ============================================================== §95 / §96 timezone + DST == */

// The first Sunday in November at 2am local is when US daylight saving ends. Two appointments a
// week either side of it, at the same UTC time of day, must read one hour apart.
const nextDstFallBack = (from = new Date()) => {
  for (let year = from.getUTCFullYear(); year <= from.getUTCFullYear() + 2; year += 1) {
    const first = new Date(Date.UTC(year, 10, 1));
    const sunday = new Date(Date.UTC(year, 10, 1 + ((7 - first.getUTCDay()) % 7)));
    if (sunday.getTime() > from.getTime() + 8 * 24 * 3600 * 1000) return sunday;
  }
  return null;
};

const wallClockIn = (iso, timeZone) => new Intl.DateTimeFormat("en-US", {
  timeZone, hour: "numeric", minute: "2-digit", hour12: true
}).format(new Date(iso)).replace(/ /g, " ");

test("§95/§96 appointment times are shown in the appointment's own zone across a DST boundary", async ({ page }) => {
  test.setTimeout(120000);
  const fallBack = nextDstFallBack();
  expect(fallBack, "a future DST fall-back is needed for this test").toBeTruthy();
  const beforeIso = new Date(fallBack.getTime() - 4 * 24 * 3600 * 1000 + 13.5 * 3600 * 1000).toISOString();
  const afterIso = new Date(fallBack.getTime() + 4 * 24 * 3600 * 1000 + 13.5 * 3600 * 1000).toISOString();
  const expectedBefore = wallClockIn(beforeIso, "America/New_York");
  const expectedAfter = wallClockIn(afterIso, "America/New_York");
  const expectedWest = wallClockIn(beforeIso, "America/Los_Angeles");
  expect(expectedBefore, "the fixture must actually straddle the DST change").not.toBe(expectedAfter);

  await openWith(page, {
    appointments: [
      confirmedVisit({ id: "appt-before-dst", scheduledAt: beforeIso, scheduledEndAt: beforeIso, timezone: "America/New_York" }),
      confirmedVisit({ id: "appt-after-dst", scheduledAt: afterIso, scheduledEndAt: afterIso, timezone: "America/New_York" }),
      confirmedVisit({ id: "appt-west", scheduledAt: beforeIso, scheduledEndAt: beforeIso, timezone: "America/Los_Angeles" })
    ]
  });
  await openList(page, "UPCOMING");
  await expect(page.locator(".appointment-card").first()).toBeVisible();

  const readCard = async id => {
    await page.locator(`[data-appointment-id="${id}"][data-action="appointment-open"]`).first().click();
    const text = await screenText(page);
    await page.locator('[data-action="appointment-back"]').click();
    await openList(page, "UPCOMING");
    return text;
  };

  const before = await readCard("appt-before-dst");
  expect(before, "an eastern appointment before the change must read in eastern wall-clock time").toContain(expectedBefore);
  expect(before).not.toMatch(/Invalid Date/);

  const after = await readCard("appt-after-dst");
  expect(after, "the same UTC time after the change is one hour earlier locally").toContain(expectedAfter);
  expect(after).not.toMatch(/Invalid Date/);

  const west = await readCard("appt-west");
  expect(west, "a Pacific appointment must read in Pacific wall-clock time").toContain(expectedWest);
  expect(west).not.toMatch(/Invalid Date/);
});

test.describe("a patient whose device clock is nowhere near their clinic", () => {
  test.use({ timezoneId: "Pacific/Honolulu" });

  test("§95 an in-app reminder is anchored to the appointment's timezone, not the device's", async ({ page }) => {
    test.setTimeout(120000);
    // 11:00 in New York, on a weekday well in the future. "The morning of the visit" is 8:00 in
    // New York — comfortably before it — no matter where the patient's phone thinks it is.
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 21);
    start.setUTCHours(15, 0, 0, 0);
    const scheduledAt = start.toISOString();

    await openWith(page, {
      appointments: [confirmedVisit({ id: "appt-tz", scheduledAt, scheduledEndAt: scheduledAt, timezone: "America/New_York" })]
    });
    await page.locator('.appointment-card [data-action="appointment-open"]').first().click();
    await page.locator('[data-action="appointment-open-reminder"]').click();
    await page.locator('[data-action="appointment-save-reminder"][data-slot="MORNING_OF"]').click();
    await page.waitForTimeout(200);

    const record = await recordById(page, "appt-tz");
    expect(record.reminder, "the morning-of reminder must be saveable for an out-of-zone patient (§95)").toBeTruthy();
    expect(record.reminder?.slot).toBe("MORNING_OF");
    const reminderHour = wallClockIn(record.reminder?.time || scheduledAt, "America/New_York");
    expect(reminderHour, "the reminder must land on the morning of the visit in the clinic's zone").toMatch(/^8:00 AM$/);
  });
});

/* ================================================================= §156 no device calendar = */

test("§156 nothing claims to write to the patient's own device calendar", async ({ page }) => {
  test.setTimeout(120000);
  await openWith(page, {
    appointments: [confirmedVisit()],
    careCirclePermissions: { receiveReminders: true, helpWithDeviceSetup: false, helpWithAppointments: true, receiveCareTasks: false, viewLimitedCareProgress: false }
  }, {}, [acceptedInvite()]);

  const forbidden = /add to (my )?calendar|\.ics\b|download.*calendar|calendar (app|file|invite)|google calendar|apple calendar|\boutlook\b|\bical\b|\bicalendar\b/i;
  const visit = async (label, open) => {
    await open();
    const text = await screenText(page);
    expect(text, `${label} must not offer a device calendar (§156, §60)`).not.toMatch(forbidden);
    expect(await page.locator('[data-action*="calendar"]').count(), `${label} must not carry a calendar action`).toBe(0);
  };

  await visit("My Care", async () => {});
  await visit("the list", () => openList(page, "UPCOMING"));
  await visit("the detail", () => page.locator('.appointment-card [data-action="appointment-open"]').first().click());
  await visit("prep", () => page.locator('[data-action="appointment-open-prep"]').click());
  await visit("the brief", () => page.locator('[data-action="appointment-open-brief"]').click());

  await page.locator('[data-action="appointment-back"]').click();
  await page.locator('.appointment-card [data-action="appointment-open"]').first().click();
  await visit("sharing", () => page.locator('[data-action="appointment-open-share"]').click());

  await page.locator('[data-action="appointment-back"]').click();
  await page.locator('.appointment-card [data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-open-reminder"]').click();
  const reminderText = await screenText(page);
  expect(reminderText).not.toMatch(forbidden);
  // §48-50: the one honest sentence about what a reminder is.
  expect(reminderText, "the reminder screen must say it cannot reach the patient's phone").toMatch(/will not send anything to your phone/i);
});

/* ======================================================================= empty + boundary == */

test("zero, one and many appointments all stay usable", async ({ page }) => {
  test.setTimeout(120000);
  const errors = watchPageErrors(page);

  // Zero.
  await openWith(page, { appointments: [] });
  await expect(screen(page)).toContainText(/Nothing is scheduled right now/i);
  await expect(page.locator('[data-action="appointment-ask-emmi"]').first()).toBeVisible();
  expect(await screenText(page)).not.toMatch(/undefined|NaN|\[object/i);

  // One.
  await openWith(page, { appointments: [confirmedVisit({ id: "appt-only" })] });
  expect(await page.locator(".appointment-card").count()).toBe(1);

  // Many.
  const many = Array.from({ length: 24 }, (_, index) => confirmedVisit({
    id: `appt-many-${index}`,
    scheduledAt: inDays(index + 2),
    scheduledEndAt: inDays(index + 2, 11),
    confirmationNumber: `CONF-${index}`
  }));
  await openWith(page, { appointments: many });

  // §38/§108: My Care is a summary, not the whole list.
  const onMyCare = await page.locator(".appointment-upcoming-care .appointment-card").count();
  expect(onMyCare, "My Care must summarise rather than list every visit").toBeLessThanOrEqual(3);
  await expect(page.locator('[data-action="appointment-open-list"]')).toBeVisible();

  await page.locator('[data-action="appointment-open-list"]').click();
  await expect(page.locator(".appointment-card").first()).toBeVisible();
  expect(await page.locator(".appointment-card").count()).toBeGreaterThan(3);

  // The page must never scroll sideways on a 384px screen, however many cards there are.
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(overflow.scrollWidth, "the list must not scroll horizontally").toBeLessThanOrEqual(overflow.clientWidth + 1);
  expect(await screenText(page)).not.toMatch(/undefined|NaN|\[object|Invalid Date/i);
  expect(errors).toEqual([]);
});

/* ====================================================================== known defect probe = */

// This is the flow the product actually builds: openAppointmentScheduling() creates a draft whose
// id is a generated `appointment_draft_*` value, and appointmentPreferenceView stamps that id onto
// every preference button as data-need-id. The click handler resolves data-need-id as an
// appointment id, finds nothing, and bounces the patient to the list. Every other test in this
// file works around it by seeding a draft whose id is the appointment id.
test("a preference answer advances the scheduling flow instead of dropping the patient", async ({ page }) => {
  test.setTimeout(120000);
  await openWith(page, {
    appointments: [bookingNeed()],
    screen: "APPOINTMENT_SCHEDULING"
  }, {
    activeAppointmentId: "appt-need",
    // The id the product itself generates for a draft — deliberately not the appointment id.
    appointmentDraft: schedulingDraft("appt-need", { id: "appointment_draft_mfk2p1" })
  });

  await expect(page.locator('div.appointment-preference-screen[data-step="PROVIDER"]')).toBeVisible();
  await page.locator('[data-action="appointment-preference-answer"][data-field="requestedProfessionalId"]').first().click();
  await page.waitForTimeout(150);
  await expect(
    page.locator(".appointment-preference-screen"),
    "answering a preference question must keep the patient in the scheduling flow"
  ).toBeVisible();
});

