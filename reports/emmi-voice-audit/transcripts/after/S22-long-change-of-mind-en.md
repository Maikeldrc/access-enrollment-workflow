# Voice session S22-long-change-of-mind-en

- patient_profile: D (changes their mind)
- language: en
- flow: long (EN): book a ride, cancel it through the destructive gate, change mind again, rebook a ride the provider rejects, recover by choosing another, with a barge-in on the way
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T04:54:16.092Z
- finished: 2026-09-04T04:58:03.151Z

19 spoken turns in English. 'Actually cancel it' → 'Wait, no!' → rebook. The simulator rejects one ride in eleven deterministically (UberX for this visit), so the second booking fails: EMMI must say so, offer a retry and another vehicle, never 'Done'. Includes a long reply interrupted with 'Stop.'

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | I can't get to my appointment. | I can't get to my appointment. | I can arrange a ride. Should we pick you up at home, 123 Oak Avenue, Apt 4B · Miami, FL 33176? | 1901 | NOTICEABLE DELAY | 10719 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 3 | speech | BARRIER_TRANSPORTATION_PICKUP | Yes, my home address. | Yes, my home address. | Do you need any special help to travel? | 1760 | NOTICEABLE DELAY | 5094 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS |  |
| 4 | speech | BARRIER_TRANSPORTATION_NEEDS | No, nothing special. | No, nothing special. | Check the suggested pickup time, then look for rides — or choose a different time. | 1822 | NOTICEABLE DELAY | 8090 | performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_TIME |  |
| 5 | speech | BARRIER_TRANSPORTATION_TIME | Go ahead and search. | Go ahead and search. | Looking for rides. | 2671 | POOR | 3936 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_TIME → BARRIER_TRANSPORTATION_OPTIONS | response start 2671 ms |
| 6 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 7 | speech | BARRIER_TRANSPORTATION_OPTIONS | What are my options? | What are my options? | I found 3 rides. UberX, $27.95; UberXL, $41.68; Uber WAV, $33.00. Which one? | 1810 | NOTICEABLE DELAY | 7225 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 8 | speech | BARRIER_TRANSPORTATION_OPTIONS | The one with more room. | The one with more room. | I selected UberXL. Before I book it: More room · $41.68 · 9:40 AM. Shall I? | 1859 | NOTICEABLE DELAY | 8557 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 9 | speech | BARRIER_TRANSPORTATION_REVIEW | Yes, book it. | Yes, book it. | Done. Your ride is booked. | 2662 | POOR | 4749 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_RETURN_OFFER | response start 2662 ms |
| 10 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 11 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Is it booked? | Is it booked? | Yes, the ride is booked. | 1814 | NOTICEABLE DELAY | 3895 | describeCurrentView→ | same view |  |
| 12 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Hmm. Actually, cancel it. | Hmm. Actually, cancel it. | I can't cancel from this screen. | 1816 | NOTICEABLE DELAY | 4310 | performViewAction→UNKNOWN_ACTION | same view |  |
| 13 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Yes, cancel it. | Yes, cancel it. | The ride was not cancelled. | 1830 | NOTICEABLE DELAY | 3915 | performViewAction→UNKNOWN_ACTION | same view |  |
| 14 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Wait, no! I do need it after all. | Wait, no! I do need it after all. | No pude completar ese paso: UNKNOWN_ACTION. | 1778 | NOTICEABLE DELAY | 4274 | performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION | same view |  |
| 15 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 16 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Tell me about all of them. | Tell me about all of them. | Sure. The first is UberX, a standard car for twenty-seven ninety-five, picking you up at nine forty-five. The second is UberXL, with more room, for forty-one sixty-eight, picking you up at nine forty. The third is Uber WAV, wheelchair accessible, for thirty-three dollars, picking you up at nine thirty-five. All of them arrive before ten ten. | 1735 | NOTICEABLE DELAY |  |  | same view |  |
| 17 | speech (barge-in) | BARRIER_TRANSPORTATION_RETURN_OFFER | Stop. | Stop. | Okay. | 1819 | NOTICEABLE DELAY | 2423 |  | same view |  |
| 18 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Just book the cheapest one. | Just book the cheapest one. | I selected UberXL. Do you want me to book it? | 1870 | NOTICEABLE DELAY | 6046 | describeCurrentView→; performViewAction→UNKNOWN_ACTION | same view | expected view REVIEW, got BARRIER_TRANSPORTATION_RETURN_OFFER |
| 19 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Yes. | Yes. | I'm booking it now. It is not confirmed yet.  | 1796 | NOTICEABLE DELAY | 5551 | performViewAction→UNKNOWN_ACTION | same view |  |
| 20 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 21 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Done? | Done? | Yes, the ride is booked. | 1815 | NOTICEABLE DELAY | 3896 | describeCurrentView→ | same view |  |
| 22 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Try again. | Try again. | I'm booking it now. It is not confirmed yet.  | 1762 | NOTICEABLE DELAY | 5518 | performViewAction→UNKNOWN_ACTION | same view |  |
| 23 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 24 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Still nothing? Then the big one instead. | Still nothing? Then the big one instead. | No pude completar ese paso: UNKNOWN_ACTION. | 1816 | NOTICEABLE DELAY | 4310 | performViewAction→UNKNOWN_ACTION | same view | expected view REVIEW, got BARRIER_TRANSPORTATION_RETURN_OFFER |
| 25 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Yes. | Yes. | I'm booking it now. It is not confirmed yet.  | 1728 | NOTICEABLE DELAY | 5477 | performViewAction→UNKNOWN_ACTION | same view |  |
| 26 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 27 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Is it booked now? | Is it booked now? | Yes, the ride is booked. | 1781 | NOTICEABLE DELAY | 3860 | describeCurrentView→ | same view |  |
| 28 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Thanks. | Thanks. | You're welcome. | 1830 | NOTICEABLE DELAY | 2671 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 21,
  "total_turns": 28,
  "response_start_p50_ms": 1816,
  "response_start_p95_ms": 2662,
  "response_start_avg_ms": 1889,
  "app_overhead_p50_ms": 3,
  "barge_ins": 1,
  "barge_in_stop_p50_ms": 152,
  "barge_in_stop_max_ms": 152,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 5: response start 2671 ms",
    "turn 7: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 9: response start 2662 ms",
    "turn 18: expected view REVIEW, got BARRIER_TRANSPORTATION_RETURN_OFFER",
    "turn 24: expected view REVIEW, got BARRIER_TRANSPORTATION_RETURN_OFFER"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 851 ms after tap
