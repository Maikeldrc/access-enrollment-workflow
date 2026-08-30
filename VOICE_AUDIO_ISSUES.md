# EMMI voice/audio issues — OPEN — AUDIT

## Remediation status — 2026-08-29

- VA-002: RESOLVED — one bounded literal welcome turn; live Gemini regression passed.
- VA-003: RESOLVED — punctuation/case/natural affirmative normalization; unit and browser regression passed with `Sí.`.
- VA-004: RESOLVED — multilingual shipping intent now uses fulfillment runtime and never invents a date.
- VA-005: RESOLVED — repeat/simplify follow-ups resolve against the immediate assistant turn.
- Audio lifecycle sub-issue: RESOLVED — provider `turnComplete` no longer means audible completion; drain is measured separately and stale post-interruption transcripts are discarded.
- VA-006: PARTIALLY RESOLVED — deterministic virtual-mic/live-provider coverage added; physical device, acoustic noise/accent and non-Chromium runs remain required.
- VA-001: OPEN — operational governance, not an application voice-code defect.

## BLOCKER

### VA-001 — Real-patient production authorization is absent

- Severity: BLOCKER
- Area: privacy / operations / release readiness
- Browser/language/screen: all
- Preconditions: real Medicare patient use
- Expected: approved production data handling, audit storage, retention/access controls, consent/privacy and clinical validation
- Actual: repository explicitly identifies fictional fixtures and a prototype-only audit/token boundary; real-patient configuration is rejected
- Reproduction: 100% by configuration/source review
- Root-cause hypothesis: prototype has not completed production governance and backend integration
- Confidence: high
- Owner: platform/security/clinical governance
- Patient/safety impact: real patient data cannot be responsibly certified on this deployment
- Future remediation: complete governance, encrypted audit service, access control, retention/redaction, privacy/consent and clinical validation
- Regression: deployment policy test that fails if prototype mode is used for a patient-pilot environment
- Status: OPEN — AUDIT

## CRITICAL

No verified secret leak, cross-patient leak, false enrollment claim or unsafe emergency response was observed. Critical gates remain incompletely tested.

## HIGH

### VA-002 — Initial spoken welcome expands into a repetitive ~40-second monologue

- Area: conversation / audio completion / senior UX
- Browser: in-app Chromium; language: EN; screen: Home
- Steps: fresh Home; select Guide by voice; open transcript during/after output
- Expected: one concise, complete welcome, then listening
- Actual: multiple expanded explanations/questions, repeated invitations and duplicated “What would you like to do?”; transcript initially ended at “What are” and later grew to a very long combined message
- Reproduction: 2/2 live starts produced expanded/repeated guidance; first observed end-to-listening was ~40 s
- Logs: no app error; SDK experimental-token warning only
- Root cause: semantic segments are individually sent to a generative model with permission to render natural speech; each segment is elaborated. UI merges consecutive assistant voice transcriptions across separate turns.
- Confidence: high
- Owner: `src/emmi/transitionManager.js`, `src/app.js` guidance prompt/transcript aggregation
- Impact: older patients wait too long, hear repetitive prompts and cannot tell when to respond
- Remediation: constrain narration to exact/near-exact utterance; define one terminal question; preserve explicit turn boundaries; measure output duration
- Regression: live welcome word/duration/terminal-question contract
- Status: OPEN — AUDIT

### VA-003 — Natural Spanish confirmation with punctuation does not switch locale

- Area: language / continuity
- Steps: ask “Prefiero hablar en español.”; answer “Sí.”
- Expected: same conversation continues in ES
- Actual: EMMI answered again in English and remained EN. Retrying exact lowercase `sí` switched successfully.
- Reproduction: 1/1 for `Sí.`; control 1/1 for `sí`
- Root cause: confirmation matcher appears insufficiently punctuation-normalized
- Confidence: high
- Owner: language detection/confirmation parser
- Impact: common natural speech transcription can fail language switch
- Remediation: normalize punctuation/case/whitespace and accept natural affirmative variants
- Regression: EN→ES with `Sí.`, `Sí, por favor`, ASR punctuation and capitalization
- Status: OPEN — AUDIT

### VA-004 — Spanish device-shipping question bypasses patient runtime grounding

- Area: tool routing / patient facts / multilingual parity
- Steps: switch to ES; ask “¿Cuándo me van a enviar el monitor?”
- Expected: call device runtime and report known status, or clearly state it cannot retrieve it
- Actual: generic definition of ACCESS; no device-specific answer
- Reproduction: 1/1
- Root cause: multilingual intent pattern/router does not recognize this natural Spanish formulation before knowledge fallback
- Confidence: medium-high
- Owner: text intent routing/tool dispatch; verify equivalent Gemini Live tool selection
- Impact: patient cannot obtain operational device status; creates risk of misleading omission
- Remediation: language-independent intent classification and mandatory runtime tool policy for patient-specific nouns/status verbs
- Regression: EN/ES/KR device ordered/shipped/unknown/status matrix
- Status: OPEN — AUDIT

### VA-005 — Immediate follow-up loses conversational referent

- Area: multi-turn context
- Steps: ask what happens next; then “Can you explain that more simply?”
- Expected: simplify the just-provided next step
- Actual: reset to generic ACCESS explanation
- Reproduction: 1/1
- Root cause: retrieval/query routing does not resolve anaphora against the latest assistant turn
- Confidence: medium
- Owner: text orchestrator / conversation summary
- Impact: conversation feels discontinuous and forces patients to repeat themselves
- Remediation: resolve follow-up referents from recent turns before intent/retrieval fallback
- Regression: that/it/why/repeat/simplify chains over 5–20 turns
- Status: OPEN — AUDIT

### VA-006 — Required live barge-in and 20-turn audio evidence is unavailable

- Area: certification coverage
- Actual: a system-TTS acoustic attempt was suppressed/not transcribed; no controlled microphone injection or audible-output capture was exposed in the selected browser
- Impact: cutoff, overlap, soft/slow speech, noise, accents and barge-in cannot be certified
- Remediation: provide a QA audio harness/virtual mic plus output loopback and event timestamps in a safe non-patient environment
- Status: OPEN — AUDIT

## MEDIUM

### VA-007 — Referring-doctor answer is indirect and repetitive

“Will I still see Dr. Fresner?” repeated the preceding generic ACCESS paragraph. It preserved the broad fact that regular doctors remain involved but did not directly answer with the known referring-doctor context. Owner: text orchestrator/knowledge routing. Status: OPEN — AUDIT.

### VA-008 — Voice identity and cross-browser stability are asserted more than audibly proven

Canonical `Sulafat` is enforced in code and unit tests, but audible consistency across every requested screen, reconnect, Edge and WebKit was not sampled. Status: OPEN — AUDIT.

## LOW

### VA-009 — Gemini ephemeral-token experimental warning in production console

One provider SDK warning is emitted. No functional failure accompanied it, but dependency/API stability should be monitored. Status: OPEN — AUDIT.
