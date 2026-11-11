# Pages

Every page the site needs, what is on it, what states it has, and how you know it is done. Working HTML for each is in `templates/` (static, no framework): treat those as the visual reference and port them.

## Sitemap

```
/                              Home
/news/                         News archive           /news/<slug>/        News item
/blog/                         Blog archive           /blog/<slug>/        Blog post
/vlogs/                        Vlog archive           /vlogs/<slug>/       Vlog page
/projects/                     Project archive        /projects/<slug>/    Project page
/apps/                         Apps hub (playable projects, games and apps; no pages of its own: each is /projects/<slug>/; /games/ redirects here)
/repos/                        Repo archive           /repos/<slug>/       Repo page
/tags/                         All tags               /tags/<tag>/         One tag
/authors/<slug>/               One author (hunter-newton, r7, pulsar, orion, kepler, hubble, parallax; no /authors/ index; docs/TEAM.md)
/search/                       Search (or a dialog opened with "/")
/about/                        About
/sitemap-index.xml  /robots.txt  /404.html
/privacy/                      Privacy (when there is a form or analytics)
/waitlist/remove/              Leave the waitlist (noindex; built only while the waitlist is on: see "Waitlist")
/api/waitlist  /api/waitlist-remove   POST endpoints (Cloudflare Pages Functions; the only server code; not pages)
```

Navigation (header): **Latest · News · Blog · Vlogs · Projects · Apps · Repos · About**, then search; the footer links to Apps too. A section whose archive has fewer than three items is not in the header.

## Shared parts (build once, reuse)

| Part | Notes |
|---|---|
| **Head** | `<title>`, description, canonical, Open Graph/Twitter, theme-color `#09090a`, icons, manifest, the three stylesheets, a tiny inline script that adds the `js` class |
| **Header** | Sticky, blurred, hairline underline. Wordmark left; nav; search; menu button below 900px |
| **Footer** | Wordmark, one line, links (GitHub, YouTube), © year, "Made with R7 Orbit" |
| **Post card** | The five variants in `DESIGN_SYSTEM.md` §9 |
| **Icon sprite** | News, blog, vlog, project, repo, arrow, star, fork, clock, calendar, external, github, search, menu, close, link, copy, play, sun |
| **Media placeholder** | Plate gradient + dot grid + ivory mark at 10% opacity |
| **Skip link** | First focusable element; jumps to `#main` |

## Pages whose words are edited in /admin

The home page, `/latest/`, the five archives, `/apps/` and `/tags/` take their words from `src/content/pages/<id>.md` (the `pages` collection, edited in /admin under **Pages**; fields in `CONTENT_MODEL.md`, "Pages"; the author's steps in `PUBLISHING.md`, section 11). What is made from the posts stays in code: the listing with its filters, counts and pagination, the apps grid and its type filter, the tag chips, the kind labels and icons (shared with the navigation). The numbered pages (`/blog/page/2/`) repeat their archive's words.

| Page | File | What the file holds |
|---|---|---|
| `/` | `home.md` | The hero (headline = the page's `h1`, eyebrow, lead, up to two buttons), the meta description, and the rows below the hero as blocks (`sections`): Pinned post, Latest feed, Latest posts (Projects), Apps row, Latest posts (Repos) |
| `/latest/`, `/news/`, `/blog/`, `/vlogs/`, `/projects/`, `/repos/` | `latest.md`, `news.md`, … | `h1`, browser title (`seoTitle`, today the kind's name), description, lead, the empty state (heading and text), blocks above and below the list (`introSections`, `outroSections`, empty today) |
| `/apps/` | `apps.md` | As an archive, plus the empty state's button and the "More apps coming" card (eyebrow, heading, text). The lead is interim (see "Apps" below) |
| `/tags/` | `tags.md` | As an archive. "Used once" stays in code |

The browser title of the home page is still `{site name} · {tagline}` from `src/data/site.json`. The words were moved without a change: `tests/page-text.spec.js` compares each page's rendered words with `tests/fixtures/pages/<id>.json`, captured from the pages before they became editable, and the pages were compared pixel for pixel at 375px and 1280px before and after.

## Home `/`

**Purpose:** In five seconds, say what this is and show what's newest.

Everything below the hero is a list of blocks in `home.md`, in the order below; the author can re-order, remove or add rows. Each data row is a block of the shared library (`SECTIONS.md`): Pinned post (`pinned`), Latest feed (`feed`, one per page; its anchor is `#latest`), Latest posts with a section frame (`latest`, Projects newest first, Repos by last push), Apps row (`apps`).

1. **Hero:** eyebrow (tagline), display headline with one italic-brass phrase, lead sentence, one button ("Start with the latest", solid), and the waitlist form when `home.md` has `waitlist: true` and the waitlist is on (see "Waitlist"). The animated orbit on the right (≥ 900px), above the text on small screens, smaller.
2. **Pinned:** the one `featured: true` post as a large horizontal card (media left, text right; stacked on mobile). Hidden if none.
3. **Latest:** `.seg` filter (All · News · Blogs · Vlogs · Projects · Repos), then the 8 newest across kinds in the card grid; the newest has `.fresh`. "See everything" link to `/archive` (or the `All` archive).
4. **Projects strip:** 3 newest projects (card with status mark). "All projects →".
5. **Apps row** (only when an app or game is published): up to 3 `AppCard`s in hub order, heading "Apps", "All apps →" to `/apps/`. No type filter here.
6. **Repos strip:** 3 repos by most recent push. "All repos →".

States: filter with no results (can't happen on the home page since "All" is default; if a kind has no posts it isn't shown). Loading: none (static).

Done when: LCP element is the hero headline or the pinned card media (not the hero picture); the hero picture (`HeroLaunch.astro`: wide screens only, no JavaScript, a still version under reduced motion) doesn't block interaction; filter works without JS as plain links to the archive pages (progressive enhancement).

## Archive `/<kind>/`

**Purpose:** Find something in one kind.

Words: `src/content/pages/<kind>.md` (`latest.md` for `/latest/`): the `h1`, lead, browser title, description, empty state, and optional blocks between the lead and the list (`introSections`) and between the list and the foot of the page (`outroSections`). The eyebrow (icon and label) is the kind's name in code. With no blocks above the list, the markup is the one the page always had. The fixture `/styleguide/listing/` draws an archive with blocks on both sides.

- Header: eyebrow (kind icon + label), `h1` (e.g. "Blog"), one-sentence lead, count.
- Toolbar: search field (filters in place), tag chips (toggle, multi-select = AND), sort `.seg` (Newest · Oldest), result count (`aria-live="polite"`).
- Grid of cards, 12 per page, pagination (Prev · 1 2 3 · Next) with real `<a>` links (`/blog/page/2/`).
- Empty state: "Nothing matches that." + "Clear filters" button.
- Tag and search state live in the URL (`?tag=evals&q=worktree`) so they can be shared.

Done when: works with JS off (shows the first page, pagination is links); with JS on, filtering is instant; keyboard users can operate chips (they are buttons with `aria-pressed`).

## Blog post `/blog/<slug>/` and News item `/news/<slug>/`

**Purpose:** Read comfortably.

- Breadcrumb (Home / Blog). Eyebrow (kind icon · read time). `h1` with italic-brass phrase. Lead (the `summary`).
- Byline: the author (avatar, name linking to `/authors/<slug>/`, subtitle, and an **AI-written** chip for an agent), date (and "Updated …"), tags as chip links. Optional "How this was made" note (not shown on an agent's post: the byline and its AI-written label already say it). No footer note on any post (removed 2026-10-21, `DECISIONS.md`).
- Cover (if any), then body in `.prose` (68ch measure).
- Sidebar (≥ 1200px): sticky table of contents with current-section highlight. Hidden on smaller screens (the TOC becomes a `<details>` above the body).
- Share row: Copy link (copies, says "Copied"), and links to the author's profiles. No third-party share widgets.
- Series navigation if `series` is set.
- **News only:** a "Source" box above the body: source name, link (external icon), and the `take` as a pull line.
- Related: 3 cards by shared tags. Prev / Next in the same kind.

Structured data: `Article` (`NewsArticle` for news). Done when: headings are in order, code blocks scroll horizontally without moving the page, images never overflow, the copy buttons work, print stylesheet is sensible (no header/footer/nav).

## Vlog `/vlogs/<slug>/`

**Purpose:** Watch, then read the notes.

- 16:9 player at the top. Until the visitor presses play it is a **facade**: the poster image, the play ring, the duration badge. On play, load the `youtube-nocookie.com` iframe and start playback. No YouTube request before that.
- Title, meta row (author byline · date · duration), description (`.prose`), **chapters** list (mono timestamps; clicking seeks and plays), links/resources, transcript in a `<details>` if present, a "Subscribe on YouTube" button, related videos.

Structured data: `VideoObject` (name, description, thumbnailUrl, uploadDate, duration as ISO 8601 `PT12M48S`, embedUrl). Done when: Lighthouse shows no third-party requests on first load; chapters work with the keyboard; the poster has no layout shift.

## Apps `/apps/`

**Purpose:** Find something to play or use in the browser, with nothing to install. Until 2026-10-06 this was the Games hub at `/games/`; `/games` and `/games/` now redirect here with a 301 (`public/_redirects`).

- An app is a `projects` entry with a `playUrl` (no collection of its own). Its type is `appType` (`game` or `app`, defined once in `src/lib/app-types.ts`; a playable project without it is an `app`). Only published entries are listed: drafts and future-dated posts go through the same helper as every list (`selectApps` in `src/lib/apps.ts`, which wraps `filterPublished`).
- Order: the optional `order` number (lower first), then those without one, newest first. The type does not change the order.
- Header: eyebrow (play icon + "Apps"), `h1` "Apps", one line. The `h1`, the line, the browser title and description, the empty state and the "More apps coming" card are `src/content/pages/apps.md`. **The lead is interim**: "Things I have built that run in your browser. No install." stands until the author writes the final one in /admin (**Pages > Apps page**). The description was reworded with the rename ("pick one and open it") and is the author's to change too.
- **Type filter** (only when two or more types have a published entry): a `.seg` labelled "Type" with **All**, then one button per type present, labelled by its plural ("Games", "Apps"), in the order of `APP_TYPES`, with a live count ("2 of 5 apps"). It follows the archives' filters: buttons with `aria-pressed`, hidden with JavaScript off (every card shows then), and the choice is kept in the address (`?type=game`, read on load; a type with no button is ignored). With one or two cards left it keeps the two-column grid.
- `AppGrid` of `AppCard`s: 1 column on a phone, 2 from 640px, 3 from 1000px; with one or two cards it stays at 2 columns. Each card: poster (the project's `cover`, or the `MediaPlaceholder`), a **type chip** (icon and label: play icon + "Game", project icon + "App"; a plain `.chip`, no colour of its own), title, one line, platform chips, a solid primary button and a **Details** link. The primary button says **Play** for a game and **Open** for an app; it goes to `/projects/<slug>/#play` (where it is embedded), or with `playMode: link` opens `playUrl` in a new tab. Details always goes to the project page. The first row (three cards) loads its posters at once, the rest are lazy; every poster sits in a 16:9 frame, so nothing shifts.
- With exactly one entry, a final dashed "More apps coming" card (no links) follows it.
- Empty state: the page entry's heading and text ("No apps yet."), with a link to the projects. The page is `noindex` and out of the sitemap while it is empty.
- Structured data: `CollectionPage` named "Apps", an `ItemList` of the entries in the order shown (omitted when empty) and a `BreadcrumbList` (Home / Apps). In the sitemap once one is published.
- Each playable project page ends with a "More apps" strip (up to three others of any type, never itself, and "All apps →"). The project page's structured data follows its type (`CONTENT_MODEL.md`, Playable projects), and so does its search result's label: **Game** or **App** (Pagefind meta `kind` and `kindIcon`, set on the project page header).

Done when: the layouts for 0, 1, 2 and 5 entries, and for several of one type, pass axe at 320 to 1480px, and the filter works by mouse, keyboard and address (`tests/apps.spec.js` runs them on the fixture `/styleguide/apps/`).

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

- Breadcrumb (Home / name). Avatar, `h1` name, subtitle, the **AI-written** chip for an agent with posts (**AI agent** for an agent with none), and the bio. Orbit's page says in its bio that it is an AI agent, not a person.
- Below it, the same toolbar, cards, pagination (`/authors/<slug>/page/N/`) and empty state as an archive, over that author's published posts of every kind (the draft and future-date rule applies as everywhere). Filters: kind, tag and search. With no posts, the empty state is "Nothing by <name> is posted yet." for a person and "<Name> is an AI agent and has no posts on this site." (no "Check back soon") for an agent: Parallax writes no posts, so its page always says that.
- Structured data: `ProfilePage` whose `mainEntity` is a `Person`, or an `Organization` for an agent, and a `BreadcrumbList`. In the sitemap, canonical and Open Graph like other pages, **while the author has a published post**; with none the page is `noindex` and out of the sitemap, like an empty archive (`AuthorPage`, `src/lib/sitemap.ts`). Not in search (like archives and tag pages). No `/authors/` index page.

Done when: the authors' pages pass axe at 320 to 1480px, and an author with no posts shows the empty state (`tests/authors.spec.js`).

## Tags `/tags/` and `/tags/<tag>/`

A list of tags with counts, and for each tag the filtered archive (all kinds mixed, newest first, grouped by kind with `.kind` labels). The index's heading, lead, browser title, description and empty state are `src/content/pages/tags.md`; the tag pages' words are still in `src/pages/tags/[tag].astro`.

**By author filter.** The archives (`/news/`, `/blog/`, `/vlogs/`, `/projects/`, `/repos/`, `/latest/`) and a tag page have a "By author" row of buttons (All, then each author who has posts there), like the Kind row: a client filter, hidden without JavaScript, state in `?author=r7`. It shows only when two or more authors have posts in that list.

## Search `/search/`

Pagefind UI styled with tokens, opened from the header icon or the `/` key. Results show kind label, title, excerpt. Works without third-party requests. Keyboard: `/` opens, `Esc` closes, arrows move, Enter opens.

Words: `src/content/pages/search.md` (**Pages > Search page**): the heading, browser title, description, and the note shown only without JavaScript (every block of the file is that note, drawn inside `<noscript>`). The eyebrow, the search box and the kind links are code. See "Pages with a fixed frame" below.

## About `/about/`

The author's own text only, written in /admin (**Pages > About page**) and stored in `src/content/pages/about.md`: the page heading, then an ordered list of blocks (heading, text, image, portrait and text, quote, callout, links list, button, divider; see `CONTENT_MODEL.md`, "Pages"). Today: "Hunter Newton" with the portrait beside the bio, then "Orbit · Orbit Lead Agent" in the same column, then "Meet the team" (a Heading block) over the **Team** block: a card per person and agent (Hunter Newton as Director, Orbit, Pulsar, Orion, Kepler, Hubble, Parallax), each with avatar, name linking to `/authors/<slug>/`, the page's title for them, an agent's subtitle and an **AI agent** label, and the bio from the author file (Hunter's from `site.json`). One column on a phone, two or three on a wide screen. `docs/TEAM.md`. The portrait is a block with its own picture and alt text (file in `public/media/about/`), not `author.photo`. `Person` structured data and the meta description keep their values: the name and bio come from `site.json`, the description from `about.md`.

Layout: the page head, then one row per run of blocks (`Sections.astro`): a reading column (`.prose`, 68ch) for text-like blocks, a side column for a portrait, and a wider or edge-to-edge row for a wide or full image. At 375px and 1280px it looks exactly as it did before the page became editable (checked by comparing element positions and full-page screenshots). Done when: the text matches `tests/fixtures/about-text.txt`, axe passes, there is no horizontal scroll from 320 to 1480px and no layout shift.

## 404

"That page has drifted out of orbit." The orbit (dot animating), a search field, links Home and Latest. Returns HTTP 404.

Words: `src/content/pages/404.md` (**Pages > Page not found (404)**): the heading (`title`), the browser title (`seoTitle`, "Page not found"), the description, and a Lead paragraph under the heading (other blocks follow it, above the search box). The orbit (`orbit.js`), the eyebrow "Error 404", the search form and the two buttons are code. The page stays `noindex`, and the host still answers unknown addresses with `dist/404.html` and a 404 status.

**The game (step 3 of the runner, `docs/RUNNER.md` "On the 404 page").** Under the two buttons, a full-bleed stage with no frame (`src/components/RunnerStage.astro`, styles in `src/styles/runner-stage.css`): 16:9 on a wide screen (never under 60% of the screen's height or over 720px), 3:4 on a phone, its top edge fading into the page. Until the first click, tap, Space or Enter it is a poster of inline SVG and CSS with one button, "Press space to play" ("Tap to play" on a touch screen), the game's own words (`src/game/runner/text.ts`); the game itself is fetched only then (and quietly prefetched once the page is idle and the stage is near, never on data-saver). The stage is after the page's buttons in the tab order, is not drawn without JavaScript, and shows the game's "This game needs WebGL." without WebGL. The page's own words, the orbit, the search form, the two buttons, `noindex` and the 404 status are unchanged. The one line the stage adds to `tests/fixtures/pages/404.txt` is its button, `button: Press space to play Tap to play` (both words are in the page; CSS shows one).

## Waitlist

A waitlist for access to R7 Orbit (the author's desktop app). **Off until the author turns it on** (Site settings → Waitlist, with a Turnstile site key; setup in `WAITLIST.md`). While off, no page carries any of its markup, CSS or script, and `/waitlist/remove/` is not built (it is the 404 page), so the site is exactly what it was.

- **Where:** the home hero (`waitlist: true` in `home.md`, variant `hero`: the email box and button on one row, wrapping on phones), and a ruled band after the body of any post with `waitlist: true` (variant `band`: heading, sentence, form), before related posts and previous/next, on blog and news posts (`ArticlePage`), vlogs, projects and repos; and anywhere the `waitlist` block is placed (`SECTIONS.md`). Sources: `hero`, `blog` (blog and news), `vlog`, `other` (projects, repos, or a block set to Other). The author's guide is `WAITLIST.md`.
- **The form** (`src/components/WaitlistForm.astro` + `waitlist/WaitlistFields.astro`, behaviour `src/scripts/waitlist.js`, styles `src/styles/waitlist.css` printed inline only on a page that draws a form): a labelled email box (no placeholder), the button, a hidden honeypot box (`company`), a status line (`role="status"`), the noscript sentence, and a small link to `/waitlist/remove/`. Every word is Site settings'. Targets are 44px; the status line and the link share a row that is always 44px tall, so a message appearing shifts nothing.
- **Turnstile:** loaded from `challenges.cloudflare.com` only when the reader focuses, touches or points at the form, or scrolls with it near (never with the page, so LCP, TBT and CLS are untouched; the home form, on screen at load, waits for a scroll too). Each form renders an `interaction-only` widget: invisible, unless Cloudflare needs the reader to tick it, and then it floats over the page in a panel (`--shadow-float`) instead of pushing content down. A token is used once; the widget resets after every answer. `public/_headers` lets `/projects/*` frame it.
- **Sending:** `fetch` POST to `/api/waitlist` (form-encoded: `email`, `source`, `company`, `cf-turnstile-response`). The button is `aria-disabled` while it waits (focus stays). Success is said only when the answer is `{ ok: true }`, and the box is cleared; a 400 shows the server's message; anything else, the settings' error message. Without JavaScript the form is hidden and the noscript sentence shown (Turnstile cannot run).
- **`/waitlist/remove/`:** `h1` and form only, posting to `/api/waitlist-remove`; noindex, out of the sitemap and of search. Always the same neutral sentence after removal.
- **The endpoints** (`functions/api/`, rules in `src/lib/waitlist-api.ts`): POST only, same origin, Turnstile Siteverify with `TURNSTILE_SECRET_KEY`, D1 `WAITLIST_DB`, `INSERT OR IGNORE` (a duplicate answers like a new address), JSON `no-store` answers; nothing stored but address, date, source; no email sent. Table: `migrations/0001_waitlist.sql`.

Tests: `src/lib/waitlist.vitest.ts`, `src/lib/waitlist-api.vitest.ts` (both endpoints against SQLite from the real migration), `tests/waitlist.spec.js` (the normal build carries none of it; a `WAITLIST_PREVIEW=1` build: lazy loading, sending, every failure, no-JS, the band on every post kind and on the author's two posts that ask for it (not on posts that do not), the block, the remove page, axe, widths, no layout shift). CI runs the second build.

## Privacy `/privacy/`

Plain-language: what the site collects (nothing, or what an analytics provider collects).

Words: `src/content/pages/privacy.md` (**Pages > Privacy page**). A Lead paragraph at the top sits under the heading; the rest is the policy in one `.prose` column; a Text block at the very end is the small print ("Last updated ..."). The file still carries two legacy newsletter paragraphs (`{if newsletter connected}` / `{if newsletter not connected}`); there is no newsletter, so only the "not connected" one is shown, and the author may rewrite the page. Before the waitlist is turned on, the page needs the author's paragraph about it: a Text block starting with `{if waitlist on}` is shown only while the waitlist is on.

## Pages with a fixed frame (privacy, 404, search)

These three keep their markup in `src/pages/*.astro` and take only their words from `src/content/pages/<page>.md` (the `pages` collection, the same schema and block library as About: `SECTIONS.md`). `src/lib/page-copy.ts` fills the settings tokens (`{site.name}`; an unknown one stops the build) and says which blocks go where (`privacySlots`, `lostSlots`). `src/components/PageBlocks.astro` draws those blocks in place with the library's own block components, adding no rows or wrappers, so each page's markup and spacing are what they were (`Sections.astro` would add its row padding). A Lead paragraph in a page head is drawn as `p.t-lead`.

When they became editable, their text was captured from `main` into `tests/fixtures/pages/<page>.txt` (title, description, robots, headings, paragraphs, links with addresses, form text) and `tests/pages.spec.js` compares the built pages with it line by line; full-page screenshots at 375 and 1280px were byte-identical before and after. Change a fixture in the same commit as a deliberate change to the words.

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
