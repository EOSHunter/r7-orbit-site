// The rule that turns the ordered list of blocks into rows of layout. Pure, no Astro: Sections.astro draws the rows, and the
// admin preview (src/admin/sections-html.ts) draws the same rows from the editor's data, so the two cannot group differently.
// Each block's own placement comes from its definition (definitions.ts).
import { definitionOf, type Placement } from './definitions';

/** What the layout needs of a block: its type and the few fields that decide where it sits. */
export interface Placeable {
  type: string;
  [field: string]: unknown;
}

export type Row<B extends Placeable = Placeable> =
  /** Blocks in the reading column (one `.prose`). */
  | { kind: 'prose'; blocks: B[] }
  /** One block that leaves the column and takes the page's width. */
  | { kind: 'wide'; block: B }
  /** One block that reaches both edges of the window. */
  | { kind: 'full'; block: B }
  /** One block that is a full-width section with its own spacing (the home page's rows). */
  | { kind: 'band'; block: B }
  /** A portrait beside its column of text: the heading just above it, the portrait's own text, then what follows. */
  | { kind: 'split'; portrait: B; lead?: B; blocks: B[] };

/** Where a block sits: its definition's placement, which may depend on its own fields (an image's width). */
export function placementOf(block: Placeable): Placement {
  const placement = definitionOf(block.type)?.placement ?? 'prose';
  return typeof placement === 'function' ? placement(block) : placement;
}

/**
 * Turns the ordered list into rows. A portrait puts its picture in a side column and the text beside it: the heading directly
 * above the portrait, the portrait's text, and every block after it stay in that column until a divider, a block that leaves the
 * column (wide, full, band) or the next portrait ends it. This is what lets About keep its picture beside both of its sections.
 * A heading that would be the last thing in that column, just before a block that leaves it, goes with that block instead.
 */
export function layoutSections<B extends Placeable>(sections: readonly B[]): Row<B>[] {
  const rows: Row<B>[] = [];
  let open: Extract<Row<B>, { kind: 'prose' | 'split' }> | undefined;

  for (const section of sections) {
    const placement = placementOf(section);
    if (placement === 'portrait') {
      let lead: B | undefined;
      const last = open?.kind === 'prose' ? open.blocks.at(-1) : undefined;
      if (open?.kind === 'prose' && last?.type === 'heading') {
        lead = last;
        open.blocks.pop();
        if (!open.blocks.length) rows.pop();
      }
      open = { kind: 'split', portrait: section, lead, blocks: [] };
      rows.push(open);
    } else if (placement === 'wide' || placement === 'full' || placement === 'band') {
      // A heading that ends a portrait's column introduces the block that leaves it, so it leaves with that block rather than
      // sitting alone beside the picture (About's "Meet the team" above the Team block).
      const last = open?.kind === 'split' ? open.blocks.at(-1) : undefined;
      if (open?.kind === 'split' && last?.type === 'heading') rows.push({ kind: 'prose', blocks: [open.blocks.pop()!] });
      rows.push({ kind: placement, block: section });
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
