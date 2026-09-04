# EMMI Voice — Conversational Audit

Date: 2026-09-04 · Repository: `maikeldrc/access-enrollment-workflow` · Branch: `claude/emmi-voice-conversation-audit-y7nb3l`
Baseline commit `70d4399` · Companion documents: `baseline.md`, `transcripts/baseline/`, `transcripts/after/`, `evidence/`, `harness/`

---

## 1. Executive Summary

EMMI Voice is a Gemini Live session (`gemini-3.1-flash-live-preview`) wrapped in a substantial
application layer: an AudioWorklet microphone pipeline, a local barge-in detector with echo probing,
deterministic screen narration spoken through a separate TTS route, a rich per-screen "view"
descriptor, 36 function tools, and an action gate that will not book, send, change or cancel without
the patient's confirmation. The application layer is well built; the conversation it produces is not
yet what the brief asks for, and this audit found why.

**What could and could not be tested.** This environment has no `GEMINI_API_KEY`, and the sandbox's
egress policy denies both production hosts (`access-enrollment.vercel.app`,
`access-enrollment-workflow.vercel.app`, HTTP 403 on CONNECT). The WebSocket path to Gemini Live
itself works through the proxy (a raw upgrade returned `101 Switching Protocols`), so the only
missing piece for real conversations is the credential. Consequently **no turn in this audit was
understood or answered by Gemini**. Everything the application controls was exercised for real in
Chromium — the real capture pipeline, the real SDK and wire protocol, real barge-in, real playback,
real tools, real screens — against an in-page scripted double of the Gemini Live server. Model-layer
qualities are reported from the last real production sessions (2026-08-30) and marked as such.
Nothing in this report is a fabricated model result.

**Baseline.** Five defects break ordinary conversations before the model is even involved:

1. The transcript-reliability guard discards ordinary Spanish and English sentences ("Yo uso walker
   para caminar", "Quiero un Uber X", "I use a walker", and the emergency report "180 sobre 120 y me
   siento mareado") and every request to change language, replacing EMMI's answer with an English
   "I didn't hear that clearly… call 911" line. **P0/P1**, deterministic, reproduced with the real code.
2. A spoken patient turn carries no screen context to the model (the silent context channel was
   removed on 2026-09-03 because Gemini 3.1 rejected it); the model only knows the screen it saw at
   connect time unless it calls `describeCurrentView`. **P1**, {{CONTEXT_BEFORE_ANSWER_BASELINE}} spoken baseline turns were
   preceded by a context update.
3. Recovery lines were English-only, said "call 911" on every unheard word, and were sent at a
   priority the patient could not interrupt. **P2.**
4. Actions that finish in the background (booking a ride, sending an invitation, moving a visit)
   were reported to the model two frames after the click, as "chosen but NOT booked", and never
   followed up. **P2.**
5. Voice sessions hard-stopped at 12 minutes and any 20-second stall disconnected them; the
   end-of-speech window was locked to 1200 ms by the token while the client assumed 750 ms. **P2.**

**Changes.** All five were fixed in the application layer with unit coverage (1369 passing), plus a
340 ms barge-in pre-roll, a spoken language switch that rebuilds the session and confirms in the new
language, transcript assembly by generation, topic references ("eso", "el último"), chat routing for
"¿Qué hago aquí?", and a voice-specific style section in the system prompt. Regression sessions on
the harness show the application now answers every spoken turn from the real screen state through
tool results, reports background work when it is really done, recovers from a stalled provider in
the patient's language without dropping the session, and rotates a session silently before its token
expires.

**Readiness: NOT READY** for patient-facing voice. The application-layer defects are corrected, but
the conversation quality of the real model, the real ASR under natural pauses, real barge-in with
acoustic echo, and the experimental context-on-speech-start channel have not been validated against
Gemini Live in this audit, and the last real sessions (2026-08-30) still showed utterance splitting,
lost interruption prefixes and factual errors. Section 32 lists the exact conditions.

## 2. Current Voice Architecture

See `baseline.md` §2 for the full trace. In one paragraph: the browser captures 16 kHz PCM through an
AudioWorklet and streams it over a WebSocket to Gemini Live, authenticated with a one-use ephemeral
token whose constraints **lock** the session configuration (audio out, voice Sulafat, minimal
thinking, input/output transcription, automatic activity detection with 1200 ms end-of-speech
silence, resumption, context compression). The system instruction is sent once at connect and
contains ~13 KB of rules plus ~8 KB of JSON application context including the current view.
Screen guidance on enrollment screens is deterministic text spoken through a separate TTS route; the
Live model never hears it. Conversational replies stream back as 24 kHz PCM plus transcription; tool
calls round-trip through the application's tool orchestrator, which enforces confirmation for
CONFIRM/DESTRUCTIVE controls in code. Chat is a different execution path (deterministic router +
server RAG on `gemini-2.5-flash`) sharing the visible thread and a 12-turn conversation memory.

## 3. Test Methodology

1. **Code trace** of PATIENT SPEAKS → EMMI HEARS → UNDERSTANDS → REMEMBERS → USES APP STATE →
   RESPONDS/ACTS → PATIENT HEARS, including git history of the context channel.
2. **Deterministic probes** (Node) on the transcript guard (38 utterances) and the narration engine
   (every screen, ES/EN).
3. **Real application probes** in Chromium (`harness/baseline-probes.mjs`): voice activation without
   a provider, every appointment/transportation/reschedule/companion/video/topics/enrollment/My Care
   view, tool results, the action gate, and the deterministic chat path.
4. **Voice sessions on the harness** (`harness/run-sessions.mjs`): 24 scripted conversations
   (S01–S24), each run once on the pristine baseline commit and once on the fixed branch — ten of
   them long (15–20 spoken turns), eight patient profiles, Spanish primary, English (S10, S22, and
   the start of S14), Spanglish (S07, S20), a Haitian Creole sample (S23) — with barge-ins, silences,
   corrections, change of mind, multi-intent, topic switching, safety mid-task, provider failures,
   a lagging transcript, spoken language switches and a session outliving its token. Patient speech
   is synthesized audio injected through the real capture pipeline; the provider is the scripted
   double described in `harness/README.md`. Sessions S03 and S10 were re-run on the baseline after a
   harness fix (the first barge-in script interrupted a silent EMMI); the re-run replaced the first
   result.
5. **Historical production evidence** (real Gemini Live, 2026-08-30) for model-layer behaviour.

Latency vocabulary: **T1** end of patient speech, **T2** first audible EMMI audio, **T3** audio
drained. Bands: FAST < 1.0 s · ACCEPTABLE 1.0–1.6 s · NOTICEABLE DELAY 1.6–2.5 s · POOR 2.5–4 s ·
VERY POOR > 4 s.

## 4. Patient Profiles

| Profile | Style | Sessions |
|---|---|---|
| A | Older adult, answers with one or two words ("Sí.", "Esa.", "Gracias."), long pauses | S01, S09, S13, S21, S23 |
| B | Talks a lot, information out of order | S04, S11, S19 |
| C | Gets confused easily ("No sé qué tengo que hacer", "¿Eh? No entendí", "Mi hija me dijo…") | S02, S12, S16 |
| D | Changes their mind | S05, S22 |
| E | Interrupts frequently | S03 |
| F | Spanglish ("No tengo ride", "Uso walker", "el appointment", "Book that one") | S07, S14, S20 |
| G | Asks many questions before deciding | S06, S10, S15, S17, S24 |
| H | Wants to finish fast, multi-intent | S08, S18 |

## 5. Conversation Coverage

| Flow | Sessions | What was exercised |
|---|---|---|
| Transportation (offer → pickup → needs → time → search → options → review → booked → return / cancel) | S01, S02, S03, S08, S11, S16, S20, S22 | EMMI-driven navigation by tool calls, patient-driven navigation by taps, ordinals, "la más barata", "la que tiene más espacio", "la que llega más temprano", confirmation gate, background booking, return trip, cancel through the destructive gate, rebook |
| Appointment topics | S04, S11, S19 | Anaphora ("son", "eso", "ese", "el segundo", "el de la rodilla"), list, remove last, correction, ordinal read, topic switch and return |
| Reschedule | S05, S18 | Slots as choices with dates, "la del jueves", "mejor por la tarde", retraction, "¿seguro que no cambió nada?", confirmation |
| Companion | S06, S18, S20 | Who can come, privacy, "¿Y la otra?", invitation gate, second intent, Spanglish |
| Video visit | S12, S21 | Device check results, step-by-step help, recheck, one-word answers with long silences, an inaudible turn mid-task |
| Enrollment | S10 (EN), S17 (ES, full journey) | Barge-in on the welcome, cost via tool, screens EMMI may not press, "do it later", invitation → who is completing → identity typed → care → eligibility → consent → enrolled → care setup |
| My Care hub | S24 and every session's start | Next step, goals, care team, next appointment, medications, monitor, a home reading with a symptom, "Abre mi cita" |
| Spanglish / language | S07, S14, S20, S23 | Guard behaviour, explicit and implicit language switch, Kreyòl session |
| Safety mid-task | S08, S24 | Chest pain during transportation, a 150/95 reading with headache, emergency tool, resume task |
| Silence / recovery | S09, S21 | 12 s silence, no transcript, stalled provider, "¿sigues ahí?" |
| Session lifetime | S15 | Rotation across the token limit |
| Confusion / repetition | S02, S16, S21 | "No entendí", "¿Qué me dijiste?", "Más despacio", "¿Eh?", known data asked back |

{{BASELINE_TURN_COUNTS}}

(Sections 6–32 follow.)
