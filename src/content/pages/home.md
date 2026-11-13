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
waitlist: false
background: galaxy
description: "{site.description}"
sections:
  - type: building
    eyebrow: Now
    heading: What I'm building
    items:
      - title: R7 Orbit
        status: building
        text: A desktop app for running several AI coding agents on one project at
          once.
        url: /blog/why-r7-orbit-exists/
      - title: R7 Home
        status: building
        text: One touchscreen and one voice for a household's lights, music and
          reminders.
        url: /blog/what-is-r7-home/
      - title: R7 Orbit Studio
        status: shipped
        text: The tool the agents use to make the picture for every article here.
        url: /blog/how-an-ai-agent-makes-on-brand-imagery-with-r7-orbit-studio/
      - title: Browser games
        status: shipped
        text: Games you can play right here, built by AI agents in R7 Orbit.
        url: /apps/
  - type: news-desk
    eyebrow: News
    heading: The *news* desk
    wireHeading: The wire
    count: 5
    moreLabel: All news
    moreUrl: /news/
  - type: spotlight
    eyebrow: Coming soon
    heading: R7 Orbit, mission control for AI agents
    text: R7 Orbit is the Windows desktop app I use to run several AI coding agents
      on one project at the same time. This site and its games were built in it.
      It isn't public yet.
    points:
      - text: Every task gets its own copy of the project, so agents don't overwrite
          each other
      - text: Agents ask before the steps that need my OK
      - text: Give Orbit one goal and it plans which agents to send
      - text: Push to talk, or say "Hey Orbit"
    image: /media/home/r7-orbit-canvas.png
    alt: "The R7 Orbit canvas: a section of four finished task cards above the
      project hub, with five more agents' cards around it, each showing the
      agent's name, its model, its branch and a short report of what it did"
    decorative: false
    buttonLabel: Read how it was built
    buttonUrl: /blog/why-r7-orbit-exists/
    waitlist: true
    source: other
  - type: apps
    eyebrow: Play in the browser
    heading: Apps
    count: 3
    moreLabel: All apps
    moreUrl: /apps/
  - type: series
    eyebrow: Read in order
    heading: The series
    series:
      - name: R7 Orbit
        url: /tags/r7-orbit/
      - name: R7 Home
        url: /tags/r7-home/
    count: 5
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
  - type: team
    section: true
    eyebrow: How this site works
    heading: Who makes it
    steps:
      - label: Brief
        people:
          - author: hunter-newton
          - author: r7
        note: I write the brief, and Orbit hands it to the right agent.
      - label: Write
        people:
          - author: pulsar
          - author: orion
          - author: kepler
          - author: hubble
        note: One writer drafts it from the sources and my notes.
      - label: Picture
        people:
          - author: pictor
        note: Pictor builds the image in R7 Orbit Studio.
      - label: Check
        people:
          - author: parallax
        note: Parallax checks every claim, quote, number and link.
      - label: Approve
        people:
          - author: hunter-newton
        note: I read it and decide if it goes up.
      - label: Send
        people:
          - author: mercury
        note: Once a week, Mercury gathers it into the newsletter.
    members: []
    moreLabel: Meet the agents
    moreUrl: /about/
  - type: counts
    items:
      - count: apps
        label: games and apps to play
      - count: logs
        label: build logs
      - count: news
        label: news stories
      - count: agents
        label: AI agents on the team
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
  - type: newsletter-signup
    eyebrow: Newsletter
    moreLabel: What you get
    moreUrl: /newsletter/
---
