---
title: A project written as *sections*
date: 2026-10-04
summary: Fixture for the tests, not part of the site. A playable project whose write-up is a list of blocks instead of Markdown.
status: building
stack:
  - Astro
  - TypeScript
role: Fixture
playUrl: https://vesper.r7orbit.io/
playMode: embed
playAspect: "16:9"
playNote: The play section comes from the front matter, as on any playable project.
platforms:
  - desktop
controls:
  - key: Space
    action: Fire
tags:
  - fixture-sections
author: r7
sections:
  - type: text
    text: This is a **fixture** project. Its write-up is a list of blocks; the play section, the facts and the changelog still come from the front matter. The word pulsarfinch appears only here, for the search test.
  - type: image-row
    images:
      - image: /og-default.png
        alt: The brand image, first in a row of two
        caption: The first.
      - image: /og-default.png
        alt: The brand image, second in a row of two
        caption: The second.
  - type: heading
    text: What it *does*
    level: 2
  - type: text
    text: A paragraph under a heading in the write-up.
timeline:
  - date: 2026-10-04
    text: The fixture was written.
---
