---
title: "Jakub Pachocki proposes *perplexity* as a shared safety metric"
seoTitle: "OpenAI's Pachocki proposes perplexity limits"
date: 2026-11-23
summary: "OpenAI's chief scientist published internal perplexity figures since GPT-3.5 and proposed shared limits that AI labs would commit not to cross."
sourceUrl: https://openai.com/index/perplexity-and-intelligence/
sourceName: OpenAI
topic: trends
tags: [ai-policy]
cover: /media/news/openai-perplexity-and-intelligence.webp
coverAlt: "OpenAI's share image for the post: a grainy orange gradient that fades to pale pink at the top-left and bottom-right corners, with the words Perplexity and Intelligence in white type across the middle"
coverCredit: OpenAI
author: pulsar
draft: false
---

On Nov 22, 2026, OpenAI chief scientist Jakub Pachocki published OpenAI's internal perplexity measurements for its models since GPT-3.5 and argued that AI labs should use perplexity to compare their models and set shared safety limits ([OpenAI](https://openai.com/index/perplexity-and-intelligence/)). Perplexity measures how well a model predicts the next token of text, and a lower number means better predictions.

> [!CHART] OpenAI log-perplexity on its code dataset, approximate (lower is better)
> - GPT-3.5: 0.99
> - GPT-4: 0.91
> - **Model with open math results: 0.76**
>
> Source: [OpenAI](https://openai.com/index/perplexity-and-intelligence/)

## What happened

OpenAI tracks the log of perplexity, also called cross-entropy loss, on held-out data from its own internal codebase ([OpenAI](https://openai.com/index/perplexity-and-intelligence/)). Pachocki ties each step to new abilities. GPT-3.5, at about 0.99, could hold a fluent conversation and became the basis for the original ChatGPT. GPT-4, at about 0.91, could use chain-of-thought reasoning. He writes that OpenAI's losses are now below 0.8, and that once OpenAI upgraded to a model at about 0.76, it started producing results on open math problems. The text does not name the model at 0.76 or say which current model has which loss.

He expects further capabilities as models enter a window of about 0.68 to 0.7, and adds, "I don't know what those capabilities will be, and we may not be testing for them today" ([OpenAI](https://openai.com/index/perplexity-and-intelligence/)).

## Why it matters

Pachocki proposes common limits, based on perplexity and other measurements, that developers would commit not to cross until their ability to understand and monitor AI behavior reaches a concrete milestone, such as a successor to chain-of-thought monitors. He writes that publishing the numbers gives competitors a clearer picture of where OpenAI stands, and that the urgency of shared safety measures outweighs that concern ([OpenAI](https://openai.com/index/perplexity-and-intelligence/)).

The post lists four challenges for perplexity as a shared metric ([OpenAI](https://openai.com/index/perplexity-and-intelligence/)):

- Labs use different evaluation datasets and training data, so their numbers are hard to compare.
- Perplexity does not correspond directly to a task people care about.
- It misses advances outside pretraining. Chain-of-thought reasoning raises capabilities without lowering perplexity.
- The floor is unknown, because OpenAI does not know the inherent entropy of the data, and progress will look slower as models approach it.

The post gives no values for the proposed limits and does not say whether any other lab has agreed to the proposal.

## Sources

- [Perplexity and Intelligence (OpenAI)](https://openai.com/index/perplexity-and-intelligence/)
