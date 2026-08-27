import { expect, test } from "@playwright/test";

async function openGoals(page) {
  await page.goto("/?scenario=ccm-happy");
  await page.locator("#screen-select").selectOption("GOALS", { force: true });
  await expect(page.getByRole("heading", { name: "What matters most to you?" })).toBeVisible();
}

test("one goal skips prioritization and can defer planning", async ({ page }) => {
  await openGoals(page);
  await page.getByLabel("Stay active").check();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Let’s make a plan for this goal" })).toBeVisible();
  await page.getByRole("button", { name: "I’ll do this with my care team later" }).click();
  await expect(page.getByRole("button", { name: /Your goals\. Completed/ })).toBeVisible();
});

test("multiple goals support priority, planning and longitudinal My Goals", async ({ page }) => {
  await openGoals(page);
  await page.getByLabel("Keep my blood pressure under control").check();
  await page.getByLabel("Stay independent").check();
  await expect(page.getByRole("button", { name: "Choose my priorities" })).toBeVisible();
  await page.getByRole("button", { name: "Choose my priorities" }).click();
  await page.getByRole("group", { name: "Secondary priority (optional)" }).getByLabel("Stay independent").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Make a plan now" }).click();
  await page.getByLabel("Check my blood pressure regularly").check();
  await page.getByLabel("Why this matters to me (optional)").fill("I want to stay active with my family.");
  await page.getByRole("button", { name: "Review my plan" }).click();
  await expect(page.getByText("I want to stay active with my family.")).toBeVisible();
  await page.getByRole("button", { name: "Save my plan" }).click();
  await page.locator("#screen-select").selectOption("ONBOARDING_COMPLETE", { force: true });
  await page.getByRole("button", { name: "Go to my dashboard" }).click();
  await page.getByRole("button", { name: /My Goals/ }).click();
  await expect(page.getByRole("heading", { name: "My Goals" })).toBeVisible();
  await expect(page.getByText("My priority")).toBeVisible();
  await page.getByRole("button", { name: /View plan/ }).click();
  await expect(page.getByText("Set by your care team. You cannot edit it here.")).toBeVisible();
  await page.getByRole("button", { name: /How is this goal going/ }).click();
  await page.getByRole("button", { name: "I’m having some difficulty" }).click();
  await page.getByLabel("I forget").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "How can we help?" })).toBeVisible();
  await page.getByRole("button", { name: /Talk to my care team/ }).click();
  await expect(page.getByText("Your request was shared with your care team.")).toBeVisible();
  await page.getByText("Review or adjust this goal").click();
  await page.getByRole("button", { name: "Pause this goal" }).click();
  await expect(page.getByText("This goal is paused. You can return to it later.")).toBeVisible();
  await page.getByText("Review or adjust this goal").click();
  await page.getByRole("button", { name: "Restart this goal" }).click();
  await page.getByText("Review or adjust this goal").click();
  await page.getByRole("button", { name: "Mark as achieved" }).click();
  await expect(page.getByText("It does not change a clinical target or your care plan.")).toBeVisible();
  await page.getByRole("button", { name: "Mark as achieved" }).click();
  await expect(page.getByText("You marked this personal goal as achieved.")).toBeVisible();
});

test("custom goal requires a patient title and remains responsive", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openGoals(page);
  await page.getByLabel("Other").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert")).toContainText("Tell us what you would like to work toward.");
  await page.getByLabel("What would you like to work toward?").fill("Attend my granddaughter’s graduation");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Attend my granddaughter’s graduation")).toBeVisible();
  const overflow = await page.locator("#screen-content").evaluate(element => element.scrollWidth > element.clientWidth + 1);
  expect(overflow).toBe(false);
});

for (const [width, height] of [[384, 824], [360, 800], [375, 812], [390, 844], [393, 852], [412, 915], [430, 932]]) {
  test(`goal discovery has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openGoals(page);
    const overflow = await page.locator("#screen-content").evaluate(element => element.scrollWidth > element.clientWidth + 1);
    expect(overflow).toBe(false);
    const overlap = await page.evaluate(() => {
      const assistant = document.querySelector(".emmi-assistant")?.getBoundingClientRect();
      const actions = document.querySelector(".actions")?.getBoundingClientRect();
      return Boolean(assistant && actions && assistant.left < actions.right && assistant.right > actions.left && assistant.top < actions.bottom && assistant.bottom > actions.top);
    });
    expect(overlap).toBe(false);
  });
}

test("goal discovery copy is available in Spanish and Kreyòl", async ({ page }) => {
  await openGoals(page);
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.getByRole("heading", { name: "¿Qué es lo más importante para usted?" })).toBeVisible();
  await page.getByRole("button", { name: "Cambiar idioma a criollo" }).click();
  await expect(page.getByRole("heading", { name: "Ki sa ki pi enpòtan pou ou?" })).toBeVisible();
});
