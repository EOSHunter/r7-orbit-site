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
   - **Description:** one line on what it is (the one on `/newsletter/` works: "Everything that went up here in a week, in one short email.").
   - **Sender name:** how the From line reads, for example "R7 Orbit" or "Hunter Newton".
   - **Double opt-in (confirmation email): on.** It is on by default; leave it on. The site and the Privacy page both say readers confirm first.
   - **Mailing address.** Email law in the US (CAN-SPAM) and elsewhere requires a postal address in every marketing email's footer, and Buttondown asks for one. A P.O. box or a mail service works if you'd rather not use your home address. It appears in emails only, never on the site.
3. **Welcome email** (sent after a reader confirms). A draft for you to change; nothing here is sent until you paste it:

   > Thanks for signing up. Once a week you'll get one email with everything that went up on R7 Orbit: the news in short, new posts and videos, and what I'm working on next. Mercury, my newsletter agent, puts each issue together and I read every one before it goes out. If it stops being useful, the unsubscribe link is at the bottom of every email.

4. Check Buttondown's pricing page for the plan you need. At the time of writing there is a free plan for a small list; sending from your own domain (below) and larger lists are paid. Adding a paid service is your call ([`CLAUDE.md`](../CLAUDE.md), "Ask the author before").

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
