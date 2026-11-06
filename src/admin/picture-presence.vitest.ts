import { describe, expect, it } from 'vitest';
import { githubExists, missingPictures, missingPicturesMessage, picturesNamed } from './picture-presence';

describe('picturesNamed: the pictures of this site a post names', () => {
  it('finds the featured image, a cover, body pictures in Markdown and in a Figure, and pictures in sections', () => {
    const data = {
      featuredImage: '../../assets/blog/hero-shot.png',
      cover: '/media/blog/hero-shot-cover.png',
      body: 'Text ![A chart](/src/assets/blog/chart.png "t") and <Figure src="/src/assets/blog/wide.jpg" alt="x" />',
      sections: [{ type: 'gallery', images: [{ src: '/media/projects/x/one.webp' }] }],
    };
    expect(picturesNamed(data).sort()).toEqual(
      [
        'public/media/blog/hero-shot-cover.png',
        'public/media/projects/x/one.webp',
        'src/assets/blog/chart.png',
        'src/assets/blog/hero-shot.png',
        'src/assets/blog/wide.jpg',
      ].sort(),
    );
  });

  it('leaves out pictures on other sites and paths that are not pictures', () => {
    expect(picturesNamed({ body: '![x](https://example.org/media/a.png) [doc](/media/notes.pdf) /blog/media/a.png' })).toEqual([]);
  });
});

describe('missingPictures', () => {
  const exists = (known: Record<string, boolean | undefined>) => async (path: string) => known[path];

  it('the 2026-11-06 save: the featured image is in neither the upload list nor the repository', async () => {
    const data = { featuredImage: '../../assets/blog/battle.jpg', cover: '/media/blog/battle-cover.jpg' };
    const files = [{ path: 'public/media/blog/battle-cover.jpg', draft: true }];
    expect(await missingPictures(data, files, exists({ 'src/assets/blog/battle.jpg': false }))).toEqual(['src/assets/blog/battle.jpg']);
  });

  it('passes a picture uploaded in this edit, one already in the repository, and one GitHub could not be asked about', async () => {
    const data = { featuredImage: '../../assets/blog/new.jpg', cover: '/media/blog/old.jpg', body: '![a](/src/assets/blog/unsure.png)' };
    const files = [{ path: '/src/assets/blog/new.jpg', draft: true }];
    const known = { 'public/media/blog/old.jpg': true, 'src/assets/blog/unsure.png': undefined };
    expect(await missingPictures(data, files, exists(known))).toEqual([]);
  });

  it('does not count a file the media library lists but this edit did not upload', async () => {
    const data = { featuredImage: '../../assets/blog/gone.jpg' };
    const files = [{ path: 'src/assets/blog/gone.jpg', draft: false }];
    expect(await missingPictures(data, files, exists({ 'src/assets/blog/gone.jpg': false }))).toEqual(['src/assets/blog/gone.jpg']);
  });

  it('says what to do', () => {
    expect(missingPicturesMessage(['src/assets/blog/a.jpg'])).toMatch(/^Not saved\. This picture is named in the post .*src\/assets\/blog\/a\.jpg\. Choose it again/);
  });
});

describe('githubExists', () => {
  const answering = (byBranch: Record<string, number | 'offline'>) => {
    const asked: string[] = [];
    const fetcher = (async (url: string) => {
      asked.push(url);
      const status = byBranch[new URL(url).searchParams.get('ref') ?? ''];
      if (status === 'offline') throw new TypeError('Failed to fetch');
      return new Response(null, { status });
    }) as unknown as typeof fetch;
    return { asked, fetcher };
  };

  it('asks main, then the post branch, by path, with the token', async () => {
    const { asked, fetcher } = answering({ main: 404, 'cms/blog/p': 200 });
    const exists = githubExists({ repo: 'o/r', token: 't', branches: ['main', 'cms/blog/p'], fetcher });
    expect(await exists('src/assets/blog/a b.jpg')).toBe(true);
    expect(asked).toEqual([
      'https://api.github.com/repos/o/r/contents/src/assets/blog/a%20b.jpg?ref=main',
      'https://api.github.com/repos/o/r/contents/src/assets/blog/a%20b.jpg?ref=cms%2Fblog%2Fp',
    ]);
  });

  it('is sure a file is missing only when every branch says 404', async () => {
    expect(await githubExists({ repo: 'o/r', token: 't', branches: ['main', 'b'], fetcher: answering({ main: 404, b: 404 }).fetcher })('x.png')).toBe(false);
    expect(await githubExists({ repo: 'o/r', token: 't', branches: ['main', 'b'], fetcher: answering({ main: 404, b: 403 }).fetcher })('x.png')).toBeUndefined();
    expect(await githubExists({ repo: 'o/r', token: 't', branches: ['main'], fetcher: answering({ main: 'offline' }).fetcher })('x.png')).toBeUndefined();
  });
});
