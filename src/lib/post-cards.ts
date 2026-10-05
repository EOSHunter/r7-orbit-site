// Maps published posts onto the shapes the cards take. Listing pages (home, archives, tags) use this.
import type { CardData, Cover, ProjectStatus } from './cards';
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

export async function toCard(post: SitePost, options: CardOptions = {}): Promise<CardData> {
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
      return { ...base, kind: 'news', readTime: readTime(post), cover };
    case 'blog':
      return { ...base, kind: 'blog', readTime: readTime(post), cover };
    case 'vlogs': {
      const vlog = { data: data as unknown as VlogFields };
      return {
        ...base,
        kind: 'vlog',
        duration: vlog.data.duration,
        cover: coverOf({ cover: vlog.data.poster ?? vlog.data.cover, coverAlt: vlog.data.coverAlt }),
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
