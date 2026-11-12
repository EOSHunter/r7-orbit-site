// R7 Orbit's patch notes as data (src/data/r7-orbit-patch-notes.json), for the scrolling panel in the series post about its
// releases (src/components/PatchNotesPanel.astro). The panel's "as of" line comes from the newest release here, so adding a
// release to the data updates the date without touching the post.

export interface PatchItem {
  /** The bold headline of a change, or null for a change written as one plain sentence. */
  title: string | null;
  body: string;
}

export interface PatchSection {
  /** New, Improvements, Fixes, Changes, Heads up, Also in this version; null when a release lists its changes directly. */
  heading: string | null;
  items: PatchItem[];
}

export interface PatchRelease {
  version: string;
  /** ISO date, 2026-10-24. */
  date: string;
  sections: PatchSection[];
}

export interface PatchNotes {
  source: string;
  releases: PatchRelease[];
}

export interface PatchSummary {
  latest: PatchRelease;
  first: PatchRelease;
  releases: number;
  changes: number;
}

export function changeCount(release: PatchRelease): number {
  return release.sections.reduce((n, s) => n + s.items.length, 0);
}

/** The newest and oldest release (by date; on the same day, the one listed first is the newer) and the totals. */
export function summarise(notes: PatchNotes): PatchSummary {
  if (notes.releases.length === 0) throw new Error('patch notes: no releases');
  let latest = notes.releases[0];
  let first = notes.releases[0];
  for (const r of notes.releases) {
    if (r.date > latest.date) latest = r;
    if (r.date <= first.date) first = r;
  }
  return {
    latest,
    first,
    releases: notes.releases.length,
    changes: notes.releases.reduce((n, r) => n + changeCount(r), 0),
  };
}

/** A fragment id for a release: 0.14.2 -> patch-0-14-2. */
export function releaseId(version: string): string {
  return 'patch-' + version.replace(/[^0-9a-z]+/gi, '-');
}
