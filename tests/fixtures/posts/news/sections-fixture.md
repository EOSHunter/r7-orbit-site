---
title: A news item written as *sections*
date: 2026-10-02
summary: Fixture for the tests, not part of the site. A news item whose body is a list of blocks instead of Markdown.
waitlist: true
sourceUrl: https://example.com/fixture-source/
sourceName: Example source
take: A fixture take, shown beside the source link as on any news item.
tags:
  - fixture-sections
author: r7
sections:
  - type: text
    text: |-
      This is a **fixture** news item. Its body is a list of blocks, and the source box and the take above it still come from the front matter.

      The word nebulawren appears only in this item, for the search test.
  - type: heading
    text: Why it *matters*
    level: 2
  - type: text
    text: A second paragraph under a heading. A news item with fewer than three section headings has no contents list, as with a Markdown body.
  - type: callout
    kind: info
    text: A note in the fixture news item.
---
