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
import { blocks } from './blocks';
import { buildConfig, CMS_AUTH_URL, CMS_BRANCH, CMS_REPO } from './config';
import { blogPreview } from './preview';
import { globalStyleOf, spriteOf } from './preview-assets';
import previewCss from './preview.css?inline';

// The defaults are the constants in config.ts. A build can override each with a PUBLIC_ variable; those are readable in the
// browser, so never put a secret in one.
const authUrl = (import.meta.env.PUBLIC_CMS_AUTH_URL as string | undefined) || CMS_AUTH_URL;
const local = import.meta.env.DEV;

for (const block of blocks) CMS.registerEditorComponent(block);

// The preview pane is an iframe, so it starts with no styles. These are the same files the public pages load, in the
// order BaseLayout and its components import them (sections.css is the About page's), plus the hero's own block, which
// lives inside ArticleHero.astro.
for (const css of [tokensCss, componentsCss, siteCss, markdownCss, articleCss, sectionsCss, globalStyleOf(heroSource), previewCss]) {
  CMS.registerPreviewStyle(css, { raw: true });
}
CMS.registerPreviewTemplate('blog', blogPreview({ sprite: spriteOf(spriteSource), authorName: site.author.name }));
// A file collection's template is named after the file: the About page is the `about` file of the Pages collection.
CMS.registerPreviewTemplate('about', aboutPreview({ sprite: spriteOf(spriteSource) }));

CMS.init({
  config: buildConfig({
    local,
    authUrl,
    repo: (import.meta.env.PUBLIC_CMS_REPO as string | undefined) || CMS_REPO,
    branch: (import.meta.env.PUBLIC_CMS_BRANCH as string | undefined) || CMS_BRANCH,
  }),
});
