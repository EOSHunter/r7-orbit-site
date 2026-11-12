---
title: "DeepMind agents verified *Signal's compiled code* in Lean"
seoTitle: "DeepMind agents verified Signal's compiled code"
date: 2026-11-11
summary: "With AlphaProof Code, Google DeepMind's experts and AI agents proved key security properties of the compiled code behind Signal's protocol in four weeks."
sourceUrl: https://deepmind.google/blog/introducing-alphaproof-code/
sourceName: Google DeepMind
topic: security
tags: [security, ai-agents]
cover: /media/news/deepmind-alphaproof-code-signal.webp
coverAlt: "The Google DeepMind logo and the words Introducing AlphaProof Code: a breakthrough in verifying complex software at depth, in black on white, beside a pale blue-green frosted glass sphere in front of three upright glass panes"
coverCredit: Google DeepMind
author: pulsar
draft: false
---

Google DeepMind introduced AlphaProof Code on Nov 10, 2026, a framework in which human experts and AI agents together proved key security properties of the actual code underlying the Signal protocol, which Signal and Google Messages use ([Google DeepMind](https://deepmind.google/blog/introducing-alphaproof-code/)). The proofs are written in Lean, a language for machine-checked mathematical proofs.

> [!NUMBERS]
> - **6 million+** lines of Lean written by the agents
> - **1%** of the codebase flagged for a human second look
> - **4 weeks** to verify
>
> Source: [Google DeepMind](https://deepmind.google/blog/introducing-alphaproof-code/)

## What happened

DeepMind's researchers worked with a mix of models to turn Signal's security goals into formal specifications, and human experts reviewed every one. Agents powered by Gemini Carbon then wrote the proofs, and Lean checks them automatically ([Google DeepMind](https://deepmind.google/blog/introducing-alphaproof-code/)).

The target was libsignal, Signal's reference implementation, compiled with the standard Rust compiler to AArch64 (64-bit Arm) Linux machine code. The proofs cover the PQXDH handshake and the Triple Ratchet, and establish forward secrecy, authentication, post-compromise security and handshake secrecy ([AlphaProof Code paper](https://google-deepmind.github.io/code-verification)).

As a test, the team put two real, previously fixed bugs back into an isolated copy of Signal's code. Both times, the system produced a machine-checked proof that the buggy version was insecure ([Google DeepMind](https://deepmind.google/blog/introducing-alphaproof-code/)).

## Why it matters

DeepMind says this is the first time the implementation of a widely deployed protocol like this has been formally verified by any method, and that such work historically takes expert teams years ([Google DeepMind](https://deepmind.google/blog/introducing-alphaproof-code/)). Signal's CTO, Ehren Kret, said: "Using AI agents to translate live code into valid Lean theorems is a major breakthrough" ([Google DeepMind](https://deepmind.google/blog/introducing-alphaproof-code/)).

The proofs have limits. They trust Lean's kernel and the security of the cryptographic primitives, and the paper lists what is out of scope, including more than two parties and multi-device state ([AlphaProof Code paper](https://google-deepmind.github.io/code-verification)). DeepMind has open-sourced the specifications and proofs ([Google DeepMind](https://deepmind.google/blog/introducing-alphaproof-code/)).

## Sources

- [Introducing AlphaProof Code: a breakthrough in verifying complex software at depth (Google DeepMind)](https://deepmind.google/blog/introducing-alphaproof-code/)
- [AlphaProof Code: Verifying Signal's Security at the Machine-Code Level (Google DeepMind)](https://google-deepmind.github.io/code-verification)
- [Technical paper, PDF (Google DeepMind)](https://deepmind.google/documents/36/Formal_Verification_of_Signal_4.pdf)
