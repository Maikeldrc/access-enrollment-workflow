# Voice session S05-reschedule-change-of-mind-es

- patient_profile: D (cambia de opinión)
- language: es
- flow: reschedule: slots, 'la del jueves', retraction
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T19:44:26.867Z
- finished: 2026-09-04T19:47:15.571Z

The patient asks to move the visit, picks 'la del jueves', then decides not to change it.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Quiero cambiar mi cita al jueves. | Quiero cambiar mi cita al jueves. | Voy a buscar otros horarios con el doctor Fresner Lee. La cita actual no cambia hasta que usted confirme. | 1867 | NOTICEABLE DELAY | 9944 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_RESCHEDULE_SLOTS |  |
| 3 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 4 | speech | BARRIER_RESCHEDULE_SLOTS | ¿Qué horarios hay? | ¿Qué horarios hay? | Hay 5 horarios. lunes, 7 de septiembre · 2:45 p. m.; miércoles, 9 de septiembre · 6:45 p. m.; jueves, 10 de septiembre · 9:15 a. m.. ¿Cuál prefiere? | 1827 | NOTICEABLE DELAY | 14283 | describeCurrentView→ | same view |  |
| 5 | speech | BARRIER_RESCHEDULE_SLOTS | Antes, ¿esto cuesta dinero? | Antes, ¿esto cuesta dinero? | Cambiar la cita no tiene costo. Su pago esperado por ACCESS no cambia. | 1776 | NOTICEABLE DELAY | 7315 |  | same view |  |
| 6 | speech | BARRIER_RESCHEDULE_SLOTS | Ok. ¿Qué horarios me dijiste? | Ok. ¿Qué horarios me dijiste? | Le mencioné lunes, 7 de septiembre · 2:45 p. m.; miércoles, 9 de septiembre · 6:45 p. m.; jueves, 10 de septiembre · 9:15 a. m.. | 1766 | NOTICEABLE DELAY | 12885 | describeCurrentView→ | same view |  |
| 7 | speech | BARRIER_RESCHEDULE_SLOTS | La del jueves. | La del jueves. | No veo ninguna el jueves. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 7084 | VERY POOR | 13051 | describeCurrentView→ | same view | response start 7084 ms |
| 8 | speech | BARRIER_RESCHEDULE_SLOTS | Esa. | Esa. | Elegí jueves, 10 de septiembre · 9:15 a. m.. La cita todavía no cambia hasta que confirme. | 1791 | NOTICEABLE DELAY | 9027 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_RESCHEDULE_SLOTS → BARRIER_RESCHEDULE_REVIEW |  |
| 9 | speech | BARRIER_RESCHEDULE_REVIEW | Mejor no quiero cambiarla. | Mejor no quiero cambiarla. | De acuerdo, no cambio nada. Su cita sigue como estaba: . ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 9861 | VERY POOR | 15835 | performViewAction→ | same view | response start 9861 ms |
| 10 | speech | BARRIER_RESCHEDULE_REVIEW | ¿Seguro que no cambió nada? | ¿Seguro que no cambió nada? | Seguro. Doctor: Dr. Fresner Lee, Fecha: lunes, 7 de septiembre, Hora: 2:30 p. m., Dónde: Fresner Medical Group. | 1800 | NOTICEABLE DELAY | 9488 | describeCurrentView→ | same view |  |
| 11 | speech | BARRIER_RESCHEDULE_REVIEW | Gracias, eso es todo. | Gracias, eso es todo. | Con gusto. Aquí estaré. | 1810 | NOTICEABLE DELAY | 3479 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 9,
  "total_turns": 11,
  "response_start_p50_ms": 1810,
  "response_start_p95_ms": 9861,
  "response_start_avg_ms": 3287,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 2,
  "problems": [
    "turn 7: response start 7084 ms",
    "turn 9: response start 9861 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 805 ms after tap
