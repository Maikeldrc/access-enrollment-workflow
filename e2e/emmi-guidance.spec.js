import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await page.evaluate(() => {
    localStorage.removeItem("itera.emmi.preferences.v1");
    localStorage.removeItem("itera.enrollment.draft.v2");
    localStorage.removeItem("itera.enrollment.language.v1");
  });
  await page.reload();
});

test("introduces EMMI compactly with voice off by default and preserves opt-out", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Hi, I’m EMMI." })).toBeVisible();
  await expect(page.getByText(/guide you through each step and answer questions/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Guide me with voice/i })).toBeVisible();
  await expect(page.getByText("Voice guidance is on", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Repeat welcome/i })).toHaveCount(0);

  await page.evaluate(() => localStorage.setItem("itera.emmi.preferences.v1", JSON.stringify({ emmiVoiceGuidance: true, emmiWelcomeAcknowledged: true })));
  await page.reload();
  await expect(page.getByText("Voice guidance is on", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Turn voice off/i }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: /Guide me with voice/i })).toBeVisible();
  await expect(page.getByText("Voice guidance is on", { exact: true })).toHaveCount(0);
});

test("shows persistent, accessible guidance controls after opt-in", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("itera.emmi.preferences.v1", JSON.stringify({ emmiVoiceGuidance: true, emmiWelcomeAcknowledged: true })));
  await page.reload();
  await page.getByRole("button", { name: /See how it works/i }).click();

  const controls = page.locator(".emmi-guidance-bar");
  await expect(controls).toBeVisible();
  await expect(controls.getByText("Voice guidance: On")).toBeVisible();
  await expect(controls.getByRole("button", { name: "Pause voice" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Repeat" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Ask EMMI" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Turn voice off" })).toBeVisible();
});

test("uses the Direct Outreach welcome without inventing physician involvement", async ({ page }) => {
  await page.goto("/?prototype=1");
  await page.evaluate(() => {
    localStorage.removeItem("itera.prototype.config.v1");
    localStorage.removeItem("itera.emmi.preferences.v1");
  });
  await page.reload();
  await expect(page.getByText(/guide you through each step and answer questions/i)).toBeVisible();
  await expect(page.locator(".emmi-welcome")).not.toContainText("Dr. Fresner");
});

test("localizes the EMMI welcome in Spanish and Kreyòl without mixing languages", async ({ page }) => {
  await page.locator('[data-action="language"]').first().click();
  await expect(page.getByRole("heading", { name: "Hola, soy EMMI." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guíeme con voz" })).toBeVisible();

  await page.locator('[data-action="language"]').first().click();
  await expect(page.getByRole("heading", { name: "Bonjou, mwen se EMMI." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gide m ak vwa" })).toBeVisible();
});
