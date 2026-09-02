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

test("deferring after ACCESS enrollment shows both remaining tasks without entering My Care", async ({ page }) => {
  await seedAccess(page, "ENROLLMENT_CONFIRMED");

  await page.getByRole("button", { name: "I’ll do this later" }).click();
  await expect(page.getByRole("heading", { name: "You’re enrolled in ACCESS" })).toBeVisible();
  await expect(page.locator(".access-deferred-screen .status-pill")).toHaveText("Enrollment complete");
  await expect(page.locator(".access-deferred-summary .info-row strong")).toHaveText([
    "Request your blood pressure monitor",
    "Reconcile your medications"
  ]);
  await expect(page.getByText("Your progress is saved", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue setup" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My Care" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /ITERA HEALTH home/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Back" })).toBeHidden();
});

test("deferred ACCESS summary shows only medication reconciliation after the monitor request", async ({ page }) => {
  await seedAccess(page, "ACCESS_BP_FULFILLMENT_CONFIRMED", {
    bpDevicePath: "needed",
    deviceFulfillmentStatus: "REQUESTED",
    bpDeviceFulfillmentStatus: "REQUESTED"
  });

  await page.getByRole("button", { name: "I’ll do this later" }).click();
  await expect(page.getByRole("heading", { name: "You’re enrolled in ACCESS" })).toBeVisible();
  await expect(page.locator(".access-deferred-summary .info-row strong")).toHaveText([
    "Reconcile your medications"
  ]);
  await page.getByRole("button", { name: "Continue setup" }).click();
  await expect(page.getByRole("heading", { name: "Confirm your medications" })).toBeVisible();
});

test("deferred ACCESS summary can show only the monitor when medications are already reconciled", async ({ page }) => {
  await seedAccess(page, "FLOW_DEFERRED", {
    medicationsReviewStatus: "COMPLETED",
    baselineResumeScreen: "ACCESS_BP_DEVICE_INFO",
    flowProgress: { GETTING_STARTED: { flowType: "GETTING_STARTED", status: "DEFERRED", deferredAt: new Date().toISOString(), resumeRoute: "ACCESS_BP_DEVICE_INFO" } }
  });

  await expect(page.getByRole("heading", { name: "You’re enrolled in ACCESS" })).toBeVisible();
  await expect(page.locator(".access-deferred-summary .info-row strong")).toHaveText([
    "Request your blood pressure monitor"
  ]);
  await expect(page.locator(".access-deferred-summary")).not.toContainText("Reconcile your medications");
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
