# Internal policy drafts — proposals for review

> ## ⚠ UNAPPROVED DRAFT — NOT ITERA POLICY
>
> Nothing in this file is a decision ITERA has made. Every proposal below was written by the audit
> as a starting point for the person who owns that decision, because the audit was not permitted to
> invent operational policy and EMMI cannot answer these questions until someone does.
>
> **No sentence in this file is in the knowledge base, and none should be added until the owner
> named for that item approves it.** Where a proposal rests on CMS or Medicare material the source
> is cited; where it rests on nothing but reasonableness, that is said plainly.

Companion to [`internal-policy-gaps.md`](internal-policy-gaps.md), which states the gaps without
proposing answers. Same numbering.

**How to use this:** for each item, either approve the drafted wording, edit it, or reject it and
say what the answer actually is. Once an item is settled, its patient-facing sentence goes into the
knowledge page named under *Where it lands*, in all three languages, and the corresponding audit
questions are re-tested.

| # | Decision | Owner needed | Rests on |
|---|---|---|---|
| 1 | Transportation benefit | Operations + Compliance | Nothing — needs a business decision |
| 2 | Care-team hours and callback SLA | Clinical Operations | Nothing — needs staffing reality |
| 3 | Conversation retention and access | Privacy / Legal | Nothing — needs the actual system design |
| 4 | Device ownership vs loan | Operations + Finance | CMS permits either; ITERA must pick |
| 5 | Measurement frequency | Clinical | Care plan; may already exist in runtime |
| 6 | Appointment logistics | Product | Data availability, not policy |
| 7 | Complaint and escalation path | Compliance | Partly CMS (1-800-MEDICARE exists) |
| 8 | Hospice / facility residence | Compliance + Counsel | CMS silent — needs confirmation |
| 9 | Part A only vs Part A + B | Compliance + Counsel | CMS says "Original Medicare" |
| 10 | Re-joining after declining | Compliance | CMS implies yes — needs confirmation |
| 11 | Extended travel and licensure | Clinical + Legal | Licensure footprint is a fact ITERA holds |
| 12 | Drug-specific education | Clinical + Legal | Scope decision |

---

## 1. Transportation — what is offered and who pays

**Owner:** Operations, with Compliance sign-off.

This is the item with the worst patient impact in the whole audit and the one where a wrong answer
is most costly: a patient told "your expected payment is $0" in response to *"who pays for the
Uber?"* may reasonably stop arranging their own ride and then miss the visit.

**Three options, and what each costs to say:**

| Option | Patient-facing consequence |
|---|---|
| **A. No benefit** | Honest and cheap. EMMI names community and plan resources instead of going silent. Requires only an approved sentence. |
| **B. Care team arranges case by case** | Closest to what the care team probably already does informally. EMMI records the need and sets the expectation that someone will call — needs a callback SLA (item 2). |
| **C. Funded benefit or brokerage** | Best for patients, largest operational and compliance lift. Under CMS ACCESS, in-kind items and services to beneficiaries run through the model's beneficiary-engagement provisions and the safe harbour at 42 CFR §1001.952(ii)(2); anything here needs Compliance to confirm what is permitted before it is offered. |

**Recommendation:** decide between A and B now, and say which. B is likely closest to the truth
today, and it is the one EMMI can support without any new capability.

**Draft patient answer, option B:**

- **EN:** "I can't book or pay for a ride, but getting to your appointment matters, so I've noted this for your care team and someone will look at what's available near you. If your visit is soon, it's worth calling your doctor's office too."
- **ES:** "No puedo reservar ni pagar un transporte, pero llegar a su cita es importante, así que anoté esto para su equipo de atención y alguien revisará qué opciones hay cerca de usted. Si su cita es pronto, también conviene llamar al consultorio de su médico."
- **KR:** "Mwen pa ka rezève ni peye pou yon transpò, men rive nan randevou ou enpòtan, kidonk mwen note sa pou ekip swen ou epi yon moun ap gade ki opsyon ki genyen toupre w. Si vizit ou a fèt byento, li bon pou w rele biwo doktè ou tou."

**Draft patient answer, option A** — replace the second clause with: "…this isn't something ACCESS
covers, so I've noted it for your care team and they can point you to local options."

**Where it lands:** `care/getting-to-appointments.md`.
**Must not say:** that a ride is free, arranged, covered, or on its way.

---

## 2. Care-team hours and callback expectations

**Owner:** Clinical Operations.

EMMI offers a callback today and refuses to say when it will come, which is the correct behaviour
in the absence of a number but reads as evasive when a patient asks twice.

**Decide three things:** support hours; what happens outside them; and the maximum time EMMI may
promise for a callback.

**Draft, assuming business hours and a one-business-day callback:**

- **EN:** "Your care team is available Monday to Friday, [hours], [timezone]. I've asked them to call you, and they usually reach people within one business day. If something feels urgent before then, call your doctor's office — and if it's an emergency, call 911."
- **ES:** "Su equipo de atención está disponible de lunes a viernes, [horario], [zona horaria]. Les pedí que le llamen y por lo general se comunican en un día hábil. Si algo se siente urgente antes de eso, llame al consultorio de su médico, y si es una emergencia, llame al 911."
- **KR:** "Ekip swen ou disponib lendi jiska vandredi, [lè], [zòn lè]. Mwen mande yo pou yo rele w, epi anjeneral yo rive jwenn moun nan yon jou ouvrab. Si yon bagay sanble ijan anvan sa, rele biwo doktè ou — epi si se yon ijans, rele 911."

**Also decide:** what a patient should do at 2am with a concern that is real but not 911. Right now
EMMI has nothing to offer between "call your care team" and "call 911", and that gap is where
patients either do nothing or over-escalate.

**Where it lands:** `core/human-help-and-complaints.md`.
**Must not say:** any hour or interval that has not been confirmed. Placeholders above are
deliberate and must be filled before this ships.

---

## 3. How the EMMI conversation itself is handled

**Owner:** Privacy / Legal, with Engineering to confirm what the system actually does.

This is the item where invention is most dangerous, and it is the one the model actually invented
during remediation: asked *"can my doctor see what I write to you?"* it answered a confident
**"Yes."** Nobody had told it that. A patient decides what to disclose based on that answer.

**Answer four questions:** how long are chat and voice transcripts retained; can clinicians read
them; is the content used to improve the product; and how does a patient obtain a copy or request
deletion.

**Draft, assuming transcripts are retained as part of the record and visible to the care team:**

- **EN:** "What you write to me is kept as part of your ITERA record, and your care team can read it. I keep it so your care team can follow up on what you've told me. If you'd like a copy of your information, or you want it removed, your care team can start that for you — just ask."
- **ES:** "Lo que usted me escribe se guarda como parte de su expediente de ITERA y su equipo de atención puede leerlo. Lo conservo para que su equipo pueda dar seguimiento a lo que usted me contó. Si desea una copia de su información, o quiere que se elimine, su equipo de atención puede iniciar ese proceso; solo pídalo."
- **KR:** "Sa ou ekri m yo konsève kòm yon pati nan dosye ITERA ou, epi ekip swen ou ka li yo. Mwen kenbe yo pou ekip swen ou ka swiv sa ou di m. Si ou vle yon kopi enfòmasyon ou, oswa ou vle yo retire l, ekip swen ou ka kòmanse sa pou ou — annik mande."

**If the opposite is true** (transcripts are ephemeral, or clinicians cannot read them) the sentence
must be rewritten, not softened — and that is precisely why this cannot be guessed.

**Where it lands:** `care/privacy-and-data.md`.
**Must not say:** anything about retention, clinician access, or model training that Engineering has
not confirmed against the running system.

---

## 4. Device ownership versus loan

**Owner:** Operations, with Finance.

Partly settled by research: CMS permits ACCESS participants to either loan or transfer ownership of
remote monitoring equipment, and permits recovery of loaned items at the end of care. **Which basis
ITERA uses is recorded nowhere in the product**, so EMMI hedges.

**Draft, loan basis:**

- **EN:** "The monitor is yours to use for as long as you're in ACCESS, and it doesn't cost you anything. It stays ITERA's equipment, so if you leave the program we'll arrange to collect it — there's no charge and nothing for you to do beyond letting us know."
- **ES:** "El monitor es suyo para usarlo mientras participe en ACCESS y no le cuesta nada. El equipo sigue siendo de ITERA, así que si deja el programa coordinaremos su recolección; no hay ningún cargo ni nada que usted deba hacer más que avisarnos."
- **KR:** "Monitè a se pou ou sèvi pandan tout tan ou nan ACCESS, epi li pa koute w anyen. Aparèy la rete pwopriyete ITERA, kidonk si ou kite pwogram nan n ap òganize pou vin chèche l — pa gen okenn frè epi ou pa gen anyen pou fè apa pou fè nou konnen."

**Draft, ownership basis:** replace the second sentence with "It's yours to keep, including if you
leave the program."

**Where it lands:** `devices/rpm-devices.md` and `devices/blood-pressure.md`.
**Note:** during remediation the model twice generated "the monitor is yours to keep" unprompted.
Whichever basis is chosen must be stated explicitly in the knowledge page, or it will be guessed again.

---

## 5. Measurement frequency

**Owner:** Clinical.

Likely not a knowledge-base item at all. A cadence that differs per patient belongs in the care plan
and should reach EMMI through the runtime, the way goals and targets already do — the audit brief's
own rule against fixing a dynamic-context problem with static text applies directly here.

**Two questions:** is there a default cadence for a blood-pressure ACCESS patient that EMMI may
state when the care plan says nothing; and does the care plan already carry a per-patient cadence
that the runtime could expose?

**Draft, if a per-patient cadence exists in the record:**

- **EN:** "Your care plan asks for [N] readings a week. Taking them around the same time of day makes them easier for your care team to compare."
- **ES:** "Su plan de cuidado pide [N] mediciones por semana. Tomarlas más o menos a la misma hora del día facilita que su equipo las compare."
- **KR:** "Plan swen ou mande [N] mezi pa semèn. Pran yo apeprè menm lè chak jou fè li pi fasil pou ekip swen ou konpare yo."

**Where it lands:** runtime, via a care-plan field — not a knowledge page.

---

## 6. Appointment logistics

**Owner:** Product.

Not an ITERA policy question. Arrival time, what to bring and parking are properties of the
practice, and the decision is whether the appointment record carries them so EMMI can read them out
instead of guessing.

**Recommendation:** add optional `arrivalInstructions` and `whatToBring` fields to the appointment
record, surfaced through the existing appointment tools. Until they exist, EMMI's current answer —
that it cannot confirm and the office can — is correct and should not be replaced by generic advice
like "arrive 15 minutes early", which is a guess about someone else's practice.

**Where it lands:** appointment runtime contract, then `care/getting-to-appointments.md` for the
fallback wording.

---

## 7. Complaint and escalation path

**Owner:** Compliance.

Partly answerable from CMS material today. Patients in a CMS model can contact **1-800-MEDICARE**,
and that route exists whether or not ITERA defines an internal one. EMMI currently offers a callback
and does not mention it.

**Recommendation:** ship the Medicare route immediately — it is a published fact, not ITERA policy —
and add the internal path once defined.

**Draft, available now:**

- **EN:** "I'm sorry this hasn't gone well. I can ask the ITERA care team to call you about it, and someone will follow up. You can also contact Medicare directly at 1-800-MEDICARE (1-800-633-4227), which is open to anyone in a Medicare program."
- **ES:** "Lamento que esto no haya salido bien. Puedo pedir al equipo de atención de ITERA que le llame al respecto y alguien le dará seguimiento. También puede comunicarse directamente con Medicare al 1-800-MEDICARE (1-800-633-4227), disponible para cualquier persona en un programa de Medicare."
- **KR:** "Mwen regrèt sa pa mache byen. Mwen ka mande ekip swen ITERA a pou rele w sou sa, epi yon moun ap swiv li. Ou ka kontakte Medicare dirèkteman tou nan 1-800-MEDICARE (1-800-633-4227), ki ouvè pou nenpòt moun ki nan yon pwogram Medicare."

**Still to decide:** whether ITERA has a named grievance process or supervisor escalation, and
whether EMMI may promise a response time for a complaint specifically (see item 2).

**Where it lands:** `core/human-help-and-complaints.md`.
**Verify before shipping:** the 1-800-MEDICARE number against Medicare.gov at publication time.

---

## 8. Hospice, nursing home, assisted living

**Owner:** Compliance, with counsel.

Medicare publishes exactly three reasons a person cannot take part in ACCESS, and residence in a
facility is not among them. **Absence from a list is not permission**, and a patient in hospice
asking whether they can enrol deserves a real answer rather than an inference.

**Recommendation:** confirm with CMS, then record. Until confirmed, the current behaviour — explain
the three published reasons, then offer to check the patient's own situation with the care team — is
the correct one and should not be replaced with a guess in either direction.

**Draft, once confirmed permitted:**

- **EN:** "Living in a nursing home or assisted living doesn't stop you from taking part in ACCESS. What matters is that you have Original Medicare and a condition the program covers. Your care team can check your own situation with you."

**Where it lands:** `programs/access-eligibility.md`.

---

## 9. Part A only, or Part A and Part B

**Owner:** Compliance, with counsel.

Medicare states the requirement as "Original Medicare" and does not address a partial holding. The
model invented **"Yes, you can still take part with only Part A"** during remediation, which is the
strongest argument for writing the real answer down.

The services ACCESS is built on are Part B services, which makes Part B enrolment the likely
requirement — but likely is not good enough for an eligibility statement, and this one needs
confirming rather than reasoning.

**Draft, assuming both parts are required:**

- **EN:** "ACCESS is for people who have Original Medicare — that's Part A and Part B together. If you only have one of them, you may be able to add the other; I can have your care team check your coverage with you."

**Where it lands:** `programs/access-eligibility.md`.
**Must not say:** that Part A alone qualifies, unless CMS confirms it.

---

## 10. Re-joining after declining

**Owner:** Compliance.

Medicare says a person may sign up with a participating organization directly, which implies a "no"
today does not close the door. No explicit re-join rule is published.

**Draft, assuming re-joining is permitted:**

- **EN:** "Saying no now doesn't close the door. If you change your mind later, tell your doctor's office or ITERA and we can pick it up again from there."
- **ES:** "Decir que no ahora no cierra la puerta. Si cambia de opinión más adelante, dígale al consultorio de su médico o a ITERA y podemos retomarlo desde ahí."
- **KR:** "Di non kounye a pa fèmen pòt la. Si ou chanje lide pita, di biwo doktè ou oswa ITERA epi nou ka repran sa apati la."

**Where it lands:** `enrollment/enrollment.md`.

---

## 11. Extended travel and licensure

**Owner:** Clinical, with Legal.

The licensure footprint is a fact ITERA already holds; it simply is not in the product. Two
questions: which states the clinicians are licensed in, and whether a long absence affects
participation.

**Draft, once the footprint is known:**

- **EN:** "Your monitor works anywhere in the United States, so your readings keep reaching your care team while you're away. Visits by video depend on where your clinician is licensed — your care team is licensed in [states], so let them know your travel dates and they'll tell you what's possible."

**Where it lands:** `programs/access-while-away.md`.
**Must not say:** a state list that has not been confirmed, and must not imply visits are available
everywhere the monitor works. Those two facts differ and patients conflate them.

---

## 12. Drug-specific education

**Owner:** Clinical, with Legal.

A scope decision, not a gap. Patients asked what lisinopril is for, what its side effects are and
when to take it. EMMI routes all of these to a pharmacist or the care team.

**Two defensible positions:**

- **Keep routing.** Safe, and defensible for a non-clinical assistant. Current behaviour.
- **Carry approved education** from a licensed monograph source, for the patient's own prescribed
  medications only, with dose and timing questions still routed to a clinician.

**Recommendation:** if this is taken on, it must come from a licensed monograph feed and not from
the knowledge base or the model. Hand-written drug text is exactly the kind of content that reads
fine and is wrong in the case that matters, and the audit found the model willing to generate it.

**Where it lands:** a new source type, not a Markdown page.

---

## What happens once these are answered

For each approved item: add the wording to the named page in all three languages, add the keyword
phrases patients actually used (they are in `emmi-qa-results.csv` under the question ids listed in
`internal-policy-gaps.md`), restart the server so the knowledge index rebuilds, and re-test the
listed question ids plus at least two paraphrases each.

Items 1, 2 and 3 together account for most of the deflections a patient will meet in a normal week.
