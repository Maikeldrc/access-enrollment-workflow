import { expect, test } from "@playwright/test";
import { openEmmiConversation } from "./emmiSurfaces.js";

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

// ---------------------------------------------------------------------------------------------
// Phase 3 — Confirm identity
// ---------------------------------------------------------------------------------------------

const openIdentity = async page => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start your care journey" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Let’s securely confirm it’s you" })).toBeVisible();
};

test("identity verification says what it is for and asks for nothing else", async ({ page }) => {
  await openIdentity(page);
  await expect(page.getByText("Confirm your date of birth and ZIP code so we can match you to your care invitation.")).toBeVisible();
  await expect(page.getByText("Your information is protected and used only to securely verify your identity.")).toBeVisible();
  await expect(page.getByText("Use MM / DD / YYYY.", { exact: true })).toBeVisible();
  await expect(page.getByText("Enter your home ZIP code.", { exact: true })).toBeVisible();

  // Two questions, and only two. This is a match against an invitation, not a registration form.
  const named = await page.locator("#identity-form input[name]").evaluateAll(inputs => inputs.map(input => input.name));
  expect(named.sort()).toEqual(["dob", "zip"]);
  await expect(page.locator("#identity-form")).not.toContainText(/first name|last name|full name|medicare number|email|phone|address/i);

  // Every field is labelled and described, so a screen reader announces the reason with the question.
  for (const id of ["dob", "zip"]) {
    await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
    await expect(page.locator(`#${id}`)).toHaveAttribute("aria-describedby", /identity-helper/);
  }
  // A phone keyboard on a numeric field is the difference between easy and impossible for a senior.
  await expect(page.locator("#dob")).toHaveAttribute("inputmode", "numeric");
  await expect(page.locator("#zip")).toHaveAttribute("inputmode", "numeric");
});

test("the patient's own record stays hidden until they have been matched to it", async ({ page }) => {
  await openIdentity(page);
  const screen = page.locator("#screen-content");
  // Nothing the invitation knows about this person is revealed to whoever opened the link: not the
  // name on the record, not the condition, not the phone, not the address.
  await expect(screen).not.toContainText("John S.");
  await expect(screen).not.toContainText("4567");
  await expect(screen).not.toContainText("Oak Avenue");
  await expect(screen).not.toContainText(/high blood pressure|hypertension/i);
});

test("identity is matched against the invitation, not merely well formed", async ({ page }) => {
  await openIdentity(page);
  const dob = page.getByLabel("Date of birth", { exact: true });
  const zip = page.getByLabel("ZIP code", { exact: true });

  // A perfectly valid date that belongs to somebody else is not a match.
  await dob.fill("01 / 01 / 1950");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert")).toContainText("We couldn’t match that information");
  await expect(page.getByRole("heading", { name: "Let’s securely confirm it’s you" })).toBeVisible();

  // Neither is the right date with the wrong ZIP.
  await dob.fill("05 / 12 / 1954");
  await zip.fill("33130");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert")).toContainText("We couldn’t match that information");

  // A malformed date never reaches the service at all.
  await zip.fill("33176");
  await dob.fill("02 / 30 / 1954");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert")).toContainText("Enter a valid date");

  // Both matching the invitation is what opens the journey.
  await dob.fill("05 / 12 / 1954");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "What your care includes" })).toBeVisible();
});

test("EMMI explains the reason for the two questions without repeating the answers", async ({ page }) => {
  await openIdentity(page);
  const dialog = await openEmmiConversation(page);
  await dialog.getByPlaceholder("Ask a question…").fill("Why do you need this?");
  await dialog.getByRole("button", { name: "Send question" }).click();
  const answer = dialog.locator(".assistant-message.assistant p").filter({ hasText: /match you to the care invitation/i });
  await expect(answer).toBeVisible();
  await expect(answer).toContainText("Dr. Fresner");
  // The verification material is the patient's to type, never EMMI's to say back to them.
  await expect(dialog.locator(".assistant-message.assistant")).not.toContainText("33176");
  await expect(dialog.locator(".assistant-message.assistant")).not.toContainText("1954");
});

test("identity verification holds its layout at every supported width and text size", async ({ page }) => {
  await openIdentity(page);
  for (const width of MOBILE_WIDTHS) {
    for (const scale of TEXT_SCALES) {
      await page.setViewportSize({ width, height: 844 });
      await scaleText(page, scale);
      const label = `${width}px / ${scale * 100}%`;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${label}`).toBeLessThanOrEqual(1);
      const damaged = await page.evaluate(() => [...document.querySelectorAll("#screen-content h1, .identity-support, .identity-helper, .field label, .field-helper, .actions .button.primary")]
        .filter(node => getComputedStyle(node).overflow !== "visible" && (node.scrollHeight - node.clientHeight > 1 || node.scrollWidth - node.clientWidth > 1))
        .map(node => node.className || node.tagName));
      expect(damaged, `clipped identity copy at ${label}`).toEqual([]);
      const inputHeights = await page.evaluate(() => [...document.querySelectorAll("#identity-form input[name]")].map(node => node.getBoundingClientRect().height));
      expect(Math.min(...inputHeights), `smallest input target at ${label}`).toBeGreaterThanOrEqual(44);
    }
  }
});
