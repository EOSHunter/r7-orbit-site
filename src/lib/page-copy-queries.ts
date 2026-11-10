// Reads one of the fixed-frame pages from src/content/pages/ (privacy, 404, search, ascent, newsletter) and gets it ready to draw: tokens
// filled from src/data/site.json, conditional blocks chosen, and every block prepared (Markdown rendered, pictures measured).
// Build time only (astro:content). The pure part is page-copy.ts.
import { getEntry } from 'astro:content';
import { site } from '../data/site';
import { newsletterSettings } from './newsletter-queries';
import { fillPage, pageSettingsOf } from './page-copy';
import { prepareSections } from './sections/prepare';

export async function loadPage(id: 'privacy' | '404' | 'search' | 'ascent' | 'newsletter') {
  const source = `${id}.md`;
  const entry = await getEntry('pages', id);
  if (!entry) throw new Error(`src/content/pages/${source} is missing: the page is built from it.`);
  const data = fillPage(entry.data, pageSettingsOf({ ...site, newsletter: newsletterSettings }), source);
  const contexts = await prepareSections(data.sections, source);
  return { ...data, contexts };
}
