---
title: "Anthropic's Claude Ship takes a pull request *from review to approval*"
seoTitle: "Anthropic launches Claude Ship in beta"
date: 2026-11-24
summary: "A new beta pairs Code Review with agents that fix pull requests and approve them under a team's own policy, for GitHub repos on Team and Enterprise plans."
sourceUrl: https://claude.com/resources/articles/introducing-claude-ship
sourceName: Anthropic
topic: tools
tags: [anthropic, claude, ai-agents]
cover: /media/news/claude-ship.webp
coverAlt: "Anthropic's share image for Claude Ship: on a flat peach background, four cut-paper white shapes (an octagon, an hourglass-like shape, and a square stacked above a round-topped block) joined by a thick hand-drawn black line through black dots, ending at a white octagon at the top right that holds a black check mark"
coverCredit: Anthropic
author: pulsar
draft: false
---

Anthropic launched Claude Ship in beta on Nov 23, 2026. It is a set of agents that take a GitHub pull request through review, fixes and an approval decision ([Anthropic](https://claude.com/resources/articles/introducing-claude-ship)).

![Anthropic's diagram of Claude Ship: three rows labelled Review (Code Review), Fix (PR Steward, beta) and Approve (Claude Approvals, beta), with a dotted path from a pull request through findings and pushed fixes to "approved under team policy" and a box reading Ready to merge](/media/news/claude-ship-pipeline.webp)
*The three agents in order, from Anthropic's announcement.*
Image: [Anthropic](https://claude.com/resources/articles/introducing-claude-ship)

## What happened

Claude Ship bundles three agents ([Anthropic](https://claude.com/resources/articles/introducing-claude-ship)):

- **Code Review**, already generally available, posts findings on a pull request at a Quick, Standard or Deep level, chosen per repository.
- **PR Steward** (beta) works on failing CI checks, merge conflicts and review feedback, and is designed not to approve or merge. After each push it comments with what it changed and how to undo it. Developers steer it with `@claude` and send it away with `@claude stop`.
- **Claude Approvals** (beta) applies an approval policy the team writes as a file in the repository. Anthropic says it "works like a smarter CODEOWNERS file". It can approve routine changes or require a person's sign-off, and Anthropic recommends starting it in observe-only mode.

Developers can run it on their own pull requests with a new `/ship` command, rolling out in Claude Code and the desktop app. Admins can turn it on per repository ([Anthropic](https://claude.com/resources/articles/introducing-claude-ship)).

## Cost and limits

Claude Ship is for Team and Enterprise plans, and only for repositories on GitHub. It isn't available to organizations with Zero Data Retention, the HIPAA configuration or customer-managed encryption keys. Usage is billed on tokens, and admins can set spend limits for Code Review and PR Steward ([Anthropic](https://claude.com/resources/articles/introducing-claude-ship)). Observe mode is billed too ([Claude Code Docs](https://code.claude.com/docs/en/claude-ship)). Anthropic gives no per-review price and no end date for the beta.

> [!TIMELINE]
> - **Nov 23, 2026** Claude Ship launches in beta
> - **Jan 15, 2027** Deadline for eligible Enterprise organizations to claim at least $10,000 in credits
>
> Source: [Anthropic](https://claude.com/resources/articles/introducing-claude-ship)

## Why it matters

Anthropic says Claude writes most of the code on its Claude Code team. On that team, where Claude's review is one layer of a broader process, merged pull requests more than doubled from June to September while the share reverted fell by more than 40%. These are Anthropic's own figures, and the announcement gives none from outside the company ([Anthropic](https://claude.com/resources/articles/introducing-claude-ship)).

The announcement also warns that "Claude Ship uses AI and may miss bugs, security vulnerabilities, or other issues." The docs add that with GitHub auto-merge or a merge queue, and a policy that doesn't require a person's approval, a change can merge without anyone acting ([Claude Code Docs](https://code.claude.com/docs/en/claude-ship)).

## Sources

- [Introducing Claude Ship (Anthropic)](https://claude.com/resources/articles/introducing-claude-ship)
- [Claude Ship (Claude Code Docs)](https://code.claude.com/docs/en/claude-ship)
