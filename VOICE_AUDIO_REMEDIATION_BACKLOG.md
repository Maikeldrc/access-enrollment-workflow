# EMMI voice/audio remediation backlog

## Execution update — 2026-08-29

The application-level remediation is complete for VA-002 through VA-005 and the audio lifecycle portion of VA-006. Implemented: one bounded welcome turn, literal narration constraints, transcript turn boundaries, provider-complete versus audible-drain separation, first-audio/drain telemetry, pre-audio false-barge-in prevention, stale transcript rejection, punctuated language confirmations, recent-turn repeat/simplify resolution, and runtime-grounded device and care-team answers.

Verification: 809/809 unit tests; production build; 449/449 distinct Playwright scenarios passed, with one startup timeout under the full parallel run that passed on retry and again in an isolated no-retry run. The real Gemini welcome passed as one bounded turn and completed only after audible drain.

Remaining release work is outside the corrected application behavior: VA-001 production governance and the physical-device/acoustic/cross-browser portions of VA-006. Those cannot be truthfully certified from a Chromium virtual-microphone run.

## Original backlog and disposition

1. Safety/privacy/security
   - Establish an approved real-patient environment and encrypted audit service.
   - Complete privacy, consent, retention, redaction, access-control and clinical governance.
   - Add deployment gates preventing prototype mode from being labeled patient-ready.
2. Core audio pipeline
   - Add a deterministic QA audio input/output harness with virtual mic, loopback capture and timestamps.
   - Preserve existing AudioWorklet-only capture and cleanup contracts.
3. Sentence completion and stream completion
   - Prevent generative expansion of semantic narration segments.
   - Emit one concise welcome with one terminal question and explicit turn boundaries.
   - Add audio-buffer drain/completion telemetry separate from provider `turnComplete`.
4. Conversation/context correctness
   - Resolve pronouns and “repeat/simplify that” against recent turns.
   - Answer referring-doctor questions directly from runtime context.
5. Tool/runtime grounding
   - Make patient-specific status questions tool-mandatory in every locale.
   - Add unknown/unavailable responses that never fall back to generic knowledge.
6. Barge-in
   - Certify local detection and provider confirmation with real speech, false-noise, echo and repeated interruptions.
   - Record onset, stop and stale-chunk metrics.
7. Latency
   - Instrument T0–T4 and publish cold/warm median, p90 and p95 for at least 20 turns/language.
8. Reconnect/recovery
   - Force token/session expiry, go-away, network drop and audio-device change; prove context retention and single pipeline.
9. Language
   - Normalize affirmative/negative confirmations including ASR punctuation.
   - Run 10-turn EN and ES voice sequences; document Kreyòl as text-only.
10. UI/polish
    - Keep transcript turns separate; prevent giant merged assistant bubbles.
    - Show a clear “ready to speak” indication after mic/worklet initialization.
