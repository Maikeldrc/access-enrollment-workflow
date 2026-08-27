import { describe, expect, it } from "vitest";
import { GROWTH_PROMPT_COOLDOWN_MS, GrowthStore, growthPromptAvailable } from "../src/growth.js";

const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
};

describe("Care Circle prototype storage", () => {
  it("creates a scoped temporary link without patient identifiers and preserves the patient decision role", () => {
    const store = new GrowthStore(memoryStorage());
    const invite = store.createSupportInvite({ inviterPatientId: "DEMO-P001", patientFirstName: "Robert", supportPersonName: "Angela Demo", phone: "305-555-0199", relationship: "Child", sessionId: "session-demo", origin: "https://example.test" });
    expect(invite.status).toBe("SENT");
    expect(invite.supportRole).toBe("CARE_CIRCLE_MEMBER");
    expect(invite.completionRole).toBe("PATIENT");
    expect(invite.temporarySupportLink).not.toContain("DEMO-P001");
    expect(invite.temporarySupportLink).not.toContain("Robert");
    expect(store.acceptSupportInvite(invite.token).status).toBe("ACCEPTED");
    expect(store.revokeSupportInvite(invite.inviteId).status).toBe("REVOKED");
    expect(store.acceptSupportInvite(invite.token).status).toBe("REVOKED");
  });
});

describe("Share ACCESS prototype attribution", () => {
  it("creates a public information link without patient or enrollment state", () => {
    const store = new GrowthStore(memoryStorage());
    const share = store.createAccessShare({ channel: "COPY_LINK", origin: "https://example.test" });
    expect(share.source).toBe("ENROLLED_PATIENT");
    expect(share.publicAccessLandingUrl).toContain("/access/learn?source=patient-share&shareId=");
    expect(JSON.stringify(share)).not.toContain("patientId");
    expect(JSON.stringify(share)).not.toContain("eligibilityStatus");
  });

  it("respects the seven-day dismissal cooldown", () => {
    const now = Date.now();
    expect(growthPromptAvailable(new Date(now - GROWTH_PROMPT_COOLDOWN_MS + 1).toISOString(), now)).toBe(false);
    expect(growthPromptAvailable(new Date(now - GROWTH_PROMPT_COOLDOWN_MS).toISOString(), now)).toBe(true);
  });
});
