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
  await expect(page.getByRole("button", { name: /^Repeat$/i })).toHaveCount(0);

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
  await expect(page.getByRole("button", { name: /^Repeat$/i })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("itera.emmi.preferences.v1"))?.emmiVoiceGuidance)).toBe(true);
  // A connect that failed must never report itself as active, or the patient waits for audio
  // that is not coming and assumes "Repeat" is what starts it.
  await expect(page.getByText("Voice guidance is on", { exact: true })).toHaveCount(0);
  await expect(page.locator(".emmi-welcome-choice")).toContainText("Voice guidance is unavailable");
  await page.getByRole("button", { name: /Turn voice off/i }).click();
  await expect(page.getByRole("button", { name: /Guide me with voice/i })).toBeVisible();
});

test("EMMI follows the patient's language for guidance, welcome, and Ask EMMI", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("itera.emmi.preferences.v1", JSON.stringify({ emmiVoiceGuidance: true, emmiWelcomeAcknowledged: true })));
  await page.reload();
  await page.getByRole("button", { name: /See how it works/i }).click();

  const status = page.locator(".emmi-guide-copy span");
  await expect(status).toHaveText("Voice guidance is on");

  // Switching language must move the whole EMMI experience, not just the surrounding UI.
  await page.locator('[data-action="language"]').first().click();
  await expect(page.locator(".emmi-guide")).toContainText("La guía por voz está activa");
  await expect(status).toHaveText("La guía por voz está activa");

  // KR is Haitian Creole in this product, never Korean.
  await page.locator('[data-action="language"]').first().click();
  await expect(page.locator(".emmi-guide-voice-unavailable")).toContainText("Gid vwa a pa disponib nan lang sa a kounye a.");
  await expect(page.locator(".emmi-guide")).not.toContainText(/[가-힯]/);
  await expect(page.locator(".emmi-guide").getByRole("button", { name: "Mande EMMI" })).toBeVisible();

  // Ask EMMI opens in the active language too.
  await page.locator('.emmi-guide [data-action="help"]').click();
  const assistant = page.locator(".assistant-layer");
  await expect(assistant).toContainText("Kijan mwen ka ede w?");
  await expect(assistant).not.toContainText("Bonjou, mwen se EMMI");
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
  await expect(card).toContainText("No se pudo iniciar la sesión de voz.");
  await expect(card).not.toContainText("Voice guidance");
  await expect(page.getByRole("button", { name: "Repetir" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Desactivar guía por voz" })).toBeVisible();

  // Capability is resolved before activation: Kreyòl stays text-only without requesting a
  // token or microphone, and never silently switches to English or Korean.
  await page.getByRole("button", { name: "Desactivar guía por voz" }).click();
  await page.locator('[data-action="language"]').first().click();
  await expect(page.getByRole("button", { name: "Gide m ak vwa" })).toHaveCount(0);
  await expect(page.locator(".emmi-voice-text-only")).toContainText("Gid vwa a pa disponib nan lang sa a kounye a. Ou ka kontinye itilize EMMI pa mesaj.");
  await expect(page.locator(".emmi-welcome")).not.toContainText(/[가-힯]/);
  expect(tokenRequests).toBe(1);
});

test("shows persistent, accessible guidance controls after opt-in", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("itera.emmi.preferences.v1", JSON.stringify({ emmiVoiceGuidance: true, emmiWelcomeAcknowledged: true })));
  await page.reload();
  await page.getByRole("button", { name: /See how it works/i }).click();

  const controls = page.locator(".emmi-guide");
  await expect(controls).toBeVisible();
  await expect(controls.getByText("EMMI", { exact: true })).toBeVisible();
  await expect(controls.getByText("Voice guidance is on")).toBeVisible();
  await expect(controls.getByRole("button", { name: "Ask EMMI" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Voice options" })).toBeVisible();
  await expect(controls.getByRole("button", { name: /Controls/i })).toHaveCount(0);
  await expect(controls.getByRole("button", { name: "Pause", exact: true })).toHaveCount(0);
  await expect(controls.getByRole("button", { name: "Repeat", exact: true })).toHaveCount(0);
  await expect(controls.getByRole("button", { name: "Turn voice off", exact: true })).toHaveCount(0);
  await expect(controls).not.toContainText("Before we continue");

  await controls.getByRole("button", { name: "Voice options" }).click();
  // Voice options controls the voice experience and nothing else: Ask EMMI stays outside it,
  // because talking to EMMI is a primary action, not a setting.
  const sheet = page.getByRole("dialog", { name: "Voice options" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Repeat", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Ask EMMI" })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Turn voice off", exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: "Read message" }).click();
  await expect(sheet.locator(".emmi-guide-transcript")).toContainText("Before we continue, we just need to know who is filling this out today.");
  await sheet.getByRole("button", { name: "Hide message" }).click();
  await expect(sheet.locator(".emmi-guide-transcript")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Close", exact: true }).click();
  await expect(sheet).toHaveCount(0);

  // The compact control replaces the floating EMMI while it is on screen.
  await expect(page.locator(".emmi-assistant")).toBeHidden();
  const barHeight = await controls.evaluate(element => element.getBoundingClientRect().height);
  expect(barHeight).toBeLessThan(125);
  // The task must sit above the fold with the guide, not be pushed off by it.
  expect(await page.locator("#screen-content h1").evaluate(node => node.getBoundingClientRect().top))
    .toBeLessThan(await controls.evaluate(node => node.getBoundingClientRect().top));
  for (const button of await controls.getByRole("button").all()) {
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
});

test("compact EMMI controls stay aligned and senior-friendly across journey mobile widths", async ({ page }) => {
  for (const [width, height] of [[360, 800], [375, 812], [384, 824], [390, 844], [393, 852], [412, 915], [430, 932]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/?scenario=access-happy");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("itera.emmi.preferences.v1", JSON.stringify({ emmiVoiceGuidance: true, emmiWelcomeAcknowledged: true }));
    });
    await page.reload();
    await page.getByRole("button", { name: /See how it works/i }).click();
    const bar = page.locator(".emmi-guide");
    const metrics = await bar.evaluate(node => {
      const parentStyle = getComputedStyle(node.parentElement);
      return {
        height: node.getBoundingClientRect().height,
        width: node.getBoundingClientRect().width,
        parentInnerWidth: node.parentElement.getBoundingClientRect().width - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight),
        minButtonHeight: Math.min(...[...node.querySelectorAll(":scope > .emmi-guide-actions button")].map(button => button.getBoundingClientRect().height)),
        minFont: Math.min(...[...node.querySelectorAll(":scope > .emmi-guide-actions button")].map(button => parseFloat(getComputedStyle(button).fontSize)))
      };
    });
    expect(metrics.height, `${width}px compact height`).toBeLessThan(125);
    expect(Math.abs(metrics.width - metrics.parentInnerWidth), `${width}px shared grid`).toBeLessThanOrEqual(1);
    expect(metrics.minButtonHeight, `${width}px touch target`).toBeGreaterThanOrEqual(44);
    expect(metrics.minFont, `${width}px font`).toBeGreaterThanOrEqual(16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `${width}px overflow`).toBe(false);
    await expect(page.locator(".emmi-assistant")).toBeHidden();
  }
});

test("Enrollment Complete keeps the compact EMMI bar secondary to the success content", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await page.evaluate(() => localStorage.setItem("itera.emmi.preferences.v1", JSON.stringify({ emmiVoiceGuidance: true, emmiWelcomeAcknowledged: true })));
  await page.reload();
  await page.locator("#screen-select").selectOption("ENROLLMENT_CONFIRMED", { force: true });
  const bar = page.locator(".emmi-guide");
  const success = page.locator(".enrollment-welcome-screen");
  await expect(bar).toBeVisible();
  await expect(success).toBeVisible();
  await expect(bar.getByRole("button", { name: "Ask EMMI" })).toBeVisible();
  await expect(bar.getByRole("button", { name: "Voice options" })).toBeVisible();
  expect(await bar.evaluate(node => node.getBoundingClientRect().height)).toBeLessThan(125);
  expect(await page.evaluate(() => {
    const barNode = document.querySelector(".emmi-guide");
    const successNode = document.querySelector(".enrollment-welcome-screen");
    return Boolean(barNode && successNode && barNode.compareDocumentPosition(successNode) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  await expect(page.locator(".emmi-assistant")).toBeHidden();
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
  await expect(page.getByRole("button", { name: "Gide m ak vwa" })).toHaveCount(0);
  await expect(page.locator(".emmi-voice-text-only")).toContainText("EMMI disponib pa mesaj");
});

test("EMMI actions are real buttons rather than underlined links", async ({ page }) => {
  // 384x824 is the primary mobile reference, and Spanish carries the longest labels.
  for (const [width, height] of [[360, 800], [384, 824], [430, 932]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/?scenario=access-happy");
    // A draft left by an earlier test would restore a later screen instead of Home.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: /See how it works/i }).click();
    await page.locator('[data-action="language"]').first().click();

    const card = page.locator(".emmi-guide-off");
    await expect(card).toBeVisible();
    const ask = card.getByRole("button", { name: "Preguntar a EMMI" });
    const voice = card.getByRole("button", { name: /Guíeme con voz/ });
    await expect(ask).toBeVisible();
    await expect(voice).toBeVisible();

    const audit = await card.evaluate(node => {
      const buttons = [...node.querySelectorAll(".emmi-guide-button")];
      const cardRect = node.getBoundingClientRect();
      return {
        count: buttons.length,
        allButtons: buttons.every(button => button.tagName === "BUTTON"),
        // Actions must not read as hyperlinks.
        underlined: buttons.some(button => getComputedStyle(button).textDecorationLine.includes("underline")),
        bordered: buttons.every(button => parseFloat(getComputedStyle(button).borderTopWidth) > 0),
        minHeight: Math.min(...buttons.map(button => button.getBoundingClientRect().height)),
        minFont: Math.min(...buttons.map(button => parseFloat(getComputedStyle(button).fontSize))),
        clipped: buttons.some(button => button.scrollWidth > button.clientWidth + 1),
        contained: buttons.every(button => {
          const rect = button.getBoundingClientRect();
          return rect.left >= cardRect.left - 1 && rect.right <= cardRect.right + 1;
        }),
        // Only the voice action carries an icon, so the pair does not feel over-decorated.
        iconCount: buttons.filter(button => button.querySelector("svg")).length,
        cardHeight: cardRect.height
      };
    });

    expect(audit.count, `${width}px`).toBe(2);
    expect(audit.allButtons, `${width}px semantics`).toBe(true);
    expect(audit.underlined, `${width}px underline`).toBe(false);
    expect(audit.bordered, `${width}px border`).toBe(true);
    expect(audit.minHeight, `${width}px touch target`).toBeGreaterThanOrEqual(44);
    expect(audit.minFont, `${width}px font`).toBeGreaterThanOrEqual(16);
    expect(audit.clipped, `${width}px clipped label`).toBe(false);
    expect(audit.contained, `${width}px containment`).toBe(true);
    expect(audit.iconCount, `${width}px icons`).toBe(1);
    expect(audit.cardHeight, `${width}px card height`).toBeLessThanOrEqual(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `${width}px overflow`).toBe(false);
  }
});

test("Kreyòl text-only fallback is readable and never overflows on supported mobile widths", async ({ page }) => {
  for (const [width, height] of [[360, 800], [384, 824], [430, 932]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/?scenario=access-happy");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-action="language"]').first().click();
    await page.locator('[data-action="language"]').first().click();
    const fallback = page.locator(".emmi-voice-text-only");
    await expect(fallback).toContainText("Gid vwa a pa disponib nan lang sa a kounye a. Ou ka kontinye itilize EMMI pa mesaj.");
    const audit = await fallback.evaluate(node => ({
      fontSize: parseFloat(getComputedStyle(node.querySelector("small")).fontSize),
      contained: node.getBoundingClientRect().right <= innerWidth,
      clipped: node.scrollWidth > node.clientWidth + 1
    }));
    expect(audit.fontSize, `${width}px font`).toBeGreaterThanOrEqual(16);
    expect(audit.contained, `${width}px containment`).toBe(true);
    expect(audit.clipped, `${width}px clipping`).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `${width}px overflow`).toBe(false);
  }
});

const enableVoiceGuidance = page => page.evaluate(() => localStorage.setItem("itera.emmi.preferences.v1", JSON.stringify({ emmiVoiceGuidance: true, emmiWelcomeAcknowledged: true })));

test("EMMI hands off between the compact card and the floating pill without ever duplicating itself", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await enableVoiceGuidance(page);
  await page.reload();
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });

  const compact = page.locator(".emmi-guide");
  const floating = page.locator(".emmi-assistant");
  await expect(compact).toBeVisible();
  await expect(floating).toBeHidden();

  // Scrolled past the compact card, with the screen's own actions still below the fold, EMMI
  // reappears as a named pill rather than a bare avatar.
  await page.evaluate(() => window.scrollTo(0, 520));
  await expect(floating).toBeVisible();
  await expect(floating.locator(".emmi-assistant-label")).toContainText("EMMI");
  await expect(compact).not.toBeInViewport();

  // Tapping it expands EMMI in place. Nothing navigates, nothing greets the patient again.
  await floating.click();
  const expanded = page.getByRole("dialog", { name: "EMMI" });
  await expect(expanded).toBeVisible();
  await expect(expanded.getByRole("button", { name: "Ask EMMI" })).toBeVisible();
  await expect(expanded.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect(expanded.getByRole("button", { name: "Turn voice off", exact: true })).toBeVisible();
  await expect(expanded).not.toContainText(/Hi, I’m EMMI|Welcome back/);
  await expect(floating).toBeHidden();

  // Escape closes the sheet and hands focus back to what opened it.
  await page.keyboard.press("Escape");
  await expect(expanded).toHaveCount(0);
  await expect(floating).toBeFocused();

  // Back at the top the compact card takes over again and the pill stands down.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(compact).toBeVisible();
  await expect(floating).toBeHidden();
});

test("the floating pill never covers the screen's own actions", async ({ page }) => {
  for (const width of [360, 384, 430]) {
    await page.setViewportSize({ width, height: 824 });
    await page.goto("/?scenario=access-happy");
    await enableVoiceGuidance(page);
    await page.reload();
    for (const screen of ["DECISION_MAKER", "IDENTITY_VERIFICATION", "CONSENT_REVIEW", "ENROLLMENT_CONFIRMED"]) {
      await page.locator("#screen-select").selectOption(screen, { force: true });
      for (const offset of [0, 400, 99999]) {
        await page.evaluate(y => window.scrollTo(0, y), offset);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const audit = await page.evaluate(() => {
          const pill = document.querySelector(".emmi-assistant");
          const compact = document.querySelector(".emmi-guide");
          const pillShown = Boolean(pill) && getComputedStyle(pill).display !== "none";
          const compactShown = Boolean(compact) && compact.getBoundingClientRect().bottom > 0 && compact.getBoundingClientRect().top < innerHeight;
          if (!pillShown) return { both: false, covered: [] };
          const box = pill.getBoundingClientRect();
          return {
            both: compactShown,
            covered: [...document.querySelectorAll("#screen-content .actions .button, #screen-content .button.primary, #screen-content button, #screen-content a, #screen-content input")]
              .filter(node => {
                const rect = node.getBoundingClientRect();
                return rect.width && box.right > rect.left && box.left < rect.right && box.bottom > rect.top && box.top < rect.bottom;
              })
              .map(node => node.textContent.trim().slice(0, 30))
          };
        });
        expect(audit.both, `${screen} @${width} shows one EMMI`).toBe(false);
        expect(audit.covered, `${screen} @${width}px scrolled ${offset}`).toEqual([]);
      }
    }
  }
});

test("voice options is offered only when there is voice guidance to adjust", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await page.getByRole("button", { name: /See how it works/i }).click();

  // Voice off: the patient is offered the conversation and the voice, never voice settings.
  const compact = page.locator(".emmi-guide");
  await expect(compact).toContainText("Need help?");
  await expect(compact.getByRole("button", { name: "Ask EMMI" })).toBeVisible();
  await expect(compact.getByRole("button", { name: /Guide me with voice/ })).toBeVisible();
  await expect(compact.getByRole("button", { name: "Voice options" })).toHaveCount(0);

  // Kreyòl has no voice yet, so EMMI says so plainly instead of implying a live voice session.
  await page.locator('[data-action="language"]').first().click();
  await page.locator('[data-action="language"]').first().click();
  await expect(compact.getByRole("button", { name: "Voice options" })).toHaveCount(0);
  await expect(compact.getByRole("button", { name: "Mande EMMI" })).toBeVisible();
  await expect(compact).not.toContainText(/[가-힯]/);
});

test("compact EMMI stays readable and untruncated at 125% and 150% text scaling", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await enableVoiceGuidance(page);
  await page.reload();
  await page.getByRole("button", { name: /See how it works/i }).click();
  for (const scale of [1, 1.25, 1.5]) {
    await page.evaluate(value => { document.documentElement.style.fontSize = `${16 * value}px`; }, scale);
    const audit = await page.locator(".emmi-guide").evaluate(node => {
      const buttons = [...node.querySelectorAll(".emmi-guide-actions button")];
      return {
        truncated: buttons.some(button => button.scrollWidth > button.clientWidth + 1),
        minHeight: Math.min(...buttons.map(button => button.getBoundingClientRect().height)),
        minFont: Math.min(...buttons.map(button => parseFloat(getComputedStyle(button).fontSize))),
        contained: node.getBoundingClientRect().right <= innerWidth + 1,
        overflow: document.documentElement.scrollWidth > innerWidth
      };
    });
    expect(audit.truncated, `${scale}x truncation`).toBe(false);
    expect(audit.minHeight, `${scale}x touch target`).toBeGreaterThanOrEqual(44);
    expect(audit.minFont, `${scale}x font`).toBeGreaterThanOrEqual(16 * scale - 0.5);
    expect(audit.contained, `${scale}x containment`).toBe(true);
    expect(audit.overflow, `${scale}x overflow`).toBe(false);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
});

test("idle EMMI does not animate and reduced motion silences the speaking cue", async ({ page }) => {
  await enableVoiceGuidance(page);
  await page.reload();
  await page.getByRole("button", { name: /See how it works/i }).click();
  const idleAnimations = await page.locator(".emmi-guide").evaluate(node =>
    [node, ...node.querySelectorAll("*")].map(element => getComputedStyle(element).animationName).filter(name => name && name !== "none"));
  expect(idleAnimations).toEqual([]);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await page.evaluate(() => {
    const probe = document.createElement("i");
    probe.className = "emmi-audio-activity";
    probe.innerHTML = "<b></b>";
    document.body.append(probe);
    const name = getComputedStyle(probe.querySelector("b")).animationName;
    probe.remove();
    return name;
  });
  expect(reduced).toBe("none");
});
