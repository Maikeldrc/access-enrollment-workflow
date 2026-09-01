import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { appointment, draft, inDays, openAppointments } from "./appointmentSurfaces.js";

// The four stories the demo has to be able to tell, walked the way a person would walk them.
//
// These are deliberately click-through rather than dispatch-through: the point of this feature is
// that a patient can get from "I have no way to get there" to a booked ride without leaving the
// appointment, and only a real walk proves that. tests/barrierResolution.test.js owns the state
// machine, tests/barrierProviders.test.js owns the simulated world, and
// tests/barrierResolutionViews.test.js owns what every step renders; this file owns the joins.
//
// ?barrierLatency=0 removes the simulated network delay. It is the only concession made to the
// harness: everything else here is the demo exactly as it runs.

const MOBILE = { width: 384, height: 820 };

const confirmedVisit = () => appointment({
  scheduledAt: inDays(3, 14),
  scheduledEndAt: inDays(3, 15),
  providerDisplayName: "Dr. Fresner Lee",
  locationAddress: "800 Ponce de Leon Blvd, Coral Gables, FL 33134"
});

// The seed helper writes the draft and reloads; this re-enters with the flag the harness needs.
const openBarrierDemo = async (page, options = {}) => {
  await page.setViewportSize(MOBILE);
  await openAppointments(page, { appointments: [confirmedVisit()], ...options });
  await page.goto("/?scenario=access-happy&barrierLatency=0");
  await page.waitForSelector("#screen-content", { state: "visible", timeout: 30000 });
  await page.locator('[data-action="appointment-open"]').first().click();
  await page.locator('[data-action="appointment-open-barrier"]').click();
  await expect(page.locator(".appointment-barrier-screen")).toBeVisible();
};

const press = async (page, selector) => {
  const control = page.locator(selector).first();
  await expect(control).toBeVisible({ timeout: 15000 });
  await control.click();
};

// Nothing in this product may scroll sideways at 384px, and a flow that adds fifteen screens is
// fifteen new chances to break that.
const expectNoHorizontalOverflow = async page => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

test.describe("DEMO 1 — transportation", () => {
  test("takes a patient from 'I cannot get there' to a booked ride and a ready appointment", async ({ page }) => {
    test.setTimeout(120000);
    await openBarrierDemo(page);

    // EMMI offers, rather than filing a report.
    await press(page, '[data-barrier-reason="TRANSPORTATION"]');
    await expect(page.locator(".barrier-emmi-line").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // What we already know is not asked for again: the home address is offered, not requested.
    await press(page, '[data-action="barrier-accept"]');
    await expect(page.locator(".barrier-address-card")).toContainText("123 Oak Avenue");
    await press(page, '[data-action="barrier-pickup-home"]');

    await press(page, '[data-need="NONE"]');
    await press(page, '[data-action="barrier-needs-continue"]');

    // The pickup time is arithmetic on the appointment, and it shows its working: arrive fifteen
    // minutes early, twenty-four minutes of travel, six minutes of buffer.
    await expect(page.locator(".barrier-review")).toContainText(/24 minutes/);
    const timing = (await draft(page)).barrierResolutions[0].data;
    const visitAt = new Date((await draft(page)).appointments[0].scheduledAt).getTime();
    expect(new Date(timing.arriveByAt).getTime()).toBe(visitAt - 15 * 60000);
    expect(visitAt - new Date(timing.pickupAt).getTime()).toBeGreaterThanOrEqual(45 * 60000);
    await press(page, '[data-action="barrier-time-accept"]');

    // Real-looking options, from the provider rather than from the component.
    await expect(page.locator(".barrier-option")).not.toHaveCount(0, { timeout: 20000 });
    const rides = await page.locator(".barrier-option").count();
    expect(rides).toBeGreaterThanOrEqual(1);
    await expect(page.locator(".barrier-option").first()).toContainText(/\$\d+\.\d{2}/);
    await expectNoHorizontalOverflow(page);

    // §12: selecting is not booking. Nothing is reserved until the review screen says so.
    await press(page, '[data-action="barrier-option-select"]');
    await expect(page.locator('[data-action="barrier-reserve-confirm"]')).toBeVisible();
    expect((await draft(page)).barrierResolutions[0].data.reservation).toBeFalsy();

    await press(page, '[data-action="barrier-reserve-confirm"]');
    await expect(page.locator(".barrier-reservation")).toBeVisible({ timeout: 20000 });
    await expect(page.locator(".barrier-reservation")).toContainText(/UB-\d{5}/);
    await expectNoHorizontalOverflow(page);

    const booked = (await draft(page)).barrierResolutions[0];
    expect(booked.status).toBe("resolved");
    expect(booked.data.reservation.reservationId).toMatch(/^UB-\d{5}$/);

    // The return trip is offered rather than assumed.
    await expect(page.locator('[data-action="barrier-return-yes"]')).toBeVisible();
    await press(page, '[data-action="barrier-return-no"]');

    // Back on the appointment, the visit says it is ready.
    await press(page, '[data-action="barrier-close"]');
    await expect(page.locator(".barrier-readiness")).toBeVisible();
    await expect(page.locator(".barrier-readiness")).toContainText(/Transportation arranged/i);
    await expectNoHorizontalOverflow(page);
  });

  test("offers a person rather than a car when a standard ride is not appropriate", async ({ page }) => {
    await openBarrierDemo(page);
    await press(page, '[data-barrier-reason="TRANSPORTATION"]');
    await press(page, '[data-action="barrier-accept"]');
    await press(page, '[data-action="barrier-pickup-home"]');
    // §3.2: needing help in and out of the car is the point at which EMMI stops offering rides.
    await press(page, '[data-need="HELP_IN_OUT"]');
    await press(page, '[data-action="barrier-needs-continue"]');

    await expect(page.locator(".barrier-screen")).toContainText(/standard ride may not be right/i);
    await expect(page.locator('[data-action="barrier-option-select"]')).toHaveCount(0);
    await press(page, '[data-action="barrier-escalate"]');

    const stored = await draft(page);
    const task = stored.careTeamTasks.find(item => item.type === "APPOINTMENT_BARRIER");
    expect(task.reason).toBe("ACCESSIBLE_TRANSPORT_REQUIRED");
    expect(task.priority).toBe("PRIORITY");
    expect(task.status).toBe("OPEN");
  });

  test("keeps a confirmed ride when the patient walks back from the review screen", async ({ page }) => {
    test.setTimeout(120000);
    await openBarrierDemo(page);
    await press(page, '[data-barrier-reason="TRANSPORTATION"]');
    await press(page, '[data-action="barrier-accept"]');
    await press(page, '[data-action="barrier-pickup-home"]');
    await press(page, '[data-need="NONE"]');
    await press(page, '[data-action="barrier-needs-continue"]');
    await press(page, '[data-action="barrier-time-accept"]');
    await expect(page.locator(".barrier-option")).not.toHaveCount(0, { timeout: 20000 });
    await press(page, '[data-action="barrier-option-select"]');
    // §25: "Change" returns to the options that are already there, not to the top of the flow.
    await press(page, '[data-action="barrier-back"][data-step="OPTIONS"]');
    await expect(page.locator(".barrier-option")).not.toHaveCount(0);
    await expect(page.locator('[data-action="barrier-pickup-home"]')).toHaveCount(0);
  });
});

test.describe("DEMO 2 — video visit", () => {
  test("checks the device and updates the appointment's readiness", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await openAppointments(page, { appointments: [appointment({ modality: "TELEHEALTH", scheduledAt: inDays(3, 14), scheduledEndAt: inDays(3, 15) })] });
    await page.goto("/?scenario=access-happy&barrierLatency=0");
    await page.waitForSelector("#screen-content", { state: "visible", timeout: 30000 });
    await page.locator('[data-action="appointment-open"]').first().click();
    await page.locator('[data-action="appointment-open-barrier"]').click();

    await press(page, '[data-barrier-reason="TECHNOLOGY_TELEHEALTH"]');
    // §4: no ticket is created up front. EMMI offers to look first.
    expect((await draft(page)).careTeamTasks.filter(task => task.type === "APPOINTMENT_BARRIER")).toHaveLength(0);

    await press(page, '[data-action="barrier-video-start"]');
    await expect(page.locator(".barrier-checks li")).toHaveCount(4, { timeout: 20000 });
    await expectNoHorizontalOverflow(page);

    const resolution = (await draft(page)).barrierResolutions[0];
    expect(resolution.data.results.map(result => result.id)).toEqual(["MICROPHONE", "CAMERA", "CONNECTION", "APPOINTMENT_LINK"]);

    // Whichever way the check lands, the patient has somewhere to go from here.
    if (resolution.step === "READY") {
      await expect(page.locator('[data-action="barrier-close"]')).toBeVisible();
    } else {
      await press(page, '[data-action="barrier-video-guide"]');
      await expect(page.locator(".barrier-guide-steps li")).not.toHaveCount(0);
      await press(page, '[data-action="barrier-video-recheck"]');
      await expect(page.locator(".barrier-checks li")).toHaveCount(4, { timeout: 20000 });
    }
  });
});

test.describe("DEMO 3 — companion", () => {
  test("invites a caregiver, waits for the answer, and shows it on the appointment", async ({ page }) => {
    test.setTimeout(120000);
    await openBarrierDemo(page);
    await press(page, '[data-barrier-reason="CAREGIVER_AVAILABILITY"]');
    await press(page, '[data-answer="YES"]');
    await expect(page.locator(".barrier-person")).not.toHaveCount(0);

    // Maria is the demo caregiver who says yes; Carlos is the one who says no (§24).
    await press(page, '[data-contact-id="demo-maria"]');
    await expect(page.locator(".barrier-review")).toContainText("Maria");
    // §12: nothing is sent from the list of people.
    await press(page, '[data-action="barrier-companion-send"]');

    await expect(page.locator(".barrier-success")).toContainText("Maria", { timeout: 20000 });
    // The answer arrives on its own, from the provider rather than from the component.
    await expect(page.locator(".barrier-screen")).toContainText(/confirmed/i, { timeout: 20000 });
    expect((await draft(page)).barrierResolutions[0].status).toBe("resolved");

    await press(page, '[data-action="barrier-close"]');
    await expect(page.locator(".barrier-readiness")).toContainText("Maria");
  });

  test("offers another person when a caregiver cannot come", async ({ page }) => {
    test.setTimeout(120000);
    await openBarrierDemo(page);
    await press(page, '[data-barrier-reason="CAREGIVER_AVAILABILITY"]');
    await press(page, '[data-answer="YES"]');
    await press(page, '[data-contact-id="demo-carlos"]');
    await press(page, '[data-action="barrier-companion-send"]');

    await expect(page.locator('[data-action="barrier-companion-another"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-action="barrier-escalate"]')).toBeVisible();
    await press(page, '[data-action="barrier-companion-another"]');
    await expect(page.locator(".barrier-person")).not.toHaveCount(0);
  });
});

test.describe("DEMO 4 — reschedule", () => {
  test("moves the appointment and flags the ride that was booked against the old time", async ({ page }) => {
    test.setTimeout(180000);
    await openBarrierDemo(page);

    // Book a ride first, so the orchestration between the two has something to orchestrate.
    await press(page, '[data-barrier-reason="TRANSPORTATION"]');
    await press(page, '[data-action="barrier-accept"]');
    await press(page, '[data-action="barrier-pickup-home"]');
    await press(page, '[data-need="NONE"]');
    await press(page, '[data-action="barrier-needs-continue"]');
    await press(page, '[data-action="barrier-time-accept"]');
    await expect(page.locator(".barrier-option")).not.toHaveCount(0, { timeout: 20000 });
    await press(page, '[data-action="barrier-option-select"]');
    await press(page, '[data-action="barrier-reserve-confirm"]');
    await expect(page.locator(".barrier-reservation")).toBeVisible({ timeout: 20000 });
    await press(page, '[data-action="barrier-return-no"]');
    await press(page, '[data-action="barrier-close"]');

    const before = (await draft(page)).appointments[0].scheduledAt;

    await press(page, '[data-action="appointment-open-barrier"]');
    // §10: the barrier the patient already resolved says so on the list.
    await expect(page.locator('[data-barrier-reason="TRANSPORTATION"]')).toContainText(/Arranged/i);

    await press(page, '[data-barrier-reason="TIME_CONFLICT"]');
    await press(page, '[data-action="barrier-reschedule-start"]');
    await expect(page.locator(".barrier-slot")).not.toHaveCount(0, { timeout: 20000 });
    await expectNoHorizontalOverflow(page);

    await press(page, '[data-action="barrier-slot-select"]');
    // Old and new, side by side, before anything moves.
    await expect(page.locator(".barrier-change")).toBeVisible();
    await expect(page.locator('[data-side="current"]')).toBeVisible();
    await expect(page.locator('[data-side="new"]')).toBeVisible();
    expect((await draft(page)).appointments[0].scheduledAt).toBe(before);

    await press(page, '[data-action="barrier-reschedule-confirm"]');
    await expect(page.locator(".barrier-success")).toBeVisible({ timeout: 20000 });

    const after = await draft(page);
    // The appointment itself moved — every other screen now reads the new time from the record.
    expect(after.appointments[0].scheduledAt).not.toBe(before);
    expect(after.appointments[0].status).toBe("CONFIRMED");
    expect(after.appointments[0].events.map(event => event.status)).toContain("RESCHEDULE_REQUESTED");

    // §6's orchestration: the ride booked against the old time is flagged, not silently left wrong.
    await expect(page.locator('[data-action="barrier-transport-update"]')).toBeVisible();
    const ride = after.barrierResolutions.find(item => item.barrierType === "transportation");
    expect(ride.data.reservationOutdated).toBe(true);

    // Updating the ride keeps the car that exists until a replacement is booked.
    await press(page, '[data-action="barrier-transport-update"]');
    await expect(page.locator('[data-action="barrier-time-accept"]')).toBeVisible();
    const updating = (await draft(page)).barrierResolutions.find(item => item.barrierType === "transportation");
    expect(updating.data.replacingReservationId).toMatch(/^UB-\d{5}$/);
  });
});

test.describe("something else, and coming back", () => {
  test("routes what the patient typed into a playbook that can finish it", async ({ page }) => {
    test.setTimeout(120000);
    await openBarrierDemo(page);
    await press(page, '[data-barrier-reason="OTHER"]');
    await page.locator("#barrier-describe").fill("no tengo carro para llegar ese dia");
    await press(page, '[data-action="barrier-other-submit"]');

    await expect(page.locator('[data-action="barrier-route"]')).toBeVisible({ timeout: 20000 });
    await press(page, '[data-action="barrier-route"]');
    // It opens the transportation playbook rather than repeating the question.
    await expect(page.locator('[data-action="barrier-accept"]')).toBeVisible();

    const stored = await draft(page);
    expect(stored.barrierResolutions.map(item => item.barrierType).sort()).toEqual(["other", "transportation"]);
    // The activity log records what EMMI made of the sentence, never the sentence itself.
    const classified = stored.barrierActivity.find(event => event.type === "barrier_intent_classified");
    expect(classified.metadata.routedTo).toBe("transportation");
    expect(JSON.stringify(stored.barrierActivity)).not.toContain("no tengo carro");
  });

  test("asks the care team when it cannot work out what the difficulty is", async ({ page }) => {
    await openBarrierDemo(page);
    await press(page, '[data-barrier-reason="OTHER"]');
    await page.locator("#barrier-describe").fill("es complicado explicarlo aqui");
    await press(page, '[data-action="barrier-other-submit"]');
    await press(page, '[data-action="barrier-escalate"]');

    const task = (await draft(page)).careTeamTasks.find(item => item.type === "APPOINTMENT_BARRIER");
    expect(task.reason).toBe("UNCLASSIFIED_BARRIER");
    expect(task.status).toBe("OPEN");
  });

  test("resumes a half-finished resolution after a reload rather than starting over", async ({ page }) => {
    test.setTimeout(120000);
    await openBarrierDemo(page);
    await press(page, '[data-barrier-reason="TRANSPORTATION"]');
    await press(page, '[data-action="barrier-accept"]');
    await press(page, '[data-action="barrier-pickup-home"]');
    await press(page, '[data-need="CANE_WALKER"]');

    await page.reload();
    await page.waitForSelector("#screen-content", { state: "visible", timeout: 30000 });
    // §15: a reload does not drop the patient back into a half-answered question they did not ask
    // to resume — it comes back on the appointment — but nothing they answered is lost either.
    await expect(page.locator(".barrier-screen")).toHaveCount(0);
    await press(page, '[data-action="appointment-open-barrier"]');
    await expect(page.locator('[data-barrier-reason="TRANSPORTATION"]')).toContainText(/In progress/i);

    await press(page, '[data-barrier-reason="TRANSPORTATION"]');
    // Straight back to where they stopped, with the need still selected.
    await expect(page.locator('[data-need="CANE_WALKER"]')).toHaveAttribute("aria-pressed", "true");
  });

  test("says one sentence and starts nothing when the patient is all set", async ({ page }) => {
    await openBarrierDemo(page);
    await press(page, '[data-barrier-reason="ALL_SET"]');
    await expect(page.locator('[data-tone="CONFIRMED"]').first()).toBeVisible();
    expect((await draft(page)).barrierResolutions).toHaveLength(0);
    await expect(page.locator(".barrier-readiness")).toBeVisible();
  });
});

test.describe("accessibility", () => {
  // e2e/accessibility.spec.js sweeps the enrollment journey; these screens are reached from an
  // appointment and never appear in it. The rules-based half of the audit runs here instead.
  const describeViolation = violation =>
    `${violation.id} (${violation.impact}) — ${violation.help} :: `
    + violation.nodes.slice(0, 2).map(node => (node.html || "").replace(/\s+/g, " ").slice(0, 120)).join(" | ");

  const sweep = async (page, label) => {
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(violations.map(describeViolation), `${label} fails WCAG A/AA rules`).toEqual([]);
  };

  test("every screen a transportation resolution walks through passes the WCAG A/AA rules", async ({ page }) => {
    test.setTimeout(180000);
    await openBarrierDemo(page);
    await sweep(page, "pre-visit check");

    await press(page, '[data-barrier-reason="TRANSPORTATION"]');
    await sweep(page, "offer");

    await press(page, '[data-action="barrier-accept"]');
    await sweep(page, "pickup");

    await press(page, '[data-action="barrier-pickup-other"]');
    await sweep(page, "pickup form");

    await press(page, '[data-action="barrier-back"][data-step="PICKUP"]');
    await press(page, '[data-action="barrier-pickup-home"]');
    await sweep(page, "special needs");

    await press(page, '[data-need="NONE"]');
    await press(page, '[data-action="barrier-needs-continue"]');
    await sweep(page, "pickup time");

    await press(page, '[data-action="barrier-time-accept"]');
    await expect(page.locator(".barrier-option")).not.toHaveCount(0, { timeout: 20000 });
    await sweep(page, "ride options");

    await press(page, '[data-action="barrier-option-select"]');
    await sweep(page, "review");

    await press(page, '[data-action="barrier-reserve-confirm"]');
    await expect(page.locator(".barrier-reservation")).toBeVisible({ timeout: 20000 });
    await sweep(page, "booked");
  });

  test("the companion screens pass the WCAG A/AA rules", async ({ page }) => {
    test.setTimeout(120000);
    await openBarrierDemo(page);
    await press(page, '[data-barrier-reason="CAREGIVER_AVAILABILITY"]');
    await sweep(page, "companion offer");
    await press(page, '[data-answer="YES"]');
    await sweep(page, "caregivers");
    await press(page, '[data-action="barrier-companion-new"]');
    await sweep(page, "new contact form");
    await press(page, '[data-action="barrier-back"][data-step="CONTACTS"]');
    await press(page, '[data-contact-id="demo-maria"]');
    await sweep(page, "invitation review");
  });

  test("the reschedule screens pass the WCAG A/AA rules", async ({ page }) => {
    test.setTimeout(120000);
    await openBarrierDemo(page);
    await press(page, '[data-barrier-reason="TIME_CONFLICT"]');
    await sweep(page, "reschedule offer");
    await press(page, '[data-action="barrier-reschedule-start"]');
    await expect(page.locator(".barrier-slot")).not.toHaveCount(0, { timeout: 20000 });
    await sweep(page, "available times");
    await press(page, '[data-action="barrier-slot-select"]');
    await sweep(page, "old versus new");
    await press(page, '[data-action="barrier-reschedule-confirm"]');
    await expect(page.locator(".barrier-success")).toBeVisible({ timeout: 20000 });
    await sweep(page, "rescheduled");
  });

  test("the something-else screens pass the WCAG A/AA rules", async ({ page }) => {
    test.setTimeout(120000);
    await openBarrierDemo(page);
    await press(page, '[data-barrier-reason="OTHER"]');
    await sweep(page, "describe it");
    await page.locator("#barrier-describe").fill("no tengo carro para llegar");
    await press(page, '[data-action="barrier-other-submit"]');
    await expect(page.locator('[data-action="barrier-route"]')).toBeVisible({ timeout: 20000 });
    await sweep(page, "routed");
  });
});
