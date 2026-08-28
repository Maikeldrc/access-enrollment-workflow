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

---

# How this knowledge base is wired (implementation)

## Where the code lives

This repository is a browser-only Vite prototype, not a NestJS service. The `.ts` files under
`src/emmi/{retrieval,tools,prompts}/` and `emmi.module.ts` / `emmi.service.ts` are the
**architectural reference package** that shipped with this knowledge base: their retriever
returns `[]` and their tools `throw new Error("Implement …")`. Nothing compiles them. The
working implementation reuses the existing runtime instead:

| Concern | Real implementation |
| --- | --- |
| Load, chunk, index, retrieve | `server/emmiKnowledge.js` |
| HTTP endpoint | `api/emmi/knowledge.js` + the dev middleware in `vite.config.js` |
| Model-facing tool | `searchKnowledge` in `src/emmi/tools.js` |
| Source hierarchy rules | `src/emmi/systemPrompt.js` |
| Patient runtime facts | the existing tools in `src/emmi/tools.js` |
| Locale | `src/emmi/messages.js` (`EN`/`ES`/`KR`, where **KR is Haitian Creole**) |

## Request flow

```
patient question (voice or text, same session)
  -> Gemini Live decides which tools to call
       -> patient tools  (getExpectedAccessCost, getAssignedDevice, ...)   authoritative
       -> searchKnowledge -> POST /api/emmi/knowledge                      explanation only
            -> classify intent + risk, rewrite query with program/screen
            -> filter + score chunks, dedupe by source, top 3-6
  -> answer in the patient's active locale
```

Voice and text share one session, one tool set and one knowledge layer. There is no separate
voice brain.

## Source priority

`SOURCE_PRIORITY` in `server/emmiKnowledge.js`, lowest number wins:
clinical safety rules → patient runtime → ITERA configuration → approved CMS knowledge →
**this knowledge base** → ITERA public information → general model knowledge.
On conflict the higher source wins; retrieved text never overrides a tool result.

## When a tool is required

`TOOL_FIRST_INTENTS` maps an intent to the tool that must answer it. A question only becomes
tool-first when the patient asks about **themselves** — "what is CCM?" is knowledge,
"am I enrolled in CCM?" is a tool. `mustNotAnswerAlone` covers clinical and medication safety,
which are never answered from Markdown regardless of phrasing.

## Adding a document

1. Drop a `.md` file in the right category folder.
2. Give it front matter: `id`, `title`, `category`, optional `program`, `audience`,
   `risk_level`, `requires_patient_context`, `requires_tool_when_personalized`, `version`,
   `last_reviewed`, `owner`.
3. `category` must match a folder name so intent and screen filters can find it.
4. Set `requires_tool_when_personalized: true` whenever a personalised version of the question
   needs runtime data.
5. Add a retrieval assertion in `tests/emmiKnowledge.test.js`.

`README.md`, `CHANGELOG.md` and `source-registry.md` are skipped by the indexer.

## Rebuilding the index

The index is built lazily per process and cached. Restart the dev server, or call
`resetKnowledgeIndex()`, after editing knowledge files. Serverless deployments rebuild on cold
start; there is no persistent index to invalidate.

## Updating CMS / Medicare content

Bump `version` and `last_reviewed`, and record the change in `CHANGELOG.md` and
`source-registry.md`. Metadata is parsed and returned with every passage so a stale document is
visible in the response and in logs.

## Testing locally

```bash
npx vitest run tests/emmiKnowledge.test.js
```

To exercise the endpoint against the dev server:

```bash
curl -s -X POST localhost:5173/api/emmi/knowledge -H 'Content-Type: application/json' -d '{"query":"What is CCM?"}'
```

## Security

The Markdown is read on the server only. It is never imported by client code, never copied into
`public/`, and `npx vite build` produces no `.md` and no knowledge strings in `dist/`. The
endpoint accepts only a query plus non-identifying `program` / `currentScreen`, and returns at
most six passages. Do not put PHI in these files.
