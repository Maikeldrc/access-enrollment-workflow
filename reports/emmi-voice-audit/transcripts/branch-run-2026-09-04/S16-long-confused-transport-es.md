# Voice session S16-long-confused-transport-es

- patient_profile: C (se confunde fácilmente)
- language: es
- flow: long: appointment → transportation with repeated 'no entendí', repetition requests, known data, a cost question mid-task, booking, return ride declined
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T20:08:09.544Z
- finished: 2026-09-04T20:12:53.631Z

21 spoken turns. Backchannels ('Ajá', 'Mm'), 'no entendí', '¿qué me dijiste?', 'más despacio', a question about data the app already has, and a general question in the middle of the task.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | Hola, ¿me escucha? | Hola, ¿me escucha? | Sí, le escucho bien. ¿En qué le ayudo? | 1823 | NOTICEABLE DELAY | 5169 |  | same view |  |
| 3 | speech | APPOINTMENT_CONFIRMED | Es que mi hija me dijo que tenía que hacer algo con la cita pero no sé qué. | Es que mi hija me dijo que tenía que hacer algo con la cita pero no sé qué. | Esta visita está confirmada. Desde aquí puede prepararse, pedir ayuda para llegar, cambiarla o cancelarla. | 1787 | NOTICEABLE DELAY | 8126 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 4 | speech | APPOINTMENT_CONFIRMED | ¿Eh? No entendí. | ¿Eh? No entendí. | Le explico más sencillo: esta pantalla es su cita del domingo con el doctor Fresner Lee. Puede revisarla, o decirme si algo la dificulta, como el transporte. | 1822 | NOTICEABLE DELAY | 13403 |  | same view |  |
| 5 | speech | APPOINTMENT_CONFIRMED | Ah, ya. Es que no tengo quien me lleve. | Ah, ya. Es que no tengo quien me lleve. | Podemos buscarle transporte. ¿Le recogemos en su casa, 123 Oak Avenue, Apt 4B · Miami, FL 33176? | 1910 | NOTICEABLE DELAY | 9149 | performViewAction→PERFORMED; performViewAction→PERFORMED; performViewAction→PERFORMED | APPOINTMENT_CONFIRMED → BARRIER_TRANSPORTATION_PICKUP |  |
| 6 | speech | BARRIER_TRANSPORTATION_PICKUP | ¿Ustedes tienen mi dirección? | ¿Ustedes tienen mi dirección? | Sí, tenemos su dirección: 123 Oak Avenue, Apt 4B · Miami, FL 33176. ¿La usamos para recogerle? | 1815 | NOTICEABLE DELAY | 9053 | describeCurrentView→ | same view |  |
| 7 | speech | BARRIER_TRANSPORTATION_PICKUP | Ajá. | Ajá. | ¿Necesita alguna ayuda especial para viajar, como silla de ruedas o que alguien le acompañe? | 1779 | NOTICEABLE DELAY | 8141 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_PICKUP → BARRIER_TRANSPORTATION_NEEDS |  |
| 8 | speech | BARRIER_TRANSPORTATION_NEEDS | Mm… ¿qué opciones hay? | Mm… ¿qué opciones hay? | Puede elegir: 1, No, ninguna; 2, Uso bastón o andador; 3, Uso silla de ruedas; 4, Viajará alguien conmigo; 5, Necesito ayuda para entrar o salir del vehículo. ¿Cuál? | 1781 | NOTICEABLE DELAY | 14170 | describeCurrentView→ | same view |  |
| 9 | speech | BARRIER_TRANSPORTATION_NEEDS | Ninguna, gracias. | Ninguna, gracias. | Revise la hora de recogida sugerida y busque vehículos, o elija otra hora. | 1830 | NOTICEABLE DELAY | 7325 | performViewAction→PERFORMED; performViewAction→PERFORMED | BARRIER_TRANSPORTATION_NEEDS → BARRIER_TRANSPORTATION_TIME |  |
| 10 | speech | BARRIER_TRANSPORTATION_TIME | Espere, ¿esto me va a costar? | Espere, ¿esto me va a costar? | Verá el costo estimado de cada vehículo antes de reservar, y no se cobra nada hasta que usted confirme. | 1841 | NOTICEABLE DELAY | 9947 |  | same view |  |
| 11 | speech | BARRIER_TRANSPORTATION_TIME | Bueno. Siga. | Bueno. Siga. | Buscando vehículos. | 1800 | NOTICEABLE DELAY | 2641 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_TIME → BARRIER_TRANSPORTATION_OPTIONS |  |
| 12 | silence | | (silent 2500 ms) | |  | | | | | | states LISTENING→LISTENING |
| 13 | speech | BARRIER_TRANSPORTATION_OPTIONS | ¿Qué me dijiste? | ¿Qué me dijiste? | Encontré 3 opciones. La primera es UberX y cuesta $27.95. ¿Quiere que le explique las demás? | 1819 | NOTICEABLE DELAY | 8599 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 14 | speech | BARRIER_TRANSPORTATION_OPTIONS | Más despacio, por favor. ¿Cuál es la primera? | Más despacio, por favor. ¿Cuál es la primera? | Despacio. La primera es UberX. Cuesta $27.95.  | 1810 | NOTICEABLE DELAY | 4723 | describeCurrentView→ | same view |  |
| 15 | speech | BARRIER_TRANSPORTATION_OPTIONS | Esa está bien. | Esa está bien. | Seleccioné UberX. Todavía falta confirmar la reserva. | 1801 | NOTICEABLE DELAY | 4719 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_OPTIONS → BARRIER_TRANSPORTATION_REVIEW |  |
| 16 | speech | BARRIER_TRANSPORTATION_REVIEW | ¿Y ahora qué hago? | ¿Y ahora qué hago? | Revise el viaje. Solo se reserva cuando presione el botón de reservar. Falta: El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión. | 1821 | NOTICEABLE DELAY | 13865 | describeCurrentView→ | same view |  |
| 17 | speech | BARRIER_TRANSPORTATION_REVIEW | Sí, hágalo usted. | Sí, hágalo usted. | Antes de reservar: UberX, Vehículo estándar · $27.95 · 1:45 p. m.. ¿Confirma? | 1809 | NOTICEABLE DELAY | 7310 | describeCurrentView→ | same view |  |
| 18 | speech | BARRIER_TRANSPORTATION_REVIEW | Sí, confirmo. | Sí, confirmo. | Estoy reservando el viaje. Todavía no está confirmado. El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión | 1791 | NOTICEABLE DELAY | 11655 | performViewAction→PERFORMED | BARRIER_TRANSPORTATION_REVIEW → BARRIER_TRANSPORTATION_RETURN_OFFER |  |
| 19 | silence | | (silent 3000 ms) | |  | | | | | | states LISTENING→LISTENING |
| 20 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | ¿Ya quedó? | ¿Ya quedó? | Sí, el viaje ya quedó reservado. | 1706 | NOTICEABLE DELAY | 4200 | describeCurrentView→ | same view |  |
| 21 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | ¿Y me van a traer de vuelta? | ¿Y me van a traer de vuelta? | Puedo coordinar también el viaje de regreso. ¿Quiere? | 1821 | NOTICEABLE DELAY | 5188 | describeCurrentView→ | same view |  |
| 22 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | No, me recoge mi hija. | No, me recoge mi hija. | Aquí puede continuar. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 6382 | VERY POOR | 12399 | performViewAction→ | same view | response start 6382 ms |
| 23 | speech | BARRIER_TRANSPORTATION_RETURN_OFFER | Gracias, mija. | Gracias, mija. | De nada. Que le vaya muy bien en la cita. | 1778 | NOTICEABLE DELAY | 5995 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 20,
  "total_turns": 23,
  "response_start_p50_ms": 1810,
  "response_start_p95_ms": 1910,
  "response_start_avg_ms": 2036,
  "app_overhead_p50_ms": 3,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 1,
  "problems": [
    "turn 3: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 13: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 22: response start 6382 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 689 ms after tap
