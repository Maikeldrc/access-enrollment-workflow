---
id: program-rpm
title: Remote Patient Monitoring (RPM)
category: program
program: RPM
audience: patient
risk_level: medium
requires_patient_context: true
requires_tool_when_personalized: true
version: 1.0
last_reviewed: 2026-08-27
owner: ITERA HEALTH
---

# Remote Patient Monitoring (RPM)

Remote Patient Monitoring (RPM) uses connected medical devices to send physiologic information, such as blood pressure, to support ongoing care.

Patient-facing concepts:
- RPM is not an emergency service.
- Device assignment and connection status must come from runtime.
- ITERA currently supports approved connected device workflows such as Tenovi and Pylo where configured.
- A patient-owned monitor may still be useful personally, but it must not be represented as connected to ITERA unless verified.
- Never tell a patient that a reading was received unless the actual observation/source confirms it.

## EMMI response rule

Use plain, senior-friendly language. If the question becomes patient-specific, prefer trusted runtime data and approved tools over static knowledge.
