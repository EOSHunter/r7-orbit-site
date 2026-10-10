import { describe, expect, it } from 'vitest';
import { dropEmptyImages, imageProblems, imageSaveCheck, repositoryPath } from './image-rules';

const entryOf = (data: Record<string, unknown>, mediaFiles: unknown[] = []) => ({
  get: (key: string) => ({ data: { toJS: () => data }, mediaFiles: { toJS: () => mediaFiles } })[key as 'data'],
});

describe('imageProblems', () => {
  it('is empty for a post with described images and sensible uploads', () => {
    const body = '<Figure src="/src/assets/blog/a.jpg" alt="A chart" />\n\n![Two bars](/media/b.png)';
    const files = [{ draft: true, path: 'src/assets/blog/a.jpg', size: 6_000_000 }];
    expect(imageProblems({ title: 'T', body }, files)).toEqual([]);
  });

  it('names the picture that has no alt text, and the post', () => {
    const [problem] = imageProblems({ title: 'My post', body: '<Figure src="/src/assets/blog/a.jpg" />' });
    expect(problem).toContain('"My post"');
    expect(problem).toContain('/src/assets/blog/a.jpg');
    expect(problem).toMatch(/Alt text/);
  });

  it('refuses a HEIC or oversized upload added in this session, but not files already in the repository', () => {
    const problems = imageProblems({ body: '' }, [
      { draft: true, path: 'src/assets/blog/img.heic', size: 3_000_000 },
      { draft: true, path: 'public/media/vlogs/huge.jpg', size: 12_000_000 },
      { draft: false, path: 'public/media/old.heic', size: 99_000_000 },
    ]);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/img\.heic.*HEIC/);
    expect(problems[1]).toMatch(/huge\.jpg.*over the/);
  });
});

describe('imageSaveCheck (the Decap preSave handler)', () => {
  it('lets a good post save', () => {
    expect(() => imageSaveCheck({ entry: entryOf({ body: '![A chart](/media/a.jpg)' }) })).not.toThrow();
  });
  it('stops the save with one readable message', () => {
    expect(() => imageSaveCheck({ entry: entryOf({ body: '![](/media/a.jpg)' }) })).toThrow(/^Not saved\. .*no alt text/);
  });
});

describe('the pictures of the form (cover, featured image)', () => {
  it('refuses a cover or featured image with no alt key, like the build', () => {
    const problems = imageProblems({ title: 'My post', body: '', cover: '/media/blog/a.png', featuredImage: '../../assets/blog/a.png' });
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/"My post": the cover image has no alt text/);
    expect(problems[1]).toMatch(/featured image has no alt text/);
  });

  it('lets an empty picture, a described one and a decorative one ("") through', () => {
    expect(imageProblems({ body: '', cover: '', featuredImage: '  ' })).toEqual([]);
    expect(imageProblems({ body: '', cover: '/media/a.png', coverAlt: 'Two bars' })).toEqual([]);
    expect(imageProblems({ body: '', cover: '/media/a.png', coverAlt: '' })).toEqual([]);
  });

  it('names a picture uploaded for two fields in one edit, which Decap commits only once', () => {
    // The incident: the same screenshot for the featured image (src/assets/blog) and the cover (public/media/blog). Decap keyed
    // both uploads by their content, kept the last, and the featured image's file never reached the repository.
    const data = {
      body: '',
      featuredImage: '../../assets/blog/shot.png',
      featuredImageAlt: 'A canvas',
      cover: '/media/blog/shot.png',
      coverAlt: 'A canvas',
    };
    const problems = imageProblems(data, [{ draft: true, path: 'public/media/blog/shot.png', size: 2_000_000 }]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^The featured image is the same picture .*public\/media\/blog\/shot\.png/);
    // Both uploads present (two different pictures with the same name, or a featured image saved earlier): nothing to say.
    expect(
      imageProblems(data, [
        { draft: true, path: 'public/media/blog/shot.png', size: 1 },
        { draft: true, path: 'src/assets/blog/shot.png', size: 1 },
      ]),
    ).toEqual([]);
    expect(imageProblems(data, [{ draft: false, path: 'public/media/blog/shot.png', size: 1 }])).toEqual([]);
  });

  it('repositoryPath: where a field value lives in the repository', () => {
    expect(repositoryPath('/media/blog/a.png')).toBe('public/media/blog/a.png');
    expect(repositoryPath('../../assets/blog/a.png')).toBe('src/assets/blog/a.png');
    expect(repositoryPath('/src/assets/blog/a.png')).toBe('src/assets/blog/a.png');
  });
});

describe('dropEmptyImages (the Decap preSave clean-up)', () => {
  // The slice of an Immutable Map the handler uses.
  const mapOf = (o: Record<string, unknown>) => {
    const make = (v: Record<string, unknown>): { get(k: string): unknown; has(k: string): boolean; delete(k: string): unknown; toJS(): unknown } => ({
      get: (k) => v[k],
      has: (k) => k in v,
      delete: (k) => make(Object.fromEntries(Object.entries(v).filter(([key]) => key !== k))),
      toJS: () => v,
    });
    return make(o);
  };
  const run = (o: Record<string, unknown>) => {
    const out = dropEmptyImages({ entry: { get: () => mapOf(o) } }) as { toJS(): unknown } | undefined;
    return out?.toJS();
  };

  it('leaves out an emptied image field and the alt text of a picture that is not there', () => {
    expect(run({ title: 'T', cover: '', coverAlt: '', featuredImage: ' ', featuredImageAlt: 'old', poster: null, avatar: '' })).toEqual({ title: 'T' });
  });

  it('keeps a real picture and its alt text, the decorative "" included, and returns nothing when there is nothing to tidy', () => {
    expect(run({ cover: '/media/a.png', coverAlt: '' })).toBeUndefined();
    expect(run({ title: 'T', seoTitle: '' })).toBeUndefined();
  });
});
