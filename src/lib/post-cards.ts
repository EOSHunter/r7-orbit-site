// Maps published posts onto the shapes the cards take. Listing pages (home, archives, tags) use this.
import type { ImageMetadata } from 'astro';
import type { NewsTopic } from './news-signal';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CardData, Cover, CoverMotion, ProjectStatus } from './cards';
import { loadGitHubRepo } from './github';
import { authorSlugOf } from './authors';
import { postUrl, previewLabel, readTime } from './content';
import type { SitePost } from './content-queries';
import { isPlayable } from './play';

/** Cover images are 16:9 by the content rules (docs/CONTENT_MODEL.md); the card crops to that anyway. */
export function coverOf(data: { cover?: string; coverAlt?: string }): Cover | undefined {
  if (!data.cover) return undefined;
  return { src: data.cover, alt: data.coverAlt ?? '', width: 1280, height: 720 };
}

/** A blog post's card shows its featured image, cropped to the card's 16:9 at build time (a blog post has no separate cover). */
export async function featuredCover(data: unknown): Promise<Cover | undefined> {
  const { featuredImage, featuredImageAlt } = data as { featuredImage?: ImageMetadata; featuredImageAlt?: string };
  if (!featuredImage) return undefined;
  // Loaded here, not at the top: astro:assets exists only in Astro's build, and the unit tests import this file without it.
  const { getImage } = await import('astro:assets');
  // The same widths as a cover's copies (VARIANT_WIDTHS), so a phone downloads the 480 copy, not the 1280 one.
  const image = await getImage({ src: featuredImage, width: 1280, height: 720, widths: [480, 720, 960, 1280], fit: 'cover', format: 'webp' });
  return { src: image.src, alt: featuredImageAlt ?? '', width: 1280, height: 720, srcset: image.srcSet.attribute || undefined };
}

// content.config.ts builds each schema from a loosely typed `extra` shape, so the kind-specific fields are not in the inferred
// types. These are the fields read here; the schema itself guarantees them.
interface VlogFields {
  duration: string;
  poster?: string;
  cover?: string;
  coverAlt?: string;
}
interface ProjectFields {
  status: ProjectStatus;
  stack: string[];
  playUrl?: string;
}
interface RepoFields {
  repo: string;
}

interface RepoStats {
  language?: string;
  stars?: number;
  forks?: number;
  updated?: string;
}

const repoStats = new Map<string, Promise<RepoStats>>();

/** Stats from the build-time GitHub loader. Offline or unknown repos give no stats; the card then shows only its date. */
function statsFor(repo: string): Promise<RepoStats> {
  let stats = repoStats.get(repo);
  if (!stats) {
    stats = loadGitHubRepo(repo).then((result) =>
      result.status === 'ok'
        ? {
            language: result.stats.language ?? undefined,
            stars: result.stats.stars,
            forks: result.stats.forks,
            updated: result.stats.pushedAt ?? undefined,
          }
        : {},
    );
    repoStats.set(repo, stats);
  }
  return stats;
}

export interface CardOptions {
  /** Adds the data-* attributes the archive script filters on. */
  filterable?: boolean;
  fresh?: boolean;
  pinned?: boolean;
}

/** The hover clip named by `coverMotion`, with its WebM twin when that file exists. The build stops, naming the post, when the
 *  MP4 is not in public/. `root` is the repository (tests pass a temporary folder). */
export function motionOf(path: string | undefined, where: string, root = process.cwd()): CoverMotion | undefined {
  if (!path) return undefined;
  if (!existsSync(join(root, 'public', path))) {
    throw new Error(`${where}: coverMotion ${path} is not in public/ (put the clip at public${path}, or remove the field)`);
  }
  const webm = path.replace(/\.mp4$/, '.webm');
  return { mp4: path, ...(existsSync(join(root, 'public', webm)) ? { webm } : {}) };
}

export async function toCard(post: SitePost, options: CardOptions = {}): Promise<CardData> {
  const card = await cardOf(post, options);
  const where = `src/content/${post.collection}/${post.id}`;
  const motion = motionOf((post.data as { coverMotion?: string }).coverMotion, where);
  if (!motion) return card;
  const cover = 'cover' in card ? card.cover : undefined;
  if (!cover) throw new Error(`${where}: coverMotion needs a still to show before and after the clip (a featured image or a cover)`);
  return { ...card, cover: { ...cover, motion } } as CardData;
}

async function cardOf(post: SitePost, options: CardOptions): Promise<CardData> {
  const { data } = post;
  const base = {
    href: postUrl(post),
    title: data.title,
    summary: (data as { summary?: string }).summary ?? '',
    date: data.date,
    tags: data.tags,
    author: authorSlugOf(post),
    preview: previewLabel(post),
    ...options,
  };
  const cover = coverOf(data as { cover?: string; coverAlt?: string });
  switch (post.collection) {
    case 'news':
      return { ...base, kind: 'news', readTime: readTime(post), cover, topic: (data as { topic?: NewsTopic }).topic, symbol: (data as { symbol?: string }).symbol };
    case 'blog':
      return { ...base, kind: 'blog', readTime: readTime(post), cover: (await featuredCover(data)) ?? cover };
    case 'vlogs': {
      const vlog = { data: data as unknown as VlogFields };
      return {
        ...base,
        kind: 'vlog',
        duration: vlog.data.duration,
        // The card shows the cover (the post's picture, which may have a hover clip); the poster is the player's thumbnail.
        cover: coverOf({ cover: vlog.data.cover ?? vlog.data.poster, coverAlt: vlog.data.coverAlt }),
      };
    }
    case 'projects': {
      const project = { data: data as unknown as ProjectFields };
      return { ...base, kind: 'project', status: project.data.status, stack: project.data.stack, playable: isPlayable(project.data), cover };
    }
    case 'repos': {
      const repo = (data as unknown as RepoFields).repo;
      return { ...base, kind: 'repo', repo, ...(await statsFor(repo)) };
    }
  }
}

export function toCards(posts: SitePost[], options: CardOptions = {}): Promise<CardData[]> {
  return Promise.all(posts.map((post) => toCard(post, options)));
}
