import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SITE_PAGES } from '../lib/site-pages';
import { FRAMED_PAGES, pagesCollection } from './pages';

// Privacy, 404 and search in the Pages collection: one file entry each, the About page's four fields under the
// schema's names (there is one `pages` schema), the same block list, a hint that says where the blocks land, and a preview.

type Field = Record<string, unknown>;
const files = (pagesCollection as unknown as { files: Field[] }).files;
const named = (name: string) => files.find((f) => f.name === name) as Field;
const fieldsOf = (file: Field) => file.fields as Field[];
const sectionsOf = (file: Field) => fieldsOf(file).find((f) => f.name === 'sections') as Field;

describe('the fixed-frame pages in the Pages collection', () => {
  it('come after About, one entry per page file, each written to the file the site reads', () => {
    // About first, then the home page and the listing pages (site-page-files.ts), then these four.
    expect(files.map((f) => f.name)).toEqual(['about', ...SITE_PAGES.map((p) => p.admin.name), 'privacy', '404', 'search']);
    expect(FRAMED_PAGES).toEqual(['privacy', '404', 'search']);
    for (const name of FRAMED_PAGES) {
      expect(named(name)).toMatchObject({
        file: `src/content/pages/${name}.md`,
        format: 'frontmatter',
        editor: { preview: true },
      });
      expect(existsSync(`src/content/pages/${name}.md`)).toBe(true);
    }
  });

  it('have the About page fields and the same block list, with hints of their own that name the settings tokens', () => {
    const about = named('about');
    for (const name of FRAMED_PAGES) {
      const file = named(name);
      expect(fieldsOf(file).map((f) => f.name)).toEqual(fieldsOf(about).map((f) => f.name));
      expect(sectionsOf(file).types).toEqual(sectionsOf(about).types);
      for (const f of fieldsOf(file))
        expect(f.pattern ?? null, `${name}.${String(f.name)}`).toEqual(
          fieldsOf(about).find((a) => a.name === f.name)!.pattern ?? null,
        );
      expect(String(sectionsOf(file).hint)).toContain('{site.name}');
      expect(String(sectionsOf(file).hint)).not.toBe(String(sectionsOf(about).hint));
    }
  });

  it('have a live preview, registered under each file name', () => {
    const main = readFileSync('src/admin/main.ts', 'utf8');
    expect(main).toMatch(/for \(const name of FRAMED_PAGES\) CMS\.registerPreviewTemplate\(name, framedPreview\(name/);
  });
});
