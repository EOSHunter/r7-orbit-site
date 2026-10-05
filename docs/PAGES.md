# Pages

Every page the site needs, what is on it, what states it has, and how you know it is done. Working HTML for each is in `templates/` (static, no framework): treat those as the visual reference and port them.

## Sitemap

```
/                              Home
/news/                         News archive           /news/<slug>/        News item
/blog/                         Blog archive           /blog/<slug>/        Blog post
/vlogs/                        Vlog archive           /vlogs/<slug>/       Vlog page
/projects/                     Project archive        /projects/<slug>/    Project page
/games/                        Games hub (playable projects; no pages of its own: each game is /projects/<slug>/)
/repos/                        Repo archive           /repos/<slug>/       Repo page
/tags/                         All tags               /tags/<tag>/         One tag
/authors/<slug>/               One author (/authors/hunter-newton/, /authors/r7/; no /authors/ index)
/search/                       Search (or a dialog opened with "/")
/about/                        About
/subscribe/                    Subscribe (the form on its own page, for links)
/rss.xml  /news/rss.xml  /blog/rss.xml  /vlogs/rss.xml  /projects/rss.xml  /repos/rss.xml
/sitemap-index.xml  /robots.txt  /404.html
/privacy/                      Privacy (when there is a form or analytics)
```

Navigation (header): **Latest · News · Blog · Vlogs · Projects · Games · Repos · About**, then search; the footer links to Games too. A section whose archive has fewer than three items is not in the header.

## Shared parts (build once, reuse)

| Part | Notes |
|---|---|
| **Head** | `<title>`, description, canonical, Open Graph/Twitter, theme-color `#09090a`, icons, manifest, the three stylesheets, a tiny inline script that adds the `js` class |
| **Header** | Sticky, blurred, hairline underline. Wordmark left; nav; search; menu button below 900px |
| **Footer** | Wordmark, one line, links (RSS, GitHub, YouTube, Subscribe), © year, "Made with R7 Orbit" |
| **Subscribe band** | Eyebrow, short line, email field + solid button, one-sentence privacy note |
| **Post card** | The five variants in `DESIGN_SYSTEM.md` §9 |
| **Icon sprite** | News, blog, vlog, project, repo, arrow, star, fork, clock, calendar, external, rss, github, search, menu, close, link, copy, play, sun |
| **Media placeholder** | Plate gradient + dot grid + ivory mark at 10% opacity |
| **Skip link** | First focusable element; jumps to `#main` |

## Pages whose words are edited in /admin

The home page, `/latest/`, the five archives, `/games/` and `/tags/` take their words from `src/content/pages/<id>.md` (the `pages` collection, edited in /admin under **Pages**; fields in `CONTENT_MODEL.md`, "Pages"; the author's steps in `PUBLISHING.md`, section 8). What is made from the posts stays in code: the listing with its filters, counts and pagination, the games grid, the tag chips, the kind labels and icons (shared with the navigation). The numbered pages (`/blog/page/2/`) repeat their archive's words.

| Page | File | What the file holds |
|---|---|---|
| `/` | `home.md` | The hero (headline = the page's `h1`, eyebrow, lead, up to two buttons), the meta description, and the rows below the hero as blocks (`sections`): Pinned post, Latest feed, Latest posts (Projects), Games row, Latest posts (Repos) |
| `/latest/`, `/news/`, `/blog/`, `/vlogs/`, `/projects/`, `/repos/` | `latest.md`, `news.md`, … | `h1`, browser title (`seoTitle`, today the kind's name), description, lead, the empty state (heading and text), blocks above and below the list (`introSections`, `outroSections`, empty today) |
| `/games/` | `games.md` | As an archive, plus the empty state's button and the "More games coming" card (eyebrow, heading, text) |
| `/tags/` | `tags.md` | As an archive. "Used once" stays in code |

The browser title of the home page is still `{site name} · {tagline}` from `src/data/site.json`. The newsletter band at the foot of these pages is the site's (`SubscribeBand`), not a block. The words were moved without a change: `tests/page-text.spec.js` compares each page's rendered words with `tests/fixtures/pages/<id>.json`, captured from the pages before they became editable, and the pages were compared pixel for pixel at 375px and 1280px before and after.

## Home `/`

**Purpose:** In five seconds, say what this is and show what's newest.

Everything below the hero is a list of blocks in `home.md`, in the order below; the author can re-order, remove or add rows. Each data row is a block of the shared library (`SECTIONS.md`): Pinned post (`pinned`), Latest feed (`feed`, one per page; its anchor is `#latest`), Latest posts with a section frame (`latest`, Projects newest first, Repos by last push), Games row (`games`).

1. **Hero:** eyebrow (tagline), display headline with one italic-brass phrase, lead sentence, two buttons ("Start with the latest" solid, "Subscribe" outline). The animated orbit on the right (≥ 900px), above the text on small screens, smaller.
2. **Pinned:** the one `featured: true` post as a large horizontal card (media left, text right; stacked on mobile). Hidden if none.
3. **Latest:** `.seg` filter (All · News · Blogs · Vlogs · Projects · Repos), then the 8 newest across kinds in the card grid; the newest has `.fresh`. "See everything" link to `/archive` (or the `All` archive).
4. **Projects strip:** 3 newest projects (card with status mark). "All projects →".
5. **Games strip** (only when a game is published): up to 3 `GameCard`s in hub order, "All games →" to `/games/`.
6. **Repos strip:** 3 repos by most recent push. "All repos →".
7. **Subscribe band.**

States: filter with no results (can't happen on the home page since "All" is default; if a kind has no posts it isn't shown). Loading: none (static).

Done when: LCP element is the hero headline or the pinned card media (not the orbit); the orbit doesn't block interaction; filter works without JS as plain links to the archive pages (progressive enhancement).

## Archive `/<kind>/`

**Purpose:** Find something in one kind.

Words: `src/content/pages/<kind>.md` (`latest.md` for `/latest/`): the `h1`, lead, browser title, description, empty state, and optional blocks between the lead and the list (`introSections`) and between the list and the newsletter band (`outroSections`). The eyebrow (icon and label) is the kind's name in code. With no blocks above the list, the markup is the one the page always had. The fixture `/styleguide/listing/` draws an archive with blocks on both sides.

- Header: eyebrow (kind icon + label), `h1` (e.g. "Blog"), one-sentence lead, count.
- Toolbar: search field (filters in place), tag chips (toggle, multi-select = AND), sort `.seg` (Newest · Oldest), result count (`aria-live="polite"`).
- Grid of cards, 12 per page, pagination (Prev · 1 2 3 · Next) with real `<a>` links (`/blog/page/2/`).
- Empty state: "Nothing matches that." + "Clear filters" button.
- Tag and search state live in the URL (`?tag=evals&q=worktree`) so they can be shared.

Done when: works with JS off (shows the first page, pagination is links); with JS on, filtering is instant; keyboard users can operate chips (they are buttons with `aria-pressed`).

## Blog post `/blog/<slug>/` and News item `/news/<slug>/`

**Purpose:** Read comfortably.

- Breadcrumb (Home / Blog). Eyebrow (kind icon · read time). `h1` with italic-brass phrase. Lead (the `summary`).
- Byline: the author (avatar, name linking to `/authors/<slug>/`, subtitle, and an **AI-written** chip for an agent), date (and "Updated …"), tags as chip links. Optional "How this was made" note (not shown on an agent's post: the byline and footer note already say it).
- **Agent footer note:** on a post whose author is an agent, the agent's `note` in a block at the end of the article. Never on a person's post.
- Cover (if any), then body in `.prose` (68ch measure).
- Sidebar (≥ 1200px): sticky table of contents with current-section highlight. Hidden on smaller screens (the TOC becomes a `<details>` above the body).
- Share row: Copy link (copies, says "Copied"), Email, and links to the author's profiles. No third-party share widgets.
- Series navigation if `series` is set.
- **News only:** a "Source" box above the body: source name, link (external icon), and the `take` as a pull line.
- Related: 3 cards by shared tags. Prev / Next in the same kind. Subscribe band.

Structured data: `Article` (`NewsArticle` for news). Done when: headings are in order, code blocks scroll horizontally without moving the page, images never overflow, the copy buttons work, print stylesheet is sensible (no header/footer/nav).

## Vlog `/vlogs/<slug>/`

**Purpose:** Watch, then read the notes.

- 16:9 player at the top. Until the visitor presses play it is a **facade**: the poster image, the play ring, the duration badge. On play, load the `youtube-nocookie.com` iframe and start playback. No YouTube request before that.
- Title, meta row (author byline · date · duration), description (`.prose`), **chapters** list (mono timestamps; clicking seeks and plays), links/resources, transcript in a `<details>` if present, "Subscribe on YouTube" and "Subscribe by email" buttons, related videos.

Structured data: `VideoObject` (name, description, thumbnailUrl, uploadDate, duration as ISO 8601 `PT12M48S`, embedUrl). Done when: Lighthouse shows no third-party requests on first load; chapters work with the keyboard; the poster has no layout shift.

## Games `/games/`

**Purpose:** Find something to play, with nothing to install.

- A game is a `projects` entry with a `playUrl` (no collection of its own). Only published games are listed: drafts and future-dated posts go through the same helper as every list (`selectGames` in `src/lib/games.ts`, which wraps `filterPublished`).
- Order: the optional `order` number (lower first), then games without one, newest first.
- Header: eyebrow (play icon + "Games"), `h1` "Games", one line: "Small games that run in your browser. No install." The `h1`, the line, the browser title and description, the empty state and the "More games coming" card are `src/content/pages/games.md`.
- `GameGrid` of `GameCard`s: 1 column on a phone, 2 from 640px, 3 from 1000px; with one or two cards it stays at 2 columns. Each card: poster (the project's `cover`, or the `MediaPlaceholder`), Playable badge, title, one line, platform chips, a solid **Play** button and a **Details** link. Play goes to `/projects/<slug>/#play` (where the game is embedded); with `playMode: link` it opens `playUrl` in a new tab. Details always goes to the project page. The first row (three cards) loads its posters at once, the rest are lazy; every poster sits in a 16:9 frame, so nothing shifts.
- With exactly one game, a final dashed "More games coming" card (no links) follows it.
- Empty state: "No games yet." with a link to the projects. The page is `noindex` and out of the sitemap while it is empty.
- Structured data: `CollectionPage`, an `ItemList` of the games in the order shown (omitted when empty) and a `BreadcrumbList`. In the sitemap once a game is published.
- Each playable project page ends with a "More games" strip (up to three other games, and "All games →"). Search results for a playable project are labelled **Game** (Pagefind meta `kind`, set on the project page header).

Done when: the layouts for 0, 1, 2 and 5 games pass axe at 320 to 1480px (`tests/games.spec.js` runs them on the fixture `/styleguide/games/`).

## Project `/projects/<slug>/`

**Purpose:** Show what was built and why it matters.

- Header: name (`h1`), one-line description, status mark + label, stack chips, buttons ("Live site" solid if present, "Source" outline).
- Hero media (or the plate placeholder).
- Body in `.prose` with the three expected sections (**Why I built it · How it works · What I learned**).
- Facts panel (sticky ≥ 900px): status, started, shipped, role, stack, license, links.
- Gallery: up to 6 screenshots, click to enlarge (a simple `<dialog>`), each with alt and caption.
- Timeline: dated one-liners in mono.
- Related posts (by tag or `project:` reference).

Structured data: `SoftwareApplication` (or `CreativeWork` for non-software). Done when: every screenshot has alt; the gallery dialog traps focus and closes with Esc.

## Repo `/repos/<slug>/`

**Purpose:** Evaluate a repository quickly and get to GitHub.

- Header: `owner/name` in mono as the `h1` (owner dimmer), description, `.stats` row (language dot, stars, forks, updated), buttons ("View on GitHub" solid, "Copy clone command" outline).
- Body: the README (fetched at build time and sanitised, or local content), with install/usage blocks and copy buttons.
- Facts panel: license, latest release (+ date), topics as chips, size, default branch.
- "Posts about this repo": cards that mention it (via tag or `relatedProject`).
- Footnote: "Stats from GitHub, refreshed daily" with the build date.

Structured data: `SoftwareSourceCode`. Done when: the build succeeds with GitHub offline (uses cached data); README HTML is sanitised (no scripts, no inline event handlers); relative image links in the README are rewritten to absolute GitHub raw URLs **or** downloaded at build.

## Author `/authors/<slug>/`

**Purpose:** Who this is, and everything they wrote.

- Breadcrumb (Home / name). Avatar, `h1` name, subtitle, the **AI-written** chip for an agent, and the bio. R7's page says in its bio that it is an AI agent, not a person.
- Below it, the same toolbar, cards, pagination (`/authors/<slug>/page/N/`) and empty state as an archive, over that author's published posts of every kind (the draft and future-date rule applies as everywhere). Filters: kind, tag and search.
- Structured data: `ProfilePage` whose `mainEntity` is a `Person`, or an `Organization` for an agent, and a `BreadcrumbList`. In the sitemap, canonical and Open Graph like other pages; not in search (like archives and tag pages). No `/authors/` index page.

Done when: both authors' pages pass axe at 320 to 1480px, and an author with no posts shows the empty state (`tests/authors.spec.js`).

## Tags `/tags/` and `/tags/<tag>/`

A list of tags with counts, and for each tag the filtered archive (all kinds mixed, newest first, grouped by kind with `.kind` labels). The index's heading, lead, browser title, description and empty state are `src/content/pages/tags.md`; the tag pages' words are still in `src/pages/tags/[tag].astro`.

**By author filter.** The archives (`/news/`, `/blog/`, `/vlogs/`, `/projects/`, `/repos/`, `/latest/`) and a tag page have a "By author" row of buttons (All, then each author who has posts there), like the Kind row: a client filter, hidden without JavaScript, state in `?author=r7`. It shows only when two or more authors have posts in that list.

## Search `/search/`

Pagefind UI styled with tokens, opened from the header icon or the `/` key. Results show kind label, title, excerpt. Works without third-party requests. Keyboard: `/` opens, `Esc` closes, arrows move, Enter opens.

## About `/about/`

The author's own text only, written in /admin (**Pages > About page**) and stored in `src/content/pages/about.md`: the page heading, then an ordered list of blocks (heading, text, image, portrait and text, quote, callout, links list, button, divider; see `CONTENT_MODEL.md`, "Pages"). Today: "Hunter Newton" with the portrait beside the bio, then "R7 · Orbit AI Agent" in the same column. The portrait is a block with its own picture and alt text (file in `public/media/about/`), not `author.photo`. `Person` structured data and the meta description keep their values: the name and bio come from `site.json`, the description from `about.md`.

Layout: the page head, then one row per run of blocks (`Sections.astro`): a reading column (`.prose`, 68ch) for text-like blocks, a side column for a portrait, and a wider or edge-to-edge row for a wide or full image. At 375px and 1280px it looks exactly as it did before the page became editable (checked by comparing element positions and full-page screenshots). Done when: the text matches `tests/fixtures/about-text.txt`, axe passes, there is no horizontal scroll from 320 to 1480px and no layout shift.

## Subscribe `/subscribe/`

The form alone, plus what you'll get and how often, a link to RSS, and the privacy note. Success and error states are inline, polite, and in plain words (see `VOICE_AND_COPY.md`).

## 404

"That page has drifted out of orbit." The orbit (dot animating), a search field, links Home and Latest. Returns HTTP 404.

## Privacy `/privacy/`

Plain-language: what the site collects (nothing, or what the newsletter/analytics provider collects), where the form goes, how to unsubscribe, contact.

## Feeds

`/rss.xml` (everything, newest 50) and one per kind. Each item has title (without the `*` markers), link, `pubDate`, `dc:creator` (the author's name), summary as `description`, and full content for blog posts. Valid RSS 2.0; validate with the W3C feed validator. Vlog items include the video URL in the content. News items start with "Source: …".

## Cross-cutting acceptance checklist (every page)

- [ ] One `h1`; headings in order; landmarks (`header`, `nav`, `main`, `footer`)
- [ ] Unique `title` (≤ 60 chars) and `description` (≤ 155)
- [ ] Canonical URL, Open Graph, Twitter card, correct `og:image` size (1200×630)
- [ ] Works at 320px, 375px, 768px, 1280px, 1480px; no horizontal scroll
- [ ] Dark theme looks right
- [ ] Keyboard-only works; focus is visible; skip link works
- [ ] `prefers-reduced-motion` honoured (orbit still, no fades)
- [ ] No third-party requests before consent-free interaction
- [ ] Lighthouse mobile ≥ 95 in every category
- [ ] Zero console errors and warnings
