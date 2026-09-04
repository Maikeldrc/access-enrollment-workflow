import { afterEach, describe, expect, it, vi } from "vitest";
import { EMMI_CONFIG } from "../src/emmi/config.js";
import { EMMI_MAX_CONSECUTIVE_STALLS, EmmiLiveClient } from "../src/emmi/liveClient.js";

// Session lifetime, silent handoffs and the notices EMMI speaks in her own voice. Everything here is
// the application's side of a voice conversation: nothing depends on what a model would say.

const minutes = EMMI_CONFIG.sessionMaxMinutes;
const narration = () => vi.fn().mockImplementation(async (text, locale, signal, onChunk) => { onChunk("AQIDBA=="); return { data: "AQIDBA==", mimeType: "audio/pcm;rate=24000" }; });

afterEach(() => { vi.useRealTimers(); });

describe("EMMI voice session lifetime", () => {
  it("rotates onto a fresh token one minute before the hard stop, silently and while idle", () => {
    vi.useFakeTimers();
    const telemetry = [];
    const reconnects = [];
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "ES" }), onVoiceTelemetry: (type, details) => telemetry.push({ type, details }), onReconnectNeeded: details => { reconnects.push(details); return "Continue the existing conversation."; } });
    client.session = { close: vi.fn() };
    client.state = "LISTENING";
    client.sessionResumptionHandle = "resume-handle";
    client.connect = vi.fn().mockResolvedValue(true);
    client.disconnect = vi.fn(() => { clearTimeout(client.warningTimer); clearTimeout(client.endTimer); clearTimeout(client.sessionRotationTimer); });
    client.startTimers();

    vi.advanceTimersByTime((minutes - 1) * 60 * 1000 - 1);
    expect(client.connect).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(telemetry.map(item => item.type)).toContain("EMMI_SESSION_ROTATION");
    expect(client.state).toBe("CONNECTING");
    vi.advanceTimersByTime(100);
    // The handoff keeps the click-activated output context and opens the new session without an
    // opening turn: the provider resumes its own history, and the patient hears nothing.
    expect(client.disconnect).toHaveBeenCalledWith("go_away_handoff", { preserveOutput: true });
    expect(client.connect).toHaveBeenCalledWith("", {});
    expect(reconnects.at(-1)).toMatchObject({ reason: "session_expiring", silent: true });
    // The hard stop never fired because the rotation replaced it.
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(client.disconnect).not.toHaveBeenCalledWith("session_timeout");
  });

  it("waits for a quiet moment before rotating and never cuts a reply", () => {
    vi.useFakeTimers();
    const telemetry = [];
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "ES" }), onVoiceTelemetry: type => telemetry.push(type), onReconnectNeeded: () => "" });
    client.session = { close: vi.fn() };
    client.state = "EMMI_SPEAKING";
    client.activeTurn = { id: "reply", generationId: 3 };
    client.sessionResumptionHandle = "resume-handle";
    client.connect = vi.fn().mockResolvedValue(true);
    client.disconnect = vi.fn();
    client.startTimers();

    vi.advanceTimersByTime((minutes - 1) * 60 * 1000);
    expect(telemetry).not.toContain("EMMI_SESSION_ROTATION");
    expect(client.connect).not.toHaveBeenCalled();
    // The reply finishes; the next check rotates.
    client.activeTurn = null;
    client.state = "LISTENING";
    vi.advanceTimersByTime(3000);
    expect(telemetry).toContain("EMMI_SESSION_ROTATION");
  });

  it("falls back to the hard stop only when the provider gave no resumption handle", () => {
    vi.useFakeTimers();
    const telemetry = [];
    const states = [];
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "ES" }), onVoiceTelemetry: type => telemetry.push(type), onState: state => states.push(state) });
    client.session = { close: vi.fn() };
    client.state = "LISTENING";
    client.startTimers();

    vi.advanceTimersByTime((minutes - 1) * 60 * 1000);
    expect(telemetry).toContain("EMMI_SESSION_ROTATION_SKIPPED");
    vi.advanceTimersByTime(60 * 1000);
    expect(states.at(-1)).toBe("DISCONNECTED");
  });

  it("keeps the audible output context across a locale restart and narrates the confirmation first", async () => {
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "ES" }) });
    client.state = "LISTENING";
    client.session = { close: vi.fn() };
    const disconnect = vi.spyOn(client, "disconnect").mockImplementation(() => { client.session = null; client.state = "DISCONNECTED"; });
    client.connect = vi.fn().mockResolvedValue(true);

    await client.restartForLocale("Perfecto, seguimos en español.", { priority: "SCREEN_GUIDANCE", semanticText: "Perfecto, seguimos en español." });

    expect(disconnect).toHaveBeenCalledWith("locale_changed", { preserveOutput: true });
    expect(client.connect).toHaveBeenCalledWith("Perfecto, seguimos en español.", expect.objectContaining({ priority: "SCREEN_GUIDANCE" }));
  });
});

describe("EMMI local notices", () => {
  it("speaks a notice through the narration route, in the active language, and can be interrupted", async () => {
    const states = [];
    const transcripts = [];
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "ES", currentScreen: "MY_CARE" }), onState: state => states.push(state), onTranscript: (role, text, final, turn) => transcripts.push({ role, text, priority: turn?.priority }) });
    client.session = { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn() };
    client.state = "LISTENING";
    client.requestNarrationAudio = narration();
    client.playAudio = vi.fn((data, turn) => { turn.firstAudioReceivedAt = performance.now(); client.sources.set({ stop: vi.fn() }, { metadata: turn }); return true; });

    expect(client.speakLocalNotice("Perdón, no le entendí bien. ¿Me lo puede repetir?", { reason: "test" })).toBe(true);
    await vi.waitFor(() => expect(client.state).toBe("EMMI_SPEAKING"));
    expect(client.requestNarrationAudio).toHaveBeenCalledWith("Perdón, no le entendí bien. ¿Me lo puede repetir?", "ES", expect.any(AbortSignal), expect.any(Function));
    expect(client.session.sendRealtimeInput).not.toHaveBeenCalled();
    expect(transcripts).toEqual([{ role: "assistant", text: "Perdón, no le entendí bien. ¿Me lo puede repetir?", priority: "LOCAL_NOTICE" }]);

    // A notice is not critical safety: the patient may talk over it and take the floor.
    expect(client.handlePatientSpeechStart({ source: "local_vad", detectedAt: performance.now() })).toBe(true);
    expect(client.activeTurn).toBeNull();
    expect(client.state).toBe("USER_SPEAKING");
  });

  it("refuses to talk over an active turn and gives the microphone back when narration fails", async () => {
    const states = [];
    const telemetry = [];
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }), onState: state => states.push(state), onVoiceTelemetry: type => telemetry.push(type) });
    client.session = { sendRealtimeInput: vi.fn() };
    client.state = "EMMI_SPEAKING";
    client.activeTurn = { id: "reply", generationId: 2 };
    expect(client.speakLocalNotice("Sorry, I didn't catch that.")).toBe(false);

    client.activeTurn = null;
    client.state = "LISTENING";
    client.requestNarrationAudio = vi.fn().mockRejectedValue(new Error("tts_generation_failed"));
    vi.stubGlobal("speechSynthesis", undefined);
    expect(client.speakLocalNotice("Sorry, I didn't catch that.")).toBe(true);
    await vi.waitFor(() => expect(client.state).toBe("LISTENING"));
    expect(telemetry).toContain("EMMI_LOCAL_NOTICE_FAILED");
    expect(client.activeTurn).toBeNull();
    expect(client.session.sendRealtimeInput).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("only gives up on the socket after consecutive stalls", () => {
    expect(EMMI_MAX_CONSECUTIVE_STALLS).toBe(2);
  });
});
