# EMMI voice, audio and conversation pre-release audit

> Remediation update — 2026-08-29: the detected application defects VA-002 through VA-005 are corrected and regression-tested. Current evidence is 809/809 unit tests, a successful production build, 449/449 distinct Playwright scenarios, and a live Gemini welcome that completed as one bounded turn after audible audio drain. VA-001 (real-patient governance) and physical acoustic/cross-browser certification remain external release gates; therefore this report's original `NOT READY` verdict is preserved as the historical pre-remediation audit, not the current application-functional result.

Audit date: 2026-08-29
Target: `https://access-enrollment.vercel.app/`
Result: **NOT READY — REMEDIATION REQUIRED**

## Executive summary

EMMI's current implementation is materially stronger than a superficial microphone demo: it uses AudioWorklet capture, short-lived server-minted Gemini credentials, a canonical voice guard, provider and local interruption logic, shared application conversation state, runtime tools, deterministic safety rules and explicit cleanup/reconnect paths. Five consecutive production starts reached the first `Speaking…` state in 1.35–1.91 seconds, all 801 unit tests passed, and all 28 selected E2E tests passed.

It is not ready for a real Medicare patient pilot. The deployed/repository configuration is explicitly prototype-only and lacks the stated real-patient governance/audit controls. In live production, the initial voice welcome expanded into a repetitive roughly 40-second monologue; multi-turn follow-up context was lost; a natural punctuated Spanish confirmation failed to switch language; and a Spanish monitor-shipping question bypassed patient-runtime grounding. The required 20-turn audible suite, barge-in timing, sentence-end verification, noise/slow-speech corpus and cross-browser audio run could not be completed with the available controllable microphone/output surface.

The emergency path performed correctly in the tested case: Spanish “190 sobre 120” with dizziness immediately produced urgent 911 guidance, and that safety episode remained authoritative on two follow-ups.

## Environment and coverage

- Live browser: Codex in-app Chromium, production deployment, English and Spanish.
- View: patient mobile shell as rendered by the selected browser.
- Static review: voice provider/model, token endpoint, capture/resampling/playback, VAD/barge-in, session manager, locale, tools, safety and overlay lifecycle.
- Automated verification: `npm test` — 41 files, 801/801 tests; selected Playwright E2E — 28/28; production build successful.
- Live production: initial voice session, transcript and console observation; five repeated voice starts; attempted acoustic TTS interruption; 11 targeted multi-turn text questions in the shared EMMI conversation.
- Not covered live: controlled patient microphone audio, audible waveform capture, 20 spoken turns, barge-in distribution, accents/noise/soft speech, long utterances, Edge/WebKit/Safari, identity/consent/enrollment/device/My Care screens, session expiry and network-loss recovery.

## Key metrics

- Voice-start proxy: median 1.658 s; p90/p95 1.905 s; 5/5 starts successful.
- Initial welcome: approximately 40 s until listening on the observed cold session, with repeated/elaborated content.
- Live evaluated context/safety turns: five correct/safe, one partial, two materially wrong/context-lost among eight classified answers.
- Spanish switch variants: 1/2 (`Sí.` failed; `sí` passed).
- Spanish emergency priority/persistence: 3/3.
- Patient-specific Spanish device grounding: 0/1.
- True conversational latency, barge-in latency, cutoff rate and 20-turn success: not certifiable.

## Architecture and audio quality

See `VOICE_AUDIO_ARCHITECTURE_CURRENT.md`. Capture/playback design is credible and the instrumented E2E confirms one AudioWorklet pipeline, no deprecated ScriptProcessorNode and cleanup on stop/restart. However, source-level correctness does not prove audible sentence completion or non-overlap. The production welcome demonstrates that model-mediated narration can be operationally poor even when audio transport succeeds.

## Conversation, language and context

Basic ACCESS explanation and next action were correct. The direct Dr. Fresner follow-up was only partially answered. “Can you explain that more simply?” lost the immediately preceding next-step referent and returned to a generic ACCESS definition. English-to-Spanish continuity worked only after an exact unpunctuated `sí`; the natural `Sí.` variant failed. Once in Spanish, emergency routing was correct, but the monitor-shipping question did not invoke a patient-specific answer.

## Barge-in and resilience

The code supports a 40 ms local stop fade, provider-confirmed interruption, stale-generation suppression and critical-safety preservation. The attempted system-TTS interruption was not transcribed, plausibly due to echo cancellation. No valid interruption latency was therefore measured. Reconnect and session-resumption logic exists but was not fault-injected live.

## Safety, tools, security and privacy

The tested critical BP/dizziness event correctly preempted normal conversation and persisted. No dangerous medication instruction, secret exposure or patient-state fabrication was observed. Nevertheless, multilingual runtime-tool parity failed for the monitor question, and most patient-specific tools were not exercised live. The client/server credential split is appropriate, but the repository explicitly says production needs governance controls not present in this prototype.

## Issues by severity

- Blocker: VA-001, prototype-only real-patient governance boundary.
- High: VA-002 through VA-006, including repetitive voice welcome, locale confirmation defect, Spanish tool-routing miss, context loss and missing required live-audio certification coverage.
- Medium: VA-007 and VA-008.
- Low: VA-009.

Full records: `VOICE_AUDIO_ISSUES.md`.

## Certification gates

- Audio: **FAIL / coverage gap** — startup works, but sentence completion, 20 turns, overlap, echo/noise and barge-in are not certified; welcome UX fails.
- Conversation: **FAIL** — immediate follow-up context and natural locale confirmation failed.
- Patient state/tools: **FAIL** — no fabricated shipping claim, but a patient-specific ES device question bypassed runtime grounding.
- Safety: **PASS for the sampled scenario; not fully certified**.
- Privacy/security: **FAIL for real-patient readiness** because the deployment is explicitly prototype-only; no client secret leak observed.
- Language: **FAIL** — ES switch robustness and ES tool parity failed; Kreyòl is explicitly text-only.

## Final execution summary

AUDIT STATUS: **COMPLETE WITH COVERAGE GAPS**

- Planned audit groups: 36
- Executed or partially executed: 24
- Passed: 11
- Failed: 5
- Partial: 8
- Blocked/not testable: 12
- Manual validation required: audible completion, barge-in, noise/accents/soft speech, all patient screens, cross-browser and real-device testing

CERTIFICATION: **NOT READY — REMEDIATION REQUIRED**

### Top 10 risks

1. Prototype-only environment lacks real-patient operational governance.
2. Repetitive ~40-second welcome delays conversational readiness.
3. Required 20-turn spoken stability is unproven.
4. Barge-in timing and recovery are unproven.
5. Natural `Sí.` confirmation breaks language switching.
6. Spanish patient-specific device intent misses runtime grounding.
7. Immediate follow-up referents can be lost.
8. Audible cutoff/overlap cannot be certified from state alone.
9. Reconnect/session expiry is unproven live.
10. Voice identity and browser/device parity are not audibly cross-validated.

### Top 10 recommended remediations

1. Complete real-patient privacy/security/clinical governance and audit backend.
2. Make narration bounded and non-generatively repetitive.
3. Build a controlled virtual-mic/output-capture QA harness.
4. Run and gate on 20-turn audible EN and ES suites.
5. Add measurable barge-in, drain and stale-audio telemetry.
6. Normalize language confirmations including ASR punctuation.
7. Enforce multilingual tool routing for all patient-specific facts.
8. Add recent-turn anaphora/repeat/simplify handling.
9. Fault-inject reconnect, expiry and audio-device changes.
10. Certify voice identity, noise, senior speech and cross-browser behavior on real devices.
