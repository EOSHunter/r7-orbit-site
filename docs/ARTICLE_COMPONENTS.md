# Article components

Building blocks for blog and news articles, in `src/components/article/`. Styles: `src/styles/article.css` (tokens only). Live demo with every component: `/styleguide/article-components/` (source: `src/components/article/demo/article-components-demo.mdx`).

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
| `Pullquote` | `cite` | Large display quote; `aria-hidden` (repeats body text). |
| `CodeBlock` | `code`, `lang`, `title` | Same bar and copy button as fenced code. |
| `VideoEmbed` | `id`, `title`, `poster`, `duration`, `chapters`, `caption` | Wraps `YouTubeFacade` (click to load). |
| `Divider` | `variant` rule/dots | |
| `TwoColumn` | `ratio` 1:1/2:1/1:2, `reverse`; slots `left`, `right` | Stacks below 720px. In MDX keep slot `<div>`s unindented with blank lines round Markdown. |
| `Toc` | `headings`, `variant` block/inline/aside, `title`, `maxDepth` | inline/aside reuse `TableOfContents`. MDX body: `<Toc headings={props.headings} />` when rendered with a `headings` prop. |

## Rules

Images must be local: `/src/assets/...` (optimised) or `/media/...` (`public/media/`, served as it is); an `http(s)` source throws at build, and so does a body image with no alt text (`docs/IMAGES.md`). `getHeadings()` only sees Markdown headings (`##`), not `Heading` components, so use `##` for sections that should appear in a contents list.
