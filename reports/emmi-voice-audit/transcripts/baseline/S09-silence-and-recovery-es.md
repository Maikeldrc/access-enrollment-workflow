# Voice session S09-silence-and-recovery-es

- patient_profile: A (adulto mayor, responde muy poco)
- language: es
- flow: silences, unrecognised speech, provider without transcript, provider that never answers
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T00:24:57.240Z
- finished: 2026-09-04T00:27:19.273Z

Error-recovery behaviour: what EMMI says when nothing is understood, and what happens when the provider stalls.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Hola. | Hola. | Hola. Estoy aquí para ayudarle con su cita. ¿Qué necesita? | 1813 | NOTICEABLE DELAY | 5987 |  | same view |  |
| 3 | silence | | (silent 12000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 4 | speech | APPOINTMENT_CONFIRMED | (mumbled, unrecognisable) | (mumbled, unrecognisable) | (empty generation) |  | N/A |  |  | same view | no audible response was produced for this turn; turn did not finish within 20000 ms (state USER_SPEAKING) |
| 5 | speech | APPOINTMENT_CONFIRMED | Repítemelo. | Repítemelo. | Le decía que estoy aquí para ayudarle con su cita. | 1785 | NOTICEABLE DELAY | 5941 |  | same view | EMMI was not idle before the patient spoke (state USER_SPEAKING) |
| 6 | speech | APPOINTMENT_CONFIRMED | ¿Qué hago ahora? | ¿Qué hago ahora? |  |  | N/A |  |  | same view | app raised EMMI_VOICE_TURN_TIMEOUT, EMMI_VOICE_ERROR:VOICE_RESPONSE_TIMEOUT |
| 7 | silence | | (silent 4000 ms) | |  | | | | | | states DISCONNECTED→DISCONNECTED |
| 8 | speech | APPOINTMENT_CONFIRMED | ¿Sigues ahí? |  |  |  | N/A |  |  | same view |  |

## Summary

```json
{
  "spoken_turns": 5,
  "total_turns": 8,
  "response_start_p50_ms": 1785,
  "response_start_p95_ms": 1813,
  "response_start_avg_ms": 1799,
  "app_overhead_p50_ms": 6,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 4: no audible response was produced for this turn",
    "turn 4: turn did not finish within 20000 ms (state USER_SPEAKING)",
    "turn 5: EMMI was not idle before the patient spoke (state USER_SPEAKING)",
    "turn 6: app raised EMMI_VOICE_TURN_TIMEOUT, EMMI_VOICE_ERROR:VOICE_RESPONSE_TIMEOUT"
  ]
}
```

## Observations

- voice start: state EMMI_THINKING, socket true, error "", 1187 ms after tap
- provider set to return no transcript for the next turn
- provider set to never answer the next turn (stall)
