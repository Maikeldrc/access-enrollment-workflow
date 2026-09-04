# Voice session S16-long-confused-transport-es

- patient_profile: C (se confunde fácilmente)
- language: es
- flow: long: appointment → transportation with repeated 'no entendí', repetition requests, known data, a cost question mid-task, booking, return ride declined
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T05:11:21.044Z
- finished: 2026-09-04T05:15:58.278Z

21 spoken turns. Backchannels ('Ajá', 'Mm'), 'no entendí', '¿qué me dijiste?', 'más despacio', a question about data the app already has, and a general question in the middle of the task.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Hola, ¿me escucha? | Hola, ¿me escucha? | Sí, le escucho bien. ¿En qué le ayudo? | 1819 | NOTICEABLE DELAY | 5151 |  | same view |  |
| 3 | speech | APPOINTMENT_CONFIRMED | Es que mi hija me dijo que tenía que hacer algo con la cita pero no sé qué. | Es que mi hija me dijo que tenía que hacer algo con la cita pero no sé qué. | Esta visita está confirmada. Desde aquí puede prepararse, pedir ayuda para llegar, cambiarla o cancelarla. | 1783 | NOTICEABLE DELAY | 8060 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 4 | speech | APPOINTMENT_CONFIRMED | ¿Eh? No entendí. | ¿Eh? No entendí. | Le explico más sencillo: esta pantalla es su cita del domingo con el doctor Fresner Lee. Puede revisarla, o decirme si algo la dificulta, como el transporte. | 1793 | NOTICEABLE DELAY | 13204 |  | same view |  |
| 5 | speech | APPOINTMENT_CONFIRMED | Ah, ya. Es que no tengo quien me lleve. | Ah, ya. Es que no tengo quien me lleve. | Podemos buscarle transporte. ¿Le recogemos en su casa, 123 Oak Avenue, Apt 4B · Miami, FL 33176? | 1885 | NOTICEABLE DELAY | 9008 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 6 | speech | BARRIER_TRANSPORTATION_PICKUP | ¿Ustedes tienen mi dirección? | ¿Ustedes tienen mi dirección? | Sí, tenemos su dirección: 123 Oak Avenue, Apt 4B · Miami, FL 33176. ¿La usamos para recogerle? | 1792 | NOTICEABLE DELAY | 8922 | describeCurrentView→ | same view |  |
| 7 | speech | BARRIER_TRANSPORTATION_PICKUP | Ajá. | Ajá. | ¿Necesita alguna ayuda especial para viajar, como silla de ruedas o que alguien le acompañe? | 1730 | NOTICEABLE DELAY | 7998 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS |  |
| 8 | speech | BARRIER_TRANSPORTATION_NEEDS | Mm… ¿qué opciones hay? | Mm… ¿qué opciones hay? | Puede elegir: 1, No, ninguna; 2, Uso bastón o andador; 3, Uso silla de ruedas; 4, Viajará alguien conmigo; 5, Necesito ayuda para entrar o salir del vehículo. ¿Cuál? | 1766 | NOTICEABLE DELAY | 14042 | describeCurrentView→ | same view |  |
| 9 | speech | BARRIER_TRANSPORTATION_NEEDS | Ninguna, gracias. | Ninguna, gracias. | Revise la hora de recogida sugerida y busque vehículos, o elija otra hora. | 1877 | NOTICEABLE DELAY | 7315 | performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_TIME |  |
| 10 | speech | BARRIER_TRANSPORTATION_TIME | Espere, ¿esto me va a costar? | Espere, ¿esto me va a costar? | Verá el costo estimado de cada vehículo antes de reservar, y no se cobra nada hasta que usted confirme. | 1820 | NOTICEABLE DELAY | 9810 |  | same view |  |
| 11 | speech | BARRIER_TRANSPORTATION_TIME | Bueno. Siga. | Bueno. Siga. | Buscando vehículos. | 2633 | POOR | 3474 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_TIME → BARRIER_TRANSPORTATION_OPTIONS | response start 2633 ms |
| 12 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 13 | speech | BARRIER_TRANSPORTATION_OPTIONS | ¿Qué me dijiste? | ¿Qué me dijiste? | Encontré 3 opciones. La primera es UberX y cuesta $27.95. ¿Quiere que le explique las demás? | 1778 | NOTICEABLE DELAY | 8481 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 14 | speech | BARRIER_TRANSPORTATION_OPTIONS | Más despacio, por favor. ¿Cuál es la primera? | Más despacio, por favor. ¿Cuál es la primera? | Despacio. La primera es UberX. Cuesta $27.95.  | 1823 | NOTICEABLE DELAY | 4737 | describeCurrentView→ | same view |  |
| 15 | speech | BARRIER_TRANSPORTATION_OPTIONS | Esa está bien. | Esa está bien. | Seleccioné UberX. Todavía falta confirmar la reserva. | 1783 | NOTICEABLE DELAY | 4726 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 16 | speech | BARRIER_TRANSPORTATION_REVIEW | ¿Y ahora qué hago? | ¿Y ahora qué hago? | Revise el viaje. Solo se reserva cuando presione el botón de reservar. Falta: El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión. | 1824 | NOTICEABLE DELAY | 13697 | describeCurrentView→ | same view |  |
| 17 | speech | BARRIER_TRANSPORTATION_REVIEW | Sí, hágalo usted. | Sí, hágalo usted. | Antes de reservar: UberX, Vehículo estándar · $27.95 · 9:45 a. m.. ¿Confirma? | 1829 | NOTICEABLE DELAY | 7284 | describeCurrentView→ | same view |  |
| 18 | speech | BARRIER_TRANSPORTATION_REVIEW | Sí, confirmo. | Sí, confirmo. | No se pudo reservar: el proveedor no estaba disponible. No se cobró nada. Puedo intentar de nuevo o buscar otro vehículo. | 2570 | POOR | 11440 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_BOOKING_FAILED | response start 2570 ms |
| 19 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 20 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | ¿Ya quedó? | ¿Ya quedó? | No. La reserva falló y no se cobró nada. ¿Intento de nuevo o busco otro vehículo? | 1729 | NOTICEABLE DELAY | 8471 | describeCurrentView→ | same view |  |
| 21 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | ¿Y me van a traer de vuelta? | ¿Y me van a traer de vuelta? | La reserva no se realizó. No se reservó ni se cobró nada. | 1828 | NOTICEABLE DELAY | 6862 | describeCurrentView→ | same view |  |
| 22 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | No, me recoge mi hija. | No, me recoge mi hija. | Aquí puede continuar. | 1832 | NOTICEABLE DELAY | 3085 | performViewAction→UNKNOWN_ACTION | same view |  |
| 23 | speech | BARRIER_TRANSPORTATION_BOOKING_FAILED | Gracias, mija. | Gracias, mija. | De nada. Que le vaya muy bien en la cita. | 1777 | NOTICEABLE DELAY | 5945 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 20,
  "total_turns": 23,
  "response_start_p50_ms": 1819,
  "response_start_p95_ms": 2570,
  "response_start_avg_ms": 1884,
  "app_overhead_p50_ms": 3,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 3: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 11: response start 2633 ms",
    "turn 13: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 18: response start 2570 ms"
  ]
}
```

## Observations

- voice start: state EMMI_THINKING, socket true, error "", 915 ms after tap
