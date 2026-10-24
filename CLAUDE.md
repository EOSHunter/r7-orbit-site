# CLAUDE.md

Instructions for AI coding agents working in this repository. Read this first, every session. Humans: this is also the short version of how the project works.

## What this project is

A personal website for posting **AI news, blogs, vlogs, projects and repos**, styled with the **R7 Orbit design system** (obsidian background, ivory text, one brass accent). It is a static site: content is Markdown files, there is no database and no admin server (the editor at `/admin` is a static page that writes these same files through git). It is **not** the R7 Orbit desktop app; it only shares its look.

Full context: `docs/PROJECT_BRIEF.md`. Open decisions and what the author must supply: `docs/DECISIONS.md`.

**Asked to add or draft a post, news item, vlog, project, repo page, game or app? Follow the project skill `.claude/skills/add-content/SKILL.md` first** (inputs to confirm, front-matter templates per kind, verification, report), **write the text with the `orbit-voice` skill (invoke it by name; `.claude/skills/orbit-voice/`), and lay it out with `docs/WRITING_GUIDE.md`** (a recipe per kind, the block table, density rules, pictures and the IMAGE NEEDED marker, truth and credit, the pre-publish checklist; layout templates in `.claude/skills/add-content/templates/layouts/`; `npm run check:layout` reports walls of text).

## Where things are

```
CLAUDE.md                     this file
.claude/skills/add-content/   the skill for adding a post of any kind (SKILL.md: the writing agent per kind, then the Parallax fact-check; agents/<slug>.md: each agent's guide (r7, pulsar, orion, kepler, hubble; parallax = the fact-check procedure), templates/ per kind + templates/layouts/ (a skeleton per WRITING_GUIDE recipe, MDX/Markdown and sections), checklists/, examples.md)
.claude/skills/orbit-voice/    the house voice for every writing agent (SKILL.md, slop-rules.md, eval.md); invoke it by name before writing text for the site; text written with it is credited to the agent that wrote it, never to Hunter
docs/                         TEAM (the writing team: the authors, their titles, how the credit shows, avatar specs) (each agent's guide is .claude/skills/add-content/agents/<slug>.md), ABOUT_SITE_DRAFT (unpublished drafts of a paragraph about the site for About), WRITING_GUIDE (how every post is laid out so it is not a wall of text: recipes per kind, block table with markup, density rules, images and the IMAGE NEEDED marker, truth and credit, before/after, pre-publish checklist and fact-check handoff), DEPLOY_CLOUDFLARE (Pages, domain, GitHub login Worker, scheduled rebuild), WAITLIST (the author's guide to the waitlist: Cloudflare setup, testing, export, off switch, troubleshooting, privacy), ARTICLE_COMPONENTS (MDX article component library), SECTIONS (the shared block library: the About page, and optionally the body of any post, is an ordered list of blocks; the catalogue, the rules, posts written as sections, how to add a block), IMAGES (where pictures live, what the build does to them, what the admin enforces), IMAGE_STYLE (partly decided: the picture treatment on cards and the home page only, not built yet; the brand pieces in a post's words are live;  prototyped at /styleguide/imagery/ and /styleguide/imagery/v2/ (pages share src/pages/styleguide/imagery/_prototype.ts; CSS in src/styles/imagery-prototype.css and imagery-v2-prototype.css); the rules and the rollout plan), PROJECT_BRIEF, DECISIONS, PAGES, CONTENT_MODEL, VOICE_AND_COPY, SEO_AND_SHARING, BUILD_PLAN
astro.config.mjs              static output, trailing slashes; "site" comes from src/data/site.json
.github/workflows/ci.yml      pull requests: npm ci, check, lint, build, test
.github/workflows/scheduled-deploy.yml   daily Cloudflare Pages Deploy Hook (publishes future-dated posts); needs secret CF_DEPLOY_HOOK_URL
scripts/media.mjs             picture guard (before Astro) and dist/media shrinker + 2 MB limit (after); rules in src/lib/media-rules.mjs; see docs/IMAGES.md
scripts/check-layout.mjs      npm run check:layout [-- <file or folder>] [--strict] [--json]: REPORT-ONLY layout warnings for posts (walls of text, no picture, no hero, alt text, headings, hype words, contact...); rules and LIMITS in src/lib/layout-check.mjs; not in build, CI or Cloudflare
scripts/no-contact.mjs        after the build: fails if a public page (not /admin/, not /styleguide/) has a mailto: link or an email address; rule in src/lib/no-contact.mjs
workers/cms-auth/             Cloudflare Worker: GitHub OAuth for /admin (deployed with wrangler; outside the Astro build, lint, check and tests)
functions/api/                the waitlist's two Cloudflare Pages Functions (waitlist.ts, waitlist-remove.ts): thin wrappers over src/lib/waitlist-api.ts, the site's only server code; public/_routes.json limits Functions to /api/*
migrations/0001_waitlist.sql  the waitlist's D1 table (applied once by the author: docs/WAITLIST.md); scripts/wrangler.waitlist.toml maps WAITLIST_DB to the database r7-waitlist for wrangler's command line (never a root wrangler.toml); .dev.vars.example is for local runs
scripts/waitlist-export.mjs   npm run waitlist:export [-- --local] [-- --out file]: the waitlist as waitlist.csv (gitignored), through wrangler
src/
  layouts/BaseLayout.astro    head (every tag in docs/SEO_AND_SHARING.md), skip link, Header, Footer
  components/                 Header, Footer, Icon + IconSprite, MediaPlaceholder, StatusMark,
                              AuthorByline + AuthorAvatar + AgentChip + AuthorBox + AuthorPage (the /authors/<slug>/ page),
                              PostCard (kind switch) -> NewsCard, BlogCard, VlogCard, ProjectCard, RepoCard;
                              AppsSection (type filter) + AppGrid + AppCard + AppsEmpty (the /apps/ hub; it was /games/, which redirects),
                              Sections + sections/ (a page built from blocks: About, the home page's rows, the blocks around a listing, and a post's body written as sections with layout="column";
                              one <Id>Block.astro per block (WaitlistBlock = the waitlist band, drawn only while the waitlist is on), registry.ts, SectionBand.astro = the home rows' ruled section frame) + AuthorBox, TagIndex (the /tags/ list),
                              PageBlocks (library blocks drawn in place inside a page's own frame: privacy, 404, search),
                              ArchivePage + ArchiveList + Pagination, ArticlePage (blog/news) + TableOfContents, ShareRow, SeriesNav,
                              VlogPage, ProjectPage, RepoPage (the vlog, project and repo pages; their routes only fetch, like ArticlePage's),
                              PrevNext, RelatedPosts, ArticleJsonLd, YouTubeFacade + vlog/, ProjectJsonLd, Gallery, ImageZoom (every post page: its pictures open larger in a dialog), ReadmeBlock, StatsRow,
                              WaitlistForm (hero, band, remove; draws nothing while the waitlist is off) + waitlist/WaitlistFields (docs/PAGES.md "Waitlist")
  admin/                      Decap CMS for /admin: settings.ts (the "Site settings" file collection over src/data/site.json), config.ts (a collection per kind, mirroring content.config.ts), blocks.ts (article components as editor blocks),
                              preview.ts + preview-html.ts + preview.css (live blog preview with the site's CSS), main.ts (entry);
                              post-body.ts (a post's body for the previews, written as Markdown or sections; the save check that refuses both), post-preview.ts (the preview of news, vlogs, projects and repos),
                              pages.ts (the "Pages" file collection: About, then site-page-files.ts = home, Latest, the five archives, Apps, Tags, then privacy, 404 and search in their own block),
                              page-previews.ts + page-preview-html.ts (home and listing previews: hero or page head, blocks, a labelled stand-in where posts go), framed-preview.ts (privacy/404/search preview: About's, with settings tokens filled), sections-config.ts (the Decap block list, generated from the block definitions; `sectionsField()` attaches it to any collection), about-preview.ts + sections-html.ts (the live preview of a page of blocks). See README "Admin" and docs/SECTIONS.md
  game/runner/                the 404 page's endless runner (steps 1, 2a, 2b and 3 of 4; docs/RUNNER.md; text.ts = RUNNER_TEXT alone, so a page can print the words without three.js; the 404 page mounts it through components/RunnerStage.astro: a poster, the game fetched on the first interaction, prefetched when idle; styles/runner-stage.css, lib/runner-stage.ts, astro.config.mjs runnerChunkUrl, tests/runner-404.spec.js): pure logic (config.ts every tunable number + the scene colours from tokens, sim.ts fixed 1/120 s step, generator.ts fairness, clock.ts, input.ts, storage.ts best score in localStorage, world.ts the world's scroll and easing) apart from render.ts (Three.js, read-only view), rover.ts (the model assets/rover.glb, built by tools/runner/build_rover.py in Blender, and its animation), camera.ts (the chase camera fixed to the track) and environment.ts (the sky, planet, ring tunnel, track, rocks, glows, lights, fog); index.ts mountRunner() is loaded only by dynamic import (three is a lazy chunk); runner.css imported by the host page; unit tests *.vitest.ts beside it, e2e tests/runner.spec.js on /styleguide/runner/
  pages/                      index, authors/<slug>/ (+ page/N/), latest/, news/ blog/ vlogs/ projects/ repos/ (archive, page/N/, [slug]), apps/ (hub of playable projects: games and apps), tags/, about,
                              privacy, 404, robots.txt, sitemap-index.xml + sitemap-0.xml,
                              styleguide/ (noindex, unlinked: an iframe of styleguide/specimen/; fixtures sections/, apps/, listing/, nav/ and others for the tests; styleguide/posts/<kind>/ draws the tests' fixture posts)
  data/site.json              the site settings: name, tagline, description, default share image, author, profile links, nav (label + href), footer links + note, waitlist (switch, Turnstile site key, words; off by default);
                              edited in /admin as "Site settings" (admin/settings.ts) except `url`. site.ts parses it with siteSchema (lib/site-settings.ts) and every reader imports site.ts; nav.ts gives navItems + footerItems
  content/                    authors/ (hunter-newton.json, r7.json, pulsar, orion, kepler, hubble, parallax: who a post is credited to; docs/TEAM.md), news/ blog/ vlogs/ projects/ repos/ (the author's real posts, written through /admin; a kind may be empty and every page has an empty state; a post's body is Markdown OR a `sections` list, never both), pages/ (about.md as blocks; home.md = hero fields + rows as blocks; latest, news, blog, vlogs, projects, repos, apps, tags .md = each listing's words, empty state and blocks above/below its list; privacy.md, 404.md, search.md = the words of those pages, their frame stays in src/pages/; all edited in /admin); site.json stays in src/data/
  content.config.ts           collection schemas (strict; a bad field fails the build with a readable message)
  lib/                        cards.ts (card prop types), text.ts (title markers, dates, absolute URLs),
                              sections/ (THE block library, docs/SECTIONS.md: definitions.ts defines every block once - fields, schema, label, placement, example; fields.ts is the field vocabulary; schema.ts exports `sectionsSchema` for any collection; layout.ts is the row rule; describe.ts reads a schema back for the admin form and the build; prepare.ts renders each block's Markdown and measures its pictures; checks.ts holds the checks a schema cannot make; catalogue.ts writes the catalogue in docs/SECTIONS.md; unit-tested),
                              sections-to-content.ts (THE projection of a sections body: plain text for reading time, headings for contents lists and anchors; every consumer goes through it, unit-tested per block),
                              section-markdown.ts + section-images.ts (build-time Markdown and picture sizes for those blocks),
                              page-copy.ts + page-copy-queries.ts (privacy/404/search: settings tokens such as {site.name}, which block goes where; unit-tested),
                              content.ts (pure helpers: drafts, future dates, sort, read time, tags, related, series, warnings, bodyConflict (sections XOR Markdown body); unit-tested),
                              content-queries.ts (getPosts/getAllPosts over astro:content; getFixturePosts for the tests' fixtures), markdown/ (remark/rehype plugins, Shiki transformer),
                              authors.ts + authors-queries.ts (authors: default, byline rules, JSON-LD; unit-tested),
                              site-settings.ts (site.json schema, footer links, isCurrent/searchKinds: nav matched by href; unit-tested) + site-routes.ts (build-only: every site path in the settings exists),
                              app-types.ts (APP_TYPES: THE list of app types, game and app, with label, icon, button word, JSON-LD; schema, admin, filter and cards read it) + apps.ts + app-cards.ts (the /apps/ hub: which projects are on it, type, order, primary link; unit-tested),
                              site-pages.ts (the home and listing pages' extra fields, which page needs which: pageProblems; unit-tested) + site-pages-queries.ts (loadSitePage),
                              seo.ts (canonical, OG fallbacks, JSON-LD builders), listing.ts (archive paging),
                              sitemap.ts, github.ts (build-time repo data with cache; offline-safe), post-cards.ts
                              waitlist.ts (the waitlist's shared rules: sources, address check, test keys, waitlistState = when a build draws the forms; dependency free, bundled by functions/) + waitlist-api.ts (both endpoints as functions of a Request: checks, Siteverify, D1) + waitlist-queries.ts (this build's state: settings, astro dev, WAITLIST_PREVIEW; build only); unit-tested, the API against SQLite from the real migration
                              orbit.ts (the brand ring's geometry: the logo's tilted ellipse, its halves and points; unit-tested) + article-brand.ts (the markup of the article's brand pieces: AgentCards, OrbitDiagram, StatDial, the orbit Divider, the ring in a Pullquote; drawn by the components and by the editor's preview alike; unit-tested)
  styles/design-system/       tokens.css, components.css, tokens.json, DESIGN_SYSTEM.md (moved from design-system/; the source of truth for the look)
  styles/sections.css         the few rules a page of blocks needs on top of site.css and article.css (portrait on the right, full-width image, long addresses)
  styles/markdown.css         Markdown output (code theme from tokens, callouts, figures, anchors); import it where a post body is rendered
  styles/site.css             site-level layout (from templates/site.css, plus: .media-ph img fix, underlined links in running text, focus ring on text fields)
  scripts/                    site.js (menu, filters, copy; bundled by Astro), orbit.js (hero and 404 only),
                              gallery.js (project gallery dialog), image-zoom.js (a post's pictures become buttons that open them larger; ImageZoom.astro), yt-facade.js (loads the YouTube iframe on play), play-facade.js (loads a playable project's game iframe on Play; PlayPanel.astro),
                              waitlist.js (the waitlist forms: loads Turnstile on first interaction, sends with fetch)
  styles/waitlist.css         the waitlist form; printed inline by WaitlistForm only on a page that draws one
tests/                        fixtures/layout-check/ (a wall-of-text and a well laid out post, MDX and sections: the before/after of docs/WRITING_GUIDE.md, read by src/lib/layout-check.vitest.ts),
                              fixtures/posts/<kind>/ (one post per kind written as sections: read by the fixture* collections in content.config.ts, never part of the site),
                              post-sections.spec.js (those fixtures through the real post pages: blocks, chrome, contents list, reading time, JSON-LD, axe and widths, Pagefind search),
                              sections.spec.js (every block drawn on /styleguide/sections/: axe, widths, behaviour), admin-sections.spec.js (adds each block type in the real editor, GitHub mocked),
                              page-text.spec.js + page-text.js (the words of home, archives, Latest, Apps, Tags against tests/fixtures/pages/<id>.json; refresh with UPDATE_PAGE_TEXT=1),
                              fixture-inputs.js (every wording fixture records a digest of the content files it came from: after the author edits them in /admin, the page is checked against those files instead of word for word, until the fixture is refreshed),
                              site-pages.spec.js (hero anchors, row order, blocks around a list on /styleguide/listing/), admin-site-pages.spec.js (those pages in the real editor), routes.js (the fixed routes, plus the post and tag pages it finds in dist/: no slugs listed), helpers.js; Playwright specs: smoke, a11y (axe), budgets, audit (widths 320-1480,
                              head tags, JSON-LD, links, headings, print, forced colors), keyboard (focus, skip link, reduced motion), no-contact (no mailto: link or email address in any public page of dist/),
                              waitlist (the normal build carries none of it; a WAITLIST_PREVIEW=1 build: lazy Turnstile, sending, failures, no-JS, the band per post kind, the remove page, axe),
                              admin (noindex, out of robots/sitemap), admin-images (uploading pictures through the real editor under its CSP, GitHub mocked via admin-mock.js), images (what readers get: optimised pictures, size limit), about (the rendered /about/ text against tests/fixtures/about-text.txt, JSON-LD, layout), pages (privacy, 404, search text against tests/fixtures/pages/*.txt via page-text.js, 404 status, layout), admin-pages (those three in the real editor), apps (the hub on the fixture /styleguide/apps/: 0, 1, 2, 5 apps and one type; type filter, chips, Play/Open, JSON-LD per type), admin-apps (the Type menu in the real editor), headers (reads public/_headers; the admin runs under its CSP), redirects (reads public/_redirects: /games/ to /apps/; astro preview ignores that file), theme (a stored light preference changes nothing), hero-contrast (AA over the featured image);
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
npm run build     # production build to dist/ (must pass before any merge); runs scripts/media.mjs before and after Astro (picture guard, then shrink dist/media and a 2 MB limit), then scripts/no-contact.mjs (no mailto: link or email address in a public page)
npm run media:check # the picture guard alone: formats (no HEIC), names, 10 MB; warns about identical files
npm run preview   # serve dist/ to look at the built site (search only works here: Pagefind indexes dist/ during `npm run build`)
npm run cms       # Decap local proxy for /admin (run next to `npm run dev`; see README "Admin")
npm run check:layout # report-only layout warnings for every post in src/content/ (or -- <file|folder>); --strict exits 1; never part of the build
npm run check     # astro check: types in .astro and .ts files (content and link checks arrive with phases 3 and 7)
npm run lint      # eslint
npm run format    # prettier --write (kit files such as docs/, templates/, brand/ and src/styles/design-system/ are ignored)
npm test          # runs test:unit first, then test:e2e (stops at the first failing stage)
npm run test:unit # node:test *.test.ts + Vitest *.vitest.ts for content/Markdown/SEO helpers
npm run test:e2e  # Playwright on every route in tests/routes.js: smoke + axe + JS/CSS budgets (375 and 1280px),
                  # audit (320-1480px, head tags, JSON-LD, links), keyboard, no-contact, robots/sitemap
                  # needs a build first and browsers once: npm run build && npx playwright install chromium
                  # serves dist/ itself via `npm run preview` (port 4399, or E2E_PORT=4401 if another checkout already uses it: Playwright reuses a server it finds there and would test that one's dist/); EXTRA_ROUTES="/x/,/y/" adds routes without editing the list
WAITLIST_PREVIEW=1 npm run build   # the waitlist forms forced on with Cloudflare's TEST key, for tests/waitlist.spec.js and Lighthouse only
                                   # (never in Cloudflare Pages: a Pages build with it stops). PowerShell: $env:WAITLIST_PREVIEW='1'; npm run build
npm run test:lighthouse  # Lighthouse CI (mobile): all categories >= 95, LCP < 2s, CLS 0 on every route; needs a build; uses Playwright's Chromium
                         # run it alone: npm run build && npm run test:lighthouse (serves dist/ on 127.0.0.1:4398; if that port is taken,
                         # check with Get-NetTCPConnection -LocalPort 4398 and use $env:LIGHTHOUSE_PORT=4397 in PowerShell / LIGHTHOUSE_PORT=4397 in bash).
                         # About 8 minutes for every route; to re-check a few, LIGHTHOUSE_ROUTES="/blog/test/,/about/" (paths from tests/routes.js,
                         # same assertions). An empty archive, /latest/, /apps/ or /tags/ is noindex, and routes.js reads that from dist/,
                         # so its SEO category (69 by design) is not asserted.
                         # Throttling is simulated, so results repeat; LCP counts every byte before it (fonts, and any picture a card draws:
                         # covers and posters go through the srcset of build-made WebP copies, src/lib/media-srcset.ts)
```

Line endings: text fixtures under `tests/fixtures/` are LF on every checkout (`.gitattributes`); a spec that reads a fixture line by line still splits on `/\r?\n/`.

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
- **Authors.** Every post has an `author` (a slug in `src/content/authors/`); absent means `hunter-newton`. AI-written pieces are credited to the agent that wrote them (its own slug: `r7`, `pulsar`, `orion`, `kepler`, `hubble`; `docs/TEAM.md`), never to Hunter. An agent's byline shows an "AI-written" label; a person's post shows none. There is no footer note on an AI-written post (removed 2026-10-21, `docs/DECISIONS.md`): the byline and the label carry the credit. Never write an agent's name, subtitle, bio or label wording yourself: it is the author's text (`docs/VOICE_AND_COPY.md`, "AI-assisted writing").
- Voice: plain, specific, first person, calm. No hype words (list in `docs/VOICE_AND_COPY.md`). Never publish AI-written text as the author's without the author's review. Never invent quotes, sources, statistics or benchmarks. Mark sample/placeholder content as such.
- Page files (`src/content/pages/`) print site settings through tokens (`{site.name}`, `{site.tagline}`, `{site.description}`), never by typing the value: the settings stay the one place for them (`src/lib/page-copy.ts`, docs/CONTENT_MODEL.md "Pages with a fixed frame"). There is no newsletter: `{newsletter.provider}` and the `{if newsletter connected}` / `{if newsletter not connected}` lines are still understood only so the Privacy page (whose wording is the author's to change) builds: the token prints nothing and the condition is always "not connected".
- Never invent the author's identity, bio, links, domain or social handles. Use the placeholders from `content-examples/site.json` and ask.
- **Site settings and the nav.** Site-wide values come from `src/data/site.ts` (never hard-code the name, links or nav in a component). A page names its nav section by the item's address: `current="/blog/"`, never `current="Blog"`; labels are the author's to rename in /admin. A new setting goes in `siteSchema` (`src/lib/site-settings.ts`) and the form (`src/admin/settings.ts`) together; `url`, the CMS backend settings and anything secret stay out of the admin. `tests/fixtures/site-chrome.txt` is the head, header and footer of every page type: rewrite it (`UPDATE_SITE_CHROME=1`, see `tests/site-chrome.js`) for a deliberate change, or to catch up with the author's edits (read the diff).
- No stock photography and no generated images unless the author approves each one. Use the placeholder pattern.

## Engineering rules

- **Static output.** No server runtime, no database, with one exception: the waitlist's two Pages Functions (`functions/api/`) and its D1 table, which no page needs in order to render (docs/DECISIONS.md, the waitlist). Build-time data only (GitHub stats, README) with a cache and graceful failure: the build must pass with the network off.
- **No third-party requests on page load.** No CDNs, no Google Fonts, no analytics script unless the author chooses one in `docs/DECISIONS.md`. Video, search and the waitlist's Turnstile load only on interaction. Fonts are self-hosted woff2.
- **Progressive enhancement.** Pages read and navigate with JavaScript off (filters degrade to links; pagination is real links).
- **Accessibility is a requirement, not a polish step.** Semantic landmarks, one `h1`, visible focus, keyboard operable, contrast from the tokens, alt text, `lang`, labels on every control. WCAG 2.2 AA.
- **Performance budgets:** Lighthouse mobile ≥ 95 in all categories; < 50 kB gzipped JavaScript on a typical page; < 40 kB gzipped CSS.
- **Security:** sanitise any HTML that comes from outside (READMEs). No inline event handlers. No secrets in git: tokens go in environment variables / host secrets. Never commit `.env`.
- **Dependencies:** keep them few. Ask before adding a runtime dependency; say what it costs in kB and why it is needed.
- **TypeScript strict** if TypeScript is used. No `any` without a comment saying why.
- **Tests:** a Playwright smoke test per page type, an axe scan, and unit tests for helper logic (sorting, read time, slugs, related posts). A bug fix includes a test that fails without it.
- **Tests never hard-code the author's words.** Nav labels, footer links, the tagline, page titles, hero text and descriptions are edited in /admin, and the editor's pull request must pass CI. A test reads them from `src/data/site.json` (through `siteSchema`) or `src/content/pages/*.md`; a test of a rule that needs a known nav uses `tests/fixtures/site-nav.json` (also drawn by `/styleguide/nav/`). Exact wording fixtures are kept, with their content digest (`tests/fixture-inputs.js`).

## How to work

- Small, focused pull requests: one concern each. Branch names `feat/…`, `fix/…`, `content/…`.
- Before saying a UI task is done: run it, look at it in the browser at 375px and 1280px, with the console open. Say what you checked.
- Never claim a thing works without running it. If you couldn't run or verify something, say so plainly.
- Don't change the design system's tokens or components as a side effect of a page task; propose it separately.
- Don't reformat unrelated files. Match the surrounding code's style.
- When you make a decision that others need to know (a library, a URL shape, a content rule), add it to `docs/DECISIONS.md` or this file in the same pull request.
- Do not kill processes by name (`taskkill /IM`, `pkill node`, etc.). Stop only the exact process you started.

## Ask the author before

Choosing a domain, name, tagline or bio · adding analytics, comments or any tracking · adding a paid service · publishing or deleting content · changing the colour palette, fonts or logo · adding a new runtime dependency · force-pushing or rewriting git history · anything that posts to a social network.

## Definition of done (any task)

Builds and passes checks · matches the design system (tokens, classes) · works at 320–1480px with no horizontal scroll · keyboard and screen-reader friendly · no console errors · docs updated if behaviour or structure changed · you reported what you verified and what you didn't.
