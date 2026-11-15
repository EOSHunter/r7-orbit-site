---
title: "Google's Gemini Decisions API *scores fixed options* in one pass"
seoTitle: "Gemini Decisions API scores fixed options"
date: 2026-11-15
summary: "Google's Gemini Decisions API answers up to 1,000 yes/no, multiple-choice or rubric questions about one input, with a confidence score for each answer."
sourceUrl: https://blog.google/innovation-and-ai/technology/developers-tools/gemini-decisions-api/
sourceName: Google
topic: tools
tags: [ai-agents]
cover: /media/news/google-gemini-decisions-api.webp
coverAlt: "The words Gemini Decisions API in white sans-serif type, centered on a smooth gradient that runs from near-black at lower left to bright blue at upper right"
coverCredit: Google
author: pulsar
draft: false
---

Google introduced the Gemini Decisions API on Nov 11, 2026, an endpoint available through the Gemini API in Google AI Studio for choices from a fixed set of options, run by a new model, Gemini Decision 1 (`gemini-decision-1`) ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-decisions-api/)). Google gives tool selection, policy checks, model routing and context grading as examples.

> [!NUMBERS]
> - **1,000** questions per request, over one shared input
> - **256K** tokens of input: text, images, audio, video or PDFs
> - **$0.10** per 1M input tokens, with no charge for output
>
> Source: [Google](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-decisions-api/)

## What happened

Gemini Decision 1 scores the candidate options in a single pass and returns probabilities, plus a confidence score from 0 to 1 for every answer, so an app can send unclear cases to a fallback or a human reviewer ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-decisions-api/)). One request can mix three kinds of question:

| Type | What it asks | What comes back |
| --- | --- | --- |
| `noul` | Does a yes/no condition hold? | The probability that it does |
| `choice` | Which of 2 to 255 options? | The winner and a probability for each option |
| `score` | Where does it fall on an ordered rubric? | A weighted score and a probability per level |

Question types as Google describes them ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-decisions-api/)).

Google says median latency is 150-250 ms end to end for inputs up to 16K tokens, and that in its own benchmarks the model leads the suite with the lowest calibration error ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-decisions-api/)). The post's text gives no accuracy figures; its benchmark charts are images.

## Why it matters

Google says the shared input is billed once per request however many questions are asked, and that the API is nearly 5x cheaper across its benchmark suite than Gemini 3.5 Flash-Lite with the Interactions API ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-decisions-api/)). Teams at Google already use it: Gemini Notebook routes queries to a model tier with it, which Google says serves everyday queries with up to 40% lower latency, and Google Search uses it as a safety layer for MCP tools.

It is available now with a no-cost tier in Google AI Studio, and integrations are rolling out in OpenRouter, LangChain, Vercel and others. Support for Gemini in Google Cloud is "coming soon", with no date given ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-decisions-api/)).

## Sources

- [Gemini Decisions API: Fast, calibrated multimodal decisions (Google)](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-decisions-api/)
