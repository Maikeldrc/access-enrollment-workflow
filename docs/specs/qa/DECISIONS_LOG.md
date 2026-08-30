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

## Open, not yet decided

- Whether the `access-bp-assigned` scenario should appear in the admin console's scenario list, where
  a demo operator will see it, or be hidden as a test-only fixture.
- Whether the weight goal should offer a medication question at all. It appears because the patient
  has medications, which is defensible, but it is off-topic beside eating and moving.
