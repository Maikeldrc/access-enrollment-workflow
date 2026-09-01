import { expect, test } from "@playwright/test";
import {
  DIRECT_BOOKING_PROVIDER,
  HUMAN_COORDINATION_PROVIDER,
  NO_CHANNEL_PROVIDER,
  STRUCTURED_REQUEST_PROVIDER,
  appointment,
  draft,
  inDays,
  seedAppointments
} from "./appointmentSurfaces.js";

// QA Agent 1 — scheduling workflows.
//
// Everything here is about the promise the product makes out loud. A confirmation may only appear
// when a real booking channel confirmed a real time; a request may never wear the word
// "confirmed"; a slot that vanished is nobody's fault; a cancellation happens because the patient
// said so twice, not once. The four capability levels are exercised through the fixture provider
// ids the scheduling module exports, so every test is unambiguous about which path it is on.

const DRAFT_KEY = "itera.enrollment.safe-draft.v2";
const NEED_ID = "appt-1";
// The vocabulary of a real appointment. A request, an escalation or a failure may use none of it.
const CONFIRMED_WORDS = /\bconfirmed\b|\bbooked\b|\bscheduled for\b|\bcita confirmada\b/i;
// On a screen that is explaining a failure, "nothing was booked" is the honest sentence, so only
// the claim of success is forbidden there.
const CLAIMS_SUCCESS = /\bconfirmed\b|\bcita confirmada\b|\brandevou konfime\b|\bis booked\b/i;
// §36/§37: the internal status vocabulary is for the machine. None of it may reach a patient.
const INTERNAL_STATUS_WORDS = /NEED_IDENTIFIED|COLLECTING_PREFERENCES|SEARCHING_AVAILABILITY|SLOTS_AVAILABLE|PENDING_PATIENT_SELECTION|WAITING_FOR_OFFICE|REQUEST_SENT|RESCHEDULE_REQUESTED|CANCEL_REQUESTED|UNABLE_TO_SCHEDULE|DIRECT_BOOKING|STRUCTURED_REQUEST|HUMAN_COORDINATION|NO_AVAILABLE_CHANNEL|IN_PERSON|TELEHEALTH|NO_PREFERENCE|ROUTINE_FOLLOW_UP/;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
});

/* ------------------------------------------------------------------ fixtures ------------- */

// An appointment need that has not been sent anywhere yet: no time, no confirmation number, and
// a status that says the patient is still answering questions.
const need = (overrides = {}) => appointment({
  status: "COLLECTING_PREFERENCES",
  reasonCategory: "",
  scheduledAt: "",
  scheduledEndAt: "",
  modality: "",
  locationName: "",
  confirmationNumber: "",
  confirmedAt: "",
  requestSentAt: "",
  preferredModality: "NO_PREFERENCE",
  preferredTimeOfDay: "NO_PREFERENCE",
  events: [],
  ...overrides
});

// The persisted draft shape (serializeAppointmentDraft's output). Seeding it is how a test starts
// mid-conversation with the provider already resolved, the way EMMI would have left it.
const schedulingDraft = (record, overrides = {}) => ({
  id: "appointment_draft_qa1",
  step: "",
  reasonCategory: record.reasonCategory || "",
  reasonSummary: "",
  requestedProfessionalId: record.requestedProfessionalId || null,
  requestedProfessionalType: record.requestedProfessionalType || "",
  requestedSpecialty: record.requestedSpecialty || "",
  providerDisplayName: record.providerDisplayName || "",
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

// src/appointments.js:450 — stable per patient + provider + action.
const requestKey = providerId => `appointment:patient_demo:${providerId}:none:REQUEST`;

/* ------------------------------------------------------------------ navigation ----------- */

// seedAppointments pins appointmentDraft to null and activeAppointmentId to "". The scheduling
// screen needs both, so the seeded draft is patched before the reload that boots the app.
const openScreen = async (page, { appointments = [], screen, activeAppointmentId = "", appointmentDraft = null, careTeamTasks = [] }) => {
  await page.goto("/?scenario=access-happy");
  // The app writes its own draft during boot; seeding before that settles lets it clobber the seed.
  await page.waitForSelector(".shell", { state: "attached", timeout: 30000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await seedAppointments(page, { appointments, screen });
  await page.evaluate(({ key, patch }) => {
    const saved = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...saved, ...patch }));
  }, { key: DRAFT_KEY, patch: { activeAppointmentId, appointmentDraft, careTeamTasks } });
  await page.reload();
  await page.waitForSelector("#screen-content", { state: "visible", timeout: 30000 });
};

const openScheduling = (page, record, draftOverrides = {}) => openScreen(page, {
  appointments: [record],
  screen: "APPOINTMENT_SCHEDULING",
  activeAppointmentId: record.id,
  appointmentDraft: schedulingDraft(record, draftOverrides)
});

const openDetail = (page, record) => openScreen(page, {
  appointments: [record],
  screen: "APPOINTMENT_DETAIL",
  activeAppointmentId: record.id
});

const answer = async (page, field, value) => {
  const selector = `[data-action="appointment-preference-answer"][data-field="${field}"][data-value="${value}"]`;
  await expect(page.locator(selector).first()).toBeVisible();
  await page.locator(selector).first().click();
};

const submitRequest = async page => {
  const selector = '[data-action="appointment-submit-request"]';
  await expect(page.locator(selector)).toBeVisible();
  await page.locator(selector).click();
};

const stepIs = (page, step) => expect(page.locator(`.appointment-preference-screen[data-step="${step}"]`)).toBeVisible();

// §26: one question per step, answered, then the next one. Nothing is sent along the way.
const walkPreferences = async (page, { provider, reason, modality = "NO_PREFERENCE", timeOfDay = "NO_PREFERENCE" }) => {
  await stepIs(page, "PROVIDER");
  await answer(page, "requestedProfessionalId", provider);
  await stepIs(page, "REASON");
  await answer(page, "reasonCategory", reason);
  await stepIs(page, "MODALITY");
  await answer(page, "preferredModality", modality);
  await stepIs(page, "TIME_OF_DAY");
  await answer(page, "preferredTimeOfDay", timeOfDay);
  if (await page.locator('[data-action="appointment-submit-request"][data-force="1"]').count()) return "DUPLICATE";
  await stepIs(page, "REVIEW");
  return "REVIEW";
};

// A real double tap: both clicks dispatched inside one task, before the app can re-render.
const doubleTap = async (page, selector) => {
  await expect(page.locator(selector).first()).toBeVisible();
  await page.evaluate(sel => {
    const first = document.querySelector(sel);
    first.click();
    const second = document.querySelector(sel);
    if (second) second.click();
  }, selector);
};

const storedAppointment = async (page, id = NEED_ID) => {
  const state = await draft(page);
  return (state.appointments || []).find(record => record.id === id) || null;
};

const appointmentTasks = state => (state.careTeamTasks || []).filter(task => task.type === "APPOINTMENT_REQUEST");

const screenText = page => page.locator("#screen-content").innerText();

const countEvents = (record, status) => (record.events || []).filter(event => event.status === status).length;

/* =============================================================== §136 direct booking ===== */

test("§136 direct booking: real slots, a real confirmation, and a CONFIRMED record", async ({ page }) => {
  test.setTimeout(120000);
  await openScheduling(page, need({ requestedProfessionalId: DIRECT_BOOKING_PROVIDER, providerDisplayName: "Dr. Fresner" }));

  await walkPreferences(page, { provider: DIRECT_BOOKING_PROVIDER, reason: "ROUTINE_FOLLOW_UP" });

  // Nothing is confirmed while the patient is still answering questions.
  expect((await storedAppointment(page)).status).toBe("COLLECTING_PREFERENCES");

  await submitRequest(page);

  // §31: real times, offered as tappable cards rather than as a calendar.
  const slots = page.locator('[data-action="appointment-select-slot"]');
  await expect(slots.first()).toBeVisible();
  expect(await screenText(page)).toContain("Choose a time");
  await expect(page.locator(".appointment-slot-screen table, .appointment-slot-screen .calendar")).toHaveCount(0);

  await slots.first().click();

  // §34: the confirmation screen says confirmed, names the provider, and shows the time.
  await expect(page.locator(".appointment-confirmation-screen")).toBeVisible();
  const confirmation = await screenText(page);
  expect(confirmation).toMatch(/confirmed/i);
  expect(confirmation).toContain("Dr. Fresner");
  await expect(page.locator(".appointment-hero-date")).not.toBeEmpty();

  // §17: and the stored record tells the same story.
  const record = await storedAppointment(page);
  expect(record.status).toBe("CONFIRMED");
  expect(record.confirmationNumber).toBeTruthy();
  expect(record.scheduledAt).toBeTruthy();
  expect(record.confirmedAt).toBeTruthy();
  // The operational confirmation remains on the record, but it is intentionally not exposed in
  // the patient UI; the useful next action there is See my list.
  expect(confirmation).not.toContain(record.confirmationNumber);
  expect(confirmation).toContain("See my list");
});

for (const provider of [
  { id: "dr-martinez-cardiology", name: "Dr. Pedro Martinez-Clark", reason: "SYMPTOM_REVIEW", modality: "IN_PERSON" },
  { id: "itera-care-manager", name: "Alicia Ramírez, RN", reason: "MEDICATION_RENEWAL", modality: "TELEHEALTH" }
]) {
  test(`the connected calendar always shows times for ${provider.name}`, async ({ page }) => {
    test.setTimeout(120000);
    await openScheduling(page, need({ requestedProfessionalId: provider.id, providerDisplayName: provider.name }));
    await walkPreferences(page, { provider: provider.id, reason: provider.reason, modality: provider.modality });
    await submitRequest(page);

    await expect(page.locator('[data-action="appointment-select-slot"]').first()).toBeVisible();
    expect(await screenText(page)).toContain("Choose a time");
    expect((await storedAppointment(page)).status).toBe("SLOTS_AVAILABLE");
  });
}

/* ============================================== §16 availability only where it is real ==== */

test("§16 a structured-request provider is never shown fabricated availability", async ({ page }) => {
  test.setTimeout(120000);
  await openScheduling(page, need({
    requestedProfessionalId: STRUCTURED_REQUEST_PROVIDER,
    providerDisplayName: "Dr. Martinez",
    requestedSpecialty: "Cardiology"
  }));

  await walkPreferences(page, { provider: STRUCTURED_REQUEST_PROVIDER, reason: "ROUTINE_FOLLOW_UP" });
  await submitRequest(page);

  await expect(page.locator('[data-action="appointment-select-slot"]')).toHaveCount(0);
  await expect(page.locator(".appointment-slot-screen")).toHaveCount(0);
  expect(await screenText(page)).not.toContain("Choose a time");
});

/* ==================================================================== §137 request ======== */

test("§137 a structured request reaches REQUEST_SENT and never says confirmed", async ({ page }) => {
  test.setTimeout(120000);
  await openScheduling(page, need({
    requestedProfessionalId: STRUCTURED_REQUEST_PROVIDER,
    providerDisplayName: "Dr. Martinez",
    requestedSpecialty: "Cardiology"
  }));

  await walkPreferences(page, { provider: STRUCTURED_REQUEST_PROVIDER, reason: "ROUTINE_FOLLOW_UP" });
  await submitRequest(page);

  await expect(page.locator(".appointment-request-screen")).toBeVisible();
  const text = await screenText(page);
  expect(text).toContain("Request sent");
  // §19/§35, asserted by absence: no confirmation word, no confirmed tone, no promised time.
  expect(text).not.toMatch(CONFIRMED_WORDS);
  await expect(page.locator(".appointment-request-screen .appointment-hero-date")).toHaveCount(0);
  await expect(page.locator('#screen-content [data-tone="CONFIRMED"]')).toHaveCount(0);

  const record = await storedAppointment(page);
  expect(record.status).toBe("REQUEST_SENT");
  expect(record.requestSentAt).toBeTruthy();
  expect(record.scheduledAt).toBeFalsy();
  expect(record.confirmationNumber).toBeFalsy();
});

/* ============================================================= §138 human coordination ==== */

test("§138 human coordination creates a care-team task and says a person is coordinating", async ({ page }) => {
  test.setTimeout(120000);
  await openScheduling(page, need({
    requestedProfessionalId: HUMAN_COORDINATION_PROVIDER,
    providerDisplayName: "Alicia Ramírez, RN"
  }));

  await walkPreferences(page, {
    provider: HUMAN_COORDINATION_PROVIDER,
    reason: "MEDICATION_RENEWAL",
    modality: "TELEHEALTH",
    timeOfDay: "AFTERNOON"
  });
  await submitRequest(page);

  await expect(page.getByRole("heading", { name: "Your care team is coordinating this" })).toBeVisible();

  const text = await screenText(page);

  // §22: a structured task, not a transcript, and not a booking — and written to the store by the
  // submit itself, so the care team can see it without some later screen happening to save.
  const tasks = appointmentTasks(await draft(page));
  expect(tasks).toHaveLength(1);
  expect(tasks[0].needId).toBe(NEED_ID);
  expect(tasks[0].status).toBe("OPEN");
  expect(JSON.stringify(tasks[0].summary)).not.toMatch(/transcript/i);

  // §21: the patient is told a person is arranging this — not that an office was written to.
  expect(text).not.toMatch(CONFIRMED_WORDS);
  expect(text, "the human-coordination path renders the office-request screen verbatim")
    .toMatch(/care team|equipo|ekip/i);

  await expect(page.getByRole("heading", { name: "Appointment confirmed" })).toBeVisible({ timeout: 10000 });
  const confirmed = await storedAppointment(page);
  expect(confirmed).toMatchObject({ status: "CONFIRMED", modality: "TELEHEALTH", timezone: "America/New_York" });
  expect(confirmed.scheduledAt).toBeTruthy();
  expect(confirmed.confirmationNumber).toMatch(/^ITERA-[0-9A-Z]{7}$/);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Appointment confirmed" })).toBeVisible();
  const restored = await storedAppointment(page);
  expect(restored.scheduledAt).toBe(confirmed.scheduledAt);
  expect(restored.confirmationNumber).toBe(confirmed.confirmationNumber);
});

test("a pending appointment receives the simulated service confirmation and survives reload", async ({ page }) => {
  test.setTimeout(120000);
  const requestedAt = new Date(Date.now() - 60_000).toISOString();
  const pending = need({
    status: "REQUEST_SENT",
    requestedProfessionalId: HUMAN_COORDINATION_PROVIDER,
    requestedProfessionalType: "CARE_MANAGER",
    providerDisplayName: "Alicia Ramírez, RN",
    reasonCategory: "MEDICATION_RENEWAL",
    preferredModality: "TELEHEALTH",
    preferredTimeOfDay: "AFTERNOON",
    requestSentAt: requestedAt,
    updatedAt: requestedAt,
    events: [{ status: "REQUEST_SENT", source: "ITERA", actor: "PATIENT", at: requestedAt, detail: null }]
  });
  await openScreen(page, { appointments: [pending], screen: "MY_APPOINTMENTS" });

  await expect(page.getByText("Appointment confirmed")).toBeVisible({ timeout: 10000 });
  const confirmed = await storedAppointment(page);
  expect(confirmed.status).toBe("CONFIRMED");
  expect(confirmed.scheduledAt).toBeTruthy();
  expect(confirmed.confirmationNumber).toMatch(/^ITERA-[0-9A-Z]{7}$/);

  await page.reload();
  await expect(page.getByText("Appointment confirmed")).toBeVisible();
  const restored = await storedAppointment(page);
  expect(restored.scheduledAt).toBe(confirmed.scheduledAt);
  expect(restored.confirmationNumber).toBe(confirmed.confirmationNumber);
});

/* ============================================================ §23 no available channel ==== */

test("§23 a provider with no scheduling channel is refused plainly and still offered a next step", async ({ page }) => {
  test.setTimeout(120000);
  await openScheduling(page, need({
    requestedProfessionalId: NO_CHANNEL_PROVIDER,
    providerDisplayName: "Coral Way Imaging"
  }));

  await walkPreferences(page, { provider: NO_CHANNEL_PROVIDER, reason: "OTHER" });
  await submitRequest(page);

  const text = await screenText(page);
  // §23: a real supported next action, so the patient is never left at a dead end.
  await expect(page.locator('[data-action="appointment-ask-care-team"], [data-action="appointment-ask-emmi"], [data-action="appointment-open-list"]').first()).toBeVisible();
  // Nothing may claim a booking.
  expect(text).not.toMatch(CONFIRMED_WORDS);
  // And nothing may claim an office is now waiting on this, because there is no channel to it.
  expect.soft(text, "the no-channel path claims a request was sent to an office it cannot reach")
    .not.toMatch(/request was sent|solicitud fue enviada|waiting for the office|esperando a la oficina/i);
  // §23 in the spec's own words: say plainly that this cannot be scheduled here.
  expect.soft(text, "the patient is never told this cannot be scheduled directly")
    .toMatch(/can(?:not|'t|’t) (?:schedule|book)|no puedo programar|pa ka pwograme/i);
});

/* =================================================================== §124 race =========== */

test("§124 a slot that vanished sends the patient back to real times without blaming them", async ({ page }) => {
  test.setTimeout(120000);
  // A narrow date range is the only way the designated stale fixture lands inside the three cards
  // the picker renders — see the "See more times" test for why the full list cannot reach it.
  const record = need({
    requestedProfessionalId: DIRECT_BOOKING_PROVIDER,
    providerDisplayName: "Dr. Fresner",
    preferredDateRange: { from: new Date().toISOString(), to: inDays(6) }
  });
  await openScheduling(page, record, { preferredDateRange: record.preferredDateRange });

  await walkPreferences(page, { provider: DIRECT_BOOKING_PROVIDER, reason: "ROUTINE_FOLLOW_UP" });
  await submitRequest(page);

  const stale = page.locator('[data-action="appointment-select-slot"][data-slot-id$="|STALE"]');
  await expect(stale).toHaveCount(1);
  await stale.click();

  // No confirmation, anywhere.
  await expect(page.locator(".appointment-confirmation-screen")).toHaveCount(0);
  await expect(page.locator(".appointment-slot-screen")).toBeVisible();
  const text = await screenText(page);
  expect(text).not.toMatch(CONFIRMED_WORDS);
  // Back to the times that are still real, with an explanation.
  expect(text).toMatch(/just taken|acaba de ocuparse|fèk pran/i);
  await expect(page.locator('[data-action="appointment-select-slot"]').first()).toBeVisible();
  // §124: the patient did nothing wrong, and the copy may not suggest otherwise.
  expect(text).not.toMatch(/too (?:slow|late)|you waited|your fault|try harder|should have/i);

  const stored = await storedAppointment(page);
  expect(stored.status).toBe("SLOTS_AVAILABLE");
  expect(stored.confirmationNumber).toBeFalsy();
  expect(stored.confirmedAt).toBeFalsy();
});

/* ================================================================= §123 booking failure == */

test("§123 a booking that fails never reaches CONFIRMED", async ({ page }) => {
  test.setTimeout(120000);
  await openScheduling(page, need({ requestedProfessionalId: DIRECT_BOOKING_PROVIDER, providerDisplayName: "Dr. Fresner" }));

  await walkPreferences(page, { provider: DIRECT_BOOKING_PROVIDER, reason: "ROUTINE_FOLLOW_UP" });
  await submitRequest(page);
  await expect(page.locator('[data-action="appointment-select-slot"]').first()).toBeVisible();

  // The office refuses the hold: the slot this card carries is not one that provider holds. The
  // reason does not matter — the only acceptable outcome is that nothing is confirmed.
  await page.evaluate(() => {
    const card = document.querySelector('[data-action="appointment-select-slot"]');
    const parts = card.dataset.slotId.split("|");
    parts[1] = "provider-that-does-not-hold-this-slot";
    card.dataset.slotId = parts.join("|");
  });
  await page.locator('[data-action="appointment-select-slot"]').first().click();

  const stored = await storedAppointment(page);
  expect(stored.status).not.toBe("CONFIRMED");
  expect(stored.confirmationNumber).toBeFalsy();
  expect(stored.scheduledAt).toBeFalsy();
  expect(stored.confirmedAt).toBeFalsy();
  expect(countEvents(stored, "CONFIRMED")).toBe(0);

  const text = await screenText(page);
  expect(text).not.toMatch(CLAIMS_SUCCESS);
  expect(text).toMatch(/nothing was booked|no se reservó nada|anyen pa t rezève/i);
});

/* ==================================================================== §125 idempotency === */

test("§125 double-tapping a slot produces exactly one appointment", async ({ page }) => {
  test.setTimeout(120000);
  await openScheduling(page, need({ requestedProfessionalId: DIRECT_BOOKING_PROVIDER, providerDisplayName: "Dr. Fresner" }));

  await walkPreferences(page, { provider: DIRECT_BOOKING_PROVIDER, reason: "ROUTINE_FOLLOW_UP" });
  await submitRequest(page);

  await doubleTap(page, '[data-action="appointment-select-slot"]');
  await expect(page.locator(".appointment-confirmation-screen")).toBeVisible();

  const state = await draft(page);
  expect(state.appointments).toHaveLength(1);
  const record = state.appointments[0];
  expect(record.status).toBe("CONFIRMED");
  // One booking, one confirmation. A second trip through the machine would show up here.
  expect(countEvents(record, "CONFIRMED")).toBe(1);
  expect(countEvents(record, "BOOKING")).toBe(1);
});

test("§125 double-tapping submit sends exactly one request", async ({ page }) => {
  test.setTimeout(120000);
  await openScheduling(page, need({
    requestedProfessionalId: STRUCTURED_REQUEST_PROVIDER,
    providerDisplayName: "Dr. Martinez"
  }));

  await walkPreferences(page, { provider: STRUCTURED_REQUEST_PROVIDER, reason: "ROUTINE_FOLLOW_UP" });
  await doubleTap(page, '[data-action="appointment-submit-request"]');
  await expect(page.locator(".appointment-request-screen")).toBeVisible();

  const state = await draft(page);
  expect(state.appointments).toHaveLength(1);
  expect(countEvents(state.appointments[0], "REQUEST_SENT")).toBe(1);
  // §126's sibling: one intent, one task for the care team to work.
  expect(appointmentTasks(state)).toHaveLength(1);
});

/* ================================================= §126 cancel / reschedule idempotency == */

test("§126 confirming a cancellation twice cancels once", async ({ page }) => {
  test.setTimeout(120000);
  await openDetail(page, appointment());

  await page.locator('[data-action="appointment-request-cancel"]').click();
  await doubleTap(page, '[data-action="appointment-confirm-cancel"]');

  const record = await storedAppointment(page);
  expect(record.status).toBe("CANCELED");
  expect(countEvents(record, "CANCELED")).toBe(1);
  expect(countEvents(record, "CANCEL_REQUESTED")).toBe(1);
  expect(record.canceledAt).toBeTruthy();
});

test("§126 asking for a change twice requests one change", async ({ page }) => {
  test.setTimeout(120000);
  await openDetail(page, appointment());

  await doubleTap(page, '[data-action="appointment-request-reschedule"]');

  const record = await storedAppointment(page);
  expect(record.status).toBe("RESCHEDULE_REQUESTED");
  expect(countEvents(record, "RESCHEDULE_REQUESTED")).toBe(1);
  expect(appointmentTasks(await draft(page))).toHaveLength(1);
});

/* ============================================================ §12 / §63 / §64 cancel ===== */

test("§63 the first tap on cancel does not cancel: it asks", async ({ page }) => {
  test.setTimeout(120000);
  await openDetail(page, appointment());

  await page.locator('[data-action="appointment-request-cancel"]').click();

  // Nothing has happened to the record yet.
  let record = await storedAppointment(page);
  expect(record.status).toBe("CONFIRMED");
  expect(record.canceledAt).toBeFalsy();

  // §63: both ways out are offered, and the appointment is named in the question.
  const text = await screenText(page);
  expect(text).toMatch(/cancel this appointment\?|¿cancelar esta cita\?/i);
  expect(text).toContain("Dr. Fresner");
  await expect(page.locator('[data-action="appointment-confirm-cancel"]')).toBeVisible();
  const keep = page.locator('#screen-content [data-action="appointment-open"]').last();
  await expect(keep).toBeVisible();

  // Keeping it keeps it.
  await keep.click();
  record = await storedAppointment(page);
  expect(record.status).toBe("CONFIRMED");

  // Only the explicit second yes cancels.
  await page.locator('[data-action="appointment-request-cancel"]').click();
  await page.locator('[data-action="appointment-confirm-cancel"]').click();
  record = await storedAppointment(page);
  expect(record.status).toBe("CANCELED");
  expect(record.canceledAt).toBeTruthy();
});

/* ==================================================================== §61 / §62 change === */

test("§61 asking to change a time is its own workflow and does not cancel the visit", async ({ page }) => {
  test.setTimeout(120000);
  const existing = appointment();
  await openDetail(page, existing);

  await page.locator('[data-action="appointment-request-reschedule"]').click();

  const record = await storedAppointment(page);
  // §62: the original stands until something confirms a new time.
  expect(record.status).toBe("RESCHEDULE_REQUESTED");
  expect(record.canceledAt).toBeFalsy();
  expect(record.scheduledAt).toBe(existing.scheduledAt);
  // §61: a change is routed by capability and reaches the care team.
  expect(appointmentTasks(await draft(page))).toHaveLength(1);

  const text = await screenText(page);
  expect(text).not.toMatch(/\bcanceled\b|\bcancelled\b|\bcancelada\b/i);
  expect(text).toContain("Dr. Fresner");
});

/* ============================================================ §26 one question at a time == */

test("§26 every preference step asks exactly one question", async ({ page }) => {
  test.setTimeout(120000);
  await openScheduling(page, need({ requestedProfessionalId: DIRECT_BOOKING_PROVIDER, providerDisplayName: "Dr. Fresner" }));

  const assertOneQuestion = async step => {
    await stepIs(page, step);
    await expect(page.locator(".appointment-preference-screen h1")).toHaveCount(1);
    const fields = await page.locator('[data-action="appointment-preference-answer"]').evaluateAll(
      nodes => [...new Set(nodes.map(node => node.dataset.field))]
    );
    expect(fields, `step ${step} asks about more than one thing`).toHaveLength(1);
    // §25: never a form with ten inputs.
    expect(await page.locator(".appointment-preference-screen input, .appointment-preference-screen select").count()).toBeLessThanOrEqual(1);
  };

  await assertOneQuestion("PROVIDER");
  await answer(page, "requestedProfessionalId", DIRECT_BOOKING_PROVIDER);
  await assertOneQuestion("REASON");
  await answer(page, "reasonCategory", "ROUTINE_FOLLOW_UP");
  await assertOneQuestion("MODALITY");
  await answer(page, "preferredModality", "NO_PREFERENCE");
  await assertOneQuestion("TIME_OF_DAY");
  await answer(page, "preferredTimeOfDay", "MORNING");
  await stepIs(page, "REVIEW");
  // §80: the review restates the answers. It does not send them.
  expect((await storedAppointment(page)).status).toBe("COLLECTING_PREFERENCES");
});

test("§30 only the modalities this office supports are offered", async ({ page }) => {
  test.setTimeout(120000);
  await openScheduling(page, need({
    requestedProfessionalId: STRUCTURED_REQUEST_PROVIDER,
    providerDisplayName: "Dr. Martinez"
  }));
  await stepIs(page, "PROVIDER");
  await answer(page, "requestedProfessionalId", STRUCTURED_REQUEST_PROVIDER);
  await stepIs(page, "REASON");
  await answer(page, "reasonCategory", "ROUTINE_FOLLOW_UP");
  await stepIs(page, "MODALITY");

  // The structured-request fixture supports office and video visits, and not the phone.
  await expect(page.locator('[data-field="preferredModality"][data-value="IN_PERSON"]')).toBeVisible();
  await expect(page.locator('[data-field="preferredModality"][data-value="TELEHEALTH"]')).toBeVisible();
  await expect(page.locator('[data-field="preferredModality"][data-value="PHONE"]')).toHaveCount(0);
});

/* =============================================== §27 / §35 who the appointment is with === */

test("§35 confirming the provider does not erase who the appointment is with", async ({ page }) => {
  test.setTimeout(120000);
  await openScheduling(page, need({
    requestedProfessionalId: STRUCTURED_REQUEST_PROVIDER,
    providerDisplayName: "Dr. Martinez",
    requestedSpecialty: "Cardiology"
  }));

  await stepIs(page, "PROVIDER");
  expect(await screenText(page)).toContain("Dr. Martinez");
  await answer(page, "requestedProfessionalId", STRUCTURED_REQUEST_PROVIDER);

  // The patient said "yes, that's right". The name may not disappear because of it. This id is in
  // the locally built care team, so confirming it adopts that record's own verified name — which is
  // the opposite of inventing a provider, and never an empty one.
  const confirmed = (await storedAppointment(page)).providerDisplayName;
  expect(confirmed, "confirming a provider must never blank the name").toBeTruthy();
  expect(confirmed, "a care team member is named by their own record").toBe("Dr. Pedro Martinez");
});

test("§35 a provider the care team does not carry keeps the name the need was created with", async ({ page }) => {
  test.setTimeout(120000);
  await openScheduling(page, need({
    requestedProfessionalId: "dr-not-in-care-team",
    providerDisplayName: "Dr. Okafor",
    requestedSpecialty: "Endocrinology"
  }));

  await stepIs(page, "PROVIDER");
  await answer(page, "requestedProfessionalId", "dr-not-in-care-team");
  // Nothing local can confirm this person, so nothing local may overwrite them either.
  expect((await storedAppointment(page)).providerDisplayName).toBe("Dr. Okafor");
});

/* ======================================================= §80 / §81 / §127 draft ========== */

test("§127 leaving mid-flow and coming back submits nothing", async ({ page }) => {
  test.setTimeout(120000);
  await openScheduling(page, need({ requestedProfessionalId: DIRECT_BOOKING_PROVIDER, providerDisplayName: "Dr. Fresner" }));

  await stepIs(page, "PROVIDER");
  await answer(page, "requestedProfessionalId", DIRECT_BOOKING_PROVIDER);
  await stepIs(page, "REASON");
  await answer(page, "reasonCategory", "BLOOD_PRESSURE_FOLLOW_UP");
  await stepIs(page, "MODALITY");
  await answer(page, "preferredModality", "IN_PERSON");
  await stepIs(page, "TIME_OF_DAY");

  // The patient closes the app here.
  await page.reload();

  const state = await draft(page);
  const record = (state.appointments || [])[0];
  // §81: nothing was sent, nothing was booked, and nobody was asked to do anything.
  expect(record.status).toBe("COLLECTING_PREFERENCES");
  expect(record.requestSentAt).toBeFalsy();
  expect(record.confirmationNumber).toBeFalsy();
  expect(record.scheduledAt).toBeFalsy();
  expect(appointmentTasks(state)).toHaveLength(0);

  // §80: the answers survived.
  expect(state.appointmentDraft).toBeTruthy();
  expect(state.appointmentDraft.reasonCategory).toBe("BLOOD_PRESSURE_FOLLOW_UP");
  expect(state.appointmentDraft.preferredModality).toBe("IN_PERSON");
  expect(state.appointmentDraft.requestedProfessionalId).toBe(DIRECT_BOOKING_PROVIDER);

  // And the patient is not looking at a confirmation or at a request they never sent.
  await expect(page.locator(".appointment-confirmation-screen, .appointment-request-screen")).toHaveCount(0);
  expect(await screenText(page)).not.toMatch(CONFIRMED_WORDS);
});

/* =============================================================== §82 / §83 duplicates ==== */

test("§83 an existing upcoming appointment with the same provider is surfaced before another is requested", async ({ page }) => {
  test.setTimeout(120000);
  const existing = appointment({ id: "appt-existing", requestedProfessionalId: DIRECT_BOOKING_PROVIDER, scheduledAt: inDays(9), scheduledEndAt: inDays(9, 11) });
  const second = need({ id: NEED_ID, requestedProfessionalId: DIRECT_BOOKING_PROVIDER, providerDisplayName: "Dr. Fresner" });

  await openScreen(page, {
    appointments: [existing, second],
    screen: "APPOINTMENT_SCHEDULING",
    activeAppointmentId: second.id,
    appointmentDraft: schedulingDraft(second)
  });

  const landed = await walkPreferences(page, { provider: DIRECT_BOOKING_PROVIDER, reason: "ROUTINE_FOLLOW_UP" });

  // §83: before anything is sent, the patient is told what they already have.
  expect(landed).toBe("DUPLICATE");
  expect(await screenText(page), "the patient is never told about the appointment they already have")
    .toMatch(/already have|ya tiene|deja gen/i);
  // And both real choices are offered rather than a dead end.
  await expect(page.locator('[data-action="appointment-open"]').first()).toBeVisible();
  await expect(page.locator('[data-action="appointment-submit-request"][data-force="1"]')).toBeVisible();
});

test("§82 a pending request for the same provider is not silently duplicated", async ({ page }) => {
  test.setTimeout(120000);
  const pending = appointment({
    id: "appt-pending",
    status: "REQUEST_SENT",
    requestedProfessionalId: STRUCTURED_REQUEST_PROVIDER,
    providerDisplayName: "Dr. Martinez",
    scheduledAt: "",
    scheduledEndAt: "",
    confirmationNumber: "",
    confirmedAt: "",
    requestSentAt: new Date().toISOString(),
    idempotencyKey: requestKey(STRUCTURED_REQUEST_PROVIDER),
    events: [{ status: "REQUEST_SENT", source: "ITERA", actor: "PATIENT", at: new Date().toISOString(), detail: null }]
  });
  const second = need({ id: NEED_ID, requestedProfessionalId: STRUCTURED_REQUEST_PROVIDER, providerDisplayName: "Dr. Martinez" });

  await openScreen(page, {
    appointments: [pending, second],
    screen: "APPOINTMENT_SCHEDULING",
    activeAppointmentId: second.id,
    appointmentDraft: schedulingDraft(second)
  });

  const landed = await walkPreferences(page, { provider: STRUCTURED_REQUEST_PROVIDER, reason: "ROUTINE_FOLLOW_UP" });
  expect(landed).toBe("DUPLICATE");

  const state = await draft(page);
  const secondRecord = (state.appointments || []).find(record => record.id === NEED_ID);
  // §82: one office, one open request. The idempotency key does its job here.
  expect((state.appointments || []).filter(record => record.status === "REQUEST_SENT")).toHaveLength(1);

  // The second need must not be presented as sent. The screen may still name the status of the
  // request the patient genuinely does have, so this asserts the record and the screen's framing
  // rather than searching for a phrase that is true of the other request.
  expect(secondRecord.requestSentAt).toBe("");
  expect(await screenText(page), "the patient is not warned about the request already waiting")
    .toMatch(/already have|ya tiene|deja gen/i);
});

/* ============================================================ §36 / §37 internal status == */

test("§37 no internal status string ever reaches the patient", async ({ page }) => {
  test.setTimeout(120000);
  const waiting = appointment({
    id: "appt-waiting",
    status: "WAITING_FOR_OFFICE",
    scheduledAt: "",
    scheduledEndAt: "",
    confirmationNumber: "",
    confirmedAt: "",
    requestSentAt: new Date().toISOString(),
    providerDisplayName: "Dr. Fresner"
  });
  const choosing = appointment({
    id: "appt-choosing",
    status: "PENDING_PATIENT_SELECTION",
    scheduledAt: "",
    scheduledEndAt: "",
    confirmationNumber: "",
    confirmedAt: "",
    providerDisplayName: "Dr. Fresner"
  });

  // My Care.
  await openScreen(page, { appointments: [waiting, choosing], screen: "MY_CARE" });
  expect(await screenText(page)).not.toMatch(INTERNAL_STATUS_WORDS);

  // The list, on every tab.
  await page.locator('[data-action="appointment-open-list"]').first().click();
  for (const tab of ["UPCOMING", "REQUESTS", "PAST"]) {
    await page.locator(`[data-action="appointment-list-tab"][data-tab="${tab}"]`).click();
    expect(await screenText(page), `${tab} tab leaks an internal status`).not.toMatch(INTERNAL_STATUS_WORDS);
  }

  // The detail screen for a request.
  await openScreen(page, { appointments: [waiting], screen: "APPOINTMENT_DETAIL", activeAppointmentId: waiting.id });
  const detail = await screenText(page);
  expect(detail).not.toMatch(INTERNAL_STATUS_WORDS);
  expect(detail).toMatch(/waiting for confirmation|esperando confirmación/i);
});

/* ====================================================== §31 the way to see more times ==== */

test("§31 “See more times” shows the times it found", async ({ page }) => {
  test.setTimeout(120000);
  await openScheduling(page, need({ requestedProfessionalId: DIRECT_BOOKING_PROVIDER, providerDisplayName: "Dr. Fresner" }));

  await walkPreferences(page, { provider: DIRECT_BOOKING_PROVIDER, reason: "ROUTINE_FOLLOW_UP" });
  await submitRequest(page);

  const slots = page.locator('[data-action="appointment-select-slot"]');
  await expect(slots.first()).toBeVisible();
  const initial = await slots.count();
  // §32: a small recommended set first — never a dense grid.
  expect(initial).toBeLessThanOrEqual(3);

  const more = page.locator('[data-action="appointment-more-times"]');
  await expect(more).toBeVisible();
  await more.click();

  // The record holds more times than the screen showed, and this button exists to reveal them.
  const stored = await storedAppointment(page);
  expect(stored.proposedTimes.length).toBeGreaterThan(initial);
  expect(await slots.count(), "the widened search never reaches the screen").toBeGreaterThan(initial);
});

/* ================================================== §26 the flow's own first question ==== */

// The flow's entry point, pinned on its own: the button the product renders, tapped once, must
// move the patient to the next question rather than dropping them out of the flow.
test("§26 answering the first question moves the patient to the second one", async ({ page }) => {
  test.setTimeout(120000);
  await openScheduling(page, need({ requestedProfessionalId: DIRECT_BOOKING_PROVIDER, providerDisplayName: "Dr. Fresner" }));

  await stepIs(page, "PROVIDER");
  await page.locator('[data-action="appointment-preference-answer"][data-field="requestedProfessionalId"]').first().click();

  await expect(page.locator(".appointment-preference-screen"),
    "the first answer drops the patient out of the scheduling flow entirely").toBeVisible();
  await stepIs(page, "REASON");
  expect((await storedAppointment(page)).requestedProfessionalId).toBe(DIRECT_BOOKING_PROVIDER);
});
