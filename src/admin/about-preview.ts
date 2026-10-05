// The About page preview: the page head and the blocks as the site lays them out, drawn with the site's own CSS (main.ts loads
// it into the preview pane), the same approach as the blog preview (preview.ts). Decap runs this component in the preview
// iframe each time a field changes.
//
// What is exact: the stylesheets, the class names and the markup of the heading and the blocks (sections-html.ts copies
// Sections.astro), and the grouping of blocks into rows (the page's own `layoutSections`).
// What is approximated: the Markdown in text boxes is read by a small reader (headings, paragraphs, lists, bold, italic, code,
// links), not the site's full one; the site header and footer are not drawn; and the pane is narrower than the window, so a
// portrait that sits beside the text on the site (900px and wider) may stack above it here, as it does on a phone.
import { createElement as h, type MouseEvent } from 'react';
import type { PreviewTemplateComponentProps } from 'decap-cms-core';
import { titleParts } from '../lib/text';
import type { GetAsset } from './preview-html';
import { problemsHtml, previewProblems, sectionsHtml } from './sections-html';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** A reader is not navigating away from an editor: links in the preview do nothing. */
const keepOnPage = (event: MouseEvent) => {
  if ((event.target as Element).closest('a')) event.preventDefault();
};

export interface AboutPreviewOptions {
  /** The icon sprite markup (IconSprite.astro), so `<use href="#i-…">` resolves inside the preview frame. */
  sprite: string;
}

export function aboutPreview({ sprite }: AboutPreviewOptions) {
  return function AboutPreview({ entry, getAsset, fields }: PreviewTemplateComponentProps) {
    const data = (entry.get('data')?.toJS() ?? {}) as Record<string, unknown>;
    const title = str(data.title) || 'About';

    // Pictures chosen but not saved yet are blob: URLs that only Decap can turn into something the frame can load.
    const sectionsField = fields?.find((f) => f.get('name') === 'sections');
    const resolve = (path: string): string => {
      try {
        return String((getAsset as unknown as GetAsset)(path, sectionsField) ?? '') || path;
      } catch {
        return path;
      }
    };

    return h(
      'div',
      { className: 'admin-preview', onClick: keepOnPage },
      h('div', { dangerouslySetInnerHTML: { __html: sprite } }),
      h(
        'p',
        { className: 'admin-preview-note' },
        'Preview: the page with the site’s own styles. The header and footer are not shown. Text is read by a simplified Markdown reader, and this pane is narrower than the page, so a portrait beside the text may sit above it here.',
      ),
      h('div', { className: 'container wide', dangerouslySetInnerHTML: { __html: problemsHtml(previewProblems(data.sections)) } }),
      h(
        'div',
        { className: 'container wide' },
        h(
          'header',
          { className: 'page-head' },
          h('h1', null, titleParts(title).map((part, i) => (part.em ? h('em', { key: i }, part.text) : part.text))),
        ),
      ),
      h('div', { dangerouslySetInnerHTML: { __html: sectionsHtml(data.sections, resolve) } }),
    );
  };
}
