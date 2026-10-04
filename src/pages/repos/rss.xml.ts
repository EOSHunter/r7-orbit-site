import { feedXml, xmlResponse } from '../../lib/feed-queries';

export async function GET() {
  return xmlResponse(await feedXml('repos'), 'application/rss+xml');
}
