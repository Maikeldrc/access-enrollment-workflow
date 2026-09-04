# Voice session S05-reschedule-change-of-mind-es

- patient_profile: D (cambia de opinión)
- language: es
- flow: reschedule: slots, 'la del jueves', retraction
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T05:03:08.542Z
- finished: 2026-09-04T05:05:43.444Z

The patient asks to move the visit, picks 'la del jueves', then decides not to change it.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Quiero cambiar mi cita al jueves. | Quiero cambiar mi cita al jueves. | Voy a buscar otros horarios con el doctor Fresner Lee. La cita actual no cambia hasta que usted confirme. | 2891 | POOR | 10870 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_RESCHEDULE_SLOTS | response start 2891 ms |
| 3 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 4 | speech | BARRIER_RESCHEDULE_SLOTS | ¿Qué horarios hay? | ¿Qué horarios hay? | Hay 5 horarios. lunes, 7 de septiembre · 10:45 a. m.; miércoles, 9 de septiembre · 2:45 p. m.; jueves, 10 de septiembre · 5:15 a. m.. ¿Cuál prefiere? | 1822 | NOTICEABLE DELAY | 14055 | describeCurrentView→ | same view |  |
| 5 | speech | BARRIER_RESCHEDULE_SLOTS | Antes, ¿esto cuesta dinero? | Antes, ¿esto cuesta dinero? | Cambiar la cita no tiene costo. Su pago esperado por ACCESS no cambia. | 1797 | NOTICEABLE DELAY | 7219 |  | same view |  |
| 6 | speech | BARRIER_RESCHEDULE_SLOTS | Ok. ¿Qué horarios me dijiste? | Ok. ¿Qué horarios me dijiste? | Le mencioné lunes, 7 de septiembre · 10:45 a. m.; miércoles, 9 de septiembre · 2:45 p. m.; jueves, 10 de septiembre · 5:15 a. m.. | 1775 | NOTICEABLE DELAY | 12744 | describeCurrentView→ | same view |  |
| 7 | speech | BARRIER_RESCHEDULE_SLOTS | La del jueves. | La del jueves. | La del jueves es jueves, 10 de septiembre · 5:15 a. m.. | 1814 | NOTICEABLE DELAY | 6825 | describeCurrentView→ | same view |  |
| 8 | speech | BARRIER_RESCHEDULE_SLOTS | Esa. | Esa. | Elegí jueves, 10 de septiembre · 5:15 a. m.. La cita todavía no cambia hasta que confirme. | 1798 | NOTICEABLE DELAY | 8945 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_RESCHEDULE_SLOTS → BARRIER_RESCHEDULE_REVIEW |  |
| 9 | speech | BARRIER_RESCHEDULE_REVIEW | Mejor no quiero cambiarla. | Mejor no quiero cambiarla. | De acuerdo, no cambio nada. Su cita sigue como estaba: lunes, 7 de septiembre, 10:30 a. m.. | 1834 | NOTICEABLE DELAY | 8988 | performViewAction→PERFORMED | BARRIER_RESCHEDULE_REVIEW → BARRIER_RESCHEDULE_SLOTS |  |
| 10 | speech | BARRIER_RESCHEDULE_SLOTS | ¿Seguro que no cambió nada? | ¿Seguro que no cambió nada? | Seguro. Doctor: Dr. Fresner Lee, Fecha: lunes, 7 de septiembre, Hora: 10:30 a. m., Dónde: Fresner Medical Group. | 1849 | NOTICEABLE DELAY | 9438 | describeCurrentView→ | same view |  |
| 11 | speech | BARRIER_RESCHEDULE_SLOTS | Gracias, eso es todo. | Gracias, eso es todo. | Con gusto. Aquí estaré. | 1799 | NOTICEABLE DELAY | 3476 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 9,
  "total_turns": 11,
  "response_start_p50_ms": 1814,
  "response_start_p95_ms": 2891,
  "response_start_avg_ms": 1931,
  "app_overhead_p50_ms": 3,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 2: response start 2891 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 919 ms after tap
