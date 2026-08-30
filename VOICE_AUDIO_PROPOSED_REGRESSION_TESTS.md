# Proposed EMMI voice/audio regression tests

| Issue | Regression test | Level | Pass criterion |
|---|---|---|---|
| VA-001 | Patient-pilot deployment governance gate | CI/deploy | Non-prototype environment, approved audit backend and required policies are present |
| VA-002 | Live Home welcome golden-duration test | Live E2E | One greeting, no repeated invitation, one terminal question, all audio drains, duration under approved limit |
| VA-002 | Narration segment exactness test | Integration | Model output stays within an approved semantic/length tolerance per segment |
| VA-002 | Transcript turn-boundary test | E2E | Separate provider turns do not merge into one giant assistant bubble |
| VA-003 | Punctuated language confirmation table | Unit/E2E | `Sí.`, `Sí, por favor`, `yes.`, `wi.` and ASR variants switch once and preserve history |
| VA-004 | Multilingual patient-fact routing matrix | Unit/integration | Device/cost/team/appointment/medication/BP questions always call the required runtime tool or report unavailable |
| VA-005 | Anaphora chain | Integration | “What next?” → “why?” → “say that simply” stays on the same referent for 20 turns |
| VA-006 | 20-turn prerecorded voice suite | Live E2E | 20/20 captured, understood, answered, played and completed; no duplicate stream |
| VA-006 | Barge-in timing suite | Live E2E | median and p90 within approved SLA; stale audio count zero after stop |
| VA-006 | Senior speech/noise corpus | Live E2E/manual | Slow pauses, soft voice, hesitations, accents and practical noise remain usable |
| VA-006 | Long utterances | Live E2E | 15/30/45/60 s inputs preserve ending and full intent |
| VA-007 | Referring-provider direct-answer test | Integration | Names verified referring provider and clearly states continued involvement without inventing |
| VA-008 | Voice fingerprint/identity comparison | Manual + signal analysis | Sulafat identity, speed and language remain stable across all major screens/reconnect |
| VA-009 | Provider warning/deprecation monitor | CI/live | No new SDK deprecation or ephemeral-auth incompatibility warning |

Each live test should retain a redacted event trace with T0–T4, transcription, tool calls, audio chunk counts, playback drain, interruption events and browser/OS/device metadata. Audio retention requires explicit approved policy.
