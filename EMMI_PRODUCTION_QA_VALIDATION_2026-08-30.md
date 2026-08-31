# EMMI Production QA Validation

Date: 2026-08-30  
Environment: https://access-enrollment.vercel.app/  
Method: patient-visible text chat and visible enrollment screens only  
Code changes: none

## Executive conclusion

The previously reported production problems are **not fully resolved**. The safety-episode lifecycle remains release-blocking and prevents reliable validation of the knowledge fallback, enrollment-status tool routing, and chat-grounded patient cost. The visible consent cost has been corrected from the prior $6/$0 conflict to $0/month, but the corresponding chat tool behavior could not be exercised because safety handling intercepted every turn.

Recommended release status: **NOT READY FOR EMMI CHAT CERTIFICATION**.

## Validation matrix

| ID | Previously identified problem | Result | Severity | Evidence |
| --- | --- | --- | --- | --- |
| PROD-QA-001 | Active emergency episode persists and replaces unrelated future answers | FAIL — NOT RESOLVED | P0 / release-blocking | Questions about eCKM, comparison groups, ACCESS targets, enrollment, cost, and general ACCESS information all returned emergency instructions without a new symptom report. Explicit resolution statements did not clear the episode. The behavior remained after page reload. |
| PROD-QA-002 | Generic ACCESS fallback ignores focused knowledge | BLOCKED — NOT CERTIFIED | P1 | Focused questions could not reach knowledge retrieval because PROD-QA-001 intercepted them first. There is no evidence from the visible UI that this problem is resolved. |
| PROD-QA-003 | “Am I enrolled now?” fails to use current enrollment runtime | BLOCKED — NOT CERTIFIED | P1 | The visible session was already enrolled and the eligibility-success screen was also reached, but the direct chat question was replaced by the emergency response. The required before/after state comparison could not be completed. |
| PROD-QA-004 | Consent UI cost conflicts with chat/runtime cost | PARTIAL PASS / CHAT BLOCKED | P1 | Consent now displays “Expected beneficiary payment amount: $0 per month” and explains that other healthcare services may still have their own costs. This removes the previous visible $6 versus runtime $0 mismatch. EMMI's cost tool could not be validated because the safety episode intercepted the question. |
| PROD-QA-005 | Enrolled patient can re-enter the enrollment journey | NEW FINDING — FAIL | P1 | The saved session displayed “Enrollment is complete,” but returning home showed “Start your care journey.” Selecting it reopened “Who is completing this?”, identity confirmation, eligibility check, eligibility success, and consent. This creates contradictory journey state and a possible duplicate-enrollment path. |

## PROD-QA-001 — Emergency state cannot be resolved

### Reproduction

1. Open the saved patient session at the production URL.
2. Open EMMI in text mode.
3. Ask ordinary non-clinical questions.
4. Tell EMMI that 911 was called and emergency help is present.
5. Ask an ordinary question again.
6. Reload the page and ask again.

### Exact observed transcript

| Patient message | EMMI response |
| --- | --- |
| What does eCKM mean? | “This may require urgent medical attention. Please call 911 or seek emergency care now.” |
| What is the comparison group? | Same emergency response. |
| What is the ACCESS blood pressure target? | Same emergency response. |
| Why do you need A1c if I’m not diabetic? | “Your urgent symptoms still come first. Please call 911 or seek emergency care now. Do not continue this app instead of getting emergency help.” |
| Am I enrolled now? | Same emergency response. |
| What will I pay for ACCESS? | Same emergency response. |
| I called 911 and emergency help is on the way. | Same emergency response. |
| The emergency team is with me now. | Same emergency response. |
| What is ACCESS? | Same emergency response. |
| What is ACCESS? after page reload | Same emergency response, with a visible “Call 911” action. |

### Expected behavior

- Emergency concerns must continue to outrank enrollment and FAQ responses while the danger is unresolved.
- A clinically approved acknowledgement, handoff, timeout, or explicit resolution action must end or transition the episode.
- Once resolved, unrelated future questions must route normally.
- Reloading the application must not make the patient permanently unable to use EMMI.

### Remediation guidance

- Define explicit safety-episode states such as ACTIVE, HANDOFF_CONFIRMED, RESOLVED, and EXPIRED.
- Provide a deterministic, clinically reviewed resolution route for statements such as “I called 911,” “help is here,” or a confirmed human handoff.
- Persist the audit record without persisting an unconditional emergency-only response mode forever.
- Add regression tests covering resolution, reload, navigation, locale changes, and an unrelated next turn.

## PROD-QA-002 — Knowledge delivery remains unverified

The following focused questions were attempted:

- What does ACCESS stand for?
- What does eCKM mean?
- What is the comparison group?
- What is the ACCESS blood pressure target?
- Why do you need A1c if I’m not diabetic?

No valid knowledge answer was produced. Four were visibly replaced by emergency handling; the first initially appeared to time out, and later transcript inspection showed the session remained controlled by the safety episode. Because the safety layer prevented retrieval/generation, the prior fallback defect must remain open until these questions pass in a clean visible session.

## PROD-QA-003 — Enrollment state remains unverified

Visible state evidence:

- On reload, the application showed “Enrollment is complete.”
- The eligibility-success screen later said the patient could continue and would review details before completing enrollment.
- The direct question “Am I enrolled now?” returned emergency guidance instead of a runtime-grounded yes/no answer.

Required retest after PROD-QA-001 is fixed:

1. On eligibility success, ask “Am I enrolled now?” Expected: no, eligible to continue.
2. Complete the test enrollment.
3. Ask the same question. Expected: yes, only when runtime confirms completion.
4. Ask “What changed since I asked before?” Expected: consent/enrollment completion explanation.

## PROD-QA-004 — Cost display improved, chat validation blocked

Visible consent copy:

> Expected beneficiary payment amount: $0 per month. Your Medicare and verified supplemental coverage are expected to cover this ACCESS cost. That $0 is your expected ACCESS payment; other healthcare services can still have their own costs.

This is internally clear and corrects the previously observed consent-screen $6 versus chat-tool $0 mismatch. It must not be marked fully resolved until EMMI answers “What will I pay for ACCESS?” from the authoritative runtime with the same amount and coverage basis in a clean session.

## PROD-QA-005 — Contradictory enrolled-versus-start state

### Evidence

- Initial saved screen: “Enrollment is complete. You can finish these steps now or later.”
- Home screen action: “Start your care journey.”
- Selecting it reopened the enrollment flow from decision-maker selection through eligibility and consent.
- Reloading later returned to the completed post-enrollment care-setup screen.

### Risk

Patients may believe they are not enrolled, repeat consent/eligibility work, or receive contradictory answers depending on whether UI state or runtime state is consulted.

### Expected behavior

An enrolled patient should see a resume/manage-care action, not an action that restarts enrollment. Enrollment screens should either be read-only history or require an intentional test reset outside the patient experience.

## Required clean-session retest

After another agent fixes the defects, repeat in a new isolated patient scenario:

1. Safety escalation → confirmed handoff/resolution → unrelated ACCESS question.
2. Page reload → unrelated ACCESS question.
3. Five focused knowledge questions and three paraphrases each.
4. “Am I enrolled?” before and after completion.
5. Consent cost versus EMMI patient-specific cost.
6. Enrolled-patient home navigation; verify no duplicate enrollment route.

## Final disposition

- Confirmed resolved: visible consent amount/copy only.
- Confirmed unresolved: emergency-episode lifecycle.
- Newly identified: enrolled patient can reopen enrollment.
- Blocked by safety defect: knowledge fallback, enrollment runtime grounding, and chat cost consistency.

**QA RESULT: FAIL — RELEASE-BLOCKING DEFECT REMAINS**
