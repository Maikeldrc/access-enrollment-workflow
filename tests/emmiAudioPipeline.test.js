import { describe, expect, it, vi } from "vitest";
import { EMMI_AUDIO_PIPELINE_VERSION, EMMI_END_OF_SPEECH_SILENCE_MS, EMMI_GUIDANCE_START_TIMEOUT_MS, EMMI_MIC_FRAME_SIZE, EMMI_PROVIDER_SAMPLE_RATE, EmmiLiveClient, pcm16, resample, supportsAudioWorklet } from "../src/emmi/liveClient.js";

// The worklet runs on the audio thread and cannot be imported here, so its accumulator is
// reproduced exactly: this is the part of the migration that decides the packet cadence.
function collectFrames(quanta, frameSize = EMMI_MIC_FRAME_SIZE) {
  const frames = [];
  let frame = new Float32Array(frameSize);
  let offset = 0;
  for (const quantum of quanta) {
    for (const sample of quantum) {
      frame[offset] = sample;
      offset += 1;
      if (offset < frameSize) continue;
      frames.push(frame);
      frame = new Float32Array(frameSize);
      offset = 0;
    }
  }
  return { frames, pending: offset };
}

const quantaOf = (count, size = 128, fill = index => index) =>
  Array.from({ length: count }, (_, quantum) => Float32Array.from({ length: size }, (_, index) => fill(quantum * size + index)));

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

describe("EMMI audio pipeline", () => {
  it("keeps the provider contract the previous pipeline established", () => {
    expect(EMMI_PROVIDER_SAMPLE_RATE).toBe(16000);
    expect(EMMI_MIC_FRAME_SIZE).toBe(1024);
    expect(EMMI_AUDIO_PIPELINE_VERSION).toBe("emmi-audio-v4");
    expect(EMMI_END_OF_SPEECH_SILENCE_MS).toBe(750);
    expect(EMMI_GUIDANCE_START_TIMEOUT_MS).toBe(3500);
  });

  it("aggregates render quanta into one provider-sized frame instead of sending each one", () => {
    // 1024 / 128 = 8 quanta per frame. Sending each quantum would be ~375 messages a second
    // at 48 kHz; this stays bounded while making hands-free interruption responsive.
    const { frames, pending } = collectFrames(quantaOf(8));
    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveLength(EMMI_MIC_FRAME_SIZE);
    expect(pending).toBe(0);
    const messagesPerSecond = 48000 / EMMI_MIC_FRAME_SIZE;
    expect(messagesPerSecond).toBeLessThan(50);
  });

  it("loses no samples and never reorders them across frame boundaries", () => {
    const { frames, pending } = collectFrames(quantaOf(35));
    expect(frames).toHaveLength(4);
    expect(pending).toBe(35 * 128 - 4 * EMMI_MIC_FRAME_SIZE);
    const flattened = frames.flatMap(frame => [...frame]);
    expect(flattened).toEqual(Array.from({ length: 4 * EMMI_MIC_FRAME_SIZE }, (_, index) => index));
  });

  it("hands each frame out as its own buffer so a transferred frame is never overwritten", () => {
    const { frames } = collectFrames(quantaOf(16));
    expect(frames).toHaveLength(2);
    expect(frames[0].buffer).not.toBe(frames[1].buffer);
    expect(frames[0][0]).toBe(0);
    expect(frames[1][0]).toBe(EMMI_MIC_FRAME_SIZE);
  });

  it("resamples a device frame to the 16 kHz the provider expects", () => {
    const frame = Float32Array.from({ length: EMMI_MIC_FRAME_SIZE }, (_, index) => Math.sin(index / 20));
    const resampled = resample(frame, 48000, EMMI_PROVIDER_SAMPLE_RATE);
    expect(resampled).toHaveLength(Math.round(EMMI_MIC_FRAME_SIZE / 3));
    // ~21 ms per packet at 48 kHz keeps local interruption detection responsive.
    expect((resampled.length / EMMI_PROVIDER_SAMPLE_RATE) * 1000).toBeCloseTo(21.3, 1);
  });
  it("attenuates frequencies above destination Nyquist", () => { const rate = 48000; const tone = Float32Array.from({ length: 4800 }, (_, index) => Math.sin(2 * Math.PI * 12000 * index / rate)); const output = resample(tone, rate, 16000); const rms = Math.sqrt(output.reduce((sum, value) => sum + value * value, 0) / output.length); expect(rms).toBeLessThan(0.08); });

  it("interpolates rather than dropping samples, and passes matching rates straight through", () => {
    const ramp = Float32Array.from({ length: 8 }, (_, index) => index / 7);
    const halved = resample(ramp, 48000, 24000);
    expect(halved).toHaveLength(4);
    // Float32 storage, so compare within its precision rather than exactly.
    expect([...halved].every((value, index, values) => index === 0 || value >= values[index - 1])).toBe(true);
    const identical = resample(ramp, 16000, 16000);
    expect(identical).toBe(ramp);
  });

  it("encodes mono little-endian PCM16 and clamps rather than wrapping", () => {
    const bytes = pcm16(Float32Array.from([0, 1, -1, 0.5, 2, -2]));
    expect(bytes).toHaveLength(12);
    const view = new DataView(bytes.buffer);
    expect(view.getInt16(0, true)).toBe(0);
    expect(view.getInt16(2, true)).toBe(0x7fff);
    expect(view.getInt16(4, true)).toBe(-0x7fff);
    expect(view.getInt16(6, true)).toBe(Math.trunc(0.5 * 0x7fff));
    // Out-of-range input clamps to full scale instead of wrapping to the opposite sign.
    expect(view.getInt16(8, true)).toBe(0x7fff);
    expect(view.getInt16(10, true)).toBe(-0x7fff);
  });

  it("detects AudioWorklet support on the live context, not on the prototype", () => {
    const scope = { AudioWorkletNode: function () {} };
    expect(supportsAudioWorklet({ audioWorklet: { addModule: () => {} } }, scope)).toBe(true);
    expect(supportsAudioWorklet(null, scope)).toBe(false);
    expect(supportsAudioWorklet({}, scope)).toBe(false);
    expect(supportsAudioWorklet({ audioWorklet: {} }, scope)).toBe(false);
    // No AudioWorkletNode means no capture at all: there is deliberately no legacy fallback.
    expect(supportsAudioWorklet({ audioWorklet: { addModule: () => {} } }, {})).toBe(false);
    // Reading audioWorklet off AudioContext.prototype throws in Chrome, so detection must never
    // touch the prototype.
    const hostile = {};
    Object.defineProperty(hostile, "audioWorklet", { get() { throw new TypeError("Illegal invocation"); } });
    expect(() => supportsAudioWorklet(hostile, scope)).toThrow();
  });

  it("does not complete a provider turn until every scheduled audio source has ended", () => {
    const states = [];
    const completions = [];
    const telemetry = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ currentScreen: "INVITATION", sessionId: "test" }),
      executeTool: async () => ({}),
      onState: state => states.push(state),
      onTurnComplete: turn => completions.push(turn),
      onVoiceTelemetry: (type, details) => telemetry.push({ type, details })
    });
    const turn = { id: "turn-1", generationId: 4, providerTurnComplete: true, providerTurnCompleteAt: performance.now(), firstAudioReceivedAt: performance.now() };
    client.activeTurn = turn;
    client.activeAudioGenerationId = 4;
    const source = {};
    client.sources.set(source, { metadata: turn });
    expect(client.finishTurnIfDrained(4)).toBe(false);
    expect(completions).toHaveLength(0);
    expect(states).not.toContain("LISTENING");
    client.sources.delete(source);
    expect(client.finishTurnIfDrained(4)).toBe(true);
    expect(completions).toEqual([turn]);
    expect(states.at(-1)).toBe("LISTENING");
    expect(telemetry.at(-1).type).toBe("EMMI_AUDIO_TURN_DRAINED");
  });

  it("does not let local microphone energy cancel a turn before audio is audible", () => {
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }) });
    client.session = { sendRealtimeInput: vi.fn() };
    client.inputContext = { sampleRate: 48000 };
    client.state = "EMMI_THINKING";
    client.activeTurn = { id: "welcome", generationId: 1, contextVersion: 1, priority: "SCREEN_GUIDANCE" };
    client.activeAudioGenerationId = 1;
    client.bargeIn.observeFrame = vi.fn();

    client.handleMicFrame(new Float32Array(2048).fill(0.2));

    expect(client.bargeIn.observeFrame).not.toHaveBeenCalled();
    expect(client.activeTurn?.id).toBe("welcome");
    expect(client.session.sendRealtimeInput).toHaveBeenCalledOnce();
  });

  it("keeps microphone capture available during passive guidance for hands-free interruption", () => {
    const track = { stop: vi.fn() };
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN", currentScreen: "DECISION_MAKER" }) });
    client.session = { sendClientContent: vi.fn() };
    client.stream = { getTracks: () => [track] };
    client.stopAudioCapture = vi.fn();
    client.state = "LISTENING";
    client.setActiveContextVersion(2);

    expect(client.sendText("Explain this screen", { contextVersion: 2, priority: "SCREEN_GUIDANCE" })).toBe(true);

    expect(client.muted).toBe(false);
    expect(client.stopAudioCapture).not.toHaveBeenCalled();
    expect(track.stop).not.toHaveBeenCalled();
    expect(client.session.sendClientContent).toHaveBeenCalledOnce();
  });

  it("prepares microphone capture while the live socket is still opening", async () => {
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }) });
    const opening = deferred();
    client.muted = true;
    client.connectionPromise = opening.promise;
    client.ensureMicrophoneStream = vi.fn().mockResolvedValue({});
    client.ensureAudioCaptureReady = vi.fn().mockResolvedValue(true);

    const activation = client.setMuted(false);
    await Promise.resolve();
    expect(client.ensureMicrophoneStream).toHaveBeenCalledOnce();
    expect(client.ensureAudioCaptureReady).not.toHaveBeenCalled();

    client.session = { sendClientContent: vi.fn() };
    opening.resolve(true);
    await expect(activation).resolves.toBe(true);
    expect(client.ensureAudioCaptureReady).toHaveBeenCalledOnce();
    expect(client.muted).toBe(false);
  });

  it("gates speaker echo but flushes patient speech with preroll while EMMI is talking", () => {
    const interruptions = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN", currentScreen: "DECISION_MAKER" }),
      onBargeIn: details => interruptions.push(details)
    });
    client.session = { sendRealtimeInput: vi.fn() };
    client.inputContext = { sampleRate: 48000 };
    client.state = "EMMI_SPEAKING";
    client.activeTurn = { id: "guide", generationId: 3, contextVersion: 2, priority: "SCREEN_GUIDANCE" };
    client.activeAudioGenerationId = 3;
    client.sources.set({ stop: vi.fn() }, { metadata: client.activeTurn });

    client.handleMicFrame(new Float32Array(2048).fill(0.01));
    client.handleMicFrame(new Float32Array(2048).fill(0.01));
    expect(client.session.sendRealtimeInput).not.toHaveBeenCalled();

    client.handleMicFrame(new Float32Array(2048).fill(0.2));
    expect(client.session.sendRealtimeInput).not.toHaveBeenCalled();
    client.handleMicFrame(new Float32Array(2048).fill(0.2));
    expect(client.session.sendRealtimeInput).not.toHaveBeenCalled();
    client.handleMicFrame(new Float32Array(2048).fill(0.2));
    expect(client.session.sendRealtimeInput).not.toHaveBeenCalled();
    client.handleMicFrame(new Float32Array(2048).fill(0.2));

    expect(interruptions).toHaveLength(1);
    expect(client.session.sendRealtimeInput).toHaveBeenCalledTimes(6);
    expect(client.state).toBe("USER_SPEAKING");

    client.handleMicFrame(new Float32Array(2048).fill(0.2));
    client.handleMicFrame(new Float32Array(2048).fill(0.2));
    expect(client.session.sendRealtimeInput).toHaveBeenCalledTimes(8);
  });

  it("rejects sustained speaker echo when it disappears during the output duck", () => {
    const gain = { cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), value: 1 };
    const interruptions = [];
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN" }), onBargeIn: details => interruptions.push(details) });
    client.session = { sendRealtimeInput: vi.fn() };
    client.inputContext = { sampleRate: 48000 };
    client.outputContext = { currentTime: 2 };
    client.outputGain = { gain };
    client.state = "EMMI_SPEAKING";
    client.activeTurn = { id: "guide", generationId: 8, contextVersion: 1, priority: "SCREEN_GUIDANCE" };

    client.handleMicFrame(new Float32Array(2048).fill(0.2));
    expect(gain.setValueAtTime).toHaveBeenCalledWith(0, 2);
    for (let index = 0; index < 3; index += 1) client.handleMicFrame(new Float32Array(2048).fill(0.002));

    expect(interruptions).toEqual([]);
    expect(client.session.sendRealtimeInput).not.toHaveBeenCalled();
    expect(gain.setValueAtTime).toHaveBeenLastCalledWith(1, 2);
    expect(client.echoProbeActive).toBe(false);
  });

  it("keeps the microphone available for a patient-initiated response", () => {
    const client = new EmmiLiveClient({ getContext: () => ({ locale: "EN", currentScreen: "DECISION_MAKER" }) });
    client.session = { sendClientContent: vi.fn() };
    client.state = "LISTENING";
    client.setActiveContextVersion(2);

    expect(client.sendText("Answer the patient", { contextVersion: 2, priority: "PATIENT_RESPONSE" })).toBe(true);

    expect(client.muted).toBe(false);
  });

  it("ignores buffered provider speech events after passive guidance muted the microphone", async () => {
    const telemetry = [];
    const transcripts = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN", currentScreen: "DECISION_MAKER" }),
      onTranscript: (...args) => transcripts.push(args),
      onVoiceTelemetry: type => telemetry.push(type)
    });
    client.state = "EMMI_SPEAKING";
    client.muted = true;
    client.activeAudioGenerationId = 4;
    client.activeTurn = { id: "guide", generationId: 4, contextVersion: 2, priority: "SCREEN_GUIDANCE" };

    await client.handleMessage({
      serverContent: {
        interrupted: true,
        inputTranscription: { text: "buffered speaker echo" }
      }
    });

    expect(client.activeTurn?.id).toBe("guide");
    expect(client.awaitingPatientResponse).toBe(false);
    expect(transcripts).toEqual([]);
    expect(telemetry).toContain("EMMI_MUTED_PROVIDER_INTERRUPTION_IGNORED");
    expect(telemetry).toContain("EMMI_MUTED_INPUT_TRANSCRIPT_IGNORED");
  });

  it("uses one bounded clean-session recovery when guidance completes without audio", async () => {
    const completed = [];
    const telemetry = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN", currentScreen: "DECISION_MAKER" }),
      onTurnComplete: turn => completed.push(turn),
      onVoiceTelemetry: type => telemetry.push(type)
    });
    const firstSession = { sendClientContent: vi.fn(), close: vi.fn() };
    client.session = firstSession;
    client.state = "LISTENING";
    client.setActiveContextVersion(2);
    client.connect = vi.fn((text, metadata) => {
      client.session = { sendClientContent: vi.fn(), close: vi.fn() };
      client.state = "CONNECTING";
      client.sendText(text, metadata);
      return Promise.resolve(true);
    });
    client.sendText("Explain the first form screen", {
      id: "decision-guide",
      narrationId: "decision-narration",
      screenId: "DECISION_MAKER",
      contextVersion: 2,
      semanticSegmentId: "decision-segment",
      priority: "TRANSITION_GUIDANCE"
    });

    await client.handleMessage({ serverContent: { turnComplete: true } });

    expect(firstSession.close).toHaveBeenCalledOnce();
    expect(client.connect).toHaveBeenCalledOnce();
    expect(client.session.sendClientContent).toHaveBeenCalledTimes(1);
    expect(client.activeTurn).toMatchObject({
      id: "decision-guide:retry",
      screenId: "DECISION_MAKER",
      guidanceRetryCount: 1
    });
    expect(completed).toHaveLength(0);
    expect(telemetry).toContain("EMMI_VOICE_GUIDANCE_RETRY");

    await client.handleMessage({ serverContent: { turnComplete: true } });

    expect(client.session.sendClientContent).toHaveBeenCalledTimes(1);
    expect(client.activeTurn).toBeNull();
    expect(completed).toHaveLength(1);
  });

  it("speaks the exact screen guidance locally after the clean retry also returns no audio", async () => {
    const completed = [];
    const telemetry = [];
    class FakeUtterance {
      constructor(text) { this.text = text; }
    }
    const synth = { cancel: vi.fn(), getVoices: vi.fn(() => [{ lang: "en-US" }]), speak: vi.fn() };
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    vi.stubGlobal("speechSynthesis", synth);
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN", currentScreen: "IDENTITY_VERIFICATION" }),
      onTurnComplete: turn => completed.push(turn),
      onVoiceTelemetry: type => telemetry.push(type)
    });
    client.session = { sendClientContent: vi.fn() };
    client.state = "LISTENING";
    client.setActiveContextVersion(3);
    client.sendText("provider prompt", {
      id: "identity-retry", screenId: "IDENTITY_VERIFICATION", contextVersion: 3,
      priority: "SCREEN_GUIDANCE", semanticText: "Enter your date of birth and ZIP code, then choose Continue.", guidanceRetryCount: 1
    });

    await client.handleMessage({ serverContent: { generationComplete: true } });

    expect(synth.speak).toHaveBeenCalledOnce();
    expect(synth.speak.mock.calls[0][0].text).toBe("Enter your date of birth and ZIP code, then choose Continue.");
    expect(client.state).toBe("EMMI_SPEAKING");
    expect(telemetry).toContain("EMMI_VOICE_LOCAL_GUIDANCE_FALLBACK");
    synth.speak.mock.calls[0][0].onend();
    expect(client.state).toBe("LISTENING");
    expect(completed).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it("treats Gemini 3.1 generationComplete as the provider turn boundary", async () => {
    const completed = [];
    const states = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN", currentScreen: "DECISION_MAKER" }),
      onTurnComplete: turn => completed.push(turn),
      onState: state => states.push(state)
    });
    client.state = "EMMI_SPEAKING";
    client.activeAudioGenerationId = 9;
    client.activeTurn = { id: "guide", generationId: 9, firstAudioReceivedAt: performance.now() };

    await client.handleMessage({ serverContent: { generationComplete: true } });

    expect(client.activeTurn).toBeNull();
    expect(states.at(-1)).toBe("LISTENING");
    expect(completed).toHaveLength(1);
  });

  it("discards provider transcript fragments from an interrupted generation", async () => {
    const transcripts = [];
    const telemetry = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN" }),
      onTranscript: (role, text) => transcripts.push({ role, text }),
      onVoiceTelemetry: type => telemetry.push(type)
    });
    client.awaitingPatientResponse = true;
    client.patientResponseReady = false;
    client.activeTurn = null;

    await client.handleMessage({ serverContent: { outputTranscription: { text: "late canceled words" } } });

    expect(transcripts).toEqual([]);
    expect(telemetry).toContain("EMMI_STALE_TRANSCRIPT_DISCARDED");
  });

  it("sanitizes provider transcript payloads and carries turn metadata to the UI", async () => {
    const transcripts = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "ES", currentScreen: "GOALS" }),
      onTranscript: (role, text, final, metadata) => transcripts.push({ role, text, final, metadata })
    });
    client.activeContextVersion = 4;
    client.activeAudioGenerationId = 8;
    client.activeTurn = { generationId: 8, contextVersion: 4, screenId: "GOALS", priority: "SCREEN_GUIDANCE" };

    await client.handleMessage({ serverContent: { outputTranscription: { text: "<speech>Elija una meta.</speech>" } } });
    await client.handleMessage({ serverContent: { outputTranscription: { text: "[object Object]" } } });

    expect(transcripts).toEqual([expect.objectContaining({
      role: "assistant",
      text: "Elija una meta.",
      final: true,
      metadata: expect.objectContaining({ generationId: 8, screenId: "GOALS", priority: "SCREEN_GUIDANCE" })
    })]);
  });

  it("allocates one generation before voice-response transcript fragments arrive", async () => {
    const transcripts = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN", currentScreen: "INVITATION" }),
      onTranscript: (role, text, final, metadata) => transcripts.push({ role, text, final, metadata })
    });
    client.session = { sendClientContent: vi.fn() };
    client.awaitingPatientResponse = true;
    client.state = "USER_SPEAKING";

    await client.handleMessage({ serverContent: { inputTranscription: { text: "What would I have to pay for this program?" } } });
    const generationId = client.activeTurn.generationId;
    await client.handleMessage({ serverContent: { outputTranscription: { text: "I cannot confirm your exact cost." } } });
    await client.handleMessage({ serverContent: { outputTranscription: { text: "Your care team can review it with you." } } });

    expect(generationId).toBeGreaterThan(0);
    expect(transcripts.map(item => item.metadata.generationId)).toEqual([generationId, generationId, generationId]);
    expect(client.state).toBe("EMMI_THINKING");
  });

  it("speaks a safe recovery when a barge-in produces no transcript", () => {
    vi.useFakeTimers();
    const states = [];
    const telemetry = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN" }),
      onState: (state, detail) => states.push({ state, detail }),
      onVoiceTelemetry: type => telemetry.push(type),
      transcriptWaitTimeoutMs: 50
    });
    client.session = { sendClientContent: vi.fn() };
    client.awaitingPatientResponse = true;
    client.state = "USER_SPEAKING";

    client.handlePatientSpeechEnd({ source: "local_vad", durationMs: 400 });
    vi.advanceTimersByTime(50);

    expect(client.awaitingPatientResponse).toBe(false);
    expect(states.at(-1).state).toBe("EMMI_THINKING");
    expect(client.session.sendClientContent).toHaveBeenCalledWith(expect.objectContaining({
      turns: expect.stringContaining("If this may be a medical emergency, call 911 now")
    }));
    expect(telemetry).toContain("EMMI_MISSING_TRANSCRIPT_RECOVERED");
    vi.useRealTimers();
  });

  it("processes a same-message interruption before its patient transcript", async () => {
    const transcripts = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "ES", currentScreen: "INVITATION" }),
      onTranscript: (role, text, final, metadata) => transcripts.push({ role, text, final, metadata })
    });
    client.activeContextVersion = 2;
    client.activeAudioGenerationId = 7;
    client.activeTurn = { id: "welcome", generationId: 7, contextVersion: 2, priority: "SCREEN_GUIDANCE" };
    client.state = "EMMI_SPEAKING";

    await client.handleMessage({ serverContent: {
      interrupted: true,
      inputTranscription: { text: "¿ACCESS reemplaza a mi médico?" }
    } });

    expect(client.interruptedGenerationIds.has(7)).toBe(true);
    expect(client.activeTurn).toEqual(expect.objectContaining({
      priority: "PATIENT_RESPONSE",
      responseToInterruption: true
    }));
    expect(client.activeTurn.generationId).not.toBe(7);
    expect(client.awaitingPatientResponse).toBe(false);
    expect(client.state).toBe("EMMI_THINKING");
    expect(transcripts).toEqual([expect.objectContaining({
      role: "user",
      text: "¿ACCESS reemplaza a mi médico?",
      metadata: expect.objectContaining({ generationId: client.activeTurn.generationId })
    })]);
  });

  it("keeps a transcript-first barge-in when the provider interruption event arrives later", async () => {
    const transcripts = [];
    const telemetry = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "ES", currentScreen: "INVITATION" }),
      onTranscript: (role, text, final, metadata) => transcripts.push({ role, text, final, metadata }),
      onVoiceTelemetry: type => telemetry.push(type)
    });
    client.activeContextVersion = 3;
    client.activeAudioGenerationId = 11;
    client.activeTurn = { id: "welcome", generationId: 11, contextVersion: 3, priority: "SCREEN_GUIDANCE" };
    client.state = "EMMI_SPEAKING";

    await client.handleMessage({ serverContent: {
      inputTranscription: { text: "Espere, tengo una duda." }
    } });
    const responseGenerationId = client.activeTurn.generationId;
    await client.handleMessage({ serverContent: { interrupted: true } });

    expect(client.interruptedGenerationIds.has(11)).toBe(true);
    expect(client.activeTurn).toEqual(expect.objectContaining({
      generationId: responseGenerationId,
      priority: "PATIENT_RESPONSE",
      responseToInterruption: true
    }));
    expect(transcripts).toHaveLength(1);
    expect(telemetry).toContain("EMMI_DUPLICATE_PROVIDER_INTERRUPTION_IGNORED");
  });

  it("tracks ordinary speech while listening and asks safely for a repeat if ASR returns no transcript", () => {
    vi.useFakeTimers();
    const states = [];
    const telemetry = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "ES" }),
      onState: (state, detail) => states.push({ state, detail }),
      onVoiceTelemetry: type => telemetry.push(type),
      transcriptWaitTimeoutMs: 50
    });
    client.session = { sendClientContent: vi.fn() };
    client.state = "LISTENING";

    expect(client.handlePatientSpeechStart({ source: "local_vad", detectedAt: 10 })).toBe(false);
    expect(client.awaitingPatientResponse).toBe(true);
    expect(states.at(-1).state).toBe("USER_SPEAKING");
    client.handlePatientSpeechEnd({ source: "local_vad", durationMs: 700 });
    vi.advanceTimersByTime(50);

    expect(client.awaitingPatientResponse).toBe(false);
    expect(states.at(-1).state).toBe("EMMI_THINKING");
    expect(client.session.sendClientContent).toHaveBeenCalledWith(expect.objectContaining({
      turns: expect.stringContaining("Please say it again")
    }));
    expect(telemetry).toContain("EMMI_MISSING_TRANSCRIPT_RECOVERED");
    vi.useRealTimers();
  });

  it("turns a stalled provider turn into a recoverable timeout instead of permanent Thinking", () => {
    vi.useFakeTimers();
    const errors = [];
    const states = [];
    const telemetry = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN", currentScreen: "INVITATION" }),
      onError: code => errors.push(code),
      onState: state => states.push(state),
      onVoiceTelemetry: type => telemetry.push(type),
      turnStallTimeoutMs: 75
    });
    client.session = { sendClientContent: vi.fn(), close: vi.fn() };

    expect(client.sendText("Explain ACCESS", { id: "welcome" })).toBe(true);
    vi.advanceTimersByTime(75);

    expect(errors).toEqual(["VOICE_RESPONSE_TIMEOUT"]);
    expect(telemetry).toContain("EMMI_VOICE_TURN_TIMEOUT");
    expect(client.activeTurn).toBeNull();
    expect(states.at(-1)).toBe("DISCONNECTED");
    vi.useRealTimers();
  });

  it("ends silent screen guidance at an absolute start deadline without showing an error", () => {
    vi.useFakeTimers();
    const errors = [];
    const states = [];
    const telemetry = [];
    const completed = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN", currentScreen: "DECISION_MAKER" }),
      onError: code => errors.push(code),
      onState: state => states.push(state),
      onTurnComplete: turn => completed.push(turn),
      onVoiceTelemetry: type => telemetry.push(type),
      turnStallTimeoutMs: 1000,
      guidanceStartTimeoutMs: 75
    });
    client.session = { sendClientContent: vi.fn(), close: vi.fn() };
    client.connect = vi.fn((text, metadata) => {
      client.session = { sendClientContent: vi.fn(), close: vi.fn() };
      client.state = "CONNECTING";
      client.sendText(text, metadata);
      return Promise.resolve(true);
    });

    expect(client.sendText("Explain this screen", { id: "screen-two", priority: "SCREEN_GUIDANCE" })).toBe(true);
    // Transcript activity before audio used to renew the full stall timeout indefinitely.
    vi.advanceTimersByTime(50);
    client.touchTurnWatchdog(client.activeTurn.generationId);
    vi.advanceTimersByTime(25);

    expect(completed).toHaveLength(0);
    expect(telemetry).toContain("EMMI_VOICE_GUIDANCE_RETRY");
    expect(client.activeTurn.guidanceRetryCount).toBe(1);
    expect(client.connect).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(75);

    expect(errors).toEqual([]);
    expect(completed).toHaveLength(1);
    expect(telemetry).toContain("EMMI_VOICE_GUIDANCE_TIMEOUT_RECOVERED");
    expect(client.activeTurn).toBeNull();
    expect(states.at(-1)).toBe("LISTENING");
    vi.useRealTimers();
  });

  it("gives a typed patient question a clean generation while voice guidance is speaking", () => {
    const bargeIns = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "ES", currentScreen: "WHO" }),
      onBargeIn: details => bargeIns.push(details)
    });
    client.session = { sendClientContent: vi.fn() };
    client.activeContextVersion = 4;
    client.activeAudioGenerationId = 15;
    client.activeTurn = { id: "screen-guide", generationId: 15, contextVersion: 4, priority: "SCREEN_GUIDANCE" };
    client.state = "EMMI_SPEAKING";
    client.stopPlayback = vi.fn();

    expect(client.sendText("Tengo una duda", {
      id: "patient-question",
      contextVersion: 4,
      priority: "PATIENT_RESPONSE"
    })).toBe(true);

    expect(client.interruptedGenerationIds.has(15)).toBe(true);
    expect(client.stopPlayback).toHaveBeenCalledWith({ fadeMs: 40 });
    expect(bargeIns).toHaveLength(1);
    expect(bargeIns[0]).toEqual(expect.objectContaining({ source: "text_input", previousGenerationId: 15 }));
    expect(client.activeTurn).toEqual(expect.objectContaining({
      id: "patient-question",
      priority: "PATIENT_RESPONSE",
      responseToInterruption: true
    }));
    expect(client.activeTurn.generationId).not.toBe(15);
    expect(client.awaitingPatientResponse).toBe(false);
  });

  it("does not let a late provider interruption cancel the typed replacement turn", async () => {
    const telemetry = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN", currentScreen: "INVITATION" }),
      onVoiceTelemetry: type => telemetry.push(type)
    });
    client.session = { sendClientContent: vi.fn() };
    client.activeContextVersion = 6;
    client.activeAudioGenerationId = 21;
    client.activeTurn = { id: "long-guidance", generationId: 21, contextVersion: 6, priority: "SCREEN_GUIDANCE" };
    client.state = "EMMI_SPEAKING";
    client.stopPlayback = vi.fn();

    expect(client.sendText("Before you continue, is participation voluntary?", {
      id: "typed-interruption",
      contextVersion: 6,
      priority: "PATIENT_RESPONSE"
    })).toBe(true);
    const replacementGenerationId = client.activeTurn.generationId;

    await client.handleMessage({ serverContent: { interrupted: true } });

    expect(client.activeTurn).toEqual(expect.objectContaining({
      id: "typed-interruption",
      generationId: replacementGenerationId,
      priority: "PATIENT_RESPONSE",
      responseToInterruption: true
    }));
    expect(client.awaitingPatientResponse).toBe(false);
    expect(telemetry).toContain("EMMI_DUPLICATE_PROVIDER_INTERRUPTION_IGNORED");
  });

  it("asks for clarification when ASR reports an unexpected language", async () => {
    const telemetry = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN", currentScreen: "INVITATION" }),
      onVoiceTelemetry: (type, details) => telemetry.push({ type, details })
    });
    client.session = { sendClientContent: vi.fn() };

    await client.handleMessage({ serverContent: { inputTranscription: { text: "Necesito ayuda con mi presión y mi médico." } } });

    expect(telemetry).toContainEqual(expect.objectContaining({ type: "EMMI_ASR_CLARIFICATION_REQUIRED" }));
    expect(client.session.sendClientContent).toHaveBeenCalledWith(expect.objectContaining({
      turns: expect.stringContaining("TRUSTED ASR SAFETY OVERRIDE"),
      turnComplete: false
    }));
  });

  it("marks a low-information interruption fragment so the UI cannot treat it as patient intent", async () => {
    const transcripts = [];
    const telemetry = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN", currentScreen: "INVITATION" }),
      onTranscript: (role, text, final, metadata) => transcripts.push({ role, text, final, metadata }),
      onVoiceTelemetry: (type, details) => telemetry.push({ type, details })
    });
    client.session = { sendClientContent: vi.fn() };
    client.currentInterruption = { source: "local_vad", previousGenerationId: 3 };

    await client.handleMessage({ serverContent: { inputTranscription: { text: "ball" } } });

    expect(transcripts).toContainEqual(expect.objectContaining({
      role: "user",
      text: "ball",
      metadata: expect.objectContaining({
        transcriptReliability: "CLARIFICATION_REQUIRED",
        transcriptReliabilityReason: "low_information_interruption"
      })
    }));
    expect(telemetry).toContainEqual(expect.objectContaining({ type: "EMMI_ASR_CLARIFICATION_REQUIRED" }));
    expect(client.session.sendClientContent).toHaveBeenCalledWith(expect.objectContaining({
      turns: expect.stringContaining("Please say it again"),
      turnComplete: false
    }));
  });

  it("suppresses answers and tool execution for an unreliable ordinary voice fragment", async () => {
    const transcripts = [];
    const executeTool = vi.fn();
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN", currentScreen: "INVITATION" }),
      executeTool,
      onTranscript: (role, text) => transcripts.push({ role, text })
    });
    client.session = { sendClientContent: vi.fn(), sendToolResponse: vi.fn() };

    await client.handleMessage({ serverContent: { inputTranscription: { text: "Chinese small lantern" } } });
    await client.handleMessage({ serverContent: { outputTranscription: { text: "Participation is voluntary." } } });
    await client.handleMessage({ toolCall: { functionCalls: [{ id: "unsafe", name: "startRefillReview", args: { medicationId: "this program" } }] } });

    expect(client.activeTurn.unreliableInput).toBe(true);
    expect(transcripts).toEqual([expect.objectContaining({ role: "user", text: "Chinese small lantern" })]);
    expect(executeTool).not.toHaveBeenCalled();
    expect(client.session.sendToolResponse).toHaveBeenCalledWith({
      functionResponses: [expect.objectContaining({ response: { error: "unreliable_voice_input" } })]
    });

    await client.handleMessage({ serverContent: { turnComplete: true } });

    expect(client.session.sendClientContent).toHaveBeenCalledWith(expect.objectContaining({
      turns: expect.stringContaining("Please say it again"),
      turnComplete: true
    }));
    expect(client.activeTurn.priority).toBe("CRITICAL_SAFETY");
  });
});
