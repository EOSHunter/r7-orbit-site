// The preview of a news item, a vlog, a project or a repo: a simpler one than the blog's (preview.ts). It draws the page head
// (breadcrumb, kind, headline, summary, author and date), what each kind shows above its body (a news item's source and take, a vlog's
// player as it looks before play) and the body: the sections in the post's column (sections-html.ts, the same as the blog preview), or
// the Markdown body. Drawn with the site's own CSS, which main.ts loads into the preview pane.
//
// What is approximated, and said in the note at the top of the pane: the facts column of a vlog, project or repo, a project's play
// section, gallery and changelog, and a repo's README and GitHub numbers are not drawn (they come from the front matter or from GitHub,
// not from the body); a vlog's player is the stand-in shown before play; the site header, related posts and next/previous links are left
// out; and a Markdown body is drawn by Decap's own Markdown preview, not the site's reader.
import { createElement as h, Fragment, type ReactNode } from 'react';
import type { PreviewTemplateComponentProps } from 'decap-cms-core';
import { isoDate, longDate, plainTitle, titleParts } from '../lib/text';
import { postBody } from './post-body';
import { videoHtml } from './preview-html';
import { icon, keepOnPage, previewAuthors, sectionsAssets } from './preview';
import { markdownHtml, problemsHtml, sectionsHtml } from './sections-html';

type Data = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** The kinds this preview draws, with what the page calls them (the eyebrow, the breadcrumb) and its icon. */
export const POST_PREVIEW_KINDS = {
  news: { label: 'News', one: 'News', icon: 'news', path: '/news/', body: 'the text' },
  vlogs: { label: 'Vlogs', one: 'Vlog', icon: 'vlog', path: '/vlogs/', body: 'the notes under the video' },
  projects: { label: 'Projects', one: 'Project', icon: 'project', path: '/projects/', body: 'the write-up' },
  repos: { label: 'Repos', one: 'Repo', icon: 'repo', path: '/repos/', body: 'the notes' },
} as const;
export type PreviewKind = keyof typeof POST_PREVIEW_KINDS;

/** One sentence per kind: what this preview leaves out, so the author does not look for it. */
export const NOT_DRAWN: Record<PreviewKind, string> = {
  news: 'The site header, share row, related posts and next/previous links are not shown.',
  vlogs: 'The player is the stand-in shown before play (nothing is requested from YouTube). The facts column, related videos and next/previous links are not shown.',
  projects: 'The play section, screenshots, changelog and the facts column come from the fields above and are not drawn here.',
  repos: 'The README and the numbers from GitHub are fetched when the site is built and are not drawn here, nor is the facts column.',
};

export interface PostPreviewOptions {
  kind: PreviewKind;
  /** The icon sprite markup (IconSprite.astro), so `<use href="#i-…">` resolves inside the preview frame. */
  sprite: string;
  authorName: string;
  /** slug -> name of every author, so the preview shows a name and not the slug the form stores. */
  authorNames?: Record<string, string>;
}

export function postPreview({ kind, sprite, authorName, authorNames = {} }: PostPreviewOptions) {
  const meta = POST_PREVIEW_KINDS[kind];
  return function PostPreview({ entry, widgetFor, getAsset, fields }: PreviewTemplateComponentProps) {
    const data = (entry.get('data')?.toJS() ?? {}) as Data;
    const body = postBody(data);
    const title = kind === 'repos' ? str(data.repo) || 'owner/name' : str(data.title) || 'Untitled';
    const author = authorNames[str(data.author)] ?? (str(data.author) || authorName);
    const published = str(data.date);
    const date = (() => {
      try {
        return published ? h('time', { dateTime: isoDate(published) }, longDate(published)) : null;
      } catch {
        return null;
      }
    })();

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
          h('li', null, h('a', { href: meta.path }, meta.label)),
          h('li', { 'aria-current': 'page' }, plainTitle(title)),
        ),
      ),
      h(
        'header',
        { className: kind === 'projects' ? 'project-head' : kind === 'repos' ? 'repo-head' : 'post-head' },
        h('p', { className: 'eyebrow' }, h('span', { className: 'kind' }, icon(meta.icon), meta.one)),
        h('h1', null, titleParts(title).map((part, i) => (part.em ? h('em', { key: i }, part.text) : part.text))),
        str(data.summary) ? h('p', { className: 't-lead' }, str(data.summary)) : null,
        h(
          'p',
          { className: 'post-author' },
          h('span', { className: 'author' }, author),
          date ? h(Fragment, null, ' · ', date) : null,
          kind === 'vlogs' && str(data.duration) ? ` · ${str(data.duration)}` : null,
        ),
      ),
    );

    // What the page shows between the head and the body.
    const before: ReactNode =
      kind === 'news' && str(data.sourceUrl)
        ? h(
            'aside',
            { className: 'source-box', 'aria-label': 'Source' },
            h('p', { className: 'eyebrow' }, 'Source'),
            h('p', { className: 'source-link' }, h('a', { href: str(data.sourceUrl) }, str(data.sourceName) || str(data.sourceUrl))),
            str(data.take) ? h('p', { className: 'source-take' }, h('span', null, 'My read:'), ' ', str(data.take)) : null,
          )
        : kind === 'vlogs'
          ? h('div', { dangerouslySetInnerHTML: { __html: videoHtml({ title }) } })
          : null;

    const content: ReactNode = body.sections.length
      ? h('div', {
          dangerouslySetInnerHTML: { __html: sectionsHtml(data.sections, sectionsAssets(getAsset, fields), previewAuthors, { layout: 'column' }) },
        })
      : h('div', { className: 'prose' }, widgetFor('body'));
    // A vlog written as sections keeps its transcript in its own Markdown field, folded on the page.
    const transcript = kind === 'vlogs' && body.sections.length && str(data.transcriptText).trim()
      ? h(
          'section',
          { className: 'block' },
          h('h2', { className: 'section-title' }, 'Transcript'),
          h(
            'details',
            { className: 'disclosure', open: true },
            h('summary', null, 'Show the transcript'),
            h('div', { className: 'inner prose', dangerouslySetInnerHTML: { __html: markdownHtml(str(data.transcriptText)) } }),
          ),
        )
      : null;

    return h(
      'div',
      {
        className: 'admin-preview',
        onClick: keepOnPage,
        // The site's script puts `js` on <html> (some blocks' buttons are hidden without it). This is the preview frame's own <html>.
        ref: (el: HTMLElement | null) => el?.ownerDocument.documentElement.classList.add('js'),
      },
      h('div', { dangerouslySetInnerHTML: { __html: sprite } }),
      h(
        'p',
        { className: 'admin-preview-note' },
        `Preview: the head of the page and ${meta.body}, with the site's own styles. ${NOT_DRAWN[kind]}`,
      ),
      body.problems.length ? h('div', { className: 'container', dangerouslySetInnerHTML: { __html: problemsHtml(body.problems) } }) : null,
      h(
        'div',
        { className: 'container' },
        head,
        before,
        h(
          'div',
          { className: 'split' },
          h(
            'div',
            null,
            h(
              'section',
              { className: 'block', 'aria-label': meta.body },
              kind === 'vlogs' ? h('h2', { className: 'section-title' }, 'About this video') : null,
              content,
            ),
            transcript,
          ),
        ),
      ),
    );
  };
}
