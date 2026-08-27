import { expect } from "@playwright/test";

// EMMI is one assistant in three presentations: the compact card while it is on screen, the
// floating pill once the patient scrolls past it, and the expanded panel that pill opens. Tests
// should not have to know which presentation the layout picked, only that they end up in the
// same conversation.
export async function openEmmiConversation(page) {
  const compactAsk = page.locator('.emmi-guide [data-action="help"]');
  if (await compactAsk.count() && await compactAsk.first().isVisible()) {
    await compactAsk.first().click();
  } else {
    // Home keeps the pill as a direct route into the conversation; everywhere else it expands
    // EMMI first, and Ask EMMI leads that panel.
    await page.locator(".emmi-assistant").click();
    const expandedAsk = page.locator('.emmi-sheet [data-action="help"]');
    if (await expandedAsk.count()) await expandedAsk.click();
  }
  await expect(page.locator(".assistant-layer")).toBeVisible();
  return page.locator(".assistant-layer");
}
