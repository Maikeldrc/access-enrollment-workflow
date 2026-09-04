# Voice session S21-long-elderly-video-visit-es

- patient_profile: A (adulto mayor, responde muy poco)
- language: es
- flow: long: video-visit device check with one-word answers, long silences, '¿eh?', 'más despacio', an unrecognisable utterance, and a recheck
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T20:30:53.964Z
- finished: 2026-09-04T20:34:24.884Z

16 spoken turns, most of them one or two words, with 5–8 s silences between them. Also the no-transcript recovery in the middle of a task.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Hola. | Hola. | Hola. Estoy aquí para ayudarle con su visita por video. ¿Qué necesita? | 1776 | NOTICEABLE DELAY | 6808 |  | same view |  |
| 3 | silence | | (silent 6000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 4 | speech | APPOINTMENT_CONFIRMED | ¿Eh? | ¿Eh? | Decía que puedo ayudarle con su visita por video. ¿Quiere que revisemos su teléfono? | 1839 | NOTICEABLE DELAY | 7758 |  | same view |  |
| 5 | speech | APPOINTMENT_CONFIRMED | ¿Con quién es? | ¿Con quién es? | Con Dr. Fresner Lee. | 1798 | NOTICEABLE DELAY | 3463 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 6 | speech | APPOINTMENT_CONFIRMED | ¿Cuándo? | ¿Cuándo? | El lunes, 7 de septiembre. | 1762 | NOTICEABLE DELAY | 3846 | describeCurrentView→ | same view |  |
| 7 | speech | APPOINTMENT_CONFIRMED | La visita… por video… no sé. | La visita… por video… no sé. | Estoy revisando el micrófono, la cámara, la conexión y el enlace. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 9824 | VERY POOR | 15783 | performViewAction→; performViewAction→; performViewAction→ | same view | response start 9824 ms |
| 8 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 9 | speech | APPOINTMENT_CONFIRMED | ¿Qué? | ¿Qué? | No falta nada; todo está listo. | 1735 | NOTICEABLE DELAY | 4229 | describeCurrentView→ | same view |  |
| 10 | speech | APPOINTMENT_CONFIRMED | Más despacio. | Más despacio. | No falta nada. | 1776 | NOTICEABLE DELAY | 3024 | describeCurrentView→ | same view |  |
| 11 | speech | APPOINTMENT_CONFIRMED | ¿Qué hago? | ¿Qué hago? | Aquí puede continuar. | 1801 | NOTICEABLE DELAY | 3048 | performViewAction→UNKNOWN_ACTION | same view |  |
| 12 | silence | | (silent 5000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 13 | speech | APPOINTMENT_CONFIRMED | Sí. | Sí. | Bien. Cuando termine, dígame 'ya' y reviso de nuevo. | 1828 | NOTICEABLE DELAY | 5621 |  | same view |  |
| 14 | silence | | (silent 5000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 15 | speech | APPOINTMENT_CONFIRMED | (inaudible) | (inaudible) | (empty generation) |  | N/A |  |  | same view | no audible response was produced for this turn; turn did not finish within 20000 ms (state USER_SPEAKING) |
| 16 | speech | APPOINTMENT_CONFIRMED | Ya. | Ya. | Revisando de nuevo. | 1807 | NOTICEABLE DELAY | 3066 | performViewAction→UNKNOWN_ACTION | same view | EMMI was not idle before the patient spoke (state USER_SPEAKING) |
| 17 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 18 | speech | APPOINTMENT_CONFIRMED | ¿Sirve? | ¿Sirve? | Sí, todo funcionó. Está lista para la visita. | 1779 | NOTICEABLE DELAY | 5144 | describeCurrentView→ | same view |  |
| 19 | speech | APPOINTMENT_CONFIRMED | Repita. | Repita. | Todo funcionó. | 1810 | NOTICEABLE DELAY | 2643 | describeCurrentView→ | same view |  |
| 20 | speech | APPOINTMENT_CONFIRMED | Gracias. | Gracias. | De nada. | 1827 | NOTICEABLE DELAY | 2663 |  | same view |  |
| 21 | speech | APPOINTMENT_CONFIRMED | Adiós. | Adiós. | Hasta luego. Aquí estaré. | 1802 | NOTICEABLE DELAY | 3470 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 15,
  "total_turns": 21,
  "response_start_p50_ms": 1801,
  "response_start_p95_ms": 9824,
  "response_start_avg_ms": 2369,
  "app_overhead_p50_ms": 3,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 1,
  "problems": [
    "turn 5: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 7: response start 9824 ms",
    "turn 15: no audible response was produced for this turn",
    "turn 15: turn did not finish within 20000 ms (state USER_SPEAKING)",
    "turn 16: EMMI was not idle before the patient spoke (state USER_SPEAKING)"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 589 ms after tap
- provider set to return no transcript for the next turn
