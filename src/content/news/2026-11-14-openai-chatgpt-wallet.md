---
title: "OpenAI's ChatGPT Wallet lets agents pay *without your card details*"
seoTitle: "ChatGPT Wallet lets agents pay for you"
date: 2026-11-14
summary: "OpenAI's ChatGPT Wallet lets an agent pay with a network token after you approve each purchase. Businesses get a playbook for agent shoppers."
sourceUrl: https://openai.com/index/introducing-chatgpt-wallet/
sourceName: OpenAI
topic: tools
tags: [ai-agents, security]
cover: /media/news/openai-chatgpt-wallet.webp
coverAlt: "The words Introducing ChatGPT Wallet in white sans-serif type, centered on a soft blurred background of teal and green"
coverCredit: OpenAI
author: pulsar
draft: false
---

OpenAI announced ChatGPT Wallet on Nov 13, 2026, a way for agents to pay on a user's behalf without access to the user's actual card details ([OpenAI](https://openai.com/index/introducing-chatgpt-wallet/)). It was built with American Express, Mastercard and Visa, and starts in dots, OpenAI's always-on agents that each have their own cloud computer ([OpenAI](https://openai.com/index/introducing-dots/)), for ChatGPT Pro subscribers in the US ([OpenAI](https://openai.com/index/introducing-chatgpt-wallet/)).

| Step | Who | What happens |
| --- | --- | --- |
| Add a card | User | Once, with no re-entering of details later |
| Approve | User | Reviews the items, total and card, then passes a security check such as Face ID or a fingerprint scan |
| Token | Payment network | Provides a substitute card number, security code and expiration date |
| Payment | User's card | Charged, while the business and the agent never get the actual card details |

How a purchase works, from [OpenAI](https://openai.com/index/introducing-chatgpt-wallet/).

## What happened

OpenAI says 1.2B people use ChatGPT each week, and many use it to research products and decide what to buy ([OpenAI](https://openai.com/index/introducing-chatgpt-wallet/)). With Wallet, each approval creates a record of the purchase the user authorized. Users keep their card's rewards and its protections for eligible disputes, such as a defective item, and buy directly from the business, which keeps control of pricing, returns and customer service ([OpenAI](https://openai.com/index/introducing-chatgpt-wallet/)). OpenAI calls it the first wallet that lets agents pay without the actual card details and requires a security check for every purchase ([OpenAI](https://openai.com/index/introducing-chatgpt-wallet/)).

American Express says Wallet "marks our first American Express Agentic Commerce Experiences integration" (Luke Gebb, quoted by [OpenAI](https://openai.com/index/introducing-chatgpt-wallet/)). Later, OpenAI expects users to pre-approve purchases within limits they set, such as spending limits, categories or time periods ([OpenAI](https://openai.com/index/introducing-chatgpt-wallet/)). It gives no date for that.

## What businesses are asked to do

OpenAI says some sites may block agent purchases without meaning to, and published a [Commerce Partner Playbook](https://developers.openai.com/commerce) with guides for businesses. The announcement lists four areas ([OpenAI](https://openai.com/index/introducing-chatgpt-wallet/)):

- **Product information:** claim the business in ChatGPT and, once verified, upload a product feed with current pricing and availability.
- **Agent access:** configure the CDN or firewall to recognize signed requests using Web Bot Auth, and check that site security is not blocking ChatGPT agents. Browser access needs no plugin or product feed.
- **Payments and risk:** Wallet's tokens work with existing checkout flows, but risk systems may flag legitimate agent purchases and decline or cancel them. OpenAI is working with fraud prevention partners including Forter, Riskified, Sardine and Signifyd and payment providers including Adyen, Checkout.com and Stripe.
- **More ways in:** a plugin lets agents check availability, manage carts or take other actions, and websites can also add WebMCP tools.

## Who can use it

Wallet began rolling out on Nov 13 in dots, where a user's dot can complete purchases for them. It is for ChatGPT Pro subscribers aged 18 and older in the US with eligible US-issued cards ([OpenAI](https://openai.com/index/introducing-chatgpt-wallet/)). OpenAI says it will expand availability but gives no date, and the announcement names no fee or price for Wallet itself.

## Sources

- [Introducing ChatGPT Wallet (OpenAI)](https://openai.com/index/introducing-chatgpt-wallet/)
- [Introducing dots (OpenAI)](https://openai.com/index/introducing-dots/)
- [Commerce in ChatGPT (OpenAI Developers)](https://developers.openai.com/commerce)
