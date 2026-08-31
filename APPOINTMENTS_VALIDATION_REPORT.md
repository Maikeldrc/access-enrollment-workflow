# Appointment coordination — validation run

Date: 2026-08-30
Scope: the complete appointment flow for every kind of care team member
Branch: `claude/care-team-appointments-validation-b0d344`

## Executive summary

**PASS.** Every appointment flow the product offers was exercised end to end against this branch,
for all four kinds of care team member, and nothing failed.

| Suite | Result |
| --- | --- |
| Appointment e2e (5 specs) | **98 / 98** in 5.0 min |
| Upstream hand-offs into appointment coordination | **2 / 2** |
| Unit tests, appointment and care team modules | **309 / 309** |
| Unit tests, whole product | **1018 / 1018** across 48 files |

Retries were armed (`retries: 1`) and no test needed one, so nothing here is a second-attempt pass
being reported as green. The one finding is about the test suite, not the product: three defects the
specs still describe in their comments no longer reproduce, and the workaround written for one of
them is now suppressing the coverage it was meant to preserve.

## Environment

The result is only worth reading if the tests drove *this* checkout, and two things stood in the way.

- **The worktree had no `node_modules`.** Installed before anything was run.
- **Ports 4174 and 4191 were both held by other sessions.** `playwright.appointments.config.js`
  sets `reuseExistingServer: true` on 4191, so using that harness would have silently tested
  whichever checkout already owned the socket. The run went through `playwright.config.js` with
  `E2E_PORT=4195` instead, which keeps `reuseExistingServer: false` and starts its own dev server.

```bash
E2E_PORT=4195 npx playwright test e2e/appointments-smoke.spec.js e2e/appointments-scheduling.spec.js e2e/appointments-emmi.spec.js e2e/appointments-mobile.spec.js e2e/appointments-resilience.spec.js
```

Project: `mobile-chrome` (Pixel 5), the only project the config declares. No `.env` was present and
none was needed: the appointment surfaces run entirely on the prototype scheduling source.

## The four care team members, and what each one proves

Scheduling capability is keyed by provider in `src/schedulingCapability.js`, and the four fixture
ids are the only way a test can be unambiguous about which path it is on.

| Care team member | Capability | What the run proved |
| --- | --- | --- |
| Dr. Fresner — primary care | `DIRECT_BOOKING` | §136 real slots from a real availability source, a real confirmation number, and a stored record at `CONFIRMED` with `scheduledAt` and `confirmedAt` set |
| Dr. Pedro Martinez — cardiology | `STRUCTURED_REQUEST` | §16 no fabricated availability is ever shown; §137 the record reaches `REQUEST_SENT`, carries no time and no confirmation number, and the screen never says confirmed |
| Alicia Ramírez, RN — care manager | `HUMAN_COORDINATION` | §138 exactly one structured care-team task, status `OPEN`, and the patient is told a person is arranging it rather than that an office was written to |
| Provider with no channel | `NO_AVAILABLE_CHANNEL` | §23 refused in plain words, no claim that any office was contacted, and a real next step still offered so the patient is not left at a dead end |

The governing rule across all four holds: a confirmation appears only where a booking channel
confirmed a real time, and the internal status vocabulary never reaches a patient (§37).

## What else the 98 tests cover

- **Who may act.** §158 a Care Circle member can view and be reminded but can never book, reschedule,
  cancel or share — checked both through the UI and at the `canActOnAppointment` chokepoint. §159 an
  unverified personal representative is denied and a verified one may act, with the cancellation
  attributed to `representative` in the audit trail.
- **Idempotency.** §125 double-tapping a slot produces one appointment; double-tapping submit sends
  one request; §126 confirming a cancellation twice cancels once.
- **Honesty under failure.** §124 a slot that disappeared between showing and booking sends the
  patient back to real times without blaming them; §123 a booking that fails never reaches
  `CONFIRMED`.
- **Privacy and audit.** §117 no PHI reaches the analytics trail across a whole life cycle; §116
  every coordination step the patient took is recorded, and a request is audited as a request.
- **Hostile input.** Markup in a provider name, practice, location or prep topic is escaped rather
  than executed; a corrupt record never crashes a screen and never becomes a link.
- **Time.** §95/§96 appointment times render in the appointment's own zone across a DST boundary and
  when the device clock is nowhere near the clinic.
- **Language.** Whole appointment conversations in Spanish and in Kreyòl, with no English leaking.
- **Mobile and accessibility.** 384 px with no horizontal overflow, a 44 px touch minimum on every
  control, 125% and 150% text scaling without clipping, and every appointment screen announceable
  and operable by keyboard.

Per-spec: smoke 3, scheduling 23, EMMI 35, mobile 14, resilience 23.

## Entry points into the flow

Two tests outside the appointment specs feed the same coordination engine, and both pass:

- `e2e/goal-barriers.spec.js:229` — a barrier of "I need an appointment" is captured for the care
  team carrying the fields a scheduling module needs.
- `e2e/medication-refill.spec.js:186` — a medication whose workflow requires a visit hands the need
  to appointment coordination with the medication context already attached.

## Finding: three spec comments describe defects that are fixed

`e2e/appointments-scheduling.spec.js` still documents two defects in prose, and the §138 and §23
tests still carry `expect.soft` assertions written to report them. **All of those assertions now
pass**, and the source confirms why:

- **"BUG 1 — the flow's own first question."** The comment says every preference control carries
  `data-need-id` set to the *draft's* id while `src/app.js` resolves it as an *appointment* id, so
  the tap-driven flow died on its first question. Today `src/appointmentViews.js:882` sets
  `const needId = props.appointment?.id || draft.needId || ""`, and `src/app.js:6985` resolves
  `el.dataset.appointmentId || el.dataset.needId || state.activeAppointmentId`. The test written to
  pin the bug — "§26 answering the first question moves the patient to the second one" — passes
  against the unmodified button.
- **"BUG 4."** The comment says a care-team task created on the submit path exists only in memory
  until a later screen happens to save. The §138 soft assertion that pins it —
  `the care-team task is never written to the draft store on submit` — now passes, so the task is
  written on submit.
- **§23's two soft assertions.** Both pass: the no-channel path no longer claims a request was sent
  to an office it cannot reach, and it does tell the patient plainly that this cannot be scheduled.

### Why this matters

The workaround built for BUG 1, `repairNeedId`, stamps `data-appointment-id` onto the controls
before clicking them. That attribute takes priority in the handler, so **22 of the 23 tests in the
scheduling spec never exercise the attribute the product actually renders**. Only the pinning test
does. The suite is green either way, but the redundancy those 22 tests appear to provide against a
`data-need-id` regression is not there.

### Closed

This was fixed the same day on `claude/cool-germain-40bc5b`, in two commits and with no change to
product source:

- `60c7234` removes `repairNeedId` and `flushPendingWrites` together with the two BUG comment blocks
  that described defects no longer present. All 23 scheduling tests pass without either helper, now
  driving the attribute the product really renders.
- `fba5282` turns the §138 soft assertion into a hard one. Checking that path also settled the
  question the soft assertion was hedging: the human-coordination screen is genuinely its own —
  `appointmentCoordinationConfirmation` leads with "Your care team is coordinating this" rather than
  reusing the request view's "Request sent".

## Evidence

`qa-shots/appointments/` holds a 384 px full-page capture of all 21 appointment surfaces plus the
confirmed-detail and slot screens at 150% text scale, written by the mobile spec on this run. The
fixtures use relative dates, so these files differ on every run by the dates they render; the
captures from this run were reverted after review rather than committed as a change.

## Whole-suite regression baseline

The whole `e2e/` directory was then run for this checkout, to see whether the appointment work had
disturbed anything next to it.

```bash
E2E_PORT=4199 npx playwright test
```

**491 passed, 0 failed, 5 skipped, in 16.9 min.** No test needed its retry.

The five skips are all in `e2e/emmiAudioPipeline.spec.js`, and they are honest rather than hidden:
every test there needs a live voice session, the token route cannot mint one without
`GEMINI_API_KEY`, and that key lives in the gitignored `.env` that no worktree ever has. The spec
guards itself with `test.skip` and says so in its own message rather than passing on a dead
pipeline. Running those five requires a checkout with a real `.env`.

This baseline is worth stating plainly because it is not a constant: the same suite has been
measured at 44 failures in one worktree and 0 in another, and the earlier audit recorded seven
EMMI answer-content failures that pre-dated that work. **On this checkout, on this date, the whole
suite is green.** Anyone comparing against it should take their own baseline rather than trusting
this number.
