# ACCESS Patient Experience — sequential implementation, final report

**Final status: COMPLETE**

Four phases, four independent commits, no blockers. The pre-existing failure list came out of this
work **three shorter** than it went in.

---

## Phases

| Phase | Scope | Commit |
| --- | --- | --- |
| 01 | EMMI expanded / chat: modern conversation foundation | `ac4bcb0` |
| 02 | EMMI adaptive patient language | `6a0c66a` |
| 03 | Enrollment complete → care activation | `82904c7` |
| 04 | Appointment coordination orchestration | `947a995` |

Each has its own report in this directory and a small follow-up commit recording its SHA. No phase
was mixed into another's commit, and each ran its own gate before the next began.

## Test results

| Suite | Result |
| --- | --- |
| `npm test` | **797 passing**, 0 failing (41 files) |
| Full e2e, serial | **441 passing, 4 failing** — all four pre-existing |

The four remaining failures reproduce on the pre-change baseline and were confirmed there with
`git stash` before any of this work began:

| Spec | Test |
| --- | --- |
| `emmi.spec.js:82` | EMMI mobile visual states remain readable without horizontal overflow |
| `enrollment.spec.js:411` | shared enrollment welcome adapts to every program and enrollment source |
| `enrollment.spec.js:2236` | Emmi opens as a contextual conversation layer without changing enrollment state |
| `enrollment.spec.js:2618` | all traditional programs complete their implemented patient journey |

Three that had been on that list now pass: the appointment provider-name test was fixed in Phase 4
as a defect belonging to that phase, and the CCM defer/resume and Getting Started stage tests were
repaired incidentally by the care-activation work in Phase 3.

**On parallel runs.** The suite is unreliable in parallel on this machine — with identical code the
failure count moved 12 → 20 → 37 → 283 across four runs, and the 283-failure run began with the app
never rendering at all under memory pressure. `playwright.config.js` documents the same behaviour.
Every gate in this work ran with `--workers=1`.

## What each phase changed

**Phase 1 — the conversation surface.** Expanded EMMI was a landing page that stayed on screen while
the patient talked, pushing the composer off the bottom. It became one conversation in two modes:
discovery before anything is said, and from the first question a thread with the composer docked to
the bottom. The panel stopped being one long scroll and became a three-row grid, which is the whole
reason the composer can stay put. Suggestions became contextual across the entire ACCESS journey,
capped at four, with the physician question built from the runtime referral and dropped entirely
where there is none. Follow-ups after an answer are chosen from the intent EMMI answered with.

**Phase 2 — the patient's language.** EMMI now notices when a patient writes in a language it is not
speaking, asks once in that language, and follows them. The detector is deliberately unwilling to
guess: three-word minimum, no credit for words two of the three languages share, a two-point margin,
and orthography counting double. Carrying on in a language is treated as a clearer answer than any
confirmation; a decline is remembered. Text and voice share one `activeLocale`, and nothing restarts.

**Phase 3 — care activation.** The enrollment-complete screen told the patient to wait for a call.
It now starts care activation: monitor, goals, care plan, in the order the patient will do them,
with `Set up my care` as the primary action. The route did not move — only what it is called.

**Phase 4 — appointment coordination.** The audit the plan asks for found this already built and
documented, with 235 unit tests and five e2e specs behind it. This phase verified it against the
specification's acceptance criteria and fixed the one thing that did not hold.

## Defects found and fixed along the way

Six, none of them in the phase scopes as written — all found by building or testing them:

1. **The support row stretched its own icons** to 101 px each, because `icon()` renders a `<span>`
   and the rule said `> span` (Phase 1).
2. **Two controls shared one accessible name** — the composer microphone and the Talk to EMMI
   button were both "Talk to EMMI" (Phase 1).
3. **Switching language closed EMMI mid-turn**, because the first version refreshed the screen with
   `render()`, which rebuilds `#app` and therefore destroys the panel (Phase 2).
4. **EMMI reported a completed enrollment as incomplete** — the enrollment-context answer keyed only
   off eligibility, so a patient who had finished enrolling would still have been told they had not
   (Phase 1, surfaced by Phase 3's questions).
5. **Two questions reached knowledge retrieval instead of the runtime** — "am I enrolled" and "why
   does it say $0" (Phases 1 and 3).
6. **A provider-name test encoded stale behaviour** as a failure; the actual behaviour — a resolved
   care team record outranking a seeded label — was correct, and is now asserted across both
   branches (Phase 4).

## Architecture

**Reused, not replaced:** the `titleBlock` / `rows` / `check` / `actions` vocabulary, the existing
overlay open/close with scroll and focus preservation, `setLanguage` and its voice-session rebuild,
the `EmmiConversationManager` session model, the barrier engine, the financial resolver, the
clinical safety engine, the care team directory and the whole appointment orchestration.

**New:** one module (`src/emmi/languageDetection.js`), one CSS component (the composer dock and its
neighbours), `getEmmiFollowUps`, and a titled shape for enrollment next steps that other programs
are free to ignore.

**Untouched, per the plan's own constraint:** Gemini model, voice provider, audio codec,
AudioWorklet, clinical engine, financial resolver, eligibility engine, enrollment backend and safety
thresholds.

## Cross-phase gate

| Check | Result |
| --- | --- |
| EMMI continuity — no re-greeting, one session across close/reopen, screen change and language switch | Asserted in `emmi-conversation.spec.js` |
| Enrollment → care activation — no call dependency, no appointment step | Asserted in `access-journey.spec.js` |
| Appointment request from EMMI — routes as an operational intent, not to retrieval | Verified against the orchestrator and covered by the appointment suites |
| Safety override | Unchanged and still first in the routing chain |
| Language continuity — EN / ES / KR, KR never Korean | 12 unit tests plus 5 e2e |
| Mobile and accessibility — 360–430 px × 100/125/150 %, 44 px targets, dialog semantics, focus return | Swept in `emmi-conversation.spec.js` and `access-journey.spec.js` |

## Issues

**Blockers:** none.

**Pre-existing:** the four failures listed above, plus the trust hero card clipping its own text at
150 % text scaling — a `rem`-inside-fixed-height defect outside every phase scope here, already
being worked separately.

**Deliberate, awaiting a product call:** two copy decisions carried from the earlier journey work —
the Home lead not naming Dr. Fresner, and the consent cost row keeping its regulated
"Expected beneficiary payment amount" phrasing. Both are recorded in their own phase reports.
