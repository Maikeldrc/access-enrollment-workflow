# Voice session S23-creole-sample-ht

- patient_profile: A (granmoun, reponn kout)
- language: es
- flow: Haitian Creole sample: voice guidance is not offered in Kreyòl (VOICE_UNAVAILABLE_FOR_LOCALE), so the session is Spanish and the patient speaks Kreyòl, then asks for Kreyòl
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T04:41:58.791Z
- finished: 2026-09-04T04:44:04.830Z

The app only offers voice in English and Spanish; a Kreyòl UI shows 'Voice guidance isn't available in this language yet'. This sample checks what the Spanish session does with Kreyòl speech (language signal, no discard) and with an explicit request it cannot honour (no session rebuild, EMMI keeps answering).

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Bonjou. | Bonjou. | Hola. Estoy aquí para ayudarle con su cita. | 1822 | NOTICEABLE DELAY | 5152 |  | same view |  |
| 3 | speech | APPOINTMENT_CONFIRMED | Ki lè randevou mwen an? | Ki lè randevou mwen an? | No veo la hora. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 3703 | POOR | 12533 | describeCurrentView→ | same view | response start 3703 ms |
| 4 | speech | APPOINTMENT_CONFIRMED | Mwen pa gen transpò. | Mwen pa gen transpò. | ¿Dónde le recogemos? ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 3450 | POOR | 12277 | performViewAction→; performViewAction→; performViewAction→ | same view | response start 3450 ms; expected view PICKUP, got APPOINTMENT_CONFIRMED |
| 5 | speech | APPOINTMENT_CONFIRMED | Pale kreyòl avè m, tanpri. | Pale kreyòl avè m, tanpri. | Lo siento, por ahora la guía por voz solo está disponible en español y en inglés. Puede escribirme en criollo en el chat. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 11681 | VERY POOR | 20560 |  | same view | response start 11681 ms |
| 6 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 7 | speech | APPOINTMENT_CONFIRMED | Wi. | Wi. | ¿Necesita alguna ayuda especial para viajar? | 1821 | NOTICEABLE DELAY | 4319 | performViewAction→UNKNOWN_ACTION | same view | expected view NEEDS, got APPOINTMENT_CONFIRMED |
| 8 | speech | APPOINTMENT_CONFIRMED | Non, mèsi. | Non, mèsi. | No pude completar ese paso: UNKNOWN_ACTION. | 1858 | NOTICEABLE DELAY | 4358 | performViewAction→UNKNOWN_ACTION; performViewAction→UNKNOWN_ACTION | same view | expected view TIME, got APPOINTMENT_CONFIRMED |
| 9 | speech | APPOINTMENT_CONFIRMED | Gracias. | Gracias. | De nada. | 1792 | NOTICEABLE DELAY | 2620 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 7,
  "total_turns": 9,
  "response_start_p50_ms": 1858,
  "response_start_p95_ms": 11681,
  "response_start_avg_ms": 3732,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 3,
  "problems": [
    "turn 3: response start 3703 ms",
    "turn 4: response start 3450 ms",
    "turn 4: expected view PICKUP, got APPOINTMENT_CONFIRMED",
    "turn 5: response start 11681 ms",
    "turn 7: expected view NEEDS, got APPOINTMENT_CONFIRMED",
    "turn 8: expected view TIME, got APPOINTMENT_CONFIRMED"
  ]
}
```

## Observations

- voice start: state EMMI_THINKING, socket true, error "", 936 ms after tap
- after the Kreyòl request: html lang=es; provider sessions opened=1; voice state=LISTENING; socket=true
