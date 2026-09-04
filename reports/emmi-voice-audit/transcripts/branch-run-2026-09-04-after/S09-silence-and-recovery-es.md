# Voice session S09-silence-and-recovery-es

- patient_profile: A (adulto mayor, responde muy poco)
- language: es
- flow: silences, unrecognised speech, provider without transcript, provider that never answers
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T21:22:47.509Z
- finished: 2026-09-04T21:24:32.441Z

Error-recovery behaviour: what EMMI says when nothing is understood, and what happens when the provider stalls.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Hola. | Hola. | Hola. Estoy aquí para ayudarle con su cita. ¿Qué necesita? | 1816 | NOTICEABLE DELAY | 6032 |  | same view |  |
| 3 | silence | | (silent 12000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 4 | speech | APPOINTMENT_CONFIRMED | (mumbled, unrecognisable) | (mumbled, unrecognisable) | (empty generation) | 6277 | VERY POOR | 10032 |  | same view | response start 6277 ms |
| 5 | speech | APPOINTMENT_CONFIRMED | Repítemelo. | Repítemelo. | Le decía que estoy aquí para ayudarle con su cita. | 1806 | NOTICEABLE DELAY | 6015 |  | same view |  |
| 6 | speech | APPOINTMENT_CONFIRMED | ¿Qué hago ahora? | ¿Qué hago ahora? | [EMMI, own voice] Perdón, me tardé demasiado. ¿Me lo repite? | 21277 | VERY POOR | 24196 |  | same view | response start 21277 ms; app raised EMMI_VOICE_TURN_TIMEOUT |
| 7 | silence | | (silent 4000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 8 | speech | APPOINTMENT_CONFIRMED | ¿Sigues ahí? | ¿Sigues ahí? | Sí, aquí estoy. | 1817 | NOTICEABLE DELAY | 3072 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 5,
  "total_turns": 8,
  "response_start_p50_ms": 1817,
  "response_start_p95_ms": 21277,
  "response_start_avg_ms": 6599,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 4: response start 6277 ms",
    "turn 6: response start 21277 ms",
    "turn 6: app raised EMMI_VOICE_TURN_TIMEOUT"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 554 ms after tap
- provider set to return no transcript for the next turn
- provider set to never answer the next turn (stall)
