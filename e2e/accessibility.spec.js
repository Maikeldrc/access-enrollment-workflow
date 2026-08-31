import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The automated half of an accessibility audit.
//
// The structural properties — touch targets, labels, tab order, one h1, no clipped text — are
// asserted where they belong, in the specs for the screens they describe. This is the rules-based
// sweep on top of them: colour contrast, ARIA that does not mean what it says, landmarks, names on
// controls. It found the brand logo sitting at 2.58:1 on every screen in the product.
//
// It is not a substitute for a screen reader. Automated rules catch roughly the half of WCAG that
// can be decided without a person, and the QA report says so rather than claiming more.

const JOURNEY = ["INVITATION", "DECISION_MAKER", "IDENTITY_VERIFICATION", "CARE_RECOMMENDATION",
  "ACCESS_PRE_ELIGIBILITY_NOTICE", "ACCESS_ELIGIBILITY_RESULT", "CONSENT_REVIEW",
  "ENROLLMENT_CONFIRMED", "ACCESS_BP_DEVICE_INFO", "GOALS", "ACCESS_SUPPORT_NEEDS",
  "CLINICAL_VERIFICATION", "MEDICATIONS_REVIEW", "CARE_PREFERENCES", "ONBOARDING_COMPLETE"];

const describeViolation = violation =>
  `${violation.id} (${violation.impact}) — ${violation.help}\n      ${violation.nodes.slice(0, 2).map(node => (node.html || "").replace(/\s+/g, " ").slice(0, 120)).join("\n      ")}`;

for (const screen of JOURNEY) {
  test(`${screen} has no automated accessibility violations`, async ({ page }) => {
    await page.goto("/?scenario=access-happy");
    await page.locator("#screen-select").selectOption(screen, { force: true });
    await page.waitForTimeout(400);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(violations.map(describeViolation), `${screen} fails WCAG A/AA rules`).toEqual([]);
  });
}

test("the Spanish and Creole screens are announced in the language they are written in", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  for (const expected of ["es", "ht"]) {
    await page.locator("[data-action=language]").first().click();
    await page.waitForTimeout(300);
    // A screen reader picks its voice from this. Left at "en", Spanish is read with English
    // phonetics, which is worse than no announcement at all.
    await expect(page.locator("html")).toHaveAttribute("lang", expected);
  }
});
