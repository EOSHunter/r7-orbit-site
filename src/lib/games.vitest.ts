import { describe, expect, it, vi } from 'vitest';
import { navItems } from '../data/nav';
import site from '../data/site.json';
import type { CollectionName, Post, PostData } from './content';
import { toGameCard } from './game-cards';
import { GAMES_PATH, gamesPageLd, isGame, playLink, selectGames, sortGames } from './games';
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

describe('which projects are games', () => {
  it('is a project with a play address, and nothing else', () => {
    expect(isGame(project('a', '2026-01-01'))).toBe(true);
    expect(isGame(project('a', '2026-01-01', { playUrl: undefined }))).toBe(false);
    expect(isGame(project('a', '2026-01-01', { playUrl: '' }))).toBe(false);
    // A blog post that carries the field is still not a game: there is no collection of its own, only projects.
    expect(isGame(project('a', '2026-01-01', {}, 'blog'))).toBe(false);
  });
});

describe('ordering', () => {
  it('puts a lower `order` first, then games without one, newest first', () => {
    const games = [
      project('old', '2026-01-01'),
      project('new', '2026-09-01'),
      project('third', '2026-02-01', { order: 3 }),
      project('first', '2026-03-01', { order: 1 }),
      project('second', '2025-12-01', { order: 2 }),
    ];
    expect(ids(sortGames(games))).toEqual(['first', 'second', 'third', 'new', 'old']);
  });

  it('treats 0 and negative numbers as real positions, and keeps an equal order stable by date then id', () => {
    const games = [
      project('b', '2026-01-01', { order: 1 }),
      project('a', '2026-01-01', { order: 1 }),
      project('later', '2026-05-01', { order: 1 }),
      project('zero', '2025-01-01', { order: 0 }),
      project('minus', '2025-01-01', { order: -2 }),
    ];
    expect(ids(sortGames(games))).toEqual(['minus', 'zero', 'later', 'a', 'b']);
  });

  it('does not change the list it is given', () => {
    const games = [project('b', '2026-01-01'), project('a', '2026-02-01')];
    sortGames(games);
    expect(ids(games)).toEqual(['b', 'a']);
  });
});

describe('selectGames', () => {
  const pool = [
    project('live', '2026-09-01'),
    project('draft', '2026-09-02', { draft: true, order: 0 }),
    project('scheduled', '2026-10-06', { order: 0 }),
    project('today', '2026-10-05'),
    project('tool', '2026-09-03', { playUrl: undefined, order: 0 }),
    project('post', '2026-09-04', {}, 'blog'),
  ];

  it('drops drafts, future-dated games and projects that are not games, through the shared publishing rules', () => {
    expect(ids(selectGames(pool, { now: NOW }))).toEqual(['today', 'live']);
  });

  it('shows the unpublished ones only when asked (the dev server)', () => {
    expect(ids(selectGames(pool, { now: NOW, includeUnpublished: true }))).toEqual([
      'scheduled',
      'draft',
      'today',
      'live',
    ]);
  });

  it('gives an empty list when nothing is a game', () => {
    expect(selectGames([project('tool', '2026-01-01', { playUrl: undefined })], { now: NOW })).toEqual([]);
    expect(selectGames([], { now: NOW })).toEqual([]);
  });
});

describe('the Play link', () => {
  it('goes to the Play section of the project page for an embedded game, the default', () => {
    const a = project('vesper-drift', '2026-01-01');
    expect(playLink(a as never)).toEqual({ href: '/projects/vesper-drift/#play', external: false });
    expect(playLink({ ...a, data: { ...a.data, playMode: 'embed' } } as never)).toEqual({
      href: '/projects/vesper-drift/#play',
      external: false,
    });
  });

  it('goes straight to the game, in a new tab, in link mode', () => {
    const a = project('vesper-drift', '2026-01-01', { playMode: 'link' });
    expect(playLink(a as never)).toEqual({ href: `${PLAY}vesper-drift/`, external: true });
  });
});

describe('a game as a card', () => {
  it('carries the project page, the Play link, the summary, platforms and cover', () => {
    const card = toGameCard(
      project('vesper-drift', '2026-01-01', {
        cover: '/media/vesper.jpg',
        coverAlt: 'The ship',
        platforms: ['desktop', 'mobile'],
      }),
    );
    expect(card).toMatchObject({
      href: '/projects/vesper-drift/',
      play: { href: '/projects/vesper-drift/#play', external: false },
      title: 'vesper-drift',
      summary: 'About vesper-drift.',
      platforms: ['desktop', 'mobile'],
      cover: { src: '/media/vesper.jpg', alt: 'The ship' },
    });
    expect(card.preview).toBeUndefined();
  });

  it('has no cover when there is none (the card then draws the placeholder) and no platforms by default', () => {
    const card = toGameCard(project('a', '2026-01-01'));
    expect(card.cover).toBeUndefined();
    expect(card.platforms).toEqual([]);
  });

  it('labels a draft for the dev preview', () => {
    expect(toGameCard(project('a', '2026-01-01', { draft: true })).preview).toBe('Draft');
  });
});

describe('structured data', () => {
  const games = [project('one', '2026-01-01'), project('two', '2026-02-01')];
  const info = { ...site, author: { name: site.author.name, photo: site.author.photo }, links: site.links };

  it('builds an ItemList with positions, in the order given', () => {
    const ld = itemListLd(info, {
      name: 'Games',
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

  it('puts the page, the list and the breadcrumb on the hub, and no list when there are no games', () => {
    const types = (list: object[]) => list.map((n) => (n as { '@type': string })['@type']);
    expect(types(gamesPageLd(info, games))).toEqual(['CollectionPage', 'ItemList', 'BreadcrumbList']);
    expect(types(gamesPageLd(info, []))).toEqual(['CollectionPage', 'BreadcrumbList']);
  });
});

describe('the sitemap', () => {
  const posts = [
    project('one', '2026-01-01', { updated: new Date('2026-03-01') }),
    project('tool', '2026-02-01', { playUrl: undefined }),
  ];
  const paths = (list: Post[], statics = ['/', '/about/', GAMES_PATH]) =>
    collectSitemapEntries(statics, list).map((e) => e.path);

  it('lists /games/ once a game is published, even though the page is among the static pages', () => {
    expect(paths(posts)).toContain('/games/');
    expect(collectSitemapEntries(['/', GAMES_PATH], posts).find((e) => e.path === '/games/')?.lastmod).toEqual(
      new Date('2026-03-01'),
    );
  });

  it('leaves /games/ out while there are no games (the page is noindex then)', () => {
    expect(paths([posts[1]])).not.toContain('/games/');
    expect(paths([])).not.toContain('/games/');
  });
});

describe('navigation', () => {
  it('has Games after Projects in the header nav, linking to /games/', () => {
    const labels = navItems.map((i) => i.label);
    expect(labels.indexOf('Games')).toBe(labels.indexOf('Projects') + 1);
    expect(navItems.find((i) => i.label === 'Games')?.href).toBe('/games/');
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
      title: 'A game',
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

  it('needs playUrl: it only matters on a game', async () => {
    const result = await parse({ playUrl: undefined, order: 1 });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('order needs playUrl');
    expect((await parse({ playUrl: undefined })).success).toBe(true);
  });
});
