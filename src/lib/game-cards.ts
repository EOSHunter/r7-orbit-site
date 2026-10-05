// Maps published games (projects with a playUrl) onto GameCard props.
import type { GameCardData } from './cards';
import { postUrl, previewLabel, type Post } from './content';
import { playLink } from './games';
import type { PlayFields } from './play';
import { coverOf } from './post-cards';

// content.config.ts builds each schema from a loosely typed `extra` shape, so the project fields are not in the inferred types.
type GameData = PlayFields & { summary: string; cover?: string; coverAlt?: string };

export function toGameCard(post: Post): GameCardData {
  const data = post.data as unknown as GameData & Post['data'];
  return {
    href: postUrl(post),
    play: playLink({ ...post, data }),
    title: data.title,
    summary: data.summary,
    cover: coverOf(data),
    platforms: data.platforms ?? [],
    preview: previewLabel(post),
  };
}

export const toGameCards = (posts: Post[]): GameCardData[] => posts.map(toGameCard);
