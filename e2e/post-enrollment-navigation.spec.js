import { test, expect } from "@playwright/test";

// Back, and the front door, for a patient who has already enrolled.
//
// The live re-test of 2026-08-30 found two ways out of the product and back onto the public
// invitation: Back from the medication list, and the invitation's own call to action. Both are
// only reachable once enrolled, which is why no existing spec caught them — every other spec
// either stops at enrollment or seeds a screen directly and never presses Back from it.
//
// The journey is walked rather than seeded for the same reason the golden journey is: the defect
// is in where the patient came from, and a seeded screen has no history to get wrong.

const enrol = async page => {
  const continueOn = () => page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.goto("/");
  await page.getByRole("button", { name: "Start your care journey" }).click();
  await continueOn();
  await page.getByLabel("Date of birth", { exact: true }).fill("05 / 12 / 1954");
  await page.getByLabel("ZIP code", { exact: true }).fill("33176");
  await continueOn();
  await continueOn();
  await page.getByLabel("I understand this information and want to continue with the Medicare eligibility check").check();
  await page.getByRole("button", { name: "Check my eligibility" }).click();
  await expect(page.getByRole("heading", { name: /you can continue with ACCESS/i })).toBeVisible({ timeout: 20000 });
  await continueOn();
  await page.locator("#consent-form input[type=checkbox]").check();
  await page.getByRole("button", { name: "Confirm and continue" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to your ACCESS care" })).toBeVisible({ timeout: 20000 });
};

const finishCareSetup = async page => {
  await page.getByRole("button", { name: /Set up my care/i }).click();
  await page.locator(".cuff-choice-list .choice-card").first().click();
  await page.getByRole("button", { name: /Request my monitor/i }).click();
  await page.getByRole("button", { name: /Request my monitor/i }).click();
  await expect(page.getByRole("heading", { name: "Your monitor is being prepared" })).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: /See my health goals/i }).click();
  await page.getByRole("button", { name: /make this harder/i }).click();
  await page.locator(".support-need-group").first().locator('input[value="FORGETFULNESS_ROUTINE"]').check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByText("Everything looks right").click();
  await page.getByRole("button", { name: /Confirm|Continue/i }).last().click();
  for (let step = 0; step < 8; step += 1) {
    if (await page.getByRole("heading", { name: "Your ACCESS care is ready" }).count()) break;
    const primary = page.locator(".actions button:not([disabled])").last();
    if (!(await primary.count())) break;
    await primary.click();
    await page.waitForTimeout(400);
  }
  await expect(page.getByRole("heading", { name: "Your ACCESS care is ready" })).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: /Go to My Care/i }).click();
  await expect(page.getByRole("heading", { name: "My Care" })).toBeVisible();
};

test("Back from the medication list returns to My Care, not to the public invitation", async ({ page }) => {
  await enrol(page);
  await finishCareSetup(page);

  await page.locator(".my-medications-link").click();
  await expect(page.getByRole("heading", { name: /medication/i }).first()).toBeVisible();

  await page.locator(".back-button").click();

  await expect(page.getByRole("heading", { name: "My Care" })).toBeVisible();
  // The invitation is a page for someone deciding whether to join. This patient has joined.
  await expect(page.getByRole("button", { name: "Start your care journey" })).toHaveCount(0);
});

// This is how the patient in the re-test reached the invitation: the logo is the header's home
// button, and it read "home" as the invitation no matter who was pressing it.
test("the header logo takes an enrolled patient to My Care, not to the invitation", async ({ page }) => {
  await enrol(page);
  await finishCareSetup(page);

  await page.locator(".my-medications-link").click();
  await page.locator("a.brand").click();

  await expect(page.getByRole("heading", { name: "My Care" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start your care journey" })).toHaveCount(0);
});

test("the invitation's call to action resumes an enrolled patient instead of enrolling them again", async ({ page }) => {
  await enrol(page);
  await finishCareSetup(page);

  // However the patient reaches the invitation while enrolled, its call to action must not walk
  // them into enrolling a second time.
  await page.evaluate(() => {
    const key = "itera.enrollment.safe-draft.v2";
    const draft = JSON.parse(localStorage.getItem(key));
    draft.screen = "INVITATION";
    localStorage.setItem(key, JSON.stringify(draft));
  });
  await page.reload();

  const cta = page.getByRole("button", { name: "Start your care journey" });
  if (await cta.count()) {
    await cta.click();
    await expect(page.getByRole("heading", { name: "Who is completing this?" })).toHaveCount(0);
  }
  // Whether the app resumed on load or on the press, the patient must not be asked to enrol again.
  await expect(page.getByRole("heading", { name: "Who is completing this?" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /My Care|Set up your care/ })).toBeVisible();
});

test("the Spanish medication screen gives its directions in Spanish", async ({ page }) => {
  await enrol(page);
  await finishCareSetup(page);

  await page.getByRole("button", { name: /Change language|Cambiar idioma/i }).first().click();
  await page.locator(".my-medications-link").click();

  const screen = page.locator("#screen-content");
  await expect(screen).toContainText(/Tome una vez al día/);
  await expect(screen).not.toContainText(/Take once daily/);
});

// The production QA validation asked for "Am I enrolled?" before and after completion, as a pair.
// Before completion the answer was already right and only invisible behind the safety episode;
// this pins the other half, which nothing was holding.
test("EMMI's answer to whether the patient is enrolled changes when the enrollment does", async ({ page }) => {
  const { openEmmiConversation } = await import("./emmiSurfaces.js");
  const ask = async (dialog, question) => {
    const before = await dialog.locator(".assistant-message.assistant:not(.assistant-thinking)").count();
    await dialog.getByPlaceholder("Ask a question…").fill(question);
    await dialog.getByRole("button", { name: "Send question" }).click();
    await expect(dialog.locator(".assistant-message.assistant:not(.assistant-thinking)")).toHaveCount(before + 1, { timeout: 15000 });
    return (await dialog.locator(".assistant-message.assistant").last().textContent())?.trim() || "";
  };

  await page.goto("/");
  const before = await openEmmiConversation(page);
  // Not enrolled yet, and the answer has to say so rather than reading the ACCESS screen as a yes.
  expect(await ask(before, "Am I enrolled now?")).toMatch(/not enrolled until you review/i);
  await before.locator(".assistant-close").click();

  await enrol(page);

  const after = await openEmmiConversation(page);
  const answer = await ask(after, "Am I enrolled now?");
  expect(answer).not.toMatch(/not enrolled until you review/i);
  expect(answer).toMatch(/enrolled|enrollment/i);
});
