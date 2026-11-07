// The srcset for a picture served as a plain file from public/ (a cover, a poster, a portrait): the WebP copies that
// scripts/media.mjs writes into dist/ after the build. Without it a card on a phone downloads the 2000px original (the rule
// and the widths are in media-rules.mjs, "Smaller copies"). `src` stays the original, for browsers without srcset. Build-time only.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { imageSize } from './section-images';
import { VARIANT_SOURCE_EXTENSIONS, extensionOf, variantPath, variantWidths } from './media-rules.mjs';

/** undefined (draw the plain picture) in `astro dev`, where the copies do not exist, and for anything not a raster file in public/. */
export async function publicSrcset(src: string | undefined): Promise<string | undefined> {
  if (!import.meta.env.PROD || !src?.startsWith('/') || src.startsWith('//')) return undefined;
  if (!VARIANT_SOURCE_EXTENSIONS.includes(extensionOf(src))) return undefined;
  if (!existsSync(join(process.cwd(), 'public', src.replace(/^\//, '')))) return undefined;
  const { width } = await imageSize(src, src);
  const widths = variantWidths(width);
  return widths.length ? widths.map((w) => `${variantPath(src, w)} ${w}w`).join(', ') : undefined;
}

/**
 * `sizes` for the places these pictures are drawn (widths from site.css and components.css). The page is at most 1120px, and
 * on a phone .container leaves 92vw (--gutter is 4vw a side); saying 100vw there makes the browser take a copy a size too big.
 */
export const SIZES = {
  /** A card in .grid-cards or .app-grid (one column on a phone, two or three after), or the wider pinned card. */
  card: '(min-width: 1180px) 600px, (min-width: 700px) 50vw, 92vw',
  /** Across the page: the video and play panels, a post's cover. */
  page: '(min-width: 1180px) 1120px, 92vw',
  /** The portrait column (.portrait: at most 20rem, 4:5); `object-fit: cover` draws a square picture at the frame's height, 25rem. */
  portrait: '25rem',
  /** An author's photo as an avatar (.avatar in site.css: --s-5 + --s-2), and the large one on the author's page (--s-8 + --s-5). */
  avatar: '32px',
  avatarLarge: '88px',
  /** The author page's head: from 40rem it is as tall as the name, subtitle and bio beside it (.author-head in site.css), about 200px. */
  avatarHead: '(min-width: 40rem) 240px, 88px',
} as const;
