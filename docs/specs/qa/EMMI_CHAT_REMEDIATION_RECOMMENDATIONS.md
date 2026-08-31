# EMMI Chat Remediation Recommendations

This document is diagnostic guidance only. It does not authorize or implement changes.

| Issue | Likely owning layer | Recommended investigation | Recommended remediation direction | Likely change types | Regression test |
|---|---|---|---|---|---|
| EQA-001 | Safety + conversation state | Trace safety episode creation, persistence, expiry, and topic-change behavior | Scope the emergency state to the relevant episode/turn; preserve escalation without overriding later benign intents | Safety fix, state/runtime fix, prompt clarification | Emergency → FAQ → context → appointment in EN/ES/KR |
| EQA-002 | Runtime tool + state routing | Compare journey event/status before and after eligibility verification | Require verified runtime status before stating eligibility outcome | Runtime tool fix, routing fix | Ask eligibility at Home, Eligibility, Success, Enrollment Complete |
| EQA-003 | I18N + routing | Compare intent IDs, locale normalization, retrieval queries, and fallback selection for Spanish vs English/Kreyòl | Repair Spanish semantic routing before adding knowledge; make fallback disclose uncertainty instead of repeating ACCESS overview | Routing fix, retrieval update; KB only if a later gap is proven | Spanish full intent suite with source assertions |
| EQA-004 | Screen context + I18N | Inspect current-screen tool/context injection and locale-specific context intent | Use one locale-neutral screen-help intent with translated response generation | Routing fix, runtime tool fix, prompt update | Required 13-screen trilingual matrix |
| EQA-005 | Device runtime | Inspect fulfillment request state/tool response immediately before and after request | Route request/shipping/tracking intents to canonical fulfillment state; distinguish unknown from not requested | Runtime tool fix, tool data fix, routing fix | Not requested → requested → shipped → delivered |
| EQA-006 | Barriers/support runtime | Verify selected barriers and generated interventions are persisted/exposed to EMMI | Add deterministic barrier/support lookup; separate support need from Care Circle intent | Runtime tool fix, routing fix, data fix if state is missing | Select three barriers, query exact list/support/goals/plan/NBA |
| EQA-007 | Care Plan + outcomes runtime | Compare active plan/outcomes endpoint with chat tool selection | Ground plan status, goals, numeric milestones, supports, care team, and next actions in runtime | Runtime tool fix, routing fix | Active-plan scenario with 152/88 and 204 lb derived assertions |
| EQA-008 | I18N governance | Run same-state traces in EN/ES/KR and compare classification/tool/retrieval | Introduce locale parity gates and shared intent/tool contracts | Routing fix, test coverage; translation update only if needed | Golden trilingual equivalence suite |
| EQA-009 | Cost policy/configuration | Identify canonical wording/value source for patient responsibility and supplement coverage | Preserve “up to” semantics; distinguish estimate, maximum, and confirmed responsibility | Tool data fix, policy clarification, prompt/config update | $0/up-to-$6/supplement-known/unknown cases |
| EQA-010 | Medication routing/retrieval | Compare successful medication-list tool path with purpose/change intents | Keep clinical boundaries; connect approved education and change-reporting workflow | Retrieval update, routing fix, possible KB update after gap confirmation | List/purpose/change/stop/double-dose matrix |
| EQA-011 | Conversation orchestration | Inspect how numbered/multi-intent utterances are parsed and completion is measured | Answer all items or explicitly ask to handle them one at a time | Prompt update, routing/orchestration fix | 2-, 5-, and 15-item completeness tests |
| EQA-012 | Safety policy | Review approved self-harm response requirements and available crisis resources | Add crisis-specific language/resources such as 988 where applicable while retaining 911 escalation | Safety fix, policy clarification, prompt update | Ideation/imminent plan/third-party/post-crisis suite |

## Recommended sequencing

1. **EQA-001 first:** the sticky safety state invalidates all subsequent conversational coverage.
2. **EQA-003, EQA-004, EQA-008:** repair Spanish routing/context parity before concluding that knowledge is missing.
3. **EQA-002, EQA-005, EQA-006, EQA-007:** enforce runtime grounding and state-transition correctness.
4. **EQA-009, EQA-010, EQA-012:** refine financial, medication, and crisis behavior against approved policy/content.
5. **EQA-011:** improve multi-intent completeness.
6. Re-run the entire 146-scenario suite plus the explicitly blocked Care Circle and fulfillment/appointment status cases.

## Change-type assessment

| Change type | Required now? | Basis |
|---|---|---|
| KB update | **Not yet proven** | Routing prevents reliable KB-gap diagnosis |
| Retrieval update | Likely | Relevant Spanish content rarely surfaces |
| Prompt update | Possible | Multi-intent handling and crisis wording |
| Runtime tool fix | Likely | Eligibility, device, barriers, plan and next-action grounding |
| Data fix | Unknown | UI contained correct baselines and plan data; tool exposure must be checked first |
| Routing fix | Yes | Dominant Spanish fallback and cross-domain response |
| Safety fix | Yes | Sticky emergency episode is a blocker |
| UI fix | Not indicated by this audit | The visible journey generally showed correct state; chat failed to use it |
| Policy clarification | Recommended | Cost responsibility and suicide-crisis response |

## Exit condition for a future remediation run

Do not close these issues solely because a single canned question passes. Closure should require:

- three natural paraphrases per formerly failed intent;
- exact pre/post state-transition checks;
- trilingual parity;
- a 20-turn topic-switching conversation;
- emergency recovery without losing safety priority;
- trusted runtime/tool evidence for every patient-specific answer;
- no fabricated shipment, appointment, eligibility, enrollment, or cost status.
