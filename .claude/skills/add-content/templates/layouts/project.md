---
# Layout template: project or app write-up, Markdown body (docs/WRITING_GUIDE.md, recipe "Project or app"). Copy to
# src/content/projects/<slug>.md. A project page draws Markdown only (no MDX components): pictures are ![alt](src), callouts
# are > [!NOTE], and for a gallery, a stats row or two columns write the sections version instead.
# Every TODO:, IMAGE NEEDED and comment goes before you finish: `npm run check:layout -- <your file>` lists the ones left.
title: "TODO: the project's name, or what it does, sentence case"
date: 2026-01-01 # TODO: today's date (UTC)
summary: "TODO: what it is and who it is for, one or two sentences, 155 characters or fewer"
status: building # TODO: idea | building | shipped | paused | archived
stack: [] # TODO: the real stack, e.g. [TypeScript, Three.js]
# role: "TODO: what the author did, e.g. Directed the AI agents"
# repoUrl: https://github.com/TODO-owner/TODO-name
# liveUrl: https://TODO-host/
tags: [] # TODO: 1-4 existing tags
author: r7 # TODO: your own author slug once it exists; r7 until then
draft: true
# The cover is the picture on the page, the card and the share image: 16:9, 1280px wide or more, in public/media/projects/.
# cover: /media/projects/TODO-name.png
# coverAlt: "TODO: what the picture shows"
# IMAGE NEEDED: cover: TODO: which screen of the project, and why
# gallery:
#   - { src: /media/projects/TODO-name.png, alt: "TODO: what it shows", caption: "TODO: optional" }
# A game or an app (it then shows on /apps/ with a Play or Open button): add playUrl, appType and the rest from templates/app.md.
---
TODO: what it is, in one short paragraph: what it does, for whom, where it runs.

## What it does

TODO: one or two short paragraphs, one idea each.

> [!WARNING]
> IMAGE NEEDED: TODO: the screenshot this section needs (which screen, what it shows). Replace this note with the picture once the file is in public/media/projects/: `![what it shows](/media/projects/name.png)` and an italic caption on the next line.

## How it works

TODO: the parts and how they fit, in plain words. A short real snippet from the repository only if it teaches something (15 lines at most):

```ts title="TODO-file.ts"
// TODO: a short real snippet, copied from the repository, or delete this block
```

## What worked and what did not

| Worked | Did not |
| --- | --- |
| TODO: one thing | TODO: one thing |
| TODO: another | TODO: another |

## Links

- [TODO: the repository on GitHub](https://github.com/TODO-owner/TODO-name)
- [TODO: the related post or vlog](/blog/todo-related-post/)
