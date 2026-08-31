# EMMI Chat Knowledge Gaps

Review date: 2026-08-29

## Root-cause summary

| Domain | Evidence | Classification | Correct owner |
| --- | --- | --- | --- |
| ACCESS explanatory coverage | Baseline KB had one short overview and lacked track, comparison-group, outcome, baseline-lab, coordination, and device-technique detail. | FAIL_KB_MISSING | Source-governed static KB |
| Deterministic fallback | Local inspection showed fallbackKnowledgeAnswer returns the generic ACCESS paragraph whenever ACCESS is named, even when retrieval selected a focused passage. | FAIL_RETRIEVAL / FAIL_ROUTING | Response orchestration |
| Enrollment status | “Am I enrolled now?” returned the overview both before and after consent, while screen help correctly distinguished states. | FAIL_TOOL_NOT_CALLED | getEnrollmentContext route |
| ACCESS cost | Consent UI showed $6/month; getExpectedAccessCost repeatedly asserted verified $0 and supplemental coverage. | FAIL_TOOL_DATA | Financial responsibility/runtime fixture |
| Safety lifecycle | A high-reading turn created activeSafetyEpisode; later unrelated turns and fresh launches inherited emergency-only responses. | FAIL_SAFETY | Conversation/safety policy lifecycle |
| Device, appointment, goals, medications, care team | Patient-specific questions must be runtime-grounded and cannot be repaired in Markdown. | BLOCKED or FAIL_TOOL_NOT_CALLED | Runtime and operational routing |

## Demonstrated static knowledge gaps

- ACCESS full name, model duration, Original Medicare/non-insurance framing, and distinction from RPM/CCM.
- eCKM eligibility, hypertension-alone qualification, multiple-track rules, eCKM-versus-CKM, and one provider per track.
- Comparison-group purpose and 12-month effect while Medicare remains unchanged.
- Consent, eligibility-versus-enrollment, 90-day switching/disenrollment, and care-period duration.
- eCKM BP control/improvement semantics, weight outcome, and A1c/LDL baseline applicability.
- Required care updates without promising every raw reading is seen immediately.
- Connected-device purpose, possible loan/return, non-continuous monitoring, and CDC/AHA measurement technique.
- Patient outcome performance does not create an extra patient charge or loss of Medicare benefits.

## Paraphrase/generalization set

| Concept | Canonical | Paraphrase 1 | Paraphrase 2 | Paraphrase 3 |
| --- | --- | --- | --- | --- |
| ACCESS overview | What is ACCESS? | What is this ACCESS thing? | What program did my doctor refer me to? | Can you explain this care option? |
| Comparison group | What is the comparison group? | Why was I randomly selected? | Why can’t I join for 12 months? | Did I do something wrong? |
| BP outcome | What is the ACCESS BP target? | What does 15 lower mean? | Is 137 my target if I started at 152? | Does the bottom number count too? |
| Baseline labs | Why do you need A1c? | Why a diabetes test if I’m not diabetic? | Why cholesterol if I joined for BP? | Are those actually my goals? |
| Device status | Has my monitor shipped? | Is the pressure machine on the way? | Did you send the cuff yet? | Where is my device? |
| Cost | What will I pay? | Is this going to cost me anything? | Am I getting a bill? | How much comes out of my pocket? |

## Non-KB remediation boundaries

No patient fixture, enrollment state, device status, medication, doctor, appointment, goal, cost amount, or safety classification was added to static Markdown. The unresolved defects must remain owned by runtime, routing, or safety policy.
