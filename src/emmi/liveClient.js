import { GoogleGenAI, Modality } from "@google/genai";
import { EMMI_CONFIG } from "./config.js";
import { EMMI_TOOL_DECLARATIONS } from "./tools.js";
import { buildEmmiSystemInstruction } from "./systemPrompt.js";

const bytesToBase64 = bytes => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
};
const base64ToBytes = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const resample = (input, fromRate, toRate) => {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const output = new Float32Array(Math.round(input.length / ratio));
  for (let i = 0; i < output.length; i += 1) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(input.length - 1, left + 1);
    const mix = position - left;
    output[i] = input[left] * (1 - mix) + input[right] * mix;
  }
  return output;
};
const pcm16 = floats => {
  const bytes = new Uint8Array(floats.length * 2);
  const view = new DataView(bytes.buffer);
  floats.forEach((sample, index) => view.setInt16(index * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true));
  return bytes;
};

export class EmmiLiveClient {
  constructor({ getContext, executeTool, onState, onTranscript, onError }) {
    this.getContext = getContext;
    this.executeTool = executeTool;
    this.onState = onState;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.state = "DISCONNECTED";
    this.muted = false;
    this.session = null;
    this.stream = null;
    this.inputContext = null;
    this.outputContext = null;
    this.processor = null;
    this.sources = new Set();
    this.nextPlaybackAt = 0;
    this.warningTimer = null;
    this.endTimer = null;
  }
  setState(value, detail = "") { this.state = value; this.onState?.(value, detail); }
  isActive() { return !["DISCONNECTED", "ERROR"].includes(this.state); }
  // Must be called synchronously from the click that starts voice. An AudioContext created
  // later (inside a socket callback) is born suspended, so the welcome plays silently and only
  // starts working after some later user gesture resumes it.
  prepareAudioPlayback() {
    try {
      this.outputContext ||= new AudioContext({ sampleRate: 24000 });
      if (this.outputContext.state === "suspended") this.outputContext.resume();
    } catch { /* Playback falls back to the lazy path in playAudio. */ }
  }
  // The locale is baked into the session's system instruction, so a language change needs a
  // fresh session rather than a context update.
  async restartForLocale(initialText = "") {
    if (!this.isActive()) return false;
    this.stopPlayback();
    this.disconnect("locale_changed");
    await this.connect(initialText);
    return true;
  }
  async connect(initialText = "") {
    if (!EMMI_CONFIG.enableVoice) throw this.fail("voice_disabled");
    // Kreyòl has no supported live voice, so it stays a text experience rather than a silent
    // switch to English. Never treat KR as Korean.
    if (this.getContext().locale === "KR") throw this.fail("voice_locale_fallback");
    this.prepareAudioPlayback();
    const simulated = new URLSearchParams(location.search).get("emmiFailure");
    if (simulated === "microphone-denied") throw this.fail("microphone_denied");
    this.setState("CONNECTING");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch { throw this.fail("microphone_denied"); }
    if (simulated === "429") throw this.fail("rate_limited");
    if (simulated === "connection") throw this.fail("connection_failed");
    let response;
    try { response = await fetch("/api/emmi/live-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); }
    catch { throw this.fail("connection_failed"); }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw this.fail(response.status === 429 || payload.error === "rate_limited" ? "rate_limited" : payload.error || "connection_failed");
    try {
      // Ephemeral auth tokens are only served on v1alpha: the SDK routes them to
      // BidiGenerateContentConstrained, which does not exist on v1beta, so the socket never
      // opens and no audio is ever produced.
      const ai = new GoogleGenAI({ apiKey: payload.token, httpOptions: { apiVersion: "v1alpha" } });
      this.session = await ai.live.connect({
        model: payload.model || EMMI_CONFIG.model,
        config: {
          responseModalities: [Modality.AUDIO],
          thinkingConfig: { thinkingLevel: "minimal" },
          inputAudioTranscription: {}, outputAudioTranscription: {},
          systemInstruction: buildEmmiSystemInstruction(this.getContext()),
          tools: EMMI_CONFIG.enableTools ? EMMI_TOOL_DECLARATIONS : []
        },
        callbacks: {
          onopen: () => {
            this.startAudioCapture();
            this.setState("LISTENING");
            this.startTimers();
          },
          onmessage: message => this.handleMessage(message),
          onerror: error => this.fail(error?.message?.includes("429") ? "rate_limited" : "connection_failed"),
          onclose: () => { if (this.state !== "DISCONNECTED") this.disconnect("connection_lost"); }
        }
      });
      // connect() resolves once the server has acknowledged setup. Sending the welcome from
      // onopen instead sends it before the handshake finishes and the turn is dropped, which is
      // why the first tap connected but stayed silent.
      if (initialText) this.sendText(initialText);
      return true;
    } catch (error) { throw this.fail(error?.message?.includes("429") ? "rate_limited" : "connection_failed"); }
  }
  startTimers() {
    const minutes = EMMI_CONFIG.sessionMaxMinutes;
    this.warningTimer = setTimeout(() => this.onState?.(this.state, "session_ending_soon"), Math.max(1, minutes - 2) * 60 * 1000);
    this.endTimer = setTimeout(() => this.disconnect("session_timeout"), minutes * 60 * 1000);
  }
  startAudioCapture() {
    this.inputContext = new AudioContext();
    const source = this.inputContext.createMediaStreamSource(this.stream);
    this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = event => {
      if (this.muted || !this.session) return;
      const samples = event.inputBuffer.getChannelData(0);
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
      if (rms > 0.035 && this.state !== "USER_SPEAKING") { this.stopPlayback(); this.setState("USER_SPEAKING"); }
      else if (rms <= 0.02 && this.state === "USER_SPEAKING") this.setState("LISTENING");
      const data = pcm16(resample(samples, this.inputContext.sampleRate, 16000));
      this.session.sendRealtimeInput({ audio: { data: bytesToBase64(data), mimeType: "audio/pcm;rate=16000" } });
    };
    source.connect(this.processor);
    this.processor.connect(this.inputContext.destination);
  }
  async handleMessage(message) {
    const server = message.serverContent;
    if (server?.inputTranscription?.text) this.onTranscript?.("user", server.inputTranscription.text, true);
    if (server?.outputTranscription?.text) this.onTranscript?.("assistant", server.outputTranscription.text, true);
    if (server?.interrupted) { this.stopPlayback(); this.setState("LISTENING"); }
    const parts = server?.modelTurn?.parts || [];
    for (const part of parts) if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith("audio/pcm")) this.playAudio(part.inlineData.data);
    if (parts.some(part => part.inlineData?.data)) this.setState("EMMI_SPEAKING");
    if (server?.turnComplete) this.setState("LISTENING");
    const calls = message.toolCall?.functionCalls || [];
    if (calls.length) {
      this.setState("TOOL_RUNNING", calls[0].name);
      const responses = [];
      for (const call of calls) {
        try { responses.push({ id: call.id, name: call.name, response: { result: await this.executeTool(call.name, call.args || {}) } }); }
        catch { responses.push({ id: call.id, name: call.name, response: { error: "tool_unavailable" } }); }
      }
      this.session?.sendToolResponse({ functionResponses: responses });
      this.setState("EMMI_THINKING");
    }
  }
  playAudio(encoded) {
    this.prepareAudioPlayback();
    if (!this.outputContext) return;
    const bytes = base64ToBytes(encoded);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const buffer = this.outputContext.createBuffer(1, Math.floor(bytes.byteLength / 2), 24000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) channel[i] = view.getInt16(i * 2, true) / 0x8000;
    const source = this.outputContext.createBufferSource();
    source.buffer = buffer; source.connect(this.outputContext.destination);
    const startAt = Math.max(this.outputContext.currentTime, this.nextPlaybackAt);
    source.start(startAt); this.nextPlaybackAt = startAt + buffer.duration; this.sources.add(source);
    source.onended = () => this.sources.delete(source);
  }
  stopPlayback() { this.sources.forEach(source => { try { source.stop(); } catch { /* Already stopped. */ } }); this.sources.clear(); this.nextPlaybackAt = 0; }
  // Text has to go through sendClientContent: sendRealtimeInput only carries audio blobs, so a
  // text turn sent that way is accepted silently and never produces a spoken reply.
  sendText(text) { if (!this.session) return false; this.setState("EMMI_THINKING"); this.session.sendClientContent({ turns: text, turnComplete: true }); return true; }
  setMuted(value) { this.muted = value; this.onState?.(this.state, value ? "muted" : "unmuted"); }
  disconnect(reason = "ended") {
    clearTimeout(this.warningTimer); clearTimeout(this.endTimer); this.stopPlayback();
    try { this.session?.close(); } catch { /* Already closed. */ }
    this.session = null; this.processor?.disconnect(); this.processor = null;
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    this.inputContext?.close(); this.outputContext?.close(); this.inputContext = null; this.outputContext = null;
    this.setState("DISCONNECTED", reason);
  }
  fail(code) { this.onError?.(code); this.disconnect(code); const error = new Error(code); error.code = code; return error; }
}
