import { test, expect } from "@playwright/test";

// 384x824 is the primary mobile reference (Samsung Galaxy S25 Ultra); the rest stay in the
// matrix so the header remains fluid from roughly 360px to 430px.
const viewports = [
  [384, 824],
  [360, 800],
  [375, 812],
  [390, 844],
  [393, 852],
  [412, 915],
  [430, 932]
];

async function headerLayout(page) {
  return page.locator(".app-header").evaluate(header => {
    const shell = header.closest(".shell").getBoundingClientRect();
    const row = header.querySelector(".brand-row").getBoundingClientRect();
    const back = header.querySelector(".back-button").getBoundingClientRect();
    const brand = header.querySelector(".brand").getBoundingClientRect();
    const language = header.querySelector(".language").getBoundingClientRect();
    const languageIcon = header.querySelector(".language .icon").getBoundingClientRect();
    const stage = header.querySelector(".progress-meta span");
    const stageRect = stage.getBoundingClientRect();
    const languageStyle = getComputedStyle(header.querySelector(".language"));
    const stageStyle = getComputedStyle(stage);
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      shellWidth: shell.width,
      rowContained: row.left >= shell.left && row.right <= shell.right,
      controlsContained: back.left >= shell.left && language.right <= shell.right,
      brandCenterDelta: Math.abs((brand.left + brand.width / 2) - (shell.left + shell.width / 2)),
      languageDisplay: languageStyle.display,
      languageDirection: languageStyle.flexDirection,
      languageWhiteSpace: languageStyle.whiteSpace,
      languageTouchHeight: language.height,
      iconVerticallyAligned: Math.abs((languageIcon.top + languageIcon.height / 2) - (language.top + language.height / 2)) < 1,
      stageCount: header.querySelectorAll(".progress-meta span").length,
      stageClipped: stage.scrollWidth > stage.clientWidth || stage.scrollHeight > stage.clientHeight,
      stageEllipsis: stageStyle.textOverflow === "ellipsis",
      stageContained: stageRect.left >= shell.left && stageRect.right <= shell.right
    };
  });
}

test("global patient header remains balanced across supported mobile viewports", async ({ page }) => {
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto("/?scenario=access-happy");
    await page.locator("#screen-select").selectOption("ENROLLMENT_CONFIRMED", { force: true });
    await expect(page.locator(".progress-meta span")).toHaveText("Enrollment complete");
    const layout = await headerLayout(page);
    expect(layout).toMatchObject({
      overflow: false,
      rowContained: true,
      controlsContained: true,
      languageDisplay: "flex",
      languageDirection: "row",
      languageWhiteSpace: "nowrap",
      iconVerticallyAligned: true,
      stageCount: 1,
      stageClipped: false,
      stageEllipsis: false,
      stageContained: true
    });
    expect(layout.brandCenterDelta).toBeLessThanOrEqual(1);
    expect(layout.languageTouchHeight).toBeGreaterThanOrEqual(44);
    expect(layout.shellWidth).toBe(width);
    if ([384, 375, 390, 412, 430].includes(width)) {
      await page.screenshot({ path: `qa-evidence/header/header-${width}.png`, fullPage: true });
    }
  }
});

test("language icon and code stay in one horizontal control for EN, ES, and KR", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/?scenario=access-happy");
  await page.getByRole("button", { name: "See how it works" }).click();
  for (const expected of ["EN", "ES", "KR"]) {
    const language = page.locator(".app-header .language");
    await expect(language).toContainText(expected);
    const layout = await headerLayout(page);
    expect(layout.languageDisplay).toBe("flex");
    expect(layout.languageDirection).toBe("row");
    expect(layout.languageWhiteSpace).toBe("nowrap");
    expect(layout.iconVerticallyAligned).toBe(true);
    if (expected !== "KR") await language.click();
  }
});

test("landing language control uses the same horizontal pattern", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/?scenario=access-happy");
  for (const expected of ["EN", "ES", "KR"]) {
    const language = page.locator(".stage-language");
    await expect(language).toContainText(expected);
    const layout = await language.evaluate(control => {
      const icon = control.querySelector(".icon").getBoundingClientRect();
      const rect = control.getBoundingClientRect();
      const style = getComputedStyle(control);
      return {
        display: style.display,
        direction: style.flexDirection,
        whiteSpace: style.whiteSpace,
        height: rect.height,
        aligned: Math.abs((icon.top + icon.height / 2) - (rect.top + rect.height / 2)) < 1,
        contained: rect.left >= 0 && rect.right <= innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth
      };
    });
    expect(layout).toMatchObject({ display: "flex", direction: "row", whiteSpace: "nowrap", aligned: true, contained: true, overflow: false });
    expect(layout.height).toBeGreaterThanOrEqual(44);
    if (expected !== "KR") await language.click();
  }
});

test("stage changes only when Getting Started actually begins", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/?scenario=ccm-happy");
  await page.locator("#screen-select").selectOption("ENROLLMENT_CONFIRMED", { force: true });
  await expect(page.locator(".progress-meta span")).toHaveText("Enrollment complete");

  await page.getByRole("button", { name: "Set up my care" }).click();
  await expect(page.locator(".progress-meta span")).toHaveText("Getting started");

  await page.locator("#screen-select").selectOption("ENROLLMENT_CONFIRMED", { force: true });
  await page.getByRole("button", { name: "I’ll do this later" }).click();
  await expect(page.locator(".progress-meta span")).toHaveText("Enrollment complete");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(saved.activationStatus).toBe("NOT_STARTED");
  expect(saved.flowProgress.GETTING_STARTED.status).toBe("DEFERRED");
});
