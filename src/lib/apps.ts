// The apps hub (/apps/): which projects are on it, in what order, of which type, and where each card's button goes. Pure, so it
// runs under Vitest. An app is a `projects` entry with a `playUrl` (docs/CONTENT_MODEL.md); there is no collection of its own.
// Its type (a game, an app) is the `appType` field, defined in src/lib/app-types.ts.
import { APP_TYPES, APP_TYPE_IDS, appTypeOf, type AppType } from './app-types';
import { filterPublished, postUrl, type Post, type PublishOptions } from './content';
import { isPlayable, playsOnSite, type PlayFields } from './play';
import { breadcrumbLd, collectionPageLd, itemListLd, type JsonLd, type SiteInfo } from './seo';

export const APPS_PATH = '/apps/';

/** The hub's name: the eyebrow over its heading, and its name in structured data. Its words (heading, lead, description, empty
 *  state, the "more apps coming" card) are src/content/pages/apps.md, edited in /admin. */
export const APPS_LABEL = 'Apps';

type AppPost = Post & { data: Post['data'] & PlayFields & { order?: number; appType?: string } };

/** On the hub: a project with a play address. Entries of other kinds never are, whatever fields they carry. */
export function isApp(post: Post): boolean {
  return post.collection === 'projects' && isPlayable((post as AppPost).data);
}

/** The type of an app on the hub: its `appType`, or `app` when it has none. */
export const typeOf = (post: Pick<Post, 'data'>): AppType => appTypeOf((post as AppPost).data);

/** `order` ascending (lower first); apps without one follow, newest first; ties by id so the order is stable between builds. */
export function sortApps<P extends Post>(apps: P[]): P[] {
  const orderOf = (p: P) => (p as AppPost).data.order ?? Number.POSITIVE_INFINITY;
  return [...apps].sort((a, b) => {
    const byOrder = orderOf(a) === orderOf(b) ? 0 : orderOf(a) < orderOf(b) ? -1 : 1;
    return byOrder || b.data.date.getTime() - a.data.date.getTime() || a.id.localeCompare(b.id);
  });
}

/**
 * Every published app, in hub order. Publishing goes through the one helper in content.ts (drafts and future-dated posts
 * are dropped), so a draft never reaches the hub, the home row or the sitemap.
 */
export function selectApps<P extends Post>(posts: P[], options?: PublishOptions): P[] {
  return sortApps(filterPublished(posts, options).filter(isApp));
}

/** The types the type filter offers: those with at least one app in `apps`, in the order of APP_TYPES. The hub draws the filter
 *  only when this holds two or more. */
export function typesPresent(apps: Pick<Post, 'data'>[]): AppType[] {
  const present = new Set(apps.map(typeOf));
  return APP_TYPE_IDS.filter((t) => present.has(t));
}

export interface PlayLink {
  href: string;
  /** Opens the app's own address in a new tab (link mode), rather than the project page where it is embedded. */
  external: boolean;
}

/**
 * Embedded apps run on their project page (`#play` is the Play section); link-mode apps go straight to their address, in a
 * new tab, or in the same tab when it is a page of this site (`/ascent/`).
 */
export function playLink(app: Pick<Post, 'collection' | 'id'> & { data: PlayFields }): PlayLink {
  if (app.data.playMode === 'link' && app.data.playUrl) {
    return { href: app.data.playUrl, external: !playsOnSite(app.data.playUrl) };
  }
  return { href: `${postUrl(app)}#play`, external: false };
}

/** The word on a card's primary button: Play for a game, Open for an app (APP_TYPES). */
export const actionOf = (type: AppType): string => APP_TYPES[type].action;

/** The structured data of the hub: the page, the apps in the order shown (an ItemList, only when there are any) and the breadcrumb.
 *  `description` is the page's (src/content/pages/apps.md). */
export function appsPageLd(
  site: SiteInfo,
  apps: Pick<Post, 'collection' | 'id' | 'data'>[],
  description: string,
): JsonLd[] {
  return [
    collectionPageLd(site, { path: APPS_PATH, name: APPS_LABEL, description }),
    ...(apps.length
      ? [
          itemListLd(site, {
            name: APPS_LABEL,
            items: apps.map((a) => ({ name: a.data.title, path: postUrl(a) })),
          }),
        ]
      : []),
    breadcrumbLd(site, [{ name: APPS_LABEL, path: APPS_PATH }]),
  ];
}
