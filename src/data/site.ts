import data from './site.json';
import { parseSite, type SiteSettings } from '../lib/site-settings';

/**
 * Site-wide settings, edited in /admin under "Site settings" (src/admin/settings.ts) except `url`, which stays in code.
 * Checked against the schema in src/lib/site-settings.ts on import: a bad edit fails the build and names the field.
 * Placeholders the author still has to fill in are listed in docs/DECISIONS.md §A.
 */
export type SiteConfig = SiteSettings;

export const site: SiteConfig = parseSite(data);
