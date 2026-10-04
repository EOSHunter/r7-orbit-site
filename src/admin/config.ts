// The Decap CMS configuration for /admin. The blog collection mirrors the schema in src/content.config.ts (which is
// strict: a field written here that the schema does not know fails the build), so change the two together.
import type { CmsCollection, CmsConfig, CmsField } from 'decap-cms-core';
import { ARTICLE_COMPONENT_NAMES } from '../lib/article-component-names';

export interface AdminEnv {
  /** `npm run dev`: edit the files on disk through the local proxy (`npm run cms`), no sign-in. */
  local: boolean;
  /** `owner/name` of the GitHub repository the posts are committed to. */
  repo: string;
  branch: string;
  /** Base URL of the OAuth proxy that signs the author in to GitHub (see README "Admin"). Unused when `local`. */
  authUrl?: string;
}

// Two homes for images, matching how the site uses them:
// - the featured image is an Astro `image()` (optimised at build time), so it lives in src/assets/blog/ and is written
//   as a path relative to the post;
// - images in the body and in the article blocks (Figure, ImageGallery) are plain local files that the components
//   reject if they are remote (src/lib/article.ts), so they live in public/media/ and are written as /media/x.jpg.
export const FEATURED_MEDIA_FOLDER = '/src/assets/blog';
export const FEATURED_PUBLIC_FOLDER = '../../assets/blog';
export const MEDIA_FOLDER = 'public/media';
export const PUBLIC_FOLDER = '/media';

// Same rules as the `slug` and `title`/`summary` checks in src/content.config.ts.
const TAG_PATTERN: [string, string] = [
  '^[a-z0-9]+(-[a-z0-9]+)*$',
  'Lowercase words joined with hyphens, e.g. ai-agents',
];
const TITLE_PATTERN: [string, string] = ['^.{1,90}$', 'Required, 90 characters at most'];
const SUBTITLE_PATTERN: [string, string] = ['^.{1,140}$', '140 characters at most'];
const SUMMARY_PATTERN: [string, string] = ['^.{1,180}$', 'Required, one line, 180 characters at most'];

const blogFields: CmsField[] = [
  {
    name: 'title',
    label: 'Title',
    widget: 'string',
    pattern: TITLE_PATTERN,
    hint: 'Sentence case. Put one phrase in *asterisks* for the italic brass accent.',
  },
  { name: 'subtitle', label: 'Subtitle', widget: 'string', required: false, pattern: SUBTITLE_PATTERN },
  {
    name: 'date',
    label: 'Date',
    widget: 'datetime',
    format: 'YYYY-MM-DD',
    date_format: 'YYYY-MM-DD',
    time_format: false,
    picker_utc: true,
    default: '{{now}}',
  },
  {
    name: 'summary',
    label: 'Summary',
    widget: 'text',
    pattern: SUMMARY_PATTERN,
    hint: 'Shown on cards, in search results and when the post is shared.',
  },
  {
    name: 'tags',
    label: 'Tags',
    widget: 'list',
    required: false,
    max: 6,
    default: [],
    hint: 'Up to six.',
    field: { name: 'tag', label: 'Tag', widget: 'string', pattern: TAG_PATTERN },
  } as CmsField,
  {
    name: 'featuredImage',
    label: 'Featured image',
    widget: 'image',
    choose_url: false,
    media_folder: FEATURED_MEDIA_FOLDER,
    public_folder: FEATURED_PUBLIC_FOLDER,
    required: false,
    hint: 'The hero behind the headline. Wide (16:9) and at least 1600px across. Your own image, not stock.',
  },
  {
    name: 'featuredImageAlt',
    label: 'Featured image alt text',
    widget: 'string',
    required: false,
    hint: 'Required when there is a featured image: the build stops without it.',
  },
  { name: 'featured', label: 'Feature on the home page', widget: 'boolean', default: false, required: false },
  {
    name: 'draft',
    label: 'Draft',
    widget: 'boolean',
    default: true,
    required: false,
    hint: 'Drafts are not published. Turn this off when the post is ready.',
  },
  {
    name: 'body',
    label: 'Body',
    widget: 'markdown',
    modes: ['rich_text', 'raw'],
    // No H1: the title is the page's one h1. Its image button and the blocks upload to MEDIA_FOLDER.
    buttons: [
      'bold',
      'italic',
      'code',
      'link',
      'heading-two',
      'heading-three',
      'quote',
      'bulleted-list',
      'numbered-list',
    ],
    editor_components: ['image', 'code-block', ...ARTICLE_COMPONENT_NAMES],
  },
];

export const blogCollection: CmsCollection = {
  name: 'blog',
  label: 'Blog posts',
  label_singular: 'Blog post',
  folder: 'src/content/blog',
  // `.mdx` so a body can hold the article components; existing `.md` posts keep working but are not listed here.
  extension: 'mdx',
  format: 'frontmatter',
  create: true,
  slug: '{{slug}}',
  identifier_field: 'title',
  summary: '{{title}} · {{date}}',
  sortable_fields: ['date', 'title'],
  fields: blogFields,
} as CmsCollection;

export function buildConfig(env: AdminEnv): CmsConfig {
  return {
    backend: env.local
      ? { name: 'github', repo: env.repo, branch: env.branch }
      : { name: 'github', repo: env.repo, branch: env.branch, base_url: env.authUrl, auth_endpoint: 'auth' },
    // `local_backend` talks to `npm run cms` (decap-server) and falls back to the backend above if it is not running.
    local_backend: env.local,
    // Each post becomes a pull request, so CI builds it (and checks the schema) before it can reach the live site.
    // The local proxy has no pull requests, so there every save writes the file directly.
    publish_mode: env.local ? undefined : 'editorial_workflow',
    // The config is this object, not an /admin/config.yml (which would be a 404).
    load_config_file: false,
    media_folder: MEDIA_FOLDER,
    public_folder: PUBLIC_FOLDER,
    editor: { preview: false },
    collections: [blogCollection],
  };
}
