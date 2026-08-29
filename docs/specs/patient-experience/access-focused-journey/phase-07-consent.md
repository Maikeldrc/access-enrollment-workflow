# Phase 07 — Consent: review and choose

**Status:** complete
**Screen:** `CONSENT_REVIEW`, ACCESS branch (`consent()` in `src/app.js`)
**Commit:** _recorded in the follow-up docs commit_

---

## What changed and why

*Review and agree.* The title told the patient what they were going to do before they had read
anything. The disclosures below it were already careful, already complete and already correct — the
frame around them was the part doing the deciding.

The screen is now **Review and choose**, the intro puts the patient in the subject position, and the
CTA confirms a decision rather than announcing an agreement. Nothing about what is disclosed, what
is required, or what is recorded changed.

**EMMI explains. The patient decides.**

## Files changed

| File | Change |
| --- | --- |
| `src/app.js` | Title, intro, disclosure 4 and 5 titles, disclosure 4 body, CTA |
| `src/emmi/textOrchestrator.js` | The cost intent recognises a quoted dollar amount |
| `e2e/access-journey.spec.js` | Seven Phase 7 tests |
| `e2e/enrollment.spec.js` | Updated to the new copy, including both localized variants |

## Copy changed

| Element | Before | After |
| --- | --- | --- |
| Title | Review and agree | Review and choose |
| Intro | Review the information below before choosing whether to enroll. | Review the key details below. You decide whether you want to enroll in ACCESS. |
| Disclosure 4 | One ACCESS provider for this type of care / You can have one ACCESS provider for this type of care at a time. | One ACCESS care provider at a time / You can receive this type of ACCESS care from one participating provider at a time. |
| Disclosure 5 | Changing or ending ACCESS care | You can change your ACCESS care *(body unchanged)* |
| CTA | Agree and continue | Confirm and continue |

Disclosures 1 and 2 already read exactly as this phase specifies and were left alone. Disclosure 5's
title changed because the rule is a right the patient holds, not an administrative event that might
happen to them; the ninety-day sentence beneath it is untouched.

The non-ACCESS consent screen keeps *Review and agree* and *Enroll now* — it is a different screen
for different programs and is not in this phase's scope. The long-form text behind **View full
ACCESS information** is also untouched.

## The cost row was deliberately not rewritten

This phase specifies: *"Your expected ACCESS payment is $0 per month based on the Medicare and
supplemental coverage we verified. Other healthcare services may still have their own costs."*

What the screen already says is:

> Expected beneficiary payment amount: $0 per month. Your Medicare and verified supplemental
> coverage are expected to cover this ACCESS cost. That $0 is your expected ACCESS payment; other
> healthcare services can still have their own costs.

It satisfies every rule this phase states — no "ACCESS is free", no assumption that supplemental
coverage universally means $0, and the amount produced by `resolveExpectedPatientResponsibility`
rather than written into the screen — and it additionally leads with **"Expected beneficiary payment
amount"**, which is regulated phrasing. Swapping it for the shorter sentence would drop that phrase
for a small readability gain, which the global rule against simplifying away regulatory language
forbids. Left as is; flagged here rather than changed quietly.

`accessCostSummary()` remains fully runtime-driven: seven explanation codes, each with its own copy,
covering verified supplemental coverage, unknown coverage, stale verification, unverifiable
coverage, QMB rules and Medicare Advantage. A `$0` only ever appears for the code that earns it.

## Signer authority, unchanged

`Signing as` still resolves from the real enrollment actor, and the representative path still
presents a different agreement sentence — on behalf of the patient — plus its own separate authority
attestation. Both are asserted, so a future edit to the patient wording cannot silently reshape the
representative's.

## Consent mechanics, unchanged

One checkbox, never preselected, CTA disabled until it is ticked — and now asserted to go back to
disabled when it is unticked, because consent is withdrawable right up to the moment it is given.

The audit trail is asserted field by field after consenting: `consentSaved`, `consentRole`,
`consentVersion`, `consentTimestamp`, `disclosureVersion`, `language`, `consentAcknowledgement`, and
a `consent_saved` event in the audit log.

## EMMI

Three questions, three behaviours:

- *"Do I have to enroll?"* — answered as a choice.
- *"Why does it say $0?"* — reached knowledge retrieval rather than the cost engine, because the cost
  intent matched cost *words* but not a quoted **amount**. It now routes to
  `getExpectedAccessCost`, so the answer comes from the engine that produced the number.
- *"Can you agree for me?"* — the deterministic guardrail: *"I cannot consent for you."*

The test also asserts what EMMI must not do on this screen: no "you should enroll", no "I recommend
enrolling", no "it is free", no urgency — and the consent box is still unticked when the
conversation ends.

## Tests

- `npm test` — **785 passing**, 0 failing.
- `e2e/access-journey.spec.js` — **32 passing** (25 from Phases 2–6, 7 new).

New coverage: the five disclosure titles and bodies in order; the cost row grounded in the verified
amount with no free-care claim; one unticked box gating the CTA in both directions; the signer for
patient and representative; the audit trail after consent; EMMI explaining without selling or
ticking; and the layout sweep across all 21 width × text-scale combinations with a 44 px minimum on
the consent row.

## Open issues

The cost-row wording described above, kept deliberately and flagged for a copy decision.
