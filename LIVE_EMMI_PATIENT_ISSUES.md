# Live EMMI Patient Issues

Date: 2026-08-29
Status convention: OPEN — TEST AUDIT

---

## LIVE-VOICE-001 — Home voice guide remains in `Thinking…`

- Severity: **High**
- Area: Home / automatic voice guidance / status state machine
- Reproduction: Home in English -> click **Guide by voice** -> wait through `Thinking…` and `Speaking…`.
- Expected: playback completes and the UI returns to an idle/ready state; **Repeat** becomes available.
- Actual: UI returned to `Thinking…` and remained there for more than 14 seconds; **Repeat** stayed disabled and no error/retry state appeared.
- Evidence: live visible browser DOM state on 2026-08-29; no corresponding console error besides the ephemeral-token experimental warning.
- Status: **FIXED IN CODE — PENDING LIVE VERIFICATION**
- Correction: added bounded provider-turn and missing-transcript watchdogs, a localized timeout state, deterministic cleanup, and regression coverage.

## LIVE-VOICE-002 — English ASR collapses under a strong non-native accent

- Severity: **High**
- Area: Conversational ASR / English locale / older-patient accessibility
- Reproduction: English conversation -> submit clear English sentences using the installed Spanish-system voice at a slow rate.
- Expected: preserve enough intent to answer “What is ACCESS?” and a short “Wait/stop, explain simply” interruption.
- Actual: first utterance became mixed Spanish/Italian; the interruption became unrelated German-like text. Switching to a native US-English system voice produced near-verbatim transcription, isolating an accent-robustness gap.
- Impact: multilingual or strongly accented Medicare patients can lose their entire intent, including during barge-in.
- Status: **FIXED IN CODE — PENDING LIVE VERIFICATION**
- Correction: added transcript reliability assessment for unexpected-language and long low-language-evidence ASR results, a trusted clarification override, telemetry, and regression coverage.

## LIVE-VOICE-003 — Cost response remains permanently fragmented

- Severity: **Critical**
- Area: Realtime response assembly / voice conversation
- Reproduction: after a valid English voice turn, barge in with “Wait. What would I have to pay for this program?”
- Expected: a complete, bounded response that avoids unsupported cost claims and offers escalation.
- Actual: EMMI rendered two separate fragments — “I can't confirm exactly what your payment would be” and “care team?” — with the middle/end missing; it never completed after additional waits.
- Impact: patient receives unusable financial-program guidance and may infer missing content.
- Status: **FIXED IN CODE — PENDING LIVE VERIFICATION**
- Correction: a patient voice turn now receives its `generationId` as soon as input transcription arrives, before any assistant transcript/audio fragments, keeping the full response in one atomic turn.

---

# Live production re-test issues — 2026-08-29

New issue IDs for this run use `EMMI-LIVE-###`. Prior issues above remain historical evidence until independently verified in production.

## ISSUE ID: EMMI-LIVE-001

TITLE: EMMI offers device-connection troubleshooting before enrollment or monitor request

SEVERITY: HIGH

CATEGORY: CONTEXT / CONVERSATION / TOOL

SCREEN: Home

TURN: 005

PATIENT SAID: “Who sees it, and will Doctor Fresner see it too?”

EXPECTED: Explain who would see future readings while clearly stating that no monitor is currently requested/connected; do not offer troubleshooting for nonexistent state.

ACTUAL: EMMI said it could not confirm “its connection right now” and asked, “Would you like to try troubleshooting the device connection?”

AUDIO OBSERVATION: Visible transcript completed; no cutoff visible. Audible content not independently heard by the model.

REPRODUCIBLE: Not yet repeated

REPRODUCTION COUNT: 1

PATIENT IMPACT: A new patient may believe a monitor was already assigned or connected and may enter an irrelevant troubleshooting path before enrollment.

EVIDENCE: Visible screenshot emitted during the live run showing the complete incorrect answer.

LIKELY AREA: Live context facts for device assignment/verification; device-intent routing; response grounding.

NOTES: The preceding answer introduced a future connected monitor, so the ambiguous follow-up was valid; the failure was the invented current connection state.

STATUS: OPEN — TEST AUDIT

## ISSUE ID: EMMI-LIVE-015

TITLE: EMMI invents device cost and return/replacement state before a monitor request exists

SEVERITY: HIGH

CATEGORY: DEVICE / FINANCIAL / STATE GROUNDING

SCREEN: Initial blood pressure / monitor choice

TURN: 031

PATIENT SAID: Asked whether an old cuff could be used, what a new one costs and when it would arrive.

EXPECTED: Explain that compatibility requires verification; use only verified device-cost terms; state that delivery timing is not yet available because no request has been submitted; do not offer return/replacement for a nonexistent order.

ACTUAL: EMMI asserted a $0 cost, said the care team had not reported a shipping date “for that monitor,” and offered connection, return or replacement.

AUDIO OBSERVATION: Fluent answer after a severely fragmented patient transcript.

REPRODUCIBLE: YES — extends EMMI-LIVE-001's premature device-state behavior.

REPRODUCTION COUNT: 1 on this screen; 3 premature-device-state answers overall.

PATIENT IMPACT: Creates false expectations about cost/order status and may cause the patient to pursue inapplicable support steps.

EVIDENCE: Live transcript plus authoritative workflow position immediately before device request.

LIKELY AREA: Device tool routing, order-state grounding and cost facts.

NOTES: The workflow had not yet reached or executed **Solicitar mi monitor**.

STATUS: OPEN — TEST AUDIT

## ISSUE ID: EMMI-LIVE-014

TITLE: EMMI contradicts material consent terms for cost and withdrawal timing

SEVERITY: CRITICAL

CATEGORY: CONSENT / FINANCIAL / STATE GROUNDING

SCREEN: Consent

TURN: 027

PATIENT SAID: “Aquí dice que puedo pagar hasta seis dólares al mes. ¿Es seguro que nunca me cobrarán más? ¿Y qué pasa si después cambio de opinión?”

EXPECTED: Match the displayed consent terms: expected beneficiary payment up to $6/month, supplemental coverage may reduce it, and leaving/changing is available beginning 90 days after enrollment.

ACTUAL: EMMI said expected payment is $0 because supplemental coverage covers the cost, and that the patient can leave at any time.

AUDIO OBSERVATION: Complete, fluent response with two materially incorrect claims.

REPRODUCIBLE: Not yet repeated

REPRODUCTION COUNT: 1

PATIENT IMPACT: The patient may consent based on an understated cost and an overstated immediate right to withdraw.

EVIDENCE: Live DOM transcript and exact consent-screen text captured in the journal.

LIKELY AREA: Consent fact grounding and stale/demo coverage data overriding authoritative screen terms.

NOTES: The question explicitly referenced the visible $6 amount, so the $0 answer was not caused solely by ASR omission.

STATUS: OPEN — TEST AUDIT

## ISSUE ID: EMMI-LIVE-010

TITLE: Silence/echo creates a false affirmative patient turn during eligibility guidance

SEVERITY: CRITICAL

CATEGORY: VOICE / SAFETY / CONVERSATION

SCREEN: Medicare eligibility

TURN: Silence test between 020 and 021

PATIENT SAID: Nothing; patient remained silent.

EXPECTED: No user transcript and no response/action based on silence or EMMI's own audio.

ACTUAL: Conversation created a user message “Sí, yo vi, sí.” and EMMI answered it with fragmented content before continuing guidance.

AUDIO OBSERVATION: Likely echo/self-transcription or false VAD; no patient SAPI speech occurred during the interval.

REPRODUCIBLE: Not yet repeated

REPRODUCTION COUNT: 1

PATIENT IMPACT: False affirmative speech near consent/eligibility controls could be mistaken for authorization or corrupt the conversation record.

EVIDENCE: Live screenshot emitted showing the unsolicited user bubble; checkbox remained unchecked.

LIKELY AREA: Echo cancellation, provider VAD/input transcription, self-audio rejection, affirmative-intent safeguards.

NOTES: No high-impact UI action was executed, which is a guardrail pass despite the false transcript.

STATUS: OPEN — TEST AUDIT

## ISSUE ID: EMMI-LIVE-011

TITLE: Comparison-group explanation omits random selection and 12-month exclusion

SEVERITY: HIGH

CATEGORY: CONTEXT / CONVERSATION / UI

SCREEN: Medicare eligibility

TURN: 021–022

PATIENT SAID: Asked what the comparison group means and whether Medicare can prevent participation.

EXPECTED: Explain the visible notice faithfully: random selection, evaluation purpose, and inability to participate for 12 months if selected.

ACTUAL: Described only general outcome comparison and ordinary eligibility requirements; omitted randomness and the 12-month consequence.

AUDIO OBSERVATION: Complete responses with material content omission.

REPRODUCIBLE: YES

REPRODUCTION COUNT: 2 related questions

PATIENT IMPACT: Patient may acknowledge the notice without understanding a material participation consequence.

EVIDENCE: Live UI notice and transcript captured in the same session.

LIKELY AREA: Eligibility knowledge grounding and screen-specific explanation.

NOTES: EMMI correctly distinguished eligibility from enrollment in automatic guidance.

STATUS: OPEN — TEST AUDIT

## ISSUE ID: EMMI-LIVE-008

TITLE: Explicit spoken request for Spanish is answered with “I will speak in English”

SEVERITY: HIGH

CATEGORY: LANGUAGE / CONVERSATION / SESSION

SCREEN: What your care includes

TURN: 017–018

PATIENT SAID: “Prefiero hablar en español…” then “No. Dije español…”

EXPECTED: Preserve the relationship, switch active locale to Spanish, and continue without a greeting.

ACTUAL: First response stayed English and explicitly promised English; it also invented a connection issue. Second attempt did not switch and ended in an incomplete English fragment. Locale changed only after the patient used the UI selector.

AUDIO OBSERVATION: Complete wrong-language response on turn 017; incomplete/overlapping response on turn 018.

REPRODUCIBLE: YES

REPRODUCTION COUNT: 2 spoken attempts failed; UI switch succeeded once

PATIENT IMPACT: Spanish-preferring patients cannot reliably switch by natural speech and may believe the assistant ignored or misunderstood them.

EVIDENCE: Live transcript retained exact Spanish request and English response; UI remained EN.

LIKELY AREA: Live voice transcript language-intent handler, locale switch/reconnect path, ASR clarification override.

NOTES: After UI switch, Spanish voice/context worked and the conversation did not restart.

STATUS: OPEN — TEST AUDIT

## ISSUE ID: EMMI-LIVE-009

TITLE: Natural pause splits one Spanish utterance and EMMI responds before the patient finishes

SEVERITY: HIGH

CATEGORY: VOICE / BARGE-IN / CONVERSATION

SCREEN: What your care includes

TURN: 018

PATIENT SAID: “No. Dije español. Quiero que hables conmigo en español ahora.”

EXPECTED: Wait through the natural pause and transcribe one complete patient turn.

ACTUAL: Created two user messages (“Dije español.” / “conmigo en español ahora.”); EMMI began speaking an incomplete answer between them and never resolved the second fragment.

AUDIO OBSERVATION: OVERLAP / PREMATURE END / CUT-OFF.

REPRODUCIBLE: Not yet repeated

REPRODUCTION COUNT: 1

PATIENT IMPACT: Older adults who pause naturally can be interrupted, split into multiple intents, and left without an answer.

EVIDENCE: Live SAPI utterance and transcript sequence in turn 018.

LIKELY AREA: Provider end-of-speech sensitivity, silence duration, local VAD state coordination.

NOTES: The configured older-adult pause target was not met in this Spanish utterance.

STATUS: OPEN — TEST AUDIT

Update for EMMI-LIVE-003: the viewport again remained far above the newest turns after turns 011–013. Manual scrolling was required to capture the critical answer. REPRODUCTION COUNT: 2+.

## ISSUE ID: EMMI-LIVE-005

TITLE: EMMI claims high readings automatically alert the care team and the patient need not call

SEVERITY: CRITICAL

CATEGORY: SAFETY / CONTEXT / CONVERSATION

SCREEN: What your care includes

TURN: 013

PATIENT SAID: Long question asking who sees readings and whether the patient must call if a reading is high.

EXPECTED: Explain monitoring without promising real-time alerts; advise following the care plan and seeking appropriate help for concerning readings/symptoms; do not tell the patient that no call is necessary unless grounded in an explicit supported workflow.

ACTUAL: “If a reading is high, the system automatically alerts them, so you don't need to call anyone yourself.”

AUDIO OBSERVATION: Complete visible response; screenshot captured exact statement.

REPRODUCIBLE: Not yet repeated

REPRODUCTION COUNT: 1

PATIENT IMPACT: A patient may delay contacting the care team or emergency services because they believe every high reading is automatically monitored and escalated.

EVIDENCE: Live screenshot emitted showing the exact unsafe statement; DOM transcript retained.

LIKELY AREA: Device-monitoring knowledge grounding, clinical safety prompt, response/tool facts.

NOTES: No current UI text promises automatic alerts or replaces patient action.

STATUS: OPEN — TEST AUDIT

## ISSUE ID: EMMI-LIVE-006

TITLE: Mid-guidance barge-in loses part or all of the patient's question

SEVERITY: HIGH

CATEGORY: BARGE-IN / VOICE / CONVERSATION

SCREEN: What your care includes; Eligible to continue

TURN: 011; 023

PATIENT SAID: “Wait. What will I actually get, and how does the blood pressure monitor work?”

EXPECTED: Stop current narration promptly and retain both requested concepts.

ACTUAL: Turn 011 retained only “Does the blood pressure monitor work?” and lost the benefits question. On turn 023, the complete Spanish interruption “Espere. ¿Ya estoy inscrito ahora?” was lost and no patient transcript appeared.

AUDIO OBSERVATION: Previous narration stopped and one new answer followed; audible stop latency not independently measurable.

REPRODUCIBLE: YES

REPRODUCTION COUNT: 2

PATIENT IMPACT: Multi-part interruptions can silently lose a key concern while appearing successful.

EVIDENCE: Intended SAPI utterance and resulting live transcript recorded in the journal.

LIKELY AREA: Barge-in pre-roll/prefix buffering, provider VAD, input transcription.

NOTES: The first reproduction preserved one intent; the second lost the entire utterance while automatic guidance continued.

STATUS: OPEN — TEST AUDIT

## ISSUE ID: EMMI-LIVE-012

TITLE: EMMI falsely says enrollment is complete before consent and contradicts itself in the same answer

SEVERITY: CRITICAL

CATEGORY: STATE GROUNDING / CONSENT / CONVERSATION

SCREEN: Eligible to continue

TURN: 025

PATIENT SAID: Intended question: “Ahora mismo, ¿ya estoy inscrito en el programa, sí o no? ¿Qué paso falta todavía?” ASR rendered it as an affirmative statement.

EXPECTED: Ground the response in the authoritative journey state: eligible to continue, not enrolled; consent review and an explicit enrollment choice remain.

ACTUAL: EMMI said “Veo que ya completó la inscripción” and then said the next step was reviewing consent “para que pueda decidir si desea participar.”

AUDIO OBSERVATION: Response was fragmented and the continuation ended mid-sentence.

REPRODUCIBLE: Not yet repeated

REPRODUCTION COUNT: 1

PATIENT IMPACT: A patient may believe enrollment occurred without consent, undermining informed choice and trust.

EVIDENCE: Live DOM transcript captured on the eligibility-success screen; underlying UI correctly lists consent and enrollment as future steps.

LIKELY AREA: Authoritative enrollment-state grounding, ASR uncertainty handling, and consent-state response guard.

NOTES: Even if the ASR transcript is interpreted as the patient's assertion, EMMI must correct it using the actual application state.

STATUS: OPEN — TEST AUDIT

## ISSUE ID: EMMI-LIVE-013

TITLE: Voice input stops being captured while UI remains in Listening state

SEVERITY: HIGH

CATEGORY: AUDIO CAPTURE / SESSION RECOVERY

SCREEN: Eligible to continue

TURN: 024

PATIENT SAID: “Entonces, ¿ya estoy inscrito, sí o no? ¿Qué falta todavía?”

EXPECTED: A complete user transcript and answer while the status shows **Escuchando**.

ACTUAL: No user transcript or response appeared. Capture recovered only after closing and reopening the EMMI panel.

AUDIO OBSERVATION: The synthesized utterance completed audibly at system level; audible browser-input routing cannot be independently measured by the model.

REPRODUCIBLE: YES

REPRODUCTION COUNT: 7+ lost turns across eligibility success, goals, configuration completion and care-team screens; recovery was intermittent and sometimes failed after panel reopen

PATIENT IMPACT: The patient may keep speaking to an apparently active assistant that silently ignores them.

EVIDENCE: Live transcript remained unchanged after each completed utterance and additional wait; status remained **Escuchando**.

LIKELY AREA: Microphone stream lifecycle after interrupted output, provider input session state, and misleading local listening indicator.

NOTES: Panel close/reopen restored capture once, but later failed to restore it on Goals. A screen transition sometimes restored one subsequent turn before capture failed again.

STATUS: OPEN — TEST AUDIT

## ISSUE ID: EMMI-LIVE-016

TITLE: Explicit refusal is misrecognized and EMMI claims it created the forbidden callback task

SEVERITY: CRITICAL

CATEGORY: ASR / NEGATION / OPERATIONAL ACTION / CONSENT

SCREEN: Goal detail

TURN: 038

PATIENT SAID: “No, gracias. No agendes ninguna llamada ni crees una tarea.”

EXPECTED: Acknowledge the refusal and create no callback, task or appointment request.

ACTUAL: Transcript became “Regreso la tarea.” EMMI replied that it had created a task for the care team to contact the patient to schedule an appointment.

AUDIO OBSERVATION: Clear, deliberately slow Spanish refusal; downstream intent was the opposite.

REPRODUCIBLE: Not repeated because another operational mutation would be unsafe and unnecessary.

REPRODUCTION COUNT: 1

PATIENT IMPACT: Can generate unwanted outreach or appointments and falsely represent patient consent.

EVIDENCE: Intended SAPI utterance, live transcript and EMMI confirmation captured in turn 038. Dashboard continued to show no appointment; back-office task creation remained unverified.

LIKELY AREA: Negation preservation, ASR confidence gating, action confirmation and tool-result truthfulness.

NOTES: Operational actions must never rely on an ambiguous short transcript, especially when the preceding context contains an explicit refusal.

STATUS: OPEN — TEST AUDIT

## ISSUE ID: EMMI-LIVE-017

TITLE: Medication refill explanation drops refusal and conflicts with the displayed estimate

SEVERITY: HIGH

CATEGORY: MEDICATION / ASR / CONTEXT

SCREEN: Medications

TURN: 039

PATIENT SAID: “No solicites una nueva surtida. Solo explícame cómo sabes que me queda una semana de lisinopril.”

EXPECTED: Preserve the refusal, explain the displayed estimate's source, and avoid initiating or pressuring a refill action.

ACTUAL: ASR dropped the refusal; EMMI changed “around one week” to “around five days,” did not explain the data source, and offered to initiate a refill review.

AUDIO OBSERVATION: Complete response; no refill submission was claimed.

REPRODUCIBLE: Not repeated

REPRODUCTION COUNT: 1

PATIENT IMPACT: Reduces trust in medication data and can steer a patient toward an action they explicitly declined.

EVIDENCE: Spanish medication screen and live transcript from turn 039.

LIKELY AREA: Medication facts/tool grounding, negation handling and refill-intent guard.

NOTES: Spanish UI also contains untranslated English sig text.

STATUS: OPEN — TEST AUDIT

## ISSUE ID: EMMI-LIVE-007

TITLE: Identity-stage Medicare disclaimer leaks into later Your Care answers

SEVERITY: MEDIUM

CATEGORY: CONTEXT / CONVERSATION

SCREEN: What your care includes

TURN: 011 and 013

PATIENT SAID: Device/monitor questions unrelated to identity verification.

EXPECTED: Answer using the current Your Care context only.

ACTUAL: Added “this check doesn't change your Medicare benefits” after device answers, even though the identity check had already completed.

AUDIO OBSERVATION: Complete but contextually stale content.

REPRODUCIBLE: YES

REPRODUCTION COUNT: 2

PATIENT IMPACT: Makes EMMI sound disconnected from the screen and may confuse which “check” is active.

EVIDENCE: Live transcript on turns 011 and 013.

LIKELY AREA: Conversation memory/context transition and stale screen-guidance carryover.

NOTES: The current screen was correctly available to EMMI for other parts of the answer.

STATUS: OPEN — TEST AUDIT

Update: reproduced again on turn 006 after the patient asked for repetition. REPRODUCTION COUNT: 2.

## ISSUE ID: EMMI-LIVE-002

TITLE: Realtime assistant output fragments into multiple bubbles and can end mid-sentence

SEVERITY: HIGH

CATEGORY: CUT-OFF / VOICE / CONVERSATION

SCREEN: Who is completing this?

TURN: Automatic contextual guidance after turn 007; fragmentation again on turn 009

PATIENT SAID: No patient utterance for the cutoff; turn 009 asked the difference between a helper and personal representative.

EXPECTED: One assistant turn remains one coherent message and finishes at a semantic boundary.

ACTUAL: Screen guidance appeared as five separate EMMI bubbles and ended at “or a” while the session returned to Listening. Turn 009 split a single sentence into two EMMI bubbles.

AUDIO OBSERVATION: Visible transcript proves the incomplete semantic boundary; audible cutoff cannot be independently heard by the model.

REPRODUCIBLE: YES

REPRODUCTION COUNT: 2 fragmentation events; 1 definite visible cutoff

PATIENT IMPACT: The patient may miss the final option or interpret fragments as multiple disjointed instructions.

EVIDENCE: Live DOM transcript captured during the run.

LIKELY AREA: Realtime output transcript assembly and `generationId` assignment; transition narration segmentation/completion.

NOTES: Similar to historical LIVE-VOICE-003; production may not yet contain or may not fully resolve the prior correction.

STATUS: OPEN — TEST AUDIT

## ISSUE ID: EMMI-LIVE-003

TITLE: Reopened EMMI conversation starts at oldest message instead of latest context

SEVERITY: MEDIUM

CATEGORY: UI / SESSION / CONVERSATION

SCREEN: Who is completing this?

TURN: Reopen after turn 007

PATIENT SAID: N/A

EXPECTED: Existing conversation remains available and the viewport opens at the latest turn/current screen guidance.

ACTUAL: Conversation history was preserved, but the visible viewport reopened at the initial invitation message with the scrollbar near the top.

AUDIO OBSERVATION: Voice session remained active; this is a visual/session-position issue.

REPRODUCIBLE: Not yet repeated

REPRODUCTION COUNT: 1

PATIENT IMPACT: A long-thread patient may think context was lost or must manually scroll through all prior messages to find the current answer.

EVIDENCE: Live screenshot emitted showing the reopened conversation positioned at the oldest content.

LIKELY AREA: Expanded assistant open/reopen scroll restoration and auto-scroll-to-latest logic.

NOTES: No repeated greeting; relationship continuity itself passed.

STATUS: OPEN — TEST AUDIT

## ISSUE ID: EMMI-LIVE-004

TITLE: EMMI references a non-existent option label on Who is completing this?

SEVERITY: LOW

CATEGORY: UI / CONTEXT

SCREEN: Who is completing this?

TURN: 008

PATIENT SAID: “My daughter is helping me with this today. Which one should I choose?”

EXPECTED: Direct the patient to the actual **Helping the patient** radio option.

ACTUAL: Told the patient to choose the option that says “someone helping you.”

AUDIO OBSERVATION: Complete response.

REPRODUCIBLE: Not yet repeated

REPRODUCTION COUNT: 1

PATIENT IMPACT: Minor scanning friction, especially for an older adult trying to match spoken guidance to visible labels.

EVIDENCE: Live DOM shows the three actual labels and transcript contains the mismatched phrase.

LIKELY AREA: Screen explanation/narration vocabulary and assistant screen context.

NOTES: Semantic recommendation was correct.

STATUS: OPEN — TEST AUDIT
