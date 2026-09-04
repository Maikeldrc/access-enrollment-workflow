# Voice session S22-long-change-of-mind-en

- patient_profile: D (changes their mind)
- language: en
- flow: long (EN): book a ride, cancel it through the destructive gate, change mind again, rebook a ride the provider rejects, recover by choosing another, with a barge-in on the way
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T20:34:25.716Z
- finished: 2026-09-04T20:39:34.540Z

19 spoken turns in English. 'Actually cancel it' → 'Wait, no!' → rebook. The simulator rejects one ride in eleven deterministically (UberX for this visit), so the second booking fails: EMMI must say so, offer a retry and another vehicle, never 'Done'. Includes a long reply interrupted with 'Stop.'

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | I can't get to my appointment. | I can't get to my appointment. | I can arrange a ride. Should we pick you up at home, 123 Oak Avenue, Apt 4B · Miami, FL 33176? | 1905 | NOTICEABLE DELAY | 10870 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 3 | speech | BARRIER_TRANSPORTATION_PICKUP | Yes, my home address. | Yes, my home address. | Do you need any special help to travel? ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 8330 | VERY POOR | 14303 | performViewAction→ | same view | response start 8330 ms |
| 4 | speech | BARRIER_TRANSPORTATION_PICKUP | No, nothing special. | No, nothing special. | You can continue here. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 6866 | VERY POOR | 12599 | performViewAction→; performViewAction→ | same view | response start 6866 ms; expected view TIME, got BARRIER_TRANSPORTATION_PICKUP |
| 5 | speech | BARRIER_TRANSPORTATION_PICKUP | Go ahead and search. | Go ahead and search. | Looking for rides. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 6612 | VERY POOR | 12339 | performViewAction→ | same view | response start 6612 ms |
| 6 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 7 | speech | BARRIER_TRANSPORTATION_PICKUP | What are my options? | What are my options? | I found 1 rides. Home. Which one? | 1827 | NOTICEABLE DELAY | 4746 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 8 | speech | BARRIER_TRANSPORTATION_PICKUP | The one with more room. | The one with more room. | I selected it. Before I book it: . Shall I? | 1848 | NOTICEABLE DELAY | 6097 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS | expected view REVIEW, got BARRIER_TRANSPORTATION_NEEDS |
| 9 | speech | BARRIER_TRANSPORTATION_NEEDS | Yes, book it. | Yes, book it. | I'm booking it now. It is not confirmed yet.  ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 8655 | VERY POOR | 14891 | performViewAction→ | same view | response start 8655 ms |
| 10 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 11 | speech | BARRIER_TRANSPORTATION_NEEDS | Is it booked? | Is it booked? | Not yet. Choose any special help you need for the journey, then continue. | 1816 | NOTICEABLE DELAY | 7345 | describeCurrentView→ | same view |  |
| 12 | speech | BARRIER_TRANSPORTATION_NEEDS | Hmm. Actually, cancel it. | Hmm. Actually, cancel it. | I can't cancel from this screen. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 7863 | VERY POOR | 13617 | performViewAction→ | same view | response start 7863 ms |
| 13 | speech | BARRIER_TRANSPORTATION_NEEDS | Yes, cancel it. | Yes, cancel it. | The ride was not cancelled. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 6646 | VERY POOR | 13149 | performViewAction→; performViewAction→ | same view | response start 6646 ms |
| 14 | speech | BARRIER_TRANSPORTATION_NEEDS | Wait, no! I do need it after all. | Wait, no! I do need it after all. | No pude completar ese paso: UNKNOWN_ACTION. | 1740 | NOTICEABLE DELAY | 4237 | performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION | same view |  |
| 15 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 16 | speech | BARRIER_TRANSPORTATION_NEEDS | Tell me about all of them. | Tell me about all of them. | Sure. The first is UberX, a standard car for twenty-seven ninety-five, picking you up at nine forty-five. The second is UberXL, with more room, for forty-one sixty-eight, picking you up at nine forty. The third is Uber WAV, wheelchair accessible, for thirty-three dollars, picking you up at nine thirty-five. All of them arrive before ten ten. | 1760 | NOTICEABLE DELAY |  |  | same view |  |
| 17 | speech (barge-in) | BARRIER_TRANSPORTATION_NEEDS | Stop. | Stop. | Okay. | 1791 | NOTICEABLE DELAY | 2390 |  | same view |  |
| 18 | speech | BARRIER_TRANSPORTATION_NEEDS | Just book the cheapest one. | Just book the cheapest one. | I selected it. Do you want me to book it? ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 9005 | VERY POOR | 15548 | describeCurrentView→; performViewAction→ | same view | response start 9005 ms; expected view REVIEW, got BARRIER_TRANSPORTATION_NEEDS |
| 19 | speech | BARRIER_TRANSPORTATION_NEEDS | Yes. | Yes. | I'm booking it now. It is not confirmed yet.  | 1832 | NOTICEABLE DELAY | 5630 | performViewAction→UNKNOWN_ACTION | same view |  |
| 20 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 21 | speech | BARRIER_TRANSPORTATION_NEEDS | Done? | Done? | Not yet. Choose any special help you need for the journey, then continue. | 1780 | NOTICEABLE DELAY | 7315 | describeCurrentView→ | same view |  |
| 22 | speech | BARRIER_TRANSPORTATION_NEEDS | Try again. | Try again. | I'm booking it now. It is not confirmed yet.  | 1746 | NOTICEABLE DELAY | 5542 | performViewAction→UNKNOWN_ACTION | same view |  |
| 23 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 24 | speech | BARRIER_TRANSPORTATION_NEEDS | Still nothing? Then the big one instead. | Still nothing? Then the big one instead. | I selected it. Shall I book it? ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 7914 | VERY POOR | 14176 | performViewAction→; performViewAction→ | same view | response start 7914 ms; expected view REVIEW, got BARRIER_TRANSPORTATION_NEEDS |
| 25 | speech | BARRIER_TRANSPORTATION_NEEDS | Yes. | Yes. | I'm booking it now. It is not confirmed yet.  | 1806 | NOTICEABLE DELAY | 5613 | performViewAction→UNKNOWN_ACTION | same view |  |
| 26 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 27 | speech | BARRIER_TRANSPORTATION_NEEDS | Is it booked now? | Is it booked now? | Not yet. Choose any special help you need for the journey, then continue. | 1801 | NOTICEABLE DELAY | 7328 | describeCurrentView→ | same view |  |
| 28 | speech | BARRIER_TRANSPORTATION_NEEDS | Thanks. | Thanks. | You're welcome. | 1790 | NOTICEABLE DELAY | 2625 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 21,
  "total_turns": 28,
  "response_start_p50_ms": 1832,
  "response_start_p95_ms": 8655,
  "response_start_avg_ms": 4063,
  "app_overhead_p50_ms": 5,
  "barge_ins": 1,
  "barge_in_stop_p50_ms": 161,
  "barge_in_stop_max_ms": 161,
  "spoken_turns_with_context_before_answer": 8,
  "problems": [
    "turn 3: response start 8330 ms",
    "turn 4: response start 6866 ms",
    "turn 4: expected view TIME, got BARRIER_TRANSPORTATION_PICKUP",
    "turn 5: response start 6612 ms",
    "turn 7: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 8: expected view REVIEW, got BARRIER_TRANSPORTATION_NEEDS",
    "turn 9: response start 8655 ms",
    "turn 12: response start 7863 ms",
    "turn 13: response start 6646 ms",
    "turn 18: response start 9005 ms",
    "turn 18: expected view REVIEW, got BARRIER_TRANSPORTATION_NEEDS",
    "turn 24: response start 7914 ms",
    "turn 24: expected view REVIEW, got BARRIER_TRANSPORTATION_NEEDS"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 988 ms after tap
