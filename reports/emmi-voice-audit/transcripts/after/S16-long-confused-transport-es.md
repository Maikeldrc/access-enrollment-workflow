# Voice session S16-long-confused-transport-es

- patient_profile: C (se confunde fácilmente)
- language: es
- flow: long: appointment → transportation with repeated 'no entendí', repetition requests, known data, a cost question mid-task, booking, return ride declined
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T04:45:17.221Z
- finished: 2026-09-04T04:47:51.127Z

21 spoken turns. Backchannels ('Ajá', 'Mm'), 'no entendí', '¿qué me dijiste?', 'más despacio', a question about data the app already has, and a general question in the middle of the task.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Hola, ¿me escucha? | Hola, ¿me escucha? | Sí, le escucho bien. ¿En qué le ayudo? | 1797 | NOTICEABLE DELAY | 5143 |  | same view |  |
| 3 | speech | APPOINTMENT_CONFIRMED | Es que mi hija me dijo que tenía que hacer algo con la cita pero no sé qué. | Es que mi hija me dijo que tenía que hacer algo con la cita pero no sé qué. | Esta visita está confirmada. Desde aquí puede prepararse, pedir ayuda para llegar, cambiarla o cancelarla. | 1749 | NOTICEABLE DELAY | 8002 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 4 | speech | APPOINTMENT_CONFIRMED | ¿Eh? No entendí. | ¿Eh? No entendí. | Le explico más sencillo: esta pantalla es su cita del domingo con el doctor Fresner Lee. Puede revisarla, o decirme si algo la dificulta, como el transporte. | 1756 | NOTICEABLE DELAY | 13121 |  | same view |  |
| 5 | speech | APPOINTMENT_CONFIRMED | Ah, ya. Es que no tengo quien me lleve. | Ah, ya. Es que no tengo quien me lleve. | Podemos buscarle transporte. ¿Le recogemos en su casa, 123 Oak Avenue, Apt 4B · Miami, FL 33176? | 1866 | NOTICEABLE DELAY | 8984 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 6 | speech | BARRIER_TRANSPORTATION_PICKUP | ¿Ustedes tienen mi dirección? | ¿Ustedes tienen mi dirección? | Sí, tenemos su dirección: 123 Oak Avenue, Apt 4B · Miami, FL 33176. ¿La usamos para recogerle? | 1822 | NOTICEABLE DELAY | 8938 | describeCurrentView→ | same view |  |
| 7 | speech | BARRIER_TRANSPORTATION_PICKUP | Ajá. | Ajá. | ¿Necesita alguna ayuda especial para viajar, como silla de ruedas o que alguien le acompañe? | 1795 | NOTICEABLE DELAY | 8069 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS |  |
| 8 | speech | BARRIER_TRANSPORTATION_NEEDS | Mm… ¿qué opciones hay? | Mm… ¿qué opciones hay? | Puede elegir: 1, No, ninguna; 2, Uso bastón o andador; 3, Uso silla de ruedas; 4, Viajará alguien conmigo; 5, Necesito ayuda para entrar o salir del vehículo. ¿Cuál? | 1780 | NOTICEABLE DELAY | 14070 | describeCurrentView→ | same view |  |
| 9 | speech | BARRIER_TRANSPORTATION_NEEDS | Ninguna, gracias. | Ninguna, gracias. | Revise la hora de recogida sugerida y busque vehículos, o elija otra hora. | 1897 | NOTICEABLE DELAY | 7334 | performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_TIME |  |

## Summary

```json
{
  "spoken_turns": 8,
  "total_turns": 9,
  "response_start_p50_ms": 1795,
  "response_start_p95_ms": 1897,
  "response_start_avg_ms": 1808,
  "app_overhead_p50_ms": 4,
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

- voice start: state EMMI_THINKING, socket true, error "", 871 ms after tap
- HARNESS ERROR: page.evaluate: Execution context was destroyed, most likely because of a navigation
    at voiceProbe (/home/user/access-enrollment-workflow/reports/emmi-voice-audit/harness/voice-harness.mjs:97:40)
    at waitForIdle (/home/user/access-enrollment-workflow/reports/emmi-voice-audit/harness/voice-harness.mjs:139:25)
    at async SessionRecorder.speak (/home/user/access-enrollment-workflow/reports/emmi-voice-audit/harness/voice-harness.mjs:217:23)
    at async file:///home/user/access-enrollment-workflow/reports/emmi-voice-audit/harness/run-sessions.mjs:32:23
