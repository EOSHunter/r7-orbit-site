---
title: "OpenAI adds GPT-Live-1.1 to its API, with a *standby* rate"
seoTitle: "OpenAI GPT-Live-1.1 in the API, with standby"
date: 2026-11-20
summary: "OpenAI's full-duplex voice model GPT-Live-1.1 is in the API. Sessions cost $0.05 a minute active and $0.02 a minute in the new WebRTC standby mode."
sourceUrl: https://developers.openai.com/api/docs/models/gpt-live-1.1
sourceName: OpenAI
topic: tools
tags: [ai-agents, voice]
cover: /media/news/openai-gpt-live-1-1.webp
coverAlt: "Screenshot of OpenAI's GPT-Live-1.1 model page on the OpenAI Developers site, a white page with the top navigation and a sidebar of doc links. The main column shows the heading GPT-Live-1.1 with the id gpt-live-1.1 and the line \"Full-duplex voice model for multilingual conversations\", a summary row with the $0.05 active price and audio and text input and output, and a Pricing section with live session duration boxes of $0.05 active and $0.02 standby per minute"
coverCredit: OpenAI
author: pulsar
draft: false
---

OpenAI added GPT-Live-1.1, its full-duplex voice model, to the API on Nov 19, 2026, through the `v1/live/sessions` endpoint ([OpenAI API changelog](https://developers.openai.com/api/docs/changelog)). Full duplex means the model can listen while it speaks ([OpenAI](https://developers.openai.com/api/docs/models/gpt-live-1.1)).

> [!CHART] Live session duration, price per minute
> - **Active: $0.05**
> - Standby: $0.02
>
> Source: [OpenAI](https://developers.openai.com/api/docs/models/gpt-live-1.1)

## What happened

OpenAI says GPT-Live-1.1 improves pronunciation, accent consistency and transcription in multilingual voice conversations ([OpenAI API changelog](https://developers.openai.com/api/docs/changelog)). Its model page says that, compared with GPT-Live-1, it transcribes speech more accurately and keeps a more consistent accent and voice across languages ([OpenAI](https://developers.openai.com/api/docs/models/gpt-live-1.1)). OpenAI gives no benchmark numbers for these gains, and the model page lists performance and speed as not specified.

The same entry adds a standby option for GPT-Live-1 and GPT-Live-1.1 WebRTC sessions. Standby pauses inference while nobody is speaking and resumes when someone speaks ([OpenAI API changelog](https://developers.openai.com/api/docs/changelog)). The pages I read do not say how long a session waits before it goes into standby.

## What it costs

Voice sessions are billed by how long they run, and backend model and tool use is billed separately. The lower standby rate applies only to WebRTC sessions while inference is paused ([OpenAI](https://developers.openai.com/api/docs/models/gpt-live-1.1)). By my arithmetic from those per-minute rates, an hour comes to $3.00 active or $1.20 in standby, before any backend costs.

GPT-Live-1.1 takes audio and text in and gives audio and text out, and supports streaming and function calling. GPT-Live-1.1 and GPT-Live-1 have separate limits on concurrent sessions ([OpenAI](https://developers.openai.com/api/docs/models/gpt-live-1.1)).

## How delegation works

GPT-Live runs the spoken conversation and hands tasks to a backend agent, which looks up information, uses tools and completes tasks. OpenAI calls this delegation. The developer picks the backend model or agent separately from the voice model: an OpenAI Responses model, or with client delegation any model, agent harness or service the application runs ([OpenAI](https://developers.openai.com/api/docs/guides/live)). With GPT-Live-1.1, developers describe in plain language when the model should hand a task to the backend ([OpenAI](https://developers.openai.com/api/docs/models/gpt-live-1.1)).

## Sources

- [GPT-Live-1.1 (OpenAI)](https://developers.openai.com/api/docs/models/gpt-live-1.1)
- [API changelog, Nov 19, 2026 (OpenAI)](https://developers.openai.com/api/docs/changelog)
- [Getting started with GPT-Live (OpenAI)](https://developers.openai.com/api/docs/guides/live)
