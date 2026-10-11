import { describe, expect, it } from 'vitest';
import {
  isTestSiteKey,
  isWaitlistSource,
  normaliseEmail,
  SITE_KEY_PATTERN,
  sourceForKind,
  TURNSTILE_TEST_SITE_KEY,
  waitlistState,
} from './waitlist';

// The waitlist's shared rules (src/lib/waitlist.ts): which addresses are accepted, and when a build draws the forms.

describe('normaliseEmail', () => {
  it('trims and lowercases a plain address', () => {
    expect(normaliseEmail('  Reader.Name+list@Example.CO.uk ')).toBe('reader.name+list@example.co.uk');
    expect(normaliseEmail('a_b-c%d@sub-domain.example.org')).toBe('a_b-c%d@sub-domain.example.org');
    expect(normaliseEmail('name@xn--bcher-kva.example')).toBe('name@xn--bcher-kva.example');
    expect(normaliseEmail('name@example.xn--p1ai')).toBe('name@example.xn--p1ai');
  });

  it('refuses anything that is not a plain address', () => {
    for (const value of [
      '',
      '   ',
      'no-at-sign',
      '@example.com',
      'name@',
      'name@example',
      'name@@example.com',
      'a@b@example.com',
      '.name@example.com',
      'name.@example.com',
      'na..me@example.com',
      '"quoted"@example.com',
      'name with space@example.com',
      'name@-example.com',
      'name@example-.com',
      'name@exa_mple.com',
      'name@example.c',
      'name@example.123',
      'name@[192.168.0.1]',
      'name@192.168.0.1',
      'name(comment)@example.com',
      'name@example..com',
      'nàme@example.com',
      '<script>@example.com',
    ]) {
      expect(normaliseEmail(value), value).toBeUndefined();
    }
    for (const value of [undefined, null, 42, ['a@example.com'], { email: 'a@example.com' }]) {
      expect(normaliseEmail(value)).toBeUndefined();
    }
  });

  it('enforces the lengths: 254 in all, 64 before the @', () => {
    const domain = `${'d'.repeat(63)}.${'e'.repeat(63)}.${'f'.repeat(63)}.com`;
    const local = 'l'.repeat(254 - 1 - domain.length);
    expect(`${local}@${domain}`).toHaveLength(254);
    expect(normaliseEmail(`${local}@${domain}`)).toBe(`${local}@${domain}`);
    expect(normaliseEmail(`${local}x@${domain}`)).toBeUndefined();
    expect(normaliseEmail(`${'l'.repeat(64)}@example.com`)).toBeDefined();
    expect(normaliseEmail(`${'l'.repeat(65)}@example.com`)).toBeUndefined();
    expect(normaliseEmail(`name@${'a'.repeat(64)}.com`)).toBeUndefined();
  });
});

describe('sources', () => {
  it('are hero, blog, vlog and other; a post band sends blog (blog and news), vlog, or other (projects and repos)', () => {
    expect(['hero', 'blog', 'vlog', 'other'].every(isWaitlistSource)).toBe(true);
    expect(isWaitlistSource('news')).toBe(false);
    expect(isWaitlistSource(undefined)).toBe(false);
    // A news item counts as `blog`: both are drawn by ArticlePage, and the brief keeps the sources to four.
    expect(['blog', 'news', 'vlogs', 'projects', 'repos'].map(sourceForKind)).toEqual([
      'blog',
      'blog',
      'vlog',
      'other',
      'other',
    ]);
  });
});

describe('site keys', () => {
  it('accept the shape Cloudflare issues, and tell test keys apart', () => {
    expect(SITE_KEY_PATTERN.test('0x4AAAAAAABkMYinukE8nzY')).toBe(true);
    expect(SITE_KEY_PATTERN.test(TURNSTILE_TEST_SITE_KEY)).toBe(true);
    expect(SITE_KEY_PATTERN.test('0x4AAA AAAABkMYinukE8nzY')).toBe(false);
    expect(SITE_KEY_PATTERN.test('https://example.com')).toBe(false);
    expect(isTestSiteKey(TURNSTILE_TEST_SITE_KEY)).toBe(true);
    expect(isTestSiteKey('3x00000000000000000000FF')).toBe(true);
    expect(isTestSiteKey('0x4AAAAAAABkMYinukE8nzY')).toBe(false);
  });
});

describe('waitlistState', () => {
  const live = { dev: false, preview: false };
  const key = '0x4AAAAAAABkMYinukE8nzY';

  it('draws nothing on the live site unless the waitlist is on AND has a site key', () => {
    expect(waitlistState({ enabled: false, turnstileSiteKey: '' }, live)).toEqual({ show: false });
    expect(waitlistState({ enabled: false, turnstileSiteKey: key }, live)).toEqual({ show: false });
    expect(waitlistState({ enabled: true, turnstileSiteKey: '' }, live)).toEqual({ show: false });
    expect(waitlistState({ enabled: true, turnstileSiteKey: '   ' }, live)).toEqual({ show: false });
    expect(waitlistState({ enabled: true, turnstileSiteKey: key }, live)).toEqual({ show: true, siteKey: key });
  });

  it('draws the forms under astro dev, with the test key and a note while the live site would not', () => {
    expect(waitlistState({ enabled: false, turnstileSiteKey: '' }, { dev: true, preview: false })).toEqual({
      show: true,
      siteKey: TURNSTILE_TEST_SITE_KEY,
      note: 'dev',
    });
    expect(waitlistState({ enabled: true, turnstileSiteKey: key }, { dev: true, preview: false })).toEqual({
      show: true,
      siteKey: key,
    });
  });

  it('draws the forms with the test key in a WAITLIST_PREVIEW build, whatever the settings', () => {
    for (const settings of [
      { enabled: false, turnstileSiteKey: '' },
      { enabled: true, turnstileSiteKey: key },
    ]) {
      expect(waitlistState(settings, { dev: false, preview: true })).toEqual({
        show: true,
        siteKey: TURNSTILE_TEST_SITE_KEY,
      });
    }
  });
});
