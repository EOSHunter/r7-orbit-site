import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sitePage } from '../lib/site-pages';
import { heroHtml, listingStandInHtml, pageHeadHtml, pagePreviewProblems } from './page-preview-html';

// The previews of the home page and the listing pages: the same markup as the pages, the author's words escaped, and a stand-in
// that says in words what the build fills in.

const css = ['src/styles/site.css', 'src/styles/design-system/components.css'].map((f) => readFileSync(f, 'utf8')).join('\n');

describe('the home page preview', () => {
  const data = {
    eyebrow: 'Field notes',
    title: 'Plain notes on building with *AI agents*.',
    lead: 'A <b>lead</b>.',
    buttons: [
      { label: 'Start with the latest', url: '#latest' },
      { label: 'Elsewhere', url: 'javascript:alert(1)' },
    ],
  };

  it('draws the hero as index.astro does: eyebrow, h1 with its brass phrase, lead, first button solid', () => {
    const html = heroHtml(data);
    expect(html).toContain('<section class="hero plate-grid">');
    expect(html).toContain('<p class="eyebrow brass">Field notes</p>');
    expect(html).toContain('<h1 class="t-display">Plain notes on building with <em>AI agents</em>.</h1>');
    expect(html).toContain('<a class="btn solid lg" href="#latest">Start with the latest</a>');
    expect(html).toContain('<a class="btn lg" href="#">Elsewhere</a>');
  });

  it('escapes what the author typed, and survives an entry just opened', () => {
    expect(heroHtml(data)).toContain('A &lt;b&gt;lead&lt;/b&gt;.');
    expect(() => heroHtml({})).not.toThrow();
    expect(heroHtml({})).not.toMatch(/undefined|\[object/);
  });

  it('uses classes the site\'s stylesheets have', () => {
    for (const cls of ['hero', 'hero-grid', 'plate-grid', 't-display', 'cluster', 'page-head', 'app-soon', 'app-grid']) expect(css, cls).toContain(`.${cls}`);
  });
});

describe('a listing page preview', () => {
  const blog = sitePage('blog');
  const data = { title: 'Writing about *building with agents*', description: 'D', lead: 'Longer posts.', emptyHeading: 'No posts yet.', emptyText: 'Check back soon.' };

  it('draws the page head: the label (with its icon) from code, the heading and lead from the entry', () => {
    const html = pageHeadHtml(blog, data);
    expect(html).toContain('<header class="page-head"><p class="eyebrow brass"><svg class="ico" aria-hidden="true"><use href="#i-blog"></use></svg>Blog</p>');
    expect(html).toContain('<h1>Writing about <em>building with agents</em></h1>');
  });

  it('marks the list as a stand-in, then shows the words for an empty list', () => {
    const html = listingStandInHtml(blog, data);
    expect(html).toMatch(/<strong>Stand-in\.<\/strong> The posts are listed here/);
    expect(html).toContain('Made when the site is built');
    expect(html).toContain('<h2>No posts yet.</h2><p>Check back soon.</p>');
    expect(html).not.toContain('app-soon');
  });

  it('on the Apps page, also shows the empty state button and the card beside a single app', () => {
    const html = listingStandInHtml(sitePage('apps'), { emptyLinkLabel: 'See the projects', soonEyebrow: 'Next up', soonTitle: 'More apps coming', soonText: 'Soon.' });
    expect(html).toContain('The published apps and games are shown here');
    expect(html).toContain('<a class="btn" href="#">See the projects</a>');
    expect(html).toContain('<p class="eyebrow">Next up</p><h2 class="card-title">More apps coming</h2>');
  });

  it('lists what the build would stop on: a missing field, and a bad block above or below the list, each said where', () => {
    expect(pagePreviewProblems(blog, data)).toEqual([]);
    const problems = pagePreviewProblems(blog, { ...data, emptyText: '', introSections: [{ type: 'button', label: 'Go', url: 'nope' }], outroSections: [{ type: 'feed' }] });
    expect(problems[0]).toBe('"emptyText" is missing (the text shown when there is nothing to list).');
    expect(problems.some((p) => /^Above the list: Block 1 \(Button\)/.test(p))).toBe(true);
    expect(problems.some((p) => /^Below the list: Block 1 \(Latest feed\)/.test(p))).toBe(true);
  });

  it('on the home page, the rows are checked, including a second Latest feed', () => {
    const problems = pagePreviewProblems(sitePage('home'), {
      title: 'T',
      description: 'D',
      sections: [
        { type: 'feed', heading: 'Latest', emptyHeading: 'E', emptyText: 'X' },
        { type: 'feed', heading: 'Again', emptyHeading: 'E', emptyText: 'X' },
      ],
    });
    expect(problems).toEqual(['Rows: Block 2 (Latest feed): a page holds one Latest feed block at most: remove this one, or the other.']);
  });
});
