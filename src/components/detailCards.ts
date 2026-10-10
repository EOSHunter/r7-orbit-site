// Shared by the project and repo pages: collection entries -> card props, repo slug lookup, local-image check.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CardData, ProjectStatus } from '../lib/cards';
import { postUrl, readTime } from '../lib/content';
import type { SitePost } from '../lib/content-queries';
import { isPlayable, type PlayFields } from '../lib/play';
import { coverOf } from '../lib/post-cards';

/** The post as a card, with its cover drawn at the same 16:9 as every other card (coverOf). */
export function toCard(post: SitePost): CardData {
  const base = {
    href: postUrl(post),
    title: post.data.title,
    summary: post.data.summary,
    date: post.data.date,
    tags: post.data.tags,
  };
  const cover = coverOf(post.data as { cover?: string; coverAlt?: string });
  switch (post.collection) {
    case 'news':
      return { ...base, kind: 'news', readTime: readTime(post), cover };
    case 'blog':
      return { ...base, kind: 'blog', readTime: readTime(post), cover };
    case 'vlogs': {
      const vlog = post.data as unknown as { duration: string; poster?: string; cover?: string; coverAlt?: string };
      return { ...base, kind: 'vlog', duration: vlog.duration, cover: coverOf({ cover: vlog.poster ?? vlog.cover, coverAlt: vlog.coverAlt }) };
    }
    case 'projects':
      return {
        ...base,
        kind: 'project',
        status: (post.data as unknown as { status: ProjectStatus }).status,
        stack: (post.data as unknown as { stack: string[] }).stack,
        playable: isPlayable(post.data as unknown as PlayFields),
        cover,
      };
    case 'repos':
      return { ...base, kind: 'repo', repo: (post.data as unknown as { repo: string }).repo };
  }
}

/** `src` when it is a local file that exists in public/, else undefined (the page then shows the plate placeholder). */
export function localImage(src: string | undefined): string | undefined {
  if (!src || !src.startsWith('/') || src.startsWith('//')) return undefined;
  return existsSync(join(process.cwd(), 'public', src)) ? src : undefined;
}

// content.config.ts builds every schema through one helper typed with a loose shape, so the generated entry types only
// know the common fields. These mirror the project and repo schemas there; keep them in step.
type Common = SitePost['data'];

export type ProjectData = Common & PlayFields & {
  status: ProjectStatus;
  stack: string[];
  liveUrl?: string;
  repoUrl?: string;
  repo?: string;
  started?: Date;
  shipped?: Date;
  role?: string;
  gallery: { src: string; alt: string; caption?: string }[];
  timeline: { date: Date; text: string }[];
};

export type RepoData = Common & {
  repo: string;
  homepage?: string;
  readme: 'github' | 'local';
  install?: string;
  relatedProject?: string;
};
