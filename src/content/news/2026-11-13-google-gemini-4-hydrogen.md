---
title: "Google releases Gemini 4 Hydrogen, *a faster model* for everyday coding"
seoTitle: "Google releases Gemini 4 Hydrogen"
date: 2026-11-13
summary: "Gemini 4 Hydrogen is Google's fast model for coding and agents, at $1.50 / $7.50 per million tokens. Orchestrator pairs it with Carbon in Antigravity."
sourceUrl: https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-hydrogen/
sourceName: Google
topic: models
tags: [ai-agents]
cover: /media/news/google-gemini-4-hydrogen.webp
coverAlt: "Google's Gemini 4 Hydrogen key art: the multicolored Gemini sparkle mark and the words Gemini 4 Hydrogen in white on a blue background that runs from deep blue at the lower left to pale blue at the upper right, beside a large translucent, bubble-like blob with wavy light inside, with small white 4 digits scattered around"
coverCredit: Google
author: pulsar
draft: false
---

Google released Gemini 4 Hydrogen on Nov 12, 2026, a fast, efficient model for everyday coding and agentic work, and brought it to "all tiers of Google AI Studio, the Gemini API" ([Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-hydrogen/)). It arrives two days after [Gemini 4 Carbon](/news/2026-11-12-google-gemini-4-carbon-available/), and Google Antigravity gets a new Orchestrator option that switches between the two in one session.

> [!NUMBERS]
> - **$1.50 / $7.50** per million input / output tokens, flat across the context window
> - **1M** tokens of context
> - **4** thinking levels: low, medium, high (default) and xhigh
>
> Source: [Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-hydrogen/)

## What happened

Google says Hydrogen scores 51 on the Artificial Analysis Intelligence Index at its default high thinking level, against 50 for Gemini 4 Argon, and 54 at xhigh ([Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-hydrogen/)). Google keeps Carbon and Argon for deeper, long-horizon reasoning.

In Google's testing against Gemini 3.8 Flash, Hydrogen at its default setting finishes tasks about 2.5 times faster and makes more than 5 times fewer fabricated claims ([Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-hydrogen/)).

> [!CHART] Terminal-Bench 4.1, Google's figures
> - **Gemini 4 Hydrogen: 57%**
> - Gemini 3.8 Flash: 18.2%
>
> Source: [Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-hydrogen/)

On safety, Google says Hydrogen is more than 2.3 times more resilient on the Gray Swan indirect prompt injection benchmark and scored a 96.7% honesty rate on an internal agent honesty test ([Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-hydrogen/)).

## Orchestrator in Antigravity

Orchestrator is a choice in Google Antigravity's model dropdown. Instead of one model for the whole task, it moves between Carbon and Hydrogen as it works: Carbon can explore and plan, Hydrogen can make edits and run tests, and Hydrogen can hand work back to Carbon when it gets stuck ([Google Antigravity](https://antigravity.google/blog/gemini-4-hydrogen-in-google-antigravity)). Google says Orchestrator came close to Carbon's task success while using about 24% less quota and finishing about 19% faster on average. Google's announcement gives these figures for Terminal-Bench 4.0 ([Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-hydrogen/)), and the Antigravity blog lists the same figures under Terminal-Bench 4.1 ([Google Antigravity](https://antigravity.google/blog/gemini-4-hydrogen-in-google-antigravity)).

Orchestrator (Carbon) is rolling out to Google AI Ultra subscribers, and Orchestrator (Argon) to AI Pro and Ultra subscribers ([Google Antigravity](https://antigravity.google/blog/gemini-4-hydrogen-in-google-antigravity)).

## Why it matters

Hydrogen's API price is below Carbon's introductory $2 / $10 per million tokens, which rises to $4 / $20 after Nov 30 ([Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-carbon-now-available/)). The AI Studio guide lists Hydrogen on the free tier, with rate limits, under the model ID `gemini-4-hydrogen`. Developers moving from `gemini-3.8-flash` should note that the default thinking level is now high, and that `temperature`, `top_p` and `top_k` are ignored ([Google AI Studio](https://aistudio.google.com/docs/whats-new-gemini-4-hydrogen)).

Hydrogen is also in Android Studio and Gemini for business ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/build-with-gemini-4-hydrogen/)), and in the Gemini app and Google Search ([Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-hydrogen/)).

## Sources

- [Introducing Gemini 4 Hydrogen (Google)](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-hydrogen/)
- [Build with Gemini 4 Hydrogen (Google)](https://blog.google/innovation-and-ai/technology/developers-tools/build-with-gemini-4-hydrogen/)
- [Gemini 4 Hydrogen and Orchestrator (Google Antigravity)](https://antigravity.google/blog/gemini-4-hydrogen-in-google-antigravity)
- [What's new in Gemini 4 Hydrogen (Google AI Studio)](https://aistudio.google.com/docs/whats-new-gemini-4-hydrogen)
- [Gemini 4 Carbon is now available (Google)](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-carbon-now-available/)
