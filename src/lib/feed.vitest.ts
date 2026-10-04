import { describe, expect, it } from 'vitest';
import { absolutizeHtml, buildRss, cdata, escapeXml, type FeedItem } from './feed';
import { assertWellFormed } from './xml-check';

const channel = {
  title: 'R7 Orbit',
  description: 'Desc & more',
  link: 'https://example.com/',
  selfUrl: 'https://example.com/rss.xml',
};
const item = (n: number, extra: Partial<FeedItem> = {}): FeedItem => ({
  title: `Post ${n}`,
  link: `https://example.com/blog/p${n}/`,
  date: new Date(Date.UTC(2026, 8, n)),
  description: `Summary ${n}`,
  ...extra,
});

describe('escapeXml / cdata', () => {
  it('escapes markup characters and drops forbidden control characters', () => {
    expect(escapeXml('a & b < c > "d" \u0001')).toBe('a &amp; b &lt; c &gt; &quot;d&quot; ');
  });
  it('splits a ]]> inside CDATA', () => {
    expect(cdata('a ]]> b')).toBe('<![CDATA[a ]]]]><![CDATA[> b]]>');
  });
});

describe('buildRss', () => {
  it('is well-formed RSS 2.0 with the channel metadata', () => {
    const xml = buildRss(channel, [item(1)]);
    assertWellFormed(xml);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<atom:link href="https://example.com/rss.xml" rel="self" type="application/rss+xml" />');
    expect(xml).toContain('<description>Desc &amp; more</description>');
    expect(xml).toContain('<lastBuildDate>Tue, 01 Sep 2026 00:00:00 GMT</lastBuildDate>');
  });
  it('sorts newest first, caps at the limit and uses the permalink as an isPermaLink guid', () => {
    const xml = buildRss(channel, [item(1), item(3), item(2)], 2);
    expect(xml.indexOf('Post 3')).toBeLessThan(xml.indexOf('Post 2'));
    expect(xml).not.toContain('Post 1');
    expect(xml).toContain('<guid isPermaLink="true">https://example.com/blog/p3/</guid>');
    expect(xml).toContain('<pubDate>Thu, 03 Sep 2026 00:00:00 GMT</pubDate>');
  });
  it('strips title markers and escapes the title', () => {
    const xml = buildRss(channel, [item(1, { title: 'Why *rooms* & agents' })]);
    expect(xml).toContain('<title>Why rooms &amp; agents</title>');
    assertWellFormed(xml);
  });
  it('puts full content in content:encoded only when given, and survives ]]>', () => {
    const xml = buildRss(channel, [item(1, { contentHtml: '<p>x ]]> y</p>' }), item(2)]);
    expect(xml.match(/<content:encoded>/g)).toHaveLength(1);
    assertWellFormed(xml);
  });
  it('writes categories, and a channel with no items', () => {
    expect(buildRss(channel, [item(1, { categories: ['evals'] })])).toContain('<category>evals</category>');
    const empty = buildRss(channel, []);
    assertWellFormed(empty);
    expect(empty).not.toContain('<item>');
  });
});

describe('absolutizeHtml', () => {
  it('makes root-relative href and src absolute and leaves others alone', () => {
    const html = '<a href="/blog/x/">a</a><img src="/m/a.png"><a href="https://x.y/">b</a><a href="//cdn/z">c</a>';
    expect(absolutizeHtml(html, 'https://example.com')).toBe(
      '<a href="https://example.com/blog/x/">a</a><img src="https://example.com/m/a.png"><a href="https://x.y/">b</a><a href="//cdn/z">c</a>',
    );
  });
});
