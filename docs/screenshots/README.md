# Screenshots

Taken for the phase 7 quality pass with `node tests/screenshots.mjs` (needs a build and the preview server on port 4399). Each file is the first screen of the page (not the full page), with reduced motion on, named `page-width.png`.

Widths: the home page and the sample blog post are saved at 320, 375, 768, 1024, 1280 and 1480px, because their layout changes at each breakpoint (single column, two columns, the table of contents from 1200px). Every other page is saved at 375 and 1280px only: those two show the phone and desktop layouts, and the pages share the same container and header at the widths in between. All six widths were still checked for every page by `tests/audit.spec.js` (no horizontal scroll, nothing poking out, tap targets).

| Page | Files | Shows |
| --- | --- | --- |
| `home-*` | 6 widths × 2 themes | Hero with the orbit, pinned post, header, theme toggle |
| `latest-*` | 375, 1280 | Mixed archive with kind filter, tag chips, sort |
| `news-*`, `blog-*`, `vlogs-*`, `projects-*`, `repos-*` | 375, 1280 | Archive pages: heading, toolbar, card grid |
| `news-2026-10-03-open-weights-model-lands-*` | 375, 1280 | News item with the source box |
| `blog-why-every-agent-gets-its-own-room-*` | 6 widths × 2 themes | Blog post: breadcrumb, byline, tags, table of contents (wide), prose |
| `vlogs-i-built-a-game-with-a-team-of-ai-agents-*` | 375, 1280 | Vlog page with the player facade (no YouTube request until play) |
| `projects-r7-orbit-*` | 375, 1280 | Project page: status, stack, facts panel |
| `repos-example-repo-*` | 375, 1280 | Repo page built from cached/offline GitHub data |
| `tags-*`, `tags-ai-agents-*` | 375, 1280 | Tag index and one tag page |
| `about-*`, `subscribe-*`, `privacy-*` | 375, 1280 | About, Subscribe, Privacy |
| `404-*` | 375, 1280 | The 404 page with the static orbit |
| `styleguide-*`, `styleguide-specimen-*` | 375, 1280 | The styleguide shell and the specimen page itself |

Content in the screenshots is sample/placeholder content (see `src/content/` and `src/data/site.json`).
