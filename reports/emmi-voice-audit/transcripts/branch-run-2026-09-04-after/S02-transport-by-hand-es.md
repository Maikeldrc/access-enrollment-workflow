# Voice session S02-transport-by-hand-es

- patient_profile: C (se confunde fácilmente)
- language: es
- flow: transportation navigated by the patient's own taps while voice stays on
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T21:05:40.566Z
- finished: 2026-09-04T21:08:43.999Z

The patient taps through the screens and asks a contextual question on each one. Tests whether the provider is told about each screen before a spoken question is answered.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | No sé qué tengo que hacer. | No sé qué tengo que hacer. | Esta visita está confirmada. Desde aquí puede prepararse, pedir ayuda para llegar, cambiarla o cancelarla. | 1817 | NOTICEABLE DELAY | 8156 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 3 | tap | APPOINTMENT_CONFIRMED | (taps Algo lo dificulta) | | | | | | | APPOINTMENT_CONFIRMED → APPOINTMENT_PRE_VISIT_CHECK | context pushed: 0, narration: none |
| 4 | speech | APPOINTMENT_PRE_VISIT_CHECK | ¿Qué hago aquí? | ¿Qué hago aquí? | Elija lo que pueda dificultar llegar a esta visita y trataré de resolverlo con usted. | 1839 | NOTICEABLE DELAY | 8167 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 5 | tap | APPOINTMENT_PRE_VISIT_CHECK | (taps Transporte) | | | | | | | APPOINTMENT_PRE_VISIT_CHECK → BARRIER_TRANSPORTATION_OFFER | context pushed: 0, narration: none |
| 6 | tap | BARRIER_TRANSPORTATION_OFFER | (taps Sí, buscar transporte) | | | | | | | BARRIER_TRANSPORTATION_OFFER → BARRIER_TRANSPORTATION_PICKUP | context pushed: 0, narration: none |
| 7 | speech | BARRIER_TRANSPORTATION_PICKUP | ¿Por qué me preguntan esto? | ¿Por qué me preguntan esto? | Para saber dónde recogerle. Ya tenemos su dirección de casa registrada; solo hay que confirmarla. | 1792 | NOTICEABLE DELAY | 8160 |  | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 8 | tap | BARRIER_TRANSPORTATION_PICKUP | (taps Usar la dirección de casa) | | | | | | | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS | context pushed: 0, narration: none |
| 9 | speech | BARRIER_TRANSPORTATION_NEEDS | ¿Qué opciones tengo? | ¿Qué opciones tengo? | Encontré 5 opciones. La primera es No, ninguna y cuesta ?. ¿Quiere que le explique las demás? | 1827 | NOTICEABLE DELAY | 9033 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 10 | tap | BARRIER_TRANSPORTATION_NEEDS | (taps No, ninguna) | | | | | | | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_NEEDS | context pushed: 0, narration: none |
| 11 | tap | BARRIER_TRANSPORTATION_NEEDS | (taps Continuar) | | | | | | | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_TIME | context pushed: 0, narration: none |
| 12 | speech | BARRIER_TRANSPORTATION_TIME | ¿Y ahora? | ¿Y ahora? | Revise la hora de recogida sugerida y busque vehículos, o elija otra hora. | 1839 | NOTICEABLE DELAY | 7333 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 13 | tap | BARRIER_TRANSPORTATION_TIME | (taps Buscar vehículos) | | | | | | | BARRIER_TRANSPORTATION_TIME → BARRIER_TRANSPORTATION_SEARCHING | context pushed: 0, narration: none |
| 14 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 15 | speech | BARRIER_TRANSPORTATION_OPTIONS | ¿Qué opciones tengo? | ¿Qué opciones tengo? | Encontré 3 opciones. La primera es UberX y cuesta $27.95. ¿Quiere que le explique las demás? | 1766 | NOTICEABLE DELAY | 8577 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 16 | speech | BARRIER_TRANSPORTATION_OPTIONS | ¿Cuál es la más barata? | ¿Cuál es la más barata? | La más barata es UberX, $27.95. | 1811 | NOTICEABLE DELAY | 4308 | describeCurrentView→ | same view |  |
| 17 | speech | BARRIER_TRANSPORTATION_OPTIONS | Pon la primera. | Pon la primera. | Seleccioné UberX. Todavía falta confirmar la reserva. | 1842 | NOTICEABLE DELAY | 4755 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 18 | speech | BARRIER_TRANSPORTATION_REVIEW | ¿Ya está hecho? | ¿Ya está hecho? | Todavía no. El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión | 1807 | NOTICEABLE DELAY | 9047 | describeCurrentView→ | same view |  |
| 19 | speech | BARRIER_TRANSPORTATION_REVIEW | Mi hija me dijo que hiciera esto. ¿Ya terminé? | Mi hija me dijo que hiciera esto. ¿Ya terminé? | Revise el viaje. Solo se reserva cuando presione el botón de reservar. Falta: El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión. | 1832 | NOTICEABLE DELAY | 13772 | describeCurrentView→ | same view |  |
| 20 | speech | BARRIER_TRANSPORTATION_REVIEW | No entendí. | No entendí. | Le explico más sencillo: ya eligió el UberX. Falta un paso: confirmar la reserva. ¿Quiere que la confirme? | 1795 | NOTICEABLE DELAY | 9510 |  | same view |  |
| 21 | speech | BARRIER_TRANSPORTATION_REVIEW | Sí. | Sí. | Listo. El viaje quedó reservado. | 2468 | NOTICEABLE DELAY | 4552 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_RETURN_OFFER |  |
| 22 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 23 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | ¿Qué me dijiste? | ¿Qué me dijiste? | Hasta ahora: Dirección de recogida confirmada, Ayuda especial para el viaje respondida, Hora de recogida definida, Viaje reservado. | 1729 | NOTICEABLE DELAY | 9388 | describeCurrentView→ | same view |  |

## Summary

```json
{
  "spoken_turns": 13,
  "total_turns": 23,
  "response_start_p50_ms": 1817,
  "response_start_p95_ms": 2468,
  "response_start_avg_ms": 1859,
  "app_overhead_p50_ms": 4,
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
    "turn 15: the app sent no screen context to the provider before it answered this spoken turn"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 921 ms after tap
