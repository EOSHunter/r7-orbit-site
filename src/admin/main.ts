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
import { blocks } from './blocks';
import { buildConfig } from './config';
import { blogPreview } from './preview';
import { globalStyleOf, spriteOf } from './preview-assets';
import previewCss from './preview.css?inline';

const authUrl = import.meta.env.PUBLIC_CMS_AUTH_URL as string | undefined;
const local = import.meta.env.DEV;

if (!local && !authUrl) {
  // A production build with no OAuth proxy cannot sign anyone in; say so instead of calling Decap's default (Netlify).
  const note = document.getElementById('admin-unconfigured');
  if (note) note.hidden = false;
} else {
  for (const block of blocks) CMS.registerEditorComponent(block);

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
      repo: (import.meta.env.PUBLIC_CMS_REPO as string | undefined) || 'EOSHunter/r7-orbit-site',
      branch: (import.meta.env.PUBLIC_CMS_BRANCH as string | undefined) || 'main',
    }),
  });
}
