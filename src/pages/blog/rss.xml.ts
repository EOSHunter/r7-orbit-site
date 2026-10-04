import { feedXml, xmlResponse } from '../../lib/feed-queries';

export async function GET() {
  return xmlResponse(await feedXml('blog'), 'application/rss+xml');
}
