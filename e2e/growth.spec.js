import { expect, test } from "@playwright/test";

const clearGrowthState = async page => page.evaluate(() => {
  ["itera.care-circle.prototype.v1", "itera.access-share.prototype.v1", "itera.growth.preferences.v1", "itera.enrollment.safe-draft.v2", "itera.enrollment.language.v1", "itera.emmi.preferences.v1"].forEach(key => localStorage.removeItem(key));
});

test.beforeEach(async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await clearGrowthState(page);
  await page.reload();
});

test("patient invites a daughter while remaining the decision maker", async ({ page, context }) => {
  await page.getByRole("button", { name: /See how it works/i }).click();
  await page.getByRole("button", { name: /Want someone to help you/i }).click();
  await expect(page.getByRole("heading", { name: "Invite someone you trust" })).toBeVisible();
  await expect(page.getByText(/does not allow the person to consent, sign/i)).toBeVisible();
  await page.getByLabel("Their name").fill("Angela Demo");
  await page.getByLabel("Mobile number").fill("3055550199");
  await page.getByLabel(/Relationship to you/).selectOption("child");
  await page.getByRole("button", { name: /Send invitation/i }).click();

  await expect(page.getByRole("heading", { name: "Invitation sent" })).toBeVisible();
  await expect(page.getByText(/No diagnosis, Medicare number, or clinical information/i)).toBeVisible();
  const supportLink = await page.getByRole("link", { name: /Preview support invitation/i }).getAttribute("href");
  expect(supportLink).toContain("/support/accept?token=");
  expect(supportLink).not.toContain("patient_demo");

  const supportPage = await context.newPage();
  await supportPage.goto(supportLink);
  await expect(supportPage.getByRole("heading", { name: "You’ve been invited to help" })).toBeVisible();
  await expect(supportPage.getByText(/does not make you a Personal Representative/i)).toBeVisible();
  await supportPage.getByRole("button", { name: /Continue helping/i }).click();
  await expect(supportPage.getByRole("heading", { name: "You’re ready to help" })).toBeVisible();

  const invite = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.care-circle.prototype.v1")).invites.at(-1));
  expect(invite.status).toBe("ACCEPTED");
  expect(invite.supportRole).toBe("CARE_CIRCLE_MEMBER");
  expect(invite.completionRole).toBe("PATIENT");
});

test("Personal Representative remains distinct from Care Circle", async ({ page }) => {
  await page.goto("/?scenario=access-representative");
  await clearGrowthState(page);
  await page.reload();
  await page.getByRole("button", { name: /See how it works/i }).click();
  await expect(page.locator("#choice-form strong", { hasText: "Personal representative" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Invite someone to help" })).toHaveCount(0);
});

test("post-enrollment Share ACCESS opens a public, unpersonalized landing", async ({ page, context }) => {
  await page.evaluate(() => localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({ scenarioId: "access-happy", screen: "ENROLLMENT_CONFIRMED", role: "patient", completionRole: "patient", identityVerified: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED", accessOutcome: "eligible", language: "en", audit: [], careTeamTasks: [], careMedications: [], careGoals: [], bpReadings: [], bpReadingReceipts: [] })));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome to your ACCESS experience" })).toBeVisible();
  await page.getByRole("button", { name: "Share ACCESS" }).click();
  await expect(page.getByRole("heading", { name: "Share information about ACCESS" })).toBeVisible();
  await page.getByRole("button", { name: "Copy link" }).click();
  const share = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.access-share.prototype.v1")).shares.at(-1));
  expect(share.publicAccessLandingUrl).toContain("/access/learn?source=patient-share&shareId=");
  expect(JSON.stringify(share)).not.toContain("patient_demo");

  const recipient = await context.newPage();
  await recipient.goto(share.publicAccessLandingUrl);
  await expect(recipient.getByRole("heading", { name: "Learn about Medicare’s ACCESS Model" })).toBeVisible();
  await expect(recipient.getByText(/Learning more does not mean you are eligible or enrolled/i)).toBeVisible();
  await expect(recipient.getByText("John", { exact: false })).toHaveCount(0);
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem("itera.access-share.prototype.v1")).shares.at(-1))).clicked).toBe(true);
  await recipient.getByRole("button", { name: /See if ACCESS may be available/i }).click();
  await expect(recipient).toHaveURL(/prototype=1.*source=patient-share/);
  await expect(recipient.getByRole("heading", { name: "A new care option for your health" })).toBeVisible();
  await expect(recipient.getByText("Enrollment confirmed", { exact: true })).toHaveCount(0);
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem("itera.access-share.prototype.v1")).shares.at(-1))).eligibilityStarted).toBe(true);
});

test("Care Circle moves from Home to Who is completing and remains optional", async ({ page }) => {
  await expect(page.locator("[data-optional-support]")).toHaveCount(0);
  await expect(page.locator(".contact-line")).toContainText("Need help? Call");
  await page.getByRole("button", { name: /See how it works/i }).click();
  const card = page.locator("[data-optional-support]");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Optional support");
  await expect(card).toContainText("Invite someone you trust to help you through this process.");
  await expect(card).toContainText("Invite someone");
  await expect(page.getByRole("button", { name: "Not now" })).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: /See how it works/i }).click();
  await expect(page.locator("[data-optional-support]")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Care Circle remains natural and complete in Spanish and Kreyòl", async ({ page }) => {
  await page.locator('[data-action="language"]').first().click();
  await page.getByRole("button", { name: /Vea cómo funciona/i }).click();
  await page.getByRole("button", { name: /¿Quiere que alguien le ayude?/i }).click();
  await expect(page.getByRole("heading", { name: "Invite a alguien de confianza" })).toBeVisible();
  await expect(page.getByText(/no permite que la persona dé consentimiento/i)).toBeVisible();
  await page.locator('[data-action="language"]').first().click();
  await expect(page.getByRole("heading", { name: "Envite yon moun ou fè konfyans" })).toBeVisible();
  await expect(page.getByText(/pa pèmèt moun nan bay konsantman/i)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
