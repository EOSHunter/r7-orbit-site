// The blog post preview: the post as the site lays it out (ArticlePage: hero, headline block, reading column, contents
// list), drawn with the site's own CSS, which main.ts loads into the preview pane. Decap runs this component in the
// preview iframe each time a field changes.
//
// What is exact: the stylesheets, the class names and the markup of the hero, breadcrumb, headline, byline, contents list
// and prose; the article blocks (preview-html.ts copies their markup). What is approximated, and why, is in the README
// ("What the preview does not show").
import { createElement as h, Fragment, type MouseEvent, type ReactNode } from 'react';
import type { PreviewTemplateComponentProps } from 'decap-cms-core';
import { WORDS_PER_MINUTE, countWords } from '../lib/content';
import { longDate, isoDate, plainTitle, titleParts } from '../lib/text';
import { headingsOf, type GetAsset, type Heading } from './preview-html';

type Data = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** A reader is not navigating away from an editor: links in the preview do nothing. */
const keepOnPage = (event: MouseEvent) => {
  if ((event.target as Element).closest('a')) event.preventDefault();
};

function icon(name: string): ReactNode {
  return h('svg', { className: 'ico', 'aria-hidden': true }, h('use', { href: `#i-${name}` }));
}

/** The contents list, in the two shapes of TableOfContents.astro: the aside (wide) and the <details> (narrow). */
function contents(headings: Heading[], variant: 'aside' | 'inline'): ReactNode {
  const tree: { heading: Heading; children: Heading[] }[] = [];
  for (const heading of headings) {
    if (heading.depth === 2) tree.push({ heading, children: [] });
    else if (tree.length) tree[tree.length - 1].children.push(heading);
  }
  if (!tree.length) return null;
  const list = h(
    'ol',
    null,
    tree.map(({ heading, children }) =>
      h(
        'li',
        { key: heading.slug },
        h('a', { href: `#${heading.slug}` }, heading.text),
        children.length
          ? h(
              'ol',
              null,
              children.map((c) => h('li', { key: c.slug }, h('a', { href: `#${c.slug}` }, c.text))),
            )
          : null,
      ),
    ),
  );
  return variant === 'aside'
    ? h('aside', { className: 'toc toc-aside' }, h('nav', { 'aria-label': 'On this page' }, h('p', { className: 'eyebrow' }, 'On this page'), list))
    : h('details', { className: 'toc-inline' }, h('summary', null, 'On this page'), h('nav', { 'aria-label': 'On this page (short screens)' }, list));
}

export interface PreviewOptions {
  /** The icon sprite markup (IconSprite.astro), so `<use href="#i-…">` resolves inside the preview frame. */
  sprite: string;
  authorName: string;
  /** slug -> name of every author, so the preview shows a name and not the slug the form stores. */
  authorNames?: Record<string, string>;
}

export function blogPreview({ sprite, authorName, authorNames = {} }: PreviewOptions) {
  return function BlogPreview({ entry, widgetFor, getAsset, fields }: PreviewTemplateComponentProps) {
    const data = (entry.get('data')?.toJS() ?? {}) as Data;
    const body = str(data.body);
    const title = str(data.title) || 'Untitled post';
    const summary = str(data.summary);
    const tags = (Array.isArray(data.tags) ? data.tags : []).filter((t): t is string => typeof t === 'string' && !!t);
    const author = authorNames[str(data.author)] ?? (str(data.author) || authorName);
    const published = str(data.date);
    const updated = str(data.updated);
    const minutes = Number(data.readTime) > 0 ? Number(data.readTime) : Math.max(1, Math.ceil(countWords(body) / WORDS_PER_MINUTE));

    const assetFor = (name: string, path: string): string => {
      if (!path) return '';
      const field = fields?.find((f) => f.get('name') === name);
      try {
        return String((getAsset as unknown as GetAsset)(path, field) ?? '');
      } catch {
        return '';
      }
    };
    const featured = assetFor('featuredImage', str(data.featuredImage));
    const cover = assetFor('cover', str(data.cover));

    // The same rule as ArticlePage: a contents list for three or more H2s, unless `toc` says otherwise.
    const headings = headingsOf(body);
    const showToc = data.toc !== false && (data.toc === true || headings.filter((x) => x.depth === 2).length >= 3);

    const date = (iso: string) => {
      try {
        return h('time', { dateTime: isoDate(iso) }, longDate(iso));
      } catch {
        return null;
      }
    };

    const head = h(
      Fragment,
      null,
      h(
        'nav',
        { className: 'breadcrumb', 'aria-label': 'Breadcrumb' },
        h(
          'ol',
          null,
          h('li', null, h('a', { href: '/' }, 'Home')),
          h('li', null, h('a', { href: '/blog/' }, 'Blog')),
          h('li', { 'aria-current': 'page' }, plainTitle(title)),
        ),
      ),
      h(
        'header',
        { className: 'post-head' },
        h(
          'p',
          { className: 'eyebrow' },
          h('span', { className: 'kind' }, icon('blog'), 'Blog'),
          h('span', { className: 'sep', 'aria-hidden': true }, '·'),
          h('span', null, `${minutes} min read`),
        ),
        h('h1', null, titleParts(title).map((part, i) => (part.em ? h('em', { key: i }, part.text) : part.text))),
        summary ? h('p', { className: 't-lead' }, summary) : null,
        h(
          'div',
          { className: 'byline' },
          h(
            'span',
            { className: 'author' },
            h('span', { className: 'avatar', 'aria-hidden': true }, h('img', { src: '/assets/r7-mark.svg', alt: '' })),
            author,
          ),
          published ? h('span', { className: 'meta-item' }, icon('calendar'), date(published)) : null,
          h('span', { className: 'meta-item' }, icon('clock'), `${minutes} min read`),
          updated ? h('span', { className: 'meta-item' }, 'Updated ', date(updated)) : null,
          tags.length
            ? h(
                'div',
                { className: 'cluster tags', 'aria-label': 'Tags' },
                tags.map((tag) => h('a', { key: tag, className: 'chip link', href: `/tags/${tag}/` }, tag)),
              )
            : null,
        ),
        data.aiAssist === 'edited' || data.aiAssist === 'drafted'
          ? h(
              'p',
              { className: 'how-made' },
              h('strong', null, 'How this was made.'),
              ' ',
              data.aiAssist === 'edited' ? 'Written by me and edited with AI help.' : 'The first draft was written with AI help.',
            )
          : null,
      ),
    );

    return h(
      'div',
      {
        className: 'admin-preview',
        onClick: keepOnPage,
        // The site's script puts `js` on <html> (the stylesheet hides the video play button without it). This is the
        // preview frame's own <html>, not the editor's.
        ref: (el: HTMLElement | null) => el?.ownerDocument.documentElement.classList.add('js'),
      },
      h('div', { dangerouslySetInnerHTML: { __html: sprite } }),
      h(
        'p',
        { className: 'admin-preview-note' },
        'Preview: the post as it will look. The site header, share row, related posts and next/previous links are not shown.',
      ),
      // ArticleHero: with a featured image the headline sits on it under a dark gradient, without one it is just the header.
      featured
        ? h(
            'div',
            { className: 'article-hero' },
            h('img', { className: 'article-hero-img', src: featured, alt: str(data.featuredImageAlt) }),
            h('div', { className: 'article-hero-shade', 'aria-hidden': true }),
            h('div', { className: 'container article-hero-body' }, head),
          )
        : h('div', { className: 'container' }, head),
      h(
        'div',
        { className: 'container art-template' },
        cover
          ? h('div', { className: 'media framed post-hero' }, h('img', { src: cover, alt: str(data.coverAlt), width: 1280, height: 720 }))
          : null,
        h(
          'div',
          { className: 'post-layout' },
          h(
            'div',
            { className: 'post-main' },
            showToc ? contents(headings, 'inline') : null,
            h('article', { className: 'prose art-prose', id: 'article' }, widgetFor('body')),
          ),
          showToc ? contents(headings, 'aside') : null,
        ),
      ),
    );
  };
}
