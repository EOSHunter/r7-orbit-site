import type { AppType } from './app-types';
import type { NewsTopic } from './news-signal';

/** What a card needs. Phase 3 maps content-collection entries onto these shapes. */
export type Kind = 'news' | 'blog' | 'vlog' | 'project' | 'repo';

/** A hover clip: played over the still while the card is pointed at or focused (src/scripts/card-motion.js). */
export interface CoverMotion {
  mp4: string;
  /** Same clip as WebM, when the file is there (found by name). */
  webm?: string;
}

export interface Cover {
  src: string;
  alt: string;
  width: number;
  height: number;
  motion?: CoverMotion;
  /** Smaller copies for a phone, when the picture comes with its own (a blog post's featured image, made by Astro). A cover from
   *  public/media finds its copies by name instead (src/lib/media-srcset.ts). */
  srcset?: string;
}

interface CardBase {
  href: string;
  title: string;
  summary: string;
  date: Date | string;
  /** Tag slugs, used for filtering. */
  tags?: string[];
  /** Author slug, used by the "By author" filter. */
  author?: string;
  /** The newest item in a feed: gets the brass rail. */
  fresh?: boolean;
  /** Large horizontal card for the one pinned post. */
  pinned?: boolean;
  /** Adds the data-* attributes site.js filters on (home "Latest" and the archives). */
  filterable?: boolean;
  /** Dev preview only: "Draft" or "Scheduled for <date>". Never set in a production build. */
  preview?: string;
}

export interface NewsCardData extends CardBase {
  kind: 'news';
  readTime?: number;
  cover?: Cover;
  /** The kind of news: without a cover, the card shows this topic's picture (NewsSignal.astro). */
  topic?: NewsTopic;
  /** An object made for this item, shown instead of the topic's. */
  symbol?: string;
}

export interface BlogCardData extends CardBase {
  kind: 'blog';
  readTime?: number;
  cover?: Cover;
}

export interface VlogCardData extends CardBase {
  kind: 'vlog';
  /** `12:48` */
  duration: string;
  /** Poster, copied to the site at build time. */
  cover?: Cover;
}

export type ProjectStatus = 'idea' | 'building' | 'shipped' | 'paused' | 'archived';

export interface ProjectCardData extends CardBase {
  kind: 'project';
  status: ProjectStatus;
  stack?: string[];
  /** The project runs in the browser (playUrl): the card shows a Playable badge. */
  playable?: boolean;
  cover?: Cover;
}

export interface RepoCardData extends CardBase {
  kind: 'repo';
  /** `owner/name` */
  repo: string;
  language?: string;
  stars?: number;
  forks?: number;
  /** Last push, from the GitHub cache. */
  updated?: Date | string;
}

export type CardData = NewsCardData | BlogCardData | VlogCardData | ProjectCardData | RepoCardData;

export const KIND_LABEL: Record<Kind, string> = {
  news: 'News',
  blog: 'Blog',
  vlog: 'Vlog',
  project: 'Project',
  repo: 'Repo',
};

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  idea: 'Idea',
  building: 'Building',
  shipped: 'Shipped',
  paused: 'Paused',
  archived: 'Archived',
};

/** Which status-mark drawing each status uses (docs/CONTENT_MODEL.md). */
export const STATUS_MARK: Record<ProjectStatus, 'working' | 'done' | 'idle'> = {
  idea: 'idle',
  building: 'working',
  shipped: 'done',
  paused: 'idle',
  archived: 'idle',
};

/** What an AppCard needs (the /apps/ hub, the home row and the "More apps" strip). */
export interface AppCardData {
  /** The project page, where the app's details are. */
  href: string;
  /** Where the primary button goes: the project page's Play section, or the app itself in a new tab (`playMode: link`). */
  play: { href: string; external: boolean };
  /** Game or app (src/lib/app-types.ts): the type chip, the button's word and the hub's type filter. */
  type: AppType;
  title: string;
  summary: string;
  cover?: Cover;
  platforms: ('desktop' | 'mobile')[];
  /** Dev preview only: "Draft" or "Scheduled for <date>". Never set in a production build. */
  preview?: string;
}
