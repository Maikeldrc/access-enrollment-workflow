// EMMI microphone capture worklet (emmi-audio-v4).
//
// Runs on the audio rendering thread and does the least work that is worth doing there:
// it accumulates the 128-sample render quanta the browser hands it into one frame the size
// the transport actually wants, and posts that frame to the main thread. Resampling, PCM
// encoding, level metering and transport all stay in the service layer, so the audio thread
// never blocks on anything that could glitch capture.
//
// Posting every 128-sample quantum instead would be roughly 375 messages a second for a
// 48 kHz device; the accumulator keeps transport bounded while remaining responsive to
// hands-free interruption (~47 frames a second).
class EmmiMicProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const requested = Number(options?.processorOptions?.frameSize);
    this.frameSize = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 1024;
    this.frame = new Float32Array(this.frameSize);
    this.offset = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    // No channel means the graph is momentarily starved (device switch, muted track). Staying
    // alive keeps the node connected so capture resumes without rebuilding the pipeline.
    if (!channel) return true;
    for (let index = 0; index < channel.length; index += 1) {
      this.frame[this.offset] = channel[index];
      this.offset += 1;
      if (this.offset < this.frameSize) continue;
      // Hand ownership of the buffer to the main thread rather than copying it, then start a
      // fresh one so the transferred frame can never be written to after it is sent.
      this.port.postMessage(this.frame.buffer, [this.frame.buffer]);
      this.frame = new Float32Array(this.frameSize);
      this.offset = 0;
    }
    return true;
  }
}

registerProcessor("emmi-mic-processor", EmmiMicProcessor);
