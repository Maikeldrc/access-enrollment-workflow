# Voice session S14-spoken-language-switch

- patient_profile: F (utiliza Spanglish)
- language: en
- flow: English session; the patient speaks Spanish and asks to switch
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:38:27.737Z
- finished: 2026-09-04T01:39:30.622Z

The 2026-08-30 production failure: a spoken request to change language. The double transcribes what the patient said; the app must switch the session and confirm in the new language.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | What time is my appointment? | What time is my appointment? | It is at 10:30 AM. | 1824 | NOTICEABLE DELAY | 3906 | describeCurrentView→ | same view |  |
| 3 | speech | APPOINTMENT_CONFIRMED | Prefiero hablar en español. Hable conmigo en español ahora. | Prefiero hablar en español. Hable conmigo en español ahora. | (empty generation) | 1420 | ACCEPTABLE | 2248 |  | same view |  |
| 4 | silence | | (silent 4000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 5 | speech | APPOINTMENT_CONFIRMED | ¿A qué hora es mi cita? |  |  |  | N/A |  |  | same view |  |
| 6 | speech | APPOINTMENT_CONFIRMED | Gracias. |  |  |  | N/A |  |  | same view |  |

## Summary

```json
{
  "spoken_turns": 4,
  "total_turns": 6,
  "response_start_p50_ms": 1420,
  "response_start_p95_ms": 1824,
  "response_start_avg_ms": 1622,
  "app_overhead_p50_ms": 8,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": []
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 843 ms after tap
- after the spoken request: html lang=es; provider sessions opened=2; setups=2; guide="EMMI
La guía por voz está activa
Preguntar a EMMI
Opciones de voz"
