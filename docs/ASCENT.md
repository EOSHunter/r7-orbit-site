# R7: Ascent

The plan for a game on the site: a 3D climbing game in the style of *Only Up!*. Agreed with the author on 2026-10-27
(the decisions are summarised in `docs/DECISIONS.md`, section E, "R7: Ascent"; this file is the full plan). It follows the
404 page's runner (`docs/RUNNER.md`): the same code layout, the same Blender-script pipeline, and a first prototype at an
unlinked styleguide route before it has a public page.

**Where it is:** phase 1, the feel prototype, is built at `/styleguide/ascent/` (noindex, unlinked, like the rest of the
styleguide) and waits for the author to play it (below, "Phase 1: Feel prototype"). Phase 2 has started with the Blender
pipeline: the page now plays a short test climb built by a Blender script, as the robot agent the author chose, also built in
Blender and animated in code (below, "Phase 2"). Touch controls, the HUD, saving and assist mode are not built yet.

## The pitch

You climb from a cluttered workshop floor up to orbit: the brass ring from the R7 logo. One missed jump can drop you a long
way, and by default there are no checkpoints. (The R-7 was the rocket that put Sputnik into orbit, which is why a climb to
orbit suits the name.)

| | Decision |
|---|---|
| Name | **R7: Ascent** |
| Engine | Three.js (WebGL), loaded only when the player presses Play. `three` is already a runtime dependency (the runner's, 0.186); Ascent adds no package |
| Art | Made in Blender by Claude with Python scripts, exported as glTF; the author directs |
| Assets | Original only. No third-party models or packs |
| Devices | Desktop (keyboard and mouse) and phone (touch, landscape) |
| Difficulty | Hardcore by default (no checkpoints), with an optional **assist mode** that adds checkpoints |
| Length | A first climb takes a decent player about 15–20 minutes |
| World | Workshop → Server stack → Cloud → Upper air → Orbit |

## How it looks

"Blueprint noir": matte obsidian blocks with thin ivory edge lines (the site's 1px hairlines, in 3D). Brass is used only for
the goal ring, the assist-mode checkpoint beacons and the player's visor. Fog fades distant blocks into `--bg`, so depth
comes from tone, as the design system asks (`CLAUDE.md` design rule 5).

- **No textures.** Flat, matte materials only. It reads as R7, keeps files small and runs on phones.
- **One shadow:** a dark disc under the player (`--void`), so you can always see where you will land. No real-time shadow
  maps.
- **Colours come from the tokens, read at runtime.** The game reads each colour it uses from `tokens.css` with
  `getComputedStyle` when it mounts (`src/game/ascent/colors.ts`), so there are no hex values in the game code and a token
  change reaches the game without an edit. (The runner copies its colours into `config.ts` instead; Ascent does not.) Blender
  files use a few named materials (`obsidian`, `obsidian-dark`, `brass`, `ivory`: `LEVEL_MATERIALS` in `colors.ts`); the
  game swaps each for its token colours, shading each face by the way it points (tops lightest), as below.
- **Edge lines are drawn by the game** (Three.js `EdgesGeometry` over each mesh), not modelled.
- **Type in the HUD:** JetBrains Mono for numbers (altitude, time), Inter for labels, as on the rest of the site.
- **The character:** a small robot climber, 1.2 m tall in game units, that reads like a clean designer toy rather than a
  realistic robot (decided 2026-10-27; the approved renders are in `docs/ascent-concepts/`). A rounded, slightly boxy ivory
  head with one wide brass visor band across the front, the only brass on it; a short antenna with a ball on top; a compact
  ivory torso with a raised chest plate and an obsidian battery pack on its back, outlined in edge lines (the camera sees it
  from behind most of the time, so the back carries character, with a raised hatch on the back of the head too); dark joints
  at the shoulders and the waist; short dark legs in chunky ivory boots; stubby ivory arms. It is the one lit, smooth-shaded
  thing in the scene: an ivory ambient and a key, a fill and a rim light that turn with the camera, so its faces, sides and
  outline always come out in different tones (`render.agentLight` in `config.ts`). Its animation ("Phase 2" below) is
  drawn from the sim's state and never changes the motion; the collision box stays 0.56 by 1.2 m, and the robot fits it seen
  from behind.

### HUD

- Altitude, top left (`412 m`)
- Time, top right (`14:32`)
- A zone altimeter on the left edge: one tick per zone, a brass marker for where you are
- A controls hint at the bottom for the first minute, then it fades out
- Pause menu (Esc, or a button on touch): resume, restart, assist mode, settings, leave

## The world

Five zones, bottom to top. Each one adds one new kind of obstacle, so difficulty rises with altitude.

| Zone | Scenery | New obstacle |
|---|---|---|
| 1. Workshop | Desks, keyboards, monitors, cable bundles | None: static jumps to learn the controls |
| 2. Server stack | Racks, cable trays, heat sinks | Fans that blow you upward (updrafts) |
| 3. Cloud | Soft floating data blocks | Blocks that drift back and forth |
| 4. Upper air | Satellites, antennas, solar panels | Thin beams and plates that crumble |
| 5. Orbit | The brass ring, turning | Land on the ring to finish; credits and your time |

The setting is computing gear, so it fits the site's subject without real brands or logos on anything.

## Features

### First version

- Third-person camera that follows the agent; drag or mouse to look
- Movement that feels fair: coyote time (a short grace period to jump after leaving an edge) and jump buffering (a jump
  pressed just before landing still counts). A fall should always be the player's mistake, never the controls'
- HUD and pause menu as above
- **Save and resume:** the climb (position, time, mode) is saved in the browser when you leave and restored when you come
  back. `localStorage` (key `r7-ascent-save`, beside the runner's `r7-runner-best`), every read and write in `try`/`catch`,
  and the game works without it
- **Assist mode:** checkpoint beacons in each zone; you return to the last one you touched. Runs in assist mode are marked
  as such on the finish screen
- **Settings:** look sensitivity, invert look, reduced motion (no camera bob or screen shake; on by default when the system
  asks for reduced motion), volume
- **Desktop controls:** WASD or arrow keys to move, Space to jump, mouse to look (Play goes full screen and locks the mouse), Esc to pause
- **Phone controls:** a virtual stick on the left, drag on the right half to look, a jump button. Portrait shows a "turn your
  phone sideways" prompt

### Later (not committed)

- Sound, generated in code with Web Audio (no audio files)
- Gamepad support
- A speedrun split timer per zone
- A shareable result line ("I reached 812 m in 14:32"), copied as text
- Hidden collectibles

### Not doing

- **Online leaderboards.** They need a server, and the site is static by design. Best times are kept in the player's own
  browser.

## Code

`src/game/ascent/`, split the way the runner is (`docs/RUNNER.md`, "Architecture"): pure logic that runs and is unit-tested
in Node, apart from a read-only Three.js view.

| File | What it does |
| --- | --- |
| `config.ts` | every tunable number: the fixed step, movement, jump, coyote time, jump buffer, gravity, the agent's box, the camera, the fall height that respawns, the render limits |
| `collision.ts` | box-only collision: axis-aligned boxes (later: rotated about the vertical axis only), the agent's box moved one axis at a time against them, what it stands on |
| `sim.ts` | `AscentSim`: one fixed step of movement, jumping (coyote time, buffer), gravity, landing, falling and respawning, the altitude |
| `level.ts` | the course as data: a list of boxes, a spawn point, the route and the goal. `PROTOTYPE_LEVEL` is phase 1's, laid out in code; `levelFromObjects` makes one from a Blender level's objects, with the rules below |
| `gltf-level.ts` | a level made in Blender, read with `GLTFLoader`: its `Level`, its scenery meshes and its `GOAL` (`LevelModel`) |
| `agent.ts` | the robot from `assets/agent.glb`: loaded and checked (`AgentModel`: its parts and materials), drawn lit in token colours with edge lines on its obsidian parts, posed each frame, and its light, which turns with the camera; the capsule when there is no model |
| `agent-anim.ts` | the robot's animation as numbers: which animation the sim's state calls for (`chooseAnimation`: idle, run, jump, fall, land) and each frame's pose (`AgentAnimator`); pure, unit-tested |
| `clock.ts` | the fixed-step clock (the runner's, 1/120 s, with an accumulator and interpolation) |
| `input.ts` | keys and the mouse to a move vector, jump presses and a look delta, relative to the camera |
| `camera.ts` | the third-person orbit camera: yaw and pitch from the look input, a spring on the follow, pulled in when a box is in the way |
| `colors.ts` | the scene's colours, read from the tokens at runtime; the material names a level may use and their tones |
| `render.ts` | the Three.js view: reads the sim, draws the scene (the agent through `agent.ts`); `createView()` is null without WebGL |
| `gesture.ts` | full screen and the pointer lock, asked for inside the click or key press that starts or resumes the climb; small and free of three.js, so the page's Play button can use it before the game has loaded |
| `index.ts` | `mountAscent(container, options)`: DOM, HUD, the loop, pause rules, pointer lock and full screen, resize, cleanup; `loadTestClimb()` and `loadAgent()` |
| `ascent.css` | the HUD's styles, tokens only; imported by the page that hosts the game |

`index.ts` is reached only through a dynamic `import()`, so three.js and the game are a lazy chunk loaded on Play and never in
a page's first load. Unit tests sit beside the code as `*.vitest.ts`.

**Ascent's own copy of three.js.** The runner (on the 404 page) and Ascent both use three.js. Imported by the same name, the
bundler would move three.js into a chunk the two games share, and the 404 page's idle prefetch, which fetches the runner's
chunk alone, would stop fetching it. So Ascent imports three.js from its ES sources (`three/src/Three.js`), and a small Vite
plugin in `astro.config.mjs` (`ascentOwnThree`) makes `GLTFLoader` do the same: every `three/examples` module Ascent imports
is loaded as a copy of its own, whose `three` is the ES sources too. Each game's chunk carries its own three.js; a visitor
who plays both downloads it twice. The build stops if the runner's chunk ever imports another chunk (`runnerChunkUrl`).

## Art pipeline: Blender to Three.js

Claude makes every model and level. The author directs from preview renders and from playing the game; they never have to
open Blender. This is the runner's pipeline (`tools/runner/build_rover.py`) at a bigger scale.

1. **Each model and each zone is a Python script** in `tools/ascent/`, run with Blender 5.1 in the background
   (`blender -b --factory-startup -P tools/ascent/<script>.py`; on Windows Blender is
   `C:\Program Files\Blender Foundation\Blender 5.1\blender.exe`). The script builds the scene from scratch and exports a
   `.glb`. A note like "make the server racks taller" is a script edit and a rebuild, so every asset can be rebuilt with one
   command, and the same Blender gives the same file.
2. **Preview renders for approval.** For each new model or zone, the script also renders still images in the game's
   colours (`-- --preview`, as the rover's script does). The author approves or asks for changes before an asset goes into
   the game (`CLAUDE.md`: generated images need the author's approval, one by one). Approved previews are kept in
   `docs/ascent-concepts/`, as the rover's are in `docs/runner-concepts/`.
3. **Export:** glTF binary (`.glb`), +Y up, 1 Blender unit = 1 metre, custom properties included (they arrive in Three.js as
   `userData`). No textures, UVs, normals, Draco or meshopt (no decoder in the chunk); the game works out each face's shading
   from its corners.
4. **Load:** Three.js `GLTFLoader` (part of `three`; not another dependency), in Ascent's own copy of three.js ("Code"
   above). Each file is a Vite asset (`?url`, hashed, cached for a year by `_headers`), like `rover.glb`.

### Blender is the level editor

The climb is laid out in Blender. Game objects are marked by name or by custom property:

| In Blender | In the game |
|---|---|
| Any mesh | Scenery |
| A box named `COL_…` | An invisible collision box. Axis-aligned: never rotated (a quarter turn about Z is allowed) |
| … with custom property `route` = n | The n-th block of the climb (1, 2, 3 … with no gaps): the fairness test walks them in order |
| … with custom property `ground` | The floor |
| An empty named `SPAWN` | Where the climb starts; the agent faces the empty's +Y (turn it about Z to turn the agent) |
| Custom property `beacon` | An assist-mode checkpoint |
| Custom property `fan`, with `strength` | An updraft |
| Custom property `mover`, with a path and `speed` | A drifting block |
| Custom property `crumble`, with `delay` | A plate that breaks after you stand on it |
| An object named `GOAL` | The orbit ring, turned about the vertical through its origin; touching it finishes the run (phase 3) |
| A material named `obsidian`, `obsidian-dark`, `brass` or `ivory` | The token tones the mesh is drawn in. Any other name stops the level from loading |

**Collision is boxes only**, written for the game (no physics engine; one would add hundreds of kB). Boxes may later be
rotated about the vertical axis (`collision.ts` does not support that yet) but never tilted. That keeps collision fast and
predictable, and suits the blocky look. Scenery can be any shape; only the `COL_` boxes count for standing and bumping, so a
round mug gets a square box a little inside it.

`levelFromObjects` (`level.ts`) checks a level file as it loads and stops with a message naming the object: no `SPAWN` or
`GOAL` (or two), a turned or flat `COL_` box, a route number missing, repeated or not whole. A box's corners are snapped to
0.1 mm, because the file's float32 can leave two faces that meet in Blender a hair inside each other.

### Files

| Path | What | In git |
|---|---|---|
| `tools/ascent/` | The Blender Python scripts: the source of every model and zone | Yes |
| `tools/ascent/out/` | `.blend` files and preview renders the scripts produce, for looking around and for approval | No (rebuilt from the scripts; in `.gitignore`) |
| `docs/ascent-concepts/` | The approved preview renders (the robot agent's so far) | Yes |
| `src/game/ascent/assets/` | Exported `.glb` files the game loads (where the runner keeps `rover.glb`): `test-climb.glb` and `agent.glb` | **Yes**, so the site build (and Cloudflare) never needs Blender |
| `src/game/ascent/` | Game code (TypeScript) | Yes |
| `src/pages/styleguide/ascent/` | The prototype page (phases 1 to 3) | Yes |

Rebuilding models needs Blender installed. Building the site does not.

### Size targets

| What | Target |
|---|---|
| The page before Play | Inside the site budgets: < 50 kB gzipped JS, < 40 kB CSS, Lighthouse ≥ 95 |
| Three.js and the game code, loaded on Play | About 150 kB gzipped. Phase 1 measured 557 kB, 143 kB gzipped; with `GLTFLoader` and the level code (phase 2), 663 kB, 171 kB gzipped; with the robot agent and its animation, 670 kB, **173 kB gzipped** (three.js is nearly all of it) |
| The character `.glb` | < 150 kB. The robot is 115 kB, 28 kB gzipped (5,608 triangles; the normals make up much of it, for the smooth shading) |
| Each zone `.glb` | < 500 kB, loaded as the player nears it. The test climb is 52 kB (11 kB gzipped), 1,892 triangles of scenery and ring (the ring is 1,152 of them) |

If the `.glb` files outgrow these, a build step with `gltfpack` (mesh compression) can shrink them. It is a dev dependency,
so ask first.

## The page

- **Now:** the prototype at `/styleguide/ascent/`, noindex and unlinked, the way the runner started at
  `/styleguide/runner/`. It is listed in `tests/routes.js`, so smoke, axe, budgets and the audit cover the page before Play.
- **Later:** a public page, and an entry on the `/apps/` hub added through the add-content skill
  (`.claude/skills/add-content/`, a game). The public URL is still open (below).
- Before Play, it is an ordinary page in the site's layout: a title, a short description, the controls, and a **Play**
  button. Nothing heavy loads until Play is pressed.
- Play loads Three.js and the game, then the game fills its stage (the viewport, on the public page). Leaving the game
  returns to the page.
- **No JavaScript or no WebGL:** the page says what the game is and that it needs WebGL; no broken canvas.
- No third-party requests: Three.js is bundled by Astro, and the `.glb` files are served from the site.

## Accessibility

- The page itself meets the site's bar (WCAG 2.2 AA, one `h1`, labelled controls, axe-clean).
- The game is fully keyboard playable; the pause menu and settings are real buttons with focus states.
- Reduced motion is respected (see Settings).
- A 3D platformer cannot be made usable with a screen reader. The page describes the game in text, and that limit is stated
  plainly rather than papered over.

## Build phases

### Phase 1: Feel prototype

- [x] `three` is already a runtime dependency (the runner's); no new package
- [x] `/styleguide/ascent/` with the Play button; Three.js loaded only on Play
- [x] Grey boxes laid out in code (no Blender yet), the capsule agent, third-person camera
- [x] Movement and jumping with coyote time and jump buffering; box collision
- [x] Falling and respawning; a rough altitude readout
- [x] Desktop controls
- [x] Unit tests for the pure parts (collision, movement, input, clock)
- [x] `/styleguide/ascent/` in `tests/routes.js`, and a Playwright test that presses Play and checks for a running canvas
      with no console errors

**Done when:** the author has played it and is happy with how moving and jumping feel. This phase decides whether the game
is fun, so tune it (`src/game/ascent/config.ts`) before building more.

**What was built.** `src/game/ascent/` as in "Code" above; `level.ts` lays out a test climb of about 19 m round a tower (22
jumps: wide steps, two beams, a run of small blocks, 1.2 m steps up), with the goal ring above the top (drawn only: touching it
does nothing yet). The page has a debug readout (position, speeds, on the ground, coyote and buffer time left, camera) and a
Restart button. Its URL options, for the tests: `?lock=0` never asks for pointer lock, `?fullscreen=0` plays in the page,
`?start=0` stops on the ready screen. The starting numbers (all in `config.ts`):

| | |
| --- | --- |
| Run | 6 m/s; 0.1 s to top speed, 0.09 s to stop on the ground; gentle steering in the air (24 m/s²), almost no slowing |
| Jump | 1.6 m in 0.38 s to the top when Space is held; a tap is a short hop (gravity 2.6 times stronger once Space is let go while rising); the fall is 1.4 times heavier than the rise; 32 m/s at most |
| Forgiveness | coyote time 0.1 s, jump buffer 0.12 s; no double jump |
| Reach | about 4.2 m across on a level jump, 3.5 m onto a block 1 m higher (`jumpReach`); `level.vitest.ts` keeps every step of the route within 80% of it and at most 1.28 m up |
| Agent | a box 0.56 m wide and 1.2 m tall (the capsule drawn is a little wider) |
| Camera | 6 m behind a look point 1.3 m above the feet, starting 0.32 rad above it; mouse 0.0024 rad per pixel; Q and E turn it at 2.4 rad/s; it comes in front of a block at once and eases back out (0.25 s) |
| Falling | below -18 m: back to the start, a fall counted. "Best" is the highest the agent has stood, not the top of a jump |

The keys are read by their place (`KeyboardEvent.code`), so WASD is the same four keys on any layout. Q and E were added so the
game can be played with the keyboard alone (the plan's accessibility goal). Escape pauses, and so does letting go of the
pointer lock, leaving full screen, the tab hiding, the window losing focus and focus leaving the game.

**Full screen and the mouse** (after the author's first play: in a box on the page, the mouse did not stay locked). Play puts
the stage in full screen and locks the mouse to it in the click itself (`gesture.ts`), because browsers allow neither once
the click is over and the game takes a moment to load; a click or Space that resumes asks again. The lock is on the whole
stage, not the canvas. Escape lets go of the mouse and pauses, still in full screen; Escape again leaves full screen. If the
browser refuses the lock, "Click to look around with the mouse" shows in the middle of the game until a click gets it
(dragging still works).

### Phase 2: Phone, HUD, save

- [ ] Touch controls and the portrait prompt
- [ ] HUD (altitude, time, zone altimeter) and pause menu
- [ ] Save and resume; settings
- [ ] Assist mode and beacons
- [x] The Blender pipeline: one script in `tools/ascent/`, export, `GLTFLoader`, collision and markers read from
      `userData`, materials swapped for token colours

**Done when:** a short test climb built in Blender plays on desktop and a phone, and survives a reload.

**What was built (the pipeline, 2026-10-27).** `tools/ascent/build_test_climb.py` builds the test climb from numbers in the
script and exports `src/game/ascent/assets/test-climb.glb`:

```
"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" -b --factory-startup -P tools/ascent/build_test_climb.py
"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" -b --factory-startup -P tools/ascent/build_test_climb.py -- --preview
```

The second also writes three stills (`test-climb-start.png`, `-overview.png`, `-top.png`) and `test-climb.blend` to
`tools/ascent/out/`. The stills are close to the game's look (each face in its tone, ivory edges, obsidian background) but
have no fog. They wait for the author's approval; none is in `docs/ascent-concepts/` yet.

The climb is a giant workshop desk at the agent's scale: two books on the floor, a stool, a chair turned round (its seat,
then the top of its back, a 0.4 m beam), the desk top at 6 m, a keyboard, a mug, two upright books, the top edge of the
monitor (0.5 m wide, 5.5 m long), a desk lamp's arm and shade at 12.6 m, and the ring above. 13 jumps, 36 scenery meshes,
30 `COL_` boxes. The agent starts where phase 1's did (0, 0, 10 in the game), facing the desk.

`/styleguide/ascent/` loads it on Play, after the game's chunk; the debug readout says which level is playing.
`?level=code` plays phase 1's boxes, and so does a page whose `.glb` failed to load (the readout says why). In the tests:
`level.vitest.ts` runs the fairness checks on both levels, the test climb read from the committed file through
`gltf-level.ts`; `gltf-level.vitest.ts` covers the file rules and walks the sim into the first book's side and onto it; and
`tests/ascent.spec.js` checks that the `.glb` loads only on Play, `?level=code` and the fallback.

**The robot agent (2026-10-27).** The author asked for a character with more to it than "just a pill", and approved a robot
from renders (the second round: the first read as flat). `tools/ascent/build_agent.py` builds it and exports
`src/game/ascent/assets/agent.glb`:

```
"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" -b --factory-startup -P tools/ascent/build_agent.py
"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" -b --factory-startup -P tools/ascent/build_agent.py -- --preview
```

The second also renders, to `tools/ascent/out/`, the robot from behind at the game camera's angle (full frame and cropped),
from the front three-quarter view and in silhouette, lit with the game's numbers; `-- --preview --variants` adds the two
variations the author chose between (B, a rounder head; C, a wide flat head). The script stops if the robot no longer fits
the agent's box (0.56 m wide, 1.2 m tall).

Its parts are separate nodes with their pivots where they turn (`agent` at the feet, `body` at the hips, `head` at the neck,
the arms at the shoulders, the legs at the hips, the antenna at its foot): the names are the contract with `agent.ts`, as
`COL_` and `SPAWN` are for a level. The animation is code, like the runner's rover, not Blender actions: it reacts to the sim
from frame to frame and stays a few hundred lines. `agent-anim.ts` chooses idle, run, jump, fall or land from the sim's
state, and makes the pose:

| | |
| --- | --- |
| idle | a slow bob, the arms swaying a little |
| run | the legs swing with the distance covered (one stride every 1.7 m), the arms against them, a bob on each step, a lean into the run |
| jump | a crouch that springs into a stretch, then arms up and legs tucked while rising |
| fall | arms out to the sides, legs reaching down |
| land | a squash as deep as the landing was hard, springing back; the arms catch the weight |

The jump leaves the ground on the key press, as before (the feel does not change), so the crouch is drawn in the first
0.07 s of the rise. The antenna sways on a spring, flicked by each take-off, landing and footfall. Under reduced motion the
bob, the squash and stretch and the antenna's sway are left out; the legs and arms still show running and jumping. Every
number is in `config.ts` (`animation`).

The page loads the robot beside the level on Play. If it does not load, the capsule stands in and the readout says why; the
readout also shows the animation playing. Tests: `agent-anim.vitest.ts` (the choice and the pose through a run, a jump and a
landing, driven by the sim; reduced motion), `agent.vitest.ts` (the committed file: its parts, materials, size, fit in the
box and facing; the checks on a model; the view; the light's aim), and `tests/ascent.spec.js` (both files load on Play, the
readout runs through idle, run and jump or fall, and the capsule when the files fail).

### Phase 3: The full climb

- [ ] The five zones, scripted in Blender, each approved from renders
- [ ] Fans, movers and crumbling plates
- [ ] The orbit ring, the finish screen and the credits
- [ ] Zones loaded as the player nears them
- [ ] Tuning for a 15–20 minute first climb

**Done when:** the author can climb from the workshop to orbit.

### Phase 4: Polish and the public page

- [ ] Look pass (fog, edge lines). The agent's animations are built (phase 2, "The robot agent")
- [ ] The public page and its `tests/routes.js` entry (smoke, axe, budgets and Lighthouse cover the page before Play)
- [ ] The `/apps/` entry, through the add-content skill
- [ ] Unit tests for the save format
- [ ] `CLAUDE.md` and the README updated (paths, commands)
- [ ] Page copy, reviewed by the author

**Done when:** the site's definition of done holds (`CLAUDE.md`), including 320–1480 px and no console errors.

## Still open

| Question | Recommendation |
|---|---|
| The public URL | `/ascent/`, a page of this site. A playable project's `playUrl` today must be a full `https://` address and was made for games on their own host (`docs/CONTENT_MODEL.md`, "Playable projects"), so how an on-site game joins `/apps/` is decided with the URL |
| Link in the main nav, or on the hub? | Not in the nav at first. List it on `/apps/` and link it from a project post; add it to the nav when the author is happy with it |
