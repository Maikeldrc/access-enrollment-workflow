# EMMI Chat Knowledge Retest Results

Review date: 2026-08-29

## Automated retrieval retest

Command: `npx vitest run tests/emmiKnowledge.test.js`

Result: **PASS — 26/26 tests**.

| Concept | Exact question | Three paraphrases / variants | Neighbor checks | Result |
| --- | --- | --- | --- | --- |
| ACCESS overview | What is ACCESS? | What is this ACCESS thing?; What program did my doctor refer me to?; Can you explain ACCESS? | Existing ACCESS-vs-CCM and source-dedup tests | PASS |
| Comparison group | What is the comparison group? | Why was I randomly selected?; Why can’t I join for 12 months?; comparison-group wording in module | Overview and enrollment-rights retrieval | PASS |
| BP outcome | What is the ACCESS blood pressure target? | What does 15 mmHg improvement mean?; Is 137 my target if I started at 152?; “15 lower” wording in module | Device education and general ACCESS retrieval | PASS |
| Baseline labs | Why do you need A1c if I’m not diabetic? | A1c/diabetes wording; cholesterol/hypertension wording; goal distinction in module | BP and weight content in same governed source | PASS |
| Connected device | How do I use my monitor correctly? | Cuff/bare-skin/posture wording in module | Provider coordination assertion | PASS |

## Live UI retest

BLOCKED. The patient-visible app persisted an active emergency episode across panel close, page reload, tab replacement, and fresh prototype launch. Every unrelated question returned: “This may require urgent medical attention. Please call 911 or seek emergency care now.” There was no visible patient action to resolve the episode.

Because the primary certification method requires the visible chat UI, automated retrieval success is not counted as a post-enrichment conversational PASS. Post-enrichment UI pass rate is therefore **not certifiable**, not 100%.

## Regression status

- Knowledge loader/index behavior: PASS.
- Patient-specific tool-first tests: PASS.
- Safety-priority retrieval tests: PASS.
- PHI corpus check: PASS.
- Full repository test/build results are recorded in the certification report.
