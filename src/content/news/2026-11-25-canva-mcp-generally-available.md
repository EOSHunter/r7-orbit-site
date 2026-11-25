---
title: "Canva opens its MCP server to *any agent*, with no waitlist"
seoTitle: "Canva makes its MCP server generally available"
date: 2026-11-25
summary: "Canva's MCP server is generally available, redesigned for agents, and joined by new REST APIs, a bigger Canva CLI and service accounts with API billing."
sourceUrl: https://www.canva.com/newsroom/news/canva-mcp-update/
sourceName: Canva
topic: tools
tags: [ai-agents]
cover: /media/news/canva-mcp-generally-available.webp
coverAlt: "Canva's banner for the announcement: a small Canva MCP wordmark, the Canva script logo in a teal-to-purple gradient beside MCP in black, above a large gradient headline reading \"Canva, accessible to any agent or AI assistant.\" on an off-white background that fades to pale blue at the bottom corners, with slivers of app screenshots cut off at the left and right edges"
coverCredit: Canva
author: pulsar
draft: false
---

Canva made its MCP server generally available on Nov 23, 2026, with no waitlist, and added REST APIs, more Canva CLI commands and service accounts for developers ([Canva](https://www.canva.com/newsroom/news/canva-mcp-update/)). MCP, the Model Context Protocol, is a standard way for AI assistants and agents to call outside tools.

## What happened

Until now, access was limited to developers in Canva's community and to connectors Canva built with partners such as OpenAI and Anthropic. Developers can now sign up in the Canva Developer Portal, register their direct URLs and turn on MCP access ([Canva](https://www.canva.com/newsroom/news/canva-mcp-update/)). Canva names ChatGPT, Claude, Gemini and Muse as assistants where its MCP server already runs design tasks.

Canva redesigned the server for agents, merging overlapping tools. Agents can now generate an editable design, a standalone image or a video, remove a background, turn a flat image into a layered design, resize and export ([Canva](https://www.canva.com/newsroom/news/canva-mcp-update/)).

Canva describes three ways to build ([Canva](https://www.canva.com/newsroom/news/canva-mcp-update/)):

- **MCP**, where an agent picks the Canva tools it needs for a task in a prompt.
- **REST APIs**, for direct control. Design generation, image generation, background removal and Magic Layers are available this way. New service accounts add API billing, so a product's customers can use these features without each signing in to Canva.
- **The Canva CLI**, a command-line tool that can now create designs, run Autofill workflows and call the REST APIs.

Canva Craft, the image model from Canva Research, is also open through MCP and the API ([Canva](https://www.canva.com/newsroom/news/canva-mcp-update/)). Neither the announcement nor the [Canva MCP server page](https://www.canva.dev/solutions/mcp/) states a price for the REST APIs.

## Why it matters

The figures here are Canva's own. It says nearly 500,000 people signed up through MCP "since October" (its summary says "in the last month"), and four in 10 first-time MCP users are new to Canva ([Canva](https://www.canva.com/newsroom/news/canva-mcp-update/)).

> [!NUMBERS]
> - **93%** rise in MCP usage from September to October
> - **72%** of typed Canva CLI commands in October came from agents
> - **38%** rise in API clients using the public API
> - **2.5x** as likely to use Canva AI when arriving through an AI assistant
>
> Source: [Canva](https://www.canva.com/newsroom/news/canva-mcp-update/)

Canva also reports more than a 300% increase in expected annual recurring revenue from September to October, and month-on-month growth in new developers going from 22% to nearly 46% ([Canva](https://www.canva.com/newsroom/news/canva-mcp-update/)). The announcement gives no dollar amounts for that revenue.

## Sources

- [Building the design layer of the internet: opening Canva to every agent and developer (Canva)](https://www.canva.com/newsroom/news/canva-mcp-update/)
- [Canva MCP server (Canva Developers)](https://www.canva.dev/solutions/mcp/)
