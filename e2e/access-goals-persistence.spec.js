import { expect, test } from "@playwright/test";

const DRAFT_KEY = "itera.enrollment.safe-draft.v2";

async function openCareSetup(page) {
  await page.goto("/");
  await page.evaluate(key => {
    localStorage.setItem(key, JSON.stringify({
      scenarioId: "access-invitation",
      screen: "ONBOARDING",
      role: "patient",
      completionRole: "patient",
      identityVerified: true,
      consentSaved: true,
      enrollmentConfirmed: true,
      enrollmentStatus: "COMPLETED",
      accessOutcome: "eligible",
      accessEligible: true,
      language: "en",
      healthInformationStepStatus: "COMPLETED",
      healthInformationReviewStatus: "CONFIRMED",
      medicationsReviewStatus: "NOT_STARTED",
      carePreferencesStatus: "NOT_STARTED",
      goalsStatus: "NOT_STARTED",
      audit: [],
      careTeamTasks: [],
      careMedications: [],
      careGoals: [],
      patientGoals: [],
      bpReadings: [],
      bpReadingReceipts: []
    }));
  }, DRAFT_KEY);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();
}

async function openAccessBarrierReview(page) {
  await page.getByRole("button", { name: /Your goals\. Not completed/ }).click();
  await expect(page.getByRole("heading", { name: "Your ACCESS health goals" })).toBeVisible();
  await page.getByRole("button", { name: /Tell us what could make this harder/ }).click();
  await expect(page.getByRole("heading", { name: "Is anything making your care harder?" })).toBeVisible();
}

const storedDraft = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);

test("ACCESS saves different barrier answers per goal and completes only after every goal is answered", async ({ page }) => {
  await openCareSetup(page);
  await openAccessBarrierReview(page);

  const groups = page.locator(".support-need-group");
  await expect(groups).toHaveCount(2);
  await groups.nth(0).locator('input[value="FORGETFULNESS_ROUTINE"]').check();

  // The answered goal is saved independently, while the section remains incomplete.
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Continue with the remaining goal");
  await expect(groups).toHaveCount(1);
  const partial = await storedDraft(page);
  expect(partial.goalsStatus).toBe("IN_PROGRESS");
  expect(partial.patientGoals.find(goal => goal.goalType === "BLOOD_PRESSURE_CONTROL").supportNeedsAssessment.selectedCategories).toEqual(["FORGETFULNESS_ROUTINE"]);

  await groups.locator('input[value="NUTRITION"]').check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Your goals\. Completed/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Confirm your health information/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Confirm your medications\. Not completed/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Care preferences\. Not completed/ })).toBeVisible();

  const stored = await storedDraft(page);
  const bloodPressure = stored.patientGoals.find(goal => goal.goalType === "BLOOD_PRESSURE_CONTROL");
  const weight = stored.patientGoals.find(goal => goal.goalType === "WEIGHT_MANAGEMENT");
  expect(bloodPressure.barriers.map(item => item.category)).toContain("FORGETFULNESS_ROUTINE");
  expect(weight.barriers.map(item => item.category)).toContain("NUTRITION");
  expect(bloodPressure.barriers.map(item => item.category)).not.toContain("NUTRITION");
  expect(weight.barriers.map(item => item.category)).not.toContain("FORGETFULNESS_ROUTINE");
  expect(bloodPressure.supportNeedsAssessment.selectedCategories).toEqual(["FORGETFULNESS_ROUTINE"]);
  expect(weight.supportNeedsAssessment.selectedCategories).toEqual(["NUTRITION"]);
});

test("completed goal answers survive reload and reopen as selected values instead of a blank questionnaire", async ({ page }) => {
  await openCareSetup(page);
  await openAccessBarrierReview(page);
  const groups = page.locator(".support-need-group");
  await groups.nth(0).locator('input[value="DEVICE_TECHNOLOGY"]').check();
  await groups.nth(1).locator('input[value="NONE"]').check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.reload();
  await expect(page.getByRole("button", { name: /Your goals\. Completed/ })).toBeVisible();
  await page.getByRole("button", { name: /Your goals\. Completed/ }).click();
  await page.getByRole("button", { name: /Tell us what could make this harder/ }).click();

  await expect(page.locator(".support-need-group")).toHaveCount(2);
  await expect(page.locator(".support-need-group").nth(0).locator('input[value="DEVICE_TECHNOLOGY"]')).toBeChecked();
  await expect(page.locator(".support-need-group").nth(1).locator('input[value="NONE"]')).toBeChecked();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
});

test("a partially completed ACCESS review resumes only the pending goal and preserves the completed goal", async ({ page }) => {
  await openCareSetup(page);
  await openAccessBarrierReview(page);
  let groups = page.locator(".support-need-group");
  await groups.nth(0).locator('input[value="FORGETFULNESS_ROUTINE"]').check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // Interrupt and reload after only the first goal was durably saved.
  await page.reload();

  groups = page.locator(".support-need-group");
  await expect(groups).toHaveCount(1);
  await expect(groups).toContainText("Reach or maintain a healthy weight");
  await expect(groups).not.toContainText("Keep my blood pressure under control");
  await groups.locator('input[value="NUTRITION"]').check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByRole("button", { name: /Your goals\. Completed/ })).toBeVisible();
  const stored = await storedDraft(page);
  const bloodPressure = stored.patientGoals.find(goal => goal.goalType === "BLOOD_PRESSURE_CONTROL");
  const weight = stored.patientGoals.find(goal => goal.goalType === "WEIGHT_MANAGEMENT");
  expect(bloodPressure.barriers.map(item => item.category)).toEqual(["FORGETFULNESS_ROUTINE"]);
  expect(weight.barriers.map(item => item.category)).toEqual(["NUTRITION"]);
});
