// The Team block's layout, worked out once for the page (TeamBlock.astro) and the editor's preview (src/admin/sections-html.ts).
// Pure, no Astro.

/** A run of members next to each other with the same group: drawn under the group's name (none when `name` is empty). */
export interface TeamGroup<M> {
  name: string;
  members: M[];
}

/**
 * The members cut into runs of the same group, in order. A member with no group joins no heading: with every group empty the
 * block is one run with no name (one grid, as before groups existed). The same group twice, apart, is two runs: the page
 * keeps the order the author set.
 */
export function teamGroups<M extends { group?: string }>(members: readonly M[]): TeamGroup<M>[] {
  const groups: TeamGroup<M>[] = [];
  for (const member of members) {
    const name = member.group?.trim() ?? '';
    const last = groups.at(-1);
    if (last && last.name === name) last.members.push(member);
    else groups.push({ name, members: [member] });
  }
  return groups;
}

/** The anchor of a member's card on the page, so a step can link to it. */
export const teamCardId = (slug: string) => `team-${slug}`;

/** Where a name in a step goes: the person's card on this page when they have one, else their author page. */
export function stepHref(slug: string, onTeam: ReadonlySet<string>, authorPath: string): string {
  return onTeam.has(slug) ? `#${teamCardId(slug)}` : authorPath;
}

/** Heading levels for the block: group and steps headings, then the card names under them (never skipping a level). */
export function teamLevels(afterHeading: boolean, headed: boolean): { section: number; name: number } {
  const section = afterHeading ? 3 : 2;
  return { section, name: headed ? section + 1 : section };
}
