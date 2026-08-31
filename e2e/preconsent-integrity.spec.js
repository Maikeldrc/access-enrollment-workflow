import { test, expect } from "@playwright/test";

// Home through Consent — the half of the journey the care activation work never touched.
//
// The QA report listed it as not re-audited on this branch, and everything since had been about
// what happens after the patient agrees. These are the properties that half has to hold: it is
// where a patient decides, so nothing may claim they have decided, and nothing may be unreadable
// or unreachable at the size and in the language they are using.

const SCREENS = ["INVITATION", "DECISION_MAKER", "IDENTITY_VERIFICATION", "CARE_RECOMMENDATION",
  "ACCESS_PRE_ELIGIBILITY_NOTICE", "ACCESS_ELIGIBILITY_RESULT", "CONSENT_REVIEW"];

const openAt = async (page, screen) => {
  await page.locator("#screen-select").selectOption(screen, { force: true });
  await page.waitForTimeout(350);
};

const layout = page => page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  // Text cut off by a fixed height disappears with no overflow to notice.
  clipped: [...document.querySelectorAll("h1,h2,h3,p,li,dd,strong,legend,label,small")]
    .filter(el => { const st = getComputedStyle(el); return el.scrollHeight > el.clientHeight + 2 && st.overflow !== "visible" && st.overflowY !== "visible"; })
    .map(el => (el.textContent || "").trim().slice(0, 40)),
  // A checkbox is 20px and unhittable alone; what the patient presses is the row around it.
  shortTargets: [...document.querySelectorAll("button, a.button, summary, input[type=checkbox], input[type=radio], select")]
    .filter(el => { const st = getComputedStyle(el); if (st.display === "none" || st.visibility === "hidden") return false;
      const box = (el.type === "checkbox" || el.type === "radio") ? (el.closest("label") || el) : el;
      const r = box.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 44; })
    .map(el => `${el.tagName}:${(el.textContent || el.name || "").trim().slice(0, 24)}`),
  unlabelled: [...document.querySelectorAll("input:not([type=hidden]), select, textarea")]
    .filter(el => !el.labels?.length && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby"))
    .map(el => `${el.tagName}[${el.name || el.id || "?"}]`),
  namelessButtons: [...document.querySelectorAll("button")].filter(el => !(el.textContent || "").trim() && !el.getAttribute("aria-label")).length,
  headings: document.querySelectorAll("#screen-content h1").length
}));

for (const width of [360, 390]) {
  test(`the pre-consent screens stay readable at ${width}px and at 150% text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/?scenario=access-happy");
    for (const screen of SCREENS) {
      await openAt(page, screen);
      for (const scale of [1, 1.5]) {
        await page.evaluate(value => { document.documentElement.style.fontSize = `${16 * value}px`; }, scale);
        await page.waitForTimeout(120);
        const result = await layout(page);
        const where = `${screen} at ${width}px / ${scale * 100}%`;
        expect(result.overflow, `${where} overflows horizontally`).toBe(false);
        expect(result.clipped, `${where} clips its own text`).toEqual([]);
        expect(result.shortTargets, `${where} has touch targets under 44px`).toEqual([]);
        expect(result.unlabelled, `${where} has a field with no label`).toEqual([]);
        expect(result.namelessButtons, `${where} has a button with no accessible name`).toBe(0);
        expect(result.headings, `${where} should have exactly one h1`).toBe(1);
      }
      await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    }
  });
}

// The words that only appear if an English string leaked into a translated screen.
const ENGLISH = /\b(Continue|Back|We'll|We will|Please|Select|Choose|Review|Confirm|Enroll|Enrollment|Next step|Learn more|Agree|Get started)\b/g;

test("no English leaks into the Spanish or Creole pre-consent screens", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  for (const language of ["Spanish", "Creole"]) {
    await page.locator("[data-action=language]").first().click();
    for (const screen of SCREENS) {
      await openAt(page, screen);
      const text = (await page.locator("#screen-content").textContent() || "").replace(/\s+/g, " ");
      const leaked = [...new Set([...text.matchAll(ENGLISH)].map(match => match[0]))];
      expect(leaked, `${screen} in ${language} shows English`).toEqual([]);
    }
  }
});

test("nothing before consent says the patient is enrolled, and consent is never pre-agreed", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  for (const screen of SCREENS) {
    await openAt(page, screen);
    const text = (await page.locator("#screen-content").textContent() || "").replace(/\s+/g, " ");
    // Cleared is not enrolled. This half of the journey is where the patient decides.
    expect(/you are enrolled|you're enrolled|enrollment is complete|welcome to your ACCESS care/i.test(text), `${screen} claims enrollment before consent`).toBe(false);
    const boxes = page.locator("#screen-content input[type=checkbox]");
    for (let index = 0; index < await boxes.count(); index += 1) {
      await expect(boxes.nth(index), `${screen} pre-agreed a checkbox on the patient's behalf`).not.toBeChecked();
    }
  }
});

test("every pre-consent screen can be operated from the keyboard", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  for (const screen of SCREENS) {
    await openAt(page, screen);
    const reachable = await page.evaluate(() => {
      const focusable = [...document.querySelectorAll("#screen-content button, #screen-content a[href], #screen-content input, #screen-content select, #screen-content textarea, #screen-content summary")]
        .filter(el => !el.disabled && el.offsetParent !== null);
      return { total: focusable.length, removed: focusable.filter(el => Number(el.getAttribute("tabindex")) < 0).map(el => el.tagName) };
    });
    expect(reachable.total, `${screen} has nothing focusable`).toBeGreaterThan(0);
    expect(reachable.removed, `${screen} takes a visible control out of the tab order`).toEqual([]);
  }
});
