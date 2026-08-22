import { describe, expect, it, vi } from "vitest";
import { DraftStore } from "../src/services.js";

describe("safe draft persistence", () => {
  it("does not persist identity inputs, Medicare IDs, tokens, or clinical readings", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem, getItem: vi.fn(), removeItem: vi.fn() });
    new DraftStore().save({ scenarioId: "access-happy", screen: "DISCLOSURE", role: "patient", language: "en", identityVerified: true, mbi: "1EG4TE5MK73", dob: "05/12/1952", secureToken: "secret", reading: { systolic: 120 }, onboarding: {}, audit: [] });
    const saved = setItem.mock.calls[0][1];
    expect(saved).not.toContain("1EG4TE5MK73");
    expect(saved).not.toContain("05/12/1952");
    expect(saved).not.toContain("secret");
    expect(saved).not.toContain("systolic");
  });
});
