# ITERA HEALTH Patient Enrollment

Mobile-first patient enrollment portal for configurable CCM, RPM and CMS ACCESS care pathways. The app reconstructs the supplied `generated-ui` references as accessible, interactive HTML/CSS/JavaScript rather than displaying screenshots.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The default fixture is the ACCESS happy path. The development-only **Demo** tab on the left changes fixtures or jumps to a screen. It is removed from production builds.

```bash
npm run test
npm run build
npm run preview
npm run test:e2e
```

## Available fixtures

- CCM happy path
- RPM with ITERA device shipping
- RPM with a patient-owned device
- RPM first-transmission failure
- ACCESS eligible eCKM path
- ACCESS control group
- ACCESS not eligible
- ACCESS already aligned
- ACCESS API unavailable
- ACCESS missing Medicare identifier
- Identity mismatch
- Personal representative
- Invalid and expired links

A fixture can also be opened directly, for example: `http://localhost:5173/?scenario=rpm-shipping`. This query contains only a non-sensitive demo scenario; production invitation tokens must never be exposed in URLs after initial server exchange.

## Architecture

- `src/config.js`: typed-by-convention offer and pathway configuration, content, fixtures, and language labels.
- `src/machine.js`: explicit journey state graph and separate enrollment/setup progress.
- `src/services.js`: asynchronous mock implementation of the enrollment service and safe draft-store abstraction.
- `src/app.js`: reusable screen components, Lucide icon mapping, form validation, navigation, async orchestration, and audit events.
- `src/styles.css`: mobile-first visual system based on the supplied ITERA mockups.
- `tests/`: state-machine and privacy/persistence tests.
- `e2e/`: mobile browser acceptance tests.

The existing repository was a dependency-free static prototype, so the implementation preserves vanilla HTML/CSS/JavaScript and adds Vite only for building and testing. No framework is required at runtime.

## Important behavior

- The pathway comes only from `EnrollmentOffer`; patients never select a reimbursement program.
- Known data is shown for confirmation instead of being collected again.
- ACCESS distinguishes prequalification, CMS eligibility, consent, alignment, and baseline completion.
- ACCESS success cannot appear before alignment confirmation.
- RPM enrollment success is separate from device setup and monitoring-ready confirmation.
- The first RPM activation reading is returned by the connected-device mock service, not manual data entry.
- Help is globally available, with phone, callback, and FAQ options.
- Enrollment progress and care-setup progress are separate.
- English/Spanish switching, semantic labels, live errors, keyboard focus, 44px targets, 200% zoom, and reduced-motion support are included.

## Prototype privacy and security

All data is fictional. The mock service never logs DOB, Medicare IDs, consent details, clinical readings, or tokens. Draft persistence begins only after identity verification and stores only non-sensitive workflow flags. Full Medicare identifiers and RPM readings are intentionally excluded from local storage. Service calls return transaction identifiers and the UI prevents confirmation before a terminal backend result.

For production:

1. Exchange the one-time SMS token for a `Secure`, `HttpOnly`, `SameSite` session cookie and remove it from browser history.
2. Move offer, resume state, attempt counters, consent evidence, idempotency records, CMS transactions, and audit events to server-side encrypted storage.
3. Add CSRF protection, rate limits, replay protection, token rotation/expiration, and durable idempotency keys.
4. Replace `MockEnrollmentService` with authenticated APIs and signed, versioned disclosure/consent bundles.
5. Send only allow-listed, non-PHI analytics events. Never attach patient identifiers or clinical values.
6. Complete legal, CMS, HIPAA/security, accessibility, device-validation, and clinical-content reviews before launch.

## EMMI multimodal prototype

EMMI is a contextual prototype assistant that can explain the current screen, guide the patient, read authoritative fictional enrollment/device/cost data through mock tools, request human follow-up after confirmation, and escalate predefined mock safety scenarios. It cannot consent, enroll, attest representative authority, change eligibility, diagnose, prescribe, or silently create clinical actions.

All EMMI fixtures are fictional (`DEMO-P001` through `DEMO-P006`). Do not enter or connect real patient data. The browser receives only a short-lived Gemini Live token; `GEMINI_API_KEY` stays in the server-side token handler.

Copy `.env.example` to `.env.local` and provide a development Gemini API key to test voice:

```bash
GEMINI_API_KEY=your-development-key
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
EMMI_PROTOTYPE_MODE=true
EMMI_ALLOW_REAL_PATIENT_DATA=false
```

Relevant flags are `EMMI_ENABLE_VOICE`, `EMMI_ENABLE_TEXT`, `EMMI_ENABLE_TOOLS`, and `EMMI_SESSION_MAX_MINUTES`. To disable voice while retaining the deterministic text assistant, set `EMMI_ENABLE_VOICE=false` and restart the development server.

Architecture:

- `api/emmi/live-token.js` and `server/emmiLiveToken.js`: POST-only ephemeral-token boundary with a one-use token, short lifetime, safe prototype checks, and no-cache response.
- `src/emmi/liveClient.js`: browser microphone capture, 16 kHz PCM input, 24 kHz PCM playback, interruption, state management, transcriptions, tool responses, mute, timeout, and graceful text fallback.
- `src/emmi/systemPrompt.js`: centralized safety and conversational policy.
- `src/emmi/tools.js`: allow-listed mock tool declarations, deterministic orchestration, confirmations, and local prototype audit records.
- `src/mock/emmiFixtures.js`: authoritative fictional patients, costs, ACCESS disclosures, and device states.

The development-only visual preview supports `?emmiState=LISTENING`, `EMMI_SPEAKING`, or `TOOL_RUNNING` after opening EMMI. Error fallbacks can be exercised with `?emmiFailure=microphone-denied`, `429`, or `connection`. These query parameters simulate UI states only and are excluded from production builds.

The local prototype audit record is stored under `itera.emmi.prototype.audit.v1` and includes conversation/session IDs, demo patient ID, locale, current screen, timestamps, transcripts, tool calls/results, action flags, model, and prompt version. It never stores audio, an API key, or an ephemeral token. Production requires an approved encrypted audit service, retention policy, access control, redaction, consent/privacy review, observability, and clinical safety validation.

## Acceptance evidence

- Unit coverage verifies no program-selection state exists, ACCESS alignment precedes success, RPM shipping branches correctly, MBI is requested only when missing, and safe drafts omit sensitive values.
- Browser tests verify ACCESS does not claim enrollment at eligibility, RPM shipping reaches address confirmation, and Spanish language switching works.
- Production build output is generated in `dist/`.

## Responsive reference

The Patient Experience is fluid from roughly 360px to 430px. It is not designed for a single
width, but one width is the primary reference for design decisions and visual QA.

**Primary mobile reference — Samsung Galaxy S25 Ultra**

| | |
| --- | --- |
| CSS viewport | **384 × 824** |
| DPR | 3.75 (device pixel ratio never drives layout; CSS viewport does) |
| Device type | Mobile, touch enabled |

`--patient-shell-width: 384px` in `src/styles.css` sizes the **desktop patient preview** only.
On a real phone the shell is `width: 100%` and the browser viewport controls the width — there
are no artificial side bands. The Prototype Setup / Configure Patient Scenario console is not
constrained by this and stays desktop-friendly.

**QA matrix** — validate 384 first, then check the rest for regressions:

| Width | Role |
| --- | --- |
| 360 | narrow Android stress test |
| 375 | compact mobile |
| **384** | **primary reference (S25 Ultra)** |
| 390 | common modern mobile |
| 393 | additional modern mobile |
| 412 | wider Android configuration |
| 430 | large mobile |

There is deliberately no `@media (width: 384px)` rule. The layout is fluid — flex, grid,
`minmax`, `clamp`, `width: 100%` and natural wrapping — so 384px is a validation target rather
than a hardcoded size. Narrower widths reduce the page gutter before they touch typography;
text is never shrunk below senior-friendly sizes to make it fit.
