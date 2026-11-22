---
title: "Claude computer use reaches *Team and Enterprise* plans in beta"
seoTitle: "Claude computer use beta for Team and Enterprise"
date: 2026-11-22
summary: "Computer use is in beta on Claude Team and Enterprise plans, off by default. Admins can limit it by role, block or allow apps, or turn it off with MDM."
sourceUrl: https://support.claude.com/en/articles/12138966-release-notes
sourceName: Anthropic
topic: tools
tags: [ai-agents, anthropic, claude, security]
cover: /media/news/claude-computer-use-team-enterprise.webp
coverAlt: "A screenshot of Anthropic's Claude release notes on an off-white background: the heading \"November 20, 2026\", then the bold heading \"A refreshed look for Claude Mobile\" with a paragraph saying the new look is rolling out gradually, starting with Claude for iOS, and needs iOS 26 or later. Below it, the bold heading \"Computer use (beta) for Team and Enterprise plans\" with its paragraph, ending in the underlined link \"Set up computer use for Team and Enterprise plans\""
coverCredit: Anthropic
author: pulsar
draft: false
---

Anthropic made computer use available in beta on Claude Team and Enterprise plans, in its release notes for Nov 20, 2026 ([Anthropic](https://support.claude.com/en/articles/12138966-release-notes)). Computer use lets Claude see a user's screen and click and type in the desktop apps they allow ([Claude Help Center](https://support.claude.com/en/articles/18483812-set-up-computer-use-for-team-and-enterprise-plans)).

> [!NOTE]
> Computer use is off by default and is rolling out to organizations gradually. Only an Owner or Primary Owner can turn it on ([Claude Help Center](https://support.claude.com/en/articles/18483812-set-up-computer-use-for-team-and-enterprise-plans)).

## What happened

It works in the new Claude experience in Claude Desktop (macOS 14 or later, and Windows), and from Claude on the web and Claude Mobile when the organization's Computer access setting is on. It does not work in Claude Code or in tasks started with the separate "Cowork" option. Organizations with the HIPAA-ready configuration, Zero Data Retention for Claude Code, customer-managed encryption keys, or FERPA or K-12 settings can't turn it on ([Claude Help Center](https://support.claude.com/en/articles/18483812-set-up-computer-use-for-team-and-enterprise-plans)).

Admins get three controls ([Claude Help Center](https://support.claude.com/en/articles/18483812-set-up-computer-use-for-team-and-enterprise-plans)):

- **Roles** (Enterprise only): computer use is a capability in custom roles. Team plans have no custom roles, so the setting covers every user.
- **App access**: a block list, or an allow list where every other app is denied. Users still approve each app.
- **MDM**: the Claude Desktop policy key `computerUseEnabled`, set to false, keeps it off on a computer (Claude Desktop 5.1231.0 or later).

## Why it matters

The setup page lists the risks for anyone running agents at work. There is no sandbox between Claude and a user's apps, and content on the screen, such as web pages or emails, could cause Claude to take unintended actions. Claude can open, change or delete files outside the folders a user has connected. Screenshots are saved with the chat and can include confidential information ([Claude Help Center](https://support.claude.com/en/articles/18483812-set-up-computer-use-for-team-and-enterprise-plans)).

The block and allow lists don't cover Claude in Chrome, the built-in browser, Claude Code, desktop extensions, websites in an approved browser, or remote desktops. Turning computer use off, or changing the app lists, can take about an hour, sometimes longer, to reach each user ([Claude Help Center](https://support.claude.com/en/articles/18483812-set-up-computer-use-for-team-and-enterprise-plans)).

Neither page gives a price, a date for the beta to end, or says whether Pro and Max plans have it.

## Sources

- [Release notes (Claude Help Center)](https://support.claude.com/en/articles/12138966-release-notes)
- [Set up computer use for Team and Enterprise plans (Claude Help Center)](https://support.claude.com/en/articles/18483812-set-up-computer-use-for-team-and-enterprise-plans)
