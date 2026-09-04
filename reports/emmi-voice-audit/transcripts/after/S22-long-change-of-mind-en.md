# Voice session S22-long-change-of-mind-en

- patient_profile: D (changes their mind)
- language: en
- flow: long (EN): book a ride, cancel it through the destructive gate, change mind again, rebook a ride the provider rejects, recover by choosing another, with a barge-in on the way
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T05:15:58.847Z
- finished: 2026-09-04T05:19:46.151Z

19 spoken turns in English. 'Actually cancel it' → 'Wait, no!' → rebook. The simulator rejects one ride in eleven deterministically (UberX for this visit), so the second booking fails: EMMI must say so, offer a retry and another vehicle, never 'Done'. Includes a long reply interrupted with 'Stop.'

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | I can't get to my appointment. | I can't get to my appointment. | I can arrange a ride. Should we pick you up at home, 123 Oak Avenue, Apt 4B · Miami, FL 33176? | 1924 | NOTICEABLE DELAY | 10752 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 3 | speech | BARRIER_TRANSPORTATION_PICKUP | Yes, my home address. | Yes, my home address. | Do you need any special help to travel? | 1738 | NOTICEABLE DELAY | 5064 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS |  |
| 4 | speech | BARRIER_TRANSPORTATION_NEEDS | No, nothing special. | No, nothing special. | Check the suggested pickup time, then look for rides — or choose a different time. | 1839 | NOTICEABLE DELAY | 8104 | performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_TIME |  |
| 5 | speech | BARRIER_TRANSPORTATION_TIME | Go ahead and search. | Go ahead and search. | Looking for rides. | 2713 | POOR | 3962 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_TIME → BARRIER_TRANSPORTATION_OPTIONS | response start 2713 ms |
| 6 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 7 | speech | BARRIER_TRANSPORTATION_OPTIONS | What are my options? | What are my options? | I found 3 rides. UberX, $27.95; UberXL, $41.68; Uber WAV, $33.00. Which one? | 1802 | NOTICEABLE DELAY | 7236 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 8 | speech | BARRIER_TRANSPORTATION_OPTIONS | The one with more room. | The one with more room. | I selected UberXL. Before I book it: More room · $41.68 · 9:40 AM. Shall I? | 1852 | NOTICEABLE DELAY | 8563 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 9 | speech | BARRIER_TRANSPORTATION_REVIEW | Yes, book it. | Yes, book it. | Done. Your ride is booked. | 2701 | POOR | 4783 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_RETURN_OFFER | response start 2701 ms |
| 10 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 11 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Is it booked? | Is it booked? | Yes, the ride is booked. | 1826 | NOTICEABLE DELAY | 3908 | describeCurrentView→ | same view |  |
| 12 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Hmm. Actually, cancel it. | Hmm. Actually, cancel it. | No pude completar ese paso: CONFIRMATION_REQUIRED. | 1848 | NOTICEABLE DELAY | 4344 | performViewAction→PERFORMED; performViewAction→CONFIRMATION_REQUIRED | BARRIER_TRANSPORTATION_RETURN_OFFER → BARRIER_TRANSPORTATION_BOOKED |  |
| 13 | speech | BARRIER_TRANSPORTATION_BOOKED | Yes, cancel it. | Yes, cancel it. | The ride was not cancelled. | 1783 | NOTICEABLE DELAY | 3871 | performViewAction→UNKNOWN_ACTION | same view |  |
| 14 | speech | BARRIER_TRANSPORTATION_BOOKED | Wait, no! I do need it after all. | Wait, no! I do need it after all. | No pude completar ese paso: UNKNOWN_ACTION. | 1793 | NOTICEABLE DELAY | 4284 | performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION | same view |  |
| 15 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 16 | speech | BARRIER_TRANSPORTATION_BOOKED | Tell me about all of them. | Tell me about all of them. | Sure. The first is UberX, a standard car for twenty-seven ninety-five, picking you up at nine forty-five. The second is UberXL, with more room, for forty-one sixty-eight, picking you up at nine forty. The third is Uber WAV, wheelchair accessible, for thirty-three dollars, picking you up at nine thirty-five. All of them arrive before ten ten. | 1777 | NOTICEABLE DELAY |  |  | same view |  |
| 17 | speech (barge-in) | BARRIER_TRANSPORTATION_BOOKED | Stop. | Stop. | Okay. | 1802 | NOTICEABLE DELAY | 2403 |  | same view |  |
| 18 | speech | BARRIER_TRANSPORTATION_BOOKED | Just book the cheapest one. | Just book the cheapest one. | I selected UberXL. Do you want me to book it? | 1813 | NOTICEABLE DELAY | 5982 | describeCurrentView→; performViewAction→UNKNOWN_ACTION | same view | expected view REVIEW, got BARRIER_TRANSPORTATION_BOOKED |
| 19 | speech | BARRIER_TRANSPORTATION_BOOKED | Yes. | Yes. | I'm booking it now. It is not confirmed yet.  | 1816 | NOTICEABLE DELAY | 5572 | performViewAction→UNKNOWN_ACTION | same view |  |
| 20 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 21 | speech | BARRIER_TRANSPORTATION_BOOKED | Done? | Done? | Yes, the ride is booked. | 1827 | NOTICEABLE DELAY | 3911 | describeCurrentView→ | same view |  |
| 22 | speech | BARRIER_TRANSPORTATION_BOOKED | Try again. | Try again. | I'm booking it now. It is not confirmed yet.  | 1753 | NOTICEABLE DELAY | 5505 | performViewAction→UNKNOWN_ACTION | same view |  |
| 23 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 24 | speech | BARRIER_TRANSPORTATION_BOOKED | Still nothing? Then the big one instead. | Still nothing? Then the big one instead. | No pude completar ese paso: UNKNOWN_ACTION. | 1813 | NOTICEABLE DELAY | 4312 | performViewAction→UNKNOWN_ACTION | same view | expected view REVIEW, got BARRIER_TRANSPORTATION_BOOKED |
| 25 | speech | BARRIER_TRANSPORTATION_BOOKED | Yes. | Yes. | I'm booking it now. It is not confirmed yet.  | 1828 | NOTICEABLE DELAY | 5575 | performViewAction→UNKNOWN_ACTION | same view |  |
| 26 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 27 | speech | BARRIER_TRANSPORTATION_BOOKED | Is it booked now? | Is it booked now? | Yes, the ride is booked. | 1785 | NOTICEABLE DELAY | 3868 | describeCurrentView→ | same view |  |
| 28 | speech | BARRIER_TRANSPORTATION_BOOKED | Thanks. | Thanks. | You're welcome. | 1798 | NOTICEABLE DELAY | 2627 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 21,
  "total_turns": 28,
  "response_start_p50_ms": 1813,
  "response_start_p95_ms": 2701,
  "response_start_avg_ms": 1897,
  "app_overhead_p50_ms": 3,
  "barge_ins": 1,
  "barge_in_stop_p50_ms": 162,
  "barge_in_stop_max_ms": 162,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 5: response start 2713 ms",
    "turn 7: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 9: response start 2701 ms",
    "turn 18: expected view REVIEW, got BARRIER_TRANSPORTATION_BOOKED",
    "turn 24: expected view REVIEW, got BARRIER_TRANSPORTATION_BOOKED"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 886 ms after tap
