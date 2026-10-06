# Publishing a post

For the author. Adding pictures is section 6 and editing the About page (and what every block does: [`SECTIONS.md`](SECTIONS.md)) is section 7; the words of the Privacy, 404 and Search pages are section 8, the site-wide settings (name, your details, links, navigation, footer) are section 9, writing a post as blocks instead of one Markdown text is section 10, the home page and the listing pages (archives, Latest, Games, Tags) are section 11, and asking a coding agent to draft a post for you is section 12. Plain steps, no coding needed. Everything happens at <https://r7orbit.io/admin/>. For the one-time setup (GitHub login, Cloudflare), see [`DEPLOY_CLOUDFLARE.md`](DEPLOY_CLOUDFLARE.md).

## 1. Write and publish a post

1. Open <https://r7orbit.io/admin/> and click **Login with GitHub**. A small window opens; approve it the first time. Only people with write access to the repository can sign in. If nothing happens, allow pop-ups for the site and try again.
2. In the left list pick what you are writing (**Blog posts**, **News**, **Vlogs**, **Projects** or **Repos**) and click **New …**.
3. Fill in the form. The required fields are marked. These are the ones that most often go wrong:
   - **Title**: up to 90 characters. **Summary**: one or two sentences, up to 180 characters.
   - **Browser title** (optional): a shorter title for browser tabs and search results, up to 49 characters. Use it when the title would push the page title past 60 characters; the page itself keeps the full title.
   - **Author**: who the post is credited to. It starts as **Hunter Newton**. If an AI agent wrote the piece, pick **R7 · Orbit AI Agent** instead: it then shows an "AI-written" label under the title and the agent's note at the end. Never credit an AI-written piece to Hunter. Authors are the files in the **Authors** list; a new one appears in this menu after the site is next deployed.
   - **Date**: the day the post goes live (see step 6).
   - **Tags**: lowercase words joined with hyphens (`ai-agents`), at most six.
4. **Featured image and alt text** (blog posts). Choose your own wide image (16:9, at least 1600px across), then fill in **Featured image alt text**: a plain sentence saying what the picture shows. The build stops without alt text. The same applies to a **Cover image** and its **Cover image alt text**. Use no stock photos. Every step for pictures is in [section 6, Adding images](#6-adding-images).
5. **Write the body.** Type normally. To add a picture or an article component (callout, quote, image gallery, video, two columns and so on), click **+** in the body and pick it from the list (**Image** for a picture). Blog posts show a live preview beside the form. [`ARTICLE_COMPONENTS.md`](ARTICLE_COMPONENTS.md) describes each component. Or build the body from blocks under **Sections** instead, as on the About page: [section 10](#10-write-a-post-with-sections). Use one or the other, not both.
6. **Draft and scheduled.**
   - **Draft** on: the post is kept out of the live site, archives, search and sitemap, even after it is published to GitHub. Turn it off when you want the post public.
   - **Date in the future**: the post is **scheduled**. It stays hidden until that day (counted in UTC), then goes live at the next daily rebuild (section 2).
   - Draft off and a date of today or earlier: the post goes live as soon as the site rebuilds.
7. **Save.** This does **not** publish. It creates a pull request on GitHub and Cloudflare builds a private **preview** of the site with your post in it. GitHub also runs a check that builds the site and reads your post against the rules; a red check means something in the post is wrong (section 5).
8. Optional: open the **Workflow** tab and move the post from **Draft** to **In review** to **Ready**. This only changes a label.
9. When you are happy, open the post and use **Publish** > **Publish now**. This merges it into `main`.

## 2. What happens next

1. The merge is one new commit on the `main` branch on GitHub.
2. Cloudflare Pages sees that commit and builds the site (`npm run build`).
3. If the build succeeds, the new version replaces the old one. Allow **about one to three minutes** from clicking Publish. Reload the post's page; if it is not there, wait a little and check the build (section 5).
4. If the build fails, **nothing changes on the live site**: the previous version keeps running.

### Scheduled posts

A post with a future date is left out of the build, and nothing rebuilds the site by itself on the day. So a GitHub workflow, `.github/workflows/scheduled-deploy.yml` ("Scheduled deploy"), runs every day at 00:05 UTC and asks Cloudflare Pages for a fresh build through a deploy hook. The first build on or after the post's date includes it, so a post dated 2 November appears shortly after 00:05 UTC on 2 November (that is the evening of 1 November in US time zones).

- To publish sooner, change the date to today (or earlier) and publish again, or run the workflow by hand: GitHub > **Actions** > **Scheduled deploy** > **Run workflow**.
- If a scheduled post did not appear: check that the latest "Scheduled deploy" run is green and that Cloudflare shows a new deployment from it. If the workflow is greyed out ("disabled"), GitHub switches schedules off after 60 days without repository activity; click **Enable workflow**. Other causes are in `DEPLOY_CLOUDFLARE.md`, "Scheduled posts".

## 3. After any admin or header change: manual save-and-publish check

The automated tests run the editor against a pretend GitHub, so they cannot tell you that the real login, save and publish still work. After any change to `src/admin/`, `public/_headers` (its Content-Security-Policy decides what the editor may contact) or the site header, do this once on the live site, with a throwaway post:

1. Open <https://r7orbit.io/admin/>, log in with GitHub, and confirm the editor loads with no blank screen. (Open the browser console: no red errors, and none mentioning "Content Security Policy".)
2. Create a **News** item: title `Publishing test`, a one-line summary, today's date, a source URL and name, **Draft on**.
3. Click **Save**. Confirm that a pull request appears on GitHub, the CI check goes green, and the Cloudflare preview link opens.
4. Add an image (a blog post's featured image or a cover) and its alt text, save again, and confirm the image shows in the preview.
5. Click **Publish** > **Publish now**. Confirm the pull request is merged and a new Cloudflare deployment starts and finishes.
6. Open <https://r7orbit.io/news/> and the home page: the test item must **not** appear (it is a draft), the header and menu still work, and nothing looks broken.
7. Clean up: in the editor delete the test entry (or on GitHub delete `src/content/news/publishing-test.md`) and let the site rebuild.

If any step fails, roll back (section 4) and fix it before moving on.

## 4. Roll back

### A bad deploy: Cloudflare Pages (fastest, about a minute)

1. Sign in at <https://dash.cloudflare.com> and open **Workers & Pages** > `r7-orbit-site` > **Deployments**.
2. Find the last deployment that was good (an earlier row with the status *Success*).
3. Click the **...** menu on that row and choose **Rollback to this deployment**, then confirm.

The live site now serves that older build straight away. This does **not** change GitHub: `main` still has the bad commit, and the next build will bring the problem back. Revert it on GitHub too (next part).

### A bad post: revert the commit on GitHub

1. Open the repository on GitHub > **Commits** on `main`, or the merged pull request for the post (**Pull requests** > **Closed**).
2. On the merged pull request click **Revert**. GitHub opens a new pull request that undoes it. Click **Create pull request**, wait for the checks, then **Merge pull request**. (From a commit page you can instead copy the commit and use the same button on its pull request.)
3. Cloudflare rebuilds from `main` and the post disappears. Nothing is deleted: the history keeps both commits, and you can revert the revert to bring the post back.

For a post you only want to hide, it is simpler to open it in the editor, turn **Draft** on and publish again.

## 5. The Cloudflare build failed

The live site keeps running the last good version, so there is no emergency. Find out why:

1. Cloudflare dashboard > **Workers & Pages** > `r7-orbit-site` > **Deployments**. A failed build shows *Failed*.
2. Click it, then open **View build log** (or scroll the log on that page). Scroll to the first red line or the line starting with `[ERROR]` just before the build stops. The same message appears in the failed **GitHub check** on the post's pull request, which is the better place to catch it before publishing.
3. Match the message against the usual causes:

   | The log says (roughly) | Cause and fix |
   | --- | --- |
   | `Invalid frontmatter` / `Does not match schema` / `Unrecognized key` | A field is missing, too long or not allowed. Title is limited to 90 characters, summary to 180, tags to six lowercase hyphenated words. News needs a source URL and source name. Fix it in the editor and save again |
   | `has author "x", but there is no author with that slug` | The **Author** is not one of the authors. Pick one from the menu again (or add the author under **Authors** first) |
   | `use a date like 2026-10-03` / `Invalid date` | The date is empty or was typed in the wrong form. Pick it with the date picker, or write `2026-10-03` |
   | `coverAlt is required when cover is set` / `featuredImageAlt` | An image has no alt text. Fill in the alt text field next to the image (use a short description; leave it empty only for a purely decorative cover) |
   | `Could not find image` / `Cannot find …` an image path | The image file was deleted or the path was typed by hand. Choose the image again in the editor |
   | `the image "…" has no alt text` | A picture in the post has no description. Open the post, click the picture's block, fill in **Alt text** (or tick **Decoration only**), save. [Section 6](#6-adding-images) says how to write it |
   | `HEIC is the iPhone's default format` / `is not an image format this site accepts` / `still … MB after the build resized it` | A picture is in a format browsers cannot show, or is too heavy. Export it as JPG, upload that, remove the other ([section 6](#when-the-build-complains)) |
   | `Figure: "/src/assets/…" is not in src/assets/` | The picture a block points at was deleted. Click the block and choose the image again |
   | `Expected a closing tag` / `Could not parse expression` in a blog post | A broken article component or an unclosed `<` or `{` in the text. Open the post in the editor, check the component, or see [`ARTICLE_COMPONENTS.md`](ARTICLE_COMPONENTS.md) |
   | `Cannot find package` / network errors at install | Rare and usually temporary. Open the failed deployment and choose **Retry deployment** |

4. Fix the post in the editor, save, and publish again, or revert the post's commit (section 4) and try again later. If the log mentions something that is not in this table, copy the first error and ask for help; do not delete files to make the error go away.


## 6. Adding images

You do this in the editor, at <https://r7orbit.io/admin/>. You never type a folder name or a path: the editor puts each picture in the right place and names the file for you. Why it works this way, and what the build does to a picture, is in [`IMAGES.md`](IMAGES.md).

**Before you start**

1. **Format.** JPG for photos, PNG for a crisp screenshot or a drawing, WebP or AVIF if you already have one, SVG for a logo or line drawing. An iPhone photo saved as **HEIC** will not work: on the phone choose *Settings > Camera > Formats > Most Compatible*, or export it as JPG from the Photos app.
2. **Size.** You do **not** need to shrink anything first. A photo straight from a phone is fine (the limit is 10 MB). When the site is built, every picture is resized to at most 2000 pixels across and compressed, and the camera's location is removed. Anything wider than about 2000px is wasted, so a picture 1600 to 2000px wide is ideal.
3. **Shape.** Wide, 16:9, for a cover, poster or featured image (at least 1280px across; 1600px for a featured image). Pictures inside a post can be any shape.
4. **Name.** Don't worry about spaces or capitals: `My Photo 1.PNG` is stored as `my-photo-1.png`.
5. **Yours only.** Your own pictures, not stock photos.

**How to write good alt text**

Alt text is what a screen reader says in place of the picture, and what shows if it fails to load. The editor will not save a post whose picture has none.

- Write one plain sentence about what the picture shows and why it is there: "Vesper Drift at stage 12: a black hole with a glowing ring and the game's menu". Skip "image of" and "screenshot of" unless that is the point.
- If the picture shows text that matters, say what it says.
- If it is purely decoration (a flourish, a background texture), tick **Decoration only** instead of leaving it empty.
- The **caption** is separate: it is shown under the picture for everyone. A caption does not replace alt text.

### Case 1: the featured image of a blog post

1. Open (or create) the blog post.
2. Find **Featured image**, click **Choose an image**, then **Upload** and pick the file. Click **Choose selected**.
3. Fill in **Featured image alt text** right below it.
4. Optional: **Cover image** is a separate, smaller picture used on cards and when the post is shared. If you leave it empty the featured image is used for sharing.
5. Save. The preview on the right shows the picture behind the headline.

### Case 2: a picture inside a post

1. Click in the **Body** where the picture should go, then click **+** (Add Component) and pick **Image**.
2. In the box that appears, click **Choose an image**, **Upload**, pick the file, **Choose selected**.
3. Fill in **Alt text**. Add a **Caption** if you want one. Tick **Decoration only** only for a picture that is just decoration.
4. Blog posts also have **Placement** (center, left, right, full width) and **Size** (large, medium, small). Left and right put the text beside the picture on a wide screen. News, vlogs, projects and repos have no placement or size: the picture is one column wide.
5. For two or three pictures side by side in a blog post, pick **Image gallery** instead and fill in each picture.
6. Check the preview (blog posts). A red **No alt text** band under a picture means it still needs a description. Save.

### Case 3: a vlog poster or thumbnail

1. Open the vlog. Find **Poster image**, click **Choose an image**, **Upload**, pick the file, **Choose selected**. This is the still shown before the video plays.
2. If you leave it empty, the **Cover image** is used, and then the placeholder. Use 16:9, at least 1280px across.
3. The **Cover image alt text** field is where you describe the cover (the cover is also what shows on cards and when the post is shared).
4. Save.

### Case 4: a picture on a page

The About page is made of blocks ([section 7](#7-editing-the-about-page)), and its pictures work like the ones above. So are the home page's rows and the blocks above and below a listing ([section 11](#11-editing-the-home-page-and-listing-pages)): their pictures go to the same folder for pages.

1. In the editor open **Pages**, then **About page**.
2. Add an **Image** or **Portrait and text** block, or open an existing one.
3. Click **Choose an image**, **Upload**, pick the file and **Choose selected**. Uploads go to their own folder for pages; you never type it.
4. Fill in **Alt text**, or turn on **Decorative image** if the picture is only ornament. The page will not build without one or the other.
5. Save. The preview on the right shows the picture.

The small author photo that search engines read (the "Person" data) is a different thing: it is `author.photo` in `src/data/site.json` (today `public/media/about/hunter-newton.jpg`) and is changed by whoever maintains the site. Pictures **inside** the text of a blog post, news item, vlog, project or repo use Case 2.

### When the build complains

You will see the message in the editor when you press Save, or on the red check on the post's pull request ([section 5](#5-the-cloudflare-build-failed)). The messages name the post and the picture:

| It says | What to do |
| --- | --- |
| `Not saved. … has no alt text` | Click the picture's block, fill in **Alt text** (or tick **Decoration only**), Save again |
| `HEIC is the iPhone's default format` | Export the photo as JPG (see Before you start), remove the HEIC from the picture box, upload the JPG |
| `is not an image format this site accepts` | Use JPG, PNG, WebP, AVIF or SVG |
| `… is over the 10 MB limit` | Export a smaller copy, about 2000 pixels wide, and upload that |
| `still … MB after the build resized it` | The picture is too heavy even after shrinking, usually a big PNG. Export it as a JPG or WebP, upload that, and delete this one |
| `the file name has spaces, capitals or odd characters` | Only for a file added outside the editor. Rename it to lowercase and hyphens |
| `… is not in src/assets/` | The picture was deleted. Choose it again in the block |

To remove a picture you uploaded by mistake before saving: in the picture picker, select it and press **Delete**. A picture you no longer need after saving: delete its block in the body (or clear the field). The file stays in the repository, which is harmless.

## 7. Editing the About page

The About page is not a post. It is a list of **blocks** (a heading, some text, a picture, a quote and so on) that you add, re-order and remove. It lives under **Pages** in the editor and is saved, previewed and published like a post (sections 1 and 2). Its words are yours; nothing here writes them for you.

1. Open <https://r7orbit.io/admin/>, sign in, and in the left list pick **Pages**, then **About page**.
2. The top three boxes are the big heading of the page (**Page heading**), an optional **Browser title**, and the **Description for search results** (one or two sentences; it is not shown on the page).
3. Under **Page sections** every block is one line. Click the small arrow on its left to open it and edit it; click it again to fold it. The preview on the right redraws as you type, using the site's own styles.
4. **To add a block:** click **Add section** and choose its kind:
   - **Heading**: a title for the part below it. Pick *Section heading* or the smaller *Sub-heading*. Put one phrase in single asterisks (`How I *work*`) to set it in the italic brass accent, like the page heading and post titles. Two asterisks (`**like this**`) in text only make it bold, as in posts.
   - **Text**: paragraphs, with **bold**, links and lists. Leave a blank line between paragraphs.
   - **Image**: a picture on its own, with an optional caption. **Width**: *Narrow* sits in line with the text, *Wide* is the width of the page, *Full* goes edge to edge of the window.
   - **Portrait and text**: a picture beside some text (above it on a phone). Choose **Picture on the** left or right. The blocks you put after it stay beside the picture, until a **Divider**, a *Wide* or *Full* image, or another Portrait. A **Heading** placed directly above it also sits beside the picture.
   - **Quote**, **Callout** (a note, a tip or a warning), **Links list** (one row per link), **Button** (a solid button that links somewhere) and **Divider** (a line or three dots between parts).
   - **More blocks.** **Lead paragraph** (the larger opening line), **Pull quote** (a line from the text, set large), **Code block** (pick the language; it gets a Copy button), **Image row** (two or three pictures side by side), **Lightbox gallery** (thumbnails that open full size), **Video embed** (paste the 11 characters after `v=`, not the whole link; it loads only when a reader presses play), **Playable game** (the game's address; embedded games must be on the allowed list, see below), **Two columns** (two Markdown boxes side by side), **Spacer** (empty space), **Table of contents** (links to the page's headings), **GitHub stats row** (a repository's stars and forks, fetched when the site is built), **Latest posts** (the newest posts, filtered by kind, tag or author) and **Author box**. Every block, every field and an example of each are in [`SECTIONS.md`](SECTIONS.md).
5. **To re-order:** drag a block by the small handle (the two short lines) at the top of its box and drop it where it should go. Fold the block first if it is long: a tall block is hard to drop. The preview shows the new order straight away. Dragging needs a mouse or a finger; the editor has no keyboard way to move a block, so if you cannot drag, remove the block and add it again where you want it.
6. **To remove a block:** click the cross at the top right of its box. Nothing is final until you publish, and the pull request keeps the old version.
7. **To add an image:** add an **Image** (or **Portrait and text**) block, click **Choose an image**, then upload a file from your computer (or pick one already uploaded) and click **Choose selected**. Use your own picture, not stock. Then fill in **Alt text**: one plain sentence saying what the picture shows, for someone who cannot see it. The only exception is a picture that is purely decoration: turn on **Decorative image** and leave the alt text empty. If neither is done, the preview shows a red "Fix before saving" box and the build will stop.
8. **Addresses** in a Button, Links list or Game start with `https://` (another site) or, for a button or link, a single `/` (a page on this site, like `/latest/`). The editor refuses anything else and says why. A **Playable game** that is embedded must be on the list of allowed game hosts (`frame-src` in `public/_headers`, the same list projects use): if it is not, the pull request's build stops and says so. Ask whoever maintains the site to add the host, or choose **Link** (a button that opens the game in a new tab), which needs no permission. **Latest posts** and **Author box** check that the tag and author exist: the build stops with the list of the real ones if not.
9. **What the preview is not.** It is the page drawn with the site's real styles, so colours, type and spacing are right. It is not the real page: the header and footer are missing, the text is read by a simpler Markdown reader (headings, paragraphs, lists, bold, italic, code and links only), and the preview pane is narrower than a screen, so a portrait that sits beside the text on a computer may sit above it here. Blocks that need the built site (**Latest posts**, **GitHub stats row**, the game, the video, code colours, the gallery's full-size window) show a stand-in, and a line under each says so. Open the Cloudflare preview link on the pull request (section 1, step 7) to see the real thing.
10. **Save**, then **Publish** exactly as for a post (section 1, steps 7 to 9). The check on the pull request builds the site. If it is red, open it and read the first error: it names the block ("Block 3 (Image)" is the third block, counting from 1; `sections.2` counts from 0) and what is wrong, usually missing alt text or an address that does not start with `https://` or `/`. The preview shows the same messages above the page while you type.

Good to know: the details search engines read about you (name and bio, the "Person" data) come from **Site settings** (section 9), not from this page. If you change your bio here and want search engines to see the change too, change it there as well.

## 8. Editing privacy and 404

The words of **Privacy**, the **Page not found (404)** page and **Search** are under **Pages** too, next to About. They work like the About page (section 7: open, edit blocks, preview, save, publish), with one difference: the page keeps its own frame, and only the words are yours to change. The search box, the 404 orbit and its two buttons, and the small label above each heading ("Privacy", "Error 404", "Search") stay as they are.

1. Open **Pages**, then the page. **Page heading** is the big heading (one phrase in `*asterisks*` is the italic brass accent); **Browser title** is the short name in the tab ("Privacy", "Page not found", "Search"); **Description for search results** is not shown on the page.
2. **Where the blocks go** is written above the blocks of each page, and is fixed:
   - **Privacy:** a **Lead paragraph** at the top sits under the heading, then the policy as one column of headings and text. The **last Text block** is set as small print: it is the "Last updated" line, so change its date when you change the policy.
   - **Page not found (404):** a **Lead paragraph** under the heading. Anything you add after it appears below it, above the search box.
   - **Search:** the text is shown only to readers whose browser has JavaScript turned off (search needs it).
3. **Settings in the text.** Write `{site.name}` (with the braces) to print that value from the site settings. Change the value in the site settings (section 9), so it is right everywhere at once. The preview shows the real values. A misspelt one (`{site.nme}`) shows "Fix before saving" in the preview and stops the build.
4. **Legacy newsletter lines on Privacy.** There is no newsletter. Two Text blocks on the Privacy page still start with `{if newsletter connected}` or `{if newsletter not connected}`; these lines are legacy (only the "not connected" one is shown), and you may rewrite the privacy page.
5. **Save** and **Publish** as for a post. The check on the pull request compares these pages with a saved copy of their words, so the first time you change a word it goes red with a line-by-line difference: that is expected. Ask whoever maintains the site to update the copy in `tests/fixtures/pages/` in the same pull request (it is one file per page).

The preview of these pages draws the blocks one after another, as on About; it does not draw the form beside the text or the 404 orbit. Open the Cloudflare preview link on the pull request to see the real page.

## 9. Site settings

The words and links that appear on every page live in one place: in the editor's left list, **Site settings**, then **Site settings**. It is saved, checked and published like a post (section 1, steps 7 to 9): a pull request, a green check, then **Publish**. The file it changes is `src/data/site.json`.

What you can change there:

- **Site name**, **Tagline** and **Description**: the name in the header and footer and at the end of every browser title, the line above the home headline, and the sentence about the site (home page, footer, search results). A longer name leaves less room for post titles.
- **Default share image** and its **alt text**: the picture shown when a page without its own picture is shared (1200 × 630 pixels).
- **Author**: your name, bio and photo. Your posts, your author page and the About page's search-engine data use these.
- **Profile links**: GitHub and YouTube. Each is a full address starting with `https://`, or empty. An empty one leaves its icon and link out everywhere.
- **Header navigation**: the links across the top, in order. Each has a **Label** (the word shown) and an **Address** (`/blog/` for a page of this site, or `https://…`). Drag to re-order. **You can rename a label freely**: the site finds the current section by its address, so the highlight and the search page keep working. Change an address only if you mean to send the link somewhere else. Turn on **Also in the footer** (and pick an **Icon**) to list the link in the footer too, before the footer links.
- **Footer**: the **Footer links** (each with a label, an icon, and either an **Address** or a **Profile link**, not both: a profile link stays hidden while that profile is empty) and the **Note** after the year ("Made with R7 Orbit").

What is not there on purpose: the site's address (`https://r7orbit.io`, which every link and search result is built on), and where the editor itself saves and signs in. Those are changed in code by whoever maintains the site, so an edit here cannot break your sign-in or move the site.

If the check on the pull request is red, the first error names the setting: for example `nav.2 ("Blog"): /blgo/ is not a page or file of this site` (the third header link, counting from 0, goes to a page that does not exist), `links.github: use a full address that starts with https://`, or `two nav links go to /blog/`. Fix it in the same entry and save again.

After a change to the header links, do the check in section 3 (step 6 at least): open the home page at phone and computer width, open the menu, and click a few links.

## 10. Write a post with sections

Any post (a blog post, news item, vlog, project or repo) can be written as **sections**: a list of blocks you add, re-order and remove, the same blocks as the About page (section 7), instead of the one Markdown text in **Body**. Use sections when the layout matters (a picture beside text, a gallery, a button, two columns, a video in the middle); keep the Body for a long essay that is mostly text. Nothing changes for posts you already wrote: a post with a Body stays as it is.

1. Open or create the post as in section 1 and fill in the fields as usual (title, summary, date, tags, author, the source of a news item, the video of a vlog, the status of a project, the repository of a repo). Those still come from the form, whichever way the body is written.
2. **Leave Body empty.** A post uses sections **or** the Body, **never both**: the editor refuses to save a post that has both ("Not saved. This post has both sections and a Body…"), and the build would stop on one, naming the file. To switch an existing post to sections, cut its text out of Body and rebuild it as blocks; nothing converts it for you.
3. Under **Sections**, click **Add section** and pick a block, exactly as in section 7, steps 3 to 8. Pictures you upload in blocks go to the post's own folder (`public/media/<kind>/`), and each needs alt text unless it is marked **Decorative image**.
4. **Headings.** Use **Heading** blocks for the parts of the post (*Section heading* for the main ones). On a blog post with three or more section headings the contents list ("On this page") appears beside the text, built from them and from any `##` heading you type inside a Text block. A `##` inside a Text block must be on a line of its own with a blank line before and after it: the build stops on one it cannot list.
5. **Reading time** is counted from the words in the blocks (code, alt text and pull quotes are not counted), unless you type your own in **Reading time**.
6. **A vlog's transcript.** With sections there is no Body to hold it, so put it in **Transcript (for a vlog written as sections)**. It is shown folded under the notes, as before. Leave **Transcript below** off: that switch is for a Body that ends with a "Transcript" heading.
7. **A repo** with **README source** set to *Local* shows your sections instead of the README from GitHub, as it does with a Body.
8. **The preview** on the right draws the blocks in the post's column with the site's styles, and lists above the page what the build would stop on (a picture without alt text, a post with both sections and a Body). Blog posts get the full page preview; news, vlogs, projects and repos get the head of the page and the body, and a note at the top says what is not drawn (the facts column, a project's play section, gallery and changelog, a repo's README). The limits of the block preview in section 7, step 9, apply here too.
9. **Save** and **Publish** as in section 1. If the check on the pull request is red, its first error names the post's file and the block ("blog/my-post.md, block 3 (Image)").

## 12. Use the add-content skill

Instead of the editor you can ask a coding agent (Claude Code, in this repository) to draft a post: "add a blog post about …", "draft a news item for this link", "add my new game". The agent follows the project skill `.claude/skills/add-content/SKILL.md`. It starts from a template for the kind (`templates/`), and:

- **Asks first** for what it needs: the kind, title, date, whether it is a draft, the author, summary, tags, pictures and their alt text, sources, and for a vlog the YouTube id, for a game the play address and controls. It does not invent facts, quotes, numbers, links or sources.
- **Credits AI-written pieces to R7** (`author: r7`), never to you. The "AI-written" label and R7's note then appear on their own; the agent never writes that note.
- **Saves the post as a draft** unless you say it goes live, writes the file in `src/content/<kind>/`, copies any picture you give it into `public/media/<kind>/`, and for an embedded game adds its host to `frame-src` in `public/_headers`.
- **Checks its work**: type check, lint, build, the tests, that the page exists and shows in the archive, the sitemap and search, that a draft or scheduled post does not leak, and screenshots at phone and computer width.
- **Ends with a report**: the files, the front matter, what was checked, what was not, claims it could not verify, and what you still have to do (upload a missing picture and give its alt text, confirm a link, turn Draft off).

It never pushes or merges: the work arrives as a branch for you to review, then you publish as in sections 1 and 2.

## 11. Editing the home page and listing pages

The words of the home page, of **Latest**, of the five archives (News, Blog, Vlogs, Projects, Repos), of the **Games** page and of the **Tags** page are under **Pages** too, below the About page. They are saved, previewed and published like the About page (section 7). The posts on these pages are not written here: they come from the posts themselves, when the site is built.

**The home page** (**Pages > Home page**):

1. The top boxes are the hero: **Eyebrow** (the small brass line; today `{site.tagline}`, which prints the tagline from **Site settings**, section 9), **Headline** (the big heading; one phrase in `*asterisks*` is set in italic brass), **Lead paragraph** (today `{site.description}`, the description from Site settings), and up to two **Buttons**. Settings in braces work as on the pages of section 8; leave them as they are to keep the hero in step with the settings, or type your own words instead. The first button is solid, the second outlined. A button's address can be a page (`/latest/`), another site (`https://…`), or a part of the home page: `#latest` goes to the Latest feed.
2. **Description for search results**: as on About; not shown on the page. The browser tab of the home page reads the site name and tagline (site settings), not the headline.
3. **Rows below the hero** are blocks, as on About (add, drag, open, remove). Today they are, in order:
   - **Pinned post**: the post you marked **Featured**, as a large card, under the eyebrow and heading you write here. It is left out when no post is featured, or when only one post is published.
   - **Latest feed**: the newest posts of every kind with a filter by kind, the links to each kind's archive (under the **Archive links title**; they replace the filter when a reader's JavaScript is off, so you rarely see them; leave it empty for no links), and a link to everything (**Link text** and **Link address**). Its two "When nothing is posted" boxes are what the page says while the site has no posts. A page holds one Latest feed.
   - **Latest posts** twice: Projects and Repos. **Kinds** says which posts, **Order** whether newest first or last updated first (repos, by their last push on GitHub), **Frame** "A section of its own" gives them the home page's look, and **When there is nothing to show** "Leave the block out" hides the row until there is something.
   - **Games row**: the first published games, in the order of the Games page. Left out while no game is published.
   - A link at the end of a heading row (**Link text** and **Link address**, e.g. "All projects" and `/projects/`) shows only when both boxes are filled in. The preview says so if only one is.
   - Any other block of the library can go between them (a callout, a picture, a button…).

**A listing page** (**Latest (every post)**, **News archive**, **Blog archive**, **Vlogs archive**, **Projects archive**, **Repos archive**, **Games page**, **Tags page**):

1. **Page heading** (the big heading; one phrase in `*asterisks*` in brass), **Browser title** (today the kind's name, e.g. "Blog"; it is followed by "· R7 Orbit"), **Description for search results**, and **Lead paragraph** (under the heading).
2. **Sections above the list** and **Sections below the list**: optional blocks before and after the list of posts (a note, a pinned link, a callout). Most pages leave them empty. Every numbered page (`/blog/page/2/`) repeats them.
3. **When there is nothing to list**: the heading and the sentence shown while there is nothing in that list. On the Games page there is also the button under them (it goes to the projects) and the card shown beside a single game (**Beside a single game**: eyebrow, heading, text).
4. Not here, because they are made from the posts or shared with the site's navigation: the list itself, its search, filters, counts and pagination, the small label and icon over the heading (the kind's name in the menu), the tag chips and "Used once" on the Tags page, and the messages of the filters ("Nothing matches that.").

**What the preview shows.** The hero or the page head and your blocks, drawn with the site's styles. Whatever is made from the posts (the cards, the pinned post, the games, the tags) cannot be drawn in the editor: in its place a box says what goes there and when ("Stand-in. The posts are listed here…", "Pinned post: the post marked Featured…"), with a note under the block. On a listing page your words for an empty list follow the stand-in. The preview also lists, in a red "Fix before saving" box, what the build would stop on: a needed box left empty ("emptyHeading" is missing), a bad block (numbered from 1, "Above the list: Block 2 (Button)…"), or a second Latest feed. Open the Cloudflare preview link on the pull request to see the real page with its posts.

**Changing the words on purpose.** These pages, like About, have a test that compares their words with a saved copy (`tests/fixtures/pages/`), so a change of words is never an accident. When you change them on purpose, the pull request's check fails on that test until the copy is refreshed; whoever maintains the site runs `npm run build && UPDATE_PAGE_TEXT=1 npx playwright test page-text` on the branch, reads the difference and commits it.
