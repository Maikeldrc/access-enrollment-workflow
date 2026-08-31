import { beforeEach, describe, expect, it, vi } from "vitest";
import { DraftStore } from "../src/services.js";
import { GrowthStore } from "../src/growth.js";
import { clearEmmiConversation } from "../src/emmi/conversationManager.js";
import { resetEnrollmentSession } from "../src/enrollmentSession.js";

// A localStorage that behaves like the real one, so a test can say what a browser holds before the
// reset and read back exactly what it holds after.
const fakeStorage = (seed = {}) => {
  const data = new Map(Object.entries(seed));
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    keys: () => [...data.keys()].sort()
  };
};

// What one finished enrollment leaves behind in a browser, and what the person using that browser
// chose for themselves. The point of the reset is that these two lists have nothing in common.
const ENROLLMENT_KEYS = {
  "itera.enrollment.safe-draft.v2": JSON.stringify({ scenarioId: "access-invitation", sessionId: "session-A", screen: "MY_CARE", identityVerified: true }),
  "itera.emmi.conversation.v1": JSON.stringify({ "access-invitation:DEMO-P001": { conversationSummary: "user: what was my starting blood pressure?", hasGreeted: true } }),
  "itera.care-circle.prototype.v1": JSON.stringify({ invites: [{ inviteId: "INV-A", supportPerson: { name: "Angela" } }] }),
  "itera.access-share.prototype.v1": JSON.stringify({ shares: [{ shareId: "SHARE-A" }] })
};

const PREFERENCE_KEYS = {
  "itera.enrollment.language.v1": "es",
  "itera.emmi.preferences.v1": JSON.stringify({ emmiVoiceGuidance: true, emmiWelcomeAcknowledged: true }),
  "itera.emmi.position.v1": JSON.stringify({ x: 12, y: 340 }),
  "itera.growth.preferences.v1": JSON.stringify({ careCirclePromptDismissedAt: "2026-08-01T00:00:00.000Z" }),
  "itera.prototype.config.v1": JSON.stringify({ program: "ACCESS" })
};

describe("starting a new enrollment", () => {
  let storage;
  let session;

  beforeEach(() => {
    storage = fakeStorage({ ...ENROLLMENT_KEYS, ...PREFERENCE_KEYS });
    session = fakeStorage({
      "itera.emmi.conversation.session.v1": JSON.stringify({ "access-invitation:DEMO-P001": { lastEmmiTurn: "Your starting blood pressure is 152 over 88." } }),
      "itera.emmi.visit.v1": "visit_a"
    });
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", session);
  });

  const reset = () => resetEnrollmentSession({
    draftStore: new DraftStore(),
    growthStore: new GrowthStore(storage),
    clearConversation: () => clearEmmiConversation({ storage, sessionStorage: session }),
    clearAuditLog: () => session.removeItem("itera.emmi.prototype.audit.v1")
  });

  // The five stores an enrollment writes to. A reset that reached four of them would produce the
  // most dangerous state there is: one that looks new and still holds the previous patient.
  it("clears every store the previous enrollment wrote to", () => {
    const result = reset();
    for (const key of Object.keys(ENROLLMENT_KEYS)) {
      expect(storage.getItem(key), `${key} should not survive a new enrollment`).toBeNull();
    }
    expect(session.getItem("itera.emmi.conversation.session.v1")).toBeNull();
    expect(session.getItem("itera.emmi.visit.v1")).toBeNull();
    expect(result.cleared).toEqual(["draft", "careCircleAndShares", "emmiConversation", "emmiAuditLog"]);
  });

  // Language, voice guidance, where EMMI sits and "stop asking me this" belong to the person
  // holding the browser. Starting a second enrollment must not make them set those up again.
  it("keeps the preferences that belong to the person rather than to the enrollment", () => {
    reset();
    for (const [key, value] of Object.entries(PREFERENCE_KEYS)) {
      expect(storage.getItem(key), `${key} is a preference and should survive`).toBe(value);
    }
    expect(storage.keys()).toEqual(Object.keys(PREFERENCE_KEYS).sort());
  });

  // Both demo enrollments are the same fictional patient on the same scenario, so EMMI's scope
  // string is identical for A and B. Deleting one scope would leave the conversation in place;
  // enrollment B would greet the patient by resuming enrollment A's last answer.
  it("leaves EMMI no conversation to resume from the previous enrollment", () => {
    reset();
    expect(storage.getItem("itera.emmi.conversation.v1")).toBeNull();
    expect(JSON.stringify(session.keys())).not.toContain("conversation");
  });

  // A store that throws must not strand the rest. A half-cleared browser is the leak this whole
  // module exists to prevent, so the reset reports what it managed rather than stopping.
  it("keeps clearing the other stores when one of them fails", () => {
    const result = resetEnrollmentSession({
      draftStore: { clear: () => { throw new Error("storage unavailable"); } },
      growthStore: new GrowthStore(storage),
      clearConversation: () => clearEmmiConversation({ storage, sessionStorage: session }),
      clearAuditLog: () => {}
    });
    expect(result.cleared).not.toContain("draft");
    expect(result.cleared).toEqual(["careCircleAndShares", "emmiConversation", "emmiAuditLog"]);
    expect(storage.getItem("itera.care-circle.prototype.v1")).toBeNull();
    expect(storage.getItem("itera.emmi.conversation.v1")).toBeNull();
  });

  // Nothing is required: a browser that has never held an enrollment resets cleanly rather than
  // throwing on the way to a first screen.
  it("does nothing harmful when there is no previous enrollment to clear", () => {
    const empty = fakeStorage({ ...PREFERENCE_KEYS });
    const result = resetEnrollmentSession({ growthStore: new GrowthStore(empty) });
    expect(result.cleared).toEqual(["careCircleAndShares"]);
    expect(empty.keys()).toEqual(Object.keys(PREFERENCE_KEYS).sort());
  });
});
