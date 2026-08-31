import { expect, test } from "@playwright/test";
import { openEmmiConversation } from "./emmiSurfaces.js";

const clearGrowthState = async page => page.evaluate(() => {
  ["itera.care-circle.prototype.v1", "itera.access-share.prototype.v1", "itera.growth.preferences.v1", "itera.enrollment.safe-draft.v2", "itera.enrollment.language.v1", "itera.emmi.preferences.v1"].forEach(key => localStorage.removeItem(key));
});

test.beforeEach(async ({ page }) => {
  await page.goto("/?scenario=access-happy");
  await clearGrowthState(page);
  await page.reload();
});

// An invitation is not sent in the name of someone we have not confirmed, so pressing send before
// identity takes the patient through it and sends on the other side. Their answers are kept.
const confirmIdentity = async page => {
  await expect(page.getByRole("heading", { name: /confirm it’s you/i })).toBeVisible();
  await page.getByLabel("Date of birth", { exact: true }).fill("05 / 12 / 1954");
  await page.getByLabel("ZIP code", { exact: true }).fill("33176");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
};

test("patient invites a daughter while remaining the decision maker", async ({ page, context }) => {
  await page.getByRole("button", { name: /Start your care journey/i }).click();
  await page.getByRole("button", { name: /Want support along the way/i }).click();
  await expect(page.getByRole("heading", { name: "Invite someone you trust" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Add from contacts/i })).toBeVisible();
  await expect(page.getByLabel("Choose contact card")).toHaveAttribute("accept", /\.vcf/);
  await expect(page.getByText(/does not allow this person to consent, sign/i)).toBeVisible();
  await page.getByLabel("Their name").fill("Angela Demo");
  await page.getByLabel("Mobile number").fill("3055550199");
  await page.getByLabel(/Relationship to you/).selectOption("child");
  await page.getByRole("button", { name: /Send invitation/i }).click();

  // Nothing has gone out yet: the invitation is held until we know who is sending it.
  await expect(page.getByText(/confirm it’s you first, then send the invitation to Angela Demo/i)).toBeVisible();
  expect(await page.evaluate(() => (JSON.parse(localStorage.getItem("itera.care-circle.prototype.v1") || "{}").invites || []).length)).toBe(0);
  await confirmIdentity(page);

  await expect(page.getByRole("heading", { name: "Invitation sent" })).toBeVisible();
  await expect(page.getByText(/No diagnosis, Medicare number, or clinical information/i)).toBeVisible();
  const supportLink = await page.getByRole("link", { name: /Preview support invitation/i }).getAttribute("href");
  expect(supportLink).toContain("/care-circle/invite/");
  expect(supportLink).not.toContain("patient_demo");

  const supportPage = await context.newPage();
  await supportPage.goto(supportLink);
  // The heading names who invited them. An invitation from nobody in particular is what this page
  // used to be, and the first thing an invitee needs to know is whose Care Circle this is. Only the
  // first name: the page is reachable by anyone holding the link.
  await expect(supportPage.getByRole("heading", { name: /You’ve been invited to join .+’s Care Circle/ })).toBeVisible();
  await expect(supportPage.getByText(/does not make you a Personal Representative/i)).toBeVisible();
  await supportPage.getByRole("button", { name: /Accept invitation/i }).click();

  // Accepting is not the same as being in. Membership waits on a code sent to the number the
  // patient named, so someone who was forwarded the link cannot join by pressing accept.
  await expect(supportPage.getByRole("heading", { name: /Confirm your phone number/i })).toBeVisible();
  await expect(supportPage.getByRole("heading", { name: "You’re ready to help" })).toHaveCount(0);
  await supportPage.locator("#care-circle-otp").fill("123456");
  await supportPage.locator('[data-public-action="verify-support"]').click();
  await expect(supportPage.getByRole("heading", { name: "You’re ready to help" })).toBeVisible();

  const invite = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.care-circle.prototype.v1")).invites.at(-1));
  expect(invite.status).toBe("ACCEPTED");
  // In, with no authority and nothing granted that the patient did not choose.
  expect(invite.membership.status).toBe("ACTIVE");
  expect(invite.membership.authority).toBe("NONE");
  expect(invite.supportRole).toBe("CARE_CIRCLE_MEMBER");
  expect(invite.completionRole).toBe("PATIENT");
});

test("Contact Picker denial keeps the manual fallback fully usable", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "contacts", { configurable: true, value: { select: async () => { throw new DOMException("Denied", "NotAllowedError"); } } }));
  await page.reload();
  await page.getByRole("button", { name: /Start your care journey/i }).click();
  await page.getByRole("button", { name: /Want support along the way/i }).click();
  await page.getByRole("button", { name: /Add from contacts/i }).click();
  await expect(page.getByText(/Contacts are not available/i)).toBeVisible();
  await page.getByLabel("Their name").fill("Manual Contact");
  await page.getByLabel("Mobile number").fill("3055550199");
  await page.getByLabel(/Relationship to you/).selectOption("family");
  await expect(page.getByRole("button", { name: /Send invitation/i })).toBeEnabled();
});

test("a browser without Contact Picker can import an exported address-book contact", async ({ page }) => {
  await page.getByRole("button", { name: /Start your care journey/i }).click();
  await page.getByRole("button", { name: /Want support along the way/i }).click();
  await expect(page.getByRole("button", { name: /Add from contacts/i })).toBeVisible();
  await page.getByLabel("Choose contact card").setInputFiles({
    name: "maria-rivera.vcf",
    mimeType: "text/vcard",
    buffer: Buffer.from("BEGIN:VCARD\r\nVERSION:3.0\r\nFN:María Rivera\r\nTEL;TYPE=CELL:+1-305-555-0199\r\nEND:VCARD")
  });

  await expect(page.getByLabel("Their name")).toHaveValue("María Rivera");
  await expect(page.getByLabel("Mobile number")).toHaveValue("(305) 555-0199");
  await expect(page.getByRole("heading", { name: "Invitation sent" })).toHaveCount(0);
  await page.getByLabel(/Relationship to you/).selectOption("family");
  await expect(page.getByRole("button", { name: /Send invitation/i })).toBeEnabled();
});

test("EMMI explains Care Circle boundaries without taking an action", async ({ page }) => {
  await page.getByRole("button", { name: /Start your care journey/i }).click();
  await page.getByRole("button", { name: /Want support along the way/i }).click();
  await openEmmiConversation(page);
  await page.getByRole("button", { name: /Can they make decisions for me/i }).click();
  await expect(page.getByText(/They cannot consent, sign, or make healthcare decisions for you/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invitation sent" })).toHaveCount(0);
});

test("Contact Picker is progressive, editable, and never sends automatically", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "contacts", { configurable: true, value: { select: async () => [{ name: ["Maria Sample"], tel: [{ value: "3055550199", type: ["mobile"] }, { value: "7865550102", type: ["home"] }] }] } }));
  await page.reload();
  await page.getByRole("button", { name: /Start your care journey/i }).click();
  await page.getByRole("button", { name: /Want support along the way/i }).click();
  await page.getByRole("button", { name: /Add from contacts/i }).click();
  await expect(page.getByLabel("Their name")).toHaveValue("Maria Sample");
  await expect(page.getByText(/Which mobile number/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invitation sent" })).toHaveCount(0);
  await page.getByRole("radio", { name: /mobile/i }).check();
  await page.getByLabel("Their name").fill("Maria Edited");
  await page.getByLabel(/Relationship to you/).selectOption("friend");
  await page.getByRole("button", { name: /Send invitation/i }).click();
  await confirmIdentity(page);
  await expect(page.getByRole("heading", { name: "Invitation sent" })).toBeVisible();
});

test("Personal Representative remains distinct from Care Circle", async ({ page }) => {
  await page.goto("/?scenario=access-representative");
  await clearGrowthState(page);
  await page.reload();
  await page.getByRole("button", { name: /Start your care journey/i }).click();
  await expect(page.locator("#choice-form strong", { hasText: "Personal representative" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Invite someone to help" })).toHaveCount(0);
});

const seedDraft = (page, screen) => page.evaluate(value => localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({ scenarioId: "access-happy", screen: value, role: "patient", completionRole: "patient", identityVerified: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED", accessOutcome: "eligible", language: "en", audit: [], careTeamTasks: [], careMedications: [], careGoals: [], bpReadings: [], bpReadingReceipts: [] })), screen);

test("Share ACCESS waits for a value moment instead of interrupting enrollment completion", async ({ page }) => {
  await seedDraft(page, "ENROLLMENT_CONFIRMED");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome to your ACCESS care" })).toBeVisible();
  // Just finishing enrollment is not a value moment: the patient has not experienced the service.
  await expect(page.getByRole("button", { name: "Share ACCESS" })).toHaveCount(0);
  await expect(page.locator(".enrollment-welcome-screen")).not.toContainText("Share ACCESS");
});

test("Share ACCESS opens a public, unpersonalized landing after Getting Started completes", async ({ page, context }) => {
  await seedDraft(page, "ONBOARDING_COMPLETE");
  await page.reload();
  // ACCESS ends on its care plan now, not on the generic completion screen. The share moment is
  // the same moment either way: the patient has finished getting started.
  await expect(page.getByRole("heading", { name: "Your ACCESS care is ready" })).toBeVisible();
  await expect(page.locator('[data-share-access-moment="GETTING_STARTED_COMPLETED"]')).toBeVisible();
  await expect(page.getByText("Know someone who may benefit from learning about ACCESS?")).toBeVisible();
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
  await expect(recipient.getByRole("heading", { name: "A smarter way to manage your health" })).toBeVisible();
  await expect(recipient.getByText("Enrollment confirmed", { exact: true })).toHaveCount(0);
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem("itera.access-share.prototype.v1")).shares.at(-1))).eligibilityStarted).toBe(true);
});

test("Care Circle moves from Home to Who is completing and remains optional", async ({ page }) => {
  await expect(page.locator("[data-optional-support]")).toHaveCount(0);
  await expect(page.locator(".contact-line")).toContainText("Need help? Call");
  await page.getByRole("button", { name: /Start your care journey/i }).click();
  const card = page.locator("[data-optional-support]");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Optional support");
  await expect(card).toContainText("Invite someone you trust to support you during your care journey.");
  await expect(card).toContainText("Invite someone");
  await expect(page.getByRole("button", { name: "Not now" })).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: /Start your care journey/i }).click();
  await expect(page.locator("[data-optional-support]")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Care Circle remains natural and complete in Spanish and Kreyòl", async ({ page }) => {
  await page.locator('[data-action="language"]').first().click();
  await page.getByRole("button", { name: /Comience su recorrido de cuidado/i }).click();
  await page.getByRole("button", { name: /¿Quiere apoyo durante el proceso\?/i }).click();
  await expect(page.getByRole("heading", { name: "Invite a alguien de confianza" })).toBeVisible();
  await expect(page.getByText(/no permite que esta persona dé consentimiento/i)).toBeVisible();
  await page.locator('[data-action="language"]').first().click();
  await expect(page.getByRole("heading", { name: "Envite yon moun ou fè konfyans" })).toBeVisible();
  await expect(page.getByText(/pa pèmèt moun sa a bay konsantman/i)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("My Care Circle shows and manages longitudinal invitation status", async ({ page }) => {
  await page.evaluate(() => {
    const now = new Date().toISOString();
    localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify({ scenarioId: "access-happy", screen: "MY_CARE", role: "patient", completionRole: "patient", identityVerified: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED", accessOutcome: "eligible", language: "en", audit: [], careTeamTasks: [], careMedications: [], careGoals: [], bpReadings: [], bpReadingReceipts: [] }));
    localStorage.setItem("itera.care-circle.prototype.v1", JSON.stringify({ invites: [{ inviteId: "CARE-DEMO", token: "SUPPORT-DEMO", inviterPatientId: "patient_demo", patientFirstName: "John", supportPerson: { name: "Maria Demo", relationship: "friend", phone: "3055550199" }, permissionScope: "CARE_CIRCLE_BASIC_SUPPORT", context: "ONGOING_CARE", status: "PENDING", sentAt: now, lastSentAt: now, sendCount: 1, expiresAt: new Date(Date.now() + 86400000).toISOString(), temporarySupportLink: `${location.origin}/care-circle/invite/SUPPORT-DEMO` }] }));
  });
  await page.reload();
  await page.getByRole("button", { name: /My Care Circle/i }).click();
  await expect(page.getByRole("heading", { name: "My Care Circle" })).toBeVisible();
  await expect(page.getByText("Maria Demo")).toBeVisible();
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  await page.getByText("Manage", { exact: true }).click();
  await page.getByRole("button", { name: "Cancel invitation" }).click();
  await expect(page.getByText("Canceled", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("My Care Team shows the PCP, cardiologist and Care Manager without ITERA or pharmacy cards", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 824 });
  await seedDraft(page, "MY_CARE");
  await page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2"));
    draft.careMedications = [{ id: "med-demo", name: "Demo", active: true, pharmacy: { id: "pharm-cvs", name: "CVS Pharmacy" } }];
    localStorage.setItem("itera.enrollment.safe-draft.v2", JSON.stringify(draft));
  });
  await page.reload();

  const link = page.getByRole("button", { name: /My Care Team/i });
  await expect(link).toBeVisible();
  await link.click();

  await expect(page.getByRole("heading", { name: "My Care Team" })).toBeVisible();
  await expect(page.locator(".care-team-member-card")).toHaveCount(3);
  await expect(page.getByText("Dr. Fresner Lee", { exact: true })).toBeVisible();
  await expect(page.getByText("Dr. Pedro Martinez-Clark", { exact: true })).toBeVisible();
  await expect(page.getByText("Cardiologist", { exact: false })).toBeVisible();
  // The care manager is a person now, not the organization. ITERA HEALTH still appears, but as the
  // practice behind her rather than as a card standing in for a human being.
  await expect(page.getByText("Alicia Ramírez, RN", { exact: true })).toBeVisible();
  await expect(page.getByText(/Care Manager · ITERA HEALTH/)).toBeVisible();
  const pedroPhoto = page.locator(".care-team-member-card", { hasText: "Dr. Pedro Martinez-Clark" }).locator("img");
  const careManagerPhoto = page.locator(".care-team-member-card", { hasText: "Alicia Ramírez, RN" }).locator("img");
  await expect(pedroPhoto).toHaveAttribute("src", "/images/Care%20Team/Martinez-Clark-Pedro.jpg");
  await expect(careManagerPhoto).toHaveAttribute("src", "/images/Care%20Team/care-manager-alicia-v2.png");
  expect(await pedroPhoto.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(await careManagerPhoto.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.getByText("CVS Pharmacy", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/information from your care record/i)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.locator('.my-care-team-screen .actions [data-action="back"]').click();
  await expect(page.getByRole("heading", { name: "My Care", exact: true })).toBeVisible();
});

test("patient can add a care professional and the member survives refresh", async ({ page }) => {
  await seedDraft(page, "MY_CARE");
  await page.reload();
  await page.getByRole("button", { name: /My Care Team/i }).click();
  await page.getByRole("button", { name: /Add a care team member/i }).click();

  await page.getByLabel("Professional’s name").fill("Dr. Elena Ruiz");
  await page.getByLabel("Role").selectOption("SPECIALIST");
  await page.getByLabel("Specialty").fill("Endocrinology");
  await page.getByLabel("Practice or clinic").fill("South Florida Endocrinology");
  const save = page.getByRole("button", { name: "Add to my care team" });
  await expect(save).toBeEnabled();
  await save.click();

  await expect(page.getByText("Care team member added.")).toBeVisible();
  await expect(page.getByText("Dr. Elena Ruiz", { exact: true })).toBeVisible();
  await expect(page.locator(".care-team-member-card")).toHaveCount(4);
  await page.reload();
  await expect(page.getByRole("heading", { name: "My Care Team" })).toBeVisible();
  await expect(page.getByText("Dr. Elena Ruiz", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")).patientAddedCareTeamMembers[0].source)).toBe("PATIENT_REPORTED");
});

test("My Care Team keeps patient-facing copy localized in Spanish and Kreyòl", async ({ page }) => {
  await seedDraft(page, "MY_CARE");
  await page.reload();
  await page.locator('[data-action="language"]').first().click();
  await page.getByRole("button", { name: /Mi equipo de cuidado/i }).click();
  await expect(page.getByRole("heading", { name: "Mi equipo de cuidado" })).toBeVisible();
  await expect(page.getByText("Médico de atención primaria", { exact: false })).toBeVisible();
  await expect(page.getByText("Cardiólogo", { exact: false })).toBeVisible();
  await expect(page.getByText(/Coordinador de cuidado/)).toBeVisible();
  await page.locator('[data-action="language"]').first().click();
  await expect(page.getByRole("heading", { name: "Ekip swen mwen" })).toBeVisible();
  await expect(page.getByText("Doktè prensipal", { exact: false })).toBeVisible();
  await expect(page.getByText("Kadyològ", { exact: false })).toBeVisible();
  await expect(page.getByText(/Jesyonè swen/)).toBeVisible();
});

for (const width of [320, 375, 384, 430]) test(`My Care Team remains readable and contained at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 824 });
  await seedDraft(page, "MY_CARE");
  await page.reload();
  await page.getByRole("button", { name: /My Care Team/i }).click();

  const result = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".care-team-member-card")].map((card) => card.getBoundingClientRect());
    const addButton = document.querySelector(".care-team-add-button")?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      cardsInsideViewport: cards.every((card) => card.left >= 0 && card.right <= window.innerWidth),
      addButtonHeight: addButton?.height || 0
    };
  });

  expect(result.overflow).toBe(false);
  expect(result.cardsInsideViewport).toBe(true);
  expect(result.addButtonHeight).toBeGreaterThanOrEqual(44);
});

for (const width of [320, 375, 430]) test(`Care Circle remains responsive at ${width}px without EMMI overlap`, async ({ page }) => {
  await page.setViewportSize({ width, height: 780 });
  await page.reload();
  await page.getByRole("button", { name: /Start your care journey/i }).click();
  await page.getByRole("button", { name: /Want support along the way/i }).click();
  const result = await page.evaluate(() => {
    const emmi = document.querySelector(".emmi-assistant")?.getBoundingClientRect();
    const actions = document.querySelector(".care-circle-sticky-actions")?.getBoundingClientRect();
    const overlaps = emmi && actions ? !(emmi.right <= actions.left || emmi.left >= actions.right || emmi.bottom <= actions.top || emmi.top >= actions.bottom) : false;
    const emmiElement = document.querySelector(".emmi-assistant");
    return { overflow: document.documentElement.scrollWidth > window.innerWidth, overlaps, formWidth: document.querySelector("#care-circle-invite-form")?.getBoundingClientRect().width || 0, emmi: emmi ? { top: emmi.top, bottom: emmi.bottom, cssBottom: getComputedStyle(emmiElement).bottom, inlineTop: emmiElement.style.top } : null, actions: actions ? { top: actions.top, bottom: actions.bottom } : null };
  });
  expect(result.overflow).toBe(false);
  expect(result.overlaps, JSON.stringify(result)).toBe(false);
  expect(result.formWidth).toBeGreaterThan(width - 72);
});

// A Care Circle invitation belongs to the enrollment that sent it.
//
// The draft is deliberately not written until identity is verified, so an invitation sent before
// that point leaves no enrollment behind it — while the invite record, which lives in its own
// store, survives. Every demo enrollment is the same fictional patient, so the boot filter matched
// all of them: the next person to open the app was shown "Invitation sent — Angela Demo can help
// you" for an invitation they had never sent, on the first screen of the journey.
test("a new patient does not inherit the previous enrollment's Care Circle", async ({ page }) => {
  await page.getByRole("button", { name: /Start your care journey/i }).click();
  await page.getByRole("button", { name: /Want support along the way/i }).click();
  await page.getByLabel("Their name").fill("Angela Demo");
  await page.getByLabel("Mobile number").fill("3055550199");
  await page.getByLabel(/Relationship to you/).selectOption("child");
  await page.getByRole("button", { name: /Send invitation/i }).click();
  await confirmIdentity(page);
  await expect(page.getByRole("heading", { name: "Invitation sent" })).toBeVisible();

  // The enrollment is gone; the Care Circle store, which lives on its own, is not. Whoever opens
  // the app next is a new patient and must not be told an invitation was sent on their behalf.
  await page.evaluate(() => localStorage.removeItem("itera.enrollment.safe-draft.v2"));
  await page.goto("/?scenario=access-happy");
  await page.getByRole("button", { name: /Start your care journey/i }).click();

  await expect(page.locator(".optional-support-status")).toHaveCount(0);
  await expect(page.locator(".optional-support")).toContainText("Want support along the way?");
  await expect(page.locator(".optional-support")).not.toContainText("Angela Demo");
});

test("an enrollment in progress keeps the invitation it sent", async ({ page }) => {
  await page.getByRole("button", { name: /Start your care journey/i }).click();
  await page.getByRole("button", { name: /Want support along the way/i }).click();
  await page.getByLabel("Their name").fill("Angela Demo");
  await page.getByLabel("Mobile number").fill("3055550199");
  await page.getByLabel(/Relationship to you/).selectOption("child");
  await page.getByRole("button", { name: /Send invitation/i }).click();
  await confirmIdentity(page);
  await expect(page.getByRole("heading", { name: "Invitation sent" })).toBeVisible();

  await page.reload();
  await page.locator("#screen-select").selectOption("DECISION_MAKER", { force: true });

  await expect(page.locator(".optional-support-status")).toHaveCount(1);
  await expect(page.locator(".optional-support")).toContainText("Angela Demo");
});
