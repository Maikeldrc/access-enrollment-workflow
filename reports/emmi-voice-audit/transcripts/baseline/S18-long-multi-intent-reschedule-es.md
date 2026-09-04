# Voice session S18-long-multi-intent-reschedule-es

- patient_profile: H (quiere completar todo rápido)
- language: es
- flow: long: two intents in one sentence (move the visit + tell my daughter), afternoon slot, confirmation, then the companion invitation, with reads of the new date/time
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:00:36.345Z
- finished: 2026-09-04T01:04:16.442Z

16 spoken turns. Multi-intent, corrections ('no, mejor por la tarde'), natural confirmations ('Dale', 'Confirma'), numbers and dates read aloud, memory of the second intent.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Cambia la cita al jueves y avísale a mi hija. | Cambia la cita al jueves y avísale a mi hija. | Voy por partes: primero busco horarios el jueves, y después le mando la invitación a su hija. ¿De acuerdo? | 1886 | NOTICEABLE DELAY | 10062 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_RESCHEDULE_SLOTS |  |
| 3 | speech | BARRIER_RESCHEDULE_SLOTS | Dale. | Dale. | Buscando horarios. | 1831 | NOTICEABLE DELAY | 2687 |  | same view |  |
| 4 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 5 | speech | BARRIER_RESCHEDULE_SLOTS | ¿Qué hay el jueves? | ¿Qué hay el jueves? | La del jueves es jueves, 10 de septiembre · 5:15 a. m.. | 1775 | NOTICEABLE DELAY | 6802 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 6 | speech | BARRIER_RESCHEDULE_SLOTS | No, mejor por la tarde. | No, mejor por la tarde. | No veo horarios por la tarde. Hay: . ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 5373 | VERY POOR | 14253 | describeCurrentView→ | same view | response start 5373 ms |
| 7 | speech | BARRIER_RESCHEDULE_SLOTS | Esa, rápido. | Esa, rápido. | Elegí lunes, 7 de septiembre · 10:45 a. m.. La cita no cambia hasta que confirme. ¿Confirmo? | 1884 | NOTICEABLE DELAY | 9054 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_RESCHEDULE_SLOTS → BARRIER_RESCHEDULE_REVIEW |  |
| 8 | speech | BARRIER_RESCHEDULE_REVIEW | Confirma. | Confirma. | Estoy cambiando la cita. Hay un nuevo horario elegido pero la cita todavía NO ha cambiado | 1783 | NOTICEABLE DELAY | 8497 | performViewAction→PERFORMED | BARRIER_RESCHEDULE_REVIEW → BARRIER_RESCHEDULE_CHANGED |  |
| 9 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 10 | speech | BARRIER_RESCHEDULE_CHANGED | ¿Cambió? | ¿Cambió? | Sí, la cita ya cambió. La cita fue cambiada | 1845 | NOTICEABLE DELAY | 5592 | describeCurrentView→ | same view |  |
| 11 | speech | BARRIER_RESCHEDULE_CHANGED | Repíteme el día. | Repíteme el día. | El lunes, 7 de septiembre. | 1836 | NOTICEABLE DELAY | 3921 | describeCurrentView→ | same view |  |
| 12 | speech | BARRIER_RESCHEDULE_CHANGED | Ahora lo de mi hija. | Ahora lo de mi hija. | Puede pedírselo a Maria (Hija) o a Carlos (Hijo). ¿A quién? | 1973 | NOTICEABLE DELAY | 6571 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_RESCHEDULE_CHANGED → BARRIER_COMPANION_CONTACTS |  |
| 13 | speech | BARRIER_COMPANION_CONTACTS | A María. | A María. | Elegí a Maria. La invitación no se envía hasta que confirme. | 1787 | NOTICEABLE DELAY | 6379 | performViewAction→PERFORMED | BARRIER_COMPANION_CONTACTS → BARRIER_COMPANION_REVIEW |  |
| 14 | speech | BARRIER_COMPANION_REVIEW | Sí, mándala. | Sí, mándala. | Estoy enviando la invitación. Maria está elegida pero la invitación todavía NO se ha enviado | 1846 | NOTICEABLE DELAY | 8179 | performViewAction→PERFORMED | BARRIER_COMPANION_REVIEW → BARRIER_COMPANION_CONFIRMED |  |
| 15 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 16 | speech | BARRIER_COMPANION_CONFIRMED | ¿Y le llegó a mi hija? | ¿Y le llegó a mi hija? | Todavía no.  | 1800 | NOTICEABLE DELAY | 2643 | describeCurrentView→ | same view |  |
| 17 | speech | BARRIER_COMPANION_CONFIRMED | Léeme la cita nueva. | Léeme la cita nueva. | I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 2359 | NOTICEABLE DELAY | 11298 | performViewAction→ | same view |  |
| 18 | speech | BARRIER_COMPANION_CONFIRMED | ¿A qué hora dijiste? | ¿A qué hora dijiste? | A las 10:45 a. m.. | 1796 | NOTICEABLE DELAY | 3880 | describeCurrentView→ | same view |  |
| 19 | speech | BARRIER_COMPANION_CONFIRMED | ¿Cuánto me van a cobrar? | ¿Cuánto me van a cobrar? | No puedo confirmar el monto ahora mismo; su equipo de cuidado sí puede. | 1833 | NOTICEABLE DELAY | 7295 | getExpectedAccessCost→ | same view |  |
| 20 | speech | BARRIER_COMPANION_CONFIRMED | Ok, listo, bye. | Ok, listo, bye. | Listo. Hasta luego. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 3533 | POOR | 12458 |  | same view | response start 3533 ms |

## Summary

```json
{
  "spoken_turns": 16,
  "total_turns": 20,
  "response_start_p50_ms": 1836,
  "response_start_p95_ms": 5373,
  "response_start_avg_ms": 2196,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 3,
  "problems": [
    "turn 5: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 6: response start 5373 ms",
    "turn 20: response start 3533 ms"
  ]
}
```

## Observations

- voice start: state EMMI_THINKING, socket true, error "", 497 ms after tap
