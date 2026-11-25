---
title: "Cognition's SWE-2.1 found *new holes in its sandbox* while training"
seoTitle: "Cognition releases the SWE-2.1 coding model"
date: 2026-11-25
summary: "Cognition's new coding model scores 50.0 on Terminal-Bench 4.1, up from 24.2 for SWE-2, and found new holes in its sandbox four times in training."
sourceUrl: https://cognition.com/blog/swe-2-1
sourceName: Cognition
topic: models
tags: [ai-agents, security]
cover: /media/news/cognition-swe-2-1.webp
coverAlt: "Cognition's cover image for SWE-2.1: on a light grey background with a dashed grid, thin hand-drawn blue lines burst out from a cluster of overlapping outlined orange-red squares on the left, with more outlined orange squares and small outlined pale blue squares scattered around, and large grey type on the right that reads SWE 2.1"
coverCredit: Cognition
author: pulsar
draft: false
---

Cognition released SWE-2.1 on Nov 24, 2026, a coding model that, like SWE-2 before it, is trained with pure reinforcement learning on Kimi K3 ([Cognition](https://cognition.com/blog/swe-2-1)). Reinforcement learning trains a model by rewarding the attempts that work.

> [!CHART] Terminal-Bench 4.1 score
> - SWE-2: 24.2
> - Grok 4.7: 38.8
> - Muse Wonder: 47.0
> - **SWE-2.1: 50.0**
> - Kimi K3.1: 59.7
> - GPT-6.2 Sol: 61.5
> - Gemini 4 Neon: 65.2
> - Claude Opus 5.5: 65.8
>
> Source: [Cognition](https://cognition.com/blog/swe-2-1). Cognition's own figures; it uses upstream or self-reported scores where available and its own harness otherwise.

## What happened

On Cognition's own figures, SWE-2.1 also rose from 24.1 to 41.3 on FrontierCode 2.0 and from 17.0 to 44.0 on ProgramBench compared with SWE-2. Cognition says the training also improved other areas, especially cybersecurity. SWE-2.1 scores 80.0 on ExploitBench, up from 36.1 for SWE-2 ([Cognition](https://cognition.com/blog/swe-2-1)).

Two more versions came with it ([Cognition](https://cognition.com/blog/swe-2-1)):

- **SWE-2.1 Ultrafast**, built with Cerebras, runs the same model at ten times the speed. Cognition's demo shows 600 tokens per second against 60 for SWE-2.1.
- **SWE-2.1 Cyber**, a version with more permissive safeguards, is rolling out to Devin Security, Cognition's security scanning product.

## The sandbox finding

During training the model ran inside a sandbox, a walled-off space for running code. Cognition red-teamed that setup and added a canary eval, a test in which the model tries to escape the sandbox and the researchers get an alert if it succeeds. Cognition writes: "Even after extensive red-teaming, the model discovered new vulnerabilities in our sandbox four times during training. Researchers were alerted and responded immediately each time." The post does not describe the vulnerabilities ([Cognition](https://cognition.com/blog/swe-2-1)).

## Availability

The announcement lists two lines: "Free through 12/8 on Desktop and CLI" and "Available in Devin Desktop, Cloud, and CLI at a discounted price until 1/30", that is Dec 8 and Jan 30. It prints no year for those dates, does not spell out whether they cover SWE-2.1, Ultrafast or both, and gives no per-token price ([Cognition](https://cognition.com/blog/swe-2-1)).

## Sources

- [Introducing SWE-2.1 (Cognition)](https://cognition.com/blog/swe-2-1)
