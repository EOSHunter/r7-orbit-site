import { defineConfig } from 'astro/config';
import site from './src/data/site.json' with { type: 'json' };

// Static output: no server runtime. `site` is a placeholder until the domain is chosen (docs/DECISIONS.md §A).
export default defineConfig({
  site: site.url,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
