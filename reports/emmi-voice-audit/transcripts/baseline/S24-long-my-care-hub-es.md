# Voice session S24-long-my-care-hub-es

- patient_profile: G (hace muchas preguntas antes de decidir)
- language: es
- flow: long: My Care hub — goals, care team, next appointment, next step, medicines, a symptom report, then into the appointment
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:20:27.437Z
- finished: 2026-09-04T01:23:44.241Z

17 spoken turns on the hub and its tools before any task: the 'general questions' half of the brief, plus a blood-pressure report that must go through the safety tool.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | speech | SCREEN_MY_CARE | ¿Qué tengo que hacer hoy? | ¿Qué tengo que hacer hoy? | No hay nada pendiente por ahora. | 1807 | NOTICEABLE DELAY | 4301 | getNextBestAction→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 2 | speech | SCREEN_MY_CARE | ¿Cuáles son mis metas? | ¿Cuáles son mis metas? | No veo metas guardadas. | 1781 | NOTICEABLE DELAY | 3456 | getPatientGoals→ | same view |  |
| 3 | speech | SCREEN_MY_CARE | ¿Quién es mi médico? | ¿Quién es mi médico? | No veo el nombre de su médico en el sistema. | 1795 | NOTICEABLE DELAY | 5959 | getCareTeam→ | same view |  |
| 4 | speech | SCREEN_MY_CARE | ¿Cuándo es mi próxima cita? | ¿Cuándo es mi próxima cita? | No veo citas próximas. | 1730 | NOTICEABLE DELAY | 3391 | getUpcomingAppointments→ | same view |  |
| 5 | speech | SCREEN_MY_CARE | ¿Y qué medicinas tengo? | ¿Y qué medicinas tengo? | No veo medicinas en su lista. | 1809 | NOTICEABLE DELAY | 4307 | getMedicationList→ | same view |  |
| 6 | speech | SCREEN_MY_CARE | Hoy me salió 150 con 95 y me duele un poco la cabeza. | Hoy me salió 150 con 95 y me duele un poco la cabeza. | Gracias por decírmelo. Voy a avisar a su equipo de cuidado para que lo revise. | 1815 | NOTICEABLE DELAY | 8136 | evaluateClinicalEscalation→ | same view |  |
| 7 | speech | SCREEN_MY_CARE | ¿Eso es grave? | ¿Eso es grave? | No es una emergencia, pero su equipo debe verlo. Si aparece dolor de pecho, dificultad para respirar o confusión, llame al 911. | 1778 | NOTICEABLE DELAY | 11069 |  | same view |  |
| 8 | speech | SCREEN_MY_CARE | Ok. ¿Qué hay en esta pantalla? | Ok. ¿Qué hay en esta pantalla? | Su inscripción está completa. Continúe cuando esté listo. | 1841 | NOTICEABLE DELAY | 5168 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 9 | speech | SCREEN_MY_CARE | Abre mi cita. | Abre mi cita. | Aquí puede continuar. | 1796 | NOTICEABLE DELAY | 3048 | performViewAction→SCREEN_NOT_DESCRIBED | same view | expected view APPOINTMENT, got SCREEN_MY_CARE |
| 10 | speech | SCREEN_MY_CARE | ¿Dónde es? | ¿Dónde es? | No veo el lugar. | 1764 | NOTICEABLE DELAY | 3435 | describeCurrentView→ | same view |  |
| 11 | speech | SCREEN_MY_CARE | ¿Y cómo llego? | ¿Y cómo llego? | Puedo buscarle transporte, o si prefiere, decirle la dirección para que la comparta con quien le lleve. ¿Qué prefiere? | 1796 | NOTICEABLE DELAY | 9791 |  | same view |  |
| 12 | speech | SCREEN_MY_CARE | Dime la dirección nada más. | Dime la dirección nada más. | No veo el lugar. | 1832 | NOTICEABLE DELAY | 3503 | describeCurrentView→ | same view |  |
| 13 | speech | SCREEN_MY_CARE | ¿Me lo puedes repetir más despacio? | ¿Me lo puedes repetir más despacio? | No veo el lugar. | 1719 | NOTICEABLE DELAY | 3390 | describeCurrentView→ | same view |  |
| 14 | speech | SCREEN_MY_CARE | Bueno. ¿Y lo del monitor de presión, cuándo llega? | Bueno. ¿Y lo del monitor de presión, cuándo llega? | No veo un monitor asignado. | 1789 | NOTICEABLE DELAY | 3871 | getAssignedDevice→ | same view |  |
| 15 | speech | SCREEN_MY_CARE | Vale. Volvamos a la cita. ¿A qué hora? | Vale. Volvamos a la cita. ¿A qué hora? | No veo la hora. | 1826 | NOTICEABLE DELAY | 3492 | describeCurrentView→ | same view |  |
| 16 | speech | SCREEN_MY_CARE | Recuérdamelo el día antes. | Recuérdamelo el día antes. | Puedo guardar un recordatorio dentro de ITERA para el día anterior. ¿Lo guardo? | 1784 | NOTICEABLE DELAY | 7225 |  | same view |  |
| 17 | speech | SCREEN_MY_CARE | Sí. | Sí. | Listo, le recordaré 2026-09-06T14:30:00.000Z dentro de ITERA. | 1797 | NOTICEABLE DELAY | 4713 | createAppointmentReminder→true | same view |  |
| 18 | speech | SCREEN_MY_CARE | Gracias, muy amable. | Gracias, muy amable. | Con gusto. Aquí estoy cuando me necesite. | 1791 | NOTICEABLE DELAY | 4711 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 18,
  "total_turns": 18,
  "response_start_p50_ms": 1795,
  "response_start_p95_ms": 1841,
  "response_start_avg_ms": 1792,
  "app_overhead_p50_ms": 5,
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

- voice start: state EMMI_SPEAKING, socket true, error "", 1008 ms after tap
