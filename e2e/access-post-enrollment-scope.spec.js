import { expect, test } from "@playwright/test";

const seedAccess = async (page, screen, extra = {}) => {
  await page.goto("/?scenario=access-bp-none");
  await page.evaluate(({ screen, extra }) => {
    localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({
      scenarioId: "access-bp-none",
      screen,
      role: "patient",
      completionRole: "patient",
      identityVerified: true,
      consentSaved: true,
      enrollmentConfirmed: true,
      enrollmentStatus: "COMPLETED",
      accessOutcome: "eligible",
      accessEligible: true,
      language: "en",
      audit: [],
      careTeamTasks: [],
      careMedications: [],
      medicationReviews: {},
      additionalMedications: [],
      careGoals: [],
      bpReadings: [],
      bpReadingReceipts: [],
      ...extra
    }));
  }, { screen, extra });
  await page.reload();
};

test("ACCESS announces only monitor request and medication reconciliation after enrollment", async ({ page }) => {
  await seedAccess(page, "ENROLLMENT_CONFIRMED");

  await expect(page.getByRole("heading", { name: "Welcome to your ACCESS care" })).toBeVisible();
  await expect(page.locator(".next-card .info-row strong")).toHaveText([
    "Request your blood pressure monitor",
    "Reconcile your medications"
  ]);
  await expect(page.locator("#screen-content")).not.toContainText(/Your health goals|personalized care plan/i);
});

test("ACCESS moves from the device request directly to medication reconciliation", async ({ page }) => {
  await seedAccess(page, "ACCESS_BP_FULFILLMENT_CONFIRMED", {
    bpDevicePath: "needed",
    deviceFulfillmentStatus: "REQUESTED",
    bpDeviceFulfillmentStatus: "REQUESTED"
  });

  await page.getByRole("button", { name: "Review my medications" }).click();
  await expect(page.getByRole("heading", { name: "Confirm your medications" })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText(/Your goals|Care preferences|making your care harder/i);
});

test("ACCESS ends after medication reconciliation", async ({ page }) => {
  await seedAccess(page, "MEDICATIONS_REVIEW", {
    bpDevicePath: "needed",
    deviceFulfillmentStatus: "REQUESTED",
    bpDeviceFulfillmentStatus: "REQUESTED",
    additionalMedicationsStatus: "NONE"
  });

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "You’ve completed your ACCESS setup" })).toBeVisible();
  await expect(page.getByText("Process completed", { exact: true })).toBeVisible();
  await expect(page.locator("#screen-content")).toContainText("Monitor request received");
  await expect(page.locator("#screen-content")).toContainText("Medication reconciliation complete");
  await expect(page.locator("#screen-content")).toContainText("You can safely close this window.");
  await expect(page.locator("#screen-content")).not.toContainText(/health goals|care preferences|support needs/i);
  await expect(page.getByRole("button", { name: /My Care/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /ITERA HEALTH home/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Back" })).toBeHidden();
});
