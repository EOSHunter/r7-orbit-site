# SEO and sharing

What makes the site findable and makes a shared link look good. All of this is cheap to do at the start and annoying to retrofit.

## Head tags for every page

```html
<title>{page title} · {Site name}</title>               <!-- home: "{Site name} · {tagline}" -->
<meta name="description" content="{summary, ≤155 chars}">
<link rel="canonical" href="{absolute URL, with trailing slash}">
<meta name="theme-color" content="#09090a">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="alternate" type="application/rss+xml" title="{Site name}" href="/rss.xml">

<meta property="og:type" content="article">             <!-- website for home/archives -->
<meta property="og:site_name" content="{Site name}">
<meta property="og:title" content="{title without * markers}">
<meta property="og:description" content="{summary}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{absolute URL, 1200x630}">
<meta property="og:image:alt" content="{what the image shows}">
<meta property="article:published_time" content="2026-10-03">
<meta property="article:modified_time" content="2026-10-08">
<meta property="article:tag" content="evals">
<meta name="twitter:card" content="summary_large_image">
```

Rules: title ≤ 60 characters (so it isn't cut in results); description ≤ 155; **absolute** URLs in canonical and OG; strip the `*italic*` markers from titles everywhere outside the page body.

## Share images

- Default: `brand/og-default.png` (1200×630). Used on any page with no cover.
- A post with a `cover` uses it (crop to 1.91:1 at build). Keep the subject in the centre 80%.
- Later: generate one per post (title on the brand background with the mark) using `satori` + `resvg-js` at build time. The template is `brand/source/og-default.html`: the layout, fonts and colours are already defined there.
- Test with the LinkedIn Post Inspector, the Facebook Sharing Debugger, and by pasting a link into Slack/Discord/iMessage. Platforms cache aggressively; add `?v=2` when testing a changed image.

## Structured data (JSON-LD)

One `<script type="application/ld+json">` per page.

| Page | Type | Key fields |
|---|---|---|
| Home | `WebSite` (+ `SearchAction` pointing at `/search/?q=`) | name, url |
| Blog post | `BlogPosting` | headline, description, datePublished, dateModified, author (`Person`), image, mainEntityOfPage |
| News item | `NewsArticle` | as above + `isBasedOn` (the source URL) |
| Vlog | `VideoObject` | name, description, thumbnailUrl, uploadDate, duration (`PT12M48S`), embedUrl |
| Project | `SoftwareApplication` (or `CreativeWork`) | name, description, applicationCategory, url, image |
| Repo | `SoftwareSourceCode` | name, description, codeRepository, programmingLanguage, license |
| About | `ProfilePage` + `Person` | name, sameAs (profile URLs) |
| Archives / tags | `CollectionPage` | name, description |
| Every page below home | `BreadcrumbList` | |

Validate with Google's Rich Results Test and the Schema.org validator.

## URLs

- Lowercase, hyphenated, kind in the path, trailing slash: `/blog/why-every-agent-gets-its-own-room/`.
- Never change a published URL without a 301 redirect (`public/_redirects` on Cloudflare/Netlify).
- Pagination: `/blog/page/2/` with `rel="prev"/"next"` (informational) and a self-referencing canonical.
- Tag pages only for tags with ≥ 2 posts; thin pages get `noindex`.
- Filters and search params (`?tag=`, `?q=`) are `noindex` and canonical to the base page.

## Crawling

`/robots.txt`:

```
User-agent: *
Allow: /
Sitemap: https://example.com/sitemap-index.xml
```

`/sitemap-index.xml` lists every page except drafts, search and `noindex` pages, with `lastmod` from `updated` or `date`. Submit it in Google Search Console and Bing Webmaster Tools after launch.

## Feeds

RSS 2.0 at `/rss.xml` (everything) and per kind. Include the full text for blog posts, summary + link for the others. Set `<atom:link rel="self">`, a stable `<guid isPermaLink="true">`, and `<lastBuildDate>`. Add the `<link rel="alternate">` in every page head.

## Performance is SEO

See the budgets in `PROJECT_BRIEF.md` §9. Specifically: no render-blocking third-party scripts; preload the two above-the-fold font files (`Inter` variable and `Cormorant Garamond 400`); set `width`/`height` on every image; serve AVIF/WebP; cache static assets with long `max-age` + hashed filenames; HTML with short cache.

## Accessibility is SEO

Semantic HTML, one `h1`, descriptive link text, alt text, language attribute, readable contrast (the tokens guarantee it), visible focus.

## Social profiles to set up with the brand assets

| Where | File | Notes |
|---|---|---|
| YouTube avatar | `brand/social/avatar-800.png` | Shown as a circle; the icon survives the crop |
| YouTube banner | `brand/social/youtube-banner.png` (2560×1440) | Text kept inside the 1546×423 safe area; edit `brand/source/youtube-banner.html` to change it |
| GitHub profile / org avatar | `brand/social/avatar-800.png` | |
| GitHub repo social preview | `brand/social/github-social-preview.png` (1280×640) | Settings → Social preview. Edit `github-social.html` for each repo's name |
| X / Bluesky / LinkedIn avatar | `brand/social/avatar-800.png` | |
| Link previews | `brand/og-default.png` | |

Headers for X (1500×500) and LinkedIn (1584×396) aren't made yet; copy `youtube-banner.html` as the starting point if wanted.

## Launch checklist for search

- [ ] Site verified in Google Search Console and Bing Webmaster Tools; sitemap submitted
- [ ] `robots.txt` allows crawling; staging site is `noindex` and password-protected
- [ ] Every page has a unique title and description
- [ ] OG images render on Slack, Discord, X, LinkedIn
- [ ] RSS validates; sitemap validates; structured data validates
- [ ] 404 returns 404; `www` ↔ apex redirect is set; HTTP → HTTPS redirect is on
- [ ] Lighthouse mobile ≥ 95 in all categories on home, a post, an archive
