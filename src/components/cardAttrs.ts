import type { CardData } from '../lib/cards';
import { isoDate, plainTitle } from '../lib/text';

/** The class list, link and (when filterable) the data-* attributes that site.js reads. */
export function cardAttrs(post: CardData): Record<string, string | undefined> {
  const classes = ['card', post.fresh && 'fresh', post.pinned && 'featured pinned'].filter(Boolean).join(' ');
  const attrs: Record<string, string | undefined> = { class: classes, href: post.href };
  if (post.filterable) {
    attrs['data-item'] = '';
    attrs['data-kind'] = post.kind;
    attrs['data-date'] = isoDate(post.date);
    attrs['data-title'] = plainTitle(post.title);
    attrs['data-text'] = post.summary;
    attrs['data-tags'] = (post.tags ?? []).join(' ');
  }
  return attrs;
}
