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
| `render.ts` | the Three.js view: reads the sim, draws the rover, obstacles and pickups; `createView()` is null without WebGL |
| `environment.ts` | the world around the track: sky, planet, stars, ring tunnel, track, rocks, glows, lights, fog (below, "The world") |
| `world.ts` | the world's motion as pure maths: scroll, easing, fades, ring slots, the planet's place |
| `index.ts` | `mountRunner(container, options)`: DOM, HUD, the loop, pause rules, resize, cleanup; the words (`RUNNER_TEXT`) |
| `runner.css` | the HUD's styles, tokens only; imported by the page that hosts the game, never global |

```ts
const { mountRunner } = await import('../game/runner/index'); // a separate lazy chunk, three.js included
const game = mountRunner(container, { seed, variant: 'blended', onStats }); // { start, pause, resume, destroy }
game.start();
// later
game.destroy(); // removes the canvas and HUD, every listener, the animation frame, the ResizeObserver, the WebGL context
```

The **host** supplies the container: positioned (the game fills it with `position: absolute; inset: 0`), focusable
(`tabindex="0"`) with a visible focus ring, an accessible name, and its instructions as text pointed to by `aria-describedby`.
The fixture uses `role="application"` so screen readers pass the keys through. The game adds a canvas (`role="img"`,
`aria-label="Endless runner game"`), the score, a message and a polite live region that says "Game over, score N". The root
carries `data-runner-state` (`ready`, `playing`, `over`, `unsupported`), `data-runner-paused`, `data-runner-lane` and
`data-runner-variant`, for the tests and for the steps after this one.

`variant` is how the game meets its page: `blended` (the default, for the 404 page, concept 6) lays gradients from the page's
background over the scene's top and sides (`.runner-blend`, `aria-hidden`, no pointer events), and the canvas clears to the
same `--bg`, so there is no box and no edge; `framed` leaves them out, for a host that draws its own frame (the fixture's
hairline border). The fixture shows `framed`, or `blended` with `?variant=blended`.

**Three.js** (`three`, MIT) is the one runtime dependency added. It is imported by name in `render.ts` only, and only
`index.ts` is imported dynamically, so it is never in a page's first load. The lazy chunk is about 551 kB, **138 kB
gzipped** (2026-10-23 build, three 0.186); nearly all of it is three.js's `WebGLRenderer`, and tree-shaking leaves little
else to cut. The fixture page's own script is 1.3 kB, plus Vite's 1.5 kB preload helper (docs/DECISIONS.md, the runner).

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
| `render.*` | see file | pixel ratio caps, camera, fog, rings (`ringSpacing` 9 m, `ringCount` 18) |
| `WORLD` (in `world.ts`) | see file | the idle cruise (6 m/s), the eases (0.8 s, 0.6 s), the dim after a crash, the closed fog, rocks, the planet's size and place |

## Tuning difficulty

- **Harder sooner:** lower `speed.rampTime`, raise `speed.start`; raise the `wall` and `double` weights.
- **Tighter rows:** lower `extraTimeMin/Max` or raise `extraTimeShrink`. These never go below fair.
- **Less forgiving:** lower `generator.reactionTime`. This one moves the fairness line itself; keep it at 0.2 s or more.
- **Different moves:** `jump.*`, `slide.*` and `track.laneChangeTime` change both the feel and the fairness arithmetic.

After any change run `npx vitest run src/game/runner`: the fairness and frame-rate tests replay thousands of courses with
the new numbers.

## Playtest (2026-10-23, default config)

Measured on the sim (40 seeds) and seen in headless Chromium on SwiftShader at 1280x720 (keys) and 390x844 (touch, 3x
screen): 60 fps, 2 steps a frame, no console messages, and seed 11 ends at exactly 87.5 m at both sizes.

| | 30 s | 60 s |
| --- | --- | --- |
| Speed | 20.2 m/s | 25.4 m/s (cap 28 at 100 s) |
| Distance, perfect bot (no crash in 40 runs) | 490 m | 1,181 m |
| Rows passed | about 20 | about 47 |
| Gap between rows, median (shortest) | 1.2 s (0.7 s) | 1.0 s (0.6 s) |
| Rows with two / three obstacles | 39% / 18% | 45% / 25% |

Doing nothing crashes at a median of 89.5 m after 6.9 s (68.9 to 180.3 m), on a slab, gate or barrier about equally. In 62 s
the bot jumps about 10 times, slides about 11 times and changes lane about 17 lanes' worth.

How it plays: the lane change (0.14 s) and the slide are crisp; the jump (0.62 s, 7 m long at the start speed) is on the
floaty side; the first 5.8 s before the first row is too long for a game you meet on an error page; the ramp is steep early
(12 to 20 m/s in 30 s) and flat late. A crash has no feedback yet (the rover just stops); that is the look pass's. On a phone
the 16:9 stage is about 200 px tall and far obstacles are specks, so step 3 should give the game more height there.

Suggested first tuning, not applied: `spawn.firstRowAt` 70 → 40 m; `jump.duration` 0.62 → 0.56 s; `speed.rampTime` 100 →
120 s for a gentler middle. Re-run the unit tests after any of them.

## How the next steps plug in

- **Step 2, the look:** replace the art in `render.ts` (models, materials, lights, effects) and restyle `runner.css`. Keep
  the `View` interface (`resize`, `render(sim, alpha)`, `dispose`) and keep it read-only: nothing in the sim should change.
  Colours go in `RUNNER_COLORS` with the token each comes from. Dispose everything you create.
- **Step 3, the 404 page:** mount it lazily, as the fixture does: a focusable, positioned container with its instructions as
  text, the game loaded with `import()` on the first key or tap, `destroy()` if the page ever unmounts it. Import
  `runner.css` in that page only. Mind the page's budgets: the chunk only loads on interaction, so the 404 page's first load
  stays as it is.
- **Step 4, QA:** `tests/runner.spec.js` and the unit tests are the base; the fixture's `?seed=N` repeats a course, and `?start=0` mounts the game on the ready screen instead of starting a run.

## The world (step 2b)

`environment.ts` builds everything around the track, in code: no files, no downloaded assets, no post-processing. Its only
textures are four canvases of at most 64 x 128 px (a soft glow, the lane dashes, the planet's ring bands, the track's sheen).

- **Sky, its own pass.** `drawSky(camera)` clears the canvas to obsidian (`--bg`) and draws the sky scene with a camera that
  copies the game camera's rotation and almost none of its position: it never moves with the lanes and the game camera's far
  plane never cuts it. The game's scene is drawn over it; its obsidian ground hides the sky under the horizon, and a haze band
  (obsidian, clear a few degrees up) softens the line where they meet.
- **The planet:** a low-poly sphere (320 facets) with latitude bands in `--surface-2`, `--text-3-app` and `--brass-deep`,
  shaded per facet by its own light (a small shader: one light, a terminator, a thin ivory limb), and a tilted ring system
  (ivory and faint brass bands). About a third of the view high, left of the vanishing point, its base under the horizon; in
  a narrow view it shrinks to fit (`planetPlacement()`). It spins 4 degrees a minute.
- **Stars:** 360 points, ivory at low brightness, no twinkle.
- **The ring tunnel:** 18 flat brass rings 4.5 cm wide, one instanced draw, additive. They scroll with the world, fade in from
  150 m, fade out just before the camera, and are recycled to the far end (`slotZ()`). Each casts a faint band of light on the
  track under it.
- **The track:** `--surface-1`, two lane hairlines with dashes scrolling at the world's speed, ivory edge hairlines with a
  brass line inside, a soft brass sheen from the vanishing point, all in obsidian fog: the horizon has no edge.
- **Rocks:** 28, low and faceted, from four shapes (one instanced draw each), at least 9.5 m from the centre line, so the
  lanes and the middle of the view stay empty. Dark (`--surface-3`) with a faint ivory rim.
- **Light:** a soft ivory key from above and behind the camera, an ivory rim light from far ahead, a low brass fill, a little
  ambient; no shadow maps and no blob shadows (on a track this dark they would not show). The environment owns the scene's
  lights and fog (it replaces those made before it).
- **Brass glow** without post-processing: additive quads with the glow texture at the vanishing point and behind each pickup.

**Motion** (`world.ts`, `WorldMotion`). The world scrolls by its own offset, never the sim's distance, advanced in the sim's
fixed steps (the view counts `sim.steps`), so it is frame-rate independent, interpolated like the sim, and stops whenever the
loop stops (a hidden tab, a pause).

| | Ready (the idle scene) | Playing | Game over |
| --- | --- | --- | --- |
| World speed | 6 m/s cruise | eases into the sim's speed over 0.8 s, then equals it | eases to a stop over 0.6 s |
| Fog | closed (14 to 64 m): no obstacles in view | eases open to 35 to 150 m: the rows come out of it | closes again |
| Rings and glows | a slow brass pulse (`--dur-orbit` / 3, as the prompt's hairlines) | steady | dimmed by 45% |

With `prefers-reduced-motion` the idle scene is a still frame (no scroll, no pulse, no spin) and every change is immediate; a
run still moves, since that is the game. A restart is a new run: the world eases back up from its stop.

**HUD and overlays** (`runner.css`): "Off course" in Cormorant Garamond, sized by the game's own box (a size container), in the
sky above the tunnel; the score top right in JetBrains Mono, the best and pickups smaller and dimmer (on a small stage they
step aside at game over, when the result line says the same); the prompt in small mono capitals at the bottom between two
brass hairlines that breathe while idle. Soft pools of the background behind the words, no boxes. The message fades and
settles a few pixels between states (`hidden` stays the switch; CSS keeps it laid out until the fade ends).

**Budgets**, measured in the fixture (SwiftShader, 1280 x 720, seed 11): the environment is about 5,400 triangles and 20 draw
calls (sky 4, track 7, tunnel 2, vanishing point 2, rocks 4, pickup glows 1 when any are near). The whole frame, with the placeholder rover and
the obstacles and pickups in range: 12,438 triangles and 49 calls in the idle scene, 13,500 to 13,900 and 65 to 68 in a run,
15,010 and 80 after a crash (the fogged rows still count); 25 to 27 geometries and 5 textures on the GPU. No allocation per
frame: instances are written in place. Everything is disposed in `dispose()`.

**In `render.ts`** the environment is one block and four calls, each marked `// environment (step 2b)`: create it after the
lights, `env.update(sim, alpha)` in place of the old ring scroll, `env.drawSky(camera)` before `renderer.render`, and
`env.dispose()`. `View.info()` (optional) passes its numbers to `onStats` as `view`, for the fixture's readout. The old light
and fog lines above the block are dead once the environment replaces them; delete them when steps 2a and 2b are merged.

## Tests

- Unit (Vitest): `world.vitest.ts` (ring slots and recycling, fades, the idle scroll, the eases into a run and to a stop,
  the pulse, reduced motion, the planet's place), `sim.vitest.ts` (speed curve, phases, lanes, jump, slide, collisions per obstacle, the clock, frame-rate
  independence), `generator.vitest.ts` (fairness), `input.vitest.ts`, `storage.vitest.ts`, `index.vitest.ts` (mount and
  destroy on a small fake DOM: no listener, frame, observer or element left).
- End to end (Playwright): `tests/runner.spec.js` on the fixture, with WebGL on SwiftShader: loads only when asked, no console
  errors, keyboard play to a crash and a restart, best score saved and blocked storage, lanes and no page scroll, synthetic
  swipes, the focus ring, axe in every state, no horizontal scroll at 320, 375 and 1280 px, unmount and mount again, and
  the WebGL fallback; since step 2b also the idle scene (the world scrolls while the distance stays 0), reduced motion (a
  still frame, the game still plays), both variants (the blend, axe, no layout shift, no horizontal scroll at 320, 375 and
  1280 px) and the triangle budget in every state. The file runs one test at a time (`mode: 'default'`): each runs WebGL on
  the CPU, and ten at once starved each other into timeouts. The fixture is in `tests/routes.js`, so the shared smoke, axe, budget, audit, keyboard and Lighthouse
  checks run on it too (before the game loads).

## Design references

The author's three approved concept images, in `docs/runner-concepts/` (its README says where each came from). They are
concepts, not specs: shapes, mood, the HUD and the page layout.

- `gameplay.png` (concept 2): the in-game view, a gate and a barrier, a line of pickups, the HUD top right
  (`01248 m`, `BEST 03850 m`). The prototype's camera, lanes and HUD follow it.
- `obstacles.png` (concept 3): the rover from three sides (six wheels, beacon), the slab with `404`, the barrier, the gate,
  the broken link and ring pieces, pickups and a crash burst. The look pass models these.
- `blended-fade.png` (concept 6, the 404 page the author chose): "Page *not* found", a line and "Back to home" over the
  game, which fills the page and fades into it, low-poly rocks beside the track, the score on the right, "Press space to
  play" at the bottom. This is the target for step 3; the words on it are the mock-up's, not decided copy.

Differences in this prototype, on purpose: the track has four hairlines (both edges and the two lane lines) as in the
gameplay concept; the broken-link and ring-fragment obstacles, the rocks and asteroids, the striped barrier and the crash
burst are left to the look pass.
