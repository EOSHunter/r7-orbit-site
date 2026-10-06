import { describe, expect, it } from 'vitest';
import { contactProblems, isPublicFile } from './no-contact.mjs';

describe('contactProblems', () => {
  it('finds a mailto: link and an email address', () => {
    expect(contactProblems('<a href="mailto:a@b.co">a@b.co</a>')).toHaveLength(2);
    expect(contactProblems('Write to hello@example.com.')).toEqual(['an email address ("hello@example.com")']);
    expect(contactProblems('<a href="MAILTO:?subject=x">Email</a>')).toHaveLength(1);
  });

  it('leaves alone what only looks like one: handles, CSS at-rules, versions', () => {
    for (const text of [
      'https://www.youtube.com/@R7Creatives',
      '@media (min-width: 40em) { a { color: red } } @font-face { }',
      'v1@1.2 and a@b',
      'Nothing to contact here.',
    ]) {
      expect(contactProblems(text), text).toEqual([]);
    }
  });
});

describe('isPublicFile', () => {
  it('looks at pages, feeds and text files, but not the admin or the fixtures', () => {
    expect(isPublicFile('index.html')).toBe(true);
    expect(isPublicFile('privacy/index.html')).toBe(true);
    expect(isPublicFile('sitemap-0.xml')).toBe(true);
    expect(isPublicFile('admin/index.html')).toBe(false);
    expect(isPublicFile('styleguide/sections/index.html')).toBe(false);
    expect(isPublicFile('media/photo.jpg')).toBe(false);
  });
});
