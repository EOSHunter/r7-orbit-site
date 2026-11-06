// Guards and shrinks the pictures. Two steps, both run by `npm run build` (so Cloudflare and CI run them too):
//
//   node scripts/media.mjs check   Before the build. Reads public/media/ and src/assets/ and stops on a file that cannot work: a HEIC
//                                  photo, an unsupported format, a name with spaces or capitals, a file over 10 MB. Each message names
//                                  the file and says what to do. Identical copies are only reported.
//   node scripts/media.mjs dist    After the build. Resizes and recompresses the pictures in dist/media/ (a copy of public/media/, so
//                                  the originals in git are never touched): anything wider than 2000px is scaled to 2000px, a big
//                                  photo is recompressed, the camera's GPS and other metadata is removed, a sideways phone photo is
//                                  turned upright. Then it stops if any picture the site would serve is still over 2 MB.
//                                  First it writes smaller WebP copies of every picture from public/ (x.png -> x.720w.webp) for
//                                  the srcset of covers, posters and portraits (src/lib/media-srcset.ts).
//
// The rules (formats, limits, messages) are in src/lib/media-rules.mjs, shared with the admin. docs/IMAGES.md explains it all.
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  IMAGE_EXTENSIONS,
  MAX_SHIPPED_BYTES,
  MAX_WIDTH,
  RECOMPRESS_ABOVE_BYTES,
  REJECTED_EXTENSIONS,
  TEXT_EXTENSIONS,
  VARIANT_SOURCE_EXTENSIONS,
  checkShippedFile,
  checkSourceFile,
  extensionOf,
  fitAttempts,
  formatBytes,
  isVariant,
  unreferencedPictures,
  variantPath,
  variantWidths,
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

/**
 * A picture still over the size limit after `shrink` (a big PNG screenshot stays a PNG, and can stay over 2 MB) is re-encoded harder,
 * then made narrower, until it fits: the deploys of 2026-11-06 showed that a picture the author uploads must never stop the build.
 * The file keeps its name and format. Returns the new bytes, or undefined when it already fits or cannot be read.
 */
export async function fitUnderLimit(file) {
  const original = await readFile(file);
  if (original.length <= MAX_SHIPPED_BYTES) return undefined;
  const ext = extensionOf(file);
  const meta = await sharp(original, { failOn: 'none' }).metadata();
  if ((meta.pages ?? 1) > 1) return undefined; // animated: left for the check to name
  for (const { width, quality } of fitAttempts(meta.width ?? MAX_WIDTH)) {
    let pipeline = sharp(original, { failOn: 'none' }).rotate().resize({ width, withoutEnlargement: true });
    if (ext === 'png') pipeline = pipeline.png({ palette: true, quality, compressionLevel: 9, effort: 3 });
    else if (ext === 'webp') pipeline = pipeline.webp({ quality });
    else if (ext === 'avif') pipeline = pipeline.avif({ quality: Math.round(quality * 0.7) });
    else if (ext === 'jpg' || ext === 'jpeg') pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    else return undefined;
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    if (data.length <= MAX_SHIPPED_BYTES) {
      return { data, from: `${meta.width}x${meta.height} ${formatBytes(original.length)}`, to: `${info.width}x${info.height} ${formatBytes(data.length)}` };
    }
  }
  return undefined;
}

/** Writes the smaller WebP copies of one picture from public/ next to it (the widths and names are in media-rules.mjs). */
async function variants(file) {
  if (!VARIANT_SOURCE_EXTENSIONS.includes(extensionOf(file)) || isVariant(file)) return 0;
  const original = await readFile(file);
  // The width the pages read from public/ (src/lib/media-srcset.ts), before any resize, so both pick the same widths.
  const { width = 0 } = await sharp(original, { failOn: 'none' }).metadata();
  const widths = variantWidths(width);
  for (const w of widths) {
    const data = await sharp(original, { failOn: 'none' }).rotate().resize({ width: w }).webp({ quality: 78 }).toBuffer();
    await writeFile(variantPath(file, w), data);
  }
  return widths.length;
}

async function dist() {
  const dir = join(root, 'dist');
  // Everything outside _astro/ (Astro's own output) and pagefind/ came from public/.
  const fromPublic = (await walk(dir)).filter((f) => !/^(_astro|pagefind)[\\/]/.test(relative(dir, f)) && isPicture(f));
  let copies = 0;
  for (const file of fromPublic) copies += await variants(file);
  console.log(`[media] ${copies} smaller WebP copies written for srcset`);
  const media = (await walk(join(dir, 'media'))).filter(isPicture);
  for (const file of media) {
    if (isVariant(file)) continue;
    const result = await shrink(file);
    if (!result) continue;
    await writeFile(file, result.data);
    console.log(`[media] shrunk /${posix(relative(dir, file))}: ${result.from} -> ${result.to}`);
  }
  // Pictures Astro copied that no page names (a picture the editor replaced, still in src/assets/): removed, not size-checked.
  const built = (await walk(join(dir, '_astro'))).filter((f) => IMAGE_EXTENSIONS.includes(extensionOf(f)));
  const texts = await Promise.all((await walk(dir)).filter((f) => TEXT_EXTENSIONS.includes(extensionOf(f))).map((f) => readFile(f, 'utf8')));
  for (const file of unreferencedPictures(built, texts)) {
    await unlink(file);
    console.log(`[media] removed /${posix(relative(dir, file))}: no page uses it`);
  }
  // Everything that will be served as a picture: public/media (just shrunk) and what Astro made from src/assets. One still over
  // the limit is brought under it rather than stopping the deploy.
  const problems = [];
  const served = [...media, ...(await walk(join(dir, '_astro'))).filter((f) => IMAGE_EXTENSIONS.includes(extensionOf(f)))];
  for (const file of served) {
    const fitted = await fitUnderLimit(file);
    if (fitted) {
      await writeFile(file, fitted.data);
      console.log(`[media] fitted /${posix(relative(dir, file))} under ${formatBytes(MAX_SHIPPED_BYTES)}: ${fitted.from} -> ${fitted.to}`);
    }
  }
  for (const file of served) {
    problems.push(...checkShippedFile({ path: `/${posix(relative(dir, file))}`, size: (await stat(file)).size }));
  }
  if (problems.length) fail('A picture is too heavy for the web. Fix these, then build again:', problems);
  console.log(`[media] ${served.length} pictures served, none over the size limit`);
}

const mode = process.argv[2];
// Run as a script (`node scripts/media.mjs check|dist`), not when a test imports fitUnderLimit.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (mode === 'check') await check();
  else if (mode === 'dist') await dist();
  else {
    console.error('usage: node scripts/media.mjs check | dist');
    process.exit(2);
  }
}
