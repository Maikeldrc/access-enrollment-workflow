# Voice session S14-spoken-language-switch

- patient_profile: F (utiliza Spanglish)
- language: en
- flow: English session; the patient speaks Spanish and asks to switch
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T20:06:41.407Z
- finished: 2026-09-04T20:08:08.669Z

The 2026-08-30 production failure: a spoken request to change language. The double transcribes what the patient said; the app must switch the session and confirm in the new language.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | What time is my appointment? | What time is my appointment? | It is at 2:30 PM. | 1833 | NOTICEABLE DELAY | 3915 | describeCurrentView→ | same view |  |
| 3 | speech | APPOINTMENT_CONFIRMED | Prefiero hablar en español. Hable conmigo en español ahora. | Prefiero hablar en español. Hable conmigo en español ahora. | Of course. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 5876 | VERY POOR | 11814 |  | same view | response start 5876 ms |
| 4 | silence | | (silent 4000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 5 | speech | APPOINTMENT_CONFIRMED | ¿A qué hora es mi cita? | ¿A qué hora es mi cita? | Déjeme ver. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 6360 | VERY POOR | 11907 | describeCurrentView→ | same view | response start 6360 ms |
| 6 | speech | APPOINTMENT_CONFIRMED | Gracias. | Gracias. | De nada. | 1792 | NOTICEABLE DELAY | 2628 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 4,
  "total_turns": 6,
  "response_start_p50_ms": 1833,
  "response_start_p95_ms": 6360,
  "response_start_avg_ms": 3965,
  "app_overhead_p50_ms": 6,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 2,
  "problems": [
    "turn 3: response start 5876 ms",
    "turn 5: response start 6360 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 496 ms after tap
- after the spoken request: html lang=en; provider sessions opened=1; setups=1; guide="EMMI
Voice guidance is on
Ask EMMI
Voice options"
