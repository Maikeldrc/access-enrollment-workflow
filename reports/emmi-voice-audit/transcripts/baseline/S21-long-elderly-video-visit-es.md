# Voice session S21-long-elderly-video-visit-es

- patient_profile: A (adulto mayor, responde muy poco)
- language: es
- flow: long: video-visit device check with one-word answers, long silences, '¿eh?', 'más despacio', an unrecognisable utterance, and a recheck
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:12:08.386Z
- finished: 2026-09-04T01:15:39.793Z

16 spoken turns, most of them one or two words, with 5–8 s silences between them. Also the no-transcript recovery in the middle of a task.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Hola. | Hola. | Hola. Estoy aquí para ayudarle con su visita por video. ¿Qué necesita? | 1807 | NOTICEABLE DELAY | 6805 |  | same view |  |
| 3 | silence | | (silent 6000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 4 | speech | APPOINTMENT_CONFIRMED | ¿Eh? | ¿Eh? | Decía que puedo ayudarle con su visita por video. ¿Quiere que revisemos su teléfono? | 1824 | NOTICEABLE DELAY | 7672 |  | same view |  |
| 5 | speech | APPOINTMENT_CONFIRMED | ¿Con quién es? | ¿Con quién es? | Con Dr. Fresner Lee. | 1791 | NOTICEABLE DELAY | 3464 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 6 | speech | APPOINTMENT_CONFIRMED | ¿Cuándo? | ¿Cuándo? | El lunes, 7 de septiembre. | 1774 | NOTICEABLE DELAY | 3875 | describeCurrentView→ | same view |  |
| 7 | speech | APPOINTMENT_CONFIRMED | La visita… por video… no sé. | La visita… por video… no sé. | Estoy revisando el micrófono, la cámara, la conexión y el enlace. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 6841 | VERY POOR | 15680 | performViewAction→; performViewAction→; performViewAction→ | same view | response start 6841 ms |
| 8 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 9 | speech | APPOINTMENT_CONFIRMED | ¿Qué? | ¿Qué? | No falta nada; todo está listo. | 1769 | NOTICEABLE DELAY | 4268 | describeCurrentView→ | same view |  |
| 10 | speech | APPOINTMENT_CONFIRMED | Más despacio. | Más despacio. | No falta nada. | 1784 | NOTICEABLE DELAY | 3036 | describeCurrentView→ | same view |  |
| 11 | speech | APPOINTMENT_CONFIRMED | ¿Qué hago? | ¿Qué hago? | Aquí puede continuar. | 1822 | NOTICEABLE DELAY | 3076 | performViewAction→UNKNOWN_ACTION | same view |  |
| 12 | silence | | (silent 5000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 13 | speech | APPOINTMENT_CONFIRMED | Sí. | Sí. | Bien. Cuando termine, dígame 'ya' y reviso de nuevo. | 1803 | NOTICEABLE DELAY | 5592 |  | same view |  |
| 14 | silence | | (silent 5000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 15 | speech | APPOINTMENT_CONFIRMED | (inaudible) | (inaudible) | (empty generation) |  | N/A |  |  | same view | no audible response was produced for this turn; turn did not finish within 20000 ms (state USER_SPEAKING) |
| 16 | speech | APPOINTMENT_CONFIRMED | Ya. | Ya. | Revisando de nuevo. | 1837 | NOTICEABLE DELAY | 3092 | performViewAction→UNKNOWN_ACTION | same view | EMMI was not idle before the patient spoke (state USER_SPEAKING) |
| 17 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 18 | speech | APPOINTMENT_CONFIRMED | ¿Sirve? | ¿Sirve? | Sí, todo funcionó. Está lista para la visita. | 1817 | NOTICEABLE DELAY | 5144 | describeCurrentView→ | same view |  |
| 19 | speech | APPOINTMENT_CONFIRMED | Repita. | Repita. | Todo funcionó. | 1829 | NOTICEABLE DELAY | 2669 | describeCurrentView→ | same view |  |
| 20 | speech | APPOINTMENT_CONFIRMED | Gracias. | Gracias. | De nada. | 1834 | NOTICEABLE DELAY | 2673 |  | same view |  |
| 21 | speech | APPOINTMENT_CONFIRMED | Adiós. | Adiós. | Hasta luego. Aquí estaré. | 1807 | NOTICEABLE DELAY | 3478 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 15,
  "total_turns": 21,
  "response_start_p50_ms": 1807,
  "response_start_p95_ms": 6841,
  "response_start_avg_ms": 2167,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 1,
  "problems": [
    "turn 5: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 7: response start 6841 ms",
    "turn 15: no audible response was produced for this turn",
    "turn 15: turn did not finish within 20000 ms (state USER_SPEAKING)",
    "turn 16: EMMI was not idle before the patient spoke (state USER_SPEAKING)"
  ]
}
```

## Observations

- voice start: state EMMI_THINKING, socket true, error "", 568 ms after tap
- provider set to return no transcript for the next turn
