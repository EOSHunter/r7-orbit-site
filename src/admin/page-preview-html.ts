// Markup for the previews of the home page and the listing pages in the editor (src/admin/page-previews.ts): the hero or the page
// head as index.astro, ArchivePage.astro, games/index.astro and tags/index.astro draw them (same elements and classes, so the
// site's CSS styles them), the blocks through sectionsHtml, and, where the page lists posts, games or tags, a stand-in that says
// so in words. Nothing that comes from the posts can be drawn here: the editor has the page's entry, not the site. Pure functions,
// no DOM and no Decap: they run under Vitest.
import { pageProblems, type SitePage } from '../lib/site-pages';
import { escapeHtml } from './preview-html';
import { headingText, previewProblems } from './sections-html';

type Loose = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const icon = (name: string) => `<svg class="ico" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
/** Only addresses a visitor may follow, and a part of the page (#latest): anything else is not made a link. */
const safeHref = (url: string): string => (/^(https:\/\/\S+|\/(?!\/)\S*|#[A-Za-z][\w-]*)$/.test(url) ? url : '#');

/** The home page's hero (index.astro), from the entry's fields. The orbit beside it is drawn by a script on the page only. */
export function heroHtml(data: Loose): string {
  const eyebrow = str(data.eyebrow) ? `<p class="eyebrow brass">${escapeHtml(str(data.eyebrow))}</p>` : '';
  const title = `<h1 class="t-display">${headingText(str(data.title) || 'The headline')}</h1>`;
  const lead = str(data.lead) ? `<p class="t-lead">${escapeHtml(str(data.lead))}</p>` : '';
  const buttons = (Array.isArray(data.buttons) ? (data.buttons as Loose[]) : [])
    .filter((b) => str(b?.label))
    .map((b, i) => `<a class="btn${i === 0 ? ' solid' : ''} lg" href="${escapeHtml(safeHref(str(b.url)))}">${escapeHtml(str(b.label))}</a>`)
    .join('');
  return `<section class="hero plate-grid"><div class="container wide"><div class="hero-grid"><div>${eyebrow}${title}${lead}${buttons ? `<div class="cluster">${buttons}</div>` : ''}</div></div></div></section>`;
}

/** A listing page's head (ArchivePage.astro and the hub pages): the label from code, the heading and lead from the entry. */
export function pageHeadHtml(page: Pick<SitePage, 'label' | 'icon'>, data: Loose): string {
  const eyebrow = `<p class="eyebrow brass">${page.icon ? icon(page.icon) : ''}${escapeHtml(page.label)}</p>`;
  const title = `<h1>${headingText(str(data.title) || page.label)}</h1>`;
  const lead = str(data.lead) ? `<p class="t-lead">${escapeHtml(str(data.lead))}</p>` : '';
  return `<div class="container wide"><header class="page-head">${eyebrow}${title}${lead}</header></div>`;
}

/** What each kind of listing page draws from the site where the stand-in is. */
function listedThing(page: Pick<SitePage, 'id' | 'shape'>): string {
  if (page.shape === 'games') return 'The published games are shown here, in their order, as cards with a Play button.';
  if (page.id === 'tags') return 'Every tag in use is listed here, with how many posts carry it.';
  return 'The posts are listed here, newest first, with search, sort and filters, twelve to a page.';
}

/**
 * The stand-in for the listing (ArchiveList, GamesSection, TagIndex): what goes there, and the page's own words for when there is
 * nothing to list (and, on the Games page, the card beside a single game), drawn with the classes the page uses.
 */
export function listingStandInHtml(page: Pick<SitePage, 'id' | 'shape'>, data: Loose): string {
  const what = `<div class="empty"><p><strong>Stand-in.</strong> ${escapeHtml(listedThing(page))}</p><p class="t-meta">Made when the site is built, so the editor cannot show it.</p></div>`;
  const button = page.shape === 'games' && str(data.emptyLinkLabel) ? `<a class="btn" href="#">${escapeHtml(str(data.emptyLinkLabel))}</a>` : '';
  const empty = `<p class="admin-preview-note">With nothing to list, the page says:</p><div class="empty"><h2>${escapeHtml(str(data.emptyHeading))}</h2><p>${escapeHtml(str(data.emptyText))}</p>${button}</div>`;
  const soon =
    page.shape === 'games'
      ? `<p class="admin-preview-note">With exactly one game, a card beside it says:</p><ul class="game-grid few"><li><div class="game-soon"><p class="eyebrow">${escapeHtml(str(data.soonEyebrow))}</p><h2 class="card-title">${escapeHtml(str(data.soonTitle))}</h2><p class="card-text">${escapeHtml(str(data.soonText))}</p></div></li></ul>`
      : '';
  return `<div class="container wide">${what}${empty}${soon}</div>`;
}

/** Everything the build would stop on for this page, while the author types: the page's own fields, then each list of blocks. */
export function pagePreviewProblems(page: Pick<SitePage, 'id' | 'shape'>, data: Loose): string[] {
  const lists: [string, string][] =
    page.shape === 'home'
      ? [['sections', 'Rows']]
      : [
          ['introSections', 'Above the list'],
          ['outroSections', 'Below the list'],
        ];
  return [
    ...pageProblems(page, data).map((p) => p.replace(/^src\/content\/pages\/[\w-]+\.md: /, '')),
    ...lists.flatMap(([field, where]) => previewProblems(data[field]).map((p) => `${where}: ${p}`)),
  ];
}
