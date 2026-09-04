# Voice session S16-long-confused-transport-es

- patient_profile: C (se confunde fácilmente)
- language: es
- flow: long: appointment → transportation with repeated 'no entendí', repetition requests, known data, a cost question mid-task, booking, return ride declined
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T00:49:36.779Z
- finished: 2026-09-04T00:54:23.029Z

21 spoken turns. Backchannels ('Ajá', 'Mm'), 'no entendí', '¿qué me dijiste?', 'más despacio', a question about data the app already has, and a general question in the middle of the task.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Hola, ¿me escucha? | Hola, ¿me escucha? | Sí, le escucho bien. ¿En qué le ayudo? | 1787 | NOTICEABLE DELAY | 5117 |  | same view |  |
| 3 | speech | APPOINTMENT_CONFIRMED | Es que mi hija me dijo que tenía que hacer algo con la cita pero no sé qué. | Es que mi hija me dijo que tenía que hacer algo con la cita pero no sé qué. | Esta visita está confirmada. Desde aquí puede prepararse, pedir ayuda para llegar, cambiarla o cancelarla. | 1790 | NOTICEABLE DELAY | 8042 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 4 | speech | APPOINTMENT_CONFIRMED | ¿Eh? No entendí. | ¿Eh? No entendí. | Le explico más sencillo: esta pantalla es su cita del domingo con el doctor Fresner Lee. Puede revisarla, o decirme si algo la dificulta, como el transporte. | 1785 | NOTICEABLE DELAY | 13163 |  | same view |  |
| 5 | speech | APPOINTMENT_CONFIRMED | Ah, ya. Es que no tengo quien me lleve. | Ah, ya. Es que no tengo quien me lleve. | Podemos buscarle transporte. ¿Le recogemos en su casa, 123 Oak Avenue, Apt 4B · Miami, FL 33176? | 1877 | NOTICEABLE DELAY | 8992 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 6 | speech | BARRIER_TRANSPORTATION_PICKUP | ¿Ustedes tienen mi dirección? | ¿Ustedes tienen mi dirección? | Sí, tenemos su dirección: 123 Oak Avenue, Apt 4B · Miami, FL 33176. ¿La usamos para recogerle? | 1824 | NOTICEABLE DELAY | 8952 | describeCurrentView→ | same view |  |
| 7 | speech | BARRIER_TRANSPORTATION_PICKUP | Ajá. | Ajá. | ¿Necesita alguna ayuda especial para viajar, como silla de ruedas o que alguien le acompañe? | 1774 | NOTICEABLE DELAY | 8042 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS |  |
| 8 | speech | BARRIER_TRANSPORTATION_NEEDS | Mm… ¿qué opciones hay? | Mm… ¿qué opciones hay? | Puede elegir: 1, No, ninguna; 2, Uso bastón o andador; 3, Uso silla de ruedas; 4, Viajará alguien conmigo; 5, Necesito ayuda para entrar o salir del vehículo. ¿Cuál? | 1809 | NOTICEABLE DELAY | 14080 | describeCurrentView→ | same view |  |
| 9 | speech | BARRIER_TRANSPORTATION_NEEDS | Ninguna, gracias. | Ninguna, gracias. | Revise la hora de recogida sugerida y busque vehículos, o elija otra hora. | 1824 | NOTICEABLE DELAY | 7255 | performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_TIME |  |
| 10 | speech | BARRIER_TRANSPORTATION_TIME | Espere, ¿esto me va a costar? | Espere, ¿esto me va a costar? | Verá el costo estimado de cada vehículo antes de reservar, y no se cobra nada hasta que usted confirme. | 1823 | NOTICEABLE DELAY | 9819 |  | same view |  |
| 11 | speech | BARRIER_TRANSPORTATION_TIME | Bueno. Siga. | Bueno. Siga. | Buscando vehículos. | 1810 | NOTICEABLE DELAY | 2651 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_TIME → BARRIER_TRANSPORTATION_OPTIONS |  |
| 12 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 13 | speech | BARRIER_TRANSPORTATION_OPTIONS | ¿Qué me dijiste? | ¿Qué me dijiste? | Encontré 3 opciones. La primera es UberX y cuesta $27.95. ¿Quiere que le explique las demás? | 1804 | NOTICEABLE DELAY | 8511 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 14 | speech | BARRIER_TRANSPORTATION_OPTIONS | Más despacio, por favor. ¿Cuál es la primera? | Más despacio, por favor. ¿Cuál es la primera? | Despacio. La primera es UberX. Cuesta $27.95.  | 1843 | NOTICEABLE DELAY | 4760 | describeCurrentView→ | same view |  |
| 15 | speech | BARRIER_TRANSPORTATION_OPTIONS | Esa está bien. | Esa está bien. | Seleccioné UberX. Todavía falta confirmar la reserva. | 1751 | NOTICEABLE DELAY | 4672 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 16 | speech | BARRIER_TRANSPORTATION_REVIEW | ¿Y ahora qué hago? | ¿Y ahora qué hago? | Revise el viaje. Solo se reserva cuando presione el botón de reservar. Falta: El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión. | 1784 | NOTICEABLE DELAY | 13641 | describeCurrentView→ | same view |  |
| 17 | speech | BARRIER_TRANSPORTATION_REVIEW | Sí, hágalo usted. | Sí, hágalo usted. | Antes de reservar: UberX, Vehículo estándar · $27.95 · 9:45 a. m.. ¿Confirma? | 1844 | NOTICEABLE DELAY | 7280 | describeCurrentView→ | same view |  |
| 18 | speech | BARRIER_TRANSPORTATION_REVIEW | Sí, confirmo. | Sí, confirmo. | Estoy reservando el viaje. Todavía no está confirmado. El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión | 1850 | NOTICEABLE DELAY | 11574 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_BOOKING_FAILED |  |
| 19 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 20 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | ¿Ya quedó? | ¿Ya quedó? | Todavía no. El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión | 1729 | NOTICEABLE DELAY | 8915 | describeCurrentView→ | same view |  |
| 21 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | ¿Y me van a traer de vuelta? | ¿Y me van a traer de vuelta? | La reserva no se realizó. No se reservó ni se cobró nada. | 1809 | NOTICEABLE DELAY | 6831 | describeCurrentView→ | same view |  |
| 22 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | No, me recoge mi hija. | No, me recoge mi hija. | Aquí puede continuar. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 3481 | POOR | 12375 | performViewAction→ | same view | response start 3481 ms |
| 23 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Gracias, mija. | Gracias, mija. | De nada. Que le vaya muy bien en la cita. | 1809 | NOTICEABLE DELAY | 5981 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 20,
  "total_turns": 23,
  "response_start_p50_ms": 1809,
  "response_start_p95_ms": 1877,
  "response_start_avg_ms": 1890,
  "app_overhead_p50_ms": 3,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 1,
  "problems": [
    "turn 3: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 13: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 22: response start 3481 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 885 ms after tap
