---
title: "Vesper Drift"
seoTitle: "Vesper Drift, a browser space game"
date: 2026-10-05
summary: A browser game where you start as a drifting pebble and grow through 12 forms, from Meteorite to Black Hole, absorbing what is smaller.
tags: [vesper-drift, r7-orbit, ai-agents, games]
cover: /media/projects/vesper-drift/poster.jpg
coverAlt: "Vesper Drift at stage 12: a black hole with a lensed accretion disc and the HUD"
status: shipped
stack: [JavaScript, Three.js, WebGL2]
role: Directed the AI agents
shipped: 2026-10-05
playUrl: https://play.r7orbit.io/
playMode: embed
playAspect: "16:9"
controls:
  - { key: "Mouse (hold)", action: "Thrust toward the pointer; the farther away it is, the harder the thrust" }
  - { key: "WASD / arrow keys", action: "Steer with the keyboard" }
  - { key: "Space (or Shift)", action: "Stabilise: kill drift and settle (3D build)" }
  - { key: "T", action: "Toggle top-down camera (3D build)" }
  - { key: "Esc", action: "Pause / open the menu" }
  - { key: "1-4 or click", action: "Pick an evolution card" }
platforms: [desktop]
playNote: "Best on desktop with a mouse and a WebGL2 browser. Touch controls are not documented."
draft: false
---

Vesper Drift is a browser game. You start as a drifting pebble, absorb anything smaller than you, dodge anything bigger, and grow through 12 forms until you are a black hole. At milestone stages you pick an evolution that changes your speed, toughness or appetite, and those picks decide which ending you get. A full run takes about 13 to 16 minutes. It runs in 3D with Three.js and WebGL2 by default, and falls back to a 2D renderer if WebGL2 is missing.

I didn't write the code by hand. A team of AI agents built it in R7 Orbit while I directed the work: each agent on its own branch, changes coming back to main through pull requests. [The vlog](/vlogs/building-a-browser-game-with-ai-agents-in-r7-orbit/) shows how that went.
