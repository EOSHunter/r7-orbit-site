import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Schema from docs/CONTENT_MODEL.md. `.strict()` turns a misspelt field into a readable build error
// instead of silently dropping it.

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use lowercase words joined with hyphens, e.g. "ai-agents"');
const ownerName = z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'use the form "owner/name"');
const isoDate = z.coerce.date({ error: 'use a date like 2026-10-03' });

const common = {
  title: z.string().min(1).max(90),
  date: isoDate,
  updated: isoDate.optional(),
  summary: z.string().min(1).max(180),
  tags: z.array(slug).max(6).default([]),
  cover: z.string().optional(),
  coverAlt: z.string().optional(),
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
  readTime: z.number().int().positive().optional(),
  author: z.string().optional(),
  canonicalUrl: z.url().optional(),
  aiAssist: z.enum(['none', 'edited', 'drafted']).optional(),
};

type ImageHelper = Parameters<Extract<Parameters<typeof defineCollection>[0]['schema'], (...args: never[]) => unknown>>[0]['image'];

function collection(
  dir: string,
  extra: z.ZodRawShape | ((image: ImageHelper) => z.ZodRawShape) = {},
  refine?: (data: Record<string, unknown>, ctx: z.RefinementCtx) => void,
) {
  return defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: `./src/content/${dir}` }),
    schema: ({ image }) =>
      z
        .object({ ...common, ...(typeof extra === 'function' ? extra(image) : extra) })
        .strict()
        .superRefine((data, ctx) => {
          if (data.cover && data.coverAlt === undefined) {
            ctx.addIssue({
              code: 'custom',
              path: ['coverAlt'],
              message: 'coverAlt is required when cover is set (use "" only for a decorative image)',
            });
          }
          refine?.(data, ctx);
        }),
  });
}

export const collections = {
  news: collection('news', {
    sourceUrl: z.url(),
    sourceName: z.string().min(1),
    take: z.string().optional(),
  }),
  blog: collection(
    'blog',
    (image) => ({
      series: z.string().optional(),
      seriesOrder: z.number().int().positive().optional(),
      toc: z.boolean().optional(),
      // Optional hero background behind the breadcrumbs and headline: a file under src/assets/, optimised at build time.
      featuredImage: image().optional(),
      featuredImageAlt: z.string().optional(),
    }),
    (data, ctx) => {
      if (data.featuredImage && data.featuredImageAlt === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['featuredImageAlt'],
          message: 'featuredImageAlt is required when featuredImage is set (use "" only for a decorative image)',
        });
      }
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
      transcript: z.boolean().optional(),
    },
    (data, ctx) => {
      if (!data.youtubeId && !data.videoUrl) {
        ctx.addIssue({ code: 'custom', path: ['youtubeId'], message: 'set youtubeId or videoUrl' });
      }
    },
  ),
  projects: collection('projects', {
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
  }),
  repos: collection('repos', {
    repo: ownerName,
    homepage: z.url().optional(),
    readme: z.enum(['github', 'local']).default('github'),
    install: z.string().optional(),
    relatedProject: z.string().optional(),
  }),
};
