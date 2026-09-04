# Voice session S20-long-spanglish-companion-and-ride-es

- patient_profile: F (utiliza Spanglish)
- language: es
- flow: long: companion invitation then a ride, all in Spanglish, with the confirmation gate exercised in both
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T21:50:30.622Z
- finished: 2026-09-04T21:53:32.260Z

17 spoken turns. 'appointment', 'daughter', 'ride', 'walker', 'pick up', 'cheap', 'booked': every turn mixes English words into Spanish. Before the guard change, several of these were discarded as unreliable.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Necesito que mi daughter venga conmigo al appointment. | Necesito que mi daughter venga conmigo al appointment. | Puede pedírselo a Maria (Hija) o a Carlos (Hijo). ¿A quién? | 1880 | NOTICEABLE DELAY | 6503 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_COMPANION_CONTACTS |  |
| 3 | speech | BARRIER_COMPANION_CONTACTS | ¿Qué va a ver ella? | ¿Qué va a ver ella? | Solo la fecha, la hora y el lugar de la cita. No ve su información de salud. | 1809 | NOTICEABLE DELAY | 8996 |  | same view |  |
| 4 | speech | BARRIER_COMPANION_CONTACTS | Ella habla English, ¿le llega en English? | Ella habla English, ¿le llega en English? | La invitación le llega en el idioma que ella tenga configurado; si no, en inglés. | 1780 | NOTICEABLE DELAY | 8122 |  | same view |  |
| 5 | speech | BARRIER_COMPANION_CONTACTS | Okay, send it a María. | Okay, send it a María. | Elegí a Maria. La invitación no se envía hasta que confirme. | 1775 | NOTICEABLE DELAY | 6420 | performViewAction→PERFORMED | BARRIER_COMPANION_CONTACTS → BARRIER_COMPANION_REVIEW |  |
| 6 | speech | BARRIER_COMPANION_REVIEW | Yes, mándala. | Yes, mándala. | Listo. La invitación fue enviada. Invitación enviada a Maria | 2626 | POOR | 6397 | performViewAction→PERFORMED | BARRIER_COMPANION_REVIEW → BARRIER_COMPANION_CONFIRMED | response start 2626 ms |
| 7 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 8 | speech | BARRIER_COMPANION_CONFIRMED | ¿Ya le llegó el text? | ¿Ya le llegó el text? | Sí. Maria dijo que sí y le acompañará | 1808 | NOTICEABLE DELAY | 5155 | describeCurrentView→ | same view |  |
| 9 | speech | BARRIER_COMPANION_CONFIRMED | Ahora el ride. No tengo car. | Ahora el ride. No tengo car. | Busquemos transporte. ¿Le recogemos en su casa, 123 Oak Avenue, Apt 4B · Miami, FL 33176? | 1893 | NOTICEABLE DELAY | 8681 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_COMPANION_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 10 | speech | BARRIER_TRANSPORTATION_PICKUP | Mi home address está bien. | Mi home address está bien. | ¿Necesita alguna ayuda especial para viajar? | 1812 | NOTICEABLE DELAY | 4310 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS |  |
| 11 | speech | BARRIER_TRANSPORTATION_NEEDS | Uso walker. | Uso walker. | Le recogerían a las 1:45 p. m.. ¿Busco vehículos? | 1833 | NOTICEABLE DELAY | 5608 | performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_TIME |  |
| 12 | speech | BARRIER_TRANSPORTATION_TIME | ¿A qué hora me pick up? | ¿A qué hora me pick up? | Le recogerían a las 1:45 p. m.. ¿Busco vehículos? | 1799 | NOTICEABLE DELAY | 5582 | describeCurrentView→ | same view |  |
| 13 | speech | BARRIER_TRANSPORTATION_TIME | Okay, search. | Okay, search. | Buscando. | 2573 | POOR | 3178 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_TIME → BARRIER_TRANSPORTATION_OPTIONS | response start 2573 ms |
| 14 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 15 | speech | BARRIER_TRANSPORTATION_OPTIONS | ¿Cuál es más cheap? | ¿Cuál es más cheap? | La más barata es UberX, $27.95. | 1786 | NOTICEABLE DELAY | 4301 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 16 | speech | BARRIER_TRANSPORTATION_OPTIONS | Book that one. | Book that one. | Seleccioné UberX. Para reservarlo necesito su confirmación: Vehículo estándar · $27.95 · 1:45 p. m.. ¿Confirma? | 1844 | NOTICEABLE DELAY | 8657 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 17 | speech | BARRIER_TRANSPORTATION_REVIEW | Sí. | Sí. | Listo. El viaje quedó reservado. | 2565 | POOR | 4653 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_RETURN_OFFER | response start 2565 ms |
| 18 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 19 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | ¿Está booked? | ¿Está booked? | Sí, el viaje ya quedó reservado. | 1785 | NOTICEABLE DELAY | 4287 | describeCurrentView→ | same view |  |
| 20 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Gracias, bye. | Gracias, bye. | De nada. Hasta luego. | 1756 | NOTICEABLE DELAY | 3433 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 16,
  "total_turns": 20,
  "response_start_p50_ms": 1809,
  "response_start_p95_ms": 2626,
  "response_start_avg_ms": 1958,
  "app_overhead_p50_ms": 2,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 6: response start 2626 ms",
    "turn 13: response start 2573 ms",
    "turn 15: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 17: response start 2565 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 426 ms after tap
