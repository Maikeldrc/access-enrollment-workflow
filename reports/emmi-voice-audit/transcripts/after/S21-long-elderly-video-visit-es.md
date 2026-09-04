# Voice session S21-long-elderly-video-visit-es

- patient_profile: A (adulto mayor, responde muy poco)
- language: es
- flow: long: video-visit device check with one-word answers, long silences, '¿eh?', 'más despacio', an unrecognisable utterance, and a recheck
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T04:51:13.268Z
- finished: 2026-09-04T04:54:15.548Z

16 spoken turns, most of them one or two words, with 5–8 s silences between them. Also the no-transcript recovery in the middle of a task.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Hola. | Hola. | Hola. Estoy aquí para ayudarle con su visita por video. ¿Qué necesita? | 1814 | NOTICEABLE DELAY | 6817 |  | same view |  |
| 3 | silence | | (silent 6000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 4 | speech | APPOINTMENT_CONFIRMED | ¿Eh? | ¿Eh? | Decía que puedo ayudarle con su visita por video. ¿Quiere que revisemos su teléfono? | 1802 | NOTICEABLE DELAY | 7631 |  | same view |  |
| 5 | speech | APPOINTMENT_CONFIRMED | ¿Con quién es? | ¿Con quién es? | Con Dr. Fresner Lee. | 1824 | NOTICEABLE DELAY | 3491 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 6 | speech | APPOINTMENT_CONFIRMED | ¿Cuándo? | ¿Cuándo? | El lunes, 7 de septiembre. | 1789 | NOTICEABLE DELAY | 3874 | describeCurrentView→ | same view |  |
| 7 | speech | APPOINTMENT_CONFIRMED | La visita… por video… no sé. | La visita… por video… no sé. | Estoy revisando el micrófono, la cámara, la conexión y el enlace. | 2608 | POOR | 7189 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_VIDEO_VISIT_ISSUES | response start 2608 ms |
| 8 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 9 | speech | BARRIER_VIDEO_VISIT_ISSUES | ¿Qué? | ¿Qué? | Falta: Cámara: No pude detectar su cámara.. | 1729 | NOTICEABLE DELAY | 4650 | describeCurrentView→ | same view |  |
| 10 | speech | BARRIER_VIDEO_VISIT_ISSUES | Más despacio. | Más despacio. | Despacio: falta Cámara: No pude detectar su cámara.. | 1835 | NOTICEABLE DELAY | 5168 | describeCurrentView→ | same view |  |
| 11 | speech | BARRIER_VIDEO_VISIT_ISSUES | ¿Qué hago? | ¿Qué hago? | Siga los pasos y vuelva a revisar. Falta: Cámara: No pude detectar su cámara.. | 1828 | NOTICEABLE DELAY | 7664 | performViewAction→PERFORMED | BARRIER_VIDEO_VISIT_ISSUES → BARRIER_VIDEO_VISIT_GUIDE |  |
| 12 | silence | | (silent 5000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 13 | speech | BARRIER_VIDEO_VISIT_GUIDE | Sí. | Sí. | Bien. Cuando termine, dígame 'ya' y reviso de nuevo. | 1829 | NOTICEABLE DELAY | 5583 |  | same view |  |
| 14 | silence | | (silent 5000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 15 | speech | BARRIER_VIDEO_VISIT_GUIDE | (inaudible) | (inaudible) | (empty generation) | 6323 | VERY POOR | 10080 |  | same view | response start 6323 ms |
| 16 | speech | BARRIER_VIDEO_VISIT_GUIDE | Ya. | Ya. | Revisando de nuevo. | 2595 | POOR | 3844 | performViewAction→PERFORMED | BARRIER_VIDEO_VISIT_GUIDE → BARRIER_VIDEO_VISIT_ISSUES | response start 2595 ms |
| 17 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 18 | speech | BARRIER_VIDEO_VISIT_ISSUES | ¿Sirve? | ¿Sirve? | Todavía falta: Cámara: No pude detectar su cámara.. | 1754 | NOTICEABLE DELAY | 5081 | describeCurrentView→ | same view |  |
| 19 | speech | BARRIER_VIDEO_VISIT_ISSUES | Repita. | Repita. | Falta Cámara: No pude detectar su cámara.. | 1849 | NOTICEABLE DELAY | 4764 | describeCurrentView→ | same view |  |
| 20 | speech | BARRIER_VIDEO_VISIT_ISSUES | Gracias. | Gracias. | De nada. | 1787 | NOTICEABLE DELAY | 2611 |  | same view |  |
| 21 | speech | BARRIER_VIDEO_VISIT_ISSUES | Adiós. | Adiós. | Hasta luego. Aquí estaré. | 1839 | NOTICEABLE DELAY | 3499 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 15,
  "total_turns": 21,
  "response_start_p50_ms": 1828,
  "response_start_p95_ms": 6323,
  "response_start_avg_ms": 2214,
  "app_overhead_p50_ms": 3,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 5: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 7: response start 2608 ms",
    "turn 15: response start 6323 ms",
    "turn 16: response start 2595 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 917 ms after tap
- provider set to return no transcript for the next turn
