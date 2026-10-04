# R7 Orbit site decisions

- **2026-10-03 — Build a static content site.** Astro, MDX collections and `src/content.config.ts` define posts and pages; the build adds Pagefind search (`package.json`, `pagefind.yml`).
- **2026-10-03 — Keep content types explicit.** Blog, news, vlogs, projects and repositories have distinct collection data and routes (`src/content.config.ts`, `src/pages/`).
- **2026-10-04 — Let editors draft blog articles through Git.** The bundled Decap CMS at `/admin/` writes MDX and uploaded images; locally it uses a file proxy, and deployed editing uses GitHub authentication plus editorial pull requests. Drafts stay out of published pages and indexes (`README.md`, `src/admin/config.ts`, `src/admin/exclusions.vitest.ts`). Deployment authentication is conditional on its configured URL.
- **2026-10-04 — Share article components between authored pages and the editor.** MDX blocks under `src/components/article/` match the insert controls in `src/admin/blocks.ts`; `docs/ARTICLE_COMPONENTS.md` documents the supported props.
