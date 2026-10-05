// Markup for the page preview in the editor: the page's blocks as the same HTML Sections.astro and the block components produce
// (same elements and classes), so the site's real CSS styles them. Pure functions, no DOM and no Decap: they run under Vitest.
// sections-html.vitest.ts checks that every class used here still exists in the stylesheets and components.
//
// What is copied, not shared: the markup (an Astro component cannot run in the browser) and the Markdown reader. What is shared:
// the blocks and their fields (`describeShape` gives the preview each field's type and default), the rows (`layoutSections`, the
// same function the page uses, so the grouping cannot drift) and the problems (the real schema, so the preview warns about
// exactly what the build would stop on). `PREVIEW` is typed `{ [type]: … }`: a block in the library with no entry here does not compile.
// A block whose preview differs from the page says so (`previewNote` in its definition), under the block.
import {
  definitionOf,
  describeShape,
  layoutSections,
  sectionSchema,
  SECTION_LABELS,
  type FieldInfo,
  type Section,
  type SectionOf,
  type SectionType,
} from '../lib/sections';
import { sectionsHeadings } from '../lib/sections-to-content';
import { titleParts } from '../lib/text';
import {
  blocksHtml,
  calloutHtml,
  dividerHtml,
  escapeHtml,
  figureHtml,
  inlineMarkdown,
  PLACEHOLDER,
  quoteHtml,
  videoHtml,
  type ResolveAsset,
} from './preview-html';

type Loose = Record<string, unknown>;

/** A heading's text with its one `*phrase*` set in italic brass, as `titleParts` does on the page (the CSS colours `h2 em`). */
export const headingText = (source: string): string =>
  titleParts(source)
    .map((part) => (part.em ? `<em>${escapeHtml(part.text)}</em>` : escapeHtml(part.text)))
    .join('');

/** Only addresses a visitor may follow (https, or a page on this site): anything else is not made a link. */
const safeLink = (url: string): string => (/^(https:\/\/\S+|\/(?!\/)\S*)$/.test(url) ? url : '#');
const isExternal = (url: string): boolean => url.startsWith('https://');
const icon = (name: string) => `<svg class="ico" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const attr = (value: unknown) => escapeHtml(String(value ?? ''));

/**
 * The Markdown a Text, Portrait or Columns box holds: headings (## and ###), paragraphs, lists, **bold**, *italic*, `code` and
 * [links](url). Anything fancier (tables, nested lists, raw HTML) is shown as plain text: the live page renders it with the full
 * Markdown reader.
 */
export function markdownHtml(source: string): string {
  return source
    .trim()
    .split(/\n{2,}/)
    .filter((chunk) => chunk.trim())
    .map((chunk) => {
      const heading = /^(#{2,3})\s+(.+)$/.exec(chunk.trim());
      return heading ? `<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>` : blocksHtml(chunk);
    })
    .join('');
}

// ---- What the editor holds, made whole ---------------------------------------------------------------------------------

function looseField(info: FieldInfo, value: unknown): unknown {
  if (info.widget === 'list') {
    return (Array.isArray(value) ? (value as Loose[]) : []).map((row) => looseFields(info.fields ?? [], row ?? {}));
  }
  if (info.widget === 'boolean') return value === true;
  if (info.widget === 'select') {
    const allowed = (info.options ?? []).map((o) => o.value);
    if (info.multiple) return Array.isArray(value) ? value.filter((v) => allowed.includes(v as string)) : [];
    if (info.source) return typeof value === 'string' ? value : '';
    const match = allowed.find((v) => String(v) === String(value));
    return match ?? info.default ?? allowed[0];
  }
  if (info.widget === 'number') return Number.isFinite(Number(value)) && value !== '' && value != null ? Number(value) : (info.default ?? 0);
  return typeof value === 'string' ? value : typeof info.default === 'string' ? info.default : '';
}

function looseFields(fields: FieldInfo[], raw: Loose): Loose {
  return Object.fromEntries(fields.map((info) => [info.name, looseField(info, raw[info.name])]));
}

/**
 * What the editor holds while a block is half-filled in (missing text, no picture yet) as the shape the schema reads, with every
 * field present and of the right type. Unknown block types are dropped; nothing here validates: `previewProblems` and the build do.
 */
export function looseSections(value: unknown): Section[] {
  if (!Array.isArray(value)) return [];
  const out: Section[] = [];
  for (const raw of value as Loose[]) {
    const definition = definitionOf(String(raw?.type));
    if (!definition) continue;
    out.push({ type: definition.id, ...looseFields(describeShape(definition.schema.shape), raw) } as unknown as Section);
  }
  return out;
}

/**
 * What the build would stop on, found while the author is still typing: the real schema is run over each block as typed, so the
 * preview names exactly what a build would, with the block's number (from 1) and label. The form cannot say "alt text is needed
 * unless the picture is decorative", which is one of them.
 */
export function previewProblems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return (value as Loose[]).flatMap((raw, i) => {
    const type = String(raw?.type);
    if (!definitionOf(type)) return [`Block ${i + 1}: unknown block type "${type}".`];
    const result = sectionSchema.safeParse(raw);
    if (result.success) return [];
    const label = SECTION_LABELS[type as SectionType];
    return result.error.issues.map((issue) => {
      const where = issue.path.length ? ` (${issue.path.join(' › ')})` : '';
      return `Block ${i + 1} (${label})${where}: ${issue.message}`;
    });
  });
}

/** The warning box shown above the preview, or nothing when all is well. */
export function problemsHtml(problems: string[]): string {
  return problems.length
    ? `<div class="callout bad art-callout" role="note"><p class="art-callout-title"><strong>Fix before saving.</strong></p><div class="art-callout-body"><ul>${problems.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul></div></div>`
    : '';
}

// ---- One block's HTML ------------------------------------------------------------------------------------------------------

/** What a block's HTML may need besides its own fields. */
export interface PreviewEnv {
  resolve: ResolveAsset;
  /** Every block of the page, for the table of contents. */
  sections: readonly Section[];
  /** The authors the site has, for the Author box. */
  authors: { slug: string; name: string; bio: string; agent: boolean; subtitle?: string }[];
}

const pictureHtml = (path: string, alt: string, resolve: ResolveAsset) => {
  const url = path ? resolve(path) : '';
  return url ? `<img class="art-img" src="${attr(url)}" alt="${attr(alt)}" />` : `<div class="media">${PLACEHOLDER}</div>`;
};

const proseColumn = (markdown: string) => `<div class="art-col prose">${markdownHtml(markdown)}</div>`;

const PREVIEW: { [K in SectionType]: (d: SectionOf<K>, env: PreviewEnv) => string } = {
  heading: (d) => `<h${d.level}>${headingText(d.text)}</h${d.level}>`,
  lead: (d) => `<p class="art-p art-lead">${inlineMarkdown(d.text)}</p>`,
  text: (d) => markdownHtml(d.text),
  quote: (d) => quoteHtml({ body: d.text, cite: d.attribution }),
  pullquote: (d) => `<aside class="art-pullquote"><p>${escapeHtml(d.text)}</p>${d.attribution ? `<p class="art-pullquote-cite">${escapeHtml(d.attribution)}</p>` : ''}</aside>`,
  callout: (d) => calloutHtml({ type: d.kind, title: d.title, body: d.text }),
  code: (d) =>
    `<div class="codeblock art-code"><div class="codeblock-bar"><span>${escapeHtml(d.title || d.lang)}</span><button class="btn sm quiet" type="button" tabindex="-1"><span>Copy</span></button></div><pre class="code" tabindex="0"><code>${escapeHtml(d.code)}</code></pre></div>`,
  image: (d, env) =>
    figureHtml(
      {
        src: d.image,
        alt: d.decorative ? '' : d.alt,
        decorative: d.decorative,
        caption: d.caption,
        align: d.width === 'full' ? 'full' : d.width === 'wide' ? 'center' : d.align,
        size: d.width === 'narrow' ? d.size : 'lg',
      },
      env.resolve,
    ),
  'image-row': (d, env) => {
    const figures = d.images
      .map((i) => {
        const missing = !i.decorative && !i.alt.trim() && i.image;
        const picture = pictureHtml(i.image, i.decorative ? '' : i.alt, env.resolve);
        const warning = missing ? '<p class="admin-alt-warning" role="alert"><strong>No alt text.</strong> Add it, or tick "Decorative image".</p>' : '';
        return `<figure class="art-fig">${picture}${warning}${i.caption ? `<figcaption>${escapeHtml(i.caption)}</figcaption>` : ''}</figure>`;
      })
      .join('');
    const caption = d.caption ? `<figcaption class="art-row-caption">${escapeHtml(d.caption)}</figcaption>` : '';
    return `<figure class="art-row" data-count="${d.images.length}"><div class="art-row-grid">${figures}</div>${caption}</figure>`;
  },
  gallery: (d, env) =>
    `<div class="gallery-wrap"><div class="gallery">${d.shots
      .map(
        (s) =>
          `<figure><button class="shot" type="button" tabindex="-1" aria-label="${attr(`Enlarge: ${s.alt}`)}"><div class="media">${s.image && env.resolve(s.image) ? `<img src="${attr(env.resolve(s.image))}" alt="" />` : PLACEHOLDER}</div></button>${s.caption ? `<figcaption>${escapeHtml(s.caption)}</figcaption>` : ''}</figure>`,
      )
      .join('')}</div></div>`,
  portrait: () => '',
  video: (d) => videoHtml({ title: d.title, caption: d.caption }),
  game: (d, env) => {
    const aspect = /^([1-9]\d{0,2}):([1-9]\d{0,2})$/.exec(d.playAspect);
    const stage = `<div class="play-stage" style="--play-aspect: ${aspect ? `${aspect[1]} / ${aspect[2]}` : '16 / 9'}">${d.poster && env.resolve(d.poster) ? `<img class="play-poster" src="${attr(env.resolve(d.poster))}" alt="" />` : PLACEHOLDER}<button class="btn solid play-start" type="button" tabindex="-1">${icon('play')}Play ${escapeHtml(d.title)}</button></div>`;
    const link = `<div class="cluster play-bar"><a class="btn solid" href="${attr(safeLink(d.playUrl))}">${icon('play')}Play ${escapeHtml(d.title)}${icon('external')}</a></div>`;
    const controls = d.controls.length
      ? `<div class="play-controls"><h3 class="eyebrow">Controls</h3><dl>${d.controls.map((c) => `<div><dt><kbd>${escapeHtml(c.key)}</kbd></dt><dd>${escapeHtml(c.action)}</dd></div>`).join('')}</dl></div>`
      : '';
    return `<section class="block play-section">${d.playMode === 'link' ? link : stage}${d.playNote ? `<p class="play-note">${escapeHtml(d.playNote)}</p>` : ''}${d.platforms.length ? `<p class="play-platforms">${d.platforms.map((p) => `<span class="chip mono">${p === 'mobile' ? 'Mobile' : 'Desktop'}</span>`).join('')}</p>` : ''}${controls}</section>`;
  },
  columns: (d) =>
    `<div class="art-cols" data-ratio="${d.ratio}"${d.reverse ? ' data-reverse="true"' : ''}>${proseColumn(d.left)}${proseColumn(d.right)}</div>`,
  divider: (d) => dividerHtml({ variant: d.style }),
  spacer: (d) => `<div class="sec-spacer" data-size="${d.size}" aria-hidden="true"></div>`,
  links: (d) =>
    `<ul class="link-list">${d.items
      .map(
        (i) =>
          `<li><a href="${attr(safeLink(i.url))}">${escapeHtml(i.label)}${i.note ? `<span class="where">${escapeHtml(i.note)}</span>` : ''}${icon(isExternal(i.url) ? 'external' : 'arrow')}</a></li>`,
      )
      .join('')}</ul>`,
  button: (d) =>
    `<p class="sec-button"><a class="btn solid" href="${attr(safeLink(d.url))}">${escapeHtml(d.label)}${isExternal(d.url) ? icon('external') : ''}</a></p>`,
  toc: (d, env) => {
    // The headings as typed: the Heading blocks, and the ## and ### inside Markdown boxes, in page order, read by the same projection
    // the page and the post's contents list use (src/lib/sections-to-content.ts).
    const found = sectionsHeadings(env.sections);
    const tree: { text: string; slug: string; children: { text: string; slug: string }[] }[] = [];
    for (const h of found) {
      if (h.depth === 2) tree.push({ text: h.text, slug: h.slug, children: [] });
      else if (h.depth === 3 && d.maxDepth === 3 && tree.length) tree.at(-1)!.children.push(h);
    }
    if (!tree.length) return '<p class="admin-preview-note">No headings yet: the list appears when the page has Heading blocks.</p>';
    const items = tree
      .map(
        (i) =>
          `<li><a href="#${attr(i.slug)}">${escapeHtml(i.text)}</a>${i.children.length ? `<ol>${i.children.map((c) => `<li><a href="#${attr(c.slug)}">${escapeHtml(c.text)}</a></li>`).join('')}</ol>` : ''}</li>`,
      )
      .join('');
    return `<nav class="art-toc" aria-label="${attr(d.title || 'On this page')}"><p class="eyebrow">${escapeHtml(d.title || 'On this page')}</p><ol>${items}</ol></nav>`;
  },
  stats: (d) =>
    `<div class="stats"><span class="lang">GitHub</span><span>${escapeHtml(d.repo || 'owner/name')}: stars, forks and the last update are fetched when the site is built</span></div>`,
  latest: (d) => {
    const kinds = d.kinds.length ? d.kinds.join(', ') : 'every kind';
    const filters = [`${d.count} newest`, kinds, d.tag && `tagged ${d.tag}`, d.author && `by ${d.author}`].filter(Boolean).join(' · ');
    const heading = d.heading ? `<h2 class="section-title">${headingText(d.heading)}</h2>` : '';
    return `<div class="latest-posts">${heading}<div class="empty"><p>Latest posts: ${escapeHtml(filters)}.</p><p class="t-meta">The cards are chosen when the site is built.</p></div></div>`;
  },
  author: (d, env) => {
    const who = env.authors.find((a) => a.slug === d.author);
    if (!who) return `<aside class="author-note author-box"><div class="author-note-body"><p>${d.author ? `No author "${escapeHtml(d.author)}".` : 'Choose an author.'}</p></div></aside>`;
    const initials = who.name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
    const chip = who.agent ? `<span class="chip ai-written">${icon('agent')}AI-written</span>` : '';
    return `<aside class="author-note author-box"><span class="avatar initials" aria-hidden="true"><span>${escapeHtml(initials)}</span></span><div class="author-note-body"><p class="author-note-head"><a class="author-name" href="#">${escapeHtml(who.name)}</a>${who.subtitle ? `<span class="author-sub">${escapeHtml(who.subtitle)}</span>` : ''}${chip}</p><p>${escapeHtml(who.bio)}</p></div></aside>`;
  },
  newsletter: (d) => {
    const heading = d.heading || 'One email when something new is worth reading';
    const text = d.text || 'New posts and videos, a few times a month. No tracking, and you can leave in one click.';
    // Not a <form>: a submit inside the editor would navigate the preview frame.
    const fields = `<div class="field"><label>Email address</label><div class="subscribe-row"><input class="input" type="email" placeholder="you@example.com" disabled /><button class="btn solid" type="button" tabindex="-1">Subscribe</button></div></div>`;
    if (d.style === 'form') return `<section class="sec-newsletter"><h2>${headingText(heading)}</h2><p>${escapeHtml(text)}</p>${fields}</section>`;
    return `<section class="band"><div class="container wide"><div class="subscribe"><div><p class="eyebrow">Newsletter</p><h2 style="margin-top: var(--s-3)">${escapeHtml(heading)}</h2><p>${escapeHtml(text)}</p></div>${fields}</div></div></section>`;
  },
};

/** A block's HTML, followed by what its preview approximates when that is something the author should know. */
function blockHtml(block: Section, env: PreviewEnv): string {
  const html = (PREVIEW[block.type] as (d: Section, env: PreviewEnv) => string)(block, env);
  const note = definitionOf(block.type)?.previewNote;
  return note ? `${html}<p class="admin-preview-note" role="note">Preview: ${escapeHtml(note)}</p>` : html;
}

const PREVIEW_ROW = 'container wide sec-row';

export interface SectionsHtmlOptions {
  /** `page` (the About page): rows in page-wide containers. `column`: a post's body, in its text column (Sections.astro's `layout`). */
  layout?: 'page' | 'column';
}

/** The `.sections` element of the page (Sections.astro), from the blocks as the editor holds them. */
export function sectionsHtml(
  value: unknown,
  resolve: ResolveAsset,
  authors: PreviewEnv['authors'] = [],
  { layout = 'page' }: SectionsHtmlOptions = {},
): string {
  const sections = looseSections(value);
  const env: PreviewEnv = { resolve, sections, authors };
  const draw = (block: Section) => blockHtml(block, env);
  const rowClass = layout === 'page' ? PREVIEW_ROW : 'sec-row';
  const html = layoutSections(sections)
    .map((row) => {
      if (row.kind === 'split') {
        const portrait = row.portrait as SectionOf<'portrait'>;
        const lead = row.lead as SectionOf<'heading'> | undefined;
        const url = portrait.image ? resolve(portrait.image) : '';
        const alt = portrait.decorative ? '' : portrait.alt;
        const picture = url ? `<img src="${attr(url)}" alt="${attr(alt)}" />` : PLACEHOLDER;
        const heading = lead ? `<h${lead.level}>${headingText(lead.text)}</h${lead.level}>` : '';
        const body = [markdownHtml(portrait.text), ...row.blocks.map(draw)].join('');
        return `<div class="${rowClass}"><div class="about-grid" data-side="${portrait.side}"><div class="portrait">${picture}</div><div class="prose">${heading}${body}</div></div></div>`;
      }
      if (row.kind === 'prose') return `<div class="${rowClass}"><div class="prose">${row.blocks.map(draw).join('')}</div></div>`;
      // In a post's column nothing reaches the window's edges: a full row is drawn as a wide one (and a Full image as a wide one).
      const drawn = layout === 'column' && row.kind === 'full' ? draw({ ...(row.block as SectionOf<'image'>), width: 'wide' }) : draw(row.block);
      if (row.kind === 'full' && layout === 'page') return `<div class="sec-row sec-row-full">${drawn}</div>`;
      if (row.kind === 'band') return `<div class="sec-row sec-row-band">${drawn}</div>`;
      return `<div class="${rowClass}">${drawn}</div>`;
    })
    .join('');
  return layout === 'column' ? `<div class="sections" data-layout="column">${html}</div>` : `<div class="sections">${html}</div>`;
}
