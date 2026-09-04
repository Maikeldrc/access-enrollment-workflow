# Voice session S12-video-visit-es

- patient_profile: C (se confunde fácilmente)
- language: es
- flow: video visit device check
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T21:30:18.157Z
- finished: 2026-09-04T21:31:42.678Z

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | No sé cómo entrar a la visita por video. | No sé cómo entrar a la visita por video. | Estoy revisando el micrófono, la cámara, la conexión y el enlace de la visita. | 2493 | NOTICEABLE DELAY | 8387 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_VIDEO_VISIT_ISSUES |  |
| 3 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 4 | speech | BARRIER_VIDEO_VISIT_ISSUES | ¿Qué falta? | ¿Qué falta? | Falta: Cámara: No pude detectar su cámara.. ¿Quiere que le guíe paso a paso? | 1765 | NOTICEABLE DELAY | 7687 | describeCurrentView→ | same view |  |
| 5 | speech | BARRIER_VIDEO_VISIT_ISSUES | Sí. | Sí. | Siga los pasos y vuelva a revisar. Falta: Cámara: No pude detectar su cámara.. | 1817 | NOTICEABLE DELAY | 7710 | performViewAction→PERFORMED | BARRIER_VIDEO_VISIT_ISSUES → BARRIER_VIDEO_VISIT_GUIDE |  |
| 6 | speech | BARRIER_VIDEO_VISIT_GUIDE | Ya lo hice. Revisa otra vez. | Ya lo hice. Revisa otra vez. | Revisando de nuevo. | 2445 | NOTICEABLE DELAY | 3705 | performViewAction→PERFORMED | BARRIER_VIDEO_VISIT_GUIDE → BARRIER_VIDEO_VISIT_ISSUES |  |
| 7 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 8 | speech | BARRIER_VIDEO_VISIT_ISSUES | ¿Ya está bien? | ¿Ya está bien? | Todavía falta: Cámara: No pude detectar su cámara.. | 1813 | NOTICEABLE DELAY | 5156 | describeCurrentView→ | same view |  |

## Summary

```json
{
  "spoken_turns": 5,
  "total_turns": 8,
  "response_start_p50_ms": 1817,
  "response_start_p95_ms": 2493,
  "response_start_avg_ms": 2067,
  "app_overhead_p50_ms": 2,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": []
}
```

## Observations

- voice start: state EMMI_THINKING, socket true, error "", 626 ms after tap
