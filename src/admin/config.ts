// The Decap CMS configuration for /admin: one collection per content kind (blog, news, vlogs, projects, repos). Each one
// mirrors its schema in src/content.config.ts, which is strict: a field written here that the schema does not know fails
// the build, and a required schema field that is missing here makes every new post fail. Field names are the schema's
// own, and config.vitest.ts reads the real schema to keep the two in step, so change them together.
import type { CmsCollection, CmsConfig, CmsField } from 'decap-cms-core';
import site from '../data/site.json';
import { APP_TYPES, APP_TYPE_IDS, DEFAULT_APP_TYPE } from '../lib/app-types';
import { ARTICLE_COMPONENT_NAMES } from '../lib/article-component-names';
import { IMAGE_LIBRARY } from '../lib/media-rules.mjs';
import { seoTitleMax } from '../lib/seo';
import { pageCollections } from './pages';
import { sectionsField } from './sections-config';
import { authorOptions, DEFAULT_AUTHOR } from './authors';
// ---- Site settings (src/admin/settings.ts) ----
import { settingsCollections } from './settings';
// ---- end site settings ----

// ---- Where the live admin signs in (edit here; the Cloudflare steps are in docs/DEPLOY_CLOUDFLARE.md) -----------------------

/** The GitHub repository the posts are committed to, `owner/name`. Taken from `git remote get-url origin`. */
export const CMS_REPO = 'EOSHunter/r7-orbit-site';
/** The branch posts are published to. Cloudflare Pages deploys it as the production site. */
export const CMS_BRANCH = 'main';
/**
 * The address of the OAuth Worker in workers/cms-auth/ that signs the author in to GitHub (it serves /auth and
 * /callback). No trailing slash. A PLACEHOLDER until that Worker is deployed there: change it if it lives elsewhere.
 * A build can override it with PUBLIC_CMS_AUTH_URL (and PUBLIC_CMS_REPO / PUBLIC_CMS_BRANCH for the other two).
 */
export const CMS_AUTH_URL = 'https://cms-auth.r7orbit.io';

export interface AdminEnv {
  /** `npm run dev`: edit the files on disk through the local proxy (`npm run cms`), no sign-in. */
  local: boolean;
  /** `owner/name` of the GitHub repository the posts are committed to. */
  repo: string;
  branch: string;
  /** Base URL of the OAuth Worker that signs the author in to GitHub (see CMS_AUTH_URL). Unused when `local`. */
  authUrl?: string;
}

// ==== Images: where uploads go (docs/IMAGES.md) ===================================================================================
// The author never types a folder: each image field and block writes to the folder for where it is used, and the file is
// named by Decap's `slug` setting in buildConfig (lowercase, hyphens, no spaces or accents).
// A collection-level folder must start with "/": without it Decap reads it relative to the post's own file.
//
// Two homes, matching how the site uses images:
// - src/assets/blog/   optimised by Astro at build (several widths, AVIF and WebP). Blog featured image (written relative to the
//                      post, because Astro's image() needs that) and every picture inside a blog body (Image, Image gallery
//                      blocks: written /src/assets/blog/x.jpg, which Figure and ImageRow resolve).
// - public/media/<kind>/  served as a plain file at /media/<kind>/x.jpg: covers, posters, gallery shots, pictures in the body of
//                      news, vlogs, projects and repos. These are strings in the schema that cards and share images read
//                      as they are, so they cannot be optimised by Astro; scripts/media.mjs resizes them in the build output.
// The top-level media_folder (public/media) is the library the editor's "Media" tab opens.
export const MEDIA_FOLDER = 'public/media';
export const PUBLIC_FOLDER = '/media';
export const FEATURED_MEDIA_FOLDER = '/src/assets/blog';
export const FEATURED_PUBLIC_FOLDER = '../../assets/blog';
/** Pictures inside a blog body: stored in src/assets/blog, written as /src/assets/blog/x.jpg. */
export const BLOG_BODY_MEDIA_FOLDER = '/src/assets/blog';
export const BLOG_BODY_PUBLIC_FOLDER = '/src/assets/blog';

/** The upload folder of a content kind (or page group): `/public/media/<name>`, written as `/media/<name>/x.jpg`. */
export const mediaFolders = (name: string) => ({
  media_folder: `/${MEDIA_FOLDER}/${name}`,
  public_folder: `${PUBLIC_FOLDER}/${name}`,
});

const IMAGE_FORMATS_HINT = 'JPG, PNG, WebP, AVIF or SVG. A large photo is fine: the site resizes it when it builds.';

// The same rules as the checks in src/content.config.ts, as [regex, message] pairs for Decap's `pattern`.
const TAG_PATTERN: [string, string] = [
  '^[a-z0-9]+(-[a-z0-9]+)*$',
  'Lowercase words joined with hyphens, e.g. ai-agents',
];
const TITLE_PATTERN: [string, string] = ['^.{1,90}$', 'Required, 90 characters at most'];
const SEO_TITLE_MAX = seoTitleMax(site.name);
const SUBTITLE_PATTERN: [string, string] = ['^.{1,140}$', '140 characters at most'];
const SUMMARY_PATTERN: [string, string] = ['^.{1,180}$', 'Required, one line, 180 characters at most'];
const URL_PATTERN: [string, string] = ['^https?://\\S+$', 'A full address, starting with https://'];
const OWNER_NAME_PATTERN: [string, string] = ['^[\\w.-]+/[\\w.-]+$', 'Use the form owner/name, e.g. EOSHunter/r7-orbit-site'];
const HTTPS_URL_PATTERN: [string, string] = ['^https://\\S+$', 'A full address starting with https://'];
const PLAY_ASPECT_PATTERN: [string, string] = ['^[1-9]\\d{0,2}:[1-9]\\d{0,2}$', 'Use width:height, e.g. 16:9 or 4:3'];
const PLAY_NOTE_PATTERN: [string, string] = ['^.{1,120}$', '120 characters at most'];
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

// `media_library` carries the upload size limit (src/lib/media-rules.mjs), which Decap only reads on the widget.
const imageField = (name: string, label: string, hint: string, extra: Record<string, unknown> = {}) =>
  field({ name, label, widget: 'image', choose_url: false, required: false, hint, media_library: IMAGE_LIBRARY, ...extra });

// ---- Fields every collection has (the `common` block of the schema) -----------------------------------------------

const title = field({
  name: 'title',
  label: 'Title',
  widget: 'string',
  pattern: TITLE_PATTERN,
  hint: 'Sentence case. Put one phrase in *asterisks* for the italic brass accent.',
});
const seoTitle = field({
  name: 'seoTitle',
  label: 'Browser title',
  widget: 'string',
  required: false,
  pattern: [`^.{1,${SEO_TITLE_MAX}}$`, `${SEO_TITLE_MAX} characters at most`],
  hint: `Optional. Shorter title for browser tabs and search results. Max ${SEO_TITLE_MAX} characters.`,
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
const COVER_HINT = `Shown on the post and when it is shared. 16:9, at least 1280px across. Your own image, not stock. Without one the post shows the placeholder. ${IMAGE_FORMATS_HINT}`;
const cover = imageField('cover', 'Cover image', COVER_HINT);
// The blog's body and featured image live in src/assets/blog, so its cover (a plain file) names its own folder.
const blogCover = imageField('cover', 'Cover image', COVER_HINT, mediaFolders('blog'));
const coverAlt = field({
  name: 'coverAlt',
  label: 'Cover image alt text',
  widget: 'string',
  required: false,
  default: '',
  hint: 'Only needed when you add an image. Describe the cover image in one plain sentence; leave it empty only if the image is purely decorative.',
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
  hint: 'A draft is left out of the site, archives, search and sitemap. Turn it on to hold a post back.',
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
// ---- Waitlist (waitlist block: the `waitlist` switch on every post, the same name as in content.config.ts) ------------
// When on, and the waitlist is on in Site settings > Waitlist, the post ends with the waitlist band (src/components/WaitlistForm.astro).
const waitlist = field({
  name: 'waitlist',
  label: 'Waitlist form at the end',
  widget: 'boolean',
  default: false,
  required: false,
  hint: 'On: the waitlist form for R7 Orbit follows the post, before the related posts. It shows only while the waitlist is Enabled in Site settings > Waitlist, with the words set there. Use it on posts about R7 Orbit.',
});

// ---- Author (authors block: the `author` select on every post; the authors collection is further down) ---------------
const author = field({
  name: 'author',
  label: 'Author',
  widget: 'select',
  options: authorOptions,
  default: DEFAULT_AUTHOR,
  required: false,
  hint: 'Who the post is credited to. Hunter Newton unless an AI agent wrote it: then pick R7. Never credit an AI-written post to Hunter.',
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

/** The Body's hint: a post is written as Markdown here or as sections (the block below), never both. */
const BODY_OR_SECTIONS = 'Use sections OR the body, not both. Leave this empty when the post is written as sections.';

/** Blog bodies are MDX, so they can hold the article blocks. Everything else is plain Markdown. */
const body = (editorComponents: string[]) =>
  field({
    name: 'body',
    label: 'Body',
    widget: 'markdown',
    modes: ['rich_text', 'raw'],
    buttons: BODY_BUTTONS,
    editor_components: editorComponents,
    // Empty when the post is written as sections (the block below).
    required: false,
    hint: BODY_OR_SECTIONS,
  });

const plainBody = body(['image', 'code-block']);

// ==== Sections: a body written as blocks (docs/SECTIONS.md "Posts") ===============================================================
// Every kind can be written as a list of blocks instead of the Markdown body: the shared block library, the same "Add section" form as
// the About page (sections-config.ts, generated from src/lib/sections/definitions.ts). A post is written one way or the other: the
// editor refuses to save one with both (bodyOrSectionsCheck, src/admin/post-body.ts, registered in main.ts) and the build stops on one
// (bodyConflict, src/lib/content.ts). Pictures in blocks go to the kind's public/media/<kind>/ folder: the blocks read a picture's size
// from public/ (src/lib/section-images.ts), so the blog's blocks do not use its src/assets/blog folder.

const SECTIONS_HINT =
  'Use sections OR the body, not both. Sections are blocks you add, drag into order and remove (a heading, text, a picture, a quote, a video…); the body is one Markdown text. Leave the Body empty when you use sections. Check the preview on the right.';

/** The `sections` list of a post. `kind` is the folder its pictures are uploaded to (public/media/<kind>/). */
const postSections = (kind: string) =>
  field({ ...(sectionsField({ label: 'Sections', hint: SECTIONS_HINT }) as unknown as Record<string, unknown>), ...mediaFolders(kind) });

// A vlog written as sections has no Markdown body to hold its transcript, so it has its own box (shown folded under the video).
const transcriptText = field({
  name: 'transcriptText',
  label: 'Transcript (for a vlog written as sections)',
  widget: 'markdown',
  modes: ['rich_text', 'raw'],
  buttons: BODY_BUTTONS,
  editor_components: [],
  required: false,
  hint: 'Only with sections: the transcript, shown folded under the notes. With a Markdown body, put the transcript at the end of the body under a "Transcript" heading and turn on "Transcript below" instead.',
});
// ==== end sections ===============================================================================================================

// ---- Blog ---------------------------------------------------------------------------------------------------------

const blogFields: CmsField[] = [
  title,
  seoTitle,
  field({ name: 'subtitle', label: 'Subtitle', widget: 'string', required: false, pattern: SUBTITLE_PATTERN }),
  date,
  summary,
  tags,
  imageField(
    'featuredImage',
    'Featured image',
    `The hero behind the headline. Wide (16:9) and at least 1600px across. Your own image, not stock. ${IMAGE_FORMATS_HINT}`,
    { media_folder: FEATURED_MEDIA_FOLDER, public_folder: FEATURED_PUBLIC_FOLDER },
  ),
  field({
    name: 'featuredImageAlt',
    label: 'Featured image alt text',
    widget: 'string',
    required: false,
    default: '',
    hint: 'Only needed when you add an image. Describe the featured image in one plain sentence; leave it empty only if the image is purely decorative.',
  }),
  blogCover,
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
  waitlist,
  updated,
  readTime,
  author,
  canonicalUrl,
  aiAssist,
  // No built-in 'image' here: the Image block (Figure) asks for alt text, caption, placement and size.
  body(['code-block', ...ARTICLE_COMPONENT_NAMES]),
  postSections('blog'),
];

// ---- News ---------------------------------------------------------------------------------------------------------

const newsFields: CmsField[] = [
  title,
  seoTitle,
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
  waitlist,
  updated,
  readTime,
  author,
  canonicalUrl,
  aiAssist,
  plainBody,
  postSections('news'),
];

// ---- Vlogs --------------------------------------------------------------------------------------------------------

const vlogFields: CmsField[] = [
  title,
  seoTitle,
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
    `The still shown before play. 16:9, at least 1280px across. Falls back to the cover image. Your own image, not stock. ${IMAGE_FORMATS_HINT}`,
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
  waitlist,
  updated,
  readTime,
  author,
  canonicalUrl,
  aiAssist,
  plainBody,
  postSections('vlogs'),
  transcriptText,
];

// ---- Projects -----------------------------------------------------------------------------------------------------

// A playable project: a browser game or app hosted at its own address, listed on /apps/. Everything here is optional; without
// Play URL the project is an ordinary one. An embedded address must be one that public/_headers lets the site frame (frame-src).
const playFields: CmsField[] = [
  field({
    name: 'playUrl',
    label: 'Play URL',
    widget: 'string',
    required: false,
    pattern: HTTPS_URL_PATTERN,
    hint: 'Where the game or app runs, e.g. https://vesper.r7orbit.io/. Setting it makes this a Playable project: a Play section on the page, a Playable badge on cards, and a card on the Apps page. https only. To embed it, its origin must be listed in frame-src in public/_headers.',
  }),
  field({
    name: 'appType',
    label: 'Type',
    widget: 'select',
    // The values are APP_TYPES (src/lib/app-types.ts), the same list as the schema's.
    options: APP_TYPE_IDS.map((value) => ({ label: APP_TYPES[value].label, value })),
    required: false,
    hint: `What it is on the Apps page: its label on the card, the type filter there, and the card's button (${APP_TYPE_IDS.map((t) => `${APP_TYPES[t].label}: ${APP_TYPES[t].action}`).join(', ')}). Left empty: ${APP_TYPES[DEFAULT_APP_TYPE].label}. Needs a Play URL.`,
  }),
  field({
    name: 'playMode',
    label: 'Play mode',
    widget: 'select',
    options: ['embed', 'link'],
    default: 'embed',
    required: false,
    hint: 'embed: it loads in the page when the visitor presses Play. link: only a button that opens it in a new tab.',
  }),
  field({
    name: 'playAspect',
    label: 'Game aspect ratio',
    widget: 'string',
    default: '16:9',
    required: false,
    pattern: PLAY_ASPECT_PATTERN,
    hint: 'Width:height of the game frame, e.g. 16:9 or 4:3. Only used when the game is embedded.',
  }),
  field({
    name: 'controls',
    label: 'Controls',
    widget: 'list',
    required: false,
    default: [],
    summary: '{{fields.key}}: {{fields.action}}',
    hint: 'The controls legend under the game, one row per input. Needs a Play URL.',
    fields: [
      field({ name: 'key', label: 'Key or input', widget: 'string', hint: 'e.g. Space, W / Up arrow, Mouse.' }),
      field({ name: 'action', label: 'What it does', widget: 'string', hint: 'e.g. Fire, Steer, Pause.' }),
    ],
  }),
  field({
    name: 'playNote',
    label: 'Play note',
    widget: 'string',
    required: false,
    pattern: PLAY_NOTE_PATTERN,
    hint: 'One short line shown with the game, e.g. Best on desktop with a mouse. Needs a Play URL.',
  }),
  field({
    name: 'platforms',
    label: 'Platforms',
    widget: 'select',
    multiple: true,
    options: ['desktop', 'mobile'],
    required: false,
    default: [],
    hint: 'Where the game works, shown as small labels with it. Needs a Play URL.',
  }),
  field({
    name: 'order',
    label: 'Order on the Apps page',
    widget: 'number',
    value_type: 'int',
    required: false,
    hint: 'Optional. A lower number comes first on the Apps page and the home page; those without one follow, newest first. Needs a Play URL.',
  }),
];

const projectFields: CmsField[] = [
  title,
  seoTitle,
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
    hint: `Screenshots, opened full size from the project page. Every image needs alt text. ${IMAGE_FORMATS_HINT}`,
    fields: [
      field({ name: 'src', label: 'Image', widget: 'image', choose_url: false, media_library: IMAGE_LIBRARY }),
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
  ...playFields,
  tags,
  cover,
  coverAlt,
  featured,
  draft,
  waitlist,
  updated,
  readTime,
  author,
  canonicalUrl,
  aiAssist,
  plainBody,
  postSections('projects'),
];

// ---- Repos --------------------------------------------------------------------------------------------------------

const repoFields: CmsField[] = [
  title,
  seoTitle,
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
  waitlist,
  updated,
  readTime,
  author,
  canonicalUrl,
  aiAssist,
  plainBody,
  postSections('repos'),
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
  // Pictures in a blog body go to src/assets/blog (optimised). Images fields name their own folders (cover, featuredImage).
  media_folder: BLOG_BODY_MEDIA_FOLDER,
  public_folder: BLOG_BODY_PUBLIC_FOLDER,
  // The preview pane renders the post with the site's own styles (src/admin/preview.ts), as sections or as Markdown.
  editor: { preview: true },
  fields: blogFields,
});

export const newsCollection = collection({
  name: 'news',
  label: 'News',
  label_singular: 'News item',
  folder: 'src/content/news',
  extension: 'md',
  ...mediaFolders('news'),
  // A simpler preview than the blog's (src/admin/post-preview.ts): the page head and the body, as sections or as Markdown.
  editor: { preview: true },
  fields: newsFields,
});

export const vlogsCollection = collection({
  name: 'vlogs',
  label: 'Vlogs',
  label_singular: 'Vlog',
  folder: 'src/content/vlogs',
  extension: 'md',
  ...mediaFolders('vlogs'),
  // A simpler preview than the blog's (src/admin/post-preview.ts): the page head and the body, as sections or as Markdown.
  editor: { preview: true },
  fields: vlogFields,
});

export const projectsCollection = collection({
  name: 'projects',
  label: 'Projects',
  label_singular: 'Project',
  folder: 'src/content/projects',
  extension: 'md',
  ...mediaFolders('projects'),
  summary: '{{title}} · {{status}}',
  // A simpler preview than the blog's (src/admin/post-preview.ts): the page head and the body, as sections or as Markdown.
  editor: { preview: true },
  fields: projectFields,
});

export const reposCollection = collection({
  name: 'repos',
  label: 'Repos',
  label_singular: 'Repo',
  folder: 'src/content/repos',
  extension: 'md',
  ...mediaFolders('repos'),
  summary: '{{title}} · {{repo}}',
  // A simpler preview than the blog's (src/admin/post-preview.ts): the page head and the body, as sections or as Markdown.
  editor: { preview: true },
  fields: repoFields,
});

// ---- Authors (authors block) --------------------------------------------------------------------------------------
// One JSON file per author in src/content/authors/, named by its slug. Hunter's name, bio and photo are not repeated here:
// they are read from site.json unless a field below is filled in. An agent needs a name and a bio (the build checks).

const authorFields: CmsField[] = [
  field({
    name: 'slug',
    label: 'Slug',
    widget: 'string',
    pattern: ['^[a-z0-9]+(-[a-z0-9]+)*$', 'Lowercase words joined with hyphens, e.g. hunter-newton'],
    hint: 'The address of the author page (/authors/<slug>/) and the file name. It must match the file name: do not change it after posts use it.',
  }),
  field({
    name: 'kind',
    label: 'Kind',
    widget: 'select',
    options: [
      { label: 'Person', value: 'person' },
      { label: 'AI agent', value: 'agent' },
    ],
    default: 'person',
  }),
  field({
    name: 'name',
    label: 'Name',
    widget: 'string',
    required: false,
    hint: 'Required for an agent. Leave empty for a person: the name comes from site.json.',
  }),
  field({ name: 'subtitle', label: 'Subtitle', widget: 'string', required: false, pattern: ['^.{1,60}$', '60 characters at most'] }),
  field({
    name: 'bio',
    label: 'Bio',
    widget: 'text',
    required: false,
    hint: 'Required for an agent. Leave empty for a person: the bio comes from site.json.',
  }),
  imageField('avatar', 'Avatar', 'Leave empty for a person to use the photo in site.json. An agent uses its mark, e.g. /assets/r7-mark.svg.'),
  field({
    name: 'note',
    label: 'Footer note',
    widget: 'text',
    required: false,
    hint: 'Shown at the end of every post by this author. Used for an AI agent; leave empty for a person.',
  }),
];

export const authorsCollection = {
  name: 'authors',
  label: 'Authors',
  label_singular: 'Author',
  folder: 'src/content/authors',
  extension: 'json',
  format: 'json',
  create: true,
  slug: '{{slug}}',
  identifier_field: 'slug',
  summary: '{{slug}} · {{kind}}',
  fields: authorFields,
} as unknown as CmsCollection;

export const collections: CmsCollection[] = [
  blogCollection,
  newsCollection,
  vlogsCollection,
  projectsCollection,
  reposCollection,
  authorsCollection,
];

export function buildConfig(env: AdminEnv): CmsConfig {
  return {
    // GitHub, signed in through the OAuth Worker (base_url + /auth, workers/cms-auth/). Open authoring is off: only people
    // with write access to the repository can edit, and the token the Worker returns is the author's own.
    backend: env.local
      ? { name: 'github', repo: env.repo, branch: env.branch }
      : {
          name: 'github',
          repo: env.repo,
          branch: env.branch,
          base_url: env.authUrl,
          auth_endpoint: 'auth',
          open_authoring: false,
        },
    // `local_backend` talks to `npm run cms` (decap-server) and falls back to the backend above if it is not running.
    local_backend: env.local,
    // Each post becomes a pull request, so CI builds it (and checks the schema) before it can reach the live site.
    // The local proxy has no pull requests, so there every save writes the file directly.
    publish_mode: env.local ? undefined : 'editorial_workflow',
    // The config is this object, not an /admin/config.yml (which would be a 404).
    load_config_file: false,
    // ---- Images (docs/IMAGES.md) -------------------------------------------------------------------------------------
    // The global library (the "Media" tab). Each collection and field above has its own upload folder.
    media_folder: MEDIA_FOLDER,
    public_folder: PUBLIC_FOLDER,
    // How an uploaded file is named: lowercase, accents dropped, anything but letters, digits, "-", "_" and "." becomes "-".
    // "My Photo (1).JPG" is stored as my-photo-1-.jpg. The same setting names new posts' files, which are already hyphenated.
    slug: { encoding: 'ascii', clean_accents: true, sanitize_replacement: '-' },
    // ---- end images --------------------------------------------------------------------------------------------------
    // The five post collections and the About page turn their live preview on; anything else (the authors) has none.
    editor: { preview: false },
    // The five post collections, then the block-built pages (src/admin/pages.ts), then the site settings (src/admin/settings.ts).
    collections: [
      ...collections,
      ...pageCollections,
      // ---- Site settings ----
      ...settingsCollections,
      // ---- end site settings ----
    ],
  };
}
