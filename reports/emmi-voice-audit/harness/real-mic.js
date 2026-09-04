// Fake microphone for PROVIDER=real runs: the app talks to Gemini Live through its own token route
// and hears, as the patient, PCM the harness injects (speech synthesized by the app's own TTS
// route from the scenario's utterance). Nothing else is intercepted.
(() => {
  const patient = { ctx: null, dest: null, utterances: [] };
  const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async constraints => {
    if (!constraints || !constraints.audio) return nativeGetUserMedia(constraints);
    if (!patient.ctx) patient.ctx = new AudioContext();
    // A fresh stream per call: the app stops the tracks of a stream it releases when it rebuilds a
    // session, and a stopped MediaStreamDestination stream never comes back.
    patient.dest = patient.ctx.createMediaStreamDestination();
    const silent = patient.ctx.createConstantSource();
    silent.offset.value = 0;
    silent.connect(patient.dest);
    silent.start();
    if (patient.ctx.state === "suspended") await patient.ctx.resume().catch(() => {});
    return patient.dest.stream;
  };
  // PCM16 little-endian mono at `sampleRate`, base64 → played into the microphone stream.
  window.__patientSpeakPcm = ({ pcmBase64, sampleRate = 24000, id = "", transcript = "" } = {}) => {
    if (!patient.ctx || !patient.dest) throw new Error("fake microphone not opened");
    const bytes = Uint8Array.from(atob(pcmBase64), c => c.charCodeAt(0));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const frames = Math.floor(bytes.byteLength / 2);
    const buffer = patient.ctx.createBuffer(1, Math.max(1, frames), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = view.getInt16(i * 2, true) / 32768;
    const source = patient.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(patient.dest);
    const startAt = patient.ctx.currentTime + 0.05;
    source.start(startAt);
    const durationMs = Math.round(frames / sampleRate * 1000);
    const startedAt = performance.now() + 50;
    const record = { id, transcript, startedAt: Math.round(startedAt), endsAt: Math.round(startedAt + durationMs), durationMs };
    patient.utterances.push(record);
    return record;
  };
  window.__patientUtterances = () => patient.utterances.slice();
})();
