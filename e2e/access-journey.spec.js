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

test("submitted consent stays visibly selected while it is saving", async ({ page }) => {
  await openConsent(page);
  const consentBox = page.locator("#consent-form input[type=checkbox]");
  await consentBox.check();

  await page.getByRole("button", { name: "Confirm and continue" }).click();

  await expect(page.getByRole("button", { name: "Saving…" })).toBeVisible();
  await expect(consentBox).toBeChecked();
  await expect(page.getByRole("heading", { name: "Review and choose" })).toHaveCount(0);
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

// ---------------------------------------------------------------------------------------------
// The golden path, walked end to end the way a patient walks it
// ---------------------------------------------------------------------------------------------

test("Dr. Fresner's invitation carries the patient from the link to their own decision", async ({ page }) => {
  await page.goto("/");

  // The link is an invitation, and the doctor who sent it is the first thing on the screen.
  await expect(page.getByRole("heading", { name: "A smarter way to manage your health" })).toBeVisible();
  await expect(page.locator(".physician-attribution")).toHaveText("Recommended by Dr. Fresner");
  await expect(page.locator(".invitation-voluntary")).toContainText("Participation is voluntary");
  await page.getByRole("button", { name: "Start your care journey" }).click();

  // The patient chooses how they want to complete this, and support stays a separate offer.
  await expect(page.getByRole("heading", { name: "Who is completing this?" })).toBeVisible();
  await expect(page.locator('#choice-form input[value="patient"]')).toBeChecked();
  await expect(page.locator(".optional-support-card strong")).toHaveText("Want support along the way?");
  await page.getByRole("button", { name: "Continue" }).click();

  // Identity is a match against the invitation, not a registration.
  await expect(page.getByRole("heading", { name: "Let’s securely confirm it’s you" })).toBeVisible();
  await expect(page.locator("#screen-content")).toContainText("match you to your care invitation");
  await page.getByRole("button", { name: "Continue" }).click();

  // What ACCESS actually is, including the monitor and the doctor who stays involved.
  await expect(page.getByRole("heading", { name: "What your care includes" })).toBeVisible();
  await expect(page.locator(".info-row")).toHaveCount(4);
  await expect(page.locator("#screen-content")).toContainText("connected blood pressure monitor");
  await expect(page.locator(".info-row").last()).toContainText("Dr. Fresner");
  await page.getByRole("button", { name: "Continue" }).click();

  // The disclosures, acknowledged before anything is checked.
  await expect(page.getByRole("heading", { name: "Let’s confirm your eligibility with Medicare" })).toBeVisible();
  await expect(page.locator("#screen-content")).toContainText("comparison group");
  await page.getByLabel("I understand this information and want to continue with the Medicare eligibility check").check();
  await page.getByRole("button", { name: "Check my eligibility" }).click();

  // A milestone that is positive and still honest about what has not happened.
  await expect(page.getByRole("heading", { name: "Great news — you can continue with ACCESS" })).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#screen-content")).not.toContainText(/you are enrolled|enrollment is complete/i);
  await page.getByRole("button", { name: "Continue" }).click();

  // And finally the patient's own decision, made by them.
  await expect(page.getByRole("heading", { name: "Review and choose" })).toBeVisible();
  await expect(page.locator(".signer-role")).toHaveText("Signing as: Patient");
  const consentBox = page.locator("#consent-form input[type=checkbox]");
  await expect(consentBox).not.toBeChecked();
  const confirm = page.getByRole("button", { name: "Confirm and continue" });
  await expect(confirm).toBeDisabled();
  await consentBox.check();
  await confirm.click();
  await expect(page.getByRole("heading", { name: "Review and choose" })).toHaveCount(0);

  // Nothing along the way asked the patient to configure a demo, and the referral context that
  // started the journey is still the context it ends in.
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(draft.identityVerified).toBe(true);
  expect(draft.accessOutcome).toBe("eligible");
  expect(draft.consentSaved).toBe(true);
  expect(draft.completionRole).toBe("patient");
});

// ---------------------------------------------------------------------------------------------
// Enrollment complete → care activation
// ---------------------------------------------------------------------------------------------

const openEnrollmentComplete = async page => {
  await page.goto("/?scenario=access-happy");
  await page.evaluate(() => localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({
    scenarioId: "access-happy", screen: "ENROLLMENT_CONFIRMED", role: "patient", completionRole: "patient",
    identityVerified: true, consentSaved: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED",
    accessOutcome: "eligible", accessEligible: true, language: "en",
    audit: [], careTeamTasks: [], careMedications: [], careGoals: [], bpReadings: [], bpReadingReceipts: []
  })));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome to your ACCESS care" })).toBeVisible();
};

test("enrollment complete hands the patient into care activation, not into a waiting room", async ({ page }) => {
  await openEnrollmentComplete(page);
  await expect(page.locator(".success-eyebrow")).toHaveText("Welcome");
  await expect(page.locator(".lead")).toHaveText("You’re now enrolled in ACCESS. Let’s get your care set up around your health and goals.");
  await expect(page.locator(".status-pill")).toContainText("Enrollment confirmed");

  // EMMI is the guide from here, and the doctor who referred them is named.
  const highlights = page.locator(".enrollment-welcome-highlight");
  await expect(highlights.locator("strong")).toHaveText(["EMMI is here along the way", "Connected with Dr. Fresner"]);
  await expect(highlights.nth(1).locator("p")).toHaveText("ITERA works with Dr. Fresner and your care team to help keep your care connected.");

  // The three next steps are what the patient is about to do, in order.
  await expect(page.getByRole("heading", { name: "What happens next?" })).toBeVisible();
  await expect(page.locator(".next-card .info-row strong")).toHaveText([
    "Your blood pressure monitor",
    "Your health goals",
    "Your personalized care plan"
  ]);
});

test("nothing on the screen tells the patient to wait for a call", async ({ page }) => {
  await openEnrollmentComplete(page);
  const screen = page.locator("#screen-content");
  await expect(screen).not.toContainText(/call you within|business days|we will call|wait for/i);
  // The monitor is a tool, not a billing programme, and no appointment is required to continue.
  await expect(screen).not.toContainText(/\b(RPM|CPT|99453|99454)\b/);
  await expect(screen).not.toContainText(/appointment|book a visit|schedule a visit/i);
});

test("the primary action starts care setup and the deferral stays available", async ({ page }) => {
  await openEnrollmentComplete(page);
  const transition = page.locator(".flow-transition-card, .next-step-card").first().or(page.locator("#screen-content"));
  await expect(transition).toContainText("Let’s set up your care");
  await expect(transition).toContainText("Start your ACCESS care setup");
  await expect(transition).toContainText("Next, we’ll confirm a few health details, arrange your blood pressure monitor, and personalize your ACCESS goals and care plan.");
  await expect(transition).toContainText("You can stop anytime. Your progress will be saved.");

  const primary = page.getByRole("button", { name: "Set up my care" });
  const later = page.getByRole("button", { name: "I’ll do this later" });
  await expect(primary).toBeVisible();
  await expect(later).toBeVisible();
  // Secondary means quieter, not punished: still a real target the patient can hit.
  expect(await primary.getAttribute("class")).toContain("primary");
  expect(await later.getAttribute("class")).toContain("secondary");
  expect(await later.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);

  await primary.click();
  await expect(page.getByRole("heading", { name: "Welcome to your ACCESS care" })).toHaveCount(0);
});

test("EMMI knows the enrollment is done and what comes after it", async ({ page }) => {
  await openEnrollmentComplete(page);
  const dialog = await openEmmiConversation(page);

  // The suggestions on this screen are about activation, not about enrolling.
  await expect(dialog.locator(".assistant-quick button")).toHaveText([
    "What happens next?",
    "How do I get my blood pressure monitor?",
    "What will my care plan include?",
    "What goals will I work on?"
  ]);

  await dialog.getByPlaceholder("Ask a question…").fill("Am I enrolled?");
  await dialog.getByRole("button", { name: "Send question" }).click();
  const answer = dialog.locator(".assistant-message.assistant").last();
  await expect(answer).toBeVisible();
  // Unlike the eligibility screen, here EMMI may say the enrollment is complete.
  await expect(answer).toContainText(/enrollment is complete/i);
  await expect(dialog).not.toContainText(/someone will call you/i);
});

// ---------------------------------------------------------------------------------------------
// Confirmed starting points
//
// The invited patient's record already holds a blood pressure and a weight their care team
// confirmed, so ACCESS can say what it will measure and where they are measuring from. Every
// number on these screens is derived from those two observations; none of them is written into a
// view. The seed puts the patient where care activation would have left them and changes nothing
// else about the invitation.
// ---------------------------------------------------------------------------------------------

const openAccessCareScreen = async (page, screen) => {
  await page.goto("/");
  await page.evaluate(value => {
    localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({
      scenarioId: "access-invitation", screen: value, role: "patient", completionRole: "patient",
      identityVerified: true, consentSaved: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED",
      accessOutcome: "eligible", accessEligible: true, language: "en",
      audit: [], careTeamTasks: [], careMedications: [], careGoals: [], bpReadings: [], bpReadingReceipts: []
    }));
  }, screen);
  await page.reload();
};

test("both ACCESS goals open on a confirmed starting point rather than on a promise to confirm one", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await openAccessCareScreen(page, "GOALS");
  await expect(page.getByRole("heading", { name: "Your ACCESS health goals" })).toBeVisible();

  const [bloodPressure, weight] = await page.locator(".access-goal-card").all();
  await expect(bloodPressure.locator(".access-goal-value")).toContainText("152 / 88");
  await expect(bloodPressure.locator(".access-goal-confirmed")).toContainText("Baseline confirmed");
  await expect(weight.locator(".access-goal-value")).toContainText("204");
  await expect(weight.locator(".access-goal-detail")).toHaveText("BMI 31.0");
  await expect(weight.locator(".access-goal-confirmed")).toContainText("Baseline confirmed");
  await expect(page.locator("#screen-content")).not.toContainText("To be confirmed");
});

// 137 is 152 − 15 and 193.8 is 5% off 204. Both are arithmetic on this patient's own baseline, and
// neither is the clinical target: telling someone who started at 152 that 137 is where they are
// trying to land is wrong, so the milestone is always shown with where it came from.
test("each milestone is derived from this patient's baseline and never displaces the control target", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await openAccessCareScreen(page, "GOALS");
  await page.locator("details.access-goal-details").first().click();
  await page.locator("details.access-goal-details").last().click();

  const [bloodPressure, weight] = await page.locator(".access-goal-card").all();
  await expect(bloodPressure.locator(".access-goal-measure")).toContainText("Below 130 mmHg systolic");
  await expect(bloodPressure.locator(".access-goal-measure")).toContainText("137 mmHg or lower");
  await expect(bloodPressure.locator(".access-goal-measure small")).toHaveText("15 mmHg below your starting systolic blood pressure.");
  await expect(weight.locator(".access-goal-measure")).toContainText("BMI below 30");
  await expect(weight.locator(".access-goal-measure")).toContainText("193.8 lb or lower");
  await expect(weight.locator(".access-goal-measure small")).toHaveText("At least 5% below your starting weight.");
});

test("the care plan repeats the same starting points and the same milestones", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await openAccessCareScreen(page, "ONBOARDING_COMPLETE");
  const plan = page.locator(".access-plan-goals");
  await expect(plan).toContainText("152 / 88");
  await expect(plan).toContainText("137 mmHg or lower");
  await expect(plan).toContainText("204");
  await expect(plan).toContainText("BMI 31.0");
  await expect(plan).toContainText("193.8 lb or lower");
  await expect(plan).not.toContainText("To be confirmed");
});

test("the starting points read the same in Spanish and Kreyòl", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await openAccessCareScreen(page, "GOALS");

  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.getByRole("heading", { name: "Sus objetivos de salud de ACCESS" })).toBeVisible();
  await expect(page.locator("#screen-content")).toContainText("152 / 88");
  await expect(page.locator("#screen-content")).toContainText("Línea base confirmada");
  await expect(page.locator("#screen-content")).toContainText("IMC 31.0");
  await expect(page.locator("#screen-content")).not.toContainText("Por confirmar");

  await page.getByRole("button", { name: "Cambiar idioma a criollo" }).click();
  await expect(page.getByRole("heading", { name: "Objektif sante ACCESS ou yo" })).toBeVisible();
  await expect(page.locator("#screen-content")).toContainText("152 / 88");
  await expect(page.locator("#screen-content")).toContainText("Pwen depa konfime");
  await expect(page.locator("#screen-content")).not.toContainText("Pou konfime");
});

// A confirmed baseline is not progress. This patient has no monitor and has taken no readings, so
// the goal reports that instead of inventing a reading — a fabricated 120/80 sitting above a
// starting point of 152/88 tells them they have already reached a control they have not.
test("a goal with a baseline and no monitor shows what it knows, and invents no readings", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await openAccessCareScreen(page, "GOALS");
  // Moving on is what writes the assigned goals to the patient's record.
  await page.getByRole("button", { name: "Tell us what could make this harder" }).click();
  await page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2"));
    draft.screen = "MY_GOALS";
    draft.activeGoalId = draft.patientGoals.find(goal => goal.goalType === "BLOOD_PRESSURE_CONTROL").id;
    localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify(draft));
  });
  await page.reload();

  await expect(page.getByRole("heading", { name: "Keep my blood pressure under control" })).toBeVisible();
  await expect(page.locator(".goal-health-card")).toContainText("We have not received a reading today.");
  const screen = page.locator("#screen-content");
  await expect(screen).not.toContainText("120 / 80");
  await expect(screen).not.toContainText("Received automatically from your monitor");
  await expect(screen).not.toContainText("readings received");
  await expect(page.locator(".goal-trend-summary")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Ask EMMI to explain this trend/ })).toHaveCount(0);

  // The starting point and the milestones are still there: a baseline is a fact, not progress.
  const outcome = page.locator(".access-goal-outcome");
  await expect(outcome).toContainText("152 / 88");
  await expect(outcome).toContainText("Baseline confirmed");
  await expect(outcome).toContainText("137 mmHg or lower");
});

// My Goals is where the patient comes back weeks later. A card that showed a next step but not the
// number the goal is measured from would make them open the goal just to remember where they began.
test("both goal cards carry the starting point the rest of the journey showed", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await openAccessCareScreen(page, "GOALS");
  await page.getByRole("button", { name: "Tell us what could make this harder" }).click();
  await page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2"));
    draft.screen = "MY_GOALS";
    delete draft.activeGoalId;
    localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify(draft));
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "My Goals" })).toBeVisible();

  const bloodPressure = page.locator('.goal-card:has-text("Keep my blood pressure under control")');
  const weight = page.locator('.goal-card:has-text("Reach or maintain a healthy weight")');
  await expect(bloodPressure.locator(".goal-summary-baseline")).toContainText("152 / 88 mmHg");
  await expect(weight.locator(".goal-summary-baseline")).toContainText("204 lb");
  await expect(weight.locator(".goal-summary-baseline")).toContainText("BMI 31.0");

  // The starting point is a fact, not progress. Neither card counts anything it has not measured.
  await expect(page.locator("#screen-content")).not.toContainText("readings received");
  await expect(page.locator(".goal-metric-list")).toHaveCount(0);

  // And it says the same thing in the patient's own language.
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.locator(".goal-summary-baseline").first()).toContainText("Punto de partida");
  await expect(page.locator("#screen-content")).toContainText("IMC 31.0");
});

// ---------------------------------------------------------------------------------------------
// The care setup list, after the goals segment
// ---------------------------------------------------------------------------------------------

// Only the goal chooser used to record that goals were done, and no ACCESS patient sees it. So a
// patient who had walked their goals, answered the barriers question and confirmed their health
// information landed on a list that still said "Your goals: Not completed" — and tapped it looking
// for the part they had missed.
test("finishing the goals segment marks the goals section of the care setup list complete", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await openAccessCareScreen(page, "GOALS");
  await page.getByRole("button", { name: "Tell us what could make this harder" }).click();
  await expect(page.getByRole("heading", { name: "Is anything making your care harder?" })).toBeVisible();

  // The patient raises real difficulties, the way the reported flow did.
  const raised = ["FORGETFULNESS_ROUTINE", "DEVICE_TECHNOLOGY", "UNDERSTANDING"];
  for (const category of raised) await page.locator(`#support-needs-form input[value="${category}"]`).first().check();
  await page.locator('.support-need-group').nth(1).locator('input[value="NONE"]').check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Confirm your health information" })).toBeVisible();
  await page.getByRole("button", { name: "Yes, everything is correct" }).click();
  await page.getByRole("button", { name: "Confirm and continue" }).click();

  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();
  const goalsCard = page.locator('[data-action="care-setup-section"][data-section="goals"]');
  await expect(goalsCard).toHaveClass(/completed/);
  await expect(goalsCard).toContainText("✓ Completed");
  await expect(page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")).goalsStatus)).resolves.toBe("COMPLETED");
});

// Reopening a completed goals section includes its saved barriers review, then hands the patient
// back to the setup list instead of continuing through the remaining activation journey.
test("opening completed goals from care setup reviews saved answers and returns to the list", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await openAccessCareScreen(page, "GOALS");
  await page.getByRole("button", { name: "Tell us what could make this harder" }).click();
  await page.locator('.support-need-group input[value="NONE"]').nth(0).check();
  await page.locator('.support-need-group input[value="NONE"]').nth(1).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Yes, everything is correct" }).click();
  await page.getByRole("button", { name: "Confirm and continue" }).click();
  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();

  await page.locator('[data-action="care-setup-section"][data-section="goals"]').click();
  await expect(page.getByRole("heading", { name: "Your ACCESS health goals" })).toBeVisible();
  await page.getByRole("button", { name: "Tell us what could make this harder" }).click();

  await expect(page.getByRole("heading", { name: "Is anything making your care harder?" })).toBeVisible();
  await expect(page.locator('.support-need-group input[value="NONE"]')).toHaveCount(2);
  await expect(page.locator('.support-need-group input[value="NONE"]').nth(0)).toBeChecked();
  await expect(page.locator('.support-need-group input[value="NONE"]').nth(1)).toBeChecked();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();
});

// Coming back to the barriers question — by Back, or from the care setup list — used to show every
// box empty, telling a patient who had just answered that none of it had been recorded.
test("the barriers question comes back with the difficulties the patient already raised", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await openAccessCareScreen(page, "GOALS");
  await page.getByRole("button", { name: "Tell us what could make this harder" }).click();
  const bloodPressureGroup = page.locator('.support-need-group:has-text("Keep my blood pressure under control")');
  await bloodPressureGroup.locator('input[value="FORGETFULNESS_ROUTINE"]').check();
  await bloodPressureGroup.locator('input[value="UNDERSTANDING"]').check();
  await page.locator('.support-need-group:has-text("Reach or maintain a healthy weight") input[value="NONE"]').check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Confirm your health information" })).toBeVisible();

  await page.locator('.actions [data-action="back"]').click();
  await expect(page.getByRole("heading", { name: "Is anything making your care harder?" })).toBeVisible();
  await expect(bloodPressureGroup.locator('input[value="FORGETFULNESS_ROUTINE"]')).toBeChecked();
  await expect(bloodPressureGroup.locator('input[value="UNDERSTANDING"]')).toBeChecked();
  // A difficulty belongs to the goal it was raised against, so the weight goal is left alone.
  await expect(page.locator('.support-need-group:has-text("Reach or maintain a healthy weight") input[value="FORGETFULNESS_ROUTINE"]')).not.toBeChecked();
});

// The barriers review is the completion evidence for Your goals, and reopening that card restores
// the answers instead of introducing a second setup card for the same segment.
test("the goals section restores its completed barriers review", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await openAccessCareScreen(page, "GOALS");
  await page.getByRole("button", { name: "Tell us what could make this harder" }).click();

  const bloodPressure = page.locator('.support-need-group:has-text("Keep my blood pressure under control")');
  const weight = page.locator('.support-need-group:has-text("Reach or maintain a healthy weight")');
  await bloodPressure.locator('input[value="FORGETFULNESS_ROUTINE"]').check();
  // One goal is going fine. That is an answer, and it has to survive as one.
  await weight.locator('input[value="NONE"]').check();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Yes, everything is correct" }).click();
  await page.getByRole("button", { name: "Confirm and continue" }).click();
  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();

  const goalsCard = page.locator('[data-action="care-setup-section"][data-section="goals"]');
  await expect(goalsCard).toHaveClass(/completed/);
  await expect(goalsCard).toContainText("✓ Completed");
  await expect(page.locator('[data-action="care-setup-section"][data-section="support"]')).toHaveCount(0);

  // Reopening it shows the patient their own answers back, including the goal they said was fine.
  await goalsCard.click();
  await page.getByRole("button", { name: "Tell us what could make this harder" }).click();
  await expect(page.getByRole("heading", { name: "Is anything making your care harder?" })).toBeVisible();
  await expect(bloodPressure.locator('input[value="FORGETFULNESS_ROUTINE"]')).toBeChecked();
  await expect(weight.locator('input[value="NONE"]')).toBeChecked();
  await expect(weight.locator('input[value="FORGETFULNESS_ROUTINE"]')).not.toBeChecked();

  // And continuing hands them back to the list, not round the journey again.
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(saved.goalsStatus).toBe("COMPLETED");
  const byType = Object.fromEntries(saved.patientGoals.map(goal => [goal.goalType, goal.supportNeedsAssessment?.selectedCategories]));
  expect(byType.BLOOD_PRESSURE_CONTROL).toEqual(["FORGETFULNESS_ROUTINE"]);
  // "Nothing right now" leaves no barrier behind, so only the recorded answer separates it from a
  // goal the patient never answered for.
  expect(byType.WEIGHT_MANAGEMENT).toEqual(["NONE"]);
  expect(saved.patientGoals.find(goal => goal.goalType === "WEIGHT_MANAGEMENT").barriers || []).toEqual([]);
});

// Only ACCESS asks the barriers question, so only ACCESS lists it. A CCM patient offered a section
// that leads to an empty form would be worse off than one who never saw it.
test("the barriers section belongs to ACCESS and appears on no other programme", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await page.goto("/?scenario=ccm-happy");
  await page.evaluate(() => {
    localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({
      scenarioId: "ccm-happy", screen: "ONBOARDING", role: "patient", completionRole: "patient",
      identityVerified: true, consentSaved: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED",
      language: "en", audit: [], careTeamTasks: [], careMedications: [], careGoals: [], bpReadings: [], bpReadingReceipts: []
    }));
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();

  await expect(page.locator('[data-action="care-setup-section"]')).toHaveCount(4);
  await expect(page.locator('[data-action="care-setup-section"][data-section="support"]')).toHaveCount(0);
});
