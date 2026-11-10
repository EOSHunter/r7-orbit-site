---
title: "Fireworks AI says its breach reached *datasets and model weights*"
seoTitle: "Fireworks AI breach reached datasets and weights"
date: 2026-11-10
summary: "Fireworks AI updated its October breach report. Attackers reached billing data and, for some accounts, stored secrets, datasets and incomplete model weights."
sourceUrl: https://fireworks.ai/security/bulletins/october-2026-security-incident-update
sourceName: Fireworks AI
topic: security
tags: [security, ai-agents]
cover: /media/news/fireworks-security-update.webp
coverAlt: "Screenshot of the Fireworks security bulletin titled Update on October 2026 security incident, last updated November 9, 2026, marked Active monitoring"
coverCredit: Fireworks AI
author: pulsar
draft: false
---

Fireworks AI, a platform for running and training AI models, said on Nov 9, 2026 that an October breach went further than it first reported. Attackers reached account and billing information, and for a limited set of accounts, stored secrets, datasets and incomplete model weights ([Fireworks AI](https://fireworks.ai/security/bulletins/october-2026-security-incident-update)).

> [!TIMELINE]
> - **Oct 6** Fireworks finds misuse of internal credentials and starts containment
> - **Oct 9** First bulletin: secrets in evaluation jobs were exposed
> - **Oct 23** A cloud provider hosting Fireworks R&D machines has its own incident
> - **Oct 24** The attacker uses it to reach Fireworks development machines
> - **Oct 25** Last sign of successful access to the customer platform
> - **Nov 9** Update widens the list of data involved
>
> Source: [Fireworks AI](https://fireworks.ai/security/bulletins/october-2026-security-incident-update), [first bulletin](https://fireworks.ai/security/bulletins/october-2026-security-incident)

## What happened

On Oct 10, Fireworks said it had found no sign that customer models, datasets or training data were touched ([Fireworks AI](https://fireworks.ai/security/bulletins/october-2026-security-incident)). The update reverses part of that. Through an internal application, the attacker could see resource metadata, billing details such as addresses, invoices and credit usage, and for certain customers a subset of incomplete model weights and datasets. Fireworks says it does not store payment card numbers ([Fireworks AI](https://fireworks.ai/security/bulletins/october-2026-security-incident-update)).

Fireworks links the attack to a financially motivated group that resells stolen access to language models through illicit routing gateways, a practice called LLMjacking. It has not named the group. It is working with Palo Alto Networks Unit 42 on the investigation and has notified law enforcement ([Fireworks AI](https://fireworks.ai/security/bulletins/october-2026-security-incident-update)).

## What changes for customers

- **Paused:** self-serve dataset uploads and downloads for Batch Inference and dataset-based training are off while the investigation runs.
- **Not affected so far:** Fireworks has found no impact on Inference, the Training SDK or Nexus, which keep no data by default.
- **Notices:** customers whose data was involved are being contacted directly with details and steps to take.

Source: [Fireworks AI](https://fireworks.ai/security/bulletins/october-2026-security-incident-update)

Fireworks says the investigation is ongoing and may turn up more. It has not said how many accounts were affected.

## Sources

- [Update on October 2026 security incident (Fireworks AI)](https://fireworks.ai/security/bulletins/october-2026-security-incident-update)
- [Fireworks October 2026 security incident (Fireworks AI)](https://fireworks.ai/security/bulletins/october-2026-security-incident)
