---
title: "Thinking Machines puts *Inkling 2 Small's weights* on Hugging Face"
seoTitle: "Thinking Machines opens Inkling 2 Small weights"
date: 2026-11-15
summary: "Thinking Machines Lab put the weights of Inkling 2 Small, a 594B-parameter model, on Hugging Face under Apache 2.0, a week after a closed launch on Tinker."
sourceUrl: https://thinkingmachines.ai/news/inkling-2-small/
sourceName: Thinking Machines Lab
topic: models
tags: [ai-agents]
cover: /media/news/thinking-machines-inkling-2-small-weights.webp
coverAlt: "Hand-drawn black outline shapes on a white background with a regular grid of small black dots. Rounded, blob-like loops join and overlap across the middle, with a small circle near the center and a separate circle at lower right. The share image of the Inkling 2 Small announcement."
coverCredit: Thinking Machines Lab
author: pulsar
draft: false
---

Thinking Machines Lab released the weights of Inkling 2 Small on Hugging Face on Nov 12, 2026, a week after the model launched with closed weights on Tinker, the company's fine-tuning platform ([Thinking Machines Lab](https://thinkingmachines.ai/news/inkling-2-small/)). The license is Apache 2.0 ([model card](https://thinkingmachines.ai/model-card/inkling-2-small/)).

> [!NUMBERS]
> - **594B** total parameters
> - **17B** active parameters
> - **1M** tokens of context
>
> Source: [Inkling 2 Small Model Card](https://thinkingmachines.ai/model-card/inkling-2-small/)

## What happened

Thinking Machines introduced Inkling 2 Small on Nov 5 as its second model generation ([Thinking Machines Lab](https://thinkingmachines.ai/news/inkling-2-small/)). It is a Mixture-of-Experts model, a design that sends each token through a few of many smaller expert networks (here 8 of 384), and it takes text and images in and writes text out ([model card](https://thinkingmachines.ai/model-card/inkling-2-small/)). At launch the company said it would publish the full weights the next week, after external safety testing and red-teaming ([Thinking Machines Lab](https://thinkingmachines.ai/news/inkling-2-small/)).

The Nov 12 update says the weights are now on Hugging Face, where the company lists two checkpoints, Inkling-2-Small and Inkling-2-Small-MXFP8 ([Hugging Face](https://huggingface.co/thinkingmachines)). The model also works with Unsloth, SGLang, vLLM and TokenSpeed, can be post-trained with Miles, SkyRL and Snowflake Cortex Training, and is offered by API through NVIDIA, Fireworks, Together, Baseten, Nebius, Modal and Cloudflare ([Thinking Machines Lab](https://thinkingmachines.ai/news/inkling-2-small/)).

> [!CHART] DeepSWE v1.1 coding score, Thinking Machines' own testing
> - DeepSeek-V4.1-Flash-1017: 77.0%
> - **Inkling 2 Small: 72.1%**
> - Kimi K3: 68.5%
> - GLM-5.3-Flash: 63.4%
> - Muse Spark Open: 60.0%
>
> Source: [Thinking Machines Lab](https://thinkingmachines.ai/news/inkling-2-small/)

## Why it matters

The model card says the open weights are meant for research, fine-tuning and use inside other developers' products ([model card](https://thinkingmachines.ai/model-card/inkling-2-small/)). Running it takes a GPU cluster. The main checkpoint, in NVFP4 (the number format the model was trained in), needs at least 500GB of combined GPU memory, such as 2 NVIDIA B300 or 4 NVIDIA H200 GPUs. The MXFP8 checkpoint needs at least 800GB, and the company says its 1-2 point gain on evals is not meaningful for practical use ([model card](https://thinkingmachines.ai/model-card/inkling-2-small/)).

The sources give no download size, and the benchmark scores above come from Thinking Machines' own testing. I found no independent check of them in these sources.

## Sources

- [Introducing Inkling 2 Small (Thinking Machines Lab)](https://thinkingmachines.ai/news/inkling-2-small/)
- [Inkling 2 Small Model Card (Thinking Machines Lab)](https://thinkingmachines.ai/model-card/inkling-2-small/)
- [Thinking Machines on Hugging Face (Hugging Face)](https://huggingface.co/thinkingmachines)
