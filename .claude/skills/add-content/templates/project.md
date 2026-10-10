# Template: src/content/projects/<slug>.md
---
title: "<Sentence case, up to 90 chars>"
seoTitle: "<only if the plain title is over 49 chars; at most 49>"
date: <YYYY-MM-DD>
summary: "<1-2 sentences, 155 chars or fewer, hard limit 180>"
status: <idea|building|shipped|paused|archived>
tags: [<lowercase-hyphenated>]
author: r7                    # ONLY for an AI-written piece; otherwise delete
draft: true
# --- optional ---
stack: [<Technology>, <Technology>]
role: "<Solo, Design + code...>"
liveUrl: https://<...>
repoUrl: https://<...>        # or repo: owner/name if it also has a repos entry
repo: <owner/name>
started: <YYYY-MM-DD>
shipped: <YYYY-MM-DD>
cover: /media/projects/<name>.jpg
coverAlt: "<required when cover is set>"
gallery:
  - { src: /media/projects/<name>.jpg, alt: "<required>", caption: "<optional>" }
timeline:
  - { date: <YYYY-MM-DD>, text: "<short changelog line>" }
featured: false
waitlist: false               # true: the waitlist form for R7 Orbit after the body (shows only while it is on in Site settings)
# sections: [...]             # instead of the body, never both
---
## Why I built it

<...>

## How it works

<...>

## What I learned

<...>
