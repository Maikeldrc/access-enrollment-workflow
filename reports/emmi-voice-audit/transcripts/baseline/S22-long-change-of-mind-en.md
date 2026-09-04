# Voice session S22-long-change-of-mind-en

- patient_profile: D (changes their mind)
- language: en
- flow: long (EN): book a ride, cancel it through the destructive gate, change mind again, rebook a ride the provider rejects, recover by choosing another, with a barge-in on the way
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T05:25:58.870Z
- finished: 2026-09-04T05:31:04.358Z

19 spoken turns in English. 'Actually cancel it' → 'Wait, no!' → rebook. The simulator rejects one ride in eleven deterministically (UberX for this visit), so the second booking fails: EMMI must say so, offer a retry and another vehicle, never 'Done'. Includes a long reply interrupted with 'Stop.'

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | I can't get to my appointment. | I can't get to my appointment. | I can arrange a ride. Should we pick you up at home, 123 Oak Avenue, Apt 4B · Miami, FL 33176? | 1891 | NOTICEABLE DELAY | 10713 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 3 | speech | BARRIER_TRANSPORTATION_PICKUP | Yes, my home address. | Yes, my home address. | Do you need any special help to travel? ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 5338 | VERY POOR | 14172 | performViewAction→ | same view | response start 5338 ms |
| 4 | speech | BARRIER_TRANSPORTATION_PICKUP | No, nothing special. | No, nothing special. | You can continue here. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 3701 | POOR | 12528 | performViewAction→; performViewAction→ | same view | response start 3701 ms; expected view TIME, got BARRIER_TRANSPORTATION_PICKUP |
| 5 | speech | BARRIER_TRANSPORTATION_PICKUP | Go ahead and search. | Go ahead and search. | Looking for rides. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 3482 | POOR | 12328 | performViewAction→ | same view | response start 3482 ms |
| 6 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 7 | speech | BARRIER_TRANSPORTATION_PICKUP | What are my options? | What are my options? | I found 1 rides. Home. Which one? | 1784 | NOTICEABLE DELAY | 4704 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 8 | speech | BARRIER_TRANSPORTATION_PICKUP | The one with more room. | The one with more room. | I selected it. Before I book it: . Shall I? | 1889 | NOTICEABLE DELAY | 6058 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS | expected view REVIEW, got BARRIER_TRANSPORTATION_NEEDS |
| 9 | speech | BARRIER_TRANSPORTATION_NEEDS | Yes, book it. | Yes, book it. | I'm booking it now. It is not confirmed yet.  ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 5901 | VERY POOR | 14778 | performViewAction→ | same view | response start 5901 ms |
| 10 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 11 | speech | BARRIER_TRANSPORTATION_NEEDS | Is it booked? | Is it booked? | Not yet. Choose any special help you need for the journey, then continue. | 1822 | NOTICEABLE DELAY | 7257 | describeCurrentView→ | same view |  |
| 12 | speech | BARRIER_TRANSPORTATION_NEEDS | Hmm. Actually, cancel it. | Hmm. Actually, cancel it. | I can't cancel from this screen. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 4679 | VERY POOR | 13542 | performViewAction→ | same view | response start 4679 ms |
| 13 | speech | BARRIER_TRANSPORTATION_NEEDS | Yes, cancel it. | Yes, cancel it. | The ride was not cancelled. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 4231 | VERY POOR | 13099 | performViewAction→; performViewAction→ | same view | response start 4231 ms |
| 14 | speech | BARRIER_TRANSPORTATION_NEEDS | Wait, no! I do need it after all. | Wait, no! I do need it after all. | No pude completar ese paso: UNKNOWN_ACTION. | 1812 | NOTICEABLE DELAY | 4311 | performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION | same view |  |
| 15 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 16 | speech | BARRIER_TRANSPORTATION_NEEDS | Tell me about all of them. | Tell me about all of them. | Sure. The first is UberX, a standard car for twenty-seven ninety-five, picking you up at nine forty-five. The second is UberXL, with more room, for forty-one sixty-eight, picking you up at nine forty. The third is Uber WAV, wheelchair accessible, for thirty-three dollars, picking you up at nine thirty-five. All of them arrive before ten ten. | 1799 | NOTICEABLE DELAY |  |  | same view |  |
| 17 | speech (barge-in) | BARRIER_TRANSPORTATION_NEEDS | Stop. | Stop. | Okay. | 1833 | NOTICEABLE DELAY | 2435 |  | same view |  |
| 18 | speech | BARRIER_TRANSPORTATION_NEEDS | Just book the cheapest one. | Just book the cheapest one. | I selected it. Do you want me to book it? ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 6457 | VERY POOR | 15379 | describeCurrentView→; performViewAction→ | same view | response start 6457 ms; expected view REVIEW, got BARRIER_TRANSPORTATION_NEEDS |
| 19 | speech | BARRIER_TRANSPORTATION_NEEDS | Yes. | Yes. | I'm booking it now. It is not confirmed yet.  | 1858 | NOTICEABLE DELAY | 5611 | performViewAction→UNKNOWN_ACTION | same view |  |
| 20 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 21 | speech | BARRIER_TRANSPORTATION_NEEDS | Done? | Done? | Not yet. Choose any special help you need for the journey, then continue. | 1822 | NOTICEABLE DELAY | 7287 | describeCurrentView→ | same view |  |
| 22 | speech | BARRIER_TRANSPORTATION_NEEDS | Try again. | Try again. | I'm booking it now. It is not confirmed yet.  | 1777 | NOTICEABLE DELAY | 5526 | performViewAction→UNKNOWN_ACTION | same view |  |
| 23 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 24 | speech | BARRIER_TRANSPORTATION_NEEDS | Still nothing? Then the big one instead. | Still nothing? Then the big one instead. | I selected it. Shall I book it? ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 5347 | VERY POOR | 14425 | performViewAction→; performViewAction→ | same view | response start 5347 ms; expected view REVIEW, got BARRIER_TRANSPORTATION_NEEDS |
| 25 | speech | BARRIER_TRANSPORTATION_NEEDS | Yes. | Yes. | I'm booking it now. It is not confirmed yet.  | 1779 | NOTICEABLE DELAY | 5559 | performViewAction→UNKNOWN_ACTION | same view |  |
| 26 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 27 | speech | BARRIER_TRANSPORTATION_NEEDS | Is it booked now? | Is it booked now? | Not yet. Choose any special help you need for the journey, then continue. | 1815 | NOTICEABLE DELAY | 7329 | describeCurrentView→ | same view |  |
| 28 | speech | BARRIER_TRANSPORTATION_NEEDS | Thanks. | Thanks. | You're welcome. | 1825 | NOTICEABLE DELAY | 2663 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 21,
  "total_turns": 28,
  "response_start_p50_ms": 1858,
  "response_start_p95_ms": 5901,
  "response_start_avg_ms": 2992,
  "app_overhead_p50_ms": 4,
  "barge_ins": 1,
  "barge_in_stop_p50_ms": 183,
  "barge_in_stop_max_ms": 183,
  "spoken_turns_with_context_before_answer": 8,
  "problems": [
    "turn 3: response start 5338 ms",
    "turn 4: response start 3701 ms",
    "turn 4: expected view TIME, got BARRIER_TRANSPORTATION_PICKUP",
    "turn 5: response start 3482 ms",
    "turn 7: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 8: expected view REVIEW, got BARRIER_TRANSPORTATION_NEEDS",
    "turn 9: response start 5901 ms",
    "turn 12: response start 4679 ms",
    "turn 13: response start 4231 ms",
    "turn 18: response start 6457 ms",
    "turn 18: expected view REVIEW, got BARRIER_TRANSPORTATION_NEEDS",
    "turn 24: response start 5347 ms",
    "turn 24: expected view REVIEW, got BARRIER_TRANSPORTATION_NEEDS"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 898 ms after tap
