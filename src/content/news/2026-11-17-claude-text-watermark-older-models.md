---
title: "Older Claude models now carry *Anthropic's text watermark*"
seoTitle: "Older Claude models now carry the text watermark"
date: 2026-11-17
summary: "Text from Claude Opus 4.6, Opus 4.5, Sonnet 4.5 and Haiku 4.5 is now watermarked. With a non-default temperature, top_p or top_k, it might not be."
sourceUrl: https://platform.claude.com/docs/en/release-notes/overview
sourceName: Anthropic
topic: tools
tags: [anthropic, claude]
cover: /media/news/claude-text-watermark-older-models.webp
coverAlt: "Screenshot of Anthropic's Claude Platform release notes page, dark text on white. Under the heading November 16, 2026, a bullet says text from Claude Opus 4.6, Opus 4.5, Sonnet 4.5 and Haiku 4.5 carries Anthropic's text watermark and mentions temperature, top_p and top_k. Below it starts the November 12 entry; a sidebar and a column of dates frame the page."
coverCredit: Anthropic
author: pulsar
draft: false
---

Anthropic's release notes for Nov 16, 2026 say text from Claude Opus 4.6, Claude Opus 4.5, Claude Sonnet 4.5 and Claude Haiku 4.5 now carries Anthropic's text watermark on supported platforms ([Claude docs](https://platform.claude.com/docs/en/release-notes/overview)). If a request to one of these models sets temperature, top_p or top_k to a non-default value, the text might not carry it ([Claude docs](https://platform.claude.com/docs/en/release-notes/overview)).

> [!TIMELINE]
> - **Jul** Anthropic signs the EU Code of Practice on Transparency of AI-Generated Content
> - **Aug 2** The EU requires AI providers serving its market to mark AI-generated content
> - **Aug 14** Anthropic explains how Claude's text watermark works
> - **Nov 16** The release notes add the watermark to four older models
>
> Source: [Anthropic](https://www.anthropic.com/news/claude-text-watermark), [Claude docs](https://platform.claude.com/docs/en/release-notes/overview)

## What happened

The watermark is a pattern in which words Claude picks, detectable by anyone who has the key. Anthropic says it is a version of the SynthID-Text approach Google DeepMind published in Nature in 2024, adds no tokens or hidden characters, and carries no identifying information ([Anthropic](https://www.anthropic.com/news/claude-text-watermark)). Claude models launched in the EU on or after Aug 2, 2026 support marking at launch. The EU AI Act gives older models a transition period ([Claude Help Center](https://support.claude.com/en/articles/16266773-how-claude-marks-ai-generated-content)).

The sources list different models. The release note names four. The Help Center's model table and the docs' sampling section also list Claude Sonnet 4.6 and Claude Opus 3 with the same sampling caveat, with Opus 3 marked for first-party surfaces only ([Claude Help Center](https://support.claude.com/en/articles/16266773-how-claude-marks-ai-generated-content), [Claude docs](https://platform.claude.com/docs/en/build-with-claude/text-watermark)). I could not find when those two started carrying it.

## If you build with Claude

The docs say to leave out temperature, top_p and top_k if you need the watermark. A framework or client library might set them for you, so check its settings and the request body it sends ([Claude docs](https://platform.claude.com/docs/en/build-with-claude/text-watermark)).

## Why it matters

Detection is in private preview for eligible organizations, such as regulators, media, fact-checkers and researchers, and for select enterprises checking their own Claude output. Anthropic plans to expand access over time and gives no date ([Claude Help Center](https://support.claude.com/en/articles/16266773-how-claude-marks-ai-generated-content)). A missing mark doesn't prove a person wrote the text. Short, heavily edited or translated passages may not carry one ([Claude Help Center](https://support.claude.com/en/articles/16266773-how-claude-marks-ai-generated-content)). The Help Center says teams that deploy Claude in their own products should assess what Article 50 requires of them.

## Sources

- [Claude Platform release notes, November 16, 2026 (Anthropic)](https://platform.claude.com/docs/en/release-notes/overview)
- [Text watermark (Anthropic)](https://platform.claude.com/docs/en/build-with-claude/text-watermark)
- [How Claude marks AI-generated content (Claude Help Center)](https://support.claude.com/en/articles/16266773-how-claude-marks-ai-generated-content)
- [How Claude's text watermark works (Anthropic)](https://www.anthropic.com/news/claude-text-watermark)
