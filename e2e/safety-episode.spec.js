import { expect, test } from "@playwright/test";
import { openEmmiConversation } from "./emmiSurfaces.js";

// The emergency episode, in the browser the patient actually uses.
//
// The 2026-08-30 production validation found that one escalation put EMMI into an emergency-only
// mode that nothing could leave: unrelated questions, explicit statements that 911 had been called
// and help had arrived, and a full page reload all came back as "call 911". The unit tests cover
// the orchestrator; this covers the thing the QA pass was actually looking at.

const EMERGENCY = /call 911|seek emergency care/i;

const ask = async (dialog, question) => {
  const before = await dialog.locator(".assistant-message.assistant:not(.assistant-thinking)").count();
  await dialog.getByPlaceholder("Ask a question…").fill(question);
  await dialog.getByRole("button", { name: "Send question" }).click();
  await expect(dialog.locator(".assistant-message.assistant:not(.assistant-thinking)")).toHaveCount(before + 1, { timeout: 15000 });
  return (await dialog.locator(".assistant-message.assistant").last().textContent())?.trim() || "";
};

const openOnHome = async page => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A smarter way to manage your health" })).toBeVisible();
  return openEmmiConversation(page);
};

test("an emergency holds the conversation, and saying help arrived releases it", async ({ page }) => {
  const dialog = await openOnHome(page);

  expect(await ask(dialog, "I have chest pain and I feel dizzy")).toMatch(EMERGENCY);

  // While it is open, everything else waits. This part was never the defect.
  for (const question of ["What is the comparison group?", "Am I enrolled now?", "What will I pay for ACCESS?"]) {
    expect(await ask(dialog, question), question).toMatch(EMERGENCY);
  }

  // The exact sentence from the production transcript that could not end it. It contains
  // "emergency", which is why the emergency gate kept reading it as a new emergency.
  const acknowledgement = await ask(dialog, "I called 911 and emergency help is on the way.");
  expect(acknowledgement).not.toMatch(EMERGENCY);
  expect(acknowledgement).toMatch(/glad help is with you/i);

  // And now the patient has their assistant back.
  expect(await ask(dialog, "What is ACCESS?")).not.toMatch(EMERGENCY);
});

test("a resolved episode does not come back after a reload", async ({ page }) => {
  const dialog = await openOnHome(page);
  await ask(dialog, "I have chest pain");
  await ask(dialog, "The paramedics are here with me now");

  await page.reload();
  const reopened = await openEmmiConversation(page);
  expect(await ask(reopened, "What is ACCESS?")).not.toMatch(EMERGENCY);
});

test("an unresolved episode does survive a reload", async ({ page }) => {
  const dialog = await openOnHome(page);
  await ask(dialog, "I have chest pain");

  await page.reload();
  const reopened = await openEmmiConversation(page);
  // Still open, because nobody said it was over. This is the half that must not regress.
  expect(await ask(reopened, "What is ACCESS?")).toMatch(EMERGENCY);
});
