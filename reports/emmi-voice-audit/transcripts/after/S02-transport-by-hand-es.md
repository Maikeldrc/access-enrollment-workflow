# Voice session S02-transport-by-hand-es

- patient_profile: C (se confunde fácilmente)
- language: es
- flow: transportation navigated by the patient's own taps while voice stays on
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:08:44.685Z
- finished: 2026-09-04T01:12:07.738Z

The patient taps through the screens and asks a contextual question on each one. Tests whether the provider is told about each screen before a spoken question is answered.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | No sé qué tengo que hacer. | No sé qué tengo que hacer. | Esta visita está confirmada. Desde aquí puede prepararse, pedir ayuda para llegar, cambiarla o cancelarla. | 1807 | NOTICEABLE DELAY | 8107 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 3 | tap | APPOINTMENT_CONFIRMED | (taps Algo lo dificulta) | | | | | | | APPOINTMENT_CONFIRMED → APPOINTMENT_PRE_VISIT_CHECK | context pushed: 0, narration: none |
| 4 | speech | APPOINTMENT_PRE_VISIT_CHECK | ¿Qué hago aquí? | ¿Qué hago aquí? | Elija lo que pueda dificultar llegar a esta visita y trataré de resolverlo con usted. | 1790 | NOTICEABLE DELAY | 8069 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 5 | tap | APPOINTMENT_PRE_VISIT_CHECK | (taps Transporte) | | | | | | | APPOINTMENT_PRE_VISIT_CHECK → BARRIER_TRANSPORTATION_OFFER | context pushed: 0, narration: none |
| 6 | tap | BARRIER_TRANSPORTATION_OFFER | (taps Sí, buscar transporte) | | | | | | | BARRIER_TRANSPORTATION_OFFER → BARRIER_TRANSPORTATION_PICKUP | context pushed: 0, narration: none |
| 7 | speech | BARRIER_TRANSPORTATION_PICKUP | ¿Por qué me preguntan esto? | ¿Por qué me preguntan esto? | Para saber dónde recogerle. Ya tenemos su dirección de casa registrada; solo hay que confirmarla. | 1808 | NOTICEABLE DELAY | 8110 |  | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 8 | tap | BARRIER_TRANSPORTATION_PICKUP | (taps Usar la dirección de casa) | | | | | | | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS | context pushed: 0, narration: none |
| 9 | speech | BARRIER_TRANSPORTATION_NEEDS | ¿Qué opciones tengo? | ¿Qué opciones tengo? | Encontré 5 opciones. La primera es No, ninguna y cuesta ?. ¿Quiere que le explique las demás? | 1777 | NOTICEABLE DELAY | 8925 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 10 | tap | BARRIER_TRANSPORTATION_NEEDS | (taps No, ninguna) | | | | | | | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_NEEDS | context pushed: 0, narration: none |
| 11 | tap | BARRIER_TRANSPORTATION_NEEDS | (taps Continuar) | | | | | | | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_TIME | context pushed: 0, narration: none |
| 12 | speech | BARRIER_TRANSPORTATION_TIME | ¿Y ahora? | ¿Y ahora? | Revise la hora de recogida sugerida y busque vehículos, o elija otra hora. | 1799 | NOTICEABLE DELAY | 7236 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 13 | tap | BARRIER_TRANSPORTATION_TIME | (taps Buscar vehículos) | | | | | | | BARRIER_TRANSPORTATION_TIME → BARRIER_TRANSPORTATION_SEARCHING | context pushed: 0, narration: none |
| 14 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 15 | speech | BARRIER_TRANSPORTATION_OPTIONS | ¿Qué opciones tengo? | ¿Qué opciones tengo? | Encontré 3 opciones. La primera es UberX y cuesta $27.95. ¿Quiere que le explique las demás? | 1774 | NOTICEABLE DELAY | 8512 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 16 | speech | BARRIER_TRANSPORTATION_OPTIONS | ¿Cuál es la más barata? | ¿Cuál es la más barata? | La más barata es UberX, $27.95. | 1854 | NOTICEABLE DELAY | 4348 | describeCurrentView→ | same view |  |
| 17 | speech | BARRIER_TRANSPORTATION_OPTIONS | Pon la primera. | Pon la primera. | Seleccioné UberX. Todavía falta confirmar la reserva. | 1878 | NOTICEABLE DELAY | 4800 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 18 | speech | BARRIER_TRANSPORTATION_REVIEW | ¿Ya está hecho? | ¿Ya está hecho? | Todavía no. El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión | 1804 | NOTICEABLE DELAY | 8982 | describeCurrentView→ | same view |  |
| 19 | speech | BARRIER_TRANSPORTATION_REVIEW | Mi hija me dijo que hiciera esto. ¿Ya terminé? | Mi hija me dijo que hiciera esto. ¿Ya terminé? | Revise el viaje. Solo se reserva cuando presione el botón de reservar. Falta: El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión. | 1839 | NOTICEABLE DELAY | 13761 | describeCurrentView→ | same view |  |
| 20 | speech | BARRIER_TRANSPORTATION_REVIEW | No entendí. | No entendí. | Le explico más sencillo: ya eligió el UberX. Falta un paso: confirmar la reserva. ¿Quiere que la confirme? | 1836 | NOTICEABLE DELAY | 9447 |  | same view |  |
| 21 | speech | BARRIER_TRANSPORTATION_REVIEW | Sí. | Sí. | Estoy reservando el viaje. Todavía no está confirmado. El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión | 2520 | POOR | 12268 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_BOOKING_FAILED | response start 2520 ms |
| 22 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 23 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | ¿Qué me dijiste? | ¿Qué me dijiste? | Hasta ahora: Dirección de recogida confirmada, Ayuda especial para el viaje respondida, Hora de recogida definida. | 1750 | NOTICEABLE DELAY | 8498 | describeCurrentView→ | same view |  |

## Summary

```json
{
  "spoken_turns": 13,
  "total_turns": 23,
  "response_start_p50_ms": 1807,
  "response_start_p95_ms": 2520,
  "response_start_avg_ms": 1864,
  "app_overhead_p50_ms": 6,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 2: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 4: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 7: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 9: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 12: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 15: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 21: response start 2520 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 1095 ms after tap
