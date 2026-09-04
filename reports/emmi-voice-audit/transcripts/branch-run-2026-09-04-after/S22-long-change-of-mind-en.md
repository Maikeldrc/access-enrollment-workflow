# Voice session S22-long-change-of-mind-en

- patient_profile: D (changes their mind)
- language: en
- flow: long (EN): book a ride, cancel it through the destructive gate, change mind again, rebook a ride the provider rejects, recover by choosing another, with a barge-in on the way
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T21:56:21.760Z
- finished: 2026-09-04T22:00:33.680Z

19 spoken turns in English. 'Actually cancel it' → 'Wait, no!' → rebook. The simulator rejects one ride in eleven deterministically (UberX for this visit), so the second booking fails: EMMI must say so, offer a retry and another vehicle, never 'Done'. Includes a long reply interrupted with 'Stop.'

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | I can't get to my appointment. | I can't get to my appointment. | I can arrange a ride. Should we pick you up at home, 123 Oak Avenue, Apt 4B · Miami, FL 33176? | 1905 | NOTICEABLE DELAY | 10832 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 3 | speech | BARRIER_TRANSPORTATION_PICKUP | Yes, my home address. | Yes, my home address. | Do you need any special help to travel? | 1753 | NOTICEABLE DELAY | 5095 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS |  |
| 4 | speech | BARRIER_TRANSPORTATION_NEEDS | No, nothing special. | No, nothing special. | Check the suggested pickup time, then look for rides — or choose a different time. | 1884 | NOTICEABLE DELAY | 8244 | performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_TIME |  |
| 5 | speech | BARRIER_TRANSPORTATION_TIME | Go ahead and search. | Go ahead and search. | Looking for rides. | 2585 | POOR | 3845 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_TIME → BARRIER_TRANSPORTATION_OPTIONS | response start 2585 ms |
| 6 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 7 | speech | BARRIER_TRANSPORTATION_OPTIONS | What are my options? | What are my options? | I found 3 rides. UberX, $27.95; UberXL, $41.68; Uber WAV, $33.00. Which one? | 1801 | NOTICEABLE DELAY | 7289 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 8 | speech | BARRIER_TRANSPORTATION_OPTIONS | The one with more room. | The one with more room. | I selected UberXL. Before I book it: More room · $41.68 · 1:40 PM. Shall I? | 1866 | NOTICEABLE DELAY | 8669 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 9 | speech | BARRIER_TRANSPORTATION_REVIEW | Yes, book it. | Yes, book it. | That booking did not go through: the provider was not available, and nothing was charged. I can try again or pick another ride. | 2456 | NOTICEABLE DELAY | 12299 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_BOOKING_FAILED |  |
| 10 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 11 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Is it booked? | Is it booked? | No. The booking failed and nothing was charged. Shall I try again or choose another ride? | 1836 | NOTICEABLE DELAY | 8602 | describeCurrentView→ | same view |  |
| 12 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Hmm. Actually, cancel it. | Hmm. Actually, cancel it. | No pude completar ese paso: UNKNOWN_ACTION. | 1793 | NOTICEABLE DELAY | 4288 | performViewAction→UNKNOWN_ACTION | same view |  |
| 13 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Yes, cancel it. | Yes, cancel it. | No pude completar ese paso: UNKNOWN_ACTION. | 1792 | NOTICEABLE DELAY | 4292 | performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION | same view |  |
| 14 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Wait, no! I do need it after all. | Wait, no! I do need it after all. | No pude completar ese paso: UNKNOWN_ACTION. | 1774 | NOTICEABLE DELAY | 4276 | performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION | same view |  |
| 15 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 16 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Tell me about all of them. | Tell me about all of them. | Sure. The first is UberX, a standard car for twenty-seven ninety-five, picking you up at nine forty-five. The second is UberXL, with more room, for forty-one sixty-eight, picking you up at nine forty. The third is Uber WAV, wheelchair accessible, for thirty-three dollars, picking you up at nine thirty-five. All of them arrive before ten ten. | 1761 | NOTICEABLE DELAY |  |  | same view |  |
| 17 | speech (barge-in) | BARRIER_TRANSPORTATION_BOOKING_FAILED | Stop. | Stop. | Okay. | 1793 | NOTICEABLE DELAY | 2395 |  | same view |  |
| 18 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Just book the cheapest one. | Just book the cheapest one. | I selected UberXL. Do you want me to book it? | 1794 | NOTICEABLE DELAY | 6021 | describeCurrentView→; performViewAction→UNKNOWN_ACTION | same view | expected view REVIEW, got BARRIER_TRANSPORTATION_BOOKING_FAILED |
| 19 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Yes. | Yes. | I'm booking it now. It is not confirmed yet.  | 1793 | NOTICEABLE DELAY | 5572 | performViewAction→UNKNOWN_ACTION | same view |  |
| 20 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 21 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Done? | Done? | No. The booking failed and nothing was charged. Shall I try again or choose another ride? | 1811 | NOTICEABLE DELAY | 8618 | describeCurrentView→ | same view |  |
| 22 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Try again. | Try again. | That booking did not go through: the provider was not available, and nothing was charged. I can try again or pick another ride. | 2503 | POOR | 12294 | performViewAction→PERFORMED | same view | response start 2503 ms |
| 23 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 24 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Still nothing? Then the big one instead. | Still nothing? Then the big one instead. | I selected UberXL. Shall I book it? | 1841 | NOTICEABLE DELAY | 4765 | performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_BOOKING_FAILED → BARRIER_TRANSPORTATION_REVIEW |  |
| 25 | speech | BARRIER_TRANSPORTATION_REVIEW | Yes. | Yes. | That booking did not go through: the provider was not available, and nothing was charged. I can try again or pick another ride. | 2449 | NOTICEABLE DELAY | 12229 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_BOOKING_FAILED |  |
| 26 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 27 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Is it booked now? | Is it booked now? | No. The booking failed and nothing was charged. Shall I try again or choose another ride? | 1798 | NOTICEABLE DELAY | 8597 | describeCurrentView→ | same view |  |
| 28 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Thanks. | Thanks. | You're welcome. | 1786 | NOTICEABLE DELAY | 2633 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 21,
  "total_turns": 28,
  "response_start_p50_ms": 1801,
  "response_start_p95_ms": 2503,
  "response_start_avg_ms": 1942,
  "app_overhead_p50_ms": 2,
  "barge_ins": 1,
  "barge_in_stop_p50_ms": 141,
  "barge_in_stop_max_ms": 141,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 5: response start 2585 ms",
    "turn 7: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 18: expected view REVIEW, got BARRIER_TRANSPORTATION_BOOKING_FAILED",
    "turn 22: response start 2503 ms"
  ]
}
```

## Observations

- voice start: state EMMI_THINKING, socket true, error "", 442 ms after tap
