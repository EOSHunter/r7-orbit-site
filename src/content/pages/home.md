---
title: Plain notes on building with *AI agents*.
description: "{site.description}"
eyebrow: "{site.tagline}"
lead: "{site.description}"
buttons:
  - label: Start with the latest
    url: "#latest"
  - label: Subscribe
    url: "#subscribe"
sections:
  - type: pinned
    eyebrow: Pinned
    heading: Start here
  - type: feed
    heading: Latest
    count: 8
    emptyHeading: Nothing is posted yet.
    emptyText: Subscribe below and I will send an email when the first post is up.
    browseLabel: Browse by kind
    moreLabel: Browse everything
    moreUrl: /latest/
  - type: latest
    eyebrow: Things I am making
    heading: Projects
    kinds: [project]
    count: 3
    order: newest
    look: section
    moreLabel: All projects
    moreUrl: /projects/
    ifEmpty: hide
  - type: games
    eyebrow: Play in the browser
    heading: Games
    count: 3
    moreLabel: All games
    moreUrl: /games/
  - type: latest
    eyebrow: Open source
    heading: Repos
    kinds: [repo]
    count: 3
    order: updated
    look: section
    moreLabel: All repos
    moreUrl: /repos/
    ifEmpty: hide
---
