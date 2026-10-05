// Fixture for tests/post-sections.spec.js: the feed of the tests' fixture posts (one per kind, written as sections), built by the same
// code as the site's feeds. Not linked, not a feed of the site (docs/SECTIONS.md "Posts").
import { fixtureFeedXml, xmlResponse } from '../../../lib/feed-queries';

export async function GET() {
  return xmlResponse(await fixtureFeedXml(), 'application/rss+xml');
}
