import { expect, test } from "@playwright/test";

const DRAFT_KEY = "itera.enrollment.safe-draft.v2";

const legacyDraft = overrides => ({
  scenarioId: "access-invitation", screen: "ONBOARDING", returnScreen: "ONBOARDING",
  role: "patient", completionRole: "patient", identityVerified: true, consentSaved: true,
  enrollmentConfirmed: true, enrollmentStatus: "COMPLETED", accessOutcome: "eligible",
  accessEligible: true, language: "en", healthInformationStepStatus: "NOT_STARTED",
  healthInformationReviewStatus: "UNREVIEWED", medicationsReviewStatus: "NOT_STARTED",
  carePreferencesStatus: "NOT_STARTED", goalsStatus: "COMPLETED", audit: [], careTeamTasks: [],
  careMedications: [], careGoals: [], patientGoals: [], bpReadings: [], bpReadingReceipts: [],
  ...overrides
});

async function restoreDraft(page, overrides = {}) {
  await page.goto("/");
  await page.evaluate(({ key, draft }) => localStorage.setItem(key, JSON.stringify(draft)), {
    key: DRAFT_KEY,
    draft: legacyDraft(overrides)
  });
  await page.reload();
}

test("care setup no longer shows the retired health-information confirmation card", async ({ page }) => {
  await restoreDraft(page);
  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Confirm your health information/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Confirm your medications\. Not completed/ })).toBeVisible();
  await expect(page.locator('[data-action="care-setup-section"]')).toHaveCount(3);
});

test("legacy drafts on the removed screen resume at medications without losing saved data", async ({ page }) => {
  await restoreDraft(page, {
    screen: "CLINICAL_VERIFICATION",
    baselineResumeScreen: "CLINICAL_VERIFICATION",
    flowProgress: { GETTING_STARTED: { status: "IN_PROGRESS", resumeRoute: "CLINICAL_VERIFICATION" } },
    preferredContactMethod: "text",
    careGoalsNote: "Keep walking every morning"
  });
  await expect(page.getByRole("heading", { name: "Confirm your medications" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Confirm your health information" })).toHaveCount(0);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);
  expect(saved.preferredContactMethod).toBe("text");
  expect(saved.careGoalsNote).toBe("Keep walking every morning");
});

test("continue where you left off ignores the retired health status", async ({ page }) => {
  await restoreDraft(page, {
    screen: "MY_CARE",
    baselineResumeScreen: "ONBOARDING",
    onboarding: { savedAt: new Date().toISOString() },
    flowProgress: { GETTING_STARTED: { status: "IN_PROGRESS", resumeRoute: "CLINICAL_VERIFICATION" } }
  });
  await page.getByRole("button", { name: /Continue where you left off/ }).click();
  await expect(page.getByRole("heading", { name: "Confirm your medications" })).toBeVisible();
});
