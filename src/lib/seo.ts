// SEO helpers, pure (no Astro imports) so they run under Vitest: canonical and Open Graph fallbacks, and JSON-LD builders.
// Every builder omits empty fields, so a placeholder (an empty profile URL, no photo) never reaches the page.
import { absoluteUrl, isoDate, plainTitle } from './text';

const DEFAULT_IMAGE = '/og-default.png';
const MAX_DESCRIPTION = 155;
/** The most a browser-tab title may be, site name and separator included (tests/smoke.spec.js, docs/PAGES.md). */
export const MAX_PAGE_TITLE = 60;

/** The longest `seoTitle` that still fits once ` · {site name}` is added. */
export function seoTitleMax(siteName: string): number {
  return MAX_PAGE_TITLE - ' · '.length - siteName.length;
}

/** The title for the tab, search results and og:title: the post's `seoTitle` when it has one, else its title. */
export function headTitleFor(title: string, seoTitle?: string): string {
  return seoTitle?.trim() || title;
}

/** Shortens to `max` characters at a word boundary, with an ellipsis. */
export function truncate(text: string, max = MAX_DESCRIPTION): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

export interface SeoInput {
  /** The page's own path, e.g. `Astro.url.pathname`. Query strings are never part of the canonical. */
  path: string;
  /** Site origin, e.g. `https://example.com`. */
  base: string;
  description?: string;
  fallbackDescription: string;
  /** Path or absolute URL of a 1200x630 image. */
  image?: string;
  imageAlt?: string;
  /** The image a page without its own gets (site.json `defaultOgImage`). Default: /og-default.png. */
  fallbackImage?: string;
  fallbackImageAlt: string;
}

export interface SeoResolved {
  canonical: string;
  description: string;
  imageUrl: string;
  /** Undefined when a page's own image has no alt text: omit the tag rather than describe the wrong picture. */
  imageAlt: string | undefined;
}

/** Canonical URL (absolute, trailing slash) and the Open Graph image with its fallback to the brand image. */
export function resolveSeo(input: SeoInput): SeoResolved {
  const own = input.image?.trim();
  const imageUrl = new URL(own || input.fallbackImage?.trim() || DEFAULT_IMAGE, input.base).href;
  const alt = input.imageAlt?.trim();
  return {
    canonical: absoluteUrl(input.path, input.base),
    description: truncate(input.description?.trim() || input.fallbackDescription),
    imageUrl,
    imageAlt: own ? alt || undefined : alt || input.fallbackImageAlt,
  };
}

// ---- JSON-LD ---------------------------------------------------------------------------------------------------

export type JsonLd = Record<string, unknown>;

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

/** Removes undefined, null, empty strings, empty arrays and empty objects, recursively. `false` and `0` stay. */
export function prune<T>(value: T): T | undefined {
  if (Array.isArray(value)) {
    const items = value.map((v) => prune(v)).filter((v) => !isEmpty(v));
    return (items.length ? items : undefined) as T | undefined;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([k, v]) => [k, prune(v)] as const)
      .filter(([, v]) => !isEmpty(v));
    return (entries.length ? Object.fromEntries(entries) : undefined) as T | undefined;
  }
  return isEmpty(value) ? undefined : value;
}

/** JSON for a `<script type="application/ld+json">`. `<` is escaped so no value can close the tag. */
export function jsonLdString(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(prune(data) ?? {}).replace(/</g, '\\u003c');
}

const isHttpUrl = (value: string | undefined): value is string => !!value && /^https?:\/\/\S+$/i.test(value.trim());

export interface SiteInfo {
  name: string;
  url: string;
  description?: string;
  /** The share image for anything without its own (site.json). Default: /og-default.png. */
  defaultOgImage?: string;
  author: { name: string; photo?: string | null };
  links: Record<string, string | undefined>;
}

/** Profile URLs for `sameAs`: only http(s) links that are filled in. */
export function profileUrls(links: SiteInfo['links']): string[] {
  return Object.entries(links)
    .map(([, url]) => url?.trim())
    .filter(isHttpUrl);
}

export function personLd(site: SiteInfo): JsonLd {
  return {
    '@type': 'Person',
    name: site.author.name,
    url: absoluteUrl('/about/', site.url),
    image: site.author.photo ? new URL(site.author.photo, site.url).href : undefined,
    sameAs: profileUrls(site.links),
  };
}

export function organizationLd(site: SiteInfo): JsonLd {
  return {
    '@type': 'Organization',
    name: site.name,
    url: absoluteUrl('/', site.url),
    logo: new URL('/icon-512.png', site.url).href,
    sameAs: profileUrls(site.links),
  };
}

/** Home page. The `SearchAction` is only emitted when the site has a search page (`search: true`). */
export function websiteLd(site: SiteInfo, { search = false }: { search?: boolean } = {}): JsonLd {
  const root = absoluteUrl('/', site.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    url: root,
    description: site.description,
    publisher: personLd(site),
    potentialAction: search
      ? {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${root}search/?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        }
      : undefined,
  };
}

export interface ArticleInput {
  /** Which schema type: a blog post or a news item. */
  type: 'BlogPosting' | 'NewsArticle';
  /** Page path, e.g. `/blog/some-post/`. */
  path: string;
  title: string;
  summary: string;
  date: Date | string;
  updated?: Date | string;
  /** Path or absolute URL of the cover; the brand image is used when there is none. */
  image?: string;
  tags?: string[];
  /** News only: the story being discussed. */
  sourceUrl?: string;
  /** Set only when the post was first published elsewhere. */
  canonicalUrl?: string;
}

export function articleLd(site: SiteInfo, a: ArticleInput): JsonLd {
  const url = absoluteUrl(a.path, site.url);
  return {
    '@context': 'https://schema.org',
    '@type': a.type,
    headline: plainTitle(a.title),
    description: a.summary,
    datePublished: isoDate(a.date),
    dateModified: isoDate(a.updated ?? a.date),
    author: personLd(site),
    publisher: { '@type': 'Organization', name: site.name, url: absoluteUrl('/', site.url) },
    image: [new URL(a.image || site.defaultOgImage || DEFAULT_IMAGE, site.url).href],
    mainEntityOfPage: { '@type': 'WebPage', '@id': a.canonicalUrl || url },
    keywords: a.tags,
    isBasedOn: a.type === 'NewsArticle' ? a.sourceUrl : undefined,
  };
}

/** `12:48` -> `PT12M48S`, `1:02:03` -> `PT1H2M3S`. Returns undefined for anything else. */
export function isoDuration(duration: string): string | undefined {
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(duration.trim());
  if (!match) return undefined;
  const [, h, m, s] = match;
  return `PT${h ? `${Number(h)}H` : ''}${Number(m)}M${Number(s)}S`;
}

export interface VideoInput {
  path: string;
  title: string;
  summary: string;
  date: Date | string;
  /** `m:ss` or `h:mm:ss`. */
  duration?: string;
  /** Path or absolute URL of the poster or cover. */
  thumbnail?: string;
  youtubeId?: string;
  videoUrl?: string;
}

export function videoObjectLd(site: SiteInfo, v: VideoInput): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: plainTitle(v.title),
    description: v.summary,
    thumbnailUrl: [new URL(v.thumbnail || site.defaultOgImage || DEFAULT_IMAGE, site.url).href],
    uploadDate: isoDate(v.date),
    duration: v.duration ? isoDuration(v.duration) : undefined,
    embedUrl: v.youtubeId ? `https://www.youtube-nocookie.com/embed/${v.youtubeId}` : v.videoUrl,
    url: absoluteUrl(v.path, site.url),
  };
}

export function softwareApplicationLd(
  site: SiteInfo,
  p: { path: string; title: string; summary: string; image?: string; liveUrl?: string; category?: string },
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: plainTitle(p.title),
    description: p.summary,
    applicationCategory: p.category ?? 'DeveloperApplication',
    url: p.liveUrl || absoluteUrl(p.path, site.url),
    image: p.image ? new URL(p.image, site.url).href : undefined,
    author: personLd(site),
  };
}

export function softwareSourceCodeLd(
  site: SiteInfo,
  r: { path: string; title: string; summary: string; repo: string; language?: string; license?: string },
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: plainTitle(r.title),
    description: r.summary,
    codeRepository: `https://github.com/${r.repo}`,
    programmingLanguage: r.language,
    license: r.license,
    url: absoluteUrl(r.path, site.url),
    author: personLd(site),
  };
}

export function collectionPageLd(site: SiteInfo, c: { path: string; name: string; description?: string }): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: plainTitle(c.name),
    description: c.description,
    url: absoluteUrl(c.path, site.url),
    isPartOf: { '@type': 'WebSite', name: site.name, url: absoluteUrl('/', site.url) },
  };
}

export function profilePageLd(site: SiteInfo): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: absoluteUrl('/about/', site.url),
    mainEntity: personLd(site),
  };
}

export interface Crumb {
  name: string;
  /** Path of the page; omit for the current page. */
  path?: string;
}

/** For every page below home. The first crumb is always Home. The last crumb needs no path. */
export function breadcrumbLd(site: SiteInfo, crumbs: Crumb[]): JsonLd {
  const trail: Crumb[] = [{ name: 'Home', path: '/' }, ...crumbs];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: plainTitle(c.name),
      item: c.path ? absoluteUrl(c.path, site.url) : undefined,
    })),
  };
}

export interface ListItemInput {
  name: string;
  /** Path of the item's page. */
  path: string;
}

/** An ordered list of pages (the games on /games/), in the order the page shows them. */
export function itemListLd(site: SiteInfo, c: { name: string; items: ListItemInput[] }): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: plainTitle(c.name),
    numberOfItems: c.items.length,
    itemListElement: c.items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: plainTitle(item.name),
      url: absoluteUrl(item.path, site.url),
    })),
  };
}
