# EMMI voice/audio architecture — current state

Audit date: 2026-08-29
Production target: `https://access-enrollment.vercel.app/`
Scope: read-only architecture discovery and pre-release QA. No production behavior was changed.

## Voice path

```text
Patient microphone
  -> navigator.mediaDevices.getUserMedia
     mono; echoCancellation; noiseSuppression; autoGainControl
  -> browser AudioContext + MediaStreamAudioSourceNode
  -> /audio/emmi-mic-processor.js?v=3 (AudioWorkletNode)
     2,048-frame capture packets; no ScriptProcessor fallback
  -> low-pass + linear resample
  -> PCM16 little-endian, mono, 16 kHz, base64
  -> @google/genai Live session (v1alpha) over the SDK transport
  -> gemini-3.1-flash-live-preview
     automatic activity detection; START_HIGH; END_LOW;
     300 ms prefix padding; 800 ms silence; activity interrupts output
  -> PCM16 response chunks, 24 kHz
  -> AudioBufferSourceNodes queued on a dedicated 24 kHz AudioContext
  -> GainNode -> browser output device
```

Provider: Gemini Live. Canonical voice: `Sulafat`, version `emmi-voice-v1`. The same identity guard is used for narration, conversation, safety and reconnect. EN and ES are live-voice capable; KR means Haitian Creole/Kreyòl and is deliberately text-only, never Korean.

The browser requests a one-use, short-lived token from `POST /api/emmi/live-token`. The server uses `GEMINI_API_KEY`; the browser receives only the ephemeral token. New sessions must start within 60 seconds. Token expiry is session maximum plus one minute. The application session maximum is 12 minutes.

## Turn, interruption and lifecycle behavior

- `EmmiBargeInManager` performs a local RMS/peak pre-detection so buffered output can be faded/stopped before Gemini's provider VAD confirmation.
- Provider VAD is authoritative. Normal output is stopped with a 40 ms fade; late PCM chunks from an interrupted generation are discarded.
- Critical-safety output is not canceled by local-only detection; provider confirmation is required.
- Up to three reconnect attempts use the latest Gemini session-resumption handle and context-window compression.
- Microphone mute stops the worklet and all media tracks. Disconnect stops playback, closes input/output AudioContexts, removes the device listener and closes the live session.
- Closing the expanded EMMI overlay intentionally leaves global voice guidance active. Turning voice off ends it.
- Navigation uses `EmmiTransitionManager`, context versions and semantic segments. Each segment is sent as a separate model turn.

## Text versus voice

| Concern | Text | Voice | Convergence |
|---|---|---|---|
| Model | `gemini-2.5-flash` by default for grounded knowledge generation; deterministic answers for many intents | `gemini-3.1-flash-live-preview` | Shared system/runtime rules, but different response paths |
| History | `EmmiConversationManager` plus displayed messages | Gemini session resumption plus the same manager/displayed messages | `conversationSessionId`, recent turns, summary, screen and locale |
| Locale | EN/ES/KR | EN/ES; KR text-only | One `activeLocale`; voice reconnects on locale change |
| Screen context | `assistantContext` and deterministic router | Trusted live-context envelope and system instruction | Current screen, stage, enrollment state, goal and next action |
| Patient facts | Deterministic tools before grounded knowledge | Gemini function tools | Same tool registry/runtime services |
| Safety | Deterministic safety policy before normal routing | System rules plus function tools; live turn can be tagged critical | Shared safety episode persists across turns |

## Security and operational boundaries

- No `GEMINI_API_KEY` reference exists in client source; the built client contains the public error name only, not a credential.
- The token route is POST-only, no-cache, prototype-gated and rejects configurations that allow real patient data.
- The repository explicitly states that fixtures are fictional and that production still requires an approved encrypted audit service, retention/access controls, redaction, consent/privacy review, observability and clinical validation.
- This is therefore a prototype architecture, not evidence of operational authorization for real Medicare patient data.

## Architectural risks observed

1. Semantic narration segments are prompts to a generative model rather than exact speech payloads. In production the model expanded each short segment into another question/explanation, creating a roughly 40-second, repetitive welcome.
2. Consecutive assistant transcription chunks and separate voice turns are merged whenever the prior displayed item is also voice/assistant, obscuring real turn boundaries.
3. Text and voice share application history, but live Gemini and deterministic text routing remain separate execution paths; behavior parity is not guaranteed by architecture alone.
4. Locale restart clears the Gemini resumption handle. Continuity relies on the application summary/recovery prompt rather than provider session continuity.
