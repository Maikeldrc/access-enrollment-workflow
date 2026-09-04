# EMMI Voice — Conversational Audit: BASELINE

Date: 2026-09-04 · Branch: `claude/emmi-voice-conversation-audit-y7nb3l` · Baseline commit: `70d4399` (no application code changed for this baseline)

This document records how EMMI Voice works today and how it behaves before any change. Everything
below is either (a) read from the code and verified by running it, (b) measured on the real
application running locally in Chromium, or (c) quoted from earlier production sessions and marked
as such. Nothing here is a guess about what the model would say.

---

## 1. Environment and the limitations that shaped this audit

| Capability needed for a true voice conversation | Available here? | Evidence |
|---|---|---|
| `GEMINI_API_KEY` for the local token route (`/api/emmi/live-token`) | **No.** No env var, no `.env.local`. Local route answers `503 gemini_not_configured`. | `curl -X POST http://127.0.0.1:5173/api/emmi/live-token` |
| Production deployment as a token source (`access-enrollment.vercel.app`, `access-enrollment-workflow.vercel.app`) | **No.** Both hosts are denied by the sandbox egress policy (`CONNECT tunnel failed, response 403`, recorded in the proxy's `recentRelayFailures`). | `curl https://access-enrollment-workflow.vercel.app/new` |
| WebSocket to Gemini Live through the proxy | **Yes.** A raw upgrade to `wss://generativelanguage.googleapis.com/ws/...BidiGenerateContentConstrained` returned `HTTP/1.1 101 Switching Protocols`. The transport is not the blocker; the credential is. | `curl --http1.1 -H "Upgrade: websocket" …` |
| Physical microphone / speaker / acoustic echo path | **No.** No `/dev/snd`; Chromium runs headless with fake media devices. | `ls /dev/snd` |
| Real ASR, real model, real TTS | **No.** All three live behind the missing key. | — |

Consequences, stated plainly:

- **No turn in this baseline was understood or answered by Gemini.** Model-dependent qualities —
  naturalness, wording, clarity, reference resolution by the model, safety phrasing by the model —
  could not be measured here. Where the baseline reports them it cites the production sessions of
  2026-08-30 (`LIVE_EMMI_*`, `docs/specs/qa/*`) and says so.
- **Everything the application controls was exercised for real**: microphone capture through the
  AudioWorklet, resampling and PCM encoding, the provider socket protocol, local barge-in detection
  and echo probing, playback scheduling, watchdogs, the transcript-reliability guard, the view
  describers, the tool orchestrator, the action gate, and the UI. For that, a scripted double of the
  Gemini Live server was installed inside the page (`harness/fake-provider.js`). It speaks the real
  wire format; it does not think. Every transcript it produces is labelled `provider: fake`.
- The harness runs unchanged against the real provider (`PROVIDER=real`) the moment a development
  key is present. The conversations below are therefore ready to be re-run for real.

Unit suite at baseline: 1358 passed, 1 failed (`appointmentSupport` reminder test depends on the
machine time zone; unrelated to voice).

## 2. Observed architecture — the full cycle

```
PATIENT SPEAKS
  getUserMedia (mono, AEC, NS, AGC) → AudioContext (device rate, 48 kHz here)
  → AudioWorklet /audio/emmi-mic-processor.js (1024-sample frames, ~21 ms)
  → liveClient.handleMicFrame: RMS/peak metering → local VAD (EmmiBargeInManager)
      · while EMMI is audible: frames are HELD (pre-roll of 8 frames ≈ 170 ms) and an "echo probe"
        ducks EMMI to silence for ~3 frames; only sustained speech wins the floor and flushes the pre-roll
      · otherwise: low-pass + linear resample to 16 kHz → PCM16 LE → base64 → session.sendRealtimeInput({audio})
EMMI HEARS
  Gemini Live (gemini-3.1-flash-live-preview) over WebSocket, authenticated with a one-use ephemeral
  token minted by /api/emmi/live-token (server/emmiLiveToken.js). The token's liveConnectConstraints
  LOCK the session config (lockAdditionalFields: []):
      responseModalities AUDIO · voice Sulafat · thinkingLevel minimal · input+output transcription
      automaticActivityDetection: START_SENSITIVITY_HIGH, END_SENSITIVITY_LOW, prefixPadding 300 ms,
      silenceDuration 1200 ms · activityHandling START_OF_ACTIVITY_INTERRUPTS · sessionResumption ·
      contextWindowCompression(slidingWindow)
  (the client asks for silenceDuration 750 ms — it is ignored because the token locks 1200 ms)
UNDERSTANDS / REMEMBERS CONTEXT
  systemInstruction = EMMI_SYSTEM_PROMPT (~13 KB of rules) + JSON of assistantContext() (~8 KB:
  patient fixture, enrollment/device/goal state, care team, appointment prep, the current VIEW
  descriptor, and emmiConversation continuity) — sent ONCE at connect.
  In-session memory = the provider's own history (audio + transcripts), compressed by the provider.
  The app's EmmiConversationManager keeps 12 turns / a 6-turn summary; it reaches the model only
  bound to app-initiated TEXT turns and on reconnect (recoveryInstruction).
USES APPLICATION STATE
  36 function tools (src/emmi/tools.js): patient facts, appointments, topics, transportation,
  describeCurrentView, performViewAction (SELECT/NAVIGATE free; CONFIRM/DESTRUCTIVE need confirmed:true,
  enforced in app.js, not in the prompt), knowledge search, clinical escalation.
  Screen changes: app.js syncEmmiViewContext() → liveClient.sendContextUpdate() → STAGED ONLY.
  Since commit 35a83ac (2026-09-03) the staged context is bound to the next realtime TEXT turn.
  A SPOKEN patient turn carries no screen update.
RESPONDS OR ACTS
  Screen guidance (enrollment screens only) is deterministic text (src/emmi/narrative.js) spoken through
  a SEPARATE TTS route (/api/emmi/tts → gemini-3.1-flash-tts-preview), not through the Live session.
  The Live model never hears what EMMI narrated. Conversational replies come from the Live model as
  24 kHz PCM chunks + output transcription; tool calls round-trip through EmmiToolOrchestrator.
PATIENT HEARS
  AudioBufferSourceNodes queued on a 24 kHz AudioContext behind a GainNode (40 ms fade on interrupt).
  Turn ends when the provider says turnComplete/generationComplete AND queued audio drained.
TURN-TAKING / INTERRUPTIONS / SILENCE / ERRORS
  Provider VAD is authoritative; local VAD pre-stops audio. Watchdogs: guidance start 3.5 s
  (retry → clean reconnect → browser speechSynthesis fallback), turn stall 20 s (→ VOICE_RESPONSE_TIMEOUT
  + disconnect), transcript wait 5 s after local speech end (→ model is told to say an English
  "I heard you… call 911" line). Session max 12 min (warning at 10, hard disconnect at 12).
  Reconnect ×3 with the resumption handle; locale change = new session.
CHAT
  A different execution path: deterministic intent router + guardrails + server RAG (gemini-2.5-flash).
  Shares assistantMessages and the conversation manager with voice; behaviour parity is not guaranteed.
```

Key source files: `src/emmi/liveClient.js` (1396 lines), `bargeInManager.js`, `transcript.js`,
`languageDetection.js`, `transitionManager.js`, `narrative.js`, `systemPrompt.js`, `tools.js`,
`viewContext.js`, `src/appointmentViewContext.js`, `src/careViewContext.js`, `src/app.js`
(`assistantContext`, `ensureEmmiRuntime`, `deliverEmmiGuidance`, `syncEmmiViewContext`,
`performEmmiViewAction`), `server/emmiLiveToken.js`, `server/emmiTts.js`, `server/emmiChat.js`.

## 3. Methodology

1. **Code trace** of the whole cycle (section 2), including the git history of the context channel.
2. **Deterministic probes in Node** on pure modules: the transcript-reliability guard with 38
   patient utterances (Spanish, Spanglish, English, Creole, fragments); the narration engine for
   every screen in ES and EN (`harness/../evidence` — see `scratchpad` probes reproduced in §5).
3. **Real application probes in Chromium** (`harness/baseline-probes.mjs`, results in
   `evidence/baseline-probes.json`): voice activation without a provider; the transportation,
   reschedule, companion, video-visit, topics, enrollment and My Care screens, capturing exactly what
   EMMI is handed (`__emmiViewProbe`), what the tools return (`__emmiToolProbe`) and what the action
   gate does (`__emmiActionProbe`); plus the deterministic Chat path for the same phrases.
4. **Twelve voice sessions on the harness** (`harness/run-sessions.mjs`, transcripts in
   `transcripts/baseline/`), eight patient profiles, Spanish primary, one English enrollment session,
   with barge-ins, silences, corrections, multi-intent, topic switching, safety mid-task and provider
   failures. The provider is the scripted double; the patient "speaks" injected audio through the
   real capture pipeline.
5. **Historical production evidence** (2026-08-30, real Gemini Live, before commits of 09-02/09-03):
   `LIVE_EMMI_PATIENT_TEST_LOG.md`, `LIVE_EMMI_FULL_PATIENT_CONVERSATION_QA_2026-08-30.md`,
   `LIVE_EMMI_VOICE_QA_RETEST_R2_2026-08-30.md`, `VOICE_LATENCY_MATRIX.md`.

Latency vocabulary used everywhere: **T1** end of patient speech (injected audio end), **T2** first
audible EMMI audio (first chunk accepted for playback + scheduled delay), **T3** audio drained.
Bands: FAST < 1.0 s · ACCEPTABLE 1.0–1.6 s · NOTICEABLE DELAY 1.6–2.5 s · POOR 2.5–4 s · VERY POOR > 4 s.

## 4. Deterministic findings (verified by executing the real code)

### 4.1 The transcript-reliability guard suppresses ordinary speech — P0/P1

`assessEmmiTranscriptReliability` (src/emmi/transcript.js) marks a transcript unreliable when it has
≥ 3 words, no detectable language, no dose-like phrase and no *English* request structure. Spanish has
no request-structure rule, and the language detector needs two marker words (or an accent/ñ/¿). When a
transcript is marked unreliable, the app **discards EMMI's answer, blocks all tools for that turn, and
instructs the model to say only** `"I'm sorry, I didn't hear that clearly. Please say it again. If this
may be a medical emergency, call 911 now."` (English, regardless of locale).

Real results (locale → transcript → verdict):

| locale | transcript | verdict |
|---|---|---|
| es | Yo uso walker para caminar | **SUPPRESSED** low_locale_evidence |
| es | Quiero un Uber X | **SUPPRESSED** |
| es | Mi doctor dijo que no | **SUPPRESSED** |
| es | 180 sobre 120 y me siento mareado. | **SUPPRESSED** (an emergency report) |
| es | Pon la primera del jueves | **SUPPRESSED** (harness S07) |
| en | I use a walker | **SUPPRESSED** |
| es | Can we switch to English please | **SUPPRESSED** unexpected_language |
| en | Prefiero hablar en español. Hable conmigo en español ahora. | **SUPPRESSED** unexpected_language |
| en | No tengo ride para mañana | **SUPPRESSED** unexpected_language |
| es | No tengo ride para mañana / Quiero cambiar el appointment / Uso walker / Sí. / Esa. / Espera / Quita el último / También tengo dolor fuerte en el pecho ahora | accepted |
| en | Chinese small lantern / 13 game and access service / ball (after interruption) | suppressed (intended) |

Why it matters: any Spanish sentence of three or more words without accented characters and with
fewer than two of the ~45 marker words is treated as ASR garbage. That covers a large share of
natural, short spoken Spanish. **This is a conversation-breaking defect and, for the blood-pressure
example, a safety-relevant one.** The production failure "spoken language switch never works"
(EMMI-LIVE-008 / QA-CONV-006) is fully explained by the `unexpected_language` branch.

### 4.2 Spoken turns carry no screen context — P1

`sendContextUpdate()` only stages the newest view; it is flushed exclusively by
`sendPreparedTurnToLive()`, i.e. by app-initiated text turns (guidance fallback, typed questions,
recovery prompts). Commit `35a83ac` removed the silent `sendClientContent(turnComplete:false)` channel
because Gemini 3.1 rejected it. A patient who taps from the pickup step to the ride options and asks
"¿qué opciones tengo?" is answered from the view the model had at connect time, unless the model
decides to call `describeCurrentView`. Harness evidence: **0 of the spoken turns in the baseline
sessions were preceded by a context envelope**; every navigation tap recorded `context pushed: 0`.
The prompt text "the app replaces it whenever the screen changes" is not true for voice.

### 4.3 End-of-speech window: 1200 ms locked by the token, 750 ms assumed by the client — P2

`buildEmmiLiveTokenConfig` sets `silenceDurationMs: 1200` with `lockAdditionalFields: []`, which per
the SDK ("Case 4") locks every field set in the token. The client's `EMMI_END_OF_SPEECH_SILENCE_MS =
750` (and its unit test) is dead configuration; the local barge-in VAD also ends speech at 750 ms.
Effects: (1) the structural floor for END-OF-SPEECH → FIRST AUDIO is ~1.2 s before the model even
starts; (2) the UI shows "Pensando…" ~450 ms before the provider has closed the turn, and stops
observing local speech while the patient may still be talking. Harness measurement of the provider
VAD window: **p50 1240 ms** (double configured at 1200 ms + one 21 ms frame + polling).

### 4.4 Recovery and clarification prompts — P2

`waitForPatientTranscript` (5 s) and the ASR override both make the model say an English sentence
that ends with "call 911", at CRITICAL_SAFETY priority (which disables local interruption). A cough,
a TV in the room or an untranscribed word therefore produces an emergency mention. Production log
QA-CONV-008 saw exactly these English lines inside Spanish sessions.

### 4.5 Action integrity during background work — P2

`performViewAction` returns two animation frames after the click. Booking, ride search, sending an
invitation, rescheduling and the video check are asynchronous (1.3–2.5 s here). The tool result for
"confirm the booking" therefore carries `stillPending: "El viaje está elegido pero NO reservado"`; a
compliant model says "todavía no está confirmado" right after the patient said yes, and then says
nothing when the booking completes because voice receives no push. Harness S01 turn 9 shows this
literally. The tool-status labels ("Reservando…") are shown in the UI only while the tool runs, which
is ~30 ms.

### 4.6 Session lifetime and watchdogs — P2

- Hard stop: `endTimer → disconnect("session_timeout")` at 12 minutes, after a "session_ending_soon"
  detail at 10. Nothing is said to the patient; the next navigation reconnects (new session, no
  provider memory unless the resumption handle survived).
- Turn stall: 20 s without provider progress → `VOICE_RESPONSE_TIMEOUT` and **disconnect**. Any
  input-transcription fragment arriving with no active turn opens a phantom `PATIENT_RESPONSE`
  turn that is subject to this timeout.

### 4.7 Barge-in pre-roll — P2

While EMMI is audible, microphone frames are held in a pre-roll of 8 frames (≈ 170 ms) and an echo
probe needs ≥ 3 sustained frames after ducking. Speech before the probe succeeds is lost beyond 170
ms. Production logs report exactly that symptom ("Espere" lost, "Wait, stop…" corrupted, whole
barge-ins dropped: LIVE_EMMI_PATIENT_TEST_LOG turns 2/16, QA-CONV-010). Harness measurement of the
app's stop latency after the patient starts (local detection): see §7.

### 4.8 Screen narration length vs. its own budgets — P3

`narrative.js` declares budgets (SIMPLE_TASK 7–15 s, CONCEPTUAL 15–25 s, PROGRAM_INTRODUCTION 12–22 s).
At a calm 140 wpm (ES) / 150 wpm (EN):

| screen (ES) | words | est. s | budget |
|---|---:|---:|---|
| INVITATION welcome | 88 | 38 | 12–22 |
| GOALS / ACCESS_GOALS | 78 | 33 | 15–25 |
| ACCESS_BP_DEVICE_INFO | 76 | 33 | 15–25 |
| MEDICATIONS_REVIEW | 73 | 31 | 15–25 |
| ENROLLMENT_CONFIRMED | 71 | 30 | 15–20 |
| IDENTITY_VERIFICATION | 51 | 22 | 7–15 |
| CARE_PREFERENCES | 48 | 21 | 7–15 |
| ACCESS_BP_GUIDED_SETUP | 58 | 25 | 7–15 |

23 of 28 ES narrations and 22 of 28 EN narrations exceed their budget's upper bound. The production
matrix measured the welcome at ~40 s. A patient can interrupt, but only if barge-in is reliable (§4.7).

### 4.9 Outside enrollment EMMI does not narrate — P3

`buildNarration` returns null for every appointment, transportation, companion, reschedule, video,
My Care, goals-detail and medication screen. With voice on, a patient tapping through the
transportation flow hears nothing on any step (harness: every navigation tap → `narration: none`).
The screens do render an "EMMI line" text (`.barrier-emmi-line`) that voice never speaks.

### 4.10 Topic references — P3

`manageAppointmentTopics` resolves only `ese|esa|that|it` to the last topic. "Pon que son sobre todo
por la mañana" → `UPDATE_DETAIL target:"eso"` → **TOPIC_NOT_FOUND** (evidence: baseline-probes
`topics_tool_es`). `index:-1` ("quita el último") works.

### 4.11 Chat/voice divergence — P3 (chat)

On the ride-options screen, EMMI Chat (deterministic router, no key) answered "¿Qué hago aquí?" and
"¿Qué hago ahora?" with the **emergency page** ("EMMI no es un servicio de emergencias…") because
neither phrase matches `SCREEN_HELP` and retrieval ranked `safety/emergencies.md` first. "No tengo
cómo llegar a la cita" → "No tengo suficiente información aprobada…". "Quiero cambiar mi cita al
jueves" → reschedule offer; "Mejor no quiero cambiarla" → the same reschedule offer again. Voice takes
none of these routes (the model answers), so the two modalities can answer the same sentence
differently.

### 4.12 What EMMI is handed per screen (UI awareness data) — mostly good

`evidence/baseline-probes.json` shows the view descriptors are rich where a describer exists:
transportation options carry `n`, label, detail, seats, cost, cost value, pickup and arrival times;
"la que tiene más espacio" resolves to UberXL (5 seats), "la más barata" to UberX ($27.95); selection
vs. `alreadyDone` vs. `stillPending` is correct at every step; reschedule slots carry date and time
("la del jueves" resolvable); companion contacts carry names and relationships; the video check
carries pass/fail per item. Gaps: enrollment describers expose no choices or inputs (EMMI cannot
select "For myself" or fill a field); INVITATION and MY_CARE fall back to DOM description with no
facts (`youMayPressTheseYourself: false`); `getCareCircle` reports no members while the companion
screen lists two demo contacts.

### 4.13 Small items — P4

- "Repeat" stays enabled on the welcome card when voice is unavailable.
- A reload before EMMI's first greeting makes the conversation manager treat the first activation as
  a TECHNICAL_RECONNECT and strip the greeting (`EMMI_UNEXPECTED_GREETING` fired on a fresh Home).
- `nextBestAction` for an enrolled patient on MY_CARE is `Continuar → INVITATION`.
- The socket URL built by the SDK contains a double slash (`googleapis.com//ws/`); harmless.

## 5. Voice activation without a provider (real UX)

Tap "Guía por voz" → 427 ms later state `DISCONNECTED`, error `VOICE_PROVIDER_ERROR`; the card reads
"Voice guidance is unavailable — EMMI voice is temporarily unavailable. You can continue by typing."
Clear, non-technical, no retry loop. (`evidence/voice-start-without-provider.png`)

## 6. Prior production evidence used as the model-layer baseline (2026-08-30, real Gemini Live)

Because no model turn could be run here, the model-dependent baseline is taken from the last real
sessions on record, with their date and the caveat that the 09-02/09-03 commits changed the audio
path since:

- Visible-answer latency after patient speech: mostly **0.7–1.2 s** (17 turns marked FAST), worst
  **3–5 s**; initial connection 3–4 s; welcome narration ~22–40 s. (`LIVE_EMMI_PATIENT_TEST_LOG.md`,
  `VOICE_LATENCY_MATRIX.md`)
- Utterances split at natural pauses, negations lost, prefixes of barge-ins lost or corrupted,
  one barge-in lost entirely; assistant text ending mid-sentence; spoken language switch failed;
  fabricated refill state and phone number; BP target contradicting the UI; a refusal inverted into a
  created task. (`LIVE_EMMI_FULL_PATIENT_CONVERSATION_QA_2026-08-30.md`, `…RETEST_R2…`)
- Clinical emergency guidance by voice: correct in the cases tested.

## 7. Harness sessions (application layer, simulated provider)

The per-session tables live in `transcripts/baseline/*.md`; the aggregate is
`transcripts/baseline/SUMMARY.md`. The numbers that matter and what they mean:

- **Response start (T2−T1)**: p50 **≈1.83 s**, p95 **≈1.93 s** with the double's model delay fixed at
  550 ms. Decomposition: provider end-of-speech window ≈ 1.24 s (locked 1200 ms) + simulated model
  0.55 s + tool round trips (~30 ms each) + **application overhead 3–7 ms** from first chunk to audible.
  The application adds nothing measurable; the floor is the VAD window. With a real model (TTFB
  typically 0.4–1.0 s) the expected band is NOTICEABLE DELAY (1.6–2.3 s).
- **Local speech-end detection**: ≈1.25 s after T1 (the 750 ms local window plus buffering) — the
  UI flips to "Pensando…" at about the same time the provider closes the turn here, but the two
  windows are still independent settings.
- **Context before answer**: 0 / N spoken turns.
- **Barge-in**: see SUMMARY (stop latency from patient speech start, app-registered interruptions).
- **Action integrity**: S01/S03/S08 turn "Sí" after "¿Confirma?" → tool result still pending.
- **Silences**: no spontaneous speech from EMMI during 12 s of silence (correct).
- **Provider without transcript / provider stall**: see S09 — the recovery text the app sends and the
  20 s disconnect.

(Exact values are inserted from SUMMARY.json in the final report.)

## 8. Baseline scores (1–5)

Two layers, because only one could be measured here.

| Dimension | Application layer (measured) | Model layer (production 08-30 evidence) |
|---|---:|---:|
| Context retention | 2 (voice gets no screen updates; provider memory only) | 3 |
| Turn-taking | 2 (1.2 s locked window, 750/1200 mismatch, phantom turns) | 2 (splits at pauses) |
| Response latency | 2 (structural ≥1.2 s floor; app overhead negligible) | 3 (0.7–1.2 s visible, 3–5 s worst) |
| Naturalness | 2 (English "call 911" recovery lines; long narrations) | 3 |
| Conciseness | 2 (narrations 20–38 s) | 3 |
| Clarity | 3 | 3 |
| Action accuracy | 3 (gates correct; async results reported early) | 2 (refusal inverted, fabricated facts) |
| UI awareness | 3 (descriptors rich; not pushed on speech) | 3 |
| Recovery from errors | 2 (disconnect on stall; alarming wording) | 2 |
| Interruption handling | 3 (local stop works; pre-roll 170 ms) | 2 (prefixes lost) |
| Patient effort | 2 (many ordinary Spanish sentences rejected) | 2 |
| **Overall conversation quality** | **2.3** | **2.5** |

## 9. Top issues, in priority order

1. **P0/P1 — Transcript guard rejects ordinary Spanish/English speech and every language switch**
   (§4.1). Root cause: `lowLocaleEvidence` and `unexpectedLanguage` in `transcript.js`.
2. **P1 — Spoken turns are answered without the current screen** (§4.2). Root cause: the context
   channel is bound to text turns only since 35a83ac.
3. **P2 — Recovery lines are English, alarming, and uninterruptible** (§4.4).
4. **P2 — Actions that finish in the background are reported as pending and never followed up**
   (§4.5).
5. **P2 — End-of-speech window inconsistent (1200 locked vs 750 assumed)** (§4.3).
6. **P2 — Hard 12-minute stop; 20 s stall disconnects the session** (§4.6).
7. **P2 — Barge-in pre-roll too short for the first word** (§4.7).
8. **P3 — Narrations over budget; no narration outside enrollment** (§4.8, §4.9).
9. **P3 — "eso"/"el último" references in the topics tool; chat routing of "¿Qué hago aquí?"**
   (§4.10, §4.11).
10. **P3/P4 — Enrollment views without choices; DOM-only Home/My Care; small UI states** (§4.12, §4.13).
