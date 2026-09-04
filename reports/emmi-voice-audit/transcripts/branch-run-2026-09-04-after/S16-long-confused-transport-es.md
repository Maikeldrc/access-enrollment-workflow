# Voice session S16-long-confused-transport-es

- patient_profile: C (se confunde fácilmente)
- language: es
- flow: long: appointment → transportation with repeated 'no entendí', repetition requests, known data, a cost question mid-task, booking, return ride declined
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T21:33:34.333Z
- finished: 2026-09-04T21:37:48.944Z

21 spoken turns. Backchannels ('Ajá', 'Mm'), 'no entendí', '¿qué me dijiste?', 'más despacio', a question about data the app already has, and a general question in the middle of the task.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Hola, ¿me escucha? | Hola, ¿me escucha? | Sí, le escucho bien. ¿En qué le ayudo? | 1790 | NOTICEABLE DELAY | 5128 |  | same view |  |
| 3 | speech | APPOINTMENT_CONFIRMED | Es que mi hija me dijo que tenía que hacer algo con la cita pero no sé qué. | Es que mi hija me dijo que tenía que hacer algo con la cita pero no sé qué. | Esta visita está confirmada. Desde aquí puede prepararse, pedir ayuda para llegar, cambiarla o cancelarla. | 1789 | NOTICEABLE DELAY | 8132 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 4 | speech | APPOINTMENT_CONFIRMED | ¿Eh? No entendí. | ¿Eh? No entendí. | Le explico más sencillo: esta pantalla es su cita del domingo con el doctor Fresner Lee. Puede revisarla, o decirme si algo la dificulta, como el transporte. | 1847 | NOTICEABLE DELAY | 13385 |  | same view |  |
| 5 | speech | APPOINTMENT_CONFIRMED | Ah, ya. Es que no tengo quien me lleve. | Ah, ya. Es que no tengo quien me lleve. | Podemos buscarle transporte. ¿Le recogemos en su casa, 123 Oak Avenue, Apt 4B · Miami, FL 33176? | 1855 | NOTICEABLE DELAY | 9062 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 6 | speech | BARRIER_TRANSPORTATION_PICKUP | ¿Ustedes tienen mi dirección? | ¿Ustedes tienen mi dirección? | Sí, tenemos su dirección: 123 Oak Avenue, Apt 4B · Miami, FL 33176. ¿La usamos para recogerle? | 1792 | NOTICEABLE DELAY | 8965 | describeCurrentView→ | same view |  |
| 7 | speech | BARRIER_TRANSPORTATION_PICKUP | Ajá. | Ajá. | ¿Necesita alguna ayuda especial para viajar, como silla de ruedas o que alguien le acompañe? | 1754 | NOTICEABLE DELAY | 8104 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS |  |
| 8 | speech | BARRIER_TRANSPORTATION_NEEDS | Mm… ¿qué opciones hay? | Mm… ¿qué opciones hay? | Puede elegir: 1, No, ninguna; 2, Uso bastón o andador; 3, Uso silla de ruedas; 4, Viajará alguien conmigo; 5, Necesito ayuda para entrar o salir del vehículo. ¿Cuál? | 1815 | NOTICEABLE DELAY | 14220 | describeCurrentView→ | same view |  |
| 9 | speech | BARRIER_TRANSPORTATION_NEEDS | Ninguna, gracias. | Ninguna, gracias. | Revise la hora de recogida sugerida y busque vehículos, o elija otra hora. | 1828 | NOTICEABLE DELAY | 7351 | performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_TIME |  |
| 10 | speech | BARRIER_TRANSPORTATION_TIME | Espere, ¿esto me va a costar? | Espere, ¿esto me va a costar? | Verá el costo estimado de cada vehículo antes de reservar, y no se cobra nada hasta que usted confirme. | 1816 | NOTICEABLE DELAY | 9883 |  | same view |  |
| 11 | speech | BARRIER_TRANSPORTATION_TIME | Bueno. Siga. | Bueno. Siga. | Buscando vehículos. | 2629 | POOR | 3476 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_TIME → BARRIER_TRANSPORTATION_OPTIONS | response start 2629 ms |
| 12 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 13 | speech | BARRIER_TRANSPORTATION_OPTIONS | ¿Qué me dijiste? | ¿Qué me dijiste? | Encontré 3 opciones. La primera es UberX y cuesta $27.95. ¿Quiere que le explique las demás? | 1787 | NOTICEABLE DELAY | 8549 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 14 | speech | BARRIER_TRANSPORTATION_OPTIONS | Más despacio, por favor. ¿Cuál es la primera? | Más despacio, por favor. ¿Cuál es la primera? | Despacio. La primera es UberX. Cuesta $27.95.  | 1827 | NOTICEABLE DELAY | 4764 | describeCurrentView→ | same view |  |
| 15 | speech | BARRIER_TRANSPORTATION_OPTIONS | Esa está bien. | Esa está bien. | Seleccioné UberX. Todavía falta confirmar la reserva. | 1839 | NOTICEABLE DELAY | 4765 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 16 | speech | BARRIER_TRANSPORTATION_REVIEW | ¿Y ahora qué hago? | ¿Y ahora qué hago? | Revise el viaje. Solo se reserva cuando presione el botón de reservar. Falta: El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión. | 1783 | NOTICEABLE DELAY | 13772 | describeCurrentView→ | same view |  |
| 17 | speech | BARRIER_TRANSPORTATION_REVIEW | Sí, hágalo usted. | Sí, hágalo usted. | Antes de reservar: UberX, Vehículo estándar · $27.95 · 1:45 p. m.. ¿Confirma? | 1825 | NOTICEABLE DELAY | 7326 | describeCurrentView→ | same view |  |
| 18 | speech | BARRIER_TRANSPORTATION_REVIEW | Sí, confirmo. | Sí, confirmo. | Listo. El viaje quedó reservado. | 2550 | POOR | 4646 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_RETURN_OFFER | response start 2550 ms |
| 19 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 20 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | ¿Ya quedó? | ¿Ya quedó? | Sí, el viaje ya quedó reservado. | 1764 | NOTICEABLE DELAY | 4285 | describeCurrentView→ | same view |  |
| 21 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | ¿Y me van a traer de vuelta? | ¿Y me van a traer de vuelta? | Puedo coordinar también el viaje de regreso. ¿Quiere? | 1815 | NOTICEABLE DELAY | 5149 | describeCurrentView→ | same view |  |
| 22 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | No, me recoge mi hija. | No, me recoge mi hija. | El viaje está reservado. Puede cambiarlo o cancelarlo desde aquí. | 1835 | NOTICEABLE DELAY | 6074 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_RETURN_OFFER → BARRIER_TRANSPORTATION_BOOKED |  |
| 23 | speech | BARRIER_TRANSPORTATION_BOOKED | Gracias, mija. | Gracias, mija. | De nada. Que le vaya muy bien en la cita. | 1783 | NOTICEABLE DELAY | 6000 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 20,
  "total_turns": 23,
  "response_start_p50_ms": 1815,
  "response_start_p95_ms": 2550,
  "response_start_avg_ms": 1886,
  "app_overhead_p50_ms": 2,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 3: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 11: response start 2629 ms",
    "turn 13: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 18: response start 2550 ms"
  ]
}
```

## Observations

- voice start: state EMMI_THINKING, socket true, error "", 416 ms after tap
