# Session summary — C:/Users/maike/AppData/Local/Temp/claude/D--Dev-Codex-Access-Enrollment-access-enrollment-workflow--claude-worktrees-vercel-branch-analysis-42c870/26f741fd-6693-49f2-9ff1-43a43fd101a7/scratchpad/voice-run

| session | profile | lang | turns | spoken | start p50 | start p95 | barge-ins (stop p50) | context before answer | problems |
|---|---|---|---:|---:|---:|---:|---|---|---|
| S01-transport-canonical-es | A (adulto mayor, responde muy poco) | es | 14 | 11 | 1814 | 1910 | 0 (-) | 0/11 | 1 |
| S02-transport-by-hand-es | C (se confunde fácilmente) | es | 23 | 13 | 1829 | 7070 | 0 (-) | 1/13 | 8 |
| S03-interruptions-es | E (interrumpe frecuentemente) | es | 22 | 12 | 1804 | 7342 | 4 (166) | 2/12 | 2 |
| S04-topics-memory-es | B (habla mucho, información desordenada) | es | 13 | 12 | 1813 | 7551 | 0 (-) | 2/12 | 2 |
| S05-reschedule-change-of-mind-es | D (cambia de opinión) | es | 11 | 9 | 1810 | 9861 | 0 (-) | 2/9 | 2 |
| S06-companion-confirmations-es | G (hace muchas preguntas antes de decidir) | es | 11 | 9 | 1805 | 1882 | 0 (-) | 0/9 | 0 |
| S07-spanglish-and-language-es | F (utiliza Spanglish) | es | 10 | 9 | 8389 | 10356 | 0 (-) | 6/9 | 6 |
| S08-safety-mid-task-es | H (quiere completar todo rápido) | es | 11 | 8 | 1808 | 5938 | 0 (-) | 1/8 | 1 |
| S09-silence-and-recovery-es | A (adulto mayor, responde muy poco) | es | 8 | 5 | 1824 | 1832 | 0 (-) | 0/5 | 4 |
| S10-enrollment-en | G (asks many questions before deciding) | en | 9 | 8 | 1799 | 7898 | 1 (156) | 1/8 | 3 |
| S11-long-mixed-es | B (habla mucho, información desordenada) | es | 28 | 24 | 1816 | 1850 | 0 (-) | 1/24 | 1 |
| S12-video-visit-es | C (se confunde fácilmente) | es | 8 | 5 | 1832 | 6570 | 0 (-) | 1/5 | 1 |
| S13-transcript-assembly-es | A (adulto mayor, responde muy poco) | es | 4 | 2 | 1816 | 1835 | 0 (-) | 0/2 | 0 |
| S14-spoken-language-switch | F (utiliza Spanglish) | en | 6 | 4 | 1833 | 6360 | 0 (-) | 2/4 | 2 |
| S16-long-confused-transport-es | C (se confunde fácilmente) | es | 23 | 20 | 1810 | 1910 | 0 (-) | 1/20 | 3 |
| S17-long-enrollment-journey-es | G (hace muchas preguntas antes de decidir) | es | 21 | 17 | 1794 | 9632 | 0 (-) | 2/17 | 13 |
| S18-long-multi-intent-reschedule-es | H (quiere completar todo rápido) | es | 20 | 16 | 1816 | 8555 | 0 (-) | 3/16 | 3 |
| S19-long-topics-and-questions-es | B (habla mucho, información desordenada) | es | 20 | 18 | 1808 | 7869 | 0 (-) | 3/18 | 4 |
| S20-long-spanglish-companion-and-ride-es | F (utiliza Spanglish) | es | 20 | 16 | 1807 | 10086 | 0 (-) | 2/16 | 4 |
| S21-long-elderly-video-visit-es | A (adulto mayor, responde muy poco) | es | 21 | 15 | 1801 | 9824 | 0 (-) | 1/15 | 5 |
| S22-long-change-of-mind-en | D (changes their mind) | en | 28 | 21 | 1832 | 8655 | 1 (161) | 8/21 | 13 |
| S23-creole-sample-ht | A (granmoun, reponn kout) | es | 9 | 7 | 1829 | 14977 | 0 (-) | 3/7 | 6 |
| S24-long-my-care-hub-es | G (hace muchas preguntas antes de decidir) | es | 18 | 18 | 1802 | 1863 | 0 (-) | 0/18 | 3 |

```json
{
  "sessions": 23,
  "spoken_turns": 279,
  "total_turns": 358,
  "long_sessions_15_plus_turns": 11,
  "long_sessions_15_plus_spoken_turns": 9,
  "response_start": {
    "p50": 1813,
    "p95": 8389,
    "min": 1706,
    "max": 14977,
    "avg": 2713,
    "perceived_p50": "NOTICEABLE DELAY"
  },
  "provider_vad_window": {
    "p50": 1229,
    "p95": 1271
  },
  "app_overhead_first_chunk_to_audible": {
    "p50": 4,
    "p95": 6548,
    "max": 13228
  },
  "local_speech_end_after_T1": {
    "p50": 1244
  },
  "barge_ins": {
    "count": 6,
    "registered_by_app": 6,
    "stop_p50": 161,
    "stop_max": 275,
    "provider_interrupt_p50": 129
  },
  "spoken_turns_with_context_before_answer": "42/279",
  "navigation_taps": {
    "count": 39,
    "with_context_push": 0,
    "with_tts_narration": 25
  },
  "turns_suppressed_by_transcript_guard": [
    {
      "session": "S02-transport-by-hand-es",
      "turn": 17,
      "text": "Pon la primera.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S03-interruptions-es",
      "turn": 16,
      "text": "Para.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S03-interruptions-es",
      "turn": 18,
      "text": "Mejor la primera.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S04-topics-memory-es",
      "turn": 7,
      "text": "No, me equivoqué. Ponlo otra vez.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S04-topics-memory-es",
      "turn": 9,
      "text": "Cambia ese por 'mareos al levantarme'.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S05-reschedule-change-of-mind-es",
      "turn": 7,
      "text": "La del jueves.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S05-reschedule-change-of-mind-es",
      "turn": 9,
      "text": "Mejor no quiero cambiarla.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S07-spanglish-and-language-es",
      "turn": 3,
      "text": "Yo uso walker para caminar.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S07-spanglish-and-language-es",
      "turn": 4,
      "text": "Quiero un Uber X",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S07-spanglish-and-language-es",
      "turn": 5,
      "text": "Mi doctor dijo que no",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S07-spanglish-and-language-es",
      "turn": 6,
      "text": "Pon la primera del jueves",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S07-spanglish-and-language-es",
      "turn": 7,
      "text": "180 sobre 120 y me siento mareado.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S07-spanglish-and-language-es",
      "turn": 8,
      "text": "Can we switch to English please?",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S08-safety-mid-task-es",
      "turn": 6,
      "text": "Ninguna ayuda. Busca ya.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S10-enrollment-en",
      "turn": 5,
      "text": "I'm doing it myself.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S11-long-mixed-es",
      "turn": 9,
      "text": "Viene mi hija conmigo.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S12-video-visit-es",
      "turn": 6,
      "text": "Ya lo hice. Revisa otra vez.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S14-spoken-language-switch",
      "turn": 3,
      "text": "Prefiero hablar en español. Hable conmigo en español ahora.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S14-spoken-language-switch",
      "turn": 5,
      "text": "¿A qué hora es mi cita?",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S16-long-confused-transport-es",
      "turn": 22,
      "text": "No, me recoge mi hija.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S17-long-enrollment-journey-es",
      "turn": 7,
      "text": "Lo hago yo misma.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S17-long-enrollment-journey-es",
      "turn": 20,
      "text": "¿Ya?",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S18-long-multi-intent-reschedule-es",
      "turn": 6,
      "text": "No, mejor por la tarde.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S18-long-multi-intent-reschedule-es",
      "turn": 17,
      "text": "Léeme la cita nueva.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S18-long-multi-intent-reschedule-es",
      "turn": 20,
      "text": "Ok, listo, bye.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S19-long-topics-and-questions-es",
      "turn": 16,
      "text": "Quita el de la rodilla.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S19-long-topics-and-questions-es",
      "turn": 17,
      "text": "No, no, déjalo. Ponlo otra vez.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S19-long-topics-and-questions-es",
      "turn": 18,
      "text": "Léeme toda la lista.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S20-long-spanglish-companion-and-ride-es",
      "turn": 5,
      "text": "Okay, send it a María.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S20-long-spanglish-companion-and-ride-es",
      "turn": 16,
      "text": "Book that one.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S21-long-elderly-video-visit-es",
      "turn": 7,
      "text": "La visita… por video… no sé.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 3,
      "text": "Yes, my home address.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 4,
      "text": "No, nothing special.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 5,
      "text": "Go ahead and search.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 9,
      "text": "Yes, book it.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 12,
      "text": "Hmm. Actually, cancel it.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 13,
      "text": "Yes, cancel it.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 18,
      "text": "Just book the cheapest one.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 24,
      "text": "Still nothing? Then the big one instead.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S23-creole-sample-ht",
      "turn": 3,
      "text": "Ki lè randevou mwen an?",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S23-creole-sample-ht",
      "turn": 4,
      "text": "Mwen pa gen transpò.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    },
    {
      "session": "S23-creole-sample-ht",
      "turn": 5,
      "text": "Pale kreyòl avè m, tanpri.",
      "events": [
        "EMMI_ASR_CLARIFICATION_REQUIRED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_INVALID_TRANSCRIPT_DISCARDED",
        "EMMI_UNRELIABLE_RESPONSE_SUPPRESSED"
      ]
    }
  ],
  "problems": [
    {
      "session": "S01-transport-canonical-es",
      "turn": 6,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S02-transport-by-hand-es",
      "turn": 2,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S02-transport-by-hand-es",
      "turn": 4,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S02-transport-by-hand-es",
      "turn": 7,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S02-transport-by-hand-es",
      "turn": 9,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S02-transport-by-hand-es",
      "turn": 12,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S02-transport-by-hand-es",
      "turn": 15,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S02-transport-by-hand-es",
      "turn": 17,
      "p": "response start 7070 ms"
    },
    {
      "session": "S02-transport-by-hand-es",
      "turn": 17,
      "p": "expected view REVIEW, got BARRIER_TRANSPORTATION_OPTIONS"
    },
    {
      "session": "S03-interruptions-es",
      "turn": 16,
      "p": "response start 7342 ms"
    },
    {
      "session": "S03-interruptions-es",
      "turn": 18,
      "p": "response start 6829 ms"
    },
    {
      "session": "S04-topics-memory-es",
      "turn": 7,
      "p": "response start 7551 ms"
    },
    {
      "session": "S04-topics-memory-es",
      "turn": 9,
      "p": "response start 7364 ms"
    },
    {
      "session": "S05-reschedule-change-of-mind-es",
      "turn": 7,
      "p": "response start 7084 ms"
    },
    {
      "session": "S05-reschedule-change-of-mind-es",
      "turn": 9,
      "p": "response start 9861 ms"
    },
    {
      "session": "S07-spanglish-and-language-es",
      "turn": 3,
      "p": "response start 8389 ms"
    },
    {
      "session": "S07-spanglish-and-language-es",
      "turn": 4,
      "p": "response start 8617 ms"
    },
    {
      "session": "S07-spanglish-and-language-es",
      "turn": 5,
      "p": "response start 8533 ms"
    },
    {
      "session": "S07-spanglish-and-language-es",
      "turn": 6,
      "p": "response start 10356 ms"
    },
    {
      "session": "S07-spanglish-and-language-es",
      "turn": 7,
      "p": "response start 8649 ms"
    },
    {
      "session": "S07-spanglish-and-language-es",
      "turn": 8,
      "p": "response start 8142 ms"
    },
    {
      "session": "S08-safety-mid-task-es",
      "turn": 6,
      "p": "response start 5938 ms"
    },
    {
      "session": "S09-silence-and-recovery-es",
      "turn": 4,
      "p": "no audible response was produced for this turn"
    },
    {
      "session": "S09-silence-and-recovery-es",
      "turn": 4,
      "p": "turn did not finish within 20000 ms (state USER_SPEAKING)"
    },
    {
      "session": "S09-silence-and-recovery-es",
      "turn": 5,
      "p": "EMMI was not idle before the patient spoke (state USER_SPEAKING)"
    },
    {
      "session": "S09-silence-and-recovery-es",
      "turn": 6,
      "p": "app raised EMMI_VOICE_TURN_TIMEOUT, EMMI_VOICE_ERROR:VOICE_RESPONSE_TIMEOUT"
    },
    {
      "session": "S10-enrollment-en",
      "turn": 4,
      "p": "EMMI was not idle before the patient spoke (state EMMI_SPEAKING)"
    },
    {
      "session": "S10-enrollment-en",
      "turn": 4,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S10-enrollment-en",
      "turn": 5,
      "p": "response start 7898 ms"
    },
    {
      "session": "S11-long-mixed-es",
      "turn": 9,
      "p": "response start 6138 ms"
    },
    {
      "session": "S12-video-visit-es",
      "turn": 6,
      "p": "response start 6570 ms"
    },
    {
      "session": "S14-spoken-language-switch",
      "turn": 3,
      "p": "response start 5876 ms"
    },
    {
      "session": "S14-spoken-language-switch",
      "turn": 5,
      "p": "response start 6360 ms"
    },
    {
      "session": "S16-long-confused-transport-es",
      "turn": 3,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S16-long-confused-transport-es",
      "turn": 13,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S16-long-confused-transport-es",
      "turn": 22,
      "p": "response start 6382 ms"
    },
    {
      "session": "S17-long-enrollment-journey-es",
      "turn": 1,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S17-long-enrollment-journey-es",
      "turn": 6,
      "p": "EMMI was not idle before the patient spoke (state EMMI_SPEAKING)"
    },
    {
      "session": "S17-long-enrollment-journey-es",
      "turn": 6,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S17-long-enrollment-journey-es",
      "turn": 7,
      "p": "response start 9632 ms"
    },
    {
      "session": "S17-long-enrollment-journey-es",
      "turn": 9,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S17-long-enrollment-journey-es",
      "turn": 11,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S17-long-enrollment-journey-es",
      "turn": 14,
      "p": "EMMI was not idle before the patient spoke (state EMMI_SPEAKING)"
    },
    {
      "session": "S17-long-enrollment-journey-es",
      "turn": 14,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S17-long-enrollment-journey-es",
      "turn": 15,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S17-long-enrollment-journey-es",
      "turn": 18,
      "p": "EMMI was not idle before the patient spoke (state LISTENING)"
    },
    {
      "session": "S17-long-enrollment-journey-es",
      "turn": 18,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S17-long-enrollment-journey-es",
      "turn": 20,
      "p": "EMMI was not idle before the patient spoke (state EMMI_SPEAKING)"
    },
    {
      "session": "S17-long-enrollment-journey-es",
      "turn": 20,
      "p": "response start 6389 ms"
    },
    {
      "session": "S18-long-multi-intent-reschedule-es",
      "turn": 5,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S18-long-multi-intent-reschedule-es",
      "turn": 6,
      "p": "response start 8555 ms"
    },
    {
      "session": "S18-long-multi-intent-reschedule-es",
      "turn": 20,
      "p": "response start 5910 ms"
    },
    {
      "session": "S19-long-topics-and-questions-es",
      "turn": 4,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S19-long-topics-and-questions-es",
      "turn": 16,
      "p": "response start 7869 ms"
    },
    {
      "session": "S19-long-topics-and-questions-es",
      "turn": 17,
      "p": "response start 7408 ms"
    },
    {
      "session": "S19-long-topics-and-questions-es",
      "turn": 18,
      "p": "response start 7128 ms"
    },
    {
      "session": "S20-long-spanglish-companion-and-ride-es",
      "turn": 5,
      "p": "response start 10086 ms"
    },
    {
      "session": "S20-long-spanglish-companion-and-ride-es",
      "turn": 9,
      "p": "expected view PICKUP, got BARRIER_COMPANION_REVIEW"
    },
    {
      "session": "S20-long-spanglish-companion-and-ride-es",
      "turn": 15,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S20-long-spanglish-companion-and-ride-es",
      "turn": 16,
      "p": "response start 8579 ms"
    },
    {
      "session": "S21-long-elderly-video-visit-es",
      "turn": 5,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S21-long-elderly-video-visit-es",
      "turn": 7,
      "p": "response start 9824 ms"
    },
    {
      "session": "S21-long-elderly-video-visit-es",
      "turn": 15,
      "p": "no audible response was produced for this turn"
    },
    {
      "session": "S21-long-elderly-video-visit-es",
      "turn": 15,
      "p": "turn did not finish within 20000 ms (state USER_SPEAKING)"
    },
    {
      "session": "S21-long-elderly-video-visit-es",
      "turn": 16,
      "p": "EMMI was not idle before the patient spoke (state USER_SPEAKING)"
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 3,
      "p": "response start 8330 ms"
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 4,
      "p": "response start 6866 ms"
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 4,
      "p": "expected view TIME, got BARRIER_TRANSPORTATION_PICKUP"
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 5,
      "p": "response start 6612 ms"
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 7,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 8,
      "p": "expected view REVIEW, got BARRIER_TRANSPORTATION_NEEDS"
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 9,
      "p": "response start 8655 ms"
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 12,
      "p": "response start 7863 ms"
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 13,
      "p": "response start 6646 ms"
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 18,
      "p": "response start 9005 ms"
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 18,
      "p": "expected view REVIEW, got BARRIER_TRANSPORTATION_NEEDS"
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 24,
      "p": "response start 7914 ms"
    },
    {
      "session": "S22-long-change-of-mind-en",
      "turn": 24,
      "p": "expected view REVIEW, got BARRIER_TRANSPORTATION_NEEDS"
    },
    {
      "session": "S23-creole-sample-ht",
      "turn": 3,
      "p": "response start 6568 ms"
    },
    {
      "session": "S23-creole-sample-ht",
      "turn": 4,
      "p": "response start 6866 ms"
    },
    {
      "session": "S23-creole-sample-ht",
      "turn": 4,
      "p": "expected view PICKUP, got APPOINTMENT_CONFIRMED"
    },
    {
      "session": "S23-creole-sample-ht",
      "turn": 5,
      "p": "response start 14977 ms"
    },
    {
      "session": "S23-creole-sample-ht",
      "turn": 7,
      "p": "expected view NEEDS, got APPOINTMENT_CONFIRMED"
    },
    {
      "session": "S23-creole-sample-ht",
      "turn": 8,
      "p": "expected view TIME, got APPOINTMENT_CONFIRMED"
    },
    {
      "session": "S24-long-my-care-hub-es",
      "turn": 1,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S24-long-my-care-hub-es",
      "turn": 8,
      "p": "the app sent no screen context to the provider before it answered this spoken turn"
    },
    {
      "session": "S24-long-my-care-hub-es",
      "turn": 9,
      "p": "expected view APPOINTMENT, got SCREEN_MY_CARE"
    }
  ]
}
```
