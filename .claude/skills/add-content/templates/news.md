# Template: src/content/news/<slug>.md   (a news file may start with the date: 2026-10-06-short-headline.md)
---
title: "<Sentence case, up to 90 chars>"
seoTitle: "<only if the plain title is over 49 chars; at most 49>"
date: <YYYY-MM-DD>
summary: "<1-2 sentences, 155 chars or fewer, hard limit 180>"
sourceUrl: https://<the thing being discussed; required>
sourceName: "<Anthropic, arXiv, The Verge...; required>"
topic: <models | tools | trends | games | home | policy | orbit | security | business>   # the kind of news; draws the picture when there is no cover
tags: [<lowercase-hyphenated>]
author: r7                    # ONLY for an AI-written piece; otherwise delete (default hunter-newton)
draft: true
# --- optional ---
take: "<one sentence verdict, shown as 'My read: ...'; the author's view, never invented>"
updated: <YYYY-MM-DD>
featured: false
waitlist: false               # true: the waitlist form for R7 Orbit after the body (shows only while it is on in Site settings)
cover: /media/news/<name>.jpg
coverAlt: "<required when cover is set>"
readTime: <minutes>
canonicalUrl: https://<only if first published elsewhere>
aiAssist: <none|edited|drafted>
# sections: [...]             # instead of the body, never both
---
<150-500 words: what happened, why it matters (or does not), what the author would do. Every claim linked to its source.>
