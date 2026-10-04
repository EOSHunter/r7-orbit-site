# cms-auth: GitHub sign-in for the Decap admin

A small Cloudflare Worker that lets the editor at `https://r7orbit.io/admin/` sign in with GitHub. GitHub's OAuth flow needs one step that must happen on a server (trading a code for a token with the app's secret), and the site itself is static, so this Worker does just that step. It follows the same protocol as [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) and has no dependencies.

It is **not part of the Astro site**: it is not built, linted, type-checked or tested with it, and it is deployed on its own with `wrangler`. The step-by-step setup, including creating the GitHub OAuth App, is in [`docs/DEPLOY_CLOUDFLARE.md`](../../docs/DEPLOY_CLOUDFLARE.md).

## What it does

| Route           | Who calls it                                              | What happens                                                                                                                                                                   |
| --------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /auth`     | Decap, in a popup (`?provider=github&site_id=<hostname>`) | Checks `site_id` against `ALLOWED_DOMAINS`, sets a one-time state cookie, redirects to GitHub's authorize page with the `repo` scope                                           |
| `GET /callback` | GitHub, after the author approves                         | Checks the state cookie, trades the code for an access token, and posts `authorization:github:success:{"token":…,"provider":"github"}` to the admin page that opened the popup |
| `GET /`         | anyone                                                    | A one-line text page                                                                                                                                                           |

Choices that go a little beyond sveltia-cms-auth:

- It **fails closed**: with no `ALLOWED_DOMAINS` set, nobody can sign in.
- The token is posted only to the origin `https://<site_id>` of a site on the allow list, so another website cannot open the popup, borrow the sign-in and receive the token.
- The state cookie is scoped to `/callback`, lasts ten minutes and is cleared when used. Responses are `no-store`.
- Nothing is stored or logged. The token passes through to the browser and is not kept.

## Settings

| Name                   | Kind                       | Value                                                            |
| ---------------------- | -------------------------- | ---------------------------------------------------------------- |
| `GITHUB_CLIENT_ID`     | secret                     | The OAuth App's Client ID                                        |
| `GITHUB_CLIENT_SECRET` | secret                     | The OAuth App's client secret                                    |
| `ALLOWED_DOMAINS`      | variable (`wrangler.toml`) | `r7orbit.io` (comma separated; `*.r7orbit.io` allows subdomains) |

Secrets are never committed. Set them with `npx wrangler secret put GITHUB_CLIENT_ID` and `npx wrangler secret put GITHUB_CLIENT_SECRET`.

## Deploy

From this folder (needs Node 22 and a Cloudflare account that has the `r7orbit.io` zone):

```
npx wrangler login
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler deploy
```

`wrangler.toml` attaches the Worker to `cms-auth.r7orbit.io` as a custom domain, so the address to give GitHub is `https://cms-auth.r7orbit.io/callback`. If you use another address, change `routes` in `wrangler.toml`, the callback URL in the GitHub OAuth App, and `CMS_AUTH_URL` in `src/admin/config.ts`, and rebuild the site.

## Check it by hand

- `https://cms-auth.r7orbit.io/` shows the one-line text page.
- `https://cms-auth.r7orbit.io/auth?provider=github&site_id=r7orbit.io` redirects to `github.com/login/oauth/authorize`.
- The same URL with `site_id=example.com` shows "This site is not allowed" and does not redirect.
- `npx wrangler tail` streams the Worker's requests while you test a login (it shows errors, not tokens).

To try it locally: put the two secrets in a `.dev.vars` file in this folder (it is git-ignored) and run `npx wrangler dev`. The GitHub OAuth App's callback would then need to be `http://localhost:8787/callback`, so use a separate OAuth App for that.
