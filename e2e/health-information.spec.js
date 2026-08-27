import { expect, test } from "@playwright/test";

const seedHealthReview = (page, overrides = {}) => page.evaluate(value => {
  ["itera.enrollment.safe-draft.v2", "itera.enrollment.language.v1", "itera.emmi.position.v1"].forEach(key => localStorage.removeItem(key));
  localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({
    scenarioId: "access-happy", screen: "CLINICAL_VERIFICATION", returnScreen: "ONBOARDING",
    role: "patient", completionRole: "patient", identityVerified: true, enrollmentConfirmed: true,
    enrollmentStatus: "COMPLETED", accessOutcome: "eligible", language: "en", audit: [], careTeamTasks: [],
    healthInformationStepStatus: "NOT_STARTED", healthInformationReviewStatus: "UNREVIEWED",
    healthInformationReviewResult: "", healthInformationFlowStep: "CHOICE",
    healthInformationUpdateDraft: { id: "", updateType: "", relatedConditionIds: [], patientReportedText: "" },
    patientReportedHealthUpdates: [], careMedications: [], medicationReviews: {}, additionalMedications: [],
    additionalMedicationsStatus: "UNREVIEWED", careGoals: [], bpReadings: [], bpReadingReceipts: [], ...value
  }));
}, overrides);

test.beforeEach(async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await seedHealthReview(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Confirm your health information" })).toBeVisible();
});

test("Everything looks right is the only path that confirms clinical information", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Confirm and continue" })).toBeDisabled();
  await page.getByRole("button", { name: "Everything looks right" }).click();
  await expect(page.getByRole("button", { name: "Confirm and continue" })).toBeEnabled();
  await page.getByRole("button", { name: "Confirm and continue" }).click();
  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(saved.healthInformationStepStatus).toBe("COMPLETED");
  expect(saved.healthInformationReviewStatus).toBe("CONFIRMED");
  expect(saved.healthInformationReviewSource).toBe("PATIENT");
  expect(saved.healthInformationReviewedAt).toBeTruthy();
  expect(saved.patientReportedHealthUpdates).toEqual([]);
});

test("Something has changed creates a patient-reported update without altering the condition on file", async ({ page }) => {
  await page.getByRole("button", { name: "Something has changed" }).click();
  await expect(page.getByRole("heading", { name: "What has changed?" })).toBeVisible();
  await page.getByRole("button", { name: "A new health condition should be added" }).click();
  await page.getByLabel("What would you like us to know?").fill("I was recently told I have diabetes.");
  await page.getByRole("button", { name: "Review update" }).click();
  await expect(page.getByRole("heading", { name: "Here’s what you told us" })).toBeVisible();
  await page.getByRole("button", { name: "Save update" }).click();
  await expect(page.getByText("Update provided")).toBeVisible();
  await expect(page.getByText(/high blood pressure/i)).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(saved.healthInformationReviewStatus).toBe("CHANGES_REPORTED");
  expect(saved.healthInformationStepStatus).toBe("COMPLETED");
  expect(saved.patientReportedHealthUpdates).toEqual([expect.objectContaining({ updateType: "NEW_INFORMATION", patientReportedText: "I was recently told I have diabetes.", patientReportedStatus: "NEEDS_REVIEW", source: "PATIENT_REPORTED" })]);
  expect(saved.careTeamTasks.filter(task => task.type === "HEALTH_INFORMATION_CHANGE_REVIEW")).toHaveLength(1);
  expect(saved.audit.at(-1).details.clinicalRecordChanged).toBe(false);
});

test("questioning an existing condition preserves the update after refresh and avoids duplicate tasks", async ({ page }) => {
  await page.getByRole("button", { name: "Something has changed" }).click();
  await page.getByRole("button", { name: "One of these conditions no longer seems correct" }).click();
  await page.getByLabel("Tell us what changed.").fill("This may no longer be correct.");
  await page.getByRole("button", { name: "Review update" }).click();
  await page.getByRole("button", { name: "Save update" }).click();
  await page.reload();
  await expect(page.getByText("Update provided")).toBeVisible();
  await page.getByRole("button", { name: "Edit update" }).click();
  await page.getByLabel("Tell us what changed.").fill("Please review whether this is still correct.");
  await page.getByRole("button", { name: "Review update" }).click();
  await page.getByRole("button", { name: "Save update" }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(saved.patientReportedHealthUpdates).toHaveLength(1);
  expect(saved.patientReportedHealthUpdates[0].relatedConditionIds).toEqual(["condition-1"]);
  expect(saved.careTeamTasks.filter(task => task.type === "HEALTH_INFORMATION_CHANGE_REVIEW")).toHaveLength(1);
});

test("multiple conditions let the patient identify only the information that changed", async ({ page }) => {
  await page.goto("/?prototype=1");
  await page.evaluate(() => {
    localStorage.setItem("itera.prototype.config.v1", JSON.stringify({ program: "ACCESS", source: "Provider / Practice Referral", conditions: ["Hypertension", "Diabetes"], referralOrigin: "physician", coverage: "Original Medicare", language: "en", accessTrack: "eCKM", accessEligibilityResult: "eligible", physicianDisplayName: "Dr. Fresner", bpDeviceScenario: "itera-tenovi" }));
    localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({ scenarioId: "prototype", screen: "CLINICAL_VERIFICATION", returnScreen: "ONBOARDING", role: "patient", completionRole: "patient", identityVerified: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED", accessOutcome: "eligible", language: "en", audit: [], careTeamTasks: [], healthInformationStepStatus: "NOT_STARTED", healthInformationReviewStatus: "UNREVIEWED", healthInformationReviewResult: "", healthInformationFlowStep: "CHOICE", healthInformationUpdateDraft: { id: "", updateType: "", relatedConditionIds: [], patientReportedText: "" }, patientReportedHealthUpdates: [], careMedications: [], careGoals: [], bpReadings: [], bpReadingReceipts: [] }));
  });
  await page.reload();
  await expect(page.getByText("Hypertension")).toBeVisible();
  await expect(page.getByText("Diabetes")).toBeVisible();
  await page.getByRole("button", { name: "Something has changed" }).click();
  await page.getByRole("button", { name: "Some information shown here is incorrect" }).click();
  await page.getByLabel("Diabetes").check();
  await page.getByLabel("Tell us what changed.").fill("Only the diabetes information needs review.");
  await page.getByRole("button", { name: "Review update" }).click();
  await page.getByRole("button", { name: "Save update" }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(saved.patientReportedHealthUpdates[0].relatedConditionIds).toEqual(["diabetes"]);
});

test("I need help creates a distinct support path and never confirms the information", async ({ page }) => {
  await page.getByRole("button", { name: "I need help reviewing this" }).click();
  await expect(page.getByRole("heading", { name: "Need help reviewing this?" })).toBeVisible();
  await page.getByRole("button", { name: /Ask my care team/ }).click();
  await expect(page.getByText("Help requested")).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(saved.healthInformationReviewStatus).toBe("NEEDS_HELP");
  expect(saved.healthInformationStepStatus).toBe("COMPLETED");
  expect(saved.careTeamTasks.filter(task => task.type === "HEALTH_INFORMATION_HELP_REQUEST")).toHaveLength(1);
  expect(saved.patientReportedHealthUpdates).toEqual([]);
});

test("the patient can switch from a prior confirmation to reporting a change", async ({ page }) => {
  await page.getByRole("button", { name: "Everything looks right" }).click();
  await page.getByRole("button", { name: "Confirm and continue" }).click();
  await page.getByRole("button", { name: /Confirm your health information.*Completed/i }).click();
  await page.getByRole("button", { name: "Something has changed" }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(saved.healthInformationReviewStatus).toBe("UNREVIEWED");
  expect(saved.healthInformationStepStatus).toBe("NOT_STARTED");
  await expect(page.getByRole("heading", { name: "What has changed?" })).toBeVisible();
});

test("Ask EMMI opens health-review guidance with safe clinical boundaries", async ({ page }) => {
  await page.getByRole("button", { name: "I need help reviewing this" }).click();
  await page.locator("[data-action=\"health-ask-emmi\"]").click();
  await expect(page.getByRole("button", { name: "What does high blood pressure mean?" })).toBeVisible();
  await page.getByRole("button", { name: "Can EMMI confirm this information?" }).click();
  await expect(page.getByText(/can’t confirm a diagnosis or change your clinical record/i)).toBeVisible();
});

for (const locale of [
  { language: "es", heading: "Confirme su información médica", changed: "Algo cambió", next: "¿Qué cambió?" },
  { language: "ht", heading: "Konfime enfòmasyon sou sante w", changed: "Yon bagay chanje", next: "Kisa ki chanje?" }
]) test(`health review branching is localized in ${locale.language}`, async ({ page }) => {
  await seedHealthReview(page, { language: locale.language });
  await page.reload();
  await expect(page.getByRole("heading", { name: locale.heading })).toBeVisible();
  await page.getByRole("button", { name: locale.changed }).click();
  await expect(page.getByRole("heading", { name: locale.next })).toBeVisible();
});

for (const width of [384, 360, 375, 390, 393, 430]) test(`health information review is responsive at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 780 });
  const result = await page.evaluate(() => {
    const emmi = document.querySelector(".emmi-assistant")?.getBoundingClientRect();
    const actions = document.querySelector(".health-information-review-screen>.actions")?.getBoundingClientRect();
    const overlaps = emmi && actions ? !(emmi.right <= actions.left || emmi.left >= actions.right || emmi.bottom <= actions.top || emmi.top >= actions.bottom) : false;
    return { overflow: document.documentElement.scrollWidth > window.innerWidth, overlaps, cardWidth: document.querySelector(".health-information-card")?.getBoundingClientRect().width || 0 };
  });
  expect(result.overflow).toBe(false);
  expect(result.overlaps).toBe(false);
  expect(result.cardWidth).toBeGreaterThan(width - 72);
  if (width === 390) await page.screenshot({ path: "test-results/health-information-review-390.png", fullPage: true });
});
