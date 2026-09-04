# Voice session S12-video-visit-es

- patient_profile: C (se confunde fácilmente)
- language: es
- flow: video visit device check
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:35:43.009Z
- finished: 2026-09-04T01:37:19.574Z

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | No sé cómo entrar a la visita por video. | No sé cómo entrar a la visita por video. | Estoy revisando el micrófono, la cámara, la conexión y el enlace de la visita. | 2653 | POOR | 8509 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_VIDEO_VISIT_ISSUES | response start 2653 ms |
| 3 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 4 | speech | BARRIER_VIDEO_VISIT_ISSUES | ¿Qué falta? | ¿Qué falta? | Falta: Cámara: No pude detectar su cámara.. ¿Quiere que le guíe paso a paso? | 1816 | NOTICEABLE DELAY | 7668 | describeCurrentView→ | same view |  |
| 5 | speech | BARRIER_VIDEO_VISIT_ISSUES | Sí. | Sí. | Siga los pasos y vuelva a revisar. Falta: Cámara: No pude detectar su cámara.. | 1860 | NOTICEABLE DELAY | 7709 | performViewAction→PERFORMED | BARRIER_VIDEO_VISIT_ISSUES → BARRIER_VIDEO_VISIT_GUIDE |  |
| 6 | speech | BARRIER_VIDEO_VISIT_GUIDE | Ya lo hice. Revisa otra vez. | Ya lo hice. Revisa otra vez. | Revisando de nuevo. | 2524 | POOR | 3770 | performViewAction→PERFORMED | BARRIER_VIDEO_VISIT_GUIDE → BARRIER_VIDEO_VISIT_ISSUES | response start 2524 ms |
| 7 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 8 | speech | BARRIER_VIDEO_VISIT_ISSUES | ¿Ya está bien? | ¿Ya está bien? | Todavía falta: Cámara: No pude detectar su cámara.. | 1812 | NOTICEABLE DELAY | 5141 | describeCurrentView→ | same view |  |

## Summary

```json
{
  "spoken_turns": 5,
  "total_turns": 8,
  "response_start_p50_ms": 1860,
  "response_start_p95_ms": 2653,
  "response_start_avg_ms": 2133,
  "app_overhead_p50_ms": 3,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 2: response start 2653 ms",
    "turn 6: response start 2524 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 918 ms after tap
