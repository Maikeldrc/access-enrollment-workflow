# Voice session S14-spoken-language-switch

- patient_profile: F (utiliza Spanglish)
- language: en
- flow: English session; the patient speaks Spanish and asks to switch
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:00:20.030Z
- finished: 2026-09-04T01:01:47.227Z

The 2026-08-30 production failure: a spoken request to change language. The double transcribes what the patient said; the app must switch the session and confirm in the new language.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | What time is my appointment? | What time is my appointment? | It is at 10:30 AM. | 1820 | NOTICEABLE DELAY | 3901 | describeCurrentView→ | same view |  |
| 3 | speech | APPOINTMENT_CONFIRMED | Prefiero hablar en español. Hable conmigo en español ahora. | Prefiero hablar en español. Hable conmigo en español ahora. | Of course. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 2940 | POOR | 11793 |  | same view | response start 2940 ms |
| 4 | silence | | (silent 4000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 5 | speech | APPOINTMENT_CONFIRMED | ¿A qué hora es mi cita? | ¿A qué hora es mi cita? | Déjeme ver. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 3096 | POOR | 11991 | describeCurrentView→ | same view | response start 3096 ms |
| 6 | speech | APPOINTMENT_CONFIRMED | Gracias. | Gracias. | De nada. | 1768 | NOTICEABLE DELAY | 2625 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 4,
  "total_turns": 6,
  "response_start_p50_ms": 1820,
  "response_start_p95_ms": 3096,
  "response_start_avg_ms": 2406,
  "app_overhead_p50_ms": 7,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 2,
  "problems": [
    "turn 3: response start 2940 ms",
    "turn 5: response start 3096 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 993 ms after tap
- after the spoken request: html lang=en; provider sessions opened=1; setups=1; guide="EMMI
Voice guidance is on
Ask EMMI
Voice options"
