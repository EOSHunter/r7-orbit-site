// What a schema cannot know: the checks that need something else the site has (the posts, the authors, public/_headers). Pure
// functions over data handed in, so they run under Vitest; the Astro components load the data and throw what these return,
// each message starting with where the block is ("about.md, block 4 (Latest posts): …").
import { definitionOf, POST_KINDS } from './definitions';
import { TURNSTILE_ORIGIN } from '../waitlist';

/** "about.md, block 4 (Latest posts)": the start of every build error about a block. Blocks are counted from 1, as the editor shows them. */
export const whereOf = (source: string, index: number, label: string) => `${source}, block ${index + 1} (${label})`;

/** The game hosts public/_headers lets the site frame: the `frame-src` of its /projects/* block, without Turnstile's (the waitlist
 *  form's spam check is a frame too, but no game lives there). */
export function frameSrcOrigins(headers: string): string[] {
  const lines = headers.split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim() === '/projects/*');
  if (at < 0) return [];
  const csp = lines[at + 1]?.split(':').slice(1).join(':').trim() ?? '';
  if (!/^frame-src\s/.test(csp)) return [];
  return csp.replace(/^frame-src/, '').trim().split(/\s+/).filter((origin) => origin !== TURNSTILE_ORIGIN);
}

/** What is wrong with an embedded game's address, or undefined. A link-mode game is only a button, so it needs no frame permission. */
export function gameProblem(block: { playUrl: string; playMode: string }, allowed: readonly string[]): string | undefined {
  if (block.playMode === 'link') return undefined;
  let origin: string;
  try {
    origin = new URL(block.playUrl).origin;
  } catch {
    return `"${block.playUrl}" is not an address.`;
  }
  if (allowed.includes(origin)) return undefined;
  return (
    `the game's address ${origin} is not in frame-src in public/_headers, so a browser would refuse to frame it. ` +
    `Add that host there (the /projects/* block: explicit host, no wildcard), or set Play mode to Link.`
  );
}

/** What the site has that a block can point at. */
export interface Known {
  /** Every tag some post (draft or scheduled included) carries. */
  tags: readonly string[];
  /** Every author slug. */
  authors: readonly string[];
}

const list = (items: readonly string[]) => (items.length ? items.join(', ') : '(none yet)');

/** The tag and author of a Latest posts block must exist. (An unknown kind is refused by the schema.) */
export function latestProblems(block: { kinds: readonly string[]; tag?: string; author?: string }, known: Known): string[] {
  const problems: string[] = [];
  for (const kind of block.kinds) {
    if (!(POST_KINDS as readonly string[]).includes(kind)) problems.push(`there is no kind "${kind}". The kinds are: ${POST_KINDS.join(', ')}.`);
  }
  if (block.tag && !known.tags.includes(block.tag)) problems.push(`no post has the tag "${block.tag}". Tags in use: ${list(known.tags)}.`);
  if (block.author && !known.authors.includes(block.author)) {
    problems.push(`there is no author "${block.author}". Authors are: ${list(known.authors)}.`);
  }
  return problems;
}

/**
 * A block a page may hold once (`once` in its definition: the Latest feed, which carries the #latest anchor and the page's kind
 * filter), found again: one problem per extra block, with its place in the list (from 0). Pure: the page throws them, the editor's
 * preview lists them.
 */
export function onceProblems(types: readonly unknown[]): { index: number; message: string }[] {
  const seen = new Set<string>();
  const problems: { index: number; message: string }[] = [];
  types.forEach((type, index) => {
    const definition = definitionOf(String(type));
    if (!definition?.once) return;
    if (seen.has(definition.id)) problems.push({ index, message: `a page holds one ${definition.label} block at most: remove this one, or the other.` });
    seen.add(definition.id);
  });
  return problems;
}

/** Each card of a Team block must name an author who exists, once. Members are counted from 1, as the editor shows them. */
export function teamProblems(block: { members: readonly { author: string }[] }, known: Known): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  block.members.forEach(({ author }, index) => {
    const where = `member ${index + 1}`;
    if (!known.authors.includes(author)) problems.push(`${where}: there is no author "${author}". Authors are: ${list(known.authors)}.`);
    else if (seen.has(author)) problems.push(`${where}: "${author}" is already on the team; each author has one card.`);
    seen.add(author);
  });
  return problems;
}

/** An Author box must name an author who exists. */
export function authorProblem(slug: string, known: Known): string | undefined {
  return known.authors.includes(slug) ? undefined : `there is no author "${slug}". Authors are: ${list(known.authors)}.`;
}
