// RSS 2.0 builder, pure. The Astro-bound endpoints are in feed-queries.ts.
import { plainTitle } from './text';

export interface FeedItem {
  title: string;
  /** Absolute permalink; also the guid. */
  link: string;
  date: Date;
  description: string;
  /** Full HTML for `content:encoded` (blog posts, and the video link for vlogs). */
  contentHtml?: string;
  categories?: string[];
  /** The author's name, as `dc:creator` (RSS `author` needs an email address, which the site does not publish). */
  creator?: string;
}

export interface FeedChannel {
  title: string;
  description: string;
  /** Absolute URL of the page this feed belongs to. */
  link: string;
  /** Absolute URL of the feed itself, for `atom:link rel="self"`. */
  selfUrl: string;
  language?: string;
  lastBuildDate?: Date;
}

export const FEED_LIMIT = 50;

// Characters XML 1.0 forbids would make the whole feed unreadable.
// eslint-disable-next-line no-control-regex
const XML_FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

export function escapeXml(text: string): string {
  return text
    .replace(XML_FORBIDDEN, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** CDATA cannot contain `]]>`; split it across two sections. */
export function cdata(html: string): string {
  return `<![CDATA[${html.replace(XML_FORBIDDEN, '').replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;
}

/** RFC 822 date in GMT, as RSS wants. */
export function rfc822(date: Date): string {
  return date.toUTCString();
}

/** Turns `href="/x/"` and `src="/y.png"` in HTML into absolute URLs, because a feed reader has no base. */
export function absolutizeHtml(html: string, base: string): string {
  return html.replace(/\b(href|src)="(\/(?!\/)[^"]*)"/g, (_m, attr: string, path: string) => {
    return `${attr}="${new URL(path, base).href}"`;
  });
}

export function buildRss(channel: FeedChannel, items: FeedItem[], limit = FEED_LIMIT): string {
  const shown = [...items].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
  const built = channel.lastBuildDate ?? shown[0]?.date;
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '<channel>',
    `<title>${escapeXml(plainTitle(channel.title))}</title>`,
    `<link>${escapeXml(channel.link)}</link>`,
    `<description>${escapeXml(channel.description)}</description>`,
    `<language>${escapeXml(channel.language ?? 'en')}</language>`,
    built ? `<lastBuildDate>${rfc822(built)}</lastBuildDate>` : '',
    `<atom:link href="${escapeXml(channel.selfUrl)}" rel="self" type="application/rss+xml" />`,
  ];
  for (const item of shown) {
    lines.push(
      '<item>',
      `<title>${escapeXml(plainTitle(item.title))}</title>`,
      `<link>${escapeXml(item.link)}</link>`,
      `<guid isPermaLink="true">${escapeXml(item.link)}</guid>`,
      `<pubDate>${rfc822(item.date)}</pubDate>`,
      `<description>${escapeXml(item.description)}</description>`,
      item.creator ? `<dc:creator>${escapeXml(item.creator)}</dc:creator>` : '',
      ...(item.categories ?? []).map((c) => `<category>${escapeXml(c)}</category>`),
      item.contentHtml ? `<content:encoded>${cdata(item.contentHtml)}</content:encoded>` : '',
      '</item>',
    );
  }
  lines.push('</channel>', '</rss>');
  return `${lines.filter(Boolean).join('\n')}\n`;
}
