# The Movie Wheel

An unlisted page at `/mw-554e0676db47baa4/` (the files are in `public/mw-554e0676db47baa4/`): a wheel that picks a movie, plus the list, star ratings and reviews, a dashboard and a chat about your history. It is not in the nav, the sitemap or `robots.txt`, and `public/_headers` sends `noindex` for it.

**Your list lives in the site's database**, so it is the same on every device: a change on your phone shows on your laptop. There is no Worker address or password to enter on a device. You sign in once per device with an emailed code (Cloudflare Access), and the page and its API are one site.

How it fits together:

- **The page** (`public/mw-554e0676db47baa4/index.html`) keeps a copy of the list on the device so it works instantly and offline, and `sync.js` sends changes to the database and picks up other devices' changes (on every change, when you return to the tab, and every minute). `config.js` has `api: '/api/movie-wheel'`, which switches the page to this mode.
- **The API** is two Cloudflare Pages Functions, `functions/api/movie-wheel/list.ts` (the list) and `chat.ts` (the chat). All of their logic is in `src/lib/movie-wheel-api.ts` and its tests in `src/lib/movie-wheel-api.vitest.ts`.
- **The database** is the same D1 database as the waitlist (`WAITLIST_DB`), in two tables of their own: `movie_wheel_movies` and `movie_wheel_meta` (`migrations/0002_movie_wheel.sql`). No waitlist data is read or changed.
- **Merging.** If two devices change the list while apart, each movie keeps its most recent edit. A removed movie stays removed (it is kept as a marker for 90 days so an old device cannot bring it back); editing a removed movie afterwards brings it back.
- **Who can call it.** Only a signed-in Cloudflare Access visitor. Access adds a signed token to every request; the Functions check that token themselves (signature, application, expiry), so the API stays closed even if the Access rule is removed or its path is wrong. With the Access settings missing, every request is refused with a 503.

## Set it up (once)

You need the Cloudflare account that runs the site. About ten minutes.

### 1. Create the tables

In a terminal in the repository folder (after `npx wrangler login`):

```
npx wrangler d1 execute r7-waitlist --remote --file=migrations/0002_movie_wheel.sql
```

It asks to confirm, then reports success. Running it twice does no harm. Check: in the dashboard, **Storage & Databases > D1 > r7-waitlist > Tables** lists `movie_wheel_movies` and `movie_wheel_meta`.

The chat history and the "added by" names came later and each has its own file. Run them once, in this order, after the first:

```
npx wrangler d1 execute r7-waitlist --remote --file=migrations/0003_movie_wheel_chats.sql
npx wrangler d1 execute r7-waitlist --remote --file=migrations/0004_movie_wheel_added_by.sql
```

The second one adds a column, so running it twice stops with "duplicate column name": that means it was already applied.

### 2. Put the page and the API behind Cloudflare Access

1. Dashboard > **Zero Trust** (if it asks you to choose a team name and a plan, pick the free plan; the team name is part of an address like `your-team.cloudflareaccess.com`). Note the team name: **Settings > Custom pages** or the address in **Settings > General** shows it.
2. **Access controls > Applications > Add an application > Self-hosted**.
3. Name: `Movie Wheel`. Session duration: `1 month` (how long a device stays signed in).
4. Add two public hostnames (destinations), both on `r7orbit.io`:
   - path `mw-554e0676db47baa4`
   - path `api/movie-wheel`
   Each covers everything below it.
5. Policy: name `Me`, action **Allow**, include **Emails** and enter your email address.
6. Login methods: leave **One-time PIN** on (it is the default). Save the application.
7. Open the application again. On **Overview**, copy the **Application Audience (AUD) Tag**: a long string of letters and digits.

### 3. Give the site the Access settings and the OpenAI key

Dashboard > **Workers & Pages > r7-orbit-site > Settings > Variables and Secrets > Add**. Add these for **Production**:

| Name | Type | Value |
|---|---|---|
| `ACCESS_TEAM_DOMAIN` | Text | your team name, such as `your-team` |
| `ACCESS_AUD` | Text | the AUD tag from step 2 |
| `OPENAI_API_KEY` | **Secret** | your OpenAI key |
| `OPENAI_MODEL` | Text (optional) | a model name; the default is `gpt-4o-mini` |
| `MOVIE_WHEEL_PEOPLE` | Text (recommended) | who is who, as `email=Name` pairs separated by commas, such as `you@example.com=Hunter, partner@example.com=Mollie`. The page stamps each new movie with the signed-in person's name and shows it as "added by". Without it the name is made from the start of the email address |

Then trigger a deploy so the site picks them up: on the project's **Deployments** tab, the three-dot menu on the latest deployment > **Retry deployment**, or merge any change.

### 4. Use it

Open `https://r7orbit.io/mw-554e0676db47baa4/` on each device. Cloudflare asks for your email, sends a code, and then shows the page. The first device to open it uploads the starting list (`movies-seed.json`); every other device then receives the same list. A line under the list says when it last synced.

## R7, the chat

The Chat tab is a chat with **R7**, an assistant that knows your whole list: what you watched, your ratings and reviews, what is still to watch, and who added what.

- **Chat history.** Every chat is saved (in the database, so every device has them) and listed on the left, grouped by day. On a phone the list is behind the **History** button. **+ New chat** starts a fresh one; the **×** on a chat asks again before deleting it.
- **Adding movies.** Ask R7 to add movies ("add the three you just recommended") and it adds them to your to-watch list, filling in year, length and genres from the film library, skipping anything already on the list. The chat shows what was added with an **Undo** button, which still works after a reload. R7 only adds when you ask, and only to the to-watch list.
- **Follow-ups.** Under R7's latest reply are a few suggested next messages (a next step, a recommendation, a related question). Tap one to send it.
- **Formatting.** Bold titles, lists and short paragraphs; bold shows in the brass colour.
- **Added by.** A movie remembers who added it: a person (from the sign-in), or R7. The wheel's **Added by** row and the Watched tab filter by it, each row shows a small label, and the dashboard counts them. Movies from before this was tracked show as "Earlier"; set one with **Edit > Added by**.

What R7 does to the list is limited to one request, `add_movies`, which the server passes on and the page carries out; the model never touches the database.

## What to know

- **Signed out.** If a device's sign-in runs out (after the session duration), the page reloads into the email-code screen. If the sync line says "Signed out", reload the page.
- **Offline.** Changes are kept on the device and sent when it is back online.
- **Backup.** **Export list** saves the whole list to a file; **Import list** replaces the list everywhere from such a file.
- **The starting list** (`movies-seed.json`) is only used by a device that has no list and finds nothing saved online. It is a public file once deployed; once the database has your list you can delete it from `public/mw-554e0676db47baa4/` (and the `MW_SEED` line in `config.js`).
- **Chat.** Each question sends a text summary of the list, your ratings and your reviews to OpenAI. Nothing else leaves the site.
- **Trying it on your computer.** Build, create the tables locally, and run the site with Functions, with `DEV_BYPASS_ACCESS=1` in `.dev.vars` (never set it on the live site):

  ```
  npm run build
  npx wrangler d1 execute WAITLIST_DB --local -c scripts/wrangler.waitlist.toml --persist-to .wrangler/state --file=migrations/0002_movie_wheel.sql
  npx wrangler pages dev dist --d1 WAITLIST_DB=r7-waitlist --persist-to .wrangler/state
  ```

  Open `http://127.0.0.1:8788/mw-554e0676db47baa4/`.
