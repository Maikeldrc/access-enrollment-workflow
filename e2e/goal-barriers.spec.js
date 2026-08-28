import { expect, test } from "@playwright/test";
import { openEmmiConversation } from "./emmiSurfaces.js";

// Barriers exist so the platform can move from "the patient did not do it" to "what made this
// hard, and how do we help". These tests follow that arc: identify, understand, help, follow up,
// resolve — and the rules that keep it safe on the way.

const goalAction = (id, templateId, title) => ({
  id, goalId: "goal-bp", templateId, title, actionType: "RECURRING", source: "CARE_PLAN",
  frequency: "few-days", targetCount: 5, schedule: null, remindersEnabled: false, status: "ACTIVE",
  completionHistory: [], createdAt: "2026-08-01T10:00:00.000Z", updatedAt: "2026-08-01T10:00:00.000Z"
});

const staleReading = daysAgo => {
  const timestamp = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return { readingId: `r-${daysAgo}`, observationId: `obs-${daysAgo}`, systolic: 128, diastolic: 82, timestamp, receivedAt: timestamp, source: "CONNECTED_DEVICE", sourceVerified: true, deviceId: "tenovi-bp-8842" };
};

const seedGoal = (page, { barriers = [], stale = false } = {}) => page.evaluate(([barrierSeed, staleReadings]) => {
  localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({
    scenarioId: "access-happy", screen: "MY_GOALS", role: "patient", completionRole: "patient",
    identityVerified: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED", accessOutcome: "eligible",
    language: "en", audit: [], careTeamTasks: [], careMedications: [{ id: "med-lisinopril", name: "Lisinopril", details: "10 mg · Once daily", active: true }],
    careGoals: [], bpReadings: staleReadings, bpReadingReceipts: [], assignedDeviceId: "tenovi-bp-8842",
    activeGoalId: "goal-bp", goalDetailView: "SUMMARY",
    patientGoals: [{
      id: "goal-bp", patientId: "DEMO-P001", goalType: "BLOOD_PRESSURE_CONTROL", title: "Keep my blood pressure under control",
      status: "ACTIVE", priority: "PRIMARY", planStatus: "COMPLETED", planPersonalizationStatus: "COMPLETED",
      goalSource: "PATHWAY", selectedBy: "PATIENT", whyItMatters: "",
      actions: [
        { id: "action-bp", goalId: "goal-bp", templateId: "check-bp", title: "Check my blood pressure regularly", actionType: "RECURRING", source: "CARE_PLAN", frequency: "few-days", targetCount: 5, schedule: null, remindersEnabled: false, status: "ACTIVE", completionHistory: [], createdAt: "2026-08-01T10:00:00.000Z", updatedAt: "2026-08-01T10:00:00.000Z" },
        { id: "action-med", goalId: "goal-bp", templateId: "medications-as-directed", title: "Take my medications as directed", actionType: "RECURRING", source: "CARE_PLAN", frequency: "daily", targetCount: 7, schedule: null, remindersEnabled: false, status: "ACTIVE", completionHistory: [], createdAt: "2026-08-01T10:00:00.000Z", updatedAt: "2026-08-01T10:00:00.000Z" }
      ],
      progress: [], educationHistory: [], barriers: barrierSeed, supportRequests: [], reviews: [],
      createdBy: "PATHWAY", createdAt: "2026-08-01T10:00:00.000Z", updatedAt: "2026-08-01T10:00:00.000Z"
    }],
    goalPrimaryId: "goal-bp", goalHistory: []
  }));
}, [barriers, stale ? [staleReading(12), staleReading(10)] : []]);

const openGoalDetail = async (page, options = {}) => {
  await page.goto("/?scenario=access-happy");
  await seedGoal(page, options);
  await page.reload();
  // The seeded draft restores straight into the goal, which is where a patient returning to an
  // active difficulty lands too.
  await expect(page.getByRole("heading", { name: "Keep my blood pressure under control" })).toBeVisible();
};

const tellEmmiWhatsDifficult = async page => {
  await page.getByRole("button", { name: /Tell EMMI what’s difficult/ }).click();
  await expect(page.getByRole("heading", { name: "What’s making this difficult?" })).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
});

test("a goal asks whether anything is hard, in words that do not blame the patient", async ({ page }) => {
  await openGoalDetail(page);
  const prompt = page.locator(".goal-support-prompt");
  await expect(prompt.getByRole("heading", { name: "Need help?" })).toBeVisible();
  await expect(prompt.getByText("Is anything making this goal difficult?")).toBeVisible();
  await expect(prompt.getByText(/EMMI can help with many common problems/)).toBeVisible();
  // The patient-facing surface never uses the internal vocabulary, and never adherence language.
  const screen = await page.locator("#screen-content").innerText();
  expect(screen).not.toMatch(/barrier|non-?compliant|failed|poor adherence|didn’t follow/i);
});

test("the options come from this goal's own plan, and one question is asked at a time", async ({ page }) => {
  await openGoalDetail(page);
  await tellEmmiWhatsDifficult(page);
  const options = page.locator(".goal-barrier-choices button");
  await expect(options.filter({ hasText: "I forget to do it" })).toBeVisible();
  await expect(options.filter({ hasText: "I have trouble with my monitor" })).toBeVisible();
  await expect(options.filter({ hasText: "I have questions about my medications" })).toBeVisible();
  await expect(options.filter({ hasText: "Something else" })).toBeVisible();
  // A questionnaire is not a conversation: the whole thing is one question with big targets.
  expect(await options.count()).toBeLessThanOrEqual(8);
  await expect(page.locator("#screen-content input")).toHaveCount(0);
  for (const option of await options.all()) expect((await option.boundingBox()).height).toBeGreaterThanOrEqual(48);
});

test("forgetting offers a reminder, and the reminder does not pretend to be a solution", async ({ page }) => {
  await openGoalDetail(page);
  await tellEmmiWhatsDifficult(page);
  await page.getByRole("button", { name: "I forget to do it" }).click();

  await expect(page.getByText("A reminder could help")).toBeVisible();
  // Explicit patient choice, and an honest description of what a reminder is in this product.
  await expect(page.getByText(/Reminders appear in ITERA when you open it/)).toBeVisible();
  await page.getByRole("button", { name: "Morning" }).click();

  await expect(page.getByText("Your reminder is saved with this goal. EMMI will check back to see if it helps.")).toBeVisible();
  const card = page.locator(".goal-barrier-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Remembering this step");
  await expect(page.locator(".goal-support-active")).toContainText("We’re working on this");
  await expect(card).toContainText("Reminder: Morning");
  // Not resolved: an intervention that has not been evaluated is still open work.
  await expect(card).not.toContainText("Resolved");

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")).patientGoals[0]);
  expect(stored.barriers[0]).toMatchObject({ category: "FORGETFULNESS_ROUTINE", status: "IN_PROGRESS", source: "PATIENT" });
  expect(stored.barriers[0].interventions[0]).toMatchObject({ type: "REMINDER", outcome: null });
  expect(stored.barriers[0].followUpAt).toBeTruthy();
  expect(stored.reminderPreference).toMatchObject({ slot: "MORNING", channel: "IN_APP" });
});

test("the follow-up asks whether it helped, and a no leads somewhere new", async ({ page }) => {
  await openGoalDetail(page);
  await tellEmmiWhatsDifficult(page);
  await page.getByRole("button", { name: "I forget to do it" }).click();
  await page.getByRole("button", { name: "Morning" }).click();

  await page.locator(".goal-barrier-card").getByRole("button", { name: /Review/ }).click();
  await expect(page.getByRole("heading", { name: "Are the reminders helping you?" })).toBeVisible();
  await page.getByRole("button", { name: "I’m still having trouble" }).click();

  // The same help is not offered twice. Something else is.
  await expect(page.getByText("A reminder could help")).toHaveCount(0);
  await expect(page.getByText("Let’s find a time that fits")).toBeVisible();

  const barrier = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")).patientGoals[0].barriers[0]);
  expect(barrier.interventions[0]).toMatchObject({ type: "REMINDER", outcome: "NOT_HELPED" });
  expect(barrier.status).toBe("OPEN");
});

test("a difficulty the patient says helped is resolved, without claiming victory for them", async ({ page }) => {
  await openGoalDetail(page);
  await tellEmmiWhatsDifficult(page);
  await page.getByRole("button", { name: "I forget to do it" }).click();
  await page.getByRole("button", { name: "Afternoon" }).click();
  await page.locator(".goal-barrier-card").getByRole("button", { name: /Review/ }).click();
  await page.getByRole("button", { name: "Yes, a lot" }).click();

  await expect(page.getByText("Glad that helped.")).toBeVisible();
  await expect(page.locator(".goal-barrier-card")).toHaveCount(0);
  await expect(page.getByText(/Recently resolved: Remembering this step/)).toBeVisible();
  const barrier = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")).patientGoals[0].barriers[0]);
  expect(barrier).toMatchObject({ status: "RESOLVED", resolutionOutcome: "RESOLVED" });
});

test("declining help is a choice on the record, not a failure", async ({ page }) => {
  await openGoalDetail(page);
  await tellEmmiWhatsDifficult(page);
  await page.getByRole("button", { name: "I forget to do it" }).click();
  await page.getByRole("button", { name: "Not now" }).click();

  await expect(page.getByText("That’s okay. You can come back to this whenever you want.")).toBeVisible();
  const barrier = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")).patientGoals[0].barriers[0]);
  expect(barrier.interventions[0]).toMatchObject({ type: "REMINDER", outcome: "PATIENT_DECLINED" });
  expect(barrier.status).toBe("OPEN");
});

test("a monitor problem is walked through first and escalates to real help when it does not work", async ({ page }) => {
  await openGoalDetail(page);
  await tellEmmiWhatsDifficult(page);
  await page.getByRole("button", { name: "I have trouble with my monitor" }).click();
  await expect(page.getByText("I can walk you through your monitor")).toBeVisible();
  await page.getByRole("button", { name: "Show me the steps" }).click();

  // EMMI's guidance happens in the conversation, not in a second device flow.
  await expect(page.locator(".assistant-layer")).toBeVisible();
  await page.locator(".assistant-close").click();

  await page.locator(".goal-barrier-card").getByRole("button", { name: /Review/ }).click();
  await expect(page.getByRole("heading", { name: "Were you able to take a reading?" })).toBeVisible();
  await page.getByRole("button", { name: "No, it still won’t work" }).click();
  await expect(page.getByText("Let’s get you real help with the monitor")).toBeVisible();
  await page.getByRole("button", { name: "Ask for device support" }).click();

  await expect(page.locator(".goal-barrier-card")).toContainText("Waiting for your care team");
  const task = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")).careTeamTasks.at(-1));
  expect(task).toMatchObject({ type: "DEVICE_SUPPORT", goalId: "goal-bp" });
  // The care team gets a structured summary of the difficulty and what was already tried.
  expect(task.summary).toMatchObject({ goal: "Keep my blood pressure under control", barrierCategory: "DEVICE_TECHNOLOGY" });
  expect(task.summary.emmiAttempts[0]).toMatchObject({ type: "DEVICE_GUIDANCE", outcome: "NOT_HELPED" });
});

test("a medicine that makes the patient feel unwell never gets coaching from EMMI", async ({ page }) => {
  await openGoalDetail(page);
  await tellEmmiWhatsDifficult(page);
  await page.getByRole("button", { name: "Something else" }).click();
  await page.getByRole("textbox").fill("This medicine makes me feel dizzy");
  await page.getByRole("button", { name: "Continue" }).click();

  // No reminder, no education, no advice about the medicine: a person reviews it.
  await expect(page.getByText("Your care team should see this")).toBeVisible();
  await expect(page.getByText("A reminder could help")).toHaveCount(0);
  await page.getByRole("button", { name: "Tell my care team" }).click();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(stored.patientGoals[0].barriers[0]).toMatchObject({ category: "MEDICATION_CONCERN", owner: "CARE_TEAM" });
  expect(stored.careTeamTasks.at(-1).type).toBe("PATIENT_BARRIER_REVIEW");
  const screen = await page.locator("#screen-content").innerText();
  expect(screen).not.toMatch(/stop taking|skip a dose|lower your dose/i);
});

test("a symptom goes to the safety engine instead of the barrier coaching", async ({ page }) => {
  await openGoalDetail(page);
  await tellEmmiWhatsDifficult(page);
  await page.getByRole("button", { name: "I’m not feeling well" }).click();

  await expect(page.getByText("This needs attention now")).toBeVisible();
  await expect(page.getByText("A reminder could help")).toHaveCount(0);
  await expect(page.getByText(/If this is an emergency, call 911/)).toBeVisible();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(stored.patientGoals[0].barriers[0].interventions[0].type).toBe("SAFETY_ESCALATION");
  expect(stored.careTeamTasks.at(-1)).toMatchObject({ type: "CLINICAL_SAFETY_ESCALATION", priority: "URGENT_REVIEW" });
});

test("needing someone to help routes to Care Circle rather than assuming a representative", async ({ page }) => {
  await openGoalDetail(page);
  await tellEmmiWhatsDifficult(page);
  await page.getByRole("button", { name: "Something else" }).click();
  await page.getByRole("textbox").fill("I need my daughter to help me with this");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Someone you trust can help")).toBeVisible();
  await page.getByRole("button", { name: /Add someone to my Care Circle/ }).click();
  await expect(page.getByRole("heading", { name: "Invite someone you trust" })).toBeVisible();
  // Nobody is invited on the patient's behalf.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(stored.completionRole).toBe("patient");
});

test("needing an appointment is captured for the care team with the appointment fields a scheduling module needs", async ({ page }) => {
  await openGoalDetail(page);
  await tellEmmiWhatsDifficult(page);
  await page.getByRole("button", { name: "Something else" }).click();
  await page.getByRole("textbox").fill("I need to see my cardiologist");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Let’s get you an appointment")).toBeVisible();
  await expect(page.getByText(/Some offices let me help you pick a time/)).toHaveCount(1);
  await page.getByRole("button", { name: "Send my request" }).click();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  const barrier = stored.patientGoals[0].barriers[0];
  expect(barrier.category).toBe("APPOINTMENT_NEED");
  // The fields a scheduling module will need already exist on the record.
  expect(barrier.appointmentRequest).toMatchObject({ appointmentStatus: "NOT_SCHEDULED", urgencyClassification: "ROUTINE" });
  expect(stored.careTeamTasks.at(-1).type).toBe("APPOINTMENT_REQUEST");
});

test("a missing-readings signal asks the patient instead of deciding what happened", async ({ page }) => {
  await openGoalDetail(page, { stale: true });

  // The signal is a question on the card, never a conclusion in the record.
  const card = page.locator(".goal-barrier-card");
  await expect(card).toContainText("EMMI has a question about this");
  await page.evaluate(() => {
    const barrier = JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")).patientGoals[0].barriers[0];
    if (barrier.status !== "SUSPECTED" || barrier.source !== "SYSTEM_SIGNAL" || barrier.confirmedAt) throw new Error("signal should stay suspected and unconfirmed");
  });

  await card.getByRole("button", { name: /Review/ }).click();
  await expect(page.getByRole("heading", { name: "Is anything making it hard to take your readings?" })).toBeVisible();
  await expect(page.getByText(/We haven’t received some of your recent readings/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Nothing is making it difficult" })).toBeVisible();

  // Answering it makes it the patient's own account, in the category they chose.
  await page.getByRole("button", { name: "I have trouble with my monitor" }).click();
  await expect(page.getByText("I can walk you through your monitor")).toBeVisible();
  const barrier = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")).patientGoals[0].barriers[0]);
  expect(barrier).toMatchObject({ category: "DEVICE_TECHNOLOGY", status: "OPEN", source: "PATIENT" });
  expect(barrier.confirmedAt).toBeTruthy();
});

test("an active difficulty changes what My Goals says to do next", async ({ page }) => {
  await openGoalDetail(page);
  await tellEmmiWhatsDifficult(page);
  await page.getByRole("button", { name: "I have questions about my medications" }).click();
  await page.getByRole("button", { name: /Explain it to me/ }).click();
  await page.locator(".assistant-close").click();

  await page.getByRole("button", { name: /Back to My Goals/ }).click();
  const card = page.locator(".goal-card-primary");
  await expect(card).toContainText("Needs help");
  await expect(card).toContainText("Questions about my medications");
});

test("EMMI hears a difficulty in conversation and writes the same record the goal screen does", async ({ page }) => {
  await openGoalDetail(page);
  const panel = await openEmmiConversation(page);
  await panel.getByPlaceholder("Ask a question…").fill("I keep forgetting to take my blood pressure");
  await panel.getByRole("button", { name: "Send question" }).click();

  await expect(panel.getByText(/That happens to many people/)).toBeVisible();
  await expect(panel.getByRole("button", { name: /Get help with this/ })).toBeVisible();
  const barrier = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")).patientGoals[0].barriers.at(-1));
  expect(barrier).toMatchObject({ category: "FORGETFULNESS_ROUTINE", source: "EMMI", status: "OPEN" });

  // Saying it again is the same difficulty with more context, not a second one.
  await panel.getByPlaceholder("Ask a question…").fill("I forget again and again");
  await panel.getByRole("button", { name: "Send question" }).click();
  await expect(panel.getByText(/I still have this one open for you/)).toBeVisible();
  const count = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")).patientGoals[0].barriers.filter(item => item.category === "FORGETFULNESS_ROUTINE").length);
  expect(count).toBe(1);
});

test("barrier surfaces stay readable at every mobile width and at 150% text", async ({ page }) => {
  for (const [width, height] of [[360, 800], [384, 824], [430, 932]]) {
    await page.setViewportSize({ width, height });
    await openGoalDetail(page);
    await tellEmmiWhatsDifficult(page);
    await page.locator('[data-action="language"]').first().click();
    const audit = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll(".goal-barrier-choices button")];
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        clipped: buttons.some(button => button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1),
        minHeight: Math.min(...buttons.map(button => button.getBoundingClientRect().height)),
        minFont: Math.min(...buttons.map(button => parseFloat(getComputedStyle(button).fontSize)))
      };
    });
    expect(audit.overflow, `${width}px overflow`).toBe(false);
    expect(audit.clipped, `${width}px clipping`).toBe(false);
    expect(audit.minHeight, `${width}px touch target`).toBeGreaterThanOrEqual(48);
    expect(audit.minFont, `${width}px font`).toBeGreaterThanOrEqual(17);
  }

  await page.setViewportSize({ width: 384, height: 824 });
  await openGoalDetail(page);
  await tellEmmiWhatsDifficult(page);
  for (const scale of [1.25, 1.5]) {
    await page.evaluate(value => { document.documentElement.style.fontSize = `${16 * value}px`; }, scale);
    const audit = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      clipped: [...document.querySelectorAll(".goal-barrier-choices button")].some(button => button.scrollWidth > button.clientWidth + 1)
    }));
    expect(audit.overflow, `${scale}x overflow`).toBe(false);
    expect(audit.clipped, `${scale}x clipping`).toBe(false);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
});

test("the whole flow works in Spanish and Kreyòl without falling back to English", async ({ page }) => {
  await openGoalDetail(page);
  await page.locator('[data-action="language"]').first().click();
  await page.getByRole("button", { name: /Contarle a EMMI qué es difícil/ }).click();
  await expect(page.getByRole("heading", { name: "¿Qué se lo está haciendo difícil?" })).toBeVisible();
  await page.getByRole("button", { name: "Se me olvida hacerlo" }).click();
  await expect(page.getByText("Un recordatorio podría ayudar")).toBeVisible();
  await page.getByRole("button", { name: "Por la mañana" }).click();
  await expect(page.locator(".goal-support-active")).toContainText("Estamos trabajando en esto");

  await page.locator('[data-action="language"]').first().click();
  await expect(page.locator(".goal-support-active")).toContainText("N ap travay sou sa");
  await expect(page.locator("#screen-content")).not.toContainText(/[가-힯]/);
});
