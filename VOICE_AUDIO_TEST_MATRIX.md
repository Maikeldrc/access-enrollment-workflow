# EMMI voice/audio test matrix

| Test | Expected | Actual | Result | Severity | Evidence |
|---|---|---|---|---|---|
| Production voice connection | Token, Gemini session, audio response | Connected and reached `Speaking` five consecutive times | PASS | — | Live browser measurements |
| Permission accepted | Mic capture begins | Production session reached Gemini audio; local E2E constructs one media stream/worklet | PASS/PARTIAL | — | Live + E2E |
| Permission denied | Localized text fallback | Automated E2E passed simulated denial | PASS | — | `e2e/emmi.spec.js` |
| AudioWorklet | Modern capture, no ScriptProcessor | Worklet created; no ScriptProcessor in instrumented E2E | PASS | — | `e2e/emmiAudioPipeline.spec.js` |
| Five repeated starts | No random failure | 5/5 reached `Speaking` | PASS | — | 1.35–1.91 s |
| Twenty consecutive spoken turns | 20/20 complete | No controllable injected mic source; not executed | BLOCKED | Certification gap | Environment limitation |
| Welcome quality | One concise, complete introduction | Many expanded segments/questions; about 40 s; displayed as one giant turn | FAIL | HIGH | Production transcript |
| Sentence completion | No cutoff | Initial observation ended mid-fragment, later continued and ultimately completed; exact audible endpoint unavailable | PARTIAL | HIGH | State/transcript observation |
| No overlapping output | One stream | Source-generation guards exist; not audibly certified | PARTIAL | HIGH | Code + unit tests only |
| Barge-in | Stop in 150–500 ms and answer | TTS through speakers was suppressed/not captured; no user transcript | BLOCKED | Certification gap | Live attempt |
| False barge-in / echo | Ignore trivial/self audio | System TTS was not transcribed, consistent with echo suppression; broader noise suite not run | PARTIAL | — | Live attempt |
| Slow/soft/long speech | Preserve utterance | Not testable without controlled microphone fixture | BLOCKED | Certification gap | — |
| EN multi-turn | Maintain immediate context | Basic facts worked; pronoun/follow-up simplification lost context | FAIL | HIGH | Production turns |
| ES switch | Natural confirmation | `Sí.` failed; `sí` succeeded | FAIL | HIGH | Production turns |
| ES safety | Emergency first | Correct 911 response and persistence | PASS | — | Production turns |
| ES patient-specific device | Runtime/tool grounding | Generic ACCESS answer, no device lookup response | FAIL | HIGH | Production turn |
| Kreyòl | Text only; never Korean | Locale mapping/tests pass; live audio correctly unsupported by design | PASS/PARTIAL | — | Source + tests |
| Voice identity | Sulafat across contexts | Identity guard/config verified; cross-screen audible identity not sampled | PARTIAL | MEDIUM | Source + unit tests |
| Reconnect/session expiry | Graceful resume | Three-attempt logic and resumption handle exist; expiry not forced live | PARTIAL | HIGH | Source only |
| Resource release | Stop streams, contexts, nodes | Instrumented local E2E passed start/stop/reopen/rapid toggle | PASS | — | 4 audio-pipeline E2E tests |
| Close overlay | Voice persists by intended global-guidance lifecycle | Source and live UI consistent; close-during-speech not timed | PARTIAL | MEDIUM | Source + live |
| Console | No app errors | One SDK warning: ephemeral token support experimental | PASS with warning | LOW | Live console |
| Secret exposure | No long-lived API key client-side | Server-only key and ephemeral token boundary; no secret printed | PASS code review | — | Source/build inspection |
| Cross-browser/viewports | Chrome/Edge/WebKit and required sizes | Local mobile E2E passed supported widths; only in-app Chromium used live | PARTIAL | Certification gap | E2E + live |
