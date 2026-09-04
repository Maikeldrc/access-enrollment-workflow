# Voice session S23-creole-sample-ht

- patient_profile: A (granmoun, reponn kout)
- language: es
- flow: Haitian Creole sample: voice guidance is not offered in Kreyòl (VOICE_UNAVAILABLE_FOR_LOCALE), so the session is Spanish and the patient speaks Kreyòl, then asks for Kreyòl
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T22:00:34.431Z
- finished: 2026-09-04T22:02:08.008Z

The app only offers voice in English and Spanish; a Kreyòl UI shows 'Voice guidance isn't available in this language yet'. This sample checks what the Spanish session does with Kreyòl speech (language signal, no discard) and with an explicit request it cannot honour (no session rebuild, EMMI keeps answering).

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Bonjou. | Bonjou. | Hola. Estoy aquí para ayudarle con su cita. | 1796 | NOTICEABLE DELAY | 5134 |  | same view |  |
| 3 | speech | APPOINTMENT_CONFIRMED | Ki lè randevou mwen an? | Ki lè randevou mwen an? | A las 2:30 p. m.. | 1796 | NOTICEABLE DELAY | 3886 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 4 | speech | APPOINTMENT_CONFIRMED | Mwen pa gen transpò. | Mwen pa gen transpò. | Podemos buscarle transporte. ¿Le recogemos en su casa, 123 Oak Avenue, Apt 4B · Miami, FL 33176? | 1859 | NOTICEABLE DELAY | 9066 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 5 | speech | BARRIER_TRANSPORTATION_PICKUP | Pale kreyòl avè m, tanpri. | Pale kreyòl avè m, tanpri. | Lo siento, por ahora la guía por voz solo está disponible en español y en inglés. Puede escribirme en criollo en el chat. | 1773 | NOTICEABLE DELAY | 11543 |  | same view |  |
| 6 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 7 | speech | BARRIER_TRANSPORTATION_PICKUP | Wi. | Wi. | ¿Necesita alguna ayuda especial para viajar? | 1811 | NOTICEABLE DELAY | 4311 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS |  |
| 8 | speech | BARRIER_TRANSPORTATION_NEEDS | Non, mèsi. | Non, mèsi. | Revise la hora de recogida sugerida y busque vehículos, o elija otra hora. | 1865 | NOTICEABLE DELAY | 7336 | performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_TIME |  |
| 9 | speech | BARRIER_TRANSPORTATION_TIME | Gracias. | Gracias. | De nada. | 1799 | NOTICEABLE DELAY | 2638 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 7,
  "total_turns": 9,
  "response_start_p50_ms": 1799,
  "response_start_p95_ms": 1865,
  "response_start_avg_ms": 1814,
  "app_overhead_p50_ms": 2,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 3: the app sent no screen context to the provider before it answered this spoken turn"
  ]
}
```

## Observations

- voice start: state EMMI_THINKING, socket true, error "", 500 ms after tap
- after the Kreyòl request: html lang=es; provider sessions opened=1; voice state=LISTENING; socket=true
