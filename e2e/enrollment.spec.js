import { test, expect } from "@playwright/test";

test("prototype setup shows defaults and conditional fields", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Configure the patient scenario" })).toBeVisible();
  await expect(page.getByText("ACCESS · eCKM · ITERA Direct Outreach · Hypertension · Original Medicare · English")).toBeVisible();
  await page.getByRole("radio", { name: "CCM + RPM", exact: true }).check({ force: true });
  await expect(page.getByRole("combobox", { name: /ACCESS track/ })).toHaveCount(0);
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Physician Referral" });
  await expect(page.getByRole("combobox", { name: /Physician/ })).toBeVisible();
});

test("condition selector supports multiple selections and Other", async ({ page }) => {
  await page.goto("/");
  await page.locator('summary[aria-label="Condition"]').click();
  await page.getByRole("group", { name: /Clinical conditions/ }).getByText("Diabetes", { exact: true }).click();
  await expect(page.locator(".condition-multiselect")).toHaveAttribute("open", "");
  await page.getByRole("group", { name: /Clinical conditions/ }).getByText("Other", { exact: true }).click();
  await expect(page.locator(".scenario-summary")).toContainText("3 conditions");
  await expect(page.getByText("Specify condition", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Enter condition").fill("Aortic aneurysm");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.getByRole("heading", { name: "A new care option for your health" })).toBeVisible();
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
  await expect(page.getByText("ITERA HEALTH invites you to learn about additional support available through Medicare.")).toBeVisible();
});

test("ACCESS physician referral uses doctor recommendation with dynamic physician", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Physician Referral" });
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.locator(".trust-hero-card")).toHaveAttribute("data-hero-variant", "DOCTOR_RECOMMENDS_ACCESS");
  await expect(page.getByAltText("Your doctor recommends ACCESS care with ITERA HEALTH")).toBeVisible();
  await expect(page.locator(".trust-hero-overlay")).toHaveText("Recommended by Dr. Fresner");
});

test("traditional physician pathway uses supervising care card", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "CCM + RPM", exact: true }).check({ force: true });
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Physician Referral" });
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.locator(".trust-hero-card")).toHaveAttribute("data-hero-variant", "PHYSICIAN_SUPERVISING");
  await expect(page.getByAltText("Care coordinated with your physician and care team")).toBeVisible();
  await expect(page.locator(".trust-hero-overlay")).toHaveText("Coordinated with Dr. Fresner");
});

test("trust hero cards use one compact premium image surface", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  const audits = [];
  const audit = async () => {
    await expect(page.locator(".trust-hero-card")).toBeVisible();
    return page.evaluate(() => {
    const card = document.querySelector(".trust-hero-card");
    const media = document.querySelector(".trust-hero-media");
    const image = document.querySelector(".trust-hero-image");
    const overlay = document.querySelector(".trust-hero-overlay");
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
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Physician Referral" });
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  audits.push(await audit());
  await page.goto("/");
  await page.getByRole("radio", { name: "CCM + RPM", exact: true }).check({ force: true });
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Physician Referral" });
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  audits.push(await audit());

  expect(audits.map(item => item.variant)).toEqual(["ACCESS_PARTICIPANT", "DOCTOR_RECOMMENDS_ACCESS", "PHYSICIAN_SUPERVISING"]);
  expect(new Set(audits.map(item => Math.round(item.height))).size).toBe(1);
  for (const item of audits) {
    expect(item.width).toBeGreaterThan(350);
    expect(item.height).toBeGreaterThanOrEqual(190);
    expect(item.height).toBeLessThanOrEqual(215);
    expect(item.mediaRatio).toBeCloseTo(1.86, 2);
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
  }
});

test("long physician names remain contained in the hero overlay", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "CCM + RPM", exact: true }).check({ force: true });
  await page.getByRole("combobox", { name: /Enrollment source/ }).selectOption({ label: "Physician Referral" });
  await page.getByRole("combobox", { name: /Physician/ }).evaluate(select => {
    const option = new Option("Dr. Humberto Machado Jr.", "Dr. Humberto Machado Jr.");
    select.add(option);
  });
  await page.getByRole("combobox", { name: /Physician/ }).selectOption("Dr. Humberto Machado Jr.");
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  const overlay = page.locator(".trust-hero-overlay.long");
  await expect(overlay).toHaveText("Coordinated with Dr. Humberto Machado Jr.");
  const contained = await page.evaluate(() => {
    const media = document.querySelector(".trust-hero-media").getBoundingClientRect();
    const text = document.querySelector(".trust-hero-overlay").getBoundingClientRect();
    return text.left >= media.left && text.right <= media.right && text.top >= media.top && text.bottom <= media.bottom;
  });
  expect(contained).toBe(true);
});

test("Creole setup opens the first patient screen in Creole", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: /Language/ }).selectOption({ label: "Creole" });
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  await expect(page.getByRole("heading", { name: "Yon nouvo opsyon swen pou sante ou" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ht");
});

test("ACCESS does not confirm enrollment at eligibility", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ACCESS_ELIGIBILITY_RESULT", { force: true });
  await expect(page.getByRole("heading", { name: "Medicare check complete" })).toBeVisible();
  await expect(page.getByText("Enrollment is not complete yet.")).toBeVisible();
  await expect(page.getByText("Enrollment confirmed")).toHaveCount(0);
});

test("RPM shipping branch exposes address confirmation", async ({ page }) => {
  await page.goto("/?scenario=rpm-shipping");
  await page.locator("#screen-select").selectOption("RPM_DEVICE_PATH", { force: true });
  await page.getByLabel("I need a monitor from ITERA").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Where should we send your monitor?" })).toBeVisible();
});

test("language switch exposes Spanish UI", async ({ page }) => {
  await page.goto("/?scenario=ccm-happy");
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await expect(page.getByRole("heading", { name: /nueva opción de cuidado/i })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test("Emmi remains available throughout the patient experience", async ({ page }) => {
  await page.goto("/?scenario=ccm-happy");
  const emmi = page.getByRole("button", { name: "Ask Emmi, AI assistant" });
  await expect(emmi).toBeVisible();
  await expect(emmi.locator("img")).toHaveAttribute("src", "/assets/emmi-assistant.png");
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

test("date of birth supports typing and calendar selection", async ({ page }) => {
  await page.goto("/?scenario=ccm-happy");
  await page.locator("#screen-select").selectOption("IDENTITY_VERIFICATION", { force: true });

  const dateText = page.getByLabel("Date of birth", { exact: true });
  await expect(dateText).toHaveValue("05/12/1954");
  await expect(page.getByLabel("ZIP code", { exact: true })).toHaveValue("33176");
  await dateText.fill("06151945");
  await expect(dateText).toHaveValue("06/15/1945");

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
  await expect(dateText).toHaveValue("02/03/1940");
});
