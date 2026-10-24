import { existsSync, readFileSync } from 'node:fs';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { z } from 'astro/zod';
import { describe, expect, it } from 'vitest';
import site from '../data/site.json';
import { alwaysHasValue, definitionOf, describeShape, sectionsSchema } from './sections';
import { BUTTON_PATTERN, fieldsOf, pageProblems, SITE_PAGES, sitePage, sitePageFields } from './site-pages';

// The home page and the listing pages as entries of the `pages` collection: every page has its file, every file reads with the
// collection's schema (the same fields as src/content.config.ts) and has what its page needs, and the rules say what they should.

// The `pages` schema as content.config.ts assembles it (that file imports astro:content, so it cannot be loaded here).
const pagesSchema = z
  .object({
    title: z.string().min(1).max(90),
    seoTitle: z.string().min(1).optional(),
    description: z.string().min(1).max(180),
    sections: sectionsSchema,
    ...sitePageFields,
  })
  .strict();

const read = (id: string) => parseFrontmatter(readFileSync(`src/content/pages/${id}.md`, 'utf8')).frontmatter as Record<string, unknown>;

describe('the site pages', () => {
  it('are the home page, Latest, the five archives, Apps and Tags, each at its address', () => {
    expect(SITE_PAGES.map((p) => [p.id, p.path])).toEqual([
      ['home', '/'],
      ['latest', '/latest/'],
      ['news', '/news/'],
      ['blog', '/blog/'],
      ['vlogs', '/vlogs/'],
      ['projects', '/projects/'],
      ['repos', '/repos/'],
      ['apps', '/apps/'],
      ['tags', '/tags/'],
    ]);
    expect(() => sitePage('nowhere')).toThrow(/There is no site page "nowhere"/);
  });

  it('each has its file, which the schema reads and which holds everything its page needs', () => {
    for (const page of SITE_PAGES) {
      const file = `src/content/pages/${page.id}.md`;
      expect(existsSync(file), file).toBe(true);
      const result = pagesSchema.safeParse(read(page.id));
      expect(result.success ? '' : JSON.stringify(result.error.issues), file).toBe('');
      expect(pageProblems(page, read(page.id)), file).toEqual([]);
    }
  });

  it('reads every block in the files as it is: a menu or number the schema gives a default (alwaysHasValue) may be left out, the build fills it in', () => {
    // The files are the author's, saved from /admin or written by an agent: a block without `order`, `look` or `count` is valid because
    // the schema supplies the default (this used to demand every one of them in the file, which failed on a Latest block without `order`).
    // What a block must have is what the schema requires: a field with a default is never "missing".
    for (const file of ['about', ...SITE_PAGES.map((p) => p.id)]) {
      const data = read(file);
      for (const list of ['sections', 'introSections', 'outroSections']) {
        for (const [i, block] of ((data[list] as Record<string, unknown>[] | undefined) ?? []).entries()) {
          const where = `${file}.md ${list} block ${i + 1} (${String(block.type)})`;
          const fields = describeShape(definitionOf(String(block.type))!.schema.shape);
          const missing = fields.filter((f) => f.required && !f.hasDefault && block[f.name] === undefined).map((f) => f.name);
          expect(missing, where).toEqual([]);
          // A field the file leaves out and the form always fills (alwaysHasValue) comes back from the schema as its default.
          const parsed = sectionsSchema.safeParse([block]);
          expect(parsed.success ? '' : JSON.stringify(parsed.error.issues), where).toBe('');
          for (const f of fields) if (alwaysHasValue(f) && block[f.name] === undefined) expect(parsed.data![0], where).toHaveProperty(f.name);
        }
      }
    }
  });

  it('accepts a Latest block as the editor wrote it without "order", and gives it the default (newest first)', () => {
    const block = { type: 'latest', eyebrow: 'Writing about it', heading: 'Behind *Orbit Royale*', kinds: ['blog'], tag: 'orbit-royale', count: 3, look: 'section', ifEmpty: 'hide' };
    const parsed = sectionsSchema.safeParse([block]);
    expect(parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe('');
    expect(parsed.data![0]).toMatchObject({ type: 'latest', order: 'newest' });
    // The page that holds one (the Projects page) passes its own rules too.
    expect(pageProblems(sitePage('projects'), { ...read('projects') })).toEqual([]);
  });

  it('prints the site settings through tokens, never by typing their values (the settings stay the one place for them)', () => {
    const typed = [site.tagline, site.description];
    for (const page of SITE_PAGES) {
      const text = readFileSync(`src/content/pages/${page.id}.md`, 'utf8');
      for (const value of typed) expect(text, `${page.id}.md types "${value}"`).not.toContain(value);
    }
    expect(read('home').description).toBe('{site.description}');
    expect(read('latest').description).toBe('{site.description}');
  });

  it('holds the words the pages had in code, as text (a few anchors; tests/page-text.spec.js compares the rendered words with the files)', () => {
    // The words are the author's (edited in /admin), so this checks that each field the copy moved into is still there and
    // filled in, not what it says.
    const text = expect.stringMatching(/\S/);
    expect(read('home')).toMatchObject({ title: text, eyebrow: text, lead: text });
    expect(read('blog')).toMatchObject({ title: text, seoTitle: text, emptyHeading: text });
    expect(read('apps')).toMatchObject({ title: text, soonTitle: text, emptyLinkLabel: text, soonEyebrow: text });
    expect(read('tags')).toMatchObject({ title: text, emptyHeading: text });
    // The home page has its posts: the latest feed is one of its rows.
    expect((read('home').sections as { type: string }[]).map((s) => s.type)).toContain('feed');
  });
});

describe('pageProblems', () => {
  const blog = sitePage('blog');
  const complete = { title: 'T', description: 'D', lead: 'L', emptyHeading: 'E', emptyText: 'X' };

  it('names a field a page needs that is missing, or left empty in the editor', () => {
    expect(pageProblems(blog, complete)).toEqual([]);
    expect(pageProblems(blog, { ...complete, emptyHeading: undefined })).toEqual([
      'src/content/pages/blog.md: "emptyHeading" is missing (the heading shown when there is nothing to list).',
    ]);
    expect(pageProblems(blog, { ...complete, lead: '  ' })).toEqual(['src/content/pages/blog.md: "lead" is missing (the paragraph under the heading).']);
  });

  it('refuses a field the page does not draw, instead of ignoring it', () => {
    expect(pageProblems(blog, { ...complete, buttons: [{ label: 'B', url: '/x/' }] })).toEqual([
      'src/content/pages/blog.md: "buttons" (the hero buttons) is not used on this page: remove it.',
    ]);
    expect(pageProblems(blog, { ...complete, sections: [{ type: 'divider' }] })[0]).toMatch(/"sections" .* is not used on this page/);
    // The home page's browser title is the site name and tagline: a seoTitle there would do nothing.
    expect(pageProblems(sitePage('home'), { title: 'T', description: 'D', seoTitle: 'S' })[0]).toMatch(/"seoTitle" .* is not used/);
    // Empty lists and empty boxes are "not set", not a problem.
    expect(pageProblems(blog, { ...complete, buttons: [], soonTitle: '' })).toEqual([]);
    // The hero's waitlist switch is the home page's: on elsewhere it is refused, left off it is not set.
    expect(pageProblems(blog, { ...complete, waitlist: true })[0]).toMatch(/"waitlist" \(the waitlist form in the hero\) is not used/);
    expect(pageProblems(blog, { ...complete, waitlist: false })).toEqual([]);
    expect(pageProblems(sitePage('home'), { title: 'T', description: 'D', waitlist: true })).toEqual([]);
  });

  it('asks the Apps page for its own words: the empty state button and the card beside a single app', () => {
    expect(fieldsOf('apps').required).toEqual(expect.arrayContaining(['emptyLinkLabel', 'soonEyebrow', 'soonTitle', 'soonText']));
    expect(pageProblems(sitePage('apps'), complete).map((p) => p.match(/"(\w+)"/)?.[1])).toEqual(['emptyLinkLabel', 'soonEyebrow', 'soonTitle', 'soonText']);
  });
});

describe('the hero buttons', () => {
  it('go to another site, a page of this one, or a part of the home page; nothing else', () => {
    for (const ok of ['#latest', '#about', '/latest/', 'https://example.com/']) expect(BUTTON_PATTERN.test(ok), ok).toBe(true);
    for (const bad of ['javascript:alert(1)', '//evil.test/', 'http://example.com/', '#', 'latest', '# x']) expect(BUTTON_PATTERN.test(bad), bad).toBe(false);
  });

  it('are two at most, each with its text and a checked address', () => {
    const buttons = sitePageFields.buttons;
    expect(buttons.safeParse([{ label: 'A', url: '#latest' }, { label: 'B', url: '/x/' }]).success).toBe(true);
    expect(buttons.safeParse([{ label: 'A', url: '#a' }, { label: 'B', url: '#b' }, { label: 'C', url: '#c' }]).success).toBe(false);
    expect(buttons.safeParse([{ label: '', url: '#a' }]).success).toBe(false);
    expect(buttons.safeParse([{ label: 'A', url: 'javascript:x' }]).error?.issues[0].message).toMatch(/a button's address/);
  });
});
