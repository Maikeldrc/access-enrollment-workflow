# Voice session S10-enrollment-en

- patient_profile: G (asks many questions before deciding)
- language: en
- flow: enrollment: Home → who is completing → identity → care recommendation, with questions and a barge-in on the welcome
- provider: fake — SIMULATED PROVIDER: transcripts are declared by the harness and EMMI replies are scripted. Only application-side mechanics are evidence.
- started: 2026-09-04T19:57:21.234Z
- finished: 2026-09-04T19:59:32.616Z

Screen narration is spoken through the TTS route; the patient interrupts it and asks about the screens while moving by hand.

| # | kind | screen | PATIENT | recognized_text | EMMI (scripted) | start ms | perceived | complete ms | action | navigation | problems |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
| 1 | speech (barge-in) | SCREEN_INVITATION | Wait. What is ACCESS? | Wait. What is ACCESS? | ACCESS is a Medicare care option that gives you extra support between doctor visits. Your doctors stay the same. | 1759 | NOTICEABLE DELAY | 9898 |  | same view |  |
| 2 | speech | SCREEN_INVITATION | Does it cost money? | Does it cost money? | Your expected payment is 0 dollars a month for this service. | 1763 | NOTICEABLE DELAY | 6435 | getExpectedAccessCost→ | same view |  |
| 3 | tap | SCREEN_INVITATION | (taps Start your care journey) | | | | | | | SCREEN_INVITATION → ENROLLMENT_DECISION_MAKER | context pushed: 0, narration: TTS |
| 4 | speech | ENROLLMENT_DECISION_MAKER | What do I do here? | What do I do here? | Choose the option that describes you: for yourself, someone helping you, or a personal representative authorized to make healthcare decisions. | 1846 | NOTICEABLE DELAY | 10385 | describeCurrentView→ | same view | EMMI was not idle before the patient spoke (state EMMI_SPEAKING); the app sent no screen context to the provider before it answered this spoken turn |
| 5 | speech | ENROLLMENT_DECISION_MAKER | I'm doing it myself. | I'm doing it myself. | Then choose 'For myself' and continue. ‖ I’m sorry, I didn’t hear that clearly. Please say it again. If this may be a medical emergency, call 911 now. | 7898 | VERY POOR | 13654 | describeCurrentView→ | same view | response start 7898 ms |
| 6 | speech | ENROLLMENT_DECISION_MAKER | Can you pick it for me? | Can you pick it for me? | I can't press that one for you on this screen. Tap 'For myself', then Continue. | 1816 | NOTICEABLE DELAY | 8220 | performViewAction→UNKNOWN_ACTION | same view |  |
| 7 | speech | ENROLLMENT_DECISION_MAKER | Why do you need my date of birth? | Why do you need my date of birth? | It helps match you to your care invitation securely. I won't ask you to say it out loud. | 1793 | NOTICEABLE DELAY | 9534 |  | same view |  |
| 8 | speech | ENROLLMENT_DECISION_MAKER | I want to do this later. | I want to do this later. | That's fine. Your progress is saved and you can come back whenever you like. | 1799 | NOTICEABLE DELAY | 7741 |  | same view |  |
| 9 | speech | ENROLLMENT_DECISION_MAKER | Actually, let's keep going. What's next? | Actually, let's keep going. What's next? | Choose the option that describes you: for yourself, someone helping you, or a personal representative authorized to make healthcare decisions. | 1840 | NOTICEABLE DELAY | 10424 | describeCurrentView→ | same view |  |

## Summary

```json
{
  "spoken_turns": 8,
  "total_turns": 9,
  "response_start_p50_ms": 1799,
  "response_start_p95_ms": 7898,
  "response_start_avg_ms": 2564,
  "app_overhead_p50_ms": 5,
  "barge_ins": 1,
  "barge_in_stop_p50_ms": 156,
  "barge_in_stop_max_ms": 156,
  "spoken_turns_with_context_before_answer": 1,
  "problems": [
    "turn 4: EMMI was not idle before the patient spoke (state EMMI_SPEAKING)",
    "turn 4: the app sent no screen context to the provider before it answered this spoken turn",
    "turn 5: response start 7898 ms"
  ]
}
```

## Observations

- voice start: state EMMI_SPEAKING, socket true, error "", 556 ms after tap
