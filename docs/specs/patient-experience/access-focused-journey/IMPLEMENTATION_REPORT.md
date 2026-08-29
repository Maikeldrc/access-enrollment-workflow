# ACCESS Patient Experience — Implementation Report

**Final status: COMPLETE WITH KNOWN ISSUES**

All seven phases were implemented, tested and committed independently. The known issues are two
deliberate copy decisions, one pre-existing layout defect, and a set of pre-existing test failures
that reproduce without any of this work.

---

## Phases completed

| Phase | Screen | Commit |
| --- | --- | --- |
| 01 | Home | `5a71740` — modernize home experience |
| 02 | Who is completing this? | `0b42e35` — refine enrollment actor selection |
| 03 | Confirm identity | `053b171` — refine identity verification |
| 04 | What your care includes | `44d0184` — modernize care overview |
| 05 | Medicare / ACCESS eligibility review | `9f7cbc4` — refine eligibility review |
| 06 | Eligibility success | `14be552` — positive eligibility milestone |
| 07 | Consent: review and choose | `0691d63` — refine informed consent |

Each has its own `phase-NN-*.md` report in this directory, plus a small follow-up commit recording
its SHA. No phase was mixed into another's commit.

## Final QA matrix

| Phase | Screen | Impl | Unit | E2E | 384px | 150% | EN | ES | KR | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Home | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 2 | Who is completing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 3 | Confirm identity | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 4 | What your care includes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 5 | Eligibility review | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 6 | Eligibility success | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |
| 7 | Consent | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | PASS |

Every screen's layout is asserted at **all 21 combinations** of widths 360 / 375 / **384** / 390 /
393 / 412 / 430 and text scaling 100 % / 125 % / 150 % — not sampled.

## Test results

| Suite | Result |
| --- | --- |
| `npm test` (unit) | **785 passing**, 0 failing, 40 files |
| `e2e/access-journey.spec.js` | **33 passing** — the whole journey, phase by phase, plus the golden path |
| `e2e/canonical-invitation.spec.js` | **10 passing** |
| Full e2e suite, serial | **410 passing, 9 failing** (7 pre-existing; the 2 others were fixed after that run and now pass) |

### On parallel runs

The full suite is unreliable in parallel on a loaded machine. With identical code the failure count
moved 12 → 20 → 37 → 283 across four runs; the 283-failure run began with `page.waitForSelector(".shell")`
timing out — the app never rendered — with 2.7 GB free of 15.7 GB and the CPU at 62 %. Every sampled
failure passed in isolation, including assertions on new copy. `playwright.config.js` already
documents this ("a serial run of the same suite passed seven tests that a parallel run failed"), so
every gate in this work was run with `--workers=1`.

## Files changed

**Source**

| File | What this work touched |
| --- | --- |
| `src/app.js` | Copy and structure for all seven screens; the condition- and physician-driven care cards; EMMI context fields (`program`, `accessTrack`, `referralOrigin`, `canContinue`, `enrollmentComplete`); identity prefill read from the invitation; language-preference fix |
| `src/styles.css` | `.invitation-voluntary`; `.optional-support-*` pinned into the patient typography system |
| `src/config.js` | `patient.identityMatch` — the invitation's verification material |
| `src/services.js` | `verifyIdentity` matches DOB **and** ZIP against the invitation |
| `src/nextBestAction.js` | Home CTA label renamed with the button |
| `src/emmi/textOrchestrator.js` | Five intent-routing fixes (below); enrollment status honoured in the enrollment-context answer |
| `src/emmi/systemPrompt.js`, `src/emmi/config.js` | Eligibility-is-not-enrollment rule; prompt version → `v3` |

**Tests**

`e2e/access-journey.spec.js` is new (33 tests). `e2e/canonical-invitation.spec.js`,
`e2e/enrollment.spec.js`, `e2e/emmi-guidance.spec.js`, `e2e/emmi-presentation.spec.js`,
`e2e/growth.spec.js` and `e2e/header-responsive.spec.js` were updated to the new copy.

**No new components were added.** Every screen reuses the existing `titleBlock` / `rows` /
`choice` / `check` / `actions` vocabulary. One new CSS class (`.invitation-voluntary`) and one
shared helper (`invitationIdentity()`) were introduced; `applyScenarioDeviceContext()` was extracted
from an inline block so two entry points share one implementation.

## Behavioral changes

- The Home CTA, and everything that names it, is now **Start your care journey**.
- Identity verification **matches** the date of birth instead of only validating its format. A
  well-formed date belonging to someone else no longer verifies.
- The patient's chosen language survives a reload; the invitation's language is a default, not an
  override.
- EMMI answers five questions it previously sent to knowledge retrieval: who invited me, why do you
  need this, will Dr. X still be involved, am I enrolled, and why does it say $0.
- EMMI reports a completed enrollment correctly — the enrollment-context answer previously keyed
  only off eligibility.

## Behavior preserved

Enrollment steps, routes and gates; signer authority and the representative branch; the audit trail;
the eligibility request and its outcomes; every required disclosure; EMMI's session, safety,
guardrails, tools and voice behaviour; the trust hero card and its physician attribution; the
non-ACCESS programs, which were left on their own copy throughout.

## Issues

### Medium — pre-existing

**The trust hero card clips its own text.** In Spanish at 100 % it cuts "Cuidado mediante el
mode[lo]"; at 384 px / 150 % the overlay runs 32 px past the card and "Recommended by Dr. Fresner"
disappears entirely — the attribution the whole invitation rests on. Cause: `.trust-hero-headline`
is sized in `rem` inside a fixed-height stage. Not caused by this work (`git diff` never reaches the
hero) and Phase 1 forbids changing that card. Same `rem`-outside-the-system pattern this work fixed
twice elsewhere. **A separate task for it is already running.**

### Low — deliberate copy decisions, awaiting a call

1. **The Home lead does not name Dr. Fresner** (Phase 1). The approved provider-referral Home puts
   the attribution in the hero and a regression test explicitly forbids "care team invited you" in
   the lead. The phase allowed keeping approved copy, so it was kept.
2. **The consent cost row was not rewritten** (Phase 7). What is there leads with "Expected
   beneficiary payment amount", which is regulated phrasing, and already satisfies every rule the
   phase states. The shorter requested sentence would have dropped that phrase.

### Low — prototype affordance with a production requirement

**The identity form is prefilled** with the demo patient's date of birth and ZIP (Phase 3). The data
is fictional and the prefill is what makes the journey walkable, but a real deployment must ship
those fields empty. Documented in the code beside the values.

### Pre-existing test failures

Seven, all reproduced on the pre-change baseline with `git stash`:

| Spec | Test |
| --- | --- |
| `appointments-scheduling.spec.js:573` | §35 confirming the provider does not erase who the appointment is with |
| `emmi.spec.js:80` | EMMI mobile visual states remain readable without horizontal overflow |
| `enrollment.spec.js:364` | CCM can defer Getting Started and resume from My Care |
| `enrollment.spec.js:409` | shared enrollment welcome adapts to every program and source |
| `enrollment.spec.js:2227` | Emmi opens as a contextual conversation layer |
| `enrollment.spec.js:2609` | all traditional programs complete their implemented journey |
| `header-responsive.spec.js:117` | stage changes only when Getting Started actually begins |

### Blockers

None.

## The journey, end to end

Asserted as one test — *"Dr. Fresner's invitation carries the patient from the link to their own
decision"*:

```
LINK
  → the doctor who sent it is the first thing on screen, and taking part is voluntary
  → the patient chooses how to complete this; support stays a separate offer
  → identity is matched to the invitation, not registered
  → what ACCESS is: the care team, the monitor, the plan, the doctor who stays
  → the disclosures, acknowledged before anything is checked
  → a milestone that is positive and honest about what has not happened
  → the patient's own decision, made by them
```

No program selection, no condition selection, no scenario configuration — and the referral context
the journey starts in is the context it ends in.
