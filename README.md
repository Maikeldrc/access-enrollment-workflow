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

## Acceptance evidence

- Unit coverage verifies no program-selection state exists, ACCESS alignment precedes success, RPM shipping branches correctly, MBI is requested only when missing, and safe drafts omit sensitive values.
- Browser tests verify ACCESS does not claim enrollment at eligibility, RPM shipping reaches address confirmation, and Spanish language switching works.
- Production build output is generated in `dist/`.
