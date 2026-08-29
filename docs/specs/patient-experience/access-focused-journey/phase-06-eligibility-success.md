# Phase 06 — Eligibility success milestone

**Status:** complete
**Screen:** `ACCESS_ELIGIBILITY_RESULT`, eligible outcome (`eligibilityResult()` in `src/app.js`)
**Commit:** `14be552` — `feat(access-patient): phase-06 positive eligibility milestone`

---

## What changed and why

The patient has just cleared a check that could have placed them in a comparison group for twelve
months. The screen told them *"You're eligible to continue. Your enrollment is not complete yet."*
The good news and a correction, in that order — and the correction was the part written in the
patient's own sentence.

Both facts still have to be true on this screen: they may continue, and they have enrolled in
nothing. The second is now carried forward instead of backward. *"Everything is ready for you to
continue. We'll review the details together before completing your enrollment."* says the same
thing, as the next step rather than as a shortfall.

## Files changed

| File | Change |
| --- | --- |
| `src/app.js` | Eligible title and description; steps 1 and 2 of "What happens next?"; the `NO_COMMITMENT_YET` assurance wording; `canContinue` / `enrollmentComplete` added to EMMI's context |
| `src/emmi/textOrchestrator.js` | "Am I enrolled?" routes to the enrollment context; that answer now honours enrollment status |
| `src/emmi/systemPrompt.js`, `src/emmi/config.js` | An explicit eligibility-is-not-enrollment rule; prompt version → `v3` |
| `e2e/access-journey.spec.js` | Five Phase 6 tests |
| `e2e/enrollment.spec.js` | Updated to the new copy |

## Copy changed

| Element | Before | After |
| --- | --- | --- |
| Title | You're eligible to continue | Great news — you can continue with ACCESS |
| Description | You're eligible to continue with this ACCESS care option. Your enrollment is not complete yet. | Everything is ready for you to continue. We'll review the details together before completing your enrollment. |
| Step 1 | Review important ACCESS information | Learn about your ACCESS care |
| Step 2 | Agree to enroll with ITERA HEALTH | Confirm that you'd like to enroll with ITERA HEALTH |
| Step 3 | *(unchanged)* We'll complete your ACCESS enrollment with Medicare | |
| Footer | You'll review the details before you enroll | You'll review all the details before completing your enrollment |

Step 1 stopped being paperwork and became learning; step 2 became the patient's confirmation rather
than their agreement to a document. The footer assurance is shared with the care-overview screen and
reads correctly on both.

## The line that must not blur

Positive framing on this screen is one edit away from claiming an enrollment that has not happened.
Three things hold that line, and all three are asserted:

1. The screen is checked to contain none of "you are enrolled", "enrollment is complete" or
   "Medicare enrolled you".
2. The CTA is checked to say **Continue** and not Enroll, Submit, Accept or Complete enrollment.
3. A refresh reproduces the milestone without it turning into an enrollment.

## EMMI

"Am I enrolled now?" reached knowledge retrieval rather than the patient's own record — the
eligibility intent matched "am I eligible" but not "am I enrolled", which is the question a milestone
screen most invites. It now routes to the enrollment context and answers: *"Your current ACCESS
eligibility result shows that you can continue. You are not enrolled until you review the
information and agree."*

Routing that question there exposed a second problem worth fixing on the way: the answer keyed only
off eligibility, so a patient who had **finished** enrolling would still have been told they were not
enrolled. Enrollment is now checked first and reported as its own fact.

The context also carries `canContinue` and `enrollmentComplete` as separate values, with a prompt
rule that they must never be collapsed into one — so an answer never has to infer enrollment from
eligibility.

## Behavior preserved

- Stage (`ELIGIBILITY`), progress indicator, the green success mark, the compact EMMI card, the
  "What happens next?" card, its icons and the Continue CTA are all unchanged.
- Eligibility and enrollment logic, routing and the audit trail are untouched.
- The not-eligible, comparison-group, already-aligned and unavailable outcomes are untouched.

## Tests

- `npm test` — **785 passing**, 0 failing.
- `e2e/access-journey.spec.js` — 25 passing (20 from Phases 2–5, 5 new).

New coverage: the milestone copy, success mark, progress stage, three next steps and the footer; the
no-enrollment-claim guarantee including the CTA vocabulary; the refresh; EMMI answering "Am I
enrolled now?" correctly and never claiming enrollment across the turn; and the layout sweep across
all 21 width × text-scale combinations, with the multi-line headline explicitly checked to stay
inside the page.

## Open issues

None from this phase.
