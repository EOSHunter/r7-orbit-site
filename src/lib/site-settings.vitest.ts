import { describe, expect, it } from 'vitest';
import data from '../data/site.json';
import { siteFiles } from './site-routes';
import {
  footerLinks,
  isCurrent,
  parseSite,
  routePatterns,
  searchKinds,
  siteLinkProblems,
  siteSchema,
  type SiteSettings,
} from './site-settings';

const site = parseSite(data);
/** A copy of the real settings with some fields changed. */
const edit = (change: (s: SiteSettings) => void): SiteSettings => {
  const copy = structuredClone(site);
  change(copy);
  return copy;
};
const problems = (value: unknown) => {
  const result = siteSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};
const renamed = site.nav.map((item) => ({ ...item, label: `Renamed ${item.label}` }));

describe('the settings file as it is', () => {
  it('reads without a problem, and every link and picture in it exists', () => {
    expect(problems(data)).toEqual([]);
    expect(siteLinkProblems(site, siteFiles())).toEqual([]);
  });

  it('keeps the nav it had: the same labels, addresses and order', () => {
    expect(site.nav.map((i) => [i.label, i.href])).toEqual([
      ['Latest', '/#latest'],
      ['News', '/news/'],
      ['Blog', '/blog/'],
      ['Vlogs', '/vlogs/'],
      ['Projects', '/projects/'],
      ['Games', '/games/'],
      ['Repos', '/repos/'],
      ['About', '/about/'],
    ]);
  });

  it('keeps the footer: Games, GitHub, YouTube (an empty profile link leaves its icon out)', () => {
    expect(footerLinks(site)).toEqual([
      { label: 'Games', href: '/games/', icon: 'play', external: false },
      { label: 'GitHub', href: 'https://github.com/EOSHunter', icon: 'github', external: true },
      { label: 'YouTube', href: 'https://www.youtube.com/@R7Creatives', icon: 'vlog', external: true },
    ]);
    const withoutGithub = edit((s) => (s.links.github = ''));
    expect(footerLinks(withoutGithub).map((l) => l.label)).toEqual(['Games', 'YouTube']);
  });

  it('has only GitHub and YouTube as profile links, and no email', () => {
    expect(Object.keys(site.links)).toEqual(['github', 'youtube']);
    expect(Object.keys(site.author)).toEqual(['name', 'bio', 'photo']);
    expect(problems({ ...data, links: { ...data.links, x: '' } }).join()).toMatch(/links/);
    expect(problems({ ...data, author: { ...data.author, email: 'me@example.org' } }).join()).toMatch(/author/);
  });
});

describe('a renamed nav label', () => {
  it('still marks its section as current: pages name the section by address', () => {
    const blog = renamed.find((i) => i.href === '/blog/')!;
    expect(blog.label).toBe('Renamed Blog');
    expect(isCurrent(blog, '/blog/')).toBe(true);
    expect(renamed.filter((i) => isCurrent(i, '/blog/'))).toHaveLength(1);
    // The old way (a label) no longer matches anything, renamed or not.
    expect(site.nav.some((i) => isCurrent(i, 'Blog'))).toBe(false);
    expect(site.nav.some((i) => isCurrent(i, undefined))).toBe(false);
  });

  it('keeps the search page chips (found by address, labelled as the nav labels them)', () => {
    expect(searchKinds(site.nav).map((i) => i.label)).toEqual(['News', 'Blog', 'Vlogs', 'Projects', 'Repos']);
    expect(searchKinds(renamed).map((i) => [i.label, i.href])).toEqual([
      ['Renamed News', '/news/'],
      ['Renamed Blog', '/blog/'],
      ['Renamed Vlogs', '/vlogs/'],
      ['Renamed Projects', '/projects/'],
      ['Renamed Repos', '/repos/'],
    ]);
  });

  it('keeps the footer links, with the new label', () => {
    expect(footerLinks({ ...site, nav: renamed })[0]).toEqual({
      label: 'Renamed Games',
      href: '/games/',
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
      'nav.5.icon: "Games" is shown in the footer, so it needs an icon',
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
