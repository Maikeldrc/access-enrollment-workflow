# Voice session S22-long-change-of-mind-en

- patient_profile: D (changes their mind)
- language: en
- flow: long (EN): book a ride, cancel it through the destructive gate, change mind again, rebook a ride the provider rejects, recover by choosing another, with a barge-in on the way
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T05:20:40.248Z
- finished: 2026-09-04T05:25:49.059Z

19 spoken turns in English. 'Actually cancel it' → 'Wait, no!' → rebook. The simulator rejects one ride in eleven deterministically (UberX for this visit), so the second booking fails: EMMI must say so, offer a retry and another vehicle, never 'Done'. Includes a long reply interrupted with 'Stop.'

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | I can't get to my appointment. | I can't get to my appointment. | I can arrange a ride. Should we pick you up at home, 123 Oak Avenue, Apt 4B · Miami, FL 33176? | 1871 | NOTICEABLE DELAY | 10863 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 3 | speech | BARRIER_TRANSPORTATION_PICKUP | Yes, my home address. | Yes, my home address. | Do you need any special help to travel? ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 5331 | VERY POOR | 14234 | performViewAction→ | same view | response start 5331 ms |
| 4 | speech | BARRIER_TRANSPORTATION_PICKUP | No, nothing special. | No, nothing special. | You can continue here. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 3716 | POOR | 12559 | performViewAction→; performViewAction→ | same view | response start 3716 ms; expected view TIME, got BARRIER_TRANSPORTATION_PICKUP |
| 5 | speech | BARRIER_TRANSPORTATION_PICKUP | Go ahead and search. | Go ahead and search. | Looking for rides. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 3467 | POOR | 12339 | performViewAction→ | same view | response start 3467 ms |
| 6 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 7 | speech | BARRIER_TRANSPORTATION_PICKUP | What are my options? | What are my options? | I found 1 rides. Home. Which one? | 1849 | NOTICEABLE DELAY | 4763 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 8 | speech | BARRIER_TRANSPORTATION_PICKUP | The one with more room. | The one with more room. | I selected it. Before I book it: . Shall I? | 1875 | NOTICEABLE DELAY | 6032 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS | expected view REVIEW, got BARRIER_TRANSPORTATION_NEEDS |
| 9 | speech | BARRIER_TRANSPORTATION_NEEDS | Yes, book it. | Yes, book it. | I'm booking it now. It is not confirmed yet.  ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 5897 | VERY POOR | 14772 | performViewAction→ | same view | response start 5897 ms |
| 10 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 11 | speech | BARRIER_TRANSPORTATION_NEEDS | Is it booked? | Is it booked? | Not yet. Choose any special help you need for the journey, then continue. | 1814 | NOTICEABLE DELAY | 7257 | describeCurrentView→ | same view |  |
| 12 | speech | BARRIER_TRANSPORTATION_NEEDS | Hmm. Actually, cancel it. | Hmm. Actually, cancel it. | I can't cancel from this screen. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 4701 | VERY POOR | 13601 | performViewAction→ | same view | response start 4701 ms |
| 13 | speech | BARRIER_TRANSPORTATION_NEEDS | Yes, cancel it. | Yes, cancel it. | The ride was not cancelled. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 4228 | VERY POOR | 13119 | performViewAction→; performViewAction→ | same view | response start 4228 ms |
| 14 | speech | BARRIER_TRANSPORTATION_NEEDS | Wait, no! I do need it after all. | Wait, no! I do need it after all. | No pude completar ese paso: UNKNOWN_ACTION. | 1890 | NOTICEABLE DELAY | 4386 | performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_OPTIONS |  |
| 15 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 16 | speech | BARRIER_TRANSPORTATION_OPTIONS | Tell me about all of them. | Tell me about all of them. | Sure. The first is UberX, a standard car for twenty-seven ninety-five, picking you up at nine forty-five. The second is UberXL, with more room, for forty-one sixty-eight, picking you up at nine forty. The third is Uber WAV, wheelchair accessible, for thirty-three dollars, picking you up at nine thirty-five. All of them arrive before ten ten. | 1769 | NOTICEABLE DELAY |  |  | same view |  |
| 17 | speech (barge-in) | BARRIER_TRANSPORTATION_OPTIONS | Stop. | Stop. | Okay. | 1810 | NOTICEABLE DELAY | 2408 |  | same view |  |
| 18 | speech | BARRIER_TRANSPORTATION_OPTIONS | Just book the cheapest one. | Just book the cheapest one. | I selected it. Do you want me to book it? ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 6455 | VERY POOR | 15365 | describeCurrentView→; performViewAction→ | same view | response start 6455 ms; expected view REVIEW, got BARRIER_TRANSPORTATION_OPTIONS |
| 19 | speech | BARRIER_TRANSPORTATION_OPTIONS | Yes. | Yes. | I'm booking it now. It is not confirmed yet.  | 1840 | NOTICEABLE DELAY | 5591 | performViewAction→UNKNOWN_ACTION | same view |  |
| 20 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 21 | speech | BARRIER_TRANSPORTATION_OPTIONS | Done? | Done? | Not yet. Choose one of the rides. Choosing one does not book it — you review it first. | 1813 | NOTICEABLE DELAY | 9416 | describeCurrentView→ | same view |  |
| 22 | speech | BARRIER_TRANSPORTATION_OPTIONS | Try again. | Try again. | I'm booking it now. It is not confirmed yet.  | 1742 | NOTICEABLE DELAY | 5488 | performViewAction→UNKNOWN_ACTION | same view |  |
| 23 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 24 | speech | BARRIER_TRANSPORTATION_OPTIONS | Still nothing? Then the big one instead. | Still nothing? Then the big one instead. | I selected it. Shall I book it? ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 5199 | VERY POOR | 14102 | performViewAction→; performViewAction→ | same view | response start 5199 ms; expected view REVIEW, got BARRIER_TRANSPORTATION_OPTIONS |
| 25 | speech | BARRIER_TRANSPORTATION_OPTIONS | Yes. | Yes. | I'm booking it now. It is not confirmed yet.  | 1856 | NOTICEABLE DELAY | 5626 | performViewAction→UNKNOWN_ACTION | same view |  |
| 26 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 27 | speech | BARRIER_TRANSPORTATION_OPTIONS | Is it booked now? | Is it booked now? | Not yet. Choose one of the rides. Choosing one does not book it — you review it first. | 1824 | NOTICEABLE DELAY | 9470 | describeCurrentView→ | same view |  |
| 28 | speech | BARRIER_TRANSPORTATION_OPTIONS | Thanks. | Thanks. | You're welcome. | 1814 | NOTICEABLE DELAY | 2651 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 21,
  "total_turns": 28,
  "response_start_p50_ms": 1871,
  "response_start_p95_ms": 5897,
  "response_start_avg_ms": 2989,
  "app_overhead_p50_ms": 5,
  "barge_ins": 1,
  "barge_in_stop_p50_ms": 178,
  "barge_in_stop_max_ms": 178,
  "spoken_turns_with_context_before_answer": 8,
  "problems": [
    "turn 3: response start 5331 ms",
    "turn 4: response start 3716 ms",
    "turn 4: expected view TIME, got BARRIER_TRANSPORTATION_PICKUP",
    "turn 5: response start 3467 ms",
    "turn 7: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 8: expected view REVIEW, got BARRIER_TRANSPORTATION_NEEDS",
    "turn 9: response start 5897 ms",
    "turn 12: response start 4701 ms",
    "turn 13: response start 4228 ms",
    "turn 18: response start 6455 ms",
    "turn 18: expected view REVIEW, got BARRIER_TRANSPORTATION_OPTIONS",
    "turn 24: response start 5199 ms",
    "turn 24: expected view REVIEW, got BARRIER_TRANSPORTATION_OPTIONS"
  ]
}
```

## Observations

- voice start: state EMMI_THINKING, socket true, error "", 919 ms after tap
