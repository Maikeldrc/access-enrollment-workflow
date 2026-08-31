import { test, expect } from "@playwright/test";

// The whole journey, walked the way a patient walks it: from the invitation to My Care, through the
// real interface, with nothing seeded into storage. Every other spec in this suite jumps to the
// screen it cares about, which is right for testing one screen and blind to the thing this test
// exists for — whether the steps still join up.
//
// It is deliberately one long test rather than several. The value is in the sequence: a step that
// only passes because a previous one was skipped is exactly the defect this catches.

test("a patient reaches active ACCESS care from the invitation without help", async ({ page }) => {
  const continueOn = async () => page.getByRole("button", { name: "Continue", exact: true }).click();

  // --- The invitation ---------------------------------------------------------------------
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /A smarter way to manage your health/ })).toBeVisible();
  await page.getByRole("button", { name: "Start your care journey" }).click();

  // --- Who is completing this -------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Who is completing this?" })).toBeVisible();
  await expect(page.locator('#choice-form input[value="patient"]')).toBeChecked();
  await continueOn();

  // --- Confirm identity -------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: /confirm it’s you/i })).toBeVisible();
  await page.getByLabel("Date of birth", { exact: true }).fill("05 / 12 / 1954");
  await page.getByLabel("ZIP code", { exact: true }).fill("33176");
  await continueOn();

  // --- What your care includes ------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "What your care includes" })).toBeVisible();
  await continueOn();

  // --- Eligibility ------------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: /confirm your eligibility with Medicare/i })).toBeVisible();
  await page.getByLabel("I understand this information and want to continue with the Medicare eligibility check").check();
  await page.getByRole("button", { name: "Check my eligibility" }).click();
  await expect(page.getByRole("heading", { name: /you can continue with ACCESS/i })).toBeVisible({ timeout: 20000 });

  // Cleared is not enrolled, and the screen has to say so before consent.
  await expect(page.getByText(/before completing your enrollment/i).first()).toBeVisible();
  await continueOn();

  // --- Consent ----------------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Review and choose" })).toBeVisible();
  const consentBox = page.locator("#consent-form input[type=checkbox]");
  // Nothing is pre-agreed on the patient's behalf.
  await expect(consentBox).not.toBeChecked();
  await consentBox.check();
  await page.getByRole("button", { name: "Confirm and continue" }).click();

  // --- Enrollment complete ----------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Welcome to your ACCESS care" })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("button", { name: /Set up my care/i })).toBeVisible();
  await page.getByRole("button", { name: /Set up my care/i }).click();

  // --- The connected monitor --------------------------------------------------------------
  // Care activation opens on the device, and the patient is never asked whether they own one.
  await expect(page.getByRole("heading", { name: "Track your blood pressure from home" })).toBeVisible();
  await expect(page.getByText(/Has a healthcare professional told you not to use/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /health check/i })).toHaveCount(0);

  await page.locator(".cuff-choice-list .choice-card").first().click();
  await page.getByRole("button", { name: /Request my monitor/i }).click();

  // --- Delivery address -------------------------------------------------------------------
  // The request is only made here, after the patient confirms where it goes.
  await expect(page.getByRole("heading", { name: /Where would you like your monitor delivered/i })).toBeVisible();
  await page.getByRole("button", { name: /Request my monitor/i }).click();

  // --- The request is confirmed -----------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Your monitor is being prepared" })).toBeVisible({ timeout: 20000 });
  // Nothing may claim a shipment nobody confirmed.
  await expect(page.getByText(/shipped|tracking|arrives/i)).toHaveCount(0);
  await page.getByRole("button", { name: /See my health goals/i }).click();

  // --- The assigned goals -----------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Your ACCESS health goals" })).toBeVisible();
  await expect(page.locator(".access-goal-card")).toHaveCount(2);
  // Assigned, not chosen: there is nothing here to tick.
  await expect(page.locator(".access-goal-list input")).toHaveCount(0);
  await expect(page.getByText("Control target")).toHaveCount(2);
  await page.getByRole("button", { name: /make this harder/i }).click();

  // --- Support needs ----------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Is anything making your care harder?" })).toBeVisible();
  await expect(page.locator(".support-need-group")).toHaveCount(2);
  await page.locator('.support-need-group').first().locator('input[value="FORGETFULNESS_ROUTINE"]').check();
  await page.locator('.support-need-group').nth(1).locator('input[value="NONE"]').check();
  await continueOn();

  // --- Personalisation --------------------------------------------------------------------
  // Health confirmation has been retired, so medications are the first current setup task.
  await expect(page.getByRole("heading", { name: "Confirm your medications" })).toBeVisible();
  while (await page.getByRole("button", { name: "Yes, I still take it" }).count()) {
    await page.getByRole("button", { name: "Yes, I still take it" }).first().click();
  }
  await page.getByRole("button", { name: "No, that’s all" }).click();
  await continueOn();
  await expect(page.getByRole("heading", { name: "Set up your care" })).toBeVisible();
  await page.getByRole("button", { name: "Save and continue" }).click();

  // --- Active care ------------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Your ACCESS care is ready" })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Support we added for you")).toBeVisible();
  await expect(page.getByText(/care plan is ready/i)).toHaveCount(0);
  await page.getByRole("button", { name: /Go to My Care/i }).click();

  // --- My Care ----------------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "My Care" })).toBeVisible();

  // The record the patient arrives with: enrolled, two assigned goals, a monitor on request, and
  // the difficulty they reported carrying a real intervention rather than sitting inert.
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));
  expect(draft.enrollmentStatus).toBe("COMPLETED");
  expect((draft.patientGoals || []).map(goal => goal.goalType).sort()).toEqual(["BLOOD_PRESSURE_CONTROL", "WEIGHT_MANAGEMENT"]);
  expect(draft.deviceFulfillmentStatus).toBe("REQUESTED");
  const interventions = (draft.patientGoals || []).flatMap(goal => (goal.barriers || []).flatMap(barrier => barrier.interventions || []));
  expect(interventions.length).toBeGreaterThan(0);
});
