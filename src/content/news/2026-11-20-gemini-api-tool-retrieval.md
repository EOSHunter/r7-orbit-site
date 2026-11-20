---
title: "Gemini API agents can now load *tool schemas on demand*"
seoTitle: "Google adds Tool Retrieval to the Gemini API"
date: 2026-11-20
summary: "Google's Tool Retrieval, in preview in the Gemini Interactions API, lets an agent load a tool's parameter schema only when it needs that tool."
sourceUrl: https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-tool-retrieval/
sourceName: Google
topic: tools
tags: [ai-agents]
cover: /media/news/gemini-api-tool-retrieval.webp
coverAlt: "Google's header image for Tool Retrieval in the Gemini API: a single glowing blue four-pointed Gemini spark in the center of a black, space-like background, with small blue dashes scattered around it like streaking particles"
coverCredit: Google
author: pulsar
draft: false
---

Google launched Tool Retrieval in the Gemini API on Nov 19, 2026, in preview in the Interactions API ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-tool-retrieval/)). An agent keeps the name and description of every tool in context and loads a tool's parameter schema only when the task needs it.

> [!NOTE]
> Tool Retrieval has no separate charge. It works with Gemini 3.6 and later models, including all Gemini 4 models, in the Interactions API ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-tool-retrieval/)).

## What happened

A parameter schema is the part of a tool definition that lists the inputs the tool takes. To turn the feature on, a developer adds a `tool_search` tool to the request and sets `defer_loading: true` on the tools to hold back ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-tool-retrieval/)). This is shortened from Google's example:

```python
tools = [
    {"type": "tool_search"},
    {"type": "function", "name": "issue_refund",
     "description": "Refund an order to the original payment method.",
     "defer_loading": True, "parameters": {...}},
]
```

When the model needs a deferred tool, it asks for it by name, the API loads the full schema, and the model calls the function, all inside the same request. The three steps appear in `interaction.steps`, which Google says helps show which tools the model considered ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-tool-retrieval/)).

Google runs the search on its servers by default, with no index to build or host. Teams with their own tool registry, embedding index or per-user permission filter can run the search in their app by declaring `tool_search` with `"execution": "client"`, which adds one round trip per search and lets them add tools mid-conversation. Setting `defer_loading: true` on a remote MCP server tool (a server that offers a set of tools to the model) loads every tool on that server on demand ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-tool-retrieval/)).

## Why it matters

Google says sending every full schema on every request inflates input token counts, adds latency and lowers tool-selection accuracy as the list of tools grows. It also says deferred schemas stay out of the start of the prompt, so the cached prefix stays the same from turn to turn ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-tool-retrieval/)).

Turning on `tool_search` adds a small, fixed block of input tokens, and each schema the model loads is billed as input for the rest of the conversation. Google says developers save tokens when the schemas never loaded outweigh the ones that are, and tells them to measure it against their own traffic ([Google](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-tool-retrieval/)). The post gives no measured figures for token savings, latency or accuracy, and does not say how long the preview lasts.

## Sources

- [Introducing Tool Retrieval in the Gemini API (Google)](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-tool-retrieval/)
