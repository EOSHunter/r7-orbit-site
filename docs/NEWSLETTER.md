# The newsletter

One email a week, written by **Mercury** (the newsletter agent) and sent from **Buttondown**. Decided 2026-11-10: Buttondown, weekly, Mercury ([`DECISIONS.md`](DECISIONS.md)).

It is **off** until you turn it on. While it is off, no page shows a form, `/newsletter/` is the 404 page, the footer has no Newsletter link, and the Privacy page says the newsletter is not connected.

## How it works

- **Sign-up.** A plain form posts the reader's address straight to Buttondown (`https://buttondown.com/api/emails/embed-subscribe/<username>`). The site stores nothing, loads nothing from Buttondown until the button is pressed, and runs no script for it, so it works with JavaScript off. Buttondown then shows its own page and sends a confirmation email (double opt-in). Code: `src/components/NewsletterForm.astro`, `src/lib/newsletter.ts`.
- **Where the form is, once it is on:** a small form under the footer line on every page, and the big form on `/newsletter/` (its words are **Pages > Newsletter page** in `/admin`; the form's words are **Site settings > Newsletter**). The footer's Follow column gets a **Newsletter** link first.
- **Privacy.** The Privacy page's `{if newsletter connected}` paragraphs switch on by themselves and name Buttondown.
- **Past issues** are Buttondown's archive page, `https://buttondown.com/<username>/archive/`, linked under the big form.
- **Writing an issue.** Mercury writes each issue as a Markdown file in `newsletter/issues/<send date>.md` from the week's posts (`npm run newsletter:week`), Parallax fact-checks it, you read it and send it from Buttondown. Mercury never sends anything and never sees the subscriber list. Guide: `.claude/skills/add-content/agents/mercury.md`; template: `newsletter/TEMPLATE.md`.

## Set it up (about 20 minutes)

### 1. Create the Buttondown newsletter

1. Sign up at buttondown.com. The **username** you pick is your newsletter's address (`buttondown.com/<username>`) and is printed in the site's form, so pick something like `r7orbit`.
2. In Buttondown's settings, set:
   - **Newsletter name:** R7 Orbit (or what you like).
   - **Description:** the line under "The words" below, with "from R7 Orbit" (Buttondown's pages are not the site, so "here" would point at Buttondown).
   - **Sender name** (Settings > Email > Author name): how the From line reads in an inbox. "Mercury at R7 Orbit" keeps the agent's credit and says where it comes from; "R7 Orbit" alone is the most recognisable.
   - **Double opt-in (confirmation email): on.** It is on by default; leave it on. The site and the Privacy page both say readers confirm first.
   - **Mailing address.** Email law in the US (CAN-SPAM) and elsewhere requires a postal address in every marketing email's footer, and Buttondown asks for one. A P.O. box or a mail service works if you'd rather not use your home address. It appears in emails only, never on the site.
3. **Welcome email** (sent after a reader confirms; Settings > Subscribing). Paste this, or change it first:

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

Buttondown's archive, subscribe page and emails start in its own light theme with a blue button. The R7 Orbit versions:

- **Settings > General > Branding:** **Icon** `brand/icon-512.png` (alt text "R7 Orbit logo"); **Share image** `brand/social/og-newsletter.png` (1200 × 630; source `brand/source/og-newsletter.html`, re-render with `node scripts/render-brand.mjs og-newsletter`). **Social links:** your YouTube and GitHub, the same as the site's footer.
- **Settings > Web > Styling:** Theme **Modern**, Accent colour **#c9a96a**, Background **#09090a**, Dark mode **off** (obsidian is the only theme). Then **Add-ons > Custom CSS: on**, and paste all of `brand/buttondown/web.css`. It sets Buttondown's colour and font variables to the site's tokens, loads Cormorant Garamond, Inter and JetBrains Mono, and makes every button brass with ink text. (Previewed on buttondown.com/r7orbit before it was written down: obsidian page, brass button, Cormorant name.)
- **Settings > Email:** Accent colour **#c9a96a**, Template **Modern**, **Add-ons > Custom CSS: on**, and paste all of `brand/buttondown/email.css`. Email apps are stricter than browsers: send yourself a test before the first issue and look at it in Gmail, on a phone and in Outlook.
- **Settings > Email > Tracking:** leave **Email clicks** and **Email opens** off, and turn **UTM information** off. The site promises no tracking (Privacy page); these would add it to the emails.
- **Settings > Web > Add-ons > Redirect** (optional): send visitors from Buttondown's subscribe page to https://r7orbit.io/newsletter/, so people sign up on the site. Leave the archive where it is (the site links to it).

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

1. Ask an agent: "Mercury, write this week's newsletter." (It follows `agents/mercury.md`: lists the week's posts with `npm run newsletter:week`, writes `newsletter/issues/<date>.md`, has Parallax check it.) Give it a line or two for **What's next** if you have something; otherwise that section is left out.
2. Read the file. Change anything.
3. In Buttondown, start a new email: the `subject` from the file's front matter as the subject, and everything below the front matter as the body (Buttondown takes Markdown).
4. Send it, or schedule it. Set `status: sent YYYY-MM-DD` in the file so the next issue starts the day after.

Buttondown can also build an email from an RSS feed automatically; this site has no feed, and an issue Mercury writes reads better than a list of links.

## For developers

- Settings: `newsletter` in `src/data/site.json` (schema `newsletterSchema`, `src/lib/newsletter.ts`; admin fields `src/admin/settings.ts`). On only with `enabled` **and** a username (`newsletterState`). The username is public; no Buttondown API key is used or stored anywhere.
- `NEWSLETTER_PREVIEW=1 npm run build` turns it on with a sample username, to look at the form and page locally (the build stops if it is set on Cloudflare Pages). Check `/newsletter/` with `EXTRA_ROUTES="/newsletter/" npx playwright test a11y smoke budgets` after that build (from PowerShell; Git Bash rewrites the path).
- The footer's Read and Site columns come from the nav (`footerColumns`, `src/lib/site-settings.ts`); Follow is `footerLinks` (Newsletter first while it is on).
