# Content model

What a post is made of. Content is **Markdown (or MDX) files with frontmatter**, one file per post, in the repo. Examples are in `content-examples/`.

```
src/content/
  news/       2026-10-03-a-short-headline.md
  blog/       a-post-about-something.md
  vlogs/      a-video-about-something.md
  projects/   a-project.md
  repos/      a-repo.md
  pages/      about.md             (a page built from blocks: see "Pages" below)
  authors/    hunter-newton.json, r7.json   (who a post is credited to: see "Authors")
  site.json                        (site name, tagline, links: see below)
public/
  media/<kind>/...                 (covers, posters, gallery, Markdown-body pictures, one folder per kind; shrunk at build)
```

The **file name is the slug** (the last part of the URL). Keep it lowercase, words joined with hyphens, no dates (except for news, where a date prefix helps sorting by eye; strip it from the URL if you like).

## Fields common to every kind

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | Plain text. ≤ 70 characters reads best; ≤ 60 fits a search result. One phrase may be wrapped in `*asterisks*` to be shown in italic brass (e.g. `Why every agent gets its own *room*`); the site strips them for `<title>` and feeds |
| `seoTitle` | string | no | Shorter title for the browser tab, search results and `og:title`, when the title is too long. At most 49 characters (60 minus ` · R7 Orbit`; the build fails with a readable message if it is longer). Without it the title is used, and the headline and JSON-LD always keep the real title |
| `date` | date (`YYYY-MM-DD`) | yes | Publish date; future dates are hidden until then (see "Drafts and scheduled posts") |
| `updated` | date | no | Set when the post is materially changed; shown as "Updated Oct 8" |
| `summary` | string | yes | 1–2 sentences, ≤ 155 characters. Used on cards, in the meta description and in feeds |
| `tags` | string[] | no | 1–4 lowercase tags, hyphenated (`ai-agents`, `evals`, `git`). Reuse existing tags before inventing |
| `cover` | image path | no | 16:9, ≥ 1280×720. If absent, the plate placeholder is shown (never a stock photo) |
| `coverAlt` | string | if `cover` | Describe what is in the image. Empty string only if purely decorative |
| `featured` | boolean | no | Pins to the top of the home page. **At most one at a time** (the build should warn if two) |
| `draft` | boolean | no | Default `false`. `true` = hidden in production, shown in dev with a "Draft" badge. See "Drafts and scheduled posts" |
| `readTime` | number (minutes) | no | Computed from the body if absent (≈ 220 words/min) |
| `author` | string (author slug) | no | The slug of a file in `src/content/authors/`. Defaults to `hunter-newton`. A slug that does not exist fails the build, naming the post and listing the authors. AI-written pieces are credited to `r7`, never to Hunter |
| `canonicalUrl` | URL | no | Only when the post was first published elsewhere |
| `aiAssist` | `'none' \| 'edited' \| 'drafted'` | no | If the author wants the "How this was made" line (see `DECISIONS.md` §C). Shown as a quiet note under the byline |

## Authors

One JSON file per author in `src/content/authors/`, named by its slug (`hunter-newton.json`, `r7.json`). Editable in the admin (**Authors**). Every post names one through `author`; the byline, the author page `/authors/<slug>/`, the "By author" filter, the structured data and the feeds follow from it.

| Field | Type | Required | Notes |
|---|---|---|---|
| `slug` | string | yes | Must equal the file name (the build says so if not). The address is `/authors/<slug>/` |
| `kind` | `'person' \| 'agent'` | yes | A person is marked up as a `Person`, an agent as an `Organization`, and an agent's posts get the **AI-written** label and the footer note |
| `name` | string | agent | A person without one is named in `author.name` in `src/data/site.json` |
| `subtitle` | string, 60 characters at most | no | Shown under the name, e.g. `Orbit AI Agent` |
| `bio` | string | agent | A person without one uses `author.bio` in `site.json` |
| `avatar` | path | no | A person without one uses `author.photo` in `site.json`, or initials when that is empty. An agent uses the R7 mark, `/assets/r7-mark.svg` |
| `note` | string | no | Footer note, shown at the end of every post by this author. Used for agents, never shown on a person's post. R7's text is interim and lives in `docs/VOICE_AND_COPY.md` too |

Hunter's name, bio and photo exist once, in `site.json`: the author file holds only `slug` and `kind`. The About page reads the same place.

## Drafts and scheduled posts

A post is **hidden in production builds** if `draft: true` **or** its `date` is later than today (UTC calendar day, checked at build time). Today's date is published. The rule lives in one place, `src/lib/content.ts` (`isPublished` / `filterPublished`), applied by `getPosts` and `getAllPosts` in `src/lib/content-queries.ts`. Every page, archive, tag page, pagination, home/latest, related, prev/next and series list, RSS and per-kind feed, the sitemap and JSON-LD read through those, so a hidden post has no page, no feed entry and nothing for Pagefind to index (it indexes the built `dist/`). Use `getPosts`/`getAllPosts`, never `getCollection` directly.

**A scheduled post does not publish itself.** It goes live on the first build/deploy on or after its date. For it to appear on time, rebuild daily (a host cron or a GitHub Actions `schedule`; see `BUILD_PLAN.md`).

In `npm run dev`, drafts and scheduled posts are shown so they can be previewed, each with a brass **Draft** or **Scheduled for Oct 12, 2026** badge on cards and on the post page. The badge never renders in a production build.

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
| `subtitle` | string | no | Up to 140 characters. One line under the title (written by the admin; not yet shown on the page) |
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
| `playUrl` | https URL | no | Makes the project **playable** (see below). Anything but `https://` fails the build |
| `playMode` | `'embed' | 'link'` | no | Default `embed`. `link` shows only a button that opens the game in a new tab |
| `playAspect` | string `w:h` | no | Default `16:9`. The shape of the game frame, e.g. `4:3`. Embed only |
| `controls` | `{ key, action }[]` | no | The controls legend under the game, e.g. `{ key: 'Space', action: 'Fire' }` |
| `playNote` | string, 120 characters at most | no | One line shown with the game, e.g. `Best on desktop with a mouse` |
| `platforms` | `('desktop' | 'mobile')[]` | no | Shown as small labels with the game, and on its card on `/games/` |
| `order` | number | no | Position on `/games/` and the home Games strip: lower comes first; games without one follow, newest first. Needs `playUrl` |

`controls`, `playNote`, `platforms` and `order` need `playUrl`: set without it, the build fails (they would show nowhere). All the play fields are optional, so existing projects are unchanged.

**Playable projects.** A project with a `playUrl` is a game people can play in the browser, hosted on its own address (a separate static site, e.g. `https://vesper.r7orbit.io/`). The address is data: it lives in the project's front matter, not in code. What changes:

- The page gets a **Play** section in place of the cover image: a click-to-load facade (the cover as poster, a Play button). Nothing is requested from the game until the button is pressed, so the iframe and the game's download stay out of the page load. Then a sandboxed iframe (`sandbox="allow-scripts allow-same-origin allow-pointer-lock"`, `allow="fullscreen; gamepad; autoplay"`) replaces it, keyboard focus moves into it, and a Fullscreen button appears. An "Open in a new tab" link, the controls legend, the note and the platform labels sit around it. Without JavaScript the facade is hidden and a plain link to the game takes its place. With `playMode: link` there is no facade and no iframe, only the Play button (a link that opens a new tab), plus the note, platforms and controls.
- The game is listed on the **Games hub** (`/games/`, `docs/PAGES.md`): a card with the cover as poster, summary, `platforms`, a **Play** button (to this page's Play section, or straight to `playUrl` in a new tab with `playMode: link`) and a **Details** link. Only published games are listed (`draft` and a future `date` apply as everywhere), sorted by `order`, then newest first. There is no `games` collection: the hub is every project with a `playUrl`. A **More games** strip on this page links back to the hub.
- The project card and the page header show a **Playable** badge (play icon and label, brass like every other accent).
- The page's JSON-LD is a `VideoGame` and `SoftwareApplication` (`applicationCategory: Game`, `operatingSystem: Web browser`, `url` = the play address, `author`).
- **Framing.** `public/_headers` lets `/projects/*` frame one origin through `frame-src` (`https://vesper.r7orbit.io`). An embedded game on any other origin is blocked by the browser, so adding a game means adding its host to `frame-src` in `public/_headers` (an explicit host, no wildcard; one per game, separated by spaces). `tests/playable.spec.js` fails when an embedded `playUrl` in `src/content/projects/` is not on that list. `playMode: link` needs no entry.
- The game itself must allow being framed by this site (no `X-Frame-Options: DENY`, and a `frame-ancestors` that includes `https://r7orbit.io`).

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

## Pages (`src/content/pages/`)

A page that is not a post, made of **blocks** the author adds, removes and re-orders in /admin (**Pages**). The files: `about.md`, and the home page and listing pages `home.md`, `latest.md`, `news.md`, `blog.md`, `vlogs.md`, `projects.md`, `repos.md`, `games.md`, `tags.md` (below, "The home page and the listing pages"). They share one collection, schema and renderer (`src/components/Sections.astro`). A file is front matter only (no body).

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | The page's one `h1`. Up to 90 characters; one phrase may be wrapped in `*asterisks*` for italic brass, as in a post |
| `seoTitle` | string | no | Same rule as on every post: at most 49 characters |
| `description` | string | yes | The meta description (about 155 characters reads best; at most 180). Not shown on the page |
| `sections` | block[] | no | The page, top to bottom. An absent list is an empty one; at most 60 blocks |

**The blocks are the shared library** in `src/lib/sections/` (one definition per block: its fields, schema, label and where it sits), documented with every field and an example in [`SECTIONS.md`](SECTIONS.md). Each block is `- type: <id>` plus its own fields, checked strictly by `sectionsSchema`: an unknown field or type fails the build with the block's position (`sections.1.alt: Block 2 (Image): ...`). The library is built to attach to any collection (`sections: sectionsSchema`), so posts can use it later; today only `pages` does.

| `type` | What it draws |
|---|---|
| `heading`, `lead`, `text`, `quote`, `pullquote`, `callout`, `code` | Headings (one *phrase* in asterisks is italic brass), a lead paragraph, Markdown text, a quotation, a pull quote, a note/tip/warning box, a highlighted code block |
| `image`, `image-row`, `gallery`, `portrait`, `video`, `game` | A picture (narrow, wide or full), two or three pictures in a row, a lightbox gallery, a picture beside text, a YouTube video behind a click-to-load player, a playable game behind a Play button |
| `columns`, `divider`, `spacer` | Two Markdown columns, a hairline or three dots, empty space |
| `links`, `button` | A list of links, a solid button |
| `toc`, `stats`, `latest`, `author`, `newsletter` | A contents list of the page's headings, a GitHub repository's numbers (fetched at build time), the newest posts by kind, tag and/or author (drafts and future-dated posts left out; in the page, or as a ruled section with an eyebrow and an "All …" link; newest or last updated first; it can leave itself out when empty), an author's box, the newsletter sign-up |
| `feed`, `pinned`, `games` | The home page's Latest feed (the newest posts with a kind filter, links to each kind's archive when JavaScript is off, a link to everything; one per page, anchor `#latest`), the featured post as a large card (left out with no featured post or only one post), the first published games as game cards (left out with none) |

The nine blocks About already used (`heading`, `text`, `image`, `portrait`, `quote`, `callout`, `links`, `button`, `divider`) keep their names and fields; the new fields on `image` (`align`, `size`) are optional.

Rules the build enforces (the form does too where Decap can):

- **Alt text.** Every picture needs `alt`. An empty `alt` is allowed only when the block has `decorative: true` (image, portrait and the pictures of an image row); a gallery picture always needs alt text.
- **Addresses.** A button's or link's `url` is `https://...` or a page on this site starting with a single `/`. `http:`, `//host`, `mailto:` and `javascript:` are refused. A game's `playUrl` is `https://...` only. A picture's `image` is a file of this site (`/media/x.jpg`, in `public/media/`); another site's picture is refused, as for `Figure`. The file must exist: the build reads its size so the page reserves the space (no layout shift).
- **Things the site has.** A `latest` block's `tag` must be carried by some post and its `author` must be an author; an `author` block's author must exist; an embedded `game`'s origin must be in the `frame-src` of `public/_headers`. Each fails the build with the block's number and what exists.
- **Which blocks sit beside a portrait.** A `portrait` starts a side-by-side row: the `heading` directly above it, the portrait's own text, and every block after it stay in the text column until a `divider`, a block that leaves the column (a wide or full `image`, an `image-row`, `gallery`, `game`, `columns`, `latest`, the newsletter band) or the next `portrait` ends it (`layoutSections`). That is how About keeps its picture beside both of its sections.

The About page's text is fixed by a test: `tests/about.spec.js` compares the rendered page with `tests/fixtures/about-text.txt` line by line. Change the fixture in the same commit as a deliberate change to the words. The Person structured data on /about/ still reads the name and bio from `src/data/site.json` (the author's profile), not from the page text, so a change to the bio in both places is two edits.

`/styleguide/sections/` (noindex, unlinked, in `tests/routes.js`) draws every block with the real renderer, for the axe and width checks; a block added to the library appears there by itself.

### The home page and the listing pages

These files add the fields of `sitePageFields` (`src/lib/site-pages.ts`). The schema accepts them on any page; which page **needs** which, and which it **draws**, is checked when the page is built (`pageProblems`): a needed field that is missing or empty, or a filled-in field the page does not draw, stops the build with the file and the field (`src/content/pages/blog.md: "emptyHeading" is missing (the heading shown when there is nothing to list).`). An optional box left empty in the editor arrives as `""` and means "not set".

| Field | Type | Home | Listings | Games | Notes |
|---|---|---|---|---|---|
| `title` | string | yes | yes | yes | The page's one `h1` (on the home page, the hero headline). One `*phrase*` in asterisks is italic brass |
| `seoTitle` | string | no (not drawn) | no | no | The browser title, "· {site name}" is added. Today the kind's name ("Blog"). Empty: the heading. The home page's browser title is `{site name} · {tagline}` from `site.json` |
| `description` | string | yes | yes | yes | Meta description |
| `eyebrow` | string | no | | | Hero: the brass line over the headline. At most 80 characters |
| `lead` | string | no | yes | yes | The sentence under the heading (plain text). At most 300 |
| `buttons` | `{label, url}[]` | no | | | Hero: up to two; the first solid. `url` is `https://…`, `/page/` or `#anchor` (`#latest` is the Latest feed, `#subscribe` the newsletter band) |
| `sections` | block[] | yes (the rows) | | | The rows under the hero |
| `introSections`, `outroSections` | block[] | | no | no | Blocks between the lead and the list, and between the list and the newsletter band. Every numbered page repeats them |
| `emptyHeading`, `emptyText` | string | | yes | yes | Said when there is nothing to list (at most 100 and 300) |
| `emptyLinkLabel` | string | | | yes | The empty state's button (it goes to `/projects/`) |
| `soonEyebrow`, `soonTitle`, `soonText` | string | | | yes | The card beside a single game ("Next up", "More games coming", …) |

"Listings" are `latest`, `news`, `blog`, `vlogs`, `projects`, `repos` and `tags`. A blank cell means the page does not draw the field (and the build refuses it). What is made from the posts stays in code and is not a field: the list, its filters, counts and pagination, the games grid, the tag chips, the kind's label and icon over the heading (the nav label), "Used once" on `/tags/`, and the filters' "Nothing matches that." messages.

The words in these files were moved from code unchanged (`KINDS` in `src/lib/listing.ts`, `GAMES_COPY` in `src/lib/games.ts`, the literals in `index.astro`, `ArchivePage.astro`, `ArchiveList.astro` and `tags/index.astro`). `tests/page-text.spec.js` compares each page's rendered words with `tests/fixtures/pages/<id>.json`: change the fixture in the same commit as a deliberate change of words (`npm run build && UPDATE_PAGE_TEXT=1 npx playwright test page-text`, then read the diff). When the published posts differ from the ones a fixture was captured with, only the page head is compared.

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
    playUrl: z.url({ protocol: /^https$/ }).optional(), playMode: z.enum(['embed', 'link']).default('embed'), order: z.number().optional(),
    playAspect: z.string().regex(/^[1-9]d{0,2}:[1-9]d{0,2}$/).default('16:9'),
    controls: z.array(z.object({ key: z.string().min(1), action: z.string().min(1) })).default([]),
    playNote: z.string().min(1).max(120).optional(), platforms: z.array(z.enum(['desktop', 'mobile'])).default([]),
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
- **Links** to other posts use the slug path (`/blog/a-post-about-something/`); external links open normally (no `target="_blank"` unless the author asks) and get `rel="noopener"` when they do.
- **Images**: always with alt text (`![what it shows](/media/news/x.jpg)`), or `![](/media/news/x.jpg "decorative")` for pure decoration: the build stops on an image with neither. Where files go and what the build does to them: [`IMAGES.md`](IMAGES.md).

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
3. Every content image has alt text (or is explicitly decorative); the build and the admin enforce it for body images.
4. Nothing in the body hot-links an image or script from another site.
5. No two posts have the same `title` + `kind`.
