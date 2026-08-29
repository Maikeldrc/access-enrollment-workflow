# Phase 05 — Medicare / ACCESS eligibility review

**Status:** complete
**Screen:** `ACCESS_PRE_ELIGIBILITY_NOTICE` (`accessNotice()` in `src/app.js`)
**Commit:** _recorded in the follow-up docs commit_

---

## What changed and why

This is the screen where a patient meets randomisation, a comparison group and a twelve-month
consequence. It opened with *"Before Medicare checks your eligibility / Please review these
important details about the ACCESS evaluation"* — a warning, followed by three disclosures, followed
by a checkbox. Nothing was wrong with it, and nothing about it told the patient what was actually
about to happen or that it was routine.

The shape is now **explain → disclose → reassure → continue**. The screen says what Medicare is
about to do and how long it takes, and only then hands over the three things the patient must be
told. The disclosures themselves did not get softer; the first one got *narrower*, because it was
carrying two ideas at once.

## Files changed

| File | Change |
| --- | --- |
| `src/app.js` | Title, intro, cards 1 and 2, acknowledgement wording |
| `e2e/access-journey.spec.js` | Five Phase 5 tests |
| `e2e/enrollment.spec.js`, `e2e/canonical-invitation.spec.js` | Updated to the new copy, including both localized variants |

## Copy changed

| Element | Before | After |
| --- | --- | --- |
| Title | Before Medicare checks your eligibility | Let's confirm your eligibility with Medicare |
| Intro | Please review these important details about the ACCESS evaluation. | Medicare will review a few details to confirm you can take part in ACCESS. This only takes a moment and does not change your Medicare coverage. |
| Card 1 | ACCESS evaluation and data sharing / CMS is evaluating ACCESS. ITERA may securely share health information with CMS, and CMS may request information for this evaluation. | A secure check with Medicare / ITERA and Medicare can securely exchange the information needed to confirm your eligibility for ACCESS. |
| Card 2 | How CMS evaluates ACCESS / As part of CMS's evaluation of ACCESS, a small number of people may be randomly assigned to a comparison group. If selected, you would not be able to enroll in ACCESS for 12 months. | How the ACCESS evaluation works / Medicare also evaluates how ACCESS works, **and may request information for that evaluation**. As part of it, some people are randomly selected for a comparison group. If that happens to you, you would not be able to take part in ACCESS for 12 months. |
| Card 3 | *(unchanged)* Your Medicare stays the same / This eligibility check and any comparison group assignment do not change your Medicare benefits, coverage, or rights. | |
| Acknowledgement | I understand and want Medicare to check my eligibility | I understand this information and want to continue with the Medicare eligibility check |

Card 1 previously described both the data exchange *and* the evaluation, which is why its title had
to name both. The "may request information for that evaluation" clause moved to card 2, where the
evaluation is explained, so each card now carries one idea and no disclosure was lost in the move.

## Nothing required was dropped

Asserted explicitly, by content rather than by wording, so a future rewrite cannot quietly lose one:

- the secure exchange of information between ITERA and Medicare;
- Medicare's evaluation of ACCESS and that it may request information for it;
- **random** selection;
- the **comparison group**;
- the **12 months**;
- that benefits, coverage and rights do not change.

The acknowledgement remains required and remains a live condition — the CTA is disabled until it is
ticked, and disabled again if it is unticked, which is now asserted rather than assumed.

## Behavior preserved

- Stage label, three-row structure, `MEDICARE_PROTECTION` assurance line, the "Check my eligibility"
  CTA, the eligibility request itself and its audit trail are unchanged.
- No change to when the check runs, what it sends, or how the outcome is handled.
- Both localized variants rewritten in full; no English fallback.

## EMMI

The three questions this phase names all reach a grounded answer: why Medicare verifies (the screen
explanation, reached through the "why does Medicare need to verify" pattern added in Phase 3), what
the comparison group is, and whether this changes their Medicare. The test also asserts the negative
that matters most here — across all three answers, EMMI never tells a patient they are eligible or
that they qualify before the check has run.

## Tests

- `npm test` — **785 passing**, 0 failing.
- `e2e/access-journey.spec.js` — 20 passing (15 from Phases 2–4, 5 new).

New coverage: the explain-first intro and the three row titles; every required disclosure present by
content; the acknowledgement gate in both directions; EMMI on all three questions plus the
no-premature-eligibility guarantee; and the layout sweep across all 21 width × text-scale
combinations with a 44 px minimum on the acknowledgement row.

## Open issues

None from this phase.
