---
title: "Meta's Muse Ember is a small model *for subagent work*"
seoTitle: "Meta's Muse Ember, a small model for subagents"
date: 2026-11-10
summary: "Meta released Muse Ember, its smallest Muse model, for tool calls, coding subtasks and document work that a bigger model hands out. It costs $0.10 per million input tokens."
sourceUrl: https://dev.meta.ai/resources/blog/build-with-muse-ember
sourceName: Meta
topic: models
tags: [ai-agents]
cover: /media/news/muse-ember.webp
coverAlt: "The words Muse Ember is here. in white on a dark background with a grid of small blue dots"
coverCredit: Meta
author: pulsar
draft: false
---

Meta introduced Muse Ember on Nov 9, 2026, the smallest and cheapest model in its Muse family ([Meta](https://dev.meta.ai/resources/blog/build-with-muse-ember), [The Next Web](https://thenextweb.com/news/meta-muse-ember-small-ai-model-haiku-luna)). Meta pitches it for repeated, bounded work such as tool calls, coding subtasks, routing and document extraction, with a larger model (Muse Wonder or Muse Spark) doing the planning ([Meta](https://dev.meta.ai/resources/blog/build-with-muse-ember)).

> [!NUMBERS]
> - **$0.10** per million input tokens
> - **$0.50** per million output tokens
> - **36** on the Artificial Analysis Intelligence Index
>
> Source: [Meta](https://dev.meta.ai/resources/blog/build-with-muse-ember)

## What happened

Muse Ember is available in Muse Code, Meta's coding agent, on all its subscription plans, and on the Meta Model API as `muse-ember-1.0` ([Meta](https://dev.meta.ai/resources/blog/build-with-muse-ember)). The prices above cover prompts up to 200k input tokens; longer prompts cost $0.30 and $1.50. It reads text, images, audio and video. Meta says an app built on the OpenAI SDK only needs its base URL changed to call it ([Meta](https://dev.meta.ai/resources/blog/build-with-muse-ember)).

> [!CHART] Terminal-Bench 4.0, agentic terminal coding
> - **Muse Ember: 40.9**
> - Claude Haiku 5.5: 39.2
> - GPT-6 Luna: 16.4
>
> Source: [Meta](https://dev.meta.ai/resources/blog/build-with-muse-ember), each model at max effort.

Meta's own table does not put Ember first everywhere. On FrontierCode 2.0, which judges whether code changes would be merged, Claude Haiku 5.5 scores 34.9 to Ember's 27.2 ([Meta](https://dev.meta.ai/resources/blog/build-with-muse-ember)).

## The planner and the workers

Meta's example splits one job between models. Muse Wonder planned a port of 16 language lexers in Pygments, a Python syntax highlighter, to Rust, and 16 Muse Ember agents each ported one lexer in its own copy of the repo. Meta says all 16 matched the Python output on 383 test inputs and on 62 real files held back until the code was frozen, and the run cost about $3.96, of which $1.84 was Ember ([Meta](https://dev.meta.ai/resources/blog/build-with-muse-ember)). Meta adds that results vary from run to run.

Every benchmark and cost figure here comes from Meta's post, including the Artificial Analysis score it quotes.

## Sources

- [Start building with Muse Ember, our smallest, most efficient model (Meta)](https://dev.meta.ai/resources/blog/build-with-muse-ember)
- [Meta's Muse Ember matches Claude Haiku at a third of the cost per task (The Next Web)](https://thenextweb.com/news/meta-muse-ember-small-ai-model-haiku-luna)
