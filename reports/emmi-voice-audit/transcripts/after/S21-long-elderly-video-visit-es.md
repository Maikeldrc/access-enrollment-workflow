# Voice session S21-long-elderly-video-visit-es

- patient_profile: A (adulto mayor, responde muy poco)
- language: es
- flow: long: video-visit device check with one-word answers, long silences, '¿eh?', 'más despacio', an unrecognisable utterance, and a recheck
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:26:28.954Z
- finished: 2026-09-04T01:29:59.711Z

16 spoken turns, most of them one or two words, with 5–8 s silences between them. Also the no-transcript recovery in the middle of a task.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Hola. | Hola. | Hola. Estoy aquí para ayudarle con su visita por video. ¿Qué necesita? | 1785 | NOTICEABLE DELAY | 6790 |  | same view |  |
| 3 | silence | | (silent 6000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 4 | speech | APPOINTMENT_CONFIRMED | ¿Eh? | ¿Eh? | Decía que puedo ayudarle con su visita por video. ¿Quiere que revisemos su teléfono? | 1797 | NOTICEABLE DELAY | 7624 |  | same view |  |
| 5 | speech | APPOINTMENT_CONFIRMED | ¿Con quién es? | ¿Con quién es? | Con Dr. Fresner Lee. | 1799 | NOTICEABLE DELAY | 3461 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 6 | speech | APPOINTMENT_CONFIRMED | ¿Cuándo? | ¿Cuándo? | El lunes, 7 de septiembre. | 1824 | NOTICEABLE DELAY | 3905 | describeCurrentView→ | same view |  |
| 7 | speech | APPOINTMENT_CONFIRMED | La visita… por video… no sé. | La visita… por video… no sé. | Estoy revisando el micrófono, la cámara, la conexión y el enlace. | 2655 | POOR | 7235 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_VIDEO_VISIT_ISSUES | response start 2655 ms |
| 8 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 9 | speech | BARRIER_VIDEO_VISIT_ISSUES | ¿Qué? | ¿Qué? | Falta: Cámara: No pude detectar su cámara.. | 1735 | NOTICEABLE DELAY | 4654 | describeCurrentView→ | same view |  |
| 10 | speech | BARRIER_VIDEO_VISIT_ISSUES | Más despacio. | Más despacio. | Despacio: falta Cámara: No pude detectar su cámara.. | 1836 | NOTICEABLE DELAY | 5164 | describeCurrentView→ | same view |  |
| 11 | speech | BARRIER_VIDEO_VISIT_ISSUES | ¿Qué hago? | ¿Qué hago? | Siga los pasos y vuelva a revisar. Falta: Cámara: No pude detectar su cámara.. | 1821 | NOTICEABLE DELAY | 7663 | performViewAction→PERFORMED | BARRIER_VIDEO_VISIT_ISSUES → BARRIER_VIDEO_VISIT_GUIDE |  |
| 12 | silence | | (silent 5000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 13 | speech | BARRIER_VIDEO_VISIT_GUIDE | Sí. | Sí. | Bien. Cuando termine, dígame 'ya' y reviso de nuevo. | 1781 | NOTICEABLE DELAY | 5531 |  | same view |  |
| 14 | silence | | (silent 5000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 15 | speech | BARRIER_VIDEO_VISIT_GUIDE | (inaudible) | (inaudible) | (empty generation) |  | N/A |  |  | same view | no audible response was produced for this turn; turn did not finish within 20000 ms (state USER_SPEAKING) |
| 16 | speech | BARRIER_VIDEO_VISIT_GUIDE | Ya. | Ya. | Revisando de nuevo. | 2569 | POOR | 3814 | performViewAction→PERFORMED | BARRIER_VIDEO_VISIT_GUIDE → BARRIER_VIDEO_VISIT_ISSUES | EMMI was not idle before the patient spoke (state USER_SPEAKING); response start 2569 ms |
| 17 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 18 | speech | BARRIER_VIDEO_VISIT_ISSUES | ¿Sirve? | ¿Sirve? | Todavía falta: Cámara: No pude detectar su cámara.. | 1749 | NOTICEABLE DELAY | 5079 | describeCurrentView→ | same view |  |
| 19 | speech | BARRIER_VIDEO_VISIT_ISSUES | Repita. | Repita. | Falta Cámara: No pude detectar su cámara.. | 1807 | NOTICEABLE DELAY | 4726 | describeCurrentView→ | same view |  |
| 20 | speech | BARRIER_VIDEO_VISIT_ISSUES | Gracias. | Gracias. | De nada. | 1786 | NOTICEABLE DELAY | 2614 |  | same view |  |
| 21 | speech | BARRIER_VIDEO_VISIT_ISSUES | Adiós. | Adiós. | Hasta luego. Aquí estaré. | 1794 | NOTICEABLE DELAY | 3457 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 15,
  "total_turns": 21,
  "response_start_p50_ms": 1797,
  "response_start_p95_ms": 2655,
  "response_start_avg_ms": 1910,
  "app_overhead_p50_ms": 3,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 5: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 7: response start 2655 ms",
    "turn 15: no audible response was produced for this turn",
    "turn 15: turn did not finish within 20000 ms (state USER_SPEAKING)",
    "turn 16: EMMI was not idle before the patient spoke (state USER_SPEAKING)",
    "turn 16: response start 2569 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 1031 ms after tap
- provider set to return no transcript for the next turn
