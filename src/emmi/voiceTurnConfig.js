// The one place the voice turn-taking windows are defined.
//
// The ephemeral token minted by server/emmiLiveToken.js locks the provider's automatic activity
// detection (lockAdditionalFields: [] locks every field the token sets), so whatever the browser
// asks for at connect time is ignored. Before this module existed the server said 1200 ms and the
// client — and the local barge-in detector, and a unit test — said 750 ms. The browser was therefore
// showing "Thinking…" 450 ms before the provider had closed the patient's turn, and the constant
// the client exported described nothing that actually happened.
//
// Provider, client and local detector now read the same numbers. The value itself is deliberately
// the one the provider has been running with in production: a shorter window answers faster but
// cuts older adults off mid-sentence (the turn splitting seen in the 2026-08-30 sessions), and it
// must only be retuned with live sessions, never blind.
export const EMMI_END_OF_SPEECH_SILENCE_MS = 1200;
export const EMMI_START_OF_SPEECH_PREFIX_MS = 300;
