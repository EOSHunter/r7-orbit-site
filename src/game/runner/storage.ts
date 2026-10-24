// The best score, kept only in the visitor's own browser (localStorage). Nothing is sent anywhere. Storage can be missing,
// full, or throw on access (private browsing, disabled cookies, a sandboxed frame): then the best score lives for the visit
// and the game never notices.

export const BEST_KEY = 'r7-runner-best';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** The page's localStorage, or null when reading the property itself throws. */
function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The saved best score, or 0 when there is none, it is unreadable, or storage is unavailable. */
export function loadBest(storage: () => StorageLike | null = defaultStorage): number {
  try {
    const raw = storage()?.getItem(BEST_KEY);
    const n = raw == null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Saves `score` if it beats the stored best. Returns the best score after the call (the new one even when saving failed). */
export function saveBest(score: number, storage: () => StorageLike | null = defaultStorage): number {
  const best = Math.max(loadBest(storage), Math.max(0, Math.floor(score)));
  try {
    if (best > 0) storage()?.setItem(BEST_KEY, String(best));
  } catch {
    // Storage full or blocked: keep the best for this visit only.
  }
  return best;
}
