---
title: "Anthropic's Claude Fable 5.2 costs *20% less* than Fable 5.1"
seoTitle: "Claude Fable 5.2 and Mythos 5.2 cost 20% less"
date: 2026-11-10
summary: "Anthropic released Claude Fable 5.2 to everyone and Claude Mythos 5.2 to verified security and life sciences teams. Same model, 1M tokens of context, $8 per million input tokens."
sourceUrl: https://www.anthropic.com/claude-fable-and-mythos-5-2
sourceName: Anthropic
topic: models
tags: [anthropic, claude, ai-agents]
cover: /media/news/claude-fable-mythos-5-2.webp
coverAlt: "The words Claude Fable 5.2 and Mythos 5.2 above a bright sunrise on the curved edge of a dark planet"
coverCredit: Anthropic
author: pulsar
draft: false
---

Anthropic released Claude Fable 5.2 and Claude Mythos 5.2 on Nov 9, 2026, its models for the hardest technical work ([Anthropic](https://www.anthropic.com/claude-fable-and-mythos-5-2)). They are the same underlying model. Fable has strong cybersecurity and biology safeguards against misuse, which is why Anthropic can offer it to all users. Mythos goes only to organizations Anthropic has verified through its Cyber Verification Program or its Life Sciences Verification Program ([Anthropic](https://www.anthropic.com/claude-fable-and-mythos-5-2)).

> [!NUMBERS]
> - **$8 / $40** per million input / output tokens, down from $10 / $50
> - **1M** tokens of context
> - **128k** tokens in one reply
>
> Source: [Claude docs](https://platform.claude.com/docs/en/models/fable-5-2/whats-new-fable-5-2)

## What changed

Both models cost the same: $8 per million input tokens and $40 per million output tokens. Fable 5.1 and Mythos 5.1 cost $10 and $50 ([Claude docs](https://platform.claude.com/docs/en/models/fable-5-2/whats-new-fable-5-2)). Anthropic says they also write their answers up to 30% faster than the 5.1 models, and an optional fast mode generates up to 2.5 times faster for $16 and $80 ([Anthropic](https://www.anthropic.com/claude-fable-and-mythos-5-2)).

> [!CHART] FrontierSWE v2, agentic coding
> - **Fable 5.2: 69.9%**
> - GPT-6 Astra: 65.5%
> - Opus 5.5: 62.3%
> - Gemini 4 Carbon: 61.2%
> - Fable 5.1: 56.3%
>
> Source: [Anthropic](https://www.anthropic.com/claude-fable-and-mythos-5-2), its own testing at each model's highest effort.

Anthropic's table puts Fable 5.2 above Opus 5.5 on almost every test it ran. It does not lead every row. On AutomationBench, a business-workflow test, Gemini 4 Carbon scores 53.9% to Fable 5.2's 51.4% ([Anthropic](https://www.anthropic.com/claude-fable-and-mythos-5-2)). On FrontierCode 2.0, which checks whether open-source maintainers would merge a model's code changes, Fable 5.2 at High effort scores about the same as Opus 5.5 at its best (45.3% to 45.5%) for roughly half the cost per task ([Anthropic](https://www.anthropic.com/claude-fable-and-mythos-5-2)).

Anthropic still tells most people to start with Opus 5.5 for everyday coding and knowledge work, and move up to Fable or Mythos for the most ambitious, open-ended jobs ([Anthropic](https://www.anthropic.com/claude-fable-and-mythos-5-2)).

## The agent experiments

The announcement leans on long agent runs. Anthropic says one engineer asked Fable 5.2 to design a prototype operating system from an empty folder. The model coordinated over 1,000 subagents (smaller agents it hands pieces of the job to) for eight days, and the result boots on a laptop, with drivers for the disk, keyboard and network, a login screen and an installer ([Anthropic](https://www.anthropic.com/claude-fable-and-mythos-5-2)). A team of agents running an earlier version of the model moved a production service from Python to Rust, and it now starts about 26 times faster ([Anthropic](https://www.anthropic.com/claude-fable-and-mythos-5-2)).

## Mythos and security

Mythos 5.2 is Anthropic's model for security work. On CVE Rediscovery, an internal test of how many published vulnerabilities a model can find in a project's code from before the fix, it found 89.6% of them, against 78.3% for Mythos 5.1. The October 2026 run covered 1,829 vulnerabilities ([Anthropic](https://www.anthropic.com/claude-fable-and-mythos-5-2)). Anthropic says Fable 5.2's safeguards block most cybersecurity tasks, so security teams apply for Mythos through the Cyber Verification Program ([Anthropic](https://www.anthropic.com/claude-fable-and-mythos-5-2), [Claude Help Center](https://support.claude.com/en/articles/14604842)).

That is the same approach OpenAI took four days earlier with [GPT-6 Cyber](/news/2026-11-09-openai-gpt-6-cyber-linux-exploits/), which it released only to approved security teams.

## For developers

Fable 5.2 is available on the Claude API, Amazon Bedrock, Google Cloud and Microsoft Foundry as `claude-fable-5-2`. Mythos 5.2 is `claude-mythos-5-2` ([Claude docs](https://platform.claude.com/docs/en/release-notes/overview)). The docs list changes that can break existing code:

- **Editing history:** changing the system prompt, the tools or earlier messages and then sending back a thinking block returns an error.
- **Computer use:** the old `computer_20251124` tool returns an error outside Amazon Bedrock; use `computer_toolset_20260801`.
- **Forced tool use:** setting `tool_choice` to `any` or a named tool returns an error, as does turning thinking on or off by hand. Thinking is always on and adapts to the task.
- **Data retention:** both models need 30-day retention and are not offered under zero data retention unless Anthropic agrees to it.

Source: [Claude docs](https://platform.claude.com/docs/en/models/fable-5-2/whats-new-fable-5-2)

For Claude subscribers, Anthropic is adding extra Fable usage on eligible paid plans this week, and Medium is the default effort in the Claude apps and Claude Code ([Anthropic](https://www.anthropic.com/claude-fable-and-mythos-5-2)).

## Sources

- [Introducing Claude Fable 5.2 and Claude Mythos 5.2 (Anthropic)](https://www.anthropic.com/claude-fable-and-mythos-5-2)
- [What's new in Claude Fable 5.2 (Claude docs)](https://platform.claude.com/docs/en/models/fable-5-2/whats-new-fable-5-2)
- [Release notes, November 9, 2026 (Claude docs)](https://platform.claude.com/docs/en/release-notes/overview)
- [Cyber Verification Program (Claude Help Center)](https://support.claude.com/en/articles/14604842)
