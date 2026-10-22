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

The posters came after that, in a file of their own:

```
npx wrangler d1 execute r7-waitlist --remote --file=migrations/0005_movie_wheel_poster.sql
```

0004 and 0005 add a column each, so running one twice stops with "duplicate column name": that means it was already applied.

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
| `TMDB_TOKEN` | **Secret** (for the posters) | the **API Read Access Token** from themoviedb.org > Settings > API (the long one that starts `eyJ`) |
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

## On a phone

The page is built phone-first (it is mostly used that way).

- **Bottom tab bar** with Wheel, List, Dashboard, Reviews and R7 (the chat), where a thumb reaches. The wheel gets a screen of its own and the list gets one too; on a computer they sit side by side and the tabs are links at the top.
- **Chat takes the whole screen.** On a phone the R7 tab has no header and no card: the conversation runs edge to edge from the top of the screen to the tab bar, and the tab bar steps aside while you are typing so there is room for the keyboard.
- **Filters** are one button with the filters that are on shown as small chips you can tap away. It opens a sheet (a panel that slides up on a phone, a dialog on a computer) with the genres and "added by"; on the Watched tab the same sheet also has Show (All, Favorites, Unrated) and Sort.
- **A movie in a list** has its title across the full width, its details under it, and big buttons below: Mark watched (or Write a review) and Edit. Edit opens a sheet with everything about the movie, including moving it between lists and removing it (it asks twice), so nothing destructive sits next to a button you tap often.
- **Sizes:** every control is at least 44 px, text boxes are 16 px (so iPhones do not zoom in), and the screen respects the notch and the home bar (`viewport-fit=cover`, safe-area padding).
- **Add to Home Screen** (Safari: Share, then Add to Home Screen) puts it on your phone like an app.

## Reviews

The **Reviews** tab lists every movie you have rated or written about, newest first, with search and filters (All, Written, Favorites) and a sort (Recent, Top rated). At the top, **Waiting for your take** lists watched movies with no rating or review yet, each with a **Rate it** button.

**"What did you think?"** When you mark a movie watched and leave no rating or review, the next time you open the app it asks (a sheet with big stars and an optional review). Save, **Not now** (it asks again next time, up to three times in all), or **Don't ask about this one**. It only asks about movies you marked watched on that device, so it never quizzes one of you about a movie the other watched, and it never asks about your older watched movies.

## Posters

Posters and film details come from [TMDB](https://www.themoviedb.org) (free for personal use; their terms ask for the credit line the page shows at the bottom).

- **Existing movies.** Each device looks every movie up once, a few at a time in the background. With a release year it takes TMDB's closest title among the films released that year (or a year either side), so "Bladerunner 1982" and "Donny Darko 2001" are found; without a year (a series, say) only an exact title counts. A match gives the movie its poster and **TMDB's own name for it** ("Bladerunner" becomes "Blade Runner", "Alien 2" becomes "Aliens"); when two movies would get the same name the later one has its year added. A movie that already has a poster keeps it, and a movie that cannot be matched keeps its name and has no poster until you choose one with **Edit > Poster > Find a poster**. The poster and name are saved with the movie, so every device gets them.
- **New movies.** Typing a title in the add box suggests library matches first and then matches from TMDB (marked "TMDB"), which cover new releases. Picking one fills in the length, year, genres and poster.
- **Where it shows.** On the List tab each movie is a card with a gap between cards. With a poster, the poster (120 px wide) sits at the card's left edge, as tall as the card; beside it are the title, the stars (watched movies only, not tappable), length, year and up to two genres ("+2" for the rest). Two quiet grey icon buttons sit at the bottom right: a check (mark watched, on the To watch tab) and a pencil (edit, which holds the rating and review). The list shows no review text; the Reviews tab has it, with a pencil to edit a review. The "Tonight you watch" pop-up has a larger poster. A movie with no poster has the same details without the picture.
- **Posters grid.** The two buttons beside the To watch / Watched tabs switch the list between those cards and a grid of posters (two across on a phone), each with its name, year, length and rating under it; a movie with no poster is a tile with its name on it. Tapping a poster opens a sheet with the movie, its stars and the buttons (Mark watched or Write a review, and Edit). The choice is remembered on that device.
- **The token stays on the server.** The page asks `/api/movie-wheel/tmdb` (behind the same sign-in), which holds the token, searches TMDB and serves the poster pictures itself, so the page never contacts anyone but its own site. Without `TMDB_TOKEN` the page works as before, with no posters.
- **If a poster is wrong,** open the movie's **Edit**, choose **Choose a different poster** (or **Remove poster**), and Save.

## What to know

- **Signed out.** If a device's sign-in runs out (after the session duration), the page reloads into the email-code screen. If the sync line says "Signed out", reload the page.
- **Offline.** Changes are kept on the device and sent when it is back online.
- **Backup.** **Export list** saves the whole list to a file; **Import list** replaces the list everywhere from such a file.
- **The starting list** (`movies-seed.json`) is only used by a device that has no list and finds nothing saved online. It is a public file once deployed; once the database has your list you can delete it from `public/mw-554e0676db47baa4/` (and the `MW_SEED` line in `config.js`).
- **TMDB.** Searching sends the title you type (and the year) to TMDB, from the site's server, not from your phone.
- **Chat.** Each question sends a text summary of the list, your ratings and your reviews to OpenAI. Nothing else leaves the site.
- **Trying it on your computer.** Build, create the tables locally, and run the site with Functions, with `DEV_BYPASS_ACCESS=1` in `.dev.vars` (never set it on the live site):

  ```
  npm run build
  npx wrangler d1 execute WAITLIST_DB --local -c scripts/wrangler.waitlist.toml --persist-to .wrangler/state --file=migrations/0002_movie_wheel.sql
  npx wrangler pages dev dist --d1 WAITLIST_DB=r7-waitlist --persist-to .wrangler/state
  ```

  Open `http://127.0.0.1:8788/mw-554e0676db47baa4/`.
