import { describe, expect, it } from 'vitest';
import {
  articleLd,
  breadcrumbLd,
  isoDuration,
  jsonLdString,
  personLd,
  profileUrls,
  prune,
  resolveSeo,
  truncate,
  videoObjectLd,
  websiteLd,
  type SiteInfo,
} from './seo';

const site: SiteInfo = {
  name: 'R7 Orbit',
  url: 'https://example.com',
  description: 'Site description.',
  author: { name: 'Your Name', photo: null },
  links: { github: '', youtube: 'https://www.youtube.com/@R7Creatives', x: '', rss: '/rss.xml' },
};

describe('resolveSeo', () => {
  const base = { base: 'https://example.com', fallbackDescription: 'Fallback.', fallbackImageAlt: 'Brand alt' };

  it('builds an absolute canonical with a trailing slash', () => {
    expect(resolveSeo({ ...base, path: '/blog/x' }).canonical).toBe('https://example.com/blog/x/');
    expect(resolveSeo({ ...base, path: '/blog/' }).canonical).toBe('https://example.com/blog/');
  });
  it('falls back to the brand image and its alt text', () => {
    const r = resolveSeo({ ...base, path: '/' });
    expect(r.imageUrl).toBe('https://example.com/og-default.png');
    expect(r.imageAlt).toBe('Brand alt');
  });
  it('uses a page image, absolutised, and never the brand alt for it', () => {
    const r = resolveSeo({ ...base, path: '/', image: '/media/a.png', imageAlt: 'A chart' });
    expect(r.imageUrl).toBe('https://example.com/media/a.png');
    expect(r.imageAlt).toBe('A chart');
    expect(resolveSeo({ ...base, path: '/', image: '/media/a.png' }).imageAlt).toBeUndefined();
  });
  it('treats a blank image as no image', () => {
    expect(resolveSeo({ ...base, path: '/', image: ' ' }).imageUrl).toBe('https://example.com/og-default.png');
  });
  it('falls back for a missing description and trims long ones to 155', () => {
    expect(resolveSeo({ ...base, path: '/', description: '' }).description).toBe('Fallback.');
    const long = resolveSeo({ ...base, path: '/', description: 'word '.repeat(60) }).description;
    expect(long.length).toBeLessThanOrEqual(155);
  });
});

describe('truncate', () => {
  it('leaves short text alone and cuts at a word with an ellipsis', () => {
    expect(truncate('short text')).toBe('short text');
    expect(truncate('alpha beta gamma delta', 14)).toBe('alpha beta…');
  });
});

describe('prune', () => {
  it('drops empty values recursively but keeps false and 0', () => {
    expect(prune({ a: '', b: null, c: [], d: { e: '' }, f: 0, g: false, h: ['x', ''], i: undefined })).toEqual({
      f: 0,
      g: false,
      h: ['x'],
    });
  });
});

describe('jsonLdString', () => {
  it('escapes < so a value cannot close the script tag', () => {
    expect(jsonLdString({ name: '</script><b>' })).not.toContain('<');
    expect(JSON.parse(jsonLdString({ name: '</script>' })).name).toBe('</script>');
  });
});

describe('person and sameAs', () => {
  it('keeps only filled http(s) profile links and skips the feed', () => {
    expect(profileUrls(site.links)).toEqual(['https://www.youtube.com/@R7Creatives']);
    expect(profileUrls({ x: 'javascript:alert(1)', bluesky: 'not a url' })).toEqual([]);
  });
  it('omits sameAs and image when there are none, and never includes the email', () => {
    const out = JSON.parse(jsonLdString(personLd({ ...site, links: { github: '' } })));
    expect(out).toEqual({ '@type': 'Person', name: 'Your Name', url: 'https://example.com/about/' });
  });
});

describe('websiteLd', () => {
  it('only adds SearchAction when asked', () => {
    expect(websiteLd(site).potentialAction).toBeUndefined();
    const ld = websiteLd(site, { search: true }) as { potentialAction: { target: { urlTemplate: string } } };
    expect(ld.potentialAction.target.urlTemplate).toBe('https://example.com/search/?q={search_term_string}');
  });
});

describe('articleLd', () => {
  const input = {
    type: 'BlogPosting' as const,
    path: '/blog/x/',
    title: 'Why every agent gets its own *room*',
    summary: 'S.',
    date: new Date('2026-10-03T00:00:00Z'),
  };
  it('strips title markers, uses ISO dates, falls back for image and modified date', () => {
    const ld = articleLd(site, input);
    expect(ld.headline).toBe('Why every agent gets its own room');
    expect(ld.datePublished).toBe('2026-10-03');
    expect(ld.dateModified).toBe('2026-10-03');
    expect(ld.image).toEqual(['https://example.com/og-default.png']);
    expect(ld.isBasedOn).toBeUndefined();
  });
  it('adds isBasedOn only for news', () => {
    const ld = articleLd(site, { ...input, type: 'NewsArticle', sourceUrl: 'https://src.example/a' });
    expect(ld.isBasedOn).toBe('https://src.example/a');
    expect(articleLd(site, { ...input, sourceUrl: 'https://src.example/a' }).isBasedOn).toBeUndefined();
  });
});

describe('videoObjectLd', () => {
  it('converts the duration and prefers the YouTube embed', () => {
    expect(isoDuration('12:48')).toBe('PT12M48S');
    expect(isoDuration('1:02:03')).toBe('PT1H2M3S');
    expect(isoDuration('soon')).toBeUndefined();
    const ld = videoObjectLd(site, {
      path: '/vlogs/v/',
      title: 'T',
      summary: 'S',
      date: '2026-09-21',
      duration: '12:48',
      youtubeId: 'dQw4w9WgXcQ',
    });
    expect(ld.duration).toBe('PT12M48S');
    expect(ld.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(ld.uploadDate).toBe('2026-09-21');
  });
});

describe('breadcrumbLd', () => {
  it('starts at Home, numbers items and leaves the current page without an item URL', () => {
    const ld = breadcrumbLd(site, [{ name: 'Blog', path: '/blog/' }, { name: 'A *post*' }]) as {
      itemListElement: { position: number; name: string; item?: string }[];
    };
    expect(ld.itemListElement.map((i) => [i.position, i.name, i.item])).toEqual([
      [1, 'Home', 'https://example.com/'],
      [2, 'Blog', 'https://example.com/blog/'],
      [3, 'A post', undefined],
    ]);
  });
});
