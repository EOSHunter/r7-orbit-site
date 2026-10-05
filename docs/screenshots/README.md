# Screenshots

Taken for the phase 7 quality pass with `node tests/screenshots.mjs` (needs a build and the preview server: port 4399, or set `BASE`). Each file is the first screen of the page (not the full page), with reduced motion on, named `page-width.png`.

Widths: the home page and the first article (a blog post, or a news item) are saved at 320, 375, 768, 1024, 1280 and 1480px, because their layout changes at each breakpoint (single column, two columns, the table of contents from 1200px). Articles with a featured image are saved whole-page at 320, 768 and 1280px. Every other page is saved at 375 and 1280px only: those two show the phone and desktop layouts, and the pages share the same container and header at the widths in between. All six widths were still checked for every page by `tests/audit.spec.js` (no horizontal scroll, nothing poking out, tap targets).

The posts are not named in the script: `tests/routes.js` finds them in `dist/`, so the screenshots show whatever is published, and a kind with no posts shows its empty state. Post and tag pages are named `kind-slug-width.png` (for example `blog-some-post-1280.png`).

| Page | Files | Shows |
| --- | --- | --- |
| `home-*` | 6 widths | Hero with the orbit, pinned post, header |
| `latest-*` | 375, 1280 | Mixed archive with kind filter, tag chips, sort |
| `news-*`, `blog-*`, `vlogs-*`, `projects-*`, `repos-*` | 375, 1280 | Archive pages: heading, toolbar, card grid (or the empty state) |
| `games-*` | 375, 1280 | The games hub (the empty state until a game is published) |
| `styleguide-games-*` | 375, 1280, whole page | The hub fixture: no games, one (with the "More games coming" card), two and five |
| `<kind>-<slug>-*` | 375, 1280 (articles: see above) | One post of each kind that has one |
| `tags-*`, `tags-<tag>-*` | 375, 1280 | Tag index and a tag page, when a tag has two posts |
| `about-*`, `subscribe-*`, `privacy-*` | 375, 1280 | About, Subscribe, Privacy |
| `404-*` | 375, 1280 | The 404 page with the static orbit |
| `styleguide-*`, `styleguide-specimen-*`, `styleguide-article-components-*` | 375, 1280 | The styleguide shell, the specimen page and the article-components demo |

The screenshots of the old sample posts were removed with them. Run the script again after a build to refresh the rest; the styleguide and specimen pages still use placeholder text.
