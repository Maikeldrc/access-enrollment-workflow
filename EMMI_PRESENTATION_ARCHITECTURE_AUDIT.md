# EMMI presentation architecture — audit before refactor

Scope: how EMMI is *presented* across the Patient Experience. The conversational backend
(liveClient, textOrchestrator, conversationManager, transitionManager, narrative, tools) is
reused unchanged.

## What exists

| Surface | Code | Notes |
| --- | --- | --- |
| Home introduction card | `emmiWelcome()` in `src/app.js`, rendered by `invitation()` | "Hi, I'm EMMI." + Your ITERA Care Assistant + Guide me with voice |
| Compact card | `voiceGuidancePanel()` | Rendered above every screen except `INVITATION` |
| Floating pill | `emmiAssistant()` | Labeled `EMMI` + live status, draggable, fixed bottom-right of the shell |
| Expanded panel | `assistantLayer()` + `showHelp()` / `closeAssistant()` | `role="dialog" aria-modal="true"`, appended into `.shell`, **not** a route |
| Voice options sheet | `emmiVoiceOptionsSheet()` → `emmiBottomSheet()` | Pause / Repeat / Read message / Turn voice off |
| Expanded *sheet* | `emmiExpandedSheet()` | A second, smaller "expanded EMMI" opened by the pill |
| Visibility | `syncFloatingEmmiVisibility()` | Rect check against `.emmi-guide` + overlap check against screen content |
| Conversation state | `EmmiConversationManager`, `state.assistantMessages`, `emmiLive` | Survives screen changes; guards re-greeting |

## What can be reused

Everything conversational: `ensureEmmiRuntime()`, `assistantContext()`, `askEmmi()`,
`EmmiConversationManager` (session id, hasGreeted, recent turns, recovery instruction),
`EmmiTransitionManager`, `emmiVoiceOptionRows()`, `emmiLabels()`, and the whole audit log.
The expanded panel already *is* an overlay over the current screen and already restores scroll.

## What caused duplication

1. `syncFloatingEmmiVisibility()` only knew about the compact card (`.emmi-guide`). On Home there
   is no compact card, so the **Home introduction card and the floating pill were both visible**.
2. Two things were called "expanded": `emmiExpandedSheet()` (a bottom sheet with *Ask EMMI*) and
   `assistantLayer()` (the real "How can I help?" panel). The pill opened the sheet, so reaching
   the conversation off Home took two taps and presented EMMI twice in a row.
3. The panel offered two competing conversation entries: a 68px "Talk to EMMI / Use your voice or
   continue typing" card *and* an "Ask a question…" input.

## What caused navigation to /emmi

Nothing. There is no `/emmi` client route: `src/app.js` only branches on `/access/learn`,
`/support/accept` and `/care-circle/invite/:token`. `api/emmi/*` and `server/emmi*.js` are
server endpoints (live token, chat, knowledge), not patient-facing pages. The "separate page"
feel came from the expanded panel filling the shell while being reached through a second sheet,
and from its footer button reading "Back to enrollment" as if the patient had left.

## What had to change

- One visibility controller with an explicit presentation mode (`HOME_INTRO | COMPACT | FLOATING
  | EXPANDED`) and one anchor (Home card *or* compact card), observed with `IntersectionObserver`.
- The pill opens the expanded panel directly, everywhere. `emmiExpandedSheet()` is gone.
- The panel: one hero avatar, one voice action, one input, contextual quick questions, voice
  options in place when voice is already on, an error state with Try again, `Close EMMI` copy.
- Voice started from the panel turns guidance on globally, so closing the panel no longer ends
  the session.
- Quick questions moved out of the panel into `src/emmi/quickQuestions.js`, keyed by screen and
  patient context.
- Analytics for the presentation lifecycle; Back closes the overlay instead of leaving enrollment.
