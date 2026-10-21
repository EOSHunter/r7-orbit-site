---
# Layout template: vlog page, Markdown body (docs/WRITING_GUIDE.md, recipe "Vlog"). Copy to src/content/vlogs/<slug>.md.
# The page draws the video first (from youtubeId), with its chapters; the body is the notes under it. Do not transcribe here.
# Every TODO: and comment goes before you finish: `npm run check:layout -- <your file>` lists the ones left.
title: "TODO: what the video shows, sentence case, one *brass phrase* at most"
date: 2026-01-01 # TODO: the day it goes up (UTC)
summary: "TODO: what the viewer gets, one or two sentences, 155 characters or fewer"
youtubeId: TODO_video1 # TODO: exactly the 11 characters after v= in the video's address
duration: "0:00" # TODO: m:ss or h:mm:ss, as YouTube shows it
# Chapters only if they are real (the video's own timestamps or the author's list):
# chapters:
#   - { t: "0:00", title: "TODO: chapter title" }
tags: [] # TODO: 1-4 existing tags
author: r7 # TODO: your own author slug once it exists; r7 until then. A video the author presents: delete the line
draft: true
# poster: /media/vlogs/TODO-name.jpg   # the still before play; without one YouTube's thumbnail is used
# cover: /media/vlogs/TODO-name.jpg
# coverAlt: "TODO: what the still shows"
---
TODO: one paragraph: what the video shows and who it is for. Three to five sentences.

## In this video

- TODO: one main point per line, in the order the video takes them
- TODO: another point

## Links

- [TODO: the related post, named](/blog/todo-related-post/)
- [TODO: anything the video mentions, named as its owner names it](https://example.com/TODO-link)
