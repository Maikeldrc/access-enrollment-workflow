const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

// The provider VAD remains authoritative. This lightweight local detector exists only to
// silence already-buffered EMMI audio while the first speech frames travel to Gemini Live.
// It deliberately requires sustained energy so a tap, cough, or one noisy frame cannot stop
// EMMI, and it uses a long end-of-speech window so older adults may pause mid-sentence.
export class EmmiBargeInManager {
  constructor({
    onSpeechStart = () => {},
    onSpeechEnd = () => {},
    onTelemetry = () => {},
    minimumStartRms = 0.025,
    startFrames = 2,
    minimumOutputStartRms = 0.045,
    outputStartFrames = 3,
    silenceDurationMs = 750
  } = {}) {
    this.onSpeechStart = onSpeechStart;
    this.onSpeechEnd = onSpeechEnd;
    this.onTelemetry = onTelemetry;
    this.minimumStartRms = minimumStartRms;
    this.startFrames = startFrames;
    this.minimumOutputStartRms = minimumOutputStartRms;
    this.outputStartFrames = outputStartFrames;
    this.silenceDurationMs = silenceDurationMs;
    this.reset();
  }

  reset() {
    this.noiseFloor = 0.008;
    this.aboveThresholdFrames = 0;
    this.speechActive = false;
    this.speechStartedAt = 0;
    this.probableSpeechAt = 0;
    this.lastSpeechAt = 0;
    this.interruptionStartedAt = 0;
    this.interruptionSource = "";
  }

  threshold(outputActive = false) {
    return clamp(this.noiseFloor * 3.2, outputActive ? this.minimumOutputStartRms : this.minimumStartRms, 0.085);
  }

  observeFrame({ rms, peak = 0, now = performance.now(), outputActive = false } = {}) {
    const level = Number.isFinite(rms) ? rms : 0;
    const threshold = this.threshold(outputActive);
    const speechLike = level >= threshold && peak >= Math.max(0.045, threshold * 1.35);

    if (!this.speechActive && !speechLike) {
      // Learn ambient noise slowly, but do not chase EMMI's residual speaker output upward.
      const rate = outputActive ? 0.002 : 0.025;
      this.noiseFloor = clamp(this.noiseFloor * (1 - rate) + level * rate, 0.002, 0.03);
    }

    if (speechLike) {
      this.probableSpeechAt ||= now;
      this.aboveThresholdFrames += 1;
      this.lastSpeechAt = now;
      const requiredFrames = outputActive ? this.outputStartFrames : this.startFrames;
      if (!this.speechActive && this.aboveThresholdFrames >= requiredFrames) {
        this.speechActive = true;
        this.speechStartedAt = this.probableSpeechAt || now;
        this.interruptionStartedAt ||= now;
        this.interruptionSource ||= "local_vad";
        this.onSpeechStart({ source: this.interruptionSource, detectedAt: this.probableSpeechAt || now, confirmedAt: now, outputActive, threshold });
      }
      return this.speechActive ? "SPEECH" : "PROBABLE_SPEECH";
    }

    this.aboveThresholdFrames = 0;
    if (!this.speechActive) this.probableSpeechAt = 0;
    if (this.speechActive && now - this.lastSpeechAt >= this.silenceDurationMs) {
      const durationMs = Math.max(0, now - this.speechStartedAt);
      this.speechActive = false;
      this.onSpeechEnd({ source: this.interruptionSource || "local_vad", detectedAt: now, durationMs });
      this.onTelemetry("EMMI_PATIENT_SPEECH_ENDED", { source: this.interruptionSource || "local_vad", durationMs: Math.round(durationMs) });
      this.interruptionStartedAt = 0;
      this.interruptionSource = "";
      this.probableSpeechAt = 0;
      return "SPEECH_ENDED";
    }
    return this.speechActive ? "SPEECH" : "SILENCE";
  }

  confirmProviderInterruption(now = performance.now()) {
    if (!this.speechActive) {
      this.speechActive = true;
      this.speechStartedAt = now;
      this.lastSpeechAt = now;
    }
    this.interruptionStartedAt ||= now;
    this.interruptionSource = "provider_vad";
    return { source: "provider_vad", detectedAt: now };
  }
}
