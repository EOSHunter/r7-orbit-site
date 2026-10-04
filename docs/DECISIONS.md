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
| Domain name | e.g. a `.com` or `.dev`; buy from Cloudflare Registrar or Namecheap | |
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
| Hosting | Cloudflare Pages | |
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
- Search (2026-10-03): Pagefind, a dev dependency. `npm run build` runs `astro build && pagefind`; `pagefind.yml` indexes only `{news,blog,vlogs,projects,repos}/*/index.html`, inside `<main>`. Output is `dist/pagefind/` (not committed). The dialog (`/` or the header button) is mounted in `BaseLayout`; `/search/` is the same panel inline and the no-JS fallback (noindex). The index only exists after a build, so under `npm run dev` the dialog says so: use `npm run build && npm run preview` to try search. The kind on each result is read from the URL's first segment.
- Admin for articles (2026-10-04): **Decap CMS** at `/admin/`, not Keystatic. Both are git-based and write MDX plus images without a database. Keystatic has the better MDX component editor, but its Astro integration (`@keystatic/astro`) works through server routes (`/api/keystatic/*`, needs an adapter and on-demand rendering) and its router is fixed to `/keystatic`; that breaks "static output, no server runtime" and the `/admin` URL. Decap is one static page at `/admin/`, and its editor components (a form per block, MDX written by `toBlock`, read back by `pattern`) cover the seven article components. Cost: Decap's rich text editor is Markdown-based, so blocks are shortcode-style (checked by `src/admin/blocks.vitest.ts` and by round-tripping in the real editor), and the nested text inside Callout, Quote and TwoColumn is a plain Markdown text box.
  - Dev dependencies: `decap-cms-app` (about 5.6 MB of JS, 1.5 MB gzipped, loaded only on `/admin/`, never on a public page), `decap-server` (local file proxy, `npm run cms`), `react` and `react-dom` (Decap's peer dependencies). `@astrojs/mdx` (build time) is added so posts can use the article components; it renders no extra JS on public pages.
  - Auth: GitHub, through an OAuth proxy the author deploys once (README "Admin"); no proxy URL means `/admin/` shows "sign-in is not set up". Deployed saves go through pull requests (editorial workflow) so CI validates a post before it is live. The `draft` switch is on every collection and is off by default (the schema's own default); turn it on to hold an entry back.
  - Images: the featured image uploads to `src/assets/blog/` and is written as `../../assets/blog/x.jpg`, the relative form Astro's `image()` needs. Images in the body and in Figure/ImageGallery upload to `public/media/` and are written as `/media/x.jpg`, because the article components only accept local public files (`src/lib/article.ts`).
  - The blog schema gained `subtitle` (optional, 140 characters). It is stored but not yet shown on the post page.
- Admin for every content type (2026-10-04): the admin has a collection for news, vlogs, projects and repos as well as blog posts. Each mirrors its schema in `src/content.config.ts` with the same field names, and `src/admin/config.vitest.ts` reads the real schema to fail when a field is added, renamed, or changes between required and optional on one side only. Blog bodies are `.mdx` (article blocks); the other four are plain `.md`, so the existing sample posts show up in the admin. Rules that span fields (a vlog needs `youtubeId` or `videoUrl`; `series` needs `seriesOrder`; a cover needs alt text) cannot be expressed in Decap: the field help says so, and the build (the pull request's CI when deployed) is what enforces them.
  - `draft` defaults to off in the form, like the schema. This replaces the earlier rule that new blog posts start as drafts.
  - Blog posts have a live preview pane that renders with the site's real stylesheets (`src/admin/preview.ts`). The other kinds have none: their pages are mostly data (cards, stats, README) that the preview could only fake. What the preview approximates is listed in the README ("What the preview does not show").

