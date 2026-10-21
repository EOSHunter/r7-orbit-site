---
# Layout template: vlog page written as sections (docs/WRITING_GUIDE.md, recipe "Vlog"). Copy to src/content/vlogs/<slug>.md.
# The page draws the video first; the blocks are the notes under it. Nothing goes under the closing ---.
# Every TODO: and comment goes before you finish: `npm run check:layout -- <your file>` lists the ones left.
title: "TODO: what the video shows, sentence case, one *brass phrase* at most"
date: 2026-01-01 # TODO: the day it goes up (UTC)
summary: "TODO: what the viewer gets, one or two sentences, 155 characters or fewer"
youtubeId: TODO_video1 # TODO: exactly the 11 characters after v= in the video's address
duration: "0:00" # TODO: m:ss or h:mm:ss
# chapters:
#   - { t: "0:00", title: "TODO: chapter title" }
tags: [] # TODO: 1-4 existing tags
author: r7 # TODO: your own author slug once it exists; r7 until then
draft: true
# poster: /media/vlogs/TODO-name.jpg
# transcriptText: |-
#   TODO: the transcript, only if the author supplies one (shown folded under the notes)
sections:
  - type: lead
    text: "TODO: what the video shows and who it is for, in one or two sentences."
  - type: heading
    text: In this video
    level: 2
  - type: text
    text: |-
      - TODO: one main point per line, in the order the video takes them
      - TODO: another point
  - type: button
    label: "TODO: Read the post"
    url: /blog/todo-related-post/
  - type: links
    items:
      - label: "TODO: anything the video mentions, named as its owner names it"
        url: https://example.com/TODO-link
---
