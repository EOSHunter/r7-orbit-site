# The newsletter

One email a week, written by **Mercury** (the newsletter agent) and sent from **Buttondown**. Decided 2026-11-10: Buttondown, weekly, Mercury ([`DECISIONS.md`](DECISIONS.md)).

It is **off** until you turn it on. While it is off, no page shows a form, `/newsletter/` is the 404 page, the footer has no Newsletter link, and the Privacy page says the newsletter is not connected.

## How it works

- **Sign-up.** A plain form posts the reader's address straight to Buttondown (`https://buttondown.com/api/emails/embed-subscribe/<username>`). The site stores nothing, loads nothing from Buttondown until the button is pressed, and runs no script for it, so it works with JavaScript off. Buttondown then shows its own page and sends a confirmation email (double opt-in). Code: `src/components/NewsletterForm.astro`, `src/lib/newsletter.ts`.
- **Where the form is, once it is on:** a small form under the footer line on every page, and the big form on `/newsletter/` (its words are **Pages > Newsletter page** in `/admin`; the form's words are **Site settings > Newsletter**). The footer's Follow column gets a **Newsletter** link first.
- **Privacy.** The Privacy page's `{if newsletter connected}` paragraphs switch on by themselves and name Buttondown.
- **Past issues** are Buttondown's archive page, `https://buttondown.com/<username>/archive/`, linked under the big form.
- **Writing an issue.** Every Sunday a scheduled Claude routine (`newsletter/ROUTINE.md`) has Mercury write the issue as a Markdown file in `newsletter/issues/<date>.md` from the week's posts (`npm run newsletter:week`), Parallax fact-checks it, and the routine pushes it to its own branch. A GitHub Action (`.github/workflows/newsletter-draft.yml`) then makes it a **draft** in Buttondown. You read it there and press Send. Mercury never sends anything and never sees the subscriber list. Guide: `.claude/skills/add-content/agents/mercury.md`; template: `newsletter/TEMPLATE.md`.

## Set it up (about 20 minutes)

### 1. Create the Buttondown newsletter

1. Sign up at buttondown.com. The **username** you pick is your newsletter's address (`buttondown.com/<username>`) and is printed in the site's form, so pick something like `r7orbit`.
2. In Buttondown's settings, set:
   - **Newsletter name:** R7 Orbit (or what you like).
   - **Description:** the line under "The words" below, with "from R7 Orbit" (Buttondown's pages are not the site, so "here" would point at Buttondown).
   - **Sender name** (Settings > Email > Author name): how the From line reads in an inbox. "Mercury at R7 Orbit" keeps the agent's credit and says where it comes from; "R7 Orbit" alone is the most recognisable.
   - **Double opt-in (confirmation email): on.** It is on by default; leave it on. The site and the Privacy page both say readers confirm first.
   - **Mailing address.** Email law in the US (CAN-SPAM) and elsewhere requires a postal address in every marketing email's footer, and Buttondown asks for one. A P.O. box or a mail service works if you'd rather not use your home address. It appears in emails only, never on the site.
3. **Welcome email** (sent after a reader confirms; on in Settings > Subscribing). Changing its words needs Buttondown's **Standard** plan; on the free plan Buttondown sends its own short welcome. The text to use once you upgrade:

   > Thanks for signing up to the R7 Orbit newsletter. Once a week you'll get one email: AI news in short, new build logs, videos and projects, and what I'm building next. Mercury, my newsletter agent, puts each issue together, and I read every one before it goes out. If it stops being useful, the unsubscribe link is at the bottom of every email.

4. **Cost** (buttondown.com/pricing, checked 2026-11-10): free for the first 100 subscribers, and the free plan includes sending from your own domain (step 2) and the hosted archive. Past 100 subscribers it is paid, priced by list size. Extras such as analytics, RSS-to-email or automations are separate monthly add-ons; this setup needs none of them. Paying for it is your call ([`CLAUDE.md`](../CLAUDE.md), "Ask the author before").

### The words

One line describes the newsletter everywhere, in the site's own nouns (its description says "news, build logs, videos and projects"):

| Where | Words |
| --- | --- |
| Site settings > Newsletter > Heading (footer form, `/newsletter/` title) | The week in *one email* |
| Site settings > Newsletter > Text (under the footer form's title) | One email a week: AI news in short, new build logs, videos and projects, and what I'm building next. |
| `/newsletter/` lead and description (Pages > Newsletter page) | The same line |
| Buttondown > Settings > General > Description | One email a week from R7 Orbit: AI news in short, new build logs, videos and projects, and what I'm building next. |
| Buttondown > Settings > General > Newsletter name | R7 Orbit |
| Share image (`brand/social/og-newsletter.png`) | The weekly newsletter / The week in *one email.* / the same line / r7orbit.io/newsletter |
| Welcome email | Step 1 above |
| Mercury's bio (`src/content/authors/mercury.json`) | "...gathers the AI news, build logs, videos and projects that went up here..." |

Change the line in all of them at once, or not at all.

### The look on Buttondown

Buttondown's archive, subscribe page and emails start in its own light theme with a blue button. What is set (2026-11-10, free plan):

- **Settings > General:** name **R7 Orbit**, description (see "The words"), **Icon** the R7 Orbit icon (alt text "R7 Orbit logo"). **Share image:** upload `brand/social/og-newsletter.png` (1200 × 630; source `brand/source/og-newsletter.html`, re-render with `node scripts/render-brand.mjs og-newsletter`). **Social links:** your YouTube and GitHub, the same as the site's footer.
- **Settings > Web > Styling:** Theme **Modern**; Accent **#c9a96a** (brass) on both the Light and the Dark tab of the picker; Background **#09090a** (obsidian) on both tabs; Body font **Figtree** (the closest to Inter in Buttondown's list, which has no Inter); Accent font **EB Garamond** (the closest to Cormorant Garamond; it is used for the name, headings, nav and buttons); **Dark mode on** (without it Buttondown keeps dark grey text, unreadable on obsidian).
- **Settings > Email:** Accent **#c9a96a**, Template **Modern**. **Email clicks** and **Email opens** off, **UTM information** off: the site promises no tracking (Privacy page).
- **Mailing address:** filled in (Settings > Email > Sender).

What the free plan cannot do, and what it costs to fix:

- **Button text is white on brass**, which is hard to read (about 2:1; the site uses dark ink on brass). Fonts are close but not the brand's. Buttondown's **Basic** plan unlocks **Custom CSS** for the web pages and the emails: paste `brand/buttondown/web.css` (Settings > Web > Add-ons > Custom CSS) and `brand/buttondown/email.css` (Settings > Email > Add-ons > Custom CSS). They set ink-on-brass buttons and load Cormorant Garamond, Inter and JetBrains Mono (checked on buttondown.com/r7orbit by injecting web.css into the page without saving it).
- **The welcome email's words** need the **Standard** plan (step 3).
- Optional, any plan: **Settings > Web > Add-ons > Redirect** sends visitors from Buttondown's subscribe page to https://r7orbit.io/newsletter/, so people sign up on the site.

### 2. Optional: send from your own domain

So issues come from an address at r7orbit.io instead of Buttondown's. In Buttondown: **Settings > Domains** (the name may differ), add the domain, and it lists DNS records (usually a few CNAME/TXT records for SPF, DKIM and DMARC). Add each one in **Cloudflare > r7orbit.io > DNS > Records**, with the proxy **off** (grey cloud) for those records. Buttondown checks them and says when they pass. This does not change the site.

### 3. Turn it on

1. Open **https://r7orbit.io/admin/ > Site settings > Newsletter**.
2. **Buttondown username:** the username from step 1 (just the name, not the address).
3. Review **Heading**, **Text**, **Button** and **Email box label**. The heading's `*asterisks*` mark the italic brass phrase on `/newsletter/`.
4. Tick **Enabled**, save, publish. The deploy that follows builds `/newsletter/` and puts the form in the footer.
5. Read **Pages > Privacy page**: the newsletter paragraphs are what readers see from now on. They name Buttondown and say there is a confirmation email.

### 4. Test it

1. On https://r7orbit.io/newsletter/, subscribe with your own address. Buttondown's page should say to check your inbox.
2. Confirm from the email. You should get the welcome email and show up in Buttondown's subscriber list.
3. With JavaScript turned off in the browser, the form still works (it is a plain form).
4. Unsubscribe from the link in an email, and check you are gone from the list.

## Every week

Automatic, from 2026-11-10:

1. **Sunday, 5pm New York time:** the Claude routine "R7 Orbit weekly newsletter" (claude.ai/code/routines) follows `newsletter/ROUTINE.md`. It lists what went up in the last 7 days, has **Mercury** write the issue and **Parallax** check every line and link against the posts, and pushes the file on a branch `claude/newsletter-<date>`. A week with nothing published gets no issue.
2. **A minute later:** the GitHub Action **Newsletter draft** makes it a **draft** in Buttondown (Emails > Drafts), with the subject and preview line from the file. It never sends. It only drafts an issue Parallax passed; one that failed stays on its branch, and the routine's report on claude.ai says what is open.
3. **You:** open the draft in Buttondown, read it, add a line for **What's next** if you have one, and press **Send** (or schedule it for Monday morning).

What it needs, once: a Buttondown API key in GitHub. In Buttondown, **Settings > API**, make a key (draft permission is enough; it never needs to send). In GitHub, **EOSHunter/r7-orbit-site > Settings > Secrets and variables > Actions > New repository secret**, name `BUTTONDOWN_API_KEY`, paste the key. The key is never in the repository or seen by the routine.

By hand, any time: ask "Mercury, write this week's newsletter" in a session (the `orbit-team` skill), or resend an issue as a draft from GitHub's **Actions > Newsletter draft > Run workflow** with its file path. To stop the automation, pause the routine on claude.ai.

Buttondown can also build an email from an RSS feed (a paid add-on); this site has no feed, and an issue Mercury writes reads better than a list of links.

## For developers

- Settings: `newsletter` in `src/data/site.json` (schema `newsletterSchema`, `src/lib/newsletter.ts`; admin fields `src/admin/settings.ts`). On only with `enabled` **and** a username (`newsletterState`). The username is public. The only Buttondown API key is the GitHub secret `BUTTONDOWN_API_KEY`, used by `scripts/newsletter-draft.mjs` (pure part `src/lib/newsletter-draft.mjs`, tested) to make drafts.
- `NEWSLETTER_PREVIEW=1 npm run build` turns it on with a sample username, to look at the form and page locally (the build stops if it is set on Cloudflare Pages). Check `/newsletter/` with `EXTRA_ROUTES="/newsletter/" npx playwright test a11y smoke budgets` after that build (from PowerShell; Git Bash rewrites the path).
- The footer's Read and Site columns come from the nav (`footerColumns`, `src/lib/site-settings.ts`); Follow is `footerLinks` (Newsletter first while it is on).
