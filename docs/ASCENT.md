# R7: Ascent

The plan for a game on the site: a 3D climbing game in the style of *Only Up!*. Agreed with the author on 2026-10-27
(the decisions are summarised in `docs/DECISIONS.md`, section E, "R7: Ascent"; this file is the full plan). It follows the
404 page's runner (`docs/RUNNER.md`): the same code layout, the same Blender-script pipeline, and a first prototype at an
unlinked styleguide route before it has a public page.

**Where it is:** phases 1 and 2 are built, and phase 3's full climb plays at `/styleguide/ascent/` (noindex, unlinked, like
the rest of the styleguide): five zones from the workshop floor to the brass ring, built by a Blender script, played as the
robot agent the author chose, with the HUD, the pause menu and its settings, save and resume, assist mode and touch controls (removed 2026-10-28: desktop only).
The zones' renders wait for the author's approval (below, "Phase 3"). `?level=test` still plays phase 2's test climb and
`?level=code` phase 1's boxes.

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
| Devices | Desktop: keyboard and mouse (decided 2026-10-28; phones and tablets are told so) |
| Difficulty | Hardcore by default (no checkpoints), with an optional **assist mode** that adds checkpoints |
| Length | A first climb takes a decent player about 15–20 minutes |
| World | Workshop → Server stack → Cloud → Upper air → Orbit |

## How it looks

**Polish (2026-10-28; the renderer and the workshop first, then the other four zones to the workshop's standard on
2026-10-29, after the author approved the workshop).**
The author's reference is his own Godot game: crisp shadows, glowing light strips, painted detail on simple bevelled shapes,
skies that move. In High graphics (Settings) the sun casts real shadows in three cascades along the view (three.js's `CSM`:
sharp near the camera, coarser further out, as far as the fog's end, fading into each other; a single square round the
agent made shadows appear as the camera moved, which the author saw), light well brighter than white glows (`UnrealBloomPass`
at half size, above `render.lit.bloom.threshold`; lowered after the author found it too strong), and a filmic curve (ACES)
maps it to the screen; Low draws none of that, at one pixel per CSS pixel. The agent casts its shadow through an
invisible copy of itself posed each frame in the level's scene. Each zone's look has a `fill`: the sky light's colour from
above where it is not the fog's (indoors, light off the walls; in the server stack a cool bounce, so the racks are never
black in shade). The Earth is a smooth sphere painted by the script (`earth_texture`: fractal continents, coasts, deserts,
ice caps and banded cloud, from waves summed over the sphere so nothing seams), tipped so the climb looks down on middle
latitudes. In `build_climb.py` every seen box has its edges bevelled
4 cm and smooth (face-weighted) normals, and the materials in `TEXTURED` get a painted texture made by the script with numpy:
a tileable grey pattern their colour multiplies (wood grain, book cloth, page edges, paint, brushed steel, plaster, cork, floor
tiles) and a bump map from the same pattern, on UVs projected from each face's axis in world metres, exported as WebP inside
the zone file. The workshop is a closed room: four walls with skirting boards, a ceiling with a 33 m hatch the climb goes up
through (its top is the server stack's floor), eight lamps under it (the zone's light comes from above), a door, a radiator
under the window, a cork board of notes, and a giant mug, pencil and ruler. A mesh with the custom property `shadow = 0` casts
none (the walls and the ceiling, which would otherwise shade the room; the clouds, whose coarse spheres would shade themselves
in facets). The zones above (2026-10-29), all scenery well outside the climb:

- **Server stack:** a raised floor out from the workshop's roof to 58 m, two rings of rack towers in rows with aisles
  between (their fronts a texture of rack units and vent holes, short bars of status lights on the side facing the climb, a
  blue cable bundle up a corner; the tallest reach just into the clouds), cable trays across the aisles and cables slung
  between the towers.
- **Cloud:** a sea of clouds under the zone with a hole round the climb (through it, the Earth), out to the fog; each cloud
  is a few lumps wrapped in one smooth skin (`cloud_puff`), so it has a soft outline and no seams; four spirals of glowing
  data cubes rising far out; the data blocks get a faint grid and are made up as storage (2026-10-29, `prop_data`): a drive
  (a label, two status lights, a port on another side), a sled (a dark front panel with a handle and two lights) or a memory
  module (a row of chips over a strip of gold contacts, a light on another side), with one light colour to a block. The
  details sit on the sides, never the top, and are few (three or four materials to a block, no hidden back faces): every
  drifting block's material is a mesh of its own in the file, and the zone is the nearest of the five to its 500 kB.
- **Upper air:** solar cells on the panels, gold foil on the satellites, three satellites with dishes and cell wings (one
  `satellite()` model), and a weather balloon drifting past.
- **Orbit:** the steps are asteroids (`asteroid()`: a lumpy rock whose flat top fills the box's top as a rounded square,
  narrowing to a point underneath); seventy more rocks all round, a few great ones far out; and in the sky (`SKY_`, no fog)
  a banded planet with three rings just over the horizon (`planet_texture`), a space station, a ship with glowing engines and
  two satellites. Orbit's shade gets more light from the Earth below, so the rocks' dark sides are never black.

**The climb is lit** (the author's new art style, 2026-10-27, after the first full climb: "lit shaded and colorful scenes
with objects and less line work"). Each zone file says `style = lit` on its `ZONE_` empty, and the game draws its own
materials (colour, roughness, metal, glow), flat shaded, lit by a sun and a sky light, with no edge lines: a workshop of
wood, books, tool chests and floppies; navy server racks with status lights and glowing fan rings; pastel data blocks among
clouds; blue solar panels and orange girders over the Earth; rock shards under the stars and the Moon, up to the brass ring.
Each zone has a look in `climb.json` (`LOOKS` in `tools/ascent/build_climb.py`): the sky overhead, at the horizon and below,
the sun's colour, strength and direction (one direction for the whole climb, 2026-10-29: blended by height, a sun that
moved from zone to zone turned as the agent jumped near a zone's edge, and the author saw the shadows swing), the sky light,
and how many stars show. The game blends them by height, 18 m
either side of a zone's start (`render.lit` in `config.ts`): a sky dome shaded from below the horizon to overhead with a
glow round the sun, fog in the horizon's colour, and the lights. Meshes named `SKY_` (the Earth, the Moon, the stars) are
drawn first, in a scene of their own with a camera that sees 8 km and no fog; the agent is drawn last in a scene of its own,
so its lights (which follow the camera) light it alone. A lit zone's still scenery is merged into one mesh per material, so a
frame is about 50 draw calls. The game's 3D scenes have their own colours; the page round the game and the HUD keep the
site's tokens and its one accent. `climb.vitest.ts` checks that no two faces of different materials share a plane anywhere in
the climb (they flicker): a detail on a face stands 4 mm proud of it (`PROUD` in the script).

The blob shadow is soft (dark in the middle, fading to its rim, 55% at most in the lit climb) and drawn only on the tops it
lies on, never past their edges.

The test climb (`?level=test`) and phase 1's level keep the first look, "blueprint noir", below.

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

The altitude block, the time and the controls line sit on small dark panels (the page's background at 88%, a hairline, a
small radius): the lit climb's skies run from obsidian to near white, and every line keeps its contrast over any of them.

- Altitude, top left (`412 m`)
- Time, top right (`14:32`)
- A zone altimeter on the left edge: one tick per zone, a brass marker for where you are
- A controls hint at the bottom for the first minute, then it fades out
- Pause menu (Esc): resume, restart, assist mode, settings, leave

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
- **Phone controls** (built, then removed 2026-10-28: desktop only): a virtual stick on the left, drag on the right half to
  look, a jump button. Portrait showed a "turn your phone sideways" prompt

### Sound (built 2026-10-27, after the author's first full climb: "incredibly silent")

Made in code with Web Audio (`audio.ts`): no audio files, nothing fetched. `sound-events.ts` (pure, unit-tested) reads the
sim each frame and says what to play: a jump, a landing as loud as it was hard, footsteps (one each 0.85 m run, feet
alternating), a fall back to the start or a beacon, a beacon touched, a panel creaking while it waits and cracking when it
breaks, a fan's updraft catching the agent, and a rising chord at the finish. Under them, each zone has a bed of sound,
mixed by height (12 m either side of a zone's start): the workshop's room tone, the server stack's fan drone and mains hum
with an odd beep, the cloud's wind, gusting unevenly with a faint whistle, and two soft high notes (its first wind swelled
slowly and sounded like the sea; the next, the high end of the noise alone, sounded like static to the author),
the upper air's thinner wind over a rumble, and orbit's quiet two-note pad. Volume and
mute are in Settings (`r7-ascent-settings`); the sound is quiet while paused and closed when the game is taken away.

### Later (not committed)

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
| `gltf-level.ts` | a level file made in Blender, read with `GLTFLoader`: its part of a level (`PartModel`: the `LevelPart`, its scenery, the scenery of each drifting or crumbling box apart, its `GOAL`); a whole level in one file is a `LevelModel` |
| `climb.ts` | the full climb: `climb.json` (the zones, the ring) and the five zone files, loaded in order and joined (`loadClimb`); `zoneAt` says which zone a height is in |
| `agent.ts` | the robot from `assets/agent.glb`: loaded and checked (`AgentModel`: its parts and materials), drawn lit in token colours with edge lines on its obsidian parts, posed each frame, and its light, which turns with the camera; the capsule when there is no model |
| `agent-anim.ts` | the robot's animation as numbers: which animation the sim's state calls for (`chooseAnimation`: idle, run, jump, fall, land) and each frame's pose (`AgentAnimator`); pure, unit-tested |
| `clock.ts` | the fixed-step clock (the runner's, 1/120 s, with an accumulator and interpolation) |
| `input.ts` | keys and the mouse to a move vector, jump presses and a look delta, relative to the camera |
| `camera.ts` | the third-person orbit camera: yaw and pitch from the look input, a spring on the follow, pulled in when a box is in the way |
| `colors.ts` | the scene's colours, read from the tokens at runtime; the material names a level may use and their tones |
| `render.ts` | the Three.js view: reads the sim, draws the scene (the agent through `agent.ts`); `createView()` is null without WebGL |
| `settings.ts` | the player's settings (look speed, invert, reduced motion: as the system asks, always or never; volume and mute; graphics high or low), kept in the browser (`r7-ascent-settings`); parsing pure |
| `save.ts` | the climb in progress, kept in the browser (`r7-ascent-save`) and offered back; a versioned format checked field by field; the time as m:ss |
| `gesture.ts` | full screen and the pointer lock, asked for inside the click or key press that starts or resumes the climb; `hasKeyboardAndMouse`, which the pages ask before offering Play; small and free of three.js, so the page's Play button can use it before the game has loaded |
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
   command, and the same Blender gives the same file. Blender itself does not always: an icosphere's or a UV sphere's
   vertices, and a twice-bevelled box's faces and the way its many-cornered faces are cut into triangles, come out in a
   different order from run to run, so the scripts sort them (`in_order`, `chamfered` in `build_climb.py`). Build twice and
   compare the files after a change to the geometry code.
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
| An empty named `BEACON_<n>`, custom property `beacon` = n | An assist-mode checkpoint, where the agent's feet go; numbered in climbing order across the zones |
| An empty named `ZONE_<n>`, with `zone`, `title`, `base`, `top` | The zone a file holds: its number, name and heights (the HUD's altimeter) |
| A `COL_` box with `fan` = h and `strength` | An updraft h metres high over the box, pushing up at `strength` m/s² (the speed is capped: `config.fan`) |
| A `COL_` box with `mover` = 1, `move_x`, `move_y`, `move_z` and `period` | A drifting block: to that offset (Blender's axes) and back, easing at each end, once every `period` seconds; it carries the agent standing on it |
| A `COL_` box with `crumble` = s | A plate that breaks s seconds after the agent first stands on it, and comes back 4 s later (`config.crumble`) |
| Meshes named `<name>` and `<name>__…` beside `COL_<name>` | The scenery of that box: it moves or falls with it |
| An object named `GOAL`, with `ring_radius` and `ring_tube` | The orbit ring, turned about the vertical through its origin; touching it finishes the climb |
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
| Each zone `.glb` | < 500 kB, loaded as the player nears it (`climb.vitest.ts`). Since the polish (2026-10-28) the zones are packed with `gltfpack` (below): 421, 476, 398, 359 and 427 kB with every zone finished (2026-10-29), 2.08 MB in all; with the cloud's
data blocks made up as drives, sleds and modules the same day, 421, 476, 500, 354 and 426 kB, 2.18 MB in all (the
test's limit is 500 × 1,024 bytes, so the cloud's 500,180 bytes pass with about 12 kB to spare); with only the workshop finished they were 421, 234, 255, 199 and 185 kB. The server stack is nearest the limit: its rack towers are most of it. Before the polish they were 228, 196, 219, 171 and 135 kB. The test climb is 52 kB (11 kB gzipped) |

**Packing (decided with the author 2026-10-28).** `tools/ascent/build_climb.py` exports each zone raw to
`tools/ascent/out/raw/` and packs it into the assets with `gltfpack` (a dev dependency, run through `npx`; `PACK` in the
script): meshopt compression, every node, material and custom property kept, positions as floats rounded to 16 bits,
texture coordinates as floats, normals in 8 bits. The game decodes it with three.js's own `MeshoptDecoder` (gltf-level.ts),
which runs in Node too, so the unit tests read the packed files. Three things keep it exact where it matters: every mesh is
stored about its own middle (the rounding works on small numbers: under a millimetre, where world coordinates 300 m up
would round by several), a collision box is a unit cube scaled by its node (a node's scale and place are kept exactly), and
the still scenery is joined into one mesh per material before export (a file of a few dozen meshes instead of hundreds:
each mesh is an entry in the file's index). A piece thinner than 15 cm is not bevelled (its bevel cannot be seen, and costs
triangles).

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

- [x] Touch controls and the portrait prompt
- [x] HUD (altitude, time, zone altimeter) and pause menu
- [x] Save and resume; settings (volume waits for sound, which is "Later")
- [x] Assist mode and beacons
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

**The finish screen** (2026-10-27, after the author's first climb: the text was too small in full screen). The HUD and the
finish screen size their text by the stage's width (`cqw`), between token sizes; the finish is a solid panel over a darker
scrim, with a large Climb again.

**The rest of phase 2 (2026-10-27).** The author asked for it before phase 3, since the finish needs the timer and the public
page is meant for phones too.

- **HUD.** Top left: the altitude, the best, the falls and the zone's name. Top right: the time (m:ss). Down the left edge,
  the altimeter: a hairline, a tick where each zone starts and a brass marker for the agent (a level without zones is one
  zone from the start to the goal). The controls hint shows for the first minute.
- **Pause menu.** Escape pauses; the message then holds real buttons: Resume (focused, so
  Space or Enter resumes), Restart (pressed twice: "Restart from the floor?"), Assist mode (a toggle), Settings and Leave
  (only when the host gives `onLeave`). A click on the game around the menu still resumes. Keys pressed on the menu's own
  controls are theirs (Space presses the button; it does not jump).
- **Settings** (`settings.ts`): look speed (0.4 to 2.5 times), invert looking up and down, and motion (as the system asks,
  reduced, or full). They apply at once and are kept in `r7-ascent-settings`. Reduced motion is read every frame.
- **Save and resume** (`save.ts`): the climb (position, facing, time, best, falls, jumps, assist mode, checkpoint) is saved
  every 5 s of play, on every pause, when the tab hides or the page goes, and when the game is taken away. A host names the
  level (`saveAs`); a save is offered back only on the same level, as "Continue · 44 m · 5:12" beside "New climb" on the ready
  screen. Restart clears it. Every read and write is in try/catch, and a save that is old, for another level or broken is
  ignored.
- **Assist mode** (off by default: hardcore). Beacons are `BEACON_<n>` empties in a level file (three on phase 1's course);
  standing at one makes it the checkpoint. In assist mode a beacon shows as a brass ring with a brass diamond over it, the
  checkpoint larger, and a fall of 6 m below the checkpoint, or off the world, puts the agent back on it ("You fell. Back to
  your last beacon."). Turning it on marks the climb as assisted for the finish, until a restart with it off.
- **Desktop only** (decided 2026-10-28; the touch controls of phase 2 were removed). A precise 3D jumping game is hard to
  play on a phone, and the graphics are aimed at a desktop's. Both pages ask `hasKeyboardAndMouse` (some pointer that is
  fine and can hover: a laptop with a touch screen still plays); without one, a line says the game is played with a keyboard
  and a mouse in place of Play. The page itself still reads at every width.

Tests: `settings.vitest.ts` (settings, the save format, the stick), more in `input.vitest.ts` and `sim.vitest.ts` (assist
mode, restore), and in `tests/ascent.spec.js` (the menu, assist and settings; saving and Continue; the Graphics setting;
a phone is told to use a computer).

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

- [ ] The five zones, scripted in Blender, each approved from renders (built; the renders wait for the author's approval)
- [x] Fans, movers and crumbling plates
- [x] The orbit ring, the finish screen and the credits (the credits are the host's lines: the public page's)
- [x] Zones loaded as the player nears them
- [x] Tuning for a 15–20 minute first climb (by estimate: see below; the author's own climb is the real test)

**Done when:** the author can climb from the workshop to orbit.

**What was built (2026-10-27).** `tools/ascent/build_climb.py` builds the whole climb and exports one file per zone,
`src/game/ascent/assets/zone-1.glb` to `zone-5.glb`, and `climb.json` beside them (each zone's name and heights, and where the
ring is):

```
"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" -b --factory-startup -P tools/ascent/build_climb.py
"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" -b --factory-startup -P tools/ascent/build_climb.py -- --preview
```

The second also renders `tools/ascent/out/climb-overview.png` and, per zone, `zone-<n>.png` (the zone from outside, and a
climber's view; zone 5's shows the ring). They wait for the author's approval.

The route is one walk upward, laid out by a seeded generator: each step is placed from the last by a rise and a gap drawn
from the zone's ranges, inside the jump's reach, turning round the zone's middle, and moved until nothing is in its way or in
the room above it. The same Blender gives the same files. 451 steps:

| Zone | From | Steps | Scenery | New |
|---|---|---|---|---|
| 1 Workshop | 0 m | 118 | giant books, toolboxes, chips and floppies round a stack of hardware (a PC case, manuals, a tool chest, a monitor) | static jumps; beams |
| 2 Server stack | 71 m | 75 | rack units, heat sinks and cable trays round a column of racks | 7 fans, each lifting about 5 m to a block beside it |
| 3 Cloud | 151 m | 109 | soft data blocks in open air, more far out for depth | 27 drifting blocks (3 to 5.5 m, every 4.5 to 6.5 s) |
| 4 Upper air | 229 m | 93 | solar panels, girders, an antenna mast with a satellite | 31 crumbling panels (0.7 s), thin beams |
| 5 Orbit | 301 m | 56 | asteroids, girders | drifting blocks, crumbling panels and beams together (no fans); the ring at 351 m |

`level.vitest.ts`'s rules, for the whole climb (`climb.vitest.ts`, the files read through the game's own loader): every step
within reach (from a drifting block's far end; up a fan's updraft), each step higher than the last, nothing overlapping
wherever the drifting blocks are, each zone's new kind first in that zone, and a full jump from the last platform under the
ring's lowest point touching it. 20 beacons for assist mode, one at each zone's start and every 24 steps.

In the game (`sim.ts`): an updraft adds its push while the agent is over a fan, up to 9 m/s; a drifting block is placed by
the sim's time (so a restart or a saved climb puts it back exactly), carries the agent standing on it, and pushes it aside
rather than through it; a crumbling panel shakes while it waits to break, drops away, and is back 4 s later (not while the
agent is where it would be); touching the ring finishes the climb and stops the clock. The view (`render.ts`) draws each
zone's still scenery as one mesh and one set of lines, each moving box's apart, and fan updrafts as ivory streaks rising
through them. Zones 1 and 2 load on Play; the next one loads when the agent enters the one below it (a failed load is tried
again 5 s later), and a saved climb high up waits for its zones. The finish screen gives the time, the falls and the jumps,
says if assist mode was used, offers Climb again, and lists the host's credits; the save is cleared.

**Tuning, by estimate.** 451 steps, each taking at least a jump's time in the air plus 1.25 s to line it up, plus half a
drift's period of waiting on each drifting block: about 16 minutes without a fall (zones 3.8, 2.4, 3.7, 3.0 and 1.8 minutes).
A first climb with a few hardcore falls lands around 17 to 22 minutes. The numbers that set it are in `build_climb.py`
(`ZONES`: each zone's rise, gap and block size).

### Phase 4: Polish and the public page

- [ ] Look pass (fog, edge lines): waits for the author's own climb. The agent's animations are built (phase 2, "The robot agent")
- [x] The public page and its `tests/routes.js` entry (smoke, axe, budgets and Lighthouse cover the page before Play)
- [x] The `/apps/` entry, through the add-content skill: `src/content/projects/r7-ascent.md`, written by Kepler, `draft: true` until the author publishes it
- [x] Unit tests for the save format (`settings.vitest.ts`, phase 2)
- [x] `CLAUDE.md` updated (paths); the README has no game section to change
- [ ] Page copy, reviewed by the author

**What was built (2026-10-27).** `/ascent/` (`src/pages/ascent/index.astro`): an ordinary page of the site with the game's
stage and a Play button; its words are `src/content/pages/ascent.md`, a page with a fixed frame like Privacy (edited in /admin,
Pages): a Lead above the game, how to play and the zones below it, and a last Text block as the credits, shown again on the
finish screen (`{author.name}` prints the author's name from Site settings). Play goes full screen and locks the mouse in
the click, then loads the game, the climb's first zones and the robot. Not in the main nav. The project page
`src/content/projects/r7-ascent.md` (by Kepler, a draft) lists it on `/apps/` once published: a project's `playUrl` may now be
a page of this site, which opens in the same tab (`playMode: link`; `docs/CONTENT_MODEL.md`).

**Done when:** the site's definition of done holds (`CLAUDE.md`), including 320–1480 px and no console errors.

## Still open

| Question | Recommendation |
|---|---|
| The public URL | Decided (2026-10-27): `/ascent/`. A project's `playUrl` may be a page of this site, so the game joins `/apps/` through its project page |
| Link in the main nav, or on the hub? | Decided (2026-10-27): not in the nav; on `/apps/` (once the project page is published) and linked from it. The nav is the author's to change in Site settings |
