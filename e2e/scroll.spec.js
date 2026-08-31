import { expect, test } from "@playwright/test";

// Scroll regression tests. The rule these defend is simple: an action inside a screen leaves the
// patient where they were, and only real navigation moves them. Assertions are on semantic anchors
// and on "not the top", never on exact pixels — content legitimately changes height.

// A list long enough that the middle of it is genuinely off-screen at phone height.
const medications = [
  { id: "med-lisinopril", name: "Lisinopril", details: "10 mg · Once daily", active: true },
  { id: "med-atorvastatin", name: "Atorvastatin", details: "20 mg · Once daily", active: true },
  { id: "med-metformin", name: "Metformin", details: "500 mg · Twice daily", active: true },
  { id: "med-amlodipine", name: "Amlodipine", details: "5 mg · Once daily", active: true },
  { id: "med-levothyroxine", name: "Levothyroxine", details: "75 mcg · Once daily", active: true },
  { id: "med-furosemide", name: "Furosemide", details: "20 mg · Once daily", active: true }
];

const seedMedicationReview = page => page.evaluate(list => {
  ["itera.enrollment.safe-draft.v2", "itera.enrollment.language.v1", "itera.emmi.position.v1"].forEach(key => localStorage.removeItem(key));
  localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({
    scenarioId: "access-happy", screen: "MEDICATIONS_REVIEW", returnScreen: "ONBOARDING", role: "patient",
    completionRole: "patient", identityVerified: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED",
    accessOutcome: "eligible", language: "en", audit: [], careTeamTasks: [], careMedications: list,
    medicationReviews: {}, additionalMedications: [], additionalMedicationsStatus: "UNREVIEWED",
    careGoals: [], bpReadings: [], bpReadingReceipts: []
  }));
}, medications);

const openMedicationReview = async page => {
  await page.goto("/?scenario=access-happy");
  await seedMedicationReview(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Confirm your medications" })).toBeVisible();
};

const scrollY = page => page.evaluate(() => Math.round(window.scrollY));
const topOf = locator => locator.evaluate(node => Math.round(node.getBoundingClientRect().top));

test("confirming a medication leaves the patient beside it, not back at the title", async ({ page }) => {
  await openMedicationReview(page);
  const fourth = page.locator(".medication-review-card").nth(3);
  await fourth.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -140));

  const before = { scroll: await scrollY(page), anchor: await topOf(fourth) };
  expect(before.scroll, "the test needs to start well down the list").toBeGreaterThan(200);

  await fourth.getByRole("button", { name: "Yes, I still take it" }).click();
  await expect(fourth).toContainText("Confirmed");

  // The card the patient was looking at has to stay where it was on screen.
  expect(await topOf(fourth)).toBeCloseTo(before.anchor, -2);
  expect(await scrollY(page), "the page must not snap to the top").toBeGreaterThan(200);
  // The screen title lives at the very top; seeing it again means the page jumped.
  const headingBottom = await page.getByRole("heading", { name: "Confirm your medications" })
    .evaluate(node => node.getBoundingClientRect().bottom);
  expect(headingBottom).toBeLessThanOrEqual(0);
});

test("a whole medication list can be reviewed without scrolling back each time", async ({ page }) => {
  await openMedicationReview(page);
  const cards = page.locator(".medication-review-card");
  const lowest = [];
  for (let index = 0; index < medications.length; index += 1) {
    const card = cards.nth(index);
    await card.scrollIntoViewIfNeeded();
    await card.getByRole("button", { name: "Yes, I still take it" }).click();
    lowest.push(await scrollY(page));
  }
  await expect(page.getByText(`${medications.length} of ${medications.length} reviewed`)).toBeVisible();
  // Every confirmation after the first happened further down the page than the one before, which is
  // only possible if none of them threw the patient back to the top.
  expect(Math.min(...lowest.slice(1)), "no confirmation reset the scroll").toBeGreaterThan(0);
});

test("opening and closing EMMI returns the patient to the exact same place", async ({ page }) => {
  await openMedicationReview(page);
  await page.locator(".medication-review-card").nth(3).scrollIntoViewIfNeeded();
  const before = await scrollY(page);
  expect(before).toBeGreaterThan(200);

  // Deliberately the floating pill, not the compact card. The card lives at the top of the screen,
  // so reaching it is itself a scroll — only the fixed pill can open EMMI from where the patient is.
  const floating = page.locator(".emmi-assistant");
  await expect(floating).toBeVisible();
  await floating.click();
  await expect(page.locator(".assistant-layer")).toBeVisible();
  expect(await scrollY(page), "opening EMMI must not move the screen underneath").toBe(before);

  await page.locator(".assistant-close").click();
  await expect(page.locator(".assistant-layer")).toHaveCount(0);
  expect(await scrollY(page)).toBe(before);
});

test("a new screen starts at the top and Back returns the patient where they left", async ({ page }) => {
  // Care setup is the hub the review screens hang off, so it is the one place with a real
  // forward-and-back pair inside the patient experience.
  await page.goto("/?scenario=access-happy");
  await seedMedicationReview(page);
  await page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2"));
    localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({ ...draft, screen: "ONBOARDING" }));
  });
  await page.reload();
  await page.locator('[data-action="care-setup-section"]').first().waitFor();

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  // Playwright scrolls a target into view before clicking it, so the bottom of the list is not
  // necessarily where the patient departs from. Settle the page where the click will leave it and
  // read the position from there, or this asserts against a place they were never standing.
  const medicationsCard = page.locator('[data-action="care-setup-section"][data-section="medications"]');
  await medicationsCard.scrollIntoViewIfNeeded();
  const leftAt = await scrollY(page);
  expect(leftAt, "care setup has to be taller than the viewport for this to mean anything").toBeGreaterThan(0);

  await medicationsCard.click();
  await expect(page.getByRole("heading", { name: "Confirm your medications" })).toBeVisible();
  expect(await scrollY(page), "a new screen starts at the top").toBe(0);

  await page.locator('[data-action="back"]').first().click();
  await expect(page.locator('[data-action="care-setup-section"]').first()).toBeVisible();
  expect(Math.abs(await scrollY(page) - leftAt), "Back returns the patient where they left").toBeLessThan(120);
});

test("adding a medication reveals the new form instead of jumping to the top", async ({ page }) => {
  await openMedicationReview(page);
  await page.locator(".medication-review-card").nth(3).scrollIntoViewIfNeeded();
  const before = await scrollY(page);

  // The add form is inserted below the list. REVEAL_TARGET moves the least amount needed to show
  // it, which is the same machinery a validation error uses.
  await page.getByRole("button", { name: "Add another medication" }).click();
  const form = page.locator("#add-medication-form");
  await expect(form).toBeVisible();
  // The form the patient just opened is what they need to see; the page did not go home to find it.
  expect(await scrollY(page)).toBeGreaterThan(0);
  const formTop = await topOf(form);
  expect(formTop).toBeLessThan(824);
  expect(before).toBeGreaterThan(0);
});
