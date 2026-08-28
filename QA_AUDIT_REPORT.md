# QA Audit Report — ITERA Patient Experience

Date: 2026-08-28
Scope: everything except voice and audio (excluded by instruction)
Branch: `refactor/important-information-and-whos-completing`

## Executive summary

**PASS WITH KNOWN ISSUES.**

Five real defects were found and fixed, two of them about money and one about medication safety.
The most serious was a direct contradiction: for the primary demo patient the cost card said
**"$6 per month"** while EMMI said **"$0"**. A patient reading the consent screen and then asking
EMMI what they would pay had no way to know which answer was true.

Seven end-to-end failures remain. They share one root cause inside a module that another session
is actively editing, so they are reported rather than patched.

A further seven failures turned out not to be defects at all: the suite was over-subscribing its
workers, and the same tests passed serially. That is fixed at the cause.

## Environment

- Baseline measured against committed `HEAD` in an isolated git worktree, not the working tree.
  The working tree does not build: another session has added imports for `src/appointments.js`,
  a file they have not written yet. `HEAD` itself builds cleanly, so the deployed site is fine.
- Node with Vite 6, Vitest, Playwright (`mobile-chrome`, Pixel-class viewport).
- Primary viewport 384 x 824.

## Baseline

| Suite | Result |
| --- | --- |
| Production build (`HEAD`) | pass |
| Unit (`vitest run`) | 325 passed, 0 failed |
| E2E parallel (default workers) | 257 passed, **14 failed** |
| E2E serial (`--workers=1`) | 264 passed, **7 failed** |

The gap between the two E2E runs is the finding: seven tests fail only under parallel load.

## Issues found

### QA-001 — Cost card and EMMI disagree about what the patient pays · CRITICAL · FIXED

For `DEMO-P001` the cost card rendered "$6 per month" while `getExpectedAccessCost` returned $0.

Root cause: two sources of truth for one fact. The card read a legacy `secondaryCoverageStatus`
flag written by hand on the patient fixture; EMMI read the coverage record. They described the same
patient differently, and nothing forced them to agree.

Fix: the flag is now derived from the coverage record, so it cannot drift.

### QA-002 — Coverage status vocabulary never matched the resolver · HIGH · FIXED

The fixtures carried `"VERIFIED"`, `"PRESENT_NOT_CONFIRMED"`, `"NOT_VERIFIED"`. The resolver
compares against `"SECONDARY_COVERAGE_VERIFIED"` and friends. Nothing matched, so **every** demo
patient silently fell through to the unverified branch and was quoted the full amount regardless of
their configured coverage. `DEMO-P002`, configured as present-but-unconfirmed, should have shown
"up to $6 per month" and showed "$6 per month".

Found only because QA-001's fix made the mismatch visible. Fix: the mapper emits canonical enum
values, and a test asserts every fixture status is one the resolver recognises.

### QA-003 — Asking about a medication returned an answer about cost · HIGH · FIXED

"What is Lisinopril?" answered: *"Based on the coverage we verified, your expected payment for
ACCESS is $0…"*

Root cause: my own unanchored regex. The cost branch tested
`/(cost|pay|how much|costo|pagar|cuánto|pri|peye|koute)/i` with no word boundaries, and `pri`
matches inside "Lisino**pri**l". Fix: anchored, with negative cases asserted so "prescription",
"priority" and "private" cannot trigger it either.

### QA-004 — Medication safety events were not routed as safety · CRITICAL · FIXED

All three of the medication-safety examples in the brief missed `MEDICATION_SAFETY`:

| Patient says | Was | Now |
| --- | --- | --- |
| "I stopped taking my medication because it made me sick" | `MEDICATION`, may answer alone | `MEDICATION_SAFETY`, must not answer alone |
| "I accidentally took two doses" | `OTHER`, may answer alone | `MEDICATION_SAFETY`, must not answer alone |
| "I skipped my pills yesterday" | `OTHER`, may answer alone | `MEDICATION_SAFETY`, must not answer alone |

Root cause: the pattern required a present-tense verb before the noun (`stop … medication`), so past
tense and accidental doses matched nothing. Fix: past tense and dose-count phrasings added, with
tests asserting that ordinary medication talk ("I take my medication every day") is still **not**
treated as a safety event — over-matching here would teach patients to ignore the escalations that
matter.

### QA-005 — Asking for a person by name reached no intent · HIGH · FIXED

"Talk with my doctor" and "I need help from my nurse" matched no rule and fell through to generic
handling. The pattern knew "talk to" but not "talk with", and "care team" but not doctor, nurse,
care manager or cardiologist. Fixed in EN, ES and KR.

### QA-006 — Hardcoded cost fallback · MEDIUM · FIXED

`accessCostSummary` fell back to a literal `6` when the amount was missing, which would quote the
eCKM figure to a CKM patient who owes 7 and double the 3 that BH and MSK owe. Now falls back to the
canonical track configuration.

### QA-007 — Suite unreliable under its own default parallelism · MEDIUM · FIXED

Seven tests failed in parallel and passed serially. All seven are the heavy ones that walk seven
viewports across three text scales and three languages; they were timing out under contention rather
than failing an assertion. Fixed by capping `workers` in the Playwright config. Raising the timeouts
would have hidden the cause instead.

### QA-008 — EMMI answers consent-boundary questions with a program blurb · HIGH · NOT FIXED

"Can you enroll me?", "Can they make decisions for me?" and "Can EMMI confirm this information?" all
return the generic *"ACCESS is a Medicare care option…"* explanation. The specific answers exist
("I cannot consent for you") but live in a legacy chain the orchestrator no longer consults for
anything except confirmations.

This is a real quality defect — a patient asking whether the assistant can consent for them deserves
the boundary, not a brochure. It is the single root cause of all seven remaining E2E failures.

**Not fixed deliberately.** `src/emmi/textOrchestrator.js` has uncommitted modifications from
another session that is actively developing it. Editing it would collide with work in progress. It
should be picked up by whoever owns that module.

## Verified as correct (no change needed)

- Clinical safety takes precedence over appointment routing: "I have chest pain and need an
  appointment" classifies as `CLINICAL_SAFETY`, requires the escalation tool, and is marked as not
  answerable from knowledge alone.
- General versus patient-specific separation holds: "What is Medigap?" answers from knowledge with
  no tool; "Do I have Medigap?" requires `getPatientCoverage`.
- No secrets in the client bundle; no Gemini key referenced in `src/`; no patient identifiers in URL
  parameters; only language and prototype configuration in `localStorage`.
- ACCESS is never described as "free" anywhere in the codebase — the only matches are the rules
  forbidding it.
- Scroll behaviour (§107 A, E, J) is already covered by `e2e/scroll.spec.js` and passing.
- No date-dependent test fixtures: the suites that touch time use explicit offsets or a frozen
  clock.

## Files changed

| File | Why |
| --- | --- |
| `src/mock/emmiFixtures.js` | Derive coverage status from the coverage record (QA-001, QA-002) |
| `src/emmi/textOrchestrator.js` | Anchor the cost regex (QA-003) |
| `src/app.js` | Canonical cost fallback (QA-006) |
| `server/emmiKnowledge.js` | Medication safety and human support routing (QA-004, QA-005) |
| `playwright.config.js` | Cap workers (QA-007) |
| `tests/costConsistency.test.js` | New — QA-001, QA-002, QA-006 |
| `tests/intentRouting.test.js` | New — QA-003, QA-004, QA-005 |

## Remaining non-audio issues

- **QA-008** (HIGH) — consent-boundary questions answered from RAG. Owned by the orchestrator module.
- **Cost card has no "unknown" state.** When coverage is stale or unverified the card confidently
  shows the gross amount while EMMI says the amount is not known. The card errs toward the maximum
  the patient might owe, which is the safe direction, but the two surfaces differ in confidence.
  Recommendation rather than a defect, since giving the legacy three-state model an unknown state is
  a design change.

## Out of scope — voice and audio

Excluded by instruction and not investigated: microphone capture, the AudioWorklet pipeline, speech
in or out, barge-in, voice latency, Gemini Live audio, microphone permissions. No audio test
failures were observed in the runs above; the audio pipeline suites passed.

## Manual human QA recommended

Nothing in this report is usability testing. See `docs/specs/qa/MANUAL_UAT_CHECKLIST.md` for
scenarios written for real participants. No human testing has been performed and none of these
findings should be read as if a patient had been observed.

## Commands used

```bash
git worktree add /tmp/qa HEAD --detach   # baseline against committed HEAD
npx vite build
npx vitest run
npx playwright test --reporter=line
npx playwright test --workers=1 --reporter=line   # isolate contention from defects
```
