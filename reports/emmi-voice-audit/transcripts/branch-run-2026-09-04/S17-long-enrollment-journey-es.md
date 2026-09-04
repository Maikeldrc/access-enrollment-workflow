# Voice session S17-long-enrollment-journey-es

- patient_profile: G (hace muchas preguntas antes de decidir)
- language: es
- flow: long: enrollment journey by hand with voice on — invitation → who is completing → identity → what care includes → eligibility → consent → enrolled → care setup
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T20:12:54.603Z
- finished: 2026-09-04T20:19:07.803Z

16 spoken turns across nine screens. Screen narration is spoken through the TTS route on each screen; the patient asks about every screen and types the identity fields (never spoken).

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | speech | SCREEN_INVITATION | ¿Qué es esto? | ¿Qué es esto? | Cuidado mediante el modeloACCESS de Medicare | 1795 | NOTICEABLE DELAY | 4294 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 2 | speech | SCREEN_INVITATION | ¿Quién me mandó esto? | ¿Quién me mandó esto? | Cuidado mediante el modeloACCESS de Medicare | 1785 | NOTICEABLE DELAY | 4282 | describeCurrentView→ | same view |  |
| 3 | speech | SCREEN_INVITATION | ¿Y qué gano yo con esto? | ¿Y qué gano yo con esto? | Apoyo adicional entre visitas: un monitor de presión en casa, un equipo que revisa sus lecturas y le ayuda con citas y medicinas. Sus médicos siguen siendo los mismos. | 1808 | NOTICEABLE DELAY | 14207 |  | same view |  |
| 4 | speech | SCREEN_INVITATION | Bueno, empecemos. | Bueno, empecemos. | Ese botón lo toca usted: 'Comenzar mi camino de cuidado', abajo. | 1751 | NOTICEABLE DELAY | 6388 | describeCurrentView→ | same view |  |
| 5 | tap | SCREEN_INVITATION | (taps Comenzar) | | | | | | | SCREEN_INVITATION → ENROLLMENT_DECISION_MAKER | context pushed: 0, narration: TTS |
| 6 | speech | ENROLLMENT_DECISION_MAKER | ¿Qué hago aquí? | ¿Qué hago aquí? | Elija la opción que le describe: para usted mismo, alguien que le ayuda, o un representante personal autorizado para tomar decisiones médicas. | 1794 | NOTICEABLE DELAY | 11216 | describeCurrentView→ | same view | EMMI was not idle before the patient spoke (state EMMI_SPEAKING); the app sent no screen context to the provider before it answered this spoken turn |
| 7 | speech | ENROLLMENT_DECISION_MAKER | Lo hago yo misma. | Lo hago yo misma. | Entonces deje marcada la primera opción, 'Para mí', y toque Continuar. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 9632 | VERY POOR | 15846 | describeCurrentView→ | same view | response start 9632 ms |
| 8 | tap | ENROLLMENT_DECISION_MAKER | (taps Continuar) | | | | | | | ENROLLMENT_DECISION_MAKER → ENROLLMENT_IDENTITY_VERIFICATION | context pushed: 0, narration: TTS |
| 9 | speech | ENROLLMENT_IDENTITY_VERIFICATION | ¿Por qué me piden mi fecha de nacimiento? | ¿Por qué me piden mi fecha de nacimiento? | Para confirmar que la invitación es suya, de forma segura. | 1834 | NOTICEABLE DELAY | 6051 |  | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 10 | speech | ENROLLMENT_IDENTITY_VERIFICATION | ¿Se la puedo decir? | ¿Se la puedo decir? | Mejor escríbala en el campo; así no queda en la conversación. | 1755 | NOTICEABLE DELAY | 6402 |  | same view |  |
| 11 | speech | ENROLLMENT_CARE_RECOMMENDATION | ¿Qué incluye? | ¿Qué incluye? | Échele un vistazo y continúe cuando esté listo. | 1776 | NOTICEABLE DELAY | 5123 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 12 | speech | ENROLLMENT_CARE_RECOMMENDATION | ¿Mis médicos cambian? | ¿Mis médicos cambian? | No. Sus médicos siguen siendo los mismos; ACCESS se suma a su cuidado. | 1780 | NOTICEABLE DELAY | 7287 |  | same view |  |
| 13 | tap | ENROLLMENT_CARE_RECOMMENDATION | (taps Continuar) | | | | | | | ENROLLMENT_CARE_RECOMMENDATION → ENROLLMENT_ACCESS_PRE_ELIGIBILITY_NOTICE | context pushed: 0, narration: TTS |
| 14 | speech | ENROLLMENT_ACCESS_PRE_ELIGIBILITY_NOTICE | ¿Qué es esto de Medicare? | ¿Qué es esto de Medicare? | Revise el aviso y confirme cuando esté listo para que verifiquemos. | 1734 | NOTICEABLE DELAY | 6380 | describeCurrentView→ | same view | EMMI was not idle before the patient spoke (state EMMI_SPEAKING); the app sent no screen context to the provider before it answered this spoken turn |
| 15 | speech | ENROLLMENT_ACCESS_ELIGIBILITY_RESULT | ¿Salió bien? | ¿Salió bien? | Sí. Su identidad fue verificada | 1816 | NOTICEABLE DELAY | 3897 | describeCurrentView→ | same view | the app sent no screen context to the provider before it answered this spoken turn |
| 16 | speech | ENROLLMENT_ACCESS_ELIGIBILITY_RESULT | ¿Entonces ya estoy inscrita? | ¿Entonces ya estoy inscrita? | Revise el resultado. Si esta pantalla indica que puede continuar, elija Continuar para revisar la información que necesita antes de decidir si desea inscribirse. Falta: Poder continuar NO es estar inscrito: todavía hay una decisión que tomar. | 1773 | NOTICEABLE DELAY | 17671 | describeCurrentView→ | same view |  |
| 17 | tap | ENROLLMENT_ACCESS_ELIGIBILITY_RESULT | (taps Continuar) | | | | | | | ENROLLMENT_ACCESS_ELIGIBILITY_RESULT → ENROLLMENT_CONSENT_REVIEW | context pushed: 0, narration: TTS |
| 18 | speech | ENROLLMENT_CONSENT_REVIEW | ¿Qué estoy aceptando? | ¿Qué estoy aceptando? | Revise la información y, si decide continuar, marque las casillas y siga adelante. Falta: Poder continuar NO es estar inscrito: todavía hay una decisión que tomar. | 1834 | NOTICEABLE DELAY | 12985 | describeCurrentView→ | same view | EMMI was not idle before the patient spoke (state LISTENING); the app sent no screen context to the provider before it answered this spoken turn |
| 19 | speech | ENROLLMENT_CONSENT_REVIEW | ¿Puedo cambiar de opinión después? | ¿Puedo cambiar de opinión después? | Sí. Puede salir de ACCESS cuando quiera; su cuidado normal no cambia. | 1784 | NOTICEABLE DELAY | 6881 |  | same view |  |
| 20 | speech | ENROLLMENT_ENROLLMENT_CONFIRMED | ¿Ya? | ¿Ya? | Aquí puede continuar. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 6389 | VERY POOR | 12426 | describeCurrentView→ | same view | EMMI was not idle before the patient spoke (state EMMI_SPEAKING); response start 6389 ms |
| 21 | speech | ENROLLMENT_ENROLLMENT_CONFIRMED | ¿Y ahora qué sigue? | ¿Y ahora qué sigue? | El siguiente paso nos ayuda a conocer mejor su salud para poder personalizar su cuidado. | 1797 | NOTICEABLE DELAY | 8188 | describeCurrentView→ | same view |  |

## Summary

```json
{
  "spoken_turns": 17,
  "total_turns": 21,
  "response_start_p50_ms": 1794,
  "response_start_p95_ms": 9632,
  "response_start_avg_ms": 2520,
  "app_overhead_p50_ms": 4,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 2,
  "problems": [
    "turn 1: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 6: EMMI was not idle before the patient spoke (state EMMI_SPEAKING)",
    "turn 6: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 7: response start 9632 ms",
    "turn 9: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 11: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 14: EMMI was not idle before the patient spoke (state EMMI_SPEAKING)",
    "turn 14: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 15: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 18: EMMI was not idle before the patient spoke (state LISTENING)",
    "turn 18: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 20: EMMI was not idle before the patient spoke (state EMMI_SPEAKING)",
    "turn 20: response start 6389 ms"
  ]
}
```

## Observations

- patient experience switched to es
- voice start: state EMMI_SPEAKING, socket true, error "", 914 ms after tap
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
