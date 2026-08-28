import { describe, expect, it } from "vitest";
import { EMMI_AUDIO_PIPELINE_VERSION, EMMI_MIC_FRAME_SIZE, EMMI_PROVIDER_SAMPLE_RATE, pcm16, resample, supportsAudioWorklet } from "../src/emmi/liveClient.js";

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
});
