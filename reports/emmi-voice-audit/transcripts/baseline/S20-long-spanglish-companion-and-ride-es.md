# Voice session S20-long-spanglish-companion-and-ride-es

- patient_profile: F (utiliza Spanglish)
- language: es
- flow: long: companion invitation then a ride, all in Spanglish, with the confirmation gate exercised in both
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:08:44.092Z
- finished: 2026-09-04T01:12:07.494Z

17 spoken turns. 'appointment', 'daughter', 'ride', 'walker', 'pick up', 'cheap', 'booked': every turn mixes English words into Spanish. Before the guard change, several of these were discarded as unreliable.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Necesito que mi daughter venga conmigo al appointment. | Necesito que mi daughter venga conmigo al appointment. | Puede pedírselo a Maria (Hija) o a Carlos (Hijo). ¿A quién? | 1909 | NOTICEABLE DELAY | 6508 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_COMPANION_CONTACTS |  |
| 3 | speech | BARRIER_COMPANION_CONTACTS | ¿Qué va a ver ella? | ¿Qué va a ver ella? | Solo la fecha, la hora y el lugar de la cita. No ve su información de salud. | 1842 | NOTICEABLE DELAY | 8991 |  | same view |  |
| 4 | speech | BARRIER_COMPANION_CONTACTS | Ella habla English, ¿le llega en English? | Ella habla English, ¿le llega en English? | La invitación le llega en el idioma que ella tenga configurado; si no, en inglés. | 1822 | NOTICEABLE DELAY | 8122 |  | same view |  |
| 5 | speech | BARRIER_COMPANION_CONTACTS | Okay, send it a María. | Okay, send it a María. | Elegí a esa persona. La invitación no se envía hasta que confirme. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 7070 | VERY POOR | 15933 | performViewAction→ | same view | response start 7070 ms |
| 6 | speech | BARRIER_COMPANION_CONTACTS | Yes, mándala. | Yes, mándala. | Estoy enviando la invitación.  | 1860 | NOTICEABLE DELAY | 3532 | performViewAction→UNKNOWN_ACTION | same view |  |
| 7 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 8 | speech | BARRIER_COMPANION_CONTACTS | ¿Ya le llegó el text? | ¿Ya le llegó el text? | Todavía no.  | 1846 | NOTICEABLE DELAY | 2698 | describeCurrentView→ | same view |  |
| 9 | speech | BARRIER_COMPANION_CONTACTS | Ahora el ride. No tengo car. | Ahora el ride. No tengo car. | No pude completar ese paso: UNKNOWN_ACTION. | 1826 | NOTICEABLE DELAY | 4320 | performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION; performViewAction→PERFORMED; performViewAction→UNKNOWN_ACTION | BARRIER_COMPANION_CONTACTS → BARRIER_COMPANION_REVIEW | expected view PICKUP, got BARRIER_COMPANION_REVIEW |
| 10 | speech | BARRIER_COMPANION_REVIEW | Mi home address está bien. | Mi home address está bien. | ¿Necesita alguna ayuda especial para viajar? | 1821 | NOTICEABLE DELAY | 4312 | performViewAction→UNKNOWN_ACTION | same view |  |
| 11 | speech | BARRIER_COMPANION_REVIEW | Uso walker. | Uso walker. | No pude completar ese paso: UNKNOWN_ACTION. | 1819 | NOTICEABLE DELAY | 4309 | performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION | same view |  |
| 12 | speech | BARRIER_COMPANION_REVIEW | ¿A qué hora me pick up? | ¿A qué hora me pick up? | Todavía no hay hora de recogida. | 1833 | NOTICEABLE DELAY | 4336 | describeCurrentView→ | same view |  |
| 13 | speech | BARRIER_COMPANION_REVIEW | Okay, search. | Okay, search. | Buscando. | 1806 | NOTICEABLE DELAY | 2407 | performViewAction→UNKNOWN_ACTION | same view |  |
| 14 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 15 | speech | BARRIER_COMPANION_REVIEW | ¿Cuál es más cheap? | ¿Cuál es más cheap? | No veo opciones en esta pantalla. | 1832 | NOTICEABLE DELAY | 4334 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 16 | speech | BARRIER_COMPANION_REVIEW | Book that one. | Book that one. | Seleccioné . Para reservarlo necesito su confirmación: . ¿Confirma? ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 5866 | VERY POOR | 14762 | describeCurrentView→; performViewAction→ | same view | response start 5866 ms |
| 17 | speech | BARRIER_COMPANION_REVIEW | Sí. | Sí. | Estoy reservando el viaje. Todavía no está confirmado.  | 1859 | NOTICEABLE DELAY | 5185 | performViewAction→UNKNOWN_ACTION | same view |  |
| 18 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 19 | speech | BARRIER_COMPANION_REVIEW | ¿Está booked? | ¿Está booked? | Todavía no. Carlos está elegida pero la invitación todavía NO se ha enviado | 1778 | NOTICEABLE DELAY | 7229 | describeCurrentView→ | same view |  |
| 20 | speech | BARRIER_COMPANION_REVIEW | Gracias, bye. | Gracias, bye. | De nada. Hasta luego. | 1787 | NOTICEABLE DELAY | 3451 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 16,
  "total_turns": 20,
  "response_start_p50_ms": 1832,
  "response_start_p95_ms": 7070,
  "response_start_avg_ms": 2411,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 2,
  "problems": [
    "turn 5: response start 7070 ms",
    "turn 9: expected view PICKUP, got BARRIER_COMPANION_REVIEW",
    "turn 15: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 16: response start 5866 ms"
  ]
}
```

## Observations

- voice start: state EMMI_THINKING, socket true, error "", 1028 ms after tap
