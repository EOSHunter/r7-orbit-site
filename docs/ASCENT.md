# R7: Ascent

The plan for a game on the site: a 3D climbing game in the style of *Only Up!*. Agreed with the author on 2026-10-27
(the decisions are summarised in `docs/DECISIONS.md`, section E, "R7: Ascent"; this file is the full plan). It follows the
404 page's runner (`docs/RUNNER.md`): the same code layout, the same Blender-script pipeline, and a first prototype at an
unlinked styleguide route before it has a public page.

**Where it is:** phase 1, the feel prototype, is built at `/styleguide/ascent/` (noindex, unlinked, like the rest of the
styleguide) and waits for the author to play it (below, "Phase 1: Feel prototype"). Nothing else is built yet.

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
  files use a few named materials (`obsidian`, `obsidian-light`, `brass`, `ivory`); the game swaps each for its token colour.
- **Edge lines are drawn by the game** (Three.js `EdgesGeometry` over each mesh), not modelled.
- **Type in the HUD:** JetBrains Mono for numbers (altitude, time), Inter for labels, as on the rest of the site.
- **The character:** a small capsule-shaped "agent" in ivory with a brass visor. Simple to animate and reads well from
  behind.

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
| `level.ts` | the course as data: a list of boxes and a spawn point. Phase 1 lays it out in code; phase 2 reads it from a `.glb` |
| `clock.ts` | the fixed-step clock (the runner's, 1/120 s, with an accumulator and interpolation) |
| `input.ts` | keys and the mouse to a move vector, jump presses and a look delta, relative to the camera |
| `camera.ts` | the third-person orbit camera: yaw and pitch from the look input, a spring on the follow, pulled in when a box is in the way |
| `colors.ts` | the scene's colours, read from the tokens at runtime |
| `render.ts` | the Three.js view: reads the sim, draws the scene; `createView()` is null without WebGL |
| `gesture.ts` | full screen and the pointer lock, asked for inside the click or key press that starts or resumes the climb; small and free of three.js, so the page's Play button can use it before the game has loaded |
| `index.ts` | `mountAscent(container, options)`: DOM, HUD, the loop, pause rules, pointer lock and full screen, resize, cleanup |
| `ascent.css` | the HUD's styles, tokens only; imported by the page that hosts the game |

`index.ts` is reached only through a dynamic `import()`, so three.js and the game are a lazy chunk loaded on Play and never in
a page's first load. Unit tests sit beside the code as `*.vitest.ts`.

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
   `userData`). No textures, UVs, Draco or meshopt (no decoder in the chunk).
4. **Load:** Three.js `GLTFLoader` (part of `three`, already in the runner's chunk; not another dependency). Each file is a
   Vite asset (`?url`, hashed, cached for a year by `_headers`), like `rover.glb`.

### Blender is the level editor

The climb is laid out in Blender. Game objects are marked by name or by custom property:

| In Blender | In the game |
|---|---|
| Any mesh | Scenery |
| A box named `COL_…` | An invisible collision box |
| An empty named `SPAWN` | Where the climb starts |
| Custom property `beacon` | An assist-mode checkpoint |
| Custom property `fan`, with `strength` | An updraft |
| Custom property `mover`, with a path and `speed` | A drifting block |
| Custom property `crumble`, with `delay` | A plate that breaks after you stand on it |
| An object named `GOAL` | The orbit ring; touching it finishes the run |

**Collision is boxes only**, written for the game (no physics engine; one would add hundreds of kB). Boxes may be rotated
about the vertical axis but not tilted. That keeps collision fast and predictable, and suits the blocky look. Scenery can be
any shape; only the `COL_` boxes count for standing and bumping.

### Files

| Path | What | In git |
|---|---|---|
| `tools/ascent/` | The Blender Python scripts: the source of every model and zone | Yes |
| `tools/ascent/out/` | `.blend` files and preview renders the scripts produce, for looking around and for approval | No (rebuilt from the scripts; ignored when the first script lands) |
| `docs/ascent-concepts/` | The approved preview renders | Yes |
| `src/game/ascent/assets/` | Exported `.glb` files the game loads (where the runner keeps `rover.glb`) | **Yes**, so the site build (and Cloudflare) never needs Blender |
| `src/game/ascent/` | Game code (TypeScript) | Yes |
| `src/pages/styleguide/ascent/` | The prototype page (phases 1 to 3) | Yes |

Rebuilding models needs Blender installed. Building the site does not.

### Size targets

| What | Target |
|---|---|
| The page before Play | Inside the site budgets: < 50 kB gzipped JS, < 40 kB CSS, Lighthouse ≥ 95 |
| Three.js and the game code, loaded on Play | About 150 kB gzipped. Phase 1 measured 557 kB, **143 kB gzipped** (three.js is nearly all of it; `GLTFLoader` will add about 25 kB in phase 2, as it did for the runner) |
| The character `.glb` | < 150 kB |
| Each zone `.glb` | < 500 kB, loaded as the player nears it |

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
- [ ] The Blender pipeline: one script in `tools/ascent/`, export, `GLTFLoader`, collision and markers read from
      `userData`, materials swapped for token colours

**Done when:** a short test climb built in Blender plays on desktop and a phone, and survives a reload.

### Phase 3: The full climb

- [ ] The five zones, scripted in Blender, each approved from renders
- [ ] Fans, movers and crumbling plates
- [ ] The orbit ring, the finish screen and the credits
- [ ] Zones loaded as the player nears them
- [ ] Tuning for a 15–20 minute first climb

**Done when:** the author can climb from the workshop to orbit.

### Phase 4: Polish and the public page

- [ ] Look pass (fog, edge lines, the agent's animations)
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
| The character | The ivory capsule with a brass visor described above; confirm once renders exist |
