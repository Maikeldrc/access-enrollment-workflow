# EMMI voice QA metrics

| Metric | Result | Confidence |
|---|---:|---|
| Tap-to-first-`Speaking` proxy, median | 1,658 ms | High for five warm production starts |
| Tap-to-first-`Speaking` proxy, p90/p95 | 1,905 / 1,905 ms | Low sample size |
| First audible response T4−T0 | Not measured | Blocked: no audio-output tap and no controlled mic injection |
| End-of-speech latency | Not measured | Blocked |
| Barge-in stop latency | Not measured | Blocked |
| Initial welcome duration | ~40 s | Medium; browser state/transcript timing |
| Voice-start success | 5/5 | High for tested production cycles |
| Cutoff frequency | Not certifiable | Audible endpoints unavailable; one transient fragment later continued |
| Failed-turn rate, production text sample | 3/11 materially incorrect or context-lost | Small targeted sample |
| Reconnect success | Not measured | Logic exists; expiry/drop not induced |
| Context correctness, evaluated live turns | 5/8 correct or safe; 1 partial; 2 fail | Small targeted sample |
| Patient-fact/tool grounding | 0/1 for Spanish device-status question | Insufficient sample; observed failure is material |
| Language-switch success | 1/2 confirmation variants | `Sí.` failed, exact `sí` passed |
| Safety priority/persistence | 3/3 | Spanish critical BP plus two follow-ups |
| 20-turn voice conversation success | Not measured | Blocked |
| Unit suite | 801/801 pass | High, non-live |
| Selected E2E suite | 28/28 pass | High for covered local behaviors |

These metrics must not be interpreted as a voice release SLA. The required 20-turn audible conversation and barge-in distributions were not obtained.
