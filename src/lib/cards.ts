/** What a card needs. Phase 3 maps content-collection entries onto these shapes. */
export type Kind = 'news' | 'blog' | 'vlog' | 'project' | 'repo';

export interface Cover {
  src: string;
  alt: string;
  width: number;
  height: number;
}

interface CardBase {
  href: string;
  title: string;
  summary: string;
  date: Date | string;
  /** Tag slugs, used for filtering. */
  tags?: string[];
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
  /** The project has a game to play in the browser (playUrl): the card shows a Playable badge. */
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
