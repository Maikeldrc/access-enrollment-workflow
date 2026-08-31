Follows #8. What began as EMMI's copy for the new care activation screens turned into two QA reports answered end to end, six product defects, and the first green suite this branch has had.

## Verification

- `npx vitest run` — **1018 passing**, 48 files, none failing.
- `npx playwright test` — **491 passing, 0 failing**, 5 skipped.

This branch started at 396 passing and 49 failing. `enrollment.spec.js` is 100/100.

## Two QA reports, validated item by item

Both are answered in `docs/specs/qa/`, with what still stood, what was already correct and only unreachable, and what I could not validate.

The production chat validation's release blocker was **an emergency episode that nothing could end**. `resolveSafetyEpisode` existed on the conversation manager and was never called, and the sentences a patient uses to say help arrived contain the words that *raise* an emergency — so every attempt to close the episode re-armed it. Episodes now resolve, expire after four hours, and survive a reload only while genuinely open.

The voice re-test's deterministic half is fixed. The transport is handed over in `VOICE_HANDOFF.md` with one concrete lead and the reason I did not act on it.

## Product defects found along the way

Several are mine, from #8:

- A patient who already owned a monitor **lost their goals, barriers, clinical check, medications and preferences** unless verification succeeded — straight from the device screen to "your care is ready".
- **Nothing started the assigned-device lookup** from the ordinary route in, so a patient with a connected monitor was told there wasn't one.
- Back from any post-enrollment screen, and the header logo, both **returned the public invitation**; its call to action then asked an enrolled patient who was completing their enrollment.
- `prefers-reduced-motion` **silenced nothing** — the stylesheet had an empty media block where the rule belonged.
- The **Spanish and Creole medication screens handed out directions in English**.
- EMMI **went silent** on two screens of the flow that had no narrative objective at all.
- The brand logo sat at **2.58:1 contrast on every screen in the product**, where AA asks for 4.5.

## EMMI answers in the language it was asked in

Each of the 48 knowledge pages carries its own answer per language, rather than translating the corpus wholesale. Four ranking faults that only a non-English question could expose are fixed: the programme name was scored as if the patient had said it, context boosts manufactured relevance instead of breaking ties, keywords applied per chunk instead of per document, and repeated words counted repeatedly.

## Audits kept as specs, not as numbers in a report

- `e2e/preconsent-integrity.spec.js` — Home through Consent at two widths and two text sizes.
- `e2e/accessibility.spec.js` — axe across fifteen screens.
- `e2e/golden-journey.spec.js` — the whole journey walked with nothing seeded.

## What this clears, and what it does not

**Demonstrable prototype: yes.** **Certified for patient use: no, and not claimed.** Two things stand between them and neither can be closed from here: a screen reader pass (scripted and ready in `SCREEN_READER_SCRIPT.md`) and voice.

Decisions — mine, Maikel's, and the alternatives rejected — are in `docs/specs/qa/DECISIONS_LOG.md`.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
