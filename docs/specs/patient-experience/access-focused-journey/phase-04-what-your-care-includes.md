# Phase 04 — What your care includes

**Status:** complete
**Screen:** `CARE_RECOMMENDATION`, ACCESS branch (`recommendation()` / `accessCareCapabilities()` / `accessConditionCareCard()`)
**Commit:** `44d0184` — `feat(access-patient): phase-04 modernize care overview`

---

## What changed and why

The screen described ACCESS in the passive voice of a benefits summary: *care is designed to support
you*, *your care team checks in*, *goals and next steps based on your health needs*. Accurate, and
none of it told the patient what they would actually be doing or what they would be given.

It now presents four connected things, and the condition card in particular changed from a label
("Blood pressure support") into an action with a reason ("Track your blood pressure from home — use
a connected monitor to track your readings and help your care team understand how you're doing").
That is where the connected monitor enters the journey, conceptually and once.

## Files changed

| File | Change |
| --- | --- |
| `src/app.js` | Intro; four cards; the closing note; card 4's title now names the physician; icons for cards 1 and 4 |
| `src/emmi/textOrchestrator.js` | `DOCTOR_STATUS` also recognises "will Dr. X still be involved" |
| `e2e/access-journey.spec.js` | Five Phase 4 tests |
| `e2e/enrollment.spec.js` | Updated to the new copy, including the three non-hypertension condition cases |

## Copy changed

| Element | Before | After |
| --- | --- | --- |
| Intro | Your ACCESS care is designed to support you at home and between doctor visits. | Your ACCESS care gives you new tools and ongoing support to help you manage your **{condition}** between doctor visits. |
| Card 1 | Regular check-ins / Your care team checks in, answers questions, and helps you stay on track. | Stay connected with your care team / Get ongoing support, answers to your questions, and help staying on track between visits. |
| Card 2 | Blood pressure support / Help monitoring and managing your blood pressure at home. | Track your blood pressure from home / Use a connected blood pressure monitor to track your readings and help your care team understand how you're doing. |
| Card 3 | *(title kept)* A care plan built around you / Goals and next steps based on your health needs. | Your goals, health information, and next steps come together in one personalized care plan. |
| Card 4 | Connected with your doctors / ITERA works with Dr. Fresner to help keep your care coordinated. | Stay connected with **Dr. Fresner** / ITERA works with Dr. Fresner **and your care team** to help keep your care connected and coordinated. |
| Note | Your care continues between visits, while your doctors remain part of your care. | Your care doesn't stop when you leave the doctor's office. Your care team stays connected with you along the way. |

Icons: card 1 `calendar` → `people`, card 4 `people` → `doctor`, so the care team and the referring
physician stay visually distinct now that both titles begin "Stay connected with".

## Nothing patient-specific is hardcoded

Two things on this screen are facts about *this* patient, and both are read from the offer:

- **The condition.** The intro sentence and card 2 are driven by
  `offer.clinicalProfile.primaryCondition`. Hypertension gets the blood-pressure wording; diabetes,
  heart failure and chronic kidney disease each get their own, and an unrecognised condition falls
  back to "Track your health from home". Only the blood-pressure variant names a connected monitor,
  because only that pathway comes with one — saying it elsewhere would be promising a device the
  patient is not getting.
- **The physician.** Card 4's title and body use `offer.physician.displayName` and only when the
  invitation came through a provider referral. Direct outreach reads "Stay connected with your
  doctors" and names nobody, which is asserted.

## Device positioning

The monitor is introduced here as an idea and nothing more. The screen is asserted to contain
"connected blood pressure monitor" and to contain none of: shipping, delivery, setup, activation,
pairing, cuffs or batteries — all of which belong to Getting Started — and none of the billing
vocabulary (CCM, RPM, PCM, APCM, ASM, BHI, CoCM, RTM, CPT, billing, claims, reimbursement) that
would turn a description of care into an invoice for services.

## EMMI

"Will Dr. Fresner still be involved?" fell through to knowledge retrieval, because `DOCTOR_STATUS`
matched "who is my doctor" and "keep seeing my doctor" but not the most natural way to ask it —
naming the doctor and asking whether they stay. It now routes to `getCareTeam`, which answers from
the runtime care team and carries the reassurance that ITERA adds support and does not replace the
patient's doctor.

## Behavior preserved

- Stage label (`YOUR CARE`), screen title, four-card structure, `rows()` layout, the continue action
  and the assistant surface are unchanged.
- The non-ACCESS branch of `recommendation()` is untouched, including the practice-outreach copy that
  deliberately avoids individual physician claims.
- No new screen, route or state.

## Tests

- `npm test` — **785 passing**, 0 failing.
- `e2e/access-journey.spec.js` — 15 passing (10 from Phases 2–3, 5 new).

New coverage: the four cards by exact title and body plus the intro and note; the monitor introduced
without any of the operational or billing language; the physician named under referral and absent
under direct outreach; EMMI answering both the device and the still-involved questions; and the
layout sweep across all 21 width × text-scale combinations with a 16 px floor on card bodies.

## Open issues

None from this phase.
