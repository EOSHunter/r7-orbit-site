// The blocks a page such as About is built from (the `pages` collection, docs/CONTENT_MODEL.md "Pages"): their schema, and
// the rule that turns the ordered list into rows of layout. Pure, no Astro: the schema is read by src/content.config.ts, the
// rows by src/components/Sections.astro and by the admin preview (src/admin/sections-html.ts). Unit-tested in
// page-sections.vitest.ts. The field names are the admin's (src/admin/pages.ts); change them together.
import { z } from 'astro/zod';

/** An address a visitor may follow: https, or a page on this site (one leading slash, never `//host`). */
export const LINK_PATTERN = /^(https:\/\/\S+|\/(?!\/)\S*)$/;
/** A picture from this site's own files (public/media), the same rule as the Figure component. */
export const IMAGE_PATTERN = /^\/(?!\/)\S+$/;

export const LINK_MESSAGE = 'use a full https:// address, or a page on this site that starts with a single /, e.g. /subscribe/';
export const IMAGE_MESSAGE = 'use a picture from this site: choose it in the editor, which writes a path like /media/name.jpg';
export const ALT_MESSAGE = 'this image needs alt text: describe it, or tick "Decorative" if it is purely ornamental';

const link = z.string().regex(LINK_PATTERN, LINK_MESSAGE);
const picture = z.string().regex(IMAGE_PATTERN, IMAGE_MESSAGE);
const text = (max?: number) => (max ? z.string().min(1).max(max) : z.string().min(1));

// Optional text may arrive as '' (the admin leaves an empty box as it is), which means "not set".
const optionalText = z.string().optional();

/** Decap may write a select's number as 2 or "2"; both are read as the number. */
const level = z.coerce.number().pipe(z.union([z.literal(2), z.literal(3)], { error: 'use 2 or 3' })).default(2);

// An image needs alt text, and the empty string is allowed only for a block ticked "Decorative".
function needsAlt(data: { alt: string; decorative: boolean }, ctx: z.RefinementCtx) {
  if (!data.decorative && !data.alt.trim()) ctx.addIssue({ code: 'custom', path: ['alt'], message: ALT_MESSAGE });
}
const pictureShape = {
  image: picture,
  alt: z.string().default(''),
  decorative: z.boolean().default(false),
};

const heading = z.object({ type: z.literal('heading'), level, text: text(120) }).strict();
const body = z.object({ type: z.literal('text'), text: text() }).strict();
const image = z
  .object({
    type: z.literal('image'),
    ...pictureShape,
    caption: optionalText,
    width: z.enum(['narrow', 'wide', 'full']).default('narrow'),
  })
  .strict()
  .superRefine(needsAlt);
const portrait = z
  .object({
    type: z.literal('portrait'),
    ...pictureShape,
    side: z.enum(['left', 'right']).default('left'),
    text: text(),
  })
  .strict()
  .superRefine(needsAlt);
const quote = z.object({ type: z.literal('quote'), text: text(), attribution: optionalText }).strict();
const callout = z
  .object({ type: z.literal('callout'), kind: z.enum(['info', 'tip', 'warn']).default('info'), title: optionalText, text: text() })
  .strict();
const links = z
  .object({
    type: z.literal('links'),
    items: z.array(z.object({ label: text(120), url: link, note: optionalText }).strict()).min(1, 'add at least one link').max(20),
  })
  .strict();
const button = z.object({ type: z.literal('button'), label: text(40), url: link }).strict();
const divider = z.object({ type: z.literal('divider'), style: z.enum(['rule', 'dots']).default('rule') }).strict();

export const sectionSchema = z.discriminatedUnion('type', [heading, body, image, portrait, quote, callout, links, button, divider]);

export type Section = z.infer<typeof sectionSchema>;
export type SectionType = Section['type'];
type Of<T extends SectionType> = Extract<Section, { type: T }>;
export type HeadingSection = Of<'heading'>;
export type ImageSection = Of<'image'>;
export type PortraitSection = Of<'portrait'>;

export const SECTION_TYPES = ['heading', 'text', 'image', 'portrait', 'quote', 'callout', 'links', 'button', 'divider'] as const;

// ---- Layout -------------------------------------------------------------------------------------------------------

/** What sits in the reading column. */
export type ProseBlock = Exclude<Section, { type: 'portrait' }>;

export type Row =
  | { kind: 'prose'; blocks: ProseBlock[] }
  /** An image set to wide or full: it leaves the reading column. */
  | { kind: 'picture'; block: ImageSection }
  /** A portrait beside its column of text: the heading just above it, the portrait's own text, then what follows. */
  | { kind: 'split'; portrait: PortraitSection; lead?: HeadingSection; blocks: ProseBlock[] };

const leavesColumn = (s: Section): s is ImageSection => s.type === 'image' && s.width !== 'narrow';

/**
 * Turns the ordered list into rows. A portrait puts its picture in a side column and the text beside it: the heading directly
 * above the portrait, the portrait's text, and every block after it stay in that column until a divider, a wide or full image,
 * or the next portrait ends it. This is what lets About keep its picture beside both of its sections.
 */
export function layoutSections(sections: readonly Section[]): Row[] {
  const rows: Row[] = [];
  let open: Extract<Row, { kind: 'prose' | 'split' }> | undefined;

  for (const section of sections) {
    if (section.type === 'portrait') {
      let lead: HeadingSection | undefined;
      const last = open?.kind === 'prose' ? open.blocks.at(-1) : undefined;
      if (open?.kind === 'prose' && last?.type === 'heading') {
        lead = last;
        open.blocks.pop();
        if (!open.blocks.length) rows.pop();
      }
      open = { kind: 'split', portrait: section, lead, blocks: [] };
      rows.push(open);
    } else if (leavesColumn(section)) {
      rows.push({ kind: 'picture', block: section });
      open = undefined;
    } else if (section.type === 'divider' && open?.kind === 'split') {
      open = { kind: 'prose', blocks: [section] };
      rows.push(open);
    } else {
      if (!open) {
        open = { kind: 'prose', blocks: [] };
        rows.push(open);
      }
      open.blocks.push(section);
    }
  }
  return rows;
}

/** A readable name for a block type, for headings in errors and the admin. */
export const SECTION_LABELS: Record<SectionType, string> = {
  heading: 'Heading',
  text: 'Text',
  image: 'Image',
  portrait: 'Portrait and text',
  quote: 'Quote',
  callout: 'Callout',
  links: 'Links list',
  button: 'Button',
  divider: 'Divider',
};
