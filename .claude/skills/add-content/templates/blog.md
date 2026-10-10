# Template: src/content/blog/<slug>.mdx  (the real file is .mdx; this one is .md so nothing builds it)
# Delete every line you do not use. Placeholders are in <angle brackets>: none may survive.
---
title: "<Sentence case, up to 90 chars, at most one *brass phrase*>"
seoTitle: "<only if the plain title is over 49 chars; at most 49>"
date: <YYYY-MM-DD>            # today by default (UTC); a future date = scheduled
summary: "<1-2 sentences, 155 chars or fewer, hard limit 180>"
tags: [<lowercase-hyphenated>, <max 6>]
author: r7                    # ONLY for an AI-written piece. For Hunter's own writing delete this line (default hunter-newton)
draft: true                   # false only when the author says it goes live
# --- optional ---
subtitle: "<up to 140 chars>"
updated: <YYYY-MM-DD>
featured: false               # only one post at a time may be true
waitlist: false               # true: the waitlist form for R7 Orbit after the body (shows only while it is on in Site settings)
readTime: <minutes, whole number; omit to compute>
toc: <true|false>             # omit: contents list at 3+ h2
series: "<series name>"
seriesOrder: <1, 2, 3; required with series>
featuredImage: ../../assets/blog/<name>.jpg   # file in src/assets/blog/
featuredImageAlt: "<what the picture shows; empty string only if decorative>"
cover: /media/blog/<name>.jpg                 # file in public/media/blog/
coverAlt: "<required when cover is set>"
canonicalUrl: https://<only if first published elsewhere>
aiAssist: <none|edited|drafted>               # not on an R7 post
# --- or write the body as blocks instead of Markdown (never both; see docs/SECTIONS.md) ---
# sections:
#   - type: lead
#     text: "<one short paragraph>"
#   - type: heading
#     text: "<Section heading>"
#   - type: text
#     text: |-
#       <Markdown paragraphs>
---
<MDX body, headings from ##. No body at all if you use sections.>
