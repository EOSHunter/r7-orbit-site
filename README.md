# r7-orbit-site

all things r7 orbit

## Admin (writing posts at `/admin`)

Author's guide: [`docs/PUBLISHING.md`](docs/PUBLISHING.md) (write and publish a post, scheduled posts, the manual check after admin or header changes, rolling back, build failures).

A git-based editor for every kind of post, built on [Decap CMS](https://decapcms.org). There is no server and no database: saving writes a Markdown file into `src/content/<kind>/` and uploads images, and the site rebuilds from git like any other change. The admin page is `src/pages/admin/index.astro` (bundled by Astro, nothing loaded from a CDN); the forms are in `src/admin/config.ts`, the article blocks in `src/admin/blocks.ts`, the blog preview in `src/admin/preview.ts`.

| Collection | Writes | Fields beyond the common ones |
|---|---|---|
| Blog posts | `src/content/blog/*.mdx` | `subtitle`, `featuredImage` + `featuredImageAlt`, `series` + `seriesOrder`, `toc`; the body takes the article blocks and has a live preview |
| News | `src/content/news/*.md` | `sourceUrl`, `sourceName`, `take` |
| Vlogs | `src/content/vlogs/*.md` | `youtubeId` / `videoUrl`, `duration`, `poster`, `chapters` (`t`, `title`), `transcript` |
| Projects | `src/content/projects/*.md` | `status`, `stack`, `liveUrl`, `repoUrl`, `repo`, `started`, `shipped`, `role`, `gallery` (`src`, `alt`, `caption`), `timeline` (`date`, `text`) |
| Repos | `src/content/repos/*.md` | `repo`, `homepage`, `readme`, `install`, `relatedProject` (picks a project) |

Every collection also has the common fields from the schema (`title`, `date`, `updated`, `summary`, `tags`, `cover` + `coverAlt`, `featured`, `draft`, `readTime`, `author`, `canonicalUrl`, `aiAssist`) and a Markdown `body`. The field names are the schema's own (`src/content.config.ts` is strict: a field the schema does not know fails the build), and `src/admin/config.vitest.ts` reads the real schema and fails when the two drift apart: a field added, renamed, or changed between required and optional on one side only. Change them together.

Decap cannot check a rule that spans fields, so these are caught only by the build (and by the pull request's CI when deployed), and the field help says so: a vlog needs a **YouTube video ID** (the 11 characters after `v=`) *or* a **video URL**; a **series** needs a part number; a **cover** or **featured image** needs alt text.

**Editing locally** (no sign-in; files change on disk, you commit them yourself):

```
npm run dev     # terminal 1
npm run cms     # terminal 2: the local file proxy, bound to 127.0.0.1:8081
```

Open <http://localhost:4321/admin/> (the port `npm run dev` prints, if 4321 is busy), click Login, and pick a collection. **Draft** is off by default, like the schema; turn it on to hold an entry back. A draft is excluded from the site, the archives, search, feeds and sitemap.

**The editor.** Every body is a rich Markdown editor with H2/H3, lists, quotes, code, links and images (the image button uploads to `public/media/`); use the Rich Text / Markdown switch to see or edit the raw text. Tags are up to six, lowercase and hyphenated. Dates are written `2026-10-03`. In blog posts the **+** menu in the body inserts the article components (below); news, vlogs, projects and repos are plain Markdown.

| Block | Written as | Props (see `docs/ARTICLE_COMPONENTS.md`) |
|---|---|---|
| Figure | `<Figure />` | `src`, `alt`, `caption?`, `align?` (center, left, right, full), `size?` (lg, md, sm) |
| Callout | `<Callout>…</Callout>` | `type` (`info` `tip` `warn`), `title?`, children |
| Quote | `<Quote>…</Quote>` | `cite?`, `href?`, children |
| ImageGallery | `<ImageGallery />` | `images`: 2-3 of `{ src, alt, caption? }` |
| TwoColumn | `<TwoColumn>` with `<div slot="left">` and `<div slot="right">` | `ratio?` (1:1, 2:1, 1:2) |
| VideoEmbed | `<VideoEmbed />` | `id` (YouTube), `title`, `caption?` |
| Divider | `<Divider />` | `variant?` (rule, dots) |

`Pullquote` and `CodeBlock` have no block in the admin (its built-in code block writes a fenced block, which looks the same as `CodeBlock`); type them in the Markdown view, as in the demo `src/components/article/demo/article-components-demo.mdx` (shown at `/styleguide/article-components/`). `ImageGallery` is the same component as `ImageRow`. Posts never `import` these (only blog posts are MDX): `ArticlePage` passes `articleComponents` (`src/components/article/mdx.ts`) to the post, and the RSS feed does the same. Image paths in blocks are `/media/x.jpg`: the components only accept local files from `public/`. The featured image is different: it goes to `src/assets/blog/` and is written relative to the post (`../../assets/blog/x.jpg`), because Astro optimises it. If a component's props change, change `src/admin/blocks.ts` and its test (`blocks.vitest.ts`) to match.

**The blog preview.** Blog posts show a live preview beside the form, drawn with the site's real styles. `src/admin/main.ts` loads the same CSS files the public pages use (design-system tokens and components, `site.css`, `markdown.css`, `article.css`) and the global style block of `ArticleHero.astro` into the preview pane, and `src/admin/preview.ts` renders the page the way `ArticlePage` lays it out: breadcrumb, headline with the italic brass phrase, summary, byline, tags, the hero with the featured image under its dark gradient (or the plain header without one), the contents list, and the body in the reading column (`.prose`, with the class names `ArticleTemplate` uses). Change a stylesheet and the preview follows; change the markup in `ArticlePage` or `ArticleHero` and `preview.ts` has to be changed to match.

*What the preview does not show.* It approximates these, because an Astro component cannot run in the browser and Decap renders the body itself:

- **The page markup is a copy.** `preview.ts` rebuilds the structure of `ArticlePage` and `ArticleHero` in React. The styles are the real ones; the markup is not shared.
- **The article blocks are drawn from copies of their markup** (`src/admin/preview-html.ts`: the same elements, classes and data attributes; `preview-html.vitest.ts` fails if a component drops a class used there). Text inside Callout, Quote and TwoColumn shows paragraphs, lists, bold, italic, code and links only. The video is the click-to-load plate with its play button and never contacts YouTube, so the preview makes no third-party requests either. An image that is chosen but not yet saved shows through Decap; a path that does not exist shows a broken image.
- **The rest of the body is rendered by Decap, not by the site's Markdown pipeline.** So there are no heading anchors, no code highlighting or code-block header with its copy button, no `> [!NOTE]` callouts and no `— Name` pull-quote attribution (both show as plain quotes), and no figure with a caption from an image followed by an italic line. Check those on the pull request's Cloudflare Pages preview.
- **The featured image is a plain `<img>`**, not Astro's `<Picture>` (no AVIF/WebP resizing), cropped the same way.
- **Links do nothing**, so the contents list does not scroll, and the page is as wide as the preview pane, so it lays out like a narrow screen (the contents list is the collapsed "On this page" box).
- **Left out entirely:** the site header and footer, the series box, share row, related posts, previous/next and the subscribe band.

**Signing in when deployed.** The live admin edits the GitHub repository directly, so it needs a GitHub sign-in, and GitHub's OAuth flow needs one small server-side step (exchanging a code for a token with the app's secret) that a static site cannot do. That step is the Cloudflare Worker in `workers/cms-auth/` (its own README; it is not part of the Astro build, lint or tests). The site is pointed at it by three constants in `src/admin/config.ts`: `CMS_REPO` (`EOSHunter/r7-orbit-site`), `CMS_BRANCH` (`main`) and `CMS_AUTH_URL` (`https://cms-auth.r7orbit.io`, a placeholder until the Worker is deployed there). A build can override them with `PUBLIC_CMS_REPO`, `PUBLIC_CMS_BRANCH` and `PUBLIC_CMS_AUTH_URL`. Creating the GitHub OAuth App, deploying the Worker with its secrets, the custom domains and the scheduled rebuild are a click-by-click guide in [`docs/DEPLOY_CLOUDFLARE.md`](docs/DEPLOY_CLOUDFLARE.md); the author does those once.

Anyone who can sign in to GitHub **and has write access to the repository** can use it; the token stays in that browser. When deployed, every save opens a pull request (Decap's editorial workflow), so CI runs `npm run build` on the post, and the strict content schema rejects a bad field, before it reaches the live site; Cloudflare Pages previews show the post as it will look. Merging the pull request (the editor's **Publish**) puts a commit on `main`, which Cloudflare Pages builds and deploys. A post dated in the future is left out of that build, so `.github/workflows/scheduled-deploy.yml` rebuilds the site daily (see the guide).

**Kept out of indexes.** `/admin/` is `noindex, nofollow` in its HTML and (on Cloudflare Pages) in `public/_headers`, where it also gets a Content-Security-Policy that lets the editor send data only to itself, its own `blob:` URLs (uploaded images), `api.github.com` and `www.githubstatus.com` (`tests/headers.spec.js` runs the editor under it), disallowed in `robots.txt`, excluded from the sitemap (`EXCLUDED_PATHS`), outside the search index (`pagefind.yml` only indexes the five content folders), and never linked. Feeds are built from the content collections, so it cannot appear there. `tests/admin.spec.js` and `src/admin/exclusions.vitest.ts` check this.

Two things the form cannot enforce, so the build does: a featured image needs `featuredImageAlt` (leave it empty on purpose only for a decorative image), and clearing an optional field writes an empty value (`featuredImage: ''`), which the site treats as not set.

Existing `.md` blog posts keep working but are not listed in the admin (blog posts are `.mdx`); edit those in a code editor, or rename them to `.mdx`. News, vlogs, projects and repos are `.md` in the admin, so their existing posts are listed.
