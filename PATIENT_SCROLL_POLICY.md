# Patient scroll policy

The patient should always feel *"I am still where I was"* when they act on the screen in front of
them, *"I arrived somewhere new"* only when they actually navigate, and *"I am back where I left
off"* when they go back.

Most of the people using this app are Medicare age. A page that jumps is not a cosmetic annoyance
for them — it costs orientation, and it reads as *"did I lose my progress?"*.

The policy lives in [`src/scroll.js`](src/scroll.js). Screens declare intent; nothing infers
behaviour from a URL or a button label.

## The scroll container

The **document** scrolls. `.shell` is `min-height:100dvh` with `overflow-y:visible`, so there is no
inner scroller — this was verified, not assumed.

`registerScrollContainer(element)` exists so that stays a decision. If the shell ever becomes its
own scroll area, register it there and every behaviour below follows without further changes. Do
not reach for `window.scrollY` directly in feature code.

## Behaviours

| Behaviour | Meaning |
|---|---|
| `NEW_SCREEN` | A genuinely different screen. Start at its beginning, instantly. |
| `PRESERVE` | Same screen, changed content. Hold the patient's place, correcting for height changes. |
| `RESTORE` | Back, or an overlay closing. Return them to the offset they left. |
| `REVEAL_TARGET` | Move the least amount needed to expose one element. |
| `REVEAL_ERROR` | The same, for the first thing that needs attention. |
| `SAFETY_PRIORITY` | Clinical urgency. The only behaviour allowed to move a patient who did not ask to move. |

## The decision

`resolveScrollBehavior()` is a pure function and the whole policy:

1. A safety interruption wins outright.
2. An explicit request from the calling screen wins next.
3. Back or an overlay closing → `RESTORE`.
4. The **view key** changed → `NEW_SCREEN`.
5. An error appeared that was not there before → `REVEAL_ERROR`.
6. Otherwise → `PRESERVE`.

`PRESERVE` is the default. Nothing has to opt into staying put.

### View keys, not routes

A screen id is not always a screen. `MY_GOALS` renders both the goals list and the goal detail, so
the view key adds a marker (`MY_GOALS#detail`) and the two get separate remembered positions.
Overlays — EMMI, bottom sheets, dialogs — never change `state.screen`, so they never reach the
`NEW_SCREEN` branch by construction.

View keys are opaque screen identifiers. **No patient data goes into them** — the goal detail marker
is deliberately just `#detail`, not the goal id.

## Matrix

| Interaction | Behaviour |
|---|---|
| Navigate to a new screen | `NEW_SCREEN` |
| Continue to the next enrollment step | `NEW_SCREEN` |
| Open a detail view inside a screen | `NEW_SCREEN` (its own view key) |
| Confirm a medication / change the answer | `PRESERVE` |
| Confirm a health information item | `PRESERVE` |
| Select or deselect a goal | `PRESERVE` |
| Expand or collapse a section | `PRESERVE` (anchored) |
| Add an item | `REVEAL_TARGET` |
| Remove an item | `PRESERVE`, anchored to the nearest surviving neighbour |
| Save inline | `PRESERVE` |
| Open EMMI or a sheet | Underlying position captured and locked |
| Close EMMI or a sheet | `RESTORE`, exactly |
| Language change on the same screen | `RESTORE` to the captured offset |
| Validation error | `REVEAL_ERROR` |
| Back | `RESTORE` |
| Async refresh, EMMI state, voice state, toast | `PRESERVE` |
| Critical safety interruption | `SAFETY_PRIORITY` |

## Anchors

Restoring `scrollTop` alone is not enough when the content changes height. Confirming a medication
collapses its card; the same number of pixels from the top would slide different content under the
patient's eyes.

Mark elements whose position is worth holding:

```html
<article data-scroll-anchor="medication-${medication.id}">
```

Before a render the policy records the first anchored element the patient can actually see and how
far down the viewport it sat. After the render it finds that key again and corrects the offset by
the difference. If the element is gone — the patient removed it — it falls back to the nearest
surviving neighbour, so a deletion does not lurch.

Anchored today: medication review cards, goal discovery options, My Goals cards.

## Revealing

`REVEAL_TARGET` and `REVEAL_ERROR` use `scrollIntoView({ block: "nearest" })` — the smallest
movement that exposes something, never `block: "start"` and never the top.

The sticky Continue bar and the floating EMMI pill cover the bottom of the viewport, so targets
carry `scroll-margin` in `src/styles.css` and `nearest` respects it. That block is the single place
that knows what covers the edges of the viewport; do not hard-code offsets in JavaScript.

## Motion

`PRESERVE`, `RESTORE` and `NEW_SCREEN` are instant — a correction the patient sees is a correction
that failed. Only `REVEAL_*` animates, and `prefers-reduced-motion` turns that off too.

## History

`history.scrollRestoration` is set to `manual` at boot. The app owns restoration; the browser must
not also try. One source of truth.

## Focus

Focus and scroll are related but not the same.

- A new screen hands focus to its heading. That is safe because `NEW_SCREEN` already starts at the
  top.
- An in-place update leaves focus alone. Re-focusing the `h1` after every state change drags a
  screen reader back to a title the patient already heard.
- Every programmatic `focus()` uses `{ preventScroll: true }`.

## Adding a screen

Nothing is required for the default. If a screen needs something else:

```js
requestScroll({ explicit: SCROLL.REVEAL_TARGET, targetSelector: "#add-medication-form" });
render();
```

`requestScroll` applies to the next render only.

For a list whose items change height, add `data-scroll-anchor` with a stable, non-identifying key.

## Known exceptions

- **`SAFETY_PRIORITY` is unused today.** The behaviour and its precedence are implemented and
  tested, but no clinical surface currently claims it. A screen that must interrupt a patient
  should pass `safetyInterruption: true` rather than inventing its own scrolling.
- **The prototype configurator** (`PROTOTYPE_SETUP`) is an internal screen and goes through the same
  policy. It is not part of the patient experience and has no anchors.
- **Browser-native scroll anchoring does not help here.** The screen is rebuilt with `innerHTML` on
  every render, so the browser has nothing to anchor to. That is why this policy measures and
  corrects explicitly.

## Tests

- [`tests/scroll.test.js`](tests/scroll.test.js) — the resolver, one test per row of the matrix. No
  DOM required.
- [`e2e/scroll.spec.js`](e2e/scroll.spec.js) — medication review preservation, reviewing a whole
  list without scrolling back, EMMI open/close, new screen and back, revealing an added form.

E2E assertions are on semantic anchors and on "not the top" — never exact pixels, because content
legitimately changes height.

One trap worth knowing: a test that opens EMMI by clicking the **compact card** proves nothing about
scroll. That card sits at the top of the screen, so the click itself scrolls there. Only the fixed
floating pill can open EMMI from where the patient actually is.
