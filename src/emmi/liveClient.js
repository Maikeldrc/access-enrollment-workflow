import { EMMI_CONFIG } from "./config.js";
import { EMMI_TOOL_DECLARATIONS } from "./tools.js";
import { buildEmmiSystemInstruction } from "./systemPrompt.js";
import { EmmiVoiceIdentityGuard, getEmmiSpeechConfig } from "./voiceIdentity.js";
import { EmmiBargeInManager } from "./bargeInManager.js";
import { assessEmmiTranscriptReliability, emmiAsrClarificationInstruction, sanitizeEmmiAssistantTranscript, sanitizeEmmiTranscript } from "./transcript.js";

const bytesToBase64 = bytes => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
};
const base64ToBytes = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
export const resample = (input, fromRate, toRate) => {
  if (fromRate === toRate) return input;
  const source = fromRate > toRate ? lowPassForDownsampling(input, fromRate, toRate) : input;
  const ratio = fromRate / toRate;
  const output = new Float32Array(Math.round(input.length / ratio));
  for (let i = 0; i < output.length; i += 1) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(input.length - 1, left + 1);
    const mix = position - left;
    output[i] = source[left] * (1 - mix) + source[right] * mix;
  }
  return output;
};
export const lowPassForDownsampling = (input, fromRate, toRate, taps = 31) => { if (fromRate <= toRate) return input; const half = taps >> 1, cutoff = (toRate / fromRate) * .45, kernel = new Float32Array(taps); let total=0; for(let i=0;i<taps;i++){const d=i-half,s=d===0?2*cutoff:Math.sin(2*Math.PI*cutoff*d)/(Math.PI*d),w=.54-.46*Math.cos(2*Math.PI*i/(taps-1));kernel[i]=s*w;total+=kernel[i];} for(let i=0;i<taps;i++)kernel[i]/=total; const out=new Float32Array(input.length); for(let i=0;i<input.length;i++){let v=0;for(let k=0;k<taps;k++)v+=input[Math.max(0,Math.min(input.length-1,i+k-half))]*kernel[k];out[i]=v;} return out; };
// The provider contract this pipeline has to keep: 16 kHz mono PCM16, little endian, base64.
export const EMMI_PROVIDER_SAMPLE_RATE = 16000;
export const EMMI_END_OF_SPEECH_SILENCE_MS = 750;
// One captured frame at the device rate. At 48 kHz this is ~21 ms of audio, short enough for a
// natural interruption while still batching eight 128-sample AudioWorklet render quanta.
export const EMMI_MIC_FRAME_SIZE = 1024;
export const EMMI_AUDIO_PIPELINE_VERSION = "emmi-audio-v4";
export const EMMI_TURN_STALL_TIMEOUT_MS = 20000;
// Normal live guidance begins well under two seconds. A longer wait made the first form screen
// look broken whenever Gemini left a turn open without PCM; retry while the patient's attention
// is still on the screen, while retaining the single-retry guard against duplicate narration.
export const EMMI_GUIDANCE_START_TIMEOUT_MS = 3500;
export const EMMI_TRANSCRIPT_WAIT_TIMEOUT_MS = 5000;
export const EMMI_PREWARM_MAX_AGE_MS = 45000;
const EMMI_MIC_WORKLET_URL = "/audio/emmi-mic-processor.js?v=4";
// Probed on the live context rather than on AudioContext.prototype: reading `audioWorklet` off
// the prototype throws "Illegal invocation" in Chrome, which silently killed capture.
export const supportsAudioWorklet = (context, scope = globalThis) =>
  typeof scope.AudioWorkletNode === "function" && typeof context?.audioWorklet?.addModule === "function";

export const pcm16 = floats => {
  const bytes = new Uint8Array(floats.length * 2);
  const view = new DataView(bytes.buffer);
  floats.forEach((sample, index) => view.setInt16(index * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true));
  return bytes;
};

export const normalizeEmmiVoiceError = code => ({
  voice_locale_fallback: "VOICE_UNAVAILABLE_FOR_LOCALE",
  microphone_denied: "VOICE_PERMISSION_DENIED",
  token_generation_failed: "VOICE_PROVIDER_ERROR",
  gemini_not_configured: "VOICE_PROVIDER_ERROR",
  connection_failed: "VOICE_SESSION_FAILED",
  connection_lost: "VOICE_SESSION_FAILED",
  audio_worklet_unavailable: "VOICE_UNAVAILABLE_ON_DEVICE"
})[code] || code;

export class EmmiLiveClient {
  constructor({ getContext, executeTool, onState, onTranscript, onTurnComplete, onError, onVoiceIdentity, onBargeIn, onVoiceTelemetry, onSessionResumption, onReconnectNeeded, turnStallTimeoutMs = EMMI_TURN_STALL_TIMEOUT_MS, guidanceStartTimeoutMs = EMMI_GUIDANCE_START_TIMEOUT_MS, transcriptWaitTimeoutMs = EMMI_TRANSCRIPT_WAIT_TIMEOUT_MS }) {
    this.getContext = getContext;
    this.executeTool = executeTool;
    this.onState = onState;
    this.onTranscript = onTranscript;
    this.onTurnComplete = onTurnComplete;
    this.onError = onError;
    this.onVoiceIdentity = onVoiceIdentity;
    this.onBargeIn = onBargeIn;
    this.onVoiceTelemetry = onVoiceTelemetry;
    this.onSessionResumption = onSessionResumption;
    this.onReconnectNeeded = onReconnectNeeded;
    this.state = "DISCONNECTED";
    this.muted = false;
    this.session = null;
    this.stream = null;
    this.inputContext = null;
    this.audioCaptureReady = false;
    this.sdkPromise = null;
    this.prewarmTokenPromise = null;
    this.prewarmedToken = null;
    this.prewarmLocale = "";
    this.connectionPromise = null;
    this.outputContext = null;
    this.micNode = null;
    this.inputSource = null;
    // While EMMI is audible, post-AEC microphone frames are held locally until sustained human
    // speech is detected. This prevents speaker echo from reaching provider VAD without making
    // the patient press a button before interrupting. The short buffer preserves the first word.
    this.micPreroll = [];
    // Eight 48 kHz frames retain roughly 170 ms before speech—enough for the first consonant,
    // without forwarding a long tail of EMMI's own speaker audio into the patient's transcript.
    this.maxMicPrerollFrames = 8;
    this.outputSpeechCandidateFrames = 0;
    this.echoProbeActive = false;
    this.echoProbeFrames = 0;
    this.sources = new Map();
    this.nextPlaybackAt = 0;
    this.outputGain = null;
    this.activeContextVersion = 0;
    // The newest app-context update that arrived before there was a session to send it on. Only
    // ever one: an older view is never worth sending once a newer one exists.
    this.pendingContextUpdate = null;
    // True between the provider asking for a tool and the client answering. Nothing may be sent
    // on the socket in that window except the tool response itself.
    this.toolRoundTripInFlight = false;
    this.activeTurn = null;
    this.pendingConnectionTurn = null;
    this.generationSequence = 0;
    this.activeAudioGenerationId = 0;
    this.interruptedGenerationIds = new Set();
    this.awaitingPatientResponse = false;
    this.patientResponseReady = false;
    this.discardedLateChunks = 0;
    this.lastEmmiUtterance = "";
    this.lastEmmiSemanticSegment = "";
    this.lastInterruptionContext = null;
    this.currentInterruption = null;
    this.allowedGracefulTurnId = "";
    this.gracefulHandoff = null;
    this.warningTimer = null;
    this.endTimer = null;
    this.turnWatchdogTimer = null;
    this.patientTranscriptTimer = null;
    this.turnStallTimeoutMs = turnStallTimeoutMs;
    this.guidanceStartTimeoutMs = guidanceStartTimeoutMs;
    this.transcriptWaitTimeoutMs = transcriptWaitTimeoutMs;
    this.connectionSequence = 0;
    this.sessionResumptionHandle = this.getContext()?.emmiConversation?.sessionResumptionHandle || "";
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3; this.reconnectTimer = null; this.stabilityTimer = null; this.goAwayReconnectScheduled = false;
    this.audioDeviceChangeHandler = () => this.handleAudioDeviceChange();
    this.voiceIdentity = new EmmiVoiceIdentityGuard({
      sessionId: this.getContext()?.sessionId || "",
      onEvent: (type, details) => this.onVoiceIdentity?.(type, details)
    });
    this.bargeIn = new EmmiBargeInManager({
      onSpeechStart: details => this.handlePatientSpeechStart(details),
      onSpeechEnd: details => this.handlePatientSpeechEnd(details),
      onTelemetry: (type, details) => this.emitVoiceTelemetry(type, details)
    });
  }
  setState(value, detail = "") {
    this.state = value;
    // An update that arrived before the socket was open goes out as soon as there is one to send
    // it on, so a session that opens onto a screen the app already described starts up to date.
    if (value === "LISTENING" && this.session && !this.toolRoundTripInFlight && this.pendingContextUpdate) this.flushContextUpdate();
    this.onState?.(value, detail);
  }
  completeAudioCaptureStartup(detail = "") {
    // The live socket can finish its setup and accept a queued destination narration while the
    // AudioWorklet is still loading. In that case sendText() has already moved the session to
    // THINKING (or audio may already be SPEAKING). Never overwrite that active provider turn with
    // LISTENING: doing so made rapid Home -> first-form navigation look and behave as if EMMI were
    // waiting for the patient instead of delivering the new screen guidance.
    if (["DISCONNECTED", "ERROR"].includes(this.state) || !this.session) return false;
    if (this.state === "CONNECTING") this.setState("LISTENING", detail);
    this.startTimers();
    return true;
  }
  loadSdk() {
    this.sdkPromise ||= import("@google/genai").catch(error => {
      this.sdkPromise = null;
      throw error;
    });
    return this.sdkPromise;
  }
  async requestLiveToken(locale) {
    const response = await fetch("/api/emmi/live-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale })
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload, locale, fetchedAt: Date.now() };
  }
  prewarm(locale = this.getContext()?.locale) {
    const canonicalVoice = this.voiceIdentity.resolve(locale, null, { screenId: this.getContext()?.currentScreen || "", connectionId: "prewarm" });
    if (!canonicalVoice.supported) return Promise.resolve(false);
    const sdk = this.loadSdk();
    const fresh = this.prewarmedToken?.locale === canonicalVoice.locale
      && Date.now() - this.prewarmedToken.fetchedAt < EMMI_PREWARM_MAX_AGE_MS;
    if (fresh) return Promise.allSettled([sdk]).then(() => true);
    if (!this.prewarmTokenPromise || this.prewarmLocale !== canonicalVoice.locale) {
      this.prewarmLocale = canonicalVoice.locale;
      this.prewarmTokenPromise = this.requestLiveToken(canonicalVoice.locale)
        .then(result => {
          if (result.response.ok) this.prewarmedToken = result;
          return result.response.ok ? result : null;
        })
        .catch(() => null)
        .finally(() => { this.prewarmTokenPromise = null; });
    }
    return Promise.allSettled([sdk, this.prewarmTokenPromise]).then(results => results.every(result => result.status === "fulfilled"));
  }
  async takeLiveToken(locale) {
    if (this.prewarmLocale === locale && this.prewarmTokenPromise) await this.prewarmTokenPromise;
    const fresh = this.prewarmedToken?.locale === locale
      && Date.now() - this.prewarmedToken.fetchedAt < EMMI_PREWARM_MAX_AGE_MS;
    if (fresh) {
      const result = this.prewarmedToken;
      this.prewarmedToken = null;
      return result;
    }
    this.prewarmedToken = null;
    return this.requestLiveToken(locale);
  }
  clearTurnWatchdog() { clearTimeout(this.turnWatchdogTimer); this.turnWatchdogTimer = null; }
  retrySilentGuidance(turn, reason = "silent") {
    if (!turn || !["SCREEN_GUIDANCE", "TRANSITION_GUIDANCE"].includes(turn.priority) || turn.guidanceRetryCount || !turn.retryText) return false;
    const generationId = turn.generationId;
    this.interruptedGenerationIds.add(generationId);
    this.activeTurn = null;
    this.activeAudioGenerationId = 0;
    this.emitVoiceTelemetry("EMMI_VOICE_GUIDANCE_RETRY", { turnId: turn.id, generationId, reason });
    return this.sendText(turn.retryText, {
      id: `${turn.id}:retry`,
      narrationId: turn.narrationId,
      screenId: turn.screenId,
      contextVersion: turn.contextVersion,
      semanticSegmentId: turn.semanticSegmentId,
      semanticText: turn.semanticText,
      priority: turn.priority,
      contextIndependent: turn.contextIndependent,
      guidanceRetryCount: 1
    });
  }
  restartSilentGuidance(turn, reason = "start_timeout") {
    if (!turn || !["SCREEN_GUIDANCE", "TRANSITION_GUIDANCE"].includes(turn.priority) || turn.guidanceRetryCount || !turn.retryText) return false;
    const generationId = turn.generationId;
    const metadata = {
      id: `${turn.id}:retry`, narrationId: turn.narrationId, screenId: turn.screenId,
      contextVersion: turn.contextVersion, semanticSegmentId: turn.semanticSegmentId,
      semanticText: turn.semanticText, priority: turn.priority,
      contextIndependent: turn.contextIndependent, guidanceRetryCount: 1
    };
    this.interruptedGenerationIds.add(generationId);
    this.sessionResumptionHandle = "";
    this.onSessionResumption?.({ handle: "", resumable: false, reason });
    this.emitVoiceTelemetry("EMMI_VOICE_GUIDANCE_RETRY", { turnId: turn.id, generationId, reason, reconnect: true });
    this.disconnect("guidance_start_timeout", { preserveOutput: true });
    this.connect(turn.retryText, metadata).catch(() => { /* connect() publishes the patient-safe error. */ });
    return true;
  }
  touchTurnWatchdog(generationId = this.activeTurn?.generationId) {
    this.clearTurnWatchdog();
    if (!generationId || !Number.isFinite(this.turnStallTimeoutMs) || this.turnStallTimeoutMs <= 0) return;
    const turn = this.activeTurn;
    const guidanceWaitingForAudio = ["SCREEN_GUIDANCE", "TRANSITION_GUIDANCE"].includes(turn?.priority) && this.state !== "EMMI_SPEAKING";
    const elapsed = guidanceWaitingForAudio ? performance.now() - Number(turn?.clientTurnSentAt ?? performance.now()) : 0;
    const timeoutMs = guidanceWaitingForAudio && Number.isFinite(this.guidanceStartTimeoutMs)
      ? Math.max(0, this.guidanceStartTimeoutMs - elapsed)
      : this.turnStallTimeoutMs;
    this.turnWatchdogTimer = setTimeout(() => {
      if (this.activeTurn?.generationId !== generationId) return;
      const timedOut = this.activeTurn;
      this.emitVoiceTelemetry("EMMI_VOICE_TURN_TIMEOUT", { turnId: timedOut.id, generationId, state: this.state });
      this.stopPlayback({ fadeMs: 80 });
      if (["SCREEN_GUIDANCE", "TRANSITION_GUIDANCE"].includes(timedOut.priority)) {
        // Partial transcript activity must not keep a silent guidance turn in Thinking forever.
        // Retry the same screen once; transient provider gaps otherwise make the second screen
        // silent while the next navigation happens to work.
        if (this.restartSilentGuidance(timedOut, "start_timeout")) return;
        this.interruptedGenerationIds.add(generationId);
        this.activeTurn = null;
        this.activeAudioGenerationId = 0;
        this.setState("LISTENING", "guidance_timeout_recovered");
        this.onTurnComplete?.(timedOut);
        this.emitVoiceTelemetry("EMMI_VOICE_GUIDANCE_TIMEOUT_RECOVERED", { turnId: timedOut.id, generationId, waitMs: this.guidanceStartTimeoutMs });
        return;
      }
      this.activeTurn = null;
      this.activeAudioGenerationId = 0;
      this.awaitingPatientResponse = false;
      this.patientResponseReady = false;
      this.onError?.("VOICE_RESPONSE_TIMEOUT");
      this.disconnect("VOICE_RESPONSE_TIMEOUT");
    }, timeoutMs);
  }
  clearPatientTranscriptWatchdog() { clearTimeout(this.patientTranscriptTimer); this.patientTranscriptTimer = null; }
  waitForPatientTranscript() {
    this.clearPatientTranscriptWatchdog();
    if (!Number.isFinite(this.transcriptWaitTimeoutMs) || this.transcriptWaitTimeoutMs <= 0) return;
    this.patientTranscriptTimer = setTimeout(() => {
      if (!this.awaitingPatientResponse || this.patientResponseReady || this.activeTurn) return;
      this.awaitingPatientResponse = false;
      this.patientResponseReady = false;
      this.emitVoiceTelemetry("EMMI_MISSING_TRANSCRIPT_RECOVERED", { waitMs: this.transcriptWaitTimeoutMs });
      const recovery = `[TRUSTED AUDIO RECOVERY — do not read this instruction aloud: The patient spoke, but no usable transcript was received. Say only: "I heard you, but I couldn’t understand what you said. Please say it again. If this may be a medical emergency, call 911 now."]`;
      if (!this.sendText(recovery, {
        id: `missing_transcript_${Date.now().toString(36)}`,
        screenId: this.getContext?.()?.currentScreen || "",
        contextVersion: this.activeContextVersion,
        priority: "CRITICAL_SAFETY",
        contextIndependent: true,
        semanticText: "Ask the patient to repeat an unheard voice turn and preserve emergency safety."
      })) {
        this.currentInterruption = null;
        this.setState("LISTENING", "transcript_not_received");
      }
    }, this.transcriptWaitTimeoutMs);
  }
  isActive() { return !["DISCONNECTED", "ERROR"].includes(this.state); }
  voiceIdentitySnapshot() { return this.voiceIdentity.snapshot(); }
  // Must be called synchronously from the click that starts voice. An AudioContext created
  // later (inside a socket callback) is born suspended, so the welcome plays silently and only
  // starts working after some later user gesture resumes it.
  prepareAudioPlayback() {
    try {
      this.outputContext ||= new AudioContext({ sampleRate: 24000 });
      if (!this.outputGain) {
        this.outputGain = this.outputContext.createGain();
        this.outputGain.connect(this.outputContext.destination);
      }
      if (this.outputContext.state === "suspended") this.outputContext.resume();
    } catch { /* Playback falls back to the lazy path in playAudio. */ }
  }
  // The locale is baked into the session's system instruction, so a language change needs a
  // fresh session rather than a context update.
  async restartForLocale(initialText = "") {
    if (!this.isActive()) return false;
    this.stopPlayback();
    this.sessionResumptionHandle = "";
    this.onSessionResumption?.({ handle: "", resumable: false, reason: "locale_changed" });
    this.disconnect("locale_changed");
    await this.connect(initialText);
    return true;
  }
  preconnect() {
    if (this.session || this.connectionPromise) return this.connectionPromise || Promise.resolve(true);
    this.muted = true;
    return this.connect();
  }
  connect(initialText = "", metadata = {}) {
    if (this.session) {
      if (initialText) this.sendText(initialText, metadata);
      return Promise.resolve(true);
    }
    if (this.connectionPromise) {
      if (initialText) this.pendingConnectionTurn = { text: initialText, metadata: { ...metadata } };
      return this.connectionPromise;
    }
    const opening = this.openConnection(initialText, metadata);
    this.connectionPromise = opening;
    return opening.finally(() => {
      if (this.connectionPromise === opening) this.connectionPromise = null;
    });
  }
  async openConnection(initialText = "", metadata = {}) {
    if (!EMMI_CONFIG.enableVoice) throw this.fail("voice_disabled");
    // Kreyòl has no supported live voice, so it stays a text experience rather than a silent
    // switch to English. Never treat KR as Korean.
    const context = this.getContext();
    const connectionId = `emmi_voice_${++this.connectionSequence}`;
    const canonicalVoice = this.voiceIdentity.resolve(context.locale, null, { screenId: context.currentScreen, connectionId });
    if (!canonicalVoice.supported) throw this.fail("VOICE_UNAVAILABLE_FOR_LOCALE");
    this.prepareAudioPlayback();
    this.audioCaptureReady = false;
    const simulated = new URLSearchParams(location.search).get("emmiFailure");
    if (simulated === "microphone-denied") throw this.fail("VOICE_PERMISSION_DENIED");
    this.setState("CONNECTING");
    if (!this.muted) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch { throw this.fail("VOICE_PERMISSION_DENIED"); }
      navigator.mediaDevices.addEventListener?.("devicechange", this.audioDeviceChangeHandler);
    }
    if (simulated === "429") throw this.fail("rate_limited");
    if (simulated === "connection") throw this.fail("VOICE_SESSION_FAILED");
    const sdkPromise = this.loadSdk();
    let tokenResult;
    try { tokenResult = await this.takeLiveToken(canonicalVoice.locale); }
    catch { throw this.fail("VOICE_SESSION_FAILED"); }
    const { response, payload } = tokenResult;
    if (!response.ok) throw this.fail(response.status === 429 || payload.error === "rate_limited" ? "rate_limited" : normalizeEmmiVoiceError(payload.error || "connection_failed"));
    const resolvedVoice = this.voiceIdentity.resolve(context.locale, payload.voiceIdentity, { screenId: context.currentScreen, connectionId });
    if (!payload.voiceIdentity || payload.voiceIdentity.voiceId !== resolvedVoice.voiceId || payload.voiceIdentity.voiceVersion !== resolvedVoice.voiceVersion || payload.voiceIdentity.provider !== resolvedVoice.provider) throw this.fail("voice_identity_mismatch");
    this.onVoiceIdentity?.("EMMI_VOICE_SESSION_CONFIGURED", { ...resolvedVoice, sessionId: context.sessionId, screenId: context.currentScreen, connectionId });
    try {
      const { ActivityHandling, EndSensitivity, GoogleGenAI, Modality, StartSensitivity } = await sdkPromise;
      // Ephemeral auth tokens are only served on v1alpha: the SDK routes them to
      // BidiGenerateContentConstrained, which does not exist on v1beta, so the socket never
      // opens and no audio is ever produced.
      const ai = new GoogleGenAI({ apiKey: payload.token, httpOptions: { apiVersion: "v1alpha" } });
      this.session = await ai.live.connect({
        model: payload.model || EMMI_CONFIG.model,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: getEmmiSpeechConfig(resolvedVoice.locale),
          thinkingConfig: { thinkingLevel: "minimal" },
          inputAudioTranscription: {}, outputAudioTranscription: {},
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
              prefixPaddingMs: 300,
              silenceDurationMs: EMMI_END_OF_SPEECH_SILENCE_MS
            },
            activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS
          },
          systemInstruction: buildEmmiSystemInstruction(this.getContext()),
          sessionResumption: this.sessionResumptionHandle ? { handle: this.sessionResumptionHandle } : {},
          contextWindowCompression: { slidingWindow: {} },
          tools: EMMI_CONFIG.enableTools ? EMMI_TOOL_DECLARATIONS : []
        },
        callbacks: {
          onopen: () => {
            this.intentionalClose = false;
            clearTimeout(this.stabilityTimer); this.stabilityTimer = setTimeout(() => { this.reconnectAttempts = 0; }, 10000);
            if (this.muted) {
              this.audioCaptureReady = true;
              this.completeAudioCaptureStartup("muted");
              return;
            }
            this.startAudioCapture().then(() => {
              this.audioCaptureReady = true;
              this.completeAudioCaptureStartup();
            }).catch(() => {
              this.emitVoiceTelemetry("EMMI_AUDIO_PIPELINE_ERROR", { pipelineVersion: EMMI_AUDIO_PIPELINE_VERSION, reason: "worklet_unavailable" });
              this.disconnect("audio_worklet_unavailable");
            });
          },
          onmessage: message => this.handleMessage(message),
          onerror: error => this.handleProviderError(error),
          onclose: () => {
            if (this.intentionalClose || this.state === "DISCONNECTED") return;
            const canResume = Boolean(this.sessionResumptionHandle) && this.reconnectAttempts < this.maxReconnectAttempts;
            this.disconnect("connection_lost");
            if (canResume) this.scheduleReconnect("connection_lost");
          }
        }
      });
      if (this.audioCaptureReady) this.completeAudioCaptureStartup(this.muted ? "muted" : "");
      // connect() resolves once the server has acknowledged setup. Sending the welcome from
      // onopen instead sends it before the handshake finishes and the turn is dropped, which is
      // why the first tap connected but stayed silent.
      // Navigation may happen while the socket is still opening. In that case the destination
      // screen replaces the stale welcome and is sent as soon as setup is acknowledged.
      const pending = this.pendingConnectionTurn;
      this.pendingConnectionTurn = null;
      if (pending) this.sendText(pending.text, pending.metadata);
      else if (initialText) this.sendText(initialText, metadata);
      return true;
    } catch (error) { throw this.fail(error?.message?.includes("429") ? "rate_limited" : normalizeEmmiVoiceError(error?.code || "connection_failed")); }
  }
  startTimers() {
    const minutes = EMMI_CONFIG.sessionMaxMinutes;
    this.warningTimer = setTimeout(() => this.onState?.(this.state, "session_ending_soon"), Math.max(1, minutes - 2) * 60 * 1000);
    this.endTimer = setTimeout(() => this.disconnect("session_timeout"), minutes * 60 * 1000);
  }
  // Capture runs on an AudioWorklet: the deprecated ScriptProcessorNode ran its callback on the
  // main thread, so a slow render there could drop microphone frames mid-sentence.
  async startAudioCapture() {
    this.inputContext = new AudioContext();
    if (this.inputContext.state === "suspended") await this.inputContext.resume().catch(() => {});
    if (!supportsAudioWorklet(this.inputContext)) throw this.fail("VOICE_UNAVAILABLE_ON_DEVICE");
    try {
      await this.inputContext.audioWorklet.addModule(EMMI_MIC_WORKLET_URL);
    } catch {
      throw this.fail("VOICE_UNAVAILABLE_ON_DEVICE");
    }
    this.inputSource = this.inputContext.createMediaStreamSource(this.stream);
    // No outputs: unlike a ScriptProcessorNode this does not need a connection to the
    // destination to run, so the microphone is never routed back at the speakers.
    this.micNode = new AudioWorkletNode(this.inputContext, "emmi-mic-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
      processorOptions: { frameSize: EMMI_MIC_FRAME_SIZE }
    });
    this.micNode.port.onmessage = event => this.handleMicFrame(new Float32Array(event.data));
    this.inputSource.connect(this.micNode);
    this.emitVoiceTelemetry("EMMI_AUDIO_PIPELINE_STARTED", {
      pipelineVersion: EMMI_AUDIO_PIPELINE_VERSION,
      inputSampleRate: this.inputContext.sampleRate,
      providerSampleRate: EMMI_PROVIDER_SAMPLE_RATE,
      frameSize: EMMI_MIC_FRAME_SIZE,
      channels: 1
    });
  }

  // One captured frame: level metering for barge-in, then resample, encode and send. Identical
  // arithmetic to the pipeline this replaced, so interruption behaviour is unchanged.
  handleMicFrame(samples) {
    if (this.muted || !this.session || !samples.length) return;
    let sumOfSquares = 0;
    let peak = 0;
    for (const value of samples) {
      sumOfSquares += value * value;
      peak = Math.max(peak, Math.abs(value));
    }
    // Keep local speech state active while EMMI is listening too. Besides making the visible
    // state truthful, this gives us a bounded recovery path when the provider misses a transcript.
    // A turn that is only THINKING is still excluded from interruption detection below, so ambient
    // energy cannot cancel a welcome before its first PCM chunk arrives.
    const audibleOutputActive = this.sources.size > 0 || this.state === "EMMI_SPEAKING";
    const patientFloorActive = !this.activeTurn && ["LISTENING", "USER_SPEAKING"].includes(this.state);
    const rms = Math.sqrt(sumOfSquares / samples.length);
    // Once human speech has won the floor, every following frame belongs to that patient turn.
    // Re-running the echo probe during the 40 ms output fade clipped the beginning and middle of
    // barge-in phrases and produced tiny transcripts such as "ball".
    if (this.awaitingPatientResponse && this.bargeIn.speechActive) {
      this.sendMicSamples(samples);
      return;
    }
    if (!audibleOutputActive && (patientFloorActive || this.bargeIn.speechActive)) {
      this.bargeIn.observeFrame({ rms: Math.sqrt(sumOfSquares / samples.length), peak, outputActive: audibleOutputActive });
    }
    if (audibleOutputActive) {
      this.micPreroll.push(samples.slice());
      if (this.micPreroll.length > this.maxMicPrerollFrames) this.micPreroll.shift();
      // AEC is strong on phones but not perfect on every speaker/browser combination. Sustained
      // frames begin a short echo probe: duck EMMI locally, then require speech to continue while
      // her output is inaudible. Echo disappears; a real patient keeps talking.
      if (!this.echoProbeActive) {
        // Start the echo check on the first clear speech-like frame. The check itself still
        // requires continued energy after EMMI is ducked, so sensitivity here improves response
        // time without letting a single speaker frame become an interruption.
        const candidate = rms >= 0.03 && peak >= 0.06;
        this.outputSpeechCandidateFrames = candidate ? this.outputSpeechCandidateFrames + 1 : 0;
        if (this.outputSpeechCandidateFrames >= 1) this.beginEchoProbe();
        return;
      }
      this.echoProbeFrames += 1;
      const result = this.bargeIn.observeFrame({ rms, peak, outputActive: false });
      if (result === "SPEECH") {
        const buffered = this.micPreroll.splice(0);
        buffered.forEach(frame => this.sendMicSamples(frame));
        this.clearEchoProbeState();
        return;
      }
      // Three post-duck frames span roughly 64 ms at 48 kHz, long enough for room echo to decay
      // while adding only one frame of latency to a genuine spoken interruption.
      if (this.echoProbeFrames >= 3) {
        this.restoreOutputAfterEchoProbe();
        this.bargeIn.reset();
      }
      return;
    }
    if (this.echoProbeActive) this.restoreOutputAfterEchoProbe();
    this.micPreroll.length = 0;
    this.sendMicSamples(samples);
  }

  beginEchoProbe() {
    this.echoProbeActive = true;
    this.echoProbeFrames = 0;
    this.outputSpeechCandidateFrames = 0;
    const now = this.outputContext?.currentTime;
    if (this.outputGain && Number.isFinite(now)) {
      this.outputGain.gain.cancelScheduledValues(now);
      this.outputGain.gain.setValueAtTime(0, now);
    }
    this.emitVoiceTelemetry("EMMI_ECHO_PROBE_STARTED");
  }

  clearEchoProbeState() {
    this.echoProbeActive = false;
    this.echoProbeFrames = 0;
    this.outputSpeechCandidateFrames = 0;
  }

  restoreOutputAfterEchoProbe() {
    const now = this.outputContext?.currentTime;
    if (this.outputGain && Number.isFinite(now)) {
      this.outputGain.gain.cancelScheduledValues(now);
      this.outputGain.gain.setValueAtTime(1, now);
    }
    this.clearEchoProbeState();
    this.emitVoiceTelemetry("EMMI_ECHO_PROBE_REJECTED");
  }

  sendMicSamples(samples) {
    if (!this.session || !samples?.length) return false;
    const data = pcm16(resample(samples, this.inputContext.sampleRate, EMMI_PROVIDER_SAMPLE_RATE));
    this.session.sendRealtimeInput({ audio: { data: bytesToBase64(data), mimeType: `audio/pcm;rate=${EMMI_PROVIDER_SAMPLE_RATE}` } });
    return true;
  }

  // Every path that tears down capture goes through this, so a reconnect or a device switch can
  // never leave a second worklet feeding the same session.
  stopAudioCapture() {
    if (this.micNode) {
      this.micNode.port.onmessage = null;
      this.micNode.port.close?.();
      this.micNode.disconnect();
      this.micNode = null;
    }
    this.inputSource?.disconnect();
    this.inputSource = null;
  }
  async handleAudioDeviceChange() {
    if (!this.isActive() || this.muted) return;
    const currentTrack = this.stream?.getAudioTracks?.()[0];
    if (currentTrack?.readyState === "live") {
      this.emitVoiceTelemetry("EMMI_AUDIO_ROUTE_PRESERVED", { trackState: "live" });
      return;
    }
    try {
      const replacement = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      this.stopAudioCapture();
      await this.inputContext?.close();
      this.stream?.getTracks().forEach(track => track.stop());
      this.stream = replacement;
      this.inputContext = null;
      await this.startAudioCapture();
      this.emitVoiceTelemetry("EMMI_AUDIO_ROUTE_RESTORED", { sameLiveSession: true });
    } catch {
      this.emitVoiceTelemetry("EMMI_AUDIO_ROUTE_FAILED", { sameLiveSession: true });
      this.onError?.("VOICE_PERMISSION_DENIED");
    }
  }
  async handleMessage(message) {
    if (message.sessionResumptionUpdate) {
      const update = message.sessionResumptionUpdate;
      if (update.newHandle) this.sessionResumptionHandle = update.newHandle;
      this.onSessionResumption?.({ handle: this.sessionResumptionHandle, resumable: Boolean(update.resumable), lastConsumedClientMessageIndex: update.lastConsumedClientMessageIndex });
    }
    if (message.goAway) {
      this.emitVoiceTelemetry("EMMI_LIVE_GO_AWAY", { timeLeft: message.goAway.timeLeft || "" });
      this.onSessionResumption?.({ handle: this.sessionResumptionHandle, resumable: Boolean(this.sessionResumptionHandle), reason: "go_away" });
      if (this.sessionResumptionHandle && !this.goAwayReconnectScheduled) { this.goAwayReconnectScheduled = true; this.scheduleReconnect("go_away", { proactive: true }); }
    }
    const server = message.serverContent;
    // Gemini can put `interrupted` and the patient's input transcription in the same server
    // message. The interruption must be applied first. Otherwise the transcript inherits the
    // canceled assistant generation, and the subsequent interruption clears it before a response
    // can start — the exact "EMMI stopped but ignored my question" failure seen in production.
    const interruptionAlreadyApplied = Boolean(
      this.currentInterruption &&
      this.activeTurn?.responseToInterruption &&
      ["PATIENT_RESPONSE", "CRITICAL_SAFETY"].includes(this.activeTurn.priority)
    );
    if (server?.interrupted && this.muted) {
      this.emitVoiceTelemetry("EMMI_MUTED_PROVIDER_INTERRUPTION_IGNORED", { activeGenerationId: this.activeTurn?.generationId || 0 });
    } else if (server?.interrupted && !interruptionAlreadyApplied) {
      const details = this.bargeIn.confirmProviderInterruption();
      this.handlePatientSpeechStart(details, { providerConfirmed: true });
    } else if (server?.interrupted) {
      this.emitVoiceTelemetry("EMMI_DUPLICATE_PROVIDER_INTERRUPTION_IGNORED", {
        activeGenerationId: this.activeTurn?.generationId || 0
      });
    }
    if (server?.inputTranscription?.text && this.muted) {
      this.emitVoiceTelemetry("EMMI_MUTED_INPUT_TRANSCRIPT_IGNORED", { activeGenerationId: this.activeTurn?.generationId || 0 });
    } else if (server?.inputTranscription?.text) {
      // Some provider sequences deliver the transcript one message before the explicit
      // interruption event. A first patient transcript while an assistant turn is still active is
      // itself authoritative evidence that the patient has the floor. Apply the interruption now;
      // `patientResponseReady` prevents later transcript fragments from canceling the new turn.
      if (this.activeTurn && !this.patientResponseReady) {
        const details = this.bargeIn.confirmProviderInterruption();
        this.handlePatientSpeechStart(details, { providerConfirmed: true });
      }
      const assessment = assessEmmiTranscriptReliability(server.inputTranscription.text, { locale: this.getContext?.()?.locale, afterInterruption: Boolean(this.currentInterruption) });
      const inputText = assessment.text;
      if (!inputText) {
        this.emitVoiceTelemetry("EMMI_INVALID_TRANSCRIPT_DISCARDED", { role: "user" });
      } else {
        this.clearPatientTranscriptWatchdog();
        if (!this.activeTurn) {
          const responseToInterruption = Boolean(this.currentInterruption);
          this.activeAudioGenerationId = ++this.generationSequence;
          this.activeTurn = {
            id: `patient_response_${Date.now().toString(36)}`,
            contextVersion: this.activeContextVersion,
            generationId: this.activeAudioGenerationId,
            priority: "PATIENT_RESPONSE",
            contextIndependent: true,
            responseToInterruption,
            providerTurnComplete: false
          };
          this.awaitingPatientResponse = false;
          this.patientResponseReady = true;
          this.setState("EMMI_THINKING", "patient_response");
          this.touchTurnWatchdog(this.activeAudioGenerationId);
        }
        this.emitVoiceTelemetry("EMMI_INPUT_TRANSCRIPTION_RECEIVED", { receivedAt: Math.round(performance.now()) });
        if (!assessment.reliable) {
          this.activeTurn.unreliableInput = true;
          this.activeTurn.clarificationInstruction = emmiAsrClarificationInstruction(assessment);
          this.emitVoiceTelemetry("EMMI_ASR_CLARIFICATION_REQUIRED", { reason: assessment.reason, expectedLanguage: assessment.expectedLanguage, detectedLanguage: assessment.detectedLanguage });
          // Append the guard to the audio turn already in flight. Marking this as another complete
          // client turn can produce a duplicate assistant response on some Live API versions.
          this.session?.sendClientContent?.({ turns: emmiAsrClarificationInstruction(assessment), turnComplete: false });
        }
        this.onTranscript?.("user", inputText, true, { screenId: this.getContext?.()?.currentScreen || "", contextVersion: this.activeContextVersion, priority: "PATIENT_RESPONSE", generationId: this.activeAudioGenerationId, transcriptReliability: assessment.reliable ? "RELIABLE" : "CLARIFICATION_REQUIRED", transcriptReliabilityReason: assessment.reason });
        if (this.awaitingPatientResponse && !this.bargeIn.speechActive) {
          this.patientResponseReady = true;
          this.setState("EMMI_THINKING", "patient_response");
        }
      }
    }
    const acceptsOutputTranscript = Boolean(this.activeTurn) || (this.awaitingPatientResponse && this.patientResponseReady);
    if (server?.outputTranscription?.text && acceptsOutputTranscript) {
      const outputText = this.activeTurn?.unreliableInput ? "" : sanitizeEmmiAssistantTranscript(server.outputTranscription.text);
      if (!outputText) {
        this.emitVoiceTelemetry("EMMI_INVALID_TRANSCRIPT_DISCARDED", { role: "assistant", generationId: this.activeAudioGenerationId });
      } else {
        const transcriptTurn = this.activeTurn || { screenId: this.getContext?.()?.currentScreen || "", contextVersion: this.activeContextVersion, priority: "PATIENT_RESPONSE", generationId: this.activeAudioGenerationId };
        this.touchTurnWatchdog(transcriptTurn.generationId);
        this.lastEmmiUtterance = `${this.lastEmmiUtterance} ${outputText}`.trim().slice(-1200);
        if (/(call 911|llame al 911|rele 911)/i.test(outputText) && this.activeTurn) {
          this.activeTurn.priority = "CRITICAL_SAFETY";
          if (this.gracefulHandoff?.timer) { clearTimeout(this.gracefulHandoff.timer); this.gracefulHandoff.timer = null; }
        }
        this.onTranscript?.("assistant", outputText, true, transcriptTurn);
      }
    } else if (server?.outputTranscription?.text) {
      this.emitVoiceTelemetry("EMMI_STALE_TRANSCRIPT_DISCARDED", { generationId: this.activeAudioGenerationId });
    }
    const parts = server?.modelTurn?.parts || [];
    const audioParts = parts.filter(part => part.inlineData?.data && part.inlineData?.mimeType?.startsWith("audio/pcm"));
    if (audioParts.length && !this.activeTurn && (!this.awaitingPatientResponse || this.patientResponseReady || this.state === "EMMI_THINKING")) {
      this.activeAudioGenerationId = ++this.generationSequence;
      this.activeTurn = {
        id: `patient_response_${Date.now().toString(36)}`,
        contextVersion: this.activeContextVersion,
        generationId: this.activeAudioGenerationId,
        priority: "PATIENT_RESPONSE",
        contextIndependent: true,
        responseToInterruption: this.awaitingPatientResponse
      };
      this.awaitingPatientResponse = false;
      this.patientResponseReady = false;
    }
    let playedAudio = false;
    for (const part of audioParts) playedAudio = this.playAudio(part.inlineData.data, this.activeTurn) || playedAudio;
    if (playedAudio) {
      this.touchTurnWatchdog(this.activeTurn?.generationId);
      if (this.currentInterruption && this.currentInterruption.responseStartedAt == null) {
        this.currentInterruption.responseStartedAt = performance.now();
        this.emitVoiceTelemetry("EMMI_BARGE_IN_RECOVERY", {
          interruptionId: this.currentInterruption.id,
          responseLatencyMs: Math.round(this.currentInterruption.responseStartedAt - this.currentInterruption.userSpeechDetectedAt),
          previousGenerationId: this.currentInterruption.previousGenerationId
        });
      }
      this.setState("EMMI_SPEAKING", this.activeTurn?.responseToInterruption ? "patient_response" : "guidance");
    }
    if (server?.turnComplete) {
      const completed = this.activeTurn;
      if (completed) {
        completed.providerTurnComplete = true;
        completed.providerTurnCompleteAt = performance.now();
        if (completed.unreliableInput) {
          this.interruptedGenerationIds.add(completed.generationId);
          this.stopPlayback();
          this.activeTurn = null;
          this.activeAudioGenerationId = 0;
          this.clearTurnWatchdog();
          this.emitVoiceTelemetry("EMMI_UNRELIABLE_RESPONSE_SUPPRESSED", { generationId: completed.generationId });
          this.sendText(completed.clarificationInstruction || emmiAsrClarificationInstruction({ expectedLanguage: this.getContext?.()?.locale }), {
            id: `clarify_${Date.now().toString(36)}`,
            screenId: this.getContext?.()?.currentScreen || "",
            contextVersion: this.activeContextVersion,
            priority: "CRITICAL_SAFETY",
            contextIndependent: true,
            semanticText: "Ask the patient to repeat an unreliable voice turn."
          });
          return;
        }
        // Gemini Live occasionally acknowledges an automatic guidance request with no PCM at
        // all. Treat that as a silent turn and retry immediately; waiting for a watchdog cannot
        // help because, from the provider's perspective, this turn already finished.
        if (!completed.firstAudioReceivedAt && this.retrySilentGuidance(completed, "empty_provider_turn")) return;
        this.finishTurnIfDrained(completed.generationId);
      } else if (!this.awaitingPatientResponse && this.state !== "CONNECTING" && !this.pendingConnectionTurn) {
        // Setup acknowledgements can include turnComplete before the SDK has exposed the live
        // session. A destination narration may already be queued for that opening connection;
        // presenting this acknowledgement as LISTENING falsely says EMMI is waiting for speech.
        this.setState("LISTENING");
        this.finishGracefulHandoff("semantic_boundary");
      }
    }
    const calls = message.toolCall?.functionCalls || [];
    if (calls.length) {
      this.toolRoundTripInFlight = true;
      this.setState("TOOL_RUNNING", calls[0].name);
      const responses = [];
      for (const call of calls) {
        try {
          if (this.activeTurn?.unreliableInput) responses.push({ id: call.id, name: call.name, response: { error: "unreliable_voice_input" } });
          else responses.push({ id: call.id, name: call.name, response: { result: await this.executeTool(call.name, call.args || {}) } });
        }
        catch { responses.push({ id: call.id, name: call.name, response: { error: "tool_unavailable" } }); }
      }
      this.session?.sendToolResponse({ functionResponses: responses });
      // A tool call and its response are one round trip and nothing may come between them. Tools
      // that act on the screen make the screen change, which makes the app want to push a context
      // update — and a client-content message arriving while the provider is waiting for a
      // function response loses the turn: the patient asked EMMI to write something down, EMMI
      // wrote it, and then said nothing at all. The push is held for the duration and sent here.
      // The flag clears, but nothing is sent here: the provider is about to generate the reply to
      // the tool result, and a client-content message landing in that gap is what silenced it —
      // the topic was written down and EMMI said nothing about it. The held update goes out on the
      // next return to LISTENING, which is the only moment on this socket that is certainly idle.
      this.toolRoundTripInFlight = false;
      this.setState("EMMI_THINKING");
    }
  }
  playAudio(encoded, metadata = this.activeTurn) {
    if (!metadata || metadata.unreliableInput || this.awaitingPatientResponse || this.interruptedGenerationIds.has(metadata.generationId) || metadata.generationId !== this.activeAudioGenerationId) {
      this.discardedLateChunks += 1;
      this.emitVoiceTelemetry("EMMI_STALE_AUDIO_CHUNK_DISCARDED", { discardedChunkCount: this.discardedLateChunks });
      return false;
    }
    if (metadata?.contextVersion !== undefined && metadata.contextVersion !== this.activeContextVersion && metadata.id !== this.allowedGracefulTurnId) return false;
    this.prepareAudioPlayback();
    if (!this.outputContext) return;
    const bytes = base64ToBytes(encoded);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const buffer = this.outputContext.createBuffer(1, Math.floor(bytes.byteLength / 2), 24000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) channel[i] = view.getInt16(i * 2, true) / 0x8000;
    const source = this.outputContext.createBufferSource();
    source.buffer = buffer; source.connect(this.outputGain || this.outputContext.destination);
    const startAt = Math.max(this.outputContext.currentTime, this.nextPlaybackAt);
    if (!metadata.firstAudioReceivedAt) {
      metadata.firstAudioReceivedAt = performance.now();
      this.emitVoiceTelemetry("EMMI_FIRST_AUDIO_CHUNK", {
        turnId: metadata.id,
        generationId: metadata.generationId,
        firstAudioReceivedAt: Math.round(metadata.firstAudioReceivedAt),
        turnToFirstAudioMs: metadata.clientTurnSentAt ? Math.round(metadata.firstAudioReceivedAt - metadata.clientTurnSentAt) : null,
        scheduledPlaybackDelayMs: Math.round(Math.max(0, startAt - this.outputContext.currentTime) * 1000)
      });
    }
    source.start(startAt); this.nextPlaybackAt = startAt + buffer.duration; this.sources.set(source, { startAt, endAt: this.nextPlaybackAt, metadata });
    source.onended = () => { this.sources.delete(source); this.finishTurnIfDrained(metadata.generationId); };
    return true;
  }
  finishTurnIfDrained(generationId) {
    const completed = this.activeTurn;
    if (!completed || completed.generationId !== generationId || !completed.providerTurnComplete) return false;
    const pending = [...this.sources.values()].some(source => source.metadata?.generationId === generationId);
    if (pending) return false;
    this.activeTurn = null;
    this.activeAudioGenerationId = 0;
    this.clearTurnWatchdog();
    const drainedAt = performance.now();
    this.emitVoiceTelemetry("EMMI_AUDIO_TURN_DRAINED", {
      turnId: completed.id,
      generationId,
      providerToDrainMs: Math.round(drainedAt - completed.providerTurnCompleteAt),
      firstAudioToDrainMs: completed.firstAudioReceivedAt ? Math.round(drainedAt - completed.firstAudioReceivedAt) : null
    });
    if (!this.awaitingPatientResponse) {
      this.setState("LISTENING");
      this.finishGracefulHandoff("audio_drained");
      this.onTurnComplete?.(completed);
      if (completed.responseToInterruption) this.currentInterruption = null;
    }
    return true;
  }
  stopPlayback({ fadeMs = 0 } = {}) {
    this.clearEchoProbeState();
    const targetSources = [...this.sources.keys()];
    const targetGain = this.outputGain;
    const targetContext = this.outputContext;
    const stopSources = () => {
      targetSources.forEach(source => { try { source.stop(); } catch { /* Already stopped. */ } this.sources.delete(source); });
      if (!this.sources.size) this.nextPlaybackAt = 0;
      if (this.outputGain === targetGain && this.outputContext === targetContext && targetGain && targetContext) targetGain.gain.setValueAtTime(1, targetContext.currentTime);
    };
    if (fadeMs > 0 && targetGain && targetContext && targetSources.length) {
      const now = targetContext.currentTime;
      targetGain.gain.cancelScheduledValues(now);
      targetGain.gain.setValueAtTime(targetGain.gain.value, now);
      targetGain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
      setTimeout(stopSources, fadeMs);
    } else stopSources();
  }
  isOutputActive() {
    return this.sources.size > 0 || ["EMMI_SPEAKING", "EMMI_THINKING", "TOOL_RUNNING"].includes(this.state) || Boolean(this.activeTurn);
  }
  emitVoiceTelemetry(type, details = {}) {
    this.onVoiceTelemetry?.(type, {
      ...details,
      screenId: this.getContext()?.currentScreen || "",
      contextVersion: this.activeContextVersion
    });
  }
  handlePatientSpeechStart(details = {}, { providerConfirmed = false } = {}) {
    if (this.awaitingPatientResponse && !this.activeTurn) {
      this.setState("USER_SPEAKING", providerConfirmed ? "provider_vad" : "local_vad");
      return false;
    }
    const interruptedTurn = this.activeTurn;
    this.clearTurnWatchdog();
    const priority = interruptedTurn?.priority || "";
    if (priority === "CRITICAL_SAFETY" && !providerConfirmed) {
      this.emitVoiceTelemetry("EMMI_BARGE_IN_DEFERRED_FOR_CRITICAL_SAFETY", { source: details.source || "local_vad", priority });
      return false;
    }
    const outputWasActive = this.isOutputActive();
    const audibleOutputWasActive = this.sources.size > 0 || this.state === "EMMI_SPEAKING";
    if (interruptedTurn?.generationId) this.interruptedGenerationIds.add(interruptedTurn.generationId);
    this.lastEmmiSemanticSegment = interruptedTurn?.semanticText || this.lastEmmiSemanticSegment;
    this.lastInterruptionContext = {
      lastEmmiUtterance: this.lastEmmiUtterance,
      lastEmmiSemanticSegment: this.lastEmmiSemanticSegment,
      interruptedAtSegment: interruptedTurn?.semanticSegmentId || "",
      currentScreenContext: this.getContext()
    };
    this.activeTurn = null;
    this.activeAudioGenerationId = 0;
    // Track every detected patient utterance, not only barge-ins. This prevents a provider-side
    // ASR miss from leaving the interface looking active while no response can ever arrive.
    this.awaitingPatientResponse = true;
    this.patientResponseReady = false;
    const stoppedAt = performance.now();
    const fadeMs = audibleOutputWasActive ? 40 : 0;
    if (outputWasActive) this.setState("INTERRUPTING", providerConfirmed ? "provider_vad" : "local_vad");
    this.stopPlayback({ fadeMs });
    this.finishGracefulHandoff("patient_interruption");
    this.setState("USER_SPEAKING", providerConfirmed ? "provider_vad" : "local_vad");
    if (outputWasActive) {
      const interruptionId = `interruption_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const detail = {
        interruptionId,
        source: details.source || (providerConfirmed ? "provider_vad" : "local_vad"),
        priority,
        previousGenerationId: interruptedTurn?.generationId || 0,
        userSpeechDetectedAt: Math.round(details.detectedAt || stoppedAt),
        audioStoppedAt: Math.round(stoppedAt + fadeMs),
        interruptionLatencyMs: Math.max(0, Math.round(stoppedAt + fadeMs - (details.detectedAt || stoppedAt))),
        criticalSafetyInterrupted: priority === "CRITICAL_SAFETY",
        interruptedAtSegment: interruptedTurn?.semanticSegmentId || ""
      };
      this.currentInterruption = {
        id: interruptionId,
        userSpeechDetectedAt: details.detectedAt || stoppedAt,
        audioStoppedAt: stoppedAt + fadeMs,
        previousGenerationId: interruptedTurn?.generationId || 0,
        responseStartedAt: null
      };
      this.emitVoiceTelemetry("EMMI_BARGE_IN", detail);
      this.onBargeIn?.(detail);
    }
    return outputWasActive;
  }
  handlePatientSpeechEnd(details = {}) {
    if (this.awaitingPatientResponse) {
      this.lastEmmiUtterance = "";
      this.patientResponseReady = false;
      this.setState("EMMI_THINKING", "patient_response");
      this.waitForPatientTranscript();
      this.emitVoiceTelemetry("EMMI_BARGE_IN_RESPONSE_PENDING", { source: details.source || "local_vad", speechDurationMs: Math.round(details.durationMs || 0) });
    } else if (this.state === "USER_SPEAKING") this.setState("LISTENING");
  }
  setActiveContextVersion(version) { this.activeContextVersion = Number(version) || 0; }
  currentTurnMeta() { return this.activeTurn ? { ...this.activeTurn } : null; }
  beginGracefulHandoff({ nextContextVersion, allowedTurnId = "", preserve = false, maxGracefulHandoffMs = 2500 } = {}) {
    this.setActiveContextVersion(nextContextVersion);
    if (this.gracefulHandoff) this.finishGracefulHandoff("superseded");
    if (!this.activeTurn || !["EMMI_SPEAKING", "EMMI_THINKING", "TOOL_RUNNING"].includes(this.state)) {
      this.allowedGracefulTurnId = "";
      return Promise.resolve({ reason: "idle", durationMs: 0 });
    }
    this.allowedGracefulTurnId = allowedTurnId || this.activeTurn.id;
    const startedAt = Date.now();
    return new Promise(resolve => {
      const handoff = { resolve, startedAt, timer: null };
      this.gracefulHandoff = handoff;
      if (!preserve && Number.isFinite(maxGracefulHandoffMs)) {
        handoff.timer = setTimeout(() => {
          if (this.gracefulHandoff !== handoff) return;
          handoff.forcing = true;
          this.stopPlayback({ fadeMs: 80 });
          // A semantic segment should normally complete first. If it does not, reset only this
          // exceptional turn so late PCM chunks cannot be mistaken for the new screen.
          setTimeout(() => {
            if (this.gracefulHandoff !== handoff) return;
            // A context handoff must not resume the provider generation that just stalled. Start
            // the destination screen on a clean live session while retaining the click-enabled
            // browser output context.
            this.sessionResumptionHandle = "";
            this.onSessionResumption?.({ handle: "", resumable: false, reason: "context_handoff_timeout" });
            // Keep the click-activated output context alive. Closing it here means reconnect()
            // has to create a new AudioContext after the user's navigation gesture has expired;
            // browsers may suspend that new context, making this screen silent until the next
            // click even though PCM is arriving.
            this.disconnect("context_handoff_timeout", { preserveOutput: true });
            this.gracefulHandoff = null;
            this.allowedGracefulTurnId = "";
            resolve({ reason: "max_grace", durationMs: Date.now() - startedAt, forcedReconnect: true });
          }, 80);
        }, maxGracefulHandoffMs);
      }
    });
  }
  finishGracefulHandoff(reason) {
    const handoff = this.gracefulHandoff;
    if (!handoff || handoff.forcing) return;
    clearTimeout(handoff.timer);
    this.gracefulHandoff = null;
    this.allowedGracefulTurnId = "";
    handoff.resolve({ reason, durationMs: Date.now() - handoff.startedAt, forcedReconnect: false });
  }
  // THE SILENT CONTEXT CHANNEL
  //
  // A live session takes its systemInstruction once, at setup. Everything EMMI knew about the app
  // was therefore frozen at the moment the microphone opened — which was fine while a screen was a
  // screen, and stopped being fine the moment a screen became a flow the patient walks through
  // without the session ever closing. A patient who opened voice on the pickup-address step and
  // then asked "what are my options?" three screens later was answered from the address step.
  //
  // This is the fix, and it is deliberately NOT a turn: `turnComplete: false` appends to the
  // model's context and produces no generation, so the patient hears nothing, the barge-in
  // machinery sees nothing, and no watchdog is armed. It is the app telling EMMI what changed, in
  // the same way a person glancing at the screen would notice it.
  //
  // Sent immediately, including while EMMI is mid-utterance. Holding it back until she finished
  // was the first version and it was wrong: screen guidance speaks for several seconds on connect,
  // which is exactly when a patient walks on, so the updates queued and the model kept answering
  // from the screen the microphone opened on — the defect this channel exists to fix, moved rather
  // than removed. turnComplete:false appends to context and generates nothing, so there is nothing
  // to interrupt; only the patient's own audio interrupts a turn.
  //
  // The queue survives for the one case it is right for: no session yet. Then the newest state is
  // what goes out when one opens, rather than a backlog of stale ones.
  sendContextUpdate(payload, { label = "APP CONTEXT" } = {}) {
    if (!payload) return false;
    // Held back for exactly two reasons, both of them "there is nowhere to put it right now":
    // no socket yet, and a tool round trip the provider is waiting to complete. In both cases the
    // newest state goes out the moment there is somewhere to put it.
    if (!this.session || this.toolRoundTripInFlight) { this.pendingContextUpdate = { payload, label }; return false; }
    return this.flushContextUpdate({ payload, label });
  }

  flushContextUpdate(update) {
    const next = update || this.pendingContextUpdate;
    if (!next || !this.session) return false;
    this.pendingContextUpdate = null;
    const body = typeof next.payload === "string" ? next.payload : JSON.stringify(next.payload);
    try {
      this.session.sendClientContent({
        turns: `[${next.label} — this is the app telling you what the patient is looking at right now. Do not read it aloud and do not answer it. Use it for every following answer, and prefer it over anything earlier in this conversation.]
${body}`,
        turnComplete: false
      });
    } catch { return false; }
    this.emitVoiceTelemetry("EMMI_VOICE_CONTEXT_UPDATED", { label: next.label, bytes: body.length, contextVersion: this.activeContextVersion });
    return true;
  }

  // Text has to go through sendClientContent: sendRealtimeInput only carries audio blobs, so a
  // text turn sent that way is accepted silently and never produces a spoken reply.
  sendText(text, metadata = {}) {
    if (!this.session) {
      if (["CONNECTING", "LISTENING"].includes(this.state)) {
        // Keep only the latest destination. A rapid A → B → C sequence must narrate C, never
        // replay the welcome or an intermediate screen after the connection finally opens.
        // The SDK fires onopen before its connect() promise assigns `this.session`; microphone
        // startup can therefore move the UI to LISTENING while that promise is still pending.
        // LISTENING with no session is that narrow opening window, not an idle disconnected
        // session, so the destination turn must be retained rather than discarded.
        this.pendingConnectionTurn = { text, metadata: { ...metadata } };
        this.emitVoiceTelemetry("EMMI_VOICE_TURN_QUEUED_DURING_CONNECT", { screenId: metadata.screenId || "", priority: metadata.priority || "" });
        return true;
      }
      return false;
    }
    const patientInitiated = ["PATIENT_RESPONSE", "CRITICAL_SAFETY"].includes(metadata.priority);
    if (patientInitiated && this.activeTurn) {
      // A typed question is allowed while voice guidance is playing. Treat it as the same floor
      // transfer as spoken barge-in before allocating the new generation; otherwise late guidance
      // audio/transcript fragments are mislabeled as the answer and can cut off its first words.
      this.handlePatientSpeechStart({ source: "text_input", detectedAt: performance.now() }, { providerConfirmed: true });
    }
    const generationId = ++this.generationSequence;
    const turn = {
      id: metadata.id || `turn_${Date.now().toString(36)}`,
      contextVersion: metadata.contextVersion ?? this.activeContextVersion,
      ...metadata,
      generationId,
      clientTurnSentAt: performance.now(),
      providerTurnComplete: false,
      retryText: text,
      // A typed question can take the floor while guidance is still speaking. Gemini may emit
      // the provider-side `interrupted` acknowledgement after this new client turn has already
      // been sent. Keep the relationship explicit so that late acknowledgement cannot cancel
      // the replacement turn and leave the UI waiting until its watchdog fires.
      responseToInterruption: metadata.responseToInterruption ?? Boolean(patientInitiated && this.currentInterruption)
    };
    if (turn.contextVersion !== this.activeContextVersion && turn.id !== this.allowedGracefulTurnId) return false;
    this.activeTurn = turn;
    this.lastEmmiUtterance = "";
    this.activeAudioGenerationId = generationId;
    this.awaitingPatientResponse = false;
    this.patientResponseReady = false;
    this.setState("EMMI_THINKING");
    const runtime = this.getContext?.() || {};
    const continuity = runtime.emmiConversation || {};
    const liveContext = {
      conversationMode: continuity.conversationMode || "CONTINUATION",
      greetingAllowed: Boolean(continuity.greetingAllowed),
      currentScreen: runtime.currentScreen || "",
      previousScreen: continuity.previousScreen || "",
      currentStage: runtime.currentStage || "",
      currentGoal: continuity.currentGoal || runtime.activeGoal || null,
      lastUserIntent: continuity.lastUserIntent || "",
      nextBestAction: runtime.nextBestAction || null,
      // What is on the screen right now. Rides along here as well as on the silent channel,
      // because a turn the app initiates is the one moment we can be certain the model reads.
      view: runtime.view || null
    };
    const contextualTurn = `[TRUSTED LIVE CONTEXT UPDATE — do not read aloud: ${JSON.stringify(liveContext)}]\n${text}`;
    this.session.sendClientContent({ turns: contextualTurn, turnComplete: true });
    this.touchTurnWatchdog(generationId);
    this.emitVoiceTelemetry("EMMI_VOICE_TURN_SENT", { turnId: turn.id, generationId, sentAt: Math.round(turn.clientTurnSentAt), priority: turn.priority || "" });
    return true;
  }
  async setMuted(value) {
    this.muted = Boolean(value);
    if (this.muted) {
      this.stopAudioCapture();
      this.stream?.getTracks().forEach(track => track.stop());
      this.stream = null;
      this.emitVoiceTelemetry("EMMI_MICROPHONE_RELEASED", { reason: "paused" });
    } else {
      if (!this.session && this.connectionPromise) await this.connectionPromise.catch(() => false);
      if (this.session && !this.stream) {
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
          await this.startAudioCapture();
        } catch {
          this.muted = true;
          this.onError?.("VOICE_PERMISSION_DENIED");
        }
      }
    }
    this.onState?.(this.state, this.muted ? "muted" : "unmuted");
    return !this.muted;
  }
  handleProviderError(error) { const code=normalizeEmmiVoiceError(error?.message?.includes("429")?"rate_limited":"VOICE_PROVIDER_ERROR");this.onError?.(code);this.disconnect(code);return false; }
  scheduleReconnect(reason,{proactive=false}={}){if(!this.sessionResumptionHandle||this.reconnectAttempts>=this.maxReconnectAttempts)return false;clearTimeout(this.reconnectTimer);const attempt=++this.reconnectAttempts,delay=proactive?100:Math.min(2000,250*(2**(attempt-1))),handle=this.sessionResumptionHandle,recovery=this.onReconnectNeeded?.({reason,handle,attempt})||"";this.setState("CONNECTING","VOICE_RECONNECTING");this.reconnectTimer=setTimeout(()=>{if(proactive&&this.isActive())this.disconnect("go_away_handoff");this.goAwayReconnectScheduled=false;this.connect(recovery,{priority:"TRANSITION_GUIDANCE"}).catch(()=>{});},delay);return true;}
  disconnect(reason = "ended", { preserveOutput = false } = {}) {
    this.intentionalClose = true;
    clearTimeout(this.warningTimer); clearTimeout(this.endTimer); clearTimeout(this.stabilityTimer); this.clearTurnWatchdog(); this.clearPatientTranscriptWatchdog(); this.stopPlayback();
    try { this.session?.close(); } catch { /* Already closed. */ }
    this.session = null; this.stopAudioCapture();
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    globalThis.navigator?.mediaDevices?.removeEventListener?.("devicechange", this.audioDeviceChangeHandler);
    this.inputContext?.close();
    if (!preserveOutput) {
      this.outputContext?.close();
      this.outputContext = null;
      this.outputGain = null;
    }
    this.inputContext = null; this.audioCaptureReady = false; this.micPreroll.length = 0; this.clearEchoProbeState(); this.pendingConnectionTurn = null; this.activeTurn = null; this.activeAudioGenerationId = 0; this.awaitingPatientResponse = false; this.patientResponseReady = false; this.bargeIn.reset();
    this.setState("DISCONNECTED", reason);
  }
  fail(code) {
    const normalizedCode = normalizeEmmiVoiceError(code);
    this.onError?.(normalizedCode);
    this.disconnect(normalizedCode);
    const error = new Error(normalizedCode);
    error.code = normalizedCode;
    return error;
  }
}
