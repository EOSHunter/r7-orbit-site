import { readdirSync, readFileSync } from 'node:fs';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { describe, expect, it } from 'vitest';
import { POST_KINDS } from '../lib/content-schemas';
import { authorNames } from './authors';
import { collections } from './config';
import { authorSlugProblems, contentProblems, mdxProblems, schemaProblems, videoProblems } from './content-check';
import { youtubeIdFrom } from './blocks';
import { fieldLabels } from './field-labels';

const labelsOf = fieldLabels({ collections });
const authors = Object.keys(authorNames);
const check = (collection: string, data: Record<string, unknown>) => contentProblems(collection, data, { labels: labelsOf(collection), authors });

/** A real file as the editor holds it: the front matter, plus the body under `body`. */
const entryOf = (path: string) => {
  const { frontmatter, content } = parseFrontmatter(readFileSync(path, 'utf8'));
  return { ...frontmatter, body: content };
};

describe('the editor runs the build’s rules: everything already on the site passes', () => {
  for (const kind of [...POST_KINDS, 'pages']) {
    const dir = `src/content/${kind}`;
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((f) => /\.mdx?$/.test(f));
    } catch {
      // A kind with no posts yet.
    }
    for (const file of files) {
      it(`${kind}/${file}`, () => expect(check(kind, entryOf(`${dir}/${file}`))).toEqual([]));
    }
  }
  for (const file of readdirSync('src/content/authors')) {
    it(`authors/${file}`, () => expect(check('authors', JSON.parse(readFileSync(`src/content/authors/${file}`, 'utf8')))).toEqual([]));
  }
});

describe('what the audit of 2026-11-06 found the editor let through', () => {
  const blog = { title: 'A post', date: '2026-11-06', summary: 'One line.', tags: [], body: 'Words.' };

  it('a series without its part number, named by the box the author sees', () => {
    expect(schemaProblems('blog', { ...blog, series: 'Building R7' }, labelsOf('blog'))).toEqual([
      'Part number in the series: seriesOrder is required when series is set',
    ]);
  });

  it('a picture block with no alt text that is not marked decorative', () => {
    const sections = [{ type: 'image', image: '/media/blog/a.png', alt: '' }];
    const problems = check('blog', { ...blog, body: '', sections });
    expect(problems.join(' ')).toMatch(/alt/i);
  });

  it('a vlog with neither a YouTube id nor a video address', () => {
    expect(check('vlogs', { ...blog, duration: '1:23' }).join(' ')).toMatch(/set youtubeId or videoUrl/);
  });

  it('a project that opens a page of this site in the default "embed" mode', () => {
    expect(check('projects', { ...blog, status: 'shipped', playUrl: '/ascent/' }).join(' ')).toMatch(/opens as a link/);
  });

  it('an agent author without a name or a bio', () => {
    expect(check('authors', { slug: 'bot', kind: 'agent' })).toHaveLength(2);
  });

  it('an existing author whose slug is changed (posts would credit someone the site does not have); a new one may pick any', () => {
    expect(authorSlugProblems('authors', { slug: 'orion-2' }, { slug: 'orion', isNew: false })[0]).toMatch(/^Slug: this author is "orion"/);
    expect(authorSlugProblems('authors', { slug: 'orion' }, { slug: 'orion', isNew: false })).toEqual([]);
    expect(authorSlugProblems('authors', { slug: 'nova' }, { slug: '', isNew: true })).toEqual([]);
    expect((collections.find((c) => c.name === 'authors') as unknown as { delete: boolean }).delete).toBe(false);
  });

  it('a post credited to an author the site does not have', () => {
    expect(check('blog', { ...blog, author: 'nobody' })).toEqual(['Author: there is no author "nobody". Choose one from the list.']);
    expect(check('blog', { ...blog, author: authors[0] })).toEqual([]);
  });

  it('an email address anywhere in what is published', () => {
    expect(check('repos', { ...blog, repo: 'o/n', install: 'git clone git@github.com:o/n.git' }).join(' ')).toMatch(/email/);
  });
});

describe('a Video block in a blog body', () => {
  it('reads a live link, and refuses what is not a YouTube id', () => {
    expect(youtubeIdFrom('https://www.youtube.com/live/dQw4w9WgXcQ?si=x')).toBe('dQw4w9WgXcQ');
    expect(videoProblems('blog', { body: '<VideoEmbed id="dQw4w9WgXcQ" title="A" />' })).toEqual([]);
    expect(videoProblems('blog', { body: '<VideoEmbed id="https://vimeo.com/1234" title="A" />' })[0]).toMatch(/^Video block: "https:\/\/vimeo.com\/1234" is not/);
  });
});

describe('a blog body that MDX cannot read', () => {
  it('refuses a stray brace, a "<" against a word, an unclosed tag and an autolink, with the line', () => {
    for (const body of ['Fine line.\n\nA set {like this}.', 'x <= y', 'Use <div> here.', 'See <https://example.org>.']) {
      expect(mdxProblems('blog', { body }), body).toHaveLength(1);
    }
    expect(mdxProblems('blog', { body: 'Fine line.\n\nA set {like this}.' })[0]).toMatch(/^Body, line 3: /);
  });

  it('reads Markdown, components and code as the build does', () => {
    const body = 'Text with `{code}` and **bold**.\n\n<Figure src="/src/assets/blog/a.png" alt="A chart" />\n\n```js\nconst a = { b: 1 } < 2;\n```\n';
    expect(mdxProblems('blog', { body })).toEqual([]);
    // Other kinds are Markdown, where a brace is only text.
    expect(mdxProblems('news', { body: 'A set {like this}.' })).toEqual([]);
  });
});
