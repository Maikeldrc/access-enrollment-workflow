# Voice session S03-interruptions-es

- patient_profile: E (interrumpe frecuentemente)
- language: es
- flow: transportation options with repeated barge-ins
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T00:06:43.595Z
- finished: 2026-09-04T00:10:55.388Z

EMMI is interrupted mid-sentence five times with short utterances. Measures stop latency and whether the new instruction is honoured.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | tap | APPOINTMENT_CONFIRMED | (taps Algo lo dificulta) | | | | | | | APPOINTMENT_CONFIRMED → APPOINTMENT_PRE_VISIT_CHECK | context pushed: 0, narration: none |
| 3 | tap | APPOINTMENT_PRE_VISIT_CHECK | (taps Transporte) | | | | | | | APPOINTMENT_PRE_VISIT_CHECK → BARRIER_TRANSPORTATION_OFFER | context pushed: 0, narration: none |
| 4 | tap | BARRIER_TRANSPORTATION_OFFER | (taps Sí, buscar transporte) | | | | | | | BARRIER_TRANSPORTATION_OFFER → BARRIER_TRANSPORTATION_PICKUP | context pushed: 0, narration: none |
| 5 | tap | BARRIER_TRANSPORTATION_PICKUP | (taps Casa) | | | | | | | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS | context pushed: 0, narration: none |
| 6 | tap | BARRIER_TRANSPORTATION_NEEDS | (taps No, ninguna) | | | | | | | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_NEEDS | context pushed: 0, narration: none |
| 7 | tap | BARRIER_TRANSPORTATION_NEEDS | (taps Continuar) | | | | | | | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_TIME | context pushed: 0, narration: none |
| 8 | tap | BARRIER_TRANSPORTATION_TIME | (taps Buscar vehículos) | | | | | | | BARRIER_TRANSPORTATION_TIME → BARRIER_TRANSPORTATION_SEARCHING | context pushed: 0, narration: none |
| 9 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 10 | speech | BARRIER_TRANSPORTATION_OPTIONS | Explícame todas las opciones. | Explícame todas las opciones. | Claro. Encontré tres opciones. La primera es UberX, un vehículo estándar por veintisiete dólares con noventa y cinco, que le recoge a las nueve cuarenta y cinco. La segunda es UberXL, con más espacio, por cuarenta y un dólares con sesenta y ocho, y le recoge a las nueve cuarenta. La tercera es Uber WAV, accesible en silla de ruedas, por treinta y tres dólares, y le recoge a las nueve treinta y cinco. Todas llegan antes de las diez y diez. | 1766 | NOTICEABLE DELAY |  |  | same view | turn did not finish within 30000 ms (state EMMI_SPEAKING) |
| 11 | speech (barge-in) | BARRIER_TRANSPORTATION_OPTIONS | Espera. | Espera. | Claro, dígame. | 1833 | NOTICEABLE DELAY | 2672 |  | same view |  |
| 12 | speech | BARRIER_TRANSPORTATION_OPTIONS | No, quiero otra cosa. ¿Cuál tiene más espacio? | No, quiero otra cosa. ¿Cuál tiene más espacio? | UberXL tiene más espacio. | 1790 | NOTICEABLE DELAY | 3454 | describeCurrentView→ | same view |  |
| 13 | speech | BARRIER_TRANSPORTATION_OPTIONS | Explícame las tres otra vez, despacio. | Explícame las tres otra vez, despacio. | Con gusto. La primera es UberX, vehículo estándar, veintisiete noventa y cinco, recoge a las nueve cuarenta y cinco. La segunda es UberXL, con más espacio, cuarenta y uno sesenta y ocho, recoge a las nueve cuarenta. La tercera es Uber WAV, accesible, treinta y tres dólares, recoge a las nueve treinta y cinco. | 1813 | NOTICEABLE DELAY | 24707 |  | same view |  |
| 14 | speech (barge-in) | BARRIER_TRANSPORTATION_OPTIONS | Sí, ya entendí. La segunda. | Sí, ya entendí. La segunda. | Seleccioné UberXL. Todavía falta confirmar la reserva. | 1954 | NOTICEABLE DELAY | 4868 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW | the app did not register the interruption while EMMI was speaking |
| 15 | speech | BARRIER_TRANSPORTATION_REVIEW | ¿Y me la puedes reservar ahora mismo o tengo que hacer algo más? | ¿Y me la puedes reservar ahora mismo o tengo que hacer algo más? | Puedo reservarla ahora. Antes de hacerlo: le recogería a las nueve cuarenta en su casa, y el costo estimado es cuarenta y un dólares con sesenta y ocho. ¿Confirma? | 1837 | NOTICEABLE DELAY | 14100 |  | same view |  |
| 16 | speech (barge-in) | BARRIER_TRANSPORTATION_REVIEW | Para. | Para. | De acuerdo, me detengo. | 1803 | NOTICEABLE DELAY | 3465 |  | same view | the app did not register the interruption while EMMI was speaking |
| 17 | speech | BARRIER_TRANSPORTATION_REVIEW | Me equivoqué. Quiero volver a las opciones. | Me equivoqué. Quiero volver a las opciones. | Aquí puede continuar. | 1785 | NOTICEABLE DELAY | 3036 | performViewAction→UNKNOWN_ACTION | same view |  |
| 18 | speech | BARRIER_TRANSPORTATION_REVIEW | Mejor la primera. | Mejor la primera. | Seleccioné la opción. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 3457 | POOR | 12321 | performViewAction→ | same view | response start 3457 ms |
| 19 | speech | BARRIER_TRANSPORTATION_REVIEW | Ok, resérvala. | Ok, resérvala. | Antes de reservar: UberX, le recoge a las nueve cuarenta y cinco, veintisiete noventa y cinco. ¿Confirma? | 1763 | NOTICEABLE DELAY | 8900 |  | same view |  |
| 20 | speech (barge-in) | BARRIER_TRANSPORTATION_REVIEW | Sí. | Sí. | Estoy reservando el viaje. Todavía no está confirmado. El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión | 1801 | NOTICEABLE DELAY | 11509 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_RETURN_OFFER | the app did not register the interruption while EMMI was speaking |
| 21 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 22 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | ¿Ya quedó? | ¿Ya quedó? | Sí, el viaje ya quedó reservado. | 1869 | NOTICEABLE DELAY | 4364 | describeCurrentView→ | same view |  |

## Summary

```json
{
  "spoken_turns": 12,
  "total_turns": 22,
  "response_start_p50_ms": 1803,
  "response_start_p95_ms": 3457,
  "response_start_avg_ms": 1956,
  "app_overhead_p50_ms": 4,
  "barge_ins": 4,
  "barge_in_stop_p50_ms": 285,
  "barge_in_stop_max_ms": 285,
  "spoken_turns_with_context_before_answer": 1,
  "problems": [
    "turn 10: turn did not finish within 30000 ms (state EMMI_SPEAKING)",
    "turn 14: the app did not register the interruption while EMMI was speaking",
    "turn 16: the app did not register the interruption while EMMI was speaking",
    "turn 18: response start 3457 ms",
    "turn 20: the app did not register the interruption while EMMI was speaking"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 875 ms after tap
