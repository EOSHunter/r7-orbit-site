// Finds the pictures a post body can point at. Two kinds, both written as plain text in a post:
//   /src/assets/blog/x.jpg   a file in src/assets/: optimised at build (several widths, AVIF and WebP). What the admin writes for blog images.
//   /media/x.jpg             a file in public/media/: served as it is (the build still resizes anything over 2000px wide, scripts/media.mjs).
// An imported image (`import x from '../assets/x.jpg'`) is the first kind too. Remote addresses are refused (docs/CONTENT_MODEL.md rule 4).
import type { ImageMetadata } from 'astro';
import { resolveImage, type ImageSource } from '../../lib/article';

const rasters = import.meta.glob<{ default: ImageMetadata }>('/src/assets/**/*.{jpg,jpeg,png,webp,avif}');
const svgs = import.meta.glob<string>('/src/assets/**/*.svg', { query: '?url', import: 'default' });

export type ResolvedImage =
  | { kind: 'optimised'; meta: ImageMetadata }
  | { kind: 'plain'; src: string; width?: number; height?: number };

export const isAssetPath = (src: string): boolean => src.startsWith('/src/assets/');

const isMetadata = (source: ImageSource): source is ImageMetadata =>
  typeof source === 'object' && 'format' in source && typeof (source as ImageMetadata).format === 'string';

/** `where` names the component, so a missing file is reported as "Figure: ...". */
export async function resolveBodyImage(source: ImageSource, where: string): Promise<ResolvedImage> {
  if (isMetadata(source)) return { kind: 'optimised', meta: source };
  const path = typeof source === 'string' ? source : source.src;
  if (typeof source === 'string' && isAssetPath(path)) {
    const load = rasters[path];
    if (load) return { kind: 'optimised', meta: (await load()).default };
    const svg = svgs[path];
    if (svg) return { kind: 'plain', src: await svg() };
    throw new Error(
      `${where}: "${path}" is not in src/assets/. The file was deleted or renamed: choose the image again in the editor (or put the file back).`,
    );
  }
  return { kind: 'plain', ...resolveImage(source, where) };
}
