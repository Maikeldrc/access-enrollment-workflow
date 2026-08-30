# Live EMMI Patient Issues

Date: 2026-08-29
Status convention: OPEN — TEST AUDIT

---

## LIVE-VOICE-001 — Home voice guide remains in `Thinking…`

- Severity: **High**
- Area: Home / automatic voice guidance / status state machine
- Reproduction: Home in English -> click **Guide by voice** -> wait through `Thinking…` and `Speaking…`.
- Expected: playback completes and the UI returns to an idle/ready state; **Repeat** becomes available.
- Actual: UI returned to `Thinking…` and remained there for more than 14 seconds; **Repeat** stayed disabled and no error/retry state appeared.
- Evidence: live visible browser DOM state on 2026-08-29; no corresponding console error besides the ephemeral-token experimental warning.
- Status: **FIXED IN CODE — PENDING LIVE VERIFICATION**
- Correction: added bounded provider-turn and missing-transcript watchdogs, a localized timeout state, deterministic cleanup, and regression coverage.

## LIVE-VOICE-002 — English ASR collapses under a strong non-native accent

- Severity: **High**
- Area: Conversational ASR / English locale / older-patient accessibility
- Reproduction: English conversation -> submit clear English sentences using the installed Spanish-system voice at a slow rate.
- Expected: preserve enough intent to answer “What is ACCESS?” and a short “Wait/stop, explain simply” interruption.
- Actual: first utterance became mixed Spanish/Italian; the interruption became unrelated German-like text. Switching to a native US-English system voice produced near-verbatim transcription, isolating an accent-robustness gap.
- Impact: multilingual or strongly accented Medicare patients can lose their entire intent, including during barge-in.
- Status: **FIXED IN CODE — PENDING LIVE VERIFICATION**
- Correction: added transcript reliability assessment for unexpected-language and long low-language-evidence ASR results, a trusted clarification override, telemetry, and regression coverage.

## LIVE-VOICE-003 — Cost response remains permanently fragmented

- Severity: **Critical**
- Area: Realtime response assembly / voice conversation
- Reproduction: after a valid English voice turn, barge in with “Wait. What would I have to pay for this program?”
- Expected: a complete, bounded response that avoids unsupported cost claims and offers escalation.
- Actual: EMMI rendered two separate fragments — “I can't confirm exactly what your payment would be” and “care team?” — with the middle/end missing; it never completed after additional waits.
- Impact: patient receives unusable financial-program guidance and may infer missing content.
- Status: **FIXED IN CODE — PENDING LIVE VERIFICATION**
- Correction: a patient voice turn now receives its `generationId` as soon as input transcription arrives, before any assistant transcript/audio fragments, keeping the full response in one atomic turn.
