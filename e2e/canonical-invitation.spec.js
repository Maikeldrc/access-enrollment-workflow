import { test, expect } from "@playwright/test";
import { openEmmiConversation } from "./emmiSurfaces.js";

// A configuration screen that appears for a moment is still a configuration screen the patient saw.
// This records every screen the app ever paints, from before the first script runs, so "it never
// appeared" is asserted against the whole load rather than against one late snapshot.
const watchForConfigurationScreen = page => page.addInitScript(() => {
  window.__configurationScreenSeen = false;
  const configurationCopy = /Configure the patient scenario|Launch Patient Experience|Select program|Choose condition|Prototype configuration|Demo patient/i;
  const look = () => {
    if (document.querySelector(".prototype-console") || configurationCopy.test(document.body?.innerText || "")) window.__configurationScreenSeen = true;
  };
  const start = () => { look(); new MutationObserver(look).observe(document.body, { childList: true, subtree: true, characterData: true }); };
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
});

const sawConfigurationScreen = page => page.evaluate(() => window.__configurationScreenSeen);

test("the public link opens the ACCESS invitation directly, with no scenario to configure", async ({ page }) => {
  await watchForConfigurationScreen(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A new care option for your health" })).toBeVisible();
  expect(await sawConfigurationScreen(page)).toBe(false);
  await expect(page.locator(".prototype-console")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Launch Patient Experience/ })).toHaveCount(0);
  // Scenario and screen jumping are QA controls, absent from a patient's invitation in every build.
  await expect(page.locator(".dev-panel")).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test("the invitation is the one canonical scenario and the patient cannot change it", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".trust-hero-card")).toHaveAttribute("data-hero-variant", "DOCTOR_RECOMMENDS_ACCESS");
  await expect(page.locator(".invitation-stage")).toHaveAttribute("data-trust-source", "Provider / Practice Referral");
  await expect(page.locator(".physician-attribution")).toHaveText("Recommended by Dr. Fresner");
  await expect(page.getByRole("heading", { name: "Your doctor recommends ACCESS care" })).toBeVisible();
  // Nothing on the patient's path offers another program, another condition or another track.
  await expect(page.locator('select, input[type="radio"], input[type="checkbox"]')).toHaveCount(0);
  const body = page.locator("body");
  for (const program of ["CCM", "RPM", "PCM", "APCM", "BHI", "CoCM", "RTM"]) await expect(body).not.toContainText(new RegExp(`\b${program}\b`));
  for (const condition of ["Diabetes", "Heart Failure", "Chronic Kidney Disease"]) await expect(body).not.toContainText(condition);
});

test("a refresh reopens the invitation, never the configuration screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A new care option for your health" })).toBeVisible();
  await watchForConfigurationScreen(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "A new care option for your health" })).toBeVisible();
  expect(await sawConfigurationScreen(page)).toBe(false);
});

test("a scenario left behind by QA never leaks into a patient's invitation", async ({ page }) => {
  // A different program, a different condition, a different language and a half-finished flow, all
  // saved by the console in this browser. None of it belongs to this patient.
  await page.addInitScript(() => {
    localStorage.setItem("itera.prototype.config.v1", JSON.stringify({ program: "CCM", source: "ITERA Direct Outreach", conditions: ["Diabetes", "Heart Failure"], coverage: "Medicare Advantage", language: "es", accessTrack: "MSK", accessEligibilityResult: "notEligible", physicianDisplayName: "Dr. Otro" }));
    localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({ scenarioId: "prototype", screen: "CONSENT_REVIEW", identityVerified: true, language: "es" }));
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A new care option for your health" })).toBeVisible();
  await expect(page.locator(".trust-hero-card")).toHaveAttribute("data-hero-variant", "DOCTOR_RECOMMENDS_ACCESS");
  await expect(page.locator(".physician-attribution")).toHaveText("Recommended by Dr. Fresner");
});

test("removing the configuration screen did not remove any enrollment step", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "See how it works" }).click();

  await expect(page.getByRole("heading", { name: "Who is completing this?" })).toBeVisible();
  await page.locator('.choice-card:has(input[value="patient"])').click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Identity verification still stands between the link and the rest of the journey.
  await expect(page.getByRole("heading", { name: "Let’s confirm it’s you" })).toBeVisible();
  await page.locator('input[name="dob"]').fill("05/12/1954");
  await page.locator('input[name="zip"]').fill("33176");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "What your care includes" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // The Medicare eligibility check still has to be acknowledged before it runs: an invitation that
  // skips its own configuration screen does not skip the patient's consent to be checked.
  const eligibilityGate = page.getByRole("heading", { name: "Before Medicare checks your eligibility" });
  await expect(eligibilityGate).toBeVisible();
  const runCheck = page.getByRole("button", { name: "Check my eligibility" });
  await expect(runCheck).toBeDisabled();
  await page.locator('input[name="accessNotice"]').check();
  await expect(runCheck).toBeEnabled();
  await runCheck.click();
  await expect(eligibilityGate).toHaveCount(0);

  await expect(page.locator("#screen-content")).not.toContainText(/Configure|Launch Patient Experience|prototype/i);
});

test("EMMI knows who invited the patient from the first turn", async ({ page }) => {
  await page.goto("/");
  const dialog = await openEmmiConversation(page);
  await dialog.getByPlaceholder("Ask a question…").fill("Who invited me?");
  await dialog.getByRole("button", { name: "Send question" }).click();
  const answer = dialog.locator(".assistant-message.assistant p").filter({ hasText: /invited you to learn about ACCESS care/i });
  await expect(answer).toBeVisible();
  await expect(answer).toContainText("Dr. Fresner");
  await expect(answer).not.toContainText(/already enrolled|you are enrolled/i);
});

test("the QA console and its simulation tools live behind the admin route only", async ({ page }) => {
  await page.goto("/?admin=1");
  await expect(page.getByRole("heading", { name: "Configure the patient scenario" })).toBeVisible();
  await expect(page.locator(".bp-simulation")).toBeVisible();
  for (const control of ["start-bp-simulation", "inject-bp-caution", "inject-bp-critical", "reset-bp-simulation"]) {
    await expect(page.locator(`[data-action="${control}"]`)).toHaveCount(1);
  }
  await page.goto("/");
  await expect(page.locator(".bp-simulation")).toHaveCount(0);
  for (const control of ["start-bp-simulation", "inject-bp-caution", "inject-bp-critical", "reset-bp-simulation"]) {
    await expect(page.locator(`[data-action="${control}"]`)).toHaveCount(0);
  }
});
