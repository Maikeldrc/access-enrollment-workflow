import { test, expect } from "@playwright/test";

test("ACCESS does not confirm enrollment at eligibility", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ACCESS_ELIGIBILITY_RESULT", { force: true });
  await expect(page.getByRole("heading", { name: "Medicare check complete" })).toBeVisible();
  await expect(page.getByText("Enrollment is not complete yet.")).toBeVisible();
  await expect(page.getByText("Enrollment confirmed")).toHaveCount(0);
});

test("RPM shipping branch exposes address confirmation", async ({ page }) => {
  await page.goto("/?scenario=rpm-shipping");
  await page.locator("#screen-select").selectOption("RPM_DEVICE_PATH", { force: true });
  await page.getByLabel("I need a monitor from ITERA").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Where should we send your monitor?" })).toBeVisible();
});

test("language switch exposes Spanish UI", async ({ page }) => {
  await page.goto("/?scenario=ccm-happy");
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.getByRole("heading", { name: /nueva opción de cuidado/i })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});
