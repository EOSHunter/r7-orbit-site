---
title: "Anthropic's Enterprise Frontier Safeguards keep data in *your cloud*"
seoTitle: "Anthropic launches Enterprise Frontier Safeguards"
date: 2026-11-24
summary: "A new beta gives eligible organizations zero data retention on Claude's most capable models, with encrypted copies kept in their own cloud bucket."
sourceUrl: https://platform.claude.com/docs/en/manage-claude/enterprise-frontier-safeguards/overview
sourceName: Anthropic
topic: tools
tags: [anthropic, claude, security]
cover: /media/news/anthropic-enterprise-frontier-safeguards.webp
coverAlt: "Claude Platform Docs share image: a plain light gray background with a small orange Claude mark and the words Claude Platform Docs at the top left, and Enterprise Frontier Safeguards in large dark serif type on two lines at the lower left"
coverCredit: Anthropic
author: pulsar
draft: false
---

Anthropic launched Enterprise Frontier Safeguards (EFS) in beta on Nov 23, 2026. It gives eligible organizations Zero Data Retention (ZDR) on Claude's most capable models ([Anthropic](https://platform.claude.com/docs/en/release-notes/overview)).

> [!NOTE]
> Anthropic doesn't retain prompts and responses under EFS. Encrypted copies, called Sealed Safety Data, go to a bucket in the customer's own cloud account, and the customer's own team reviews flagged Safety Cases ([Anthropic](https://platform.claude.com/docs/en/manage-claude/enterprise-frontier-safeguards/overview)).

## What happened

EFS is available on Claude Platform, Claude Platform on AWS and Claude Models on Google Cloud (Anthropic managed) ([Anthropic](https://platform.claude.com/docs/en/release-notes/overview)). The sealed copies hold prompts, responses and model reasoning in Anthropic's encrypted format, and the customer's team can't read them, even in its own bucket. Anthropic Human Review is always off, so the customer's team reviews the cases that Anthropic's automated safety monitoring flags ([Anthropic](https://platform.claude.com/docs/en/manage-claude/enterprise-frontier-safeguards/overview)).

The docs compare three setups ([Anthropic](https://platform.claude.com/docs/en/manage-claude/enterprise-frontier-safeguards/overview)):

- **EFS:** the most capable models, automated monitoring, sealed data in the customer's bucket
- **Anthropic managed (the default):** the same models and monitoring, sealed data in Anthropic-managed storage
- **Legacy ZDR:** limited model and capability access, no automated monitoring, nothing retained

On Claude Platform, EFS covers a whole workspace and every model in it. It does not cover data that platform features store for their own use, such as code execution containers, Files API uploads, Batch API results and Claude Managed Agents sessions ([Anthropic](https://platform.claude.com/docs/en/manage-claude/enterprise-frontier-safeguards/overview)).

## Why it matters

The other ZDR option in the docs, Legacy ZDR, comes with limited model and capability access. With EFS, an organization can use the most capable models without Anthropic keeping its prompts and responses. Anthropic doesn't charge for EFS, and it doesn't change model behavior, API pricing or rate limits. The customer's cloud provider bills for the storage, including reads, writes and data egress ([Anthropic](https://platform.claude.com/docs/en/manage-claude/enterprise-frontier-safeguards/overview)).

The docs don't say which organizations are eligible or when the beta ends, and they warn that settings and behavior can change during the beta.

## Also in the release notes

> [!TIMELINE]
> - **Nov 23, 2026** Anthropic deprecates Claude Opus 4.5
> - **Jan 22, 2027** Opus 4.5 retires on the Claude API
>
> Source: [Anthropic](https://platform.claude.com/docs/en/release-notes/overview)

Anthropic recommends moving to Claude Opus 5.5. It also added two organization webhook events, in beta: `external_storage.failed` when a customer-owned bucket fails Anthropic's daily check, and `external_storage.recovered` when it passes again ([Anthropic](https://platform.claude.com/docs/en/release-notes/overview)).

## Sources

- [Enterprise Frontier Safeguards (Anthropic)](https://platform.claude.com/docs/en/manage-claude/enterprise-frontier-safeguards/overview)
- [Claude Platform release notes, Nov 23, 2026 (Anthropic)](https://platform.claude.com/docs/en/release-notes/overview)
