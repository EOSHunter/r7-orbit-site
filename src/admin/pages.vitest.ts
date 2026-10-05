import { readFileSync } from 'node:fs';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { describe, expect, it, vi } from 'vitest';
import { LINK_PATTERN, SECTION_TYPES, sectionSchema } from '../lib/page-sections';
import { seoTitleMax } from '../lib/seo';
import site from '../data/site.json';
import { buildConfig } from './config';
import { pageCollections, pagesCollection } from './pages';

// The real schema, so a block field added or renamed in src/lib/page-sections.ts fails here until the admin follows.
vi.mock('astro:content', async () => {
  const { z } = await import('astro/zod');
  return {
    defineCollection: (c: unknown) => c,
    reference: (collection: string) => z.string().transform((id) => ({ collection, id })),
  };
});
vi.mock('astro/loaders', () => ({ glob: () => ({}) }));

type Field = Record<string, unknown>;
interface Zod {
  shape: Record<string, { isOptional(): boolean; safeParse(v: unknown): { success: boolean }; options?: string[]; def: { type: string; innerType?: unknown } }>;
}

const about = (pagesCollection as unknown as { files: Field[] }).files[0];
const pageFields = about.fields as Field[];
const named = (fields: Field[], name: string) => fields.find((f) => f.name === name) as Field;
const sections = named(pageFields, 'sections');
const types = sections.types as { name: string; summary?: string; fields: Field[] }[];
const optionValues = (f: Field) => (f.options as { value: unknown }[]).map((o) => o.value);

const blockSchemas = (sectionSchema as unknown as { options: Zod[] }).options;
const blockShape = (type: string) => blockSchemas.find((b) => b.shape.type.safeParse(type).success) as Zod;

describe('the Pages collection', () => {
  it('is a file collection with the About page, written to the file the site reads', () => {
    expect(pagesCollection.name).toBe('pages');
    expect(about).toMatchObject({ name: 'about', file: 'src/content/pages/about.md', format: 'frontmatter' });
    expect(readFileSync('src/content/pages/about.md', 'utf8')).toMatch(/^---/);
    expect((pagesCollection as unknown as { delete: boolean }).delete, 'the About page cannot be deleted from the editor').toBe(false);
  });

  it('is in the editor after the post collections and the authors', () => {
    const { collections } = buildConfig({ repo: 'o/n', branch: 'main', local: true });
    expect(collections.map((c) => c.name)).toEqual(['blog', 'news', 'vlogs', 'projects', 'repos', 'authors', 'pages']);
    expect(pageCollections).toEqual([pagesCollection]);
  });

  it('has a live preview, registered under the file name (Decap names a file collection template after the file)', () => {
    expect((about.editor as { preview: boolean }).preview).toBe(true);
    const main = readFileSync('src/admin/main.ts', 'utf8');
    expect(main).toContain(`registerPreviewTemplate('${about.name}'`);
    expect(main).toContain('sections.css?inline');
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

describe('the sections list', () => {
  it('writes each block with a `type`, and offers exactly the block types of the schema, in the schema order', () => {
    expect(sections).toMatchObject({ widget: 'list', typeKey: 'type', required: false, default: [] });
    expect(types.map((t) => t.name)).toEqual([...SECTION_TYPES]);
    expect(blockSchemas).toHaveLength(types.length);
  });

  it('gives every block type the schema fields, under the schema names, nothing missing and nothing extra', () => {
    for (const t of types) {
      const schemaFields = Object.keys(blockShape(t.name).shape).filter((k) => k !== 'type');
      expect(t.fields.map((f) => f.name).sort(), t.name).toEqual(schemaFields.sort());
    }
  });

  it('marks as required exactly what the schema requires, except alt text, which depends on the decorative switch', () => {
    for (const t of types) {
      const shape = blockShape(t.name).shape;
      for (const f of t.fields) {
        if (f.name === 'alt') {
          expect(f.required, `${t.name}.alt is checked by the build (it depends on "decorative")`).toBe(false);
          continue;
        }
        const type = shape[f.name as string];
        // A field the schema fills in by default (a select, a switch) may be required or not in the form: it always has a value.
        if (type.def.type === 'default') continue;
        expect(f.required !== false, `${t.name}.${f.name}`).toBe(!type.isOptional());
      }
    }
  });

  it('offers the choices of the schema enums, and defaults to the schema defaults', () => {
    const select = (type: string, name: string) => named(types.find((t) => t.name === type)!.fields, name);
    const enumOf = (type: string, name: string) => (blockShape(type).shape[name] as unknown as { def: { innerType: { options: string[] } } }).def.innerType.options;
    for (const [type, name] of [
      ['image', 'width'],
      ['portrait', 'side'],
      ['callout', 'kind'],
      ['divider', 'style'],
    ]) {
      expect(optionValues(select(type, name)), `${type}.${name}`).toEqual(enumOf(type, name));
      expect(select(type, name).default, `${type}.${name} default`).toBe(enumOf(type, name)[0]);
    }
    expect(optionValues(select('heading', 'level'))).toEqual([2, 3]);
    expect(select('heading', 'level').default).toBe(2);
  });

  it('checks addresses with the schema rule: what the form accepts, the build accepts', () => {
    const urlFields = [
      named(types.find((t) => t.name === 'button')!.fields, 'url'),
      named(named(types.find((t) => t.name === 'links')!.fields, 'items').fields as Field[], 'url'),
    ];
    for (const f of urlFields) {
      const re = new RegExp((f.pattern as string[])[0]);
      for (const url of ['https://example.com', '/subscribe/', '/']) expect(re.test(url), url).toBe(true);
      for (const url of ['http://example.com', '//example.com', 'example.com', 'javascript:alert(1)', '']) expect(re.test(url), url).toBe(false);
      expect((f.pattern as string[])[0]).toBe(LINK_PATTERN.source.replace(/\\\//g, '/'));
    }
  });

  it('asks for an image, alt text and a decorative switch on both picture blocks, with hints a non-developer can follow', () => {
    for (const type of ['image', 'portrait']) {
      const fields = types.find((t) => t.name === type)!.fields;
      expect(named(fields, 'image')).toMatchObject({ widget: 'image', choose_url: false });
      expect(named(fields, 'decorative')).toMatchObject({ widget: 'boolean', default: false });
      expect(String(named(fields, 'alt').hint)).toMatch(/decorative/i);
    }
  });

  it('shows what each block holds when it is collapsed, so a list of blocks can be told apart and re-ordered', () => {
    for (const t of types) expect(String(t.summary), t.name).toMatch(/\S/);
    expect(String(types.find((t) => t.name === 'text')!.summary)).toContain('{{fields.text');
  });

  it('keeps the text boxes to what the page renders: no headings or components inside a Text block', () => {
    for (const type of ['text', 'portrait']) {
      const f = named(types.find((t) => t.name === type)!.fields, 'text');
      expect(f.widget).toBe('markdown');
      expect(f.buttons).not.toEqual(expect.arrayContaining(['heading-two']));
      expect(f.editor_components).toEqual([]);
    }
  });

  it('reads the real About file with every field the admin writes', () => {
    const { frontmatter } = parseFrontmatter(readFileSync('src/content/pages/about.md', 'utf8'));
    for (const block of frontmatter.sections as Field[]) {
      const t = types.find((x) => x.name === block.type)!;
      expect(Object.keys(block).filter((k) => k !== 'type').every((k) => t.fields.some((f) => f.name === k)), String(block.type)).toBe(true);
    }
  });
});
