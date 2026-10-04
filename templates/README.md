# Page templates

> **Frozen kit reference.** These pages still carry the original Ivory (light) theme toggle and its inline script. The real site is dark only and has neither (see `docs/DECISIONS.md`); do not port them.

Static HTML for every page type of the R7 Orbit site, built only from `../design-system/` (tokens and components) plus a small `site.css` and `site.js`. They are the visual reference to port into a real framework (Astro, Eleventy, Next, anything), not the final site. All text is **sample content**.

Open them through a static server (the fonts need `http://`):

```
python -m http.server 5191 --directory site-kit      # then http://localhost:5191/templates/index.html
```

## Files

| File | What it is |
|---|---|
| `index.html` | Home: hero with the orbit, one pinned post, "Latest" feed with a working kind filter, Projects strip, Repos strip, subscribe band |
| `archive.html` | One list template for `/news /blog /vlogs /projects /repos`. This copy is Blog. The comment at the top says how to switch kind. Search, tag chips, sort, live count, empty state, pagination |
| `post.html` | Blog post or news article: breadcrumb, byline, optional hero, `.prose` body, sticky table of contents, share row, related posts, previous/next. JSON-LD `Article` |
| `vlog.html` | Video page: 16:9 player with a click-to-load poster, chapters, transcript in `<details>`, links, related videos. JSON-LD `VideoObject` |
| `project.html` | Project page: status, stack, hero, why/how/learned sections, facts panel, screenshots, changelog timeline, related posts. JSON-LD `SoftwareApplication` |
| `repo.html` | Repo page: `owner/name` in mono, stats, GitHub and clone buttons, README panel with copyable code, facts panel, posts about the repo. JSON-LD `SoftwareSourceCode` |
| `about.html` | About: portrait placeholder, what the site is, links, subscribe |
| `404.html` | The calm 404: quiet orbit, search box, links home. Has `noindex` |
| `site.css` | Site-level layout and patterns only. Tokens only; mobile first; breakpoints 640 / 900 / 1200 / 1480 |
| `site.js` | Plain JS, no dependencies, no network (details below) |

Stylesheet order on every page: `tokens.css`, `components.css`, `site.css`. `orbit.js` is loaded only on pages with an orbit (home, 404).

## Shared partials

These blocks are identical on every page. Make each a component or include in the real site.

| Partial | Where in the templates | Notes |
|---|---|---|
| **Head meta** | everything inside `<head>` | title, description, canonical, Open Graph, Twitter, theme-color, icons, manifest, the inline theme script, stylesheets. Per page: `title`, `summary`, `slug`, `cover` (og:image). `og:type` is `website`, `article` or `video.other` |
| **Icon sprite** | first thing in `<body>` | the design system's icons plus search, menu, close, external, rss, github, clock, calendar, fork, link, mail, file. Use `<svg class="ico" aria-hidden="true"><use href="#i-name"/></svg>` |
| **Skip link** | right after the sprite | target is `<main id="main" tabindex="-1">` |
| **Header** | `<header class="site-header">` | set `aria-current="page"` on the active section. The nav links point at `archive.html?kind=...` so the kit previews; a real site links `/news/`, `/blog/`, `/vlogs/`, `/projects/`, `/repos/` |
| **Footer** | `<footer class="site-footer">` | RSS, GitHub, YouTube, Subscribe; "Made with R7 Orbit" |
| **Subscribe band** | `<section id="subscribe">` | one form, `data-newsletter` |
| **Post card** | `a.card` | five variants by kind (news, blog, vlog, project, repo); see `index.html`. One function with a `kind` switch in a real build |
| **Media placeholder** | `.media-ph` | plate gradient, dot grid, faded ivory mark. Replace with `<img src alt width height loading="lazy">` inside the same wrapper (`.card-media` or `.media`) |
| **Code block** | `.codeblock` | filename bar, copy button, `pre.code` with `tabindex="0"` so it scrolls by keyboard |

## `data-*` hooks used by `site.js`

| Hook | Where | Meaning |
|---|---|---|
| `[data-theme-toggle]` | header button | flips `data-theme="light"` on `<html>`; saved in `localStorage` key `r7-theme` |
| `[data-menu-toggle]` + `aria-controls="site-nav"` | header button | opens `#site-nav` (sets `data-open`); Esc, outside click and a link click close it |
| `[data-list]` | wraps a filterable list | home "Latest" and the archive |
| `[data-filter="kind"]` | a `.seg` | buttons with `data-value`: `all`, `news`, `blog`, `vlog`, `project`, `repo` |
| `[data-sort]` | a `.seg` | buttons with `data-value`: `newest`, `oldest` |
| `[data-search]` | text input | matches `data-title`, `data-text` and tags; every word must match |
| `[data-tags-filter]` > `button[data-tag]` | chip group | toggles; a post matches if it has **any** selected tag |
| `[data-count]` `data-noun` | live region | "12 posts" or "3 of 12 posts" |
| `[data-items]` > `[data-item]` | the grid and each card | each card carries `data-kind`, `data-date` (YYYY-MM-DD), `data-title`, `data-text`, `data-tags` (space separated slugs) |
| `[data-empty]` + `[data-clear]` | empty state and its button | shown at zero results |
| `[data-hide-filtered]` | e.g. pagination | hidden while a filter is active |
| `[data-copy]` | button | `"#id"` copies that element's text, `"@url"` copies this page's address, anything else is copied as it is. A `[data-copy-label]` span inside the button shows "Copied" for 1.6 s |
| `form[data-newsletter]` + `[data-newsletter-msg]` | subscribe form | placeholder only, nothing is sent (see below) |
| `.toc a[href^="#"]` | table of contents | the current heading gets `aria-current="true"` |
| `[data-player]` `data-embed` `data-title` | video player | with `data-embed` set, pressing play (or a chapter link with `data-start="seconds"`) adds a lazy iframe |
| `[data-player-play]`, `[data-poster]`, `[data-player-note]` | inside the player | the play button, things removed when the video loads, a placeholder message |

The archive also reads `?q=` and `?tag=a,b` from the address, and focuses the search box when the address ends in `#search` (the header search button and the 404 search box use these).

## Content fields each template needs

Names match `../docs/CONTENT_MODEL.md`.

**Every post:** `title`, `kind` (`news | blog | vlog | project | repo`), `date`, `updated`, `summary`, `tags`, `cover`, `coverAlt`, `readTime`, `featured`, `draft`, `slug`.

- **Cards** use `kind`, `slug`, `title`, `summary`, `date`, `readTime`, `tags`, `cover` (when there is one), and the kind's extras below.
- **`index.html`** also needs the one `featured` post (the pinned card; at most one per site) and the newest eight items by `date` (the first gets `.fresh`).
- **`post.html`:** the above, plus the rendered body; headings in the body become the table of contents (needs `id`s); previous/next by date; related posts by shared `tags`.
- **`vlog.html`** adds `videoUrl` (embed address), `duration` (`12:48`), `chapters` (`[{ time: "01:12", seconds: 72, title }]`), and optionally a transcript.
- **`project.html`** adds `status` (`working | done | idle`, shown as In progress, Shipped, Paused), `stack`, `liveUrl`, `repoUrl`, `started`, plus a changelog list (`date`, `version`, `text`) and screenshots (`src`, `alt`, `caption`).
- **`repo.html`** adds `repo` (`"owner/name"`), `language`, `stars`, `forks`, `license`, and from the GitHub API: `updated`, latest release, topics, size, and the README.
- **Site-wide** (from `site.json`): name, tagline, author name and photo, nav, social links, newsletter provider.

## What is placeholder

- **All text, names and numbers.** Author "Your Name", `your-username/...` repos, `example.com` URLs, the `1.2k views`, the stars and forks, the changelog, the transcript.
- **Canonical, `og:url`, `og:image`, JSON-LD URLs:** `example.com` (marked `TODO` in each head). On a live site these must be absolute. `og:image` points to `../brand/og-default.png`.
- **Images:** every image is the `.media-ph` placeholder.
- **Video:** the player is a poster. Nothing loads from a video host until the visitor presses play, and only when `data-embed` is set. The comment in `vlog.html` shows the `youtube-nocookie.com` iframe.
- **Newsletter:** `site.js` prevents the submit and shows a friendly message ("Sample only: nothing was sent"). Search it for `wire a real service`.
- **Share links** (Bluesky, LinkedIn) are `href="#"`. Copy link and Email work.
- **RSS** (`rss.xml`), GitHub and YouTube links in the footer and about page.
- **Pagination** links go to `archive.html?page=N`. A real site renders `/blog/page/2/` and so on at build time. Search and filter only cover the page you are on; for a whole-site search use a static index (for example Pagefind) loaded on interaction.
- **Repo stats** (stars, forks, language, updated, license, release, topics, size): fetch from the GitHub API **at build time** and cache them, so the page needs no script and no request. Do not call the API from the browser.
- **Nav hrefs** point at `archive.html?kind=...` so the kit works as a folder of files.

## Behaviour notes

- **No third-party requests.** Fonts are the design system's own woff2. No CDNs, analytics or embeds on load.
- **Without JavaScript** the pages read and navigate normally; the filter, sort and search controls are hidden (`html:not(.js)`), and the nav is a scrolling row under the wordmark. A real build should render the kind filter as links to the section pages.
- **Theme:** dark by default; Ivory is `data-theme="light"` on `<html>`. A tiny inline script in each `<head>` applies the saved choice before first paint. The theme-color meta follows the theme.
- **Reduced motion:** handled by the design system (durations drop, loops stop, the orbit holds still).

## Deviations from the design system

- `site.css` adds Ivory fixes for `.duration` and `.play svg`, whose text uses `--text` on a dark scrim (illegible on Ivory). They belong in `components.css`.
- `.media-ph` is the same pattern as the design-system page's `.ds-ph`, promoted to a site class.
- `site-nav` becomes a dropdown panel under 900px (the design system's nav is a scrolling row).
- Repo pages set the repo name in mono with no italic brass phrase.
