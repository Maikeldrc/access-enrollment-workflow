# Voice session S22-long-change-of-mind-en

- patient_profile: D (changes their mind)
- language: en
- flow: long (EN): book a ride, cancel it through the destructive gate, change mind again, rebook a ride the provider rejects, recover by choosing another, with a barge-in on the way
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T05:25:36.851Z
- finished: 2026-09-04T05:29:45.895Z

19 spoken turns in English. 'Actually cancel it' → 'Wait, no!' → rebook. The simulator rejects one ride in eleven deterministically (UberX for this visit), so the second booking fails: EMMI must say so, offer a retry and another vehicle, never 'Done'. Includes a long reply interrupted with 'Stop.'

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | I can't get to my appointment. | I can't get to my appointment. | I can arrange a ride. Should we pick you up at home, 123 Oak Avenue, Apt 4B · Miami, FL 33176? | 1914 | NOTICEABLE DELAY | 10743 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 3 | speech | BARRIER_TRANSPORTATION_PICKUP | Yes, my home address. | Yes, my home address. | Do you need any special help to travel? | 1790 | NOTICEABLE DELAY | 5120 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS |  |
| 4 | speech | BARRIER_TRANSPORTATION_NEEDS | No, nothing special. | No, nothing special. | Check the suggested pickup time, then look for rides — or choose a different time. | 1857 | NOTICEABLE DELAY | 8135 | performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_TIME |  |
| 5 | speech | BARRIER_TRANSPORTATION_TIME | Go ahead and search. | Go ahead and search. | Looking for rides. | 2699 | POOR | 3951 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_TIME → BARRIER_TRANSPORTATION_OPTIONS | response start 2699 ms |
| 6 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 7 | speech | BARRIER_TRANSPORTATION_OPTIONS | What are my options? | What are my options? | I found 3 rides. UberX, $27.95; UberXL, $41.68; Uber WAV, $33.00. Which one? | 1841 | NOTICEABLE DELAY | 7267 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 8 | speech | BARRIER_TRANSPORTATION_OPTIONS | The one with more room. | The one with more room. | I selected UberXL. Before I book it: More room · $41.68 · 9:40 AM. Shall I? | 1848 | NOTICEABLE DELAY | 8585 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 9 | speech | BARRIER_TRANSPORTATION_REVIEW | Yes, book it. | Yes, book it. | Done. Your ride is booked. | 2685 | POOR | 4773 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_RETURN_OFFER | response start 2685 ms |
| 10 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 11 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Is it booked? | Is it booked? | Yes, the ride is booked. | 1846 | NOTICEABLE DELAY | 3931 | describeCurrentView→ | same view |  |
| 12 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Hmm. Actually, cancel it. | Hmm. Actually, cancel it. | This cancels the booked ride and nothing else. Are you sure? | 1847 | NOTICEABLE DELAY | 6427 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_RETURN_OFFER → BARRIER_TRANSPORTATION_BOOKED |  |
| 13 | speech | BARRIER_TRANSPORTATION_BOOKED | Yes, cancel it. | Yes, cancel it. | The ride is cancelled. Nothing is booked now. | 1833 | NOTICEABLE DELAY | 5159 | performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_BOOKED → BARRIER_TRANSPORTATION_CANCELED |  |
| 14 | speech | BARRIER_TRANSPORTATION_CANCELED | Wait, no! I do need it after all. | Wait, no! I do need it after all. | No problem. Searching again. | 2751 | POOR | 4422 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_CANCELED → BARRIER_TRANSPORTATION_OPTIONS | response start 2751 ms |
| 15 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 16 | speech | BARRIER_TRANSPORTATION_OPTIONS | Tell me about all of them. | Tell me about all of them. | Sure. The first is UberX, a standard car for twenty-seven ninety-five, picking you up at nine forty-five. The second is UberXL, with more room, for forty-one sixty-eight, picking you up at nine forty. The third is Uber WAV, wheelchair accessible, for thirty-three dollars, picking you up at nine thirty-five. All of them arrive before ten ten. | 1765 | NOTICEABLE DELAY |  |  | same view |  |
| 17 | speech (barge-in) | BARRIER_TRANSPORTATION_OPTIONS | Stop. | Stop. | Okay. | 1764 | NOTICEABLE DELAY | 2360 |  | same view |  |
| 18 | speech | BARRIER_TRANSPORTATION_OPTIONS | Just book the cheapest one. | Just book the cheapest one. | I selected UberX. Do you want me to book it? | 1877 | NOTICEABLE DELAY | 6055 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 19 | speech | BARRIER_TRANSPORTATION_REVIEW | Yes. | Yes. | That booking did not go through: the provider was not available, and nothing was charged. I can try again or pick another ride. | 2578 | POOR | 12340 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_BOOKING_FAILED | response start 2578 ms |
| 20 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 21 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Done? | Done? | No. The booking failed and nothing was charged. Shall I try again or choose another ride? | 1820 | NOTICEABLE DELAY | 8549 | describeCurrentView→ | same view |  |
| 22 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Try again. | Try again. | That booking did not go through: the provider was not available, and nothing was charged. I can try again or pick another ride. | 2514 | POOR | 12268 | performViewAction→PERFORMED | same view | response start 2514 ms |
| 23 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 24 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Still nothing? Then the big one instead. | Still nothing? Then the big one instead. | I selected UberXL. Shall I book it? | 1894 | NOTICEABLE DELAY | 4823 | performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_BOOKING_FAILED → BARRIER_TRANSPORTATION_REVIEW |  |
| 25 | speech | BARRIER_TRANSPORTATION_REVIEW | Yes. | Yes. | Done. Your ride is booked. | 2684 | POOR | 4766 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_RETURN_OFFER | response start 2684 ms |
| 26 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 27 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Is it booked now? | Is it booked now? | Yes, the ride is booked. | 1779 | NOTICEABLE DELAY | 3864 | describeCurrentView→ | same view |  |
| 28 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Thanks. | Thanks. | You're welcome. | 1832 | NOTICEABLE DELAY | 2659 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 21,
  "total_turns": 28,
  "response_start_p50_ms": 1848,
  "response_start_p95_ms": 2699,
  "response_start_avg_ms": 2068,
  "app_overhead_p50_ms": 4,
  "barge_ins": 1,
  "barge_in_stop_p50_ms": 156,
  "barge_in_stop_max_ms": 156,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 5: response start 2699 ms",
    "turn 7: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 9: response start 2685 ms",
    "turn 14: response start 2751 ms",
    "turn 19: response start 2578 ms",
    "turn 22: response start 2514 ms",
    "turn 25: response start 2684 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 911 ms after tap
