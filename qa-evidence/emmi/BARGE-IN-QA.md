# EMMI barge-in — implementation and QA report

Date: 2026-08-27

## Root cause found in the previous implementation

The microphone was not disabled while EMMI spoke; it already streamed continuously with echo cancellation, noise suppression, and automatic gain control. The failure was in output lifecycle management:

1. A single fixed RMS threshold stopped only the audio sources already scheduled in the browser.
2. The active Gemini generation remained current, so late PCM chunks could be scheduled again.
3. `EmmiTransitionManager` did not learn that the patient had interrupted it, so remaining semantic narration segments could continue.
4. Every later audio chunk forced the UI back to `EMMI_SPEAKING`, even after the local client had shown `USER_SPEAKING`.
5. Gemini Live automatic activity detection and start-of-activity interruption were left implicit instead of being locked into the session configuration.

This was not a half-duplex microphone problem. It was an incomplete cancellation and stale-output problem combined with a coarse local detector.

## Implemented architecture

- Gemini Live native automatic activity detection is explicitly enabled.
- `START_OF_ACTIVITY_INTERRUPTS` lets the provider cancel the current generation in the same live session.
- Start sensitivity is high, prefix padding is 300 ms, and silence duration is 800 ms to better support quiet starts and longer pauses.
- A local adaptive detector provides a fast playback stop while provider activity detection remains authoritative.
- Local start detection requires sustained speech-like energy and learns an ambient noise floor.
- Current audio fades for 40 ms to prevent clicks/pops.
- Every response has a `generationId`; an interrupted generation is invalidated and all later chunks from it are discarded.
- The semantic narration is marked `INTERRUPTED`; pending segments never restart automatically.
- The current screen, utterance, semantic segment, and interruption point remain in session memory for contextual follow-ups.
- Patient interruption does not reconnect Gemini Live, so the canonical EMMI voice and conversation context remain unchanged.
- A minimum critical-safety instruction is protected from the local energy detector; provider-confirmed activity is still recorded and handled rather than ignoring the patient.
- Audio-route changes preserve the live session when the browser keeps the track alive and reacquire only the microphone stream if the track ends.

## Automated QA

| Case | Coverage | Result |
| --- | --- | --- |
| A — interrupt Home narration | Local/provider interruption lifecycle | Pass (contract) |
| B — discard remaining Identity narration | Interrupted narration status and segment cancellation | Pass |
| C — isolated background sound | Sustained-energy requirement | Pass (synthetic) |
| D — quiet “Wait” | High-sensitivity threshold over consecutive frames | Pass (synthetic) |
| E — contextual “Why?” | Interrupted utterance/semantic/screen snapshot | Pass |
| F — interrupt Ask EMMI response | Patient-response generation cancellation without reconnect | Pass |
| G — interrupt Repeat | Shared screen-guidance path | Pass (contract) |
| H — navigation then patient speech | Patient interruption cancels graceful transition narration | Pass |
| I — late network chunk | Stale generation guard | Pass; injected stale chunk discarded |
| J — voice after interruption | Same-session canonical voice guard | Pass (contract) |

Automated results:

- Unit/integration: 151 passed.
- Mobile EMMI browser suite: 13 passed.
- Production build: passed.
- Ephemeral Gemini token with the native interruption configuration: accepted by the provider.
- Injected stale audio incidents: 1; discarded: 1; replayed: 0.
- Canonical voice changes in identity tests: 0.
- Local architectural stop budget at 44.1 kHz: about 186 ms for two capture frames plus a 40 ms fade, before browser/device scheduling variance.

## Real-device validation still required

The following metrics cannot be truthfully measured from automated desktop/fake-microphone tests and remain a physical-device release gate:

- average and maximum interruption stop latency;
- false and missed interruption rates with real speech;
- speaker-echo/self-interruption rate;
- TV/background speech behavior;
- quiet and distant speech performance;
- wired/Bluetooth audio-route changes;
- conversation recovery failures on a real network;
- Android Chrome on Samsung Galaxy S25 Ultra at the 384 px viewport;
- iOS Safari, if it is a supported target.

Recommended physical test: at least 20 interruptions each at quiet/normal voice, phone-speaker volume low/medium/high, and near/arm’s-length distance. Investigate any stop latency above 1,000 ms and require no stale-audio replay or voice-identity change.
