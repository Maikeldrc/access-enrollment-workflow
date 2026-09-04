# Voice session S18-long-multi-intent-reschedule-es

- patient_profile: H (quiere completar todo rápido)
- language: es
- flow: long: two intents in one sentence (move the visit + tell my daughter), afternoon slot, confirmation, then the companion invitation, with reads of the new date/time
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:16:48.341Z
- finished: 2026-09-04T01:20:06.896Z

16 spoken turns. Multi-intent, corrections ('no, mejor por la tarde'), natural confirmations ('Dale', 'Confirma'), numbers and dates read aloud, memory of the second intent.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Cambia la cita al jueves y avísale a mi hija. | Cambia la cita al jueves y avísale a mi hija. | Voy por partes: primero busco horarios el jueves, y después le mando la invitación a su hija. ¿De acuerdo? | 2907 | POOR | 10907 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_RESCHEDULE_SLOTS | response start 2907 ms |
| 3 | speech | BARRIER_RESCHEDULE_SLOTS | Dale. | Dale. | Buscando horarios. | 1759 | NOTICEABLE DELAY | 2593 |  | same view |  |
| 4 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 5 | speech | BARRIER_RESCHEDULE_SLOTS | ¿Qué hay el jueves? | ¿Qué hay el jueves? | La del jueves es jueves, 10 de septiembre · 5:15 a. m.. | 1819 | NOTICEABLE DELAY | 6838 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 6 | speech | BARRIER_RESCHEDULE_SLOTS | No, mejor por la tarde. | No, mejor por la tarde. | Por la tarde hay miércoles, 9 de septiembre · 2:45 p. m.. ¿Esa? | 1751 | NOTICEABLE DELAY | 7180 | describeCurrentView→ | same view |  |
| 7 | speech | BARRIER_RESCHEDULE_SLOTS | Esa, rápido. | Esa, rápido. | Elegí miércoles, 9 de septiembre · 2:45 p. m.. La cita no cambia hasta que confirme. ¿Confirmo? | 1859 | NOTICEABLE DELAY | 9016 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_RESCHEDULE_SLOTS → BARRIER_RESCHEDULE_REVIEW |  |
| 8 | speech | BARRIER_RESCHEDULE_REVIEW | Confirma. | Confirma. | Listo. La cita cambió. | 2533 | POOR | 4201 | performViewAction→PERFORMED | BARRIER_RESCHEDULE_REVIEW → BARRIER_RESCHEDULE_CHANGED | response start 2533 ms |
| 9 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 10 | speech | BARRIER_RESCHEDULE_CHANGED | ¿Cambió? | ¿Cambió? | Sí, la cita ya cambió. La cita fue cambiada | 1795 | NOTICEABLE DELAY | 5546 | describeCurrentView→ | same view |  |
| 11 | speech | BARRIER_RESCHEDULE_CHANGED | Repíteme el día. | Repíteme el día. | El miércoles, 9 de septiembre. | 1775 | NOTICEABLE DELAY | 3863 | describeCurrentView→ | same view |  |
| 12 | speech | BARRIER_RESCHEDULE_CHANGED | Ahora lo de mi hija. | Ahora lo de mi hija. | Puede pedírselo a Maria (Hija) o a Carlos (Hijo). ¿A quién? | 1961 | NOTICEABLE DELAY | 6550 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_RESCHEDULE_CHANGED → BARRIER_COMPANION_CONTACTS |  |
| 13 | speech | BARRIER_COMPANION_CONTACTS | A María. | A María. | Elegí a Maria. La invitación no se envía hasta que confirme. | 1784 | NOTICEABLE DELAY | 6391 | performViewAction→PERFORMED | BARRIER_COMPANION_CONTACTS → BARRIER_COMPANION_REVIEW |  |
| 14 | speech | BARRIER_COMPANION_REVIEW | Sí, mándala. | Sí, mándala. | Listo. La invitación fue enviada. Invitación enviada a Maria | 2536 | POOR | 6289 | performViewAction→PERFORMED | BARRIER_COMPANION_REVIEW → BARRIER_COMPANION_CONFIRMED | response start 2536 ms |
| 15 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 16 | speech | BARRIER_COMPANION_CONFIRMED | ¿Y le llegó a mi hija? | ¿Y le llegó a mi hija? | Sí. Maria dijo que sí y le acompañará | 1797 | NOTICEABLE DELAY | 5125 | describeCurrentView→ | same view |  |
| 17 | speech | BARRIER_COMPANION_CONFIRMED | Léeme la cita nueva. | Léeme la cita nueva. | En pantalla: Doctor: Dr. Fresner Lee; Fecha: miércoles, 9 de septiembre; Hora: 2:45 p. m.; Dónde: Fresner Medical Group. | 1838 | NOTICEABLE DELAY | 9882 | performViewAction→PERFORMED | BARRIER_COMPANION_CONFIRMED → APPOINTMENT_CONFIRMED |  |
| 18 | speech | APPOINTMENT_CONFIRMED | ¿A qué hora dijiste? | ¿A qué hora dijiste? | A las 2:45 p. m.. | 1764 | NOTICEABLE DELAY | 3851 | describeCurrentView→ | same view |  |
| 19 | speech | APPOINTMENT_CONFIRMED | ¿Cuánto me van a cobrar? | ¿Cuánto me van a cobrar? | No puedo confirmar el monto ahora mismo; su equipo de cuidado sí puede. | 1805 | NOTICEABLE DELAY | 7249 | getExpectedAccessCost→ | same view |  |
| 20 | speech | APPOINTMENT_CONFIRMED | Ok, listo, bye. | Ok, listo, bye. | Listo. Hasta luego. | 1800 | NOTICEABLE DELAY | 3052 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 16,
  "total_turns": 20,
  "response_start_p50_ms": 1800,
  "response_start_p95_ms": 2907,
  "response_start_avg_ms": 1968,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 2: response start 2907 ms",
    "turn 5: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 8: response start 2533 ms",
    "turn 14: response start 2536 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 1003 ms after tap
