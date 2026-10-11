// The "Site settings" collection of /admin: one file, src/data/site.json, the same file every page reads (src/data/site.ts). Its
// fields mirror `siteSchema` in src/lib/site-settings.ts, with the same names and rules; settings.vitest.ts reads that schema to keep
// the two in step, so change them together. Kept in its own file, away from config.ts, which holds the post collections.
//
// One value in site.json has no field here on purpose, and the editor leaves it as it is when it saves:
// - `url`: the address every canonical link and the sitemap is built on. Changing it is a domain move (docs/DEPLOY_CLOUDFLARE.md).
// Where the editor itself commits and signs in (CMS_REPO, CMS_BRANCH, CMS_AUTH_URL in config.ts), and every secret, are not in
//   site.json at all.
import type { CmsCollection, CmsField } from 'decap-cms-core';
import { ICON_NAMES } from '../components/icons';
import { IMAGE_LIBRARY } from '../lib/media-rules.mjs';
import { HTTPS_PATTERN, SITE_PATH_PATTERN, SOCIAL_KEYS } from '../lib/site-settings';
import { SITE_KEY_PATTERN } from '../lib/waitlist';

const field = (f: Record<string, unknown>) => f as unknown as CmsField;

export const SETTINGS_FILE = 'src/data/site.json';

const HTTPS: [string, string] = [HTTPS_PATTERN.source, 'A full address starting with https://'];
const LINK: [string, string] = [
  `${SITE_PATH_PATTERN.source}|${HTTPS_PATTERN.source}`,
  'A page of this site starting with / (e.g. /blog/), or a full address starting with https://',
];
const LABEL: [string, string] = ['^\\S.{0,29}$', 'Required, 30 characters at most'];

const SOCIAL_LABELS: Record<(typeof SOCIAL_KEYS)[number], string> = {
  github: 'GitHub',
  youtube: 'YouTube',
};

const iconField = (required: boolean, hint: string) =>
  field({ name: 'icon', label: 'Icon', widget: 'select', required, options: [...ICON_NAMES], hint });

const imageField = (name: string, label: string, hint: string) =>
  field({ name, label, widget: 'image', choose_url: false, hint, media_library: IMAGE_LIBRARY });

/** A site key, or empty. The build also refuses Cloudflare's test keys (they start with 1x, 2x or 3x). */
const WAITLIST_KEY = new RegExp(`^$|${SITE_KEY_PATTERN.source.replace('\\d', '0')}`);

/** One of the waitlist's words: required, plain text, at most `max` characters (the schema's limits). */
const waitlistWords = (name: string, label: string, max: number, hint: string, widget: 'string' | 'text' = 'string') =>
  field({
    name,
    label,
    widget,
    pattern: [`^\\S[^\\n]{0,${max - 1}}$`, `Required, one line, ${max} characters at most`],
    hint,
  });

const settingsFields: CmsField[] = [
  field({
    name: 'name',
    label: 'Site name',
    widget: 'string',
    pattern: ['^\\S.{0,29}$', 'Required, 30 characters at most'],
    hint: 'Shown in the header and footer, and added to every browser title ("Post title · Site name"). A longer name leaves less room for post titles.',
  }),
  field({
    name: 'tagline',
    label: 'Tagline',
    widget: 'string',
    pattern: ['^\\S.{0,89}$', 'Required, 90 characters at most'],
    hint: 'Above the headline on the home page, and in its browser title.',
  }),
  field({
    name: 'description',
    label: 'Description',
    widget: 'text',
    pattern: ['^\\S[^\\n]{0,179}$', 'Required, one line, 180 characters at most'],
    hint: 'One sentence about the site: on the home page, in the footer, and in search results for pages without their own.',
  }),
  imageField(
    'defaultOgImage',
    'Default share image',
    'Shown when a page without its own picture is shared. 1200 × 630 pixels, PNG or JPG.',
  ),
  field({
    name: 'defaultOgImageAlt',
    label: 'Default share image: alt text',
    widget: 'string',
    hint: 'What the default share image shows, for people who cannot see it.',
  }),
  field({
    name: 'author',
    label: 'Author',
    widget: 'object',
    collapsed: true,
    hint: 'You. Your posts, author page and the About page read these (src/content/authors/ only says which posts are yours).',
    fields: [
      field({ name: 'name', label: 'Name', widget: 'string' }),
      field({ name: 'bio', label: 'Bio', widget: 'text', hint: 'A few sentences in your own words, first person.' }),
      imageField('photo', 'Photo', 'A square photo of you, at least 400 × 400 pixels.'),
    ],
  }),
  field({
    name: 'links',
    label: 'Profile links',
    widget: 'object',
    collapsed: true,
    hint: 'Leave a link empty if you have none: its icon is left out everywhere.',
    fields: SOCIAL_KEYS.map((key) =>
      field({
        name: key,
        label: SOCIAL_LABELS[key],
        widget: 'string',
        required: false,
        pattern: HTTPS,
        hint: 'A full address starting with https://, or empty.',
      }),
    ),
  }),
  field({
    name: 'nav',
    label: 'Header navigation',
    label_singular: 'Link',
    widget: 'list',
    summary: '{{fields.label}} → {{fields.href}}',
    hint: 'The links across the top, in this order. A page shows its link as the current one by its address, so you can rename a link freely.',
    fields: [
      field({ name: 'label', label: 'Label', widget: 'string', pattern: LABEL }),
      field({
        name: 'href',
        label: 'Address',
        widget: 'string',
        pattern: LINK,
        hint: 'A page of this site, e.g. /blog/, or https://… The build stops if the page does not exist.',
      }),
      field({ name: 'footer', label: 'Also in the footer', widget: 'boolean', required: false, default: false }),
      iconField(false, 'Needed when the link is also in the footer.'),
    ],
  }),
  field({
    name: 'footer',
    label: 'Footer',
    widget: 'object',
    collapsed: true,
    fields: [
      field({
        name: 'links',
        label: 'Footer links',
        label_singular: 'Footer link',
        widget: 'list',
        summary: '{{fields.label}}',
        hint: 'After the header links marked "Also in the footer", in this order.',
        fields: [
          field({ name: 'label', label: 'Label', widget: 'string', pattern: LABEL }),
          iconField(true, ''),
          field({
            name: 'href',
            label: 'Address',
            widget: 'string',
            required: false,
            pattern: LINK,
            hint: 'Fill in this or "Profile link", not both.',
          }),
          field({
            name: 'social',
            label: 'Profile link',
            widget: 'select',
            required: false,
            options: SOCIAL_KEYS.map((value) => ({ label: SOCIAL_LABELS[value], value })),
            hint: 'Use one of your profile links. Left out while that profile link is empty.',
          }),
        ],
      }),
      field({
        name: 'note',
        label: 'Note',
        widget: 'string',
        required: false,
        hint: 'The short line after the year, e.g. "Made with R7 Orbit". Empty: no note.',
      }),
    ],
  }),
  field({
    name: 'waitlist',
    label: 'Waitlist',
    widget: 'object',
    collapsed: true,
    hint: 'The form where readers join the waitlist for R7 Orbit, under the home page headline and at the end of posts that ask for it. Nothing shows anywhere until "Enabled" is ticked AND the site key is filled in. Setting it up in Cloudflare: docs/WAITLIST.md.',
    fields: [
      field({
        name: 'enabled',
        label: 'Enabled',
        widget: 'boolean',
        required: false,
        default: false,
        hint: 'Off: no form anywhere, the remove page does not exist, and nothing extra loads. Turn it on only after the Cloudflare setup is done (database, Turnstile widget and secret) and the Privacy page says what happens to the addresses.',
      }),
      field({
        name: 'turnstileSiteKey',
        label: 'Turnstile site key',
        widget: 'string',
        required: false,
        pattern: [WAITLIST_KEY.source, 'Empty, or the site key from Cloudflare (it starts with 0x)'],
        hint: 'The public "Site Key" of the Turnstile widget in Cloudflare (it starts with 0x). Never paste the Secret Key here: that one goes in the Pages project\'s settings as TURNSTILE_SECRET_KEY.',
      }),
      waitlistWords('heading', 'Heading', 80, 'Over the form at the end of a post.'),
      waitlistWords('text', 'Text', 300, 'One sentence under that heading, at the end of a post.', 'text'),
      waitlistWords('buttonLabel', 'Button', 40, 'The button that sends the address, on every waitlist form.'),
      waitlistWords(
        'emailLabel',
        'Email box label',
        40,
        'The label of the box the address is typed into. The box itself stays empty: no example address.',
      ),
      waitlistWords(
        'successMessage',
        'Message after joining',
        200,
        'Shown once the address is saved. Only shown when the server says it worked.',
      ),
      waitlistWords(
        'errorMessage',
        'Message when it fails',
        200,
        'Shown when the address could not be saved (the server or the network failed). A mistyped address gets its own short message.',
      ),
      waitlistWords(
        'removeLinkLabel',
        'Remove link',
        40,
        'The small link under each form, to the page where a reader takes their address off the list.',
      ),
      waitlistWords('removeHeading', 'Remove page: heading', 80, 'The heading of that page (/waitlist/remove/).'),
      waitlistWords('removeButtonLabel', 'Remove page: button', 40, 'The button on that page.'),
      waitlistWords(
        'removeSuccessMessage',
        'Remove page: message after removing',
        200,
        'Shown after the button is pressed. It must not say whether the address was on the list, so nobody can find out who is.',
      ),
      waitlistWords(
        'noscriptMessage',
        'Message without JavaScript',
        200,
        'Shown instead of the form when the browser runs no JavaScript (the spam check needs it).',
      ),
    ],
  }),
];

export const settingsCollection = {
  name: 'settings',
  label: 'Site settings',
  description: 'The site name, your details, profile links, navigation, footer and waitlist: used on every page.',
  delete: false,
  // Pictures chosen here go to public/media/site/, written as /media/site/x.jpg (docs/IMAGES.md).
  media_folder: '/public/media/site',
  public_folder: '/media/site',
  files: [
    {
      name: 'site',
      label: 'Site settings',
      file: SETTINGS_FILE,
      format: 'json',
      fields: settingsFields,
    },
  ],
} as unknown as CmsCollection;

export const settingsCollections: CmsCollection[] = [settingsCollection];
