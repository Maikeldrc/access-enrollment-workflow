# EMMI Knowledge

This directory is the server-side retrieval knowledge source.

## Strategy

- `core/emmi-master-knowledge.md` is the broad canonical knowledge document.
- Smaller topical documents are retrieval-friendly modules.
- Use front matter to support filtering, versioning and risk controls.
- Patient-specific facts must come from runtime tools, not static Markdown.

## Chunking guidance

Prefer semantic chunks of roughly 300–800 tokens with modest overlap.
Keep headings and front matter attached to each chunk.
Do not combine unrelated programs in one chunk.

## Update governance

For Medicare/CMS content, record:
- source URL or source registry ID,
- effective date,
- last reviewed date,
- owner,
- whether the content is patient-facing approved.

High-risk topics such as emergency guidance, medication changes, eligibility, beneficiary cost and legal authority require stricter review.
