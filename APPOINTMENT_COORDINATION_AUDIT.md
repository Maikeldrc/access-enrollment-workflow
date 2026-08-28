# Appointment coordination — audit before implementation

## What exists, and how real it is

| Piece | Where | Real or mock |
| --- | --- | --- |
| Appointment entity | — | **Did not exist anywhere.** The only substrate was `BARRIER_CATEGORIES.APPOINTMENT_NEED` + `APPOINTMENT_REQUEST_FIELDS` in `src/goalBarriers.js` |
| Appointment requests | Three separate `APPOINTMENT_REQUEST` care-team task producers (`src/app.js`, three call sites) | Real records, **three incompatible `summary` shapes** under one type string, each pinned by e2e assertions |
| Provider identity | `offer.referringProvider`, `offer.physician`, `medication.prescriber`, `getCareTeam` | Mock, and **self-contradicting**: `src/config.js:288` stamped `specialty: "Primary Care"` / `practiceName: "Fresner Medical Group"` onto whatever physician name was configured |
| Provider directory | — | **Does not exist.** No search, no specialties, no multi-member care team |
| Scheduling integration | — | **Does not exist.** No calendar, no availability source, no booking API |
| Notifications | — | **None. No push, no SMS, no email, no scheduler, no service worker** |
| Calendar / ICS | — | **Does not exist.** Every `calendar` hit in the codebase is a Lucide icon or a `<input type="date">` |
| Care Circle | `src/growth.js`, `state.careCirclePermissions` | Invites are real records with a real lifecycle; **delivery is not** (localStorage only, while the UI says "We sent an invitation"). All five permissions were **written and read nowhere** |
| Barrier engine | `src/goalBarriers.js` | Real, deterministic, tested. Goal-scoped: `recordBarrier` returns `null` without a goal |
| Clinical safety | `evaluateClinicalEscalation`, `src/clinicalMonitoring.js` | Deterministic mock rules, explicitly not for clinical use |
| Care-team tasks | `state.careTeamTasks` | One shared queue; nothing consumes it |
| Reminders | goal `reminderPreference`, in-app only | Real, and honest: there is no notification scheduler |
| Audit | `audit(state, type, outcome, details)` | Real, persisted with the draft |

## What that means for this capability

Almost everything the specification describes as an integration had to be created as a **prototype
source, marked as one**: a scheduling capability per provider, an availability feed, a booking
call, and a care-team directory. All four are shaped the way a real integration would arrive so the
engines do not have to change when one exists. `resolveSchedulingCapability` returns
`source: "PROTOTYPE_CONFIG"` and `getProviderAvailability` refuses to produce a slot for any
provider it did not resolve.

Everything else is orchestration over what was already there: the barrier engine owns "something is
making this hard", the safety engine outranks scheduling, the care-team queue carries every
escalation, and the appointment record is its own entity rather than a widened barrier field —
because `tests/goalBarriers.test.js` pins `barrier.appointmentRequest` as having no `scheduledAt`,
and a real appointment needs one.

## What this capability may not claim

The specification repeatedly forbids faking a channel. Where the product has none, it says so.

| Spec asks for | Product reality | What ships |
| --- | --- | --- |
| §48–50 reminders | No scheduler, no channel | In-app only. `appointmentReminderCapability()` returns `canNotifyDevice: false`, and a source-level test asserts the module contains no `SMS`, `push notification`, `email` or "we will send you a reminder" string — including in comments |
| §58 join visit | No telehealth link source | The Join control renders **only** for a record carrying an `https://` `joinUrl`. A `javascript:` or `http:` value is dropped, not rendered |
| §59 directions | No provider address | Renders only when `locationAddress` is present |
| §60 add to calendar | No ICS | **Not offered at all.** §60's "when technically supported" is the governing clause |
| §73 notification | None | Changes surface in-app on next open, described as such |
| §157 backend authorization | No backend | `canActOnAppointment()` is the single chokepoint every mutating path routes through. This is a **prototype limitation, documented as one** — it is not security |
| §54 Care Circle sharing | Invites are never delivered | Sharing is gated on a genuinely `ACCEPTED` member **and** `helpWithAppointments`, and the share screen says plainly that the patient will need to tell them, because ITERA cannot message a Care Circle member |

## Corrections made to existing code

Four defects were found in code this capability depends on. Each is fixed because the specification
cannot hold otherwise, and each is narrow.

1. **The safety gate missed typographic apostrophes.** Every regex in `src/emmi/textOrchestrator.js`
   matched only `'`, while phones and speech transcription produce `'`. "I can't breathe" bypassed
   the deterministic clinical engine entirely and fell through to the knowledge base. Apostrophes
   are now folded once before all 19 gates. Without this, acceptance criterion 2 cannot hold.
2. **Spanish chest pain never reached the emergency instruction.** The orchestrator gate and the
   safety tool kept separate symptom lists that had drifted: the gate matched
   "dolor fuerte en el pecho" — the exact phrase §3 uses — and the tool did not, so the engine saw
   no symptom and the turn fell through. Both now share `EMERGENCY_SYMPTOM_PATTERN` in
   `src/clinicalMonitoring.js`, and a matched gate never falls through to the knowledge base.
3. **The tool layer double-wrapped three appointment results.** `getUpcomingAppointments`,
   `getAppointment` and `getCareCircle` re-wrapped an already-shaped hook result, so EMMI told a
   patient with a confirmed visit that they had none, and threw on any appointment request. The
   unit harness returned a *different* shape than the real hooks, which is why the suite stayed
   green; the harness now matches the contract exactly.
4. **`src/config.js` invented a specialty.** `buildCareTeam` now emits `specialty: ""`,
   `practiceName: ""` and `verified: false` when the configured physician name was substituted over
   the hardcoded literal. §11 forbids stating a specialty the product does not know.

## Known, not fixed

- **The app-wide type scale is px.** `--font-screen-title`, `--font-body` and the rest are px
  values in `src/styles.css`, so headings on every screen in the product stop growing at 125% and
  150%. Appointment headings are registered separately in rem so the appointment experience scales;
  the global scale is a product-wide change and outside this specification.
- **`barrierCapabilities().careCircleAvailable` still checks only `completionRole`**, so the barrier
  engine can offer the Care Circle to a patient who has none. That is arguably correct there — it
  is how a patient gets one — and appointment sharing has its own gate. Left deliberately.
- **`canActOnAppointment`'s Care Circle branch is unreachable in the shell**: nothing sets
  `careCirclePermissions.actingAsCareCircle`, because no session is ever marked as a Care Circle
  actor. The rule is correct and tested; there is no way to be that actor yet.
- **Seven EMMI answer-content e2e failures pre-date this work** and were verified failing at a
  clean checkout of `HEAD` in a separate worktree.
