# Phase 02 — EMMI adaptive language

**Status:** complete
**Surface:** `src/emmi/languageDetection.js` (new), `askEmmi()` in `src/app.js`
**Commit:** _recorded in the follow-up docs commit_

---

## What changed and why

A patient could switch the interface language with the toggle, and nothing else. If they simply
started writing to EMMI in Spanish while EMMI was in English, EMMI answered in English — politely,
accurately, and in the wrong language, every turn.

EMMI now notices, asks once, and then follows the patient.

```
DETECT → OFFER (once, in their language) → SWITCH → CONTINUE THE SAME CONVERSATION
```

Nothing restarts. The thread, the screen context, the conversation session and the voice session all
survive the change; only the language of the words coming back is different.

## Files changed

| File | Change |
| --- | --- |
| `src/emmi/languageDetection.js` | **New.** Detection and the decision of what to do about it |
| `src/app.js` | Language handling inside `askEmmi`, session state for the offer, and `applyEmmiLanguage` |
| `tests/languageDetection.test.js` | **New.** 12 unit tests |
| `e2e/emmi-conversation.spec.js` | 5 new end-to-end tests |

## Detection

The detector is deliberately unwilling to guess. Offering to change language is friendly once and
irritating every time after, so it returns `null` — changing nothing — unless the evidence is clear:

- fewer than three words is not evidence ("ok", "yes", "wi", `120/80`, a name, a medication);
- a word two of the three languages share earns nothing (`no`, `si`, `pa` are absent from every list);
- the winner must be at least two points clear of the runner-up, so a tie decides nothing;
- orthography counts double, because `ñ`, `¿` or `è` cannot be a coincidence.

Names, medications, amounts and clinical values are never touched: the detector changes which
language answers are written in, and every patient-specific value still comes from the runtime tools
that produced it.

**KR is Haitian Creole.** The module works in `en` / `es` / `ht` and can never return Korean; the
tests assert Creole input resolves to `ht` and that no Korean characters reach the panel.

## Deciding what to do

| Situation | What happens |
| --- | --- |
| Writing in EMMI's language | Nothing |
| A different language, first time | Ask once, **in that language** |
| They answer yes | Switch |
| They just keep writing in it | Switch — carrying on is a clearer answer than any confirmation |
| They answer no | Remembered for the session; never asked again |
| They later move to a third language | Offered again, because that is a new preference |

A quick question is EMMI's own words in EMMI's own language, so it is explicitly excluded from
detection — otherwise tapping a Spanish suggestion in a Spanish panel would read as the patient
switching languages.

## One activeLocale for text and voice

`applyEmmiLanguage` goes through the existing `setLanguage`, which already rebuilds a live voice
session in the new language. There is one locale and both modalities follow it.

## Defect found and fixed while building it

The first version called `render()` to refresh the screen behind the panel. `render()` rebuilds
`#app`, which contains the assistant layer — so switching language closed EMMI mid-turn. It now
refreshes only the panel, exactly as the manual language toggle inside EMMI already did.

## Tests

- `npm test` — **797 passing** (785 + 12 new), 0 failing.
- `e2e/emmi-conversation.spec.js` — **20 passing** (15 from Phase 1, 5 new).

New coverage: the offer appearing once and in the patient's language without switching anything yet;
saying yes moving the placeholder, the locale chip, the document language and the voice locale while
the earlier English turns stay in the thread and EMMI does not greet again; carrying on in Creole
switching without a confirmation and never producing Korean; a decline being remembered so the next
Spanish message is answered rather than re-interrogated; and a quick question never being mistaken
for a language change.

## Open issues

None from this phase.
