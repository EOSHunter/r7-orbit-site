---
title: "Home Assistant 2026.11 builds HACS in as the *Marketplace*"
seoTitle: "Home Assistant 2026.11 makes HACS built in"
date: 2026-11-07
summary: "Home Assistant 2026.11 turns HACS into a built-in Marketplace, and adds Matter cameras, LoRaWAN and 38 new integrations."
sourceUrl: https://www.home-assistant.io/blog/2026/11/04/release-202611/
sourceName: Home Assistant
topic: home
tags: [smart-home, home-assistant]
cover: /media/news/home-assistant-marketplace.webp
coverAlt: "The Marketplace's Browse tab in Home Assistant, its projects grouped into Installed and New"
coverCredit: Home Assistant
author: pulsar
draft: false
---

Home Assistant 2026.11, out on Nov 4, 2026, makes HACS (the Home Assistant Community Store, where people install add-ons made by the community) part of Home Assistant itself, as the new Marketplace ([Home Assistant](https://www.home-assistant.io/blog/2026/11/04/release-202611/)).

> [!NOTE]
> The separate HACS installer stops at 2026.11. A home that already runs HACS is moved over to the Marketplace when Home Assistant first starts after the update, and everything installed stays installed ([release notes](https://www.home-assistant.io/blog/2026/11/04/release-202611/)).

## What happened

The Marketplace sits under Settings > Marketplace and comes with Home Assistant, so there is nothing to set up. Installing a new integration from it no longer needs a restart, and the release notes say everything in it is free ([Home Assistant](https://www.home-assistant.io/blog/2026/11/04/release-202611/)).


The same release adds ([Home Assistant](https://www.home-assistant.io/blog/2026/11/04/release-202611/)):

- **Matter cameras.** Matter 1.5 makes cameras part of the standard, and Home Assistant now supports them, with live video streamed over WebRTC between the browser and the camera.
- **Talking back through cameras.** A preview feature in Labs adds two-way audio, for Matter cameras and Reolink in this release.
- **LoRaWAN**, a long-range wireless network for sensors, through ChirpStack or The Things Network.
- **Backups on local drives**: an internal drive or a USB drive can now hold backups and media.
- **Dashboard sections that fill themselves** and stay up to date as devices are added or removed.
- **38 new integrations.**

## Why it matters

Until this release HACS was a separate install. The Marketplace now ships with every Home Assistant update and, per the release notes, works with every installation type, including Home Assistant Container ([Home Assistant](https://www.home-assistant.io/blog/2026/11/04/release-202611/)).

The update also changes how entities are named: Home Assistant builds the name from the entity's own name plus its device, and entity IDs do not change. The release notes list this and other breaking changes, such as Z-Wave needing zwave-js-server 3.11.0 or later, to check before updating ([Home Assistant](https://www.home-assistant.io/blog/2026/11/04/release-202611/)).

## Sources

- [Home Assistant 2026.11 release notes (Home Assistant blog)](https://www.home-assistant.io/blog/2026/11/04/release-202611/)
