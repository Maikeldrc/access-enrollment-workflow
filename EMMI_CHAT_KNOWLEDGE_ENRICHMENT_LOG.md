# EMMI Chat Knowledge Enrichment Log

Review date: 2026-08-29

## Source-governed changes

| File | Concept | Official source | Version | Retrieval test added | Before | After |
| --- | --- | --- | --- | --- | --- | --- |
| src/emmi/Knowledge/programs/access-beneficiary-overview.md | ACCESS definition, duration, Original Medicare, doctors, RPM/CCM distinction | CMS ACCESS Model; Medicare.gov ACCESS | 1.0 | Overview paraphrases | Generic short overview only | Focused beneficiary module |
| src/emmi/Knowledge/programs/access-eligibility-tracks.md | eCKM eligibility, multiple tracks, comparison group | CMS Technical FAQs; RFA | 1.0 | Comparison-group paraphrases | Missing | Focused eligibility module |
| src/emmi/Knowledge/programs/access-enrollment-rights.md | Consent, enrollment state, 90-day rights, care period | Medicare.gov; CMS ACCESS | 1.0 | Neighbor retrieval through ACCESS suite | Incomplete | Focused rights module |
| src/emmi/Knowledge/programs/access-eckm-outcomes.md | BP, weight, A1c and LDL-C semantics | CMS Payment Amounts and Performance Targets v10 | 1.0 | BP arithmetic and baseline-lab assertions | Missing | Focused outcome module |
| src/emmi/Knowledge/programs/access-provider-coordination.md | Initiation/escalation/completion updates | CMS PCP/referring clinician guidance | 1.0 | Provider update assertion | Missing | Focused coordination module |
| src/emmi/Knowledge/devices/access-connected-bp-monitor.md | Device purpose, loan/return, technique, monitoring limits | Medicare.gov; CDC; AHA | 1.0 | Device technique assertion | Scattered/general device content | ACCESS-specific module |
| src/emmi/Knowledge/programs/access-cost-sharing.md | Low/no-cost context and no outcome penalty | Medicare.gov; CMS ACCESS | 1.1 | Existing cost grounding tests retained | Missing current general framing | Updated without patient amount |
| src/emmi/Knowledge/source-registry.md | Source governance records | All sources above | registry | Metadata exercised by loader tests | Template only | URLs, dates, review status, owner |
| src/emmi/Knowledge/CHANGELOG.md | Change governance | Repository governance | 2026-08-29 | n/a | Initial entry only | Enrichment recorded |

All content is concise paraphrase. No PHI or golden-patient fixture value was added. The arithmetic example 152 → 137 is a benchmark explanation, never asserted as this patient's baseline.
