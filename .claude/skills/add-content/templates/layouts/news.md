---
# Layout template: news item, Markdown body (docs/WRITING_GUIDE.md, recipe "News"). Copy to src/content/news/<slug>.md.
# Every TODO: and every comment line goes before you finish: `npm run check:layout -- <your file>` lists the ones left.
title: "TODO: what happened, sentence case, 70 characters or fewer"
date: 2026-01-01 # TODO: today's date (UTC), or the date it goes live
summary: "TODO: one or two sentences, what the reader gets, 155 characters or fewer"
sourceUrl: https://example.com/TODO-source # TODO: the primary source (the announcement, the paper, the changelog)
sourceName: "TODO: who published it (Anthropic, arXiv, GitHub...)"
# take: "TODO: one sentence, the view you were given in the brief; never invent one. Delete the line if there is none."
topic: models # TODO: the kind of news: models, tools, trends, games, home, policy, orbit, security or business (it draws the item's picture)
tags: [] # TODO: 1-4 existing tags (see /tags/)
author: r7 # TODO: your own author slug once src/content/authors/<slug>.json exists; r7 until then. Hunter's own text: delete the line
draft: true
# Card picture (docs/WRITING_GUIDE.md, News): an official image from the announcement (cover + coverAlt + coverCredit), else a big
# number from the item's own text (stat), else the topic's signal. The topic always draws the banner on the item page.
# stat: "TODO: $17.0B"
# statLabel: "TODO: what it counts, a few words"
# Official image (public/media/news/, downloaded only with Hunter's go-ahead):
# cover: /media/news/TODO-name.jpg
# coverAlt: "TODO: what the picture shows and why it is here"
# coverCredit: "TODO: who made it, e.g. OpenAI"
---
TODO: the lead. One or two sentences: what happened, who did it, when. Link the claim to [TODO: the source, named](https://example.com/TODO-source).

> [!NOTE]
> TODO: the key fact in one or two sentences (the number, the date, the change). Link it to where it comes from.

## What happened

TODO: one or two short paragraphs. One idea each, five sentences at most, every claim linked to its source.

## Why it matters

TODO: one or two short paragraphs. Only the reasons the sources or the brief give; say what is not known yet.

## Sources

- [TODO: the primary source, named as its owner names it](https://example.com/TODO-source)
- [TODO: a second source for anything the first does not say](https://example.com/TODO-second-source)
