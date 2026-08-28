import { expect, test } from "@playwright/test";
import { openEmmiConversation } from "./emmiSurfaces.js";

// Refills are a medication access safety net, not a button. These tests follow the arc — detect,
// confirm, check for changes, request safely, track, and find out whether the patient actually got
// the medication — and the rules that keep each step honest.

const daysAgo = days => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const pharmacy = { id: "pharm-cvs", name: "CVS Pharmacy", address: "123 Main Street", phone: "+13055550188", statusIntegration: false };
const prescriber = { id: "dr-fresner", name: "Dr. Fresner" };

const medication = (overrides = {}) => ({
  id: "med-lisinopril", name: "Lisinopril", strength: "10 mg", details: "10 mg · Once daily", sig: "Take once daily", active: true,
  medicationRequestId: "rx-lisinopril", prescriber, pharmacy, refillsRemaining: 0, prescriptionExpiresOn: "2027-02-01",
  lastDispense: { date: daysAgo(25), daysSupply: 30, quantity: 30, source: "PHARMACY_DISPENSE" }, refillWorkflow: {}, ...overrides
});

const seed = (page, { medications = [medication()], refills = [], signals = [] } = {}) => page.evaluate(([meds, refillSeed, signalSeed]) => {
  localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({
    scenarioId: "access-happy", screen: "MY_MEDICATIONS", role: "patient", completionRole: "patient",
    identityVerified: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED", accessOutcome: "eligible",
    language: "en", audit: [], careTeamTasks: [], careMedications: meds, medicationReviews: {}, additionalMedications: [],
    medicationSupplySignals: signalSeed, medicationRefills: refillSeed,
    careGoals: [], patientGoals: [], bpReadings: [], bpReadingReceipts: [], goalHistory: []
  }));
}, [medications, refills, signals]);

const openMedications = async (page, options = {}) => {
  await page.goto("/?scenario=access-happy");
  await seed(page, options);
  await page.reload();
  await expect(page.getByRole("heading", { name: "My medications" })).toBeVisible();
};

const draft = page => page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")));

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
});

test("a medication running low says so without inventing a pill count", async ({ page }) => {
  await openMedications(page);
  const card = page.locator(".medication-card-low");
  await expect(card).toContainText("Lisinopril 10 mg");
  await expect(card).toContainText("Based on your last refill, you may have about a week left.");
  await expect(card).toContainText("EMMI can help you check whether you need a refill.");
  await expect(card.getByRole("button", { name: /Review refill/ })).toBeVisible();

  const screen = await page.locator("#screen-content").innerText();
  expect(screen).not.toMatch(/\d+ pills|exactly|you will run out on|you failed|noncompliant/i);

  // The signal is a question with provenance, not a refill.
  const signal = (await draft(page)).medicationSupplySignals[0];
  expect(signal).toMatchObject({ signalType: "LOW_SUPPLY", status: "PATIENT_CONFIRMATION_NEEDED", supplyConfidence: "HIGH", triggerRuleId: "med-supply-trigger-v1" });
  expect((await draft(page)).medicationRefills).toEqual([]);
});

test("a weak estimate asks instead of telling", async ({ page }) => {
  await openMedications(page, { medications: [medication({ recentCareTransition: true })] });
  await expect(page.locator(".medication-card-low")).toContainText("I’d like to check whether you need a refill.");
  expect((await draft(page)).medicationSupplySignals[0].supplyConfidence).toBe("LOW");
});

test("a well-stocked medication is left alone, and an as-needed one is never estimated", async ({ page }) => {
  await openMedications(page, {
    medications: [
      medication({ id: "med-atorvastatin", name: "Atorvastatin", strength: "20 mg", refillsRemaining: 3, lastDispense: { date: daysAgo(2), daysSupply: 90, quantity: 90, source: "PHARMACY_DISPENSE" } }),
      medication({ id: "med-acetaminophen", name: "Acetaminophen", strength: "500 mg", sig: "Take as needed", prn: true })
    ]
  });
  await expect(page.locator(".medication-card-low")).toHaveCount(0);
  await expect(page.locator(".medication-card-quiet")).toHaveCount(2);
  // No permanent refill CTA on medications that do not need one.
  await expect(page.locator(".medication-list").getByRole("button", { name: /Review refill/ })).toHaveCount(0);
  expect((await draft(page)).medicationSupplySignals).toEqual([]);
});

test("the review confirms the patient still takes it before anything is requested", async ({ page }) => {
  await openMedications(page);
  await page.getByRole("button", { name: /Review refill/ }).click();

  // What ITERA already knows is shown for confirmation rather than asked again.
  await expect(page.getByText("Dr. Fresner")).toBeVisible();
  await expect(page.getByText("CVS Pharmacy")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Do you still take this medication as directed?" })).toBeVisible();
  await page.getByRole("button", { name: "Yes", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Do you have about a week or less remaining?" })).toBeVisible();
  await page.getByRole("button", { name: "Yes, I’m running low" }).click();

  await expect(page.getByRole("heading", { name: "Ready to request" })).toBeVisible();
  await expect(page.getByText("Dr. Fresner")).toBeVisible();
  // Still nothing sent: the request happens on the patient's tap, not on the estimate.
  expect((await draft(page)).medicationRefills[0].status).toBe("REFILL_DRAFT");

  await page.getByRole("button", { name: "Request refill" }).click();
  await expect(page.getByRole("heading", { name: "Waiting for your doctor" })).toBeVisible();
  await expect(page.getByText("Request sent to Dr. Fresner.")).toBeVisible();
  // Requested is not approved.
  await expect(page.locator("#screen-content")).not.toContainText(/approved|ready for pickup/i);

  const stored = await draft(page);
  expect(stored.medicationRefills[0]).toMatchObject({ status: "PENDING_PRESCRIBER", refillPath: "PRESCRIBER_REFILL_REQUEST", requiresPrescriber: true });
  expect(stored.medicationRefills[0].approvedAt).toBeNull();
  expect(stored.careTeamTasks.at(-1)).toMatchObject({ type: "MEDICATION_REFILL_REQUEST" });
  expect(stored.careTeamTasks.at(-1).summary).toMatchObject({ medication: "Lisinopril 10 mg", patientConfirmedTaking: "YES", patientConfirmedLowSupply: "RUNNING_LOW", prescriber: "Dr. Fresner" });
  expect(stored.medicationSupplySignals[0].status).toBe("CONFIRMED_LOW_SUPPLY");
});

test("a prescription with refills left goes to the pharmacy without waiting for the prescriber", async ({ page }) => {
  await openMedications(page, { medications: [medication({ refillsRemaining: 2 })] });
  await page.getByRole("button", { name: /Review refill/ }).click();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.getByRole("button", { name: "Yes, I’m running low" }).click();
  await expect(page.getByText("CVS Pharmacy")).toBeVisible();
  await page.getByRole("button", { name: "Request refill" }).click();

  await expect(page.getByRole("heading", { name: "Sent to your pharmacy" })).toBeVisible();
  // The pharmacy cannot report back, so the product says who can.
  await expect(page.getByText("Contact the pharmacy to confirm when it is ready.")).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText("Ready for pickup");
  expect((await draft(page)).medicationRefills[0]).toMatchObject({ status: "SENT_TO_PHARMACY", refillPath: "DIRECT_PHARMACY_FULFILLMENT", requiresPrescriber: false });
});

test("the patient having enough closes the question instead of sending anything", async ({ page }) => {
  await openMedications(page);
  await page.getByRole("button", { name: /Review refill/ }).click();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.getByRole("button", { name: "I have enough" }).click();

  await expect(page.getByText("Good to know. I’ll check again later.")).toBeVisible();
  const stored = await draft(page);
  expect(stored.medicationSupplySignals[0].status).toBe("NOT_NEEDED");
  expect(stored.medicationRefills[0].status).toBe("CANCELED");
  expect(stored.careTeamTasks).toEqual([]);
  // And it does not immediately ask again.
  await expect(page.locator(".medication-card-low")).toHaveCount(0);
});

test("a dose the patient reports differently stops the refill and goes to reconciliation", async ({ page }) => {
  await openMedications(page);
  await page.getByRole("button", { name: /Review refill/ }).click();
  await page.getByRole("button", { name: "Something changed" }).click();
  await page.getByRole("button", { name: "I take a different dose" }).click();
  await page.getByRole("textbox").fill("10 mg twice a day");
  await page.getByRole("button", { name: "Send to my care team" }).click();

  await expect(page.getByRole("heading", { name: "Your care team needs to review this" })).toBeVisible();
  const stored = await draft(page);
  expect(stored.medicationRefills[0]).toMatchObject({ blocker: "MEDICATION_DISCREPANCY", status: "NEEDS_CLINICAL_REVIEW", refillPath: "CLINICAL_REVIEW_REQUIRED" });
  // The clinical order is untouched; the patient's report is preserved beside it.
  expect(stored.careMedications[0].details).toBe("10 mg · Once daily");
  expect(stored.medicationReviews["med-lisinopril"]).toMatchObject({ reviewStatus: "DOSE_CHANGED", patientReportedDose: "10 mg twice a day", source: "PATIENT" });
  expect(stored.medicationReviews["med-lisinopril"].sourceMedicationSnapshot).toMatchObject({ name: "Lisinopril" });
});

test("a medicine that makes the patient feel unwell never gets refilled quietly", async ({ page }) => {
  await openMedications(page);
  await page.getByRole("button", { name: /Review refill/ }).click();
  await page.getByRole("button", { name: "Something changed" }).click();
  await page.getByRole("button", { name: "It makes me feel unwell" }).click();

  await expect(page.getByRole("heading", { name: "Your care team needs to review this" })).toBeVisible();
  const stored = await draft(page);
  expect(stored.medicationRefills[0]).toMatchObject({ blocker: "MEDICATION_CONCERN", requiresClinicalReview: true, status: "NEEDS_CLINICAL_REVIEW" });
  expect(stored.careTeamTasks.at(-1)).toMatchObject({ type: "MEDICATION_REFILL_REVIEW", priority: "CLINICAL_REVIEW" });
  expect(stored.careTeamTasks.at(-1).summary).toMatchObject({ issue: "MEDICATION_CONCERN" });
  // No dose advice, ever.
  const screen = await page.locator("#screen-content").innerText();
  expect(screen).not.toMatch(/stop taking|skip a dose|take less|take more|lower your dose/i);
});

test("a patient who stopped taking it is believed without the record being rewritten", async ({ page }) => {
  await openMedications(page);
  await page.getByRole("button", { name: /Review refill/ }).click();
  await page.getByRole("button", { name: "I no longer take it" }).click();

  const stored = await draft(page);
  expect(stored.medicationRefills[0]).toMatchObject({ blocker: "PATIENT_STOPPED", refillPath: "CARE_TEAM_REVIEW" });
  expect(stored.medicationReviews["med-lisinopril"].reviewStatus).toBe("NOT_TAKING");
  // A patient report is not a discontinuation.
  expect(stored.careMedications[0].active).toBe(true);
});

test("a medication whose workflow requires a visit hands the need to appointment coordination", async ({ page }) => {
  await openMedications(page, { medications: [medication({ refillWorkflow: { requiresAppointmentBeforeRenewal: true, requirementReason: "ANNUAL_REVIEW_DUE" } })] });
  await page.getByRole("button", { name: /Review refill/ }).click();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.getByRole("button", { name: "Yes, I’m running low" }).click();

  await expect(page.getByRole("heading", { name: "One more step is needed" })).toBeVisible();
  await expect(page.getByText(/requires a follow-up visit before this medication can be renewed/)).toBeVisible();
  await page.getByRole("button", { name: /Coordinate appointment/ }).click();

  const stored = await draft(page);
  // The need becomes a real appointment record with the medication context already on it, and the
  // refill episode points at it, so neither side has to ask the patient again.
  const need = stored.appointments.at(-1);
  expect(need.reasonCategory).toBe("MEDICATION_RENEWAL");
  expect(need.source).toBe("SYSTEM_WORKFLOW");
  expect(need.relatedRefillId).toBe(stored.medicationRefills[0].id);
  expect(stored.medicationRefills[0].relatedAppointmentNeedId).toBe(need.id);
  expect(need.schedulingCapability).toBeTruthy();
});

test("asking twice does not create two requests", async ({ page }) => {
  await openMedications(page);
  await page.getByRole("button", { name: /Review refill/ }).click();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.getByRole("button", { name: "Yes, I’m running low" }).click();
  const request = page.getByRole("button", { name: "Request refill" });
  await request.click();
  await expect(page.getByRole("heading", { name: "Waiting for your doctor" })).toBeVisible();

  // Coming back to the medication reports the existing request instead of starting another.
  await page.locator('[data-action="close-refill-flow"]').click();
  await page.getByRole("button", { name: /View status/ }).click();
  await expect(page.getByRole("heading", { name: "Waiting for your doctor" })).toBeVisible();

  const stored = await draft(page);
  expect(stored.medicationRefills).toHaveLength(1);
  expect(stored.careTeamTasks.filter(task => task.type === "MEDICATION_REFILL_REQUEST")).toHaveLength(1);
  expect(stored.medicationRefills[0].idempotencyKey).toContain("refill:");
});

test("approved is not obtained: the loop closes only when the patient has the medication", async ({ page }) => {
  const sent = {
    id: "refill-1", patientId: "p1", medicationId: "med-lisinopril", medicationSnapshot: { name: "Lisinopril", strength: "10 mg" },
    status: "SENT_TO_PHARMACY", statusSource: "ITERA", refillPath: "DIRECT_PHARMACY_FULFILLMENT", requiresPrescriber: false, requiresClinicalReview: false, requiresAppointment: false,
    events: [], createdAt: daysAgo(2), requestedAt: daysAgo(2), sentToPharmacyAt: daysAgo(1), approvedAt: null, readyAt: null, completedAt: null, idempotencyKey: "refill:p1:med-lisinopril:manual:x"
  };
  await openMedications(page, { medications: [medication({ refillsRemaining: 2 })], refills: [sent] });
  await page.getByRole("button", { name: /View status/ }).click();
  await page.getByRole("button", { name: /Were you able to get it/ }).click();
  await page.getByRole("button", { name: "Yes", exact: true }).click();

  await expect(page.getByText("Good. I’ll keep an eye on your next refill.")).toBeVisible();
  expect((await draft(page)).medicationRefills[0]).toMatchObject({ status: "COMPLETED", resolutionOutcome: "PATIENT_OBTAINED" });
});

test("a refill the patient could not collect becomes a barrier, not another request", async ({ page }) => {
  const sent = {
    id: "refill-1", patientId: "p1", medicationId: "med-lisinopril", medicationSnapshot: { name: "Lisinopril", strength: "10 mg" },
    status: "SENT_TO_PHARMACY", statusSource: "ITERA", refillPath: "DIRECT_PHARMACY_FULFILLMENT", requiresPrescriber: false, requiresClinicalReview: false, requiresAppointment: false,
    events: [], createdAt: daysAgo(2), requestedAt: daysAgo(2), sentToPharmacyAt: daysAgo(1), approvedAt: null, readyAt: null, completedAt: null, idempotencyKey: "refill:p1:med-lisinopril:manual:x"
  };
  await openMedications(page, { medications: [medication({ refillsRemaining: 2 })], refills: [sent] });
  await page.getByRole("button", { name: /View status/ }).click();
  await page.getByRole("button", { name: /Were you able to get it/ }).click();
  await page.getByRole("button", { name: "Not yet" }).click();

  await expect(page.getByRole("heading", { name: "What’s making it difficult?" })).toBeVisible();
  await page.getByRole("button", { name: "I can’t get to the pharmacy" }).click();

  const stored = await draft(page);
  // No second refill was created; the difficulty went to the care team who can act on it.
  expect(stored.medicationRefills).toHaveLength(1);
  expect(stored.careTeamTasks.at(-1)).toMatchObject({ type: "MEDICATION_ACCESS_SUPPORT", reason: "TRANSPORTATION" });
});

test("EMMI opens the refill from the conversation and reports an existing one instead of duplicating", async ({ page }) => {
  await openMedications(page);
  const panel = await openEmmiConversation(page);
  await panel.getByPlaceholder("Ask a question…").fill("I’m almost out of my Lisinopril");
  await panel.getByRole("button", { name: "Send question" }).click();
  await expect(panel.getByText(/I opened your Lisinopril 10 mg refill/)).toBeVisible();
  await panel.locator(".assistant-close").click();

  // The conversation and the screen are the same episode.
  await expect(page.getByRole("heading", { name: "Do you still take this medication as directed?" })).toBeVisible();
  expect((await draft(page)).medicationRefills).toHaveLength(1);

  const again = await openEmmiConversation(page);
  await again.getByPlaceholder("Ask a question…").fill("Can I get a refill of Lisinopril?");
  await again.getByRole("button", { name: "Send question" }).click();
  await expect(again.getByText(/You already have a refill request for Lisinopril/)).toBeVisible();
  expect((await draft(page)).medicationRefills).toHaveLength(1);
});

test("EMMI answers where a refill stands from the record, not from a guess", async ({ page }) => {
  const pending = {
    id: "refill-1", patientId: "p1", medicationId: "med-lisinopril", medicationSnapshot: { name: "Lisinopril", strength: "10 mg" },
    status: "PENDING_PRESCRIBER", statusSource: "ITERA", refillPath: "PRESCRIBER_REFILL_REQUEST", requiresPrescriber: true, requiresClinicalReview: false, requiresAppointment: false,
    events: [], createdAt: daysAgo(1), requestedAt: daysAgo(1), approvedAt: null, readyAt: null, completedAt: null, idempotencyKey: "refill:p1:med-lisinopril:manual:x"
  };
  await openMedications(page, { refills: [pending] });
  const panel = await openEmmiConversation(page);
  await panel.getByPlaceholder("Ask a question…").fill("What is happening with my refill?");
  await panel.getByRole("button", { name: "Send question" }).click();
  await expect(panel.getByText(/Lisinopril: Waiting for your doctor/)).toBeVisible();
  await expect(panel.locator(".assistant-conversation")).not.toContainText(/approved|ready/i);
});

test("medication surfaces stay readable at every mobile width, at 150% text, and in all three languages", async ({ page }) => {
  for (const [width, height] of [[360, 800], [384, 824], [430, 932]]) {
    await page.setViewportSize({ width, height });
    await openMedications(page);
    await page.getByRole("button", { name: /Review refill/ }).click();
    const audit = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      clipped: [...document.querySelectorAll(".medication-answers button, .medication-identity strong, .medication-facts dd")].some(node => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1),
      minButton: Math.min(...[...document.querySelectorAll(".medication-answers button")].map(node => node.getBoundingClientRect().height)),
      minFont: Math.min(...[...document.querySelectorAll(".medication-answers button")].map(node => parseFloat(getComputedStyle(node).fontSize))),
      nameFont: parseFloat(getComputedStyle(document.querySelector(".medication-identity strong")).fontSize)
    }));
    expect(audit.overflow, `${width}px overflow`).toBe(false);
    expect(audit.clipped, `${width}px clipping`).toBe(false);
    expect(audit.minButton, `${width}px touch target`).toBeGreaterThanOrEqual(48);
    expect(audit.minFont, `${width}px button font`).toBeGreaterThanOrEqual(17);
    expect(audit.nameFont, `${width}px medication name`).toBeGreaterThanOrEqual(20);
  }

  await page.setViewportSize({ width: 384, height: 824 });
  await openMedications(page);
  for (const scale of [1.25, 1.5]) {
    await page.evaluate(value => { document.documentElement.style.fontSize = `${16 * value}px`; }, scale);
    const audit = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      clipped: [...document.querySelectorAll(".medication-card strong, .medication-status")].some(node => node.scrollWidth > node.clientWidth + 1)
    }));
    expect(audit.overflow, `${scale}x overflow`).toBe(false);
    expect(audit.clipped, `${scale}x clipping`).toBe(false);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });

  await openMedications(page);
  await page.locator('[data-action="language"]').first().click();
  await expect(page.getByRole("heading", { name: "Mis medicamentos" })).toBeVisible();
  await page.getByRole("button", { name: /Revisar surtida/ }).click();
  await expect(page.getByRole("heading", { name: "¿Sigue tomando este medicamento según las indicaciones?" })).toBeVisible();
  await page.getByRole("button", { name: "Sí", exact: true }).click();
  await page.getByRole("button", { name: "Sí, se me está acabando" }).click();
  await page.getByRole("button", { name: "Solicitar surtida" }).click();
  await expect(page.getByRole("heading", { name: "Esperando a su médico" })).toBeVisible();

  await page.locator('[data-action="language"]').first().click();
  await expect(page.getByRole("heading", { name: "N ap tann doktè ou" })).toBeVisible();
  await expect(page.locator("#screen-content")).not.toContainText(/[가-힯]/);
});
