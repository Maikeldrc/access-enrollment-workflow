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
  await expect(page.getByRole("heading", { name: "Let’s personalize your plan for this goal" })).toBeVisible();
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
  await page.getByRole("button", { name: "Personalize my plan" }).click();
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
  await expect(page.getByText(/You can adjust the actions in your personal plan/)).toBeVisible();
  await page.getByRole("button", { name: /How is this goal going/ }).click();
  await page.getByRole("button", { name: "I’m having a hard time" }).click();
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

  test(`goal personalization offer is readable without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openGoals(page);
    await page.getByLabel("Keep my blood pressure under control").check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Let’s personalize your plan for this goal" })).toBeVisible();
    await expect(page.locator(".goal-selected-card")).toContainText("Keep my blood pressure under control");
    const audit = await page.locator("#screen-content").evaluate(root => ({
      overflow: root.scrollWidth > root.clientWidth + 1,
      minButton: Math.min(...[...root.querySelectorAll(".goal-plan-choice .button")].map(node => node.getBoundingClientRect().height)),
      titleSize: parseFloat(getComputedStyle(root.querySelector("h1")).fontSize)
    }));
    expect(audit.overflow).toBe(false);
    expect(audit.minButton).toBeGreaterThanOrEqual(44);
    expect(audit.titleSize).toBeGreaterThanOrEqual(28);
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
  await page.getByRole("button", { name: /Personalize my plan/ }).click();
  for (const label of ["Check my blood pressure regularly", "Take my medications as directed", "Learn what my blood pressure numbers mean"]) {
    await page.getByLabel(label).check();
  }
  await page.getByRole("button", { name: /Continue|Review/ }).click();
  await expect(page.getByRole("heading", { name: "Review your personalized plan" })).toBeVisible();
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
  await expect(buttons.nth(1)).toHaveText(/Edit my plan/);
  await expect(page.getByRole("button", { name: "Change something" })).toHaveCount(0);

  const audit = await page.evaluate(() => {
    const root = document.querySelector("#screen-content");
    const smallest = [...root.querySelectorAll(".care-plan-action strong, .care-plan-action small, .care-plan-meta strong")]
      .map(node => parseFloat(getComputedStyle(node).fontSize));
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      clipped: [...root.querySelectorAll("*")].filter(node => node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).overflowX !== "auto")
        .map(node => `${node.tagName}.${node.className}:${node.textContent.trim().slice(0, 30)}`),
      minFont: Math.min(...smallest),
      minCta: Math.min(...[...root.querySelectorAll(".goal-stacked-actions .button")].map(node => node.getBoundingClientRect().height)),
      tables: root.querySelectorAll("table").length
    };
  });
  expect(audit.overflow).toBe(false);
  expect(audit.clipped).toEqual([]);
  expect(audit.minFont).toBeGreaterThanOrEqual(16);
  expect(audit.minCta).toBeGreaterThanOrEqual(44);
  expect(audit.tables).toBe(0);
});

test("goal detail turns connected readings into understandable longitudinal progress", async ({ page }) => {
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

  await expect(page.getByRole("heading", { name: "Keep my blood pressure under control" })).toBeVisible();
  await expect(page.locator(".goal-health-card")).toContainText("120 / 80");
  await expect(page.locator(".goal-health-card")).toContainText("Within the expected range");
  await expect(page.locator(".goal-health-card")).toContainText("Received automatically from your monitor");
  await expect(page.getByRole("heading", { name: "How my blood pressure has been" })).toBeVisible();
  await expect(page.locator(".goal-trend-summary")).toContainText("124 / 81");
  await expect(page.locator(".goal-trend-chart")).toHaveAttribute("role", "img");
  await expect(page.getByRole("heading", { name: "My actions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My progress" })).toBeVisible();
  const actions = page.locator(".goal-action");
  await expect(actions.first().locator(".goal-action-icon svg")).toBeVisible();

  // The connected BP action is verified by the device and never asks the patient to mark it.
  await expect(actions.first()).toContainText("Reading received today");
  await expect(actions.first()).toContainText("Automatic");
  await expect(actions.first().getByRole("button")).toHaveCount(0);
  await expect(actions.first()).toHaveClass(/is-done/);
  await expect(page.locator(".goal-progress-metrics")).toContainText("5");
  await expect(page.locator(".goal-progress-metrics")).toContainText("readings received");

  // Patient-reported medication action keeps an explicit, human confirmation.
  const medication = actions.filter({ hasText: "Take my medications as directed" });
  await medication.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(medication).toContainText("Reported today");

  // Reading history is a simple list, not a clinical table.
  await page.getByRole("button", { name: /View my readings/ }).click();
  await expect(page.getByRole("heading", { name: "My blood pressure readings" })).toBeVisible();
  await expect(page.locator(".goal-reading-history-item")).toHaveCount(5);
  await expect(page.locator("table")).toHaveCount(0);
  await page.getByRole("button", { name: /Back to my goal/ }).click();

  // Navigation and plan adjustment are full buttons, not small inline links.
  await expect(page.locator(".goal-back-button")).toContainText("Back to My Goals");
  await expect(page.getByRole("button", { name: "Adjust my plan" })).toBeVisible();
  // A clinical target is presented as care-team owned, never patient-editable here.
  await expect(page.locator(".clinical-target-card")).toContainText("Goal set by your care team");

  const audit = await page.evaluate(() => {
    const root = document.querySelector("#screen-content");
    const columns = [...root.querySelectorAll(":scope > h1, :scope > .goal-panel, :scope > .goal-section, :scope > .goal-back-button")].map(node => node.getBoundingClientRect());
    const buttons = [...root.querySelectorAll(".goal-action-button, .goal-secondary-button, .goal-card-action, .goal-back-button")];
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      clipped: [...root.querySelectorAll("*")].filter(node => node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).overflowX !== "auto")
        .map(node => `${node.tagName}.${node.className}:${node.textContent.trim().slice(0, 30)}`),
      leftEdges: new Set(columns.map(rect => Math.round(rect.left))).size,
      rightEdges: new Set(columns.map(rect => Math.round(rect.right))).size,
      minButton: Math.min(...buttons.map(node => node.getBoundingClientRect().height)),
      minFont: Math.min(...[...root.querySelectorAll(".goal-action-copy strong, .goal-action-copy small, .goal-health-source, .goal-progress-metrics span")].map(node => parseFloat(getComputedStyle(node).fontSize)))
    };
  });
  expect(audit.overflow).toBe(false);
  expect(audit.clipped).toEqual([]);
  // One global mobile grid: every section shares the same left and right edge.
  expect(audit.leftEdges).toBe(1);
  expect(audit.rightEdges).toBe(1);
  expect(audit.minButton).toBeGreaterThanOrEqual(44);
  expect(audit.minFont).toBeGreaterThanOrEqual(16);
});

for (const width of [360, 375, 384, 390, 393, 412, 430]) {
  test(`longitudinal goal detail stays mobile-first at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 824 });
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
    const audit = await page.locator("#screen-content").evaluate(root => ({
      rootOverflow: root.scrollWidth > root.clientWidth + 1,
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      metricWidth: root.querySelector(".goal-health-card").getBoundingClientRect().width,
      contentWidth: root.getBoundingClientRect().width - parseFloat(getComputedStyle(root).paddingLeft) - parseFloat(getComputedStyle(root).paddingRight),
      minTouch: Math.min(...[...root.querySelectorAll("button")].map(node => node.getBoundingClientRect().height))
    }));
    expect(audit.rootOverflow).toBe(false);
    expect(audit.documentOverflow).toBe(false);
    expect(audit.metricWidth).toBeGreaterThan(audit.contentWidth * 0.99);
    expect(audit.minTouch).toBeGreaterThanOrEqual(44);
  });
}

for (const scale of [1.25, 1.5]) {
  test(`goal detail accepts ${Math.round(scale * 100)}% text scaling`, async ({ page }) => {
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
    await page.evaluate(value => { document.documentElement.style.fontSize = `${16 * value}px`; }, scale);
    const overflow = await page.locator("#screen-content").evaluate(root => root.scrollWidth > root.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1);
    expect(overflow).toBe(false);
    await expect(page.locator(".goal-health-value")).toContainText("120 / 80");
  });
}

test("longitudinal goal detail is complete in Spanish and Kreyòl", async ({ page }) => {
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
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.getByRole("heading", { name: "Mantener mi presión arterial bajo control" })).toBeVisible();
  await expect(page.locator(".goal-health-card")).toContainText("Recibida automáticamente desde su monitor");
  await expect(page.getByRole("heading", { name: "Cómo ha estado mi presión" })).toBeVisible();
  await page.getByRole("button", { name: "Cambiar idioma a criollo" }).click();
  await expect(page.getByRole("heading", { name: "Kenbe tansyon mwen anba kontwòl" })).toBeVisible();
  await expect(page.locator(".goal-health-card")).toContainText("Resevwa otomatikman nan monitè ou");
  await expect(page.getByRole("heading", { name: "Kijan tansyon mwen te ye" })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText(/[가-힣]/);
});

test("goals carry a category icon that is the same goal-by-goal and screen-by-screen", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await openGoals(page);

  // Goal Discovery teaches the visual system from the first screen: seven goals, seven families,
  // not the same target icon seven times.
  const discovery = await page.evaluate(() => [...document.querySelectorAll(".goal-check-row")].map(row => ({
    label: row.innerText.replace(/\s+/g, " ").replace("✓ ", "").trim(),
    category: row.querySelector(".goal-icon").dataset.goalCategory
  })));
  expect(discovery.map(row => row.category)).toEqual([
    "CARDIOVASCULAR", "INDEPENDENCE", "PREVENTION", "MEDICATIONS", "WELLBEING", "ACTIVITY_MOBILITY", "GENERIC"
  ]);
  expect(discovery.find(row => row.label === "Other").category).toBe("GENERIC");
  // Decorative: the goal's name already says what it is.
  expect(await page.locator(".goal-check-row .goal-icon .icon").first().getAttribute("aria-hidden")).toBe("true");

  const medicationsGlyph = await page.locator('.goal-check-row:has-text("Better understand my medications") .goal-icon svg').innerHTML();

  await page.getByLabel("Better understand my medications").check();
  await page.getByLabel("Keep my blood pressure under control").check();
  await page.getByRole("button", { name: "Choose my priorities" }).click();

  // Priorities: the same pill icon in both lists, and the goal already taken as primary keeps its
  // icon while it is unavailable as a second priority.
  const primaryList = page.getByRole("group", { name: "Primary priority" });
  await expect(primaryList.locator('.choice-card:has-text("Better understand my medications") .goal-icon')).toHaveAttribute("data-goal-category", "MEDICATIONS");
  await primaryList.getByLabel("Keep my blood pressure under control").check();

  const secondaryList = page.getByRole("group", { name: "Secondary priority (optional)" });
  const takenCard = secondaryList.locator('.choice-card:has-text("Keep my blood pressure under control")');
  await expect(takenCard.locator(".goal-icon")).toHaveAttribute("data-goal-category", "CARDIOVASCULAR");
  await expect(takenCard).toContainText("Already selected as your primary priority");
  await expect(takenCard.locator("input")).toBeDisabled();
  expect(await secondaryList.locator('.choice-card:has-text("Better understand my medications") .goal-icon svg').innerHTML()).toBe(medicationsGlyph);
  // "No second priority" is not a goal and keeps its own neutral icon.
  await expect(secondaryList.locator('.choice-card:has-text("No second priority") .goal-icon')).toHaveCount(0);

  await secondaryList.getByLabel("Better understand my medications").check();
  await page.getByRole("button", { name: "Continue" }).click();

  // Plan personalization and Care Plan Review both show the primary goal's own icon.
  await expect(page.locator(".goal-selected-card .goal-icon")).toHaveAttribute("data-goal-category", "CARDIOVASCULAR");
  await page.getByRole("button", { name: "Personalize my plan" }).click();
  await expect(page.locator(".goal-selected-card .goal-icon")).toHaveAttribute("data-goal-category", "CARDIOVASCULAR");
  await page.getByLabel("Check my blood pressure regularly").check();
  await page.getByRole("button", { name: "Review my plan" }).click();
  await expect(page.locator(".care-plan-goal .goal-icon")).toHaveAttribute("data-goal-category", "CARDIOVASCULAR");
  // A goal's icon is not reused for its actions: the steps keep their own meanings.
  const goalGlyph = await page.locator(".care-plan-goal .goal-icon svg").innerHTML();
  const actionGlyphs = await page.locator(".care-plan-action .icon svg").evaluateAll(nodes => nodes.map(node => node.innerHTML));
  expect(actionGlyphs.length).toBeGreaterThan(0);
  expect(actionGlyphs.every(html => html === goalGlyph)).toBe(false);

  await page.getByRole("button", { name: "Save my plan" }).click();
  await page.locator("#screen-select").selectOption("ONBOARDING_COMPLETE", { force: true });
  await page.getByRole("button", { name: "Go to my dashboard" }).click();
  await page.getByRole("button", { name: /My Goals/ }).click();

  // My Goals and Goal Detail complete the chain: one goal, one icon, everywhere.
  await expect(page.locator('.my-goal-card:has-text("Better understand my medications") .goal-icon')).toHaveAttribute("data-goal-category", "MEDICATIONS");
  expect(await page.locator('.my-goal-card:has-text("Better understand my medications") .goal-icon svg').innerHTML()).toBe(medicationsGlyph);
  await page.locator('.my-goal-card:has-text("Keep my blood pressure under control")').getByRole("button", { name: /View plan/ }).click();
  await expect(page.locator(".goal-detail-hero .goal-icon")).toHaveAttribute("data-goal-category", "CARDIOVASCULAR");
});

test("goal icons stay one consistent size across viewports and text scaling", async ({ page }) => {
  for (const width of [360, 375, 384, 390, 393, 412, 430]) {
    await page.setViewportSize({ width, height: 824 });
    await openGoals(page);
    for (const scale of [1, 1.25, 1.5]) {
      await page.evaluate(value => {
        document.documentElement.style.fontSize = `${16 * value}px`;
        document.documentElement.style.setProperty("--font-body", `${18 * value}px`);
      }, scale);
      const audit = await page.evaluate(() => {
        const rows = [...document.querySelectorAll(".goal-check-row")];
        const boxes = rows.map(row => row.querySelector(".goal-icon").getBoundingClientRect());
        const glyphs = rows.map(row => row.querySelector(".goal-icon svg").getBoundingClientRect());
        const text = rows.map(row => row.querySelector(":scope > span:last-child").getBoundingClientRect());
        return {
          boxSizes: [...new Set(boxes.map(box => `${Math.round(box.width)}x${Math.round(box.height)}`))],
          glyphSizes: [...new Set(glyphs.map(glyph => `${Math.round(glyph.width)}x${Math.round(glyph.height)}`))],
          minRowHeight: Math.min(...rows.map(row => row.getBoundingClientRect().height)),
          minTextWidth: Math.min(...text.map(rect => rect.width)),
          minFont: Math.min(...rows.map(row => parseFloat(getComputedStyle(row).fontSize))),
          truncated: rows.some(row => row.scrollWidth > row.clientWidth + 1),
          overlap: rows.some((row, index) => boxes[index].right > text[index].left + 1),
          overflow: document.documentElement.scrollWidth > innerWidth
        };
      });
      const label = `${width}px @${scale}x`;
      expect(audit.boxSizes, `${label} one container size`).toEqual(["44x44"]);
      expect(audit.glyphSizes, `${label} one glyph size`).toEqual(["22x22"]);
      expect(audit.minRowHeight, `${label} touch target`).toBeGreaterThanOrEqual(48);
      expect(audit.minTextWidth, `${label} text keeps the remaining width`).toBeGreaterThan(150);
      expect(audit.minFont, `${label} font`).toBeGreaterThanOrEqual(18 * scale - 0.5);
      expect(audit.truncated, `${label} truncation`).toBe(false);
      expect(audit.overlap, `${label} icon and text overlap`).toBe(false);
      expect(audit.overflow, `${label} overflow`).toBe(false);
    }
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "";
      document.documentElement.style.removeProperty("--font-body");
    });
  }
});

test("a custom goal the patient writes falls back to the generic target icon", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await openGoals(page);
  await page.getByLabel("Other").check();
  await page.getByLabel("What would you like to work toward?").fill("Attend my graduation party");
  await expect(page.locator('.goal-check-row:has-text("Other") .goal-icon')).toHaveAttribute("data-goal-category", "GENERIC");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".goal-selected-card .goal-icon")).toHaveAttribute("data-goal-category", "GENERIC");
  // A fallback still draws an icon: no blank container, no crash.
  await expect(page.locator(".goal-selected-card .goal-icon svg")).toBeVisible();
});
