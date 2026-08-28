// Changing the root font size does not lay the page out synchronously: the browser schedules the
// layout and the app re-renders on the frame after that. Waiting a single frame can therefore
// measure the geometry from before the re-render. Waiting two is the same wait emmiSurfaces.js
// already uses before it looks for the floating pill.
//
// This fixes the measurement, not the threshold, so a real layout regression still fails. It is a
// correctness fix in the harness rather than a cure for a specific red run: the geometry failures
// that prompted it turned out to be resource exhaustion on a loaded machine, not mistimed reads.
export const settleLayout = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

// Text scaling is expressed the way the tests already express it: a multiplier on the 16px root,
// which is what a patient's browser or OS setting actually changes.
export async function scaleTextAndSettle(page, scale) {
  await page.evaluate(value => { document.documentElement.style.fontSize = `${16 * value}px`; }, scale);
  await settleLayout(page);
}
