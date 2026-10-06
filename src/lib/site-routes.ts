// Build-only: checks that every link and picture in the site settings goes to a page or file this site has (siteLinkProblems in
// site-settings.ts), from the files under src/pages and public. BaseLayout calls it, and it runs once per build, so a nav link
// renamed in /admin to a page that does not exist fails the build with the field and the address, instead of a dead link.
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { siteLinkProblems, type SiteFiles, type SiteSettings } from './site-settings';

function filesUnder(dir: string): string[] {
  try {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(dir, join(entry.parentPath, entry.name)).replace(/\\/g, '/'));
  } catch {
    return [];
  }
}

/** The pages and public files of the checkout the build runs in. */
export function siteFiles(root = process.cwd()): SiteFiles {
  return {
    pages: filesUnder(join(root, 'src/pages')),
    publicFiles: filesUnder(join(root, 'public')).map((file) => `/${file}`),
  };
}

let checked = false;

/** Throws on a link to nowhere. Does the work once per build. */
export function checkSiteLinks(site: SiteSettings): void {
  if (checked) return;
  const problems = siteLinkProblems(site, siteFiles());
  if (problems.length) {
    throw new Error(
      `src/data/site.json (Site settings in /admin) links to something that does not exist:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
  checked = true;
}
