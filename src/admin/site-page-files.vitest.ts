import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { definitions } from '../lib/sections';
import { fieldsOf, SITE_PAGES, sitePageFields, BUTTON_PATTERN } from '../lib/site-pages';
import { buildConfig } from './config';
import { pagesCollection } from './pages';
import { sectionsDrift } from './sections-config';

// The home page and the listing pages in the editor: where each is saved, that its fields are the ones its page needs (no more, no
// fewer), with the schema's limits, and that its block lists are the library's.

type Field = Record<string, unknown>;
const files = (pagesCollection as unknown as { files: (Field & { fields: Field[] })[] }).files;
const named = (fields: Field[], name: string) => fields.find((f) => f.name === name) as Field;
/** The longest a box allows, read from its pattern (`^.{1,90}$` or `^[\s\S]{1,300}$`). */
const maxOf = (f: Field) => Number(/\{1,(\d+)\}\$$/.exec((f.pattern as string[] | undefined)?.[0] ?? '')?.[1]);
/** The schema's limit for a page field. */
const schemaMax = (name: string) => {
  const schema = sitePageFields[name as keyof typeof sitePageFields] as unknown as { unwrap?: () => { maxLength?: number } };
  return schema.unwrap?.().maxLength;
};

describe('the site pages in the Pages collection', () => {
  it('follow the About page, one file each, written to the file the site reads', () => {
    expect(files[0].name).toBe('about');
    expect(files.slice(1).map((f) => [f.name, f.file])).toEqual(SITE_PAGES.map((p) => [p.admin.name, `src/content/pages/${p.id}.md`]));
    for (const f of files.slice(1)) expect(f).toMatchObject({ format: 'frontmatter', editor: { preview: true } });
  });

  it('are named so their previews cannot be another collection\'s (Decap names a file\'s template after the file)', () => {
    const { collections } = buildConfig({ repo: 'o/n', branch: 'main', local: true });
    const taken = [...collections.map((c) => c.name), 'about'];
    for (const page of SITE_PAGES) expect(taken, page.admin.name).not.toContain(page.admin.name);
    expect(new Set(SITE_PAGES.map((p) => p.admin.name)).size).toBe(SITE_PAGES.length);
    // Each has a preview, registered under that name.
    expect(readFileSync('src/admin/main.ts', 'utf8')).toContain('for (const page of SITE_PAGES) CMS.registerPreviewTemplate(page.admin.name, pagePreview(page');
  });

  it('offer exactly the fields the page needs and may have; the needed ones are required in the form too', () => {
    for (const page of SITE_PAGES) {
      const fields = files.find((f) => f.name === page.admin.name)!.fields;
      const { required, optional } = fieldsOf(page.shape);
      expect(fields.map((f) => f.name).sort(), page.id).toEqual([...required, ...optional].sort());
      for (const f of fields) expect(f.required !== false, `${page.id}.${String(f.name)} required`).toBe(required.includes(f.name as never));
    }
  });

  it('allow what the schema allows: the same length limits, and the hero button addresses', () => {
    for (const f of files.slice(1).flatMap((file) => file.fields)) {
      if (f.name === 'title') expect(maxOf(f)).toBe(90);
      else if (f.name === 'description') expect(maxOf(f)).toBe(180);
      else if (f.widget === 'string' || f.widget === 'text') {
        if (f.name !== 'seoTitle') expect(maxOf(f), String(f.name)).toBe(schemaMax(String(f.name)));
      }
    }
    const buttons = named(files.find((f) => f.name === 'home')!.fields, 'buttons');
    expect(buttons).toMatchObject({ widget: 'list', max: 2, required: false });
    expect((named(buttons.fields as Field[], 'url').pattern as string[])[0]).toBe(BUTTON_PATTERN.source);
  });

  it('take their block lists from the library: every block, the same fields as the schema', () => {
    for (const file of files.slice(1)) {
      for (const list of file.fields.filter((f) => f.typeKey === 'type')) {
        const types = list.types as { name: string }[];
        expect(types.map((t) => t.name), `${String(file.name)}.${String(list.name)}`).toEqual(definitions.map((d) => d.id));
        expect(sectionsDrift(types as never)).toEqual([]);
      }
    }
    const home = files.find((f) => f.name === 'home')!.fields;
    expect(named(home, 'sections').label).toBe('Rows below the hero');
    const blog = files.find((f) => f.name === 'blog-archive')!.fields;
    expect([named(blog, 'introSections').label, named(blog, 'outroSections').label]).toEqual(['Sections above the list', 'Sections below the list']);
  });

  it('say in plain words what each box is for', () => {
    for (const f of files.slice(1).flatMap((file) => file.fields)) expect(String(f.hint ?? ''), String(f.name)).toMatch(/\S/);
  });
});
