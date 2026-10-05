// Markup for the About preview in the editor: the page's blocks as the same HTML Sections.astro and SectionBlock.astro produce
// (same elements and classes), so the site's real CSS styles them. Pure functions, no DOM and no Decap: they run under Vitest.
// sections-html.vitest.ts checks that every class used here still exists in the stylesheets.
//
// What is copied, not shared: the markup (an Astro component cannot run in the browser) and the Markdown reader. The rows
// themselves come from `layoutSections`, the same function the page uses, so the grouping cannot drift.
import { titleParts } from '../lib/text';
import { layoutSections, type Section } from '../lib/page-sections';
import {
  blocksHtml,
  calloutHtml,
  dividerHtml,
  escapeHtml,
  figureHtml,
  inlineMarkdown,
  PLACEHOLDER,
  quoteHtml,
  type ResolveAsset,
} from './preview-html';

type Loose = Record<string, unknown>;
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/** A heading's text with its one `*phrase*` set in italic brass, as `titleParts` does on the page (the CSS colours `h2 em`). */
export const headingText = (source: string): string =>
  titleParts(source)
    .map((part) => (part.em ? `<em>${escapeHtml(part.text)}</em>` : escapeHtml(part.text)))
    .join('');

/** Only addresses a visitor may follow (https, or a page on this site): anything else is not made a link. */
const safeLink = (url: string): string => (/^(https:\/\/\S+|\/(?!\/)\S*)$/.test(url) ? url : '#');
const isExternal = (url: string): boolean => url.startsWith('https://');
const icon = (name: string) => `<svg class="ico" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

/**
 * The Markdown a Text, Portrait, Quote or Callout box holds: headings (## and ###), paragraphs, lists, **bold**, *italic*,
 * `code` and [links](url). Anything fancier (tables, nested lists, raw HTML) is shown as plain text: the live page renders it
 * with the full Markdown reader.
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

/**
 * What the editor holds while a block is half-filled in (missing text, no picture yet) as the shape the layout expects. Unknown
 * block types are dropped; nothing here validates: the build does that (src/lib/page-sections.ts).
 */
export function looseSections(value: unknown): Section[] {
  if (!Array.isArray(value)) return [];
  const out: Section[] = [];
  for (const raw of value as Loose[]) {
    const d = raw ?? {};
    const picture = { image: text(d.image), alt: text(d.alt), decorative: d.decorative === true };
    switch (d.type) {
      case 'heading':
        out.push({ type: 'heading', level: Number(d.level) === 3 ? 3 : 2, text: text(d.text) });
        break;
      case 'text':
        out.push({ type: 'text', text: text(d.text) });
        break;
      case 'image':
        out.push({
          type: 'image',
          ...picture,
          caption: text(d.caption),
          width: d.width === 'wide' || d.width === 'full' ? d.width : 'narrow',
        });
        break;
      case 'portrait':
        out.push({ type: 'portrait', ...picture, side: d.side === 'right' ? 'right' : 'left', text: text(d.text) });
        break;
      case 'quote':
        out.push({ type: 'quote', text: text(d.text), attribution: text(d.attribution) });
        break;
      case 'callout':
        out.push({
          type: 'callout',
          kind: d.kind === 'tip' || d.kind === 'warn' ? d.kind : 'info',
          title: text(d.title),
          text: text(d.text),
        });
        break;
      case 'links':
        out.push({
          type: 'links',
          items: (Array.isArray(d.items) ? (d.items as Loose[]) : []).map((i) => ({
            label: text(i?.label),
            url: text(i?.url),
            note: text(i?.note),
          })),
        });
        break;
      case 'button':
        out.push({ type: 'button', label: text(d.label), url: text(d.url) });
        break;
      case 'divider':
        out.push({ type: 'divider', style: d.style === 'dots' ? 'dots' : 'rule' });
        break;
    }
  }
  return out;
}

const altOf = (s: { alt: string; decorative: boolean }) => (s.decorative ? '' : s.alt);

/**
 * What the build would stop on, found while the author is still typing. The form cannot say "alt text is needed unless the
 * picture is decorative" (every field is just required or optional), so the preview does.
 */
export function previewProblems(value: unknown): string[] {
  const names = { image: 'Image', portrait: 'Portrait and text' } as const;
  return looseSections(value).flatMap((s, i) =>
    (s.type === 'image' || s.type === 'portrait') && !s.decorative && !s.alt.trim()
      ? [`Block ${i + 1} (${names[s.type]}) needs alt text: describe the picture, or turn on "Decorative image".`]
      : [],
  );
}

/** The warning box shown above the preview, or nothing when all is well. */
export function problemsHtml(problems: string[]): string {
  return problems.length
    ? `<div class="callout bad art-callout" role="note"><p class="art-callout-title"><strong>Fix before saving.</strong></p><div class="art-callout-body"><ul>${problems.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul></div></div>`
    : '';
}

type ProseBlock = Exclude<Section, { type: 'portrait' }>;

function blockHtml(block: ProseBlock, resolve: ResolveAsset): string {
  switch (block.type) {
    case 'heading':
      return `<h${block.level}>${headingText(block.text)}</h${block.level}>`;
    case 'text':
      return markdownHtml(block.text);
    case 'image':
      return figureHtml({ src: block.image, alt: altOf(block), caption: block.caption }, resolve);
    case 'quote':
      return quoteHtml({ body: block.text, cite: block.attribution });
    case 'callout':
      return calloutHtml({ type: block.kind, title: block.title, body: block.text });
    case 'links':
      return `<ul class="link-list">${block.items
        .map(
          (i) =>
            `<li><a href="${escapeHtml(safeLink(i.url))}">${escapeHtml(i.label)}${i.note ? `<span class="where">${escapeHtml(i.note)}</span>` : ''}${icon(isExternal(i.url) ? 'external' : 'arrow')}</a></li>`,
        )
        .join('')}</ul>`;
    case 'button':
      return `<p class="sec-button"><a class="btn solid" href="${escapeHtml(safeLink(block.url))}">${escapeHtml(block.label)}${isExternal(block.url) ? icon('external') : ''}</a></p>`;
    case 'divider':
      return dividerHtml({ variant: block.style });
  }
}

const PREVIEW_ROW = 'container wide sec-row';

/** The `.sections` element of the page (Sections.astro), from the blocks as the editor holds them. */
export function sectionsHtml(value: unknown, resolve: ResolveAsset): string {
  const rows = layoutSections(looseSections(value));
  const html = rows
    .map((row) => {
      if (row.kind === 'picture') {
        const { block } = row;
        const figure = figureHtml(
          { src: block.image, alt: altOf(block), caption: block.caption, align: block.width === 'full' ? 'full' : 'center' },
          resolve,
        );
        return `<div class="${block.width === 'full' ? 'sec-row sec-row-full' : PREVIEW_ROW}">${figure}</div>`;
      }
      if (row.kind === 'split') {
        const { portrait, lead } = row;
        const url = portrait.image ? resolve(portrait.image) : '';
        const picture = url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(altOf(portrait))}" />` : PLACEHOLDER;
        const heading = lead ? `<h${lead.level}>${headingText(lead.text)}</h${lead.level}>` : '';
        const body = [markdownHtml(portrait.text), ...row.blocks.map((b) => blockHtml(b, resolve))].join('');
        return `<div class="${PREVIEW_ROW}"><div class="about-grid" data-side="${portrait.side}"><div class="portrait">${picture}</div><div class="prose">${heading}${body}</div></div></div>`;
      }
      return `<div class="${PREVIEW_ROW}"><div class="prose">${row.blocks.map((b) => blockHtml(b, resolve)).join('')}</div></div>`;
    })
    .join('');
  return `<div class="sections">${html}</div>`;
}
