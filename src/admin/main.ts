// Entry for /admin: registers the article blocks and starts Decap. Bundled by Astro, so nothing is fetched from a CDN.
import CMS from 'decap-cms-app';
import { blocks } from './blocks';
import { buildConfig } from './config';

const authUrl = import.meta.env.PUBLIC_CMS_AUTH_URL as string | undefined;
const local = import.meta.env.DEV;

if (!local && !authUrl) {
  // A production build with no OAuth proxy cannot sign anyone in; say so instead of calling Decap's default (Netlify).
  const note = document.getElementById('admin-unconfigured');
  if (note) note.hidden = false;
} else {
  for (const block of blocks) CMS.registerEditorComponent(block);
  CMS.init({
    config: buildConfig({
      local,
      authUrl,
      repo: (import.meta.env.PUBLIC_CMS_REPO as string | undefined) || 'EOSHunter/r7-orbit-site',
      branch: (import.meta.env.PUBLIC_CMS_BRANCH as string | undefined) || 'main',
    }),
  });
}
