// Reads the size of a picture a page block points at (/media/x.jpg is public/media/x.jpg), so the page can reserve its space
// before it loads: no layout shift. Build-time only. A missing file is a build error that names the block.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { imageMetadata } from 'astro/assets/utils';

export interface ImageSize {
  width: number;
  height: number;
}

export async function imageSize(path: string, where: string): Promise<ImageSize> {
  const file = join(process.cwd(), 'public', path.replace(/^\//, ''));
  let data: Buffer;
  try {
    data = await readFile(file);
  } catch {
    throw new Error(`${where}: the picture ${path} is not on this site. Choose it again in the editor, or put the file in public${path}.`);
  }
  try {
    const { width, height } = await imageMetadata(new Uint8Array(data), path);
    return { width, height };
  } catch {
    throw new Error(`${where}: ${path} is not a picture the site can read (use JPG, PNG, WebP or SVG).`);
  }
}
