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
import siteCss from '../styles/site.css?inline';
import { withAssetBridge } from './asset-bridge';
import { blocks, markdownImage } from './blocks';
import { buildConfig, CMS_AUTH_URL, CMS_BRANCH, CMS_REPO } from './config';
import { imageSaveCheck } from './image-rules';
import { blogPreview } from './preview';
import { globalStyleOf, spriteOf } from './preview-assets';
import previewCss from './preview.css?inline';

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
// order BaseLayout and its components import them, plus the hero's own block, which lives inside ArticleHero.astro.
for (const css of [tokensCss, componentsCss, siteCss, markdownCss, articleCss, globalStyleOf(heroSource), previewCss]) {
  CMS.registerPreviewStyle(css, { raw: true });
}
CMS.registerPreviewTemplate('blog', blogPreview({ sprite: spriteOf(spriteSource), authorName: site.author.name }));

CMS.init({
  config: buildConfig({
    local,
    authUrl,
    repo: (import.meta.env.PUBLIC_CMS_REPO as string | undefined) || CMS_REPO,
    branch: (import.meta.env.PUBLIC_CMS_BRANCH as string | undefined) || CMS_BRANCH,
  }),
});
