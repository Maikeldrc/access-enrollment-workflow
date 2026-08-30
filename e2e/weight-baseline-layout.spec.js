import { expect, test } from "@playwright/test";

// The weight goal's starting point, measured.
//
// Weight and BMI are two readings of the same confirmed baseline, so they read as a pair on one
// row rather than as a number with a footnote under it. That is a layout claim, and a layout claim
// about two numbers on a 360px card is only worth as much as the widths and text sizes it was
// checked at — so it is checked at all of them, in all three languages.

const MOBILE_WIDTHS = [360, 375, 384, 390, 393, 412, 430];
const TEXT_SCALES = [1, 1.25, 1.5];

const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const scaleText = async (page, scale) => {
  await page.evaluate(value => { document.documentElement.style.fontSize = `${16 * value}px`; }, scale);
  await settle(page);
};

// The seed puts the patient where care activation would have left them — a confirmed weight and a
// confirmed BMI on their record — and changes nothing else about the invitation.
const seedAccessScreen = async (page, screen) => {
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

const openAccessGoals = async page => {
  await seedAccessScreen(page, "GOALS");
  await expect(page.getByRole("heading", { name: "Your ACCESS health goals" })).toBeVisible();
};

// Goal Detail is only reachable once the goals have been accepted, so the plan is walked rather
// than written: the screen is opened the way the patient opens it.
const openWeightGoalDetail = async page => {
  await openAccessGoals(page);
  await page.getByRole("button", { name: "Tell us what could make this harder" }).click();
  await page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2"));
    const weight = (draft.patientGoals || []).find(goal => goal.goalType === "WEIGHT_MANAGEMENT");
    Object.assign(draft, { screen: "MY_GOALS", goalDetailView: "SUMMARY", activeGoalId: weight.id });
    localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify(draft));
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "How ACCESS measures this goal" })).toBeVisible();
};

const assertRowFits = async (page, metrics, where) => {
  await expect(metrics.locator(".access-goal-detail")).toHaveText("BMI 31.0");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `horizontal overflow on the ${where}`).toBeLessThanOrEqual(1);
  const { row, weight, bmi, confirmed } = await boxes(metrics);
  expect(bmi.left, `BMI starts after the weight on the ${where}`).toBeGreaterThanOrEqual(weight.right);
  expect(weight.left, `weight inside the row on the ${where}`).toBeGreaterThanOrEqual(row.left - 1);
  expect(bmi.right, `BMI inside the row on the ${where}`).toBeLessThanOrEqual(row.right + 1);
  expect(confirmed.top, `confirmation below the metrics on the ${where}`).toBeGreaterThanOrEqual(row.bottom - 1);
};

// The weight card is the second of the two assigned goals, and the only one with a BMI.
const weightMetrics = page => page.locator(".access-goal-card").last().locator(".access-goal-metrics");

const boxes = locator => locator.evaluate(node => {
  const rect = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
  return {
    row: rect(node),
    weight: rect(node.querySelector(".access-goal-value")),
    bmi: rect(node.querySelector(".access-goal-detail")),
    confirmed: rect(node.parentElement.querySelector(".access-goal-confirmed"))
  };
});

test("the weight starting point puts weight and BMI on one row, above the confirmation", async ({ page }) => {
  await openAccessGoals(page);
  await page.setViewportSize({ width: 384, height: 844 });
  await settle(page);

  const metrics = weightMetrics(page);
  await expect(metrics.locator(".access-goal-value")).toContainText("204");
  await expect(metrics.locator(".access-goal-detail")).toHaveText("BMI 31.0");

  const { row, weight, bmi, confirmed } = await boxes(metrics);
  // Side by side, weight first: it is the number the goal is about.
  expect(bmi.left, "BMI starts after the weight ends").toBeGreaterThanOrEqual(weight.right);
  expect(Math.min(weight.bottom, bmi.bottom) - Math.max(weight.top, bmi.top), "same row").toBeGreaterThan(0);
  // Weight to the card's left edge, BMI to its right.
  expect(weight.left - row.left, "weight is flush left").toBeLessThanOrEqual(1);
  expect(row.right - bmi.right, "BMI is flush right").toBeLessThanOrEqual(1);
  // The confirmation belongs to both of them, so it sits under both.
  expect(confirmed.top, "confirmation below the metrics").toBeGreaterThanOrEqual(row.bottom - 1);
});

// The BP card has one number and must keep the layout it already had.
test("the blood pressure starting point is left untouched", async ({ page }) => {
  await openAccessGoals(page);
  const bloodPressure = page.locator(".access-goal-card").first();
  await expect(bloodPressure.locator(".access-goal-value")).toContainText("152 / 88");
  await expect(bloodPressure.locator(".access-goal-metrics")).toHaveCount(0);
  await expect(bloodPressure.locator(".access-goal-confirmed")).toContainText("Baseline confirmed");
});

test("the weight starting point holds its layout at every supported width, text size and language", async ({ page }) => {
  await openAccessGoals(page);
  const languages = [
    ["English", null, "BMI 31.0"],
    ["Spanish", "Change language to Spanish", "IMC 31.0"],
    ["Kreyòl", "Cambiar idioma a criollo", "BMI 31.0"]
  ];

  for (const [language, switchTo, bmiText] of languages) {
    if (switchTo) await page.getByRole("button", { name: switchTo }).click();
    const metrics = weightMetrics(page);
    await expect(metrics.locator(".access-goal-detail")).toHaveText(bmiText);

    for (const width of MOBILE_WIDTHS) {
      for (const scale of TEXT_SCALES) {
        await page.setViewportSize({ width, height: 844 });
        await scaleText(page, scale);
        const label = `${language} ${width}px / ${scale * 100}%`;

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `horizontal overflow at ${label}`).toBeLessThanOrEqual(1);

        const damaged = await page.evaluate(() => [...document.querySelectorAll(".access-goal-metrics, .access-goal-metrics p, .access-goal-confirmed")]
          .filter(node => getComputedStyle(node).overflow !== "visible" && (node.scrollHeight - node.clientHeight > 1 || node.scrollWidth - node.clientWidth > 1))
          .map(node => node.className || node.tagName));
        expect(damaged, `clipped starting point at ${label}`).toEqual([]);

        const { row, weight, bmi, confirmed } = await boxes(metrics);
        // Neither metric may spill out of the row that holds them, whichever way the row breaks.
        expect(weight.left, `weight inside the row at ${label}`).toBeGreaterThanOrEqual(row.left - 1);
        expect(bmi.right, `BMI inside the row at ${label}`).toBeLessThanOrEqual(row.right + 1);
        // Wrapped or not, the weight is read first and the confirmation last.
        expect(bmi.top, `BMI after the weight at ${label}`).toBeGreaterThanOrEqual(weight.top - 1);
        expect(confirmed.top, `confirmation below the metrics at ${label}`).toBeGreaterThanOrEqual(row.bottom - 1);

        const sideBySide = bmi.left >= weight.right - 1 && Math.min(weight.bottom, bmi.bottom) > Math.max(weight.top, bmi.top);
        // Up to 125% the row holds both. At 150% it is allowed to stack rather than clip — but if
        // it stacks, each metric gets its own line and stays flush left, never half-indented.
        if (scale <= 1.25) expect(sideBySide, `side by side at ${label}`).toBe(true);
        else if (!sideBySide) expect(bmi.left - row.left, `stacked BMI is flush left at ${label}`).toBeLessThanOrEqual(1);
      }
    }
    await scaleText(page, 1);
  }
});

// The same starting point block is rendered on the care plan and inside Goal Detail. Both are
// narrower than the goals card, and a right-aligned number has an edge to fall off, so the row is
// checked where it actually sits rather than only where it was designed.
test("the care plan and Goal Detail show the same row inside their own edges", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 });

  await seedAccessScreen(page, "ONBOARDING_COMPLETE");
  await expect(page.getByRole("heading", { name: "Your health goals" })).toBeVisible();
  await assertRowFits(page, page.locator(".access-plan-goal").last().locator(".access-goal-metrics"), "care plan");

  await openWeightGoalDetail(page);
  await assertRowFits(page, page.locator(".access-goal-outcome .access-goal-metrics"), "goal detail");
});
