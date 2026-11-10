---
title: "OpenAI's Control Room can stop a research job *within 35 seconds*"
seoTitle: "OpenAI's Control Room stops jobs in 35 seconds"
date: 2026-11-10
summary: "OpenAI described Control Room, a service every research inference request must check with, so a training run or evaluation can be stopped within 35 seconds."
sourceUrl: https://openai.com/index/control-room/
sourceName: OpenAI
topic: security
tags: [security, ai-agents]
cover: /media/news/openai-control-room.webp
coverAlt: "The words Control Room in black at the center of a light gray grid of thin lines dotted with small pink, blue and yellow diamonds"
coverCredit: OpenAI
author: pulsar
draft: false
---

OpenAI published details of Control Room on Nov 9, 2026, a system that tracks every model workload across its research infrastructure and can halt a job's model output within 35 seconds of a decision to intervene ([OpenAI](https://openai.com/index/control-room/), [OpenAI News](https://openai.com/news/)). It covers agentic sampling for training and evaluation, data processing and other research inference.

> [!NOTE]
> At most 35 seconds pass between Control Room getting an order to stop a job and the point where the job can make no further progress ([OpenAI](https://openai.com/index/control-room/)).

## How it works

Each research job asks Control Room for a job ID when it starts. Every time the job asks an inference engine (the model running on GPUs) for more tokens, the engine checks that ID with Control Room first. Once a job is marked stopped, the engine refuses its requests ([OpenAI](https://openai.com/index/control-room/)).

The stop order can come from a person or from a monitor, a second model that watches a model in training and raises alerts. OpenAI says all of its frontier reinforcement learning jobs run with one ([OpenAI](https://openai.com/index/control-room/)).

OpenAI put the check in the inference layer because research code changes often and there are only a few inference code paths, so every request passes through it. The design also fails closed, so if Control Room goes down for any reason, tampering included, engines deny all requests until it is back. Fail-closed is live for frontier model research and finishing across the rest over the next few days ([OpenAI](https://openai.com/index/control-room/)).

## What is not covered

The 35-second delay comes from a cache that lets the service keep up with traffic, and OpenAI says it is working to bring it to zero. Control Room runs on research infrastructure only. OpenAI says its public model serving is already centralized and has its own way to take deployments down ([OpenAI](https://openai.com/index/control-room/)). The post gives no figure for how often jobs have been stopped.

## Sources

- [Control Room: A central system to track and stop model workloads across our research infrastructure (OpenAI)](https://openai.com/index/control-room/)
- [OpenAI News (OpenAI)](https://openai.com/news/)
