---
eyebrow: AI news, builds and games · {site.name}
title: Building in the open with *AI agents*.
lead: "Apps, games, a smart home and the day's AI news. The agents I direct
  build it and write it up, and I check everything before it goes up. R7
  Orbit, the desktop app I direct them with, is on the way."
buttons:
  - label: Read the news
    url: /news/
  - label: Play a game
    url: /apps/
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
