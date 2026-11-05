import { describe, expect, it } from 'vitest';
import {
  adjacentPosts,
  contentWarnings,
  countWords,
  featuredPost,
  pinnedPost,
  filterPublished,
  isPublished,
  postUrl,
  previewLabel,
  publishState,
  postsWithTag,
  readTime,
  relatedPosts,
  seriesFor,
  sortByDateDesc,
  tagCounts,
  tagsWithPages,
  type CollectionName,
  type Post,
  type PostData,
} from './content';

function post(
  id: string,
  date: string,
  extra: Partial<PostData> = {},
  collection: CollectionName = 'blog',
  body = '',
): Post {
  return {
    collection,
    id,
    body,
    data: { title: id, date: new Date(`${date}T00:00:00Z`), tags: [], featured: false, draft: false, ...extra },
  };
}

const NOW = new Date('2026-10-03T15:00:00Z');

describe('publishing rules', () => {
  it('hides drafts', () => {
    expect(isPublished(post('a', '2026-09-01', { draft: true }), { now: NOW })).toBe(false);
  });
  it('hides future dates but shows today', () => {
    expect(isPublished(post('a', '2026-10-04'), { now: NOW })).toBe(false);
    expect(isPublished(post('b', '2026-10-03'), { now: NOW })).toBe(true);
    expect(isPublished(post('c', '2026-10-02'), { now: NOW })).toBe(true);
  });
  it('shows everything when previewing', () => {
    const posts = [post('a', '2030-01-01'), post('b', '2026-01-01', { draft: true })];
    expect(filterPublished(posts, { now: NOW, includeUnpublished: true })).toHaveLength(2);
    expect(filterPublished(posts, { now: NOW })).toHaveLength(0);
  });
});

describe('publish state and preview label', () => {
  it('names the state; draft wins over scheduled', () => {
    expect(publishState(post('a', '2026-01-01'), NOW)).toBe('published');
    expect(publishState(post('a', '2026-10-03'), NOW)).toBe('published');
    expect(publishState(post('a', '2026-10-04'), NOW)).toBe('scheduled');
    expect(publishState(post('a', '2026-10-04', { draft: true }), NOW)).toBe('draft');
  });
  it('labels unpublished posts for the dev badge', () => {
    expect(previewLabel(post('a', '2026-01-01'), NOW)).toBeUndefined();
    expect(previewLabel(post('a', '2026-01-01', { draft: true }), NOW)).toBe('Draft');
    expect(previewLabel(post('a', '2026-12-25'), NOW)).toBe('Scheduled for Dec 25, 2026');
  });
});

describe('sortByDateDesc', () => {
  it('puts the newest first, breaks ties by id, and does not mutate', () => {
    const input = [post('b', '2026-01-01'), post('a', '2026-01-01'), post('c', '2026-05-01')];
    expect(sortByDateDesc(input).map((p) => p.id)).toEqual(['c', 'a', 'b']);
    expect(input.map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('read time', () => {
  const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');
  it('rounds up and is at least one minute', () => {
    expect(readTime(post('a', '2026-01-01', {}, 'blog', ''))).toBe(1);
    expect(readTime(post('a', '2026-01-01', {}, 'blog', words(220)))).toBe(1);
    expect(readTime(post('a', '2026-01-01', {}, 'blog', words(221)))).toBe(2);
    expect(readTime(post('a', '2026-01-01', {}, 'blog', words(1760)))).toBe(8);
  });
  it('lets frontmatter win', () => {
    expect(readTime(post('a', '2026-01-01', { readTime: 12 }, 'blog', words(10)))).toBe(12);
  });
  it('does not count code blocks, markup or link targets', () => {
    const body = [
      '## Heading',
      '',
      'Two [words](https://example.com/a/long/path).',
      '',
      '```bash',
      'git worktree add ../a -b b',
      '```',
      '',
      '![alt text](/x.png)',
      '<br>',
    ].join('\n');
    expect(countWords(body)).toBe(3);
  });
});

describe('tags', () => {
  const posts = [
    post('a', '2026-01-01', { tags: ['x', 'y'] }),
    post('b', '2026-02-01', { tags: ['y', 'z'] }),
    post('c', '2026-03-01', { tags: ['y', 'y'] }),
  ];
  it('counts a tag once per post, most used first', () => {
    expect(tagCounts(posts)).toEqual([
      { tag: 'y', count: 3 },
      { tag: 'x', count: 1 },
      { tag: 'z', count: 1 },
    ]);
  });
  it('gives pages only to tags with two or more posts', () => {
    expect(tagsWithPages(posts)).toEqual(['y']);
  });
  it('lists posts for a tag newest first', () => {
    expect(postsWithTag(posts, 'y').map((p) => p.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('relatedPosts', () => {
  const me = post('me', '2026-06-01', { tags: ['a', 'b'] });
  const two = post('two', '2026-01-01', { tags: ['a', 'b'] }, 'news');
  const oneSameKind = post('one-blog', '2026-02-01', { tags: ['a'] });
  const oneNews = post('one-news', '2026-05-01', { tags: ['b'] }, 'news');
  const none = post('none', '2026-04-01', { tags: ['q'] });
  const all = [me, none, oneNews, oneSameKind, two];

  it('ranks by shared tags, then recency (not kind); excludes self and unrelated', () => {
    expect(relatedPosts(me, all, 3, NOW).map((p) => p.id)).toEqual(['two', 'one-news', 'one-blog']);
  });
  it('breaks a full tie by id', () => {
    const b = post('b', '2026-03-01', { tags: ['a'] });
    const a = post('a', '2026-03-01', { tags: ['a'] });
    expect(relatedPosts(me, [b, a], 3, NOW).map((p) => p.id)).toEqual(['a', 'b']);
  });
  it('counts a repeated tag once', () => {
    const dup = post('dup', '2026-09-01', { tags: ['a', 'a', 'a'] });
    expect(relatedPosts(me, [dup, oneNews, two], 3, NOW).map((p) => p.id)).toEqual(['two', 'dup', 'one-news']);
  });
  it('leaves out drafts and scheduled posts, but not today', () => {
    const draft = post('draft', '2026-09-01', { tags: ['a', 'b'], draft: true });
    const later = post('later', '2026-10-04', { tags: ['a', 'b'] });
    const today = post('today', '2026-10-03', { tags: ['a'] });
    expect(relatedPosts(me, [draft, later, today, none], 3, NOW).map((p) => p.id)).toEqual(['today']);
  });
  it('returns an empty list when nothing matches', () => {
    expect(relatedPosts(me, [none], 3, NOW)).toEqual([]);
    expect(relatedPosts(me, [], 3, NOW)).toEqual([]);
  });
  it('respects the limit', () => {
    expect(relatedPosts(me, all, 1, NOW).map((p) => p.id)).toEqual(['two']);
  });
  it('treats the same id in another collection as a different post', () => {
    const twin = post('me', '2026-06-01', { tags: ['a'] }, 'news');
    expect(relatedPosts(me, [twin], 3, NOW).map((p) => p.collection)).toEqual(['news']);
  });
  it('returns nothing for a post without tags', () => {
    expect(relatedPosts(post('x', '2026-01-01'), all, 3, NOW)).toEqual([]);
  });
});

describe('seriesFor', () => {
  const s2 = post('s2', '2026-02-01', { series: 'Rooms', seriesOrder: 2 });
  const s1 = post('s1', '2026-03-01', { series: 'Rooms', seriesOrder: 1 });
  const s3 = post('s3', '2026-01-01', { series: 'Rooms', seriesOrder: 3 });
  const other = post('o', '2026-01-01', { series: 'Other', seriesOrder: 1 });
  const all = [s2, other, s3, s1];

  it('orders by seriesOrder, not date, and finds neighbours', () => {
    const info = seriesFor(s2, all)!;
    expect(info.posts.map((p) => p.id)).toEqual(['s1', 's2', 's3']);
    expect(info.position).toBe(2);
    expect(info.prev?.id).toBe('s1');
    expect(info.next?.id).toBe('s3');
  });
  it('has no prev at the start and no next at the end', () => {
    expect(seriesFor(s1, all)!.prev).toBeUndefined();
    expect(seriesFor(s3, all)!.next).toBeUndefined();
  });
  it('is undefined for a post outside any series, or one that is not published', () => {
    expect(seriesFor(post('n', '2026-01-01'), all)).toBeUndefined();
    expect(seriesFor(s1, [s2, s3])).toBeUndefined();
  });
});

describe('adjacentPosts, featuredPost, postUrl', () => {
  const sorted = sortByDateDesc([post('a', '2026-01-01'), post('b', '2026-02-01'), post('c', '2026-03-01')]);
  it('finds newer and older neighbours', () => {
    expect(adjacentPosts(sorted[1], sorted)).toEqual({ newer: sorted[0], older: sorted[2] });
    expect(adjacentPosts(sorted[0], sorted).newer).toBeUndefined();
  });
  it('pins the newest featured post', () => {
    const posts = [
      post('a', '2026-01-01', { featured: true }),
      post('b', '2026-02-01', { featured: true }),
      post('c', '2026-03-01'),
    ];
    expect(featuredPost(posts)?.id).toBe('b');
    expect(featuredPost([post('c', '2026-03-01')])).toBeUndefined();
  });
  it('gives the pinned post only on a page with a Pinned post block and more than one post', () => {
    const posts = [post('a', '2026-01-01', { featured: true }), post('c', '2026-03-01')];
    expect(pinnedPost(posts)?.id).toBe('a');
    expect(pinnedPost(posts, false)).toBeUndefined();
    expect(pinnedPost([post('a', '2026-01-01', { featured: true })])).toBeUndefined();
    expect(pinnedPost([post('c', '2026-03-01')])).toBeUndefined();
  });
  it('builds URLs with a trailing slash', () => {
    expect(postUrl({ collection: 'vlogs', id: 'my-video' })).toBe('/vlogs/my-video/');
  });
});

describe('contentWarnings', () => {
  it('is quiet for clean content', () => {
    expect(contentWarnings([post('a', '2026-01-01', { featured: true }), post('b', '2026-01-02')])).toEqual([]);
  });
  it('warns about two featured posts', () => {
    const w = contentWarnings([
      post('a', '2026-01-01', { featured: true }),
      post('b', '2026-01-02', { featured: true }),
    ]);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/featured/);
  });
  it('warns about the same title in the same kind only', () => {
    const a = post('a', '2026-01-01', { title: 'Same' });
    const b = post('b', '2026-01-02', { title: 'same' });
    const c = post('c', '2026-01-03', { title: 'Same' }, 'news');
    expect(contentWarnings([a, b, c])).toHaveLength(1);
  });
  it('warns about a repeated series number', () => {
    const w = contentWarnings([
      post('a', '2026-01-01', { series: 'S', seriesOrder: 1 }),
      post('b', '2026-01-02', { series: 'S', seriesOrder: 1 }),
    ]);
    expect(w).toHaveLength(1);
  });
});
