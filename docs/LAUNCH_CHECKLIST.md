# Launch checklist

Everything still sample or owed by the author before the site goes public.

## Sample content: done

The sample posts are gone (2026-10-05). `src/content/` now holds only the author's own posts, written through `/admin`.

- [x] ~~`src/content/blog/why-every-agent-gets-its-own-room.md`~~ deleted.
- [x] ~~`src/content/blog/a-featured-image-on-a-post.md`~~ deleted.
- [x] ~~`src/content/blog/an-article-built-from-components.mdx`~~ deleted (not in the old list, but its body said "This is sample content", and it used the sample images below).
- [x] ~~`src/assets/blog/sample-orbit-hero.jpg`~~ and ~~`public/media/sample-rings-{left,right,wide}.svg`~~ deleted with those posts.
- [x] ~~`src/content/news/2026-10-03-open-weights-model-lands.md`~~ deleted.
- [x] ~~`src/content/vlogs/i-built-a-game-with-a-team-of-ai-agents.md`~~ deleted, easter egg included (the author no longer wants samples).
- [x] ~~`src/content/projects/r7-orbit.md`~~ deleted. Add the real project in `/admin` when it is ready.
- [x] ~~`src/content/repos/example-repo.md`~~ deleted. Add a real public repo in `/admin`.
- [x] Pages with nothing in them have empty states: archives, `/latest/`, `/tags/`, the home page, related posts, series and prev/next. Sitemap and search stay valid with no posts (`docs/DECISIONS.md`, "No samples, empty states").
- [x] `tests/routes.js`, the screenshot script and the docs no longer name sample slugs: post and tag pages are found in `dist/`. The article-components demo is at `/styleguide/article-components/` (noindex, not content).
- [ ] Still sample, outside `src/content/` and never published: `content-examples/` (the original kit examples, not built), `templates/` (static HTML references) and the placeholder text in `src/pages/styleguide/specimen.astro` (noindex, unlinked).

## `src/data/site.json` placeholders

- ~~`url`~~: done, `https://r7orbit.io` (it sets the canonical URLs, sitemap and `robots.txt`).
- ~~`author.name`~~, ~~`author.bio`~~: done (the author's own words, also the text of `/about/`).
- ~~`author.photo`~~: done (`/media/about/hunter-newton.jpg`).
- `links.youtube` points at `@R7Creatives`; confirm it is yours.
- `name`, `tagline`, `description`: placeholders, confirm or change.

Also review `/about/` and `/privacy/` copy once the above is known.

## Manual steps owed by the author

1. **Domain.** ~~Choose and buy it, set `url` in `site.json`~~: done (`r7orbit.io`, DNS on Cloudflare). Still to do: add it to the Pages project and redirect `www`, and record the decision in `docs/DECISIONS.md` (`docs/DEPLOY_CLOUDFLARE.md` steps 1-2).
2. **Decap CMS auth (`/admin`).** Done in the repository: the GitHub backend, `repo` / `branch`, the sign-in Worker (`workers/cms-auth/`), `public/_headers` and the scheduled-deploy workflow. Still to do by hand, in order, following `docs/DEPLOY_CLOUDFLARE.md`: connect the repository to Cloudflare Pages (steps 1), create the GitHub OAuth App (3), deploy the Worker and set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` with `wrangler secret put` (4-5), test a login and a save-to-publish round trip (6), and add the Deploy Hook and the `CF_DEPLOY_HOOK_URL` secret (7). Secrets go in Cloudflare and GitHub, never in git.
4. **Analytics.** None is installed. Add one only if you choose to (`docs/DECISIONS.md`).
5. **Cloudflare Pages settings.** Build command `npm run build`, output `dist`, production branch `main`, `NODE_VERSION=22` (`docs/DEPLOY_CLOUDFLARE.md` step 1). Check `curl -I https://r7orbit.io/admin/` shows `x-robots-tag: noindex` and a `content-security-policy`.
6. **Final pass.** Run `npm run build`, `npm test`, `npm run test:lighthouse`, and check the sitemap and share images (`docs/SEO_AND_SHARING.md`) on the live domain.
