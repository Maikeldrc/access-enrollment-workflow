import { expect, test } from "@playwright/test";

// A goal says what the patient wants to REACH. An action says what they will DO about it.
//
// Everything in this file exists to keep those two apart through the paths a patient actually
// takes: typing a routine into the box, editing the wording afterwards, asking for a blood
// pressure number, asking to stop a medication, and coming back after a refresh. The unit tests
// prove the classifier; these prove that nothing between the classifier and the record undoes it.

const DRAFT_KEY = "itera.enrollment.safe-draft.v2";

async function reachMyGoals(page, { width = 384 } = {}) {
  await page.setViewportSize({ width, height: 824 });
  await page.goto("/?scenario=access-happy");
  await page.locator("#screen-select").selectOption("ONBOARDING_COMPLETE", { force: true });
  await page.getByRole("button", { name: /Go to My Care/ }).click();
  await page.getByRole("button", { name: /My Goals/ }).click();
  await expect(page.getByRole("heading", { name: "My Goals", level: 1 })).toBeVisible();
}

async function openMyOwnGoal(page) {
  await page.locator('[data-action="add-another-goal"]').click();
  await expect(page.getByRole("heading", { name: "Add another goal", level: 1 })).toBeVisible();
  await page.locator('[data-action="create-my-own-goal"]').click();
  await expect(page.getByRole("heading", { name: "Create my own goal", level: 1 })).toBeVisible();
}

async function describe(page, statement) {
  await openMyOwnGoal(page);
  await page.locator('#personal-goal-form [name="goalStatement"]').fill(statement);
  await page.locator('[data-action="personal-goal-review"]').click();
}

const goalField = page => page.locator('#personal-goal-confirm-form [name="goalTitle"]');
const stepField = page => page.locator('#personal-goal-confirm-form [name="actionTitle"]');
const savedGoals = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)).patientGoals, DRAFT_KEY);

test("Add another goal still offers the care plan's goals, and now a goal of your own", async ({ page }) => {
  await reachMyGoals(page);
  await page.locator('[data-action="add-another-goal"]').click();

  // The regression this feature started from: for an ACCESS patient this button led to the
  // read-only activation screen, where the assigned clinical goals were listed with their
  // baselines and program measures and nothing could be added at all.
  await expect(page.getByRole("heading", { name: "Recommended for you" })).toBeVisible();
  await expect(page.locator(".goal-choice-list")).toContainText("Keep my blood pressure under control");
  await expect(page.locator(".goal-choice-list")).toContainText("Reach or maintain a healthy weight");
  await expect(page.locator('[data-action="create-my-own-goal"]')).toContainText("Create my own goal");

  // And it is My Care, not enrollment: a patient adding a goal months later is not getting started.
  await expect(page.locator(".shell")).toContainText(/YOUR CARE/i);
  await expect(page.locator(".shell")).not.toContainText(/GETTING STARTED/i);
});

test("a routine becomes a step, and the goal becomes the outcome it serves", async ({ page }) => {
  await reachMyGoals(page);
  await describe(page, "Quiero caminar 20 minutos cuatro veces por semana");

  // Never saved as the name of the goal. The routine is offered as a step, and the goal is the
  // result the patient is actually after.
  await expect(goalField(page)).toHaveValue("Be able to walk without getting so tired");
  await expect(stepField(page)).toHaveValue("Caminar 20 minutos cuatro veces por semana");
  await expect(page.locator('[name="actionFrequency"]:checked')).toHaveValue("few-days");
  // The exact match above is the accent check too: it fails on "Caminar mas", which is the
  // misspelling we would introduce by handing back the deaccented copy we classified on.

  await page.locator('[data-action="personal-goal-save"]').click();
  await expect(page.getByRole("heading", { name: "Be able to walk without getting so tired", level: 1 })).toBeVisible();
  await expect(page.locator(".goal-plan-section")).toContainText("Caminar 20 minutos cuatro veces por semana");
  await expect(page.locator(".goal-plan-section")).toContainText("These are the steps you will take toward this goal. They are not the goal itself.");

  const [goal] = await savedGoals(page);
  expect(goal.goalType).toBe("CUSTOM");
  expect(goal.goalSource).toBe("PATIENT");
  expect(goal.careTeamReviewStatus).toBe("PENDING");
  expect(goal.actions).toHaveLength(1);
  expect(goal.actions[0].title).toBe("Caminar 20 minutos cuatro veces por semana");
  expect(goal.actions[0].goalId).toBe(goal.id);
  // A personal goal carries no clinical parameter of any kind, however it was created.
  expect(goal).not.toHaveProperty("clinicalTarget");
  expect(goal).not.toHaveProperty("baseline");
  expect(goal.clinicalTargetId).toBeNull();
  expect(goal.patientCanEditClinicalTarget).toBe(false);
});

test("the goal and its steps survive a refresh, and each can be changed without the other", async ({ page }) => {
  await reachMyGoals(page);
  await describe(page, "Quiero caminar 20 minutos cuatro veces por semana");
  await page.locator('[data-action="personal-goal-save"]').click();
  await expect(page.getByRole("heading", { name: "Be able to walk without getting so tired", level: 1 })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Be able to walk without getting so tired", level: 1 })).toBeVisible();
  await expect(page.locator(".goal-plan-section")).toContainText("Caminar 20 minutos cuatro veces por semana");

  // Change only the step.
  await page.locator('[data-action="edit-goal-action"]').click();
  await page.locator('#goal-action-form [name="actionTitle"]').fill("Caminar 30 minutos cuatro veces por semana");
  await page.locator('[data-action="update-goal-action"]').click();
  await expect(page.getByRole("heading", { name: "Be able to walk without getting so tired", level: 1 })).toBeVisible();
  await expect(page.locator(".goal-plan-section")).toContainText("Caminar 30 minutos");

  // Change only the goal.
  await page.locator(".goal-manage summary").click();
  await page.locator('[data-action="edit-goal-title"]').click();
  await page.locator('#goal-title-form [name="goalTitle"]').fill("Poder caminar con mi esposa sin cansarme");
  await page.locator('[data-action="save-goal-title"]').click();
  await expect(page.getByRole("heading", { name: "Poder caminar con mi esposa sin cansarme", level: 1 })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Your goal was updated. Your steps did not change.");
  await expect(page.locator(".goal-plan-section")).toContainText("Caminar 30 minutos cuatro veces por semana");

  const [goal] = await savedGoals(page);
  expect(goal.customTitle).toBe("Poder caminar con mi esposa sin cansarme");
  expect(goal.actions.filter(action => action.status !== "REMOVED")).toHaveLength(1);
});

test("renaming a goal into a routine is caught before it is saved", async ({ page }) => {
  await reachMyGoals(page);
  await describe(page, "Quiero dormir mejor");
  await page.locator('[data-action="personal-goal-save"]').click();
  await page.locator(".goal-manage summary").click();
  await page.locator('[data-action="edit-goal-title"]').click();
  await page.locator('#goal-title-form [name="goalTitle"]').fill("Acostarme a las diez todos los días");
  await page.locator('[data-action="save-goal-title"]').click();

  // Not saved, and the patient is told what a goal is rather than being silently overruled.
  await expect(page.locator(".form-error")).toContainText(/describes something you would do/i);
  await expect(page.locator("#goal-title-form")).toBeVisible();

  // Their words are still theirs: saving again keeps them.
  await page.locator('[data-action="save-goal-title"]').click();
  await expect(page.getByRole("heading", { name: "Acostarme a las diez todos los días", level: 1 })).toBeVisible();
});

test("a clinical number never becomes a goal, and no target is created", async ({ page }) => {
  await reachMyGoals(page);
  await describe(page, "Quiero que mi presión sea 100/60");

  await expect(goalField(page)).toHaveValue("Get better at managing my blood pressure");
  await expect(goalField(page)).not.toHaveValue(/100|60/);
  await expect(stepField(page)).toHaveValue("Ask what blood pressure numbers are right for me");
  await expect(page.locator(".personal-goal-clinical-note")).toContainText("Your target numbers stay with your care team");

  await page.locator('[data-action="personal-goal-save"]').click();
  const [goal] = await savedGoals(page);
  expect(JSON.stringify(goal)).not.toMatch(/100\/60|"100"|systolic/i);
  expect(goal.clinicalTargetId).toBeNull();
});

test("stopping a medication becomes a safe goal and a question for the doctor", async ({ page }) => {
  await reachMyGoals(page);
  await describe(page, "Quiero dejar de tomar mi medicina");

  await expect(goalField(page)).toHaveValue("Feel comfortable and confident with my treatment");
  await expect(goalField(page)).not.toHaveValue(/stop|dejar/i);
  await expect(stepField(page)).toHaveValue("Ask whether I should keep taking this medication");
  await expect(page.locator(".personal-goal-clinical-note")).toContainText("I can’t change a medication or a dose");
});

test("a vague wish gets one short question rather than a task", async ({ page }) => {
  await reachMyGoals(page);
  await describe(page, "Quiero sentirme mejor");

  // Still on the same screen, with EMMI's question replacing the opening one.
  await expect(page.getByRole("heading", { name: "Create my own goal", level: 1 })).toBeVisible();
  await expect(page.locator(".personal-goal-prompt")).toContainText("What would you like to be able to do, or to feel, that is different?");
  await expect(page.locator('#personal-goal-form [name="goalStatement"]')).toHaveValue("Quiero sentirme mejor");

  await page.locator('#personal-goal-form [name="goalStatement"]').fill("Quiero poder subir las escaleras sin cansarme");
  await page.locator('[data-action="personal-goal-review"]').click();
  await expect(goalField(page)).toHaveValue("Poder subir las escaleras sin cansarme");
});

test("My Goals keeps the care plan's goals and the patient's own apart", async ({ page }) => {
  await reachMyGoals(page);

  // Two goals from the care plan's catalogue — one becomes the priority, the other has to have a
  // section of its own to sit in...
  for (const type of ["BLOOD_PRESSURE_CONTROL", "STAY_ACTIVE"]) {
    await page.locator('[data-action="add-another-goal"]').click();
    await page.locator(`[data-action="add-recommended-goal"][data-goal-type="${type}"]`).click();
    await page.getByRole("button", { name: "I’ll do this with my care team later" }).click();
    // Deferring the plan lands on that goal, which is where the patient asked to be.
    await page.locator('[data-action="goal-detail-to-list"]').click();
  }

  // ...and one the patient wrote.
  await page.locator('[data-action="add-another-goal"]').click();
  await page.locator('[data-action="create-my-own-goal"]').click();
  await page.locator('#personal-goal-form [name="goalStatement"]').fill("Quiero dormir mejor");
  await page.locator('[data-action="personal-goal-review"]').click();
  // An outcome the patient stated themselves needs no proposal, so the step box starts empty.
  await expect(stepField(page)).toHaveValue("");
  await page.locator('[data-action="personal-goal-save"]').click();
  await page.locator('[data-action="goal-detail-to-list"]').click();

  await expect(page.getByRole("heading", { name: "Goals from my care plan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My own goals" })).toBeVisible();
  const own = page.locator('.goal-group-own .goal-card');
  await expect(own).toHaveAttribute("data-goal-kind", "PERSONAL");
  // The heading above it already said whose goal it is, so the card does not repeat it. The chip
  // exists for the priority card, which sits under "My priority" where nothing else would say.
  await expect(own.locator(".goal-card-kind")).toHaveCount(0);
  await expect(page.locator(".goal-card-primary")).toHaveAttribute("data-goal-kind", "CARE_PLAN");
  await expect(page.locator(".goal-card-primary .goal-card-kind")).toHaveCount(0);

  // A care plan goal cannot be reworded or removed, and the screen offers no control that would.
  await page.locator('.goal-card[data-goal-kind="CARE_PLAN"] .goal-card-cta').first().click();
  await page.getByRole("button", { name: "I’ll do this with my care team later" }).click();
  await expect(page.locator(".goal-ownership-plan")).toContainText("Your care team sets what this goal measures and where it starts");
  await page.locator(".goal-manage summary").click();
  await expect(page.locator('[data-action="edit-goal-title"]')).toHaveCount(0);
  await expect(page.locator('[data-action="delete-goal"]')).toHaveCount(0);
});

test("a step can be added and removed without disturbing the goal, at 384px", async ({ page }) => {
  await reachMyGoals(page);
  await describe(page, "Quiero dormir mejor");
  await stepField(page).fill("Apagar la televisión antes de acostarme");
  await page.locator('[data-action="personal-goal-save"]').click();

  await page.locator('[data-action="open-add-goal-action"]').click();
  await page.locator('#goal-action-form [name="actionTitle"]').fill("Acostarme a la misma hora");
  await page.locator('[data-action="save-goal-action"]').click();
  await expect(page.locator(".goal-plan-section")).toContainText("Apagar la televisión antes de acostarme");
  await expect(page.locator(".goal-plan-section")).toContainText("Acostarme a la misma hora");
  // "Quiero dormir mejor" already names an outcome, so the patient keeps their own words rather
  // than being handed the template sentence. That is the rule, not a gap.
  await expect(page.getByRole("heading", { name: "Dormir mejor", level: 1 })).toBeVisible();

  // Nothing overflows the phone the patients actually hold, and every control is reachable.
  const audit = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".goal-action")];
    const links = [...document.querySelectorAll(".goal-action-manage button")];
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      minRowHeight: Math.min(...rows.map(row => row.getBoundingClientRect().height)),
      minLinkHeight: Math.min(...links.map(link => link.getBoundingClientRect().height)),
      widest: Math.max(...rows.map(row => row.scrollWidth - row.clientWidth))
    };
  });
  expect(audit.overflow).toBe(false);
  expect(audit.minRowHeight).toBeGreaterThanOrEqual(48);
  expect(audit.minLinkHeight).toBeGreaterThanOrEqual(44);
  expect(audit.widest).toBeLessThanOrEqual(1);

  await page.locator('[data-action="remove-goal-action"]').last().click();
  await expect(page.getByRole("status")).toContainText("That step was removed. Your goal did not change.");
  // "Quiero dormir mejor" already names an outcome, so the patient keeps their own words rather
  // than being handed the template sentence. That is the rule, not a gap.
  await expect(page.getByRole("heading", { name: "Dormir mejor", level: 1 })).toBeVisible();
  await expect(page.locator(".goal-plan-section")).not.toContainText("Acostarme a la misma hora");
  await expect(page.locator(".goal-plan-section")).toContainText("Apagar la televisión antes de acostarme");

  const [goal] = await savedGoals(page);
  // Removed, never deleted: what the patient did stays on the record.
  expect(goal.actions.some(action => action.status === "REMOVED")).toBe(true);

  // Back on the list, a personal goal reports its plan rather than metrics it does not have — and
  // it counts what is left, not what was ever added. It is also the priority here, which is the one
  // place a card has to say whose goal it is, because the heading above it does not.
  await page.locator('[data-action="goal-detail-to-list"]').click();
  const card = page.locator(".goal-card-primary");
  await expect(card).toHaveAttribute("data-goal-kind", "PERSONAL");
  await expect(card.locator(".goal-card-kind")).toContainText("My own goal");
  await expect(card.locator(".goal-summary-plan")).toContainText("1 active step");
});

test("a personal goal only helps with a plan goal when the patient says so", async ({ page }) => {
  await reachMyGoals(page);
  await page.locator('[data-action="add-another-goal"]').click();
  await page.locator('[data-action="add-recommended-goal"][data-goal-type="BLOOD_PRESSURE_CONTROL"]').click();
  await page.getByRole("button", { name: "I’ll do this with my care team later" }).click();
  await page.locator('[data-action="goal-detail-to-list"]').click();

  // Walking and blood pressure share a health topic, which is exactly where inferring a link would
  // be tempting. The question is asked, and "on its own" is what is selected until they change it.
  await describe(page, "Quiero caminar 20 minutos cuatro veces por semana");
  await expect(page.locator(".personal-goal-box-link")).toContainText("Does this help with a goal from your plan? (optional)");
  await expect(page.locator('[name="contributesTo"]:checked')).toHaveValue("");
  await page.locator('[data-action="personal-goal-save"]').click();
  await expect(page.locator(".goal-contribution-line")).toContainText("This goal stands on its own.");
  expect((await savedGoals(page)).find(goal => goal.goalSource === "PATIENT").contributesToGoalId).toBe("");

  // The patient says it, and only then does anything say it.
  await page.locator('[data-action="edit-goal-contribution"]').click();
  await page.locator('#goal-contribution-form .choice-card', { hasText: "Keep my blood pressure under control" }).locator("input").check();
  await page.locator('[data-action="save-goal-contribution"]').click();
  await expect(page.getByRole("status")).toContainText("Saved. Your care plan goal did not change.");
  await expect(page.locator(".goal-contribution-line")).toContainText("You said this helps with: Keep my blood pressure under control");

  const goals = await savedGoals(page);
  const own = goals.find(goal => goal.goalSource === "PATIENT");
  const plan = goals.find(goal => goal.goalType === "BLOOD_PRESSURE_CONTROL");
  expect(own.contributesToGoalId).toBe(plan.id);
  // The link lives on the patient's goal and leaves the plan goal untouched — no target, no
  // measure, nothing pointing back.
  expect(plan.contributesToGoalId).toBe("");
  expect(plan.clinicalTargetId).toBeNull();
  expect(JSON.stringify(plan)).not.toContain(own.id);

  await page.reload();
  await expect(page.locator(".goal-contribution-line")).toContainText("Keep my blood pressure under control");
});

test("a patient with no care plan goals is never asked about a link", async ({ page }) => {
  await reachMyGoals(page);
  await describe(page, "Quiero dormir mejor");
  // A question with one possible answer is not a question.
  await expect(page.locator(".personal-goal-box-link")).toHaveCount(0);
  await page.locator('[data-action="personal-goal-save"]').click();
  await expect(page.locator(".goal-contribution-line")).toHaveCount(0);
});

// EMMI Chat answers these from the same records and the same classifier the screens use, before
// any model call — so what it says here cannot drift from what the patient is looking at, and the
// answers are the same with or without a model key.
async function ask(page, question) {
  const before = await page.locator(".assistant-message.assistant").count();
  await page.evaluate(text => {
    const input = document.querySelector("#assistant-question");
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, question);
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.locator(".assistant-message.assistant")).toHaveCount(before + 1);
  const bubble = page.locator(".assistant-message.assistant").last();
  await expect(bubble).not.toContainText(/thinking|pensando|reflechi/i);
  return (await bubble.innerText()).replace(/\s+/g, " ").trim();
}

test("Chat tells the two kinds of goal apart, and a goal from its plan", async ({ page }) => {
  await reachMyGoals(page);
  await page.locator('[data-action="add-another-goal"]').click();
  await page.locator('[data-action="add-recommended-goal"][data-goal-type="BLOOD_PRESSURE_CONTROL"]').click();
  await page.getByRole("button", { name: "I’ll do this with my care team later" }).click();
  await page.locator('[data-action="goal-detail-to-list"]').click();
  await describe(page, "Quiero caminar 20 minutos cuatro veces por semana");
  await page.locator('[data-action="personal-goal-save"]').click();
  await page.locator('[data-action="goal-detail-to-list"]').click();

  await page.locator('[data-action="help"]').first().click();

  const goals = await ask(page, "What are my goals?");
  expect(goals).toContain("From your care plan: Keep my blood pressure under control");
  expect(goals).toContain("Goals you set yourself: Be able to walk without getting so tired");

  const plan = await ask(page, "What am I doing to reach my goal?");
  expect(plan).toContain("Caminar 20 minutos cuatro veces por semana");
  expect(plan).toMatch(/steps are what you do; the goal is what you are working toward/i);
});

test("Chat treats a routine as a step and saves nothing on its own", async ({ page }) => {
  await reachMyGoals(page);
  await page.locator('[data-action="help"]').first().click();

  const answer = await ask(page, "I want to swim 30 minutes three times a week.");
  expect(answer).toContain("Be more physically active");
  expect(answer).toMatch(/Nothing is saved until you do/i);

  // The proposal is on the real screen, and the record is still empty.
  expect(await savedGoals(page)).toEqual([]);
  await page.locator(".assistant-close").click();
  await expect(page.getByRole("heading", { name: "Does this sound right?", level: 1 })).toBeVisible();
  await expect(goalField(page)).toHaveValue("Be more physically active");
  await expect(stepField(page)).toHaveValue(/Swim 30 minutes three times a week/i);
});

test("Chat answers the clinical target first, then offers the goal that is the patient's", async ({ page }) => {
  await reachMyGoals(page);
  // The target itself comes from the blood pressure goal's runtime, so the patient has to have it.
  await page.locator('[data-action="add-another-goal"]').click();
  await page.locator('[data-action="add-recommended-goal"][data-goal-type="BLOOD_PRESSURE_CONTROL"]').click();
  await page.getByRole("button", { name: "I’ll do this with my care team later" }).click();
  await page.locator('[data-action="help"]').first().click();

  const change = await ask(page, "I want my blood pressure target to be 100 over 60.");
  // The clinical answer comes first and is not softened.
  expect(change).toMatch(/care team owns this clinical target/i);
  // And then the part they can actually have.
  expect(change).toContain("Get better at managing my blood pressure");
  expect(change).toContain("Ask what blood pressure numbers are right for me");

  // Asking what the target IS is a different question and gets no offer attached to it.
  const ask_ = await ask(page, "What is my blood pressure target?");
  expect(ask_).toMatch(/care team owns this clinical target/i);
  expect(ask_).not.toContain("Get better at managing my blood pressure");

  // Neither answer created a goal of its own, and the plan goal kept its target untouched.
  const goals = await savedGoals(page);
  expect(goals.filter(goal => goal.goalSource === "PATIENT")).toEqual([]);
  expect(goals[0].clinicalTargetId).toBeNull();
});

test("Chat sends a step change to the step, never to the goal", async ({ page }) => {
  await reachMyGoals(page);
  await describe(page, "Quiero caminar 20 minutos cuatro veces por semana");
  await page.locator('[data-action="personal-goal-save"]').click();
  await page.locator('[data-action="help"]').first().click();

  const answer = await ask(page, "Change my walk to 30 minutes.");
  expect(answer).toMatch(/changes a step in your plan, not your goal/i);
  expect(answer).toContain("Be able to walk without getting so tired");

  // It opened that step's editor, and nothing was written.
  await page.locator(".assistant-close").click();
  await expect(page.getByRole("heading", { name: "Change this step", level: 1 })).toBeVisible();
  const [goal] = await savedGoals(page);
  expect(goal.actions[0].title).toBe("Caminar 20 minutos cuatro veces por semana");
});

test("a personal goal can be removed, and says plainly that nothing clinical changes", async ({ page }) => {
  await reachMyGoals(page);
  await describe(page, "Quiero dormir mejor");
  await page.locator('[data-action="personal-goal-save"]').click();
  await expect(page.locator(".goal-ownership-personal")).toContainText("It does not change your care plan or anything your doctor decides");

  await page.locator(".goal-manage summary").click();
  await page.locator('[data-action="delete-goal"]').click();
  await expect(page.getByRole("heading", { name: "Remove this goal?", level: 1 })).toBeVisible();
  await expect(page.locator(".lead")).toContainText("Nothing in your care plan changes");
  await expect(page.locator(".goal-selected-card")).toContainText("Dormir mejor");
  await page.locator('[data-action="confirm-delete-goal"]').click();

  await expect(page.getByRole("heading", { name: "My Goals", level: 1 })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Your goal was removed.");
  const goals = await savedGoals(page);
  expect(goals.every(goal => goal.status === "REMOVED")).toBe(true);
});
