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
