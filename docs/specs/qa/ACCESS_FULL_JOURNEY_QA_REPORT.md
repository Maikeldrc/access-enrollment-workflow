# ACCESS full journey — QA report

**Branch:** `feat/access-care-activation` · **Commit at time of writing:** `2933087`
**Scope:** post-enrollment care activation, Care Circle, EMMI surfaces.

## How to read this

This records defects **found and fixed** while building the care activation refactor. It is not yet
a certification: the audit of the pre-enrollment half of the journey (Home through Consent) has not
been run, and the full clean run required by §89 has not happened. See *Not yet audited* at the end
for what that means for a release decision.

Every entry below was reproduced, root-caused and fixed in this branch. Where a defect could only be
seen in a browser, that is stated — it is the single most important pattern in this report.

## The pattern worth naming first

Nine of the seventeen defects below were invisible to the unit suite. It stayed green at 860 tests
through a dead primary button, a screen rendering in a 44px column, a handler throwing on every
submit, and an entire public page being replaced by another one's markup. In each case the markup
read correctly, the state shape was right, and only opening the page showed the fault.

The e2e suite that would have caught them was itself asserting screens that no longer exist, so it
could not run clean. That is the coverage gap this branch inherited and has not yet closed.

---

## Defects

### QA-01 · Absent blood pressure reading read as perfect control
**Severity:** CRITICAL · **Screen:** goals / care plan (model)
**Steps:** resolve outcome status for a patient with no reading.
**Expected:** no data. **Actual:** `CONTROLLED`.
**Root cause:** `Number(null)` is `0`, so a missing value passed a `Number.isFinite` guard and then
compared as below every threshold.
**Fix:** every number enters `src/accessCareActivation.js` through a strict parser that rejects
null, undefined and empty string, and requires a positive value — there is no systolic of 0.
**Test:** `tests/accessCareActivation.test.js`, two cases. **Status:** FIXED

### QA-02 · Care activation progress counted screens, not stages
**Severity:** MEDIUM · **Screen:** all activation screens
**Expected:** a number that means something. **Actual:** step 1 of 11; three taps arranging a
monitor moved it three times.
**Root cause:** progress sliced the journey array directly.
**Fix:** four named stages (device, goals, personalize, care plan) in `src/machine.js`.
**Test:** `tests/machine.test.js`. **Status:** FIXED

### QA-03 · Baseline never started after the health check was removed
**Severity:** HIGH · **Screen:** enrollment complete
**Root cause:** the removed screen was what set `baselineStatus` to `IN_PROGRESS` and wrote the
`baseline_started` audit entry.
**Fix:** moved to the enrollment-confirmed transition, where care activation now begins.
**Status:** FIXED

### QA-04 · A patient who already had a monitor was sent to request another
**Severity:** HIGH · **Screen:** device
**Root cause:** removing the "do you own a monitor?" question left the journey hardcoded to
`needed`. The verification path became unreachable for everybody, including the QA screen selector,
which only lists screens in the current journey.
**Fix:** the path is derived from the patient record, which is what "we never ask because we already
know" was supposed to mean. An explicit `bpDevicePath` still wins.
**Test:** `tests/machine.test.js`, per scenario. **Status:** FIXED

### QA-05 · "Personalize my care" did nothing
**Severity:** BLOCKER · **Screen:** Your ACCESS health goals
**Steps:** reach the goals screen, press the primary button.
**Expected:** advance. **Actual:** nothing; the patient could not leave the screen.
**Root cause:** the transition handler returns early on `GOALS` so the old chooser could own its
multi-step actions. The rewritten screen emits the generic `next`, which that early return swallowed.
**Fix:** ACCESS is handled explicitly; every other program keeps the early return.
**Browser-only:** yes. **Status:** FIXED

### QA-06 · My Goals was empty for every ACCESS patient
**Severity:** HIGH · **Screen:** My Goals
**Root cause:** goal records were only ever created from the chooser's selection. A patient never
asked to choose finished activation owning none, having just been shown two.
**Fix:** assigned goals become records when the patient moves past the goals screen, marked
`selectedBy: PATHWAY`.
**Test:** `tests/accessCareActivation.test.js` holds every assigned type to the goal catalogue — a
missing one does not throw, it silently becomes "My personal goal". **Status:** FIXED

### QA-07 · An assigned goal claimed the patient had chosen it
**Severity:** MEDIUM · **Screen:** My Goals (after reload)
**Root cause:** the draft dropped `goalSource` and `selectedBy`, and a reader downstream defaults
`selectedBy` to `PATIENT`.
**Fix:** both fields persist. **Status:** FIXED
**Caveat:** verified at creation and in the deployed bundle; not yet re-verified end to end after a
reload with a freshly created goal.

### QA-08 · Care plan screen collided with an existing component
**Severity:** HIGH · **Screen:** care plan, and the goal plan review
**Actual:** goal sections rendered in a 44px column, one word per line, the weight goal's heading
overlapping its own starting point — and the pre-existing component picked up the new rules.
**Root cause:** four class names (`care-plan-goal`, `-block`, `-goals`, `-device`) were already
taken.
**Fix:** everything the new screen owns is prefixed `access-plan-`; original rules unchanged.
**Browser-only:** yes. **Status:** FIXED

### QA-09 · The care manager was an organization
**Severity:** MEDIUM · **Screen:** My Care Team
**Actual:** "ITERA HEALTH" sat between the patient's doctor and their pharmacy in a slot labelled
Care Manager — an entry nobody could ask for.
**Fix:** a named person, with the organization as the practice behind her. Only a care manager
assigned on the offer is marked Verified; the prototype default is not, because certifying an
invented person is the one thing the directory refuses to do.
**Test:** `tests/careTeamDirectory.test.js`. **Status:** FIXED

### QA-10 · The care manager's name was overwritten by her job title
**Severity:** HIGH · **Screen:** My Care Team
**Root cause:** `patientCareTeam` relabelled the entry on the way to the view — correct while the
directory returned an organization, and undoing the fix once it returned a person.
**Browser-only:** yes. QA-09 shipped with no visible effect and a green suite. **Status:** FIXED

### QA-11 · The barrier handler threw on every submit
**Severity:** BLOCKER · **Screen:** support needs
**Actual:** Continue did nothing, no barrier was created, no error shown to the patient.
**Root cause:** `findReusableBarrier(barriers, { category, goalId })` was called as
`(goal, category)`, so it filtered an object.
**Browser-only:** yes — visible as a console `TypeError`. **Status:** FIXED

### QA-12 · The weight goal offered no relevant difficulties
**Severity:** MEDIUM · **Screen:** support needs
**Actual:** questions about medications and scheduling, nothing about eating, moving or weighing.
**Root cause:** barrier options key off action templates, and a goal assigned minutes earlier has no
actions — those are created when a plan is personalized.
**Fix:** the goal's suggested actions stand in, at the call site rather than inside the shared model.
**Status:** FIXED

### QA-13 · "Support we added for you" listed what the patient reported
**Severity:** MEDIUM · **Screen:** final care activation
**Actual:** "Support we added for you: I forget to do it", with nothing actually started.
**Fix:** each barrier now starts the first intervention its category configures, and the summary
lists what started, in words a patient recognizes. **Status:** FIXED

### QA-14 · Accepting a Care Circle invitation granted access immediately
**Severity:** CRITICAL · **Screen:** Care Circle invitation
**Root cause:** acceptance activated the membership. Opening a link proves somebody opened a link,
and the link arrives by SMS on a phone that may have been forwarded.
**Fix:** membership starts `PENDING_VERIFICATION` with no permissions and `authority: NONE`; only
the code sent to the number the patient named activates it.
**Test:** `tests/growth.test.js`, four cases. **Status:** FIXED

### QA-15 · Removing a member left their membership active
**Severity:** CRITICAL · **Screen:** My Care Circle
**Root cause:** removal closed the invitation only. A removed person whose membership stayed ACTIVE
is exactly the stale grant a later request is checked against.
**Fix:** removal revokes the membership and drops its permissions. **Status:** FIXED

### QA-16 · A rewrite replaced the wrong public page
**Severity:** BLOCKER · **Screen:** `/access/learn`
**Root cause:** two public pages open with identical markup, and the edit matched the first.
**Detection:** the deployed bundle contained the new copy, so the unchanged screen looked like a
caching problem rather than a rewrite applied elsewhere.
**Fix:** landing markup restored verbatim; the rewrite moved to `renderSupportAcceptance`.
**Browser-only:** yes. No test covers either public page. **Status:** FIXED

### QA-17 · Contacts unavailable showed nothing at all
**Severity:** LOW · **Screen:** Care Circle invite
**Actual:** on a device without the Contact Picker the button simply vanished, leaving manual fields
with no account of the option the patient may have been told to look for.
**Fix:** a calm note, not an error. Phone type labels are also localized — the picker returns raw
`mobile` / `home` strings that appeared untranslated beside an already-translated fallback.
**Status:** FIXED

---

## Not yet audited

Stated plainly, because a certification cannot be issued over them:

- **Home through Consent** — the pre-enrollment half of §3 has not been re-audited in this branch.
- **EMMI on every new screen.** It has no narrative entry for the device screen, does not know the
  assigned goals, the selected barriers or the active interventions, and cannot explain the
  difference between the improvement milestone and the control target. §91 lists incorrect EMMI
  context as a release blocker, so this alone prevents a READY verdict.
- **The full clean run of §89** — every result above was reached by seeding state, not by walking
  from Home through the real UI.
- **Responsive and font scaling** — spot-checked at 384px with no horizontal overflow on the screens
  built here; the 7 widths × 3 scales matrix has not been run.
- **Accessibility** — touch targets and semantics were designed for and checked in places, not
  audited.
- **e2e** — a full run finished at 392 passed / 19 failed / 1 flaky / 5 skipped. Three spec files
  assert removed screens; two have been updated, the rest is in progress.
