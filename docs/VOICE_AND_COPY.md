# Voice and copy

How the site sounds. The R7 Orbit app speaks plainly and calmly ("Needs you", "Finished", "Not pushed."); the site keeps that voice, with room to be warmer in essays.

How a piece is *laid out* (recipes, blocks, pictures, density) is [`WRITING_GUIDE.md`](WRITING_GUIDE.md); `npm run check:layout` reads the words to avoid below from this file.

The shared base voice for every writing agent is the `orbit-voice` skill (`.claude/skills/orbit-voice/SKILL.md`); write with it, then apply this file's rules on words, quotes, sources and numbers. See [`WRITING_GUIDE.md`](WRITING_GUIDE.md#voice).

## The voice in five lines

1. **Plain.** Short words, short sentences. If a ten-year-old can't follow the sentence, rewrite it.
2. **Specific.** Numbers, names, what actually happened. "Twenty-four tasks in eleven days," not "a lot of work."
3. **First person.** "I tried", "I got it wrong", "my read". The author is a person, not a brand.
4. **Calm.** No exclamation marks, no hype, no "game-changing", no fake urgency.
5. **Honest about limits.** Say what didn't work and what you don't know. Corrections are published, not hidden.

## Words to avoid

*revolutionary, game-changing, groundbreaking, unlock, supercharge, 10x, seamless, leverage, delve, in today's fast-paced world, the future of, it's important to note, let's dive in, ultimate guide.* If a sentence needs one of these, it has no content yet.

Also avoid: stacked adjectives, rhetorical questions as openers, "AI-powered" as a selling point (everything here is about AI; say what it *does*).

## Headlines

- Sentence case. No trailing full stop unless it is a full sentence that reads as one.
- Say the thing. "Why every agent gets its own room" beats "Rethinking multi-agent collaboration."
- ≤ 70 characters. One phrase may be set in italic brass (wrap it in `*asterisks*` in the title): choose the phrase that carries the idea, not a random adjective.
- Patterns that work: *What I learned from…*, *How X works*, *Why I stopped…*, *X, explained plainly*, *A small tool for…*
- Patterns to avoid: *You won't believe…*, *N things…*, anything with "Here's why."

## Summaries (the `summary` field)

One or two sentences, ≤ 155 characters, that say what the reader will get. Not a teaser. Not a repeat of the title.

> Running several AI agents on one repo goes wrong in quiet ways. The fix turns out to be old advice about folders and branches.

## Microcopy

| Where | Say | Not |
|---|---|---|
| Primary button, home | Start with the latest | Get started now! |
| Search placeholder | Search posts | Type to search… |
| No results | Nothing matches that. Try fewer words, or clear the filters. | 0 results found |
| Copy button | Copy → *Copied* (1.6 s) | Copy to clipboard |
| Read time | 8 min read | Estimated reading time: 8 minutes |
| External link | (icon only; no "opens in a new tab" noise) | |
| 404 title | That page has drifted out of orbit. | Oops! |
| 404 body | It may have moved, or it never existed. Try search, or go back to the latest. | |
| Updated note | Updated Oct 8, 2026 | Last modified on… |
| Stats freshness | Stats from GitHub, refreshed daily | |
| Draft preview banner (dev only) | Draft. Not published. | |
| Status words (projects) | Idea · Building · Shipped · Paused · Archived | In-flight, WIP |

## Tone by kind

- **News:** quick and level. What happened, what it means, what I'd do. End with the take, not a summary.
- **Blog:** the most personal. A clear thesis early; stories and examples; admit mistakes. 800–3000 words.
- **Vlog notes:** a short intro to the video, the chapters, links and resources. Don't transcribe the video in the description.
- **Project:** modest and concrete. What it is, why, how it works, what you'd do differently.
- **Repo:** what it does in one sentence, how to install, how to use. The README does the rest.

## Formatting habits

- Dates: `Oct 3, 2026`. Times: 24-hour only when they matter. Numbers under ten spelled out in prose, numerals in lists and data.
- Use the Oxford comma. Use straight apostrophes in code, curly in prose (the site's smartypants can handle it).
- Link text says where it goes ("the Git worktree docs"), never "click here".
- One idea per paragraph; paragraphs of 1–4 sentences; headings every 200–400 words in long posts.
- Code: give the language, keep examples runnable, show output when it teaches something.
- Quote sparingly; always attribute and link.

## Alt text

Describe what the image *shows and why it's there*, in a sentence. "Screenshot of R7 Orbit with three agent cards around the R7 mark, one glowing to ask for approval." Not "image of app". Decorative images get `alt=""`.

## AI-assisted writing

AI-written pieces are credited to R7, never to Hunter (see "Agent-authored footer note" below). If the author uses AI to draft or edit a piece the author writes, the house rule is: **the author has read it, checked every claim and code sample, and stands behind it.** If disclosure is on (see `DECISIONS.md`), use one quiet line under the byline: *"Drafted with AI, edited and checked by me."* Never publish unreviewed AI output, never invent quotes, sources or benchmarks, never present a model's claim as tested unless it was.

## Agent-authored footer note

Interim: the author will supply final wording. Built only from sentences the author wrote on the About page; nothing else has been added.

Shown at the end of every post whose author is an AI agent (today, R7), and never on a person's post. It is the `note` field of `src/content/authors/r7.json`; `src/lib/authors.vitest.ts` fails when that field and the quote below differ, so change both together.

> R7 is the AI agent that writes some of what you read here. It's not a person, it's an agent I run in R7 Orbit and give a brief for each piece. If you spot a mistake, tell me. I'll correct it, with a dated note at the bottom of the post.

An agent's byline carries an **AI-written** label (icon and words, no colour of its own). The label and this note are the disclosure for an agent's post, so the "How this was made" line (`aiAssist`) is not shown there as well.

## Naming

- The site and brand name is written **R7 Orbit** (or the name chosen in `DECISIONS.md`). The wordmark in the header is uppercase and letter-spaced by CSS only; in text it is "R7 Orbit".
- Product names as their owners write them: Claude, Codex, GitHub, YouTube, TypeScript, Electron.
- "Agent" for an AI worker; "task" for a unit of work given to it; "worktree" for the separate git folder.
