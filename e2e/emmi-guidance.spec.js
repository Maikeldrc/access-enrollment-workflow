import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await page.evaluate(() => {
    localStorage.removeItem("itera.emmi.preferences.v1");
    localStorage.removeItem("itera.enrollment.draft.v2");
    localStorage.removeItem("itera.enrollment.language.v1");
  });
  await page.reload();
});

test("introduces EMMI compactly with voice off by default and preserves opt-out", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Hi, I’m EMMI." })).toBeVisible();
  await expect(page.getByText(/guide you through each step and answer questions/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Guide me with voice/i })).toBeVisible();
  await expect(page.getByText("Voice guidance is on", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Repeat welcome/i })).toHaveCount(0);

  await page.evaluate(() => localStorage.setItem("itera.emmi.preferences.v1", JSON.stringify({ emmiVoiceGuidance: true, emmiWelcomeAcknowledged: true })));
  await page.reload();
  await expect(page.getByText("Voice guidance is on", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Turn voice off/i }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: /Guide me with voice/i })).toBeVisible();
  await expect(page.getByText("Voice guidance is on", { exact: true })).toHaveCount(0);
});

test("Guide me with voice starts the welcome session without a second click", async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [] }) } });
  });
  let tokenRequests = 0;
  await page.route("**/api/emmi/live-token", async route => {
    tokenRequests += 1;
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "connection_failed" }) });
  });
  await page.getByRole("button", { name: /Guide me with voice/i }).click();
  await expect.poll(() => tokenRequests).toBe(1);
  await expect(page.getByRole("button", { name: /Repeat welcome/i })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("itera.emmi.preferences.v1"))?.emmiVoiceGuidance)).toBe(true);
  // A connect that failed must never report itself as active, or the patient waits for audio
  // that is not coming and assumes "Repeat welcome" is what starts it.
  await expect(page.getByText("Voice guidance is on", { exact: true })).toHaveCount(0);
  await expect(page.locator(".emmi-welcome-choice")).toContainText("Voice guidance is unavailable");
  await page.getByRole("button", { name: /Turn voice off/i }).click();
  await expect(page.getByRole("button", { name: /Guide me with voice/i })).toBeVisible();
});

test("EMMI follows the patient's language for guidance, welcome, and Ask EMMI", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("itera.emmi.preferences.v1", JSON.stringify({ emmiVoiceGuidance: true, emmiWelcomeAcknowledged: true })));
  await page.reload();
  await page.getByRole("button", { name: /See how it works/i }).click();

  const summary = page.locator(".emmi-guide-copy span");
  await expect(summary).toHaveText("We’ll help you choose who should complete this process.");

  // Switching language must move the whole EMMI experience, not just the surrounding UI.
  await page.locator('[data-action="language"]').first().click();
  await expect(page.locator(".emmi-guide")).toContainText("La guía por voz está activa");
  await expect(summary).toHaveText("Le ayudaremos a elegir quién debe completar este proceso.");

  // KR is Haitian Creole in this product, never Korean.
  await page.locator('[data-action="language"]').first().click();
  await expect(summary).toHaveText("N ap ede w chwazi ki moun ki dwe ranpli pwosesis sa a.");
  await expect(summary).not.toContainText(/[가-힯]/);

  // Ask EMMI opens in the active language too.
  await page.locator('.emmi-guide [data-action="help"]').click();
  const assistant = page.locator(".assistant-layer");
  await expect(assistant).toContainText("Bonjou, mwen se EMMI. Kijan mwen ka ede?");
  await expect(assistant).toContainText("Mande m nenpòt bagay sou enskripsyon oswa swen ou.");
  await expect(assistant).not.toContainText("Ask me anything");
});

test("voice activation and its controls stay in the language the patient selected", async ({ page }) => {
  await page.context().grantPermissions(["microphone"], { origin: "http://127.0.0.1:4174" });
  let tokenRequests = 0;
  await page.route("**/api/emmi/live-token", route => {
    tokenRequests += 1;
    return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "connection_failed" }) });
  });

  await page.locator('[data-action="language"]').first().click();
  await page.getByRole("button", { name: "Guíeme con voz" }).click();
  await expect.poll(() => tokenRequests).toBe(1);
  const card = page.locator(".emmi-welcome-choice");
  await expect(card).toContainText("La guía por voz no está disponible");
  await expect(card).toContainText("Tengo problemas para conectarme.");
  await expect(card).not.toContainText("Voice guidance");
  await expect(page.getByRole("button", { name: "Repetir bienvenida" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Desactivar voz" })).toBeVisible();

  // Kreyòl has no live voice, so EMMI says so in Kreyòl instead of switching to English.
  await page.getByRole("button", { name: "Desactivar voz" }).click();
  await page.locator('[data-action="language"]').first().click();
  await page.getByRole("button", { name: "Gide m ak vwa" }).click();
  await expect(card).toContainText("Gid vwa poko disponib nan lang sa a.");
  await expect(card).not.toContainText(/[가-힯]/);
  expect(tokenRequests).toBe(1);
});

test("shows persistent, accessible guidance controls after opt-in", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("itera.emmi.preferences.v1", JSON.stringify({ emmiVoiceGuidance: true, emmiWelcomeAcknowledged: true })));
  await page.reload();
  await page.getByRole("button", { name: /See how it works/i }).click();

  const controls = page.locator(".emmi-guide");
  await expect(controls).toBeVisible();
  await expect(controls.getByText("Voice guidance is on")).toBeVisible();
  await expect(controls.getByText("We’ll help you choose who should complete this process.")).toBeVisible();
  await expect(controls.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Repeat", exact: true })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Ask EMMI" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Turn voice off", exact: true })).toBeVisible();
  // The guide shows one short line; the full narration is disclosed on request.
  await expect(controls).toContainText("We’ll help you choose who should complete this process.");
  await expect(controls).not.toContainText("Before we continue");
  await controls.getByRole("button", { name: "Read message" }).click();
  await expect(controls.locator(".emmi-guide-transcript")).toContainText("Before we continue, we just need to know who is filling this out today.");
  await controls.getByRole("button", { name: "Hide message" }).click();
  await expect(controls.locator(".emmi-guide-transcript")).toHaveCount(0);

  // The compact control replaces the floating EMMI while it is on screen.
  await expect(page.locator(".emmi-assistant")).toBeHidden();
  const barHeight = await controls.evaluate(element => element.getBoundingClientRect().height);
  expect(barHeight).toBeLessThan(200);
  // The task must sit above the fold with the guide, not be pushed off by it.
  expect(await page.locator("#screen-content h1").evaluate(node => node.getBoundingClientRect().top))
    .toBeLessThan(await controls.evaluate(node => node.getBoundingClientRect().top));
  for (const button of await controls.getByRole("button").all()) {
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
});

test("Care Circle stays optional support and is scoped to patients completing for themselves", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /See how it works/i }).click();

  const optionalSupport = page.locator("[data-optional-support]");
  await expect(page.getByRole("heading", { name: "Who is completing this?" })).toBeVisible();
  await expect(optionalSupport).toBeVisible();
  await expect(optionalSupport).toContainText("Optional support");
  await expect(optionalSupport).toContainText("Invite someone you trust to help you through this process.");
  await expect(optionalSupport).not.toContainText("Not now");
  await expect(optionalSupport.locator("input[type='radio']")).toHaveCount(0);

  const selectRole = value => page.locator(`.choice-card:has(input[value="${value}"])`).click();
  await selectRole("helper");
  await expect(optionalSupport).toBeHidden();
  await selectRole("personalRepresentative");
  await expect(optionalSupport).toBeHidden();
  await selectRole("patient");
  await expect(optionalSupport).toBeVisible();

  // Continue is driven only by the completion role; the invitation is never a prerequisite.
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();

  // The floating EMMI must never sit on top of the action row once the patient reaches it.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const overlap = await page.evaluate(() => {
    const emmi = document.querySelector(".emmi-assistant").getBoundingClientRect();
    return [...document.querySelectorAll(".actions .button")].some(button => {
      const rect = button.getBoundingClientRect();
      return emmi.right > rect.left && emmi.left < rect.right && emmi.bottom > rect.top && emmi.top < rect.bottom;
    });
  });
  expect(overlap).toBe(false);

  await page.locator("[data-action='open-care-circle']").click();
  await expect(page.getByRole("heading", { name: "Invite someone you trust" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.draft.v2") || "{}").completionRole ?? "patient")).toBe("patient");
});

test("uses the Direct Outreach welcome without inventing physician involvement", async ({ page }) => {
  await page.goto("/?prototype=1");
  await page.evaluate(() => {
    localStorage.removeItem("itera.prototype.config.v1");
    localStorage.removeItem("itera.emmi.preferences.v1");
  });
  await page.reload();
  await expect(page.getByText(/guide you through each step and answer questions/i)).toBeVisible();
  await expect(page.locator(".emmi-welcome")).not.toContainText("Dr. Fresner");
});

test("localizes the EMMI welcome in Spanish and Kreyòl without mixing languages", async ({ page }) => {
  await page.locator('[data-action="language"]').first().click();
  await expect(page.getByRole("heading", { name: "Hola, soy EMMI." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guíeme con voz" })).toBeVisible();

  await page.locator('[data-action="language"]').first().click();
  await expect(page.getByRole("heading", { name: "Bonjou, mwen se EMMI." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gide m ak vwa" })).toBeVisible();
});
