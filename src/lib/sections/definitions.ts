// THE block library: every block a page (later a post) can be built from, defined once. A block is its id, its label, its
// fields (a Zod schema carrying the editor's labels and hints: fields.ts) and where it sits in the page (`placement`). From this
// list come:
//   - `sectionsSchema` (index.ts), the Zod union a collection attaches to read a `sections` list
//   - the Decap form of the admin (src/admin/sections-config.ts, read back from these schemas by describe.ts)
//   - the layout rows (layout.ts) that Sections.astro and the admin preview both use
//   - the catalogue in docs/SECTIONS.md (catalogue.ts) and the fixture page /styleguide/sections/
// Two things sit beside a definition because they cannot live in a file the browser and Vitest also read: the Astro component that
// draws it (src/components/sections/<Id>Block.astro, listed in registry.ts) and the preview's HTML for it (src/admin/sections-html.ts).
// Both are typed `Record<SectionType, …>`, so a block without one does not compile, and sections.vitest.ts fails with the name.
// To add a block, see docs/SECTIONS.md.
//
// Pure, no Astro: read by src/content.config.ts, the admin bundle and Vitest.
import { z } from 'astro/zod';
import {
  ASPECT_PATTERN,
  choice,
  choices,
  count,
  flag,
  HTTPS_PATTERN,
  HTTPS_MESSAGE,
  image,
  link,
  list,
  needsAlt,
  numberChoice,
  OWNER_NAME_PATTERN,
  pattern,
  pictureAlt,
  SLUG_MESSAGE,
  SLUG_PATTERN,
  text,
  TIMESTAMP_PATTERN,
  YOUTUBE_ID_PATTERN,
} from './fields';


/** Where a block sits on the page. `prose` is the reading column; `wide` and `full` leave it (one block, one row); `band` is a
 *  full-width section with its own spacing (the newsletter); `portrait` starts a picture-beside-text row. */
export type Placement = 'prose' | 'wide' | 'full' | 'band' | 'portrait';

/** What the editor groups blocks under (the order here is the order of the "Add section" menu). */
export const GROUPS = ['Text', 'Pictures and video', 'Layout', 'Links and buttons', 'From the site'] as const;
export type Group = (typeof GROUPS)[number];

/** The kinds of post a Latest posts block can pick from: the same words the cards use (src/lib/cards.ts). */
export const POST_KINDS = ['news', 'blog', 'vlog', 'project', 'repo'] as const;

interface BlockMeta {
  label: string;
  group: Group;
  /** One sentence for the catalogue: what the block draws and when to use it. */
  description: string;
  /** How the block reads when folded in the editor (a Decap summary template). */
  summary: string;
  placement: Placement | ((data: Record<string, unknown>) => Placement);
  /** For a block whose placement depends on its fields: where it sits, in a sentence, for the catalogue. */
  placementNote?: string;
  /** A complete, valid block (without `type`). Tests parse it, the fixture page draws it and the catalogue prints it. */
  example: Record<string, unknown>;
  /** What the admin preview does differently from the page, for blocks where it differs. Left out when the preview is exact. */
  previewNote?: string;
}

function defineBlock<const Id extends string, Shape extends z.ZodRawShape>(
  id: Id,
  meta: BlockMeta,
  shape: Shape,
  refine?: (data: z.infer<z.ZodObject<Shape>>, ctx: z.RefinementCtx) => void,
) {
  const object = z.object({ type: z.literal(id), ...shape } as { type: z.ZodLiteral<Id> } & Shape).strict();
  return { id, ...meta, schema: refine ? object.superRefine(refine as never) : object };
}

const MARKDOWN_HINT = 'Paragraphs, **bold**, *italic*, links and lists. Leave a blank line between paragraphs.';
const ADDRESS_HINT = 'https://… for another site, or /subscribe/ for a page on this site.';

// ---- Text ---------------------------------------------------------------------------------------------------------------

const heading = defineBlock(
  'heading',
  {
    label: 'Heading',
    group: 'Text',
    description: 'A title for the part below it. One phrase in *asterisks* is set in italic brass, as in a page title.',
    summary: 'Heading: {{fields.text}}',
    placement: 'prose',
    example: { text: 'A row of *text*', level: 2 },
  },
  {
    text: text({
      label: 'Heading text',
      max: 120,
      hint: 'Sentence case, e.g. "How I work". Put one phrase in *asterisks* for the italic brass accent, e.g. "How I *work*".',
    }),
    level: numberChoice([2, 3], { 2: 'Section heading (larger)', 3: 'Sub-heading (smaller)' }, {
      label: 'Size',
      hint: 'A heading directly above a "Portrait and text" block sits beside the picture.',
    }),
  },
);

const lead = defineBlock(
  'lead',
  {
    label: 'Lead paragraph',
    group: 'Text',
    description: 'The opening line of a page or section: larger and a little quieter than body text.',
    summary: "Lead: {{fields.text | truncate(48, '…')}}",
    placement: 'prose',
    example: { text: 'A lead paragraph sets the scene in a sentence or two, with **bold** and a [link](/subscribe/) if needed.' },
  },
  {
    text: text({
      label: 'Lead paragraph',
      widget: 'text',
      format: 'inline',
      max: 400,
      hint: 'One short paragraph, 400 characters at most. **bold**, *italic*, `code` and [links](/subscribe/) work.',
    }),
  },
);

const body = defineBlock(
  'text',
  {
    label: 'Text',
    group: 'Text',
    description: 'Paragraphs, bold, italic, links, lists and code, as Markdown. Raw HTML is removed.',
    summary: "Text: {{fields.text | truncate(48, '…')}}",
    placement: 'prose',
    example: {
      text: 'Plain paragraphs, **bold**, *italic*, `inline code` and [a link](/subscribe/).\n\n- a list item\n- another list item\n\nA second paragraph with a long unbroken address: https://example.com/a/very/long/path/that/keeps/going/and/going/and/going/for/a/while',
    },
    previewNote: 'Text is read by a simplified Markdown reader (headings, paragraphs, lists, bold, italic, code, links). The page reads all of Markdown.',
  },
  {
    text: text({
      label: 'Text',
      widget: 'markdown',
      hint: `${MARKDOWN_HINT} Use a Heading block for headings.`,
    }),
  },
);

const quote = defineBlock(
  'quote',
  {
    label: 'Quote',
    group: 'Text',
    description: 'A quotation in the text: brass rule on the left, display italic, with who said it.',
    summary: "Quote: {{fields.text | truncate(48, '…')}}",
    placement: 'prose',
    example: { text: 'A short quotation, set in the display face.', attribution: 'Someone Specific' },
  },
  {
    text: text({ label: 'Quote', widget: 'text', format: 'markdown', hint: 'What was said. Markdown is fine.' }),
    attribution: text({ label: 'Who said it', optional: true }),
  },
);

const pullquote = defineBlock(
  'pullquote',
  {
    label: 'Pull quote',
    group: 'Text',
    description: 'A line from the text set large between two hairlines. Screen readers skip it (it repeats the text), so use Quote for words that appear nowhere else.',
    summary: "Pull quote: {{fields.text | truncate(48, '…')}}",
    placement: 'prose',
    example: { text: 'One good line, pulled out and set large.', attribution: 'From the text above' },
  },
  {
    text: text({
      label: 'Pull quote',
      widget: 'text',
      max: 200,
      hint: 'A line that already appears in the text above, set large. Screen readers skip it so they do not read it twice: for words that appear nowhere else, use a Quote block.',
    }),
    attribution: text({ label: 'Credit', optional: true, hint: 'Optional. A few words under it, e.g. "From the post".' }),
  },
);

const callout = defineBlock(
  'callout',
  {
    label: 'Callout',
    group: 'Text',
    description: 'A boxed aside: a note, a tip (brass) or a warning, told apart by the label as well as the colour.',
    summary: "Callout: {{fields.title}} {{fields.text | truncate(40, '…')}}",
    placement: 'prose',
    example: { kind: 'tip', title: 'A tip with a title', text: 'Tips are brass. This one has **bold** in it.' },
  },
  {
    kind: choice(['info', 'tip', 'warn'], { info: 'Note', tip: 'Tip (brass)', warn: 'Warning' }, { label: 'Kind' }),
    title: text({
      label: 'Title',
      optional: true,
      hint: 'Optional. Without one the box is labelled Note, Tip or Warning.',
    }),
    text: text({ label: 'Text', widget: 'text', format: 'markdown', hint: 'Markdown is fine.' }),
  },
);

export const CODE_LANGUAGES = ['text', 'bash', 'js', 'ts', 'json', 'css', 'html', 'astro', 'python', 'yaml', 'md', 'diff', 'sql'] as const;

const code = defineBlock(
  'code',
  {
    label: 'Code block',
    group: 'Text',
    description: 'Highlighted code with a bar (file name or language) and a Copy button.',
    summary: "Code: {{fields.title}} {{fields.code | truncate(40, '…')}}",
    placement: 'prose',
    example: { lang: 'bash', title: 'Build the site', code: 'npm install\nnpm run build' },
    previewNote: 'The preview shows the code without syntax colours; the page highlights it.',
  },
  {
    code: text({ label: 'Code', widget: 'text', hint: 'Paste the code as it is. Indent with spaces.' }),
    lang: choice(
      CODE_LANGUAGES,
      {
        text: 'Plain text',
        bash: 'Shell (bash)',
        js: 'JavaScript',
        ts: 'TypeScript',
        json: 'JSON',
        css: 'CSS',
        html: 'HTML',
        astro: 'Astro',
        python: 'Python',
        yaml: 'YAML',
        md: 'Markdown',
        diff: 'Diff (+ and - lines coloured)',
        sql: 'SQL',
      },
      { label: 'Language', hint: 'Sets the colours, and the label in the bar when there is no title.', fallback: 'text' },
    ),
    title: text({ label: 'Title', optional: true, max: 60, hint: 'Optional. Shown in the bar instead of the language, e.g. a file name.' }),
  },
);

// ---- Pictures and video -------------------------------------------------------------------------------------------------

const picture = defineBlock(
  'image',
  {
    label: 'Image',
    group: 'Pictures and video',
    description: 'A picture on its own with an optional caption: in the text, the width of the page, or edge to edge.',
    summary: 'Image: {{fields.alt}}',
    placement: (d) => (d.width === 'wide' ? 'wide' : d.width === 'full' ? 'full' : 'prose'),
    placementNote: 'In the reading column when Narrow; in a row of its own the width of the page when Wide; edge to edge of the window when Full.',
    example: { image: '/media/about/hunter-newton.jpg', alt: 'A portrait, narrow', caption: 'A narrow image has a caption.', width: 'narrow' },
  },
  {
    image: image('Image', 'A picture on its own. Your own image, not stock. Choose a file or upload one.'),
    ...pictureAlt('the image'),
    caption: text({ label: 'Caption', optional: true, hint: 'Optional. A line under the picture.' }),
    width: choice(
      ['narrow', 'wide', 'full'],
      { narrow: 'Narrow: the width of the text', wide: 'Wide: the width of the page', full: 'Full: edge to edge of the window' },
      { label: 'Width', hint: 'Narrow sits in line with the text. Wide and Full break out of it and start a new row.' },
    ),
    align: choice(['center', 'left', 'right'], { center: 'Centred', left: 'Left, text wraps beside it', right: 'Right, text wraps beside it' }, {
      label: 'Placement (narrow only)',
      hint: 'Left and Right put the text beside a smaller picture from 720px up. Wide and Full ignore this.',
    }),
    size: choice(['lg', 'md', 'sm'], { lg: 'Large: fills the column', md: 'Medium', sm: 'Small' }, {
      label: 'Size (narrow only)',
      hint: 'Wide and Full ignore this.',
    }),
  },
  needsAlt,
);

const imageRow = defineBlock(
  'image-row',
  {
    label: 'Image row',
    group: 'Pictures and video',
    description: 'Two or three pictures side by side, each with its own caption, one column on a phone.',
    summary: 'Image row: {{fields.caption}}',
    placement: 'wide',
    example: {
      images: [
        { image: '/media/about/hunter-newton.jpg', alt: 'The portrait, in a row of two', caption: 'The first.' },
        { image: '/og-default.png', alt: 'The brand image, in a row of two', caption: 'The second.' },
      ],
      caption: 'A caption for the whole row.',
    },
  },
  {
    images: list(
      {
        image: image('Image', 'Your own image, not stock.'),
        ...pictureAlt('the image'),
        caption: text({ label: 'Caption', optional: true }),
      },
      { label: 'Images', hint: 'Two or three pictures, in order.', min: 2, max: 3, summary: '{{fields.alt}}', itemLabel: 'image' },
      needsAlt,
    ),
    caption: text({ label: 'Caption for the whole row', optional: true, hint: 'Optional. Shown under the row.' }),
  },
);

const gallery = defineBlock(
  'gallery',
  {
    label: 'Lightbox gallery',
    group: 'Pictures and video',
    description: 'A grid of thumbnails; each opens full size in a dialog with previous and next. Every picture needs alt text.',
    summary: 'Gallery: {{fields.label}}',
    placement: 'wide',
    example: {
      label: 'Fixture photos',
      shots: [
        { image: '/media/about/hunter-newton.jpg', alt: 'A portrait, in the gallery', caption: 'The first.' },
        { image: '/og-default.png', alt: 'The brand image, in the gallery', caption: 'The second.' },
      ],
    },
    previewNote: 'The thumbnails are drawn; clicking one does not open the full-size dialog in the preview.',
  },
  {
    label: text({ label: 'Name of the gallery', optional: true, max: 60, hint: 'Optional. Read out by screen readers for the full-size window, e.g. "Screenshots".' }),
    shots: list(
      {
        image: image('Image', 'Your own image, not stock.'),
        alt: text({ label: 'Alt text', max: 300, hint: 'Describe the image for someone who cannot see it. Every gallery picture needs it.' }),
        caption: text({ label: 'Caption', optional: true }),
      },
      { label: 'Pictures', hint: 'One row per picture, in order.', max: 24, summary: '{{fields.alt}}', itemLabel: 'picture' },
    ),
  },
);

const portrait = defineBlock(
  'portrait',
  {
    label: 'Portrait and text',
    group: 'Pictures and video',
    description: 'A picture in a side column beside the text (above it on a phone). The blocks after it stay beside it until a divider, a wide or full image, or another portrait.',
    summary: "Portrait: {{fields.text | truncate(48, '…')}}",
    placement: 'portrait',
    example: {
      image: '/media/about/hunter-newton.jpg',
      alt: 'A portrait, on the right',
      side: 'right',
      text: 'The text beside the picture. The blocks after it stay in this column.',
    },
  },
  {
    image: image('Image', 'A portrait or other upright picture, shown beside the text (above it on a phone). Your own image, not stock. Choose a file or upload one.'),
    ...pictureAlt('the portrait'),
    side: choice(['left', 'right'], { left: 'Left', right: 'Right' }, { label: 'Picture on the' }),
    text: text({
      label: 'Text',
      widget: 'markdown',
      hint: 'Shown beside the picture. The blocks after this one (headings, text and so on) stay beside it too, until a Divider, a Wide or Full image, or another Portrait ends the row.',
    }),
  },
  needsAlt,
);

const video = defineBlock(
  'video',
  {
    label: 'Video embed',
    group: 'Pictures and video',
    description: 'A YouTube video that loads only when the reader presses play, with optional poster, chapters and caption.',
    summary: 'Video: {{fields.title}}',
    placement: 'prose',
    example: {
      youtubeId: 'dQw4w9WgXcQ',
      title: 'A fixture video',
      duration: '3:32',
      chapters: [
        { t: '0:00', title: 'Start' },
        { t: '1:10', title: 'The middle' },
      ],
      caption: 'Nothing is requested from YouTube until you press play.',
    },
    previewNote: 'The preview shows the player as it looks before play; nothing is requested from YouTube.',
  },
  {
    youtubeId: pattern({
      label: 'YouTube video ID',
      pattern: YOUTUBE_ID_PATTERN,
      message: 'a YouTube id is exactly 11 characters (letters, digits, - and _), not the whole link',
      hint: 'The 11 characters after v= in the video address (youtube.com/watch?v=dQw4w9WgXcQ), not the whole link. The video loads only when a reader presses play.',
    }),
    title: text({ label: 'Video title', max: 120, hint: 'Names the player for screen readers: "Play video: …".' }),
    poster: image('Poster image', 'The still shown before play. 16:9, at least 1280px across. Your own image, not stock. Without one the player shows the placeholder.', true),
    duration: pattern({
      label: 'Duration',
      optional: true,
      pattern: TIMESTAMP_PATTERN,
      message: 'use m:ss or h:mm:ss, e.g. 12:48',
      hint: 'Optional. Minutes and seconds, e.g. 12:48, shown on the player.',
    }),
    chapters: list(
      {
        t: pattern({ label: 'Starts at', pattern: TIMESTAMP_PATTERN, message: 'use m:ss or h:mm:ss, e.g. 5:15', hint: 'm:ss, e.g. 5:15' }),
        title: text({ label: 'Chapter title', max: 120 }),
      },
      { label: 'Chapters', hint: 'Optional. One line per chapter, in order.', min: 0, max: 30, summary: '{{fields.t}} {{fields.title}}', itemLabel: 'chapter' },
    ),
    caption: text({ label: 'Caption', optional: true, hint: 'Optional. A line under the video.' }),
  },
);

const game = defineBlock(
  'game',
  {
    label: 'Playable game',
    group: 'Pictures and video',
    description: 'A browser game on its own address, loaded only when the reader presses Play (a sandboxed frame), or a plain button that opens it in a new tab. An embedded game\'s address must be allowed by frame-src in public/_headers.',
    summary: 'Game: {{fields.title}}',
    placement: 'wide',
    example: {
      title: 'Vesper Drift',
      playUrl: 'https://vesper.r7orbit.io/',
      playMode: 'embed',
      playAspect: '4:3',
      playNote: 'Best on desktop with a mouse',
      platforms: ['desktop'],
      controls: [
        { key: 'W / Up arrow', action: 'Thrust' },
        { key: 'Space', action: 'Fire' },
      ],
    },
    previewNote: 'The preview shows the Play button; the game itself loads only on the page.',
  },
  {
    title: text({ label: 'Game name', max: 80, hint: 'Plain text. Used on the Play button and to name the frame for screen readers.' }),
    playUrl: pattern({
      label: 'Play URL',
      pattern: HTTPS_PATTERN,
      message: HTTPS_MESSAGE,
      hint: 'Where the game runs, e.g. https://vesper.r7orbit.io/. https only. To embed it, its address must be listed in frame-src in public/_headers: the build stops with a message if it is not.',
    }),
    playMode: choice(['embed', 'link'], { embed: 'Embed: loads in the page when Play is pressed', link: 'Link: only a button that opens it in a new tab' }, {
      label: 'Play mode',
    }),
    playAspect: pattern({
      label: 'Game aspect ratio',
      pattern: ASPECT_PATTERN,
      message: 'use width:height, e.g. 16:9 or 4:3',
      hint: 'Width:height of the game frame, e.g. 16:9 or 4:3. Only used when the game is embedded.',
      fallback: '16:9',
    }),
    poster: image('Poster image', 'The still shown before Play. Optional; without one the placeholder is shown.', true),
    playNote: text({ label: 'Play note', optional: true, max: 120, hint: 'One short line shown with the game, e.g. Best on desktop with a mouse.' }),
    platforms: choices(['desktop', 'mobile'], { desktop: 'Desktop', mobile: 'Mobile' }, {
      label: 'Platforms',
      hint: 'Where the game works, shown as small labels with it.',
    }),
    controls: list(
      {
        key: text({ label: 'Key or input', max: 40, hint: 'e.g. Space, W / Up arrow, Mouse.' }),
        action: text({ label: 'What it does', max: 80, hint: 'e.g. Fire, Steer, Pause.' }),
      },
      { label: 'Controls', hint: 'The controls legend under the game, one row per input.', min: 0, max: 20, summary: '{{fields.key}}: {{fields.action}}', itemLabel: 'control' },
    ),
  },
);

// ---- Layout -------------------------------------------------------------------------------------------------------------

const columns = defineBlock(
  'columns',
  {
    label: 'Two columns',
    group: 'Layout',
    description: 'Two Markdown columns side by side from 720px up, stacked on a phone. Each column is Markdown text (a column cannot hold other blocks: Decap\'s nested block lists are too clumsy to edit with).',
    summary: "Two columns: {{fields.left | truncate(30, '…')}}",
    placement: 'wide',
    example: { ratio: '2:1', left: 'The **left** column, twice as wide.\n\nA second paragraph.', right: 'The *right* column, with a list:\n\n- one\n- two' },
    previewNote: 'The columns are drawn with a simplified Markdown reader.',
  },
  {
    ratio: choice(['1:1', '2:1', '1:2'], { '1:1': 'Equal', '2:1': 'Left twice as wide', '1:2': 'Right twice as wide' }, { label: 'Widths' }),
    reverse: flag('Right column first on a phone', 'When the columns stack, put the right one on top.'),
    left: text({ label: 'Left column', widget: 'markdown', hint: MARKDOWN_HINT }),
    right: text({ label: 'Right column', widget: 'markdown', hint: MARKDOWN_HINT }),
  },
);

const divider = defineBlock(
  'divider',
  {
    label: 'Divider',
    group: 'Layout',
    description: 'A break between parts of the page: a hairline or three brass dots. It also ends a picture-beside-text row.',
    summary: 'Divider',
    placement: 'prose',
    example: { style: 'dots' },
  },
  {
    style: choice(['rule', 'dots'], { rule: 'Hairline', dots: 'Three dots' }, { label: 'Style', hint: 'A break between parts of the page.' }),
  },
);

const spacer = defineBlock(
  'spacer',
  {
    label: 'Spacer',
    group: 'Layout',
    description: 'Empty space between two blocks, when the usual spacing is too tight.',
    summary: 'Spacer: {{fields.size}}',
    placement: 'prose',
    example: { size: 'md' },
  },
  {
    size: choice(['sm', 'md', 'lg'], { sm: 'Small', md: 'Medium', lg: 'Large' }, { label: 'Space', fallback: 'md' }),
  },
);

// ---- Links and buttons --------------------------------------------------------------------------------------------------

const links = defineBlock(
  'links',
  {
    label: 'Links list',
    group: 'Links and buttons',
    description: 'A bordered list of links, each with an optional short note; an address on another site gets the external icon.',
    summary: 'Links list',
    placement: 'prose',
    example: {
      items: [
        { label: 'A page on this site', url: '/subscribe/' },
        { label: 'Another site, with a note', url: 'https://example.com/', note: 'video' },
      ],
    },
  },
  {
    items: list(
      {
        label: text({ label: 'Label', max: 120, hint: 'What the link says, e.g. "My YouTube channel".' }),
        url: link('Address', ADDRESS_HINT),
        note: text({ label: 'Note', optional: true, hint: 'Optional. A few words shown at the end of the row, e.g. "video".' }),
      },
      { label: 'Links', hint: 'One row per link, in order.', max: 20, summary: '{{fields.label}}', itemLabel: 'link' },
    ),
  },
);

const button = defineBlock(
  'button',
  {
    label: 'Button',
    group: 'Links and buttons',
    description: 'A solid button that links to a page of this site or to another site.',
    summary: 'Button: {{fields.label}}',
    placement: 'prose',
    example: { label: 'A button to another site', url: 'https://example.com/' },
  },
  {
    label: text({ label: 'Button text', max: 40, hint: 'Short, e.g. "Subscribe".' }),
    url: link('Address', ADDRESS_HINT),
  },
);

// ---- From the site ------------------------------------------------------------------------------------------------------

const toc = defineBlock(
  'toc',
  {
    label: 'Table of contents',
    group: 'From the site',
    description: 'A list of links to the headings on this page (Heading blocks, and ## headings inside Text blocks). Adding one gives every heading an anchor.',
    summary: 'Table of contents',
    placement: 'prose',
    example: { title: 'On this page', maxDepth: 3 },
    previewNote: 'Built from the Heading blocks and the ## headings in Text blocks as typed; the page reads the finished headings.',
  },
  {
    title: text({ label: 'Title', optional: true, max: 60, hint: 'Optional. Over the list; "On this page" if left empty.' }),
    maxDepth: numberChoice([2, 3], { 2: 'Section headings only', 3: 'Section headings and sub-headings' }, {
      label: 'Levels',
      fallback: 3,
    }),
  },
);

const stats = defineBlock(
  'stats',
  {
    label: 'GitHub stats row',
    group: 'From the site',
    description: 'The language, stars, forks and last update of a public GitHub repository, fetched when the site is built (never in the reader\'s browser). Without a network the row falls back to a plain link.',
    summary: 'GitHub stats: {{fields.repo}}',
    placement: 'prose',
    example: { repo: 'EOSHunter/r7-orbit-site' },
    previewNote: 'The numbers are fetched from GitHub when the site is built, so the preview shows a stand-in.',
  },
  {
    repo: pattern({
      label: 'GitHub repository',
      pattern: OWNER_NAME_PATTERN,
      message: 'use the form owner/name, e.g. EOSHunter/r7-orbit-site',
      hint: 'owner/name of a public repository.',
    }),
  },
);

const latest = defineBlock(
  'latest',
  {
    label: 'Latest posts',
    group: 'From the site',
    description: 'The newest published posts as cards, filtered by kind, tag and/or author. Drafts and future-dated posts are left out, as everywhere else.',
    summary: 'Latest posts: {{fields.count}} {{fields.kinds}} {{fields.tag}} {{fields.author}}',
    placement: 'wide',
    example: { heading: 'The *latest* posts', kinds: [], count: 3 },
    previewNote: 'The posts are chosen when the site is built, so the preview shows what the block will pick, not the cards.',
  },
  {
    heading: text({ label: 'Heading', optional: true, max: 80, hint: 'Optional. Put one phrase in *asterisks* for the italic brass accent.' }),
    kinds: choices(POST_KINDS, { news: 'News', blog: 'Blog', vlog: 'Vlogs', project: 'Projects', repo: 'Repos' }, {
      label: 'Kinds',
      hint: 'Which kinds of post. Choose none for every kind.',
    }),
    tag: pattern({
      label: 'Tag',
      optional: true,
      pattern: SLUG_PATTERN,
      message: SLUG_MESSAGE,
      hint: 'Optional. Only posts with this tag, written as the posts write it, e.g. ai-agents. The build stops if no post has it.',
    }),
    author: pattern({
      label: 'Author',
      optional: true,
      pattern: SLUG_PATTERN,
      message: SLUG_MESSAGE,
      source: 'authors',
      hint: 'Optional. Only posts credited to this author.',
    }),
    count: count({ label: 'How many', min: 1, max: 12, fallback: 3, hint: 'Between 1 and 12.' }),
  },
);

const author = defineBlock(
  'author',
  {
    label: 'Author box',
    group: 'From the site',
    description: 'An author\'s avatar, name (a link to their page), the "AI-written" label for an agent, and their bio, read from the authors list.',
    summary: 'Author: {{fields.author}}',
    placement: 'prose',
    example: { author: 'hunter-newton' },
  },
  {
    author: pattern({
      label: 'Author',
      pattern: SLUG_PATTERN,
      message: SLUG_MESSAGE,
      source: 'authors',
      hint: 'Who to show. The name, bio and photo come from the Authors list.',
    }),
  },
);

const newsletter = defineBlock(
  'newsletter',
  {
    label: 'Newsletter sign-up',
    group: 'From the site',
    description: 'The newsletter sign-up: the full-width band, or just the form in the text. It sends nothing until the newsletter provider is connected (src/data/site.json).',
    summary: 'Newsletter: {{fields.style}}',
    placement: (d) => (d.style === 'form' ? 'prose' : 'band'),
    placementNote: 'The Band is a full-width section with its own spacing; the Form sits in the reading column.',
    example: { style: 'band', heading: 'One email when something new is worth reading', text: 'New posts and videos, a few times a month.' },
    previewNote: 'The preview shows the sign-up without a working form.',
  },
  {
    style: choice(['band', 'form'], { band: 'Band: a full-width section', form: 'Form: just the form, in the text' }, { label: 'Style' }),
    heading: text({ label: 'Heading', optional: true, max: 100, hint: 'Optional. The site\'s own line is used if left empty.' }),
    text: text({ label: 'Text', optional: true, widget: 'text', max: 220, hint: 'Optional. A sentence under the heading.' }),
  },
);

// ---- The list -----------------------------------------------------------------------------------------------------------

/** Every block, in the order of the editor's "Add section" menu (grouped, in the order of GROUPS). */
export const definitions = [
  heading,
  lead,
  body,
  quote,
  pullquote,
  callout,
  code,
  picture,
  imageRow,
  gallery,
  portrait,
  video,
  game,
  columns,
  divider,
  spacer,
  links,
  button,
  toc,
  stats,
  latest,
  author,
  newsletter,
] as const;

export type Definition = (typeof definitions)[number];
export type SectionType = Definition['id'];
export const SECTION_TYPES = definitions.map((d) => d.id) as readonly SectionType[];

export const definitionOf = (type: string): Definition | undefined => definitions.find((d) => d.id === type);

/** A readable name for a block type, for headings in errors and the admin. */
export const SECTION_LABELS = Object.fromEntries(definitions.map((d) => [d.id, d.label])) as Record<SectionType, string>;
