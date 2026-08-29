# Phase 03 — Enrollment complete → care activation

**Status:** complete
**Screen:** `ENROLLMENT_CONFIRMED` (`EnrollmentWelcomeScreen()`, `src/enrollmentWelcome.js`, `src/flowTransitions.js`, `src/nextBestAction.js`)
**Commit:** _recorded in the follow-up docs commit_

---

## What changed and why

The screen confirmed the enrollment and then told the patient to wait:

> Your care team will call you within 2 business days
> We'll review your personalized care plan
> You'll continue seeing your regular doctors

Everything after enrollment depended on somebody phoning. The patient had finished the hard part and
their next instruction was to sit still.

It is now the moment care activation starts. The three things under *What happens next?* are the
three things the patient is about to do, in the order they will do them — monitor, goals, care plan —
and the primary action starts them rather than opening another questionnaire.

A call from the care team still exists for exceptions, safety, escalation and support requests. It
is no longer the normal way forward.

## Files changed

| File | Change |
| --- | --- |
| `src/enrollmentWelcome.js` | ACCESS title, description, support highlights and the three next steps; new `emmiAlongside` highlight; the contact-window template removed |
| `src/app.js` | Next steps render as titled steps with their own descriptions; the physician highlight names the doctor |
| `src/flowTransitions.js` | The ACCESS next-step card became care setup rather than a health check |
| `src/nextBestAction.js` | `startHealthCheck` → `setUpMyCareAfterEnrollment` |
| `tests/enrollmentWelcome.test.js` | Updated, plus a test that no program promises a call |
| `e2e/access-journey.spec.js` | Four new tests |

## Copy changed

| Element | Before | After |
| --- | --- | --- |
| Title | Welcome to your ACCESS experience | Welcome to your ACCESS care |
| Description | You're starting a new care experience with extra support between doctor visits. | You're now enrolled in ACCESS. Let's get your care set up around your health and goals. |
| Support benefit | Step-by-step support / We'll guide you as you get started. | EMMI is here along the way / Ask questions, get guidance, and know what to do next whenever you need help. |
| Doctor | Connected with your doctor / ITERA HEALTH works with Dr. Fresner to help keep your care coordinated. | Connected with **Dr. Fresner** / ITERA works with Dr. Fresner **and your care team** to help keep your care connected. |
| Next step 1 | Your care team will call you within 2 business days | **Your blood pressure monitor** / We'll get your connected monitor ready so you can track your blood pressure from home. |
| Next step 2 | We'll review your personalized care plan | **Your health goals** / You'll choose what matters most to you and what you want to work toward. |
| Next step 3 | You'll continue seeing your regular doctors | **Your personalized care plan** / Your health information, goals, and next steps will come together in your ACCESS care plan. |
| Next-step card | Ready for the next step? / Your first health check | Let's set up your care / Start your ACCESS care setup |
| Card description | Answer a few questions and share some starting health information… | Next, we'll confirm a few health details, arrange your blood pressure monitor, and personalize your ACCESS goals and care plan. |
| Primary CTA | Start my health check → | **Set up my care →** |

Stage, progress indicator, green success mark, *Welcome*, *Enrollment confirmed*, the enrollment
details link, *About 10 minutes*, the save-and-resume line, *I'll do this later*, the optional Care
Circle section, the closing reassurance and the compact EMMI card are all unchanged. Three locales
throughout.

## A shape change, not just words

Next steps were flat sentences with icons assigned by position. Two of the three ACCESS steps now
need a title *and* an explanation, so a step can be either shape: a sentence, as every other program
still uses, or a titled step carrying its own icon and description. Nothing else had to change.

## The route did not move

`Set up my care` still routes to `ACCESS_BASELINE` with `actionType: HEALTH_CHECK`. Only what it is
called to the patient changed — this is a framing change, not a new flow, and the unit test says so
explicitly so nobody later mistakes the rename for a re-route.

## Appointment coordination was not added

No *Schedule appointment*, *Book visit* or *Coordinate appointment* step exists on this screen or in
the activation sequence it announces, and the test asserts none appears. Appointment coordination is
a capability the patient can ask EMMI for, not a requirement of care activation.

## EMMI

The screen's suggestions became activation questions — what happens next, how to get the monitor,
what the care plan will include, what goals to work on — and `enrollmentComplete` is now a fact in
EMMI's context (Phase 6 of the journey work), so *"Am I enrolled?"* is answered **yes** here, where
on the eligibility screen it is correctly answered *not yet*.

Worth recording: EMMI reads the patient's record, not the screen. Jumping to this screen with the QA
panel does not complete an enrollment, and EMMI correctly kept saying the patient was not enrolled —
so the test restores a genuinely completed enrollment instead. That is the behaviour we want, not a
bug to route around.

## Tests

- `npm test` — **797 passing**, 0 failing.
- `e2e/access-journey.spec.js` — 4 new tests.

New coverage: the welcome copy, both highlights and the three activation steps by title; the absence
of any call promise, RPM/CPT billing vocabulary or appointment step; the next-step card, the primary
CTA starting setup and the deferral remaining a real 44 px target; and EMMI's activation suggestions
plus an *Am I enrolled?* answer that says yes without telling the patient to wait for a call.

## Open issues

None from this phase.
