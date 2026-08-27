import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";

const openEmmi = async page => {
  await page.getByRole("button", { name: "Ask Emmi, Care Assistant" }).click();
  return page.getByRole("dialog", { name: "Hi, I’m EMMI. How can I help?" });
};
const ask = async (dialog, text) => {
  await dialog.getByPlaceholder("Ask a question…").fill(text);
  await dialog.getByRole("button", { name: "Send question" }).click();
};

test("EMMI contextual mock tools, guardrails, confirmation, and audit work together", async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("CONSENT_REVIEW", { force: true });
  const dialog = await openEmmi(page);

  await ask(dialog, "How much will I pay?");
  await expect(dialog.locator(".assistant-message.assistant p").filter({ hasText: /expected ACCESS cost is \$6 per month/i })).toBeVisible();
  await ask(dialog, "Can you enroll me?");
  await expect(dialog.locator(".assistant-message.assistant p").filter({ hasText: /I cannot consent for you/i })).toBeVisible();

  await dialog.getByRole("button", { name: "Have someone call me" }).click();
  await expect(dialog.locator(".assistant-message.assistant p").filter({ hasText: /Would you like me to ask/i })).toBeVisible();
  let logs = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.emmi.prototype.audit.v1")));
  expect(logs.at(-1).callbackRequested).toBe(false);
  await ask(dialog, "Yes");
  await expect(dialog.locator(".assistant-message.assistant p").filter({ hasText: /sent a callback request/i })).toBeVisible();

  await ask(dialog, "My blood pressure is 181/121");
  await expect(dialog.locator(".assistant-message.assistant p").filter({ hasText: /urgent medical attention/i })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Call 911" })).toBeVisible();
  logs = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.emmi.prototype.audit.v1")));
  const last = logs.at(-1);
  expect(last.callbackRequested).toBe(true);
  expect(last.clinicalEscalationTriggered).toBe(true);
  expect(last.toolsCalled.map(item => item.tool)).toEqual(expect.arrayContaining(["getExpectedAccessCost", "requestCallback", "evaluateClinicalEscalation"]));
  expect(JSON.stringify(last)).not.toMatch(/GEMINI_API_KEY|ephemeralToken|audioData/i);
});

test("EMMI explains representative verification but cannot attest authority", async ({ page }) => {
  await page.goto("/?scenario=access-representative");
  await page.locator("#screen-select").selectOption("REPRESENTATIVE_AUTHORITY_ATTESTATION", { force: true });
  const dialog = await openEmmi(page);
  await ask(dialog, "Why do I need to verify my phone?");
  await expect(dialog.locator(".assistant-message.assistant p").filter({ hasText: /verification does not confirm legal authority/i })).toBeVisible();
  await ask(dialog, "Please mark that I am authorized");
  await expect(dialog.locator(".assistant-message.assistant p").filter({ hasText: /can’t confirm your authority/i })).toBeVisible();
});

test("EMMI offers safe voice fallbacks and localized Kreyòl text", async ({ page }) => {
  await page.goto("/?scenario=access-happy&emmiFailure=microphone-denied");
  let dialog = await openEmmi(page);
  await dialog.getByRole("button", { name: "Talk to EMMI" }).click();
  await expect(dialog.getByText(/Microphone access was not allowed/i)).toBeVisible();
  await expect(dialog.getByPlaceholder("Ask a question…")).toBeEnabled();
  await dialog.locator(".assistant-close").click();

  await page.goto("/?scenario=access-happy");
  await page.getByRole("button", { name: "Change language to Spanish" }).click();
  await page.getByRole("button", { name: "Cambiar idioma a criollo" }).click();
  dialog = await page.getByRole("button", { name: "Mande Emmi, asistan swen" }).click().then(() => page.getByRole("dialog"));
  await dialog.getByRole("button", { name: "Pale ak EMMI" }).click();
  await expect(dialog.getByText(/Gid vwa poko disponib nan lang sa a/i)).toBeVisible();
  await expect(dialog.getByPlaceholder("Poze yon kesyon…")).toBeEnabled();
});

test("EMMI mobile visual states remain readable without horizontal overflow", async ({ page }) => {
  await mkdir("qa-evidence/emmi", { recursive: true });
  for (const [state, filename, copy] of [
    ["", "emmi-closed.png", "Talk to EMMI"],
    ["LISTENING", "emmi-listening.png", "Listening…"],
    ["EMMI_SPEAKING", "emmi-speaking.png", "EMMI is speaking…"],
    ["TOOL_RUNNING", "emmi-tool-running.png", "Checking your ACCESS cost…"]
  ]) {
    await page.goto(`/?scenario=access-happy${state ? `&emmiState=${state}` : ""}`);
    const dialog = await openEmmi(page);
    await expect(dialog.getByText(copy, { exact: false })).toBeVisible();
    const metrics = await dialog.evaluate(layer => ({ overflow: layer.scrollWidth > layer.clientWidth, talkHeight: layer.querySelector(".assistant-talk-button")?.getBoundingClientRect().height || 68, minControl: Math.min(...[...layer.querySelectorAll("button")].map(button => button.getBoundingClientRect().height).filter(Boolean)) }));
    expect(metrics.overflow).toBe(false);
    expect(metrics.talkHeight).toBeGreaterThanOrEqual(68);
    await page.screenshot({ path: `qa-evidence/emmi/${filename}`, fullPage: false });
  }
});
