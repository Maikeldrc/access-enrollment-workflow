# Appointment Coordination — Architecture & File Ownership (Phase 2)

Source of truth: `docs/specs/appointment-coordination.md`.
This document is the **implementation contract**. Phase 3 agents build against it and may not
change it. Anything not written here that touches a shared file is the lead's.

---

## 0. What Phase 1 established

- **No appointment entity exists anywhere.** The only substrate is
  `BARRIER_CATEGORIES.APPOINTMENT_NEED` + `APPOINTMENT_REQUEST_FIELDS` in `src/goalBarriers.js`.
- **Three incompatible `APPOINTMENT_REQUEST` care-team task producers** exist
  (`src/app.js:2676`, `:3028`, `:5542`), each with a different `summary` shape, each pinned by e2e
  assertions. They are unified **behind** a new summary builder without changing the keys the
  existing tests read.
- `tests/goalBarriers.test.js:61-69` asserts `barrier.appointmentRequest` has **no** `scheduledAt`.
  → A real appointment therefore lives on its **own record**, never by widening
  `barrier.appointmentRequest`.
- **No provider directory, no notifications, no scheduler, no calendar, no ICS, no SMS/email.**
  The entire product's outbound surface is one `sms:` deep link for ACCESS marketing.
- `state.careCirclePermissions.helpWithAppointments` exists (`src/app.js:105`) and is **read
  nowhere**. `src/app.js:5748` self-promotes an invite to `ACCEPTED` when the *patient* saves
  permissions.
- `src/config.js:288` copies `specialty: "Primary Care"` / `practiceName: "Fresner Medical Group"`
  onto whatever physician display name is configured — a live §11 DO-NOT-INVENT-PROVIDER violation.
- `recordBarrier` returns `null` without a goal (`src/app.js:2873`); barriers are structurally
  goal-scoped.
- `state.language` is lowercase `"en" | "es" | "ht"`. New modules take `locale` in that form.

### Honesty ledger — what this build may NOT claim

These are prototype limits the spec itself guards against. Every one is surfaced to the patient
in plain language rather than faked.

| Spec | Product reality | What we ship |
|---|---|---|
| §48-50 reminders | no scheduler, no channel | in-app only, explicitly labelled; `appointmentReminderCapability()` returns `canNotifyDevice: false` |
| §58 join visit | no telehealth link source | button rendered **only** when the record carries a real `joinUrl`; otherwise "Your team will send the link" |
| §59 directions | no provider address | rendered **only** when `locationAddress` is present |
| §60 add to calendar | no ICS | not offered; §60 says "when technically supported" |
| §73 notification | none | appointment changes surface in-app on next open, described as such |
| §157 backend authorization | no backend | `canActOnAppointment()` is the single chokepoint; documented as a prototype limitation, not as security |

---

## 1. Domain contracts

### 1.1 `src/appointments.js` — the entity, the status machine, the truth

```js
const T = (en, es, ht) => Object.freeze({ en, es, ht });
export const localAppointmentText = (value, locale = "en") =>
  (typeof value === "string" ? value : value?.[locale] || value?.en || "");
```

**Enums** (all `Object.freeze`, key === value):

```js
APPOINTMENT_SOURCES   = { PATIENT_DIRECT_REQUEST, EMMI_CONVERSATION, GOAL_BARRIER,
                          CARE_TEAM, FOLLOW_UP, SYSTEM_WORKFLOW }                      // §7

APPOINTMENT_STATUS    = { NEED_IDENTIFIED, DRAFT, COLLECTING_PREFERENCES,
                          SEARCHING_AVAILABILITY, SLOTS_AVAILABLE,
                          PENDING_PATIENT_SELECTION, BOOKING, REQUEST_SENT,
                          WAITING_FOR_OFFICE, PROPOSED_TIME, CONFIRMED,
                          RESCHEDULE_REQUESTED, CANCEL_REQUESTED, CANCELED,
                          COMPLETED, NO_SHOW, UNABLE_TO_SCHEDULE, DECLINED }           // §37

APPOINTMENT_MODALITY  = { IN_PERSON, TELEHEALTH, PHONE, NO_PREFERENCE }                // §30
APPOINTMENT_URGENCY   = { EMERGENCY, URGENT_CARE_TEAM_REVIEW, SOON, ROUTINE }          // §3-5
TIME_OF_DAY           = { MORNING, AFTERNOON, EVENING, NO_PREFERENCE }                 // §29
APPOINTMENT_ACTORS    = { PATIENT, PERSONAL_REPRESENTATIVE, CARE_TEAM,
                          EMMI_ASSISTED_PATIENT, SYSTEM }                              // §160
APPOINTMENT_REASON_CATEGORIES = { MEDICATION_RENEWAL, MEDICATION_CONCERN,
                          BLOOD_PRESSURE_FOLLOW_UP, SYMPTOM_REVIEW, DEVICE_SUPPORT,
                          LAB_OR_TEST, ROUTINE_FOLLOW_UP, NEW_CONCERN,
                          CARE_PLAN_REVIEW, OTHER }                                    // §84-86
```

**Record** — `createAppointmentNeed(input)` returns a frozen object with exactly these fields:

```
id  patientId  source  reasonCategory  reasonSummary
relatedGoalId  relatedBarrierId  relatedRefillId
requestedProfessionalId  requestedProfessionalType  requestedSpecialty
providerDisplayName  practiceName
preferredModality  preferredTimeOfDay  preferredDateRange
urgencyClassification  schedulingCapability  status
scheduledAt  scheduledEndAt  timezone  modality
locationName  locationAddress  joinUrl  confirmationNumber
proposedTimes[]        // { slotId, startAt, endAt, modality }
idempotencyKey  events[]   // { status, source, actor, at, detail }
createdAt  updatedAt  requestSentAt  confirmedAt  canceledAt  completedAt  resolvedAt
attendanceOutcome  followUpAskedAt
reminder               // null | { slot, time, channel: "IN_APP", createdAt }
prep                   // { topics: [], notes: "", sharedWithProvider: false, updatedAt: "" }
sharedWith[]           // { inviteId, scope, sharedAt }
```

`reasonSummary` is bounded to 400 chars (barrier precedent) and **never** reaches analytics.

**Status machine** — explicit, fail-closed:

```js
export const ALLOWED_TRANSITIONS = Object.freeze({ /* status -> [status] */ });
export function canAdvanceAppointment(appointment, nextStatus) → boolean
export function advanceAppointment(appointment, { status, source, actor, at, detail })
  // → new frozen record on a legal transition, appending to events[] and stamping the
  //   first-transition timestamp for that status (advanceRefill precedent, src/medicationRefill.js:158).
  // → the UNCHANGED input record on an illegal transition. It never invents a success. (§18, §123)
```

Required edges (non-exhaustive, agent completes):
`NEED_IDENTIFIED→DRAFT→COLLECTING_PREFERENCES→SEARCHING_AVAILABILITY→{SLOTS_AVAILABLE,UNABLE_TO_SCHEDULE}`;
`SLOTS_AVAILABLE→PENDING_PATIENT_SELECTION→BOOKING→{CONFIRMED,SLOTS_AVAILABLE}` (booking failure
returns to slots, **never** to CONFIRMED — §123, §124);
`COLLECTING_PREFERENCES→REQUEST_SENT→WAITING_FOR_OFFICE→{PROPOSED_TIME,CONFIRMED,DECLINED,UNABLE_TO_SCHEDULE}`;
`PROPOSED_TIME→{CONFIRMED,DECLINED}`;
`CONFIRMED→{RESCHEDULE_REQUESTED,CANCEL_REQUESTED,COMPLETED,NO_SHOW}`;
`CANCEL_REQUESTED→CANCELED`; `CANCELED`/`COMPLETED`/`NO_SHOW`/`DECLINED` are terminal.

**Patient-facing language** (§20, §36 — internal status is never shown):

```js
appointmentPatientStatus(appointment, locale)  → string
appointmentNextStep(appointment, locale)       → string   // what the patient does next, or ""
appointmentStatusTone(appointment)             → "CONFIRMED"|"WAITING"|"ACTION_NEEDED"|"CLOSED"|"PROBLEM"
```
Tone is for styling only. §107: colour is never the sole carrier — views pair tone with text and icon.

**Queries** (§40, §82, §83):

```js
upcomingAppointments(appointments, now)               → sorted []
pendingRequests(appointments)                         → []
pastAppointments(appointments, now)                   → []
findUpcomingAppointmentWithProvider(appointments, providerId, now) → record | null
findDuplicateAppointmentNeed(appointments, { requestedProfessionalId, reasonCategory }) → record | null
```

**Idempotency** (§125, §126):

```js
appointmentIdempotencyKey({ patientId, providerId, slotId, action })  → stable string
findByIdempotencyKey(appointments, key) → record | null
```
`action ∈ { BOOK, REQUEST, RESCHEDULE, CANCEL }`. Every mutating call computes the key first and
returns the existing record on a hit. Refill precedent: `refillIdempotencyKey` / `findDuplicateRefill`.

**Draft** (§80, §81, §127):

```js
APPOINTMENT_DRAFT_FIELDS = Object.freeze([...])
createAppointmentDraft(seed)            → draft
updateAppointmentDraft(draft, patch)    → draft
draftIsSubmittable(draft)               → { ok, missing: [] }
serializeAppointmentDraft(draft)        → plain object (persistence)
serializeAppointmentForDraft(record)    → plain object (persistence)
```
A draft is **never** auto-submitted. `draftIsSubmittable` gates the submit button; it does not submit.

**Care-team task summary** (§22) — the single contract that unifies the three producers:

```js
appointmentCareTeamSummary(appointment, { patientLabel, knownBarriers, contactPreference, locale })
→ { patient, requestedProfessional, requestedProfessionalType, specialty, reasonCategory,
    reasonSummary, preferredModality, preferredTiming, knownBarriers: [], contactPreference,
    needId, urgencyClassification, requestedAt,
    // back-compat keys the existing e2e tests read, preserved verbatim:
    appointmentStatus, patientPreferredTime }
```
No transcripts. `knownBarriers` carries barrier **categories**, never `patientDescription`.

**Authorization + audit** (§157-§160):

```js
resolveAppointmentActor({ completionRole, role, viaEmmi }) → APPOINTMENT_ACTORS.*
canActOnAppointment({ actor, action, identityVerified, careCirclePermissions })
  → { allowed: boolean, reason: string }
```
`action ∈ { VIEW, CREATE, BOOK, RESCHEDULE, CANCEL, SHARE, REMIND }`.
Hard rules: a Care Circle member may never `CANCEL` or `RESCHEDULE` (§158). A personal
representative may act only when `identityVerified` (§159). Unknown actor → deny.

```js
APPOINTMENT_AUDIT_EVENTS = Object.freeze({
  NEED_CREATED: "appointment_need_created",
  PROVIDER_RESOLVED: "appointment_provider_resolved",
  AVAILABILITY_REQUESTED: "appointment_availability_requested",
  SLOTS_SHOWN: "appointment_slots_shown",
  SLOT_SELECTED: "appointment_slot_selected",
  BOOKING_ATTEMPTED: "appointment_booking_attempted",
  BOOKING_CONFIRMED: "appointment_booking_confirmed",
  REQUEST_SENT: "appointment_request_sent",
  RESCHEDULE_REQUESTED: "appointment_reschedule_requested",
  CANCELED: "appointment_canceled",
  REMINDER_CREATED: "appointment_reminder_created",
  BARRIER_IDENTIFIED: "appointment_barrier_identified",
  CARE_TEAM_TASK_CREATED: "appointment_care_team_task_created",
  FOLLOW_UP_OUTCOME: "appointment_follow_up_outcome",
  SHARED_WITH_CARE_CIRCLE: "appointment_shared_with_care_circle"
});

appointmentAnalytics(appointment) → { needId, source, reasonCategory, urgencyClassification,
  schedulingCapability, status, modality, hasProvider, actor, daysUntil }
```
§117: `appointmentAnalytics` must **never** emit `reasonSummary`, `providerDisplayName`,
`practiceName`, `locationAddress`, `joinUrl`, `scheduledAt`, or any patient free text.
A unit test asserts this by key allow-list.

---

### 1.2 `src/schedulingCapability.js` — can this actually be scheduled?

```js
SCHEDULING_CAPABILITY = Object.freeze({ DIRECT_BOOKING, STRUCTURED_REQUEST,
                                        HUMAN_COORDINATION, NO_AVAILABLE_CHANNEL });   // §14

resolveSchedulingCapability({ patientId, providerId, practiceId, appointmentType })
  → { capability, supportedModalities: [], reason, source: "PROTOTYPE_CONFIG" }        // §24

getProviderAvailability({ providerId, preferredTimeOfDay, preferredDateRange, modality, now })
  → { ok: true, slots: [{ slotId, startAt, endAt, modality, providerId, locationName, expiresAt }] }
  | { ok: false, error: "AVAILABILITY_UNAVAILABLE" }                                   // §16, §122

bookSlot({ appointment, slotId, idempotencyKey, now })
  → { ok: true, status, confirmationNumber, scheduledAt, scheduledEndAt, modality, locationName }
  | { ok: false, slotGone: true }        // §124 — a slot vanished between display and booking
  | { ok: false, error }                 // §123

submitAppointmentRequest({ appointment, idempotencyKey, now })
  → { ok: true, status: REQUEST_SENT, requestSentAt } | { ok: false, error }
```

Rules the module enforces, not the caller:
- **§16 real availability only.** `getProviderAvailability` returns slots only for a provider whose
  capability is `DIRECT_BOOKING`. Any other capability returns `{ ok: false, error: "NO_AVAILABILITY_SOURCE" }`.
- Availability is deterministic prototype data seeded from `providerId` + `now`, tagged
  `source: "PROTOTYPE_CONFIG"`. It is never generated for a provider the directory did not resolve.
- One designated fixture slot always fails `bookSlot` with `slotGone: true` so §124 is provable.
- One designated provider resolves to `NO_AVAILABLE_CHANNEL` so §23 is provable.

### 1.3 `src/careTeamDirectory.js` — who can help (§10-13, §87-89)

```js
PROFESSIONAL_TYPES = Object.freeze({ PRIMARY_CARE, SPECIALIST, CARE_MANAGER,
                                     PHARMACIST, NURSE, DEVICE_SUPPORT, UNKNOWN });

buildCareTeam({ offer, medications, locale })
  → [{ id, displayName, professionalType, specialty, practiceName, source, verified }]

resolveRequestedProfessional(careTeam, { text, specialty, professionalType, locale })
  → { status: "RESOLVED"|"AMBIGUOUS"|"NOT_FOUND", match, candidates: [] }

professionalNotFoundPlan({ requestedSpecialty, locale })
  → { action: "CARE_TEAM_TASK", taskType: "CARE_TEAM_MEMBER_REQUEST", message }
```

**§11 fix, in scope:** `buildCareTeam` emits `specialty` / `practiceName` **only** when the source
record carries them for that same identity. When `src/config.js:288` has substituted a configured
`physicianDisplayName` over the `dr-fresner` literal, specialty and practice are emitted as `""`
and the views omit those lines. The product may not state a specialty it does not know.

`verified: false` on anything derived from a display-name slug. Views must not render a
verification mark for unverified entries.

---

### 1.4 `src/emmi/appointmentIntents.js` (§118, §130-135)

```js
APPOINTMENT_INTENTS = Object.freeze({ APPOINTMENT_STATUS, APPOINTMENT_CHANGE, APPOINTMENT_NEED });
classifyAppointmentIntent(text, locale)
  → { intent, action: "VIEW"|"RESCHEDULE"|"CANCEL"|"REQUEST", providerHint, timeHint } | null
```

Matching is regex over apostrophe-folded, word-boundaried text (the `foldApostrophes` +
`\b` conventions already in `src/goalBarriers.js`). EN / ES / HT.

Documented hazards from Phase 1 that the tests must pin:
- `"need to see"` must not be swallowed by the difficulty classifier.
- `"schedule"` must not match the reminder intent.
- `"cancel"` must not match enrollment cancellation.
- BP reading `"10/30"` must not read as a date.
- Kreyòl `machin` (car) must not match `machine`.

### 1.5 `src/appointmentSupport.js` (§48-56, §65-69, §52-53)

```js
APPOINTMENT_REMINDER_SLOTS = Object.freeze([{ id: "DAY_BEFORE" }, { id: "MORNING_OF" },
                                            { id: "TWO_HOURS_BEFORE" }]);              // §48
appointmentReminderCapability() → { channels: ["IN_APP"], canNotifyDevice: false, note } // §50
createAppointmentReminder(appointment, slotId, { now, confirmed })
  → { ok, reminder, note } | { ok: false, status: "CONFIRMATION_REQUIRED" }            // §49

ATTENDANCE_OUTCOMES = Object.freeze({ ATTENDED, MISSED, RESCHEDULED, UNKNOWN });       // §65
appointmentFollowUpDue(appointment, now)                → boolean
attendanceFollowUpPlan(outcome, locale)
  → { question, options: [], nextAction, barrierCategory }                             // §66-68

appointmentBarrierPlan(reasonKey)
  → { category, patientDescriptionKey }        // maps ONLY onto existing BARRIER_CATEGORIES
careCircleSharingOptions({ invites, careCirclePermissions, completionRole })
  → { allowed, reason, eligibleMembers: [] }                                           // §54, §56
appointmentShareScope() → frozen scope object  // §55 share ≠ full access
```

**§52 constraint:** the spec names `CAREGIVER_AVAILABILITY`, `LOCATION_UNCLEAR`,
`TECHNOLOGY_TELEHEALTH`, `MOBILITY`, `TIME_CONFLICT`. `src/goalBarriers.js:5-7` forbids growing the
taxonomy. `appointmentBarrierPlan` therefore **maps** them onto existing categories
(`SOCIAL_SUPPORT`, `OTHER`, `DEVICE_TECHNOLOGY`, `PHYSICAL_LIMITATION`, `TIME_ROUTINE`,
`TRANSPORTATION`, `FINANCIAL`, `ACCESS_TO_CARE`) and never adds a category.

**§54/§56 constraint:** `careCircleSharingOptions` returns `allowed: false` unless there is at
least one invite whose status is `ACCEPTED` **and** `careCirclePermissions.helpWithAppointments`
is true. It must not rely on `barrierCapabilities().careCircleAvailable`, which only checks
`completionRole`. This is the first place in the product where a care-circle permission is
actually enforced.

### 1.6 `src/appointmentViews.js` + `src/appointments.css` (§97-§114)

Pure functions returning HTML strings. **No import from `app.js`.** Every export takes one props
object that always includes `{ locale, icon }`, where `icon` is `app.js`'s `icon(name, extra)`
function passed in. Views must escape all interpolated text via an `escapeHtml` passed in as
`props.escapeHtml`.

```js
upcomingCareSection({ appointments, locale, icon, escapeHtml, now })   // §38, §108
needAnAppointmentCard({ locale, icon })                               // §39
appointmentsListScreen({ appointments, tab, locale, icon, escapeHtml, now })  // §40
appointmentDetailView({ appointment, capability, locale, icon, escapeHtml, now }) // §110, §111
slotPickerView({ appointment, slots, locale, icon, escapeHtml })       // §31-33, §100, §101
bookingConfirmationView({ appointment, locale, icon, escapeHtml })     // §34
requestConfirmationView({ appointment, locale, icon, escapeHtml })     // §35
appointmentPrepView({ appointment, locale, icon, escapeHtml })         // §43, §44, §112
appointmentBriefView({ appointment, locale, icon, escapeHtml })        // §45, §46, §47
appointmentBarrierCheckView({ appointment, locale, icon, escapeHtml }) // §51, §113
appointmentShareView({ appointment, members, locale, icon, escapeHtml })  // §114
appointmentFollowUpView({ appointment, locale, icon, escapeHtml })     // §65-68
appointmentPreferenceView({ draft, step, locale, icon, escapeHtml })   // §26-30
```

UI rules the views must obey:
- **§26 one question at a time.** `appointmentPreferenceView` renders exactly one question per step.
- **§32 no dense calendar first.** Availability opens as at most 3 slot cards + "See more times".
- **§100/§154** no month grid anywhere.
- **§99** every tap target ≥ 44px; slot cards are full-width buttons at 384px.
- **§102/§103** long provider and practice names wrap — reuse `.medication-identity`'s
  `overflow-wrap: anywhere` pattern; never truncate a provider name to an ellipsis.
- **§98** all sizing in `rem`, so 125% and 150% font scaling reflow rather than clip.
- **§107** status is text + icon + colour, never colour alone.
- **§58/§59/§60** join / directions / calendar controls render **only** when the record carries
  `joinUrl` / `locationAddress`; calendar is not offered at all.

New icon names required (the **lead** adds them to `src/app.js`'s lucide import and `iconMap`):
`mapPin` → `MapPin`, `video` → `Video`, `alert` → `TriangleAlert`, `calendarClock` → `CalendarClock`.
Views may use only these plus icons already in `iconMap`.

`src/appointments.css` is linked from `index.html` **after** `styles.css` (lead edit), so it can
override without touching the cascade of the existing sheet. Class prefix: `.appointment-*`.
Register every new class that carries text in the senior-typography layer list the lead maintains
at `src/styles.css:1656`.

---

## 2. EMMI runtime tool contract (§119)

Reuse, do not duplicate: `getCareTeam`, `createCareTeamTask`, `evaluateClinicalEscalation`,
`getGoalBarriers`, `recordGoalBarrier`, `createGoalReminder`.

New declarations in `src/emmi/tools.js` (Agent 2) dispatching to hooks implemented in `src/app.js`
(lead). **This table is the interface; neither side may change it unilaterally.**

| Tool | Hook | Returns |
|---|---|---|
| `getUpcomingAppointments` | `onUpcomingAppointments()` | `{ appointments: [{ id, patientStatus, providerDisplayName, specialty, scheduledAt, modality }] }` |
| `getAppointment` | `onAppointment({ appointmentId })` | `{ appointment }` \| `{ success:false, status:"NOT_FOUND" }` |
| `getSchedulingCapability` | `onSchedulingCapability({ providerId, appointmentType })` | `{ capability, supportedModalities }` |
| `getProviderAvailability` | `onProviderAvailability({ providerId, preferredTimeOfDay, modality })` | `{ ok, slots }` \| `{ ok:false, error }` |
| `startAppointmentRequest` | `onStartAppointmentRequest({ reasonCategory, providerId, reasonSummary })` | `{ success:true, status:"FLOW_OPENED", needId }` — **requests nothing by itself** (startRefillReview precedent) |
| `createAppointmentRequest` | `onCreateAppointmentRequest({ needId, confirmed })` | `{ success, status, needId }`; `confirmed !== true` → `{ success:false, status:"CONFIRMATION_REQUIRED" }` |
| `bookAppointment` | `onBookAppointment({ needId, slotId, confirmed })` | `{ success, status, confirmationNumber }` \| `{ success:false, status:"SLOT_UNAVAILABLE" }` |
| `rescheduleAppointment` | `onRescheduleAppointment({ appointmentId, confirmed })` | `{ success, status }` |
| `cancelAppointment` | `onCancelAppointment({ appointmentId, confirmed })` | `{ success, status }`; **§64 — `confirmed !== true` always returns `CONFIRMATION_REQUIRED`** |
| `createAppointmentReminder` | `onAppointmentReminder({ appointmentId, slot, confirmed })` | `{ success, slot, time, channel:"IN_APP", note }` |
| `getCareCircle` | `onCareCircle()` | `{ members: [{ inviteId, firstName, relationship, status }] }` |
| `shareAppointment` | `onShareAppointment({ appointmentId, inviteId, confirmed })` | `{ success, status, scope }` |

Every mutating tool requires `confirmed === true` (existing `createGoalReminder` precedent,
`src/emmi/tools.js:171`). Every failure returns `success: false` with a status — never a message
that implies the action happened (§122, §123, §21 tool-failure rules).

`tests/emmiTextOrchestrator.test.js`'s harness throws `unexpected ${name}` for unknown tools —
Agent 2 must register all twelve there.

### Orchestrator ordering (`src/emmi/textOrchestrator.js`)

Insert at **L390**, after the `REFILL_NEED` block (ends L388) and before `DIFFICULTY` (L392).
Internal order: **`APPOINTMENT_STATUS` → `APPOINTMENT_CHANGE` → `APPOINTMENT_NEED`**.
Safety (`CLINICAL_SYMPTOM`) already runs earlier and must stay earlier (§3, §4, §5, §139).

### The five "EMMI cannot book" assertions

These must change together. Splitting them ships a contradiction.

| File | Line | Owner |
|---|---|---|
| `src/emmi/systemPrompt.js` | 19 | Agent 2 |
| `src/emmi/systemPrompt.js` | 21 | Agent 2 |
| `src/emmi/textOrchestrator.js` | 51 | Agent 2 |
| `src/app.js` | 2975 | **Lead** |
| `e2e/goal-barriers.spec.js` | 237 | **Lead** |
| `GOAL_BARRIERS_AUDIT.md` | 78 | **Lead** |

New `APPOINTMENTS:` paragraph goes in `systemPrompt.js` as a new line 20, between refills and goal
difficulties. It must say: EMMI resolves the provider from the care team and never invents one;
safety is evaluated before any scheduling; capability is resolved before anything is offered;
availability comes only from `getProviderAvailability`; a request is not a confirmed appointment;
cancellation and rescheduling require explicit confirmation; reminders are in-app only.

---

## 3. Shell integration (LEAD-OWNED)

### `src/app.js`
- state literal (`:67-112`) and reset literal (`:4038`): `appointments: []`,
  `appointmentDraft: null`, `appointmentFlow: null`, `activeAppointmentId: ""`.
- lucide import (`:6-13`) + `iconMap`: `mapPin`, `video`, `alert`, `calendarClock`.
- EMMI tool hooks (`:840-903`): the twelve hooks above.
- `privacySafeEmmiEventDetails` (`:820`) and `emmiToolStatusLabel` (`:822-833`): new tool names.
- `assistantLayer` quickAction ladder (`:1816`): appointment quick actions — an unknown
  quickAction currently falls back to "Share ACCESS".
- `renderers.*` append region (after `:3931`) — **never** edit the `:3925` literal:
  `MY_APPOINTMENTS`, `APPOINTMENT_DETAIL`, `APPOINTMENT_SCHEDULING`.
- `myCareScreen` (`:2355-2367`): `${upcomingCareSection(...)}` + `${needAnAppointmentCard(...)}`.
- delegated action chain (`~:5142-6100`): all `data-action="appointment-*"` handlers.
- `coordinate-refill-appointment` (`:5534-5551`): route through the new module, preserving
  `relatedAppointmentNeedId` and the keys `e2e/medication-refill.spec.js:197-200` asserts.
- boot restore (`:6435-6540`): rehydrate `appointments` / `appointmentDraft` with a guard.
- `:2975`: the "cannot book" copy.

### `src/services.js`
`DraftStore.save()` whitelist: `appointments` (via `serializeAppointmentForDraft`),
`appointmentDraft` (via `serializeAppointmentDraft`), `activeAppointmentId`.
**Not** `appointmentFlow` — transient. Unlisted fields vanish silently on reload.

### `src/machine.js`
`PROGRESS_STAGE_BY_SCREEN`: `MY_APPOINTMENTS`, `APPOINTMENT_DETAIL`, `APPOINTMENT_SCHEDULING`
→ `"YOUR_CARE"`.

### `index.html`
`<link rel="stylesheet" href="/src/appointments.css" />` after the `styles.css` link.

### `src/styles.css`
Senior-typography class registration only (`:1656`). All new rules live in `appointments.css`.

---

## 4. File ownership — no file has two owners

| File | Owner |
|---|---|
| `src/appointments.js` *(new)* | **Agent 1 — Domain** |
| `src/schedulingCapability.js` *(new)* | Agent 1 |
| `src/careTeamDirectory.js` *(new)* | Agent 1 |
| `tests/appointments.test.js` *(new)* | Agent 1 |
| `tests/schedulingCapability.test.js` *(new)* | Agent 1 |
| `tests/careTeamDirectory.test.js` *(new)* | Agent 1 |
| `src/emmi/appointmentIntents.js` *(new)* | **Agent 2 — EMMI/Safety** |
| `src/emmi/textOrchestrator.js` | Agent 2 |
| `src/emmi/tools.js` | Agent 2 |
| `src/emmi/systemPrompt.js` | Agent 2 |
| `tests/appointmentIntents.test.js` *(new)* | Agent 2 |
| `tests/emmiTextOrchestrator.test.js` | Agent 2 |
| `src/appointmentViews.js` *(new)* | **Agent 3 — Patient UI** |
| `src/appointments.css` *(new)* | Agent 3 |
| `tests/appointmentViews.test.js` *(new)* | Agent 3 |
| `src/appointmentSupport.js` *(new)* | **Agent 4 — Care Team / Circle / Follow-up** |
| `tests/appointmentSupport.test.js` *(new)* | Agent 4 |
| `src/app.js` | **LEAD ONLY** |
| `src/services.js` | **LEAD ONLY** |
| `src/machine.js` | **LEAD ONLY** |
| `src/styles.css` | **LEAD ONLY** |
| `index.html` | **LEAD ONLY** |
| `e2e/**` | **LEAD ONLY** (Phase 3) / QA agents (Phase 4, one new spec file each) |
| `src/goalBarriers.js`, `src/goals.js`, `src/medication*.js`, `src/config.js`, `src/growth.js` | **FROZEN** — no agent edits them |

Agents 1-4 run fully in parallel: none of them shares a file with another. The lead wires the
shell afterwards, alone. That is the only serialisation the file layout forces.

---

## 5. Acceptance-criteria traceability (§161)

| # | Criterion | Owner |
|---|---|---|
| 1 | Request appointment conversationally | Agent 2 + lead |
| 2 | Safety before ordinary scheduling | Agent 2 |
| 3 | Provider resolved from Care Team | Agent 1 |
| 4 | Missing provider enters Care Team workflow | Agent 1 + Agent 4 |
| 5 | Scheduling capability explicitly resolved | Agent 1 |
| 6 | Direct booking uses real availability only | Agent 1 |
| 7 | Request never claims confirmed | Agent 1 + Agent 3 |
| 8 | Human coordination fallback exists | Agent 1 + Agent 4 |
| 9 | Clear patient-facing status | Agent 1 + Agent 3 |
| 10 | Existing appointments prevent duplicates | Agent 1 |
| 11 | Explicit reschedule/cancel workflows | Agent 1 + lead |
| 12 | Cancellation requires confirmation | Agent 1 + Agent 2 |
| 13 | Barriers integrate with Barrier Engine | Agent 4 |
| 14 | Care Circle only via scoped permission | Agent 4 |
| 15 | Preparation available | Agent 3 |
| 16 | Patient reviews discussion topics | Agent 3 |
| 17 | Reminders explicit and verified | Agent 4 |
| 18 | Follow-up detects attended/missed/rescheduled | Agent 4 |
| 19 | My Care shows Upcoming Care | Agent 3 + lead |
| 20 | Runtime facts from trusted tools | Agent 2 |
| 21 | Tool failure never fabricates confirmation | Agent 1 + Agent 2 |
| 22 | Same EMMI voice and conversation | Agent 2 + lead |
| 23 | Barge-in works | lead (regression) |
| 24 | Mobile 384px excellent | Agent 3 |
| 25 | 150% font scaling usable | Agent 3 |
| 26 | Backend enforces access/security | Agent 1 (`canActOnAppointment`) — documented prototype limit |
