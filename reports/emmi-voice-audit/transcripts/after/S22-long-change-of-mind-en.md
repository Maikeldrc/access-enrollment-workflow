# Voice session S22-long-change-of-mind-en

- patient_profile: D (changes their mind)
- language: en
- flow: long (EN): book a ride, cancel it through the destructive gate, change mind again, rebook a different vehicle with a barge-in on the way
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:30:00.223Z
- finished: 2026-09-04T01:33:36.528Z

19 spoken turns in English. 'Actually cancel it' → 'Wait, no!' → rebook. Includes a long reply interrupted with 'Stop.'

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | I can't get to my appointment. | I can't get to my appointment. | I can arrange a ride. Should we pick you up at home, 123 Oak Avenue, Apt 4B · Miami, FL 33176? | 1898 | NOTICEABLE DELAY | 10731 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 3 | speech | BARRIER_TRANSPORTATION_PICKUP | Yes, my home address. | Yes, my home address. | Do you need any special help to travel? | 1775 | NOTICEABLE DELAY | 5107 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS |  |
| 4 | speech | BARRIER_TRANSPORTATION_NEEDS | No, nothing special. | No, nothing special. | Check the suggested pickup time, then look for rides — or choose a different time. | 1848 | NOTICEABLE DELAY | 8128 | performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_TIME |  |
| 5 | speech | BARRIER_TRANSPORTATION_TIME | Go ahead and search. | Go ahead and search. | Looking for rides. | 2698 | POOR | 3952 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_TIME → BARRIER_TRANSPORTATION_OPTIONS | response start 2698 ms |
| 6 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 7 | speech | BARRIER_TRANSPORTATION_OPTIONS | What are my options? | What are my options? | I found 3 rides. UberX, $27.95; UberXL, $41.68; Uber WAV, $33.00. Which one? | 1820 | NOTICEABLE DELAY | 7245 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 8 | speech | BARRIER_TRANSPORTATION_OPTIONS | The cheapest one. | The cheapest one. | I selected UberX. Do you want me to book it? | 1808 | NOTICEABLE DELAY | 5969 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 9 | speech | BARRIER_TRANSPORTATION_REVIEW | Yes, book it. | Yes, book it. | I'm booking it now. It is not confirmed yet. The ride is chosen but NOT booked — it needs your confirmation on the review screen | 2547 | POOR | 13143 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_BOOKING_FAILED | response start 2547 ms |
| 10 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 11 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Is it booked? | Is it booked? | Not yet. The ride is chosen but NOT booked — it needs your confirmation on the review screen | 1824 | NOTICEABLE DELAY | 9436 | describeCurrentView→ | same view |  |
| 12 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Hmm. Actually, cancel it. | Hmm. Actually, cancel it. | I can't cancel from this screen. | 1807 | NOTICEABLE DELAY | 4334 | performViewAction→UNKNOWN_ACTION | same view |  |
| 13 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Yes, cancel it. | Yes, cancel it. | The ride was not cancelled. | 1828 | NOTICEABLE DELAY | 3917 | performViewAction→UNKNOWN_ACTION | same view |  |
| 14 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Wait, no! I do need it after all. | Wait, no! I do need it after all. | No pude completar ese paso: UNKNOWN_ACTION. | 1767 | NOTICEABLE DELAY | 4267 | performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION | same view |  |
| 15 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 16 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Tell me about all of them. | Tell me about all of them. | Sure. The first is UberX, a standard car for twenty-seven ninety-five, picking you up at nine forty-five. The second is UberXL, with more room, for forty-one sixty-eight, picking you up at nine forty. The third is Uber WAV, wheelchair accessible, for thirty-three dollars, picking you up at nine thirty-five. All of them arrive before ten ten. | 1806 | NOTICEABLE DELAY |  |  | same view |  |
| 17 | speech (barge-in) | BARRIER_TRANSPORTATION_BOOKING_FAILED | Stop. | Stop. | Okay. | 1809 | NOTICEABLE DELAY | 2405 |  | same view |  |
| 18 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Just book the one with more room. | Just book the one with more room. | I selected UberX. Before I book it: Standard car · $27.95 · 9:45 AM. Shall I? | 1790 | NOTICEABLE DELAY | 8538 | describeCurrentView→; performViewAction→UNKNOWN_ACTION | same view | expected view REVIEW, got BARRIER_TRANSPORTATION_BOOKING_FAILED |
| 19 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Yes. | Yes. | I'm booking it now. It is not confirmed yet.  | 1804 | NOTICEABLE DELAY | 5551 | performViewAction→UNKNOWN_ACTION | same view |  |
| 20 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 21 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Done? | Done? | Not yet. The ride is chosen but NOT booked — it needs your confirmation on the review screen | 1840 | NOTICEABLE DELAY | 9453 | describeCurrentView→ | same view |  |
| 22 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | What time is the pickup? | What time is the pickup? | Pickup is at 9:45 AM. | 1769 | NOTICEABLE DELAY | 3851 | describeCurrentView→ | same view |  |
| 23 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Thanks. | Thanks. | You're welcome. | 1782 | NOTICEABLE DELAY | 2624 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 18,
  "total_turns": 23,
  "response_start_p50_ms": 1808,
  "response_start_p95_ms": 2698,
  "response_start_avg_ms": 1901,
  "app_overhead_p50_ms": 4,
  "barge_ins": 1,
  "barge_in_stop_p50_ms": 148,
  "barge_in_stop_max_ms": 148,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 5: response start 2698 ms",
    "turn 7: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 9: response start 2547 ms",
    "turn 18: expected view REVIEW, got BARRIER_TRANSPORTATION_BOOKING_FAILED"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 899 ms after tap
