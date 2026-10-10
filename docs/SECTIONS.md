# Sections: the shared block library

A page (today the About page; later every other page) and the body of any post can be an **ordered list of blocks** the author adds, removes and drags into order in `/admin`. Every block is defined **once**, in `src/lib/sections/definitions.ts`, and four things are generated or driven from that one list:

| What | Where | How it comes from the definitions |
| --- | --- | --- |
| The schema that reads a `sections` list | `sectionsSchema` in `src/lib/sections/schema.ts` | A Zod union on `type`, one member per block |
| The editor's form (Decap "Add section" list) | `sectionsField()` in `src/admin/sections-config.ts` | Read back from each block's Zod schema: no field is written twice |
| The page | `src/components/Sections.astro` and `src/components/sections/<Id>Block.astro` | The layout rows come from the definitions' `placement` |
| The live preview in the editor | `src/admin/sections-html.ts` | Same rows (`layoutSections`), same field list, and the real schema for its warnings |

Phase 1 built the library and moved the About page onto it. Phase 2 attached it to **every kind of post** (blog, news, vlogs, projects, repos) as an optional body: see "Posts" below. It also put the home page and the listing pages on it: the home page's rows are blocks (`feed`, `pinned`, `apps` (named `games` until 2026-10-06), and `latest` in its section frame), and every archive, `/apps/` and `/tags/` can hold blocks above and below its list (`introSections`, `outroSections`; `CONTENT_MODEL.md`, "The home page and the listing pages"). "Attaching the library to a collection" says how a later task attaches it elsewhere.

Related: [`CONTENT_MODEL.md`](CONTENT_MODEL.md#pages-srccontentpages) (the `pages` collection), [`PUBLISHING.md`](PUBLISHING.md#7-editing-the-about-page) (the author's steps), [`ARTICLE_COMPONENTS.md`](ARTICLE_COMPONENTS.md) (the article components most blocks wrap), [`IMAGES.md`](IMAGES.md).

## Posts

Every kind of post has an optional `sections` list next to its Markdown body (`common` in `src/content.config.ts`; the author's steps are [`PUBLISHING.md`](PUBLISHING.md#10-write-a-post-with-sections), the field-by-field effects [`CONTENT_MODEL.md`](CONTENT_MODEL.md#body-markdown-or-sections)).

- **One or the other.** A post with blocks has no Markdown body. `bodyConflict` (`src/lib/content.ts`) is run by `getPosts` over every entry, drafts included, and stops the build naming the file; `bodyOrSectionsCheck` (`src/admin/post-body.ts`) refuses the save in the editor. An empty list (`sections: []`, what the form writes by default) is not sections. Existing Markdown posts are unchanged and nothing is converted automatically.
- **One projection.** `src/lib/sections-to-content.ts` reads a sections list for everything that is not the page: `sectionsToText` (reading time: `readTime`/`bodyWords` in `content.ts`, the cards, JSON-LD `timeRequired`, the admin previews) and `sectionsHeadings` (the blog's contents list in `ArticlePage`, the anchors `prepareSections` gives the page's headings, the Table of contents block and its preview). What each block contributes is a typed table there (`BLOCKS`), so a new block does not compile until it has a line; `sections-to-content.vitest.ts` checks every block. The page itself is still drawn by `Sections.astro`; Pagefind indexes it from the built HTML.
- **Headings.** On a post every heading gets an anchor (`headingIds`), not only when there is a Table of contents block. The anchors come from `sectionsHeadings`; `prepareSections` stops the build, naming the block, if the rendered Markdown holds a heading the projection did not read (an HTML `<h2>`, for one), so the contents list never links to nothing.
- **Layout.** The post pages draw `<Sections layout="column" headingIds />` where the Markdown body was (`ArticlePage`, `VlogPage`, `ProjectPage`, `RepoPage`), so the rows sit in the post's text column beside its contents list or facts: a *Wide* block is the width of that column and a *Full* image is drawn as a wide one (nothing reaches the window's edges there). `sections.css` has the few rules for it (`.sections[data-layout='column']`).
- **Pictures** in a post's blocks are files in `public/media/<kind>/` (the form uploads there, the blog included: the blocks read a picture's size from `public/`).
- **Vlogs** keep a transcript in `transcriptText` (a Markdown field, not a block: it is one long text and only vlogs have it), shown folded under the notes as the `## Transcript` part of a Markdown body is.
- **Fixtures.** `tests/fixtures/posts/<kind>/` holds one post per kind written as sections, read by the `fixture*` collections (the real schemas) and drawn by the real page components at `/styleguide/posts/<kind>/`. `tests/post-sections.spec.js` checks them (blocks, chrome, contents list, reading time, JSON-LD, axe and widths at 320/375/1280, search through a Pagefind index of the fixture pages); the routes are in `tests/routes.js`, so every other suite runs over them too.

## How a page is written

A page file is front matter only. `sections` is the list; each block is `- type: <id>` followed by its fields (the catalogue below has one example per block):

```yaml
---
title: About
description: One or two sentences for search results.
sections:
  - type: heading
    text: Hello *there*
  - type: text
    text: Some **Markdown**.
---
```

Every field is checked by the schema, strictly: an unknown field or block type fails the build.

## What stops the build

A bad block fails `npm run build` (and the pull request's check) with a message that names the file, the block and what is wrong. Blocks are numbered from 1 in the message, as the editor shows them; the path (`sections.2`) counts from 0. Astro adds the file's name and path.

| Mistake | The build says (roughly) |
| --- | --- |
| A block type that does not exist | `sections.0.type: Block 1: Unknown block type "carousel". The blocks are: heading, lead, text, …` |
| A picture with no alt text (and not decorative) | `sections.3.alt: Block 4 (Image): this image needs alt text: describe it, or tick "Decorative" if it is purely ornamental` |
| An address that is not `https://…` or `/page/` | `sections.1.url: Block 2 (Button): "Address": use a full https:// address, or a page on this site …` |
| A picture from another site, or not in `public/media` | `… "Image": use a picture from this site …`; `about.md, block 3 (Image): the picture /media/x.jpg is not on this site …` |
| A video id that is a whole link | `… "YouTube video ID": a YouTube id is exactly 11 characters …` |
| A Latest posts block with a kind that does not exist | `sections.4.kinds.0: Block 5 (Latest posts): Invalid option: expected one of "news"\|"blog"\|…` |
| A Latest posts block with a tag no post has | `about.md, block 5 (Latest posts): no post has the tag "x". Tags in use: …` |
| A Latest posts or Author block with an author that does not exist | `about.md, block 5 (Latest posts): there is no author "x". Authors are: …` |
| An embedded game on a host `public/_headers` does not let the site frame | `about.md, block 6 (Playable game): the game's address https://x.test is not in frame-src in public/_headers …` |

The editor's preview shows the schema's own messages above the page ("Fix before saving") while the author types.

## Where a block sits

Each definition has a `placement`, and `layoutSections` (`src/lib/sections/layout.ts`) turns the list into rows:

- **prose**: the reading column (`.prose`, 68 characters wide). Consecutive prose blocks share one column.
- **wide**: a row of its own, the width of the page (image row, gallery, game, two columns, latest posts, a Wide image).
- **full**: a row that reaches both edges of the window (a Full image).
- **band**: a full-width section with its own spacing (the home page's rows).
- **portrait**: a picture in a side column with the text beside it. The Heading directly above a portrait, the portrait's text and every block after it stay in that column until a divider, a block that leaves the column (wide, full, band) or the next portrait ends it. That is how About keeps its picture beside both of its sections.

## Decisions

- **Two columns hold Markdown, not blocks.** Decap's nested variable-type lists (a list of blocks inside a block inside a list of blocks) are too clumsy to edit with, and the preview cannot draw them reliably, so each column is a Markdown box (`left`, `right`). A column that needs a picture or a callout can be split into separate blocks.
- **The Table of contents reads the Heading blocks and the `##`/`###` inside Markdown boxes.** Adding one gives every heading an `id`; a page without a Table of contents is unchanged. A heading the author never wrote as a heading (bold text) is not in it.
- **The game block uses the existing `PlayPanel`** (click-to-load facade, sandboxed frame, no request until Play is pressed). The frame rule is the one projects follow: an embedded game's origin must be in the `frame-src` of `public/_headers`. The build checks it; `public/_headers` and the admin's Content-Security-Policy are not changed by this library. Add a host there, explicitly, before using a new game.
- **Latest posts reads `getAllPosts`**, so drafts and future-dated posts are left out exactly as on the archives (in `astro dev` they show, labelled). Tags and authors are checked against every post and author, drafts included, so a block naming the tag of a post that goes live next week does not fail today.
- **GitHub stats** use the build-time loader (`src/lib/github.ts`): cached, never fetched in the reader's browser, and the build passes with the network off (the row then falls back to a plain link).
- **Author box** shows the author's bio from `src/content/authors`; it never writes an agent's note or label wording itself (CLAUDE.md, "Content rules").
- **The home page's rows are blocks** that hold configuration (which posts, how many, the words around them) and query the posts when the site is built (so, like Latest posts, they add nothing to a post's reading time: `sections-to-content.ts`): **Latest feed** (`feed`), **Pinned post** (`pinned`), **Apps row** (`apps`), and **Latest posts** with its section frame, order and "leave out when empty" (`latest`, the Projects and Repos rows). A Latest feed carries the page's `#latest` anchor and its kind filter, so a page holds one (`once` in the definition; `onceProblems` in `checks.ts` stops the build on a second one, and the preview warns). A link at the end of a heading row shows only when both its text and its address are filled in: any optional box may be left empty on its own (the library's rule), so a half-filled link is left out rather than refused, and the preview says so.
- **The home hero is not a block.** Its headline is the page's `h1`, and a block could put a second `h1` on another page; the hero is the home entry's own fields (`title`, `eyebrow`, `lead`, `buttons`), like a listing page's head. There is no "browse by kind" block either: the links to each kind's archive are part of the Latest feed, as on the page.
- **The waitlist form is not a block** (2026-10-10): it is driven by a switch on the home page's hero (`waitlist`) and on each post (`waitlist`), and by Site settings (its words and whether it shows at all), like the share row; `docs/PAGES.md` "Waitlist". A block could be added later to place it on other pages.
- **Not blocks**, because they are page chrome, one-per-page, or built from a route's own data: the header and footer, the archive list with its filters and pagination, the post-page pieces (share row, previous/next, related posts, series navigation, hero), the `/apps/` hub's grid with its type filter and "More apps coming" card, and the README block (it needs a repository per page). A later task can add one if a page needs it.

## What the editor preview approximates

The preview draws the page with the site's own stylesheets, the same classes and the same rows (in a post: `sectionsHtml(…, { layout: 'column' })`, the post's column, in the blog preview `preview.ts` and the simpler one of the other kinds, `post-preview.ts`). It is **not** the built page:

- the header and footer are not drawn, and the pane is narrower than a screen, so a portrait beside the text may sit above it;
- text is read by a simplified Markdown reader (headings, paragraphs, lists, bold, italic, code, links): the page reads all of Markdown;
- blocks that need the built site show a stand-in, and say so under themselves (`previewNote` in the definition): Latest posts, Latest feed, Pinned post, Apps row, GitHub stats row, Playable game, Video embed, Code block (no syntax colours), Lightbox gallery (no full-size window), Table of contents.

## The catalogue

Generated from the definitions: do not edit between the markers (see "Regenerating the catalogue").

<!-- catalogue:start (generated: see "Regenerating the catalogue") -->

### Text

#### Heading (`heading`)

A title for the part below it. One phrase in *asterisks* is set in italic brass, as in a page title.

Sits: In the reading column, with the other text blocks.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `text` | One line | yes | Sentence case, e.g. "How I work". Put one phrase in *asterisks* for the italic brass accent, e.g. "How I *work*". At most 120 characters. |
| `level` | Menu | no | A heading directly above a "Portrait and text" block sits beside the picture. Choices: `2`, `3`. Default `2`. |

```yaml
sections:
  - type: heading
    text: "A row of *text*"
    level: 2
```

#### Lead paragraph (`lead`)

The opening line of a page or section: larger and a little quieter than body text.

Sits: In the reading column, with the other text blocks.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `text` | Several lines (inline Markdown) | yes | One short paragraph, 400 characters at most. **bold**, *italic*, `code` and [links](/about/) work. At most 400 characters. |

```yaml
sections:
  - type: lead
    text: "A lead paragraph sets the scene in a sentence or two, with **bold** and a [link](/about/) if needed."
```

#### Text (`text`)

Paragraphs, bold, italic, links, lists and code, as Markdown. Raw HTML is removed.

Sits: In the reading column, with the other text blocks. In the editor preview: Text is read by a simplified Markdown reader (headings, paragraphs, lists, bold, italic, code, links). The page reads all of Markdown.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `text` | Markdown editor | yes | Paragraphs, **bold**, *italic*, links and lists. Leave a blank line between paragraphs. Use a Heading block for headings. |

```yaml
sections:
  - type: text
    text: |-
      Plain paragraphs, **bold**, *italic*, `inline code` and [a link](/about/).

      - a list item
      - another list item

      A second paragraph with a long unbroken address: https://example.com/a/very/long/path/that/keeps/going/and/going/and/going/for/a/while
```

#### Quote (`quote`)

A quotation in the text: brass rule on the left, display italic, with who said it.

Sits: In the reading column, with the other text blocks.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `text` | Several lines (Markdown) | yes | What was said. Markdown is fine. |
| `attribution` | One line | no |  |

```yaml
sections:
  - type: quote
    text: A short quotation, set in the display face.
    attribution: Someone Specific
```

#### Pull quote (`pullquote`)

A line from the text set large between two hairlines. Screen readers skip it (it repeats the text), so use Quote for words that appear nowhere else.

Sits: In the reading column, with the other text blocks.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `text` | Several lines | yes | A line that already appears in the text above, set large. Screen readers skip it so they do not read it twice: for words that appear nowhere else, use a Quote block. At most 200 characters. |
| `attribution` | One line | no | Optional. A few words under it, e.g. "From the post". |

```yaml
sections:
  - type: pullquote
    text: One good line, pulled out and set large.
    attribution: From the text above
```

#### Callout (`callout`)

A boxed aside: a note, a tip (brass) or a warning, told apart by the label as well as the colour.

Sits: In the reading column, with the other text blocks.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `kind` | Menu | no | Choices: `info`, `tip`, `warn`. Default `info`. |
| `title` | One line | no | Optional. Without one the box is labelled Note, Tip or Warning. |
| `text` | Several lines (Markdown) | yes | Markdown is fine. |

```yaml
sections:
  - type: callout
    kind: tip
    title: A tip with a title
    text: "Tips are brass. This one has **bold** in it."
```

#### Code block (`code`)

Highlighted code with a bar (file name or language) and a Copy button.

Sits: In the reading column, with the other text blocks. In the editor preview: The preview shows the code without syntax colours; the page highlights it.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `code` | Several lines | yes | Paste the code as it is. Indent with spaces. |
| `lang` | Menu | no | Sets the colours, and the label in the bar when there is no title. Choices: `text`, `bash`, `js`, `ts`, `json`, `css`, `html`, `astro`, `python`, `yaml`, `md`, `diff`, `sql`. Default `text`. |
| `title` | One line | no | Optional. Shown in the bar instead of the language, e.g. a file name. At most 60 characters. |

```yaml
sections:
  - type: code
    lang: bash
    title: Build the site
    code: |-
      npm install
      npm run build
```

### Pictures and video

#### Image (`image`)

A picture on its own with an optional caption: in the text, the width of the page, or edge to edge.

Sits: In the reading column when Narrow; in a row of its own the width of the page when Wide; edge to edge of the window when Full.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `image` | Picture: choose or upload | yes | A picture on its own. Your own image, not stock. Choose a file or upload one. |
| `alt` | One line | no | Needed unless the image is decorative (the preview warns you, and the build stops without it). Describe the image in one plain sentence, for someone who cannot see it. |
| `decorative` | Switch | no | Turn on only if the picture is purely ornamental and says nothing. Then alt text is left empty. Default `false`. |
| `caption` | One line | no | Optional. A line under the picture. |
| `width` | Menu | no | Narrow sits in line with the text. Wide and Full break out of it and start a new row. Choices: `narrow`, `wide`, `full`. Default `narrow`. |
| `align` | Menu | no | Left and Right put the text beside a smaller picture from 720px up. Wide and Full ignore this. Choices: `center`, `left`, `right`. Default `center`. |
| `size` | Menu | no | Wide and Full ignore this. Choices: `lg`, `md`, `sm`. Default `lg`. |

```yaml
sections:
  - type: image
    image: /media/about/hunter-newton.jpg
    alt: A portrait, narrow
    caption: A narrow image has a caption.
    width: narrow
```

#### Image row (`image-row`)

Two or three pictures side by side, each with its own caption, one column on a phone.

Sits: In a row of its own, the width of the page. It ends a picture-beside-text row.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `images` | List of rows (2 to 3) | yes | Two or three pictures, in order. |
| `images[].image` | Picture: choose or upload | yes | Your own image, not stock. |
| `images[].alt` | One line | no | Needed unless the image is decorative (the preview warns you, and the build stops without it). Describe the image in one plain sentence, for someone who cannot see it. |
| `images[].decorative` | Switch | no | Turn on only if the picture is purely ornamental and says nothing. Then alt text is left empty. Default `false`. |
| `images[].caption` | One line | no |  |
| `caption` | One line | no | Optional. Shown under the row. |

```yaml
sections:
  - type: image-row
    images:
      - image: /media/about/hunter-newton.jpg
        alt: The portrait, in a row of two
        caption: The first.
      - image: /og-default.png
        alt: The brand image, in a row of two
        caption: The second.
    caption: A caption for the whole row.
```

#### Lightbox gallery (`gallery`)

A grid of thumbnails; each opens full size in a dialog with previous and next. Every picture needs alt text.

Sits: In a row of its own, the width of the page. It ends a picture-beside-text row. In the editor preview: The thumbnails are drawn; clicking one does not open the full-size dialog in the preview.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `label` | One line | no | Optional. Read out by screen readers for the full-size window, e.g. "Screenshots". At most 60 characters. |
| `shots` | List of rows (1 to 24) | yes | One row per picture, in order. |
| `shots[].image` | Picture: choose or upload | yes | Your own image, not stock. |
| `shots[].alt` | One line | yes | Describe the image for someone who cannot see it. Every gallery picture needs it. At most 300 characters. |
| `shots[].caption` | One line | no |  |

```yaml
sections:
  - type: gallery
    label: Fixture photos
    shots:
      - image: /media/about/hunter-newton.jpg
        alt: A portrait, in the gallery
        caption: The first.
      - image: /og-default.png
        alt: The brand image, in the gallery
        caption: The second.
```

#### Portrait and text (`portrait`)

A picture in a side column beside the text (above it on a phone). The blocks after it stay beside it until a divider, a wide or full image, or another portrait.

Sits: A picture in a side column with the text beside it; the blocks after it stay beside it until a divider, a block that leaves the column, or another portrait.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `image` | Picture: choose or upload | yes | A portrait or other upright picture, shown beside the text (above it on a phone). Your own image, not stock. Choose a file or upload one. |
| `alt` | One line | no | Needed unless the image is decorative (the preview warns you, and the build stops without it). Describe the portrait in one plain sentence, for someone who cannot see it. |
| `decorative` | Switch | no | Turn on only if the picture is purely ornamental and says nothing. Then alt text is left empty. Default `false`. |
| `side` | Menu | no | Choices: `left`, `right`. Default `left`. |
| `text` | Markdown editor | yes | Shown beside the picture. The blocks after this one (headings, text and so on) stay beside it too, until a Divider, a Wide or Full image, or another Portrait ends the row. |

```yaml
sections:
  - type: portrait
    image: /media/about/hunter-newton.jpg
    alt: A portrait, on the right
    side: right
    text: The text beside the picture. The blocks after it stay in this column.
```

#### Video embed (`video`)

A YouTube video that loads only when the reader presses play, with optional poster, chapters and caption.

Sits: In the reading column, with the other text blocks. In the editor preview: The preview shows the player as it looks before play; nothing is requested from YouTube.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `youtubeId` | One line (checked) | yes | The 11 characters after v= in the video address (youtube.com/watch?v=dQw4w9WgXcQ), not the whole link. The video loads only when a reader presses play. |
| `title` | One line | yes | Names the player for screen readers: "Play video: …". At most 120 characters. |
| `poster` | Picture: choose or upload | no | The still shown before play. 16:9, at least 1280px across. Your own image, not stock. Without one the player shows the placeholder. |
| `duration` | One line (checked) | no | Optional. Minutes and seconds, e.g. 12:48, shown on the player. |
| `chapters` | List of rows (0 to 30) | no | Optional. One line per chapter, in order. |
| `chapters[].t` | One line (checked) | yes | m:ss, e.g. 5:15 |
| `chapters[].title` | One line | yes | At most 120 characters. |
| `caption` | One line | no | Optional. A line under the video. |

```yaml
sections:
  - type: video
    youtubeId: dQw4w9WgXcQ
    title: A fixture video
    duration: "3:32"
    chapters:
      - t: "0:00"
        title: Start
      - t: "1:10"
        title: The middle
    caption: Nothing is requested from YouTube until you press play.
```

#### Playable game (`game`)

A browser game on its own address, loaded only when the reader presses Play (a sandboxed frame), or a plain button that opens it in a new tab. An embedded game's address must be allowed by frame-src in public/_headers.

Sits: In a row of its own, the width of the page. It ends a picture-beside-text row. In the editor preview: The preview shows the Play button; the game itself loads only on the page.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `title` | One line | yes | Plain text. Used on the Play button and to name the frame for screen readers. At most 80 characters. |
| `playUrl` | One line (checked) | yes | Where the game runs, e.g. https://vesper.r7orbit.io/. https only. To embed it, its address must be listed in frame-src in public/_headers: the build stops with a message if it is not. |
| `playMode` | Menu | no | Choices: `embed`, `link`. Default `embed`. |
| `playAspect` | One line (checked) | no | Width:height of the game frame, e.g. 16:9 or 4:3. Only used when the game is embedded. Default `16:9`. |
| `poster` | Picture: choose or upload | no | The still shown before Play. Optional; without one the placeholder is shown. |
| `playNote` | One line | no | One short line shown with the game, e.g. Best on desktop with a mouse. At most 120 characters. |
| `platforms` | Several choices | no | Where the game works, shown as small labels with it. Choices: `desktop`, `mobile`. |
| `controls` | List of rows (0 to 20) | no | The controls legend under the game, one row per input. |
| `controls[].key` | One line | yes | e.g. Space, W / Up arrow, Mouse. At most 40 characters. |
| `controls[].action` | One line | yes | e.g. Fire, Steer, Pause. At most 80 characters. |

```yaml
sections:
  - type: game
    title: Vesper Drift
    playUrl: "https://vesper.r7orbit.io/"
    playMode: embed
    playAspect: "4:3"
    playNote: Best on desktop with a mouse
    platforms: [desktop]
    controls:
      - key: W / Up arrow
        action: Thrust
      - key: Space
        action: Fire
```

### Layout

#### Two columns (`columns`)

Two Markdown columns side by side from 720px up, stacked on a phone. Each column is Markdown text (a column cannot hold other blocks: Decap's nested block lists are too clumsy to edit with).

Sits: In a row of its own, the width of the page. It ends a picture-beside-text row. In the editor preview: The columns are drawn with a simplified Markdown reader.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `ratio` | Menu | no | Choices: `1:1`, `2:1`, `1:2`. Default `1:1`. |
| `reverse` | Switch | no | When the columns stack, put the right one on top. Default `false`. |
| `left` | Markdown editor | yes | Paragraphs, **bold**, *italic*, links and lists. Leave a blank line between paragraphs. |
| `right` | Markdown editor | yes | Paragraphs, **bold**, *italic*, links and lists. Leave a blank line between paragraphs. |

```yaml
sections:
  - type: columns
    ratio: "2:1"
    left: |-
      The **left** column, twice as wide.

      A second paragraph.
    right: |-
      The *right* column, with a list:

      - one
      - two
```

#### Divider (`divider`)

A break between parts of the page: a hairline or three brass dots. It also ends a picture-beside-text row.

Sits: In the reading column, with the other text blocks.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `style` | Menu | no | A break between parts of the page. Choices: `rule`, `dots`. Default `rule`. |

```yaml
sections:
  - type: divider
    style: dots
```

#### Spacer (`spacer`)

Empty space between two blocks, when the usual spacing is too tight.

Sits: In the reading column, with the other text blocks.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `size` | Menu | no | Choices: `sm`, `md`, `lg`. Default `md`. |

```yaml
sections:
  - type: spacer
    size: md
```

### Links and buttons

#### Links list (`links`)

A bordered list of links, each with an optional short note; an address on another site gets the external icon.

Sits: In the reading column, with the other text blocks.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `items` | List of rows (1 to 20) | yes | One row per link, in order. |
| `items[].label` | One line | yes | What the link says, e.g. "My YouTube channel". At most 120 characters. |
| `items[].url` | One line (checked) | yes | https://… for another site, or /about/ for a page on this site. |
| `items[].note` | One line | no | Optional. A few words shown at the end of the row, e.g. "video". |

```yaml
sections:
  - type: links
    items:
      - label: A page on this site
        url: /about/
      - label: Another site, with a note
        url: "https://example.com/"
        note: video
```

#### Button (`button`)

A solid button that links to a page of this site or to another site.

Sits: In the reading column, with the other text blocks.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `label` | One line | yes | Short, e.g. "Read more". At most 40 characters. |
| `url` | One line (checked) | yes | https://… for another site, or /about/ for a page on this site. |

```yaml
sections:
  - type: button
    label: A button to another site
    url: "https://example.com/"
```

### From the site

#### Table of contents (`toc`)

A list of links to the headings on this page (Heading blocks, and ## headings inside Text blocks). Adding one gives every heading an anchor.

Sits: In the reading column, with the other text blocks. In the editor preview: Built from the Heading blocks and the ## headings in Text blocks as typed; the page reads the finished headings.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `title` | One line | no | Optional. Over the list; "On this page" if left empty. At most 60 characters. |
| `maxDepth` | Menu | no | Choices: `2`, `3`. Default `3`. |

```yaml
sections:
  - type: toc
    title: On this page
    maxDepth: 3
```

#### GitHub stats row (`stats`)

The language, stars, forks and last update of a public GitHub repository, fetched when the site is built (never in the reader's browser). Without a network the row falls back to a plain link.

Sits: In the reading column, with the other text blocks. In the editor preview: The numbers are fetched from GitHub when the site is built, so the preview shows a stand-in.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `repo` | One line (checked) | yes | owner/name of a public repository. |

```yaml
sections:
  - type: stats
    repo: EOSHunter/r7-orbit-site
```

#### Latest posts (`latest`)

The newest published posts as cards, filtered by kind, tag and/or author: in the page, or as a section of its own with a rule above it (the Projects and Repos rows of the home page). Drafts and future-dated posts are left out, as everywhere else.

Sits: In a row of its own, the width of the page, when the frame is "In the page" (it ends a picture-beside-text row); a full-width section with its own spacing when the frame is "A section of its own". In the editor preview: The posts are chosen when the site is built, so the preview shows what the block will pick, not the cards.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `eyebrow` | One line | no | Optional. A small line above the heading, e.g. "Open source". At most 60 characters. |
| `heading` | One line | no | Optional. Put one phrase in *asterisks* for the italic brass accent. At most 80 characters. |
| `kinds` | Several choices | no | Which kinds of post. Choose none for every kind. Choices: `news`, `blog`, `vlog`, `project`, `repo`. |
| `tag` | One line (checked) | no | Optional. Only posts with this tag, written as the posts write it, e.g. ai-agents. The build stops if no post has it. |
| `author` | Menu of the authors | no | Optional. Only posts credited to this author. |
| `count` | Number | no | Between 1 and 12. Default `3`. 1 to 12. |
| `order` | Menu | no | Last updated first suits repos: a repo with no GitHub data counts from the date of its entry. Choices: `newest`, `updated`. Default `newest`. |
| `look` | Menu | no | Choices: `plain`, `section`. Default `plain`. |
| `moreLabel` | One line | no | Optional. A link at the end of the heading row, e.g. "All projects". It shows only when both its text and its address are filled in. At most 40 characters. |
| `moreUrl` | One line (checked) | no | https://… for another site, or /about/ for a page on this site. |
| `ifEmpty` | Menu | no | Choices: `say`, `hide`. Default `say`. |

```yaml
sections:
  - type: latest
    heading: "The *latest* posts"
    kinds: []
    count: 3
    moreLabel: Everything
    moreUrl: /latest/
```

#### Latest feed (`feed`)

The newest posts of every kind with a filter by kind (links to each kind's archive when JavaScript is off) and a link to everything (the Latest section of the home page). Its anchor is #latest, so a button can point at it; one per page.

Sits: A full-width section with its own spacing, in a row of its own. In the editor preview: The posts, the kind filter and the archive links are made from the posts when the site is built, so the preview shows a stand-in.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `heading` | One line | yes | e.g. Latest. Put one phrase in *asterisks* for the italic brass accent. At most 80 characters. |
| `count` | Number | no | Between 1 and 12. The newest is marked New. Default `8`. 1 to 12. |
| `emptyHeading` | One line | yes | Shown instead of the cards while the site has no posts at all. At most 100 characters. |
| `emptyText` | Several lines | no | Optional. A sentence under that heading. At most 300 characters. |
| `browseLabel` | One line | no | Optional. The small title over the links to each kind's archive (only kinds with posts get a link), e.g. Browse by kind. They stand in for the kind filter when JavaScript is off, so most readers never see them. Leave it empty for no links. At most 60 characters. |
| `moreLabel` | One line | no | Optional. A link at the end of the heading row, e.g. "Browse everything". It shows only when both its text and its address are filled in. At most 40 characters. |
| `moreUrl` | One line (checked) | no | https://… for another site, or /about/ for a page on this site. |

```yaml
sections:
  - type: feed
    heading: Latest
    count: 8
    emptyHeading: Nothing is posted yet.
    browseLabel: Browse by kind
    moreLabel: Browse everything
    moreUrl: /latest/
```

#### Pinned post (`pinned`)

The post marked Featured (the newest, if several are), as a large card. Left out when no post is featured, or when only one post is published (the latest posts already show it).

Sits: A full-width section with its own spacing, in a row of its own. In the editor preview: The featured post is chosen when the site is built, so the preview shows a stand-in.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `eyebrow` | One line | no | Optional. A small line above the heading, e.g. "Open source". At most 60 characters. |
| `heading` | One line | yes | e.g. Start here. Put one phrase in *asterisks* for the italic brass accent. At most 80 characters. |

```yaml
sections:
  - type: pinned
    eyebrow: Pinned
    heading: Start here
```

#### Apps row (`apps`)

The first published apps and games (projects with a Play address), in the order of the Apps page, as cards with their type and a Play or Open button. Left out while none is published.

Sits: A full-width section with its own spacing, in a row of its own. In the editor preview: The apps are chosen when the site is built, so the preview shows a stand-in.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `eyebrow` | One line | no | Optional. A small line above the heading, e.g. "Open source". At most 60 characters. |
| `heading` | One line | yes | e.g. Apps. Put one phrase in *asterisks* for the italic brass accent. At most 80 characters. |
| `count` | Number | no | Between 1 and 12. Default `3`. 1 to 12. |
| `moreLabel` | One line | no | Optional. A link at the end of the heading row, e.g. "All apps". It shows only when both its text and its address are filled in. At most 40 characters. |
| `moreUrl` | One line (checked) | no | https://… for another site, or /about/ for a page on this site. |

```yaml
sections:
  - type: apps
    eyebrow: Play in the browser
    heading: Apps
    count: 3
    moreLabel: All apps
    moreUrl: /apps/
```

#### Author box (`author`)

An author's avatar, name (a link to their page), the "AI-written" label for an agent, and their bio, read from the authors list.

Sits: In the reading column, with the other text blocks.

| Field | Box | Required | Notes |
| --- | --- | --- | --- |
| `author` | Menu of the authors | yes | Who to show. The name, bio and photo come from the Authors list. |

```yaml
sections:
  - type: author
    author: hunter-newton
```

<!-- catalogue:end -->

## Adding a block

A block is **one definition** plus the two drawings the browser and Astro cannot share with it. TypeScript and the tests name what is missing.

1. **Define it** in `src/lib/sections/definitions.ts`: `defineBlock('my-block', { label, group, description, summary, placement, example }, { …fields })`. Build each field with the helpers of `src/lib/sections/fields.ts` (`text`, `pattern`, `link`, `image`, `pictureAlt`, `choice`, `choices`, `flag`, `count`, `list`): they give the schema its rules and the form its label, hint, box and choices. Add the block to the `definitions` array in the order of the "Add section" menu (grouped by `group`). A rule across fields (alt text) is a `refine` function, the fourth argument. Give it a complete `example`: the fixture page, this catalogue and the tests draw from it.
2. **Draw it on the page**: create `src/components/sections/MyBlockBlock.astro` (`<Id>Block.astro`, the id in PascalCase). It takes `{ block, ctx }`: `ctx.html` holds the block's Markdown boxes already rendered and sanitised (any field made with `widget: 'markdown'` or a `format`), `ctx.sizes` the size of every picture (from any `image` field), `ctx.where` the start of an error message ("about.md, block 3 (My block)"). Wrap an existing component rather than copying it; if the component's shape differs, give it an optional prop. Register it in `src/components/sections/registry.ts`.
3. **Draw it in the preview**: add an entry to `PREVIEW` in `src/admin/sections-html.ts` (a function of the block that returns HTML with the same classes). If it differs from the page, set `previewNote` in the definition.
4. **Check**: `npm run check` (a missing registry or preview entry is a type error), `npm run test:unit` (`library.vitest.ts` names any missing piece; the drift test compares the form with the schema; the catalogue test fails until you regenerate it), then `npm run build` and `npm run test:e2e` (the fixture page `/styleguide/sections/` already draws the new block, and `tests/admin-sections.spec.js` adds it in the editor).
5. **Regenerate this catalogue**: see the next section.

## Regenerating the catalogue

```
UPDATE_SECTIONS_DOC=1 npx vitest run src/lib/sections/sections-docs
```

## Attaching the library to a collection (later tasks)

- **Schema**: `import { sectionsSchema } from './lib/sections'` and add `sections: sectionsSchema` to the collection's schema. It is optional (a file without it reads as an empty list).
- **Form**: `import { sectionsField } from './sections-config'` (in `src/admin/`) and put `sectionsField()` in the collection's fields (`name`, `label` and `hint` can be set).
- **Page**: `<Sections sections={entry.data.sections} source="the-file.md" />`.
- **Preview**: `aboutPreview` in `src/admin/about-preview.ts` is the page preview; register it under the collection's preview name in `src/admin/main.ts`. The home page and the listing pages use `pagePreview` (`src/admin/page-previews.ts`), which draws the hero or page head and puts a labelled stand-in where the list goes. (Posts already have theirs: `preview.ts` and `post-preview.ts`.)
- **Anything that reads the body** (a word count, a heading list, an export) goes through `src/lib/sections-to-content.ts`, not the Markdown.
- **Tests**: add the route to `tests/routes.js`; `/styleguide/sections/` already covers every block.
