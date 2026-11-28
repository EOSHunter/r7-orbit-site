---
title: "Microsoft names six threat groups using *ARTEX*, an AI pentest agent"
seoTitle: "Microsoft on ARTEX, the AI agent attackers use"
date: 2026-11-28
summary: "Microsoft details ARTEX, an open-source AI penetration-testing framework six named threat groups have added to their tooling, and how to spot and slow it."
sourceUrl: https://www.microsoft.com/en-us/security/blog/2026/11/25/what-defenders-need-to-know-artex-agentic-ai-framework-threat-actors-abuse/
sourceName: Microsoft
topic: security
tags: [ai-agents, security]
cover: /media/news/microsoft-artex-threat-actors.webp
coverAlt: "Microsoft diagram of the ARTEX AI agent architecture on a white background: a red threat actor icon that defines the target scope, an arrow to four boxes in a row for the goals agent, planner agent, worker agents and reporter agent, a purple knowledge graph box below fed by the worker agents that wakes the planner on each update, and a stop condition box (goals met, or time or step limit reached) that leads to the reporter agent, which reports back to the threat actor"
coverCredit: Microsoft
author: pulsar
draft: false
---

Microsoft Threat Intelligence published a breakdown of ARTEX on Nov 25, 2026, an open-source AI penetration-testing framework, and said state-sponsored and financially motivated groups including Storm-0940, Storm-3358, Onyx Sleet, Pearl Sleet, Crystal Typhoon and Salt Typhoon have integrated it into their tooling ([Microsoft](https://www.microsoft.com/en-us/security/blog/2026/11/25/what-defenders-need-to-know-artex-agentic-ai-framework-threat-actors-abuse/)). Depending on its setup and the target's defenses, Microsoft says ARTEX can go from reconnaissance to persistent, privileged access "in a matter of minutes."

> [!TIMELINE]
> - **Jul 2026** GitHub user Autumn-27 publishes ARTEX as open-source code with a Chinese-language interface
> - **Oct 2026** The original developer removes the source code; forks keep publishing their own versions
> - **Nov 2026** Security company ThreatBook claims ownership and starts selling access to "ARTEX Pro"
> - **Nov 25** Microsoft publishes its report
>
> Source: [Microsoft](https://www.microsoft.com/en-us/security/blog/2026/11/25/what-defenders-need-to-know-artex-agentic-ai-framework-threat-actors-abuse/)

## How the agents work

In ARTEX, the attacker sets the target scope and a goals agent breaks the job into objectives that can be verified. A planner agent reads a knowledge graph of discovered assets and findings and issues short directions Microsoft calls "intents." Worker agents claim them, carry them out with a real shell and offensive tools, and write new facts back to the graph, which wakes the planner again. When the goals are met or a time or step limit is reached, a reporter agent writes up each confirmed finding with reproduction steps and a proof of concept ([Microsoft](https://www.microsoft.com/en-us/security/blog/2026/11/25/what-defenders-need-to-know-artex-agentic-ai-framework-threat-actors-abuse/)).

The agents can run on almost any large language model, including ones with their guardrails removed, so Microsoft says the activity may not be constrained by any single provider's safety controls or visible in its telemetry. An optional pool switches models when one fails (an exhausted quota, an invalid key, a rate limit), so a long campaign can continue across providers or keys ([Microsoft](https://www.microsoft.com/en-us/security/blog/2026/11/25/what-defenders-need-to-know-artex-agentic-ai-framework-threat-actors-abuse/)).

## What Microsoft saw

> [!NUMBERS]
> - **151,000+** failed sign-ins in one Storm-0940 campaign that used ARTEX, peaking at 2,900 a minute
> - **5 minutes** for an AI agent to go from searching GitHub for client secrets to taking data from Azure Key Vault, in one case
> - **Under 3 hours** from first targeting to privileged access, in several ARTEX-driven Storm-0940 intrusions
>
> Source: [Microsoft](https://www.microsoft.com/en-us/security/blog/2026/11/25/what-defenders-need-to-know-artex-agentic-ai-framework-threat-actors-abuse/)

Microsoft says ARTEX uses no new attack techniques, and the most reliable sign of it is its behavior, a wide variety of requests in a short time, with retries and next-stage moves at machine speed. During Storm-0940 activity, an application assigned itself the Global Administrator role ([Microsoft](https://www.microsoft.com/en-us/security/blog/2026/11/25/what-defenders-need-to-know-artex-agentic-ai-framework-threat-actors-abuse/)). Microsoft's report does not name victims or say how many organizations were hit. Switzerland's BACS named ARTEX in [its Nov 24 advisory](/news/2026-11-27-swiss-bacs-ai-agent-attacks/) on attacks with AI agents.

## What Microsoft recommends

Microsoft's guidance includes these steps ([Microsoft](https://www.microsoft.com/en-us/security/blog/2026/11/25/what-defenders-need-to-know-artex-agentic-ai-framework-threat-actors-abuse/)):

- Keep application secrets out of code, and replace any found in code or configuration files, including .env files
- Use rate limiting, bot protection and a web application firewall in prevention mode
- Require MFA for all users, phishing-resistant MFA for administrators, and block legacy authentication
- Restrict outbound connections from web servers
- Set out honeypots, decoys, tarpits and "fake wins", convincing evidence that the agent's goal is complete so it stops on a false success. In Microsoft's testing, these decoys helped reduce the attack traffic that reached real assets

## Sources

- [What defenders need to know about ARTEX, the agentic AI framework threat actors abuse (Microsoft)](https://www.microsoft.com/en-us/security/blog/2026/11/25/what-defenders-need-to-know-artex-agentic-ai-framework-threat-actors-abuse/)
