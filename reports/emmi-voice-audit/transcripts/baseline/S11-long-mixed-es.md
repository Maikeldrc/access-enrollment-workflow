# Voice session S11-long-mixed-es

- patient_profile: B (habla mucho, información desordenada)
- language: es
- flow: long session: topics → transportation → return home → reminder, 25+ turns
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T00:30:10.346Z
- finished: 2026-09-04T00:34:16.756Z

Long conversation to look for context degradation, repeated prompts and latency growth.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Buenas. Tengo la cita el domingo, ¿verdad? | Buenas. Tengo la cita el domingo, ¿verdad? | Sí, el lunes, 7 de septiembre. | 1786 | NOTICEABLE DELAY | 4280 | describeCurrentView→ | same view |  |
| 3 | speech | APPOINTMENT_CONFIRMED | ¿A qué hora era? | ¿A qué hora era? | A las 10:30 a. m.. | 1746 | NOTICEABLE DELAY | 3825 | describeCurrentView→ | same view |  |
| 4 | speech | APPOINTMENT_CONFIRMED | Quiero anotar que me duele la cabeza por las tardes. | Quiero anotar que me duele la cabeza por las tardes. | Anotado: dolor de cabeza por las tardes. | 1806 | NOTICEABLE DELAY | 4724 | performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → APPOINTMENT_TOPICS |  |
| 5 | speech | APPOINTMENT_TOPICS | Y que quiero saber si puedo tomar ibuprofeno. | Y que quiero saber si puedo tomar ibuprofeno. | Listo. Su lista tiene 2: Dolor de cabeza por las tardes; ¿Puedo tomar ibuprofeno?. | 1760 | NOTICEABLE DELAY | 7609 | manageAppointmentTopics→SAVED | same view |  |
| 6 | speech | APPOINTMENT_TOPICS | ¿Qué me dijiste que anotaste primero? | ¿Qué me dijiste que anotaste primero? | Dice: Dolor de cabeza por las tardes. | 1785 | NOTICEABLE DELAY | 4700 | manageAppointmentTopics→SAVED | same view |  |
| 7 | speech | APPOINTMENT_TOPICS | Bien. Ahora, no tengo cómo llegar. | Bien. Ahora, no tengo cómo llegar. | Busquemos transporte. ¿Le recogemos en su casa? | 1861 | NOTICEABLE DELAY | 9022 | performViewAction→PERFORMED; performViewAction→SCREEN_NOT_DESCRIBED; performViewAction→SCREEN_NOT_DESCRIBED; performViewAction→SCREEN_NOT_DESCRIBED; performViewAction→SCREEN_NOT_DESCRIBED | APPOINTMENT_TOPICS → SCREEN_MY_CARE |  |
| 8 | speech | SCREEN_MY_CARE | Sí, en casa. | Sí, en casa. | ¿Necesita alguna ayuda especial para viajar? | 1807 | NOTICEABLE DELAY | 4301 | performViewAction→SCREEN_NOT_DESCRIBED | same view |  |
| 9 | speech | SCREEN_MY_CARE | Viene mi hija conmigo. | Viene mi hija conmigo. | Aquí puede continuar. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 3447 | POOR | 12309 | performViewAction→; performViewAction→ | same view | response start 3447 ms |
| 10 | speech | SCREEN_MY_CARE | ¿A qué hora me recogen? | ¿A qué hora me recogen? | Aún no hay hora. | 1770 | NOTICEABLE DELAY | 3429 | describeCurrentView→ | same view |  |
| 11 | speech | SCREEN_MY_CARE | Sí. | Sí. | Buscando. | 1765 | NOTICEABLE DELAY | 2374 | performViewAction→SCREEN_NOT_DESCRIBED | same view |  |
| 12 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 13 | speech | SCREEN_MY_CARE | ¿Cuántas opciones hay? | ¿Cuántas opciones hay? | Hay 0 opciones. | 1769 | NOTICEABLE DELAY | 3022 | describeCurrentView→ | same view |  |
| 14 | speech | SCREEN_MY_CARE | ¿Cuál llega más temprano? | ¿Cuál llega más temprano? | No sé. | 1828 | NOTICEABLE DELAY | 2667 | describeCurrentView→ | same view |  |
| 15 | speech | SCREEN_MY_CARE | Esa misma. | Esa misma. | Seleccioné . Falta confirmar la reserva. | 1820 | NOTICEABLE DELAY | 4320 | describeCurrentView→; performViewAction→SCREEN_NOT_DESCRIBED | same view |  |
| 16 | speech | SCREEN_MY_CARE | Hazlo. | Hazlo. | Antes de reservar: ¿confirma la reserva? | 1786 | NOTICEABLE DELAY | 4277 |  | same view |  |
| 17 | speech | SCREEN_MY_CARE | Sí. | Sí. | Estoy reservando el viaje. Todavía no está confirmado.  | 1817 | NOTICEABLE DELAY | 5141 | performViewAction→SCREEN_NOT_DESCRIBED | same view |  |
| 18 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 19 | speech | SCREEN_MY_CARE | ¿Y para volver a casa? | ¿Y para volver a casa? | Primero terminemos la reserva de ida. | 1806 | NOTICEABLE DELAY | 4305 | describeCurrentView→ | same view |  |
| 20 | speech | SCREEN_MY_CARE | Sí. | Sí. | Aquí puede continuar. | 1793 | NOTICEABLE DELAY | 3045 | performViewAction→SCREEN_NOT_DESCRIBED | same view |  |
| 21 | speech | SCREEN_MY_CARE | ¿Qué opciones tengo? | ¿Qué opciones tengo? | Su inscripción está completa. Continúe cuando esté listo. | 1804 | NOTICEABLE DELAY | 5128 | describeCurrentView→ | same view |  |
| 22 | speech | SCREEN_MY_CARE | La primera. | La primera. | Aquí puede continuar. | 1840 | NOTICEABLE DELAY | 3089 | performViewAction→SCREEN_NOT_DESCRIBED | same view |  |
| 23 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 24 | speech | SCREEN_MY_CARE | ¿Ya está todo? | ¿Ya está todo? | Todavía no hay nada completado en este paso. | 1797 | NOTICEABLE DELAY | 5130 | describeCurrentView→ | same view |  |
| 25 | speech | SCREEN_MY_CARE | Recuérdamelo el día antes. | Recuérdamelo el día antes. | Puedo guardar un recordatorio dentro de ITERA para el día anterior. ¿Lo guardo? | 1761 | NOTICEABLE DELAY | 7217 |  | same view |  |
| 26 | speech | SCREEN_MY_CARE | Sí. | Sí. | Listo, le recordaré 2026-09-06T14:30:00.000Z dentro de ITERA. | 1846 | NOTICEABLE DELAY | 4767 | createAppointmentReminder→true | same view |  |
| 27 | speech | SCREEN_MY_CARE | ¿Qué me dijiste al principio de la lista? | ¿Qué me dijiste al principio de la lista? | Listo. Su lista tiene 2: Dolor de cabeza por las tardes; ¿Puedo tomar ibuprofeno?. | 1755 | NOTICEABLE DELAY | 7663 | manageAppointmentTopics→SAVED | same view |  |
| 28 | speech | SCREEN_MY_CARE | Perfecto. Gracias. | Perfecto. Gracias. | De nada. | 1833 | NOTICEABLE DELAY | 2661 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 24,
  "total_turns": 28,
  "response_start_p50_ms": 1797,
  "response_start_p95_ms": 1861,
  "response_start_avg_ms": 1866,
  "app_overhead_p50_ms": 3,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 1,
  "problems": [
    "turn 9: response start 3447 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 948 ms after tap
