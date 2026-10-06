# Verify a new post

Run from the repository root, in this order. Stop at the first failure and fix the post (never the schema, a test or the site code). Run `npm ci` first if `node_modules/` is missing, and `npx playwright install chromium` once if the browser tests say it is missing.

```
npm run check
npm run lint
npm run build            # media guard, schema, Astro, shrink pictures, Pagefind index
npm run test:unit
npm run test:e2e         # E2E_PORT=4401 npm run test:e2e   if port 4399 is busy
```

Check who owns a port before choosing another, and never kill a process you did not start: PowerShell `Get-NetTCPConnection -LocalPort 4399 -State Listen`. `npm run test:e2e` serves `dist/` itself; another checkout's server on the same port would be testing that checkout's `dist/`.

## The page, the listings, the sitemap, search, screenshots

The post must be `draft: false` and dated today or earlier for this part; build again after changing it.

```
node .claude/skills/add-content/checklists/check-page.mjs blog/<slug> "<a phrase from the post>"
```

(Git Bash rewrites a leading `/blog/...`; leave the slash off, or use PowerShell.) It serves `dist/` on a free port, checks that `dist/<kind>/<slug>/index.html` exists and that the kind's archive, `/latest/`, `/sitemap-0.xml` and the site search all contain it, that there is no horizontal scroll and no console error at 375px and 1280px, and writes `.cache/add-content/<slug>-375.png` and `-1280.png` (git-ignored). Open both screenshots and look at them. A game, app or project with a `playUrl` is also on `/apps/`, with its type chip and Play or Open button.

axe: `npm run test:e2e` runs axe over every post page it finds in `dist/` (`tests/routes.js`). To run it on one page: `EXTRA_ROUTES="/blog/<slug>/" npx playwright test a11y`.

## No leak (draft or scheduled)

Set the post back to `draft: true` (or its real future `date`), `npm run build`, then:

```
node .claude/skills/add-content/checklists/check-page.mjs blog/<slug> "<a phrase from the post>" --absent
```

All lines must read `ok (absent)`. It also helps to `rg -l "<slug>" dist` (no output expected; the sitemap and archives must not name it).

## Lighthouse (only for a post with a hero, a big cover or poster, or a game or app)

```
npm run build
LIGHTHOUSE_ROUTES="/blog/<slug>/" npm run test:lighthouse     # PowerShell: $env:LIGHTHOUSE_ROUTES="/blog/<slug>/"
```

It serves `dist/` on 4398; if that is busy (`Get-NetTCPConnection -LocalPort 4398`), set `LIGHTHOUSE_PORT=4397`. Every category 95 or more, LCP under 2 s, CLS 0. The route must be in `tests/routes.js`, which finds post pages in `dist/` by itself; a draft is not there. Only the first build after `draft: false` can be checked.

## Picture-only checks

`npm run media:check` is the fast guard (format, name, 10 MB). The build also fails for a file over 2 MB after shrinking.

## What to report

Exactly what ran and what it said. Anything not run: say so and why.
