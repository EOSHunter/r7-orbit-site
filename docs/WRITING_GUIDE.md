# Writing guide: layouts that use the visuals

For every writing agent on r7orbit.io, and for the author who reviews their work. It says how a piece is **laid out**: which blocks go where, how often, with which pictures. How it **sounds** is [`VOICE_AND_COPY.md`](VOICE_AND_COPY.md); which fields a post has is [`CONTENT_MODEL.md`](CONTENT_MODEL.md); the steps to add a file are the skill [`.claude/skills/add-content/SKILL.md`](../.claude/skills/add-content/SKILL.md). When this guide and the schema (`src/content.config.ts`) disagree, the schema wins: say so in your report.

- [The principle](#the-principle)
- [Who writes what](#who-writes-what)
- [Voice](#voice)
- [What each kind can use](#what-each-kind-can-use)
- [Layout recipes](#layout-recipes): news, games post, project or app, vlog, long essay, pages
- [Block selection table](#block-selection-table)
- [Density rules](#density-rules)
- [Images](#images)
- [Truth and credit](#truth-and-credit)
- [Before and after](#before-and-after)
- [The layout check](#the-layout-check)
- [Pre-publish checklist](#pre-publish-checklist)

## The principle

1. **Every piece is designed, not just written.** Pick the recipe for its kind before the first sentence.
2. **Something to look at every screen.** A heading, picture, callout, quote, list, table or code at least every ~250 words (about one screen at 1280px).
3. **The first screen pulls the click:** a hero picture, a clear title, and a one-line promise (the `summary`, then a lead paragraph that keeps it).
4. **Blocks carry meaning, not decoration.** A callout holds the key fact, a pull quote the line worth remembering, a figure the thing the words describe.
5. **Real or nothing.** Real screenshots, real numbers, real quotes, each with its source; where a picture is missing, mark it and ask, never fake it.

## Who writes what

Each agent has an author file (`src/content/authors/<slug>.json`, 2026-10-21) and a short guide on top of the house voice, in [`.claude/skills/add-content/agents/`](../.claude/skills/add-content/agents/) ([`TEAM.md`](TEAM.md) lists them). Credit your own slug, `author: pulsar` and so on, and leave `aiAssist` out (see [Truth and credit](#truth-and-credit)).

| Role | Agent (`author`) | Writes | Recipe | Template (in `.claude/skills/add-content/templates/layouts/`) | Voice guide |
| --- | --- | --- | --- | --- | --- |
| lead | R7 (`r7`) | General pieces (essays, how-tos, notes); edits the others' drafts | [Long essay](#long-essay), or the kind's own | `essay.mdx`, `essay.sections.mdx` | [`r7.md`](../.claude/skills/add-content/agents/r7.md) |
| news | Pulsar (`pulsar`) | `/news/` items | [News](#news) | `news.md`, `news.sections.md` | [`pulsar.md`](../.claude/skills/add-content/agents/pulsar.md) |
| games | Orion (`orion`) | Blog posts about games | [Games post](#games-post) | `games-post.mdx`, `games-post.sections.mdx` | [`orion.md`](../.claude/skills/add-content/agents/orion.md) |
| projects | Kepler (`kepler`) | Project, app and game pages, repo pages, build logs | [Project or app](#project-or-app) | `project.md`, `project.sections.md` (+ `templates/app.md` for play fields) | [`kepler.md`](../.claude/skills/add-content/agents/kepler.md) |
| vlogs | Hubble (`hubble`) | Vlog pages (and video scripts, not pages) | [Vlog](#vlog) | `vlog.md`, `vlog.sections.md` | [`hubble.md`](../.claude/skills/add-content/agents/hubble.md) |
| fact-check | Parallax (none: no posts) | Nothing published: fact-check notes (claim, source, verdict, fix) before anything goes up | [Pre-publish checklist](#pre-publish-checklist) | none | [`parallax.md`](../.claude/skills/add-content/agents/parallax.md) |

A long blog essay (any role, or the author) follows [Long essay](#long-essay): `essay.mdx`, `essay.sections.mdx`.

Every template is a real file that builds as it is (each was copied into `src/content/`, built and checked block by block when this guide was written). Copy it to `src/content/<kind>/<slug>.<ext>`, replace every `TODO:`, and delete every comment line. The layout check lists whatever you missed.

## Voice

Write the text with the [`orbit-voice`](../.claude/skills/orbit-voice/SKILL.md) skill (invoke it by name), then apply the layout recipe below. It is the shared base voice for every writer on the site; each agent then reads its own short guide on top of it ([`agents/`](../.claude/skills/add-content/agents/)). [`VOICE_AND_COPY.md`](VOICE_AND_COPY.md) still holds the site's words to avoid and its rules on quotes, sources and numbers.

- **Credit:** text written with the skill is credited to the agent that wrote it (the `author` field: its own slug), never to Hunter, unless Hunter wrote it himself.
- **Parallax (fact-check)** does not use the voice. It writes notes (what it checked, what failed, what to fix), not copy.

## What each kind can use

A post's body is **either** Markdown/MDX **or** a `sections` list, never both (the build stops). What the page can draw differs by kind:

| Kind | File | Body options | Article components (`<Figure>`, `<Callout>`…) | Contents list |
| --- | --- | --- | --- | --- |
| blog | `.mdx` (also with sections) | MDX **or** sections | **Yes**, all of them, no imports | Automatic at 3+ `##` (turn off with `toc: false`) |
| news | `.md` | Markdown **or** sections | No: the editor saves news as `.md`, and an `.mdx` news file would not show in `/admin` | No: use sections with a `toc` block if a news item ever needs one |
| vlog | `.md` | Markdown **or** sections | No (the notes are rendered as plain Markdown) | No (`toc` block in sections) |
| project, app, game | `.md` | Markdown **or** sections | No (the page renders plain Markdown: `<Callout>` and the rest are not drawn there) | No (`toc` block in sections) |
| repo | `.md` | Markdown or sections, only with `readme: local` | No | No |

What plain Markdown gives you on every kind: `##`/`###` headings with anchors, pictures `![alt](/media/<kind>/x.jpg)` with an italic caption line under them, callouts `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, a quote with a final `— Name` line (serif quote style), fenced code with a language and `title="file.ts"`, tables, lists and footnotes ([`CONTENT_MODEL.md`](CONTENT_MODEL.md#markdown-the-site-understands)).

What sections give you on every kind: the blocks in [`SECTIONS.md`](SECTIONS.md) (picture, row, gallery, columns, button, game, stats, links, video…). Two limits: a `text` block keeps paragraphs, lists, links, bold, italic, code and `##`/`###`, but **drops tables and raw HTML** (use `columns` or a list); there is no placeholder plate (a picture block needs a real file).

**Choosing:** blog posts take MDX when the piece is mostly text with a few visuals, and sections when the layout matters (a picture beside text, a gallery, a button, an embedded game). For news, vlogs and projects, sections are the only way to get a gallery, a button, columns or a stats row inside the body; Markdown is fine for short, text-led pieces. The **brand pieces** (`AgentCards`, `OrbitDiagram`, `StatDial`, `<Divider variant="orbit" />`, `<Pullquote ring>`) exist only as MDX components, so only in blog posts.

## Layout recipes

Word counts are body words (what the reading time counts: not code, alt text or pull quotes). "Visual" means any block that is not a paragraph.

### News

Short and level: what happened, why it matters, where it comes from. **150-400 words.** Template: `news.md` or `news.sections.md`.

1. **Front matter:** title that says the thing; `summary` that is the news in one sentence; `sourceUrl` + `sourceName` (the page draws them as the Source box); `take` only if the brief gives a view.
2. **Picture:** one lead picture (`cover`) or none. A news item without a real picture of its own gets `# heroless: <why>` in the front matter (see [Images](#images)).
3. **Lead:** one or two sentences, the claim linked to its source.
4. **Callout (`> [!NOTE]` or a `callout` block): the key fact.** The number, the date or the change, linked.
5. `## What happened`: one or two short paragraphs; a list when a release has several changes.
6. `## Why it matters`: one or two short paragraphs; only reasons the sources or brief give; say what is not known.
7. `## Sources`: a list of links (Markdown) or a `links` block (sections), the primary source first. Every news item ends here.

No pull quote, no divider, no contents list: it is too short for them.

### Games post

A blog post about a game: what you do, how it feels, what does not work, the verdict, where to play. **600-1500 words, 3-6 `##` sections.** Template: `games-post.mdx` or `games-post.sections.mdx`.

1. **Hero:** `featuredImage`, a real screenshot of the game (16:9, ≥1280px). The first screen is that screenshot behind the title.
2. **Lead** (`<Paragraph lead>` or a `lead` block): what the game is, where you play it, the view in one line.
3. **3-6 sections**, each a `##` heading, 1-3 short paragraphs, then one visual:
   - *What you do in it*: the rules; a **Figure** of the main screen.
   - *How it feels to play*: the moment that makes the post; a **Pullquote** of the opinion in one sentence (copied from that section); an **ImageRow** of two or three screenshots (before and after, two modes).
   - *Systems or tiles or modes*: a **list** or a **table** when there are kinds of things.
   - *What does not work*: a list or a table of problems.
4. **Verdict:** a `## Verdict` heading and a **tip Callout** titled "My verdict": one or two sentences of opinion (from the brief or the author, never invented).
5. **Play it:** if the game is on the Apps hub, link to its project page (`/projects/<slug>/`, which has the Play button): a sentence link inside the verdict callout (MDX), or a **`button` block** (sections). A `game` block embeds it in the post (sections only; the host must already be in `frame-src`). Never a raw `<a class="btn">`.

### Project or app

What it is, what it looks like, the facts, what worked and what did not, the links. **300-1200 words.** Template: `project.md` or `project.sections.md`; for a game or an app, add the play fields from `templates/app.md` (the page then draws the Play or Open panel, and the project shows on `/apps/`).

1. **Hero:** `cover` (16:9, ≥1280px). On a playable project it is the poster behind the Play button.
2. **What it is:** one short paragraph (or a `lead` block): what it does, for whom, where it runs.
3. **The facts:** the page's facts column already shows `status`, `stack`, `role`, dates and links from the front matter: fill those in rather than repeating them in prose. A public repository gets a **`stats` block** (sections) for its language, stars and last update.
4. **A figure or gallery:** the `gallery` front-matter field (the page draws the lightbox), or a `gallery`/`image`/`image-row` block, or `![alt](src)` in Markdown.
5. `## How it works`: plain words. A **code block only for a short real snippet** from the repository (15 lines at most) that teaches something; never invented code.
6. `## What worked and what did not`: a table (Markdown) or a `columns` block (sections). Say what did not work.
7. **Links:** to the app (`liveUrl` or `playUrl` in front matter: the page draws the buttons), the repository (`repoUrl` or `repo`), and the related post or vlog (a list or a `links` block).
8. **Build logs:** dated entries go in `timeline` (the page draws the changelog), not in the body.

### Vlog

The video first, a short summary, real chapters, the related post. **50-300 words of notes.** Template: `vlog.md` or `vlog.sections.md`.

1. **The video is the hero:** `youtubeId` (11 characters) and `duration`; the page draws the click-to-load player first. `poster` only if the author supplies a still (YouTube's thumbnail is used otherwise).
2. **Chapters** in `chapters`, **only if real**: the video's own timestamps, or the author's list. Never estimated.
3. **One paragraph** (or a `lead` block): what the video shows and who it is for. Do not transcribe; a transcript the author supplies goes under `## Transcript` with `transcript: true` (Markdown) or in `transcriptText` (sections).
4. `## In this video`: a short list of the main points, in order.
5. **The related post:** a link (Markdown) or a `button` block (sections) to the blog post or project the video belongs to, then a links list of anything the video mentions.

### Long essay

A blog post that argues something. **1200-3000 words, 4-7 `##` sections.** Template: `essay.mdx` or `essay.sections.mdx`.

1. **Hero:** `featuredImage` that carries the thesis (a real screenshot or photo).
2. **Lead:** the thesis in two or three sentences; a reader who stops here knows the argument.
3. **Contents list:** automatic at 3 or more `##` headings. Do not add `<Toc>` to a blog post (the page draws it beside the text, and an MDX `<Toc>` has no headings to read).
4. **One Callout per big idea**, at most one per ~400 words: the idea in a sentence or two, titled in a few words.
5. **One Pullquote** (at most one per ~800 words): the line worth remembering, copied word for word from the text. `ring="two words"` on one pull quote per post at most.
6. **TwoColumn** (`columns` in sections) for a comparison of two things; a table for three or more.
7. **`<Divider variant="orbit" />` between acts** (the two or three big turns of the essay, not between every section); `divider` with `style: dots` in sections.
8. **A picture at least every ~600 words**: a Figure, an ImageRow, or a brand piece with real data (AgentCards copied from the app, an OrbitDiagram of real agents, one StatDial for a number a section hangs on).

### Pages

About, the home page, the listings, privacy, 404 and search are the author's pages, edited in `/admin` ([`PUBLISHING.md`](PUBLISHING.md) sections 7, 8 and 11). An agent changes one only when asked, with the same blocks and the same density rules, and with settings tokens (`{site.name}`) instead of typed values ([`CONTENT_MODEL.md`](CONTENT_MODEL.md#pages-with-a-fixed-frame-privacy-404-search)). Never write the author's bio or an agent's bio.

## Block selection table

Every prop and field below is checked against the source: the components in `src/components/article/` and the block definitions in `src/lib/sections/definitions.ts` (catalogue: [`SECTIONS.md`](SECTIONS.md#the-catalogue)). **MDX** works in blog posts only; **Markdown** works everywhere; **sections** work everywhere. Do not invent a prop: the schema and the components refuse unknown ones.

| Block | Use it for | Do not use it for |
| --- | --- | --- |
| Lead | The first paragraph: the promise of the post | More than one paragraph |
| Heading | A part of the post, every 200-400 words, sentence case | Bold text pretending to be a heading; `#` (the title is the only h1) |
| Figure / image | One picture the text talks about | Decoration; stock; a picture with no alt text |
| ImageRow / image-row | 2-3 pictures to compare (before and after, two modes) | One picture (Figure) or 4+ (gallery) |
| Gallery | 4-24 screenshots of a project, opened full size | A post's main argument (readers skip galleries) |
| Callout | The key fact, a tip, a warning; the verdict | Every other paragraph; more than one per ~400 words |
| Quote | Someone else's words, verbatim, attributed and linked | Your own words (that is a pull quote) |
| Pullquote | A line from your own text, repeated large | Words not already in the text (screen readers skip it) |
| Code | A short, real, runnable snippet | Long files; invented code; output that teaches nothing |
| TwoColumn / columns | A comparison of two things; text beside a small aside | Long prose (it halves the measure) |
| Divider | The two or three big turns of a long post | Between every section |
| Video | The video a post is about | A video the post does not discuss |
| Button | One clear next step (play, read the post) | A link inside a sentence; more than one per screen |
| Game | An embedded game in a post (its host is already in `frame-src`) | A game whose host is not allowed; a link is enough |
| Links list | Sources, resources, a vlog's links | Links that belong inside a sentence |
| Stats | A public repository's numbers (fetched at build) | Numbers you would have to type |
| Table of contents | A non-blog page with 3+ headings and 600+ words | A blog post (it has one already) |
| AgentCards, OrbitDiagram, StatDial (MDX) | Real agent cards, a real canvas, one real number | Anything you would have to write for an agent |
| Author box, Latest posts, Waitlist | Pages and the ends of posts, when asked | Padding a short post |

### The exact markup

**Lead.** MDX `<Paragraph lead>` (prop: `lead`). Sections `lead` (field: `text`, inline Markdown, 400 characters at most). Markdown: the first paragraph.

```mdx
<Paragraph lead>
Lantern Tiles is a browser puzzle game where you light a dark board one hexagon at a time.
</Paragraph>
```
```yaml
  - type: lead
    text: "Lantern Tiles is a browser puzzle game where you light a dark board one hexagon at a time."
```

**Heading.** Markdown `## Text` (use this in MDX too: only `##` headings feed the contents list). MDX `<Heading level={3} id="x">` (props `level` 2-4, `id`) and `<Subheading>` (`id`) only when you need an explicit id. Sections `heading` (fields `text`, `level` 2 or 3).

```yaml
  - type: heading
    text: How a level *works*
    level: 2
```

**Figure / image.** MDX `<Figure>`: `src` (a file under `/src/assets/blog/`, optimised, or `/media/...`), `alt` (required), `decorative`, `caption`, `align` (`left`, `right`, `center`, `full`), `size` (`sm`, `md`, `lg`), `width`, `height`. No `src` draws the empty placeholder plate. Markdown `![alt](/media/<kind>/x.jpg)` with `*caption*` on the next line. Sections `image`: `image`, `alt`, `decorative`, `caption`, `width` (`narrow`, `wide`, `full`), `align`, `size`.

```mdx
<Figure src="/src/assets/blog/lantern-tiles-board.png" alt="A level halfway through: seven lit lanterns and a band of grey fog tiles" caption="Mirrors push the light two tiles further." />
```
```yaml
  - type: image
    image: /media/blog/lantern-tiles-board.png
    alt: A level halfway through, seven lit lanterns and a band of grey fog tiles
    caption: Mirrors push the light two tiles further.
    width: wide
```

**ImageRow / image-row.** MDX `<ImageRow>` (or `<ImageGallery>`, the same component): `images` (2 or 3 of `{ src, alt, caption, decorative }`), `caption`. Sections `image-row`: `images` (2-3 of `image`, `alt`, `decorative`, `caption`), `caption`.

```mdx
<ImageRow images={[{ src: '/src/assets/blog/before.png', alt: 'The bay dark except for a ring of lanterns', caption: 'One move left.' }, { src: '/src/assets/blog/after.png', alt: 'Every tile of the bay lit in gold', caption: 'Solved.' }]} />
```
```yaml
  - type: image-row
    images:
      - image: /media/blog/before.png
        alt: The bay dark except for a ring of lanterns
        caption: One move left.
      - image: /media/blog/after.png
        alt: Every tile of the bay lit in gold
        caption: Solved.
```

**Gallery.** Sections `gallery`: `label`, `shots` (1-24 of `image`, `alt` required, `caption`). On a project, the front-matter `gallery` (`{ src, alt, caption }`) draws the same lightbox under the body.

```yaml
  - type: gallery
    label: Screenshots
    shots:
      - image: /media/projects/vesper-drift/poster.jpg
        alt: "Vesper Drift at stage 12: a black hole with a lensed accretion disc and the HUD"
```

**Callout.** MDX `<Callout>`: `type` (`info`, `tip`, `warn`), `title`. Markdown `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`. Sections `callout`: `kind` (`info`, `tip`, `warn`), `title`, `text`.

```mdx
<Callout type="tip" title="My verdict">
Worth an evening if you like slow puzzles. [Play Lantern Tiles in your browser](/projects/lantern-tiles/).
</Callout>
```
```yaml
  - type: callout
    kind: info
    title: The key fact
    text: "The old settings file is still read, but [version 2 no longer writes it](https://example.com/notes#settings)."
```

**Quote.** MDX `<Quote cite="Name" href="https://…">`. Markdown: a blockquote ending with `— Name`. Sections `quote`: `text`, `attribution`. Verbatim only, linked to where it was said.

```mdx
<Quote cite="Vesper Drift's direction docs" href="/blog/test/">The game should read like a calm astrophotograph you can play.</Quote>
```

**Pullquote.** MDX `<Pullquote>`: `cite`, `ring` (one to three of its words, copied exactly; once a post). Sections `pullquote`: `text` (200 characters at most), `attribution`. The text must already be in the post.

```mdx
<Pullquote ring="mission control">Basically mission control for your AI coders.</Pullquote>
```
```yaml
  - type: pullquote
    text: The whole harbour lit up in one sweep.
```

**Code.** MDX `<CodeBlock code={`…`} lang="bash" title="terminal" />`. Markdown fenced code with a language and optional `title="file.ts"`. Sections `code`: `code`, `lang` (`text`, `bash`, `js`, `ts`, `json`, `css`, `html`, `astro`, `python`, `yaml`, `md`, `diff`, `sql`), `title`.

```yaml
  - type: code
    lang: bash
    title: Build the site
    code: |-
      npm run build
```

**TwoColumn / columns.** MDX `<TwoColumn ratio="2:1" reverse>` with `<div slot="left">` and `<div slot="right">` (unindented, blank lines round Markdown). Sections `columns`: `ratio` (`1:1`, `2:1`, `1:2`), `reverse`, `left`, `right` (Markdown each).

```mdx
<TwoColumn ratio="1:1">

<div slot="left">

**One assistant**

- You ask, wait, check, ask again

</div>

<div slot="right">

**A team of agents**

- Each task runs at the same time, in its own copy

</div>

</TwoColumn>
```

**Divider.** MDX `<Divider variant="orbit" />` (`rule`, `dots`, `orbit`). Sections `divider`: `style` (`rule`, `dots`; no orbit). Markdown `---`.

**Video.** MDX `<VideoEmbed>`: `id` (11 characters), `title`, `poster`, `duration`, `chapters` (`{ t, title }`), `caption`. Sections `video`: `youtubeId`, `title`, `poster`, `duration`, `chapters` (`t`, `title`), `caption`. A vlog does not need one: its page draws the player from the front matter.

```mdx
<VideoEmbed id="jof6-qj53Lg" title="So you've got an AI that writes code. Cool. What if you had ten?" duration="2:52" />
```

**Button** (sections only). `button`: `label` (40 characters at most), `url` (`https://…` or `/page/`), `newTab` (`true` opens it in a new tab, e.g. a game beside the post; default off). In MDX there is no button component: use a sentence link, in a tip Callout for a call to action. A project's Play, Open and live buttons come from its front matter.

```yaml
  - type: button
    label: Play Vesper Drift
    url: /projects/vesper-drift/
```

**Game** (sections only). `game`: `title`, `playUrl` (https), `playMode` (`embed`, `link`), `playAspect`, `poster`, `playNote`, `platforms` (`desktop`, `mobile`), `controls` (`key`, `action`). Embedding needs the host in `frame-src` in `public/_headers`.

**Links list** (sections). `links`: `items` (1-20 of `label`, `url`, `note`). Markdown: a plain list of links.

```yaml
  - type: links
    items:
      - label: The release notes, version 2
        url: https://example.com/notes
        note: release notes
```

**Stats** (sections). `stats`: `repo` (`owner/name` of a public repository). Numbers are fetched at build time; never type them.

**Table of contents** (sections). `toc`: `title`, `maxDepth` (2 or 3).

**Brand pieces** (MDX, blog only; rules in [`IMAGE_STYLE.md`](IMAGE_STYLE.md#83-the-brand-in-the-words)). `<AgentCards cards={[{ task, agent, tool, model, effort, state, note, report }]} caption="…" />` (1-3 cards; `state`: `finished`, `working`, `needs`, `interrupted`), copied from the app, never written. `<OrbitDiagram hub="…" meta="…" agents={[{ agent, task, tool, state }]} caption="…" />` (1-8 real agents). `<StatDial value="17" unit="s" caption="…in words…" source="…" />`, at most one a section, `caption` says the number in words.

**Author box, Latest posts, Waitlist** (sections). `author` (`author`), `latest` (`heading`, `kinds`, `tag`, `author`, `count`…), `waitlist` (`source`): see [`SECTIONS.md`](SECTIONS.md). A post ends with the waitlist through its `waitlist: true` field, not a block.

## Density rules

Measurable, and checked by `npm run check:layout` (numbers in `LIMITS`, `src/lib/layout-check.mjs`).

| Rule | Number | The check |
| --- | --- | --- |
| Paragraphs in a row with nothing else between them | **4 at most** | `wall-of-text` |
| Words in a row with nothing else between them | **~250 at most** | `wall-of-text` |
| Sentences in a paragraph | **5 at most** (one idea per paragraph) | `long-paragraph` above 6 |
| A picture, video or diagram | **one per ~600 words**, and at least one past 600 | `no-picture` |
| Callouts | **one per ~400 words** (one is always allowed) | `too-many-callouts` |
| Pull quotes | **one per ~800 words**, copied from the text | `too-many-pullquotes`, `pullquote-echo` |
| Contents list | at **3+ `##` and 600+ words** | `no-contents` |
| Headings | sentence case, descriptive ("How the harbour level works", not "Gameplay"), `##` then `###`, never `#` | `title-case`, `heading-skip`, `heading-h1` |
| Brass phrase | **one** `*phrase*` per title or heading, a few words that carry the idea, never the whole heading | `brass-phrase` |
| Title | 70 characters or fewer (the schema allows 90) | `title-length` |
| Summary | 155 characters or fewer (the build stops above 180), not the title again | `summary` |
| Comparisons | a list, a table (Markdown) or `columns` (sections), not a paragraph of "whereas" | read it |
| Links | the text says where it goes; no "click here", "here", "this" | `vague-link` |
| Voice | none of the words to avoid, no exclamation marks | `hype`, `exclamation` |

## Images

### Every post has a hero, or a stated reason not to

| Kind | The hero | Where the file goes | Written as |
| --- | --- | --- | --- |
| blog | `featuredImage` (behind the title, optimised) and/or `cover` (cards, sharing, under the head) | `src/assets/blog/` / `public/media/blog/` | `../../assets/blog/x.png` / `/media/blog/x.png` |
| news | `cover`, or none | `public/media/news/` | `/media/news/x.jpg` |
| vlog | the video (`youtubeId`); `poster` optional | `public/media/vlogs/` | `/media/vlogs/x.jpg` |
| project, app, game | `cover` (the poster behind Play) | `public/media/projects/` | `/media/projects/x.png` |
| repo | `cover` | `public/media/repos/` | `/media/repos/x.png` |

No hero? Write the reason as a front-matter comment the check reads (it is not a schema field), and repeat it in your report:

```yaml
# heroless: a two-paragraph correction; no picture belongs to it
```

### Files

- **Formats:** JPG, PNG, WebP, AVIF or SVG. Never HEIC. Names `[a-z0-9._-]`, so `My Photo 1.PNG` becomes `my-photo-1.png`. 10 MB at most per file; the build shrinks `public/media/` to 2000px and stops on anything still over 2 MB ([`IMAGES.md`](IMAGES.md)).
- **Covers, posters and featured images:** 16:9, at least 1280×720, ideally 1920×1080.
- **Body pictures:** blog MDX `<Figure src="/src/assets/blog/x.png">` (optimised); every other body picture and every section picture in `public/media/<kind>/`.
- **Clean source images.** The branded treatment (the ring, the corner, the veil) is applied by code on cards ([`IMAGE_STYLE.md`](IMAGE_STYLE.md)), still being decided: supply the picture with **no rings, logos, frames or text baked in**. Crop busy screenshots to one subject; keep the subject out of the right 38% below the top fifth (where the ring may run); no white canvases on this dark site.

### Alt text (required)

- Every picture has alt text, or is marked decorative (`decorative`, `decorative: true`, `![](x.jpg "decorative")`): only for a picture that says nothing. Covers and heroes are never decorative.
- Literal and useful: what it shows and why it is there, one sentence. "Vesper Drift at stage 12: a black hole with a lensed accretion disc and the HUD."
- Never "image of", "picture of", a file name, one word, or "placeholder".

### Sourcing

- **No stock photography and no generated images** unless the author approves each one by name.
- Use: **real screenshots** you can take or the author supplies, **photos the author supplies**, and **diagrams drawn in code**: a Markdown table or list, the brand pieces with real data, or an SVG file drawn by hand in code (dark background, ivory lines, brass as the one accent, the words in the caption, not in the picture). An SVG diagram is still a picture: list it in your report for the author's approval.
- No hot-linked pictures: every file is in the repository.

### When a picture is missing: the IMAGE NEEDED marker

Never fill the gap with a stand-in. Mark it in the file, where the picture goes, with the words `IMAGE NEEDED` (the layout check finds them anywhere and lists each one):

| Where | Marker |
| --- | --- |
| A front-matter picture (hero, cover, poster) | `# IMAGE NEEDED: featuredImage: what it should show` (a YAML comment) |
| MDX body | `<Callout type="warn" title="IMAGE NEEDED">What it shows, which screen, where it goes.</Callout>` then, if the layout needs to show the slot, `<Figure alt="…" caption="…" />` with no `src` (the placeholder plate) |
| Markdown body | `> [!WARNING]` then `> IMAGE NEEDED: what it shows…` |
| Sections | a `callout` block with `kind: warn`, `title: IMAGE NEEDED`; the picture block itself commented out under it |

The warn callout is visible in the editor's preview, so the author sees what is missing. Then **ask**: under "Pictures needed" in your report, one line per picture: the field or place, what it should show, the size (16:9 ≥1280px for a hero), and the file name you would give it. A post with an IMAGE NEEDED marker stays `draft: true`.

## Truth and credit

- **Never invent** a quote, number, source, benchmark, chapter time, agent report, opinion or link. Use what the brief gives, the repository shows, or a source you opened.
- **Every claim from outside links to its source,** at the claim. News ends with a `## Sources` list (or `links` block), primary source first.
- **Quotes are verbatim** and attributed; a quote you cannot find in its source is cut.
- **Numbers are recomputed** where they can be (totals, percentages, durations). State the unit and the date.
- **Uncertain claims** are either cut or kept with the doubt said in the text ("the notes do not give a number"); every one you keep goes in the report's "Claims to check".
- **Credit:** an AI-written piece is credited to the writing agent that wrote it, through `author`: your own slug (`pulsar`, `orion`, `kepler`, `hubble`; `r7` for R7 or a writer with no author file). Never `hunter-newton` (and never an absent `author`, which means Hunter). The byline and the AI-written label appear automatically; never write them or a bio. There is no footer note. Never create an author file.
- **The author's own writing** keeps his name (no `author` line). `aiAssist: edited` or `drafted` only on his posts and only when he asks for the line; never on an agent's post (the byline and its label are the disclosure).
- **Nothing goes up unreviewed.** `draft: true` until the author says it goes live.
- **The site forbids:** any email address, `mailto:` link, newsletter, RSS or feed mention, and social profiles other than GitHub and YouTube.

## Before and after

An example, not published content: a made-up game, **Lantern Tiles**. Both versions are test fixtures, so the numbers below are the check's real output: `tests/fixtures/layout-check/wall-of-text.mdx` and `well-laid-out.mdx`.

### Before: eight paragraphs, 537 words, nothing else

```mdx
---
title: My Thoughts On Lantern Tiles, The Ultimate Puzzle Game
summary: EXAMPLE ONLY, not published content. …
author: r7
---
Lantern Tiles is a browser puzzle game where you light a dark board one hexagon at a time. …   (1: what it is)
The first thing you notice is how quiet it is. …                                               (2: how it looks)
The rules are simple but they get deep quickly. … It is a game-changing design … of this size!  (3: rules, 7 sentences)
The best level in the game is the one called The Harbour. …                                     (4: the best moment)
Not everything works. The undo button only goes back one move, …                                (5: problems)
The controls are simple. You click a tile to place a lantern, …                                 (6: controls)
Compared with other light puzzles I have played, Lantern Tiles is shorter and calmer. …          (7: comparison)
If you like slow puzzles … it is worth an evening. … [Click here](/projects/lantern-tiles/) to play it.   (8: verdict)
```

`npm run check:layout -- tests/fixtures/layout-check/wall-of-text.mdx`: score 66, seven warnings: `no-hero`, `title-case` (title), `wall-of-text` (8 paragraphs, 537 words, line 9), `long-paragraph` (7 sentences), `hype` ("game-changing"), `exclamation`, `vague-link` ("Click here").

### After: the games recipe

| Paragraph | Became |
| --- | --- |
| 1 what it is | the `featuredImage` hero, a new sentence-case title with one brass phrase, and a `<Paragraph lead>` |
| 2 how it looks | the end of "How a level works", then a **Figure** of a level |
| 3 rules | "Four kinds of tile": one sentence and a **list**; the hype and the exclamation mark cut |
| 4 best moment | "The harbour level", a **Pullquote** of its best line, an **ImageRow** before and after |
| 5, 6 problems, controls | "Where it falls short": one sentence and a **table** (the control problem became a row) |
| 7, 8 comparison, verdict | "Verdict": one paragraph, then a **tip Callout** with the play link, named |

```mdx
---
title: Lantern Tiles is a puzzle game about *running out of light*
summary: EXAMPLE ONLY, not published content. The same made-up game as the wall of text, laid out with the games recipe.
author: r7
featuredImage: ../../assets/blog/lantern-tiles-hero.png
featuredImageAlt: A dark board of hexagonal tiles with three lit lanterns in the lower left and a trail of warm light between them
draft: true
---
<Paragraph lead>
Lantern Tiles is a browser puzzle game where you light a dark board one hexagon at a time, before your oil runs out. …
</Paragraph>

## How a level works

Each lantern you place lights the six tiles around it and costs one unit of oil. …

<Figure src="/src/assets/blog/lantern-tiles-board.png" alt="A level halfway through: seven lit lanterns, two mirror tiles and a band of grey fog tiles across the middle" caption="Chapter two, level four: mirrors push the light two tiles further." />

## Four kinds of tile

The rules stay simple, but each chapter adds a tile that changes how you plan.

- **Plain tiles** light when a lantern touches them.
- **Mirrors** bounce the light two tiles further.
- **Fog** lights only when two lanterns touch it.
- **Wind** blows out a lantern on the edge after three turns.

## The harbour level

… When it finally worked, the whole harbour lit up in one sweep and the music came in for the first time.

<Pullquote>The whole harbour lit up in one sweep and the music came in for the first time.</Pullquote>

<ImageRow images={[{ src: '…/lantern-tiles-harbour-before.png', alt: 'The Harbour level before the last move: …', caption: 'One move left.' }, { src: '…/lantern-tiles-harbour-after.png', alt: 'The Harbour level solved: …', caption: 'Solved.' }]} />

## Where it falls short

| Problem | Where it bites |
| --- | --- |
| Undo goes back one move only | Long levels in chapter three |
| Fog is hard to see on a phone | Any level with fog |
| No keyboard way to move between tiles | Everywhere, if you cannot use a mouse |

## Verdict

<Callout type="tip" title="My verdict">
Worth an evening if you like slow puzzles where the answer arrives all at once. [Play Lantern Tiles in your browser](/projects/lantern-tiles/).
</Callout>
```

Check: score 100, no warnings. The same content, a third shorter, with something to look at on every screen. (The pictures are named for the example; in a real post they are files the author supplied, or IMAGE NEEDED markers.)

## The layout check

```
npm run check:layout                                 every post in src/content/ (news, blog, vlogs, projects, repos)
npm run check:layout -- src/content/blog/x.mdx       one file, or a folder
npm run check:layout -- src/content/blog/x.mdx --strict   exit 1 on any warning
npm run check:layout -- <path> --json                the findings as JSON
```

- **Report only.** It changes nothing and always exits 0 unless you pass `--strict`. It is not part of `npm run build`, CI or the Cloudflare build: a warning never stops the site.
- It reads the front matter and the body, Markdown/MDX or `sections`, and prints each warning with the file line, the rule and a one-line fix, then a score out of 100 per file (each rule has a weight) and a summary.
- Rules: the density rules above, plus `no-hero`, `alt-missing`, `alt-poor`, `image-needed` (a marker left in), `placeholder` (a `TODO:` or `[PLACEHOLDER]` left in), `placeholder-plate` (a Figure with no `src`), `raw-html` (a hand-made `<a class="btn">`, `<button>` or `<img>`), `contact` (email, `mailto:`, newsletter, RSS), `news-sources` (a news body with no source link).
- It reads the words to avoid from [`VOICE_AND_COPY.md`](VOICE_AND_COPY.md#words-to-avoid), so that list stays the one place.
- It is a heuristic. Title Case is judged against the capitalised words the post uses mid-sentence (its names); a sentence count can miss an odd abbreviation. **Fix a warning, or justify it in your report** ("title-case on line 12: Vesper Drift is a name").
- Code: `scripts/check-layout.mjs` (the command), `src/lib/layout-check.mjs` (the rules and `LIMITS`), `src/lib/layout-check.vitest.ts` with `tests/fixtures/layout-check/`.

## Pre-publish checklist

The writer runs 1-6, hands to the fact-check role (7), and the author reviews last.

1. **Layout:** `npm run check:layout -- <your file>`: every warning fixed or justified in the report. No `TODO:`, `IMAGE NEEDED` (unless the post stays a draft waiting for the picture) or template comment left.
2. **Build:** `npm run check`, `npm run lint`, `npm run build` (schema, alt text, media guard, no-contact).
3. **Accessibility:** `npm run test:e2e` (axe on every page; `EXTRA_ROUTES="/<kind>/<slug>/"` for a draft turned on to test). One h1, headings in order, every picture with alt text.
4. **Alt text:** read each alt aloud without the picture: does it say what the picture shows and why it is there?
5. **Links:** every internal link points at a page that exists (`/blog/x/` with the trailing slash); every outside link is `https://` and opens.
6. **Look:** `node .claude/skills/add-content/checklists/check-page.mjs <kind>/<slug> "<phrase>"`: the page at 375px and 1280px, no horizontal scroll, no console error; open the screenshots and look for a screen with nothing but text.
7. **Fact-check handoff.** Send the fact-check role the file path and a claims table: each factual claim, the line, and the source link behind it; each quote with its source; each picture with where it came from. The fact-checker verifies and returns pass, or a list of fixes:
   - each factual claim has a source, and the source says it;
   - quotes are verbatim, word for word, and attributed;
   - numbers are recomputed (totals, percentages, durations, dates);
   - every link resolves (HTTP 200, no redirect to a login or a different page), and internal links exist in `dist/`;
   - every picture has alt text and a known origin (the author's, a screenshot of something we may show; never stock or generated without approval);
   - names (people, products as their owners write them: Claude, Codex, GitHub, YouTube) and dates (`Oct 3, 2026` in prose) are right;
   - no email address, contact details, newsletter or RSS mention;
   - the `author` is the agent that wrote it (or `r7`), never Hunter for AI text.
8. **The author** reviews and sets `draft: false`. Nobody else does.

The report every writer ends with is in [`.claude/skills/add-content/checklists/report.md`](../.claude/skills/add-content/checklists/report.md), including the **layout report** line.
