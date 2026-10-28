---
title: "R7: *Ascent*"
date: 2026-10-27
summary: "A 3D climbing game in the browser: from a workshop floor to the brass ring in orbit, with no checkpoints unless you turn on assist mode."
tags: [games, ai-agents]
status: building
stack: [TypeScript, Three.js, Blender, Python]
role: Directed the AI agents
started: 2026-10-27
playUrl: /ascent/
appType: game
playMode: link
platforms: [desktop, mobile]
playNote: "Needs WebGL. On a phone, hold it sideways."
controls:
  - { key: "W, A, S, D or arrow keys", action: "Move, relative to the camera" }
  - { key: "Space", action: "Jump: hold for a full jump, tap for a short hop" }
  - { key: "Mouse", action: "Look around (Play locks the mouse to the game)" }
  - { key: "Q and E", action: "Turn the camera from the keyboard" }
  - { key: "Esc", action: "Pause and open the menu; again to leave full screen" }
author: kepler
draft: true
# IMAGE NEEDED: cover: a screenshot of the climb from the game's camera, the robot from behind on a block in the Server stack or the Cloud, 16:9 and 1280px wide or more, in public/media/projects/. It is also the card on /apps/.
---

R7: Ascent is a 3D climbing game that runs in the browser. You start on the floor of a giant workshop and climb through five zones to the brass ring from the R7 logo, in orbit. One missed jump can drop you a long way, and by default there are no checkpoints. A first climb is meant to take 15 to 20 minutes. (The name is a nod to the R-7, the rocket that put Sputnik into orbit.)

## What it does

You play as a small robot: an ivory head with one brass visor band, a short antenna, and a battery pack on its back, since the camera sees it from behind most of the time. Each zone adds one new kind of jump:

1. **Workshop.** Giant books, toolboxes and chips round a tower of hardware. Plain jumps, to learn the controls.
2. **Server stack.** Fans that blow you upward to blocks you could not jump to.
3. **Cloud.** Data blocks that drift back and forth, carrying you with them.
4. **Upper air.** Solar panels that break a moment after you land on them, and thin girders.
5. **Orbit.** Drifting blocks, crumbling panels and girders, up to the ring. Touching it ends the climb, and the finish screen shows your time and falls.

Assist mode, in the pause menu, adds beacons along the way: fall too far and you go back to the last one you touched. The game saves your climb in the browser when you pause or leave, and works on a phone held sideways, with a thumb stick on the left and a Jump button on the right.

> [!WARNING]
> IMAGE NEEDED: a screenshot of a fan's updraft or a drifting block, from the game's camera, for this section. Replace this note with the picture once the file is in public/media/projects/.

## How it works

The game runs on three.js, a library for drawing 3D in the browser, and loads only when you press Play, so the page stays light until then.

Every model and level is a Python script that Blender, a free 3D program, runs without opening a window. The script builds the scene from numbers and exports it as a file the game reads. A note like "make the server racks taller" is an edit to the script and a rebuild. The climb's 451 steps come from one of these scripts: it places each step from the last, inside the reach of a jump, and moves it until nothing blocks the way or the room above it. A test then reads the exported files and checks every step against the game's own jump, so a layout change that breaks the climb fails before anyone plays it.

The jump is built to be fair. A jump still counts just after you step off an edge, a jump pressed just before you land happens when you land, and holding Space gives a full jump while a tap gives a short hop.

## What worked and what did not

| Worked | Did not |
| --- | --- |
| Scripts as the level editor: Hunter reviews renders, and every change is an edit and a rebuild | The first character was a plain capsule. Hunter found it too plain, so it became the robot |
| A test that checks all 451 steps against the jump | The robot's first renders looked flat. Smooth shading and lights that turn with the camera fixed it |
| Loading the game only on Play | The first renders of the whole climb never finished: the script added each edge line to one growing mesh, slower with every line. Built all at once, the whole run of renders takes about 12 seconds |
| Zones that load as you climb toward them | The climb's length is an estimate from the layout, about 16 minutes without a fall. Nobody has climbed it top to bottom yet |

## Links

- [Play R7: Ascent](/ascent/)
- [Every game and app on this site](/apps/)
