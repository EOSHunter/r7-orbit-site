# Build plan

The order to build it in, with a definition of done for each step. Each phase is small enough to hand to one agent (or one sitting). Phases 3–6 can run in parallel once phase 2 is merged.

Assumes the recommended stack (Astro, plain CSS from the design system, Markdown content, Pagefind, Cloudflare Pages). If `DECISIONS.md` picks something else, keep the phases and swap the tools.

## Phase 0: Decisions and accounts (the author, ~1 hour)

- [ ] Fill `docs/DECISIONS.md` §A and §B (name, tagline, bio, domain, links, light theme yes/no)
- [ ] Create the GitHub repository for the site (private until launch)
- [ ] Create a Cloudflare (or Netlify/Vercel) account; connect the repository later
- [ ] Buy the domain (or decide to launch on the host's free subdomain first)
- [ ] Create a newsletter account (Buttondown) and get the form/API details
- [ ] Create a GitHub personal access token (read-only, public repos) for build-time repo stats; store it as a secret, never in git

**Done when:** `DECISIONS.md` has answers or accepted recommendations for every row in §A and §B.

## Phase 1: Scaffold

- [ ] New project from the kit: copy the kit into the repo root, `CLAUDE.md` at the top, then create the Astro project (`npm create astro@latest`, "empty" template, TypeScript strict, no extras)
- [ ] Put `design-system/` at `src/styles/design-system/` (or `public/`) and the fonts where they will be served (`public/fonts/`); fix the `@font-face` URLs
- [ ] Copy `brand/*` favicons and OG default to `public/`; `site.webmanifest`
- [ ] Add scripts: `dev`, `build`, `preview`, `check` (astro check + type check), `lint`, `format`, `test`
- [ ] Add `.editorconfig`, `.gitignore`, Prettier, ESLint
- [ ] CI: build + check + link check on every pull request
- [ ] Deploy a "hello" page to the host so every later change has a preview URL

**Done when:** `npm run dev` shows a page in the R7 Orbit look (tokens loaded, fonts correct); the host deploys on push; CI is green.

## Phase 2: Layout and shared parts

- [ ] `BaseLayout.astro`: head (all tags from `SEO_AND_SHARING.md`), skip link, header, footer, theme script (no flash)
- [ ] `Header`, `Footer`, `SubscribeBand`, `Icon` (sprite or inline SVG components), `MediaPlaceholder`
- [ ] Post card components for the five kinds (`PostCard.astro` with a `kind` switch)
- [ ] `site.json` wired in; nothing author-specific hard-coded
- [ ] Theme toggle + system preference

**Done when:** a test page renders every component in both themes at 320 / 768 / 1280 px with no console output; Lighthouse accessibility is 100 on it.

## Phase 3: Content collections and sample content (parallel)

- [ ] `content.config.ts` from `CONTENT_MODEL.md` (adjust to the installed Astro version)
- [ ] Copy `content-examples/` into `src/content/`
- [ ] Helpers: sort by date, hide drafts and future dates, read time, tag index, related posts, series
- [ ] Markdown pipeline: heading anchors, code highlighting with a theme built from the tokens, callouts, figures, external-link handling
- [ ] Build fails with a clear message on a bad frontmatter field; warns on two `featured`

**Done when:** `npm run build` passes with the examples; breaking a field produces a readable error.

## Phase 4: Pages (parallel by page group)

- [ ] 4a Home + archives + pagination + tags (with the no-JS fallback and the JS filter)
- [ ] 4b Blog post + news item (TOC, share row, related, series, prev/next)
- [ ] 4c Vlog page (facade, chapters, transcript details)
- [ ] 4d Project + Repo pages (gallery dialog, facts panel, README rendering)
- [ ] 4e About, Subscribe, Privacy, 404

Port from `templates/`; the template HTML is the visual spec. Keep class names from `components.css`; add page CSS only in `site.css` and only with tokens.

**Done when:** each page meets the acceptance list in `PAGES.md`.

## Phase 5: Data and integrations (parallel)

- [ ] GitHub data loader with cache and graceful failure; README fetch + sanitise
- [ ] Newsletter form posts to the provider (or its endpoint) with inline success/error states; double opt-in on
- [ ] Pagefind indexing in the build; search UI styled with tokens
- [ ] YouTube facade; poster downloaded at build
- [ ] Scheduled daily rebuild (host cron or GitHub Actions `schedule`) so repo stats stay fresh

**Done when:** each integration has a test or a manual checklist item, and the build still passes with the network off.

## Phase 6: Feeds, SEO, sharing (parallel)

- [ ] RSS (all + per kind), sitemap, `robots.txt`, redirects file
- [ ] JSON-LD per page type; canonical; OG tags; `og:image` fallback
- [ ] Optional: per-post OG images (satori)

**Done when:** feeds validate; the Rich Results Test passes for each page type; link previews look right in Slack/Discord/LinkedIn.

## Phase 7: Quality pass

- [ ] Playwright smoke test per page type (loads, no console errors, key element visible) in both themes
- [ ] axe accessibility scan on every page type; fix all serious/critical
- [ ] Lighthouse CI budgets (≥ 95 mobile everywhere; JS < 50 kB; CSS < 40 kB)
- [ ] Visual checks at 320 / 375 / 768 / 1024 / 1280 / 1480; screenshots saved in `docs/screenshots/`
- [ ] Keyboard-only walkthrough; screen reader check of home, a post, a vlog
- [ ] `prefers-reduced-motion` and forced-colors check
- [ ] Print stylesheet for posts
- [ ] Cross-browser: Chrome, Firefox, Safari (incl. iOS)

**Done when:** all of the above pass and are recorded in the pull request.

## Phase 8: Content for launch (the author)

Per the minimum in `PROJECT_BRIEF.md` §7. Write in Markdown; run `npm run check`; open a pull request per batch so each gets a preview URL.

## Phase 9: Launch

- [ ] Domain connected; HTTPS on; `www` ↔ apex redirect; staging protected
- [ ] Search Console + Bing verified; sitemap submitted
- [ ] Privacy page live; newsletter welcome email set
- [ ] Social profiles updated with the brand assets
- [ ] Announce: a post on the site first, then link it everywhere
- [ ] Add a calendar reminder: review analytics/search queries and broken links monthly

## After launch (ideas, not commitments)

Per-post OG images · related posts by embeddings · a /now page · webmentions · a changelog pulled from GitHub releases · a monthly digest · localisation · a dark/light OG image per theme.

## Working rules for the build

- One pull request per phase item; small and reviewable. Squash-merge.
- Never merge with failing CI. Never skip hooks.
- Update `CLAUDE.md` when a decision changes how work is done.
- Record non-obvious decisions in `docs/DECISIONS.md` with the date and the reason.
- If the design system lacks something, add a token or component to it deliberately (and note it in its `DESIGN_SYSTEM.md`) instead of writing a one-off value.
