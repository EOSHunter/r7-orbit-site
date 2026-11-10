// Pure part of scripts/newsletter-week.mjs: which posts went up between two dates, grouped the way a newsletter issue lists them.

/** The kinds an issue lists, in its order, with the heading each gets. */
export const NEWSLETTER_KINDS = [
  { collection: 'news', heading: 'News' },
  { collection: 'blog', heading: 'Blog' },
  { collection: 'vlogs', heading: 'Videos' },
  { collection: 'projects', heading: 'Projects' },
  { collection: 'repos', heading: 'Repos' },
];

const dayOf = (value) => (value instanceof Date ? value.toISOString() : String(value ?? '')).slice(0, 10);
/** A title as text: the *italic* markers taken out. */
const plain = (title) => String(title ?? '').replace(/\*/g, '');

/**
 * The published posts dated from `from` to `to` (both included, YYYY-MM-DD), newest first within each kind, as Markdown:
 * one heading per kind, one line per post with its absolute link and its summary. "Nothing went up" when the range is empty.
 * @param {{ collection: string, id: string, data: Record<string, unknown> }[]} posts
 * @param {{ from: string, to: string, today: string, site: string }} range
 */
export function weekItems(posts, { from, to, today, site }) {
  const shown = posts.filter((post) => {
    const date = dayOf(post.data.date);
    return post.data.draft !== true && date >= from && date <= to && date <= today;
  });
  const parts = [`Published from ${from} to ${to}: ${shown.length} ${shown.length === 1 ? 'post' : 'posts'}.`];
  for (const kind of NEWSLETTER_KINDS) {
    const items = shown
      .filter((post) => post.collection === kind.collection)
      .sort((a, b) => dayOf(b.data.date).localeCompare(dayOf(a.data.date)));
    if (!items.length) continue;
    parts.push(
      `\n## ${kind.heading}\n`,
      ...items.map((post) =>
        `- [${plain(post.data.title)}](${site}/${post.collection}/${post.id}/) (${dayOf(post.data.date)}${post.data.author ? `, ${post.data.author}` : ''}): ${post.data.summary ?? ''}`.trim(),
      ),
    );
  }
  if (!shown.length) parts.push('Nothing went up in that range.');
  return parts.join('\n');
}
