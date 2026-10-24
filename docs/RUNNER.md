# The runner: "Off course"

An endless runner for the 404 page. This is **step 1 of 4: the core**, a playable prototype with placeholder shapes. The
steps after it: **2. the look** (the art in `render.ts` and the HUD styles), **3. page integration** (the 404 page mounts it),
**4. QA**. The prototype is at `/styleguide/runner/` (noindex, unlinked, like the rest of the styleguide).

## Concept

A small six-wheeled space rover with a brass beacon on its roof drives along a three-lane track inside a tunnel of brass
rings, faster and faster, the way the Chrome dinosaur game runs: one key to start, a quick restart. You took a wrong turn
(the page is missing), so the course is made of 404s. Obstacles differ in **shape**, not colour: brass is the only accent,
solids are ivory (CLAUDE.md, design rules).

| Obstacle | Shape | What gets you past |
| --- | --- | --- |
| Slab | a tall block across its lane, `404` on its face | change lane (it is too tall to jump) |
| Barrier | a low block | jump |
| Gate | an overhead arch (a beam on two posts) | slide under the beam |

Brass dots come in lines between the rows (and over a barrier, on the jump; under a gate, on the slide). Each one adds 1 to
the pickup count and 5 m to the score.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Start, restart, resume | Space | tap |
| Change lane | Left / Right arrow, A / D | swipe left / right |
| Jump | Up arrow, W, Space (while playing) | swipe up |
| Slide | Down arrow, S | swipe down |

Keys are heard only while the game's container has focus, and Space and the arrows do not scroll the page then. A swipe
counts once the finger has moved 30 px along one axis and that axis is at least 1.25 times the other; shorter or diagonal
moves do nothing, and a short still press is a tap. One swipe per touch.

## Rules

- **Score** = whole metres driven + 5 per pickup, shown as five digits (`00420 m`). The **best score** is under it, dimmer.
- **Speed** starts at 12 m/s and eases out to the cap, 28 m/s, over 100 s of play.
- **States:** ready ("Press space to play" / "Tap to play"), playing, game over (score, best, "Press space to try again" /
  "Tap to try again"). A restart is ignored for 0.35 s after a crash, so a key still held does not restart by accident.
  The words switch to the touch ones on a coarse pointer or at the first touch.
- **Paused** when the tab is hidden, the window loses focus, or keyboard focus leaves the game during a run. Space or a tap
  resumes (that press does nothing else).
- **Jump:** 1.3 m high, 0.62 s long. No double jump; a jump pressed up to 0.12 s before landing happens on landing.
- **Slide:** 0.65 s. Slide again restarts it; jump cancels it. Slide in the air slams the rover down and it slides on landing.
- **Lanes:** one lane per press, 0.14 s per lane, also in the air and while sliding; the edges stop it.
- **Best score** is saved only in the visitor's browser: `localStorage`, key `r7-runner-best`. Nothing is sent anywhere.
  Every access is in `try/catch`: with storage blocked (private browsing, a sandboxed frame) the best lasts for the visit.
- **Without WebGL** the game shows "This game needs WebGL." and nothing else.

## Architecture

`src/game/runner/`, pure logic apart from the rendering:

| File | What it does |
| --- | --- |
| `config.ts` | every tunable number (below), the scene colours, `speedAt()` and the jump's gravity |
| `random.ts` | mulberry32, a small seeded generator: the same seed is the same course |
| `generator.ts` | rows of obstacles and pickup lines, and the fairness arithmetic |
| `sim.ts` | `RunnerSim`: state, `step()` (exactly one fixed step), lanes, jump and slide, collisions, spawning, score |
| `clock.ts` | `FixedStepClock`: frame timestamps to a number of steps and an interpolation `alpha` |
| `input.ts` | keyboard, swipe and tap to intents (`left`, `right`, `jump`, `slide`, `primary` = Space, `start` = tap) |
| `storage.ts` | best score load and save |
| `render.ts` | the Three.js view: reads the sim, draws placeholder primitives; `createView()` is null without WebGL |
| `index.ts` | `mountRunner(container, options)`: DOM, HUD, the loop, pause rules, resize, cleanup; the words (`RUNNER_TEXT`) |
| `runner.css` | the HUD's styles, tokens only; imported by the page that hosts the game, never global |

```ts
const { mountRunner } = await import('../game/runner/index'); // a separate lazy chunk, three.js included
const game = mountRunner(container, { seed, onStats }); // { start, pause, resume, destroy }
game.start();
// later
game.destroy(); // removes the canvas and HUD, every listener, the animation frame, the ResizeObserver, the WebGL context
```

The **host** supplies the container: positioned (the game fills it with `position: absolute; inset: 0`), focusable
(`tabindex="0"`) with a visible focus ring, an accessible name, and its instructions as text pointed to by `aria-describedby`.
The fixture uses `role="application"` so screen readers pass the keys through. The game adds a canvas (`role="img"`,
`aria-label="Endless runner game"`), the score, a message and a polite live region that says "Game over, score N". The root
carries `data-runner-state` (`ready`, `playing`, `over`, `unsupported`), `data-runner-paused` and `data-runner-lane`, for the
tests and for the steps after this one.

**Three.js** (`three`, MIT) is the one runtime dependency added. It is imported by name in `render.ts` only, and only
`index.ts` is imported dynamically, so it is never in a page's first load. The lazy chunk is about 551 kB, **138 kB
gzipped** (2026-10-23 build, three 0.186); the fixture page's own script is 1.3 kB. Nearly all of it is three.js's
`WebGLRenderer`: tree-shaking leaves little else to cut.

## Frame rate

The sim never sees the frame rate. `step()` advances exactly `config.step` = 1/120 s, and all speeds are metres per second.
Each animation frame the clock converts the rAF timestamp into steps: the delta is clamped to 0.1 s, at most 8 steps run
in a frame (anything past that is dropped, so a slow device or a stall slows the game for a moment instead of jumping it
forward or spiralling), and the leftover fraction of a step is the `alpha` the view interpolates by. The clock resets on the
first frame, on resume and when the tab's visibility changes. The renderer's pixel ratio is capped at 2 (1.5 on touch), and
the canvas follows the container through a ResizeObserver.

The tests play the same course with the same inputs at 30, 60, 120, 144 and 240 Hz, and at 60 Hz with a 2-second stall in the
middle: the crash, the obstacle that ended the run, the distance, the pickups and the score are the same (the steps are
identical; only the frame an input lands in moves). Equal play time covers equal distance within one step at any rate. A 2 s
stall advances at most 8 steps and cannot skip through an obstacle. Inputs are given as a player gives them: on the first
frame that shows the rover past a point.

## Fairness

Every row leaves a lane the rover can pass (never three slabs). The gap before a row is long enough that from **any** lane
a player could have used to pass the previous row, some lane of the new row is reachable: after the rover has cleared the
previous row, a reaction time (0.25 s), then the lane changes and the vertical move, which can overlap (lane changes work in
the air and while sliding). The vertical move costs:

- from the ground or a slide: a jump needs its lead (the time to rise above a barrier); a slide starts at once (jump cancels
  a slide);
- from a jump: another jump waits for the landing (counted as a whole jump), a slide waits for the slam.

So a course never asks for "two lane changes and a jump" faster than both can be done. Spacing uses the speed the rover will
have on arrival (an upper bound, since the speed only rises), plus a random 0.45 to 1.3 s that shrinks by up to 45% at the cap.

`generator.vitest.ts` checks this two ways: the structure of 10,000 seeded courses of 60 rows at 12, 18, 23 and 28 m/s, and
a bot that plays 2,000 seeded courses at those speeds, and 60 long ones on the speed curve, through the real sim, only acting
after the reaction time, and never crashes. It does crash on a deliberately unfair course, so the check has teeth.

## Config knobs

All in `src/game/runner/config.ts` (`RUNNER_CONFIG`); `withConfig({...})` makes a variant.

| Knob | Default | Effect |
| --- | --- | --- |
| `step`, `maxFrameDelta`, `maxStepsPerFrame` | 1/120 s, 0.1 s, 8 | the fixed step and its safety limits |
| `track.laneWidth`, `track.laneChangeTime` | 2.2 m, 0.14 s | lane spacing, sideways speed |
| `speed.start`, `speed.max`, `speed.rampTime` | 12, 28 m/s, 100 s | the speed curve |
| `jump.height`, `jump.duration`, `jump.buffer` | 1.3 m, 0.62 s, 0.12 s | the jump (gravity is derived) |
| `slide.duration`, `slide.slamSpeed` | 0.65 s, 18 m/s | the slide and the slam |
| `hitbox.*` | see file | collision boxes of the rover and each obstacle, pickup radius |
| `spawn.ahead`, `spawn.behind`, `spawn.firstRowAt` | 160, 12, 70 m | how far the course is made and kept |
| `generator.reactionTime` | 0.25 s | the fairness budget |
| `generator.extraTimeMin/Max/Shrink` | 0.45, 1.3 s, 45% | breathing room between rows |
| `generator.weights`, `generator.kinds` | see file | one, two or three obstacles per row (start → cap); kind odds |
| `generator.pickup*` | see file | pickup chance, spacing, line length, heights |
| `score.pickupBonus`, `score.restartDelay` | 5 m, 0.35 s | |
| `input.*` | 30 px, 1.25, 12 px, 350 ms | swipe threshold, dominance, tap slop and length |
| `render.*` | see file | pixel ratio caps, camera, fog, rings |

## Tuning difficulty

- **Harder sooner:** lower `speed.rampTime`, raise `speed.start`; raise the `wall` and `double` weights.
- **Tighter rows:** lower `extraTimeMin/Max` or raise `extraTimeShrink`. These never go below fair.
- **Less forgiving:** lower `generator.reactionTime`. This one moves the fairness line itself; keep it at 0.2 s or more.
- **Different moves:** `jump.*`, `slide.*` and `track.laneChangeTime` change both the feel and the fairness arithmetic.

After any change run `npx vitest run src/game/runner`: the fairness and frame-rate tests replay thousands of courses with
the new numbers.

## How the next steps plug in

- **Step 2, the look:** replace the art in `render.ts` (models, materials, lights, effects) and restyle `runner.css`. Keep
  the `View` interface (`resize`, `render(sim, alpha)`, `dispose`) and keep it read-only: nothing in the sim should change.
  Colours go in `RUNNER_COLORS` with the token each comes from. Dispose everything you create.
- **Step 3, the 404 page:** mount it lazily, as the fixture does: a focusable, positioned container with its instructions as
  text, the game loaded with `import()` on the first key or tap, `destroy()` if the page ever unmounts it. Import
  `runner.css` in that page only. Mind the page's budgets: the chunk only loads on interaction, so the 404 page's first load
  stays as it is.
- **Step 4, QA:** `tests/runner.spec.js` and the unit tests are the base; the fixture's `?seed=N` repeats a course.

## Tests

- Unit (Vitest): `sim.vitest.ts` (speed curve, phases, lanes, jump, slide, collisions per obstacle, the clock, frame-rate
  independence), `generator.vitest.ts` (fairness), `input.vitest.ts`, `storage.vitest.ts`, `index.vitest.ts` (mount and
  destroy on a small fake DOM: no listener, frame, observer or element left).
- End to end (Playwright): `tests/runner.spec.js` on the fixture, with WebGL on SwiftShader: loads only when asked, no console
  errors, keyboard play to a crash and a restart, best score saved and blocked storage, lanes and no page scroll, synthetic
  swipes, the focus ring, axe in every state, no horizontal scroll at 320, 375 and 1280 px, unmount and mount again, and
  the WebGL fallback. The fixture is in `tests/routes.js`, so the shared smoke, axe, budget, audit, keyboard and Lighthouse
  checks run on it too (before the game loads).

## Design references

The author's three approved concept images, for the look pass (they are concepts, not specs: shapes, mood and the HUD).

- `docs/runner-concepts/key-art.png`: the rover in the ring tunnel, slab, barrier and broken-link pieces, asteroids.
- `docs/runner-concepts/gameplay.png`: the in-game view, a gate and a barrier, a line of pickups, the HUD top right
  (`01248 m`, `BEST 03850 m`).
- `docs/runner-concepts/obstacles.png`: the rover from three sides (six wheels, beacon), the slab with `404`, the barrier,
  the gate, the broken link and ring pieces, pickups and a crash burst.

Differences in this prototype, on purpose: the track has four hairlines (both edges and the two lane lines) as in the
gameplay concept; the broken-link and ring-fragment obstacles, the asteroids and the crash burst are left to the look pass.
