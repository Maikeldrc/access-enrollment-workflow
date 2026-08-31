# Response to the 2026-08-30 EMMI production QA validation

Each finding in `EMMI_PRODUCTION_QA_VALIDATION_2026-08-30.md`, checked against the code and fixed
where it still stood.

| ID | QA result | Now |
|---|---|---|
| PROD-QA-001 | FAIL — release-blocking | **Fixed.** An episode can be resolved, and expires on its own. Verified in the browser. |
| PROD-QA-002 | BLOCKED — not certified | **Fixed.** Two causes: three questions had no page, and the no-model fallback discarded whatever was retrieved. |
| PROD-QA-003 | BLOCKED — not certified | **Was already correct**, and could not be seen past the safety episode. Now verified. |
| PROD-QA-004 | PARTIAL — chat blocked | **Verified.** Chat says $0 with the same coverage basis as the consent screen. |
| PROD-QA-005 | NEW FINDING — FAIL | **Fixed the day before this report**, by a different route than the one QA found. |

## PROD-QA-001 — the emergency episode could not end

Two causes, and the second explains why the QA transcript could never get out of it.

`resolveSafetyEpisode` already existed on the conversation manager, with a resolution field and an
audit event, and **nothing anywhere called it**. There was no route out of ACTIVE.

And the sentences a patient uses to say help arrived contain the words that raise an emergency.
"I called 911 and emergency help is on the way" holds *emergency*; "the emergency team is with me
now" holds it twice. Both reached the emergency gate, which read each attempt to close the episode
as a new emergency and re-armed it. Every resolution attempt in the QA transcript was making the
problem worse.

Resolution is now read before that gate, and there are two kinds, kept apart in the record:

- **HUMAN_HELP_CONFIRMED** — 911 called, paramedics present, the patient at hospital or with a
  clinician. Acknowledges, tells them to stay with the people caring for them, and hands back a
  working assistant.
- **PATIENT_REPORTED_RECOVERED** — the patient says the symptoms have passed. This also ends the
  episode, because an app that will answer nothing else ever is not the safer option, but the
  acknowledgement keeps the instruction to call 911 if the symptoms return.

Both offer the care team rather than closing silently. An episode also **expires after four hours**,
so a patient returning the next day is not met with an emergency that is over. What ends is the
response mode; the episode record and its audit trail stay either way.

Held in place: a new symptom during an open episode still escalates, and an unresolved episode still
survives a reload. Both are asserted, in unit tests and in the browser.

## PROD-QA-002 — focused questions got the generic answer

Two independent causes, and the report could only see the symptom.

**Three of the five questions had no page to land on.** eCKM and A1c existed only in the master
knowledge file, which retrieval demotes to a fallback on purpose so it cannot drown out the topic
pages — so they never travelled. The ACCESS outcome targets existed only in application code and
nowhere in the corpus at all. Three pages now hold them: the four CMS tracks, what ACCESS measures,
and why A1c is asked of people who are not diabetic.

**The fallback discarded whatever was retrieved.** When the model cannot be reached, the answer came
from a canned programme description chosen by scanning the retrieved *file paths* for a programme
name — and every ACCESS page has "access" in its path. So any question that retrieved one returned
the general ACCESS paragraph. The top passage now answers the question when it is a page written for
it, while "what is ACCESS?" still gets the canned description, because there the general page is
what matched.

Two things surfaced only because I tried to prove the fix:

- **The corpus is English and the patients ask in three languages.** Scoring is token overlap, so a
  Spanish or Creole question matches almost nothing in any page, every ACCESS page collects the same
  category and programme boost, and the ranking comes down to the tie-break. The comparison-group
  answer fixed the day before won that tie-break; two new pages were enough to lose it again. Pages
  now declare the words a patient would use to ask for them, in each language.
- **The pages were written for the model, and the patient now reads them.** The first draft of the
  fallback would have told a patient asking about eCKM to "never quote a monthly amount from this
  page". Guidance moved into the response rule, which is cut off before the patient sees it.

## PROD-QA-003 — "Am I enrolled now?"

Already correct, and invisible behind the safety episode. Asked before enrolling, EMMI answers:

> Your current ACCESS eligibility result shows that you can continue. You are not enrolled until you
> review the information and agree.

That is the runtime's own answer, and it is exactly the distinction the report asked for.

## PROD-QA-004 — cost consistency

Verified. Asked what they will pay, EMMI answers:

> Based on the coverage we verified, your expected payment for ACCESS is $0. Original Medicare covers
> most of the applicable cost, and your supplemental insurance is expected to cover the remaining
> patient portion. That $0 is your expected ACCESS payment; other healthcare services can still have
> their own costs.

Same amount, same coverage basis and the same caveat as the consent screen. The amount comes from
the financial responsibility engine on every question; no page in the corpus carries a quotable
figure, which is asserted.

## PROD-QA-005 — an enrolled patient could restart enrollment

Fixed on 2026-08-29, before this report was read, as part of the voice re-test response. The route
QA found — the home screen offering "Start your care journey" — was one of three:

- Back from any post-enrollment screen returned the public invitation, because walking the
  enrollment journey backwards from a screen that is not on it clamped to the journey's first entry.
- The header logo is the home button, and home meant the invitation for everybody.
- The invitation's own call to action then walked an enrolled patient into "Who is completing this?".

All three are fixed and covered by `e2e/post-enrollment-navigation.spec.js`.

## The clean-session retest this report asks for

All six steps are now covered by automated tests that run on every change:

1. Safety escalation → confirmed resolution → unrelated question — `e2e/safety-episode.spec.js`.
2. Reload → unrelated question — same spec, both directions (resolved does not return, unresolved does).
3. Focused knowledge questions and paraphrases — `tests/emmiKnowledge.test.js`, in three languages.
4. "Am I enrolled?" before and after completion, as a pair — `e2e/post-enrollment-navigation.spec.js`.
5. Consent cost versus EMMI cost — `tests/costConsistency.test.js` plus the corpus assertion.
6. Enrolled-patient home navigation — `e2e/post-enrollment-navigation.spec.js`.

## Suite

Unit: 940 passing across 47 files, none failing.

End to end: 416 passing, 37 failing, against 409 and 38 before this work and 396 and 49 before the
voice re-test response. Thirty-three of the remaining failures are the enrollment spec still
pointing at the health-check screens that care activation replaced; the rest are the Care Circle
supporter landing page, which has never been built, and two that pass on their own and fail only
under parallel load — the text-scaling class of test that depends on when the web font settles.

## What I did not touch

The voice path. This report is text-chat only, so nothing here depended on it, but the separate
voice re-test of the same date remains uncertified and its blocker — that speaking produces no
patient transcript — is unaddressed and needs a real microphone.
