# Phase 01 — Home: Modern Care Experience

**Status:** complete
**Screen:** `INVITATION` (`invitation()` in `src/app.js`)
**Commit:** `10fcd5a` — `feat(access-patient): phase-01 modernize home experience`

---

## What changed and why

The Home used to introduce ACCESS as a *care option* and invite the patient to *see how it works*.
That is the language of a brochure. This phase re-frames the same screen as the entry to a smarter,
connected way of managing hypertension, without touching the trust card that carries the invitation
from Dr. Fresner.

Voluntariness moved. It used to sit as the third of three benefits, which read as though "you don't
have to" were something ACCESS *offers* you. It is now a note below the three benefits: still on the
screen, still before the CTA, in smaller muted type. The statement itself was strengthened, not
softened — it now says the patient will review **all** the details before they **decide**, rather
than before they enroll.

## Files changed

| File | Change |
| --- | --- |
| `src/app.js` | Home headline, ACCESS provider-referral subheadline, three benefits, new voluntariness note, CTA label, EMMI capability copy; language-preference fix in `boot()` |
| `src/styles.css` | `.invitation-voluntary` — subordinate type, muted colour, small inline mark |
| `src/nextBestAction.js` | `seeHowItWorks` → `startCareJourney`, so the resume CTA names the button that exists |
| `src/emmi/narrative.js` | Home closing narration names the new CTA in EN / ES / Kreyòl |
| `e2e/canonical-invitation.spec.js` | Three new Home tests: copy and preserved elements; i18n plus language persistence; the width × text-scale layout sweep |
| `e2e/enrollment.spec.js`, `e2e/emmi-guidance.spec.js`, `e2e/emmi-presentation.spec.js`, `e2e/growth.spec.js`, `e2e/header-responsive.spec.js` | Updated to the new heading, CTA name and EMMI capability line |

## Copy changed

All three locales were written for every string; nothing falls back to English.

| Element | Before | After |
| --- | --- | --- |
| Headline | A new care option for your health | A smarter way to manage your health |
| Subheadline (ACCESS provider referral) | Get extra support between your doctor visits. | Stay connected with your care team, keep track of your health, and get support when you need it. |
| EMMI capability line | I can guide you through each step and answer questions along the way. | I can help you understand your health information, guide you through each step, and connect you with your care team when you need help. |
| Benefit 1 | Keep your doctors / Continue seeing the doctors you know | Stay connected with your care team / Stay connected with the doctors and care team you already know. |
| Benefit 2 | Get support from home / Ongoing support between office visits | Get support from home (unchanged title) / Track your health and get ongoing support between office visits. |
| Benefit 3 | Participation is voluntary / You'll review the details before you enroll | Understand your health better / Use your health information and connected tools to see how you're doing. |
| Voluntariness | third benefit card | separate subordinate note: Participation is voluntary. You'll review all the details before you decide. |
| CTA | See how it works → | Start your care journey → |

Icons: benefit 1 `physician` → `people` (a team, not one doctor); benefit 3 `chart` (seeing how you
are doing). Benefit 2 keeps `home`.

## Behavior preserved

- Trust hero card, its image, headline lines, supporting copy and **Recommended by Dr. Fresner** — untouched.
- `DOCTOR_RECOMMENDS_ACCESS` variant resolution, `data-trust-source`, `data-hero-variant` — untouched.
- EMMI title, subtitle, Ask EMMI, Guide by voice, voice state, session, routing, safety and tools — untouched. Only the sentence describing what EMMI can do changed, plus the CTA name inside its Home narration, which would otherwise point at a button that no longer exists.
- Contact line, language toggle, `actions()` layout, no back button on Home.
- The subheadlines for ACCESS direct outreach and for non-ACCESS programs are unchanged; direct outreach keeps its Medicare ACCESS Participant statement.

## Regression found and fixed

Seeding a language and reloading the Home showed the patient's own language choice being overwritten
on every visit. `boot()` treated `offer.selectedLanguage` as an override, and since the canonical
invitation is always prepared in English, a patient who switched to Spanish or Kreyòl lost it on
refresh. The offer's language is now the *default* and the patient's stored choice outranks it. This
was introduced by the canonical-invitation change, not by this phase's copy work, and is covered by a
reload assertion in the new i18n test.

## Tests

- `npm test` — 40 files, **785 passing**, 0 failing.
- E2E, run serially over the six specs this phase touches
  (`canonical-invitation`, `enrollment`, `emmi-guidance`, `emmi-presentation`, `growth`,
  `header-responsive`): **174 passing, 5 failing**.
  All five reproduce on the pre-change baseline and are unrelated to this phase:
  `enrollment.spec.js:364` (CCM defer/resume), `:409` (shared enrollment welcome), `:2227` (Emmi
  conversation layer), `:2609` (traditional program journeys), `header-responsive.spec.js:117`
  (Getting Started stage).

**Why serially.** The full 387-test parallel run is not trustworthy on this machine right now. With
identical code the failure count moved 12 → 20 → 37 → 283 across four runs, the 283-failure run
began with `page.waitForSelector(".shell")` timing out — the app never rendered at all — and the
machine was at 2.7 GB free of 15.7 GB with the CPU at 62 %. Every sampled failure passed in
isolation, including assertions on this phase's own new copy. `playwright.config.js` already
documents this exact behaviour ("a serial run of the same suite passed seven tests that a parallel
run failed"), which is why the gate above was run with `--workers=1`. The specs this phase does not
touch were left to the previously established baseline.

New coverage:
- Home copy, the three benefits, the voluntariness note, the CTA, the preserved trust card and EMMI card.
- The voluntariness note is asserted to be **outside** `.invitation-benefits` and at a smaller computed font size than a benefit title — at every width and text scale, not once at the default.
- i18n walked through the language toggle the way a patient uses it (EN → ES → Kreyòl), asserting each locale's own words and that the English heading is absent, plus a reload that proves the choice persists.

Tests updated because they named copy this phase changed — each was checked to be an assertion about
the old wording, not a behavior that broke:
`enrollment.spec.js` (heading in three locales, the Spanish `/nueva opción de cuidado/` regex, the
provider-referral Home block, the CTA in the golden path), `emmi-guidance.spec.js` and
`emmi-presentation.spec.js` (EMMI's capability sentence, CTA), `growth.spec.js` (the Spanish CTA on
the share journey), `header-responsive.spec.js` (CTA).

## Viewport checks

Widths 360, 375, **384 (primary)**, 390, 393, 412, 430 × text scaling 100 %, 125 %, 150 % — 21
combinations, asserted per combination:
- no horizontal overflow on the document;
- no headline, lead, benefit title, benefit detail, voluntariness note or CTA that is cut off by its
  own box or pushed outside the page;
- the voluntariness note stays a smaller computed size than a benefit title;
- CTA height ≥ 44 px.

Two defects surfaced while checking 384 px at 150 %, both invisible to the first version of the
assertions:

1. **Fixed (mine).** `.invitation-voluntary` was written in `rem`, but patient typography on this
   app is pinned in `px` on purpose. At 150 % the note grew to 22.5 px while benefit titles stayed
   at 18 px — the note overtook the very headings it is meant to sit under. It now joins
   `.shell:not(:has(.prototype-console))` and uses `--font-footer`, the same family as the other
   subordinate notes, so the hierarchy holds at every text size. The responsive test now asserts the
   ordering at all 21 combinations instead of once at default scale.
2. **Fixed (the assertion itself).** The first clipping check flagged the `h1` at every scale. It was
   a false positive: on an `overflow: visible` heading, `scrollHeight` counts the glyphs' ink beyond
   the line box, which is not clipping. The check now only counts boxes that actually cut their
   content, and separately catches anything pushed outside the page.

## Accessibility

- Headline remains the focusable `h1` from `titleBlock`.
- The voluntariness note is a `<p>`; its icon is `aria-hidden` and the text is a plain span, so it is read once.
- `.invitation-benefits` keeps its `aria-label`.
- CTA is a real button reached in normal tab order; touch target asserted ≥ 44 px at every tested combination.

## Out of scope, left alone

- Non-ACCESS program subheadlines and the ACCESS direct-outreach participant statement.
- Hero card, its imagery and its physician attribution.

## Open issues

**Pre-existing — medium — trust hero card overflows at 150 % text scaling.** At 384 px with 150 %
scaling, `.trust-hero-text-overlay` runs 32 px past the bottom of `.invitation-stage`: "Care through
Medicare’s ACCESS Model" is cut on the right and "Recommended by Dr. Fresner" is cut off below.
The cause is that `.trust-hero-headline` is sized in `rem` (`clamp(1.12rem, 5.2vw, 1.34rem)`) inside
a stage with a fixed 170 px height, so the text scales while its container does not. Not touched
here: this phase is explicitly forbidden from changing the top card, and `git diff src/styles.css`
shows nothing in this change reaches the hero. Worth its own fix — the same `rem`-inside-fixed-height
pattern that this phase corrected in the voluntariness note.

Pre-existing e2e failures unrelated to this phase are listed in the regression gate results below
and were reproduced on the pre-change baseline.
