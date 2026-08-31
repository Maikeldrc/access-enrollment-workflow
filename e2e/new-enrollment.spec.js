import { expect, test } from "@playwright/test";

// "/" resumes the enrollment this browser is holding. "/new" starts another one. These follow the
// four QA scenarios: that "/" still resumes, that "/new" starts clean, that a refresh keeps the
// enrollment the patient is actually in, and that nothing from the first one reaches the second.

const DRAFT_KEY = "itera.enrollment.safe-draft.v2";

const readStores = page => page.evaluate(([draftKey]) => ({
  draft: JSON.parse(localStorage.getItem(draftKey) || "null"),
  conversation: localStorage.getItem("itera.emmi.conversation.v1"),
  careCircle: localStorage.getItem("itera.care-circle.prototype.v1"),
  shares: localStorage.getItem("itera.access-share.prototype.v1"),
  language: localStorage.getItem("itera.enrollment.language.v1"),
  emmiPreferences: localStorage.getItem("itera.emmi.preferences.v1"),
  visit: sessionStorage.getItem("itera.emmi.visit.v1")
}), [DRAFT_KEY]);

// An enrollment far enough along to be worth losing: identity verified, consent signed, care
// activation under way, EMMI holding a conversation about this patient, a Care Circle invited and
// a share sent. Seeding it is what lets the test prove none of it survives.
const seedEnrollment = (page, { sessionId, screen = "MY_CARE", language = "en" }) => page.evaluate(([draftKey, id, currentScreen, chosenLanguage]) => {
  localStorage.setItem(draftKey, JSON.stringify({
    scenarioId: "access-invitation", sessionId: id, screen: currentScreen, role: "patient", completionRole: "patient",
    identityVerified: true, consentSaved: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED",
    accessOutcome: "eligible", accessEligible: true, language: "en", deviceFulfillmentStatus: "REQUESTED",
    audit: [{ event: "consent_saved", sessionId: id }], careTeamTasks: [], careMedications: [], careGoals: [],
    bpReadings: [], bpReadingReceipts: []
  }));
  localStorage.setItem("itera.emmi.conversation.v1", JSON.stringify({
    "access-invitation:DEMO-P001": { conversationSessionId: `conv_${id}`, hasGreeted: true, lastUserIntent: "What was my starting blood pressure?" }
  }));
  localStorage.setItem("itera.care-circle.prototype.v1", JSON.stringify({
    invites: [{ inviteId: `INV_${id}`, token: `tok_${id}`, status: "ACCEPTED", inviterPatientId: "patient_demo", sessionId: id, supportPerson: { name: "Angela Demo", relationship: "Child", phone: "3055550199" }, careCircleStatus: "ACTIVE", sentAt: new Date().toISOString() }]
  }));
  localStorage.setItem("itera.access-share.prototype.v1", JSON.stringify({ shares: [{ shareId: `SHARE_${id}`, channel: "SMS" }] }));
  // Preferences the person chose for themselves, which must outlive the enrollment.
  localStorage.setItem("itera.enrollment.language.v1", chosenLanguage);
  localStorage.setItem("itera.emmi.preferences.v1", JSON.stringify({ emmiVoiceGuidance: true, emmiWelcomeAcknowledged: true }));
}, [DRAFT_KEY, sessionId, screen, language]);

// ---------------------------------------------------------------------------------------------
// Scenario A — "/" resumes, and keeps resuming across a refresh
// ---------------------------------------------------------------------------------------------

test("the bare link resumes the enrollment the browser is holding, before and after a refresh", async ({ page }) => {
  await page.goto("/");
  await seedEnrollment(page, { sessionId: "enrollment-A" });
  await page.reload();

  await expect(page.getByRole("heading", { name: "My Care" })).toBeVisible();
  expect((await readStores(page)).draft.sessionId).toBe("enrollment-A");

  await page.reload();
  await expect(page.getByRole("heading", { name: "My Care" })).toBeVisible();
  expect((await readStores(page)).draft.sessionId).toBe("enrollment-A");
});

// ---------------------------------------------------------------------------------------------
// Scenario B — "/new" starts clean, and the new enrollment is the one a refresh keeps
// ---------------------------------------------------------------------------------------------

test("/new opens the first screen of a new enrollment and carries nothing over from the last one", async ({ page }) => {
  await page.goto("/");
  // Seeded in Spanish on purpose. The language is the person's, not the enrollment's, so the new
  // journey has to open in it — and asserting the Spanish label proves the preference survived a
  // reset that wiped everything around it.
  await seedEnrollment(page, { sessionId: "enrollment-A", language: "es" });
  await page.goto("/new");

  // The first real screen of the journey, not the completed enrollment that was in the browser.
  await expect(page.getByRole("button", { name: /Comience su recorrido de cuidado/i })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Mi cuidado");

  const stores = await readStores(page);
  expect(stores.draft, "the previous enrollment's draft").toBeNull();
  expect(stores.careCircle, "a Care Circle invited during the previous enrollment").toBeNull();
  expect(stores.shares, "shares sent from the previous enrollment").toBeNull();

  // EMMI writes a conversation context as soon as the new journey opens, which is what §9 asks
  // for: the new enrollment gets its own. What must not survive is the previous patient's — so
  // this asserts on the contents rather than on the key being absent, because an absent key would
  // only prove EMMI had not started yet.
  const conversation = stores.conversation || "";
  expect(conversation, "EMMI must not resume the previous enrollment's conversation").not.toContain("conv_enrollment-A");
  expect(conversation, "nor carry over what the previous patient asked").not.toContain("What was my starting blood pressure?");

  // Preferences belong to the person, not to the enrollment they were in.
  expect(stores.language).toBe("es");
  expect(stores.emmiPreferences).toContain("emmiVoiceGuidance");
  expect(stores.emmiPreferences).not.toContain("emmiWelcomeAcknowledged");
  await expect(page.getByRole("heading", { name: "Hola, soy EMMI." })).toBeVisible();
});

// "/new" is a command that has been carried out. Leaving it in the address bar would make every
// refresh run it again and discard the enrollment the patient had just begun.
test("/new hands the browser back to the canonical route so a refresh resumes the new enrollment", async ({ page }) => {
  await page.goto("/");
  await seedEnrollment(page, { sessionId: "enrollment-A" });
  await page.goto("/new");
  await expect(page).toHaveURL(/\/$/);

  // Take enrollment B far enough to be persisted, then prove a refresh keeps B rather than
  // starting a third enrollment or resurrecting A.
  await page.evaluate(([draftKey]) => {
    const draft = JSON.parse(localStorage.getItem(draftKey) || "null") || {};
    localStorage.setItem(draftKey, JSON.stringify({ ...draft, scenarioId: "access-invitation", sessionId: "enrollment-B", screen: "MY_CARE", role: "patient", completionRole: "patient", identityVerified: true, consentSaved: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED", accessOutcome: "eligible", language: "en", audit: [], careTeamTasks: [], careMedications: [], careGoals: [], bpReadings: [], bpReadingReceipts: [] }));
  }, [DRAFT_KEY]);
  await page.reload();

  await expect(page.getByRole("heading", { name: "My Care" })).toBeVisible();
  const stores = await readStores(page);
  expect(stores.draft.sessionId).toBe("enrollment-B");
  expect(JSON.stringify(stores.draft)).not.toContain("enrollment-A");
});

// ---------------------------------------------------------------------------------------------
// Scenario C — "/" after "/new" shows B, never a mixture of A and B
// ---------------------------------------------------------------------------------------------

test("returning to the bare link shows the new enrollment and never a mixture of the two", async ({ page }) => {
  await page.goto("/");
  await seedEnrollment(page, { sessionId: "enrollment-A" });
  await page.goto("/new");
  await page.evaluate(([draftKey]) => {
    localStorage.setItem(draftKey, JSON.stringify({ scenarioId: "access-invitation", sessionId: "enrollment-B", screen: "MY_CARE", role: "patient", completionRole: "patient", identityVerified: true, consentSaved: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED", accessOutcome: "eligible", language: "en", audit: [], careTeamTasks: [], careMedications: [], careGoals: [], bpReadings: [], bpReadingReceipts: [] }));
  }, [DRAFT_KEY]);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "My Care" })).toBeVisible();

  const stores = await readStores(page);
  expect(stores.draft.sessionId).toBe("enrollment-B");
  // Every artifact enrollment A left behind is still gone: the Care Circle it invited, the share
  // it sent, and the conversation EMMI held with it.
  expect(stores.careCircle).toBeNull();
  expect(stores.shares).toBeNull();
  const everything = JSON.stringify(stores);
  expect(everything).not.toContain("enrollment-A");
  expect(everything).not.toContain("Angela Demo");
});

// ---------------------------------------------------------------------------------------------
// Scenario D — "/new" is idempotent as a command: each explicit visit starts one clean enrollment
// ---------------------------------------------------------------------------------------------

test("visiting /new repeatedly starts one clean enrollment each time, without corrupting state", async ({ page }) => {
  await page.goto("/");
  await seedEnrollment(page, { sessionId: "enrollment-A" });

  for (const sessionId of ["enrollment-B", "enrollment-C", "enrollment-D"]) {
    await page.goto("/new");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: /Start your care journey/i })).toBeVisible();
    expect((await readStores(page)).draft, `${sessionId} should start with no draft`).toBeNull();
    await page.evaluate(([draftKey, id]) => {
      localStorage.setItem(draftKey, JSON.stringify({ scenarioId: "access-invitation", sessionId: id, screen: "MY_CARE", role: "patient", completionRole: "patient", identityVerified: true, consentSaved: true, enrollmentConfirmed: true, enrollmentStatus: "COMPLETED", accessOutcome: "eligible", language: "en", audit: [], careTeamTasks: [], careMedications: [], careGoals: [], bpReadings: [], bpReadingReceipts: [] }));
    }, [DRAFT_KEY, sessionId]);
  }

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "My Care" })).toBeVisible();
  const stores = await readStores(page);
  expect(stores.draft.sessionId).toBe("enrollment-D");
  const everything = JSON.stringify(stores);
  for (const previous of ["enrollment-A", "enrollment-B", "enrollment-C"]) {
    expect(everything, `${previous} must not survive into the current enrollment`).not.toContain(previous);
  }
});

// ---------------------------------------------------------------------------------------------
// No flicker — the previous patient is never painted on the way to the new enrollment
// ---------------------------------------------------------------------------------------------

// The reset runs at module scope, before the first render and before boot() reads the draft. This
// watches every paint from navigation onwards: in a clinical prototype a flash of the previous
// enrollment is not a cosmetic glitch, it is showing patient A's care to whoever is starting B.
test("/new never paints the previous enrollment on its way to the first screen", async ({ page }) => {
  await page.goto("/");
  await seedEnrollment(page, { sessionId: "enrollment-A" });

  await page.addInitScript(() => {
    window.__paints = [];
    const record = () => { try { window.__paints.push(document.body?.innerText || ""); } catch { /* pre-body */ } };
    new MutationObserver(record).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    document.addEventListener("DOMContentLoaded", record);
  });
  await page.goto("/new");
  await expect(page.getByRole("button", { name: /Start your care journey/i })).toBeVisible();

  const leaked = await page.evaluate(() => (window.__paints || []).filter(text => /My Care|Angela Demo|Getting Started/.test(text)));
  expect(leaked, "no paint may contain the previous enrollment").toEqual([]);
});
