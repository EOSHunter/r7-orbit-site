// The Decap CMS configuration for /admin: one collection per content kind (blog, news, vlogs, projects, repos). Each one
// mirrors its schema in src/content.config.ts, which is strict: a field written here that the schema does not know fails
// the build, and a required schema field that is missing here makes every new post fail. Field names are the schema's
// own, and config.vitest.ts reads the real schema to keep the two in step, so change them together.
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
// - the blog featured image is an Astro `image()` (optimised at build time), so it lives in src/assets/blog/ and is
//   written as a path relative to the post;
// - every other image (covers, posters, gallery shots, images in a body and in the article blocks) is a plain local file
//   that the site serves as it is, so it lives in public/media/ and is written as /media/x.jpg.
export const FEATURED_MEDIA_FOLDER = '/src/assets/blog';
export const FEATURED_PUBLIC_FOLDER = '../../assets/blog';
export const MEDIA_FOLDER = 'public/media';
export const PUBLIC_FOLDER = '/media';

// The same rules as the checks in src/content.config.ts, as [regex, message] pairs for Decap's `pattern`.
const TAG_PATTERN: [string, string] = [
  '^[a-z0-9]+(-[a-z0-9]+)*$',
  'Lowercase words joined with hyphens, e.g. ai-agents',
];
const TITLE_PATTERN: [string, string] = ['^.{1,90}$', 'Required, 90 characters at most'];
const SUBTITLE_PATTERN: [string, string] = ['^.{1,140}$', '140 characters at most'];
const SUMMARY_PATTERN: [string, string] = ['^.{1,180}$', 'Required, one line, 180 characters at most'];
const URL_PATTERN: [string, string] = ['^https?://\\S+$', 'A full address, starting with https://'];
const OWNER_NAME_PATTERN: [string, string] = ['^[\\w.-]+/[\\w.-]+$', 'Use the form owner/name, e.g. EOSHunter/r7-orbit-site'];
const YOUTUBE_ID_PATTERN: [string, string] = [
  '^[\\w-]{11}$',
  'A YouTube id is exactly 11 characters (letters, digits, - and _), not the whole link',
];
const TIMESTAMP_PATTERN: [string, string] = ['^(\\d+:)?\\d{1,2}:\\d{2}$', 'Use m:ss or h:mm:ss, e.g. 12:48'];

const field = (f: Record<string, unknown>) => f as unknown as CmsField;

/** A date written as 2026-10-03, which is what the schema's `z.coerce.date()` reads. */
const dateField = (name: string, label: string, extra: Record<string, unknown> = {}) =>
  field({
    name,
    label,
    widget: 'datetime',
    format: 'YYYY-MM-DD',
    date_format: 'YYYY-MM-DD',
    time_format: false,
    picker_utc: true,
    ...extra,
  });

const urlField = (name: string, label: string, hint: string, required = false) =>
  field({ name, label, widget: 'string', required, pattern: URL_PATTERN, hint });

const repoField = (name: string, label: string, hint: string, required: boolean) =>
  field({ name, label, widget: 'string', required, pattern: OWNER_NAME_PATTERN, hint });

const imageField = (name: string, label: string, hint: string, extra: Record<string, unknown> = {}) =>
  field({ name, label, widget: 'image', choose_url: false, required: false, hint, ...extra });

// ---- Fields every collection has (the `common` block of the schema) -----------------------------------------------

const title = field({
  name: 'title',
  label: 'Title',
  widget: 'string',
  pattern: TITLE_PATTERN,
  hint: 'Sentence case. Put one phrase in *asterisks* for the italic brass accent.',
});
const date = dateField('date', 'Date', {
  default: '{{now}}',
  hint: 'The publish date. A date in the future keeps the post hidden until then.',
});
const updated = dateField('updated', 'Updated', {
  required: false,
  hint: 'Set this when the post is materially changed; the page then shows "Updated".',
});
const summary = field({
  name: 'summary',
  label: 'Summary',
  widget: 'text',
  pattern: SUMMARY_PATTERN,
  hint: 'Shown on cards, in search results and when the post is shared.',
});
const tags = field({
  name: 'tags',
  label: 'Tags',
  widget: 'list',
  required: false,
  max: 6,
  default: [],
  hint: 'Up to six. Reuse an existing tag before inventing one.',
  field: { name: 'tag', label: 'Tag', widget: 'string', pattern: TAG_PATTERN },
});
const cover = imageField(
  'cover',
  'Cover image',
  'Shown on the post and when it is shared. 16:9, at least 1280px across. Your own image, not stock. Without one the post shows the placeholder.',
);
const coverAlt = field({
  name: 'coverAlt',
  label: 'Cover image alt text',
  widget: 'string',
  required: false,
  hint: 'Required when there is a cover image: the build stops without it.',
});
const featured = field({
  name: 'featured',
  label: 'Feature on the home page',
  widget: 'boolean',
  default: false,
  required: false,
});
const draft = field({
  name: 'draft',
  label: 'Draft',
  widget: 'boolean',
  default: false,
  required: false,
  hint: 'A draft is left out of the site, archives, search, feeds and sitemap. Turn it on to hold a post back.',
});
const readTime = field({
  name: 'readTime',
  label: 'Reading time (minutes)',
  widget: 'number',
  value_type: 'int',
  min: 1,
  required: false,
  hint: 'Leave empty to have it worked out from the text.',
});
const author = field({
  name: 'author',
  label: 'Author',
  widget: 'string',
  required: false,
  hint: 'Leave empty for the site author.',
});
const canonicalUrl = urlField(
  'canonicalUrl',
  'Canonical URL',
  'Only if the post was first published elsewhere: search engines then credit that address.',
);
const aiAssist = field({
  name: 'aiAssist',
  label: 'AI help',
  widget: 'select',
  required: false,
  options: [
    { label: 'None', value: 'none' },
    { label: 'Written by me, edited with AI help', value: 'edited' },
    { label: 'First draft written with AI help', value: 'drafted' },
  ],
  hint: 'Adds a "How this was made" note to the post. Say so whenever AI wrote or edited any of it.',
});

// ---- Body ---------------------------------------------------------------------------------------------------------

// No H1: the title is the page's one h1.
const BODY_BUTTONS = [
  'bold',
  'italic',
  'code',
  'link',
  'heading-two',
  'heading-three',
  'quote',
  'bulleted-list',
  'numbered-list',
];

/** Blog bodies are MDX, so they can hold the article blocks. Everything else is plain Markdown. */
const body = (editorComponents: string[]) =>
  field({
    name: 'body',
    label: 'Body',
    widget: 'markdown',
    modes: ['rich_text', 'raw'],
    buttons: BODY_BUTTONS,
    editor_components: editorComponents,
  });

const plainBody = body(['image', 'code-block']);

// ---- Blog ---------------------------------------------------------------------------------------------------------

const blogFields: CmsField[] = [
  title,
  field({ name: 'subtitle', label: 'Subtitle', widget: 'string', required: false, pattern: SUBTITLE_PATTERN }),
  date,
  summary,
  tags,
  imageField(
    'featuredImage',
    'Featured image',
    'The hero behind the headline. Wide (16:9) and at least 1600px across. Your own image, not stock.',
    { media_folder: FEATURED_MEDIA_FOLDER, public_folder: FEATURED_PUBLIC_FOLDER },
  ),
  field({
    name: 'featuredImageAlt',
    label: 'Featured image alt text',
    widget: 'string',
    required: false,
    hint: 'Required when there is a featured image: the build stops without it.',
  }),
  cover,
  coverAlt,
  field({
    name: 'series',
    label: 'Series',
    widget: 'string',
    required: false,
    hint: 'The same name on every part of a series, written exactly alike. Then set the part number below.',
  }),
  field({
    name: 'seriesOrder',
    label: 'Part number in the series',
    widget: 'number',
    value_type: 'int',
    min: 1,
    required: false,
    hint: 'Required when there is a series: the build stops without it.',
  }),
  field({
    name: 'toc',
    label: 'Contents list',
    widget: 'boolean',
    required: false,
    hint: 'On or off. Leave it untouched to show a contents list only when there are three or more H2 headings.',
  }),
  featured,
  draft,
  updated,
  readTime,
  author,
  canonicalUrl,
  aiAssist,
  body(['image', 'code-block', ...ARTICLE_COMPONENT_NAMES]),
];

// ---- News ---------------------------------------------------------------------------------------------------------

const newsFields: CmsField[] = [
  title,
  date,
  summary,
  urlField('sourceUrl', 'Source URL', 'Where the story was first reported. Required.', true),
  field({
    name: 'sourceName',
    label: 'Source name',
    widget: 'string',
    hint: 'Who published it, e.g. the lab or the outlet. Required.',
  }),
  field({
    name: 'take',
    label: 'My take',
    widget: 'text',
    required: false,
    hint: 'Your one- or two-sentence read, shown beside the source link.',
  }),
  tags,
  cover,
  coverAlt,
  featured,
  draft,
  updated,
  readTime,
  author,
  canonicalUrl,
  aiAssist,
  plainBody,
];

// ---- Vlogs --------------------------------------------------------------------------------------------------------

const vlogFields: CmsField[] = [
  title,
  date,
  summary,
  field({
    name: 'youtubeId',
    label: 'YouTube video ID',
    widget: 'string',
    required: false,
    pattern: YOUTUBE_ID_PATTERN,
    hint: 'The 11 characters after v= in the video address (youtube.com/watch?v=dQw4w9WgXcQ), not the whole link. Fill in this or the video URL below: the build stops if both are empty. The video loads only when a reader presses play.',
  }),
  urlField(
    'videoUrl',
    'Video URL',
    'For a video that is not on YouTube: the page where it plays. Readers get a link to it. Leave empty when you set a YouTube ID.',
  ),
  field({
    name: 'duration',
    label: 'Duration',
    widget: 'string',
    pattern: TIMESTAMP_PATTERN,
    hint: 'Minutes and seconds, e.g. 12:48, or 1:02:30 for a long one. Required.',
  }),
  imageField(
    'poster',
    'Poster image',
    'The still shown before play. Falls back to the cover image. Your own image, not stock.',
  ),
  field({
    name: 'chapters',
    label: 'Chapters',
    widget: 'list',
    required: false,
    summary: '{{fields.t}} {{fields.title}}',
    hint: 'Optional. One line per chapter, in order.',
    fields: [
      field({ name: 't', label: 'Starts at', widget: 'string', pattern: TIMESTAMP_PATTERN, hint: 'm:ss, e.g. 5:15' }),
      field({ name: 'title', label: 'Chapter title', widget: 'string' }),
    ],
  }),
  field({
    name: 'transcript',
    label: 'Transcript below',
    widget: 'boolean',
    required: false,
    hint: 'Turn on when the body holds a transcript, so the page labels it as one.',
  }),
  tags,
  cover,
  coverAlt,
  featured,
  draft,
  updated,
  readTime,
  author,
  canonicalUrl,
  aiAssist,
  plainBody,
];

// ---- Projects -----------------------------------------------------------------------------------------------------

const projectFields: CmsField[] = [
  title,
  date,
  summary,
  field({
    name: 'status',
    label: 'Status',
    widget: 'select',
    options: ['idea', 'building', 'shipped', 'paused', 'archived'],
    default: 'building',
  }),
  field({
    name: 'stack',
    label: 'Stack',
    widget: 'list',
    required: false,
    default: [],
    hint: 'Languages, frameworks and tools, e.g. Electron, React, TypeScript.',
    field: { name: 'item', label: 'Technology', widget: 'string' },
  }),
  urlField('liveUrl', 'Live URL', 'Where people can use it.'),
  urlField('repoUrl', 'Repository URL', 'Any code host. For a GitHub repo, the field below is enough.'),
  repoField(
    'repo',
    'GitHub repository',
    'owner/name. Stars and the latest release are fetched from GitHub at build time.',
    false,
  ),
  dateField('started', 'Started', { required: false }),
  dateField('shipped', 'Shipped', { required: false }),
  field({
    name: 'role',
    label: 'My role',
    widget: 'string',
    required: false,
    hint: 'e.g. Solo, Design and code.',
  }),
  field({
    name: 'gallery',
    label: 'Gallery',
    widget: 'list',
    required: false,
    default: [],
    summary: '{{fields.alt}}',
    hint: 'Screenshots, opened full size from the project page. Every image needs alt text.',
    fields: [
      field({ name: 'src', label: 'Image', widget: 'image', choose_url: false }),
      field({
        name: 'alt',
        label: 'Alt text',
        widget: 'string',
        hint: 'Describe the image for someone who cannot see it.',
      }),
      field({ name: 'caption', label: 'Caption', widget: 'string', required: false }),
    ],
  }),
  field({
    name: 'timeline',
    label: 'Timeline',
    widget: 'list',
    required: false,
    default: [],
    summary: '{{fields.date}} {{fields.text}}',
    hint: 'What changed and when. Newest first reads best.',
    fields: [dateField('date', 'Date'), field({ name: 'text', label: 'What happened', widget: 'string' })],
  }),
  tags,
  cover,
  coverAlt,
  featured,
  draft,
  updated,
  readTime,
  author,
  canonicalUrl,
  aiAssist,
  plainBody,
];

// ---- Repos --------------------------------------------------------------------------------------------------------

const repoFields: CmsField[] = [
  title,
  date,
  summary,
  repoField(
    'repo',
    'GitHub repository',
    'owner/name of a public repository. Stars, language and the README are fetched from GitHub at build time. Required.',
    true,
  ),
  urlField('homepage', 'Homepage', 'The project site, if it has one.'),
  field({
    name: 'readme',
    label: 'README source',
    widget: 'select',
    required: false,
    options: [
      { label: "GitHub: show the repository's README", value: 'github' },
      { label: 'Local: show the body of this post instead', value: 'local' },
    ],
    default: 'github',
  }),
  field({
    name: 'install',
    label: 'Install command',
    widget: 'text',
    required: false,
    hint: 'One command a reader can copy, e.g. git clone … && npm install.',
  }),
  field({
    name: 'relatedProject',
    label: 'Related project',
    widget: 'relation',
    collection: 'projects',
    value_field: '{{slug}}',
    search_fields: ['title'],
    display_fields: ['title'],
    required: false,
    hint: 'The project this repository belongs to, if any.',
  }),
  tags,
  cover,
  coverAlt,
  featured,
  draft,
  updated,
  readTime,
  author,
  canonicalUrl,
  aiAssist,
  plainBody,
];

// ---- Collections --------------------------------------------------------------------------------------------------

const collection = (c: Record<string, unknown>) =>
  ({
    create: true,
    format: 'frontmatter',
    slug: '{{slug}}',
    identifier_field: 'title',
    summary: '{{title}} · {{date}}',
    sortable_fields: ['date', 'title'],
    view_filters: [{ label: 'Drafts', field: 'draft', pattern: true }],
    ...c,
  }) as CmsCollection;

export const blogCollection = collection({
  name: 'blog',
  label: 'Blog posts',
  label_singular: 'Blog post',
  folder: 'src/content/blog',
  // `.mdx` so a body can hold the article components; existing `.md` posts keep working but are not listed here.
  extension: 'mdx',
  // The preview pane renders the post with the site's own styles (src/admin/preview.ts).
  editor: { preview: true },
  fields: blogFields,
});

export const newsCollection = collection({
  name: 'news',
  label: 'News',
  label_singular: 'News item',
  folder: 'src/content/news',
  extension: 'md',
  fields: newsFields,
});

export const vlogsCollection = collection({
  name: 'vlogs',
  label: 'Vlogs',
  label_singular: 'Vlog',
  folder: 'src/content/vlogs',
  extension: 'md',
  fields: vlogFields,
});

export const projectsCollection = collection({
  name: 'projects',
  label: 'Projects',
  label_singular: 'Project',
  folder: 'src/content/projects',
  extension: 'md',
  summary: '{{title}} · {{status}}',
  fields: projectFields,
});

export const reposCollection = collection({
  name: 'repos',
  label: 'Repos',
  label_singular: 'Repo',
  folder: 'src/content/repos',
  extension: 'md',
  summary: '{{title}} · {{repo}}',
  fields: repoFields,
});

export const collections: CmsCollection[] = [
  blogCollection,
  newsCollection,
  vlogsCollection,
  projectsCollection,
  reposCollection,
];

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
    // Only blog posts have a live preview (the blog collection turns it on).
    editor: { preview: false },
    collections,
  };
}
