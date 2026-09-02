import { expect, test } from "@playwright/test";
import { appointment, draft, inDays, openAppointments } from "./appointmentSurfaces.js";

// EMMI knowing what the patient is looking at.
//
// The defect these tests exist for: a live voice session takes its system instruction once, at
// setup, so everything EMMI knew was frozen at the moment the microphone opened — and what it knew
// was a route name, which stopped identifying a screen the moment a route grew a flow inside it.
//
// Two halves, deliberately separated because they fail for different reasons:
//
//   MECHANISM  the app publishes the view, notices when it changes, pushes it into the live
//              session, and presses only controls that are really on screen. All deterministic.
//   ANSWERS    what EMMI actually says with it. A model, so asserted on the grounded facts that
//              must appear and the claims that must not, never on wording.
//
// The live half needs GEMINI_API_KEY, which lives in .env and is gitignored, so a worktree without
// one skips rather than fails — and says so, because a green run that exercised nothing is worse
// than a red one.

const MOBILE = { width: 384, height: 820 };

const confirmedVisit = () => appointment({
  scheduledAt: inDays(3, 14),
  scheduledEndAt: inDays(3, 15),
  providerDisplayName: "Dr. Fresner Lee",
  locationAddress: "800 Ponce de Leon Blvd, Coral Gables, FL 33134"
});

const openVisit = async (page, options = {}) => {
  await page.setViewportSize(MOBILE);
  await openAppointments(page, { appointments: [confirmedVisit()], ...options });
  await page.goto("/?scenario=access-happy&barrierLatency=0");
  await page.waitForSelector("#screen-content", { state: "visible", timeout: 30000 });
  await page.locator('[data-action="appointment-open"]').first().click();
};

// The demo dispatcher returns nothing for roughly one trip in eight, keyed deterministically on
// the pickup time — and the pickup time moves with today's date, so a fixed fixture lands on that
// branch on some days. Rather than pin a date, this walks the recovery the product already offers:
// choose a different pickup time until there are rides, which is what a patient would do.
const reachRideOptions = async page => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await page.locator(".barrier-option").count()) return true;
    const empty = page.locator('[data-action="barrier-time-change"]');
    if (!await empty.count()) await page.waitForTimeout(1500);
    if (await page.locator(".barrier-option").count()) return true;
    if (!await empty.count()) return false;
    await empty.first().click();
    await page.locator('[data-action="barrier-time-select"]').nth(attempt).click();
    await page.locator('[data-action="barrier-time-accept"]').first().click();
    await page.waitForTimeout(2000);
  }
  return Boolean(await page.locator(".barrier-option").count());
};

const press = async (page, selector) => {
  const control = page.locator(selector).first();
  await expect(control).toBeVisible({ timeout: 15000 });
  await control.click();
};

// The voice telemetry the app writes on every context push. This is the mechanism assertion: it
// says the app told the session the screen changed, without needing the model to say anything.
// Every entry rather than the last: the audit log rolls, and a push recorded in an earlier entry
// is still a push that happened.
const contextPushes = page => page.evaluate(() => {
  const logs = JSON.parse(sessionStorage.getItem("itera.emmi.prototype.audit.v1") || "[]");
  return logs.flatMap(entry => entry?.voiceEvents || []).filter(event => event.type === "EMMI_VOICE_CONTEXT_UPDATED");
});

const allVoiceEvents = page => page.evaluate(() => {
  const logs = JSON.parse(sessionStorage.getItem("itera.emmi.prototype.audit.v1") || "[]");
  return logs.flatMap(entry => entry?.voiceEvents || []).map(event => event.type);
});

/* ==========================================================================================
   MECHANISM — the app's half, all deterministic
   ========================================================================================== */

test.describe("the app publishes what the patient is looking at", () => {
  test("answers 'what do I do here' for the STEP, not for the route", async ({ page }) => {
    test.setTimeout(120000);
    await openVisit(page);
    // Every one of these lives on the single route APPOINTMENT_DETAIL. Before the view contract
    // they all produced the same generic sentence, which is the defect in one assertion.
    const askHere = async () => {
      await page.locator('.emmi-guide [data-action="help"], .emmi-welcome [data-action="help"]').first().click();
      await expect(page.locator(".assistant-layer")).toBeVisible();
      const input = page.locator(".assistant-layer textarea, .assistant-layer input[type='text']").first();
      await input.fill("What do I do here?");
      await input.press("Enter");
      // "EMMI is thinking" is on screen while the turn is in flight; reading before it clears is
      // reading the spinner rather than the answer.
      await expect(page.locator(".assistant-layer")).not.toContainText(/thinking|pensando|ap reflechi/i, { timeout: 20000 });
      const answer = await page.locator(".assistant-layer").innerText();
      await page.keyboard.press("Escape");
      return answer;
    };

    await press(page, '[data-action="appointment-open-barrier"]');
    const onCheck = await askHere();
    expect(onCheck).toMatch(/could make it hard|difficult/i);

    await press(page, '[data-barrier-reason="TRANSPORTATION"]');
    const onOffer = await askHere();
    expect(onOffer).toMatch(/look for a ride|ride to this appointment/i);
    expect(onOffer).not.toBe(onCheck);

    await press(page, '[data-action="barrier-accept"]');
    const onPickup = await askHere();
    expect(onPickup).toMatch(/pick you up|address/i);
    expect(onPickup).not.toBe(onOffer);
  });

  test("the view changes as the patient walks the flow, and carries the real options", async ({ page }) => {
    test.setTimeout(120000);
    await openVisit(page);
    await press(page, '[data-action="appointment-open-barrier"]');
    await press(page, '[data-barrier-reason="TRANSPORTATION"]');
    await press(page, '[data-action="barrier-accept"]');
    await press(page, '[data-action="barrier-pickup-home"]');
    await press(page, '[data-need="NONE"]');
    await press(page, '[data-action="barrier-needs-continue"]');
    await press(page, '[data-action="barrier-time-accept"]');
    await expect(page.locator(".barrier-option")).not.toHaveCount(0, { timeout: 20000 });

    // The options on screen and the options EMMI can see are the same list, in the same order,
    // with the prices the patient is reading.
    const onScreen = await page.locator(".barrier-option .barrier-option-head strong").allInnerTexts();
    const seen = await page.evaluate(() => window.__emmiViewProbe?.());
    expect(seen, "the app exposes the published view for tests").toBeTruthy();
    expect(seen.choices.map(choice => choice.label)).toEqual(onScreen);
    expect(seen.choices.every(choice => typeof choice.n === "number")).toBe(true);
    expect(seen.choices.some(choice => choice.estimatedCost)).toBe(true);
    expect(seen.viewId).toContain("OPTIONS");
  });

  test("selected is never reported as done", async ({ page }) => {
    test.setTimeout(120000);
    await openVisit(page);
    await press(page, '[data-action="appointment-open-barrier"]');
    await press(page, '[data-barrier-reason="TRANSPORTATION"]');
    await press(page, '[data-action="barrier-accept"]');
    await press(page, '[data-action="barrier-pickup-home"]');
    await press(page, '[data-need="NONE"]');
    await press(page, '[data-action="barrier-needs-continue"]');
    await press(page, '[data-action="barrier-time-accept"]');
    await expect(page.locator(".barrier-option")).not.toHaveCount(0, { timeout: 20000 });
    await press(page, '[data-action="barrier-option-select"]');

    const chosen = await page.evaluate(() => window.__emmiViewProbe?.());
    expect(chosen.selected).toBeTruthy();
    expect(chosen.alreadyDone.join(" ")).not.toMatch(/booked/i);
    expect(chosen.stillPending.join(" ")).toMatch(/NOT booked/i);

    await press(page, '[data-action="barrier-reserve-confirm"]');
    await expect(page.locator(".barrier-reservation")).toBeVisible({ timeout: 20000 });
    const booked = await page.evaluate(() => window.__emmiViewProbe?.());
    expect(booked.alreadyDone.join(" ")).toMatch(/Ride booked/i);
    expect(booked.stillPending.join(" ")).not.toMatch(/NOT booked/i);
  });

  test("EMMI can only press what is really on the screen", async ({ page }) => {
    test.setTimeout(120000);
    await openVisit(page);
    await press(page, '[data-action="appointment-open-barrier"]');
    await press(page, '[data-barrier-reason="TRANSPORTATION"]');
    await press(page, '[data-action="barrier-accept"]');
    await press(page, '[data-action="barrier-pickup-home"]');
    await press(page, '[data-need="NONE"]');
    await press(page, '[data-action="barrier-needs-continue"]');
    await press(page, '[data-action="barrier-time-accept"]');
    await expect(page.locator(".barrier-option")).not.toHaveCount(0, { timeout: 20000 });

    // A ride that is not on this screen is refused, with the real ones handed back.
    const unknown = await page.evaluate(() => window.__emmiActionProbe?.({ optionRef: "NOT_A_RIDE" }));
    expect(unknown.success).toBe(false);
    expect(unknown.availableChoices.length).toBeGreaterThan(0);
    expect(await page.locator(".barrier-option").count()).toBeGreaterThan(0);

    // "Select the second one." A selection is reversible, so it needs no confirmation — and
    // choosing a ride is what moves the screen on to the review, exactly as a tap would.
    const secondLabel = (await page.locator(".barrier-option .barrier-option-head strong").allInnerTexts())[1];
    const selected = await page.evaluate(() => window.__emmiActionProbe?.({ optionRef: "2" }));
    expect(selected.success).toBe(true);
    expect(selected.currentView.selected.label).toBe(secondLabel);
    // The screen really moved: the review is showing the ride EMMI chose.
    await expect(page.locator(".barrier-review")).toBeVisible();
    await expect(page.locator(".barrier-review")).toContainText(secondLabel);

    // And on a screen with no list, asking for "the second one" is told what this screen has.
    const onReview = await page.evaluate(() => window.__emmiActionProbe?.({ optionRef: "2" }));
    expect(onReview.success).toBe(false);
    expect(onReview.availableActions.map(item => item.id)).toContain("barrier-reserve-confirm");
  });

  test("refuses to book, cancel or send without the patient confirming in that turn", async ({ page }) => {
    test.setTimeout(120000);
    await openVisit(page);
    await press(page, '[data-action="appointment-open-barrier"]');
    await press(page, '[data-barrier-reason="TRANSPORTATION"]');
    await press(page, '[data-action="barrier-accept"]');
    await press(page, '[data-action="barrier-pickup-home"]');
    await press(page, '[data-need="NONE"]');
    await press(page, '[data-action="barrier-needs-continue"]');
    await press(page, '[data-action="barrier-time-accept"]');
    await expect(page.locator(".barrier-option")).not.toHaveCount(0, { timeout: 20000 });
    await press(page, '[data-action="barrier-option-select"]');

    const refused = await page.evaluate(() => window.__emmiActionProbe?.({ actionId: "barrier-reserve-confirm" }));
    expect(refused.success).toBe(false);
    expect(refused.status).toBe("CONFIRMATION_REQUIRED");
    // And nothing happened: the ride is still only selected.
    expect((await draft(page)).barrierResolutions[0].data.reservation).toBeFalsy();

    const booked = await page.evaluate(() => window.__emmiActionProbe?.({ actionId: "barrier-reserve-confirm", confirmed: true }));
    expect(booked.success).toBe(true);
    await expect(page.locator(".barrier-reservation")).toBeVisible({ timeout: 20000 });
    expect((await draft(page)).barrierResolutions[0].data.reservation.reservationId).toMatch(/^UB-/);
  });

  test("adds a topic in the patient's own words, and the screen shows it", async ({ page }) => {
    test.setTimeout(120000);
    await openVisit(page);
    await press(page, '[data-action="appointment-open-prep"]');

    // Without the words there is nothing to add, and EMMI is told to ask for them.
    const empty = await page.evaluate(() => window.__emmiActionProbe?.({ actionId: "appointment-add-prep-topic" }));
    expect(empty.success).toBe(false);
    expect(empty.status).toBe("NEEDS_TYPED_INPUT");

    const added = await page.evaluate(() => window.__emmiActionProbe?.({ actionId: "appointment-add-prep-topic", text: "Ask the doctor about my dizziness" }));
    expect(added.success).toBe(true);
    // It is on the record, and it is on the screen — one truth, not two.
    expect((await draft(page)).appointments[0].prep.topics).toContain("Ask the doctor about my dizziness");
    await expect(page.locator(".appointment-topics")).toContainText("dizziness");
    expect(added.currentView.alreadyDone.join(" ")).toContain("dizziness");
  });

  test("every screen in the product tells EMMI something, describer or not", async ({ page }) => {
    test.setTimeout(120000);
    await openVisit(page);
    // A screen with a describer.
    await press(page, '[data-action="appointment-open-barrier"]');
    const described = await page.evaluate(() => window.__emmiViewProbe?.());
    expect(described.viewId).toBe("APPOINTMENT_PRE_VISIT_CHECK");
    expect(described.choices.length).toBeGreaterThan(0);

    // And one without: My Care has no describer, and still reports its heading and its controls
    // rather than being a blank. This is what keeps a feature added tomorrow visible.
    await press(page, '[data-action="appointment-back"]');
    const floor = await page.evaluate(() => window.__emmiViewProbe?.());
    expect(floor.viewId).toContain("SCREEN_");
    expect(floor.title.length).toBeGreaterThan(0);
    expect(floor.availableActions.length).toBeGreaterThan(0);
  });
});

/* ==========================================================================================
   Chat / Voice / UI — one assistant, one truth
   ========================================================================================== */

test.describe("chat, voice and the screen stay one conversation", () => {
  test("a change made in the UI is known to chat on its next turn", async ({ page }) => {
    test.setTimeout(120000);
    await openVisit(page);
    await press(page, '[data-action="appointment-open-prep"]');
    await page.locator("#appointment-prep-topic").fill("My blood pressure readings");
    await press(page, '[data-action="appointment-add-prep-topic"]');

    const view = await page.evaluate(() => window.__emmiViewProbe?.());
    expect(view.alreadyDone.join(" ")).toContain("My blood pressure readings");
  });

  test("a change made through EMMI is known to the UI immediately", async ({ page }) => {
    test.setTimeout(120000);
    await openVisit(page);
    await press(page, '[data-action="appointment-open-prep"]');
    await page.evaluate(() => window.__emmiActionProbe?.({ actionId: "appointment-add-prep-topic", text: "The lab results" }));
    await expect(page.locator(".appointment-topics")).toContainText("The lab results");
    // And to chat, which reads the same descriptor on its next turn.
    const view = await page.evaluate(() => window.__emmiViewProbe?.());
    expect(view.alreadyDone.join(" ")).toContain("The lab results");
  });
});

/* ==========================================================================================
   LIVE VOICE — the original defect, end to end
   ========================================================================================== */

test.describe("EMMI Voice keeps up with the screen", () => {
  test.beforeEach(async ({ page }) => {
    const token = await page.request.post("/api/emmi/live-token", { data: { locale: "en-US" } });
    const body = await token.json().catch(() => ({}));
    test.skip(!body.token, "no GEMINI_API_KEY in this checkout, so no live voice session can be opened");
  });

  // The voice state is not on every screen's markup, so the session itself is asked rather than
  // the DOM. A failure here is a failure to connect, and it says which, rather than timing out on
  // a selector that was never going to appear.
  const startVoice = async page => {
    await page.getByRole("button", { name: /Guide by voice|Guía por voz/ }).first().click();
    await expect.poll(() => page.evaluate(() => window.__emmiVoiceProbe?.()), { timeout: 45000 })
      .toMatchObject({ active: true });
  };

  test("narrates the first and second form screens even when Start is pressed while voice is connecting", async ({ page }) => {
    test.setTimeout(180000);
    await page.goto("/new");

    // This deliberately does not wait for startVoice(): it reproduces the production race where
    // the patient accepts voice and immediately continues before the live socket exists.
    await page.getByRole("button", { name: /Guide by voice|Guía por voz/ }).first().click();
    await page.getByRole("button", { name: /Start your care journey|Comenzar/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Who is completing|Quién está completando/);
    await expect.poll(() => page.evaluate(() => window.__emmiVoiceProbe?.()), { timeout: 45000 })
      .toMatchObject({ state: "EMMI_SPEAKING", active: true, socket: true });
    await expect.poll(() => page.evaluate(() => window.__emmiVoiceProbe?.()), { timeout: 45000 })
      .toMatchObject({ state: "LISTENING", active: true, socket: true });

    await page.getByRole("button", { name: /Continue|Continuar/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/securely confirm|confirmar.*identidad/i);
    await expect.poll(() => page.evaluate(() => window.__emmiVoiceProbe?.()), { timeout: 45000 })
      .toMatchObject({ state: "EMMI_SPEAKING", active: true, socket: true });
    await expect.poll(() => page.evaluate(() => window.__emmiVoiceProbe?.()), { timeout: 45000 })
      .toMatchObject({ state: "LISTENING", active: true, socket: true });
  });

  test("a session opened on one step is told about every step after it", async ({ page }) => {
    test.setTimeout(180000);
    await openVisit(page);
    await press(page, '[data-action="appointment-open-barrier"]');
    await press(page, '[data-barrier-reason="TRANSPORTATION"]');
    await startVoice(page);

    const before = (await contextPushes(page)).length;

    // The patient walks on without closing voice. This is the exact scenario that used to leave
    // EMMI answering from the screen the microphone opened on.
    await press(page, '[data-action="barrier-accept"]');
    await press(page, '[data-action="barrier-pickup-home"]');
    await press(page, '[data-need="NONE"]');
    await press(page, '[data-action="barrier-needs-continue"]');
    await press(page, '[data-action="barrier-time-accept"]');
    await expect(page.locator(".barrier-option")).not.toHaveCount(0, { timeout: 20000 });

    await expect.poll(() => contextPushes(page).then(list => list.length), { timeout: 20000 }, )
      .toBeGreaterThan(before);
    // And the newest thing the session was told is the screen the patient is now on.
    const pushes = await contextPushes(page);
    expect(pushes.at(-1).bytes).toBeGreaterThan(0);
    const view = await page.evaluate(() => window.__emmiViewProbe?.());
    expect(view.viewId).toContain("OPTIONS");
  });

  test("the session is told the screen changed even while EMMI is mid-sentence", async ({ page }) => {
    test.setTimeout(180000);
    await openVisit(page);
    await press(page, '[data-action="appointment-open-barrier"]');
    await startVoice(page);
    // Screen guidance speaks on connect; moving during it must not lose the update, only delay it.
    await press(page, '[data-barrier-reason="TRANSPORTATION"]');
    await press(page, '[data-action="barrier-accept"]');
    await expect.poll(() => contextPushes(page).then(list => list.length), { timeout: 30000 }).toBeGreaterThan(0);
  });
});

/* ==========================================================================================
   THE MANDATORY WALKS — what EMMI actually says, on a live session
   ==========================================================================================
   A model, so these assert on the grounded facts that must appear and the claims that must not.
   Wording is never asserted; "is it booked yet" answering NO before confirmation and YES after is.
   The question goes in as a patient turn on the same live session, against the same context a
   spoken one reaches — the context is what these tests are about, not the microphone. */

// Chrome's fake capture device emits a continuous tone, and the session is configured so that the
// start of patient speech interrupts EMMI. Under that tone she is interrupted a word into every
// answer, so these specs capture the microphone with a silent stream instead — the same
// substitution e2e/emmiAudioPipeline.spec.js makes, and for the same reason.
const silenceTheMicrophone = page => page.addInitScript(() => {
  const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = constraints => {
    if (!constraints?.audio) return nativeGetUserMedia(constraints);
    const context = new AudioContext();
    const destination = context.createMediaStreamDestination();
    const gain = context.createGain();
    gain.gain.value = 0;
    const oscillator = context.createOscillator();
    oscillator.connect(gain).connect(destination);
    oscillator.start();
    window.__emmiSilentMicContext = context;
    return Promise.resolve(destination.stream);
  };
});

test.describe("EMMI Voice walks the flows with the patient", () => {
  test.beforeEach(async ({ page }) => {
    await silenceTheMicrophone(page);
    const token = await page.request.post("/api/emmi/live-token", { data: { locale: "en-US" } });
    const body = await token.json().catch(() => ({}));
    test.skip(!body.token, "no GEMINI_API_KEY in this checkout, so no live voice session can be opened");
  });

  const startVoice = async page => {
    await page.getByRole("button", { name: /Guide by voice|Guía por voz/ }).first().click();
    await expect.poll(() => page.evaluate(() => window.__emmiVoiceProbe?.()), { timeout: 45000 }).toMatchObject({ active: true });
  };
  const ask = (page, question) => page.evaluate(text => window.__emmiVoiceAsk(text), question);
  const why = result => JSON.stringify(result);

  test("MANDATORY 1 — transportation, from 'what do I do here' to a booked ride", async ({ page }) => {
    test.setTimeout(300000);
    await openVisit(page);
    await press(page, '[data-action="appointment-open-barrier"]');
    await press(page, '[data-barrier-reason="TRANSPORTATION"]');
    await startVoice(page);

    const here = await ask(page, "What do I have to do here?");
    expect(here.ok, why(here)).toBe(true);
    expect(here.text).toMatch(/ride|transport|car/i);

    // The patient walks on without closing voice. This is the scenario the whole change exists for.
    await press(page, '[data-action="barrier-accept"]');
    await press(page, '[data-action="barrier-pickup-home"]');
    await press(page, '[data-need="NONE"]');
    await press(page, '[data-action="barrier-needs-continue"]');
    await press(page, '[data-action="barrier-time-accept"]');
    expect(await reachRideOptions(page), "the demo dispatcher offered no rides at any pickup time").toBe(true);

    const count = await page.locator(".barrier-option").count();
    const options = await ask(page, "What options do I have?");
    expect(options.ok, why(options)).toBe(true);
    // A spoken answer says "a standard car", not the brand on the card, so what is asserted is
    // that it knows how many there are and describes them — three steps after the session opened,
    // on a screen the microphone never saw.
    // EMMI describes the rides rather than reading the brand names off the cards, which is what a
    // voice assistant should do — so what is asserted is that it describes the ones on screen.
    expect(options.text).toMatch(/standard|wheelchair|accessible|more room/i);
    expect(options.text.match(/standard|wheelchair|accessible|more room/gi).length).toBeGreaterThanOrEqual(2);
    expect(count).toBeGreaterThan(1);

    const roomiest = await page.evaluate(() => {
      const view = window.__emmiViewProbe();
      return [...view.choices].sort((a, b) => (b.seats || 0) - (a.seats || 0))[0];
    });
    const room = await ask(page, "Which one has more room?");
    expect(room.ok, why(room)).toBe(true);
    expect(roomiest.seats).toBeGreaterThan(3);
    // The seat count exists nowhere but the view's own attributes, so naming it is the proof that
    // the answer came from the screen rather than from what a rideshare app generally offers.
    // Spoken as a word, so both spellings count.
    const seatWords = { 2: "two", 3: "three", 4: "four", 5: "five", 6: "six" };
    expect(room.text).toMatch(new RegExp(`${roomiest.seats}|${seatWords[roomiest.seats] || roomiest.seats}|more room|larger|bigger|XL`, "i"));

    // Before any confirmation, "is it booked" must be answered no. EMMI may already have moved to
    // the review itself while answering — she offers to — so this selects only if the list is
    // still the screen the patient is on.
    if (await page.locator('[data-action="barrier-option-select"]').count()) {
      await press(page, '[data-action="barrier-option-select"]');
    }
    await expect(page.locator('[data-action="barrier-reserve-confirm"]')).toBeVisible({ timeout: 15000 });
    const notYet = await ask(page, "Is it booked already?");
    expect(notYet.ok, why(notYet)).toBe(true);
    expect(notYet.text).toMatch(/not yet|not booked|no.{0,25}booked|still need|hasn|haven|before.{0,20}book/i);

    await press(page, '[data-action="barrier-reserve-confirm"]');
    await expect(page.locator(".barrier-reservation")).toBeVisible({ timeout: 20000 });
    const nowBooked = await ask(page, "Is it booked already?");
    expect(nowBooked.ok, why(nowBooked)).toBe(true);
    expect(nowBooked.text).toMatch(/booked|reserved|confirmed|all set/i);
    expect(nowBooked.text).not.toMatch(/not booked|isn.t booked|is not booked|not yet/i);

    const timeAnswer = await ask(page, "What time are they coming?");
    expect(timeAnswer.ok, why(timeAnswer)).toBe(true);
    // Speech renders a clock time as "2 00 PM", so the punctuation is not what is asserted.
    expect(timeAnswer.text).toMatch(/\d{1,2}\s*[:.\s]\s*\d{2}\s*(a\.?m|p\.?m)/i);
  });

  test("MANDATORY 2 — reschedule knows the times and the new appointment", async ({ page }) => {
    test.setTimeout(300000);
    await openVisit(page);
    await press(page, '[data-action="appointment-open-barrier"]');
    await press(page, '[data-barrier-reason="TIME_CONFLICT"]');
    await press(page, '[data-action="barrier-reschedule-start"]');
    await expect(page.locator(".barrier-slot")).not.toHaveCount(0, { timeout: 20000 });
    await startVoice(page);

    const first = await page.evaluate(() => window.__emmiViewProbe().choices[0]);
    const times = await ask(page, "What times are available?");
    expect(times.ok, why(times)).toBe(true);
    // A day and date that exist only in the view. Speech renders the clock as "2 45 PM", so the
    // date is what is asserted rather than the punctuation.
    const [weekday, monthDay] = String(first.date || "").split(",").map(part => part.trim());
    expect(times.text).toMatch(new RegExp(weekday, "i"));
    expect(times.text).toMatch(new RegExp(String(monthDay || "").split(" ")[0], "i"));

    await press(page, '[data-action="barrier-slot-select"]');
    const notYet = await ask(page, "Has my appointment changed already?");
    expect(notYet.ok, why(notYet)).toBe(true);
    expect(notYet.text).toMatch(/not yet|hasn|has not|still need|confirm/i);

    await press(page, '[data-action="barrier-reschedule-confirm"]');
    await expect(page.locator(".barrier-success")).toBeVisible({ timeout: 20000 });
    const now = await ask(page, "When is my appointment now?");
    expect(now.ok, why(now)).toBe(true);
    // The new date, which exists only on the record the reschedule just wrote.
    const moved = await page.evaluate(() => window.__emmiViewProbe().onScreen?.map(fact => Object.values(fact)[0]).join(" ") || "");
    expect(moved.length).toBeGreaterThan(0);
    expect(now.text).toMatch(/\d{1,2}\s*[:.\s]\s*\d{2}\s*(a\.?m|p\.?m)/i);
  });

  test("MANDATORY 3 — video visit readiness names the check that failed", async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize(MOBILE);
    await openAppointments(page, { appointments: [appointment({ modality: "TELEHEALTH", scheduledAt: inDays(3, 14), scheduledEndAt: inDays(3, 15) })] });
    await page.goto("/?scenario=access-happy&barrierLatency=0");
    await page.waitForSelector("#screen-content", { state: "visible", timeout: 30000 });
    await page.locator('[data-action="appointment-open"]').first().click();
    await press(page, '[data-action="appointment-open-barrier"]');
    await press(page, '[data-barrier-reason="TECHNOLOGY_TELEHEALTH"]');
    await press(page, '[data-action="barrier-video-start"]');
    await expect(page.locator(".barrier-checks li")).toHaveCount(4, { timeout: 20000 });
    await startVoice(page);

    const view = await page.evaluate(() => window.__emmiViewProbe());
    const missing = await ask(page, "What is missing?");
    expect(missing.ok, why(missing)).toBe(true);
    if (view.stillPending.length) {
      // It names the specific check, not video visits in general.
      const failing = view.stillPending[0].split(":")[0];
      expect(missing.text.toLowerCase()).toContain(failing.toLowerCase());
    } else {
      expect(missing.text).toMatch(/ready|nothing|all set/i);
    }
  });

  test("MANDATORY 4 — companion knows who can come and whether they answered", async ({ page }) => {
    test.setTimeout(300000);
    await openVisit(page);
    await press(page, '[data-action="appointment-open-barrier"]');
    await press(page, '[data-barrier-reason="CAREGIVER_AVAILABILITY"]');
    await press(page, '[data-answer="YES"]');
    await expect(page.locator(".barrier-person")).not.toHaveCount(0);
    await startVoice(page);

    const who = await ask(page, "Who can come with me?");
    expect(who.ok, why(who)).toBe(true);
    expect(who.text).toMatch(/Maria/i);

    await press(page, '[data-contact-id="demo-maria"]');
    const beforeSending = await ask(page, "Did she confirm already?");
    expect(beforeSending.ok, why(beforeSending)).toBe(true);
    // Nothing has been sent, so nothing may be reported as confirmed.
    expect(beforeSending.text).not.toMatch(/yes,? she (has )?confirmed|she said yes|she confirmed/i);

    await press(page, '[data-action="barrier-companion-send"]');
    await expect(page.locator(".barrier-screen")).toContainText(/confirmed/i, { timeout: 30000 });
    const afterAnswer = await ask(page, "Did she confirm already?");
    expect(afterAnswer.ok, why(afterAnswer)).toBe(true);
    expect(afterAnswer.text).toMatch(/confirm|yes|coming|said yes/i);
  });

  test("MANDATORY 5 — a topic dictated by voice reaches the record and the screen", async ({ page }) => {
    test.setTimeout(300000);
    await openVisit(page);
    await press(page, '[data-action="appointment-open-prep"]');
    await startVoice(page);

    // A topic with nothing clinical in it, first: this is the mechanism — the patient's words go
    // through EMMI into the record and onto the screen they are looking at.
    const added = await ask(page, "Add that I want to ask the doctor about my lab results.");
    expect(added.ok, why(added)).toBe(true);
    await expect.poll(() => draft(page).then(stored => stored.appointments[0].prep.topics.join(" ")), { timeout: 25000, message: `EMMI said: ${added.text}` }).toMatch(/lab/i);
    await expect(page.locator(".appointment-topics")).toContainText(/lab/i);

    // What EMMI can see afterwards is asserted on the descriptor rather than on the read-back:
    // a spoken answer is captured as a stream of transcript chunks and the first of them can be
    // missed, which makes the words an unreliable thing to assert and the context a reliable one.
    const afterAdding = await page.evaluate(() => window.__emmiViewProbe());
    expect(afterAdding.alreadyDone.join(" ")).toMatch(/lab/i);
    const listed = await ask(page, "What do I have written down?");
    expect(listed.ok, why(listed)).toBe(true);

    // A topic that names a symptom. Writing a question down decides nothing and advises nothing,
    // so it is never an alternative to the safety path — it is both. The rule is carried on the
    // view itself rather than in the system prompt, because this view is re-sent on every change
    // and a prompt paragraph is what a long session summarises away first.
    const symptom = await ask(page, "Also add that I want to ask about my dizziness.");
    await expect.poll(() => draft(page).then(stored => stored.appointments[0].prep.topics.join(" ")), { timeout: 25000, message: `EMMI said: ${symptom.text || symptom.reason}` }).toMatch(/dizz/i);
    await expect(page.locator(".appointment-topics")).toContainText(/dizz/i);
  });

  test("MANDATORY 6 — a change made in the UI is known to voice, and one made by voice to chat", async ({ page }) => {
    test.setTimeout(300000);
    await openVisit(page);
    await press(page, '[data-action="appointment-open-prep"]');

    // UI -> Voice.
    await page.locator("#appointment-prep-topic").fill("My blood pressure readings");
    await press(page, '[data-action="appointment-add-prep-topic"]');
    await startVoice(page);
    const knowsUi = await ask(page, "What do I have written down?");
    expect(knowsUi.ok, why(knowsUi)).toBe(true);
    expect(knowsUi.text).toMatch(/blood pressure/i);

    // Voice -> the record and the screen.
    await ask(page, "Also add that I want to ask about my lab results.");
    await expect.poll(() => draft(page).then(stored => stored.appointments[0].prep.topics.join(" ")), { timeout: 25000 }).toMatch(/lab/i);
    await expect(page.locator(".appointment-topics")).toContainText(/lab/i);

    // Voice -> Chat: chat reads the same descriptor on its next turn.
    const view = await page.evaluate(() => window.__emmiViewProbe());
    expect(view.alreadyDone.join(" ")).toMatch(/lab/i);
    expect(view.alreadyDone.join(" ")).toMatch(/blood pressure/i);
  });
});

/* ==========================================================================================
   THE REST OF THE PRODUCT — the five areas that used to have only the DOM floor
   ==========================================================================================
   Each of these screens reached EMMI as a heading and a list of buttons whose nature was guessed
   from a verb. These assert that a person has now written down what each one is, and that a screen
   nobody has written down can be explained but not acted on. */

test.describe("the rest of the product is described, not inferred", () => {
  const jumpTo = async (page, screen) => {
    await page.goto("/?scenario=access-happy");
    await page.waitForSelector("#screen-content", { state: "visible", timeout: 30000 });
    await page.locator("#screen-select").selectOption(screen, { force: true });
    await page.waitForTimeout(600);
  };

  const seen = page => page.evaluate(() => window.__emmiViewProbe?.());

  // My Goals and My Care live after enrollment, so the dev console's journey list cannot reach
  // them. They are seeded the way the appointment specs seed theirs.
  const openAfterEnrollment = async (page, screen, extra = {}) => {
    await page.setViewportSize(MOBILE);
    await openAppointments(page, { appointments: [], screen, ...extra });
    await page.goto("/?scenario=access-happy");
    await page.waitForSelector("#screen-content", { state: "visible", timeout: 30000 });
  };

  const planGoal = () => ({
    id: "goal-bp", patientId: "patient_demo", goalType: "BLOOD_PRESSURE_CONTROL",
    title: "Lower my blood pressure", goalSource: "PATHWAY", selectedBy: "PATIENT",
    status: "ACTIVE", priority: "PRIMARY", planStatus: "READY", whyItMatters: "",
    actions: [
      { id: "a1", goalId: "goal-bp", templateId: "check-bp", title: "Check my blood pressure", actionType: "MEASURE", source: "TEMPLATE", frequency: "daily", status: "ACTIVE", completionHistory: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: "a2", goalId: "goal-bp", templateId: "medications-as-directed", title: "Take my medication", actionType: "MEDICATION", source: "TEMPLATE", frequency: "daily", status: "COMPLETED", completionHistory: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ],
    progress: [], barriers: [], reviews: [], supportRequests: [],
    createdBy: "PATIENT", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });

  test("goals carry the plan, split into done and still owed", async ({ page }) => {
    test.setTimeout(120000);
    await openAfterEnrollment(page, "MY_GOALS", { patientGoals: [planGoal()] });
    const view = await seen(page);
    expect(view.youMayPressTheseYourself, "MY_GOALS should be described, not inferred").toBe(true);
    expect(view.viewId).toMatch(/^GOAL_/);
    expect(view.whatThePatientMustDoHere.length).toBeGreaterThan(10);
    // Pausing a goal changes the patient's plan, so it is not navigation.
    // Every control the describer names is a control that is really there — anything else is
    // dropped before EMMI sees it, so an empty list here means the describer has drifted.
    expect(view.availableActions.length).toBeGreaterThan(0);
    const onScreen = await page.evaluate(() => [...document.querySelectorAll("#screen-content [data-action]")].map(el => el.dataset.action));
    for (const item of view.availableActions) expect(onScreen, item.id).toContain(item.id);
  });

  test("medications say which ones are still unreviewed", async ({ page }) => {
    test.setTimeout(120000);
    await jumpTo(page, "MEDICATIONS_REVIEW");
    const view = await seen(page);
    expect(view.youMayPressTheseYourself).toBe(true);
    expect(view.viewId).toMatch(/^MEDICATION_/);
    expect(view.notes.join(" ")).toMatch(/never renew a prescription/i);
  });

  test("the enrollment screens answer with the sentence EMMI speaks", async ({ page }) => {
    test.setTimeout(120000);
    await jumpTo(page, "CONSENT_REVIEW");
    const view = await seen(page);
    expect(view.youMayPressTheseYourself).toBe(true);
    expect(view.viewId).toBe("ENROLLMENT_CONSENT_REVIEW");
    expect(view.notes.join(" ")).toMatch(/never mark a checkbox, consent, sign/i);
  });

  test("the monitor counts the readings received against the readings still needed", async ({ page }) => {
    test.setTimeout(120000);
    await jumpTo(page, "ACCESS_BP_DEVICE_INFO");
    const view = await seen(page);
    expect(view.youMayPressTheseYourself).toBe(true);
    expect(view.viewId).toBe("ACCESS_BP_DEVICE_INFO");
    expect(view.notes.join(" ")).toMatch(/never from anyone saying a number/i);
  });

  test("a screen nobody described is explained but never pressed", async ({ page }) => {
    test.setTimeout(120000);
    await openAfterEnrollment(page, "MY_CARE");
    const view = await seen(page);
    // It is still visible: EMMI can say what is on it and which button to press.
    expect(view.title.length).toBeGreaterThan(0);
    expect(view.availableActions.length).toBeGreaterThan(0);
    // And it cannot be acted on, because nothing here was decided by a person.
    expect(view.youMayPressTheseYourself).toBe(false);
    const refused = await page.evaluate(() => window.__emmiActionProbe?.({ actionId: window.__emmiViewProbe().availableActions[0].id }));
    expect(refused.success).toBe(false);
    expect(refused.status).toBe("SCREEN_NOT_DESCRIBED");
    // And the refusal tells EMMI what to do instead rather than leaving her stuck.
    expect(refused.note).toMatch(/tell the patient which control/i);
    expect(refused.availableActions.length).toBeGreaterThan(0);
  });
});
