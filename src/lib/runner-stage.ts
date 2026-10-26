// The 404 page's game stage (src/components/RunnerStage.astro, docs/RUNNER.md "On the 404 page"): the small decisions that
// need no DOM, so they can be unit-tested. Dependency free: the stage's script imports this, and three.js stays in the lazy chunk.

/** What the page knows about the visitor's connection (navigator.connection; absent in Firefox and Safari). */
export interface ConnectionInfo {
  saveData?: boolean;
  effectiveType?: string;
}

/** Words for the play button: "Tap to play" on a touch screen, "Press space to play" otherwise. */
export function useTouchWords(coarsePointer: boolean, activatedBy?: string): boolean {
  return coarsePointer || activatedBy === 'touch';
}

/**
 * Whether the page may quietly download the game before anyone asks for it. Never on data-saver or a 2G connection, and only
 * when the stage is within a screen of the viewport (a visitor who has not scrolled near it is not about to play).
 */
export function shouldPrefetch(opts: { nearViewport: boolean; connection?: ConnectionInfo | null }): boolean {
  const { nearViewport, connection } = opts;
  if (!nearViewport) return false;
  if (connection?.saveData) return false;
  const type = connection?.effectiveType;
  return !(type === 'slow-2g' || type === '2g');
}

/** How a visitor woke the stage: Enter loads the game and stops on the idle scene; a click, tap or Space also starts a run. */
export function startsRun(key: string | null): boolean {
  return key !== 'Enter';
}
