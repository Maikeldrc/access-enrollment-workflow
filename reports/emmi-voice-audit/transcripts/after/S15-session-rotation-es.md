# Voice session S15-session-rotation-es

- patient_profile: G (hace muchas preguntas antes de decidir)
- language: es
- flow: a conversation that outlives the token: EMMI_SESSION_MAX_MINUTES=2 on the dev server
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:39:31.624Z
- finished: 2026-09-04T01:42:35.655Z

Run against a dev server started with EMMI_SESSION_MAX_MINUTES=2 (BASE_URL points at it). At minute 1 the app must rotate the session silently and keep answering; before the change it disconnected at minute 2 and went quiet.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | ¿Con quién es la cita? | ¿Con quién es la cita? | Con Dr. Fresner Lee. | 1878 | NOTICEABLE DELAY | 3545 | describeCurrentView→ | same view |  |
| 3 | silence | | (silent 70000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 4 | speech | APPOINTMENT_CONFIRMED | ¿Y a qué hora? |  |  |  | N/A |  |  | same view |  |
| 5 | silence | | (silent 60000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 6 | speech | APPOINTMENT_CONFIRMED | ¿Dónde es? |  |  |  | N/A |  |  | same view |  |

## Summary

```json
{
  "spoken_turns": 3,
  "total_turns": 6,
  "response_start_p50_ms": 1878,
  "response_start_p95_ms": 1878,
  "response_start_avg_ms": 1878,
  "app_overhead_p50_ms": 10,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": []
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 933 ms after tap
- after 70 s: provider sessions opened=2; voice state=LISTENING; socket=true
- after 130 s: provider sessions opened=3; voice state=LISTENING; socket=true; error=
