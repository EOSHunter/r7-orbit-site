# R7 repository context: R7 Orbit site

`r7-orbit-site` is the Astro site for R7 Orbit: home, news, blog, vlogs, projects, repositories, topic archives and search. It builds static pages from typed content collections; `README.md` documents the Git-backed article editor. This describes the repository at `342790ed917efa8910036fa6133842aa39a3470a` on 2026-10-04, not a verified live deployment.

- `src/content.config.ts`, `src/content/`, `src/lib/content*.ts`: collection schemas, entries and queries.
- `src/pages/`, `src/components/`, `src/layouts/`: routes, cards, articles and layouts. `src/pages/index.astro` composes the latest and featured content.
- `src/admin/`, `src/pages/admin/index.astro`: bundled Decap CMS editor for MDX blog posts. Local editing uses `npm run cms`; deployed sign-in requires configuration described in `README.md`.
- `src/components/article/`: reusable MDX article blocks; `docs/ARTICLE_COMPONENTS.md` documents their authoring syntax.
- `src/styles/`, `src/styles/design-system/`: site styling and tokens.
- `src/pages/rss.xml.ts`, `src/pages/sitemap-*.xml.ts`, `pagefind.yml`: feeds, sitemap and static search index.
- `tests/`, `src/**/*.test.ts`: browser and unit checks. `package.json` defines `npm run build`, `npm run check`, `npm run lint` and `npm test`.

See [decisions](decisions.md) and [October 2026 changes](changes/2026-10.md). The history summary is bounded to mainline integration outcomes from the initial commit through the head above.
