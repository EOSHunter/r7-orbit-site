# Publishing a post

For the author. Plain steps, no coding needed. Everything happens at <https://r7orbit.io/admin/>. For the one-time setup (GitHub login, Cloudflare), see [`DEPLOY_CLOUDFLARE.md`](DEPLOY_CLOUDFLARE.md).

## 1. Write and publish a post

1. Open <https://r7orbit.io/admin/> and click **Login with GitHub**. A small window opens; approve it the first time. Only people with write access to the repository can sign in. If nothing happens, allow pop-ups for the site and try again.
2. In the left list pick what you are writing (**Blog posts**, **News**, **Vlogs**, **Projects** or **Repos**) and click **New …**.
3. Fill in the form. The required fields are marked. These are the ones that most often go wrong:
   - **Title**: up to 90 characters. **Summary**: one or two sentences, up to 180 characters.
   - **Browser title** (optional): a shorter title for browser tabs and search results, up to 49 characters. Use it when the title would push the page title past 60 characters; the page itself keeps the full title.
   - **Date**: the day the post goes live (see step 6).
   - **Tags**: lowercase words joined with hyphens (`ai-agents`), at most six.
4. **Featured image and alt text** (blog posts). Choose your own wide image (16:9, at least 1600px across), then fill in **Featured image alt text**: a plain sentence saying what the picture shows. The build stops without alt text. The same applies to a **Cover image** and its **Cover image alt text**. Use no stock photos.
5. **Write the body.** Type normally. To add an article component (callout, quote, image row, video, two columns and so on), click **+** in the body and pick it from the list. Blog posts show a live preview beside the form. [`ARTICLE_COMPONENTS.md`](ARTICLE_COMPONENTS.md) describes each component.
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
   | `use a date like 2026-10-03` / `Invalid date` | The date is empty or was typed in the wrong form. Pick it with the date picker, or write `2026-10-03` |
   | `coverAlt is required when cover is set` / `featuredImageAlt` | An image has no alt text. Fill in the alt text field next to the image (use a short description; leave it empty only for a purely decorative cover) |
   | `Could not find image` / `Cannot find …` an image path | The image file was deleted or the path was typed by hand. Choose the image again in the editor |
   | `Expected a closing tag` / `Could not parse expression` in a blog post | A broken article component or an unclosed `<` or `{` in the text. Open the post in the editor, check the component, or see [`ARTICLE_COMPONENTS.md`](ARTICLE_COMPONENTS.md) |
   | `Cannot find package` / network errors at install | Rare and usually temporary. Open the failed deployment and choose **Retry deployment** |

4. Fix the post in the editor, save, and publish again, or revert the post's commit (section 4) and try again later. If the log mentions something that is not in this table, copy the first error and ask for help; do not delete files to make the error go away.
