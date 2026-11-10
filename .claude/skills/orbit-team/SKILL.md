---
name: orbit-team
description: Hands writing and image work for r7orbit.io to the right Orbit agent, each running as its own subagent, then has Parallax fact-check the result separately before anything reaches Hunter. Use whenever Hunter asks for a news item, a post about a game, a project/app/game/repo page or build log, a vlog page or video script, the weekly newsletter, an essay/how-to/notes piece, an edit of an agent's draft, a post's featured image, or a fact-check, and whenever he names an agent ("have Orion write...", "get Mercury to do this week's issue", "Parallax, check this").
---

# Orbit team: who does the work

The agents on the About page are real subagents in `.claude/agents/<slug>.md`. This skill is the dispatcher: it decides who does a piece, starts that agent with the Agent tool (`subagent_type: "<slug>"`), and always ends with Parallax checking the work in a separate subagent that never saw the writer's reasoning. You (the main session) are the orchestrator. You do not write the piece yourself and you do not fact-check it yourself.

If `<slug>` is not in your Agent tool's list (the session started in a folder without `.claude/agents/`, such as a scheduled task that works in a worktree), use `subagent_type: "general-purpose"` and begin the prompt with: "You are <Name>. Read `<repo>/.claude/agents/<slug>.md` and follow it as your instructions. Its paths are relative to `<repo>`: use full paths, and `cd <repo>` before any command." For Parallax, add: "Never edit, write or create a file."

The steps of making a page (inputs, front matter, files, verify, report) stay in the `add-content` skill; load it too when the piece is a site page. The team is `docs/TEAM.md`.

## 1. Pick the agent

| Hunter asks for                                                                                | Agent (`subagent_type`) | Output                                                              |
| ---------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------- |
| A news item (`/news/`)                                                                         | `pulsar`                | `src/content/news/<slug>.md`                                        |
| A blog post about a game (playing it, a review, a launch post)                                 | `orion`                 | `src/content/blog/<slug>.mdx`                                       |
| A project, app or game **page**, a repo page, a build log entry                                | `kepler`                | `src/content/projects/` or `src/content/repos/`                     |
| A vlog page, or a script for a video                                                           | `hubble`                | `src/content/vlogs/<slug>.md`; a script is a draft file, not a page |
| The weekly newsletter issue                                                                    | `mercury`               | `newsletter/issues/<send date>.md`                                  |
| An essay, a how-to, notes, anything with no agent of its own; or editing another agent's draft | `r7`                    | The kind's own folder                                               |
| The featured image and hover clip for a post                                                   | `pictor`                | Files in R7 Orbit Studio, for Hunter to approve                     |
| A fact-check, on its own or as the last step of any of the above                               | `parallax`              | Notes only, never edits                                             |

Tie-breaks:

- A game's own page (play button, status) is Kepler's; a post _about_ playing or building it is Orion's.
- A build story about a tool or app that is not a game is Kepler (build log on the project) or R7 (a long essay). Ask Hunter which he wants if he did not say.
- Hunter naming an agent wins over the table.
- One request can need several agents: a launch can be Kepler (the page) + Orion (the post) + Pictor (the image). Start the writers in parallel in one message when they do not depend on each other; Pictor needs the finished post, so it goes after its writer.

## 2. Gather the inputs, then brief the agent

Before starting anyone, collect what the agent's guide lists as inputs (`.claude/skills/add-content/agents/<slug>.md`, "Inputs"; for a page, also `add-content` step 1 and `checklists/inputs.md`). Ask Hunter for what is missing in one short message. Don't start an agent on guesses: a writer told to fill gaps will fill them.

The brief is the only context the agent gets. Put in it:

- What to make, the kind, and the file path to write (check `src/content/<kind>/` for a slug clash first).
- Every input, in full: Hunter's notes word for word, sources as links, screenshot paths, the YouTube id and duration, the repo path, the date range for a newsletter.
- Hunter's decisions: draft or not, date, tags, featured, anything he said about tone or length.
- Anything he said this session that the agent's guide does not cover.

Don't put your own draft, outline or opinion of the piece in the brief: the agent works from Hunter's material.

## 3. Let the agent write

The agent loads its own guide and the `orbit-voice` skill, writes the file, runs `npm run check:layout` on it (site pages), and returns: the file path, a **claims table** (claim, line, source), each picture's origin, and the questions it could not answer. Keep its agent id: fixes go back to the same agent with `SendMessage`, not to a fresh one.

## 4. Parallax checks it (always)

Start `parallax` as a new subagent. Give it only:

- The file path.
- The writer's claims table and picture list.
- The source material Hunter supplied (notes, transcript, links), so it can check claims against them.
- The kind of piece (a newsletter issue skips its items 8 and 9).

Not the writer's reasoning, not your view of the piece. Parallax reports a table (claim, source, verdict, fix) and a `Parallax: pass` or `Parallax: fail, N fixes open` line. It does not edit.

If Parallax fails rows: send the failed rows, as Parallax wrote them, to the writer (`SendMessage` to its id). The writer fixes them and returns the changed lines. Send only those rows back to Parallax (`SendMessage` to Parallax's id). Stop after two rounds: anything still failing goes to Hunter as open, with Parallax's note.

`unverifiable` rows are never fixed by guessing: they go to Hunter to decide.

Skip Parallax only when Hunter says so in this session, and say so in the report. Pictor's images are not fact-checked by Parallax except for alt text and origin, which Parallax checks once the image is on a post.

## 5. Verify and report

For a site page, run `add-content` step 4 yourself (one heavy job at a time on Hunter's computer: the build, then only the specs the page needs; GitHub's checks run the full suite). Then report to Hunter, in this order:

1. `Parallax: pass` or `Parallax: fail, N open (lines ...)`, at the top.
2. Who wrote what: agent, file path, front matter (`author: <slug>`; a newsletter issue and a script have none).
3. What you verified and what you did not.
4. What Hunter must do: approve the draft, supply a missing picture or source, answer the writer's questions, decide the `unverifiable` rows.

Nothing goes live from here. Every piece stays `draft: true` (a newsletter issue `status: draft`, then `ready` after Parallax passes) until Hunter publishes or sends it. No pushing, no merging, no sending.

The one exception: a brief or scheduled task from Hunter that sets another approval route, such as a pull request whose merge is his approval (the daily news task), is followed as written, with `draft: false` and a pushed branch if it says so. It never extends to merging or pushing to `main`.

## Rules that hold for every agent

- Credit goes to the agent that wrote it, never to Hunter; no `aiAssist` on an agent's post.
- No invented facts, quotes, numbers, opinions, sources or dates. Hunter's notes, the repo, the transcript and opened sources are the only sources.
- Agents never write or edit their own bio, avatar or any file in `src/content/authors/`.
- One agent per file at a time: never start two agents that write the same file.

## Adding an agent

Besides the three edits in `docs/TEAM.md`, "Adding an agent later": add `.claude/agents/<slug>.md` (copy a writer's file and change the name, description, guide path and output), and a row in the table in step 1 above.
