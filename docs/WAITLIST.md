# The waitlist

The site has a waitlist for access to R7 Orbit: readers leave their email address in a form, and you see the list in Cloudflare. It is **off** until you turn it on. While it is off, no page shows a form, nothing loads from Cloudflare, `/waitlist/remove/` is the 404 page, and the site is exactly what it was.

It is not a newsletter: the site sends no email to anyone, and there is no email service behind it.

**Where the form shows, once it is on:**

- in the home page's R7 Orbit section (the **Spotlight** block with its **Waitlist form** switch on, in **Pages > Home page**; since 2026-11-13). The form under the headline is still there as a switch (**Waitlist form**, now off), so the page asks once;
- at the end of any post with **Waitlist form at the end** ticked (every kind of post has the box; it is on for the blog post and the vlog "So you've got an AI that writes code. Cool. What if you had ten?");
- wherever you add the **Waitlist form** block on a page built from blocks (About, or above or below a listing).

Each address is stored with the date and where it was left: `hero` (home page), `blog` (a blog post or news item), `vlog` (a vlog), or `other` (a project, a repo, or a block set to Other). A reader can take their address off at `/waitlist/remove/` (the small "Remove my email" link under every form).

## Where you are (2026-10-10)

You have already done steps 1 to 4 except one part of step 1: the database exists, the `WAITLIST_DB` binding is on the Pages project, the Turnstile widget exists and `TURNSTILE_SECRET_KEY` is set. **What is left:**

1. Create the table: apply `migrations/0001_waitlist.sql` to the database (step 1b).
2. Paste the Turnstile site key in **/admin > Site settings > Waitlist**, tick **Enabled**, review the wording, save and publish (step 6; the deploy that follows also picks up the binding and the secret, step 5).
3. Test it (step 7).

Before step 6, read the Privacy section at the end of this page.

## 1. Create the database and its table

**a. The database** (done). In a terminal, in the repository folder: `npx wrangler login` (a browser window asks you to approve), then `npx wrangler d1 create r7-waitlist`. Or in the dashboard: **Storage & Databases > D1 SQL Database > Create**, name `r7-waitlist`.

If you gave it another name, use that name in the commands on this page, and change `database_name` in `scripts/wrangler.waitlist.toml` to match (the export in step 8 reads it).

**b. The table** (to do). Either:

- in a terminal, in the repository folder (after `npx wrangler login`):

  ```
  npx wrangler d1 execute r7-waitlist --remote --file=migrations/0001_waitlist.sql
  ```

  It asks to confirm, then says the command executed successfully;

- or in the dashboard: open the database, then its **Console** tab, paste everything in `migrations/0001_waitlist.sql` from `CREATE TABLE` to the closing `);`, and click **Execute**.

Check: in the Console, `SELECT * FROM waitlist;` answers with no rows and no error. Running the file twice does no harm (`CREATE TABLE IF NOT EXISTS`).

## 2. Connect the database to the site

(Done.) **Workers & Pages > r7-orbit-site > Settings > Bindings > Add > D1 database**. Variable name: `WAITLIST_DB` (exactly). Database: `r7-waitlist`. Save it for **Production** and for **Preview**.

## 3. Create the Turnstile widget

(Done.) Turnstile is Cloudflare's spam check: most readers never see it; it shows a checkbox only when Cloudflare is unsure.

**Dashboard > Turnstile > Add widget**. Name: `R7 Orbit waitlist`. Hostname: `r7orbit.io`. Widget mode: **Managed**. Pre-clearance: **No**. Create, then copy the **Site Key** (starts with `0x`; public, it goes in the admin in step 6) and the **Secret Key** (private, step 4). Both can be shown again from the widget's settings.

## 4. Give the site the secret key

(Done.) **Workers & Pages > r7-orbit-site > Settings > Variables and Secrets > Add**. Type: **Secret**. Name: `TURNSTILE_SECRET_KEY`. Value: the Secret Key. Save it for **Production** (and Preview if you like). Never paste the secret anywhere else: not in the admin, not in the repository.

## 5. Redeploy

A binding or a secret applies to the next deployment. Step 6 publishes a change, which deploys the site, so nothing extra is needed. To deploy without a change: **Workers & Pages > r7-orbit-site > Deployments**, the latest production deployment, **...** > **Retry deployment**.

Optional check, before turning the form on (any terminal):

```
curl -s -X POST https://r7orbit.io/api/waitlist -H "Origin: https://r7orbit.io" -d "email=test@example.com"
```

- `{"ok":false,"message":"The waitlist is not open."}`: **ready**. The site sees the database and the secret; the form is just still off.
- `{"ok":false,"message":"The waitlist is not available right now. ..."}`: the binding or the secret is missing, misspelt, or older than the latest deployment. Redeploy, then check steps 2 and 4.

## 6. Turn it on

1. Open **https://r7orbit.io/admin/** > **Site settings** > **Waitlist**.
2. **Turnstile site key**: paste the Site Key (`0x…`). The build refuses Cloudflare's test keys and anything that is not shaped like a site key.
3. Tick **Enabled**. Both are needed: with **Enabled** ticked and the key box empty, no form shows anywhere, so the admin refuses to save that (the message is under the key box).
4. Review the wording. Every word is interim, written so you can replace it:

   | Box | Today |
   | --- | --- |
   | Heading | Join the waitlist |
   | Text | Get access to R7 Orbit. |
   | Button | Join the waitlist |
   | Email box label | Email address |
   | Message after joining | You are on the list. |
   | Message when it fails | Something went wrong. Please try again. |
   | Remove link | Remove my email |
   | Remove page: heading | Leave the waitlist |
   | Remove page: button | Remove my email |
   | Remove page: message after removing | If that address was on the waitlist, it has been removed. |
   | Message without JavaScript | JavaScript is needed to join the waitlist. |

5. **Save**, then **Publish** (as for a post: the pull request's check goes green, then publish). Wait for the Cloudflare deploy to finish (about a minute after the merge).

## 7. Test it

With your own address:

1. **Home page**: the form is in the R7 Orbit section ("Coming soon"), under its points. Send your address: "You are on the list." It is counted as `other` (the block's **Waitlist: counted as**).
2. **The blog post** `/blog/so-youve-got-an-ai-that-writes-code-cool-what-if-you-had-ten/`: the band is at the end, before "Related". Send a second address (or the same one: the answer is the same, and it is stored once).
3. **The vlog** `/vlogs/so-youve-got-an-ai-that-writes-code-cool-what-if-you-had-ten/`: the same band before "Keep watching".
4. **Check the list**: in the database's Console, `SELECT * FROM waitlist;` shows your addresses with `other` (the home page), `blog`, `vlog`.
5. **Removal**: open `/waitlist/remove/` (or the "Remove my email" link), send one of the addresses, and check the Console again: it is gone.

## 8. See or export the list

- **Dashboard**: the database's **Console**: `SELECT email, created_at, source FROM waitlist ORDER BY created_at;`
- **A CSV file**: in a terminal, in the repository folder, after `npx wrangler login`:

  ```
  npm run waitlist:export
  ```

  It writes `waitlist.csv` (email, created_at, source; oldest first) in the repository folder. Git ignores that file; keep it off shared drives, it is a list of people's addresses. `npm run waitlist:export -- --out C:\somewhere\list.csv` writes it elsewhere. A cell starting with `+`, `-`, `=` or `@` gets a leading `'` so a spreadsheet cannot run it as a formula.
- **Removing someone by hand**: in the Console, `DELETE FROM waitlist WHERE email = 'name@example.com';` (addresses are stored in lowercase).

## 9. Switch it off

**/admin > Site settings > Waitlist**: untick **Enabled**, save, publish. After the deploy the forms and `/waitlist/remove/` are gone and the endpoints answer "The waitlist is not open." The addresses stay in the database until you delete them (`DELETE FROM waitlist;`, or delete the database).

## 10. Troubleshooting

**The form shows an error about Turnstile, or the browser console says "invalid domain" / error 110200.** The widget does not allow the address the page is on. Dashboard > **Turnstile** > the widget > **Settings** > **Hostnames**: it must list `r7orbit.io`. Preview deployments (`*.pages.dev`) are not listed, and their form is refused anyway (below).

**What the form or `curl` answers:**

| Status | Meaning |
| --- | --- |
| 200 `{"ok":true}` | Stored, or already there; removed, or was not there |
| 400 "Please enter a valid email address." | The address is not a plain address |
| 400 "The spam check did not pass. Please try again." | Turnstile refused the token, or it expired (sending again gets a new one) |
| 403 "Requests from other sites are not accepted." | The request did not come from a page of `https://r7orbit.io`. Preview deployments get this, on purpose |
| 404 "The waitlist is not open." | **Enabled** is off in the settings of the deployed version |
| 500 "Your address could not be saved. ..." | The database refused the write: usually the table does not exist yet (step 1b) |
| 503 "The waitlist is not available right now. ..." | `WAITLIST_DB` or `TURNSTILE_SECRET_KEY` is missing, misspelt, or added after the latest deployment (steps 2, 4 and 5) |

The form shows the two 400 messages as they are; for anything else it shows your "Message when it fails".

**The browser console says "Refused to frame 'https://challenges.cloudflare.com/'" or another Content Security Policy line.** Project pages have a `frame-src` list in `public/_headers` (`/projects/*`), and it includes `https://challenges.cloudflare.com`. If that host was removed, the widget cannot load on project pages; put it back (`tests/headers.spec.js` checks it). Other public pages have no such policy.

**"Binding missing" in a Pages build or the dashboard**: the variable name must be exactly `WAITLIST_DB`, on the environment you are testing (Production for r7orbit.io).

**The build stops with "WAITLIST_PREVIEW=1 is set in the Cloudflare Pages build".** `WAITLIST_PREVIEW` is for tests on a computer only: it puts the form on every page with a test key that lets anyone through. Remove the variable from **Workers & Pages > r7-orbit-site > Settings > Variables and Secrets** and redeploy. The waitlist is turned on with **Enabled** in the admin, never with that variable.

**"Enabled" is ticked but no form shows anywhere.** The Turnstile site key is empty: the form cannot work without it, so the site draws nothing (the build log says `[waitlist] Waitlist: "Enabled" is ticked but the Turnstile site key is empty`). Paste the Site Key in **/admin > Site settings > Waitlist** (step 6), save and publish. Since 2026-10-10 the admin refuses to save "Enabled" with an empty key; a file saved before then can still hold it.

**The build stops on the site key.** It refuses an empty-looking or test key (`1x…`, `2x…`, `3x…`): paste the Site Key of your own widget, which starts with `0x`. It is never the Secret Key.

## Privacy

The Privacy page today says the site has no analytics, no cookies, and that pages load nothing from other companies ("I don't know who reads it"), and it has two old paragraphs about a newsletter that no longer exists. Once the waitlist is on, the page must also say that email addresses are collected for the waitlist: what is stored (the address, the date, which form), where (Cloudflare D1), what for, and how to leave (`/waitlist/remove/`). Turnstile is a Cloudflare service that runs when a reader uses the form.

The wording is yours. In **/admin > Pages > Privacy page**, add a **Text** block whose first line is `{if waitlist on}`: it shows only while the waitlist is on, so you can write it now. A block whose first line is `{if waitlist off}` shows only while it is off.

> **Draft, not legal advice, not on the site:** "If you join the waitlist, your email address is stored with the date and the page you joined from, in a database at Cloudflare, so I can tell you when R7 Orbit is available; the form uses Cloudflare Turnstile to keep out spam, and you can remove your address at any time at /waitlist/remove/."

## How it works (for whoever maintains the site)

| Piece | Where |
| --- | --- |
| The form | `src/components/WaitlistForm.astro` + `waitlist/WaitlistFields.astro`, behaviour `src/scripts/waitlist.js`, styles `src/styles/waitlist.css` (printed only on a page with a form). Turnstile loads on the reader's first focus, touch, pointer or scroll, never with the page |
| Placement | `waitlist` on the home page (`src/content/pages/home.md`), `waitlist` on any post, the `waitlist` block (`src/lib/sections/definitions.ts`) |
| The endpoints | `functions/api/waitlist.ts`, `functions/api/waitlist-remove.ts` (Cloudflare Pages Functions, built by Pages from `functions/`); every rule is in `src/lib/waitlist-api.ts`. `public/_routes.json` limits Functions to `/api/*` |
| The table | `migrations/0001_waitlist.sql`: `id`, `email` (unique, any case), `created_at`, `source`. No IP address, no browser details |
| Settings | `waitlist` in `src/data/site.json` (Admin > Site settings > Waitlist); the secret only in Cloudflare |
| Export | `scripts/waitlist-export.mjs`, `scripts/wrangler.waitlist.toml` (not named `wrangler.toml` and not at the root: Pages would read that as the project's bindings) |
| Tests | `src/lib/waitlist*.vitest.ts`, `tests/waitlist.spec.js` |

The endpoints answer JSON (`{"ok":true}` or `{"ok":false,"message":"…"}`), never cached, and say `ok` only once the address is stored (or was already there) or, for removal, is gone. A duplicate gets the same answer as a new address, and removal answers the same whether or not the address was there, so nobody can find out who is on the list. A hidden honeypot box catches simple bots: when it is filled, the answer is `ok` and nothing is stored.

Costs: the free plans cover a waitlist many times over (Pages Functions count as Workers requests, 100,000 a day, and only `/api/*` runs one; D1 allows 100,000 writes and 5 million reads a day; Turnstile is free).

### Trying it on your computer

The live switch can stay off.

1. `npm run dev` draws the forms on every page that asks for one, with a dashed "Dev only" note and Cloudflare's test key `1x00000000000000000000AA` (always passes). `astro dev` runs no Functions, so sending says "Something went wrong": expected there.
2. The whole path (form, Turnstile, Function, database), from the repository folder:

   ```
   WAITLIST_PREVIEW=1 npm run build      # PowerShell: $env:WAITLIST_PREVIEW='1'; npm run build; Remove-Item Env:WAITLIST_PREVIEW
   cp .dev.vars.example .dev.vars        # Cloudflare's test secret; git ignores .dev.vars
   npx wrangler d1 execute WAITLIST_DB --local -c scripts/wrangler.waitlist.toml --persist-to .wrangler/state --file=migrations/0001_waitlist.sql
   npx wrangler pages dev dist --d1 WAITLIST_DB=r7-waitlist
   ```

   Open `http://127.0.0.1:8788`. Locally the endpoints accept pages on localhost and ignore the live switch. `npm run waitlist:export -- --local` exports the local list. Run `npm run build` again afterwards so `dist/` is the normal site.

`WAITLIST_PREVIEW=1` is for tests and local runs only (CI uses it for a second build that runs `tests/waitlist.spec.js` and Lighthouse on pages with forms); a Cloudflare Pages build with it set stops.
