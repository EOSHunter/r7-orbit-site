import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { seoTitleMax } from '../lib/seo';
import site from '../data/site.json';
import { buildConfig } from './config';
import { pageCollections, pagesCollection } from './pages';

// The Pages collection: the page's own fields and where it is saved. Its block list (`sections`) is generated from the block
// library and checked against the schema in sections-config.vitest.ts.

type Field = Record<string, unknown>;

const about = (pagesCollection as unknown as { files: Field[] }).files[0];
const pageFields = about.fields as Field[];
const named = (fields: Field[], name: string) => fields.find((f) => f.name === name) as Field;

describe('the Pages collection', () => {
  it('is a file collection with the About page, written to the file the site reads', () => {
    expect(pagesCollection.name).toBe('pages');
    expect(about).toMatchObject({ name: 'about', file: 'src/content/pages/about.md', format: 'frontmatter' });
    expect(readFileSync('src/content/pages/about.md', 'utf8')).toMatch(/^---/);
    expect((pagesCollection as unknown as { delete: boolean }).delete, 'the About page cannot be deleted from the editor').toBe(false);
  });

  it('is in the editor after the post collections and the authors', () => {
    const { collections } = buildConfig({ repo: 'o/n', branch: 'main', local: true });
    expect(collections.map((c) => c.name)).toEqual(['blog', 'news', 'vlogs', 'projects', 'repos', 'authors', 'pages', 'settings']);
    expect(pageCollections).toEqual([pagesCollection]);
  });

  it('has a live preview, registered under the file name (Decap names a file collection template after the file)', () => {
    expect((about.editor as { preview: boolean }).preview).toBe(true);
    const main = readFileSync('src/admin/main.ts', 'utf8');
    expect(main).toContain(`registerPreviewTemplate('${about.name}'`);
    expect(main).toContain('sections.css?inline');
  });

  it('uploads pictures to public/media/about, written as /media/about/x.jpg', () => {
    expect(pagesCollection).toMatchObject({ media_folder: '/public/media/about', public_folder: '/media/about' });
  });

  it('has the page fields of the schema under the schema names, and the rules the schema has', () => {
    expect(pageFields.map((f) => f.name)).toEqual(['title', 'seoTitle', 'description', 'sections']);
    const seo = named(pageFields, 'seoTitle');
    expect(seo.required).toBe(false);
    expect(new RegExp((seo.pattern as string[])[0]).test('x'.repeat(seoTitleMax(site.name)))).toBe(true);
    expect(new RegExp((seo.pattern as string[])[0]).test('x'.repeat(seoTitleMax(site.name) + 1))).toBe(false);
    expect(String(seo.hint)).toContain(`Max ${seoTitleMax(site.name)} characters`);
    expect(String(named(pageFields, 'description').hint)).toMatch(/155/);
  });
});
