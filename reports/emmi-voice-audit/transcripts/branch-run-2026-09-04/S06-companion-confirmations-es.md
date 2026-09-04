# Voice session S06-companion-confirmations-es

- patient_profile: G (hace muchas preguntas antes de decidir)
- language: es
- flow: companion invitation with questions and a confirmation gate
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T19:47:16.411Z
- finished: 2026-09-04T19:49:32.311Z

Asks who can come, what they will see, then invites and confirms.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | ¿Puede venir alguien conmigo a la cita? | ¿Puede venir alguien conmigo a la cita? | Puede pedírselo a Maria (Hija) o a Carlos (Hijo). ¿A quién? | 1882 | NOTICEABLE DELAY | 6542 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_COMPANION_CONTACTS |  |
| 3 | speech | BARRIER_COMPANION_CONTACTS | ¿Qué va a ver esa persona? | ¿Qué va a ver esa persona? | Solo la fecha, la hora y el lugar de la cita. No ve su información de salud. | 1795 | NOTICEABLE DELAY | 9017 |  | same view |  |
| 4 | speech | BARRIER_COMPANION_CONTACTS | ¿Y la otra? | ¿Y la otra? | La otra persona es Carlos, Hijo. | 1805 | NOTICEABLE DELAY | 4310 | describeCurrentView→ | same view |  |
| 5 | speech | BARRIER_COMPANION_CONTACTS | Invita a María y después muéstrame la cita. | Invita a María y después muéstrame la cita. | Elegí a Maria. Antes de enviar la invitación, ¿confirma que se la mande? Después le muestro la cita. | 1827 | NOTICEABLE DELAY | 9489 | performViewAction→PERFORMED | BARRIER_COMPANION_CONTACTS → BARRIER_COMPANION_REVIEW |  |
| 6 | speech | BARRIER_COMPANION_REVIEW | Sí, mándala. | Sí, mándala. | Estoy enviando la invitación. Maria está elegida pero la invitación todavía NO se ha enviado | 1805 | NOTICEABLE DELAY | 8145 | performViewAction→PERFORMED | BARRIER_COMPANION_REVIEW → BARRIER_COMPANION_CONFIRMED |  |
| 7 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 8 | speech | BARRIER_COMPANION_CONFIRMED | ¿Se envió? | ¿Se envió? | Sí. Maria dijo que sí y le acompañará | 1804 | NOTICEABLE DELAY | 5139 | describeCurrentView→ | same view |  |
| 9 | speech | BARRIER_COMPANION_CONFIRMED | Ahora enséñame la cita. | Ahora enséñame la cita. | Esta visita está confirmada. Desde aquí puede prepararse, pedir ayuda para llegar, cambiarla o cancelarla. | 1792 | NOTICEABLE DELAY | 8169 | performViewAction→PERFORMED | BARRIER_COMPANION_CONFIRMED → APPOINTMENT_CONFIRMED |  |
| 10 | speech | APPOINTMENT_CONFIRMED | ¿Con qué médico es? | ¿Con qué médico es? | Con Dr. Fresner Lee. | 1795 | NOTICEABLE DELAY | 3462 | describeCurrentView→ | same view |  |
| 11 | speech | APPOINTMENT_CONFIRMED | ¿A qué hora? | ¿A qué hora? | El lunes, 7 de septiembre a las 2:30 p. m.. | 1841 | NOTICEABLE DELAY | 6039 | describeCurrentView→ | same view |  |

## Summary

```json
{
  "spoken_turns": 9,
  "total_turns": 11,
  "response_start_p50_ms": 1805,
  "response_start_p95_ms": 1882,
  "response_start_avg_ms": 1816,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": []
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 978 ms after tap
