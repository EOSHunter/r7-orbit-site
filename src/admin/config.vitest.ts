import site from '../data/site.json';
import { describe, expect, it, vi } from 'vitest';
import { ARTICLE_COMPONENT_NAMES } from '../lib/article-component-names';
import {
  CMS_AUTH_URL,
  CMS_BRANCH,
  CMS_REPO,
  FEATURED_MEDIA_FOLDER,
  FEATURED_PUBLIC_FOLDER,
  MEDIA_FOLDER,
  mediaFolders,
  PUBLIC_FOLDER,
  blogCollection,
  buildConfig,
  collections,
} from './config';

// The real schema, so a field added or renamed in src/content.config.ts fails here until the admin follows. The two Astro
// modules it imports only exist inside Astro, so they are stood in for: `defineCollection` returns what it is given.
vi.mock('astro:content', () => ({ defineCollection: (c: unknown) => c }));
vi.mock('astro/loaders', () => ({ glob: () => ({}) }));

const env = { repo: 'owner/name', branch: 'main' };

/** The slice of a Zod type this file reads. */
interface Zod {
  def: { type: string; innerType?: Zod; element?: Zod };
  shape?: Record<string, Zod>;
  options?: string[];
  isOptional(): boolean;
  safeParse(value: unknown): { success: boolean };
}

type Field = Record<string, unknown>;

async function schemaShapes(): Promise<Record<string, Record<string, Zod>>> {
  const { z } = await import('astro/zod');
  const { collections: defined } = await import('../content.config');
  const out: Record<string, Record<string, Zod>> = {};
  for (const [name, c] of Object.entries(defined)) {
    const { schema } = c as unknown as { schema: (ctx: { image: () => unknown }) => Zod };
    // `image()` is Astro's own helper; a string stands in for it.
    out[name] = schema({ image: () => z.string() }).shape ?? {};
  }
  return out;
}

/** Peels `.optional()` and `.default()` off a Zod type. */
function inner(t: Zod): Zod {
  return t.def.innerType ? inner(t.def.innerType) : t;
}

const byName = (fields: readonly unknown[] | undefined): Record<string, Field> =>
  Object.fromEntries((fields ?? []).map((f) => [(f as { name: string }).name, f as Field]));
const fieldsOf = (collection: string) => byName(collections.find((c) => c.name === collection)?.fields);
const pattern = (f: Field) => ((f.pattern as [string, string] | undefined) ?? [''])[0];

describe('seoTitle', () => {
  it('is optional on every collection, limited so the <title> fits 60 characters, and in the admin under the same name', async () => {
    const shapes = await schemaShapes();
    const limit = 60 - ' · '.length - site.name.length;
    for (const [name, shape] of Object.entries(shapes)) {
      const seo = shape.seoTitle;
      expect(seo, `${name} schema`).toBeDefined();
      expect(seo.isOptional(), `${name} optional`).toBe(true);
      expect(seo.safeParse('x'.repeat(limit)).success, `${name} at the limit`).toBe(true);
      expect(seo.safeParse('x'.repeat(limit + 1)).success, `${name} over the limit`).toBe(false);
      expect(seo.safeParse(undefined).success, `${name} absent`).toBe(true);
      const adminField = fieldsOf(name).seoTitle;
      expect(adminField, `${name} admin`).toBeDefined();
      expect(adminField.required).toBe(false);
      expect(adminField.hint).toContain(`Max ${limit} characters`);
    }
  });
});

describe('admin config', () => {
  it('writes MDX posts into the blog content folder', () => {
    expect(blogCollection.folder).toBe('src/content/blog');
    expect(blogCollection.extension).toBe('mdx');
  });

  it('sends body and block images to public/media as /media/x.jpg (what Figure accepts)', () => {
    const config = buildConfig({ ...env, local: true });
    expect(config.media_folder).toBe(MEDIA_FOLDER);
    expect(config.public_folder).toBe(PUBLIC_FOLDER);
    expect(MEDIA_FOLDER).toBe('public/media');
    expect(PUBLIC_FOLDER).toBe('/media');
  });

  it('gives each collection its own upload folder, absolute from the repository root (a relative one is read from the post file)', () => {
    for (const name of ['news', 'vlogs', 'projects', 'repos']) {
      const c = collections.find((x) => x.name === name) as unknown as Record<string, string>;
      expect(c.media_folder, name).toBe(`/public/media/${name}`);
      expect(c.public_folder, name).toBe(`/media/${name}`);
      // What Decap writes into a post must be a path the site serves: public_folder + file name <-> media_folder under public/.
      expect(c.media_folder.replace('/public', '')).toBe(c.public_folder);
    }
    expect(mediaFolders('about')).toEqual({ media_folder: '/public/media/about', public_folder: '/media/about' });
  });

  it('keeps blog body pictures in src/assets/blog (optimised) and the blog cover, a plain file, in public/media/blog', () => {
    const blog = blogCollection as unknown as Record<string, string>;
    expect(blog.media_folder).toBe('/src/assets/blog');
    expect(blog.public_folder).toBe('/src/assets/blog');
    expect(fieldsOf('blog').cover).toMatchObject({ media_folder: '/public/media/blog', public_folder: '/media/blog' });
  });

  it('limits the size of an upload on every image widget (Decap reads the limit from the widget, not the top level)', () => {
    const limit = 10 * 1024 * 1024;
    const widgets = [fieldsOf('blog').cover, fieldsOf('blog').featuredImage, fieldsOf('vlogs').poster, fieldsOf('news').cover];
    for (const w of widgets) expect(w.media_library, String(w.name)).toMatchObject({ config: { max_file_size: limit } });
    const gallery = (fieldsOf('projects').gallery.fields as Field[]).find((f) => f.name === 'src');
    expect(gallery?.media_library).toMatchObject({ config: { max_file_size: limit } });
  });

  it('offers the Image block (Figure) and not the built-in image block in the blog body; the Markdown bodies keep image', () => {
    expect(fieldsOf('blog').body.editor_components).not.toContain('image');
    expect(fieldsOf('blog').body.editor_components).toContain('Figure');
    for (const name of ['news', 'vlogs', 'projects', 'repos']) {
      expect(fieldsOf(name).body.editor_components, name).toContain('image');
    }
  });

  it('names uploads lowercase with hyphens and no accents, ', () => {
    const config = buildConfig({ ...env, local: true });
    expect(config.slug).toMatchObject({ encoding: 'ascii', clean_accents: true, sanitize_replacement: '-' });
  });

  it('sends the featured image to src/assets/blog, written relative to a post (what Astro image() needs)', () => {
    const featured = fieldsOf('blog').featuredImage;
    expect(featured.media_folder).toBe(FEATURED_MEDIA_FOLDER);
    expect(featured.public_folder).toBe(FEATURED_PUBLIC_FOLDER);
    expect(FEATURED_MEDIA_FOLDER).toBe('/src/assets/blog');
    expect(FEATURED_PUBLIC_FOLDER).toBe('../../assets/blog');
  });

  it('offers every article component in the blog body, and no H1', () => {
    const body = fieldsOf('blog').body;
    expect(body.editor_components).toEqual(expect.arrayContaining([...ARTICLE_COMPONENT_NAMES]));
    expect(body.buttons).not.toContain('heading-one');
    expect(body.buttons).toContain('heading-two');
  });

  it('signs in through the OAuth proxy and uses pull requests when deployed; edits files directly when local', () => {
    const live = buildConfig({ ...env, local: false, authUrl: 'https://auth.example.com' });
    expect(live.publish_mode).toBe('editorial_workflow');
    expect(live.backend).toMatchObject({
      name: 'github',
      repo: 'owner/name',
      base_url: 'https://auth.example.com',
      auth_endpoint: 'auth',
      open_authoring: false,
    });
    expect(live.local_backend).toBe(false);

    const local = buildConfig({ ...env, local: true });
    expect(local.local_backend).toBe(true);
    expect(local.publish_mode).toBeUndefined();
  });

  it('has live sign-in settings that Decap accepts: owner/name, main, an https origin with no trailing slash', () => {
    expect(CMS_REPO).toMatch(/^[\w.-]+\/[\w.-]+$/);
    expect(CMS_BRANCH).toBe('main');
    // Decap compares the popup's origin with base_url exactly, so a path or trailing slash would break the login.
    expect(new URL(CMS_AUTH_URL).origin).toBe(CMS_AUTH_URL);
    expect(CMS_AUTH_URL.startsWith('https://')).toBe(true);
  });

  it('is the only source of config: no /admin/config.yml is fetched', () => {
    expect(buildConfig({ ...env, local: true }).load_config_file).toBe(false);
  });
});

describe('every collection mirrors its schema in src/content.config.ts', () => {
  it('has one collection per content kind, each writing into its own folder', () => {
    expect(collections.map((c) => c.name)).toEqual(['blog', 'news', 'vlogs', 'projects', 'repos']);
    expect(buildConfig({ ...env, local: true }).collections).toBe(collections);
    for (const c of collections) expect(c).toMatchObject({ folder: `src/content/${c.name}`, create: true });
    for (const c of collections.filter((x) => x.name !== 'blog')) expect(c.extension, c.name).toBe('md');
  });

  it('has exactly the schema fields (same names) plus the body: nothing missing, nothing extra', async () => {
    const shapes = await schemaShapes();
    for (const c of collections) {
      expect(Object.keys(byName(c.fields)).sort(), c.name).toEqual([...Object.keys(shapes[c.name]), 'body'].sort());
    }
  });

  it('requires what the schema requires, and only that', async () => {
    const shapes = await schemaShapes();
    for (const c of collections) {
      const fields = byName(c.fields);
      for (const [name, type] of Object.entries(shapes[c.name])) {
        // vlogs.youtubeId and videoUrl are each optional but one is needed: the schema checks that, Decap cannot.
        expect(fields[name].required !== false, `${c.name}.${name}`).toBe(!type.isOptional());
      }
    }
  });

  it('gives every collection a draft switch that defaults to off, like the schema', async () => {
    const shapes = await schemaShapes();
    for (const c of collections) {
      expect(byName(c.fields).draft, c.name).toMatchObject({ widget: 'boolean', default: false, required: false });
      expect(shapes[c.name].draft.safeParse(undefined).success, c.name).toBe(true);
    }
  });

  it('offers the same choices as the schema enums', async () => {
    const shapes = await schemaShapes();
    const values = (options: unknown) =>
      (options as (string | { value: string })[]).map((o) => (typeof o === 'string' ? o : o.value));
    for (const [collection, name] of [
      ['projects', 'status'],
      ['projects', 'playMode'],
      ['repos', 'readme'],
      ['blog', 'aiAssist'],
    ]) {
      expect(values(fieldsOf(collection)[name].options), `${collection}.${name}`).toEqual(
        inner(shapes[collection][name]).options,
      );
    }
  });

  it('has the nested fields of the schema lists (gallery, timeline, chapters)', async () => {
    const shapes = await schemaShapes();
    for (const [collection, name] of [
      ['projects', 'gallery'],
      ['projects', 'timeline'],
      ['projects', 'controls'],
      ['vlogs', 'chapters'],
    ]) {
      const element = inner(shapes[collection][name]).def.element;
      expect(Object.keys(byName(fieldsOf(collection)[name].fields as unknown[])).sort(), `${collection}.${name}`).toEqual(
        Object.keys(element?.shape ?? {}).sort(),
      );
    }
  });

  it('checks the same patterns as the schema: what the form accepts, the build accepts', async () => {
    const shapes = await schemaShapes();
    // [collection, field, values the schema accepts, values it rejects]
    const cases: [string, string, string[], string[]][] = [
      ['blog', 'title', ['A title'], ['', 'x'.repeat(91)]],
      ['blog', 'subtitle', ['A subtitle'], ['x'.repeat(141)]],
      ['blog', 'summary', ['One line.'], ['', 'x'.repeat(181)]],
      ['blog', 'canonicalUrl', ['https://example.com/a'], ['example.com/a', 'not a url']],
      ['news', 'sourceUrl', ['https://example.com/the-announcement'], ['example.com', 'see the post']],
      ['vlogs', 'youtubeId', ['dQw4w9WgXcQ'], ['dQw4w9WgXc', 'https://youtu.be/dQw4w9WgXcQ']],
      ['vlogs', 'videoUrl', ['https://vimeo.com/1'], ['vimeo.com/1']],
      ['vlogs', 'duration', ['12:48', '1:02:30', '0:59'], ['12', '12:4', 'twelve minutes']],
      ['projects', 'repo', ['owner/name', 'a.b/c-d_e'], ['owner', 'owner/name/extra', 'https://github.com/o/n']],
      ['projects', 'liveUrl', ['https://example.com/r7-orbit'], ['example.com']],
      ['projects', 'repoUrl', ['https://github.com/o/n'], ['github.com/o/n']],
      ['projects', 'playUrl', ['https://vesper.r7orbit.io/'], ['vesper.r7orbit.io', 'http://vesper.r7orbit.io/']],
      ['projects', 'playAspect', ['16:9', '4:3', '21:9'], ['16/9', '16:0', 'wide', '16:9; x']],
      ['projects', 'playNote', ['Best on desktop with a mouse'], ['', 'x'.repeat(121)]],
      ['repos', 'repo', ['EOSHunter/r7-orbit-site'], ['r7-orbit-site']],
      ['repos', 'homepage', ['https://example.com'], ['example.com']],
    ];
    for (const [collection, name, good, bad] of cases) {
      const source = pattern(fieldsOf(collection)[name]);
      expect(source, `${collection}.${name} has a pattern`).toBeTruthy();
      const re = new RegExp(source);
      for (const v of good) {
        expect(shapes[collection][name].safeParse(v).success, `schema accepts ${v}`).toBe(true);
        expect(re.test(v), `${collection}.${name} accepts ${v}`).toBe(true);
      }
      for (const v of bad) {
        expect(shapes[collection][name].safeParse(v).success, `schema rejects ${v}`).toBe(false);
        expect(re.test(v), `${collection}.${name} rejects ${v}`).toBe(false);
      }
    }
  });

  it('checks tags and chapter times as the schema does', async () => {
    const shapes = await schemaShapes();
    const tag = new RegExp(((fieldsOf('blog').tags.field as Field).pattern as [string, string])[0]);
    const tagSchema = inner(shapes.blog.tags).def.element as Zod;
    for (const v of ['ai-agents', 'evals', 'a1']) {
      expect(tag.test(v), v).toBe(true);
      expect(tagSchema.safeParse(v).success, v).toBe(true);
    }
    for (const v of ['AI', 'ai agents', 'ai--agents', '-a', '']) {
      expect(tag.test(v), v).toBe(false);
      expect(tagSchema.safeParse(v).success, v).toBe(false);
    }

    const start = new RegExp(pattern(byName(fieldsOf('vlogs').chapters.fields as unknown[]).t));
    const startSchema = inner(shapes.vlogs.chapters).def.element?.shape?.t as Zod;
    for (const v of ['0:00', '5:15', '1:02:30']) {
      expect(start.test(v), v).toBe(true);
      expect(startSchema.safeParse(v).success, v).toBe(true);
    }
    expect(start.test('5')).toBe(false);
    expect(startSchema.safeParse('5').success).toBe(false);
  });

  it('caps tags at six, and lists that default to empty in the schema default to empty here', async () => {
    const shapes = await schemaShapes();
    for (const c of collections) expect(byName(c.fields).tags.max, c.name).toBe(6);
    for (const [collection, name] of [
      ['projects', 'stack'],
      ['projects', 'gallery'],
      ['projects', 'timeline'],
      ['projects', 'controls'],
      ['projects', 'platforms'],
    ]) {
      expect(fieldsOf(collection)[name].default, name).toEqual([]);
      expect(shapes[collection][name].safeParse(undefined).success, name).toBe(true);
    }
  });

  it('offers the playable fields with the schema defaults, and the same platform choices', async () => {
    const shapes = await schemaShapes();
    const projects = fieldsOf('projects');
    expect(projects.playMode).toMatchObject({ widget: 'select', default: 'embed' });
    expect(shapes.projects.playMode.safeParse(undefined).success).toBe(true);
    expect(projects.playAspect).toMatchObject({ default: '16:9' });
    expect(shapes.projects.playAspect.safeParse(undefined).success).toBe(true);
    expect(projects.platforms).toMatchObject({ widget: 'select', multiple: true });
    expect(projects.platforms.options).toEqual(inner(inner(shapes.projects.platforms).def.element as Zod).options);
    for (const name of ['playUrl', 'playMode', 'playAspect', 'controls', 'playNote', 'platforms', 'order']) {
      expect(String(projects[name].hint), name).not.toBe('undefined');
    }
  });

  it('has an optional order for the Games page, under the schema name, on projects only', async () => {
    const shapes = await schemaShapes();
    expect(shapes.projects.order.isOptional()).toBe(true);
    expect(shapes.projects.order.safeParse(2).success).toBe(true);
    expect(shapes.projects.order.safeParse('first').success).toBe(false);
    expect(fieldsOf('projects').order).toMatchObject({ widget: 'number', required: false });
    expect(String(fieldsOf('projects').order.hint)).toMatch(/lower number comes first/);
    for (const name of ['news', 'blog', 'vlogs', 'repos']) expect(shapes[name].order, name).toBeUndefined();
  });

  it('explains the two ways to give a vlog its video, and that one of them is needed', () => {
    const vlogs = fieldsOf('vlogs');
    expect(vlogs.youtubeId).toMatchObject({ label: 'YouTube video ID', widget: 'string', required: false });
    expect(String(vlogs.youtubeId.hint)).toMatch(/11 characters/);
    expect(String(vlogs.youtubeId.hint)).toMatch(/this or the video URL/);
    expect(vlogs.videoUrl).toMatchObject({ label: 'Video URL', widget: 'string', required: false });
    expect(String(vlogs.videoUrl.hint)).toMatch(/not on YouTube/);
  });

  it('turns the live preview on for blog posts only, and only blog bodies get the article blocks', () => {
    for (const c of collections) {
      expect((c as { editor?: { preview?: boolean } }).editor?.preview ?? false, c.name).toBe(c.name === 'blog');
      const components = (byName(c.fields).body.editor_components ?? []) as string[];
      expect(
        ARTICLE_COMPONENT_NAMES.every((b) => components.includes(b)),
        c.name,
      ).toBe(c.name === 'blog');
    }
  });

  it('links a repo to its project by slug, which is the project file name', () => {
    expect(fieldsOf('repos').relatedProject).toMatchObject({
      widget: 'relation',
      collection: 'projects',
      value_field: '{{slug}}',
    });
  });
});
