# Voice session S20-long-spanglish-companion-and-ride-es

- patient_profile: F (utiliza Spanglish)
- language: es
- flow: long: companion invitation then a ride, all in Spanglish, with the confirmation gate exercised in both
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T04:47:51.669Z
- finished: 2026-09-04T04:51:12.826Z

17 spoken turns. 'appointment', 'daughter', 'ride', 'walker', 'pick up', 'cheap', 'booked': every turn mixes English words into Spanish. Before the guard change, several of these were discarded as unreliable.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Necesito que mi daughter venga conmigo al appointment. | Necesito que mi daughter venga conmigo al appointment. | Puede pedírselo a Maria (Hija) o a Carlos (Hijo). ¿A quién? | 1859 | NOTICEABLE DELAY | 6472 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_COMPANION_CONTACTS |  |
| 3 | speech | BARRIER_COMPANION_CONTACTS | ¿Qué va a ver ella? | ¿Qué va a ver ella? | Solo la fecha, la hora y el lugar de la cita. No ve su información de salud. | 1813 | NOTICEABLE DELAY | 8934 |  | same view |  |
| 4 | speech | BARRIER_COMPANION_CONTACTS | Ella habla English, ¿le llega en English? | Ella habla English, ¿le llega en English? | La invitación le llega en el idioma que ella tenga configurado; si no, en inglés. | 1807 | NOTICEABLE DELAY | 8070 |  | same view |  |
| 5 | speech | BARRIER_COMPANION_CONTACTS | Okay, send it a María. | Okay, send it a María. | Elegí a Maria. La invitación no se envía hasta que confirme. | 1810 | NOTICEABLE DELAY | 6393 | performViewAction→PERFORMED | BARRIER_COMPANION_CONTACTS → BARRIER_COMPANION_REVIEW |  |
| 6 | speech | BARRIER_COMPANION_REVIEW | Yes, mándala. | Yes, mándala. | Listo. La invitación fue enviada. Invitación enviada a Maria | 2540 | POOR | 6306 | performViewAction→PERFORMED | BARRIER_COMPANION_REVIEW → BARRIER_COMPANION_CONFIRMED | response start 2540 ms |
| 7 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 8 | speech | BARRIER_COMPANION_CONFIRMED | ¿Ya le llegó el text? | ¿Ya le llegó el text? | Sí. Maria dijo que sí y le acompañará | 1835 | NOTICEABLE DELAY | 5165 | describeCurrentView→ | same view |  |
| 9 | speech | BARRIER_COMPANION_CONFIRMED | Ahora el ride. No tengo car. | Ahora el ride. No tengo car. | Busquemos transporte. ¿Le recogemos en su casa, 123 Oak Avenue, Apt 4B · Miami, FL 33176? | 1876 | NOTICEABLE DELAY | 8582 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_COMPANION_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 10 | speech | BARRIER_TRANSPORTATION_PICKUP | Mi home address está bien. | Mi home address está bien. | ¿Necesita alguna ayuda especial para viajar? | 1854 | NOTICEABLE DELAY | 4365 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS |  |
| 11 | speech | BARRIER_TRANSPORTATION_NEEDS | Uso walker. | Uso walker. | Le recogerían a las 9:45 a. m.. ¿Busco vehículos? | 1836 | NOTICEABLE DELAY | 5592 | performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_TIME |  |
| 12 | speech | BARRIER_TRANSPORTATION_TIME | ¿A qué hora me pick up? | ¿A qué hora me pick up? | Le recogerían a las 9:45 a. m.. ¿Busco vehículos? | 1808 | NOTICEABLE DELAY | 5557 | describeCurrentView→ | same view |  |
| 13 | speech | BARRIER_TRANSPORTATION_TIME | Okay, search. | Okay, search. | Buscando. | 2740 | POOR | 3343 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_TIME → BARRIER_TRANSPORTATION_OPTIONS | response start 2740 ms |
| 14 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 15 | speech | BARRIER_TRANSPORTATION_OPTIONS | ¿Cuál es más cheap? | ¿Cuál es más cheap? | La más barata es UberX, $27.95. | 1846 | NOTICEABLE DELAY | 4344 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 16 | speech | BARRIER_TRANSPORTATION_OPTIONS | Book that one. | Book that one. | Seleccioné UberX. Para reservarlo necesito su confirmación: Vehículo estándar · $27.95 · 9:45 a. m.. ¿Confirma? | 1805 | NOTICEABLE DELAY | 8524 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 17 | speech | BARRIER_TRANSPORTATION_REVIEW | Sí. | Sí. | Estoy reservando el viaje. Todavía no está confirmado. La reserva falló: no se reservó nada | 2585 | POOR | 8883 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_BOOKING_FAILED | response start 2585 ms |
| 18 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 19 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | ¿Está booked? | ¿Está booked? | Todavía no. La reserva falló: no se reservó nada | 1851 | NOTICEABLE DELAY | 5599 | describeCurrentView→ | same view |  |
| 20 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Gracias, bye. | Gracias, bye. | De nada. Hasta luego. | 1801 | NOTICEABLE DELAY | 3464 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 16,
  "total_turns": 20,
  "response_start_p50_ms": 1836,
  "response_start_p95_ms": 2740,
  "response_start_avg_ms": 1979,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 6: response start 2540 ms",
    "turn 13: response start 2740 ms",
    "turn 15: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 17: response start 2585 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 884 ms after tap
