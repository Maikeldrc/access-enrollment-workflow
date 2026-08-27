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
  // The clinical target is care-team owned; the patient adjusts their own actions instead.
  await expect(page.getByText("Set by your care team")).toBeVisible();
  await expect(page.getByText(/You can still adjust the actions in your plan/)).toBeVisible();
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

// Walks the goal flow to the plan review, which is the screen the patient confirms.
async function openPlanReview(page) {
  await openGoals(page);
  await page.getByLabel("Keep my blood pressure under control").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Make a plan now/ }).click();
  for (const label of ["Check my blood pressure regularly", "Take my medications as directed", "Learn what my blood pressure numbers mean"]) {
    await page.getByLabel(label).check();
  }
  await page.getByRole("button", { name: /Continue|Review/ }).click();
  await expect(page.getByRole("heading", { name: "Review your plan" })).toBeVisible();
}

test("care plan review reads as a personal plan rather than an administrative table", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await openPlanReview(page);

  const card = page.locator(".care-plan-card");
  await expect(card).toBeVisible();
  // The goal leads the screen, and each step is a scannable row with its own icon.
  await expect(card.locator(".care-plan-goal strong")).toHaveText("Keep my blood pressure under control");
  await expect(card.getByRole("heading", { name: "What I’m going to do" })).toBeVisible();
  const rows = card.locator(".care-plan-action");
  await expect(rows).toHaveCount(3);
  for (const row of await rows.all()) await expect(row.locator("svg")).toBeVisible();

  await expect(page.getByText("You can change this plan later.")).toBeVisible();
  // Primary first, secondary beneath, neither squeezed into a shared row.
  const buttons = page.locator(".goal-stacked-actions .button");
  await expect(buttons.nth(0)).toHaveText(/Save my plan/);
  await expect(buttons.nth(1)).toHaveText(/Edit plan/);
  await expect(page.getByRole("button", { name: "Change something" })).toHaveCount(0);

  const audit = await page.evaluate(() => {
    const root = document.querySelector("#screen-content");
    const smallest = [...root.querySelectorAll(".care-plan-action strong, .care-plan-action small, .care-plan-meta strong")]
      .map(node => parseFloat(getComputedStyle(node).fontSize));
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      clipped: [...root.querySelectorAll("*")].filter(node => node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).overflowX !== "auto").length,
      minFont: Math.min(...smallest),
      minCta: Math.min(...[...root.querySelectorAll(".goal-stacked-actions .button")].map(node => node.getBoundingClientRect().height)),
      tables: root.querySelectorAll("table").length
    };
  });
  expect(audit.overflow).toBe(false);
  expect(audit.clipped).toBe(0);
  expect(audit.minFont).toBeGreaterThanOrEqual(16);
  expect(audit.minCta).toBeGreaterThanOrEqual(44);
  expect(audit.tables).toBe(0);
});

test("goal detail shows what to do, what was done today, and real progress", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await openPlanReview(page);
  await page.getByRole("button", { name: /Save my plan/ }).click();
  await page.evaluate(() => {
    const select = document.querySelector("#screen-select");
    const option = document.createElement("option");
    option.value = "MY_GOALS";
    select.appendChild(option);
    select.value = "MY_GOALS";
    select.dispatchEvent(new Event("change"));
  });
  await page.getByRole("button", { name: "View plan" }).click();

  await expect(page.getByRole("heading", { name: "My actions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My progress" })).toBeVisible();
  const actions = page.locator(".goal-action");
  await expect(actions.first().locator(".goal-action-icon svg")).toBeVisible();

  // Progress is derived from real action state, never invented.
  await expect(page.locator(".goal-progress-count")).toContainText("0 of 3");
  await expect(page.locator(".goal-progress-empty")).toContainText("fresh start");
  const first = actions.first().locator(".goal-action-button");
  await expect(first).toHaveText(/Mark done/);
  await first.click();
  await expect(first).toHaveText(/Done today/);
  await expect(first).toBeDisabled();
  await expect(actions.first()).toHaveClass(/is-done/);
  await expect(page.locator(".goal-progress-count")).toContainText("1 of 3");

  // Navigation and plan adjustment are full buttons, not small inline links.
  await expect(page.locator(".goal-back-button")).toContainText("Back to My Goals");
  await expect(page.locator(".goal-secondary-button").first()).toContainText("Adjust my plan");
  // A clinical target is presented as care-team owned, never patient-editable here.
  await expect(page.locator(".clinical-target-card")).toContainText("Set by your care team");

  const audit = await page.evaluate(() => {
    const root = document.querySelector("#screen-content");
    const columns = [...root.querySelectorAll(":scope > h1, :scope > .goal-panel, :scope > .goal-section, :scope > .goal-back-button")].map(node => node.getBoundingClientRect());
    const buttons = [...root.querySelectorAll(".goal-action-button, .goal-secondary-button, .goal-back-button")];
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      clipped: [...root.querySelectorAll("*")].filter(node => node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).overflowX !== "auto").length,
      leftEdges: new Set(columns.map(rect => Math.round(rect.left))).size,
      rightEdges: new Set(columns.map(rect => Math.round(rect.right))).size,
      minButton: Math.min(...buttons.map(node => node.getBoundingClientRect().height)),
      minFont: Math.min(...[...root.querySelectorAll(".goal-action-copy strong, .goal-action-copy small")].map(node => parseFloat(getComputedStyle(node).fontSize)))
    };
  });
  expect(audit.overflow).toBe(false);
  expect(audit.clipped).toBe(0);
  // One global mobile grid: every section shares the same left and right edge.
  expect(audit.leftEdges).toBe(1);
  expect(audit.rightEdges).toBe(1);
  expect(audit.minButton).toBeGreaterThanOrEqual(44);
  expect(audit.minFont).toBeGreaterThanOrEqual(16);
});
