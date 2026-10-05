# CLAUDE.md

Instructions for AI coding agents working in this repository. Read this first, every session. Humans: this is also the short version of how the project works.

## What this project is

A personal website for posting **AI news, blogs, vlogs, projects and repos**, styled with the **R7 Orbit design system** (obsidian background, ivory text, one brass accent). It is a static site: content is Markdown files, there is no database and no admin server (the editor at `/admin` is a static page that writes these same files through git). It is **not** the R7 Orbit desktop app; it only shares its look.

Full context: `docs/PROJECT_BRIEF.md`. Open decisions and what the author must supply: `docs/DECISIONS.md`.

## Where things are

```
CLAUDE.md                     this file
docs/                         DEPLOY_CLOUDFLARE (Pages, domain, GitHub login Worker, scheduled rebuild), ARTICLE_COMPONENTS (MDX article component library), IMAGES (where pictures live, what the build does to them, what the admin enforces), PROJECT_BRIEF, DECISIONS, PAGES, CONTENT_MODEL, VOICE_AND_COPY, SEO_AND_SHARING, BUILD_PLAN
astro.config.mjs              static output, trailing slashes; "site" comes from src/data/site.json
.github/workflows/ci.yml      pull requests: npm ci, check, lint, build, test
.github/workflows/scheduled-deploy.yml   daily Cloudflare Pages Deploy Hook (publishes future-dated posts); needs secret CF_DEPLOY_HOOK_URL
scripts/media.mjs             picture guard (before Astro) and dist/media shrinker + 2 MB limit (after); rules in src/lib/media-rules.mjs; see docs/IMAGES.md
workers/cms-auth/             Cloudflare Worker: GitHub OAuth for /admin (deployed with wrangler; outside the Astro build, lint, check and tests)
src/
  layouts/BaseLayout.astro    head (every tag in docs/SEO_AND_SHARING.md), skip link, Header, Footer
  components/                 Header, Footer, SubscribeBand, NewsletterForm, Icon + IconSprite, MediaPlaceholder, StatusMark,
                              AuthorByline + AuthorAvatar + AgentChip + AuthorNote + AuthorPage (the /authors/<slug>/ page),
                              PostCard (kind switch) -> NewsCard, BlogCard, VlogCard, ProjectCard, RepoCard;
                              GamesSection + GameGrid + GameCard (the /games/ hub),
                              Sections + SectionBlock (a page built from blocks: About),
                              ArchivePage + ArchiveList + Pagination, ArticlePage (blog/news) + TableOfContents, ShareRow, SeriesNav,
                              PrevNext, RelatedPosts, ArticleJsonLd, YouTubeFacade + vlog/, ProjectJsonLd, Gallery, ReadmeBlock, StatsRow
  admin/                      Decap CMS for /admin: config.ts (a collection per kind, mirroring content.config.ts), blocks.ts (article components as editor blocks),
                              preview.ts + preview-html.ts + preview.css (live blog preview with the site's CSS), main.ts (entry);
                              pages.ts (the "Pages" file collection: the About page as typed blocks), about-preview.ts + sections-html.ts (its live preview). See README "Admin"
  pages/                      index, authors/<slug>/ (+ page/N/), latest/, news/ blog/ vlogs/ projects/ repos/ (archive, page/N/, [slug], rss.xml), games/ (hub of playable projects), tags/, about, subscribe,
                              privacy, 404, rss.xml, robots.txt, sitemap-index.xml + sitemap-0.xml,
                              styleguide/ (noindex, unlinked: an iframe of styleguide/specimen/)
  data/site.json              site name, tagline, author, links, nav (placeholders; copy of content-examples/site.json). site.ts and nav.ts read it
  content/                    authors/ (hunter-newton.json, r7.json: who a post is credited to), news/ blog/ vlogs/ projects/ repos/ (the author's real posts, written through /admin; a kind may be empty and every page has an empty state), pages/about.md (the About page as blocks, also edited in /admin); site.json stays in src/data/
  content.config.ts           collection schemas (strict; a bad field fails the build with a readable message)
  lib/                        cards.ts (card prop types), text.ts (title markers, dates, absolute URLs),
                              page-sections.ts (the block schema and the row layout of a page; read by content.config.ts, Sections and the admin preview),
                              section-markdown.ts + section-images.ts (build-time Markdown and picture sizes for those blocks),
                              content.ts (pure helpers: drafts, future dates, sort, read time, tags, related, series, warnings; unit-tested),
                              content-queries.ts (getPosts/getAllPosts over astro:content), markdown/ (remark/rehype plugins, Shiki transformer),
                              authors.ts + authors-queries.ts (authors: default, byline rules, JSON-LD; unit-tested),
                              games.ts + game-cards.ts (the /games/ hub: which projects are games, order, Play link; unit-tested),
                              seo.ts (canonical, OG fallbacks, JSON-LD builders), listing.ts (archive paging), feed.ts + feed-queries.ts,
                              sitemap.ts, github.ts (build-time repo data with cache; offline-safe), post-cards.ts, newsletter.ts
  styles/design-system/       tokens.css, components.css, tokens.json, DESIGN_SYSTEM.md (moved from design-system/; the source of truth for the look)
  styles/sections.css         the few rules a page of blocks needs on top of site.css and article.css (portrait on the right, full-width image, long addresses)
  styles/markdown.css         Markdown output (code theme from tokens, callouts, figures, anchors); import it where a post body is rendered
  styles/site.css             site-level layout (from templates/site.css, plus: .media-ph img fix, underlined links in running text, focus ring on text fields)
  scripts/                    site.js (menu, filters, copy, newsletter placeholder; bundled by Astro), orbit.js (hero and 404 only),
                              gallery.js (project gallery dialog), yt-facade.js (loads the YouTube iframe on play), play-facade.js (loads a playable project's game iframe on Play; PlayPanel.astro)
tests/                        routes.js (the fixed routes, plus the post and tag pages it finds in dist/: no slugs listed), helpers.js; Playwright specs: smoke, a11y (axe), budgets, audit (widths 320-1480,
                              head tags, JSON-LD, links, headings, print, forced colors), keyboard (focus, skip link, reduced motion), feeds,
                              admin (noindex, out of robots/sitemap/feeds), admin-images (uploading pictures through the real editor under its CSP, GitHub mocked via admin-mock.js), images (what readers get: optimised pictures, size limit), about (the rendered /about/ text against tests/fixtures/about-text.txt, JSON-LD, layout), games (the hub on the fixture /styleguide/games/: 0, 1, 2, 5 games), headers (reads public/_headers; the admin runs under its CSP), theme (a stored light preference changes nothing), hero-contrast (AA over the featured image);
                              lighthouse.mjs; screenshots.mjs (writes docs/screenshots/)
docs/screenshots/             quality-pass screenshots, named page-width.png (see its README)
public/                       served as-is: _headers + _redirects (Cloudflare Pages), fonts/ (self-hosted woff2 + LICENSES), assets/ (logo marks), favicons, og-default.png, site.webmanifest
brand/                        the full brand kit (logos, social images, source/ HTML for the text images); only the web essentials are copied to public/
templates/                    static HTML for every page type: the visual reference to port (not built)
content-examples/             the original examples (phase 3 copied the posts to src/content/)
```

Not carried over from the kit: the live design-system page (`design-system/index.html`), `tailwind/theme.css` and `tools/build-design-tokens.mjs` (plain CSS was chosen; `tokens.json` is now edited by hand, or restore the tool with its paths changed).

Markdown runs on the `unified` processor (`@astrojs/markdown-remark`, build-time only) because Astro 7 defaults to Satteri, which does not run remark/rehype plugins.

## Commands

```
npm run dev       # local dev server (http://localhost:4321)
npm run build     # production build to dist/ (must pass before any merge); runs scripts/media.mjs before and after Astro (picture guard, then shrink dist/media and a 2 MB limit)
npm run media:check # the picture guard alone: formats (no HEIC), names, 10 MB; warns about identical files
npm run preview   # serve dist/ to look at the built site (search only works here: Pagefind indexes dist/ during `npm run build`)
npm run cms       # Decap local proxy for /admin (run next to `npm run dev`; see README "Admin")
npm run check     # astro check: types in .astro and .ts files (content and link checks arrive with phases 3 and 7)
npm run lint      # eslint
npm run format    # prettier --write (kit files such as docs/, templates/, brand/ and src/styles/design-system/ are ignored)
npm test          # runs test:unit first, then test:e2e (stops at the first failing stage)
npm run test:unit # node:test *.test.ts + Vitest *.vitest.ts for content/Markdown/SEO helpers
npm run test:e2e  # Playwright on every route in tests/routes.js: smoke + axe + JS/CSS budgets (375 and 1280px),
                  # audit (320-1480px, head tags, JSON-LD, links), keyboard, feeds/robots/sitemap
                  # needs a build first and browsers once: npm run build && npx playwright install chromium
                  # serves dist/ itself via `npm run preview` (port 4399, or E2E_PORT=4401 if another checkout already uses it: Playwright reuses a server it finds there and would test that one's dist/); EXTRA_ROUTES="/x/,/y/" adds routes without editing the list
npm run test:lighthouse  # Lighthouse CI (mobile): all categories >= 95, LCP < 2s, CLS 0 on every route; needs a build; uses Playwright's Chromium
```

Node 22.12 or newer. The styleguide is at `/styleguide/` (with frame widths); it is not linked from anywhere.

## Design rules (non-negotiable)

1. **Use tokens, never raw values.** Colours, radii, spacing, shadows, font sizes, durations all come from `design-system/tokens.css` as `var(--…)`. No hex codes, no ad-hoc `px` for those things in components or pages. If a value is missing, add a token (and document it), don't hard-code.
2. **Use the component classes.** `.btn`, `.chip`, `.kind`, `.card`, `.seg`, `.field`, `.callout`, `.prose`, `.mark`, `.site-header` and the rest are in `components.css`. Compose them; extend with a small class in `site.css` only when nothing fits.
3. **One accent.** Brass is the only accent. Do not introduce other hues. Kinds of post (news/blog/vlog/project/repo) are told apart by **icon and label**, never colour.
4. **Ivory text, never white; obsidian, never black.** No `#fff` or `#000`.
5. **Depth is tone.** Surfaces step `--bg` → `--surface-1` → `--surface-2` → `--surface-3`. Shadows only for floating things (`--shadow-float`, `--shadow-raise`).
6. **Hairlines and small radii.** 1px borders (`--line*`), radii from `--r-*`. Pills only for chips and dots.
7. **Type:** Cormorant Garamond for headlines and pull quotes only; Inter for body and UI; JetBrains Mono for code, data and meta. Body copy is 17px/1.7, measure ≤ 68ch (`.prose`). Headlines are sentence case; one italic-brass phrase per headline at most.
8. **Motion means something** (`--ease`, `--dur*`). Respect `prefers-reduced-motion`. The orbit (`orbit.js`) is used for the hero, loading and the 404 only.
9. **One theme: dark (obsidian).** The light "Ivory" theme and its toggle were removed; do not reintroduce `data-theme`.
10. **Logo:** brass mark on dark, ink mark on light. Never recolour, stretch, add effects, or use the ring versions below ~32px. Files in `design-system/assets/` and `brand/`.

## Content rules

- Follow `docs/CONTENT_MODEL.md`. Every post has `title`, `date`, `summary`; every image has alt text.
- **Authors.** Every post has an `author` (a slug in `src/content/authors/`); absent means `hunter-newton`. AI-written pieces are credited to R7 (`author: r7`), never to Hunter. An agent's byline shows an "AI-written" label and its post ends with the agent's footer note; a person's post shows neither. Never write an agent's note, bio or label wording yourself: it is the author's text (`docs/VOICE_AND_COPY.md`, "Agent-authored footer note").
- Voice: plain, specific, first person, calm. No hype words (list in `docs/VOICE_AND_COPY.md`). Never publish AI-written text as the author's without the author's review. Never invent quotes, sources, statistics or benchmarks. Mark sample/placeholder content as such.
- Never invent the author's identity, bio, links, email, domain or social handles. Use the placeholders from `content-examples/site.json` and ask.
- No stock photography and no generated images unless the author approves each one. Use the placeholder pattern.

## Engineering rules

- **Static output.** No server runtime, no database. Build-time data only (GitHub stats, README) with a cache and graceful failure: the build must pass with the network off.
- **No third-party requests on page load.** No CDNs, no Google Fonts, no analytics script unless the author chooses one in `docs/DECISIONS.md`. Video and search load only on interaction. Fonts are self-hosted woff2.
- **Progressive enhancement.** Pages read and navigate with JavaScript off (filters degrade to links; pagination is real links).
- **Accessibility is a requirement, not a polish step.** Semantic landmarks, one `h1`, visible focus, keyboard operable, contrast from the tokens, alt text, `lang`, labels on every control. WCAG 2.2 AA.
- **Performance budgets:** Lighthouse mobile ≥ 95 in all categories; < 50 kB gzipped JavaScript on a typical page; < 40 kB gzipped CSS.
- **Security:** sanitise any HTML that comes from outside (READMEs). No inline event handlers. No secrets in git: tokens go in environment variables / host secrets. Never commit `.env`.
- **Dependencies:** keep them few. Ask before adding a runtime dependency; say what it costs in kB and why it is needed.
- **TypeScript strict** if TypeScript is used. No `any` without a comment saying why.
- **Tests:** a Playwright smoke test per page type, an axe scan, and unit tests for helper logic (sorting, read time, slugs, related posts). A bug fix includes a test that fails without it.

## How to work

- Small, focused pull requests: one concern each. Branch names `feat/…`, `fix/…`, `content/…`.
- Before saying a UI task is done: run it, look at it in the browser at 375px and 1280px, with the console open. Say what you checked.
- Never claim a thing works without running it. If you couldn't run or verify something, say so plainly.
- Don't change the design system's tokens or components as a side effect of a page task; propose it separately.
- Don't reformat unrelated files. Match the surrounding code's style.
- When you make a decision that others need to know (a library, a URL shape, a content rule), add it to `docs/DECISIONS.md` or this file in the same pull request.
- Do not kill processes by name (`taskkill /IM`, `pkill node`, etc.). Stop only the exact process you started.

## Ask the author before

Choosing a domain, name, tagline or bio · adding analytics, comments or any tracking · adding a paid service · publishing or deleting content · changing the colour palette, fonts or logo · adding a new runtime dependency · force-pushing or rewriting git history · anything that sends email or posts to a social network.

## Definition of done (any task)

Builds and passes checks · matches the design system (tokens, classes) · works at 320–1480px with no horizontal scroll · keyboard and screen-reader friendly · no console errors · docs updated if behaviour or structure changed · you reported what you verified and what you didn't.
