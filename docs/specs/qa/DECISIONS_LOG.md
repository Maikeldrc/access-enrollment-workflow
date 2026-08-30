# Decisions log

Calls made while building, with the alternative that was rejected and why. Anything here can be
reversed — that is the point of writing it down. Decisions you made directly are marked **yours**;
the rest I made alone and are open to being overruled.

## Product

**Care manager carries the Verified badge** — *yours, and against my recommendation.* The prototype's
default care manager is an invented person, like Dr. Fresner. I argued the badge should be reserved
for a real assignment on the offer, so the demo shows the difference between a verified record and a
fixture. You chose to show it, so the demo reads as a complete care team. Implemented.

**Arm restriction questions removed from the device request** — *yours.* I had kept them, arguing
that shipping the wrong cuff is a real failure and those answers prevent it. You removed them; the
cuff size stays. The clinical review path is not orphaned: "Both arms" no longer exists as an answer,
but the server still flags a fulfillment as needing review on its own terms.

**Contact numbers shown in full** — *yours.* The chooser masked them. The patient is picking between
numbers from their own contact, on their own phone.

**Only the patient's first name on the public invitation** — *yours.* The record holds no surname,
and the page is reachable by anyone with the link.

**"Check your blood pressure", not "track"** — mine, extending a principle you approved for weight.
A connected monitor transmits; tracking is the platform's job. Applied to the blood pressure goal's
supporting copy without asking, because the reasoning was already settled for weight.

**Device status shows only NOT_REQUESTED and REQUESTED** — mine. The spec lists Shipped, Delivered
and Connected, but the runtime never produces them, and announcing a shipment nobody confirmed is a
promise a patient plans their week around.

**Only the first intervention per barrier starts** — mine. A forgotten routine configures reminders,
routine help, Care Circle and a care team task. Starting all four buries the patient in help nobody
asked for; the model's own ordering is its answer to that difficulty.

**Care plan shows "Active" rather than "ready"** — mine. It existed before the patient arrived, and
"ready" implies they built it.

## Engineering

**A new `access-bp-assigned` scenario** — mine. Removing the monitor question left the owned-device
path unreachable, because the journey reads the record and no fixture had a device on it. The
alternative was making `access-happy` own a monitor, which would contradict the canonical patient.

**Seven e2e tests deleted rather than rewritten** — *yours.* Their subject was removed on purpose.
Documented in the QA report with what coverage was lost.

**Five deterministic EMMI answers written, then deleted** — mine. They duplicated answers the runtime
tools already give, and guardrails run first, so they silently replaced live reads with a context
snapshot. Two existing tests caught it.

**Dizziness added to the symptom gate, not to the emergency copy** — mine. The gate decides which
turns reach the clinical engine; the engine still decides severity.

**New CSS prefixed `access-plan-`** — mine, forced. Four class names I chose were already taken by
the goal plan review, and the rules collided in both directions.

**The consent answer will not say "up to $6"** — mine, and it contradicts the voice re-test's own
exit criterion. The report asks that the consent answer contain the figure exactly. It will not:
the amount depends on the patient's verified coverage, and a remembered figure is precisely how
EMMI once told a patient $0 while their screen said $6. Knowledge now carries the timing and the
structure; the number comes from the financial responsibility engine on every question. A test
asserts that no page outside the master file carries a quotable amount. **If you want the figure
stated regardless, say so and I will bind it — but it stops being true for every patient.**

**A page's response rule now travels with whichever part of it was retrieved** — mine, and it
changes what reaches the model on every question, not only the ones in the report. One chunk per
document meant a page's "EMMI response rule" only arrived when its own section outscored the rest
of the page, so a cost page could reach the model stripped of the sentence forbidding it to quote a
figure. The alternative was rewriting all 46 documents to front-load their rules, which leaves the
same trap set for document 47.

**Spanish first-person verb forms added to the personalisation markers** — mine. "¿Cuánto voy a
pagar al mes?" matched no marker, so a question unmistakably about the speaker did not demand the
cost engine. Spanish carries the subject in the verb, so the pronoun the old list waited for is
usually absent. Over-matching here demands a tool that would otherwise be skipped, which is the
safe direction, so ambiguous nouns like "pago" and "cambio" stayed out.

**The prescription sig stays in English on the record; only the display is translated** — mine. The
Spanish and Creole medication screens were handing out directions in English, which is a real
comprehension failure. But the sig is what the prescriber documented and what travels to the care
team and into the refill episode, and translating a stored clinical instruction is a different and
worse problem. The patient now reads a translation of a record that has not moved.

**The header logo goes to My Care once the patient is enrolled** — mine. It is a global navigation
affordance and it previously went to the invitation for everybody, which is how an enrolled patient
ended up being asked who was completing their enrollment.

## Clinical safety — decisions worth your attention

These three are judgment calls about an emergency, made alone. They are the ones I would most want
a clinician to look at.

**A patient saying they feel better ends the emergency episode** — mine, and the one I am least
certain of. Saying "I called 911" or "the paramedics are here" clearly should end it. Saying only
"I'm feeling better now, the pain stopped" is the patient assessing themselves, and believing them
means an emergency prompt can be talked away. I decided it ends the episode anyway, because the
alternative that was actually shipped — an app that answers nothing but "call 911" forever, through
reloads — is not the safer option, it is just the more frightened one. The acknowledgement repeats
the instruction to call 911 if the symptoms return, and it is recorded as
`PATIENT_REPORTED_RECOVERED` rather than as a confirmed handoff, so the two are never confused in
the record. **If a clinician wants only a confirmed handoff to close an episode, that is one line.**

**Four hours before an episode expires on its own** — mine, and the number is a judgment, not a
finding. Long enough to cover a real episode and the wait that follows it; short enough that a
patient returning the next day is not met with an emergency that is over. Nothing in the spec named
a duration.

**A new symptom during an open episode still escalates** — mine, and the conservative half. The
resolution check runs before the emergency gate, but only resolution phrasing passes it; anything
that reads as a symptom goes to the clinical engine as it always did.

## Engineering, continued

**Knowledge pages now declare their own keywords, in three languages** — mine, and it changes how
every future page has to be written. The corpus is English and the patients ask in three languages,
so token overlap alone cannot tell one ACCESS page from another for a Spanish or Creole question.
Yesterday's comparison-group fix passed on a tie-break; two new pages were enough to break it. The
alternative was translating the whole corpus, which is a much larger piece of work and probably the
right eventual answer.

**The no-model fallback answers from the retrieved page, in English only** — mine. When the model
cannot be reached there is nothing to translate with, so a Spanish or Creole patient keeps the
canned trilingual answer rather than being handed English prose. It means those patients still get
a general answer in that degraded mode. **This disappears if the corpus is translated.**

## Verification method

**The responsive audit walks the screens instead of jumping to them** — mine, and forced. The QA
screen selector does not exist on the canonical invitation, which is correct: a patient must never
see the console. It turned out better anyway, because the goals cards and barrier groups only carry
real content after the patient has passed through the steps that create them.

**Touch targets measured through the label** — mine. A checkbox is 20px and unhittable on its own;
what the patient presses is the row around it.

**The goal disclosure is opened before auditing** — mine. What a disclosure hides still has to
survive being shown at 150% on a 360px phone.

**One long golden-journey test rather than several** — mine. The value is the sequence: a step that
only passes because an earlier one was skipped is what it exists to catch, and splitting it would
reintroduce exactly the seeding that hides those defects.

## Resolved

**`access-bp-assigned` stays visible in the admin console** — *yours.* It is a real product path —
the patient whose monitor is already on file — and it should be possible to demonstrate it. No code
change; it was already listed.

**The weight goal keeps its medication question** — *yours, and against my recommendation.* I argued
it is off-topic beside eating and moving, and that section 8 says not to ask what cannot change care
execution. You kept it: medication can affect weight, and the option only appears because this
patient actually has medications. No code change.

## Open, not yet decided

**The voice transport itself is not certified, and I cannot certify it.** The 2026-08-30 re-test's
headline finding is that speaking produces no patient transcript, and everything it lists as
blocked — barge-in, natural pauses, spoken language switching, silence handling, spoken refusal —
depends on that. Reproducing it needs a real microphone and audible speech, which this session has
no way to drive. I validated and fixed what is deterministic; I did not touch the audio path, and
nothing I did this iteration should be read as evidence about it. **Decide who runs that: the
session with the live browser and audio, or a scheduled human pass.**

**Whether the consent answer must quote "up to $6".** See the entry under Engineering. I decided
against it and can reverse it in one edit.

**Whether a patient's own word that they feel better should end an emergency episode.** See Clinical
safety above. I said yes; a clinician may well say no. It is the single decision in this work I
would most like reviewed.

**Which of the remaining enrollment tests to delete rather than rewrite.** Twenty still fail. Most
assert copy or controls that moved, and I am rewriting those. A few test things the care activation
refactor removed on purpose — the health-check screen that asked whether the patient owned a
monitor, and the "I'm not sure" cuff option that raised a care-team task. Those cannot be rewritten
because their subject is gone. You made this call last time, so I am not making it alone: **say
delete and I will remove them and record the lost coverage in the QA report, or say keep and I will
leave them failing as a visible reminder of what was dropped.** I recommend deleting, with the
coverage loss written down.

**Whether to translate the knowledge corpus.** It is written in English and read by patients in
three languages. Keywords per page close the retrieval half of that, and the model translates the
answer when it is reachable — but when it is not, a Spanish or Creole patient gets a general answer
where an English speaker gets a specific one. Translating the corpus is the real fix and is a
sizeable piece of work.
