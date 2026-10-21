---
# Layout template: news item written as sections (docs/WRITING_GUIDE.md, recipe "News"). Copy to src/content/news/<slug>.md.
# The body is the `sections` list: there must be nothing under the closing ---. Fields of every block: docs/SECTIONS.md.
# Every TODO: and every comment line goes before you finish: `npm run check:layout -- <your file>` lists the ones left.
title: "TODO: what happened, sentence case, 70 characters or fewer"
date: 2026-01-01 # TODO: today's date (UTC), or the date it goes live
summary: "TODO: one or two sentences, what the reader gets, 155 characters or fewer"
sourceUrl: https://example.com/TODO-source # TODO: the primary source
sourceName: "TODO: who published it"
# take: "TODO: one sentence, the view you were given in the brief; never invent one"
tags: [] # TODO: 1-4 existing tags
author: r7 # TODO: your own author slug once it exists; r7 until then
draft: true
# cover: /media/news/TODO-name.jpg
# coverAlt: "TODO: what the picture shows and why it is here"
# heroless: TODO: why there is no picture, if there is none
sections:
  - type: lead
    text: "TODO: what happened, who did it, when, in one or two sentences. Link it: [TODO: the source](https://example.com/TODO-source)."
  - type: callout
    kind: info
    title: The key fact
    text: "TODO: the number, the date or the change, in one or two sentences, linked to where it comes from."
  - type: heading
    text: What happened
    level: 2
  - type: text
    text: |-
      TODO: one or two short paragraphs, every claim linked to its source.

      TODO: a list works well for a release with several changes:

      - TODO: one change per line
      - TODO: another change
  - type: heading
    text: Why it matters
    level: 2
  - type: text
    text: |-
      TODO: one or two short paragraphs. Only the reasons the sources or the brief give; say what is not known yet.
  - type: heading
    text: Sources
    level: 2
  - type: links
    items:
      - label: "TODO: the primary source, named as its owner names it"
        url: https://example.com/TODO-source
      - label: "TODO: a second source"
        url: https://example.com/TODO-second-source
        note: "TODO: a word, e.g. paper"
---
