import { describe, expect, it } from 'vitest';
import navFixture from '../../tests/fixtures/site-nav.json';
import data from '../data/site.json';
import { footerItems, navItems } from '../data/nav';
import { siteFiles } from './site-routes';
import {
  footerLinks,
  isCurrent,
  parseSite,
  routePatterns,
  SEARCH_KIND_HREFS,
  searchKinds,
  siteLinkProblems,
  siteSchema,
  type SiteSettings,
} from './site-settings';

// Two kinds of test. "The settings file as it is" reads src/data/site.json, which the author edits in /admin: the expected nav,
// footer and chips come from that file, never from a copy of it, so renaming or removing a link cannot fail a test. The rules
// (what the schema refuses, the footer, renamed labels) run on `fixture`: the real file with a fixed nav, footer and profile
// links, so a test that changes "the third nav link" or "the first footer link" knows what it is changing.

const site = parseSite(data);
/** The real settings with a fixed nav (tests/fixtures/site-nav.json, also drawn by /styleguide/nav/), profile links and footer. */
const fixture = parseSite({
  ...data,
  nav: navFixture,
  links: { github: 'https://github.com/example', youtube: 'https://www.youtube.com/@example' },
  footer: {
    ...data.footer,
    links: [
      { label: 'GitHub', social: 'github', icon: 'github' },
      { label: 'YouTube', social: 'youtube', icon: 'vlog' },
    ],
  },
});
/** A copy of the fixture with some fields changed. */
const edit = (change: (s: SiteSettings) => void): SiteSettings => {
  const copy = structuredClone(fixture);
  change(copy);
  return copy;
};
const problems = (value: unknown) => {
  const result = siteSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};
const renamed = fixture.nav.map((item) => ({ ...item, label: `Renamed ${item.label}` }));

describe('the settings file as it is', () => {
  it('reads without a problem, and every link and picture in it exists', () => {
    expect(problems(data)).toEqual([]);
    expect(siteLinkProblems(site, siteFiles())).toEqual([]);
  });

  it('draws the nav the file holds: its labels and addresses, in its order', () => {
    expect(navItems.map((i) => [i.label, i.href])).toEqual(data.nav.map((i) => [i.label.trim(), i.href]));
  });

  it('draws the footer the file holds: the nav links marked for it, then its own links (an empty profile link left out)', () => {
    const expected = [
      ...site.nav.filter((i) => i.footer).map((i) => [i.label, i.href]),
      ...site.footer.links.map((l) => [l.label, l.social ? site.links[l.social] : l.href]),
    ].filter(([, href]) => href);
    expect(footerItems.map((l) => [l.label, l.href])).toEqual(expected);
    for (const link of footerItems) expect(link.external, link.href).toBe(link.href.startsWith('https://'));
  });

  it('has only GitHub and YouTube as profile links, and no email', () => {
    expect(Object.keys(site.links)).toEqual(['github', 'youtube']);
    expect(Object.keys(site.author)).toEqual(['name', 'bio', 'photo']);
    expect(problems({ ...data, links: { ...data.links, x: '' } }).join()).toMatch(/links/);
    expect(problems({ ...data, author: { ...data.author, email: 'me@example.org' } }).join()).toMatch(/author/);
  });

  it('offers on the search page the archives the nav links to, labelled as the nav labels them, in nav order', () => {
    expect(searchKinds(navItems)).toEqual(navItems.filter((i) => SEARCH_KIND_HREFS.includes(i.href)));
  });
});

describe('the footer', () => {
  it('lists the nav links marked for it, then the profile links; an empty profile link leaves its icon out', () => {
    expect(footerLinks(fixture)).toEqual([
      { label: 'Apps', href: '/apps/', icon: 'play', external: false },
      { label: 'GitHub', href: 'https://github.com/example', icon: 'github', external: true },
      { label: 'YouTube', href: 'https://www.youtube.com/@example', icon: 'vlog', external: true },
    ]);
    const withoutGithub = edit((s) => (s.links.github = ''));
    expect(footerLinks(withoutGithub).map((l) => l.label)).toEqual(['Apps', 'YouTube']);
  });
});

describe('a renamed nav label', () => {
  it('still marks its section as current: pages name the section by address', () => {
    const blog = renamed.find((i) => i.href === '/blog/')!;
    expect(blog.label).toBe('Renamed Blog');
    expect(isCurrent(blog, '/blog/')).toBe(true);
    expect(renamed.filter((i) => isCurrent(i, '/blog/'))).toHaveLength(1);
    // The old way (a label) no longer matches anything, renamed or not.
    expect(fixture.nav.some((i) => isCurrent(i, 'Blog'))).toBe(false);
    expect(fixture.nav.some((i) => isCurrent(i, undefined))).toBe(false);
  });

  it('keeps the search page chips (found by address, labelled as the nav labels them)', () => {
    expect(searchKinds(fixture.nav).map((i) => i.label)).toEqual(['News', 'Blog', 'Vlogs', 'Projects', 'Repos']);
    expect(searchKinds(renamed).map((i) => [i.label, i.href])).toEqual([
      ['Renamed News', '/news/'],
      ['Renamed Blog', '/blog/'],
      ['Renamed Vlogs', '/vlogs/'],
      ['Renamed Projects', '/projects/'],
      ['Renamed Repos', '/repos/'],
    ]);
  });

  it('keeps the footer links, with the new label', () => {
    expect(footerLinks({ ...fixture, nav: renamed })[0]).toEqual({
      label: 'Renamed Apps',
      href: '/apps/',
      icon: 'play',
      external: false,
    });
  });
});

describe('what the schema refuses', () => {
  it('leaves an empty profile link out, and takes https addresses only', () => {
    expect(problems(edit((s) => (s.links.github = '')))).toEqual([]);
    expect(problems(edit((s) => (s.links.github = 'https://github.com/someone')))).toEqual([]);
    for (const bad of [
      'http://github.com/someone',
      'github.com/someone',
      'javascript:alert(1)',
      'https://',
      ' https://github.com/a',
    ]) {
      expect(problems(edit((s) => (s.links.github = bad))).join(), bad).toMatch(/^links\.github: .*https:\/\//);
    }
  });

  it('takes a nav address on this site (/…) or another (https://…), and nothing else', () => {
    for (const ok of ['/notes/', '/#top', 'https://example.org/']) {
      expect(problems(edit((s) => (s.nav[0].href = ok))), ok).toEqual([]);
    }
    for (const bad of [
      'blog/',
      '//evil.example/',
      'http://example.org/',
      'javascript:alert(1)',
      'mailto:me@example.org',
      '',
    ]) {
      expect(problems(edit((s) => (s.nav[0].href = bad))).join(), bad).toMatch(/^nav\.0\.href: /);
    }
  });

  it('refuses two nav links to the same address, and two footer links to the same address', () => {
    expect(problems(edit((s) => (s.nav[1].href = '/blog/')))).toEqual([
      'nav: two nav links go to /blog/: each page is in the nav once',
    ]);
    const twice = edit((s) => {
      s.footer.links.push({ label: 'One', href: '/about/', icon: 'link' });
      s.footer.links.push({ label: 'Again', href: '/about/', icon: 'link' });
    });
    expect(problems(twice).join()).toMatch(/two footer links go to \/about\//);
  });

  it('needs a footer link to have an address or a profile link, not both and not neither', () => {
    expect(problems(edit((s) => (s.footer.links[0].href = '/about/'))).join()).toMatch(
      /"GitHub" needs either .* not both/,
    );
    expect(problems(edit((s) => delete s.footer.links[0].social)).join()).toMatch(
      /"GitHub" needs either .* not neither/,
    );
  });

  it('reads a field the editor cleared ("" or null) as absent', () => {
    const cleared = edit((s) => {
      Object.assign(s.nav[0], { footer: null, icon: '' });
      s.footer.links.push({ label: 'Elsewhere', href: '/about/', icon: 'link' });
      Object.assign(s.footer.links[2], { social: '' });
    });
    expect(problems(cleared)).toEqual([]);
  });

  it('needs an icon for a nav link that is also in the footer', () => {
    expect(problems(edit((s) => delete s.nav[5].icon))).toEqual([
      'nav.5.icon: "Apps" is shown in the footer, so it needs an icon',
    ]);
  });

  it('refuses an unknown field, and a missing name, and says which file and field', () => {
    expect(problems({ ...data, colour: 'red' }).join()).toMatch(/colour/);
    expect(() => parseSite({ ...data, name: '' })).toThrow(
      /src\/data\/site\.json \(Site settings in \/admin\) has a problem:\n {2}- name: /,
    );
  });
});

describe('links to pages that do not exist', () => {
  const files = {
    pages: ['index.astro', 'blog/index.astro', 'blog/[slug].astro', 'robots.txt.ts', 'docs/[...path].astro'],
    publicFiles: ['/og-default.png'],
  };

  it('reads routes from the file names under src/pages', () => {
    const match = (path: string) => routePatterns(files.pages).some((r) => r.test(path));
    expect(['/', '/blog/', '/blog/a-post/', '/robots.txt', '/docs/a/b/'].every(match)).toBe(true);
    expect(['/blog', '/news/', '/blog/a/b/', '/robots.txt/'].some(match)).toBe(false);
  });

  it('names the field and the address that goes nowhere; other sites and anchors on real pages are fine', () => {
    const real = siteFiles();
    expect(
      siteLinkProblems(
        edit((s) => (s.nav[2].href = '/blgo/')),
        real,
      ),
    ).toEqual(['nav.2 ("Blog"): /blgo/ is not a page or file of this site']);
    expect(
      siteLinkProblems(
        edit((s) => s.footer.links.push({ label: 'Elsewhere', href: '/about-me/', icon: 'link' })),
        real,
      ),
    ).toEqual(['footer.links.2 ("Elsewhere"): /about-me/ is not a page or file of this site']);
    expect(
      siteLinkProblems(
        edit((s) => (s.defaultOgImage = '/missing.png')),
        real,
      ),
    ).toEqual(['defaultOgImage: /missing.png is not a page or file of this site']);
    expect(
      siteLinkProblems(
        edit((s) => (s.nav[2].href = 'https://example.org/blog/')),
        real,
      ),
    ).toEqual([]);
    expect(
      siteLinkProblems(
        edit((s) => (s.nav[2].href = '/about/#me')),
        real,
      ),
    ).toEqual([]);
  });
});
