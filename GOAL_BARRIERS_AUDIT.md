# Goal barriers — audit before implementation

## What exists

| Piece | Where | State |
| --- | --- | --- |
| `goal.barriers[]` | `createPatientGoal` in `src/goals.js`, persisted in `src/services.js` | `{id, goalId, barrierType, notes, status:"OPEN", createdAt}` — a note, not a care signal |
| Barrier capture UI | `goalDetailView === "BARRIERS"` in `src/app.js` | One universal radio list of 7 options + free text, same for every goal |
| Check-in | `open-goal-checkin` → `goal-checkin-response` | `DIFFICULTY` already routes into the barrier list |
| Support request | `goalDetailView === "SUPPORT"` | 6 fixed options, each straight to a care-team task |
| Care-team tasks | `ensureGoalCareTeamTask()`, `state.careTeamTasks` | De-duplicating, shared with device and medication flows |
| Goal history | `goalHistoryEvent()` | Append-only; already records `BARRIER_REPORTED` |
| Safety | `evaluateClinicalEscalation` tool + `SAFETY` regex in `textOrchestrator.js` | Deterministic mock rules, runs before everything else |
| Next best action | `goalNextBestAction()` in `src/goals.js` | Single resolver for card, detail and EMMI — knows nothing about barriers |
| Education | `nextBestGoalEducation()`, `EMMI_LESSON` actions, `educationHistory` | Reusable as an intervention |
| Care Circle | `CARE_CIRCLE_INVITE` screen, `open-care-circle` action | Reusable as an intervention |
| Reminders | `remindersEnabled` boolean on goal actions | A plan preference only — there is no scheduler and no notification permission |
| EMMI tools | `EmmiToolOrchestrator` in `src/emmi/tools.js` | Reads `assistantContext()`, writes through `onCallback` / `onTask` hooks |

## What was missing

The old model could record that a patient chose "I forget" and open a care-team task. It could not
say who owns the difficulty, what was tried, whether it helped, or what to try next — so nothing
could follow up and nothing could change the goal's next best action.

Specifically: no source (patient / EMMI / system / care team), no suspected-vs-confirmed
distinction, no owner, no resolution path, no interventions with outcomes, no follow-up date, no
recurrence, no scope beyond a single goal, no conversational detection, no contextual options, and
no analytics.

## What this change adds

`src/goalBarriers.js` — one pure module holding the taxonomy, the record shape, the free-text
classifier, the contextual option lists and the resolution engine. Everything else orchestrates
what already exists: education, Care Circle, care-team tasks, the safety engine and the goal plan.
No second reminder system, no second task system, no second device-support flow.

Reminders are honest about the platform: there is no notification scheduler here, so a reminder is
saved with the plan and EMMI follows up in the app. Nothing tells the patient a notification will
be delivered.

Appointment need is recognised, classified and captured with the fields a scheduler will want
(`requestedProfessionalType`, `reasonSummary`, `urgencyClassification`, `patientPreferredTime`),
and routed to the care team. No scheduling logic is implemented.

## What was built

| Piece | Where |
| --- | --- |
| Taxonomy, record, classifier, resolution engine | `src/goalBarriers.js` (+ `tests/goalBarriers.test.js`) |
| Contextual question, help, follow-up screens | `goalBarrierPicker` / `goalBarrierDescribe` / `goalBarrierHelp` / `goalBarrierFollowUp` in `src/app.js` |
| "Need help?" and "We're working on this" cards | `goalSupportSection` in `src/app.js` |
| Identify → plan → apply → follow up | `recordBarrier`, `planNextBarrierHelp`, `applyBarrierHelp`, `runInterventionSideEffect` |
| Missing-readings signal that asks rather than concludes | `detectGoalSignalBarriers` |
| Barriers in the next best action | `goalNextBestAction({ barriers })` in `src/goals.js` |
| Conversational detection | `DIFFICULTY` gate + `classifyBarrierText` in `src/emmi/textOrchestrator.js` |
| Same record from voice and text | `getGoalBarriers`, `recordGoalBarrier`, `createGoalReminder` tools + `onBarrier` / `onReminder` hooks |
| Persistence | `src/services.js` (interventions, outcomes, follow-up, appointment fields) |

## Rules the engine enforces

- Safety outranks coaching. Anything a category marks `requiresSafetyEvaluation` goes to
  `evaluateClinicalEscalation` before a single intervention is offered, and a safety check that
  cannot run is treated as needing a person rather than as "probably fine".
- EMMI never touches a medication. `MEDICATION_CONCERN` prohibits `MEDICATION_CHANGE_BY_EMMI` and
  every reminder-style intervention; its only path is the care team.
- An intervention that did not help is never offered again — `resolveBarrier` filters out anything
  the record shows as `NOT_HELPED`, `PATIENT_DECLINED` or `NEEDS_ESCALATION`.
- A reminder is not a resolution: it moves the barrier to `IN_PROGRESS` with a follow-up date.
- Declining help is `PATIENT_DECLINED` on the record. It is never described as non-adherence.
- Analytics carry category, source, outcome and timing. They never carry what the patient wrote.

## Deliberately not built

Appointment scheduling. `APPOINTMENT_NEED` is recognised, classified, captured with
`requestedProfessionalType`, `reasonSummary`, `patientPreferredTime`, `urgencyClassification` and
`appointmentStatus`, and routed to the care team as an `APPOINTMENT_REQUEST` task. EMMI says
plainly that she cannot book appointments yet.
