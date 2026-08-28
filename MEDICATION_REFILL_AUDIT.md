# Medication refill orchestration — audit before implementation

## What exists, and how real it is

| Piece | Where | Real or mock |
| --- | --- | --- |
| Medication list | `state.careMedications`: `{id, name, details:"10 mg · Once daily", active}` | Mock fixture. No structured dose, no SIG, no pharmacy, no prescriber, no dispense history, no refills remaining |
| Reconciliation | `savePatientMedicationReview()`, `state.medicationReviews` | Real workflow: `CONFIRMED_CURRENT` / `NOT_TAKING` / `DOSE_CHANGED` / `FREQUENCY_CHANGED`, with `sourceMedicationSnapshot` and `source: "PATIENT"` — provenance is already preserved rather than overwritten |
| Patient-added medications | `state.additionalMedications` + `MEDICATION_RECONCILIATION_REVIEW` tasks | Real workflow |
| Care-team tasks | `state.careTeamTasks`, `ensureGoalCareTeamTask()` | One shared queue, already used by device, medication and goal flows |
| Clinical safety | `evaluateClinicalEscalation` tool, `src/clinicalMonitoring.js` | Deterministic mock rules, explicitly not for clinical use |
| Barriers | `src/goalBarriers.js` | Real engine: categories, interventions, outcomes, follow-up, care-team escalation summaries |
| Appointments | `APPOINTMENT_NEED` barrier + `APPOINTMENT_REQUEST` care-team task | Stub. `docs/specs/appointment-coordination.md` is written but unimplemented |
| Prescriber | `offer.referringProvider {id, name, specialty, practiceName}`, `offer.physician` | Mock, but structured and trustworthy enough to name |
| Pharmacy | — | **Does not exist anywhere in the product** |
| Dispense / fill feed | — | **Does not exist** |
| Reminders | goal `reminderPreference`, in-app only | Real, and honest: there is no notification scheduler |
| Audit | `audit(state, type, outcome, details)`, persisted with the draft | Real |

## What that means for this capability

Two things had to be created because nothing could stand in for them: a **pharmacy** on the
medication record, and the **dispense information** any supply estimate depends on (fill date,
days supply, quantity, refills remaining, expiry). Both are fixture data, marked as such, shaped
the way a real feed would arrive so the engine does not have to change when one exists.

Everything else is orchestration over what is already there: reconciliation interrupts the refill,
the safety engine outranks it, the barrier engine owns "I could not get it", the care-team queue
carries escalations, and appointment need is the existing stub rather than a second scheduler.

## What was built

| Piece | Where |
| --- | --- |
| Supply estimation, confidence, versioned trigger policy | `src/medicationSupply.js` |
| Refill path resolver, need/request/episode model, status vocabulary, dedupe, idempotency | `src/medicationRefill.js` |
| My Medications, refill review flow, status cards, follow-up | `src/app.js` |
| Supply and refill fixture data | `src/app.js` medication defaults |
| Tools and conversational entry | `src/emmi/tools.js`, `src/emmi/textOrchestrator.js` |

## Rules the engine enforces

- An estimate is never a fact. Low supply raises a **signal**, and only a patient answer turns it
  into a refill.
- Confidence changes the words. A weak estimate asks a question; it never states a number of days.
- PRN and variable dosing are not estimated linearly — they are excluded from proactive detection.
- Reconciliation interrupts. "Something changed", a different dose, or "I no longer take it" stops
  the refill and routes to review; a patient report never edits the clinical order.
- Safety outranks refills. A concern about how a medicine makes the patient feel goes to the safety
  engine and the care team, never through the ordinary refill path.
- `REQUESTED` ≠ `APPROVED` ≠ `READY`. Each state is only ever shown when its own source says so.
- A failed submission never produces a success message.
- One request per medication: an idempotency key and an active-request check, so a double tap, a
  voice turn and a button cannot each create one.
