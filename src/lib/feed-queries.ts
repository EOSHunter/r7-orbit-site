// Astro-bound feed loaders: turn published posts into RSS items. The XML itself is built by feed.ts. A post written as sections
// (docs/SECTIONS.md) gets its blocks as the item's body, read through the one projection (sections-to-content.ts) as Markdown.
import { getContainerRenderer as mdxRenderer } from '@astrojs/mdx/container-renderer';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { render } from 'astro:content';
import sanitizeHtml from 'sanitize-html';
import { site } from '../data/site';
import type { Section } from './sections';
import { hasSections, sectionsToMarkdown } from './sections-to-content';
import { FEED_HTML, renderFeedMarkdown } from './section-markdown';
import { articleComponents } from '../components/article/mdx';
import { authorSlugOf, type Author } from './authors';
import { getAuthorMap } from './authors-queries';
import { getAllPosts, getFixturePosts, getPosts, type SitePost } from './content-queries';
import type { CollectionName } from './content';
import { postUrl, sortByDateDesc } from './content';
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
  const clean = sanitizeHtml(content, FEED_HTML);
  return absolutizeHtml(clean, site.url);
}

/** A post's sections as the item's body: their Markdown, rendered and sanitised, with every address made absolute. */
async function sectionsBodyHtml(sections: readonly Section[]): Promise<string> {
  return absolutizeHtml(await renderFeedMarkdown(sectionsToMarkdown(sections)), site.url);
}

function videoLink(post: SitePost): string | undefined {
  const data = post.data as { youtubeId?: string; videoUrl?: string };
  return data.youtubeId ? `https://www.youtube.com/watch?v=${data.youtubeId}` : data.videoUrl;
}

async function toItem(
  post: SitePost,
  container: AstroContainer,
  authors: Map<string, Author>,
  path: (post: SitePost) => string = postUrl,
): Promise<FeedItem> {
  const link = absoluteUrl(path(post), site.url);
  const summary = post.data.summary as string;
  const data = post.data as { sourceName?: string; sourceUrl?: string };
  let contentHtml: string | undefined;
  // Written as sections: the blocks are the body, in every kind (a Markdown body is only in the blog's items, as before). A news item
  // still opens with its source and a vlog still ends with the link to the video.
  const sections = hasSections(post.data) ? await sectionsBodyHtml(post.data.sections ?? []) : undefined;

  if (post.collection === 'blog') {
    contentHtml = sections ?? (await bodyHtml(post, container));
  } else if (post.collection === 'news' && data.sourceUrl) {
    const name = escapeHtml(data.sourceName ?? data.sourceUrl);
    contentHtml = `<p>Source: <a href="${escapeHtml(data.sourceUrl)}">${name}</a></p>${sections ?? `<p>${escapeHtml(summary)}</p>`}`;
  } else if (post.collection === 'vlogs') {
    const video = videoLink(post);
    contentHtml = `${sections ?? `<p>${escapeHtml(summary)}</p>`}${video ? `<p><a href="${escapeHtml(video)}">Watch the video</a></p>` : ''}`;
  } else if (sections) {
    contentHtml = sections;
  }

  return {
    title: plainTitle(post.data.title),
    link,
    date: post.data.date,
    description: descriptionFor(post, summary),
    contentHtml,
    categories: post.data.tags,
    creator: authors.get(authorSlugOf(post))?.name,
  };
}

/** News items start with "Source: …" (docs/PAGES.md). */
function descriptionFor(post: SitePost, summary: string): string {
  const data = post.data as { sourceName?: string };
  return post.collection === 'news' && data.sourceName ? `Source: ${data.sourceName}. ${summary}` : summary;
}

/** The items of a feed: the newest 50 of `posts`, each linking to `path(post)`. */
async function feedItems(posts: SitePost[], path?: (post: SitePost) => string): Promise<FeedItem[]> {
  // The MDX renderer is what lets the container render a post that uses the article components.
  const container = await AstroContainer.create({ renderers: await loadRenderers([mdxRenderer()]) });
  const authors = await getAuthorMap();
  return Promise.all(posts.slice(0, 50).map((post) => toItem(post, container, authors, path)));
}

/** The RSS XML for one kind, or for everything when `kind` is omitted. */
export async function feedXml(kind?: CollectionName): Promise<string> {
  const posts = kind ? await getPosts(kind) : await getAllPosts();
  const items = await feedItems(posts);
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

/** Where the tests' fixture post of a kind is drawn (src/pages/styleguide/posts/[kind].astro). */
export const fixturePath = (post: Pick<SitePost, 'collection'>) => `/styleguide/posts/${post.collection}/`;

/**
 * The tests' feed: the fixture posts of every kind (tests/fixtures/posts/), built by the same code as the site's feeds, each item
 * linking to its fixture page. Served at /styleguide/posts/rss.xml for tests/post-sections.spec.js; not linked, not a feed of the site.
 */
export async function fixtureFeedXml(): Promise<string> {
  const posts = sortByDateDesc((await Promise.all(FEED_KINDS.map((kind) => getFixturePosts(kind)))).flat());
  const items = await feedItems(posts, fixturePath);
  return buildRss(
    {
      title: `${site.name} · Fixtures`,
      description: 'The fixture posts of the tests, one per kind, written as sections. Not part of the site.',
      link: absoluteUrl('/styleguide/', site.url),
      selfUrl: new URL('/styleguide/posts/rss.xml', site.url).href,
    },
    items,
  );
}

export const xmlResponse = (body: string, type = 'application/xml') =>
  new Response(body, { headers: { 'Content-Type': `${type}; charset=utf-8` } });
