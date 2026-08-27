import { expect, test } from "@playwright/test";

const clinicalMedications = [
  { id: "med-lisinopril", name: "Lisinopril", details: "10 mg · Once daily", active: true },
  { id: "med-atorvastatin", name: "Atorvastatin", details: "20 mg · Once daily", active: true }
];

const seedMedicationReview = (page, language = "en") => page.evaluate(({ medications, language }) => {
  ["itera.enrollment.safe-draft.v2", "itera.enrollment.language.v1", "itera.emmi.position.v1"].forEach(key => localStorage.removeItem(key));
  localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({ scenarioId: "access-happy", screen: "MEDICATIONS_REVIEW", returnScreen: "ONBOARDING", role: "patient", completionRole: "patient", identityVerified: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED", accessOutcome: "eligible", language, audit: [], careTeamTasks: [], careMedications: medications, medicationReviews: {}, additionalMedications: [], additionalMedicationsStatus: "UNREVIEWED", careGoals: [], bpReadings: [], bpReadingReceipts: [] }));
}, { medications: clinicalMedications, language });

test.beforeEach(async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await seedMedicationReview(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Confirm your medications" })).toBeVisible();
});

test("happy path requires explicit review and additional-medication answer", async ({ page }) => {
  await expect(page.getByText("0 of 2 reviewed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.getByRole("button", { name: "Yes, I still take it" }).first().click();
  await expect(page.getByText("1 of 2 reviewed")).toBeVisible();
  await page.getByRole("button", { name: "Yes, I still take it" }).click();
  await expect(page.getByText(/2 of 2 reviewed/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.getByRole("button", { name: "No, that’s all" }).click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Confirm your medications.*Completed/i })).toBeVisible();
});

test("patient-reported medication changes never overwrite the clinical record", async ({ page }) => {
  await page.getByRole("button", { name: "Something changed" }).first().click();
  await page.getByRole("button", { name: "I no longer take this" }).click();
  await page.getByRole("button", { name: "Something changed" }).click();
  await page.getByRole("button", { name: "My dose changed" }).click();
  await page.getByPlaceholder("Example: 20 mg").fill("40 mg");
  await page.getByRole("button", { name: "Save change" }).click();
  await page.getByRole("button", { name: "I’m not sure if anything is missing" }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(saved.careMedications.every(medication => medication.active)).toBe(true);
  expect(saved.medicationReviews["med-lisinopril"].reviewStatus).toBe("NOT_TAKING");
  expect(saved.medicationReviews["med-atorvastatin"].reviewStatus).toBe("DOSE_CHANGED");
  expect(saved.medicationReviews["med-atorvastatin"].patientReportedDose).toBe("40 mg");
  expect(saved.careTeamTasks.filter(task => task.type === "MEDICATION_RECONCILIATION_REVIEW").length).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
});

test("frequency change and uncertainty are structured reviewed states", async ({ page }) => {
  await page.getByRole("button", { name: "Something changed" }).first().click();
  await page.getByRole("button", { name: "How often I take it changed" }).click();
  await page.getByLabel("How do you take it now?").selectOption("TWICE_DAILY");
  await page.getByRole("button", { name: "Save change" }).click();
  await page.getByRole("button", { name: "Something changed" }).click();
  await page.getByRole("button", { name: "I’m not sure about this medication" }).click();
  await page.getByRole("button", { name: "No, that’s all" }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(saved.medicationReviews["med-lisinopril"].patientReportedFrequency).toBe("TWICE_DAILY");
  expect(saved.medicationReviews["med-atorvastatin"].reviewStatus).toBe("NEEDS_REVIEW");
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
});

test("adding, editing, and removing a missing medication provides clear feedback", async ({ page }) => {
  await page.getByRole("button", { name: "Add another medication" }).click();
  await page.getByLabel("Medication name").fill("Metformin");
  await page.getByLabel("Dose or instructions").fill("500 mg");
  await page.getByLabel("How often do you take it?").selectOption("Twice daily");
  await page.getByRole("button", { name: "Add medication" }).click();
  await expect(page.getByText("Medications you added")).toBeVisible();
  await expect(page.getByText("Added by you")).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Dose or instructions").fill("1000 mg");
  await page.getByRole("button", { name: "Save medication" }).click();
  await expect(page.getByText(/1000 mg/)).toBeVisible();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Metformin")).toHaveCount(0);
});

test("EMMI gives safe medication education without treatment advice", async ({ page }) => {
  await page.getByRole("button", { name: "Ask Emmi, Care Assistant" }).click();
  await page.getByRole("button", { name: "What is Lisinopril?" }).click();
  await expect(page.getByText(/commonly used to help manage blood pressure/i)).toBeVisible();
  await page.getByPlaceholder(/Ask a question/i).fill("Should I stop taking this?");
  await page.getByRole("button", { name: /Send question/i }).click();
  await expect(page.getByText(/can’t recommend starting, stopping, or changing/i)).toBeVisible();
});

for (const locale of [
  { language: "es", heading: "Confirme sus medicamentos", progress: "0 de 2 revisados", confirm: "Sí, todavía lo tomo", additional: "¿Toma algún otro medicamento?" },
  { language: "ht", heading: "Konfime medikaman ou yo", progress: "0 sou 2 revize", confirm: "Wi, mwen toujou pran li", additional: "Èske ou pran nenpòt lòt medikaman?" }
]) test(`medication review is fully localized in ${locale.language}`, async ({ page }) => {
  await seedMedicationReview(page, locale.language);
  await page.reload();
  await expect(page.getByRole("heading", { name: locale.heading })).toBeVisible();
  await expect(page.getByText(locale.progress)).toBeVisible();
  await expect(page.getByRole("button", { name: locale.confirm }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: locale.additional })).toBeVisible();
});

for (const width of [384, 360, 375, 390, 393, 430]) test(`medication review is responsive at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 780 });
  await expect(page.getByRole("heading", { name: "Confirm your medications" })).toBeVisible();
  const result = await page.evaluate(() => {
    const emmi = document.querySelector(".emmi-assistant")?.getBoundingClientRect();
    const actions = document.querySelector(".medication-review-screen>.actions")?.getBoundingClientRect();
    const overlaps = emmi && actions ? !(emmi.right <= actions.left || emmi.left >= actions.right || emmi.bottom <= actions.top || emmi.top >= actions.bottom) : false;
    return { overflow: document.documentElement.scrollWidth > window.innerWidth, overlaps, cardWidth: document.querySelector(".medication-review-card")?.getBoundingClientRect().width || 0 };
  });
  expect(result.overflow).toBe(false);
  expect(result.overlaps).toBe(false);
  expect(result.cardWidth).toBeGreaterThan(width - 72);
  if (width === 390) await page.screenshot({ path: "test-results/medications-review-390.png", fullPage: true });
});
