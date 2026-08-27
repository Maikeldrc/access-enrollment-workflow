import { expect } from "@playwright/test";

// EMMI is one assistant in three presentations: the card while it is on screen (the introduction
// on Home, the compact bar everywhere else), the floating pill once the patient scrolls past it,
// and the expanded panel that both of them open. Tests should not have to know which presentation
// the layout picked, only that they end up in the same conversation.

// The pill appears only once EMMI's card has left the viewport, and stands down again wherever it
// would sit on top of the screen's own actions, so finding it means scrolling until it is there.
export async function revealFloatingEmmi(page) {
  const floating = page.locator(".emmi-assistant");
  const maxScroll = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - innerHeight));
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  for (let offset = 160; offset <= maxScroll + 160; offset += 140) {
    await page.evaluate(value => window.scrollTo(0, value), Math.min(offset, maxScroll));
    await settle();
    if (await floating.isVisible()) return floating;
    if (offset >= maxScroll) break;
  }
  return null;
}

export async function openEmmiConversation(page) {
  const compactAsk = page.locator('.emmi-guide [data-action="help"], .emmi-welcome [data-action="help"]');
  if (await compactAsk.count() && await compactAsk.first().isVisible()) {
    await compactAsk.first().click();
  } else {
    const floating = await revealFloatingEmmi(page);
    expect(floating, "floating EMMI should be reachable when no card is on screen").not.toBeNull();
    await floating.click();
  }
  await expect(page.locator(".assistant-layer")).toBeVisible();
  return page.locator(".assistant-layer");
}
