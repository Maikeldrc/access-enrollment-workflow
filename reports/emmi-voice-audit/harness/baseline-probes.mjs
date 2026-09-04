// Baseline probes against the real application running on the local Vite dev server.
// No application code is changed by this script. Everything here drives the real UI, the real
// EMMI view describers, the real tool orchestrator and the real action gate through the
// development-only probes the app exposes (__emmiViewProbe, __emmiToolProbe, __emmiActionProbe,
// __emmiVoiceProbe). Results are written as JSON next to this file.
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const OUT = process.env.OUT_DIR || join(dirname(fileURLToPath(import.meta.url)), "..", "evidence");
mkdirSync(OUT, { recursive: true });
const ONLY = (process.env.SECTIONS || "").split(",").filter(Boolean);
let results = { startedAt: new Date().toISOString(), base: BASE, sections: {} };
try { if (ONLY.length) results = { ...JSON.parse(readFileSync(join(OUT, "baseline-probes.json"), "utf8")), rerunAt: new Date().toISOString() }; } catch {}
const save = () => writeFileSync(join(OUT, "baseline-probes.json"), JSON.stringify(results, null, 2));
const section = async (name, fn) => {
  if (ONLY.length && !ONLY.includes(name)) return;
  const started = Date.now();
  try { results.sections[name] = { ok: true, ...(await fn()) }; }
  catch (error) { results.sections[name] = { ok: false, error: String(error?.stack || error) }; }
  results.sections[name].durationMs = Date.now() - started;
  save();
  console.log(`[${results.sections[name].ok ? "ok" : "FAIL"}] ${name} (${results.sections[name].durationMs} ms)`);
};

const inDays = (days, hour = 10) => { const when = new Date(); when.setDate(when.getDate() + days); when.setHours(hour, 30, 0, 0); return when.toISOString(); };
const appointment = (overrides = {}) => ({
  id: "appt-1", patientId: "patient_demo", source: "PATIENT_DIRECT_REQUEST", reasonCategory: "ROUTINE_FOLLOW_UP", reasonSummary: "",
  relatedGoalId: "", relatedBarrierId: "", relatedRefillId: "", requestedProfessionalId: "dr-fresner", requestedProfessionalType: "PRIMARY_CARE",
  requestedSpecialty: "", providerDisplayName: "Dr. Fresner Lee", practiceName: "", preferredModality: "NO_PREFERENCE", preferredTimeOfDay: "NO_PREFERENCE",
  preferredDateRange: null, urgencyClassification: "ROUTINE", schedulingCapability: "DIRECT_BOOKING", status: "CONFIRMED",
  scheduledAt: inDays(3, 14), scheduledEndAt: inDays(3, 15), timezone: "America/New_York", modality: "IN_PERSON", locationName: "Fresner Medical Group",
  locationAddress: "800 Ponce de Leon Blvd, Coral Gables, FL 33134", joinUrl: "", confirmationNumber: "CONF-1", proposedTimes: [], idempotencyKey: "", events: [],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), requestSentAt: "", confirmedAt: new Date().toISOString(), canceledAt: "", completedAt: "",
  resolvedAt: "", attendanceOutcome: "", followUpAskedAt: "", reminder: null, prep: { topics: [], medications: [], notes: "", sharedWithProvider: false, updatedAt: "" }, sharedWith: [], ...overrides
});
const seed = (page, { appointments = [], screen = "MY_CARE", language = "es", patientGoals = [], careMedications = [] } = {}) => page.evaluate(draft => {
  localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify(draft));
}, { scenarioId: "access-happy", screen, role: "patient", completionRole: "patient", identityVerified: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED", accessOutcome: "eligible", language, audit: [], careTeamTasks: [], careMedications, medicationReviews: {}, additionalMedications: [], medicationSupplySignals: [], medicationRefills: [], careGoals: [], patientGoals, bpReadings: [], bpReadingReceipts: [], goalHistory: [], appointments, appointmentDraft: null, activeAppointmentId: "", careCirclePermissions: { receiveReminders: false, helpWithDeviceSetup: false, helpWithAppointments: false, receiveCareTasks: false, viewLimitedCareProgress: false } });
const seedCareCircle = (page, invites) => page.evaluate(list => localStorage.setItem("itera.care-circle.prototype.v1", JSON.stringify({ invites: list })), invites);
const acceptedInvite = () => ({ inviteId: "invite-1", token: "tok-1", inviterPatientId: "patient_demo", patientFirstName: "María", supportPerson: { name: "Ana Ruiz", relationship: "daughter", relationshipOther: "", phone: "+13055550143" }, supportRole: "CARE_CIRCLE_MEMBER", completionRole: "PATIENT", permissionScope: "CARE_CIRCLE_BASIC_SUPPORT", context: "ONGOING_CARE", status: "ACCEPTED", createdAt: new Date().toISOString(), sentAt: new Date().toISOString(), lastSentAt: new Date().toISOString(), sendCount: 1, openedAt: "", acceptedAt: new Date().toISOString(), expiresAt: inDays(3), canceledAt: "", removedAt: "", sessionId: "sess-1", temporarySupportLink: "" });

const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const view = page => page.evaluate(() => window.__emmiViewProbe?.() || null);
const tool = (page, name, args = {}) => page.evaluate(([n, a]) => window.__emmiToolProbe?.(n, a), [name, args]);
const act = (page, params) => page.evaluate(p => window.__emmiActionProbe?.(p), params);
const voice = page => page.evaluate(() => window.__emmiVoiceProbe?.() || null);
const voiceEvents = page => page.evaluate(() => { const logs = JSON.parse(sessionStorage.getItem("itera.emmi.prototype.audit.v1") || "[]"); return logs.flatMap(e => e?.voiceEvents || []); });
const press = async (page, selector, timeout = 15000) => { const c = page.locator(selector).first(); await c.waitFor({ state: "visible", timeout }); await c.click(); await settle(page); };
const openVisit = async (page, options = {}) => {
  await page.goto(`${BASE}/?scenario=access-happy`);
  await page.waitForSelector(".shell", { state: "attached", timeout: 30000 });
  await settle(page);
  await seed(page, { appointments: [appointment()], ...options });
  if (options.careCircle) await seedCareCircle(page, options.careCircle);
  await page.reload();
  await page.waitForSelector("#screen-content", { state: "visible", timeout: 30000 });
  await press(page, '[data-action="appointment-open"]');
};
// The chat panel: a typed question, and the answer EMMI Chat gives (deterministic path when no key).
const askChat = async (page, question) => {
  const opener = page.locator('.emmi-guide [data-action="help"], .emmi-welcome [data-action="help"], .emmi-assistant').first();
  if (!(await page.locator(".assistant-layer").count())) { await opener.click(); await page.locator(".assistant-layer").waitFor({ state: "visible", timeout: 10000 }); }
  const before = await page.locator(".assistant-message.assistant:not(.assistant-thinking)").count();
  const input = page.locator(".assistant-layer textarea, .assistant-layer input[type='text']").first();
  await input.fill(question);
  const t0 = Date.now();
  await input.press("Enter");
  await page.locator(".assistant-message.assistant:not(.assistant-thinking)").nth(before).waitFor({ state: "visible", timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(400);
  const answers = await page.locator(".assistant-message.assistant:not(.assistant-thinking)").allInnerTexts();
  return { question, answer: (answers.slice(before).join(" ") || "").trim(), latencyMs: Date.now() - t0 };
};
const closeChat = async page => { if (await page.locator(".assistant-layer").count()) { await page.keyboard.press("Escape"); await page.waitForTimeout(200); } };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium", headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({ viewport: { width: 384, height: 820 }, isMobile: true, hasTouch: true, locale: "es-US" });
await context.grantPermissions(["microphone"]);
const page = await context.newPage();
page.on("pageerror", error => (results.pageErrors ||= []).push(String(error)));
page.on("console", message => { if (["error", "warning"].includes(message.type())) (results.consoleIssues ||= []).push(`${message.type()}: ${message.text()}`.slice(0, 300)); });

// 1. Voice start on Home without a provider key: what the patient sees and what the client does.
await section("voice_start_without_provider", async () => {
  await page.goto(`${BASE}/?scenario=access-happy`);
  await page.waitForSelector(".shell", { state: "attached", timeout: 30000 });
  await page.evaluate(() => localStorage.setItem("itera.emmi.preferences.v1", JSON.stringify({ emmiVoiceGuidance: false, emmiWelcomeAcknowledged: false })));
  await page.reload();
  await page.waitForSelector("#screen-content", { state: "visible", timeout: 30000 });
  const t0 = Date.now();
  await press(page, '[data-action="enable-emmi-guidance"]');
  const states = [];
  for (let i = 0; i < 20; i += 1) { states.push({ t: Date.now() - t0, ...(await voice(page)) }); await page.waitForTimeout(250); }
  const card = await page.locator(".emmi-welcome-choice").innerText().catch(() => "");
  const guide = await page.locator(".emmi-guide").innerText().catch(() => "");
  await page.screenshot({ path: join(OUT, "voice-start-without-provider.png"), fullPage: false });
  const events = await voiceEvents(page);
  return { welcomeCardText: card, guideText: guide, stateTimeline: states.filter((s, i, a) => i === 0 || s.state !== a[i - 1].state || s.error !== a[i - 1].error), voiceEventTypes: events.map(e => e.type), voiceErrorEvents: events.filter(e => e.type === "EMMI_VOICE_ERROR") };
});

// 2. The whole transportation flow, in Spanish, capturing what EMMI sees at every step.
await section("transportation_views_es", async () => {
  await openVisit(page, { language: "es" });
  const steps = {};
  steps.APPOINTMENT_DETAIL = await view(page);
  await press(page, '[data-action="appointment-open-barrier"]'); steps.BARRIER_CHECK = await view(page);
  await press(page, '[data-barrier-reason="TRANSPORTATION"]'); steps.OFFER = await view(page);
  await press(page, '[data-action="barrier-accept"]'); steps.PICKUP = await view(page);
  await press(page, '[data-action="barrier-pickup-home"]'); steps.NEEDS = await view(page);
  await press(page, '[data-need="NONE"]'); await press(page, '[data-action="barrier-needs-continue"]'); steps.TIME = await view(page);
  const searchStart = Date.now();
  await press(page, '[data-action="barrier-time-accept"]');
  steps.SEARCHING = await view(page);
  // Real simulated dispatcher latency (no barrierLatency=0): how long the patient waits with no rides.
  let attempts = 0;
  while (attempts < 4 && !(await page.locator(".barrier-option").count())) {
    if (await page.locator('[data-action="barrier-time-change"]').count() && !(await page.locator(".barrier-searching, .barrier-loading").count())) {
      await press(page, '[data-action="barrier-time-change"]');
      await page.locator('[data-action="barrier-time-select"]').nth(attempts).click();
      await press(page, '[data-action="barrier-time-accept"]');
    }
    await page.waitForTimeout(1500); attempts += 1;
  }
  const searchMs = Date.now() - searchStart;
  await page.locator(".barrier-option").first().waitFor({ state: "visible", timeout: 20000 });
  steps.OPTIONS = await view(page);
  const optionsOnScreen = await page.locator(".barrier-option").allInnerTexts();
  // What "the second one" / "the one with more room" / "the cheapest" resolve against.
  const byRoom = [...(steps.OPTIONS?.choices || [])].sort((a, b) => (b.seats || 0) - (a.seats || 0))[0];
  const cheapest = [...(steps.OPTIONS?.choices || [])].sort((a, b) => (a.estimatedCostValue ?? 1e9) - (b.estimatedCostValue ?? 1e9))[0];
  // Acting: select by ordinal (no confirmation needed), then the confirmation gate for booking.
  const selectUnknown = await act(page, { optionRef: "NOT_A_RIDE" });
  const selectSecond = await act(page, { optionRef: "2" });
  steps.REVIEW = await view(page);
  const bookWithoutConfirmation = await act(page, { actionId: "barrier-reserve-confirm" });
  const bookT0 = Date.now();
  const bookConfirmed = await act(page, { actionId: "barrier-reserve-confirm", confirmed: true });
  await page.locator(".barrier-reservation").first().waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
  const bookMs = Date.now() - bookT0;
  steps.BOOKED = await view(page);
  const transportationTool = await tool(page, "getAppointmentTransportation", { appointmentId: "appt-1" });
  await page.screenshot({ path: join(OUT, "transportation-booked-es.png") });
  return { steps, optionsOnScreen, searchMs, attempts, byRoom, cheapest, selectUnknown, selectSecond, bookWithoutConfirmation, bookConfirmed, bookMs, transportationTool };
});

// 3. Chat path (deterministic router without a key) on the transportation options screen.
await section("chat_on_transportation_es", async () => {
  await openVisit(page, { language: "es" });
  await press(page, '[data-action="appointment-open-barrier"]');
  await press(page, '[data-barrier-reason="TRANSPORTATION"]');
  await press(page, '[data-action="barrier-accept"]');
  await press(page, '[data-action="barrier-pickup-home"]');
  await press(page, '[data-need="NONE"]'); await press(page, '[data-action="barrier-needs-continue"]');
  await press(page, '[data-action="barrier-time-accept"]');
  let attempts = 0;
  while (attempts < 4 && !(await page.locator(".barrier-option").count())) {
    if (await page.locator('[data-action="barrier-time-change"]').count()) { await press(page, '[data-action="barrier-time-change"]'); await page.locator('[data-action="barrier-time-select"]').nth(attempts).click(); await press(page, '[data-action="barrier-time-accept"]'); }
    await page.waitForTimeout(1500); attempts += 1;
  }
  const turns = [];
  for (const q of ["¿Qué hago aquí?", "¿Qué opciones tengo?", "¿Cuál tiene más espacio?", "¿Cuál es la más barata?", "Pon la primera", "¿Ya está reservado?", "Por cierto, ¿qué es ACCESS?", "Bueno, volvamos al transporte", "No entendí", "Repítemelo"]) turns.push(await askChat(page, q));
  await closeChat(page);
  return { turns };
});

// 4. Appointment topics: the real list operations behind "pon que son sobre todo por la mañana" / "quita el último".
await section("topics_tool_es", async () => {
  await openVisit(page, { language: "es" });
  await press(page, '[data-action="appointment-open-prep"]');
  const prepView = await view(page);
  const ops = [];
  const run = async (label, args) => ops.push({ label, args, result: await tool(page, "manageAppointmentTopics", { appointmentId: "appt-1", ...args }) });
  await run("add mareos", { operation: "ADD", value: "Mis mareos" });
  await run("detail on 'eso' (anaphora to last topic)", { operation: "UPDATE_DETAIL", target: "eso", detail: "sobre todo por la mañana" });
  await run("add rodilla", { operation: "ADD", value: "Dolor de rodilla" });
  await run("list", { operation: "LIST" });
  await run("read first", { operation: "READ_ITEM", index: 0 });
  await run("remove last ('quita el último')", { operation: "REMOVE", index: -1 });
  await run("remove ambiguous target", { operation: "REMOVE", target: "lo de la rodilla" });
  await run("list after", { operation: "LIST" });
  const addViaAction = await act(page, { actionId: "appointment-add-prep-topic", text: "Preguntar por la presión alta por la noche" });
  const afterView = await view(page);
  return { prepView, ops, addViaAction, afterView };
});

// 5. Reschedule: slots as choices with date/time attributes ("la del jueves").
await section("reschedule_views_es", async () => {
  await openVisit(page, { language: "es" });
  await press(page, '[data-action="appointment-open-barrier"]');
  await press(page, '[data-barrier-reason="TIME_CONFLICT"]');
  const offer = await view(page);
  await press(page, '[data-action="barrier-reschedule-start"]');
  await page.locator('[data-action="barrier-slot-select"]').first().waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
  const slots = await view(page);
  const selectFirst = await act(page, { optionRef: "1" });
  const review = await view(page);
  const confirmWithout = await act(page, { actionId: "barrier-reschedule-confirm" });
  return { offer, slots, selectFirst, review, confirmWithout };
});

// 6. Companion: choose a person, review, send gate.
await section("companion_views_es", async () => {
  await openVisit(page, { language: "es", careCircle: [acceptedInvite()] });
  await press(page, '[data-action="appointment-open-barrier"]');
  await press(page, '[data-barrier-reason="CAREGIVER_AVAILABILITY"]');
  const offer = await view(page);
  const answerYes = await page.locator('[data-action="barrier-companion-answer"][data-answer="YES"], [data-action="barrier-companion-answer"]').first();
  await answerYes.click(); await settle(page);
  const contacts = await view(page);
  const selectFirst = await act(page, { optionRef: "1" });
  const review = await view(page);
  const sendWithout = await act(page, { actionId: "barrier-companion-send" });
  const careCircle = await tool(page, "getCareCircle");
  return { offer, contacts, selectFirst, review, sendWithout, careCircle };
});

// 7. Video visit check.
await section("video_visit_views_es", async () => {
  await openVisit(page, { language: "es", appointments: [appointment({ modality: "TELEHEALTH", joinUrl: "https://example.invalid/visit" })] });
  await press(page, '[data-action="appointment-open-barrier"]');
  await press(page, '[data-barrier-reason="TECHNOLOGY_TELEHEALTH"]');
  const offer = await view(page);
  await press(page, '[data-action="barrier-video-start"]');
  await page.waitForTimeout(2500);
  const result = await view(page);
  return { offer, result };
});

// 8. Enrollment screens: what EMMI sees and whether it may press anything.
await section("enrollment_views_es", async () => {
  await page.goto(`${BASE}/?scenario=access-happy`);
  await page.waitForSelector(".shell", { state: "attached", timeout: 30000 });
  await page.evaluate(() => localStorage.removeItem("itera.enrollment.safe-draft.v2"));
  await page.reload();
  await page.waitForSelector("#screen-content", { state: "visible", timeout: 30000 });
  // Switch the patient experience to Spanish.
  await page.locator('[data-action="language"]').first().click().catch(() => {});
  await settle(page);
  const lang = await page.evaluate(() => document.documentElement.lang);
  const screens = {};
  for (const screen of ["INVITATION", "DECISION_MAKER", "IDENTITY_VERIFICATION", "CARE_RECOMMENDATION", "ACCESS_PRE_ELIGIBILITY_NOTICE", "ACCESS_ELIGIBILITY_RESULT", "DISCLOSURE", "CONSENT_REVIEW", "ENROLLMENT_CONFIRMED"]) {
    const select = page.locator("#screen-select");
    if (!(await select.count())) break;
    await select.selectOption(screen, { force: true }).catch(() => {});
    await page.waitForTimeout(300);
    screens[screen] = await view(page);
  }
  const contextProbe = await tool(page, "getEnrollmentContext");
  const contextJson = JSON.stringify(contextProbe?.result || {});
  return { lang, screens, systemContextChars: contextJson.length, systemContextKeys: Object.keys(contextProbe?.result || {}) };
});

// 9. My Care / goals views and the goal tools.
await section("my_care_and_goals_es", async () => {
  await page.goto(`${BASE}/?scenario=access-happy`);
  await page.waitForSelector(".shell", { state: "attached", timeout: 30000 });
  await settle(page);
  await seed(page, { language: "es", screen: "MY_CARE", appointments: [appointment()] });
  await page.reload();
  await page.waitForSelector("#screen-content", { state: "visible", timeout: 30000 });
  const myCare = await view(page);
  const goalsTool = await tool(page, "getPatientGoals");
  const careTeam = await tool(page, "getCareTeam");
  const upcoming = await tool(page, "getUpcomingAppointments");
  const next = await tool(page, "getNextBestAction");
  const contextProbe = await tool(page, "getEnrollmentContext");
  const chat = [];
  for (const q of ["¿Qué hago ahora?", "No tengo cómo llegar a la cita", "Quiero cambiar mi cita al jueves", "Mejor no quiero cambiarla", "También tengo dolor fuerte en el pecho ahora"]) chat.push(await askChat(page, q));
  await closeChat(page);
  return { myCare, goalsTool, careTeam, upcoming, next, systemContextChars: JSON.stringify(contextProbe?.result || {}).length, chat };
});

await browser.close();
results.finishedAt = new Date().toISOString();
save();
console.log(`\nWrote ${join(OUT, "baseline-probes.json")}`);
