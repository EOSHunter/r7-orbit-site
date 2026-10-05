// Reads a site page's entry (src/content/pages/<id>.md) for the page that draws it, and stops the build with a readable message
// when the file is missing or lacks a field its page needs (site-pages.ts). Build time only.
import { getEntry, type CollectionEntry } from 'astro:content';
import { pageProblems, sitePage, type SitePage } from './site-pages';

export type PageData = CollectionEntry<'pages'>['data'];

/** The entry's words with the ones `pageProblems` has checked as present read as strings (an empty optional box is ''). */
export interface LoadedPage extends SitePage {
  data: PageData;
  /** A text field, '' when not set. */
  text(field: 'eyebrow' | 'lead' | 'emptyHeading' | 'emptyText' | 'emptyLinkLabel' | 'soonEyebrow' | 'soonTitle' | 'soonText'): string;
}

export async function loadSitePage(id: string): Promise<LoadedPage> {
  const page = sitePage(id);
  const entry = await getEntry('pages', id);
  if (!entry) throw new Error(`src/content/pages/${id}.md is missing: ${page.path} is built from it (docs/CONTENT_MODEL.md, "Pages").`);
  const problems = pageProblems(page, entry.data as unknown as Record<string, unknown>);
  if (problems.length) throw new Error(problems.join('\n'));
  return { ...page, data: entry.data, text: (field) => entry.data[field] ?? '' };
}

/** The words of the Games hub's empty state and its "more games coming" card (GamesSection). */
export interface GamesCopy {
  emptyHeading: string;
  emptyText: string;
  emptyLinkLabel: string;
  soonEyebrow: string;
  soonTitle: string;
  soonText: string;
}

export const gamesCopy = (page: LoadedPage): GamesCopy => ({
  emptyHeading: page.text('emptyHeading'),
  emptyText: page.text('emptyText'),
  emptyLinkLabel: page.text('emptyLinkLabel'),
  soonEyebrow: page.text('soonEyebrow'),
  soonTitle: page.text('soonTitle'),
  soonText: page.text('soonText'),
});
