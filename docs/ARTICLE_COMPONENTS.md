# Article components

Building blocks for blog and news articles, in `src/components/article/`. Styles: `src/styles/article.css` (tokens only). Live demo with every component: `/styleguide/article-components/` (source: `src/components/article/demo/article-components-demo.mdx`).

**Also as page blocks.** The shared block library (`src/lib/sections/`, [`SECTIONS.md`](SECTIONS.md)) wraps these same components (Figure, ImageRow, Callout, Quote, Post, Pullquote, CodeBlock, VideoEmbed, TwoColumn, Toc, Paragraph, Divider) so a page such as About can be built from them in the admin; a page block is a thin component in `src/components/sections/` that passes the block's fields to the one here. Change a component here and the page blocks follow.

When to use which, with recipes per kind and density rules: [`WRITING_GUIDE.md`](WRITING_GUIDE.md).

## Using them

- **In MDX posts** (`src/content/blog/*.mdx`): no imports needed. `ArticlePage` passes `articleComponents` to `<Content>`, so `<Callout type="tip">…</Callout>` just works. Frontmatter is unchanged (same schema as `.md`).
- **In an Astro page**: `import { Figure, Callout } from '../components/article'`, or render an MDX module with `<Demo.Content components={articleComponents} />`.
- **Page layout**: `ArticleTemplate` (breadcrumb, title block, optional cover, contents list, reading column; slots `before`, default, `after`). Pass `headings` from `render()` or an MDX module's `getHeadings()`.

## Components

| Component | Props | Notes |
| --- | --- | --- |
| `Heading` | `level` 2-4, `id` | Anchor link; id from the text unless given. `##` in Markdown gets the same anchor. |
| `Subheading` | `id` | Level 3 `Heading`. |
| `Paragraph` | `lead` | One paragraph; `lead` is the intro size. |
| `Prose` | `as`, `lead`, `id` | The `.prose` reading column. |
| `Figure` | `src`, `alt` (required), `decorative`, `caption`, `align` left/right/center/full, `size` sm/md/lg, `width`, `height` | No `src` = placeholder plate. Floats at 720px+. Local images only: `/src/assets/...` is optimised (AVIF/WebP, srcset), `/media/...` is served as it is. An empty `alt` is refused unless `decorative`. The editor's **Image** block writes this. |
| `ImageRow` / `ImageGallery` | `images` (2-3 of `{src, alt, caption, decorative?}`), `caption` | Stacks below 600px. Not the lightbox `Gallery`. |
| `Callout` | `type` info/warn/tip, `title` | Same classes as `> [!NOTE]`. |
| `Quote` | `cite`, `href` | Inline quotation. |
| `Post` | `name`, `platform` (required), `handle`, `role`, `date` (2026-11-04), `href` (https), `quoted`, `quotedLabel`, `quotedDate`, `quotedHref` | A quoted social post as the site's own card: initials, name, handle, "Post on X", the words (the slot), the date and "View the post on X". No logo, no embed, no photo from elsewhere. Same markup as `> [!POST]` in Markdown and the `post` block: `src/lib/post-card.mjs`. Syntax in [`WRITING_GUIDE.md`](WRITING_GUIDE.md) (**Post**). |
| `Pullquote` | `cite`, `ring` | Large display quote; `aria-hidden` (repeats body text). `ring`: one to three of its words, copied exactly, get the brand ring (once a post; the build fails if they are not in the quote). |
| `CodeBlock` | `code`, `lang`, `title` | Same bar and copy button as fenced code. |
| `VideoEmbed` | `id`, `title`, `poster`, `duration`, `chapters`, `caption` | Wraps `YouTubeFacade` (click to load). |
| `Divider` | `variant` rule/dots/orbit | `orbit`: the logo's small ring and dot between two fading hairlines, for the main breaks of a post. |
| `TwoColumn` | `ratio` 1:1/2:1/1:2, `reverse`; slots `left`, `right` | Stacks below 720px. In MDX keep slot `<div>`s unindented with blank lines round Markdown. |
| `AgentCards` | `cards` (1-3 of `{task, agent, tool?, model?, effort?, state?, note?, report?}`), `caption` | The card from the R7 Orbit canvas. `state`: finished (default), working, needs, interrupted; the rail and status mark follow it. `` `code` `` in a report shows as code. **Copy what the app showed; never write a report for an agent.** |
| `OrbitDiagram` | `hub`, `meta`, `agents` (1-8 of `{agent, task, tool?, state?}`), `caption` | The canvas as a figure: the project in the middle with the R7 mark, the agents round it on hairlines; a list on a rail when the column is under 560px. Real agents and tasks only. |
| `StatDial` | `value`, `unit`, `caption` (required), `source` | One number inside the brand ring. The dial is `aria-hidden`: the caption must say the number in words. At most one a section. |
| `Toc` | `headings`, `variant` block/inline/aside, `title`, `maxDepth` | inline/aside reuse `TableOfContents`. MDX body: `<Toc headings={props.headings} />` when rendered with a `headings` prop. |

## Rules

**Pictures open larger.** On every post page (blog, news, vlog, project, repo) a picture with alt text, the cover and the pictures in the body, is turned by `src/scripts/image-zoom.js` into a button ("Enlarge: <alt>") that opens it in a dialog (`ImageZoom.astro`, the project gallery's lightbox), with Previous and Next across the post's pictures. Decorative pictures, pictures inside a link or a button, the project gallery, the Play poster and the hero behind a headline are left alone. Without JavaScript nothing changes.

**Callouts.** The label is a small eyebrow in the callout's colour; its full stop is for screen readers only. A note (`info`) is a brass rule beside ivory text, not a box; a tip keeps the brass panel and a warning the muted red one.

Images must be local: `/src/assets/...` (optimised) or `/media/...` (`public/media/`, served as it is); an `http(s)` source throws at build, and so does a body image with no alt text (`docs/IMAGES.md`). `getHeadings()` only sees Markdown headings (`##`), not `Heading` components, so use `##` for sections that should appear in a contents list.

**The brand pieces** (`AgentCards`, `OrbitDiagram`, `StatDial`, `Divider variant="orbit"`, `Pullquote ring`) draw their markup with `src/lib/article-brand.ts`, which the editor's preview uses too, so the preview is the component itself rather than a copy. The geometry of the ring is `src/lib/orbit.ts`. All of them are editor blocks in /admin (`src/admin/blocks.ts`), and the rules for using them are in `docs/IMAGE_STYLE.md` section 8.3.

**One-off components a post imports itself.** `PatchNotesPanel` (`src/components/PatchNotesPanel.astro`) is not in `articleComponents`: the R7 Orbit releases post imports it (`import PatchNotesPanel from '../../components/PatchNotesPanel.astro';` under the front matter). It draws every release in `src/data/r7-orbit-patch-notes.json` in a box that scrolls on its own (at most `min(55vh, 40rem)` tall, focusable and labelled so the keyboard can scroll it), headed "As of <newest release date>, version <newest>", computed by `summarise()` in `src/lib/patch-notes.ts` (tested in `patch-notes.vitest.ts`). To add a release, add it at the top of the JSON; the date and totals follow.
