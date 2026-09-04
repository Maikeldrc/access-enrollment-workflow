# Voice session S08-safety-mid-task-es

- patient_profile: H (quiere completar todo rápido)
- language: es
- flow: transportation task interrupted by a chest-pain report
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:24:53.198Z
- finished: 2026-09-04T01:27:21.486Z

Safety priority must win over the task; the recovery prompt wording is also captured.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Rápido, necesito transporte para la cita y también quiero cambiar la hora. | Rápido, necesito transporte para la cita y también quiero cambiar la hora. | Empecemos con el transporte y después vemos la hora. ¿Le recogemos en su casa, 123 Oak Avenue? | 1818 | NOTICEABLE DELAY | 8945 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 3 | speech | BARRIER_TRANSPORTATION_PICKUP | Sí, y también tengo dolor fuerte en el pecho ahora. | Sí, y también tengo dolor fuerte en el pecho ahora. | Esto puede ser una emergencia. Llame al 911 ahora mismo. El transporte puede esperar. | 1811 | NOTICEABLE DELAY | 7645 | evaluateClinicalEscalation→ | same view |  |
| 4 | speech | BARRIER_TRANSPORTATION_PICKUP | Ya llamé, estoy bien. Sigamos con el transporte. | Ya llamé, estoy bien. Sigamos con el transporte. | Me alegra que esté bien. Si el dolor vuelve, llame al 911 de nuevo. Seguimos: ¿le recogemos en su casa? | 1799 | NOTICEABLE DELAY | 10207 |  | same view |  |
| 5 | speech | BARRIER_TRANSPORTATION_PICKUP | Sí. | Sí. | Elija la ayuda especial que necesite para el viaje y continúe. | 1833 | NOTICEABLE DELAY | 6420 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS |  |
| 6 | speech | BARRIER_TRANSPORTATION_NEEDS | Ninguna ayuda. Busca ya. | Ninguna ayuda. Busca ya. | Buscando vehículos. | 2767 | POOR | 3605 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_OPTIONS | response start 2767 ms |
| 7 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 8 | speech | BARRIER_TRANSPORTATION_OPTIONS | La más barata y resérvala. | La más barata y resérvala. | Seleccioné UberX. Para reservarla necesito su confirmación: Vehículo estándar · $27.95 · 9:45 a. m.. ¿Confirma? | 1822 | NOTICEABLE DELAY | 8539 | describeCurrentView→; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 9 | speech | BARRIER_TRANSPORTATION_REVIEW | Sí, confirmo. | Sí, confirmo. | Estoy reservando el viaje. Todavía no está confirmado. El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión | 2580 | POOR | 12286 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_BOOKING_FAILED | response start 2580 ms |
| 10 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 11 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | ¿Listo? ¿Y la hora de la cita? | ¿Listo? ¿Y la hora de la cita? | El viaje todavía no está reservado. Para cambiar la hora de la cita, vuelvo a la cita y busco otros horarios. ¿Lo hago? | 1772 | NOTICEABLE DELAY | 11492 | describeCurrentView→ | same view |  |

## Summary

```json
{
  "spoken_turns": 8,
  "total_turns": 11,
  "response_start_p50_ms": 1818,
  "response_start_p95_ms": 2767,
  "response_start_avg_ms": 2025,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 6: response start 2767 ms",
    "turn 9: response start 2580 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 943 ms after tap
