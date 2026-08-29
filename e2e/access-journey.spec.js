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

// ---------------------------------------------------------------------------------------------
// Phase 4 — What your care includes
// ---------------------------------------------------------------------------------------------

const openCareOverview = async page => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start your care journey" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "What your care includes" })).toBeVisible();
};

test("the care overview presents ACCESS as four connected things, not a list of services", async ({ page }) => {
  await openCareOverview(page);
  await expect(page.locator(".lead")).toHaveText("Your ACCESS care gives you new tools and ongoing support to help you manage your high blood pressure between doctor visits.");

  const cards = page.locator(".info-row");
  await expect(cards).toHaveCount(4);
  await expect(cards.locator("strong")).toHaveText([
    "Stay connected with your care team",
    "Track your blood pressure from home",
    "A care plan built around you",
    "Stay connected with Dr. Fresner"
  ]);
  await expect(cards.nth(0).locator("p")).toHaveText("Get ongoing support, answers to your questions, and help staying on track between visits.");
  await expect(cards.nth(1).locator("p")).toHaveText("Use a connected blood pressure monitor to track your readings and help your care team understand how you’re doing.");
  await expect(cards.nth(2).locator("p")).toHaveText("Your goals, health information, and next steps come together in one personalized care plan.");
  await expect(cards.nth(3).locator("p")).toHaveText("ITERA works with Dr. Fresner and your care team to help keep your care connected and coordinated.");
  await expect(page.locator(".note")).toHaveText("Your care doesn’t stop when you leave the doctor’s office. Your care team stays connected with you along the way.");
});

test("the monitor is introduced as an idea here, with none of what comes later", async ({ page }) => {
  await openCareOverview(page);
  const screen = page.locator("#screen-content");
  // The patient learns a connected monitor is part of this. Everything operational about it —
  // getting one, setting it up, what it transmits — belongs to Getting Started, not to a screen
  // about what ACCESS is.
  await expect(screen).toContainText("connected blood pressure monitor");
  await expect(screen).not.toContainText(/ship|shipping|deliver|set ?up|activate|activation|pair|cuff|battery/i);
  // And none of the billing vocabulary that would turn a care description into a services invoice.
  await expect(screen).not.toContainText(/\b(?:CCM|RPM|PCM|APCM|ASM|BHI|CoCM|RTM|CPT|billing|bill|claim|reimburse)\b/i);
});

test("the care overview names the referring physician only where the invitation named one", async ({ page }) => {
  await openCareOverview(page);
  await expect(page.locator(".info-row").last()).toContainText("Dr. Fresner");

  // A direct-outreach invitation has no physician to name, so the same card must not invent one.
  await page.goto("/?admin=1");
  await page.evaluate(() => localStorage.removeItem("itera.prototype.config.v1"));
  await page.reload();
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await page.locator("#screen-select").selectOption("CARE_RECOMMENDATION", { force: true });
  await expect(page.locator(".info-row").last().locator("strong")).toHaveText("Stay connected with your doctors");
  await expect(page.locator(".recommendation-screen")).not.toContainText("Dr. Fresner");
});

test("EMMI can explain what this care includes and who stays involved", async ({ page }) => {
  await openCareOverview(page);
  const dialog = await openEmmiConversation(page);
  const ask = async question => {
    await dialog.getByPlaceholder("Ask a question…").fill(question);
    await dialog.getByRole("button", { name: "Send question" }).click();
  };

  await ask("How will the blood pressure monitor help me?");
  await expect(dialog.locator(".assistant-message.assistant").last()).toBeVisible();
  await ask("Will Dr. Fresner still be involved?");
  await expect(dialog.locator(".assistant-message.assistant p").filter({ hasText: /Dr\. Fresner/ }).last()).toBeVisible();
  // ITERA adds support; it never replaces the doctor the patient already has.
  await expect(dialog.locator(".assistant-message.assistant").last()).toContainText(/does not replace|remains part of your care/i);
});

test("the care overview holds its layout at every supported width and text size", async ({ page }) => {
  await openCareOverview(page);
  for (const width of MOBILE_WIDTHS) {
    for (const scale of TEXT_SCALES) {
      await page.setViewportSize({ width, height: 844 });
      await scaleText(page, scale);
      const label = `${width}px / ${scale * 100}%`;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${label}`).toBeLessThanOrEqual(1);
      const damaged = await page.evaluate(() => [...document.querySelectorAll("#screen-content h1, .lead, .info-row strong, .info-row p, .note, .actions .button.primary")]
        .filter(node => getComputedStyle(node).overflow !== "visible" && (node.scrollHeight - node.clientHeight > 1 || node.scrollWidth - node.clientWidth > 1))
        .map(node => node.className || node.tagName));
      expect(damaged, `clipped care overview copy at ${label}`).toEqual([]);
      const bodyFonts = await page.evaluate(() => [...document.querySelectorAll(".info-row p")].map(node => parseFloat(getComputedStyle(node).fontSize)));
      expect(Math.min(...bodyFonts), `smallest card body at ${label}`).toBeGreaterThanOrEqual(16);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Phase 5 — Medicare / ACCESS eligibility review
// ---------------------------------------------------------------------------------------------

const openEligibilityReview = async page => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start your care journey" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Let’s confirm your eligibility with Medicare" })).toBeVisible();
};

test("the eligibility review explains before it discloses", async ({ page }) => {
  await openEligibilityReview(page);
  await expect(page.locator(".lead")).toHaveText("Medicare will review a few details to confirm you can take part in ACCESS. This only takes a moment and does not change your Medicare coverage.");

  const rows = page.locator(".access-precheck-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.locator("strong")).toHaveText([
    "A secure check with Medicare",
    "How the ACCESS evaluation works",
    "Your Medicare stays the same"
  ]);
  await expect(rows.nth(0).locator("p")).toHaveText("ITERA and Medicare can securely exchange the information needed to confirm your eligibility for ACCESS.");
});

test("no required disclosure was traded away for a calmer screen", async ({ page }) => {
  await openEligibilityReview(page);
  const screen = page.locator("#screen-content");
  // Each of these is here because a patient must be told it, not because it reads well.
  await expect(screen).toContainText("securely exchange");
  await expect(screen).toContainText("may request information for that evaluation");
  await expect(screen).toContainText("randomly selected");
  await expect(screen).toContainText("comparison group");
  await expect(screen).toContainText("12 months");
  await expect(screen).toContainText("do not change your Medicare benefits, coverage, or rights");
});

test("the eligibility check does not run until the patient acknowledges it", async ({ page }) => {
  await openEligibilityReview(page);
  const acknowledgement = page.getByLabel("I understand this information and want to continue with the Medicare eligibility check");
  const runCheck = page.getByRole("button", { name: "Check my eligibility" });

  await expect(acknowledgement).not.toBeChecked();
  await expect(runCheck).toBeDisabled();
  await acknowledgement.check();
  await expect(runCheck).toBeEnabled();

  // Unticking it closes the gate again: the acknowledgement is a live condition, not a formality
  // the screen remembers once.
  await acknowledgement.uncheck();
  await expect(runCheck).toBeDisabled();
});

test("EMMI explains the check, the comparison group and what stays untouched", async ({ page }) => {
  await openEligibilityReview(page);
  const dialog = await openEmmiConversation(page);
  const ask = async question => {
    await dialog.getByPlaceholder("Ask a question…").fill(question);
    await dialog.getByRole("button", { name: "Send question" }).click();
  };
  const lastAnswer = () => dialog.locator(".assistant-message.assistant").last();

  await ask("Why does Medicare need to verify me?");
  await expect(lastAnswer()).toContainText(/Medicare|eligib/i);
  await ask("What is the comparison group?");
  await expect(lastAnswer()).toBeVisible();
  await ask("Will this change my Medicare?");
  await expect(lastAnswer()).toBeVisible();
  // Whatever route each question takes, none of them may promise an outcome the check has not run.
  await expect(dialog.locator(".assistant-thinking")).toHaveCount(0);
  await expect(dialog).not.toContainText(/you are eligible|you're eligible|you qualify/i);
});

test("the eligibility review holds its layout at every supported width and text size", async ({ page }) => {
  await openEligibilityReview(page);
  for (const width of MOBILE_WIDTHS) {
    for (const scale of TEXT_SCALES) {
      await page.setViewportSize({ width, height: 844 });
      await scaleText(page, scale);
      const label = `${width}px / ${scale * 100}%`;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${label}`).toBeLessThanOrEqual(1);
      const damaged = await page.evaluate(() => [...document.querySelectorAll("#screen-content h1, .lead, .access-precheck-row strong, .access-precheck-row p, .check-row, .actions .button.primary")]
        .filter(node => getComputedStyle(node).overflow !== "visible" && (node.scrollHeight - node.clientHeight > 1 || node.scrollWidth - node.clientWidth > 1))
        .map(node => node.className || node.tagName));
      expect(damaged, `clipped eligibility copy at ${label}`).toEqual([]);
      // The acknowledgement is the one control on this screen that must never be hard to hit.
      const checkboxTarget = await page.locator(".check-row").evaluate(node => node.getBoundingClientRect().height);
      expect(checkboxTarget, `acknowledgement target at ${label}`).toBeGreaterThanOrEqual(44);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Phase 6 — Eligibility success milestone
// ---------------------------------------------------------------------------------------------

const openEligibilitySuccess = async page => {
  await openEligibilityReview(page);
  await page.getByLabel("I understand this information and want to continue with the Medicare eligibility check").check();
  await page.getByRole("button", { name: "Check my eligibility" }).click();
  await expect(page.getByRole("heading", { name: "Great news — you can continue with ACCESS" })).toBeVisible({ timeout: 15000 });
};

test("clearing the check reads as a milestone, not as a warning about what has not happened", async ({ page }) => {
  await openEligibilitySuccess(page);
  await expect(page.getByText("Everything is ready for you to continue. We’ll review the details together before completing your enrollment.")).toBeVisible();

  // The green success mark and the progress indicator both survive the rewrite.
  await expect(page.locator(".access-eligibility-result-screen .art.art-check.success")).toBeVisible();
  await expect(page.locator(".progress-meta span").last()).toHaveText("Eligibility");

  await expect(page.getByRole("heading", { name: "What happens next?" })).toBeVisible();
  await expect(page.locator(".next-card .info-row strong")).toHaveText([
    "Learn about your ACCESS care",
    "Confirm that you’d like to enroll with ITERA HEALTH",
    "We’ll complete your ACCESS enrollment with Medicare"
  ]);
  await expect(page.locator('.contextual-assurance[data-assurance-type="NO_COMMITMENT_YET"]')).toContainText("You’ll review all the details before completing your enrollment");
});

test("a cleared check never reads as an enrollment", async ({ page }) => {
  await openEligibilitySuccess(page);
  const screen = page.locator("#screen-content");
  // Positive without overclaiming: the patient may continue, and has agreed to nothing.
  await expect(screen).not.toContainText(/you are enrolled|you're enrolled|enrollment is complete|Medicare enrolled you/i);
  // The action moves them forward; it never asks them to commit here.
  const cta = page.locator(".actions .button.primary");
  await expect(cta).toHaveText(/Continue/);
  await expect(cta).not.toHaveText(/Enroll|Submit|Accept|Complete enrollment/i);
});

test("the milestone survives a refresh without turning into an enrollment", async ({ page }) => {
  await openEligibilitySuccess(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Great news — you can continue with ACCESS" })).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#screen-content")).not.toContainText(/you are enrolled|enrollment is complete/i);
});

test("EMMI keeps eligibility and enrollment apart when asked directly", async ({ page }) => {
  await openEligibilitySuccess(page);
  const dialog = await openEmmiConversation(page);
  const ask = async question => {
    await dialog.getByPlaceholder("Ask a question…").fill(question);
    await dialog.getByRole("button", { name: "Send question" }).click();
  };

  await ask("Am I enrolled now?");
  const enrolledAnswer = dialog.locator(".assistant-message.assistant p").filter({ hasText: /not enrolled until/i });
  await expect(enrolledAnswer).toBeVisible();
  await ask("What happens next?");
  await expect(dialog.locator(".assistant-thinking")).toHaveCount(0);
  await expect(dialog).not.toContainText(/you are enrolled|you're enrolled|Medicare enrolled you/i);
});

test("the eligibility milestone holds its layout at every supported width and text size", async ({ page }) => {
  await openEligibilitySuccess(page);
  for (const width of MOBILE_WIDTHS) {
    for (const scale of TEXT_SCALES) {
      await page.setViewportSize({ width, height: 844 });
      await scaleText(page, scale);
      const label = `${width}px / ${scale * 100}%`;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${label}`).toBeLessThanOrEqual(1);
      // The headline wraps to several lines at 150%; it must wrap, not spill or be cut.
      const damaged = await page.evaluate(() => [...document.querySelectorAll("#screen-content h1, .lead, .next-card h2, .next-card .info-row strong, .contextual-assurance, .actions .button.primary")]
        .filter(node => getComputedStyle(node).overflow !== "visible" && (node.scrollHeight - node.clientHeight > 1 || node.scrollWidth - node.clientWidth > 1))
        .map(node => node.className || node.tagName));
      expect(damaged, `clipped milestone copy at ${label}`).toEqual([]);
      const headlineRight = await page.locator("#screen-content h1").evaluate(node => node.getBoundingClientRect().right);
      const pageWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(headlineRight, `headline within the page at ${label}`).toBeLessThanOrEqual(pageWidth + 1);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Phase 7 — Consent: review and choose
// ---------------------------------------------------------------------------------------------

const openConsent = async page => {
  await openEligibilitySuccess(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Review and choose" })).toBeVisible();
};

test("consent is framed as the patient's decision, not as a signature to collect", async ({ page }) => {
  await openConsent(page);
  await expect(page.locator(".lead")).toHaveText("Review the key details below. You decide whether you want to enroll in ACCESS.");
  await expect(page.locator(".access-consent-summary .consent-disclosure-row strong")).toHaveText([
    "Participation is voluntary",
    "Your Medicare benefits stay the same",
    "Your ACCESS cost",
    "One ACCESS care provider at a time",
    "You can change your ACCESS care"
  ]);
  // Scoped to the summary: the long-form disclosure below repeats several of these sentences.
  const summary = page.locator(".access-consent-summary");
  await expect(summary.getByText("You choose whether to enroll in ACCESS.", { exact: true })).toBeVisible();
  await expect(summary.getByText("Your Medicare benefits, coverage, and rights do not change.", { exact: true })).toBeVisible();
  await expect(summary.getByText("You can receive this type of ACCESS care from one participating provider at a time.", { exact: true })).toBeVisible();
  await expect(summary.getByText("Starting 90 days after enrollment, you may leave ACCESS or switch to another participating provider.", { exact: true })).toBeVisible();
  await expect(page.locator(".access-consent-terms summary")).toContainText("View full ACCESS information");
});

test("the cost shown is the patient's verified amount, never a promise that care is free", async ({ page }) => {
  await openConsent(page);
  const costRow = page.locator(".access-cost-row");
  // The demo patient's supplemental coverage was verified, so the engine's answer is $0 — and the
  // row has to say what that $0 is, and what it is not.
  await expect(costRow).toContainText("$0");
  await expect(costRow).toContainText(/expected ACCESS payment/i);
  await expect(costRow).toContainText(/other healthcare services can still have their own costs/i);
  await expect(page.locator("#screen-content")).not.toContainText(/ACCESS is free|no cost to you|fully covered/i);
});

test("consent is one unticked box, and the CTA waits for it", async ({ page }) => {
  await openConsent(page);
  const consentBox = page.locator("#consent-form input[type=checkbox]");
  await expect(consentBox).toHaveCount(1);
  await expect(consentBox).not.toBeChecked();
  await expect(page.getByLabel("I have reviewed the information above and agree to enroll in ACCESS with ITERA HEALTH.")).toBeVisible();

  const cta = page.getByRole("button", { name: "Confirm and continue" });
  await expect(cta).toBeDisabled();
  await consentBox.check();
  await expect(cta).toBeEnabled();
  // Consent is withdrawable right up to the moment it is given.
  await consentBox.uncheck();
  await expect(cta).toBeDisabled();
});

test("the signer is whoever is actually completing the enrollment", async ({ page }) => {
  await openConsent(page);
  await expect(page.locator(".signer-role")).toHaveText("Signing as: Patient");
  // A representative signs a different sentence, on someone else's behalf, and attests separately.
  await page.goto("/?scenario=access-representative");
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await expect(page.locator(".signer-role")).toHaveText("Signing as: Personal representative");
  await expect(page.getByLabel("I confirm that I’m authorized to make healthcare decisions for the patient.")).toBeVisible();
  await expect(page.getByLabel("I have reviewed the information above and agree, on behalf of the patient, to enroll the patient in ACCESS with ITERA HEALTH.")).toBeVisible();
});

test("consenting writes an audit trail that says what was shown and who agreed", async ({ page }) => {
  await openConsent(page);
  await page.locator("#consent-form input[type=checkbox]").check();
  await page.getByRole("button", { name: "Confirm and continue" }).click();
  await expect(page.getByRole("heading", { name: "Review and choose" })).toHaveCount(0);

  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(draft.consentSaved).toBe(true);
  expect(draft.consentRole).toBeTruthy();
  expect(draft.consentVersion).toBeTruthy();
  expect(draft.consentTimestamp).toBeTruthy();
  expect(draft.disclosureVersion).toBeTruthy();
  expect(draft.language).toBeTruthy();
  expect(draft.consentAcknowledgement).toBeTruthy();
  expect(draft.audit.map(event => event.eventType)).toContain("consent_saved");
});

test("EMMI explains the choice without ever making it", async ({ page }) => {
  await openConsent(page);
  const dialog = await openEmmiConversation(page);
  const ask = async question => {
    await dialog.getByPlaceholder("Ask a question…").fill(question);
    await dialog.getByRole("button", { name: "Send question" }).click();
  };

  await ask("Do I have to enroll?");
  await expect(dialog.locator(".assistant-message.assistant p").filter({ hasText: /choice|voluntary|decide/i }).last()).toBeVisible();
  await ask("Why does it say $0?");
  await expect(dialog.locator(".assistant-message.assistant p").filter({ hasText: /\$0/ }).last()).toBeVisible();
  await ask("Can you agree for me?");
  await expect(dialog.locator(".assistant-message.assistant p").filter({ hasText: /cannot consent for you/i })).toBeVisible();

  await expect(dialog.locator(".assistant-thinking")).toHaveCount(0);
  // Explaining is allowed. Selling is not, and neither is ticking the box.
  await expect(dialog).not.toContainText(/you should enroll|I recommend enrolling|it is free|don’t miss/i);
  await expect(page.locator("#consent-form input[type=checkbox]")).not.toBeChecked();
});

test("the consent screen holds its layout at every supported width and text size", async ({ page }) => {
  await openConsent(page);
  for (const width of MOBILE_WIDTHS) {
    for (const scale of TEXT_SCALES) {
      await page.setViewportSize({ width, height: 844 });
      await scaleText(page, scale);
      const label = `${width}px / ${scale * 100}%`;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${label}`).toBeLessThanOrEqual(1);
      const damaged = await page.evaluate(() => [...document.querySelectorAll("#screen-content h1, .lead, .consent-disclosure-row strong, .consent-disclosure-row p, .signer-role, .check-row, .actions .button.primary")]
        .filter(node => getComputedStyle(node).overflow !== "visible" && (node.scrollHeight - node.clientHeight > 1 || node.scrollWidth - node.clientWidth > 1))
        .map(node => node.className || node.tagName));
      expect(damaged, `clipped consent copy at ${label}`).toEqual([]);
      // The one box that carries the decision must always be comfortably reachable.
      const consentTarget = await page.locator("#consent-form .check-row").evaluate(node => node.getBoundingClientRect().height);
      expect(consentTarget, `consent target at ${label}`).toBeGreaterThanOrEqual(44);
    }
  }
});
