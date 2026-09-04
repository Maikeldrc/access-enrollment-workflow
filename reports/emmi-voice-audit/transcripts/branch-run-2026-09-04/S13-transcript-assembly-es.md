# Voice session S13-transcript-assembly-es

- patient_profile: A (adulto mayor, responde muy poco)
- language: es
- flow: output transcript that lags its audio (provider final transcript after turnComplete)
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T20:05:32.812Z
- finished: 2026-09-04T20:06:40.783Z

Reproduces the production symptom of orphan transcript tails: the double delivers the last transcript piece after turnComplete. Measures whether the visible thread shows one bubble or two.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | ¿Con quién es la cita? | ¿Con quién es la cita? | Su cita es con el doctor Fresner Lee, el domingo a las diez y media de la mañana, en Fresner Medical Group. Si quiere, puedo ayudarle a comunicarse con su equipo. | 1816 | NOTICEABLE DELAY | 15096 |  | same view |  |
| 3 | silence | | (silent 2000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 4 | speech | APPOINTMENT_CONFIRMED | Gracias. | Gracias. | De nada. | 1835 | NOTICEABLE DELAY | 2666 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 2,
  "total_turns": 4,
  "response_start_p50_ms": 1816,
  "response_start_p95_ms": 1835,
  "response_start_avg_ms": 1826,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": []
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 631 ms after tap
- assistant bubbles after a lagging transcript: 1 → ["EMMI\n\nSu cita es con el doctor Fresner Lee, el domingo a las diez y media de la mañana, en Fresner Medical Group. Si quiere, puedo ayudarle a comunicarse con su"]
