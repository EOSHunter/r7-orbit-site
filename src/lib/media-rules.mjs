// The rules for images, in one place, so the three things that enforce them cannot disagree:
//   - the build guard and optimiser (scripts/media.mjs),
//   - the admin's save check (src/admin/image-rules.ts, which refuses to save a post the build would refuse),
//   - the Markdown alt-text check (src/lib/markdown/remark-image-alt.mjs).
// Plain JavaScript with JSDoc types so a Node script can import it with no build step. Unit-tested in media-rules.vitest.ts.
// The author-facing version of these rules is docs/IMAGES.md.

/** Formats the site can show. `jpeg` is the same thing as `jpg`. */
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'svg'];

/** Formats that browsers do not show (or that are far too heavy), with what to do instead. */
export const REJECTED_EXTENSIONS = {
  heic: 'HEIC is the iPhone\'s default format and most browsers cannot show it. Export it as JPG (Photos > File > Export, or on the iPhone choose Settings > Camera > Formats > Most Compatible) and upload that.',
  heif: 'HEIF is the iPhone\'s default format and most browsers cannot show it. Export it as JPG and upload that.',
  tif: 'TIFF files are huge and browsers do not show them. Export the picture as JPG or PNG.',
  tiff: 'TIFF files are huge and browsers do not show them. Export the picture as JPG or PNG.',
  bmp: 'BMP files are huge. Export the picture as JPG or PNG.',
  gif: 'GIF is not one of the formats this site accepts (animated GIFs are heavy). Use a PNG or JPG still, or a short video.',
  raw: 'RAW camera files cannot be shown on a web page. Export the picture as JPG.',
  dng: 'RAW camera files cannot be shown on a web page. Export the picture as JPG.',
};

const MB = 1024 * 1024;
/** The biggest file the admin will accept or the repository may hold. A 6 MB phone photo is fine; it is resized at build. */
export const MAX_SOURCE_BYTES = 10 * MB;
/** The `media_library` option every image widget in the admin carries: one file at a time, and the upload size limit. */
export const IMAGE_LIBRARY = { allow_multiple: false, config: { max_file_size: MAX_SOURCE_BYTES } };
/** The biggest image the finished site may serve, after the build has resized and recompressed it. */
export const MAX_SHIPPED_BYTES = 2 * MB;
/** Pictures in public/media wider than this are scaled down to it at build (the widest the site ever shows, at 2x). */
export const MAX_WIDTH = 2000;
/** Pictures in public/media smaller than this are left exactly as they are. */
export const RECOMPRESS_ABOVE_BYTES = 300 * 1024;

// ---- Smaller copies -------------------------------------------------------------------------------------------------
// A cover, poster or portrait is a plain file from public/, often a 2000px original. After the build, scripts/media.mjs dist
// writes WebP copies of every picture from public/ at these widths next to it (/media/x.png -> /media/x.720w.webp), and the
// components that draw such a picture offer them in a srcset (src/lib/media-srcset.ts), so a card downloads a few kB instead
// of the original. Both sides read the widths from here, so they cannot disagree.

/**
 * Widths of the WebP copies. A card is about 380 CSS px wide on a phone, which the 720 copy covers at the phone's density.
 * 160 is for the author's photo drawn as an avatar (32 or 88 CSS px, AuthorAvatar.astro), which the 480 copy would cover thrice.
 */
export const VARIANT_WIDTHS = [160, 480, 720, 960, 1280];

/** Pictures narrower than this (icons) get no copies: they are small already. */
export const MIN_VARIANT_SOURCE_WIDTH = 480;

/** Formats that get copies (an SVG is drawn at any size as it is). */
export const VARIANT_SOURCE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif'];

/**
 * The copies a picture `width` pixels wide gets: the widths below its own, and one at its own width (after the build's 2000px
 * cap), so the largest choice in a srcset is a WebP too, never the original JPG or PNG. None for a picture narrower than
 * MIN_VARIANT_SOURCE_WIDTH.
 */
export function variantWidths(width) {
  const own = Math.min(width, MAX_WIDTH);
  return own >= MIN_VARIANT_SOURCE_WIDTH ? [...VARIANT_WIDTHS.filter((w) => w < own), own] : [];
}

/** Where the copy of `path` at `width` is served: `/media/x.png`, 720 -> `/media/x.720w.webp`. */
export const variantPath = (path, width) => `${String(path).replace(/\.[^./\\]+$/, '')}.${width}w.webp`;

/** A copy the build made, not an author's picture. */
export const isVariant = (path) => /\.\d+w\.webp$/.test(String(path));

/** `photo.JPG` -> `jpg`. '' when there is no extension. */
export const extensionOf = (name) => {
  const base = String(name).split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
};

/** Lowercase letters, digits, hyphens, dots and underscores, starting with a letter or digit. What Decap writes (admin config `slug`). */
export const SAFE_FILE_NAME = /^[a-z0-9][a-z0-9._-]*$/;

/** The same name made safe: lowercase, accents dropped, anything else a hyphen, hyphens not doubled. */
export function safeFileName(name) {
  const base = String(name).split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot + 1) : '';
  const clean = (s) =>
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  return `${clean(stem) || 'image'}${ext ? `.${clean(ext)}` : ''}`;
}

export const formatBytes = (bytes) =>
  bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * What is wrong with an image file, as readable sentences that name the file and say what to do. Empty when it is fine.
 * @param {{ path: string, size: number }} file `path` is whatever the reader will recognise (the repository path).
 * @returns {string[]}
 */
export function checkSourceFile({ path, size }) {
  const problems = [];
  const name = String(path).split(/[\\/]/).pop() ?? '';
  const ext = extensionOf(name);
  if (ext in REJECTED_EXTENSIONS) {
    problems.push(`${path}: ${REJECTED_EXTENSIONS[ext]}`);
    return problems;
  }
  if (!IMAGE_EXTENSIONS.includes(ext)) {
    problems.push(
      `${path}: ".${ext || '?'}" is not an image format this site accepts. Use ${IMAGE_EXTENSIONS.filter((e) => e !== 'jpeg').join(', ')}.`,
    );
    return problems;
  }
  if (!SAFE_FILE_NAME.test(name)) {
    problems.push(
      `${path}: the file name has spaces, capitals or odd characters. Rename it to something like "${safeFileName(name)}" (lowercase letters, digits and hyphens only), then choose it again in the editor.`,
    );
  }
  if (size > MAX_SOURCE_BYTES) {
    problems.push(
      `${path}: ${formatBytes(size)} is over the ${formatBytes(MAX_SOURCE_BYTES)} limit. Export a smaller copy (about 2000 pixels wide is plenty), upload that, and delete this one.`,
    );
  }
  return problems;
}

/**
 * A file the finished site would serve is too heavy even after resizing.
 * @param {{ path: string, size: number }} file `path` is the path the site serves it at, e.g. /media/x.png.
 * @returns {string[]}
 */
export function checkShippedFile({ path, size }) {
  if (size <= MAX_SHIPPED_BYTES) return [];
  const ext = extensionOf(path);
  const advice =
    ext === 'png'
      ? 'Export it as JPG or WebP instead (a PNG of a photo is always large), or crop it smaller.'
      : ext === 'svg'
        ? 'Simplify the drawing, or export it as a PNG or JPG at about 2000 pixels wide.'
        : 'Export a smaller copy, about 2000 pixels wide.';
  return [
    `${path}: still ${formatBytes(size)} after the build resized it, over the ${formatBytes(MAX_SHIPPED_BYTES)} limit for a picture on the web. ${advice} Upload that, point the post at it, and delete this one.`,
  ];
}

// ---- Alt text -----------------------------------------------------------------------------------------------------------

/** Written as the title of a Markdown image, `![](x.jpg "decorative")`, or as `decorative` on a Figure: the picture is only decoration. */
export const DECORATIVE = 'decorative';

/** The sentence both the build and the admin give for a body image that has no alt text. */
export function missingAltMessage(where, src, form) {
  const how =
    form === 'markdown'
      ? `Write a short description between the square brackets: ![what the picture shows](${src || '/media/picture.jpg'}). If the picture is only decoration, write ![](${src || '/media/picture.jpg'} "${DECORATIVE}") instead.`
      : 'Fill in "Alt text" on the image (what the picture shows, in one plain sentence), or tick "Decoration only" if it adds nothing for someone who cannot see it.';
  return `${where}: the image ${src ? `"${src}" ` : ''}has no alt text. ${how}`;
}

/**
 * Body images that have no alt text, found in the text of a post body (what the editor holds), for the admin's save check.
 * Counts Markdown images, <Figure> and the images of an <ImageGallery>/<ImageRow>. A picture marked decorative is fine.
 * @param {string} body
 * @returns {{ src: string, form: 'markdown' | 'block' }[]}
 */
export function bodyImagesMissingAlt(body) {
  const found = [];
  const text = String(body ?? '').replace(/```[\s\S]*?```/g, '');
  for (const m of text.matchAll(/!\[([^\]]*)\]\(([^)\s]*)(?:\s+"([^"]*)")?\)/g)) {
    if (!m[1].trim() && m[3]?.trim().toLowerCase() !== DECORATIVE) found.push({ src: m[2], form: 'markdown' });
  }
  for (const m of text.matchAll(/<Figure\b([^>]*?)\/?>/g)) {
    const attrs = m[1];
    const src = /\bsrc=(?:"([^"]*)"|\{"((?:[^"\\]|\\.)*)"\})/.exec(attrs);
    if (!src) continue;
    const alt = /\balt=(?:"([^"]*)"|\{"((?:[^"\\]|\\.)*)"\})/.exec(attrs);
    const decorative = /\bdecorative\b/.test(attrs);
    if (!decorative && !(alt?.[1] ?? alt?.[2] ?? '').trim()) found.push({ src: src[1] ?? src[2], form: 'block' });
  }
  for (const m of text.matchAll(/<(?:ImageGallery|ImageRow)\b[^>]*?\bimages=\{(\[[^\n]*\])\}/g)) {
    try {
      for (const image of JSON.parse(m[1])) {
        if (image?.src && !image.decorative && !String(image.alt ?? '').trim()) found.push({ src: image.src, form: 'block' });
      }
    } catch {
      /* hand-written, not JSON: the build reads it properly */
    }
  }
  return found;
}
