# Voice session S20-long-spanglish-companion-and-ride-es

- patient_profile: F (utiliza Spanglish)
- language: es
- flow: long: companion invitation then a ride, all in Spanglish, with the confirmation gate exercised in both
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T20:27:28.672Z
- finished: 2026-09-04T20:30:53.155Z

17 spoken turns. 'appointment', 'daughter', 'ride', 'walker', 'pick up', 'cheap', 'booked': every turn mixes English words into Spanish. Before the guard change, several of these were discarded as unreliable.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Necesito que mi daughter venga conmigo al appointment. | Necesito que mi daughter venga conmigo al appointment. | Puede pedírselo a Maria (Hija) o a Carlos (Hijo). ¿A quién? | 1909 | NOTICEABLE DELAY | 6546 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_COMPANION_CONTACTS |  |
| 3 | speech | BARRIER_COMPANION_CONTACTS | ¿Qué va a ver ella? | ¿Qué va a ver ella? | Solo la fecha, la hora y el lugar de la cita. No ve su información de salud. | 1795 | NOTICEABLE DELAY | 8984 |  | same view |  |
| 4 | speech | BARRIER_COMPANION_CONTACTS | Ella habla English, ¿le llega en English? | Ella habla English, ¿le llega en English? | La invitación le llega en el idioma que ella tenga configurado; si no, en inglés. | 1760 | NOTICEABLE DELAY | 8109 |  | same view |  |
| 5 | speech | BARRIER_COMPANION_CONTACTS | Okay, send it a María. | Okay, send it a María. | Elegí a esa persona. La invitación no se envía hasta que confirme. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 10086 | VERY POOR | 16047 | performViewAction→ | same view | response start 10086 ms |
| 6 | speech | BARRIER_COMPANION_CONTACTS | Yes, mándala. | Yes, mándala. | Estoy enviando la invitación.  | 1787 | NOTICEABLE DELAY | 3456 | performViewAction→UNKNOWN_ACTION | same view |  |
| 7 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 8 | speech | BARRIER_COMPANION_CONTACTS | ¿Ya le llegó el text? | ¿Ya le llegó el text? | Todavía no.  | 1806 | NOTICEABLE DELAY | 2642 | describeCurrentView→ | same view |  |
| 9 | speech | BARRIER_COMPANION_CONTACTS | Ahora el ride. No tengo car. | Ahora el ride. No tengo car. | No pude completar ese paso: UNKNOWN_ACTION. | 1860 | NOTICEABLE DELAY | 4351 | performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→PERFORMED; performViewAction→UNKNOWN_ACTION | BARRIER_COMPANION_CONTACTS → BARRIER_COMPANION_REVIEW | expected view PICKUP, got BARRIER_COMPANION_REVIEW |
| 10 | speech | BARRIER_COMPANION_REVIEW | Mi home address está bien. | Mi home address está bien. | ¿Necesita alguna ayuda especial para viajar? | 1789 | NOTICEABLE DELAY | 4295 | performViewAction→UNKNOWN_ACTION | same view |  |
| 11 | speech | BARRIER_COMPANION_REVIEW | Uso walker. | Uso walker. | No pude completar ese paso: UNKNOWN_ACTION. | 1827 | NOTICEABLE DELAY | 4333 | performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION | same view |  |
| 12 | speech | BARRIER_COMPANION_REVIEW | ¿A qué hora me pick up? | ¿A qué hora me pick up? | Todavía no hay hora de recogida. | 1807 | NOTICEABLE DELAY | 4303 | describeCurrentView→ | same view |  |
| 13 | speech | BARRIER_COMPANION_REVIEW | Okay, search. | Okay, search. | Buscando. | 1804 | NOTICEABLE DELAY | 2402 | performViewAction→UNKNOWN_ACTION | same view |  |
| 14 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 15 | speech | BARRIER_COMPANION_REVIEW | ¿Cuál es más cheap? | ¿Cuál es más cheap? | No veo opciones en esta pantalla. | 1808 | NOTICEABLE DELAY | 4301 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 16 | speech | BARRIER_COMPANION_REVIEW | Book that one. | Book that one. | Seleccioné . Para reservarlo necesito su confirmación: . ¿Confirma? ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 8579 | VERY POOR | 14800 | describeCurrentView→; performViewAction→ | same view | response start 8579 ms |
| 17 | speech | BARRIER_COMPANION_REVIEW | Sí. | Sí. | Estoy reservando el viaje. Todavía no está confirmado.  | 1813 | NOTICEABLE DELAY | 5146 | performViewAction→UNKNOWN_ACTION | same view |  |
| 18 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 19 | speech | BARRIER_COMPANION_REVIEW | ¿Está booked? | ¿Está booked? | Todavía no. Carlos está elegida pero la invitación todavía NO se ha enviado | 1823 | NOTICEABLE DELAY | 7323 | describeCurrentView→ | same view |  |
| 20 | speech | BARRIER_COMPANION_REVIEW | Gracias, bye. | Gracias, bye. | De nada. Hasta luego. | 1777 | NOTICEABLE DELAY | 3444 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 16,
  "total_turns": 20,
  "response_start_p50_ms": 1807,
  "response_start_p95_ms": 10086,
  "response_start_avg_ms": 2752,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 2,
  "problems": [
    "turn 5: response start 10086 ms",
    "turn 9: expected view PICKUP, got BARRIER_COMPANION_REVIEW",
    "turn 15: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 16: response start 8579 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 1008 ms after tap
