---
title: "Signal blocks screenshots to keep *OS AI agents* out of chats"
seoTitle: "Signal blocks screenshots to stop OS AI agents"
date: 2026-11-22
summary: "Signal now blocks screenshots on iOS 27, and on Android when an AI assistant reads the screen, to keep OS-level AI agents from capturing chats."
sourceUrl: https://signal.org/blog/protecting-your-privacy/
sourceName: Signal
topic: security
tags: [ai-agents, security, google]
cover: /media/news/signal-blocks-os-ai-agents.webp
coverAlt: "Signal's header image for the post: on a cream background, the outline of a phone with a black screen, and over it the words \"SIGNAL WAS HERE\" in hand-painted spray-paint letters that fade from orange through blue to pink, with paint drips running down"
coverCredit: Signal
author: pulsar
draft: false
---

Signal will block screenshots in its app on iOS 27, and on Android when it detects an AI assistant trying to read the screen, so that AI agents built into the operating system can't capture Signal chats ([Signal](https://signal.org/blog/protecting-your-privacy/)). Meredith Whittaker announced it on Nov 20, 2026.

> [!NOTE]
> People who want screenshots can turn the protection off in Signal's settings. Signal says that will potentially expose their messages, and their contacts' messages, to these agents ([Signal](https://signal.org/blog/protecting-your-privacy/)). Engadget reports the iOS setting is called "Block Siri AI" and is on by default ([Engadget](https://www.engadget.com/2323574/signal-now-blocks-screenshots-by-default-to-stymie-ai-agents/)).

## What happened

Signal names Gemini Intelligence with Google Gemini and Onscreen Awareness with Siri AI. It says these agents "scan" what is on your screen, so your Signal data is captured and made available to them ([Signal](https://signal.org/blog/protecting-your-privacy/)). Last year Signal used the same screenshot block against Microsoft's Recall on Windows 11 ([Signal](https://signal.org/blog/protecting-your-privacy/)). On Android, CyberInsider reports that Signal turns on its existing Screen security option when it detects an assistant, and can detect that only on some Android versions ([CyberInsider](https://cyberinsider.com/signal-blocks-screenshots-ios-27-android-ai-assistants/)).

Signal calls its fix incomplete. Blocking screenshots does not stop an agent from reading content already on the device through the filesystem, and Signal says it is currently unable to offer the protection on macOS ([Signal](https://signal.org/blog/protecting-your-privacy/)). It also wants tools to stop third-party agents, such as Meta's Muse, from reaching app data through the deep permissions users are encouraged to grant during setup. Signal says that in many cases these agents use accessibility settings ([Signal](https://signal.org/blog/protecting-your-privacy/)).

## Why it matters

An agent that works by reading the screen can no longer capture Signal on iOS 27 unless the user turns the protection off. Signal asks Apple, Google and Microsoft for two remedies ([Signal](https://signal.org/blog/protecting-your-privacy/)):

1. An easy, documented way for developers to opt an app out of AI data access and processing, including screen reading, filesystem access, notifications and APIs.
2. Better documentation and technical specifications on how these agents access and process data.

Signal says Google and Apple are engaging with it and that it hopes to share more soon ([Signal](https://signal.org/blog/protecting-your-privacy/)). None of the sources includes a statement from Apple, Google or Microsoft. They also don't say which Android versions get the block, or which Signal app version ships it.

## Sources

- [Signal is Serious About Protecting Your Privacy (Signal)](https://signal.org/blog/protecting-your-privacy/)
- [Signal now blocks screenshots by default to stymie AI agents (Engadget)](https://www.engadget.com/2323574/signal-now-blocks-screenshots-by-default-to-stymie-ai-agents/)
- [Signal blocks screenshots to keep Siri and Gemini out of private chats (CyberInsider)](https://cyberinsider.com/signal-blocks-screenshots-ios-27-android-ai-assistants/)
