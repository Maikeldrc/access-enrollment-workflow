# Authoritative research — CMS, Medicare and the ACCESS Model

Every regulatory statement added to the knowledge base during this audit is listed here with the
source that supports it. Nothing in this file was answered from model memory: each fact was read from
a CMS or Medicare page during the audit. CMS.gov blocks automated fetching, so the pages were opened
in a browser and read directly.

**Accessed:** 31 August 2026. **Tier 1 sources only** (CMS.gov, Medicare.gov).

| Source | URL | Last updated |
|---|---|---|
| ACCESS (Advancing Chronic Care with Effective, Scalable Solutions) Model | https://www.cms.gov/priorities/innovation/innovation-models/access | 12 Aug 2026 |
| ACCESS Technical Frequently Asked Questions | https://www.cms.gov/priorities/innovation/access-technical-frequently-asked-questions | — |
| Support for chronic health conditions (beneficiary page) | https://www.medicare.gov/ACCESS | — |
| Medicare Savings Programs | https://www.medicare.gov/basics/costs/help/medicare-savings-programs | — |

---

## 1. What ACCESS is, and who runs it

**Tests:** A02, A04, A05, PH03, PH04, PH05, PH06, RG103, RG104
**EMMI's original answer:** For "What does ACCESS stand for?" EMMI returned the general ACCESS
definition without the expansion; for "Who created this program?" it returned the QMB page.
**Problem:** The knowledge base never stated the acronym, the authority, or the dates.
**Confirmed:** ACCESS stands for **Advancing Chronic Care with Effective, Scalable Solutions**. It is
a model of the **CMS Innovation Center**, tested under section 1115A of the Social Security Act. It
**began 5 July 2026** and runs for **10 years**. It tests an outcome-aligned payment approach in
**Original Medicare**.
**Source:** CMS ACCESS Model page.
**Confidence:** High. **KB change:** `programs/access.md`.

## 2. Beneficiary eligibility

**Tests:** C01–C14, PH58, PH59, RG04
**EMMI's original answer:** The QMB page, the EMMI identity page, or the general ACCESS page.
**Confirmed:** Open to **anyone with Original Medicare** who has one or more of: high blood pressure,
high cholesterol (dyslipidemia), obesity, prediabetes, diabetes, chronic kidney disease, heart
disease (ASCVD), depression, anxiety, ongoing muscle or joint pain — and Medicare notes more may be
added. **No referral is required**; a beneficiary contacts an approved organization directly. Someone
with more than one condition **may work with more than one organization**.
**Source:** Medicare.gov/ACCESS, "Who can sign up?" and "How do I sign up?".
**Confidence:** High. **KB change:** new `programs/access-eligibility.md`.

## 3. Medicare Advantage is excluded

**Tests:** C05, S01, S02, CMP05, PH11, PH12, RG66
**Confirmed:** *"If you have a Medicare Advantage Plan (Part C) you can't use this care option, but
your plan may offer something similar. Contact your plan to find out what's available."* Being in a
Medicare Advantage plan is also listed as one of three reasons a person may not be able to use ACCESS.
**Source:** Medicare.gov/ACCESS.
**Confidence:** High. **KB change:** `medicare/medicare-advantage.md`, new `medicare/coverage-changes.md`.

## 4. What a beneficiary pays

**Tests:** D01–D18, CMP12, CMP21, CMP41, PH01, PH02, PH26, RG05–RG10
**EMMI's original answer:** The tool-grounded route was correct ($0 expected for this patient); every
knowledge-grounded cost question returned an internal instruction such as *"Never say a Medicare
service is automatically free."*
**Confirmed, three separate facts:**
1. Medicare describes ACCESS as **available at low or no cost**; **most organizations charge between
   $0 and $7 per month**, and a single organization helping with multiple conditions **cannot charge
   more than $13 per month in total**. *(Medicare.gov/ACCESS, "What will I pay?")*
2. Participants may **elect to collect or forego** beneficiary cost sharing on Outcome-Aligned
   Payments, using the CMS-sponsored model patient incentive safe harbor at **42 CFR § 1001.952(ii)(2)**.
   The policy must be applied **uniformly to all beneficiaries**, and a participant that collects
   **must clearly disclose the expected beneficiary payment amount before enrollment**. *(CMS ACCESS
   Technical FAQ)* — this is the regulatory basis for the disclosure the enrollment flow already shows.
3. There is **no beneficiary cost sharing on the separate co-management payment** billed by a primary
   care or referring clinician for reviewing and coordinating ACCESS care. *(CMS ACCESS Technical FAQ)*
**Confidence:** High. **KB change:** `programs/access-cost-sharing.md`.

## 5. Devices — who pays, who owns, and returning them

**Tests:** D17, P08, P09, P10, P11, PH24, PH25, PH26, RG53–RG56
**EMMI's original answer:** Before remediation, internal measurement rules. After the model layer was
restored but before this fact was added, EMMI **invented** *"No, you do not have to give the monitor
back. The monitor is yours to keep"* and *"No, you will need to use the blood pressure monitor
provided"* — both contradicted by CMS.
**Confirmed:** Participants may furnish items including devices **on either a loan or ownership
basis, at the participant's discretion**, and items **may be recovered at the conclusion of care or
upon disenrollment**. Beneficiary-owned devices may be integrated on a **voluntary bring-your-own-
device basis**. Participants **may not require a beneficiary to purchase, rent or otherwise obtain
any clinical item out of pocket** as a condition of alignment, and **may not separately bill or
charge beneficiaries for items furnished as part of ACCESS care**. Medicare's beneficiary page puts
it plainly: *"You may need to return the items later, but you won't have to pay to use them."*
**Source:** CMS ACCESS Technical FAQ; Medicare.gov/ACCESS.
**Confidence:** High. **KB change:** `devices/rpm-devices.md`, `devices/blood-pressure.md`.

## 6. Leaving, switching, and the 90 days

**Tests:** B07, B08, B11, B12, Q04, PH07, PH08, RG105, ES04
**EMMI's original answer:** An internal instruction — *"Never tell a patient they can leave whenever
they want…"* — shown verbatim. After the model layer was restored, EMMI twice said in Spanish that a
patient could leave *"en cualquier momento"*, which is the exact error that instruction exists to
prevent.
**Confirmed:** *"Care is available on an ongoing basis for most conditions, but you don't have to keep
using this care option. **You can cancel or switch organizations after your first 90 days.**"* and
*"Signing up for this care option is part of your Medicare benefits. You don't lose any coverage."*
**Source:** Medicare.gov/ACCESS.
**Confidence:** High. **KB change:** `enrollment/leaving-access.md` (patient answer plus keyword
coverage so the page is actually reached).

## 7. The evaluation comparison group

**Tests:** B06, CMP36, PH52, PH53, RG92
**Confirmed:** Because the payment approach is being tested, a small share of applicants to a track
are **randomly assigned to a control group** for that track. *"If you're randomly assigned to this
group, you won't be able to use this care option for 12 months."* CMS adds that control-group
individuals **continue to have full access to all regular Medicare services**, and Medicare.gov gives
patients **1-800-MEDICARE (1-800-633-4227), TTY 1-877-486-2048** for questions.
**Source:** Medicare.gov/ACCESS; CMS ACCESS Technical FAQ.
**Confidence:** High. **KB change:** `programs/access-evaluation.md`.

## 8. ACCESS alongside CCM, RPM, PCM and other care management

**Tests:** R01–R07, CMP18, PH27, PH28, PH29, RG64, RG65
**EMMI's original answer:** The general ACCESS page, the CCM page, or "I don't have enough approved
information" — never an answer to the actual question, which is always some form of *will this cost
me twice or take something away*.
**Confirmed:** ACCESS is an **alternative to fee-for-service billing** for an aligned beneficiary, not
an addition to it. An ACCESS participant and its affiliates **may not submit Medicare FFS claims for
other services** furnished to a beneficiary aligned with them during an active care period; only
ACCESS G-codes may be billed by that organization for that patient. Critically for the patient-facing
answer, CMS states: *"Beneficiary choice is preserved in the ACCESS Model. Beneficiaries remain free
to seek care from other health care providers, who may continue to bill Medicare for their services
under standard rules."* The restriction is on **one organization's billing**, never on the patient's
care.
**Source:** CMS ACCESS Technical FAQ ("FFS Exclusion").
**Confidence:** High. **KB change:** new `programs/access-with-other-programs.md`.

## 9. QMB billing protections

**Tests:** C07, D12, CMP21, PH56, RG10, RG91
**Confirmed:** For someone in the Qualified Medicare Beneficiary program, *"Medicare providers aren't
allowed to bill you for services and items Medicare covers, including deductibles, coinsurance, and
copayments."* A small Medicaid copayment may still apply. QMB also helps pay Part A and Part B
premiums, deductibles, coinsurance and copayments.
**Source:** Medicare.gov, Medicare Savings Programs.
**Confidence:** High. **KB change:** `medicare/qmb.md`.

## 10. Part B cost sharing

**Tests:** D05, D15, D16, MT17.t1, RG08, RG09
**Confirmed:** Original Medicare is Part A (hospital) and Part B (medical). For most Part B services
Medicare pays its share after the deductible and the beneficiary is responsible for the rest —
commonly described as 20% coinsurance — unless other coverage (Medigap, Medicaid, QMB) pays it.
**Source:** Medicare.gov Medicare Savings Programs and Original Medicare pages.
**Confidence:** High. **KB change:** `medicare/coinsurance-deductible-copay.md`, `medicare/original-medicare.md`.

## 11. ACCESS does not replace the patient's own clinicians

**Tests:** A10, A11, A12, CMP39, RG03
**Confirmed:** *"Using this care option doesn't replace your existing health care providers. You'll
keep your primary care provider and specialists. Some organizations may be able to coordinate the
support you get from them with your existing providers."* CMS additionally requires participants to
identify the patient's PCP and referring clinicians and share standardised updates at initiation,
completion and clinical milestones.
**Source:** Medicare.gov/ACCESS; CMS ACCESS Technical FAQ.
**Confidence:** High. **KB change:** `programs/access.md`, `company/itera-health.md`.

---

## Questions where research established that no public answer exists

These were checked against the same sources and are **not** answerable from CMS or Medicare material.
They are ITERA operational decisions and are listed in `internal-policy-gaps.md`. The knowledge base
now says so explicitly rather than letting the model fill the gap.

| Question | Tests | Why no public answer |
|---|---|---|
| Who pays for transportation to an appointment, and is any provided? | M04, M06, M07, PH23 | Not a Medicare benefit under ACCESS and not described by CMS. |
| What hours the care team is reachable, and how fast a callback comes | G08, CMP35, PH59 | Operational commitment, not a model rule. |
| How many blood-pressure readings a patient should take | P07 | Clinical configuration set per care plan. |
| Whether a patient in hospice, a nursing home or assisted living may take part | C11, C12, C13 | Medicare lists three exclusion reasons and none of these is among them; absence is not permission. |
| Whether a patient with only Part A, or only Part B, qualifies | C03, C04 | Medicare states the requirement as "Original Medicare" and publishes no rule for a partial holding. |
| What to bring to a visit, arrival time, lateness | L08, L12, L13 | Practice-level, not model-level. |
| How the EMMI conversation itself is stored, and who can read it back | F03, F04, PH16 | ITERA data-handling policy; not established anywhere in the product. |
