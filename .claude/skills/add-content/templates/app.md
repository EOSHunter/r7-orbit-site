# Template: src/content/projects/<slug>.md  -- a game or an app is a project with playUrl (it then appears on /apps/)
# appType: one of APP_TYPES in src/lib/app-types.ts (today game | app). Left out, it is an app. It sets the card's type chip, its
# button (Play for a game, Open for an app), the /apps/ type filter and the structured data (VideoGame or WebApplication).
# Embedding needs the host in `frame-src` on the /projects/* line of public/_headers (explicit, space-separated, no wildcard), the
# same line in tests/headers.spec.js, and the app must allow framing by https://r7orbit.io. playMode: link needs neither.
# controls, platforms, playNote, order and appType need playUrl or the build fails.
---
title: "<Game or app name>"
date: <YYYY-MM-DD>
summary: "<1-2 sentences, 155 chars or fewer, hard limit 180>"
status: <idea|building|shipped|paused|archived>
playUrl: https://<app host>/         # https only; makes the project playable
appType: <game|app>                  # game: Play button, VideoGame; app (default): Open button, WebApplication
playMode: embed                      # embed (default) or link (a button to a new tab, no _headers entry)
playAspect: "16:9"                   # w:h of the frame, e.g. "4:3"
platforms: [<desktop|mobile>]
playNote: "<one line, 120 chars or fewer>"
controls:
  - { key: "<Space>", action: "<Fire>" }
order: <number; lower first on /apps/>
tags: [<lowercase-hyphenated>]
cover: /media/projects/<name>.jpg    # the poster behind the Play button and the card on /apps/
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
