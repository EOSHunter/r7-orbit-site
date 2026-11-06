# Images

How a picture gets from the author's computer to a reader: where it is stored, what the build does to it, what the admin enforces, and what can still go wrong. The step-by-step version for the author is [`PUBLISHING.md`](PUBLISHING.md), "Adding images". This page is for whoever changes the code.

- [The rules, in short](#the-rules-in-short)
- [Where each picture lives](#where-each-picture-lives)
- [What happens to a picture](#what-happens-to-a-picture)
- [How the admin enforces it](#how-the-admin-enforces-it)
- [Audit: what was wrong or confusing before](#audit-what-was-wrong-or-confusing-before)
- [Known limits](#known-limits)
- [Where the code is](#where-the-code-is)

## The rules, in short

1. **Formats:** JPG, PNG, WebP, AVIF or SVG. HEIC (the iPhone default), HEIF, TIFF, BMP, GIF and RAW are refused, with a message that says how to export a JPG.
2. **Size:** the admin refuses a file over **10 MB**. The build resizes anything in `public/media/` wider than **2000px** down to 2000px, recompresses a big photo, strips the camera's metadata (GPS included) and turns a sideways phone photo upright. After that, **no picture the site serves may be over 2 MB**, or the build stops and names the file.
3. **Names:** lowercase letters, digits, hyphens (also `_` and `.`); no spaces or capitals. Decap does the renaming on upload.
4. **Alt text:** every picture in a post body has it, or is marked *decoration only*. The admin refuses to save without it; the build stops without it.
5. **Local only:** a picture is a file in this repository. A body that points at another site's image fails the build (`rehypeNoHotlinks`; `resolveImage` for the article components).
6. **Your own pictures, not stock**, as everywhere else (`CLAUDE.md`).

## Where each picture lives

There are two homes, because the site reads pictures in two ways.

| Home | Optimised? | Why |
| --- | --- | --- |
| `src/assets/blog/` | **Yes**: several widths, AVIF + WebP + JPG, width and height known up front | Astro can only optimise a file it imports. Blog `featuredImage` is an Astro `image()`; a blog body's *Image* and *Image gallery* blocks resolve `/src/assets/...` through `import.meta.glob` (`src/components/article/assets.ts`) |
| `public/media/<kind>/` | **No** (served as a plain file at `/media/<kind>/x.jpg`), but the build shrinks it in `dist/` | `cover`, `poster` and `gallery[].src` are plain strings in the schema. Cards, JSON-LD and `og:image` read them as they are, so they cannot become Astro assets without changing all of those |

| What | Collection | Stored in | Written into the post as | Optimised |
| --- | --- | --- | --- | --- |
| Featured image (hero) | blog | `src/assets/blog/x.jpg` | `featuredImage: ../../assets/blog/x.jpg` (relative to the post, which `image()` needs) | yes (`ArticleHero.astro`: 480-2000px, AVIF/WebP/JPG; and a 1200×630 JPG for `og:image`) |
| Image / Image gallery block in a body | blog | `src/assets/blog/x.jpg` | `<Figure src="/src/assets/blog/x.jpg" … />` | yes (`ArticleImage.astro`: 480-1600px, AVIF/WebP/JPG) |
| Cover | news, vlogs, projects, repos | `public/media/<kind>/x.jpg` | `cover: /media/<kind>/x.jpg` | no, but shrunk at build |
| Vlog poster | vlogs | `public/media/vlogs/x.jpg` | `poster: /media/vlogs/x.jpg` (falls back to `cover`) | no, but shrunk at build |
| Project gallery | projects | `public/media/projects/x.jpg` | `gallery: [{ src: /media/projects/x.jpg, alt, caption }]` | no, but shrunk at build |
| Image in a body | news, vlogs, projects, repos | `public/media/<kind>/x.jpg` | `![alt](/media/<kind>/x.jpg)`, and `*caption*` on the next line for a caption | no, but shrunk at build |
| Image / Portrait block on the About page | Pages > About page | `public/media/about/x.jpg` | `image: /media/about/x.jpg` in `src/content/pages/about.md` (alt text or `decorative: true` is required by that page's schema) | no, but shrunk at build |
| An author's avatar (an agent's own picture, when the author supplies one; `docs/TEAM.md`, "Avatars (to do)") | Authors | `public/media/authors/<slug>.png` | `avatar: /media/authors/<slug>.png` (+ optional `avatarAlt`) in `src/content/authors/<slug>.json`; square, 512 px or more | no, but shrunk at build |
| Author photo for search engines | (site) | `public/media/about/hunter-newton.jpg` | `author.photo` in `src/data/site.json`; not editable in the admin | no |

Older files keep working wherever they are: `public/media/vlogs/building-vesper-drift/poster.jpg`, `public/media/projects/vesper-drift/poster.jpg` and `public/media/screenshot-2026-10-03-195701.png` were put there by hand, in per-post folders, before the admin had per-collection folders. A path in a post is just a path; nothing moves or renames them.

### Folders in the admin (`src/admin/config.ts`)

- `media_folder: public/media` / `public_folder: /media` is the global library, the **Media** tab in the editor's top bar.
- Each collection has its own folder: `media_folder: /public/media/<kind>`, `public_folder: /media/<kind>`. The leading `/` matters: without it Decap reads the folder relative to the post's own file. `mediaFolders(name)` builds the pair; the About page's Pages collection spells out the same pair in `src/admin/pages.ts` (config.ts imports that file, so it cannot import `mediaFolders` back).
- The blog collection's folder is `/src/assets/blog` for both (so the Image blocks write `/src/assets/blog/x.jpg`), and it has no `cover` field (the featured image is the card picture, since 2026-11-06). `featuredImage` has `media_folder: /src/assets/blog` and `public_folder: ../../assets/blog`.
- Inside one collection every image field and block shares one folder, so a picture uploaded for a poster can be picked again as the cover. Decap's picker shows one folder at a time, so **between** collections a picture is uploaded again (the build warns about identical files, below). The **Media** tab lists and uploads to the global folder.

### File names (Decap's `slug` setting)

`persistMedia` in Decap lowercases the file name and passes it through `sanitizeSlug` with the `slug` option. We set `encoding: 'ascii'`, `clean_accents: true`, `sanitize_replacement: '-'`, so:

| The author's file | Stored as |
| --- | --- |
| `My Photo 1.PNG` | `my-photo-1.png` |
| `Café été.jpg` | `cafe-ete.jpg` |
| `My Photo (1).PNG` | `my-photo-1-.png` (Decap leaves a hyphen before the dot; harmless) |
| `IMG_0001.JPG` | `img_0001.jpg` |

Before this setting Decap already lowercased and hyphenated, but kept accents and other Unicode letters. Files that reach the repository another way (git, GitHub's upload page) are not renamed, so `scripts/media.mjs check` refuses a name that is not `[a-z0-9][a-z0-9._-]*`.

## What happens to a picture

### From `src/assets/` (optimised)

`featuredImage`: `ArticleHero.astro` renders `<Picture>` at 480, 768, 1200, 1600 and 2000px in AVIF, WebP and JPG (quality 78), eager and high priority, and `ArticlePage.astro` makes a 1200×630 JPG for `og:image`.

Image block / `Figure` / `ImageRow`: `ArticleImage.astro` renders `<Picture>` at 480, 768, 1200 and 1600px in AVIF and WebP with a JPG fallback (quality 80), lazy, with `sizes` matching how wide the figure is drawn. A 1.3 MB, 2293px PNG screenshot becomes files of 14-170 KB depending on the width the browser picks. Widths larger than the original are skipped. An SVG in `src/assets/` is copied with a hashed name and not resized.

### From `public/media/` (plain files, shrunk at build)

The file is copied to `dist/media/` unchanged, then `scripts/media.mjs dist` (run by `npm run build` after Astro) goes through `dist/media/`:

- a JPG, PNG, WebP or AVIF **wider than 2000px** is scaled to 2000px (never enlarged);
- one **over 300 KB**, or one that carries metadata (EXIF: camera, GPS), is re-encoded (JPG quality 82 with mozjpeg, PNG level 9, WebP 82, AVIF 55) and kept only if it came out smaller, unless it had to be resized or cleaned;
- the result is turned upright by its EXIF orientation first, and no metadata is written back;
- an SVG, an animated file and a small clean file are left alone.

The originals in `public/media/` are never changed, so git keeps what the author uploaded. The paths in posts are the same before and after.

Before that, it writes smaller **WebP copies** of every picture from `public/` that is at least 480px wide, next to it: `x.160w.webp`, `x.480w.webp`, `x.720w.webp`, `x.960w.webp`, `x.1280w.webp` (the widths below its own) and one at its own width (widths and names in `src/lib/media-rules.mjs`). The components that draw such a picture (cards, covers, posters, the portrait, the author's avatar, a `/media/` picture in a Figure) list them in a `srcset` with a `sizes` that says how wide it is drawn (`src/lib/media-srcset.ts`), so a phone downloads the copy it needs: the 160 copy for a 32px avatar instead of the 800px photo. `src` stays the original.

Measured on this repository: `public/media/screenshot-2026-10-03-195701.png` (2293×1206, 1.3 MB) becomes 2000×1052, 386 KB. A synthetic 4032×3024 phone-sized JPEG with EXIF (4.0 MB, noise-heavy so a worst case) becomes 2000×1500, 725 KB, with the EXIF gone.

### Opening a picture larger (every post page)

A post's pictures with alt text (its cover and its body's pictures) open in a dialog when clicked, or with Enter or Space (`src/components/ImageZoom.astro`, `src/scripts/image-zoom.js`; tested in `tests/image-zoom.spec.js`). The dialog shows the same file with a larger `sizes`: the screen's width from 1200px up, a 1600px copy below that so pinching to zoom on a phone shows the detail. So a bigger file is fetched only when a reader opens one. Decorative pictures (`alt=""`) are not enlargeable, nor is anything inside a link or a button (cards, video and game posters, the project gallery, which has its own lightbox).

### What a 6 MB phone photo does, step by step

1. **In the admin.** The picker accepts it (the limit is 10 MB). It is named `img_4021.jpg`.
2. **Save.** Decap commits it to the post's pull request. The size is within the 10 MB limit; GitHub holds it.
3. **Build** (the CI check, then Cloudflare):
   - blog body Image block or featured image (`src/assets/blog/`): Astro produces 4-5 widths in 3 formats; the reader downloads one of about 15-120 KB;
   - cover, poster, gallery, news/vlog/project body (`public/media/<kind>/`): shrunk to ≤ 2000px and recompressed in `dist/`, typically 300-800 KB, metadata removed;
   - if it is still over 2 MB (a noisy PNG, a huge SVG) the build stops and names the file and the fix.
   - a picture in `src/assets/` that no page uses any more (the old one, after you replace a featured image) is removed from `dist/_astro/` before that check, so it cannot stop a deploy. Astro copies every file in `src/assets/` because a post body may name any of them (`src/components/article/assets.ts`); `unreferencedPictures` in `src/lib/media-rules.mjs` finds the ones no page, stylesheet or script names. Added 2026-11-06, after two editor saves failed to deploy on an old 2.4 MB screenshot.
4. **Reader.** Gets the small file. The 6 MB original stays in git only.

Before this work: a 6 MB photo in `public/media/` was served to every reader as 6 MB, with its GPS position inside.

## How the admin enforces it

| Rule | Where | What the author sees |
| --- | --- | --- |
| File too big (>10 MB) | `media_library.config.max_file_size` on every image widget (`IMAGE_LIBRARY`, `src/lib/media-rules.mjs`); Decap reads the limit from the widget, not the top level | An alert in the picker stating the limit, nothing uploaded |
| HEIC / unsupported format / oversized | `preSave` listener (`src/admin/image-rules.ts`, registered in `main.ts`) over the files uploaded in this session | "Failed to persist entry: Not saved. <file>: HEIC is the iPhone's default format… Export it as JPG…" |
| Alt text missing on a body picture | the same listener scans the body for `![](…)`, `<Figure>` and gallery images with no alt | "Not saved. "Post title": the image "/…" has no alt text. Fill in "Alt text" on the image, or tick "Decoration only"…" |
| Alt text missing, seen early | the live preview shows a red "No alt text" band under the picture (`ALT_WARNING` in `preview-html.ts`) | The warning, as soon as the picture is chosen |
| Alt text missing, safety net | the build: `src/lib/markdown/remark-image-alt.mjs`, on every file under `src/content/` and on vlog bodies | The build/CI check fails: `src/content/blog/x.mdx: the image "/…" has no alt text. …` |
| Decorative picture | **Decoration only** tick in the Image block (writes `decorative={true}` on `Figure`, or `![](x.jpg "decorative")` in Markdown) | no alt text needed; the page gets `alt=""` |

The `preSave` check is advice at the right moment; the build is the guarantee, because a file can reach the repository without the admin.

### The Image blocks

- **Blog bodies:** the **Image** block (the `Figure` component, label changed from "Figure") with fields *Image, Alt text, Caption, Decoration only, Placement (center/left/right/full), Size (lg/md/sm)*. **Image gallery** takes 2-3 pictures, each with alt text and a caption. Decap's own `image` block is not offered in the blog.
- **News, vlogs, projects, repos:** these are plain Markdown, so there is no `Figure`. The **Image** block here is `markdownImage` in `blocks.ts`, registered under Decap's built-in id `image` so it **replaces** the built-in (which let alt text stay empty). Fields: *Image, Alt text, Caption, Decoration only*. It writes `![alt](/media/<kind>/x.jpg)` and, for a caption, an italic line straight under it, which `remark-figures.mjs` turns into `<figure>` + `<figcaption>`. Placement and size are not available in plain Markdown.

### Pictures showing in the editor (`src/admin/asset-bridge.ts`)

Decap treats a path that starts with `/` as a ready-made web address. A freshly uploaded `/media/vlogs/x.png` therefore never matched the blob it holds under `public/media/vlogs/x.png`: the thumbnail in the image field and the live preview showed a broken image until the post was published. The bridge asks Decap for the file by its name (which it resolves through the field's folder), and falls back to the path itself (an image that is already live is served by the site). It is applied to the image widget (registered over the built-in one in `main.ts`), to the blocks' previews and to the blog preview. It only rewrites paths one level under `/media/<kind>/` or `/src/assets/<group>/`, so an older picture in a deeper folder cannot be replaced by a same-named upload.

## Audit: what was wrong or confusing before

Found by reading `src/admin/`, `src/content.config.ts`, the components and the content, and by driving the real admin against a pretend GitHub.

1. **One folder for everything.** `media_folder: public/media` for every collection, so a vlog poster, a news cover and a gallery shot all landed flat in `public/media/`. The existing files use hand-made per-post folders (`public/media/vlogs/building-vesper-drift/`), a second convention. *Now:* one folder per collection.
2. **Big photos were served as they were.** Only the blog `featuredImage` was optimised. A cover, poster, gallery shot or body image was copied to the site byte for byte: a 6 MB phone photo meant 6 MB for every reader, GPS tag included. `public/media/screenshot-2026-10-03-195701.png` is 1.4 MB and is the cover of the one blog post. *Now:* shrunk at build, and blog pictures optimised.
3. **Alt text could be forgotten, silently.** The schema only requires `coverAlt` to be *present*, and Decap defaults it to `""`, so forgetting it published an empty alt. The built-in body `image` block, and the Markdown view, wrote `![](…)` with nothing checking it. `src/content/blog/test.mdx` has `featuredImageAlt: ""` and `coverAlt: ""` today (see Known limits). *Now:* a body image needs alt text or an explicit "decoration only"; the admin refuses to save, the build refuses to build.
4. **Two "image" blocks in the blog.** The "+" menu offered Decap's built-in *Image* (no caption, optional alt, a "Title" field nobody understands) next to *Figure*, which only worked with files under `public/media/`. *Now:* one block, *Image*.
5. **`Figure` could not use an optimised picture.** It took a string path or an imported object and rendered a raw `<img>`; the `import`-based route was unusable from MDX posts that cannot import. *Now:* it also takes `/src/assets/...` and renders `<picture>` (AVIF/WebP, srcset). `/media/...` still works.
6. **A new upload showed as a broken image in the editor.** The path-starts-with-`/` behaviour above: broken thumbnails for every `cover`, `poster` and gallery image, and a broken preview for a body image, until the post was published. (The blog featured image worked only because its public path is relative.) *Now:* shown through the bridge.
7. **HEIC.** The picker's `accept="image/*"` lets an iPhone HEIC through; nothing stopped it and Chrome and Firefox cannot show it. *Now:* refused on save, and by the build if it gets into git another way.
8. **File names.** Decap lowercased and hyphenated, which hid the problem, but kept accents, and a file added through git was never renamed (a space becomes `%20` and breaks `og:image`). *Now:* ASCII-only names from the admin, and the build checks every name.
9. **Duplicates.** `public/media/projects/vesper-drift/poster.jpg` and `public/media/vlogs/building-vesper-drift/poster.jpg` are the same 63 KB file, and `screenshot-2026-10-03-195701.png` is in both `public/media/` and `src/assets/blog/` (1.4 MB twice). Decap only warns about a same-named file inside one folder. *Now:* `scripts/media.mjs check` prints a warning for identical files (it does not fail).
10. **Markdown body images are bare.** `![alt](/media/x.jpg)` renders `<img src alt>` with no `width`, `height` or `loading="lazy"` (`docs/CONTENT_MODEL.md` says "width/height are read from the file"; they are not). Not changed here: see Known limits.
11. **`cover` is drawn at a fixed 1280×720** (`<img width="1280" height="720">` in `ArticlePage.astro`, and `coverOf` in `src/lib/post-cards.ts` for the cards) whatever the real shape, so a non-16:9 cover is distorted or cropped by CSS. The hint says 16:9.
12. **`cover` and `featuredImage` looked alike in the blog form.** Two image fields, two alt fields, two folders, and the same picture uploaded twice (which Decap then committed once: the deploys of 2026-11-06). *Now:* a blog post has only the featured image, which is also its card and share picture.

## Known limits

- **`cover`, `poster`, `gallery` and Markdown-body pictures are not responsive** (no srcset, no AVIF): they are shrunk to ≤ 2000px and recompressed, which fixes the weight but not the format. Making them Astro assets means changing every place that reads them as strings (cards, JSON-LD, the share image), which belongs to other work.
- **Markdown body images** still lack `width`/`height`/`loading="lazy"`. A rehype step could add them.
- **The picker shows one folder at a time.** To reuse a picture in another kind of post, upload it again (the check warns, it does not fail).
- **After reopening an unpublished draft**, the thumbnail of an image that is only in the pull request may not show in the form until the post is published (the preview does show it once Decap has loaded it). Nothing is lost.
- **`My Photo (1).PNG` becomes `my-photo-1-.png`.** Decap's own sanitiser; harmless.
- **`src/content/blog/test.mdx`** has empty alt text on its featured and cover images (a screenshot of the game). The author should describe them or confirm they are decoration; this task did not edit content.
- **The identical `src/assets/blog/screenshot-2026-10-03-195701.png`** is unused (the post's cover is the `public/media` copy). The demo at `/styleguide/article-components/` uses it. Delete one of the pair if you like.

## Where the code is

| What | File |
| --- | --- |
| Limits, formats, name rule, alt-text finder (shared) | `src/lib/media-rules.mjs` (tests: `media-rules.vitest.ts`) |
| Build guard + `dist/media` optimiser | `scripts/media.mjs` (`npm run build`, `npm run media:check`) |
| Alt-text build check | `src/lib/markdown/remark-image-alt.mjs` (registered in `astro.config.mjs` and `vlog/renderNotes.ts`) |
| `Figure`, `ImageRow`, optimised `<picture>` | `src/components/article/Figure.astro`, `ImageRow.astro`, `ArticleImage.astro`, `assets.ts` |
| Folders, name rule, size limit | `src/admin/config.ts` (the "Images" blocks) |
| Image blocks | `src/admin/blocks.ts` (`Figure` labelled Image, `markdownImage`) |
| Save check | `src/admin/image-rules.ts` |
| Pictures showing in the editor | `src/admin/asset-bridge.ts`, `preview-html.ts` (`ALT_WARNING`) |
| Tests | `tests/admin-images.spec.js` (upload end to end under the admin CSP), `tests/images.spec.js` (what a reader gets) |
