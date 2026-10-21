---
# Layout template: project or app write-up written as sections (docs/WRITING_GUIDE.md, recipe "Project or app"). Copy to
# src/content/projects/<slug>.md. Nothing goes under the closing ---. The page's play section, facts, gallery and changelog
# still come from the front matter.
# Every TODO:, IMAGE NEEDED and comment goes before you finish: `npm run check:layout -- <your file>` lists the ones left.
title: "TODO: the project's name, or what it does, sentence case"
date: 2026-01-01 # TODO: today's date (UTC)
summary: "TODO: what it is and who it is for, one or two sentences, 155 characters or fewer"
status: building # TODO: idea | building | shipped | paused | archived
stack: [] # TODO: the real stack
# repo: TODO-owner/TODO-name
tags: [] # TODO: 1-4 existing tags
author: r7 # TODO: your own author slug once it exists; r7 until then
draft: true
# cover: /media/projects/TODO-name.png
# coverAlt: "TODO: what the picture shows"
# IMAGE NEEDED: cover: TODO: which screen of the project
# A game or an app: add playUrl, appType and the rest from templates/app.md (the Play panel is drawn from them).
sections:
  - type: lead
    text: "TODO: what it is, what it does, for whom, where it runs."
  # The repository's language, stars and last update, fetched at build time (a public repository only):
  # - type: stats
  #   repo: TODO-owner/TODO-name
  - type: heading
    text: What it does
    level: 2
  - type: text
    text: |-
      TODO: one or two short paragraphs, one idea each.
  - type: callout
    kind: warn
    title: IMAGE NEEDED
    text: "TODO: the screenshots this needs. Pictures go in public/media/projects/. Replace this block with the gallery below."
  # - type: gallery
  #   label: "TODO: Screenshots"
  #   shots:
  #     - image: /media/projects/TODO-first.png
  #       alt: "TODO: what it shows"
  #       caption: "TODO: optional"
  - type: heading
    text: How it works
    level: 2
  - type: text
    text: |-
      TODO: the parts and how they fit, in plain words.
  - type: code
    lang: ts
    title: "TODO: file name"
    code: |-
      // TODO: a short real snippet, copied from the repository (15 lines at most), or delete this block
  - type: heading
    text: What worked and what did not
    level: 2
  - type: columns
    ratio: "1:1"
    left: |-
      **Worked**

      - TODO: one thing
    right: |-
      **Did not**

      - TODO: one thing
  - type: links
    items:
      - label: "TODO: the repository on GitHub"
        url: https://github.com/TODO-owner/TODO-name
      - label: "TODO: the related post or vlog"
        url: /blog/todo-related-post/
---
