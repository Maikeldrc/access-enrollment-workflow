# Voice session S17-long-enrollment-journey-es

- patient_profile: G (hace muchas preguntas antes de decidir)
- language: es
- flow: long: enrollment journey by hand with voice on — invitation → who is completing → identity → what care includes → eligibility → consent → enrolled → care setup
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T21:37:49.595Z
- finished: 2026-09-04T21:43:18.934Z

16 spoken turns across nine screens. Screen narration is spoken through the TTS route on each screen; the patient asks about every screen and types the identity fields (never spoken).

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | speech | SCREEN_INVITATION | ¿Qué es esto? | ¿Qué es esto? | Cuidado mediante el modelo ACCESS de Medicare | 1839 | NOTICEABLE DELAY | 4779 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 2 | speech | SCREEN_INVITATION | ¿Quién me mandó esto? | ¿Quién me mandó esto? | Cuidado mediante el modelo ACCESS de Medicare | 1743 | NOTICEABLE DELAY | 4662 | describeCurrentView→ | same view |  |
| 3 | speech | SCREEN_INVITATION | ¿Y qué gano yo con esto? | ¿Y qué gano yo con esto? | Apoyo adicional entre visitas: un monitor de presión en casa, un equipo que revisa sus lecturas y le ayuda con citas y medicinas. Sus médicos siguen siendo los mismos. | 1806 | NOTICEABLE DELAY | 14191 |  | same view |  |
| 4 | speech | SCREEN_INVITATION | Bueno, empecemos. | Bueno, empecemos. | Ese botón lo toca usted: 'Comenzar mi camino de cuidado', abajo. | 1772 | NOTICEABLE DELAY | 6442 | describeCurrentView→ | same view |  |
| 5 | tap | SCREEN_INVITATION | (taps Comenzar) | | | | | | | SCREEN_INVITATION → ENROLLMENT_DECISION_MAKER | context pushed: 0, narration: TTS |
| 6 | speech | ENROLLMENT_DECISION_MAKER | ¿Qué hago aquí? | ¿Qué hago aquí? | Elija la opción que le describe: usted mismo, alguien que le ayuda, o un representante personal autorizado. | 1790 | NOTICEABLE DELAY | 9042 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 7 | speech | ENROLLMENT_DECISION_MAKER | Lo hago yo misma. | Lo hago yo misma. | Entonces deje marcada la primera opción, 'Para mí', y toque Continuar. | 1848 | NOTICEABLE DELAY | 6509 | describeCurrentView→ | same view |  |
| 8 | tap | ENROLLMENT_DECISION_MAKER | (taps Continuar) | | | | | | | ENROLLMENT_DECISION_MAKER → ENROLLMENT_IDENTITY_VERIFICATION | context pushed: 0, narration: TTS |
| 9 | speech | ENROLLMENT_IDENTITY_VERIFICATION | ¿Por qué me piden mi fecha de nacimiento? | ¿Por qué me piden mi fecha de nacimiento? | Para confirmar que la invitación es suya, de forma segura. | 1827 | NOTICEABLE DELAY | 6024 |  | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 10 | speech | ENROLLMENT_IDENTITY_VERIFICATION | ¿Se la puedo decir? | ¿Se la puedo decir? | Mejor escríbala en el campo; así no queda en la conversación. | 1777 | NOTICEABLE DELAY | 6416 |  | same view |  |
| 11 | speech | ENROLLMENT_CARE_RECOMMENDATION | ¿Qué incluye? | ¿Qué incluye? | Échele un vistazo y continúe cuando esté listo. | 1820 | NOTICEABLE DELAY | 5157 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 12 | speech | ENROLLMENT_CARE_RECOMMENDATION | ¿Mis médicos cambian? | ¿Mis médicos cambian? | No. Sus médicos siguen siendo los mismos; ACCESS se suma a su cuidado. | 1824 | NOTICEABLE DELAY | 7299 |  | same view |  |
| 13 | tap | ENROLLMENT_CARE_RECOMMENDATION | (taps Continuar) | | | | | | | ENROLLMENT_CARE_RECOMMENDATION → ENROLLMENT_ACCESS_PRE_ELIGIBILITY_NOTICE | context pushed: 0, narration: TTS |
| 14 | speech | ENROLLMENT_ACCESS_PRE_ELIGIBILITY_NOTICE | ¿Qué es esto de Medicare? | ¿Qué es esto de Medicare? | Revise el aviso y confirme cuando esté listo para que verifiquemos. | 1736 | NOTICEABLE DELAY | 6401 | describeCurrentView→ | same view | EMMI was not idle before the patient spoke (state EMMI_SPEAKING); the app sent no screen context to the provider before it answered this spoken turn |
| 15 | speech | ENROLLMENT_ACCESS_ELIGIBILITY_RESULT | ¿Salió bien? | ¿Salió bien? | Sí. Su identidad fue verificada | 1818 | NOTICEABLE DELAY | 3914 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 16 | speech | ENROLLMENT_ACCESS_ELIGIBILITY_RESULT | ¿Entonces ya estoy inscrita? | ¿Entonces ya estoy inscrita? | Revise el resultado. Si esta pantalla indica que puede continuar, elija Continuar para ver la información antes de decidir. Falta: Poder continuar NO es estar inscrito: todavía hay una decisión que tomar. | 1808 | NOTICEABLE DELAY | 15559 | describeCurrentView→ | same view |  |
| 17 | tap | ENROLLMENT_ACCESS_ELIGIBILITY_RESULT | (taps Continuar) | | | | | | | ENROLLMENT_ACCESS_ELIGIBILITY_RESULT → ENROLLMENT_CONSENT_REVIEW | context pushed: 0, narration: TTS |
| 18 | speech | ENROLLMENT_CONSENT_REVIEW | ¿Qué estoy aceptando? | ¿Qué estoy aceptando? | Revise la información y, si decide continuar, marque las casillas y siga adelante. Falta: Poder continuar NO es estar inscrito: todavía hay una decisión que tomar. | 1813 | NOTICEABLE DELAY | 12937 | describeCurrentView→ | same view | EMMI was not idle before the patient spoke (state LISTENING); the app sent no screen context to the provider before it answered this spoken turn |
| 19 | speech | ENROLLMENT_CONSENT_REVIEW | ¿Puedo cambiar de opinión después? | ¿Puedo cambiar de opinión después? | Sí. Puede salir de ACCESS cuando quiera; su cuidado normal no cambia. | 1772 | NOTICEABLE DELAY | 6872 |  | same view |  |
| 20 | speech | ENROLLMENT_ENROLLMENT_CONFIRMED | ¿Ya? | ¿Ya? | El siguiente paso nos ayuda a personalizar su cuidado. | 1816 | NOTICEABLE DELAY | 5623 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 21 | speech | ENROLLMENT_ENROLLMENT_CONFIRMED | ¿Y ahora qué sigue? | ¿Y ahora qué sigue? | El siguiente paso nos ayuda a personalizar su cuidado. | 1815 | NOTICEABLE DELAY | 5621 | describeCurrentView→ | same view |  |

## Summary

```json
{
  "spoken_turns": 17,
  "total_turns": 21,
  "response_start_p50_ms": 1813,
  "response_start_p95_ms": 1848,
  "response_start_avg_ms": 1801,
  "app_overhead_p50_ms": 2,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": [
    "turn 1: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 6: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 9: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 11: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 14: EMMI was not idle before the patient spoke (state EMMI_SPEAKING)",
    "turn 14: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 15: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 18: EMMI was not idle before the patient spoke (state LISTENING)",
    "turn 18: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 20: the app sent no screen context to the provider before it answered this spoken turn"
  ]
}
```

## Observations

- patient experience switched to es
- voice start: state EMMI_SPEAKING, socket true, error "", 391 ms after tap
- identity typed by the patient (never spoken)
- Continuar on the identity screen (asynchronous verification): view now ENROLLMENT_CARE_RECOMMENDATION
- eligibility check: view now ENROLLMENT_ACCESS_ELIGIBILITY_RESULT
- consent: view now ENROLLMENT_ENROLLMENT_CONFIRMED
- HARNESS ERROR: locator.waitFor: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('[data-action="next"]').first() to be visible[22m

    at press (D:\Dev\Codex\Access Enrollment\access-enrollment-workflow\.claude\worktrees\vercel-branch-analysis-42c870\reports\emmi-voice-audit\harness\voice-harness.mjs:156:129)
    at SessionRecorder.navigate (D:\Dev\Codex\Access Enrollment\access-enrollment-workflow\.claude\worktrees\vercel-branch-analysis-42c870\reports\emmi-voice-audit\harness\voice-harness.mjs:406:11)
    at async file:///D:/Dev/Codex/Access%20Enrollment/access-enrollment-workflow/.claude/worktrees/vercel-branch-analysis-42c870/reports/emmi-voice-audit/harness/run-sessions.mjs:35:31
