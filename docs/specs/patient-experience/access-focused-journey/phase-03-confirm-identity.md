# Phase 03 — Confirm Identity

**Status:** complete
**Screen:** `IDENTITY_VERIFICATION` (`identity()` in `src/app.js`)
**Commit:** `053b171` — `feat(access-patient): phase-03 refine identity verification`

---

## What changed and why

The screen read like the first step of a sign-up: *"Let's confirm it's you / Please confirm your date
of birth and ZIP code / We use this information to securely verify your identity."* True, but it
never said what the two answers are actually *for*. They are not credentials. They are the two facts
that match this person to the invitation Dr. Fresner's care team already sent them.

The copy now says that, and the security line stops describing a process and starts making a promise
about the patient's information.

## Files changed

| File | Change |
| --- | --- |
| `src/app.js` | Title, purpose line, security line (patient and representative variants); prefill now reads from the invitation; EMMI's screen explanation names the invitation and the referring physician |
| `src/config.js` | `patient.identityMatch` — the verification material the invitation was issued against |
| `src/services.js` | `verifyIdentity` matches submitted date of birth **and** ZIP against the invitation instead of comparing ZIP to a literal |
| `src/emmi/textOrchestrator.js` | `SCREEN_HELP` also recognises "why do you need this / my ZIP code / to verify me" |
| `e2e/access-journey.spec.js` | Five Phase 3 tests |
| `e2e/enrollment.spec.js`, `e2e/canonical-invitation.spec.js` | Updated to the new copy |

## Copy changed

| Element | Before | After |
| --- | --- | --- |
| Title | Let's confirm it's you | Let's securely confirm it's you |
| Purpose | Please confirm your date of birth and ZIP code. | Confirm your date of birth and ZIP code so we can match you to your care invitation. |
| Security | We use this information to securely verify your identity. | Your information is protected and used only to securely verify your identity. |

The representative variant was rewritten in parallel. Stage label, field labels, and both helpers
("Use MM / DD / YYYY.", "Enter your home ZIP code.") were already correct and are untouched. Three
locales throughout.

## The identity logic, audited

The stated model is *invitation context + DOB + ZIP → patient match*. What the code did was compare
the submitted ZIP against the string `"33176"` written inside `MockEnrollmentService`, and check the
date of birth only for **format**. A patient could type any well-formed date — someone else's
birthday, or their own typo — and verify successfully as long as the ZIP was right. The date was
being validated, not matched.

Three things now line up with the model:

1. The invitation carries what it was issued against, as `patient.identityMatch`. It is never
   rendered; the patient's ZIP and phone on the offer stay masked as they were.
2. `verifyIdentity` matches both fields against that, so the service no longer holds a hardcoded
   answer of its own.
3. The form's prototype prefill reads from the same place, so there is one source of truth rather
   than a constant in `app.js` that could drift from what the service checks.

No OTP was added. The representative path already has its own phone verification and this screen
does not need a second factor on top of an invitation match.

There is no per-invitation token in this prototype to reuse — offers are identified by
`offer_prototype_<timestamp>` — so the invitation context itself is what identity is matched against.

## Finding, not fixed here

**The prototype prefills the demo patient's date of birth and ZIP into the form.** Anyone opening
the link sees `05 / 12 / 1954` and `33176` before verifying anything. The data is fictional
(`patient_demo`, "John S.") and the prefill is what lets the journey be walked without typing, so it
was kept — but a real deployment must ship these fields empty. That is now written where it belongs,
as a comment on `invitationIdentity()` beside the values themselves, rather than being implied.

Everything else the requirement asks for **is** enforced and asserted: the name on the record, the
masked phone, the shipping address and the qualifying condition are all absent from the screen until
the match succeeds.

## Behavior preserved

- Two fields, nothing added: no name, Medicare number, email, phone or address. Asserted by
  enumerating the form's inputs rather than by eyeballing the markup.
- Referral context intact — `PROVIDER_REFERRAL` and Dr. Fresner survive the screen untouched.
- Attempt counting, the remaining-attempts message, the invalid-date message, the calendar control,
  numeric keyboards and `aria-describedby` wiring are unchanged.
- The representative branch and its separate phone verification are untouched.

## EMMI

"Why do you need this?" previously fell through to knowledge retrieval, because `SCREEN_HELP` only
matched *"what do I do"*-shaped questions. It now routes to the screen explanation, which reads:
*"This helps us securely match you to the care invitation from Dr. Fresner's care team."* The
physician's name comes from the runtime offer; with no physician on the invitation it says ITERA
HEALTH instead of naming anyone.

The new pattern is deliberately narrow in two directions. Asking why the invitation *arrived* still
goes to `INVITATION_SOURCE`, and asking why something on a record is held — "why do you need my
medications" — still goes to that content, which an early, broader version of this pattern broke and
the existing suite caught.

EMMI never receives the date of birth or the ZIP: they are not in its context, and the test asserts
neither appears in its answers.

## Tests

- `npm test` — **785 passing**, 0 failing.
- `e2e/access-journey.spec.js` — 10 passing (5 from Phase 2, 5 new).

New coverage: the purpose and security copy; the form containing exactly `dob` and `zip` and nothing
else; labels, descriptions and numeric input modes; the patient's record staying hidden before the
match; matching itself — a valid-but-wrong date rejected, a right date with a wrong ZIP rejected, a
malformed date stopped before the service, and both-correct opening the journey; EMMI's explanation
naming the invitation and Dr. Fresner without echoing the answers; and the layout sweep across all
21 width × text-scale combinations with a 44 px minimum on both inputs.

## Open issues

The prefill described above, as a deliberate prototype affordance with a documented production
requirement. Nothing else from this phase.
