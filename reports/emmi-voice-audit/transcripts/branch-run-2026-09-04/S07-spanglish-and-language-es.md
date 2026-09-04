# Voice session S07-spanglish-and-language-es

- patient_profile: F (utiliza Spanglish)
- language: es
- flow: Spanglish utterances, plain Spanish without accents, and an English sentence while the session is Spanish
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T19:49:33.098Z
- finished: 2026-09-04T19:52:28.807Z

Tests the transcript-reliability guard with the ASR text the provider would return. The double transcribes exactly what the patient said.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | No tengo ride para mañana. | No tengo ride para mañana. | Puedo buscarle transporte para la cita. ¿Quiere que lo haga? | 1840 | NOTICEABLE DELAY | 6063 |  | same view |  |
| 3 | speech | APPOINTMENT_CONFIRMED | Yo uso walker para caminar. | Yo uso walker para caminar. | Gracias, lo tendré en cuenta para el vehículo. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 8389 | VERY POOR | 14357 |  | same view | response start 8389 ms |
| 4 | speech | APPOINTMENT_CONFIRMED | Quiero un Uber X | Quiero un Uber X | Puedo buscar un UberX. Primero confirmemos dónde le recogen. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 8617 | VERY POOR | 14845 |  | same view | response start 8617 ms |
| 5 | speech | APPOINTMENT_CONFIRMED | Mi doctor dijo que no | Mi doctor dijo que no | Entiendo. ¿Qué le dijo su doctor que no? ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 8533 | VERY POOR | 14358 |  | same view | response start 8533 ms |
| 6 | speech | APPOINTMENT_CONFIRMED | Pon la primera del jueves | Pon la primera del jueves | Para eso necesito abrir los horarios. ¿Quiere que busque otros horarios? ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 10356 | VERY POOR | 15932 |  | same view | response start 10356 ms |
| 7 | speech | APPOINTMENT_CONFIRMED | 180 sobre 120 y me siento mareado. | 180 sobre 120 y me siento mareado. | Eso puede ser una emergencia. Llame al 911 ahora. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 8649 | VERY POOR | 14846 |  | same view | response start 8649 ms |
| 8 | speech | APPOINTMENT_CONFIRMED | Can we switch to English please? | Can we switch to English please? | Of course, I will continue in English. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 8142 | VERY POOR | 14099 |  | same view | response start 8142 ms |
| 9 | speech | APPOINTMENT_CONFIRMED | Quiero cambiar el appointment | Quiero cambiar el appointment | Puedo ayudarle a cambiar la cita. | 1766 | NOTICEABLE DELAY | 4257 |  | same view |  |
| 10 | speech | APPOINTMENT_CONFIRMED | Espera | Espera | Sí, dígame. | 1825 | NOTICEABLE DELAY | 2659 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 9,
  "total_turns": 10,
  "response_start_p50_ms": 8389,
  "response_start_p95_ms": 10356,
  "response_start_avg_ms": 6457,
  "app_overhead_p50_ms": 6538,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 6,
  "problems": [
    "turn 3: response start 8389 ms",
    "turn 4: response start 8617 ms",
    "turn 5: response start 8533 ms",
    "turn 6: response start 10356 ms",
    "turn 7: response start 8649 ms",
    "turn 8: response start 8142 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 807 ms after tap
