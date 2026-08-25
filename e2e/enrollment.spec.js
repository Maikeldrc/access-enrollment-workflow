import { test, expect } from "@playwright/test";

test("prototype setup shows defaults and conditional fields", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Configure the patient scenario" })).toBeVisible();
  const eligibilityResult = page.getByRole("combobox", { name: /ACCESS Eligibility Result/ });
  await expect(eligibilityResult).toHaveValue("eligible");
  await expect(page.getByText("ACCESS · eCKM · ITERA Direct Outreach · Hypertension · Original Medicare · Eligible · English")).toBeVisible();
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
  await page.goto("/");
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
  await page.goto("/");
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
  await expect(page.locator(".scenario-summary")).toContainText("ACCESS · eCKM · Provider / Practice Referral · Dr. Rivera · Hypertension · Original Medicare · Eligible · English");
});

test("prototype ACCESS eligibility setting drives a terminal not-eligible patient journey", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("combobox", { name: /ACCESS Eligibility Result/ }).selectOption("notEligible");
  await expect(page.locator(".scenario-summary")).toContainText("Not eligible");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.locator("#screen-content")).not.toContainText(/ACCESS Eligibility Result|simulation|mock API|Not eligible scenario/i);

  await page.locator("#screen-select").selectOption("ACCESS_PRE_ELIGIBILITY_NOTICE", { force: true });
  await page.getByLabel("I acknowledge this information and want to continue").check();
  await page.getByRole("button", { name: "Check my eligibility" }).click();
  await expect(page.getByRole("heading", { name: "This ACCESS care option isn’t available to you right now" })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Based on the Medicare eligibility check, you can’t continue with ACCESS enrollment at this time.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What can I do?" })).toBeVisible();
  await expect(page.getByText("We can answer questions and review other care support that may be available.")).toBeVisible();
  await expect(page.getByText("Request a callback", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Talk with our care team" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Return to start" })).toBeVisible();
  await expect(page.locator('.contextual-assurance[data-assurance-type="NOT_ELIGIBLE_REASSURANCE"]')).toContainText("This does not change your Medicare benefits");
  await expect(page.locator("#screen-select option")).toHaveText(["INVITATION", "DECISION_MAKER", "IDENTITY_VERIFICATION", "CARE_RECOMMENDATION", "HOW_CARE_WORKS", "ACCESS_PRE_ELIGIBILITY_NOTICE", "ACCESS_ELIGIBILITY_PROCESSING", "ACCESS_ELIGIBILITY_RESULT"]);
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
  await expect(page.locator(".assistant-back")).toBeVisible();
});

test("prototype setup previews and applies a custom physician photo", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/");
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
  await page.goto("/");
  await page.locator('summary[aria-label="Condition"]').click();
  await page.getByRole("group", { name: /Clinical conditions/ }).getByText("Diabetes", { exact: true }).click();
  await expect(page.locator(".condition-multiselect")).toHaveAttribute("open", "");
  await page.getByRole("group", { name: /Clinical conditions/ }).getByText("Heart Failure", { exact: true }).click();
  await expect(page.locator(".scenario-summary")).toContainText("Hypertension + Diabetes + Heart Failure");
  await expect(page.getByText("Other", { exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder("Enter condition")).toHaveCount(0);
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.getByRole("heading", { name: "A new care option for your health" })).toBeVisible();
  await page.locator("#screen-select").selectOption("CARE_RECOMMENDATION", { force: true });
  await expect(page.getByText("Regular support based on your health needs.")).toBeVisible();
});

test("condition selector requires at least one selection", async ({ page }) => {
  await page.goto("/");
  await page.locator('summary[aria-label="Condition"]').click();
  await page.getByRole("group", { name: /Clinical conditions/ }).getByText("Hypertension", { exact: true }).click();
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.getByRole("alert")).toHaveText("Select at least one condition.");
});

test("direct outreach launches without an individual physician claim", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.getByRole("heading", { name: "A new care option for your health" })).toBeVisible();
  await expect(page.locator(".invitation-stage")).toHaveAttribute("data-trust-source", "ITERA Direct Outreach");
  await expect(page.locator(".trust-hero-card")).toHaveAttribute("data-hero-variant", "ACCESS_PARTICIPANT");
  await expect(page.getByAltText("ITERA HEALTH connected Medicare ACCESS care")).toBeVisible();
  await expect(page.locator(".doctor-portrait")).toHaveCount(0);
  await expect(page.getByText("ITERA HEALTH is a Medicare ACCESS Participant providing extra support between your doctor visits — at no additional cost to you.")).toBeVisible();
  await page.locator("#screen-select").selectOption("CARE_RECOMMENDATION", { force: true });
  await expect(page.getByText("ITERA helps coordinate your care with your existing doctors.")).toBeVisible();
  await page.locator("#screen-select").selectOption("HOW_CARE_WORKS", { force: true });
  await expect(page.getByText("ITERA HEALTH supports your ACCESS care and coordinates with your existing doctors.", { exact: true })).toBeVisible();
  await expect(page.locator(".care-works-physician")).toHaveCount(0);
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await expect(page.getByText("I agree to receive ACCESS care from ITERA HEALTH.", { exact: true })).toBeVisible();
  await expect(page.locator(".access-consent-care-team .provider-card")).toHaveCount(0);
  await expect(page.locator("#screen-content")).not.toContainText("Dr. Fresner");

  await page.goto("/");
  await page.getByRole("radio", { name: "CCM", exact: true }).check({ force: true });
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.getByText("ITERA HEALTH invites you to learn about additional support available through Medicare.")).toBeVisible();
  await expect(page.locator(".invitation-copy")).not.toContainText("Medicare ACCESS Participant providing extra support");
});

test("trust hero cards omit the ITERA logo and keep language near the top edge", async ({ page }) => {
  await page.goto("/");
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
  await page.getByRole("button", { name: "See how it works" }).click();
  const checks = [
    ["DECISION_MAKER", "Who’s completing"],
    ["CARE_RECOMMENDATION", "Your care"],
    ["ACCESS_ELIGIBILITY_RESULT", "Eligibility"],
    ["DISCLOSURE", "Important information"],
    ["CONSENT_REVIEW", "Consent"],
    ["ACCESS_BASELINE", "Getting started"]
  ];
  for (const [screen, stage] of checks) {
    await page.locator("#screen-select").selectOption(screen, { force: true });
    const meta = page.locator(".progress-meta");
    await expect(meta.locator("span").first()).toHaveText("Enrollment");
    await expect(meta.locator("span").last()).toHaveText(stage);
    await expect(meta).not.toContainText(/step|\d+\s*(?:of|\/)\s*\d+/i);
    const progress = page.getByRole("progressbar", { name: "Enrollment progress" });
    await expect(progress).toHaveAttribute("aria-valuemax", "100");
    await expect(progress).toHaveAttribute("aria-valuetext", stage);
  }
});

test("ACCESS disclosure is clear, conditional, and requires review before continuing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("DISCLOSURE", { force: true });

  await expect(page.locator(".progress-meta span").first()).toHaveText("Enrollment");
  await expect(page.locator(".progress-meta span").last()).toHaveText("Important information");
  await expect(page.getByRole("heading", { name: "About your recommended care" })).toBeVisible();
  await expect(page.locator(".access-disclosure-card > h2")).toHaveText("ACCESS");
  await expect(page.locator(".access-disclosure-row")).toHaveCount(5);
  await expect(page.getByText("Participation is voluntary", { exact: true })).toBeVisible();
  await expect(page.getByText("You choose whether to enroll in ACCESS with ITERA HEALTH.", { exact: true })).toBeVisible();
  await expect(page.getByText("Your Medicare benefits stay the same", { exact: true })).toBeVisible();
  await expect(page.getByText("Your decision to enroll or not enroll does not affect your Medicare benefits.", { exact: true })).toBeVisible();
  await expect(page.getByText("$0 ACCESS cost-sharing from ITERA HEALTH.", { exact: true })).toBeVisible();
  await expect(page.getByText("One ACCESS provider per care track", { exact: true })).toBeVisible();
  await expect(page.getByText("Beginning 90 days after enrollment, you may end your ACCESS participation or switch to another participating provider.", { exact: true })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText("You may stop participating at any time");
  await expect(page.getByText("Medicare claims information", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Connected device information", { exact: true })).toHaveCount(0);

  const continueButton = page.getByRole("button", { name: "Continue" });
  await expect(continueButton).toBeDisabled();
  await page.getByLabel("I have reviewed this information").check();
  await expect(continueButton).toBeEnabled();
  await expect(page.locator('.contextual-assurance[data-assurance-type="ENROLLMENT_CHOICE"]')).toContainText("You choose whether to enroll");

  await page.getByText("View full information", { exact: false }).click();
  await expect(page.getByText(/Review the complete ACCESS information/)).toBeVisible();
  await page.locator(".emmi-assistant").click();
  for (const question of ["What does voluntary mean?", "Will my Medicare benefits change?", "Will this cost me anything?", "Can I change ACCESS providers?"]) {
    await expect(page.getByRole("button", { name: question })).toBeVisible();
  }

  const typography = await page.locator(".access-disclosure-screen").evaluate(screen => ({
    headline: Math.min(...[...screen.querySelectorAll(".access-disclosure-row strong")].map(element => parseFloat(getComputedStyle(element).fontSize))),
    copy: Math.min(...[...screen.querySelectorAll(".access-disclosure-row p")].map(element => parseFloat(getComputedStyle(element).fontSize))),
    checkbox: parseFloat(getComputedStyle(screen.querySelector(".check-row")).fontSize),
    buttonHeight: screen.querySelector('.actions [data-action="next"]').getBoundingClientRect().height,
    overflow: document.documentElement.scrollWidth > innerWidth
  }));
  expect(typography.headline).toBeGreaterThanOrEqual(17);
  expect(typography.copy).toBeGreaterThanOrEqual(16);
  expect(typography.checkbox).toBeGreaterThanOrEqual(16);
  expect(typography.buttonHeight).toBeGreaterThanOrEqual(48);
  expect(typography.overflow).toBe(false);
});

test("ACCESS disclosure renders configured cost, claims, and device information", async ({ page }) => {
  await page.goto("/?scenario=access-disclosure-configured");
  await page.locator("#screen-select").selectOption("DISCLOSURE", { force: true });
  await expect(page.getByText("Your cost may be up to $35 per month.", { exact: true })).toBeVisible();
  await expect(page.getByText("Medicare claims information", { exact: true })).toBeVisible();
  await expect(page.getByText("Medicare may share claims information with ITERA HEALTH to help coordinate your ACCESS care.", { exact: true })).toBeVisible();
  await expect(page.getByText("Connected device information", { exact: true })).toBeVisible();
  await expect(page.getByText("A connected device may be used to support your ACCESS care. Your care team will explain what is required.", { exact: true })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText("$0 ACCESS cost-sharing");
});

test("ACCESS patient agreement is role-aware, readable, and continues through CMS Alignment", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });

  await expect(page.locator(".progress-meta span").last()).toHaveText("Consent");
  await expect(page.getByRole("heading", { name: "Review and agree" })).toBeVisible();
  await expect(page.getByText("I agree to receive ACCESS care from ITERA HEALTH, with support coordinated with Dr. Fresner.", { exact: true })).toBeVisible();
  await expect(page.locator(".access-consent-care-team")).toContainText("Dr. Fresner ✓");
  await expect(page.locator(".access-consent-care-team")).toContainText("Your doctor");
  await expect(page.locator(".access-consent-care-team")).toContainText("ACCESS care provider");
  await expect(page.locator(".access-care-chip")).toHaveText(/ACCESS care for high blood pressure/);
  await expect(page.locator(".consent-disclosure-row")).toHaveCount(5);
  await expect(page.getByText("Participation is voluntary", { exact: true })).toBeVisible();
  await expect(page.getByText("Your Medicare benefits, coverage, and rights do not change.", { exact: true })).toBeVisible();
  await expect(page.getByText("$0 per month", { exact: true })).toBeVisible();
  await expect(page.getByText("One ACCESS provider per care track", { exact: true })).toBeVisible();
  await expect(page.getByText("Beginning 90 days after enrollment, you may end your ACCESS participation or switch to another participating provider.", { exact: true })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText("Your regular Medicare benefits and cost-sharing continue to apply");
  await expect(page.locator("#screen-content")).not.toContainText("You may stop participating at any time");
  await expect(page.locator(".signer-role")).toHaveText("Signing as: Patient");
  await expect(page.getByLabel(/authorized to make healthcare decisions/)).toHaveCount(0);

  const cta = page.getByRole("button", { name: "Agree and continue" });
  await expect(cta).toBeDisabled();
  await page.getByLabel("I have reviewed this important information").check();
  await expect(cta).toBeDisabled();
  await page.getByLabel("I agree to enroll in ACCESS with ITERA HEALTH.").check();
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
});

test("ACCESS personal representative must complete the authority attestation", async ({ page }) => {
  await page.goto("/?scenario=access-representative");
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await expect(page.getByText("I agree, on behalf of the patient, to enroll the patient in ACCESS with ITERA HEALTH.", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".signer-role")).toHaveText("Signing as: Personal representative");
  const authority = page.getByLabel("I confirm that I’m authorized to make healthcare decisions for the patient.");
  const reviewed = page.getByLabel("I have reviewed this important information");
  const agreement = page.getByLabel("I agree, on behalf of the patient, to enroll the patient in ACCESS with ITERA HEALTH.");
  const cta = page.getByRole("button", { name: "Agree and continue" });
  await reviewed.check();
  await agreement.check();
  await expect(cta).toBeDisabled();
  await authority.check();
  await expect(cta).toBeEnabled();
});

test("ACCESS agreement renders configured cost and claims information", async ({ page }) => {
  await page.goto("/?scenario=access-disclosure-configured");
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await expect(page.getByText("Up to $35 per month", { exact: true })).toBeVisible();
  await expect(page.getByText("Medicare claims information", { exact: true })).toBeVisible();
  await expect(page.getByText("Medicare may share claims information with ITERA HEALTH to help coordinate your ACCESS care.", { exact: true })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText("$0 per month");
});

test("role selection branches only personal representatives into representative details", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=access-happy");
  await page.getByRole("button", { name: "See how it works" }).click();

  await expect(page.getByRole("heading", { name: "Who is completing this?" })).toBeVisible();
  await expect(page.locator(".progress-meta span").last()).toHaveText("Who’s completing");
  await expect(page.getByText("Choose the option that best describes you.")).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Let’s confirm the patient’s identity" })).toBeVisible();
  const representativeDraft = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(representativeDraft).toMatchObject({ completionRole: "personalRepresentative", representativeFullName: "Maria Fresner", representativeRelationship: "child", representativeAuthorityType: "healthcarePowerOfAttorney", representativePhone: "3055550123", phoneVerified: true, phoneVerificationMethod: "SMS_OTP", representativeAuthorityAttested: true, authorityAttestation: true, authorityVerificationMethod: "SELF_ATTESTATION" });
  expect(representativeDraft.phoneVerifiedAt).toBeTruthy();
  expect(representativeDraft.authorityAttestedAt).toBeTruthy();
  expect(representativeDraft.sessionId).toBeTruthy();
  expect(JSON.stringify(representativeDraft)).not.toContain("123456");
  expect(representativeDraft.audit.map(event => event.eventType)).toEqual(expect.arrayContaining(["completion_role_selected", "representative_details_confirmed", "representative_phone_otp_sent", "representative_phone_otp_verified", "representative_authority_attested"]));
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await page.getByLabel("I confirm that I’m authorized to make healthcare decisions for the patient.").check();
  await page.getByLabel("I have reviewed this important information").check();
  await page.getByLabel("I agree, on behalf of the patient, to enroll the patient in ACCESS with ITERA HEALTH.").check();
  await page.getByRole("button", { name: "Agree and continue" }).click();
  await expect(page.getByRole("heading", { name: "Completing your enrollment with Medicare" })).toBeVisible();
  const consentDraft = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(consentDraft).toMatchObject({ consentRole: "PERSONAL_REPRESENTATIVE", consentVersion: "2.1" });
  expect(consentDraft.consentTimestamp).toBeTruthy();
  expect(consentDraft.audit.map(event => event.eventType)).toContain("consent_saved");
  await page.locator("#screen-select").selectOption("IDENTITY_VERIFICATION", { force: true });
  await expect(page.getByText("Please enter the patient’s date of birth and ZIP code.")).toBeVisible();
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
  await expect(page.getByText("I agree, on behalf of the patient, to enroll the patient in ACCESS with ITERA HEALTH.", { exact: true }).first()).toBeVisible();

  await page.evaluate(() => localStorage.removeItem("itera.enrollment.safe-draft.v2"));
  await page.goto("/?scenario=access-happy");
  await page.getByRole("button", { name: "See how it works" }).click();
  await page.getByText("Helping the patient", { exact: true }).locator("..").locator("..").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Let’s confirm it’s you" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "About you" })).toHaveCount(0);
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await expect(page.locator(".signer-role")).toContainText("Signing as: Patient");

  await page.evaluate(() => localStorage.removeItem("itera.enrollment.safe-draft.v2"));
  await page.goto("/?scenario=access-happy");
  await page.getByRole("button", { name: "See how it works" }).click();
  await page.getByText("For myself", { exact: true }).locator("..").locator("..").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Let’s confirm it’s you" })).toBeVisible();
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
    const layout = await page.locator(".representative-details-screen").evaluate(screen => {
      const assistant = document.querySelector(".emmi-assistant").getBoundingClientRect();
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

test("recommended care is patient-friendly, contextual, and assistant-accessible", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("CARE_RECOMMENDATION", { force: true });
  await expect(page.getByRole("heading", { name: "Your recommended care" })).toBeVisible();
  await expect(page.getByText("Based on your health needs, your recommended care includes:")).toBeVisible();
  await expect(page.getByText("Regular support to help manage your blood pressure.")).toBeVisible();
  await expect(page.getByText("Goals and next steps for your health.")).toBeVisible();
  await expect(page.getByText("Help keeping treatment on track.")).toBeVisible();
  await expect(page.getByText("ITERA coordinates with Dr. Fresner.")).toBeVisible();
  await expect(page.getByText("These services work together as part of your recommended care.")).toBeVisible();
  await expect(page.locator(".recommendation-screen")).not.toContainText(/\b(?:CCM|RPM|PCM|CPT)\b/);
  await expect(page.locator(".progress-meta span").last()).toHaveText("Your care");
  const assistant = page.locator(".emmi-assistant");
  await expect(assistant).toBeVisible();
  const layout = await page.locator(".recommendation-screen").evaluate(screen => {
    const assistantRect = document.querySelector(".emmi-assistant").getBoundingClientRect();
    const important = [...screen.querySelectorAll(".info-row,.note,.actions")].map(element => element.getBoundingClientRect());
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
  await assistant.click();
  await expect(page.getByRole("heading", { name: "Hi, I’m Emmi. How can I help?" })).toBeVisible();
  await expect(page.getByPlaceholder("Ask a question…")).toBeVisible();
  await expect(page.getByText("What does recommended care mean?")).toBeVisible();
  await expect(page.getByText("Will I keep seeing my doctor?")).toBeVisible();
  await expect(page.getByText("Talk to our care team")).toBeVisible();
  await expect(page.getByText("Call (305) 394-8070")).toBeVisible();
  await expect(page.getByText("Have someone call me")).toBeVisible();
});

test("recommended care avoids individual physician claims for practice outreach", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "CCM", exact: true }).check({ force: true });
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Practice Outreach" });
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await page.locator("#screen-select").selectOption("CARE_RECOMMENDATION", { force: true });
  await expect(page.getByText("ITERA works with your care team to coordinate your care.")).toBeVisible();
  await expect(page.locator(".recommendation-screen")).not.toContainText("ITERA coordinates with Dr. Fresner.");
});

test("How your care works explains ACCESS coordination with a dynamic physician", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Provider / Practice Referral" });
  await page.getByPlaceholder("Enter physician name").fill("Dr. Humberto Machado Jr.");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await page.locator("#screen-select").selectOption("HOW_CARE_WORKS", { force: true });

  await expect(page.getByRole("heading", { name: "How your care works" })).toBeVisible();
  await expect(page.getByText("ITERA HEALTH works with Dr. Humberto Machado Jr. to support your ACCESS care.")).toBeVisible();
  const physicianCard = page.locator(".care-works-physician");
  await expect(physicianCard).toContainText("Dr. Humberto Machado Jr. ✓");
  await expect(physicianCard).toContainText("Your doctor");
  await expect(physicianCard).not.toContainText("Referring physician");
  await expect(page.getByText("We stay in touch and follow your care plan.")).toBeVisible();
  await expect(page.getByText("Get help with questions and next steps.")).toBeVisible();
  await expect(page.getByText("We share important updates with your doctor.")).toBeVisible();
  await expect(page.locator(".trust-note")).toContainText("ITERA provides additional support between doctor visits.");
  await expect(page.locator(".contextual-assurance")).toContainText("Your doctor remains part of your care");
  await expect(page.locator(".care-works-screen")).not.toContainText("I have questions");

  const layout = await page.locator(".care-works-screen").evaluate(screen => {
    const assistant = document.querySelector(".emmi-assistant").getBoundingClientRect();
    const protectedElements = [...screen.querySelectorAll(".info-row,.trust-note,.actions,.contextual-assurance")];
    const overlaps = protectedElements.some(element => {
      const rect = element.getBoundingClientRect();
      return !(assistant.right <= rect.left || assistant.left >= rect.right || assistant.bottom <= rect.top || assistant.top >= rect.bottom);
    });
    return {
      overlaps,
      descriptionFonts: [...screen.querySelectorAll(".info-row p")].map(element => parseFloat(getComputedStyle(element).fontSize)),
      descriptionLines: [...screen.querySelectorAll(".info-row p")].map(element => element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight)),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth
    };
  });
  expect(layout.overlaps).toBe(false);
  expect(Math.min(...layout.descriptionFonts)).toBeGreaterThanOrEqual(16);
  expect(Math.max(...layout.descriptionLines)).toBeLessThanOrEqual(2.1);
  expect(layout.horizontalOverflow).toBe(false);

  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await expect(page.getByText("I agree to receive ACCESS care from ITERA HEALTH, with support coordinated with Dr. Humberto Machado Jr.", { exact: true })).toBeVisible();
  await expect(page.locator(".access-consent-care-team")).toContainText("Dr. Humberto Machado Jr.");
  await page.locator("#screen-select").selectOption("ONBOARDING_COMPLETE", { force: true });
  await expect(page.getByText("You continue working with Dr. Humberto Machado Jr.", { exact: true })).toBeVisible();
});

test("recommended care adapts its support description to the configured condition", async ({ page }) => {
  const cases = [
    ["Diabetes", "Regular support to help manage your diabetes."],
    ["Heart Failure", "Regular support focused on your heart health."],
    ["Chronic Kidney Disease", "Regular support focused on your kidney health."]
  ];
  for (const [condition, description] of cases) {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("itera.prototype.config.v1"));
    await page.reload();
    await page.locator('summary[aria-label="Condition"]').click();
    const options = page.getByRole("group", { name: /Clinical conditions/ });
    await options.getByText("Hypertension", { exact: true }).click();
    await options.getByText(condition, { exact: true }).click();
    await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
    await page.locator("#screen-select").selectOption("CARE_RECOMMENDATION", { force: true });
    await expect(page.getByText(description)).toBeVisible();
  }
});

test("ACCESS provider or practice referral uses doctor recommendation with dynamic physician", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
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
  await expect(page.locator(".invitation-copy .lead")).toHaveText("Get extra support between your doctor visits — at no additional cost to you.");
  await expect(page.locator(".invitation-copy")).not.toContainText("care team invited you");
  await expect(page.locator(".invitation-benefit strong")).toHaveText(["Keep your doctors", "Get support from home", "Participation is voluntary"]);
  await expect(page.getByRole("button", { name: "See how it works" })).toBeVisible();
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
  await page.goto("/");
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
    await expect(page.locator(".emmi-assistant")).toBeVisible();
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
    await page.goto("/");
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

  await page.goto("/");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  audits.push(await audit());
  await page.goto("/");
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Provider / Practice Referral" });
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  audits.push(await audit());
  await page.goto("/");
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
      await page.goto("/");
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
  await page.goto("/");
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
      await page.goto("/");
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
  await page.goto("/");
  await page.getByRole("combobox", { name: /Language/ }).selectOption({ label: "Creole" });
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.getByRole("heading", { name: "Yon nouvo opsyon swen pou sante ou" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ht");
});

test("ACCESS patient experience stays complete and unmixed in EN, ES, and KR", async ({ page }) => {
  const locales = [
    { value: "en", label: "English", code: "EN", html: "en", heading: "A new care option for your health", identity: "Let’s confirm it’s you" },
    { value: "es", label: "Spanish", code: "ES", html: "es", heading: "Una nueva opción de cuidado para su salud", identity: "Confirmemos su identidad" },
    { value: "ht", label: "Creole", code: "KR", html: "ht", heading: "Yon nouvo opsyon swen pou sante ou", identity: "Ann konfime se ou" }
  ];
  for (const locale of locales) {
    await page.goto("/");
    await page.getByRole("combobox", { name: /Language/ }).selectOption(locale.value);
    await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
    await expect(page.getByRole("heading", { name: locale.heading })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", locale.html);
    await expect(page.locator(".stage-language")).toContainText(locale.code);
    await expect(page.locator("#app")).not.toContainText("⟦");

    await page.getByRole("button", { name: locale.value === "en" ? "See how it works" : locale.value === "es" ? "Vea cómo funciona" : "Gade kijan sa fonksyone" }).click();
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
    { clicks: 1, code: "ES", care: "Controles de salud periódicos", eligibility: "Elegibilidad", consent: "Revise y acepte", assistant: "Asistente de cuidado" },
    { clicks: 2, code: "KR", care: "Tcheke sante regilyèman", eligibility: "Elijibilite", consent: "Revize epi dakò", assistant: "Asistan swen" }
  ]) {
    await page.goto("/?scenario=access-happy");
    for (let i = 0; i < locale.clicks; i += 1) await page.locator(".stage-language").click();
    await page.locator("#screen-select").selectOption("CARE_RECOMMENDATION", { force: true });
    await expect(page.getByText(locale.care)).toBeVisible();
    await expect(page.locator("#app")).not.toContainText("⟦");
    await page.locator("#screen-select").selectOption("ACCESS_ELIGIBILITY_PROCESSING", { force: true });
    await expect(page.locator(".progress-meta span").last()).toHaveText(locale.eligibility);
    await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
    await expect(page.getByRole("heading", { name: locale.consent })).toBeVisible();
    await page.locator(".emmi-assistant").click();
    await expect(page.locator(".assistant-header")).toContainText(locale.assistant);
    await expect(page.locator("#app")).not.toContainText("⟦");
  }
});

test("ACCESS does not confirm enrollment at eligibility", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ACCESS_ELIGIBILITY_RESULT", { force: true });
  await expect(page.getByRole("heading", { name: "You’re eligible to continue" })).toBeVisible();
  await expect(page.getByText("You’re eligible to continue with this ACCESS care option. Your enrollment is not complete yet.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What happens next?" })).toBeVisible();
  await expect(page.getByText("Review important ACCESS information")).toBeVisible();
  await expect(page.getByText("Agree to enroll with ITERA HEALTH")).toBeVisible();
  await expect(page.getByText("We’ll complete your ACCESS enrollment with Medicare")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  await expect(page.locator('.contextual-assurance[data-assurance-type="NO_COMMITMENT_YET"]')).toContainText("You’ll review the details before you enroll");
  await expect(page.getByText("Enrollment confirmed")).toHaveCount(0);
  await expect(page.locator("#screen-content")).not.toContainText(/coverage is approved|Medicare approved your care|you’re enrolled|enrollment is confirmed/i);
  const assistant = page.locator(".emmi-assistant");
  await expect(assistant).toBeVisible();
  const layout = await page.locator("#screen-content").evaluate(screen => {
    const bot = document.querySelector(".emmi-assistant").getBoundingClientRect();
    const protectedElements = [...screen.querySelectorAll(".next-card,.actions,.contextual-assurance")];
    return {
      overlaps: protectedElements.some(element => {
        const rect = element.getBoundingClientRect();
        return !(bot.right <= rect.left || bot.left >= rect.right || bot.bottom <= rect.top || bot.top >= rect.bottom);
      }),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth
    };
  });
  expect(layout.overlaps).toBe(false);
  expect(layout.horizontalOverflow).toBe(false);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".progress-meta span").last()).toHaveText("Important information");
});

test("non-eligible ACCESS outcomes retain their existing Medicare reassurance", async ({ page }) => {
  for (const scenario of ["access-control", "access-not-eligible", "access-already-aligned", "access-api-unavailable"]) {
    await page.goto(`/?scenario=${scenario}`);
    await page.locator("#screen-select").selectOption("ACCESS_ELIGIBILITY_RESULT", { force: true });
    await expect(page.getByRole("heading", { name: "You’re eligible to continue" })).toHaveCount(0);
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
  await expect(page.locator(".emmi-assistant")).toBeVisible();
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
  await page.getByLabel("I acknowledge this information and want to continue").check();
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

  await expect(page.getByRole("heading", { name: "Before Medicare checks your eligibility" })).toBeVisible();
  await expect(page.getByText("ACCESS is a Medicare care model being evaluated by the Centers for Medicare & Medicaid Services (CMS)." )).toBeVisible();
  await expect(page.getByText("ITERA may share health information with CMS, and CMS may request information to evaluate ACCESS. Federal privacy and security protections apply.")).toBeVisible();
  await expect(page.getByText("CMS may randomly assign you to a comparison group. If that happens, you won’t be able to enroll in ACCESS for 12 months.")).toBeVisible();
  await expect(page.getByText("Your Medicare benefits, rights, and coverage will stay the same.")).toBeVisible();
  const assurance = page.locator('.contextual-assurance[data-assurance-type="MEDICARE_PROTECTION"]');
  await expect(assurance).toContainText("This check won’t affect your Medicare benefits");
  await expect(assurance.locator(".icon")).toHaveCount(1);

  const acknowledgement = page.getByLabel("I acknowledge this information and want to continue");
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
      titleFonts: [...screen.querySelectorAll(".accordion-list strong")].map(element => parseFloat(getComputedStyle(element).fontSize)),
      bodyFonts: [...screen.querySelectorAll(".accordion-list small")].map(element => parseFloat(getComputedStyle(element).fontSize)),
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
  await expect(page.getByRole("heading", { name: /nueva opción de cuidado/i })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test("Emmi remains available throughout the patient experience", async ({ page }) => {
  await page.goto("/?scenario=ccm-happy");
  const emmi = page.getByRole("button", { name: "Ask Emmi, Care Assistant" });
  await expect(emmi).toBeVisible();
  await expect(emmi.locator("img")).toHaveAttribute("src", "/assets/emmi-assistant.png");
  const emmiSurface = await emmi.evaluate(button => {
    const buttonStyle = getComputedStyle(button);
    const avatarStyle = getComputedStyle(button.querySelector(".emmi-avatar"));
    return {
      buttonBackground: buttonStyle.backgroundColor,
      buttonBorder: buttonStyle.borderTopWidth,
      buttonRadius: buttonStyle.borderRadius,
      avatarBackground: avatarStyle.backgroundColor,
      avatarRadius: avatarStyle.borderRadius
    };
  });
  expect(emmiSurface).toEqual({
    buttonBackground: "rgba(0, 0, 0, 0)",
    buttonBorder: "0px",
    buttonRadius: "0px",
    avatarBackground: "rgba(0, 0, 0, 0)",
    avatarRadius: "0px"
  });
  const initial = await emmi.boundingBox();
  await page.mouse.move(initial.x + initial.width / 2, initial.y + initial.height / 2);
  await page.mouse.down();
  await page.mouse.move(45, 160, { steps: 8 });
  await page.mouse.up();
  const moved = await emmi.boundingBox();
  expect(Math.abs(moved.x - initial.x)).toBeGreaterThan(80);
  await expect(page.getByRole("heading", { name: "A new care option for your health" })).toBeVisible();
  await page.reload();
  const restored = await emmi.boundingBox();
  expect(Math.abs(restored.x - moved.x)).toBeLessThan(4);
  await page.locator("#screen-select").selectOption("IDENTITY_VERIFICATION", { force: true });
  await expect(emmi).toBeVisible();
  await emmi.click();
  await expect(page.getByText("Emmi is an AI assistant, not a clinician. For medical emergencies, call 911.")).toBeVisible();
});

test("Emmi opens as a contextual conversation layer without changing enrollment state", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ACCESS_PRE_ELIGIBILITY_NOTICE", { force: true });
  const acknowledgement = page.getByLabel("I acknowledge this information and want to continue");
  await acknowledgement.check();
  await page.evaluate(() => window.scrollTo(0, 120));
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const progressBefore = await page.getByRole("progressbar", { name: "Enrollment progress" }).getAttribute("aria-valuenow");

  await page.getByRole("button", { name: "Ask Emmi, Care Assistant" }).click();
  const dialog = page.getByRole("dialog", { name: "Hi, I’m Emmi. How can I help?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Ask me anything about your enrollment or care.")).toBeVisible();
  await expect(dialog.getByPlaceholder("Ask a question…")).toBeVisible();
  await expect(dialog.getByText("What is Medicare checking?")).toBeVisible();
  await expect(dialog.getByText("Will this affect my benefits?")).toBeVisible();
  await expect(dialog.getByText("Why do you need my information?")).toBeVisible();
  await expect(dialog.getByText("Prefer to talk with someone?")).toBeVisible();
  await expect(dialog.getByRole("link", { name: /Talk to our care team/ })).toHaveAttribute("href", "tel:+13053948070");
  await expect(dialog.getByText("We’ll call the number ending in 4567")).toBeVisible();
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
  await expect(dialog.getByText("We’ll call the number ending in 4567 within one business day.")).toBeVisible();
  await dialog.locator(".assistant-back").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#screen-select")).toHaveValue("ACCESS_PRE_ELIGIBILITY_NOTICE");
  await expect(acknowledgement).toBeChecked();
  await expect(page.getByRole("progressbar", { name: "Enrollment progress" })).toHaveAttribute("aria-valuenow", progressBefore);
  await expect(page.getByRole("button", { name: "Ask Emmi, Care Assistant" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBefore);

  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  await page.getByRole("button", { name: "Ask Emmi, Care Assistant" }).click();
  const consentDialog = page.getByRole("dialog", { name: "Hi, I’m Emmi. How can I help?" });
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
  await expect(page.getByText("Please confirm your date of birth and ZIP code.")).toBeVisible();
  await expect(page.getByText("We use this information to securely verify your identity.")).toBeVisible();
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
  await expect(page.locator(".emmi-assistant")).toBeVisible();
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
    ["CARE_RECOMMENDATION", "NO_COMMITMENT_YET", "You’ll review the details before you enroll"],
    ["HOW_CARE_WORKS", "PHYSICIAN_CONTINUITY", "Your doctor remains part of your care"],
    ["ACCESS_ELIGIBILITY_RESULT", "NO_COMMITMENT_YET", "You’ll review the details before you enroll"],
    ["DISCLOSURE", "ENROLLMENT_CHOICE", "You choose whether to enroll"],
    ["CONSENT_REVIEW", "ENROLLMENT_CHOICE", "You choose whether to enroll"],
    ["ACCESS_BASELINE", "HEALTH_DATA_SECURITY", "Your health information is secure"]
  ];

  for (const [screen, type, message] of cases) {
    await page.locator("#screen-select").selectOption(screen, { force: true });
    const footer = page.locator(".contextual-assurance");
    await expect(footer).toHaveCount(1);
    await expect(footer).toHaveAttribute("data-assurance-type", type);
    await expect(footer).toContainText(message);
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
  await expect(page.getByRole("heading", { name: "Let’s confirm it’s you" })).toBeVisible();
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
  await page.getByLabel(/received and understand this important information/).check();
  await page.getByLabel(/on behalf of the patient, to enroll the patient in the services/).check();
  await expect(cta).toBeEnabled();
});

test("condition-specific setup never invents hypertension when another condition is selected", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption("Provider / Practice Referral");
  await page.locator('summary[aria-label="Condition"]').click();
  await page.getByRole("group", { name: /Clinical conditions/ }).getByText("Hypertension", { exact: true }).click();
  await page.getByRole("group", { name: /Clinical conditions/ }).getByText("Diabetes", { exact: true }).click();
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await page.locator("#screen-select").selectOption("ACCESS_MEASURE", { force: true });
  await expect(page.getByRole("heading", { name: "Your blood sugar starting point" })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText("blood pressure");

  await page.goto("/");
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
    await page.goto("/");
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

test("all traditional programs complete their implemented patient journey", async ({ page }) => {
  test.setTimeout(120000);
  for (const program of ["CCM", "RPM", "CCM + RPM", "PCM", "PCM + RPM", "ASM", "APCM"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("radio", { name: program, exact: true }).check({ force: true });
    await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption("Physician Referral");
    const coverage = page.getByRole("combobox", { name: /Coverage/ });
    await coverage.selectOption("Medicare Advantage");
    await expect(coverage).toHaveValue("Medicare Advantage");
    await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
    await page.getByRole("button", { name: "See how it works" }).click();
    await page.getByRole("radio", { name: /For myself/ }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Your recommended care" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "About your recommended care" })).toBeVisible();
    await page.getByLabel(/I have reviewed this information/).check();
    await page.getByRole("button", { name: "I understand" }).click();
    await page.getByLabel(/received and understand this important information/).check();
    await page.getByLabel(/agree to enroll in the services listed above/).check();
    await page.getByRole("button", { name: "Enroll now" }).click();
    await expect(page.getByText("Enrollment confirmed", { exact: true })).toBeVisible({ timeout: 5000 });

    const includesRpm = program.includes("RPM");
    if (includesRpm) {
      await expect(page.getByRole("heading", { name: /prepare your monitor/ })).toBeVisible();
      await page.getByRole("button", { name: "Set up my monitor" }).click();
      await page.getByRole("radio", { name: /I already have a monitor/ }).check();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "My monitor is connected" }).click();
      await page.getByRole("button", { name: "I took my reading" }).click();
      await expect(page.getByRole("heading", { name: "Home monitoring is ready" })).toBeVisible({ timeout: 5000 });
    } else {
      await page.getByRole("button", { name: "Continue to set up care" }).click();
      await page.getByRole("button", { name: "Save and continue" }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("heading", { name: "You’re off to a great start" })).toBeVisible();
    }
    await expect(page.locator("#screen-content")).not.toContainText(/ACCESS Eligibility|ACCESS Model|Check my eligibility/);
  }
});

test("ACCESS screens stay readable and free of horizontal overflow at required mobile viewports", async ({ page }) => {
  const runtimeErrors = [];
  page.on("console", message => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  const viewports = [
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 393, height: 852 },
    { width: 430, height: 932 }
  ];
  const screens = ["INVITATION", "DECISION_MAKER", "IDENTITY_VERIFICATION", "CARE_RECOMMENDATION", "HOW_CARE_WORKS", "ACCESS_PRE_ELIGIBILITY_NOTICE", "ACCESS_ELIGIBILITY_PROCESSING", "ACCESS_ELIGIBILITY_RESULT", "DISCLOSURE", "CONSENT_REVIEW", "ACCESS_ALIGNMENT_PROCESSING", "ENROLLMENT_CONFIRMED", "ACCESS_BASELINE", "ACCESS_MEASURE", "ONBOARDING_COMPLETE"];
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

test("core mobile screens tolerate 125 and 150 percent content scaling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/?scenario=access-happy");
  for (const scale of [1.25, 1.5]) {
    for (const screen of ["IDENTITY_VERIFICATION", "CARE_RECOMMENDATION", "DISCLOSURE", "CONSENT_REVIEW"]) {
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
