# R7 repository context: R7 Orbit site

`r7-orbit-site` is the Astro site for R7 Orbit: home, news, blog, vlogs, projects, repositories, the Apps hub, authors, topic archives and search. It builds static pages from typed content collections. Its `/admin/` provides a Git-backed editor; a repository skill guides content authoring. This describes the repository at `0dda24e3c6c90266ac7c325dfa653cbac46c5924` on 2026-10-10, not a verified live deployment.

- `src/content.config.ts`, `src/content/`, `src/lib/content*.ts`: collection schemas, entries and queries.
- `src/pages/`, `src/components/`, `src/layouts/`: routes, cards, articles and layouts. `src/pages/index.astro` composes the latest and featured content.
- `src/admin/`, `src/pages/admin/index.astro`: bundled Decap CMS editor for blog, news, vlog, project and repository posts, the About page and site settings. Local editing uses `npm run cms`; deployed GitHub sign-in uses the separately configured `workers/cms-auth/` Worker (`README.md`, `docs/DEPLOY_CLOUDFLARE.md`).
- `src/lib/sections/`, `src/lib/sections-to-content.ts`, `src/admin/sections-config.ts`: shared editable section blocks for pages and post kinds (`docs/SECTIONS.md`).
- `src/pages/games/index.astro`, `src/scripts/play-facade.js`: playable-project listing and embedded game interface, controlled by project content and framing headers.
- `src/pages/authors/`, `src/admin/authors.ts`: author profiles and author attribution.
- `src/components/article/`: reusable MDX article blocks; `docs/ARTICLE_COMPONENTS.md` documents their authoring syntax.
- `src/styles/`, `src/styles/design-system/`: site styling and tokens.
- `src/pages/sitemap-*.xml.ts`, `pagefind.yml`: sitemap and static search index. RSS/newsletter publishing was removed; redirects keep old URLs from breaking.
- `.claude/skills/add-content/`: repository-specific guidance, templates and checklists for drafting valid site content; the skill explicitly leaves publishing to Orbit and the site owner.
- `tests/`, `src/**/*.test.ts`: browser and unit checks. `package.json` defines `npm run build`, `npm run check`, `npm run lint` and `npm test`.

See [decisions](decisions.md) and [October 2026 changes](changes/2026-10.md). The history summary is bounded to mainline integration outcomes from the initial commit through the head above. Publishing instructions are in `docs/PUBLISHING.md`; configuration and checks are in `docs/DEPLOY_CLOUDFLARE.md` and `docs/LAUNCH_CHECKLIST.md`.
