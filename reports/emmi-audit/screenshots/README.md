# screenshots/

Empty by design, and worth one paragraph rather than an unexplained empty folder.

The browser automation available in this environment renders pages and returns screenshots into the
working session for inspection, but offers no way to write image files into the repository, and its
sandbox blocks page-initiated downloads of binary content. Screenshots were taken and reviewed
throughout the audit; they could not be persisted here.

What replaces them is stronger for these findings: the verbatim answer text with its full routing
trace for every one of the ~1,000 interactions.

- `../evidence/critical-failures-before-after.md` — all 27 critical failures, before and after
- `../evidence/internal-instruction-leaks.md` — the 31 distinct internal texts patients were shown
- `../raw-transcripts.jsonl` / `../raw-transcripts-after.jsonl` — every turn with intent, response
  mode, tools called and retrieved chunks
- `../emmi-before-after.csv` — both answers side by side per test id

To reproduce any result visually, run the app locally, open EMMI, and ask the question in the
`patient_question` field of the matching JSONL line.
