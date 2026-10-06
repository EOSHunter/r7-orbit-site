// The field vocabulary of the block library (docs/SECTIONS.md). Every field of every block is made with one of these helpers, which
// returns a Zod schema carrying its editor metadata (label, hint, widget, choice labels) in `.meta()`. So the schema IS the field
// list: src/lib/sections/describe.ts reads it back to give the admin its form (src/admin/sections-config.ts), the preview its
// defaults and the build its pictures and Markdown boxes. Nothing is written twice, and a field cannot exist in one and not the other.
//
// Pure, no Astro: read by src/content.config.ts, the admin bundle and Vitest.
import { z } from 'astro/zod';

/** An address a visitor may follow: https, or a page on this site (one leading slash, never `//host`). */
export const LINK_PATTERN = /^(https:\/\/\S+|\/(?!\/)\S*)$/;
/** An address on another site, https only (a game's address). */
export const HTTPS_PATTERN = /^https:\/\/\S+$/;
/** A picture from this site's own files (public/media), the same rule as the Figure component. */
export const IMAGE_PATTERN = /^\/(?!\/)\S+$/;
/** A tag as posts write it: lowercase words joined with hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** `m:ss` or `h:mm:ss`, as vlog chapters write it. */
export const TIMESTAMP_PATTERN = /^(\d+:)?\d{1,2}:\d{2}$/;
/** The 11 characters of a YouTube id. */
export const YOUTUBE_ID_PATTERN = /^[\w-]{11}$/;
/** `owner/name` of a GitHub repository. */
export const OWNER_NAME_PATTERN = /^[\w.-]+\/[\w.-]+$/;
/** `width:height`, e.g. 16:9. */
export const ASPECT_PATTERN = /^[1-9]\d{0,2}:[1-9]\d{0,2}$/;

export const LINK_MESSAGE = 'use a full https:// address, or a page on this site that starts with a single /, e.g. /about/';
export const HTTPS_MESSAGE = 'use a full address starting with https://';
export const IMAGE_MESSAGE = 'use a picture from this site: choose it in the editor, which writes a path like /media/name.jpg';
export const ALT_MESSAGE = 'this image needs alt text: describe it, or tick "Decorative" if it is purely ornamental';
export const SLUG_MESSAGE = 'use lowercase words joined with hyphens, e.g. "ai-agents"';

/** How the editor draws a field, and what it says about it. Read back by `describeShape`. */
export interface FieldMeta {
  /** The label above the box. */
  label: string;
  /** One or two plain sentences under the label: what to type, and why. */
  hint?: string;
  /** Which box. Left out, it follows the schema: a string is a one-line box, an enum a menu, a boolean a switch. */
  widget?: 'string' | 'text' | 'markdown' | 'image' | 'select';
  /** How the build reads the text: as Markdown (paragraphs, lists, headings), or as one paragraph's inline Markdown (bold, italic,
   *  code, links). A Markdown editor box is always `markdown`; a plain box can say so here, and everything else is shown as typed. */
  format?: 'markdown' | 'inline';
  /** The menu's choices as `value: label`, in menu order. For an enum the values are the enum's, and every one needs a label. */
  options?: Record<string, string>;
  /** The pattern the text must match (a regular expression's source), for the form. The schema checks the same one. */
  pattern?: string;
  /** What to say when the typed text does not match the pattern. */
  patternMessage?: string;
  /** For a list: how an item is shown when folded, e.g. `{{fields.label}}`. */
  summary?: string;
  /** For a list: what to call one item, e.g. "link" (the Add button reads "Add link"). */
  itemLabel?: string;
  /** For a menu of things the site knows about: where the choices come from (the admin fills them in). */
  source?: 'authors';
}

type Meta = FieldMeta;

/** A text field's schema: a string, or an optional one. */
type Str<O extends boolean> = O extends true ? z.ZodOptional<z.ZodString> : z.ZodString;

const withMeta = <T extends z.ZodType>(schema: T, meta: Meta): T => schema.meta(meta as unknown as Record<string, unknown>) as T;
/** The same, for the fields whose type is a conditional one TypeScript cannot compute inside the function: `T` is what the caller promises. */
const withMetaAs = <T>(schema: z.ZodType, meta: Meta): T => schema.meta(meta as unknown as Record<string, unknown>) as unknown as T;

const required = (label: string) => `"${label}" is required`;
const tooLong = (label: string, max: number) => `"${label}" is too long: at most ${max} characters`;

// ---- Text ---------------------------------------------------------------------------------------------------------------

interface TextOptions<O extends boolean> {
  label: string;
  hint?: string;
  /** Longest allowed. */
  max?: number;
  /** Not needed: an empty box means "not set". */
  optional?: O;
  /** `text` is a several-line box, `markdown` the editor with bold, links and lists. */
  widget?: 'string' | 'text' | 'markdown';
  /** A plain box whose text the page reads as Markdown (see FieldMeta). */
  format?: 'markdown' | 'inline';
}

/** Words the author types. Required unless `optional`; an optional box left empty arrives as '' and means "not set". */
export function text<const O extends boolean = false>({ label, hint, max, optional, widget, format }: TextOptions<O>): Str<O> {
  let s = z.string({ error: required(label) });
  if (!optional) s = s.min(1, required(label));
  if (max) s = s.max(max, tooLong(label, max));
  return withMetaAs<Str<O>>(optional ? s.optional() : s, { label, hint, widget, format: format ?? (widget === 'markdown' ? 'markdown' : undefined) });
}

interface PatternOptions<O extends boolean, F extends string | undefined> {
  label: string;
  hint?: string;
  optional?: O;
  pattern: RegExp;
  message: string;
  /** Only for a field that names a thing the site knows (an author): the form offers a menu. */
  source?: 'authors';
  max?: number;
  /** Filled in when the box is left empty (the box shows it). */
  fallback?: F;
}

/** A text box whose content must match `re`. Optional: '' is allowed too and means "not set"; the form's pattern skips an empty box. */
function matching(label: string, re: RegExp, message: string, optional: boolean | undefined, max?: number) {
  const accepted = optional ? new RegExp(`^$|${re.source}`) : re;
  let s = z.string({ error: required(label) }).regex(accepted, `"${label}": ${message}`);
  if (max) s = s.max(max, tooLong(label, max));
  return optional ? s.optional() : s;
}

/** Text that must look a certain way (an address, a tag, an id). */
export function pattern<const O extends boolean = false, const F extends string | undefined = undefined>({
  label,
  hint,
  optional,
  pattern: re,
  message,
  source,
  max,
  fallback,
}: PatternOptions<O, F>): F extends string ? z.ZodDefault<z.ZodString> : Str<O> {
  const schema = matching(label, re, message, optional, max);
  return withMetaAs(fallback === undefined ? schema : (schema as z.ZodString).default(fallback), {
    label,
    hint,
    pattern: re.source,
    patternMessage: message,
    ...(source ? { source, widget: 'select' as const } : {}),
  });
}

/** An address a visitor may follow (https or a page of this site). */
export const link = <const O extends boolean = false>(label: string, hint: string, optional?: O) =>
  pattern({ label, hint, optional, pattern: LINK_PATTERN, message: LINK_MESSAGE });

/** A picture of this site (public/media). The schema holds only the path; alt text is a separate pair, see `pictureAlt`. */
export function image<const O extends boolean = false>(label: string, hint: string, optional?: O): Str<O> {
  return withMetaAs<Str<O>>(matching(label, IMAGE_PATTERN, IMAGE_MESSAGE, optional), {
    label,
    hint,
    widget: 'image',
    pattern: IMAGE_PATTERN.source,
    patternMessage: IMAGE_MESSAGE,
  });
}

/** The alt text and the "decorative" switch that go with a picture. The block (or list item) must also run `needsAlt`. */
export const pictureAlt = (what = 'the picture') => ({
  alt: withMeta(z.string().default(''), {
    label: 'Alt text',
    hint: `Needed unless the image is decorative (the preview warns you, and the build stops without it). Describe ${what} in one plain sentence, for someone who cannot see it.`,
  }),
  decorative: withMeta(z.boolean().default(false), {
    label: 'Decorative image',
    hint: 'Turn on only if the picture is purely ornamental and says nothing. Then alt text is left empty.',
  }),
});

/** A picture needs alt text, and the empty string is allowed only for one ticked "Decorative". */
export function needsAlt(data: { alt: string; decorative: boolean }, ctx: z.RefinementCtx) {
  if (!data.decorative && !data.alt.trim()) ctx.addIssue({ code: 'custom', path: ['alt'], message: ALT_MESSAGE });
}

// ---- Choices, switches, numbers -----------------------------------------------------------------------------------------

/** A menu. `options` is `value: label`; the first value is the default unless `fallback` says otherwise. */
export function choice<const V extends readonly [string, ...string[]]>(
  values: V,
  options: Record<V[number], string>,
  meta: { label: string; hint?: string; fallback?: V[number] },
) {
  const { fallback = values[0], ...rest } = meta;
  return withMeta(z.enum(values).default(fallback), { ...rest, options });
}

/** A menu of numbers (Decap may write 2 or "2": both are read as the number). */
export function numberChoice<const V extends readonly [number, number, ...number[]]>(
  values: V,
  options: Record<V[number], string>,
  meta: { label: string; hint?: string; fallback?: V[number] },
) {
  const { fallback = values[0], ...rest } = meta;
  const literals = values.map((v) => z.literal(v)) as unknown as [z.ZodLiteral<number>, z.ZodLiteral<number>, ...z.ZodLiteral<number>[]];
  return withMeta(z.coerce.number().pipe(z.union(literals, { error: `use ${values.join(' or ')}` })).default(fallback), {
    ...rest,
    options: Object.fromEntries(Object.entries(options).map(([k, v]) => [k, v as string])),
  });
}

/** An on/off switch. */
export const flag = (label: string, hint?: string, fallback = false) => withMeta(z.boolean().default(fallback), { label, hint });

/** A whole number in a range. */
export function count(meta: { label: string; hint?: string; min: number; max: number; fallback: number }) {
  const { min, max, fallback, ...rest } = meta;
  return withMeta(
    z.coerce
      .number({ error: `"${meta.label}" must be a number` })
      .int(`"${meta.label}" must be a whole number`)
      .min(min, `"${meta.label}" is at least ${min}`)
      .max(max, `"${meta.label}" is at most ${max}`)
      .default(fallback),
    rest,
  );
}

// ---- Lists --------------------------------------------------------------------------------------------------------------

interface ListOptions {
  label: string;
  hint?: string;
  /** Fewest rows; 0 means the list may be left out. Default 1. */
  min?: number;
  max: number;
  /** How an item reads when folded, e.g. `{{fields.label}}`. */
  summary: string;
  itemLabel: string;
}

/** A list the author adds rows to, each row an object of fields. `refine` is a rule across one row's fields (`needsAlt`). */
export function list<Shape extends z.ZodRawShape>(
  shape: Shape,
  { label, hint, min = 1, max, summary, itemLabel }: ListOptions,
  refine?: (row: z.infer<z.ZodObject<Shape>>, ctx: z.RefinementCtx) => void,
) {
  let row = z.object(shape).strict();
  if (refine) row = row.superRefine(refine as never);
  const rows = z
    .array(row, { error: `"${label}" needs a list of rows` })
    .min(min, `"${label}": add at least ${min === 1 ? 'one row' : `${min} rows`}`)
    .max(max, `"${label}": at most ${max} rows`);
  return withMeta(min === 0 ? rows.default([]) : rows, { label, hint, summary, itemLabel });
}

/** Several of a menu's choices at once (a multi-select). None chosen means "all". */
export function choices<const V extends readonly [string, ...string[]]>(
  values: V,
  options: Record<V[number], string>,
  meta: { label: string; hint?: string },
) {
  return withMeta(z.array(z.enum(values)).default([]), { ...meta, options });
}
