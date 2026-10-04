import { site } from '../data/site';
import { buildRobots } from '../lib/sitemap';

export function GET() {
  return new Response(buildRobots(site.url), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
