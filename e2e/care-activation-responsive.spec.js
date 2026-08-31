import { test, expect } from "@playwright/test";

// The care activation screens at every width and text size the spec requires.
//
// Audited while walking through them, not by jumping to each one. Two reasons: the QA screen
// selector does not exist on the canonical invitation, which is correct — a patient must never see
// the console — and the goals and barrier groups only have their real content once the patient has
// passed through the steps that create them. A screen audited empty proves nothing about the screen
// the patient sees.

const WIDTHS = [360, 375, 384, 390, 393, 412, 430];
const SCALES = [1, 1.25, 1.5];

const audit = page => page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  // A control the patient cannot reliably hit is a control they do not have. A checkbox is hit
  // through its label, so the row is what gets measured.
  shortTargets: [...document.querySelectorAll("button, a.button, summary, input[type=checkbox], input[type=radio]")]
    .filter(element => {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const box = element.type === "checkbox" || element.type === "radio" ? element.closest("label") || element : element;
      const rect = box.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.height < 44;
    })
    .map(element => `${element.tagName}:${(element.textContent || "").trim().slice(0, 28)}`),
  // Text cut off by a fixed height vanishes without any overflow to notice.
  clipped: [...document.querySelectorAll("h1, h2, h3, p, dd, li, strong, legend")]
    .filter(element => {
      const style = getComputedStyle(element);
      return element.scrollHeight > element.clientHeight + 2 && style.overflow !== "visible" && style.overflowY !== "visible";
    })
    .map(element => (element.textContent || "").trim().slice(0, 32))
}));

const checkHere = async (page, label, width) => {
  for (const scale of SCALES) {
    await page.evaluate(value => { document.documentElement.style.fontSize = `${16 * value}px`; }, scale);
    await page.waitForTimeout(80);
    const result = await audit(page);
    const where = `${label} at ${width}px / ${Math.round(scale * 100)}%`;
    expect(result.overflow, `${where} overflows horizontally`).toBe(false);
    expect(result.shortTargets, `${where} has touch targets under 44px`).toEqual([]);
    expect(result.clipped, `${where} clips its own text`).toEqual([]);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
};

for (const width of WIDTHS) {
  test(`care activation holds its layout at ${width}px across text sizes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 880 });

    await page.goto("/");
    await page.getByRole("button", { name: "Start your care journey" }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Date of birth", { exact: true }).fill("05 / 12 / 1954");
    await page.getByLabel("ZIP code", { exact: true }).fill("33176");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("I understand this information and want to continue with the Medicare eligibility check").check();
    await page.getByRole("button", { name: "Check my eligibility" }).click();
    await expect(page.getByRole("heading", { name: /you can continue with ACCESS/i })).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.locator("#consent-form input[type=checkbox]").check();
    await page.getByRole("button", { name: "Confirm and continue" }).click();
    await expect(page.getByRole("heading", { name: "Welcome to your ACCESS care" })).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: /Set up my care/i }).click();

    await expect(page.getByRole("heading", { name: "Track your blood pressure from home" })).toBeVisible();
    await checkHere(page, "device request", width);

    await page.locator(".cuff-choice-list .choice-card").first().click();
    await page.getByRole("button", { name: /Request my monitor/i }).click();
    await expect(page.getByRole("heading", { name: /Where would you like your monitor delivered/i })).toBeVisible();
    await checkHere(page, "delivery address", width);

    await page.getByRole("button", { name: /Request my monitor/i }).click();
    await expect(page.getByRole("heading", { name: "Your monitor is being prepared" })).toBeVisible({ timeout: 20000 });
    await checkHere(page, "request confirmed", width);

    await page.getByRole("button", { name: /See my health goals/i }).click();
    await expect(page.locator(".access-goal-card")).toHaveCount(2);
    await checkHere(page, "assigned goals", width);

    // The goal detail is behind a disclosure, and what it hides has to survive being shown.
    await page.locator(".access-goal-details > summary").first().click();
    await checkHere(page, "assigned goals expanded", width);

    await page.getByRole("button", { name: /make this harder/i }).click();
    await expect(page.locator(".support-need-group")).toHaveCount(2);
    await checkHere(page, "support needs", width);

    await page.locator(".support-need-group").first().locator('input[value="FORGETFULNESS_ROUTINE"]').check();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Yes, everything is correct" }).click();
    await page.getByRole("button", { name: /Confirm|Continue/i }).last().click();
    for (let step = 0; step < 8; step += 1) {
      if (await page.getByRole("heading", { name: "Your ACCESS care is ready" }).count()) break;
      const primary = page.locator(".actions button:not([disabled])").last();
      if (!(await primary.count())) break;
      await primary.click();
      await page.waitForTimeout(400);
    }

    await expect(page.getByRole("heading", { name: "Your ACCESS care is ready" })).toBeVisible({ timeout: 20000 });
    await checkHere(page, "active care", width);
  });
}
