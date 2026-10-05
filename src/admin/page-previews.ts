// The previews of the home page and the listing pages (archives, Latest, Games, Tags) in the editor, the same approach as the About
// preview (about-preview.ts): the page with the site's own CSS (main.ts loads it into the preview pane), drawn from the entry as
// the author types. What comes from the posts (the cards, the pinned post, the games, the tags) cannot be drawn in the editor, so
// each such part is a stand-in that says what goes there (page-preview-html.ts, and the blocks' `previewNote`).
import { createElement as h, type MouseEvent } from 'react';
import type { PreviewTemplateComponentProps } from 'decap-cms-core';
import type { SitePage } from '../lib/site-pages';
import type { GetAsset } from './preview-html';
import { adminAuthors } from './authors';
import { heroHtml, listingStandInHtml, pageHeadHtml, pagePreviewProblems } from './page-preview-html';
import { problemsHtml, sectionsHtml } from './sections-html';

/** A reader is not navigating away from an editor: links in the preview do nothing. */
const keepOnPage = (event: MouseEvent) => {
  if ((event.target as Element).closest('a')) event.preventDefault();
};

const authors = adminAuthors.map((a) => ({ slug: a.slug, name: a.name, bio: a.bio, agent: a.kind === 'agent', subtitle: a.subtitle }));

const NOTE: Record<SitePage['shape'], string> = {
  home: 'Preview: the home page with the site’s own styles. The header, the footer, the newsletter band at the end and the orbit beside the headline are not shown. The rows that are made from the posts (pinned post, latest feed, latest posts, games) show a stand-in that says what goes there.',
  listing: 'Preview: the page with the site’s own styles. The header, the footer and the newsletter band at the end are not shown. The list itself is made from the posts when the site is built, so a stand-in says what goes there, followed by your words for when there is nothing to list.',
  games: 'Preview: the page with the site’s own styles. The header, the footer and the newsletter band at the end are not shown. The games are made from the projects when the site is built, so a stand-in says what goes there, followed by your words for when there is no game and for the card beside a single game.',
};

export interface PagePreviewOptions {
  /** The icon sprite markup (IconSprite.astro), so `<use href="#i-…">` resolves inside the preview frame. */
  sprite: string;
}

/** The preview of one site page (`page` says which, and its shape: home, a listing, or the Games hub). */
export function pagePreview(page: SitePage, { sprite }: PagePreviewOptions) {
  return function PagePreview({ entry, getAsset, fields }: PreviewTemplateComponentProps) {
    const data = (entry.get('data')?.toJS() ?? {}) as Record<string, unknown>;
    // Pictures chosen but not saved yet are blob: URLs that only Decap can turn into something the frame can load.
    const resolverFor = (name: string) => {
      const field = fields?.find((f) => f.get('name') === name);
      return (path: string): string => {
        try {
          return String((getAsset as unknown as GetAsset)(path, field) ?? '') || path;
        } catch {
          return path;
        }
      };
    };
    const blocks = (name: string) => sectionsHtml(data[name], resolverFor(name), authors);
    const html =
      page.shape === 'home'
        ? heroHtml(data) + blocks('sections')
        : pageHeadHtml(page, data) + blocks('introSections') + listingStandInHtml(page, data) + blocks('outroSections');

    return h(
      'div',
      {
        className: 'admin-preview',
        onClick: keepOnPage,
        // As on the site with JavaScript on (site.js adds `js` to <html>): some blocks are hidden without it.
        ref: (el: HTMLElement | null) => el?.ownerDocument.documentElement.classList.add('js'),
      },
      h('div', { dangerouslySetInnerHTML: { __html: sprite } }),
      h('p', { className: 'admin-preview-note' }, NOTE[page.shape]),
      h('div', { className: 'container wide', dangerouslySetInnerHTML: { __html: problemsHtml(pagePreviewProblems(page, data)) } }),
      h('div', { dangerouslySetInnerHTML: { __html: html } }),
    );
  };
}
