// `sectionsSchema`: the Zod schema of a `sections` list, generated from the block definitions (definitions.ts). Attach it to any
// collection with `sections: sectionsSchema` (it is optional: a file without `sections` reads as an empty list). Pure, no Astro.
import { z } from 'astro/zod';
import { definitionOf, definitions, SECTION_TYPES } from './definitions';

type BlockSchema = (typeof definitions)[number]['schema'];

/** How many blocks a page may hold. */
export const MAX_SECTIONS = 60;

/**
 * One block: a union on `type`, one member per definition. An unknown `type` fails with the list of the real ones; a bad field
 * fails with the block's own message (the path names the block: `sections.2.alt` is the third block, counting from `sections.0`).
 */
export const sectionSchema = z.discriminatedUnion('type', definitions.map((d) => d.schema) as unknown as [BlockSchema, ...BlockSchema[]], {
  error: (issue) => {
    const type = (issue.input as { type?: unknown } | undefined)?.type;
    return `Unknown block type ${typeof type === 'string' ? `"${type}"` : '(none)'}. The blocks are: ${SECTION_TYPES.join(', ')}.`;
  },
});

const blocks = z.array(sectionSchema).max(MAX_SECTIONS, `a page may hold at most ${MAX_SECTIONS} blocks`);

/**
 * The list of blocks a page is made of, ready to attach to any collection: `sections: sectionsSchema`. Optional (an absent list is an
 * empty one) and capped. A bad block fails the build with a message that names it the way the editor does, counting from 1:
 * "sections.3.alt: Block 4 (Image): this image needs alt text…" (Astro adds the file and the 0-based path).
 */
export const sectionsSchema = z
  .preprocess((raw, ctx) => {
    if (!Array.isArray(raw)) return raw;
    raw.forEach((block: unknown, index) => {
      const result = sectionSchema.safeParse(block);
      if (result.success) return;
      const label = definitionOf(String((block as { type?: unknown } | null)?.type))?.label;
      for (const issue of result.error.issues) {
        ctx.issues.push({
          code: 'custom',
          message: `Block ${index + 1}${label ? ` (${label})` : ''}: ${issue.message}`,
          path: [index, ...issue.path],
          input: block,
        });
      }
    });
    // With a problem reported the parse fails whatever follows; an empty list keeps the schema below from repeating it.
    return ctx.issues.length ? [] : raw;
  }, blocks)
  .default([]);

/** One block as the schema reads it, discriminated on `type`. */
export type Section = z.infer<typeof sectionSchema>;
export type SectionOf<T extends Section['type']> = Extract<Section, { type: T }>;
/** What may be written in a file for a block (defaults not yet filled in). */
export type SectionInput = z.input<typeof sectionSchema>;
