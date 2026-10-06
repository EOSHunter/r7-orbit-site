# Template: src/content/projects/<slug>.md  -- a game is a project with playUrl (it then appears on /games/)
# Embedding needs the host in `frame-src` on the /projects/* line of public/_headers, and the game must allow framing by https://r7orbit.io.
# controls, platforms, playNote and order need playUrl or the build fails.
---
title: "<Game name>"
date: <YYYY-MM-DD>
summary: "<1-2 sentences, 155 chars or fewer, hard limit 180>"
status: <idea|building|shipped|paused|archived>
playUrl: https://<game host>/        # https only; makes the project playable
playMode: embed                      # embed (default) or link (a button to a new tab, no _headers entry)
playAspect: "16:9"                   # w:h of the frame, e.g. "4:3"
platforms: [<desktop|mobile>]
playNote: "<one line, 120 chars or fewer>"
controls:
  - { key: "<Space>", action: "<Fire>" }
order: <number; lower first on /games/>
tags: [<lowercase-hyphenated>, game-dev]
cover: /media/projects/<name>.jpg    # the poster behind the Play button and the card on /games/
coverAlt: "<required when cover is set>"
stack: [<Technology>]
author: r7                           # ONLY for an AI-written piece; otherwise delete
draft: true
---
## Why I built it

<...>

## How it works

<...>

## What I learned

<...>
