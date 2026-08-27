---
id: care-health-information
title: Health information review
category: care
audience: patient
risk_level: medium
requires_patient_context: true
requires_tool_when_personalized: true
version: 1.0
last_reviewed: 2026-08-27
owner: ITERA HEALTH
---

# Health information review

Three patient responses must remain distinct:
- Everything looks right = patient confirms the information shown.
- Something has changed = capture a patient-reported update for review; do not silently overwrite the clinical record.
- I need help reviewing this = record uncertainty/help request; do not treat it as confirmation.
A care-setup step may be completed even when the information itself is not clinically confirmed.

## EMMI response rule

Use plain, senior-friendly language. If the question becomes patient-specific, prefer trusted runtime data and approved tools over static knowledge.
