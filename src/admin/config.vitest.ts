import { describe, expect, it } from 'vitest';
import { ARTICLE_COMPONENT_NAMES } from '../lib/article-component-names';
import { MEDIA_FOLDER, PUBLIC_FOLDER, blogCollection, buildConfig } from './config';

const env = { repo: 'owner/name', branch: 'main' };
const field = (name: string) => {
  const f = blogCollection.fields?.find((x) => x.name === name);
  if (!f) throw new Error(`no field ${name}`);
  return f as unknown as Record<string, unknown>;
};

describe('admin config', () => {
  it('has the blog fields the collection schema expects', () => {
    const names = (blogCollection.fields ?? []).map((f) => f.name);
    for (const name of ['title', 'subtitle', 'date', 'tags', 'summary', 'featuredImage', 'featuredImageAlt', 'body']) {
      expect(names).toContain(name);
    }
  });

  it('writes MDX posts into the blog content folder', () => {
    expect(blogCollection.folder).toBe('src/content/blog');
    expect(blogCollection.extension).toBe('mdx');
  });

  it('commits uploads to the image folder and writes paths relative to a post (what Astro image() needs)', () => {
    const config = buildConfig({ ...env, local: true });
    expect(config.media_folder).toBe(MEDIA_FOLDER);
    expect(config.public_folder).toBe(PUBLIC_FOLDER);
    expect(MEDIA_FOLDER).toBe('src/assets/blog');
    expect(PUBLIC_FOLDER).toBe('../../assets/blog');
  });

  it('offers every article component in the body, no H1, and new posts start as drafts', () => {
    const body = field('body');
    expect(body.editor_components).toEqual(expect.arrayContaining([...ARTICLE_COMPONENT_NAMES]));
    expect(body.buttons).not.toContain('heading-one');
    expect(body.buttons).toContain('heading-two');
    expect(field('draft').default).toBe(true);
  });

  it('signs in through the OAuth proxy and uses pull requests when deployed; edits files directly when local', () => {
    const live = buildConfig({ ...env, local: false, authUrl: 'https://auth.example.com' });
    expect(live.publish_mode).toBe('editorial_workflow');
    expect(live.backend).toMatchObject({ name: 'github', repo: 'owner/name', base_url: 'https://auth.example.com' });
    expect(live.local_backend).toBe(false);

    const local = buildConfig({ ...env, local: true });
    expect(local.local_backend).toBe(true);
    expect(local.publish_mode).toBeUndefined();
  });

  it('is the only source of config: no /admin/config.yml is fetched', () => {
    expect(buildConfig({ ...env, local: true }).load_config_file).toBe(false);
  });
});
