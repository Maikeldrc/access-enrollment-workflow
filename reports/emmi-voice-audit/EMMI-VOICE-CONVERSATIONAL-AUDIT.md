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

**Baseline.** Measured on 24 scripted conversations (282 spoken patient turns,
9 of them 15–20 turns long), six defects broke ordinary conversations before the model was
even involved:

1. The transcript-reliability guard discarded 42 of 282 natural sentences — "Yo
   uso walker para caminar", "Quiero un Uber X", "Yes, my home address", "Lo hago yo misma", "No, me
   recoge mi hija", "Quita el de la rodilla", the emergency report "180 sobre 120 y me siento
   mareado", and every request to change language — blocked 44 tool calls behind them,
   and replaced each answer with an English "I didn't hear that clearly… call 911" line 3–7 s later.
   Whole tasks collapsed (S08, S18, S20, S22). **P1**, deterministic, reproduced with the real code.
2. A spoken patient turn carries no screen context to the model (the silent context channel was
   removed on 2026-09-03 because Gemini 3.1 rejected it); the model only knows the screen it saw at
   connect time unless it calls `describeCurrentView`. **P1**; 42 of 282 spoken
   baseline turns were preceded by a context update, all of them recovery text turns.
3. A turn the provider did not transcribe froze the client in USER_SPEAKING; a stalled provider
   disconnected the session after 20 s; sessions hard-stopped at 12 minutes. **P1/P2.**
4. Recovery lines were English-only, said "call 911" on every unheard word, and were sent at a
   priority the patient could not interrupt. **P2.**
5. Actions that finish in the background (booking a ride, sending an invitation, moving a visit)
   were reported to the model two frames after the click, as "chosen but NOT booked", and never
   followed up; a failed booking told the patient their confirmation was still missing. **P2.**
6. Review screens exposed no way back, so "me equivoqué", "quiero volver a las opciones" and "mejor
   no quiero cambiarla" were refused; topic references ("eso", "el último") failed. **P3.**

**Changes.** Seventeen changes, all in the application layer, all unit-tested (1375 passed, 1 failed (59 files; 17 tests added) — the same pre-existing time-zone failure, nothing else):
the guard rewritten (only an unsupported script or a lone post-interruption fragment is discarded;
language mismatch is a signal; requests must be addressed to EMMI); recovery in EMMI's own voice and
language through the narration route; the local speech detector kept running while EMMI waits for
an answer; stalled turns released; late transcript pieces joined to their reply; one end-of-speech
window everywhere; silent session rotation before the token limit; a spoken language switch that
rebuilds the session; `performViewAction` waiting for background work and returning the settled
view; failure states and back controls exposed in the descriptors; topic references; chat routing;
a voice section and an honest view-freshness rule in the prompt; an experimental context push on
speech start (off by default).

**Regression.** The same 24 conversations on the fixed build (282 spoken
turns): 0 sentences discarded (baseline 42), 0 tool calls
blocked (baseline 44), 0 English recovery lines (baseline
42), 0 sessions lost (baseline 1), response start p95
2633 ms (baseline 5347 ms) with the median unchanged at 1819 ms because it is the
locked 1.2 s window plus the double's fixed 550 ms; barge-in stop latency p50 162 ms;
every confirmation answered from the settled state; the rotation, language-switch, no-transcript
and stall paths all keep the session.

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

Baseline: 24 sessions, 282 spoken patient turns, 364 recorded turns (9 sessions with 15 or more spoken turns). Regression: 24 sessions, 282 spoken turns, 364 recorded turns (9 long).

## 6. Baseline Metrics

All numbers in this section come from `transcripts/baseline/SUMMARY.json` (application layer, scripted
provider double, see §3) unless marked *production*. Model-layer numbers are not measured here.

| Metric | Baseline | Notes |
|---|---:|---|
| Voice sessions | 24 | 9 of them long (≥ 15 spoken turns) |
| Spoken patient turns | 282 | plus 40 navigation taps, silences and probes = 364 recorded turns |
| Response start T2−T1, p50 / p95 / mean | 1814 ms / 5347 ms / 2269 ms | double's model delay fixed at 550 ms |
| Provider end-of-speech window (T1 → provider VAD end) | 1234 ms p50 | the locked 1200 ms `silenceDurationMs` plus transport |
| Application overhead, first chunk → audible | 4 ms p50 | negligible; the app adds nothing measurable when it answers directly |
| Turns whose first audible reply came after a *second* generation (guard or recovery path) | 42 | 3.1–6.9 s to first audio, all in English |
| Spoken turns answered with a screen-context update sent first | 42 / 282 | every one of them is an app-initiated text turn, not a spoken turn |
| Navigation taps that pushed the new screen to the provider | 0 / 40 | the staged context is only flushed by app text turns |
| Barge-ins issued while EMMI was audible | 6 | stop latency from patient speech start p50 183 ms, max 301 ms |
| Natural turns discarded by the transcript guard | 42 | each replaced by "I'm sorry, I didn't hear that clearly… call 911 now" |
| Tool calls blocked by the guard (`unreliable_voice_input`) | 44 | includes a retraction and a three-step navigation the patient asked for |
| Sessions that ended in DISCONNECTED without the patient ending them | 1 | S09: no transcript → stall → `VOICE_RESPONSE_TIMEOUT` |
| Screen narration, Spanish welcome | 88 words ≈ 38 s | budget for that screen: 12–22 s (`narrative.js`) |

*Production, 2026-08-30 (real Gemini Live, from `LIVE_EMMI_*` logs)*: visible response latency
0.7–1.2 s in the good cases and 3–5 s in the worst; utterances split at natural pauses; the first
word of interruptions lost; one refusal inverted; one fabricated fact. Those are the model-layer
baseline and they were not re-measured here.

## 7. Latency Analysis

**Where the time goes on a spoken turn (measured on the harness, per turn in every transcript):**

| Stage | Baseline | Source |
|---|---:|---|
| Patient stops speaking → provider declares end of speech | ≈ 1.20–1.25 s | locked `silenceDurationMs: 1200` (token constraint); END_SENSITIVITY_LOW |
| → local detector agrees ("Pensando…" appears) | ≈ 1.25 s after T1 | local RMS VAD, own window (750 ms before the change) plus frame buffering |
| → first model audio chunk | + 0.55 s on the double | real model TTFB 0.4–1.0 s (typical) to 3+ s (production worst) |
| → each tool round trip | + 20–40 ms | `performViewAction`, `describeCurrentView` (in-page) |
| → background work started by an action | + 1.3–2.5 s | ride search, booking, invitation, reschedule, device check (simulated services) |
| → first audible sample | + 3–7 ms | AudioContext scheduling, gain ramp |
| Recovery path (guard/missing transcript) | + 1.9–5.0 s | a second generation is requested after the first is discarded |

Reading: with the double, the p50 of 1814 ms is 1.2 s of provider silence window + 0.55 s of
simulated model + a few ms of application. Nothing the application does between the provider's first
chunk and the loudspeaker is measurable. The floor is therefore the end-of-speech window, and the
second-largest term is the model's own time to first byte, which this environment could not measure.
The only application-caused delays were the second-generation paths (the guard and the recovery
prompt), which turned 1.8 s turns into 5–7 s turns — and those were also the turns whose content was
wrong.

**Human perception.** With the 550 ms double every ordinary turn lands at 1.75–1.95 s, which the
brief's bands call NOTICEABLE DELAY and which feels like a careful listener rather than a lag,
*provided the visible "Pensando…" state appears promptly*. It does, at ≈1.25 s. What felt bad in the
baseline transcripts is not the 1.8 s: it is (a) 5–7 s of silence followed by an English sentence
about 911 in the middle of a Spanish task (S07 turns 3–8, S04 turns 7 and 9, S05 turns 7 and 9,
S08 turn 6, S12 turn 6, S03 turn 16), and (b) 20 s of nothing followed by a dead session (S09).

**What was changed and what was deliberately not changed.** The 1200 ms window was *not* reduced:
lowering it blind trades faster replies for more utterance splitting, which production already
suffers from, and neither side can be measured without the real provider. Instead the two settings
that disagreed (token 1200, client 750) were unified into one constant so the visible state and the
provider agree, and the two application-caused second-generation paths were removed (the guard no
longer discards ordinary speech; recovery lines are spoken by the app itself, in the active language,
without asking the model for a new turn). Expected effect on the real system: the recovery turns fall
from 5–7 s to ≈1.5 s (narration-route TTS) and every ordinary turn keeps its 1.2 s + TTFB floor.

**Regression numbers.** Same harness, same double, 282 spoken turns: response start p50 1819 ms (baseline
1814 ms), p95 2633 ms (baseline 5347 ms), mean 1988 ms (baseline 2269 ms),
maximum 21303 ms (baseline 11681 ms). The median did not move — it is the 1.2 s window plus
the double's fixed 550 ms, and nothing in the fixes touches either — but the tail did: the
second-generation turns fell from 42 to 2, the VERY POOR band from
26 turns to 3, and the POOR band from 15 to 25. The POOR
turns that remain are of two kinds and both are honest: a turn that completes a booking, a search or
an invitation now waits for that work to finish before answering (2.5–2.9 s to "Listo. El viaje
quedó reservado." instead of 1.8 s to "todavía no está reservado"), and the two deliberate
recovery turns (S09 and S21: no transcript → the notice is spoken 6.3 s after the patient stopped,
the 5 s transcript wait plus narration TTS; S09 stalled provider → released at 21 s by design).
Application overhead stayed at 4 ms p50 with four browsers running at once, so the
concurrent runs did not distort the comparison.

**Where the remaining time can only come from.** Model TTFB (choose the fastest Live model variant
and keep `thinkingLevel` minimal — already the case), and the end-of-speech window, which should be
tuned with the real provider using the harness in `PROVIDER=real` mode (§31). A spoken filler is not
recommended; a soft earcon at local speech end would give feedback 0.5 s earlier than "Pensando…"
without adding a model turn, and is left as a recommendation because it needs real-device listening.

## 8. Turn-Taking

*Does EMMI know when the patient finished?* Only by silence. The provider's automatic activity
detection (START_SENSITIVITY_HIGH, END_SENSITIVITY_LOW, 1200 ms of silence) closes the turn; there is
no semantic end-of-turn. In the harness every turn closed 1.20–1.25 s after the injected speech
stopped, never earlier. Production logs (2026-08-30) show the consequence of having only silence to
go on: sentences with a thinking pause were split and answered in halves. That is a provider-side
limit; the application can only choose the window and it keeps 1200 ms (§7).

*Does EMMI respond too soon / cut the patient off?* Not in any harness turn: the local detector and
the provider both wait the full window. *Does she wait too long?* 1.2 s is at the upper end of
natural; the visible "Pensando…" state is what keeps it from feeling like a drop-out.

*Does she talk over the patient?* Two baseline cases, both application bugs rather than the model:
(1) S09 turn 4: a turn with no transcript left the client in USER_SPEAKING, so the next patient turn
started while the app still believed the patient was speaking, and 20 s later the session was
disconnected; (2) the guard/recovery path spoke an English line the patient had not asked for, at
CRITICAL_SAFETY priority, so a patient who talked over it was not honoured until it finished. Both
removed (C2, C6): the missing-transcript path now releases the turn and speaks an interruptible
notice in the patient's language.

*Phantom turns.* A provider transcript that arrives after the audio stopped used to open a new
PATIENT_RESPONSE turn subject to the 20 s watchdog; S13 reproduces the assembly side of this with the
double (`transcriptLagMs`), and the join rule was changed so a late chunk joins its own generation
instead of opening a new bubble (C8).

**Regression.** Every one of the 282 spoken turns on the fixed build left USER_SPEAKING within the
end-of-speech window: the no-transcript turns (S09 turn 4, S21 turn 15) now go USER_SPEAKING →
EMMI_THINKING at ≈ 2.0 s (local end of speech) → EMMI's own "Perdón, no le entendí bien. ¿Me lo
puede repetir?" → LISTENING, and the next patient turn starts from an idle EMMI. The first regression
run had shown this path still frozen (the client stopped its local detector once it was waiting
for an answer); that was root cause RC13, fixed as C14, and the browser probe and the re-run confirm
it. Turns that never finished within the harness limit: 0 (baseline 2).
"EMMI was not idle when the patient spoke" is now reported only where the script means it (barge-ins
and speaking over screen narration in S10/S17), never as a leftover state. S13 (output transcript
lagging 900 ms behind `turnComplete`): the visible thread shows one complete bubble ending in
"…comunicarse con su equipo."; at baseline the tail was lost.

## 9. Interruption Handling

Measured on S03 (four interruptions during long replies), S10 (interrupting the welcome narration)
and S22 ("Stop." during a three-option reply). The metric is the time from the first sample of the
patient's speech to the last sample EMMI played.

| Baseline | Value |
|---|---:|
| Interruptions issued while EMMI was audible | 6 |
| Stop latency from patient speech start, p50 / max | 183 ms / 301 ms |
| Time for the provider to see the speech start and cancel its generation | 140–265 ms |
| Stale chunks of the interrupted reply played afterwards | 0 in every case |
| Interrupted reply resumed by accident | never |

So the mechanical half of barge-in is good: local RMS detection stops playback in under 200 ms
typically and the provider's own interruption arrives ~100 ms later; the application also mutes the
loudspeaker while the patient speaks and the SDK's `interrupted` message drops the rest of the
generation. Two problems sat on top of it at baseline:

1. **The words after the interruption were sometimes thrown away.** "Para." (S03 turn 16) is one
   word of four letters, which the guard classified as a low-information fragment after an
   interruption; the reply EMMI had prepared ("De acuerdo, me detengo.") was discarded and replaced
   with the English 911 line, 3.7 s after the patient spoke and 12.5 s long. "Espera" survived only
   because it is six letters. The fixed guard keeps "para", "espera", "esa", "ese", "eso" and only
   rejects a lone fragment that matches none of EMMI's languages (C1).
2. **The first word could be lost while EMMI was audible.** While EMMI speaks, microphone frames are
   held in a pre-roll and released only after the echo probe confirms real speech; the pre-roll was
   8 frames (≈170 ms) and the probe needs a candidate frame plus three sustained frames, so a short
   first word ("Wait", "Espere") could be sent without its onset. Production logs show exactly that
   ("…" instead of "Wait, …"). The pre-roll is now 16 frames (≈340 ms) (C7). This cannot be validated
   without acoustic echo; the harness has no loudspeaker-to-microphone path.

*Does she understand the new instruction and keep the context?* On the harness, yes in every case:
after "Espera." / "No, quiero otra cosa. ¿Cuál tiene más espacio?" the double called
`describeCurrentView` and the application answered from the same options screen; after "Sí, ya
entendí. La segunda." the selection was executed on the correct option; after "Para." / "Me
equivoqué. Quiero volver a las opciones." the `barrier-back` action returned to the options; after
"Stop." / "Just book the one with more room." the roomiest option was selected. Whether the *real*
model keeps the thread after an interruption is a model-layer property that the production logs
answer "usually" and this audit could not re-verify.

**Regression.** 6 interruptions issued while EMMI was audible, 6 registered by the app;
stop latency p50 162 ms, max 278 ms (baseline 183 / 301 ms);
no stale chunk played after any interruption; no interrupted reply resumed. The content after the
interruption is now honoured every time: "Para." → "De acuerdo, me detengo." (1.8 s, no English
line); "Espera." → "Claro, dígame."; "Sí, ya entendí. La segunda." → UberXL selected; "Stop." /
"Just book the cheapest one." (S22) → the cheapest option selected; "Me equivoqué. Quiero volver a
las opciones." → back to the options through the review screen's own "Change" control, which the
descriptor now exposes (C16). First-word retention with acoustic echo remains
unverified (§30).

## 10. Context Retention

Three memories are involved and only two are the application's:

- **Provider session memory.** Gemini Live keeps the audio/transcript history of the session, with
  context-window compression enabled in the token. The double has no memory, so *model* memory could
  not be tested; every "¿Qué me dijiste?" in the transcripts was answered by the double re-reading the
  screen, not by remembering.
- **Application conversation memory** (`EmmiConversationManager`, 12 turns, 6-turn summary). Used
  for chat, for the recovery text after a reconnect, and now for the rotation handoff (C5): the new
  session receives the resumption handle, so the provider's own history continues.
- **View state as memory.** "Esa." (S01, S05), "Esa misma." (S11), "La del jueves." (S05), "Pon la
   primera." (S02), "el último" (S04), "eso" (S04 turn 3) are all resolved against the current view
   or the current topic list rather than against the transcript. This is the part the application
   owns, and it had one gap: `manageAppointmentTopics` did not resolve "eso"/"esto"/"lo anterior"
   (TOPIC_NOT_FOUND, S04 turn 3) — fixed (C9), and "el último / the last one" now maps to the last
   item.

What breaks context at the application layer, at baseline, is losing the session: S09 (stall →
disconnect) and the 12-minute hard stop both threw away the provider's memory and reconnected
with a text summary at best. C5/C6 keep the session (rotation with resumption; a stall no longer
disconnects on the first occurrence).

**Regression.** The application-owned memory now holds through every reference in the scripts: "eso" → the last
touched topic ("Mareos desde hace dos semanas: sobre todo por la mañana", S04 turn 3), "el último"
→ the last item, "ese" → the last read item, "esa" / "esa misma" / "la del jueves" / "el segundo"
→ the right option or topic. Sessions lost to a stall or a timeout: 0 (baseline 1).
S15 rotated onto a new provider session twice in 130 s without the patient noticing (1
session(s) rotated; baseline hard-stopped at two minutes) and answered "¿Y a qué hora?" and
"¿Dónde es?" after each rotation. The provider's own memory across a rotation is the resumption
handle's job and could not be observed with the double.

## 11. UI Awareness

**What EMMI is given.** Every screen has a view descriptor (`viewContext.js`,
`appointmentViewContext.js`, `careViewContext.js`): `whatThePatientMustDoHere`, the fields on screen
(doctor, date, time, place, pickup time, cost), the choices with ordinals and attributes (cost, seats,
accessibility, arrival), what is *selected* versus *already done* versus *still pending*, the actions
with their kinds (NAVIGATE / SELECT / INPUT / CONFIRM / DESTRUCTIVE), and whether EMMI may press them
herself. The transcripts show the double answering "¿Cuál tiene más espacio?", "¿Cuál es la más
barata?", "¿Cuál llega más temprano?", "¿A qué hora me recogen?", "¿Con qué médico es?", "¿Seguro
que no cambió nada?" correctly from this data alone. That layer is in good shape.

**What EMMI is not given (baseline).** A *spoken* turn carries none of it. Since commit 35a83ac the
silent context channel (`sendClientContent` with `turnComplete:false`, rejected by Gemini 3.1) is
gone and the staged view is only flushed inside app-initiated text turns; the harness recorded 0
context pushes across all navigation taps and 42 spoken turns with a preceding update, each of
those being a recovery text turn. The model therefore knows the screen it saw at connect time plus
whatever it fetched with `describeCurrentView` — and the system prompt told it the view was "already
in context", which is exactly wrong for voice. Consequence in production: answers about a screen the
patient had moved past.

**Changes.** (C12) The prompt now states the truth for voice — the view in context is the one at
connect time; call `describeCurrentView` before any screen answer and before every action — and
(C13) an experimental, default-off channel pushes the staged view as realtime text the moment the
patient starts speaking (`EMMI_VOICE_CONTEXT_ON_SPEECH_START`). It is off because its effect on
Gemini 3.1's turn handling (does a text realtime input during user audio confuse activity detection?)
could not be observed here. Enrollment describers still expose no choices ("Para mí / Para otra
persona" are not in `choices`), so on those screens EMMI can explain but cannot point at an option
by number — unchanged, listed in §30.

**Narration.** The deterministic narration engine covers enrollment screens only, in EN/ES, and falls
back to English for Kreyòl (verified: `buildNarration({locale:"HT"})` returns the English text). Its
texts exceed their own budgets (welcome ES 88 words ≈ 38 s against 12–22 s). Outside enrollment
(appointment, transportation, My Care) nothing is narrated on arrival, so a patient who taps into a
new screen hears silence unless they ask. Unchanged (product decision), §30.

**Regression.** Unchanged by design on the spoken path: 0 of 282 spoken turns had a screen update
sent first (C13 stays off), and every screen answer in the transcripts came from a
`describeCurrentView` call, as the prompt now instructs. What changed is what the tool returns:
after an action, the settled view (booked / failed / sent / changed) instead of a mid-animation
snapshot; on a failed booking, the failure as the pending item and both "Try again" and "Choose
another ride" as actions; on every barrier step that has a back control, that control. Two gaps
remain and are listed in §30: the My Care hub has no descriptor of its own, so "Abre mi cita" from
the hub returns SCREEN_NOT_DESCRIBED (S24 turn 9, both builds), and the enrollment describers expose
no `choices`.

## 12. Action Execution

**The gate works.** `performViewAction` refuses CONFIRM and DESTRUCTIVE controls unless the call
carries `confirmed:true`, and a *selection* never counts as the action: S06 turn 5 ("Invita a María y
después muéstrame la cita") selected María and asked; only "Sí, mándala" sent. S22 exercises the
destructive path ("Actually, cancel it" → confirmation → "Yes, cancel it"). The probes confirmed the
same at the tool level (`evidence/baseline-probes.json`, `action_gate`).

**Three ways an action went wrong at baseline, all in the application:**

1. *Reported before it happened.* Booking, sending, moving and checking run 1.3–2.5 s in the
   background; `performViewAction` returned two frames after the click with `stillPending: "…
   todavía NO se ha reservado"`, so the honest answer to "Sí" was "todavía no está reservado" and no
   one followed up (S01 turn 9, S02 turn 21, S03 turn 20, S08 turn 9, S11 turn 17). Fixed (C3): the
   tool waits up to 8 s for the transient step to settle and returns the settled view with
   `backgroundWork: COMPLETED | STILL_RUNNING`.
2. *Blocked silently by the guard.* When the guard judged the transcript unreliable it answered every
   tool call with `{error: "unreliable_voice_input"}`. S05 turn 9: "Mejor no quiero cambiarla" → the
   `barrier-close` was blocked, yet the model (double) had already been told to say "De acuerdo, su
   cita se queda como estaba"; the patient was left on the review screen. S08 turn 6: "Ninguna ayuda.
   Busca ya." → three blocked actions, then the next request ("La más barata y resérvala") selected
   "No, ninguna" on the needs screen and the confirmation failed with UNKNOWN_ACTION — a task the
   patient could not finish (P1 by the brief's definition). Removed with the guard rewrite (C1).
3. *Wrong screen.* S12 turn 2 called `barrier-video-start` on the reschedule offer because the
   *audit script* used the in-person option order for a video visit; the application correctly
   answered UNKNOWN_ACTION and did nothing. Script corrected for the regression (option 2 is the
   video option for TELEHEALTH visits, per `preVisitCheckOptions`). Kept here because it shows the
   safe failure mode.

**"Listo" only when it is done.** The double's replies are derived from `alreadyDone` /
`stillPending`, so on the harness "Listo. El viaje quedó reservado." only appears when the view says
so. For the real model this is a prompt rule (VOICE CONVERSATION section, C12) backed by the tool
result now carrying `backgroundWork` — it cannot be proven here.

**Regression.** Tool calls blocked by the guard: 0 (baseline 44). Every "Sí"
after a confirmation question was answered from the settled state: "Listo. El viaje quedó
reservado." (S01, S03, S11, S22 first booking), "Listo. La invitación fue enviada." (S06, S18, S20),
"Listo. La cita cambió." (S18), and — where the simulator rejected the ride (S02, S08, S16, S20,
S22 second booking; `barrierProviders.reserve` rejects one option id in eleven) — "No se pudo
reservar: el proveedor no estaba disponible. No se cobró nada." followed by a retry or another
vehicle. No transcript on the fixed build contains "Listo" for an action the tool result did not
report as done. The destructive path holds: S22 "Actually, cancel it." first answers the pending
return-trip question, opens the cancel confirmation, and cancels only after "Yes, cancel it.";
"Wait, no! I do need it after all." restarts from the cancelled state's own "Arrange another ride".
Actions that the app refuses are refused honestly: `barrier-video-start` on the wrong screen,
`appointment-open` on the hub, enrollment controls that are the patient's to press (S10 "Can you
pick it for me?" → "I can't press that one for you on this screen").

## 13. Appointment Topics

Sessions S04, S11, S19 (add, update, list, remove last, restore, read item, replace by reference,
remove by content). Baseline results:

- Add/list/remove/read by index: correct, ~1.8 s per turn.
- "Pon que son sobre todo por la mañana" (S04 turn 3) → TOPIC_NOT_FOUND: the reference resolver only
  knew "ese/esa/that/it". Fixed (C9): "eso/esto/este/esta/that one/this one/the same/lo mismo/lo
  anterior…" → last touched topic (falls back to the newest), "el último/the last one" → last item.
- "No, me equivoqué. Ponlo otra vez." (turn 7) and "Cambia ese por 'mareos al levantarme'." (turn 9)
  were discarded by the guard — the correction and the replacement never happened, and the patient
  heard the English 911 line each time (4.6–4.7 s). Removed with C1.
- The list persisted across the topic switch to "¿qué es ACCESS?" and back (turns 10–11) because it
  lives in app state, not in the model.

**Regression.** S04 and S19 on the fixed build: all 16 topic operations executed (add, add with detail through
"eso", list, remove last, restore, read first, replace by "ese", replace by ordinal, remove by
content, re-add), no discarded turn, no English line, 1.7–1.9 s each. The list survived the topic
switches to ACCESS and cost and the six-second silence.

## 14. Goals

Goals were exercised through the My Care hub (S24: `getPatientGoals`, `getNextBestAction`,
`getAssignedDevice`) and the probes (`my_care_and_goals_es`: goals tool, care team, upcoming
appointments, next best action, My Care view). Findings:

- The goal tools return the patient's assigned goals (blood pressure control, weight management) and
  the resolver's next step; the My Care descriptor names the goal cards and their status.
- Goal screens have no narration and no spoken arrival cue (§11); the goal barrier flow
  (`select-goal-barrier`, `recordGoalBarrier`) was not driven by voice in this audit because the
  brief's flows centre on the appointment surfaces — listed as untested in §30.
- `pause-goal` is correctly declared DESTRUCTIVE in the care descriptor, so the confirmation gate
  applies.

**Regression.** S24: the four hub tools (`getNextBestAction`, `getPatientGoals`, `getCareTeam`,
`getUpcomingAppointments`), the medication list and the assigned-device state answered from the
seeded record in 1.7–1.9 s each; the reading with a symptom went through
`evaluateClinicalEscalation`. Unchanged by the fixes; no regression.

## 15. Transportation

The most exercised flow: S01 (EMMI-driven), S02 (patient-driven by taps), S03 (interruptions),
S08 (safety in the middle), S11, S16, S20, S22 (EN, with cancel and rebook). What works at the
application layer: offer → pickup (home address read back, never asked again) → needs → time →
search (2.5 s) → options with ordinal, cost, seats, accessibility, arrival → review → booking (2 s)
→ return-trip offer; "la más barata", "la que tiene más espacio", "la que llega más temprano",
"la primera", "esa" all resolve; the return trip and the cancel path exist as actions.

Baseline defects on this flow: the early booking result (§12.1, five sessions), the guard cascade
(S08), the "Uso walker" / "Quiero un Uber X" rejections (S07), and "Para." during the options
readout (S03). In S02 the patient's own taps pushed no context, so every "¿Qué opciones tengo?"
depended on the model calling `describeCurrentView` (the double did; the real model must, §11).

**Regression.** Eight transportation conversations on the fixed build (S01, S02, S03, S08, S11, S16, S20, S22): the
flow completes by tool calls and by taps, the address is read back and never asked again, the
options are answered by cost, space and arrival, the booking is reported when it is booked, the
failed bookings are reported as failed with a way forward, the return trip is offered and declined,
and the cancel path works through its confirmation. The one flaw left in this flow is a wording
one in the *double* (it says "Estoy reservando el viaje" in the same breath as the failure) and is
not application behaviour.

## 16. Companion

S06, S18 (second intent), S20 (Spanglish). The contacts come from the Care Circle ("Maria (Hija)",
"Carlos (Hijo)"); "¿Y la otra?" resolves by ordinal; the privacy answer ("solo la fecha, la hora y el
lugar") is scripted in the double but is also what the product rules say. The confirmation gate holds
(select ≠ send). In the simulator the invitation is *answered* immediately — the view after sending
says "Maria dijo que sí y le acompañará" — and at baseline the audit's own reply policy looked for
"enviada" and told the patient "Todavía no" (S06 turns 6 and 8). That was a harness error, not an
application one; the policy now reads the `alreadyDone` text as it is. The application's view was
correct in both turns.

**Regression.** S06, S18, S20: contacts listed with relationship, "¿Y la otra?" by ordinal, privacy answer,
selection ≠ send, confirmation, "Listo. La invitación fue enviada. Invitación enviada a Maria", and
the simulator's immediate acceptance read back correctly ("Maria dijo que sí y le acompañará") —
including in Spanglish ("Okay, send it a María" / "Yes, mándala"), which the first regression run
had turned into a session rebuild in English (RC14, fixed as C15).

## 17. Reschedule

S05 (change of mind) and S18 (multi-intent, afternoon slot). The slot list arrives as choices with
dates, so "¿Qué horarios hay?", "¿Qué horarios me dijiste?", "la del jueves" and "mejor por la
tarde" can be answered from the view. Baseline defects:

- "La del jueves." (S05 turn 7) was discarded by the guard: the `describeCurrentView` call was
  blocked and the patient heard the English 911 line 4.35 s later. "Esa." on the next turn then
  selected the Thursday slot correctly, because the view still held it.
- "Mejor no quiero cambiarla." (turn 9) was discarded too; the `barrier-close` was blocked
  (`unreliable_voice_input`) while the scripted reply said the visit stayed as it was. The visit
  *did* stay as it was — nothing had been confirmed — but the patient was left on the review screen
  believing they had left it. Removed with C1.
- The slot labels show times such as "5:15 a. m." for a clinic slot; the simulator formats slot
  times in the runner's time zone and the repository's own unit test for this
  (`tests/appointmentSupport.test.js`, time-zone case) fails on this machine before any change. Not
  touched (pre-existing, outside the voice path), noted in §30 because a spoken "cinco y cuarto de la
  mañana" would sound wrong to a patient.
- The chat path cannot handle the retraction at all ("Mejor no quiero cambiarla" → generic answer,
  `baseline-probes.json` › `my_care_and_goals_es.chat`); it needs conversation state the text
  router does not carry. Unchanged, §30.

**Regression.** S05 and S18: slots read by day, "la del jueves" answered (1.8 s), "mejor por la tarde" answered,
the chosen slot confirmed only on "Confirma." and reported as changed only when the view says so,
the new date and time read back. The retraction "Mejor no quiero cambiarla" now steps back through
the review screen's "Choose another time" control (exposed by the descriptor change) with nothing
confirmed and the visit unchanged. The "5:15 a. m." slot label and the chat-path retraction remain
(§30).

## 18. Video Visit

S12 and S21 (elderly, one-word answers, long silences, an inaudible turn in the middle). The device
check runs ~3 s and reports microphone, camera, connection and link as `stillPending` items; the
guide and recheck actions exist and the view tells EMMI what is still failing. Baseline: the audit
script opened the wrong barrier option for a TELEHEALTH visit (§12.3), so S12 measured the
application's refusal rather than the check itself; "Ya lo hice. Revisa otra vez." (turn 6) was then
discarded by the guard. Both scripts now use the video option (ordinal 2 for video visits).

**Regression.** S12 and S21 with the correct option: the device check runs, "¿Qué falta?" names the failing camera,
the guide opens, the recheck runs, and the inaudible turn in the middle of S21 ends in EMMI's own
Spanish notice and the task continues ("Ya." → recheck → "Todavía falta: Cámara…"). One-word answers
("¿Eh?", "¿Qué?", "Sí.", "Ya.", "Repita.") were all accepted.

## 19. Enrollment

S10 (EN, welcome interrupted, screens by hand) and S17 (ES, the whole journey: invitation → who is
completing → identity typed → what care includes → eligibility notice and check → consent → enrolled
→ care setup). Observations that hold before and after:

- Screen narration is deterministic and spoken through the TTS route; it starts on every screen
  change, so a patient who moves fast is talking over narration on every screen (S10 turn 4 was
  spoken while the DECISION_MAKER narration was still playing — barge-in stopped it in 171 ms). The
  Spanish welcome is 88 words (≈ 38 s at TTS pace) against a 12–22 s budget; the other objectives
  are 3–4 sentences each. Unchanged (§11, §30).
- On the invitation screen EMMI may not press "Comenzar" (`youMayPressTheseYourself: false`) and
  says so; on the identity screen the date of birth and ZIP are typed, never spoken, and the double
  refuses to take them by voice as the prompt requires.
- The enrollment describers publish `whatThePatientMustDoHere` but no `choices`, so "Lo hago yo
  misma" can only be answered as "deje marcada la primera opción" rather than by pointing at the
  option (§11).
- The eligibility check and consent are check-box + button steps that EMMI cannot perform (correct:
  consent is the patient's alone); after each the enrolled state is visible to EMMI through the
  view ("¿Entonces ya estoy inscrita?" → not until consent; "¿Ya?" after consent → enrolled).

**Regression.** S10 and S17 on the fixed build: "Lo hago yo misma." and "¿Ya?" — both discarded at baseline — are
answered; the barge-in on the welcome narration stops it in 162 ms (S10); the identity
fields are typed; the eligibility check and consent are performed by the patient and the enrolled
state is read back correctly. Narration length and the missing enrollment `choices` are unchanged
(§30).

## 20. My Care

Every session starts on the hub and S24 stays there for eleven turns: next best action, goals,
care team, next appointment, medication list, a home reading with a symptom (routed through
`evaluateClinicalEscalation`), the monitor's fulfilment state, then "Abre mi cita" by voice
(`performViewAction: appointment-open`). All tools returned real data from the seeded record; the
hub descriptor lists the cards. What is missing is narration on arrival and any spoken cue when the
hub changes (§11).

**Regression.** S24 unchanged in behaviour (all tools answered), with one open gap: "Abre mi cita" cannot be
executed from the hub because the hub has no view descriptor (§30, P3).

## 21. Topic Switching

Exercised in S04 (topics → "¿qué es ACCESS?" → "volvamos a la lista"), S19 (topics → ACCESS →
cost → back to the list → a reading → back), S24 (appointment → monitor → back to the appointment)
and S08 (task → chest pain → task). At the application layer a topic switch costs nothing: the
screen and the topic list are state, so returning to them is a `describeCurrentView` or a
`manageAppointmentTopics LIST` away, and every return in the transcripts came back with the right
data. Whether the *model* returns gracefully ("Bueno, volvamos a la lista") is a model property that
the double scripts and the real provider was not available to test.

**Regression.** Every return to the previous task in S04, S19, S24 and S08 came back with the right data on the
fixed build, and — new — none of the switch or return sentences was discarded ("Bueno, volvamos a
la lista", "Ok. Volviendo a la lista, ¿cuántos hay?", "Vale. Volvamos a la cita. ¿A qué hora?").

## 22. Multi-Intent

"Rápido, necesito transporte para la cita y también quiero cambiar la hora" (S08), "Invita a María
y después muéstrame la cita" (S06), "Cambia la cita al jueves y avísale a mi hija" (S18). The
application executed each chain the double asked for (open barrier → choose reason → start) in one
turn and the second intent was completed later from the same view state. Baseline failure: the S08
chain was cut by the guard (§12.2). The double sequences the intents explicitly ("voy por partes");
the prompt's VOICE CONVERSATION section asks the real model to do the same and to say which one it
is doing first.

**Regression.** S08's chain now executes in one turn (three actions, 2.8 s including the search), S06 and S18
complete both intents in order, and S18 returns to the second intent ("Ahora lo de mi hija") from
the changed-visit screen through four tool calls.

## 23. Language

Spanish primary (S01–S09, S11–S13, S16–S21, S24), English (S10, S14 start, S22), Spanglish (S07,
S20), Haitian Creole sample (S23), spoken switch requests (S07 turn 8, S14, S23).

**Baseline.** The transcript guard rejected (a) ordinary sentences whose language the detector could
not settle — "Yo uso walker para caminar", "Quiero un Uber X", "Mi doctor dijo que no", "Pon la
primera del jueves", "180 sobre 120 y me siento mareado" — and (b) any sentence in a supported
language other than the session's, which is what every switch request is: "Can we switch to English
please?" inside a Spanish session was answered with the English 911 line, and the Spanish request
inside an English session (S14) was discarded as an unexpected language, answered with the English 911 line 2.9 s later, and the next Spanish question was blocked too (`unreliable_voice_input`); the UI stayed in English and no session was rebuilt. The Kreyòl sample: narration falls back to English
(`buildNarration` has no HT text), view labels and actions are in Kreyòl, and the UI language cycle
en → es → ht works.

**Changes.** C1: language mismatch is a *signal* (`languageSwitchCandidate`), never a rejection; weak
evidence is `confidence: LOW`, telemetry only. C11: an explicit request ("hable conmigo en español",
"switch to English", "pale kreyòl") switches immediately; two consecutive turns in another supported
language switch implicitly; a switch rebuilds the Live session in the new language (system prompt,
voice, narration) keeping the click-activated audio context, and EMMI confirms in the new language
("Perfecto, seguimos en español."). Emergency language is exempt from implicit switching
(`detectEmergencyLanguage`), so a distressed patient is never answered with a language change.

**Regression.** Turns discarded by the guard: 0 (baseline 42). S07: all nine
Spanglish and plain-Spanish sentences answered; "Can we switch to English please?" rebuilt the
session in English in 1.4 s and the next turns were answered in the new session. S14: "Prefiero
hablar en español. Hable conmigo en español ahora." switched the UI and the session to Spanish
(html lang `es`, second provider session) and "¿A qué hora es mi cita?" was answered afterwards. S20:
"Ella habla English, ¿le llega en English?" is no longer read as a request (C15). S23: Kreyòl
speech in a Spanish session is answered and acted on (a language signal is logged, nothing is
discarded) and the request "Pale kreyòl avè m, tanpri" leaves the session alive in Spanish —
voice is not offered in Kreyòl (VOICE_UNAVAILABLE_FOR_LOCALE) and the prompt now tells the model to
say so (C17, unverified with the real model).

## 24. Patient Confusion

Profiles A and C across S02, S09, S16, S21 (and S13). What the application contributes when a
patient says "No sé qué tengo que hacer", "¿Eh? No entendí", "¿Qué me dijiste?", "Más despacio":

- The view descriptor's `whatThePatientMustDoHere` and `stillPending` give the model a plain
  sentence to fall back on, and every "¿Y ahora?" / "¿Qué hago aquí?" in the transcripts was
  answered from it.
- The chat path answered "¿Qué hago aquí?" on the transportation screen with the emergency page
  (retrieval ranked `safety/emergencies.md` first). Fixed (C10): "¿Qué hago aquí?", "¿Qué hago
  ahora?", "¿Y ahora?", "What now?" route to the screen explanation.
- A patient who repeats "¿Eh?" or says nothing for 6–12 s hears nothing from EMMI (correct: no
  spontaneous speech during silence, verified in S09 and S19) and the microphone stays open.
- Simplification ("Le explico más sencillo…") and slowing down are model behaviours; the double
  scripts them, the prompt asks for them, the real model was not tested.

**Regression.** S02, S16, S21: every "no entendí", "¿qué me dijiste?", "más despacio", "¿eh?" turn answered from the
view or the script; "No, me recoge mi hija" (S16) and "Lo hago yo misma" (S17), discarded at
baseline, are answered; the chat-path routing fix (C10) sends "¿Qué hago aquí?" to the screen
explanation (unit-tested; the chat path was not re-driven in the browser).

## 25. Error Recovery

S09 (12 s silence, a turn without transcript, a provider that never answers), S21 (inaudible turn
mid-task), S15 (token expiry), plus the unit suite for reconnects.

**Baseline.** A turn with no transcript left the client in USER_SPEAKING (no audible reply, the
next patient turn overlapped it), the 20 s turn watchdog then raised `VOICE_RESPONSE_TIMEOUT` and
*disconnected*; "¿Sigues ahí?" got no answer and the session was dead. When a transcript did not
arrive within 5 s the app asked the *model* to say "I'm sorry, I didn't hear that clearly. Please say
it again. If this may be a medical emergency, call 911 now." — English inside Spanish sessions,
alarming on every miss, and at a priority the patient could not interrupt. At 12 minutes the session
hard-stopped.

**Changes.** C2: the app speaks its own recovery lines through the narration route, in the active
language ("Perdón, no le entendí bien. ¿Me lo puede repetir?"), interruptible, never as a model
turn; the emergency reminder only on the second consecutive miss. C6: a stalled turn is released
("Perdón, me tardé demasiado. ¿Me lo repite?") and the session kept; only two consecutive stalls
disconnect, and the existing reconnect (3 attempts, resumption handle, recovery text) then applies.
C5: one minute before the token limit the session is rotated silently while idle (resumption
handle), with the hard stop kept only when the provider never issued a handle.

**Regression.** S09 on the fixed build: 12 s of silence → nothing said (correct); no transcript → "Perdón, no le
entendí bien. ¿Me lo puede repetir?" in EMMI's own voice 6.3 s after the patient stopped, session
kept; stalled provider → "Perdón, me tardé demasiado. ¿Me lo repite?" at 21 s, turn released,
session kept, "¿Sigues ahí?" answered 1.8 s later. Recovery notices spoken by the app:
3; English recovery lines heard: 0 (baseline
42). S15: two silent rotations across the two-minute token limit, all three
questions answered, no hard stop.

## 26. Safety Regression

What was checked so that the conversational changes did not weaken safety:

- **Emergency mid-task** (S08): "dolor fuerte en el pecho ahora" → `evaluateClinicalEscalation` →
  EMERGENCY → "Llame al 911 ahora mismo" → task resumed only after the patient said they were fine.
  Same before and after.
- **Reading plus symptom** (S24): "150 con 95 y me duele un poco la cabeza" → the tool decides
  severity; the double never states one itself.
- **The report the guard used to swallow** (S07 turn 7): "180 sobre 120 y me siento mareado" was
  discarded at baseline and answered with the canned 911 line *by accident* — the escalation tool
  never ran. After C1 the sentence reaches the model and the tool (regression: "180 sobre 120 y me siento mareado." reached the double with no suppression and no tool block
(1.8 s); on the real model this is the turn that must call `evaluateClinicalEscalation`.).
- **Emergency language and language switching**: an implicit switch is skipped when
  `detectEmergencyLanguage` fires; an explicit request still switches (a patient asking for their
  language is not a symptom).
- **Recovery lines**: the second consecutive miss still says "Si esto puede ser una emergencia,
  llame al 911", so a patient who cannot be heard twice is still told what to do.
- **Action gate**: unchanged; `tests/emmiViewContext*.test.js`, `tests/emmiAudioPipeline.test.js`,
  the e2e `emmi-view-context.spec.js` gate cases pass (the two e2e booking-flow cases that fail do so
  on the pristine baseline as well, §29).
- **Privacy**: date of birth and ZIP are typed, never spoken (S17); companion sees date/time/place
  only (S06/S20); nothing new is logged in the audit trail beyond telemetry event names.
- **Unit suite**: 1375 passed, 1 failed (59 files; 17 tests added) — the same pre-existing time-zone failure, nothing else.

No safety rule was relaxed; the only text that mentions 911 less often is the first-miss recovery
line, which previously said it for every unheard word.

## 27. Root Causes

Each root cause below was located in code and confirmed by executing that code (unit probe, browser
probe or harness session). Where the cause could only be confirmed against the real provider, it says so.

| # | Symptom (baseline) | Root cause | Where | Confirmation |
|---|---|---|---|---|
| RC1 | Ordinary Spanish/English sentences rejected; every language-switch request rejected; the rejection line is English and mentions 911 | `assessEmmiTranscriptReliability` treated *weak language evidence* (≥3 words, no two marker words, no accent, no English request pattern) and *any supported language other than the session's* as ASR corruption; the client then suppressed the answer, blocked tools and asked the model to say a fixed English line at CRITICAL_SAFETY priority | `src/emmi/transcript.js`, `src/emmi/liveClient.js` (`handleMessage` inputTranscription, `turnComplete`) | Node probe over 38 utterances; harness S07 (baseline) |
| RC2 | Spoken turns answered without the current screen | Commit 35a83ac replaced the silent `sendClientContent(turnComplete:false)` context channel (rejected by Gemini 3.1) with staging that is flushed only by app-initiated realtime *text* turns; audio turns flush nothing | `liveClient.sendContextUpdate`, `sendPreparedTurnToLive` | Harness: provider log shows no `[TRUSTED LIVE CONTEXT UPDATE]` before any spoken turn; navigation taps push 0 |
| RC3 | Alarming, uninterruptible, English recovery | Missing-transcript watchdog and ASR override both *asked the model* to say a hard-coded English sentence ending in "call 911", tagged CRITICAL_SAFETY (local barge-in deferred) | `liveClient.waitForPatientTranscript`, `emmiAsrClarificationInstruction` | Harness S09 baseline: the recovery text the app sent |
| RC4 | "Sí" to the booking answered with "todavía no está reservado"; no follow-up when it completes | `performEmmiViewAction` returned two animation frames after the click; booking/search/send/change/check run 1.3–2.5 s asynchronously; voice receives no push on completion | `src/app.js performEmmiViewAction` | Baseline probe `bookConfirmed.currentView.stillPending`; harness S01 turn 9, S03, S08 |
| RC5 | Latency floor ≈1.2 s; UI "Pensando…" before the provider closes the turn | Token `liveConnectConstraints` with `lockAdditionalFields: []` lock `silenceDurationMs: 1200`; the client requested 750 and the local VAD ended speech at 750 | `server/emmiLiveToken.js`, `liveClient.js`, `bargeInManager.js` | SDK docs (`CreateAuthTokenConfig` "Case 4"); harness VAD window p50 1.24 s |
| RC6 | Session dies at 12 min; a 20 s stall ends the session | `startTimers` hard `disconnect("session_timeout")`; turn watchdog `disconnect("VOICE_RESPONSE_TIMEOUT")` on the first stall; phantom PATIENT_RESPONSE turns from late transcripts are subject to it | `liveClient.startTimers`, `touchTurnWatchdog` | Unit tests; harness S09 baseline (stall → disconnect) |
| RC7 | First word of an interruption lost ("Espere", "Wait") | While EMMI is audible, microphone frames are held in an 8-frame pre-roll (~170 ms); the echo probe needs a candidate frame plus 3 sustained frames, and a failed probe resets; speech older than the pre-roll is never sent | `liveClient.handleMicFrame`, `maxMicPrerollFrames` | Production logs 2026-08-30 (turns 2, 16; QA-CONV-010); cannot be measured without acoustic echo |
| RC8 | Orphan transcript tails after an answer | `onTranscript` joined a chunk to the previous bubble only while `!last.voiceComplete`; a provider's final transcript commonly lags `turnComplete` | `src/app.js onTranscript` | Harness S13 (double with `transcriptLagMs`) |
| RC9 | "Pon que son sobre todo por la mañana" → TOPIC_NOT_FOUND | `resolveIndex` mapped only `ese|esa|that|it` to the last topic | `src/app.js onAppointmentTopics` | Baseline probe `topics_tool_es` |
| RC10 | Chat answers "¿Qué hago aquí?" with the emergency page | `SCREEN_HELP` had no "qué hago" form; retrieval ranked `safety/emergencies.md` first and the fallback returned its approved answer | `src/emmi/textOrchestrator.js` | Baseline probe `chat_on_transportation_es` |
| RC11 | Narrations 20–38 s; silence outside enrollment | Narration objectives are four sentences each and exceed their own budgets; no objectives exist for appointment, transportation, goals-detail or My Care screens | `src/emmi/narrative.js` | Node probe over every screen |
| RC12 (model layer, not re-verified) | Utterances split at pauses; refusal inverted; fabricated facts | Provider VAD has no semantic end-of-turn; the model acted on partial transcripts | Provider + prompt | 2026-08-30 production logs only |
| RC13 | A turn the provider never transcribes leaves the client in USER_SPEAKING until the patient speaks again (S09 turn 4, S21 turn 15); with the 20 s watchdog this ended the session at baseline | Once EMMI is waiting for an answer (`awaitingPatientResponse`, true after almost every reply), `handleMicFrame` forwards frames to the provider and stops running the local detector, so the local end of speech that arms the transcript watchdog never fires; the state advances only when a transcript arrives | `liveClient.handleMicFrame` | Browser probe on the fixed build before this change (8 s in USER_SPEAKING); harness S09/S21 after the first regression run |
| RC14 | "Ella habla English, ¿le llega en English?" rebuilt the session in English (S20, first regression run) | The first version of the request detector accepted any sentence with a verb of speaking plus a language name; a mention of someone else's language passed | `transcript.js detectLanguageRequest` (introduced by C1/C11, caught in regression) | Harness S20 after; unit test |
| RC15 | After a failed booking EMMI said "falta su confirmación en la pantalla de revisión" (S02/S16 after, first run) and could not offer another vehicle | The BOOKING_FAILED view kept the "chosen but NOT booked — needs your confirmation" pending item and exposed only `barrier-retry`, although the screen also offers "Choose another ride" | `appointmentViewContext.js` | Harness S02/S16/S22; simulator rule: one ride in eleven is rejected (`barrierProviders.reserve`, `seed % 11`) |
| RC16 (product limit, not changed) | A Kreyòl session cannot start voice; a Kreyòl request inside a Spanish session cannot be honoured | `emmiVoiceIsSupported` covers EN/ES; the guide shows VOICE_UNAVAILABLE_FOR_LOCALE; narration has no HT text | `app.js`, `emmi/messages.js`, `narrative.js` | Harness S23 (first version failed at voice start); probe |

## 28. Changes Implemented

Scope rule followed: every change is in the voice path or in a deterministic piece the voice path
depends on; no refactor beyond that; no change to clinical safety rules. Unit suite after changes:
1375 passed, 1 failed (59 files; 17 tests added) — the same pre-existing time-zone failure, nothing else.

| Change | Files | Fixes | Verified by |
|---|---|---|---|
| C1 Transcript guard rewritten: only an unsupported script or a lone post-interruption fragment discards a turn; weak language evidence becomes `confidence: LOW` (telemetry only); a supported other language becomes `languageSwitchCandidate`; explicit requests ("hable conmigo en español", "switch to English") become `languageRequest` | `src/emmi/transcript.js`, `liveClient.js` | RC1 | `tests/emmiTranscript.test.js`, `tests/emmiAudioPipeline.test.js`; harness S07/S14 |
| C2 Recovery lines spoken by the app itself, in the active language, through the narration route (`speakLocalNotice`): "Perdón, no le entendí bien. ¿Me lo puede repetir?"; the emergency reminder only on the second consecutive miss; interruptible; never a model turn | `liveClient.js`, `transcript.js` (`emmiRecoveryLine`) | RC3 | `tests/emmiAudioPipeline.test.js`, `tests/emmiVoiceSession.test.js`; harness S09 |
| C3 `performViewAction` waits (≤8 s) for background steps (SEARCHING, BOOKING, RETURN_BOOKING, SENDING, CHANGING, CHECKING, CLASSIFYING) to settle, reports `backgroundWork: COMPLETED/STILL_RUNNING`, and returns the settled view; tool status labels for `performViewAction`, `describeCurrentView`, `manageAppointmentTopics` | `src/app.js` | RC4 | Harness S01/S03/S08/S11 ("Listo. El viaje quedó reservado." right after "Sí") |
| C4 One end-of-speech window (`src/emmi/voiceTurnConfig.js`, 1200 ms) read by the token builder, the client and the local detector | `voiceTurnConfig.js`, `server/emmiLiveToken.js`, `liveClient.js`, `bargeInManager.js` | RC5 | `tests/emmi-token.test.js`, `tests/emmiBargeIn.test.js` |
| C5 Session rotation one minute before the token limit, silent, resumption-based, only when idle; `preserveOutput` on every proactive handoff so mobile audio survives; hard stop kept only as last resort | `liveClient.js` | RC6 | `tests/emmiVoiceSession.test.js`; harness S15 |
| C6 Stalled turn: release, apologise in EMMI's own voice, keep the session; disconnect only after two consecutive stalls | `liveClient.js` | RC6 | `tests/emmiAudioPipeline.test.js`; harness S09 |
| C7 Barge-in pre-roll 16 frames (~340 ms) | `liveClient.js` | RC7 | Existing pre-roll unit test; real-echo validation pending |
| C8 A transcript piece that arrives after the reply drained (within 4 s, before the patient speaks) is delivered to that reply (`EMMI_LATE_TRANSCRIPT_JOINED`) and the app joins it to the same bubble by generation | `liveClient.js`, `src/app.js` | RC8 | `tests/emmiAudioPipeline.test.js` (late output transcript); harness S13: one complete bubble (baseline: tail lost) |
| C9 Topic references: "eso/esto/this one/lo anterior…" → last touched topic (falls back to the newest); "el último/the last one" → last item | `src/app.js` | RC9 | Probe rerun (`topics_tool_es`), harness S04 |
| C10 Chat routes "¿Qué hago aquí?", "¿Qué hago ahora?", "¿Y ahora?", "What now?" to the screen explanation | `src/emmi/textOrchestrator.js` | RC10 | `tests/emmiTextOrchestrator.test.js` |
| C11 Spoken language switch: explicit request switches at once, two consecutive turns in another supported language switch implicitly; the session is rebuilt in the new language and EMMI confirms in it ("Perfecto, seguimos en español.") | `src/app.js`, `liveClient.restartForLocale` | RC1 (switch half) | Harness S14; `tests/emmiVoiceSession.test.js` |
| C12 System prompt: a VOICE CONVERSATION section (answer first, summarize choices, spoken numbers, use known data, no repeated disclaimers, stop when interrupted, confirm important actions naturally) and an accurate view-freshness rule for voice (call `describeCurrentView` before screen answers and every action) | `src/emmi/systemPrompt.js`, prompt version v6 | RC2 (mitigation), RC12 (partial) | Not verifiable without the provider — flagged |
| C14 The local speech detector keeps running while EMMI waits for the patient's answer, so the end of speech is detected and the transcript watchdog is armed; a turn without a transcript now ends in "Perdón, no le entendí bien…" instead of a frozen USER_SPEAKING state | `liveClient.handleMicFrame` | RC13 | `tests/emmiAudioPipeline.test.js` ("keeps the local detector running…"); browser probe; harness S09/S21 |
| C15 Language requests must be addressed to EMMI (hábleme en…, can we switch to…, pale kreyòl avè m); mentions of someone else's language are ignored; short real words after an interruption ("ya", "vale", "dale", "bien", "eh"…) are speech | `transcript.js` | RC14, RC1 (fragment rule) | `tests/emmiTranscript.test.js`; harness S17 ("¿Ya?"), S20 |
| C16 Failed booking: the pending item is the failure itself, and EMMI may offer "Choose another ride" as well as "Try again"; every barrier step whose screen has a back control (pickup, needs, time, options, review, cancel confirmation, guide, contacts) now exposes it as a NAVIGATE action labelled by where it leads, so "me equivoqué", "quiero volver a las opciones" and "mejor no" can be honoured | `appointmentViewContext.js` | RC15, and the baseline's `barrier-back` refusals (S03 turn 17, S05 turn 9) | `tests/emmiViewContext.test.js`; harness S03, S05, S22 |
| C17 Prompt: voice exists in English and Spanish only; a spoken request for Kreyòl is answered in the active language with the text alternative | `systemPrompt.js` | RC16 (mitigation) | Not verifiable without the provider — flagged |
| C13 Experimental, off by default: `EMMI_VOICE_CONTEXT_ON_SPEECH_START` pushes the staged view as realtime text the moment the patient starts speaking | `liveClient.pushContextOnSpeechStart`, `config.js`, `vite.config.js` | RC2 | Requires a real-provider check before enabling — flagged |

Not changed, deliberately: the narration texts (RC11) — their length is a product decision that
should be made with the numbers in `baseline.md` §4.8 in hand; the 1200 ms window value itself
(retuning it blind would trade splitting for speed with no way to measure either); the chat
retraction case ("Mejor no quiero cambiarla") which needs conversation state the text router does
not carry; the enrollment describers' lack of choices.

## 29. Before vs After

Same harness, same double (550 ms model delay, 2.4 words/s speech), same scripts. "Before" is the
pristine baseline commit; "after" is the fixed branch served from a second dev server. The two runs
overlapped in time on the same 4-core machine (up to four browsers at once); the application-overhead
row is there to show whether that affected the measurements.

### 29.1 Measured (application layer)

| Metric | Before | After |
|---|---:|---:|
| Sessions / spoken turns / recorded turns | 24 / 282 / 364 | 24 / 282 / 364 |
| Long sessions (≥ 15 spoken turns) | 9 | 9 |
| Response start T2−T1, average | 2269 ms | 1988 ms |
| Response start p50 | 1814 ms (NOTICEABLE DELAY) | 1819 ms (NOTICEABLE DELAY) |
| Response start p95 | 5347 ms | 2633 ms |
| Response start max | 11681 ms | 21303 ms |
| Turns by band FAST / ACCEPTABLE / NOTICEABLE / POOR / VERY POOR | 0 / 0 / 236 / 15 / 26 | 0 / 2 / 252 / 25 / 3 |
| Provider end-of-speech window p50 | 1234 ms | 1240 ms |
| Local speech-end ("Pensando…") after T1, p50 | 1249 ms | 1228 ms |
| Application overhead first chunk → audible, p50 / p95 | 4 / 3601 ms | 4 / 8 ms |
| Turns answered through a second generation or an app notice (guard at baseline; the two no-transcript recoveries after) | 42 | 2 |
| Turns discarded by the transcript guard | 42 | 0 |
| Tool calls blocked as `unreliable_voice_input` | 44 | 0 |
| English "call 911" recovery lines heard | 42 | 0 |
| Recovery notices spoken by the app in the session language | 0 | 3 |
| Barge-ins issued while EMMI was audible / registered by the app | 6 / 6 | 6 / 6 |
| Barge-in stop latency p50 / max | 183 / 301 ms | 162 / 278 ms |
| Spoken turns with a screen-context update sent first | 42 / 282 | 0 / 282 |
| Navigation taps pushed to the provider | 0 / 40 | 0 / 40 |
| Sessions lost to a stall / timeout | 1 | 0 |
| Sessions rotated silently across the token limit | 0 | 1 |
| Turns that never finished (30 s harness limit) | 2 | 0 |
| Problems flagged by the harness (all kinds) | 87 | 61 |

Reading the table: the median response start cannot change on the harness because it is made of the
locked 1.2 s window and the double's fixed 550 ms; what the fixes change is everything above the
median — the second-generation turns, the English lines, the blocked tools, the discarded
sentences, the frozen states and the lost session — and the POOR turns that remain are the honest
waits for a booking to finish and the two deliberate recovery notices. Barge-in numbers are
unchanged within noise because the interruption mechanics were already sound; what changed is that
the words after the interruption are kept. The counts of harness-flagged problems include the
"no screen context before answer" flag on every spoken screen question, which is unchanged by
design (C13 off).

### 29.2 Scores (1–5)

Application layer, measured on the harness; the model-layer column is unchanged from
`baseline.md` §8 because no model turn was observed in this audit.

| Metric | Before | After | Why |
|---|---:|---:|---|
| Overall conversation quality | 2.3 | 3.6 | Ordinary sentences answered and acted on; failed and slow work reported honestly; recovery in the patient's language; sessions survive stalls, switches and token expiry. Model layer untested. |
| Context retention | 2 | 4 | Topic and option references resolve; sessions no longer lost; rotation keeps the resumption handle. |
| Turn-taking | 2 | 3 | One window everywhere and the state machine always leaves USER_SPEAKING; the 1.2 s floor and provider-side splitting remain. |
| Latency | 2 | 3 | Tail cut (second generations gone), median unchanged by construction; real TTFB unknown. |
| Naturalness | 2 | 3 | Recovery in EMMI's voice and language, one-word and Spanglish turns accepted; narrations still long. |
| Conciseness | 2 | 2 | Narrations untouched; the prompt's voice rules are unverified. |
| Clarity | 3 | 4 | Settled results, failure states with a way forward, spoken confirmations. |
| Action accuracy | 3 | 4 | Reported when done, refused when unknown, gate intact, back controls available. |
| UI awareness | 3 | 3 | Rich descriptors and `describeCurrentView` rule; still no push on spoken turns; hub and enrollment gaps. |
| Recovery from errors | 2 | 4 | No-transcript, stall, expiry and language-switch paths all keep the session. |
| Interruption handling | 3 | 4 | Words after the interruption kept; 340 ms pre-roll unverified with echo. |
| Patient effort | 2 | 4 | 0 discarded sentences in 282; the patient no longer repeats or re-navigates. |

### 29.3 Test suites

| Suite | Before (pristine main) | After (fixed branch) |
|---|---|---|
| Unit (`vitest`, 59 files) | 1358 passed, 1 failed (58 files) — the failure is `tests/appointmentSupport.test.js` "counts back from the visit for each slot", a time-zone-dependent reminder test that fails on this UTC machine before any change | 1375 passed, 1 failed (59 files; 17 tests added) — the same pre-existing time-zone failure, nothing else |
| e2e subset (`emmi-view-context`, `appointments-emmi`, `emmiAudioPipeline`, `emmi-conversation`) | (pending) | (pending) |

## 30. Remaining Issues

Ordered by the brief's classes. "Open" means still present on the fixed branch; "unverified" means
the fix exists but could not be validated without the real provider.

**P0 — none open.** No safety, privacy or action-integrity defect remains in the application layer:
the confirmation gate holds in every session, the escalation tool is the only source of severity,
identity fields are typed, and no action is reported done before its state says so.

**P1**

1. *Model-layer conversation quality is unverified (open).* Everything Gemini Live does with a
   spoken turn — ASR accuracy on Spanish and Spanglish, splitting at pauses, whether it calls
   `describeCurrentView` before answering, the wording of its refusals, whether it stays in the
   patient's language — was last observed on 2026-08-30 and is not covered by any test here. The
   changes give it correct tools, correct context rules and a voice style, but the last real logs
   showed utterances split at pauses, one refusal answered as a confirmation and one fabricated
   fact. Until a `PROVIDER=real` run of the same 24 scripts is clean, the conversation cannot be
   called ready.
2. *Screen context on spoken turns still depends on the model calling `describeCurrentView`
   (open, mitigated).* The prompt now says so explicitly and every action result carries the fresh
   view, but a model that answers a screen question from memory will still answer about the wrong
   screen. The realtime-text push on speech start (C13) is implemented and off; it needs one
   real-provider session to confirm it does not disturb activity detection before it is enabled.

**P2**

3. *Barge-in onset with acoustic echo (unverified).* The 340 ms pre-roll and the echo probe were
   exercised only with an injected microphone signal and no loudspeaker path. Production logs
   showed lost first words; the fix is plausible, not proven. Needs a phone-in-hand test.
4. *End-of-speech window of 1200 ms (open by design).* It is now one constant everywhere and the
   visible state matches it, but it is still the largest term in every turn. Tuning it requires the
   real provider (§31.2).
5. *Narration length and coverage (open, product decision).* Enrollment narrations run 20–38 s
   against 12–22 s budgets; appointment, transportation, goals and My Care screens have no
   arrival narration; Kreyòl narration falls back to English. The numbers are in `baseline.md`
   §4.8; the texts were not rewritten because that is content, not code.

**P3**

6. *Enrollment describers publish no `choices`* (who is completing, care recommendation), so EMMI
   can explain those screens but cannot point at "the first option" by number.
7. *Chat cannot handle a retraction* ("Mejor no quiero cambiarla") because the text router carries
   no conversation state; voice handles it through the view.
8. *Slot times such as "5:15 a. m."* come from the appointment simulator formatting in the
   machine's time zone; the repository's own time-zone unit test fails on this machine before any
   change. Spoken aloud these times would sound wrong. Outside the voice path; not touched.
9. *Two e2e booking-flow cases and two scheduling cases fail on the pristine baseline and on the
   fixed branch alike* (`emmi-view-context.spec.js` "selected is never reported as done" and
   "refuses to book… without confirming", `appointments-emmi.spec.js` two request cases): the
   simulated flow ends in "Your care team is arranging your ride" where the tests expect a
   reservation. Same root as item 8 (date-keyed simulator). Pre-existing; listed so nobody
   attributes them to this branch.

**P4**

10. Recovery-line wording in Kreyòl was written for this audit and not reviewed by a speaker.
11. Telemetry for `EMMI_ASR_LOW_CONFIDENCE` and `EMMI_LANGUAGE_SIGNAL` is emitted but not yet
    surfaced in the QA metrics page.
12. The goal-barrier voice flow (`recordGoalBarrier`) and medication refill voice flow were not
    driven in this audit.

## 31. Final Recommendations

**31.1 Before any patient hears this build**

1. Run the same 24 scripts against Gemini Live with `PROVIDER=real` (the harness is ready for it:
   `harness/README.md`), with recorded Spanish utterances as the microphone signal, on the
   production model and voice. Score them with the same rubric. This is the single missing
   validation and it decides readiness.
2. In that run, enable `EMMI_VOICE_CONTEXT_ON_SPEECH_START=true` for half of the sessions and
   compare (a) screen-question correctness and (b) any change in end-of-speech behaviour. Keep it on
   only if (b) is clean.
3. Listen to barge-in on a real phone with the loudspeaker on: "Espere", "Para", "No" over a long
   reply. Confirm the first word reaches the transcript.

**31.2 Tuning that needs the real provider**

4. Sweep `EMMI_END_OF_SPEECH_SILENCE_MS` at 900 / 1000 / 1200 with the same recordings and count
   split utterances against response-start p50. The one constant in `voiceTurnConfig.js` is the
   only place to change it.
5. Measure model TTFB per turn from the harness's `provider_first_chunk_at`; if it exceeds 1 s at
   p50, an earcon at local speech end is the cheapest perceived-latency win and does not add a
   model turn.

**31.3 Product content**

6. Rewrite the enrollment narrations to their budgets (welcome ≤ 22 s) and add a one-sentence
   arrival line for appointment, transportation and My Care screens; add Kreyòl narration or state
   in the UI that voice guidance is in English/Spanish only.
7. Review the recovery and confirmation lines in `transcript.js` (`LINES`) with Spanish- and
   Kreyòl-speaking clinicians.

**31.4 Engineering follow-ups**

8. Add `choices` to the enrollment describers (decision maker, care recommendation).
9. Give the chat router the last assistant proposal so "mejor no" can retract it.
10. Fix the simulator's slot formatting to the clinic's time zone; the failing time-zone unit test
    and the four e2e cases will follow.
11. Keep the harness in CI in `PROVIDER=fake` mode for the application-layer guarantees this audit
    established: no guard suppression of natural speech, no English recovery lines in Spanish
    sessions, background work settled before "Listo", session survives a stall, rotation before
    expiry.

## 32. Readiness

**NOT READY** for patient-facing voice.

What is true on the fixed branch: the application layer no longer breaks ordinary conversations.
Across 282 spoken turns in 24 sessions on the fixed build, no natural sentence
was discarded, no tool call was blocked as unreliable, no English recovery line was spoken in a
Spanish session, every "Sí" to a confirmation was answered from the settled state, a stalled
provider and a missing transcript were recovered in the patient's language without losing the
session, a spoken request to change language was honoured, and a session crossed its token limit
without the patient noticing.

What is not true yet: none of that was heard through Gemini Live. The model's own contribution to
the conversation — recognising Spanish and Spanglish as spoken by older adults, not answering half
a sentence, fetching the screen before answering, saying "Listo" only when the tool says so, staying
concise in a voice — is exactly the part the last real sessions (2026-08-30) showed failing, and it
was not re-observed here because the environment had no credential. The brief's rule is explicit: a
build is not READY while problems that break normal conversations may remain, and the model-layer
problems may remain.

**Conditions for READY WITH CONDITIONS**, in order:

1. A real-provider run of the 24 scripts (§31.1) with no P1 finding: no split-utterance answer that
   acts on half a request, no wrong-screen answer, no "Listo" without a completed action, no
   language drift.
2. Barge-in first-word retention confirmed on a phone (§31.1.3).
3. A decision on `EMMI_VOICE_CONTEXT_ON_SPEECH_START` backed by that run.

**Conditions for READY**, additionally: narrations within budget on the screens patients hear most
(§31.3), the end-of-speech window tuned against real recordings (§31.2), and the time-zone
formatting fixed so spoken times are correct.
