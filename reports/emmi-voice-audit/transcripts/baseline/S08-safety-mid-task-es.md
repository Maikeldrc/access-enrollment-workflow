# Voice session S08-safety-mid-task-es

- patient_profile: H (quiere completar todo rápido)
- language: es
- flow: transportation task interrupted by a chest-pain report
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T00:22:28.543Z
- finished: 2026-09-04T00:24:56.427Z

Safety priority must win over the task; the recovery prompt wording is also captured.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Rápido, necesito transporte para la cita y también quiero cambiar la hora. | Rápido, necesito transporte para la cita y también quiero cambiar la hora. | Empecemos con el transporte y después vemos la hora. ¿Le recogemos en su casa, 123 Oak Avenue? | 1857 | NOTICEABLE DELAY | 9055 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 3 | speech | BARRIER_TRANSPORTATION_PICKUP | Sí, y también tengo dolor fuerte en el pecho ahora. | Sí, y también tengo dolor fuerte en el pecho ahora. | Esto puede ser una emergencia. Llame al 911 ahora mismo. El transporte puede esperar. | 1848 | NOTICEABLE DELAY | 7774 | evaluateClinicalEscalation→ | same view |  |
| 4 | speech | BARRIER_TRANSPORTATION_PICKUP | Ya llamé, estoy bien. Sigamos con el transporte. | Ya llamé, estoy bien. Sigamos con el transporte. | Me alegra que esté bien. Si el dolor vuelve, llame al 911 de nuevo. Seguimos: ¿le recogemos en su casa? | 1810 | NOTICEABLE DELAY | 10242 |  | same view |  |
| 5 | speech | BARRIER_TRANSPORTATION_PICKUP | Sí. | Sí. | Elija la ayuda especial que necesite para el viaje y continúe. | 1888 | NOTICEABLE DELAY | 6499 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS |  |
| 6 | speech | BARRIER_TRANSPORTATION_NEEDS | Ninguna ayuda. Busca ya. | Ninguna ayuda. Busca ya. | Buscando vehículos. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 3087 | POOR | 12091 | performViewAction→; performViewAction→; performViewAction→ | same view | response start 3087 ms |
| 7 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 8 | speech | BARRIER_TRANSPORTATION_NEEDS | La más barata y resérvala. | La más barata y resérvala. | Seleccioné No, ninguna. Para reservarla necesito su confirmación: . ¿Confirma? | 1875 | NOTICEABLE DELAY | 6044 | describeCurrentView→; performViewAction→PERFORMED | same view |  |
| 9 | speech | BARRIER_TRANSPORTATION_NEEDS | Sí, confirmo. | Sí, confirmo. | Estoy reservando el viaje. Todavía no está confirmado.  | 1821 | NOTICEABLE DELAY | 5150 | performViewAction→UNKNOWN_ACTION | same view |  |
| 10 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 11 | speech | BARRIER_TRANSPORTATION_NEEDS | ¿Listo? ¿Y la hora de la cita? | ¿Listo? ¿Y la hora de la cita? | El viaje todavía no está reservado. Para cambiar la hora de la cita, vuelvo a la cita y busco otros horarios. ¿Lo hago? | 1775 | NOTICEABLE DELAY | 11535 | describeCurrentView→ | same view |  |

## Summary

```json
{
  "spoken_turns": 8,
  "total_turns": 11,
  "response_start_p50_ms": 1848,
  "response_start_p95_ms": 3087,
  "response_start_avg_ms": 1995,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 1,
  "problems": [
    "turn 6: response start 3087 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 900 ms after tap
