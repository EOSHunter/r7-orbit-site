// Astro-bound feed loaders: turn published posts into RSS items. The XML itself is built by feed.ts.
import { getContainerRenderer as mdxRenderer } from '@astrojs/mdx/container-renderer';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { render } from 'astro:content';
import sanitizeHtml from 'sanitize-html';
import { site } from '../data/site';
import { articleComponents } from './article-components';
import { getAllPosts, getPosts, type SitePost } from './content-queries';
import type { CollectionName } from './content';
import { postUrl } from './content';
import { absolutizeHtml, buildRss, type FeedItem } from './feed';
import { absoluteUrl, plainTitle } from './text';

/** Feed titles per kind, matching the nav labels. */
const KIND_LABEL: Record<CollectionName, string> = {
  news: 'News',
  blog: 'Blog',
  vlogs: 'Vlogs',
  projects: 'Projects',
  repos: 'Repos',
};

export const FEED_KINDS = Object.keys(KIND_LABEL) as CollectionName[];

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Rendered post body, with the site's own widgets (copy buttons, heading anchors) and any scripts stripped. */
async function bodyHtml(post: SitePost, container: AstroContainer): Promise<string> {
  const { Content } = await render(post.entry);
  const html = await container.renderToString(Content, { props: { components: articleComponents } });
  // Page chrome (heading anchors, the code block bar with its copy button) means nothing in a feed reader.
  const content = html
    .replace(/<a class="heading-anchor"[^>]*><\/a>/g, '')
    .replace(/<div class="codeblock-bar">[\s\S]*?<\/button><\/div>/g, '');
  const clean = sanitizeHtml(content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'figure', 'figcaption', 'details', 'summary']),
    allowedAttributes: { a: ['href'], img: ['src', 'alt', 'width', 'height'], th: ['align'], td: ['align'] },
  });
  return absolutizeHtml(clean, site.url);
}

function videoLink(post: SitePost): string | undefined {
  const data = post.data as { youtubeId?: string; videoUrl?: string };
  return data.youtubeId ? `https://www.youtube.com/watch?v=${data.youtubeId}` : data.videoUrl;
}

async function toItem(post: SitePost, container: AstroContainer): Promise<FeedItem> {
  const link = absoluteUrl(postUrl(post), site.url);
  const summary = post.data.summary as string;
  const data = post.data as { sourceName?: string; sourceUrl?: string };
  let contentHtml: string | undefined;

  if (post.collection === 'blog') {
    contentHtml = await bodyHtml(post, container);
  } else if (post.collection === 'news' && data.sourceUrl) {
    const name = escapeHtml(data.sourceName ?? data.sourceUrl);
    contentHtml = `<p>Source: <a href="${escapeHtml(data.sourceUrl)}">${name}</a></p><p>${escapeHtml(summary)}</p>`;
  } else if (post.collection === 'vlogs') {
    const video = videoLink(post);
    contentHtml = `<p>${escapeHtml(summary)}</p>${video ? `<p><a href="${escapeHtml(video)}">Watch the video</a></p>` : ''}`;
  }

  return {
    title: plainTitle(post.data.title),
    link,
    date: post.data.date,
    description: descriptionFor(post, summary),
    contentHtml,
    categories: post.data.tags,
  };
}

/** News items start with "Source: …" (docs/PAGES.md). */
function descriptionFor(post: SitePost, summary: string): string {
  const data = post.data as { sourceName?: string };
  return post.collection === 'news' && data.sourceName ? `Source: ${data.sourceName}. ${summary}` : summary;
}

/** The RSS XML for one kind, or for everything when `kind` is omitted. */
export async function feedXml(kind?: CollectionName): Promise<string> {
  const posts = kind ? await getPosts(kind) : await getAllPosts();
  // The MDX renderer is what lets the container render a post that uses the article components.
  const container = await AstroContainer.create({ renderers: await loadRenderers([mdxRenderer()]) });
  const items = await Promise.all(posts.slice(0, 50).map((post) => toItem(post, container)));
  const path = kind ? `/${kind}/rss.xml` : '/rss.xml';
  return buildRss(
    {
      title: kind ? `${site.name} · ${KIND_LABEL[kind]}` : site.name,
      description: kind ? `${KIND_LABEL[kind]} from ${site.name}. ${site.description}` : site.description,
      link: absoluteUrl(kind ? `/${kind}/` : '/', site.url),
      selfUrl: new URL(path, site.url).href,
    },
    items,
  );
}

export const xmlResponse = (body: string, type = 'application/xml') =>
  new Response(body, { headers: { 'Content-Type': `${type}; charset=utf-8` } });
