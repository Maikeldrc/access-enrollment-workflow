// Voice conversation harness for EMMI.
//
// Drives the real application in Chromium with a fake microphone the "patient" speaks through and,
// when no GEMINI_API_KEY is available, an in-page double of the Gemini Live provider (see
// fake-provider.js). Every turn is recorded with the fields the audit asks for, plus the timing
// breakdown the application makes observable: end of patient speech, provider end-of-speech
// detection, first audio chunk, first audible audio, audio drained, barge-in stop latency, and the
// messages the app actually put on the socket (context envelopes, narration, recovery prompts,
// tool responses).
//
// PROVIDER MODES
//   fake   (default) — scripted double; transcripts and replies are declared by the scenario.
//   real   (PROVIDER=real) — no double is installed; the app talks to Gemini Live through its own
//           token route. Requires GEMINI_API_KEY on the dev server. Replies are then genuine.
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { getEmmiVoiceIdentity } from "../../../src/emmi/voiceIdentity.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
export const PROVIDER = process.env.PROVIDER || "fake";
const TTS_WPS = Number(process.env.TTS_WPS) || 2.4;

/* ----------------------------------------------------------------------------- seeding --- */
export const inDays = (days, hour = 10) => { const when = new Date(); when.setDate(when.getDate() + days); when.setHours(hour, 30, 0, 0); return when.toISOString(); };
export const appointment = (overrides = {}) => ({
  id: "appt-1", patientId: "patient_demo", source: "PATIENT_DIRECT_REQUEST", reasonCategory: "ROUTINE_FOLLOW_UP", reasonSummary: "",
  relatedGoalId: "", relatedBarrierId: "", relatedRefillId: "", requestedProfessionalId: "dr-fresner", requestedProfessionalType: "PRIMARY_CARE",
  requestedSpecialty: "", providerDisplayName: "Dr. Fresner Lee", practiceName: "", preferredModality: "NO_PREFERENCE", preferredTimeOfDay: "NO_PREFERENCE",
  preferredDateRange: null, urgencyClassification: "ROUTINE", schedulingCapability: "DIRECT_BOOKING", status: "CONFIRMED",
  scheduledAt: inDays(3, 14), scheduledEndAt: inDays(3, 15), timezone: "America/New_York", modality: "IN_PERSON", locationName: "Fresner Medical Group",
  locationAddress: "800 Ponce de Leon Blvd, Coral Gables, FL 33134", joinUrl: "", confirmationNumber: "CONF-1", proposedTimes: [], idempotencyKey: "", events: [],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), requestSentAt: "", confirmedAt: new Date().toISOString(), canceledAt: "", completedAt: "",
  resolvedAt: "", attendanceOutcome: "", followUpAskedAt: "", reminder: null, prep: { topics: [], medications: [], notes: "", sharedWithProvider: false, updatedAt: "" }, sharedWith: [], ...overrides
});
export const seedDraft = (page, { appointments = [], screen = "MY_CARE", language = "es", patientGoals = [], careMedications = [], extra = {} } = {}) => page.evaluate(draft => {
  localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify(draft));
}, { scenarioId: "access-happy", screen, role: "patient", completionRole: "patient", identityVerified: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED", accessOutcome: "eligible", language, audit: [], careTeamTasks: [], careMedications, medicationReviews: {}, additionalMedications: [], medicationSupplySignals: [], medicationRefills: [], careGoals: [], patientGoals, bpReadings: [], bpReadingReceipts: [], goalHistory: [], appointments, appointmentDraft: null, activeAppointmentId: "", careCirclePermissions: { receiveReminders: false, helpWithDeviceSetup: false, helpWithAppointments: false, receiveCareTasks: false, viewLimitedCareProgress: false }, ...extra });

/* ----------------------------------------------------------------------- fake TTS audio --- */
const speechSamples = (frames, rate, level, seed) => {
  const data = new Float32Array(frames);
  let noise = seed || 1;
  for (let i = 0; i < frames; i += 1) {
    const t = i / rate;
    noise = (noise * 1103515245 + 12345) & 0x7fffffff;
    const env = 0.55 + 0.45 * Math.sin(2 * Math.PI * 4.3 * t + seed);
    const fade = Math.min(1, i / (rate * 0.03), (frames - i) / (rate * 0.05));
    const v = Math.sin(2 * Math.PI * 175 * t) + 0.5 * Math.sin(2 * Math.PI * 350 * t) + 0.25 * Math.sin(2 * Math.PI * 700 * t) + 0.12 * ((noise / 0x7fffffff) * 2 - 1);
    data[i] = level * env * fade * v / 1.9;
  }
  return data;
};
const pcmBuffer = (seconds, rate = 24000) => {
  const frames = Math.max(1, Math.round(seconds * rate));
  const samples = speechSamples(frames, rate, 0.3, 11);
  const buffer = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames; i += 1) buffer.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 0x7fff, i * 2);
  return buffer;
};

/* ------------------------------------------------------------------------------ launch --- */
export async function launchHarness({ locale = "es-US", headless = true } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium", headless, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  const context = await browser.newContext({ viewport: { width: 384, height: 820 }, isMobile: true, hasTouch: true, locale });
  await context.grantPermissions(["microphone"]);
  const page = await context.newPage();
  const issues = [];
  page.on("pageerror", error => issues.push({ type: "pageerror", text: String(error) }));
  page.on("console", message => { if (["error", "warning"].includes(message.type())) issues.push({ type: message.type(), text: message.text().slice(0, 300) }); });
  const ttsRequests = [];
  if (PROVIDER === "fake") {
    await page.addInitScript({ path: join(HERE, "fake-provider.js") });
    let tokens = 0;
    await page.route("**/api/emmi/live-token", async route => {
      const body = JSON.parse(route.request().postData() || "{}");
      const identity = getEmmiVoiceIdentity(body.locale || "EN");
      if (!identity.supported) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "VOICE_UNAVAILABLE_FOR_LOCALE", locale: identity.locale }) });
      tokens += 1;
      await route.fulfill({ status: 200, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify({ token: `auth_tokens/fake-${tokens}`, model: "gemini-3.1-flash-live-preview", expiresAt: new Date(Date.now() + 13 * 60000).toISOString(), prototype: true, voiceIdentity: identity }) });
    });
    await page.route("**/api/emmi/tts", async route => {
      const body = JSON.parse(route.request().postData() || "{}");
      const words = String(body.text || "").split(/\s+/).filter(Boolean).length;
      const seconds = Math.max(0.5, words / TTS_WPS);
      ttsRequests.push({ at: Date.now(), words, seconds, text: String(body.text || "").slice(0, 400), locale: body.locale });
      await route.fulfill({ status: 200, headers: { "content-type": "audio/pcm;rate=24000", "cache-control": "no-store" }, body: pcmBuffer(seconds) });
    });
  }
  if (PROVIDER !== "fake") {
    await page.addInitScript({ path: join(HERE, "real-mic.js") });
    page.on("request", request => {
      if (!request.url().includes("/api/emmi/tts") || request.method() !== "POST") return;
      let body = {}; try { body = JSON.parse(request.postData() || "{}"); } catch {}
      if (body.harness) return;
      const text = String(body.text || "");
      ttsRequests.push({ at: Date.now(), words: text.split(/\s+/).filter(Boolean).length, seconds: null, text: text.slice(0, 400), locale: body.locale });
    });
  }
  return { browser, context, page, issues, ttsRequests };
}

/* ------------------------------------------------------------------------------ helpers --- */
export const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
export const voiceProbe = page => page.evaluate(() => window.__emmiVoiceProbe?.() || null).catch(() => null);
export const threadProbe = page => page.evaluate(() => window.__emmiThreadProbe?.() || []).catch(() => []);

// PROVIDER=real: the patient's words are synthesized by the app's own TTS route and cached on disk,
// so every run of a scenario feeds Gemini Live the same audio.
const TTS_CACHE = join(HERE, "..", "..", "..", ".cache", "emmi-voice-audit-tts");
export async function synthesizePatientLine(page, text, locale) {
  const key = createHash("sha1").update(`${locale}\n${text}`).digest("hex");
  const file = join(TTS_CACHE, `${key}.pcm`);
  if (existsSync(file)) return readFileSync(file).toString("base64");
  const response = await page.request.post(`${BASE}/api/emmi/tts`, { data: { text, locale, harness: true }, headers: { "content-type": "application/json", origin: BASE }, timeout: 60000 });
  if (!response.ok()) {
    const detail = await response.text().catch(() => "");
    // The one failure worth naming: PROVIDER=real needs a key on the dev server for both the patient
    // voice (this route) and the Live session; without it nothing about the model can be measured.
    if (response.status() === 503 && detail.includes("gemini_not_configured")) {
      throw new Error(`PROVIDER=real needs GEMINI_API_KEY on the server at ${BASE} (POST /api/emmi/tts answered 503 gemini_not_configured). Put it in .env.local and restart the dev server.`);
    }
    if (response.status() === 403 && detail.includes("origin_not_allowed")) {
      throw new Error(`The server at ${BASE} rejects this origin. Its allow-list is built from EMMI_ALLOWED_ORIGINS/VERCEL_URL plus localhost:5173 and 127.0.0.1:5173, so run the dev server on port 5173 or add BASE_URL to EMMI_ALLOWED_ORIGINS.`);
    }
    throw new Error(`tts ${response.status()} for "${text.slice(0, 40)}" — ${detail.slice(0, 120)}`);
  }
  const body = await response.body();
  if (!body.length) throw new Error(`tts returned no audio for "${text.slice(0, 40)}"`);
  mkdirSync(TTS_CACHE, { recursive: true });
  writeFileSync(file, body);
  return body.toString("base64");
}
export const viewProbe = page => page.evaluate(() => window.__emmiViewProbe?.() || null).catch(() => null);
export const providerLog = page => page.evaluate(() => window.__harness?.providerLog?.() || []).catch(() => []);

// Scenario steps that reconfigure the scripted double. In PROVIDER=real there is no double: the
// step becomes a no-op and the session records that the condition could not be simulated.
export async function setProviderOption(page, recorder, options, note = "") {
  if (PROVIDER === "fake") {
    await page.evaluate(patch => Object.assign(window.__fakeLive.options, patch), options);
    if (note) recorder?.observe?.(note);
    return true;
  }
  recorder?.observe?.(`NOT SIMULATED in ${PROVIDER} mode: ${JSON.stringify(options)}${note ? ` (${note})` : ""}`);
  return false;
}
export const providerSessionCount = page => page.evaluate(() => window.__fakeLive?.sessionCount ?? null);
export const providerSetupCount = page => page.evaluate(() => window.__fakeLive?.log?.filter(e => e.type === "setup").length ?? null);
export const voiceEvents = page => page.evaluate(() => window.__harness?.voiceEvents?.() || (() => { try { return JSON.parse(sessionStorage.getItem("itera.emmi.prototype.audit.v1") || "[]").flatMap(entry => entry?.voiceEvents || []); } catch { return []; } })()).catch(() => []);
const perfNow = page => page.evaluate(() => performance.now());
const isoToPerf = (page, timeOrigin) => iso => Math.round(new Date(iso).getTime() - timeOrigin);
export const press = async (page, selector, timeout = 15000) => { const control = page.locator(selector).first(); await control.waitFor({ state: "visible", timeout }); await control.click(); await settle(page); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function openApp(page, { seed = null, url = `${BASE}/?scenario=access-happy`, careCircle = null } = {}) {
  await page.goto(url);
  await page.waitForSelector(".shell", { state: "attached", timeout: 30000 });
  await settle(page);
  await page.evaluate(() => { localStorage.removeItem("itera.emmi.conversation.v1"); sessionStorage.clear(); localStorage.setItem("itera.emmi.preferences.v1", JSON.stringify({ emmiVoiceGuidance: false, emmiWelcomeAcknowledged: false })); });
  if (seed) await seedDraft(page, seed); else await page.evaluate(() => localStorage.removeItem("itera.enrollment.safe-draft.v2"));
  if (careCircle) await page.evaluate(list => localStorage.setItem("itera.care-circle.prototype.v1", JSON.stringify({ invites: list })), careCircle);
  await page.reload();
  await page.waitForSelector("#screen-content", { state: "visible", timeout: 30000 });
  await settle(page);
}

// PROVIDER=real without a key produces a session full of "voice unavailable" and no measurements.
// Better to say so before the first utterance than to write 24 empty transcripts.
export async function assertRealProviderReady() {
  if (PROVIDER === "fake") return true;
  const response = await fetch(`${BASE}/api/emmi/tts`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ text: "ok", locale: "EN", harness: true }) }).catch(error => ({ ok: false, status: 0, text: async () => String(error) }));
  if (response.ok) return true;
  const detail = await response.text?.().catch(() => "") || "";
  const hint = response.status === 0 ? "Nothing is listening there — start the dev server (npm run dev -- --port 5173) in another terminal."
    : detail.includes("origin_not_allowed") ? "The server's origin allow-list rejects this call; run the dev server on port 5173 or add BASE_URL to EMMI_ALLOWED_ORIGINS."
    : detail.includes("gemini_not_configured") ? "The server has no GEMINI_API_KEY; put it in .env.local (no quotes) and restart the dev server."
    : "Start the dev server with GEMINI_API_KEY set (.env.local) and pass BASE_URL if it is not the default.";
  throw new Error(`PROVIDER=real cannot use the server at ${BASE}: POST /api/emmi/tts answered ${response.status}${detail ? ` (${detail.slice(0, 120)})` : ""}. ${hint}`);
}

export async function startVoice(page, { timeoutMs = 20000 } = {}) {
  const t0 = await perfNow(page);
  await press(page, '[data-action="enable-emmi-guidance"]');
  const deadline = Date.now() + timeoutMs;
  let probe = null;
  while (Date.now() < deadline) {
    probe = await voiceProbe(page);
    if (probe?.active && probe.socket && !["CONNECTING"].includes(probe.state)) break;
    if (probe?.state === "ERROR" || probe?.error) break;
    await wait(100);
  }
  const t1 = await perfNow(page);
  return { probe, connectMs: Math.round(t1 - t0) };
}

// Wait until EMMI has nothing in flight: no active generation on the provider double and the app
// back in LISTENING for a short, steady interval.
export async function waitForIdle(page, { timeoutMs = 30000, steadyMs = 700 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let steadySince = 0;
  while (Date.now() < deadline) {
    const probe = await voiceProbe(page);
    const generating = PROVIDER === "fake" ? await page.evaluate(() => Boolean(window.__fakeLive?.generation || window.__fakeLive?.pendingTool)) : false;
    const idle = probe && ["LISTENING", "DISCONNECTED", "ERROR"].includes(probe.state) && !generating;
    if (idle) { steadySince ||= Date.now(); if (Date.now() - steadySince >= steadyMs) return { idle: true, probe }; }
    else steadySince = 0;
    await wait(100);
  }
  return { idle: false, probe: await voiceProbe(page) };
}

export async function waitForState(page, states, { timeoutMs = 15000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const probe = await voiceProbe(page);
    if (probe && states.includes(probe.state)) return probe;
    await wait(50);
  }
  return null;
}

/* ------------------------------------------------------------------------ the recorder --- */
export class SessionRecorder {
  constructor(page, { sessionId, profile, language, flow, provider = PROVIDER, notes = "", ttsRequests = [] }) {
    this.page = page;
    this.ttsRequests = ttsRequests;
    this.session = { session_id: sessionId, patient_profile: profile, language, flow, provider, provider_note: provider === "fake" ? "SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence." : "Real Gemini Live session.", notes, startedAt: new Date().toISOString(), turns: [], observations: [] };
    this.turnIndex = 0;
    this.timeOrigin = 0;
    this.stateSampler = null;
    this.stateSamples = [];
  }
  async begin() {
    this.timeOrigin = await this.page.evaluate(() => performance.timeOrigin);
    this.startStateSampler();
  }
  startStateSampler() {
    const sample = async () => {
      try { const probe = await voiceProbe(this.page); const t = await perfNow(this.page); const last = this.stateSamples.at(-1); if (!last || last.state !== probe?.state) this.stateSamples.push({ t: Math.round(t), state: probe?.state || "?", error: probe?.error || "" }); }
      catch { /* page navigating */ }
      if (this.stateSampler) this.stateSampler = setTimeout(sample, 80);
    };
    this.stateSampler = setTimeout(sample, 80);
  }
  stopStateSampler() { clearTimeout(this.stateSampler); this.stateSampler = null; }
  observe(text, detail = {}) { this.session.observations.push({ at: new Date().toISOString(), text, ...detail }); }
  async snapshot() {
    const [log, events, view, probe, t, thread] = await Promise.all([providerLog(this.page), voiceEvents(this.page), viewProbe(this.page), voiceProbe(this.page), perfNow(this.page), threadProbe(this.page)]);
    return { log, events, view, probe, t: Math.round(t), thread };
  }
  // A spoken patient turn: declare what the "ASR" hears and what the "model" answers, inject the
  // audio, then wait for EMMI to finish and measure everything the app made observable.
  async speak({ text, durationMs, model = null, bargeIn = false, bargeInAfterMs = 900, holdFloor = false, screen = "", intent = "", action_requested = "", expect = {}, timeoutMs = 30000, waitIdleFirst = true, notes = "" }) {
    const page = this.page;
    this.turnIndex += 1;
    const turn = { turn: this.turnIndex, kind: "speech", screen, patient_utterance: text, recognized_text: null, EMMI_response: null, EMMI_response_source: PROVIDER === "fake" ? "scripted double" : "gemini-live", conversation_context: {}, action_requested, action_result: null, navigation_result: null, problem_detected: [], severity: "", notes, intent, bargeIn };
    const before = await this.snapshot();
    turn.screen ||= before.view?.viewId || before.probe?.state || "";
    turn.conversation_context.view_before = before.view ? { viewId: before.view.viewId, task: before.view.whatThePatientMustDoHere, choices: (before.view.choices || []).map(c => c.label), selected: before.view.selected?.label || null, pending: before.view.stillPending, done: before.view.alreadyDone } : null;
    if (PROVIDER === "fake" && model) await page.evaluate(entry => { window.__fakeLive.script.push(entry); }, { transcript: text, response: model });
    else if (PROVIDER === "fake") await page.evaluate(entry => { window.__fakeLive.script.push(entry); }, { transcript: text, response: { text: "Entendido." } });
    if (bargeIn) {
      const speaking = await waitForState(page, ["EMMI_SPEAKING"], { timeoutMs: 12000 });
      turn.conversation_context.barge_in_target_state = speaking?.state || "not_speaking";
      await wait(bargeInAfterMs);
    } else if (waitIdleFirst) {
      const idle = await waitForIdle(page, { timeoutMs: 20000 });
      if (!idle.idle) turn.problem_detected.push(`EMMI was not idle before the patient spoke (state ${idle.probe?.state})`);
    }
    const wallStart = Date.now();
    let speech;
    if (PROVIDER === "fake") speech = await page.evaluate(opts => window.__patientSpeak(opts), { durationMs: durationMs || Math.max(700, Math.round(text.split(/\s+/).length / 2.6 * 1000)), transcript: text, id: `t${this.turnIndex}` });
    else {
      const pcmBase64 = await synthesizePatientLine(page, text, this.session.language === "en" ? "EN" : "ES");
      speech = await page.evaluate(opts => window.__patientSpeakPcm(opts), { pcmBase64, sampleRate: 24000, transcript: text, id: `t${this.turnIndex}` });
    }
    turn.timing = { speech_started_at: speech.startedAt, speech_ended_at: speech.endsAt };
    // Let the injected audio finish, then wait for the reply to drain — or, when the next step is
    // going to interrupt this reply, only until it has started playing.
    await wait(speech.durationMs + 50);
    let finished;
    if (holdFloor) {
      const speaking = await waitForState(page, ["EMMI_SPEAKING"], { timeoutMs });
      finished = { idle: Boolean(speaking), probe: speaking || await voiceProbe(page), heldFloor: true };
    } else finished = await waitForIdle(page, { timeoutMs });
    const after = await this.snapshot();
    this.analyseTurn(turn, before, after, speech, finished);
    turn.app_spoke_itself = this.ttsSince(wallStart);
    if (turn.app_spoke_itself.length && !turn.EMMI_response) turn.EMMI_response = turn.app_spoke_itself.map(t => `[EMMI, own voice] ${t}`).join(" ‖ ");
    turn.conversation_context.view_after = after.view ? { viewId: after.view.viewId, task: after.view.whatThePatientMustDoHere, selected: after.view.selected?.label || null, pending: after.view.stillPending, done: after.view.alreadyDone } : null;
    turn.navigation_result = before.view?.viewId === after.view?.viewId ? "same view" : `${before.view?.viewId} → ${after.view?.viewId}`;
    if (expect.viewId && !String(after.view?.viewId || "").includes(expect.viewId)) turn.problem_detected.push(`expected view ${expect.viewId}, got ${after.view?.viewId}`);
    if (expect.contextBeforeAnswer && !turn.conversation_context.context_envelope_sent_before_answer) turn.problem_detected.push("the app sent no screen context to the provider before it answered this spoken turn");
    if (!finished.idle && !finished.heldFloor) turn.problem_detected.push(`turn did not finish within ${timeoutMs} ms (state ${finished.probe?.state})`);
    if (finished.heldFloor) { turn.notes = `${turn.notes ? turn.notes + " " : ""}reply left playing for the next step to interrupt`; turn.timing.response_completion_latency_ms = null; }
    this.session.turns.push(turn);
    return turn;
  }
  analyseTurn(turn, before, after, speech, finished) {
    const perf = isoToPerf(this.page, this.timeOrigin);
    const log = after.log.slice(before.log.length);
    const events = after.events.slice(before.events.length);
    const speechEnd = log.find(e => e.dir === "vad" && e.type === "speech_end");
    const speechStart = log.find(e => e.dir === "vad" && e.type === "speech_start");
    const asr = log.find(e => e.dir === "asr");
    const generations = log.filter(e => e.dir === "model" && e.type === "generation_started");
    const firstAudio = log.find(e => e.dir === "model" && e.type === "first_audio");
    const allFirstAudio = log.filter(e => e.dir === "model" && e.type === "first_audio");
    const complete = log.find(e => e.dir === "model" && e.type === "generation_complete");
    const cancelled = log.filter(e => e.dir === "model" && e.type === "generation_cancelled");
    const interrupted = log.find(e => e.dir === "out" && e.type === "serverContent" && e.reason === "barge_in");
    const toolCalls = log.filter(e => e.dir === "model" && e.type === "tool_call");
    const toolResponses = log.filter(e => e.dir === "in" && e.type === "toolResponse");
    const contextTexts = log.filter(e => e.dir === "in" && e.type === "text" && e.contextEnvelope);
    const recoveryTexts = log.filter(e => e.dir === "in" && e.type === "text" && e.recovery);
    // The first audible audio of THIS turn: narration that was already playing when the patient started
    // speaking (a screen change a moment earlier) must not be counted as the reply.
    const appFirstAudio = events.find(e => e.type === "EMMI_FIRST_AUDIO_CHUNK" && Number(e.firstAudioReceivedAt) >= Number(speech.startedAt || 0));
    const drained = [...events].reverse().find(e => e.type === "EMMI_AUDIO_TURN_DRAINED");
    const bargeIn = events.find(e => e.type === "EMMI_BARGE_IN");
    const localSpeechEnd = events.find(e => e.type === "EMMI_PATIENT_SPEECH_ENDED");
    const suppressed = events.filter(e => ["EMMI_ASR_CLARIFICATION_REQUIRED", "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED", "EMMI_MISSING_TRANSCRIPT_RECOVERED", "EMMI_INVALID_TRANSCRIPT_DISCARDED"].includes(e.type));
    const staleChunks = events.filter(e => e.type === "EMMI_STALE_AUDIO_CHUNK_DISCARDED").length;
    const timeouts = events.filter(e => ["EMMI_VOICE_TURN_TIMEOUT", "EMMI_VOICE_ERROR"].includes(e.type));
    const localNotices = events.filter(e => e.type === "EMMI_LOCAL_NOTICE");
    const languageSignals = events.filter(e => e.type === "EMMI_LANGUAGE_SIGNAL");
    const rotations = events.filter(e => ["EMMI_SESSION_ROTATION", "EMMI_SESSION_ROTATION_SKIPPED", "EMMI_VOICE_TURN_RELEASED"].includes(e.type));
    const ttsNotices = (this.ttsRequests || []).filter(r => r.at >= Date.now() - 60000);
    turn.recognized_text = asr?.text ?? (asr ? "" : null);
    turn.transcript_note = asr?.type === "input_transcription_withheld" ? "provider returned no transcript (simulated)" : "";
    turn.EMMI_response = allFirstAudio.map(e => e.text).join(" ‖ ") || (generations.length ? "(empty generation)" : null);
    if (PROVIDER !== "fake") {
      // No double to read: the provider's transcripts are what the app put in the visible thread.
      const fresh = (after.thread || []).slice((before.thread || []).length);
      const heard = fresh.filter(m => m.role === "user").map(m => m.text).join(" ");
      const said = fresh.filter(m => m.role === "assistant" && !m.guidance).map(m => m.text).join(" ");
      turn.recognized_text = heard || null;
      turn.EMMI_response = said || null;
      turn.transcript_note = heard ? "" : "no input transcription reached the thread";
    }
    turn.EMMI_response_kinds = generations.map(e => e.kind);
    const t1 = speech.endsAt;
    const t2 = appFirstAudio ? Number(appFirstAudio.firstAudioReceivedAt) + Number(appFirstAudio.scheduledPlaybackDelayMs || 0) : null;
    const t3 = drained ? perf(drained.timestamp) : null;
    turn.timing = {
      ...turn.timing,
      provider_speech_end_detected_at: speechEnd?.t ?? null,
      provider_vad_window_ms: speechEnd ? Math.round(speechEnd.t - t1) : null,
      provider_first_chunk_at: firstAudio?.t ?? null,
      app_first_audio_at: appFirstAudio ? Math.round(appFirstAudio.firstAudioReceivedAt) : null,
      app_scheduled_playback_delay_ms: appFirstAudio ? Number(appFirstAudio.scheduledPlaybackDelayMs || 0) : null,
      T1_patient_speech_end: t1,
      T2_first_audible_response: t2,
      T3_response_complete: t3,
      response_start_latency_ms: t2 != null ? Math.round(t2 - t1) : null,
      response_completion_latency_ms: t3 != null ? Math.round(t3 - t1) : null,
      app_overhead_first_chunk_to_audible_ms: firstAudio && t2 != null ? Math.round(t2 - firstAudio.t) : null,
      local_speech_end_detected_ms_after_T1: localSpeechEnd ? Math.round(perf(localSpeechEnd.timestamp) - t1) : null
    };
    turn.timing.perceived = classifyLatency(turn.timing.response_start_latency_ms);
    turn.conversation_context = {
      ...turn.conversation_context,
      context_envelope_sent_before_answer: contextTexts.length > 0,
      context_envelopes_in_turn: contextTexts.length,
      recovery_prompts_sent_by_app: recoveryTexts.map(e => e.text.slice(0, 220)),
      app_transcript_suppression_events: suppressed.map(e => e.type),
      provider_generations: generations.length,
      generations_cancelled: cancelled.map(e => e.reason),
      stale_audio_chunks_discarded: staleChunks,
      timeouts_or_errors: timeouts.map(e => `${e.type}${e.errorCode ? `:${e.errorCode}` : ""}`),
      local_notices_spoken_by_app: localNotices.map(e => e.reason),
      language_signals: languageSignals.map(e => ({ detected: e.detectedLanguage, request: e.languageRequest })),
      session_lifecycle_events: rotations.map(e => `${e.type}${e.reason ? `:${e.reason}` : ""}`),
      states: this.stateSamples.filter(s => s.t >= speech.startedAt - 200).map(s => `${s.state}@${s.t - speech.startedAt}`),
      final_state: finished.probe?.state || ""
    };
    if (turn.bargeIn) {
      turn.interruption = {
        emmi_was_speaking: turn.conversation_context.barge_in_target_state === "EMMI_SPEAKING",
        app_detected_barge_in: Boolean(bargeIn),
        app_source: bargeIn?.source || null,
        stop_latency_from_speech_start_ms: bargeIn ? Math.round(Number(bargeIn.audioStoppedAt) - speech.startedAt) : null,
        app_reported_interruption_latency_ms: bargeIn ? Number(bargeIn.interruptionLatencyMs) : null,
        provider_interrupted_after_ms: interrupted ? Math.round(interrupted.t - speech.startedAt) : null,
        provider_speech_start_after_ms: speechStart ? Math.round(speechStart.t - speech.startedAt) : null,
        previous_generation_continued: cancelled.length === 0 && Boolean(interrupted) === false && generations.length === 0,
        chunks_played_after_interruption: staleChunks
      };
      if (!bargeIn) turn.problem_detected.push("the app did not register the interruption while EMMI was speaking");
      else if (turn.interruption.stop_latency_from_speech_start_ms > 600) turn.problem_detected.push(`EMMI kept speaking ${turn.interruption.stop_latency_from_speech_start_ms} ms after the patient started`);
    }
    turn.action_result = toolCalls.length ? toolCalls.map((call, index) => ({ name: call.name, args: call.args, result: (() => { try { const r = JSON.parse(toolResponses[index]?.responses || "[]")[0]?.response; return r?.result ?? r ?? null; } catch { return toolResponses[index]?.responses || null; } })() })) : null;
    if (turn.timing.response_start_latency_ms == null && generations.length && !turn.bargeIn) turn.problem_detected.push("no audible response was produced for this turn");
    if (turn.timing.response_start_latency_ms != null && turn.timing.response_start_latency_ms > 2500) turn.problem_detected.push(`response start ${turn.timing.response_start_latency_ms} ms`);
    if (timeouts.length) turn.problem_detected.push(`app raised ${turn.conversation_context.timeouts_or_errors.join(", ")}`);
    if (turn.problem_detected.length) turn.severity = turn.problem_detected.some(p => /did not finish|no audible|raised|kept speaking/.test(p)) ? "P1" : "P2";
  }
  // Navigation by the patient's own tap while voice stays on: what does the app tell the provider?
  async navigate({ selector, label = "", expect = {}, notes = "" }) {
    this.turnIndex += 1;
    const before = await this.snapshot();
    await press(this.page, selector);
    await wait(400);
    const after = await this.snapshot();
    const log = after.log.slice(before.log.length);
    const events = after.events.slice(before.events.length);
    const turn = { turn: this.turnIndex, kind: "navigation", label: label || selector, screen: before.view?.viewId || "", navigation_result: `${before.view?.viewId} → ${after.view?.viewId}`, conversation_context: { context_pushed_to_provider: log.filter(e => e.dir === "in" && e.type === "text" && e.contextEnvelope).length, narration_turns_sent_to_provider: log.filter(e => e.dir === "in" && e.type === "text" && e.narration).length, provider_generations: log.filter(e => e.dir === "model" && e.type === "generation_started").length, tts_narration_started: events.some(e => e.type === "EMMI_TTS_GUIDANCE_STARTED" || e.type === "EMMI_TTS_GUIDANCE_REQUESTED"), context_updated_events: events.filter(e => e.type === "EMMI_VOICE_CONTEXT_UPDATED").length, state: after.probe?.state }, problem_detected: [], severity: "", notes };
    if (expect.viewId && !String(after.view?.viewId || "").includes(expect.viewId)) turn.problem_detected.push(`expected view ${expect.viewId}, got ${after.view?.viewId}`);
    this.session.turns.push(turn);
    return turn;
  }
  // What EMMI said on her own (narration route) during a window, for turns where the double is not
  // the speaker: recovery notices and the language-switch confirmation.
  ttsSince(at) { return (this.ttsRequests || []).filter(r => r.at >= at).map(r => r.text); }
  async silence({ ms, label = "patient stays silent" }) {
    this.turnIndex += 1;
    const before = await this.snapshot();
    const startedAt = Date.now();
    await wait(ms);
    const after = await this.snapshot();
    const log = after.log.slice(before.log.length);
    const events = after.events.slice(before.events.length);
    const turn = { turn: this.turnIndex, kind: "silence", label, silence_ms: ms, conversation_context: { provider_generations: log.filter(e => e.dir === "model" && e.type === "generation_started").map(e => e.kind), app_text_turns: log.filter(e => e.dir === "in" && e.type === "text").map(e => e.text.slice(0, 160)), app_spoke_itself: this.ttsSince(startedAt), app_events: [...new Set(events.map(e => e.type))], state_before: before.probe?.state, state_after: after.probe?.state }, problem_detected: [], severity: "" };
    if (turn.conversation_context.provider_generations.length) turn.problem_detected.push("EMMI spoke on its own during patient silence");
    this.session.turns.push(turn);
    return turn;
  }
  async typed({ text, model = null }) {
    this.turnIndex += 1;
    if (PROVIDER === "fake" && model) await this.page.evaluate(entry => { window.__fakeLive.textScript.push(entry); }, { response: model });
    const before = await this.snapshot();
    const answer = await this.page.evaluate(q => window.__emmiVoiceAsk?.(q), text);
    const after = await this.snapshot();
    const log = after.log.slice(before.log.length);
    const turn = { turn: this.turnIndex, kind: "typed_into_live_session", patient_utterance: text, EMMI_response: answer?.text || null, ok: answer?.ok, conversation_context: { context_envelope_sent: log.some(e => e.dir === "in" && e.type === "text" && e.contextEnvelope), sent_text: log.find(e => e.dir === "in" && e.type === "text")?.text?.slice(0, 500) }, problem_detected: [], severity: "" };
    this.session.turns.push(turn);
    return turn;
  }
  async finish(outDir) {
    this.stopStateSampler();
    this.session.finishedAt = new Date().toISOString();
    this.session.state_transitions = this.stateSamples;
    this.session.provider_log_tail = (await providerLog(this.page)).slice(-400);
    this.session.summary = summarise(this.session);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, `${this.session.session_id}.json`), JSON.stringify(this.session, null, 2));
    writeFileSync(join(outDir, `${this.session.session_id}.md`), renderMarkdown(this.session));
    return this.session;
  }
}

export function classifyLatency(ms) {
  if (ms == null) return "N/A";
  if (ms < 1000) return "FAST";
  if (ms < 1600) return "ACCEPTABLE";
  if (ms < 2500) return "NOTICEABLE DELAY";
  if (ms < 4000) return "POOR";
  return "VERY POOR";
}
const percentile = (values, p) => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]; };
export function summarise(session) {
  const speech = session.turns.filter(t => t.kind === "speech");
  const starts = speech.map(t => t.timing?.response_start_latency_ms).filter(v => v != null);
  const overhead = speech.map(t => t.timing?.app_overhead_first_chunk_to_audible_ms).filter(v => v != null);
  const bargeIns = speech.filter(t => t.bargeIn);
  return {
    spoken_turns: speech.length,
    total_turns: session.turns.length,
    response_start_p50_ms: percentile(starts, 0.5),
    response_start_p95_ms: percentile(starts, 0.95),
    response_start_avg_ms: starts.length ? Math.round(starts.reduce((a, b) => a + b, 0) / starts.length) : null,
    app_overhead_p50_ms: percentile(overhead, 0.5),
    barge_ins: bargeIns.length,
    barge_in_stop_p50_ms: percentile(bargeIns.map(t => t.interruption?.stop_latency_from_speech_start_ms).filter(v => v != null), 0.5),
    barge_in_stop_max_ms: Math.max(-1, ...bargeIns.map(t => t.interruption?.stop_latency_from_speech_start_ms).filter(v => v != null)),
    spoken_turns_with_context_before_answer: speech.filter(t => t.conversation_context?.context_envelope_sent_before_answer).length,
    problems: session.turns.flatMap(t => (t.problem_detected || []).map(p => `turn ${t.turn}: ${p}`))
  };
}
export function renderMarkdown(session) {
  const lines = [];
  lines.push(`# Voice session ${session.session_id}`, "", `- patient_profile: ${session.patient_profile}`, `- language: ${session.language}`, `- flow: ${session.flow}`, `- provider: ${session.provider} — ${session.provider_note}`, `- started: ${session.startedAt}`, `- finished: ${session.finishedAt}`, "");
  if (session.notes) lines.push(session.notes, "");
  lines.push("| # | kind | screen | PATIENT | recognized_text | EMMI (${source}) | start ms | perceived | complete ms | action | navigation | problems |".replace("${source}", session.provider === "fake" ? "scripted" : "real"), "|---|---|---|---|---|---|---:|---|---:|---|---|---|");
  for (const t of session.turns) {
    const esc = v => String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
    if (t.kind === "speech") lines.push(`| ${t.turn} | ${t.bargeIn ? "speech (barge-in)" : "speech"} | ${esc(t.screen)} | ${esc(t.patient_utterance)} | ${esc(t.recognized_text)} | ${esc(t.EMMI_response)} | ${t.timing?.response_start_latency_ms ?? ""} | ${t.timing?.perceived ?? ""} | ${t.timing?.response_completion_latency_ms ?? ""} | ${esc(t.action_result ? t.action_result.map(a => `${a.name}→${a.result?.status || a.result?.success || ""}`).join("; ") : "")} | ${esc(t.navigation_result)} | ${esc((t.problem_detected || []).join("; "))} |`);
    else if (t.kind === "navigation") lines.push(`| ${t.turn} | tap | ${esc(t.screen)} | (taps ${esc(t.label)}) | | | | | | | ${esc(t.navigation_result)} | ${esc([...(t.problem_detected || []), `context pushed: ${t.conversation_context.context_pushed_to_provider}, narration: ${t.conversation_context.tts_narration_started ? "TTS" : t.conversation_context.narration_turns_sent_to_provider ? "live" : "none"}`].join("; "))} |`);
    else if (t.kind === "silence") lines.push(`| ${t.turn} | silence | | (silent ${t.silence_ms} ms) | | ${esc(t.conversation_context.provider_generations.join(","))} | | | | | | ${esc((t.problem_detected || []).join("; ") || `states ${t.conversation_context.state_before}→${t.conversation_context.state_after}`)} |`);
    else if (t.kind === "typed_into_live_session") lines.push(`| ${t.turn} | typed | | ${esc(t.patient_utterance)} | | ${esc(t.EMMI_response)} | | | | | | context envelope: ${t.conversation_context.context_envelope_sent} |`);
  }
  lines.push("", "## Summary", "", "```json", JSON.stringify(session.summary, null, 2), "```", "");
  if (session.observations.length) { lines.push("## Observations", ""); for (const o of session.observations) lines.push(`- ${o.text}`); lines.push(""); }
  return lines.join("\n");
}
