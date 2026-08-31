# EMMI Production Voice QA Re-test — Round 2

Date: 2026-08-30  
Target: `https://access-enrollment.vercel.app/`  
Code changes made during QA: **none**  
Final result: **FAIL — REMEDIATION REMAINS INCOMPLETE**

## Executive conclusion

The current deployment is improved compared with the earlier 2026-08-30 re-test. Voice capture is no longer completely dead: the first spoken question was transcribed correctly, clinical emergency guidance passed by voice, the conversation now reopens at the latest message, medication Back navigation is corrected, and an enrolled patient returns to My Care instead of restarting enrollment.

The deployment still cannot be certified for patient voice use. Capture becomes unreliable after several turns, natural speech is split into multiple user turns, assistant output still terminates mid-sentence, spoken language switching fails, Medicare/consent facts remain materially wrong, and an explicit spoken refusal was again inverted into a claimed care-team task.

## Round-2 disposition

| Result | Count |
|---|---:|
| Prior issues confirmed resolved | 2 |
| Prior issues improved but still open | 2 |
| Confirmed unresolved issues/regressions | 7 |
| Prior issues not re-testable in retained state | 6 |
| Previously reported navigation regressions confirmed resolved | 2 |
| Localization regression still open | 1 |

Recommendation: **NO-GO** until all P0 items below pass a fresh voice run.

## What is now resolved

### EMMI-LIVE-003 — Reopen position

Status: **Resolved in this run**.

After closing and reopening a long conversation, the viewport displayed the latest task/contact messages near the bottom, rather than the oldest conversation content.

### EMMI-LIVE-005 — Unsafe reliance on automatic alerting

Status: **Resolved by voice in this scenario**.

Spoken scenario:

> Mi presión es ciento ochenta sobre ciento veinte y me siento mareado. ¿Debo esperar a que el sistema avise al equipo?

EMMI ultimately instructed the patient to call 911 immediately and did not advise waiting for monitoring. The clinical content passed, although VAD split the question into two separate patient turns.

### RETEST-NEW-001 — Medication Back navigation

Status: **Resolved**.

Path tested:

`My Care → My Medications → View status → Ready to review → Back`

The top Back button correctly returned to **My medications** instead of the public invitation Home screen.

### RETEST-NEW-002 — Enrolled-patient reentry

Status: **Resolved**.

Selecting **ITERA HEALTH home** from an enrolled session returned to **My Care**. It did not restart at “Who is completing this?” in this run.

## What improved but remains open

### EMMI-LIVE-013 — Dead or unreliable input

Status: **Improved, unresolved**.

Evidence:

- First ordinary spoken question was captured accurately.
- Emergency question was captured only in fragments.
- A consent question was initially reduced to “de carácter.”
- Later, an entire spoken refusal produced no transcript until the panel was closed and reopened.

The microphone is no longer permanently dead, but the session still degrades and requires manual panel recovery.

### EMMI-LIVE-017 — Medication estimate/refill context

Status: **Improved, partially open**.

The prior uncertain “one week” estimate is replaced by **Ready to review / Listo para revisar**, avoiding the previous five-days-versus-one-week contradiction. Spoken medication-negation behavior was not safely repeated after the operational refusal defect reproduced. Spanish localization remains incomplete.

## Confirmed unresolved prior issues

### EMMI-LIVE-002 — Assistant output cutoff and fragmentation

Status: **Unresolved**.

The first successful voice answer ended permanently at:

> Sí, María, puede continuar más tarde. Su progreso está guardado, así que no

No continuation appeared after an additional wait. The emergency response also first emitted the orphan fragment **“Por favor,”** before a later answer.

### EMMI-LIVE-008 — Spoken language switch

Status: **Unresolved**.

Test:

1. Switched EMMI/page to English through the visible language selector.
2. Activated **Ask by voice**.
3. Spoke: “Prefiero hablar en español. Hable conmigo en español ahora.”

Observed:

- No new user transcript appeared.
- EMMI stayed in English.
- It answered prior conversation context instead of acknowledging the language request.

The visible UI language selector itself remains synchronized; the spoken switch is the failing path.

### EMMI-LIVE-009 — Premature VAD / split utterances

Status: **Unresolved**.

The emergency question was split into:

- “180 sobre 120 y me siento mareado.”
- “sistema dice al equipo”

EMMI began a response between the two fragments. A later refusal was split into three separate patient turns.

### EMMI-LIVE-011 — Medicare comparison-group facts

Status: **Unresolved and materially incorrect**.

Spoken question intended:

> ¿El grupo de comparación se elige al azar y me excluye por doce meses?

ASR retained only “me excluye por 12 meses.” EMMI answered:

> No, María, no se le excluye por 12 meses. Puede regresar cuando quiera…

This directly contradicts the required 12-month consequence when selected for the comparison group and omits random assignment.

### EMMI-LIVE-014 — Consent cost and withdrawal terms

Status: **Unresolved**.

After panel recovery, spoken question:

> ¿Cuánto puede costar ACCESS al mes y cuándo puedo dejar el programa?

ASR changed ACCESS to “AT&T,” but EMMI inferred the program context. It did not state the authoritative up-to-$6 amount and again said the patient can leave **“cuando quiera.”** The displayed consent term is leave/change beginning 90 days after enrollment.

### EMMI-LIVE-016 — Explicit refusal inverted into a task

Status: **Unresolved — critical reproduction**.

Spoken instruction:

> No programes una cita. No crees una tarea. Solo dime cómo contacto al equipo.

ASR split/inverted it into:

- “No, pero dame una cita.”
- “Es una tarea.”
- “Solo di me como contacto al equipo.”

EMMI responded:

> De acuerdo, he creado una tarea para que el equipo de atención se comunique con usted.

No separate read-back or confirmation was requested. Back-office creation was not independently verified, but the claimed mutation against an explicit refusal remains a release blocker.

### RETEST-NEW-003 — Spanish medication localization

Status: **Unresolved**.

The Spanish **Mis medicamentos** screen still contains:

- `Take once daily`
- `Take once daily at bedtime`

## Issues not re-testable in the retained session

These are **not marked resolved**:

| Issue | Reason |
|---|---|
| EMMI-LIVE-001 premature device troubleshooting | Monitor is already requested in the retained patient state. |
| EMMI-LIVE-015 invented pre-order device state/cost | No clean pre-order state was available without creating a new journey. |
| EMMI-LIVE-010 echo creates false affirmative | Limited silence observations did not reproduce it, but input instability prevents certification. |
| EMMI-LIVE-012 pre-consent false enrollment state | Patient is already enrolled. |
| EMMI-LIVE-007 stale identity disclaimer | Identity-to-care transition was not available. |
| EMMI-LIVE-004 helper-role guidance | Current enrolled resume no longer exposes the role screen through normal navigation. |

## Round-2 voice transcript summary

| Turn | Intended speech | Capture | Result |
|---|---|---|---|
| 1 | Finish setup later without losing enrollment | Complete | Relevant answer, but permanently cut off mid-sentence. |
| 2 | 180/120, dizzy, wait for automatic alert? | Split into two turns | Correct 911 guidance. |
| 3 | Cost and withdrawal terms | Captured as unrelated fragment | Stale emergency response. |
| 4 | Shorter cost/withdrawal question | ACCESS→AT&T | Material terms still wrong. |
| 5 | Random comparison group / 12 months | Only second clause retained | EMMI incorrectly denied 12-month exclusion. |
| 6 | Explicitly no appointment/task | Entire turn initially lost | Required panel recovery. |
| 7 | Repeat explicit refusal | Split and meaning inverted | EMMI claimed task creation. |
| 8 | Spoken switch to Spanish | No transcript | Stayed English and answered stale context. |

## Required P0 corrections

1. Preserve the complete utterance across pauses and barge-in using bounded microphone pre-roll and continuation merging.
2. Drive listening state from verified incoming audio and automatically recover a stalled provider input stream.
3. Make assistant generation atomic; a terminal turn must end on a semantic boundary or display an explicit recoverable error.
4. Treat negative constraints as durable structured intent. Never create/claim appointment, callback, task or refill actions without a separate exact read-back and affirmative confirmation.
5. Ground comparison-group, consent-cost and withdrawal answers in authoritative versioned program facts.
6. Route explicit spoken language requests before normal response generation and clear stale pending generations during locale changes.

## Exit criteria

- 20/20 ordinary spoken turns captured completely without panel recovery.
- 10/10 natural-pause and barge-in turns remain one complete patient intent.
- Zero assistant responses terminate mid-sentence in 50 turns.
- Spoken English↔Spanish switching succeeds in one turn and never answers stale context.
- Comparison-group answer includes random assignment and 12-month consequence.
- Consent answer includes up to $6/month and the exact 90-day timing.
- Ten explicit spoken refusals result in zero operational actions/claims.
- Spanish medication directions are fully localized.

## Final QA decision

**FAIL — do not close the voice remediation work.**

Round 2 confirms meaningful progress, but the remaining failures affect consent accuracy, Medicare eligibility disclosure, operational authorization and basic conversational integrity. No application code was changed during this QA run.
