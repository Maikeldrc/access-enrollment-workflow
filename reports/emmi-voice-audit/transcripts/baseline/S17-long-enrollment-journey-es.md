# Voice session S17-long-enrollment-journey-es

- patient_profile: G (hace muchas preguntas antes de decidir)
- language: es
- flow: long: enrollment journey by hand with voice on — invitation → who is completing → identity → what care includes → eligibility → consent → enrolled → care setup
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T00:54:23.512Z
- finished: 2026-09-04T01:00:33.675Z

16 spoken turns across nine screens. Screen narration is spoken through the TTS route on each screen; the patient asks about every screen and types the identity fields (never spoken).

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | speech | SCREEN_INVITATION | ¿Qué es esto? | ¿Qué es esto? | Cuidado mediante el modeloACCESS de Medicare | 1820 | NOTICEABLE DELAY | 4312 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 2 | speech | SCREEN_INVITATION | ¿Quién me mandó esto? | ¿Quién me mandó esto? | Cuidado mediante el modeloACCESS de Medicare | 1794 | NOTICEABLE DELAY | 4285 | describeCurrentView→ | same view |  |
| 3 | speech | SCREEN_INVITATION | ¿Y qué gano yo con esto? | ¿Y qué gano yo con esto? | Apoyo adicional entre visitas: un monitor de presión en casa, un equipo que revisa sus lecturas y le ayuda con citas y medicinas. Sus médicos siguen siendo los mismos. | 1810 | NOTICEABLE DELAY | 13982 |  | same view |  |
| 4 | speech | SCREEN_INVITATION | Bueno, empecemos. | Bueno, empecemos. | Ese botón lo toca usted: 'Comenzar mi camino de cuidado', abajo. | 1745 | NOTICEABLE DELAY | 6327 | describeCurrentView→ | same view |  |
| 5 | tap | SCREEN_INVITATION | (taps Comenzar) | | | | | | | SCREEN_INVITATION → ENROLLMENT_DECISION_MAKER | context pushed: 0, narration: TTS |
| 6 | speech | ENROLLMENT_DECISION_MAKER | ¿Qué hago aquí? | ¿Qué hago aquí? | Elija la opción que le describe: para usted mismo, alguien que le ayuda, o un representante personal autorizado para tomar decisiones médicas. | 1764 | NOTICEABLE DELAY | 11012 | describeCurrentView→ | same view | EMMI was not idle before the patient spoke (state EMMI_SPEAKING); the app sent no screen context to the provider before it answered this spoken turn |
| 7 | speech | ENROLLMENT_DECISION_MAKER | Lo hago yo misma. | Lo hago yo misma. | Entonces deje marcada la primera opción, 'Para mí', y toque Continuar. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 6883 | VERY POOR | 15733 | describeCurrentView→ | same view | response start 6883 ms |
| 8 | tap | ENROLLMENT_DECISION_MAKER | (taps Continuar) | | | | | | | ENROLLMENT_DECISION_MAKER → ENROLLMENT_IDENTITY_VERIFICATION | context pushed: 0, narration: TTS |
| 9 | speech | ENROLLMENT_IDENTITY_VERIFICATION | ¿Por qué me piden mi fecha de nacimiento? | ¿Por qué me piden mi fecha de nacimiento? | Para confirmar que la invitación es suya, de forma segura. | 1838 | NOTICEABLE DELAY | 5995 |  | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 10 | speech | ENROLLMENT_IDENTITY_VERIFICATION | ¿Se la puedo decir? | ¿Se la puedo decir? | Mejor escríbala en el campo; así no queda en la conversación. | 1756 | NOTICEABLE DELAY | 6345 |  | same view |  |
| 11 | tap | ENROLLMENT_IDENTITY_VERIFICATION | (taps Continuar) | | | | | | | ENROLLMENT_IDENTITY_VERIFICATION → ENROLLMENT_IDENTITY_VERIFICATION | expected view CARE_RECOMMENDATION, got ENROLLMENT_IDENTITY_VERIFICATION; context pushed: 0, narration: none |
| 12 | speech | ENROLLMENT_IDENTITY_VERIFICATION | ¿Qué incluye? | ¿Qué incluye? | Échele un vistazo y continúe cuando esté listo. | -10356 | FAST | 5180 | describeCurrentView→ | ENROLLMENT_IDENTITY_VERIFICATION → ENROLLMENT_CARE_RECOMMENDATION | the app sent no screen context to the provider before it answered this spoken turn |
| 13 | speech | ENROLLMENT_CARE_RECOMMENDATION | ¿Mis médicos cambian? | ¿Mis médicos cambian? | No. Sus médicos siguen siendo los mismos; ACCESS se suma a su cuidado. | 1824 | NOTICEABLE DELAY | 7256 |  | same view |  |
| 14 | tap | ENROLLMENT_CARE_RECOMMENDATION | (taps Continuar) | | | | | | | ENROLLMENT_CARE_RECOMMENDATION → ENROLLMENT_ACCESS_PRE_ELIGIBILITY_NOTICE | context pushed: 0, narration: TTS |
| 15 | speech | ENROLLMENT_ACCESS_PRE_ELIGIBILITY_NOTICE | ¿Qué es esto de Medicare? | ¿Qué es esto de Medicare? | Revise el aviso y confirme cuando esté listo para que verifiquemos. | 1765 | NOTICEABLE DELAY | 6352 | describeCurrentView→ | same view | EMMI was not idle before the patient spoke (state EMMI_SPEAKING); the app sent no screen context to the provider before it answered this spoken turn |
| 16 | speech | ENROLLMENT_ACCESS_ELIGIBILITY_RESULT | ¿Salió bien? | ¿Salió bien? | Sí. Su identidad fue verificada | 1835 | NOTICEABLE DELAY | 3920 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 17 | speech | ENROLLMENT_ACCESS_ELIGIBILITY_RESULT | ¿Entonces ya estoy inscrita? | ¿Entonces ya estoy inscrita? | Revise el resultado. Si esta pantalla indica que puede continuar, elija Continuar para revisar la información que necesita antes de decidir si desea inscribirse. Falta: Poder continuar NO es estar inscrito: todavía hay una decisión que tomar. | 1795 | NOTICEABLE DELAY | 17478 | describeCurrentView→ | same view |  |
| 18 | tap | ENROLLMENT_ACCESS_ELIGIBILITY_RESULT | (taps Continuar) | | | | | | | ENROLLMENT_ACCESS_ELIGIBILITY_RESULT → ENROLLMENT_CONSENT_REVIEW | context pushed: 0, narration: TTS |
| 19 | speech | ENROLLMENT_CONSENT_REVIEW | ¿Qué estoy aceptando? | ¿Qué estoy aceptando? | Revise la información y, si decide continuar, marque las casillas y siga adelante. Falta: Poder continuar NO es estar inscrito: todavía hay una decisión que tomar. | 1832 | NOTICEABLE DELAY | 12900 | describeCurrentView→ | same view | EMMI was not idle before the patient spoke (state LISTENING); the app sent no screen context to the provider before it answered this spoken turn |
| 20 | speech | ENROLLMENT_CONSENT_REVIEW | ¿Puedo cambiar de opinión después? | ¿Puedo cambiar de opinión después? | Sí. Puede salir de ACCESS cuando quiera; su cuidado normal no cambia. | 1837 | NOTICEABLE DELAY | 6856 |  | same view |  |
| 21 | speech | ENROLLMENT_ENROLLMENT_CONFIRMED | ¿Ya? | ¿Ya? | Aquí puede continuar. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 3499 | POOR | 12458 | describeCurrentView→ | same view | EMMI was not idle before the patient spoke (state EMMI_SPEAKING); response start 3499 ms |
| 22 | speech | ENROLLMENT_ENROLLMENT_CONFIRMED | ¿Y ahora qué sigue? | ¿Y ahora qué sigue? | El siguiente paso nos ayuda a conocer mejor su salud para poder personalizar su cuidado. | 1928 | NOTICEABLE DELAY | 8272 | describeCurrentView→ | same view |  |

## Summary

```json
{
  "spoken_turns": 17,
  "total_turns": 22,
  "response_start_p50_ms": 1820,
  "response_start_p95_ms": 6883,
  "response_start_avg_ms": 1492,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 2,
  "problems": [
    "turn 1: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 6: EMMI was not idle before the patient spoke (state EMMI_SPEAKING)",
    "turn 6: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 7: response start 6883 ms",
    "turn 9: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 11: expected view CARE_RECOMMENDATION, got ENROLLMENT_IDENTITY_VERIFICATION",
    "turn 12: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 15: EMMI was not idle before the patient spoke (state EMMI_SPEAKING)",
    "turn 15: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 16: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 19: EMMI was not idle before the patient spoke (state LISTENING)",
    "turn 19: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 21: EMMI was not idle before the patient spoke (state EMMI_SPEAKING)",
    "turn 21: response start 3499 ms"
  ]
}
```

## Observations

- patient experience switched to es
- voice start: state EMMI_THINKING, socket true, error "", 882 ms after tap
- identity typed by the patient (never spoken)
- eligibility check: view now ENROLLMENT_ACCESS_ELIGIBILITY_RESULT
- consent: view now ENROLLMENT_ENROLLMENT_CONFIRMED
- HARNESS ERROR: locator.waitFor: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('[data-action="next"]').first() to be visible[22m

    at press (/home/user/access-enrollment-workflow/reports/emmi-voice-audit/harness/voice-harness.mjs:103:129)
    at SessionRecorder.navigate (/home/user/access-enrollment-workflow/reports/emmi-voice-audit/harness/voice-harness.mjs:323:11)
    at async file:///home/user/access-enrollment-workflow/reports/emmi-voice-audit/harness/run-sessions.mjs:33:31
