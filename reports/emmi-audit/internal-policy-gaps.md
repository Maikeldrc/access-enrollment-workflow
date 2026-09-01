# Internal policy gaps — decisions ITERA must make

Each item below is a question patients asked during the audit that **cannot be answered from CMS or
Medicare material**, because it is an ITERA operational decision that has not been made or has not
been written down anywhere in the product.

EMMI now answers all of them the same way: it says plainly that it cannot confirm the answer and
offers the care team. That is safe, and it is honest, but it is not a good experience — a patient who
asks three of these in a row gets three deflections. Every one of them is cheap to close once someone
decides the answer.

They are ordered by how often a patient is likely to hit them.

---

## P0 — a patient hits this while trying to get care

### 1. Transportation: what, if anything, is offered, and who pays
**Questions:** "I have no transportation", "Who pays for the Uber?", "Can you book the ride for me?",
"I need a ride back home too" (M01–M12, PH21–PH23, CMP03)
**Why it matters:** This is the single most common practical reason care does not happen, and it was
the category with the worst baseline result (0 of 12 correct). During the audit EMMI answered *"Who
pays for the Uber?"* with *"your expected payment for ACCESS is $0"* — a patient reads that as being
told the ride is free.
**What EMMI does now:** Records the difficulty for the care team, states plainly that it cannot book,
order or pay for a ride, and explicitly refuses to promise one.
**Decision needed:** Is any transportation benefit, brokerage or partner available to ACCESS patients?
If yes: who is eligible, who pays, how is it requested, and may EMMI initiate it? If no: is there an
approved sentence pointing patients to community or plan resources?

### 2. Care-team availability and callback expectations
**Questions:** "Is anyone available at night?", "What hours can I reach her?", "How long will it take
for someone to call?", "Nobody calls me" (G08, CMP35, PH59, Z03)
**What EMMI does now:** Offers a callback and declines to state hours or timing.
**Decision needed:** Support hours, out-of-hours routing, and the callback SLA EMMI may state. Also:
what a patient should do at 2am with a non-emergency concern.

### 3. How the EMMI conversation itself is handled
**Questions:** "Can my doctor see what I write to you?", "Do you save my conversations?", "Are you
recording me right now?", "Can I get a copy?" (F03, F04, F09, PH16, MT25.t4)
**Why it matters:** With the generation layer restored, EMMI initially answered both of the first two
with a confident **"Yes"** — invented, and about the patient's own privacy. That is the class of
answer a patient acts on when deciding what to type.
**What EMMI does now:** Answers what is known about care-team and Medicare data sharing, and says
explicitly that it cannot confirm how the conversation itself is stored or who can read it back.
**Decision needed:** Retention period for chat and voice transcripts; whether clinicians can read
them; how a patient requests a copy or deletion; and the patient-facing sentence for each.

---

## P1 — a patient hits this during setup or a visit

### 4. Device return logistics
**Questions:** "Do I have to give the monitor back?", "Who owns the equipment?" (P08, P09, PH24, PH25)
**Status:** Partly answered by research. CMS permits loan **or** ownership at the participant's
discretion, and items may be recovered at the end of care. **Which one ITERA chose is not recorded
anywhere in the product**, so EMMI says it may be a loan and routes to the care team.
**Decision needed:** ITERA's actual basis, and the return process if it is a loan.

### 5. Measurement frequency
**Question:** "How many times should I measure?" (P07)
**Decision needed:** This is clinical configuration. Is there a default cadence EMMI may state, or is
it always per care plan? If per care plan, it should come from runtime rather than knowledge.

### 6. Appointment logistics
**Questions:** "Do I need to arrive early?", "What should I bring?", "I am going to be late",
"How do I get there?" (L08, L10, L12, L13)
**Note:** These are practice-level rather than ITERA-level. The decision is whether ITERA surfaces
per-practice arrival and preparation instructions in the appointment record so EMMI can read them.

### 7. Complaint and escalation process
**Questions:** "I want to make a complaint", "I want to speak to a supervisor" (Z02, Z06, CMP19)
**What EMMI does now:** Offers a care-team callback and says it can pass the concern on.
**Decision needed:** Is there a defined complaint path, a grievance process, or a supervisor
escalation EMMI should name? Patients in a CMS model also have the 1-800-MEDICARE route, which EMMI
does not currently offer for complaints.

---

## P2 — edge cases, but each one is a real patient

### 8. Hospice, nursing home, assisted living
**Questions:** C11, C12, C13
**Status:** Medicare lists exactly three reasons a person cannot use ACCESS, and none of these is
among them — but absence from a list is not permission, and it would be wrong to infer either way.
**Decision needed:** Confirm with CMS or counsel whether residence or hospice status affects
eligibility, then record the answer.

### 9. Partial Medicare holdings
**Questions:** "I only have Part A", "I have Part B, does that qualify me?" (C03, C04)
**Status:** Medicare states the requirement as "Original Medicare" without addressing a partial
holding. EMMI initially answered *"Yes, you can still take part with only Part A"* — an invention.
It now explains the requirement and offers to check the patient's own coverage.
**Decision needed:** Confirm whether both Part A and Part B are required, and record it.

### 10. Re-joining after declining
**Question:** "Can I join later if I say no now?" (B06)
**Decision needed:** Medicare says a person can sign up with an organization directly, which implies
yes, but no explicit re-join rule is published. Confirm and record.

### 11. Extended travel
**Questions:** "I will be away for four months", "Can I have my appointments from another state?"
(T03, T04, T07, PH50, PH51)
**Status:** EMMI says the device travels, and that visits from another state depend on where the
clinicians are licensed — then routes to the care team.
**Decision needed:** Licensure footprint, and whether a long absence affects participation.

### 12. Drug-specific education
**Questions:** "What is lisinopril for?", "What side effects does it have?", "When should I take it?"
(I12, K01, K02, PH35, PH36)
**Status:** Deliberately out of scope; EMMI offers the care team or pharmacist.
**Decision needed:** Whether ITERA wants EMMI to carry approved patient-facing medication education
(from a licensed monograph source), or to keep routing these to a pharmacist. Either is defensible;
the current behaviour is safe but unhelpful, and patients ask often.
