# Phase 01 — EMMI Expanded / Chat: modern conversation foundation

**Status:** complete
**Surface:** `assistantLayer()` in `src/app.js`, `src/emmi/quickQuestions.js`, expanded-panel styles
**Commit:** _recorded in the follow-up docs commit_

---

## What changed and why

Expanded EMMI opened as a page of things to read: a hero, a voice button, a composer, a fixed list
of quick questions, a browse toggle, a two-card human-support block, a disclaimer, and a full-width
**Close EMMI** button. All of it stayed on screen while the patient talked, so the conversation —
the actual point — appeared underneath a landing page and pushed the composer off the bottom.

It is now one conversation in two modes.

**Discovery**, before anything has been said: hero, *Talk to EMMI*, the composer, three or four
contextual suggestions under *You might want to ask*, browse and human support as quiet secondary
rows, and a compact safety note.

**Conversation**, from the first question onward: the thread takes the panel, the landing content
is gone, and the composer is docked to the bottom on its own row where the patient's thumb already
is. Reading an answer and asking the next question happen in the same place.

## Files changed

| File | Change |
| --- | --- |
| `src/app.js` | Two render modes; composer extracted with a microphone; human support as an accordion; the big Close button removed; the discovery subheadline; follow-up suggestions; thread-aware scroll restoration |
| `src/styles.css` | The panel became a three-row grid (header / scrollable body / composer dock); styles for the dock, follow-up chips, support toggle and composer mic; the removed button's rule deleted |
| `src/emmi/quickQuestions.js` | 22 new catalogue entries, per-screen sets for the whole ACCESS journey, a runtime-built physician question, a four-suggestion ceiling, and `getEmmiFollowUps` |
| `e2e/emmi-conversation.spec.js` | New spec, 15 tests |
| `e2e/emmi.spec.js`, `e2e/emmi-guidance.spec.js`, `e2e/emmi-presentation.spec.js`, `e2e/enrollment.spec.js` | Updated to the new shape |

## Layout

The panel was a single scrolling column, which is why the composer could not stay put. It is now
`grid-template-rows: auto minmax(0,1fr) auto` — the header, a scrollable body, and the composer dock
— so only the thread scrolls. Measured at 384 × 760 in conversation mode: body ends at 673 px, dock
occupies 673–760 px, inside the viewport, below the thread, with the body scrolling independently.

The existing `visualViewport` watch already sizes the panel to the keyboard, and with this row layout
that keeps the dock and the last message visible instead of merely resizing a scroll container.

## Contextual suggestions

The model was already per-screen; what was missing was the ACCESS journey itself, and the list had
drifted to generic entries (*Talk with someone*, *Invite someone I trust*, *Share ACCESS*). Each
screen now offers what a patient on that screen actually asks:

| Screen | Suggestions |
| --- | --- |
| Home | What is ACCESS? · How can this help me? · Will Dr. Fresner still be involved? · Do I have to enroll? |
| Confirm identity | Why do you need this information? · Is my information secure? · Who invited me? |
| What your care includes | How will the blood pressure monitor help me? · What is my care plan? · Will Dr. Fresner still be involved? · What does ACCESS care include? |
| Eligibility review | Why does Medicare need to verify me? · Will this change my Medicare? · What is the comparison group? |
| Eligibility success | What happens next? · Am I enrolled yet? · What will I review next? |
| Consent | Do I have to enroll? · Will this change my Medicare? · Why is my expected payment $0? · Can I change my mind later? |
| Enrollment complete | What happens next? · How do I get my blood pressure monitor? · What will my care plan include? · What goals will I work on? |
| My Care | How is my blood pressure doing? · What should I do next? · I need an appointment · How can I contact my care team? |

Four is a hard ceiling. The physician question is built from `context.physicianDisplayName` and
**drops out entirely** on a direct-outreach invitation rather than falling back to a generic
stand-in — asserted in both directions.

The label changed from *Quick questions* to *You might want to ask*: suggestions, not a menu.

## Follow-ups after an answer

One to three chips after a reply, chosen from the **intent EMMI actually answered with** rather than
from the screen, and never repeating a suggestion the patient already used. A program explanation is
followed by how it helps and what the care plan is; a cost answer by other costs and coverage. The
test asserts that two different answers produce two different sets.

## Human support

Collapsed to one row — *Need human help?* — that opens to the call link and the callback request.
The callback still asks before it sends: one tap opens EMMI's confirmation question, and the audit
log shows `callbackRequested: false` until the patient answers. `revealAssistantHumanSupport()` now
opens the accordion before scrolling to it, so the *Talk with my care team* route still lands on the
options rather than on a collapsed row.

## Scroll behaviour

Re-rendering used to scroll the last message into view unconditionally. It now measures whether the
patient was at the live end of the thread before the re-render: if they were, it stays there; if
they had scrolled up to re-read something, their position is preserved. Asserted both ways.

## Already correct, verified rather than changed

- **Voice states are patient-facing.** `resolveEmmiVisibleState` already maps `CONNECTING`,
  `RECONNECTING` and the rest onto *Listening… / Thinking… / Speaking…*. No technical state reaches
  the patient.
- **Operational intents already route as actions.** Checked directly against the orchestrator:
  *"I want to talk to my care team."* → `CARE_TEAM_CONTACT` (`getCareTeam`), *"I need an
  appointment"* → `APPOINTMENT_NEED` (`getUpcomingAppointments`, `startAppointmentRequest`). Neither
  reaches generic retrieval.
- **Opening and closing already preserve everything.** The panel is an overlay over the current
  screen, with `captureOverlayPosition`, a history entry for Back, focus into the dialog and back to
  the trigger on close. Asserted: same screen, same typed value, same scroll position, same thread,
  no repeated greeting.

## Defect found and fixed

`.assistant-support-toggle > span { flex:1 }` stretched **all three** children, because `icon()`
renders a `<span>` — so the two icons each took 101 px of a 348 px row and the label was squeezed
between them. Scoped to `>span:not(.icon)`.

Also caught: the composer microphone and the *Talk to EMMI* button shared the accessible name "Talk
to EMMI", giving two controls one name. The microphone is now *Ask by voice*.

## Tests

- `npm test` — **785 passing**, 0 failing.
- `e2e/emmi-conversation.spec.js` — **15 passing**.
- `e2e/emmi.spec.js`, `e2e/emmi-guidance.spec.js`, `e2e/emmi-presentation.spec.js` — 41 passing,
  1 pre-existing failure (`emmi.spec.js` mobile visual states, which asserts the text busy indicator
  under a voice preview state and fails on the baseline too).

New coverage: discovery shape and its hierarchy; the header X preserving screen, form value and
scroll; per-screen suggestions across the whole journey including My Care; the physician question
appearing and disappearing with the invitation; the discovery→conversation switch; composer geometry
at 384 px; scroll preservation while re-reading; follow-ups differing by answer; conversation
surviving close and reopen without a second greeting; the callback confirmation gate; care-team
routing; both modes swept across all 21 width × text-scale combinations with a 44 px target floor;
Spanish; and dialog semantics with focus handed over and returned.

## Untouched, per the phase's own constraint

Gemini model, voice provider, audio pipeline, clinical engine, financial resolver, eligibility
engine, enrollment backend and safety thresholds.

## Open issues

None from this phase.
