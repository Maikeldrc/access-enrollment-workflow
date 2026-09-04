# Voice session S23-creole-sample-ht

- patient_profile: A (granmoun, reponn kout)
- language: ht
- flow: Haitian Creole sample: session in Kreyòl, screen questions, a ride request, then a spoken request to switch to Spanish
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T01:33:37.133Z
- finished: 2026-09-04T01:33:54.516Z

Short sample only: what the app does with a Kreyòl session (narration language, view labels, language switch on request). The double transcribes the Kreyòl text as given.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|

## Summary

```json
{
  "spoken_turns": 0,
  "total_turns": 0,
  "response_start_p50_ms": null,
  "response_start_p95_ms": null,
  "response_start_avg_ms": null,
  "app_overhead_p50_ms": null,
  "barge_ins": 0,
  "barge_in_stop_p50_ms": null,
  "barge_in_stop_max_ms": -1,
  "spoken_turns_with_context_before_answer": 0,
  "problems": []
}
```

## Observations

- HARNESS ERROR: locator.waitFor: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('[data-action="enable-emmi-guidance"]').first() to be visible[22m

    at press (/home/user/access-enrollment-workflow/reports/emmi-voice-audit/harness/voice-harness.mjs:103:129)
    at startVoice (/home/user/access-enrollment-workflow/reports/emmi-voice-audit/harness/voice-harness.mjs:120:9)
    at async file:///home/user/access-enrollment-workflow/reports/emmi-voice-audit/harness/run-sessions.mjs:27:19
