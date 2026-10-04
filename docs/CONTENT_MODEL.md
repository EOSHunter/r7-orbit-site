# Content model

What a post is made of. Content is **Markdown (or MDX) files with frontmatter**, one file per post, in the repo. Examples are in `content-examples/`.

```
src/content/
  news/       2026-10-03-open-weights-model-lands.md
  blog/       why-every-agent-gets-its-own-room.md
  vlogs/      i-built-a-game-with-a-team-of-ai-agents.md
  projects/   r7-orbit.md
  repos/      orbit-the-game.md
  authors/    hunter.json          (optional; one author to start)
  site.json                        (site name, tagline, links: see below)
public/
  media/<kind>/<slug>/...          (covers, screenshots; or use src/assets for optimised images)
```

The **file name is the slug** (the last part of the URL). Keep it lowercase, words joined with hyphens, no dates (except for news, where a date prefix helps sorting by eye; strip it from the URL if you like).

## Fields common to every kind

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | Plain text. ≤ 70 characters reads best; ≤ 60 fits a search result. One phrase may be wrapped in `*asterisks*` to be shown in italic brass (e.g. `Why every agent gets its own *room*`); the site strips them for `<title>` and feeds |
| `date` | date (`YYYY-MM-DD`) | yes | Publish date; future dates are hidden until then |
| `updated` | date | no | Set when the post is materially changed; shown as "Updated Oct 8" |
| `summary` | string | yes | 1–2 sentences, ≤ 155 characters. Used on cards, in the meta description and in feeds |
| `tags` | string[] | no | 1–4 lowercase tags, hyphenated (`ai-agents`, `evals`, `git`). Reuse existing tags before inventing |
| `cover` | image path | no | 16:9, ≥ 1280×720. If absent, the plate placeholder is shown (never a stock photo) |
| `coverAlt` | string | if `cover` | Describe what is in the image. Empty string only if purely decorative |
| `featured` | boolean | no | Pins to the top of the home page. **At most one at a time** (the build should warn if two) |
| `draft` | boolean | no | `true` = built in dev, not published |
| `readTime` | number (minutes) | no | Computed from the body if absent (≈ 220 words/min) |
| `author` | string (author id) | no | Defaults to the site author |
| `canonicalUrl` | URL | no | Only when the post was first published elsewhere |
| `aiAssist` | `'none' \| 'edited' \| 'drafted'` | no | If the author wants the "How this was made" line (see `DECISIONS.md` §C). Shown as a quiet note under the byline |

## Extra fields by kind

### News (`src/content/news/`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `sourceUrl` | URL | yes | The thing being discussed |
| `sourceName` | string | yes | e.g. "Anthropic", "arXiv", "The Verge" |
| `take` | string | no | One-sentence verdict shown as a pull line ("My read: …") |

Body: 150–500 words. Say what happened, why it matters (or doesn't), and what the author would do about it.

### Blog (`src/content/blog/`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `series` | string | no | Name of a series; posts with the same value link to each other |
| `seriesOrder` | number | if `series` | 1, 2, 3… |
| `toc` | boolean | no | Default `true` when the post has 3+ `h2` headings |

Body: Markdown/MDX. Headings from `##` down (the title is the `h1`). See "Markdown the site understands" below.

### Vlog (`src/content/vlogs/`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `youtubeId` | string | yes (or `videoUrl`) | The 11-character id, e.g. `dQw4w9WgXcQ` |
| `videoUrl` | URL | alt | For non-YouTube hosts |
| `duration` | string (`m:ss` or `h:mm:ss`) | yes | Shown on the poster and in structured data |
| `poster` | image path | no | Falls back to `cover`, then to YouTube's thumbnail (downloaded at build, not hotlinked) |
| `chapters` | `{ t: string, title: string }[]` | no | `t` is `m:ss`. Rendered as a list that seeks the video when clicked |
| `transcript` | boolean | no | `true` if the body contains a `## Transcript` section; it is placed in a `<details>` |

Body: the written notes, links and resources mentioned in the video.

### Project (`src/content/projects/`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `status` | `'idea' \| 'building' \| 'shipped' \| 'paused' \| 'archived'` | yes | Shown with the status mark: building = turning arc, shipped = done dot, paused/archived = idle |
| `stack` | string[] | no | Technologies, shown as mono chips |
| `liveUrl` | URL | no | |
| `repoUrl` | URL | no | If it is also a `repo` entry, set `repo` instead |
| `repo` | string (`owner/name`) | no | Links to the repo page and pulls its stats |
| `started` | date | no | |
| `shipped` | date | no | |
| `role` | string | no | "Solo", "Design + code", etc. |
| `gallery` | `{ src, alt, caption? }[]` | no | Screenshots |
| `timeline` | `{ date, text }[]` | no | Short changelog entries |

Body sections the template expects (as `##` headings): **Why I built it**, **How it works**, **What I learned**. Others are fine; these three get anchors in the page.

### Repo (`src/content/repos/`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `repo` | string (`owner/name`) | yes | e.g. `EOSHunter/orbit-the-game` |
| `homepage` | URL | no | Overrides the GitHub "website" field |
| `readme` | `'github' \| 'local'` | no | `github` (default) renders the repo README fetched at build time; `local` uses the body of this file |
| `install` | string | no | A one-line install/clone command for the copy button |
| `relatedProject` | string (project slug) | no | |

**Fetched at build time from GitHub** (never typed by hand, never fetched in the visitor's browser): `description`, `language`, `stars`, `forks`, `license`, `topics`, `pushedAt`, `latestRelease`. The build must tolerate GitHub being unreachable or rate-limited: fall back to the last good data (cache it in `.cache/github.json`, not in git) and never fail the build because of it.

## Typed schema (Astro content collections)

If using Astro, `src/content.config.ts`. This is a starting point written from this document; it has not been run, so expect to adjust import paths to the installed Astro version.

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const common = {
  title: z.string().max(90),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  summary: z.string().max(180),
  tags: z.array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)).max(6).default([]),
  cover: z.string().optional(),
  coverAlt: z.string().optional(),
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
  readTime: z.number().int().positive().optional(),
  author: z.string().optional(),
  canonicalUrl: z.string().url().optional(),
  aiAssist: z.enum(['none', 'edited', 'drafted']).optional(),
};
const col = (dir: string, extra: z.ZodRawShape = {}) =>
  defineCollection({ loader: glob({ pattern: '**/*.{md,mdx}', base: `./src/content/${dir}` }), schema: z.object({ ...common, ...extra }) });

export const collections = {
  news: col('news', { sourceUrl: z.string().url(), sourceName: z.string(), take: z.string().optional() }),
  blog: col('blog', { series: z.string().optional(), seriesOrder: z.number().int().optional(), toc: z.boolean().optional() }),
  vlogs: col('vlogs', {
    youtubeId: z.string().length(11).optional(), videoUrl: z.string().url().optional(), duration: z.string().regex(/^(\d+:)?\d{1,2}:\d{2}$/),
    poster: z.string().optional(), chapters: z.array(z.object({ t: z.string(), title: z.string() })).optional(), transcript: z.boolean().optional(),
  }),
  projects: col('projects', {
    status: z.enum(['idea', 'building', 'shipped', 'paused', 'archived']), stack: z.array(z.string()).default([]),
    liveUrl: z.string().url().optional(), repoUrl: z.string().url().optional(), repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/).optional(),
    started: z.coerce.date().optional(), shipped: z.coerce.date().optional(), role: z.string().optional(),
    gallery: z.array(z.object({ src: z.string(), alt: z.string(), caption: z.string().optional() })).default([]),
    timeline: z.array(z.object({ date: z.coerce.date(), text: z.string() })).default([]),
  }),
  repos: col('repos', {
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/), homepage: z.string().url().optional(), readme: z.enum(['github', 'local']).default('github'),
    install: z.string().optional(), relatedProject: z.string().optional(),
  }),
};
```

## Site-level data: `src/content/site.json`

```json
{
  "name": "R7 Orbit",
  "tagline": "Field notes on building with AI",
  "description": "News, builds and the things in between: writing, videos, projects and code about building with AI.",
  "url": "https://example.com",
  "author": { "name": "Your Name", "bio": "Two or three sentences.", "photo": null, "email": "hello@example.com" },
  "links": { "github": "https://github.com/EOSHunter", "youtube": "", "x": "", "linkedin": "", "bluesky": "", "rss": "/rss.xml" },
  "nav": ["Latest", "News", "Blog", "Vlogs", "Projects", "Repos", "About"],
  "newsletter": { "provider": "buttondown", "formAction": "" }
}
```

Everything in the templates marked as placeholder (name, tagline, URL, author, links) must come from this file. Nothing about the author is hard-coded in components.

## Markdown the site understands

Standard Markdown plus:

- **Code blocks** with a language (` ```ts `); the site adds colours from the palette and a copy button. A `title="file.ts"` attribute shows a filename bar.
- **Diff blocks** (` ```diff `): `+` lines in `--st-done`, `-` lines in `--st-failed-text`.
- **Callouts**: a blockquote starting with `> [!NOTE]`, `> [!TIP]` or `> [!WARNING]` becomes a `.callout` (brass for NOTE and TIP, `.bad` for WARNING).
- **Figures**: an image followed by an italic line becomes `<figure>` with `<figcaption>`.
- **Pull quotes**: a blockquote with a final `— Name` line uses the serif quote style.
- **Footnotes**, tables and task lists as in GitHub-flavoured Markdown.
- **Headings** get anchor links; the table of contents is built from `##` and `###`.
- **Links** to other posts use the slug path (`/blog/why-every-agent-gets-its-own-room/`); external links open normally (no `target="_blank"` unless the author asks) and get `rel="noopener"` when they do.
- **Images**: always with alt text; width/height are read from the file.

## Tags

- Lowercase, hyphenated, singular where possible (`agent`, not `agents`, unless the plural is the usual term).
- A tag page `/tags/<tag>/` exists once a tag has two or more posts.
- Start with a small controlled list and add deliberately: `ai-agents`, `claude`, `codex`, `evals`, `git`, `tooling`, `open-weights`, `prompting`, `game-dev`, `typescript`, `electron`, `video`.

## Dates, read time, numbers

- Files: ISO `2026-10-03`. UI: `Oct 3, 2026` (use `Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })`). Machine-readable `<time datetime="2026-10-03">`.
- Read time: `8 min read` (round up, minimum 1).
- Counts: `1,204` with a thousands separator; `1.2k` only on tight cards.
- Durations: `12:48`.

## Rules that keep it working

1. A post is never published without `title`, `date`, `summary`.
2. Slugs never change after publishing; if they must, add a redirect.
3. Every content image has alt text.
4. Nothing in the body hot-links an image or script from another site.
5. No two posts have the same `title` + `kind`.
