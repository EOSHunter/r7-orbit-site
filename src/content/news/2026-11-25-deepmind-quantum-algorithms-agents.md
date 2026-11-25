---
title: "Gemini agents cut quantum algorithm costs, *each result proved in Lean*"
seoTitle: "DeepMind agents improve quantum algorithms"
date: 2026-11-25
summary: "Google DeepMind says teams of Gemini 4 agents made known quantum algorithms cheaper to run, with every result proved in the Lean theorem prover."
sourceUrl: https://deepmind.google/blog/finding-faster-quantum-algorithms-with-agents-and-formal-verification/
sourceName: Google DeepMind
topic: trends
tags: [google, ai-agents]
cover: /media/news/deepmind-quantum-algorithms-agents.webp
coverAlt: "Google DeepMind's share image for the post: on the left, on white, the black DeepMind logo and the title Finding faster quantum algorithms with agents and formal verification in black type; on the right, a dark blue panel with a glowing sphere drawn in particles, crossed by orbit rings and a vertical axis with an L-shaped hand like a clock face, over streaks of blue and green light"
coverCredit: Google DeepMind
author: pulsar
draft: false
---

Google DeepMind said on Nov 23, 2026 that teams of Gemini 4 agents found more efficient versions of several known quantum algorithms, and that every result was proved correct in Lean, a program for checking mathematical proofs ([Google DeepMind](https://deepmind.google/blog/finding-faster-quantum-algorithms-with-agents-and-formal-verification/)). The work was done with Google Quantum AI.

> [!NUMBERS] Cost reductions DeepMind reports against earlier versions
> - **11.8x** lower computing cost for a circuit that computes a property of inertial confinement fusion
> - **8x** cheaper simulation of a common light-sensitive molecule
> - **2.5x** improvement for simulating Cytochrome P450, an enzyme that breaks down most human medicines
> - **290x** speedup for an arcsin routine, an arithmetic building block used to load numbers into quantum states
>
> Source: [Google DeepMind](https://deepmind.google/blog/finding-faster-quantum-algorithms-with-agents-and-formal-verification/)

## What happened

DeepMind gave each problem to separate agent teams that worked independently. An idea went into a shared notebook only after it was verified in Lean, and the teams met at a "virtual conference" every four hours to compare and debate ideas. The post also reports a 2.57x speedup for one implementation of Grover's algorithm, a quantum search method ([Google DeepMind](https://deepmind.google/blog/finding-faster-quantum-algorithms-with-agents-and-formal-verification/)).

Some results also need fewer qubits, the units of a quantum computer's memory. The fusion circuit went from 5,650 to 4,338 error-corrected qubits, and the Cytochrome P450 simulation from 481 to 333 qubits ([Google DeepMind](https://deepmind.google/blog/finding-faster-quantum-algorithms-with-agents-and-formal-verification/)).

The paper, [Discovering formally verified quantum programs with AI](https://arxiv.org/abs/2611.09822), lists 25 authors. DeepMind released its Lean library for quantum algorithms, with problem specifications and the verified solutions, on [GitHub](https://github.com/google-deepmind/formal-quantum-computation) with its code under the Apache 2.0 license. The repository keeps the programs from the paper on a separate `discoveries` branch.

## Why it matters

These circuits can't be tested on classical computers or on today's small quantum processors, so DeepMind proved each one mathematically instead ([Google DeepMind](https://deepmind.google/blog/finding-faster-quantum-algorithms-with-agents-and-formal-verification/)). All the figures are DeepMind's own, and the post cites no outside check of them.

The post says running these algorithms in full scientific simulations would still need more resources than the first error-corrected quantum computers are likely to provide. It also credits the researchers' own quantum algorithms expertise, and the way they set up the agent teams, as central to the results ([Google DeepMind](https://deepmind.google/blog/finding-faster-quantum-algorithms-with-agents-and-formal-verification/)).

## Sources

- [Finding faster quantum algorithms with agents and formal verification (Google DeepMind)](https://deepmind.google/blog/finding-faster-quantum-algorithms-with-agents-and-formal-verification/)
- [Discovering formally verified quantum programs with AI (arXiv)](https://arxiv.org/abs/2611.09822)
- [formal-quantum-computation (GitHub)](https://github.com/google-deepmind/formal-quantum-computation)
