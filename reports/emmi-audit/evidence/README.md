# Evidence

## What is here

| File | Contents |
|---|---|
| `critical-failures-before-after.md` | All 27 baseline critical failures, verbatim question and answer, before and after |
| `internal-instruction-leaks.md` | The 31 distinct internal texts patients were shown in the baseline |
| `../raw-transcripts.jsonl` | All 473 baseline turns with trace (intent, mode, tools, retrieved chunks) |
| `../raw-transcripts-after.jsonl` | All 534 after-remediation turns with trace |
| `../emmi-before-after.csv` | Both answers side by side per test id |
| `../raw/baseline-export.json`, `../raw/after-export.json` | The raw captures the reports are computed from |
| `../raw/qa-harness.js` | The harness used to drive the real chat composer |
| `../kb-backup/Knowledge/` | The knowledge base as it stood before any change (52 files) |

## On screenshots

The audit brief asks for screenshots in `screenshots/`. They are not here, and it is worth being
precise about why rather than leaving an empty folder.

The browser automation available in this environment renders the page and returns screenshots **into
the session** for inspection, but provides no path to write image files to the repository, and its
sandbox blocks page-initiated downloads of binary content. Screenshots were taken and reviewed
throughout the audit — the invitation screen, the consent screen with the $0 disclosure, the EMMI panel
with its "not a clinician, for emergencies call 911" footer, the 911 response with its Call 911 button,
and the Spanish panel displaying the English internal instruction *"Never tell a patient they can leave
'whenever they want'…"* — but they could not be persisted.

What is preserved instead is the **verbatim answer text with its full routing trace for every one of
the ~1,000 interactions**. For the findings in this audit that is the stronger record: a screenshot of
*"Never determine QMB status from a generic eligibility string alone"* shows that it happened once;
`raw-transcripts.jsonl` shows it happened on 62 turns, which question produced each one, which document
was retrieved, and what score it won on.

To reproduce any single result visually: run the app locally, open EMMI, and ask the question in the
`patient_question` field of the corresponding JSONL line.
