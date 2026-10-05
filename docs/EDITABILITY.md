# Editability audit: every page and every post as editable sections

Goal: the author can change **every page** of r7orbit.io, and the body of **every post**, in the Decap admin (`/admin`) as an ordered list of sections built from the site's components, the way the About page already works (`src/content/pages/about.md`, `src/admin/pages.ts`, `src/lib/page-sections.ts`, `src/components/Sections.astro`).

This is an audit and a plan. Nothing here is built. It was written against the repo at `b610b21` on `orbit/editability-audit-59be72`.

**How to read the evidence.** File paths and line behaviour were read in this checkout. Decap behaviour (section 4) is split into what this repo already proves by working code and what comes from Decap's documented behaviour and my knowledge of it. `node_modules` was not installed in this worktree, so Decap's source was not re-read; those items are marked **(unverified here)** and should be checked in a 30-minute spike before anyone depends on them.

---

## 0. Findings in one screen

1. **Only 2 of ~20 page types are editable beyond their post fields today**: posts (five collections, `src/admin/config.ts`) and About (`src/admin/pages.ts`). Everything else (home, archives, `/games/`, tags, subscribe, privacy, 404, search, nav, footer, subscribe band) has its words in `.astro` or `.ts` files.
2. **The data-driven pages are the hard part, not the text.** Home, archives, `/games/`, tags and author pages are queries over the content collections. "Sections" for them must mean *blocks that hold configuration* (which kind, how many, what heading) and are rendered by code that queries content at build time. A block list can express that; Decap cannot preview it faithfully (section 4).
3. **Posts: recommend option (b), strictly as "sections replace the body" (mutually exclusive with `body`)**, shipped for all five kinds, with the old Markdown body kept working for existing posts. Section 3 has the comparison. Existing real content is tiny (3 posts and the About page), so migration is cheap now and gets more expensive with every post written in the old shape.
4. **Everything downstream of a post body reads `post.body` as Markdown**: reading time (`src/lib/content.ts:104`), the blog table of contents (`ArticlePage.astro:62`, `headings` from `render()`), the RSS content (`src/lib/feed-queries.ts:32`), the blog admin preview (`src/admin/preview.ts:76,91`), and Pagefind (indexes the rendered HTML, so it is fine). A sections body needs one pure projection (`sections -> plain text, headings, HTML`) that all of them call. That projection is the real work item.
5. **Nav is coupled to labels.** `Header.astro` highlights by `item.label === current`, and every page passes a hard-coded label string (`current="Blog"`); `src/data/nav.ts` maps label to href through a hard-coded table; `search.astro` filters nav by label. Making nav editable means matching by href, not label.
6. **Placeholder content that must be answered by the author, not invented**: `site.json` `author.email` is `hello@example.com` and is printed on `/privacy/`; `links.github`, `x`, `linkedin`, `bluesky` are empty; `newsletter.formAction` is empty, so signup is a mock.
7. **Small existing issues the migration will touch**: both `src/content/blog/test.mdx` and the vlog contain a raw `<a class="btn solid lg">` (the sections `button` block renders `btn solid`, no `lg`); the blog's slug is `test` (`/blog/test/`), so a rename is a URL change; `src/content/news/` and `src/content/repos/` do not exist on disk.

---

## 1. Route map

Legend for **Editable today**: `Admin` = a Decap collection/field exists; `Code` = only in a file in the repo; `Partly` = some parts.

| Route | Rendered by | Text and data come from | Editable today |
|---|---|---|---|
| `/` | `src/pages/index.astro` | Hero H1 "Plain notes on building with *AI agents*." and both hero buttons: hard-coded in the page. Eyebrow = `site.tagline`, lead = `site.description` (`src/data/site.json`). "Pinned / Start here", "Latest", "Browse by kind", "Things I am making / Projects", "Open source / Repos", all section titles and eyebrows, the two empty states: hard-coded in the page. Games teaser eyebrow: `GAMES_COPY.teaserEyebrow` (`src/lib/games.ts`); its H2 "Games": hard-coded. Cards: posts from the five collections. Which post is pinned: `featured` on a post | Posts' `featured`: **Admin**. `tagline` / `description`: **Code** (`site.json`). Everything else on the page: **Code** |
| `/latest/`, `/latest/page/N/` | `src/pages/latest/index.astro`, `latest/page/[page].astro` -> `src/components/ArchivePage.astro` | Heading "Everything, *newest first*", lead, label "Latest": literals in `ArchivePage.astro:32-34`. Description = `site.description`. Posts: all five collections. Page size 12: `PAGE_SIZE` in `src/lib/listing.ts` | **Code** |
| `/news/`, `/blog/`, `/vlogs/`, `/projects/`, `/repos/` and `/<kind>/page/N/` | `src/pages/<kind>/index.astro`, `<kind>/page/[page].astro` -> `ArchivePage.astro` | Label, icon, noun, H1, lead, meta description, empty-state heading: the `KINDS` array in `src/lib/listing.ts:23-79`. Empty-state body "Check back soon, or subscribe below…": `ArchiveList.astro:46`. Posts: the kind's collection | **Code** |
| `/<kind>/rss.xml`, `/rss.xml` | `src/pages/<kind>/rss.xml.ts`, `src/pages/rss.xml.ts` -> `src/lib/feed-queries.ts` | Channel title/description built from `site.name`, `site.description` and a `KIND_LABEL` map in `feed-queries.ts:18`. Items from posts | Items: **Admin** (via posts). Channel text: **Code** (`site.json`) |
| `/blog/[slug]/`, `/news/[slug]/` | `src/pages/blog/[slug].astro`, `news/[slug].astro` -> `src/components/ArticlePage.astro` | Frontmatter + MDX/MD body. Chrome literals: breadcrumb, "min read", "Updated", "How this was made.", "Source", "My read:" | Post fields and body: **Admin** (`blogCollection`, `newsCollection`). Chrome: **Code** |
| `/vlogs/[slug]/` | `src/pages/vlogs/[slug].astro` | Frontmatter + body split at `## Transcript` (`components/vlog/renderNotes.ts`). Literals: "About this video", "Transcript", "Show the transcript", "Follow along", "Subscribe on YouTube", "Get new videos by email", "More videos / Keep watching", "Older video / Newer video" | Post fields and body: **Admin** (`vlogsCollection`). Page literals: **Code** |
| `/projects/[slug]/` | `src/pages/projects/[slug].astro` | Frontmatter (status, stack, gallery, timeline, play fields, controls) + body. Literals: "Screenshots", "Changelog", "Facts", "Related posts / Writing about it", "More games / Play in the browser", "Live site", "Source repo" | Fields and body: **Admin** (`projectsCollection`). Literals: **Code** |
| `/repos/[slug]/` | `src/pages/repos/[slug].astro` | Frontmatter + optional local body; README and stats fetched from GitHub at build (`src/lib/github.ts`). Literals: "Facts", "View on GitHub", "Copy clone command", "Posts about this repo", README fallback callouts | Fields and body: **Admin** (`reposCollection`). README: GitHub, not editable here. Literals: **Code** |
| `/games/` | `src/pages/games/index.astro` -> `GamesSection.astro`, `GameGrid.astro`, `GamesEmpty.astro` | Games = `projects` with `playUrl` (`src/lib/games.ts`). Title, lead, description, empty text, "More games coming" card, teaser eyebrow: `GAMES_COPY` (`games.ts:10-20`). "Next up", "See the projects": components | Games: **Admin** (project play fields, `order`). Page copy: **Code** |
| `/tags/` | `src/pages/tags/index.astro` | Eyebrow, H1 "Browse by *topic*", lead, description, empty state "No tags yet.", "Used once": literals. Tags: posts' `tags` | Tags: **Admin**. Page copy: **Code** |
| `/tags/[tag]/` (a tag with 2+ posts) | `src/pages/tags/[tag].astro` | H1 "Posts tagged *tag*", lead "N posts, newest first within each kind.", description: template literals | **Code** |
| `/authors/[slug]/`, `/authors/[slug]/page/N/` | `src/pages/authors/[slug]/index.astro`, `…/page/[page].astro` -> `src/components/AuthorPage.astro` | Name, subtitle, bio, avatar, note: `src/content/authors/*.json` (a person without them reads `site.json` `author`). Empty text "Nothing by {name} is posted yet.": `AuthorPage.astro:83` | Author record: **Admin** (`authorsCollection`). Page literals: **Code** |
| `/about/` | `src/pages/about.astro` -> `Sections.astro` | `src/content/pages/about.md` (title, seoTitle, description, `sections`). Person JSON-LD from `site.json` `author` and `links` | Page: **Admin** (`pages` > About page, live preview). JSON-LD person: **Code** (`site.json`) |
| `/subscribe/` | `src/pages/subscribe.astro` + `NewsletterForm.astro` | Eyebrow "Newsletter", H1 "One email when something new is *worth reading*", lead, "What you'll get" and both paragraphs, the privacy line, meta description: literals in the page. Provider: `site.newsletter` | **Code** |
| `/privacy/` | `src/pages/privacy.astro` | The whole policy (6 H2 blocks) and "Last updated 2026-10-03": literals in the page. Two variants of the newsletter paragraphs switch on `site.newsletter.formAction`. Contact email: `site.author.email` | **Code** |
| `/search/` (noindex) | `src/pages/search.astro` + `Search.astro` + `src/scripts/search.js` | Eyebrow, H1 "Find a *post*", noscript note, description: literals. Index: Pagefind over `dist/` (`pagefind.yml`) | **Code** |
| `/404.html` (served for unknown paths; noindex) | `src/pages/404.astro` | "Error 404", H1 "That page has drifted *out of orbit*.", lead, form copy, two buttons, description: literals | **Code** |
| `/admin/` (noindex) | `src/pages/admin/index.astro` -> `src/admin/main.ts` | Decap, config in `src/admin/config.ts` | n/a |
| `/styleguide/`, `/styleguide/{specimen,article-components,games,author-empty,playable,sections}/` (noindex, unlinked) | `src/pages/styleguide/*.astro` | Developer fixtures and specimens used by the tests (`tests/routes.js`) | Should stay in code |
| `/robots.txt`, `/sitemap-index.xml`, `/sitemap-0.xml` | `src/pages/robots.txt.ts`, `sitemap-index.xml.ts`, `sitemap-0.xml.ts` -> `src/lib/sitemap.ts` | Generated. Static pages are found by scanning `src/pages` (`pagePathFromFile`); listings are added by content | n/a. A new editable-page route must be added to this machinery (section 6) |
| `/site.webmanifest`, `/_headers`, `/_redirects` | `public/` | Static files. The manifest repeats `site.name` and `site.description` | **Code** |
| Header and footer on every page | `src/components/Header.astro`, `Footer.astro`, `src/data/nav.ts` | Nav labels: `site.json` `nav` (editable only in code); href map: hard-coded in `nav.ts`. Footer: link list hard-coded in `Footer.astro:6-12` (hrefs from `site.links`), "Made with R7 Orbit", brand text = `site.description` | **Code** |
| Subscribe band on many pages | `src/components/SubscribeBand.astro` | Eyebrow "Newsletter", heading, text (both are props with defaults), label, placeholder | **Code** |

Notes on page types:

- **Routes that exist only because content exists:** `/<kind>/[slug]/`, `/tags/[tag]/` (2+ posts, `tagsWithPages` in `src/lib/content.ts:124`), `/<kind>/page/N/` (more than 12 posts), `/authors/[slug]/`. An author cannot "create" these as pages; they appear with content. Sections for these page types therefore edit a **template** (shared by all pages of that type) or a **per-entry body**, not a page.
- **No pagination on `/games/`, `/tags/`, `/search/`.**
- The sitemap decides indexability by reading `noindex` out of `.astro` source (`sourceIsNoindex`, `src/lib/sitemap.ts:36`). If page files become generated from content, that mechanism does not see them. Section 6 covers it.

---

## 2. Hard-coded copy inventory

`A` = content the author would plausibly want to edit. `C` = UI chrome that should stay in code (labels, ARIA, microcopy, error text tied to behaviour). Counts below are strings, not words. Items already driven by a content file are not repeated (post fields, the About page, authors).

### 2.1 Home (`src/pages/index.astro`)

| Line | String | |
|---|---|---|
| 59 | H1 "Plain notes on building with *AI agents*." | A |
| 62-63 | Buttons "Start with the latest" -> `#latest`, "Subscribe" -> `#subscribe` | A |
| 75-77 | "Pinned", "Start here" | A |
| 88 | "Latest" (section title) | A (the id `#latest` is a link target: keep) |
| 91-95, 31 | "Filter by kind", "All", kind plurals "News/Blogs/Vlogs/Projects/Repos" | C |
| 103 | feed count text | C |
| 108-110 | "Nothing matches that." / "None of the latest posts are of this kind…" / "Show all posts" | A, A, C |
| 115-116 | "Nothing is posted yet." / "Subscribe below and I will send an email when the first post is up." | A |
| 121-127, 136-138 | "Browse by kind", "Browse everything" | A |
| 150-157 | "Things I am making", "Projects", "All projects" | A |
| 170-174 | `GAMES_COPY.teaserEyebrow` "Play in the browser", "Games", "All games" | A |
| 188-192 | "Open source", "Repos", "All repos" | A |
| 8-12 (slots) | Which sections appear, in which order, how many cards (8 / 3 / 3 / 3), and the pinned rule | A (structure) |

### 2.2 Archives (`ArchivePage.astro`, `src/lib/listing.ts`, `ArchiveList.astro`)

| Where | String | |
|---|---|---|
| `listing.ts` `KINDS`, 5 kinds x (`title`, `lead`, `description`, `empty`) | e.g. "News, with my *take* on it"; "Short items on what happened in AI…"; "No news items yet." | A (20 strings) |
| `listing.ts` `noun`, `nounOne`, `label` | "items/item", "posts/post", "videos/video"… used in counts | C |
| `ArchivePage.astro:32-34` | Latest: label, H1 "Everything, *newest first*", lead | A |
| `ArchiveList.astro:46` | "Check back soon, or subscribe below and I will send an email when something is posted." | A |
| `ArchiveList.astro:129-131` | "Nothing matches that." / "Try fewer words, or clear the filters." / "Clear filters" | A, A, C |
| `ArchiveList.astro:56-104` | "Filter and sort…", "Search …", "Sort", "Newest", "Oldest", "Kind", "All", "By author", "Tags" | C |
| `Pagination.astro` | "Pagination", "Previous page", "Next page", "Page N" | C |

### 2.3 Games (`/games/`, `src/lib/games.ts` `GAMES_COPY`, `GamesEmpty`, `GameGrid`, `GameCard`, `PlayPanel`)

| String | |
|---|---|
| `label`, `title` "Games", `lead` "Small games that run in your browser. No install.", `description`, `empty`, `emptyText`, `soonTitle` "More games coming", `soonText`, `teaserEyebrow` | A (9, already centralised in one object: the easiest to move) |
| `GameGrid.astro:31` "Next up"; `GamesEmpty.astro:9` "See the projects" | A |
| `GameCard`: "Works on", "Desktop/Mobile", "Play", "(opens in a new tab)", "Details" | C |
| `PlayPanel`: "Play", "Fullscreen", "Open in a new tab", the focus-instruction paragraph (line 46), "Controls", noscript text | C |
| `PlayableBadge` "Playable" | C |
| Per-game `playNote`, `controls`, `platforms`: already content | done |

### 2.4 Tags, search, author pages

| Where | String | |
|---|---|---|
| `tags/index.astro:15-40` | description, eyebrow "Tags", H1 "Browse by *topic*", lead, "No tags yet.", "Tags appear here once a post uses one.", "Used once" | A |
| `tags/[tag].astro:24-50` | description template, H1 "Posts tagged *{tag}*", "{n} posts, newest first within each kind." | A (templates with a `{tag}` placeholder) |
| `tags/[tag].astro` filter UI | "Filter posts", "By author", "All", "All tags" | C |
| `search.astro` | description, eyebrow "Search", H1 "Find a *post*", noscript note | A |
| `Search.astro`, `search.js` | "Type to search…", "Close", key hints, "Nothing found for…", result kind labels | C |
| `AuthorPage.astro:83` | "Nothing by {name} is posted yet." | A |

### 2.5 Subscribe (`subscribe.astro`, `SubscribeBand.astro`, `NewsletterForm.astro`, `src/lib/newsletter.ts`)

| Where | String | |
|---|---|---|
| `subscribe.astro` | description, eyebrow "Newsletter", H1, lead, "What you'll get", two paragraphs, the privacy-page line | A (about 8 strings) |
| `SubscribeBand.astro:11-12` | default heading "One email when something new is worth reading", default text "New posts and videos, a few times a month. No tracking, and you can leave in one click." | A (used on many pages as one string: belongs in site settings) |
| `NewsletterForm.astro:42` | "One email when something new is worth reading. Unsubscribe any time." | A |
| `newsletter.ts` `MESSAGES.invalid/failed/ok` | form result messages | A (but see below) |
| `newsletter.ts` `MESSAGES.okMock`; `site.js:270,278` | mock wording | C. **Drift risk:** `site.js:270,278` duplicates `MESSAGES` wording and is not wired to it, so editing one leaves the other stale |
| Labels "Email address", "Subscribe", placeholder, "Subscribing…" | C |

### 2.6 Privacy (`privacy.astro`)

The whole page is author prose: H1 "What this site *knows about you*", lead, six H2 sections (The short version; What stays on your device; The newsletter; Videos and links to other sites; Server logs; Contact), "Last updated 2026-10-03" (a literal date in the file, passed through `longDate`). It reads like a legal text and the "newsletter" section has **two variants** switched by `site.newsletter.formAction` and names `site.newsletter.provider`. **A, all of it.** The conditional is the editability problem: a plain sections list cannot express "show this paragraph only when the newsletter is connected" (Decap has no conditional fields, section 4). Proposal: two optional text blocks ("when connected" / "when not connected"), or one block with an explicit `{provider}` placeholder and a single text.

### 2.7 404 (`404.astro`)

Description, "Error 404", H1 "That page has drifted *out of orbit*.", lead, "Back home", "See the latest": **A**. Search form labels, placeholder, "Search": **C**.

### 2.8 Header, footer, layout

| Where | String | |
|---|---|---|
| `site.json` `nav` | the eight labels. Hrefs: hard-coded map in `src/data/nav.ts:4-13` | A (labels, order, which pages) |
| `Footer.astro:6-12` | link set (Games, RSS, GitHub, YouTube, Subscribe) and their order | A |
| `Footer.astro:42` | "Made with R7 Orbit" | A (small) |
| `Footer.astro:24` | tagline paragraph = `site.description` | already settings |
| `Header.astro` | "Search", "Open menu", "{name}, home" | C |
| `BaseLayout.astro:60` | default OG image alt text, which quotes "News, builds and the things in between." | A (belongs with the default OG image) |
| `BaseLayout.astro:116` | "Skip to content" | C |
| `ShareRow.astro` | "Share this post", "Copy link", "Email", network names | C |

### 2.9 Post-page chrome (leave in code)

`ArticlePage.astro` (breadcrumb, "min read", "Updated", "How this was made.", "Source", "My read:"), `TableOfContents`, `SeriesNav`, `PrevNext`, `RelatedPosts` ("Related" / "Keep reading": **A**, the only editable-looking pair), vlog page literals, project page literals ("Screenshots", "Changelog", "Facts", "Related posts", "More games"), repo page literals, `AuthorNote` ("About {name}"), `ReadmeBlock`, `StatsRow`, `StatusMark` labels, `Gallery` controls, `YouTubeFacade`, `PreviewBadge`. All **C**, except the section titles on those pages that a page-template editor might want ("Keep reading", "More videos", "Writing about it"); proposal in section 6 keeps them in code.

### 2.10 Text that is business logic dressed as copy

`ASSIST_NOTES.edited/drafted` in `src/lib/authors.ts:73-74` ("Written by me and edited with AI help."): the author's own disclosure wording (`CLAUDE.md` says never write an agent's note yourself). Editable would be reasonable, but it is a transparency statement: if made editable it should be an explicit settings field with a hint, not free text in a page body.

### 2.11 Totals

About 110 distinct strings in code. Roughly 45 are **author content** worth editing (hero, section titles and eyebrows, archive intros, games copy, tags/search/404/subscribe/privacy copy, empty states), the rest are chrome. The 45 cluster into **8 places**: home, the five archive intros + latest (one list in `listing.ts`), games (`GAMES_COPY`), tags, search/404, subscribe, privacy, and the subscribe band. That clustering is what makes the plan in section 6 feasible in about 6 tasks.

---

## 3. Posts: how bodies work today and how to give them sections

### 3.1 How bodies are authored today

| Kind | Files | Body format and renderer | Components/blocks that work | Admin body widget |
|---|---|---|---|---|
| Blog | `src/content/blog/*.mdx` (collection glob accepts `.md` and `.mdx`; the admin writes `.mdx`: `config.ts:630`) | MDX through `@astrojs/mdx`, rendered by `render()` then `<Content components={articleComponents}>` in `ArticlePage.astro:160` | All article components (`src/components/article/mdx.ts`): Callout, CodeBlock, Divider, Figure, Heading, ImageGallery/ImageRow, Paragraph, Prose, Pullquote, Quote, Subheading, Toc, TwoColumn, VideoEmbed. Seven are offered as editor blocks (`ARTICLE_COMPONENT_NAMES`, `src/admin/blocks.ts`): Figure, Callout, Quote, ImageGallery, TwoColumn, VideoEmbed, Divider | Markdown widget, editor blocks write MDX tags |
| News | `src/content/news/*.md` (folder not present yet) | Markdown, rendered through the same `ArticlePage` + `articleComponents`, but a `.md` file cannot contain components | Markdown only: remark plugins: callouts, figures (`![alt](src)` plus an italic caption line), image-alt check; code highlighting | Markdown widget, only `image` and `code-block` blocks (`plainBody`) |
| Vlogs | `src/content/vlogs/*.md` | Markdown, **not** `render()`: `renderMarkdown()` in `components/vlog/renderNotes.ts` with the same plugins; body split at `## Transcript` into "About this video" and a collapsed transcript | Markdown only | same as news |
| Projects | `src/content/projects/*.md` | Markdown through `render()` and `<Content />` (no components passed), shown under "Write-up" | Markdown only. Gallery, timeline, controls, facts are **front matter**, not body | same as news |
| Repos | `src/content/repos/*.md` (folder not present yet) | Markdown through `render()`, shown as "Notes". The README comes from GitHub unless `readme: local`, in which case the body replaces it | Markdown only | same as news |

Two things follow. First, **only the blog is "sections-ready" today**, and it gets there by embedding MDX tags in a Markdown stream. Second, the four non-blog kinds are split between **structured front matter** (the page's "facts" parts, already editable as typed lists) and a **free Markdown body**. Sections would replace only the free body, which is the narrative part.

### 3.2 The three options

**(a) Convert every collection to MDX.**

- Mechanics: rename `.md` to `.mdx`, set `extension: 'mdx'` in each collection, pass `articleComponents` to `<Content>` in vlog/project/repo pages, extend feed rendering (already uses an MDX container, `feed-queries.ts:88`).
- Pros: smallest code change; one body model; the blog already proves the round trip with Decap.
- Cons, and they are decisive:
  - The result is still a **linear Markdown stream with tags in it**. The author gets no drag handles, no per-block collapse, no block summary lines, no type picker: Decap's Markdown widget has one in-flow editor and "editor components" are inserted at the cursor. That is not "an ordered list of sections like About".
  - No layout rows. `Sections.astro` supports a portrait beside text and wide/full images via `layoutSections`; MDX components cannot reproduce row logic without new components.
  - Validation is weaker: block props are checked only when the build compiles MDX (`blocks.ts` mentions strict patterns because Decap's round trip is fragile). An MDX syntax mistake fails the build with an opaque MDX error instead of the schema's "sections.3.alt" style message that About already gets.
  - Decap's Markdown serializer can rewrite or drop MDX it does not recognise. Raw HTML in a body (both existing posts have `<a class="btn solid lg">`) is at risk; this is why `blocks.ts` has exact patterns per tag.
  - Vlog notes use a separate Markdown processor (`renderNotes.ts`), not MDX; project pages call `<Content />` with no components. Both need changes anyway.

**(b) Add an optional `sections` list to the front matter next to the Markdown body.**

- Mechanics: add `sections: z.array(sectionSchema).max(60).default([])` to the shared `common` object in `src/content.config.ts`, add the same `list` with `types` to the post fields in `src/admin/config.ts`, render `Sections` where the body is rendered today.
- Pros: **backwards compatible** (a post without `sections` is unchanged: no content migration required to ship); the same schema, renderer and block definitions as About (the library task's output) with the same per-block validation messages; works the same in all five kinds; the editor already works this way for About.
- Cons: two ways to write one post unless constrained; larger front matter; Decap rewrites YAML on save (see 4.4).
- To make it safe: **a schema refinement that rejects a post with both a non-empty `sections` and a non-empty body**, and an admin hint. Then "(b)" is really "choose a body mode per post".

**(c) Replace the body with sections only.**

- Mechanics: remove `body` from the admin for all kinds, convert every existing post, delete the Markdown rendering paths.
- Pros: one model; cleanest end state.
- Cons: forces migration of every existing post at once, including the blog's 7 KB, 12-heading essay (a hand-conversion into `heading` and `text` blocks, easy but manual); loses the Markdown editor's speed for long prose (a 3,000-word post as 80 `text` blocks is worse to write than one Markdown field); vlog transcripts (a long single Markdown document) need a dedicated field; no rollback.

### 3.3 Recommendation: (b), with "sections XOR body", then converge on (c)

Why:

1. It is the only option that is **additive**. Nothing that works today has to be touched to ship it, so the five post kinds, RSS, search and the blog preview keep working while the new path is built and tested.
2. It reuses exactly what About already proves: the block schema, strict validation with block-numbered messages, the `Sections` renderer, the admin `types` list, the sections preview. (a) throws that away; (c) cannot be done safely in one step.
3. Long prose stays cheap: the author can keep writing a long essay as Markdown and use sections where layout matters (a portrait, a callout, a gallery, a button). A single `text` block takes full Markdown, which `section-markdown.ts` already renders with sanitising.
4. Migration is then optional per post, with a codemod (section 6, task E) that converts `body` into `heading` and `text` blocks (split at `##`), which can run when the author is ready. Once all posts are converted, delete `body` from the admin: that is (c) with no big-bang.
5. Existing real content is 3 posts, so there is no data-migration pressure either way. Doing the plumbing now is cheaper than after twenty more posts.

What (b) needs that the library task should expose (I recommend asking for these now, because every post path depends on them): `sectionsToText(sections)`, `sectionsHeadings(sections)` (depth, text, slug identical to `rehypeHeadingIds` so existing `#anchors` survive), and `sectionsToHtml` (for RSS). Plus block types that posts need and About does not: code, video (YouTube id), image gallery (2-3), two columns, pullquote. About's current nine (`heading, text, image, portrait, quote, callout, links, button, divider`) cover the blog essay and most news items; they do **not** cover `Figure`'s align/size, `ImageGallery`, `TwoColumn`, `VideoEmbed`, `CodeBlock`.

Vlogs need a sections-aware **transcript**: today `splitTranscript` finds `## Transcript` in the body. With sections there is no such heading, so add a `transcript` block (renders in the existing `<details>`) or a separate Markdown field `transcript`. Recommendation: a separate optional `transcript` field outside the list, because it is a very long single document.

### 3.4 Existing content and what would change

| File | Size | Kind | What it uses | Change under (b) | Risk |
|---|---|---|---|---|---|
| `src/content/blog/test.mdx` | 7.2 KB | blog, `author: r7`, `featured: true`, series "Browser Games" #1, `tags: []` | 12 headings, one H1 (`# Vesper Drift: …`, demoted to H2 at build by `rehypeBodyHeadings`), paragraphs, inline code, one raw `<a class="btn solid lg" href="https://vesper.r7orbit.io/">`. No article components | **None required.** Optional later conversion: ~12 `heading` + ~12 `text` blocks + a `button` block. The first H1 becomes an H2 heading block | Slug is `test` so the URL is `/blog/test/`: **do not rename** without a redirect in `public/_redirects`. The raw anchor renders `btn solid lg`, the `button` block renders `btn solid` (no `lg`): a small visual difference unless the block gains a size. Heading anchors: `*Plan*` etc. become italic headings; keep the slugs identical so deep links still work. TOC (12 H2s, so it shows) must be reproduced from heading blocks |
| `src/content/vlogs/building-a-browser-game-with-ai-agents-in-r7-orbit.md` | 1.3 KB | vlog, `author: r7`, `featured: true` | one italic-lead paragraph + the same raw `<a class="btn solid lg">`; no transcript | None required. Optional: 1 `text` + 1 `button` | Same button size difference. `transcript: false`, so no split needed |
| `src/content/projects/vesper-drift.md` | 1.9 KB | project, playable, `shipped` | 2 paragraphs, one internal link. Controls, play fields, tags in front matter, hand-written in YAML flow style (`tags: [ … ]`, `controls: - { key: …, action: … }`) | None required. Optional: 2 `text` blocks | The first admin save reformats the front matter (flow style to block style): one noisy diff, no meaning change. Not caused by sections |
| `src/content/pages/about.md` | 1.6 KB | page | already `sections` | none (owned by the running library task) | n/a |
| `src/content/authors/hunter-newton.json`, `r7.json` | tiny | authors | no body | none | n/a |
| `src/content/news/`, `src/content/repos/` | n/a | not present | n/a | none; first entries are written in the new shape | `glob()` on a missing `base` logs a warning (check; builds today) |

### 3.5 Risk register by feature

| Feature | Today | Breaks when body is sections | Mitigation |
|---|---|---|---|
| **Reading time** | `readTime(post)` = words in `post.body` / 220, min 1 (`src/lib/content.ts:104`); frontmatter `readTime` wins | `post.body` is empty, so "1 min read" on every sections post, and it feeds JSON-LD `timeRequired` (`ArticleJsonLd.astro:42`) and cards (`CardFoot`) | `readTime` takes a plain-text projection of the sections; unit-test parity (a post's body converted by the codemod must give the same minutes ±1). Keep the frontmatter override |
| **Table of contents** | blog only; `headings` from `render()`; shown at 3+ H2s unless `toc` is set (`ArticlePage.astro:62`) | `render()` knows nothing about sections | `sectionsHeadings()` with `github-slugger`-compatible slugs (what `rehypeHeadingIds` uses), and `Sections` must emit those ids and heading anchors. The admin preview has its own copy (`headingsOf` in `src/admin/preview-html.ts`) and must be pointed at the same function |
| **RSS** | `bodyHtml` (`feed-queries.ts:32`) renders `Content` via `AstroContainer` and strips page chrome (blog only; news and vlog use the summary) | A blog post with sections has no `Content` to render, so its feed item loses its body | Render `Sections` through the same container (`container.renderToString(Sections, { props })`) and reuse the sanitise + absolutise steps. Add a feeds test that asserts the item body is non-empty for a sections post and that no relative URLs remain. News/vlog/project/repo feeds are unaffected (summary-based) |
| **Search (Pagefind)** | indexes `{news,blog,vlogs,projects,repos}/*/index.html`, `root_selector: main` (`pagefind.yml`) | None for rendering: sections end up in `<main>`. Risk is the exclude list: `.prev-next`, `.related`, … are fine, but any new wrapper class that also happens to match breaks indexing silently | Test: after the build, a Pagefind query for a word that exists only inside a section returns the post. Also decide whether the editable pages (about/subscribe/privacy) join the glob: they are not indexed today; widening the glob also puts `/privacy/` in results |
| **JSON-LD** | `ArticleJsonLd` (blog/news), `VideoJsonLd`, `ProjectJsonLd` use front matter; `timeRequired` uses `minutes` | Only `minutes` (above). No body text is put in structured data | Covered by the read-time fix |
| **Draft/scheduled helper** | `filterPublished` on `data.draft` and `data.date` in `content.ts` | None: it reads front matter only | A unit test that a draft post with sections stays out of `/latest/`, feeds, sitemap and search |
| **Related posts / series / prev-next** | tags, `series`, date from front matter | None | None |
| **Live admin preview** | **Blog and About only.** `preview.ts` draws the post from `widgetFor('body')` and counts words in `data.body`; About draws `sections` from strings with a mini Markdown reader (`sections-html.ts`) | The blog preview must switch to rendering sections when present; news/vlog/project/repo have **no preview at all** (`editor: { preview: false }`) | Reuse `sectionsHtml` for the body area of the blog preview; accept that other kinds get a body-only preview (no hero/facts) at first. The preview is approximate by design (README "What the preview does not show") |
| **Image handling** | Blog images in `src/assets/blog` (optimised by Astro); other kinds in `public/media/<kind>/` (resized after build by `scripts/media.mjs`); section images must be `/…` paths from the site's own files (`IMAGE_PATTERN`) and sizes are read at build (`section-images.ts`) | A blog `image` block pointing to `/src/assets/blog/…` is not a public URL | Keep blog sections' images in `public/media/blog/` (they get shrunk by `media.mjs`), or teach `section-images.ts` the `/src/assets` form. Decide once; `docs/IMAGES.md` states the current split |
| **Sitemap, canonical, noindex** | from front matter | none | none |
| **Series / `seriesOrder` validation** | schema refine in `content.config.ts:135` | none | none |

---

## 4. Decap limits

**Version.** `package.json`: `"decap-cms-app": "^3.16.3"` and `"decap-server": "^3.11.3"`. `package-lock.json` resolves `decap-cms-app` 3.16.3, which depends on `decap-cms-core` 3.19.1 and `decap-cms-backend-github` 3.8.3. The admin config is typed against `decap-cms-core` (`src/admin/config.ts:5`).

### 4.1 What the repo already proves works (read in this checkout)

- A **variable-type list** (`widget: 'list'`, `types: [...]`, `typeKey: 'type'`) with nine block types, each an `object` with typed fields: `src/admin/pages.ts:261-274`.
- **Collapsed blocks with a one-line summary per type** (`collapsed: true`, `summary: 'Heading: {{fields.text}}'`, a `| truncate(48,'…')` filter), `max: 60`, `label_singular`.
- **A list nested inside a block** (`links` > `items`, with `min: 1`, `max: 20`, its own `summary`).
- **The Markdown widget inside a block** (`text`, `portrait`), with a restricted button set and no editor components.
- **Image widget inside blocks** with the project's upload size limit (`media_library: IMAGE_LIBRARY`) and per-collection upload folders.
- **Per-field `pattern` validation** for string fields (links, titles, seoTitle), `required: false`, `default`, `select`, `boolean`.
- **Cross-field validation done outside Decap**: the schema (`needsAlt` in `page-sections.ts`) and a `preSave` listener (`imageSaveCheck` in `src/admin/image-rules.ts`, registered in `main.ts:39`) refuse an image with no alt text and not marked decorative.
- **Custom live preview** by `CMS.registerPreviewTemplate` (`blog`, and `about` for a file-collection entry), with the site's CSS injected (`main.ts:44-45`).
- **Editorial workflow** (`publish_mode: 'editorial_workflow'`, a PR per entry) over both folder and file collections; local dev writes files directly.
- A **file collection** (one entry per file, `files: [...]`) with `delete: false`: `pagesCollection`.

### 4.2 Capabilities worth relying on (documented Decap behaviour; unverified here)

- Reordering by drag handle; add/remove per item; `min`/`max`; `add_to_top` option; `collapsed` and `minimize_collapsed` options.
- `relation` widget to pick another entry (used in `repoFields.relatedProject`), which fits a "pick the featured posts" block.
- Required fields are the default (fields not marked `required: false` block saving when empty; the inline error shows on the field).
- Default values per field and per type.

### 4.3 What a list of types cannot do

| Limit | Consequence for this project | Closest alternative |
|---|---|---|
| **No conditional fields** (show X only when Y) | An image block must always show alt text and "decorative"; a "post grid" block shows every option even for modes that do not use them | Keep blocks small and one-purpose; add one block type per mode (e.g. `latest-posts`, `kind-posts`, `games-row`) rather than one block with a mode switch |
| **No cross-field or cross-block validation** (alt required unless decorative; "exactly one archive-list block"; "heading directly above portrait") | Must live in the build schema and the `preSave` hook | Strict zod schema with block-numbered messages (as About does); a `preSave` check for what the author should hear before committing; treat an absent required block as "append it with a warning", not a failure |
| **No live preview of a data-driven block** | The preview is a React function over the entry's own data; a "latest posts" block cannot query the collections at preview time | Render a labelled placeholder ("Latest 3 blog posts appear here") in the preview; the real result is checked on the Cloudflare preview/PR build |
| **The preview re-renders on every change, and is hand-written in parallel with the real renderer** | Drift risk: `sections-html.ts` copies `Sections.astro`'s markup; About's preview already admits a mini Markdown reader and a narrower pane | Keep one pure `layoutSections` (already shared) and a parity test that renders both and compares class names for each block type |
| **No nested `types` list inside a block is a good idea** (technically a list can contain a list, but the UI becomes a stack of cards inside cards) | A "columns" block whose columns hold other blocks is unworkable | Fixed-shape layout blocks only: two-column text with two Markdown fields (as `TwoColumn` in `blocks.ts`), gallery with 2-3 image rows |
| **No duplicate-block, copy/paste between entries, block templates, or "add from a saved block"** | Re-creating the same hero on every page by hand | Put repeated chrome in site settings (section 5), not in per-page lists |
| **No search/filter inside a long list; no keyboard reordering** (unverified: Decap's sortable list is drag-handle based; check keyboard and screen-reader support before promising it) | Accessibility of the editor itself, a 60-block page becomes a long scroll | Collapsed-by-default blocks with summaries (already done), `max: 60`, short pages. Document the gap |
| **Performance with many blocks** (unverified here, plan to measure) | The whole entry is one form held in state; every keystroke re-serialises the entry and re-renders the preview iframe; each Markdown block mounts its own rich-text editor when opened; many images means many thumbnails | Collapsed blocks, `max: 60`, preview debounce is not available in config (it would have to be done inside the preview component), prefer text/Markdown fields to stacked editors. Spike: build a 60-block page with 15 images and measure typing latency before committing to the architecture |
| **Whole-entry serialisation** | Decap re-serialises all of the front matter with its own YAML style on save (visible in the repo: the vlog's long `summary:` is folded onto two lines; `about.md` uses a `>-` block scalar). A hand-written file is reformatted on first save | Accept one noisy diff per file; keep hand-edited YAML out of the admin's files, or reformat the files once in the migration PR so later diffs are clean |
| **Raw HTML or MDX that Decap does not recognise** in a Markdown body may be escaped or dropped on round trip | The existing `<a class="btn solid lg">` | Sections `button` block replaces it; this is an argument for (b)/(c) over (a) |
| **Editorial workflow: one branch/PR per entry** | Two open drafts of the same page file (or a settings file) conflict; every edit to `site settings` is a PR | Document it; keep settings in a few small files (nav, footer, newsletter) so conflicts stay small |
| **File collection entries cannot be created or deleted from the UI** (`delete: false`; a file entry needs the file to exist) | A brand-new "page" cannot be created by the author in the admin | Pages in this plan are a fixed set that developers create once (home, subscribe, privacy, 404, search, tags, per-kind intros); the author edits them, does not invent routes. Anything else is a code change |
| **Slug and URL are not editable for a file entry** | By design: URL stability | Good: it protects SEO |

### 4.4 What the current admin config and preview already handle

- Strict mirroring of the schema: `src/admin/config.vitest.ts`, `pages.vitest.ts`, `blocks.vitest.ts` read the real zod schema and fail when the admin and the schema drift. This pattern must be reused for every new collection.
- Blog live preview, About live preview, image upload with alt-text enforcement (`admin-images.spec.js`, `image-rules.ts`), a CSP-locked admin (`public/_headers`, `tests/headers.spec.js`), GitHub OAuth through `workers/cms-auth/`, Decap bundled by Astro (no CDN), `noindex` and exclusion from robots, sitemap and feeds (`tests/admin.spec.js`).
- Not handled: previews for news, vlogs, projects, repos, authors; any preview for data-driven blocks; keyboard-accessible reordering.

---

## 5. Site-wide settings

### 5.1 What is in `src/data/site.json` today and who reads it

`name`, `tagline`, `description`, `url`, `author{name,bio,photo,email}`, `links{github,youtube,x,linkedin,bluesky,rss}`, `nav[]` (labels only), `newsletter{provider,formAction}`. Readers: `src/data/site.ts` (re-exports typed), `src/data/nav.ts` (label to href), `Header`, `Footer`, `BaseLayout`, `NewsletterForm`, `subscribe.astro`, `privacy.astro`, `about.astro` (Person JSON-LD), `index.astro`, feeds, sitemap, and **three places outside Astro's runtime that import the JSON directly**: `astro.config.mjs` (`site: site.url`), `src/content.config.ts` (`seoTitleMax(site.name)`), `src/admin/config.ts` (also `seoTitleMax(site.name)`).

That third group matters: the admin bundle and Astro's config import the JSON statically, so anything they need must stay a plain JSON file with no Astro-only loader.

### 5.2 Proposed "Site settings" (admin "Settings" file collection, 4 files)

| File | Fields | Notes |
|---|---|---|
| `src/data/site.json` (stays; edited by Decap) | `name`, `tagline`, `description`, `author{name,bio,photo,email}`, `defaultOgImage`, `defaultOgImageAlt` | `name` feeds `seoTitleMax`: changing it changes the maximum `seoTitle` length for every post, so validate on build, not just in the form |
| `src/data/nav.json` (new) | `items: [{ label, href }]` (`href` uses `LINK_PATTERN`), `footer: [{ label, href, icon }]`, `footerNote` ("Made with R7 Orbit") | Replaces `site.json` `nav` and the `HREFS` table in `nav.ts`, and the hard-coded `links` array in `Footer.astro` |
| `src/data/social.json` (new, or a block in `site.json`) | `github`, `youtube`, `x`, `linkedin`, `bluesky`; `rss` stays derived | Empty means "not shown", as today. Person JSON-LD `sameAs` keeps reading these |
| `src/data/newsletter.json` (new) | `provider` (select), `formAction` (https pattern), `heading`, `text` (the Subscribe-band copy), `formHint` | `formAction` is a public form address, not a secret |

Reader changes:

- `src/data/site.ts`: parse the JSON with a zod schema at import time so a bad edit fails the build with a readable message (today `SiteConfig = typeof data` has no validation). Export `site`, `nav`, `footer`, `newsletter`.
- `src/data/nav.ts`: `navItems` becomes a direct read of `nav.json`; delete `HREFS`.
- **`Header.astro`: `aria-current` must match on href**, not `item.label === current`. Today most pages pass `current="Blog"` etc. as a label; after the change they pass nothing and `Header` compares `Astro.url.pathname` to each item's `href` (prefix match for sections). A test must cover "Blog" being current on `/blog/test/` and "Latest" on `/latest/`.
- `src/pages/search.astro:6` filters nav items by label (`['News','Blog',…]`); change to a fixed list of kind hrefs.
- `Footer.astro`: render from `footer[]`, keep "empty href = hidden".
- `SubscribeBand.astro`: default heading/text read from `newsletter.json`; per-page override stays a prop.
- `BaseLayout.astro`: OG alt reads `defaultOgImageAlt`. `src/lib/seo.ts:5` (`DEFAULT_IMAGE = '/og-default.png'`) reads `defaultOgImage`.
- `public/site.webmanifest` repeats name and description: either leave it (and say so) or make it an endpoint `src/pages/site.webmanifest.ts`. Recommendation: leave it; flag the duplication in the doc.

### 5.3 What must stay **out** of the admin

| Field | Why |
|---|---|
| `url` (`https://r7orbit.io`) | Canonical URLs, sitemap, RSS links, JSON-LD and `astro.config.mjs` `site`; changing it is an SEO migration, and the admin build cannot verify DNS. Code and `docs/DEPLOY_CLOUDFLARE.md` only |
| `CMS_REPO`, `CMS_BRANCH`, `CMS_AUTH_URL` (`src/admin/config.ts:16-24`) | Where the admin commits and signs in; an edit here could lock the author out or point the token at another repository |
| Any API key, token, OAuth client secret, deploy hook URL (`CF_DEPLOY_HOOK_URL`, `workers/cms-auth` secrets) | Never in git (`CLAUDE.md`) |
| Anything that changes the Content-Security-Policy `frame-src` (`public/_headers`) | A new playable game's host must be added there by a developer; `tests/headers.spec.js` fails otherwise |
| `site.links.rss` | Derived (`/rss.xml`) |
| `PAGE_SIZE`, kind collection names, route shapes | URL structure |

### 5.4 Author input needed (do not invent)

`author.email` is the placeholder `hello@example.com`, printed on `/privacy/`; three social links are empty; `newsletter.formAction` is empty (the form is a mock and `privacy.astro` says so). Only the author can supply these. If the settings editor accepts the placeholder, add a **build warning** (not a failure) for "email is the example.com placeholder".

---

## 6. Phased build plan

### 6.0 Ground rules

- The **shared section block library** task is running and owns: `src/lib/page-sections.ts` (and the `src/lib/sections*` modules it is creating), `src/components/Sections.astro`, `SectionBlock.astro`, the admin block definitions (`src/admin/pages.ts` `sectionTypes`, `src/admin/blocks.ts`, `src/admin/sections-html.ts`, `about-preview.ts`), `src/lib/section-markdown.ts`, `section-images.ts`, the About page (`src/content/pages/about.md`, `src/pages/about.astro`), and `src/styles/sections.css`. **No task below edits those.** They consume them.
- **Requests to the library task** (needed by D1/D2/B; cheap for it to add): (1) a public registry so other tasks can add **page-only dynamic block types** (type name, zod schema, admin type definition, Astro renderer) without editing its files; (2) `sectionsToText`, `sectionsHeadings`, `sectionsToHtml` pure helpers (section 3.3); (3) block types for posts: `code`, `video`, `gallery`, `columns`, `pullquote`; (4) `button` size option (`lg`).
- To avoid two tasks editing `src/content.config.ts` and `src/admin/config.ts`, **task A converts both into registries first** (small) so later tasks only add files.

### 6.1 Tasks (6) and the files each owns

**A. Foundation: wiring + site settings.** Starts immediately, in parallel with the library task. Merge first.

- Owns: `src/content.config.ts` (becomes a thin assembler importing `./content/schemas/*`), `src/admin/config.ts` (assembler importing collection modules), `src/admin/main.ts` (preview registration list), `src/data/site.ts`, `src/data/nav.ts`, `src/data/site.json`, new `src/data/nav.json`, `src/data/social.json`, `src/data/newsletter.json`, new `src/admin/settings.ts` (+ `settings.vitest.ts`), `src/components/Header.astro`, `Footer.astro`, `SubscribeBand.astro`, `NewsletterForm.astro`, `src/layouts/BaseLayout.astro`, `src/lib/seo.ts` (default image only), `src/pages/search.astro` (nav filter line only), `astro.config.mjs`.
- Creates empty, documented stub modules the others fill: `src/content/schemas/pages.ts`, `src/content/schemas/listings.ts`, `src/content/schemas/post-sections.ts`; `src/admin/collections/{pages,listings}.ts`.
- Done when: nav/footer/subscribe-band/newsletter copy and social links are edited in the admin; `aria-current` works by href; existing pages render byte-identical text (reuse the fixture approach of `tests/fixtures/about-text.txt`).

**B. Editable pages: home, subscribe, privacy, 404, search, tags index.** After A and the library registry.

- Owns: `src/pages/index.astro`, `subscribe.astro`, `privacy.astro`, `404.astro`, `search.astro` (body only), `src/pages/tags/index.astro`, new `src/content/pages/{home,subscribe,privacy,404,search,tags}.md`, new `src/content/schemas/pages.ts` (page schema with `sections` plus per-page extras), new `src/components/PageSections.astro` (wrapper around the library's `Sections` plus the dynamic blocks), new `src/components/dynamic/*.astro` and `src/lib/dynamic-sections.ts` (`hero`, `post-grid`, `games-row`, `kind-browse`, `feed`, `subscribe-band`, `newsletter-form`), new `src/admin/collections/pages.ts`, `src/admin/page-previews.ts`, `src/lib/sitemap.ts` (add: editable pages enter the sitemap by content and keep `noindex` rules).
- Home as sections: `hero`, `post-grid{source: pinned|latest|kind|games|repos, count, eyebrow, title, link}`, `kind-browse`, `subscribe-band`. The filterable "Latest" list is **one** dedicated block (`feed`) because it ships JavaScript (`data-list`, filters) and must stay a single known component.
- Privacy newsletter variants: two text blocks with an explicit "show when connected" flag in the block's type name, or one text with a `{provider}` placeholder, decided in this task.
- Done when: today's text on these pages is reproduced exactly by `home.md` etc. (fixture tests), JSON-LD unchanged, canonical/title unchanged.

**C. Editable listings: archives, `/latest/`, `/games/`, tags page, authors page.** After A. Parallel with B and D1.

- Owns: `src/lib/listing.ts` (`KINDS` copy moves to data; paging helpers stay), new `src/content/listings/{latest,news,blog,vlogs,projects,repos,games,tag,author}.json|md`, new `src/content/schemas/listings.ts`, `src/components/ArchivePage.astro`, `ArchiveList.astro` (empty-state body), `GamesSection.astro`, `GamesEmpty.astro`, `GameGrid.astro` ("Next up"), `AuthorPage.astro`, `src/pages/latest/**`, `src/pages/{news,blog,vlogs,projects,repos}/index.astro` and `page/[page].astro`, `src/pages/games/index.astro`, `src/pages/tags/[tag].astro`, `src/pages/authors/**`, `src/lib/games.ts` (`GAMES_COPY` moves to data), new `src/admin/collections/listings.ts`.
- Scope: each listing page gets editable **intro fields** (label, title with `*` marker, lead, meta description, empty text) plus optional `before` and `after` section lists around a fixed listing (filters, cards, pagination stay code). This is deliberately **not** a free list of blocks that includes the listing, because the listing must exist exactly once and Decap cannot enforce that (section 4.3). `/page/N/` routes reuse the same intro.
- Done when: all current copy is reproduced exactly; `/news/page/2/` still has the right `rel=prev/next`, canonical and title.

**D1. Post sections: blog and news.** After A and the library helpers.

- Owns: `src/content/schemas/post-sections.ts` (the optional `sections` field and the "sections XOR body" refinement for all kinds), `src/lib/content.ts` (`readTime` and `countWords` accept sections text), `src/components/ArticlePage.astro`, `src/pages/blog/[slug].astro`, `src/pages/news/[slug].astro`, `src/components/TableOfContents.astro` (data source only), `src/lib/feed-queries.ts`, `src/lib/feed.ts`, `src/admin/collections/posts.ts` (the shared `sections` list for blog and news, plus the post-body toggle hint), `src/admin/preview.ts` (blog preview switches to sections), `src/admin/preview-html.ts` (`headingsOf` only), `scripts/search-index.mjs` and `pagefind.yml` (only if the indexing glob changes).
- Done when: a blog post written entirely as sections has correct reading time, TOC, RSS body, search hit, JSON-LD and preview, equal to the same post written as Markdown (a **parity test**: render both, compare text, headings and minutes).

**D2. Post sections: vlogs, projects, repos.** After D1's schema field exists (a day or two behind D1) and the library helpers.

- Owns: `src/pages/vlogs/[slug].astro`, `src/components/vlog/renderNotes.ts`, `src/pages/projects/[slug].astro`, `src/pages/repos/[slug].astro`, `src/components/detailCards.ts` (if body helpers), `src/admin/collections/{vlogs,projects,repos}.ts` (their `sections` list and vlog `transcript` field).
- Rules: vlog `transcript` becomes its own optional Markdown field (a `transcript` block is the alternative); project and repo `hasBody` (`projects/[slug].astro:82`, `repos/[slug].astro:43,117`) must treat non-empty `sections` as a body; the repo `readme: local` switch keeps its meaning.
- Done when: the three existing kinds render identically with no `sections`, and with `sections` the same page shape (facts aside, write-up, related posts, subscribe band) appears.

**E. Migration, QA and docs.** Runs alongside, owns tests and docs so no feature task edits them.

- Owns: new `scripts/migrate-body-to-sections.mjs` (codemod: Markdown body to `heading` and `text` blocks, splitting at `##`, mapping the raw `<a class="btn …">` to a `button` block; dry-run by default; never touches a file without `--write`), `tests/editability.spec.js`, `tests/post-sections.spec.js`, `tests/fixtures/*-text.txt` (one text fixture per editable page, like About's), `tests/routes.js`, `tests/feeds.spec.js`, `tests/headers.spec.js` (only if CSP changes), `tests/screenshots.mjs`, `src/lib/**/*.vitest.ts` for the new pure modules owned by others (agreed names only), `docs/CONTENT_MODEL.md`, `docs/PAGES.md`, `docs/DECISIONS.md`, `docs/IMAGES.md`, `CLAUDE.md` file map, `README.md` Admin section.

### 6.2 Order and dependencies

```
Wave 0 (now, parallel):   Library task (running)       A: wiring + settings
Wave 1 (after A merges):  B: pages     C: listings     D1: blog+news sections
Wave 2:                   D2: vlog/project/repo sections (needs D1's schema field)
Throughout:               E: tests, fixtures, codemod, docs (merges last)
```

Hard dependencies: A before B, C, D1 (it owns `content.config.ts` and `config.ts`). Library registry before B (dynamic blocks) and the library helpers before D1 and D2. D1 before D2 (the shared `sections` field). E consumes everything but edits nothing the others own, so it can start fixtures on day one.

File ownership is disjoint by construction, with two shared touchpoints handled by stubs: `content.config.ts`/`config.ts` (A only) and `src/lib/sitemap.ts` (B only; C and D add no routes).

### 6.3 Test strategy

- **Text-parity fixtures per page** (the About technique, `tests/about.spec.js` against `tests/fixtures/about-text.txt`): before moving a page's copy into a file, snapshot its rendered text; after, the same fixture must pass. Applies to home, subscribe, privacy, 404, search, tags, each archive, games. This is the main guard against accidental wording changes.
- **Unit tests (Vitest)** for every new pure module, plus **admin-vs-schema parity** like `config.vitest.ts` and `pages.vitest.ts` (field names, required flags, patterns), now also for settings and listings collections.
- **Schema tests**: a post with both `body` and `sections` fails with a readable message; a bad block reports its position; a draft post with sections is excluded everywhere.
- **Sections vs Markdown parity**: convert each existing real post with the codemod, render both, compare normalised text, heading ids, reading time (±1 minute) and RSS item text.
- **Playwright**: existing smoke, axe, budgets, audit (320-1480px), keyboard, feeds, headers suites run unchanged on every route in `tests/routes.js`; add `aria-current` checks by href; Pagefind finds a section-only word; JS and CSS budgets (50 kB / 40 kB gzipped) re-checked, since home gains block components.
- **Sitemap and robots**: `src/lib/sitemap.vitest.ts` extended so editable pages appear once, `noindex` pages stay out.
- **Redirect/URL test**: a test that lists every URL in the current `dist/` sitemap and asserts the same set after the change (no URL lost or added by accident).
- **Admin**: `tests/admin.spec.js` and `admin-images.spec.js` stay; add a Playwright run of the real editor against `admin-mock.js` that adds, reorders and saves a block (also the spike that measures the 60-block performance).

### 6.4 Main risks and what to do about them

| Risk | Where | Mitigation |
|---|---|---|
| **SEO regressions**: a title, description, canonical, H1 or JSON-LD changes when copy moves to files | every migrated page | text-parity fixtures; compare `<head>` before and after (the `audit.spec.js` head tags and JSON-LD checks run on every route); keep `seoTitle` rules; do not change `site.url` |
| **A page loses its H1 or gets two** | pages as sections | The page title stays a front matter field rendered in the page head (as About does), never a block; sections may only produce H2/H3 (as today) |
| **URL changes** | slugs (`/blog/test/`), tag pages, nav hrefs | No slug is editable in the admin; add a "no URL lost" test; any rename goes into `public/_redirects` |
| **Broken existing posts** | the three existing posts, future posts | sections XOR body; codemod is dry-run first; `body` rendering paths stay until every post is converted |
| **Feeds change** | RSS items for blog posts with sections | Render sections through the same container and sanitiser; feeds test asserts non-empty body, absolute URLs, valid XML (`src/lib/xml-check.ts`) |
| **Search changes** | Pagefind glob and `root_selector: main` | indexing test; do not widen the glob without deciding about `/privacy/` and `/about/` appearing in results |
| **Admin and renderer drift** | `sections-html.ts` copies `Sections.astro` | parity tests; one pure `layoutSections` |
| **Admin performance and accessibility of reordering** | long block lists | spike early (in task E); `max: 60`; collapsed blocks; document keyboard limits |
| **Nav label coupling** | `current="Blog"` strings on most pages | A fixes this first; test by href |
| **Editorial workflow conflicts** | settings files | few, small files; one PR per change |
| **Placeholder facts get published** | `hello@example.com`, empty links, mock newsletter | build warnings; ask the author; never invent (`CLAUDE.md`) |
| **Performance budgets** | home becomes block-driven | the `feed` block remains one component; budgets test in CI; keep `orbit.js` hero-only |
| **Scope creep into "every component as a block"** | library task | only blocks with a clear editorial meaning; data-driven blocks are configuration, not free layout |

### 6.5 What cannot be done in Decap, and what to do instead

1. **A real WYSIWYG of data-driven pages.** Not possible; use labelled placeholders in the preview and rely on the PR build (Cloudflare) for the truth.
2. **Letting the author create new routes.** Not possible for file collections in Decap; the page set is fixed by developers. Posts can be created freely (folder collections).
3. **Conditional fields and "exactly one" rules.** Not enforceable in the form; enforce in the schema and `preSave`, and design block types so no condition is needed.
4. **Nested block containers (columns holding blocks).** Technically possible, bad to use; offer fixed-shape layout blocks.
5. **Copying blocks between pages.** Not available; put repeated content in site settings.
