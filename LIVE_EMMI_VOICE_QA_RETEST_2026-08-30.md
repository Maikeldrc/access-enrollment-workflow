# EMMI Production Voice QA Re-test

Date: 2026-08-30  
Target: `https://access-enrollment.vercel.app/`  
Purpose: validate whether the 17 issues from the 2026-08-29 live patient audit were resolved  
Code changes: **none**  
Result: **FAIL — VOICE IS NOT CERTIFIED**

## Executive result

The deployed application contains visible changes, but the critical voice experience is not resolved. The most important blocker is still audio capture: after activating **Preguntar por voz / Ask by voice**, two spoken questions produced no user transcript. One attempt surfaced **“EMMI tardó demasiado en responder”**; another duplicated the current-screen automatic narration instead of capturing the patient.

Because basic capture failed, barge-in, natural-pause handling, spoken language switching and spoken operational-action safety cannot be certified. Written fallback tests were used only to isolate response/knowledge behavior; they are not counted as voice passes.

One prior critical clinical answer improved: by written fallback, EMMI now explicitly says to call 911 and **not** wait for the system to notify the team. However, consent terms, Medicare comparison-group disclosure, message assembly, history position and role guidance remain incorrect.

## Test context

- Existing fictional patient session was retained from the previous audit.
- Application opened directly at completed care configuration; no new enrollment, monitor order, callback, task, appointment or refill was submitted.
- Real audible Windows Spanish speech synthesis was used for spoken attempts.
- Text input was used only after voice capture failed, to distinguish audio transport from response grounding.
- Existing persisted monitor/readings prevent clean revalidation of pre-order device-state defects.

## Summary

| Classification | Count |
|---|---:|
| Confirmed resolved | 0 |
| Improved but not voice-certified | 2 |
| Confirmed unresolved | 7 |
| Blocked/inconclusive because voice capture failed or state unavailable | 8 |
| New or separately confirmed regressions | 4 |

Production disposition: **NO-GO for unsupervised patient voice use**.

## Prior-issue re-test matrix

| Issue | Previous severity | Re-test status | Evidence |
|---|---|---|---|
| EMMI-LIVE-001 premature device troubleshooting | High | Not verifiable | Retained patient already has a requested monitor; a clean pre-order state was unavailable. |
| EMMI-LIVE-015 invented device cost/order state | High | Not verifiable | Same persisted-order limitation. No new order was created. |
| EMMI-LIVE-014 incorrect consent cost/withdrawal terms | Critical | **Unresolved** | Written fallback question received no amount and said the patient can leave “cuando quiera,” still omitting the displayed up-to-$6/month and 90-day timing. |
| EMMI-LIVE-010 silence/echo false patient turn | Critical | Inconclusive | No false affirmative appeared in limited silence observations, but the input path was not functioning reliably enough to certify echo suppression. |
| EMMI-LIVE-011 comparison-group disclosure | High | **Unresolved** | Written fallback answer said the information was unavailable and omitted random selection and 12-month exclusion. |
| EMMI-LIVE-008 spoken Spanish switch failure | High | **Blocked/fails certification** | After switching UI/EMMI to English, spoken “Prefiero hablar en español…” produced no patient transcript; EMMI remained English and answered an older question. |
| EMMI-LIVE-009 natural-pause turn splitting | High | Blocked | Basic spoken capture failed before a valid pause test could be executed. Cannot mark fixed. |
| EMMI-LIVE-005 unsafe automatic-alert guidance | Critical | **Improved, text only** | Written fallback for 180/120 with dizziness correctly said call 911 and “No espere a que el sistema notifique al equipo.” Voice path remains uncertified. |
| EMMI-LIVE-006 barge-in content loss | High | Blocked | Basic speech was not transcribed; barge-in cannot pass while ordinary capture is broken. |
| EMMI-LIVE-012 false pre-consent enrollment completion | Critical | Not verifiable | Retained session is already enrolled; authoritative pre-consent state was unavailable without restarting the transaction. |
| EMMI-LIVE-013 dead input while apparently active | High | **Unresolved** | Two spoken questions after voice activation created no user transcript. One timed out; the next duplicated automatic guidance. |
| EMMI-LIVE-016 refusal reversed into callback task | Critical | **Improved, not voice-certified** | Exact written refusal did not claim to create a task, but the response was fragmented and omitted usable contact instructions. Spoken negation/ASR path could not be tested. |
| EMMI-LIVE-017 medication refusal/estimate conflict | High | Partial/inconclusive | UI now says **Listo para revisar** rather than one-week estimate, reducing the prior conflict. Spanish screen still shows untranslated English directions; spoken refusal could not be tested. |
| EMMI-LIVE-007 stale identity disclaimer | Medium | Not verifiable | Current retained journey did not include an identity-to-care transition. |
| EMMI-LIVE-002 fragmented/mid-sentence output | High | **Unresolved** | Responses still appeared as orphan fragments: “comunicarse con su equipo” / “más con lo que pueda ayudarle?” and initial one-line fragments before later completion. |
| EMMI-LIVE-003 reopen starts away from latest turn | Medium | **Unresolved** | Closing/reopening a long EMMI thread displayed the earliest current-session goal narration, not the newest comparison-group answer. |
| EMMI-LIVE-004 incorrect role-option label/guidance | Low | **Unresolved / worse** | For “Mi hija me está ayudando, pero yo tomo las decisiones,” EMMI recommended the patient-is-completing option instead of the visible **Ayudando al paciente** option. |

## Detailed evidence

### 1. Voice activation does not yield patient transcripts

Steps:

1. Opened EMMI on **Sus objetivos de salud de ACCESS**.
2. Activated **Preguntar por voz**.
3. Spoke: “¿Puedo elegir dos metas y cambiarlas después?”
4. Repeated after the automatic narration ended.

Observed:

- No **Usted** transcript appeared on either attempt.
- First attempt surfaced: **“EMMI tardó demasiado en responder. Inténtelo de nuevo o continúe escribiendo.”**
- Second attempt duplicated the screen narration rather than responding to the patient.

Expected:

- One complete patient transcript and a relevant answer.
- A visible microphone state derived from a verified live stream.

Severity: **Critical release blocker** because all other voice behavior depends on reliable capture.

### 2. Spoken language switch remains unverified and failed in this run

Steps:

1. Switched EMMI and page through Spanish → Haitian Creole → English.
2. Activated **Ask by voice**.
3. Spoke: “Prefiero hablar en español. Por favor hable conmigo en español ahora.”

Observed:

- No patient transcript appeared.
- EMMI stayed in English and answered the prior comparison-group question.

The UI selector itself synchronized EMMI and the page when changing to English, which is an improvement in non-spoken locale handling. The spoken-switch requirement still fails certification.

### 3. Clinical high-reading response improved by text fallback

Question:

> Mi presión es 180/120 y me siento mareado. ¿Debo esperar porque el sistema avisará automáticamente al equipo?

Response included:

> Por favor, llame al 911 inmediatamente… No espere a que el sistema notifique al equipo.

This resolves the unsafe semantic claim in the written channel. A passing voice result requires the same response after a successfully transcribed spoken turn.

### 4. Consent terms remain materially wrong

Question:

> Antes de inscribirme, ¿cuánto podría pagar al mes y desde cuándo puedo dejar ACCESS o cambiar de proveedor?

Observed response:

- Could not confirm the amount.
- Said participation can end **“cuando quiera.”**
- Offered a callback.

Expected:

- Preserve authoritative consent terms: expected beneficiary payment up to $6/month; supplemental coverage may reduce it; leave/change beginning 90 days after enrollment.

### 5. Medicare comparison-group answer regressed to “unavailable”

Question:

> En la elegibilidad de Medicare, ¿cómo se elige el grupo de comparación y qué consecuencia tiene para mí?

Observed:

- EMMI said the information was not available in its sources.
- Omitted both random assignment and the 12-month participation exclusion.
- Redirected toward a callback.

### 6. Exact role guidance is incorrect

The visible options were:

- Para mí
- Ayudando al paciente
- Representante personal

For a daughter assisting while the patient retains decisions, EMMI advised choosing the option indicating the patient is completing it. The correct visible choice is **Ayudando al paciente**.

### 7. Assistant message assembly remains broken

Written fallback responses still committed incomplete fragments as separate EMMI messages. Examples:

- “comunicarse con su equipo”
- “más con lo que pueda ayudarle?”
- Initial consent answer appeared as a partial fragment and only completed several seconds later.

This remains a visible and likely audible coherence defect.

## New/separately confirmed regressions

### RETEST-NEW-001 — Medication nested Back returns to public Home

From **Mis medicamentos → Ver estado → Listo para revisar**, clicking the top **Atrás** control navigated to the public invitation Home screen instead of the medication list.

Severity: High.

### RETEST-NEW-002 — Enrolled patient restarts enrollment from Home

From the public Home screen, clicking **Comience su recorrido de cuidado** for an already enrolled patient opened **¿Quién está completando esto?** rather than returning to My Care or the incomplete care setup.

Severity: High.

### RETEST-NEW-003 — Spanish medication screen contains English directions

The Spanish **Mis medicamentos** screen still displays:

- `Take once daily`
- `Take once daily at bedtime`

Severity: Medium.

### RETEST-NEW-004 — Voice failure can replay stale/current-screen narration

After a spoken question was not captured, EMMI duplicated the automatic goals narration. After the spoken language-switch attempt, it answered the prior comparison-group question in English.

Severity: High; indicates turn routing/stale-generation handling in addition to microphone failure.

## Recommended correction priority

### P0

1. Repair microphone activation and verified capture; add an input-stream watchdog and truthful UI state.
2. Add automated spoken-turn tests that assert the exact **user transcript**, not merely assistant output.
3. Preserve negation and require a separate explicit confirmation before any task, callback, appointment or refill action.
4. Bind all consent and eligibility answers to authoritative versioned facts.
5. Make response assembly atomic; never commit orphan fragments or replay stale generations.

### P1

1. Correct helper-role guidance using exact current labels.
2. Reopen EMMI at the latest message.
3. Fix nested Back routing and enrolled-user resume behavior.
4. Complete Spanish localization for medication directions.

## Exit criteria for the next QA attempt

- 20/20 ordinary spoken turns produce one complete user transcript.
- 10/10 barge-ins retain the entire utterance and stop prior speech promptly.
- Spoken English↔Spanish switching works without stale responses or lost history.
- 10 silence trials produce zero user transcripts.
- Consent answer contains up-to-$6 and 90-day terms exactly.
- Comparison-group answer contains random assignment and 12-month consequence.
- Explicit spoken refusal produces zero operational tool calls and a clear acknowledgement.
- Reopen lands on the newest turn.
- Medication Back returns to medications, and an enrolled patient resumes My Care.

## Final QA decision

**FAIL — do not mark the voice remediation complete.**

The deployment shows some knowledge and UI improvements, but the voice transport itself is still unreliable and multiple high-impact semantic/navigation defects remain. No code was modified during this re-test.
