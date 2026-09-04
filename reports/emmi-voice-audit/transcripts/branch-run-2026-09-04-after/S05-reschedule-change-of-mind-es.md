# Voice session S05-reschedule-change-of-mind-es

- patient_profile: D (cambia de opinión)
- language: es
- flow: reschedule: slots, 'la del jueves', retraction
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T21:14:34.330Z
- finished: 2026-09-04T21:16:56.778Z

The patient asks to move the visit, picks 'la del jueves', then decides not to change it.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Quiero cambiar mi cita al jueves. | Quiero cambiar mi cita al jueves. | Voy a buscar otros horarios con el doctor Fresner Lee. La cita actual no cambia hasta que usted confirme. | 2920 | POOR | 10973 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_RESCHEDULE_SLOTS | response start 2920 ms |
| 3 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 4 | speech | BARRIER_RESCHEDULE_SLOTS | ¿Qué horarios hay? | ¿Qué horarios hay? | Hay 5 horarios. lunes, 7 de septiembre · 2:45 p. m.; miércoles, 9 de septiembre · 6:45 p. m.; jueves, 10 de septiembre · 9:15 a. m.. ¿Cuál prefiere? | 1800 | NOTICEABLE DELAY | 14215 | describeCurrentView→ | same view |  |
| 5 | speech | BARRIER_RESCHEDULE_SLOTS | Antes, ¿esto cuesta dinero? | Antes, ¿esto cuesta dinero? | Cambiar la cita no tiene costo. Su pago esperado por ACCESS no cambia. | 1833 | NOTICEABLE DELAY | 7319 |  | same view |  |
| 6 | speech | BARRIER_RESCHEDULE_SLOTS | Ok. ¿Qué horarios me dijiste? | Ok. ¿Qué horarios me dijiste? | Le mencioné lunes, 7 de septiembre · 2:45 p. m.; miércoles, 9 de septiembre · 6:45 p. m.; jueves, 10 de septiembre · 9:15 a. m.. | 1754 | NOTICEABLE DELAY | 12915 | describeCurrentView→ | same view |  |
| 7 | speech | BARRIER_RESCHEDULE_SLOTS | La del jueves. | La del jueves. | La del jueves es jueves, 10 de septiembre · 9:15 a. m.. | 1798 | NOTICEABLE DELAY | 6857 | describeCurrentView→ | same view |  |
| 8 | speech | BARRIER_RESCHEDULE_SLOTS | Esa. | Esa. | Elegí jueves, 10 de septiembre · 9:15 a. m.. La cita todavía no cambia hasta que confirme. | 1776 | NOTICEABLE DELAY | 8982 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_RESCHEDULE_SLOTS → BARRIER_RESCHEDULE_REVIEW |  |
| 9 | speech | BARRIER_RESCHEDULE_REVIEW | Mejor no quiero cambiarla. | Mejor no quiero cambiarla. | De acuerdo, no cambio nada. Su cita sigue como estaba: lunes, 7 de septiembre, 2:30 p. m.. | 1812 | NOTICEABLE DELAY | 9055 | performViewAction→PERFORMED | BARRIER_RESCHEDULE_REVIEW → BARRIER_RESCHEDULE_SLOTS |  |
| 10 | speech | BARRIER_RESCHEDULE_SLOTS | ¿Seguro que no cambió nada? | ¿Seguro que no cambió nada? | Seguro. Doctor: Dr. Fresner Lee, Fecha: lunes, 7 de septiembre, Hora: 2:30 p. m., Dónde: Fresner Medical Group. | 1814 | NOTICEABLE DELAY | 9421 | describeCurrentView→ | same view |  |
| 11 | speech | BARRIER_RESCHEDULE_SLOTS | Gracias, eso es todo. | Gracias, eso es todo. | Con gusto. Aquí estaré. | 1816 | NOTICEABLE DELAY | 3482 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 9,
  "total_turns": 11,
  "response_start_p50_ms": 1812,
  "response_start_p95_ms": 2920,
  "response_start_avg_ms": 1925,
  "app_overhead_p50_ms": 3,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 2: response start 2920 ms"
  ]
}
```

## Observations

- voice start: state EMMI_THINKING, socket true, error "", 821 ms after tap
