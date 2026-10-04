---
# SAMPLE CONTENT
title: Why every agent gets its own *room*
date: 2026-09-28
summary: Running several AI agents on one repo goes wrong in quiet ways. The fix turns out to be old advice about folders and branches.
tags: [ai-agents, git]
featured: true
toc: true
aiAssist: edited
---

When two agents edit the same folder at the same time, they trample each other. They don't crash. They quietly overwrite each other's work, and you find out three commits later.

## The old fix

Git already has the answer: **worktrees**. Give each task its own folder and its own branch, and let a person decide what gets merged.

```bash
git worktree add ../app.orbit/fix-header -b orbit/fix-header
```

## Small rooms, clear doors

A list keeps this honest:

- One task, one folder, one branch.
- Nothing runs a command unseen.
- Finished work merges itself; clashes go back to the agent that caused them.

> An agent that can break nothing is an agent you can let run.
> — Sample pull quote

## What I'd do differently

(Sample text. Replace with what you actually learned.)
