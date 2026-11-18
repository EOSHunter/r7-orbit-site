---
title: "Apps built on Claude can now bill *the customer's own organization*"
seoTitle: "Anthropic launches Linked billing for API apps"
date: 2026-11-18
summary: "Anthropic launched Linked billing in beta. An app built on the Claude API can bill a customer's Claude usage to that customer's own Claude organization."
sourceUrl: https://platform.claude.com/docs/en/release-notes/overview
sourceName: Anthropic
topic: tools
tags: [anthropic, claude]
cover: /media/news/claude-linked-billing.webp
coverAlt: "Screenshot of the Linked billing page in the Claude Platform Docs, dark text on white. Under the breadcrumb Admin, Claude Platform OAuth, the title reads Linked billing. A yellow warning box says Claude Platform OAuth is a Beta Service that might not be suitable for production use. Below it are the opening paragraphs and the heading Eligible customers and endpoints. The left sidebar lists admin pages with Linked billing highlighted, and the right column lists the setup steps from Step 1, Create the app, to Step 8."
coverCredit: Anthropic
author: pulsar
draft: false
---

Anthropic launched Linked billing in beta on Nov 17, 2026. Customers of an app built on the Claude API can now pay for their Claude usage there through their own Claude organization ([Claude release notes](https://platform.claude.com/docs/en/release-notes/overview)).

> [!NOTE]
> Linked billing uses the `user-profiles-billing-2026-10-01` beta header. Once a customer links, the app sets `billing_policy` on each `/v1/messages` or `/v1/chat/completions` request to choose who pays ([Claude release notes](https://platform.claude.com/docs/en/release-notes/overview)).

## What happened

A customer links their Claude organization to the app once, through an OAuth approval page (OAuth is the standard sign-in and approval flow). The person who approves needs the Admin or Billing role. Anthropic issues these apps no client secrets. The app's back end signs in with tokens from its own identity provider ([Claude docs](https://platform.claude.com/docs/en/manage-claude/oauth-apps/organization-billing-connections)). Within one app, a customer's organization links to only one user profile, the app's record for that customer ([Claude docs](https://platform.claude.com/docs/en/manage-claude/oauth-apps/organization-billing-connections)).

In the Claude Console, customers can set a spend cap for the app or unlink it ([Claude release notes](https://platform.claude.com/docs/en/release-notes/overview)). The cap is monthly, in US dollars. Anthropic doesn't notify the app when a customer unlinks ([Claude docs](https://platform.claude.com/docs/en/manage-claude/oauth-apps/organization-billing-connections)).

## What builders have to check

- **Who is eligible:** organizations that pay Anthropic directly, prepaid or invoiced. Organizations billed through AWS, Google Cloud or Azure marketplaces, or with only a Claude subscription plan, get a 403 `user_profile_not_billable`.
- **Whose terms apply:** requests run in the app's organization, with its rate limits, model access, data retention and encryption keys. The customer's zero data retention, BAA and customer-managed keys don't apply. The guide says not to link customers that need HIPAA, FERPA or CMEK coverage.
- **What can't bill the customer:** Message Batches, and billable code execution features on `/v1/messages`.
- **Credits that can't pay:** some promotional credits, including the monthly API credits that come with Claude Max, Ultra and Team plans, and credits from Anthropic's partner, VC and startup programs. If nothing can pay, the API can refuse with a 402.

Source: [Claude docs](https://platform.claude.com/docs/en/manage-claude/oauth-apps/organization-billing-connections).

## Why it matters

The guide is for developers whose users are mostly Claude Platform customers. A request marked for the customer is either billed to them or refused, and Anthropic says it never silently bills the app instead ([Claude docs](https://platform.claude.com/docs/en/manage-claude/oauth-apps/organization-billing-connections)). Claude Platform OAuth is a Beta Service whose behavior can change, and Anthropic says it might not be suitable for production use ([Claude docs](https://platform.claude.com/docs/en/manage-claude/oauth-apps/organization-billing-connections)). Neither page gives a date for general availability.

## Sources

- [Claude Platform release notes, November 17, 2026 (Anthropic)](https://platform.claude.com/docs/en/release-notes/overview)
- [Linked billing (Anthropic)](https://platform.claude.com/docs/en/manage-claude/oauth-apps/organization-billing-connections)
