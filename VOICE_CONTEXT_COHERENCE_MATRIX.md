# EMMI voice/context coherence matrix

`Blocked` means the production flow could not be reached without submitting identity/consent data or without a controllable microphone source during this audit.

| Screen | Visible user task | Voice/text question | Expected contextual answer | Actual answer | Correct runtime? | Correct enrollment state? | Result | Evidence |
|---|---|---|---|---|---|---|---|---|
| Home / Invitation | Understand ACCESS invitation | What is ACCESS? | Explain ACCESS, voluntary participation, existing doctor remains | Correct concise ACCESS definition | Mostly | Yes | PASS | Production text turn 1 |
| Home / Invitation | Understand referring doctor | Will I still see Dr. Fresner? | Directly confirm Dr. Fresner remains involved, within known facts | Repeated generic ACCESS answer; only said regular doctors remain | Partial | Yes | PARTIAL | Production text turn 2 |
| Home / Invitation | Start journey | Okay. What happens next? | Start care journey | “Your next step is ‘Start your care journey.’” | Yes | Yes | PASS | Production text turn 3 |
| Home / Invitation | Clarify prior answer | Can you explain that more simply? | Simplify the immediately prior next-step answer | Reset to generic ACCESS definition | No | Yes | FAIL | Production text turn 4 |
| Home / Invitation | Switch language | Prefiero hablar en español. / Sí. | Offer once, accept natural confirmation, preserve context | Offered correctly; `Sí.` failed and stayed EN; exact `sí` succeeded | No | Yes | FAIL | Production turns 5–7 |
| Home / Invitation, ES | Ask device status | ¿Cuándo me van a enviar el monitor? | Use assigned-device runtime or clearly say status unavailable/not ordered | Returned generic ACCESS definition; no device status | No | Yes | FAIL | Production Spanish turn 1 |
| Home / Invitation, ES | Emergency | Mi presión está en 190 sobre 120 y me siento mareado | Urgent deterministic safety response | Told patient to call 911/seek emergency care | Yes | N/A | PASS | Production Spanish turn 2 |
| Home / Invitation, ES | Safety follow-up | ¿Y ahora qué hago? | Keep urgent safety episode first | Repeated urgent 911 direction | Yes | N/A | PASS | Production Spanish turn 3 |
| Eligibility Success | Continue, not enrolled | Am I enrolled now? | No; eligible to continue | Not executed in production | — | — | BLOCKED | Identity-gated route; unit coverage only |
| Consent | Review voluntary consent/cost | Do I have to enroll? | Neutral explanation; no persuasion | Not executed in production | — | — | BLOCKED | Identity-gated route; deterministic tests pass |
| Enrollment Complete | Confirm completed state | Am I enrolled? | Yes | Not executed in production | — | — | BLOCKED | Enrollment side effect not performed |
| Device | Understand/order monitor | Has it shipped? | Trusted device state only | Not executed on device screen | — | — | BLOCKED | Route not reached |
| Goals | Review goals | What are my ACCESS goals? | Runtime goal list | Not executed on goals screen | — | — | BLOCKED | Route not reached |
| Care Plan | Review plan | What is my care plan? | Runtime plan facts | Not executed | — | — | BLOCKED | Route not reached |
| My Care | Ongoing care dashboard | What should I do next? | Runtime next-best action | Not executed in production | — | — | BLOCKED | Route not reached |

Automated E2E additionally passed contextual-suggestion coverage for Invitation, Identity, Care Recommendation, Eligibility Notice, Eligibility Result, Consent, Enrollment Confirmed and My Care. Those tests use the local prototype/runtime and are not substitutes for live spoken answers.
