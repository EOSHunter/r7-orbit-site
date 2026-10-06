import { site } from '../data/site';
import { buildSitemapIndex, xmlResponse } from '../lib/sitemap';

// One sitemap file is plenty at this size; the index exists because docs/SEO_AND_SHARING.md names /sitemap-index.xml.
export function GET() {
  return xmlResponse(buildSitemapIndex(['/sitemap-0.xml'], site.url));
}
