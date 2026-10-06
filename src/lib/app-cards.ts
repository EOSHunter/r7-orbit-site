// Maps published apps (projects with a playUrl) onto AppCard props.
import type { AppCardData } from './cards';
import { postUrl, previewLabel, type Post } from './content';
import { playLink, typeOf } from './apps';
import type { PlayFields } from './play';
import { coverOf } from './post-cards';

// content.config.ts builds each schema from a loosely typed `extra` shape, so the project fields are not in the inferred types.
type AppData = PlayFields & { summary: string; cover?: string; coverAlt?: string };

export function toAppCard(post: Post): AppCardData {
  const data = post.data as unknown as AppData & Post['data'];
  return {
    href: postUrl(post),
    play: playLink({ ...post, data }),
    type: typeOf(post),
    title: data.title,
    summary: data.summary,
    cover: coverOf(data),
    platforms: data.platforms ?? [],
    preview: previewLabel(post),
  };
}

export const toAppCards = (posts: Post[]): AppCardData[] => posts.map(toAppCard);
