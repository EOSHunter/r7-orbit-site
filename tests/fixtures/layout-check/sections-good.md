---
title: An example tool moves its settings *into each project*
date: 2026-01-01
summary: EXAMPLE ONLY, not published content. The same release laid out with the news recipe, as sections.
sourceUrl: https://example.com/example-release
sourceName: Example source
tags: [example]
author: r7
cover: /media/news/example-release.png
coverAlt: The example tool's settings screen, with a new "Project settings" tab open next to the old "Global" tab
draft: true
sections:
  - type: lead
    text: An example tool released version 2 this week. Its settings now live in each project instead of one file in the home folder.
  - type: callout
    kind: info
    title: The key fact
    text: The old settings file is still read, but [version 2 no longer writes it](https://example.com/example-release#settings).
  - type: heading
    text: What happened
    level: 2
  - type: text
    text: |-
      Version 2 changes four things, according to [the release notes](https://example.com/example-release):

      - settings move into each project;
      - two commands are renamed, and the old names still work for now;
      - plugins written for version 1 load, with a warning;
      - start-up is faster, by an amount the notes do not give.
  - type: heading
    text: Why it matters
    level: 2
  - type: text
    text: |-
      If you keep one settings file for every project, version 2 will keep reading it until you save a change. After that, the change goes into the project only.

      I have not measured the speed claim, so I am not repeating it as a number.
  - type: heading
    text: Sources
    level: 2
  - type: links
    items:
      - label: Example tool release notes, version 2
        url: https://example.com/example-release
        note: release notes
      - label: The settings section of the notes
        url: https://example.com/example-release#settings
---
