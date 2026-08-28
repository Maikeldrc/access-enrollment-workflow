import { describe, expect, it } from "vitest";
import { EMMI_VISIBLE_STATE, emmiVisibleStateLabel, resolveEmmiVisibleState } from "../src/emmi/presentationState.js";

describe("EMMI patient-facing presentation state", () => {
  it.each(["CONNECTING", "RECONNECTING", "INITIALIZING", "SESSION_STARTING", "WAITING_MODEL", "AWAITING_FIRST_RESPONSE", "EMMI_THINKING", "TOOL_RUNNING"])(
    "hides the technical %s state behind Thinking",
    internalState => expect(resolveEmmiVisibleState({ internalState })).toBe(EMMI_VISIBLE_STATE.THINKING)
  );

  it("preserves the human listening and speaking states", () => {
    expect(resolveEmmiVisibleState({ internalState: "USER_SPEAKING" })).toBe(EMMI_VISIBLE_STATE.LISTENING);
    expect(resolveEmmiVisibleState({ internalState: "EMMI_SPEAKING" })).toBe(EMMI_VISIBLE_STATE.SPEAKING);
  });

  it("prioritizes unavailable, paused, and error presentation states", () => {
    expect(resolveEmmiVisibleState({ voiceEnabled: false, internalState: "CONNECTING" })).toBe(EMMI_VISIBLE_STATE.OFF);
    expect(resolveEmmiVisibleState({ voiceSupported: false, internalState: "CONNECTING" })).toBe(EMMI_VISIBLE_STATE.UNSUPPORTED);
    expect(resolveEmmiVisibleState({ paused: true, internalState: "CONNECTING" })).toBe(EMMI_VISIBLE_STATE.PAUSED);
    expect(resolveEmmiVisibleState({ hasError: true, internalState: "CONNECTING" })).toBe(EMMI_VISIBLE_STATE.ERROR);
  });

  it.each([
    ["en", "Thinking…", "Listening…", "Speaking…"],
    ["es", "Pensando…", "Escuchando…", "Hablando…"],
    ["ht", "M ap reflechi…", "M ap koute…", "M ap pale…"],
    ["KR", "M ap reflechi…", "M ap koute…", "M ap pale…"]
  ])("localizes transient labels for %s", (locale, thinking, listening, speaking) => {
    expect(emmiVisibleStateLabel(EMMI_VISIBLE_STATE.THINKING, locale)).toBe(thinking);
    expect(emmiVisibleStateLabel(EMMI_VISIBLE_STATE.LISTENING, locale)).toBe(listening);
    expect(emmiVisibleStateLabel(EMMI_VISIBLE_STATE.SPEAKING, locale)).toBe(speaking);
  });
});
