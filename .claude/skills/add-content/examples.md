# Worked examples

Placeholders only. Every value marked `SAMPLE` is made up for this page: replace it with what the author gave you, or remove the field. Do not copy these into `src/content/` as they are. Both blocks passed the real schema when this page was written (the skill's trial copied them to `src/content/`, built, and deleted them).

## A blog post, written as Markdown (`src/content/blog/sample-short-post.mdx`)

An AI-written piece from sources the author supplied: credited to Orbit, with the claims linked and the cover left out because no picture was given.

```mdx
---
title: 'What the *SAMPLE* changelog actually changed'
date: 2026-10-06
summary: 'SAMPLE: a short note on one release, built from the changelog the author linked.'
tags: [tooling, sample-tag]
author: r7
draft: true
---

SAMPLE opening paragraph. One idea, plain words, first person where the author is speaking. This sentence states one fact from the source: [the SAMPLE changelog](https://example.com/sample-changelog).

## What changed

SAMPLE paragraph. Each claim links its source. A claim with no source is left out, or listed in the final message as unverified.

## What I would do about it

SAMPLE paragraph in the author's voice, only if the author gave the view.
```

Notes: no `author` line would mean Hunter. The title is under 49 characters, so there is no `seoTitle`. No `cover`, so no `coverAlt`. `draft: true` until the author approves. The same post as blocks would drop everything under the front matter and add `sections:` (`lead`, `heading`, `text`) to the front matter.

## A vlog (`src/content/vlogs/sample-video-notes.md`)

```md
---
title: 'SAMPLE: notes from a short video about *agents*'
seoTitle: 'SAMPLE: notes from a short video'
date: 2026-10-06
summary: 'SAMPLE: the notes, chapters and links for a video the author recorded.'
youtubeId: SAMPLE_ID_1
duration: '8:30'
chapters:
  - { t: '0:00', title: 'SAMPLE: the setup' }
  - { t: '3:10', title: 'SAMPLE: what went wrong' }
tags: [video, sample-tag]
cover: /media/vlogs/sample-poster.jpg
coverAlt: 'SAMPLE: describe what the poster shows'
draft: true
---

SAMPLE: two or three sentences introducing the video. Links and resources it mentions go below. Do not transcribe the video here.

- [SAMPLE link text that says where it goes](https://example.com/sample)
```

Notes: `youtubeId` must be exactly 11 characters (`SAMPLE_ID_1` is a placeholder of the right length; the real id comes from the author). The title is over 49 characters once the asterisks are removed, so `seoTitle` is set and is 49 or fewer. `cover` points at a file that must exist in `public/media/vlogs/`: if the author gave no picture, delete `cover` and `coverAlt`. Credit to Hunter is the default, so there is no `author` line.
