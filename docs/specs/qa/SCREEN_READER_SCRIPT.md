# Screen reader pass — what to run, and what to listen for

Half an hour, one device, no setup. This is the half of accessibility that a machine cannot decide,
so it is written as things to *hear* rather than things to check.

**Turn it on.** Mac: VoiceOver with **Cmd + F5**; move with **Ctrl + Alt + →**. Windows: NVDA
(free, nvaccess.org); move with **↓**. Either way, use a real phone or a narrow browser window —
this product is built for a phone.

**Start at** `https://access-enrollment.vercel.app/` and walk forward. Do not use the QA screen
selector: how a screen is *reached* is part of what is being tested.

---

## The five things that would fail a patient

Everything below is a specific thing to hear. If you hear it, it passes. If you hear silence, a
letter-by-letter spelling, or the wrong language, write down the screen and move on.

### 1. Every screen says where you are when it opens

Move to a new screen and listen for the heading before anything else. Each screen has exactly one
main heading, and it should be the first substantial thing announced.

**Fails if:** the reader starts in the middle of the page, reads a button before the heading, or
says nothing at all when the screen changes.

### 2. The buttons say what they do

Tab through every screen. Each control should announce a name and its role — "Continue, button",
"Date of birth, edit text".

**Listen especially for:** the language switch in the header, the back arrow, the EMMI pill, and on
the device screen, the three cuff cards. An icon-only control announcing as "button" with no name is
the classic failure.

### 3. Spanish and Creole are read in Spanish and Creole

Switch the language in the header and listen. The voice should change, or at minimum the words
should be pronounced as Spanish rather than as English.

**This one is already asserted automatically** (`e2e/accessibility.spec.js` checks the `lang`
attribute changes), so the interesting part is whether it *sounds* right, not whether the attribute
is there.

### 4. Errors and changes are announced without being hunted for

Two places to try:

- On **Confirm it's you**, submit with the date of birth empty. The error should be announced. If
  you only find it by moving the cursor down to it, it failed.
- In **EMMI**, ask any question. The answer should be announced when it arrives.

**Fails if:** something visibly changes on screen and the reader says nothing.

### 5. The consent screen can be completed without sight

This is the one that matters most, because it is where the patient agrees to something.

Reach **Review and choose**, and using only the keyboard and the reader: find the checkbox, hear
what it says you are agreeing to, tick it, and reach the confirm button.

**Fails if:** the checkbox announces without its label, the disclosure text cannot be reached, or the
confirm button is reachable before the patient could have heard what they are agreeing to.

---

## Two known gaps, so you can ignore them

- **The care team initials** ("AR", "PM") are marked decorative on purpose and should be skipped by
  the reader. Hearing nothing there is correct.
- **Voice EMMI** is a separate, uncertified pass — see `VOICE_HANDOFF.md`. Text EMMI is in scope
  here; spoken EMMI is not.

---

## What to send back

The screen and the sentence, nothing more formal than that: *"Cuff size cards on the device screen —
announced as 'button' with no name."* One line each is enough to act on.

Automated rules already cover contrast, ARIA, landmarks, names on controls, focus order and reduced
motion, across fifteen screens (`e2e/accessibility.spec.js`). Everything above is what those rules
cannot see.
