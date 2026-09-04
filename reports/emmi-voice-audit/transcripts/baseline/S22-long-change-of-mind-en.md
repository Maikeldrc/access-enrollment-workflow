# Voice session S22-long-change-of-mind-en

- patient_profile: D (changes their mind)
- language: en
- flow: long (EN): book a ride, cancel it through the destructive gate, change mind again, rebook a different vehicle with a barge-in on the way
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:15:40.506Z
- finished: 2026-09-04T01:20:07.956Z

19 spoken turns in English. 'Actually cancel it' → 'Wait, no!' → rebook. Includes a long reply interrupted with 'Stop.'

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | I can't get to my appointment. | I can't get to my appointment. | I can arrange a ride. Should we pick you up at home, 123 Oak Avenue, Apt 4B · Miami, FL 33176? | 1917 | NOTICEABLE DELAY | 10792 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 3 | speech | BARRIER_TRANSPORTATION_PICKUP | Yes, my home address. | Yes, my home address. | Do you need any special help to travel? ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 5368 | VERY POOR | 14216 | performViewAction→ | same view | response start 5368 ms |
| 4 | speech | BARRIER_TRANSPORTATION_PICKUP | No, nothing special. | No, nothing special. | You can continue here. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 3688 | POOR | 12548 | performViewAction→; performViewAction→ | same view | response start 3688 ms; expected view TIME, got BARRIER_TRANSPORTATION_PICKUP |
| 5 | speech | BARRIER_TRANSPORTATION_PICKUP | Go ahead and search. | Go ahead and search. | Looking for rides. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 3497 | POOR | 12367 | performViewAction→ | same view | response start 3497 ms |
| 6 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 7 | speech | BARRIER_TRANSPORTATION_PICKUP | What are my options? | What are my options? | I found 1 rides. Home. Which one? | 1832 | NOTICEABLE DELAY | 4752 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 8 | speech | BARRIER_TRANSPORTATION_PICKUP | The cheapest one. | The cheapest one. | I selected it. Do you want me to book it? ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 6375 | VERY POOR | 15293 | describeCurrentView→; performViewAction→ | same view | response start 6375 ms; expected view REVIEW, got BARRIER_TRANSPORTATION_PICKUP |
| 9 | speech | BARRIER_TRANSPORTATION_PICKUP | Yes, book it. | Yes, book it. | I'm booking it now. It is not confirmed yet.  ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 5924 | VERY POOR | 14806 | performViewAction→ | same view | response start 5924 ms |
| 10 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 11 | speech | BARRIER_TRANSPORTATION_PICKUP | Is it booked? | Is it booked? | Not yet. Confirm where the car should pick you up, or give a different address. | 1811 | NOTICEABLE DELAY | 8127 | describeCurrentView→ | same view |  |
| 12 | speech | BARRIER_TRANSPORTATION_PICKUP | Hmm. Actually, cancel it. | Hmm. Actually, cancel it. | I can't cancel from this screen. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 4689 | VERY POOR | 13601 | performViewAction→ | same view | response start 4689 ms |
| 13 | speech | BARRIER_TRANSPORTATION_PICKUP | Yes, cancel it. | Yes, cancel it. | The ride was not cancelled. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 4211 | VERY POOR | 13107 | performViewAction→ | same view | response start 4211 ms |
| 14 | speech | BARRIER_TRANSPORTATION_PICKUP | Wait, no! I do need it after all. | Wait, no! I do need it after all. | No pude completar ese paso: UNKNOWN_ACTION. | 1932 | NOTICEABLE DELAY | 4428 | performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_OPTIONS |  |
| 15 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 16 | speech | BARRIER_TRANSPORTATION_OPTIONS | Tell me about all of them. | Tell me about all of them. | Sure. The first is UberX, a standard car for twenty-seven ninety-five, picking you up at nine forty-five. The second is UberXL, with more room, for forty-one sixty-eight, picking you up at nine forty. The third is Uber WAV, wheelchair accessible, for thirty-three dollars, picking you up at nine thirty-five. All of them arrive before ten ten. | 1791 | NOTICEABLE DELAY |  |  | same view |  |
| 17 | speech (barge-in) | BARRIER_TRANSPORTATION_OPTIONS | Stop. | Stop. | Okay. | 1767 | NOTICEABLE DELAY | 2361 |  | same view |  |
| 18 | speech | BARRIER_TRANSPORTATION_OPTIONS | Just book the one with more room. | Just book the one with more room. | I selected UberXL. Before I book it: More room · $41.68 · 9:40 AM. Shall I? | 1819 | NOTICEABLE DELAY | 8609 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 19 | speech | BARRIER_TRANSPORTATION_REVIEW | Yes. | Yes. | I'm booking it now. It is not confirmed yet. The ride is chosen but NOT booked — it needs your confirmation on the review screen | 1827 | NOTICEABLE DELAY | 12479 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_RETURN_OFFER |  |
| 20 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 21 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Done? | Done? | Yes, the ride is booked. | 1802 | NOTICEABLE DELAY | 3884 | describeCurrentView→ | same view |  |
| 22 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | What time is the pickup? | What time is the pickup? | Pickup is at 9:45 AM. | 1748 | NOTICEABLE DELAY | 3830 | describeCurrentView→ | same view |  |
| 23 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Thanks. | Thanks. | You're welcome. | 1750 | NOTICEABLE DELAY | 2588 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 18,
  "total_turns": 23,
  "response_start_p50_ms": 1832,
  "response_start_p95_ms": 6375,
  "response_start_avg_ms": 2986,
  "app_overhead_p50_ms": 5,
  "barge_ins": 1,
  "barge_in_stop_p50_ms": 157,
  "barge_in_stop_max_ms": 157,
  "spoken_turns_with_context_before_answer": 7,
  "problems": [
    "turn 3: response start 5368 ms",
    "turn 4: response start 3688 ms",
    "turn 4: expected view TIME, got BARRIER_TRANSPORTATION_PICKUP",
    "turn 5: response start 3497 ms",
    "turn 7: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 8: response start 6375 ms",
    "turn 8: expected view REVIEW, got BARRIER_TRANSPORTATION_PICKUP",
    "turn 9: response start 5924 ms",
    "turn 12: response start 4689 ms",
    "turn 13: response start 4211 ms"
  ]
}
```

## Observations

- voice start: state EMMI_THINKING, socket true, error "", 947 ms after tap
