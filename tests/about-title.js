import { readFileSync } from 'node:fs';
import { parseFrontmatter } from '@astrojs/markdown-remark';

// The About page's title is whatever the author set in /admin (src/content/pages/about.md), so the tests read it instead of repeating it.
export const aboutTitle = parseFrontmatter(readFileSync('src/content/pages/about.md', 'utf8')).frontmatter.title;
