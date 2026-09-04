// Runs the audit's voice conversations on the harness and writes one transcript per session.
//   node reports/emmi-voice-audit/harness/run-sessions.mjs [sessionId ...]   (default: all)
//   PROVIDER=fake|real  OUT_DIR=...  TTS_WPS=...
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launchHarness, openApp, startVoice, SessionRecorder, appointment, waitForIdle, BASE, PROVIDER, viewProbe } from "./voice-harness.mjs";
import { SCENARIOS } from "./scenarios.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT_DIR || join(HERE, "..", "transcripts");
const wanted = process.argv.slice(2);
// Scenarios that need a specially configured dev server (requiresEnv) only run when named explicitly.
const selected = wanted.length ? SCENARIOS.filter(s => wanted.includes(s.id)) : SCENARIOS.filter(s => !s.requiresEnv);
const results = [];
for (const scenario of selected) {
  const harness = await launchHarness({ locale: scenario.language === "en" ? "en-US" : "es-US" });
  const { page } = harness;
  const recorder = new SessionRecorder(page, { sessionId: scenario.id, profile: scenario.profile, language: scenario.language, flow: scenario.flow, notes: scenario.notes || "", ttsRequests: harness.ttsRequests });
  try {
    await openApp(page, { seed: scenario.seed ? scenario.seed(appointment) : null, url: scenario.url ? `${BASE}${scenario.url}` : undefined, careCircle: scenario.careCircle || null });
    if (scenario.fake) await page.evaluate(options => Object.assign(window.__fakeLive.options, options), scenario.fake);
    await recorder.begin();
    if (scenario.before) await scenario.before({ page, recorder });
    const start = await startVoice(page);
    recorder.observe(`voice start: state ${start.probe?.state}, socket ${start.probe?.socket}, error "${start.probe?.error}", ${start.connectMs} ms after tap`);
    await waitForIdle(page, { timeoutMs: 60000 });
    for (const step of scenario.steps) {
      if (step.speak) await recorder.speak({ ...step.speak });
      else if (step.navigate) await recorder.navigate({ ...step.navigate });
      else if (step.silence) await recorder.silence({ ...step.silence });
      else if (step.typed) await recorder.typed({ ...step.typed });
      else if (step.custom) await step.custom({ page, recorder, harness });
      else if (step.observe) recorder.observe(step.observe);
    }
  } catch (error) {
    recorder.observe(`HARNESS ERROR: ${error?.stack || error}`);
  }
  recorder.session.console_issues = harness.issues.slice(0, 40);
  recorder.session.tts_requests = harness.ttsRequests;
  const session = await recorder.finish(OUT);
  results.push({ id: session.session_id, summary: session.summary });
  console.log(`\n=== ${session.session_id} (${session.patient_profile}, ${session.language}, ${session.flow})`);
  console.log(JSON.stringify(session.summary, null, 1));
  await harness.browser.close();
}
console.log(`\nWrote ${results.length} session(s) to ${OUT}`);
