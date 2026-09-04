# Voice session S12-video-visit-es

- patient_profile: C (se confunde fácilmente)
- language: es
- flow: video visit device check
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T00:34:17.195Z
- finished: 2026-09-04T00:35:50.100Z

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | No sé cómo entrar a la visita por video. | No sé cómo entrar a la visita por video. | Estoy revisando el micrófono, la cámara, la conexión y el enlace de la visita. | 1870 | NOTICEABLE DELAY | 7734 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→UNKNOWN_ACTION | APPOINTMENT_CONFIRMED → BARRIER_RESCHEDULE_OFFER |  |
| 3 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 4 | speech | BARRIER_RESCHEDULE_OFFER | ¿Qué falta? | ¿Qué falta? | No falta nada. | 1779 | NOTICEABLE DELAY | 3035 | describeCurrentView→ | same view |  |
| 5 | speech | BARRIER_RESCHEDULE_OFFER | Sí. | Sí. | Aquí puede continuar. | 1800 | NOTICEABLE DELAY | 3051 | performViewAction→UNKNOWN_ACTION | same view |  |
| 6 | speech | BARRIER_RESCHEDULE_OFFER | Ya lo hice. Revisa otra vez. | Ya lo hice. Revisa otra vez. | Revisando de nuevo. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 3457 | POOR | 12326 | performViewAction→ | same view | response start 3457 ms |
| 7 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 8 | speech | BARRIER_RESCHEDULE_OFFER | ¿Ya está bien? | ¿Ya está bien? | Sí, todo funcionó. | 1770 | NOTICEABLE DELAY | 3022 | describeCurrentView→ | same view |  |

## Summary

```json
{
  "spoken_turns": 5,
  "total_turns": 8,
  "response_start_p50_ms": 1800,
  "response_start_p95_ms": 3457,
  "response_start_avg_ms": 2135,
  "app_overhead_p50_ms": 5,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 1,
  "problems": [
    "turn 6: response start 3457 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 931 ms after tap
