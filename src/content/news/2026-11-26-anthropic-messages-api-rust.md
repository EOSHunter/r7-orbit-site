---
title: "Anthropic moves its Messages API to Rust, *checked on live traffic*"
seoTitle: "Anthropic moves its Messages API to Rust"
date: 2026-11-26
summary: "Anthropic moved its Messages API from Python to Rust, with Claude agents writing and fixing the code, and reports about 70% less CPU per request."
sourceUrl: https://www.anthropic.com/research/migrating-api-to-rust
sourceName: Anthropic
topic: tools
tags: [anthropic, claude, ai-agents]
cover: /media/news/anthropic-messages-api-rust.webp
coverAlt: "Anthropic's lead illustration for the post: fourteen flat circles, each crossed by a hand-drawn black grid, scattered on a sage-green textured background in two matching groups of seven, left and right. The circles are green, blue, orange, red, purple, gray and pink, and each color appears once in each group in the same arrangement"
coverCredit: Anthropic
author: pulsar
draft: false
---

Anthropic has moved its Messages API from Python to Rust, with Claude agents writing and fixing the code, and on Nov 25, 2026 it published how it checked the new version against the live service ([Anthropic](https://www.anthropic.com/research/migrating-api-to-rust)). The Messages API is the main way customers, and Anthropic's own apps such as Claude Code and Cowork, reach Claude.

> [!NUMBERS]
> - **About 70%** less CPU per request
> - **About 20%** lower median time to first token
> - **About 1,800x** growth in API traffic from early 2024 to fall 2026
>
> Source: [Anthropic](https://www.anthropic.com/research/migrating-api-to-rust)

## What happened

Anthropic built the API in Python in 2023. An earlier partial rewrite, with only output parsing in Rust, cut CPU use by about 8% to 10%, but each token then crossed between Python and Rust three times. Claude wrote a first version of the core request path in about a week, and by May 2026 Claude was writing more than 80% of the code Anthropic merged ([Anthropic](https://www.anthropic.com/research/migrating-api-to-rust)).

> [!TIMELINE]
> - **Apr 2026** Rust passes about 98% of tests, yet only about a quarter of inputs match on production traffic
> - **Mid-May** An engineer turns down an agent's web search shortcut as throwaway code
> - **Jun 2026** An agent turns about 60 review comments into proposed rules for CLAUDE.md
> - **Sep 2026** Public traffic moves to Rust
>
> Source: [Anthropic](https://www.anthropic.com/research/migrating-api-to-rust)

## How they checked it

The team had about 700 integration tests, and an audit of the ported tests found more than 100 weakened assertions. So Anthropic used shadowing, running live requests through both versions and comparing the results. Because Claude can answer the same request differently, the model ran once and its output was replayed to Rust. To protect privacy, the team did not read customer text and recorded a "fingerprint" of each difference instead, such as where in the prompt it began and the length gap ([Anthropic](https://www.anthropic.com/research/migrating-api-to-rust)).

A script grouped those records every 10 to 30 minutes and alerted a coordinating agent, which assigned a worker agent to each new kind. Workers tested fixes in a sandbox with checks under a second, engineers reviewed the pull requests, and shadowed traffic showed whether a fix held. Engineers' corrections became rules in CLAUDE.md, lints and tests ([Anthropic](https://www.anthropic.com/research/migrating-api-to-rust)).

## Why it matters

Anthropic writes that writing code is no longer the bottleneck, and verification has taken its place. All the performance figures are Anthropic's own measurements. The post gives no cost savings in dollars ([Anthropic](https://www.anthropic.com/research/migrating-api-to-rust)).

## Sources

- [Migrating our Messages API to Rust (Anthropic)](https://www.anthropic.com/research/migrating-api-to-rust)
