# Phase 04 — EMMI appointment coordination orchestration

**Status:** complete — verified against the specification, one defect fixed
**Surface:** `src/appointments.js`, `src/appointmentViews.js`, `src/appointmentSupport.js`, `src/schedulingCapability.js`, `src/careTeamDirectory.js`, `src/emmi/appointmentIntents.js`, `src/emmi/tools.js`
**Commit:** `947a995` — `feat(emmi): phase-04 appointment coordination orchestration`

---

## What this phase turned out to be

The plan's step 155 says: **audit before coding.** The audit found this capability already built and
already documented, in `APPOINTMENT_COORDINATION_AUDIT.md`, `docs/APPOINTMENT_COORDINATION_ARCHITECTURE.md`
and `docs/specs/appointment-coordination.md`, with five e2e specs and 235 unit tests behind it.

So this phase is a verification of the built capability against the specification's own acceptance
criteria, and the repair of the one thing that did not hold. Rebuilding working, tested orchestration
to produce a diff would have been the wrong deliverable.

## Verified against the specification

| Requirement | Where it lives | Verdict |
| --- | --- | --- |
| §14–24 Four capability levels | `SCHEDULING_CAPABILITY`: `DIRECT_BOOKING`, `STRUCTURED_REQUEST`, `HUMAN_COORDINATION`, `NO_AVAILABLE_CHANNEL` | Present |
| §37 Status model | 18 statuses from `NEED_IDENTIFIED` to `NO_SHOW`, including `WAITING_FOR_OFFICE` and `UNABLE_TO_SCHEDULE` | Present |
| §118–119 EMMI tools | 12: `getUpcomingAppointments`, `getAppointment`, `getSchedulingCapability`, `getProviderAvailability`, `startAppointmentRequest`, `createAppointmentRequest`, `bookAppointment`, `rescheduleAppointment`, `cancelAppointment`, `createAppointmentReminder`, `shareAppointment`, `getCareCircle` | Present |
| §6 Natural-language need | `classifyAppointmentIntent` → `APPOINTMENT_NEED`, verified live against the orchestrator | Routes as an action, not to retrieval |
| §3–5 Safety first | `evaluateClinicalEscalation` runs before any preference is collected | Present |
| §16, §18 Real availability only | `getProviderAvailability` refuses to produce a slot for an unresolved provider; nothing is called confirmed until `bookAppointment` succeeds | Present |
| §63–64 Cancel | Explicit confirmation required; never inferred from chat text | Present |
| §125–126 Idempotency | `appointmentIdempotencyKey` per patient + provider + slot + action | Present |
| §82–83 Duplicates | `existingAppointmentFor` shows what the patient already has before creating another | Present |
| §12 Professional not found | Add-a-professional workflow via `professionalNotFoundPlan` | Present |
| §154 No giant calendar | No calendar component exists; slots are cards | Held |

## The defect

`§35 confirming the provider does not erase who the appointment is with` was failing, and had been
carried as a pre-existing failure through the previous phases. It is inside this phase's scope, so
it was fixed here rather than carried further.

The test seeded a need naming "Dr. Martinez" and expected that exact string to survive the patient
confirming the provider. What actually happens is that the id — `dr-martinez-cardiology` — **is** in
the locally built care team, whose own record names that person "Dr. Pedro Martinez", so confirming
adopts the verified record's name.

That is the correct behaviour and the opposite of §11's *do not invent a provider*: a resolved care
team record outranks a seeded label for the same person. The test predated the cardiologist joining
the default care team.

The fix asserts the invariant the test actually cares about — **the name is never blanked** — and
splits it into the two branches that matter:

- a provider **in** the care team is named by their own record;
- a provider the care team does **not** carry keeps the name the need was created with, because
  nothing local can confirm them and so nothing local may overwrite them.

## Tests

- `npm test` — **797 passing**, 0 failing.
- Appointment e2e (`appointments-smoke`, `-scheduling`, `-resilience`, `-mobile`, `-emmi`) —
  **98 passing**, 0 failing.

The suites already cover the specification's QA list: direct booking through to a confirmed state,
request falling back to `WAITING_FOR_OFFICE` with no fake confirmation, human coordination producing
a care-team task, safety overriding scheduling, duplicate avoidance, long provider names at 384 px,
reschedule capability routing, explicit cancel confirmation, reminders only reported after creation,
transportation barriers, Care Circle sharing scope, and attendance follow-up.

## Not built, deliberately

No calendar component, no ICS export, no notification scheduler, no provider search beyond the care
team directory. `APPOINTMENT_COORDINATION_AUDIT.md` records that none of these integrations exist in
this prototype, and §154 explicitly warns against building them. The scheduling capability,
availability feed and booking call are prototype sources shaped the way real integrations would
arrive, and say so: `resolveSchedulingCapability` returns `source: "PROTOTYPE_CONFIG"`.

## Open issues

None from this phase. The pre-existing failure list is one shorter than it was.
