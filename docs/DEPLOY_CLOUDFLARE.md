# Deploying to Cloudflare (and signing in to `/admin/`)

A step-by-step guide for the author. It takes the repository from "on GitHub" to "live at https://r7orbit.io, with the editor at https://r7orbit.io/admin/ signing in with GitHub". Nothing here needs code changes: the repository is already set up for it (the site address, the headers, the sign-in Worker). What is left is accounts, secrets and DNS, which only you can do.

Cloudflare moves its dashboard menus around from time to time. The names in **bold** are what to look for; if a menu has moved, search the dashboard for the name.

**What you will have at the end**

| Piece | Where | What it does |
| --- | --- | --- |
| The site | Cloudflare Pages, project `r7-orbit-site` | Builds from the `main` branch and serves https://r7orbit.io |
| The editor | https://r7orbit.io/admin/ | Decap CMS; saves posts as commits or pull requests on GitHub |
| The sign-in Worker | https://cms-auth.r7orbit.io | Does the one server-side step GitHub login needs (`workers/cms-auth/`) |
| A daily rebuild | GitHub Actions → Pages Deploy Hook | Publishes posts dated in the future when their day arrives |
| The waitlist (off until you turn it on) | `/api/waitlist`, `/api/waitlist-remove` (Pages Functions), a D1 database, a Turnstile widget | Collects addresses for access to R7 Orbit: section 10 |

You will need: the GitHub repository (`EOSHunter/r7-orbit-site`), a Cloudflare account with the `r7orbit.io` zone in it (DNS is already on Cloudflare), and Node 22.12 or newer on your computer for step 4.

---

## 1. Connect the repository to Cloudflare Pages

1. Sign in at <https://dash.cloudflare.com>.
2. In the left menu open **Workers & Pages** and click **Create application**.
3. Choose the **Pages** tab (or the link that says *Looking to deploy Pages?*) and click **Import an existing Git repository** / **Connect to Git**.
4. Click **Connect GitHub**. GitHub asks which repositories Cloudflare may see: choose **Only select repositories**, pick `r7-orbit-site`, and click **Install & Authorize**.
5. Back in Cloudflare, select the repository and click **Begin setup**.
6. Fill in the build settings:

   | Setting | Value |
   | --- | --- |
   | Project name | `r7-orbit-site` (this becomes `r7-orbit-site.pages.dev`) |
   | Production branch | `main` |
   | Framework preset | `Astro` (or `None`; the two fields below are what count) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | leave empty |

7. Open **Environment variables (advanced)** and add, for **Production** and **Preview**:

   | Variable | Value | Why |
   | --- | --- | --- |
   | `NODE_VERSION` | `22` | The repository needs Node 22.12 or newer; Pages' default is older |
   | `GITHUB_TOKEN` | optional: a fine-grained token with read-only access to public repos | Only if builds log GitHub rate-limit warnings. The build fetches stars and READMEs for repo posts, and works without it. Add it as a **Secret** (Encrypt) |

   You do not need `PUBLIC_CMS_AUTH_URL`, `PUBLIC_CMS_REPO` or `PUBLIC_CMS_BRANCH`: their defaults are set in `src/admin/config.ts` (see step 8).
8. Click **Save and Deploy**. The first build takes a minute or two. When it says **Success**, open `https://r7-orbit-site.pages.dev` and check the site loads.

If the build fails, open the build log: the usual cause is a missing `NODE_VERSION` (error mentions the Node version).

What Pages does for you, and why nothing else is configured: static files are served as they are; `/about` is redirected to `/about/` (the site uses trailing slashes, matching `trailingSlash: 'always'` in `astro.config.mjs`); unknown paths get `dist/404.html` with a 404 status. Security and cache headers come from `public/_headers`, and a few redirects (the old feed addresses → `/`, `/admin` → `/admin/`) from `public/_redirects`.

## 2. Add the custom domain `r7orbit.io` and redirect `www`

1. In **Workers & Pages**, open the `r7-orbit-site` project, then the **Custom domains** tab, then **Set up a custom domain**.
2. Type `r7orbit.io` and click **Continue**, then **Activate domain**. Because the zone is on Cloudflare, it creates the DNS record (a proxied CNAME to `r7-orbit-site.pages.dev`) for you. Wait until the status says **Active** (a few minutes; the certificate is issued automatically).
3. Add `www` and send it to the bare domain:
   1. Add a DNS record: **Websites** → `r7orbit.io` → **DNS** → **Records** → **Add record**. Type `CNAME`, name `www`, target `r7orbit.io`, **Proxy status: Proxied** (orange cloud). Save. (Its target is never reached; the redirect below answers first.)
   2. Go to **Rules** → **Overview**. In the current dashboard this page has **Rule templates** and **+ Create rule** (there is no separate "Redirect Rules" menu item). Use the *Redirect from WWW to root* template, or **+ Create rule** → **Redirect Rule**. The form offers a wildcard pattern; set:
      - **Rule name**: `www to root`
      - **If incoming requests match**: **Wildcard pattern**, Request URL `https://www.*`
      - **Then**: Target URL `https://${1}`, status **301**, and **Preserve query string** on (a toggle at the bottom, easy to miss).

      The older form with a custom expression does the same thing: *Hostname* equals `www.r7orbit.io`, *Dynamic* redirect to `concat("https://r7orbit.io", http.request.uri.path)`.
   3. Click **Deploy** (not *Save as draft*). The dashboard may warn "This rule may not apply to your traffic" because it thinks `www` is not proxied. If the `www` record has an orange cloud, choose **Ignore and deploy rule anyway**.
4. Make HTTPS the only way in: **SSL/TLS** → **Edge Certificates** → turn on **Always Use HTTPS**. This is required, not optional: the rule above only matches `https://`, so without it `http://www.r7orbit.io` returns a 522 error. Leave **SSL/TLS** → **Overview** on **Full** (or **Full (strict)**; both work).
5. Check, in a terminal (your computer may cache "no such domain" for a few minutes after a record is created; `ipconfig /flushdns` on Windows clears it):

   ```
   curl -I http://r7orbit.io/about          # 301 to https, then 308 to https://r7orbit.io/about/
   curl -I http://www.r7orbit.io/about/     # 301 to https://www..., then 301 to https://r7orbit.io/about/
   curl -I https://www.r7orbit.io/about/    # 301 to https://r7orbit.io/about/
   curl -I https://r7orbit.io/admin/        # x-robots-tag: noindex, nofollow; content-security-policy: ...
   ```

The site address is already `https://r7orbit.io` in `src/data/site.json` (`url`), which feeds the canonical and Open Graph tags, JSON-LD, the sitemap and `robots.txt`. Nothing to change.

## 3. Create the GitHub OAuth App

The editor signs in with a GitHub OAuth App. It identifies the site to GitHub; its secret is held by the Worker, never by the site or the repository.

1. Sign in to GitHub as the account that owns the repository (or that has write access to it).
2. Open <https://github.com/settings/developers> (your avatar → **Settings** → **Developer settings** at the bottom of the left menu).
3. Click **OAuth Apps** → **New OAuth App**.
4. Fill in:

   | Field | Value |
   | --- | --- |
   | Application name | `R7 Orbit admin` |
   | Homepage URL | `https://r7orbit.io` |
   | Application description | optional |
   | Authorization callback URL | `https://cms-auth.r7orbit.io/callback` |
   | Enable Device Flow | leave unticked |

   The callback must be the Worker's address plus `/callback`. `wrangler.toml` puts the Worker at `cms-auth.r7orbit.io` (step 5), so use that address now. If you ever move the Worker, change this field to match.
5. Click **Register application**.
6. On the next page copy the **Client ID**. Then click **Generate a new client secret** and copy the secret **immediately** (GitHub shows it once). Keep both somewhere safe for step 4; do not paste them into the repository, a chat, or an issue.

## 4. Deploy the Worker and set its secrets

The Worker is in `workers/cms-auth/` (read its `README.md` for what it does). Do this from a terminal on your computer, in the repository folder.

1. Go into the folder and sign in to Cloudflare (a browser window opens; approve it):

   ```
   cd workers/cms-auth
   npx wrangler login
   ```

   `npx` fetches `wrangler` on first use; there is nothing to install in the repository.
2. Store the two secrets. Each command asks you to paste the value (it does not echo):

   ```
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET
   ```

   If wrangler says the Worker does not exist yet and offers to create it, answer **y**.
3. Deploy:

   ```
   npx wrangler deploy
   ```

   The output ends with the Worker's address and the custom domain it attached (`cms-auth.r7orbit.io`).
4. `ALLOWED_DOMAINS` is already `r7orbit.io` in `workers/cms-auth/wrangler.toml` (a plain variable, not a secret). It decides which sites may sign in through the Worker. The Worker refuses everyone if it is empty.

To change a secret later, run `wrangler secret put` again (no new deploy is needed). After editing `wrangler.toml`, run `wrangler deploy`.

## 5. Check the Worker's custom domain `cms-auth.r7orbit.io`

`wrangler deploy` attaches the domain for you (`routes` in `wrangler.toml`, with `custom_domain = true`). Confirm it:

1. Dashboard → **Workers & Pages** → `r7-orbit-cms-auth` → **Settings** → **Domains & Routes**. `cms-auth.r7orbit.io` should be listed as a **Custom domain**. If it is not, click **Add** → **Custom domain**, type `cms-auth.r7orbit.io` and save.
2. Wait a few minutes for the certificate, then in a browser:
   - `https://cms-auth.r7orbit.io/` shows one line of text.
   - `https://cms-auth.r7orbit.io/auth?provider=github&site_id=r7orbit.io` jumps to GitHub's "Authorize" page.
   - `https://cms-auth.r7orbit.io/auth?provider=github&site_id=example.com` says "This site is not allowed". That is correct.

   From a terminal, use a GET and print only the headers: `curl -s -D - -o NUL "https://cms-auth.r7orbit.io/auth?provider=github&site_id=r7orbit.io"` (on macOS/Linux use `-o /dev/null`) shows `302` and a `Location` on `github.com`. `curl -I` sends HEAD, which the Worker rejects with 405; that is expected.

If you use a different address, change it in three places: `routes` in `workers/cms-auth/wrangler.toml`, the callback URL of the OAuth App (step 3), and `CMS_AUTH_URL` in `src/admin/config.ts` (then commit and let Pages rebuild).

## 6. Test the login and a post

1. Open <https://r7orbit.io/admin/>. You see a **Login with GitHub** button.
2. Click it. A small window opens, GitHub asks you to **Authorize** *R7 Orbit admin* the first time, and the window closes. You land in the editor.
3. Create a test post: **Blog posts** → **Blog post**, fill in the title, summary and body, and set **Draft** on so nothing goes public.

What saving does here: the editor uses **editorial workflow**, so every post goes through a pull request.

| You do | What happens on GitHub and Cloudflare |
| --- | --- |
| **Save** | A branch `cms/blog/<slug>` and a pull request (labelled as a draft by the editor) are created. CI (`.github/workflows/ci.yml`) builds the site and checks the content against the strict schema; Cloudflare Pages builds a **preview** at a `*.r7-orbit-site.pages.dev` address you can open from the pull request. Nothing is public yet |
| Move it to **In review**, then **Ready** (the editor's *Workflow* tab) | Only the pull request's label changes |
| **Publish** (menu: *Publish now*) | The pull request is merged into `main`. That one commit on `main` triggers the production build, and the post is live at https://r7orbit.io about a minute later |
| **Delete** an unpublished entry | The pull request and branch are closed |

A post with **Draft** on is left out of the live site even after it is merged. A post whose date is in the future is also left out until its day (next section).

Sign-in is for people with **write access to the repository** only; open authoring is off. The token stays in your browser (local storage) until you click **Log out**.

Editing offline? `npm run dev` plus `npm run cms` edits the files on your computer with no login (README → "Admin").

## 7. Scheduled posts (a daily rebuild)

A post dated in the future is **not in the built site**: it is dropped at build time, so nothing shows until a build happens on or after its date. The site counts days in UTC (a post dated `2026-11-02` appears in any build from 00:00 UTC on 2 November). Merging does not rebuild on the day, so a daily rebuild is needed.

**a. Create a Deploy Hook in Cloudflare**

1. **Workers & Pages** → `r7-orbit-site` → **Settings** → **Builds** → **Deploy hooks** → **Add deploy hook**.
2. Name it `daily`, choose the branch `main`, and click **Save**.
3. Copy the **Deploy hook URL** it shows. Treat it like a password: anyone with the URL can trigger builds.

**b. Store it as a GitHub secret**

1. On GitHub open the repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Name: `CF_DEPLOY_HOOK_URL`. Secret: the URL from step a. Click **Add secret**.

**c. The workflow**

It is already in the repository, as `.github/workflows/scheduled-deploy.yml`:

```yaml
name: Scheduled deploy

on:
  schedule:
    - cron: '5 0 * * *' # every day at 00:05 UTC
  workflow_dispatch:

permissions: {}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger the Cloudflare Pages deploy hook
        env:
          CF_DEPLOY_HOOK_URL: ${{ secrets.CF_DEPLOY_HOOK_URL }}
        run: |
          if [ -z "$CF_DEPLOY_HOOK_URL" ]; then
            echo "::notice::CF_DEPLOY_HOOK_URL is not set, so no deploy was triggered."
            exit 0
          fi
          curl --fail --silent --show-error --max-time 30 --request POST "$CF_DEPLOY_HOOK_URL"
```

The file in the repository is the one that runs; the copy above is for reading. Without the secret the job does nothing and still shows green.

**d. Test it**

1. Repository → **Actions** → click **Scheduled deploy** in the left sidebar → **Run workflow** (the button is on the workflow's page, not on a single run's page, which only offers *Re-run all jobs*). The run should be green, and a new deployment appears in Cloudflare under **Deployments**.
2. To see a scheduled post appear: publish a post dated tomorrow. It is absent today. The next morning after 00:05 UTC it is live without you touching anything.

Notes: GitHub runs scheduled workflows on a best-effort basis, often a few minutes late. On a public repository GitHub **pauses scheduled workflows after 60 days with no repository activity**; opening **Actions** and enabling the workflow again fixes it. Each rebuild counts against Cloudflare's monthly build allowance (500 on the free plan; one a day is about 30).

## 8. Where the settings live in the repository

| Setting | File | Value |
| --- | --- | --- |
| Site address | `src/data/site.json` → `url` | `https://r7orbit.io` |
| Editor's repository, branch, sign-in Worker | `src/admin/config.ts` → `CMS_REPO`, `CMS_BRANCH`, `CMS_AUTH_URL` | `EOSHunter/r7-orbit-site`, `main`, `https://cms-auth.r7orbit.io` |
| Publishing mode | `src/admin/config.ts` → `publish_mode` | `editorial_workflow` (a pull request per post) |
| Response headers | `public/_headers` | Security headers everywhere; a Content-Security-Policy and `noindex` on `/admin/*`; long cache for `/_astro/*` |
| Redirects | `public/_redirects` | The removed feed addresses, `/admin` and the removed `/subscribe/` |
| Sign-in Worker | `workers/cms-auth/` | `wrangler.toml` holds the domain and `ALLOWED_DOMAINS` |
| Waitlist endpoints | `functions/api/` (the rules in `src/lib/waitlist-api.ts`), `public/_routes.json` | Only `/api/*` runs a Function; every page stays a static file |
| Waitlist table | `migrations/0001_waitlist.sql` | Applied once to the D1 database (section 10) |
| Waitlist switch, site key and words | `src/data/site.json` → `waitlist` (Admin → Site settings → Waitlist) | Off, no key |
| Waitlist database binding and secret | Cloudflare dashboard only | `WAITLIST_DB` (D1 binding), `TURNSTILE_SECRET_KEY` (secret) |

A build can override the first three with `PUBLIC_CMS_REPO`, `PUBLIC_CMS_BRANCH` and `PUBLIC_CMS_AUTH_URL`; they are visible in the browser, so never put a secret in them.

Preview deployments (`*.pages.dev`) cannot sign in: the Worker only allows `r7orbit.io`. Look at previews as visitors; edit on the live admin.

## 9. Troubleshooting

**The login window does not open, or opens and closes at once**
Your browser blocked the popup. Allow popups for `r7orbit.io` (the icon at the right of the address bar), and click **Login with GitHub** again. Also check that no browser extension or privacy setting blocks cross-window messaging. If the window opens but stays blank, open it directly: `https://cms-auth.r7orbit.io/auth?provider=github&site_id=r7orbit.io` should redirect to GitHub.

**GitHub says "The redirect_uri is not associated with this application" (redirect_uri mismatch)**
The OAuth App's **Authorization callback URL** is not exactly `https://cms-auth.r7orbit.io/callback`, or the Worker is being reached at another address (for example a `workers.dev` one). Open <https://github.com/settings/developers> → your app and correct the callback URL: same scheme, host and path, no trailing slash, no spaces. Then try again from https://r7orbit.io/admin/ (not from a `pages.dev` address).

**The popup says "This site is not allowed to use the sign-in service"**
`ALLOWED_DOMAINS` in `workers/cms-auth/wrangler.toml` does not contain the address you opened the admin on. It must be the bare hostname (`r7orbit.io`, not `https://r7orbit.io` and not `www.r7orbit.io`). Fix it and run `npx wrangler deploy`. Remember `www` redirects to the bare domain, so use that.

**The popup says "The sign-in expired or cookies are blocked", or "could not be verified"**
The sign-in has to finish within ten minutes in the same browser, and the Worker's cookie must be accepted. Close the window, allow cookies for `cms-auth.r7orbit.io`, and start again from the Login button. Do not open the callback link in a different browser.

**The popup says the Worker is missing `GITHUB_CLIENT_ID` or `GITHUB_CLIENT_SECRET`**
The secrets are not set on the deployed Worker. Run both `wrangler secret put` commands from step 4 in `workers/cms-auth/`.

**"bad_verification_code" or "incorrect_client_credentials"**
The Client ID or secret is wrong (a stray space, or an old secret after generating a new one). Run `wrangler secret put` again with the right value from the OAuth App page.

**A CORS error in the browser console**
Look at which address the message names.
- `cms-auth.r7orbit.io`: the admin should never fetch the Worker (the popup talks to it); if you see this, `CMS_AUTH_URL` is probably wrong, or ends with a slash or a path. It must be just `https://cms-auth.r7orbit.io`.
- `api.github.com`: the admin's Content-Security-Policy allows `api.github.com` (plus `www.githubstatus.com` and `blob:`, see `public/_headers`). A *CORS* message there usually means the request was blocked by a proxy, VPN or ad blocker; try a private window with extensions off.
- Anything else: the console line starts with "Refused to connect/load … Content Security Policy". Another address is needed by the editor; add it to the `/admin/*` policy in `public/_headers` (the test `tests/headers.spec.js` runs the editor under that policy).

**Login works but the editor shows an error, "not found", or no entries**
- **Repository write access.** Your GitHub account needs *write* access to `EOSHunter/r7-orbit-site`. The OAuth App can only do what you can do. Check **Settings → Collaborators** on the repository.
- **Organisation approval.** If the repository belongs to an organisation, it may have OAuth App restrictions: an owner has to approve `R7 Orbit admin` (organisation **Settings** → **Third-party access**), or you can request access on the app's authorisation page.
- **Wrong repository or branch.** `CMS_REPO` and `CMS_BRANCH` in `src/admin/config.ts` must match the repository and its default branch.
- **Private repository.** The Worker asks for the `repo` scope, which covers private repositories. A fine-grained setup is not supported by OAuth Apps.
- To start over, click your avatar in the editor → **Log out**, or clear the site's local storage, and sign in again.

**Saving fails with "Failed to persist entry: TypeError: Failed to fetch"**
Open the console. If it says `Fetch API cannot load blob:https://r7orbit.io/…` and "Content Security Policy", `connect-src` in the `/admin/*` block of `public/_headers` has lost `blob:`. Decap reads an uploaded image back from its temporary `blob:` address when it saves. `blob:` addresses are local to the tab, so allowing them does not open a path to any other site. Put `blob:` back (`connect-src 'self' blob: https://api.github.com https://www.githubstatus.com`); `tests/headers.spec.js` saves a post with an uploaded image under the real policy and fails when it is missing.

**A saved post does not appear on the live site**
Saving only opens a pull request; the post goes live when you **Publish** (merge) it. After that, check **Deployments** in Cloudflare for a build on `main`. If the post is dated in the future or has **Draft** on, it is left out on purpose (section 7). If the build failed, the log names the field the strict content schema rejected (for example a cover image without alt text).

**`/admin/` shows a blank page**
Open the browser console (F12). A line starting "Refused to …" names the blocked address (see CORS above). "Evaluating a string as JavaScript" means the `'unsafe-eval'` source was removed from the policy in `public/_headers`; Decap needs it.

**The daily rebuild does not run**
Repository → **Actions** → **Scheduled deploy**. If it says the workflow is disabled (60 days with no activity), enable it. If a run is green but there was no deployment, the `CF_DEPLOY_HOOK_URL` secret is empty or the hook was deleted in Cloudflare; create a new hook and update the secret.

**Rolling back**
In Cloudflare, **Deployments** → pick an earlier successful deployment → **Rollback to this deployment**. To remove the sign-in, delete the OAuth App on GitHub, or revoke access at <https://github.com/settings/applications>.

## 10. The waitlist (D1 and Turnstile)

The site has a waitlist for access to R7 Orbit: a form under the home page headline (and at the end of any post with **Waitlist form at the end** ticked) where readers leave their email address, and a page, `/waitlist/remove/`, where they take it off again. **It is off.** Until you finish these steps and turn it on in the admin, no page shows a form, nothing loads from Cloudflare, `/waitlist/remove/` is the 404 page, and the two endpoints answer "not available" or "not open". Everything in the repository is ready; what is left is three things in your Cloudflare account, one paragraph on the Privacy page, and a switch.

How it fits together:

| Piece | Where | Notes |
| --- | --- | --- |
| The form | `src/components/WaitlistForm.astro` | Words from Admin → Site settings → Waitlist. Loads Turnstile only when a reader comes to the form |
| The endpoints | `functions/api/waitlist.ts`, `functions/api/waitlist-remove.ts` | Cloudflare Pages Functions: Pages builds them from `functions/` on every deploy, no setting needed. `public/_routes.json` limits them to `/api/*` |
| The list | A D1 database bound as `WAITLIST_DB` | One table, `waitlist`: `email`, `created_at`, `source` (hero, blog, vlog or other). No IP address, no browser details |
| Spam protection | A Turnstile widget (its site key in the settings, its secret key as `TURNSTILE_SECRET_KEY`) + a hidden honeypot box | Most readers never see Turnstile; it shows a checkbox only when Cloudflare is unsure |

No email is ever sent: there is no email service. The list is yours to read and export (below).

### a. Create the database and its table

1. Dashboard → **Storage & Databases** → **D1 SQL Database** (in older menus: **Workers & Pages** → **D1**) → **Create** (or **Create database**).
2. Name: `r7-orbit-waitlist`. Location: leave it on automatic. Click **Create**.
3. Open the new database, then its **Console** tab. Paste the whole content of `migrations/0001_waitlist.sql` (from `CREATE TABLE` to the closing `);`) and click **Execute**. It answers with a success message.

   From a terminal instead (in the repository folder, after `npx wrangler login`): `npx wrangler d1 execute r7-orbit-waitlist --remote --file=migrations/0001_waitlist.sql`. If wrangler says it cannot find the database, use the Console.
4. Check, in the Console: `SELECT * FROM waitlist;` answers with no rows (and no error).

### b. Create the Turnstile widget

1. Dashboard → **Turnstile** (in the account's left menu; search for it if it has moved) → **Add widget**.
2. Fill in:

   | Field | Value |
   | --- | --- |
   | Widget name | `R7 Orbit waitlist` |
   | Hostnames | `r7orbit.io` |
   | Widget mode | **Managed** |
   | Pre-clearance | **No** |

3. Click **Create**. Copy the **Site Key** (starts with `0x`; public: it goes in the admin in step e) and the **Secret Key** (private: step c). The secret can be shown again later from the widget's settings.

### c. Connect the database and the secret to the site

1. **Workers & Pages** → `r7-orbit-site` → **Settings** → **Bindings** → **Add** → **D1 database**. Variable name: `WAITLIST_DB` (exactly). Database: `r7-orbit-waitlist`. **Save**. Do it for **Production**; preview deployments cannot use the form anyway (below).
2. Same project → **Settings** → **Variables and Secrets** → **Add**. Type: **Secret**. Name: `TURNSTILE_SECRET_KEY`. Value: the Secret Key from step b. Environment: **Production**. **Save**.
3. Bindings and secrets apply to the next deployment: **Deployments** → the latest production deployment → **⋯** → **Retry deployment** (or wait for the next push to `main`).
4. Check that the site sees them (any terminal):

   ```
   curl -s -X POST https://r7orbit.io/api/waitlist -H "Origin: https://r7orbit.io" -d "email=test@example.com"
   ```

   - `{"ok":false,"message":"The waitlist is not open."}`: **ready**. The database and the secret are found; the form is just still off.
   - `{"ok":false,"message":"The waitlist is not available right now. ..."}`: the binding or the secret is missing or misspelt, or the deployment is older than step 3.
   - The site's 404 page (HTML): the deployment has no Functions yet; check that the latest deployment is from a commit that has the `functions/` folder.

### d. Say on the Privacy page what happens to the addresses

The Privacy page says the site collects nothing and loads nothing from other companies. Once the form is on, that is no longer the whole story: the address is stored in your Cloudflare D1 database, and Turnstile (Cloudflare) runs when a reader uses the form. The wording is yours. In the admin, **Pages** → **Privacy page**, add a **Text** block whose first line is `{if waitlist on}`: it is shown only while the waitlist is on, so you can write it now. A block whose first line is `{if waitlist off}` is shown only while it is off. Say at least what is stored (the address, the date, which form), where (Cloudflare), what for, and that `/waitlist/remove/` takes an address off. Update "Last updated".

### e. Turn it on

1. Admin → **Site settings** → **Waitlist**: paste the **Site Key** into **Turnstile site key**, turn **Show the waitlist** on, read the words (they are interim; change any of them), and **Publish**.
2. After the build: the form is under the home page headline (the home page's **Waitlist form** switch, in **Pages** → **Home page**, is already on), at the end of every post with **Waitlist form at the end** ticked, and `/waitlist/remove/` exists.
3. Try it on https://r7orbit.io with your own address: "You are on the list." Then in the D1 Console, `SELECT * FROM waitlist;` shows it. Remove it at `/waitlist/remove/` and check again.

The build refuses Cloudflare's test keys (`1x…`, `2x…`, `3x…`) and anything not shaped like a site key in that box, and nothing is drawn while the box is empty.

### Reading and exporting the list

- **Dashboard**: the database's **Console**: `SELECT email, created_at, source FROM waitlist ORDER BY created_at;`
- **Terminal**, as JSON: `npx wrangler d1 execute r7-orbit-waitlist --remote --json --command "SELECT email, created_at, source FROM waitlist ORDER BY created_at" > waitlist.json`. Keep the file out of the repository.
- **Removing someone by hand**: `DELETE FROM waitlist WHERE email = 'name@example.com';` (addresses are stored lowercased).

### Turning it off

Turn **Show the waitlist** off and publish. The forms and `/waitlist/remove/` disappear with the next build and the endpoints answer "not open"; the addresses stay in D1 until you delete them (`DELETE FROM waitlist;`, or delete the database).

### What the endpoints answer

Both answer JSON, never cached: `{"ok":true}` or `{"ok":false,"message":"…"}`. They only say `ok` once the address is stored (or was already there), or, for removal, is gone. A duplicate gets the same answer as a new address, and removal answers the same whether or not the address was there, so nobody can find out who is on the list.

| Status | Meaning |
| --- | --- |
| 200 `ok: true` | Stored (or already there); removed (or was not there); or the honeypot was filled (nothing stored) |
| 400 | The address is not a plain address, the Turnstile check failed, or the request could not be read. The form shows the message |
| 403 | The request did not come from a page of `https://r7orbit.io` (the `Origin` header) |
| 404 | The waitlist is off in the settings of the deployed commit (the bindings are fine) |
| 405 | Not a POST |
| 413 | Body over 4 KB |
| 500 | The database write failed (for example, the table was never created: step a) |
| 503 | `WAITLIST_DB` or `TURNSTILE_SECRET_KEY` is missing (step c) |

Preview deployments (`*.r7-orbit-site.pages.dev`) refuse the form with 403: the endpoints accept only the site's own address.

### Costs

The free plans cover a waitlist many times over: Pages Functions count as Workers requests (100,000 a day), and only `/api/*` runs one; D1 allows 100,000 writes and 5 million reads a day and 5 GB; Turnstile is free.

### Trying it on your computer

The live switch can stay off for all of this.

1. `npm run dev` draws the forms on every page that asks for one, with a dashed "Dev only" note when the live site would not show them, using Cloudflare's test site key `1x00000000000000000000AA` (always passes). `astro dev` runs no Functions, so sending says "Something went wrong": that is expected there.
2. For the whole path (form → Turnstile → Function → database), build with the forms forced on and serve the build with wrangler (from the repository folder):

   ```
   WAITLIST_PREVIEW=1 npm run build      # PowerShell: $env:WAITLIST_PREVIEW='1'; npm run build; Remove-Item Env:WAITLIST_PREVIEW
   cp .dev.vars.example .dev.vars        # Cloudflare's test secret; git ignores .dev.vars
   npx wrangler d1 execute WAITLIST_DB --local -c scripts/wrangler.waitlist-local.toml --persist-to .wrangler/state --file=migrations/0001_waitlist.sql
   npx wrangler pages dev dist --d1 WAITLIST_DB=r7-orbit-waitlist
   ```

   Open the address wrangler prints (`http://127.0.0.1:8788`). Locally the endpoints accept pages on localhost and ignore the live switch. See the rows with `npx wrangler d1 execute WAITLIST_DB --local -c scripts/wrangler.waitlist-local.toml --persist-to .wrangler/state --command "SELECT * FROM waitlist"`. Run `npm run build` again afterwards so `dist/` is the normal site.

**`WAITLIST_PREVIEW=1` is for tests and local runs only.** It puts the forms on every page with a test key that lets anyone through. Never add it to the Cloudflare Pages project: a Pages build that sees it stops with a message saying so. CI uses it for a second build that runs `tests/waitlist.spec.js` and Lighthouse on the pages with forms.
