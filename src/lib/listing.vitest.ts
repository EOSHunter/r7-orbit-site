import { describe, expect, it } from 'vitest';
import { countLabel, pageCount, pageUrl, pageWindow, paginate } from './listing';

describe('listing', () => {
  it('builds page urls with real paths', () => {
    expect(pageUrl('/blog/', 1)).toBe('/blog/');
    expect(pageUrl('/blog/', 3)).toBe('/blog/page/3/');
  });

  it('counts pages, with at least one for an empty list', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(12)).toBe(1);
    expect(pageCount(13)).toBe(2);
  });

  it('slices a page and reports where it starts', () => {
    const p = paginate([1, 2, 3, 4, 5], 2, 2);
    expect(p).toEqual({ items: [3, 4], page: 2, pages: 3, start: 2 });
  });

  it('windows long page lists with gaps', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(10, 20)).toEqual([1, null, 8, 9, 10, 11, 12, null, 20]);
  });

  it('pluralises counts', () => {
    expect(countLabel(1, 'post', 'posts')).toBe('1 post');
    expect(countLabel(0, 'post', 'posts')).toBe('0 posts');
  });
});
