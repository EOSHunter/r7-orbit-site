import data from './site.json';

/** Site-wide settings. Every value is a placeholder until the owner answers docs/DECISIONS.md §A. */
export type SiteConfig = typeof data;

export const site: SiteConfig = data;
