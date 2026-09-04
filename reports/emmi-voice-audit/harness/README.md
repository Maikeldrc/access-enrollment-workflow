# EMMI voice conversation harness

Drives the real application in Chromium as a patient talking to EMMI by voice, records every turn
with the fields the audit asks for, and measures what the application makes observable: end of
patient speech → provider end-of-speech → first audio chunk → first audible audio → audio drained,
barge-in stop latency, the messages the app actually put on the provider socket (screen context,
narration, recovery prompts, tool responses), tool calls and results, and the view before and after
each turn.

## Two provider modes

| Mode | What is real | What is not | When |
|---|---|---|---|
| `PROVIDER=fake` (default) | The whole application: microphone capture through the AudioWorklet, resampling and PCM encoding, the `@google/genai` SDK and wire protocol, local barge-in detection and echo probing, playback scheduling, watchdogs, session rotation, the transcript-reliability guard, the view describers, the tool orchestrator, the action gate, the UI. | Speech recognition and the model. `fake-provider.js` is a scripted double of the Gemini Live server installed in the page: each patient turn's transcript is *declared* by the scenario and EMMI's reply is *scripted* (or derived from real tool results by small policies). Nothing it says is evidence of how Gemini would answer. | No `GEMINI_API_KEY` available. |
| `PROVIDER=real` | Everything, including Gemini Live ASR, the model and its voice. | Nothing. | `GEMINI_API_KEY` set for the dev server (`.env.local`). |

In `fake` mode the "patient" is a synthesized speech-like signal injected into a fake
`getUserMedia` stream (`window.__patientSpeak`). In `real` mode (`real-mic.js`) each `speak.text`
is synthesized by the app's own TTS route (`POST /api/emmi/tts`, cached under
`.cache/emmi-voice-audit-tts/`) and played into the fake microphone as PCM, so Gemini Live hears
spoken words; the harness records what the provider transcribed (`recognized_text`, from the
visible thread) next to the intended utterance, and EMMI's reply from the same thread. Provider-side
timings (VAD end, first chunk) are not observable in real mode; T1/T2/T3 and barge-in still are.
`EMMI_VOICE_CONTEXT_ON_SPEECH_START=true` on the dev server enables the experimental context push
for a comparison run.

## Running

```bash
npm run dev -- --port 5173                                   # the app under test
node reports/emmi-voice-audit/harness/run-sessions.mjs       # all sessions, fake provider
node reports/emmi-voice-audit/harness/run-sessions.mjs S01-transport-canonical-es
GEMINI_API_KEY=… npm run dev -- --port 5173   # dev server with the key (or .env.local)
PROVIDER=real OUT_DIR=reports/emmi-voice-audit/transcripts/real node reports/emmi-voice-audit/harness/run-sessions.mjs
OUT_DIR=reports/emmi-voice-audit/transcripts/after node reports/emmi-voice-audit/harness/run-sessions.mjs
node reports/emmi-voice-audit/harness/summarise-sessions.mjs reports/emmi-voice-audit/transcripts/after
```

`S15-session-rotation-es` needs a dev server started with `EMMI_SESSION_MAX_MINUTES=2` and
`BASE_URL` pointing at it; it only runs when named explicitly.

Scenarios live in `scenarios.mjs` (S01–S15) and `scenarios-long.mjs` (S16–S24, the long 15–20-turn
conversations); `run-sessions.mjs` runs both lists in order. The scripted double keeps its reply
queue across provider reconnects (language switch, session rotation) and hands the app a fresh fake
microphone stream on every `getUserMedia` call, because the app stops the tracks of a stream it
releases. Do not edit `src/` while sessions are running against a Vite dev server: the page reload
Vite triggers ends the session in progress.

`baseline-probes.mjs` is the non-conversational probe set (views, tools, action gate, chat path)
and writes `evidence/baseline-probes.json`.

Environment: `CHROMIUM_PATH` (default `/opt/pw-browsers/chromium`), `BASE_URL`
(default `http://127.0.0.1:5173`), `TTS_WPS` (words per second used to size the fake narration
audio, default 2.4).

## Output

One `<session>.json` and `<session>.md` per session. Each speech turn carries:
`session_id, patient_profile, language, flow, screen, patient_utterance, recognized_text,
EMMI_response, EMMI_response_source, timing (T1/T2/T3, response_start_latency_ms,
response_completion_latency_ms, provider_vad_window_ms, app_overhead_first_chunk_to_audible_ms,
perceived), conversation_context (view before/after, context envelopes, states, suppression events,
local notices spoken by the app, language signals, lifecycle events), action_requested,
action_result (tool calls with real results), navigation_result, interruption (for barge-ins),
problem_detected, severity, notes`.

`SUMMARY.md` aggregates p50/p95 response start, barge-in stop latency, context-before-answer
counts and every detected problem across a folder of sessions.
