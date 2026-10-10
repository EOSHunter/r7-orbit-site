// Front matter read the way the author means it (docs/CONTENT_MODEL.md "Empty fields"). The admin (Decap) writes `cover: ''` or
// `seoTitle: ''` when the author clears a box, and a hand-written file may have `cover:` (null) or a stray space. Each of those
// means "not set", so every collection's schema (src/content.config.ts) runs its front matter through `normaliseFrontMatter`
// before the fields are checked: a blank optional field is dropped, as if it had never been written.
//
// Pictures and their alt text are the exception, because '' is meaningful for an alt: it is the explicit "decorative" marker.
// - a blank picture is not set, and the alt that goes with it is dropped too (an alt without its picture says nothing);
// - a real picture with no alt key (or `alt:` with nothing after it) fails the build (`missingAlt`), with the message below;
// - a whitespace-only alt is the empty one: decorative.
// Pure, no Astro: content.config.ts, the admin's save check (src/admin/image-rules.ts) and Vitest read it.
import type { z } from 'astro/zod';

/** Each picture of a post's front matter, and the field holding its alt text. */
export const IMAGE_ALT_PAIRS = [
  ['cover', 'coverAlt'],
  ['featuredImage', 'featuredImageAlt'],
] as const;

type Data = Record<string, unknown>;

/** Nothing written: `null` (a YAML key with no value) or a string of spaces, the empty one included. */
export const isBlank = (value: unknown): boolean => value === null || (typeof value === 'string' && !value.trim());

/** The keys of a shape that may be left out: `.optional()` (Zod's `optin` "optional"), `.default()` and `.prefault()` ("defaulted":
 *  a blank one then gets its default, e.g. the author). */
export function optionalKeys(shape: z.ZodRawShape): Set<string> {
  const optin = (key: string) => (shape[key] as { _zod?: { optin?: string } })._zod?.optin;
  return new Set(Object.keys(shape).filter((key) => optin(key) === 'optional' || optin(key) === 'defaulted'));
}

/** The picture/alt pairs a shape has (the blog has two, the other kinds one, pages and authors none). */
const pairsOf = (keys: Set<string>) => IMAGE_ALT_PAIRS.filter(([image, alt]) => keys.has(image) && keys.has(alt));

/**
 * The preprocess step for a collection whose fields are `shape`. Returns the front matter without its blank optional fields and
 * with each alt text tidied as described above. Required fields are left alone, so an empty `title` still gets its own message.
 */
export function normaliseFrontMatter(shape: z.ZodRawShape): (data: unknown) => unknown {
  const optional = optionalKeys(shape);
  const pairs = pairsOf(new Set(Object.keys(shape)));
  const alts = new Set<string>(pairs.map(([, alt]) => alt));
  return (data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
    const out: Data = {};
    for (const [key, value] of Object.entries(data as Data)) {
      if (optional.has(key) && !alts.has(key) && isBlank(value)) continue;
      out[key] = value;
    }
    for (const [image, alt] of pairs) {
      if (!(alt in out)) continue;
      if (out[image] === undefined || out[alt] === null) delete out[alt];
      else if (typeof out[alt] === 'string' && !out[alt].trim()) out[alt] = '';
    }
    return out;
  };
}

/** What the build says about a picture with no alt key. The admin's save check says the same before the file is written. */
export const missingAltMessage = (image: string, alt: string) => `${alt} is required when ${image} is set (use "" only for a decorative image)`;

/** The picture/alt pairs of `data` where the picture is set and its alt text is missing. Run after `normaliseFrontMatter`. */
export function picturesMissingAlt(data: Data): { image: string; alt: string }[] {
  return IMAGE_ALT_PAIRS.filter(([image, alt]) => !isBlank(data[image] ?? null) && (data[alt] === undefined || data[alt] === null)).map(
    ([image, alt]) => ({ image, alt }),
  );
}

/** The refinement every post collection runs: a real picture needs its alt key (`""` only for a decorative one). */
export function missingAlt(data: Data, ctx: z.RefinementCtx) {
  for (const { image, alt } of picturesMissingAlt(data)) {
    ctx.addIssue({ code: 'custom', path: [alt], message: missingAltMessage(image, alt) });
  }
}
