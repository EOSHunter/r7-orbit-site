---
title: "Anthropic's Claude Managed Agents can now run *on your own servers*"
seoTitle: "Claude Managed Agents can now be self-hosted"
date: 2026-11-13
summary: "Anthropic launched self-hosted Claude Managed Agents. Companies run the service, its storage and the sandboxes themselves, and pick the model provider."
sourceUrl: https://platform.claude.com/docs/en/managed-agents/self-hosted
sourceName: Anthropic
topic: tools
tags: [anthropic, claude, ai-agents]
cover: /media/news/claude-managed-agents-self-hosted.webp
coverAlt: "The Claude Platform Docs page header, with the title Self-hosted Claude Managed Agents in large serif type on a light gray background"
coverCredit: Anthropic
author: pulsar
draft: false
---

Anthropic launched self-hosted Claude Managed Agents on Nov 12, 2026. Customers run the whole Managed Agents service on their own infrastructure and keep agents, sessions and session history there ([Claude release notes](https://platform.claude.com/docs/en/release-notes/overview)). Managed Agents has two parts: the service (the API, the agent loop and the storage) and the sandboxes, isolated workspaces where an agent's tools run commands and work on files ([Claude docs](https://platform.claude.com/docs/en/managed-agents/self-hosted)).

| Option | Sandboxes | Service | Model |
| --- | --- | --- | --- |
| Cloud sandboxes (default) | Anthropic | Anthropic | Anthropic |
| Self-hosted sandboxes | You | Anthropic | Anthropic |
| Self-hosted Managed Agents | You | You | Anthropic, or a provider you choose |

Who hosts each part, from the [Claude docs](https://platform.claude.com/docs/en/managed-agents/self-hosted).

## What changed

With self-hosted sandboxes, an existing option, customers host the sandboxes and Anthropic runs the service. With self-hosted Managed Agents they host the service too, in a cloud account or an on-premise data center ([Claude docs](https://platform.claude.com/docs/en/managed-agents/self-hosted)). Model calls go to Anthropic by default, or to Amazon Bedrock, Claude Models on Google Cloud (Google managed), Microsoft Foundry or the customer's own model gateway ([Claude docs](https://platform.claude.com/docs/en/managed-agents/self-hosted)).

Access is by request through the Anthropic account team ([Claude release notes](https://platform.claude.com/docs/en/release-notes/overview)). Neither page gives a price.

## What you run

- **Server** (`cma-server`): serves the API, runs the agent loop and stores the data. It never runs the agent's shell or file tools.
- **Database:** PostgreSQL 16 or later. Without one, data stays in memory and a restart erases it.
- **Workers:** programs that take work from the server and run the agent's tools in your sandboxes.
- **Console and admin CLI:** a sign-in webpage on the server, and `cma-server-admin` for environments and their keys.

Source: [Claude docs](https://platform.claude.com/docs/en/managed-agents/self-hosted). The server has the same API as the hosted service, with exceptions. Webhooks, scheduled deployments and Anthropic's prebuilt document skills are not available ([Claude docs](https://platform.claude.com/docs/en/managed-agents/self-hosted/differences)).

## What still leaves your network

Each model call sends the conversation so far, including tool inputs and results, to the chosen provider. Calls to the Claude API also carry the IDs of the session, agent and environment ([Claude docs](https://platform.claude.com/docs/en/managed-agents/self-hosted)). Anthropic says it has no remote access to the server or its log, and the server connects to Anthropic only when the Claude API is its provider ([Claude docs](https://platform.claude.com/docs/en/managed-agents/self-hosted-data-and-access)).

## Security is the customer's job

The agent's bash tool is a real shell with the worker's permissions and network access, and the worker does not isolate it. The Docker Compose stack and the Helm chart start each session's worker in its own container or pod. Anthropic tells customers who start a worker themselves to run it in a disposable container or VM, and to give each trust level its own deployment ([Claude docs](https://platform.claude.com/docs/en/managed-agents/self-hosted)). Securing the server and detecting unusual usage, which Anthropic handles on the hosted service, become the customer's responsibility. Customers also install each release themselves ([Claude docs](https://platform.claude.com/docs/en/managed-agents/self-hosted)).

## Sources

- [Self-hosted Claude Managed Agents (Anthropic)](https://platform.claude.com/docs/en/managed-agents/self-hosted)
- [Release notes, November 12, 2026 (Anthropic)](https://platform.claude.com/docs/en/release-notes/overview)
- [Differences from the hosted service (Anthropic)](https://platform.claude.com/docs/en/managed-agents/self-hosted/differences)
- [Data and access in self-hosted Claude Managed Agents (Anthropic)](https://platform.claude.com/docs/en/managed-agents/self-hosted-data-and-access)
