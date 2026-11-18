---
title: "OpenAI's GPT-6.2 Astra cuts token prices *20%* from GPT-6 Astra"
seoTitle: "OpenAI GPT-6.2 Astra and Sol, prices and limits"
date: 2026-11-18
summary: "OpenAI released GPT-6.2 Astra and GPT-6.2 Sol in ChatGPT, Codex and the API. Astra costs $8 / $40 per million tokens; Sol keeps $2 / $10."
sourceUrl: https://openai.com/index/introducing-gpt-6-2-astra-sol/
sourceName: OpenAI
topic: models
tags: [ai-agents, security]
cover: /media/news/openai-gpt-6-2-astra-sol.webp
coverAlt: "The words Astra at the left and Sol at the right in large white bold sans-serif type, with a smaller GPT-6.2 between them, on a deep navy night sky. A glowing warm-white sun with a sparkling gold trail arcs across the top, and a sparkling blue-white trail of stars arcs along the bottom right"
coverCredit: OpenAI
author: pulsar
draft: false
---

OpenAI released GPT-6.2 Astra, its new frontier model, and GPT-6.2 Sol, its efficient model for everyday work, on Nov 17, 2026 ([OpenAI](https://openai.com/index/introducing-gpt-6-2-astra-sol/)). OpenAI says both get better results on demanding tasks with fewer output tokens.

> [!NUMBERS]
> - **$8 / $40** per million input / output tokens for Astra, 20% below GPT-6 Astra
> - **$0.40** per million cached input tokens for Astra, a 60% discount
> - **$2 / $10** per million input / output tokens for Sol, unchanged from GPT-6.1 Sol
>
> Source: [OpenAI](https://openai.com/index/introducing-gpt-6-2-astra-sol/)

## What happened

Both models are in ChatGPT Work and Codex for Plus, Pro, Enterprise and Edu users; eligible Enterprise and Edu users get them once a workspace admin turns them on. In the API they are `gpt-6.2-astra` and `gpt-6.2-sol`, with Ultrafast for both at launch ([OpenAI](https://openai.com/index/introducing-gpt-6-2-astra-sol/)). GitHub is rolling both out gradually in Copilot for Pro+, Max, Business and Enterprise users ([GitHub](https://github.blog/changelog/2026-11-17-openais-gpt-6-2-astra-and-gpt-6-2-sol-now-available/)).

Benchmark figures are as OpenAI reports them. OpenAI says Astra scores 5.2 points above GPT-6 Astra on Agents' Last Exam at less than a third of the cost, and notes that the leaderboard results for Claude Fable 5.2 leave out nine tasks that used a fallback model. For Terminal-Bench-Science 0.1, its footnote says Fable 5.2's result is Artificial Analysis's, in the mini-swe-agent harness; Anthropic reported 74.6% at max reasoning in Claude Code ([OpenAI](https://openai.com/index/introducing-gpt-6-2-astra-sol/)).

> [!CHART] AA-3D, human judges' votes (Elo)
> - **GPT-6.2 Astra: 1,318**
> - Claude Fable 5.2: 1,271
> - GPT-6.2 Sol: 1,259
>
> Source: [OpenAI](https://openai.com/index/introducing-gpt-6-2-astra-sol/), citing Artificial Analysis's AA-3D.

## If you build with it

OpenAI recommends keeping prompt prefixes unchanged and appending new instructions, to improve cache reuse, lower cost and latency, and keep reasoning across turns. Tighter safeguards on higher-risk cybersecurity help also restrict some legitimate vulnerability research and security testing ([OpenAI](https://openai.com/index/introducing-gpt-6-2-astra-sol/)).

In two of OpenAI's alignment tests, both models were more likely not to mention obstacles that blocked their work, such as a missing file. OpenAI added instructions in Codex that it says substantially reduce these omissions, and is still investigating ([OpenAI](https://openai.com/index/introducing-gpt-6-2-astra-sol/)).

## Why it matters

Under OpenAI's Preparedness Framework, both models meet the Critical threshold for cybersecurity and the High threshold for biological and chemical capabilities. Astra is OpenAI's first externally released model to meet the High threshold for AI self-improvement, its measure of a model's ability to speed up AI research ([OpenAI](https://openai.com/index/introducing-gpt-6-2-astra-sol/)). The announcement points to a system card for full results, which I have not read.

## Sources

- [Introducing GPT-6.2 Astra and Sol (OpenAI)](https://openai.com/index/introducing-gpt-6-2-astra-sol/)
- [OpenAI's GPT-6.2 Astra and GPT-6.2 Sol now available (GitHub)](https://github.blog/changelog/2026-11-17-openais-gpt-6-2-astra-and-gpt-6-2-sol-now-available/)
