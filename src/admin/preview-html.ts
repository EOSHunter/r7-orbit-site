// Markup for the editor's preview pane. The article blocks are rendered as the same HTML the components in
// src/components/article/ produce (same elements, classes and data attributes), so the site's real CSS styles them.
// Pure functions, no DOM and no Decap: they run under Vitest. preview-html.vitest.ts checks that every class used here
// still exists in the component it copies, because these are copies, not the components themselves (an Astro component
// cannot run in the browser).
//
// Decap sanitises the result with DOMPurify before showing it. That keeps `class` and `data-*`, but removes `<use>`, so
// the one icon a block needs (the play triangle) is drawn inline here.

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Only addresses that stay on the web or on this site: a pasted `javascript:` link is shown as plain text. */
const safeHref = (href: string): boolean => /^(https?:\/\/|\/|#)/i.test(href);

/** The inline Markdown a block's text box is likely to hold: `code`, **bold**, *italic*, [links](url). Everything is escaped first. */
export function inlineMarkdown(source: string): string {
  const pieces = source.split('`');
  return pieces
    .map((part, i) => {
      const s = escapeHtml(part);
      // An odd piece sits between two backticks. An unclosed backtick is kept as it was typed.
      if (i % 2 === 1) return i < pieces.length - 1 ? `<code>${s}</code>` : `\`${s}`;
      return s
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) =>
          safeHref(href) ? `<a href="${href}">${label}</a>` : label,
        );
    })
    .join('');
}

/** Paragraphs and simple lists, for the Markdown text boxes inside Callout, Quote and TwoColumn. */
export function blocksHtml(source: string): string {
  return source
    .trim()
    .split(/\n{2,}/)
    .filter((chunk) => chunk.trim())
    .map((chunk) => {
      const lines = chunk.split('\n').map((l) => l.trim());
      if (lines.every((l) => /^[-*] /.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inlineMarkdown(l.slice(2))}</li>`).join('')}</ul>`;
      }
      if (lines.every((l) => /^\d+[.)] /.test(l))) {
        return `<ol>${lines.map((l) => `<li>${inlineMarkdown(l.replace(/^\d+[.)] /, ''))}</li>`).join('')}</ol>`;
      }
      return `<p>${inlineMarkdown(lines.join(' '))}</p>`;
    })
    .join('');
}

/** The plate shown where a picture does not exist yet (MediaPlaceholder.astro). */
export const PLACEHOLDER = '<div class="media-ph"><img src="/assets/r7-mark-ivory.svg" alt="" /></div>';

/** Decap's `getAsset(path, field)`: the URL of an image, including one that is chosen but not yet saved. Its typings omit `field`. */
export type GetAsset = (path: string, field?: unknown) => { toString(): string } | undefined;

/** Turns the path an author picked into a URL the preview can load; '' when it cannot be resolved (yet). */
export type ResolveAsset = (path: string) => string;

const caption = (c: unknown) => (text(c) ? `<figcaption>${escapeHtml(text(c))}</figcaption>` : '');

/** Shown under a picture that has no alt text yet. The admin refuses to save such a post (src/admin/image-rules.ts). */
export const ALT_WARNING =
  '<p class="admin-alt-warning" role="alert"><strong>No alt text.</strong> Add it in the image form, or tick "Decoration only". The post cannot be saved without it.</p>';

function picture(src: unknown, alt: unknown, resolve: ResolveAsset, decorative: unknown = false): string {
  const url = text(src) ? resolve(text(src)) : '';
  if (!url) return `<div class="media">${PLACEHOLDER}</div>`;
  const missing = decorative !== true && !text(alt).trim();
  return `<img class="art-img" src="${escapeHtml(url)}" alt="${escapeHtml(decorative === true ? '' : text(alt))}" />${missing ? ALT_WARNING : ''}`;
}

export function figureHtml(d: Record<string, unknown>, resolve: ResolveAsset): string {
  return `<figure class="art-fig" data-align="${escapeHtml(text(d.align) || 'center')}" data-size="${escapeHtml(text(d.size) || 'lg')}">${picture(d.src, d.alt, resolve, d.decorative)}${caption(d.caption)}</figure>`;
}

const CALLOUT = {
  info: { classes: 'callout', label: 'Note' },
  tip: { classes: 'callout brass', label: 'Tip' },
  warn: { classes: 'callout bad', label: 'Warning' },
} as const;

export function calloutHtml(d: Record<string, unknown>): string {
  const type = (text(d.type) in CALLOUT ? text(d.type) : 'info') as keyof typeof CALLOUT;
  const { classes, label } = CALLOUT[type];
  const title = text(d.title) || label;
  return `<div class="${classes} art-callout" role="note" data-type="${type}"><p class="art-callout-title"><strong>${escapeHtml(title)}.</strong></p><div class="art-callout-body">${blocksHtml(text(d.body))}</div></div>`;
}

export function quoteHtml(d: Record<string, unknown>): string {
  const cite = text(d.cite);
  const href = text(d.href);
  const who = cite ? (href && safeHref(href) ? `<a href="${escapeHtml(href)}">${escapeHtml(cite)}</a>` : escapeHtml(cite)) : '';
  return `<figure class="art-quote"><blockquote>${blocksHtml(text(d.body))}</blockquote>${who ? `<figcaption>${who}</figcaption>` : ''}</figure>`;
}

export function imageRowHtml(images: Record<string, unknown>[], resolve: ResolveAsset): string {
  const items = images
    .map((i) => `<figure class="art-fig">${picture(i.src, i.alt, resolve, i.decorative)}${caption(i.caption)}</figure>`)
    .join('');
  return `<figure class="art-row" data-count="${images.length}"><div class="art-row-grid">${items}</div></figure>`;
}

export function twoColumnHtml(d: Record<string, unknown>): string {
  const ratio = ['1:1', '2:1', '1:2'].includes(text(d.ratio)) ? text(d.ratio) : '1:1';
  return `<div class="art-cols" data-ratio="${ratio}"><div class="art-col">${blocksHtml(text(d.left))}</div><div class="art-col">${blocksHtml(text(d.right))}</div></div>`;
}

/** The click-to-load player as it looks before play (YouTubeFacade.astro). Nothing is requested from YouTube. */
export function videoHtml(d: Record<string, unknown>): string {
  const title = text(d.title) || 'Video';
  return `<figure class="art-video"><div class="yt"><div class="player">${PLACEHOLDER}<button class="play" type="button" aria-label="Play video: ${escapeHtml(title)}"><span><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11L13 8 4 2.5Z"></path></svg></span></button></div></div>${caption(d.caption)}</figure>`;
}

export function dividerHtml(d: Record<string, unknown>): string {
  return text(d.variant) === 'dots'
    ? '<div class="art-divider" role="separator" data-variant="dots"><span></span><span></span><span></span></div>'
    : '<hr class="art-divider" data-variant="rule" />';
}

// ---- Headings, for the contents list ------------------------------------------------------------------------------

export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** The H2 and H3 headings of a Markdown body (outside code fences), the way the site's contents list reads them. */
export function headingsOf(markdown: string): Heading[] {
  const found: Heading[] = [];
  const seen = new Map<string, number>();
  let fence: string | undefined;
  for (const line of markdown.split('\n')) {
    const marker = /^\s*(```|~~~)/.exec(line)?.[1];
    if (marker) {
      fence = fence === marker ? undefined : (fence ?? marker);
      continue;
    }
    if (fence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const plain = match[2]
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`]/g, '')
      .trim();
    let slug = slugify(plain);
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    if (count) slug = `${slug}-${count}`;
    found.push({ depth: match[1].length, slug, text: plain });
  }
  return found;
}
