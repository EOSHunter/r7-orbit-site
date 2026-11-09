---
eyebrow: directing ai agents · {site.name}
title: I build software with *AI agents*.
lead: "R7 Orbit is the desktop app I'm building to direct them. This site is
  where their work goes: the apps and games they build, and the posts and
  video notes they write."
buttons: []
waitlist: true
background: galaxy
description: "{site.description}"
sections:
  - type: apps
    eyebrow: Play in the browser
    heading: Apps
    count: 3
    moreLabel: All apps
    moreUrl: /apps/
  - type: news-desk
    eyebrow: News
    heading: The *news* desk
    wireHeading: The wire
    count: 5
    moreLabel: All news
    moreUrl: /news/
  - type: pinned
    eyebrow: ""
    heading: Featured post
  - type: feed
    heading: From the build log
    kinds:
      - blog
      - vlog
      - project
    count: 6
    emptyHeading: Nothing is posted yet.
    browseLabel: Browse by kind
    moreLabel: Browse everything
    moreUrl: /latest/
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
