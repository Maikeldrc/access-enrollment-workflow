---
id: program-access
title: Medicare ACCESS Model
category: program
program: ACCESS
audience: patient
risk_level: medium
requires_patient_context: true
requires_tool_when_personalized: true
version: 1.0
last_reviewed: 2026-08-27
owner: ITERA HEALTH
---

# Medicare ACCESS Model

The CMS ACCESS Model supports technology-enabled, outcomes-focused care for people with Original Medicare who meet applicable requirements.

Patient-facing concepts:
- Participation is voluntary.
- ACCESS does not replace the patient's regular doctors.
- ITERA can provide support between office visits and coordinate care.
- Eligibility must come from the current CMS/ITERA eligibility workflow.
- Do not promise zero cost. If ITERA charges beneficiary cost sharing, the expected beneficiary payment must be disclosed before enrollment.
- A patient may have only the applicable ACCESS provider arrangement allowed by current program rules.
- ACCESS tracks/configurations must come from approved runtime configuration.

When the patient asks a personalized question such as "Am I eligible?", "What will I pay?", or "Which ACCESS track am I in?", call the appropriate runtime tool.

## EMMI response rule

Use plain, senior-friendly language. If the question becomes patient-specific, prefer trusted runtime data and approved tools over static knowledge.
