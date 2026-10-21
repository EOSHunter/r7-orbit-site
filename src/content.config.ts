import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import site from './data/site.json';
import { APP_TYPE_IDS } from './lib/app-types';
import { sectionsSchema } from './lib/sections';
import { DEFAULT_AUTHOR } from './lib/authors';
import { missingAlt, normaliseFrontMatter } from './lib/front-matter';
import { seoTitleMax } from './lib/seo';
import { sitePageFields } from './lib/site-pages';

// Schema from docs/CONTENT_MODEL.md. `.strict()` turns a misspelt field into a readable build error
// instead of silently dropping it.
//
// Every collection reads its front matter through `frontMatter`: a blank optional field (`cover: ''`, `seoTitle: ''`, `poster:`),
// which is what the admin writes for a box the author cleared, is not set, and an alt text without its picture is dropped
// (src/lib/front-matter.ts). A real picture still needs its alt key: `missingAlt` fails the build with a readable message.
const frontMatter = <T extends z.ZodType>(shape: z.ZodRawShape, schema: T) => z.preprocess(normaliseFrontMatter(shape), schema);

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use lowercase words joined with hyphens, e.g. "ai-agents"');
const ownerName = z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'use the form "owner/name"');
const isoDate = z.coerce.date({ error: 'use a date like 2026-10-03' });

const seoTitleLimit = seoTitleMax(site.name);

// Optional shorter title for the browser tab, search results and og:title; the page headline and JSON-LD keep `title`.
const seoTitle = z
  .string()
  .min(1)
  .max(seoTitleLimit, `seoTitle is too long: at most ${seoTitleLimit} characters, so "· ${site.name}" still fits in 60`)
  .optional();

const common = {
  title: z.string().min(1).max(90),
  seoTitle,
  date: isoDate,
  updated: isoDate.optional(),
  summary: z.string().min(1).max(180),
  tags: z.array(slug).max(6).default([]),
  cover: z.string().optional(),
  coverAlt: z.string().optional(),
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
  // The waitlist band for R7 Orbit after the body (src/components/WaitlistForm.astro). Drawn only while the waitlist is on in the
  // site settings; off by default.
  waitlist: z.boolean().default(false),
  readTime: z.number().int().positive().optional(),
  // Who the post is credited to: the slug of a file in src/content/authors/. `prefault` runs the default through `reference`, so an
  // absent field reads as { collection: 'authors', id: 'hunter-newton' }. That the slug exists is checked in lib/content-queries.ts.
  author: reference('authors').prefault(DEFAULT_AUTHOR),
  canonicalUrl: z.url().optional(),
  aiAssist: z.enum(['none', 'edited', 'drafted']).optional(),
  // The body written as blocks: the shared library of src/lib/sections/ (docs/SECTIONS.md). Optional: absent or empty, the Markdown
  // under the front matter is the body, as before. A post with blocks must have no Markdown body; a schema does not see the body, so
  // getPosts() checks that rule (bodyConflict in src/lib/content.ts) and the build stops, naming the file.
  sections: sectionsSchema,
};

type ImageHelper = Parameters<Extract<Parameters<typeof defineCollection>[0]['schema'], (...args: never[]) => unknown>>[0]['image'];

function collection(
  dir: string,
  extra: z.ZodRawShape | ((image: ImageHelper) => z.ZodRawShape) = {},
  refine?: (data: Record<string, unknown>, ctx: z.RefinementCtx) => void,
) {
  return defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: `./src/content/${dir}` }),
    schema: ({ image }) => {
      const shape = { ...common, ...(typeof extra === 'function' ? extra(image) : extra) };
      return frontMatter(
        shape,
        z
          .object(shape)
          .strict()
          .superRefine((data, ctx) => {
            missingAlt(data, ctx);
            refine?.(data, ctx);
          }),
      );
    },
  });
}

// Pages made of blocks (docs/CONTENT_MODEL.md "Pages"): About (src/content/pages/about.md), and the home page, the archives, the
// Apps hub and the tag index (`sitePageFields`, src/lib/site-pages.ts, which also says which page needs which field). The
// blocks are the shared library in src/lib/sections/ (docs/SECTIONS.md): `sectionsSchema` is what any collection attaches to take a `sections` list.
const pageShape = {
  title: z.string().min(1).max(90),
  seoTitle,
  // The meta description (docs/SEO_AND_SHARING.md): 155 characters reads best in search results.
  description: z.string().min(1).max(180),
  sections: sectionsSchema,
  ...sitePageFields,
};
const pages = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/pages' }),
  schema: frontMatter(pageShape, z.object(pageShape).strict()),
});

// The people and agents a post can be credited to (docs/CONTENT_MODEL.md "Authors"). The file name is the slug; `slug` repeats it
// so the editor can show it, and getAuthors() fails the build if the two differ. A person without `name`, `bio` or `avatar` is
// read from `author` in src/data/site.json, so Hunter's text exists once.
const authorShape = {
  slug,
  kind: z.enum(['person', 'agent']),
  name: z.string().min(1).optional(),
  subtitle: z.string().min(1).max(60).optional(),
  bio: z.string().min(1).optional(),
  avatar: z.string().optional(),
  // What the avatar shows, for a picture that is more than a mark (docs/TEAM.md, "Avatars (to do)"). Read where the avatar is shown
  // large (the author's page, the Team block); in a byline the picture sits beside the name and stays decorative.
  avatarAlt: z.string().min(1).optional(),
};
// `note` was the agent's footer note, removed on 2026-10-21 (docs/DECISIONS.md). An old author file that still has one builds:
// the key is dropped before the strict check, and nothing reads it.
const withoutRetiredNote = (data: unknown) => {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !('note' in data)) return data;
  const rest: Record<string, unknown> = { ...data };
  delete rest.note;
  return rest;
};
const normaliseAuthor = normaliseFrontMatter(authorShape);
const authors = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/authors' }),
  schema: () =>
    z.preprocess(
      (data: unknown) => normaliseAuthor(withoutRetiredNote(data)),
      z
        .object(authorShape)
        .strict()
        .superRefine((data, ctx) => {
          if (data.kind !== 'agent') return;
          for (const key of ['name', 'bio'] as const) {
            if (!data[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required for an agent (only a person is read from site.json)` });
          }
        }),
    ),
});

const posts = {
  news: collection('news', {
    sourceUrl: z.url(),
    sourceName: z.string().min(1),
    take: z.string().optional(),
  }),
  blog: collection(
    'blog',
    (image) => ({
      subtitle: z.string().max(140).optional(),
      series: z.string().optional(),
      seriesOrder: z.number().int().positive().optional(),
      toc: z.boolean().optional(),
      // Optional hero background behind the breadcrumbs and headline: a file under src/assets/, optimised at build time.
      featuredImage: image().optional(),
      featuredImageAlt: z.string().optional(),
    }),
    (data, ctx) => {
      if (data.series && data.seriesOrder === undefined) {
        ctx.addIssue({ code: 'custom', path: ['seriesOrder'], message: 'seriesOrder is required when series is set' });
      }
    },
  ),
  vlogs: collection(
    'vlogs',
    {
      youtubeId: z.string().length(11, 'a YouTube id is 11 characters').optional(),
      videoUrl: z.url().optional(),
      duration: z.string().regex(/^(\d+:)?\d{1,2}:\d{2}$/, 'use m:ss or h:mm:ss, e.g. "12:48"'),
      poster: z.string().optional(),
      chapters: z
        .array(z.object({ t: z.string().regex(/^(\d+:)?\d{1,2}:\d{2}$/, 'use m:ss'), title: z.string() }))
        .optional(),
      // A Markdown body's transcript is its `## Transcript` part, which this switch labels.
      transcript: z.boolean().optional(),
      // A vlog written as sections has no Markdown body to hold one: its transcript is this Markdown text, shown folded the same way.
      transcriptText: z.string().optional(),
    },
    (data, ctx) => {
      if (!data.youtubeId && !data.videoUrl) {
        ctx.addIssue({ code: 'custom', path: ['youtubeId'], message: 'set youtubeId or videoUrl' });
      }
      const blocks = (data.sections as unknown[] | undefined)?.length ?? 0;
      if (typeof data.transcriptText === 'string' && data.transcriptText.trim() && !blocks) {
        ctx.addIssue({
          code: 'custom',
          path: ['transcriptText'],
          message: 'transcriptText is for a vlog written with sections. With a Markdown body, put the transcript under a "## Transcript" heading in the body and set transcript: true',
        });
      }
      if (data.transcript === true && blocks) {
        ctx.addIssue({
          code: 'custom',
          path: ['transcript'],
          message: 'transcript: true labels the "## Transcript" part of a Markdown body. A vlog written with sections keeps its transcript in transcriptText',
        });
      }
    },
  ),
  projects: collection(
    'projects',
    {
      status: z.enum(['idea', 'building', 'shipped', 'paused', 'archived']),
      stack: z.array(z.string()).default([]),
      liveUrl: z.url().optional(),
      repoUrl: z.url().optional(),
      repo: ownerName.optional(),
      started: isoDate.optional(),
      shipped: isoDate.optional(),
      role: z.string().optional(),
      gallery: z.array(z.object({ src: z.string(), alt: z.string(), caption: z.string().optional() })).default([]),
      timeline: z.array(z.object({ date: isoDate, text: z.string() })).default([]),
      // Playable projects (a game or an app hosted on its own address). All optional: without playUrl nothing changes.
      playUrl: z.url({ protocol: /^https$/, error: 'use a full https:// address' }).optional(),
      playMode: z.enum(['embed', 'link']).default('embed'),
      playAspect: z
        .string()
        .regex(/^[1-9]\d{0,2}:[1-9]\d{0,2}$/, 'use width:height, e.g. "16:9"')
        .default('16:9'),
      controls: z.array(z.object({ key: z.string().min(1), action: z.string().min(1) })).default([]),
      playNote: z.string().min(1).max(120).optional(),
      platforms: z.array(z.enum(['desktop', 'mobile'])).default([]),
      // Where this project sits on /apps/: lower comes first; those without it follow, newest first.
      order: z.number().optional(),
      // What it is on /apps/ (the type chip, the filter, the button's word, the structured data). The values are APP_TYPES
      // (src/lib/app-types.ts); a playable project without it is an app.
      appType: z.enum(APP_TYPE_IDS, { error: `use one of: ${APP_TYPE_IDS.join(', ')}` }).optional(),
    },
    (data, ctx) => {
      if (!data.playUrl) {
        const orphan =
          ['controls', 'platforms'].find((k) => (data[k] as unknown[] | undefined)?.length) ??
          (data.playNote ? 'playNote' : undefined) ??
          (data.order !== undefined ? 'order' : undefined) ??
          (data.appType !== undefined ? 'appType' : undefined);
        if (orphan) ctx.addIssue({ code: 'custom', path: [orphan], message: `${orphan} needs playUrl: it only shows on a playable project` });
      }
    },
  ),
  repos: collection('repos', {
    repo: ownerName,
    homepage: z.url().optional(),
    readme: z.enum(['github', 'local']).default('github'),
    install: z.string().optional(),
    relatedProject: z.string().optional(),
  }),
};

// The tests' fixtures: one post per kind written as sections, in tests/fixtures/posts/<kind>/, read through the same schema as the
// real kind and drawn by the same page components at /styleguide/posts/<kind>/ (noindex, unlinked, like the rest of the styleguide).
// Only getFixturePosts() reads them (src/lib/content-queries.ts): never an archive, the sitemap or search.
// The real kind's collection (schema and all), with only the folder its files are read from changed.
const fixture = <C extends (typeof posts)[keyof typeof posts]>(real: C, kind: keyof typeof posts): C => ({
  ...real,
  loader: glob({ pattern: '**/*.{md,mdx}', base: `./tests/fixtures/posts/${kind}` }),
});

export const collections = {
  authors,
  ...posts,
  fixtureNews: fixture(posts.news, 'news'),
  fixtureBlog: fixture(posts.blog, 'blog'),
  fixtureVlogs: fixture(posts.vlogs, 'vlogs'),
  fixtureProjects: fixture(posts.projects, 'projects'),
  fixtureRepos: fixture(posts.repos, 'repos'),
  pages,
};
