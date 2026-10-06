---
eyebrow: "{site.tagline}"
title: Building with *AI agents*.
lead: "News, builds and the things in between: videos, projects, code and
  building with AI."
buttons:
  - label: Start with the latest
    url: "#latest"
description: "{site.description}"
sections:
  - type: pinned
    eyebrow: Pinned
    heading: The first *vlog*
  - type: feed
    heading: Latest
    count: 8
    emptyHeading: Nothing is posted yet.
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
  - type: apps
    eyebrow: Play in the browser
    heading: Apps
    count: 3
    moreLabel: All apps
    moreUrl: /apps/
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
