# Decisions

Things only the author can decide or supply. Each has a recommendation so work can start; change the recommendation here and tell the agents. **Agents: do not invent answers to the "Supply" items; use the placeholders and ask.**

Fill in the "Answer" column as you go. Anything blank uses the recommendation.

## A. Identity (supply)

| Item | Recommendation / placeholder | Answer |
|---|---|---|
| Site name | The templates use "R7 Orbit" as a stand-in. Decide if the site is "R7 Orbit" or has its own name; the logo and look stay either way | |
| Tagline | "Field notes on building with AI" (placeholder) | |
| One-line description (meta, ~150 chars) | "News, builds and the things in between: writing, videos, projects and code about building with AI." | |
| Author name (as shown) | | |
| Author bio (2–3 sentences, first person) | | |
| Author photo | Optional. If none, use the brand mark on the plate; never a stock photo | |
| Domain name | e.g. a `.com` or `.dev`; buy from Cloudflare Registrar or Namecheap | **`r7orbit.io`** (bought; DNS on Cloudflare; `site.json` `url` is set) |
| Contact email | A forwarding address, not a personal inbox | |
| GitHub username | `EOSHunter` appears in the app's repos; confirm it is the one for the site | |
| YouTube channel URL | | |
| Other profiles (X, LinkedIn, Bluesky, etc.) | Only list ones that are active | |
| Timezone / date format | `Oct 3, 2026` (US) in the UI, ISO dates in files | |

## B. Product choices (recommend)

| Question | Recommendation | Answer |
|---|---|---|
| Ship the light "Ivory" theme, or dark only? | **Dark only.** The Ivory theme, its toggle, the `[data-theme='light']` tokens and the saved `r7-theme` preference were removed. | |
| Framework | Astro | |
| Tailwind or plain CSS? | Plain CSS from the design system | |
| Newsletter provider | Buttondown | |
| Analytics | None at launch; add Cloudflare Web Analytics later if wanted | |
| Comments | None at launch | |
| Hosting | Cloudflare Pages | **Decided:** Cloudflare Pages at `https://r7orbit.io` (production branch `main`, `npm run build` → `dist`, `NODE_VERSION=22`). Setup: `docs/DEPLOY_CLOUDFLARE.md` |
| URL shape | `/blog/slug/` (trailing slash, kind in the path, no dates) | |
| Show the dark/light toggle in the header? | Yes | |
| Should each kind have its own colour? | **No.** Icon and label only; one accent | |

## C. Content & policy (decide)

| Question | Recommendation | Answer |
|---|---|---|
| How to disclose AI assistance in writing and code | A short "How this was made" line on posts where AI materially helped; plain, not apologetic. Keep a house rule: *the author reads and stands behind everything published* | |
| License for written content | CC BY 4.0 (people can share with credit), or "All rights reserved" | |
| License for code in posts and repos | MIT | |
| Image sources | The author's own screenshots, diagrams and captures. No stock photography. Generated art only if the author approves each image | |
| Sponsorship / affiliate links | None at launch; if ever, label them clearly | |
| Privacy policy page | Needed as soon as there is a newsletter form or analytics; short and plain | |
| Cookie banner | Not needed if there are no tracking cookies. Don't add scripts that would require one | |
| Corrections policy | Corrections appear at the bottom of a post with a date; posts get an `updated` date | |

## D. Launch (supply)

| Item | Notes |
|---|---|
| First content set | See the minimum in `PROJECT_BRIEF.md` §7 |
| Newsletter welcome email | One short message from the author |
| Social profiles ready to link | Avatar and banners are in `brand/social/` |
| Launch announcement | A news/blog post about why the site exists |

## E. Things already decided (don't reopen without reason)

- Visual identity: the R7 Orbit design system as shipped in `design-system/`.
- One accent colour (brass). Kinds of post are told apart by icon and label.
- Static site; content as files in the repo; no database.
- Fonts are self-hosted; no external requests for fonts, icons or scripts.
- Dates in the UI: `Oct 3, 2026`. Read time: `8 min`.
- Fonts, phase 7 (2026-10-03, for the Lighthouse budgets; owner may revisit):
  - Cormorant 500 is served by the 400 file (`font-weight: 400 500` on one `@font-face`), so section titles render at 400. One font request fewer on every page, which is what keeps LCP under 2.0 s in the mobile simulation.
  - Metric-matched fallback faces (`Cormorant Fallback`, `Inter Fallback`) sit in the font stacks, so the swap to the web fonts does not reflow headings (it caused CLS up to 0.18).
  - The Cormorant 400 italic is preloaded along with Inter and Cormorant 400 (every page has an italic-brass phrase in its headline).
- Lighthouse CI serves `dist/` with gzip (`tests/serve-dist.mjs`) because `astro preview` does not compress; production hosts do. The CLS assertion allows 0.005 (measured max 0.0011, sub-pixel font-swap shifts); the budget is still "0" in `PROJECT_BRIEF.md`.
- Links inside running text are underlined, and text fields get the standard focus ring (WCAG 1.4.1, 2.4.7); both are in `site.css`.
- Search (2026-10-03): Pagefind, a dev dependency. `npm run build` runs `astro build && node scripts/search-index.mjs` (which runs `pagefind`, or writes an empty stub index when there is no post to index, because Pagefind exits with an error on a site with no posts); `pagefind.yml` indexes only `{news,blog,vlogs,projects,repos}/*/index.html`, inside `<main>`. Output is `dist/pagefind/` (not committed). The dialog (`/` or the header button) is mounted in `BaseLayout`; `/search/` is the same panel inline and the no-JS fallback (noindex). The index only exists after a build, so under `npm run dev` the dialog says so: use `npm run build && npm run preview` to try search. The kind on each result is read from the URL's first segment.
- Admin for articles (2026-10-04): **Decap CMS** at `/admin/`, not Keystatic. Both are git-based and write MDX plus images without a database. Keystatic has the better MDX component editor, but its Astro integration (`@keystatic/astro`) works through server routes (`/api/keystatic/*`, needs an adapter and on-demand rendering) and its router is fixed to `/keystatic`; that breaks "static output, no server runtime" and the `/admin` URL. Decap is one static page at `/admin/`, and its editor components (a form per block, MDX written by `toBlock`, read back by `pattern`) cover the seven article components. Cost: Decap's rich text editor is Markdown-based, so blocks are shortcode-style (checked by `src/admin/blocks.vitest.ts` and by round-tripping in the real editor), and the nested text inside Callout, Quote and TwoColumn is a plain Markdown text box.
  - Dev dependencies: `decap-cms-app` (about 5.6 MB of JS, 1.5 MB gzipped, loaded only on `/admin/`, never on a public page), `decap-server` (local file proxy, `npm run cms`), `react` and `react-dom` (Decap's peer dependencies). `@astrojs/mdx` (build time) is added so posts can use the article components; it renders no extra JS on public pages.
  - Auth: GitHub, through an OAuth proxy the author deploys once (README "Admin"); `CMS_AUTH_URL` in `src/admin/config.ts` always has a value now (the placeholder `https://cms-auth.r7orbit.io`), so the old "sign-in is not set up" note is gone. Deployed saves go through pull requests (editorial workflow) so CI validates a post before it is live. The `draft` switch is on every collection and is off by default (the schema's own default); turn it on to hold an entry back.
  - Images: the featured image uploads to `src/assets/blog/` and is written as `../../assets/blog/x.jpg`, the relative form Astro's `image()` needs. Images in the body and in Figure/ImageGallery upload to `public/media/` and are written as `/media/x.jpg`, because the article components only accept local public files (`src/lib/article.ts`).
  - The blog schema gained `subtitle` (optional, 140 characters). It is stored but not yet shown on the post page.
- Admin for every content type (2026-10-04): the admin has a collection for news, vlogs, projects and repos as well as blog posts. Each mirrors its schema in `src/content.config.ts` with the same field names, and `src/admin/config.vitest.ts` reads the real schema to fail when a field is added, renamed, or changes between required and optional on one side only. Blog bodies are `.mdx` (article blocks); the other four are plain `.md`, so the existing sample posts show up in the admin. Rules that span fields (a vlog needs `youtubeId` or `videoUrl`; `series` needs `seriesOrder`; a cover needs alt text) cannot be expressed in Decap: the field help says so, and the build (the pull request's CI when deployed) is what enforces them.
  - `draft` defaults to off in the form, like the schema. This replaces the earlier rule that new blog posts start as drafts.
  - Blog posts have a live preview pane that renders with the site's real stylesheets (`src/admin/preview.ts`). The other kinds have none: their pages are mostly data (cards, stats, README) that the preview could only fake. What the preview approximates is listed in the README ("What the preview does not show").
- Authors (2026-10-05): **AI-written pieces are credited to R7, never to Hunter.** There are two authors, Hunter Newton (`hunter-newton`, a person) and R7 (`r7`, an AI agent, subtitle "Orbit AI Agent"), as JSON files in `src/content/authors/`, editable in the admin. Every post has an `author` (a reference to one of them; `hunter-newton` when absent; a slug that does not exist fails the build with the list of authors). Hunter's name, bio and photo are read from `author` in `src/data/site.json`, never copied. R7's bio is the author's own sentence from the About page, and its footer note is built only from the author's About-page sentences; it is **interim, the author will supply final wording** (`docs/VOICE_AND_COPY.md`, "Agent-authored footer note"; a unit test fails when the file and the doc differ).
  - An agent's byline shows its mark as the avatar, the name (a link to `/authors/r7/`), the subtitle and an **AI-written** chip (icon and words; one new 16px stroke glyph, `agent`, in the sprite; no new colour). The post ends with the agent's note. A person's post shows neither.
  - One disclosure per page: on an agent's post the byline label and footer note are the disclosure, so `aiAssist` ("How this was made") is not shown there as well. It still works on a person's post. The first vlog moved from `aiAssist: drafted` and the body sentence "I'm R7, an Orbit agent, and I wrote this summary." to `author: r7`; the blog post "How I built a browser game with R7 Orbit" already named R7 in its old free-text `author` and now has `author: r7`.
  - `/authors/<slug>/` for each author (no `/authors/` index: with two authors it would add nothing; the bylines and the filter are the way in), listed in the sitemap, not in search (like archives and tag pages). The archives, `/latest/` and `/tags/<tag>/` have a **By author** filter, a client filter like the others (hidden without JavaScript, state in `?author=r7`), shown when two or more authors have posts there.
  - Structured data: a person is a `Person`, an agent an `Organization` (name, description "Orbit AI Agent", the author page as `url`), because an agent is not a person; the author page is a `ProfilePage`. Feeds carry the name as `dc:creator`.
  - The admin's `author` field is a select built from the author files when the admin is built, so a new author appears in it after the next deploy.
- Games hub (2026-10-05): `/games/` lists every published project with a `playUrl`; there is no `games` collection. Order is the optional `order` number on the project (lower first), then newest. Play goes to `/projects/<slug>/#play`, or to `playUrl` in a new tab for `playMode: link`. With exactly one game a "More games coming" card follows it. The page is `noindex` and out of the sitemap while empty. Search results for playable projects are labelled "Game" through a Pagefind meta (`kind`). Docs: `docs/PAGES.md`.
- Playable projects (2026-10-05): a project with `playUrl` hosts a browser game deployed separately (Vesper Drift: `https://vesper.r7orbit.io/`). Docs: `docs/CONTENT_MODEL.md`.
  - The play address is front matter data. The only place the origin is also written is `frame-src` in `public/_headers`, on `/projects/*` only (not `/*`: the YouTube player on vlog and blog pages is a frame as well and `/admin/*` has its own policy, and Pages sends every matching block, so a second CSP there would also be enforced). It is the only directive, so `script-src` is not touched. A test checks every embedded `playUrl` against it.
  - The iframe's `sandbox` is `allow-scripts allow-same-origin allow-pointer-lock`. `allow-fullscreen` was asked for but is not a sandbox flag (Chrome logs it as invalid); fullscreen is granted by `allow="fullscreen; gamepad; autoplay"`. `allow-same-origin` keeps the game's own storage and cookies working; it cannot reach this page because the game is a different origin (keep it that way: never host a game on `r7orbit.io` itself with this sandbox).
  - Fixture and tests: `/styleguide/playable/` (noindex, unlinked, in `tests/routes.js`) draws the real components with a made-up address; `tests/playable.spec.js` answers that address itself.
- Editable About page (2026-10-05): the About text, picture and order live in `src/content/pages/about.md` (a `pages` collection, only About for now), edited in /admin under **Pages**. Blocks: heading, text, image, portrait and text, quote, callout, links list, button, divider (`docs/CONTENT_MODEL.md`, "Pages"). The wording was moved unchanged; `tests/about.spec.js` compares the rendered text with `tests/fixtures/about-text.txt`.
  - The portrait's file and alt text are in the block, no longer `author.photo` in `site.json` (which stays, unused by the page). The bio is now written twice: in the page (shown) and in `site.json` (Person structured data), as the brief asked; they can drift.
  - Markdown in blocks is rendered at build time with straight quotes (no smartypants) and sanitised; the meta description is a literal field (`description`), no longer cut from the bio.
  - Dev dependencies: none added (`@astrojs/markdown-remark` and `sanitize-html` were already there). No change to `public/_headers`: the editor loads the same bundle and talks to the same hosts; `tests/headers.spec.js` edits and saves the About page under the real CSP.
- Editable home and listing pages (2026-10-05, block library phase 2): the words of `/`, `/latest/`, the five archives, `/games/` and `/tags/` live in `src/content/pages/<id>.md`, edited in /admin under **Pages** (after About). The copy was moved verbatim from `KINDS` (`src/lib/listing.ts`, which keeps the labels, icons and count nouns), `GAMES_COPY` (now only `GAMES_LABEL` in `src/lib/games.ts`), `index.astro`, `ArchivePage.astro`, `ArchiveList.astro` and `tags/index.astro`. Details: `docs/CONTENT_MODEL.md` ("The home page and the listing pages"), `docs/PAGES.md`, `docs/PUBLISHING.md` section 8.
  - The home **hero is page fields, not a block** (`title` is the `h1`, `eyebrow`, `lead`, `buttons`): a hero block could put a second `h1` on another page. The rows below it are blocks. Three blocks were added to the library (`feed`, `pinned`, `games`) and `latest` gained `eyebrow`, `order` (newest or last updated: repos by last push), `look` (in the page or a ruled section), a heading-row link and `ifEmpty`; a `latest` block written before reads exactly as before. No separate "browse by kind" block: those links are part of the Latest feed, as on the page. `feed` is one per page (`once`), since it carries `#latest` and the kind filter.
  - Listing pages keep the list, filters, pagination, counts, games grid, tag chips, the kind label over the heading (it is the nav label) and the filters' "Nothing matches that." messages in code. Editable: `h1`, `seoTitle` (the browser title, today the kind's name), description, lead, empty state, and blocks above (`introSections`) and below (`outroSections`) the list. The author pages keep their own empty sentence in code (authors code was out of scope).
  - The schema adds the fields to the `pages` collection, all optional; which page needs and draws which is checked by `pageProblems` when the page is built, so a missing word or a misplaced field stops the build with the file and field.
  - The editor's file names are `home`, `latest`, `games`, `tags` and `<kind>-archive`: Decap names a file's preview template after the file, and `blog` is the blog posts' preview. Each preview draws the hero or page head and a labelled stand-in where posts go.
  - Checks: `tests/page-text.spec.js` compares each page's words with a fixture captured before the change (masking what comes from posts; only the page head when the published posts differ from the fixture's). Like the About fixture, a deliberate change of words in the editor fails that check until the fixture is refreshed (`UPDATE_PAGE_TEXT=1`). The nine pages were also compared pixel for pixel at 375px and 1280px before and after, and their `<head>` and JSON-LD are unchanged apart from the stylesheets (+1.4 kB gzipped CSS: the pages now include the block styles).
- Shared block library (2026-10-05, phase 1): every page, and later every post, can be an ordered list of blocks. One definition per block in `src/lib/sections/definitions.ts` (a Zod schema with the editor's labels and hints in `.meta()`) generates `sectionsSchema`, the Decap block list, the layout rows, the docs catalogue and the fixture page; the About page moved onto it with no change to its text or layout (its built HTML is identical). Details and the rules are in `docs/SECTIONS.md`.
  - 23 blocks: the nine About already had, plus lead paragraph, pull quote, code block, image row, lightbox gallery, video, playable game, two columns, spacer, contents list, GitHub stats, latest posts, author box, newsletter. Two columns hold **Markdown**, not nested block lists (Decap cannot edit those acceptably).
  - A game block's address must be in the `frame-src` of `public/_headers`, as projects' are; `public/_headers` and the admin's Content-Security-Policy are unchanged. `PlayPanel` gained two optional props (`id`, `showHeading`) and nothing else about it changed.
  - No new dependency. Posts, the other pages and the post collections' schemas are untouched: they attach the library later with `sectionsSchema` and `sectionsField()`.
- Cloudflare deploy (2026-10-04): the site is `https://r7orbit.io` on Cloudflare Pages; the guide is `docs/DEPLOY_CLOUDFLARE.md`.
  - The editor keeps **editorial workflow** (a pull request per post, so CI and a Pages preview see it before it is published). GitHub backend, `main`, open authoring off. Repository, branch and sign-in address are the constants `CMS_REPO`, `CMS_BRANCH`, `CMS_AUTH_URL` in `src/admin/config.ts`.
  - Sign-in is a small Worker in `workers/cms-auth/` (no dependencies, in the style of sveltia-cms-auth), deployed separately with wrangler and kept out of the Astro build, lint, type check and tests. It holds the OAuth secret; the repository holds none. It fails closed (no `ALLOWED_DOMAINS`, no sign-in) and posts the token only to the origin of an allowed site.
  - `public/_headers`: baseline security headers on every page, long cache for hashed `/_astro/*`, and on `/admin/*` `noindex`, `no-store` and a Content-Security-Policy. There is **no script CSP on public pages** (only the `frame-src` on `/projects/*` for playable projects, below) (Astro inlines small scripts, so a working policy would need `'unsafe-inline'` and protect nothing); there is **no Cross-Origin-Opener-Policy** anywhere, because the sign-in popup reports back through `window.opener`. The admin CSP needs `'unsafe-eval'` (Decap's Ajv builds validators with `new Function`) and `style-src 'unsafe-inline'`; its `connect-src` allows only itself, `blob:` (Decap reads an uploaded image back with `fetch()` for its draft backup and the commit; without `blob:` Save fails with "Failed to fetch"), `api.github.com` and `www.githubstatus.com` (its 5-minute status poll), so a script cannot send the token to any other host. `tests/headers.spec.js` runs the editor under that policy.
  - A post dated in the future is dropped at build time, so `.github/workflows/scheduled-deploy.yml` triggers a Pages Deploy Hook daily at 00:05 UTC (secret `CF_DEPLOY_HOOK_URL`; it does nothing without it).
- No samples, empty states (2026-10-05): the sample posts were deleted at the author's request; `src/content/` holds only the author's own posts. Every page works with zero posts of a kind, or of all kinds: archives and `/latest/` say nothing is posted yet (and are `noindex`, left out of the sitemap, and have no pagination), `/tags/` says there are no tags, the home page hides the Pinned (also when there is only one post), Projects and Repos sections and shows a short note under Latest, related posts, series and prev/next hide themselves, feeds are valid with no items, and search answers "Nothing found". The e2e tests (`tests/routes.js`) take post and tag pages from `dist/` instead of listing slugs, so they follow the real content; tests that need a featured image skip when no published post has one. Test content that is not published (the article components, the specimen) lives under `/styleguide/`, not `src/content/`.
- Images in the admin (2026-10-05): full write-up in `docs/IMAGES.md`.
  - Two homes: blog pictures (featured image, Image and Image gallery blocks) in `src/assets/blog/` so Astro optimises them; every other picture (cover, poster, gallery, Markdown bodies) in `public/media/<kind>/` because the schema keeps them as plain strings that cards, feeds and share images read as they are. A build step (`scripts/media.mjs dist`) shrinks `dist/media/` to at most 2000px and strips metadata; nothing is changed in git.
  - Limits: formats JPG, PNG, WebP, AVIF, SVG (HEIC and others refused); 10 MB per upload; 2 MB for anything the site serves, checked after the shrink. One module holds them (`src/lib/media-rules.mjs`).
  - Alt text is required on body pictures. `![](x.jpg "decorative")` and `decorative` on `Figure` are the explicit way out. Enforced in the admin on save and by the build.
  - The editor's `Figure` block is labelled **Image**, and Decap's built-in `image` block is replaced (same id) by one that asks for alt text and a caption. The blog no longer offers the built-in one.
  - `sharp` is a dev dependency (already installed through Astro's optional dependency, version unchanged): `scripts/media.mjs` and `tests/images.spec.js` import it directly.
