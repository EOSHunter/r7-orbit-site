// Reads a site page's entry (src/content/pages/<id>.md) for the page that draws it, with the settings tokens (`{site.tagline}`,
// `{site.description}`, …: src/lib/page-copy.ts) filled from src/data/site.json, and stops the build with a readable message when
// the file is missing or lacks a field its page needs (site-pages.ts). Build time only.
import { getEntry, type CollectionEntry } from 'astro:content';
import { site } from '../data/site';
import { newsletterSettings } from './newsletter-queries';
import { fillValue, pageSettingsOf } from './page-copy';
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
  const data = fillValue(entry.data, pageSettingsOf({ ...site, newsletter: newsletterSettings }), `${id}.md`) as PageData;
  return { ...page, data, text: (field) => data[field] ?? '' };
}

/** The words of the Apps hub's empty state and its "more apps coming" card (AppsSection). */
export interface AppsCopy {
  emptyHeading: string;
  emptyText: string;
  emptyLinkLabel: string;
  soonEyebrow: string;
  soonTitle: string;
  soonText: string;
}

export const appsCopy = (page: LoadedPage): AppsCopy => ({
  emptyHeading: page.text('emptyHeading'),
  emptyText: page.text('emptyText'),
  emptyLinkLabel: page.text('emptyLinkLabel'),
  soonEyebrow: page.text('soonEyebrow'),
  soonTitle: page.text('soonTitle'),
  soonText: page.text('soonText'),
});
