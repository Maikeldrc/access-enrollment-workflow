import { test, expect } from "@playwright/test";
import { openEmmiConversation, revealFloatingEmmi } from "./emmiSurfaces.js";

async function openOwnedBpVerification(page, scenario = "access-happy") {
  await page.goto(`/?scenario=${scenario}`);
  await page.locator("#screen-select").selectOption("ACCESS_MEASURE", { force: true });
  await page.locator('.choice-card:has(input[value="owned"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: /Your monitor is connected to ITERA|We don’t see a monitor connected to your care yet\.|We need to check your monitor|Let’s get you a connected monitor/ })).toBeVisible({ timeout: 5000 });
}

async function reachBpReadings(page, scenario = "access-happy") {
  await openOwnedBpVerification(page, scenario);
  await page.locator('.choice-card:has(input[value="yes"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "I’m ready" }).click();
  await expect(page.getByRole("heading", { name: "Let’s test your monitor" })).toBeVisible();
}

async function openNeededMonitorDetails(page) {
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ACCESS_MEASURE", { force: true });
  await page.locator('.choice-card:has(input[value="needed"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Let’s find the right monitor for you" })).toBeVisible();
}

test("prototype setup shows defaults and conditional fields", async ({ page }) => {
  await page.goto("/?admin=1");
  await expect(page.getByRole("heading", { name: "Configure the patient scenario" })).toBeVisible();
  const eligibilityResult = page.getByRole("combobox", { name: /ACCESS Eligibility Result/ });
  await expect(eligibilityResult).toHaveValue("eligible");
  await expect(page.getByText("ACCESS · eCKM · ITERA Direct Outreach · Hypertension · Original Medicare · Eligible · Tenovi monitor · English")).toBeVisible();
  const bpMonitor = page.getByRole("combobox", { name: /Blood pressure monitor/ });
  await expect(bpMonitor.locator("option")).toHaveText(["No monitor", "ITERA Tenovi monitor", "ITERA Pylo monitor", "Patient-owned monitor (not connected to ITERA)"]);
  await expect(page.getByAltText("Physician photo preview")).toHaveCount(0);
  await expect(page.getByPlaceholder("Enter physician name")).toHaveCount(0);
  await expect(page.getByRole("option", { name: /Medicare Advantage — Not available for ACCESS/ })).toHaveAttribute("disabled", "");
  await expect(page.getByText("ACCESS requires Original Medicare. Medicare Advantage is not available when ACCESS is selected.")).toBeVisible();
  await expect(page.getByText("Other", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "ASM", exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "APCM", exact: true })).toBeVisible();
  const accessSource = page.getByRole("combobox", { name: /Enrollment source/ });
  await expect(accessSource.locator("option")).toHaveText(["ITERA Direct Outreach", "Provider / Practice Referral"]);
  await expect(accessSource.getByRole("option", { name: "Practice Outreach", exact: true })).toHaveCount(0);
  for (const program of ["CCM", "RPM", "CCM + RPM", "PCM", "PCM + RPM", "ASM", "APCM"]) {
    await page.getByRole("radio", { name: program, exact: true }).check({ force: true });
    await expect(page.getByRole("combobox", { name: /ACCESS track/ })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: /ACCESS Eligibility Result/ })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: /Blood pressure monitor/ })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: /Enrollment source/ }).locator("option")).toHaveText(["ITERA Direct Outreach", "Physician Referral", "Practice Outreach"]);
  }
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Physician Referral" });
  await expect(page.getByPlaceholder("Enter physician name")).toHaveValue("Dr. Fresner");
  await expect(page.getByAltText("Physician photo preview")).toBeVisible();
});

test("ACCESS consolidates legacy referral sources without changing other programs", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("itera.prototype.config.v1", JSON.stringify({
    program: "ACCESS",
    source: "Practice Outreach",
    conditions: ["Hypertension"],
    coverage: "Original Medicare",
    language: "en",
    accessTrack: "eCKM",
    accessEligibilityResult: "eligible",
    physicianDisplayName: "Dr. Fresner"
  })));
  await page.goto("/?admin=1");
  const source = page.getByRole("combobox", { name: /Enrollment source/ });
  await expect(source).toHaveValue("Provider / Practice Referral");
  await expect(source.locator("option")).toHaveText(["ITERA Direct Outreach", "Provider / Practice Referral"]);
  await expect(page.locator(".scenario-summary")).toContainText("ACCESS · eCKM · Provider / Practice Referral");

  await page.getByRole("radio", { name: "CCM", exact: true }).check({ force: true });
  await expect(source).toHaveValue("Practice Outreach");
  await expect(source.locator("option")).toHaveText(["ITERA Direct Outreach", "Physician Referral", "Practice Outreach"]);
  await page.getByRole("radio", { name: "ACCESS", exact: true }).check({ force: true });
  await expect(source).toHaveValue("Provider / Practice Referral");
  await expect(source.locator("option")).toHaveText(["ITERA Direct Outreach", "Provider / Practice Referral"]);
});

test("prototype setup autocorrects ACCESS coverage and validates physician configuration", async ({ page }) => {
  await page.goto("/?admin=1");
  await page.getByRole("radio", { name: "APCM", exact: true }).check({ force: true });
  const coverage = page.getByRole("combobox", { name: /Coverage/ });
  await coverage.selectOption("Medicare Advantage");
  await expect(coverage).toHaveValue("Medicare Advantage");
  await page.getByRole("radio", { name: "ACCESS", exact: true }).check({ force: true });
  await expect(page.getByRole("combobox", { name: /Coverage/ })).toHaveValue("Original Medicare");
  await expect(page.locator(".scenario-summary")).toContainText("Original Medicare");

  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption("Provider / Practice Referral");
  const physicianName = page.getByPlaceholder("Enter physician name");
  await physicianName.fill("");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.getByRole("alert")).toHaveText("Enter the physician name.");
  await physicianName.fill("Dr. Rivera");
  await expect(page.locator(".scenario-summary")).toContainText("ACCESS · eCKM · Provider / Practice Referral · Dr. Rivera · Hypertension · Original Medicare · Eligible · Tenovi monitor · English");
});

test("prototype ACCESS eligibility setting drives a terminal not-eligible patient journey", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?admin=1");
  await page.getByRole("combobox", { name: /ACCESS Eligibility Result/ }).selectOption("notEligible");
  await expect(page.locator(".scenario-summary")).toContainText("Not eligible");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.locator("#screen-content")).not.toContainText(/ACCESS Eligibility Result|simulation|mock API|Not eligible scenario/i);

  await page.locator("#screen-select").selectOption("ACCESS_PRE_ELIGIBILITY_NOTICE", { force: true });
  await page.getByLabel("I understand this information and want to continue with the Medicare eligibility check").check();
  await page.getByRole("button", { name: "Check my eligibility" }).click();
  await expect(page.getByRole("heading", { name: "This ACCESS care option isn’t available to you right now" })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Based on the Medicare eligibility check, you can’t continue with ACCESS enrollment at this time.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What can I do?" })).toBeVisible();
  await expect(page.getByText("We can answer questions and review other care support that may be available.")).toBeVisible();
  await expect(page.getByText("Request a callback", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Talk with our care team" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Return to start" })).toBeVisible();
  await expect(page.locator('.contextual-assurance[data-assurance-type="NOT_ELIGIBLE_REASSURANCE"]')).toContainText("This does not change your Medicare benefits");
  await expect(page.locator("#screen-select option")).toHaveText(["INVITATION", "DECISION_MAKER", "IDENTITY_VERIFICATION", "CARE_RECOMMENDATION", "ACCESS_PRE_ELIGIBILITY_NOTICE", "ACCESS_ELIGIBILITY_PROCESSING", "ACCESS_ELIGIBILITY_RESULT"]);
  await expect(page.locator("#screen-content")).not.toContainText(/Continue enrollment|Enroll now|Rejected|Denied|Medicare denied/i);
  await page.locator(".access-not-eligible-screen .actions").scrollIntoViewIfNeeded();
  const assistantOverlap = await page.evaluate(() => {
    const assistant = document.querySelector(".emmi-assistant").getBoundingClientRect();
    return [...document.querySelectorAll(".access-not-eligible-screen .button,.contextual-assurance")].some(element => {
      const rect = element.getBoundingClientRect();
      return !(assistant.right <= rect.left || assistant.left >= rect.right || assistant.bottom <= rect.top || assistant.top >= rect.bottom);
    });
  });
  expect(assistantOverlap).toBe(false);

  await page.getByRole("button", { name: "Talk with our care team" }).click();
  await expect(page.getByText("Why can’t I continue?")).toBeVisible();
  await expect(page.getByText("Will this affect my Medicare?")).toBeVisible();
  await expect(page.getByText("Can I still see my doctors?")).toBeVisible();
  await page.getByRole("button", { name: /Browse common questions/ }).click();
  await expect(page.getByText("Are there other care options?")).toBeVisible();
  await expect(page.locator(".assistant-back")).toHaveCount(0);
  await expect(page.locator(".assistant-close")).toBeVisible();
});

test("prototype setup previews and applies a custom physician photo", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/?admin=1");
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Provider / Practice Referral" });
  const preview = page.getByAltText("Physician photo preview");
  await expect(preview).toHaveAttribute("src", "/assets/doctor-portrait-v2.png");
  await expect(page.getByText("PNG, JPG or WEBP · MAXIMUM 5 MB", { exact: true })).toBeVisible();
  await expect(page.getByText("Choose photo", { exact: true })).toBeVisible();
  const desktopPhotoLayout = await page.locator(".physician-photo-actions").evaluate(row => {
    const helper = row.querySelector("small").getBoundingClientRect();
    const button = row.querySelector(".physician-photo-upload").getBoundingClientRect();
    return {
      sameLine: Math.abs((helper.top + helper.bottom) / 2 - (button.top + button.bottom) / 2) < 1,
      overlap: !(helper.right <= button.left || button.right <= helper.left),
      overflow: row.scrollWidth > row.clientWidth
    };
  });
  expect(desktopPhotoLayout.sameLine).toBe(true);
  expect(desktopPhotoLayout.overlap).toBe(false);
  expect(desktopPhotoLayout.overflow).toBe(false);

  await page.setViewportSize({ width: 375, height: 812 });
  const mobilePhotoLayout = await page.locator(".physician-photo-actions").evaluate(row => {
    const helper = row.querySelector("small").getBoundingClientRect();
    const button = row.querySelector(".physician-photo-upload").getBoundingClientRect();
    return {
      overlap: !(helper.right <= button.left || button.right <= helper.left || helper.bottom <= button.top || button.bottom <= helper.top),
      withinRow: helper.left >= row.getBoundingClientRect().left && button.right <= row.getBoundingClientRect().right,
      pageOverflow: document.documentElement.scrollWidth > innerWidth
    };
  });
  expect(mobilePhotoLayout.overlap).toBe(false);
  expect(mobilePhotoLayout.withinRow).toBe(true);
  expect(mobilePhotoLayout.pageOverflow).toBe(false);
  const customPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n0AAAAAASUVORK5CYII=", "base64");
  await page.locator('input[name="physicianPhoto"]').setInputFiles({ name: "alternate-physician.png", mimeType: "image/png", buffer: customPng });
  await expect(preview).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect(page.getByText("Custom physician photo", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Enter physician name").fill("Dr. Rivera");
  await expect(page.locator(".scenario-summary")).toContainText("Provider / Practice Referral · Dr. Rivera");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  const heroPhoto = page.locator(".trust-hero-physician-photo.custom");
  const badgeLayer = page.locator(".trust-hero-badge-layer");
  await expect(heroPhoto).toBeVisible();
  await expect(heroPhoto.locator("img")).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect(heroPhoto.locator("img")).toHaveJSProperty("complete", true);
  await expect(badgeLayer).toBeVisible();
  await expect(badgeLayer).toHaveAttribute("src", "/images/enrollment/card-doctor-recommends-hero.png");
  const layerOrder = await page.locator(".trust-hero-card").evaluate(card => ({
    photo: Number(getComputedStyle(card.querySelector(".trust-hero-physician-photo")).zIndex),
    badge: Number(getComputedStyle(card.querySelector(".trust-hero-badge-layer")).zIndex)
  }));
  expect(layerOrder.badge).toBeGreaterThan(layerOrder.photo);
  const crop = await heroPhoto.evaluate(mask => {
    const image = mask.querySelector("img");
    const maskRect = mask.getBoundingClientRect();
    const cardRect = mask.closest(".trust-hero-card").getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const maskStyle = getComputedStyle(mask);
    return { objectFit: getComputedStyle(image).objectFit, scale: imageRect.width / maskRect.width, maskWidthRatio: maskRect.width / cardRect.width, borderWidth: maskStyle.borderTopWidth, boxShadow: maskStyle.boxShadow };
  });
  expect(crop.objectFit).toBe("cover");
  expect(crop.scale).toBeGreaterThanOrEqual(1.7);
  expect(crop.maskWidthRatio).toBeGreaterThanOrEqual(0.31);
  expect(crop.borderWidth).toBe("4px");
  expect(crop.boxShadow).toBe("none");
});

test("condition selector supports the four controlled multi-select conditions", async ({ page }) => {
  await page.goto("/?admin=1");
  await page.locator('summary[aria-label="Condition"]').click();
  await page.getByRole("group", { name: /Clinical conditions/ }).getByText("Diabetes", { exact: true }).click();
  await expect(page.locator(".condition-multiselect")).toHaveAttribute("open", "");
  await page.getByRole("group", { name: /Clinical conditions/ }).getByText("Heart Failure", { exact: true }).click();
  await expect(page.locator(".scenario-summary")).toContainText("Hypertension + Diabetes + Heart Failure");
  await expect(page.getByText("Other", { exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder("Enter condition")).toHaveCount(0);
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.getByRole("heading", { name: "A smarter way to manage your health" })).toBeVisible();
  await page.locator("#screen-select").selectOption("CARE_RECOMMENDATION", { force: true });
  await expect(page.getByText("Track your blood pressure from home", { exact: true })).toBeVisible();
  await expect(page.getByText("Use a connected blood pressure monitor to track your readings and help your care team understand how you’re doing.")).toBeVisible();
});

test("condition selector requires at least one selection", async ({ page }) => {
  await page.goto("/?admin=1");
  await page.locator('summary[aria-label="Condition"]').click();
  await page.getByRole("group", { name: /Clinical conditions/ }).getByText("Hypertension", { exact: true }).click();
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.getByRole("alert")).toHaveText("Select at least one condition.");
});

test("direct outreach launches without an individual physician claim", async ({ page }) => {
  await page.goto("/?admin=1");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.getByRole("heading", { name: "A smarter way to manage your health" })).toBeVisible();
  await expect(page.locator(".invitation-stage")).toHaveAttribute("data-trust-source", "ITERA Direct Outreach");
  await expect(page.locator(".trust-hero-card")).toHaveAttribute("data-hero-variant", "ACCESS_PARTICIPANT");
  await expect(page.getByAltText("ITERA HEALTH connected Medicare ACCESS care")).toBeVisible();
  await expect(page.locator(".doctor-portrait")).toHaveCount(0);
  await expect(page.getByText("ITERA HEALTH is a Medicare ACCESS Participant providing extra support between your doctor visits.")).toBeVisible();
  await expect(page.locator(".invitation-copy")).not.toContainText("at no additional cost to you");
  await page.locator("#screen-select").selectOption("CARE_RECOMMENDATION", { force: true });
  await expect(page.getByText("ITERA helps keep your care coordinated with the doctors you already see.")).toBeVisible();
  await expect(page.getByText("Get ongoing support, answers to your questions, and help staying on track between visits.")).toBeVisible();
  await expect(page.locator("#screen-select option[value='HOW_CARE_WORKS']")).toHaveCount(0);
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await expect(page.getByText("Review the key details below. You decide whether you want to enroll in ACCESS.", { exact: true })).toBeVisible();
  await expect(page.locator(".access-consent-care-team .provider-card")).toHaveCount(0);
  await expect(page.locator("#screen-content")).not.toContainText("Dr. Fresner");

  await page.goto("/?admin=1");
  await page.getByRole("radio", { name: "CCM", exact: true }).check({ force: true });
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.getByText("ITERA HEALTH invites you to learn about additional support available through Medicare.")).toBeVisible();
  await expect(page.locator(".invitation-copy")).not.toContainText("Medicare ACCESS Participant providing extra support");
});

test("trust hero cards omit the ITERA logo and keep language near the top edge", async ({ page }) => {
  await page.goto("/?admin=1");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  const hero = page.locator(".trust-hero-card");
  await expect(hero).toBeVisible();
  await expect(hero.locator(".stage-language")).toBeVisible();
  await expect(hero.locator(".stage-brand")).toHaveCount(0);
  await expect(hero.getByRole("link", { name: /ITERA HEALTH home/ })).toHaveCount(0);
  const offset = await page.evaluate(() => {
    const card = document.querySelector(".trust-hero-card").getBoundingClientRect();
    const language = document.querySelector(".stage-language").getBoundingClientRect();
    const style = getComputedStyle(document.querySelector(".stage-language"));
    return { top: language.top - card.top, height: language.height, background: style.backgroundColor, color: style.color, iconCount: document.querySelectorAll(".stage-language .icon").length };
  });
  expect(offset.top).toBeLessThanOrEqual(10);
  expect(offset.height).toBe(44);
  expect(offset.background).toBe("rgba(0, 0, 0, 0)");
  expect(offset.color).toBe("rgb(0, 0, 0)");
  expect(offset.iconCount).toBe(1);
});

test("progress header uses contextual stages without exposing step counts", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await page.getByRole("button", { name: "Start your care journey" }).click();
  const checks = [
    ["DECISION_MAKER", "Who’s completing"],
    ["CARE_RECOMMENDATION", "Your care"],
    ["ACCESS_ELIGIBILITY_RESULT", "Eligibility"],
    ["CONSENT_REVIEW", "Consent"],
    ["ACCESS_BASELINE", "Getting started"]
  ];
  for (const [screen, stage] of checks) {
    await page.locator("#screen-select").selectOption(screen, { force: true });
    const meta = page.locator(".progress-meta");
    await expect(meta.locator("span")).toHaveCount(1);
    await expect(meta.locator("span")).toHaveText(stage);
    await expect(meta).not.toContainText(/step|\d+\s*(?:of|\/)\s*\d+/i);
    const progress = page.getByRole("progressbar", { name: "Journey progress" });
    await expect(progress).toHaveAttribute("aria-valuemax", "100");
    await expect(progress).toHaveAttribute("aria-valuetext", stage);
  }
});

test("ACCESS enrollment confirmation closes enrollment and transitions into care activation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ENROLLMENT_CONFIRMED", { force: true });

  await expect(page.locator(".progress-meta span")).toHaveCount(1);
  await expect(page.locator(".progress-meta span")).toHaveText("Enrollment complete");
  await expect(page.getByRole("progressbar", { name: "Journey progress" })).toHaveAttribute("aria-valuenow", "100");
  await expect(page.getByRole("heading", { name: "Welcome to your ACCESS care" })).toBeVisible();
  await expect(page.getByText("ITERA works with Dr. Fresner and your care team to help keep your care connected.", { exact: true })).toBeVisible();
  await expect(page.getByText("Enrollment confirmed", { exact: true })).toBeVisible();
  // Care activation, in the order the patient will do it — not a promise that somebody will call.
  await expect(page.getByText("Your blood pressure monitor", { exact: true })).toBeVisible();
  await expect(page.getByText("Your health goals", { exact: true })).toBeVisible();
  await expect(page.getByText("Your personalized care plan", { exact: true })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText("We’ll confirm your personalized care plan");

  const details = page.locator(".enrollment-consent-details");
  await expect(details.getByText("View enrollment and consent details", { exact: false })).toBeVisible();
  await details.locator("summary").click();
  await expect(details).toContainText("Enrollment confirmation: Confirmed");
  await expect(details).toContainText("Consent details: Version 2.1");
  await expect(details).toContainText("Consent timestamp:");
  await expect(details).toContainText("Signing role: Patient");
  await expect(details).toContainText("Applicable disclosures: Version 2.1");

  await page.getByRole("button", { name: "Set up my care" }).click();
  await expect(page.getByRole("heading", { name: "Your first health check" })).toBeVisible();
  await expect(page.locator(".progress-meta span")).toHaveText("Getting started");
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ enrollmentStatus: "COMPLETED", activationStatus: "IN_PROGRESS", baselineStatus: "IN_PROGRESS", screen: "ACCESS_BASELINE", flowProgress: { GETTING_STARTED: { status: "IN_PROGRESS", resumeRoute: "ACCESS_BASELINE" } } });
});

test("Set up my care repairs a stale saved route instead of reopening the same confirmation", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ENROLLMENT_CONFIRMED", { force: true });
  // Create the same persisted transition record a returning patient has before corrupting it
  // into the legacy shape that used to loop back to confirmation.
  await page.getByRole("button", { name: "I’ll do this later" }).click();
  await page.evaluate(() => {
    const key = "itera.enrollment.safe-draft.v2";
    const saved = JSON.parse(localStorage.getItem(key));
    saved.screen = "ENROLLMENT_CONFIRMED";
    saved.baselineResumeScreen = "ENROLLMENT_CONFIRMED";
    saved.flowProgress = {
      ...(saved.flowProgress || {}),
      GETTING_STARTED: { flowType: "GETTING_STARTED", status: "DEFERRED", startedAt: "", completedAt: "", deferredAt: new Date().toISOString(), resumeRoute: "ENROLLMENT_CONFIRMED" }
    };
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload();

  await page.getByRole("button", { name: "Set up my care" }).click();
  await expect(page.getByRole("heading", { name: "Your first health check" })).toBeVisible();
  const repaired = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(repaired).toMatchObject({
    screen: "ACCESS_BASELINE",
    baselineResumeScreen: "ACCESS_BASELINE",
    flowProgress: { GETTING_STARTED: { status: "IN_PROGRESS", resumeRoute: "ACCESS_BASELINE" } }
  });
});

test("CCM can defer Getting Started without reopening enrollment and resume from My Care", async ({ page }) => {
  await page.goto("/?scenario=ccm-happy");
  await page.locator("#screen-select").selectOption("ENROLLMENT_CONFIRMED", { force: true });
  await expect(page.getByRole("heading", { name: "Ready to set up your care?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Set up my care" })).toBeVisible();
  await page.getByRole("button", { name: "I’ll do this later" }).click();
  await expect(page.getByRole("heading", { name: "No problem — you can continue later." })).toBeVisible();
  let lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ enrollmentStatus: "COMPLETED", activationStatus: "NOT_STARTED", flowProgress: { GETTING_STARTED: { status: "DEFERRED", resumeRoute: "ONBOARDING" } } });
  await page.reload();
  await expect(page.getByRole("heading", { name: "No problem — you can continue later." })).toBeVisible();
  await page.getByRole("button", { name: "Go to My Care" }).click();
  await expect(page.getByRole("heading", { name: "My Care" })).toBeVisible();
  await expect(page.locator(".progress-meta span").first()).toHaveText("Your care");
  await page.getByRole("button", { name: "Continue setting up your care" }).click();
  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();
  lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ enrollmentStatus: "COMPLETED", activationStatus: "IN_PROGRESS", flowProgress: { GETTING_STARTED: { status: "IN_PROGRESS", resumeRoute: "ONBOARDING" } } });
  expect(lifecycle.audit.some(event => event.eventType === "next_flow_deferred")).toBe(true);
  expect(lifecycle.audit.some(event => event.eventType === "next_flow_resumed")).toBe(true);
});

test("ACCESS enrollment confirmation does not invent physician involvement for direct outreach", async ({ page }) => {
  await page.goto("/?admin=1");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await page.locator("#screen-select").selectOption("ENROLLMENT_CONFIRMED", { force: true });
  await expect(page.getByText("ITERA HEALTH helps keep your care coordinated with the doctors you already see.", { exact: true })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText("Dr. Fresner");
});

test("ACCESS enrollment confirmation copy is localized in Spanish and Kreyòl", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ENROLLMENT_CONFIRMED", { force: true });
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.locator(".progress-meta span").first()).toHaveText("Inscripción completa");
  await expect(page.getByRole("heading", { name: "Bienvenido a su cuidado ACCESS" })).toBeVisible();
  await expect(page.getByText("Su plan de cuidado personalizado", { exact: true })).toBeVisible();
  await expect(page.getByText("Ver detalles de inscripción y consentimiento", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Cambiar idioma a criollo" }).click();
  await expect(page.locator(".progress-meta span").first()).toHaveText("Enskripsyon fini");
  await expect(page.getByRole("heading", { name: "Byenveni nan swen ACCESS ou" })).toBeVisible();
  await expect(page.getByText("Plan swen pèsonalize ou", { exact: true })).toBeVisible();
  await expect(page.getByText("Gade detay enskripsyon ak konsantman", { exact: false })).toBeVisible();
});

test("shared enrollment welcome adapts to every program and enrollment source", async ({ page }) => {
  // Seven programs, each a full navigation: this is a long test, not a slow product.
  test.setTimeout(120000);
  const programs = [
    ["ACCESS", "ACCESS", "Set up my care", "ACCESS_BASELINE"],
    ["CCM", "CCM", "Set up my care", "ONBOARDING"],
    ["RPM", "RPM", "Set up my monitor", "RPM_DEVICE_PATH"],
    ["CCM + RPM", "CCM_RPM", "Continue getting started", "RPM_DEVICE_PATH"],
    ["PCM", "PCM", "Continue getting started", "ONBOARDING"],
    ["PCM + RPM", "PCM_RPM", "Continue getting started", "RPM_DEVICE_PATH"],
    ["ASM", "ASM", "Continue getting started", "ONBOARDING"],
    ["APCM", "APCM", "Continue getting started", "ONBOARDING"]
  ];
  for (const [radioLabel, program, ctaLabel, nextRoute] of programs) {
    for (const referral of [false, true]) {
      await page.goto("/?admin=1");
      await page.getByRole("radio", { name: radioLabel, exact: true }).check({ force: true });
      const source = page.getByRole("combobox", { name: /Enrollment source/ });
      await source.selectOption({ label: referral ? (program === "ACCESS" ? "Provider / Practice Referral" : "Physician Referral") : "ITERA Direct Outreach" });
      await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
      await page.locator("#screen-select").selectOption("ENROLLMENT_CONFIRMED", { force: true });

      const welcome = page.locator(`.enrollment-welcome-screen[data-program="${program}"]`);
      await expect(welcome).toHaveAttribute("data-next-route", nextRoute);
      await expect(welcome.getByText("Enrollment confirmed", { exact: true })).toBeVisible();
      await expect(welcome.locator(".enrollment-welcome-highlight")).toHaveCount(2);
      await expect(welcome.locator(".next-card .info-row")).toHaveCount(3);
      await expect(welcome.getByRole("button", { name: ctaLabel })).toBeVisible();
      await expect(page.locator(".progress-meta span").first()).toHaveText("Enrollment complete");
      await expect(page.getByRole("progressbar", { name: "Journey progress" })).toHaveAttribute("aria-valuenow", "100");
      if (referral) await expect(welcome.getByText(/works with Dr\. Fresner to help keep your care coordinated\./)).toBeVisible();
      else {
        await expect(welcome).not.toContainText("Dr. Fresner");
        if (["ACCESS", "CCM"].includes(program)) await expect(welcome.getByText("ITERA HEALTH helps keep your care coordinated with the doctors you already see.", { exact: true })).toBeVisible();
      }
      await welcome.locator(".enrollment-consent-details summary").click();
      await expect(welcome.locator(".enrollment-consent-details")).toContainText("Program:");

      // Enrollment is done; the next care step must come before any optional support, and the
      // growth ask has no place on this screen.
      await expect(welcome).not.toContainText("Share ACCESS");
      await expect(welcome).not.toContainText("Not now");
      await expect(welcome.locator("[data-share-access-moment]")).toHaveCount(0);
      const careCircle = welcome.locator("[data-care-circle-support]");
      await expect(careCircle).toHaveCount(1);
      await expect(careCircle).toContainText("Optional support");
      await expect(careCircle).toContainText("Want someone you trust to help with your care?");
      await expect(careCircle).toContainText("Add someone to my Care Circle");
      const ctaBottom = await welcome.getByRole("button", { name: ctaLabel }).evaluate(node => node.getBoundingClientRect().bottom);
      const careCircleTop = await careCircle.evaluate(node => node.getBoundingClientRect().top);
      expect(careCircleTop).toBeGreaterThan(ctaBottom);
      // Programs without a device must not be told a Care Circle member helps with one.
      if (["CCM", "PCM", "ASM", "APCM"].includes(program)) await expect(careCircle).not.toContainText(/monitor|device/i);
    }
  }
});

test("CCM enrollment welcome uses one primary message and two compact support highlights", async ({ page }) => {
  await page.goto("/?scenario=ccm-happy");
  await page.locator("#screen-select").selectOption("ENROLLMENT_CONFIRMED", { force: true });
  const welcome = page.locator('.enrollment-welcome-screen[data-program="CCM"]');
  await expect(welcome.getByRole("heading", { name: "Welcome to your Chronic Care Management experience" })).toBeVisible();
  await expect(welcome.locator(":scope > .lead")).toHaveText("You now have ongoing support to help manage your health between doctor visits.");
  const highlights = welcome.locator(".enrollment-welcome-highlight");
  await expect(highlights).toHaveCount(2);
  await expect(highlights.nth(0)).toContainText("Step-by-step support");
  await expect(highlights.nth(0)).toContainText("We’ll guide you as you get started.");
  // The physician highlight is shared by every program on this screen, so CCM names the referring
  // doctor in the same words ACCESS does.
  await expect(highlights.nth(1)).toContainText("Connected with Dr. Fresner");
  await expect(highlights.nth(1)).toContainText("ITERA works with Dr. Fresner and your care team");
  await expect(welcome.locator(".enrollment-welcome-reassurance, .enrollment-welcome-context")).toHaveCount(0);
  await expect(welcome.getByText("Enrollment confirmed", { exact: true })).toBeVisible();
});

test("enrollment welcome highlights align without clipping on supported mobile widths", async ({ page }) => {
  for (const width of [360, 375, 390, 393, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/?scenario=ccm-happy");
    await page.locator("#screen-select").selectOption("ENROLLMENT_CONFIRMED", { force: true });
    const layout = await page.locator(".enrollment-welcome-screen").evaluate(root => {
      const highlights = root.querySelector(".enrollment-welcome-highlights").getBoundingClientRect();
      const next = root.querySelector(".next-card").getBoundingClientRect();
      const transition = root.querySelector(".flow-completion-transition").getBoundingClientRect();
      const transitionButtons = [...root.querySelectorAll(".flow-transition-actions .button")];
      const clipped = [...root.querySelectorAll(".enrollment-welcome-highlight strong, .enrollment-welcome-highlight p")].some(element => element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight);
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        fullWidth: Math.abs(highlights.width - next.width) < 1,
        aligned: Math.abs(highlights.left - next.left) < 1,
        clipped,
        transitionFits: transition.left >= 0 && transition.right <= innerWidth,
        transitionButtonsFit: transitionButtons.every(button => button.scrollWidth <= button.clientWidth && button.getBoundingClientRect().height >= 48)
      };
    });
    expect(layout).toEqual({ overflow: false, fullWidth: true, aligned: true, clipped: false, transitionFits: true, transitionButtonsFit: true });
  }
});

test("EMMI no longer exposes the prototype session log", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ENROLLMENT_CONFIRMED", { force: true });
  await openEmmiConversation(page);
  await expect(page.locator(".assistant-layer")).toBeVisible();
  await expect(page.getByText("Prototype session log", { exact: true })).toHaveCount(0);
});

test("ACCESS first health check is post-enrollment, deferrable, resumable, and independently measurable", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ACCESS_BASELINE", { force: true });

  await expect(page.locator(".progress-meta span")).toHaveText("Getting started");
  await expect(page.getByRole("heading", { name: "Your first health check" })).toBeVisible();
  await expect(page.getByText("This helps your ACCESS care team understand your starting point and personalize your care.", { exact: true })).toBeVisible();
  await expect(page.getByText("Questions about your health", { exact: true })).toBeVisible();
  await expect(page.getByText("Usually takes about 10 minutes", { exact: true })).toBeVisible();
  await expect(page.getByText("Your progress is saved if you finish later.", { exact: true })).toBeVisible();
  await expect(page.getByText("Your health information is secure", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "I’ll do this later" }).click();
  await expect(page.locator(".save-status")).toHaveText("Your health check is saved for later.");
  let lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ screen: "ACCESS_BASELINE", enrollmentStatus: "COMPLETED", baselineStatus: "NOT_STARTED", baselineResumeScreen: "ACCESS_BASELINE", baselineReminderStatus: "PENDING" });
  expect(lifecycle.audit.some(event => event.eventType === "baseline_deferred")).toBe(true);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Your first health check" })).toBeVisible();
  await page.getByRole("button", { name: "Start health check" }).click();
  await expect(page.getByRole("heading", { name: /starting point/i })).toBeVisible();
  lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ enrollmentStatus: "COMPLETED", baselineStatus: "IN_PROGRESS", baselineResumeScreen: "ACCESS_MEASURE", baselineReminderStatus: "NOT_SCHEDULED" });
  expect(lifecycle.audit.some(event => event.eventType === "baseline_started")).toBe(true);

  await page.locator('.choice-card:has(input[value="owned"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Your monitor is connected to ITERA" })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("We found the monitor assigned to your care.", { exact: true })).toBeVisible();
  await expect(page.getByText("Device ending in 8842", { exact: true })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText(/photo|QR|barcode|brand and model/i);
  await page.locator('.choice-card:has(input[value="yes"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Prepare your monitor" })).toBeVisible();
  await page.getByRole("button", { name: "I’m ready" }).click();
  await expect(page.getByRole("heading", { name: "Let’s test your monitor" })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText(/Reading 1 of 3|Reading 2 of 3|Reading 3 of 3/);
  await page.getByRole("button", { name: "I took my reading" }).click();
  await expect(page.getByRole("heading", { name: "Your monitor is connected", exact: true })).toBeVisible();
  await expect(page.getByText("1 of 3 readings received for your starting blood pressure", { exact: true })).toBeVisible();
  await expect(page.getByText("You can take the remaining readings later.", { exact: true })).toBeVisible();
  lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ enrollmentStatus: "COMPLETED", baselineStatus: "IN_PROGRESS", bpBaselineStatus: "IN_PROGRESS", bpBaselineRequiredReadings: 3, bpBaselineReadingCount: 1, bpBaselineRemainingReadings: 2, bpBaselineSourceType: "VERIFIED_DEVICE", deviceSource: "ITERA_ASSIGNED", deviceVerificationStatus: "SOURCE_VERIFIED", integrationProvider: "TENOVI", assignedDeviceId: "tenovi-bp-8842", patientDeviceConfirmed: true, confirmedDeviceId: "tenovi-bp-8842", firstTransmissionVerified: true, firstTransmissionDeviceId: "tenovi-bp-8842", deviceVendor: "TENOVI", deviceStatus: "active", integrationStatus: "CONNECTED", bpReadingCount: 1, baselineResumeScreen: "ACCESS_BP_MEASUREMENT" });
  expect(lifecycle.lastTransmissionAt).toBeTruthy();
  expect(lifecycle.bpReadingReceipts).toHaveLength(1);
  expect(JSON.stringify(lifecycle)).not.toContain('"systolic"');
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();
  await expect(page.getByText("1 of 3 readings received", { exact: true })).toBeVisible();
});

test("ACCESS blood pressure starting point uses a verified-device workflow and no manual BP entry", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ACCESS_MEASURE", { force: true });
  await expect(page.locator(".progress-meta span")).toHaveText("Getting started");
  await expect(page.locator(".eyebrow")).toHaveText("Blood pressure health check");
  await expect(page.getByRole("heading", { name: "Your blood pressure starting point" })).toBeVisible();
  await expect(page.getByText("This helps your care team understand your blood pressure today and personalize your care.", { exact: true })).toBeVisible();
  await expect(page.getByText("I already have a blood pressure monitor", { exact: true })).toBeVisible();
  await expect(page.getByText("I have a monitor but need help", { exact: true })).toBeVisible();
  await expect(page.getByText("I need a blood pressure monitor", { exact: true })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText(/eCKM|recent reading|systolic|diastolic|monitor from ITERA/i);
  await expect(page.locator('input[name="systolic"], input[name="diastolic"], input[type="date"]')).toHaveCount(0);
});

test("ACCESS blood pressure baseline copy is complete in Spanish and Kreyòl", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ACCESS_MEASURE", { force: true });
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.locator(".progress-meta span")).toHaveText("Primeros pasos");
  await expect(page.locator(".eyebrow")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Su presión arterial inicial" })).toBeVisible();
  await expect(page.getByText("Esto ayuda a su equipo de atención a conocer su presión arterial actual y personalizar su cuidado.", { exact: true })).toBeVisible();
  await expect(page.getByText("Ya tengo un monitor de presión arterial", { exact: true })).toBeVisible();
  await expect(page.getByText("Verificaremos si su monitor puede utilizarse para sus mediciones de ACCESS.", { exact: true })).toBeVisible();
  await expect(page.getByText("Tengo un monitor, pero necesito ayuda", { exact: true })).toBeVisible();
  await expect(page.getByText("Le ayudaremos a configurarlo y a tomar sus mediciones correctamente.", { exact: true })).toBeVisible();
  await expect(page.getByText("ITERA puede ayudarle a obtener uno.", { exact: true })).toBeVisible();
  await expect(page.getByText("Su información de salud está protegida", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cambiar idioma a criollo" }).click();
  await expect(page.locator(".progress-meta span")).toHaveText("Kòmanse");
  await expect(page.locator(".eyebrow")).toHaveText("Tchekòp tansyon");
  await expect(page.getByRole("heading", { name: "Pwen depa tansyon ou" })).toBeVisible();
  await expect(page.getByText("Mwen bezwen yon aparèy pou mezire tansyon", { exact: true })).toBeVisible();
  await expect(page.getByText("ITERA ka ede fè aranjman pou ou jwenn youn.", { exact: true })).toBeVisible();
});

test("ACCESS device-needed branch keeps enrollment complete and BP pending without blocking baseline continuation", async ({ page }) => {
  await openNeededMonitorDetails(page);
  await page.getByRole("radio", { name: "No", exact: true }).check();
  await expect(page.getByRole("group", { name: "Which cuff size do you think fits best?" })).toBeVisible();
  await expect(page.getByAltText("Blood pressure cuff placed on the upper arm")).toBeVisible();
  await expect(page.getByLabel("Arm circumference")).toHaveCount(0);
  await page.locator('.choice-card:has(input[value="TENOVI_WIDE"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Where would you like your monitor delivered?" })).toBeVisible();
  await expect(page.locator(".address-card")).toContainText("123 Oak Avenue");
  await page.getByRole("button", { name: "Request my monitor" }).click();
  await expect(page.getByRole("heading", { name: "Your monitor is being prepared" })).toBeVisible();
  await expect(page.getByText("Request received", { exact: true })).toBeVisible();
  await expect(page.getByText("Cuff information recorded", { exact: true })).toBeVisible();
  await expect(page.getByText("Address confirmed", { exact: true })).toBeVisible();
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ enrollmentStatus: "COMPLETED", baselineStatus: "IN_PROGRESS", bpBaselineStatus: "PENDING_DEVICE", armCircumferenceValue: "", armMeasurementStatus: "NOT_REQUIRED", armRestrictionReported: "NO", restrictedArm: "NONE", measurementArm: "PENDING", cuffSelectionMethod: "PATIENT_SELECTED", selectedCuffOption: "TENOVI_WIDE", cuffSelectionStatus: "SELECTED", cuffSizeSelected: "standard", deviceModelSelected: "TENOVI_BPM_GEN3", shippingAddressConfirmed: true, deviceFulfillmentStatus: "REQUESTED", bpDeviceFulfillmentStatus: "REQUESTED", baselineReminderStatus: "PENDING_DEVICE" });
  expect(lifecycle.bpDeviceFulfillmentRequestedAt).toBeTruthy();
  expect(lifecycle.audit.map(event => event.eventType)).toEqual(expect.arrayContaining(["bp_device_information_saved", "bp_device_fulfillment_requested"]));
  await page.getByRole("button", { name: "Continue my health check" }).click();
  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();
  await expect(page.locator(".progress-meta span")).toHaveText("Getting started");
});

test("ACCESS cuff selection keeps exact arm measurement optional and auto-matches configured inventory", async ({ page }) => {
  await openNeededMonitorDetails(page);
  await page.getByRole("radio", { name: "No", exact: true }).check();
  await page.getByRole("button", { name: "I know my arm measurement" }).click();
  const circumference = page.getByLabel("Arm circumference");
  await expect(circumference).toHaveAttribute("inputmode", "decimal");
  await expect(circumference).toHaveAttribute("step", "0.1");
  expect(await circumference.evaluate(input => ({ height: input.getBoundingClientRect().height, appearance: getComputedStyle(input).appearance }))).toMatchObject({ height: 58, appearance: "textfield" });
  await circumference.fill("50");
  await page.getByRole("button", { name: "Continue" }).click();
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ armCircumferenceValue: "50", armCircumferenceUnit: "cm", armMeasurementStatus: "COMPLETED", cuffSelectionMethod: "ARM_MEASUREMENT", selectedCuffOption: "TENOVI_XL", cuffSelectionStatus: "AUTO_MATCHED", cuffSizeSelected: "extraLarge", deviceModelSelected: "TENOVI_BPM_GEN3" });
});

test("ACCESS monitor fulfillment allows cuff-selection help and creates a care team task", async ({ page }) => {
  await openNeededMonitorDetails(page);
  await page.getByRole("radio", { name: "No", exact: true }).check();
  await page.locator('.choice-card:has(input[value="UNSURE"])').click();
  await expect(page.getByText("We can help confirm the right size before sending your monitor.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Request my monitor" }).click();
  await expect(page.getByText("We’ll confirm the cuff size with you", { exact: true })).toBeVisible();
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ armMeasurementStatus: "NEEDS_ASSISTANCE", cuffSelectionMethod: "CARE_TEAM_ASSISTANCE", cuffSelectionStatus: "NEEDS_ASSISTANCE", bpBaselineStatus: "PENDING_DEVICE", enrollmentStatus: "COMPLETED" });
  expect(lifecycle.careTeamTasks.map(task => task.type)).toEqual(expect.arrayContaining(["CUFF_SELECTION_ASSISTANCE", "CUFF_CONFIGURATION_REVIEW"]));
});

test("ACCESS monitor fulfillment lets the patient defer remaining health-check tasks", async ({ page }) => {
  await openNeededMonitorDetails(page);
  await page.getByRole("radio", { name: "No", exact: true }).check();
  await page.locator('.choice-card:has(input[value="UNSURE"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Request my monitor" }).click();
  await page.getByRole("button", { name: "I’ll do this later" }).click();
  await expect(page.locator(".save-status")).toHaveText("Your remaining health check is saved for later.");
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ enrollmentStatus: "COMPLETED", baselineStatus: "IN_PROGRESS", bpBaselineStatus: "PENDING_DEVICE", baselineResumeScreen: "ONBOARDING", baselineReminderStatus: "PENDING_DEVICE" });
});

test("ACCESS monitor fulfillment records a left-arm restriction for care team review", async ({ page }) => {
  await openNeededMonitorDetails(page);
  await page.getByRole("radio", { name: "Yes", exact: true }).check();
  await page.getByRole("radio", { name: "Left arm", exact: true }).check();
  await page.getByRole("button", { name: "I know my arm measurement" }).click();
  await page.getByLabel("Arm circumference").fill("31.5");
  await page.getByRole("button", { name: "Continue" }).click();
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ armCircumferenceValue: "31.5", armRestrictionReported: "YES", restrictedArm: "LEFT", measurementArm: "RIGHT", cuffSelectionMethod: "ARM_MEASUREMENT", selectedCuffOption: "TENOVI_WIDE", cuffSelectionStatus: "AUTO_MATCHED", deviceModelSelected: "TENOVI_BPM_GEN3" });
  expect(lifecycle.careTeamTasks.some(task => task.type === "ARM_RESTRICTION_REVIEW")).toBe(true);
});

test("ACCESS monitor fulfillment sends an unsure arm restriction for review", async ({ page }) => {
  await openNeededMonitorDetails(page);
  await page.getByRole("radio", { name: "I’m not sure", exact: true }).check();
  await expect(page.getByText("We’ll help confirm the best way to take your blood pressure.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue with the rest of my health check" }).click();
  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ armRestrictionReported: "UNSURE", restrictedArm: "NONE", measurementArm: "PENDING", armMeasurementStatus: "PENDING_CLINICAL_REVIEW", enrollmentStatus: "COMPLETED", baselineStatus: "IN_PROGRESS" });
  expect(lifecycle.careTeamTasks.some(task => task.type === "ARM_CLINICAL_REVIEW")).toBe(true);
});

test("ACCESS monitor fulfillment never asks for a measurement when both arms are restricted", async ({ page }) => {
  await openNeededMonitorDetails(page);
  await page.getByRole("radio", { name: "Yes", exact: true }).check();
  await page.getByRole("radio", { name: "Both arms", exact: true }).check();
  await expect(page.getByLabel("Arm circumference")).toHaveCount(0);
  await expect(page.getByText("We’ll help confirm the best way to take your blood pressure.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Continue with the rest of my health check" }).click();
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ armRestrictionReported: "YES", restrictedArm: "BOTH", measurementArm: "PENDING", armMeasurementStatus: "PENDING_CLINICAL_REVIEW", enrollmentStatus: "COMPLETED" });
  expect(lifecycle.careTeamTasks.some(task => task.type === "ARM_CLINICAL_REVIEW")).toBe(true);
});

test("ACCESS monitor fulfillment validates and persists a different shipping address", async ({ page }) => {
  await openNeededMonitorDetails(page);
  await page.getByRole("radio", { name: "No", exact: true }).check();
  await page.locator('.choice-card:has(input[value="TENOVI_XL"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('.choice-card:has(input[value="other"])').click();
  await page.getByLabel("Street address").fill("500 Palm Street");
  await page.getByLabel("Apartment / Unit").fill("Unit 7");
  await page.getByLabel("City").fill("Miami");
  await page.getByLabel("State").fill("fl");
  await page.getByLabel("ZIP code").fill("33130");
  await page.getByRole("button", { name: "Request my monitor" }).click();
  await expect(page.getByRole("heading", { name: "Your monitor is being prepared" })).toBeVisible();
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ shippingAddressMode: "other", shippingAddressConfirmed: true, shippingAddress: { line1: "500 Palm Street", unit: "Unit 7", city: "Miami", state: "FL", zip: "33130" }, deviceFulfillmentStatus: "REQUESTED" });
});

test("ACCESS monitor fulfillment is localized in Spanish and Kreyòl", async ({ page }) => {
  await openNeededMonitorDetails(page);
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.getByRole("heading", { name: "Encontremos el monitor adecuado para usted" })).toBeVisible();
  await page.getByRole("radio", { name: "No", exact: true }).check();
  await expect(page.getByText("¿Qué tamaño de brazalete cree que le queda mejor?", { exact: true })).toBeVisible();
  await expect(page.getByAltText("Brazalete de presión arterial colocado en la parte superior del brazo")).toBeVisible();
  await expect(page.getByText("Su información de salud está protegida", { exact: true })).toBeVisible();
  await page.locator('.choice-card:has(input[value="UNSURE"])').click();
  await expect(page.getByText("Podemos ayudarle a confirmar el tamaño adecuado antes de enviar su monitor.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "¿Dónde desea recibir su monitor?" })).toBeVisible();
  await page.getByRole("button", { name: "Cambiar idioma a criollo" }).click();
  await expect(page.getByRole("heading", { name: "Ki kote ou vle resevwa aparèy ou a?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mande aparèy mwen an" })).toBeVisible();
});

test("arm restriction response buttons remain equal and on one row across mobile widths", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await openNeededMonitorDetails(page);
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  for (const viewport of [{ width: 320, height: 780 }, { width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    const group = page.locator(".segmented-options.keep-one-row");
    await expect(group.getByText("No sé", { exact: true })).toBeVisible();
    await expect(group.getByRole("radio", { name: "No estoy seguro", exact: true })).toBeVisible();
    const layout = await group.evaluate(element => {
      const buttons = [...element.querySelectorAll("span")];
      const rects = buttons.map(button => button.getBoundingClientRect());
      return {
        widths: rects.map(rect => Math.round(rect.width * 10) / 10),
        heights: rects.map(rect => Math.round(rect.height * 10) / 10),
        tops: rects.map(rect => Math.round(rect.top * 10) / 10),
        wrapped: buttons.some(button => button.scrollHeight > button.clientHeight + 1),
        overflow: document.documentElement.scrollWidth > innerWidth
      };
    });
    expect(new Set(layout.widths).size, `unequal widths at ${viewport.width}px`).toBe(1);
    expect(new Set(layout.heights).size, `unequal heights at ${viewport.width}px`).toBe(1);
    expect(new Set(layout.tops).size, `buttons wrap to another row at ${viewport.width}px`).toBe(1);
    expect(layout.heights[0]).toBe(52);
    expect(layout.wrapped).toBe(false);
    expect(layout.overflow).toBe(false);
  }
});

test("ACCESS incompatible monitor requests a compatible device without reopening enrollment", async ({ page }) => {
  await openOwnedBpVerification(page, "access-bp-incompatible");
  await expect(page.getByRole("heading", { name: "Let’s get you a connected monitor" })).toBeVisible();
  await expect(page.getByText("Your current monitor may still be useful for your personal care, but your ACCESS readings need to come from a monitor that can securely send readings to ITERA HEALTH.", { exact: true })).toBeVisible();
  await expect(page.getByText("We can help arrange a connected monitor for you.", { exact: true })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText(/photo|serial number|QR|barcode|brand|model|invalid monitor|unsupported device|incompatible monitor/i);
  await page.getByRole("button", { name: "Get a connected monitor" }).click();
  await expect(page.getByRole("heading", { name: "Let’s find the right monitor for you" })).toBeVisible();
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ enrollmentStatus: "COMPLETED", baselineStatus: "IN_PROGRESS", bpBaselineStatus: "DEVICE_VERIFICATION", deviceSource: "PATIENT_OWNED", deviceVerificationStatus: "PENDING_DEVICE", deviceFulfillmentStatus: "NOT_REQUESTED", bpDeviceFulfillmentStatus: "NOT_STARTED" });
});

test("prototype explicitly launches a patient-owned non-ITERA monitor journey", async ({ page }) => {
  await page.goto("/?admin=1");
  await page.getByRole("combobox", { name: /Blood pressure monitor/ }).selectOption("patient-owned-unsupported");
  await expect(page.locator(".scenario-summary")).toContainText("Eligible · Patient-owned monitor · English");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await page.locator("#screen-select").selectOption("ACCESS_MEASURE", { force: true });
  await page.locator('.choice-card:has(input[value="owned"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Let’s get you a connected monitor" })).toBeVisible({ timeout: 5000 });
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ patientHasBloodPressureMonitor: true, deviceSource: "PATIENT_OWNED", assignedDeviceId: "", deviceVendor: "OTHER", deviceStatus: "ACTIVE", integrationProvider: "OTHER", integrationStatus: "UNSUPPORTED", deviceVerificationStatus: "UNSUPPORTED" });
  await page.getByRole("button", { name: "Get a connected monitor" }).click();
  await expect(page.getByRole("heading", { name: "Let’s find the right monitor for you" })).toBeVisible();
});

test("ACCESS resolves a Pylo assignment without exposing vendor-specific identification choices", async ({ page }) => {
  await openOwnedBpVerification(page, "access-bp-pylo");
  await expect(page.getByRole("heading", { name: "Your monitor is connected to ITERA" })).toBeVisible();
  await expect(page.getByText("Pylo Connected Blood Pressure Monitor", { exact: true })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText(/photo|QR|barcode|serial|choose the brand/i);
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ assignedDeviceId: "pylo-bp-6719", last4DeviceId: "6719", deviceVendor: "PYLO", integrationProvider: "PYLO", deviceVerificationStatus: "ASSIGNED", integrationStatus: "CONNECTED", patientDeviceConfirmed: null });
});

test("ACCESS shows a calm automatic lookup before confirming the assigned monitor", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ACCESS_MEASURE", { force: true });
  await page.locator('.choice-card:has(input[value="owned"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Let’s check your monitor" })).toBeVisible();
  await expect(page.getByText("We’ll check whether you already have a monitor connected to ITERA HEALTH.", { exact: true })).toBeVisible();
  await expect(page.getByText("Checking your connected monitor", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your monitor is connected to ITERA" })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Device ending in 8842", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Is this the monitor you have with you?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
});

test("ACCESS requires physical confirmation and persists the assigned-device evidence", async ({ page }) => {
  await openOwnedBpVerification(page);
  await page.locator('.choice-card:has(input[value="yes"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Prepare your monitor" })).toBeVisible();
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ assignedDeviceId: "tenovi-bp-8842", last4DeviceId: "8842", patientDeviceConfirmed: true, confirmedDeviceId: "tenovi-bp-8842", deviceVerificationStatus: "PATIENT_CONFIRMED" });
  expect(lifecycle.patientDeviceConfirmedAt).toBeTruthy();
});

test("ACCESS routes a different physical monitor to fulfillment without requesting its full ID", async ({ page }) => {
  await openOwnedBpVerification(page);
  await page.locator('.choice-card:has(input[value="no"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Let’s check the monitor you have" })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText(/enter.*device id|serial number/i);
  await page.getByRole("button", { name: "I’m using my own monitor" }).click();
  await expect(page.getByRole("heading", { name: "Let’s find the right monitor for you" })).toBeVisible();
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ patientDeviceConfirmed: false, confirmedDeviceId: "", deviceSource: "PATIENT_OWNED", deviceVerificationStatus: "PENDING_DEVICE" });
});

test("ACCESS offers last-four guidance when the patient is unsure", async ({ page }) => {
  await openOwnedBpVerification(page);
  await page.locator('.choice-card:has(input[value="unsure"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Check the label on your monitor" })).toBeVisible();
  await expect(page.getByText("Look for a device number ending in 8842.", { exact: true })).toBeVisible();
  await page.locator('.choice-card:has(input[value="matches"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Prepare your monitor" })).toBeVisible();
});

test("assigned-monitor confirmation remains senior-friendly and localized on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await openOwnedBpVerification(page);
  const cards = page.locator(".device-confirmation-options .choice-card");
  await expect(cards).toHaveCount(3);
  const layout = await cards.evaluateAll(elements => ({
    minimumHeight: Math.min(...elements.map(element => element.getBoundingClientRect().height)),
    withinViewport: elements.every(element => element.getBoundingClientRect().left >= 0 && element.getBoundingClientRect().right <= innerWidth),
    overflow: document.documentElement.scrollWidth > innerWidth
  }));
  expect(layout.minimumHeight).toBeGreaterThanOrEqual(68);
  expect(layout.withinViewport).toBe(true);
  expect(layout.overflow).toBe(false);
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.getByRole("heading", { name: "¿Este es el monitor que tiene con usted?" })).toBeVisible();
  await expect(page.getByText("No estoy seguro", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cambiar idioma a criollo" }).click();
  await expect(page.getByRole("heading", { name: "Èske se aparèy sa a ou genyen avèk ou?" })).toBeVisible();
  await expect(page.getByText("Mwen pa sèten", { exact: true })).toBeVisible();
});

test("ACCESS verifies the first transmission came from the confirmed monitor", async ({ page }) => {
  await reachBpReadings(page);
  await page.getByRole("button", { name: "I took my reading" }).click();
  await expect(page.getByRole("heading", { name: "Your monitor is connected", exact: true })).toBeVisible();
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ firstTransmissionVerified: true, firstTransmissionDeviceId: "tenovi-bp-8842", deviceVerificationStatus: "SOURCE_VERIFIED", bpBaselineStatus: "IN_PROGRESS", bpBaselineRequiredReadings: 3, bpBaselineReadingCount: 1, bpBaselineRemainingReadings: 2, bpReadingCount: 1 });
  expect(lifecycle.firstTransmissionAt).toBeTruthy();
});

test("EMMI uses the authoritative baseline counters when asked about another reading", async ({ page }) => {
  await reachBpReadings(page);
  await page.getByRole("button", { name: "I took my reading" }).click();
  await expect(page.getByRole("heading", { name: "Your monitor is connected", exact: true })).toBeVisible();
  await openEmmiConversation(page);
  const dialog = page.getByRole("dialog", { name: "EMMI – Your ITERA Care Assistant" });
  const input = dialog.getByPlaceholder("Ask a question…");
  await input.fill("Do I need to take my blood pressure again now?");
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(dialog.getByText("No. Your monitor is connected and we received your first reading. You can take your next readings later, and ITERA will receive them automatically.", { exact: true })).toBeVisible();
});

test("ACCESS completes the remaining baseline readings automatically without keeping the patient on the measurement screen", async ({ page }) => {
  await reachBpReadings(page, "access-bp-background-complete");
  await page.getByRole("button", { name: "I took my reading" }).click();
  await expect(page.getByText("1 of 3 readings received for your starting blood pressure", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2"))?.bpBaselineStatus)).toBe("COMPLETED");
  await expect(page.getByText("Starting blood pressure complete", { exact: true })).toBeVisible();
  await expect(page.getByText("3 of 3 readings received", { exact: true })).toBeVisible();
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ bpBaselineStatus: "COMPLETED", bpBaselineReadingCount: 3, bpBaselineRemainingReadings: 0, deviceVerificationStatus: "SOURCE_VERIFIED" });
  expect(new Set(lifecycle.bpReadingReceipts.map(receipt => receipt.observationId)).size).toBe(3);
});

test("ACCESS stops a first transmission from a different source and opens review", async ({ page }) => {
  await reachBpReadings(page, "access-bp-source-mismatch");
  await page.getByRole("button", { name: "I took my reading" }).click();
  await expect(page.getByRole("heading", { name: "We need to verify your monitor" })).toBeVisible();
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ firstTransmissionVerified: false, firstTransmissionDeviceId: "tenovi-bp-9999", deviceVerificationStatus: "SOURCE_MISMATCH", bpReadingCount: 0 });
  expect(lifecycle.careTeamTasks).toEqual(expect.arrayContaining([expect.objectContaining({ type: "BP_DEVICE_SOURCE_REVIEW", status: "OPEN" })]));
});

test("ACCESS treats an assigned-device lookup failure as a review state, not a patient error", async ({ page }) => {
  await openOwnedBpVerification(page, "access-bp-assignment-failure");
  await expect(page.getByRole("heading", { name: "We need to check your monitor" })).toBeVisible();
  await expect(page.getByText("We found a monitor assigned to your care, but we couldn’t confirm its connection right now.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Talk with my care team" })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText(/take a photo|scan a QR|choose the brand/i);
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ deviceSource: "ITERA_ASSIGNED", assignedDeviceId: "tenovi-bp-8842", deviceVerificationStatus: "NEEDS_REVIEW", integrationStatus: "UNKNOWN" });
});

test("ACCESS routes a missing assignment directly to connected monitor fulfillment", async ({ page }) => {
  await openOwnedBpVerification(page, "access-bp-none");
  await page.locator('.choice-card:has(input[value="need-itera"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Let’s find the right monitor for you" })).toBeVisible();
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ bpDevicePath: "needed", deviceVerificationStatus: "PENDING_DEVICE", baselineResumeScreen: "ACCESS_BP_DEVICE_INFO" });
});

test("ACCESS unsure monitor asks one question and offers care-team help", async ({ page }) => {
  await openOwnedBpVerification(page, "access-bp-none");
  await page.locator('.choice-card:has(input[value="situation-unsure"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Was your monitor provided by ITERA HEALTH?" })).toBeVisible();
  await page.locator('.choice-card:has(input[value="assignment-unsure"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".assistant-layer")).toBeVisible();
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ enrollmentStatus: "COMPLETED", baselineStatus: "IN_PROGRESS", bpBaselineStatus: "DEVICE_VERIFICATION", deviceSource: "UNKNOWN", deviceVerificationStatus: "NEEDS_REVIEW", baselineReminderStatus: "CARE_TEAM_ASSISTANCE" });
});

test("ACCESS no-assignment and review states are localized in Spanish and Kreyòl", async ({ page }) => {
  await openOwnedBpVerification(page, "access-bp-none");
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.getByRole("heading", { name: "Aún no vemos un monitor conectado a su cuidado." })).toBeVisible();
  await expect(page.getByText("Estoy usando mi propio monitor", { exact: true })).toBeVisible();
  await expect(page.getByText("Necesito un monitor de ITERA", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cambiar idioma a criollo" }).click();
  await expect(page.getByRole("heading", { name: "Nou poko wè yon aparèy ki konekte ak swen ou." })).toBeVisible();
  await expect(page.getByText("M ap itilize pwòp aparèy mwen", { exact: true })).toBeVisible();

  await page.evaluate(() => localStorage.removeItem("itera.enrollment.language.v1"));
  await page.goto("/?scenario=access-bp-assignment-failure");
  await page.locator("#screen-select").selectOption("ACCESS_MEASURE", { force: true });
  await page.locator('.choice-card:has(input[value="owned"])').click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "We need to check your monitor" })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.getByRole("heading", { name: "Necesitamos verificar su monitor" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Intentar de nuevo" })).toBeVisible();
  await page.getByRole("button", { name: "Cambiar idioma a criollo" }).click();
  await expect(page.getByRole("heading", { name: "Nou bezwen verifye aparèy ou a" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pale ak ekip swen mwen an" })).toBeVisible();
});

test("ACCESS BP monitor test can retry without creating a duplicate baseline reading", async ({ page }) => {
  await reachBpReadings(page, "access-bp-reading-failure");
  await page.getByRole("button", { name: "I took my reading" }).click();
  await expect(page.getByText("We didn’t receive your reading", { exact: true })).toBeVisible();
  let lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ bpReadingCount: 0, bpBaselineReadingCount: 0, bpBaselineStatus: "NOT_STARTED", deviceVerificationStatus: "FAILED", screen: "ACCESS_BP_MEASUREMENT" });
  await page.getByRole("button", { name: "Try receiving this reading again" }).click();
  await expect(page.getByRole("heading", { name: "Your monitor is connected" })).toBeVisible();
  lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ bpReadingCount: 1, bpBaselineReadingCount: 1, bpBaselineRemainingReadings: 2, deviceVerificationStatus: "SOURCE_VERIFIED" });
});

test("ACCESS BP baseline progress resumes without requesting an immediate second reading", async ({ page }) => {
  await reachBpReadings(page);
  await page.getByRole("button", { name: "I took my reading" }).click();
  await expect(page.getByRole("heading", { name: "Your monitor is connected" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("1 of 3 readings received for your starting blood pressure", { exact: true })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText(/Continue to reading|Reading 2 of 3/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ bpBaselineStatus: "IN_PROGRESS", bpBaselineReadingCount: 1, bpBaselineRemainingReadings: 2, baselineReminderStatus: "BP_READINGS_PENDING" });
  expect(lifecycle.bpReadingReceipts).toHaveLength(1);
  expect(JSON.stringify(lifecycle)).not.toContain('"systolic"');
});

test("ACCESS can complete and clinically evaluate remaining baseline readings in the background", async ({ page }) => {
  await reachBpReadings(page, "access-bp-escalation");
  await page.getByRole("button", { name: "I took my reading" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2"))?.bpBaselineReadingCount)).toBe(3);
  const lifecycle = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(lifecycle).toMatchObject({ enrollmentStatus: "COMPLETED", baselineStatus: "IN_PROGRESS", bpBaselineReadingCount: 3, bpBaselineRemainingReadings: 0, bpBaselineStatus: "PROCESSING", bpEscalationState: { status: "ACTIVE", careTeamNotified: true } });
  expect(lifecycle.audit.some(event => event.eventType === "bp_clinical_escalation")).toBe(true);
});

test("ACCESS connected BP workflow is localized across Spanish and Kreyòl", async ({ page }) => {
  await openOwnedBpVerification(page);
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.locator(".eyebrow")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Su monitor está conectado a ITERA" })).toBeVisible();
  await expect(page.getByText("Encontramos el monitor asignado a su cuidado.", { exact: true })).toBeVisible();
  await page.locator('.choice-card:has(input[value="yes"])').click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Prepare su monitor" })).toBeVisible();
  await expect(page.getByText("No cruce las piernas.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Estoy listo" }).click();
  await expect(page.getByRole("heading", { name: "Probemos su monitor" })).toBeVisible();
  await expect(page.getByText("Tome una medición de presión arterial para confirmar que su monitor está conectado y enviando las lecturas correctamente.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cambiar idioma a criollo" }).click();
  await expect(page.getByRole("heading", { name: "Ann teste aparèy ou a" })).toBeVisible();
  await expect(page.getByText("Aparèy ou a ap voye mezi a otomatikman.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mwen pran mezi mwen an" })).toBeVisible();
});

test("ACCESS first health check copy is localized in Spanish and Kreyòl", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ACCESS_BASELINE", { force: true });
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.getByRole("heading", { name: "Su primera evaluación de salud" })).toBeVisible();
  await expect(page.getByText("Preguntas sobre su salud", { exact: true })).toBeVisible();
  await expect(page.getByText("Generalmente toma unos 10 minutos", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cambiar idioma a criollo" }).click();
  await expect(page.getByRole("heading", { name: "Premye tchekòp sante ou" })).toBeVisible();
  await expect(page.getByText("Kesyon sou sante ou", { exact: true })).toBeVisible();
  await expect(page.getByText("Anjeneral li pran anviwon 10 minit", { exact: true })).toBeVisible();
});

test("ACCESS final review consolidates disclosure and consent without losing essential terms", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });

  await expect(page.locator(".progress-meta span")).toHaveCount(1);
  await expect(page.locator(".progress-meta span")).toHaveText("Consent");
  await expect(page.getByRole("heading", { name: "Review and choose" })).toBeVisible();
  await expect(page.locator("#screen-select option[value='HOW_CARE_WORKS']")).toHaveCount(0);
  await expect(page.locator("#screen-select option[value='DISCLOSURE']")).toHaveCount(0);
  await expect(page.locator(".consent-disclosure-row")).toHaveCount(5);
  await expect(page.locator(".access-consent-summary").getByText("Participation is voluntary", { exact: true })).toBeVisible();
  await expect(page.getByText("You choose whether to enroll in ACCESS.", { exact: true })).toBeVisible();
  await expect(page.getByText("Your Medicare benefits stay the same", { exact: true })).toBeVisible();
  await expect(page.getByText("Your Medicare benefits, coverage, and rights do not change.", { exact: true })).toBeVisible();
  await expect(page.locator(".access-consent-care-team")).toHaveCount(0);
  await expect(page.locator(".access-care-chip")).toHaveCount(0);
  await expect(page.getByText("Expected beneficiary payment amount: $0 per month. Your Medicare and verified supplemental coverage are expected to cover this ACCESS cost. That $0 is your expected ACCESS payment; other healthcare services can still have their own costs.", { exact: true })).toBeVisible();
  await expect(page.locator(".access-cost-amount")).toHaveCount(0);
  await expect(page.locator(".access-consent-summary").getByText("One ACCESS care provider at a time", { exact: true })).toBeVisible();
  await expect(page.locator(".access-consent-summary").getByText("You can receive this type of ACCESS care from one participating provider at a time.", { exact: true })).toBeVisible();
  await expect(page.locator(".access-consent-summary").getByText("Starting 90 days after enrollment, you may leave ACCESS or switch to another participating provider.", { exact: true })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText("You may stop participating at any time");
  await expect(page.getByText("Medicare claims information", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Connected device information", { exact: true })).toHaveCount(0);

  const continueButton = page.getByRole("button", { name: "Confirm and continue" });
  await expect(continueButton).toBeDisabled();
  await page.getByLabel("I have reviewed the information above and agree to enroll in ACCESS with ITERA HEALTH.").check();
  await expect(continueButton).toBeEnabled();
  await expect(page.locator('.contextual-assurance[data-assurance-type="ENROLLMENT_CHOICE"]')).toContainText("You choose whether to enroll");

  await page.getByText("View full ACCESS information", { exact: false }).click();
  const fullDisclosure = page.locator(".access-consent-terms");
  await expect(fullDisclosure.locator(".access-full-section")).toHaveCount(8);
  await expect(fullDisclosure.getByRole("heading", { name: "About your ACCESS care" })).toBeVisible();
  await expect(fullDisclosure.getByText("ITERA HEALTH is your ACCESS care provider for this type of care.", { exact: true })).toBeVisible();
  await expect(fullDisclosure.getByText("You choose whether to enroll in ACCESS. Your decision to enroll or not enroll does not change your Medicare benefits, coverage, or rights.", { exact: true })).toBeVisible();
  await expect(fullDisclosure.getByRole("heading", { name: "Your expected cost" })).toBeVisible();
  await expect(page.getByText(/Your supplemental coverage was verified for this estimate/)).toBeVisible();
  await expect(fullDisclosure.getByText("ITERA may share information with CMS as needed to operate and evaluate ACCESS, subject to applicable privacy and security requirements.", { exact: true })).toBeVisible();
  await expect(fullDisclosure.getByText("ACCESS adds support to your existing care. ITERA works with Dr. Fresner, and you can continue seeing your regular doctors.", { exact: true })).toBeVisible();
  await expect(fullDisclosure.getByRole("heading", { name: "Questions before you enroll" })).toBeVisible();
  await expect(fullDisclosure.locator('a[href="tel:+13053948070"]')).toHaveText(/\(305\) 394-8070/);
  await expect(fullDisclosure).not.toContainText("Additional information includes beneficiary cost-sharing");
  await expect(page.getByText("Disclosure version: 2.1", { exact: true })).toBeVisible();
  await expect(page.getByLabel("I have reviewed the information above and agree to enroll in ACCESS with ITERA HEALTH.")).toBeChecked();
  const disclosureView = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(disclosureView.accessDisclosureView).toMatchObject({ disclosureVersion: "2.1", locale: "en", sessionId: disclosureView.sessionId, enrollmentId: null });
  expect(disclosureView.accessDisclosureView.viewedAt).toBeTruthy();
  expect(disclosureView.audit.map(event => event.eventType)).toContain("access_full_disclosure_viewed");
  await openEmmiConversation(page);
  for (const question of ["Do I have to enroll?", "Will this change my Medicare?", "Why is my expected payment $0?", "Can I change my mind later?"]) {
    await expect(page.getByRole("button", { name: question })).toBeVisible();
  }

  const typography = await page.locator(".access-consent-screen").evaluate(screen => ({
    headline: Math.min(...[...screen.querySelectorAll(".consent-disclosure-row strong")].map(element => parseFloat(getComputedStyle(element).fontSize))),
    copy: Math.min(...[...screen.querySelectorAll(".consent-disclosure-row p")].map(element => parseFloat(getComputedStyle(element).fontSize))),
    costHeadline: parseFloat(getComputedStyle(screen.querySelector(".access-cost-row strong")).fontSize),
    standardHeadline: parseFloat(getComputedStyle(screen.querySelector(".consent-disclosure-row:not(.access-cost-row) strong")).fontSize),
    costCopy: parseFloat(getComputedStyle(screen.querySelector(".access-cost-row p")).fontSize),
    standardCopy: parseFloat(getComputedStyle(screen.querySelector(".consent-disclosure-row:not(.access-cost-row) p")).fontSize),
    checkbox: parseFloat(getComputedStyle(screen.querySelector(".check-row")).fontSize),
    buttonHeight: screen.querySelector('.actions [data-action="next"]').getBoundingClientRect().height,
    overflow: document.documentElement.scrollWidth > innerWidth
  }));
  expect(typography.headline).toBeGreaterThanOrEqual(17);
  expect(typography.copy).toBeGreaterThanOrEqual(16);
  expect(typography.costHeadline).toBe(typography.standardHeadline);
  expect(typography.costCopy).toBe(typography.standardCopy);
  expect(typography.checkbox).toBeGreaterThanOrEqual(16);
  expect(typography.buttonHeight).toBeGreaterThanOrEqual(48);
  expect(typography.overflow).toBe(false);
});

test("ACCESS final review renders configured cost, claims, and device information", async ({ page }) => {
  await page.goto("/?scenario=access-disclosure-configured");
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await expect(page.getByText("Expected beneficiary payment amount: $0 per month. Your Medicare and verified supplemental coverage are expected to cover this ACCESS cost. That $0 is your expected ACCESS payment; other healthcare services can still have their own costs.", { exact: true })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText("$35");
  await expect(page.locator(".access-consent-summary").getByText("Medicare claims information", { exact: true })).toBeVisible();
  await expect(page.locator(".access-consent-summary").getByText("Medicare may share claims information with ITERA HEALTH to help coordinate your ACCESS care.", { exact: true })).toBeVisible();
  await expect(page.locator(".access-consent-summary").getByText("Connected device information", { exact: true })).toBeVisible();
  await expect(page.locator(".access-consent-summary").getByText("A connected device may be used to support your ACCESS care. Your care team will explain what is required.", { exact: true })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText("$0 ACCESS cost-sharing");
  await page.getByText("View full ACCESS information", { exact: false }).click();
  const fullDisclosure = page.locator(".access-consent-terms");
  await expect(fullDisclosure.locator(".access-full-section")).toHaveCount(10);
  await expect(fullDisclosure.getByRole("heading", { name: "Medicare claims information" })).toBeVisible();
  await expect(fullDisclosure.getByRole("heading", { name: "Connected device information" })).toBeVisible();
});

test("ACCESS full information does not invent physician involvement for direct outreach", async ({ page }) => {
  await page.goto("/?admin=1");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await page.getByText("View full ACCESS information", { exact: false }).click();
  const doctorsSection = page.locator(".access-full-section").filter({ has: page.getByRole("heading", { name: "Your doctors and care" }) });
  await expect(doctorsSection).toContainText("ACCESS adds support to your existing care. You can continue seeing your regular doctors.");
  await expect(doctorsSection).not.toContainText("Dr. Fresner");
});

test("ACCESS patient agreement is role-aware, readable, and continues through CMS Alignment", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });

  await expect(page.locator(".progress-meta span").last()).toHaveText("Consent");
  await expect(page.getByRole("heading", { name: "Review and choose" })).toBeVisible();
  await expect(page.getByText("Review the key details below. You decide whether you want to enroll in ACCESS.", { exact: true })).toBeVisible();
  await expect(page.locator(".access-consent-care-team")).toHaveCount(0);
  await expect(page.locator(".access-care-chip")).toHaveCount(0);
  // The summary must not re-list the care team or name a provider — the structural checks above
  // cover the removed cards, and this covers the copy. It used to look for "ACCESS care provider",
  // which the one-provider-at-a-time disclosure now legitimately contains.
  await expect(page.locator(".access-consent-summary")).not.toContainText("Dr. Fresner");
  await expect(page.locator(".access-consent-summary")).not.toContainText("ACCESS care for high blood pressure");
  await expect(page.locator(".consent-disclosure-row")).toHaveCount(5);
  await expect(page.locator(".access-consent-summary").getByText("Participation is voluntary", { exact: true })).toBeVisible();
  await expect(page.getByText("Your Medicare benefits, coverage, and rights do not change.", { exact: true })).toBeVisible();
  await expect(page.getByText("Expected beneficiary payment amount: $0 per month. Your Medicare and verified supplemental coverage are expected to cover this ACCESS cost. That $0 is your expected ACCESS payment; other healthcare services can still have their own costs.", { exact: true })).toBeVisible();
  await expect(page.locator(".access-consent-summary").getByText("One ACCESS care provider at a time", { exact: true })).toBeVisible();
  await expect(page.locator(".access-consent-summary").getByText("Starting 90 days after enrollment, you may leave ACCESS or switch to another participating provider.", { exact: true })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText("Your regular Medicare benefits and cost-sharing continue to apply");
  await expect(page.locator("#screen-content")).not.toContainText("You may stop participating at any time");
  await expect(page.locator(".signer-role")).toHaveText("Signing as: Patient");
  await expect(page.getByLabel(/authorized to make healthcare decisions/)).toHaveCount(0);

  const cta = page.getByRole("button", { name: "Confirm and continue" });
  await expect(cta).toBeDisabled();
  await page.getByLabel("I have reviewed the information above and agree to enroll in ACCESS with ITERA HEALTH.").check();
  await expect(cta).toBeEnabled();
  await expect(page.locator('.contextual-assurance[data-assurance-type="ENROLLMENT_CHOICE"]')).toContainText("You choose whether to enroll");

  const typography = await page.locator(".access-consent-screen").evaluate(screen => ({
    headlines: Math.min(...[...screen.querySelectorAll(".consent-disclosure-row strong")].map(element => parseFloat(getComputedStyle(element).fontSize))),
    supporting: Math.min(...[...screen.querySelectorAll(".consent-disclosure-row p")].map(element => parseFloat(getComputedStyle(element).fontSize))),
    checks: Math.min(...[...screen.querySelectorAll(".check-row")].map(element => parseFloat(getComputedStyle(element).fontSize))),
    signer: parseFloat(getComputedStyle(screen.querySelector(".signer-role")).fontSize),
    buttonHeight: screen.querySelector('.actions [data-action="next"]').getBoundingClientRect().height,
    overflow: document.documentElement.scrollWidth > innerWidth
  }));
  expect(typography.headlines).toBeGreaterThanOrEqual(17);
  expect(typography.supporting).toBeGreaterThanOrEqual(16);
  expect(typography.checks).toBeGreaterThanOrEqual(16);
  expect(typography.signer).toBeGreaterThanOrEqual(17);
  expect(typography.buttonHeight).toBeGreaterThanOrEqual(50);
  expect(typography.overflow).toBe(false);

  await cta.click();
  await expect(page.getByRole("heading", { name: "Completing your enrollment with Medicare" })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText("You’re enrolled");
  const consentEvidence = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(consentEvidence.disclosureAcknowledgedAt).toBeTruthy();
  expect(consentEvidence.disclosureVersion).toBe("2.1");
  expect(consentEvidence.consentTimestamp).toBeTruthy();
  expect(consentEvidence.audit.map(event => event.eventType)).toEqual(expect.arrayContaining(["disclosure_acknowledged", "consent_saved"]));
});

test("ACCESS patient completes the simplified journey without redundant education or disclosure screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=access-happy");
  await page.getByRole("button", { name: "Start your care journey" }).click();
  await page.getByRole("radio", { name: /For myself/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "What your care includes" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Let’s confirm your eligibility with Medicare" })).toBeVisible();
  await page.getByLabel("I understand this information and want to continue with the Medicare eligibility check").check();
  await page.getByRole("button", { name: "Check my eligibility" }).click();
  await expect(page.getByRole("heading", { name: "Great news — you can continue with ACCESS" })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Review and choose" })).toBeVisible();
  await page.getByLabel("I have reviewed the information above and agree to enroll in ACCESS with ITERA HEALTH.").check();
  await page.getByRole("button", { name: "Confirm and continue" }).click();
  await expect(page.getByText("Enrollment confirmed", { exact: true })).toBeVisible({ timeout: 5000 });
  await expect(page.locator("#screen-select option[value='HOW_CARE_WORKS']")).toHaveCount(0);
  await expect(page.locator("#screen-select option[value='DISCLOSURE']")).toHaveCount(0);
});

test("ACCESS personal representative must complete the authority attestation", async ({ page }) => {
  await page.goto("/?scenario=access-representative");
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await expect(page.getByText("I have reviewed the information above and agree, on behalf of the patient, to enroll the patient in ACCESS with ITERA HEALTH.", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".signer-role")).toHaveText("Signing as: Personal representative");
  const authority = page.getByLabel("I confirm that I’m authorized to make healthcare decisions for the patient.");
  const agreement = page.getByLabel("I have reviewed the information above and agree, on behalf of the patient, to enroll the patient in ACCESS with ITERA HEALTH.");
  const cta = page.getByRole("button", { name: "Confirm and continue" });
  await agreement.check();
  // A representative still attests their authority separately: that is a different statement
  // about a different person, not a second confirmation of the same one.
  await expect(cta).toBeDisabled();
  await authority.check();
  await expect(cta).toBeEnabled();
});

test("ACCESS agreement keeps track-based cost guidance with configured claims information", async ({ page }) => {
  await page.goto("/?scenario=access-disclosure-configured");
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await expect(page.getByText("Expected beneficiary payment amount: $0 per month. Your Medicare and verified supplemental coverage are expected to cover this ACCESS cost. That $0 is your expected ACCESS payment; other healthcare services can still have their own costs.", { exact: true })).toBeVisible();
  await expect(page.locator(".access-consent-summary").getByText("Medicare claims information", { exact: true })).toBeVisible();
  await expect(page.locator(".access-consent-summary").getByText("Medicare may share claims information with ITERA HEALTH to help coordinate your ACCESS care.", { exact: true })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText("$35");
});

test("ACCESS expected monthly cost follows the configured care track", async ({ page }) => {
  for (const [track, expected] of [["eCKM", "$6 per month"], ["CKM", "$7 per month"], ["BH", "$3 per month"], ["MSK", "$3 per month"]]) {
    await page.goto("/?admin=1");
    // Coverage is pinned so the care track is the only thing moving the amount.
    await page.evaluate(() => localStorage.setItem("itera.prototype.config.v1", JSON.stringify({ program: "ACCESS", source: "ITERA Direct Outreach", conditions: ["Hypertension"], coverage: "Original Medicare", language: "en", accessEligibilityResult: "eligible", secondaryCoverageStatus: "SECONDARY_NOT_VERIFIED" })));
    await page.reload();
    await page.getByRole("combobox", { name: /ACCESS track/ }).selectOption(track);
    await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
    await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
    await expect(page.locator(".access-cost-row p")).toContainText(`Expected beneficiary payment amount: ${expected}.`);
  }
});

test("ACCESS cost supports supplemental coverage verification states", async ({ page }) => {
  await page.goto("/?admin=1");
  await page.evaluate(() => localStorage.setItem("itera.prototype.config.v1", JSON.stringify({ program: "ACCESS", source: "ITERA Direct Outreach", conditions: ["Hypertension"], coverage: "Original Medicare", language: "en", accessTrack: "eCKM", accessEligibilityResult: "eligible", secondaryCoverageStatus: "SECONDARY_PRESENT_NOT_CONFIRMED" })));
  await page.goto("/?prototype=1");
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await expect(page.locator(".access-cost-row p")).toHaveText("Expected beneficiary payment amount: up to $6 per month. Medicare covers most of the cost of this care. Your supplemental coverage may reduce this amount.");

  await page.evaluate(() => localStorage.setItem("itera.prototype.config.v1", JSON.stringify({ program: "ACCESS", source: "ITERA Direct Outreach", conditions: ["Hypertension"], coverage: "Original Medicare", language: "en", accessTrack: "eCKM", accessEligibilityResult: "eligible", secondaryCoverageStatus: "SECONDARY_COVERAGE_VERIFIED" })));
  await page.reload();
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await expect(page.locator(".access-cost-row p")).toHaveText("Expected beneficiary payment amount: $0 per month. Your Medicare and verified supplemental coverage are expected to cover this ACCESS cost. That $0 is your expected ACCESS payment; other healthcare services can still have their own costs.");
});

test("ACCESS expected cost copy is localized in Spanish and Kreyòl", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.locator(".access-cost-row p")).toContainText("Monto de pago esperado del beneficiario: hasta $6 al mes.");
  await expect(page.getByText(/Su cobertura suplementaria puede reducir este monto/)).toBeVisible();
  await page.getByText("Ver información completa de ACCESS", { exact: false }).click();
  await expect(page.locator(".access-consent-terms").getByRole("heading", { name: "Medicare y su información de salud" })).toBeVisible();
  await expect(page.locator(".access-consent-terms").getByRole("heading", { name: "Preguntas antes de inscribirse" })).toBeVisible();
  await page.getByRole("button", { name: "Cambiar idioma a criollo" }).click();
  await expect(page.locator(".access-cost-row p")).toContainText("Se gen yon bon tan depi nou te verifye kouvèti ou");
  await expect(page.getByText(/Ekip swen ou ka reverifye l anvan ou deside/)).toBeVisible();
  await page.getByText("Gade tout enfòmasyon ACCESS yo", { exact: false }).click();
  await expect(page.locator(".access-consent-terms").getByRole("heading", { name: "Medicare ak enfòmasyon sante ou" })).toBeVisible();
  await expect(page.locator(".access-consent-terms").getByRole("heading", { name: "Kesyon anvan ou enskri" })).toBeVisible();
});

test("role selection branches only personal representatives into representative details", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=access-happy");
  await page.getByRole("button", { name: "Start your care journey" }).click();

  await expect(page.getByRole("heading", { name: "Who is completing this?" })).toBeVisible();
  await expect(page.locator(".progress-meta span").last()).toHaveText("Who’s completing");
  await expect(page.getByText("Choose what best describes you. You can get help at any time.")).toBeVisible();
  await expect(page.getByText("I am the patient.")).toBeVisible();
  await expect(page.getByText("The patient is present and will make the decisions.")).toBeVisible();
  await expect(page.getByText("I’m authorized to make healthcare decisions for the patient.")).toBeVisible();
  await expect(page.locator(".choice-card")).toHaveCount(3);
  await expect(page.locator('.contextual-assurance[data-assurance-type="ROLE_GUIDANCE"]')).toContainText("We’ll guide you through the right steps");

  const representativeCard = page.locator("#choice-form").getByText("Personal representative", { exact: true }).locator("..").locator("..");
  await representativeCard.click();
  await expect(page.locator('#choice-form input[value="personalRepresentative"]')).toBeChecked();
  await expect(page.locator('#choice-form input:checked')).toHaveCount(1);
  const cardAudit = await page.locator(".choice-card").evaluateAll(cards => ({
    heights: cards.map(card => card.getBoundingClientRect().height),
    titleFonts: cards.map(card => parseFloat(getComputedStyle(card.querySelector("strong")).fontSize)),
    descriptionFonts: cards.map(card => parseFloat(getComputedStyle(card.querySelector("small")).fontSize)),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth
  }));
  expect(Math.min(...cardAudit.heights)).toBeGreaterThanOrEqual(78);
  expect(Math.min(...cardAudit.titleFonts)).toBeGreaterThanOrEqual(16);
  expect(Math.min(...cardAudit.descriptionFonts)).toBeGreaterThanOrEqual(15);
  expect(cardAudit.horizontalOverflow).toBe(false);

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "About you" })).toBeVisible();
  await expect(page.locator(".progress-meta span").last()).toHaveText("Your role");
  await expect(page.getByText("You’re completing this enrollment for the patient.")).toBeVisible();
  const detailsCta = page.getByRole("button", { name: "Send verification code" });
  await expect(detailsCta).toBeDisabled();
  await page.getByLabel("Your full name").fill("Maria Fresner");
  await page.getByLabel("Your relationship to the patient").selectOption({ label: "Child" });
  await expect(detailsCta).toBeDisabled();
  await page.getByLabel("How are you authorized to make healthcare decisions?").selectOption({ label: "Health care power of attorney" });
  await page.getByLabel("Your mobile number").fill("3055550123");
  await expect(detailsCta).toBeEnabled();
  await detailsCta.click();
  await expect(page.getByRole("heading", { name: "Verify your phone" })).toBeVisible();
  await expect(page.getByText("We sent a 6-digit code to (***) ***-0123.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Resend code in/ })).toBeDisabled();
  await page.getByLabel("Verification code").fill("000000");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page.getByText("That code isn’t correct. Please try again.")).toBeVisible();
  await page.getByLabel("Verification code").fill("123456");
  await expect(page.evaluate(() => JSON.stringify(localStorage))).resolves.not.toContain("123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page.getByRole("heading", { name: "Confirm your authority" })).toBeVisible();
  await expect(page.getByText("Phone verified", { exact: true }).first()).toBeVisible();
  const authorityCta = page.getByRole("button", { name: "Continue" });
  await expect(authorityCta).toBeDisabled();
  await page.getByText("I confirm that I’m authorized to make healthcare decisions for the patient.", { exact: true }).locator("..").click();
  await expect(page.getByLabel("I confirm that I’m authorized to make healthcare decisions for the patient.")).toBeChecked();
  await expect(authorityCta).toBeEnabled();
  await authorityCta.click();
  await expect(page.getByRole("heading", { name: "Let’s securely confirm the patient’s identity" })).toBeVisible();
  const representativeDraft = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(representativeDraft).toMatchObject({ completionRole: "personalRepresentative", representativeFullName: "Maria Fresner", representativeRelationship: "child", representativeAuthorityType: "healthcarePowerOfAttorney", representativePhone: "3055550123", phoneVerified: true, phoneVerificationMethod: "SMS_OTP", representativeAuthorityAttested: true, authorityAttestation: true, authorityVerificationMethod: "SELF_ATTESTATION" });
  expect(representativeDraft.phoneVerifiedAt).toBeTruthy();
  expect(representativeDraft.authorityAttestedAt).toBeTruthy();
  expect(representativeDraft.sessionId).toBeTruthy();
  expect(JSON.stringify(representativeDraft)).not.toContain("123456");
  expect(representativeDraft.audit.map(event => event.eventType)).toEqual(expect.arrayContaining(["completion_role_selected", "representative_details_confirmed", "representative_phone_otp_sent", "representative_phone_otp_verified", "representative_authority_attested"]));
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await page.getByLabel("I confirm that I’m authorized to make healthcare decisions for the patient.").check();
  await page.getByLabel("I have reviewed the information above and agree, on behalf of the patient, to enroll the patient in ACCESS with ITERA HEALTH.").check();
  await page.getByRole("button", { name: "Confirm and continue" }).click();
  await expect(page.getByRole("heading", { name: "Completing your enrollment with Medicare" })).toBeVisible();
  const consentDraft = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(consentDraft).toMatchObject({ consentRole: "PERSONAL_REPRESENTATIVE", consentVersion: "2.1" });
  expect(consentDraft.consentTimestamp).toBeTruthy();
  // One checkbox on screen, but the evidence behind it is unchanged in substance and richer in
  // detail: what was shown, when, in which language, at what cost, against which verification.
  expect(consentDraft.consentAcknowledgement).toMatchObject({
    consentShape: "SINGLE_AFFIRMATIVE",
    signerRole: "PERSONAL_REPRESENTATIVE",
    consentVersion: "2.1",
    locale: "en"
  });
  expect(consentDraft.consentAcknowledgement.disclosureVersion).toBeTruthy();
  expect(consentDraft.consentAcknowledgement.acceptedAt).toBeTruthy();
  expect(consentDraft.consentAcknowledgement.displayedExpectedPatientPayment).toBeTruthy();
  expect(consentDraft.audit.map(event => event.eventType)).toContain("consent_saved");
  await page.locator("#screen-select").selectOption("IDENTITY_VERIFICATION", { force: true });
  await expect(page.getByText("Confirm the patient’s date of birth and ZIP code so we can match them to their care invitation.")).toBeVisible();
  await expect(page.locator(".progress-meta span").last()).toHaveText("Confirm identity");
  await page.locator(".identity-screen .actions").getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Confirm your authority" })).toBeVisible();
  await page.locator(".representative-details-screen .actions").getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Verify your phone" })).toBeVisible();
  await page.getByRole("button", { name: "Use a different number" }).click();
  await expect(page.getByLabel("Your full name")).toHaveValue("Maria Fresner");
  await expect(page.getByLabel("Your relationship to the patient")).toHaveValue("child");
  await expect(page.getByLabel("How are you authorized to make healthcare decisions?")).toHaveValue("healthcarePowerOfAttorney");
  await expect(page.getByLabel("Your mobile number")).toHaveValue("(305) 555-0123");
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await expect(page.locator(".signer-role")).toContainText("Signing as: Personal representative");
  await expect(page.getByText("I have reviewed the information above and agree, on behalf of the patient, to enroll the patient in ACCESS with ITERA HEALTH.", { exact: true }).first()).toBeVisible();

  await page.evaluate(() => localStorage.removeItem("itera.enrollment.safe-draft.v2"));
  await page.goto("/?scenario=access-happy");
  await page.getByRole("button", { name: "Start your care journey" }).click();
  await page.getByText("Helping the patient", { exact: true }).locator("..").locator("..").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Let’s securely confirm it’s you" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "About you" })).toHaveCount(0);
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await expect(page.locator(".signer-role")).toContainText("Signing as: Patient");

  await page.evaluate(() => localStorage.removeItem("itera.enrollment.safe-draft.v2"));
  await page.goto("/?scenario=access-happy");
  await page.getByRole("button", { name: "Start your care journey" }).click();
  await page.getByText("For myself", { exact: true }).locator("..").locator("..").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Let’s securely confirm it’s you" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "About you" })).toHaveCount(0);
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await expect(page.locator(".signer-role")).toContainText("Signing as: Patient");
});

test("personal representative verification is fully translated in Spanish and Kreyòl", async ({ page }) => {
  await page.goto("/?scenario=access-representative");
  await page.locator("#screen-select").selectOption("PERSONAL_REPRESENTATIVE_DETAILS", { force: true });
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.getByRole("heading", { name: "Acerca de usted" })).toBeVisible();
  await expect(page.getByLabel("Su relación con el paciente")).toBeVisible();
  await expect(page.getByLabel("¿Cómo está autorizado para tomar decisiones médicas?")).toBeVisible();
  await expect(page.getByLabel("Su número móvil")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar código de verificación" })).toBeVisible();
  await page.locator("#screen-select").selectOption("REPRESENTATIVE_MOBILE_VERIFICATION", { force: true });
  await expect(page.getByRole("heading", { name: "Verifique su teléfono" })).toBeVisible();
  await expect(page.getByLabel("Código de verificación")).toHaveAttribute("autocomplete", "one-time-code");
  await page.getByRole("button", { name: "Cambiar idioma a criollo" }).click();
  await expect(page.getByRole("heading", { name: "Verifye telefòn ou" })).toBeVisible();
  await expect(page.getByLabel("Kòd verifikasyon")).toBeVisible();
  await expect(page.getByRole("button", { name: "Verifye epi kontinye" })).toBeVisible();
  await page.locator("#screen-select").selectOption("REPRESENTATIVE_AUTHORITY_ATTESTATION", { force: true });
  await expect(page.getByRole("heading", { name: "Konfime otorite ou" })).toBeVisible();
  await expect(page.getByText("Telefòn verifye", { exact: true }).first()).toBeVisible();
  await expect(page.locator("#app")).not.toContainText("⟦");
});

test("personal representative screens remain senior-friendly and clear of Emmi", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=access-representative");
  for (const screenName of ["PERSONAL_REPRESENTATIVE_DETAILS", "REPRESENTATIVE_MOBILE_VERIFICATION", "REPRESENTATIVE_AUTHORITY_ATTESTATION"]) {
    await page.locator("#screen-select").selectOption(screenName, { force: true });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const layout = await page.locator(".representative-details-screen").evaluate(screen => {
      const pill = document.querySelector(".emmi-assistant");
      const assistant = pill.getClientRects().length ? pill.getBoundingClientRect() : new DOMRect(-1, -1, 0, 0);
      const protectedElements = [...screen.querySelectorAll(".field,.verified-phone-status,.check-row,.actions,.representative-otp-links")];
      const overlaps = protectedElements.filter(element => {
        const rect = element.getBoundingClientRect();
        return !(assistant.right <= rect.left || assistant.left >= rect.right || assistant.bottom <= rect.top || assistant.top >= rect.bottom);
      }).map(element => element.className);
      const controls = [...screen.querySelectorAll("input:not([type=checkbox]),select,.button")];
      return {
        overlaps,
        overflow: document.documentElement.scrollWidth > innerWidth,
        minControlHeight: Math.min(...controls.map(control => control.getBoundingClientRect().height)),
        helperFonts: [...screen.querySelectorAll(".field-helper")].map(item => parseFloat(getComputedStyle(item).fontSize))
      };
    });
    expect(layout.overlaps, screenName).toEqual([]);
    expect(layout.overflow).toBe(false);
    expect(layout.minControlHeight).toBeGreaterThanOrEqual(44);
    if (layout.helperFonts.length) expect(Math.min(...layout.helperFonts)).toBeGreaterThanOrEqual(15);
  }
});

test("ACCESS care inclusions are patient-friendly, contextual, and assistant-accessible", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("CARE_RECOMMENDATION", { force: true });
  await expect(page.getByRole("heading", { name: "What your care includes" })).toBeVisible();
  await expect(page.getByText("Your ACCESS care gives you new tools and ongoing support to help you manage your high blood pressure between doctor visits.")).toBeVisible();
  await expect(page.getByText("Get ongoing support, answers to your questions, and help staying on track between visits.")).toBeVisible();
  await expect(page.getByText("Track your blood pressure from home")).toBeVisible();
  await expect(page.getByText("Use a connected blood pressure monitor to track your readings and help your care team understand how you’re doing.")).toBeVisible();
  await expect(page.getByText("A care plan built around you")).toBeVisible();
  await expect(page.getByText("Your goals, health information, and next steps come together in one personalized care plan.")).toBeVisible();
  await expect(page.getByText("Stay connected with Dr. Fresner")).toBeVisible();
  await expect(page.getByText("ITERA works with Dr. Fresner and your care team to help keep your care connected and coordinated.")).toBeVisible();
  await expect(page.getByText("Your care doesn’t stop when you leave the doctor’s office. Your care team stays connected with you along the way.")).toBeVisible();
  await expect(page.locator(".recommendation-screen")).not.toContainText("recommended care");
  await expect(page.locator(".recommendation-screen")).not.toContainText(/\b(?:CCM|RPM|PCM|CPT)\b/);
  await expect(page.locator(".progress-meta span").last()).toHaveText("Your care");
  await expect(page.locator(".emmi-guide")).toBeVisible();
  const assistant = page.locator(".emmi-assistant");
  await expect(assistant).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const layout = await page.locator(".recommendation-screen").evaluate(screen => {
    const assistantRect = document.querySelector(".emmi-assistant").getBoundingClientRect();
    const important = [...screen.querySelectorAll(".actions .button")].map(element => element.getBoundingClientRect());
    const overlaps = important.some(rect => !(assistantRect.right <= rect.left || assistantRect.left >= rect.right || assistantRect.bottom <= rect.top || assistantRect.top >= rect.bottom));
    return {
      overlaps,
      descriptionFonts: [...screen.querySelectorAll(".info-row p")].map(element => parseFloat(getComputedStyle(element).fontSize)),
      noteFont: parseFloat(getComputedStyle(screen.querySelector(".note")).fontSize)
    };
  });
  expect(layout.overlaps).toBe(false);
  expect(Math.min(...layout.descriptionFonts)).toBeGreaterThanOrEqual(16);
  expect(layout.noteFont).toBeGreaterThanOrEqual(15);
  await openEmmiConversation(page);
  await expect(page.getByRole("heading", { name: "How can I help?" })).toBeVisible();
  await expect(page.getByPlaceholder("Ask a question…")).toBeVisible();
  await expect(page.getByText("What does ACCESS care include?")).toBeVisible();
  await expect(page.getByText("What is my care plan?")).toBeVisible();
  // Human support is one collapsed row now, so reaching a person takes one deliberate tap.
  await page.getByRole("button", { name: /Need human help/ }).click();
  await expect(page.getByText("Call our care team")).toBeVisible();
  await expect(page.getByText("(305) 394-8070")).toBeVisible();
  await expect(page.getByText("Have someone call me")).toBeVisible();
});

test("recommended care avoids individual physician claims for practice outreach", async ({ page }) => {
  await page.goto("/?admin=1");
  await page.getByRole("radio", { name: "CCM", exact: true }).check({ force: true });
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Practice Outreach" });
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await page.locator("#screen-select").selectOption("CARE_RECOMMENDATION", { force: true });
  await expect(page.getByText("ITERA works with your care team to coordinate your care.")).toBeVisible();
  await expect(page.locator(".recommendation-screen")).not.toContainText("ITERA coordinates with Dr. Fresner.");
});

test("ACCESS merges care coordination into What your care includes with a dynamic physician", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?admin=1");
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Provider / Practice Referral" });
  await page.getByPlaceholder("Enter physician name").fill("Dr. Humberto Machado Jr.");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await page.locator("#screen-select").selectOption("CARE_RECOMMENDATION", { force: true });

  await expect(page.getByRole("heading", { name: "What your care includes" })).toBeVisible();
  await expect(page.getByText("Get ongoing support, answers to your questions, and help staying on track between visits.")).toBeVisible();
  await expect(page.getByText("ITERA works with Dr. Humberto Machado Jr. and your care team to help keep your care connected and coordinated.")).toBeVisible();
  await expect(page.locator(".note")).toContainText("Your care doesn’t stop when you leave the doctor’s office. Your care team stays connected with you along the way.");
  await expect(page.locator("#screen-select option[value='HOW_CARE_WORKS']")).toHaveCount(0);
  await expect(page.locator(".recommendation-screen")).not.toContainText("I have questions");

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const layout = await page.locator(".recommendation-screen").evaluate(screen => {
    const assistant = document.querySelector(".emmi-assistant").getBoundingClientRect();
    const protectedElements = [...screen.querySelectorAll(".actions .button")];
    const overlaps = protectedElements.some(element => {
      const rect = element.getBoundingClientRect();
      return !(assistant.right <= rect.left || assistant.left >= rect.right || assistant.bottom <= rect.top || assistant.top >= rect.bottom);
    });
    return {
      overlaps,
      descriptionFonts: [...screen.querySelectorAll(".info-row p")].map(element => parseFloat(getComputedStyle(element).fontSize)),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth
    };
  });
  expect(layout.overlaps).toBe(false);
  expect(Math.min(...layout.descriptionFonts)).toBeGreaterThanOrEqual(16);
  expect(layout.horizontalOverflow).toBe(false);

  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await expect(page.getByText("Review the key details below. You decide whether you want to enroll in ACCESS.", { exact: true })).toBeVisible();
  await expect(page.locator(".access-consent-care-team")).toHaveCount(0);
  await expect(page.locator(".access-care-chip")).toHaveCount(0);
  await expect(page.getByLabel("I have reviewed the information above and agree to enroll in ACCESS with ITERA HEALTH.")).toBeVisible();
  await page.locator("#screen-select").selectOption("ONBOARDING_COMPLETE", { force: true });
  await expect(page.getByText("You continue working with Dr. Humberto Machado Jr.", { exact: true })).toBeVisible();
});

test("ACCESS care inclusions adapt to the configured condition and direct outreach source", async ({ page }) => {
  const cases = [
    ["Diabetes", "Track your blood sugar from home", "Track your readings at home so your care team can understand how you’re doing."],
    ["Heart Failure", "Track your symptoms from home", "Track your symptoms and weight at home so your care team can understand how you’re doing."],
    ["Chronic Kidney Disease", "Track your kidney health from home", "Track what your care team asks for at home so they can understand how you’re doing."]
  ];
  for (const [condition, title, description] of cases) {
    await page.goto("/?admin=1");
    await page.evaluate(() => localStorage.removeItem("itera.prototype.config.v1"));
    await page.reload();
    await page.locator('summary[aria-label="Condition"]').click();
    const options = page.getByRole("group", { name: /Clinical conditions/ });
    await options.getByText("Hypertension", { exact: true }).click();
    await options.getByText(condition, { exact: true }).click();
    await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
    await page.locator("#screen-select").selectOption("CARE_RECOMMENDATION", { force: true });
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByText(description)).toBeVisible();
    await expect(page.getByText("ITERA helps keep your care coordinated with the doctors you already see.")).toBeVisible();
    await expect(page.locator(".recommendation-screen")).not.toContainText("Dr. Fresner");
  }
});

test("ACCESS provider or practice referral uses doctor recommendation with dynamic physician", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?admin=1");
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Provider / Practice Referral" });
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.locator(".trust-hero-card")).toHaveAttribute("data-hero-variant", "DOCTOR_RECOMMENDS_ACCESS");
  const decorativeImage = page.locator('.trust-hero-image[alt=""]');
  await expect(decorativeImage).toBeVisible();
  await expect(decorativeImage).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByRole("heading", { name: "Your doctor recommends ACCESS care" })).toBeVisible();
  await expect(page.locator(".trust-hero-supporting-copy span")).toHaveText(["Care through Medicare’s", "ACCESS Model"]);
  await expect(page.locator(".trust-hero-physician-photo")).toHaveCount(0);
  await expect(page.locator(".trust-hero-badge-layer")).toHaveCount(0);
  await expect(page.locator(".physician-attribution")).toHaveText("Recommended by Dr. Fresner");
  await expect(page.locator(".invitation-copy .lead")).toHaveText("Stay connected with your care team, keep track of your health, and get support when you need it.");
  // The hero already attributes the invitation to Dr. Fresner; the lead does not repeat it.
  await expect(page.locator(".invitation-copy")).not.toContainText("care team invited you");
  await expect(page.locator(".invitation-benefit strong")).toHaveText(["Stay connected with your care team", "Get support from home", "Understand your health better"]);
  // Voluntariness stays on the Home, below the three benefits rather than posing as one of them.
  const voluntary = page.locator(".invitation-voluntary");
  await expect(voluntary).toHaveText("Participation is voluntary. You’ll review all the details before you decide.");
  await expect(page.locator(".invitation-benefits")).not.toContainText("voluntary");
  const benefitTitleSize = await page.locator(".invitation-benefit strong").first().evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  const voluntarySize = await voluntary.evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  expect(voluntarySize).toBeLessThan(benefitTitleSize);
  await expect(page.getByRole("button", { name: "Start your care journey" })).toBeVisible();
  await expect(page.locator(".contextual-assurance")).toHaveCount(0);
  const contactLine = page.locator(".contact-line");
  await expect(contactLine).toHaveText("Need help? Call (305) 394-8070");
  await expect(contactLine.locator("a")).toHaveAttribute("href", "tel:+13053948070");
  const contactLayout = await contactLine.evaluate(line => {
    const colorProbe = document.createElement("span");
    colorProbe.style.color = "var(--primary-600)";
    document.body.append(colorProbe);
    const label = line.querySelector(".contact-label").getBoundingClientRect();
    const phone = line.querySelector("a").getBoundingClientRect();
    const lineRect = line.getBoundingClientRect();
    const style = getComputedStyle(line);
    const phoneStyle = getComputedStyle(line.querySelector("a"));
    const result = {
      display: style.display,
      fontSize: parseFloat(style.fontSize),
      sameLine: Math.abs((label.top + label.bottom) / 2 - (phone.top + phone.bottom) / 2) < 1,
      centered: Math.abs((label.left + phone.right) / 2 - (lineRect.left + parseFloat(style.paddingLeft) + lineRect.right - parseFloat(style.paddingRight)) / 2) < 2,
      phoneColor: phoneStyle.color,
      primaryColor: getComputedStyle(colorProbe).color
    };
    colorProbe.remove();
    return result;
  });
  expect(contactLayout.display).toBe("flex");
  expect(contactLayout.fontSize).toBeGreaterThanOrEqual(16);
  expect(contactLayout.sameLine).toBe(true);
  expect(contactLayout.centered).toBe(true);
  expect(contactLayout.phoneColor).toBe(contactLayout.primaryColor);
  const doctorLayout = await page.locator(".trust-hero-card").evaluate(card => {
    const hero = card.getBoundingClientRect();
    const language = card.querySelector(".stage-language").getBoundingClientRect();
    const supporting = card.querySelector(".trust-hero-supporting-copy");
    const attribution = card.querySelector(".physician-attribution");
    const supportingRect = supporting.getBoundingClientRect();
    const attributionRect = attribution.getBoundingClientRect();
    const supportingStyle = getComputedStyle(supporting);
    const attributionStyle = getComputedStyle(attribution);
    return {
      languageRight: hero.right - language.right,
      contentLeftRatio: (attributionRect.left - hero.left) / hero.width,
      sameLeft: Math.abs(supportingRect.left - attributionRect.left),
      verticalGap: attributionRect.top - supportingRect.bottom,
      supportingFontSize: parseFloat(supportingStyle.fontSize),
      attributionFontSize: parseFloat(attributionStyle.fontSize),
      supportingLineHeight: parseFloat(supportingStyle.lineHeight),
      attributionLineHeight: parseFloat(attributionStyle.lineHeight),
      attributionPosition: attributionStyle.position,
      contained: attributionRect.right <= hero.right && attributionRect.bottom <= hero.bottom,
      assistantOverlaps: [...document.querySelectorAll(".actions,.contextual-assurance>span:last-child,.contact-line>span,.contact-line>a")].some(element => {
        const assistant = document.querySelector(".emmi-assistant").getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        return !(assistant.right <= rect.left || assistant.left >= rect.right || assistant.bottom <= rect.top || assistant.top >= rect.bottom);
      })
    };
  });
  expect(doctorLayout.languageRight).toBeLessThanOrEqual(10);
  expect(doctorLayout.contentLeftRatio).toBeGreaterThanOrEqual(0.468);
  expect(doctorLayout.contentLeftRatio).toBeLessThanOrEqual(0.476);
  expect(doctorLayout.sameLeft).toBeLessThan(0.5);
  expect(doctorLayout.verticalGap).toBeGreaterThanOrEqual(6);
  expect(doctorLayout.verticalGap).toBeLessThanOrEqual(8);
  expect(doctorLayout.attributionFontSize).toBeCloseTo(doctorLayout.supportingFontSize, 2);
  expect(doctorLayout.attributionLineHeight).toBeCloseTo(doctorLayout.supportingLineHeight, 2);
  expect(doctorLayout.attributionPosition).toBe("static");
  expect(doctorLayout.contained).toBe(true);
  expect(doctorLayout.supportingFontSize).toBeGreaterThanOrEqual(13);
  expect(doctorLayout.assistantOverlaps).toBe(false);
});

test("traditional physician pathway uses supervising care card", async ({ page }) => {
  await page.goto("/?admin=1");
  await page.getByRole("radio", { name: "CCM + RPM", exact: true }).check({ force: true });
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Physician Referral" });
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.locator(".trust-hero-card")).toHaveAttribute("data-hero-variant", "PHYSICIAN_SUPERVISING");
  const image = page.locator('.trust-hero-image[alt=""]');
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".trust-hero-headline span")).toHaveText(["Your care,", "connected with", "your doctor"]);
  await expect(page.locator(".trust-hero-supporting-copy")).toHaveAttribute("aria-label", "Ongoing support from ITERA HEALTH between doctor visits.");
  await expect(page.locator(".physician-attribution")).toHaveText("Coordinated with Dr. Fresner");
  await expect(page.locator(".invitation-copy .lead")).toContainText("Dr. Fresner’s care team invited you");
  await expect(page.locator(".contextual-assurance")).toHaveCount(0);
  const languageRight = await page.locator(".trust-hero-card").evaluate(card => {
    const hero = card.getBoundingClientRect();
    const language = card.querySelector(".stage-language").getBoundingClientRect();
    return hero.right - language.right;
  });
  expect(languageRight).toBeLessThanOrEqual(10);
});

test("landing human-support line stays compact, centered, and clear of the Care Assistant", async ({ page }) => {
  for (const width of [375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/?scenario=access-happy");
    await expect(page.locator(".contextual-assurance")).toHaveCount(0);
    await expect(page.locator(".emmi-welcome")).toBeVisible();
    await expect(page.locator(".emmi-assistant")).toBeHidden();
    const contact = page.locator(".contact-line");
    await expect(contact).toHaveText("Need help? Call (305) 394-8070");
    await expect(contact.locator("a")).toHaveAttribute("href", "tel:+13053948070");
    const audit = await contact.evaluate(line => {
      const label = line.querySelector(".contact-label").getBoundingClientRect();
      const phone = line.querySelector("a").getBoundingClientRect();
      const assistant = document.querySelector(".emmi-assistant").getBoundingClientRect();
      const rect = line.getBoundingClientRect();
      const style = getComputedStyle(line);
      const actions = document.querySelector(".actions").getBoundingClientRect();
      const safeCenter = (rect.left + parseFloat(style.paddingLeft) + rect.right - parseFloat(style.paddingRight)) / 2;
      return {
        sameLine: Math.abs((label.top + label.bottom) / 2 - (phone.top + phone.bottom) / 2) < 1,
        centered: Math.abs((label.left + phone.right) / 2 - safeCenter) < 2,
        fontSize: parseFloat(style.fontSize),
        ctaGap: rect.top - actions.bottom,
        overlapsAssistant: [label, phone].some(item => !(assistant.right <= item.left || assistant.left >= item.right || assistant.bottom <= item.top || assistant.top >= item.bottom)),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth
      };
    });
    expect(audit.sameLine).toBe(true);
    expect(audit.centered).toBe(true);
    expect(audit.fontSize).toBeGreaterThanOrEqual(16);
    expect(audit.ctaGap).toBeLessThanOrEqual(8);
    expect(audit.overlapsAssistant).toBe(false);
    expect(audit.horizontalOverflow).toBe(false);
  }
});

test("every non-ACCESS clinical pathway uses the physician supervising card", async ({ page }) => {
  for (const program of ["CCM", "RPM", "CCM + RPM", "PCM", "PCM + RPM", "ASM", "APCM"]) {
    await page.goto("/?admin=1");
    await page.getByRole("radio", { name: program, exact: true }).check({ force: true });
    await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
    await expect(page.locator(".trust-hero-card")).toHaveAttribute("data-hero-variant", "PHYSICIAN_SUPERVISING");
    await expect(page.locator('.trust-hero-image[alt=""]')).toBeVisible();
    await expect(page.locator(".trust-hero-text-overlay")).toBeVisible();
    await expect(page.locator(".generic-trust-hero")).toHaveCount(0);
  }
});

test("trust hero cards use one compact premium image surface", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  const audits = [];
  const audit = async () => {
    await expect(page.locator(".trust-hero-card")).toBeVisible();
    await expect(page.locator(".trust-hero-image")).toBeVisible();
    await page.waitForFunction(() => {
      const image = document.querySelector(".trust-hero-image");
      return image?.complete && image.naturalWidth > 0;
    });
    return page.evaluate(() => {
    const card = document.querySelector(".trust-hero-card");
    const media = document.querySelector(".trust-hero-media");
    const image = document.querySelector(".trust-hero-image");
    const overlay = document.querySelector(".trust-hero-text-overlay,.trust-hero-overlay");
    const cardRect = card.getBoundingClientRect();
    const mediaRect = media.getBoundingClientRect();
    const overlayRect = overlay?.getBoundingClientRect();
    const cardStyle = getComputedStyle(card);
    const brandRowStyle = getComputedStyle(card.querySelector(".stage-brand-row"));
    return {
      variant: card.dataset.heroVariant,
      width: cardRect.width,
      height: cardRect.height,
      mediaRatio: mediaRect.width / mediaRect.height,
      imageLoaded: image.complete && image.naturalWidth > 0,
      imageNaturalWidth: image.naturalWidth,
      imageNaturalHeight: image.naturalHeight,
      objectFit: getComputedStyle(image).objectFit,
      borderWidth: cardStyle.borderTopWidth,
      boxShadow: cardStyle.boxShadow,
      backgroundColor: cardStyle.backgroundColor,
      brandPosition: brandRowStyle.position,
      brandBorder: brandRowStyle.borderBottomWidth,
      mediaMatchesCard: Math.abs(mediaRect.width - cardRect.width) < 1 && Math.abs(mediaRect.height - cardRect.height) < 1,
      overlayInside: !overlayRect || (overlayRect.left >= mediaRect.left && overlayRect.right <= mediaRect.right && overlayRect.top >= mediaRect.top && overlayRect.bottom <= mediaRect.bottom),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth
    };
    });
  };

  await page.goto("/?admin=1");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  audits.push(await audit());
  await page.goto("/?admin=1");
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Provider / Practice Referral" });
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  audits.push(await audit());
  await page.goto("/?admin=1");
  await page.getByRole("radio", { name: "CCM + RPM", exact: true }).check({ force: true });
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Physician Referral" });
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  audits.push(await audit());

  expect(audits.map(item => item.variant)).toEqual(["ACCESS_PARTICIPANT", "DOCTOR_RECOMMENDS_ACCESS", "PHYSICIAN_SUPERVISING"]);
  for (const item of audits) {
    expect(item.width).toBeGreaterThan(350);
    expect(item.height).toBeGreaterThanOrEqual(190);
    expect(item.height).toBeLessThanOrEqual(225);
    expect(item.mediaRatio).toBeCloseTo(["DOCTOR_RECOMMENDS_ACCESS", "PHYSICIAN_SUPERVISING"].includes(item.variant) ? 1672 / 941 : 1.86, 2);
    expect(item.imageLoaded).toBe(true);
    expect(item.objectFit).toBe("cover");
    expect(item.borderWidth).toBe("0px");
    expect(item.boxShadow).toBe("none");
    expect(item.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(item.brandPosition).toBe("absolute");
    expect(item.brandBorder).toBe("0px");
    expect(item.mediaMatchesCard).toBe(true);
    expect(item.overlayInside).toBe(true);
    expect(item.horizontalOverflow).toBe(false);
    if (item.variant === "DOCTOR_RECOMMENDS_ACCESS") {
      expect(item.imageNaturalWidth).toBe(1672);
      expect(item.imageNaturalHeight).toBe(941);
    }
    if (item.variant === "PHYSICIAN_SUPERVISING") {
      expect(item.imageNaturalWidth).toBe(1672);
      expect(item.imageNaturalHeight).toBe(941);
    }
  }
});

test("physician supervising copy stays live, aligned, and readable across mobile sizes", async ({ page }) => {
  for (const width of [375, 390, 430]) {
    for (const physicianName of ["Dr. Fresner", "Dr. Martinez-Clark", "Dr. Humberto Machado Jr."]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/?admin=1");
      await page.getByRole("radio", { name: "CCM + RPM", exact: true }).check({ force: true });
      await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Physician Referral" });
      await page.getByPlaceholder("Enter physician name").fill(physicianName);
      await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
      const card = page.locator('.trust-hero-card[data-hero-variant="PHYSICIAN_SUPERVISING"]');
      await expect(card.locator(".physician-attribution")).toHaveText(`Coordinated with ${physicianName}`);
      const layout = await card.evaluate(hero => {
        const media = hero.querySelector(".trust-hero-media").getBoundingClientRect();
        const overlay = hero.querySelector(".trust-hero-text-overlay");
        const overlayRect = overlay.getBoundingClientRect();
        const headline = hero.querySelector(".trust-hero-headline").getBoundingClientRect();
        const supporting = hero.querySelector(".trust-hero-supporting-copy").getBoundingClientRect();
        const attribution = hero.querySelector(".physician-attribution").getBoundingClientRect();
        const supportingStyle = getComputedStyle(hero.querySelector(".trust-hero-supporting-copy"));
        const attributionStyle = getComputedStyle(hero.querySelector(".physician-attribution"));
        return {
          contained: overlayRect.left >= media.left && overlayRect.right <= media.right && overlayRect.top >= media.top && overlayRect.bottom <= media.bottom,
          sameLeft: Math.max(Math.abs(headline.left - supporting.left), Math.abs(supporting.left - attribution.left)),
          supportingFont: parseFloat(supportingStyle.fontSize),
          supportingRightRatio: (supporting.right - media.left) / media.width,
          attributionFont: parseFloat(attributionStyle.fontSize),
          attributionLines: attribution.height / parseFloat(attributionStyle.lineHeight),
          supportingClipped: supporting.scrollWidth > supporting.clientWidth || supporting.scrollHeight > supporting.clientHeight,
          attributionClipped: attribution.scrollWidth > attribution.clientWidth || attribution.scrollHeight > attribution.clientHeight,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth
        };
      });
      expect(layout.contained).toBe(true);
      expect(layout.sameLeft).toBeLessThan(0.5);
      expect(layout.supportingFont).toBeGreaterThanOrEqual(12);
      expect(layout.supportingRightRatio).toBeLessThanOrEqual(0.88);
      expect(layout.attributionFont).toBeCloseTo(layout.supportingFont, 2);
      expect(layout.attributionLines).toBeLessThanOrEqual(2.1);
      expect(layout.supportingClipped).toBe(false);
      expect(layout.attributionClipped).toBe(false);
      expect(layout.horizontalOverflow).toBe(false);
    }
  }
});

test("long physician names remain contained in the hero overlay", async ({ page }) => {
  await page.goto("/?admin=1");
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Provider / Practice Referral" });
  await page.getByPlaceholder("Enter physician name").fill("Dr. Humberto Machado Jr.");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  const overlay = page.locator(".physician-attribution.long");
  await expect(overlay).toHaveText("Recommended by Dr. Humberto Machado Jr.");
  const contained = await page.evaluate(() => {
    const media = document.querySelector(".trust-hero-media").getBoundingClientRect();
    const textElement = document.querySelector(".physician-attribution");
    const text = textElement.getBoundingClientRect();
    const style = getComputedStyle(textElement);
    return {
      inside: text.left >= media.left && text.right <= media.right && text.top >= media.top && text.bottom <= media.bottom,
      lines: text.height / parseFloat(style.lineHeight),
      ellipsis: style.textOverflow
    };
  });
  expect(contained.inside).toBe(true);
  expect(contained.lines).toBeLessThanOrEqual(2.1);
  expect(contained.ellipsis).not.toBe("ellipsis");
});

test("ACCESS physician attribution stays aligned across mobile widths and physician names", async ({ page }) => {
  for (const width of [375, 390, 430]) {
    for (const physicianName of ["Dr. Fresner", "Dr. Martinez-Clark", "Dr. Humberto Machado Jr."]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/?admin=1");
      await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Provider / Practice Referral" });
      await page.getByPlaceholder("Enter physician name").fill(physicianName);
      await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
      await expect(page.locator(".physician-attribution")).toHaveText(`Recommended by ${physicianName}`);
      const layout = await page.locator(".trust-hero-card").evaluate(card => {
        const hero = card.getBoundingClientRect();
        const supporting = card.querySelector(".trust-hero-supporting-copy");
        const attribution = card.querySelector(".physician-attribution");
        const language = card.querySelector(".stage-language").getBoundingClientRect();
        const assistant = document.querySelector(".emmi-assistant").getBoundingClientRect();
        const supportingRect = supporting.getBoundingClientRect();
        const attributionRect = attribution.getBoundingClientRect();
        const supportingStyle = getComputedStyle(supporting);
        const attributionStyle = getComputedStyle(attribution);
        const headline = card.querySelector(".trust-hero-headline").getBoundingClientRect();
        const lineTops = [...new Set([...attribution.childNodes].flatMap(node => {
          const range = document.createRange();
          range.selectNodeContents(node);
          return [...range.getClientRects()].map(rect => Math.round(rect.top));
        }))];
        const overlaps = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
        return {
          sameLeft: Math.abs(supportingRect.left - attributionRect.left),
          headlineLeft: Math.abs(headline.left - attributionRect.left),
          gap: attributionRect.top - supportingRect.bottom,
          sameFontSize: Math.abs(parseFloat(supportingStyle.fontSize) - parseFloat(attributionStyle.fontSize)),
          lines: lineTops.length,
          contained: attributionRect.left >= hero.left && attributionRect.right <= hero.right && attributionRect.bottom <= hero.bottom,
          overlapsLanguage: overlaps(attributionRect, language),
          overlapsAssistant: overlaps(attributionRect, assistant),
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
          textOverflow: attributionStyle.textOverflow
        };
      });
      expect(layout.sameLeft).toBeLessThan(0.5);
      expect(layout.headlineLeft).toBeLessThan(0.5);
      expect(layout.gap).toBeGreaterThanOrEqual(6);
      expect(layout.gap).toBeLessThanOrEqual(8);
      expect(layout.sameFontSize).toBeLessThan(0.01);
      expect(layout.lines).toBeLessThanOrEqual(2);
      expect(layout.contained).toBe(true);
      expect(layout.overlapsLanguage).toBe(false);
      expect(layout.overlapsAssistant).toBe(false);
      expect(layout.horizontalOverflow).toBe(false);
      expect(layout.textOverflow).not.toBe("ellipsis");
    }
  }
});

test("Creole setup opens the first patient screen in Creole", async ({ page }) => {
  await page.goto("/?admin=1");
  await page.getByRole("combobox", { name: /Language/ }).selectOption({ label: "Creole" });
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.getByRole("heading", { name: "Yon fason pi entelijan pou jere sante ou" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ht");
});

test("ACCESS patient experience stays complete and unmixed in EN, ES, and KR", async ({ page }) => {
  const locales = [
    { value: "en", label: "English", code: "EN", html: "en", heading: "A smarter way to manage your health", identity: "Let’s securely confirm it’s you" },
    { value: "es", label: "Spanish", code: "ES", html: "es", heading: "Una forma más inteligente de cuidar su salud", identity: "Confirmemos su identidad de forma segura" },
    { value: "ht", label: "Creole", code: "KR", html: "ht", heading: "Yon fason pi entelijan pou jere sante ou", identity: "Ann konfime se ou an sekirite" }
  ];
  for (const locale of locales) {
    await page.goto("/?admin=1");
    await page.getByRole("combobox", { name: /Language/ }).selectOption(locale.value);
    await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
    await expect(page.getByRole("heading", { name: locale.heading })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", locale.html);
    await expect(page.locator(".stage-language")).toContainText(locale.code);
    await expect(page.locator("#app")).not.toContainText("⟦");

    await page.getByRole("button", { name: locale.value === "en" ? "Start your care journey" : locale.value === "es" ? "Comience su recorrido de cuidado" : "Kòmanse pwosesis swen ou" }).click();
    await page.getByLabel(locale.value === "en" ? "For myself" : locale.value === "es" ? "Para mí" : "Pou tèt mwen").check();
    await page.getByRole("button", { name: locale.value === "en" ? "Continue" : locale.value === "es" ? "Continuar" : "Kontinye" }).click();
    await expect(page.getByRole("heading", { name: locale.identity })).toBeVisible();
    await expect(page.locator("#app")).not.toContainText("⟦");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", locale.html);
  }
});

test("Spanish and Kreyòl dynamic care, eligibility, consent, and Emmi copy do not fall back to English", async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("itera.enrollment.language.v1"));
  for (const locale of [
    { clicks: 1, code: "ES", care: "Manténgase conectado con su equipo de cuidado", careHeading: "Qué incluye su cuidado", careSupport: "Su cuidado ACCESS le brinda nuevas herramientas y apoyo continuo para ayudarle a controlar su presión arterial alta entre visitas al médico.", careNote: "Su cuidado no termina cuando sale del consultorio. Su equipo de cuidado permanece conectado con usted en todo el proceso.", precheck: "Medicare revisará algunos datos para confirmar que puede participar en ACCESS. Esto solo toma un momento y no cambia su cobertura de Medicare.", precheckAck: "Entiendo esta información y deseo continuar con la verificación de elegibilidad de Medicare", eligibility: "Elegibilidad", consent: "Revise y elija", consentIntro: "Revise los detalles clave a continuación. Usted decide si desea inscribirse en ACCESS.", providerRule: "Un proveedor de cuidado ACCESS a la vez", changeRule: "A partir de 90 días después de la inscripción, puede dejar ACCESS o cambiar a otro proveedor participante.", cost: "Medicare cubre la mayor parte del costo de este cuidado. Su cobertura suplementaria puede reducir este monto.", fullTerms: "Ver información completa de ACCESS", assistant: "Asistente de cuidado" },
    { clicks: 2, code: "KR", care: "Rete konekte ak ekip swen ou", careHeading: "Sa swen ou gen ladan", careSupport: "Swen ACCESS ou ba ou nouvo zouti ak sipò kontinyèl pou ede w jere tansyon wo ou ant vizit kay doktè.", careNote: "Swen ou pa kanpe lè ou kite biwo doktè a. Ekip swen ou rete konekte avèk ou pandan tout wout la.", precheck: "Medicare ap revize kèk detay pou konfime ou ka patisipe nan ACCESS. Sa pran yon ti moman sèlman epi li pa chanje kouvèti Medicare ou.", precheckAck: "Mwen konprann enfòmasyon sa a epi mwen vle kontinye ak verifikasyon kalifikasyon Medicare a", eligibility: "Elijibilite", consent: "Revize epi chwazi", consentIntro: "Revize detay enpòtan ki anba yo. Se ou ki deside si ou vle enskri nan ACCESS.", providerRule: "Yon sèl founisè swen ACCESS alafwa", changeRule: "Apati 90 jou apre enskripsyon an, ou ka kite ACCESS oswa chanje pou yon lòt founisè ki patisipe.", cost: "Se gen yon bon tan depi nou te verifye kouvèti ou, kidonk nou pa vle montre w yon montan ki ka pa ajou.", fullTerms: "Gade tout enfòmasyon ACCESS yo", assistant: "Asistan swen" }
  ]) {
    await page.goto("/?scenario=access-happy");
    for (let i = 0; i < locale.clicks; i += 1) await page.locator(".stage-language").click();
    await page.locator("#screen-select").selectOption("CARE_RECOMMENDATION", { force: true });
    await expect(page.getByRole("heading", { name: locale.careHeading })).toBeVisible();
    await expect(page.getByText(locale.careSupport)).toBeVisible();
    await expect(page.getByText(locale.care)).toBeVisible();
    await expect(page.getByText(locale.careNote)).toBeVisible();
    await expect(page.locator("#app")).not.toContainText("⟦");
    await page.locator("#screen-select").selectOption("ACCESS_PRE_ELIGIBILITY_NOTICE", { force: true });
    await expect(page.getByText(locale.precheck)).toBeVisible();
    await expect(page.getByLabel(locale.precheckAck)).toBeVisible();
    await page.locator("#screen-select").selectOption("ACCESS_ELIGIBILITY_PROCESSING", { force: true });
    await expect(page.locator(".progress-meta span").last()).toHaveText(locale.eligibility);
    await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
    await expect(page.getByRole("heading", { name: locale.consent })).toBeVisible();
    await expect(page.getByText(locale.consentIntro)).toBeVisible();
    await expect(page.locator(".access-consent-summary").getByText(locale.providerRule, { exact: true })).toBeVisible();
    await expect(page.locator(".access-consent-summary").getByText(locale.changeRule)).toBeVisible();
    await expect(page.getByText(locale.cost)).toBeVisible();
    await expect(page.getByText(locale.fullTerms, { exact: false })).toBeVisible();
    await openEmmiConversation(page);
    await expect(page.locator(".assistant-header")).toContainText(locale.assistant);
    await expect(page.locator("#app")).not.toContainText("⟦");
  }
});

test("ACCESS does not confirm enrollment at eligibility", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ACCESS_ELIGIBILITY_RESULT", { force: true });
  await expect(page.getByRole("heading", { name: "Great news — you can continue with ACCESS" })).toBeVisible();
  await expect(page.getByText("Everything is ready for you to continue. We’ll review the details together before completing your enrollment.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What happens next?" })).toBeVisible();
  await expect(page.getByText("Learn about your ACCESS care")).toBeVisible();
  await expect(page.getByText("Confirm that you’d like to enroll with ITERA HEALTH")).toBeVisible();
  await expect(page.getByText("We’ll complete your ACCESS enrollment with Medicare")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  await expect(page.locator('.contextual-assurance[data-assurance-type="NO_COMMITMENT_YET"]')).toContainText("You’ll review all the details before completing your enrollment");
  await expect(page.getByText("Enrollment confirmed")).toHaveCount(0);
  await expect(page.locator("#screen-content")).not.toContainText(/coverage is approved|Medicare approved your care|you’re enrolled|enrollment is confirmed/i);
  await expect(page.locator(".emmi-guide")).toBeVisible();
  const assistant = page.locator(".emmi-assistant");
  await expect(assistant).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const layout = await page.locator("#screen-content").evaluate(screen => {
    const bot = document.querySelector(".emmi-assistant").getBoundingClientRect();
    const protectedElements = [...screen.querySelectorAll(".actions .button")];
    return {
      overlaps: protectedElements.filter(element => {
        const rect = element.getBoundingClientRect();
        return !(bot.right <= rect.left || bot.left >= rect.right || bot.bottom <= rect.top || bot.top >= rect.bottom);
      }).map(element => `${element.className}:${element.textContent.trim().slice(0, 40)}`),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth
    };
  });
  expect(layout.overlaps).toEqual([]);
  expect(layout.horizontalOverflow).toBe(false);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".progress-meta span").last()).toHaveText("Consent");
});

test("non-eligible ACCESS outcomes retain their existing Medicare reassurance", async ({ page }) => {
  for (const scenario of ["access-control", "access-not-eligible", "access-already-aligned", "access-api-unavailable"]) {
    await page.goto(`/?scenario=${scenario}`);
    await page.locator("#screen-select").selectOption("ACCESS_ELIGIBILITY_RESULT", { force: true });
    await expect(page.getByRole("heading", { name: "Great news — you can continue with ACCESS" })).toHaveCount(0);
    const assuranceType = scenario === "access-not-eligible" ? "NOT_ELIGIBLE_REASSURANCE" : "MEDICARE_PROTECTION";
    const message = scenario === "access-not-eligible" ? "This does not change your Medicare benefits" : "This check won’t affect your Medicare benefits";
    await expect(page.locator(`.contextual-assurance[data-assurance-type="${assuranceType}"]`)).toContainText(message);
  }
});

test("ACCESS eligibility processing uses patient-friendly real status states", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ACCESS_ELIGIBILITY_PROCESSING", { force: true });

  await expect(page.getByRole("heading", { name: "Checking your Medicare eligibility" })).toBeVisible();
  await expect(page.getByText("We’re securely checking whether this ACCESS care option is available to you.")).toBeVisible();
  await expect(page.locator('.process-list li[data-process-state="completed"]')).toHaveText("Verifying Medicare coverage");
  await expect(page.locator('.process-list li[data-process-state="in-progress"]')).toHaveText("Checking for an existing ACCESS enrollment");
  await expect(page.locator('.process-list li[data-process-state="pending"]')).toHaveText("Confirming your ACCESS care option");
  await expect(page.locator(".process-list")).not.toContainText("care track");
  await expect(page.locator('.contextual-assurance[data-assurance-type="MEDICARE_PROTECTION"]')).toContainText("This check won’t affect your Medicare benefits");
  await expect(page.locator(".emmi-guide")).toBeVisible();
  await expect(page.locator(".emmi-assistant")).toBeHidden();
  const audit = await page.locator(".eligibility-processing-screen").evaluate(screen => ({
    statusFonts: [...screen.querySelectorAll(".process-list li")].map(item => parseFloat(getComputedStyle(item).fontSize)),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    footerAfterStatuses: Boolean(screen.querySelector(".process-list").compareDocumentPosition(screen.querySelector(".contextual-assurance")) & Node.DOCUMENT_POSITION_FOLLOWING)
  }));
  expect(Math.min(...audit.statusFonts)).toBeGreaterThanOrEqual(16);
  expect(audit.horizontalOverflow).toBe(false);
  expect(audit.footerAfterStatuses).toBe(true);
});

test("ACCESS eligibility processing provides a safe retry state", async ({ page }) => {
  await page.goto("/?scenario=access-check-failure");
  await page.locator("#screen-select").selectOption("ACCESS_PRE_ELIGIBILITY_NOTICE", { force: true });
  await page.getByLabel("I understand this information and want to continue with the Medicare eligibility check").check();
  await page.getByRole("button", { name: "Check my eligibility" }).click();
  await expect(page.getByRole("heading", { name: "We couldn’t complete the check right now." })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Your information is safe. Please try again or contact our care team.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Get help" })).toBeVisible();
  await expect(page.locator(".eligibility-processing-screen")).not.toContainText(/API|HTTP|CMS endpoint|timeout|stack/i);
  await expect(page.locator('.contextual-assurance[data-assurance-type="MEDICARE_PROTECTION"]')).toContainText("This check won’t affect your Medicare benefits");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "We couldn’t complete the check right now." })).toBeVisible({ timeout: 5000 });
});

test("ACCESS eligibility disclosure is calm, readable, and requires acknowledgement", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ACCESS_PRE_ELIGIBILITY_NOTICE", { force: true });

  await expect(page.getByRole("heading", { name: "Let’s confirm your eligibility with Medicare" })).toBeVisible();
  await expect(page.getByText("Medicare will review a few details to confirm you can take part in ACCESS. This only takes a moment and does not change your Medicare coverage.")).toBeVisible();
  await expect(page.getByText("ITERA and Medicare can securely exchange the information needed to confirm your eligibility for ACCESS.")).toBeVisible();
  await expect(page.getByText("How the ACCESS evaluation works", { exact: true })).toBeVisible();
  await expect(page.getByText("Medicare also evaluates how ACCESS works, and may request information for that evaluation. As part of it, some people are randomly selected for a comparison group. If that happens to you, you would not be able to take part in ACCESS for 12 months.")).toBeVisible();
  await expect(page.getByText("This eligibility check and any comparison group assignment do not change your Medicare benefits, coverage, or rights.")).toBeVisible();
  await expect(page.locator(".access-precheck-row")).toHaveCount(3);
  await expect(page.locator(".access-notice-screen details")).toHaveCount(0);
  const assurance = page.locator('.contextual-assurance[data-assurance-type="MEDICARE_PROTECTION"]');
  await expect(assurance).toContainText("This check won’t affect your Medicare benefits");
  await expect(assurance.locator(".icon")).toHaveCount(1);

  const acknowledgement = page.getByLabel("I understand this information and want to continue with the Medicare eligibility check");
  const eligibilityCta = page.getByRole("button", { name: "Check my eligibility" });
  await expect(eligibilityCta).toBeDisabled();
  await acknowledgement.check();
  await expect(eligibilityCta).toBeEnabled();

  const layout = await page.locator(".access-notice-screen").evaluate(screen => {
    const assistant = document.querySelector(".emmi-assistant").getBoundingClientRect();
    const protectedElements = [...screen.querySelectorAll(".check-row,.actions,.contextual-assurance")];
    const overlaps = protectedElements.some(element => {
      const rect = element.getBoundingClientRect();
      return !(assistant.right <= rect.left || assistant.left >= rect.right || assistant.bottom <= rect.top || assistant.top >= rect.bottom);
    });
    return {
      overlaps,
      leadFont: parseFloat(getComputedStyle(screen.querySelector(".lead")).fontSize),
      titleFonts: [...screen.querySelectorAll(".access-precheck-row strong")].map(element => parseFloat(getComputedStyle(element).fontSize)),
      bodyFonts: [...screen.querySelectorAll(".access-precheck-row p")].map(element => parseFloat(getComputedStyle(element).fontSize)),
      checkboxFont: parseFloat(getComputedStyle(screen.querySelector(".check-row")).fontSize),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth
    };
  });
  expect(layout.overlaps).toBe(false);
  expect(layout.leadFont).toBeGreaterThanOrEqual(17);
  expect(Math.min(...layout.titleFonts)).toBeGreaterThanOrEqual(16);
  expect(Math.min(...layout.bodyFonts)).toBeGreaterThanOrEqual(16);
  expect(layout.checkboxFont).toBeGreaterThanOrEqual(16);
  expect(layout.horizontalOverflow).toBe(false);

  await eligibilityCta.click();
  await expect(page.getByRole("heading", { name: "Great news — you can continue with ACCESS" })).toBeVisible({ timeout: 5000 });
  const noticeEvidence = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(noticeEvidence.accessNoticeAcknowledgedAt).toBeTruthy();
  expect(noticeEvidence.audit.map(event => event.eventType)).toContain("access_eligibility_notice_acknowledged");
});

test("ACCESS eligibility evaluation explanation is localized in Spanish and Kreyòl", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ACCESS_PRE_ELIGIBILITY_NOTICE", { force: true });

  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.getByText("Cómo funciona la evaluación de ACCESS", { exact: true })).toBeVisible();
  await expect(page.getByText("Medicare también evalúa cómo funciona ACCESS y puede solicitar información para esa evaluación. Como parte de ella, algunas personas son seleccionadas al azar para un grupo de comparación. Si esto le ocurre, no podrá participar en ACCESS durante 12 meses.", { exact: true })).toBeVisible();
  await expect(page.getByText("Esta verificación de elegibilidad y cualquier asignación a un grupo de comparación no cambian sus beneficios, cobertura ni derechos de Medicare.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Cambiar idioma a criollo" }).click();
  await expect(page.getByText("Kijan evalyasyon ACCESS la fonksyone", { exact: true })).toBeVisible();
  await expect(page.getByText("Medicare evalye tou kijan ACCESS fonksyone, epi li ka mande enfòmasyon pou evalyasyon sa a. Nan kad li, yo chwazi kèk moun o aza pou yon gwoup konparezon. Si sa rive ou, ou pa ta kapab patisipe nan ACCESS pandan 12 mwa.", { exact: true })).toBeVisible();
  await expect(page.getByText("Verifikasyon kalifikasyon sa a ak nenpòt plasman nan yon gwoup konparezon pa chanje benefis, kouvèti oswa dwa Medicare ou.", { exact: true })).toBeVisible();
  const layout = await page.locator(".access-notice-screen").evaluate(screen => ({
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    bodyFonts: [...screen.querySelectorAll(".access-precheck-row p")].map(element => Number.parseFloat(getComputedStyle(element).fontSize))
  }));
  expect(layout.horizontalOverflow).toBe(false);
  expect(Math.min(...layout.bodyFonts)).toBeGreaterThanOrEqual(16);
});

test("RPM shipping branch exposes address confirmation", async ({ page }) => {
  await page.goto("/?scenario=rpm-shipping");
  await page.locator("#screen-select").selectOption("RPM_DEVICE_PATH", { force: true });
  await page.getByLabel("I need a monitor from ITERA").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Where should we send your monitor?" })).toBeVisible();
  await expect(page.locator('.contextual-assurance[data-assurance-type="DEVICE_SUPPORT"]')).toContainText("Your care team can help with setup");
});

test("language switch exposes Spanish UI", async ({ page }) => {
  await page.goto("/?scenario=ccm-happy");
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.getByRole("heading", { name: /forma más inteligente de cuidar su salud/i })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test("Emmi remains available throughout the patient experience", async ({ page }) => {
  await page.goto("/?scenario=ccm-happy");
  // Home introduces EMMI in her own card, so the corner stays empty: one EMMI, not two.
  await expect(page.locator(".emmi-welcome")).toBeVisible();
  const emmi = page.getByRole("button", { name: "Open EMMI" });
  await expect(emmi).toBeHidden();

  await page.locator("#screen-select").selectOption("IDENTITY_VERIFICATION", { force: true });
  const compactEmmi = page.locator(".emmi-guide");
  await expect(compactEmmi).toBeVisible();
  await expect(emmi).toBeHidden();

  // Past the compact card — on a screen long enough to scroll it away — EMMI returns as a named
  // pill the patient can move where they like.
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  expect(await revealFloatingEmmi(page)).not.toBeNull();
  await expect(emmi).toBeVisible();
  await expect(emmi.locator("img")).toHaveAttribute("src", "/assets/emmi-assistant.png");
  // How the pill is drawn is covered by emmi-guidance.spec.js; what matters here is that EMMI is
  // reachable, named for assistive technology, and still where the patient left her.
  await expect(emmi).toHaveAccessibleName("Open EMMI");
  expect((await emmi.boundingBox()).height).toBeGreaterThanOrEqual(48);

  const initial = await emmi.boundingBox();
  await page.mouse.move(initial.x + initial.width / 2, initial.y + initial.height / 2);
  await page.mouse.down();
  await page.mouse.move(45, 160, { steps: 8 });
  await page.mouse.up();
  const moved = await emmi.boundingBox();
  expect(Math.abs(moved.x - initial.x)).toBeGreaterThan(80);

  // Ask EMMI from the compact card opens the same conversation.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(compactEmmi).toBeVisible();
  await expect(emmi).toBeHidden();
  await compactEmmi.getByRole("button", { name: "Ask EMMI" }).click();
  await expect(page.getByText("EMMI is an AI assistant, not a clinician. For medical emergencies, call 911.")).toBeVisible();
});

test("Emmi opens as a contextual conversation layer without changing enrollment state", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ACCESS_PRE_ELIGIBILITY_NOTICE", { force: true });
  const acknowledgement = page.getByLabel("I understand this information and want to continue with the Medicare eligibility check");
  await acknowledgement.check();
  await page.evaluate(() => window.scrollTo(0, 120));
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const progressBefore = await page.getByRole("progressbar", { name: "Journey progress" }).getAttribute("aria-valuenow");

  await openEmmiConversation(page);
  const dialog = page.getByRole("dialog", { name: "EMMI – Your ITERA Care Assistant" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Ask me anything about your enrollment or care.")).toBeVisible();
  await expect(dialog.getByPlaceholder("Ask a question…")).toBeVisible();
  await expect(dialog.getByText("What is Medicare checking?")).toBeVisible();
  await expect(dialog.getByText("Will this affect my benefits?")).toBeVisible();
  await expect(dialog.getByText("Why do you need my information?")).toBeVisible();
  await expect(dialog.getByText("Prefer to talk with someone?")).toBeVisible();
  await expect(dialog.getByRole("link", { name: /Talk to our care team/ })).toHaveAttribute("href", "tel:+13053948070");
  await expect(dialog.getByText("EMMI will confirm before sending the request")).toBeVisible();
  await expect(dialog.locator(".contextual-assurance")).toHaveCount(0);
  await expect(dialog).not.toContainText(/ENROLLMENT\s*QUESTIONS/i);
  await expect(page.locator(".emmi-assistant")).toBeHidden();
  const assistantLayout = await dialog.evaluate(layer => {
    const input = layer.querySelector("#assistant-question");
    const intro = layer.querySelector(".assistant-intro p");
    const quickButtons = [...layer.querySelectorAll(".assistant-quick button")];
    const supportActions = [...layer.querySelectorAll(".assistant-support-action")];
    return {
      width: layer.getBoundingClientRect().width,
      inputHeight: input.getBoundingClientRect().height,
      inputFont: parseFloat(getComputedStyle(input).fontSize),
      introFont: parseFloat(getComputedStyle(intro).fontSize),
      quickMinHeight: Math.min(...quickButtons.map(button => button.getBoundingClientRect().height)),
      supportMinHeight: Math.min(...supportActions.map(action => action.getBoundingClientRect().height)),
      horizontalOverflow: layer.scrollWidth > layer.clientWidth
    };
  });
  expect(assistantLayout.width).toBeLessThanOrEqual(440);
  expect(assistantLayout.inputHeight).toBeGreaterThanOrEqual(52);
  expect(assistantLayout.inputFont).toBeGreaterThanOrEqual(17);
  expect(assistantLayout.introFont).toBeGreaterThanOrEqual(17);
  expect(assistantLayout.quickMinHeight).toBeGreaterThanOrEqual(48);
  expect(assistantLayout.supportMinHeight).toBeGreaterThanOrEqual(72);
  expect(assistantLayout.horizontalOverflow).toBe(false);

  const input = dialog.getByPlaceholder("Ask a question…");
  await input.fill("I don’t understand this screen.");
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(dialog.getByText("This screen explains what Medicare needs you to know before checking whether ACCESS is available to you.")).toBeVisible();

  await input.fill("I have chest pain and cannot breathe");
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(dialog.getByText(/urgent medical attention/i)).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Call 911" })).toHaveAttribute("href", "tel:911");

  await dialog.getByRole("button", { name: "Have someone call me" }).click();
  await expect(dialog.getByText("Would you like me to ask the ITERA care team to call you?")).toBeVisible();
  await input.fill("Yes");
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(dialog.getByText("Done. I sent a callback request to the care team.")).toBeVisible();
  await dialog.locator(".assistant-close").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#screen-select")).toHaveValue("ACCESS_PRE_ELIGIBILITY_NOTICE");
  await expect(acknowledgement).toBeChecked();
  await expect(page.getByRole("progressbar", { name: "Journey progress" })).toHaveAttribute("aria-valuenow", progressBefore);
  // EMMI is one assistant in several presentations. Closing the panel has to leave her reachable,
  // which is not the same as leaving the floating pill on screen: the pill stands down while the
  // compact card is in view, so demanding it here asserted a layout choice rather than the promise.
  await expect(page.locator('.emmi-guide [data-action="help"], .emmi-welcome [data-action="help"], .emmi-assistant').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBefore);

  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await openEmmiConversation(page);
  const consentDialog = page.getByRole("dialog", { name: "EMMI – Your ITERA Care Assistant" });
  await expect(consentDialog.getByText("What am I agreeing to?")).toBeVisible();
  await expect(consentDialog.getByText("Can I change my mind?")).toBeVisible();
  await expect(consentDialog.getByText("What will this cost?")).toBeVisible();
  await expect(consentDialog.getByText("Does this change my Medicare?")).toBeVisible();
  await expect(consentDialog.getByText("What does signing as a personal representative mean?")).toBeVisible();
  await consentDialog.locator(".assistant-close").click();
  await expect(page.locator("#screen-select")).toHaveValue("CONSENT_REVIEW");
});

test("date of birth supports typing and calendar selection", async ({ page }) => {
  await page.goto("/?scenario=ccm-happy");
  await page.locator("#screen-select").selectOption("IDENTITY_VERIFICATION", { force: true });

  const dateText = page.getByLabel("Date of birth", { exact: true });
  const zip = page.getByLabel("ZIP code", { exact: true });
  await expect(page.getByText("Confirm your date of birth and ZIP code so we can match you to your care invitation.")).toBeVisible();
  await expect(page.getByText("Your information is protected and used only to securely verify your identity.")).toBeVisible();
  await expect(page.getByText("Use MM / DD / YYYY.", { exact: true })).toBeVisible();
  await expect(page.getByText("Enter your home ZIP code.", { exact: true })).toBeVisible();
  const helperStyles = await page.locator(".field-helper").evaluateAll(helpers => helpers.map(helper => ({
    color: getComputedStyle(helper).color,
    fontSize: parseFloat(getComputedStyle(helper).fontSize),
    lineHeight: parseFloat(getComputedStyle(helper).lineHeight)
  })));
  expect(new Set(helperStyles.map(style => `${style.color}|${style.fontSize}|${style.lineHeight}`)).size).toBe(1);
  expect(Math.min(...helperStyles.map(style => style.fontSize))).toBeGreaterThanOrEqual(15);
  await expect(dateText).toHaveValue("05 / 12 / 1954");
  await expect(zip).toHaveValue("33176");
  await expect(dateText).toHaveAttribute("inputmode", "numeric");
  await expect(zip).toHaveAttribute("inputmode", "numeric");
  await expect(page.locator("#identity-form input[name]")).toHaveCount(2);
  await expect(page.locator(".emmi-guide")).toBeVisible();
  await expect(page.locator(".emmi-assistant")).toBeHidden();
  await dateText.fill("06151945");
  await expect(dateText).toHaveValue("06 / 15 / 1945");

  const calendar = page.getByLabel("Choose date of birth from calendar");
  const localToday = await page.evaluate(() => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${today.getFullYear()}-${month}-${day}`;
  });
  await expect(calendar).toHaveAttribute("max", localToday);
  await calendar.fill("1940-02-03");
  await calendar.dispatchEvent("change");
  await expect(dateText).toHaveValue("02 / 03 / 1940");
  const layout = await page.locator(".identity-screen").evaluate(screen => {
    const inputs = [...screen.querySelectorAll('.field input:not([type="date"])')];
    const buttons = [...screen.querySelectorAll(".button")];
    const zipRect = screen.querySelector('.zip-input').getBoundingClientRect();
    const actionsRect = screen.querySelector('.actions').getBoundingClientRect();
    return {
      inputHeights: inputs.map(input => input.getBoundingClientRect().height),
      inputFonts: inputs.map(input => parseFloat(getComputedStyle(input).fontSize)),
      buttonHeights: buttons.map(button => button.getBoundingClientRect().height),
      buttonFonts: buttons.map(button => parseFloat(getComputedStyle(button).fontSize)),
      actionGap: actionsRect.top - zipRect.bottom
    };
  });
  expect(Math.min(...layout.inputHeights)).toBeGreaterThanOrEqual(44);
  expect(Math.min(...layout.inputFonts)).toBeGreaterThanOrEqual(17);
  expect(Math.min(...layout.buttonHeights)).toBeGreaterThanOrEqual(48);
  expect(Math.min(...layout.buttonFonts)).toBeGreaterThanOrEqual(17);
  expect(layout.actionGap).toBeGreaterThanOrEqual(20);
  expect(layout.actionGap).toBeLessThanOrEqual(125);
});

test("contextual assurance footer follows actions and stays clear of Emmi", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=access-happy");
  const cases = [
    ["DECISION_MAKER", "ROLE_GUIDANCE", "We’ll guide you through the right steps"],
    ["IDENTITY_VERIFICATION", "SECURITY", "Your information is secure"],
    ["CARE_RECOMMENDATION", "NO_COMMITMENT_YET", "You’ll review all the details before completing your enrollment"],
    ["ACCESS_ELIGIBILITY_RESULT", "NO_COMMITMENT_YET", "You’ll review all the details before completing your enrollment"],
    ["CONSENT_REVIEW", "ENROLLMENT_CHOICE", "You choose whether to enroll"],
    ["ACCESS_BASELINE", "HEALTH_DATA_SECURITY", "Your health information is secure"]
  ];

  for (const [screen, type, message] of cases) {
    await page.locator("#screen-select").selectOption(screen, { force: true });
    const footer = page.locator(".contextual-assurance");
    await expect(footer).toHaveCount(1);
    await expect(footer).toHaveAttribute("data-assurance-type", type);
    await expect(footer).toContainText(message);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const audit = await page.locator("#screen-content").evaluate(screenContent => {
      const assurance = screenContent.querySelector(".contextual-assurance");
      const actionArea = screenContent.querySelector(".actions") || [...screenContent.querySelectorAll(".button")].at(-1);
      const assistant = document.querySelector(".emmi-assistant");
      const footerRect = assurance.getBoundingClientRect();
      const assistantRect = assistant.getBoundingClientRect();
      const style = getComputedStyle(assurance);
      const lineHeight = parseFloat(style.lineHeight);
      const textRect = assurance.querySelector("span:last-child").getBoundingClientRect();
      return {
        followsActions: !actionArea || Boolean(actionArea.compareDocumentPosition(assurance) & Node.DOCUMENT_POSITION_FOLLOWING),
        overlapsAssistant: !(assistantRect.right <= footerRect.left || assistantRect.left >= footerRect.right || assistantRect.bottom <= footerRect.top || assistantRect.top >= footerRect.bottom),
        fontSize: parseFloat(style.fontSize),
        lineCount: textRect.height / lineHeight,
        borderWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
        background: style.backgroundColor
      };
    });
    expect(audit.followsActions).toBe(true);
    expect(audit.overlapsAssistant).toBe(false);
    expect(audit.fontSize).toBeGreaterThanOrEqual(15);
    expect(audit.lineCount).toBeLessThanOrEqual(2.1);
    expect(audit.borderWidth).toBe("0px");
    expect(audit.boxShadow).toBe("none");
    expect(audit.background).toBe("rgba(0, 0, 0, 0)");
  }
  await expect(page.locator("#screen-content")).not.toContainText("I have questions");

  await page.goto("/?scenario=access-missing-mbi");
  await page.locator("#screen-select").selectOption("ACCESS_MEDICARE_IDENTIFIER", { force: true });
  await expect(page.locator('.contextual-assurance[data-assurance-type="MEDICARE_INFORMATION"]')).toContainText("Your Medicare information is securely protected");
});

test("device journey uses setup reassurance", async ({ page }) => {
  await page.goto("/?scenario=rpm-shipping");
  for (const screen of ["RPM_DEVICE_PATH", "RPM_DEVICE_SETUP"]) {
    await page.locator("#screen-select").selectOption(screen, { force: true });
    await expect(page.locator('.contextual-assurance[data-assurance-type="DEVICE_SUPPORT"]')).toContainText("Your care team can help with setup");
  }
});

test("assurance footer remains readable across supported widths", async ({ page }) => {
  for (const width of [375, 390, 430, 768]) {
    await page.setViewportSize({ width, height: width === 768 ? 1024 : 844 });
    await page.goto("/?scenario=ccm-happy");
    await page.locator("#screen-select").selectOption("HOW_CARE_WORKS", { force: true });
    const layout = await page.evaluate(() => {
      const shell = document.querySelector(".shell").getBoundingClientRect();
      const footer = document.querySelector(".contextual-assurance");
      const footerRect = footer.getBoundingClientRect();
      const assistantRect = document.querySelector(".emmi-assistant").getBoundingClientRect();
      const text = footer.querySelector("span:last-child");
      const style = getComputedStyle(footer);
      return {
        insideShell: footerRect.left >= shell.left && footerRect.right <= shell.right,
        overlapsAssistant: !(assistantRect.right <= footerRect.left || assistantRect.left >= footerRect.right || assistantRect.bottom <= footerRect.top || assistantRect.top >= footerRect.bottom),
        lineCount: text.getBoundingClientRect().height / parseFloat(style.lineHeight),
        fontSize: parseFloat(style.fontSize),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth
      };
    });
    expect(layout.insideShell).toBe(true);
    expect(layout.overlapsAssistant).toBe(false);
    expect(layout.lineCount).toBeLessThanOrEqual(2.1);
    expect(layout.fontSize).toBeGreaterThanOrEqual(15);
    expect(layout.horizontalOverflow).toBe(false);
  }
});

test("identity rejects impossible calendar dates instead of accepting format alone", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("IDENTITY_VERIFICATION", { force: true });
  await page.locator('[name="dob"]').fill("02 / 30 / 1954");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert")).toHaveText("Enter a valid date as MM / DD / YYYY and a 5-digit ZIP code.");
  await expect(page.getByRole("heading", { name: "Let’s securely confirm it’s you" })).toBeVisible();
});

test("traditional consent keeps a personal representative separate from the patient", async ({ page }) => {
  await page.goto("/?scenario=representative");
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await expect(page.locator(".signer-role")).toContainText("Personal representative");
  await expect(page.getByText(/on behalf of the patient, to enroll the patient in this recommended care/)).toBeVisible();
  await expect(page.getByLabel(/authorized to make healthcare decisions for the patient/)).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText("I want to receive this recommended care");
  const cta = page.getByRole("button", { name: "Enroll now" });
  await expect(cta).toBeDisabled();
  await page.getByLabel(/authorized to make healthcare decisions for the patient/).check();
  await page.getByLabel(/I have reviewed this information/).check();
  await page.getByLabel(/on behalf of the patient, to enroll the patient in the services/).check();
  await expect(cta).toBeEnabled();
});

test("condition-specific setup never invents hypertension when another condition is selected", async ({ page }) => {
  await page.goto("/?admin=1");
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption("Provider / Practice Referral");
  await page.locator('summary[aria-label="Condition"]').click();
  await page.getByRole("group", { name: /Clinical conditions/ }).getByText("Hypertension", { exact: true }).click();
  await page.getByRole("group", { name: /Clinical conditions/ }).getByText("Diabetes", { exact: true }).click();
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await page.locator("#screen-select").selectOption("ACCESS_MEASURE", { force: true });
  await expect(page.getByRole("heading", { name: "Your blood sugar starting point" })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText("blood pressure");

  await page.goto("/?admin=1");
  await page.getByRole("radio", { name: "CCM", exact: true }).check({ force: true });
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption("Physician Referral");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await page.locator("#screen-select").selectOption("CLINICAL_VERIFICATION", { force: true });
  await expect(page.locator(".known-data")).toContainText("Diabetes");
  await expect(page.locator(".known-data")).not.toContainText("High blood pressure");
});

test("prototype cards and scenario summary remain usable across tablet and desktop", async ({ page }) => {
  for (const viewport of [{ width: 768, height: 1024 }, { width: 1366, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/?admin=1");
    const audit = await page.evaluate(() => {
      const cards = [...document.querySelectorAll(".program-option>span")];
      const heights = cards.map(card => Math.round(card.getBoundingClientRect().height));
      const summary = document.querySelector(".scenario-summary strong");
      const controlStyle = name => {
        const control = document.querySelector(`select[name="${name}"]`);
        const rect = control.getBoundingClientRect();
        const style = getComputedStyle(control);
        return { height: rect.height, padding: style.padding, fontSize: style.fontSize, border: style.border, borderRadius: style.borderRadius };
      };
      return {
        programCount: cards.length,
        equalHeights: new Set(heights).size === 1,
        summaryWraps: getComputedStyle(summary).whiteSpace === "normal",
        overflow: document.documentElement.scrollWidth > innerWidth,
        coverage: controlStyle("coverage"),
        language: controlStyle("language")
      };
    });
    expect(audit.programCount).toBe(8);
    expect(audit.equalHeights).toBe(true);
    expect(audit.summaryWraps).toBe(viewport.width <= 860);
    expect(audit.overflow).toBe(false);
    expect(audit.language).toEqual(audit.coverage);
  }
});

test("patient experience uses a centered 384px mobile shell on desktop and full width on phones", async ({ page }) => {
  for (const width of [1366, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?admin=1");
    const configurator = page.locator(".prototype-console");
    await expect(configurator).toBeVisible();
    const configuratorWidth = await configurator.evaluate(element => element.getBoundingClientRect().width);
    expect(configuratorWidth).toBeGreaterThan(900);
    await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
    const shell = page.locator(".patient-app-shell");
    await expect(shell).toBeVisible();
    // Home presents EMMI as her introduction card; whichever presentation is painted has to stay
    // inside the patient shell rather than float over the desktop configurator.
    await expect(page.locator(".emmi-welcome")).toBeVisible();
    const layout = await shell.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const emmi = [...document.querySelectorAll(".emmi-assistant, .emmi-welcome, .emmi-guide")]
        .filter(node => node.getClientRects().length)
        .map(node => node.getBoundingClientRect());
      return {
        width: rect.width,
        centered: Math.abs((rect.left + rect.right) / 2 - innerWidth / 2) < 1,
        minHeight: rect.height,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        emmiCount: emmi.length,
        emmiInside: emmi.every(box => box.left >= rect.left - 1 && box.right <= rect.right + 1)
      };
    });
    expect(layout.width).toBeCloseTo(384, 0);
    expect(layout.centered).toBe(true);
    expect(layout.minHeight).toBeGreaterThanOrEqual(844);
    expect(layout.horizontalOverflow).toBe(false);
    expect(layout.emmiCount, "one EMMI presentation at a time").toBe(1);
    expect(layout.emmiInside).toBe(true);

    // Expanded EMMI is a sheet over the patient experience, not over the whole desktop app.
    await openEmmiConversation(page);
    const panel = await page.locator(".assistant-layer").evaluate(layer => {
      const rect = layer.getBoundingClientRect();
      const shellRect = document.querySelector(".patient-app-shell").getBoundingClientRect();
      return { width: rect.width, insideShell: rect.left >= shellRect.left - 1 && rect.right <= shellRect.right + 1 };
    });
    expect(panel.width).toBeCloseTo(384, 0);
    expect(panel.insideShell).toBe(true);
    await page.locator(".assistant-close").click();
  }

  for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }, { width: 393, height: 852 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/?scenario=access-happy");
    await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
    const layout = await page.locator(".patient-app-shell").evaluate(element => {
      const rect = element.getBoundingClientRect();
      const emmi = [...document.querySelectorAll(".emmi-assistant, .emmi-welcome, .emmi-guide")]
        .filter(node => node.getClientRects().length)
        .map(node => node.getBoundingClientRect());
      return {
        width: rect.width,
        viewportWidth: innerWidth,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        naturalPageScroll: document.documentElement.scrollHeight > innerHeight,
        shellHasInternalScroll: element.scrollHeight > element.clientHeight + 1,
        emmiInside: emmi.length > 0 && emmi.every(box => box.left >= rect.left - 1 && box.right <= rect.right + 1)
      };
    });
    expect(layout.width).toBeCloseTo(layout.viewportWidth, 0);
    expect(layout.horizontalOverflow).toBe(false);
    expect(layout.naturalPageScroll).toBe(true);
    expect(layout.shellHasInternalScroll).toBe(false);
    expect(layout.emmiInside).toBe(true);
  }
});

test("all traditional programs complete their implemented patient journey", async ({ page }) => {
  test.setTimeout(120000);
  for (const program of ["CCM", "RPM", "CCM + RPM", "PCM", "PCM + RPM", "ASM", "APCM"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?admin=1");
    await page.getByRole("radio", { name: program, exact: true }).check({ force: true });
    await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption("Physician Referral");
    const coverage = page.getByRole("combobox", { name: /Coverage/ });
    await coverage.selectOption("Medicare Advantage");
    await expect(coverage).toHaveValue("Medicare Advantage");
    await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
    await page.getByRole("button", { name: "Start your care journey" }).click();
    await page.getByRole("radio", { name: /For myself/ }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Your recommended care" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    const friendlyProgramName = {
      CCM: "Chronic Care Management (CCM)",
      RPM: "Remote Patient Monitoring (RPM)",
      "CCM + RPM": "Chronic Care Management + Remote Patient Monitoring",
      PCM: "Principal Care Management (PCM)",
      "PCM + RPM": "Principal Care Management + Remote Patient Monitoring",
      ASM: "Advanced Specialty Management (ASM)",
      APCM: "Advanced Primary Care Management (APCM)"
    }[program];
    await expect(page.getByRole("heading", { name: "About your care" })).toBeVisible();
    await expect(page.getByRole("heading", { name: friendlyProgramName, exact: true })).toBeVisible();
    await expect(page.locator("#screen-content")).not.toContainText(/CCM_RPM|PCM_RPM/);
    const importantInformationCta = page.getByRole("button", { name: "Continue" });
    await expect(importantInformationCta).toBeDisabled();
    await page.getByLabel(/I have reviewed this information/).check();
    await expect(importantInformationCta).toBeEnabled();
    await importantInformationCta.click();
    await expect(page.getByRole("heading", { name: "Review and agree", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: friendlyProgramName, exact: true })).toBeVisible();
    await page.getByLabel(/I have reviewed this information/).check();
    await page.getByLabel(/agree to enroll in the services listed above/).check();
    await page.getByRole("button", { name: "Enroll now" }).click();
    await expect(page.getByText("Enrollment confirmed", { exact: true })).toBeVisible({ timeout: 5000 });

    const includesRpm = program.includes("RPM");
    if (includesRpm) {
      await page.getByRole("button", { name: program === "RPM" ? "Set up my monitor" : "Continue getting started" }).click();
      await expect(page.getByRole("heading", { name: "Let’s prepare your home monitor" })).toBeVisible();
      await page.locator('.choice-card:has(input[value="owned"])').click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "My monitor is connected" }).click();
      await page.getByRole("button", { name: "I took my reading" }).click();
      await expect(page.getByRole("heading", { name: "Home monitoring is ready" })).toBeVisible({ timeout: 5000 });
    } else {
      // The post-enrollment CTA comes from resolveNextBestAction, so it differs per program.
      await page.getByRole("button", { name: program === "CCM" ? "Set up my care" : "Continue getting started" }).click();
      await page.getByRole("button", { name: "Save and continue" }).click();
      const completion = page.getByRole("heading", { name: "You’re off to a great start" });
      // The care-setup modules vary by program, so advance until the completion screen appears.
      for (let step = 0; step < 6 && !(await completion.isVisible()); step += 1) {
        await page.getByRole("button", { name: "Continue", exact: true }).click();
      }
      await expect(completion).toBeVisible();
    }
    await expect(page.locator("#screen-content")).not.toContainText(/ACCESS Eligibility|ACCESS Model|Check my eligibility/);
  }
});

test("ACCESS screens stay readable and free of horizontal overflow at required mobile viewports", async ({ page }) => {
  const runtimeErrors = [];
  page.on("console", message => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  const viewports = [
    { width: 320, height: 780 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 393, height: 852 },
    { width: 430, height: 932 }
  ];
  const screens = ["INVITATION", "DECISION_MAKER", "IDENTITY_VERIFICATION", "CARE_RECOMMENDATION", "ACCESS_PRE_ELIGIBILITY_NOTICE", "ACCESS_ELIGIBILITY_PROCESSING", "ACCESS_ELIGIBILITY_RESULT", "CONSENT_REVIEW", "ACCESS_ALIGNMENT_PROCESSING", "ENROLLMENT_CONFIRMED", "ACCESS_BASELINE", "ACCESS_MEASURE", "ONBOARDING_COMPLETE"];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/?scenario=access-happy");
    for (const screen of screens) {
      await page.locator("#screen-select").selectOption(screen, { force: true });
      const audit = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        headingSize: Number.parseFloat(getComputedStyle(document.querySelector("h1")).fontSize),
        shortTargets: [...document.querySelectorAll("button,a.button,input,select,summary")]
          .filter(element => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && rect.width > 0 && rect.height > 0 && rect.height < 44;
          })
          .map(element => `${element.tagName}:${element.textContent.trim().slice(0, 30)}`)
      }));
      expect(audit.overflow, `${screen} overflows at ${viewport.width}px`).toBe(false);
      expect(audit.headingSize, `${screen} heading is too small`).toBeGreaterThanOrEqual(28);
      expect(audit.shortTargets, `${screen} has undersized touch targets`).toEqual([]);
    }
  }
  expect(runtimeErrors).toEqual([]);
});

test("mobile cards use the full content width", async ({ page }) => {
  const checks = [
    ["CARE_RECOMMENDATION", [".card-list", ".note"]],
    ["ACCESS_PRE_ELIGIBILITY_NOTICE", [".access-precheck-list"]],
    ["CONSENT_REVIEW", [".consent-summary", ".access-consent-terms"]],
    ["DECISION_MAKER", [".choice-list"]]
  ];
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/?scenario=access-happy");
    for (const [screen, selectors] of checks) {
      await page.locator("#screen-select").selectOption(screen, { force: true });
      const layout = await page.evaluate(selectorList => {
        const container = document.querySelector("#screen-content");
        const style = getComputedStyle(container);
        const available = container.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
        return selectorList.map(selector => {
          const element = container.querySelector(selector);
          return { selector, width: element?.getBoundingClientRect().width || 0, available };
        });
      }, selectors);
      for (const item of layout) {
        expect(item.width, `${screen} ${item.selector} should fill the ${width}px mobile content area`).toBeGreaterThanOrEqual(item.available - 1);
        expect(item.width, `${screen} ${item.selector} should not exceed the ${width}px mobile content area`).toBeLessThanOrEqual(item.available + 1);
      }
    }
  }
});

test("core mobile screens tolerate 125 and 150 percent content scaling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/?scenario=access-happy");
  for (const scale of [1.25, 1.5]) {
    for (const screen of ["IDENTITY_VERIFICATION", "CARE_RECOMMENDATION", "ACCESS_PRE_ELIGIBILITY_NOTICE", "CONSENT_REVIEW"]) {
      await page.locator("#screen-select").selectOption(screen, { force: true });
      await page.evaluate(value => { document.documentElement.style.fontSize = `${value * 100}%`; }, scale);
      const audit = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        clipped: [...document.querySelectorAll("h1,.lead,.info-row,.check-row,.button")].some(element => element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).whiteSpace === "nowrap")
      }));
      expect(audit.overflow, `${screen} overflows at ${scale * 100}%`).toBe(false);
      expect(audit.clipped, `${screen} clips content at ${scale * 100}%`).toBe(false);
    }
  }
});

test("patient screens share one page gutter and one content column", async ({ page }) => {
  const viewports = [
    { width: 384, height: 824, gutter: [14, 17] },
    { width: 360, height: 800, gutter: [11, 13] },
    { width: 375, height: 812, gutter: [14, 16] },
    { width: 390, height: 844, gutter: [14, 17] },
    { width: 393, height: 852, gutter: [14, 17] },
    { width: 412, height: 915, gutter: [15, 17] },
    { width: 430, height: 932, gutter: [15, 17] }
  ];
  const screens = ["INVITATION", "DECISION_MAKER", "IDENTITY_VERIFICATION", "CARE_RECOMMENDATION", "ACCESS_PRE_ELIGIBILITY_NOTICE", "CONSENT_REVIEW", "ENROLLMENT_CONFIRMED", "ACCESS_BASELINE", "ONBOARDING_COMPLETE"];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/?scenario=access-happy");
    for (const screen of screens) {
      await page.locator("#screen-select").selectOption(screen, { force: true });
      const layout = await page.evaluate(() => {
        // Some screens wrap their content in a single structural div; measure inside it.
        const root = document.querySelector("#screen-content > .enrollment-welcome-screen") || document.querySelector("#screen-content");
        // Full-width members of the page column. Centred art and inline text links are excluded:
        // they are deliberately not part of the column.
        const columns = [...root.querySelectorAll(":scope > .next-card, :scope > .disclosure-card, :scope > .consent-summary, :scope > .choice-list, :scope > .button.primary, :scope > .actions, :scope > .card-list, :scope > .emmi-welcome, :scope > .invitation-benefits, :scope > .invitation-stage, :scope > .optional-support, :scope > .access-precheck-list, :scope > form, :scope > h1")];
        const rects = columns.map(node => node.getBoundingClientRect()).filter(rect => rect.width > 60);
        const lefts = rects.map(rect => rect.left);
        const rights = rects.map(rect => rect.right);
        return {
          measured: rects.length,
          left: Math.min(...lefts),
          leftSpread: Math.max(...lefts) - Math.min(...lefts),
          rightSpread: Math.max(...rights) - Math.min(...rights),
          rightGutter: innerWidth - Math.max(...rights),
          overflow: document.documentElement.scrollWidth > innerWidth
        };
      });
      expect(layout.measured, `${screen} @${viewport.width}`).toBeGreaterThan(0);
      expect(layout.overflow, `${screen} @${viewport.width} overflow`).toBe(false);
      // Every column member starts and ends on the same coordinate (subpixel rounding only).
      expect(layout.leftSpread, `${screen} @${viewport.width} left`).toBeLessThanOrEqual(1.5);
      expect(layout.rightSpread, `${screen} @${viewport.width} right`).toBeLessThanOrEqual(1.5);
      expect(layout.left, `${screen} @${viewport.width} gutter`).toBeGreaterThanOrEqual(viewport.gutter[0]);
      expect(layout.left).toBeLessThanOrEqual(viewport.gutter[1]);
      expect(Math.abs(layout.left - layout.rightGutter), `${screen} @${viewport.width} symmetry`).toBeLessThanOrEqual(1.5);
    }
  }
});

test("the floating assistant never covers an action once the patient reaches it", async ({ page }) => {
  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/?scenario=access-happy");
    for (const screen of ["INVITATION", "DECISION_MAKER", "IDENTITY_VERIFICATION", "CONSENT_REVIEW", "ENROLLMENT_CONFIRMED", "ONBOARDING_COMPLETE"]) {
      await page.locator("#screen-select").selectOption(screen, { force: true });
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const covered = await page.evaluate(() => {
        const assistant = document.querySelector(".emmi-assistant");
        if (!assistant || getComputedStyle(assistant).display === "none") return false;
        const box = assistant.getBoundingClientRect();
        return [...document.querySelectorAll("#screen-content .actions .button, #screen-content .button.primary, #screen-content a, #screen-content input, #screen-content select")]
          .some(node => {
            const rect = node.getBoundingClientRect();
            return rect.width && box.right > rect.left && box.left < rect.right && box.bottom > rect.top && box.top < rect.bottom;
          });
      });
      expect(covered, `${screen} @${viewport.width}`).toBe(false);
    }
  }
});

test("patient screens end with their content instead of an empty scroll tail", async ({ page }) => {
  const viewports = [
    // 384x824 is the primary mobile reference (Samsung Galaxy S25 Ultra).
    { width: 384, height: 824 },
    { width: 360, height: 800 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 430, height: 932 }
  ];
  const screens = ["INVITATION", "DECISION_MAKER", "IDENTITY_VERIFICATION", "CARE_RECOMMENDATION", "ACCESS_PRE_ELIGIBILITY_NOTICE", "CONSENT_REVIEW", "ENROLLMENT_CONFIRMED", "ACCESS_BASELINE", "ONBOARDING_COMPLETE"];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/?scenario=access-happy");
    for (const screen of screens) {
      await page.locator("#screen-select").selectOption(screen, { force: true });
      const audit = await page.evaluate(() => {
        window.scrollTo(0, 0);
        const root = document.querySelector("#screen-content");
        const meaningful = [...root.querySelectorAll("*")].filter(node => {
          const style = getComputedStyle(node);
          if (style.display === "none" || style.visibility === "hidden" || style.position === "fixed") return false;
          const rect = node.getBoundingClientRect();
          return rect.height > 4 && rect.width > 4 && (node.textContent.trim() || node.tagName === "IMG" || node.tagName === "BUTTON");
        });
        const contentBottom = Math.max(...meaningful.map(node => node.getBoundingClientRect().bottom));
        const documentHeight = document.documentElement.scrollHeight;
        return {
          // Only counts when the page actually scrolls: a viewport taller than the content is
          // the device, not manufactured height.
          scrolls: documentHeight > innerHeight + 1,
          tail: documentHeight - contentBottom,
          bottomPadding: parseFloat(getComputedStyle(root).paddingBottom)
        };
      });
      if (audit.scrolls) {
        // Nothing below the last meaningful element but the single closing gap.
        expect(audit.tail, `${screen} @${viewport.width}x${viewport.height} empty scroll tail`).toBeLessThanOrEqual(audit.bottomPadding + 8);
      }
      expect(audit.bottomPadding, `${screen} @${viewport.width} bottom padding`).toBeLessThanOrEqual(48);
    }
  }
});
