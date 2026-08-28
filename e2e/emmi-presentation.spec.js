import { expect, test } from "@playwright/test";
import { openEmmiConversation, revealFloatingEmmi } from "./emmiSurfaces.js";

// EMMI is one assistant with four presentations — the Home introduction, the compact card, the
// floating pill and the expanded panel — and never two of them at once. These tests cover the
// hand-off between them, and the promise that opening EMMI costs the patient nothing: same
// screen, same scroll, same enrollment, same conversation, same voice.

const startHome = async (page, { voice = false } = {}) => {
  await page.goto("/?scenario=access-happy");
  await page.evaluate(() => localStorage.clear());
  if (voice) await page.evaluate(() => localStorage.setItem("itera.emmi.preferences.v1", JSON.stringify({ emmiVoiceGuidance: true, emmiWelcomeAcknowledged: true })));
  await page.reload();
  await page.waitForSelector(".emmi-welcome");
};

const presentation = page => page.locator(".shell").getAttribute("data-emmi-presentation");

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
});

test("Home introduces EMMI once: the card is on screen and the floating pill is not", async ({ page }) => {
  await startHome(page);

  const intro = page.locator(".emmi-welcome");
  await expect(intro).toBeVisible();
  await expect(intro.getByRole("heading", { name: "Hi, I’m EMMI." })).toBeVisible();
  await expect(intro.getByText("Your ITERA Care Assistant")).toBeVisible();
  await expect(intro.getByText(/guide you through each step and answer questions/i)).toBeVisible();
  await expect(intro.getByRole("button", { name: /Guide by voice/i })).toBeVisible();

  // The duplicate robot in the corner is gone while EMMI is introducing herself.
  await expect(page.locator(".emmi-assistant")).toBeHidden();
  expect(await presentation(page)).toBe("HOME_INTRO");

  // Scrolling anywhere on Home keeps that promise: the card stays in view on this page, so the
  // pill never joins it, and the page's own CTA and support number are never covered.
  const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (const offset of [120, 240, maxScroll]) {
    await page.evaluate(value => window.scrollTo(0, value), offset);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const audit = await page.evaluate(() => {
      const pill = document.querySelector(".emmi-assistant");
      const card = document.querySelector(".emmi-welcome").getBoundingClientRect();
      const cardVisible = card.bottom > 0 && card.top < innerHeight;
      const pillVisible = Boolean(pill.getClientRects().length);
      if (!pillVisible) return { both: false, covered: [] };
      const box = pill.getBoundingClientRect();
      return {
        both: cardVisible,
        covered: [...document.querySelectorAll("#screen-content .button, #screen-content a, #screen-content button")]
          .filter(node => {
            const rect = node.getBoundingClientRect();
            return rect.width && box.right > rect.left && box.left < rect.right && box.bottom > rect.top && box.top < rect.bottom;
          })
          .map(node => node.textContent.trim().slice(0, 30))
      };
    });
    expect(audit.both, `one EMMI at scroll ${offset}`).toBe(false);
    expect(audit.covered, `nothing covered at scroll ${offset}`).toEqual([]);
  }
});

test("Home hands EMMI to the floating pill once the introduction card leaves the viewport", async ({ page }) => {
  // A short viewport is what makes the hand-off reachable on a page as compact as Home.
  await page.setViewportSize({ width: 384, height: 420 });
  await startHome(page);
  await expect(page.locator(".emmi-assistant")).toBeHidden();

  const pill = await revealFloatingEmmi(page);
  expect(pill, "the pill takes over once the introduction has scrolled away").not.toBeNull();
  await expect(page.locator(".emmi-welcome")).not.toBeInViewport();
  await expect(pill).toHaveAccessibleName("Open EMMI");
  const pillBox = await pill.boundingBox();
  expect(pillBox.height, "labeled pill, not a bare avatar").toBeGreaterThanOrEqual(48);
  expect(pillBox.width, "compact at narrow widths").toBeLessThan(384 * 0.6);

  // Scrolling back to the introduction stands the pill down again, with no flicker of both.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator(".emmi-assistant")).toBeHidden();
  expect(await presentation(page)).toBe("HOME_INTRO");
});

test("opening EMMI is an overlay, and closing it restores the screen exactly", async ({ page }) => {
  await startHome(page);
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  const routeBefore = page.url();

  const pill = await revealFloatingEmmi(page);
  expect(pill).not.toBeNull();
  const scrollBefore = await page.evaluate(() => Math.round(scrollY));
  await pill.click();

  const panel = page.locator(".assistant-layer");
  await expect(panel).toBeVisible();
  expect(page.url(), "EMMI is a presentation, not a route").toBe(routeBefore);
  expect(await presentation(page)).toBe("EXPANDED");
  await expect(page.locator(".emmi-assistant")).toBeHidden();
  // The screen underneath is inactive while the panel is open, not merely covered.
  expect(await page.locator("#screen-content").getAttribute("inert")).not.toBeNull();

  await panel.getByRole("button", { name: "Close EMMI" }).first().click();
  await expect(panel).toHaveCount(0);
  expect(page.url()).toBe(routeBefore);
  expect(await page.evaluate(() => Math.round(scrollY))).toBe(scrollBefore);
  expect(await page.locator("#screen-content").getAttribute("inert")).toBeNull();
  await expect(page.locator(".emmi-assistant")).toBeFocused();
});

test("the conversation, the screen state and the enrollment survive opening and closing EMMI", async ({ page }) => {
  await startHome(page);
  await page.getByRole("button", { name: /See how it works/i }).click();
  await expect(page.getByRole("heading", { name: "Who is completing this?" })).toBeVisible();
  await page.locator('.choice-card:has(input[value="helper"])').click();

  const panel = await openEmmiConversation(page);
  await panel.getByPlaceholder("Ask a question…").fill("What is ACCESS?");
  await panel.getByRole("button", { name: "Send question" }).click();
  await expect(panel.locator(".assistant-message.user")).toContainText("What is ACCESS?");
  await expect(panel.locator(".assistant-message.assistant")).toHaveCount(1);

  await panel.locator(".assistant-close").click();
  await expect(page.locator(".assistant-layer")).toHaveCount(0);
  // The step the patient was on is untouched: same screen, same answer selected.
  await expect(page.getByRole("heading", { name: "Who is completing this?" })).toBeVisible();
  await expect(page.locator('input[value="helper"]')).toBeChecked();

  // Reopening continues the same conversation rather than starting one.
  const reopened = await openEmmiConversation(page);
  await expect(reopened.locator(".assistant-message.user")).toContainText("What is ACCESS?");
  await expect(reopened).not.toContainText("Hi, I’m EMMI");
  await expect(reopened.getByRole("heading", { name: "How can I help?" })).toBeVisible();
});

test("voice guidance turned on at Home is still on when EMMI is expanded later", async ({ page }) => {
  await startHome(page, { voice: true });
  await page.getByRole("button", { name: /See how it works/i }).click();

  const panel = await openEmmiConversation(page);
  // The panel reports the voice the patient already has instead of offering to start it again.
  await expect(panel.getByRole("button", { name: "Voice options" })).toBeVisible();
  await expect(panel.getByRole("button", { name: /Guide by voice/i })).toHaveCount(0);
  await expect(panel).not.toContainText("Hi, I’m EMMI");
  await panel.getByRole("button", { name: "Voice options" }).click();
  await expect(panel.getByRole("button", { name: "Turn voice off", exact: true })).toBeVisible();
});

test("the expanded panel offers one way into the conversation, not two competing ones", async ({ page }) => {
  await startHome(page);
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  const panel = await openEmmiConversation(page);

  await expect(panel.getByRole("heading", { name: "How can I help?" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Talk to EMMI" })).toHaveCount(1);
  await expect(panel).not.toContainText("Use your voice or continue typing");
  await expect(panel.getByPlaceholder("Ask a question…")).toHaveCount(1);
  // One avatar in the panel, next to the hero. The header carries EMMI's name in text.
  expect(await panel.locator("img[src*='emmi-assistant']").count()).toBe(1);

  const layout = await panel.evaluate(layer => {
    const send = layer.querySelector(".assistant-question-form button");
    const close = layer.querySelector(".assistant-close");
    const talk = layer.querySelector(".assistant-talk-button");
    const quick = [...layer.querySelectorAll(".assistant-quick button")];
    return {
      horizontalOverflow: layer.scrollWidth > layer.clientWidth,
      sendSize: Math.min(send.getBoundingClientRect().width, send.getBoundingClientRect().height),
      closeSize: Math.min(close.getBoundingClientRect().width, close.getBoundingClientRect().height),
      talkHeight: talk.getBoundingClientRect().height,
      quickMinHeight: Math.min(...quick.map(button => button.getBoundingClientRect().height)),
      quickMinFont: Math.min(...quick.map(button => parseFloat(getComputedStyle(button).fontSize))),
      quickClipped: quick.some(button => button.scrollHeight > button.clientHeight + 1)
    };
  });
  expect(layout.horizontalOverflow).toBe(false);
  expect(layout.sendSize).toBeGreaterThanOrEqual(48);
  expect(layout.closeSize).toBeGreaterThanOrEqual(44);
  expect(layout.talkHeight).toBeGreaterThanOrEqual(56);
  expect(layout.quickMinHeight).toBeGreaterThanOrEqual(48);
  expect(layout.quickMinFont).toBeGreaterThanOrEqual(17);
  expect(layout.quickClipped).toBe(false);

  // Human support stays one tap away, on a real phone number.
  await expect(panel.getByRole("link", { name: /Talk to our care team/ })).toHaveAttribute("href", "tel:+13053948070");
  await expect(panel.getByText("(305) 394-8070")).toBeVisible();
});

test("quick questions come from the screen the patient is on", async ({ page }) => {
  await startHome(page);
  const home = await openEmmiConversation(page);
  await expect(home.getByRole("button", { name: "What is ACCESS?" })).toBeVisible();
  await expect(home.getByRole("button", { name: "Do I have to enroll?" })).toBeVisible();
  await expect(home.getByRole("button", { name: "Talk with someone" })).toBeVisible();
  await home.locator(".assistant-close").click();

  await page.locator("#screen-select").selectOption("ACCESS_ELIGIBILITY_RESULT", { force: true });
  const eligibility = await openEmmiConversation(page);
  await expect(eligibility.getByRole("button", { name: "What is Medicare checking?" })).toBeVisible();
  await expect(eligibility.getByRole("button", { name: "Do I have to enroll?" })).toHaveCount(0);
  await eligibility.locator(".assistant-close").click();

  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  const consent = await openEmmiConversation(page);
  await expect(consent.getByRole("button", { name: "What am I agreeing to?" })).toBeVisible();
  await expect(consent.getByRole("button", { name: "Can I change my mind?" })).toBeVisible();
  await expect(consent.getByRole("button", { name: "What is Medicare checking?" })).toHaveCount(0);
});

test("a quick question is asked through the same conversation as anything typed", async ({ page }) => {
  await startHome(page);
  const panel = await openEmmiConversation(page);
  await panel.getByRole("button", { name: "What is ACCESS?" }).click();
  await expect(panel.locator(".assistant-message.user")).toContainText("What is ACCESS?");
  await expect(panel.locator(".assistant-message.assistant")).toHaveCount(1);
});

test("analytics record the EMMI presentation lifecycle without recording what was asked", async ({ page }) => {
  // The audit trail only persists once identity is verified, which is also the only point at
  // which any of this leaves the device.
  await page.goto("/?scenario=access-happy");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({ scenarioId: "access-happy", screen: "INVITATION", role: "patient", completionRole: "patient", identityVerified: true, language: "en", audit: [], careTeamTasks: [], careMedications: [], careGoals: [], bpReadings: [], bpReadingReceipts: [] }));
  });
  await page.reload();
  await page.waitForSelector(".emmi-welcome");

  const panel = await openEmmiConversation(page);
  await panel.getByRole("button", { name: "What is ACCESS?" }).click();
  await expect(panel.locator(".assistant-message.assistant")).toHaveCount(1);
  await panel.locator(".assistant-close").click();
  await expect(page.locator(".assistant-layer")).toHaveCount(0);

  const audit = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2") || "{}").audit || []);
  const types = audit.map(event => event.eventType);
  expect(types).toEqual(expect.arrayContaining(["emmi_intro_visible", "emmi_expanded_opened", "emmi_quick_question_selected", "emmi_expanded_closed"]));
  const opened = audit.find(event => event.eventType === "emmi_expanded_opened");
  expect(opened.details.source, "the surface EMMI was opened from").toBe("home-intro");
  const selected = audit.find(event => event.eventType === "emmi_quick_question_selected");
  expect(selected.details.questionId).toBe("access-what-is");
  expect(JSON.stringify(audit), "no question text in analytics").not.toContain("What is ACCESS?");
});

test("EMMI is reachable in Kreyòl, where there is no voice to offer", async ({ page }) => {
  await startHome(page);
  await page.locator('[data-action="language"]').first().click();
  await page.locator('[data-action="language"]').first().click();

  const intro = page.locator(".emmi-welcome");
  await expect(intro.getByRole("heading", { name: "Bonjou, mwen se EMMI." })).toBeVisible();
  await expect(intro.getByText("Gid vwa a pa disponib nan lang sa a kounye a. Ou ka kontinye itilize EMMI pa mesaj.")).toBeVisible();
  await expect(intro.getByRole("button", { name: "Gide ak vwa" })).toHaveCount(0);

  // Text EMMI is the way in, so the introduction has to offer it.
  const ask = intro.getByRole("button", { name: "Mande EMMI" });
  await expect(ask).toBeVisible();
  await ask.click();
  const panel = page.locator(".assistant-layer");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Kijan mwen ka ede w?" })).toBeVisible();
  await expect(panel.getByPlaceholder("Poze yon kesyon…")).toBeEnabled();
  await expect(panel.getByRole("button", { name: "Pale ak EMMI" })).toHaveCount(0);
  await expect(panel).not.toContainText(/[가-힯]/);
  await expect(panel.getByRole("button", { name: "Fèmen EMMI" }).first()).toBeVisible();
});

test("the language switch inside EMMI moves the whole experience without restarting it", async ({ page }) => {
  await startHome(page);
  const panel = await openEmmiConversation(page);
  await panel.getByPlaceholder("Ask a question…").fill("What is ACCESS?");
  await panel.getByRole("button", { name: "Send question" }).click();
  await expect(panel.locator(".assistant-message.user")).toHaveCount(1);

  await panel.locator('[data-assistant-action="language"]').click();
  await expect(panel.getByRole("heading", { name: "¿Cómo puedo ayudarle?" })).toBeVisible();
  await expect(panel.getByPlaceholder("Haga una pregunta…")).toBeVisible();
  // The conversation is still there: switching language is not a new EMMI.
  await expect(panel.locator(".assistant-message.user")).toHaveCount(1);
  await expect(panel.getByRole("button", { name: "¿Qué es ACCESS?" })).toBeVisible();
});

test("Back closes EMMI instead of walking the patient out of enrollment", async ({ page }) => {
  await startHome(page);
  await page.getByRole("button", { name: /See how it works/i }).click();
  await expect(page.getByRole("heading", { name: "Who is completing this?" })).toBeVisible();

  await openEmmiConversation(page);
  await page.goBack();
  await expect(page.locator(".assistant-layer")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Who is completing this?" })).toBeVisible();
});

test("the expanded panel stays usable at 125% and 150% text scaling", async ({ page }) => {
  await startHome(page);
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  const panel = await openEmmiConversation(page);

  for (const scale of [1, 1.25, 1.5]) {
    await page.evaluate(value => { document.documentElement.style.fontSize = `${16 * value}px`; }, scale);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    const audit = await panel.evaluate(layer => {
      const quick = [...layer.querySelectorAll(".assistant-quick button")];
      const controls = [...layer.querySelectorAll("button")].filter(button => button.getClientRects().length);
      return {
        clipped: quick.some(button => button.scrollHeight > button.clientHeight + 1 || button.scrollWidth > button.clientWidth + 1),
        minQuickFont: Math.min(...quick.map(button => parseFloat(getComputedStyle(button).fontSize))),
        minControlHeight: Math.min(...controls.map(button => button.getBoundingClientRect().height)),
        horizontalOverflow: layer.scrollWidth > layer.clientWidth
      };
    });
    expect(audit.clipped, `${scale}x clipping`).toBe(false);
    expect(audit.minQuickFont, `${scale}x quick question font`).toBeGreaterThanOrEqual(17 * scale - 0.5);
    expect(audit.minControlHeight, `${scale}x touch target`).toBeGreaterThanOrEqual(44);
    expect(audit.horizontalOverflow, `${scale}x overflow`).toBe(false);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
});

test("typing keeps the input, the send button and the latest answer in view", async ({ page }) => {
  await startHome(page);
  const panel = await openEmmiConversation(page);
  await panel.getByPlaceholder("Ask a question…").click();
  await panel.getByPlaceholder("Ask a question…").fill("Will I keep my doctor?");

  const visible = await panel.evaluate(layer => {
    const viewport = window.visualViewport?.height || innerHeight;
    const input = layer.querySelector("#assistant-question").getBoundingClientRect();
    const send = layer.querySelector(".assistant-question-form button").getBoundingClientRect();
    return { input: input.bottom <= viewport && input.top >= 0, send: send.bottom <= viewport && send.top >= 0 };
  });
  expect(visible.input).toBe(true);
  expect(visible.send).toBe(true);
  // The pill never sits over the keyboard or the panel.
  await expect(page.locator(".emmi-assistant")).toBeHidden();
});

test("every mobile width keeps one EMMI, readable and inside the shell", async ({ page }) => {
  for (const [width, height] of [[360, 800], [375, 812], [384, 824], [390, 844], [393, 852], [412, 915], [430, 932]]) {
    await page.setViewportSize({ width, height });
    await startHome(page);
    const audit = await page.evaluate(() => {
      const card = document.querySelector(".emmi-welcome").getBoundingClientRect();
      const pill = document.querySelector(".emmi-assistant");
      return {
        cardVisible: card.bottom > 0 && card.top < innerHeight,
        pillVisible: Boolean(pill.getClientRects().length),
        cardContained: card.right <= innerWidth + 1 && card.left >= -1,
        overflow: document.documentElement.scrollWidth > innerWidth
      };
    });
    expect(audit.cardVisible && audit.pillVisible, `${width}px shows one EMMI`).toBe(false);
    expect(audit.cardContained, `${width}px containment`).toBe(true);
    expect(audit.overflow, `${width}px overflow`).toBe(false);

    const panel = await openEmmiConversation(page);
    const panelAudit = await panel.evaluate(layer => ({
      width: layer.getBoundingClientRect().width,
      overflow: layer.scrollWidth > layer.clientWidth
    }));
    expect(panelAudit.overflow, `${width}px panel overflow`).toBe(false);
    expect(panelAudit.width, `${width}px panel width`).toBeLessThanOrEqual(Math.max(width, 384) + 1);
    await panel.locator(".assistant-close").click();
  }
});
