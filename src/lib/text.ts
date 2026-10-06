/** Titles mark one italic-brass phrase with *asterisks*. Outside the page body (cards, <title>, og:title) the markers go. */
export function plainTitle(title: string): string {
  return title.replace(/\*/g, '');
}

/** Split a title into plain and emphasised runs, for the h1 where the phrase is set in italic brass. */
export function titleParts(title: string): { text: string; em: boolean }[] {
  return title
    .split(/\*([^*]+)\*/)
    .map((text, i) => ({ text, em: i % 2 === 1 }))
    .filter((part) => part.text !== '');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(date: Date | string): { y: number; m: number; d: number } {
  // ISO dates in files (YYYY-MM-DD) are read as calendar dates, so the timezone of the build machine never shifts the day.
  const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T00:00:00Z`) : date;
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
}

/** `Oct 3` (card footers). */
export function shortDate(date: Date | string): string {
  const p = parts(date);
  return `${MONTHS[p.m]} ${p.d}`;
}

/** `Oct 3, 2026` (the UI's house format). */
export function longDate(date: Date | string): string {
  const p = parts(date);
  return `${MONTHS[p.m]} ${p.d}, ${p.y}`;
}

/** `2026-10-03`, for <time datetime> and data-date. */
export function isoDate(date: Date | string): string {
  const p = parts(date);
  return `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** Absolute URL with a trailing slash on paths, for canonical and Open Graph. */
export function absoluteUrl(path: string, base: string): string {
  const url = new URL(path, base);
  const last = url.pathname.split('/').pop() ?? '';
  if (!url.pathname.endsWith('/') && !last.includes('.')) url.pathname += '/';
  return url.href;
}
