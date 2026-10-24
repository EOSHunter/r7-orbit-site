# Ship notes: the endless runner on the 404 page (branch `fix/agent-avatar-fill`)

Written 2026-10-24 by the ship check. Everything below was run on a clean `npm ci` of the branch merged with `origin/main` (7124487).

## Pull request

**Title:** Endless runner on the 404 page, Orbit Royale published, About-page tests follow the page

**Description:**

- The 404 page now carries a small endless-runner game (Three.js, a lazy chunk): a poster with a Play button, the game fetched on the first interaction and prefetched when the page is idle. Normal pages never load it.
- The Orbit Royale project is published (`draft: false`) and its blog post is linked from the Projects page (a "Behind Orbit Royale" row).
- Blog and project pages: pictures open larger in a dialog (`ImageZoom`).
- Callout labels no longer draw a full stop (kept for screen readers); the Team block's names are `h3` under a heading and `h2` when nothing comes before, so no page skips a heading level.
- `origin/main` is merged in (the Movie Wheel work and the About-page test fixes). Four test files conflicted; main's way of reading the About page was kept.
- Fixes needed to be green: a type error in `src/lib/movie-wheel-api.ts` (`npm run check` failed on main), and `src/lib/site-pages.vitest.ts` no longer demands an `order` in every Latest block.
- Removed scratch files (`.tmp-shots/`, `.tmp-measure.mjs`).

## What ships

- **Runner** (`src/game/runner/`, `src/components/RunnerStage.astro`, `src/styles/runner-stage.css`, `docs/RUNNER.md`): the game, the rover model (`rover.glb`, built in Blender by `tools/runner/build_rover.py`), bots that measure difficulty (`npm run runner:bots`), the 404 page stage, and the `/styleguide/runner/` test page. New runtime dependency: `three` (about 0.19 MB of JavaScript in a lazy chunk, `dist/_astro/runner.*.js`, loaded only by the 404 page and the styleguide page).
- **Agent avatars:** the avatar-fill fix itself (`fix/agent-avatar-fill`, PR #39) is already in main. Nothing more of it ships here.
- **Content:** Orbit Royale project published; the Projects page gets the "Behind Orbit Royale" row.
- **Small site changes:** picture zoom on posts, Callout label, Team heading level.
- **Tests:** the About-page tests read the page from the files instead of hard-coding it; the Latest-block test (below).

## The test that was fixed

`src/lib/site-pages.vitest.ts`, "can be saved in the editor as it is", demanded that every block in every page file wrote out each menu and number the form requires. `src/content/pages/projects.md` has a Latest block with no `order`, so it failed. `order` has a schema default (`newest`), so the file is valid and the build fills it in. The test now:

- only demands what the schema requires (a field with no default),
- parses each block with `sectionsSchema` and checks that a defaulted field comes back with its value,
- and a new test, "accepts a Latest block as the editor wrote it without order", fails if the schema ever starts rejecting that block.

`projects.md` was not edited. One thing to know: if you open Projects in /admin, the Order menu of that block may show empty until you pick "Newest first" (Decap does not fill defaults into a block already in the file). Saving it once writes the field.

## Results

Run on a clean `npm ci` of the merged result, in a separate worktree:

| Step | Result |
| --- | --- |
| `npm run check` | 0 errors, 0 warnings (before the fix: 1 error in `movie-wheel-api.ts`, which is on main too) |
| `npm run lint` | clean |
| `npm run test:unit` | 9 node tests + 949 Vitest tests (59 files), all pass |
| `npm run build` (the Cloudflare command) | passes: picture guard, Astro build, media shrink, no-contact, search index |
| Playwright e2e (`--workers=2`) | 798 passed, 3 skipped; 3 failed on the first run, all three fixed and re-run green (About tests: the Team block's names are `h2` when no heading is above it; a leftover Table-of-contents special case) |
| Lighthouse (404, runner styleguide page, About, Projects) | all assertions pass |

Not run here: the full Lighthouse over every route and the `WAITLIST_PREVIEW=1` build with `tests/waitlist.spec.js` that CI also runs (the waitlist is not touched by this branch).

Build output: 392 files, 22.6 MB; largest file 5.65 MB (the editor bundle, `/admin/` only); the game chunk is 0.64 MB; nothing near Cloudflare's 25 MiB per file limit.

The game on the 404 page: `dist/404.html` exists; the game script, the `runner` chunk and `rover.glb` are referenced only by `404.html` and `/styleguide/runner/`, with root-absolute addresses (`/_astro/...`). A deep missing address (`/nope/deeper/path/`, run through `astro preview`) answered HTTP 404 with the 404 page words and the stage button. The chunk and model are requested as idle `prefetch` (fetched, not run) once the page has loaded: that is the design (`RunnerStage.astro`, tested by `tests/runner-404.spec.js`), not a request before the page is ready.

Admin and host files: no change to `public/_headers`, `public/_redirects` or `site.json`. `src/admin/` has two small changes that follow the components (Callout label in the preview; Team name heading level in the block preview). `WAITLIST_PREVIEW` is set only in `.github/workflows/ci.yml`'s waitlist step.

## Not included yet

Two other tasks land after this as separate small merges: **Space to start and the focus-frame fix** (`src/pages/404.astro`, `RunnerStage.astro`, `tests/runner-404.spec.js`), and **the runner QA report** (`docs/RUNNER_QA.md`).

## Steps for the author

1. Open a pull request from this branch into `main` on GitHub, with the title and description above.
2. Wait for the CI check (check, lint, build, tests, Lighthouse, the waitlist build).
3. Merge it.
4. Watch the Cloudflare Pages deployment (Workers & Pages > the site > Deployments).
5. Open a missing address such as `/anything-missing/` and `/a/b/c/`: the 404 page should show with the game poster; press the button and play.

## Rollback

Cloudflare Pages > Deployments > pick the last good deployment > Rollback to this deployment. Then revert the merge commit on `main` on GitHub (the pull request page has a Revert button) so the next build does not bring it back.
