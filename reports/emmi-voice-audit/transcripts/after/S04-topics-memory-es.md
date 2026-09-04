# Voice session S04-topics-memory-es

- patient_profile: B (habla mucho, información desordenada)
- language: es
- flow: appointment topics: anaphora, corrections, list editing
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:14:18.621Z
- finished: 2026-09-04T01:18:16.568Z

Conversation memory through the visit list: 'son' → los mareos; 'la lista'; 'quita el último'.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Mire, quiero preguntarle al médico por mis mareos, porque llevo como dos semanas así, sobre todo cuando me levanto, y mi hija dice que es la presión pero yo no sé. | Mire, quiero preguntarle al médico por mis mareos, porque llevo como dos semanas así, sobre todo cuando me levanto, y mi hija dice que es la presión pero yo no sé. | Anotado: mareos desde hace dos semanas. Si en algún momento se siente muy mareado o se cae, llame a su equipo de cuidado. ¿Algo más para la visita? | 1893 | NOTICEABLE DELAY | 13740 | performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → APPOINTMENT_TOPICS |  |
| 3 | speech | APPOINTMENT_TOPICS | Pon que son sobre todo por la mañana. | Pon que son sobre todo por la mañana. | Listo. Su lista tiene 1: Mareos desde hace dos semanas: sobre todo por la mañana. | 1820 | NOTICEABLE DELAY | 8090 | manageAppointmentTopics→SAVED | same view |  |
| 4 | speech | APPOINTMENT_TOPICS | Ah, y también lo de la rodilla, que me duele al subir escaleras, y lo de las pastillas de la presión que a veces se me olvidan. | Ah, y también lo de la rodilla, que me duele al subir escaleras, y lo de las pastillas de la presión que a veces se me olvidan. | Listo. Su lista tiene 3: Mareos desde hace dos semanas: sobre todo por la mañana; Dolor de rodilla al subir escaleras; A veces olvido las pastillas de la presión. | 1805 | NOTICEABLE DELAY | 14040 | manageAppointmentTopics→SAVED; manageAppointmentTopics→SAVED | same view |  |
| 5 | speech | APPOINTMENT_TOPICS | Enséñame la lista. | Enséñame la lista. | Listo. Su lista tiene 3: Mareos desde hace dos semanas: sobre todo por la mañana; Dolor de rodilla al subir escaleras; A veces olvido las pastillas de la presión. | 1835 | NOTICEABLE DELAY | 14147 | manageAppointmentTopics→SAVED | same view |  |
| 6 | speech | APPOINTMENT_TOPICS | Quita el último. | Quita el último. | Listo. Su lista tiene 2: Mareos desde hace dos semanas: sobre todo por la mañana; Dolor de rodilla al subir escaleras. | 1844 | NOTICEABLE DELAY | 10707 | manageAppointmentTopics→SAVED | same view |  |
| 7 | speech | APPOINTMENT_TOPICS | No, me equivoqué. Ponlo otra vez. | No, me equivoqué. Ponlo otra vez. | Listo. Su lista tiene 3: Mareos desde hace dos semanas: sobre todo por la mañana; Dolor de rodilla al subir escaleras; A veces olvido las pastillas de la presión. | 1776 | NOTICEABLE DELAY | 14085 | manageAppointmentTopics→SAVED | same view |  |
| 8 | speech | APPOINTMENT_TOPICS | ¿Cuál es el primero? | ¿Cuál es el primero? | Dice: Mareos desde hace dos semanas: sobre todo por la mañana. | 1849 | NOTICEABLE DELAY | 6443 | manageAppointmentTopics→SAVED | same view |  |
| 9 | speech | APPOINTMENT_TOPICS | Cambia ese por 'mareos al levantarme'. | Cambia ese por 'mareos al levantarme'. | Listo. Su lista tiene 3: Mareos al levantarme, sobre todo por la mañana; Dolor de rodilla al subir escaleras; A veces olvido las pastillas de la presión. | 1857 | NOTICEABLE DELAY | 13288 | manageAppointmentTopics→SAVED | same view |  |
| 10 | speech | APPOINTMENT_TOPICS | Por cierto, ¿qué es ACCESS? | Por cierto, ¿qué es ACCESS? | ACCESS es una opción de cuidado de Medicare que le da apoyo adicional entre visitas al médico; sus médicos siguen siendo los mismos. | 1782 | NOTICEABLE DELAY | 11507 |  | same view |  |
| 11 | speech | APPOINTMENT_TOPICS | Bueno, volvamos a la lista. ¿Qué tenemos? | Bueno, volvamos a la lista. ¿Qué tenemos? | Listo. Su lista tiene 3: Mareos al levantarme, sobre todo por la mañana; Dolor de rodilla al subir escaleras; A veces olvido las pastillas de la presión. | 1864 | NOTICEABLE DELAY | 13308 | manageAppointmentTopics→SAVED | same view |  |
| 12 | speech | APPOINTMENT_TOPICS | Déjalo así. | Déjalo así. | Perfecto, la lista queda guardada para su cita con el doctor Fresner Lee. | 1824 | NOTICEABLE DELAY | 7283 |  | same view |  |
| 13 | speech | APPOINTMENT_TOPICS | ¿Ya terminamos? | ¿Ya terminamos? | Agregue lo que quiera conversar en esta visita. Puedo agregar un tema si me dice cuál es. | 1850 | NOTICEABLE DELAY | 9019 | describeCurrentView→ | same view |  |

## Summary

```json
{
  "spoken_turns": 12,
  "total_turns": 13,
  "response_start_p50_ms": 1835,
  "response_start_p95_ms": 1893,
  "response_start_avg_ms": 1833,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": []
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 1021 ms after tap
