import { describe, expect, it } from 'vitest';
import site from '../data/site.json';
import { newsletterSchema, newsletterState, newsletterUsernameMissing } from './newsletter';
import { weekItems } from './newsletter-week.mjs';
import { pageSettingsOf } from './page-copy';
import { footerColumns, footerLinks, siteSchema } from './site-settings';

describe('the newsletter switch', () => {
  it('is off unless Enabled is ticked and a username is filled in', () => {
    expect(newsletterState({ enabled: false, username: 'r7orbit' }).show).toBe(false);
    expect(newsletterState({ enabled: true, username: '' }).show).toBe(false);
    expect(newsletterState({ enabled: true, username: '  ' }).show).toBe(false);
    expect(newsletterState(undefined)).toEqual({ show: false, action: '', archive: '' });
  });

  it("posts to Buttondown's embed endpoint for that username, and links its archive", () => {
    expect(newsletterState({ enabled: true, username: 'r7orbit' })).toEqual({
      show: true,
      action: 'https://buttondown.com/api/emails/embed-subscribe/r7orbit',
      archive: 'https://buttondown.com/r7orbit/archive/',
    });
  });

  it('refuses a username that is not one (an address, a path, a script)', () => {
    const words = { heading: 'h', text: 't', buttonLabel: 'b', emailLabel: 'e' };
    for (const username of ['r7orbit', 'r7-orbit_2', ''])
      expect(newsletterSchema.safeParse({ ...words, enabled: true, username }).success, username).toBe(true);
    for (const username of ['https://buttondown.com/r7', 'a/b', 'a b', '"><script>'])
      expect(newsletterSchema.safeParse({ ...words, enabled: true, username }).success, username).toBe(false);
    expect(newsletterState({ enabled: true, username: 'a/b' }).show).toBe(false);
  });

  it('says when Enabled is ticked with no username', () => {
    expect(newsletterUsernameMissing({ enabled: true, username: '' })).toBe(true);
    expect(newsletterUsernameMissing({ enabled: false, username: '' })).toBe(false);
  });

  it('names Buttondown on the Privacy page only while it is on', () => {
    const on = pageSettingsOf({ ...site, newsletter: { enabled: true, username: 'r7orbit' } });
    expect(on).toMatchObject({ newsletterConnected: true, newsletterProvider: 'Buttondown' });
    const off = pageSettingsOf({ ...site, newsletter: { enabled: false, username: 'r7orbit' } });
    expect(off).toMatchObject({ newsletterConnected: false, newsletterProvider: '' });
  });

  it('ships off, and the settings file parses', () => {
    expect(siteSchema.safeParse(site).success).toBe(true);
    expect(newsletterState(site.newsletter).show).toBe(false);
  });
});

describe('the footer', () => {
  const settings = siteSchema.parse(site);

  it('puts Newsletter first in Follow while it is on, and leaves it out while it is off', () => {
    expect(footerLinks(settings).map((l) => l.label)).not.toContain('Newsletter');
    const on = footerLinks({ ...settings, newsletter: { ...settings.newsletter, enabled: true, username: 'r7orbit' } });
    expect(on[0]).toEqual({ label: 'Newsletter', href: '/newsletter/', icon: 'mail', external: false });
  });

  it('splits the nav into Read (Latest and the archives) and Site (the rest, Apps, the agents, Search)', () => {
    const nav = [
      { label: 'Blog', href: '/blog/' },
      { label: 'Vlogs', href: '/vlogs/' },
      { label: 'Projects', href: '/projects/' },
      { label: 'News', href: '/news/' },
      { label: 'About', href: '/about/' },
    ];
    expect(footerColumns(nav)).toEqual({
      read: [
        { label: 'Latest', href: '/latest/' },
        { label: 'Blog', href: '/blog/' },
        { label: 'Vlogs', href: '/vlogs/' },
        { label: 'Projects', href: '/projects/' },
        { label: 'News', href: '/news/' },
      ],
      site: [
        { label: 'Apps', href: '/apps/' },
        { label: 'About', href: '/about/' },
        { label: 'The agents', href: '/about/#the-agents' },
        { label: 'Search', href: '/search/' },
      ],
    });
  });

  it('adds News when the nav leaves it out, keeps a renamed label, and leaves links to other sites out', () => {
    const { read, site: pages } = footerColumns([
      { label: 'Writing', href: '/blog/' },
      { label: 'Apps', href: '/apps/' },
      { label: 'Shop', href: 'https://example.org/' },
    ]);
    expect(read.map((l) => l.label)).toEqual(['Latest', 'News', 'Writing']);
    expect(pages.map((l) => l.href)).toEqual(['/apps/', '/search/']);
  });

  it('leaves a nav link marked "Also in the footer" to the Follow column, so it is not in the footer twice', () => {
    const { read, site: pages } = footerColumns([
      { label: 'News', href: '/news/', footer: true },
      { label: 'Apps', href: '/apps/', footer: true },
      { label: 'About', href: '/about/' },
    ]);
    expect(read.map((l) => l.href)).toEqual(['/latest/']);
    expect(pages.map((l) => l.href)).toEqual(['/about/', '/about/#the-agents', '/search/']);
  });
});

describe("the week's list for an issue", () => {
  const post = (collection: string, id: string, date: string, extra: Record<string, unknown> = {}) => ({
    collection,
    id,
    data: { title: `*${id}*`, date, summary: `About ${id}.`, author: 'pulsar', ...extra },
  });

  it('lists published posts in the range by kind, newest first, with absolute links', () => {
    const text = weekItems(
      [
        post('news', 'a', '2026-11-04'),
        post('news', 'b', '2026-11-06'),
        post('blog', 'c', '2026-11-05', { author: undefined }),
        post('news', 'old', '2026-11-01'),
        post('news', 'draft', '2026-11-05', { draft: true }),
        post('news', 'future', '2026-11-09'),
      ],
      { from: '2026-11-03', to: '2026-11-09', today: '2026-11-07', site: 'https://r7orbit.io' },
    );
    expect(text).toBe(
      [
        'Published from 2026-11-03 to 2026-11-09: 3 posts.',
        '\n## News\n',
        '- [b](https://r7orbit.io/news/b/) (2026-11-06, pulsar): About b.',
        '- [a](https://r7orbit.io/news/a/) (2026-11-04, pulsar): About a.',
        '\n## Blog\n',
        '- [c](https://r7orbit.io/blog/c/) (2026-11-05): About c.',
      ].join('\n'),
    );
  });

  it('says so when nothing went up', () => {
    expect(
      weekItems([], { from: '2026-11-03', to: '2026-11-09', today: '2026-11-09', site: 'https://r7orbit.io' }),
    ).toContain('Nothing went up in that range.');
  });
});
