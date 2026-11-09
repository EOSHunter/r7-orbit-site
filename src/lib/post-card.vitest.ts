import { describe, expect, it } from 'vitest';
import { initials, parsePostHeader, parseQuotedHeader, plainParagraphs, postCardHtml, postDate } from './post-card.mjs';
import { longDate } from './text';

describe('the post card', () => {
  it('reads the [!POST] line by shape: address, date and @handle anywhere, then name, platform and role in order', () => {
    expect(parsePostHeader('Addy Osmani · @addyosmani · X · Anthropic · 2026-11-04 · https://x.com/a/status/1')).toEqual({
      name: 'Addy Osmani',
      platform: 'X',
      role: 'Anthropic',
      handle: '@addyosmani',
      date: '2026-11-04',
      url: 'https://x.com/a/status/1',
    });
    expect(parsePostHeader('https://bsky.app/p/1 | 2026-01-02 | Someone | Bluesky')).toMatchObject({ name: 'Someone', platform: 'Bluesky', date: '2026-01-02' });
  });

  it('refuses a line without a platform, with four plain parts, an http address or a date in another form', () => {
    expect(() => parsePostHeader('Only A Name')).toThrow(/needs the platform/);
    expect(() => parsePostHeader('A · B · C · D')).toThrow(/too many parts/);
    expect(() => parsePostHeader('A · X · http://example.com/')).toThrow(/https:\/\//);
    expect(() => parsePostHeader('A · X · 11/04/2026')).toThrow(/written 2026-11-04/);
    expect(() => postDate('2026-13-01')).toThrow(/written 2026-11-04/);
  });

  it('writes dates the way the rest of the site does', () => {
    for (const iso of ['2026-01-05', '2026-11-04', '2025-12-31']) expect(postDate(iso)).toBe(longDate(iso));
  });

  it('makes initials from the first two words, ignoring punctuation', () => {
    expect(initials('Addy Osmani')).toBe('AO');
    expect(initials('jane')).toBe('J');
    expect(initials('"Dr." Ada K. Lovelace')).toBe('DA');
    expect(initials('Élodie Durand')).toBe('ÉD');
  });

  it('reads a [!QUOTED] line, and labels a quoted post "Quoted post" by default', () => {
    expect(parseQuotedHeader('Quoted reply · 2026-10-30 · https://x.com/a/status/2')).toEqual({ label: 'Quoted reply', date: '2026-10-30', url: 'https://x.com/a/status/2' });
    expect(postCardHtml({ name: 'A', platform: 'X' }, '<p>t</p>', { quotedHtml: '<p>q</p>' })).toContain('<p class="post-card-quoted-label">Quoted post</p>');
  });

  it('escapes every field, and puts the address in cite and in the link', () => {
    const html = postCardHtml({ name: '<script>x</script>', platform: 'X "quoted"', handle: '@a&b', url: 'https://example.com/?a=1&b=2' }, '<p>Body</p>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Post on X &quot;quoted&quot;');
    expect(html).toContain('@a&amp;b');
    expect(html).toContain('cite="https://example.com/?a=1&amp;b=2"');
    expect(html).toContain('href="https://example.com/?a=1&amp;b=2" rel="noopener">View the post on X &quot;quoted&quot;</a>');
  });

  it('turns plain quoted text into escaped paragraphs', () => {
    expect(plainParagraphs('One <b>line</b>\nwrapped.\n\nTwo.')).toBe('<p>One &lt;b&gt;line&lt;/b&gt; wrapped.</p><p>Two.</p>');
    expect(plainParagraphs(undefined)).toBe('');
  });
});
