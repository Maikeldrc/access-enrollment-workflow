# Voice session S03-interruptions-es

- patient_profile: E (interrumpe frecuentemente)
- language: es
- flow: transportation options with repeated barge-ins
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T21:08:44.913Z
- finished: 2026-09-04T21:10:49.634Z

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
| 10 | speech | BARRIER_TRANSPORTATION_OPTIONS | Explícame todas las opciones. | Explícame todas las opciones. | Claro. Encontré tres opciones. La primera es UberX, un vehículo estándar por veintisiete dólares con noventa y cinco, que le recoge a las nueve cuarenta y cinco. La segunda es UberXL, con más espacio, por cuarenta y un dólares con sesenta y ocho, y le recoge a las nueve cuarenta. La tercera es Uber WAV, accesible en silla de ruedas, por treinta y tres dólares, y le recoge a las nueve treinta y cinco. Todas llegan antes de las diez y diez. | 1756 | NOTICEABLE DELAY |  |  | same view |  |
| 11 | speech (barge-in) | BARRIER_TRANSPORTATION_OPTIONS | Espera. | Espera. | Claro, dígame. | 1808 | NOTICEABLE DELAY | 2642 |  | same view |  |
| 12 | speech | BARRIER_TRANSPORTATION_OPTIONS | No, quiero otra cosa. ¿Cuál tiene más espacio? | No, quiero otra cosa. ¿Cuál tiene más espacio? | UberXL tiene más espacio. | 1832 | NOTICEABLE DELAY | 3498 | describeCurrentView→ | same view |  |
| 13 | speech | BARRIER_TRANSPORTATION_OPTIONS | Explícame las tres otra vez, despacio. | Explícame las tres otra vez, despacio. | Con gusto. La primera es UberX, vehículo estándar, veintisiete noventa y cinco, recoge a las nueve cuarenta y cinco. La segunda es UberXL, con más espacio, cuarenta y uno sesenta y ocho, recoge a las nueve cuarenta. La tercera es Uber WAV, accesible, treinta y tres dólares, recoge a las nueve treinta y cinco. | 1810 | NOTICEABLE DELAY |  |  | same view |  |
| 14 | speech (barge-in) | BARRIER_TRANSPORTATION_OPTIONS | Sí, ya entendí. La segunda. | Sí, ya entendí. La segunda. | Seleccioné UberXL. Todavía falta confirmar la reserva. | 1827 | NOTICEABLE DELAY | 4746 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 15 | speech | BARRIER_TRANSPORTATION_REVIEW | ¿Y me la puedes reservar ahora mismo o tengo que hacer algo más? | ¿Y me la puedes reservar ahora mismo o tengo que hacer algo más? | Puedo reservarla ahora. Antes de hacerlo: le recogería a las nueve cuarenta en su casa, y el costo estimado es cuarenta y un dólares con sesenta y ocho. ¿Confirma? | 1814 | NOTICEABLE DELAY |  |  | same view |  |
| 16 | speech (barge-in) | BARRIER_TRANSPORTATION_REVIEW | Para. | Para. | De acuerdo, me detengo. | 1834 | NOTICEABLE DELAY | 3500 |  | same view |  |
| 17 | speech | BARRIER_TRANSPORTATION_REVIEW | Me equivoqué. Quiero volver a las opciones. | Me equivoqué. Quiero volver a las opciones. | Elija uno de los vehículos. Elegirlo no lo reserva: primero lo revisa. Falta: El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión. | 1826 | NOTICEABLE DELAY | 13817 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_OPTIONS |  |
| 18 | speech | BARRIER_TRANSPORTATION_OPTIONS | Mejor la primera. | Mejor la primera. | Seleccioné UberX. Todavía falta confirmar la reserva. | 1841 | NOTICEABLE DELAY | 4753 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 19 | speech | BARRIER_TRANSPORTATION_REVIEW | Ok, resérvala. | Ok, resérvala. | Antes de reservar: UberX, le recoge a las nueve cuarenta y cinco, veintisiete noventa y cinco. ¿Confirma? | 1730 | NOTICEABLE DELAY |  |  | same view |  |
| 20 | speech (barge-in) | BARRIER_TRANSPORTATION_REVIEW | Sí. | Sí. | Listo. El viaje quedó reservado. | 2550 | POOR | 4634 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_RETURN_OFFER | response start 2550 ms |
| 21 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 22 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | ¿Ya quedó? | ¿Ya quedó? | Sí, el viaje ya quedó reservado. | 1800 | NOTICEABLE DELAY | 4292 | describeCurrentView→ | same view |  |

## Summary

```json
{
  "spoken_turns": 12,
  "total_turns": 22,
  "response_start_p50_ms": 1814,
  "response_start_p95_ms": 2550,
  "response_start_avg_ms": 1869,
  "app_overhead_p50_ms": 3,
  "barge_ins": 4,
  "barge_in_stop_p50_ms": 160,
  "barge_in_stop_max_ms": 174,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 20: response start 2550 ms"
  ]
}
```

## Observations

- voice start: state EMMI_THINKING, socket true, error "", 674 ms after tap
