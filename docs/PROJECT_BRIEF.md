# Project brief

A personal publishing site for AI work: **news, blog posts, vlogs, projects and repos**, in the R7 Orbit visual style. This is a separate project from the R7 Orbit desktop app; it only borrows its look.

This document is the "why and what". `PAGES.md` is the "what each page is". `CONTENT_MODEL.md` is "what a post is made of". `BUILD_PLAN.md` is "in what order".

---

## 1. What this is

One site, one author, five kinds of thing:

| Kind | What it is | Typical length | Where it lives |
|---|---|---|---|
| **News** | A short take on something happening in AI, with a link to the source | 150–500 words | `/news/` |
| **Blog** | An essay or write-up: what I learned, how something works | 800–3000 words | `/blog/` |
| **Vlog** | A video I made, embedded, with notes and chapters | A video + 100–600 words | `/vlogs/` |
| **Project** | Something I built: what, why, how, what I learned | A page with sections and screenshots | `/projects/` |
| **Repo** | A GitHub repository, shown with live stats and a short write-up | A card with a README-style page | `/repos/` |

A visitor can browse everything on the home page, filter by kind or tag, search, subscribe by email or RSS, and follow through to the video, the code or the live project.

## 2. Who it is for

1. **Builders using AI tools** (developers, designers, tinkerers) who want honest accounts of what works and what doesn't.
2. **People deciding whether to try something**: will this tool/approach work for my situation?
3. **The author's future self** and anyone vetting the author's work: a clear record of what was built and when.

## 3. What it should feel like

Calm, precise, a little theatrical. Like a well-made instrument: dark, quiet, one warm metal accent. The R7 Orbit system in `design-system/` is the source of truth. Words are plain, first-person and specific (see `VOICE_AND_COPY.md`). Nothing shouts. Nothing blinks without a reason.

**It should not feel like**: a generic SaaS landing page, a hype-driven AI newsletter, a template blog theme, or a cluttered feed with ads, pop-ups and cookie walls.

## 4. Goals

1. Publishing a new post takes **minutes, not an afternoon**: write a Markdown file, push, done.
2. The site is **fast and light**: it opens instantly on a phone on a poor connection.
3. Every kind of post has a **fitting, consistent page** (not one template stretched over five).
4. It is **findable**: good titles, descriptions, share images, feeds, sitemap.
5. It is **accessible** and works with keyboard, screen reader, reduced motion and both light/dark preferences.
6. It is **cheap to run**: static hosting, no database, no accounts.

## 5. Non-goals (for the first version)

- User accounts, comments, likes, or any visitor login.
- A CMS or an admin screen. Content is files in the repo.
- Paid memberships or a shop.
- Tracking that identifies individuals; ad networks; third-party scripts beyond an optional privacy-friendly analytics script.
- Auto-generated AI content published without the author's review.

These can come later; none of them should be blocked by the first build.

## 6. Features

**Must have (v1)**

- Home page with hero, one pinned post, latest feed with filters, projects and repos strips, subscribe band.
- Archive page per kind, with tag filter, text search, sort, pagination.
- Post pages for each of the five kinds (see `PAGES.md`).
- Tag pages; About page; 404 page.
- Dark theme only (the light "Ivory" theme was removed; see `DECISIONS.md`).
- RSS (all posts, plus one feed per kind), `sitemap.xml`, `robots.txt`.
- Open Graph / Twitter cards, with a good default image and an optional per-post cover.
- Newsletter sign-up form wired to a real provider.
- Site-wide search (static, built at build time).
- Repo cards show live GitHub data (stars, forks, language, last update), fetched **at build time**, refreshed by a scheduled rebuild.
- Videos embedded with a click-to-load facade (no YouTube scripts until the visitor presses play).
- Code blocks with syntax colours from the palette and a copy button.

**Nice to have (v1.x)**

- Per-post generated share images (title on the brand background).
- "Related posts" chosen by shared tags.
- Reading progress bar on long posts.
- A "now" or "uses" page.
- Webmentions or a comments system (Giscus) if the author wants conversation.
- A changelog for projects pulled from GitHub releases.

## 7. Content strategy (what to publish first)

Launch with enough to make every section real. A suggested minimum:

- 3 blog posts (one story, one how-to, one opinion)
- 3 news items
- 2 vlogs (embedded from YouTube)
- 3 projects (R7 Orbit, the game built with it, one more)
- 3 repos
- An About page with a real photo or the brand mark, and honest bio

Nothing is published as "coming soon". Empty sections stay out of the navigation until they have at least three items.

## 8. Recommended technology

These are recommendations with reasons. The author decides (`DECISIONS.md`); the design system works with any of them.

| Concern | Recommendation | Why | Alternatives |
|---|---|---|---|
| Framework | **Astro** (static output) | Content-first, Markdown/MDX collections with typed fields, ships almost no JavaScript, easy RSS/sitemap | Next.js (heavier), Eleventy (lighter, less structure), SvelteKit |
| Styling | **The design system's plain CSS** (`tokens.css`, `components.css`, small `site.css`) | Already built, tiny, themeable. No build step | Tailwind v4 with `tailwind/theme.css` if the author prefers utilities |
| Content | Markdown/MDX files with frontmatter in `src/content/<kind>/` | Diffable, portable, works with any editor, works with AI agents | A headless CMS later |
| Search | **Pagefind** | Static, tiny, no server, runs at build time | Fuse.js over a JSON index |
| Video | YouTube via `youtube-nocookie.com`, click-to-load facade | Privacy and speed | Self-hosted video (cost), Vimeo |
| Repo data | GitHub REST API at build time (token in env) | No runtime calls, no rate-limit surprises for visitors | Runtime fetch (not recommended) |
| Newsletter | **Buttondown** or similar with a hosted form | Simple, owns the list, RSS-to-email | Substack (less control), ConvertKit, Resend + own list |
| Hosting | **Cloudflare Pages** (or Netlify/Vercel/GitHub Pages) | Free static hosting, previews on branches, custom domain, HTTPS | — |
| Analytics | **None**, or Cloudflare Web Analytics / Plausible | Privacy-friendly, no cookie banner needed | — |
| Share images | Static default now; `satori` + `resvg` per-post later | Quick start, upgrade path | — |
| Tests | Playwright smoke + axe accessibility, Lighthouse CI | Catches regressions in look and basics | — |

## 9. Quality bar

| Area | Target |
|---|---|
| Lighthouse (mobile) | Performance, Accessibility, Best Practices, SEO all ≥ 95 |
| LCP / CLS / INP | < 2.0s on a mid-range phone / 0 / < 200ms |
| JavaScript shipped | < 50 kB gzipped on a typical page (video facade and search load on demand) |
| CSS | < 40 kB gzipped total |
| Fonts | Self-hosted woff2, `font-display: swap`, preload only the two used above the fold |
| Images | AVIF/WebP with width/height set, `loading="lazy"` below the fold, meaningful `alt` |
| Accessibility | WCAG 2.2 AA; keyboard only works everywhere; visible focus; reduced-motion respected |
| Browser support | Last two versions of Chrome, Edge, Firefox, Safari; iOS Safari 16+ |
| Layout | 320px to 1480px+, no horizontal page scroll |

## 10. Success looks like

- A new reader can tell within five seconds what the site is and what's newest.
- A video, a post and a repo about the same project link to one another.
- The author publishes at least one thing a week without touching the code.
- The site still looks and feels like R7 Orbit.
