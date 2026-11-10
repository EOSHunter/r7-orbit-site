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
src/data/
  site.json                        (site settings: name, tagline, author, links, nav, footer; see "Site settings" below)
public/
  media/<kind>/...                 (covers, posters, gallery, Markdown-body pictures, one folder per kind; shrunk at build)
```

The **file name is the slug** (the last part of the URL). Keep it lowercase, words joined with hyphens, no dates (except for news, where a date prefix helps sorting by eye; strip it from the URL if you like).

## Fields common to every kind

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | Plain text. ≤ 70 characters reads best; ≤ 60 fits a search result. One phrase may be wrapped in `*asterisks*` to be shown in italic brass (e.g. `Why every agent gets its own *room*`); the site strips them for `<title>` |
| `seoTitle` | string | no | Shorter title for the browser tab, search results and `og:title`, when the title is too long. At most 49 characters (60 minus ` · R7 Orbit`; the build fails with a readable message if it is longer). Without it the title is used, and the headline and JSON-LD always keep the real title |
| `date` | date (`YYYY-MM-DD`) | yes | Publish date; future dates are hidden until then (see "Drafts and scheduled posts") |
| `updated` | date | no | Set when the post is materially changed; shown as "Updated Oct 8" |
| `summary` | string | yes | 1–2 sentences, ≤ 155 characters. Used on cards, in the meta description |
| `tags` | string[] | no | 1–4 lowercase tags, hyphenated (`ai-agents`, `evals`, `git`). Reuse existing tags before inventing |
| `cover` | image path | no | 16:9, ≥ 1280×720. The picture on the post's **card** (and its og:image). A blog page does not draw it (its picture is the `featuredImage` behind the headline, decided 2026-11-05); **a news page does**, at the top with its `coverCredit`, so the item opens with its card's picture (2026-11-09). **A blog post has no cover** (decided 2026-11-06): its `featuredImage` is its card picture and og:image, so one upload does both. The blog schema still reads a `cover` left in an older file or an unpublished edit, and uses it only when there is no featured image.  With neither, the plate placeholder is shown (never a stock photo). A project's page does use its cover (it has no featured image) |
| `coverMotion` | string | no | A hover clip for the card: an MP4 under `/media/` (`/media/motion/<post>/hover.mp4`, a `.webm` beside it is used when there); needs a still (featured image or cover). `docs/IMAGES.md`, "Hover clips" |
| `coverAlt` | string | if `cover` | Describe what is in the image. The editor asks for it whenever there is a cover (and does not call it optional: `src/admin/image-alt.ts`); the build accepts `""` for a decorative picture written by hand |
| `featured` | boolean | no | Pins to the top of the home page. **At most one at a time** (the build should warn if two) |
| `draft` | boolean | no | Default `false`. `true` = hidden in production, shown in dev with a "Draft" badge. See "Drafts and scheduled posts" |
| `waitlist` | boolean | no | Default `false`. `true` = the waitlist band for R7 Orbit (heading, sentence, form) after the body, before related posts and previous/next. Drawn only while the waitlist is on in Site settings (`waitlist` below); the band's words are the settings'. The form sends the source `blog` from a blog post or news item, `vlog` from a vlog, `other` from a project or repo. Use it on posts about R7 Orbit (`docs/WAITLIST.md`) |
| `readTime` | number (minutes) | no | Computed from the body if absent (≈ 220 words/min): the Markdown body, or the words of the `sections` |
| `author` | string (author slug) | no | The slug of a file in `src/content/authors/`. Defaults to `hunter-newton`. A slug that does not exist fails the build, naming the post and listing the authors. AI-written pieces are credited to `r7`, never to Hunter |
| `canonicalUrl` | URL | no | Only when the post was first published elsewhere |
| `aiAssist` | `'none' \| 'edited' \| 'drafted'` | no | If the author wants the "How this was made" line (see `DECISIONS.md` §C). Shown as a quiet note under the byline |
| `sections` | block[] | no | The body written as blocks instead of Markdown (see "Body: Markdown or sections" below). Absent or `[]`: the Markdown under the front matter is the body |

### Empty fields

The admin writes an empty value (`cover: ''`, `seoTitle: ''`) when the author clears a box, and a file written by hand may have `poster:` with nothing after it. Every collection (the five kinds, pages, authors) reads a blank or whitespace-only optional field as **not set**, as if the line were not there (`normaliseFrontMatter` in `src/lib/front-matter.ts`, run before the schema in `src/content.config.ts`). A required field keeps its own message (an empty `title` still fails).

Pictures and their alt text: an empty `cover` or `featuredImage` is no picture, and an alt text without its picture is ignored. A real picture whose alt key is missing (or `coverAlt:` with nothing after it) fails the build with `coverAlt is required when cover is set (use "" only for a decorative image)`; `""` (or spaces) is the explicit decorative marker. The admin leaves an emptied image field out of the file when it saves, and refuses to save a picture with no alt text (`src/admin/image-rules.ts`). In a page's or post's `sections`, an optional picture (a video or game poster) left empty, or only spaces, is no picture too. `src/lib/admin-front-matter.vitest.ts` parses admin-shaped front matter (every optional field empty) through every collection.

## Body: Markdown or sections

Every kind's body is written **one of two ways**, chosen per post:

- **Markdown** under the front matter (MDX for blog posts written in the admin), as before. All existing posts are written this way and keep working unchanged.
- **`sections`** in the front matter: an ordered list of blocks from the shared block library (`src/lib/sections/`, catalogue in [`SECTIONS.md`](SECTIONS.md)), the same blocks, schema and renderer as the About page. The file then has **no Markdown body**. This works for every kind, `.md` files included, because the blocks live in the front matter.

**Never both.** A post with a non-empty `sections` list and a non-empty Markdown body stops the build with a message naming its file (`bodyConflict` in `src/lib/content.ts`, checked by `getPosts` for every entry, drafts included); the admin refuses to save one too. Nothing converts a Markdown body into sections automatically.

What a sections body changes, and what it does not:

| | With a Markdown body | With `sections` |
|---|---|---|
| Where it is drawn | the reading column (`.prose`) | the same column, by `Sections.astro` with `layout="column"`: rows stay inside the post's column (a *Full* image is as wide as the column), and every heading gets an anchor |
| Blog/news/vlog/project/repo page chrome | breadcrumb, byline, source box, player, play section, facts, gallery, changelog, author note, share row, series, related posts, previous/next | unchanged |
| Reading time | words of the Markdown | words of the blocks (`sectionsToText`, `src/lib/sections-to-content.ts`): headings, text, quotes, captions, link and button labels; not code, alt text or pull quotes |
| Blog contents list | `##`/`###` of the rendered body, shown at 3+ `h2` (or `toc`) | Heading blocks plus `##`/`###` inside Markdown boxes (`sectionsHeadings`), same rule |
| Search (Pagefind) | indexes the built page | the same: the blocks are in `<main>` |
| JSON-LD | from the front matter; `timeRequired` from the reading time | the same (there is no `articleBody`; `description` is always the required `summary`) |
| Vlog transcript | the body's `## Transcript` part, with `transcript: true` | the `transcriptText` field (Markdown), shown folded the same way |
| Repo `readme: local` | the body replaces the README | the sections replace the README |
| Drafts, scheduling, related posts, series, sitemap | front matter only | unchanged |

Fixtures: `tests/fixtures/posts/<kind>/` holds one post per kind written as sections. They are read through the real schema (the `fixture*` collections in `src/content.config.ts`) and drawn by the real page components at `/styleguide/posts/<kind>/` (noindex, unlinked). They are never in an archive, the sitemap or the site's search.

## Authors

One JSON file per author in `src/content/authors/`, named by its slug (`hunter-newton.json`, `r7.json`, and the writing agents `pulsar`, `orion`, `kepler`, `hubble`, `parallax`: `docs/TEAM.md`). Editable in the admin (**Authors**). Every post names one through `author`; the byline, the author page `/authors/<slug>/`, the "By author" filter and the structured data follow from it.

| Field | Type | Required | Notes |
|---|---|---|---|
| `slug` | string | yes | Must equal the file name (the build says so if not). The address is `/authors/<slug>/` |
| `kind` | `'person' \| 'agent'` | yes | A person is marked up as a `Person`, an agent as an `Organization`, and an agent's posts get the **AI-written** label in the byline |
| `name` | string | agent | A person without one is named in `author.name` in `src/data/site.json` |
| `subtitle` | string, 60 characters at most | no | Shown under the name, e.g. `Orbit AI Agent` |
| `bio` | string | agent | A person without one uses `author.bio` in `site.json` |
| `avatar` | path | no | A person without one uses `author.photo` in `site.json`, or initials when that is empty. An agent without its own picture uses the R7 mark, `/assets/r7-mark.svg`. Square, 512 px or more, in `public/media/authors/` (`docs/TEAM.md`, "Avatars (to do)") |
| `avatarAlt` | string | no | What the avatar shows, in a sentence. Read on the author page and the Team card, where the picture is large; in a byline it stays decorative. Leave empty for the R7 mark |

Hunter's name, bio and photo exist once, in `site.json`: the author file holds only `slug` and `kind`. The About page reads the same place. A leftover `note` key (the footer note, removed 2026-10-21) is ignored; any other unknown key fails the build. An author page with no published post is `noindex` and out of the sitemap.

## Drafts and scheduled posts

A post is **hidden in production builds** if `draft: true` **or** its `date` is later than today (UTC calendar day, checked at build time). Today's date is published. The rule lives in one place, `src/lib/content.ts` (`isPublished` / `filterPublished`), applied by `getPosts` and `getAllPosts` in `src/lib/content-queries.ts`. Every page, archive, tag page, pagination, home/latest, related, prev/next and series list, the sitemap and JSON-LD read through those, so a hidden post has no page and nothing for Pagefind to index (it indexes the built `dist/`). Use `getPosts`/`getAllPosts`, never `getCollection` directly.

**A scheduled post does not publish itself.** It goes live on the first build/deploy on or after its date. For it to appear on time, rebuild daily (a host cron or a GitHub Actions `schedule`; see `BUILD_PLAN.md`).

In `npm run dev`, drafts and scheduled posts are shown so they can be previewed, each with a brass **Draft** or **Scheduled for Oct 12, 2026** badge on cards and on the post page. The badge never renders in a production build.

## Extra fields by kind

### News (`src/content/news/`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `sourceUrl` | URL | yes | The thing being discussed |
| `sourceName` | string | yes | e.g. "Anthropic", "arXiv", "The Verge" |
| `take` | string | no | One-sentence verdict shown as a pull line ("My read: …") |
| `topic` | enum | no (set it) | The kind of news: `models` (new models), `tools` (tools and things to try), `trends` (trends with numbers), `games` (games and creative tools), `home` (smart home), `policy` (rules and policy), `orbit` (R7 Orbit updates), `security` (security incidents and investigations), `business` (companies, deals and listings). Without a `cover`, it is the item's picture: the topic's brass symbol (R7 Orbit Studio, `public/media/news/topics/`) in pulse rings, on its card and as a slim banner at the top of the item (`NewsSignal.astro`; the rings vary with the address). Every topic: `/styleguide/news-signals/` |
| `coverCredit` | string | with a `cover` | Who made the cover: the publisher for an official image or a screenshot of its document (`docs/IMAGES.md` rule 7), `Pictor` for a scene made for the item in R7 Orbit Studio and approved by Hunter. The card shows "Image: <coverCredit>". The build stops on a news cover without it |
| `stat`, `statLabel` | string, string | no (both or neither) | The card's big number when there is no cover: `stat` at most 10 characters ("$17.0B", "948"), `statLabel` at most 40 ("revenue in one quarter"). A figure from the item's own sourced text. Drawn by `NewsStat.astro` |
| `symbol` | string | no (needed when the topic's object is taken) | An object made for this one item in R7 Orbit Studio (`authored/news-symbols`), at `public/media/news/symbols/<symbol>.webp`, shown instead of the topic's. **No two news items share a picture** (the author's rule, 2026-11-08): the topic's object is only the first item's; every later item of that topic gets its own symbol. `tests/news-signal.spec.js` fails the build when two items match |

Body: 150–500 words. Say what happened, why it matters (or doesn't), and what the author would do about it.

### Blog (`src/content/blog/`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `subtitle` | string | no | Up to 140 characters. One line under the title (written by the admin; not yet shown on the page) |
| `series` | string | no | Name of a series; posts with the same value link to each other |
| `seriesOrder` | number | if `series` | 1, 2, 3… |
| `toc` | boolean | no | Default `true` when the post has 3+ `h2` headings |
| `featuredImage` | image under `src/assets/blog/` | no | The picture behind the breadcrumbs and headline, optimised at build time, and also the post's card picture and og:image (cropped to 16:9 and 1200×630). Wide (16:9), at least 1600px across |
| `featuredImageAlt` | string | if `featuredImage` | As `coverAlt` |
| `featuredImageBy` | `me` or `agent` | no | Who made the featured image, shown under the headline block as "Image by …". Default `me`: the site owner's name from `site.json` (`author.name`), not the post's author, who may be an agent. `agent`: the name in `featuredImageAgent` (added 2026-11-06; `src/lib/image-credit.ts`). The name is a link: an agent's goes to its author page, the owner's to About (2026-11-07) |
| `featuredImageAgent` | string | if `featuredImageBy: agent` | The agent's name, e.g. "Image by Pictor" (Pictor, the imagery agent, makes the post images). In the editor it is a list of the agents in `src/content/authors/` (2026-11-07). The build fails without it, and the editor will not save |

Body: Markdown/MDX. Headings from `##` down (the title is the `h1`). See "Markdown the site understands" below.

### Vlog (`src/content/vlogs/`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `youtubeId` | string | yes (or `videoUrl`) | The 11-character id, e.g. `dQw4w9WgXcQ` |
| `videoUrl` | URL | alt | For non-YouTube hosts |
| `duration` | string (`m:ss` or `h:mm:ss`) | yes | Shown on the poster and in structured data |
| `poster` | image path | no | The player's thumbnail. Falls back to `cover`, then to YouTube's thumbnail (downloaded at build, not hotlinked). Cards show `cover` (with its `coverMotion`) and fall back to `poster` |
| `chapters` | `{ t: string, title: string }[]` | no | `t` is `m:ss`. Rendered as a list that seeks the video when clicked |
| `transcript` | boolean | no | `true` if the body contains a `## Transcript` section; it is placed in a `<details>`. Not allowed with `sections` |
| `transcriptText` | Markdown | no | Only with `sections`: the transcript, shown in the same `<details>`. The build refuses it on a vlog with a Markdown body |

Body: the written notes, links and resources mentioned in the video (Markdown, or `sections`).

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
| `playUrl` | https URL, or a page of this site | no | Makes the project **playable** (see below). A full `https://` address, or a page of this site starting with one `/` (`/ascent/`), which needs `playMode: link`. Anything else fails the build |
| `playMode` | `'embed' | 'link'` | no | Default `embed`. `link` shows only a button that opens the game in a new tab |
| `playAspect` | string `w:h` | no | Default `16:9`. The shape of the game frame, e.g. `4:3`. Embed only |
| `controls` | `{ key, action }[]` | no | The controls legend under the game, e.g. `{ key: 'Space', action: 'Fire' }` |
| `playNote` | string, 120 characters at most | no | One line shown with the game, e.g. `Best on desktop with a mouse` |
| `platforms` | `('desktop' | 'mobile')[]` | no | Shown as small labels with the game, and on its card on `/apps/` |
| `order` | number | no | Position on `/apps/` and the home Apps row: lower comes first; those without one follow, newest first. Needs `playUrl` |
| `appType` | one of `APP_TYPES` (today `'game' \| 'app'`) | no | What it is on `/apps/`: its type chip, the type filter, the card's button word and the page's structured data. Left out on a playable project, it is `app`. Needs `playUrl` |

`controls`, `playNote`, `platforms`, `order` and `appType` need `playUrl`: set without it, the build fails (they would show nowhere). All the play fields are optional, so existing projects are unchanged.

**Types (`appType`).** The allowed values are defined once, in `APP_TYPES` (`src/lib/app-types.ts`): each type's label ("Game", "App"), plural for the filter ("Games", "Apps"), icon, button word ("Play", "Open") and structured data. The schema, the editor's **Type** menu, the filter on `/apps/`, the cards, the search label and the JSON-LD all read that list, so adding a type (say `tool`) is one line there; this page lists the values that exist when it was written, `APP_TYPES` is the authority. Vesper Drift is `appType: game`.

**Playable projects.** A project with a `playUrl` is a game or an app people use in the browser, hosted on its own address (a separate static site, e.g. `https://vesper.r7orbit.io/`) or on a page of this site (`/ascent/`, R7: Ascent). The address is data: it lives in the project's front matter, not in code. A page of this site is always `playMode: link` and opens in the same tab (no new tab, no external icon, nothing to frame). What changes:

- The page gets a **Play** section in place of the cover image: a click-to-load facade (the cover as poster, a Play button). Nothing is requested from the game until the button is pressed, so the iframe and the game's download stay out of the page load. Then a sandboxed iframe (`sandbox="allow-scripts allow-same-origin allow-pointer-lock"`, `allow="fullscreen; gamepad; autoplay"`) replaces it, keyboard focus moves into it, and a Fullscreen button appears. An "Open in a new tab" link, the controls legend, the note and the platform labels sit around it. Without JavaScript the facade is hidden and a plain link to the game takes its place. With `playMode: link` there is no facade and no iframe, only the Play button (a link that opens a new tab), plus the note, platforms and controls.
- It is listed on the **Apps hub** (`/apps/`, `docs/PAGES.md`): a card with the cover as poster, its type chip (icon and label), summary, `platforms`, a primary button (**Play** for a game, **Open** for an app; to this page's Play section, or straight to `playUrl` in a new tab with `playMode: link`) and a **Details** link. Only published entries are listed (`draft` and a future `date` apply as everywhere), sorted by `order`, then newest first; with two or more types published, a filter by type sits above them. There is no `apps` collection: the hub is every project with a `playUrl`. A **More apps** strip on this page lists up to three others (of any type) and links back to the hub.
- The project card and the page header show a **Playable** badge (play icon and label, brass like every other accent).
- The page's JSON-LD follows the type: a game is a `VideoGame` and `SoftwareApplication` with `applicationCategory: Game`; an app is a `SoftwareApplication` with `applicationCategory: WebApplication`. Both have `operatingSystem: Web browser`, `url` = the play address, and the `author` of the authors system (Hunter unless the post names another author; an agent is an `Organization`).
- **Framing.** `public/_headers` lets `/projects/*` frame the origins listed in `frame-src` (today `https://vesper.r7orbit.io https://housepainter.r7orbit.io`; House Painter's host is there ahead of its project page). Anything embedded from another origin is blocked by the browser, so adding a game or an app means adding its host to `frame-src` in `public/_headers` (an explicit host, no wildcard; one per app, separated by spaces; nothing else on that line or in the `/admin/*` block changes). `tests/playable.spec.js` fails when an embedded `playUrl` in `src/content/projects/` is not on that list, and `tests/headers.spec.js` holds the exact line, so update it in the same change. `playMode: link` needs no entry.
- The game or app itself must allow being framed by this site (no `X-Frame-Options: DENY`, and a `frame-ancestors` that includes `https://r7orbit.io`).

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

A page that is not a post, made of **blocks** the author adds, removes and re-orders in /admin (**Pages**). The files are `about.md` (a page of blocks, drawn by `src/components/Sections.astro`), the home page and listing pages `home.md`, `latest.md`, `news.md`, `blog.md`, `vlogs.md`, `projects.md`, `repos.md`, `apps.md`, `tags.md` (see "The home page and the listing pages" below), and `privacy.md`, `404.md`, `search.md` (the words of a page that keeps its own frame; see "Pages with a fixed frame" below). All of them use the same schema. Each file is front matter only (no body).

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | The page's one `h1`. Up to 90 characters; one phrase may be wrapped in `*asterisks*` for italic brass, as in a post |
| `seoTitle` | string | no | Same rule as on every post: at most 49 characters |
| `description` | string | yes | The meta description (about 155 characters reads best; at most 180). Not shown on the page |
| `sections` | block[] | no | The page, top to bottom. An absent list is an empty one; at most 60 blocks |

**The blocks are the shared library** in `src/lib/sections/` (one definition per block: its fields, schema, label and where it sits), documented with every field and an example in [`SECTIONS.md`](SECTIONS.md). Each block is `- type: <id>` plus its own fields, checked strictly by `sectionsSchema`: an unknown field or type fails the build with the block's position (`sections.1.alt: Block 2 (Image): ...`). The same library is attached to every kind of post (see "Body: Markdown or sections" above) and draws the home page's rows and the blocks around a listing ("The home page and the listing pages" below).

| `type` | What it draws |
|---|---|
| `heading`, `lead`, `text`, `quote`, `pullquote`, `callout`, `code` | Headings (one *phrase* in asterisks is italic brass), a lead paragraph, Markdown text, a quotation, a pull quote, a note/tip/warning box, a highlighted code block |
| `image`, `image-row`, `gallery`, `portrait`, `video`, `game` | A picture (narrow, wide or full), two or three pictures in a row, a lightbox gallery, a picture beside text, a YouTube video behind a click-to-load player, a playable game behind a Play button |
| `columns`, `divider`, `spacer` | Two Markdown columns, a hairline or three dots, empty space |
| `links`, `button` | A list of links, a solid button |
| `toc`, `stats`, `latest`, `author` | A contents list of the page's headings, a GitHub repository's numbers (fetched at build time), the newest posts by kind, tag and/or author (drafts and future-dated posts left out; in the page, or as a ruled section with an eyebrow and an "All …" link; newest or last updated first; it can leave itself out when empty), an author's box |
| `feed`, `pinned`, `apps` | The home page's Latest feed (the newest posts with a kind filter, links to each kind's archive when JavaScript is off, a link to everything; one per page, anchor `#latest`), the featured post as a large card (left out with no featured post or only one post), the first published apps and games as cards with their type (left out with none) |

The nine blocks About already used (`heading`, `text`, `image`, `portrait`, `quote`, `callout`, `links`, `button`, `divider`) keep their names and fields; the new fields on `image` (`align`, `size`) are optional.

Rules the build enforces (the form does too where Decap can):

- **Alt text.** Every picture needs `alt`. An empty `alt` is allowed only when the block has `decorative: true` (image, portrait and the pictures of an image row); a gallery picture always needs alt text.
- **Addresses.** A button's or link's `url` is `https://...` or a page on this site starting with a single `/`. `http:`, `//host`, `mailto:` and `javascript:` are refused. A game's `playUrl` is `https://...` only. A picture's `image` is a file of this site (`/media/x.jpg`, in `public/media/`); another site's picture is refused, as for `Figure`. The file must exist: the build reads its size so the page reserves the space (no layout shift).
- **Things the site has.** A `latest` block's `tag` must be carried by some post and its `author` must be an author; an `author` block's author must exist; an embedded `game`'s origin must be in the `frame-src` of `public/_headers`. Each fails the build with the block's number and what exists.
- **Which blocks sit beside a portrait.** A `portrait` starts a side-by-side row: the `heading` directly above it, the portrait's own text, and every block after it stay in the text column until a `divider`, a block that leaves the column (a wide or full `image`, an `image-row`, `gallery`, `game`, `columns`, `latest`) or the next `portrait` ends it (`layoutSections`). That is how About keeps its picture beside both of its sections.

The About page's text is fixed by a test: `tests/about.spec.js` compares the rendered page with `tests/fixtures/about-text.txt` line by line. Change the fixture in the same commit as a deliberate change to the words. The Person structured data on /about/ still reads the name and bio from `src/data/site.json` (the author's profile), not from the page text, so a change to the bio in both places is two edits.

`/styleguide/sections/` (noindex, unlinked, in `tests/routes.js`) draws every block with the real renderer, for the axe and width checks; a block added to the library appears there by itself.

### The home page and the listing pages

These files add the fields of `sitePageFields` (`src/lib/site-pages.ts`). The schema accepts them on any page; which page **needs** which, and which it **draws**, is checked when the page is built (`pageProblems`): a needed field that is missing or empty, or a filled-in field the page does not draw, stops the build with the file and the field (`src/content/pages/blog.md: "emptyHeading" is missing (the heading shown when there is nothing to list).`). An optional box left empty in the editor arrives as `""` and means "not set".

| Field | Type | Home | Listings | Apps | Notes |
|---|---|---|---|---|---|
| `title` | string | yes | yes | yes | The page's one `h1` (on the home page, the hero headline). One `*phrase*` in asterisks is italic brass |
| `seoTitle` | string | no (not drawn) | no | no | The browser title, "· {site name}" is added. Today the kind's name ("Blog"). Empty: the heading. The home page's browser title is `{site name} · {tagline}` from `site.json` |
| `description` | string | yes | yes | yes | Meta description |
| `eyebrow` | string | no | | | Hero: the brass line over the headline. At most 80 characters |
| `lead` | string | no | yes | yes | The sentence under the heading (plain text). At most 300 |
| `buttons` | `{label, url}[]` | no | | | Hero: up to two; the first solid. `url` is `https://…`, `/page/` or `#anchor` (`#latest` is the Latest feed) |
| `waitlist` | boolean | no | | | Hero: `true` draws the waitlist form (source `hero`) under the lead and buttons, while the waitlist is on in Site settings. `home.md` has it on. `false` counts as not set, so it is refused only as `true` on another page |
| `sections` | block[] | yes (the rows) | | | The rows under the hero |
| `introSections`, `outroSections` | block[] | | no | no | Blocks between the lead and the list, and between the list and the foot of the page. Every numbered page repeats them |
| `emptyHeading`, `emptyText` | string | | yes | yes | Said when there is nothing to list (at most 100 and 300) |
| `emptyLinkLabel` | string | | | yes | The empty state's button (it goes to `/projects/`) |
| `soonEyebrow`, `soonTitle`, `soonText` | string | | | yes | The card beside a single app ("Next up", "More apps coming", …) |

"Listings" are `latest`, `news`, `blog`, `vlogs`, `projects`, `repos` and `tags`. A blank cell means the page does not draw the field (and the build refuses it). What is made from the posts stays in code and is not a field: the list, its filters, counts and pagination, the apps grid and its type filter (the type names are `APP_TYPES`), the tag chips, the kind's label and icon over the heading (the nav label), "Used once" on `/tags/`, and the filters' "Nothing matches that." messages.

The words in these files were moved from code unchanged (`KINDS` in `src/lib/listing.ts`, `GAMES_COPY` in what was `src/lib/games.ts`, the literals in `index.astro`, `ArchivePage.astro`, `ArchiveList.astro` and `tags/index.astro`). `tests/page-text.spec.js` compares each page's rendered words with `tests/fixtures/pages/<id>.json`: change the fixture in the same commit as a deliberate change of words (`npm run build && UPDATE_PAGE_TEXT=1 npx playwright test page-text`, then read the diff). When the published posts differ from the ones a fixture was captured with, only the page head is compared.

The settings tokens of the next section work in these files too: `home.md` writes the hero's eyebrow and lead and its description as `{site.tagline}` and `{site.description}`, and `latest.md` its description as `{site.description}`, so the tagline and description stay in Site settings. `loadSitePage` (`src/lib/site-pages-queries.ts`) fills them; a unit test checks that no page file types a settings value out.

### Pages with a fixed frame: privacy, 404, search, ascent

`src/content/pages/privacy.md`, `404.md`, `search.md` and `ascent.md` (the game page, `/ascent/`) hold the **words** of those pages; the frame (eyebrow, search box, 404 orbit and buttons) stays in `src/pages/*.astro`. Same fields as About: `title` is the `h1`, `seoTitle` the browser title ("Privacy", "Page not found", "Search"), `description` the meta description. Where each block lands is fixed per page (`src/lib/page-copy.ts`):

| Page | Blocks |
|---|---|
| `privacy.md` | Leading `lead` under the heading; the rest in one `.prose` column; a `text` block at the very end as small print ("Last updated ...") |
| `404.md` | Leading `lead` under the heading; anything else after it, above the search box |
| `search.md` | Every block is the note shown only without JavaScript (inside `<noscript>`, `text` paragraphs as `.search-note`) |
| `ascent.md` | Leading `lead` under the heading, above the game; the rest below it in one `.prose` column; a `text` block at the very end is the credits: small print on the page, and the same lines, one per line, on the game's finish screen |

**Settings tokens.** Any text, in any of these files, may hold `{site.name}`, `{site.tagline}`, `{site.description}`, `{author.name}`; the build replaces them with the values in `src/data/site.json`. Use them instead of typing a value the settings own: An unknown `{x.y}` fails the build with the file and block. Values are inserted as written, into Markdown.

**The waitlist lines.** A block whose text starts with `{if waitlist on}` is shown only while the live site shows the waitlist (Site settings → Waitlist on, with a site key); `{if waitlist off}`, only while it does not. For the Privacy page's paragraph about the waitlist (`docs/WAITLIST.md`, "Privacy"); the wording is the author's.

**The newsletter lines.** `{newsletter.provider}` prints the newsletter service's name (Buttondown) while the newsletter is on (Site settings → Newsletter: Enabled, with a username), and nothing while it is off. A block whose text starts with `{if newsletter connected}` is shown only while it is on; `{if newsletter not connected}`, only while it is off. The Privacy page uses both ([`NEWSLETTER.md`](NEWSLETTER.md)).

Tests: `tests/pages.spec.js` compares the built pages with `tests/fixtures/pages/<page>.txt` (captured before the move), `src/lib/page-copy.vitest.ts` covers tokens, conditions, slots and the legacy privacy wording, `tests/admin-pages.spec.js` opens each file in the real editor.

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

## Site settings: `src/data/site.json`

One file holds the site-wide settings, and it is edited in /admin under **Site settings** (`src/admin/settings.ts`, a Decap file collection pointing at this same file). Every reader goes through `src/data/site.ts`, which checks the file against `siteSchema` in `src/lib/site-settings.ts` when it is imported: a bad edit fails the build with the field named (`src/data/site.json (Site settings in /admin) has a problem: links.github: use a full address that starts with https://`). `astro.config.mjs`, `src/content.config.ts` and the admin's `seoTitleMax` still import the JSON directly, so it stays plain JSON.

```json
{
  "name": "R7 Orbit",
  "tagline": "Field notes on building with AI",
  "description": "News, builds and the things in between: …",
  "url": "https://r7orbit.io",
  "defaultOgImage": "/og-default.png",
  "defaultOgImageAlt": "R7 Orbit: the R7 mark inside a ring …",
  "author": { "name": "…", "bio": "…", "photo": "/media/about/hunter-newton.jpg" },
  "links": { "github": "", "youtube": "https://www.youtube.com/@R7Creatives" },
  "nav": [
    { "label": "Latest", "href": "/#latest" },
    { "label": "Apps", "href": "/apps/", "footer": true, "icon": "play" }
  ],
  "footer": {
    "links": [
      { "label": "GitHub", "social": "github", "icon": "github" }
    ],
    "note": "Made with R7 Orbit"
  }
}
```

| Field | In /admin | Rules (checked by the build) |
|---|---|---|
| `name` | yes | 1-30 characters. It is added to every browser title, so it also sets the longest `seoTitle` a post may have |
| `tagline`, `description` | yes | required; description one line, 180 characters at most |
| `url` | **no** | the canonical address of every page and sitemap entry; changing it is a domain move (`docs/DEPLOY_CLOUDFLARE.md`) |
| `defaultOgImage`, `defaultOgImageAlt` | yes | the share image (and its alt text) for any page without its own; a path on this site that exists |
| `author.name`, `bio`, `photo` | yes | the person's profile: posts, the author page and the About page's Person data read it. `photo` is a path that exists |
| `links.github`, `youtube` | yes | empty, or `https://…` only. Empty leaves the link out everywhere (footer, share row, JSON-LD `sameAs`) |
| `nav[]`: `label`, `href`, `footer`, `icon` | yes | the header links in order. `href` is a page of this site (`/blog/`, `/#latest`) or `https://…`; a site path must exist under `src/pages` or `public` (the build names the item and the address if not); no two items with the same `href`. `footer: true` also lists it in the footer, first, with `icon` (required then) |
| `footer.links[]`: `label`, `icon`, `href` or `social` | yes | after the nav items marked `footer`. Either an `href` (same rules as nav) or `social`, either `github` or `youtube`, which is left out while that link is empty. Not both. No two footer links to the same address |
| `footer.note` | yes | the line after the year; empty shows nothing |
| `waitlist.enabled` | yes (**Enabled**) | the waitlist switch, `false` by default. Off, or `turnstileSiteKey` empty: no form on any page, no `/waitlist/remove/`, nothing loaded, and every built page is the same as without the feature |
| `waitlist.turnstileSiteKey` | yes | the **public** site key of the Turnstile widget (`0x…`), or empty. Cloudflare's test keys (`1x…`, `2x…`, `3x…`) are refused. The secret key is never here: it is the Pages secret `TURNSTILE_SECRET_KEY` |
| `waitlist.heading`, `text` | yes | the band at the end of a post: heading (80 characters; one `*phrase*` is italic brass) and one sentence (300) |
| `waitlist.buttonLabel`, `emailLabel` | yes | the button and the label of the email box (40 each). The box has no placeholder, so no example address appears on the site (`scripts/no-contact.mjs`) |
| `waitlist.successMessage`, `errorMessage` | yes | said in the form's status line (200 each): success only when the server answers `{ ok: true }`; the error message for any failure but a 400, where the server's own short message is shown ("Please enter a valid email address.") |
| `waitlist.removeLinkLabel`, `removeHeading`, `removeButtonLabel`, `removeSuccessMessage` | yes | the link under each form, and `/waitlist/remove/`: its `h1`, button and the neutral sentence said after any removal (it never says whether the address was on the list) |
| `waitlist.noscriptMessage` | yes | shown instead of the form without JavaScript (Turnstile needs it) |

**The nav is matched by address, never by label.** A page says which section it belongs to with `current="/blog/"` (the `href` of the nav item), and `Header.astro` marks the item whose `href` equals it (`isCurrent` in `src/lib/site-settings.ts`). The search page picks its archive chips by address too (`searchKinds`). So renaming "Blog" in /admin keeps the highlight and the chips; changing an item's `href` is what moves it. `/styleguide/nav/` (noindex, unlinked) draws the nav with every label renamed, and `tests/site-settings.spec.js` checks it.

`src/lib/waitlist.ts` holds the rule for when a build draws the forms (`waitlistState`): the live site only with `enabled` and a site key; `astro dev` always, with Cloudflare's test key and a "Dev only" note when the live site would not; a build with `WAITLIST_PREVIEW=1` always, with the test key (tests and Lighthouse only; a Cloudflare Pages build with it set stops). Where the forms are drawn is the home page's `waitlist` field, each post's `waitlist` field, and any `waitlist` block (`docs/SECTIONS.md`). The author's guide: `docs/WAITLIST.md`.

Not settings: the CMS repository, branch and sign-in address (`CMS_REPO`, `CMS_BRANCH`, `CMS_AUTH_URL` in `src/admin/config.ts`), any token or secret, the game hosts in `public/_headers`, `public/site.webmanifest` (it repeats the name and description: change it by hand if the name changes), and the words of the header controls and post-page chrome.

Nothing about the author is hard-coded in components: it comes from this file.

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
