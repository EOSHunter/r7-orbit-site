// A post's body in the editor, whichever way it is written: the Markdown body, or `sections` (blocks, docs/SECTIONS.md "Posts").
// The previews (preview.ts for the blog, post-preview.ts for the other kinds) read the reading time and the contents list through the
// same projection as the site (src/lib/sections-to-content.ts), and draw the blocks with the sections preview (sections-html.ts).
// The save check refuses a post that has both, as the build does (bodyConflict in src/lib/content.ts). Pure, no DOM: Vitest runs it.
import { countWords, WORDS_PER_MINUTE } from '../lib/content';
import type { Section } from '../lib/sections';
import { sectionsHeadings, sectionsToText } from '../lib/sections-to-content';
import { headingsOf, type Heading } from './preview-html';
import { looseSections, previewProblems } from './sections-html';

type Data = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** What the author is told when a post has both: the form's hint says the same ("Use sections OR the body, not both"). */
export const BOTH_MESSAGE =
  'This post has both sections and a Body. Use sections OR the body, not both: empty the Body to keep the sections, or remove the sections to keep the Body.';

export interface PostBody {
  /** The blocks as the editor holds them (half-filled ones made whole); empty when the post is written as Markdown. */
  sections: Section[];
  /** The Markdown body, '' when there is none. */
  markdown: string;
  /** Reading time in minutes, as the page works it out (a `readTime` the author typed wins). */
  minutes: number;
  /** The h2 and h3 for the contents list, with their anchors. */
  headings: Heading[];
  /** What the build would stop on, for the box above the preview: a post written both ways, and the blocks' own problems. */
  problems: string[];
}

/** The body of a post as the editor holds it. */
export function postBody(data: Data): PostBody {
  const sections = looseSections(data.sections);
  const markdown = str(data.body);
  const words = sections.length ? countWords(sectionsToText(sections)) : countWords(markdown);
  const minutes = Number(data.readTime) > 0 ? Number(data.readTime) : Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
  const headings = sections.length ? sectionsHeadings(sections).map(({ depth, slug, text }) => ({ depth, slug, text })) : headingsOf(markdown);
  const both = bodyAndSectionsProblem(data);
  return { sections, markdown, minutes, headings, problems: [...(both ? [both] : []), ...previewProblems(data.sections)] };
}

/** The message for a post written both ways, or undefined. An empty `sections` list (what the form writes by default) is not sections. */
export function bodyAndSectionsProblem(data: Data): string | undefined {
  const blocks = Array.isArray(data.sections) ? data.sections.length : 0;
  return blocks && str(data.body).trim() ? BOTH_MESSAGE : undefined;
}

/** The Decap `preSave` handler: refuses to save a post that has both sections and a Body, with the reason. */
export function bodyOrSectionsCheck({ entry }: { entry: { get(key: string): unknown } }): undefined {
  const data = (entry.get('data') as { toJS?: () => Data } | undefined)?.toJS?.() ?? {};
  const problem = bodyAndSectionsProblem(data);
  if (problem) throw new Error(`Not saved. ${problem}`);
  return undefined;
}
