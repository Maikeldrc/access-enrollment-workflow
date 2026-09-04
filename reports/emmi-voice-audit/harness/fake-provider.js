// In-page test double for the Gemini Live provider and for the patient's microphone.
//
// WHAT THIS IS
//   The real application code runs unchanged: the @google/genai SDK, EmmiLiveClient, the
//   AudioWorklet capture pipeline, barge-in detection, playback scheduling, the tool orchestrator,
//   the view describers and the UI. Only two things outside the app are replaced:
//     1. window.WebSocket for generativelanguage.googleapis.com — a scripted server that speaks the
//        BidiGenerateContent wire format (setupComplete, inputTranscription, modelTurn PCM audio,
//        outputTranscription, turnComplete, interrupted, toolCall, sessionResumptionUpdate, goAway).
//     2. navigator.mediaDevices.getUserMedia — a MediaStream the harness can inject speech-like
//        audio into, so the "patient" can talk and interrupt on cue.
//
// WHAT THIS IS NOT
//   It is not a speech recognizer and not a language model. The transcript of each patient turn is
//   declared by the harness, and EMMI's reply text is scripted by the harness. Nothing this double
//   says is evidence of how the real EMMI would answer. It exists to measure the application side of
//   the cycle: what the app sends, when audio becomes audible, how interruptions stop playback,
//   which tools run, and what the patient sees.
(() => {
  const NativeWebSocket = window.WebSocket;
  const timeline = [];
  const mark = (type, detail = {}) => { timeline.push({ t: Math.round(performance.now()), at: Date.now(), type, ...detail }); };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* ------------------------------------------------------------------ patient microphone --- */
  const patient = { ctx: null, dest: null, utterances: [], installed: false };
  const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async constraints => {
    if (!constraints || !constraints.audio) return nativeGetUserMedia(constraints);
    if (!patient.ctx) {
      patient.ctx = new AudioContext();
      patient.dest = patient.ctx.createMediaStreamDestination();
      // A silent constant source keeps the stream "live" so the worklet keeps receiving quanta.
      const silent = patient.ctx.createConstantSource();
      silent.offset.value = 0;
      silent.connect(patient.dest);
      silent.start();
    }
    if (patient.ctx.state === "suspended") await patient.ctx.resume().catch(() => {});
    patient.installed = true;
    mark("fake_microphone_opened", { sampleRate: patient.ctx.sampleRate });
    return patient.dest.stream;
  };
  // Speech-like signal: a voiced fundamental with harmonics, syllabic amplitude modulation and a
  // little noise. It is loud enough for the app's local barge-in detector and for the double's VAD.
  const speechSamples = (frames, rate, level, seed) => {
    const data = new Float32Array(frames);
    let noise = seed || 1;
    for (let i = 0; i < frames; i += 1) {
      const t = i / rate;
      noise = (noise * 1103515245 + 12345) & 0x7fffffff;
      const env = 0.55 + 0.45 * Math.sin(2 * Math.PI * 4.3 * t + seed);
      const fade = Math.min(1, i / (rate * 0.03), (frames - i) / (rate * 0.05));
      const v = Math.sin(2 * Math.PI * 175 * t) + 0.5 * Math.sin(2 * Math.PI * 350 * t) + 0.25 * Math.sin(2 * Math.PI * 700 * t) + 0.12 * ((noise / 0x7fffffff) * 2 - 1);
      data[i] = level * env * fade * v / 1.9;
    }
    return data;
  };
  window.__patientSpeak = ({ durationMs = 1500, level = 0.28, id = "", transcript = "" } = {}) => {
    if (!patient.ctx || !patient.dest) throw new Error("fake microphone not opened");
    const rate = patient.ctx.sampleRate;
    const buffer = patient.ctx.createBuffer(1, Math.round(rate * durationMs / 1000), rate);
    buffer.getChannelData(0).set(speechSamples(buffer.length, rate, level, patient.utterances.length + 1));
    const source = patient.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(patient.dest);
    const startAt = patient.ctx.currentTime + 0.02;
    source.start(startAt);
    const startedAt = performance.now() + 20;
    const record = { id, transcript, startedAt: Math.round(startedAt), endsAt: Math.round(startedAt + durationMs), durationMs };
    patient.utterances.push(record);
    mark("patient_speech_scheduled", record);
    return record;
  };

  /* -------------------------------------------------- PCM synthesis for the double's voice --- */
  const pcmBase64 = (seconds, rate = 24000, level = 0.3, seed = 7) => {
    const frames = Math.max(1, Math.round(seconds * rate));
    const samples = speechSamples(frames, rate, level, seed);
    const bytes = new Uint8Array(frames * 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < frames; i += 1) view.setInt16(i * 2, clamp(samples[i], -1, 1) * 0x7fff, true);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return btoa(binary);
  };

  /* ------------------------------------------------------------------- the fake provider --- */
  class FakeLiveServer {
    constructor() {
      this.options = {
        silenceMs: 1200,          // what the ephemeral token locks the real provider to
        vadRms: 0.02,             // energy threshold on the 16 kHz PCM the app sends
        firstAudioDelayMs: 550,   // simulated model time to first audio after end of speech
        chunkMs: 240,             // audio chunk size streamed to the app
        wordsPerSecond: 2.4,      // calm senior-friendly pace used to size the synthetic audio
        toolLatencyMs: 0,
        respondToText: true,      // app-initiated text turns produce a spoken reply, as Gemini does
        transcribe: true,         // set false to simulate a provider that returns no transcript
        respond: true             // set false to simulate a provider that never answers
      };
      this.script = [];           // { transcript, response } consumed in order by spoken turns
      this.textScript = [];       // responses for app-initiated text turns that are not narration
      this.log = [];
      this.audioLog = [];
      this.sockets = new Set();
      this.sessionCount = 0;
      this.active = null;
      this.setup = null;
      this.reset();
      setInterval(() => this.checkSilence(), 60);
    }
    reset() {
      this.speech = { active: false, lastSpeechAt: 0, startedAt: 0 };
      this.generation = null;
      this.pendingTool = null;
      this.audioBytes = 0;
    }
    entry(entry) { this.log.push({ t: Math.round(performance.now()), at: Date.now(), ...entry }); }
    attach(socket) { this.sessionCount += 1; socket.sessionIndex = this.sessionCount; this.sockets.add(socket); this.active = socket; this.entry({ dir: "socket", type: "open", session: socket.sessionIndex }); }
    detach(socket) { this.sockets.delete(socket); this.entry({ dir: "socket", type: "close", session: socket.sessionIndex }); if (this.active === socket) { this.active = null; this.cancelGeneration("socket_closed"); } }
    emit(payload, meta = {}) {
      const socket = this.active;
      if (!socket || socket.readyState !== 1) return false;
      this.entry({ dir: "out", type: Object.keys(payload)[0], ...meta });
      socket.emit(payload);
      return true;
    }
    receive(socket, message) {
      const type = message.setup ? "setup"
        : message.realtimeInput?.audio ? "audio"
          : message.realtimeInput?.text != null ? "text"
            : message.realtimeInput?.activityStart ? "activityStart"
              : message.realtimeInput?.activityEnd ? "activityEnd"
                : message.clientContent ? "clientContent"
                  : message.toolResponse ? "toolResponse"
                    : Object.keys(message)[0];
      if (type === "setup") {
        this.reset();
        this.setup = message.setup;
        const declarations = (message.setup.tools || []).flatMap(tool => tool.functionDeclarations || []);
        this.entry({ dir: "in", type, session: socket.sessionIndex, systemInstructionChars: JSON.stringify(message.setup.systemInstruction || "").length, toolCount: declarations.length, realtimeInputConfig: message.setup.realtimeInputConfig || null, sessionResumption: message.setup.sessionResumption || null });
        setTimeout(() => {
          this.emit({ setupComplete: {} });
          this.emit({ sessionResumptionUpdate: { newHandle: `fake-handle-${socket.sessionIndex}`, resumable: true } });
        }, 40);
        return;
      }
      if (type === "audio") return this.onAudio(message.realtimeInput.audio);
      if (type === "text") { this.entry({ dir: "in", type, text: String(message.realtimeInput.text).slice(0, 6000), contextEnvelope: /TRUSTED LIVE CONTEXT UPDATE/.test(message.realtimeInput.text), narration: /NARRATION_TEXT=/.test(message.realtimeInput.text), recovery: /TRUSTED (AUDIO RECOVERY|ASR SAFETY OVERRIDE)/.test(message.realtimeInput.text) }); return this.onText(String(message.realtimeInput.text)); }
      if (type === "clientContent") { this.entry({ dir: "in", type, text: JSON.stringify(message.clientContent).slice(0, 4000) }); return; }
      if (type === "toolResponse") { this.entry({ dir: "in", type, responses: JSON.stringify(message.toolResponse.functionResponses || []).slice(0, 6000) }); return this.onToolResponse(message.toolResponse); }
      this.entry({ dir: "in", type });
    }
    onAudio(blob) {
      const bytes = Uint8Array.from(atob(blob.data), char => char.charCodeAt(0));
      this.audioBytes += bytes.length;
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const count = bytes.length >> 1;
      let sum = 0;
      for (let i = 0; i < count; i += 1) { const v = view.getInt16(i * 2, true) / 32768; sum += v * v; }
      const rms = Math.sqrt(sum / Math.max(1, count));
      const now = performance.now();
      if (this.audioLog.length < 20000) this.audioLog.push({ t: Math.round(now), rms: Number(rms.toFixed(3)), bytes: bytes.length });
      if (rms >= this.options.vadRms) {
        this.speech.lastSpeechAt = now;
        if (!this.speech.active) {
          this.speech.active = true;
          this.speech.startedAt = now;
          this.entry({ dir: "vad", type: "speech_start", generating: Boolean(this.generation) });
          if (this.generation) {
            this.cancelGeneration("barge_in");
            this.emit({ serverContent: { interrupted: true } }, { reason: "barge_in" });
          }
        }
      }
    }
    checkSilence() {
      if (!this.speech.active) return;
      const now = performance.now();
      if (now - this.speech.lastSpeechAt < this.options.silenceMs) return;
      this.speech.active = false;
      const durationMs = Math.round(this.speech.lastSpeechAt - this.speech.startedAt);
      this.entry({ dir: "vad", type: "speech_end", durationMs, speechLastAt: Math.round(this.speech.lastSpeechAt) });
      this.completeUserTurn({ source: "audio", speechLastAt: this.speech.lastSpeechAt });
    }
    completeUserTurn({ source, speechLastAt }) {
      const entry = this.script.shift() || { transcript: "", response: null };
      const transcript = entry.transcript || "";
      if (this.options.transcribe && transcript) {
        this.entry({ dir: "asr", type: "input_transcription", text: transcript });
        this.emit({ serverContent: { inputTranscription: { text: transcript } } }, { text: transcript });
      } else this.entry({ dir: "asr", type: "input_transcription_withheld", text: transcript });
      if (!this.options.respond) { this.entry({ dir: "model", type: "response_withheld" }); return; }
      this.generate(entry.response || { text: this.options.defaultResponse || "Disculpe, no le entendí bien. ¿Puede repetirlo?" }, { source, speechLastAt, transcript });
    }
    onText(text) {
      if (!this.options.respondToText) return;
      let response = null;
      const narration = text.match(/NARRATION_TEXT=("(?:[^"\\]|\\.)*")/);
      const sayOnly = text.match(/Say only:\s*"([^"]+)"/);
      if (narration) { try { response = { text: JSON.parse(narration[1]), kind: "narration" }; } catch { response = { text: narration[1], kind: "narration" }; } }
      else if (sayOnly) response = { text: sayOnly[1], kind: "recovery" };
      else {
        const scripted = this.textScript.shift();
        response = scripted?.response || { text: this.options.textDefault || "Entendido.", kind: "text_turn" };
      }
      this.generate(response, { source: "text", speechLastAt: performance.now(), transcript: text.replace(/\[TRUSTED[^\]]*\]\s*/g, "").slice(0, 200) });
    }
    onToolResponse(toolResponse) {
      const pending = this.pendingTool;
      if (!pending) return;
      this.pendingTool = null;
      pending.resolve(toolResponse.functionResponses || []);
    }
    cancelGeneration(reason) {
      const generation = this.generation;
      if (!generation) return;
      generation.cancelled = reason;
      generation.timers.forEach(timer => clearTimeout(timer));
      this.generation = null;
      this.entry({ dir: "model", type: "generation_cancelled", reason, sentChunks: generation.sentChunks, totalChunks: generation.totalChunks });
      if (this.pendingTool?.generation === generation) this.pendingTool = null;
    }
    async generate(response, meta) {
      const generation = { id: `gen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, timers: [], sentChunks: 0, totalChunks: 0, cancelled: "" };
      this.generation = generation;
      this.entry({ dir: "model", type: "generation_started", generationId: generation.id, source: meta.source, transcript: meta.transcript, kind: response.kind || "reply" });
      const wait = ms => new Promise(resolve => { const timer = setTimeout(resolve, ms); generation.timers.push(timer); });
      await wait(this.options.firstAudioDelayMs);
      if (generation.cancelled || this.generation !== generation) return;
      let text = response.text || "";
      let toolResults = [];
      for (const call of response.toolCalls || []) {
        const id = `call_${Math.random().toString(36).slice(2, 8)}`;
        this.entry({ dir: "model", type: "tool_call", name: call.name, args: call.args || {} });
        const responses = await new Promise(resolve => {
          this.pendingTool = { generation, resolve };
          this.emit({ toolCall: { functionCalls: [{ id, name: call.name, args: call.args || {} }] } }, { name: call.name });
        });
        if (generation.cancelled || this.generation !== generation) return;
        toolResults.push(...responses);
        await wait(this.options.toolLatencyMs);
        if (typeof call.then === "string") { try { call.then = new Function("results", "all", "view", call.then); } catch (error) { text = `Script error: ${error?.message || error}`; call.then = null; } }
        if (typeof call.then === "function") {
          try { const results = responses.map(item => item.response?.result ?? item.response); const next = call.then(results, toolResults, results[0]?.currentView || results[0]); if (typeof next === "string") text = next; else if (next && typeof next === "object") { if (next.text) text = next.text; if (next.toolCalls) (response.toolCalls ||= []).push(...next.toolCalls); } }
          catch (error) { text = `Script error: ${error?.message || error}`; }
        }
      }
      if (!text) { this.entry({ dir: "model", type: "generation_empty", generationId: generation.id }); this.generation = null; this.emit({ serverContent: { turnComplete: true } }, { generationId: generation.id, empty: true }); return; }
      const words = text.split(/\s+/).filter(Boolean);
      const seconds = Math.max(0.6, words.length / this.options.wordsPerSecond);
      const chunkSeconds = this.options.chunkMs / 1000;
      const chunks = Math.max(1, Math.ceil(seconds / chunkSeconds));
      generation.totalChunks = chunks;
      const wordsPerChunk = Math.max(1, Math.ceil(words.length / chunks));
      this.entry({ dir: "model", type: "first_audio", generationId: generation.id, text, seconds: Number(seconds.toFixed(2)), chunks });
      for (let index = 0; index < chunks; index += 1) {
        if (generation.cancelled || this.generation !== generation) return;
        const audio = pcmBase64(Math.min(chunkSeconds, seconds - index * chunkSeconds), 24000, 0.3, index + 3);
        const piece = words.slice(index * wordsPerChunk, (index + 1) * wordsPerChunk).join(" ");
        const payload = { serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: audio } }] } } };
        this.emit(payload, { generationId: generation.id, chunk: index + 1 });
        generation.sentChunks += 1;
        if (piece) this.emit({ serverContent: { outputTranscription: { text: `${piece} ` } } }, { generationId: generation.id, text: piece });
        // Real-time pacing with a small lead so the app's playback queue never starves.
        if (index < chunks - 1) await wait(index === 0 ? this.options.chunkMs * 0.5 : this.options.chunkMs);
      }
      if (generation.cancelled || this.generation !== generation) return;
      this.generation = null;
      this.emit({ serverContent: { generationComplete: true } }, { generationId: generation.id });
      this.emit({ serverContent: { turnComplete: true } }, { generationId: generation.id });
      this.entry({ dir: "model", type: "generation_complete", generationId: generation.id });
    }
    goAway(timeLeft = "10s") { this.emit({ goAway: { timeLeft } }, { timeLeft }); }
    dropConnection() { const socket = this.active; if (!socket) return false; socket.readyState = 3; this.detach(socket); setTimeout(() => socket.onclose?.({ code: 1006, reason: "simulated_drop" }), 0); return true; }
  }
  const server = new FakeLiveServer();

  class FakeSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.onopen = null; this.onmessage = null; this.onerror = null; this.onclose = null;
      server.attach(this);
      setTimeout(() => { if (this.readyState !== 0) return; this.readyState = 1; this.onopen?.({}); }, 30);
    }
    send(data) { try { server.receive(this, JSON.parse(data)); } catch (error) { server.entry({ dir: "in", type: "unparseable", error: String(error) }); } }
    close() { if (this.readyState === 3) return; this.readyState = 3; server.detach(this); setTimeout(() => this.onclose?.({ code: 1000, reason: "closed" }), 0); }
    emit(payload) { if (this.readyState !== 1) return; this.onmessage?.({ data: JSON.stringify(payload) }); }
  }
  window.WebSocket = new Proxy(NativeWebSocket, {
    construct(target, args) {
      const url = String(args[0] || "");
      if (/generativelanguage\.googleapis\.com\/+ws\//.test(url)) { mark("fake_socket_created", { url: url.replace(/access_token=.*$/, "access_token=…") }); return new FakeSocket(url); }
      return new target(...args);
    }
  });
  window.__fakeLive = server;
  window.__harness = {
    timeline, mark,
    patientUtterances: patient.utterances,
    providerLog: () => server.log,
    audioLog: () => server.audioLog,
    voiceEvents: () => { try { return JSON.parse(sessionStorage.getItem("itera.emmi.prototype.audit.v1") || "[]").flatMap(entry => entry?.voiceEvents || []); } catch { return []; } },
    timeOrigin: performance.timeOrigin
  };
})();
