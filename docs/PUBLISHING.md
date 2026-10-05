# Publishing a post

For the author. Adding pictures is section 6, editing the About page (and what every block does: [`SECTIONS.md`](SECTIONS.md)) is section 7, and writing a post as blocks instead of one Markdown text is section 8. Plain steps, no coding needed. Everything happens at <https://r7orbit.io/admin/>. For the one-time setup (GitHub login, Cloudflare), see [`DEPLOY_CLOUDFLARE.md`](DEPLOY_CLOUDFLARE.md).

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
5. **Write the body.** Type normally. To add a picture or an article component (callout, quote, image gallery, video, two columns and so on), click **+** in the body and pick it from the list (**Image** for a picture). Blog posts show a live preview beside the form. [`ARTICLE_COMPONENTS.md`](ARTICLE_COMPONENTS.md) describes each component. Or build the body from blocks under **Sections** instead, as on the About page: [section 8](#8-write-a-post-with-sections). Use one or the other, not both.
6. **Draft and scheduled.**
   - **Draft** on: the post is kept out of the live site, archives, search, feeds and sitemap, even after it is published to GitHub. Turn it off when you want the post public.
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

The About page is made of blocks ([section 7](#7-editing-the-about-page)), and its pictures work like the ones above.

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
   - **More blocks.** **Lead paragraph** (the larger opening line), **Pull quote** (a line from the text, set large), **Code block** (pick the language; it gets a Copy button), **Image row** (two or three pictures side by side), **Lightbox gallery** (thumbnails that open full size), **Video embed** (paste the 11 characters after `v=`, not the whole link; it loads only when a reader presses play), **Playable game** (the game's address; embedded games must be on the allowed list, see below), **Two columns** (two Markdown boxes side by side), **Spacer** (empty space), **Table of contents** (links to the page's headings), **GitHub stats row** (a repository's stars and forks, fetched when the site is built), **Latest posts** (the newest posts, filtered by kind, tag or author), **Author box** and **Newsletter sign-up**. Every block, every field and an example of each are in [`SECTIONS.md`](SECTIONS.md).
5. **To re-order:** drag a block by the small handle (the two short lines) at the top of its box and drop it where it should go. Fold the block first if it is long: a tall block is hard to drop. The preview shows the new order straight away. Dragging needs a mouse or a finger; the editor has no keyboard way to move a block, so if you cannot drag, remove the block and add it again where you want it.
6. **To remove a block:** click the cross at the top right of its box. Nothing is final until you publish, and the pull request keeps the old version.
7. **To add an image:** add an **Image** (or **Portrait and text**) block, click **Choose an image**, then upload a file from your computer (or pick one already uploaded) and click **Choose selected**. Use your own picture, not stock. Then fill in **Alt text**: one plain sentence saying what the picture shows, for someone who cannot see it. The only exception is a picture that is purely decoration: turn on **Decorative image** and leave the alt text empty. If neither is done, the preview shows a red "Fix before saving" box and the build will stop.
8. **Addresses** in a Button, Links list or Game start with `https://` (another site) or, for a button or link, a single `/` (a page on this site, like `/subscribe/`). The editor refuses anything else and says why. A **Playable game** that is embedded must be on the list of allowed game hosts (`frame-src` in `public/_headers`, the same list projects use): if it is not, the pull request's build stops and says so. Ask whoever maintains the site to add the host, or choose **Link** (a button that opens the game in a new tab), which needs no permission. **Latest posts** and **Author box** check that the tag and author exist: the build stops with the list of the real ones if not.
9. **What the preview is not.** It is the page drawn with the site's real styles, so colours, type and spacing are right. It is not the real page: the header and footer are missing, the text is read by a simpler Markdown reader (headings, paragraphs, lists, bold, italic, code and links only), and the preview pane is narrower than a screen, so a portrait that sits beside the text on a computer may sit above it here. Blocks that need the built site (**Latest posts**, **GitHub stats row**, the game, the video, code colours, the gallery's full-size window) show a stand-in, and a line under each says so. Open the Cloudflare preview link on the pull request (section 1, step 7) to see the real thing.
10. **Save**, then **Publish** exactly as for a post (section 1, steps 7 to 9). The check on the pull request builds the site. If it is red, open it and read the first error: it names the block ("Block 3 (Image)" is the third block, counting from 1; `sections.2` counts from 0) and what is wrong, usually missing alt text or an address that does not start with `https://` or `/`. The preview shows the same messages above the page while you type.

Good to know: the details search engines read about you (name and bio, the "Person" data) come from `src/data/site.json`, not from this page. If you change your bio here and want search engines to see the change too, it has to be changed there as well.

## 8. Write a post with sections

Any post (a blog post, news item, vlog, project or repo) can be written as **sections**: a list of blocks you add, re-order and remove, the same blocks as the About page (section 7), instead of the one Markdown text in **Body**. Use sections when the layout matters (a picture beside text, a gallery, a button, two columns, a video in the middle); keep the Body for a long essay that is mostly text. Nothing changes for posts you already wrote: a post with a Body stays as it is.

1. Open or create the post as in section 1 and fill in the fields as usual (title, summary, date, tags, author, the source of a news item, the video of a vlog, the status of a project, the repository of a repo). Those still come from the form, whichever way the body is written.
2. **Leave Body empty.** A post uses sections **or** the Body, **never both**: the editor refuses to save a post that has both ("Not saved. This post has both sections and a Body…"), and the build would stop on one, naming the file. To switch an existing post to sections, cut its text out of Body and rebuild it as blocks; nothing converts it for you.
3. Under **Sections**, click **Add section** and pick a block, exactly as in section 7, steps 3 to 8. Pictures you upload in blocks go to the post's own folder (`public/media/<kind>/`), and each needs alt text unless it is marked **Decorative image**.
4. **Headings.** Use **Heading** blocks for the parts of the post (*Section heading* for the main ones). On a blog post with three or more section headings the contents list ("On this page") appears beside the text, built from them and from any `##` heading you type inside a Text block. A `##` inside a Text block must be on a line of its own with a blank line before and after it: the build stops on one it cannot list.
5. **Reading time** is counted from the words in the blocks (code, alt text and pull quotes are not counted), unless you type your own in **Reading time**.
6. **A vlog's transcript.** With sections there is no Body to hold it, so put it in **Transcript (for a vlog written as sections)**. It is shown folded under the notes, as before. Leave **Transcript below** off: that switch is for a Body that ends with a "Transcript" heading.
7. **A repo** with **README source** set to *Local* shows your sections instead of the README from GitHub, as it does with a Body.
8. **The preview** on the right draws the blocks in the post's column with the site's styles, and lists above the page what the build would stop on (a picture without alt text, a post with both sections and a Body). Blog posts get the full page preview; news, vlogs, projects and repos get the head of the page and the body, and a note at the top says what is not drawn (the facts column, a project's play section, gallery and changelog, a repo's README). The limits of the block preview in section 7, step 9, apply here too.
9. **Feeds.** A post written as sections sends its blocks to feed readers as simple formatted text: headings, paragraphs, lists, quotes, code, pictures with their captions and links (a spacer, the latest posts, the newsletter form and the contents list are left out). Blocks with a video or a game send a link to it.
10. **Save** and **Publish** as in section 1. If the check on the pull request is red, its first error names the post's file and the block ("blog/my-post.md, block 3 (Image)").

