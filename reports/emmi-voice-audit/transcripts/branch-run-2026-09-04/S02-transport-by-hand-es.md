# Voice session S02-transport-by-hand-es

- patient_profile: C (se confunde fácilmente)
- language: es
- flow: transportation navigated by the patient's own taps while voice stays on
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T19:34:50.403Z
- finished: 2026-09-04T19:38:06.460Z

The patient taps through the screens and asks a contextual question on each one. Tests whether the provider is told about each screen before a spoken question is answered.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | No sé qué tengo que hacer. | No sé qué tengo que hacer. | Esta visita está confirmada. Desde aquí puede prepararse, pedir ayuda para llegar, cambiarla o cancelarla. | 1829 | NOTICEABLE DELAY | 8178 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 3 | tap | APPOINTMENT_CONFIRMED | (taps Algo lo dificulta) | | | | | | | APPOINTMENT_CONFIRMED → APPOINTMENT_PRE_VISIT_CHECK | context pushed: 0, narration: none |
| 4 | speech | APPOINTMENT_PRE_VISIT_CHECK | ¿Qué hago aquí? | ¿Qué hago aquí? | Elija lo que pueda dificultar llegar a esta visita y trataré de resolverlo con usted. | 1842 | NOTICEABLE DELAY | 8183 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 5 | tap | APPOINTMENT_PRE_VISIT_CHECK | (taps Transporte) | | | | | | | APPOINTMENT_PRE_VISIT_CHECK → BARRIER_TRANSPORTATION_OFFER | context pushed: 0, narration: none |
| 6 | tap | BARRIER_TRANSPORTATION_OFFER | (taps Sí, buscar transporte) | | | | | | | BARRIER_TRANSPORTATION_OFFER → BARRIER_TRANSPORTATION_PICKUP | context pushed: 0, narration: none |
| 7 | speech | BARRIER_TRANSPORTATION_PICKUP | ¿Por qué me preguntan esto? | ¿Por qué me preguntan esto? | Para saber dónde recogerle. Ya tenemos su dirección de casa registrada; solo hay que confirmarla. | 1762 | NOTICEABLE DELAY | 8107 |  | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 8 | tap | BARRIER_TRANSPORTATION_PICKUP | (taps Usar la dirección de casa) | | | | | | | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS | context pushed: 0, narration: none |
| 9 | speech | BARRIER_TRANSPORTATION_NEEDS | ¿Qué opciones tengo? | ¿Qué opciones tengo? | Encontré 5 opciones. La primera es No, ninguna y cuesta ?. ¿Quiere que le explique las demás? | 1796 | NOTICEABLE DELAY | 8995 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 10 | tap | BARRIER_TRANSPORTATION_NEEDS | (taps No, ninguna) | | | | | | | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_NEEDS | context pushed: 0, narration: none |
| 11 | tap | BARRIER_TRANSPORTATION_NEEDS | (taps Continuar) | | | | | | | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_TIME | context pushed: 0, narration: none |
| 12 | speech | BARRIER_TRANSPORTATION_TIME | ¿Y ahora? | ¿Y ahora? | Revise la hora de recogida sugerida y busque vehículos, o elija otra hora. | 1844 | NOTICEABLE DELAY | 7348 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 13 | tap | BARRIER_TRANSPORTATION_TIME | (taps Buscar vehículos) | | | | | | | BARRIER_TRANSPORTATION_TIME → BARRIER_TRANSPORTATION_SEARCHING | context pushed: 0, narration: none |
| 14 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 15 | speech | BARRIER_TRANSPORTATION_OPTIONS | ¿Qué opciones tengo? | ¿Qué opciones tengo? | Encontré 3 opciones. La primera es UberX y cuesta $27.95. ¿Quiere que le explique las demás? | 1756 | NOTICEABLE DELAY | 8562 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 16 | speech | BARRIER_TRANSPORTATION_OPTIONS | ¿Cuál es la más barata? | ¿Cuál es la más barata? | La más barata es UberX, $27.95. | 1856 | NOTICEABLE DELAY | 4363 | describeCurrentView→ | same view |  |
| 17 | speech | BARRIER_TRANSPORTATION_OPTIONS | Pon la primera. | Pon la primera. | Seleccioné la opción. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 7070 | VERY POOR | 12369 | performViewAction→ | same view | response start 7070 ms; expected view REVIEW, got BARRIER_TRANSPORTATION_OPTIONS |
| 18 | speech | BARRIER_TRANSPORTATION_OPTIONS | ¿Ya está hecho? | ¿Ya está hecho? | Todavía no. Elija uno de los vehículos. Elegirlo no lo reserva: primero lo revisa. | 1846 | NOTICEABLE DELAY | 7783 | describeCurrentView→ | same view |  |
| 19 | speech | BARRIER_TRANSPORTATION_OPTIONS | Mi hija me dijo que hiciera esto. ¿Ya terminé? | Mi hija me dijo que hiciera esto. ¿Ya terminé? | Elija uno de los vehículos. Elegirlo no lo reserva: primero lo revisa. | 1831 | NOTICEABLE DELAY | 6886 | describeCurrentView→ | same view |  |
| 20 | speech | BARRIER_TRANSPORTATION_OPTIONS | No entendí. | No entendí. | Le explico más sencillo: ya eligió el UberX. Falta un paso: confirmar la reserva. ¿Quiere que la confirme? | 1829 | NOTICEABLE DELAY | 9457 |  | same view |  |
| 21 | speech | BARRIER_TRANSPORTATION_OPTIONS | Sí. | Sí. | Estoy reservando el viaje. Todavía no está confirmado.  | 1761 | NOTICEABLE DELAY | 5082 | performViewAction→UNKNOWN_ACTION | same view |  |
| 22 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 23 | speech | BARRIER_TRANSPORTATION_OPTIONS | ¿Qué me dijiste? | ¿Qué me dijiste? | Hasta ahora: Dirección de recogida confirmada, Ayuda especial para el viaje respondida, Hora de recogida definida. | 1750 | NOTICEABLE DELAY | 8520 | describeCurrentView→ | same view |  |

## Summary

```json
{
  "spoken_turns": 13,
  "total_turns": 23,
  "response_start_p50_ms": 1829,
  "response_start_p95_ms": 7070,
  "response_start_avg_ms": 2213,
  "app_overhead_p50_ms": 3,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 1,
  "problems": [
    "turn 2: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 4: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 7: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 9: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 12: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 15: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 17: response start 7070 ms",
    "turn 17: expected view REVIEW, got BARRIER_TRANSPORTATION_OPTIONS"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 796 ms after tap
