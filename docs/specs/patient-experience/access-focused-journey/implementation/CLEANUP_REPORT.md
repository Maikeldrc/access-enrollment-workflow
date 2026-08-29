# Closing out what the phases left behind

**Status: complete.** Everything the phase reports carried forward as open is now closed — the four
pre-existing e2e failures, the trust hero clipping, and the two copy decisions.

---

## The four pre-existing failures

All four had been reproduced on the pre-change baseline with `git stash` before any of the phase
work began, so none of them belonged to a phase. Closing them out found two real defects hiding
behind stale test expectations.

### `enrollment.spec.js:411` — shared enrollment welcome adapts to every program and source

The test looked for physician copy that Phase 3 had rewritten, so the assertion was updated. But it
was also failing on the CTA, and that half was a **genuine defect**: `nextBestAction.js` applied a
screen-level override for `ENROLLMENT_CONFIRMED` that flattened every program's call to action into
one label. A screen-level rule was overriding program-level intent for all programs at once.
`PROGRAM_RESOLVED_SCREENS` now limits the override to the screen that actually resolves the program.

### `enrollment.spec.js:2618` — all traditional programs complete their implemented patient journey

Fixed by the CTA repair above. It was the same defect seen from a different angle.

### `enrollment.spec.js:2236` — Emmi opens as a contextual conversation layer

Three separate pieces of stale expectation, and one that asserted the opposite of a designed
behaviour:

- Hero copy, quick questions and the human-support row were Phase 1 rewrites; assertions updated.
- The test asked for a callback **while a safety episode was open** and expected a scheduling
  confirmation. Safety correctly outranks everything the patient asks next, so the answer was the
  safety follow-up. The block now does both: a callback before anything urgent is answered
  normally, and the same request after "I have chest pain and cannot breathe" is answered by the
  safety episode. What the test used to call a failure is the guarantee we most want asserted.
- The last block re-opened EMMI on the consent screen and expected that screen's discovery
  suggestions. Reopening continues the same conversation — that is Phase 1's two-mode design — so
  the thread is what is on screen, not the suggestions. It now asserts the continuity, and
  per-screen suggestions stay asserted in `emmi-conversation.spec.js`, where the panel opens fresh.

### `emmi.spec.js:82` — EMMI mobile visual states remain readable without horizontal overflow

The test expected "EMMI is thinking…" and "EMMI is explaining…" from the voice panel. The shipped
vocabulary is "Thinking…" and "Speaking…", from `src/emmi/presentationState.js`, which is the single
label vocabulary for every EMMI surface and is asserted in two other suites. The test was the stale
side and was aligned.

Underneath it was a **real defect**. On `TOOL_RUNNING` the runtime computes a patient-facing status
— "Checking your ACCESS cost…" — stores it in `assistantVoiceDetail`, and `assistantVoiceEntry`
then ignored it and printed the generic coaching line. The patient read "Speak naturally. You can
interrupt EMMI." while EMMI was busy looking their cost up. The panel now shows the status it
already had.

## The trust hero

Full write-up in `../IMPLEMENTATION_REPORT.md`. In short: the composed text is now a grid sibling
of the artwork instead of a child of it, so the artwork keeps its own fixed box — and every
percentage the physician photo and badge clip-path depend on — while the card grows to whichever is
taller. At 100 % nothing moves. Across 360–430 px × 100/125/150 %, on both hero variants, nothing
spills and nothing clips.

## The two copy decisions

Both settled as **keep**, and both are recorded with their reasoning in
`../IMPLEMENTATION_REPORT.md`. The Home lead one was only ever open because the hero was cutting
Dr. Fresner's name off above 100 % text; with the hero fixed, the approved split — benefit in the
lead, attribution in the hero — holds at every supported size. The consent cost row keeps regulated
phrasing, and changing regulated wording is a compliance call rather than a copy edit.

## Gate

| Suite | Result |
| --- | --- |
| `npm test` | **797 passing**, 0 failing (41 files) |
| Full e2e, `--workers=1` | **446 passing, 0 failing** (20.3 min) |

The pre-existing failure list is now **empty** — the first fully green run of this suite in this
line of work.

Evidence: `qa-evidence/hero/access-384-{100,150}.png` and `ccm-384-{100,150}.png` — the same card at
384 px with text at 100 % and 150 %, showing the composition unchanged at 100 % and the attribution
intact at 150 %.
