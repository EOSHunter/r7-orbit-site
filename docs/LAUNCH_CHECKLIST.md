# Launch checklist

Everything still sample or owed by the author before the site goes public. Every sample post carries "Sample" in its title and a `# SAMPLE CONTENT` comment in its front matter.

## Sample files to delete or replace

| File | What it is | Action |
| --- | --- | --- |
| `src/content/blog/why-every-agent-gets-its-own-room.md` | Sample blog post (has a sample pull quote and "Sample text" lines) | Replace with a real post, or delete |
| `src/content/blog/a-featured-image-on-a-post.md` | Sample showing the featured image | Delete |
| `src/assets/blog/sample-orbit-hero.jpg` | Placeholder hero drawing used by the post above | Delete with that post |
| `src/content/news/2026-10-03-open-weights-model-lands.md` | Sample news item. `sourceUrl` is `example.com`; no real model or benchmark | Replace or delete |
| `src/content/vlogs/i-built-a-game-with-a-team-of-ai-agents.md` | Sample vlog. **Deliberate easter egg:** the only sample using the Rickroll ID `dQw4w9WgXcQ`. Duration and chapters are made up | Delete (or keep as a joke, your call) |
| `src/content/projects/r7-orbit.md` | Sample project. `liveUrl` is `example.com`, `repo` is `owner/r7-orbit`, gallery image is the R7 mark standing in for a screenshot, timeline is invented | Replace with the real project |
| `src/content/repos/example-repo.md` | Sample repo. `repo: owner/example-repo` does not exist | Replace with a real public repo |

After deleting, the home page, archives and `tests/routes.js` reference these slugs: update the route list in `tests/routes.js` (and `EXTRA_ROUTES` use) so e2e still passes with the real posts. `src/pages/styleguide/specimen.astro` also uses sample text but is noindex and unlinked.

## `src/data/site.json` placeholders

- ~~`url`~~: done, `https://r7orbit.io` (it sets the canonical URLs, feeds, sitemap and `robots.txt`).
- `author.name`: "Your Name".
- `author.bio`: "Two or three sentences, in the first person."
- `author.photo`: `null`.
- `author.email`: `hello@example.com`.
- `links.github`, `links.x`, `links.linkedin`, `links.bluesky`: empty. `links.youtube` points at `@R7Creatives`; confirm it is yours.
- `name`, `tagline`, `description`: placeholders, confirm or change.
- `newsletter.formAction`: empty (see below).

Also review `/about/` and `/privacy/` copy once the above is known.

## Manual steps owed by the author

1. **Domain.** ~~Choose and buy it, set `url` in `site.json`~~: done (`r7orbit.io`, DNS on Cloudflare). Still to do: add it to the Pages project and redirect `www`, and record the decision in `docs/DECISIONS.md` (`docs/DEPLOY_CLOUDFLARE.md` steps 1-2).
2. **Decap CMS auth (`/admin`).** Done in the repository: the GitHub backend, `repo` / `branch`, the sign-in Worker (`workers/cms-auth/`), `public/_headers` and the scheduled-deploy workflow. Still to do by hand, in order, following `docs/DEPLOY_CLOUDFLARE.md`: connect the repository to Cloudflare Pages (steps 1), create the GitHub OAuth App (3), deploy the Worker and set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` with `wrangler secret put` (4-5), test a login and a save-to-publish round trip (6), and add the Deploy Hook and the `CF_DEPLOY_HOOK_URL` secret (7). Secrets go in Cloudflare and GitHub, never in git.
3. **Newsletter provider.** `provider` is `buttondown` but no account is connected. Create the account, put its form URL in `newsletter.formAction`, and test a signup. Until then the form shows a "sample only" message.
4. **Analytics.** None is installed. Add one only if you choose to (`docs/DECISIONS.md`).
5. **Cloudflare Pages settings.** Build command `npm run build`, output `dist`, production branch `main`, `NODE_VERSION=22` (`docs/DEPLOY_CLOUDFLARE.md` step 1). Check `curl -I https://r7orbit.io/admin/` shows `x-robots-tag: noindex` and a `content-security-policy`.
6. **Final pass.** Run `npm run build`, `npm test`, `npm run test:lighthouse`, and check the feed, sitemap and share images (`docs/SEO_AND_SHARING.md`) on the live domain.
