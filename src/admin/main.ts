// Entry for /admin: registers the article blocks and the blog preview, then starts Decap. Bundled by Astro, so nothing is
// fetched from a CDN.
import CMS from 'decap-cms-app';
import heroSource from '../components/ArticleHero.astro?raw';
import spriteSource from '../components/IconSprite.astro?raw';
import { site } from '../data/site';
import articleCss from '../styles/article.css?inline';
import componentsCss from '../styles/design-system/components.css?inline';
import tokensCss from '../styles/design-system/tokens.css?inline';
import markdownCss from '../styles/markdown.css?inline';
import sectionsCss from '../styles/sections.css?inline';
import siteCss from '../styles/site.css?inline';
import { aboutPreview } from './about-preview';
import { withAssetBridge } from './asset-bridge';
import { authorNames } from './authors';
import { blocks, markdownImage } from './blocks';
import { buildConfig, CMS_AUTH_URL, CMS_BRANCH, CMS_REPO } from './config';
import { framedPreview } from './framed-preview';
import { imageSaveCheck } from './image-rules';
import { pagePreview } from './page-previews';
import { FRAMED_PAGES } from './pages';
import { blogPreview } from './preview';
import { globalStyleOf, spriteOf } from './preview-assets';
import previewCss from './preview.css?inline';
import { SITE_PAGES } from '../lib/site-pages';

// The defaults are the constants in config.ts. A build can override each with a PUBLIC_ variable; those are readable in the
// browser, so never put a secret in one.
const authUrl = (import.meta.env.PUBLIC_CMS_AUTH_URL as string | undefined) || CMS_AUTH_URL;
const local = import.meta.env.DEV;

for (const block of blocks) CMS.registerEditorComponent(block);
// The Markdown bodies' "Image" block asks for alt text. It has Decap's built-in id, so it replaces the built-in one.
CMS.registerEditorComponent(markdownImage);
// A picture just uploaded shows in the image field's thumbnail (Decap would show a broken image for a /media/... path until the
// post is published). src/admin/asset-bridge.ts explains; the same fix is in the blocks and the blog preview.
const imageWidget = CMS.getWidget('image') as { control: never; preview?: never; schema?: unknown } | undefined;
if (imageWidget) {
  // The string form of registerWidget takes the schema as a fourth argument that its typings omit; it keeps the widget's own.
  (CMS.registerWidget as (...args: unknown[]) => void)('image', withAssetBridge(imageWidget.control), imageWidget.preview, imageWidget.schema);
}
// Refuse to save a post with a picture that has no alt text, or a HEIC or oversized upload (docs/IMAGES.md).
CMS.registerEventListener({ name: 'preSave', handler: imageSaveCheck });

// The preview pane is an iframe, so it starts with no styles. These are the same files the public pages load, in the
// order BaseLayout and its components import them (sections.css is the About page's), plus the hero's own block, which
// lives inside ArticleHero.astro.
for (const css of [tokensCss, componentsCss, siteCss, markdownCss, articleCss, sectionsCss, globalStyleOf(heroSource), previewCss]) {
  CMS.registerPreviewStyle(css, { raw: true });
}
CMS.registerPreviewTemplate('blog', blogPreview({ sprite: spriteOf(spriteSource), authorName: site.author.name, authorNames }));
// A file collection's template is named after the file: the About page is the `about` file of the Pages collection.
CMS.registerPreviewTemplate('about', aboutPreview({ sprite: spriteOf(spriteSource) }));
// The home page and the listing pages, each under its file's name in the Pages collection (src/admin/site-page-files.ts).
for (const page of SITE_PAGES) CMS.registerPreviewTemplate(page.admin.name, pagePreview(page, { sprite: spriteOf(spriteSource) }));
// Subscribe, privacy, 404 and search: the same preview, with the site settings filled in (framed-preview.ts).
for (const name of FRAMED_PAGES) CMS.registerPreviewTemplate(name, framedPreview(name, { sprite: spriteOf(spriteSource) }));

CMS.init({
  config: buildConfig({
    local,
    authUrl,
    repo: (import.meta.env.PUBLIC_CMS_REPO as string | undefined) || CMS_REPO,
    branch: (import.meta.env.PUBLIC_CMS_BRANCH as string | undefined) || CMS_BRANCH,
  }),
});
