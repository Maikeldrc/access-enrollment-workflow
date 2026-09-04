# Voice session S18-long-multi-intent-reschedule-es

- patient_profile: H (quiere completar todo rápido)
- language: es
- flow: long: two intents in one sentence (move the visit + tell my daughter), afternoon slot, confirmation, then the companion invitation, with reads of the new date/time
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T21:43:19.535Z
- finished: 2026-09-04T21:46:23.758Z

16 spoken turns. Multi-intent, corrections ('no, mejor por la tarde'), natural confirmations ('Dale', 'Confirma'), numbers and dates read aloud, memory of the second intent.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Cambia la cita al jueves y avísale a mi hija. | Cambia la cita al jueves y avísale a mi hija. | Voy por partes: primero busco horarios el jueves, y después le mando la invitación a su hija. ¿De acuerdo? | 2875 | POOR | 10942 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_RESCHEDULE_SLOTS | response start 2875 ms |
| 3 | speech | BARRIER_RESCHEDULE_SLOTS | Dale. | Dale. | Buscando horarios. | 1803 | NOTICEABLE DELAY | 2638 |  | same view |  |
| 4 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 5 | speech | BARRIER_RESCHEDULE_SLOTS | ¿Qué hay el jueves? | ¿Qué hay el jueves? | La del jueves es jueves, 10 de septiembre · 9:15 a. m.. | 1821 | NOTICEABLE DELAY | 6904 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 6 | speech | BARRIER_RESCHEDULE_SLOTS | No, mejor por la tarde. | No, mejor por la tarde. | Por la tarde hay lunes, 7 de septiembre · 2:45 p. m.. ¿Esa? | 1788 | NOTICEABLE DELAY | 7305 | describeCurrentView→ | same view |  |
| 7 | speech | BARRIER_RESCHEDULE_SLOTS | Esa, rápido. | Esa, rápido. | Elegí lunes, 7 de septiembre · 2:45 p. m.. La cita no cambia hasta que confirme. ¿Confirmo? | 1838 | NOTICEABLE DELAY | 9082 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_RESCHEDULE_SLOTS → BARRIER_RESCHEDULE_REVIEW |  |
| 8 | speech | BARRIER_RESCHEDULE_REVIEW | Confirma. | Confirma. | Listo. La cita cambió. | 2539 | POOR | 4201 | performViewAction→PERFORMED | BARRIER_RESCHEDULE_REVIEW → BARRIER_RESCHEDULE_CHANGED | response start 2539 ms |
| 9 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 10 | speech | BARRIER_RESCHEDULE_CHANGED | ¿Cambió? | ¿Cambió? | Sí, la cita ya cambió. La cita fue cambiada | 1802 | NOTICEABLE DELAY | 5579 | describeCurrentView→ | same view |  |
| 11 | speech | BARRIER_RESCHEDULE_CHANGED | Repíteme el día. | Repíteme el día. | El lunes, 7 de septiembre. | 1790 | NOTICEABLE DELAY | 3877 | describeCurrentView→ | same view |  |
| 12 | speech | BARRIER_RESCHEDULE_CHANGED | Ahora lo de mi hija. | Ahora lo de mi hija. | Puede pedírselo a Maria (Hija) o a Carlos (Hijo). ¿A quién? | 1878 | NOTICEABLE DELAY | 6533 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_RESCHEDULE_CHANGED → BARRIER_COMPANION_CONTACTS |  |
| 13 | speech | BARRIER_COMPANION_CONTACTS | A María. | A María. | Elegí a Maria. La invitación no se envía hasta que confirme. | 1783 | NOTICEABLE DELAY | 6396 | performViewAction→PERFORMED | BARRIER_COMPANION_CONTACTS → BARRIER_COMPANION_REVIEW |  |
| 14 | speech | BARRIER_COMPANION_REVIEW | Sí, mándala. | Sí, mándala. | Listo. La invitación fue enviada. Invitación enviada a Maria | 2575 | POOR | 6335 | performViewAction→PERFORMED | BARRIER_COMPANION_REVIEW → BARRIER_COMPANION_CONFIRMED | response start 2575 ms |
| 15 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 16 | speech | BARRIER_COMPANION_CONFIRMED | ¿Y le llegó a mi hija? | ¿Y le llegó a mi hija? | Sí. Maria dijo que sí y le acompañará | 1804 | NOTICEABLE DELAY | 5150 | describeCurrentView→ | same view |  |
| 17 | speech | BARRIER_COMPANION_CONFIRMED | Léeme la cita nueva. | Léeme la cita nueva. | En pantalla: Doctor: Dr. Fresner Lee; Fecha: lunes, 7 de septiembre; Hora: 2:45 p. m.; Dónde: Fresner Medical Group. | 1847 | NOTICEABLE DELAY | 9943 | performViewAction→PERFORMED | BARRIER_COMPANION_CONFIRMED → APPOINTMENT_CONFIRMED |  |
| 18 | speech | APPOINTMENT_CONFIRMED | ¿A qué hora dijiste? | ¿A qué hora dijiste? | A las 2:45 p. m.. | 1761 | NOTICEABLE DELAY | 3848 | describeCurrentView→ | same view |  |
| 19 | speech | APPOINTMENT_CONFIRMED | ¿Cuánto me van a cobrar? | ¿Cuánto me van a cobrar? | No puedo confirmar el monto ahora mismo; su equipo de cuidado sí puede. | 1776 | NOTICEABLE DELAY | 7293 | getExpectedAccessCost→ | same view |  |
| 20 | speech | APPOINTMENT_CONFIRMED | Ok, listo, bye. | Ok, listo, bye. | Listo. Hasta luego. | 1803 | NOTICEABLE DELAY | 3056 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 16,
  "total_turns": 20,
  "response_start_p50_ms": 1803,
  "response_start_p95_ms": 2875,
  "response_start_avg_ms": 1968,
  "app_overhead_p50_ms": 2,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 2: response start 2875 ms",
    "turn 5: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 8: response start 2539 ms",
    "turn 14: response start 2575 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 421 ms after tap
