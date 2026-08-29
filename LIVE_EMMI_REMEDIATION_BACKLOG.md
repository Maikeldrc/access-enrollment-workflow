# Live EMMI Remediation Backlog

Date: 2026-08-29

No fixes are implemented during this audit. Items are added only after live reproduction.

---

| Priority | Issue | Proposed correction | Acceptance criterion |
|---|---|---|---|
| P0 | LIVE-VOICE-001 | Add a bounded timeout and explicit recovery path to Home voice generation/playback; always clear `thinking/speaking` flags in terminal and error branches; expose retry and diagnostics. | In 20 consecutive runs, Home voice reaches ready/idle after playback or a clear recoverable error within the defined SLA; **Repeat** is never stranded disabled. |
| P0 | LIVE-VOICE-003 | Make realtime text/audio assembly atomic per assistant turn; prevent barge-in cancellation from committing partial fragments; retry or show an explicit recoverable failure when a stream terminates abnormally. | Cost answer is complete and semantically bounded in 20/20 repetitions, including immediate barge-in; no orphan fragments become separate EMMI messages. |
| P1 | LIVE-VOICE-002 | Add accented-English ASR evaluation and locale/model adaptation; retain raw confidence/language signals and offer a concise confirmation when confidence is low. | Test set covering Spanish-accented English preserves primary intent at the agreed WER/intent threshold; barge-in words such as “wait/stop” are reliably detected. |

## Implementation update — 2026-08-29

- LIVE-VOICE-001: implemented; unit/integration verification passed; production recheck pending deployment.
- LIVE-VOICE-002: deterministic clarification guard implemented for unexpected-language and long low-language-evidence transcripts; broader real-accent corpus remains a future quality improvement.
- LIVE-VOICE-003: early patient-response generation allocation implemented so assistant fragments share one `generationId`; production recheck pending deployment.
- Automated verification: **821/821 unit/integration tests**, **50/50 EMMI E2E tests**, and production build passed.
