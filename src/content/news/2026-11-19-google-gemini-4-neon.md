---
title: "Google releases Gemini 4 Neon at *$3 / $15* per million tokens"
seoTitle: "Google releases Gemini 4 Neon"
date: 2026-11-19
summary: "Gemini 4 Neon is Google's new model for complex coding and enterprise work, at $3 / $15 per million tokens with a 1M-token context window."
sourceUrl: https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-neon/
sourceName: Google
topic: models
tags: [ai-agents, security]
cover: /media/news/google-gemini-4-neon.webp
coverAlt: "Google's Gemini 4 Neon header image: an orange-glowing neon tube sign on a dark wall reading Gemini 4 Neon, with the outline of Gemini's four-pointed star to its left, and the sign's mounting brackets and wires visible"
coverCredit: Google
author: pulsar
draft: false
---

Google released Gemini 4 Neon on Nov 18, 2026, a model for complex coding, analytical reasoning and enterprise workflows, rolling out the same day in the Gemini API, Gemini for business, Google Antigravity and the Gemini app ([Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-neon/)). Google places it between [Gemini 4 Carbon](/news/2026-11-12-google-gemini-4-carbon-available/), for the hardest long-horizon projects, and [Gemini 4 Hydrogen](/news/2026-11-13-google-gemini-4-hydrogen/), for fast everyday execution.

> [!NUMBERS]
> - **$3** per million input tokens
> - **$0.15** per million cached input tokens, a 95% discount
> - **$15** per million output tokens
> - **1M** tokens of context
>
> Source: [Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-neon/)

## What happened

Developers can use Neon on the Gemini API paid tier in Google AI Studio and Android Studio. Paid Google AI Pro and Ultra subscribers can try it in Google Antigravity, and Pro and Ultra subscribers can pick it from the model drop-down in the Gemini app. Enterprises get it in Gemini for business, through the API or the model drop-down, and in Antigravity ([Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-neon/)). A security version, Gemini 4 Neon for cyber, reaches eligible members of Google's Fairwind Program over the next few days.

The benchmark figures below are as Google reports them. Google says Neon scores 61 on the Artificial Analysis Intelligence Index at its xhigh thinking level, third overall, and ranks first on the Artificial Analysis Coding Agent Index with 58.6. At its default high thinking level, Google says it costs 32% less per task than Carbon ([Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-neon/)).

> [!CHART] SWE-sweep score, by harness
> - mini-SWE harness: 12.8%
> - **Google Antigravity: 39.0%**
>
> Source: [Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-neon/)

## If you build with it

Neon has four thinking levels, which Google says let teams match intelligence and token spend to each workload. In Antigravity it can act as an Orchestrator, a coordinating model that directs parallel Hydrogen subagents. Google says it cuts down on redundant file reads and shares progress as it works ([Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-neon/)).

## Why it matters

Google says Neon keeps Carbon-level protections against severe misuse and prompt injection while refusing 1.98% of tasks on Terminal-Bench 4.0 and 0% on Terminal-Bench-Science. In Google's own coding cheating evaluation, it took shortcuts on 2.45% of tasks, the lowest rate of any Gemini 4 model, and it passed 99.2% of Google's agent honesty evaluation ([Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-neon/)).

The announcement points to a Gemini 4 Neon model card for more detail, which I have not read. It does not say whether the price changes with prompt length, or when Neon for cyber reaches anyone outside the Fairwind Program.

## Sources

- [Introducing Gemini 4 Neon (Google)](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-neon/)
