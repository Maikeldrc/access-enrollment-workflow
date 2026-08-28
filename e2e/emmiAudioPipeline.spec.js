import { expect, test } from "@playwright/test";

// Counts pipeline construction from inside the page so the assertions are about what the browser
// actually built, not about what the source looks like.
const instrumentAudio = page => page.addInitScript(() => {
  window.__emmiAudit = { audioContexts: 0, workletNodes: 0, scriptProcessors: 0, workletModules: [], micStreams: 0 };
  const NativeAudioContext = window.AudioContext;
  window.AudioContext = class extends NativeAudioContext {
    constructor(...args) {
      super(...args);
      window.__emmiAudit.audioContexts += 1;
      const addModule = this.audioWorklet.addModule.bind(this.audioWorklet);
      this.audioWorklet.addModule = url => { window.__emmiAudit.workletModules.push(String(url)); return addModule(url); };
      const nativeScriptProcessor = this.createScriptProcessor.bind(this);
      this.createScriptProcessor = (...rest) => {
        window.__emmiAudit.scriptProcessors += 1;
        return nativeScriptProcessor(...rest);
      };
    }
  };
  const NativeWorkletNode = window.AudioWorkletNode;
  window.AudioWorkletNode = class extends NativeWorkletNode {
    constructor(...args) { super(...args); window.__emmiAudit.workletNodes += 1; }
  };
  const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = constraints => {
    window.__emmiAudit.micStreams += 1;
    return nativeGetUserMedia(constraints);
  };
});

const audit = page => page.evaluate(() => window.__emmiAudit);

async function startVoice(page) {
  await page.evaluate(() => localStorage.setItem("itera.emmi.preferences.v1", JSON.stringify({ emmiVoiceGuidance: false, emmiWelcomeAcknowledged: false })));
  await page.reload();
  await page.getByRole("button", { name: /Guide by voice/ }).click();
  // The worklet module load is the first thing the new pipeline does once the socket opens.
  await expect.poll(() => audit(page).then(value => value.workletNodes), { timeout: 15000 }).toBeGreaterThan(0);
}

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  await instrumentAudio(page);
  await page.goto("/?scenario=access-happy");
});

test("EMMI captures microphone audio through an AudioWorklet, never a ScriptProcessorNode", async ({ page }) => {
  const deprecations = [];
  page.on("console", message => {
    if (/ScriptProcessorNode/i.test(message.text())) deprecations.push(message.text());
  });

  await startVoice(page);
  const result = await audit(page);

  // The acceptance criterion: the deprecated node is never constructed, and the modern one is.
  expect(result.scriptProcessors).toBe(0);
  expect(result.workletNodes).toBe(1);
  expect(deprecations).toEqual([]);

  // The worklet is loaded from a real served asset, not a blob URL that would need a CSP relaxation.
  expect(result.workletModules).toHaveLength(1);
  expect(result.workletModules[0]).toMatch(/^\/audio\/emmi-mic-processor\.js/);
  expect(result.workletModules[0]).not.toMatch(/^blob:/);

  // One microphone, one capture context for it plus the fixed-rate playback context.
  expect(result.micStreams).toBe(1);
  expect(result.audioContexts).toBeLessThanOrEqual(2);
});

test("navigating screens and reopening EMMI reuses the same audio pipeline", async ({ page }) => {
  await startVoice(page);
  const before = await audit(page);

  for (const screen of ["DECISION_MAKER", "IDENTITY_VERIFICATION", "CARE_RECOMMENDATION", "CONSENT_REVIEW", "ENROLLMENT_CONFIRMED"]) {
    await page.locator("#screen-select").selectOption(screen, { force: true });
    await page.waitForTimeout(150);
  }
  // Compact, floating and expanded are presentations of one session, not new pipelines.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
  for (let index = 0; index < 3; index += 1) {
    const pill = page.locator(".emmi-assistant");
    if (!(await pill.isVisible())) break;
    await pill.click();
    const close = page.locator(".emmi-sheet-done");
    if (await close.count()) await close.click();
  }

  const after = await audit(page);
  expect(after.workletNodes).toBe(before.workletNodes);
  expect(after.audioContexts).toBe(before.audioContexts);
  expect(after.micStreams).toBe(before.micStreams);
  expect(after.scriptProcessors).toBe(0);
});

test("turning voice off releases the microphone and turning it back on builds one clean pipeline", async ({ page }) => {
  await startVoice(page);
  await page.getByRole("button", { name: /Turn voice off/ }).click();
  await expect.poll(() => page.evaluate(() =>
    performance.now() && !document.querySelector('[data-voice-state="LISTENING"]')), { timeout: 10000 }).toBe(true);

  await page.getByRole("button", { name: /Guide by voice/ }).click();
  await expect.poll(() => audit(page).then(value => value.workletNodes), { timeout: 15000 }).toBe(2);
  const result = await audit(page);
  // A restart builds exactly one more pipeline, never a second one layered on the first.
  expect(result.scriptProcessors).toBe(0);
  expect(result.micStreams).toBe(2);
});

test("rapid voice toggling never leaves a duplicate pipeline or an unhandled rejection", async ({ page }) => {
  const rejections = [];
  page.on("pageerror", error => rejections.push(error.message));
  await startVoice(page);
  for (let index = 0; index < 3; index += 1) {
    await page.getByRole("button", { name: /Turn voice off/ }).click();
    await page.waitForTimeout(250);
    await page.getByRole("button", { name: /Guide by voice/ }).click();
    await page.waitForTimeout(400);
  }
  const result = await audit(page);
  expect(result.scriptProcessors).toBe(0);
  // One pipeline per start, never more than one per start.
  expect(result.workletNodes).toBeLessThanOrEqual(result.micStreams);
  expect(rejections).toEqual([]);
});
