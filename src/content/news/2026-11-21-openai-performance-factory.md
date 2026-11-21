---
title: "OpenAI puts *Codex agents* on ChatGPT slowdowns"
date: 2026-11-21
summary: "OpenAI's Performance Factory has Codex agents investigate ChatGPT slowdowns, propose fixes for engineers to review, and check recovery after deploys."
sourceUrl: https://openai.com/index/how-openai-performance-factory-keeps-chatgpt-fast/
sourceName: OpenAI
topic: tools
tags: [ai-agents]
cover: /media/news/openai-performance-factory.webp
coverAlt: "OpenAI's share image for the post: on a teal-to-blue gradient with a dotted white grid, white line icons form a loop joined by arrows, from a warning triangle to a document with a small robot face, a magnifying glass, a terminal prompt, a second robot document and a second magnifying glass, then back to the warning triangle. Below, white text reads How OpenAI's Performance Factory keeps ChatGPT fast"
coverCredit: OpenAI
author: pulsar
draft: false
---

OpenAI described its Performance Factory on Nov 19, 2026. In this internal system, Codex agents investigate ChatGPT performance regressions, propose fixes for engineers to review, and check whether performance recovered after the fix ships ([OpenAI](https://openai.com/index/how-openai-performance-factory-keeps-chatgpt-fast/)). A regression here is a slowdown or availability drop that one of OpenAI's performance alerts catches.

> [!NUMBERS]
> - **1,700+** investigations tracked in just over three months
> - **600+** cases root-caused
> - **17** automated investigations a day
> - **70%** of 100 reviewed root-cause suggestions graded accurate
>
> Source: [OpenAI](https://openai.com/index/how-openai-performance-factory-keeps-chatgpt-fast/)

## What happened

The first workflow, the Regression Workflow, opens a task when an alert fires and moves it through six stages ([OpenAI](https://openai.com/index/how-openai-performance-factory-keeps-chatgpt-fast/)):

1. **Detected** by the alert system.
2. **Find root cause.** An agent works from perf-forensics, a shared skill (a set of written instructions for Codex) that says which of the team's more than 30 performance tools to use and how to work through a slowdown.
3. **Propose fix.** An agent writes the change and opens a pull request.
4. **Review and deploy.** An engineer reviews the pull request and decides whether to merge it.
5. **Verify recovery.** After deployment, an agent checks whether performance is back to its baseline.
6. **Resolved.**

Engineers define each workflow in configuration files and Markdown prompts. A dispatch loop hands ready tasks to agents, Codex runs in the cloud under a service identity, and a waiting task wakes on events such as pull request review comments or failed CI checks ([OpenAI](https://openai.com/index/how-openai-performance-factory-keeps-chatgpt-fast/)).

A separate Codex session tries to disprove each diagnosis, and another review checks each proposed fix. OpenAI says the other 30% of the 100 suggestions it reviewed needed refinement or did not fully establish causality. It says fixes have been harder to get right than causes, with some proposed changes more complicated than needed or introducing new issues ([OpenAI](https://openai.com/index/how-openai-performance-factory-keeps-chatgpt-fast/)).

## Why it matters

OpenAI says the pace of agentic development made traditional approaches to performance engineering unsustainable. It tests changes to its agents by backtesting them on past incidents and grading their summaries, and it runs an agent every day that scans recent runs for tool failures and access errors ([OpenAI](https://openai.com/index/how-openai-performance-factory-keeps-chatgpt-fast/)).

The post describes a system OpenAI uses on its own services and does not say others can use it. It gives no figure for engineering time saved or for how many proposed fixes were merged. OpenAI is working on finding slowdowns even when no alert fires and on rightsizing autoscaling settings, and is exploring whether agents could ship low-risk fixes without a human in the loop ([OpenAI](https://openai.com/index/how-openai-performance-factory-keeps-chatgpt-fast/)).

## Sources

- [How OpenAI's Performance Factory keeps ChatGPT fast (OpenAI)](https://openai.com/index/how-openai-performance-factory-keeps-chatgpt-fast/)
