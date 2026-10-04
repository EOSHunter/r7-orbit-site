# r7-orbit-site

all things r7 orbit

## Admin (writing articles at `/admin`)

A git-based editor for blog posts, built on [Decap CMS](https://decapcms.org). There is no server and no database: saving writes an `.mdx` file into `src/content/blog/` and uploads images into `src/assets/blog/`, and the site rebuilds from git like any other change. The admin page is `src/pages/admin/index.astro` (bundled by Astro, nothing loaded from a CDN); the form is in `src/admin/config.ts`, the article blocks in `src/admin/blocks.ts`.

**Editing locally** (no sign-in; files change on disk, you commit them yourself):

```
npm run dev     # terminal 1
npm run cms     # terminal 2: the local file proxy, bound to 127.0.0.1:8081
```

Open <http://localhost:4321/admin/>, click Login, then "Blog post". New posts start as **drafts**; turn Draft off to publish. A draft is excluded from the site, the archives, search, feeds and sitemap.

**The editor.** Fields: title, subtitle, date, summary, tags (up to 6, lowercase-hyphenated), featured image + alt text, featured, draft, and a rich body with H2/H3, lists, quotes, code, links and images (the body's image button uploads to `src/assets/blog/`). The **+** menu in the body inserts the article components. Use the Rich Text / Markdown switch to see or edit the raw MDX.

| Block | Written as | Props |
|---|---|---|
| Figure | `<Figure />` | `src`, `alt`, `caption?` |
| Callout | `<Callout>…</Callout>` | `type` (`note` `tip` `warning`), `title?`, children |
| Quote | `<Quote>…</Quote>` | `author?`, `source?`, children |
| ImageGallery | `<ImageGallery />` | `images`: `[{ src, alt, caption? }]` |
| TwoColumn | `<TwoColumn>` with `<Fragment slot="left">` and `slot="right"` | two named slots |
| VideoEmbed | `<VideoEmbed />` | `youtubeId`, `title`, `caption?` |
| Divider | `<Divider />` | none |

Posts never `import` these: `src/lib/article-components.ts` finds them in `src/components/article/` by file name and passes them to the post (page and RSS feed). Image paths in props are relative to the post file (`../../assets/blog/x.jpg`), the same form as `featuredImage` and Markdown images. If a component's props change, change `src/admin/blocks.ts` and its test (`blocks.vitest.ts`) to match.

**Signing in when deployed.** The live admin edits the GitHub repository directly, so it needs a GitHub sign-in, and GitHub's OAuth flow needs one small server-side step (exchanging a code for a token with the app's secret) that a static site cannot do. Nothing here is live until you set that up once:

1. Create a GitHub OAuth app (Settings → Developer settings). Homepage: the site URL. Callback URL: `<auth proxy>/callback`.
2. Deploy a Decap-compatible OAuth proxy that holds the app's client id and secret, for example the open-source `sveltia-cms-auth` Cloudflare Worker (free tier). It serves `/auth` and `/callback`.
3. Build the site with `PUBLIC_CMS_AUTH_URL=<auth proxy URL>` (a Cloudflare Pages build variable). Optionally `PUBLIC_CMS_REPO` (default `EOSHunter/r7-orbit-site`) and `PUBLIC_CMS_BRANCH` (default `main`). Without `PUBLIC_CMS_AUTH_URL`, `/admin/` just says sign-in is not set up.

Anyone who can sign in to GitHub **and has write access to the repository** can use it; the token stays in that browser. When deployed, every save opens a pull request (Decap's editorial workflow), so CI runs `npm run build` on the post, and the strict content schema rejects a bad field, before it reaches the live site; Cloudflare Pages previews show the post as it will look. Merging the pull request publishes it.

**Kept out of indexes.** `/admin/` is `noindex, nofollow` in its HTML and (on Cloudflare Pages) in `public/_headers`, disallowed in `robots.txt`, excluded from the sitemap (`EXCLUDED_PATHS`), outside the search index (`pagefind.yml` only indexes the five content folders), and never linked. Feeds are built from the content collections, so it cannot appear there. `tests/admin.spec.js` and `src/admin/exclusions.vitest.ts` check this.

Existing `.md` posts keep working but are not listed in the admin (it manages `.mdx`); edit those in a code editor, or rename them to `.mdx`.
