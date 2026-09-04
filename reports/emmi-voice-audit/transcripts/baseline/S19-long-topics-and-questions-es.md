# Voice session S19-long-topics-and-questions-es

- patient_profile: B (habla mucho, información desordenada)
- language: es
- flow: long: visit topics interleaved with general questions, persona questions, a silence, and reads of known data
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:04:17.054Z
- finished: 2026-09-04T01:08:43.373Z

20 spoken turns. Topic switching and return, persona consistency ('¿eres una persona?'), repetition requests, references ('el segundo', 'el de la rodilla'), '¿sigues ahí?' after a silence.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Oye, ¿tú eres una persona de verdad o una máquina? | Oye, ¿tú eres una persona de verdad o una máquina? | Soy EMMI, la asistente virtual de ITERA. No soy una persona, pero estoy aquí para ayudarle con su cuidado. | 1785 | NOTICEABLE DELAY | 9750 |  | same view |  |
| 3 | speech | APPOINTMENT_CONFIRMED | ¿Y cómo te llamas? | ¿Y cómo te llamas? | EMMI. | 1776 | NOTICEABLE DELAY | 2378 |  | same view |  |
| 4 | speech | APPOINTMENT_CONFIRMED | Bueno, EMMI, ¿con quién es mi cita? | Bueno, EMMI, ¿con quién es mi cita? | Con Dr. Fresner Lee. | 1832 | NOTICEABLE DELAY | 3495 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 5 | speech | APPOINTMENT_CONFIRMED | ¿Y qué día? | ¿Y qué día? | El lunes, 7 de septiembre. | 1805 | NOTICEABLE DELAY | 3892 | describeCurrentView→ | same view |  |
| 6 | speech | APPOINTMENT_CONFIRMED | ¿Me lo repites? | ¿Me lo repites? | El lunes, 7 de septiembre. | 1803 | NOTICEABLE DELAY | 3888 | describeCurrentView→ | same view |  |
| 7 | speech | APPOINTMENT_CONFIRMED | Quiero anotar cosas para preguntarle. Primero, que me duele la rodilla cuando subo escaleras. | Quiero anotar cosas para preguntarle. Primero, que me duele la rodilla cuando subo escaleras. | Anotado: dolor de rodilla al subir escaleras. ¿Algo más? | 1862 | NOTICEABLE DELAY | 5612 | performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → APPOINTMENT_TOPICS |  |
| 8 | speech | APPOINTMENT_TOPICS | Sí, que a veces se me olvidan las pastillas. | Sí, que a veces se me olvidan las pastillas. | Listo. Su lista tiene 2: Dolor de rodilla al subir escaleras; A veces olvido las pastillas. | 1739 | NOTICEABLE DELAY | 8435 | manageAppointmentTopics→SAVED | same view |  |
| 9 | speech | APPOINTMENT_TOPICS | Por cierto, ¿qué es eso de ACCESS que me mandaron? | Por cierto, ¿qué es eso de ACCESS que me mandaron? | ACCESS es una opción de cuidado de Medicare que le da apoyo adicional entre visitas. Sus médicos siguen siendo los mismos. | 1818 | NOTICEABLE DELAY | 10672 |  | same view |  |
| 10 | speech | APPOINTMENT_TOPICS | ¿Y cuánto me cuesta? | ¿Y cuánto me cuesta? | No puedo confirmar el monto ahora mismo; su equipo de cuidado sí puede. | 1834 | NOTICEABLE DELAY | 7281 | getExpectedAccessCost→ | same view |  |
| 11 | speech | APPOINTMENT_TOPICS | Ok. Volviendo a la lista, ¿cuántos hay? | Ok. Volviendo a la lista, ¿cuántos hay? | Listo. Su lista tiene 2: Dolor de rodilla al subir escaleras; A veces olvido las pastillas. | 1820 | NOTICEABLE DELAY | 8547 | manageAppointmentTopics→SAVED | same view |  |
| 12 | speech | APPOINTMENT_TOPICS | El segundo cámbialo por 'se me olvidan las pastillas de la presión por la noche'. | El segundo cámbialo por 'se me olvidan las pastillas de la presión por la noche'. | Listo. Su lista tiene 2: Dolor de rodilla al subir escaleras; Se me olvidan las pastillas de la presión por la noche. | 1821 | NOTICEABLE DELAY | 11115 | manageAppointmentTopics→SAVED | same view |  |
| 13 | speech | APPOINTMENT_TOPICS | Y agrega que quiero saber si puedo caminar más. | Y agrega que quiero saber si puedo caminar más. | Listo. Su lista tiene 3: Dolor de rodilla al subir escaleras; Se me olvidan las pastillas de la presión por la noche; ¿Puedo caminar más?. | 1799 | NOTICEABLE DELAY | 12462 | manageAppointmentTopics→SAVED | same view |  |
| 14 | silence | | (silent 6000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 15 | speech | APPOINTMENT_TOPICS | ¿Sigues ahí? | ¿Sigues ahí? | Sí, aquí estoy. | 1806 | NOTICEABLE DELAY | 3052 |  | same view |  |
| 16 | speech | APPOINTMENT_TOPICS | Quita el de la rodilla. | Quita el de la rodilla. | Listo. Su lista tiene 0: . ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 4719 | VERY POOR | 13650 | manageAppointmentTopics→ | same view | response start 4719 ms |
| 17 | speech | APPOINTMENT_TOPICS | No, no, déjalo. Ponlo otra vez. | No, no, déjalo. Ponlo otra vez. | Listo. Su lista tiene 0: . ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 4705 | VERY POOR | 13657 | manageAppointmentTopics→ | same view | response start 4705 ms |
| 18 | speech | APPOINTMENT_TOPICS | Léeme toda la lista. | Léeme toda la lista. | Listo. Su lista tiene 0: . ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 4733 | VERY POOR | 13727 | manageAppointmentTopics→ | same view | response start 4733 ms |
| 19 | speech | APPOINTMENT_TOPICS | ¿A qué hora era la cita? | ¿A qué hora era la cita? | A las 10:30 a. m.. | 1807 | NOTICEABLE DELAY | 3890 | describeCurrentView→ | same view |  |
| 20 | speech | APPOINTMENT_TOPICS | Perfecto. Eso es todo, gracias EMMI. | Perfecto. Eso es todo, gracias EMMI. | Con gusto. La lista queda guardada para su cita. | 1810 | NOTICEABLE DELAY | 5583 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 18,
  "total_turns": 20,
  "response_start_p50_ms": 1810,
  "response_start_p95_ms": 4733,
  "response_start_avg_ms": 2293,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 3,
  "problems": [
    "turn 4: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 16: response start 4719 ms",
    "turn 17: response start 4705 ms",
    "turn 18: response start 4733 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 951 ms after tap
