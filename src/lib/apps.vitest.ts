import { describe, expect, it, vi } from 'vitest';
import { navItems } from '../data/nav';
import site from '../data/site.json';
import type { CollectionName, Post, PostData } from './content';
import { toAppCard } from './app-cards';
import { APP_TYPES, APP_TYPE_IDS, appTypeOf } from './app-types';
import { APPS_PATH, actionOf, appsPageLd, isApp, playLink, selectApps, sortApps, typeOf, typesPresent } from './apps';
import { itemListLd } from './seo';
import { collectSitemapEntries } from './sitemap';

const NOW = new Date('2026-10-05T12:00:00Z');
const PLAY = 'https://play.example.test/';

function project(
  id: string,
  date: string,
  extra: Record<string, unknown> = {},
  collection: CollectionName = 'projects',
): Post {
  const data = {
    title: id,
    summary: `About ${id}.`,
    date: new Date(date),
    tags: [],
    featured: false,
    draft: false,
    playUrl: `${PLAY}${id}/`,
    ...extra,
  } as unknown as PostData;
  return { collection, id, data };
}

const ids = (posts: Post[]) => posts.map((p) => p.id);

describe('which projects are on the hub', () => {
  it('is a project with a play address, and nothing else', () => {
    expect(isApp(project('a', '2026-01-01'))).toBe(true);
    expect(isApp(project('a', '2026-01-01', { playUrl: undefined }))).toBe(false);
    expect(isApp(project('a', '2026-01-01', { playUrl: '' }))).toBe(false);
    // A blog post that carries the field is still not an app: there is no collection of its own, only projects.
    expect(isApp(project('a', '2026-01-01', {}, 'blog'))).toBe(false);
  });
});

describe('types', () => {
  it('are defined once, game then app, each with a label, a plural, an icon, a button word and structured data', () => {
    expect(APP_TYPE_IDS).toEqual(['game', 'app']);
    expect(APP_TYPES.game).toMatchObject({ label: 'Game', plural: 'Games', icon: 'play', action: 'Play', category: 'Game' });
    expect(APP_TYPES.app).toMatchObject({ label: 'App', plural: 'Apps', action: 'Open', category: 'WebApplication' });
    expect(APP_TYPES.game.ld).toEqual(['VideoGame', 'SoftwareApplication']);
    expect(APP_TYPES.app.ld).toEqual(['SoftwareApplication']);
  });

  it('are read from appType, and a playable project without one is an app', () => {
    expect(typeOf(project('a', '2026-01-01', { appType: 'game' }))).toBe('game');
    expect(typeOf(project('a', '2026-01-01', { appType: 'app' }))).toBe('app');
    expect(typeOf(project('a', '2026-01-01'))).toBe('app');
    expect(appTypeOf({ appType: 'nonsense' })).toBe('app');
  });

  it('gives the button its word: Play for a game, Open for an app', () => {
    expect(actionOf('game')).toBe('Play');
    expect(actionOf('app')).toBe('Open');
  });

  it('lists the types present, in the order of APP_TYPES, for the filter', () => {
    const game = project('g', '2026-01-01', { appType: 'game' });
    const app = project('a', '2026-01-01');
    expect(typesPresent([app, game, app])).toEqual(['game', 'app']);
    expect(typesPresent([game, game])).toEqual(['game']);
    expect(typesPresent([])).toEqual([]);
  });
});

describe('ordering', () => {
  it('puts a lower `order` first, then apps without one, newest first', () => {
    const apps = [
      project('old', '2026-01-01'),
      project('new', '2026-09-01'),
      project('third', '2026-02-01', { order: 3 }),
      project('first', '2026-03-01', { order: 1 }),
      project('second', '2025-12-01', { order: 2 }),
    ];
    expect(ids(sortApps(apps))).toEqual(['first', 'second', 'third', 'new', 'old']);
  });

  it('treats 0 and negative numbers as real positions, and keeps an equal order stable by date then id', () => {
    const apps = [
      project('b', '2026-01-01', { order: 1 }),
      project('a', '2026-01-01', { order: 1 }),
      project('later', '2026-05-01', { order: 1 }),
      project('zero', '2025-01-01', { order: 0 }),
      project('minus', '2025-01-01', { order: -2 }),
    ];
    expect(ids(sortApps(apps))).toEqual(['minus', 'zero', 'later', 'a', 'b']);
  });

  it('does not change the list it is given', () => {
    const apps = [project('b', '2026-01-01'), project('a', '2026-02-01')];
    sortApps(apps);
    expect(ids(apps)).toEqual(['b', 'a']);
  });
});

describe('selectApps', () => {
  const pool = [
    project('live', '2026-09-01'),
    project('draft', '2026-09-02', { draft: true, order: 0 }),
    project('scheduled', '2026-10-06', { order: 0 }),
    project('today', '2026-10-05'),
    project('tool', '2026-09-03', { playUrl: undefined, order: 0 }),
    project('post', '2026-09-04', {}, 'blog'),
  ];

  it('drops drafts, future-dated apps and projects that are not apps, through the shared publishing rules', () => {
    expect(ids(selectApps(pool, { now: NOW }))).toEqual(['today', 'live']);
  });

  it('shows the unpublished ones only when asked (the dev server)', () => {
    expect(ids(selectApps(pool, { now: NOW, includeUnpublished: true }))).toEqual([
      'scheduled',
      'draft',
      'today',
      'live',
    ]);
  });

  it('gives an empty list when nothing is an app', () => {
    expect(selectApps([project('tool', '2026-01-01', { playUrl: undefined })], { now: NOW })).toEqual([]);
    expect(selectApps([], { now: NOW })).toEqual([]);
  });
});

describe('the primary link', () => {
  it('goes to the Play section of the project page for an embedded app, the default', () => {
    const a = project('vesper-drift', '2026-01-01');
    expect(playLink(a as never)).toEqual({ href: '/projects/vesper-drift/#play', external: false });
    expect(playLink({ ...a, data: { ...a.data, playMode: 'embed' } } as never)).toEqual({
      href: '/projects/vesper-drift/#play',
      external: false,
    });
  });

  it('goes straight to the app, in a new tab, in link mode', () => {
    const a = project('vesper-drift', '2026-01-01', { playMode: 'link' });
    expect(playLink(a as never)).toEqual({ href: `${PLAY}vesper-drift/`, external: true });
  });
});

describe('an app as a card', () => {
  it('carries the project page, the primary link, the type, the summary, platforms and cover', () => {
    const card = toAppCard(
      project('vesper-drift', '2026-01-01', {
        appType: 'game',
        cover: '/media/vesper.jpg',
        coverAlt: 'The ship',
        platforms: ['desktop', 'mobile'],
      }),
    );
    expect(card).toMatchObject({
      href: '/projects/vesper-drift/',
      play: { href: '/projects/vesper-drift/#play', external: false },
      type: 'game',
      title: 'vesper-drift',
      summary: 'About vesper-drift.',
      platforms: ['desktop', 'mobile'],
      cover: { src: '/media/vesper.jpg', alt: 'The ship' },
    });
    expect(card.preview).toBeUndefined();
  });

  it('has no cover when there is none (the card then draws the placeholder), no platforms by default, and is an app without appType', () => {
    const card = toAppCard(project('a', '2026-01-01'));
    expect(card.cover).toBeUndefined();
    expect(card.platforms).toEqual([]);
    expect(card.type).toBe('app');
  });

  it('labels a draft for the dev preview', () => {
    expect(toAppCard(project('a', '2026-01-01', { draft: true })).preview).toBe('Draft');
  });
});

describe('structured data', () => {
  const apps = [project('one', '2026-01-01'), project('two', '2026-02-01')];
  const info = { ...site, author: { name: site.author.name, photo: site.author.photo }, links: site.links };

  it('builds an ItemList with positions, in the order given', () => {
    const ld = itemListLd(info, {
      name: 'Apps',
      items: [
        { name: 'One', path: '/projects/one/' },
        { name: '*Two*', path: '/projects/two/' },
      ],
    }) as {
      '@type': string;
      numberOfItems: number;
      itemListElement: { position: number; name: string; url: string }[];
    };
    expect(ld['@type']).toBe('ItemList');
    expect(ld.numberOfItems).toBe(2);
    expect(ld.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'One', url: `${site.url}/projects/one/` },
      { '@type': 'ListItem', position: 2, name: 'Two', url: `${site.url}/projects/two/` },
    ]);
  });

  it('puts the page, the list and the breadcrumb on the hub, and no list when there are no apps', () => {
    const types = (list: object[]) => list.map((n) => (n as { '@type': string })['@type']);
    expect(types(appsPageLd(info, apps, 'The hub.'))).toEqual(['CollectionPage', 'ItemList', 'BreadcrumbList']);
    expect(types(appsPageLd(info, [], 'The hub.'))).toEqual(['CollectionPage', 'BreadcrumbList']);
    expect(appsPageLd(info, apps, 'The hub.')[0]).toMatchObject({ name: 'Apps', url: `${site.url}/apps/` });
    // The page's own description (src/content/pages/apps.md), not a copy in code.
    expect((appsPageLd(info, [], 'The hub.')[0] as { description: string }).description).toBe('The hub.');
  });
});

describe('the sitemap', () => {
  const posts = [
    project('one', '2026-01-01', { updated: new Date('2026-03-01') }),
    project('tool', '2026-02-01', { playUrl: undefined }),
  ];
  const paths = (list: Post[], statics = ['/', '/about/', APPS_PATH]) =>
    collectSitemapEntries(statics, list).map((e) => e.path);

  it('lists /apps/ once an app is published, even though the page is among the static pages', () => {
    expect(paths(posts)).toContain('/apps/');
    expect(paths(posts)).not.toContain('/games/');
    expect(collectSitemapEntries(['/', APPS_PATH], posts).find((e) => e.path === '/apps/')?.lastmod).toEqual(
      new Date('2026-03-01'),
    );
  });

  it('leaves /apps/ out while there are no apps (the page is noindex then)', () => {
    expect(paths([posts[1]])).not.toContain('/apps/');
    expect(paths([])).not.toContain('/apps/');
  });
});

describe('navigation', () => {
  it('has Apps after Projects in the header nav, linking to /apps/, and no Games item', () => {
    const labels = navItems.map((i) => i.label);
    expect(labels.indexOf('Apps')).toBe(labels.indexOf('Projects') + 1);
    expect(navItems.find((i) => i.label === 'Apps')?.href).toBe('/apps/');
    expect(navItems.some((i) => i.href === '/games/')).toBe(false);
  });
});

// The projects schema, read the way src/lib/play.vitest.ts does.
vi.mock('astro:content', async () => {
  const { z } = await import('astro/zod');
  return {
    defineCollection: (c: unknown) => c,
    reference: (collection: string) => z.string().transform((id) => ({ collection, id })),
  };
});
vi.mock('astro/loaders', () => ({ glob: () => ({}) }));

describe('the `order` field', () => {
  async function parse(extra: Record<string, unknown>) {
    const { z } = await import('astro/zod');
    const { collections } = await import('../content.config');
    const { schema } = collections.projects as unknown as {
      schema: (ctx: { image: () => unknown }) => import('astro/zod').z.ZodType;
    };
    const base = {
      title: 'An app',
      date: '2026-10-01',
      summary: 'One line.',
      status: 'shipped',
      playUrl: 'https://play.example.test/a/',
    };
    return schema({ image: () => z.string() }).safeParse({ ...base, ...extra });
  }

  it('is optional, and a number', async () => {
    expect((await parse({})).success).toBe(true);
    expect((await parse({ order: 1 })).success).toBe(true);
    expect((await parse({ order: 0 })).success).toBe(true);
    expect((await parse({ order: 'first' })).success).toBe(false);
  });

  it('needs playUrl: it only matters on the Apps page', async () => {
    const result = await parse({ playUrl: undefined, order: 1 });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('order needs playUrl');
    expect((await parse({ playUrl: undefined })).success).toBe(true);
  });
});

describe('the `appType` field', () => {
  async function parse(extra: Record<string, unknown>) {
    const { z } = await import('astro/zod');
    const { collections } = await import('../content.config');
    const { schema } = collections.projects as unknown as {
      schema: (ctx: { image: () => unknown }) => import('astro/zod').z.ZodType;
    };
    const base = { title: 'An app', date: '2026-10-01', summary: 'One line.', status: 'shipped', playUrl: 'https://play.example.test/a/' };
    return schema({ image: () => z.string() }).safeParse({ ...base, ...extra });
  }

  it('is optional, and one of APP_TYPES', async () => {
    expect((await parse({})).success).toBe(true);
    for (const appType of APP_TYPE_IDS) expect((await parse({ appType })).success, appType).toBe(true);
    const bad = await parse({ appType: 'tool' });
    expect(bad.success).toBe(false);
    expect(JSON.stringify(bad.error?.issues)).toContain(`use one of: ${APP_TYPE_IDS.join(', ')}`);
  });

  it('needs playUrl: a project that does not run in the browser has no type', async () => {
    const result = await parse({ playUrl: undefined, appType: 'game' });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('appType needs playUrl');
  });
});
