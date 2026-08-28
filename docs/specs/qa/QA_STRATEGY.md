# QA Strategy — ITERA Patient Experience

Last reviewed: 2026-08-28

## What this covers

Everything except voice and audio. Microphone capture, the AudioWorklet pipeline, speech in or
out, barge-in, voice latency and Gemini Live audio are deliberately outside this strategy and are
tracked separately.

## Who the product is for

Medicare patients, mostly over 65. That shapes what counts as a defect here. A layout that merely
looks cramped to a designer is cosmetic; a layout that hides the Continue button at 150% text is a
blocker. Wording that is technically accurate but reads as jargon is a real finding.

## The testing pyramid we actually use

**Unit tests** carry the deterministic rules: coverage normalization, financial responsibility,
clinical monitoring, intent classification, goal resolution, audio frame maths. Anything with a
right answer that does not need a browser belongs here, because it runs in seconds and cannot flake.

**Integration tests** carry contracts between modules: what a tool returns, what the knowledge
retriever selects, what a fixture resolves to.

**End-to-end tests** carry journeys a patient actually takes. They are expensive and can flake, so
they are reserved for behaviour that only exists when the whole thing runs together: scroll
restoration, focus, overlays, responsive layout, complete enrollment.

The rule of thumb: if the same assertion can be made in a unit test, it does not belong in an E2E
test as well.

## Principles

**A red test is a question, not an answer.** Every failure is classified before anything is
changed: real defect, stale test, fixture problem, date dependency, environment, intentional
product change, or flake. Approved specs outrank tests. A test that contradicts a spec gets
updated; an implementation that contradicts a spec gets fixed.

**Never loosen an assertion to get green.** No arbitrary waits, no skipped accessibility checks, no
suppressed errors. If a test is flaky, the synchronization is wrong and that is the bug.

**Every real defect gets a test that would have caught it.** The test is part of the fix, not a
follow-up.

**Determinism.** Tests that depend on the wall clock are fixed with a frozen clock, not with a
tolerance. A suite that fails on one day of the week is worse than no suite.

## Severity

- **BLOCKER** — enrollment cannot be completed, or a safety or privacy failure.
- **CRITICAL** — wrong clinical, coverage or cost behaviour; data loss.
- **HIGH** — major usability, accessibility or navigation failure.
- **MEDIUM** — noticeable defect with a workaround.
- **LOW** — cosmetic or consistency.

Fix order follows the same ranking, with safety first and cosmetics last.

## Viewports

384 x 824 is the primary reference (Samsung Galaxy S25 Ultra). Full journeys run at 384. Layout and
component checks run across 360, 375, 384, 390, 393, 412 and 430. Desktop widths (1024 to 1920) are
tested for shell containment, because the patient UI is a centred column there and fixed overlays
have escaped it before.

Text scaling is checked at 100%, 125% and 150%. Note that several controls in this codebase are
sized in px rather than rem, so root scaling does not move them; where that is true the test says
so rather than pretending to exercise something it cannot.

## Languages

EN, ES and KR. KR is Haitian Creole, never Korean. Full journeys are exercised in all three on the
major screens; low-level unit tests are not duplicated per language.

## What automation cannot tell us

None of this is usability testing. Automated checks confirm that a control exists, is reachable,
is labelled and is large enough. They cannot tell us whether a 78-year-old understands what
"expected patient payment" means or feels confident pressing Agree and continue. See
`MANUAL_UAT_CHECKLIST.md` for scenarios intended for real participants. No human testing has been
performed; nothing in this repository should be read as if it had.
