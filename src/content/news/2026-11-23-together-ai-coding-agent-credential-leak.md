---
title: "A coding agent's leaked credential exposed Together AI *prompts*"
seoTitle: "Together AI agent leak exposed stored prompts"
date: 2026-11-23
summary: "An AI coding agent committed a credential to a public Together AI repository. Someone used it to download stored prompt samples from June and July 2026."
sourceUrl: https://www.together.ai/blog/security-event-prompt-leakage-for-requests-in-june-and-july-of-2026
sourceName: Together AI
topic: security
tags: [security, ai-agents]
cover: /media/news/together-ai-prompt-leak.webp
coverAlt: "Together AI share image: a soft pastel gradient of peach, pink, pale blue and lavender with faint diagonal light shapes, the together.ai logo of three overlapping circles in the center, and the words Security event in large black type below it"
coverCredit: Together AI
author: pulsar
draft: false
---

Together AI said on Nov 21, 2026 that an AI coding agent committed a credential to its public GitHub repository, xorl, and an unauthorized party used it to download stored prompt samples from its serverless inference service ([Together AI](https://www.together.ai/blog/security-event-prompt-leakage-for-requests-in-june-and-july-of-2026)).

> [!TIMELINE]
> - **Jun 24** Prompt samples taken from requests to MiniMax M3, GLM-5.2 and Kimi K2.6
> - **Jul 4** A second main sample date
> - **Jul 8** A third main sample date
> - **Jul 14** The last of the main sample dates
> - **Nov 21** Together AI discloses the leak
>
> Source: [Together AI](https://www.together.ai/blog/security-event-prompt-leakage-for-requests-in-june-and-july-of-2026)

## What happened

Together AI kept the prompt samples, which it says were authorized for software testing, in a private Hugging Face repository. While working on xorl, an AI coding agent committed a credential that opened that repository. The company's automated scanning found it and the commit was reverted ([Together AI](https://www.together.ai/blog/security-event-prompt-leakage-for-requests-in-june-and-july-of-2026)).

During the exposure window, the party downloaded the samples, searched them for credentials to other services and tested whether those worked. Five of the credentials it tested were canary credentials from a Dragos security experiment. Together AI worked with an outside forensic firm and law enforcement, and says it has found no evidence of other prompt leakage ([Together AI](https://www.together.ai/blog/security-event-prompt-leakage-for-requests-in-june-and-july-of-2026)).

The company lists four changes ([Together AI](https://www.together.ai/blog/security-event-prompt-leakage-for-requests-in-june-and-july-of-2026)):

- Scoped or short-lived credentials, and keyless access where supported
- Checks for credentials on every pull request
- Zero data retention (ZDR) as the default for new accounts
- Updated development rules for AI coding agents

## Why it matters

The samples came from prompts customers sent to the serverless inference service, and the party searched them for credentials to other services. Together AI is still reviewing the prompts to learn whether sensitive personal information or other customer data was exposed, and will contact affected customers directly. It advises customers with sensitive prompt data to turn on ZDR ([Together AI](https://www.together.ai/blog/security-event-prompt-leakage-for-requests-in-june-and-july-of-2026)).

The post does not say how long the exposure window lasted, how many customers or prompts were involved, who the party is, or which coding agent committed the credential.

## Sources

- [Security event: Prompt leakage for requests in June and July of 2026 (Together AI)](https://www.together.ai/blog/security-event-prompt-leakage-for-requests-in-june-and-july-of-2026)
- [Together AI Discloses Prompt Leak After Coding Agent Exposed Credential (Unite.AI)](https://www.unite.ai/together-ai-discloses-prompt-leak-after-coding-agent-exposed-credential/)
