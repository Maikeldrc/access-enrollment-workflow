import { describe, expect, it, vi } from "vitest";
import { EmmiBargeInManager } from "../src/emmi/bargeInManager.js";

describe("EMMI local barge-in detector", () => {
  it("requires sustained speech-like audio and ignores an isolated noisy frame", () => {
    const starts = vi.fn();
    const detector = new EmmiBargeInManager({ onSpeechStart: starts });
    expect(detector.observeFrame({ rms: 0.05, peak: 0.12, now: 100, outputActive: true })).toBe("PROBABLE_SPEECH");
    expect(detector.observeFrame({ rms: 0.005, peak: 0.01, now: 190, outputActive: true })).toBe("SILENCE");
    expect(starts).not.toHaveBeenCalled();
    detector.observeFrame({ rms: 0.05, peak: 0.12, now: 300, outputActive: true });
    expect(detector.observeFrame({ rms: 0.052, peak: 0.13, now: 390, outputActive: true })).toBe("SPEECH");
    expect(starts).toHaveBeenCalledOnce();
    expect(starts.mock.calls[0][0].detectedAt).toBe(300);
  });

  it("allows a long senior-friendly pause before ending the patient turn", () => {
    const ends = vi.fn();
    const detector = new EmmiBargeInManager({ onSpeechEnd: ends, silenceDurationMs: 800 });
    detector.observeFrame({ rms: 0.05, peak: 0.12, now: 0 });
    detector.observeFrame({ rms: 0.05, peak: 0.12, now: 100 });
    expect(detector.observeFrame({ rms: 0.004, peak: 0.01, now: 850 })).toBe("SPEECH");
    expect(ends).not.toHaveBeenCalled();
    expect(detector.observeFrame({ rms: 0.004, peak: 0.01, now: 901 })).toBe("SPEECH_ENDED");
    expect(ends).toHaveBeenCalledOnce();
  });

  it("accepts the provider interruption event as authoritative speech activity", () => {
    const detector = new EmmiBargeInManager();
    expect(detector.confirmProviderInterruption(500)).toEqual({ source: "provider_vad", detectedAt: 500 });
    expect(detector.speechActive).toBe(true);
  });
});
