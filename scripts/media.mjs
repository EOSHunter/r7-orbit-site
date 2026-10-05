// Guards and shrinks the pictures. Two steps, both run by `npm run build` (so Cloudflare and CI run them too):
//
//   node scripts/media.mjs check   Before the build. Reads public/media/ and src/assets/ and stops on a file that cannot work: a HEIC
//                                  photo, an unsupported format, a name with spaces or capitals, a file over 10 MB. Each message names
//                                  the file and says what to do. Identical copies are only reported.
//   node scripts/media.mjs dist    After the build. Resizes and recompresses the pictures in dist/media/ (a copy of public/media/, so
//                                  the originals in git are never touched): anything wider than 2000px is scaled to 2000px, a big
//                                  photo is recompressed, the camera's GPS and other metadata is removed, a sideways phone photo is
//                                  turned upright. Then it stops if any picture the site would serve is still over 2 MB.
//
// The rules (formats, limits, messages) are in src/lib/media-rules.mjs, shared with the admin. docs/IMAGES.md explains it all.
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  IMAGE_EXTENSIONS,
  MAX_WIDTH,
  RECOMPRESS_ABOVE_BYTES,
  REJECTED_EXTENSIONS,
  checkShippedFile,
  checkSourceFile,
  extensionOf,
  formatBytes,
} from '../src/lib/media-rules.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const posix = (p) => p.split('\\').join('/');

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

const isPicture = (file) => {
  const ext = extensionOf(file);
  return IMAGE_EXTENSIONS.includes(ext) || ext in REJECTED_EXTENSIONS;
};

function fail(title, problems) {
  console.error(`\n[media] ${title}\n`);
  for (const problem of problems) console.error(`  - ${problem}\n`);
  process.exit(1);
}

// ---- check: the files in the repository ------------------------------------------------------------------------------

async function check() {
  const problems = [];
  const seen = new Map();
  for (const folder of ['public/media', 'src/assets']) {
    for (const file of (await walk(join(root, folder))).filter(isPicture)) {
      const path = posix(relative(root, file));
      problems.push(...checkSourceFile({ path, size: (await stat(file)).size }));
      const hash = createHash('sha1').update(await readFile(file)).digest('hex');
      seen.set(hash, [...(seen.get(hash) ?? []), path]);
    }
  }
  for (const paths of seen.values()) {
    if (paths.length > 1) console.warn(`[media] identical pictures, you could keep one: ${paths.join(' and ')}`);
  }
  if (problems.length) fail('A picture cannot be used. Fix these, then build again:', problems);
  console.log('[media] pictures in public/media and src/assets: ok');
}

// ---- dist: shrink what the site serves, then check what is left -----------------------------------------------------

/** Re-encodes one picture; returns the new bytes, or undefined to leave the file alone. */
async function shrink(file) {
  const ext = extensionOf(file);
  if (!['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(ext)) return undefined; // svg stays as drawn
  const original = await readFile(file);
  const meta = await sharp(original, { failOn: 'none' }).metadata();
  if ((meta.pages ?? 1) > 1) return undefined; // animated
  const tooWide = (meta.width ?? 0) > MAX_WIDTH;
  const hasMetadata = Boolean(meta.exif);
  if (!tooWide && !hasMetadata && original.length <= RECOMPRESS_ABOVE_BYTES) return undefined;

  let pipeline = sharp(original, { failOn: 'none' }).rotate(); // upright, and the metadata is dropped on output
  if (tooWide) pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  if (ext === 'png') pipeline = pipeline.png({ compressionLevel: 9, effort: 10 });
  else if (ext === 'webp') pipeline = pipeline.webp({ quality: 82 });
  else if (ext === 'avif') pipeline = pipeline.avif({ quality: 55 });
  else pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  // Keep the original when it was already smaller, unless it had to be resized or cleaned of metadata.
  if (data.length >= original.length && !tooWide && !hasMetadata) return undefined;
  return { data, from: `${meta.width}x${meta.height} ${formatBytes(original.length)}`, to: `${info.width}x${info.height} ${formatBytes(data.length)}` };
}

async function dist() {
  const dir = join(root, 'dist');
  const media = (await walk(join(dir, 'media'))).filter(isPicture);
  for (const file of media) {
    const result = await shrink(file);
    if (!result) continue;
    await writeFile(file, result.data);
    console.log(`[media] shrunk /${posix(relative(dir, file))}: ${result.from} -> ${result.to}`);
  }
  // Everything that will be served as a picture: public/media (just shrunk) and what Astro made from src/assets.
  const problems = [];
  const served = [...media, ...(await walk(join(dir, '_astro'))).filter((f) => IMAGE_EXTENSIONS.includes(extensionOf(f)))];
  for (const file of served) {
    problems.push(...checkShippedFile({ path: `/${posix(relative(dir, file))}`, size: (await stat(file)).size }));
  }
  if (problems.length) fail('A picture is too heavy for the web. Fix these, then build again:', problems);
  console.log(`[media] ${served.length} pictures served, none over the size limit`);
}

const mode = process.argv[2];
if (mode === 'check') await check();
else if (mode === 'dist') await dist();
else {
  console.error('usage: node scripts/media.mjs check | dist');
  process.exit(2);
}
