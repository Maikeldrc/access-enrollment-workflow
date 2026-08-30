# Live EMMI Patient Test Log

Date: 2026-08-29
Target: https://access-enrollment.vercel.app/
Persona: Medicare-age ACCESS patient with hypertension, invited by Dr. Fresner
Mode: Visible browser, real audible synthesized patient speech routed through browser microphone

---

## Session start

- Production opened in the visible in-app browser at `https://access-enrollment.vercel.app/`.
- Persisted state initially resumed at **Set up your care / enrollment complete** in Spanish.
- Used the visible **ITERA HEALTH Home** link to return to Home; no storage or application state was forced.
- Used the visible language control Spanish -> Haitian Creole -> English. Home rendered correctly in English.
- Home baseline: invitation from Dr. Fresner, ACCESS explanation, voluntary-participation note, **Guide by voice**, **Ask EMMI**, and **Start your care journey** all present.
- Observation: language control uses its two-letter text as the current language (`ES`, `KR`, `EN`) and its accessible name as the next action. This is internally consistent, though potentially non-obvious; not yet filed as a defect.

## Home — automatic English voice guidance

- Enabled **Guide by voice** from Home.
- Observed state sequence: `Thinking…` -> `Speaking…` (after about 5 seconds) -> `Thinking…` again.
- After an additional 14+ seconds the card was still on `Thinking…`; **Repeat** remained disabled and no user-facing error appeared.
- Browser console exposed only an experimental ephemeral-token warning; no actionable error explained the stuck state.
- Result: **FAIL** for deterministic completion/status recovery of the first English voice-guidance playback.

## EMMI conversation — relationship turns 1–5 (English)

| Turn | Mode | Patient intent | Transcript result | EMMI result | Approx. response observation |
|---:|---|---|---|---|---|
| 1 | Voice, Spanish-system voice speaking English | 72-year-old invited by Dr. Fresner; asks what ACCESS is and whether it replaces doctor | Severely corrupted into mixed Spanish/Italian | Answered the inferred ACCESS/doctor question coherently | Visible within ~1.2 s after speech ended |
| 2 | Voice, barge-in #1, Spanish-system voice speaking English | “Wait, stop… explain in one short sentence” | Corrupted into short German-like text | Correctly recognized that transcription failed and asked for repetition | Visible within ~1.5 s |
| 3 | Voice, native US-English system voice | Repeat concise ACCESS/doctor question | Near-verbatim | Correct, concise; doctor remains in charge | Visible within ~1.5 s |
| 4 | Voice, barge-in #2 | Asks what the program costs | Exact | Response rendered as two incomplete fragments: “I can't confirm exactly what your payment would be” and “care team?”; never became a complete answer | First fragment visible within ~1.2 s; remained incomplete after additional wait |
| 5 | Voice | Who sees health information and how it is protected | Exact except punctuation split | Appropriate privacy answer; initially appeared incomplete, then finished | Complete after ~5 s |

- Voice capture is functional with a matching native-English synthesized voice.
- The relationship remained continuous inside one EMMI conversation; prior turns were retained.
- Barge-in was accepted as a new utterance, but the first accent-stressed barge-in could not be understood.

## Correction verification — repository

- Added a 20-second bounded provider-turn watchdog and a 5-second missing-transcript recovery path.
- Patient voice responses now receive one generation identifier before output transcript/audio begins.
- Added deterministic ASR clarification for unexpected language and long transcripts with no active-locale evidence.
- Verification passed: 821 unit/integration tests, 50 EMMI E2E tests, and production build.
- Live production verification remains pending deployment; this section does not claim the current Vercel build contains the corrections.
