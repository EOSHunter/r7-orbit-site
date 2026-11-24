---
title: "OpenAI and Cisco open-source Shirudo, *eBPF shields* for unpatched Linux"
seoTitle: "OpenAI and Cisco open-source Shirudo for Linux"
date: 2026-11-24
summary: "Shirudo loads signed eBPF shields that block a vulnerable code path on a running Linux system while a patch is prepared, with no restart."
sourceUrl: https://openai.com/index/introducing-shirudo/
sourceName: OpenAI
topic: security
tags: [security, ai-agents]
cover: /media/news/openai-cisco-shirudo.webp
coverAlt: "Shirudo share image: a soft blurred gradient of orange, peach and coral, a white geometric shield-like mark beside the word shirudo in large bold white lowercase letters in the center, and the white OpenAI wordmark and Cisco logo at the bottom, separated by a thin vertical line"
coverCredit: OpenAI
author: pulsar
draft: false
---

OpenAI and Cisco launched Shirudo on Nov 23, 2026, an open-source runtime that protects running Linux systems with temporary safeguards called shields while teams roll out patches, without a restart ([OpenAI](https://openai.com/index/introducing-shirudo/)).

> [!TIMELINE]
> - **Nov 23** OpenAI and Cisco release Shirudo as open source
> - **Dec 15** A technical deep-dive webinar on Shirudo
>
> Source: [OpenAI](https://openai.com/index/introducing-shirudo/)

## What happened

Shirudo, Japanese for "shield", uses eBPF, a Linux technology that runs small programs at set points inside the operating system. OpenAI says teams can test whether a shield blocks the behavior behind a vulnerability while legitimate requests still get through, then deploy it once an operator approves it ([OpenAI](https://openai.com/index/introducing-shirudo/)). The companies describe four capabilities ([OpenAI](https://openai.com/index/introducing-shirudo/)):

- **Live protection:** shields block vulnerable code paths without a restart, and teams can watch a shield's effect before enforcing it
- **Defense at machine speed:** agents investigate vulnerabilities, draft shields and test them, and security teams control what gets deployed
- **Trusted deployment:** shields are signed and verified before loading
- **Hardware-backed verification:** a Trusted Platform Module (TPM) keeps a record of protections being loaded or removed

In a controlled test, a shield generated with OpenAI's Codex added an input check to Java's Base64 decoder and blocked a Java4Shell exploit attempt on a running Elasticsearch service ([OpenAI](https://openai.com/index/introducing-shirudo/)). Isovalent says the test ran Elasticsearch 9.5.5 ([Isovalent](https://isovalent.com/blog/post/cisco-openai-shirudo/)). The code is under the BSD 2-Clause license, with its BPF programs dual-licensed under BSD and GPL ([OpenAI](https://openai.com/index/introducing-shirudo/)).

## Why it matters

OpenAI says testing and deploying a patch can take days or weeks, and blocking a whole Linux operation in the meantime can take a service offline. Greg Brockman, OpenAI's president, said "finding a bug today doesn't mean you can patch every system tomorrow" ([OpenAI](https://openai.com/index/introducing-shirudo/)). The companies aim to publish tested shields alongside vulnerability disclosures ([OpenAI](https://openai.com/index/introducing-shirudo/)).

The project's README calls Shirudo pre-release and says production targets need a Linux kernel with the signed-loader ABI and shirudo's kernel patches, plus a TPM 2.0 ([GitHub](https://github.com/shirudo-dev/shirudo)). OpenAI, Isovalent and the README don't name supported kernel versions or distributions.

## Sources

- [OpenAI and Cisco introduce Shirudo (OpenAI)](https://openai.com/index/introducing-shirudo/)
- [Cisco and OpenAI introduce Shirudo (Isovalent)](https://isovalent.com/blog/post/cisco-openai-shirudo/)
- [shirudo-dev/shirudo (GitHub)](https://github.com/shirudo-dev/shirudo)
