# Validation of the 2026-08-30 EMMI voice re-test

Each issue in `LIVE_EMMI_VOICE_QA_RETEST_2026-08-30.md`, checked against the code rather than
against the report, and fixed where it still stood.

**What this document is not.** It is not a voice certification. The re-test's headline finding is
that speaking produces no patient transcript, and everything it lists as blocked depends on that.
Reproducing it needs a real microphone and audible speech, which this session cannot drive. I did
not touch the audio path, and nothing here is evidence about it.

## Result

| | Count |
|---|---:|
| Still stood, fixed, covered by a test | 6 |
| Still stood, fixed in part — one half declined on purpose | 1 |
| Not validated: needs live audio | 8 |
| Not validated: needs a live model or a state this session cannot reach | 6 |
| Found while validating, not in the report | 3 |

## The ones that still stood

### EMMI-LIVE-011 — the comparison group

**Confirmed.** The report is right that EMMI said the information was not in its sources. It was
telling the truth: the fact existed only in `core/emmi-master-knowledge.md`, which retrieval demotes
to a fallback on purpose so it cannot drown out the topic pages. Four specific pages scored above
zero, filled all four slots, and the master chunk carrying the answer never travelled.

Fixed by writing `programs/access-evaluation.md`, worded from the pre-eligibility notice the patient
is actually shown: selection is random, selection means no ACCESS for 12 months, and Medicare
benefits are unchanged. All three are in the first block of the page, because only one chunk per
document is selected and a fact in a later section is a fact that may not arrive.

Verified for three phrasings across English and Spanish, asserting the retrieved **text**, not which
file was chosen.

### EMMI-LIVE-014 — the consent terms

**Confirmed in part, and split.**

The withdrawal timing was genuinely missing: "90 days" appeared exactly once anywhere in the
knowledge corpus, in the master file. EMMI had nothing to ground on, so it produced "cuando quiera".
Fixed by `enrollment/leaving-access.md`, which leads with the sentence from the consent screen and
says in as many words never to tell a patient they may leave whenever they want. Verified in four
phrasings across three languages.

The amount is a deliberate refusal. The report's exit criterion asks the consent answer to contain
"up to $6" exactly. It will not. The amount depends on the patient's verified coverage, and a
remembered figure is precisely how EMMI once told a patient $0 while their screen said $6 — the
defect the current design exists to prevent. A test now asserts that no page outside the master file
carries a quotable amount. **This one is reversible in a single edit if you want the figure stated.**

### EMMI-LIVE-004 — the role guidance

**Confirmed, and the cause was not what it looked like.** "Mi hija me está ayudando" matches the
Care Circle guardrail, whose job is inviting a supporter — a different feature on a different screen.
So a patient standing on "Who is completing this?" asking which of three visible buttons to press got
an answer about invitations, and never heard the names of the options in front of them.

Fixed with a guardrail scoped to that screen and placed ahead of the Care Circle rule, quoting the
labels from the screen itself: **Helping the patient / Ayudando al paciente / Ede pasyan an**, with
the distinction from Personal representative, which carries legal authority. The Care Circle answer
is unchanged everywhere else, which is asserted.

### EMMI-LIVE-003 — reopening lands on the oldest turn

**Confirmed.** Reopening inserts the panel fresh, and a freshly inserted scroll container starts at
`scrollTop = 0` — in a conversation, the oldest thing in it. The re-render path already preserved
position carefully; the open path never set one.

Fixed by scrolling the thread to its end on open, twice: once immediately and once on the next
frame, because a height measured before the web font settles is not the final height.

### RETEST-NEW-001 — Back from medications reaches the public invitation

**Confirmed, with a root cause wider than the report's.** `previousScreen` clamped its index at zero,
so walking backwards from any screen not on the enrollment journey returned the journey's first
entry — the public invitation. Every screen a patient reaches after enrolling is off that journey,
so this was not specific to medications.

It now returns nothing when there is no previous screen, and the caller routes by where the patient
actually is. Post-enrollment screens name their own parent, and the refill status is treated as a
view inside the medication list rather than a screen of its own.

### RETEST-NEW-002 — an enrolled patient restarts enrollment from Home

**Confirmed, and the entry path was a third defect.** Reloading already resumed correctly, so the
patient had to be reaching the invitation another way. They were: the header logo is `restart`, and
it went to the invitation for everybody. Tapping your provider's logo — the most ordinary "go home"
gesture there is — took an enrolled patient to a page inviting them to join.

Three fixes: the logo goes to My Care once enrolled; the invitation's call to action resumes care
setup rather than starting enrollment; and Back no longer lands there at all.

### RETEST-NEW-003 — English directions on the Spanish screen

**Confirmed.** `Take once daily` and `Take once daily at bedtime` were literal strings in the
medication fixture.

Fixed at the display layer only. The sig stays as the prescriber documented it, because that is what
travels to the care team and into the refill episode, and translating a stored clinical instruction
is a different and worse problem. The patient now reads a translation of a record that has not moved.
This is also the untranslated half of EMMI-LIVE-017.

## Found while validating, not in the report

Three faults that silently weakened answers, each surfaced by trying to prove one of the above.

**A page's response rule could be dropped.** One chunk per document meant a page's "EMMI response
rule" — "never state an amount from this page", "never say the information is unavailable" — only
reached the model when its own section outscored the rest of the page. A cost page could arrive
stripped of the sentence forbidding it to quote a figure. The rule is not a competitor for a slot;
it now rides along with whichever chunk of that document was chosen.

**Spanish first-person questions were classed as impersonal.** "¿Cuánto voy a pagar al mes?" matched
no personal marker, so it did not demand the cost engine and could be answered from a general page.
Spanish carries the subject in the verb, so the pronoun the marker list waited for is usually absent.

**Two categories the router never asked for.** `access-cost-sharing.md` declared `programs` where
the router only ever asks for `program`, so it could not earn its category score; and `billing`,
where the authoritative expected-payment page lives, was mapped to no intent at all.

## Not validated

Honest gaps, not passes.

**Needs live audio — the report's own blocker and everything behind it.** EMMI-LIVE-013 (no
transcript), 008 (spoken language switch), 009 (natural pauses), 006 (barge-in), 010 (silence and
echo), RETEST-NEW-004 (stale narration replayed after a failed capture), and the report's exit
criteria for spoken turns and refusals. This session has no microphone. **Decide who runs this.**

**Needs a live model or a state this session cannot reach.** EMMI-LIVE-001 and 015 (a clean
pre-order device state), 012 (an authoritative pre-consent state), 007 (an identity-to-care
transition), 016 (spoken refusal not becoming a task), and 002 (fragmented output, which is response
assembly in the streaming path rather than anything deterministic).

EMMI-LIVE-005 — the 911 answer the report found improved — was not changed this iteration and was
not re-checked.

## Coverage added

- `tests/emmiKnowledge.test.js` — the retrieved text carries random selection, the twelve months,
  Medicare unchanged, and the ninety days, in three languages; no page outside the master carries a
  quotable amount; every declared category is one the router asks for; each page's response rule
  survives retrieval.
- `tests/emmiGuardrails.test.js` — the option named is the one on the screen, in three languages;
  the screen's own quick questions route to it; Care Circle is untouched elsewhere.
- `e2e/post-enrollment-navigation.spec.js` — Back from medications, the header logo, the invitation's
  call to action, and the Spanish directions, walked from the invitation rather than seeded.
- `e2e/emmi-conversation.spec.js` — reopening a long thread lands on the newest turn.
