import { test, expect } from "@playwright/test";
import { openEmmiConversation } from "./emmiSurfaces.js";

// A configuration screen that appears for a moment is still a configuration screen the patient saw.
// This records every screen the app ever paints, from before the first script runs, so "it never
// appeared" is asserted against the whole load rather than against one late snapshot.
const watchForConfigurationScreen = page => page.addInitScript(() => {
  window.__configurationScreenSeen = false;
  const configurationCopy = /Configure the patient scenario|Launch Patient Experience|Select program|Choose condition|Prototype configuration|Demo patient/i;
  const look = () => {
    if (document.querySelector(".prototype-console") || configurationCopy.test(document.body?.innerText || "")) window.__configurationScreenSeen = true;
  };
  const start = () => { look(); new MutationObserver(look).observe(document.body, { childList: true, subtree: true, characterData: true }); };
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
});

const sawConfigurationScreen = page => page.evaluate(() => window.__configurationScreenSeen);

test("the public link opens the ACCESS invitation directly, with no scenario to configure", async ({ page }) => {
  await watchForConfigurationScreen(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A smarter way to manage your health" })).toBeVisible();
  expect(await sawConfigurationScreen(page)).toBe(false);
  await expect(page.locator(".prototype-console")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Launch Patient Experience/ })).toHaveCount(0);
  // Scenario and screen jumping are QA controls, absent from a patient's invitation in every build.
  await expect(page.locator(".dev-panel")).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test("the invitation is the one canonical scenario and the patient cannot change it", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".trust-hero-card")).toHaveAttribute("data-hero-variant", "DOCTOR_RECOMMENDS_ACCESS");
  await expect(page.locator(".invitation-stage")).toHaveAttribute("data-trust-source", "Provider / Practice Referral");
  await expect(page.locator(".physician-attribution")).toHaveText("Recommended by Dr. Fresner");
  await expect(page.getByRole("heading", { name: "Your doctor recommends ACCESS care" })).toBeVisible();
  // Nothing on the patient's path offers another program, another condition or another track.
  await expect(page.locator('select, input[type="radio"], input[type="checkbox"]')).toHaveCount(0);
  const body = page.locator("body");
  for (const program of ["CCM", "RPM", "PCM", "APCM", "BHI", "CoCM", "RTM"]) await expect(body).not.toContainText(new RegExp(`\b${program}\b`));
  for (const condition of ["Diabetes", "Heart Failure", "Chronic Kidney Disease"]) await expect(body).not.toContainText(condition);
});

// Phase 1. The Home has to read as a smarter way to manage your health rather than as a form,
// and it has to keep saying that taking part is the patient's choice while it does so.
test("the Home offers a modern way to manage health without dropping voluntariness", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A smarter way to manage your health" })).toBeVisible();
  await expect(page.locator(".invitation-copy .lead")).toHaveText("Stay connected with your care team, keep track of your health, and get support when you need it.");
  await expect(page.locator(".invitation-benefit strong")).toHaveText(["Stay connected with your care team", "Get support from home", "Understand your health better"]);
  await expect(page.locator(".invitation-voluntary")).toHaveText("Participation is voluntary. You’ll review all the details before you decide.");
  await expect(page.getByRole("button", { name: "Start your care journey" })).toBeVisible();

  // The trust card and its attribution are untouched by the copy work below it.
  await expect(page.locator(".trust-hero-card")).toHaveAttribute("data-hero-variant", "DOCTOR_RECOMMENDS_ACCESS");
  await expect(page.locator(".physician-attribution")).toHaveText("Recommended by Dr. Fresner");

  // EMMI keeps its name and role, and says more about what it can actually do.
  await expect(page.locator(".emmi-welcome-identity")).toContainText("Your ITERA Care Assistant");
  await expect(page.locator(".emmi-welcome-copy")).toHaveText("I can help you understand your health information, guide you through each step, and connect you with your care team when you need help.");
  await expect(page.getByRole("button", { name: /Ask EMMI/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Guide by voice/ })).toBeVisible();
});

test("the Home reads in every language, and the patient’s choice of language survives a reload", async ({ page }) => {
  const homeCopy = {
    en: { heading: "A smarter way to manage your health", cta: "Start your care journey", voluntary: /Participation is voluntary/ },
    es: { heading: "Una forma más inteligente de cuidar su salud", cta: "Comience su recorrido de cuidado", voluntary: /La participación es voluntaria/ },
    ht: { heading: "Yon fason pi entelijan pou jere sante ou", cta: "Kòmanse pwosesis swen ou", voluntary: /Patisipasyon an volontè/ }
  };
  // Walked the way a patient walks it, through the toggle on the card. A locale is only done when
  // its own words are on screen: an English fallback is a failure, not a graceful degradation.
  await page.goto("/");
  for (const language of ["en", "es", "ht"]) {
    const copy = homeCopy[language];
    await expect(page.getByRole("heading", { name: copy.heading })).toBeVisible();
    await expect(page.getByRole("button", { name: copy.cta })).toBeVisible();
    await expect(page.locator(".invitation-voluntary")).toHaveText(copy.voluntary);
    if (language !== "en") await expect(page.locator("#screen-content")).not.toContainText(homeCopy.en.heading);
    await page.locator(".stage-language").click();
  }

  // Switching language is the patient's decision, so it has to outlive a reload. The invitation
  // carries a default language, and a default must not overwrite a choice.
  await expect(page.getByRole("heading", { name: homeCopy.en.heading })).toBeVisible();
  await page.locator(".stage-language").click();
  await expect(page.getByRole("heading", { name: homeCopy.es.heading })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: homeCopy.es.heading })).toBeVisible();
  await page.locator(".stage-language").click();
  await page.locator(".stage-language").click();
});

// 384px is the primary target; the rest are the widths patients actually arrive on. Text scaling
// is the setting a senior is most likely to have turned up, and the first thing to break a layout.
test("the Home holds its layout at every supported width and text size", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A smarter way to manage your health" })).toBeVisible();
  for (const width of [360, 375, 384, 390, 393, 412, 430]) {
    for (const scale of [1, 1.25, 1.5]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(value => { document.documentElement.style.fontSize = `${16 * value}px`; }, scale);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow at ${width}px / ${scale * 100}%`).toBeLessThanOrEqual(1);
      // Clipped copy is unreadable copy, and at 150% it is the first thing to break. Only a box
      // that actually cuts content counts: on an overflow:visible heading, scrollHeight includes
      // the glyphs' own ink beyond the line box, which is not clipping and must not fail the run.
      const damaged = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll(".invitation-copy h1, .invitation-copy .lead, .invitation-benefit strong, .invitation-benefit small, .invitation-voluntary, .actions .button.primary")];
        const cut = nodes.filter(node => getComputedStyle(node).overflow !== "visible"
          && (node.scrollHeight - node.clientHeight > 1 || node.scrollWidth - node.clientWidth > 1));
        const offscreen = nodes.filter(node => {
          const rect = node.getBoundingClientRect();
          return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
        });
        return [...cut, ...offscreen].map(node => node.className || node.tagName);
      });
      expect(damaged, `clipped or off-screen Home copy at ${width}px / ${scale * 100}%`).toEqual([]);
      // Voluntariness must stay one step below a benefit title at every text size, not overtake it.
      const [voluntarySize, benefitSize] = await page.evaluate(() => [".invitation-voluntary", ".invitation-benefit strong"]
        .map(selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize)));
      expect(voluntarySize, `voluntariness hierarchy at ${width}px / ${scale * 100}%`).toBeLessThan(benefitSize);
      // Senior-friendly means reachable: the primary action keeps a real touch target.
      const ctaHeight = await page.locator(".actions .button.primary").evaluate(node => node.getBoundingClientRect().height);
      expect(ctaHeight, `CTA touch target at ${width}px / ${scale * 100}%`).toBeGreaterThanOrEqual(44);
    }
  }
});

test("a refresh reopens the invitation, never the configuration screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A smarter way to manage your health" })).toBeVisible();
  await watchForConfigurationScreen(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "A smarter way to manage your health" })).toBeVisible();
  expect(await sawConfigurationScreen(page)).toBe(false);
});

test("a scenario left behind by QA never leaks into a patient's invitation", async ({ page }) => {
  // A different program, a different condition, a different language and a half-finished flow, all
  // saved by the console in this browser. None of it belongs to this patient.
  await page.addInitScript(() => {
    localStorage.setItem("itera.prototype.config.v1", JSON.stringify({ program: "CCM", source: "ITERA Direct Outreach", conditions: ["Diabetes", "Heart Failure"], coverage: "Medicare Advantage", language: "es", accessTrack: "MSK", accessEligibilityResult: "notEligible", physicianDisplayName: "Dr. Otro" }));
    localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({ scenarioId: "prototype", screen: "CONSENT_REVIEW", identityVerified: true, language: "es" }));
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A smarter way to manage your health" })).toBeVisible();
  await expect(page.locator(".trust-hero-card")).toHaveAttribute("data-hero-variant", "DOCTOR_RECOMMENDS_ACCESS");
  await expect(page.locator(".physician-attribution")).toHaveText("Recommended by Dr. Fresner");
});

test("removing the configuration screen did not remove any enrollment step", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start your care journey" }).click();

  await expect(page.getByRole("heading", { name: "Who is completing this?" })).toBeVisible();
  await page.locator('.choice-card:has(input[value="patient"])').click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Identity verification still stands between the link and the rest of the journey.
  await expect(page.getByRole("heading", { name: "Let’s securely confirm it’s you" })).toBeVisible();
  await page.locator('input[name="dob"]').fill("05/12/1954");
  await page.locator('input[name="zip"]').fill("33176");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "What your care includes" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // The Medicare eligibility check still has to be acknowledged before it runs: an invitation that
  // skips its own configuration screen does not skip the patient's consent to be checked.
  const eligibilityGate = page.getByRole("heading", { name: "Let’s confirm your eligibility with Medicare" });
  await expect(eligibilityGate).toBeVisible();
  const runCheck = page.getByRole("button", { name: "Check my eligibility" });
  await expect(runCheck).toBeDisabled();
  await page.locator('input[name="accessNotice"]').check();
  await expect(runCheck).toBeEnabled();
  await runCheck.click();
  await expect(eligibilityGate).toHaveCount(0);

  await expect(page.locator("#screen-content")).not.toContainText(/Configure|Launch Patient Experience|prototype/i);
});

test("EMMI knows who invited the patient from the first turn", async ({ page }) => {
  await page.goto("/");
  const dialog = await openEmmiConversation(page);
  await dialog.getByPlaceholder("Ask a question…").fill("Who invited me?");
  await dialog.getByRole("button", { name: "Send question" }).click();
  const answer = dialog.locator(".assistant-message.assistant p").filter({ hasText: /invited you to learn about ACCESS care/i });
  await expect(answer).toBeVisible();
  await expect(answer).toContainText("Dr. Fresner");
  await expect(answer).not.toContainText(/already enrolled|you are enrolled/i);
});

test("the QA console and its simulation tools live behind the admin route only", async ({ page }) => {
  await page.goto("/?admin=1");
  await expect(page.getByRole("heading", { name: "Configure the patient scenario" })).toBeVisible();
  await expect(page.locator(".bp-simulation")).toBeVisible();
  for (const control of ["start-bp-simulation", "inject-bp-caution", "inject-bp-critical", "reset-bp-simulation"]) {
    await expect(page.locator(`[data-action="${control}"]`)).toHaveCount(1);
  }
  await page.goto("/");
  await expect(page.locator(".bp-simulation")).toHaveCount(0);
  for (const control of ["start-bp-simulation", "inject-bp-caution", "inject-bp-critical", "reset-bp-simulation"]) {
    await expect(page.locator(`[data-action="${control}"]`)).toHaveCount(0);
  }
});
