import { expect, test } from "@playwright/test";
import { openEmmiConversation } from "./emmiSurfaces.js";

// Expanded EMMI is one conversation in two modes: before the patient has said anything it offers
// ways in, and the moment they do the thread becomes the screen. These tests hold both shapes, and
// the line between them.

const MOBILE_WIDTHS = [360, 375, 384, 390, 393, 412, 430];
const TEXT_SCALES = [1, 1.25, 1.5];

const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const scaleText = async (page, scale) => {
  await page.evaluate(value => { document.documentElement.style.fontSize = `${16 * value}px`; }, scale);
  await settle(page);
};

const openEmmiOnHome = async page => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A smarter way to manage your health" })).toBeVisible();
  return openEmmiConversation(page);
};

const ask = async (dialog, question) => {
  const answered = await dialog.locator(".assistant-message.assistant:not(.assistant-thinking)").count();
  await dialog.getByPlaceholder("Ask a question…").fill(question);
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(dialog.locator(".assistant-message.assistant:not(.assistant-thinking)")).toHaveCount(answered + 1);
};

// MY_CARE lives after enrollment rather than on the enrollment journey, so it is restored the way
// the growth suite restores it.
const openMyCare = async page => {
  await page.goto("/?scenario=access-happy");
  await page.evaluate(() => localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({
    scenarioId: "access-happy", screen: "MY_CARE", role: "patient", completionRole: "patient", identityVerified: true,
    enrollmentConfirmed: true, enrollmentStatus: "COMPLETED", accessOutcome: "eligible", language: "en",
    audit: [], careTeamTasks: [], careMedications: [], careGoals: [], bpReadings: [], bpReadingReceipts: []
  })));
  await page.reload();
  await expect(page.locator(".assistant-layer")).toHaveCount(0);
};

// ---------------------------------------------------------------------------------------------
// Discovery mode
// ---------------------------------------------------------------------------------------------

test("EMMI opens on ways in, not on a help centre", async ({ page }) => {
  const dialog = await openEmmiOnHome(page);
  await expect(dialog).toHaveAttribute("data-assistant-mode", "discovery");

  await expect(dialog.locator(".assistant-identity")).toContainText("Your ITERA Care Assistant");
  await expect(dialog.locator(".assistant-intro p")).toHaveText("I can help you understand your ACCESS care, manage your health, and know what to do next.");
  await expect(dialog.getByRole("button", { name: /Talk to EMMI/ })).toBeVisible();
  await expect(dialog.getByPlaceholder("Ask a question…")).toBeVisible();

  // Suggestions, not a menu: a short contextual list under a conversational label.
  await expect(dialog.locator(".assistant-quick h2")).toHaveText("You might want to ask");
  const suggestions = dialog.locator(".assistant-quick button");
  expect(await suggestions.count()).toBeGreaterThanOrEqual(3);
  expect(await suggestions.count()).toBeLessThanOrEqual(4);

  // The old full-width Close EMMI button is gone; the header X is the way out.
  await expect(dialog.locator(".assistant-back")).toHaveCount(0);
  await expect(dialog.locator(".assistant-close")).toHaveAttribute("aria-label", "Close EMMI");
});

test("sending a typed question clears it from the composer", async ({ page }) => {
  const dialog = await openEmmiOnHome(page);
  const input = dialog.getByPlaceholder("Ask a question…");
  const question = "What is ACCESS?";
  await input.fill(question);

  await dialog.getByRole("button", { name: "Send question" }).click();

  await expect(dialog.getByPlaceholder("Ask a question…")).toHaveValue("");
  await expect(dialog.locator(".assistant-message.user").last()).toContainText(question);
});

test("browsing and human support are available without competing for the screen", async ({ page }) => {
  const dialog = await openEmmiOnHome(page);

  // Human support is one collapsed row until the patient asks for it.
  await expect(dialog.locator(".assistant-support-options")).toHaveCount(0);
  const supportToggle = dialog.getByRole("button", { name: /Need human help/ });
  await expect(supportToggle).toHaveAttribute("aria-expanded", "false");
  await supportToggle.click();
  await expect(dialog.getByRole("link", { name: /Call our care team/ })).toHaveAttribute("href", "tel:+13053948070");
  await expect(dialog.getByRole("button", { name: /Have someone call me/ })).toBeVisible();

  // Neither browse nor support outranks the primary way in.
  const [talk, browse, support] = await Promise.all([
    dialog.locator(".assistant-talk-button").evaluate(node => parseFloat(getComputedStyle(node).fontSize)),
    dialog.locator(".assistant-faq-toggle").evaluate(node => parseFloat(getComputedStyle(node).fontSize)),
    dialog.locator(".assistant-support-toggle").evaluate(node => parseFloat(getComputedStyle(node).fontSize))
  ]);
  expect(browse).toBeLessThanOrEqual(talk);
  expect(support).toBeLessThanOrEqual(talk);

  await expect(dialog.locator(".emmi-disclaimer")).toContainText("EMMI is an AI assistant, not a clinician. For medical emergencies, call 911.");
});

test("the header X returns the patient exactly where they were", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start your care journey" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Let’s securely confirm it’s you" })).toBeVisible();
  await page.locator("#dob").fill("05 / 12 / 1954");

  const scrollBefore = await page.evaluate(() => { window.scrollTo(0, 120); return Math.round(window.scrollY); });
  const dialog = await openEmmiConversation(page);
  await dialog.locator(".assistant-close").click();

  await expect(page.locator(".assistant-layer")).toHaveCount(0);
  // Same screen, same typed answer, same place on it.
  await expect(page.getByRole("heading", { name: "Let’s securely confirm it’s you" })).toBeVisible();
  await expect(page.locator("#dob")).toHaveValue("05 / 12 / 1954");
  expect(Math.abs(await page.evaluate(() => Math.round(window.scrollY)) - scrollBefore)).toBeLessThanOrEqual(2);
});

// ---------------------------------------------------------------------------------------------
// Contextual suggestions
// ---------------------------------------------------------------------------------------------

test("the suggestions belong to the screen the patient is looking at", async ({ page }) => {
  const expected = {
    INVITATION: ["What is ACCESS?", "How can this help me?", "Will Dr. Fresner still be involved?"],
    IDENTITY_VERIFICATION: ["Why do you need this information?", "Is my information secure?", "Who invited me?"],
    CARE_RECOMMENDATION: ["How will the blood pressure monitor help me?", "What is my care plan?", "Will Dr. Fresner still be involved?"],
    ACCESS_PRE_ELIGIBILITY_NOTICE: ["Why does Medicare need to verify me?", "Will this change my Medicare?", "What is the comparison group?"],
    ACCESS_ELIGIBILITY_RESULT: ["What happens next?", "Am I enrolled yet?", "What will I review next?"],
    CONSENT_REVIEW: ["Do I have to enroll?", "Will this change my Medicare?", "Why is my expected payment $0?", "Can I change my mind later?"],
    ENROLLMENT_CONFIRMED: ["What happens next?", "How do I get my blood pressure monitor?", "What will my care plan include?", "What goals will I work on?"],
    MY_CARE: ["How is my blood pressure doing?", "What should I do next?", "I need an appointment", "How can I contact my care team?"]
  };
  const { MY_CARE, ...onTheJourney } = expected;
  await page.goto("/?scenario=access-happy");
  for (const [screen, questions] of Object.entries(onTheJourney)) {
    await page.locator("#screen-select").selectOption(screen, { force: true });
    const dialog = await openEmmiConversation(page);
    const labels = await dialog.locator(".assistant-quick button").allInnerTexts();
    for (const question of questions) expect(labels, `${screen} should suggest "${question}"`).toContain(question);
    expect(labels.length, `${screen} suggestion count`).toBeLessThanOrEqual(4);
    await dialog.locator(".assistant-close").click();
    await expect(page.locator(".assistant-layer")).toHaveCount(0);
  }

  await openMyCare(page);
  const myCare = await openEmmiConversation(page);
  const myCareLabels = await myCare.locator(".assistant-quick button").allInnerTexts();
  for (const question of MY_CARE) expect(myCareLabels, `MY_CARE should suggest "${question}"`).toContain(question);
  expect(myCareLabels.length, "MY_CARE suggestion count").toBeLessThanOrEqual(4);
});

test("the referring physician is named in a suggestion only when the invitation named one", async ({ page }) => {
  const dialog = await openEmmiOnHome(page);
  await expect(dialog.locator(".assistant-quick")).toContainText("Will Dr. Fresner still be involved?");
  await dialog.locator(".assistant-close").click();

  // Direct outreach has no physician, so the slot drops rather than inventing a stand-in.
  await page.goto("/?admin=1");
  await page.evaluate(() => localStorage.removeItem("itera.prototype.config.v1"));
  await page.reload();
  await page.getByRole("button", { name: /Launch Patient Experience/ }).click();
  const direct = await openEmmiConversation(page);
  await expect(direct.locator(".assistant-quick")).not.toContainText("Dr. Fresner");
  expect(await direct.locator(".assistant-quick button").count()).toBeGreaterThanOrEqual(3);
});

// ---------------------------------------------------------------------------------------------
// Active conversation mode
// ---------------------------------------------------------------------------------------------

test("the first question turns the panel into the conversation", async ({ page }) => {
  const dialog = await openEmmiOnHome(page);
  await dialog.locator(".assistant-quick button").first().click();
  await expect(dialog).toHaveAttribute("data-assistant-mode", "conversation");

  // The landing content stops taking up the screen the thread now needs.
  await expect(dialog.locator(".assistant-intro")).toHaveCount(0);
  await expect(dialog.locator(".assistant-talk-button")).toHaveCount(0);
  await expect(dialog.locator(".assistant-quick")).toHaveCount(0);

  await expect(dialog.locator(".assistant-message.user")).toHaveCount(1);
  await expect(dialog.locator(".assistant-message.assistant").last()).toBeVisible();
  // Human support and the safety note survive the switch; they just sit under the thread.
  await expect(dialog.getByRole("button", { name: /Need human help/ })).toBeVisible();
  await expect(dialog.locator(".emmi-disclaimer")).toBeVisible();
});

test("the composer stays under the patient's thumb while the thread scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 760 });
  const dialog = await openEmmiOnHome(page);
  await ask(dialog, "What is ACCESS?");
  await expect(dialog).toHaveAttribute("data-assistant-mode", "conversation");
  await ask(dialog, "Will I keep my doctor?");
  await expect(dialog.locator(".assistant-message.assistant")).toHaveCount(2);

  const geometry = await page.evaluate(() => {
    const layer = document.querySelector(".assistant-layer");
    const body = layer.querySelector(".assistant-content");
    const dock = layer.querySelector(".assistant-composer-dock");
    const input = layer.querySelector("#assistant-question");
    return {
      dockBottom: dock.getBoundingClientRect().bottom,
      inputTop: input.getBoundingClientRect().top,
      bodyBottom: body.getBoundingClientRect().bottom,
      viewport: innerHeight,
      bodyScrolls: body.scrollHeight > body.clientHeight,
      atBottom: body.scrollHeight - body.scrollTop - body.clientHeight
    };
  });
  // The composer is a row of the panel, not something the thread can push off-screen.
  expect(geometry.dockBottom).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.inputTop).toBeGreaterThanOrEqual(geometry.bodyBottom - 1);
  // Sending leaves the patient at the live end of the conversation.
  expect(geometry.atBottom).toBeLessThanOrEqual(96);
});

test("re-reading an earlier answer is not interrupted by a new one", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 760 });
  const dialog = await openEmmiOnHome(page);
  await ask(dialog, "What is ACCESS?");
  await ask(dialog, "Will I keep my doctor?");
  await ask(dialog, "Will this affect my Medicare?");
  await expect(dialog.locator(".assistant-message.assistant")).toHaveCount(3);

  // Scroll back to the top of the thread, then let another answer arrive.
  await page.evaluate(() => { document.querySelector(".assistant-content").scrollTop = 0; });
  const before = await page.evaluate(() => document.querySelector(".assistant-content").scrollTop);
  expect(before).toBe(0);
  await page.evaluate(() => {
    const input = document.querySelector("#assistant-question");
    input.value = "What happens next?";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(dialog.locator(".assistant-message.assistant")).toHaveCount(4);
  const after = await page.evaluate(() => document.querySelector(".assistant-content").scrollTop);
  expect(after, "a patient reading history is not yanked to the bottom").toBeLessThanOrEqual(120);
});

test("follow-up suggestions come from the answer, not from a fixed list", async ({ page }) => {
  const dialog = await openEmmiOnHome(page);
  await ask(dialog, "What is ACCESS?");
  const afterProgram = await dialog.locator(".assistant-followups button").allInnerTexts();
  expect(afterProgram.length).toBeGreaterThan(0);
  expect(afterProgram.length).toBeLessThanOrEqual(3);

  await ask(dialog, "How much will I pay?");
  const afterCost = await dialog.locator(".assistant-followups button").allInnerTexts();
  expect(afterCost.length).toBeGreaterThan(0);
  expect(afterCost, "different answers get different follow-ups").not.toEqual(afterProgram);
});

test("voice and text are one conversation that survives closing the panel", async ({ page }) => {
  const dialog = await openEmmiOnHome(page);
  await ask(dialog, "What is ACCESS?");
  await expect(dialog.locator(".assistant-message")).toHaveCount(2);

  await dialog.locator(".assistant-close").click();
  await expect(page.locator(".assistant-layer")).toHaveCount(0);

  const reopened = await openEmmiConversation(page);
  // The thread is still there, and EMMI does not introduce herself a second time.
  await expect(reopened).toHaveAttribute("data-assistant-mode", "conversation");
  await expect(reopened.locator(".assistant-message")).toHaveCount(2);
  await expect(reopened).not.toContainText("Hi, I’m EMMI. How can I help?");

  // The microphone is the same conversation, reachable without leaving the composer.
  await expect(reopened.locator(".assistant-composer-mic")).toHaveAttribute("aria-label", /Ask by voice|Voice options/);
});

test("asking for a person is an action, and the callback still asks first", async ({ page }) => {
  const dialog = await openEmmiOnHome(page);
  await dialog.getByRole("button", { name: /Need human help/ }).click();
  await dialog.getByRole("button", { name: /Have someone call me/ }).click();

  // One tap opens the question, never the request.
  await expect(dialog.getByText("Would you like me to ask the ITERA care team to call you?")).toBeVisible();
  const logsBefore = await page.evaluate(() => JSON.parse(sessionStorage.getItem("itera.emmi.prototype.audit.v1") || "[]"));
  expect(logsBefore.at(-1)?.callbackRequested ?? false).toBe(false);

  await ask(dialog, "Yes");
  await expect(dialog.getByText("Done. I sent a callback request to the care team.")).toBeVisible();
});

test("wanting the care team reaches the care team rather than an explanation of one", async ({ page }) => {
  await openMyCare(page);
  const dialog = await openEmmiConversation(page);
  await ask(dialog, "I want to talk to my care team.");
  const answer = dialog.locator(".assistant-message.assistant").last();
  await expect(answer).toBeVisible();
  // An operational request is answered with a way to reach someone, not with a definition.
  await expect(answer).not.toContainText(/a care team is|care team refers to/i);
});

// ---------------------------------------------------------------------------------------------
// Responsive, language and accessibility
// ---------------------------------------------------------------------------------------------

test("both modes hold their layout at every supported width and text size", async ({ page }) => {
  const dialog = await openEmmiOnHome(page);
  const audit = async label => {
    const result = await page.evaluate(() => {
      const layer = document.querySelector(".assistant-layer");
      const body = layer.querySelector(".assistant-content");
      const dock = layer.querySelector(".assistant-composer-dock");
      const targets = [...layer.querySelectorAll(".assistant-close, .assistant-question-form button, .assistant-quick button, .assistant-support-toggle, .assistant-talk-button")];
      return {
        overflowX: layer.scrollWidth - layer.clientWidth,
        bodyWithinLayer: body.getBoundingClientRect().bottom <= layer.getBoundingClientRect().bottom + 1,
        dockBottom: dock ? dock.getBoundingClientRect().bottom : null,
        layerBottom: layer.getBoundingClientRect().bottom,
        smallestTarget: Math.min(...targets.map(node => Math.min(node.getBoundingClientRect().width, node.getBoundingClientRect().height)))
      };
    });
    expect(result.overflowX, `horizontal overflow at ${label}`).toBeLessThanOrEqual(1);
    expect(result.bodyWithinLayer, `thread inside the panel at ${label}`).toBe(true);
    if (result.dockBottom !== null) expect(result.dockBottom, `composer inside the panel at ${label}`).toBeLessThanOrEqual(result.layerBottom + 1);
    expect(result.smallestTarget, `smallest control at ${label}`).toBeGreaterThanOrEqual(44);
  };

  for (const width of MOBILE_WIDTHS) {
    for (const scale of TEXT_SCALES) {
      await page.setViewportSize({ width, height: 844 });
      await scaleText(page, scale);
      await audit(`discovery ${width}px / ${scale * 100}%`);
    }
  }

  await page.setViewportSize({ width: 384, height: 844 });
  await scaleText(page, 1);
  await ask(dialog, "What is ACCESS?");
  await expect(dialog).toHaveAttribute("data-assistant-mode", "conversation");
  for (const width of MOBILE_WIDTHS) {
    for (const scale of TEXT_SCALES) {
      await page.setViewportSize({ width, height: 844 });
      await scaleText(page, scale);
      await audit(`conversation ${width}px / ${scale * 100}%`);
    }
  }
});

test("EMMI opens in the patient's language", async ({ page }) => {
  await page.goto("/");
  await page.locator(".stage-language").click();
  await page.getByRole("button", { name: "Comience su recorrido de cuidado" }).click();
  await page.locator(".back-button").click();
  const dialog = await openEmmiConversation(page);
  await expect(dialog.locator(".assistant-quick h2")).toHaveText("Quizá quiera preguntar");
  await expect(dialog.getByRole("button", { name: /Necesita ayuda de una persona/ })).toBeVisible();
  await expect(dialog.locator(".assistant-intro p")).toContainText("Puedo ayudarle a entender su cuidado ACCESS");
  await expect(dialog.locator(".assistant-content")).not.toContainText("You might want to ask");
});

test("the panel is a dialog that hands focus over and gives it back", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /Ask EMMI/ });
  await trigger.click();
  const dialog = page.locator(".assistant-layer");
  await expect(dialog).toHaveAttribute("role", "dialog");
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog).toHaveAttribute("aria-label", "EMMI – Your ITERA Care Assistant");
  await expect(page.locator("#assistant-title")).toBeFocused();

  await dialog.locator(".assistant-close").click();
  await expect(page.locator(".assistant-layer")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

// ---------------------------------------------------------------------------------------------
// Phase 2 — the patient's own language
// ---------------------------------------------------------------------------------------------

test("writing in another language is offered, not imposed", async ({ page }) => {
  const dialog = await openEmmiOnHome(page);
  await ask(dialog, "What is ACCESS?");
  const before = await dialog.locator(".assistant-message").count();

  // The first Spanish message asks once, in Spanish, and answers nothing else yet.
  await dialog.getByPlaceholder("Ask a question…").fill("¿Qué es ACCESS y cómo me ayuda?");
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(dialog.locator(".assistant-message").last()).toContainText("¿Quiere que continuemos en español?");
  expect(await dialog.locator(".assistant-message").count()).toBe(before + 2);
  // Offering is not switching: the panel is still English until the patient says so.
  await expect(dialog.getByPlaceholder("Ask a question…")).toBeVisible();
});

test("saying yes naturally moves the whole conversation without starting a new one", async ({ page }) => {
  const dialog = await openEmmiOnHome(page);
  await ask(dialog, "What is ACCESS?");
  await dialog.getByPlaceholder("Ask a question…").fill("¿Qué es ACCESS y cómo me ayuda?");
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(dialog.locator(".assistant-message").last()).toContainText("¿Quiere que continuemos en español?");

  // Real speech transcription includes capitalization and punctuation.
  await dialog.getByPlaceholder("Ask a question…").fill("Sí.");
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(page.locator(".assistant-layer").locator(".assistant-conversation")).toContainText("seguimos en español");

  const panel = page.locator(".assistant-layer");
  // Text and voice share one activeLocale, so the whole surface moves at once.
  await expect(panel.getByPlaceholder("Haga una pregunta…")).toBeVisible();
  await expect(panel.locator(".language")).toContainText("ES");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  // Same conversation: the English turns are still there and EMMI does not say hello again.
  await expect(panel.locator(".assistant-message.user").first()).toContainText("What is ACCESS?");
  await expect(panel).not.toContainText("Hola, soy EMMI");
  await expect(panel).toHaveAttribute("data-assistant-mode", "conversation");
});

test("Spanish monitor shipping questions use fulfillment data and never invent a date", async ({ page }) => {
  const dialog = await openEmmiOnHome(page);
  await dialog.getByPlaceholder("Ask a question…").fill("¿Qué es ACCESS y cómo me ayuda?");
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(dialog.locator(".assistant-message").last()).toContainText("¿Quiere que continuemos en español?");
  await dialog.getByPlaceholder("Ask a question…").fill("Sí.");
  await dialog.getByRole("button", { name: "Send question" }).click();

  const panel = page.locator(".assistant-layer");
  await panel.getByPlaceholder("Haga una pregunta…").fill("¿Cuándo me van a enviar el monitor?");
  await panel.getByRole("button", { name: "Enviar pregunta" }).click();
  const answer = panel.locator(".assistant-message.assistant:not(.assistant-thinking)").last();
  await expect(answer).toContainText(/solicitud de envío|solicitud de su monitor/i);
  await expect(answer).toContainText(/no puedo darle una fecha|todavía no.*fecha/i);
  await expect(answer).not.toContainText(/ACCESS es una opción|programa de cuidado/i);
});

test("immediate follow-ups preserve the referent and simplify the prior answer", async ({ page }) => {
  const dialog = await openEmmiOnHome(page);
  await ask(dialog, "What happens next?");
  await ask(dialog, "Can you explain that more simply?");
  const answer = dialog.locator(".assistant-message.assistant:not(.assistant-thinking)").last();
  await expect(answer).toContainText(/In simple terms/i);
  await expect(answer).toContainText(/Start your care journey/i);
});

test("carrying on in a language is a clearer answer than any confirmation", async ({ page }) => {
  const dialog = await openEmmiOnHome(page);
  await dialog.getByPlaceholder("Ask a question…").fill("Mwen bezwen èd ak tansyon mwen");
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(dialog.locator(".assistant-message").last()).toContainText("Èske ou vle nou kontinye an kreyòl?");

  // No yes, no no — just another message in the same language.
  await dialog.getByPlaceholder("Ask a question…").fill("Kisa ACCESS ye epi kijan li ede m?");
  await dialog.getByRole("button", { name: "Send question" }).click();
  const panel = page.locator(".assistant-layer");
  await expect(panel.locator(".assistant-conversation")).toContainText("n ap kontinye an kreyòl");
  await expect(panel.locator(".language")).toContainText("KR");
  await expect(page.locator("html")).toHaveAttribute("lang", "ht");
  // KR is Haitian Creole in this product, and nothing Korean may appear.
  await expect(panel).not.toContainText(/[가-힯]/);
});

test("the offer is made once, not on every turn", async ({ page }) => {
  const dialog = await openEmmiOnHome(page);
  await dialog.getByPlaceholder("Ask a question…").fill("¿Qué es ACCESS y cómo me ayuda?");
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(dialog.locator(".assistant-message").last()).toContainText("¿Quiere que continuemos en español?");

  await dialog.getByPlaceholder("Ask a question…").fill("no");
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(dialog.locator(".assistant-message.assistant:not(.assistant-thinking)")).toHaveCount(2);

  // Declining is remembered: another Spanish message is answered, not re-interrogated.
  await dialog.getByPlaceholder("Ask a question…").fill("Necesito ayuda con mi presión arterial");
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(dialog.locator(".assistant-message.assistant:not(.assistant-thinking)")).toHaveCount(3);
  const offers = await dialog.locator(".assistant-message", { hasText: "¿Quiere que continuemos en español?" }).count();
  expect(offers, "the language question is asked once").toBe(1);
});

test("a quick question in EMMI's own words never triggers a language offer", async ({ page }) => {
  await page.goto("/");
  await page.locator(".stage-language").click();
  await page.getByRole("button", { name: "Comience su recorrido de cuidado" }).click();
  await page.locator(".back-button").click();
  const dialog = await openEmmiConversation(page);

  // The panel is in Spanish; its own Spanish suggestions must not read as the patient switching.
  await dialog.locator(".assistant-quick button").first().click();
  await expect(dialog.locator(".assistant-message.assistant:not(.assistant-thinking)")).toHaveCount(1);
  await expect(dialog).not.toContainText("Would you like me to continue");
  await expect(dialog.locator(".language")).toContainText("ES");
});

// Reopening lands on the newest turn, not the oldest.
//
// The live re-test of 2026-08-30 closed a long thread, reopened it, and was shown the screen
// narration from the start of the session instead of the answer it had just been given. Reopening
// inserts the panel fresh, and a freshly inserted scroll container starts at the top — which, in a
// conversation, is the oldest thing in it.
test("reopening a long conversation lands on the newest turn", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  const dialog = await openEmmiOnHome(page);

  for (const question of ["What is ACCESS?", "How does it help me?", "Do I have to enroll?", "Who is my care team?"]) {
    await ask(dialog, question);
  }

  const thread = dialog.locator(".assistant-content");
  const lastMessage = dialog.locator(".assistant-message").last();
  const lastText = (await lastMessage.textContent())?.trim();
  expect(lastText).toBeTruthy();

  // Long enough that top and bottom are genuinely different places.
  const overflows = await thread.evaluate(node => node.scrollHeight - node.clientHeight > 120);
  expect(overflows, "the thread has to overflow for this test to mean anything").toBe(true);

  await dialog.locator(".assistant-close").click();
  await expect(page.locator(".assistant-layer")).toHaveCount(0);

  const reopened = await openEmmiConversation(page);
  const reopenedThread = reopened.locator(".assistant-content");
  await settle(page);

  const distanceFromBottom = await reopenedThread.evaluate(node => node.scrollHeight - node.scrollTop - node.clientHeight);
  expect(distanceFromBottom, "reopened away from the newest turn").toBeLessThanOrEqual(96);
  await expect(reopened.locator(".assistant-message").last()).toBeInViewport();
});
