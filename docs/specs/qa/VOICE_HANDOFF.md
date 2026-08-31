# Voice: what is fixed, what is not, and one lead

For whoever runs the voice pass with a real microphone. Decided 2026-08-30: the session with the
live browser and audio owns this.

## What I did not touch

The audio path. `liveClient.js`, the microphone capture, barge-in, and the voice transcript pipeline
are as they were. Nothing in the text-chat work should be read as evidence about them.

Still uncertified, all from `LIVE_EMMI_VOICE_QA_RETEST_2026-08-30.md`:

- **EMMI-LIVE-013** — speaking produces no patient transcript. This is the blocker; everything below
  depends on it.
- **EMMI-LIVE-008** — spoken language switching.
- **EMMI-LIVE-009** — natural-pause turn splitting.
- **EMMI-LIVE-006** — barge-in content loss.
- **EMMI-LIVE-010** — silence and echo producing false patient turns.
- **RETEST-NEW-004** — stale narration replayed after a failed capture.

## What did change underneath, and is worth re-checking by voice

These are text-path fixes, but voice reaches the same code, so a voice pass should confirm them
rather than assume them:

- **An emergency episode can now end.** Saying help was called or has arrived closes it, as does the
  patient saying the symptoms passed. Resolution is checked *before* the emergency gate, because the
  words for "help is here" contain the words that raise an emergency. Spoken resolution has never
  been tested. `src/emmi/safetyPolicy.js`, `detectSafetyResolution`.
- **Episodes expire after four hours** and no longer survive a reload once resolved.
- **Focused knowledge answers** — eCKM, the ACCESS blood pressure targets, A1c, the comparison group
  and the 90-day term now have pages. Spoken paraphrases are untested.

## One lead on EMMI-LIVE-002, the fragmented output

I could not reproduce the orphan fragments without the audio path, but there is one mechanism in the
transcript assembly that would produce exactly the reported symptom. Check it first.

In `src/app.js`, `onTranscript` joins a new transcript chunk onto the previous message only while
`!last.voiceComplete`. `onTurnComplete` sets that flag as soon as the provider reports the turn done
and the audio has drained. A transcript delta arriving after those two — which is ordinary, because
a provider's final transcript commonly lags its audio — therefore cannot join its own message and is
pushed as a new one. That is an orphan tail like "comunicarse con su equipo", and it matches the
report's note that an answer "appeared as a partial fragment and only completed several seconds
later".

If confirmed, the fix is to let `generationId` decide the identity of a turn rather than the
completion flag: a chunk carrying the same generation belongs to that message whether or not the
turn was marked complete, falling back to the current rule when no generation id is present.

**I deliberately did not make that change.** It is unverifiable without the live path, and an
unverified edit to voice assembly would leave the next QA pass unable to tell whether a change in
behaviour came from their fixes or from mine.

## What to run

The exit criteria in the re-test still stand as written. The two that matter most:

1. Twenty ordinary spoken turns, each producing one complete **user transcript** — the assertion has
   to be on the patient's transcript, not on the assistant's reply.
2. A spoken emergency, then a spoken "I called 911", then an ordinary question. That path is now
   deterministic in text and completely untested in voice.
