# Voice session S20-long-spanglish-companion-and-ride-es

- patient_profile: F (utiliza Spanglish)
- language: es
- flow: long: companion invitation then a ride, all in Spanglish, with the confirmation gate exercised in both
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:24:30.345Z
- finished: 2026-09-04T01:26:28.466Z

17 spoken turns. 'appointment', 'daughter', 'ride', 'walker', 'pick up', 'cheap', 'booked': every turn mixes English words into Spanish. Before the guard change, several of these were discarded as unreliable.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Necesito que mi daughter venga conmigo al appointment. | Necesito que mi daughter venga conmigo al appointment. | Puede pedírselo a Maria (Hija) o a Carlos (Hijo). ¿A quién? | 1898 | NOTICEABLE DELAY | 6482 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_COMPANION_CONTACTS |  |
| 3 | speech | BARRIER_COMPANION_CONTACTS | ¿Qué va a ver ella? | ¿Qué va a ver ella? | Solo la fecha, la hora y el lugar de la cita. No ve su información de salud. | 1818 | NOTICEABLE DELAY | 8947 |  | same view |  |
| 4 | speech | BARRIER_COMPANION_CONTACTS | Ella habla English, ¿le llega en English? | Ella habla English, ¿le llega en English? | (empty generation) | 1402 | ACCEPTABLE | 2243 |  | same view |  |
| 5 | speech | BARRIER_COMPANION_CONTACTS | Okay, send it a María. |  |  |  | N/A |  |  | same view |  |
| 6 | speech | BARRIER_COMPANION_CONTACTS | Yes, mándala. |  |  |  | N/A |  |  | same view |  |
| 7 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 8 | speech | BARRIER_COMPANION_CONTACTS | ¿Ya le llegó el text? |  |  |  | N/A |  |  | same view |  |
| 9 | speech | BARRIER_COMPANION_CONTACTS | Ahora el ride. No tengo car. |  |  |  | N/A |  |  | same view | expected view PICKUP, got BARRIER_COMPANION_CONTACTS |
| 10 | speech | BARRIER_COMPANION_CONTACTS | Mi home address está bien. |  |  |  | N/A |  |  | same view |  |
| 11 | speech | BARRIER_COMPANION_CONTACTS | Uso walker. |  |  |  | N/A |  |  | same view |  |
| 12 | speech | BARRIER_COMPANION_CONTACTS | ¿A qué hora me pick up? |  |  |  | N/A |  |  | same view |  |
| 13 | speech | BARRIER_COMPANION_CONTACTS | Okay, search. |  |  |  | N/A |  |  | same view |  |
| 14 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 15 | speech | BARRIER_COMPANION_CONTACTS | ¿Cuál es más cheap? |  |  |  | N/A |  |  | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 16 | speech | BARRIER_COMPANION_CONTACTS | Book that one. |  |  |  | N/A |  |  | same view |  |
| 17 | speech | BARRIER_COMPANION_CONTACTS | Sí. |  |  |  | N/A |  |  | same view |  |
| 18 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 19 | speech | BARRIER_COMPANION_CONTACTS | ¿Está booked? |  |  |  | N/A |  |  | same view |  |
| 20 | speech | BARRIER_COMPANION_CONTACTS | Gracias, bye. |  |  |  | N/A |  |  | same view |  |

## Summary

```json
{
  "spoken_turns": 16,
  "total_turns": 20,
  "response_start_p50_ms": 1818,
  "response_start_p95_ms": 1898,
  "response_start_avg_ms": 1706,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 9: expected view PICKUP, got BARRIER_COMPANION_CONTACTS",
    "turn 15: the app sent no screen context to the provider before it answered this spoken turn"
  ]
}
```

## Observations

- voice start: state EMMI_THINKING, socket true, error "", 969 ms after tap
