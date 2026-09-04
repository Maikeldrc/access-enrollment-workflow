# Voice session S19-long-topics-and-questions-es

- patient_profile: B (habla mucho, información desordenada)
- language: es
- flow: long: visit topics interleaved with general questions, persona questions, a silence, and reads of known data
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T21:46:24.368Z
- finished: 2026-09-04T21:50:30.017Z

20 spoken turns. Topic switching and return, persona consistency ('¿eres una persona?'), repetition requests, references ('el segundo', 'el de la rodilla'), '¿sigues ahí?' after a silence.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Oye, ¿tú eres una persona de verdad o una máquina? | Oye, ¿tú eres una persona de verdad o una máquina? | Soy EMMI, la asistente virtual de ITERA. No soy una persona, pero estoy aquí para ayudarle con su cuidado. | 1811 | NOTICEABLE DELAY | 9889 |  | same view |  |
| 3 | speech | APPOINTMENT_CONFIRMED | ¿Y cómo te llamas? | ¿Y cómo te llamas? | EMMI. | 1734 | NOTICEABLE DELAY | 2329 |  | same view |  |
| 4 | speech | APPOINTMENT_CONFIRMED | Bueno, EMMI, ¿con quién es mi cita? | Bueno, EMMI, ¿con quién es mi cita? | Con Dr. Fresner Lee. | 1779 | NOTICEABLE DELAY | 3445 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 5 | speech | APPOINTMENT_CONFIRMED | ¿Y qué día? | ¿Y qué día? | El lunes, 7 de septiembre. | 1779 | NOTICEABLE DELAY | 3863 | describeCurrentView→ | same view |  |
| 6 | speech | APPOINTMENT_CONFIRMED | ¿Me lo repites? | ¿Me lo repites? | El lunes, 7 de septiembre. | 1785 | NOTICEABLE DELAY | 3876 | describeCurrentView→ | same view |  |
| 7 | speech | APPOINTMENT_CONFIRMED | Quiero anotar cosas para preguntarle. Primero, que me duele la rodilla cuando subo escaleras. | Quiero anotar cosas para preguntarle. Primero, que me duele la rodilla cuando subo escaleras. | Anotado: dolor de rodilla al subir escaleras. ¿Algo más? | 1858 | NOTICEABLE DELAY | 5644 | performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → APPOINTMENT_TOPICS |  |
| 8 | speech | APPOINTMENT_TOPICS | Sí, que a veces se me olvidan las pastillas. | Sí, que a veces se me olvidan las pastillas. | Listo. Su lista tiene 2: Dolor de rodilla al subir escaleras; A veces olvido las pastillas. | 1708 | NOTICEABLE DELAY | 8484 | manageAppointmentTopics→SAVED | same view |  |
| 9 | speech | APPOINTMENT_TOPICS | Por cierto, ¿qué es eso de ACCESS que me mandaron? | Por cierto, ¿qué es eso de ACCESS que me mandaron? | ACCESS es una opción de cuidado de Medicare que le da apoyo adicional entre visitas. Sus médicos siguen siendo los mismos. | 1754 | NOTICEABLE DELAY | 10714 |  | same view |  |
| 10 | speech | APPOINTMENT_TOPICS | ¿Y cuánto me cuesta? | ¿Y cuánto me cuesta? | No puedo confirmar el monto ahora mismo; su equipo de cuidado sí puede. | 1832 | NOTICEABLE DELAY | 7308 | getExpectedAccessCost→ | same view |  |
| 11 | speech | APPOINTMENT_TOPICS | Ok. Volviendo a la lista, ¿cuántos hay? | Ok. Volviendo a la lista, ¿cuántos hay? | Listo. Su lista tiene 2: Dolor de rodilla al subir escaleras; A veces olvido las pastillas. | 1783 | NOTICEABLE DELAY | 8580 | manageAppointmentTopics→SAVED | same view |  |
| 12 | speech | APPOINTMENT_TOPICS | El segundo cámbialo por 'se me olvidan las pastillas de la presión por la noche'. | El segundo cámbialo por 'se me olvidan las pastillas de la presión por la noche'. | Listo. Su lista tiene 2: Dolor de rodilla al subir escaleras; Se me olvidan las pastillas de la presión por la noche. | 1788 | NOTICEABLE DELAY | 11183 | manageAppointmentTopics→SAVED | same view |  |
| 13 | speech | APPOINTMENT_TOPICS | Y agrega que quiero saber si puedo caminar más. | Y agrega que quiero saber si puedo caminar más. | Listo. Su lista tiene 3: Dolor de rodilla al subir escaleras; Se me olvidan las pastillas de la presión por la noche; ¿Puedo caminar más?. | 1780 | NOTICEABLE DELAY | 12485 | manageAppointmentTopics→SAVED | same view |  |
| 14 | silence | | (silent 6000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 15 | speech | APPOINTMENT_TOPICS | ¿Sigues ahí? | ¿Sigues ahí? | Sí, aquí estoy. | 1805 | NOTICEABLE DELAY | 3070 |  | same view |  |
| 16 | speech | APPOINTMENT_TOPICS | Quita el de la rodilla. | Quita el de la rodilla. | Listo. Su lista tiene 2: Se me olvidan las pastillas de la presión por la noche; ¿Puedo caminar más?. | 1809 | NOTICEABLE DELAY | 9877 | manageAppointmentTopics→SAVED | same view |  |
| 17 | speech | APPOINTMENT_TOPICS | No, no, déjalo. Ponlo otra vez. | No, no, déjalo. Ponlo otra vez. | Listo. Su lista tiene 3: Se me olvidan las pastillas de la presión por la noche; ¿Puedo caminar más?; Dolor de rodilla al subir escaleras. | 1807 | NOTICEABLE DELAY | 12477 | manageAppointmentTopics→SAVED | same view |  |
| 18 | speech | APPOINTMENT_TOPICS | Léeme toda la lista. | Léeme toda la lista. | Listo. Su lista tiene 3: Se me olvidan las pastillas de la presión por la noche; ¿Puedo caminar más?; Dolor de rodilla al subir escaleras. | 1826 | NOTICEABLE DELAY | 12496 | manageAppointmentTopics→SAVED | same view |  |
| 19 | speech | APPOINTMENT_TOPICS | ¿A qué hora era la cita? | ¿A qué hora era la cita? | A las 2:30 p. m.. | 1786 | NOTICEABLE DELAY | 3877 | describeCurrentView→ | same view |  |
| 20 | speech | APPOINTMENT_TOPICS | Perfecto. Eso es todo, gracias EMMI. | Perfecto. Eso es todo, gracias EMMI. | Con gusto. La lista queda guardada para su cita. | 1828 | NOTICEABLE DELAY | 5601 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 18,
  "total_turns": 20,
  "response_start_p50_ms": 1786,
  "response_start_p95_ms": 1858,
  "response_start_avg_ms": 1792,
  "app_overhead_p50_ms": 2,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 4: the app sent no screen context to the provider before it answered this spoken turn"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 406 ms after tap
