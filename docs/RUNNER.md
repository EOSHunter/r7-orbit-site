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
| Gate | an overhead arch (a beam on two posts) | crouch (hold) under the beam |
| Wall | a thin full-height curtain across the track with one lane left open, the opening marked by brass hairlines (from 500 m) | the open lane |
| Sweeper | a tall hexagonal pylon swaying between two lanes along a brass line (from 1,000 m) | the third lane, or the lane it has left open when you arrive |

Brass dots come in lines between the rows (and over a barrier, on the jump; under a gate, crouched), and lead along the
harder way through a row and through combinations. Each one adds 1 to the pickup count and 5 m to the score.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Start, restart, resume | Space | tap |
| Change lane | Left / Right arrow, A / D | swipe left / right |
| Jump | Up arrow, W, Space (while playing) | swipe up |
| Crouch (hold) | Hold S or Down arrow | swipe down and keep the finger down |

Keys are heard only while the game's container has focus, and Space and the arrows do not scroll the page then. A swipe
counts once the finger has moved 30 px along one axis and that axis is at least 1.25 times the other; shorter or diagonal
moves do nothing, and a short still press is a tap. One swipe per touch, except while a finger is holding a crouch: a swipe
left, right or up from where the crouch began then changes lane or jumps (see "Hold to crouch").

## Rules

- **Score** = whole metres driven + 5 per pickup, shown as five digits (`00420 m`). The **best score** is under it, dimmer.
- **Speed** starts at 13 m/s and rises to the cap, 40 m/s, over 180 s of play, on a smooth curve (see "Difficulty and bots").
- **States:** ready ("Press space to play" / "Tap to play"), playing, game over (score, best, "Press space to try again" /
  "Tap to try again"). A restart is ignored for 0.35 s after a crash, so a key still held does not restart by accident.
  The words switch to the touch ones on a coarse pointer or at the first touch.
- **Paused** when the tab is hidden, the window loses focus, or keyboard focus leaves the game during a run. Space or a tap
  resumes (that press does nothing else).
- **Jump:** 1.3 m high, 0.62 s long. No double jump; a jump pressed up to 0.12 s before landing happens on landing.
- **Crouch:** the rover is low for exactly as long as S or Down is held (see "Hold to crouch"). Jump cancels it. Crouch in the
  air slams the rover down and it crouches on landing.
- **Lanes:** one lane per press, 0.14 s per lane, also in the air and while crouched; the edges stop it.
- **Best score** is saved only in the visitor's browser: `localStorage`, key `r7-runner-best`. Nothing is sent anywhere.
  Every access is in `try/catch`: with storage blocked (private browsing, a sandboxed frame) the best lasts for the visit.
- **Without WebGL** the game shows "This game needs WebGL." and nothing else.

## Architecture

`src/game/runner/`, pure logic apart from the rendering:

| File | What it does |
| --- | --- |
| `config.ts` | every tunable number (below), the scene colours, `speedAt()` and the jump's gravity |
| `random.ts` | mulberry32, a small seeded generator: the same seed is the same course |
| `generator.ts` | patterns of rows (tiers, combinations, the wall, the sweeper), pickup lines, and the fairness arithmetic |
| `hazards.ts` | the look of the wall and the sweeper: four instanced draw calls, called from a marked block in `render.ts` |
| `bots.ts` | the bots (novice, average, expert, perfect, idle) that play the real sim headless, and the summary table; run by `npm run runner:bots` (`scripts/runner-bots.mjs`) |
| `sim.ts` | `RunnerSim`: state, `step()` (exactly one fixed step), lanes, jump and held crouch, collisions, spawning, score |
| `clock.ts` | `FixedStepClock`: frame timestamps to a number of steps and an interpolation `alpha` |
| `input.ts` | keyboard, swipe and tap to intents (`left`, `right`, `jump`, `crouch` / `crouchTouch` / `crouchEnd` / `crouchCancel`, `primary` = Space, `start` = tap) |
| `storage.ts` | best score load and save |
| `render.ts` | the Three.js view: reads the sim, draws the scene; `createView()` is null without WebGL |
| `rover.ts` | the rover: loads `assets/rover.glb`, animates it from the sim, the dust trail and the crash burst (below) |
| `camera.ts` | `ChaseRig`, the chase camera, the hit-stop and the shake (below) |
| `assets/rover.glb` | the rover model, built by `tools/runner/build_rover.py` (never edited by hand) |
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
else to cut. Step 2a added `GLTFLoader` and the rover: **648 kB, 165 kB gzipped**, plus the 59 kB model, fetched after
the game starts. The fixture page's own script is 1.3 kB, plus Vite's 1.5 kB preload helper (docs/DECISIONS.md, the runner).

## The rover

A six-wheeled rover after concept 3's silhouette (`docs/runner-concepts/obstacles.png`): a long, low, faceted ivory hull over
a narrower ivory skirt and a dark underbody, recessed obsidian slits (a visor at the front of the deck, one along each side of
the deck and of the belt line, one across the tail), a recessed deck hatch, six dark wheels with chunky tread blocks and
recessed ivory hub caps, a dark rocker-bogie suspension with ivory joint caps, and a thin mast with the brass beacon. Brass is
on the beacon only (the concept's brass hubs and lights are left out: brass is the site's one accent). Preview, three views:
`docs/runner-concepts/rover-preview.png`.

**Rebuild it:** `blender -b --factory-startup -P tools/runner/build_rover.py` (add `-- --preview` to render the preview
too). Blender 5.1; on Windows it is `C:Program FilesBlender FoundationBlender 5.1lender.exe`. The script is the only
source: every size, colour and detail is a number in it, so the same Blender gives the same file. It prints the triangle count
and the file size; keep them under 6,000 and 150 kB.

| | |
| --- | --- |
| Size | 1.69 m across the wheels, 2.6 m long, 1.18 m to the deck, in the model; the game scales it to 0.6 of a lane (1.32 m wide, 2 m long), a little larger than its hitbox (1.0 by 1.4 m), so a near miss can look like a graze |
| Budget | 3,406 triangles, 13 meshes, 59 kB; no textures, UVs or normals; no Draco or meshopt (no decoder) |
| Colour | per vertex, linear, from the tokens: `--text` shell, hub and joint caps; `--surface-2` tyres and underbody; `--surface-3` suspension and mast; `--bg` slits. A small ambient-occlusion pass (rays against the rover and the ground) darkens crevices. Beacon: `--brass`, glowing `--brass-highlight` |
| Shading | flat: the file has no normals, so three.js shades each facet flat. Materials are replaced in `rover.ts`: one `MeshStandardMaterial` with vertex colours (roughness 0.55), one emissive one for the beacon |
| Axes | +Y up, facing -Z (glTF); Blender builds it Z up facing +Y |

**Node names** (the contract with `rover.ts`): `rover` (root, on the ground); `rover_body` (shell, bobs and rolls on the
suspension); `antenna` (pivot at its foot, folds back while crouched) with `beacon` in it; `rocker_L`, `rocker_R` (pivot at the
body joint) carrying `wheel_FL` / `wheel_FR` and `bogie_L`, `bogie_R` (pivot at the rocker joint), which carry `wheel_ML`,
`wheel_RL` / `wheel_MR`, `wheel_RR`. Each wheel's origin is its axle, so a rotation about local X spins it.

**Loading:** the file is imported as a Vite asset URL (`?url`, hashed) and fetched with `GLTFLoader` after the game mounts.
Until it arrives, or if it fails (missing, broken), a primitive stand-in with the same node names is drawn and the game plays
on; nothing is thrown. `destroy()` frees both.

**Animation**, all drawn from the sim's interpolated state and the frame's dt, never written back:

- wheels turn by the distance driven over their radius (rolling, any frame rate);
- the body bobs a little with distance and speed, rockers and bogies rock a degree or so, and a landing dips the body on its
  spring (harder when it slams into a crouch);
- in the air the rover tips back up to 4 degrees while rising; a crouch drops the body 8 cm, tips it forward 2.5 degrees and
  folds the antenna back flat (so the rover is under a gate's beam), and holds it there for as long as the key is held;
- a lane change yaws the rover up to 7 degrees towards the new lane and rolls the body up to 3 degrees away from the turn,
  both easing back as it arrives;
- the beacon's emissive glow and a soft halo pulse, from 0.6 Hz at the start speed to 2.4 Hz at the cap;
- a faint brass dust trail behind the rear wheels: a fixed pool of 120 additive points, 0.3 to 0.55 s each;
- a crash: after the hit-stop, 22 brass shards burst from the nose (0.55 s), dust is thrown up, the beacon flashes, and the
  rover is pushed back 45 cm with a small hop, tipping and turning a few degrees.

**Reduced motion** (`prefers-reduced-motion: reduce`): the wheel spin, trail, yaw, crouch drop, antenna fold and burst stay
(they say what the rover is doing); the bob, pitch, roll, landing dip, tumble and the camera shake go.

## Camera

`ChaseRig` (`camera.ts`) fixes the camera to the **track**, which is what stopped the view from switching perspective: it
stays 3.1 m up and 6.4 m back whatever the rover does, follows 40% of the rover's sideways offset through a critically damped
spring (0.32 s), never moves up or down with a jump or a crouch, never rolls, and always looks at one point 14 m ahead on the
track's centre line, 0.9 m up, so the horizon is level and still. The field of view eases from 58 degrees at the start speed
to 64 at the cap. A crash holds the picture for 90 ms (a hit-stop: the view's own motion stops, the sim's time is not
touched), then shakes it for 150 ms, at most 7 cm, damped (none with reduced motion). Every number is a named constant at
the top of `camera.ts`, and every rate uses the frame's dt.

Render cost (Chromium on SwiftShader, whole frame, this step's scene): about 49 draw calls and 21,500 triangles on the ready
screen, 61 and 21,700 while playing; the rover's share is 15 draw calls (13 meshes, the halo, the trail; 16 with the crash
burst) and 3,408 triangles, where the prototype's boxes were 9 calls and a few hundred triangles.

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
the air and while crouched). The vertical move costs:

- from the ground or a crouch: a jump needs its lead (the time to rise above a barrier); a crouch needs its ease in (60 ms)
  (a jump cancels a crouch);
- from a jump: another jump waits for the landing (counted as a whole jump), a crouch waits for the slam.

So a course never asks for "two lane changes and a jump" faster than both can be done. Spacing uses the speed the rover will
have on arrival (an upper bound, since the speed only rises); how much time a gap gets beyond that minimum is the
difficulty (below). A wall panel and a sweeper count as blocked lanes, like a slab, so every row still has a way through.

`generator.vitest.ts` checks this two ways: the structure of 7,500 seeded courses of 40 rows at 13, 20, 27, 34 and 40 m/s
with every pattern and hazard allowed from the first row, and a bot that plays 1,000 of them (and 80 long ones on a fast
speed curve with the real tiers) through the real sim, acting only after the reaction time, and never crashes. It does crash
on a deliberately unfair course, so the check has teeth.

<!-- hold to crouch + difficulty and bots: start (the 2026-10-24 job; the sections between these marks are its) -->

## Hold to crouch

The rover is crouched (antenna down, hitbox 0.5 m high, so it passes under a gate) for exactly as long as the key is held. There
is no timer and no auto-recovery.

| | Keyboard | Touch |
| --- | --- | --- |
| Starts | S or Down arrow pressed (key repeat is ignored: holding is one press) | a swipe down |
| Lasts | while any crouch key is down (S and Down together: until the last is let go) | while the finger stays down after the swipe, and at least `touchMinCrouch(speed)` |
| Ends | the keyup; then the rover stands up over `crouch.outTime` (0.1 s), never while held | the pointerup, pointercancel or lostpointercapture |

- **The crouch amount** (`sim.crouch`, 0 to 1) eases up over `crouch.inTime` (60 ms) after the press and down over 100 ms from
  the release. The collision box follows it (1.1 m standing, 0.5 m crouched), so a gate is passed only while crouched, and a
  release under the beam costs: the box is back above the beam's underside 75 ms later, so letting go with more than that left
  under the beam is a crash, and at 40 m/s (the whole gate takes 47 ms) it is harmless. The fixture shows it as `crouch` in the
  debug readout (1.00 while held). `rover.ts` reads `sim.sliding`, which is now `sim.crouching`, so it needed no change; the
  camera does not react to a crouch.
- **Touch minimum:** a flick down is a crouch of at least `touchMinCrouch(speed)`: 0.35 s at the start speed (`crouch.touchMinTime`),
  the same distance at higher speeds, and never less than the time to get under and through the longest gate with a quarter
  to spare (1.25 x (rover + gate length) / speed + the ease in). At 40 m/s it is 0.12 s.
- **Lane changes** work while crouched and do not end it. **A jump wins over a crouch** (it also covers a buffered jump): it
  cancels the hold, and the key, still down, has to be pressed again (key repeat does not bring the crouch back, so a jump is
  not pulled out of the air by a held S). **Crouch in the air** slams the rover down at 18 m/s and it is crouched on landing if
  the key is still held (a swipe in the air starts its minimum on landing). While holding with a finger, a swipe left or right
  from where the crouch began changes lane, a swipe up jumps (which ends the crouch), and another swipe down crouches again.
- **Cleared, so the rover is never stuck low:** a crash, a restart (and a key pressed on the ready or game-over screen, which
  is ignored); `input.release()` (intent `crouchCancel`, which also forgets the touch minimum) when the game pauses or
  resumes, the window blurs, the tab is hidden, or the container loses focus; a new finger replacing one whose pointerup was lost.
  A keyup that happened while the page was away is never heard, so after any of these the key has to be pressed again.
  Pointer capture is taken on pointerdown so a finger (or a mouse) that leaves the game's box still delivers its pointerup.
- **Frame rate:** the sim sees `crouch` and `crouchEnd` as intents applied at the start of a step, like the others, so a held
  crouch is the same number of steps at 30, 60, 120, 144 and 240 Hz and across a 2 s stall (`sim.vitest.ts`).

## Difficulty and bots

**Targets (approved):** a first-time player lasts about 30 to 45 s, a good player a few minutes, the speed rises steadily, the
course is fair but demanding. Kept as they were: three lanes; slab (change lane), barrier (jump), gate (crouch) always
passable; a passable route with enough reaction time in every row; the fixed 1/120 s step; the seeded generator; scoring.

### The course

- **Speed** 13 m/s rising to 40 m/s over 180 s: `13 + 27 * (1 - (1 - t/180)^1.6)`, about 0.24 m/s every second at first, 20 m/s
  after 30 s, 29 m/s after 80 s, and it eases into the cap (no jolt). The speed never depends on the player, so the rover's
  place at any play time is known (`distanceAt`, `timeAtDistance` in `config.ts`).
- **Reaction window.** Between patterns the clear running time, from the rover clearing a row to reaching the next, is 2.3 s at
  the start speed shrinking to 0.6 s at the cap, plus a random extra of up to 1.1 s shrinking to 0.3 s; tier 2 and tier 3
  close both by 10% and 22%. The rows inside a pattern are only `margin` (0.06 s at the start speed, 0.03 s at the cap) more
  than fairness needs. **No gap is ever under 0.45 s** (`generator.minGap`: 18 m at the cap), whatever the speed or pattern.
- **An easy start:** the first obstacle is 105 m out, 8 s of free running, and always in the middle lane (a slab or a barrier),
  where the rover starts, so a run that does nothing ends on it.
- **Tiers by distance, not time.** Tier 1 (0 to 200 m): single obstacles. Tier 2 (from 200 m): also pairs (two obstacles in one
  row) and combinations. Tier 3 (from 1,100 m): also the slalom and chains of three rows, with the tighter spacing.
- **Combinations** (every row forces its way: the other lanes are slabs):

| Pattern | What it asks |
| --- | --- |
| `barrierGate` | jump and at once crouch in the same lane, or crouch then at once jump |
| `gateDodge` | crouch under a gate, then at once a lane change (to a free lane, a barrier or a gate) |
| `dodgeJump` | a slab in your lane, the free lane beside it a barrier: lane change, then jump (or crouch) |
| `trio` | one row with a slab, a barrier and a gate |
| `slalom` | across the track: one side, then the other (tier 3) |
| `chain3` | three forced rows in a row, any lane, any move (tier 3) |

- **The wall with one opening** (from 500 m; `wall`, and `wallSlalom` for two walls with the openings at opposite sides). Every
  lane but one is a wall panel (3.2 m tall, 0.3 m thick: the rover cannot clear it or slip through between two steps even at
  40 m/s); the open lane is the way through, with a barrier or a gate in it a quarter and a fifth of the time. Telegraphed in
  brass: a hairline up each edge of the opening and one across it on the track. Different from a slab by shape: a thin
  full-width curtain, no `404` on it.
- **The sweeper** (from 1,000 m): a hexagonal pylon, narrower at the top, with a brass band, swaying between two lanes along a
  sine (3.4 s there and back, slowest at the ends, at most 2 m/s sideways) over a brass line on the track that shows the whole
  swing. The third lane is never blocked (empty, a barrier or a gate), so there is always a way through, and the generator
  sets the sweeper's phase from the rover's known arrival time so that it is over one of its two lanes exactly when the rover
  gets there: the other lane is open then. The fair route is the third lane; the reward is pickups in the lane it has left
  open. Halfway through its swing it blocks both lanes (tested).
- **Pickups reward risk:** in a pattern with a forced route the line of pickups leads through it (over the barrier, under the gate,
  through the wall's opening, into the sweeper's open lane), nine times in ten; in singles and pairs, six in ten, and then
  65% of the time along the harder way (a jump or a crouch) when there is an easier one.

### The bots

Players made of code (`bots.ts`), run headless through the real `RunnerSim`: each step they look at what the sim shows and press
the same intents a player does, a crouch held and let go like a key (pressed shortly before a gate, let go once the rover has
cleared it). A bot starts to think about a row when it has noticed it (within `sight` seconds of travel) and the row before has
been cleared; after its `reaction` time it picks the way that needs the least time, steers, and jumps or crouches at the
middle of the window, within its timing noise. With chance `mistake` per row that needs an action it errs: the wrong lane, a
forgotten action (both noticed `noticeLag` later and put right if there is time), a slow reaction (+0.25 s), a mistimed jump,
or (under a gate) letting go too early. Nothing crashes it by script: the sim decides. Everything comes from a seeded generator,
so a run is a pure function of (bot, seed, config).

| Bot | Reaction | Mistakes | Timing noise | Notes |
| --- | --- | --- | --- | --- |
| `novice` | 350 ms | 15% | 70 ms | notices a row 1.4 s ahead |
| `average` | 250 ms | 8% | 40 ms | exactly the generator's fairness budget |
| `expert` | 140 ms | 2% | 20 ms | |
| `perfect` | 0 | never | 0 | the oracle: also picks the lane that keeps the row after next easy to reach |
| `idle` | | | | presses nothing |

`npm run runner:bots` plays 300 seeded runs per bot (`-- --runs N`, `-- --bots novice,expert`, `-- --max 600` seconds of play
at most, `-- --json`) and prints the tables below; about 100 s. Run lengths are capped at 600 s.

### Results

**Before** (the first difficulty, 12 to 28 m/s over 100 s, the old patterns, the hold-to-crouch rule; 300 runs per bot):

| Bot | Runs | Median time | Mean time | 90th pct time | Median distance | Mean distance | 90th pct distance | Alive at cap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| idle | 300 | 5.4 s | 6.5 s | 8.7 s | 69 m | 85 m | 116 m | 0 |
| novice | 300 | 53.2 s | 62.1 s | 114.4 s | 1012 m | 1311 m | 2670 m | 0 |
| average | 300 | 194.9 s | 235.3 s | 534.4 s | 4924 m | 6092 m | 14429 m | 21 |
| expert | 300 | 600.0 s | 466.3 s | 600.0 s | 16267 m | 12533 m | 16267 m | 163 |
| perfect | 300 | 600.0 s | 600.0 s | 600.0 s | 16267 m | 16267 m | 16267 m | 300 |

| Bot | Deaths by obstacle | Deaths by cause | Deaths by speed (m/s) |
| --- | --- | --- | --- |
| idle | slab 127, barrier 99, gate 74 | none 300 | 10-15: 286, 15-20: 14 |
| novice | barrier 167, slab 95, gate 38 | none 135, mistime 74, forget 46, wrongLane 24, slow 12, earlyRelease 9 | 10-15: 14, 15-20: 53, 20-25: 90, 25-30: 143 |
| average | barrier 223, gate 33, slab 23 | mistime 206, none 64, earlyRelease 7, slow 2 | 10-15: 5, 15-20: 24, 20-25: 16, 25-30: 234 |
| expert | barrier 115, gate 22 | mistime 115, none 18, earlyRelease 4 | 10-15: 2, 15-20: 6, 20-25: 2, 25-30: 127 |
| perfect | none | none | none |

The old game was easy: the average bot lasted over three minutes, the expert survived 10 minutes more often than not, and
the deaths of the good bots were almost all a mistimed jump at the cap.

**After** (13 to 40 m/s over 180 s, tiers, combinations, the wall and the sweeper; 300 runs per bot):

| Bot | Runs | Median time | Mean time | 90th pct time | Median distance | Mean distance | 90th pct distance | Alive at cap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| idle | 300 | 7.5 s | 7.5 s | 7.5 s | 104 m | 104 m | 104 m | 0 |
| novice | 300 | 40.1 s | 41.9 s | 64.9 s | 706 m | 781 m | 1311 m | 0 |
| average | 300 | 73.7 s | 76.6 s | 124.5 s | 1553 m | 1738 m | 3200 m | 0 |
| expert | 300 | 177.2 s | 209.2 s | 405.8 s | 5220 m | 6629 m | 14363 m | 11 |
| perfect | 300 | 600.0 s | 600.0 s | 600.0 s | 22131 m | 22131 m | 22131 m | 300 |

| Bot | Deaths by obstacle | Deaths by cause | Deaths by speed (m/s) |
| --- | --- | --- | --- |
| idle | slab 156, barrier 144 | none 300 | 10-15: 300 |
| novice | slab 176, barrier 69, wall 33, gate 22 | none 158, slow 37, wrongLane 34, mistime 33, forget 29, earlyRelease 9 | 10-15: 12, 15-20: 91, 20-25: 96, 25-30: 101 |
| average | slab 167, barrier 71, gate 36, wall 25, sweeper 1 | slow 74, none 69, wrongLane 58, forget 53, mistime 45, earlyRelease 1 | 10-15: 2, 15-20: 31, 20-25: 41, 25-30: 109, 30-35: 79, 35-40: 37, 40-45: 1 |
| expert | slab 153, wall 50, barrier 48, gate 38 | none 154, slow 98, mistime 37 | 10-15: 2, 15-20: 4, 20-25: 6, 25-30: 23, 30-35: 41, 35-40: 80, 40-45: 133 |
| perfect | none | none | none |

| | Target | Now |
| --- | --- | --- |
| idle | dies on the first obstacle within about 12 s | 7.5 s, all 300 on the first row (a slab or a barrier in the middle lane) |
| novice | median about 25 to 45 s | 40 s (90th percentile 65 s) |
| average | median about 60 to 120 s | 74 s (90th percentile 125 s) |
| expert | at least 150 s, high 90th percentile | 177 s median, 406 s at the 90th percentile; 11 runs of 300 lasted the 600 s |
| perfect | survives at the cap for a very long run | all 300 runs lasted 600 s, 420 s of it at the cap (22,131 m); `bots.vitest.ts` plays 12 minutes of it |

How it was tuned: the bots' mistakes are the same in both tables, so the difference is the course. Going from the old numbers to
these, the first pass (13 to 40 m/s, the window and the patterns above) put the novice at 44 s, the average at 60 s and the
expert at 215 s; the 0.06 s margin inside combinations made the novice's 350 ms reaction (0.1 s more than the budget) fail the
tight ones from tier 2 on (44 s to 38 s) while the average's 250 ms still passes them; moving tier 3 from 700 m to 1,100 m, and
widening the window a little (2.1 to 2.3 s, 0.55 to 0.6 s), gave the average and the expert the room to reach their bands
without moving the novice. The expert at the cap dies mostly to its 2% of mistakes, not to speed, which is the sign that the
reaction window (0.45 s minimum) is enough for a player with a 140 ms reaction. The oracle shows the course can be beaten.

<!-- hold to crouch + difficulty and bots: end -->

## Config knobs

All in `src/game/runner/config.ts` (`RUNNER_CONFIG`); `withConfig({...})` makes a variant.

| Knob | Default | Effect |
| --- | --- | --- |
| `step`, `maxFrameDelta`, `maxStepsPerFrame` | 1/120 s, 0.1 s, 8 | the fixed step and its safety limits |
| `track.laneWidth`, `track.laneChangeTime` | 2.2 m, 0.14 s | lane spacing, sideways speed |
| `speed.start`, `speed.max`, `speed.rampTime`, `speed.curve` | 13, 40 m/s, 180 s, 1.6 | the speed curve |
| `jump.height`, `jump.duration`, `jump.buffer` | 1.3 m, 0.62 s, 0.12 s | the jump (gravity is derived) |
| `crouch.inTime`, `crouch.outTime`, `crouch.touchMinTime`, `crouch.slamSpeed` | 0.06 s, 0.1 s, 0.35 s, 18 m/s | the crouch's eases, the touch minimum, the slam |
| `hitbox.*` | see file | collision boxes of the rover and each obstacle, pickup radius |
| `spawn.ahead`, `spawn.behind`, `spawn.firstRowAt` | 160, 12, 105 m | how far the course is made and kept; the free run before the first row (8 s) |
| `generator.reactionTime`, `generator.minGap` | 0.25 s, 0.45 s | the fairness budget; the shortest gap between rows at any speed |
| `generator.window`, `generator.extra`, `generator.margin`, `generator.tighten` | see file | free running between patterns (start speed → cap), a random extra on top, the margin inside a combination, how much tiers 2 and 3 close both |
| `generator.tiers`, `generator.hazards` | 200 / 1,100 m; 500 / 1,000 m | where tiers 2 and 3 begin; where the wall and the sweeper begin |
| `generator.patterns`, `generator.kinds` | see file | the weight of each pattern in each tier; the odds of the three basic kinds |
| `generator.pickup*` | see file | pickup chances, spacing, line length, heights, how often the line follows the risky way |
| `score.pickupBonus`, `score.restartDelay` | 5 m, 0.35 s | |
| `input.*` | 30 px, 1.25, 12 px, 350 ms | swipe threshold, dominance, tap slop and length |
| `render.*` | see file | pixel ratio caps, fog, rings (`ringSpacing` 9 m, `ringCount` 18; `render.camera` and `render.fov` are no longer read: the camera's numbers are in `camera.ts`) |
| `WORLD` (in `world.ts`) | see file | the idle cruise (6 m/s), the eases (0.8 s, 0.6 s), the dim after a crash, the closed fog, rocks, the planet's size and place |

## Tuning difficulty

- **Harder sooner:** lower `speed.rampTime`, raise `speed.start`; bring `generator.tiers` and `generator.hazards` closer; raise
  the weights of the combinations in `generator.patterns`.
- **Tighter rows:** lower `generator.window`, `generator.extra` and `generator.margin`. These never go below fair (and
  `generator.minGap` is the floor).
- **Less forgiving:** lower `generator.reactionTime`. This one moves the fairness line itself; keep it at 0.2 s or more.
- **Different moves:** `jump.*`, `crouch.*` and `track.laneChangeTime` change both the feel and the fairness arithmetic.

After any change run `npx vitest run src/game/runner`: the fairness and frame-rate tests replay thousands of courses with
the new numbers, then `npm run runner:bots` (add `-- --config '{"generator":{"margin":{"start":0.08}}}'` to try a variant
without editing the file) to see what it did to the bots' times.

## Playtest (2026-10-23, the first difficulty: 12 to 28 m/s, slide on a timer; kept as it was, see "Difficulty and bots" for today's)

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
  a narrow view it shrinks to fit (`planetPlacement()`). It turns slowly (see "Atmosphere").
- **Stars:** 360 points, ivory at low brightness (a twinkle since the polish: "Atmosphere").
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
`env.dispose()`. `View.info()` (optional) passes its numbers to `onStats` as `view`, for the fixture's readout. The scene's
lights and fog are made only there (the step 1 ones were removed when steps 2a and 2b were merged).

<!-- atmosphere polish -->
## Atmosphere (polish, 2026-10-24)

After playing step 2 the author asked for four things and nothing else changed: the tunnel rings glow, the stars twinkle, a
shooting star now and then, and the planet turns slowly. The motion is pure maths in `sky.ts` (unit-tested in
`sky.vitest.ts`); `environment.ts` draws it. No post-processing, no new colours (ivory and brass from `RUNNER_COLORS`).

- **Ring glow.** Each brass hairline has a wider soft band round it (0.55 m each side, a gaussian across it from a 64 x 1
  canvas), additive brass, one more instanced draw. Its strength (`ringGlow()`) is 0.13 of brass plus a travelling wave of up
  to 0.29: a crest leaves the vanishing point every 4 s and runs towards the camera (72 m between crests). Rings near the camera
  glow at 45% of the far ones; the glow fades out over the last 2.5 m above the ground so the ground does not cut it square;
  it is depth-tested, so the rover and the obstacles hide it, and it dims after a crash with the rest. The hairline itself
  brightens a little on a crest (`core`).
- **Stars.** The same 360 stars plus 9 brighter, larger, round ones, drawn by a small shader: each has its own phase, a cycle
  of 0.5 to 2.5 s and a swing of 12 to 38% (`twinkleFor()`), from one clock uniform. No loop over the stars in JavaScript. Every
  cycle divides 60 s, so the shader's clock wraps at 60 s without a jump.
- **Shooting stars.** One every 15 to 40 s (start to start, `CometClock`), crossing in 0.9 to 1.6 s: a thin ivory head and a
  brass-tinted tail fading to nothing, on one reusable quad placed in device coordinates by its shader (a draw call only while
  one flies). The path (`cometPath()`) starts high on one side and runs down at 8 to 24 degrees towards the middle; it stays
  out of the middle third (the lanes and the obstacles), above the horizon, clear of the planet, and under the score on the
  right. Never two at once, never after a crash or under reduced motion; the countdown holds while they are not allowed.
  They use the sky's own random generator, never the course's: `RUNNER_CONFIG.render.atmosphere.seed` (0 = from the clock)
  and `firstComet` (seconds; the fixture's `?comet=1` sets 1.5 s and seed 11).
- **Planet.** The body turns once in 5 minutes, its rings once in 9 (`planetAngles()`); the tilt is unchanged. The ring
  texture is now 256 x 64 with a gentle unevenness round the circle (about 20%), or the rings' turn could not be seen.

**Clock.** All of it runs on `WorldMotion.time`: seconds of the sim's fixed steps, so it is frame-rate independent, shows in
the idle scene, stops whenever the loop stops (a hidden tab, a blur, a pause), and stands still under
`prefers-reduced-motion` (no twinkle, wave, spin or shooting star; the glow stays at its average brightness).

**Budgets** (fixture, SwiftShader, 1280 x 720, seed 11): 15,398 triangles and 55 draw calls in the idle scene and early in a
run, the same as before: the glow adds 3,456 triangles and a call, and drawing the additive tunnel rings and glow in one pass
(`forceSinglePass`; three draws a transparent double-sided mesh twice) saves as much. 15,400 and 56 while a shooting star
flies. 37 geometries and 8 textures (one more of each). Lazy chunk 666,929 B / 172,477 B gzipped (was 660,869 / 170,517:
+1.9 kB). Uncapped frame time on SwiftShader was the same within its noise (medians of 9 to 18 ms either way; a rough guide).

**Tests.** `sky.vitest.ts`: the wave's range, period, direction and average; the glow's peak (at most 0.5) and its still
value; the twinkle's phase, period and amplitude bounds and its seamless wrap; the planet's angles after t seconds; the comet
clock's intervals, one at a time, its seed, the early first comet, no comet when not allowed, interpolation; the envelope;
paths that keep out of the middle third, the planet and the horizon at three aspects. `tests/runner.spec.js`: `?comet=1`
sends one across with no console error, axe passing and no layout shift; the sky's clock runs while idle and stops while
paused; under reduced motion it stays at 0 and no comet flies while the game still plays. The fixture's readout shows the
sky clock and the shooting stars.
<!-- end atmosphere polish -->

## Tests

- Unit (Vitest): `bots.vitest.ts` (the bots' runs are reproducible; idle, novice, average, expert and the oracle land in their bands), `hazards.vitest.ts` (the wall and the sweeper placed, instanced, disposed), `camera.vitest.ts` (damping and its frame-rate independence, the FOV mapping, the camera's height and look
  target through jumps, a held crouch and lane changes, the hit-stop and shake), `rover.vitest.ts` (the stand-in when the model is
  missing, wheel spin at 60 and 144 Hz, a held crouch, yaw, reduced motion), `world.vitest.ts` (ring slots and recycling, fades,
  the idle scroll, the eases into a run and to a stop, the pulse, reduced motion, the planet's place), `sim.vitest.ts` (speed curve, phases, lanes, jump, hold to crouch, collisions per obstacle incl. the wall and the sweeper, the clock, frame-rate
  independence), `generator.vitest.ts` (fairness), `input.vitest.ts`, `storage.vitest.ts`, `index.vitest.ts` (mount and
  destroy on a small fake DOM: no listener, frame, observer or element left).
- End to end (Playwright): `tests/runner.spec.js` on the fixture, with WebGL on SwiftShader: loads only when asked, no console
  errors, keyboard play to a crash and a restart, best score saved and blocked storage, lanes and no page scroll, synthetic
  swipes, hold S, Down and a finger for 2 s (crouched the whole time, standing after the release, cleared on blur), the wall and the
  sweeper within the triangle budget (the fixture's `?all=1` lets every pattern appear from the first row), the focus ring, axe in every state, no horizontal scroll at 320, 375 and 1280 px, unmount and mount again, and
  the WebGL fallback, and a missing `rover.glb` (requested only after the game starts; the stand-in plays to a crash and a
  restart); since step 2b also the idle scene (the world scrolls while the distance stays 0), reduced motion (a
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

## On the 404 page (step 3)

<!-- Written by the page-integration task; the difficulty and atmosphere tasks edit other sections of this file. -->

`src/pages/404.astro` draws everything it drew before (the orbit, "Error 404", the heading and words of `src/content/pages/404.md`,
the search form, the two buttons, `noindex`, the real 404 status) and, under the buttons, `src/components/RunnerStage.astro`:
a full-bleed stage with no frame (concept 6, the game's `blended` variant), its top edge fading into the page.

**Size** (`src/styles/runner-stage.css`, the `.runner-stage` rule, the one place to move or resize it): 16:9 on a wide screen, 3:4
under 40rem (so the track has room on a phone), never under 60svh, never over 45rem (720px), and never taller than the screen
under the sticky header and the page's scroll padding (`100svh - header - 24px`) (so a phone on its side still shows the whole stage). It holds that space before anything loads, so
nothing shifts. A negative top margin pulls its solid top edge into the buttons' empty bottom padding, so there is no bare gap.
Without JavaScript (`@media (scripting: none)`) the stage is not drawn at all: no game, no empty gap.

**Before anyone asks: a poster.** Inline SVG and CSS, no image, no WebGL, no script needed to draw it: the tunnel's brass rings,
a faint ringed planet, a few stars, three lane lines and two edges, a few brass pickups, a small rover with its beacon, all in
tokens, and one real `<button>` with the game's own words (`RUNNER_TEXT.play`: "Press space to play", or "Tap to play" on a
coarse pointer, chosen by `@media (pointer: coarse)` so there is no flash). The words come from `src/game/runner/text.ts`,
which holds `RUNNER_TEXT` on its own (`index.ts` re-exports it) so the page can print them without importing three.js. The page
adds no copy of its own.

**Loading.** The game (three.js chunk, about 170 kB gzipped, and `rover.glb`) is requested only on the first interaction with
the stage: a click or tap anywhere on it, or Space or Enter on the focused button. Space, a click or a tap start a run at once
(on a touch screen the words and `touch: true` are the touch ones); Enter loads the idle scene and waits for Space. While it
downloads the stage says `data-stage="loading"` (`aria-busy`, the button's hairlines pulse faster); if the download fails the
poster stays and another press tries again.

**Prefetch.** After the `load` event, `requestIdleCallback` (a 3 s timer where there is none) and the page's largest paint plus 1.5 s (a `PerformanceObserver` on `largest-contentful-paint`; 3 s after load where there is no such entry), and only when the stage is
within one screen of the viewport (an `IntersectionObserver`, `rootMargin: 100% 0`) and the connection is not data-saver or 2G,
the page adds `<link rel="prefetch" crossorigin="anonymous">` for the chunk and the model (`shouldPrefetch()` in
`src/lib/runner-stage.ts`). They are fetched, not run; nothing is mounted. The paint gate matters: Lighthouse's model counts every request that starts before the paint, and a prefetch that began ahead of a slow first paint pushed the 404 page's LCP from 1.6 s to 2.9 s in one noisy run; started after the paint it cannot. A press then asks for the same addresses, which the
host's immutable `/_astro/*` rule serves from the cache. The chunk's built address comes from `virtual:runner-chunk-url`, a
small Vite plugin in `astro.config.mjs` (`runnerChunkUrl`) that emits the runner as a chunk and hands the page its hashed
address; in `astro dev` it is `null` and there is no prefetch. The page imports the chunk by that address (`import(url)`), never
through a relative path.

**Works from any 404 address.** The host serves `404.html` for an unknown address at any depth, so every address the page uses is
root-absolute: the chunk (`/_astro/runner.<hash>.js`), the model (`/_astro/rover.<hash>.glb`, printed into `data-rover` and
fetched by the game with its Vite asset URL), the stylesheet and the fonts. `tests/runner-404.spec.js` reads `dist/` for this and
loads the page from `/a/b/c/d/e/no-such-page/?utm=x#top`.

**Touch.** Swipes and taps are the game's own (`input.ts`). The stage sets `touch-action: pan-y pinch-zoom` on the canvas (the page
scrolls with a vertical drag that starts in it; no double-tap zoom) and `touch-action: none` only while a run is in progress and
not paused (`[data-runner-state='playing'][data-runner-paused='false']`), so a swipe during a run never scrolls the page. The
browser reads `touch-action` when a touch starts, so a first touch on the ready or game-over screen scrolls; a tap there starts.

**Keyboard and focus.** The poster's button is the only tab stop until the game loads, then the stage itself (`tabindex="0"`,
`role="application"`, named "Off course: endless runner game", described by the game's prompt line) takes focus. Space and the
arrows are prevented only while the stage has focus (the game's own rule); elsewhere on the page they scroll as usual. Escape
pauses a run, Space or a tap resumes, Tab leaves (and the game pauses, its own rule). The whole stage is brought into view
(`scrollIntoView`, `block: 'nearest'`; smooth, instant with reduced motion, after the fonts are ready) when the game mounts. It is smooth on purpose: the browser's own scroll to the focused button may still be running, and a second smooth scroll takes over its target where an instant one is overtaken by it (the HUD ended up under the header in a test). A visible focus ring is drawn inside the stage's edge.

**Score.** The game's HUD is the score on the page (score, pickups, best; top right, under the header). The best score is shown
only once there is one (`data-has-best` on the stage; the game draws 00000 before a first run), and is saved only in the
browser (`r7-runner-best`).

**Reduced motion.** Nothing autoplays: the poster's hairlines stand still, the game appears without its fade, the idle scene is a
still frame (the game's own rule) and a run still plays on request. A hidden tab pauses (the game's own rule).

**Without WebGL** the stage keeps its poster scenery, hides the button and shows the game's "This game needs WebGL." The rest of
the page works as before.

**Lighthouse** (mobile, `/no-such-page/` which is audited as `/404.html`), before and after: performance 1 and 1, accessibility, best practices 1 and 1, LCP 1503 ms and 1656 ms (limit 2000), CLS 0 and 0, TBT 0 and 0, FCP 1053 ms and 1056 ms, transfer 107 kB and 110 kB without the prefetch (the stage adds 3 kB: the poster's SVG and CSS and a 1.5 kB script) and 343 kB with it (the chunk, 172 kB, and the model, 59 kB, fetched after the paint, which the audit counts in its total). Requests 10 and 14. `/` is untouched; it sits on the 2000 ms line by itself (2030 ms before and after, 1894 ms in another run).

**Tests:** `tests/runner-404.spec.js` (20 tests; see its header), `src/lib/runner-stage.vitest.ts`, and the 404 line added to
`tests/fixtures/pages/404.txt`.
