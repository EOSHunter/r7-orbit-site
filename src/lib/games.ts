// The games hub (/games/): which projects are games, in what order, and where each Play button goes. Pure, so it runs under
// Vitest. A game is a `projects` entry with a `playUrl` (docs/CONTENT_MODEL.md); there is no collection of its own.
import { filterPublished, postUrl, type Post, type PublishOptions } from './content';
import { isPlayable, type PlayFields } from './play';
import { breadcrumbLd, collectionPageLd, itemListLd, type JsonLd, type SiteInfo } from './seo';

export const GAMES_PATH = '/games/';

/** The hub's name: the nav label, the eyebrow over its heading, and its name in structured data. Its words (heading, lead,
 *  description, empty state, the "more games coming" card) are src/content/pages/games.md, edited in /admin. */
export const GAMES_LABEL = 'Games';

type GamePost = Post & { data: Post['data'] & PlayFields & { order?: number } };

/** A game is a project with a play address. Entries of other kinds never are, whatever fields they carry. */
export function isGame(post: Post): boolean {
  return post.collection === 'projects' && isPlayable((post as GamePost).data);
}

/** `order` ascending (lower first); games without one follow, newest first; ties by id so the order is stable between builds. */
export function sortGames<P extends Post>(games: P[]): P[] {
  const orderOf = (p: P) => (p as GamePost).data.order ?? Number.POSITIVE_INFINITY;
  return [...games].sort((a, b) => {
    const byOrder = orderOf(a) === orderOf(b) ? 0 : orderOf(a) < orderOf(b) ? -1 : 1;
    return byOrder || b.data.date.getTime() - a.data.date.getTime() || a.id.localeCompare(b.id);
  });
}

/**
 * Every published game, in hub order. Publishing goes through the one helper in content.ts (drafts and future-dated posts
 * are dropped), so a draft game never reaches the hub, the home teaser or the sitemap.
 */
export function selectGames<P extends Post>(posts: P[], options?: PublishOptions): P[] {
  return sortGames(filterPublished(posts, options).filter(isGame));
}

export interface PlayLink {
  href: string;
  /** Opens the game's own address in a new tab (link mode), rather than the project page where it is embedded. */
  external: boolean;
}

/** Embedded games play on their project page (`#play` is the Play section); link-mode games go straight to the game. */
export function playLink(game: Pick<Post, 'collection' | 'id'> & { data: PlayFields }): PlayLink {
  if (game.data.playMode === 'link' && game.data.playUrl) return { href: game.data.playUrl, external: true };
  return { href: `${postUrl(game)}#play`, external: false };
}

/** The structured data of the hub: the page, the games in the order shown (an ItemList, only when there are any) and the breadcrumb.
 *  `description` is the page's (src/content/pages/games.md). */
export function gamesPageLd(site: SiteInfo, games: Pick<Post, 'collection' | 'id' | 'data'>[], description: string): JsonLd[] {
  return [
    collectionPageLd(site, { path: GAMES_PATH, name: GAMES_LABEL, description }),
    ...(games.length
      ? [
          itemListLd(site, {
            name: GAMES_LABEL,
            items: games.map((g) => ({ name: g.data.title, path: postUrl(g) })),
          }),
        ]
      : []),
    breadcrumbLd(site, [{ name: GAMES_LABEL, path: GAMES_PATH }]),
  ];
}
