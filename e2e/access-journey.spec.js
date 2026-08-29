import { expect, test } from "@playwright/test";

// The ACCESS journey screen by screen, from the invitation onwards. Entry-point concerns — that the
// public link opens the invitation at all — live in canonical-invitation.spec.js.

const MOBILE_WIDTHS = [360, 375, 384, 390, 393, 412, 430];
const TEXT_SCALES = [1, 1.25, 1.5];

const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const scaleText = async (page, scale) => {
  await page.evaluate(value => { document.documentElement.style.fontSize = `${16 * value}px`; }, scale);
  await settle(page);
};
const fontSize = (page, selector) => page.locator(selector).first().evaluate(node => parseFloat(getComputedStyle(node).fontSize));

const openWhoIsCompleting = async page => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start your care journey" }).click();
  await expect(page.getByRole("heading", { name: "Who is completing this?" })).toBeVisible();
};

// ---------------------------------------------------------------------------------------------
// Phase 2 — Who is completing this?
// ---------------------------------------------------------------------------------------------

test("the actor question offers three answers and starts on the one the patient gives themselves", async ({ page }) => {
  await openWhoIsCompleting(page);
  await expect(page.getByText("Choose what best describes you. You can get help at any time.")).toBeVisible();

  await expect(page.locator("#choice-form .choice-card")).toHaveCount(3);
  await expect(page.locator("#choice-form .choice-card strong")).toHaveText(["For myself", "Helping the patient", "Personal representative"]);
  await expect(page.locator("#choice-form .choice-card small")).toHaveText([
    "I am the patient.",
    "The patient is present and will make the decisions.",
    "I’m authorized to make healthcare decisions for the patient."
  ]);
  // Nothing is asked of a patient doing this themselves: their answer is already selected.
  await expect(page.locator('#choice-form input[value="patient"]')).toBeChecked();
  await expect(page.locator("#choice-form input:checked")).toHaveCount(1);
});

test("optional support is an offer beside the question, never a fourth answer to it", async ({ page }) => {
  await openWhoIsCompleting(page);
  const optionalSupport = page.locator(".optional-support");
  await expect(optionalSupport).toBeVisible();
  await expect(optionalSupport.locator(".optional-support-card strong")).toHaveText("Want support along the way?");
  await expect(optionalSupport.locator(".optional-support-copy")).toHaveText("Invite someone you trust to support you during your care journey.");
  await expect(optionalSupport.locator(".optional-support-action")).toContainText("Invite someone");

  // It sits outside the form, so it can never be submitted as the answer to the question.
  await expect(page.locator("#choice-form .optional-support")).toHaveCount(0);
  await expect(optionalSupport.locator("input")).toHaveCount(0);
  await expect(page.locator('#choice-form input[value="patient"]')).toBeChecked();

  // Inviting support is about the journey ahead. It does not hand the enrollment to anyone.
  await optionalSupport.getByRole("button").click();
  await expect(page.getByRole("heading", { name: "Invite someone you trust" })).toBeVisible();
  await expect(page.getByText(/does not allow this person to consent, sign/i)).toBeVisible();
  await page.locator('[data-action="growth-return"]').click();
  await expect(page.getByRole("heading", { name: "Who is completing this?" })).toBeVisible();
  await expect(page.locator('#choice-form input[value="patient"]')).toBeChecked();
});

test("optional support stands down when someone else is already completing the enrollment", async ({ page }) => {
  await openWhoIsCompleting(page);
  await expect(page.locator(".optional-support")).toBeVisible();

  // A helper and a representative are already a second person in the room; a Care Circle invitation
  // on top of that would offer the patient support they already have.
  for (const role of ["helper", "personalRepresentative"]) {
    await page.locator(`#choice-form .choice-card:has(input[value="${role}"])`).click();
    await expect(page.locator(`#choice-form input[value="${role}"]`)).toBeChecked();
    await expect(page.locator(".optional-support")).toBeHidden();
  }
  await page.locator('#choice-form .choice-card:has(input[value="patient"])').click();
  await expect(page.locator(".optional-support")).toBeVisible();
});

test("optional support reads as secondary at every supported width and text size", async ({ page }) => {
  await openWhoIsCompleting(page);
  for (const width of MOBILE_WIDTHS) {
    for (const scale of TEXT_SCALES) {
      await page.setViewportSize({ width, height: 844 });
      await scaleText(page, scale);
      const label = `${width}px / ${scale * 100}%`;

      // The aside must never outshout the question. In rem it did exactly that above 100%.
      const [answerTitle, supportTitle, supportCopy, supportLabel] = await Promise.all([
        fontSize(page, "#choice-form .choice-card strong"),
        fontSize(page, ".optional-support-card strong"),
        fontSize(page, ".optional-support-copy"),
        fontSize(page, ".optional-support-label")
      ]);
      expect(supportTitle, `optional support title vs answer title at ${label}`).toBeLessThan(answerTitle);
      expect(supportCopy, `optional support copy vs answer title at ${label}`).toBeLessThanOrEqual(answerTitle);
      expect(supportLabel, `optional support label vs answer title at ${label}`).toBeLessThanOrEqual(answerTitle);
      // Senior-friendly has a floor: secondary never means fine print.
      expect(Math.min(supportTitle, supportCopy, supportLabel), `smallest optional support text at ${label}`).toBeGreaterThanOrEqual(16);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${label}`).toBeLessThanOrEqual(1);
      // Every answer stays a real target, and so does the offer beside them.
      const targets = await page.evaluate(() => [...document.querySelectorAll("#choice-form .choice-card, .optional-support-card")]
        .map(node => node.getBoundingClientRect().height));
      expect(Math.min(...targets), `smallest target at ${label}`).toBeGreaterThanOrEqual(44);
    }
  }
});

test("the actor question reads in every language", async ({ page }) => {
  const copy = {
    es: { start: "Comience su recorrido de cuidado", heading: "¿Quién está completando esto?", answer: "Para mí", support: "¿Quiere apoyo durante el proceso?" },
    ht: { start: "Kòmanse pwosesis swen ou", heading: "Ki moun ki ap ranpli sa a?", answer: "Pou tèt mwen", support: "Ou vle sipò pandan wout la?" }
  };
  await page.goto("/");
  for (const language of ["es", "ht"]) {
    await page.locator(".stage-language").click();
    await page.getByRole("button", { name: copy[language].start }).click();
    await expect(page.getByRole("heading", { name: copy[language].heading })).toBeVisible();
    await expect(page.locator("#choice-form .choice-card strong").first()).toHaveText(copy[language].answer);
    await expect(page.locator(".optional-support-card strong")).toHaveText(copy[language].support);
    await expect(page.locator("#screen-content")).not.toContainText("Want support along the way?");
    await page.locator(".back-button").click();
  }
});
