# Knowledge base and code changelog

Every change made after the baseline was captured. The knowledge base was backed up first to
`reports/emmi-audit/kb-backup/Knowledge/` (52 files); nothing was deleted.

Changes are grouped by what caused them. Technical changes come first because one of them is the
reason most of the knowledge changes were invisible.

---

## CHANGE-01 — The generation layer had never run in production

**Related tests:** 322 of 473 baseline turns (68%)
**Category:** Technical — TOOL/PROMPT plumbing
**Root cause:** `HALLUCINATION` was never the problem; `GENERATION_LAYER_DOWN` was.

**Problem.** `EmmiTextOrchestrator`'s constructor defaulted to `fetchImpl = globalThis.fetch`, storing
a native browser method without its receiver. Called as `this.fetch("/api/emmi/chat", …)` it threw
`TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation` before any request left the
page. The surrounding `catch` treated that as a generation failure and fell through to
`fallbackKnowledgeAnswer`. Confirmed in production from the app's own audit log, and again in the
deployed bundle, which contains `fetchImpl: r = globalThis.fetch`.

Every existing test injected its own `fetchImpl`, so the default was never executed by the suite.

**Previous behaviour.** Every knowledge question in production was answered by dumping raw text from
the highest-scoring knowledge chunk. `/api/emmi/chat` was never called from the browser — zero
requests to it appear in a full network capture of the baseline session.

**New behaviour.** The default wraps the call so the receiver survives:
`fetchImpl = (...args) => globalThis.fetch(...args)`.

**Files changed:** `src/emmi/textOrchestrator.js`
**Test added:** `tests/emmiAuditRemediation.test.js` — "calls its default fetch with a receiver the
platform accepts", which fails against the old constructor.
**Expected improvement:** Restores the entire generative layer.

---

## CHANGE-02 — Internal authoring instructions were shown to patients

**Related tests:** 188 baseline turns (39.7%)
**Category:** KB authoring + technical guard
**Root cause:** `KB_AUTHORING_VOICE` — patient prose and maintainer instructions in the same section.

**Problem.** Knowledge pages state their answer for Spanish and Creole readers in a dedicated
`Patient answer (ES|KR)` section, which the chunker lifts out. English had no equivalent, so the
fallback rendered the page's **lead section** — which carries the retrieval keywords and the rules the
model must follow. Patients were shown, verbatim:

- *"Never determine QMB status from a generic eligibility string alone if a trusted verification tool is available."*
- *"Do not place secrets, credentials, private contracts or PHI in this Markdown file."*
- *"getEnrollmentContext (READ): Programa, track, source, role, stage, eligibility, consent state. Guardrail: No modifica state."*
- *"MEDICARE-MEDIGAP — Medicare.gov - Medigap. https://… Uso: … Nota: No prometer cobertura sin verificar plan."*

The consequence was asymmetric: Spanish and Creole patients received clean prose while English
patients received the engineering notes.

**New behaviour, three layers:**
1. `Patient answer (EN)` is now a recognised section (`server/emmiKnowledge.js`), lifted like the
   others. **22 existing pages** were given one.
2. The fallback renderer prefers the written answer for the reader's own language, English included.
3. `patientFacingProse()` strips instruction sentences from anything still rendered, and returns
   nothing if a page turns out to be all instruction — so the caller offers a person instead of
   reading an instruction out.
4. `server/emmiChat.js` now puts the written answer into the model's grounding, which the chunker
   had been removing.

**Files changed:** `server/emmiKnowledge.js`, `server/emmiChat.js`, `src/emmi/textOrchestrator.js`,
and 22 knowledge pages.
**Result:** 188 leaked turns → **0**.

---

## CHANGE-03 — Retrieval answered from whichever page shared a word

**Related tests:** ~150 baseline turns
**Category:** Technical — RETRIEVAL

Three distinct defects, each measured across the audit's own questions:

**(a) Multi-word keywords were split into tokens.** `savings program` on the QMB page handed that page
the word *"program"* — one of the commonest words in this product. QMB was the top-ranked document on
**62 failing turns**, answering what a government program is, whether the monitor costs anything, and
whether the invitation is a scam. Keywords are now matched as **intact phrases**, normalised the same
way on both sides.

**(b) `not` was not a stopword.** Three-letter function words survived tokenisation, so *"My camera
does **not** work"* scored a heading match against *"Leaving is **not** losing Medicare"*, *"Why A1c is
asked for when the patient is **not** diabetic"* and *"ACCESS payment is **not** every healthcare
cost"* — three pages tied on *not*, and the tie-break picked the answer. Function words in three
languages were added to `STOP_WORDS`.

**(c) Any score above zero was enough to answer.** A page reached on one incidental word was still
returned. Selection now asks *why* a page matched: it qualifies only if it declared the question's own
words, a heading is on the subject, the current screen selects it, it is the safety corpus for a
safety turn, or body overlap is substantial. Below that the retriever returns nothing and EMMI says it
does not know — which is the true answer.

**Files changed:** `server/emmiKnowledge.js`
**Tests added:** four cases in `tests/emmiAuditRemediation.test.js`.

---

## CHANGE-04 — Two thirds of the FAST stroke test reached no safety route

**Related tests:** J05b, J06b, PH39, PH40, PH41, RG33, RG34 — **P0**
**Category:** SAFETY_POLICY

**Problem.** The emergency gate contained the word *"stroke"* but none of the ways a person describes
one. `"I have weakness on one side of my body."` was answered with **ACCESS track eligibility text**.
`"I cannot speak properly."` was answered with **coverage-verification rules**. Neither reached the
escalation engine at all.

**New behaviour.** Unilateral weakness or numbness (including "the left side of my body"), facial
droop, slurred or difficult speech, seizure, unresponsiveness, crushing chest pain, chest tightness
and "worst headache" are recognised in all three languages, in both the gate
(`src/emmi/safetyPolicy.js`) and the severity engine (`src/clinicalMonitoring.js`).

**Verified:** all five stroke phrasings now return the 911 instruction via `SAFETY_ENGINE`.

---

## CHANGE-05 — A patient reporting a symptom reached a dead end

**Related tests:** I04, I06, I07, I08, PH42, PH43, RG35 — **P0/P1**
**Category:** SAFETY_POLICY

**Problem.** `"I have a headache."`, `"I feel weak."`, `"I do not feel well."` and `"My blood pressure
is very low."` matched nothing anywhere — not safety, not a reading, not a topic — so they went to the
knowledge base, which had nothing, and the patient was told the information was not available.
`"my bp high what i do"`, typed by a Spanish-preference patient, was answered with **"I noticed you're
writing in English. Would you like me to continue in English?"** — a language preference asked ahead
of a blood-pressure complaint.

**New behaviour.** A `SYMPTOM_REPORT` group and a `REPORTED_HIGH_BP` group feed the gate. Because the
escalation engine still decides severity, these produce the care-team offer rather than 911. The
language-switch interstitial is skipped entirely for any turn the safety gate matches
(`src/app.js`).

---

## CHANGE-06 — Missed and extra doses were not medication-safety turns

**Related tests:** I09, I10, K03, PH35–PH38 — **P0**
**Category:** SAFETY_POLICY

**Problem.** `MEDICATION_SAFETY` covered stop/quit/skip/double but not **miss**, **missed**, **forgot**
or **another dose**. `"I forgot to take my medicine."` was answered with the ACCESS comparison group;
`"Should I take another dose?"` with the 90-day rule. These are the two commonest dosing questions
there are.

**New behaviour.** Missed, forgotten, skipped, another and second doses are recognised in three
languages and routed to the deterministic medication-safety refusal.

---

## CHANGE-07 — Screen help swallowed a clinical question

**Related tests:** I03, X02, U13 — **P0**
**Category:** INTENT_CLASSIFICATION

**Problem.** `SCREEN_HELP` matched the bare phrase `what (do i|should i) do` anywhere in a sentence, so
**"What should I do if my blood pressure is high?"** was answered with *"This screen shows your current
enrollment task and what you need to do next."*

**New behaviour.** The generic phrases match only when the question ends there or continues with a
screen-referring phrase ("this screen", "en esta pantalla", "now", "here"). Specific screen questions
are untouched; the two existing tests that cover them still pass.

---

## CHANGE-08 — Asking for a person was not recognised as asking for a person

**Related tests:** W01, W02, W04, W05, Z02, Z06, CMP19, PH17–PH20 — **P0**
**Category:** INTENT_CLASSIFICATION

**Problem.** `HUMAN_SUPPORT` matched "talk to someone" and "human" but not **"I want to speak with a
person"**, **"I want to speak to a supervisor"**, **"I do not want to talk to an AI"** or **"This did
not solve my problem"**. The single request that must always be honoured was among the most reliably
dropped: *"I want to speak with a person"* returned an internal instruction about the ninety days.

**New behaviour.** Speaking to a person, representative, supervisor or manager; refusing to talk to an
AI; complaints; and statements that EMMI did not help are all recognised, in three languages, and go
to the callback route.

---

## CHANGE-09 — A cost question about a ride answered with the ACCESS cost

**Related test:** M06 — **P0**
**Category:** LOGIC

**Problem.** `"Who pays for the Uber?"` matched the cost intent and was routed to the financial
responsibility engine, which correctly reported the **ACCESS** amount: *"your expected payment for
ACCESS is $0."* A patient asking about a ride reads that as being told the ride is free.

**New behaviour.** A cost question whose subject is transportation is excluded from the ACCESS cost
route and answered by the transportation page, which says plainly that it cannot confirm who pays.

---

## CHANGE-10 — The care-team answer named the wrong person

**Related tests:** G01, G10, G11, RG17, RG18, PH54, PH55 — **P1**
**Category:** CONTEXT_INJECTION

**Problem.** `getCareTeam` returns the full member list, but the renderer used only
`physicianDisplayName`. Every role question — care manager, cardiologist, whole team — was answered
*"Dr. Fresner Lee remains part of your care."* A patient asking for their nurse was confidently given
their doctor.

**New behaviour.** The answer resolves the role actually asked about (reusing
`resolveRequestedProfessional`), and lists the whole team when the whole team is asked for.
Verified: care manager → *Alicia Ramírez, RN*; cardiologist → *Dr. Pedro Martinez-Clark*.

---

## CHANGE-11 — "I cannot make it" was not an appointment intent

**Related tests:** L07, L09, ES08, U09 — **P2**
**Category:** INTENT_CLASSIFICATION

Every reschedule pattern required an appointment noun, so the ordinary way to ask for a different time
reached nothing. Added an `UNABLE_TO_ATTEND` group, checked **after** cancel so an explicit
cancellation still cancels, and **guarded by `ATTENDANCE_BARRIER`** so *"I can't go because I have no
ride"* remains a barrier to solve rather than a time to change.

---

## CHANGE-12 — Two blood-pressure targets, never reconciled

**Related tests:** Q09, CMP44, MT19.t2 — **P2**
**Category:** LOGIC / patient clarity

The care-team clinical target (<140/90) and the ACCESS control target (below 130 systolic) are
different things and both are correct, but EMMI named only the first while the care plan showed the
second. The answer now names both and says what each is for, reading both from the record.

---

## Knowledge base content

### New pages (9)

| Page | Answers | Sourced from |
|---|---|---|
| `programs/access-eligibility.md` | Who can take part, the condition list, no referral needed, MA excluded | Medicare.gov/ACCESS |
| `programs/access-with-other-programs.md` | CCM/RPM/PCM alongside ACCESS; the FFS exclusion is about billing, not the patient's care | CMS ACCESS Technical FAQ |
| `programs/access-while-away.md` | Travel, taking the monitor, visits from another state | Operational + honest limits |
| `care/privacy-and-data.md` | Who sees what, selling, HIPAA, Care Circle scope, and what cannot be confirmed | Medicare/HIPAA + policy gap |
| `care/getting-to-appointments.md` | Transportation as a barrier to record and escalate, never a ride to promise | Policy gap, stated as one |
| `care/blood-pressure-basics.md` | What hypertension is, what the numbers mean, what is generally discussed for lowering it | General education |
| `core/human-help-and-complaints.md` | Reaching a person; raising a concern | Operational |
| `core/using-the-app.md` | Login, links, video visits, camera, microphone, language, going back | Operational |
| `medicare/coverage-changes.md` | What changes when insurance changes, and why the amount must be re-verified | Medicare.gov |

### Existing pages given an English patient answer (22)

`medicare/`: medicare-basics, original-medicare, coinsurance-deductible-copay, medigap,
coordination-of-benefits, medicare-advantage, qmb · `programs/`: access, access-cost-sharing,
access-tracks, access-evaluation · `care/`: access-outcome-measures, access-a1c, care-plan,
medications, patient-goals, health-information · `enrollment/`: consent, personal-representative,
care-circle, enrollment, leaving-access · `company/` + `core/`: itera-health ×2, about-emmi ·
`devices/`: blood-pressure, rpm-devices · `safety/`: emergencies, clinical-safety,
clinical-escalation, prohibited-actions · `billing/`: expected-patient-payment

### Facts corrected or added from CMS research

See `research-findings.md` for the citation for each. Summary: the ACCESS acronym, authority and
dates; the qualifying condition list; Medicare Advantage exclusion; the $0–$7 and $13/month figures;
no charge for devices and no requirement to buy one; loan-or-ownership and possible return; voluntary
BYOD; the cancel-or-switch-after-90-days rule in the patient's own words; the 12-month comparison
group and 1-800-MEDICARE; the FFS exclusion and preserved beneficiary choice; QMB billing protection.

### Keyword coverage

Roughly 200 phrases added across 12 pages — every one a question a patient actually typed during the
audit, or its close neighbour, in English, Spanish and Haitian Creole. This closed 37 of the 106
"I don't have enough approved information" answers.

---

## Reindexing

The knowledge index is built once per process and cached (`server/emmiKnowledge.js`). It is a
**lexical** index, not embeddings, so there is nothing to re-embed — but **editing a Markdown file
does not take effect until the server process restarts**. This bit during the audit: a KB change
appeared to have no effect and the Spanish answer kept saying "en cualquier momento" until the dev
server was restarted. Any deployment that edits knowledge without restarting will serve the old
corpus. Recommended: call `resetKnowledgeIndex()` on deploy, or treat knowledge edits as requiring a
redeploy.

---

## Tests

`tests/emmiAuditRemediation.test.js` — 29 cases, one per finding, each using a question a patient
actually asked. Suite: **1058 → 1087 passing**, no test weakened or removed. Production build succeeds.
