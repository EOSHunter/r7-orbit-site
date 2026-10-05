import { describe, expect, it } from 'vitest';
import { imageProblems, imageSaveCheck } from './image-rules';

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
