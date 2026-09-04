# Voice session S24-long-my-care-hub-es

- patient_profile: G (hace muchas preguntas antes de decidir)
- language: es
- flow: long: My Care hub — goals, care team, next appointment, next step, medicines, a symptom report, then into the appointment
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T22:02:08.742Z
- finished: 2026-09-04T22:05:11.909Z

17 spoken turns on the hub and its tools before any task: the 'general questions' half of the brief, plus a blood-pressure report that must go through the safety tool.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | speech | SCREEN_MY_CARE | ¿Qué tengo que hacer hoy? | ¿Qué tengo que hacer hoy? | No hay nada pendiente por ahora. | 1802 | NOTICEABLE DELAY | 4296 | getNextBestAction→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 2 | speech | SCREEN_MY_CARE | ¿Cuáles son mis metas? | ¿Cuáles son mis metas? | No veo metas guardadas. | 1814 | NOTICEABLE DELAY | 3481 | getPatientGoals→ | same view |  |
| 3 | speech | SCREEN_MY_CARE | ¿Quién es mi médico? | ¿Quién es mi médico? | No veo el nombre de su médico en el sistema. | 1771 | NOTICEABLE DELAY | 5983 | getCareTeam→ | same view |  |
| 4 | speech | SCREEN_MY_CARE | ¿Cuándo es mi próxima cita? | ¿Cuándo es mi próxima cita? | No veo citas próximas. | 1776 | NOTICEABLE DELAY | 3439 | getUpcomingAppointments→ | same view |  |
| 5 | speech | SCREEN_MY_CARE | ¿Y qué medicinas tengo? | ¿Y qué medicinas tengo? | No veo medicinas en su lista. | 1841 | NOTICEABLE DELAY | 4339 | getMedicationList→ | same view |  |
| 6 | speech | SCREEN_MY_CARE | Hoy me salió 150 con 95 y me duele un poco la cabeza. | Hoy me salió 150 con 95 y me duele un poco la cabeza. | Gracias por decírmelo. Voy a avisar a su equipo de cuidado para que lo revise. | 1838 | NOTICEABLE DELAY | 8189 | evaluateClinicalEscalation→ | same view |  |
| 7 | speech | SCREEN_MY_CARE | ¿Eso es grave? | ¿Eso es grave? | No es una emergencia, pero su equipo debe verlo. Si aparece dolor de pecho, dificultad para respirar o confusión, llame al 911. | 1824 | NOTICEABLE DELAY | 11181 |  | same view |  |
| 8 | speech | SCREEN_MY_CARE | Ok. ¿Qué hay en esta pantalla? | Ok. ¿Qué hay en esta pantalla? | Su inscripción está completa. Continúe cuando esté listo. | 1787 | NOTICEABLE DELAY | 5160 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 9 | speech | SCREEN_MY_CARE | Abre mi cita. | Abre mi cita. | Aquí puede continuar. | 1794 | NOTICEABLE DELAY | 3038 | performViewAction→SCREEN_NOT_DESCRIBED | same view | expected view APPOINTMENT, got SCREEN_MY_CARE |
| 10 | speech | SCREEN_MY_CARE | ¿Dónde es? | ¿Dónde es? | No veo el lugar. | 1748 | NOTICEABLE DELAY | 3416 | describeCurrentView→ | same view |  |
| 11 | speech | SCREEN_MY_CARE | ¿Y cómo llego? | ¿Y cómo llego? | Puedo buscarle transporte, o si prefiere, decirle la dirección para que la comparta con quien le lleve. ¿Qué prefiere? | 1790 | NOTICEABLE DELAY | 9867 |  | same view |  |
| 12 | speech | SCREEN_MY_CARE | Dime la dirección nada más. | Dime la dirección nada más. | No veo el lugar. | 1831 | NOTICEABLE DELAY | 3505 | describeCurrentView→ | same view |  |
| 13 | speech | SCREEN_MY_CARE | ¿Me lo puedes repetir más despacio? | ¿Me lo puedes repetir más despacio? | No veo el lugar. | 1722 | NOTICEABLE DELAY | 3387 | describeCurrentView→ | same view |  |
| 14 | speech | SCREEN_MY_CARE | Bueno. ¿Y lo del monitor de presión, cuándo llega? | Bueno. ¿Y lo del monitor de presión, cuándo llega? | No veo un monitor asignado. | 1777 | NOTICEABLE DELAY | 3862 | getAssignedDevice→ | same view |  |
| 15 | speech | SCREEN_MY_CARE | Vale. Volvamos a la cita. ¿A qué hora? | Vale. Volvamos a la cita. ¿A qué hora? | No veo la hora. | 1786 | NOTICEABLE DELAY | 3455 | describeCurrentView→ | same view |  |
| 16 | speech | SCREEN_MY_CARE | Recuérdamelo el día antes. | Recuérdamelo el día antes. | Puedo guardar un recordatorio dentro de ITERA para el día anterior. ¿Lo guardo? | 1811 | NOTICEABLE DELAY | 7303 |  | same view |  |
| 17 | speech | SCREEN_MY_CARE | Sí. | Sí. | Listo, le recordaré 2026-09-06T18:30:00.000Z dentro de ITERA. | 1790 | NOTICEABLE DELAY | 4714 | createAppointmentReminder→true | same view |  |
| 18 | speech | SCREEN_MY_CARE | Gracias, muy amable. | Gracias, muy amable. | Con gusto. Aquí estoy cuando me necesite. | 1750 | NOTICEABLE DELAY | 4675 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 18,
  "total_turns": 18,
  "response_start_p50_ms": 1790,
  "response_start_p95_ms": 1841,
  "response_start_avg_ms": 1792,
  "app_overhead_p50_ms": 2,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 1: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 8: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 9: expected view APPOINTMENT, got SCREEN_MY_CARE"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 412 ms after tap
