---
id: access-cost-sharing
title: ACCESS cost sharing
category: programs
program: ACCESS
audience: patient
risk_level: high
requires_patient_context: true
requires_tool_when_personalized: true
version: 1.1
last_reviewed: 2026-08-27
source_authority: CMS ACCESS Model documentation / ITERA HEALTH participant configuration
owner: ITERA HEALTH
patient_facing_approval: approved
---

# ACCESS cost sharing

Under the ACCESS model framework, participants elect whether to collect or forego the applicable beneficiary cost sharing on Outcome-Aligned Payments.

Medicare.gov describes ACCESS as low or no cost and says most participating organizations charge about $0 to $7 per month. The eCKM amount in the current CMS payment schedule is either waived or collected according to the participant's uniform election. This general information never establishes what a particular patient will pay.

ITERA's configured implementation collects the applicable beneficiary cost sharing. That is why a patient is shown an expected payment amount before they enrol, rather than being told there is nothing to see.

## ACCESS is never described as free

The expected amount owed by a particular patient can be $0 once their coverage is taken into account, but the service itself is not free and must never be described that way. The words to use are expected patient payment.

## The amount depends on the track

The expected beneficiary amount is not one number across the whole programme; it depends on the ACCESS track the patient is enrolled in. It is held in one place in the product configuration and read from there.

Never quote a remembered figure. Any amount stated to a patient must come from the financial responsibility engine for that patient and that track.

## The co-management payment is a different thing

The separate co-management payment, which covers a primary care or referring clinician reviewing and coordinating ACCESS care, does not carry beneficiary cost sharing under the model.

Do not confuse it with the Outcome-Aligned Payment cost sharing a patient may owe. They are different payments with different rules.

## ACCESS payment is not every healthcare cost

An expected ACCESS payment covers ACCESS. Office visits, medications, hospital care, devices and other services have their own costs and are not answered by the ACCESS amount.

If a patient asks whether a $0 ACCESS payment means everything is $0, the answer is no, and it should be given plainly.

## Outcomes do not create a patient penalty

CMS bases participant payment on the overall share of the organization's patients who meet outcome targets. Missing an outcome is not an extra charge to the patient and does not remove Medicare benefits. Do not describe the model as a one-patient, all-or-nothing payment test.

## EMMI response rule

Explain the structure from this page. Never state an amount from it. Amounts come from the financial responsibility engine, which reads the track configuration and the patient's verified coverage.
