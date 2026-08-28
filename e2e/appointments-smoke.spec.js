import { expect, test } from "@playwright/test";
import { appointment, draft, openAppointments } from "./appointmentSurfaces.js";

// A short smoke pass over the surfaces the other appointment specs build on: the patient can see
// an upcoming visit on My Care, open it, and reach the scheduling flow. If this fails, nothing
// downstream is worth reading.

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
});

test("My Care shows an upcoming visit and opens it", async ({ page }) => {
  await openAppointments(page, { appointments: [appointment()] });
  const screen = page.locator("#screen-content");
  await expect(screen).toContainText("Dr. Fresner");
  await page.locator('[data-action="appointment-open"]').first().click();
  await expect(page.locator(".appointment-provider").first()).toContainText("Dr. Fresner");
  await expect(page.locator(".appointment-hero-date").first()).toBeVisible();
});

test("a patient with no appointments is offered help rather than an empty list", async ({ page }) => {
  await openAppointments(page, { appointments: [] });
  await expect(page.locator('[data-action="appointment-ask-emmi"], [data-action="appointment-open-list"]').first()).toBeVisible();
  const screen = await page.locator("#screen-content").innerText();
  expect(screen).not.toMatch(/undefined|NaN|\[object/i);
});

test("the appointment record survives a reload", async ({ page }) => {
  await openAppointments(page, { appointments: [appointment()] });
  await page.reload();
  const stored = await draft(page);
  expect(stored.appointments).toHaveLength(1);
  expect(stored.appointments[0].id).toBe("appt-1");
  expect(stored.appointments[0].status).toBe("CONFIRMED");
});
