# Voice session S01-transport-canonical-es

- patient_profile: A (adulto mayor, responde muy poco)
- language: es
- flow: MY_CARE → appointment → transportation (offer → pickup → needs → time → options → review → booked)
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T19:32:11.675Z
- finished: 2026-09-04T19:34:49.572Z

The canonical conversation from the brief: 'No tengo cómo llegar a la cita' through 'Listo. El viaje quedó reservado.' Navigation is done by EMMI's own tool calls.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | No tengo cómo llegar a la cita. | No tengo cómo llegar a la cita. | Puedo ayudarle con eso. ¿Quiere que busquemos transporte? | 1760 | NOTICEABLE DELAY | 5085 |  | same view |  |
| 3 | speech | APPOINTMENT_CONFIRMED | Sí. | Sí. | Usaremos su dirección registrada, 123 Oak Avenue, Apt 4B · Miami, FL 33176. ¿Necesita alguna ayuda especial para viajar? | 1910 | NOTICEABLE DELAY | 9968 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 4 | speech | BARRIER_TRANSPORTATION_PICKUP | Uso walker. | Uso walker. | Gracias. Lo tendré en cuenta. Voy a revisar las opciones disponibles. | 1872 | NOTICEABLE DELAY | 6506 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_OPTIONS |  |
| 5 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 6 | speech | BARRIER_TRANSPORTATION_OPTIONS | ¿Cuál tiene más espacio? | ¿Cuál tiene más espacio? | UberXL tiene más espacio. | 1808 | NOTICEABLE DELAY | 3477 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 7 | speech | BARRIER_TRANSPORTATION_OPTIONS | Esa. | Esa. | Seleccioné UberXL. Todavía falta confirmar la reserva. | 1814 | NOTICEABLE DELAY | 4726 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 8 | speech | BARRIER_TRANSPORTATION_REVIEW | Ok, hazlo. | Ok, hazlo. | Antes de reservar: le recogería a las 9:40 de la mañana en su casa. ¿Quiere confirmar? | 1822 | NOTICEABLE DELAY | 8603 |  | same view |  |
| 9 | speech | BARRIER_TRANSPORTATION_REVIEW | Sí. | Sí. | Estoy reservando el viaje. Todavía no está confirmado. El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión | 1846 | NOTICEABLE DELAY | 11647 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_BOOKING_FAILED |  |
| 10 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 11 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | ¿Ya está? | ¿Ya está? | No. La reserva falló y no se cobró nada. ¿Intento de nuevo o busco otro vehículo? | 1790 | NOTICEABLE DELAY | 8575 | describeCurrentView→ | same view |  |
| 12 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | ¿Qué sigue? | ¿Qué sigue? | La reserva no se realizó. No se reservó ni se cobró nada. Falta: El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión. | 1793 | NOTICEABLE DELAY | 13778 | describeCurrentView→ | same view |  |
| 13 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | No, déjalo así. | No, déjalo así. | Aquí puede continuar. | 1832 | NOTICEABLE DELAY | 3084 | performViewAction→UNKNOWN_ACTION | same view |  |
| 14 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Gracias. | Gracias. | De nada. Aquí estoy si necesita algo más. | 1785 | NOTICEABLE DELAY | 5121 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 11,
  "total_turns": 14,
  "response_start_p50_ms": 1814,
  "response_start_p95_ms": 1910,
  "response_start_avg_ms": 1821,
  "app_overhead_p50_ms": 3,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 6: the app sent no screen context to the provider before it answered this spoken turn"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 812 ms after tap
