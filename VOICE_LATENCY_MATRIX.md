# EMMI voice latency matrix

True conversational T0–T4 measurement was not available because the selected production browser did not expose a controllable microphone injection or audible-output tap. The values below are real production measurements from user activation to the first `Speaking…` state, which occurs when the first response audio chunk is accepted for playback. They are startup proxies, not T4−T0.

| Turn ID | Scenario | Language | Cold/Warm | T0 | T1 | T2 | T3 | T4 | T4−T0 | Barge-in | Result |
|---|---|---|---|---|---|---|---|---|---:|---|---|
| START-01 | Voice enable to first speaking state | EN | Warm reconnect | click | Not observable | Not observable | state `Speaking` | Proxy | 1,658 ms | N/T | PASS proxy |
| START-02 | Voice enable to first speaking state | EN | Warm reconnect | click | Not observable | Not observable | state `Speaking` | Proxy | 1,905 ms | N/T | PASS proxy |
| START-03 | Voice enable to first speaking state | EN | Warm reconnect | click | Not observable | Not observable | state `Speaking` | Proxy | 1,348 ms | N/T | PASS proxy |
| START-04 | Voice enable to first speaking state | EN | Warm reconnect | click | Not observable | Not observable | state `Speaking` | Proxy | 1,452 ms | N/T | PASS proxy |
| START-05 | Voice enable to first speaking state | EN | Warm reconnect | click | Not observable | Not observable | state `Speaking` | Proxy | 1,674 ms | N/T | PASS proxy |
| LIVE-WELCOME-01 | Initial welcome duration until `Listening` | EN | Cold | N/A | N/A | N/A | N/A | N/A | about 40 s total output | N/T | FAIL UX |

Proxy statistics: min 1,348 ms; max 1,905 ms; median 1,658 ms; p90 1,905 ms; p95 1,905 ms (nearest-rank, n=5).

Missing required measurements: 20 normal voice T0–T4 turns, cold/warm split, end-of-speech latency, playback scheduling delta T4−T3, and barge-in onset-to-stop median/p90/max.
