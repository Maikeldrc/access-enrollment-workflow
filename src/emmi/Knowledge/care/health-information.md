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
keywords: informacion de salud, información de salud, health information, enfòmasyon sante, mi informacion, mi información, expediente, record, dosye, correcto, cambio, chanje
---

# Health information review

Three patient responses must remain distinct:
- Everything looks right = patient confirms the information shown.
- Something has changed = capture a patient-reported update for review; do not silently overwrite the clinical record.
- I need help reviewing this = record uncertainty/help request; do not treat it as confirmation.
A care-setup step may be completed even when the information itself is not clinically confirmed.

## EMMI response rule

Use plain, senior-friendly language. If the question becomes patient-specific, prefer trusted runtime data and approved tools over static knowledge.

## Patient answer (ES)

Cuando le mostramos su información de salud, usted tiene tres respuestas posibles y las tres son válidas: que todo está correcto, que algo cambió, o que no está seguro. Si dice que algo cambió, se registra como algo que usted reportó para que su equipo lo revise — no se sobrescribe su expediente clínico de forma automática. Y si no está seguro, su equipo puede revisarlo con usted.

## Patient answer (KR)

Lè nou montre ou enfòmasyon sante ou, ou gen twa repons posib epi tou lè twa valab: tout bagay kòrèk, yon bagay chanje, oswa ou pa sèten. Si ou di yon bagay chanje, yo anrejistre l kòm yon bagay ou rapòte pou ekip ou revize — yo pa ranplase dosye klinik ou otomatikman. Epi si ou pa sèten, ekip ou ka revize l avèk ou.
