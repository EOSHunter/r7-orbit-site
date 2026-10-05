---
eyebrow: "{site.tagline}"
title: Plain notes on building with *AI agents*.
lead: "{site.description}"
buttons:
  - label: Start with the latest
    url: "#latest"
  - label: Subscribe
    url: "#subscribe"
description: "{site.description}"
sections:
  - type: pinned
    eyebrow: Pinned
    heading: The first *vlog*
  - type: feed
    heading: Latest
    count: 8
    emptyHeading: Nothing is posted yet.
    emptyText: Subscribe below and I will send an email when the first post is up.
    browseLabel: Browse by kind
    moreLabel: Browse everything
    moreUrl: /latest/
  - heading: Projects
    eyebrow: Things I am making
    order: newest
    count: 3
    ifEmpty: hide
    moreUrl: /projects/
    type: latest
    moreLabel: All projects
    look: section
    kinds:
      - project
  - type: games
    eyebrow: Play in the browser
    heading: Games
    count: 3
    moreLabel: All games
    moreUrl: /games/
  - heading: Repos
    eyebrow: Open source
    order: updated
    count: 3
    ifEmpty: hide
    moreUrl: /repos/
    type: latest
    moreLabel: All repos
    look: section
    kinds:
      - repo
---
