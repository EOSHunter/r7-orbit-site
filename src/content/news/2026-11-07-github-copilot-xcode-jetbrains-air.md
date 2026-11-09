---
title: "GitHub Copilot arrives in *Xcode and JetBrains Air*"
date: 2026-11-07
summary: "In one week, GitHub put Copilot into Xcode's built-in coding assistant as a public preview and into JetBrains Air as an agent that takes on coding tasks."
sourceUrl: https://github.blog/changelog/2026-11-04-github-copilot-is-now-available-in-xcodes-coding-assistant/
sourceName: GitHub
topic: tools
symbol: editor-pair
tags: [ai-agents, github-copilot]
cover: /media/news/github-copilot-xcode.webp
coverAlt: "GitHub's release graphic: an Xcode window whose New Conversation menu lists the agents Antigravity, Claude Agent, Codex and GitHub Copilot"
coverCredit: GitHub
author: pulsar
draft: false
---

GitHub added Copilot to two more coding tools this week: JetBrains Air on Nov 3, 2026 ([GitHub Changelog](https://github.blog/changelog/2026-11-03-github-copilot-is-now-available-in-jetbrains-air/)) and Xcode's built-in coding assistant on Nov 4 ([GitHub Changelog](https://github.blog/changelog/2026-11-04-github-copilot-is-now-available-in-xcodes-coding-assistant/)).

> [!NOTE]
> In Xcode, Copilot is a public preview that needs Xcode 27.3 beta on a Mac running macOS Tahoe 26.6 or later. GitHub says all Copilot plans are supported ([GitHub Changelog](https://github.blog/changelog/2026-11-04-github-copilot-is-now-available-in-xcodes-coding-assistant/)).

## What happened

**Xcode.** Copilot now works directly inside Xcode's own coding assistant, set up under Xcode > Settings > Intelligence. The existing GitHub Copilot for Xcode extension stays available as a separate option ([GitHub Changelog](https://github.blog/changelog/2026-11-04-github-copilot-is-now-available-in-xcodes-coding-assistant/)).

![GitHub's release graphic: an Xcode window whose New Conversation menu lists the agents Antigravity, Claude Agent, Codex and GitHub Copilot, under the words "GitHub Copilot is now available in Xcode's native agents"](/media/news/github-copilot-xcode.webp)
*Copilot in the agent list of Xcode's coding assistant, from GitHub's announcement.*
Image: [GitHub](https://github.blog/changelog/2026-11-04-github-copilot-is-now-available-in-xcodes-coding-assistant/)

**JetBrains Air.** Copilot appears in Air's agent picker, where it can be handed coding tasks that run in a JetBrains IDE or in the cloud. The changelog lists ([GitHub Changelog](https://github.blog/changelog/2026-11-03-github-copilot-is-now-available-in-jetbrains-air/)):

- tracking several agent sessions at once and reviewing changes next to the code;
- cloud tasks in isolated environments through Air Teams, from the IDE or a browser;
- tasks billed to the Copilot plan rather than to JetBrains AI credits.

The integration uses the Agent Client Protocol (ACP). Cloud tasks need a JetBrains account in a business organization with Air Teams, a Copilot subscription, and Copilot switched on by the Air administrator.

## Why it matters

People who already have Copilot can use it in both tools: Xcode supports every Copilot plan, and in Air tasks run on the Copilot plan instead of JetBrains AI credits ([Xcode entry](https://github.blog/changelog/2026-11-04-github-copilot-is-now-available-in-xcodes-coding-assistant/), [Air entry](https://github.blog/changelog/2026-11-03-github-copilot-is-now-available-in-jetbrains-air/)).

There are limits in Air: administrators can turn Copilot off but cannot set Copilot spending limits there, and Air's analytics do not include Copilot usage. The Air entry does not say whether the integration is a preview or generally available ([GitHub Changelog](https://github.blog/changelog/2026-11-03-github-copilot-is-now-available-in-jetbrains-air/)).

## Sources

- [GitHub Copilot is now available in Xcode's coding assistant (GitHub Changelog)](https://github.blog/changelog/2026-11-04-github-copilot-is-now-available-in-xcodes-coding-assistant/)
- [GitHub Copilot is now available in JetBrains Air (GitHub Changelog)](https://github.blog/changelog/2026-11-03-github-copilot-is-now-available-in-jetbrains-air/)
