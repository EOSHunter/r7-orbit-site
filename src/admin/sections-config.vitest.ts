import { readFileSync } from 'node:fs';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { describe, expect, it } from 'vitest';
import { definitions, describeShape, sectionSchema } from '../lib/sections';
import { buildConfig } from './config';
import { decapField, sectionsDrift, sectionsField, sectionTypes } from './sections-config';

// The form the admin has, read from the real config the editor starts with (not from the generator), against the schema.

type Field = Record<string, unknown>;
const config = buildConfig({ repo: 'o/n', branch: 'main', local: true });
const pages = config.collections.find((c) => c.name === 'pages') as unknown as { files: { fields: Field[] }[] };
const sections = pages.files[0].fields.find((f) => f.name === 'sections') as Field;
const types = sections.types as { name: string; label: string; summary: string; fields: Field[] }[];
const named = (fields: Field[], name: string) => fields.find((f) => f.name === name) as Field;
const typeOf = (id: string) => types.find((t) => t.name === id)!;
const clone = <T>(v: T): T => structuredClone(v);

describe('the admin form and the schema do not drift', () => {
  it('agree on every block and every field: names, order, boxes, labels, hints, required, defaults, choices, patterns, limits', () => {
    expect(sectionsDrift(types)).toEqual([]);
  });

  it('is the list the editor really has: a variable-type list written as `- type: <id>`, one entry per block', () => {
    expect(sections).toMatchObject({ widget: 'list', typeKey: 'type', required: false, default: [], max: 60 });
    expect(types.map((t) => t.name)).toEqual(definitions.map((d) => d.id));
  });

  it('is generated, not typed: pages.ts and config.ts list no block and no block field', () => {
    for (const file of ['src/admin/pages.ts', 'src/admin/config.ts']) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/widget: 'object'/);
      expect(source, file).not.toMatch(/\btypes: \[/);
      expect(source, file).not.toMatch(/typeKey/);
    }
    // pages.ts holds the page's own fields only; a block's name there would mean a block typed by hand.
    for (const d of definitions) expect(readFileSync('src/admin/pages.ts', 'utf8'), `pages.ts names the ${d.id} block`).not.toContain(`name: '${d.id}'`);
    expect(readFileSync('src/admin/pages.ts', 'utf8')).toContain('sectionsField()');
  });

  it('notices a form that has lost a block, gained one, or put them in another order', () => {
    expect(sectionsDrift(clone(types).slice(1)).join('\n')).toMatch(/the form offers/);
    expect(sectionsDrift([...clone(types), { name: 'carousel', label: 'C', summary: 'C', fields: [] }]).join('\n')).toMatch(/carousel/);
    expect(sectionsDrift(clone(types).reverse()).join('\n')).toMatch(/the form offers/);
  });

  it('notices a field renamed, dropped, retyped, relabelled, made optional or given another default', () => {
    const edit = (change: (t: typeof types) => void) => {
      const copy = clone(types);
      change(copy);
      return sectionsDrift(copy).join('\n');
    };
    expect(edit((t) => (named(t.find((x) => x.name === 'heading')!.fields, 'text').name = 'title'))).toMatch(/heading.*"title" where the schema has "text"/);
    expect(edit((t) => t.find((x) => x.name === 'quote')!.fields.pop())).toMatch(/quote: the form has 1 fields, the schema 2/);
    expect(edit((t) => (named(t.find((x) => x.name === 'quote')!.fields, 'text').widget = 'markdown'))).toMatch(/quote\.text: the form draws a markdown box/);
    expect(edit((t) => (named(t.find((x) => x.name === 'button')!.fields, 'label').label = 'Words'))).toMatch(/button\.label: the form's label/);
    expect(edit((t) => (named(t.find((x) => x.name === 'button')!.fields, 'label').required = false))).toMatch(/button\.label: the form says optional, the schema says required/);
    expect(edit((t) => (named(t.find((x) => x.name === 'divider')!.fields, 'style').default = 'dots'))).toMatch(/divider\.style: the form defaults to "dots"/);
  });

  it('notices a menu with a choice the schema refuses, a pattern that is not the schema\'s, and different limits', () => {
    const edit = (change: (t: typeof types) => void) => {
      const copy = clone(types);
      change(copy);
      return sectionsDrift(copy).join('\n');
    };
    expect(edit((t) => (named(t.find((x) => x.name === 'callout')!.fields, 'kind').options as unknown[]).push({ value: 'danger', label: 'Danger' }))).toMatch(/callout\.kind: the form offers different choices/);
    expect(edit((t) => (named(t.find((x) => x.name === 'button')!.fields, 'url').pattern = ['^.*$', 'x']))).toMatch(/button\.url: the form's pattern is not the schema's/);
    expect(edit((t) => (named(t.find((x) => x.name === 'latest')!.fields, 'count').max = 50))).toMatch(/latest\.count: the form's maximum is 50/);
    expect(edit((t) => (named(t.find((x) => x.name === 'image-row')!.fields, 'images').min = 1))).toMatch(/image-row\.images: the form's minimum is 1, the schema's is 2/);
  });

  it('notices a nested field gone from a list row', () => {
    const copy = clone(types);
    (named(copy.find((x) => x.name === 'links')!.fields, 'items').fields as Field[]).pop();
    expect(sectionsDrift(copy).join('\n')).toMatch(/links\.items: a row has 2 fields in the form and 3 in the schema/);
  });
});

describe('what the form accepts, the build accepts (every pattern, against the schema)', () => {
  const GOOD: Record<string, string[]> = {
    url: ['https://example.com', 'https://example.com/a?b=1#c', '/about/', '/'],
    playUrl: ['https://vesper.r7orbit.io/', 'https://example.com'],
    tag: ['ai-agents', 'git', 'a1'],
    author: ['hunter-newton', 'r7'],
    youtubeId: ['dQw4w9WgXcQ', 'abc_DEF-123'],
    playAspect: ['16:9', '4:3', '1:1'],
    duration: ['12:48', '1:02:30', '0:05'],
    t: ['0:00', '5:15', '1:02:30'],
    repo: ['EOSHunter/r7-orbit-site', 'a/b'],
    image: ['/media/a.jpg', '/src/assets/blog/a.png'],
  };
  const BAD: Record<string, string[]> = {
    url: ['http://example.com', '//example.com', 'example.com', 'javascript:alert(1)', 'mailto:a@b.co', 'data:text/html,x'],
    playUrl: ['http://x.test', '/relative/', 'x.test', 'javascript:alert(1)'],
    tag: ['Not A Tag', 'under_score', '-lead', 'trail-', 'UPPER'],
    author: ['R7!', 'Hunter Newton'],
    youtubeId: ['short', 'https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ1'],
    playAspect: ['16/9', '0:9', 'wide', '16:9 '],
    duration: ['12', 'x:yy', '1:2'],
    t: ['1', '5:1'],
    repo: ['r7-orbit-site', 'a/b/c', 'https://github.com/a/b'],
    image: ['https://example.com/a.jpg', '//example.com/a.jpg', 'a.jpg', 'javascript:alert(1)'],
  };
  // The field each sample set is for: which block, which field.
  const WHERE: Record<string, [string, string]> = {
    url: ['button', 'url'],
    playUrl: ['game', 'playUrl'],
    tag: ['latest', 'tag'],
    author: ['author', 'author'],
    youtubeId: ['video', 'youtubeId'],
    playAspect: ['game', 'playAspect'],
    duration: ['video', 'duration'],
    t: ['video', 'chapters.t'],
    repo: ['stats', 'repo'],
    image: ['image', 'image'],
  };

  const fieldOf = (id: string, path: string): Field => {
    let fields = typeOf(id).fields;
    let f!: Field;
    for (const name of path.split('.')) {
      f = named(fields, name);
      fields = (f.fields as Field[]) ?? [];
    }
    return f;
  };
  const exampleOf = (id: string) => ({ type: id, ...definitions.find((d) => d.id === id)!.example }) as Record<string, unknown>;
  const withValue = (id: string, path: string, value: string) => {
    const data = clone(exampleOf(id));
    const names = path.split('.');
    if (names.length === 1) data[path] = value;
    else {
      const [list, name] = names;
      (data[list] as Record<string, unknown>[])[0][name] = value;
    }
    return data;
  };

  for (const [key, [id, path]] of Object.entries(WHERE)) {
    it(`${id}.${path}: the form's pattern and the schema give the same answer for ${GOOD[key].length + BAD[key].length} values`, () => {
      const pattern = fieldOf(id, path).pattern as [string, string] | undefined;
      // A menu (the author) has no pattern in the form: the form only offers real authors; the schema's rule is the slug's.
      const re = pattern ? new RegExp(pattern[0]) : undefined;
      for (const value of GOOD[key]) {
        if (re) expect(re.test(value), `form accepts ${value}`).toBe(true);
        const r = sectionSchema.safeParse(withValue(id, path, value));
        expect(r.success, `schema accepts ${value}`).toBe(true);
      }
      for (const value of BAD[key]) {
        if (re) expect(re.test(value), `form refuses ${value}`).toBe(false);
        expect(sectionSchema.safeParse(withValue(id, path, value)).success, `schema refuses ${value}`).toBe(false);
      }
    });
  }

  it('gives the form the schema\'s own words when a pattern does not match', () => {
    const [, message] = fieldOf('button', 'url').pattern as [string, string];
    expect(message).toMatch(/use a full https:\/\/ address/);
  });
});

describe('how a field is drawn', () => {
  const info = (id: string, name: string) => describeShape(definitions.find((d) => d.id === id)!.schema.shape).find((f) => f.name === name)!;

  it('draws Markdown boxes with the buttons a page can use: no headings, no editor components', () => {
    for (const [id, name] of [['text', 'text'], ['portrait', 'text'], ['columns', 'left'], ['columns', 'right']]) {
      const f = named(typeOf(id).fields, name);
      expect(f.widget).toBe('markdown');
      expect(f.buttons).not.toEqual(expect.arrayContaining(['heading-two']));
      expect(f.editor_components).toEqual([]);
    }
  });

  it('draws every picture field as the image widget with the upload size limit, and no web address', () => {
    for (const [id, name] of [['image', 'image'], ['portrait', 'image'], ['video', 'poster'], ['game', 'poster']]) {
      expect(named(typeOf(id).fields, name), `${id}.${name}`).toMatchObject({ widget: 'image', choose_url: false });
      expect(named(typeOf(id).fields, name).media_library).toMatchObject({ allow_multiple: false });
    }
    const rows = named(typeOf('gallery').fields, 'shots').fields as Field[];
    expect(named(rows, 'image')).toMatchObject({ widget: 'image', choose_url: false });
  });

  it('asks for alt text and a decorative switch with every picture that can be decorative, with hints a non-developer can follow', () => {
    for (const id of ['image', 'portrait']) {
      expect(named(typeOf(id).fields, 'decorative')).toMatchObject({ widget: 'boolean', default: false, required: false });
      expect(String(named(typeOf(id).fields, 'alt').hint)).toMatch(/decorative/i);
      expect(named(typeOf(id).fields, 'alt')).toMatchObject({ required: false, default: '' });
    }
  });

  it('shows what each block holds when it is folded, so a list of blocks can be told apart and re-ordered', () => {
    for (const t of types) expect(t.summary, t.name).toMatch(/\S/);
    expect(typeOf('text').summary).toContain('{{fields.text');
  });

  it('gives a list an Add button that says what it adds, and a folded row that says what it holds', () => {
    const items = named(typeOf('links').fields, 'items');
    expect(items).toMatchObject({ widget: 'list', label_singular: 'link', summary: '{{fields.label}}', min: 1, max: 20 });
    expect(named(typeOf('video').fields, 'chapters')).toMatchObject({ required: false, default: [], summary: '{{fields.t}} {{fields.title}}' });
  });

  it('turns a length limit into a pattern with the same words, for the form', () => {
    expect(named(typeOf('heading').fields, 'text').pattern).toEqual(['^[\\s\\S]{1,120}$', '120 characters at most']);
  });

  it('draws the author menu from the authors list, not from the schema', () => {
    const f = named(typeOf('author').fields, 'author');
    expect(f.widget).toBe('select');
    expect((f.options as { value: string }[]).map((o) => o.value)).toEqual(expect.arrayContaining(['hunter-newton', 'r7']));
    expect((decapField(info('author', 'author'), { authors: [{ label: 'Only', value: 'only' }] }) as unknown as Field).options).toEqual([{ label: 'Only', value: 'only' }]);
  });

  it('draws a several-choice menu (kinds, platforms) as a multiple select that may be left empty', () => {
    for (const [id, name] of [['latest', 'kinds'], ['game', 'platforms']]) {
      expect(named(typeOf(id).fields, name)).toMatchObject({ widget: 'select', multiple: true, required: false });
    }
  });

  it('draws a number with its limits, as whole numbers', () => {
    expect(named(typeOf('latest').fields, 'count')).toMatchObject({ widget: 'number', value_type: 'int', min: 1, max: 12, default: 3 });
  });

  it('can be put on any collection: sectionsField() is the whole list, and can be named and worded', () => {
    const f = sectionsField({ name: 'blocks', label: 'Blocks', hint: 'h' }) as unknown as Field;
    expect(f).toMatchObject({ name: 'blocks', label: 'Blocks', hint: 'h', widget: 'list', typeKey: 'type' });
    expect((f.types as unknown[]).length).toBe(definitions.length);
    expect(sectionTypes().map((t) => t.name)).toEqual(definitions.map((d) => d.id));
  });
});

describe('the About file against the form', () => {
  it('uses only blocks and fields the form has, as the editor writes them', () => {
    const { frontmatter } = parseFrontmatter(readFileSync('src/content/pages/about.md', 'utf8'));
    for (const block of frontmatter.sections as Field[]) {
      const t = typeOf(String(block.type));
      expect(t, String(block.type)).toBeDefined();
      for (const key of Object.keys(block).filter((k) => k !== 'type')) expect(t.fields.some((f) => f.name === key), `${String(block.type)}.${key}`).toBe(true);
    }
  });
});
