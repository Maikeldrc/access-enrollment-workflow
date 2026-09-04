# Voice session S01-transport-canonical-es

- patient_profile: A (adulto mayor, responde muy poco)
- language: es
- flow: MY_CARE → appointment → transportation (offer → pickup → needs → time → options → review → booked)
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:06:17.371Z
- finished: 2026-09-04T01:08:43.851Z

The canonical conversation from the brief: 'No tengo cómo llegar a la cita' through 'Listo. El viaje quedó reservado.' Navigation is done by EMMI's own tool calls.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | No tengo cómo llegar a la cita. | No tengo cómo llegar a la cita. | Puedo ayudarle con eso. ¿Quiere que busquemos transporte? | 1802 | NOTICEABLE DELAY | 5135 |  | same view |  |
| 3 | speech | APPOINTMENT_CONFIRMED | Sí. | Sí. | Usaremos su dirección registrada, 123 Oak Avenue, Apt 4B · Miami, FL 33176. ¿Necesita alguna ayuda especial para viajar? | 1966 | NOTICEABLE DELAY | 9963 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 4 | speech | BARRIER_TRANSPORTATION_PICKUP | Uso walker. | Uso walker. | Gracias. Lo tendré en cuenta. Voy a revisar las opciones disponibles. | 2872 | POOR | 7461 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_OPTIONS | response start 2872 ms |
| 5 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 6 | speech | BARRIER_TRANSPORTATION_OPTIONS | ¿Cuál tiene más espacio? | ¿Cuál tiene más espacio? | UberXL tiene más espacio. | 1799 | NOTICEABLE DELAY | 3473 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 7 | speech | BARRIER_TRANSPORTATION_OPTIONS | Esa. | Esa. | Seleccioné UberXL. Todavía falta confirmar la reserva. | 1835 | NOTICEABLE DELAY | 4751 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 8 | speech | BARRIER_TRANSPORTATION_REVIEW | Ok, hazlo. | Ok, hazlo. | Antes de reservar: le recogería a las 9:40 de la mañana en su casa. ¿Quiere confirmar? | 1816 | NOTICEABLE DELAY | 8574 |  | same view |  |
| 9 | speech | BARRIER_TRANSPORTATION_REVIEW | Sí. | Sí. | Listo. El viaje quedó reservado. | 2735 | POOR | 4817 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_RETURN_OFFER | response start 2735 ms |
| 10 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 11 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | ¿Ya está? | ¿Ya está? | Sí, el viaje ya quedó reservado. | 1837 | NOTICEABLE DELAY | 4374 | describeCurrentView→ | same view |  |
| 12 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | ¿Qué sigue? | ¿Qué sigue? | El viaje de ida está reservado. Decida si también quiere el regreso. Falta: Si también quiere transporte de regreso. | 1857 | NOTICEABLE DELAY | 9914 | describeCurrentView→ | same view |  |
| 13 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | No, déjalo así. | No, déjalo así. | El viaje está reservado. Puede cambiarlo o cancelarlo desde aquí. | 1867 | NOTICEABLE DELAY | 6091 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_RETURN_OFFER → BARRIER_TRANSPORTATION_BOOKED |  |
| 14 | speech | BARRIER_TRANSPORTATION_BOOKED | Gracias. | Gracias. | De nada. Aquí estoy si necesita algo más. | 1875 | NOTICEABLE DELAY | 5226 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 11,
  "total_turns": 14,
  "response_start_p50_ms": 1857,
  "response_start_p95_ms": 2872,
  "response_start_avg_ms": 2024,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 4: response start 2872 ms",
    "turn 6: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 9: response start 2735 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 1050 ms after tap
