# Pages

Every page the site needs, what is on it, what states it has, and how you know it is done. Working HTML for each is in `templates/` (static, no framework): treat those as the visual reference and port them.

## Sitemap

```
/                              Home
/news/                         News archive           /news/<slug>/        News item
/blog/                         Blog archive           /blog/<slug>/        Blog post
/vlogs/                        Vlog archive           /vlogs/<slug>/       Vlog page
/projects/                     Project archive        /projects/<slug>/    Project page
/repos/                        Repo archive           /repos/<slug>/       Repo page
/tags/                         All tags               /tags/<tag>/         One tag
/search/                       Search (or a dialog opened with "/")
/about/                        About
/subscribe/                    Subscribe (the form on its own page, for links)
/rss.xml  /news/rss.xml  /blog/rss.xml  /vlogs/rss.xml  /projects/rss.xml  /repos/rss.xml
/sitemap-index.xml  /robots.txt  /404.html
/privacy/                      Privacy (when there is a form or analytics)
```

Navigation (header): **Latest · News · Blog · Vlogs · Projects · Repos · About**, then search. A section whose archive has fewer than three items is not in the header.

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

## Home `/`

**Purpose:** In five seconds, say what this is and show what's newest.

1. **Hero:** eyebrow (tagline), display headline with one italic-brass phrase, lead sentence, two buttons ("Start with the latest" solid, "Subscribe" outline). The animated orbit on the right (≥ 900px), above the text on small screens, smaller.
2. **Pinned:** the one `featured: true` post as a large horizontal card (media left, text right; stacked on mobile). Hidden if none.
3. **Latest:** `.seg` filter (All · News · Blogs · Vlogs · Projects · Repos), then the 8 newest across kinds in the card grid; the newest has `.fresh`. "See everything" link to `/archive` (or the `All` archive).
4. **Projects strip:** 3 newest projects (card with status mark). "All projects →".
5. **Repos strip:** 3 repos by most recent push. "All repos →".
6. **Subscribe band.**

States: filter with no results (can't happen on the home page since "All" is default; if a kind has no posts it isn't shown). Loading: none (static).

Done when: LCP element is the hero headline or the pinned card media (not the orbit); the orbit doesn't block interaction; filter works without JS as plain links to the archive pages (progressive enhancement).

## Archive `/<kind>/`

**Purpose:** Find something in one kind.

- Header: eyebrow (kind icon + label), `h1` (e.g. "Blog"), one-sentence lead, count.
- Toolbar: search field (filters in place), tag chips (toggle, multi-select = AND), sort `.seg` (Newest · Oldest), result count (`aria-live="polite"`).
- Grid of cards, 12 per page, pagination (Prev · 1 2 3 · Next) with real `<a>` links (`/blog/page/2/`).
- Empty state: "Nothing matches that." + "Clear filters" button.
- Tag and search state live in the URL (`?tag=evals&q=worktree`) so they can be shared.

Done when: works with JS off (shows the first page, pagination is links); with JS on, filtering is instant; keyboard users can operate chips (they are buttons with `aria-pressed`).

## Blog post `/blog/<slug>/` and News item `/news/<slug>/`

**Purpose:** Read comfortably.

- Breadcrumb (Home / Blog). Eyebrow (kind icon · read time). `h1` with italic-brass phrase. Lead (the `summary`).
- Byline: author, date (and "Updated …"), tags as chip links. Optional "How this was made" note.
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
- Title, meta row (date · duration), description (`.prose`), **chapters** list (mono timestamps; clicking seeks and plays), links/resources, transcript in a `<details>` if present, "Subscribe on YouTube" and "Subscribe by email" buttons, related videos.

Structured data: `VideoObject` (name, description, thumbnailUrl, uploadDate, duration as ISO 8601 `PT12M48S`, embedUrl). Done when: Lighthouse shows no third-party requests on first load; chapters work with the keyboard; the poster has no layout shift.

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

## Tags `/tags/` and `/tags/<tag>/`

A list of tags with counts, and for each tag the filtered archive (all kinds mixed, newest first, grouped by kind with `.kind` labels).

## Search `/search/`

Pagefind UI styled with tokens, opened from the header icon or the `/` key. Results show kind label, title, excerpt. Works without third-party requests. Keyboard: `/` opens, `Esc` closes, arrows move, Enter opens.

## About `/about/`

Intro in first person, a portrait (or the brand mark on the plate), what the site is, what the author is working on, how to follow (RSS, newsletter, YouTube, GitHub), contact. `Person` structured data.

## Subscribe `/subscribe/`

The form alone, plus what you'll get and how often, a link to RSS, and the privacy note. Success and error states are inline, polite, and in plain words (see `VOICE_AND_COPY.md`).

## 404

"That page has drifted out of orbit." The orbit (dot animating), a search field, links Home and Latest. Returns HTTP 404.

## Privacy `/privacy/`

Plain-language: what the site collects (nothing, or what the newsletter/analytics provider collects), where the form goes, how to unsubscribe, contact.

## Feeds

`/rss.xml` (everything, newest 50) and one per kind. Each item has title (without the `*` markers), link, `pubDate`, summary as `description`, and full content for blog posts. Valid RSS 2.0; validate with the W3C feed validator. Vlog items include the video URL in the content. News items start with "Source: …".

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
