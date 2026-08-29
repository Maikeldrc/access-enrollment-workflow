# Phase 02 — Who is completing this?

**Status:** complete
**Screen:** `DECISION_MAKER` (`decisionMaker()` / `optionalSupportPrompt()` in `src/app.js`)
**Commit:** _recorded in the follow-up docs commit_

---

## What changed and why

The screen asked "Who is completing this?" and then, underneath, offered to invite someone to help.
Two different relationships, one page, and the wording blurred them: *"Want someone to help you? /
Invite someone you trust to help you through this process"* described the Care Circle in the same
terms a helper would use. A patient reading quickly could reasonably take it as a fourth answer.

The distinction is now carried by the copy:

- **Helping the patient** — a person filling this in *now*, beside a patient who still decides.
- **Want support along the way?** — the patient stays the one doing this, and invites support for
  the **journey**, not for this form.

The intro also stopped implying the choice is final. "Choose what best describes you. You can get
help at any time." says the answer describes the present, not a commitment.

## Files changed

| File | Change |
| --- | --- |
| `src/app.js` | Intro copy; Care Circle card title and description (both places it renders) |
| `src/styles.css` | `.optional-support-*` typography pinned into the patient system |
| `e2e/access-journey.spec.js` | New spec for this journey, with five Phase 2 tests |
| `e2e/enrollment.spec.js`, `e2e/growth.spec.js`, `e2e/emmi-guidance.spec.js` | Updated to the new copy |

## Copy changed

| Element | Before | After |
| --- | --- | --- |
| Intro | Choose the option that best describes you. | Choose what best describes you. You can get help at any time. |
| Care Circle title | Want someone to help you? | Want support along the way? |
| Care Circle copy | Invite someone you trust to help you through this process. | Invite someone you trust to support you during your care journey. |

Title, the three answers, their descriptions and the **Invite someone** CTA are unchanged. All three
locales written; nothing falls back to English.

**Scope note.** The same card renders in a second place — the post-enrollment *Set up your care*
screen, via `careCircleEarlyPrompt()`. It is the same card offering the same action, so both were
updated together rather than leaving one screen saying "help you through this process" and the other
"support you during your care journey".

## Behavior preserved

- Three options, no more and no fewer; **For myself** selected on arrival.
- All three routes unchanged: patient and helper continue to identity verification, personal
  representative branches into representative details, signer authority untouched.
- Optional support does not touch the enrollment actor. Opening the invitation and coming back
  leaves **For myself** still selected.
- Optional support stays hidden for a helper or a personal representative, and the already-sent
  state still reports the invitation instead of re-offering it.
- Back and Continue, EMMI, and the role-guidance assurance line are untouched.

## Defect found and fixed

**Optional support outshouted the question above 100 % text scaling.** `.optional-support-card
strong` and `.optional-support-copy` were written in `rem` while the three answers are pinned in `px`
by the patient typography system. Measured on the running app at 384 px:

| | 100 % | 150 % |
| --- | --- | --- |
| Answer title (`.choice-card strong`) | 18 px | 18 px |
| Optional support title | 15.4 px | **23 px** |
| Optional support copy | 14.4 px | 21.6 px |

At 150 % the secondary card was the largest text on a screen whose entire job is to ask one
question — the exact inversion this phase forbids. `.optional-support-label`, `-card strong`,
`-copy` and `-action` now use `--font-helper` / `--font-footer`, so the ordering holds at every
text size and nothing drops below the 16 px floor. This is the same `rem`-outside-the-system defect
found in Phase 1, in a second component.

## Tests

- `npm test` — **785 passing**, 0 failing.
- New: `e2e/access-journey.spec.js`, 5 tests — the three answers and the default selection; optional
  support as an offer rather than an answer (outside the form, no input, actor unchanged after a
  round trip); it standing down for helper and representative; the hierarchy sweep; and all three
  locales.
- Serial regression gate over the touched specs — results in the phase report footer below.

The hierarchy is asserted at all 21 width × text-scale combinations, together with horizontal
overflow and a 44 px minimum target for every answer card and for the offer beside them.

## Accessibility

- The Care Circle offer is a real `<button>` outside `#choice-form`, so it is not in the radio group
  and cannot be reached as a fourth option by keyboard.
- Radio semantics, labels and the single-selection invariant are asserted.
- Every card keeps a ≥ 44 px target at all tested sizes.

## Open issues

None from this phase. Pre-existing failures unrelated to it are carried in the Phase 1 report and
the final implementation report.
