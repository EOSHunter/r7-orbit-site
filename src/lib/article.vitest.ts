import { describe, expect, it } from 'vitest';
import { plainText, resolveImage, slugify, tocTree, uniqueId } from './article';

describe('slugify', () => {
  it('makes lowercase hyphenated ids', () => {
    expect(slugify('Small rooms, clear doors')).toBe('small-rooms-clear-doors');
    expect(slugify('  Café & Crème  ')).toBe('cafe-creme');
    expect(slugify('Step 1 - setup')).toBe('step-1-setup');
  });
});

describe('plainText', () => {
  it('drops tags and collapses whitespace', () => {
    expect(plainText('A <em>brass</em>\n  phrase')).toBe('A brass phrase');
  });
});

describe('uniqueId', () => {
  it('never repeats', () => {
    expect(uniqueId('code')).not.toBe(uniqueId('code'));
  });
});

describe('resolveImage', () => {
  it('passes local paths and metadata objects through', () => {
    expect(resolveImage('/media/a.png', 'T')).toEqual({ src: '/media/a.png' });
    expect(resolveImage({ src: '/a.png', width: 4, height: 3 }, 'T').width).toBe(4);
  });
  it('refuses other sites, protocol-relative included', () => {
    expect(() => resolveImage('https://example.com/a.png', 'Figure')).toThrow(/another site/);
    expect(() => resolveImage('//example.com/a.png', 'Figure')).toThrow(/another site/);
  });
});

describe('tocTree', () => {
  const headings = [
    { depth: 1, slug: 'title', text: 'Title' },
    { depth: 2, slug: 'a', text: 'A' },
    { depth: 3, slug: 'a1', text: 'A1' },
    { depth: 4, slug: 'deep', text: 'Deep' },
    { depth: 2, slug: 'b', text: 'B' },
  ];
  it('nests h3 under h2 and ignores other depths', () => {
    expect(tocTree(headings)).toEqual([
      { slug: 'a', text: 'A', children: [{ slug: 'a1', text: 'A1' }] },
      { slug: 'b', text: 'B', children: [] },
    ]);
  });
  it('can stop at h2', () => {
    expect(tocTree(headings, 2).every((n) => n.children.length === 0)).toBe(true);
  });
  it('does not attach an h3 that has no h2 before it', () => {
    expect(tocTree([{ depth: 3, slug: 'x', text: 'X' }])).toEqual([]);
  });
});
