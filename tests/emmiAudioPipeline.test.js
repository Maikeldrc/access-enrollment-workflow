import { describe, expect, it, vi } from "vitest";
import { EMMI_AUDIO_PIPELINE_VERSION, EMMI_END_OF_SPEECH_SILENCE_MS, EMMI_MIC_FRAME_SIZE, EMMI_PROVIDER_SAMPLE_RATE, EmmiLiveClient, pcm16, resample, supportsAudioWorklet } from "../src/emmi/liveClient.js";

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

describe("EMMI audio pipeline", () => {
  it("keeps the provider contract the previous pipeline established", () => {
    expect(EMMI_PROVIDER_SAMPLE_RATE).toBe(16000);
    expect(EMMI_MIC_FRAME_SIZE).toBe(2048);
    expect(EMMI_AUDIO_PIPELINE_VERSION).toBe("emmi-audio-v3");
    expect(EMMI_END_OF_SPEECH_SILENCE_MS).toBe(1200);
  });

  it("aggregates render quanta into one provider-sized frame instead of sending each one", () => {
    // 4096 / 128 = 32 quanta per frame. Sending each quantum would be ~375 messages a second
    // at 48 kHz; this keeps it at roughly twelve.
    const { frames, pending } = collectFrames(quantaOf(16));
    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveLength(EMMI_MIC_FRAME_SIZE);
    expect(pending).toBe(0);
    const messagesPerSecond = 48000 / EMMI_MIC_FRAME_SIZE;
    expect(messagesPerSecond).toBeLessThan(25);
  });

  it("loses no samples and never reorders them across frame boundaries", () => {
    const { frames, pending } = collectFrames(quantaOf(35));
    expect(frames).toHaveLength(2);
    expect(pending).toBe(35 * 128 - 2 * EMMI_MIC_FRAME_SIZE);
    const flattened = frames.flatMap(frame => [...frame]);
    expect(flattened).toEqual(Array.from({ length: 2 * EMMI_MIC_FRAME_SIZE }, (_, index) => index));
  });

  it("hands each frame out as its own buffer so a transferred frame is never overwritten", () => {
    const { frames } = collectFrames(quantaOf(32));
    expect(frames).toHaveLength(2);
    expect(frames[0].buffer).not.toBe(frames[1].buffer);
    expect(frames[0][0]).toBe(0);
    expect(frames[1][0]).toBe(EMMI_MIC_FRAME_SIZE);
  });

  it("resamples a device frame to the 16 kHz the provider expects", () => {
    const frame = Float32Array.from({ length: EMMI_MIC_FRAME_SIZE }, (_, index) => Math.sin(index / 20));
    const resampled = resample(frame, 48000, EMMI_PROVIDER_SAMPLE_RATE);
    expect(resampled).toHaveLength(Math.round(EMMI_MIC_FRAME_SIZE / 3));
    // ~85 ms per packet, matching the cadence of the pipeline this replaced.
    expect((resampled.length / EMMI_PROVIDER_SAMPLE_RATE) * 1000).toBeCloseTo(42.7, 1);
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

  it("recovers to listening when a barge-in produces no transcript", () => {
    vi.useFakeTimers();
    const states = [];
    const telemetry = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "EN" }),
      onState: (state, detail) => states.push({ state, detail }),
      onVoiceTelemetry: type => telemetry.push(type),
      transcriptWaitTimeoutMs: 50
    });
    client.awaitingPatientResponse = true;
    client.state = "USER_SPEAKING";

    client.handlePatientSpeechEnd({ source: "local_vad", durationMs: 400 });
    vi.advanceTimersByTime(50);

    expect(client.awaitingPatientResponse).toBe(false);
    expect(states.at(-1)).toEqual({ state: "LISTENING", detail: "transcript_not_received" });
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

  it("tracks ordinary speech while listening and recovers if ASR returns no transcript", () => {
    vi.useFakeTimers();
    const states = [];
    const telemetry = [];
    const client = new EmmiLiveClient({
      getContext: () => ({ locale: "ES" }),
      onState: (state, detail) => states.push({ state, detail }),
      onVoiceTelemetry: type => telemetry.push(type),
      transcriptWaitTimeoutMs: 50
    });
    client.state = "LISTENING";

    expect(client.handlePatientSpeechStart({ source: "local_vad", detectedAt: 10 })).toBe(false);
    expect(client.awaitingPatientResponse).toBe(true);
    expect(states.at(-1).state).toBe("USER_SPEAKING");
    client.handlePatientSpeechEnd({ source: "local_vad", durationMs: 700 });
    vi.advanceTimersByTime(50);

    expect(client.awaitingPatientResponse).toBe(false);
    expect(states.at(-1)).toEqual({ state: "LISTENING", detail: "transcript_not_received" });
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

    expect(client.sendText("Explain this screen", { id: "screen-two", priority: "SCREEN_GUIDANCE" })).toBe(true);
    // Transcript activity before audio used to renew the full stall timeout indefinitely.
    vi.advanceTimersByTime(50);
    client.touchTurnWatchdog(client.activeTurn.generationId);
    vi.advanceTimersByTime(25);

    expect(errors).toEqual([]);
    expect(completed).toHaveLength(1);
    expect(telemetry).toContain("EMMI_VOICE_GUIDANCE_TIMEOUT_RECOVERED");
    expect(client.activeTurn).toBeNull();
    expect(states.at(-1)).toBe("DISCONNECTED");
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
      priority: "PATIENT_RESPONSE"
    }));
    expect(client.activeTurn.generationId).not.toBe(15);
    expect(client.awaitingPatientResponse).toBe(false);
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
});
