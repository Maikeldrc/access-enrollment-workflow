import { expect, test } from "@playwright/test";
import { openEmmiConversation } from "./emmiSurfaces.js";
import {
  DIRECT_BOOKING_PROVIDER,
  acceptedInvite,
  appointment,
  draft,
  inDays,
  openAppointments,
  seedCareCircle
} from "./appointmentSurfaces.js";

// Everything around an appointment that is not the booking itself: what EMMI is allowed to say
// about a visit, what she must refuse to do because a message asked her to, and the four things
// that happen around the visit — preparing for it, being reminded of it, being able to get to it,
// and being asked afterwards whether it happened.
//
// The rule the whole file exists to defend: this product may not tell a patient something untrue
// about their care. Not a visit they do not have, not a booking that did not happen, not a doctor
// it has never heard of, and not a reminder it has no way to deliver.

const PLACEHOLDER = { en: "Ask a question…", es: "Haga una pregunta…", ht: "Poze yon kesyon…" };
const SEND = { en: "Send question", es: "Enviar pregunta", ht: "Voye kesyon" };
const DRAFT_KEY = "itera.enrollment.safe-draft.v2";

const screenText = page => page.locator("#screen-content").innerText();
const storedAppointments = async page => (await draft(page)).appointments || [];

// One helper for every EMMI turn in this file, so a test says what the patient typed and nothing
// about which of EMMI's three presentations happened to be on screen when they typed it.
async function tellEmmi(page, text, locale = "en") {
  const panel = page.locator(".assistant-layer");
  if (!(await panel.isVisible().catch(() => false))) await openEmmiConversation(page);
  // "EMMI is thinking…" is an assistant row too, so it is excluded here — otherwise a turn that
  // never lands would be read as the answer.
  const answers = panel.locator(".assistant-message.assistant:not(.assistant-thinking)");
  const before = await answers.count();
  await panel.getByPlaceholder(PLACEHOLDER[locale]).fill(text);
  await panel.getByRole("button", { name: SEND[locale] }).click();
  await expect(answers).toHaveCount(before + 1, { timeout: 25000 });
  // A turn that failed leaves the patient with a connection error instead of an answer, and every
  // assertion downstream would be about the wrong thing.
  await expect(panel.locator(".assistant-error"), `EMMI failed to answer "${text}"`).toHaveCount(0);
  return answers.last();
}

const closeEmmi = async page => {
  await page.locator(".assistant-close").click();
  await expect(page.locator(".assistant-layer")).toHaveCount(0);
};

// A goal has to exist for a difficulty to attach to, exactly as in goal-barriers.spec.js. This is
// the same record that spec seeds, trimmed to the one action an appointment barrier hangs from.
const bpGoal = () => ({
  id: "goal-bp", patientId: "DEMO-P001", goalType: "BLOOD_PRESSURE_CONTROL", title: "Keep my blood pressure under control",
  status: "ACTIVE", priority: "PRIMARY", planStatus: "COMPLETED", planPersonalizationStatus: "COMPLETED",
  goalSource: "PATHWAY", selectedBy: "PATIENT", whyItMatters: "",
  actions: [{ id: "action-bp", goalId: "goal-bp", templateId: "check-bp", title: "Check my blood pressure regularly", actionType: "RECURRING", source: "CARE_PLAN", frequency: "few-days", targetCount: 5, schedule: null, remindersEnabled: false, status: "ACTIVE", completionHistory: [], createdAt: "2026-08-01T10:00:00.000Z", updatedAt: "2026-08-01T10:00:00.000Z" }],
  progress: [], educationHistory: [], barriers: [], supportRequests: [], reviews: [],
  createdBy: "PATHWAY", createdAt: "2026-08-01T10:00:00.000Z", updatedAt: "2026-08-01T10:00:00.000Z"
});

// Two screens this spec has to reach cannot be reached the way a patient would.
//
//   APPOINTMENT_SCHEDULING — nothing in the product opens it except EMMI's startAppointmentRequest.
//   APPOINTMENT_DETAIL for a past visit — My Care lists only upcoming visits and open requests,
//   and its "See all appointments" link is rendered only when one of those exists, so a patient
//   whose only visit already happened has no route to it at all.
//
// Landing there through the persisted draft keeps the product's own render path intact, and the
// two entry-point tests below assert that the missing routes are the only thing in the way.
const landOn = async (page, screen, activeAppointmentId = "") => {
  await page.evaluate(([key, target, id]) => {
    const stored = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...stored, screen: target, activeAppointmentId: id }));
  }, [DRAFT_KEY, screen, activeAppointmentId]);
  await page.reload();
};

// Action handlers are bound per element when a screen renders (src/app.js:6012) and read
// el.dataset.action at click time, so borrowing a control that is already on screen is the only
// way to reach a handler whose own button the product never renders.
const dispatchVia = (page, selector, action, dataset = {}) => page.evaluate(([target, name, attrs]) => {
  const el = document.querySelector(target);
  if (!el) throw new Error(`no bound control matching ${target}`);
  el.setAttribute("data-action", name);
  Object.entries(attrs).forEach(([key, value]) => { el.dataset[key] = value; });
  el.click();
}, [selector, action, dataset]);

// One answer per step, in the order APPOINTMENT_PREFERENCE_STEPS declares them.
const answerPreference = async (page, field, value) => {
  const choice = page.locator(`[data-action="appointment-preference-answer"][data-field="${field}"][data-value="${value}"]`).first();
  await expect(choice).toBeVisible();
  await choice.click();
};

const backToDetail = async page => {
  await page.locator('[data-action="appointment-back"], [data-action="appointment-open"]').first().click();
  if (!(await page.locator(".appointment-detail-screen").count())) {
    await page.locator('[data-action="appointment-open"]').first().click();
  }
  await expect(page.locator(".appointment-detail-screen")).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
});

/* --------------------------------------------------------------------- §3 §4 §5 §133 §139 --- */

test("a symptom that also asks for a visit goes to clinical safety, not to scheduling", async ({ page }) => {
  await openAppointments(page, { appointments: [] });
  const answer = await tellEmmi(page, "I need a cardiology appointment because I have severe chest pain.");

  await expect(answer).toContainText(/urgent medical attention|call 911/i);
  // Not one word about preferences, times or a request: the appointment flow did not run.
  await expect(answer).not.toContainText(/morning|afternoon|appointment request|available/i);
  await expect(page.locator(".assistant-emergency-action")).toBeVisible();

  // §139: nothing was created. A safety statement is not a scheduling instruction.
  expect(await storedAppointments(page)).toHaveLength(0);
  await closeEmmi(page);
  await expect(page.locator(".appointment-preference-screen")).toHaveCount(0);
});

test("the same sentence in Spanish is answered by the safety engine, not by the calendar", async ({ page }) => {
  await openAppointments(page, { appointments: [], language: "es" });
  const answer = await tellEmmi(page, "Necesito una cita con cardiología porque tengo un dolor fuerte en el pecho.", "es");

  // §4: clinical safety outranks appointment coordination, in every language. This is the exact
  // sentence spec §3 uses as its example.
  await expect(answer).toContainText(/atención médica urgente|llame al 911|tarea de alta prioridad|equipo de atención/i);
  await expect(answer).not.toContainText(/solicitud de cita|mañana o tarde|horarios disponibles/i);
  expect(await storedAppointments(page)).toHaveLength(0);
  await closeEmmi(page);
  await expect(page.locator(".appointment-preference-screen")).toHaveCount(0);
});

test("a reading inside an appointment sentence is a reading, never a date", async ({ page }) => {
  await openAppointments(page, { appointments: [] });
  const answer = await tellEmmi(page, "Can I get an appointment? My blood pressure was 180 over 120 this morning.");

  await expect(answer).not.toContainText(/appointment request|I opened|available/i);
  expect(await storedAppointments(page)).toHaveLength(0);
});

/* -------------------------------------------------------------------------- §41 §42 §120 ---- */

test("when is my appointment is answered from the record, with the provider the record carries", async ({ page }) => {
  await openAppointments(page, { appointments: [appointment()] });
  const answer = await tellEmmi(page, "When is my next appointment?");

  // §120/§42: the answer comes from getUpcomingAppointments, so it names the seeded provider and
  // the seeded status — and never says there is nothing on file.
  await expect(answer).toContainText("Dr. Fresner");
  await expect(answer).toContainText(/Appointment confirmed/i);
  await expect(answer).not.toContainText(/don’t see an appointment|do not see an appointment/i);
  // §11: no provider, specialty or practice the record does not carry.
  await expect(answer).not.toContainText(/Martinez|Cardiolog/i);
});

test("a patient with no appointment is told so, and is never told about one", async ({ page }) => {
  await openAppointments(page, { appointments: [] });
  const answer = await tellEmmi(page, "When is my next appointment?");

  await expect(answer).toContainText(/don’t see an appointment on file/i);
  // Nothing invented: no provider, no day, no time.
  await expect(answer).not.toContainText(/Fresner|Martinez|Monday|Tuesday|Wednesday|Thursday|Friday|\d{1,2}:\d{2}/i);
  expect(await storedAppointments(page)).toHaveLength(0);
});

test("Continue with this appointment opens the request EMMI just created", async ({ page }) => {
  await openAppointments(page, { appointments: [] });
  const answer = await tellEmmi(page, "I need help with an appointment.");
  const continueButton = answer.getByRole("button", { name: "Continue with this appointment" });

  await expect(continueButton).toBeVisible();
  const needId = await continueButton.getAttribute("data-need-id");
  expect(needId).toBeTruthy();
  expect((await storedAppointments(page)).map(item => item.id)).toContain(needId);

  await continueButton.click();

  await expect(page.locator(".assistant-layer")).toHaveCount(0);
  await expect(page.locator('.appointment-preference-screen[data-step="REASON"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "What would you like to be seen for?" })).toBeVisible();
  await expect(page.locator(".appointment-list-screen")).toHaveCount(0);
});

test("a request that is waiting for the office is never described as confirmed", async ({ page }) => {
  await openAppointments(page, {
    appointments: [appointment({
      id: "appt-req", status: "WAITING_FOR_OFFICE", providerDisplayName: "Dr. Fresner",
      confirmationNumber: "", confirmedAt: "", locationName: ""
    })]
  });
  const answer = await tellEmmi(page, "Is my appointment confirmed?");

  await expect(answer).toContainText(/Waiting for confirmation/i);
  await expect(answer).not.toContainText(/\bconfirmed for\b|\bis confirmed\b|\bbooked\b/i);
});

/* ---------------------------------------------------------------------------- §134 §140 ----- */

test("asking again for the provider the patient already has surfaces that visit instead of duplicating it", async ({ page }) => {
  await openAppointments(page, { appointments: [appointment()] });
  const answer = await tellEmmi(page, "I need to see Dr. Fresner.");

  await expect(answer).toContainText(/already have an appointment/i);
  await expect(answer).toContainText("Dr. Fresner");
  // §140: no second record, and no second request.
  const stored = await storedAppointments(page);
  expect(stored).toHaveLength(1);
  expect(stored[0].id).toBe("appt-1");
});

/* ------------------------------------------------------------------ §11 §12 §13 §141 -------- */

test("a specialty the product has never heard of never becomes a provider", async ({ page }) => {
  test.setTimeout(120000);
  await openAppointments(page, { appointments: [] });
  const answer = await tellEmmi(page, "I need an appointment with my dermatologist.");

  // §12: not a dead end, and not a directory search this product does not have.
  await expect(answer).not.toContainText(/dermatolog/i);
  await closeEmmi(page);

  const screen = await screenText(page);
  // §11: nothing on screen names a doctor, a specialty or a practice the runtime did not confirm.
  expect(screen).not.toMatch(/dermatolog/i);
  expect(screen).not.toMatch(/Dr\.\s(?!Fresner)[A-Z]/);
  // §13: the request that was opened carries no invented professional at all.
  const stored = await storedAppointments(page);
  expect(stored).toHaveLength(1);
  expect(stored[0].providerDisplayName).toBe("");
  expect(stored[0].requestedSpecialty).toBe("");
  expect(stored[0].practiceName).toBe("");
});

test("choosing who to see offers only the care team the runtime actually knows", async ({ page }) => {
  await openAppointments(page, {
    appointments: [appointment({
      id: "need-1", status: "COLLECTING_PREFERENCES", requestedProfessionalId: "", providerDisplayName: "",
      schedulingCapability: "", scheduledAt: "", scheduledEndAt: "", confirmationNumber: "", confirmedAt: "", locationName: ""
    })]
  });
  await landOn(page, "APPOINTMENT_SCHEDULING", "need-1");
  await expect(page.locator('.appointment-preference-screen[data-step="PROVIDER"]')).toBeVisible();

  const options = await page.locator('[data-action="appointment-preference-answer"][data-field="requestedProfessionalId"]').allInnerTexts();
  // Every option is either a care-team member the runtime knows or the patient's way out. The
  // recorded cardiologist is available; unrelated specialties are never conjured.
  expect(options.join(" | ")).toMatch(/Dr\. Pedro Martinez.*Cardiology/i);
  // The care manager is offered with the same patient-facing role used by the care-team screen
  // and the add-a-professional form.
  expect(options.join(" | ")).toMatch(/Alicia Ramírez.*Care Manager/i);
  expect(options.join(" | ")).not.toMatch(/ITERA HEALTH|CVS Pharmacy|dermatolog|nephrolog|endocrinolog/i);
  expect(options.some(option => /Someone else/i.test(option))).toBe(true);
  expect(await screenText(page)).toMatch(/Dr\. Pedro Martinez/);
});

test("a substituted physician name never borrows the fixture's specialty or practice", async ({ page }) => {
  await openAppointments(page, { appointments: [appointment()] });

  // src/careTeamDirectory.js blanks specialty and practice when a configured display name arrived
  // wearing the fixture provider's record. Checked against the module the browser actually loaded.
  const team = await page.evaluate(async () => {
    const { buildCareTeam } = await import("/src/careTeamDirectory.js");
    return buildCareTeam({
      offer: {
        referringProvider: { id: "dr-fresner", name: "Dr. Amelia Kohl", specialty: "Primary Care", practiceName: "Fresner Medical Group" },
        physician: { id: "dr-amelia-kohl", displayName: "Dr. Amelia Kohl" }
      }
    });
  });
  const member = team.find(item => item.displayName === "Dr. Amelia Kohl");
  expect(member).toBeTruthy();
  expect(member.specialty).toBe("");
  expect(member.practiceName).toBe("");
  expect(member.id).not.toBe("dr-fresner");
  expect(member.verified).toBe(false);

  // And the screens print only what the record carries: this one has no specialty and no practice.
  await page.locator('[data-action="appointment-open"]').first().click();
  await expect(page.locator(".appointment-specialty")).toHaveCount(0);
  await expect(page.locator(".appointment-practice")).toHaveCount(0);
  expect(await screenText(page)).not.toMatch(/Primary Care/i);
});

/* ------------------------------------------------------------------------ §64 §144 ---------- */

test("saying cancel does not cancel: EMMI asks, and the record is untouched until a yes", async ({ page }) => {
  test.setTimeout(120000);
  await openAppointments(page, { appointments: [appointment()] });
  const answer = await tellEmmi(page, "Cancel my appointment.");

  await expect(answer).toContainText(/won’t cancel an appointment just because a message says so/i);
  await expect(answer).toContainText(/Nothing is cancelled until you confirm/i);

  // §64: the mere mention changed nothing at all.
  const afterMention = await storedAppointments(page);
  expect(afterMention[0].status).toBe("CONFIRMED");
  expect(afterMention[0].canceledAt).toBe("");

  // The explicit yes is the only thing that cancels it.
  const confirmed = await tellEmmi(page, "Yes");
  await expect(confirmed).toContainText(/is canceled/i);
  expect((await storedAppointments(page))[0].status).toBe("CANCELED");
});

test("a reason for missing a visit is not a reason to cancel one", async ({ page }) => {
  await openAppointments(page, { appointments: [appointment()], patientGoals: [bpGoal()] });
  const answer = await tellEmmi(page, "I can’t go on Tuesday because I don’t have a ride.");

  await expect(answer).not.toContainText(/cancel/i);
  // §53/§135: the appointment stands; the difficulty is what gets recorded.
  expect((await storedAppointments(page))[0].status).toBe("CONFIRMED");
});

test("the cancel button asks a second time on its own screen", async ({ page }) => {
  await openAppointments(page, { appointments: [appointment()] });
  await page.locator('[data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-request-cancel"]').click();

  await expect(page.getByRole("heading", { name: /Cancel this appointment\?/ })).toBeVisible();
  // Backing out changes nothing.
  await page.locator('[data-action="appointment-open"]').click();
  expect((await storedAppointments(page))[0].status).toBe("CONFIRMED");
});

/* --------------------------------------------------------------------- §51 §52 §53 §113 ----- */

test("the pre-visit check routes a transportation answer into a barrier category that exists", async ({ page }) => {
  test.setTimeout(120000);
  await openAppointments(page, { appointments: [appointment()], patientGoals: [bpGoal()] });
  await page.locator('[data-action="appointment-open"]').first().click();
  await dispatchVia(page, '[data-action="appointment-open-prep"]', "appointment-barrier-answer", { appointmentId: "appt-1", barrierReason: "TRANSPORTATION" });
  await expect(page.locator(".appointment-detail-screen")).toBeVisible();

  const stored = await draft(page);
  const barrier = stored.patientGoals[0].barriers.at(-1);
  // §52: the category is one src/goalBarriers.js already owns — the taxonomy did not grow.
  expect(barrier.category).toBe("TRANSPORTATION");
  expect(barrier.status).not.toBe("RESOLVED");
  // §53: the appointment itself is untouched. A missing ride is not a cancellation.
  expect(stored.appointments[0].status).toBe("CONFIRMED");
  expect(stored.appointments[0].relatedBarrierId).toBe(barrier.id);
});

test("saying nothing is wrong at the pre-visit check records no difficulty", async ({ page }) => {
  await openAppointments(page, { appointments: [appointment()], patientGoals: [bpGoal()] });
  await page.locator('[data-action="appointment-open"]').first().click();
  await dispatchVia(page, '[data-action="appointment-open-prep"]', "appointment-barrier-answer", { appointmentId: "appt-1", barrierReason: "ALL_SET" });

  expect((await draft(page)).patientGoals[0].barriers).toHaveLength(0);
});

test("the pre-visit check has an entry point a patient can reach", async ({ page }) => {
  await openAppointments(page, { appointments: [appointment()] });
  await page.locator('[data-action="appointment-open"]').first().click();
  // §51: "Is there anything that could make it difficult to attend?" has to be askable. The screen
  // exists (appointmentBarrierCheckView) but no data-action anywhere opens it.
  await expect(page.locator('[data-action="appointment-barrier-answer"], [data-action="appointment-open-barrier"], [data-action="appointment-pre-visit-check"]').first()).toBeVisible({ timeout: 5000 });
});

/* --------------------------------------------------------------- §54 §55 §56 §114 §147 ------ */

const PERMISSIONS = (helpWithAppointments, extra = {}) => ({
  receiveReminders: false, helpWithDeviceSetup: false, helpWithAppointments, receiveCareTasks: false, viewLimitedCareProgress: false, ...extra
});

const openShare = async page => {
  await page.locator('[data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-open-share"]').click();
};

test("sharing is unavailable while nobody has accepted an invitation", async ({ page }) => {
  await openAppointments(page, { appointments: [appointment()], careCirclePermissions: PERMISSIONS(true) });
  await openShare(page);

  await expect(page.locator(".appointment-share-screen .appointment-empty")).toBeVisible();
  await expect(page.locator('[data-action="appointment-share-with-member"]')).toHaveCount(0);
});

test("an accepted member without the appointments permission still cannot be shared with", async ({ page }) => {
  await openAppointments(page, {
    appointments: [appointment()],
    careCirclePermissions: PERMISSIONS(false, { receiveReminders: true, helpWithDeviceSetup: true })
  });
  await seedCareCircle(page, { invites: [acceptedInvite()] });
  await page.reload();
  await openShare(page);

  // §54: two independent facts are required, and only one of them is true here.
  await expect(page.locator('[data-action="appointment-share-with-member"]')).toHaveCount(0);
  // Permission off means the names are not offered either.
  expect(await screenText(page)).not.toMatch(/Ana/);
});

test("with a member and the permission, sharing sends when and where — and nothing clinical", async ({ page }) => {
  test.setTimeout(120000);
  await openAppointments(page, {
    appointments: [appointment({
      reasonSummary: "My chest feels tight when I walk upstairs",
      prep: { topics: ["My blood pressure has been higher this week"], notes: "", sharedWithProvider: false, updatedAt: "" }
    })],
    careCirclePermissions: PERMISSIONS(true, { receiveReminders: true, helpWithDeviceSetup: true })
  });
  await seedCareCircle(page, { invites: [acceptedInvite()] });
  await page.reload();
  await openShare(page);

  await expect(page.getByText("Ana")).toBeVisible();
  // §55, stated before the patient shares: this is a disclosure, not access.
  const before = await screenText(page);
  expect(before).toMatch(/does not give access to your health record/i);
  // The clinical reason and the prep list are not on the sharing screen at all.
  expect(before).not.toMatch(/chest feels tight/i);
  expect(before).not.toMatch(/blood pressure has been higher/i);

  await page.locator('[data-action="appointment-share-with-member"]').click();

  const shared = (await storedAppointments(page))[0].sharedWith;
  expect(shared).toHaveLength(1);
  expect(shared[0].scope).toBe("APPOINTMENT_SHARE_V1");
  // §55/§115: the payload is an allow-list. Everything clinical is absent by construction.
  const payloadKeys = Object.keys(shared[0].payload);
  expect(payloadKeys).toEqual(expect.arrayContaining(["scheduledAt", "providerDisplayName", "locationName"]));
  for (const forbidden of ["reasonSummary", "reasonCategory", "prep", "joinUrl", "confirmationNumber", "relatedGoalId", "patientId"]) {
    expect(payloadKeys, `${forbidden} must never be shared`).not.toContain(forbidden);
  }
  expect(JSON.stringify(shared[0].payload)).not.toMatch(/chest feels tight|blood pressure has been higher/i);
});

test("the sharing screen never promises the Care Circle something the product cannot deliver", async ({ page }) => {
  await openAppointments(page, { appointments: [appointment()], careCirclePermissions: PERMISSIONS(true) });
  await seedCareCircle(page, { invites: [acceptedInvite()] });
  await page.reload();
  await openShare(page);

  // §56 resolves receiveAppointmentReminder as permitted-but-undeliverable: there is no channel to
  // a Care Circle member from inside ITERA. The screen must not list it as something they receive.
  const receives = await page.locator(".appointment-share-list").first().innerText();
  expect(receives).not.toMatch(/reminder/i);
});

/* ------------------------------------------------------------------ §48 §49 §50 §145 -------- */

test("the reminder screen says plainly that a reminder only ever appears inside ITERA", async ({ page }) => {
  await openAppointments(page, { appointments: [appointment()] });
  await page.locator('[data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-open-reminder"]').click();

  const screen = await screenText(page);
  expect(screen).toMatch(/Reminders appear in ITERA when you open it/i);
  expect(screen).toMatch(/We will not send anything to your phone/i);
  // §50: no channel this product does not have.
  expect(screen).not.toMatch(/\bSMS\b|text message|e-?mail|push notification|we will send you|we’ll send|notify you|call you/i);

  // §49: nothing was created by opening the screen.
  expect((await storedAppointments(page))[0].reminder).toBeNull();

  await page.locator('[data-action="appointment-save-reminder"][data-slot="DAY_BEFORE"]').click();
  expect((await storedAppointments(page))[0].reminder).toMatchObject({ slot: "DAY_BEFORE", channel: "IN_APP" });
});

test("choosing a reminder tells the patient it was saved", async ({ page }) => {
  await openAppointments(page, { appointments: [appointment()] });
  await page.locator('[data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-open-reminder"]').click();
  await page.locator('[data-action="appointment-save-reminder"][data-slot="DAY_BEFORE"]').click();

  // §48/§145: the reminder exists, so the patient is told — and told what a reminder is here.
  expect((await storedAppointments(page))[0].reminder).toBeTruthy();
  expect(await screenText(page)).toMatch(/reminder|Reminders appear in ITERA/i);
});

test("no appointment surface anywhere promises a phone, text or email notification", async ({ page }) => {
  test.setTimeout(120000);
  await openAppointments(page, {
    appointments: [appointment()],
    careCirclePermissions: PERMISSIONS(true, { receiveReminders: true, helpWithDeviceSetup: true })
  });
  await seedCareCircle(page, { invites: [acceptedInvite()] });
  await page.reload();

  const promise = /\bSMS\b|text message|e-?mail|push notification|text you|we will send you|we’ll send you|notification to your phone|call you when/i;
  expect(await screenText(page), "My Care").not.toMatch(promise);

  await page.locator('[data-action="appointment-open"]').first().click();
  expect(await screenText(page), "appointment detail").not.toMatch(promise);

  for (const view of ["appointment-open-reminder", "appointment-open-share", "appointment-open-prep"]) {
    await page.locator(`[data-action="${view}"]`).click();
    expect(await screenText(page), view).not.toMatch(promise);
    if (view === "appointment-open-prep") {
      await page.locator('[data-action="appointment-open-brief"]').click();
      expect(await screenText(page), "appointment brief").not.toMatch(promise);
    }
    await backToDetail(page);
  }
});

/* ------------------------------------------------------------------ §65 §66 §67 §68 §148 ---- */

const seedPastVisit = async (page, extra = {}) => {
  await openAppointments(page, {
    appointments: [appointment({ scheduledAt: inDays(-2), scheduledEndAt: inDays(-2, 11), confirmedAt: inDays(-9) })],
    patientGoals: [bpGoal()],
    ...extra
  });
  await landOn(page, "APPOINTMENT_DETAIL", "appt-1");
  await expect(page.locator('[data-action="appointment-followup-attendance"]').first()).toBeVisible();
};

const answerAttendance = (page, outcome) =>
  page.locator(`[data-action="appointment-followup-attendance"][data-outcome="${outcome}"]`).first().click();

test("the after-visit answer is recorded and opens help rather than a verdict", async ({ page }) => {
  await seedPastVisit(page);
  await answerAttendance(page, "ATTENDED");

  const stored = await storedAppointments(page);
  expect(stored[0].attendanceOutcome).toBe("ATTENDED");
  expect(stored[0].status).toBe("COMPLETED");
  // §66: what the visit left behind, offered as help rather than as a form.
  const screen = await screenText(page);
  expect(screen).toMatch(/Is there anything from the visit you need help with\?/i);
  expect(screen).toMatch(/next steps/i);
});

test("a visit that did not happen is answered without a word of blame", async ({ page }) => {
  test.setTimeout(120000);
  await seedPastVisit(page);
  await answerAttendance(page, "MISSED");

  const screen = await screenText(page);
  // §68: never accusatory, and never adherence language.
  expect(screen).not.toMatch(/you missed|you failed|you did not show|you didn’t show|non-?compliant|noncompliance|why didn’t you/i);
  expect(screen).toMatch(/help (me )?find(ing)? another time|help rescheduling|another time/i);

  const stored = await draft(page);
  expect(stored.appointments[0].status).toBe("NO_SHOW");
  // §67: the visit that did not happen becomes a difficulty with an owner, not a mark on a chart.
  expect(stored.patientGoals[0].barriers.at(-1).category).toBe("APPOINTMENT_NEED");
});

test("a rescheduled visit is asked for the new time rather than being given one", async ({ page }) => {
  await seedPastVisit(page);
  await answerAttendance(page, "RESCHEDULED");

  const stored = await storedAppointments(page);
  expect(stored[0].attendanceOutcome).toBe("RESCHEDULED");
  expect(stored[0].status).toBe("RESCHEDULE_REQUESTED");
  // §69: no invented date anywhere.
  expect(await screenText(page)).not.toMatch(/is now scheduled for|new appointment is confirmed/i);
});

test("help rescheduling a missed visit opens a new request rather than resurrecting the old one", async ({ page }) => {
  test.setTimeout(120000);
  await seedPastVisit(page);
  await answerAttendance(page, "MISSED");
  await page.locator('[data-action="appointment-followup-reschedule"][data-answer="YES"]').click();

  await expect(page.locator(".appointment-preference-screen")).toBeVisible();
  const stored = await storedAppointments(page);
  expect(stored).toHaveLength(2);
  expect(stored.find(record => record.id !== "appt-1").source).toBe("FOLLOW_UP");
  // The missed visit stays missed; it was not quietly reopened.
  expect(stored.find(record => record.id === "appt-1").status).toBe("NO_SHOW");
});

test("a patient whose visit has already happened can reach it, and is asked how it went", async ({ page }) => {
  await openAppointments(page, {
    appointments: [appointment({ scheduledAt: inDays(-2), scheduledEndAt: inDays(-2, 11), confirmedAt: inDays(-9) })]
  });
  // §65: appointmentFollowUpDue() says a follow-up is due. Something has to ask it — and My Care
  // has to offer a way to the visit in the first place.
  // My Care offers the way in; the list opens on the tab that actually has something in it.
  await expect(page.locator('[data-action="appointment-open"], [data-action="appointment-open-list"]').first()).toBeVisible({ timeout: 5000 });
  await page.locator('[data-action="appointment-open"], [data-action="appointment-open-list"]').first().click();
  const openVisit = page.locator('[data-action="appointment-open"]').first();
  if (await openVisit.count()) await openVisit.click();
  await expect(page.locator('[data-action="appointment-followup-attendance"]').first()).toBeVisible({ timeout: 5000 });
});

/* ------------------------------------------------------------------------ §43 §45 §47 ------- */

test("the patient writes what they want to discuss, removes what they change their mind about, and chooses when it is sent", async ({ page }) => {
  test.setTimeout(120000);
  await openAppointments(page, { appointments: [appointment()] });
  await page.locator('[data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-open-prep"]').click();

  await page.locator("#appointment-prep-topic").fill("My blood pressure has been higher this week");
  await page.locator('[data-action="appointment-add-prep-topic"]').click();
  await page.locator("#appointment-prep-topic").fill("I have a question about my medication");
  await page.locator('[data-action="appointment-add-prep-topic"]').click();
  await expect(page.locator(".appointment-topics li")).toHaveCount(2);

  await page.locator('[data-action="appointment-remove-prep-topic"][data-topic-index="0"]').click();
  await expect(page.locator(".appointment-topics li")).toHaveCount(1);
  await expect(page.locator(".appointment-topics")).toContainText("question about my medication");

  await page.locator('[data-action="appointment-open-brief"]').click();
  // §47: nothing has gone anywhere yet, and the screen says so.
  let screen = await screenText(page);
  expect(screen).toMatch(/Not shared yet/i);
  expect(screen).toMatch(/Nothing is sent to your care team until you choose to share it/i);
  expect((await storedAppointments(page))[0].prep.sharedWithProvider).toBe(false);

  await page.locator('[data-action="appointment-share-brief"]').click();
  screen = await screenText(page);
  expect(screen).toMatch(/Shared with your care team/i);
  expect((await storedAppointments(page))[0].prep.sharedWithProvider).toBe(true);
  expect((await draft(page)).careTeamTasks.at(-1)).toBeTruthy();
});

test("Prepare with EMMI opens the confirmed appointment conversation and preserves the prep list", async ({ page }) => {
  await openAppointments(page, { appointments: [appointment()] });
  const previousAnswer = await tellEmmi(page, "What does an A1c result mean?");
  await expect(previousAnswer).toContainText(/A1c/i);
  await closeEmmi(page);

  await page.locator('[data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-open-prep"]').click();

  await page.locator("#appointment-prep-topic").fill("readings");
  await page.locator('[data-action="appointment-add-prep-topic"]').click();
  await page.locator("#appointment-prep-topic").fill("medicamentos");
  await page.locator('[data-action="appointment-add-prep-topic"]').click();
  await expect(page.locator(".appointment-topics")).toContainText("readings");
  await expect(page.locator(".appointment-topics")).toContainText("medicamentos");

  await page.locator('[data-action="appointment-ask-emmi"]').click();

  const panel = page.locator(".assistant-layer");
  await expect(panel).toBeVisible();
  // The button is navigation, so it must not impersonate the patient with a generic question.
  await expect(panel.locator(".assistant-message.user")).toHaveCount(1);
  await expect(panel.locator(".assistant-message.user").last()).toContainText("What does an A1c result mean?");
  const prepOpening = panel.locator(".assistant-message.assistant:not(.assistant-thinking)").last();
  await expect(prepOpening).toContainText("Let’s prepare for your appointment with Dr. Fresner.");
  await expect(prepOpening).toContainText("readings");
  await expect(prepOpening).toContainText("medicamentos");
  await expect(prepOpening).toContainText("Which topic would you like to start with?");
  await expect(prepOpening).not.toContainText("What a particular A1c result means");
  await expect(panel.locator(".assistant-error")).toHaveCount(0);

  const storedWhileOpen = await storedAppointments(page);
  expect(storedWhileOpen[0].status).toBe("CONFIRMED");
  expect(storedWhileOpen[0].prep.topics).toEqual(["readings", "medicamentos"]);

  await closeEmmi(page);
  await expect(page.locator(".appointment-prep-screen")).toBeVisible();
  await expect(page.locator(".appointment-topics")).toContainText("readings");
  await expect(page.locator(".appointment-topics")).toContainText("medicamentos");
});

/* ------------------------------------------------------------------------ §122 §123 §124 ---- */

const startScheduling = async (page, { id, reason }) => {
  await openAppointments(page, {
    appointments: [appointment({
      id, status: "COLLECTING_PREFERENCES", requestedProfessionalId: "", providerDisplayName: "",
      schedulingCapability: "", scheduledAt: "", scheduledEndAt: "", confirmationNumber: "", confirmedAt: "",
      locationName: "", reasonCategory: ""
    })]
  });
  await landOn(page, "APPOINTMENT_SCHEDULING", id);
  await answerPreference(page, "requestedProfessionalId", DIRECT_BOOKING_PROVIDER);
  await answerPreference(page, "reasonCategory", reason);
  await answerPreference(page, "preferredModality", "IN_PERSON");
  await answerPreference(page, "preferredTimeOfDay", "NO_PREFERENCE");
  await expect(page.locator('.appointment-preference-screen[data-step="REVIEW"]')).toBeVisible();
  await page.locator('[data-action="appointment-submit-request"]').click();
};

test("a time that could not be held is never shown as booked", async ({ page }) => {
  test.setTimeout(120000);
  // ROUTINE_FOLLOW_UP is one of this office's directly bookable types, so real times come back.
  await startScheduling(page, { id: "need-1", reason: "ROUTINE_FOLLOW_UP" });
  await expect(page.locator(".appointment-slot").first()).toBeVisible();

  // §124: the last slot in every availability response is the one the office already gave away.
  await page.locator('[data-action="appointment-more-times"]').click();
  await page.locator(".appointment-slot").last().click();

  const screen = await screenText(page);
  expect(screen).not.toMatch(/\bConfirmed\b/i);
  expect(screen).toMatch(/just taken|Nothing was booked|could not/i);
  const stored = (await storedAppointments(page)).find(record => record.id === "need-1");
  expect(stored.status).not.toBe("CONFIRMED");
  expect(stored.confirmationNumber).toBe("");

  // §123: and EMMI, asked straight afterwards, does not claim a booking either.
  const answer = await tellEmmi(page, "Is my appointment confirmed?");
  await expect(answer).not.toContainText(/Appointment confirmed/i);
});

test("a visit this office will not book directly becomes a request, never a confirmation", async ({ page }) => {
  test.setTimeout(120000);
  // SYMPTOM_REVIEW is not in this office's directBookingTypes, so the capability downgrades.
  await startScheduling(page, { id: "need-2", reason: "SYMPTOM_REVIEW" });

  // §137: a request is a request. No slots, no confirmation, no invented time.
  await expect(page.locator(".appointment-slot")).toHaveCount(0);
  const screen = await screenText(page);
  expect(screen).toMatch(/Waiting for the office|Request sent|not confirmed/i);
  expect(screen).not.toMatch(/\bConfirmed\b|Confirmation number/i);
  expect((await storedAppointments(page)).find(record => record.id === "need-2").status).not.toBe("CONFIRMED");
});

/* ---------------------------------------------------------------------------- §151 ---------- */

test("a whole appointment conversation works in Spanish", async ({ page }) => {
  test.setTimeout(120000);
  await openAppointments(page, { appointments: [appointment()], language: "es" });
  const answer = await tellEmmi(page, "¿Cuándo es mi próxima cita?", "es");

  await expect(answer).toContainText("Dr. Fresner");
  await expect(answer).toContainText(/Cita confirmada/i);
  await expect(answer).not.toContainText(/Here is what I have|appointment confirmed/i);
  await closeEmmi(page);

  await page.locator('[data-action="appointment-open"]').first().click();
  const screen = await screenText(page);
  expect(screen).not.toMatch(/[가-힯]/);
  expect(screen).toMatch(/Cita confirmada/i);
  expect(screen).not.toMatch(/Prepare with EMMI|Remind me in the app|Share with my Care Circle|Back to My Care|Get directions|Cancel appointment/i);
});

test("a whole appointment conversation works in Kreyòl, with no English and no Korean", async ({ page }) => {
  test.setTimeout(120000);
  await openAppointments(page, { appointments: [appointment()], language: "ht" });
  const answer = await tellEmmi(page, "Kilè pwochen randevou mwen ye?", "ht");

  // §151: Kreyòl is KR internally and must never be resolved as Korean.
  await expect(answer).not.toContainText(/[가-힯]/);
  await expect(answer).toContainText(/Randevou konfime/i);
  await expect(answer).not.toContainText(/Here is what I have on file|Appointment confirmed/i);
  await closeEmmi(page);

  await page.locator('[data-action="appointment-open"]').first().click();
  const screen = await screenText(page);
  expect(screen).not.toMatch(/[가-힯]/);
  expect(screen).toMatch(/Randevou konfime/i);
  expect(screen).not.toMatch(/Prepare with EMMI|Remind me in the app|Share with my Care Circle|Back to My Care|Get directions|Change the time|Cancel appointment/i);
  expect(screen).not.toMatch(/⟦/);
});

/* ------------------------------------------------------------------------ §76 §77 §149 ------ */

test("EMMI stays one conversation across an appointment navigation", async ({ page }) => {
  test.setTimeout(120000);
  await openAppointments(page, { appointments: [appointment()] });
  await tellEmmi(page, "When is my next appointment?");
  await closeEmmi(page);

  // The patient goes and looks at the visit, then comes back to the same conversation.
  await page.locator('[data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-open-prep"]').click();
  await openEmmiConversation(page);

  // §77: one EMMI. Not two panels, not two conversations.
  await expect(page.locator(".assistant-layer")).toHaveCount(1);
  const panel = await page.locator(".assistant-layer").innerText();
  expect(panel, "the earlier turn is still in the conversation").toContain("When is my next appointment?");

  const answer = await tellEmmi(page, "Can I move it?");
  await expect(answer).not.toContainText(/^\s*(Hi|Hello)\b/i);
  await expect(answer).toContainText(/change your appointment|Let’s change/i);
});

test("EMMI does not introduce herself again once the conversation has started", async ({ page }) => {
  await openAppointments(page, { appointments: [appointment()] });
  await tellEmmi(page, "When is my next appointment?");
  await closeEmmi(page);
  await page.locator('[data-action="appointment-open"]').first().click();
  await openEmmiConversation(page);

  // §76/§149: "Hi, I’m EMMI" belongs to the first meeting and nowhere else.
  expect(await page.locator(".assistant-layer").innerText()).not.toMatch(/Hi, I’m EMMI/i);
});

