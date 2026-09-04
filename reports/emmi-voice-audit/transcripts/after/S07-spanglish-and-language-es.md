# Voice session S07-spanglish-and-language-es

- patient_profile: F (utiliza Spanglish)
- language: es
- flow: Spanglish utterances, plain Spanish without accents, and an English sentence while the session is Spanish
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T04:40:12.127Z
- finished: 2026-09-04T04:42:07.092Z

Tests the transcript-reliability guard with the ASR text the provider would return. The double transcribes exactly what the patient said.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | tap | SCREEN_MY_CARE | (taps open the appointment) | | | | | | | SCREEN_MY_CARE → APPOINTMENT_CONFIRMED | context pushed: 0, narration: TTS |
| 2 | speech | APPOINTMENT_CONFIRMED | No tengo ride para mañana. | No tengo ride para mañana. | Puedo buscarle transporte para la cita. ¿Quiere que lo haga? | 1823 | NOTICEABLE DELAY | 5983 |  | same view |  |
| 3 | speech | APPOINTMENT_CONFIRMED | Yo uso walker para caminar. | Yo uso walker para caminar. | Gracias, lo tendré en cuenta para el vehículo. | 1828 | NOTICEABLE DELAY | 5154 |  | same view |  |
| 4 | speech | APPOINTMENT_CONFIRMED | Quiero un Uber X | Quiero un Uber X | Puedo buscar un UberX. Primero confirmemos dónde le recogen. | 1773 | NOTICEABLE DELAY | 5522 |  | same view |  |
| 5 | speech | APPOINTMENT_CONFIRMED | Mi doctor dijo que no | Mi doctor dijo que no | Entiendo. ¿Qué le dijo su doctor que no? | 1785 | NOTICEABLE DELAY | 5113 |  | same view |  |
| 6 | speech | APPOINTMENT_CONFIRMED | Pon la primera del jueves | Pon la primera del jueves | Para eso necesito abrir los horarios. ¿Quiere que busque otros horarios? | 1790 | NOTICEABLE DELAY | 6372 |  | same view |  |
| 7 | speech | APPOINTMENT_CONFIRMED | 180 sobre 120 y me siento mareado. | 180 sobre 120 y me siento mareado. | Eso puede ser una emergencia. Llame al 911 ahora. | 1774 | NOTICEABLE DELAY | 5528 |  | same view |  |
| 8 | speech | APPOINTMENT_CONFIRMED | Can we switch to English please? | Can we switch to English please? | (empty generation) | 1404 | ACCEPTABLE | 2242 |  | same view |  |
| 9 | speech | APPOINTMENT_CONFIRMED | Quiero cambiar el appointment | Quiero cambiar el appointment | Puedo ayudarle a cambiar la cita. | 1732 | NOTICEABLE DELAY | 4229 |  | same view |  |
| 10 | speech | APPOINTMENT_CONFIRMED | Espera | Espera | Sí, dígame. | 1784 | NOTICEABLE DELAY | 2619 |  | same view |  |

## Summary

```json
{
  "spoken_turns": 9,
  "total_turns": 10,
  "response_start_p50_ms": 1784,
  "response_start_p95_ms": 1828,
  "response_start_avg_ms": 1744,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": []
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 981 ms after tap
